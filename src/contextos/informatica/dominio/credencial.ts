import { buscarNombreRepetido, normalizarNombre } from '../../../common/dominio/nombres';
import { ErrorDatosInvalidos, ErrorNombreRepetido, ErrorSinIdentificar } from './errores';
import { calcularProximaRotacion } from './rotacion';

/**
 * El baúl de credenciales.
 *
 * Tres reglas lo definen, y ninguna es opcional:
 *
 * 1. La contraseña se guarda cifrada con una clave que vive fuera de la base.
 * 2. La contraseña nunca sale en un listado. Verla es un pedido aparte, y ese
 *    pedido queda anotado con quién y cuándo.
 * 3. Una contraseña que ya se usó no se puede volver a usar. Del historial se
 *    guarda la huella, nunca el valor: si algo se filtrara alguna vez, se
 *    pierde la clave vigente y no todas las que se usaron.
 *
 * Este archivo tiene las reglas y nada más: no sabe cifrar, no sabe guardar y
 * no sabe de HTTP. Lo que necesita del mundo —la lista de nombres que ya
 * existen, las huellas de las contraseñas usadas— se lo pasa quien lo llama.
 */

export const TIPOS_CREDENCIAL = [
  'CORREO',
  'ACCESO_REMOTO',
  'EQUIPO',
  'SERVICIO',
  'RED',
  'OTRO',
] as const;
export type TipoCredencial = (typeof TIPOS_CREDENCIAL)[number];

export interface Credencial {
  id: string;
  nombre: string;
  tipo: TipoCredencial;
  usuario: string | null;
  url: string | null;
  notas: string | null;
  equipoItId: string | null;
  /** Cada cuántos días hay que cambiarla. `null` es "no hace falta". */
  rotarCadaDias: number | null;
  proximaRotacion: Date | null;
  rotadaEn: Date | null;
  activo: boolean;
  creadoEn: Date;
}

export interface DatosNuevaCredencial {
  nombre: string;
  secreto: string;
  tipo?: TipoCredencial;
  usuario?: string | null;
  url?: string | null;
  notas?: string | null;
  equipoItId?: string | null;
  rotarCadaDias?: number | null;
}

/** Lo que se puede cambiar sin rotar. */
export interface CambiosCredencial {
  nombre?: string;
  tipo?: TipoCredencial;
  usuario?: string | null;
  url?: string | null;
  notas?: string | null;
  equipoItId?: string | null;
  rotarCadaDias?: number | null;
  activo?: boolean;
}

/** Deja el texto en una línea de espacios simples, o `null` si quedó vacío. */
function limpiar(texto: string | null | undefined): string | null {
  const limpio = (texto ?? '').trim().replace(/\s+/g, ' ');
  return limpio === '' ? null : limpio;
}

/**
 * Dos credenciales con el mismo nombre son indistinguibles en la pantalla, y en
 * un baúl eso lleva a probar la contraseña equivocada en el lugar equivocado.
 *
 * Compara contra los nombres que ya existen, que se los pasa quien llama: el
 * dominio no sabe ir a buscarlos.
 */
export function validarNombreLibre(
  nombre: string,
  existentes: { id: string; nombre: string }[],
  exceptoId?: string,
): void {
  const choque = buscarNombreRepetido(existentes, nombre, exceptoId);
  if (choque) {
    throw new ErrorNombreRepetido(
      `Ya hay una credencial llamada "${choque.nombre}". Usá esa, o ponele un nombre que las distinga.`,
    );
  }
}

/**
 * Arma una credencial nueva a partir de lo que llegó.
 *
 * Devuelve los datos ya normalizados; cifrar el secreto y guardarlo es trabajo
 * de otra capa. Acá solo se decide qué es válido.
 */
