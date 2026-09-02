import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
  ErrorConflicto,
  ErrorDatosInvalidos,
  ErrorDominio,
  ErrorNoEncontrado,
  ErrorTransicionInvalida,
} from '../dominio/errores';

/**
 * Traduce los errores del dominio a códigos HTTP.
 *
 * Esta es la pieza que permite que el dominio no conozca HTTP. Sin ella, para
 * devolver un 404 habría que lanzar un `NotFoundException` de Nest desde el
 * dominio, y probar esas reglas exigiría cargar el framework entero.
 *
 * El mensaje del dominio se pasa tal cual porque está escrito para que lo lea
 * una persona: dice qué se puede hacer, no solo que algo falló.
 */
@Catch(ErrorDominio)
export class FiltroErroresDominio implements ExceptionFilter {
  private estadoDe(error: ErrorDominio): number {
    if (error instanceof ErrorNoEncontrado) return HttpStatus.NOT_FOUND;
    if (error instanceof ErrorConflicto) return HttpStatus.CONFLICT;
    if (error instanceof ErrorTransicionInvalida) return HttpStatus.CONFLICT;
    if (error instanceof ErrorDatosInvalidos) return HttpStatus.BAD_REQUEST;
    return HttpStatus.BAD_REQUEST;
  }

  catch(error: ErrorDominio, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const statusCode = this.estadoDe(error);

    respuesta.status(statusCode).json({
      statusCode,
      message: error.message,
      error: error.name,
    });
  }
}
