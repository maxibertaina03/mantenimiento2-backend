import { ErrorDatosInvalidos, ErrorEstadoDeLaOrden } from './errores';
import { armarReclamo } from './mensaje-orden';
import {
  RenglonARecibir,
  cantidadesARecibir,
  estadoTrasRecibir,
  pendientesDe,
  validarCierreConFaltante,
  validarReclamable,
  validarTransicion,
} from './orden-compra';

/**
 * Recibir una orden en varias entregas. El caso que lo motivó: la OC-2026-0028
 * llegó con los artefactos y sin los acrílicos.
 */
const ARTEFACTO: RenglonARecibir = {
  id: 'r-art',
  cantidad: 10,
  cantidadRecibida: 0,
  esEquipo: false,
  nombre: 'Artefacto marea vacio para led 2x20',
};
const ACRILICO: RenglonARecibir = {
  id: 'r-acr',
  cantidad: 10,
  cantidadRecibida: 0,
  esEquipo: false,
  nombre: 'Repuesto acrilico p/marea 2x36w',
};
const AMOLADORA: RenglonARecibir = {
  id: 'r-amo',
  cantidad: 3,
  cantidadRecibida: 0,
  esEquipo: true,
  nombre: 'Amoladora angular',
};
const orden = (estado: Parameters<typeof validarTransicion>[0]['estado']) => ({
  numero: 'OC-2026-0028',
  estado,
});

describe('recibir en varias entregas', () => {
  it('sin detalle llega todo lo que faltaba (la recepción de siempre)', () => {
    expect(cantidadesARecibir('OC-1', [ARTEFACTO, { ...ACRILICO, cantidadRecibida: 4 }])).toEqual([
      { renglonId: 'r-art', cantidad: 10 },
      { renglonId: 'r-acr', cantidad: 6 },
    ]);
  });

  it('REGRESION: llegaron los artefactos y no los acrílicos: queda RECIBIDA_PARCIAL', () => {
    const recibidas = cantidadesARecibir(
      'OC-2026-0028',
      [ARTEFACTO, ACRILICO],
      [
        { renglonId: 'r-art', cantidad: 10 },
        { renglonId: 'r-acr', cantidad: 0 },
      ],
    );

    expect(recibidas).toEqual([{ renglonId: 'r-art', cantidad: 10 }]);
    expect(estadoTrasRecibir([ARTEFACTO, ACRILICO], recibidas)).toBe('RECIBIDA_PARCIAL');
  });

  it('cuando llega lo último, queda RECIBIDA', () => {
    const yaLlegoElArtefacto = { ...ARTEFACTO, cantidadRecibida: 10 };
    const recibidas = cantidadesARecibir(
      'OC-1',
      [yaLlegoElArtefacto, ACRILICO],
      [{ renglonId: 'r-acr', cantidad: 10 }],
    );
    expect(estadoTrasRecibir([yaLlegoElArtefacto, ACRILICO], recibidas)).toBe('RECIBIDA');
  });

  it('se puede recibir una parte de un renglón (6 de 10)', () => {
    const recibidas = cantidadesARecibir('OC-1', [ACRILICO], [{ renglonId: 'r-acr', cantidad: 6 }]);
    expect(estadoTrasRecibir([ACRILICO], recibidas)).toBe('RECIBIDA_PARCIAL');
  });

  it('REGRESION: no se recibe más de lo que falta (inflaría el stock)', () => {
    expect(() =>
      cantidadesARecibir(
        'OC-1',
        [{ ...ACRILICO, cantidadRecibida: 6 }],
        [{ renglonId: 'r-acr', cantidad: 5 }],
      ),
    ).toThrow(/faltan 4 y se quieren recibir 5/);
  });

  it('un renglón ya completo no se vuelve a recibir', () => {
    expect(() =>
      cantidadesARecibir(
        'OC-1',
        [{ ...ACRILICO, cantidadRecibida: 10 }],
        [{ renglonId: 'r-acr', cantidad: 1 }],
      ),
    ).toThrow(/ya se recibió completo/);
  });

  it('un equipo se recibe por unidades enteras', () => {
    expect(() =>
      cantidadesARecibir('OC-1', [AMOLADORA], [{ renglonId: 'r-amo', cantidad: 1.5 }]),
    ).toThrow(/unidades enteras/);
  });

  it('tiene que llegar algo, de un renglón de la orden, una vez', () => {
    expect(() =>
      cantidadesARecibir('OC-1', [ACRILICO], [{ renglonId: 'r-acr', cantidad: 0 }]),
    ).toThrow(ErrorDatosInvalidos);
    expect(() =>
      cantidadesARecibir('OC-1', [ACRILICO], [{ renglonId: 'otro', cantidad: 1 }]),
    ).toThrow(/no es de esta orden/);
    expect(() =>
      cantidadesARecibir(
        'OC-1',
        [ACRILICO],
        [
          { renglonId: 'r-acr', cantidad: 1 },
          { renglonId: 'r-acr', cantidad: 1 },
        ],
      ),
    ).toThrow(/dos veces/);
  });

  it('pendientesDe lista solo lo que falta, con cuánto', () => {
    expect(pendientesDe([{ ...ARTEFACTO, cantidadRecibida: 10 }, ACRILICO])).toEqual([
      { ...ACRILICO, pendiente: 10 },
    ]);
  });
});

