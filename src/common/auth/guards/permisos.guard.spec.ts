import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import { CLAVE_AUTENTICADO, CLAVE_PERMISOS } from '../decorators/permisos.decorator';
import { CLAVE_PUBLICO } from '../decorators/public.decorator';
import { PERMISOS } from '../permisos';
import { PermisosService } from '../permisos.service';
import { GuardPermisos } from './permisos.guard';

/**
 * El guard que decide quién entra.
 *
 * Lo que se protege acá es que falle CERRADO. Antes era al revés: un endpoint
 * que no declaraba nada quedaba abierto, y por eso alcanzaba con olvidarse un
 * decorador para que cualquiera pudiera escribir.
 */
function armar(opciones: {
  metadata?: Record<string, unknown>;
  usuario?: { rol: RolUsuario } | null;
  permisosDelRol?: string[];
  authDisabled?: boolean;
}) {
  const reflector = {
    getAllAndOverride: jest.fn((clave: string) => opciones.metadata?.[clave]),
  } as unknown as Reflector;

  const config = {
    get: jest.fn((clave: string) =>
      clave === 'AUTH_DISABLED' ? String(opciones.authDisabled ?? false) : undefined,
    ),
  } as unknown as ConfigService;

  const permisos = {
    permisosDe: jest.fn(async () => new Set(opciones.permisosDelRol ?? [])),
  } as unknown as PermisosService;

  const contexto = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ usuario: opciones.usuario ?? undefined }) }),
  } as unknown as ExecutionContext;

  return { guard: new GuardPermisos(reflector, config, permisos), contexto, permisos };
}

const ADMIN = { rol: RolUsuario.ADMIN };
const GERENCIA = { rol: RolUsuario.GERENCIA };

describe('GuardPermisos', () => {
  it('REGRESION: un endpoint que no declara nada NO pasa, ni siendo administrador', async () => {
    // Es el cambio de fondo. El olvido se convierte en "nadie puede usar esto"
    // en vez de "cualquiera puede escribir", que es el error que se prefiere.
    const { guard, contexto } = armar({ metadata: {}, usuario: ADMIN });
    await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el mensaje de ese caso apunta al codigo, no al usuario', async () => {
    // Quien lo vea tiene que saber que es un error de configuracion y no que
    // le falta un permiso, o va a pedirselo al administrador para siempre.
    const { guard, contexto } = armar({ metadata: {}, usuario: ADMIN });
    await expect(guard.canActivate(contexto)).rejects.toThrow(/error de configuración/);
  });

  it('deja pasar lo que el rol tiene permitido', async () => {
    const { guard, contexto } = armar({
      metadata: { [CLAVE_PERMISOS]: [PERMISOS.ORDENES_VER] },
      usuario: GERENCIA,
      permisosDelRol: [PERMISOS.ORDENES_VER, PERMISOS.MATERIALES_VER],
    });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it('REGRESION: frena lo que el rol NO tiene permitido', async () => {
    const { guard, contexto } = armar({
      metadata: { [CLAVE_PERMISOS]: [PERMISOS.ORDENES_EDITAR] },
      usuario: GERENCIA,
      permisosDelRol: [PERMISOS.ORDENES_VER],
    });
    await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el error dice QUE permiso falta, en castellano', async () => {
    const { guard, contexto } = armar({
      metadata: { [CLAVE_PERMISOS]: [PERMISOS.ORDENES_RECIBIR] },
      usuario: GERENCIA,
      permisosDelRol: [PERMISOS.ORDENES_VER],
    });
    await expect(guard.canActivate(contexto)).rejects.toThrow(/Dar por recibida una orden/);
  });

  it('pide TODOS los permisos declarados, no alguno', async () => {
    const { guard, contexto } = armar({
      metadata: { [CLAVE_PERMISOS]: [PERMISOS.ORDENES_RECIBIR, PERMISOS.MOVIMIENTOS_CREAR] },
      usuario: GERENCIA,
      permisosDelRol: [PERMISOS.ORDENES_RECIBIR],
    });
    await expect(guard.canActivate(contexto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lo marcado como publico no pasa por los permisos', async () => {
    // Es el disparador de avisos: lo llama una maquina con su propio token, y
    // no hay usuario del que mirar el rol.
    const { guard, contexto, permisos } = armar({
      metadata: { [CLAVE_PUBLICO]: true },
      usuario: null,
    });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(permisos.permisosDe).not.toHaveBeenCalled();
  });

  it('lo marcado como solo autenticado pasa sin mirar permisos', async () => {
    // Preguntarse "quien soy" y "que puedo hacer" no puede depender de un
    // permiso: sin esto, alguien sin permisos no podria ni enterarse.
    const { guard, contexto, permisos } = armar({
      metadata: { [CLAVE_AUTENTICADO]: true },
      usuario: GERENCIA,
    });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(permisos.permisosDe).not.toHaveBeenCalled();
  });

  it('sin usuario identificado, no pasa', async () => {
    const { guard, contexto } = armar({
      metadata: { [CLAVE_PERMISOS]: [PERMISOS.ORDENES_VER] },
      usuario: null,
    });
    await expect(guard.canActivate(contexto)).rejects.toThrow(/identificar/);
  });

  it('con la autenticacion desactivada queda abierto, como en desarrollo', async () => {
    const { guard, contexto } = armar({
      metadata: { [CLAVE_PERMISOS]: [PERMISOS.ORDENES_VER] },
      usuario: null,
      authDisabled: true,
    });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
  });

  it('REGRESION: AUTH_DISABLED solo vale con el texto exacto "true"', async () => {
    // Falla cerrado: cualquier otra cosa mantiene los permisos activos.
    const reflector = {
      getAllAndOverride: jest.fn((c: string) =>
        c === CLAVE_PERMISOS ? [PERMISOS.ORDENES_VER] : undefined,
      ),
    } as unknown as Reflector;
    const config = { get: jest.fn(() => 'TRUE') } as unknown as ConfigService;
    const permisos = {
      permisosDe: jest.fn(async () => new Set<string>()),
    } as unknown as PermisosService;
    const contexto = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ usuario: GERENCIA }) }),
    } as unknown as ExecutionContext;

    await expect(
      new GuardPermisos(reflector, config, permisos).canActivate(contexto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
