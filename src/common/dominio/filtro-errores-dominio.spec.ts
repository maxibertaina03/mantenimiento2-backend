import { ArgumentsHost } from '@nestjs/common';
import { FiltroErroresDominio } from './filtro-errores-dominio';
import * as comun from './errores';
import * as equipos from '../../contextos/equipos/dominio/errores';
import * as trabajos from '../../contextos/trabajos/dominio/errores';

/**
 * El filtro que traduce un error de negocio a una respuesta HTTP.
 *
 * Es el unico lugar donde se decide que codigo ve el frontend, y hasta ahora
 * no lo cubria ningun test: los 962 que hay prueban las reglas del dominio,
 * que no saben nada de HTTP. Al unificar los dos filtros en uno, un 403 se
 * podria haber convertido en un 400 sin que nada fallara.
 *
 * Se prueba con los errores DE CADA CONTEXTO, no con las categorias comunes:
 * lo que importa no es que la categoria traduzca bien, sino que la clase que
 * el dominio lanza de verdad siga dando el mismo codigo que antes.
 */
function responder(error: Error) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  new FiltroErroresDominio().catch(error as comun.ErrorDominio, host);

  return { codigo: status.mock.calls[0][0], cuerpo: json.mock.calls[0][0] };
}

describe('los errores de equipos', () => {
  it('no encontrado es 404', () => {
    expect(responder(new equipos.ErrorNoEncontrado('x')).codigo).toBe(404);
  });

  it('conflicto es 409: un codigo repetido no es culpa del pedido', () => {
    expect(responder(new equipos.ErrorConflicto('x')).codigo).toBe(409);
  });

  it('transicion invalida es 409', () => {
    expect(responder(new equipos.ErrorTransicionInvalida('x')).codigo).toBe(409);
  });

  it('datos invalidos es 400', () => {
    expect(responder(new equipos.ErrorDatosInvalidos('x')).codigo).toBe(400);
  });
});

describe('los errores de trabajos', () => {
  it('REGRESION: la orden de otro sigue siendo 403, no 401 ni 400', () => {
    // Antes lo daba un filtro propio que miraba la clase ErrorNoEsSuyo. Ahora
    // lo da la categoria de la que hereda. Si esto se rompiera, el frontend
    // trataria "no es tuya" como un error de formulario.
    expect(responder(new trabajos.ErrorNoEsSuyo('Es de Leandro')).codigo).toBe(403);
  });

  it('no encontrado es 404', () => {
    expect(responder(new trabajos.ErrorNoEncontrado('x')).codigo).toBe(404);
  });

  it('transicion invalida es 409: la pantalla puede ofrecer reabrirla', () => {
    expect(responder(new trabajos.ErrorTransicionInvalida('x')).codigo).toBe(409);
  });

  it('datos invalidos es 400', () => {
    expect(responder(new trabajos.ErrorDatosInvalidos('x')).codigo).toBe(400);
  });
});

describe('lo que viaja en la respuesta', () => {
  it('el mensaje del dominio se pasa tal cual: esta escrito para leerse', () => {
    const texto = 'Un trabajo es sobre una maquina de planta o sobre una PC, no sobre las dos.';
    expect(responder(new trabajos.ErrorDatosInvalidos(texto)).cuerpo.message).toBe(texto);
  });

  it('REGRESION: el nombre es el de la clase concreta, no el de la categoria', () => {
    // El frontend distingue un caso de otro por este campo. Si dijera
    // "ErrorNoAutorizado" en vez de "ErrorNoEsSuyo", dejaria de poder hacerlo.
    const { cuerpo } = responder(new trabajos.ErrorNoEsSuyo('x'));
    expect(cuerpo.error).toBe('ErrorNoEsSuyo');
    expect(cuerpo.statusCode).toBe(403);
  });

  it('el nombre de un error de equipos tampoco se pierde', () => {
    expect(responder(new equipos.ErrorConflicto('x')).cuerpo.error).toBe('ErrorConflicto');
  });
});

describe('un contexto nuevo lo hereda sin escribir nada', () => {
  it('una categoria comun extendida en otro lado traduce igual', () => {
    // Es lo que van a hacer panol, compras e informatica: extender la
    // categoria y nada mas.
    class ErrorSinStock extends comun.ErrorTransicionInvalida {}
    const { codigo, cuerpo } = responder(new ErrorSinStock('No hay stock suficiente.'));
    expect(codigo).toBe(409);
    expect(cuerpo.error).toBe('ErrorSinStock');
  });
});
