import {
  DESCRIPCION_PERMISOS,
  PERMISOS,
  PERMISOS_DE_LECTURA,
  PRESETS,
  TODOS_LOS_PERMISOS,
  esPermisoConocido,
  puede,
} from './permisos';

/**
 * La lista de permisos y los roles con los que arranca el sistema.
 *
 * Lo que se prueba acá es lo que el usuario pidio en palabras: que gerencia vea
 * todo y no toque nada, que administrativo solo vea ordenes, y que
 * mantenimiento pueda cargar movimientos.
 */
describe('la lista de permisos', () => {
  it('no tiene dos permisos con el mismo nombre', () => {
    expect(new Set(TODOS_LOS_PERMISOS).size).toBe(TODOS_LOS_PERMISOS.length);
  });

  it('REGRESION: todos tienen etiqueta para la pantalla', () => {
    // Sin esto, un permiso nuevo aparece en la pantalla con su nombre tecnico
    // y nadie sabe que hace.
    for (const p of TODOS_LOS_PERMISOS) {
      expect(DESCRIPCION_PERMISOS[p]?.etiqueta).toBeTruthy();
      expect(DESCRIPCION_PERMISOS[p]?.grupo).toBeTruthy();
    }
  });

  it('reconoce un permiso que no existe', () => {
    expect(esPermisoConocido('materiales.ver')).toBe(true);
    expect(esPermisoConocido('materiales.destruir')).toBe(false);
  });
});

describe('puede', () => {
  it('sin permisos requeridos, pasa', () => {
    expect(puede([], [])).toBe(true);
  });

  it('REGRESION: pide TODOS los declarados, no alguno', () => {
    // Un endpoint que declara dos esta diciendo que hacen falta los dos.
    const requeridos = [PERMISOS.ORDENES_RECIBIR, PERMISOS.MOVIMIENTOS_CREAR];
    expect(puede([PERMISOS.ORDENES_RECIBIR], requeridos)).toBe(false);
    expect(puede([PERMISOS.ORDENES_RECIBIR, PERMISOS.MOVIMIENTOS_CREAR], requeridos)).toBe(true);
  });

  it('sin ningun permiso no pasa nada que pida algo', () => {
    expect(puede([], [PERMISOS.MATERIALES_VER])).toBe(false);
  });
});

describe('los roles con los que arranca', () => {
  it('el administrador tiene todo', () => {
    expect(PRESETS.ADMIN).toHaveLength(TODOS_LOS_PERMISOS.length);
  });

  it('REGRESION: gerencia no puede escribir nada', () => {
    // Es lo que se pidio: solo lectura. Si algun dia entra un permiso de
    // escritura a esta lista, este test lo frena.
    for (const p of PRESETS.GERENCIA) {
      expect(PERMISOS_DE_LECTURA).toContain(p);
    }
    expect(puede(PRESETS.GERENCIA, [PERMISOS.MATERIALES_EDITAR])).toBe(false);
    expect(puede(PRESETS.GERENCIA, [PERMISOS.MOVIMIENTOS_CREAR])).toBe(false);
    expect(puede(PRESETS.GERENCIA, [PERMISOS.ORDENES_RECIBIR])).toBe(false);
    expect(puede(PRESETS.GERENCIA, [PERMISOS.USUARIOS_ADMINISTRAR])).toBe(false);
  });

  it('gerencia si ve todo, incluidas las contrasenas', () => {
    expect(puede(PRESETS.GERENCIA, [PERMISOS.MATERIALES_VER])).toBe(true);
    expect(puede(PRESETS.GERENCIA, [PERMISOS.ORDENES_VER])).toBe(true);
    expect(puede(PRESETS.GERENCIA, [PERMISOS.IT_VER])).toBe(true);
    expect(puede(PRESETS.GERENCIA, [PERMISOS.CREDENCIALES_REVELAR])).toBe(true);
  });

  it('REGRESION: administrativo SOLO ve ordenes', () => {
    expect(PRESETS.ADMINISTRATIVO).toEqual([PERMISOS.ORDENES_VER]);
    expect(puede(PRESETS.ADMINISTRATIVO, [PERMISOS.MATERIALES_VER])).toBe(false);
    expect(puede(PRESETS.ADMINISTRATIVO, [PERMISOS.ORDENES_EDITAR])).toBe(false);
    expect(puede(PRESETS.ADMINISTRATIVO, [PERMISOS.CREDENCIALES_VER])).toBe(false);
  });

  it('mantenimiento puede cargar movimientos y mirar lo que necesita', () => {
    expect(puede(PRESETS.MANTENIMIENTO, [PERMISOS.MOVIMIENTOS_CREAR])).toBe(true);
    expect(puede(PRESETS.MANTENIMIENTO, [PERMISOS.MATERIALES_VER])).toBe(true);
    expect(puede(PRESETS.MANTENIMIENTO, [PERMISOS.ORDENES_VER])).toBe(true);
  });

  it('REGRESION: mantenimiento no administra ni ve contrasenas', () => {
    expect(puede(PRESETS.MANTENIMIENTO, [PERMISOS.USUARIOS_ADMINISTRAR])).toBe(false);
    expect(puede(PRESETS.MANTENIMIENTO, [PERMISOS.CREDENCIALES_VER])).toBe(false);
    expect(puede(PRESETS.MANTENIMIENTO, [PERMISOS.IT_VER])).toBe(false);
    expect(puede(PRESETS.MANTENIMIENTO, [PERMISOS.MATERIALES_EDITAR])).toBe(false);
  });

  it('REGRESION: solo el administrador puede cambiar los permisos', () => {
    // Es la llave de todas las demas: si otro rol la tuviera, podria darse a si
    // mismo cualquier permiso y los roles dejarian de significar nada.
    for (const [rol, permisos] of Object.entries(PRESETS)) {
      if (rol === 'ADMIN') continue;
      expect(permisos).not.toContain(PERMISOS.PERMISOS_ADMINISTRAR);
    }
  });
});
