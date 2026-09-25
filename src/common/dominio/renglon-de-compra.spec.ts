import { claseDelRenglon, unidadesDeEquipo } from './renglon-de-compra';

/**
 * Que se compra en cada renglon de una orden.
 *
 * Un renglon es de un MATERIAL del paniol —que lleva stock— o de un EQUIPO
 * —que lleva ficha propia—, nunca de los dos. No es una formalidad: al recibir
 * la mercaderia son dos caminos distintos, y un renglon que fuera las dos
 * cosas sumaria stock Y daria de alta una ficha por la misma compra.
 */
describe('de que es un renglon', () => {
  it('con material, es de material', () => {
    expect(claseDelRenglon({ materialId: 'mat-1', cantidad: 10 })).toBe('material');
  });

  it('con descripcion de equipo, es de equipo', () => {
    expect(claseDelRenglon({ descripcionEquipo: 'Amoladora', cantidad: 2 })).toBe('equipo');
  });

  it('REGRESION: no puede ser de los dos', () => {
    expect(() =>
      claseDelRenglon({ materialId: 'mat-1', descripcionEquipo: 'Amoladora', cantidad: 1 }),
    ).toThrow(/no de los dos/i);
  });

  it('REGRESION: tampoco puede no ser de ninguno', () => {
    // Un renglon vacio pasaba la validacion del DTO y reventaba recien al
    // recibir, cuando ya no se puede deshacer nada.
    expect(() => claseDelRenglon({ cantidad: 1 })).toThrow(/tiene que decir qué se compra/i);
  });
});

describe('cuantas fichas genera un renglon de equipo', () => {
  it('una por unidad comprada', () => {
    // Cinco amoladoras son cinco fichas, cada una con su numero de serie.
    expect(unidadesDeEquipo({ descripcionEquipo: 'Amoladora', cantidad: 5 })).toBe(5);
  });

  it('un renglon de material no genera ninguna', () => {
    expect(unidadesDeEquipo({ materialId: 'mat-1', cantidad: 100 })).toBe(0);
  });

  it('REGRESION: media amoladora no existe', () => {
    // Los materiales se compran con decimales (2,5 kg); los equipos no. Sin
    // esta regla, 2,5 amoladoras daba dos fichas y media unidad perdida.
    expect(() => unidadesDeEquipo({ descripcionEquipo: 'Amoladora', cantidad: 2.5 })).toThrow(
      /unidades enteras/i,
    );
  });

  it('REGRESION: cero unidades tampoco', () => {
    expect(() => unidadesDeEquipo({ descripcionEquipo: 'Amoladora', cantidad: 0 })).toThrow(
      /unidades enteras/i,
    );
  });
});
