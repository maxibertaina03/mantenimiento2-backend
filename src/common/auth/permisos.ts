/**
 * Qué puede hacer cada quien.
 *
 * Los permisos son una lista fija en el código y no filas en la base, porque
 * cada uno corresponde a endpoints concretos: inventar uno nuevo desde una
 * pantalla no haría que ningún endpoint empezara a pedirlo. Lo que sí se edita
 * desde el sistema es QUÉ permisos tiene cada rol, que es lo que cambia con el
 * tiempo.
 *
 * Esta pieza no importa Nest ni Prisma a propósito: es la que decide si alguien
 * entra o no, y aislada se puede probar de verdad.
 */
export const PERMISOS = {
  // ── Materiales y stock ────────────────────────────────────────────────────
  MATERIALES_VER: 'materiales.ver',
  /** Alta, edición y baja de materiales, y de sus catálogos. */
  MATERIALES_EDITAR: 'materiales.editar',
  MOVIMIENTOS_VER: 'movimientos.ver',
  MOVIMIENTOS_CREAR: 'movimientos.crear',
  /** Corregir un movimiento ya cargado. Quién puede corregir CUÁL es otra regla. */
  MOVIMIENTOS_EDITAR: 'movimientos.editar',

  /**
   * Las listas auxiliares: categorías, unidades, estanterías, marcas, modelos,
   * tipos y ubicaciones.
   *
   * Van juntas y no repartidas por módulo porque son compartidas: la lista de
   * marcas la usan los equipos de planta y los de informática, y la de
   * ubicaciones también. Pedir "ver equipos de planta" para poder abrir el
   * desplegable de marcas en informática sería un permiso que no describe nada.
   */
  CATALOGOS_VER: 'catalogos.ver',
  CATALOGOS_EDITAR: 'catalogos.editar',

  // ── Compras ───────────────────────────────────────────────────────────────
  PROVEEDORES_VER: 'proveedores.ver',
  PROVEEDORES_EDITAR: 'proveedores.editar',
  ORDENES_VER: 'ordenes.ver',
  ORDENES_EDITAR: 'ordenes.editar',
  /** Dar por recibida una orden: eso mueve el stock. */
  ORDENES_RECIBIR: 'ordenes.recibir',
  /** Mandarla al proveedor por correo o por WhatsApp. */
  ORDENES_ENVIAR: 'ordenes.enviar',

  // ── Órdenes de trabajo ──────────────────────────────────────────
  TRABAJOS_VER: 'trabajos.ver',
  /** Abrir, cargar materiales, cerrar y anular. Mueve stock. */
  TRABAJOS_EDITAR: 'trabajos.editar',
  /**
   * Borrar del sistema una orden anulada que nunca movió stock.
   *
   * Aparte de editar, y a propósito: es la única acción del módulo que no deja
   * rastro de lo que hubo. Como no entra en ningún preset salvo el del
   * administrador, nace solo para él, que es lo que corresponde.
   */
  TRABAJOS_ELIMINAR: 'trabajos.eliminar',

  // ── Equipos de planta y sus services ──────────────────────────────────────
  EQUIPOS_VER: 'equipos.ver',
  EQUIPOS_EDITAR: 'equipos.editar',
  SERVICIOS_VER: 'servicios.ver',
  SERVICIOS_EDITAR: 'servicios.editar',

  // ── Informática ───────────────────────────────────────────────────────────
  IT_VER: 'it.ver',
  IT_EDITAR: 'it.editar',

  // ── Contraseñas ───────────────────────────────────────────────────────────
  /** Ver la lista: nombres, a qué pertenecen, cuándo toca rotarlas. */
  CREDENCIALES_VER: 'credenciales.ver',
  /** Ver el valor de una contraseña. Queda registrado quién la vio. */
  CREDENCIALES_REVELAR: 'credenciales.revelar',
  CREDENCIALES_EDITAR: 'credenciales.editar',

  // ── Administración del sistema ────────────────────────────────────────────
  USUARIOS_ADMINISTRAR: 'usuarios.administrar',
  /** Cambiar qué puede hacer cada rol. Es la llave de todas las demás. */
  PERMISOS_ADMINISTRAR: 'permisos.administrar',
} as const;

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS];

