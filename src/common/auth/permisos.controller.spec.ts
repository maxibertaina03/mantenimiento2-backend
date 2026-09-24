import { RolUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import { PermisosController } from './permisos.controller';
import { PERMISOS } from './permisos';

/**
 * Lo que la pantalla pregunta para saber qué botones ofrecer.
 *
 * El caso que motivó estos tests: con AUTH_DISABLED, `usuarios/me` contestaba
 * ADMIN pero esto devolvia la lista vacia. El frontend se encontraba con un
 * administrador sin ningun permiso y escondia todo, asi que trabajar en local
 * mostraba "Tu rol no tiene acceso a esta seccion" en cada pantalla.
 *
 * Dos endpoints que se contradicen sobre quien sos es peor que cualquiera de
 * los dos comportamientos por separado.
 */
function armar(authDisabled: string | undefined, permisos: string[] = ['tareas.ver']) {
  const service = { permisosDe: jest.fn().mockResolvedValue(new Set(permisos)) };
  const config = { get: jest.fn().mockReturnValue(authDisabled) };
  return {
    controlador: new PermisosController(service as never, config as never),
    service,
  };
}

const UNO = { id: 'u1', rol: RolUsuario.MANTENIMIENTO } as Usuario;

describe('los permisos de quien esta mirando', () => {
  it('con sesion, devuelve los de su rol', async () => {
    const { controlador, service } = armar(undefined, ['tareas.ver']);

    const r = await controlador.mios(UNO);

    expect(r.rol).toBe(RolUsuario.MANTENIMIENTO);
    expect(r.permisos).toEqual(['tareas.ver']);
    expect(service.permisosDe).toHaveBeenCalledWith(RolUsuario.MANTENIMIENTO);
  });

  it('REGRESION: sin sesion y con AUTH_DISABLED, contesta ADMIN como usuarios/me', async () => {
    // Si esto devolviera vacio, en local no se podria ver ninguna pantalla.
    const { controlador, service } = armar('true', [PERMISOS.TAREAS_VER, PERMISOS.IT_VER]);

    const r = await controlador.mios(undefined);

    expect(r.rol).toBe(RolUsuario.ADMIN);
    expect(r.permisos).toContain(PERMISOS.TAREAS_VER);
    expect(service.permisosDe).toHaveBeenCalledWith(RolUsuario.ADMIN);
  });

  it('REGRESION: sin sesion y SIN AUTH_DISABLED, no da ningun permiso', async () => {
    // El caso de produccion. Que la puerta de atras se abra sola aca seria
    // entregarle la administracion a cualquiera que pegue sin token.
    const { controlador, service } = armar(undefined);

    const r = await controlador.mios(undefined);

    expect(r).toEqual({ rol: null, permisos: [] });
    expect(service.permisosDe).not.toHaveBeenCalled();
  });

  it('REGRESION: solo el valor exacto "true" abre el modo local', async () => {
    // La variable llega como texto. Sin la comparacion exacta, un "false"
    // —que es lo que hay en produccion— entraria por ser una cadena con
    // contenido, y seria el peor error posible de todo el sistema.
    for (const valor of ['false', 'TRUE', '1', 'si', '']) {
      const { controlador } = armar(valor);
      expect(await controlador.mios(undefined)).toEqual({ rol: null, permisos: [] });
    }
  });
});
