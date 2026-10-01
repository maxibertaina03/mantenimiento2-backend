import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * Una orden de trabajo que se manda a un taller: el proveedor se dice con la
 * orden abierta, para que salga en el papel que acompaña al motor, y el
 * cierre lo conserva sin volver a pedirlo.
 */
describe('Orden de trabajo mandada a un taller (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let proveedorId: string;
  let equipoId: string;

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

    proveedorId = (
      await http.post('/api/proveedores').send({ nombre: 'Rebobinados Sur' }).expect(201)
    ).body.id;
    equipoId = (await http.post('/api/equipos').send({ nombre: 'Motor 15 HP' }).expect(201)).body
      .id;
  });

  afterAll(async () => {
    await app?.close();
  });

  const abrir = () =>
    http
      .post('/api/ordenes-trabajo')
      .send({ titulo: 'Rebobinar motor', tipo: 'CORRECTIVO', equipoId })
      .expect(201)
      .then((r) => r.body.id as string);

  it('con la orden abierta se indica el taller, y el cierre lo conserva', async () => {
    const id = await abrir();

    const enviada = await http
      .patch(`/api/ordenes-trabajo/${id}`)
      .send({ ejecutor: 'EXTERNO', proveedorId })
      .expect(200);
    expect(enviada.body.estado).toBe('ABIERTA');
    expect(enviada.body.ejecutor).toBe('EXTERNO');
    expect(enviada.body.proveedorNombre).toBe('Rebobinados Sur');

    const cerrada = await http
      .post(`/api/ordenes-trabajo/${id}/cerrar`)
      .send({ resolucion: 'Volvió rebobinado' })
      .expect(201);
    expect(cerrada.body.ejecutor).toBe('EXTERNO');
    expect(cerrada.body.proveedorNombre).toBe('Rebobinados Sur');
  });

  it('REGRESION: externo sin decir a qué proveedor se rechaza con 400', async () => {
    const id = await abrir();
    const r = await http
      .patch(`/api/ordenes-trabajo/${id}`)
      .send({ ejecutor: 'EXTERNO' })
      .expect(400);
    expect(JSON.stringify(r.body)).toMatch(/qué proveedor/);
  });
});
