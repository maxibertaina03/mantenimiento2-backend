import {
  crearPlan,
  PlanMantenimiento,
  postergarPlan,
  proximaFechaEnCalendario,
  proximaFechaSegunPlan,
} from './plan-mantenimiento';

/**
 * Respetar el calendario y postergar.
 *
 * El caso que lo pidió: un service cada 14 días que tocaba el sábado 10/10 y se
 * hizo el miércoles 14/10. Contando desde que se hizo, el próximo es el 28/10;
 * respetando el calendario, el 24/10.
 */
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const texto = (f: Date) => f.toISOString().slice(0, 10);
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const LUNES_A_VIERNES = [1, 2, 3, 4, 5];
const LUNES_A_SABADO = [1, 2, 3, 4, 5, 6];

const plan = (cambios: Partial<PlanMantenimiento> = {}): PlanMantenimiento => ({
  id: 'p1',
  equipoId: 'tina-2',
  nombre: 'Limpieza de tina',
  tareas: null,
  periodicidadDias: 14,
  diasSemana: LUNES_A_SABADO,
  proximaFecha: dia('2026-10-10'), // sábado
  modoProxima: 'CALENDARIO',
  postergadoDesde: null,
  activo: true,
  ...cambios,
});

describe('el próximo service según el modo del plan', () => {
  it('REGRESION: tocaba el sábado 10/10 y se hizo el 14/10 → respetando el calendario, el 24/10', () => {
    expect(texto(proximaFechaSegunPlan(plan(), dia('2026-10-14')))).toBe('2026-10-24');
  });

  it('el mismo caso contando desde que se hizo da el 28/10, como fue siempre', () => {
    const desdeTrabajo = plan({ modoProxima: 'DESDE_TRABAJO' });
    expect(texto(proximaFechaSegunPlan(desdeTrabajo, dia('2026-10-14')))).toBe('2026-10-28');
  });

  it('si se hizo tan tarde que la fecha siguiente también pasó, salta a la que viene', () => {
    // Hecho el 26/10: el 24/10 ya pasó → 07/11, no nace vencido.
    expect(texto(proximaFechaSegunPlan(plan(), dia('2026-10-26')))).toBe('2026-11-07');
  });

  it('hecho justo en la fecha siguiente, salta a la otra: ese día ya está hecho', () => {
    expect(texto(proximaFechaSegunPlan(plan(), dia('2026-10-24')))).toBe('2026-11-07');
  });

  it('hecho antes de tiempo, sigue el calendario: 24/10', () => {
    expect(texto(proximaFechaSegunPlan(plan(), dia('2026-10-08')))).toBe('2026-10-24');
  });

  it('postergado, el siguiente se cuenta desde la fecha original y no desde la postergada', () => {
    const postergado = plan({
      proximaFecha: dia('2026-10-13'),
      postergadoDesde: dia('2026-10-10'),
    });
    expect(texto(proximaFechaSegunPlan(postergado, dia('2026-10-13'), dia('2026-10-13')))).toBe(
      '2026-10-24',
    );
  });

  it('respeta los días que trabaja la planta: si cae sábado y no se trabaja, el lunes', () => {
    // Cada 7 días desde el viernes 9/10, sin sábados: 16/10, viernes.
    const semanal = plan({
      periodicidadDias: 7,
      diasSemana: LUNES_A_VIERNES,
      proximaFecha: dia('2026-10-09'),
    });
    expect(texto(proximaFechaSegunPlan(semanal, dia('2026-10-12')))).toBe('2026-10-16');
    // Y si la cuenta cae en sábado, pasa al lunes: desde el sábado 10/10, cada 7 → lunes 19/10.
    expect(
      texto(proximaFechaEnCalendario(dia('2026-10-10'), 7, LUNES_A_VIERNES, dia('2026-10-12'))),
    ).toBe('2026-10-19');
  });

  it('un plan diario muy atrasado no prueba fecha por fecha y da la de mañana', () => {
    const inicio = Date.now();
    const proxima = proximaFechaEnCalendario(dia('2025-10-01'), 1, TODOS, dia('2026-10-14'));
    expect(texto(proxima)).toBe('2026-10-15');
    expect(Date.now() - inicio).toBeLessThan(50);
  });

  it('un plan nuevo cuenta desde que se hizo, salvo que se elija otra cosa', () => {
    const datos = {
      equipoId: 'e',
      nombre: 'Aceite',
      periodicidadDias: 90,
      proximaFecha: dia('2026-12-01'),
    };
    expect(crearPlan(datos).modoProxima).toBe('DESDE_TRABAJO');
    expect(crearPlan({ ...datos, modoProxima: 'CALENDARIO' }).modoProxima).toBe('CALENDARIO');
  });
});

describe('postergar el próximo service', () => {
  const HOY = dia('2026-10-09');

  it('se mueve a la fecha nueva y guarda la original', () => {
    const cambios = postergarPlan(plan(), dia('2026-10-13'), HOY);
    expect(texto(cambios.proximaFecha)).toBe('2026-10-13');
    expect(texto(cambios.postergadoDesde!)).toBe('2026-10-10');
  });

  it('postergado dos veces, la original sigue siendo la primera', () => {
    const una = plan({ proximaFecha: dia('2026-10-13'), postergadoDesde: dia('2026-10-10') });
    const cambios = postergarPlan(una, dia('2026-10-15'), HOY);
    expect(texto(cambios.postergadoDesde!)).toBe('2026-10-10');
  });

  it('lo vencido no se posterga', () => {
    expect(() => postergarPlan(plan(), dia('2026-10-13'), dia('2026-10-11'))).toThrow(/ya venció/);
  });

  it('el mismo día del vencimiento todavía se puede postergar', () => {
    expect(() => postergarPlan(plan(), dia('2026-10-13'), dia('2026-10-10'))).not.toThrow();
  });

  it('no puede pasar de la vez siguiente que toca', () => {
    // Original 10/10, cada 14: la siguiente es el 24/10.
    expect(() => postergarPlan(plan(), dia('2026-10-24'), HOY)).toThrow(/24\/10\/2026/);
    expect(() => postergarPlan(plan(), dia('2026-10-23'), HOY)).not.toThrow();
  });

  it('tiene que ser después de la fecha que tenía', () => {
    expect(() => postergarPlan(plan(), dia('2026-10-10'), HOY)).toThrow(/posterior/);
  });

  it('si la nueva cae un día que no se trabaja, pasa al siguiente que sí', () => {
    const semana = plan({ diasSemana: LUNES_A_VIERNES, proximaFecha: dia('2026-10-09') });
    expect(texto(postergarPlan(semana, dia('2026-10-10'), HOY).proximaFecha)).toBe('2026-10-12');
  });

  it('un plan pausado no se posterga', () => {
    expect(() => postergarPlan(plan({ activo: false }), dia('2026-10-13'), HOY)).toThrow(/pausado/);
  });
});
