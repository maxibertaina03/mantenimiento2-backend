import { crearTarea } from '../dominio/tarea';
import { CerrarTareaDelPlan, OrdenCerrada } from './cerrar-tarea-del-plan';
import { RepositorioTareasEnMemoria } from './repositorio-tareas-en-memoria';

/**
 * Un service registrado desde la ficha del equipo tiene que dejar hecha la
 * tarea del calendario. Antes el plan corría y la tarea quedaba vencida por un
 * trabajo que ya estaba hecho.
 */
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const ORDEN: OrdenCerrada = {
  id: 'ot-1',
  estado: 'CERRADA',
  planId: 'plan-purga',
  cerradaPorId: 'u2',
  asignadoAId: 'u2',
};

async function armar(asignadoAId: string | null = null) {
  const tareas = new RepositorioTareasEnMemoria();
  const pendiente = await tareas.crear(
    crearTarea({
      titulo: 'Purga de agua',
      fecha: dia('2026-09-30'),
      equipoId: 'eq-compresor',
      planId: 'plan-purga',
      asignadoAId,
    }),
  );
  return { tareas, pendiente, cerrar: new CerrarTareaDelPlan(tareas) };
}

describe('registrar un service desde el equipo deja hecha la tarea del calendario', () => {
  it('cierra la tarea pendiente del plan, atada a la orden y a nombre de quien la cerro', async () => {
    const { cerrar, tareas, pendiente } = await armar();

    await cerrar.ejecutar(ORDEN);

    const despues = await tareas.buscarPorId(pendiente.id);
    expect(despues?.estado).toBe('HECHA');
    expect(despues?.ordenTrabajoId).toBe('ot-1');
    expect(despues?.asignadoAId).toBe('u2');
  });

  it('si la tarea tenia responsable, lo conserva', async () => {
    const { cerrar, tareas, pendiente } = await armar('u1');

    await cerrar.ejecutar(ORDEN);

    expect((await tareas.buscarPorId(pendiente.id))?.asignadoAId).toBe('u1');
  });

  it('una orden sin plan, o todavia abierta, no toca el calendario', async () => {
    const { cerrar, tareas, pendiente } = await armar();

    expect(await cerrar.ejecutar({ ...ORDEN, planId: null })).toBeNull();
    expect(await cerrar.ejecutar({ ...ORDEN, estado: 'ABIERTA' })).toBeNull();
    expect((await tareas.buscarPorId(pendiente.id))?.estado).toBe('PENDIENTE');
  });

  it('REGRESION: una orden que ya explica una tarea no cierra otra (reabrir y volver a cerrar)', async () => {
    const { cerrar, tareas, pendiente } = await armar();
    await cerrar.ejecutar(ORDEN);
    // La del dia siguiente, que el calendario genera despues.
    const siguiente = await tareas.crear(
      crearTarea({
        titulo: 'Purga de agua',
        fecha: dia('2026-10-01'),
        equipoId: 'eq-compresor',
        planId: 'plan-purga',
      }),
    );

    expect(await cerrar.ejecutar(ORDEN)).toBeNull();

    expect((await tareas.buscarPorId(pendiente.id))?.ordenTrabajoId).toBe('ot-1');
    expect((await tareas.buscarPorId(siguiente.id))?.estado).toBe('PENDIENTE');
  });

  it('si el plan no tiene tarea pendiente, no hace nada', async () => {
    const { cerrar } = await armar();
    expect(await cerrar.ejecutar({ ...ORDEN, planId: 'otro-plan' })).toBeNull();
  });
});
