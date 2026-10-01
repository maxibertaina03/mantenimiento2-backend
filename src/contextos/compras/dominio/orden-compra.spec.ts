import { ErrorRenglonInvalido } from '../../../common/dominio/renglon-de-compra';
import { ErrorDatosInvalidos, ErrorEstadoDeLaOrden, ErrorSinComprobante } from './errores';
import {
  EstadoOrdenCompra,
  comprobanteDeRecepcion,
  materialesDeLosRenglones,
  validarEditable,
  validarEliminable,
  validarQueQuedanRenglones,
  validarQueSePuedeEmitir,
  validarPreciosCorregibles,
  validarPreciosCorregidos,
  validarTransicion,
} from './orden-compra';

/**
 * Las reglas de una orden de compra, sin Nest, sin base y sin dobles.
 *
 * Los casos de punta a punta siguen en el spec del service y en los e2e. Esto
 * fija la regla en sí.
 */
describe('Compras - dominio', () => {
  const orden = (estado: EstadoOrdenCompra) => ({ numero: 'OC-2026-0001', estado });

  describe('corregir precios de una orden que ya salio', () => {
    it.each(['BORRADOR', 'EMITIDA', 'RECIBIDA'] as const)('en %s se puede', (estado) => {
      expect(() => validarPreciosCorregibles(orden(estado))).not.toThrow();
    });

    it('en una ANULADA no', () => {
      expect(() => validarPreciosCorregibles(orden('ANULADA'))).toThrow(ErrorEstadoDeLaOrden);
    });

    const renglones = [{ id: 'r1' }, { id: 'r2' }];

    it('acepta precios de renglones de la orden', () => {
      expect(() =>
        validarPreciosCorregidos(renglones, [{ renglonId: 'r2', precioUnitario: 1500 }]),
      ).not.toThrow();
    });

    it.each([
      ['sin precios', []],
      ['un renglon de otra orden', [{ renglonId: 'otro', precioUnitario: 10 }]],
      [
        'el mismo renglon dos veces',
        [
          { renglonId: 'r1', precioUnitario: 10 },
          { renglonId: 'r1', precioUnitario: 20 },
        ],
      ],
      ['precio cero', [{ renglonId: 'r1', precioUnitario: 0 }]],
      ['precio negativo', [{ renglonId: 'r1', precioUnitario: -5 }]],
    ])('rechaza %s', (_caso, precios) => {
      expect(() => validarPreciosCorregidos(renglones, precios)).toThrow(ErrorDatosInvalidos);
    });
  });

  describe('el ciclo de vida', () => {
    it.each([
      ['BORRADOR', 'EMITIDA'],
      ['BORRADOR', 'ANULADA'],
      ['EMITIDA', 'RECIBIDA'],
      ['EMITIDA', 'ANULADA'],
    ] as const)('%s puede pasar a %s', (desde, hacia) => {
      expect(() => validarTransicion(orden(desde), hacia)).not.toThrow();
    });

    it.each([
      ['BORRADOR', 'RECIBIDA'],
      ['EMITIDA', 'EMITIDA'],
      ['RECIBIDA', 'ANULADA'],
      ['ANULADA', 'EMITIDA'],
    ] as const)('%s NO puede pasar a %s', (desde, hacia) => {
      expect(() => validarTransicion(orden(desde), hacia)).toThrow(ErrorEstadoDeLaOrden);
    });

    it('el mensaje dice en qué estado está y a cuál no puede ir', () => {
      expect(() => validarTransicion(orden('RECIBIDA'), 'ANULADA')).toThrow(
        'La orden OC-2026-0001 está RECIBIDA y no puede pasar a ANULADA.',
      );
    });

    it('solo el borrador se edita y se borra', () => {
      expect(() => validarEditable(orden('BORRADOR'))).not.toThrow();
      expect(() => validarEditable(orden('EMITIDA'))).toThrow(/ya no se puede editar/);
      expect(() => validarEliminable(orden('BORRADOR'))).not.toThrow();
      expect(() => validarEliminable(orden('EMITIDA'))).toThrow(/anulala/);
    });

    it('no se emite ni se deja una orden sin renglones', () => {
      expect(() => validarQueSePuedeEmitir([])).toThrow(ErrorDatosInvalidos);
      expect(() => validarQueSePuedeEmitir(undefined)).toThrow(ErrorDatosInvalidos);
      expect(() => validarQueQuedanRenglones([])).toThrow(/al menos un renglón/);
      // Editar sin tocar los renglones no es dejarla vacía.
      expect(() => validarQueQuedanRenglones(undefined)).not.toThrow();
    });
  });

  describe('los renglones', () => {
    it('devuelve los materiales en el orden en que aparecen, sin los equipos', () => {
      const ids = [
        ...materialesDeLosRenglones([
          { materialId: 'b', cantidad: 1 },
          { descripcionEquipo: 'Amoladora', cantidad: 2 },
          { materialId: 'a', cantidad: 1 },
        ]),
      ];
      expect(ids).toEqual(['b', 'a']);
    });

    it('un material repetido se rechaza; un equipo repetido no', () => {
      expect(() => [
        ...materialesDeLosRenglones([
          { materialId: 'a', cantidad: 1 },
          { materialId: 'a', cantidad: 2 },
        ]),
      ]).toThrow(/Unificalos/);
      expect(() => [
        ...materialesDeLosRenglones([
          { descripcionEquipo: 'Amoladora', cantidad: 1 },
          { descripcionEquipo: 'Amoladora', cantidad: 1 },
        ]),
      ]).not.toThrow();
    });

    it('revisa cada renglón antes de pasar al siguiente', () => {
      // Quien consume los materiales los valida uno por uno; un renglón roto
      // más adelante no tiene que cortar antes de validar los anteriores.
      const recorrido = materialesDeLosRenglones([
        { materialId: 'a', cantidad: 1 },
        { cantidad: 1 },
      ]);
      expect(recorrido.next().value).toBe('a');
      expect(() => recorrido.next()).toThrow(ErrorRenglonInvalido);
    });
  });

  describe('el comprobante de la recepción', () => {
    it('sin remito ni factura no se cierra', () => {
      expect(() => comprobanteDeRecepcion('OC-1', '  ', undefined)).toThrow(ErrorSinComprobante);
    });

    it('arma la referencia que queda en cada movimiento', () => {
      expect(comprobanteDeRecepcion('OC-1', ' R-1 ', 'F-2')).toEqual({
        remito: 'R-1',
        factura: 'F-2',
        referencia: 'OC-1 · Remito R-1 · Factura F-2',
      });
      expect(comprobanteDeRecepcion('OC-1', null, 'F-2').referencia).toBe('OC-1 · Factura F-2');
    });
  });
});
