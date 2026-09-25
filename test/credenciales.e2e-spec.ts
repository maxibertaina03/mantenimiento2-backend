import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * El baul de credenciales, contra la app de verdad.
 *
 * Estos tests existen para poder MOVER este modulo a un bounded context sin
 * romperlo. Por eso no tocan ninguna clase de adentro: solo mandan peticiones
 * y miran la respuesta. El dia que el service se parta en dominio y casos de
 * uso, estos tests no tienen que cambiar ni una linea; si cambian, es que
 * cambio el comportamiento, que es justo lo que no puede pasar.
 *
 * Lo que fijan es la parte que no se puede romper sin que alguien se entere
 * tarde: que la contrasenia NUNCA viaje salvo cuando se la pide a proposito, y
 * que pedirla deje rastro de quien la vio.
 */
describe('Credenciales (e2e)', () => {
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

  /** Crea una credencial y devuelve su cuerpo. */
  async function crear(datos: Record<string, unknown> = {}) {
    const r = await http
      .post('/api/credenciales')
      .send({
        nombre: `Acceso ${Math.random().toString(36).slice(2, 8)}`,
        secreto: 'Clave123!',
        ...datos,
      })
      .expect(201);
    return r.body;
  }

  describe('guardar un acceso', () => {
    it('lo crea y contesta la ficha, sin la contrasenia', async () => {
      const cuerpo = await crear({ nombre: 'Servidor de camaras', usuario: 'admin' });

      expect(cuerpo.id).toBeTruthy();
      expect(cuerpo.nombre).toBe('Servidor de camaras');
      expect(cuerpo.usuario).toBe('admin');
      expect(JSON.stringify(cuerpo)).not.toContain('Clave123!');
    });

    it('REGRESION: dos accesos no pueden llamarse igual', async () => {
      // Si se repiten los nombres, elegir cual revelar es adivinar.
      await crear({ nombre: 'PC de recepcion' });

      const r = await http
        .post('/api/credenciales')
        .send({ nombre: 'PC de recepcion', secreto: 'Otra123!' })
        .expect(400);

      expect(String(r.body.message)).toMatch(/ya/i);
    });

    it('sin nombre no se guarda', async () => {
      await http.post('/api/credenciales').send({ secreto: 'Clave123!' }).expect(400);
    });

    it('sin contrasenia tampoco', async () => {
      await http.post('/api/credenciales').send({ nombre: 'Algo' }).expect(400);
    });

    it('REGRESION: no se puede colgar de un equipo que no existe', async () => {
      // Sin esto quedaria apuntando a un id que no lleva a ningun lado.
      await http
        .post('/api/credenciales')
        .send({
          nombre: 'Grabadora del pasillo',
          secreto: 'Clave123!',
          equipoItId: '11111111-1111-4111-8111-111111111111',
        })
        .expect(404);
    });
  });

  describe('listar y mirar la ficha', () => {
    it('REGRESION: el listado no trae ninguna contrasenia', async () => {
      // Es la razon de ser del baul: se ven los accesos, no los secretos.
      await crear({ nombre: 'Listado uno', secreto: 'SecretoUno1!' });

      const r = await http.get('/api/credenciales').expect(200);

      expect(r.body.datos.length).toBeGreaterThan(0);
      expect(JSON.stringify(r.body)).not.toContain('SecretoUno1!');
    });

    it('la ficha tampoco', async () => {
      const cred = await crear({ nombre: 'Ficha sola', secreto: 'SecretoFicha1!' });

      const r = await http.get(`/api/credenciales/${cred.id}`).expect(200);

      expect(r.body.nombre).toBe('Ficha sola');
      expect(JSON.stringify(r.body)).not.toContain('SecretoFicha1!');
    });

    it('una que no existe da 404, no un cuerpo vacio', async () => {
      await http.get('/api/credenciales/11111111-1111-4111-8111-111111111111').expect(404);
    });

    it('un id que no es un id da 400', async () => {
      await http.get('/api/credenciales/no-es-un-uuid').expect(400);
    });
  });

  describe('ver la contrasenia', () => {
    it('la devuelve, y es la que se guardo', async () => {
      const cred = await crear({ nombre: 'Para revelar', secreto: 'LaDeVerdad1!' });

      const r = await http.post(`/api/credenciales/${cred.id}/revelar`).expect(200);

      expect(r.body.secreto).toBe('LaDeVerdad1!');
    });

    it('REGRESION: pedirla queda registrado en el historial', async () => {
      // El baul no impide ver una contrasenia: deja constancia de quien la
      // vio. Sin el registro, guardar los accesos aca no agrega nada.
      const cred = await crear({ nombre: 'Con rastro', secreto: 'ConRastro1!' });

      await http.post(`/api/credenciales/${cred.id}/revelar`).expect(200);
      const r = await http.get(`/api/credenciales/${cred.id}/historial`).expect(200);

      expect(r.body.vistas.length).toBe(1);
    });

    it('es POST y no GET: un GET queda en el historial del navegador', async () => {
      const cred = await crear();
      await http.get(`/api/credenciales/${cred.id}/revelar`).expect(404);
    });
  });

  describe('cambiar la contrasenia', () => {
    it('la cambia, y desde entonces revela la nueva', async () => {
      const cred = await crear({ nombre: 'Para rotar', secreto: 'LaVieja1!' });

      await http
        .post(`/api/credenciales/${cred.id}/rotar`)
        .send({ secreto: 'LaNueva1!' })
        .expect(200);

      const r = await http.post(`/api/credenciales/${cred.id}/revelar`).expect(200);
      expect(r.body.secreto).toBe('LaNueva1!');
    });

    it('REGRESION: rechaza una contrasenia que ya se uso en este acceso', async () => {
      // Rotar para volver a la de antes es no haber rotado.
      const cred = await crear({ nombre: 'Sin repetir', secreto: 'Primera1!' });
      await http
        .post(`/api/credenciales/${cred.id}/rotar`)
        .send({ secreto: 'Segunda1!' })
        .expect(200);

      const r = await http
        .post(`/api/credenciales/${cred.id}/rotar`)
        .send({ secreto: 'Primera1!' })
        .expect(400);

      expect(String(r.body.message)).toMatch(/us/i);
    });

    it('la rotacion queda en el historial', async () => {
      const cred = await crear({ nombre: 'Rotada con registro', secreto: 'Antes1!' });
      await http
        .post(`/api/credenciales/${cred.id}/rotar`)
        .send({ secreto: 'Despues1!' })
        .expect(200);

      const r = await http.get(`/api/credenciales/${cred.id}/historial`).expect(200);

      expect(r.body.rotaciones.length).toBe(1);
    });

    it('REGRESION: el historial no guarda las contrasenias viejas', async () => {
      // Guardarlas convertiria el historial en una lista de claves que
      // probablemente sigan en uso en otro lado.
      const cred = await crear({ nombre: 'Historial limpio', secreto: 'Vieja1!' });
      await http
        .post(`/api/credenciales/${cred.id}/rotar`)
        .send({ secreto: 'Nueva1!' })
        .expect(200);

      const r = await http.get(`/api/credenciales/${cred.id}/historial`).expect(200);

      expect(JSON.stringify(r.body)).not.toContain('Vieja1!');
      expect(JSON.stringify(r.body)).not.toContain('Nueva1!');
    });
  });

  describe('editar y dar de baja', () => {
    it('se edita la ficha', async () => {
      const cred = await crear({ nombre: 'Antes de editar' });

      const r = await http
        .patch(`/api/credenciales/${cred.id}`)
        .send({ notas: 'Esta en la oficina de arriba' })
        .expect(200);

      expect(r.body.notas).toBe('Esta en la oficina de arriba');
    });

    it('REGRESION: la contrasenia no se edita por aca', async () => {
      // Se cambia rotando, que es lo que deja registro. Si se pudiera editar,
      // habria un camino para cambiarla sin que quede rastro.
      const cred = await crear({ nombre: 'No se edita el secreto', secreto: 'Original1!' });

      await http.patch(`/api/credenciales/${cred.id}`).send({ secreto: 'Colada1!' }).expect(400);

      const r = await http.post(`/api/credenciales/${cred.id}/revelar`).expect(200);
      expect(r.body.secreto).toBe('Original1!');
    });

    it('se puede desactivar sin perder el historial', async () => {
      const cred = await crear({ nombre: 'Para desactivar' });

      const r = await http
        .patch(`/api/credenciales/${cred.id}`)
        .send({ activo: false })
        .expect(200);

      expect(r.body.activo).toBe(false);
    });

    it('borrarla la saca del listado', async () => {
      const cred = await crear({ nombre: 'Para borrar' });

      await http.delete(`/api/credenciales/${cred.id}`).expect(204);
      await http.get(`/api/credenciales/${cred.id}`).expect(404);
    });
  });
});
