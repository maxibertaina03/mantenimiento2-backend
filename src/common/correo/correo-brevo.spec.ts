import { ConfigService } from '@nestjs/config';
import { CorreoService } from './correo.service';

/**
 * Envío por la API HTTP de Brevo.
 *
 * Existe porque Render bloquea los puertos SMTP salientes: con SMTP la conexión
 * se queda esperando y no sale ningún correo. Estos tests fijan el contrato con
 * Brevo, que es lo que no se puede verificar sin mandar un correo real.
 */
function armar(env: Record<string, string | undefined>) {
  const config = { get: (clave: string) => env[clave] } as unknown as ConfigService;
  return new CorreoService(config);
}

const CON_BREVO = {
  BREVO_API_KEY: 'xkeysib-secreta',
  MAIL_FROM: 'mantenimiento.lastres@gmail.com',
};

const mensaje = {
  para: ['ventas@ferreteria.com.ar'],
  copia: ['administracion@lacteoslastres.com.ar'],
  responderA: 'mantenimiento@lacteoslastres.com.ar',
  nombreRemitente: 'Maxi · Lácteos Las Tres S.R.L.',
  asunto: 'Orden de compra OC-2026-0002',
  texto: 'Detalle de la orden',
  adjuntos: [
    { nombre: 'OC-2026-0002.pdf', contenido: Buffer.from('%PDF-1.4'), tipo: 'application/pdf' },
  ],
};

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 201, text: async () => '{"messageId":"1"}' });
  global.fetch = fetchMock as unknown as typeof fetch;
});

/** Cuerpo JSON con el que se llamó a la API. */
function cuerpoEnviado() {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe('CorreoService por Brevo', () => {
  it('elige Brevo cuando hay API key, aunque tambien haya SMTP', () => {
    // SMTP no sirve en Render; si estan las dos, gana la que funciona.
    const servicio = armar({
      ...CON_BREVO,
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'a@b.c',
      SMTP_PASS: 'x',
    });
    expect(servicio.viaDeEnvio()).toBe('brevo');
  });

  it('cae a SMTP si no hay API key', () => {
    const servicio = armar({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@b.c', SMTP_PASS: 'x' });
    expect(servicio.viaDeEnvio()).toBe('smtp');
  });

  it('sin ninguna de las dos queda apagado, sin romper', () => {
    const servicio = armar({});
    expect(servicio.viaDeEnvio()).toBe('ninguna');
    expect(servicio.estaConfigurado()).toBe(false);
  });

  it('manda la clave en el header api-key', async () => {
    await armar(CON_BREVO).enviar(mensaje);
    expect(fetchMock.mock.calls[0][1].headers['api-key']).toBe('xkeysib-secreta');
  });

  it('arma destinatarios, copia y responderA con la forma que espera Brevo', async () => {
    await armar(CON_BREVO).enviar(mensaje);
    const cuerpo = cuerpoEnviado();
    expect(cuerpo.to).toEqual([{ email: 'ventas@ferreteria.com.ar' }]);
    expect(cuerpo.cc).toEqual([{ email: 'administracion@lacteoslastres.com.ar' }]);
    expect(cuerpo.replyTo).toEqual({ email: 'mantenimiento@lacteoslastres.com.ar' });
    expect(cuerpo.sender.email).toBe('mantenimiento.lastres@gmail.com');
  });

  it('REGRESION: el adjunto va en base64, no como Buffer serializado', async () => {
    // Un Buffer pasado por JSON.stringify sale como {"type":"Buffer","data":[...]}
    // y Brevo lo rechaza o manda un PDF corrupto.
    await armar(CON_BREVO).enviar(mensaje);
    const [adjunto] = cuerpoEnviado().attachment;
    expect(adjunto.name).toBe('OC-2026-0002.pdf');
    expect(adjunto.content).toBe(Buffer.from('%PDF-1.4').toString('base64'));
  });

  it('sin copia ni responderA, no manda esas claves vacias', async () => {
    await armar(CON_BREVO).enviar({ ...mensaje, copia: [], responderA: undefined });
    const cuerpo = cuerpoEnviado();
    expect(cuerpo).not.toHaveProperty('cc');
    expect(cuerpo).not.toHaveProperty('replyTo');
  });

  it('REGRESION: un error de Brevo conserva el cuerpo de la respuesta', async () => {
    // Brevo dice ahi exactamente que esta mal (remitente sin verificar, clave
    // invalida, cuota agotada), que es justo lo que hace falta para arreglarlo.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"code":"invalid_parameter","message":"Sender not valid"}',
    });
    await expect(armar(CON_BREVO).enviar(mensaje)).rejects.toThrow(/Sender not valid/);
  });

  it('verificar() valida la clave sin mandar ningun correo', async () => {
    const servicio = armar(CON_BREVO);
    await expect(servicio.verificar()).resolves.toMatchObject({ ok: true });
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/account');
    expect(opciones.method).toBe('GET');
  });

  it('verificar() informa el fallo con el cuerpo de Brevo', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'Key not found' });
    await expect(armar(CON_BREVO).verificar()).resolves.toMatchObject({
      ok: false,
      detalle: expect.stringContaining('Key not found'),
    });
  });

  it('REGRESION: la llamada lleva timeout, para no colgar la pantalla', async () => {
    // Es lo que fallaba con SMTP: sin timeout, la pantalla quedaba en
    // "Enviando..." hasta el timeout por defecto de la libreria.
    await armar(CON_BREVO).enviar(mensaje);
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });
});
