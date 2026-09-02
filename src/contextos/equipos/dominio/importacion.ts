import { normalizarTexto } from './equipo';

/**
 * Lectura de la carpeta de fotos de la planta como inventario de equipos.
 *
 * La carpeta ya tiene la información: cada subcarpeta es un sector
 * (Caldera, Tinas, Drenoprensa…) y cada archivo lleva el nombre del equipo
 * ("Bomba caldera 1.jpg"). No son nombres automáticos tipo IMG_20251212:
 * alguien se tomó el trabajo de nombrarlos, y eso es lo que hace viable
 * importar en vez de cargar 250 equipos a mano.
 *
 * Nada de esto toca la base ni HTTP: se prueba con una lista de rutas.
 */

/** Un archivo de la carpeta, tal como lo ve quien la abre. */
export interface ArchivoImportado {
  /** Ruta relativa con la carpeta adelante: "Caldera/Bomba caldera 1.jpg". */
  ruta: string;
}

export type MotivoDescarte = 'sin_carpeta' | 'carpeta_excluida' | 'no_es_imagen' | 'sin_nombre';

export type Advertencia = 'posible_equipo_it' | 'posible_duplicado' | 'nombre_automatico';

export interface EquipoDetectado {
  nombre: string;
  ubicacion: string;
  ruta: string;
  advertencias: Advertencia[];
}

export interface ArchivoDescartado {
  ruta: string;
  motivo: MotivoDescarte;
}

export interface ResultadoDeteccion {
  equipos: EquipoDetectado[];
  descartados: ArchivoDescartado[];
  /** Los sectores encontrados, que son las ubicaciones a dar de alta. */
  ubicaciones: string[];
}

const EXTENSIONES_IMAGEN = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];

/**
 * Carpetas que no son equipos de planta.
 *
 * "Taller" son herramientas —alicates, amoladoras, calibres—, que van a su
 * propio módulo. "manuales" son PDF, no equipos.
 */
export const CARPETAS_EXCLUIDAS_POR_DEFECTO = ['taller', 'manuales'];

/**
 * Nombres que delatan un equipo de sistemas.
 *
 * En las fotos hay routers, racks y PCs mezclados entre las máquinas, y esos ya
 * están cargados en el módulo de Equipos IT. Importarlos los duplicaría en dos
 * módulos, así que se marcan para que quien importa decida.
 */
const PALABRAS_IT = [
  'router',
  'switch',
  'rack',
  'notebook',
  'impresora',
  'monitor',
  'extensor wifi',
  'access point',
  'nvr',
  'dvr',
  'servidor',
  'ups',
];

/** El nombre del equipo sale del archivo, sin la extensión. */
function nombreDesdeArchivo(archivo: string): string | null {
  const sinExtension = archivo.replace(/\.[^.]+$/, '');
  return normalizarTexto(sinExtension);
}

function esImagen(archivo: string): boolean {
  return EXTENSIONES_IMAGEN.some((ext) => archivo.toLowerCase().endsWith(ext));
}

/**
 * Nombres que puso la cámara o WhatsApp, no una persona.
 *
 * Salieron al correr esto contra la carpeta real: entre los nombres buenos hay
 * un puñado de "IMG-20251212-WA0031". Importarlos crearía equipos llamados así,
 * que después nadie encuentra buscando.
 */
function esNombreAutomatico(nombre: string): boolean {
  return /^(img[-_ ]|dsc[-_ ]?\d|pxl[-_ ]?\d|whatsapp image|photo[-_ ]?\d|\d{8}[-_ ])/i.test(
    nombre,
  );
}

function raizSinNumero(nombre: string): string {
  return nombre.replace(/\s+\d+$/, '').toLowerCase();
}

function terminaEnNumero(nombre: string): boolean {
  return /\s+\d+$/.test(nombre);
}

function pareceIT(nombre: string): boolean {
  const n = nombre.toLowerCase();
  // Con límite de palabra, para que "Tablero" no matchee por contener "ble".
  return PALABRAS_IT.some((p) => new RegExp(`\\b${p}\\b`).test(n)) || /\bpcf?\d*\b/.test(n);
}

/**
 * Convierte la lista de archivos en equipos a revisar.
 *
 * No crea nada: devuelve lo que se detectó para que se confirme antes. Importar
 * 250 equipos sin ver qué va a entrar es la clase de operación que después hay
 * que deshacer a mano.
 */
export function detectarEquipos(
  archivos: ArchivoImportado[],
  carpetasExcluidas: string[] = CARPETAS_EXCLUIDAS_POR_DEFECTO,
): ResultadoDeteccion {
  const excluidas = carpetasExcluidas.map((c) => c.toLowerCase());
  const equipos: EquipoDetectado[] = [];
  const descartados: ArchivoDescartado[] = [];

  for (const { ruta } of archivos) {
    const partes = ruta.split(/[/\\]/).filter((p) => p !== '');
    // Se ignora el nombre de la carpeta raíz que agrega el navegador al elegir
    // un directorio: lo que importa son los dos últimos tramos.
    const archivo = partes[partes.length - 1] ?? '';
    const carpeta = partes.length >= 2 ? partes[partes.length - 2] : null;

    if (carpeta === null) {
      descartados.push({ ruta, motivo: 'sin_carpeta' });
      continue;
    }
    if (excluidas.includes(carpeta.toLowerCase())) {
      descartados.push({ ruta, motivo: 'carpeta_excluida' });
      continue;
    }
    if (!esImagen(archivo)) {
      descartados.push({ ruta, motivo: 'no_es_imagen' });
      continue;
    }

    const nombre = nombreDesdeArchivo(archivo);
    if (nombre === null) {
      descartados.push({ ruta, motivo: 'sin_nombre' });
      continue;
    }

    const ubicacion = normalizarTexto(carpeta);
    if (ubicacion === null) {
      descartados.push({ ruta, motivo: 'sin_carpeta' });
      continue;
    }

    const advertencias: Advertencia[] = [];
    if (pareceIT(nombre)) advertencias.push('posible_equipo_it');
    if (esNombreAutomatico(nombre)) advertencias.push('nombre_automatico');

    equipos.push({ nombre, ubicacion, ruta, advertencias });
  }

  // Los posibles duplicados solo se ven mirando el conjunto.
  //
  // La regla es más fina de lo que parece. Marcar toda serie numerada sería
  // inútil: contra la carpeta real marcaba 200 de 389, y una advertencia que
  // sale en la mitad de las filas no la lee nadie. En una planta "Compresor 1"
  // y "Compresor 2" son dos compresores de verdad.
  //
  // El caso que sí es sospechoso es cuando existe el nombre SIN número y además
  // variantes numeradas ("Extractor", "Extractor 1", "Extractor 2"): ahí lo más
  // probable es que sean varias fotos del mismo equipo.
  const porRaiz = new Map<string, EquipoDetectado[]>();
  for (const equipo of equipos) {
    const clave = `${equipo.ubicacion.toLowerCase()}|${raizSinNumero(equipo.nombre)}`;
    porRaiz.set(clave, [...(porRaiz.get(clave) ?? []), equipo]);
  }
  for (const grupo of porRaiz.values()) {
    const hayVersionSinNumero = grupo.some((e) => !terminaEnNumero(e.nombre));
    if (grupo.length > 1 && hayVersionSinNumero) {
      for (const equipo of grupo) equipo.advertencias.push('posible_duplicado');
    }
  }

  const ubicaciones = [...new Set(equipos.map((e) => e.ubicacion))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );

  return { equipos, descartados, ubicaciones };
}
