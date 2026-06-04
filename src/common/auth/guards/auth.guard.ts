import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Guard "no-op": HOY deja pasar todas las requests (sin autenticación).
 *
 * Está pensado como punto único de reemplazo: cuando enchufemos Clerk,
 * se sustituye la lógica de este guard (verificar el JWT de Clerk y
 * resolver el Usuario por `idExterno`) SIN tocar controllers ni services.
 *
 * Uso futuro en un controller:  @UseGuards(GuardAutenticacion)
 */
@Injectable()
export class GuardAutenticacion implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO(clerk): validar token y adjuntar el usuario a request.usuario.
    return true;
  }
}
