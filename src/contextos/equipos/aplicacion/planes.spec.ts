import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { RelojFijo } from '../puertos/reloj';
import { ActualizarEquipo } from './actualizar-equipo';
import { CrearEquipo } from './crear-equipo';
import { GestionarPlanes } from './gestionar-planes';
import { RegistrarIntervencion } from './registrar-intervencion';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';
import { RepositorioIntervencionesEnMemoria } from './repositorio-intervenciones-en-memoria';
import { RepositorioPlanesEnMemoria } from './repositorio-planes-en-memoria';

/**
 * Planes de mantenimiento y su enganche con el historial.
 *
 * El caso que importa es el ciclo completo: se define cada cuánto va un trabajo,
 * se registra que se hizo, y el plan se adelanta solo. Si ese ciclo se corta, el
 * módulo entero deja de servir para lo que se hizo.
 */
const HOY = new Date('2026-09-02T12:00:00.000Z');
const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function armar() {
  const equipos = new RepositorioEquiposEnMemoria();
  const planes = new RepositorioPlanesEnMemoria();
  const intervenciones = new RepositorioIntervencionesEnMemoria();
  const reloj = new RelojFijo(HOY);
  const gestionar = new GestionarPlanes(planes, equipos, reloj);

  return {
    equipos,
    planes,
    gestionar,
    crearEquipo: new CrearEquipo(equipos),
    actualizarEquipo: new ActualizarEquipo(equipos),
    registrar: new RegistrarIntervencion(intervenciones, equipos, reloj, gestionar),
  };
}

const trabajoBase = {
  tipo: 'PREVENTIVO' as const,
  ejecutor: 'INTERNO' as const,
  usuarioId: 'us-1',
  descripcion: 'Cambio de aceite hecho',
};

describe('GestionarPlanes', () => {
  it('crea un plan sobre un equipo', async () => {
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });

    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Cambio de aceite',
      periodicidadDias: 90,
      proximaFecha: fecha('2026-12-01'),
    });

    expect(plan.nombre).toBe('Cambio de aceite');
    expect(plan.estado).toBe('AL_DIA');
  });

  it('404 si el equipo no existe', async () => {
    const { gestionar } = armar();
    await expect(
      gestionar.crear({
        equipoId: 'fantasma',
        nombre: 'X',
        periodicidadDias: 30,
        proximaFecha: fecha('2026-12-01'),
      }),
    ).rejects.toBeInstanceOf(ErrorNoEncontrado);
  });

  it('un equipo puede tener varios planes', async () => {
    // El aceite cada 90 dias y la correa cada 365 son dos planes distintos.
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });

    await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 90,
      proximaFecha: fecha('2026-12-01'),
    });
    await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Correa',
      periodicidadDias: 365,
      proximaFecha: fecha('2027-06-01'),
    });

    expect(await gestionar.listarPorEquipo(equipo.id)).toHaveLength(2);
  });

  it('REGRESION: editar valida con los datos que quedarian', async () => {
    // "Periodicidad 0" tiene que rechazarse venga de un alta o de una edicion.
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 90,
      proximaFecha: fecha('2026-12-01'),
    });

    await expect(gestionar.actualizar(plan.id, { periodicidadDias: 0 })).rejects.toBeInstanceOf(
      ErrorDatosInvalidos,
    );
  });

  it('se puede correr la proxima fecha a mano', async () => {
    // En la practica un service se adelanta o se corre, y si el sistema no deja
    // moverla la gente deja de usarlo.
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 90,
      proximaFecha: fecha('2026-12-01'),
    });

    const movido = await gestionar.actualizar(plan.id, { proximaFecha: fecha('2026-09-05') });
    expect(movido.estado).toBe('POR_VENCER');
  });
});

