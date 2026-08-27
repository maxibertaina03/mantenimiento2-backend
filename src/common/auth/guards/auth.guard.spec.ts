import { UnauthorizedException } from '@nestjs/common';
import { RolUsuario, Usuario } from '@prisma/client';
import { GuardAutenticacion } from './auth.guard';
import { CacheUsuarios } from '../cache-usuarios';

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { verifyToken } = require('@clerk/backend') as { verifyToken: jest.Mock };

const usuario = {
  id: 'u-1',
  nombre: 'maxi',
  email: 'maxi@example.com',
  rol: RolUsuario.OPERARIO,
} as Usuario;

function contextoCon(headers: Record<string, string> = {}) {
  const request: any = { headers };
  return {
    request,
    ctx: {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as any,
  };
}

function armar(opciones: { authDisabled?: string; secretKey?: string; publico?: boolean } = {}) {
  const reflector = {
    getAllAndOverride: jest.fn(() => opciones.publico ?? false),
  } as any;

  const config = {
    get: jest.fn((clave: string) => {
      if (clave === 'AUTH_DISABLED') return opciones.authDisabled ?? 'false';
      if (clave === 'CLERK_SECRET_KEY') return opciones.secretKey ?? 'sk_test_xxx';
      return undefined;
    }),
  } as any;

  const usuarios = {
    buscarOCrearPorClerk: jest.fn(async () => usuario),
  } as any;

  const clerk = {
    users: {
      getUser: jest.fn(async () => ({
        id: 'clerk_1',
        username: 'maxi',
        firstName: 'Maximo',
        lastName: 'B',
        primaryEmailAddressId: 'e1',
        emailAddresses: [{ id: 'e1', emailAddress: 'maxi@example.com' }],
      })),
    },
  } as any;

  const cache = new CacheUsuarios();
  const guard = new GuardAutenticacion(reflector, config, usuarios, clerk, cache);
  return { guard, reflector, config, usuarios, clerk, cache };
}

beforeEach(() => {
  verifyToken.mockReset();
  verifyToken.mockResolvedValue({ sub: 'clerk_1' });
});

describe('GuardAutenticacion', () => {
  it('deja pasar las rutas @Public() sin token', async () => {
    const { guard } = armar({ publico: true });
    const { ctx } = contextoCon();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('deja pasar todo si AUTH_DISABLED=true (escape hatch de dev)', async () => {
    const { guard } = armar({ authDisabled: 'true' });
    const { ctx } = contextoCon();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('AUTH_DISABLED solo acepta el string "true" exacto (falla cerrado)', async () => {
    for (const valor of ['false', 'TRUE', '1', 'yes', '']) {
      const { guard } = armar({ authDisabled: valor });
      const { ctx } = contextoCon();
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('rechaza si no hay header Authorization', async () => {
    const { guard } = armar();
    const { ctx } = contextoCon();
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Falta el token/);
  });

  it('rechaza un esquema que no sea Bearer', async () => {
    const { guard } = armar();
    const { ctx } = contextoCon({ authorization: 'Basic dXNlcjpwYXNz' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Falta el token/);
  });

  it('rechaza un token invalido o expirado', async () => {
    verifyToken.mockRejectedValue(new Error('expirado'));
    const { guard } = armar();
    const { ctx } = contextoCon({ authorization: 'Bearer token-malo' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/inválido o expirado/);
  });

  it('rechaza si el servidor no tiene CLERK_SECRET_KEY configurada', async () => {
    const { guard } = armar({ secretKey: '' });
    const { ctx } = contextoCon({ authorization: 'Bearer x' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/no configurada/);
  });

  it('con token valido adjunta el usuario a la request', async () => {
    const { guard } = armar();
    const { ctx, request } = contextoCon({ authorization: 'Bearer token-bueno' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.usuario).toBe(usuario);
  });

  it('prefiere el username de Clerk para el nombre mostrado', async () => {
    const { guard, usuarios } = armar();
    const { ctx } = contextoCon({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(usuarios.buscarOCrearPorClerk.mock.calls[0][0].nombre).toBe('maxi');
  });

  it('sin username usa nombre y apellido', async () => {
    const { guard, usuarios, clerk } = armar();
    clerk.users.getUser.mockResolvedValue({
      username: null,
      firstName: 'Maximo',
      lastName: 'B',
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: 'maxi@example.com' }],
    });
    const { ctx } = contextoCon({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(usuarios.buscarOCrearPorClerk.mock.calls[0][0].nombre).toBe('Maximo B');
  });

  it('sin username ni nombre cae al email', async () => {
    const { guard, usuarios, clerk } = armar();
    clerk.users.getUser.mockResolvedValue({
      username: null,
      firstName: null,
      lastName: null,
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: 'maxi@example.com' }],
    });
    const { ctx } = contextoCon({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    expect(usuarios.buscarOCrearPorClerk.mock.calls[0][0].nombre).toBe('maxi@example.com');
  });

  it('rechaza a un usuario de Clerk sin email', async () => {
    const { guard, clerk } = armar();
    clerk.users.getUser.mockResolvedValue({
      username: 'x',
      emailAddresses: [],
      primaryEmailAddressId: null,
    });
    const { ctx } = contextoCon({ authorization: 'Bearer t' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/no tiene email/);
  });

  describe('cache de usuarios (escalabilidad)', () => {
    it('REGRESION: no llama a la API de Clerk en cada request', async () => {
      const { guard, clerk, usuarios } = armar();

      for (let i = 0; i < 5; i++) {
        const { ctx } = contextoCon({ authorization: 'Bearer token-bueno' });
        await guard.canActivate(ctx);
      }

      // Solo la primera request resuelve contra Clerk y la base.
      expect(clerk.users.getUser).toHaveBeenCalledTimes(1);
      expect(usuarios.buscarOCrearPorClerk).toHaveBeenCalledTimes(1);
    });

    it('el token se sigue verificando en TODAS las requests', async () => {
      const { guard } = armar();
      for (let i = 0; i < 5; i++) {
        const { ctx } = contextoCon({ authorization: 'Bearer token-bueno' });
        await guard.canActivate(ctx);
      }
      // La cache ahorra el lookup del perfil, nunca la verificacion de firma.
      expect(verifyToken).toHaveBeenCalledTimes(5);
    });

    it('un token invalido no se beneficia de la cache', async () => {
      const { guard } = armar();
      const { ctx } = contextoCon({ authorization: 'Bearer bueno' });
      await guard.canActivate(ctx);

      verifyToken.mockRejectedValue(new Error('firma invalida'));
      const { ctx: ctx2 } = contextoCon({ authorization: 'Bearer falsificado' });
      await expect(guard.canActivate(ctx2)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('usuarios distintos no se pisan entre si', async () => {
      const { guard, clerk } = armar();

      const { ctx } = contextoCon({ authorization: 'Bearer a' });
      await guard.canActivate(ctx);

      verifyToken.mockResolvedValue({ sub: 'clerk_2' });
      const { ctx: ctx2 } = contextoCon({ authorization: 'Bearer b' });
      await guard.canActivate(ctx2);

      expect(clerk.users.getUser).toHaveBeenCalledTimes(2);
    });
  });
});