export function crearCredencial(
  datos: DatosNuevaCredencial,
  ahora: Date,
): Omit<Credencial, 'id' | 'creadoEn'> {
  const nombre = limpiar(datos.nombre);
  if (nombre === null) {
    throw new ErrorDatosInvalidos('La credencial necesita un nombre para poder encontrarla.');
  }

  if (!datos.secreto || datos.secreto.trim() === '') {
    throw new ErrorDatosInvalidos('Falta la contraseña que hay que guardar.');
  }

  const rotarCadaDias = datos.rotarCadaDias ?? null;
  if (rotarCadaDias !== null && (!Number.isInteger(rotarCadaDias) || rotarCadaDias < 1)) {
    throw new ErrorDatosInvalidos(
      'Cada cuántos días rotar tiene que ser un número de días desde 1.',
    );
  }

  return {
    nombre: normalizarNombre(nombre),
    tipo: datos.tipo ?? 'OTRO',
    usuario: limpiar(datos.usuario),
    url: limpiar(datos.url),
    notas: limpiar(datos.notas),
    equipoItId: datos.equipoItId ?? null,
    rotarCadaDias,
    // Se cuenta desde que se guarda: es la primera vez que esta contraseña
    // empieza a correr.
    rotadaEn: ahora,
    proximaRotacion: calcularProximaRotacion(ahora, rotarCadaDias),
    activo: true,
  };
}

/**
 * La contraseña no se edita: se rota.
 *
 * Si se pudiera cambiar editando, habría un camino para cambiarla sin que
 * quede registro, y el historial dejaría de contar la verdad.
 */
export function validarQueNoTraeSecreto(cambios: Record<string, unknown>): void {
  if ('secreto' in cambios) {
    throw new ErrorDatosInvalidos(
      'La contraseña no se cambia editando: se rota, para que quede registrado cuándo cambió.',
    );
  }
}

/**
 * Comprueba que la contraseña nueva no sea una que ya se usó.
 *
 * `yaSeUso` lo resuelve quien llama, porque comparar huellas es trabajo del
 * cofre y el dominio no sabe de criptografía. Acá está la regla, que es otra
 * cosa: rotar hacia una clave vieja deja el sistema diciendo que se rotó
 * cuando en la práctica no cambió nada.
 */
export function validarSecretoNuevo(yaSeUso: boolean): void {
  if (yaSeUso) {
    throw new ErrorDatosInvalidos(
      'Esa contraseña ya se usó en esta credencial. Poné una que no hayas usado antes: ' +
        'volver a una vieja deja el registro diciendo que rotaste cuando en realidad no cambió nada.',
    );
  }
}

/**
 * Sin saber quién pide la contraseña, no se entrega.
 *
 * La única protección real de este baúl, además del cifrado, es poder decir
 * después quién miró qué. Entregarla sin poder anotar quién la pidió convierte
 * el registro en una lista incompleta, que es peor que no tener registro: da
 * una seguridad que no existe.
 */
export function validarQuePuedeVerla(
  usuarioId: string | null | undefined,
): asserts usuarioId is string {
  if (!usuarioId) {
    throw new ErrorSinIdentificar(
      'El baúl necesita saber quién está pidiendo la contraseña, y este servidor tiene la ' +
        'autenticación desactivada (AUTH_DISABLED). Entrá con tu usuario para poder verla.',
    );
  }
}

/** Los cambios ya normalizados, listos para guardar. */
export function aplicarCambios(cambios: CambiosCredencial): CambiosCredencial {
  const salida: CambiosCredencial = {};

  if (cambios.nombre !== undefined) {
    const nombre = limpiar(cambios.nombre);
    if (nombre === null) {
      throw new ErrorDatosInvalidos('La credencial necesita un nombre para poder encontrarla.');
    }
    salida.nombre = normalizarNombre(nombre);
  }

  if (cambios.tipo !== undefined) salida.tipo = cambios.tipo;
  if (cambios.usuario !== undefined) salida.usuario = limpiar(cambios.usuario);
  if (cambios.url !== undefined) salida.url = limpiar(cambios.url);
  if (cambios.notas !== undefined) salida.notas = limpiar(cambios.notas);
  if (cambios.equipoItId !== undefined) salida.equipoItId = cambios.equipoItId;
  if (cambios.rotarCadaDias !== undefined) salida.rotarCadaDias = cambios.rotarCadaDias;
  if (cambios.activo !== undefined) salida.activo = cambios.activo;

  return salida;
}
