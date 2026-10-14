import { AppDeIntegracion, levantarApp, vaciarBase } from './app-de-integracion';

/**
 * Un equipo que sale a un taller de afuera, contra un Postgres de verdad.
 *
 * Lo que cruza dos contextos y la base: la orden de trabajo (trabajos) cambia
 * el estado de la máquina (equipos), el envío queda en su tabla, y el filtro
 * «abiertas y externas» es el que usa la pantalla de lo que está afuera.
 */
describe('Servicio externo (integración, Postgres real)', () => {
  let t: AppDeIntegracion;
  let equipoId: string;
  let proveedorId: string;

  beforeAll(async () => {
    t = await levantarApp();
  });

  afterAll(async () => {
    await t?.app.close();
  });

  beforeEach(async () => {
    await vaciarBase(t);
    equipoId = (await t.http.post('/api/equipos').send({ nombre: 'Tubo 1' }).expect(201)).body.id;
    proveedorId = (await t.prisma.proveedor.create({ data: { nombre: 'Oxígeno Central' } })).id;
  });

  const estadoDelEquipo = async () =>
    (await t.prisma.equipo.findUniqueOrThrow({ where: { id: equipoId } })).estado;

  it('sale en reparación, queda la constancia del envío, y vuelve operativo con el remito', async () => {
    const orden = await t.http
      .post('/api/ordenes-trabajo')
      .send({
        titulo: 'Llenar el tubo de oxígeno',
        tipo: 'CORRECTIVO',
        equipoId,
        ejecutor: 'EXTERNO',
        proveedorId,
      })
      .expect(201);
    expect(await estadoDelEquipo()).toBe('EN_REPARACION');

    const afuera = await t.http
      .get('/api/ordenes-trabajo')
      .query({ estado: 'ABIERTA', ejecutor: 'EXTERNO' })
      .expect(200);
    expect(afuera.body.datos.map((o: { id: string }) => o.id)).toEqual([orden.body.id]);

    await t.http
      .post(`/api/ordenes-trabajo/${orden.body.id}/registrar-whatsapp`)
      .send({ numero: '5493564123456' })
      .expect(200);
    const envios = await t.http.get(`/api/ordenes-trabajo/${orden.body.id}/envios`).expect(200);
    expect(envios.body).toEqual([
      expect.objectContaining({
        via: 'WHATSAPP',
        destinatarios: '5493564123456',
        automatico: false,
      }),
    ]);

    const cerrada = await t.http
      .post(`/api/ordenes-trabajo/${orden.body.id}/cerrar`)
      .send({
        resolucion: 'Lo llenaron y probaron la válvula',
        comprobanteExterno: 'R-0001-00004930',
        costoManoObra: 18000,
      })
      .expect(201);
    expect(cerrada.body.comprobanteExterno).toBe('R-0001-00004930');
    expect(await estadoDelEquipo()).toBe('OPERATIVO');

    const sigueAfuera = await t.http
      .get('/api/ordenes-trabajo')
      .query({ estado: 'ABIERTA', ejecutor: 'EXTERNO' })
      .expect(200);
    expect(sigueAfuera.body.datos).toEqual([]);
  });

  it('sin correo configurado en el servidor, mandarla por correo responde 503', async () => {
    const orden = await t.http
      .post('/api/ordenes-trabajo')
      .send({ titulo: 'Bobinado', tipo: 'CORRECTIVO', equipoId, ejecutor: 'EXTERNO', proveedorId })
      .expect(201);
    await t.http
      .post(`/api/ordenes-trabajo/${orden.body.id}/enviar-correo`)
      .send({ pdfBase64: 'A'.repeat(200) })
      .expect(503);
  });
});
