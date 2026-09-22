import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EstadoTarea, Rutina, Tarea } from '../dominio/tarea';
import {
  FiltroTareas,
  RepositorioTareas,
  RutinaConRelaciones,
  TareaConRelaciones,
} from '../puertos/repositorio-tareas';

const RELACIONES = {
  asignadoA: { select: { nombre: true } },
  equipo: { select: { nombre: true } },
  plan: { select: { nombre: true } },
  rutina: { select: { titulo: true } },
  ordenTrabajo: { select: { numero: true } },
} as const;

const RELACIONES_RUTINA = {
  asignadoA: { select: { nombre: true } },
  equipo: { select: { nombre: true } },
} as const;

type Fila = Prisma.TareaProgramadaGetPayload<{ include: typeof RELACIONES }>;
type FilaRutina = Prisma.RutinaTareaGetPayload<{ include: typeof RELACIONES_RUTINA }>;

/** El único archivo del calendario que sabe que existe Prisma. */
@Injectable()
export class PrismaRepositorioTareas implements RepositorioTareas {
  private readonly logger = new Logger(PrismaRepositorioTareas.name);

  constructor(private readonly prisma: PrismaService) {}

  private aDominio(fila: Fila): TareaConRelaciones {
    return {
      id: fila.id,
      titulo: fila.titulo,
      descripcion: fila.descripcion,
      fecha: fila.fecha,
      estado: fila.estado as EstadoTarea,
      asignadoAId: fila.asignadoAId,
      equipoId: fila.equipoId,
      planId: fila.planId,
      rutinaId: fila.rutinaId,
      ordenTrabajoId: fila.ordenTrabajoId,
      creadaPorId: fila.creadaPorId,
      creadoEn: fila.creadoEn,
      asignadoANombre: fila.asignadoA?.nombre ?? null,
      equipoNombre: fila.equipo?.nombre ?? null,
      planNombre: fila.plan?.nombre ?? null,
      rutinaTitulo: fila.rutina?.titulo ?? null,
      ordenTrabajoNumero: fila.ordenTrabajo?.numero ?? null,
    };
  }

  private rutinaADominio(fila: FilaRutina): RutinaConRelaciones {
    return {
      id: fila.id,
      titulo: fila.titulo,
      descripcion: fila.descripcion,
      cadaDias: fila.cadaDias,
      desde: fila.desde,
      hasta: fila.hasta,
      equipoId: fila.equipoId,
      asignadoAId: fila.asignadoAId,
      activa: fila.activa,
      creadaPorId: fila.creadaPorId,
      creadoEn: fila.creadoEn,
      asignadoANombre: fila.asignadoA?.nombre ?? null,
      equipoNombre: fila.equipo?.nombre ?? null,
    };
  }

  private datos(tarea: Omit<Tarea, 'id' | 'creadoEn'>) {
    return {
      titulo: tarea.titulo,
      descripcion: tarea.descripcion,
      fecha: tarea.fecha,
      estado: tarea.estado,
      asignadoAId: tarea.asignadoAId,
      equipoId: tarea.equipoId,
      planId: tarea.planId,
      rutinaId: tarea.rutinaId,
      ordenTrabajoId: tarea.ordenTrabajoId,
      creadaPorId: tarea.creadaPorId,
    };
  }

  async crear(tarea: Omit<Tarea, 'id' | 'creadoEn'>): Promise<TareaConRelaciones> {
    const fila = await this.prisma.tareaProgramada.create({
      data: this.datos(tarea),
      include: RELACIONES,
    });
    return this.aDominio(fila);
  }

