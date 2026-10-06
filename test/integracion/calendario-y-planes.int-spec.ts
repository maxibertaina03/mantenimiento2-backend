import {
  AppDeIntegracion,
  USUARIO,
  dia,
  levantarApp,
  lunesQueViene,
  sumarDias,
  textoDia,
  vaciarBase,
} from './app-de-integracion';

/**
 * El calendario, los planes y los trabajos, contra un Postgres de verdad.
 *
 * Es lo que el Prisma en memoria de los e2e no modela: las consultas reales
 * del calendario (los OR, los filtros por plan, «lo mío o lo de nadie»), la
 * columna INTEGER[] de los días de trabajo, y que cerrar el trabajo de un plan
 * corra el plan Y deje hecha la tarea, todo en la misma base.
 *
 * Las fechas son fijas y pasadas, así el resultado no depende del día en que
 * se corre. El reloj es el del sistema.
 */
describe('Calendario y planes (integración, Postgres real)', () => {
  let t: AppDeIntegracion;
  let equipoId: string;

  beforeAll(async () => {
    t = await levantarApp();
  });

  afterAll(async () => {
    await t?.app.close();
  });

  beforeEach(async () => {
    await vaciarBase(t);
    const eq = await t.http.post('/api/equipos').send({ nombre: 'Compresor 1' }).expect(201);
    equipoId = eq.body.id;
  });

  // Si el servidor rechaza algo, muestra por qué, y no solo el código.
  const mostrarSiFalla = <R extends { status: number; body: unknown }>(r: R): R => {
    if (r.status >= 400) console.log(r.status, JSON.stringify(r.body));
    return r;
  };

  const crearPlan = (datos: Record<string, unknown>) =>
    t.http
      .post(`/api/equipos/${equipoId}/planes`)
      .send({ nombre: 'Purga de agua', periodicidadDias: 7, ...datos })
      .expect(201);

  const tareasDelPlan = (planId: string) =>
    t.prisma.tareaProgramada.findMany({ where: { planId }, orderBy: { fecha: 'asc' } });

  it('un plan con la fecha en sábado queda para el lunes, y los días se guardan como INTEGER[]', async () => {
    // 2026-08-29 es sábado. Por defecto se trabaja de lunes a viernes.
    const plan = await crearPlan({ periodicidadDias: 1, proximaFecha: '2026-08-29' });

    expect(textoDia(plan.body.proximaFecha)).toBe('2026-08-31');
    const fila = await t.prisma.planMantenimiento.findUniqueOrThrow({
      where: { id: plan.body.id },
    });
    expect(fila.diasSemana).toEqual([1, 2, 3, 4, 5]);
  });

  it('el calendario genera la tarea del vencimiento una sola vez, aunque se mire dos veces', async () => {
    // El calendario genera cerca de hoy: la semana que viene.
    const lunes = lunesQueViene();
    const plan = await crearPlan({ proximaFecha: textoDia(lunes) });

    for (let i = 0; i < 2; i++) {
      const cal = await t.http
        .get('/api/calendario')
        .query({ desde: textoDia(sumarDias(lunes, -1)), hasta: textoDia(sumarDias(lunes, 1)) })
        .expect(200);
      const delPlan = cal.body.tareas.filter((x: { planId: string }) => x.planId === plan.body.id);
      expect(delPlan.map((x: { fecha: string }) => textoDia(x.fecha))).toEqual([textoDia(lunes)]);
    }
    expect(await tareasDelPlan(plan.body.id)).toHaveLength(1);
  });

  it('una rutina de lunes a viernes no sale el fin de semana', async () => {
    const lunes = lunesQueViene();
    await t.http
      .post('/api/calendario/rutinas')
      .send({
        titulo: 'Revisar nivel de aceite',
        cadaDias: 1,
        diasSemana: [1, 2, 3, 4, 5],
        desde: textoDia(lunes),
        equipoId,
      })
      .expect(201);

    const cal = await t.http
      .get('/api/calendario')
      .query({ desde: textoDia(lunes), hasta: textoDia(sumarDias(lunes, 6)) })
      .expect(200);

    // De lunes a viernes; el sábado y el domingo, nada.
    expect(cal.body.tareas.map((x: { fecha: string }) => textoDia(x.fecha))).toEqual(
      [0, 1, 2, 3, 4].map((n) => textoDia(sumarDias(lunes, n))),
    );
  });

  it('cerrar la orden de un plan corre el plan y deja hecha su tarea, atada a la orden', async () => {
    const plan = await crearPlan({ proximaFecha: '2026-08-31', diasSemana: [0, 1, 2, 3, 4, 5, 6] });
    const tarea = await t.http.post(`/api/calendario/planes/${plan.body.id}/tarea`).expect(201);

    const orden = await t.http
      .post('/api/ordenes-trabajo')
      .send({
        titulo: 'Purga de agua',
        tipo: 'PREVENTIVO',
        equipoId,
        planId: plan.body.id,
        fecha: '2026-09-01',
        resolucion: 'Se purgó el tanque',
      })
      .then(mostrarSiFalla);

    expect(orden.body.estado).toBe('CERRADA');
    const despues = await t.prisma.tareaProgramada.findUniqueOrThrow({
      where: { id: tarea.body.id },
    });
    expect(despues.estado).toBe('HECHA');
    expect(despues.ordenTrabajoId).toBe(orden.body.id);
    // Cada 7 días, contados desde la fecha real del trabajo.
    const fila = await t.prisma.planMantenimiento.findUniqueOrThrow({
      where: { id: plan.body.id },
    });
    expect(textoDia(fila.proximaFecha)).toBe('2026-09-08');
  });

  it('REGRESION: reabrir la orden y volver a cerrarla no cierra la tarea siguiente', async () => {
    const plan = await crearPlan({ proximaFecha: '2026-08-31', diasSemana: [0, 1, 2, 3, 4, 5, 6] });
    await t.http.post(`/api/calendario/planes/${plan.body.id}/tarea`).expect(201);
    const orden = await t.http
      .post('/api/ordenes-trabajo')
      .send({
        titulo: 'Purga de agua',
        tipo: 'PREVENTIVO',
        equipoId,
        planId: plan.body.id,
        fecha: '2026-09-01',
        resolucion: 'Se purgó el tanque',
      })
      .expect(201);
    // La del vencimiento siguiente.
    const siguiente = await t.http.post(`/api/calendario/planes/${plan.body.id}/tarea`).expect(201);

    await t.http.post(`/api/ordenes-trabajo/${orden.body.id}/reabrir`).expect(201);
    await t.http
      .post(`/api/ordenes-trabajo/${orden.body.id}/cerrar`)
      .send({ resolucion: 'Se purgó el tanque, corregido' })
      .expect(201);

    const tarea = await t.prisma.tareaProgramada.findUniqueOrThrow({
      where: { id: siguiente.body.id },
    });
    expect(tarea.estado).toBe('PENDIENTE');
  });

  it('dar por hecha la tarea de un plan cierra solo esa, deja una orden y corre el plan', async () => {
    const plan = await crearPlan({ proximaFecha: '2026-08-31', diasSemana: [0, 1, 2, 3, 4, 5, 6] });
    const tarea = await t.http.post(`/api/calendario/planes/${plan.body.id}/tarea`).expect(201);

    const hecha = await t.http
      .post(`/api/calendario/${tarea.body.id}/completar`)
      .send({ resolucion: 'Se purgó el tanque' })
      .then(mostrarSiFalla);

    expect(hecha.body.estado).toBe('HECHA');
    const tareas = await tareasDelPlan(plan.body.id);
    expect(tareas.filter((x) => x.estado === 'HECHA')).toHaveLength(1);
    expect(await t.prisma.ordenTrabajo.count({ where: { planId: plan.body.id } })).toBe(1);
    // La fecha del trabajo es la de la tarea (ya pasó): 31/8 + 7.
    const fila = await t.prisma.planMantenimiento.findUniqueOrThrow({
      where: { id: plan.body.id },
    });
    expect(textoDia(fila.proximaFecha)).toBe('2026-09-07');
  });

  it('«Hoy» muestra lo mío y lo que no es de nadie, pero no lo de otro', async () => {
    const otro = await t.prisma.usuario.create({
      data: { nombre: 'Leandro', email: 'leandro@test.local', rol: 'MANTENIMIENTO' },
    });
    const hoy = textoDia(new Date());
    // Directo en la base: lo que se prueba es la consulta de «Hoy», no la carga.
    for (const [titulo, asignadoAId] of [
      ['Lo mío', USUARIO.id],
      ['Lo de nadie', null],
      ['Lo de Leandro', otro.id],
    ] as const) {
      await t.prisma.tareaProgramada.create({ data: { titulo, fecha: dia(hoy), asignadoAId } });
    }

    const mias = await t.http.get('/api/calendario/mias').expect(200);

    expect(mias.body.map((x: { titulo: string }) => x.titulo).sort()).toEqual([
      'Lo de nadie',
      'Lo mío',
    ]);
  });
});
