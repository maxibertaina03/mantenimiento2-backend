import { crearTarea } from '../dominio/tarea';
import { PlanesEnMemoria } from './planes-en-memoria';
import { OrdenCerrada, RegistrarTrabajoDePlan } from './registrar-trabajo-de-plan';
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
  fecha: dia('2026-09-30'),
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
  const planes = new PlanesEnMemoria();
  return { tareas, pendiente, planes, cerrar: new RegistrarTrabajoDePlan(planes, tareas) };
}

describe('se hizo el trabajo de un plan: el plan corre y la tarea del calendario queda hecha', () => {
  it('avisa al plan con la fecha real del trabajo', async () => {
    const { cerrar, planes } = await armar();

    await cerrar.ejecutar(ORDEN);

    // Con la fecha de la tarea que cierra, para que el plan no vuelva a caer ahí.
    expect(planes.avisos).toEqual([
      { planId: 'plan-purga', fecha: dia('2026-09-30'), yaHechoHasta: dia('2026-09-30') },
    ]);
  });

  it('desde «dar por hecha» corre el plan pero no busca otra tarea: esa la cierra quien llama', async () => {
    const { cerrar, planes, tareas, pendiente } = await armar();

    expect(await cerrar.ejecutar(ORDEN, { cierraSuPropiaTarea: true })).toBeNull();

    expect(planes.avisos).toHaveLength(1);
    expect((await tareas.buscarPorId(pendiente.id))?.estado).toBe('PENDIENTE');
  });

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

  it('REGRESION: un trabajo adelantado le dice al plan qué día ya quedó hecho', async () => {
    // La purga del 30/9 hecha el 29/9: el plan no puede volver a quedar en el 30.
    const { cerrar, planes } = await armar();

    await cerrar.ejecutar({ ...ORDEN, fecha: dia('2026-09-29') });

    expect(planes.avisos).toEqual([
      { planId: 'plan-purga', fecha: dia('2026-09-29'), yaHechoHasta: dia('2026-09-30') },
    ]);
  });

  it('una orden sin plan, o todavia abierta, no toca ni el plan ni el calendario', async () => {
    const { cerrar, tareas, pendiente, planes } = await armar();

    expect(await cerrar.ejecutar({ ...ORDEN, planId: null })).toBeNull();
    expect(await cerrar.ejecutar({ ...ORDEN, estado: 'ABIERTA' })).toBeNull();
    expect((await tareas.buscarPorId(pendiente.id))?.estado).toBe('PENDIENTE');
    expect(planes.avisos).toEqual([]);
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
