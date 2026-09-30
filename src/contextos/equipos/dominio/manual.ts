import { ErrorDatosInvalidos } from './errores';

/**
 * Las reglas de los manuales de un equipo o una herramienta.
 *
 * Son PDF y nada más: un manual en Word o en foto no se abre igual en todos
 * los celulares, y el PDF es como los mandan los fabricantes.
 */

/**
 * Un manual de fábrica completo, con despiece, anda entre 2 y 20 MB. Más que
 * eso suele ser un escaneo sin comprimir, y el almacén gratuito es 1 GB
 * compartido con las fotos de los equipos y los comprobantes de compras.
 */
export const MAXIMO_BYTES_MANUAL = 25 * 1024 * 1024;

/** El de uso, el de servicio, el despiece, el eléctrico… con diez sobra. */
export const MAXIMO_MANUALES_POR_EQUIPO = 10;

/** Todo PDF empieza con estos cinco bytes. */
const FIRMA_PDF = '%PDF-';

/** Si el contenido es de verdad un PDF, y no otra cosa con la extensión cambiada. */
export function esPdf(contenido: Buffer): boolean {
  return contenido.subarray(0, FIRMA_PDF.length).toString('latin1') === FIRMA_PDF;
}

/** Comprueba que el archivo se pueda guardar como manual. */
export function validarManual(
  nombreArchivo: string,
  contenido: Buffer,
  manualesQueYaTiene: number,
): void {
  if (contenido.length === 0) {
    throw new ErrorDatosInvalidos('El archivo llegó vacío. Probá de nuevo.');
  }
  if (!nombreArchivo.toLowerCase().endsWith('.pdf') || !esPdf(contenido)) {
    throw new ErrorDatosInvalidos(
      'El manual tiene que ser un PDF. Si lo tenés en otro formato, guardalo como PDF primero.',
    );
  }
  if (contenido.length > MAXIMO_BYTES_MANUAL) {
    const mb = (contenido.length / 1024 / 1024).toFixed(1);
    throw new ErrorDatosInvalidos(
      `El PDF pesa ${mb} MB y el máximo son ${MAXIMO_BYTES_MANUAL / 1024 / 1024} MB. ` +
        'Si es un escaneo, probá guardarlo con menos calidad.',
    );
  }
  if (manualesQueYaTiene >= MAXIMO_MANUALES_POR_EQUIPO) {
    throw new ErrorDatosInvalidos(
      `Este equipo ya tiene ${MAXIMO_MANUALES_POR_EQUIPO} manuales, que es el máximo. ` +
        'Borrá alguno si necesitás subir otro.',
    );
  }
}

/** El nombre que se muestra: sin carpetas y sin pasarse de largo. */
export function nombreParaMostrar(nombreArchivo: string): string {
  const soloArchivo = nombreArchivo.split(/[\\/]/).pop() ?? nombreArchivo;
  return soloArchivo.trim().slice(0, 200) || 'manual.pdf';
}
