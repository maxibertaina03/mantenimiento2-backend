import { ErrorDatosInvalidos } from './errores';

/**
 * Las reglas de las otras fotos de un equipo: la chapa característica, el
 * tablero, una vista de atrás.
 *
 * La foto principal sigue siendo una sola (`Equipo.fotoUrl`), la que se ve en
 * la lista. Estas acompañan en la ficha.
 */

/** 5 MB ya comprimida, igual que la principal. El navegador la achica antes. */
export const MAXIMO_BYTES_FOTO = 5 * 1024 * 1024;

/** La máquina, la chapa, el tablero, de un lado y del otro… con doce sobra. */
export const MAXIMO_FOTOS_POR_EQUIPO = 12;

export const LARGO_MAXIMO_DESCRIPCION = 100;

/** Comprueba que la imagen se pueda guardar como otra foto del equipo. */
export function validarFoto(contenido: Buffer, fotosQueYaTiene: number): void {
  if (contenido.length === 0) {
    throw new ErrorDatosInvalidos('La imagen vino vacía.');
  }
  if (contenido.length > MAXIMO_BYTES_FOTO) {
    throw new ErrorDatosInvalidos(
      `La imagen pesa ${Math.round(contenido.length / 1024 / 1024)} MB y el máximo son 5 MB.`,
    );
  }
  if (fotosQueYaTiene >= MAXIMO_FOTOS_POR_EQUIPO) {
    throw new ErrorDatosInvalidos(
      `Este equipo ya tiene ${MAXIMO_FOTOS_POR_EQUIPO} fotos, que es el máximo. ` +
        'Borrá alguna si necesitás subir otra.',
    );
  }
}

/** «Chapa característica»; vacía queda sin descripción. */
export function limpiarDescripcion(descripcion: string | null | undefined): string | null {
  const limpia = (descripcion ?? '').trim().replace(/\s+/g, ' ');
  if (limpia.length > LARGO_MAXIMO_DESCRIPCION) {
    throw new ErrorDatosInvalidos(
      `La descripción de la foto puede tener hasta ${LARGO_MAXIMO_DESCRIPCION} letras.`,
    );
  }
  return limpia || null;
}

/**
 * La ruta dentro del almacén a partir de la URL pública. Es como se borra la
 * foto principal, que solo guarda la URL.
 */
export function rutaDeUrlPublica(url: string): string | null {
  return url.split('/object/public/')[1]?.split('/').slice(1).join('/') || null;
}