export const TODOS_LOS_PERMISOS = Object.values(PERMISOS) as Permiso[];

/** Los permisos que solo dejan mirar. */
export const PERMISOS_DE_LECTURA: Permiso[] = TODOS_LOS_PERMISOS.filter(
  (p) => p.endsWith('.ver') || p === PERMISOS.CREDENCIALES_REVELAR,
);

/**
 * Cómo se llama cada permiso en la pantalla, y en qué grupo va.
 *
 * Vive acá y no en el frontend para que la pantalla de permisos no tenga que
 * mantener su propia copia de la lista: si se agrega un permiso y alguien se
 * olvida de la etiqueta, aparece igual, con su nombre técnico, en vez de
 * desaparecer sin que nadie lo note.
 */
export const DESCRIPCION_PERMISOS: Record<Permiso, { grupo: string; etiqueta: string }> = {
  [PERMISOS.MATERIALES_VER]: { grupo: 'Materiales', etiqueta: 'Ver el listado y las fichas' },
  [PERMISOS.MATERIALES_EDITAR]: {
    grupo: 'Materiales',
    etiqueta: 'Crear, editar y dar de baja materiales y sus catálogos',
  },
  [PERMISOS.MOVIMIENTOS_VER]: { grupo: 'Materiales', etiqueta: 'Ver el historial de movimientos' },
  [PERMISOS.MOVIMIENTOS_CREAR]: { grupo: 'Materiales', etiqueta: 'Cargar entradas y salidas' },
  [PERMISOS.MOVIMIENTOS_EDITAR]: {
    grupo: 'Materiales',
    etiqueta: 'Corregir un movimiento ya cargado',
  },

  [PERMISOS.CATALOGOS_VER]: {
    grupo: 'Listas auxiliares',
    etiqueta: 'Ver categorías, unidades, marcas, tipos y ubicaciones',
  },
  [PERMISOS.CATALOGOS_EDITAR]: {
    grupo: 'Listas auxiliares',
    etiqueta: 'Crear y editar esas listas',
  },

  [PERMISOS.PROVEEDORES_VER]: { grupo: 'Compras', etiqueta: 'Ver proveedores' },
  [PERMISOS.PROVEEDORES_EDITAR]: { grupo: 'Compras', etiqueta: 'Crear y editar proveedores' },
  [PERMISOS.TRABAJOS_VER]: {
    grupo: 'Trabajos',
    etiqueta: 'Ver las órdenes de trabajo y qué material usó cada una',
  },
  [PERMISOS.TRABAJOS_EDITAR]: {
    grupo: 'Trabajos',
    etiqueta: 'Abrir órdenes, cargarles materiales y cerrarlas (saca del pañol)',
  },
  [PERMISOS.TRABAJOS_ELIMINAR]: {
    grupo: 'Trabajos',
    etiqueta: 'Eliminar una orden anulada que nunca movió stock',
  },
  [PERMISOS.ORDENES_VER]: { grupo: 'Compras', etiqueta: 'Ver órdenes de compra' },
  [PERMISOS.ORDENES_EDITAR]: { grupo: 'Compras', etiqueta: 'Crear, editar y anular órdenes' },
  [PERMISOS.ORDENES_RECIBIR]: {
    grupo: 'Compras',
    etiqueta: 'Dar por recibida una orden (mueve el stock)',
  },
  [PERMISOS.ORDENES_ENVIAR]: { grupo: 'Compras', etiqueta: 'Enviar la orden al proveedor' },

  [PERMISOS.EQUIPOS_VER]: { grupo: 'Equipos de planta', etiqueta: 'Ver equipos y sus fichas' },
  [PERMISOS.EQUIPOS_EDITAR]: { grupo: 'Equipos de planta', etiqueta: 'Crear y editar equipos' },
  [PERMISOS.SERVICIOS_VER]: { grupo: 'Equipos de planta', etiqueta: 'Ver planes e historial' },
  [PERMISOS.SERVICIOS_EDITAR]: {
    grupo: 'Equipos de planta',
    etiqueta: 'Definir planes y registrar trabajos',
  },

  [PERMISOS.IT_VER]: { grupo: 'Informática', etiqueta: 'Ver el inventario informático' },
  [PERMISOS.IT_EDITAR]: { grupo: 'Informática', etiqueta: 'Cargar y asignar equipos' },

  [PERMISOS.CREDENCIALES_VER]: { grupo: 'Contraseñas', etiqueta: 'Ver la lista, sin los valores' },
  [PERMISOS.CREDENCIALES_REVELAR]: {
    grupo: 'Contraseñas',
    etiqueta: 'Mostrar una contraseña (queda registrado)',
  },
  [PERMISOS.CREDENCIALES_EDITAR]: {
    grupo: 'Contraseñas',
    etiqueta: 'Guardar, rotar y borrar contraseñas',
  },

  [PERMISOS.USUARIOS_ADMINISTRAR]: { grupo: 'Administración', etiqueta: 'Administrar usuarios' },
  [PERMISOS.PERMISOS_ADMINISTRAR]: {
    grupo: 'Administración',
    etiqueta: 'Cambiar qué puede hacer cada rol',
  },
};

