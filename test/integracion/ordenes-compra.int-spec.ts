import { AppDeIntegracion, levantarApp, vaciarBase } from './app-de-integracion';

/**
 * Las órdenes de compra contra Postgres real.
 *
 * Lo que el Prisma en memoria no puede mostrar: sus ids son correlativos, así
 * que ordenar por id daba el orden de carga de casualidad. En Postgres son
 * uuid al azar, y los renglones salían mezclados.
 */
describe('Órdenes de compra (integración, Postgres real)', () => {
  let t: AppDeIntegracion;
  let proveedorId: string;
  let materiales: string[];

  beforeAll(async () => {
    t = await levantarApp();
  });

  afterAll(async () => {
    await t?.app.close();
  });

  beforeEach(async () => {
    await vaciarBase(t);
    proveedorId = (await t.prisma.proveedor.create({ data: { nombre: 'Rodamientos Sur' } })).id;
    const categoria = await t.prisma.categoriaMaterial.create({ data: { nombre: 'Repuestos' } });
    materiales = [];
    // Nombres que en orden alfabético quedan al revés de la carga, para que
    // ningún orden «natural» coincida de casualidad.
    for (const nombre of ['Zapata', 'Ruleman', 'Manguera', 'Junta', 'Arandela', 'Buje']) {
      materiales.push(
        (await t.prisma.material.create({ data: { nombre, categoriaId: categoria.id } })).id,
      );
    }
  });

  const nombres = (orden: { renglones: { materialNombre: string | null }[] }) =>
    orden.renglones.map((r) => r.materialNombre);

  it('REGRESION: los renglones salen en el orden en que se cargaron', async () => {
    const creada = await t.http
      .post('/api/ordenes-compra')
      .send({
        proveedorId,
        renglones: materiales.map((materialId, i) => ({ materialId, cantidad: i + 1 })),
      })
      .expect(201);

    const esperado = ['Zapata', 'Ruleman', 'Manguera', 'Junta', 'Arandela', 'Buje'];
    expect(nombres(creada.body)).toEqual(esperado);
    const leida = await t.http.get(`/api/ordenes-compra/${creada.body.id}`).expect(200);
    expect(nombres(leida.body)).toEqual(esperado);
  });

  it('editar el borrador respeta el orden nuevo', async () => {
    const creada = await t.http
      .post('/api/ordenes-compra')
      .send({ proveedorId, renglones: [{ materialId: materiales[0], cantidad: 1 }] })
      .expect(201);

    const alReves = [...materiales].reverse();
    await t.http
      .patch(`/api/ordenes-compra/${creada.body.id}`)
      .send({ renglones: alReves.map((materialId) => ({ materialId, cantidad: 2 })) })
      .expect(200);

    const leida = await t.http.get(`/api/ordenes-compra/${creada.body.id}`).expect(200);
    expect(nombres(leida.body)).toEqual([
      'Buje',
      'Arandela',
      'Junta',
      'Manguera',
      'Ruleman',
      'Zapata',
    ]);
  });
});
