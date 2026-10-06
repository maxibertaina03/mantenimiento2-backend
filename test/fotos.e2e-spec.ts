import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { ALMACEN_IMAGENES } from '../src/contextos/equipos/puertos/almacen-imagenes';
import { AlmacenImagenesEnMemoria } from '../src/contextos/equipos/aplicacion/almacen-en-memoria';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * Las otras fotos de un equipo (la chapa, el tablero), de punta a punta por
 * HTTP. El almacén es uno en memoria: nunca se sube nada a Supabase.
 */
describe('Fotos de equipos (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let equipoId: string;
  const almacen = new AlmacenImagenesEnMemoria();
  const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6])
    .toString('base64')
    .padEnd(120, 'A');

  beforeAll(async () => {
    const memoria = crearPrismaEnMemoria();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(memoria.prisma)
      .overrideProvider(ALMACEN_IMAGENES)
      .useValue(almacen)
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

    const eq = await http.post('/api/equipos').send({ nombre: 'Bomba centrífuga 3' }).expect(201);
    equipoId = eq.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  const base = () => `/api/equipos/${equipoId}/fotos`;

  it('agrega la chapa con su descripción, y la lista no muestra la ruta interna', async () => {
    const r = await http
      .post(base())
      .send({ imagenBase64: JPG, nombreArchivo: 'chapa.jpg', descripcion: 'Chapa característica' })
      .expect(201);
    expect(r.body).toMatchObject({ descripcion: 'Chapa característica' });
    expect(r.body).not.toHaveProperty('ruta');

    const lista = await http.get(base()).expect(200);
    expect(lista.body.map((f: { id: string }) => f.id)).toContain(r.body.id);
  });

  it('cambia la descripción, y vacía la deja sin descripción', async () => {
    const f = await http
      .post(base())
      .send({ imagenBase64: JPG, nombreArchivo: 'a.jpg' })
      .expect(201);
    const r = await http
      .patch(`${base()}/${f.body.id}`)
      .send({ descripcion: 'Tablero' })
      .expect(200);
    expect(r.body.descripcion).toBe('Tablero');
    const r2 = await http.patch(`${base()}/${f.body.id}`).send({ descripcion: '' }).expect(200);
    expect(r2.body.descripcion).toBeNull();
  });

  it('usar como principal: la foto pasa al equipo y sale de la lista si no había principal', async () => {
    const f = await http
      .post(base())
      .send({ imagenBase64: JPG, nombreArchivo: 'maquina.jpg' })
      .expect(201);
    await http.post(`${base()}/${f.body.id}/principal`).expect(204);

    const eq = await http.get(`/api/equipos/${equipoId}`).expect(200);
    expect(eq.body.fotoUrl).toBe(f.body.url);
    const lista = await http.get(base()).expect(200);
    expect(lista.body.map((x: { id: string }) => x.id)).not.toContain(f.body.id);
  });

  it('borrar la saca de la lista y del almacén', async () => {
    const f = await http
      .post(base())
      .send({ imagenBase64: JPG, nombreArchivo: 'b.jpg' })
      .expect(201);
    await http.delete(`${base()}/${f.body.id}`).expect(204);

    const lista = await http.get(base()).expect(200);
    expect(lista.body.map((x: { id: string }) => x.id)).not.toContain(f.body.id);
    expect(almacen.borradas.length).toBeGreaterThan(0);
  });

  it('a un equipo que no existe es 404', async () => {
    await http.get('/api/equipos/00000000-0000-4000-8000-00000000dead/fotos').expect(404);
  });
});
