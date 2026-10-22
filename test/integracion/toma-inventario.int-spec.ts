import { AppDeIntegracion, levantarApp, vaciarBase } from './app-de-integracion';

/**
 * La toma de inventario contra un Postgres de verdad: el stock se ajusta de
 * verdad, por el camino de siempre, y lo que se movió después de contarlo no
 * se pisa.
 */
describe('Toma de inventario (integración, Postgres real)', () => {
  let t: AppDeIntegracion;
  let categoriaId: string;
  let otraCategoriaId: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    t = await levantarApp();
  });

  afterAll(async () => {
    await t?.app.close();
  });

  const entrada = (materialId: string, cantidad: number) =>
    t.http
      .post('/api/movimientos')
      .send({ materialId, tipo: 'ENTRADA', motivo: 'COMPRA', cantidad })
      .expect(201);

  beforeEach(async () => {
    await vaciarBase(t);
    categoriaId = (await t.prisma.categoriaMaterial.create({ data: { nombre: 'Electricidad' } }))
      .id;
    otraCategoriaId = (await t.prisma.categoriaMaterial.create({ data: { nombre: 'Rodamientos' } }))
      .id;
    for (const [clave, nombre, cat] of [
      ['cable', 'Cable 2,5 mm', categoriaId],
      ['llave', 'Llave térmica', categoriaId],
      ['cinta', 'Cinta aisladora', categoriaId],
      ['ruleman', 'Rulemán 6204', otraCategoriaId],
    ] as const) {
      ids[clave] = (await t.prisma.material.create({ data: { nombre, categoriaId: cat } })).id;
    }
    await entrada(ids.cable, 10);
    await entrada(ids.llave, 3);
    await entrada(ids.cinta, 8);
  });

  const stock = async (materialId: string) =>
    (
      await t.prisma.material.findUniqueOrThrow({ where: { id: materialId } })
    ).stockActual.toNumber();

  it('abre por categoría, ajusta lo contado y deja quieto lo que se movió después', async () => {
    const toma = await t.http.post('/api/tomas-inventario').send({ categoriaId }).expect(201);
    expect(toma.body.numero).toMatch(/^TI-\d{4}-0001$/);
    expect(toma.body.totalRenglones).toBe(3); // el rulemán es de otra categoría

    const detalle = await t.http.get(`/api/tomas-inventario/${toma.body.id}`).expect(200);
    const renglon = (materialId: string) =>
      detalle.body.renglones.find((r: { materialId: string }) => r.materialId === materialId);
    const contar = (materialId: string, contado: number) =>
      t.http
        .patch(`/api/tomas-inventario/${toma.body.id}/renglones/${renglon(materialId).id}`)
        .send({ contado })
        .expect(200);

    await contar(ids.cable, 7); // figuraban 10
    await contar(ids.llave, 3); // igual
    await contar(ids.cinta, 6); // figuraban 8…
    // …pero después de contarla alguien saca 1 con una salida.
    await t.http
      .post('/api/movimientos')
      .send({ materialId: ids.cinta, tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 1 })
      .expect(201);

    const conf = await t.http.post(`/api/tomas-inventario/${toma.body.id}/confirmar`).expect(200);
    expect(conf.body).toEqual(
      expect.objectContaining({ ajustados: 1, sinDiferencia: 1, recontar: 1, errores: [] }),
    );
    expect(await stock(ids.cable)).toBe(7);
    expect(await stock(ids.llave)).toBe(3);
    expect(await stock(ids.cinta)).toBe(7); // la salida quedó; no se pisó
    expect(conf.body.toma.estado).toBe('ABIERTA');

    // La ficha de cada material dice cuándo se lo contó por última vez.
    const ultimo = async (materialId: string) =>
      (await t.http.get(`/api/materiales/${materialId}/historial`).expect(200)).body
        .ultimoInventario;
    expect(await ultimo(ids.cable)).toEqual(
      expect.objectContaining({
        origen: 'TOMA',
        tomaNumero: toma.body.numero,
        contado: 7,
        figuraba: 10,
        resultado: 'AJUSTADO',
      }),
    );
    expect(await ultimo(ids.llave)).toEqual(
      expect.objectContaining({ origen: 'TOMA', resultado: 'SIN_DIFERENCIA' }),
    );
    // Contada pero para recontar: ese número no se aceptó, así que nunca se contó.
    expect(await ultimo(ids.cinta)).toBeNull();
    // Un ajuste cargado a mano también es haberlo contado.
    await t.http
      .post('/api/movimientos')
      .send({ materialId: ids.ruleman, tipo: 'AJUSTE', motivo: 'AJUSTE', cantidad: 4 })
      .expect(201);
    expect(await ultimo(ids.ruleman)).toEqual(
      expect.objectContaining({ origen: 'AJUSTE', contado: 4, tomaNumero: null }),
    );

    // El ajuste quedó en el historial como cualquier otro, con la nota de la toma.
    const ajuste = await t.prisma.movimientoStock.findFirstOrThrow({
      where: { materialId: ids.cable, tipo: 'AJUSTE' },
    });
    expect(ajuste.notas).toContain(toma.body.numero);
    expect(
      (await t.prisma.renglonToma.findFirstOrThrow({ where: { materialId: ids.cable } }))
        .movimientoId,
    ).toBe(ajuste.id);

    // Se vuelve a contar la cinta y se confirma: ahora sí, y la toma se cierra.
    await contar(ids.cinta, 6);
    const otra = await t.http.post(`/api/tomas-inventario/${toma.body.id}/confirmar`).expect(200);
    expect(otra.body.ajustados).toBe(1);
    expect(otra.body.toma.estado).toBe('CERRADA');
    expect(await stock(ids.cinta)).toBe(6);
  });

  it('una toma que no ajustó nada se anula y ya no se cuenta; una que ajustó, no se anula', async () => {
    const vacia = await t.http.post('/api/tomas-inventario').send({}).expect(201);
    expect(vacia.body.totalRenglones).toBe(4); // todo el pañol
    const detalle = await t.http.get(`/api/tomas-inventario/${vacia.body.id}`).expect(200);
    await t.http
      .post(`/api/tomas-inventario/${vacia.body.id}/anular`)
      .send({ motivo: 'Se abrió de más' })
      .expect(200);
    await t.http
      .patch(`/api/tomas-inventario/${vacia.body.id}/renglones/${detalle.body.renglones[0].id}`)
      .send({ contado: 1 })
      .expect(409);

    const otra = await t.http.post('/api/tomas-inventario').send({ categoriaId }).expect(201);
    const renglones = (await t.http.get(`/api/tomas-inventario/${otra.body.id}`).expect(200)).body
      .renglones;
    const cable = renglones.find((r: { materialId: string }) => r.materialId === ids.cable);
    await t.http
      .patch(`/api/tomas-inventario/${otra.body.id}/renglones/${cable.id}`)
      .send({ contado: 9 })
      .expect(200);
    await t.http.post(`/api/tomas-inventario/${otra.body.id}/confirmar`).expect(200);
    await t.http
      .post(`/api/tomas-inventario/${otra.body.id}/anular`)
      .send({ motivo: 'Ya no' })
      .expect(409);
  });

  it('reubicar un material durante la toma: cambia su lugar y queda en el registro', async () => {
    const estante = await t.prisma.estanteriaMaterial.create({ data: { nombre: 'Estantería 5' } });
    const toma = await t.http.post('/api/tomas-inventario').send({ categoriaId }).expect(201);
    const detalle = await t.http.get(`/api/tomas-inventario/${toma.body.id}`).expect(200);
    const renglon = detalle.body.renglones.find(
      (r: { materialId: string }) => r.materialId === ids.cable,
    );

    const movido = await t.http
      .post(`/api/tomas-inventario/${toma.body.id}/renglones/${renglon.id}/reubicar`)
      .send({ estanteriaId: estante.id, fila: 2 })
      .expect(200);
    expect(movido.body).toEqual(
      expect.objectContaining({
        estanteriaId: estante.id,
        estanteriaNombre: 'Estantería 5',
        fila: 2,
      }),
    );

    // El material quedó ahí en todo el sistema, no solo en la toma.
    const material = await t.prisma.material.findUniqueOrThrow({ where: { id: ids.cable } });
    expect(material).toEqual(expect.objectContaining({ estanteriaId: estante.id, fila: 2 }));

    const despues = await t.http.get(`/api/tomas-inventario/${toma.body.id}`).expect(200);
    expect(despues.body.reubicaciones).toEqual([
      expect.objectContaining({
        materialNombre: 'Cable 2,5 mm',
        desdeEstanteria: null,
        haciaEstanteria: 'Estantería 5',
        haciaFila: 2,
      }),
    ]);

    // Al mismo lugar, no; una fila inválida, tampoco.
    await t.http
      .post(`/api/tomas-inventario/${toma.body.id}/renglones/${renglon.id}/reubicar`)
      .send({ estanteriaId: estante.id, fila: 2 })
      .expect(400);
    await t.http
      .post(`/api/tomas-inventario/${toma.body.id}/renglones/${renglon.id}/reubicar`)
      .send({ estanteriaId: estante.id, fila: 0 })
      .expect(400);
  });
});
