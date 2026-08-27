import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';

export const CLAVE_ROLES = 'roles_requeridos';

/**
 * Restringe un endpoint (o un controller entero) a ciertos roles.
 *
 * Ejemplo:  @Roles(RolUsuario.ADMIN)
 */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(CLAVE_ROLES, roles);
