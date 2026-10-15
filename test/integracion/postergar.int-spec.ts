import {
  AppDeIntegracion,
  levantarApp,
  lunesQueViene,
  sumarDias,
  textoDia,
  vaciarBase,
} from './app-de-integracion';

/**
 * Respetar el calendario y postergar, contra un Postgres de verdad.
 *
 * Cruza dos contextos y la base: la tarea (trabajos) se posterga y el plan
 * (equipos) se mueve con ella; el calendario no vuelve a crear lo postergado
 * en su día original; y al completarla, el próximo respeta las fechas
 * planificadas. Las fechas son relativas a hoy porque el calendario solo
 * genera cerca de hoy y lo vencido no se posterga.
 */
describe('Postergar y respetar el calendario (integración, Postgres real)', () => {
  let t: AppDeIntegracion;
  let equipoId: string;
  const TODOS = [0, 1, 2, 3, 4, 5, 6];
  // Un día fijo dentro de una o dos semanas: nunca vencido.
  const programada = sumarDias(lunesQueViene(), 7);

  beforeAll(async () => {
    t = await levantarApp();
  });

  afterAll(async () => {
    await t?.app.close();
  });

  beforeEach(async () => {
    await vaciarBase(t);
    equipoId = (await t.http.post('/api/equipos').send({ nombre: 'Tina 2' }).expect(201)).body.id;
  });

  const mostrarSiFalla = <R extends { status: number; body: unknown }>(r: R): R => {
    if (r.status >= 400) console.log(r.status, JSON.stringify(r.body));
    return r;
  };

  const plan = async (id: string) =>
    t.prisma.planMantenimiento.findUniqueOrThrow({ where: { id } });

  it('se posterga, el plan se mueve, y al hacerla el próximo respeta el calendario', async () => {
    const creado = await t.http
      .post(`/api/equipos/${equipoId}/planes`)
      .send({
        nombre: 'Limpieza de tina',
        periodicidadDias: 14,
        diasSemana: TODOS,
        proximaFecha: textoDia(programada),
        modoProxima: 'CALENDARIO',
      })
      .expect(201);
    expect(creado.body.modoProxima).toBe('CALENDARIO');

    const tarea = await t.http.post(`/api/calendario/planes/${creado.body.id}/tarea`).expect(201);

    const movida = await t.http
      .post(`/api/calendario/${tarea.body.id}/postergar`)
      .send({ fecha: textoDia(sumarDias(programada, 2)), motivo: 'Falta el repuesto' })
      .then(mostrarSiFalla);
    expect(movida.status).toBe(201);
    expect(textoDia(movida.body.fecha)).toBe(textoDia(sumarDias(programada, 2)));
    expect(textoDia(movida.body.fechaOriginal)).toBe(textoDia(programada));
    expect(movida.body.postergaciones).toEqual([
      expect.objectContaining({ motivo: 'Falta el repuesto' }),
    ]);

    let fila = await plan(creado.body.id);
    expect(textoDia(fila.proximaFecha)).toBe(textoDia(sumarDias(programada, 2)));
    expect(textoDia(fila.postergadoDesde!)).toBe(textoDia(programada));

    // El calendario no la vuelve a crear en el día original.
    await t.http
      .get('/api/calendario')
      .query({ desde: textoDia(programada), hasta: textoDia(sumarDias(programada, 3)) })
      .expect(200);
    expect(await t.prisma.tareaProgramada.count({ where: { planId: creado.body.id } })).toBe(1);

    // Pasarse de la vez siguiente (la original + 14) no se puede.
    await t.http
      .post(`/api/calendario/${tarea.body.id}/postergar`)
      .send({ fecha: textoDia(sumarDias(programada, 14)), motivo: 'Mucho más tarde' })
      .expect(400);

    await t.http
      .post(`/api/calendario/${tarea.body.id}/completar`)
      .send({ resolucion: 'Limpieza hecha' })
      .then(mostrarSiFalla);

    // Respetando el calendario: la original + 14, no la postergada + 14.
    fila = await plan(creado.body.id);
    expect(textoDia(fila.proximaFecha)).toBe(textoDia(sumarDias(programada, 14)));
    expect(fila.postergadoDesde).toBeNull();
  });

  it('una rutina postergada no reaparece en su día original', async () => {
    await t.http
      .post('/api/calendario/rutinas')
      .send({
        titulo: 'Engrasar la cinta',
        cadaDias: 7,
        diasSemana: TODOS,
        desde: textoDia(programada),
      })
      .expect(201);
    const rango = { desde: textoDia(programada), hasta: textoDia(sumarDias(programada, 8)) };
    const antes = await t.http.get('/api/calendario').query(rango).expect(200);
    const primera = antes.body.tareas.find(
      (x: { fecha: string }) => textoDia(x.fecha) === textoDia(programada),
    );

    await t.http
      .post(`/api/calendario/${primera.id}/postergar`)
      .send({ fecha: textoDia(sumarDias(programada, 2)), motivo: 'Feriado' })
      .then(mostrarSiFalla);

    const despues = await t.http.get('/api/calendario').query(rango).expect(200);
    expect(despues.body.tareas.map((x: { fecha: string }) => textoDia(x.fecha))).toEqual([
      textoDia(sumarDias(programada, 2)),
      textoDia(sumarDias(programada, 7)),
    ]);
    expect(await t.prisma.postergacionTarea.count()).toBe(1);
  });
});
