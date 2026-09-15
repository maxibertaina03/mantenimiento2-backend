import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Usuario } from '@prisma/client';
import type { Request } from 'express';
import { CLAVE_AUTENTICADO, CLAVE_PERMISOS } from '../decorators/permisos.decorator';
import { CLAVE_PUBLICO } from '../decorators/public.decorator';
import { DESCRIPCION_PERMISOS, Permiso, puede } from '../permisos';
import { PermisosService } from '../permisos.service';

/**
 * Deja pasar solo lo que el rol de quien pide tiene permitido.
 *
 * **Falla cerrado.** Un endpoint que no declara ni `@Permisos` ni
 * `@SoloAutenticado` no pasa, aunque quien pida sea administrador. Antes era al
 * revés —pasaba todo lo que no declarara nada— y por eso un operario podía
 * crear materiales, movimientos y órdenes desde la API: alcanzaba con que
 * alguien se olvidara del decorador en un endpoint nuevo.
 *
 * Que falle cerrado tiene un costo: si se agrega un endpoint y se olvida el
 * decorador, nadie puede usarlo. Es el error que se quiere: se descubre la
 * primera vez que alguien lo toca, y no meses después cuando resulta que
 * cualquiera podía escribir. Hay además un test que recorre todos los
 * endpoints y falla si alguno no declara nada.
 */
@Injectable()
export class GuardPermisos implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly permisos: PermisosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const clase = context.getClass();

    // Lo público no pasa por acá: no hay usuario del que mirar el rol. Es el
    // caso del disparador de avisos, que llama una máquina con su propio token.
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [handler, clase])) {
      return true;
    }

    // Lo que cualquiera autenticado puede usar: saber quién es, qué puede hacer.
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_AUTENTICADO, [handler, clase])) {
      return true;
    }

    const requeridos =
      this.reflector.getAllAndOverride<Permiso[]>(CLAVE_PERMISOS, [handler, clase]) ?? [];

    // Mismo escape hatch que el guard de autenticación: sin auth no hay usuario
    // al que pedirle permisos, así que en desarrollo queda abierto.
    if (this.config.get<string>('AUTH_DISABLED') === 'true') return true;

    const request = context.switchToHttp().getRequest<Request & { usuario?: Usuario }>();
    const usuario = request.usuario;

    if (!usuario) {
      throw new ForbiddenException('No se pudo identificar quién está pidiendo esto.');
    }

    if (requeridos.length === 0) {
      // Ni permisos ni SoloAutenticado: el endpoint no declaró nada. Es un
      // descuido del código, no del usuario, y el mensaje lo dice así para que
      // quien lo vea sepa dónde mirar.
      throw new ForbiddenException(
        'Este endpoint no declara qué permiso necesita, así que el sistema no lo habilita. ' +
          'Es un error de configuración: avisá a quien mantiene el sistema.',
      );
    }

    const delUsuario = await this.permisos.permisosDe(usuario.rol);
    if (!puede([...delUsuario], requeridos)) {
      const faltan = requeridos
        .filter((p) => !delUsuario.has(p))
        .map((p) => DESCRIPCION_PERMISOS[p]?.etiqueta ?? p);
      throw new ForbiddenException(
        `Tu rol no tiene permiso para esto: ${faltan.join(', ')}. ` +
          'Si lo necesitás, pedíselo al administrador.',
      );
    }
    return true;
  }
}
