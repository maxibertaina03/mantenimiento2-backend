import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Filtro global de excepciones.
 * Normaliza TODA respuesta de error a un JSON uniforme:
 *   { statusCode, error, message, path, timestamp }
 *
 * Traduce además los errores conocidos de Prisma a códigos HTTP claros.
 */
@Catch()
export class FiltroExcepcionesHttp implements ExceptionFilter {
  private readonly logger = new Logger(FiltroExcepcionesHttp.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let mensaje: string | string[] = 'Error interno del servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const respuesta = exception.getResponse();
      if (typeof respuesta === 'string') {
        mensaje = respuesta;
      } else if (typeof respuesta === 'object' && respuesta !== null) {
        const obj = respuesta as Record<string, unknown>;
        mensaje = (obj.message as string | string[]) ?? exception.message;
        error = (obj.error as string) ?? error;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ statusCode, mensaje, error } = this.mapearErrorPrisma(exception));
      // El mensaje que sale al cliente es deliberadamente generico (no exponemos
      // detalles del esquema), pero el real SIEMPRE tiene que quedar en el log:
      // sin esto, un error de SQL solo se veia como "P2010" y era imposible
      // diagnosticarlo sin reproducirlo a mano.
      this.logger.error(
        `${request.method} ${request.url} -> Prisma ${exception.code}: ${exception.message}`,
      );
    } else if (exception instanceof Error) {
      mensaje = exception.message;
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message: mensaje,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapearErrorPrisma(e: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    mensaje: string;
    error: string;
  } {
    switch (e.code) {
      case 'P2002': {
        const campos = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'campo único';
        return {
          statusCode: HttpStatus.CONFLICT,
          mensaje: `Ya existe un registro con ese valor (${campos}).`,
          error: 'Conflict',
        };
      }
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          mensaje: 'Referencia inválida: la entidad relacionada no existe.',
          error: 'Bad Request',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          mensaje: 'El registro solicitado no existe.',
          error: 'Not Found',
        };
      default:
        // Un codigo que no mapeamos (P2010 = query cruda invalida, por ejemplo)
        // es un problema NUESTRO, no del cliente: 500, no 400. Devolverlo como
        // 400 hacia parecer que el usuario habia mandado algo mal.
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          mensaje: `Error de base de datos (${e.code}). Quedó registrado en el servidor.`,
          error: 'Internal Server Error',
        };
    }
  }
}
