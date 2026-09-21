import { ErrorDatosInvalidos, ErrorNoEsSuyo, ErrorTransicionInvalida } from './errores';
import {
  anularOrdenTrabajo,
  cerrarOrdenTrabajo,
  crearOrdenTrabajo,
  MaterialUsado,
  OrdenTrabajo,
  reabrirOrdenTrabajo,
  reasignarOrdenTrabajo,
  resumirMateriales,
  validarCantidadUsada,
  validarQueEsSuyo,
  validarQueSePuedeEliminar,
  validarQueAceptaMateriales,
} from './orden-trabajo';

const AHORA = new Date('2026-09-21T10:00:00.000Z');

const orden = (cambios: Partial<OrdenTrabajo> = {}): OrdenTrabajo => ({
  id: 'ot-1',
  numero: 'OT-2026-0001',
  titulo: 'Perdida en la bomba de recibo',
  descripcion: null,
  tipo: 'CORRECTIVO',
  estado: 'ABIERTA',
  equipoId: null,
  abiertaEn: AHORA,
  abiertaPorId: 'u1',
  asignadoAId: 'u1',
  resolucion: null,
  cerradaEn: null,
  cerradaPorId: null,
  motivoAnulacion: null,
  creadoEn: AHORA,
  ...cambios,
});

const usado = (materialId: string, cantidad: number): MaterialUsado => ({
  id: `mu-${materialId}`,
  ordenTrabajoId: 'ot-1',
  materialId,
  cantidad,
  movimientoId: `mov-${materialId}`,
  registradoPorId: null,
  creadoEn: AHORA,
});

describe('crearOrdenTrabajo', () => {
  it('nace abierta, sin resolucion y sin cierre', () => {
    const nueva = crearOrdenTrabajo(
      { titulo: 'Cambio de reten', tipo: 'CORRECTIVO', abiertaPorId: 'u1' },
      AHORA,
    );

    expect(nueva.estado).toBe('ABIERTA');
    expect(nueva.resolucion).toBeNull();
    expect(nueva.cerradaEn).toBeNull();
    expect(nueva.abiertaEn).toEqual(AHORA);
  });

  it('exige decir para que es el trabajo', () => {
    // Una orden sin titulo es una fila que dentro de un mes no le dice nada a
    // nadie, que es exactamente el problema que el modulo viene a resolver.
    expect(() =>
      crearOrdenTrabajo({ titulo: '   ', tipo: 'CORRECTIVO', abiertaPorId: 'u1' }, AHORA),
    ).toThrow(ErrorDatosInvalidos);
  });

  it('normaliza los espacios del titulo', () => {
    const nueva = crearOrdenTrabajo(
      { titulo: '  Perdida   en la   bomba  ', tipo: 'CORRECTIVO', abiertaPorId: 'u1' },
      AHORA,
    );
    expect(nueva.titulo).toBe('Perdida en la bomba');
  });

  it('REGRESION: el equipo es opcional', () => {
    // Hay trabajos que no son sobre una maquina, y mantenimiento todavia no ve
    // el modulo de equipos. Obligar a elegir uno haria que se cargue cualquiera
    // con tal de poder guardar, y un dato inventado ensucia ese historial.
    const nueva = crearOrdenTrabajo(
      { titulo: 'Arreglo de canieria', tipo: 'MEJORA', abiertaPorId: 'u1' },
      AHORA,
    );
    expect(nueva.equipoId).toBeNull();
  });

  it('guarda el equipo cuando viene', () => {
    const nueva = crearOrdenTrabajo(
      { titulo: 'Cambio de rodamiento', tipo: 'CORRECTIVO', equipoId: 'eq-7', abiertaPorId: 'u1' },
      AHORA,
    );
    expect(nueva.equipoId).toBe('eq-7');
  });

  it('una descripcion vacia queda en null, no en cadena vacia', () => {
    const nueva = crearOrdenTrabajo(
      { titulo: 'Trabajo', tipo: 'MEJORA', descripcion: '   ', abiertaPorId: 'u1' },
      AHORA,
    );
    expect(nueva.descripcion).toBeNull();
  });
});

