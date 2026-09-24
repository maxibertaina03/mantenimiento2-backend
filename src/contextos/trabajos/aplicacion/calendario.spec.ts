import { ErrorNoEsSuyo, ErrorTransicionInvalida } from '../dominio/errores';
import { Reloj } from '../puertos/reloj';
import { ConsultarCalendario } from './consultar-calendario';
import { ConsultaEquiposEnMemoria } from './consulta-equipos-en-memoria';
import { ConsultaEquiposItEnMemoria } from './consulta-equipos-it-en-memoria';
import { ConsultaUsuariosEnMemoria } from './consulta-usuarios-en-memoria';
import { GestionarOrdenesTrabajo } from './gestionar-ordenes-trabajo';
import { GestionarTareas } from './gestionar-tareas';
import { PlanesEnMemoria } from './planes-en-memoria';
import { RegistrarTrabajoHecho } from './registrar-trabajo-hecho';
import { RepositorioOrdenesEnMemoria } from './repositorio-en-memoria';
import { RepositorioTareasEnMemoria } from './repositorio-tareas-en-memoria';
import { StockEnMemoria } from './stock-en-memoria';
import { UsarMateriales } from './usar-materiales';

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const HOY = dia('2026-09-22');
const reloj: Reloj = { ahora: () => HOY };

function armar(
  vencimientos: { planId: string; equipoId: string; nombre: string; fecha: Date }[] = [],
) {
  const tareas = new RepositorioTareasEnMemoria();
  const ordenes = new RepositorioOrdenesEnMemoria({ 'mat-1': 'Reten 40x72x10' });
  const stock = new StockEnMemoria();
  const equipos = new ConsultaEquiposEnMemoria([
    { id: 'eq-7', nombre: 'Bomba recibo 7', codigo: 'B-007' },
  ]);
  // El inventario de informatica: una PC, para probar que un trabajo puede ser
  // de una maquina de planta O de una PC, nunca de las dos.
  const equiposIt = new ConsultaEquiposItEnMemoria([
    { id: 'pc-1', nombre: 'Dell Optiplex', codigo: 'PC12' },
  ]);
  const usuarios = new ConsultaUsuariosEnMemoria([
    { id: 'u1', nombre: 'Facundo', puedeTrabajar: true },
    { id: 'u2', nombre: 'Leandro', puedeTrabajar: true },
    { id: 'admin', nombre: 'Administracion', puedeTrabajar: false },
  ]);
  const planes = new PlanesEnMemoria(
    [{ id: 'plan-1', equipoId: 'eq-7' }],
    vencimientos.map((v) => ({ ...v, tareas: null })),
  );

  const gestionarOrdenes = new GestionarOrdenesTrabajo(ordenes, equipos, equiposIt, usuarios, planes, reloj);
  const registrarHecho = new RegistrarTrabajoHecho(
    gestionarOrdenes,
    new UsarMateriales(ordenes, stock),
  );

  return {
    tareas,
    stock,
    planes,
    ordenes,
    calendario: new ConsultarCalendario(tareas, planes, reloj),
    gestionar: new GestionarTareas(tareas, equipos, equiposIt, usuarios, registrarHecho, reloj),
  };
}

describe('el calendario genera las tareas de los planes', () => {
  const VENCIMIENTO = {
    planId: 'plan-1',
    equipoId: 'eq-7',
    nombre: 'Cambio de aceite',
    fecha: dia('2026-09-30'),
  };

  it('un service que vence aparece como tarea, sin duenio', async () => {
    // El sistema sabe que hay que hacer un service, no sabe a quien le toca.
    const { calendario } = armar([VENCIMIENTO]);

    const mes = await calendario.entre(dia('2026-09-01'), dia('2026-09-30'));

    expect(mes.tareas).toHaveLength(1);
    expect(mes.tareas[0]).toMatchObject({
      titulo: 'Cambio de aceite',
      estado: 'PENDIENTE',
      asignadoAId: null,
      planId: 'plan-1',
      equipoId: 'eq-7',
    });
  });

  it('REGRESION: abrir el calendario dos veces no duplica nada', async () => {
    // Las tareas se generan al leer, asi que esto pasa todo el tiempo: cada vez
    // que alguien cambia de mes y vuelve.
    const { calendario } = armar([VENCIMIENTO]);

    await calendario.entre(dia('2026-09-01'), dia('2026-09-30'));
    await calendario.entre(dia('2026-09-01'), dia('2026-09-30'));
    const mes = await calendario.entre(dia('2026-09-01'), dia('2026-09-30'));

    expect(mes.tareas).toHaveLength(1);
  });

  it('REGRESION: no genera mas alla del horizonte', async () => {
    // Sin tope, alguien que navegue a 2030 dejaria miles de filas que nadie
    // pidio.
    const { calendario } = armar([{ ...VENCIMIENTO, fecha: dia('2027-06-01') }]);

    const lejos = await calendario.entre(dia('2027-06-01'), dia('2027-06-30'));

    expect(lejos.tareas).toHaveLength(0);
  });
});

