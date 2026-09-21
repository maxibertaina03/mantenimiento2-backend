import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import {
  anularOrdenTrabajo,
  cerrarOrdenTrabajo,
  crearOrdenTrabajo,
  DatosNuevaOrdenTrabajo,
  OrdenTrabajo,
  reabrirOrdenTrabajo,
  reasignarOrdenTrabajo,
  validarQueEsSuyo,
  TipoTrabajo,
  validarQueSePuedeEliminar,
} from '../dominio/orden-trabajo';
import { ConsultaEquipos } from '../puertos/consulta-equipos';
import { ConsultaUsuarios } from '../puertos/consulta-usuarios';
import {
  OrdenTrabajoConRelaciones,
  RepositorioOrdenesTrabajo,
} from '../puertos/repositorio-ordenes-trabajo';
import { Reloj } from '../puertos/reloj';

/** Lo que se puede cambiar de una orden mientras está abierta. */
export interface CambiosOrdenTrabajo {
  titulo?: string;
  descripcion?: string | null;
  tipo?: TipoTrabajo;
  equipoId?: string | null;
}

/**
 * Abrir, cerrar, reabrir y anular órdenes de trabajo.
 *
 * Las decisiones las toma el dominio; este caso de uso solo le acerca lo que
 * necesita saber —la orden como está hoy, cuántos materiales tiene cargados— y
 * guarda lo que el dominio devuelve.
 */
export class GestionarOrdenesTrabajo {
  constructor(
    private readonly repo: RepositorioOrdenesTrabajo,
    private readonly equipos: ConsultaEquipos,
    private readonly usuarios: ConsultaUsuarios,
    private readonly reloj: Reloj,
  ) {}

  private async traer(id: string): Promise<OrdenTrabajoConRelaciones> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) throw new ErrorNoEncontrado(`No existe la orden de trabajo con id ${id}`);
    return orden;
  }

  /**
   * Comprueba que el equipo exista antes de atarlo.
   *
   * Sin esto se podría guardar un id que no apunta a nada, y el error recién
   * aparecería meses después, cuando alguien abra la ficha de la máquina y vea
   * un trabajo que dice pertenecer a un equipo inexistente.
   */
  private async validarEquipo(equipoId: string | null | undefined): Promise<void> {
    if (!equipoId) return;
    const equipo = await this.equipos.buscarPorId(equipoId);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${equipoId}`);
  }

  /**
   * Comprueba que a quien se le asigna exista y pueda trabajar órdenes.
   *
   * Sin el segundo control se podría dejarle el trabajo a alguien de
   * administración, que ni siquiera ve el módulo: la orden quedaría trabada
   * desde el primer día y nadie sabría por qué.
   */
  private async validarAsignado(usuarioId: string): Promise<void> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw new ErrorNoEncontrado(`No existe el usuario con id ${usuarioId}`);
    if (!usuario.puedeTrabajar) {
      throw new ErrorDatosInvalidos(
        `${usuario.nombre} no puede hacerse cargo de órdenes de trabajo. Elegí a alguien de ` +
          'mantenimiento, o dale el permiso primero.',
      );
    }
  }

  async crear(datos: DatosNuevaOrdenTrabajo): Promise<OrdenTrabajoConRelaciones> {
    await this.validarEquipo(datos.equipoId);
    // El dominio decide a quién queda: al elegido, o a quien la abre.
    const orden = crearOrdenTrabajo(datos, this.reloj.ahora());
    await this.validarAsignado(orden.asignadoAId);
    return this.repo.crear(orden);
  }

  /**
   * Cambia a quién está asignada.
   *
   * Es la única acción sobre una orden que no exige ser su dueño, y por eso
   * pide un permiso aparte. Es la salida para cuando la persona que la tenía no
   * está: sin esto, la orden quedaría trabada hasta que vuelva.
   */
  async reasignar(id: string, nuevoAsignadoId: string): Promise<OrdenTrabajoConRelaciones> {
    const orden = await this.traer(id);
    await this.validarAsignado(nuevoAsignadoId);
    return this.repo.actualizar(id, reasignarOrdenTrabajo(orden, nuevoAsignadoId));
  }

  async editar(
    id: string,
    cambios: CambiosOrdenTrabajo,
    usuarioId: string | null,
  ): Promise<OrdenTrabajoConRelaciones> {
    const orden = await this.traer(id);
    validarQueEsSuyo(orden, usuarioId);

    if (orden.estado !== 'ABIERTA') {
      throw new ErrorDatosInvalidos(
        `La orden ${orden.numero} no está abierta: para corregirla, reabrila primero.`,
      );
    }

    if (cambios.equipoId !== undefined) await this.validarEquipo(cambios.equipoId);

    const aGuardar: Partial<OrdenTrabajo> = {};

    // El texto vuelve a pasar por el dominio en vez de confiar en el DTO: las
    // reglas "una orden sin título no sirve" y "los espacios se normalizan"
    // tienen que valer igual al editar que al crear.
    if (cambios.titulo !== undefined || cambios.descripcion !== undefined) {
      const revisada = crearOrdenTrabajo(
        {
          titulo: cambios.titulo ?? orden.titulo,
          descripcion: cambios.descripcion === undefined ? orden.descripcion : cambios.descripcion,
          tipo: orden.tipo,
        },
        this.reloj.ahora(),
      );
      if (cambios.titulo !== undefined) aGuardar.titulo = revisada.titulo;
      if (cambios.descripcion !== undefined) aGuardar.descripcion = revisada.descripcion;
    }

    if (cambios.tipo !== undefined) aGuardar.tipo = cambios.tipo;
    if (cambios.equipoId !== undefined) aGuardar.equipoId = cambios.equipoId;

    return this.repo.actualizar(id, aGuardar);
  }

  async cerrar(
    id: string,
    resolucion: string,
    usuarioId: string | null,
  ): Promise<OrdenTrabajoConRelaciones> {
    const orden = await this.traer(id);
    validarQueEsSuyo(orden, usuarioId);
    return this.repo.actualizar(
      id,
      cerrarOrdenTrabajo(orden, resolucion, this.reloj.ahora(), usuarioId),
    );
  }

  async reabrir(id: string, usuarioId: string | null): Promise<OrdenTrabajoConRelaciones> {
    const orden = await this.traer(id);
    validarQueEsSuyo(orden, usuarioId);
    return this.repo.actualizar(id, reabrirOrdenTrabajo(orden));
  }

  async eliminar(id: string): Promise<void> {
    const orden = await this.traer(id);
    validarQueSePuedeEliminar(orden, orden.materiales.length);
    await this.repo.eliminar(id);
  }

  async anular(
    id: string,
    motivo: string,
    usuarioId: string | null,
  ): Promise<OrdenTrabajoConRelaciones> {
    const orden = await this.traer(id);
    validarQueEsSuyo(orden, usuarioId);
    // El dominio necesita saber cuántos materiales tiene cargados: una orden
    // que ya movió stock no se anula, se le quitan los materiales primero.
    return this.repo.actualizar(id, anularOrdenTrabajo(orden, motivo, orden.materiales.length));
  }
}
