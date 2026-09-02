import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { RelojFijo } from '../puertos/reloj';
import { ConsultarHistorial } from './consultar-historial';
import { CrearEquipo } from './crear-equipo';
import { ActualizarEquipo } from './actualizar-equipo';
import { RegistrarIntervencion } from './registrar-intervencion';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';
import { RepositorioIntervencionesEnMemoria } from './repositorio-intervenciones-en-memoria';

/**
 * Historial de intervenciones de un equipo.
 *
 * Sin base ni framework: los dos repositorios son las implementaciones en
 * memoria de los mismos puertos que usa produccion.
 */
const HOY = new Date('2026-09-02T12:00:00.000Z');

function armar() {
  const equipos = new RepositorioEquiposEnMemoria();
  const intervenciones = new RepositorioIntervencionesEnMemoria();
  const reloj = new RelojFijo(HOY);
  return {
    equipos,
    intervenciones,
    crearEquipo: new CrearEquipo(equipos),
    actualizarEquipo: new ActualizarEquipo(equipos),
    registrar: new RegistrarIntervencion(intervenciones, equipos, reloj),
    historial: new ConsultarHistorial(intervenciones, equipos),
  };
}

const trabajo = (equipoId: string, over = {}) => ({
  equipoId,
  tipo: 'CORRECTIVO' as const,
  fecha: new Date('2026-09-01T00:00:00.000Z'),
  ejecutor: 'INTERNO' as const,
  usuarioId: 'us-1',
  descripcion: 'Se cambio la correa',
  ...over,
});

describe('RegistrarIntervencion', () => {
  it('registra el trabajo sobre el equipo', async () => {
    const { crearEquipo, registrar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });

    const i = await registrar.ejecutar(trabajo(equipo.id));
    expect(i.descripcion).toBe('Se cambio la correa');
    expect(i.id).toBeDefined();
  });

  it('404 si el equipo no existe, sin registrar nada', async () => {
    const { registrar, intervenciones } = armar();
    await expect(registrar.ejecutar(trabajo('fantasma'))).rejects.toBeInstanceOf(ErrorNoEncontrado);
    expect(intervenciones.filas).toHaveLength(0);
  });

  it('REGRESION: un equipo dado de baja no recibe intervenciones', async () => {
    // La regla vive en el dominio; el caso de uso solo le acerca el estado.
    const { crearEquipo, actualizarEquipo, registrar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Tina 3' });
    await actualizarEquipo.ejecutar(equipo.id, { estado: 'DADO_DE_BAJA' });

    await expect(registrar.ejecutar(trabajo(equipo.id))).rejects.toBeInstanceOf(
      ErrorDatosInvalidos,
    );
  });

  it('REGRESION: la fecha se valida contra el reloj inyectado', async () => {
    // Sin el reloj, este test dependeria de cuando corre.
    const { crearEquipo, registrar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Caldera' });

    await expect(
      registrar.ejecutar(trabajo(equipo.id, { fecha: new Date('2027-01-01T00:00:00.000Z') })),
    ).rejects.toThrow(/futura/i);
  });
});

describe('ConsultarHistorial', () => {
  it('devuelve el historial de la mas reciente a la mas vieja', async () => {
    const { crearEquipo, registrar, historial } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });

    await registrar.ejecutar(
      trabajo(equipo.id, { fecha: new Date('2026-03-01T00:00:00.000Z'), descripcion: 'Vieja' }),
    );
    await registrar.ejecutar(
      trabajo(equipo.id, { fecha: new Date('2026-08-01T00:00:00.000Z'), descripcion: 'Nueva' }),
    );

    const h = await historial.ejecutar(equipo.id);
    expect(h.intervenciones.map((i) => i.descripcion)).toEqual(['Nueva', 'Vieja']);
  });

  it('el resumen sale del historial, no de un contador guardado', async () => {
    const { crearEquipo, registrar, historial } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });

    await registrar.ejecutar(trabajo(equipo.id, { tipo: 'PREVENTIVO', costoManoObra: 1000 }));
    await registrar.ejecutar(trabajo(equipo.id, { tipo: 'CORRECTIVO', costoManoObra: 500 }));

    const h = await historial.ejecutar(equipo.id);
    expect(h.resumen).toMatchObject({
      cantidad: 2,
      preventivos: 1,
      correctivos: 1,
      costoTotal: 1500,
    });
  });

  it('REGRESION: el historial de un equipo no incluye el de otro', async () => {
    const { crearEquipo, registrar, historial } = armar();
    const a = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    const b = await crearEquipo.ejecutar({ nombre: 'Compresor 2' });

    await registrar.ejecutar(trabajo(a.id, { descripcion: 'Del A' }));
    await registrar.ejecutar(trabajo(b.id, { descripcion: 'Del B' }));

    const h = await historial.ejecutar(a.id);
    expect(h.intervenciones.map((i) => i.descripcion)).toEqual(['Del A']);
  });

  it('un equipo sin historial devuelve el resumen vacio, no un error', async () => {
    const { crearEquipo, historial } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Nuevo' });

    const h = await historial.ejecutar(equipo.id);
    expect(h.intervenciones).toHaveLength(0);
    expect(h.resumen.ultimaFecha).toBeNull();
  });

  it('404 si el equipo no existe', async () => {
    const { historial } = armar();
    await expect(historial.ejecutar('fantasma')).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });
});
