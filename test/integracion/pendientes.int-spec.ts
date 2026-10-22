import { AppDeIntegracion, levantarApp, vaciarBase } from './app-de-integracion';

/**
 * El anotador de pendientes contra un Postgres de verdad: lo anotado se guarda
 * con su equipo, los urgentes van primero, y lo tildado pasa a «hechos».
 */
describe('Pendientes (integración, Postgres real)', () => {
  let t: AppDeIntegracion;

  beforeAll(async () => {
    t = await levantarApp();
  });

  afterAll(async () => {
    await t?.app.close();
  });

  beforeEach(async () => {
    await vaciarBase(t);
  });

  it('se anota con su equipo, los urgentes primero, y lo hecho pasa a «hechos»', async () => {
    const ubicacion = await t.prisma.ubicacionEquipo.create({ data: { nombre: 'Sala de bombas' } });
    const equipo = await t.prisma.equipo.create({
      data: { nombre: 'Bomba 2', ubicacionId: ubicacion.id },
    });

    const comun = await t.http
      .post('/api/pendientes')
      .send({ texto: '  Pedir presupuesto   de pintura ' })
      .expect(201);
    expect(comun.body.texto).toBe('Pedir presupuesto de pintura');

    const urgente = await t.http
      .post('/api/pendientes')
      .send({ texto: 'Mandar a rebobinar el motor', urgente: true, equipoId: equipo.id })
      .expect(201);
    expect(urgente.body.equipoNombre).toBe('Bomba 2');

    const abiertos = await t.http.get('/api/pendientes').expect(200);
    expect(abiertos.body.map((p: { texto: string }) => p.texto)).toEqual([
      'Mandar a rebobinar el motor',
      'Pedir presupuesto de pintura',
    ]);

    await t.http.post(`/api/pendientes/${urgente.body.id}/hecho`).expect(200);
    const despues = await t.http.get('/api/pendientes').expect(200);
    expect(despues.body).toHaveLength(1);
    const hechos = await t.http.get('/api/pendientes?estado=hechos').expect(200);
    expect(hechos.body.map((p: { id: string }) => p.id)).toEqual([urgente.body.id]);
    expect(hechos.body[0].hechaEn).toBeTruthy();

    // Dos veces no: ya está hecho.
    await t.http.post(`/api/pendientes/${urgente.body.id}/hecho`).expect(409);
    await t.http.post(`/api/pendientes/${urgente.body.id}/reabrir`).expect(200);
    expect((await t.http.get('/api/pendientes').expect(200)).body).toHaveLength(2);
  });

  it('un texto vacío no se guarda, y borrar lo saca del todo', async () => {
    await t.http.post('/api/pendientes').send({ texto: '   ' }).expect(400);

    const p = await t.http.post('/api/pendientes').send({ texto: 'Anotado de más' }).expect(201);
    await t.http.delete(`/api/pendientes/${p.body.id}`).expect(204);
    expect(await t.prisma.pendienteMantenimiento.count()).toBe(0);
  });
});
