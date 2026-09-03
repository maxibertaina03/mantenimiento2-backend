import { BadRequestException } from '@nestjs/common';
import { verificarNoQuedaDetrasDeUnAjuste } from './regla-fecha-ajuste';

const f = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('verificarNoQuedaDetrasDeUnAjuste', () => {
  it('sin ajustes previos, cualquier fecha vale', () => {
    // La mayoria de los materiales nunca tuvo un ajuste: la regla no tiene que
    // molestar ahi.
    expect(() => verificarNoQuedaDetrasDeUnAjuste(f('2020-01-01'), null)).not.toThrow();
  });

  it('una fecha posterior al ajuste vale', () => {
    expect(() => verificarNoQuedaDetrasDeUnAjuste(f('2026-09-02'), f('2026-09-01'))).not.toThrow();
  });

  it('el mismo dia del ajuste vale', () => {
    // Empatados en fecha, el orden lo desempata `creadoEn`, y el movimiento
    // nuevo se cargo despues: queda detras del ajuste igual.
    expect(() => verificarNoQuedaDetrasDeUnAjuste(f('2026-09-01'), f('2026-09-01'))).not.toThrow();
  });

  it('REGRESION: una fecha anterior al ajuste se rechaza', () => {
    // Es el caso que dejaba el stock guardado y el recalculo en desacuerdo: el
    // alta restaba la salida (90) y el recalculo por fecha la ignoraba (100),
    // porque el ajuste posterior borra lo anterior. El desacuerdo no se veia
    // hasta que alguien editaba cualquier movimiento del material.
    expect(() => verificarNoQuedaDetrasDeUnAjuste(f('2026-08-15'), f('2026-09-01'))).toThrow(
      BadRequestException,
    );
  });

  it('el mensaje dice las dos fechas y que hacer', () => {
    // Quien lo lee esta cargando un movimiento, no leyendo codigo: si el error
    // no explica el porque, lo unico que puede hacer es probar fechas.
    let mensaje = '';
    try {
      verificarNoQuedaDetrasDeUnAjuste(f('2026-08-15'), f('2026-09-01'), 'Rodamiento 6204');
    } catch (e) {
      mensaje = (e as BadRequestException).message;
    }

    expect(mensaje).toContain('15/8/2026');
    expect(mensaje).toContain('1/9/2026');
    expect(mensaje).toContain('Rodamiento 6204');
    expect(mensaje).toMatch(/fecha posterior/i);
  });

  it('sin nombre de material el mensaje no queda con comillas vacias', () => {
    let mensaje = '';
    try {
      verificarNoQuedaDetrasDeUnAjuste(f('2026-08-15'), f('2026-09-01'));
    } catch (e) {
      mensaje = (e as BadRequestException).message;
    }
    expect(mensaje).not.toContain('""');
  });

  it('un minuto antes del ajuste ya se rechaza', () => {
    // El corte es por instante, no por dia: dos movimientos del mismo dia se
    // ordenan igual entre si y el desacuerdo aparece lo mismo.
    const ajuste = new Date('2026-09-01T12:00:00.000Z');
    const antes = new Date('2026-09-01T11:59:00.000Z');
    expect(() => verificarNoQuedaDetrasDeUnAjuste(antes, ajuste)).toThrow(BadRequestException);
  });
});
