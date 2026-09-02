import { ImportarEquipos } from './importar-equipos';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';
import { RepositorioUbicacionesEnMemoria } from './repositorio-ubicaciones-en-memoria';

/**
 * Importación masiva de equipos.
 *
 * Los casos vienen de correr la detección contra la carpeta real: 389 equipos
 * en 17 sectores. Con ese volumen, las dos propiedades que importan son que se
 * pueda repetir sin duplicar y que una fila mala no frene a las otras 388.
 */
function armar(ubicacionesIniciales: string[] = []) {
  const equipos = new RepositorioEquiposEnMemoria();
  const ubicaciones = new RepositorioUbicacionesEnMemoria(ubicacionesIniciales);
  return { equipos, ubicaciones, importar: new ImportarEquipos(equipos, ubicaciones) };
}

describe('ImportarEquipos', () => {
  it('crea los equipos y las ubicaciones que faltan', async () => {
    const { importar } = armar();
    const r = await importar.ejecutar([
      { nombre: 'Bomba caldera 1', ubicacion: 'Caldera' },
      { nombre: 'Tina 1', ubicacion: 'Tinas' },
    ]);

    expect(r.creados).toBe(2);
    expect(r.ubicacionesCreadas).toEqual(['Caldera', 'Tinas']);
  });

  it('REGRESION: correrla dos veces no duplica nada', async () => {
    // Pasa: alguien no está seguro de si funcionó y la corre de nuevo. Sin
    // esto quedarían 778 equipos donde hay 389, y limpiarlo sería a mano.
    const { importar, equipos } = armar();
    const filas = [
      { nombre: 'Bomba caldera 1', ubicacion: 'Caldera' },
      { nombre: 'Compresor 1', ubicacion: 'Caldera' },
    ];

    await importar.ejecutar(filas);
    const segunda = await importar.ejecutar(filas);

    expect(segunda.creados).toBe(0);
    expect(segunda.yaExistian).toBe(2);
    expect((await equipos.listar({ skip: 0, take: 100 })).total).toBe(2);
  });

  it('REGRESION: reutiliza la ubicacion aunque cambie la mayuscula', async () => {
    // En las carpetas hay "PRETRATAMIENTO DE LECHE" en mayúsculas. Sin
    // comparación insensible se crearía otra al lado de la que ya existe y los
    // equipos quedarían repartidos entre las dos.
    const { importar, ubicaciones } = armar(['Pretratamiento de leche']);
    const r = await importar.ejecutar([
      { nombre: 'Bomba 1', ubicacion: 'PRETRATAMIENTO DE LECHE' },
    ]);

    expect(r.ubicacionesCreadas).toEqual([]);
    expect(ubicaciones.filas).toHaveLength(1);
  });

  it('el mismo nombre en sectores distintos son dos equipos', async () => {
    // "Tablero 1" en Caldera y en Tinas son dos tableros reales.
    const { importar } = armar();
    const r = await importar.ejecutar([
      { nombre: 'Tablero 1', ubicacion: 'Caldera' },
      { nombre: 'Tablero 1', ubicacion: 'Tinas' },
    ]);
    expect(r.creados).toBe(2);
  });

  it('REGRESION: una fila mala no frena a las demas', async () => {
    // Con 389 filas, cortar en la primera que falla obliga a arreglar y
    // reintentar entero cada vez, y nunca se termina de importar.
    const { importar } = armar();
    const r = await importar.ejecutar([
      { nombre: 'Bomba caldera 1', ubicacion: 'Caldera' },
      { nombre: '   ', ubicacion: 'Caldera' }, // sin nombre: el dominio la rechaza
      { nombre: 'Compresor 1', ubicacion: 'Caldera' },
    ]);

    expect(r.creados).toBe(2);
    expect(r.fallidos).toHaveLength(1);
  });

  it('el fallo dice por que, no solo que fallo', async () => {
    const { importar } = armar();
    const r = await importar.ejecutar([{ nombre: '  ', ubicacion: 'Caldera' }]);
    expect(r.fallidos[0].motivo).toMatch(/necesita un nombre/i);
  });

  it('las altas pasan por el dominio, no lo saltean', async () => {
    // La importación no es una puerta trasera: el nombre se normaliza igual
    // que en un alta manual.
    const { importar, equipos } = armar();
    await importar.ejecutar([{ nombre: '  Bomba   caldera 1 ', ubicacion: 'Caldera' }]);

    const pagina = await equipos.listar({ skip: 0, take: 10 });
    expect(pagina.datos[0].nombre).toBe('Bomba caldera 1');
    expect(pagina.datos[0].estado).toBe('OPERATIVO');
  });

  it('resuelve cada ubicacion una sola vez', async () => {
    const { importar, ubicaciones } = armar();
    const espia = jest.spyOn(ubicaciones, 'buscarPorNombre');

    await importar.ejecutar([
      { nombre: 'A', ubicacion: 'Caldera' },
      { nombre: 'B', ubicacion: 'Caldera' },
      { nombre: 'C', ubicacion: 'Caldera' },
      { nombre: 'D', ubicacion: 'Tinas' },
    ]);

    expect(espia).toHaveBeenCalledTimes(2);
  });

  it('REGRESION: no consulta la base una vez por fila', async () => {
    // Preguntando fila por fila, importar 341 equipos eran 682 viajes a una
    // base que esta en otro continente, y el proceso se murio a los 129.
    const { importar, equipos } = armar();
    const espiaUno = jest.spyOn(equipos, 'buscarPorNombreYUbicacion');
    const espiaTodos = jest.spyOn(equipos, 'listarNombresPorUbicaciones');

    const filas = Array.from({ length: 200 }, (_, i) => ({
      nombre: `Equipo ${i}`,
      ubicacion: 'Caldera',
    }));
    await importar.ejecutar(filas);

    expect(espiaUno).not.toHaveBeenCalled();
    expect(espiaTodos).toHaveBeenCalledTimes(1);
  });

  it('inserta en tandas, no de a uno', async () => {
    const { importar, equipos } = armar();
    const espia = jest.spyOn(equipos, 'crearVarios');

    const filas = Array.from({ length: 250 }, (_, i) => ({
      nombre: `Equipo ${i}`,
      ubicacion: 'Caldera',
    }));
    const r = await importar.ejecutar(filas);

    expect(r.creados).toBe(250);
    expect(espia).toHaveBeenCalledTimes(3); // 100 + 100 + 50
  });

  it('REGRESION: dos filas iguales en el mismo archivo entran una sola vez', async () => {
    // El archivo lo arma una persona: puede traer la misma fila repetida, y sin
    // esto la tanda crearia las dos.
    const { importar } = armar();
    const r = await importar.ejecutar([
      { nombre: 'Compresor 1', ubicacion: 'Caldera' },
      { nombre: 'compresor 1', ubicacion: 'Caldera' },
    ]);

    expect(r.creados).toBe(1);
    expect(r.yaExistian).toBe(1);
  });

  it('si una tanda falla, reintenta fila por fila', async () => {
    // Para no perder las 99 que estaban bien por culpa de una.
    const { importar, equipos } = armar();
    jest.spyOn(equipos, 'crearVarios').mockRejectedValueOnce(new Error('la tanda fallo'));

    const r = await importar.ejecutar([
      { nombre: 'A', ubicacion: 'Caldera' },
      { nombre: 'B', ubicacion: 'Caldera' },
    ]);

    expect(r.creados).toBe(2);
    expect(r.fallidos).toHaveLength(0);
  });

  it('una lista vacia no rompe', async () => {
    const { importar } = armar();
    await expect(importar.ejecutar([])).resolves.toMatchObject({ creados: 0, fallidos: [] });
  });
});
