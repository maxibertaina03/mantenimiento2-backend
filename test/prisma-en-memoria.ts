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
    /**
     * Un usuario sembrado, para que los e2e puedan entrar como alguien.
     *
     * Hace falta porque varias reglas preguntan quien sos: revelar una
     * contrasenia sin usuario da 403, que es correcto, pero entonces no se
     * podria probar el camino normal. El guard lo encuentra por el email que
     * declara USUARIO_DEV en setup-e2e.ts.
     */
    usuarios: [
      {
        id: 'a0000001-0000-4000-8000-000000000001',
        nombre: 'Tester',
        email: 'tester@e2e.local',
        rol: 'ADMIN',
        idExterno: 'user_e2e',
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      },
    ] as any[],
    ediciones: [] as any[],
    equiposIt: [] as any[],
    asignacionesIt: [] as any[],
    ordenes: [] as any[],
    renglones: [] as any[],
    // Por dónde salió cada orden. Sin esto, registrar un WhatsApp daba 500.
    enviosOrden: [] as any[],
    // Los manuales en PDF de los equipos (el archivo va al almacén, no acá).
    manuales: [] as any[],
    contadores: [] as any[],
    permisosRol: [] as any[],
    // Marca, modelo y ubicacion dejaron de ser texto libre y pasaron a ser
    // catalogos compartidos con los equipos de planta. El fake no los tenia, y
    // por eso no se podia crear un equipo de informatica en un e2e.
    responsables: [] as any[],
    // Los equipos de PLANTA. Los de informatica son otra tabla (equiposIt).
    equipos: [] as any[],
    marcasEquipo: [] as any[],
    modelosEquipo: [] as any[],
    ubicacionesEquipo: [] as any[],
    credenciales: [] as any[],
    rotacionesCredencial: [] as any[],
    vistasCredencial: [] as any[],
    unidadesMedida: [
      // Ids con forma de UUID porque los DTO validan @IsUUID().
      {
        id: 'b0000001-0000-4000-8000-000000000001',
        nombre: 'Unidad',
        simbolo: 'u',
        orden: 10,
        activo: true,
      },
      {
        id: 'b0000002-0000-4000-8000-000000000002',
        nombre: 'Metro',
        simbolo: 'm',
        orden: 90,
        activo: true,
      },
      {
        id: 'b0000003-0000-4000-8000-000000000003',
        nombre: 'Litro',
        simbolo: 'lt',
        orden: 70,
        activo: true,
      },
    ] as any[],
    tiposEquipo: [
      // Mismo catálogo que dejó la migración. Los ids tienen forma de UUID
      // porque los DTO validan @IsUUID().
      {
        id: 'a0000001-0000-4000-8000-000000000001',
        nombre: 'PC de escritorio',
        alias: 'pc escritorio,pc',
        llevaEspecificaciones: true,
        orden: 10,
        activo: true,
      },
      {
        id: 'a0000002-0000-4000-8000-000000000002',
        nombre: 'Notebook',
        alias: 'notebook',
        llevaEspecificaciones: true,
        orden: 20,
        activo: true,
      },
      {
        id: 'a0000003-0000-4000-8000-000000000003',
        nombre: 'Servidor',
        alias: 'servidor',
        llevaEspecificaciones: true,
        orden: 30,
        activo: true,
      },
      {
        id: 'a0000004-0000-4000-8000-000000000004',
        nombre: 'Celular',
        alias: 'telefonos,telefono',
        llevaEspecificaciones: true,
        orden: 40,
        activo: true,
      },
      {
        id: 'a0000005-0000-4000-8000-000000000005',
        nombre: 'Cámara de seguridad',
        alias: 'camara de seguridad,camara',
        llevaEspecificaciones: false,
        orden: 60,
        activo: true,
      },
      {
        id: 'a0000006-0000-4000-8000-000000000006',
        nombre: 'Impresora',
        alias: 'impresora',
        llevaEspecificaciones: false,
        orden: 70,
        activo: true,
      },
      {
        id: 'a0000007-0000-4000-8000-000000000007',
        nombre: 'Equipo de red',
        alias: 'router/switch,router',
        llevaEspecificaciones: false,
        orden: 90,
        activo: true,
      },
      {
        id: 'a0000008-0000-4000-8000-000000000008',
        nombre: 'ISP',
        alias: 'isp',
        llevaEspecificaciones: false,
        orden: 100,
        activo: true,
      },
      {
        id: 'a0000009-0000-4000-8000-000000000009',
        nombre: 'Cargador',
        alias: 'cargadores telefonos,cargador',
        llevaEspecificaciones: false,
        orden: 110,
        activo: true,
      },
      {
        id: 'a0000010-0000-4000-8000-000000000010',
        nombre: 'Otro',
        alias: 'otro',
        llevaEspecificaciones: false,
        orden: 999,
        activo: true,
      },
    ] as any[],
  };

  // Los DTO validan @IsUUID(), asi que los ids generados deben tener forma de
  // UUID v4 real. El contador es compartido por todas las colecciones.
  let secuencia = 0;
  const nuevoId = () =>
    `${(++secuencia).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;

  /** Filtro mínimo: igualdad, `contains` (insensitive), `in`, y rangos gte/lte. */
  /**
   * La fila relacionada por ese campo, para poder filtrar por ella.
   *
   * Devuelve `undefined` si el campo no es una relacion conocida, que es como
   * `coincide` distingue "no aplica" de "la relacion existe pero esta vacia".
   */
  function relacionadaDe(fila: any, campo: string): any {
    const porClave: Record<string, [any[], string]> = {
      marca: [db.marcasEquipo, 'marcaId'],
      modelo: [db.modelosEquipo, 'modeloId'],
      ubicacion: [db.ubicacionesEquipo, 'ubicacionId'],
      responsable: [db.responsables, 'responsableId'],
      tipo: [db.tiposEquipo, 'tipoId'],
      categoria: [db.categorias, 'categoriaId'],
      unidad: [db.unidadesMedida, 'unidadId'],
      proveedor: [db.proveedores, 'proveedorId'],
    };
    const encontrado = porClave[campo];
    if (!encontrado) return undefined;
    const [coleccion, clave] = encontrado;
    return coleccion.find((x: any) => x.id === fila[clave]) ?? null;
  }

  function coincide(fila: any, where: any = {}): boolean {
    return Object.entries(where).every(([campo, cond]: [string, any]) => {
      if (campo === 'OR') return (cond as any[]).some((c) => coincide(fila, c));
      const valor = fila[campo];
      // `undefined` es "sin condición"; `null` explícito es IS NULL, igual que
      // en Prisma. Confundirlos hacía que { unidadId: null } matcheara todo.
      if (cond === undefined) return true;
      if (cond === null) return valor === null || valor === undefined;
      if (typeof cond !== 'object') return valor === cond;
      if ('contains' in cond) {
        const texto = String(valor ?? '');
        const buscado = String(cond.contains);
        return cond.mode === 'insensitive'
          ? texto.toLowerCase().includes(buscado.toLowerCase())
          : texto.includes(buscado);
      }
      if ('equals' in cond) {
        const a = String(valor ?? '');
        const b = String(cond.equals);
        return cond.mode === 'insensitive' ? a.toLowerCase() === b.toLowerCase() : a === b;
      }
      if ('in' in cond) return cond.in.includes(valor);

      // Condicion sobre una relacion: { marca: { nombre: { contains } } }.
      // Se resuelve buscando la fila relacionada y aplicando la condicion
      // sobre ella. Sin esto, buscar un equipo por su marca no encontraba
      // nada: la marca dejo de ser un texto de la fila y paso a ser otra tabla.
      const relacion = relacionadaDe(fila, campo);
      if (relacion !== undefined) return relacion === null ? false : coincide(relacion, cond);

      if ('gte' in cond || 'lte' in cond) {
        // Los rangos se usan para fechas (movimientos) y para números
        // (stockActual, que es Decimal). Comparar un Decimal como fecha daba
        // NaN y el filtro pasaba cualquier cosa.
        const limite = cond.gte ?? cond.lte;
        const esFecha = valor instanceof Date || limite instanceof Date;
        const aNum = (v: any) => (esFecha ? new Date(v).getTime() : Number(v));
        const t = aNum(valor);
        if ('gte' in cond && t < aNum(cond.gte)) return false;
        if ('lte' in cond && t > aNum(cond.lte)) return false;
        return true;
      }
      return valor === cond;
    });
  }

  /**
   * Valor por el que se ordena. Resuelve tanto un campo propio como uno de una
   * relación (`{ categoria: { nombre: 'asc' } }`), que es como se ordena el
   * listado de materiales por categoría o por unidad.
   */
  function valorDeOrden(fila: any, campo: string, criterio: any): any {
    const pedido = criterio[campo];
    if (pedido !== null && typeof pedido === 'object') {
      const [subcampo] = Object.keys(pedido);
      const relacionada =
        campo === 'categoria'
          ? db.categorias.find((c) => c.id === fila.categoriaId)
          : campo === 'unidad'
            ? db.unidadesMedida.find((u) => u.id === fila.unidadId)
            : null;
      return relacionada?.[subcampo] ?? null;
    }
    return fila[campo];
  }

  /** Dirección del criterio, sea plano o anidado en una relación. */
  function direccionDeOrden(criterio: any, campo: string): string {
    const pedido = criterio[campo];
    return pedido !== null && typeof pedido === 'object'
      ? (Object.values(pedido)[0] as string)
      : (pedido as string);
  }

  function ordenar(filas: any[], orderBy: any): any[] {
    if (!orderBy) return filas;
    const criterios = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...filas].sort((a, b) => {
      for (const criterio of criterios) {
        const campo = Object.keys(criterio)[0];
        const dir = direccionDeOrden(criterio, campo);
        let va = valorDeOrden(a, campo, criterio);
        let vb = valorDeOrden(b, campo, criterio);
        // Los Decimal de Prisma no se comparan bien con < entre objetos.
        if (va !== null && vb !== null && !isNaN(Number(va)) && !isNaN(Number(vb))) {
          va = Number(va);
          vb = Number(vb);
        }
        if (va === vb) continue;
        // Los nulos al final: es lo que hace Postgres con ASC por defecto.
        if (va === null) return 1;
        if (vb === null) return -1;
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
    if (include.unidad) {
      salida.unidad = db.unidadesMedida.find((u) => u.id === fila.unidadId) ?? null;
    }
    if (include.material) {
      const m = db.materiales.find((x) => x.id === fila.materialId);
      const u = m ? db.unidadesMedida.find((x) => x.id === m.unidadId) : null;
      salida.material = m ? { nombre: m.nombre, unidad: u ? { simbolo: u.simbolo } : null } : null;
    }
    if (include.proveedor) {
      const p = db.proveedores.find((x) => x.id === fila.proveedorId);
      salida.proveedor = p
        ? {
            nombre: p.nombre,
            cuit: p.cuit ?? null,
            email: p.email ?? null,
            telefono: p.telefono ?? null,
          }
        : null;
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
    if (include.responsable) {
      const r = db.responsables.find((x) => x.id === fila.responsableId);
      salida.responsable = r ? { nombre: r.nombre, activo: r.activo } : null;
    }
    if (include.marca) {
      const m = db.marcasEquipo.find((x) => x.id === fila.marcaId);
      salida.marca = m ? { nombre: m.nombre } : null;
    }
    if (include.modelo) {
      const m = db.modelosEquipo.find((x) => x.id === fila.modeloId);
      salida.modelo = m ? { nombre: m.nombre } : null;
    }
    if (include.ubicacion) {
      const u = db.ubicacionesEquipo.find((x) => x.id === fila.ubicacionId);
      salida.ubicacion = u ? { nombre: u.nombre } : null;
    }
    if (include.tipo) {
      const t = db.tiposEquipo.find((x) => x.id === fila.tipoId);
      salida.tipo = t ? { nombre: t.nombre, llevaEspecificaciones: t.llevaEspecificaciones } : null;
    }
    if (include._count?.select?.materiales) {
      salida._count = { materiales: db.materiales.filter((m) => m.unidadId === fila.id).length };
    }
    if (include._count?.select?.equipos) {
      salida._count = { equipos: db.equiposIt.filter((e) => e.tipoId === fila.id).length };
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
    if (include.subidoPor) {
      const u = db.usuarios.find((x) => x.id === fila.subidoPorId);
      salida.subidoPor = u ? { nombre: u.nombre } : null;
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
    // ── El baul de credenciales ──
    if (include.equipoIt) {
      const e = db.equiposIt.find((x) => x.id === fila.equipoItId);
      const marcaDe = db.marcasEquipo.find((m) => m.id === e?.marcaId);
      const modeloDe = db.modelosEquipo.find((m) => m.id === e?.modeloId);
      salida.equipoIt = e
        ? {
            id: e.id,
            codigoInterno: e.codigoInterno ?? null,
            marca: marcaDe ? { nombre: marcaDe.nombre } : null,
            modelo: modeloDe ? { nombre: modeloDe.nombre } : null,
          }
        : null;
    }
    if (include.rotadaPor) {
      const u = db.usuarios.find((x) => x.id === fila.rotadaPorId);
      salida.rotadaPor = u ? { nombre: u.nombre } : null;
    }
    if (include._count?.select?.rotaciones || include._count?.select?.vistas) {
      salida._count = {
        ...(include._count.select.rotaciones
          ? { rotaciones: db.rotacionesCredencial.filter((r) => r.credencialId === fila.id).length }
          : {}),
        ...(include._count.select.vistas
          ? { vistas: db.vistasCredencial.filter((v) => v.credencialId === fila.id).length }
          : {}),
      };
    }
    if (include._count?.select?.ediciones) {
      salida._count = { ediciones: db.ediciones.filter((e) => e.movimientoId === fila.id).length };
    }
    return salida;
  }

  /**
   * `select` de Prisma: elige campos y, de paso, puede traer relaciones.
   *
   * Se resuelve reusando `hidratar` para las relaciones y recortando después a
   * los campos pedidos. Al principio el fake solo entendía `include`, y por eso
   * no se podían probar los módulos que usan `select` —credenciales, entre
   * otros— contra la app de verdad.
   */
  function proyectar(fila: any, select: any): any {
    if (!fila || !select) return fila;

    // Las claves cuyo valor es un objeto son relaciones o _count: eso lo sabe
    // hacer `hidratar`, que ya conoce cada relación por su nombre.
    const relaciones: any = {};
    for (const [campo, valor] of Object.entries(select)) {
      if (valor && typeof valor === 'object') relaciones[campo] = valor;
    }
    const hidratada = hidratar(fila, relaciones);

    const salida: any = {};
    for (const [campo, valor] of Object.entries(select)) {
      if (valor === true) salida[campo] = fila[campo] ?? null;
      else if (valor && typeof valor === 'object') salida[campo] = hidratada[campo] ?? null;
    }
    return salida;
  }

  /** Aplica `select` si vino; si no, `include`. Prisma no acepta los dos juntos. */
  function devolver(fila: any, { select, include }: any = {}): any {
    return select ? proyectar(fila, select) : hidratar(fila, include);
  }

  /** Fábrica genérica de delegate Prisma sobre una colección. */
  function delegate(coleccion: any[], defaults: () => any = () => ({})) {
    return {
      create: async ({ data, include, select }: any) => {
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
        return devolver(fila, { select, include });
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
      findMany: async ({ where, skip = 0, take, orderBy, include, select }: any = {}) => {
        const filtradas = ordenar(
          coleccion.filter((f) => coincide(f, where)),
          orderBy,
        );
        const pagina =
          take === undefined ? filtradas.slice(skip) : filtradas.slice(skip, skip + take);
        return pagina.map((f) => devolver(f, { select, include }));
      },
      findUnique: async ({ where, include, select }: any) => {
        const fila = coleccion.find((f) => Object.entries(where).every(([k, v]) => f[k] === v));
        return fila ? devolver(fila, { select, include }) : null;
      },
      findFirst: async ({ where, include, select, orderBy }: any = {}) => {
        const candidatos = ordenar(
          coleccion.filter((f) => coincide(f, where)),
          orderBy,
        );
        return candidatos.length > 0 ? devolver(candidatos[0], { select, include }) : null;
      },
      findUniqueOrThrow: async ({ where, include }: any) => {
        const fila = coleccion.find((f) => Object.entries(where).every(([k, v]) => f[k] === v));
        if (!fila) throw new Error('No encontrado');
        return hidratar(fila, include);
      },
      count: async ({ where }: any = {}) => coleccion.filter((f) => coincide(f, where)).length,
      update: async ({ where, data, include, select }: any) => {
        const fila = coleccion.find((f) => f.id === where.id);
        if (!fila) throw new Error('No encontrado');
        Object.assign(fila, aplanarConnect(data), { actualizadoEn: new Date() });
        return devolver(fila, { select, include });
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
    // `activo: true` replica el @default del esquema. Sin eso, todo material
    // creado en un e2e nacia desactivado y las ordenes de compra lo rechazaban
    // con un 400: era la causa de las 37 fallas de esa suite.
    material: delegate(db.materiales, () => ({
      stockActual: aDecimal(0),
      stockMinimo: aDecimal(0),
      notas: null,
      unidadId: null,
      activo: true,
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
    unidadMedida: delegate(db.unidadesMedida, () => ({ orden: 0, activo: true })),
    tipoEquipo: delegate(db.tiposEquipo, () => ({
      alias: null,
      llevaEspecificaciones: true,
      orden: 0,
      activo: true,
    })),
    usuario: delegate(db.usuarios, () => ({ idExterno: null, rol: 'OPERARIO' })),
    edicionMovimiento: delegate(db.ediciones, () => ({ usuarioId: null })),

    equipoIT: delegate(db.equiposIt, () => ({
      codigoInterno: null,
      ordenClave: null,
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
    manualEquipo: delegate(db.manuales, () => ({
      subidoPorId: null,
      subidoEn: new Date(),
    })),
    envioOrden: delegate(db.enviosOrden, () => ({
      usuarioId: null,
      enviadoEn: new Date(),
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
    // Sin esto, `PermisosService.onModuleInit` reventaba al arrancar la app y
    // TODOS los e2e fallaban antes de correr su primer test. No se notaba
    // porque `npm test` no los ejecuta: hay que pedir `npm run test:all`.
    permisoRol: delegate(db.permisosRol),

    responsable: delegate(db.responsables, () => ({ activo: true })),
    equipo: delegate(db.equipos, () => ({
      estado: 'OPERATIVO',
      clasificacion: 'EQUIPO',
      codigoInterno: null,
      descripcion: null,
      numeroSerie: null,
      fotoUrl: null,
      horasUso: null,
      fechaAlta: null,
      garantiaHasta: null,
      qrGeneradoEn: null,
      renglonOrdenCompraId: null,
    })),
    marcaEquipo: delegate(db.marcasEquipo, () => ({ activo: true })),
    modeloEquipo: delegate(db.modelosEquipo, () => ({ activo: true })),
    ubicacionEquipo: delegate(db.ubicacionesEquipo, () => ({ activo: true })),

    credencial: delegate(db.credenciales, () => ({ activo: true })),
    rotacionCredencial: delegate(db.rotacionesCredencial),
    vistaCredencial: delegate(db.vistasCredencial),

    /**
     * Prisma acepta dos formas y la app usa las dos: una funcion, o una lista
     * de consultas que se resuelven juntas. Con solo la funcion, el historial
     * de una credencial reventaba con un 500.
     */
    $transaction: async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)),
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
