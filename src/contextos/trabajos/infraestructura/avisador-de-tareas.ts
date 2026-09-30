import { Injectable, Logger } from '@nestjs/common';
import { CorreoService } from '../../../common/correo/correo.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TareaConRelaciones } from '../puertos/repositorio-tareas';

/**
 * Le avisa por correo a quien le asignaron una tarea.
 *
 * El aviso de verdad es la pantalla de inicio: ahí cada uno ve lo que le toca y
 * eso funciona siempre. Este correo es un complemento, y se trata como tal: si
 * falla, se anota y la asignación sigue siendo válida. Nadie tiene que quedarse
 * sin tarea asignada porque el servidor de correo esté caído.
 *
 * Hoy las casillas @lacteoslastres.com.ar rebotan por un tema de DNS que sigue
 * abierto, así que para la mitad del equipo este correo no llega. Razón de más
 * para que no sea el único camino.
 */
/**
 * APAGADO a pedido (2026-09-30): por ahora no se le manda correo a nadie
 * cuando le asignan una tarea. La tarea se sigue viendo en Hoy y en el
 * Calendario, que es el aviso de verdad.
 *
 * El código queda entero a propósito. Para volver a mandar los correos,
 * cambiar esto a `true` y desplegar.
 */
const AVISAR_POR_CORREO = false;

@Injectable()
export class AvisadorDeTareas {
  private readonly logger = new Logger(AvisadorDeTareas.name);

  constructor(
    private readonly correo: CorreoService,
    private readonly prisma: PrismaService,
  ) {}

  async avisarAsignacion(tarea: TareaConRelaciones): Promise<void> {
    if (!AVISAR_POR_CORREO) return;
    if (!tarea.asignadoAId) return;

    try {
      const persona = await this.prisma.usuario.findUnique({
        where: { id: tarea.asignadoAId },
        select: { nombre: true, email: true },
      });
      if (!persona?.email) return;

      const cuando = tarea.fecha.toISOString().slice(0, 10).split('-').reverse().join('/');
      const donde = tarea.equipoNombre ? `\nEquipo: ${tarea.equipoNombre}` : '';
      const detalle = tarea.descripcion ? `\n\n${tarea.descripcion}` : '';

      await this.correo.enviar({
        para: [persona.email],
        asunto: `Tarea para el ${cuando}: ${tarea.titulo}`,
        texto:
          `Hola ${persona.nombre},\n\n` +
          `Te asignaron una tarea para el ${cuando}.\n\n` +
          `${tarea.titulo}${donde}${detalle}\n\n` +
          'La vas a ver en el sistema, en Hoy y en el Calendario. Cuando la termines, ' +
          'marcala como hecha y contá qué hiciste: con eso queda registrada como orden de ' +
          'trabajo, con los materiales que hayas usado.\n',
      });
    } catch (error) {
      // A propósito no se propaga: el correo es un complemento del aviso en
      // pantalla, no el aviso.
      this.logger.warn(`No se pudo avisar por correo la tarea "${tarea.titulo}": ${String(error)}`);
    }
  }
}
