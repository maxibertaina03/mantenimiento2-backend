import { calcularProximaRotacion, diasHasta, estadoDeRotacion } from './rotacion';

const f = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('calcularProximaRotacion', () => {
  it('suma los dias configurados', () => {
    expect(calcularProximaRotacion(f('2026-09-14'), 90)).toEqual(f('2026-12-13'));
  });

  it('cruza el fin de ano sin problema', () => {
    expect(calcularProximaRotacion(f('2026-12-20'), 30)).toEqual(f('2027-01-19'));
  });

  it('sin rotacion configurada no hay proxima fecha', () => {
    // No todo acceso necesita cambiarse cada tanto. Ponerle fecha a todo
    // convierte los avisos en ruido que nadie mira.
    expect(calcularProximaRotacion(f('2026-09-14'), null)).toBeNull();
    expect(calcularProximaRotacion(f('2026-09-14'), undefined)).toBeNull();
    expect(calcularProximaRotacion(f('2026-09-14'), 0)).toBeNull();
  });

  it('un numero negativo no genera una fecha hacia atras', () => {
    expect(calcularProximaRotacion(f('2026-09-14'), -30)).toBeNull();
  });
});

describe('diasHasta', () => {
  it('cuenta los dias que faltan', () => {
    expect(diasHasta(f('2026-09-20'), f('2026-09-14'))).toBe(6);
  });

  it('el mismo dia es cero', () => {
    expect(diasHasta(f('2026-09-14'), f('2026-09-14'))).toBe(0);
  });

  it('lo que ya paso da negativo', () => {
    expect(diasHasta(f('2026-09-10'), f('2026-09-14'))).toBe(-4);
  });

  it('REGRESION: la hora del dia no cambia la cuenta', () => {
    // Sin normalizar a dia completo, vencer hoy a las 23 contra mirar hoy a las
    // 8 daria "falta menos de un dia" y redondearia a cero de casualidad.
    const vence = new Date('2026-09-20T23:59:00.000Z');
    const hoy = new Date('2026-09-14T00:01:00.000Z');
    expect(diasHasta(vence, hoy)).toBe(6);
  });
});

describe('estadoDeRotacion', () => {
  const hoy = f('2026-09-14');

  it('sin fecha, no hay nada que avisar', () => {
    expect(estadoDeRotacion(null, hoy)).toBe('sin-rotacion');
  });

  it('lejos del vencimiento esta al dia', () => {
    expect(estadoDeRotacion(f('2026-12-13'), hoy)).toBe('al-dia');
  });

  it('dentro de la semana previa, avisa', () => {
    expect(estadoDeRotacion(f('2026-09-20'), hoy)).toBe('por-vencer');
  });

  it('REGRESION: el dia exacto del vencimiento todavia esta a tiempo', () => {
    // Decirle "vencida" a quien la mira justo ese dia lo manda a apagar un
    // incendio que no empezo.
    expect(estadoDeRotacion(f('2026-09-14'), hoy)).toBe('por-vencer');
  });

  it('el dia siguiente ya esta vencida', () => {
    expect(estadoDeRotacion(f('2026-09-13'), hoy)).toBe('vencida');
  });

  it('el limite de la semana es exacto', () => {
    // Ocho dias todavia no molesta; siete si.
    expect(estadoDeRotacion(f('2026-09-21'), hoy)).toBe('por-vencer');
    expect(estadoDeRotacion(f('2026-09-22'), hoy)).toBe('al-dia');
  });
});
