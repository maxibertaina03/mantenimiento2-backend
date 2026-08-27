import { ForbiddenException } from '@nestjs/common';
import { RolUsuario, Usuario } from '@prisma/client';
import { GuardRoles } from './roles.guard';

function contexto(usuario?: Partial<Usuario>) {
  const request: any = { headers: {}, usuario };
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

function armar(opciones: { roles?: RolUsuario[]; authDisabled?: string } = {}) {
  const reflector = {
    getAllAndOverride: jest.fn(() => opciones.roles),
  } as any;
  const config = {
    get: jest.fn(() => opciones.authDisabled ?? 'false'),
  } as any;
  return new GuardRoles(reflector, config);
}

describe('GuardRoles', () => {
  it('deja pasar los endpoints que no declaran @Roles', () => {
    const guard = armar({ roles: undefined });
    expect(guard.canActivate(contexto())).toBe(true);
  });

  it('deja pasar si @Roles viene vacío', () => {
    const guard = armar({ roles: [] });
    expect(guard.canActivate(contexto())).toBe(true);
  });

  it('un ADMIN accede a un endpoint de ADMIN', () => {
    const guard = armar({ roles: [RolUsuario.ADMIN] });
    expect(guard.canActivate(contexto({ rol: RolUsuario.ADMIN }))).toBe(true);
  });

  it('REGRESION: un OPERARIO NO accede a un endpoint de ADMIN', () => {
    const guard = armar({ roles: [RolUsuario.ADMIN] });
    expect(() => guard.canActivate(contexto({ rol: RolUsuario.OPERARIO }))).toThrow(
      ForbiddenException,
    );
  });

  it('REGRESION: sin usuario en la request tampoco pasa (falla cerrado)', () => {
    const guard = armar({ roles: [RolUsuario.ADMIN] });
    expect(() => guard.canActivate(contexto(undefined))).toThrow(ForbiddenException);
  });

  it('el mensaje dice qué rol hace falta', () => {
    const guard = armar({ roles: [RolUsuario.ADMIN] });
    expect(() => guard.canActivate(contexto({ rol: RolUsuario.OPERARIO }))).toThrow(/ADMIN/);
  });

  it('respeta el escape hatch AUTH_DISABLED=true (dev sin auth)', () => {
    const guard = armar({ roles: [RolUsuario.ADMIN], authDisabled: 'true' });
    expect(guard.canActivate(contexto(undefined))).toBe(true);
  });

  it('AUTH_DISABLED solo acepta el string "true" exacto', () => {
    for (const valor of ['false', 'TRUE', '1', '']) {
      const guard = armar({ roles: [RolUsuario.ADMIN], authDisabled: valor });
      expect(() => guard.canActivate(contexto(undefined))).toThrow(ForbiddenException);
    }
  });

  it('acepta cualquiera de varios roles declarados', () => {
    const guard = armar({ roles: [RolUsuario.ADMIN, RolUsuario.OPERARIO] });
    expect(guard.canActivate(contexto({ rol: RolUsuario.OPERARIO }))).toBe(true);
    expect(guard.canActivate(contexto({ rol: RolUsuario.ADMIN }))).toBe(true);
  });
});
