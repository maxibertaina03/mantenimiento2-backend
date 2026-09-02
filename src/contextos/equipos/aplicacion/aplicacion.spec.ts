import { ErrorConflicto, ErrorNoEncontrado, ErrorTransicionInvalida } from '../dominio/errores';
import { RelojFijo } from '../puertos/reloj';
import { ActualizarEquipo } from './actualizar-equipo';
import { ConsultarEquipos, aEquipoParaMostrar } from './consultar-equipos';
import { CrearEquipo } from './crear-equipo';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';

/**
 * Tests de los casos de uso.
 *
 * Sin Prisma, sin Nest y sin base de datos: el repositorio es la implementación
 * en memoria del mismo puerto que usa producción. Corren en milisegundos, que
 * es lo que hace que valga la pena escribirlos con detalle.
 */
const HOY = new Date('2026-09-01T12:00:00.000Z');

function armar(
  iniciales: Parameters<typeof RepositorioEquiposEnMemoria.prototype.crear>[0][] = [],
) {
  const repo = new RepositorioEquiposEnMemoria(iniciales as never);
  return {
    repo,
    crear: new CrearEquipo(repo),
    actualizar: new ActualizarEquipo(repo),
    consultar: new ConsultarEquipos(repo, new RelojFijo(HOY)),
  };
}

describe('CrearEquipo', () => {
  it('da de alta con los datos normalizados', async () => {
    const { crear } = armar();
    const equipo = await crear.ejecutar({ nombre: '  Compresor  1 ', codigoInterno: 'comp-01' });
    expect(equipo.nombre).toBe('Compresor 1');
    expect(equipo.codigoInterno).toBe('COMP-01');
    expect(equipo.id).toBeDefined();
  });

  it('REGRESION: rechaza un codigo ya usado, y dice por quien', async () => {
    // El indice unico de la base igual lo impediria, pero con un error que no
    // le dice a nadie cual es el equipo que lo esta usando.
    const { crear } = armar();
    await crear.ejecutar({ nombre: 'Compresor 1', codigoInterno: 'COMP-01' });

    await expect(
      crear.ejecutar({ nombre: 'Compresor 2', codigoInterno: 'comp-01' }),
    ).rejects.toThrow(/ya lo usa el equipo "Compresor 1"/);
  });

  it('varios equipos sin codigo conviven sin chocar', async () => {
    // null no choca con null: si el chequeo no distinguiera, el segundo equipo
    // sin codigo seria rechazado.
    const { crear } = armar();
    await crear.ejecutar({ nombre: 'Tina 1' });
    await expect(crear.ejecutar({ nombre: 'Tina 2' })).resolves.toBeDefined();
  });

  it('el conflicto es del tipo del dominio, no de Nest', async () => {
    const { crear } = armar();
    await crear.ejecutar({ nombre: 'A', codigoInterno: 'X' });
    await expect(crear.ejecutar({ nombre: 'B', codigoInterno: 'X' })).rejects.toBeInstanceOf(
      ErrorConflicto,
    );
  });
});

