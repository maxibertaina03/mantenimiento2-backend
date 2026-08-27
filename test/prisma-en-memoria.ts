import { Prisma } from '@prisma/client';
import { aDecimal } from '../src/common/dominio/decimal';

/**
 * Implementación en memoria de la porción de PrismaClient que usa la app.
 *
 * Permite correr los E2E contra la app REAL (pipes, guards, filtros de excepción,
 * routing y serialización incluidos) sin depender de una base Postgres levantada.
 */
export function crearPrismaEnMemoria() {
  const db = {
    materiales: [] as any[],
    categorias: [] as any[],
    proveedores: [] as any[],
    movimientos: [] as any[],
    usuarios: [] as any[],
    ediciones: [] as any[],
  };

  // Los DTO validan @IsUUID(), asi que los ids generados deben tener forma de
  // UUID v4 real. El contador es compartido por todas las colecciones.
  let secuencia = 0;
  const nuevoId = () =>
    `${(++secuencia).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;

  /** Filtro mínimo: igualdad, `contains` (insensitive), `in`, y rangos gte/lte. */
  function coincide(fila: any, where: any = {}): boolean {
    return Object.entries(where).every(([campo, cond]: [string, any]) => {
      if (campo === 'OR') return (cond as any[]).some((c) => coincide(fila, c));
      const valor = fila[campo];
      if (cond === null || cond === undefined) return true;
      if (typeof cond !== 'object') return valor === cond;
      if ('contains' in cond) {
        const texto = String(valor ?? '');
        const buscado = String(cond.contains);
        return cond.mode === 'insensitive'
          ? texto.toLowerCase().includes(buscado.toLowerCase())
          : texto.includes(buscado);
      }
      if ('in' in cond) return cond.in.includes(valor);
      if ('gte' in cond || 'lte' in cond) {
        const t = new Date(valor).getTime();
        if ('gte' in cond && t < new Date(cond.gte).getTime()) return false;
        if ('lte' in cond && t > new Date(cond.lte).getTime()) return false;
        return true;
      }
      return valor === cond;
    });
  }

  function ordenar(filas: any[], orderBy: any): any[] {
    if (!orderBy) return filas;
    const criterios = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...filas].sort((a, b) => {
      for (const criterio of criterios) {
        const [campo, dir] = Object.entries(criterio)[0] as [string, string];
        const va = a[campo];
        const vb = b[campo];
        if (va === vb) continue;
        const menor = va < vb ? -1 : 1;
        return dir === 'desc' ? -menor : menor;
      }
      return 0;
    });
  }

  /** Adjunta las relaciones pedidas en `include`. */
  function hidratar(fila: any, include: any): any {
    if (!fila || !include) return fila;
    const salida = { ...fila };
    if (include.categoria) {
      salida.categoria = db.categorias.find((c) => c.id === fila.categoriaId) ?? null;
    }
    if (include.material) {
      const m = db.materiales.find((x) => x.id === fila.materialId);
      salida.material = m ? { nombre: m.nombre } : null;
    }
    if (include.proveedor) {
      const p = db.proveedores.find((x) => x.id === fila.proveedorId);
      salida.proveedor = p ? { nombre: p.nombre } : null;
    }
    if (include.usuario) {
      const u = db.usuarios.find((x) => x.id === fila.usuarioId);
      salida.usuario = u ? { nombre: u.nombre } : null;
    }
    if (include.movimientos) {
      salida.movimientos = ordenar(
        db.movimientos.filter((m) => m.materialId === fila.id),
        include.movimientos.orderBy,
      );
    }
    if (include._count?.select?.ediciones) {
      salida._count = { ediciones: db.ediciones.filter((e) => e.movimientoId === fila.id).length };
    }
    return salida;
  }

  /** Fábrica genérica de delegate Prisma sobre una colección. */
  function delegate(coleccion: any[], defaults: () => any = () => ({})) {
    return {
      create: async ({ data, include }: any) => {
        const fila = {
          id: data.id ?? nuevoId(),
          creadoEn: new Date(),
          actualizadoEn: new Date(),
          ...defaults(),
          ...aplanarConnect(data),
        };
        coleccion.push(fila);
        return hidratar(fila, include);
      },
      findMany: async ({ where, skip = 0, take, orderBy, include }: any = {}) => {
        const filtradas = ordenar(
          coleccion.filter((f) => coincide(f, where)),
          orderBy,
        );
        const pagina =
          take === undefined ? filtradas.slice(skip) : filtradas.slice(skip, skip + take);
        return pagina.map((f) => hidratar(f, include));
      },
      findUnique: async ({ where, include }: any) => {
        const fila = coleccion.find((f) => Object.entries(where).every(([k, v]) => f[k] === v));
        return fila ? hidratar(fila, include) : null;
      },
      findUniqueOrThrow: async ({ where, include }: any) => {
        const fila = coleccion.find((f) => Object.entries(where).every(([k, v]) => f[k] === v));
        if (!fila) throw new Error('No encontrado');
        return hidratar(fila, include);
      },
      count: async ({ where }: any = {}) => coleccion.filter((f) => coincide(f, where)).length,
      update: async ({ where, data, include }: any) => {
        const fila = coleccion.find((f) => f.id === where.id);
        if (!fila) throw new Error('No encontrado');
        Object.assign(fila, aplanarConnect(data), { actualizadoEn: new Date() });
        return hidratar(fila, include);
      },
      upsert: async ({ where, update, create }: any) => {
        const fila = coleccion.find((f) => Object.entries(where).every(([k, v]) => f[k] === v));
        if (fila) {
          Object.assign(fila, update, { actualizadoEn: new Date() });
          return fila;
        }
        const nueva = {
          id: nuevoId(),
          creadoEn: new Date(),
          actualizadoEn: new Date(),
          ...defaults(),
          ...create,
        };
        coleccion.push(nueva);
        return nueva;
      },
      delete: async ({ where }: any) => {
        const i = coleccion.findIndex((f) => f.id === where.id);
        if (i === -1) throw new Error('No encontrado');
        return coleccion.splice(i, 1)[0];
      },
    };
  }

  /** Traduce `{ categoria: { connect: { id } } }` a `{ categoriaId: id }`. */
  function aplanarConnect(data: any): any {
    const salida: any = {};
    for (const [k, v] of Object.entries(data ?? {})) {
      if (v && typeof v === 'object' && 'connect' in (v as any)) {
        salida[`${k}Id`] = (v as any).connect.id;
      } else if (v !== undefined) {
        salida[k] = v;
      }
    }
    return salida;
  }

  const prisma: any = {
    material: delegate(db.materiales, () => ({
      stockActual: aDecimal(0),
      stockMinimo: aDecimal(0),
      notas: null,
    })),
    categoriaMaterial: delegate(db.categorias, () => ({ descripcion: null })),
    proveedor: delegate(db.proveedores, () => ({
      cuit: null,
      email: null,
      telefono: null,
      notas: null,
    })),
    movimientoStock: delegate(db.movimientos, () => ({
      fecha: new Date(),
      proveedorId: null,
      usuarioId: null,
      referenciaTrabajo: null,
      notas: null,
    })),
    usuario: delegate(db.usuarios, () => ({ idExterno: null, rol: 'OPERARIO' })),
    edicionMovimiento: delegate(db.ediciones, () => ({ usuarioId: null })),

    // El repositorio usa SELECT ... FOR UPDATE para tomar lock del material.
    $queryRaw: async (fragmentos: TemplateStringsArray, ...valores: any[]) => {
      const sql = fragmentos.join('?');
      if (/FROM materiales/.test(sql)) {
        const material = db.materiales.find((m) => m.id === valores[0]);
        return material ? [{ stockActual: material.stockActual }] : [];
      }
      if (/SELECT id FROM materiales/.test(sql)) return [];
      return [];
    },
    $transaction: async (cb: any) => cb(prisma),
    $connect: async () => undefined,
    $disconnect: async () => undefined,
  };

  // buscarBajoStock usa $queryRaw con otra forma; la resolvemos aparte.
  const queryRawOriginal = prisma.$queryRaw;
  prisma.$queryRaw = async (fragmentos: TemplateStringsArray, ...valores: any[]) => {
    const sql = fragmentos.join('?');
    if (/stockActual"\s*<=\s*"stockMinimo/.test(sql)) {
      return db.materiales
        .filter(
          (m) =>
            aDecimal(m.stockMinimo).greaterThan(0) &&
            aDecimal(m.stockActual).lessThanOrEqualTo(aDecimal(m.stockMinimo)),
        )
        .map((m) => ({ id: m.id }));
    }
    return queryRawOriginal(fragmentos, ...valores);
  };

  return { prisma, db, nuevoId };
}

export type PrismaEnMemoria = ReturnType<typeof crearPrismaEnMemoria>;
export { Prisma };
