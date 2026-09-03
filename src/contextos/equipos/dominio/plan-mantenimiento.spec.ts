import { ErrorDatosInvalidos } from './errores';
import {
  PlanMantenimiento,
  conEstado,
  correspondeAvisar,
  crearPlan,
  diasEntre,
  diasParaVencer,
  estadoPlan,
  ordenarPorUrgencia,
  proximaFechaDespuesDe,
} from './plan-mantenimiento';

/**
 * Planes de mantenimiento: cada cuánto va cada trabajo y cuándo toca el próximo.
 *
 * Todo se prueba con fechas fijas. Nada de esto le pregunta la hora al sistema,
 * que es lo que hace posible verificar los bordes exactos.
 */
const HOY = new Date('2026-09-02T12:00:00.000Z');
const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('diasEntre', () => {
  it('REGRESION: cuenta por dia de calendario, no por horas', () => {
    // Un service "hoy a las 8" y otro "hoy a las 18" son los dos hoy.
    const manana = new Date('2026-09-02T08:00:00.000Z');
    const tarde = new Date('2026-09-02T18:00:00.000Z');
    expect(diasEntre(manana, tarde)).toBe(0);
  });

  it('cuenta los dias hacia adelante y hacia atras', () => {
    expect(diasEntre(fecha('2026-09-02'), fecha('2026-09-09'))).toBe(7);
    expect(diasEntre(fecha('2026-09-09'), fecha('2026-09-02'))).toBe(-7);
  });

  it('cruza el fin de mes sin errores', () => {
    expect(diasEntre(fecha('2026-08-30'), fecha('2026-09-02'))).toBe(3);
  });
});

describe('estadoPlan', () => {
  it('lo que falta mucho esta al dia', () => {
    expect(estadoPlan(fecha('2026-12-01'), HOY)).toBe('AL_DIA');
  });

  it('dentro de los siete dias esta por vencer', () => {
    expect(estadoPlan(fecha('2026-09-06'), HOY)).toBe('POR_VENCER');
  });

  it('REGRESION: el dia exacto del vencimiento todavia NO esta vencido', () => {
    // Si toca hoy y se hace hoy, se hizo en fecha.
    expect(estadoPlan(fecha('2026-09-02'), HOY)).toBe('POR_VENCER');
  });

  it('el dia anterior si esta vencido', () => {
    expect(estadoPlan(fecha('2026-09-01'), HOY)).toBe('VENCIDO');
  });

  it('el borde de los siete dias entra como por vencer', () => {
    expect(estadoPlan(fecha('2026-09-09'), HOY)).toBe('POR_VENCER');
    expect(estadoPlan(fecha('2026-09-10'), HOY)).toBe('AL_DIA');
  });
});

describe('proximaFechaDespuesDe', () => {
  it('cuenta desde el dia en que se hizo el trabajo', () => {
    expect(proximaFechaDespuesDe(fecha('2026-09-01'), 90).toISOString().slice(0, 10)).toBe(
      '2026-11-30',
    );
  });

  it('REGRESION: se cuenta desde lo real, no desde lo planificado', () => {
    // Un service que tocaba en marzo y se hizo en mayo: el siguiente va a los
    // 90 dias de mayo. Contarlo desde marzo lo dejaria vencido al registrarlo.
    const proxima = proximaFechaDespuesDe(fecha('2026-05-15'), 90);
    expect(proxima.toISOString().slice(0, 10)).toBe('2026-08-13');
    expect(estadoPlan(proxima, fecha('2026-05-15'))).toBe('AL_DIA');
  });

  it('cruza el cambio de año', () => {
    expect(proximaFechaDespuesDe(fecha('2026-12-15'), 30).toISOString().slice(0, 10)).toBe(
      '2027-01-14',
    );
  });
});

