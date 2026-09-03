import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PlanMantenimiento } from '../dominio/plan-mantenimiento';
import { PlanConEquipo, RepositorioPlanes } from '../puertos/repositorio-planes';

@Injectable()
export class PrismaRepositorioPlanes implements RepositorioPlanes {
  constructor(private readonly prisma: PrismaService) {}

  crear(plan: Omit<PlanMantenimiento, 'id'>): Promise<PlanMantenimiento> {
    return this.prisma.planMantenimiento.create({ data: plan });
  }

  actualizar(
    id: string,
    cambios: Partial<Omit<PlanMantenimiento, 'id'>>,
  ): Promise<PlanMantenimiento> {
    return this.prisma.planMantenimiento.update({ where: { id }, data: cambios });
  }

  buscarPorId(id: string): Promise<PlanMantenimiento | null> {
    return this.prisma.planMantenimiento.findUnique({ where: { id } });
  }

  listarPorEquipo(equipoId: string): Promise<PlanMantenimiento[]> {
    return this.prisma.planMantenimiento.findMany({
      where: { equipoId },
      orderBy: [{ activo: 'desc' }, { proximaFecha: 'asc' }],
    });
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
      proximaFecha: f.proximaFecha,
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
