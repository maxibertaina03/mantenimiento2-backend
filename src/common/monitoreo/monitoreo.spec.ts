import * as Sentry from '@sentry/node';
import { _apagarMonitoreo, iniciarMonitoreo, limpiarEvento, reportarError } from './monitoreo';

jest.mock('@sentry/node', () => {
  const scope = { setTag: jest.fn() };
  return {
    init: jest.fn(),
    captureException: jest.fn(),
    withScope: (fn: (s: typeof scope) => void) => fn(scope),
  };
});

const CONTEXTO = { metodo: 'POST', ruta: '/api/ordenes-compra/x/recibir', estado: 500 };

beforeEach(() => {
  jest.clearAllMocks();
  _apagarMonitoreo();
});

describe('monitoreo de errores', () => {
  it('sin SENTRY_DSN no se prende ni reporta nada', () => {
    expect(iniciarMonitoreo('')).toBe(false);
    reportarError(new Error('x'), CONTEXTO);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('con DSN reporta los 5xx, sin mandar datos de nadie', () => {
    iniciarMonitoreo('https://clave@sentry.example/1');
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ sendDefaultPii: false, tracesSampleRate: 0 }),
    );
    const error = new Error('se cayó la base');
    reportarError(error, CONTEXTO);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('REGRESION: un 4xx es el sistema funcionando, no se reporta', () => {
    iniciarMonitoreo('https://clave@sentry.example/1');
    reportarError(new Error('falta el proveedor'), { ...CONTEXTO, estado: 400 });
    reportarError(new Error('no existe'), { ...CONTEXTO, estado: 404 });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('REGRESION: el evento sale sin cuerpo, encabezados, cookies, consulta ni usuario', () => {
    // El baúl de contraseñas recibe contraseñas en el cuerpo del pedido.
    const evento = limpiarEvento({
      type: undefined,
      request: {
        url: '/api/credenciales',
        data: { contrasenia: 'secreta' },
        headers: { authorization: 'Bearer x' },
        cookies: { s: '1' },
        query_string: 'buscar=juan',
      },
      user: { email: 'alguien@planta.com' },
    } as unknown as Sentry.ErrorEvent);

    expect(evento.request).toEqual({ url: '/api/credenciales' });
    expect(evento.user).toBeUndefined();
  });
});
