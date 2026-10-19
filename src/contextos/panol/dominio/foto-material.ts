import { ErrorDatosInvalidos } from './errores';

/** 5 MB ya comprimida, igual que las de los equipos. El navegador la achica antes. */
export const MAXIMO_BYTES_FOTO = 5 * 1024 * 1024;

/** Comprueba que la imagen se pueda guardar como foto del material. */
export function validarFotoMaterial(contenido: Buffer): void {
  if (contenido.length === 0) {
    throw new ErrorDatosInvalidos('La imagen vino vacía.');
  }
  if (contenido.length > MAXIMO_BYTES_FOTO) {
    throw new ErrorDatosInvalidos(
      `La imagen pesa ${Math.round(contenido.length / 1024 / 1024)} MB y el máximo son 5 MB.`,
    );
  }
}

/**
 * La ruta dentro del almacén a partir de la URL pública, para borrar la foto
 * que se reemplaza. El material solo guarda la URL.
 */
export function rutaDeUrlPublica(url: string): string | null {
  return url.split('/object/public/')[1]?.split('/').slice(1).join('/') || null;
}
