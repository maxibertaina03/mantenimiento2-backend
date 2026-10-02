import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * Los repuestos de cada equipo, de punta a punta por HTTP: qué materiales del
 * pañol lleva la máquina, con su stock, y en qué máquinas va cada material.
 */
describe('Repuestos de equipos (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const UNIDAD = 'b0000001-0000-4000-8000-000000000001';
  let bomba: string;
  let bomba2: string;
  let reten: string;
  let rodamiento: string;

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

    const cat = (
      await http.post('/api/categorias-material').send({ nombre: 'Repuestos' }).expect(201)
    ).body.id;
    const material = async (nombre: string) =>
      (
        await http
          .post('/api/materiales')
          .send({ nombre, categoriaId: cat, unidadId: UNIDAD, stockMinimo: 4 })
          .expect(201)
      ).body.id as string;
    reten = await material('Retén 40x72x10');
    rodamiento = await material('Rodamiento 6205');
    bomba = (await http.post('/api/equipos').send({ nombre: 'Bomba de recibo' }).expect(201)).body
      .id;
    bomba2 = (await http.post('/api/equipos').send({ nombre: 'Bomba 2' }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  const repuestosDe = (equipoId: string) =>
    http
      .get(`/api/equipos/${equipoId}/repuestos`)
      .expect(200)
      .then((r) => r.body);

  it('suma materiales a un equipo y los lista con su stock, ordenados por nombre', async () => {
    await http
      .post(`/api/equipos/${bomba}/repuestos`)
      .send({ materialId: rodamiento, cantidad: 2, notas: 'lado motor' })
      .expect(201);
    const lista = (
      await http.post(`/api/equipos/${bomba}/repuestos`).send({ materialId: reten }).expect(201)
    ).body;

    expect(lista.map((r: { materialNombre: string }) => r.materialNombre)).toEqual([
      'Retén 40x72x10',
      'Rodamiento 6205',
    ]);
    expect(lista[1]).toMatchObject({ cantidad: 2, notas: 'lado motor', stockActual: 0 });
    // Sin stock y con mínimo 4: hay que reponer.
    expect(lista[1].bajoStock).toBe(true);
  });

  it('REGRESION: el mismo material dos veces en un equipo es 409, y la lista no cambia', async () => {
    const r = await http
      .post(`/api/equipos/${bomba}/repuestos`)
      .send({ materialId: reten })
      .expect(409);
    expect(JSON.stringify(r.body)).toMatch(/ya está en los repuestos/);
    expect(await repuestosDe(bomba)).toHaveLength(2);
  });

  it('un material va en muchos equipos, y su ficha dice en cuáles', async () => {
    await http.post(`/api/equipos/${bomba2}/repuestos`).send({ materialId: reten }).expect(201);

    const usos = (await http.get(`/api/equipos/de-material/${reten}`).expect(200)).body;
    expect(usos.map((u: { equipoNombre: string }) => u.equipoNombre)).toEqual([
      'Bomba 2',
      'Bomba de recibo',
    ]);
  });

  it('se cambia la cantidad y la nota, y se quita', async () => {
    const [rep] = await repuestosDe(bomba2);

    const cambiada = (
      await http
        .patch(`/api/equipos/${bomba2}/repuestos/${rep.id}`)
        .send({ cantidad: 3, notas: 'el de la tapa' })
        .expect(200)
    ).body;
    expect(cambiada[0]).toMatchObject({ cantidad: 3, notas: 'el de la tapa' });

    expect(
      (await http.delete(`/api/equipos/${bomba2}/repuestos/${rep.id}`).expect(200)).body,
    ).toEqual([]);
  });

  it('REGRESION: el repuesto de un equipo no se borra desde otro', async () => {
    const [rep] = await repuestosDe(bomba);
    await http.delete(`/api/equipos/${bomba2}/repuestos/${rep.id}`).expect(404);
    expect(await repuestosDe(bomba)).toHaveLength(2);
  });

  it('cantidad cero es 400; un material inexistente es 404', async () => {
    await http
      .post(`/api/equipos/${bomba2}/repuestos`)
      .send({ materialId: rodamiento, cantidad: 0 })
      .expect(400);
    await http
      .post(`/api/equipos/${bomba2}/repuestos`)
      .send({ materialId: '00000000-0000-4000-8000-00000000dead' })
      .expect(404);
  });
});
