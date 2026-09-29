import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * Comprar equipos y herramientas desde una orden de compra.
 *
 * Lo que se quiere: que al cerrar la compra de cinco amoladoras queden cinco
 * fichas en el modulo de equipos, cada una con su numero de serie y su
 * historial, y que desde la ficha se pueda volver a la compra que la trajo.
 *
 * Lo que NO puede pasar, y es lo que mas cuidan estos tests: que un renglon de
 * equipo toque el stock. Son dos caminos distintos y el del paniol tiene que
 * quedar exactamente como estaba.
 */
describe('Compra de equipos y herramientas (e2e)', () => {
  let app: INestApplication;
  let memoria: ReturnType<typeof crearPrismaEnMemoria>;
  let http: ReturnType<typeof request>;
  let proveedorId: string;
  let materialId: string;

  beforeAll(async () => {
    memoria = crearPrismaEnMemoria();

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
      .send({ nombre: 'Ferreteria Industrial' })
      .expect(201);
    proveedorId = prov.body.id;

    const cat = await http.post('/api/categorias-material').send({ nombre: 'Varios' }).expect(201);
    const mat = await http
      .post('/api/materiales')
      .send({
        nombre: 'Cable 4mm',
        categoriaId: cat.body.id,
        unidadId: 'b0000001-0000-4000-8000-000000000001',
      })
      .expect(201);
    materialId = mat.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Crea una orden y la recibe, devolviendo la orden ya cerrada. */
  async function comprarYRecibir(renglones: Record<string, unknown>[]) {
    const orden = await http
      .post('/api/ordenes-compra')
      .send({ proveedorId, renglones })
      .expect(201);

    await http.patch(`/api/ordenes-compra/${orden.body.id}/emitir`).send({}).expect(200);
    const rec = await http
      .patch(`/api/ordenes-compra/${orden.body.id}/recibir`)
      .send({ remito: '0001-00001234' });
    expect(rec.status).toBe(200);

    return orden.body;
  }

  describe('cargar el renglon', () => {
    it('REGRESION: un renglon no puede ser de un material Y de un equipo', async () => {
      // Sumaria stock Y daria de alta una ficha por la misma compra.
      const r = await http
        .post('/api/ordenes-compra')
        .send({
          proveedorId,
          renglones: [
            {
              materialId,
              descripcionEquipo: 'Amoladora',
              cantidad: 1,
              clasificacion: 'HERRAMIENTA',
            },
          ],
        })
        .expect(400);

      expect(String(r.body.message)).toMatch(/no de los dos/i);
    });

    it('REGRESION: un renglon vacio se rechaza al cargarlo, no al recibir', async () => {
      // Al recibir ya no se puede deshacer nada.
      await http
        .post('/api/ordenes-compra')
        .send({ proveedorId, renglones: [{ cantidad: 1 }] })
        .expect(400);
    });

    it('REGRESION: media amoladora no existe', async () => {
      await http
        .post('/api/ordenes-compra')
        .send({
          proveedorId,
          renglones: [
            { descripcionEquipo: 'Amoladora', cantidad: 2.5, clasificacion: 'HERRAMIENTA' },
          ],
        })
        .expect(400);
    });
  });

  describe('al recibir la compra', () => {
    it('cada unidad queda como una ficha aparte', async () => {
      await comprarYRecibir([
        { descripcionEquipo: 'Amoladora angular', cantidad: 3, clasificacion: 'HERRAMIENTA' },
      ]);

      const equipos = await http.get('/api/equipos?buscar=Amoladora angular').expect(200);
      expect(equipos.body.datos).toHaveLength(3);
      // Numeradas, porque tres fichas con el mismo nombre no se distinguen.
      expect(equipos.body.datos.map((e: { nombre: string }) => e.nombre).sort()).toEqual([
        'Amoladora angular (1 de 3)',
        'Amoladora angular (2 de 3)',
        'Amoladora angular (3 de 3)',
      ]);
    });

    it('una sola unidad no lleva numero en el nombre', async () => {
      await comprarYRecibir([
        { descripcionEquipo: 'Soldadora inverter', cantidad: 1, clasificacion: 'HERRAMIENTA' },
      ]);

      const equipos = await http.get('/api/equipos?buscar=Soldadora inverter').expect(200);
      expect(equipos.body.datos).toHaveLength(1);
      expect(equipos.body.datos[0].nombre).toBe('Soldadora inverter');
    });

    it('la ficha nace con lo que se sabe de la compra', async () => {
      await comprarYRecibir([
        { descripcionEquipo: 'Compresor 100L', cantidad: 1, clasificacion: 'EQUIPO' },
      ]);

      const equipos = await http.get('/api/equipos?buscar=Compresor 100L').expect(200);
      const equipo = equipos.body.datos[0];

      expect(equipo.clasificacion).toBe('EQUIPO');
      expect(equipo.proveedorId).toBe(proveedorId);
      // La fecha de alta es la de recepcion: cuando entro de verdad.
      expect(equipo.fechaAlta).toBeTruthy();
    });

    it('sin decir si es equipo o herramienta, queda como equipo', async () => {
      await comprarYRecibir([{ descripcionEquipo: 'Bomba centrifuga', cantidad: 1 }]);

      const equipos = await http.get('/api/equipos?buscar=Bomba centrifuga').expect(200);
      expect(equipos.body.datos[0].clasificacion).toBe('EQUIPO');
    });
  });

  describe('editar la orden antes de mandarla', () => {
    it('REGRESION: editar un borrador conserva lo del equipo', async () => {
      // Editar reemplaza todos los renglones. Si al recrearlos se pierde la
      // descripcion del equipo, el renglon queda sin decir que se compra y la
      // compra no se puede recibir, o entra sin la ficha que tenia que crear.
      const orden = await http
        .post('/api/ordenes-compra')
        .send({
          proveedorId,
          renglones: [
            { descripcionEquipo: 'Escalera extensible', cantidad: 1, clasificacion: 'HERRAMIENTA' },
          ],
        })
        .expect(201);

      await http
        .patch(`/api/ordenes-compra/${orden.body.id}`)
        .send({
          renglones: [
            { descripcionEquipo: 'Escalera extensible', cantidad: 2, clasificacion: 'HERRAMIENTA' },
          ],
        })
        .expect(200);

      await http.patch(`/api/ordenes-compra/${orden.body.id}/emitir`).send({}).expect(200);
      await http
        .patch(`/api/ordenes-compra/${orden.body.id}/recibir`)
        .send({ remito: '0001-00005678' })
        .expect(200);

      const equipos = await http.get('/api/equipos?buscar=Escalera extensible').expect(200);
      expect(equipos.body.datos).toHaveLength(2);
      expect(
        equipos.body.datos.every(
          (e: { clasificacion: string }) => e.clasificacion === 'HERRAMIENTA',
        ),
      ).toBe(true);
    });
  });

  describe('el paniol no se entera', () => {
    it('REGRESION: comprar un equipo no genera ningun movimiento de stock', async () => {
      // Es la linea que separa los dos caminos. Si un equipo moviera stock,
      // aparecerian entradas de cosas que no estan en el paniol.
      const antes = await http.get('/api/movimientos').expect(200);

      await comprarYRecibir([
        { descripcionEquipo: 'Taladro de banco', cantidad: 2, clasificacion: 'HERRAMIENTA' },
      ]);

      const despues = await http.get('/api/movimientos').expect(200);
      expect(despues.body.total).toBe(antes.body.total);
    });

    it('REGRESION: un material en la misma orden sigue sumando stock', async () => {
      // Lo de siempre tiene que seguir funcionando igual, incluso mezclado con
      // un equipo en la misma orden.
      const material = await http.get(`/api/materiales/${materialId}`).expect(200);
      const stockAntes = Number(material.body.stockActual);

      await comprarYRecibir([
        { materialId, cantidad: 50 },
        { descripcionEquipo: 'Morsa de banco', cantidad: 1, clasificacion: 'HERRAMIENTA' },
      ]);

      const despues = await http.get(`/api/materiales/${materialId}`).expect(200);
      expect(Number(despues.body.stockActual)).toBe(stockAntes + 50);

      const equipos = await http.get('/api/equipos?buscar=Morsa de banco').expect(200);
      expect(equipos.body.datos).toHaveLength(1);
    });
  });
});
