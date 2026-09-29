import { claveDeOrden } from './clave-orden';

/** Ordena una lista de códigos igual que lo haría la base con la clave. */
function ordenar(codigos: string[]): string[] {
  return [...codigos].sort((a, b) => {
    const ca = claveDeOrden(a) ?? '';
    const cb = claveDeOrden(b) ?? '';
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });
}

describe('claveDeOrden', () => {
  it('REGRESION: PC10 va DESPUES de PC2, no antes', () => {
    // Comparando texto, "1" < "2" y PC10 quedaba primero.
    expect(ordenar(['PC10', 'PC2', 'PC1'])).toEqual(['PC1', 'PC2', 'PC10']);
  });

  it('ordena el inventario real como se lee', () => {
    const desordenado = ['PC10', 'PC CAMARAS 1', 'PC1', 'PC9', 'PCF1', 'PC2', 'PCF10', 'PCF2'];
    expect(ordenar(desordenado)).toEqual([
      // Los prefijos de varias palabras quedan en su propio grupo, antes que
      // el prefijo corto: el espacio ordena antes que cualquier dígito.
      'PC CAMARAS 1',
      'PC1',
      'PC2',
      'PC9',
      'PC10',
      'PCF1',
      'PCF2',
      'PCF10',
    ]);
  });

  it('agrupa por prefijo: primero todas las PC, después todas las PCF', () => {
    const orden = ordenar(['PCF1', 'PC2', 'PCF2', 'PC1']);
    expect(orden).toEqual(['PC1', 'PC2', 'PCF1', 'PCF2']);
  });

  it('mantiene juntos los códigos con espacios', () => {
    expect(ordenar(['IMPRESORA 2', 'IMPRESORA 10', 'IMPRESORA 1'])).toEqual([
      'IMPRESORA 1',
      'IMPRESORA 2',
      'IMPRESORA 10',
    ]);
  });

  it('no distingue mayúsculas al agrupar', () => {
    expect(claveDeOrden('Mikrotik OFICINA')).toBe(claveDeOrden('MIKROTIK OFICINA'));
  });

  it('un código sin número final queda con número 0', () => {
    expect(claveDeOrden('STARLINK OFICINA')).toBe('STARLINK OFICINA0000000000');
  });

  it('REGRESION: un espacio final no separa el grupo', () => {
    // "GRABADORA 1" tiene prefijo "GRABADORA " y "GRABADORA" tiene "GRABADORA":
    // sin recortar, caían en grupos distintos por ese espacio.
    expect(claveDeOrden('GRABADORA 1')?.startsWith('GRABADORA0')).toBe(true);
  });

  it('un código sin número va antes que el mismo prefijo numerado', () => {
    expect(ordenar(['GRABADORA 1', 'GRABADORA'])).toEqual(['GRABADORA', 'GRABADORA 1']);
  });

  it('sin código devuelve null (esos equipos van al final)', () => {
    expect(claveDeOrden(null)).toBeNull();
    expect(claveDeOrden(undefined)).toBeNull();
    expect(claveDeOrden('   ')).toBeNull();
  });

  it('normaliza los espacios de más', () => {
    expect(claveDeOrden('PC   CAMARAS   1')).toBe(claveDeOrden('PC CAMARAS 1'));
  });

  it('soporta números largos sin desbordar', () => {
    expect(ordenar(['EQ2', 'EQ1000', 'EQ100'])).toEqual(['EQ2', 'EQ100', 'EQ1000']);
  });
});
