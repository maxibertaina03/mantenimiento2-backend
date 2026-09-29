import {
  EstadoEquipoIt,
  decidirAsignacion,
  estadoInicial,
  nombreParaMostrar,
  validarBajaSinTenedor,
  validarCodigoLibre,
  validarEliminable,
} from '../dominio/equipo-it';
import { ErrorNoEncontrado } from '../dominio/errores';
import { ConsultaResponsables } from '../puertos/consulta-responsables';
import { Reloj } from '../puertos/reloj';
import {
  AsignacionIt,
  DatosEquipoIt,
  EquipoItConRelaciones,
  FiltroEquiposIt,
  RepositorioEquiposIt,
  ResumenEquiposIt,
} from '../puertos/repositorio-equipos-it';

/** Lo que se pide al dar de alta un equipo. */
export type DatosAlta = DatosEquipoIt & { tipoId: string };

/**
 * El inventario de informática: altas, cambios y quién tiene cada equipo.
 *
 * Las decisiones las toma el dominio; este caso de uso le acerca lo que
 * necesita saber —si el código ya está usado, si el responsable existe— y
 * guarda lo que el dominio decide. No conoce Nest, ni Prisma, ni HTTP.
 */
export class GestionarEquiposIt {
  constructor(
    private readonly repo: RepositorioEquiposIt,
    private readonly responsables: ConsultaResponsables,
    private readonly reloj: Reloj,
  ) {}

  private async traer(id: string): Promise<EquipoItConRelaciones> {
    const equipo = await this.repo.buscarPorId(id);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${id}`);
    return equipo;
  }

  private async validarCodigo(codigoInterno: string, idPropio?: string): Promise<void> {
    const existente = await this.repo.buscarPorCodigoInterno(codigoInterno);
    validarCodigoLibre(
      codigoInterno,
      existente && {
        id: existente.id,
        nombreParaMostrar: nombreParaMostrar(existente.marcaNombre, existente.modeloNombre),
      },
      idPropio,
    );
  }

  private async validarResponsable(responsableId: string): Promise<void> {
    if (!(await this.responsables.existe(responsableId))) {
      throw new ErrorNoEncontrado(`No existe el responsable con id ${responsableId}`);
    }
  }

  async crear(datos: DatosAlta): Promise<EquipoItConRelaciones> {
    if (datos.codigoInterno) await this.validarCodigo(datos.codigoInterno);
    if (datos.responsableId) await this.validarResponsable(datos.responsableId);

    const estado = estadoInicial(datos.estado, datos.responsableId);
    const creado = await this.repo.crear({ ...datos, estado });

    // Si nace a cargo de alguien, el historial arranca con ese tramo. Sin esto
    // la ficha diría quién lo tiene pero el historial estaría vacío.
    if (datos.responsableId) {
      return this.repo.reasignar({
        equipoId: creado.id,
        responsableId: datos.responsableId,
        registradoPorId: null,
        motivo: 'Alta del equipo',
        estadoResultante: estado,
      });
    }
    return creado;
  }

  async listar(
    filtro: FiltroEquiposIt,
    pagina: number,
    limite: number,
  ): Promise<{ datos: EquipoItConRelaciones[]; total: number; pagina: number; limite: number }> {
    const [datos, total] = await Promise.all([
      this.repo.listar(filtro, (pagina - 1) * limite, limite),
      this.repo.contar(filtro),
    ]);
    return { datos, total, pagina, limite };
  }

  obtener(id: string): Promise<EquipoItConRelaciones> {
    return this.traer(id);
  }

  async actualizar(id: string, cambios: DatosEquipoIt): Promise<EquipoItConRelaciones> {
    const actual = await this.traer(id);
    if (cambios.codigoInterno) await this.validarCodigo(cambios.codigoInterno, id);

    // El responsable no se cambia editando: se cambia asignando, que es lo que
    // deja el tramo en el historial. Por eso la regla de la baja se mira contra
    // quien lo tiene hoy.
    validarBajaSinTenedor(cambios.estado ?? actual.estado, actual.responsableId);

    return this.repo.actualizar(id, { ...cambios, responsableId: undefined });
  }

  /**
   * Pone el equipo a cargo de alguien, o lo devuelve a depósito (`null`).
   * Cierra el tramo anterior del historial y abre uno nuevo.
   */
  async asignar(
    id: string,
    responsableId: string | null,
    registradoPorId: string | null,
    motivo?: string | null,
    notas?: string | null,
  ): Promise<EquipoItConRelaciones> {
    const equipo = await this.traer(id);

    // Primero decide el dominio —si está de baja o ya lo tiene esa persona, el
    // responsable ni se busca— y después se comprueba que exista.
    const estadoResultante: EstadoEquipoIt = decidirAsignacion(equipo, responsableId);
    if (responsableId) await this.validarResponsable(responsableId);

    return this.repo.reasignar({
      equipoId: id,
      responsableId,
      registradoPorId,
      motivo,
      notas,
      estadoResultante,
    });
  }

  async listarAsignaciones(id: string): Promise<AsignacionIt[]> {
    await this.traer(id);
    return this.repo.listarAsignaciones(id);
  }

  /**
   * Deja constancia de que a estos equipos se les imprimió la etiqueta.
   *
   * La fecha la pone el servidor, no la pantalla: tiene que ser la de acá, no
   * la de la máquina desde la que se imprimió.
   */
  marcarQrGenerado(ids: string[]): Promise<number> {
    return this.repo.marcarQrGenerado(ids, this.reloj.ahora());
  }

  resumen(): Promise<ResumenEquiposIt> {
    return this.repo.resumen();
  }

  async eliminar(id: string): Promise<void> {
    validarEliminable(await this.traer(id));
    await this.repo.eliminar(id);
  }
}
