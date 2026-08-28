import { EstadoEquipoIT, TipoEquipoIT } from '@prisma/client';

/**
 * Traducción de una planilla de inventario (Notion, Excel) a los datos que
 * espera el módulo. Vive aparte del service porque son reglas de mapeo puras y
 * conviene tenerlas testeadas sin base de datos de por medio.
 */

/** Quita acentos y espacios de más para comparar sin sorpresas. */
export function normalizarTexto(valor: string): string {
  return (
    valor
      .normalize('NFD')
      // Rango de diacríticos combinables: separa la tilde de la letra y la quita.
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
  );
}

/**
 * Tipos de equipo. Las claves están normalizadas (sin acentos, minúsculas).
 * Se aceptan las variantes que aparecen en la planilla real.
 */
const TIPOS: Record<string, TipoEquipoIT> = {
  'pc escritorio': TipoEquipoIT.PC,
  pc: TipoEquipoIT.PC,
  notebook: TipoEquipoIT.NOTEBOOK,
  laptop: TipoEquipoIT.NOTEBOOK,
  servidor: TipoEquipoIT.SERVIDOR,
  impresora: TipoEquipoIT.IMPRESORA,
  'camara de seguridad': TipoEquipoIT.CAMARA_SEGURIDAD,
  camara: TipoEquipoIT.CAMARA_SEGURIDAD,
  telefonos: TipoEquipoIT.CELULAR,
  telefono: TipoEquipoIT.CELULAR,
  celular: TipoEquipoIT.CELULAR,
  tablet: TipoEquipoIT.TABLET,
  monitor: TipoEquipoIT.MONITOR,
  'router/switch': TipoEquipoIT.EQUIPO_RED,
  router: TipoEquipoIT.EQUIPO_RED,
  switch: TipoEquipoIT.EQUIPO_RED,
  // ISP y cargadores no tienen un tipo propio: entran como OTRO y quedan
  // igualmente inventariados.
  isp: TipoEquipoIT.OTRO,
  'cargadores telefonos': TipoEquipoIT.OTRO,
  cargador: TipoEquipoIT.OTRO,
};

const ESTADOS: Record<string, EstadoEquipoIT> = {
  'en uso': EstadoEquipoIT.EN_USO,
  activo: EstadoEquipoIT.EN_USO,
  disponible: EstadoEquipoIT.EN_DEPOSITO,
  'en deposito': EstadoEquipoIT.EN_DEPOSITO,
  deposito: EstadoEquipoIT.EN_DEPOSITO,
  'en reparacion': EstadoEquipoIT.EN_REPARACION,
  reparacion: EstadoEquipoIT.EN_REPARACION,
  'dado de baja': EstadoEquipoIT.DADO_DE_BAJA,
  baja: EstadoEquipoIT.DADO_DE_BAJA,
  inactivo: EstadoEquipoIT.DADO_DE_BAJA,
};

/**
 * Marcas que aparecen sueltas en la columna "Modelo" de la planilla.
 * El orden importa: se prueba la coincidencia más larga primero para que
 * "TP-Link" no quede tapado por "TP".
 */
const MARCAS = [
  'Hikvision',
  'Samsung',
  'Motorola',
  'Starlink',
  'Mikrotik',
  'TP-Link',
  'Lenovo',
  'Brother',
  'Xiaomi',
  'Epson',
  'Canon',
  'Intel',
  'Asus',
  'Acer',
  'Dell',
  'Moto',
  'Tapo',
  'AMD',
  'LG',
  'HP',
].sort((a, b) => b.length - a.length);

export const MARCA_POR_DEFECTO = 'Sin especificar';

export interface MarcaYModelo {
  marca: string;
  modelo: string;
  /** true si no se pudo reconocer la marca y hay que revisarlo a mano. */
  dudoso: boolean;
}

/**
 * Separa la columna "Modelo", que en la planilla mezcla marcas sueltas
 * ("INTEL", "HP") con modelos completos ("HP LaserJet MFP M141w").
 */
export function separarMarcaYModelo(valor: string | undefined): MarcaYModelo {
  const texto = (valor ?? '').trim().replace(/\s+/g, ' ');
  if (!texto) {
    return { marca: MARCA_POR_DEFECTO, modelo: '', dudoso: true };
  }

  for (const marca of MARCAS) {
    const normalizada = normalizarTexto(marca);
    const normalizado = normalizarTexto(texto);

    // El valor es SOLO la marca: "INTEL", "HP".
    if (normalizado === normalizada) {
      return { marca, modelo: '', dudoso: false };
    }
    // El valor arranca con la marca: "HP LaserJet MFP M141w".
    if (normalizado.startsWith(`${normalizada} `)) {
      return { marca, modelo: texto.slice(marca.length).trim(), dudoso: false };
    }
  }

  // No se reconoció la marca: se conserva todo en modelo y se avisa.
  return { marca: MARCA_POR_DEFECTO, modelo: texto, dudoso: true };
}

export function normalizarTipo(valor: string | undefined): TipoEquipoIT | null {
  const clave = normalizarTexto(valor ?? '');
  if (!clave) return null;
  if (TIPOS[clave]) return TIPOS[clave];

  // Coincidencia parcial, del patron MAS LARGO al mas corto: gana el mas
  // especifico. Sin ordenar, "Cargadores Telefonos Only Turbo" matcheaba
  // "telefonos" y un cargador entraba como celular.
  const patrones = Object.entries(TIPOS).sort(([a], [b]) => b.length - a.length);
  for (const [patron, tipo] of patrones) {
    if (clave.includes(patron)) return tipo;
  }
  return null;
}

export function normalizarEstado(valor: string | undefined): EstadoEquipoIT {
  const clave = normalizarTexto(valor ?? '');
  // Sin dato, lo más seguro es asumir que está en depósito y no en uso.
  return ESTADOS[clave] ?? EstadoEquipoIT.EN_DEPOSITO;
}

/**
 * Los IDs de AnyDesk vienen con espacios ("737 214 468"). Se guardan sin
 * separadores para poder buscarlos escriban como escriban.
 */
export function normalizarIdAccesoRemoto(valor: string | undefined): string | undefined {
  const solo = (valor ?? '').replace(/\D/g, '');
  return solo.length > 0 ? solo : undefined;
}

/**
 * Nombres de personas de la planilla. Devuelve null cuando la celda no
 * identifica a nadie ("Uso compartido", "No tiene todavia", "Operarios del
 * envase"): son destinos colectivos, no una persona a la que asignarle algo.
 */
const NO_SON_PERSONAS = ['uso compartido', 'no tiene todavia', 'no tiene', 'sin asignar', '-'];

export function normalizarNombrePersona(valor: string | undefined): string | null {
  const texto = (valor ?? '').trim().replace(/\s+/g, ' ');
  if (!texto) return null;
  if (NO_SON_PERSONAS.includes(normalizarTexto(texto))) return null;
  return texto;
}
