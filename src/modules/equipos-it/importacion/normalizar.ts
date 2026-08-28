import { EstadoEquipoIT } from '@prisma/client';

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

/** Lo mínimo que necesita el matcheo: el catálogo real trae más campos. */
export interface TipoBuscable {
  id: string;
  nombre: string;
  alias?: string | null;
}

/**
 * Resuelve el tipo de la planilla contra el CATÁLOGO, no contra una lista fija:
 * si mañana se agrega un tipo desde la pantalla, la importación lo reconoce sin
 * tocar código.
 *
 * Cada tipo aporta su nombre y sus alias como patrones. Se prueba primero la
 * coincidencia exacta y después la parcial, del patrón MÁS LARGO al más corto:
 * gana el más específico. Sin ese orden, "Cargadores Teléfonos Only Turbo"
 * matcheaba "telefonos" y un cargador entraba como celular.
 */
export function normalizarTipo<T extends TipoBuscable>(
  valor: string | undefined,
  catalogo: T[],
): T | null {
  const clave = normalizarTexto(valor ?? '');
  if (!clave) return null;

  // [patrón, tipo] con el nombre y todos los alias de cada tipo.
  const patrones: [string, T][] = [];
  for (const tipo of catalogo) {
    patrones.push([normalizarTexto(tipo.nombre), tipo]);
    for (const alias of (tipo.alias ?? '').split(',')) {
      const a = normalizarTexto(alias);
      if (a) patrones.push([a, tipo]);
    }
  }

  const exacto = patrones.find(([p]) => p === clave);
  if (exacto) return exacto[1];

  const porLargo = [...patrones].sort(([a], [b]) => b.length - a.length);
  const parcial = porLargo.find(([p]) => clave.includes(p));
  return parcial ? parcial[1] : null;
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
