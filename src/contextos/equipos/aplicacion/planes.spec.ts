import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { RelojFijo } from '../puertos/reloj';
import { ActualizarEquipo } from './actualizar-equipo';
import { CrearEquipo } from './crear-equipo';
import { GestionarPlanes } from './gestionar-planes';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';
import { RepositorioPlanesEnMemoria } from './repositorio-planes-en-memoria';

/**
 * Planes de mantenimiento.
 *
 * El caso que importa es el ciclo completo: se define cada cuánto va un trabajo,
 * se registra que se hizo, y el plan se adelanta solo. Si ese ciclo se corta, el
 * módulo entero deja de servir para lo que se hizo. El trabajo llega desde una
 * orden de trabajo (contexto trabajos), por `adelantarDespuesDeTrabajo`.
 */
const HOY = new Date('2026-09-02T12:00:00.000Z');
const fecha = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function armar() {
  const equipos = new RepositorioEquiposEnMemoria();
  const planes = new RepositorioPlanesEnMemoria();
  const reloj = new RelojFijo(HOY);
  const gestionar = new GestionarPlanes(planes, equipos, reloj);

  return {
    equipos,
    planes,
    gestionar,
    crearEquipo: new CrearEquipo(equipos),
    actualizarEquipo: new ActualizarEquipo(equipos),
  };
}

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

describe('el ciclo completo: un trabajo hecho adelanta el plan', () => {
  it('REGRESION: la proxima fecha se cuenta desde el trabajo real', async () => {
    // Un service que tocaba el 1 de agosto y se hizo el 1 de septiembre tiene
    // el siguiente a los 90 dias de septiembre. Contarlo desde agosto lo
    // dejaria casi vencido apenas se registra.
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 90,
      proximaFecha: fecha('2026-08-01'),
    });

    await gestionar.adelantarDespuesDeTrabajo(plan.id, fecha('2026-09-01'));

    const [actualizado] = await gestionar.listarPorEquipo(equipo.id);
    expect(actualizado.proximaFecha.toISOString().slice(0, 10)).toBe('2026-11-30');
    expect(actualizado.estado).toBe('AL_DIA');
  });

  it('un plan borrado entre medio no rompe: el trabajo se registró igual', async () => {
    const { gestionar } = armar();
    await expect(
      gestionar.adelantarDespuesDeTrabajo('plan-que-no-existe', fecha('2026-09-01')),
    ).resolves.toBeUndefined();
  });
});

describe('los días que trabaja la planta', () => {
  it('REGRESION: la purga diaria del viernes no queda para el sábado: pasa al lunes', async () => {
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 1' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Purga de agua',
      periodicidadDias: 1,
      proximaFecha: fecha('2026-08-28'), // viernes
    });
    // Por defecto, lunes a viernes.
    expect(plan.diasSemana).toEqual([1, 2, 3, 4, 5]);

    await gestionar.adelantarDespuesDeTrabajo(plan.id, fecha('2026-08-28'));

    const [actualizado] = await gestionar.listarPorEquipo(equipo.id);
    expect(actualizado.proximaFecha.toISOString().slice(0, 10)).toBe('2026-08-31'); // lunes
  });

  it('un plan que también se hace los sábados sí cae el sábado', async () => {
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Caldera' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Control de presión',
      periodicidadDias: 1,
      diasSemana: [1, 2, 3, 4, 5, 6],
      proximaFecha: fecha('2026-08-28'),
    });

    await gestionar.adelantarDespuesDeTrabajo(plan.id, fecha('2026-08-28'));

    const [actualizado] = await gestionar.listarPorEquipo(equipo.id);
    expect(actualizado.proximaFecha.toISOString().slice(0, 10)).toBe('2026-08-29');
  });

  it('una fecha cargada a mano en un domingo pasa al lunes', async () => {
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 2' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 90,
      proximaFecha: fecha('2026-10-04'), // domingo
    });
    expect(plan.proximaFecha.toISOString().slice(0, 10)).toBe('2026-10-05');
  });

  it('cambiar los días al editar; sin ningún día se rechaza', async () => {
    const { crearEquipo, gestionar } = armar();
    const equipo = await crearEquipo.ejecutar({ nombre: 'Compresor 3' });
    const plan = await gestionar.crear({
      equipoId: equipo.id,
      nombre: 'Aceite',
      periodicidadDias: 7,
      proximaFecha: fecha('2026-10-05'),
    });
    const cambiado = await gestionar.actualizar(plan.id, { diasSemana: [6, 1, 1] });
    expect(cambiado.diasSemana).toEqual([1, 6]);
    await expect(gestionar.actualizar(plan.id, { diasSemana: [] })).rejects.toThrow(
      /al menos un día/,
    );
  });
});
