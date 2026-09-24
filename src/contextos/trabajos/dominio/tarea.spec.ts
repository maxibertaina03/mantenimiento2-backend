import { ErrorDatosInvalidos, ErrorNoEsSuyo, ErrorTransicionInvalida } from './errores';
import {
  asignarTarea,
  cancelarTarea,
  completarTarea,
  crearRutina,
  crearTarea,
  ocurrenciasDeRutina,
  Rutina,
  soloElDia,
  Tarea,
  validarQuePuedeCompletarla,
} from './tarea';

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const tarea = (cambios: Partial<Tarea> = {}): Tarea => ({
  id: 't-1',
  titulo: 'Revisar presion de caldera',
  descripcion: null,
  fecha: dia('2026-09-25'),
  estado: 'PENDIENTE',
  asignadoAId: 'u1',
  equipoId: null,
  equipoItId: null,
  planId: null,
  rutinaId: null,
  ordenTrabajoId: null,
  creadaPorId: 'u1',
  creadoEn: dia('2026-09-22'),
  ...cambios,
});

const rutina = (cambios: Partial<Rutina> = {}): Rutina => ({
  id: 'r-1',
  titulo: 'Revisar presion',
  descripcion: null,
  cadaDias: 1,
  desde: dia('2026-09-01'),
  hasta: null,
  equipoId: null,
  equipoItId: null,
  asignadoAId: null,
  activa: true,
  creadaPorId: 'u1',
  creadoEn: dia('2026-09-01'),
  ...cambios,
});

describe('crearTarea', () => {
  it('nace pendiente y en el dia que se le puso', () => {
    const nueva = crearTarea({ titulo: 'Cambiar filtro', fecha: dia('2026-10-05') });

    expect(nueva.estado).toBe('PENDIENTE');
    expect(nueva.fecha).toEqual(dia('2026-10-05'));
  });

  it('REGRESION: una tarea SI puede ser futura', () => {
    // Al reves que una orden de trabajo. Es justamente lo que todavia no se
    // hizo: un calendario que solo admite el pasado no es un calendario.
    expect(() =>
      crearTarea({ titulo: 'Service de enero', fecha: dia('2027-01-15') }),
    ).not.toThrow();
  });

  it('exige decir que hay que hacer', () => {
    expect(() => crearTarea({ titulo: '  ', fecha: dia('2026-10-05') })).toThrow(
      ErrorDatosInvalidos,
    );
  });

  it('la que genera un plan nace sin duenio', () => {
    // El sistema sabe que hay que hacer un service, no sabe a quien le toca.
    const nueva = crearTarea({ titulo: 'Service', fecha: dia('2026-10-05'), planId: 'plan-1' });
    expect(nueva.asignadoAId).toBeNull();
  });

  it('la hora se descarta: dos tareas del mismo dia son del mismo dia', () => {
    const nueva = crearTarea({
      titulo: 'Algo',
      fecha: new Date('2026-10-05T17:43:21.000Z'),
    });
    expect(nueva.fecha).toEqual(dia('2026-10-05'));
  });
});

describe('quien puede darla por hecha', () => {
  it('el que la tiene asignada', () => {
    expect(() => validarQuePuedeCompletarla(tarea({ asignadoAId: 'u1' }), 'u1')).not.toThrow();
  });

  it('cualquiera, si no tiene duenio', () => {
    // Las que genera un plan nacen sin repartir: el primero que la agarra la
    // hace, y al completarla queda a su nombre.
    expect(() => validarQuePuedeCompletarla(tarea({ asignadoAId: null }), 'u2')).not.toThrow();
  });

  it('REGRESION: la de otro, no', () => {
    // Si dos personas pueden cerrar la misma tarea, el reparto deja de
    // significar algo.
    expect(() => validarQuePuedeCompletarla(tarea({ asignadoAId: 'u1' }), 'u2')).toThrow(
      ErrorNoEsSuyo,
    );
  });

  it('sin saber quien es, tampoco', () => {
    expect(() => validarQuePuedeCompletarla(tarea(), null)).toThrow(ErrorNoEsSuyo);
  });
});

describe('completarTarea', () => {
  it('queda hecha y atada a la orden de trabajo que salio', () => {
    const cambios = completarTarea(tarea(), 'u1', 'ot-9');

    expect(cambios.estado).toBe('HECHA');
    expect(cambios.ordenTrabajoId).toBe('ot-9');
  });

  it('una sin duenio queda a nombre del que la hizo', () => {
    // Si no quedara registrado, el historial diria que nadie la hizo.
    const cambios = completarTarea(tarea({ asignadoAId: null }), 'u2', 'ot-9');
    expect(cambios.asignadoAId).toBe('u2');
  });

  it.each(['HECHA', 'CANCELADA'] as const)('una tarea %s no se vuelve a completar', (estado) => {
    expect(() => completarTarea(tarea({ estado }), 'u1', 'ot-9')).toThrow(ErrorTransicionInvalida);
  });
});

