import { Cofre, ErrorDeCofre, generarClave, leerClave } from './cofre';

/**
 * El cofre es la unica pieza del sistema donde un error no avisa: si el cifrado
 * estuviera mal, nada falla, nada se rompe, y las contrasenas quedarian
 * guardadas de una forma que no protege nada. Por eso se prueba a fondo.
 */
const CLAVE = leerClave(generarClave());
const OTRA_CLAVE = leerClave(generarClave());

describe('leerClave', () => {
  it('acepta una clave en base64 de 32 bytes', () => {
    expect(leerClave(generarClave())).toHaveLength(32);
  });

  it('acepta la misma clave escrita en hexadecimal', () => {
    const enHex = CLAVE.toString('hex');
    expect(leerClave(enHex).equals(CLAVE)).toBe(true);
  });

  it('REGRESION: rechaza una clave corta con un mensaje que se entiende', () => {
    // Node tambien la rechazaria, pero con un error que no dice que hacer. Una
    // clave corta es el error mas facil de cometer al configurar el entorno.
    expect(() => leerClave('abc123')).toThrow(ErrorDeCofre);
    expect(() => leerClave('abc123')).toThrow(/32 bytes/);
  });

  it('rechaza una clave vacia', () => {
    expect(() => leerClave('   ')).toThrow(ErrorDeCofre);
  });
});

describe('Cofre', () => {
  const cofre = new Cofre(CLAVE);

  it('lo que se cifra se vuelve a leer igual', () => {
    const secreto = 'Contraseña del correo 2026!';
    expect(cofre.descifrar(cofre.cifrar(secreto))).toBe(secreto);
  });

  it('aguanta acentos, enies y simbolos raros', () => {
    // Una contrasena real tiene de todo, y truncar un byte la vuelve inutil sin
    // que nadie se entere hasta que hay que usarla.
    const secreto = 'ñÁÉíöü €$%&/()=?¿¡ 汉字 🔐';
    expect(cofre.descifrar(cofre.cifrar(secreto))).toBe(secreto);
  });

  it('REGRESION: la misma contrasena cifrada dos veces da textos distintos', () => {
    // Si dieran iguales, mirando la base se sabria que credenciales comparten
    // clave sin descifrar ninguna.
    const a = cofre.cifrar('misma clave');
    const b = cofre.cifrar('misma clave');
    expect(a).not.toBe(b);
    expect(cofre.descifrar(a)).toBe(cofre.descifrar(b));
  });

  it('el texto guardado no contiene la contrasena', () => {
    const guardado = cofre.cifrar('SuperSecreta123');
    expect(guardado).not.toContain('SuperSecreta123');
  });

  it('no deja guardar un secreto vacio', () => {
    expect(() => cofre.cifrar('')).toThrow(ErrorDeCofre);
  });

  it('REGRESION: con otra clave no se puede descifrar', () => {
    // Es lo que hace que un volcado de la base no sirva por si solo.
    const guardado = cofre.cifrar('Contraseña del router');
    expect(() => new Cofre(OTRA_CLAVE).descifrar(guardado)).toThrow(/clave del cofre cambió/);
  });

  it('REGRESION: si el dato fue alterado en la base, falla en vez de devolver basura', () => {
    // GCM detecta la alteracion. Devolver algo parecido a un secreto seria peor
    // que no devolver nada: alguien lo copiaria y no entenderia por que no anda.
    const guardado = cofre.cifrar('Contraseña del router');
    const partes = guardado.split(':');
    const cuerpo = Buffer.from(partes[3], 'base64');
    cuerpo[0] = cuerpo[0] ^ 0xff;
    partes[3] = cuerpo.toString('base64');

    expect(() => cofre.descifrar(partes.join(':'))).toThrow(ErrorDeCofre);
  });

  it('rechaza un texto guardado con formato desconocido', () => {
    expect(() => cofre.descifrar('cualquier cosa')).toThrow(/formato esperado/);
  });

  it('lo guardado dice con que version fue cifrado', () => {
    // Para poder cambiar de algoritmo sin tener que descifrar todo de una, que
    // es justo el momento en que las contrasenas quedarian en claro.
    expect(cofre.cifrar('x').startsWith('v1:')).toBe(true);
  });

  describe('huella', () => {
    it('la misma contrasena da siempre la misma huella', () => {
      expect(cofre.huella('Verano2026')).toBe(cofre.huella('Verano2026'));
    });

    it('reconoce una contrasena que ya se uso', () => {
      // Es lo que permite decir «esa ya la usaste» sin guardar la vieja.
      const huella = cofre.huella('Verano2026');
      expect(cofre.coincideConLaHuella('Verano2026', huella)).toBe(true);
      expect(cofre.coincideConLaHuella('Verano2027', huella)).toBe(false);
    });

    it('la huella no contiene la contrasena', () => {
      expect(cofre.huella('Verano2026')).not.toContain('Verano2026');
    });

    it('REGRESION: con otra clave la huella es otra', () => {
      // La huella es un HMAC y no un hash a secas: sin la clave, quien tenga la
      // base no puede probar contrasenas comunes contra las huellas guardadas.
      expect(new Cofre(OTRA_CLAVE).huella('Verano2026')).not.toBe(cofre.huella('Verano2026'));
    });

    it('una huella de otro largo no rompe la comparacion', () => {
      expect(cofre.coincideConLaHuella('Verano2026', 'YWJj')).toBe(false);
    });
  });
});