  /**
   * Intenta crearla y se da por satisfecho si ya estaba.
   *
   * La condición de carrera es real: dos personas abriendo el calendario al
   * mismo tiempo generan las mismas tareas. No se resuelve mirando antes de
   * insertar —entre el mirar y el insertar pasa lo mismo— sino dejando que la
   * base decida con su índice único y tratando el choque como éxito.
   */
  async crearSiNoExiste(tarea: Omit<Tarea, 'id' | 'creadoEn'>): Promise<boolean> {
    try {
      await this.prisma.tareaProgramada.create({ data: this.datos(tarea) });
      return true;
    } catch (error) {
      // P2002: chocó con el único de (plan, fecha) o (rutina, fecha).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async buscarPorId(id: string): Promise<TareaConRelaciones | null> {
    const fila = await this.prisma.tareaProgramada.findUnique({
      where: { id },
      include: RELACIONES,
    });
    return fila ? this.aDominio(fila) : null;
  }

  async listarEntre(desde: Date, hasta: Date, filtro: FiltroTareas): Promise<TareaConRelaciones[]> {
    const filas = await this.prisma.tareaProgramada.findMany({
      where: {
        fecha: { gte: desde, lte: hasta },
        ...(filtro.asignadoAId ? { asignadoAId: filtro.asignadoAId } : {}),
        ...(filtro.equipoId ? { equipoId: filtro.equipoId } : {}),
        ...(filtro.soloPendientes ? { estado: 'PENDIENTE' } : {}),
      },
      orderBy: [{ fecha: 'asc' }, { creadoEn: 'asc' }],
      include: RELACIONES,
    });
    return filas.map((f) => this.aDominio(f));
  }

  async actualizar(id: string, cambios: Partial<Tarea>): Promise<TareaConRelaciones> {
    const fila = await this.prisma.tareaProgramada.update({
      where: { id },
      data: {
        ...(cambios.titulo === undefined ? {} : { titulo: cambios.titulo }),
        ...(cambios.descripcion === undefined ? {} : { descripcion: cambios.descripcion }),
        ...(cambios.fecha === undefined ? {} : { fecha: cambios.fecha }),
        ...(cambios.estado === undefined ? {} : { estado: cambios.estado }),
        ...(cambios.asignadoAId === undefined ? {} : { asignadoAId: cambios.asignadoAId }),
        ...(cambios.equipoId === undefined ? {} : { equipoId: cambios.equipoId }),
        ...(cambios.ordenTrabajoId === undefined ? {} : { ordenTrabajoId: cambios.ordenTrabajoId }),
      },
      include: RELACIONES,
    });
    return this.aDominio(fila);
  }

  // ── Rutinas ──────────────────────────────────────────────────────────────

  async listarRutinas(soloActivas: boolean): Promise<RutinaConRelaciones[]> {
    const filas = await this.prisma.rutinaTarea.findMany({
      where: soloActivas ? { activa: true } : {},
      orderBy: [{ activa: 'desc' }, { titulo: 'asc' }],
      include: RELACIONES_RUTINA,
    });
    return filas.map((f) => this.rutinaADominio(f));
  }

  async crearRutina(rutina: Omit<Rutina, 'id' | 'creadoEn'>): Promise<RutinaConRelaciones> {
    const fila = await this.prisma.rutinaTarea.create({
      data: {
        titulo: rutina.titulo,
        descripcion: rutina.descripcion,
        cadaDias: rutina.cadaDias,
        desde: rutina.desde,
        hasta: rutina.hasta,
        equipoId: rutina.equipoId,
        asignadoAId: rutina.asignadoAId,
        activa: rutina.activa,
        creadaPorId: rutina.creadaPorId,
      },
      include: RELACIONES_RUTINA,
    });
    return this.rutinaADominio(fila);
  }

  async buscarRutina(id: string): Promise<RutinaConRelaciones | null> {
    const fila = await this.prisma.rutinaTarea.findUnique({
      where: { id },
      include: RELACIONES_RUTINA,
    });
    return fila ? this.rutinaADominio(fila) : null;
  }

  async actualizarRutina(id: string, cambios: Partial<Rutina>): Promise<RutinaConRelaciones> {
    const fila = await this.prisma.rutinaTarea.update({
      where: { id },
      data: {
        ...(cambios.titulo === undefined ? {} : { titulo: cambios.titulo }),
        ...(cambios.descripcion === undefined ? {} : { descripcion: cambios.descripcion }),
        ...(cambios.cadaDias === undefined ? {} : { cadaDias: cambios.cadaDias }),
        ...(cambios.desde === undefined ? {} : { desde: cambios.desde }),
        ...(cambios.hasta === undefined ? {} : { hasta: cambios.hasta }),
        ...(cambios.equipoId === undefined ? {} : { equipoId: cambios.equipoId }),
        ...(cambios.asignadoAId === undefined ? {} : { asignadoAId: cambios.asignadoAId }),
        ...(cambios.activa === undefined ? {} : { activa: cambios.activa }),
      },
      include: RELACIONES_RUTINA,
    });

    // Apagar una rutina no borra las tareas que ya generó: las pendientes que
    // nadie va a hacer se limpian solas al cancelarlas, y las hechas son
    // historia. Dejarlo dicho para que no parezca un olvido.
    if (cambios.activa === false) {
      this.logger.log(`Rutina ${id} apagada: deja de generar tareas nuevas.`);
    }

    return this.rutinaADominio(fila);
  }
}