describe('validarQueAceptaMateriales', () => {
  it('una orden abierta acepta materiales', () => {
    expect(() => validarQueAceptaMateriales(orden())).not.toThrow();
  });

  it.each(['CERRADA', 'ANULADA'] as const)('REGRESION: una orden %s no acepta', (estado) => {
    // Si se le pudiera seguir moviendo el stock a un trabajo terminado, el
    // costo nunca seria firme y el numero cambiaria a espaldas de quien lo miro.
    expect(() => validarQueAceptaMateriales(orden({ estado }))).toThrow(ErrorTransicionInvalida);
  });
});

describe('validarCantidadUsada', () => {
  it.each([0, -1, NaN, Infinity])('rechaza %p', (cantidad) => {
    expect(() => validarCantidadUsada(cantidad)).toThrow(ErrorDatosInvalidos);
  });

  it('acepta una cantidad fraccionada', () => {
    // Medio litro de aceite es una salida legitima.
    expect(() => validarCantidadUsada(0.5)).not.toThrow();
  });
});

describe('cerrarOrdenTrabajo', () => {
  it('REGRESION: no se cierra sin contar que se hizo', () => {
    // Es la razon de ser del modulo: sin esto queda el mismo vacio que habia
    // antes, se sabe que material salio pero no para que sirvio.
    expect(() => cerrarOrdenTrabajo(orden(), '  ', AHORA, 'u1')).toThrow(ErrorDatosInvalidos);
  });

  it('cerrada guarda la resolucion, la fecha y quien cerro', () => {
    const cambios = cerrarOrdenTrabajo(orden(), 'Se cambio el reten y la junta', AHORA, 'u9');

    expect(cambios).toEqual({
      estado: 'CERRADA',
      resolucion: 'Se cambio el reten y la junta',
      cerradaEn: AHORA,
      cerradaPorId: 'u9',
    });
  });

  it('una orden ya cerrada no se vuelve a cerrar', () => {
    expect(() => cerrarOrdenTrabajo(orden({ estado: 'CERRADA' }), 'Listo', AHORA, 'u1')).toThrow(
      ErrorTransicionInvalida,
    );
  });

  it('se puede cerrar sin haber usado ningun material', () => {
    // Un ajuste, una limpieza o un apriete no consumen nada y son trabajo igual.
    expect(() => cerrarOrdenTrabajo(orden(), 'Se reapreto la brida', AHORA, 'u1')).not.toThrow();
  });
});

describe('reabrirOrdenTrabajo', () => {
  it('una cerrada vuelve a abrirse y conserva lo que se escribio', () => {
    const cerrada = orden({
      estado: 'CERRADA',
      resolucion: 'Se cambio el reten',
      cerradaEn: AHORA,
    });
    const cambios = reabrirOrdenTrabajo(cerrada);

    expect(cambios.estado).toBe('ABIERTA');
    expect(cambios.cerradaEn).toBeNull();
    expect(cambios).not.toHaveProperty('resolucion');
  });

  it.each(['ABIERTA', 'ANULADA'] as const)('no se reabre una orden %s', (estado) => {
    expect(() => reabrirOrdenTrabajo(orden({ estado }))).toThrow(ErrorTransicionInvalida);
  });
});

describe('anularOrdenTrabajo', () => {
  it('anula una orden abierta y vacia, con motivo', () => {
    const cambios = anularOrdenTrabajo(orden(), 'Se cargo duplicada', 0);
    expect(cambios).toEqual({ estado: 'ANULADA', motivoAnulacion: 'Se cargo duplicada' });
  });

  it('exige el motivo', () => {
    expect(() => anularOrdenTrabajo(orden(), '  ', 0)).toThrow(ErrorDatosInvalidos);
  });

  it('REGRESION: no se anula una orden que ya movio stock', () => {
    // Dejaria el paniol descontado sin nada que explique a donde fue. Primero se
    // quitan los materiales, que devuelve el stock y deja asentado que volvio.
    expect(() => anularOrdenTrabajo(orden(), 'Me equivoque', 2)).toThrow(ErrorTransicionInvalida);
  });

  it('no se anula una orden cerrada', () => {
    expect(() => anularOrdenTrabajo(orden({ estado: 'CERRADA' }), 'Motivo', 0)).toThrow(
      ErrorTransicionInvalida,
    );
  });
});

