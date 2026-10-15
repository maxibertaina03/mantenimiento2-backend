import { ErrorDatosInvalidos, ErrorTransicionInvalida } from '../dominio/errores';
import { postergarTarea, siguienteDeRutina, Tarea } from '../dominio/tarea';
import { Reloj } from '../puertos/reloj';
import { ConsultaEquiposEnMemoria } from './consulta-equipos-en-memoria';
import { ConsultaEquiposItEnMemoria } from './consulta-equipos-it-en-memoria';
import { ConsultaUsuariosEnMemoria } from './consulta-usuarios-en-memoria';
import { ConsultarCalendario } from './consultar-calendario';
import { GestionarOrdenesTrabajo } from './gestionar-ordenes-trabajo';
import { GestionarTareas } from './gestionar-tareas';
import { PlanesEnMemoria } from './planes-en-memoria';
import { RegistrarTrabajoDePlan } from './registrar-trabajo-de-plan';
import { RegistrarTrabajoHecho } from './registrar-trabajo-hecho';
import { RepositorioOrdenesEnMemoria } from './repositorio-en-memoria';
import { RepositorioTareasEnMemoria } from './repositorio-tareas-en-memoria';
import { StockEnMemoria } from './stock-en-memoria';
import { UsarMateriales } from './usar-materiales';

/**
 * Postergar una tarea: «la vamos a hacer, pero dos o tres días más tarde».
 * Solo si todavía no venció, con motivo, y sin comerse la vez siguiente.
 */
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const texto = (f: Date) => f.toISOString().slice(0, 10);
const HOY = dia('2026-10-09'); // viernes
const reloj: Reloj = { ahora: () => HOY };

function armar(
  vencimientos: { planId: string; equipoId: string; nombre: string; fecha: Date }[] = [],
) {
  const tareas = new RepositorioTareasEnMemoria();
  const ordenes = new RepositorioOrdenesEnMemoria();
  const equipos = new ConsultaEquiposEnMemoria([{ id: 'tina-2', nombre: 'Tina 2', codigo: null }]);
  const equiposIt = new ConsultaEquiposItEnMemoria([]);
  const usuarios = new ConsultaUsuariosEnMemoria([
    { id: 'u1', nombre: 'Facundo', puedeTrabajar: true },
  ]);
  const planes = new PlanesEnMemoria(
    [{ id: 'plan-tina', equipoId: 'tina-2' }],
    vencimientos.map((v) => ({ ...v, tareas: null })),
  );
  const gestionarOrdenes = new GestionarOrdenesTrabajo(
    ordenes,
    equipos,
    equiposIt,
    usuarios,
    planes,
    reloj,
    new RegistrarTrabajoDePlan(planes, tareas),
  );
  const registrarHecho = new RegistrarTrabajoHecho(
    gestionarOrdenes,
    new UsarMateriales(ordenes, new StockEnMemoria()),
  );
  return {
    tareas,
    planes,
    calendario: new ConsultarCalendario(tareas, planes, reloj),
    gestionar: new GestionarTareas(
      tareas,
      equipos,
      equiposIt,
      usuarios,
      registrarHecho,
      reloj,
      planes,
    ),
  };
}

describe('postergar una tarea de una rutina', () => {
  // Todos los viernes: el 9/10, el 16/10, el 23/10…
  const SEMANAL = {
    titulo: 'Engrasar la cinta',
    cadaDias: 7,
    diasSemana: [1, 2, 3, 4, 5],
    desde: dia('2026-10-09'),
  };

  it('se mueve, queda registrado por qué, y el calendario no la vuelve a crear en su día', async () => {
    const { gestionar, calendario } = armar();
    await gestionar.crearRutina(SEMANAL);
    const [delViernes] = (await calendario.entre(dia('2026-10-09'), dia('2026-10-09'))).tareas;

    const movida = await gestionar.postergar(
      delViernes.id,
      dia('2026-10-13'),
      'Falta la grasa',
      'u1',
    );
    expect(texto(movida.fecha)).toBe('2026-10-13');
    expect(texto(movida.fechaOriginal!)).toBe('2026-10-09');
    expect(movida.postergaciones).toEqual([
      expect.objectContaining({
        motivo: 'Falta la grasa',
        desde: dia('2026-10-09'),
        hasta: dia('2026-10-13'),
      }),
    ]);

    // Se vuelve a abrir el calendario: el viernes 9 no reaparece.
    const semana = (await calendario.entre(dia('2026-10-09'), dia('2026-10-16'))).tareas;
    expect(semana.map((t) => texto(t.fecha))).toEqual(['2026-10-13', '2026-10-16']);
  });

  it('no puede pasar de la vez siguiente (el viernes 16)', async () => {
    const { gestionar, calendario } = armar();
    await gestionar.crearRutina(SEMANAL);
    const [delViernes] = (await calendario.entre(dia('2026-10-09'), dia('2026-10-09'))).tareas;

    await expect(
      gestionar.postergar(delViernes.id, dia('2026-10-16'), 'Más adelante', 'u1'),
    ).rejects.toThrow(/16\/10\/2026/);
  });
});

