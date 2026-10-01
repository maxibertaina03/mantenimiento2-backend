import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * Las órdenes de compra: el ciclo de vida y lo que pasa al recibir.
 *
 * Complementan a `modulos-nuevos.e2e-spec.ts` (el camino feliz) y a
 * `compra-de-equipos.e2e-spec.ts`. Se escribieron ANTES de mover compras a su
 * bounded context, y fijan lo que no se puede romper sin que alguien lo note
 * con la mercadería ya en el depósito: que una orden no se cierre sin papel,
 * que no quede media orden recibida, que lo anulado no vuelva.
 *
 * El envío por correo NO se prueba acá a propósito: si el `.env` local tiene
 * el correo configurado, el test mandaría un mail de verdad.
 *
 * Como los otros e2e, solo mandan peticiones y miran la respuesta. Si el
 * refactor los obliga a cambiar, es que cambió el comportamiento.
 */
describe('Compras (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let proveedorId: string;
  let categoriaId: string;
  const UNIDAD = 'b0000001-0000-4000-8000-000000000001';
  const INEXISTENTE = '00000000-0000-4000-8000-00000000dead';

  beforeAll(async () => {
    const memoria = crearPrismaEnMemoria();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(memoria.prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new FiltroExcepcionesHttp());
    app.setGlobalPrefix('api');
    await app.init();
    http = request(app.getHttpServer());

    const prov = await http
      .post('/api/proveedores')
      .send({ nombre: 'Distribuidora Norte', telefono: '3515551234' })
      .expect(201);
    proveedorId = prov.body.id;
    const cat = await http.post('/api/categorias-material').send({ nombre: 'Compras' }).expect(201);
    categoriaId = cat.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  let secuencia = 0;
  async function material(): Promise<string> {
    const r = await http
      .post('/api/materiales')
      .send({ nombre: `Insumo ${++secuencia}`, categoriaId, unidadId: UNIDAD })
      .expect(201);
    return r.body.id;
  }

  async function orden(renglones: Record<string, unknown>[]) {
    const r = await http.post('/api/ordenes-compra').send({ proveedorId, renglones }).expect(201);
    return r.body;
  }

  async function emitida(renglones: Record<string, unknown>[]) {
    const o = await orden(renglones);
    await http.patch(`/api/ordenes-compra/${o.id}/emitir`).expect(200);
    return o;
  }

  async function stockDe(materialId: string): Promise<number> {
    const r = await http.get(`/api/materiales/${materialId}`).expect(200);
    return Number(r.body.stockActual);
  }

  describe('recibir', () => {
    it('REGRESION: sin remito ni factura no se cierra la orden', async () => {
      const m = await material();
      const o = await emitida([{ materialId: m, cantidad: 10 }]);

      const r = await http.patch(`/api/ordenes-compra/${o.id}/recibir`).send({ remito: '   ' });

      expect(r.status).toBe(400);
      expect(String(r.body.message)).toMatch(/remito o el de factura/);
      expect(await stockDe(m)).toBe(0);
      const despues = await http.get(`/api/ordenes-compra/${o.id}`).expect(200);
      expect(despues.body.estado).toBe('EMITIDA');
    });

    it('con la factura sola alcanza, y queda en la referencia del movimiento', async () => {
      const m = await material();
      const o = await emitida([{ materialId: m, cantidad: 4 }]);

      const r = await http
        .patch(`/api/ordenes-compra/${o.id}/recibir`)
        .send({ factura: 'A-0003-00000077' })
        .expect(200);

      expect(r.body.estado).toBe('RECIBIDA');
      expect(r.body.factura).toBe('A-0003-00000077');
      expect(await stockDe(m)).toBe(4);
      const movs = await http.get(`/api/movimientos?materialId=${m}`).expect(200);
      expect(movs.body.datos[0].referenciaTrabajo).toBe(`${o.numero} · Factura A-0003-00000077`);
    });

    it('la fecha de recepcion es la del movimiento', async () => {
      const m = await material();
      const o = await emitida([{ materialId: m, cantidad: 1 }]);

      await http
        .patch(`/api/ordenes-compra/${o.id}/recibir`)
        .send({ remito: 'R-1', fechaRecepcion: '2026-09-15T12:00:00.000Z' })
        .expect(200);

      const movs = await http.get(`/api/movimientos?materialId=${m}`).expect(200);
      expect(movs.body.datos[0].fecha).toBe('2026-09-15T12:00:00.000Z');
    });

    it('REGRESION: por detras de un ajuste no se recibe, y no queda media orden', async () => {
      // Dos materiales; solo el segundo tiene un ajuste posterior a la fecha.
      // Si se recibiera el primero antes de chequear el segundo, la orden
      // quedaría a medias: stock sumado en uno, orden sin cerrar.
      const sinAjuste = await material();
      const conAjuste = await material();
      await http
        .post('/api/movimientos')
        .send({
          materialId: conAjuste,
          tipo: 'AJUSTE',
          motivo: 'AJUSTE',
          cantidad: 50,
          fecha: '2026-09-20T12:00:00.000Z',
        })
        .expect(201);
      const o = await emitida([
        { materialId: sinAjuste, cantidad: 5 },
        { materialId: conAjuste, cantidad: 5 },
      ]);

      const r = await http
        .patch(`/api/ordenes-compra/${o.id}/recibir`)
        .send({ remito: 'R-2', fechaRecepcion: '2026-09-10T12:00:00.000Z' });

      expect(r.status).toBe(400);
      expect(String(r.body.message)).toMatch(/anterior al último ajuste/);
      expect(await stockDe(sinAjuste)).toBe(0);
      expect(await stockDe(conAjuste)).toBe(50);
      const despues = await http.get(`/api/ordenes-compra/${o.id}`).expect(200);
      expect(despues.body.estado).toBe('EMITIDA');
    });
  });

  describe('corregir precios despues de emitir o recibir', () => {
    it('una orden recibida con un renglon sin precio se completa, y el stock no se mueve', async () => {
      const conPrecio = await material();
      const sinPrecio = await material();
      const o = await emitida([
        { materialId: conPrecio, cantidad: 3, precioUnitario: 48226.69 },
        { materialId: sinPrecio, cantidad: 1 },
      ]);
      await http.patch(`/api/ordenes-compra/${o.id}/recibir`).send({ remito: 'R-1' }).expect(200);
      const stockAntes = [await stockDe(conPrecio), await stockDe(sinPrecio)];

      const leida = await http.get(`/api/ordenes-compra/${o.id}`).expect(200);
      expect(leida.body.total).toBeNull();
      const renglon = leida.body.renglones.find(
        (r: { materialId: string }) => r.materialId === sinPrecio,
      );

      const r = await http
        .patch(`/api/ordenes-compra/${o.id}/precios`)
        .send({ precios: [{ renglonId: renglon.id, precioUnitario: 125000 }] })
        .expect(200);

      expect(r.body.estado).toBe('RECIBIDA');
      expect(r.body.total).toBeCloseTo(3 * 48226.69 + 125000, 2);
      expect([await stockDe(conPrecio), await stockDe(sinPrecio)]).toEqual(stockAntes);
    });

    it('REGRESION: un renglon de otra orden no se toca', async () => {
      const a = await emitida([{ materialId: await material(), cantidad: 1 }]);
      const b = await emitida([{ materialId: await material(), cantidad: 1 }]);
      const renglonDeB = (await http.get(`/api/ordenes-compra/${b.id}`).expect(200)).body
        .renglones[0];

      await http
        .patch(`/api/ordenes-compra/${a.id}/precios`)
        .send({ precios: [{ renglonId: renglonDeB.id, precioUnitario: 99 }] })
        .expect(400);
      const bDespues = (await http.get(`/api/ordenes-compra/${b.id}`).expect(200)).body;
      expect(bDespues.renglones[0].precioUnitario).toBeNull();
    });

    it('en una anulada no se corrigen precios', async () => {
      const o = await orden([{ materialId: await material(), cantidad: 1 }]);
      await http.patch(`/api/ordenes-compra/${o.id}/anular`).expect(200);
      const renglon = (await http.get(`/api/ordenes-compra/${o.id}`).expect(200)).body.renglones[0];
      await http
        .patch(`/api/ordenes-compra/${o.id}/precios`)
        .send({ precios: [{ renglonId: renglon.id, precioUnitario: 10 }] })
        .expect(400);
    });
  });

  describe('lo que se puede cargar', () => {
    it('REGRESION: no se compra un material desactivado', async () => {
      const m = await material();
      await http.patch(`/api/materiales/${m}`).send({ activo: false }).expect(200);

      const r = await http
        .post('/api/ordenes-compra')
        .send({ proveedorId, renglones: [{ materialId: m, cantidad: 1 }] });

      expect(r.status).toBe(400);
      expect(String(r.body.message)).toMatch(/desactivado/);
    });

    it('un material que no existe es 404', async () => {
      await http
        .post('/api/ordenes-compra')
        .send({ proveedorId, renglones: [{ materialId: INEXISTENTE, cantidad: 1 }] })
        .expect(404);
    });

    it('editar un borrador reemplaza los renglones', async () => {
      const a = await material();
      const b = await material();
      const o = await orden([{ materialId: a, cantidad: 1 }]);

      const r = await http
        .patch(`/api/ordenes-compra/${o.id}`)
        .send({ observaciones: 'Urgente', renglones: [{ materialId: b, cantidad: 3 }] })
        .expect(200);

      expect(r.body.observaciones).toBe('Urgente');
      expect(r.body.renglones).toHaveLength(1);
      expect(r.body.renglones[0].materialId).toBe(b);
    });

    it('REGRESION: editar dejando la orden sin renglones se rechaza', async () => {
      const o = await orden([{ materialId: await material(), cantidad: 1 }]);
      await http.patch(`/api/ordenes-compra/${o.id}`).send({ renglones: [] }).expect(400);
    });
  });

  describe('anular y eliminar', () => {
    it('un borrador se anula, y lo anulado no vuelve', async () => {
      const o = await orden([{ materialId: await material(), cantidad: 1 }]);

      const r = await http.patch(`/api/ordenes-compra/${o.id}/anular`).expect(200);
      expect(r.body.estado).toBe('ANULADA');

      await http.patch(`/api/ordenes-compra/${o.id}/anular`).expect(400);
      await http.patch(`/api/ordenes-compra/${o.id}/emitir`).expect(400);
      await http.patch(`/api/ordenes-compra/${o.id}/recibir`).send({ remito: 'R' }).expect(400);
    });

    it('una emitida se puede anular', async () => {
      const o = await emitida([{ materialId: await material(), cantidad: 1 }]);
      const r = await http.patch(`/api/ordenes-compra/${o.id}/anular`).expect(200);
      expect(r.body.estado).toBe('ANULADA');
    });

    it('un borrador se elimina', async () => {
      const o = await orden([{ materialId: await material(), cantidad: 1 }]);
      await http.delete(`/api/ordenes-compra/${o.id}`).expect(204);
      await http.get(`/api/ordenes-compra/${o.id}`).expect(404);
    });

    it('REGRESION: una emitida no se elimina: se anula, para conservar el registro', async () => {
      const o = await emitida([{ materialId: await material(), cantidad: 1 }]);
      const r = await http.delete(`/api/ordenes-compra/${o.id}`);
      expect(r.status).toBe(400);
      expect(String(r.body.message)).toMatch(/anulala/);
    });
  });

  describe('enviar', () => {
    it('registrar el WhatsApp emite el borrador y deja constancia', async () => {
      const o = await orden([{ materialId: await material(), cantidad: 1 }]);

      const r = await http
        .post(`/api/ordenes-compra/${o.id}/registrar-whatsapp`)
        .send({ numero: '3515551234' })
        .expect(200);
      expect(r.body.estado).toBe('EMITIDA');

      const envios = await http.get(`/api/ordenes-compra/${o.id}/envios`).expect(200);
      expect(envios.body).toHaveLength(1);
      expect(envios.body[0]).toMatchObject({
        via: 'WHATSAPP',
        destinatarios: '3515551234',
        automatico: false,
      });
    });

    it('la configuracion de envio dice que hay y que no', async () => {
      const r = await http.get('/api/ordenes-compra/configuracion-envio').expect(200);
      expect(r.body).toHaveProperty('mailAdministracion');
      expect(r.body).toHaveProperty('whatsappAdministracion');
      expect(typeof r.body.correoConfigurado).toBe('boolean');
    });
  });

  describe('buscar', () => {
    it('por el remito: se tiene el papel en la mano y se busca la orden', async () => {
      const o = await emitida([{ materialId: await material(), cantidad: 1 }]);
      await http
        .patch(`/api/ordenes-compra/${o.id}/recibir`)
        .send({ remito: 'RX-9988-7766' })
        .expect(200);

      const r = await http.get('/api/ordenes-compra?buscar=9988').expect(200);
      expect(r.body.datos.map((x: { id: string }) => x.id)).toEqual([o.id]);
    });
  });

  describe('lo que no existe', () => {
    it('es 404 en cada operacion', async () => {
      await http.get(`/api/ordenes-compra/${INEXISTENTE}`).expect(404);
      await http.patch(`/api/ordenes-compra/${INEXISTENTE}`).send({}).expect(404);
      await http.patch(`/api/ordenes-compra/${INEXISTENTE}/emitir`).expect(404);
      await http
        .patch(`/api/ordenes-compra/${INEXISTENTE}/recibir`)
        .send({ remito: 'R' })
        .expect(404);
      await http.patch(`/api/ordenes-compra/${INEXISTENTE}/anular`).expect(404);
      await http.delete(`/api/ordenes-compra/${INEXISTENTE}`).expect(404);
      await http.get(`/api/ordenes-compra/${INEXISTENTE}/envios`).expect(404);
    });
  });
});
