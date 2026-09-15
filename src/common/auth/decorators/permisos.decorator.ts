import { SetMetadata } from '@nestjs/common';
import type { Permiso } from '../permisos';

export const CLAVE_PERMISOS = 'permisos_requeridos';

/**
 * Declara qué permisos pide un endpoint, o un controller entero.
 *
 * Es obligatorio. El guard trabaja al revés de como trabajaba antes: lo que no
 * declara nada, no pasa. Antes era al revés, y por eso un operario podía crear
 * materiales, movimientos y órdenes desde la API aunque la pantalla no le
 * mostrara el botón: bastaba con que alguien se olvidara de poner el decorador.
 *
 * Si se declaran varios, hacen falta todos: `@Permisos(A, B)` significa A y B.
 *
 * Ejemplo:  @Permisos(PERMISOS.ORDENES_RECIBIR, PERMISOS.MOVIMIENTOS_CREAR)
 */
export const Permisos = (...permisos: Permiso[]) => SetMetadata(CLAVE_PERMISOS, permisos);

/**
 * Marca un endpoint que cualquiera que haya iniciado sesión puede usar.
 *
 * Se usa para lo que no es información del negocio: saber quién soy, qué puedo
 * hacer, si el servidor está vivo. Es explícito a propósito, para que abrir un
 * endpoint a todos sea una decisión escrita y no un olvido.
 */
export const CLAVE_AUTENTICADO = 'solo_autenticado';
export const SoloAutenticado = () => SetMetadata(CLAVE_AUTENTICADO, true);
