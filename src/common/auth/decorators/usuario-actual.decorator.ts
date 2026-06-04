import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Devuelve el usuario autenticado adjuntado a la request.
 * HOY (sin auth) retorna undefined. Cuando entre Clerk, el GuardAutenticacion
 * adjuntará `request.usuario` y este decorador lo expondrá en los controllers.
 *
 * Uso futuro:  metodo(@UsuarioActual() usuario: Usuario) { ... }
 */
export const UsuarioActual = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.usuario;
});
