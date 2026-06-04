import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { verifyToken, type ClerkClient } from '@clerk/backend';
import type { Request } from 'express';
import { UsuariosService } from '../../../modules/usuarios/usuarios.service';
import { CLERK_CLIENT } from '../clerk.provider';
import { CLAVE_PUBLICO } from '../decorators/public.decorator';

/**
 * Guard de autenticación basado en Clerk. Registrado como guard GLOBAL (APP_GUARD).
 *
 * Flujo:
 *  1. Si la ruta es @Public() -> pasa.
 *  2. Si AUTH_DISABLED="true" (solo dev) -> pasa sin verificar (no adjunta usuario).
 *  3. Verifica el JWT de Clerk del header Authorization: Bearer <token>.
 *  4. Provisiona el Usuario en la DB (just-in-time) y lo adjunta a request.usuario.
 *
 * Reemplaza al guard no-op anterior SIN tocar la lógica de negocio de los módulos.
 */
@Injectable()
export class GuardAutenticacion implements CanActivate {
  private readonly logger = new Logger(GuardAutenticacion.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly usuarios: UsuariosService,
    @Inject(CLERK_CLIENT) private readonly clerk: ClerkClient | null,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublico) return true;

    // Escape hatch de desarrollo.
    if (this.config.get<string>('AUTH_DISABLED') === 'true') return true;

    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey || !this.clerk) {
      this.logger.error('CLERK_SECRET_KEY no configurada y AUTH_DISABLED no es "true".');
      throw new UnauthorizedException('Autenticación no configurada en el servidor.');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extraerToken(request);
    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación (Bearer).');
    }

    let clerkUserId: string;
    try {
      const claims = await verifyToken(token, { secretKey });
      clerkUserId = claims.sub;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }

    // Provisionamiento just-in-time: aseguramos la fila en nuestra tabla usuarios.
    const clerkUser = await this.clerk.users.getUser(clerkUserId);
    const email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      throw new UnauthorizedException('El usuario de Clerk no tiene email.');
    }

    const nombre =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || email;

    const usuario = await this.usuarios.buscarOCrearPorClerk({
      idExterno: clerkUserId,
      email,
      nombre,
    });

    // Disponible para los controllers vía el decorador @UsuarioActual().
    (request as Request & { usuario?: unknown }).usuario = usuario;
    return true;
  }

  private extraerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [tipo, valor] = header.split(' ');
    return tipo === 'Bearer' ? valor : undefined;
  }
}
