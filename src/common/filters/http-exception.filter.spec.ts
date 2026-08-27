import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FiltroExcepcionesHttp } from './http-exception.filter';

/** Captura lo que el filtro escribe en la respuesta. */
function armar() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'PATCH', url: '/api/ordenes-compra/oc-1/recibir' }),
    }),
  } as any;

  const filtro = new FiltroExcepcionesHttp();
  const errores: string[] = [];
  jest.spyOn((filtro as any).logger, 'error').mockImplementation((...args: unknown[]) => {
    errores.push(args.map(String).join(' '));
  });

  return { filtro, host, status, json, errores, cuerpo: () => json.mock.calls[0][0] };
}

function errorPrisma(code: string, message = 'algo salió mal') {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: '5.22.0',
  });
}

afterEach(() => jest.restoreAllMocks());

describe('FiltroExcepcionesHttp - forma de la respuesta', () => {
  it('normaliza toda respuesta al mismo JSON', () => {
    const { filtro, host, cuerpo } = armar();
    filtro.catch(new NotFoundException('No existe el material'), host);

    expect(cuerpo()).toMatchObject({
      statusCode: 404,
      message: 'No existe el material',
      path: '/api/ordenes-compra/oc-1/recibir',
    });
    expect(cuerpo().timestamp).toBeTruthy();
  });

  it('conserva el mensaje de las excepciones de negocio', () => {
    const { filtro, host, cuerpo } = armar();
    filtro.catch(new BadRequestException('Stock insuficiente: hay 5'), host);
    expect(cuerpo().message).toBe('Stock insuficiente: hay 5');
  });
});

describe('FiltroExcepcionesHttp - errores de Prisma', () => {
  it('P2002 (único duplicado) es un 409 del cliente', () => {
    const { filtro, host, status } = armar();
    filtro.catch(errorPrisma('P2002'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('P2025 (no encontrado) es un 404', () => {
    const { filtro, host, status } = armar();
    filtro.catch(errorPrisma('P2025'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('P2003 (FK inválida) es un 400', () => {
    const { filtro, host, status } = armar();
    filtro.catch(errorPrisma('P2003'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('REGRESION: un código no mapeado (P2010) es 500, no 400', () => {
    // P2010 = query cruda inválida. Es un bug nuestro; devolverlo como 400
    // hacía parecer que el usuario había mandado algo mal.
    const { filtro, host, status } = armar();
    filtro.catch(errorPrisma('P2010', 'Raw query failed. Code: `42883`'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('REGRESION: el mensaje real de Prisma queda en el log', () => {
    // Sin esto, un fallo de SQL solo se veía como "P2010" y era imposible
    // diagnosticarlo sin reproducirlo a mano.
    const { filtro, host, errores } = armar();
    filtro.catch(errorPrisma('P2010', 'Raw query failed. Code: `42883`'), host);

    expect(errores.join('\n')).toContain('P2010');
    expect(errores.join('\n')).toContain('42883');
  });

  it('el detalle interno NO se filtra al cliente', () => {
    const { filtro, host, cuerpo } = armar();
    filtro.catch(errorPrisma('P2010', 'operator does not exist: text = uuid'), host);

    expect(String(cuerpo().message)).not.toContain('operator does not exist');
    expect(String(cuerpo().message)).toContain('P2010');
  });
});
