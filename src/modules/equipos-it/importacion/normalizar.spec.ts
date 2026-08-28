import { EstadoEquipoIT, TipoEquipoIT } from '@prisma/client';
import {
  MARCA_POR_DEFECTO,
  normalizarEstado,
  normalizarIdAccesoRemoto,
  normalizarNombrePersona,
  normalizarTexto,
  normalizarTipo,
  separarMarcaYModelo,
} from './normalizar';

/**
 * Los casos salen del inventario real que se va a importar (planilla de Notion),
 * no de ejemplos inventados: si el mapeo falla con esos datos, la importación
 * mete basura en el sistema.
 */

describe('normalizarTexto', () => {
  it('saca acentos, espacios de más y mayúsculas', () => {
    expect(normalizarTexto('  Cámara   de  Seguridad ')).toBe('camara de seguridad');
    expect(normalizarTexto('Teléfonos')).toBe('telefonos');
    expect(normalizarTexto('En reparación')).toBe('en reparacion');
  });
});

describe('normalizarTipo', () => {
  it.each([
    ['PC Escritorio', TipoEquipoIT.PC],
    ['Notebook', TipoEquipoIT.NOTEBOOK],
    ['Servidor', TipoEquipoIT.SERVIDOR],
    ['Impresora', TipoEquipoIT.IMPRESORA],
    ['Cámara de Seguridad', TipoEquipoIT.CAMARA_SEGURIDAD],
    ['Router/Switch', TipoEquipoIT.EQUIPO_RED],
    ['Teléfonos', TipoEquipoIT.CELULAR],
    ['ISP', TipoEquipoIT.OTRO],
    ['Cargadores Teléfonos', TipoEquipoIT.OTRO],
  ])('mapea "%s"', (entrada, esperado) => {
    expect(normalizarTipo(entrada)).toBe(esperado);
  });

  it('no distingue mayúsculas ni acentos', () => {
    expect(normalizarTipo('CAMARA DE SEGURIDAD')).toBe(TipoEquipoIT.CAMARA_SEGURIDAD);
    expect(normalizarTipo('pc escritorio')).toBe(TipoEquipoIT.PC);
  });

  it('reconoce el tipo aunque la celda traiga texto de más', () => {
    expect(normalizarTipo('Cargadores Teléfonos Only Turbo')).toBe(TipoEquipoIT.OTRO);
  });

  it('devuelve null si no reconoce el tipo (la fila se marca con error)', () => {
    expect(normalizarTipo('Cafetera')).toBeNull();
    expect(normalizarTipo('')).toBeNull();
    expect(normalizarTipo(undefined)).toBeNull();
  });
});

describe('normalizarEstado', () => {
  it.each([
    ['En uso', EstadoEquipoIT.EN_USO],
    ['Activo', EstadoEquipoIT.EN_USO],
    ['Disponible', EstadoEquipoIT.EN_DEPOSITO],
    ['En reparación', EstadoEquipoIT.EN_REPARACION],
    ['Dado de baja', EstadoEquipoIT.DADO_DE_BAJA],
  ])('mapea "%s"', (entrada, esperado) => {
    expect(normalizarEstado(entrada)).toBe(esperado);
  });

  it('sin dato asume EN_DEPOSITO, no EN_USO', () => {
    // Decir que un equipo está en uso sin saberlo es peor que decir que está
    // guardado: lo segundo se corrige mirando, lo primero pasa desapercibido.
    expect(normalizarEstado(undefined)).toBe(EstadoEquipoIT.EN_DEPOSITO);
    expect(normalizarEstado('')).toBe(EstadoEquipoIT.EN_DEPOSITO);
    expect(normalizarEstado('cualquier cosa')).toBe(EstadoEquipoIT.EN_DEPOSITO);
  });
});

describe('separarMarcaYModelo', () => {
  it('un valor que es solo la marca deja el modelo vacío', () => {
    expect(separarMarcaYModelo('INTEL')).toEqual({ marca: 'Intel', modelo: '', dudoso: false });
    expect(separarMarcaYModelo('HP')).toEqual({ marca: 'HP', modelo: '', dudoso: false });
    expect(separarMarcaYModelo('Lenovo')).toEqual({ marca: 'Lenovo', modelo: '', dudoso: false });
  });

  it('separa marca y modelo cuando vienen juntos', () => {
    expect(separarMarcaYModelo('HP LaserJet MFP M141w')).toEqual({
      marca: 'HP',
      modelo: 'LaserJet MFP M141w',
      dudoso: false,
    });
    expect(separarMarcaYModelo('Samsung Galaxy A03 Core')).toEqual({
      marca: 'Samsung',
      modelo: 'Galaxy A03 Core',
      dudoso: false,
    });
  });

  it('prefiere la marca más larga (TP-Link no queda tapada)', () => {
    expect(separarMarcaYModelo('TP-Link Tapo C100').marca).toBe('TP-Link');
  });

  it('REGRESION: lo que no reconoce se conserva entero y se marca dudoso', () => {
    // Perder el dato sería peor que pedir una revisión manual.
    const r = separarMarcaYModelo('DS-7616NI-E2 / 16P');
    expect(r.modelo).toBe('DS-7616NI-E2 / 16P');
    expect(r.marca).toBe(MARCA_POR_DEFECTO);
    expect(r.dudoso).toBe(true);
  });

  it('una celda vacía queda dudosa pero no rompe', () => {
    expect(separarMarcaYModelo('')).toEqual({
      marca: MARCA_POR_DEFECTO,
      modelo: '',
      dudoso: true,
    });
    expect(separarMarcaYModelo(undefined).dudoso).toBe(true);
  });

  it('normaliza los espacios de más', () => {
    expect(separarMarcaYModelo('HP   LaserJet   P1102w').modelo).toBe('LaserJet P1102w');
  });
});

describe('normalizarIdAccesoRemoto', () => {
  it('saca los espacios de los IDs de AnyDesk', () => {
    expect(normalizarIdAccesoRemoto('737 214 468')).toBe('737214468');
    expect(normalizarIdAccesoRemoto('1 421 723 081')).toBe('1421723081');
  });

  it('deja pasar los que ya vienen sin separadores', () => {
    expect(normalizarIdAccesoRemoto('1618629 31')).toBe('161862931');
  });

  it('sin ID devuelve undefined', () => {
    expect(normalizarIdAccesoRemoto('')).toBeUndefined();
    expect(normalizarIdAccesoRemoto(undefined)).toBeUndefined();
    expect(normalizarIdAccesoRemoto('   ')).toBeUndefined();
  });
});

describe('normalizarNombrePersona', () => {
  it('limpia el nombre', () => {
    expect(normalizarNombrePersona('  Luis   Rodriguez ')).toBe('Luis Rodriguez');
    expect(normalizarNombrePersona('Máximo Bertaina')).toBe('Máximo Bertaina');
  });

  it('REGRESION: los destinos colectivos no son personas', () => {
    // "Uso compartido" no es alguien a quien asignarle un equipo; crear un
    // usuario con ese nombre ensuciaría el padrón.
    expect(normalizarNombrePersona('Uso compartido')).toBeNull();
    expect(normalizarNombrePersona('No tiene todavia')).toBeNull();
    expect(normalizarNombrePersona('')).toBeNull();
    expect(normalizarNombrePersona(undefined)).toBeNull();
  });
});
