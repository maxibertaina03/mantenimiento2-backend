import { explicarErrorSmtp } from './correo.service';

/**
 * Cada fallo de SMTP se arregla de una forma distinta, y el codigo crudo no le
 * dice nada a quien esta usando el sistema. Estos tests fijan que el mensaje
 * diga QUE hacer, no solo que fallo.
 */
describe('explicarErrorSmtp', () => {
  it('un puerto bloqueado sugiere probar el 465', () => {
    const texto = explicarErrorSmtp({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' });
    expect(texto).toMatch(/bloquea el puerto SMTP/i);
    expect(texto).toMatch(/465/);
  });

  it.each(['ECONNECTION', 'ESOCKET'])('%s tambien se lee como problema de red', (code) => {
    expect(explicarErrorSmtp({ code, message: 'x' })).toMatch(/no se pudo conectar/i);
  });

  it('credenciales rechazadas apuntan a la contrasena de aplicacion', () => {
    const texto = explicarErrorSmtp({ code: 'EAUTH', message: 'Invalid login' });
    expect(texto).toMatch(/contraseña de aplicación/i);
    expect(texto).toMatch(/16 caracteres/);
  });

  it('el 535 de Gmail se reconoce aunque no venga el code', () => {
    expect(explicarErrorSmtp({ responseCode: 535, message: '535-5.7.8' })).toMatch(
      /contraseña de aplicación/i,
    );
  });

  it('una direccion invalida se distingue de un problema de red', () => {
    expect(explicarErrorSmtp({ code: 'EENVELOPE', message: 'bad address' })).toMatch(
      /dirección de correo es inválida/i,
    );
  });

  it('un rechazo por tamano menciona el adjunto', () => {
    expect(explicarErrorSmtp({ responseCode: 552, message: 'too big' })).toMatch(/adjunto/i);
  });

  it('un error desconocido conserva su mensaje original', () => {
    // Preferible a tragarselo: aunque no lo sepamos traducir, sirve para
    // diagnosticar.
    expect(explicarErrorSmtp(new Error('algo raro paso'))).toBe('algo raro paso');
  });
});
