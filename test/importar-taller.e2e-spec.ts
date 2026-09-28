import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * Importar la carpeta del taller.
 *
 * Se escribio despues de que los 96 equipos del taller entraran como maquinas
 * en produccion, para saber donde se perdia la clasificacion. El dominio ya
 * tenia sus tests; lo que faltaba era el camino completo, de la peticion a la
 * fila guardada.
 */
describe('Importar la carpeta del taller (e2e)', () => {
  let app: INestApplication;
  let memoria: ReturnType<typeof crearPrismaEnMemoria>;
  let http: ReturnType<typeof request>;

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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('la deteccion marca lo del Taller como herramienta', async () => {
    const r = await http
      .post('/api/equipos/detectar-importacion')
      .send({ rutas: ['FOTOS/Taller/Amoladora 1.jpg', 'FOTOS/Caldera/Bomba 1.jpg'] })
      .expect(200);

    const amoladora = r.body.equipos.find((e: any) => e.nombre === 'Amoladora 1');
    const bomba = r.body.equipos.find((e: any) => e.nombre === 'Bomba 1');

    expect(amoladora?.clasificacion).toBe('HERRAMIENTA');
    expect(bomba?.clasificacion).toBe('EQUIPO');
  });

  it('REGRESION: la clasificacion llega hasta la fila guardada', async () => {
    // Aca es donde se perdia: el dominio la ponia bien y el equipo terminaba
    // guardado como maquina igual.
    await http
      .post('/api/equipos/importar')
      .send({
        filas: [
          { nombre: 'Alicate 1', ubicacion: 'Taller', clasificacion: 'HERRAMIENTA' },
          { nombre: 'Bomba 9', ubicacion: 'Caldera' },
        ],
      })
      .expect(200);

    const lista = await http.get('/api/equipos?buscar=Alicate 1').expect(200);
    expect(lista.body.datos[0]?.clasificacion).toBe('HERRAMIENTA');

    const otra = await http.get('/api/equipos?buscar=Bomba 9').expect(200);
    expect(otra.body.datos[0]?.clasificacion).toBe('EQUIPO');
  });

  it('REGRESION: sin clasificacion, el sector Taller alcanza', async () => {
    // Es lo que paso de verdad: una pantalla vieja en el navegador mandaba
    // solo nombre y sector, y noventa y seis herramientas entraron como
    // maquinas. El servidor hace la deteccion, asi que no puede depender de
    // que el cliente le reenvie lo que el mismo calculo.
    await http
      .post('/api/equipos/importar')
      .send({ filas: [{ nombre: 'Pinza 20', ubicacion: 'Taller' }] })
      .expect(200);

    const lista = await http.get('/api/equipos?buscar=Pinza 20').expect(200);
    expect(lista.body.datos[0]?.clasificacion).toBe('HERRAMIENTA');
  });

  it('el sector Taller escrito distinto tambien cuenta', async () => {
    await http
      .post('/api/equipos/importar')
      .send({ filas: [{ nombre: 'Llave 30', ubicacion: 'TALLER' }] })
      .expect(200);

    const lista = await http.get('/api/equipos?buscar=Llave 30').expect(200);
    expect(lista.body.datos[0]?.clasificacion).toBe('HERRAMIENTA');
  });

  it('un sector cualquiera sigue siendo equipo', async () => {
    await http
      .post('/api/equipos/importar')
      .send({ filas: [{ nombre: 'Bomba 30', ubicacion: 'Recibo' }] })
      .expect(200);

    const lista = await http.get('/api/equipos?buscar=Bomba 30').expect(200);
    expect(lista.body.datos[0]?.clasificacion).toBe('EQUIPO');
  });
});
