import { CLAVE_PERMISOS } from '../../common/auth/decorators/permisos.decorator';
import { PERMISOS, PRESETS, Permiso, puede } from '../../common/auth/permisos';
import { OrdenesCompraController } from './ordenes-compra.controller';

/** Los permisos que exige un método del controller, según su decorador. */
function permisosDe(metodo: keyof OrdenesCompraController): Permiso[] {
  return (
    (Reflect.getMetadata(
      CLAVE_PERMISOS,
      OrdenesCompraController.prototype[metodo] as object,
    ) as Permiso[]) ?? []
  );
}

/**
 * Quién puede hacer qué en órdenes de compra.
 *
 * Se testea el decorador y no una request porque los E2E corren con la
 * autenticación desactivada: sin esto, borrar un permiso pasaría sin que nada
 * se queje.
 */
describe('OrdenesCompraController — permisos', () => {
  it('cada endpoint declara el permiso que le corresponde', () => {
    expect(permisosDe('listar')).toEqual([PERMISOS.ORDENES_VER]);
    expect(permisosDe('crear')).toEqual([PERMISOS.ORDENES_EDITAR]);
    expect(permisosDe('recibir')).toEqual([PERMISOS.ORDENES_RECIBIR]);
    expect(permisosDe('anular')).toEqual([PERMISOS.ORDENES_EDITAR]);
  });

  it('REGRESION: enviar al proveedor pide su propio permiso', () => {
    // Usa la casilla de la empresa para escribirle a terceros. Que dependa de
    // "editar órdenes" mezclaba dos cosas distintas: preparar una orden no es
    // lo mismo que mandarla afuera.
    expect(permisosDe('enviarCorreo')).toEqual([PERMISOS.ORDENES_ENVIAR]);
    expect(permisosDe('registrarWhatsapp')).toEqual([PERMISOS.ORDENES_ENVIAR]);
  });

  describe('qué puede hacer cada rol acá', () => {
    it('administración de la empresa solo mira', () => {
      expect(puede(PRESETS.ADMINISTRATIVO, permisosDe('listar'))).toBe(true);
      expect(puede(PRESETS.ADMINISTRATIVO, permisosDe('obtener'))).toBe(true);
      expect(puede(PRESETS.ADMINISTRATIVO, permisosDe('crear'))).toBe(false);
      expect(puede(PRESETS.ADMINISTRATIVO, permisosDe('recibir'))).toBe(false);
      expect(puede(PRESETS.ADMINISTRATIVO, permisosDe('enviarCorreo'))).toBe(false);
    });

    it('mantenimiento maneja el circuito de compras completo', () => {
      // Las órdenes impactan directo en el stock cuando se reciben, y el stock
      // es de ellos: partir el circuito entre dos áreas dejaba la mercadería
      // esperando a que otro la diera por recibida.
      for (const metodo of ['listar', 'crear', 'emitir', 'recibir', 'enviarCorreo'] as const) {
        expect(puede(PRESETS.MANTENIMIENTO, permisosDe(metodo))).toBe(true);
      }
    });

    it('gerencia mira y no toca', () => {
      expect(puede(PRESETS.GERENCIA, permisosDe('listar'))).toBe(true);
      expect(puede(PRESETS.GERENCIA, permisosDe('crear'))).toBe(false);
      expect(puede(PRESETS.GERENCIA, permisosDe('enviarCorreo'))).toBe(false);
    });

    it('el administrador puede todo', () => {
      for (const metodo of ['listar', 'crear', 'recibir', 'enviarCorreo', 'anular'] as const) {
        expect(puede(PRESETS.ADMIN, permisosDe(metodo))).toBe(true);
      }
    });
  });
});