describe('asignar y cancelar', () => {
  it('reasignar cambia el duenio', () => {
    expect(asignarTarea(tarea(), 'u2')).toEqual({ asignadoAId: 'u2' });
  });

  it('una tarea hecha ya no se reasigna', () => {
    expect(() => asignarTarea(tarea({ estado: 'HECHA' }), 'u2')).toThrow(ErrorTransicionInvalida);
  });

  it('cancelar la saca del calendario sin borrarla', () => {
    expect(cancelarTarea(tarea())).toEqual({ estado: 'CANCELADA' });
  });
});

describe('crearRutina', () => {
  it('todos los dias es cada 1', () => {
    const nueva = crearRutina({ titulo: 'Revisar caldera', cadaDias: 1, desde: dia('2026-09-01') });
    expect(nueva.cadaDias).toBe(1);
    expect(nueva.activa).toBe(true);
  });

  it.each([0, -3, 1.5])('rechaza repetir cada %p dias', (cadaDias) => {
    expect(() => crearRutina({ titulo: 'Algo', cadaDias, desde: dia('2026-09-01') })).toThrow(
      ErrorDatosInvalidos,
    );
  });

  it('REGRESION: la fecha de fin no puede ser anterior a la de inicio', () => {
    // Una rutina asi no genera nada y nadie entiende por que.
    expect(() =>
      crearRutina({
        titulo: 'Algo',
        cadaDias: 1,
        desde: dia('2026-09-10'),
        hasta: dia('2026-09-01'),
      }),
    ).toThrow(ErrorDatosInvalidos);
  });
});

describe('ocurrenciasDeRutina', () => {
  it('todos los dias da un dia por dia', () => {
    const fechas = ocurrenciasDeRutina(rutina(), dia('2026-09-10'), dia('2026-09-13'));

    expect(fechas).toEqual([
      dia('2026-09-10'),
      dia('2026-09-11'),
      dia('2026-09-12'),
      dia('2026-09-13'),
    ]);
  });

  it('cada 15 dias cuenta dias, no meses', () => {
    // Sumar meses haria que "cada 15 dias" signifique cosas distintas en
    // febrero y en marzo.
    const fechas = ocurrenciasDeRutina(
      rutina({ cadaDias: 15, desde: dia('2026-01-01') }),
      dia('2026-01-01'),
      dia('2026-02-15'),
    );

    expect(fechas).toEqual([
      dia('2026-01-01'),
      dia('2026-01-16'),
      dia('2026-01-31'),
      dia('2026-02-15'),
    ]);
  });

  it('REGRESION: no genera nada antes de la fecha de inicio', () => {
    const fechas = ocurrenciasDeRutina(
      rutina({ desde: dia('2026-09-20') }),
      dia('2026-09-10'),
      dia('2026-09-22'),
    );
    expect(fechas).toEqual([dia('2026-09-20'), dia('2026-09-21'), dia('2026-09-22')]);
  });

  it('REGRESION: no genera nada despues de la fecha de fin', () => {
    const fechas = ocurrenciasDeRutina(
      rutina({ desde: dia('2026-09-01'), hasta: dia('2026-09-03') }),
      dia('2026-09-01'),
      dia('2026-09-30'),
    );
    expect(fechas).toEqual([dia('2026-09-01'), dia('2026-09-02'), dia('2026-09-03')]);
  });

  it('una rutina apagada no genera nada', () => {
    expect(
      ocurrenciasDeRutina(rutina({ activa: false }), dia('2026-09-01'), dia('2026-09-30')),
    ).toEqual([]);
  });

  it('un rango al reves no genera nada, en vez de colgarse', () => {
    expect(ocurrenciasDeRutina(rutina(), dia('2026-09-30'), dia('2026-09-01'))).toEqual([]);
  });

  it('el rango que empieza entre dos repeticiones arranca en la siguiente', () => {
    const fechas = ocurrenciasDeRutina(
      rutina({ cadaDias: 7, desde: dia('2026-09-01') }),
      dia('2026-09-10'),
      dia('2026-09-20'),
    );
    expect(fechas).toEqual([dia('2026-09-15')]);
  });
});

describe('soloElDia', () => {
  it('descarta la hora', () => {
    expect(soloElDia(new Date('2026-09-22T23:59:59.000Z'))).toEqual(dia('2026-09-22'));
  });
});