/**
 * Con qué permisos arranca cada rol.
 *
 * Es solo el punto de partida: una vez creados, se editan desde el sistema y
 * mandan los de la base. Si acá se agrega un permiso nuevo, NO se les cae
 * encima a los roles que ya existen; ver `SiembraPermisos`.
 */
export const PRESETS: Record<string, Permiso[]> = {
  ADMIN: TODOS_LOS_PERMISOS,

  // Gerencia mira todo y no toca nada. Incluye ver las contraseñas: queda
  // registrado quién miró cuál, igual que con el administrador.
  GERENCIA: PERMISOS_DE_LECTURA,

  // Administración de la empresa: solo las órdenes de compra, para mirarlas.
  ADMINISTRATIVO: [PERMISOS.ORDENES_VER],

  // Mantenimiento maneja el depósito de punta a punta: el stock y las compras
  // que lo alimentan. Las órdenes impactan directo en el stock cuando se
  // reciben, así que el circuito entero es de ellos y no queda partido entre
  // dos áreas.
  MANTENIMIENTO: [
    PERMISOS.MATERIALES_VER,
    PERMISOS.MOVIMIENTOS_VER,
    PERMISOS.MOVIMIENTOS_CREAR,
    PERMISOS.MOVIMIENTOS_EDITAR,

    // Dar de alta un material y un proveedor son parte del mismo circuito: una
    // orden se le carga a un proveedor y con materiales del catálogo. Sin
    // estos dos, el circuito se corta a la mitad la primera vez que hay que
    // comprarle a alguien nuevo.
    PERMISOS.MATERIALES_EDITAR,
    PERMISOS.PROVEEDORES_VER,
    PERMISOS.PROVEEDORES_EDITAR,

    PERMISOS.ORDENES_VER,
    PERMISOS.ORDENES_EDITAR,
    PERMISOS.ORDENES_RECIBIR,
    PERMISOS.ORDENES_ENVIAR,

    // Las órdenes de trabajo son suyas: son ellos los que hacen el trabajo y
    // los que sacan el material del pañol para hacerlo. Sin el permiso de
    // editar, el módulo no sirve de nada para quien lo va a usar todos los días.
    PERMISOS.TRABAJOS_VER,
    PERMISOS.TRABAJOS_EDITAR,

    // Sin esto, la ficha de un material no puede mostrar su categoría ni su
    // unidad, y el formulario de un movimiento queda sin desplegables.
    PERMISOS.CATALOGOS_VER,
  ],
};

/** Si el permiso existe. Protege contra una fila vieja o un nombre mal escrito. */
export function esPermisoConocido(valor: string): valor is Permiso {
  return (TODOS_LOS_PERMISOS as string[]).includes(valor);
}

/**
 * Si alguien con estos permisos puede hacer lo que el endpoint pide.
 *
 * Pide TODOS los declarados, no alguno: un endpoint que declara dos permisos
 * está diciendo que hacen falta los dos.
 */
export function puede(
  permisosDelUsuario: readonly string[],
  requeridos: readonly Permiso[],
): boolean {
  if (requeridos.length === 0) return true;
  const tiene = new Set(permisosDelUsuario);
  return requeridos.every((r) => tiene.has(r));
}