describe('ActualizarEquipo', () => {
  it('REGRESION: solo toca los campos que vinieron', async () => {
    // Si tratara undefined como null, guardar la ficha con un campo oculto lo
    // borraria sin que nadie lo pida.
    const { crear, actualizar } = armar();
    const original = await crear.ejecutar({
      nombre: 'Compresor 1',
      marca: 'Atlas',
      modelo: 'GA7',
    });

    const editado = await actualizar.ejecutar(original.id, { nombre: 'Compresor uno' });
    expect(editado.nombre).toBe('Compresor uno');
    expect(editado.marca).toBe('Atlas');
    expect(editado.modelo).toBe('GA7');
  });

  it('null si borra el campo', async () => {
    const { crear, actualizar } = armar();
    const original = await crear.ejecutar({ nombre: 'Compresor', marca: 'Atlas' });
    const editado = await actualizar.ejecutar(original.id, { marca: null });
    expect(editado.marca).toBeNull();
  });

  it('editar sin cambiar el codigo no choca consigo mismo', async () => {
    const { crear, actualizar } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Compresor', codigoInterno: 'COMP-01' });
    await expect(
      actualizar.ejecutar(equipo.id, { codigoInterno: 'COMP-01', nombre: 'Otro nombre' }),
    ).resolves.toMatchObject({ codigoInterno: 'COMP-01' });
  });

  it('pero si choca con OTRO equipo, falla', async () => {
    const { crear, actualizar } = armar();
    await crear.ejecutar({ nombre: 'Compresor 1', codigoInterno: 'COMP-01' });
    const segundo = await crear.ejecutar({ nombre: 'Compresor 2', codigoInterno: 'COMP-02' });

    await expect(
      actualizar.ejecutar(segundo.id, { codigoInterno: 'COMP-01' }),
    ).rejects.toBeInstanceOf(ErrorConflicto);
  });

  it('el cambio de estado pasa por la maquina de estados', async () => {
    const { crear, actualizar } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Compresor' });

    await actualizar.ejecutar(equipo.id, { estado: 'DADO_DE_BAJA' });
    await expect(actualizar.ejecutar(equipo.id, { estado: 'OPERATIVO' })).rejects.toBeInstanceOf(
      ErrorTransicionInvalida,
    );
  });

  it('REGRESION: no se puede resucitar un equipo de baja editando la ficha', async () => {
    // Es la misma regla que arriba, pero por el camino que de verdad se usa:
    // alguien abre la ficha, cambia el desplegable y guarda.
    const { crear, actualizar } = armar();
    const equipo = await crear.ejecutar({ nombre: 'Tina 3' });
    await actualizar.ejecutar(equipo.id, { estado: 'DADO_DE_BAJA' });

    await expect(
      actualizar.ejecutar(equipo.id, { nombre: 'Tina 3 bis', estado: 'EN_REPARACION' }),
    ).rejects.toThrow(/no vuelve/i);
  });

  it('404 si el equipo no existe', async () => {
    const { actualizar } = armar();
    await expect(actualizar.ejecutar('fantasma', { nombre: 'X' })).rejects.toBeInstanceOf(
      ErrorNoEncontrado,
    );
  });
});

describe('ConsultarEquipos', () => {
  it('calcula si la garantia vencio, contra el reloj inyectado', async () => {
    const { crear, consultar } = armar();
    const equipo = await crear.ejecutar({
      nombre: 'Chiller',
      garantiaHasta: new Date('2026-08-01T00:00:00.000Z'),
    });

    await expect(consultar.obtener(equipo.id)).resolves.toMatchObject({ garantiaVencida: true });
  });

  it('REGRESION: lo derivado no se guarda, se calcula al leer', async () => {
    // Un campo garantiaVencida en la base quedaria desactualizado al dia
    // siguiente y habria que recalcularlo todas las noches.
    const repo = new RepositorioEquiposEnMemoria([
      { nombre: 'Caldera', garantiaHasta: new Date('2026-09-15T00:00:00.000Z') },
    ]);
    const antes = new ConsultarEquipos(repo, new RelojFijo(new Date('2026-09-01T00:00:00.000Z')));
    const despues = new ConsultarEquipos(repo, new RelojFijo(new Date('2026-10-01T00:00:00.000Z')));

    const listaAntes = await antes.listar({ skip: 0, take: 10 });
    const listaDespues = await despues.listar({ skip: 0, take: 10 });

    expect(listaAntes.datos[0].garantiaVencida).toBe(false);
    expect(listaDespues.datos[0].garantiaVencida).toBe(true);
  });

  it('el total refleja el filtro, no el catalogo entero', async () => {
    const { crear, consultar } = armar();
    await crear.ejecutar({ nombre: 'Compresor 1', ubicacionId: 'u1' });
    await crear.ejecutar({ nombre: 'Compresor 2', ubicacionId: 'u2' });

    const pagina = await consultar.listar({ ubicacionId: 'u1', skip: 0, take: 10 });
    expect(pagina.total).toBe(1);
    expect(pagina.datos).toHaveLength(1);
  });

  it('REGRESION: el alta y el GET devuelven la MISMA forma', async () => {
    // Si el alta respondiera sin garantiaVencida y el GET con el, la pantalla
    // mostraria distinto segun viniera de guardar o de recargar.
    const { crear, consultar } = armar();
    const creado = await crear.ejecutar({
      nombre: 'Chiller',
      garantiaHasta: new Date('2026-08-01T00:00:00.000Z'),
    });
    const leido = await consultar.obtener(creado.id);

    expect(Object.keys(aEquipoParaMostrar(creado, HOY)).sort()).toEqual(Object.keys(leido).sort());
    expect(aEquipoParaMostrar(creado, HOY).garantiaVencida).toBe(leido.garantiaVencida);
  });

  it('404 al pedir un equipo que no existe', async () => {
    const { consultar } = armar();
    await expect(consultar.obtener('fantasma')).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });
});
