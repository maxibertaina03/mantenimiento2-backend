import { claveDeComparacion, normalizarNombreMaterial, sonElMismoNombre } from './nombre-material';

describe('normalizarNombreMaterial', () => {
  it('saca los espacios de sobra y los dobles', () => {
    // Quien lo escribe no ve la diferencia, y guardarlos crea dos materiales.
    expect(normalizarNombreMaterial('  Rodamiento   6204 ')).toBe('Rodamiento 6204');
  });

  it('no toca lo que ya esta bien escrito', () => {
    expect(normalizarNombreMaterial('Tornillo inox 5/16" x 2"')).toBe('Tornillo inox 5/16" x 2"');
  });

  it('respeta las mayusculas como las escribio la persona', () => {
    // Se comparan sin distinguirlas, pero se guardan tal cual.
    expect(normalizarNombreMaterial('Cable NYA 2,5mm')).toBe('Cable NYA 2,5mm');
  });
});

describe('claveDeComparacion', () => {
  it('ignora mayusculas, acentos y espacios repetidos', () => {
    expect(claveDeComparacion('  RODAMIÉNTO   6204 ')).toBe('rodamiento 6204');
  });
});

describe('sonElMismoNombre', () => {
  it('REGRESION: solo cambiando mayusculas es el mismo material', () => {
    // La carga rapida desde la orden de compra lo hace facil: ahi se escribe de
    // memoria, sin mirar el catalogo. Dos fichas parten el stock en dos.
    expect(sonElMismoNombre('Rodamiento 6204', 'RODAMIENTO 6204')).toBe(true);
  });

  it('los espacios de mas no hacen otro material', () => {
    expect(sonElMismoNombre('Rodamiento 6204', 'Rodamiento  6204')).toBe(true);
  });

  it('los acentos tampoco', () => {
    expect(sonElMismoNombre('Válvula 2"', 'Valvula 2"')).toBe(true);
  });

  it('dos medidas distintas SI son materiales distintos', () => {
    // El limite importa: si la comparacion fuera mas laxa, bloquearia altas
    // legitimas y la gente terminaria inventando nombres para esquivarla.
    expect(sonElMismoNombre('Rodamiento 6204', 'Rodamiento 6205')).toBe(false);
    expect(sonElMismoNombre('Tornillo 5/16 x 2', 'Tornillo 5/16 x 3')).toBe(false);
  });

  it('el plural es otro nombre: no se adivina', () => {
    expect(sonElMismoNombre('Rodamiento', 'Rodamientos')).toBe(false);
  });
});