describe('postergar la tarea de un plan', () => {
  const VENCIMIENTO = {
    planId: 'plan-tina',
    equipoId: 'tina-2',
    nombre: 'Limpieza',
    fecha: dia('2026-10-10'),
  };

  it('el plan se mueve con ella, y si lo corre a un día de trabajo la tarea va ahí', async () => {
    const { gestionar, calendario, planes } = armar([VENCIMIENTO]);
    // Como el plan de verdad: el domingo pasa al lunes.
    planes.reglaDePostergar = (_id, fecha) =>
      texto(fecha) === '2026-10-11' ? dia('2026-10-12') : fecha;
    const [tarea] = (await calendario.entre(dia('2026-10-10'), dia('2026-10-10'))).tareas;

    const movida = await gestionar.postergar(tarea.id, dia('2026-10-11'), 'Llueve', 'u1');
    expect(planes.postergaciones).toEqual([{ planId: 'plan-tina', fecha: dia('2026-10-12') }]);
    expect(texto(movida.fecha)).toBe('2026-10-12');
  });

  it('si el plan la rechaza, la tarea queda como estaba', async () => {
    const { gestionar, calendario, planes, tareas } = armar([VENCIMIENTO]);
    planes.reglaDePostergar = () => {
      throw new ErrorDatosInvalidos('Se puede postergar hasta antes del 24/10/2026');
    };
    const [tarea] = (await calendario.entre(dia('2026-10-10'), dia('2026-10-10'))).tareas;

    await expect(gestionar.postergar(tarea.id, dia('2026-10-30'), 'Mucho', 'u1')).rejects.toThrow(
      /24\/10/,
    );
    expect(texto((await tareas.buscarPorId(tarea.id))!.fecha)).toBe('2026-10-10');
  });

  it('vencida, se rechaza sin tocar el plan', async () => {
    const { gestionar, calendario, planes } = armar([{ ...VENCIMIENTO, fecha: dia('2026-10-08') }]);
    const [tarea] = (await calendario.entre(dia('2026-10-08'), dia('2026-10-08'))).tareas;

    await expect(gestionar.postergar(tarea.id, dia('2026-10-13'), 'Tarde', 'u1')).rejects.toThrow(
      ErrorTransicionInvalida,
    );
    expect(planes.postergaciones).toEqual([]);
  });
});

describe('las reglas de postergar', () => {
  const tarea = (cambios: Partial<Tarea> = {}): Tarea => ({
    id: 't',
    titulo: 'Engrasar',
    descripcion: null,
    fecha: dia('2026-10-10'),
    fechaOriginal: null,
    estado: 'PENDIENTE',
    asignadoAId: null,
    equipoId: null,
    equipoItId: null,
    planId: null,
    rutinaId: null,
    ordenTrabajoId: null,
    creadaPorId: null,
    creadoEn: HOY,
    ...cambios,
  });

  it('sin motivo, no', () => {
    expect(() => postergarTarea(tarea(), dia('2026-10-12'), '  ', HOY)).toThrow(/por qué/);
  });

  it('a una fecha anterior o igual, no', () => {
    expect(() => postergarTarea(tarea(), dia('2026-10-10'), 'Motivo', HOY)).toThrow(/posterior/);
  });

  it('una ya hecha, no', () => {
    expect(() =>
      postergarTarea(tarea({ estado: 'HECHA' }), dia('2026-10-12'), 'Motivo', HOY),
    ).toThrow(/hecha/);
  });

  it('la que vence hoy, sí: todavía no venció', () => {
    expect(() =>
      postergarTarea(tarea({ fecha: HOY }), dia('2026-10-12'), 'Motivo', HOY),
    ).not.toThrow();
  });

  it('postergada dos veces, conserva el día original de la primera', () => {
    const una = tarea({ fecha: dia('2026-10-12'), fechaOriginal: dia('2026-10-10') });
    expect(
      texto(postergarTarea(una, dia('2026-10-14'), 'Otra vez', HOY).cambios.fechaOriginal!),
    ).toBe('2026-10-10');
  });

  it('la vez siguiente de una rutina semanal de los viernes es el viernes que viene', () => {
    const rutina = {
      id: 'r',
      titulo: 'x',
      descripcion: null,
      cadaDias: 7,
      diasSemana: [1, 2, 3, 4, 5],
      desde: dia('2026-10-09'),
      hasta: null,
      equipoId: null,
      equipoItId: null,
      asignadoAId: null,
      activa: true,
      creadaPorId: null,
      creadoEn: HOY,
    };
    expect(texto(siguienteDeRutina(rutina, dia('2026-10-09'))!)).toBe('2026-10-16');
  });
});
