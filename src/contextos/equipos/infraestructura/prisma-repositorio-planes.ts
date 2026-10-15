import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ModoProxima, PlanMantenimiento } from '../dominio/plan-mantenimiento';
import { PlanConEquipo, RepositorioPlanes } from '../puertos/repositorio-planes';

/** El modo viene de la base como texto; el dominio lo conoce como tipo. */
function aPlan<T extends { modoProxima: string }>(fila: T): T & { modoProxima: ModoProxima } {
  return { ...fila, modoProxima: fila.modoProxima as ModoProxima };
}

@Injectable()
export class PrismaRepositorioPlanes implements RepositorioPlanes {
  constructor(private readonly prisma: PrismaService) {}

  async crear(plan: Omit<PlanMantenimiento, 'id'>): Promise<PlanMantenimiento> {
    return aPlan(await this.prisma.planMantenimiento.create({ data: plan }));
  }

  async actualizar(
    id: string,
    cambios: Partial<Omit<PlanMantenimiento, 'id'>>,
  ): Promise<PlanMantenimiento> {
    return aPlan(await this.prisma.planMantenimiento.update({ where: { id }, data: cambios }));
  }

  async buscarPorId(id: string): Promise<PlanMantenimiento | null> {
    const fila = await this.prisma.planMantenimiento.findUnique({ where: { id } });
    return fila ? aPlan(fila) : null;
  }

  async listarPorEquipo(equipoId: string): Promise<PlanMantenimiento[]> {
    const filas = await this.prisma.planMantenimiento.findMany({
      where: { equipoId },
      orderBy: [{ activo: 'desc' }, { proximaFecha: 'asc' }],
    });
    return filas.map(aPlan);
  }

  async listarQueVencenHasta(fechaCorte: Date): Promise<PlanConEquipo[]> {
    const filas = await this.prisma.planMantenimiento.findMany({
      where: {
        activo: true,
        proximaFecha: { lte: fechaCorte },
        // Los equipos desafectados no generan avisos. Se filtra en la consulta
        // y no después: traerlos para descartarlos sería trabajo al pedo.
        equipo: { estado: { in: ['OPERATIVO', 'EN_REPARACION'] } },
      },
      include: {
        equipo: { select: { nombre: true, estado: true, ubicacion: { select: { nombre: true } } } },
      },
      orderBy: { proximaFecha: 'asc' },
    });

    return filas.map((f) => ({
      id: f.id,
      equipoId: f.equipoId,
      nombre: f.nombre,
      tareas: f.tareas,
      periodicidadDias: f.periodicidadDias,
      diasSemana: f.diasSemana,
      proximaFecha: f.proximaFecha,
      modoProxima: f.modoProxima as ModoProxima,
      postergadoDesde: f.postergadoDesde,
      activo: f.activo,
      equipoNombre: f.equipo.nombre,
      equipoEstado: f.equipo.estado,
      ubicacionNombre: f.equipo.ubicacion?.nombre ?? null,
    }));
  }

  async eliminar(id: string): Promise<void> {
    await this.prisma.planMantenimiento.delete({ where: { id } });
  }
}
