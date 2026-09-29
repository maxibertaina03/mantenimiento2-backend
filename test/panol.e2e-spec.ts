import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * El pañol: las reglas que protegen el stock y el historial.
 *
 * Complementan a `api.e2e-spec.ts`, que ya cubre el ciclo basico. Se
 * escribieron ANTES de mover materiales y movimientos a su bounded context, y
 * fijan justo lo que no se puede romper sin que alguien lo note tarde, con el
 * stock ya torcido: que nada deje el stock negativo, que un ajuste no quede
 * pisado por un movimiento retrofechado, que el historial no se pueda borrar.
 *
 * Como los otros e2e, solo mandan peticiones y miran la respuesta. Si el
 * refactor los obliga a cambiar, es que cambio el comportamiento.
 */
describe('Pañol (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let categoriaId: string;
  const UNIDAD = 'b0000001-0000-4000-8000-000000000001';

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

    const cat = await http.post('/api/categorias-material').send({ nombre: 'Pañol' }).expect(201);
    categoriaId = cat.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  let secuencia = 0;
  /** Un material nuevo, con un nombre que no choca con los de otros tests. */
  async function material(datos: Record<string, unknown> = {}) {
    const r = await http
      .post('/api/materiales')
      .send({ nombre: `Material ${++secuencia}`, categoriaId, unidadId: UNIDAD, ...datos })
      .expect(201);
    return r.body;
  }

  async function mover(materialId: string, datos: Record<string, unknown>) {
    return http.post('/api/movimientos').send({ materialId, ...datos });
  }

  async function stockDe(materialId: string): Promise<number> {
    const r = await http.get(`/api/materiales/${materialId}`).expect(200);
    return Number(r.body.stockActual);
  }

  describe('las cantidades', () => {
    it('REGRESION: una ENTRADA de cero no es un movimiento', async () => {
      const m = await material();
      const r = await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 0 });
      expect(r.status).toBe(400);
      expect(await stockDe(m.id)).toBe(0);
    });

    it('un AJUSTE a cero si vale: es contar y no encontrar nada', async () => {
      const m = await material();
      await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 5 });
      const r = await mover(m.id, { tipo: 'AJUSTE', motivo: 'AJUSTE', cantidad: 0 });
      expect(r.status).toBe(201);
      expect(await stockDe(m.id)).toBe(0);
    });

    it('REGRESION: la salida exacta deja el stock en cero, no negativo', async () => {
      const m = await material();
      await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 2.5 });
      const r = await mover(m.id, { tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 2.5 });
      expect(r.status).toBe(201);
      expect(await stockDe(m.id)).toBe(0);
    });

    it('una salida por encima del stock se rechaza con el numero en el mensaje', async () => {
      const m = await material();
      await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 3 });
      const r = await mover(m.id, { tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 4 });
      expect(r.status).toBe(400);
      expect(String(r.body.message)).toMatch(/insuficiente/i);
      expect(await stockDe(m.id)).toBe(3);
    });
  });

  describe('el ajuste y las fechas', () => {
    it('REGRESION: no se carga un movimiento por detras del ultimo ajuste', async () => {
      // El ajuste fija el stock en un valor absoluto. Una entrada retrofechada
      // por detras quedaria "antes" del conteo y el stock guardado dejaria de
      // coincidir con el recalculo del historial.
      const m = await material();
      await mover(m.id, {
        tipo: 'AJUSTE',
        motivo: 'AJUSTE',
        cantidad: 10,
        fecha: '2026-09-20T12:00:00.000Z',
      });

      const r = await mover(m.id, {
        tipo: 'ENTRADA',
        motivo: 'COMPRA',
        cantidad: 5,
        fecha: '2026-09-10T12:00:00.000Z',
      });

      expect(r.status).toBe(400);
      expect(await stockDe(m.id)).toBe(10);
    });

    it('despues del ajuste, si', async () => {
      const m = await material();
      await mover(m.id, {
        tipo: 'AJUSTE',
        motivo: 'AJUSTE',
        cantidad: 10,
        fecha: '2026-09-20T12:00:00.000Z',
      });
      const r = await mover(m.id, {
        tipo: 'ENTRADA',
        motivo: 'COMPRA',
        cantidad: 5,
        fecha: '2026-09-21T12:00:00.000Z',
      });
      expect(r.status).toBe(201);
      expect(await stockDe(m.id)).toBe(15);
    });
  });

  describe('los materiales desactivados', () => {
    it('REGRESION: no admiten movimientos nuevos', async () => {
      const m = await material();
      await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 4 });
      await http.patch(`/api/materiales/${m.id}`).send({ activo: false }).expect(200);

      const r = await mover(m.id, { tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 1 });

      expect(r.status).toBe(400);
      expect(String(r.body.message)).toMatch(/desactivado/i);
      expect(await stockDe(m.id)).toBe(4);
    });

    it('pero su historial sigue ahi', async () => {
      const m = await material();
      await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 4 });
      await http.patch(`/api/materiales/${m.id}`).send({ activo: false }).expect(200);

      const r = await http.get(`/api/materiales/${m.id}/historial`).expect(200);
      expect(r.body.movimientos).toHaveLength(1);
    });
  });

  describe('borrar un material', () => {
    it('REGRESION: con movimientos no se borra: se llevaria el historial', async () => {
      const m = await material();
      await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 1 });

      const r = await http.delete(`/api/materiales/${m.id}`);

      expect(r.status).toBe(400);
      expect(String(r.body.message)).toMatch(/desactivalo/i);
      await http.get(`/api/materiales/${m.id}`).expect(200);
    });

    it('sin movimientos, si', async () => {
      const m = await material();
      await http.delete(`/api/materiales/${m.id}`).expect(204);
      await http.get(`/api/materiales/${m.id}`).expect(404);
    });
  });

  describe('la ficha', () => {
    it('REGRESION: dos materiales no pueden llamarse igual', async () => {
      // Dos fichas para lo mismo parten el stock en dos y ninguna queda bien.
      await material({ nombre: 'Rulemán 6204' });
      const r = await http
        .post('/api/materiales')
        .send({ nombre: 'ruleman 6204', categoriaId, unidadId: UNIDAD });
      expect(r.status).toBe(400);
    });

    it('REGRESION: una fila sin estanteria no se guarda', async () => {
      const r = await http
        .post('/api/materiales')
        .send({ nombre: 'Con fila suelta', categoriaId, unidadId: UNIDAD, fila: 3 });
      expect(r.status).toBe(400);
    });

    it('el historial trae los movimientos del material, del mas nuevo al mas viejo', async () => {
      const m = await material();
      await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 10 });
      await mover(m.id, { tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 3 });

      const r = await http.get(`/api/materiales/${m.id}/historial`).expect(200);

      expect(r.body.movimientos.map((x: any) => x.tipo)).toEqual(['SALIDA', 'ENTRADA']);
      expect(Number(r.body.stockActual)).toBe(7);
    });
  });

  describe('editar un movimiento', () => {
    it('REGRESION: editar la cantidad de una entrada recalcula el stock', async () => {
      const m = await material();
      const e = await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 10 });
      await mover(m.id, { tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 4 });

      await http
        .patch(`/api/movimientos/${e.body.id}`)
        .send({ cantidad: 7, motivoEdicion: 'Se contaron mal las cajas' })
        .expect(200);

      expect(await stockDe(m.id)).toBe(3);
    });

    it('REGRESION: una edicion que dejaria el stock negativo no cambia nada', async () => {
      const m = await material();
      const e = await mover(m.id, { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 10 });
      await mover(m.id, { tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 8 });

      const r = await http
        .patch(`/api/movimientos/${e.body.id}`)
        .send({ cantidad: 5, motivoEdicion: 'Prueba' });

      expect(r.status).toBe(400);
      expect(await stockDe(m.id)).toBe(2);
    });
  });
});
