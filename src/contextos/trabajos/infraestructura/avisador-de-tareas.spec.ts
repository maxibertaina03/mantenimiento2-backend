import { CorreoService } from '../../../common/correo/correo.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TareaConRelaciones } from '../puertos/repositorio-tareas';
import { AvisadorDeTareas } from './avisador-de-tareas';

/**
 * El correo de tarea asignada está APAGADO a pedido (2026-09-30).
 *
 * Si alguien lo vuelve a prender cambiando `AVISAR_POR_CORREO`, este test va a
 * fallar a propósito: es el recordatorio de que prenderlo es una decisión, y
 * de reemplazarlo por uno que pruebe el envío.
 */
describe('AvisadorDeTareas', () => {
  it('con los avisos apagados, asignar una tarea no manda ningún correo', async () => {
    const correo = { enviar: jest.fn() };
    const prisma = {
      usuario: { findUnique: jest.fn(async () => ({ nombre: 'Leandro', email: 'l@x.com' })) },
    };
    const avisador = new AvisadorDeTareas(
      correo as unknown as CorreoService,
      prisma as unknown as PrismaService,
    );

    await avisador.avisarAsignacion({
      asignadoAId: 'u1',
      titulo: 'Revisar caldera',
      fecha: new Date('2026-10-01T00:00:00.000Z'),
    } as unknown as TareaConRelaciones);

    expect(correo.enviar).not.toHaveBeenCalled();
  });
});
