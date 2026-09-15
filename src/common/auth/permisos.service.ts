import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISOS, PRESETS, Permiso, esPermisoConocido } from './permisos';

/**
 * Qué puede hacer cada rol, leído de la base.
 *
 * Se guarda en memoria porque lo consulta cada pedido que entra al sistema, y
 * son cuatro filas por rol: ir a la base en cada uno sería pagar un viaje para
 * traer siempre lo mismo. El cache se limpia solo cuando alguien cambia los
 * permisos desde la pantalla, así que el cambio se ve en el momento.
 */
@Injectable()
export class PermisosService implements OnModuleInit {
  private readonly logger = new Logger(PermisosService.name);
  private cache: Map<RolUsuario, Set<string>> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Al arrancar, deja el sistema en un estado usable sin pisar lo configurado.
   *
   * Dos reglas, y ninguna adivina nada:
   *
   * 1. El administrador SIEMPRE tiene todos los permisos. Es lo que significa
   *    ser administrador, y es lo que hace que una función nueva no quede sin
   *    nadie que pueda usarla ni repartirla.
   * 2. Los demás roles se siembran UNA vez, la primera. Después mandan ellos:
   *    si alguien le sacó a gerencia el acceso a informática, el arranque
   *    siguiente no se lo devuelve.
   *
   * La consecuencia de la regla 2 hay que tenerla presente: un permiso nuevo no
   * les llega solo a los roles que ya existen. Se lo da el administrador desde
   * la pantalla, que es donde se ve qué significa.
   */
  async onModuleInit(): Promise<void> {
    const existentes = await this.prisma.permisoRol.findMany();
    const yaTiene = new Set(existentes.map((p) => `${p.rol}:${p.permiso}`));
    const rolesConfigurados = new Set(existentes.map((p) => p.rol as string));

    const faltantes: { rol: RolUsuario; permiso: string }[] = [];
    for (const [rol, permisos] of Object.entries(PRESETS)) {
      const esAdmin = rol === RolUsuario.ADMIN;
      if (!esAdmin && rolesConfigurados.has(rol)) continue;

      for (const permiso of permisos) {
        if (yaTiene.has(`${rol}:${permiso}`)) continue;
        faltantes.push({ rol: rol as RolUsuario, permiso });
      }
    }

    if (faltantes.length > 0) {
      await this.prisma.permisoRol.createMany({ data: faltantes, skipDuplicates: true });
      this.logger.log(`Permisos sembrados: ${faltantes.length} fila(s).`);
    }
    this.cache = null;
  }

  /** Los permisos de un rol. */
  async permisosDe(rol: RolUsuario): Promise<Set<string>> {
    if (!this.cache) {
      const filas = await this.prisma.permisoRol.findMany();
      const mapa = new Map<RolUsuario, Set<string>>();
      for (const f of filas) {
        // Una fila con un permiso que ya no existe en el código se ignora: pasa
        // si se renombra uno y queda la fila vieja.
        if (!esPermisoConocido(f.permiso)) continue;
        if (!mapa.has(f.rol)) mapa.set(f.rol, new Set());
        mapa.get(f.rol)!.add(f.permiso);
      }
      this.cache = mapa;
    }
    return this.cache.get(rol) ?? new Set();
  }

  /** Todos los roles con sus permisos, para la pantalla de administración. */
  async porRol(): Promise<Record<string, string[]>> {
    const filas = await this.prisma.permisoRol.findMany({ orderBy: [{ rol: 'asc' }] });
    const mapa: Record<string, string[]> = {};
    for (const rol of Object.values(RolUsuario)) mapa[rol] = [];
    for (const f of filas) {
      if (esPermisoConocido(f.permiso)) mapa[f.rol].push(f.permiso);
    }
    return mapa;
  }

  /**
   * Reemplaza los permisos de un rol por los que se pasan.
   *
   * El administrador nunca queda sin la llave. Sin esto, desmarcar el permiso
   * de administrar permisos siendo el único administrador dejaría el sistema
   * sin nadie que pueda volver a habilitarlo: habría que arreglarlo a mano en
   * la base.
   */
  async guardar(rol: RolUsuario, permisos: Permiso[]): Promise<string[]> {
    const limpios = [...new Set(permisos.filter(esPermisoConocido))];

    if (rol === RolUsuario.ADMIN && !limpios.includes(PERMISOS.PERMISOS_ADMINISTRAR)) {
      limpios.push(PERMISOS.PERMISOS_ADMINISTRAR);
    }

    await this.prisma.$transaction([
      this.prisma.permisoRol.deleteMany({ where: { rol } }),
      this.prisma.permisoRol.createMany({
        data: limpios.map((permiso) => ({ rol, permiso })),
        skipDuplicates: true,
      }),
    ]);

    // Se limpia acá y no al leer: el cambio tiene que verse en el pedido
    // siguiente, no cuando venza un plazo.
    this.cache = null;
    return limpios;
  }
}
