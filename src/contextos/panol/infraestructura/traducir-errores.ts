import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import {
  ErrorConflicto,
  ErrorDominio,
  ErrorNoAutorizado,
  ErrorNoEncontrado,
  ErrorTransicionInvalida,
} from '../../../common/dominio/errores';

/**
 * Convierte un error del dominio del pañol en la excepción de Nest que se
 * lanzaba antes de mover el módulo.
 *
 * Los otros contextos usan `FiltroErroresDominio`, que responde con otra forma
 * —el nombre de la clase en `error`, sin `path` ni `timestamp`—. El pañol no,
 * a propósito, por dos razones:
 *
 * - Un refactor no cambia lo que ve el frontend. Con esto la respuesta es la
 *   misma byte a byte: `{ statusCode, error: "Bad Request", message, path,
 *   timestamp }`, armada por el filtro global de siempre.
 *
 * - Al pañol lo llaman otros módulos: órdenes de compra, que no es un contexto
 *   y no tiene el filtro de dominio, y órdenes de trabajo. Si el error del
 *   dominio les llegara crudo, compras lo vería como un error cualquiera y
 *   contestaría 500 a un "stock insuficiente". Traducido acá, les llega lo
 *   mismo que les llegaba antes.
 */
export function aExcepcionHttp(error: ErrorDominio): HttpException {
  if (error instanceof ErrorNoEncontrado) return new NotFoundException(error.message);
  if (error instanceof ErrorNoAutorizado) return new ForbiddenException(error.message);
  if (error instanceof ErrorConflicto || error instanceof ErrorTransicionInvalida) {
    return new ConflictException(error.message);
  }
  return new BadRequestException(error.message);
}

/** Corre `operacion` y, si el dominio la rechaza, lanza la excepción HTTP equivalente. */
export async function traducirErrores<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (error instanceof ErrorDominio) throw aExcepcionHttp(error);
    throw error;
  }
}
