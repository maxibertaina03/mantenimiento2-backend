import { ErrorDatosInvalidos } from './errores';
import { Intervencion, crearIntervencion, resumirMantenimiento } from './intervencion';

/**
 * Reglas del historial de intervenciones.
 *
 * Sin base de datos ni Nest: son funciones puras sobre datos.
 */
const HOY = new Date('2026-09-02T12:00:00.000Z');

const base = {
  equipoId: 'eq-1',
  tipo: 'CORRECTIVO' as const,
  fecha: new Date('2026-09-01T00:00:00.000Z'),
  ejecutor: 'INTERNO' as const,
  usuarioId: 'us-1',
  descripcion: 'Se cambió la correa',
};

describe('crearIntervencion', () => {
  it('arma la intervencion con los datos normalizados', () => {
    const i = crearIntervencion(
      { ...base, descripcion: '  Se cambió   la correa ' },
      'OPERATIVO',
      HOY,
    );
    expect(i.descripcion).toBe('Se cambió la correa');
    expect(i.tipo).toBe('CORRECTIVO');
  });

  it('REGRESION: un equipo dado de baja no recibe intervenciones', () => {
    // Casi siempre es que se eligió el equipo equivocado de la lista, y el
    // mensaje lo dice para que la persona sepa qué revisar.
    expect(() => crearIntervencion(base, 'DADO_DE_BAJA', HOY)).toThrow(/equivocaste de equipo/i);
  });

  it('un equipo en reparacion si las recibe', () => {
    // Es justamente cuando más se le hacen.
    expect(() => crearIntervencion(base, 'EN_REPARACION', HOY)).not.toThrow();
  });

  it('REGRESION: exige contar que se hizo', () => {
    // Un historial de fechas sin decir que se hizo no sirve para nada.
    expect(() => crearIntervencion({ ...base, descripcion: '   ' }, 'OPERATIVO', HOY)).toThrow(
      ErrorDatosInvalidos,
    );
  });

  it('REGRESION: no se puede registrar en el futuro', () => {
    // Aca se registra lo que ya paso; lo planificado son los planes de
    // mantenimiento, que es otra cosa.
    const futuro = new Date('2026-10-01T00:00:00.000Z');
    expect(() => crearIntervencion({ ...base, fecha: futuro }, 'OPERATIVO', HOY)).toThrow(
      /futura/i,
    );
  });

  it('tolera un dia de margen, por husos y relojes desfasados', () => {
    const casiHoy = new Date('2026-09-02T20:00:00.000Z');
    expect(() => crearIntervencion({ ...base, fecha: casiHoy }, 'OPERATIVO', HOY)).not.toThrow();
  });

  it('interno exige decir quien lo hizo', () => {
    expect(() => crearIntervencion({ ...base, usuarioId: null }, 'OPERATIVO', HOY)).toThrow(
      /quién lo hizo/i,
    );
  });

  it('externo exige decir que proveedor', () => {
    expect(() =>
      crearIntervencion({ ...base, ejecutor: 'EXTERNO', usuarioId: null }, 'OPERATIVO', HOY),
    ).toThrow(/proveedor/i);
  });

  it('REGRESION: guarda solo el ejecutor que corresponde', () => {
    // Dejar los dos permitiria una intervencion que dice ser interna y apunta a
    // un proveedor, y entonces "cuanto gastamos con este proveedor" mentiria.
    const externa = crearIntervencion(
      { ...base, ejecutor: 'EXTERNO', usuarioId: 'us-1', proveedorId: 'pr-1' },
      'OPERATIVO',
      HOY,
    );
    expect(externa.proveedorId).toBe('pr-1');
    expect(externa.usuarioId).toBeNull();

    const interna = crearIntervencion({ ...base, proveedorId: 'pr-1' }, 'OPERATIVO', HOY);
    expect(interna.usuarioId).toBe('us-1');
    expect(interna.proveedorId).toBeNull();
  });

  it('rechaza costos y horas negativos', () => {
    expect(() => crearIntervencion({ ...base, costoManoObra: -1 }, 'OPERATIVO', HOY)).toThrow(
      /costo/i,
    );
    expect(() => crearIntervencion({ ...base, horasParada: -2 }, 'OPERATIVO', HOY)).toThrow(
      /horas de parada/i,
    );
  });

  it('costo 0 es valido: un service en garantia no cuesta', () => {
    expect(crearIntervencion({ ...base, costoManoObra: 0 }, 'OPERATIVO', HOY).costoManoObra).toBe(
      0,
    );
  });
});

describe('resumirMantenimiento', () => {
  const intervencion = (over: Partial<Intervencion>): Intervencion =>
    ({
      id: 'i',
      equipoId: 'eq-1',
      tipo: 'CORRECTIVO',
      fecha: new Date('2026-01-01T00:00:00.000Z'),
      ejecutor: 'INTERNO',
      usuarioId: 'us-1',
      proveedorId: null,
      descripcion: 'x',
      costoManoObra: null,
      horasParada: null,
      documentoUrl: null,
      registradoPorId: null,
      creadoEn: new Date(),
      ...over,
    }) as Intervencion;

  it('sin historial, no inventa una fecha', () => {
    expect(resumirMantenimiento([])).toMatchObject({ ultimaFecha: null, cantidad: 0 });
  });

  it('la ultima fecha es la mayor, no la ultima de la lista', () => {
    // El orden en que vengan no deberia cambiar el resultado.
    const r = resumirMantenimiento([
      intervencion({ fecha: new Date('2026-03-01T00:00:00.000Z') }),
      intervencion({ fecha: new Date('2026-08-01T00:00:00.000Z') }),
      intervencion({ fecha: new Date('2026-05-01T00:00:00.000Z') }),
    ]);
    expect(r.ultimaFecha?.toISOString().slice(0, 10)).toBe('2026-08-01');
  });

  it('cuenta correctivos y preventivos por separado', () => {
    // Muchos correctivos y pocos preventivos es un equipo mal mantenido, y eso
    // solo se ve si el dato esta separado.
    const r = resumirMantenimiento([
      intervencion({ tipo: 'CORRECTIVO' }),
      intervencion({ tipo: 'CORRECTIVO' }),
      intervencion({ tipo: 'PREVENTIVO' }),
      intervencion({ tipo: 'MEJORA' }),
    ]);
    expect(r).toMatchObject({ cantidad: 4, correctivos: 2, preventivos: 1 });
  });

  it('REGRESION: el costo suma solo lo que tiene precio, sin poner ceros', () => {
    // Un total que mezcla "gratis" con "no lo sabemos" es un numero que miente,
    // y con ese numero se decide reparar o reemplazar.
    const r = resumirMantenimiento([
      intervencion({ costoManoObra: 1000 }),
      intervencion({ costoManoObra: null }),
      intervencion({ costoManoObra: 500 }),
    ]);
    expect(r.costoTotal).toBe(1500);
  });

  it('suma las horas de parada', () => {
    const r = resumirMantenimiento([
      intervencion({ horasParada: 3 }),
      intervencion({ horasParada: 1.5 }),
    ]);
    expect(r.horasParadaTotal).toBe(4.5);
  });
});