describe('crearPlan', () => {
  const base = {
    equipoId: 'eq-1',
    nombre: 'Cambio de aceite',
    periodicidadDias: 90,
    proximaFecha: fecha('2026-12-01'),
  };

  it('crea el plan activo y con el nombre normalizado', () => {
    const p = crearPlan({ ...base, nombre: '  Cambio   de aceite ' });
    expect(p.nombre).toBe('Cambio de aceite');
    expect(p.activo).toBe(true);
  });

  it('sin nombre no hay plan, y el error sugiere uno', () => {
    expect(() => crearPlan({ ...base, nombre: '  ' })).toThrow(/Cambio de aceite/);
  });

  it('REGRESION: la periodicidad tiene que ser de al menos un dia', () => {
    // Con 0 la proxima fecha nunca avanzaria y el plan quedaria vencido para
    // siempre, avisando todos los dias.
    for (const dias of [0, -5]) {
      expect(() => crearPlan({ ...base, periodicidadDias: dias })).toThrow(ErrorDatosInvalidos);
    }
  });

  it('rechaza una periodicidad con decimales', () => {
    expect(() => crearPlan({ ...base, periodicidadDias: 30.5 })).toThrow(
      /dias enteros|días enteros/i,
    );
  });

  it('rechaza una periodicidad desmedida, por si se cargo mal', () => {
    expect(() => crearPlan({ ...base, periodicidadDias: 99999 })).toThrow(/diez años/i);
  });

  it('las tareas vacias quedan en null, no en cadena vacia', () => {
    expect(crearPlan({ ...base, tareas: '   ' }).tareas).toBeNull();
  });
});

describe('correspondeAvisar', () => {
  const plan = (over: Partial<PlanMantenimiento> = {}): PlanMantenimiento => ({
    id: 'p1',
    equipoId: 'eq-1',
    nombre: 'Cambio de aceite',
    tareas: null,
    periodicidadDias: 90,
    proximaFecha: fecha('2026-09-06'),
    activo: true,
    ...over,
  });

  it('avisa lo que vence dentro de la semana', () => {
    expect(correspondeAvisar(plan(), 'OPERATIVO', HOY)).toBe(true);
  });

  it('REGRESION: sigue avisando lo ya vencido', () => {
    // Si nadie lo hizo, dejar de avisar seria justo lo contrario de lo que se
    // necesita.
    expect(correspondeAvisar(plan({ proximaFecha: fecha('2026-08-01') }), 'OPERATIVO', HOY)).toBe(
      true,
    );
  });

  it('no avisa lo que falta mucho', () => {
    expect(correspondeAvisar(plan({ proximaFecha: fecha('2026-12-01') }), 'OPERATIVO', HOY)).toBe(
      false,
    );
  });

  it('un plan desactivado no avisa', () => {
    expect(correspondeAvisar(plan({ activo: false }), 'OPERATIVO', HOY)).toBe(false);
  });

  it('REGRESION: un equipo desafectado no genera avisos', () => {
    // No tiene sentido pedir un service para algo fuera de servicio o de baja.
    expect(correspondeAvisar(plan(), 'FUERA_DE_SERVICIO', HOY)).toBe(false);
    expect(correspondeAvisar(plan(), 'DADO_DE_BAJA', HOY)).toBe(false);
  });

  it('un equipo en reparacion si avisa', () => {
    expect(correspondeAvisar(plan(), 'EN_REPARACION', HOY)).toBe(true);
  });
});

describe('ordenarPorUrgencia', () => {
  it('primero lo mas vencido, despues lo que esta por vencer', () => {
    const planes = [
      conEstado(
        {
          id: 'a',
          equipoId: 'e',
          nombre: 'A',
          tareas: null,
          periodicidadDias: 30,
          proximaFecha: fecha('2026-09-20'),
          activo: true,
        },
        HOY,
      ),
      conEstado(
        {
          id: 'b',
          equipoId: 'e',
          nombre: 'B',
          tareas: null,
          periodicidadDias: 30,
          proximaFecha: fecha('2026-08-01'),
          activo: true,
        },
        HOY,
      ),
      conEstado(
        {
          id: 'c',
          equipoId: 'e',
          nombre: 'C',
          tareas: null,
          periodicidadDias: 30,
          proximaFecha: fecha('2026-09-03'),
          activo: true,
        },
        HOY,
      ),
    ];

    expect(ordenarPorUrgencia(planes).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('no modifica el arreglo original', () => {
    const uno = conEstado(
      {
        id: 'a',
        equipoId: 'e',
        nombre: 'A',
        tareas: null,
        periodicidadDias: 30,
        proximaFecha: fecha('2026-09-20'),
        activo: true,
      },
      HOY,
    );
    const original = [uno];
    ordenarPorUrgencia(original);
    expect(original).toHaveLength(1);
  });
});

describe('diasParaVencer', () => {
  it('positivo si falta, negativo si vencio', () => {
    expect(diasParaVencer(fecha('2026-09-09'), HOY)).toBe(7);
    expect(diasParaVencer(fecha('2026-08-26'), HOY)).toBe(-7);
  });
});
