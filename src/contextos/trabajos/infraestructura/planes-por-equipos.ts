import { Injectable } from '@nestjs/common';
import { GestionarPlanes } from '../../equipos/aplicacion/gestionar-planes';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PlanesDeMantenimiento } from '../puertos/planes-de-mantenimiento';

/**
 * El puente hacia los planes, que viven en el contexto de equipos.
 *
 * Es la única dependencia de este contexto hacia el otro, y es deliberada: la
 * cuenta de "cuándo toca el próximo" es de los planes, y copiarla acá haría que
 * dos lugares calcularan la misma fecha. Tarde o temprano darían distinto.
 *
 * La comprobación de a qué equipo pertenece un plan sí se hace acá, leyendo dos
 * columnas: es una pregunta de sí o no, y hacerla pasar por el caso de uso del
 * otro contexto sería traerse su modelo entero para nada.
 */
@Injectable()
export class PlanesPorEquipos implements PlanesDeMantenimiento {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planes: GestionarPlanes,
  ) {}

  async esDelEquipo(planId: string, equipoId: string): Promise<boolean> {
    const fila = await this.prisma.planMantenimiento.findFirst({
      where: { id: planId, equipoId },
      select: { id: true },
    });
    return fila !== null;
  }

  async registrarTrabajo(planId: string, fechaDelTrabajo: Date): Promise<void> {
    await this.planes.adelantarDespuesDeTrabajo(planId, fechaDelTrabajo);
  }
}
