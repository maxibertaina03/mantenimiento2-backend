import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ERRORES_DE_COMPRAS,
  ErrorCorreoNoConfigurado,
  ErrorEnvioFallido,
  ErrorNoEncontrado,
} from '../dominio/errores';

/**
 * Convierte un error del dominio de compras en la excepción de Nest que se
 * lanzaba antes de mover el módulo, para que la respuesta sea la misma byte a
 * byte. Es el mismo criterio que el pañol (ver su `traducir-errores.ts`).
 *
 * Solo traduce los errores de ESTE contexto. Los rechazos de un renglón
 * (`ErrorRenglonInvalido`) ya salían por `FiltroErroresDominio`, con su propia
 * forma, y se dejan pasar para que sigan saliendo igual.
 */
function aExcepcionHttp(error: Error): HttpException {
  if (error instanceof ErrorNoEncontrado) return new NotFoundException(error.message);
  if (error instanceof ErrorCorreoNoConfigurado) {
    return new ServiceUnavailableException(error.message);
  }
  // 502 y no 503: el 503 queda para "el correo no está configurado", que es lo
  // único que justifica caer al envío manual.
  if (error instanceof ErrorEnvioFallido) return new BadGatewayException(error.message);
  return new BadRequestException(error.message);
}

function esDeCompras(error: unknown): error is Error {
  return ERRORES_DE_COMPRAS.some((clase) => error instanceof clase);
}

/** Corre `operacion` y, si el dominio de compras la rechaza, lanza la excepción HTTP equivalente. */
export async function traducirErrores<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (esDeCompras(error)) throw aExcepcionHttp(error);
    throw error;
  }
}
