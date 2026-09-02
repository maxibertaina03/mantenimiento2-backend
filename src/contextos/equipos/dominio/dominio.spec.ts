import { crearEquipo, garantiaVencida, normalizarCodigoInterno, normalizarTexto } from './equipo';
import {
  ETIQUETA_ESTADO,
  puedeTransicionar,
  requiereMantenimiento,
  transicionar,
} from './estado-equipo';
import { ErrorDatosInvalidos, ErrorTransicionInvalida } from './errores';

/**
 * Tests del dominio de Equipos.
 *
 * No montan Nest ni tocan la base: el dominio no importa Prisma, así que estas
 * reglas se prueban en milisegundos. Es la razón principal por la que el
 * contexto está separado en capas.
 */
describe('normalizarTexto', () => {
  it('REGRESION: vacio y solo espacios dan lo mismo — null', () => {
    // Si uno queda "" y otro null, cada consulta tiene que preguntar por los
    // dos, y tarde o temprano alguien se olvida de uno.
    expect(normalizarTexto('')).toBeNull();
    expect(normalizarTexto('   ')).toBeNull();
    expect(normalizarTexto(null)).toBeNull();
    expect(normalizarTexto(undefined)).toBeNull();
  });

  it('recorta y colapsa los espacios de adentro', () => {
    expect(normalizarTexto('  Bomba   caldera  1 ')).toBe('Bomba caldera 1');
  });
});

describe('normalizarCodigoInterno', () => {
  it('REGRESION: el codigo es un identificador, va en mayusculas', () => {
    // "comp-01" y "COMP-01" son el mismo equipo; sin normalizar entran como dos.
    expect(normalizarCodigoInterno('comp-01')).toBe('COMP-01');
    expect(normalizarCodigoInterno(' Comp-01 ')).toBe('COMP-01');
  });

  it('sin codigo devuelve null, no una cadena vacia', () => {
    expect(normalizarCodigoInterno('  ')).toBeNull();
  });
});

describe('crearEquipo', () => {
  it('un equipo nuevo arranca operativo', () => {
    const equipo = crearEquipo({ nombre: 'Compresor 1' });
    expect(equipo.estado).toBe('OPERATIVO');
  });

  it('normaliza todos los textos de una', () => {
    const equipo = crearEquipo({
      nombre: '  Bomba   caldera 1 ',
      marca: '  Grundfos ',
      modelo: '   ',
      codigoInterno: 'bc-01',
    });
    expect(equipo.nombre).toBe('Bomba caldera 1');
    expect(equipo.marca).toBe('Grundfos');
    expect(equipo.modelo).toBeNull();
    expect(equipo.codigoInterno).toBe('BC-01');
  });

  it('sin nombre no hay equipo', () => {
    expect(() => crearEquipo({ nombre: '   ' })).toThrow(ErrorDatosInvalidos);
  });

  it('rechaza un nombre desmedido', () => {
    expect(() => crearEquipo({ nombre: 'x'.repeat(121) })).toThrow(/120 caracteres/);
  });

  it('REGRESION: las horas de uso no pueden ser negativas', () => {
    // Es un contador acumulado: un negativo rompe el calculo del proximo
    // service por horas antes de que nadie lo note.
    expect(() => crearEquipo({ nombre: 'Compresor', horasUso: -1 })).toThrow(ErrorDatosInvalidos);
  });

  it('horas de uso en 0 es valido', () => {
    expect(crearEquipo({ nombre: 'Compresor', horasUso: 0 }).horasUso).toBe(0);
  });

  it('no inventa un id: eso lo pone quien persiste', () => {
    expect(crearEquipo({ nombre: 'Compresor' })).not.toHaveProperty('id');
  });
});

