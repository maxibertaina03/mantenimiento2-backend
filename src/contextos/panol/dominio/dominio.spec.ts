import { aDecimal } from '../../../common/dominio/decimal';
import {
  ErrorDatosInvalidos,
  ErrorMaterialConHistorial,
  ErrorMaterialDesactivado,
  ErrorNoAutorizado,
  ErrorNombreRepetido,
  ErrorStockInsuficiente,
  ErrorStockNegativo,
} from './errores';
import {
  ubicacionFinal,
  validarAdmiteMovimientos,
  validarEliminable,
  validarEnUso,
  validarNombreLibre,
  validarUbicacion,
} from './material';
import {
  calcularNuevoStock,
  validarCantidad,
  validarQuePuedeEditar,
  validarStockRecalculado,
  validarTipoYMotivo,
} from './movimiento';

/**
 * Las reglas del pañol, sin Nest, sin base y sin dobles: funciones puras.
 *
 * Los casos de punta a punta siguen en los specs de la infraestructura y en
 * los e2e. Esto fija la regla en sí, que es lo que no puede torcerse.
 */
describe('Pañol - dominio', () => {
  describe('cómo cambia el stock', () => {
    const d = aDecimal;

    it('una ENTRADA suma', () => {
      expect(calcularNuevoStock('ENTRADA', d(10), d(2.5)).toString()).toBe('12.5');
    });

    it('una SALIDA resta', () => {
      expect(calcularNuevoStock('SALIDA', d(10), d(2.5)).toString()).toBe('7.5');
    });

    it('la salida exacta deja cero, no negativo', () => {
      expect(calcularNuevoStock('SALIDA', d(0.3), d(0.3)).isZero()).toBe(true);
    });

    it('una salida de más se rechaza con los dos números en el mensaje', () => {
      expect(() => calcularNuevoStock('SALIDA', d(3), d(4))).toThrow(ErrorStockInsuficiente);
      expect(() => calcularNuevoStock('SALIDA', d(3), d(4))).toThrow(/hay 3 .* retirar 4/);
    });

    it('un AJUSTE fija el valor, sin mirar lo que había', () => {
      expect(calcularNuevoStock('AJUSTE', d(100), d(7)).toString()).toBe('7');
      expect(calcularNuevoStock('AJUSTE', d(100), d(0)).isZero()).toBe(true);
    });

    it('una edición que deja el stock negativo se rechaza', () => {
      expect(() => validarStockRecalculado(d(-1))).toThrow(ErrorStockNegativo);
      expect(() => validarStockRecalculado(d(0))).not.toThrow();
    });
  });

  describe('lo que arma un movimiento válido', () => {
    it('ENTRADA y SALIDA mueven más de cero; el AJUSTE puede ser cero', () => {
      expect(() => validarCantidad('ENTRADA', aDecimal(0))).toThrow(ErrorDatosInvalidos);
      expect(() => validarCantidad('SALIDA', aDecimal(0))).toThrow(ErrorDatosInvalidos);
      expect(() => validarCantidad('AJUSTE', aDecimal(0))).not.toThrow();
    });

    it('el motivo tiene que encajar con el tipo', () => {
      expect(() => validarTipoYMotivo('ENTRADA', 'COMPRA')).not.toThrow();
      expect(() => validarTipoYMotivo('SALIDA', 'DEVOLUCION')).not.toThrow();
      expect(() => validarTipoYMotivo('ENTRADA', 'TRABAJO')).toThrow(
        /Motivos válidos: COMPRA, OTRO/,
      );
      expect(() => validarTipoYMotivo('AJUSTE', 'COMPRA')).toThrow(ErrorDatosInvalidos);
    });

    it('lo corrige quien lo registró o un admin; sin sesión, se permite', () => {
      expect(() => validarQuePuedeEditar('u1', { id: 'u1', rol: 'MANTENIMIENTO' })).not.toThrow();
      expect(() => validarQuePuedeEditar('u1', { id: 'u2', rol: 'ADMIN' })).not.toThrow();
      expect(() => validarQuePuedeEditar('u1', undefined)).not.toThrow();
      expect(() => validarQuePuedeEditar('u1', { id: 'u2', rol: 'MANTENIMIENTO' })).toThrow(
        ErrorNoAutorizado,
      );
    });
  });

  describe('la ficha del material', () => {
    it('no hay dos materiales con el mismo nombre, sin importar mayúsculas ni acentos', () => {
      const existentes = [{ id: 'a', nombre: 'Válvula esférica' }];
      expect(() => validarNombreLibre(existentes, 'VALVULA ESFERICA')).toThrow(ErrorNombreRepetido);
      expect(() => validarNombreLibre(existentes, 'Valvula esferica', 'a')).not.toThrow();
    });

    it('una fila sin estantería no ubica nada', () => {
      expect(() => validarUbicacion(null, 3)).toThrow(/no ubica/);
      expect(() => validarUbicacion('est', 3)).not.toThrow();
      expect(() => validarUbicacion(null, null)).not.toThrow();
    });

    it('la ubicación se mira como va a quedar, no solo como vino', () => {
      const ubicado = { estanteriaId: 'est', fila: 3 };
      expect(ubicacionFinal(ubicado, { fila: 5 })).toEqual({ estanteriaId: 'est', fila: 5 });
      // Vaciar la estantería vacía la fila.
      expect(ubicacionFinal(ubicado, { estanteriaId: null })).toEqual({
        estanteriaId: null,
        fila: null,
      });
      // La fila sola sobre un material sin estantería queda huérfana.
      expect(ubicacionFinal({ estanteriaId: null, fila: null }, { fila: 5 })).toEqual({
        estanteriaId: null,
        fila: 5,
      });
    });

    it('un material desactivado no entra en cargas nuevas', () => {
      const jubilado = { nombre: 'Cable', activo: false };
      expect(() => validarEnUso(jubilado)).toThrow(ErrorMaterialDesactivado);
      expect(() => validarAdmiteMovimientos(jubilado)).toThrow(/no admite movimientos nuevos/);
      expect(() => validarEnUso({ nombre: 'Cable', activo: true })).not.toThrow();
    });

    it('con movimientos no se borra: se llevaría el historial', () => {
      expect(() => validarEliminable(2)).toThrow(ErrorMaterialConHistorial);
      expect(() => validarEliminable(2)).toThrow(/desactivalo/);
      expect(() => validarEliminable(0)).not.toThrow();
    });
  });
});