describe('el calendario genera las tareas de las rutinas', () => {
  it('una rutina diaria llena los dias', async () => {
    const { calendario, gestionar } = armar();
    await gestionar.crearRutina({
      titulo: 'Revisar presion de caldera',
      cadaDias: 1,
      desde: dia('2026-09-22'),
    });

    const semana = await calendario.entre(dia('2026-09-22'), dia('2026-09-26'));

    expect(semana.tareas).toHaveLength(5);
    expect(semana.tareas.map((t) => t.titulo)).toEqual(Array(5).fill('Revisar presion de caldera'));
  });

  it('la rutina con duenio fijo reparte sola', async () => {
    const { calendario, gestionar } = armar();
    await gestionar.crearRutina({
      titulo: 'Control diario',
      cadaDias: 1,
      desde: dia('2026-09-22'),
      asignadoAId: 'u2',
    });

    const dias = await calendario.entre(dia('2026-09-22'), dia('2026-09-23'));

    expect(dias.tareas.every((t) => t.asignadoAId === 'u2')).toBe(true);
  });

  it('REGRESION: abrir el calendario dos veces no duplica las repeticiones', async () => {
    const { calendario, gestionar } = armar();
    await gestionar.crearRutina({ titulo: 'Control', cadaDias: 1, desde: dia('2026-09-22') });

    await calendario.entre(dia('2026-09-22'), dia('2026-09-25'));
    const dias = await calendario.entre(dia('2026-09-22'), dia('2026-09-25'));

    expect(dias.tareas).toHaveLength(4);
  });

  it('una rutina apagada deja de generar', async () => {
    const { calendario, gestionar } = armar();
    const rutina = await gestionar.crearRutina({
      titulo: 'Control',
      cadaDias: 1,
      desde: dia('2026-09-22'),
    });
    await gestionar.cambiarRutina(rutina.id, { activa: false });

    const dias = await calendario.entre(dia('2026-09-22'), dia('2026-09-25'));

    expect(dias.tareas).toHaveLength(0);
  });

  it('no se le asigna una rutina a alguien que no puede trabajar', async () => {
    const { gestionar } = armar();
    await expect(
      gestionar.crearRutina({
        titulo: 'Control',
        cadaDias: 1,
        desde: dia('2026-09-22'),
        asignadoAId: 'admin',
      }),
    ).rejects.toThrow(/no puede hacerse cargo/);
  });
});

