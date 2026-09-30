import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { ALMACEN_MANUALES, AlmacenManuales } from '../src/contextos/equipos/puertos/manuales';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * Los manuales en PDF de los equipos, de punta a punta por HTTP.
 *
 * El archivo viaja como multipart, que es lo que no se puede probar sin
 * levantar la aplicación entera. El almacén es uno en memoria: estos tests
 * nunca suben nada a Supabase.
 */
describe('Manuales de equipos (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let equipoId: string;
  const archivos = new Map<string, Buffer>();

  const almacen: AlmacenManuales = {
    estaConfigurado: () => true,
    subir: async (contenido, nombre, carpeta) => {
      const ruta = `${carpeta}/${archivos.size + 1}.pdf`;
      archivos.set(ruta, contenido);
      return { ruta };
    },
    enlace: async (ruta) => `https://almacen.test/${ruta}?firmado`,
    borrar: async (ruta) => {
      archivos.delete(ruta);
    },
  };

  const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF');

  beforeAll(async () => {
    const memoria = crearPrismaEnMemoria();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(memoria.prisma)
      .overrideProvider(ALMACEN_MANUALES)
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

  const subir = (contenido: Buffer, nombreArchivo: string, nombre?: string) => {
    const r = http.post(`/api/equipos/${equipoId}/manuales`).attach('archivo', contenido, {
      filename: nombreArchivo,
      contentType: 'application/pdf',
    });
    return nombre ? r.field('nombre', nombre) : r;
  };

  it('sube un PDF y aparece en la lista, con acentos en el nombre', async () => {
    const r = await subir(PDF, 'manual.pdf', 'Manual de operación.pdf').expect(201);
    expect(r.body).toMatchObject({ nombre: 'Manual de operación.pdf', tamanoBytes: PDF.length });
    expect(r.body).not.toHaveProperty('ruta');

    const lista = await http.get(`/api/equipos/${equipoId}/manuales`).expect(200);
    expect(lista.body.disponible).toBe(true);
    expect(lista.body.manuales.map((m: { nombre: string }) => m.nombre)).toContain(
      'Manual de operación.pdf',
    );
  });

  it('da un enlace para abrirlo', async () => {
    const m = await subir(PDF, 'despiece.pdf').expect(201);
    const r = await http.get(`/api/equipos/${equipoId}/manuales/${m.body.id}/enlace`).expect(200);
    expect(r.body.url).toContain('?firmado');
    expect(r.body.vence).toBeTruthy();
  });

  it('REGRESION: algo que no es PDF se rechaza, aunque diga .pdf', async () => {
    const r = await subir(Buffer.from('esto es una foto'), 'truco.pdf');
    expect(r.status).toBe(400);
    expect(String(r.body.message)).toMatch(/tiene que ser un PDF/);
  });

  it('sin archivo, lo dice', async () => {
    const r = await http.post(`/api/equipos/${equipoId}/manuales`).field('nombre', 'x.pdf');
    expect(r.status).toBe(400);
    expect(String(r.body.message)).toMatch(/No llegó ningún archivo/);
  });

  it('borrar se lleva la fila y el archivo', async () => {
    const m = await subir(PDF, 'viejo.pdf').expect(201);
    const antes = archivos.size;
    await http.delete(`/api/equipos/${equipoId}/manuales/${m.body.id}`).expect(204);
    expect(archivos.size).toBe(antes - 1);
    const lista = await http.get(`/api/equipos/${equipoId}/manuales`).expect(200);
    expect(lista.body.manuales.map((x: { id: string }) => x.id)).not.toContain(m.body.id);
  });

  it('a un equipo que no existe es 404', async () => {
    await http.get('/api/equipos/00000000-0000-4000-8000-00000000dead/manuales').expect(404);
  });
});
