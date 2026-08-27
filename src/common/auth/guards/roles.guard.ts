import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RolUsuario, Usuario } from '@prisma/client';
import type { Request } from 'express';
import { CLAVE_ROLES } from '../decorators/roles.decorator';

/**
 * Guard de autorización por rol. Corre DESPUÉS del GuardAutenticacion, que es
 * quien adjunta `request.usuario`.
 *
 * Si un endpoint no declara @Roles, pasa: la mayoría del sistema es de uso
 * común y solo algunos módulos (Equipos IT) están restringidos.
 */
@Injectable()
export class GuardRoles implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<RolUsuario[]>(CLAVE_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesRequeridos?.length) return true;

    // Mismo escape hatch que el guard de autenticación: sin auth no hay usuario
    // al que pedirle rol, así que en dev queda abierto.
    if (this.config.get<string>('AUTH_DISABLED') === 'true') return true;

    const request = context.switchToHttp().getRequest<Request & { usuario?: Usuario }>();
    const usuario = request.usuario;

    if (!usuario || !rolesRequeridos.includes(usuario.rol)) {
      throw new ForbiddenException(
        `Esta sección es solo para usuarios con rol ${rolesRequeridos.join(' o ')}.`,
      );
    }
    return true;
  }
}