describe('listarQueVencen', () => {
  it('trae lo vencido y lo que vence pronto, de lo mas urgente a lo menos', async () => {
    const { crearEquipo, gestionar, planes } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    planes.equipos.set(equipo.id, { nombre: 'Compresor 1', estado: 'OPERATIVO' });

    await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Lejos',
      periodicidadDias: 30,
      proximaFecha: fecha('2026-12-01'),
    });
    await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Vencido',
      periodicidadDias: 30,
      proximaFecha: fecha('2026-08-01'),
    });
    await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Pronto',
      periodicidadDias: 30,
      proximaFecha: fecha('2026-09-05'),
    });

    const vencen = await gestionar.listarQueVencen();
    expect(vencen.map((p) => p.nombre)).toEqual(['Vencido', 'Pronto']);
    expect(vencen[0].estado).toBe('VENCIDO');
    expect(vencen[1].estado).toBe('POR_VENCER');
  });

  it('REGRESION: un equipo desafectado no aparece', async () => {
    // No tiene sentido pedir un service para algo fuera de servicio.
    const { crearEquipo, actualizarEquipo, gestionar, planes } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Tina vieja' });
    await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 30,
      proximaFecha: fecha('2026-08-01'),
    });

    await actualizarEquipo.ejecutar(equipo.id, { estado: 'FUERA_DE_SERVICIO' });
    planes.equipos.set(equipo.id, { nombre: 'Tina vieja', estado: 'FUERA_DE_SERVICIO' });

    expect(await gestionar.listarQueVencen()).toHaveLength(0);
  });

  it('un plan desactivado tampoco', async () => {
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 30,
      proximaFecha: fecha('2026-08-01'),
    });

    await gestionar.actualizar(plan.id, { activo: false });
    expect(await gestionar.listarQueVencen()).toHaveLength(0);
  });
});

describe('el ciclo completo: registrar un trabajo adelanta el plan', () => {
  it('REGRESION: la proxima fecha se cuenta desde el trabajo real', async () => {
    // Un service que tocaba el 1 de agosto y se hizo el 1 de septiembre tiene
    // el siguiente a los 90 dias de septiembre. Contarlo desde agosto lo
    // dejaria casi vencido apenas se registra.
    const { crearEquipo, gestionar, registrar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 90,
      proximaFecha: fecha('2026-08-01'),
    });

    await registrar.ejecutar({
      ...trabajoBase,
      equipoId: equipo.id,
      planId: plan.id,
      fecha: fecha('2026-09-01'),
    });

    const [actualizado] = await gestionar.listarPorEquipo(equipo.id);
    expect(actualizado.proximaFecha.toISOString().slice(0, 10)).toBe('2026-11-30');
    expect(actualizado.estado).toBe('AL_DIA');
  });

  it('un trabajo sin plan no adelanta nada', async () => {
    // Una rotura no responde a ningun plan.
    const { crearEquipo, gestionar, registrar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 90,
      proximaFecha: fecha('2026-09-05'),
    });

    await registrar.ejecutar({
      ...trabajoBase,
      tipo: 'CORRECTIVO',
      equipoId: equipo.id,
      fecha: fecha('2026-09-01'),
    });

    const [sinTocar] = await gestionar.listarPorEquipo(equipo.id);
    expect(sinTocar.proximaFecha.toISOString().slice(0, 10)).toBe('2026-09-05');
    expect(plan.id).toBe(sinTocar.id);
  });

  it('REGRESION: si falla el registro, el plan NO se adelanta', async () => {
    // Al reves, el equipo pasaria meses sin service creyendo que esta al dia.
    const { crearEquipo, actualizarEquipo, gestionar, registrar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 90,
      proximaFecha: fecha('2026-08-01'),
    });
    await actualizarEquipo.ejecutar(equipo.id, { estado: 'DADO_DE_BAJA' });

    await expect(
      registrar.ejecutar({
        ...trabajoBase,
        equipoId: equipo.id,
        planId: plan.id,
        fecha: fecha('2026-09-01'),
      }),
    ).rejects.toThrow();

    const [sinTocar] = await gestionar.listarPorEquipo(equipo.id);
    expect(sinTocar.proximaFecha.toISOString().slice(0, 10)).toBe('2026-08-01');
  });

  it('un plan borrado entre medio no rompe el registro del trabajo', async () => {
    // El trabajo se hizo igual: perderlo por un plan que ya no está sería peor.
    const { crearEquipo, gestionar, registrar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });

    await expect(
      registrar.ejecutar({
        ...trabajoBase,
        equipoId: equipo.id,
        planId: 'plan-que-no-existe',
        fecha: fecha('2026-09-01'),
      }),
    ).resolves.toBeDefined();
  });
});
