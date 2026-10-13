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

  describe('recepción en varias entregas (la OC-2026-0028)', () => {
    const emitida = async (renglones: Record<string, unknown>[]) => {
      const creada = await t.http
        .post('/api/ordenes-compra')
        .send({ proveedorId, renglones })
        .expect(201);
      await t.http.patch(`/api/ordenes-compra/${creada.body.id}/emitir`).expect(200);
      return creada.body;
    };
    const stock = async (id: string) =>
      Number((await t.prisma.material.findUniqueOrThrow({ where: { id } })).stockActual);

    it('llegó una parte: suma solo eso, queda «Recibida en parte», y la segunda entrega la completa', async () => {
      const [artefacto, acrilico] = materiales;
      const orden = await emitida([
        { materialId: artefacto, cantidad: 10 },
        { materialId: acrilico, cantidad: 10 },
      ]);
      const [rArt, rAcr] = orden.renglones;

      const primera = await t.http
        .patch(`/api/ordenes-compra/${orden.id}/recibir`)
        .send({
          remito: '0001-0001',
          renglones: [
            { renglonId: rArt.id, cantidad: 10 },
            { renglonId: rAcr.id, cantidad: 0 },
          ],
        })
        .expect(200);

      expect(primera.body.estado).toBe('RECIBIDA_PARCIAL');
      expect(await stock(artefacto)).toBe(10);
      expect(await stock(acrilico)).toBe(0);
      expect(primera.body.renglones.map((r: { pendiente: number }) => r.pendiente)).toEqual([
        0, 10,
      ]);
      expect(primera.body.recepciones).toHaveLength(1);

      // Llegan 6 de los 10 acrílicos, después los 4 que faltaban.
      const segunda = await t.http
        .patch(`/api/ordenes-compra/${orden.id}/recibir`)
        .send({ remito: '0001-0002', renglones: [{ renglonId: rAcr.id, cantidad: 6 }] })
        .expect(200);
      expect(segunda.body.estado).toBe('RECIBIDA_PARCIAL');
      const tercera = await t.http
        .patch(`/api/ordenes-compra/${orden.id}/recibir`)
        .send({ remito: '0001-0003' })
        .expect(200);

      expect(tercera.body.estado).toBe('RECIBIDA');
      expect(await stock(acrilico)).toBe(10);
      expect(tercera.body.recepciones.map((r: { remito: string }) => r.remito)).toEqual([
        '0001-0001',
        '0001-0002',
        '0001-0003',
      ]);
      // Un movimiento de ENTRADA por entrega y renglón, cada uno colgado de su entrega.
      const movimientos = await t.prisma.movimientoStock.count({ where: { materialId: acrilico } });
      expect(movimientos).toBe(2);
      expect(
        await t.prisma.recepcionRenglon.count({ where: { movimientoId: { not: null } } }),
      ).toBe(3);
    });

    it('REGRESION: no se recibe más de lo pedido, y una parcial no se anula', async () => {
      const orden = await emitida([{ materialId: materiales[0], cantidad: 10 }]);
      const r = orden.renglones[0];
      await t.http
        .patch(`/api/ordenes-compra/${orden.id}/recibir`)
        .send({ remito: '1', renglones: [{ renglonId: r.id, cantidad: 4 }] })
        .expect(200);

      await t.http
        .patch(`/api/ordenes-compra/${orden.id}/recibir`)
        .send({ remito: '2', renglones: [{ renglonId: r.id, cantidad: 7 }] })
        .expect(400);
      await t.http.patch(`/api/ordenes-compra/${orden.id}/anular`).expect(400);
      expect(await stock(materiales[0])).toBe(4);
    });

    it('cerrar con lo que llegó la deja RECIBIDA, con el motivo y el faltante a la vista', async () => {
      const orden = await emitida([
        { materialId: materiales[0], cantidad: 10 },
        { materialId: materiales[1], cantidad: 10 },
      ]);
      await t.http
        .patch(`/api/ordenes-compra/${orden.id}/recibir`)
        .send({ remito: '1', renglones: [{ renglonId: orden.renglones[0].id, cantidad: 10 }] })
        .expect(200);

      const cerrada = await t.http
        .post(`/api/ordenes-compra/${orden.id}/cerrar-con-faltante`)
        .send({ motivo: 'El proveedor no tiene stock del acrílico' })
        .expect(200);

      expect(cerrada.body).toMatchObject({
        estado: 'RECIBIDA',
        cerradaConFaltante: true,
        motivoFaltante: 'El proveedor no tiene stock del acrílico',
      });
      expect(cerrada.body.renglones[1].pendiente).toBe(10);
    });

    it('un equipo recibido en parte da de alta solo las fichas que llegaron, numeradas', async () => {
      const orden = await emitida([
        { descripcionEquipo: 'Amoladora angular', clasificacion: 'HERRAMIENTA', cantidad: 3 },
      ]);
      const r = orden.renglones[0];

      await t.http
        .patch(`/api/ordenes-compra/${orden.id}/recibir`)
        .send({ remito: '1', renglones: [{ renglonId: r.id, cantidad: 2 }] })
        .expect(200);
      await t.http
        .patch(`/api/ordenes-compra/${orden.id}/recibir`)
        .send({ remito: '2' })
        .expect(200);

      const fichas = await t.prisma.equipo.findMany({
        where: { renglonOrdenCompraId: r.id },
        orderBy: { nombre: 'asc' },
      });
      expect(fichas.map((f) => f.nombre)).toEqual([
        'Amoladora angular (1 de 3)',
        'Amoladora angular (2 de 3)',
        'Amoladora angular (3 de 3)',
      ]);
    });
  });
});
