import { RolUsuario } from '@prisma/client';
import { PERMISOS, TODOS_LOS_PERMISOS } from './permisos';
import { PermisosService } from './permisos.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Los permisos guardados, y la siembra al arrancar.
 *
 * Lo que se protege acá es que la pantalla mande sobre el codigo: si alguien le
 * saca un permiso a un rol, el arranque siguiente NO se lo devuelve. Sin eso,
 * cada reinicio pisaria lo que el administrador configuro y nadie entenderia
 * por que.
 */
function armar(filasIniciales: { rol: RolUsuario; permiso: string }[] = []) {
  let filas = [...filasIniciales];

  const permisoRol = {
    findMany: jest.fn<Promise<any>, any[]>(async (args?: any) =>
      args?.where?.rol ? filas.filter((f) => f.rol === args.where.rol) : [...filas],
    ),
    createMany: jest.fn<Promise<any>, any[]>(async ({ data }: any) => {
      for (const d of data) {
        if (!filas.some((f) => f.rol === d.rol && f.permiso === d.permiso)) filas.push(d);
      }
      return { count: data.length };
    }),
    deleteMany: jest.fn<Promise<any>, any[]>(async ({ where }: any) => {
      filas = filas.filter((f) => f.rol !== where.rol);
      return { count: 0 };
    }),
  };

  const prisma = {
    permisoRol,
    // Ejecuta de verdad: asi se ejerce que guardar borre y vuelva a crear.
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  return { permisoRol, filas: () => filas, service: new PermisosService(prisma) };
}

describe('PermisosService', () => {
  describe('siembra al arrancar', () => {
    it('con la base vacia, reparte los presets', async () => {
      const { service, filas } = armar();
      await service.onModuleInit();

      const admin = filas().filter((f) => f.rol === 'ADMIN');
      expect(admin).toHaveLength(TODOS_LOS_PERMISOS.length);
      expect(filas().filter((f) => f.rol === 'ADMINISTRATIVO')).toHaveLength(1);
    });

    it('REGRESION: no devuelve un permiso que el administrador saco', async () => {
      // Es lo que hace que la pantalla mande de verdad. Sin esto, desmarcarle a
      // gerencia el acceso a informatica duraba hasta el proximo reinicio.
      const configurado = TODOS_LOS_PERMISOS.filter((p) => p !== PERMISOS.IT_VER).map((p) => ({
        rol: RolUsuario.GERENCIA,
        permiso: p,
      }));
      const { service, filas } = armar(configurado);
      await service.onModuleInit();

      const gerencia = filas().filter((f) => f.rol === 'GERENCIA');
      expect(gerencia.some((f) => f.permiso === PERMISOS.IT_VER)).toBe(false);
    });

    it('REGRESION: un permiso nuevo siempre le llega al administrador', async () => {
      // Sin esto, una funcion nueva quedaria sin nadie que pueda usarla ni
      // repartirla, y habria que arreglarlo a mano en la base.
      const viejo = TODOS_LOS_PERMISOS.filter((p) => p !== PERMISOS.CATALOGOS_VER).map((p) => ({
        rol: RolUsuario.ADMIN,
        permiso: p,
      }));
      const { service, filas } = armar(viejo);
      await service.onModuleInit();

      const admin = filas().filter((f) => f.rol === 'ADMIN');
      expect(admin.some((f) => f.permiso === PERMISOS.CATALOGOS_VER)).toBe(true);
    });

    it('a los demas roles NO les llega solo: se lo da el administrador', async () => {
      // Es la contracara de no pisar lo configurado. Se prefiere que falte un
      // permiso, que se ve y se arregla en un clic, a que aparezca uno que
      // alguien habia sacado a proposito.
      const { service, filas } = armar([
        { rol: RolUsuario.GERENCIA, permiso: PERMISOS.ORDENES_VER },
      ]);
      await service.onModuleInit();

      expect(filas().filter((f) => f.rol === 'GERENCIA')).toHaveLength(1);
    });

    it('arrancar dos veces no duplica nada', async () => {
      const { service, filas } = armar();
      await service.onModuleInit();
      const despuesDeUna = filas().length;
      await service.onModuleInit();
      expect(filas()).toHaveLength(despuesDeUna);
    });
  });

  describe('guardar', () => {
    it('reemplaza los permisos del rol', async () => {
      const { service, permisoRol } = armar();
      await service.guardar(RolUsuario.ADMINISTRATIVO, [
        PERMISOS.ORDENES_VER,
        PERMISOS.PROVEEDORES_VER,
      ]);

      expect(permisoRol.deleteMany).toHaveBeenCalledWith({
        where: { rol: RolUsuario.ADMINISTRATIVO },
      });
      expect(permisoRol.createMany.mock.calls[0][0].data).toHaveLength(2);
    });

    it('REGRESION: al administrador no se le puede sacar la llave', async () => {
      // Sin esto, desmarcar "cambiar permisos" siendo el unico administrador
      // dejaba el sistema sin nadie que pudiera volver a habilitarlo: habria que
      // arreglarlo a mano en la base.
      const { service } = armar();
      const guardados = await service.guardar(RolUsuario.ADMIN, [PERMISOS.ORDENES_VER]);
      expect(guardados).toContain(PERMISOS.PERMISOS_ADMINISTRAR);
    });

    it('a otro rol si se le puede sacar', async () => {
      const { service } = armar();
      const guardados = await service.guardar(RolUsuario.GERENCIA, [PERMISOS.ORDENES_VER]);
      expect(guardados).toEqual([PERMISOS.ORDENES_VER]);
    });

    it('ignora un permiso que no existe', async () => {
      // Pasa si alguien manda algo a mano, o si queda una fila de un permiso
      // renombrado.
      const { service } = armar();
      const guardados = await service.guardar(RolUsuario.GERENCIA, [
        PERMISOS.ORDENES_VER,
        'materiales.destruir' as never,
      ]);
      expect(guardados).toEqual([PERMISOS.ORDENES_VER]);
    });

    it('no guarda el mismo permiso dos veces', async () => {
      const { service } = armar();
      const guardados = await service.guardar(RolUsuario.GERENCIA, [
        PERMISOS.ORDENES_VER,
        PERMISOS.ORDENES_VER,
      ]);
      expect(guardados).toHaveLength(1);
    });
  });

  describe('lectura', () => {
    it('REGRESION: el cambio se ve en el pedido siguiente', async () => {
      // Si el cache no se limpiara al guardar, sacarle un permiso a alguien no
      // tendria efecto hasta reiniciar el servidor, y nadie lo entenderia.
      const { service } = armar([{ rol: RolUsuario.GERENCIA, permiso: PERMISOS.ORDENES_VER }]);
      expect(await service.permisosDe(RolUsuario.GERENCIA)).toEqual(
        new Set([PERMISOS.ORDENES_VER]),
      );

      await service.guardar(RolUsuario.GERENCIA, [PERMISOS.MATERIALES_VER]);
      expect(await service.permisosDe(RolUsuario.GERENCIA)).toEqual(
        new Set([PERMISOS.MATERIALES_VER]),
      );
    });

    it('lee la base una sola vez mientras nada cambie', async () => {
      const { service, permisoRol } = armar([
        { rol: RolUsuario.GERENCIA, permiso: PERMISOS.ORDENES_VER },
      ]);
      await service.permisosDe(RolUsuario.GERENCIA);
      await service.permisosDe(RolUsuario.GERENCIA);
      await service.permisosDe(RolUsuario.ADMIN);
      expect(permisoRol.findMany).toHaveBeenCalledTimes(1);
    });

    it('un rol sin filas no tiene permisos, no falla', async () => {
      const { service } = armar();
      expect(await service.permisosDe(RolUsuario.ADMINISTRATIVO)).toEqual(new Set());
    });

    it('ignora una fila con un permiso que ya no existe', async () => {
      const { service } = armar([
        { rol: RolUsuario.GERENCIA, permiso: PERMISOS.ORDENES_VER },
        { rol: RolUsuario.GERENCIA, permiso: 'materiales.destruir' },
      ]);
      expect(await service.permisosDe(RolUsuario.GERENCIA)).toEqual(
        new Set([PERMISOS.ORDENES_VER]),
      );
    });
  });
});
