import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import {
  asignarTarea,
  cancelarTarea,
  completarTarea,
  crearRutina,
  crearTarea,
  DatosNuevaRutina,
  DatosNuevaTarea,
  Rutina,
  validarQueSePuedeCompletar,
} from '../dominio/tarea';
import { ConsultaEquipos } from '../puertos/consulta-equipos';
import { ConsultaUsuarios } from '../puertos/consulta-usuarios';
import {
  RepositorioTareas,
  RutinaConRelaciones,
  TareaConRelaciones,
} from '../puertos/repositorio-tareas';
import { Reloj } from '../puertos/reloj';
import { DatosMaterialUsado } from './usar-materiales';
import { RegistrarTrabajoHecho } from './registrar-trabajo-hecho';

/** Lo que hace falta para dar una tarea por hecha. */
export interface DatosTareaHecha {
  /** Qué se hizo. Va a la orden de trabajo que sale de esto. */
  resolucion: string;
  materiales?: DatosMaterialUsado[];
  costoManoObra?: number | null;
  horasParada?: number | null;
}

/**
 * Crear, repartir y dar por hechas las tareas del calendario.
 *
 * Lo importante está en `completar`: dar una tarea por hecha no la marca y
 * listo, genera la orden de trabajo con lo que se usó. Es lo que hace que el
 * calendario y el historial de la máquina sean la misma historia contada dos
 * veces, una antes y otra después.
 */
export class GestionarTareas {
  constructor(
    private readonly repo: RepositorioTareas,
    private readonly equipos: ConsultaEquipos,
    private readonly usuarios: ConsultaUsuarios,
    private readonly trabajos: RegistrarTrabajoHecho,
    private readonly reloj: Reloj,
  ) {}

  private async traer(id: string): Promise<TareaConRelaciones> {
    const tarea = await this.repo.buscarPorId(id);
    if (!tarea) throw new ErrorNoEncontrado(`No existe la tarea con id ${id}`);
    return tarea;
  }

  private async validarEquipo(equipoId: string | null | undefined): Promise<void> {
    if (!equipoId) return;
    if (!(await this.equipos.buscarPorId(equipoId))) {
      throw new ErrorNoEncontrado(`No existe el equipo con id ${equipoId}`);
    }
  }

  /**
   * A quién se le puede dar una tarea.
   *
   * Solo alguien que pueda trabajar órdenes: si no, la tarea queda trabada
   * desde el primer día porque esa persona ni siquiera ve el módulo.
   */
  private async validarAsignado(usuarioId: string | null | undefined): Promise<void> {
    if (!usuarioId) return;
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario) throw new ErrorNoEncontrado(`No existe el usuario con id ${usuarioId}`);
    if (!usuario.puedeTrabajar) {
      throw new ErrorDatosInvalidos(
        `${usuario.nombre} no puede hacerse cargo de tareas. Elegí a alguien de mantenimiento.`,
      );
    }
  }

  async crear(datos: DatosNuevaTarea): Promise<TareaConRelaciones> {
    await this.validarEquipo(datos.equipoId);
    await this.validarAsignado(datos.asignadoAId);
    return this.repo.crear(crearTarea(datos));
  }

  async asignar(id: string, usuarioId: string): Promise<TareaConRelaciones> {
    const tarea = await this.traer(id);
    await this.validarAsignado(usuarioId);
    return this.repo.actualizar(id, asignarTarea(tarea, usuarioId));
  }

  async cancelar(id: string): Promise<TareaConRelaciones> {
    const tarea = await this.traer(id);
    return this.repo.actualizar(id, cancelarTarea(tarea));
  }

  /**
   * Da la tarea por hecha y deja la orden de trabajo que la explica.
   *
   * El orden importa: primero la orden, después la tarea. Al revés, un fallo al
   * crear la orden dejaría la tarea marcada como hecha sin nada que la respalde,
   * y el material que se usó sin descontar.
   */
  async completar(
    id: string,
    datos: DatosTareaHecha,
    usuarioId: string | null,
  ): Promise<TareaConRelaciones> {
    const tarea = await this.traer(id);

    // Se valida antes de tocar el stock: si la tarea no es suya, o ya está
    // cerrada, no se mueve ni un material.
    validarQueSePuedeCompletar(tarea, usuarioId);

    const orden = await this.trabajos.ejecutar(
      {
        titulo: tarea.titulo,
        descripcion: tarea.descripcion,
        // Una tarea de un plan es un preventivo; el resto, correctivo, salvo
        // que quien la cargó dijera otra cosa en el título.
        tipo: tarea.planId ? 'PREVENTIVO' : 'CORRECTIVO',
        equipoId: tarea.equipoId,
        planId: tarea.planId,
        // La fecha del trabajo es la de la tarea: una tarea de ayer que se
        // cierra hoy se hizo ayer. Salvo que la tarea sea futura —un service
        // que se adelantó— y ahí es hoy, porque nadie hizo nada mañana.
        fecha: this.fechaDelTrabajo(tarea.fecha),
        abiertaPorId: usuarioId,
        asignadoAId: tarea.asignadoAId ?? usuarioId,
        resolucion: datos.resolucion,
        costoManoObra: datos.costoManoObra,
        horasParada: datos.horasParada,
        materiales: datos.materiales,
      },
      usuarioId,
    );

    // `usuarioId` ya no puede ser null: lo acaba de comprobar el dominio.
    return this.repo.actualizar(id, completarTarea(tarea, usuarioId as string, orden.id));
  }

  /** La de la tarea, o hoy si esa fecha todavía no llegó. */
  private fechaDelTrabajo(fechaDeLaTarea: Date): Date {
    const ahora = this.reloj.ahora();
    return fechaDeLaTarea.getTime() > ahora.getTime() ? ahora : fechaDeLaTarea;
  }

  // ── Rutinas ──────────────────────────────────────────────────────────────

  async listarRutinas(soloActivas: boolean): Promise<RutinaConRelaciones[]> {
    return this.repo.listarRutinas(soloActivas);
  }

  async crearRutina(datos: DatosNuevaRutina): Promise<RutinaConRelaciones> {
    await this.validarEquipo(datos.equipoId);
    await this.validarAsignado(datos.asignadoAId);
    return this.repo.crearRutina(crearRutina(datos));
  }

  async cambiarRutina(id: string, cambios: Partial<Rutina>): Promise<RutinaConRelaciones> {
    const rutina = await this.repo.buscarRutina(id);
    if (!rutina) throw new ErrorNoEncontrado(`No existe la rutina con id ${id}`);
    if (cambios.asignadoAId !== undefined) await this.validarAsignado(cambios.asignadoAId);
    return this.repo.actualizarRutina(id, cambios);
  }
}
