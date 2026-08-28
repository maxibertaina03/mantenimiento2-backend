import { RolUsuario } from '@prisma/client';
import { CLAVE_ROLES } from '../../common/auth/decorators/roles.decorator';
import { OrdenesCompraController } from './ordenes-compra.controller';

/** Roles exigidos por un método del controller, según el metadata del decorador. */
function rolesDe(metodo: keyof OrdenesCompraController): RolUsuario[] | undefined {
  return Reflect.getMetadata(CLAVE_ROLES, OrdenesCompraController.prototype[metodo] as object);
}

/**
 * Quién puede hacer qué en órdenes de compra.
 *
 * Se testea el metadata y no una request porque los E2E corren con la auth
 * desactivada: sin esto, borrar un @Roles pasaría sin que nada se queje.
 */
describe('OrdenesCompraController — permisos', () => {
  it('el envío por correo es solo de admin', () => {
    // Está en prueba, y usa la casilla de la empresa para escribirle a
    // terceros: ocultar el botón no alcanza si el endpoint queda abierto.
    expect(rolesDe('enviarCorreo')).toEqual([RolUsuario.ADMIN]);
  });

  it.each(['crear', 'listar', 'obtener', 'emitir', 'recibir'] as const)(
    'REGRESION: %s sigue abierto a los operarios',
    (metodo) => {
      // El operario es quien carga las órdenes y recibe la mercadería: cerrarle
      // esto lo dejaría sin poder trabajar.
      expect(rolesDe(metodo)).toBeUndefined();
    },
  );
});