describe('los estados de una orden recibida en parte', () => {
  it('una parcial se completa, pero no se anula: ya movió stock', () => {
    expect(() => validarTransicion(orden('RECIBIDA_PARCIAL'), 'RECIBIDA')).not.toThrow();
    expect(() => validarTransicion(orden('RECIBIDA_PARCIAL'), 'RECIBIDA_PARCIAL')).not.toThrow();
    expect(() => validarTransicion(orden('RECIBIDA_PARCIAL'), 'ANULADA')).toThrow(
      ErrorEstadoDeLaOrden,
    );
  });

  it('cerrar con faltante: solo una parcial, y con motivo', () => {
    expect(validarCierreConFaltante(orden('RECIBIDA_PARCIAL'), '  sin   stock  ')).toBe(
      'sin stock',
    );
    expect(() => validarCierreConFaltante(orden('RECIBIDA_PARCIAL'), ' ')).toThrow(
      ErrorDatosInvalidos,
    );
    expect(() => validarCierreConFaltante(orden('EMITIDA'), 'sin stock')).toThrow(/anulala/);
    expect(() => validarCierreConFaltante(orden('RECIBIDA'), 'sin stock')).toThrow(
      ErrorEstadoDeLaOrden,
    );
  });

  it('se reclama solo lo que se espera', () => {
    expect(() => validarReclamable(orden('RECIBIDA_PARCIAL'), [ACRILICO])).not.toThrow();
    expect(() => validarReclamable(orden('RECIBIDA'), [ACRILICO])).toThrow(ErrorEstadoDeLaOrden);
    expect(() => validarReclamable(orden('RECIBIDA_PARCIAL'), [])).toThrow(ErrorEstadoDeLaOrden);
  });
});

describe('el reclamo al proveedor', () => {
  it('lista solo lo que falta, con la cantidad que falta (y entiende las pulgadas)', () => {
    const { asunto, cuerpo } = armarReclamo({
      numero: 'OC-2026-0028',
      proveedorNombre: 'Ferrero Alfredo e Hijos',
      proveedorEmail: null,
      observaciones: null,
      total: null,
      renglones: [
        { materialNombre: 'Artefacto marea', unidad: 'u', cantidad: 10, pendiente: 0 },
        {
          materialNombre: 'Repuesto acrilico p/marea 2x36w',
          unidad: 'u',
          cantidad: 10,
          pendiente: 10,
        },
        { materialNombre: 'Union doble 1"', unidad: 'u', cantidad: 10, pendiente: 4 },
      ],
    });

    expect(asunto).toBe('Pendiente de la orden de compra OC-2026-0028 - Lácteos Las Tres S.R.L.');
    expect(cuerpo).toContain('De la orden de compra OC-2026-0028 todavía no recibimos:');
    expect(cuerpo).toContain('• Repuesto acrilico p/marea 2x36w — 10 u');
    expect(cuerpo).toContain('• Union doble 1" — 4 u');
    expect(cuerpo).not.toContain('Artefacto');
  });
});