describe('dar una tarea por hecha', () => {
  it('genera la orden de trabajo con lo que se uso', async () => {
    // Es el punto del modulo: el calendario y el historial de la maquina son la
    // misma historia contada dos veces, una antes y otra despues.
    const { gestionar, stock, ordenes } = armar();
    const tarea = await gestionar.crear({
      titulo: 'Cambio de reten',
      fecha: dia('2026-09-22'),
      equipoId: 'eq-7',
      asignadoAId: 'u1',
    });

    const hecha = await gestionar.completar(
      tarea.id,
      { resolucion: 'Se cambio el reten', materiales: [{ materialId: 'mat-1', cantidad: 2 }] },
      'u1',
    );

    expect(hecha.estado).toBe('HECHA');
    expect(hecha.ordenTrabajoId).not.toBeNull();
    expect(stock.asientos).toHaveLength(1);

    const orden = await ordenes.buscarPorId(hecha.ordenTrabajoId as string);
    expect(orden).toMatchObject({ estado: 'CERRADA', equipoId: 'eq-7' });
  });

  it('la orden se fecha el dia de la tarea, no el de hoy', async () => {
    // Una tarea de ayer que se cierra hoy se hizo ayer.
    const { gestionar, ordenes } = armar();
    const tarea = await gestionar.crear({
      titulo: 'Algo de ayer',
      fecha: dia('2026-09-21'),
      asignadoAId: 'u1',
    });

    const hecha = await gestionar.completar(tarea.id, { resolucion: 'Listo' }, 'u1');
    const orden = await ordenes.buscarPorId(hecha.ordenTrabajoId as string);

    expect(orden?.fecha).toEqual(dia('2026-09-21'));
  });

  it('una tarea de un plan sale como preventivo y corre el plan', async () => {
    const { calendario, gestionar, planes } = armar([
      { planId: 'plan-1', equipoId: 'eq-7', nombre: 'Cambio de aceite', fecha: dia('2026-09-25') },
    ]);
    const mes = await calendario.entre(dia('2026-09-01'), dia('2026-09-30'));

    const hecha = await gestionar.completar(
      mes.tareas[0].id,
      { resolucion: 'Se cambio el aceite' },
      'u1',
    );

    expect(hecha.estado).toBe('HECHA');
    // El service tocaba el 25 y se hizo hoy, el 22: el plan corre desde el 22,
    // que es cuando se hizo de verdad.
    expect(planes.avisos).toEqual([{ planId: 'plan-1', fecha: HOY }]);
  });

  it('REGRESION: la tarea de otro no se puede dar por hecha, y no toca el stock', async () => {
    const { gestionar, stock } = armar();
    const tarea = await gestionar.crear({
      titulo: 'Cambio de reten',
      fecha: dia('2026-09-22'),
      asignadoAId: 'u2',
    });

    await expect(
      gestionar.completar(
        tarea.id,
        { resolucion: 'La hago yo', materiales: [{ materialId: 'mat-1', cantidad: 2 }] },
        'u1',
      ),
    ).rejects.toThrow(ErrorNoEsSuyo);
    expect(stock.asientos).toHaveLength(0);
  });

  it('una sin duenio la agarra cualquiera y queda a su nombre', async () => {
    const { gestionar } = armar();
    const tarea = await gestionar.crear({ titulo: 'Service', fecha: dia('2026-09-22') });

    const hecha = await gestionar.completar(tarea.id, { resolucion: 'Hecho' }, 'u2');

    expect(hecha.asignadoAId).toBe('u2');
  });

  it('una tarea ya hecha no se vuelve a cerrar', async () => {
    const { gestionar } = armar();
    const tarea = await gestionar.crear({
      titulo: 'Service',
      fecha: dia('2026-09-22'),
      asignadoAId: 'u1',
    });
    await gestionar.completar(tarea.id, { resolucion: 'Hecho' }, 'u1');

    await expect(gestionar.completar(tarea.id, { resolucion: 'De nuevo' }, 'u1')).rejects.toThrow(
      ErrorTransicionInvalida,
    );
  });
});

describe('lo que hay que hacer hoy', () => {
  it('trae las pendientes de esa persona, incluidas las que vencieron', async () => {
    // Lo que vencio y no se hizo sigue habiendo que hacerlo; esconderlo no lo
    // resuelve.
    const { gestionar, calendario } = armar();
    await gestionar.crear({ titulo: 'De hoy', fecha: HOY, asignadoAId: 'u1' });
    await gestionar.crear({
      titulo: 'Quedo pendiente',
      fecha: dia('2026-09-18'),
      asignadoAId: 'u1',
    });
    await gestionar.crear({ titulo: 'De otro', fecha: HOY, asignadoAId: 'u2' });

    const mias = await calendario.deHoy('u1');

    expect(mias.map((t) => t.titulo).sort()).toEqual(['De hoy', 'Quedo pendiente']);
  });

  it('las hechas no vuelven a aparecer', async () => {
    const { gestionar, calendario } = armar();
    const tarea = await gestionar.crear({ titulo: 'De hoy', fecha: HOY, asignadoAId: 'u1' });
    await gestionar.completar(tarea.id, { resolucion: 'Listo' }, 'u1');

    expect(await calendario.deHoy('u1')).toHaveLength(0);
  });
});