describe('resumirMateriales', () => {
  it('cuenta materiales distintos, no renglones', () => {
    // El mismo material se puede cargar dos veces: se uso el lunes y otra vez el
    // miercoles, y cada carga es su propia salida de stock.
    const resumen = resumirMateriales([usado('m1', 2), usado('m1', 3), usado('m2', 1)]);

    expect(resumen.materialesDistintos).toBe(2);
    expect(resumen.unidadesTotales).toBe(6);
  });

  it('una orden sin materiales resume en cero', () => {
    expect(resumirMateriales([])).toEqual({ materialesDistintos: 0, unidadesTotales: 0 });
  });
});

describe('validarQueSePuedeEliminar', () => {
  it('una anulada y sin materiales se puede borrar', () => {
    expect(() => validarQueSePuedeEliminar(orden({ estado: 'ANULADA' }), 0)).not.toThrow();
  });

  it.each(['ABIERTA', 'CERRADA'] as const)('REGRESION: una %s no se borra', (estado) => {
    // Borrar son dos pasos y no uno: anular primero pide el motivo, asi que si
    // alguien se arrepiente a mitad de camino queda escrito por que no iba.
    expect(() => validarQueSePuedeEliminar(orden({ estado }), 0)).toThrow(ErrorTransicionInvalida);
  });

  it('REGRESION: no se borra nada que haya movido el paniol', () => {
    // El movimiento de stock quedaria huerfano: una salida que ninguna orden
    // explica es justamente el agujero que este modulo vino a tapar.
    expect(() => validarQueSePuedeEliminar(orden({ estado: 'ANULADA' }), 1)).toThrow(
      ErrorTransicionInvalida,
    );
  });
});

describe('de quien es el trabajo', () => {
  it('si no se elige a nadie, queda para quien la abre', () => {
    // Es el caso de abrirse una orden para uno mismo: no tiene por que costar
    // un paso de mas.
    const nueva = crearOrdenTrabajo(
      { titulo: 'Reviso la bomba', tipo: 'CORRECTIVO', abiertaPorId: 'u1' },
      AHORA,
    );
    expect(nueva.asignadoAId).toBe('u1');
  });

  it('un encargado se la puede asignar a otro', () => {
    const nueva = crearOrdenTrabajo(
      { titulo: 'Cambio de reten', tipo: 'CORRECTIVO', abiertaPorId: 'u1', asignadoAId: 'u2' },
      AHORA,
    );
    expect(nueva.asignadoAId).toBe('u2');
    expect(nueva.abiertaPorId).toBe('u1');
  });

  it('REGRESION: no se crea una orden sin duenio', () => {
    // Una orden sin duenio es una que nadie puede cerrar y que todos suponen
    // que va a hacer otro.
    expect(() => crearOrdenTrabajo({ titulo: 'Algo', tipo: 'MEJORA' }, AHORA)).toThrow(
      ErrorDatosInvalidos,
    );
  });

  it('el asignado puede trabajarla', () => {
    expect(() => validarQueEsSuyo(orden({ asignadoAId: 'u1' }), 'u1')).not.toThrow();
  });

  it('REGRESION: el que no la tiene asignada no puede', () => {
    // Sin esto "asignada a" seria una etiqueta decorativa, y dos personas
    // podrian cargar repuestos sobre el mismo trabajo sin saberlo.
    expect(() => validarQueEsSuyo(orden({ asignadoAId: 'u2' }), 'u1')).toThrow(ErrorNoEsSuyo);
  });

  it('REGRESION: sin saber quien es, tampoco', () => {
    expect(() => validarQueEsSuyo(orden({ asignadoAId: 'u1' }), null)).toThrow(ErrorNoEsSuyo);
  });
});

describe('reasignarOrdenTrabajo', () => {
  it('una abierta pasa a otra persona', () => {
    expect(reasignarOrdenTrabajo(orden({ asignadoAId: 'u1' }), 'u2')).toEqual({
      asignadoAId: 'u2',
    });
  });

  it.each(['CERRADA', 'ANULADA'] as const)('no se reasigna una %s', (estado) => {
    // Ya no es trabajo pendiente: no hay nada que pasarle a nadie.
    expect(() => reasignarOrdenTrabajo(orden({ estado }), 'u2')).toThrow(ErrorTransicionInvalida);
  });

  it('reasignar a quien ya la tiene no tiene sentido', () => {
    expect(() => reasignarOrdenTrabajo(orden({ asignadoAId: 'u1' }), 'u1')).toThrow(
      ErrorDatosInvalidos,
    );
  });
});
