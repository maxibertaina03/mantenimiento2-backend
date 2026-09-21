import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
  ErrorDatosInvalidos,
  ErrorDominio,
  ErrorNoEncontrado,
  ErrorNoEsSuyo,
  ErrorTransicionInvalida,
} from '../dominio/errores';

/**
 * Traduce los errores del dominio de trabajos a códigos HTTP.
 *
 * Es la pieza que permite que el dominio no conozca HTTP. Sin ella, para
 * devolver un 404 habría que lanzar un `NotFoundException` de Nest desde el
 * dominio, y probar esas reglas exigiría cargar el framework entero.
 *
 * El mensaje del dominio se pasa tal cual porque está escrito para que lo lea
 * una persona: dice qué se puede hacer, no solo que algo falló.
 */
@Catch(ErrorDominio)
export class FiltroErroresTrabajo implements ExceptionFilter {
  private estadoDe(error: ErrorDominio): number {
    if (error instanceof ErrorNoEncontrado) return HttpStatus.NOT_FOUND;
    // 403 y no 401: está bien identificado, el trabajo es de otro.
    if (error instanceof ErrorNoEsSuyo) return HttpStatus.FORBIDDEN;
    // 409 y no 400: el pedido está bien formado, lo que no da es el estado en
    // el que está la orden. La pantalla puede ofrecer reabrirla.
    if (error instanceof ErrorTransicionInvalida) return HttpStatus.CONFLICT;
    if (error instanceof ErrorDatosInvalidos) return HttpStatus.BAD_REQUEST;
    return HttpStatus.BAD_REQUEST;
  }

  catch(error: ErrorDominio, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const statusCode = this.estadoDe(error);

    respuesta.status(statusCode).json({ statusCode, message: error.message, error: error.name });
  }
}
