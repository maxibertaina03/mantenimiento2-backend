import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * Equipos montados dentro de otros: la electrobomba en la desnatadora.
 *
 * De punta a punta por HTTP: montar, trasladar, desmontar, lo que no se puede
 * hacer, y que el historial de la máquina sume los trabajos de sus componentes
 * solo mientras estuvieron montados ahí.
 */
describe('Componentes de equipos (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const ids: Record<string, string> = {};

  /** Para que dos pasos seguidos no caigan en el mismo milisegundo. */
  const pausa = () => new Promise((r) => setTimeout(r, 25));

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

    for (const [clave, nombre] of [
      ['desnatadora', 'Desnatadora 1'],
      ['recibo', 'Bomba de recibo'],
      ['bomba', 'Electrobomba centrífuga trifásica'],
      ['motor', 'Motor 15 HP'],
    ]) {
      const r = await http.post('/api/equipos').send({ nombre }).expect(201);
      ids[clave] = r.body.id;
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  const montar = (quien: string, donde: string, motivo?: string) =>
    http.post(`/api/equipos/${ids[quien]}/montar`).send({ equipoPadreId: ids[donde], motivo });

  const trabajo = (sobre: string, titulo: string) =>
    http
      .post('/api/ordenes-trabajo')
      .send({ titulo, tipo: 'CORRECTIVO', equipoId: ids[sobre] })
      .expect(201);

  const historialDe = (quien: string, incluirComponentes: boolean) =>
    http
      .get('/api/ordenes-trabajo')
      .query({
        equipoId: ids[quien],
        ...(incluirComponentes ? { incluirComponentes: 'true' } : {}),
      })
      .expect(200)
      .then((r) => r.body.datos.map((o: { titulo: string }) => o.titulo).sort());

  it('un trabajo en la bomba ANTES de montarla (no tiene que contar para la desnatadora)', async () => {
    await trabajo('bomba', 'Bomba: revisión en el taller');
    await pausa();
  });

  it('monta la bomba en la desnatadora y cada ficha lo muestra', async () => {
    await montar('bomba', 'desnatadora', 'Instalación').expect(204);

    const bomba = await http.get(`/api/equipos/${ids.bomba}`).expect(200);
    expect(bomba.body).toMatchObject({
      equipoPadreId: ids.desnatadora,
      equipoPadreNombre: 'Desnatadora 1',
    });
    const desnatadora = await http.get(`/api/equipos/${ids.desnatadora}`).expect(200);
    expect(desnatadora.body.cantidadComponentes).toBe(1);

    const componentes = await http.get(`/api/equipos/${ids.desnatadora}/componentes`).expect(200);
    expect(componentes.body.map((c: { nombre: string }) => c.nombre)).toEqual([
      'Electrobomba centrífuga trifásica',
    ]);
  });

  it('REGRESION: no se cierra un círculo', async () => {
    await montar('motor', 'bomba').expect(204);
    // Motor en bomba en desnatadora: la desnatadora no puede ir en el motor.
    const r = await montar('desnatadora', 'motor');
    expect(r.status).toBe(400);
    expect(String(r.body.message)).toMatch(/adentro del otro/);
  });

  it('en sí mismo tampoco, y montarlo donde ya está se avisa', async () => {
    expect((await montar('bomba', 'bomba')).status).toBe(400);
    expect((await montar('bomba', 'desnatadora')).status).toBe(400);
  });

  it('el historial de la desnatadora suma lo de la bomba solo desde que está montada', async () => {
    await pausa();
    await trabajo('bomba', 'Bomba: cambio de sello');
    await trabajo('desnatadora', 'Desnatadora: limpieza de discos');
    await trabajo('motor', 'Motor: engrase de rodamientos');

    expect(await historialDe('desnatadora', false)).toEqual(['Desnatadora: limpieza de discos']);
    expect(await historialDe('desnatadora', true)).toEqual([
      'Bomba: cambio de sello',
      'Desnatadora: limpieza de discos',
      // Nieto: motor en bomba en desnatadora.
      'Motor: engrase de rodamientos',
    ]);
  });

  it('trasladar a otra máquina: lo nuevo ya no es de la desnatadora', async () => {
    await pausa();
    await montar('bomba', 'recibo', 'Se pasó a recibo').expect(204);
    await pausa();
    await trabajo('bomba', 'Bomba: ya en recibo');

    const desnatadora = await historialDe('desnatadora', true);
    expect(desnatadora).toContain('Bomba: cambio de sello');
    expect(desnatadora).not.toContain('Bomba: ya en recibo');
    expect(await historialDe('recibo', true)).toContain('Bomba: ya en recibo');

    const tramos = await http.get(`/api/equipos/${ids.bomba}/montajes`).expect(200);
    expect(tramos.body.map((t: { equipoPadreNombre: string }) => t.equipoPadreNombre)).toEqual([
      'Bomba de recibo',
      'Desnatadora 1',
    ]);
    expect(tramos.body[0].hasta).toBeNull();
    expect(tramos.body[1].hasta).toBeTruthy();
  });

  it('desmontar la deja suelta y cierra el tramo', async () => {
    await http
      .post(`/api/equipos/${ids.bomba}/desmontar`)
      .send({ motivo: 'A rebobinar' })
      .expect(204);
    const bomba = await http.get(`/api/equipos/${ids.bomba}`).expect(200);
    expect(bomba.body.equipoPadreId).toBeNull();
    const tramos = await http.get(`/api/equipos/${ids.bomba}/montajes`).expect(200);
    expect(tramos.body.every((t: { hasta: string | null }) => t.hasta !== null)).toBe(true);

    // Desmontar algo suelto se avisa.
    expect((await http.post(`/api/equipos/${ids.bomba}/desmontar`).send({})).status).toBe(400);
  });

  it('dar de baja un equipo montado lo desmonta solo', async () => {
    // El motor sigue en la bomba.
    await http.patch(`/api/equipos/${ids.motor}`).send({ estado: 'DADO_DE_BAJA' }).expect(200);
    const motor = await http.get(`/api/equipos/${ids.motor}`).expect(200);
    expect(motor.body.equipoPadreId).toBeNull();
  });
});
