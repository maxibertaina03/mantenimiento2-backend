import {
  decidirAsignacion,
  estadoInicial,
  garantiaVencida,
  nombreParaMostrar,
  validarBajaSinTenedor,
  validarCodigoLibre,
  validarEliminable,
} from './equipo-it';

/**
 * Las reglas del inventario de informatica, sin framework y sin base.
 *
 * Todas cuidan lo mismo: que el historial de quien tuvo cada equipo diga la
 * verdad. Corren en milisegundos porque no levantan nada; si alguna vez para
 * probar esto hiciera falta Nest o Prisma, es que una regla se fue de lugar.
 */
describe('con que estado nace un equipo', () => {
  it('a cargo de alguien, en uso', () => {
    expect(estadoInicial(undefined, 'resp-1')).toBe('EN_USO');
  });

  it('sin nadie, en deposito', () => {
    expect(estadoInicial(undefined, null)).toBe('EN_DEPOSITO');
  });

  it('el estado que se pide explicitamente manda', () => {
    expect(estadoInicial('EN_REPARACION', null)).toBe('EN_REPARACION');
  });

  it('REGRESION: no puede nacer dado de baja y a cargo de alguien', () => {
    expect(() => estadoInicial('DADO_DE_BAJA', 'resp-1')).toThrow(/dado de baja/i);
  });
});

describe('la baja', () => {
  it('REGRESION: un equipo dado de baja no puede estar en manos de nadie', () => {
    // Si se permitiera, el historial diria que alguien tiene una maquina que
    // ya no existe.
    expect(() => validarBajaSinTenedor('DADO_DE_BAJA', 'resp-1')).toThrow(/depósito/i);
  });

  it('dado de baja y en deposito, esta bien', () => {
    expect(() => validarBajaSinTenedor('DADO_DE_BAJA', null)).not.toThrow();
  });
});

describe('el codigo interno', () => {
  const OTRO = { id: 'eq-2', nombreParaMostrar: 'Dell Optiplex' };

  it('REGRESION: no se repite, y el mensaje dice cual es el otro', () => {
    // Es la etiqueta fisica pegada en la maquina: dos iguales y no se sabe
    // cual es cual.
    expect(() => validarCodigoLibre('PC12', OTRO)).toThrow(/PC12.*Dell Optiplex/);
  });

  it('al editar, chocar consigo mismo no cuenta', () => {
    expect(() => validarCodigoLibre('PC12', OTRO, 'eq-2')).not.toThrow();
  });

  it('un codigo libre pasa', () => {
    expect(() => validarCodigoLibre('PC12', null)).not.toThrow();
  });
});

describe('cambiar de manos', () => {
  it('entregarlo lo pone en uso', () => {
    expect(decidirAsignacion({ estado: 'EN_DEPOSITO', responsableId: null }, 'r1')).toBe('EN_USO');
  });

  it('devolverlo lo pone en deposito', () => {
    expect(decidirAsignacion({ estado: 'EN_USO', responsableId: 'r1' }, null)).toBe('EN_DEPOSITO');
  });

  it('pasarlo de una persona a otra lo deja en uso', () => {
    expect(decidirAsignacion({ estado: 'EN_USO', responsableId: 'r1' }, 'r2')).toBe('EN_USO');
  });

  it('REGRESION: uno dado de baja no se asigna', () => {
    expect(() => decidirAsignacion({ estado: 'DADO_DE_BAJA', responsableId: null }, 'r1')).toThrow(
      /dado de baja/i,
    );
  });

  it('REGRESION: asignarlo a quien ya lo tiene no es un movimiento', () => {
    // Si se aceptara, el historial sumaria un tramo sin que nada cambie de mano.
    expect(() => decidirAsignacion({ estado: 'EN_USO', responsableId: 'r1' }, 'r1')).toThrow(
      /ya está a cargo/i,
    );
  });

  it('REGRESION: devolver a deposito lo que ya esta en deposito tampoco', () => {
    expect(() => decidirAsignacion({ estado: 'EN_DEPOSITO', responsableId: null }, null)).toThrow(
      /ya está en depósito/i,
    );
  });
});

describe('borrarlo', () => {
  it('REGRESION: uno a cargo de alguien no se borra', () => {
    // Borrarlo se llevaria el historial de quien lo tuvo, que es justo lo que
    // hace falta el dia que el equipo no aparece.
    expect(() => validarEliminable({ estado: 'EN_USO', responsableId: 'r1' })).toThrow(
      /a cargo de alguien/i,
    );
  });

  it('uno en deposito si', () => {
    expect(() => validarEliminable({ estado: 'EN_DEPOSITO', responsableId: null })).not.toThrow();
  });
});

describe('como se nombra y la garantia', () => {
  it('marca y modelo, o un aviso si faltan', () => {
    expect(nombreParaMostrar('Dell', 'Optiplex')).toBe('Dell Optiplex');
    expect(nombreParaMostrar(null, null)).toBe('sin marca cargada');
  });

  it('la garantia vencida se calcula contra hoy', () => {
    const hoy = new Date('2026-09-29T12:00:00Z');
    expect(garantiaVencida(new Date('2020-01-01'), hoy)).toBe(true);
    expect(garantiaVencida(new Date('2030-01-01'), hoy)).toBe(false);
    expect(garantiaVencida(null, hoy)).toBe(false);
  });
});