describe('transicionar', () => {
  it('de operativo se puede ir a reparacion', () => {
    expect(transicionar('OPERATIVO', 'EN_REPARACION')).toBe('EN_REPARACION');
  });

  it('de reparacion se vuelve a operativo', () => {
    expect(transicionar('EN_REPARACION', 'OPERATIVO')).toBe('OPERATIVO');
  });

  it('quedarse en el mismo estado no falla', () => {
    // Guardar la ficha sin tocar el estado no deberia romper solo porque el
    // campo viene igual que estaba.
    expect(transicionar('OPERATIVO', 'OPERATIVO')).toBe('OPERATIVO');
    expect(transicionar('DADO_DE_BAJA', 'DADO_DE_BAJA')).toBe('DADO_DE_BAJA');
  });

  it('REGRESION: dado de baja es terminal', () => {
    // Un equipo desguazado o vendido no vuelve. Si alguien se equivoco al darlo
    // de baja, corresponde revisarlo, no deshacerlo en silencio.
    for (const destino of ['OPERATIVO', 'EN_REPARACION', 'FUERA_DE_SERVICIO'] as const) {
      expect(() => transicionar('DADO_DE_BAJA', destino)).toThrow(ErrorTransicionInvalida);
    }
  });

  it('el error explica que se puede hacer, no solo que fallo', () => {
    expect(() => transicionar('DADO_DE_BAJA', 'OPERATIVO')).toThrow(/no vuelve/i);
    expect(() => transicionar('OPERATIVO', 'OPERATIVO' as never)).not.toThrow();
  });

  it('el mensaje usa las etiquetas legibles, no los codigos', () => {
    // Quien lee el error es una persona, no el sistema.
    try {
      transicionar('DADO_DE_BAJA', 'EN_REPARACION');
      fail('deberia haber lanzado');
    } catch (e) {
      expect((e as Error).message).toContain(ETIQUETA_ESTADO.EN_REPARACION);
      expect((e as Error).message).not.toContain('EN_REPARACION');
    }
  });

  it('cualquier estado puede darse de baja', () => {
    for (const desde of ['OPERATIVO', 'EN_REPARACION', 'FUERA_DE_SERVICIO'] as const) {
      expect(puedeTransicionar(desde, 'DADO_DE_BAJA')).toBe(true);
    }
  });
});

describe('requiereMantenimiento', () => {
  it('REGRESION: un equipo desafectado no genera avisos', () => {
    // No tiene sentido avisar que hay que hacerle un service a algo que esta
    // fuera de servicio o dado de baja.
    expect(requiereMantenimiento('FUERA_DE_SERVICIO')).toBe(false);
    expect(requiereMantenimiento('DADO_DE_BAJA')).toBe(false);
  });

  it('operativo y en reparacion si', () => {
    expect(requiereMantenimiento('OPERATIVO')).toBe(true);
    expect(requiereMantenimiento('EN_REPARACION')).toBe(true);
  });
});

describe('garantiaVencida', () => {
  const hoy = new Date('2026-09-01T10:00:00.000Z');

  it('sin garantia cargada, nunca esta vencida', () => {
    expect(garantiaVencida(null, hoy)).toBe(false);
  });

  it('una fecha pasada esta vencida', () => {
    expect(garantiaVencida(new Date('2026-08-31T00:00:00.000Z'), hoy)).toBe(true);
  });

  it('una fecha futura no', () => {
    expect(garantiaVencida(new Date('2026-09-30T00:00:00.000Z'), hoy)).toBe(false);
  });

  it('REGRESION: el mismo dia todavia esta en garantia', () => {
    // El ultimo dia de garantia cuenta como cubierto: reclamar ese dia tiene
    // que funcionar.
    expect(garantiaVencida(new Date('2026-09-01T23:59:59.000Z'), hoy)).toBe(false);
  });

  it('no le pregunta la fecha al sistema: la recibe', () => {
    // Si usara new Date() adentro, este test dependeria de cuando corre.
    const futuro = new Date('2030-01-01T00:00:00.000Z');
    expect(garantiaVencida(new Date('2027-01-01T00:00:00.000Z'), futuro)).toBe(true);
  });
});
