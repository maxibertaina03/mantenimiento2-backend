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
    equiposIt: [] as any[],
    asignacionesIt: [] as any[],
    ordenes: [] as any[],
    renglones: [] as any[],
    contadores: [] as any[],
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
      salida.material = m ? { nombre: m.nombre, unidad: m.unidad } : null;
    }
    if (include.proveedor) {
      const p = db.proveedores.find((x) => x.id === fila.proveedorId);
      salida.proveedor = p ? { nombre: p.nombre, cuit: p.cuit ?? null } : null;
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
    if (include.asignadoA) {
      const u = db.usuarios.find((x) => x.id === fila.asignadoAId);
      salida.asignadoA = u ? { nombre: u.nombre } : null;
    }
    if (include.creadoPor) {
      const u = db.usuarios.find((x) => x.id === fila.creadoPorId);
      salida.creadoPor = u ? { nombre: u.nombre } : null;
    }
    if (include.recibidaPor) {
      const u = db.usuarios.find((x) => x.id === fila.recibidaPorId);
      salida.recibidaPor = u ? { nombre: u.nombre } : null;
    }
    if (include.registradoPor) {
      const u = db.usuarios.find((x) => x.id === fila.registradoPorId);
      salida.registradoPor = u ? { nombre: u.nombre } : null;
    }
    if (include.renglones) {
      salida.renglones = db.renglones
        .filter((r) => r.ordenId === fila.id)
        .map((r) => hidratar(r, include.renglones.include));
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
        // `create` anidado (ej: orden con sus renglones) se resuelve aparte.
        const anidados: [string, any[]][] = [];
        const plano: any = {};
        for (const [k, v] of Object.entries(data ?? {})) {
          if (v && typeof v === 'object' && 'create' in (v as any)) {
            anidados.push([k, (v as any).create]);
          } else {
            plano[k] = v;
          }
        }
        const fila = {
          id: plano.id ?? nuevoId(),
          creadoEn: new Date(),
          actualizadoEn: new Date(),
          ...defaults(),
          ...aplanarConnect(plano),
        };
        coleccion.push(fila);
        for (const [campo, hijos] of anidados) {
          const destino = coleccionHija(campo);
          for (const hijo of Array.isArray(hijos) ? hijos : [hijos]) {
            destino.push({
              id: nuevoId(),
              creadoEn: new Date(),
              [clavePadre(campo)]: fila.id,
              ...hijo,
            });
          }
        }
        return hidratar(fila, include);
      },
      createMany: async ({ data }: any) => {
        for (const d of data) {
          coleccion.push({ id: nuevoId(), creadoEn: new Date(), ...defaults(), ...d });
        }
        return { count: data.length };
      },
      updateMany: async ({ where, data }: any) => {
        const filas = coleccion.filter((f) => coincide(f, where));
        for (const f of filas) Object.assign(f, data);
        return { count: filas.length };
      },
      deleteMany: async ({ where }: any = {}) => {
        const quedan = coleccion.filter((f) => !coincide(f, where));
        const borradas = coleccion.length - quedan.length;
        coleccion.length = 0;
        coleccion.push(...quedan);
        return { count: borradas };
      },
      groupBy: async ({ by }: any) => {
        const grupos = new Map<string, number>();
        for (const f of coleccion) {
          const clave = by.map((c: string) => f[c]).join('|');
          grupos.set(clave, (grupos.get(clave) ?? 0) + 1);
        }
        return [...grupos].map(([clave, cantidad]) => {
          const partes = clave.split('|');
          const fila: any = { _count: { _all: cantidad } };
          by.forEach((c: string, i: number) => (fila[c] = partes[i]));
          return fila;
        });
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

  /** Colección donde viven los hijos de un `create` anidado. */
  function coleccionHija(campo: string): any[] {
    if (campo === 'renglones') return db.renglones;
    if (campo === 'asignaciones') return db.asignacionesIt;
    throw new Error(`create anidado no soportado en el fake: ${campo}`);
  }

  /** Campo con el que el hijo apunta al padre. */
  function clavePadre(campo: string): string {
    if (campo === 'renglones') return 'ordenId';
    if (campo === 'asignaciones') return 'equipoId';
    throw new Error(`create anidado no soportado en el fake: ${campo}`);
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

    equipoIT: delegate(db.equiposIt, () => ({
      codigoInterno: null,
      estado: 'EN_DEPOSITO',
      numeroSerie: null,
      procesador: null,
      memoriaRamGb: null,
      discoTipo: null,
      discoCapacidadGb: null,
      sistemaOperativo: null,
      direccionIp: null,
      direccionMac: null,
      nombreEnRed: null,
      accesoRemoto: 'NINGUNO',
      accesoRemotoId: null,
      ubicacion: null,
      proveedorId: null,
      fechaCompra: null,
      garantiaHasta: null,
      notas: null,
      asignadoAId: null,
    })),
    asignacionEquipoIT: delegate(db.asignacionesIt, () => ({
      usuarioId: null,
      registradoPorId: null,
      desde: new Date(),
      hasta: null,
      motivo: null,
      notas: null,
    })),
    ordenCompra: delegate(db.ordenes, () => ({
      estado: 'BORRADOR',
      fecha: new Date(),
      fechaEntregaEstimada: null,
      observaciones: null,
      creadoPorId: null,
      emitidaEn: null,
      recibidaEn: null,
      recibidaPorId: null,
    })),
    renglonOrdenCompra: delegate(db.renglones, () => ({
      precioUnitario: null,
      notas: null,
      movimientoId: null,
    })),

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
    // Numeracion correlativa de documentos (INSERT ... ON CONFLICT DO UPDATE).
    if (/contadores_documento/.test(sql)) {
      const clave = valores[0];
      let fila = db.contadores.find((c) => c.clave === clave);
      if (!fila) {
        fila = { clave, ultimo: 0 };
        db.contadores.push(fila);
      }
      fila.ultimo += 1;
      return [{ ultimo: fila.ultimo }];
    }
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
