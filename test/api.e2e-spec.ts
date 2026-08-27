import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * E2E contra la app REAL de Nest (routing, ValidationPipe, guard global y filtro
 * de excepciones incluidos), con la persistencia sustituida por una en memoria.
 * La configuración del bootstrap replica la de `main.ts`.
 */
describe('API (e2e)', () => {
  let app: INestApplication;
  let memoria: ReturnType<typeof crearPrismaEnMemoria>;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    // El entorno lo prepara test/setup-e2e.ts (antes de importar AppModule).
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

  // Ids sembrados por el primer bloque y reutilizados por los siguientes.
  let categoriaId: string;
  let materialId: string;
  let proveedorId: string;

  describe('Categorías', () => {
    it('POST /api/categorias-material crea una categoría', async () => {
      const res = await http
        .post('/api/categorias-material')
        .send({ nombre: 'Electricidad' })
        .expect(201);

      expect(res.body).toMatchObject({ nombre: 'Electricidad' });
      categoriaId = res.body.id;
    });

    it('GET /api/categorias-material lista', async () => {
      const res = await http.get('/api/categorias-material').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /api/categorias-material/:id inexistente devuelve 404', async () => {
      await http.get('/api/categorias-material/00000000-0000-4000-8000-00000000dead').expect(404);
    });
  });

  describe('Materiales', () => {
    it('POST /api/materiales crea un material con stock 0', async () => {
      const res = await http
        .post('/api/materiales')
        .send({ nombre: 'Cable 2.5mm', unidad: 'm', categoriaId, stockMinimo: 10 })
        .expect(201);

      expect(res.body).toMatchObject({ nombre: 'Cable 2.5mm', stockActual: 0 });
      materialId = res.body.id;
    });

    it('rechaza propiedades no declaradas en el DTO (forbidNonWhitelisted)', async () => {
      await http
        .post('/api/materiales')
        .send({ nombre: 'Valido', unidad: 'u', categoriaId, campoInventado: 'hack' })
        .expect(400);
    });

    it('rechaza un material sin nombre', async () => {
      await http.post('/api/materiales').send({ unidad: 'u', categoriaId }).expect(400);
    });

    it('rechaza una categoría inexistente con 404 (no con error de FK)', async () => {
      await http
        .post('/api/materiales')
        .send({
          nombre: 'Material huerfano',
          unidad: 'u',
          categoriaId: '00000000-0000-4000-8000-00000000dead',
        })
        .expect(404);
    });

    it('GET /api/materiales devuelve la forma paginada', async () => {
      const res = await http.get('/api/materiales?pagina=1&limite=20').expect(200);
      expect(res.body).toHaveProperty('datos');
      expect(res.body).toMatchObject({ pagina: 1, limite: 20 });
    });

    it('GET /api/materiales?buscar= filtra por nombre', async () => {
      const res = await http.get('/api/materiales?buscar=cable').expect(200);
      expect(res.body.datos.length).toBeGreaterThan(0);
      const vacio = await http.get('/api/materiales?buscar=zzzznoexiste').expect(200);
      expect(vacio.body.datos).toHaveLength(0);
    });

    it('rechaza limite > 100 (tope de paginación)', async () => {
      await http.get('/api/materiales?limite=500').expect(400);
    });

    it('rechaza un id que no es UUID con 400', async () => {
      await http.get('/api/materiales/no-es-uuid').expect(400);
    });
  });

  describe('Proveedores', () => {
    it('POST /api/proveedores crea un proveedor', async () => {
      const res = await http
        .post('/api/proveedores')
        .send({ nombre: 'Ferretería Central', cuit: '30-12345678-9' })
        .expect(201);
      proveedorId = res.body.id;
      expect(res.body.nombre).toBe('Ferretería Central');
    });

    it('acepta CUIT duplicado (hay repetidos en los datos reales)', async () => {
      await http
        .post('/api/proveedores')
        .send({ nombre: 'Ferretería Sucursal 2', cuit: '30-12345678-9' })
        .expect(201);
    });

    it('busca por nombre y por CUIT', async () => {
      const porNombre = await http.get('/api/proveedores?buscar=Central').expect(200);
      expect(porNombre.body.datos.length).toBe(1);
      const porCuit = await http.get('/api/proveedores?buscar=30-12345678').expect(200);
      expect(porCuit.body.datos.length).toBe(2);
    });
  });

  describe('Movimientos — ciclo de stock completo', () => {
    it('ENTRADA suma stock', async () => {
      await http
        .post('/api/movimientos')
        .send({ materialId, tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 100, proveedorId })
        .expect(201);

      const material = await http.get(`/api/materiales/${materialId}`).expect(200);
      expect(material.body.stockActual).toBe(100);
    });

    it('SALIDA resta stock', async () => {
      await http
        .post('/api/movimientos')
        .send({ materialId, tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 30 })
        .expect(201);

      const material = await http.get(`/api/materiales/${materialId}`).expect(200);
      expect(material.body.stockActual).toBe(70);
    });

    it('SALIDA mayor al stock devuelve 400 y no altera el stock', async () => {
      await http
        .post('/api/movimientos')
        .send({ materialId, tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 9999 })
        .expect(400);

      const material = await http.get(`/api/materiales/${materialId}`).expect(200);
      expect(material.body.stockActual).toBe(70);
    });

    it('motivo incoherente con el tipo devuelve 400', async () => {
      await http
        .post('/api/movimientos')
        .send({ materialId, tipo: 'SALIDA', motivo: 'COMPRA', cantidad: 1 })
        .expect(400);
    });

    it('AJUSTE fija el stock al valor absoluto', async () => {
      await http
        .post('/api/movimientos')
        .send({ materialId, tipo: 'AJUSTE', motivo: 'AJUSTE', cantidad: 5 })
        .expect(201);

      const material = await http.get(`/api/materiales/${materialId}`).expect(200);
      expect(material.body.stockActual).toBe(5);
    });

    it('maneja cantidades decimales sin error de punto flotante', async () => {
      const res = await http
        .post('/api/materiales')
        .send({ nombre: 'Pintura', unidad: 'lt', categoriaId })
        .expect(201);
      const pinturaId = res.body.id;

      for (const cantidad of [0.1, 0.2]) {
        await http
          .post('/api/movimientos')
          .send({ materialId: pinturaId, tipo: 'ENTRADA', motivo: 'COMPRA', cantidad })
          .expect(201);
      }

      const material = await http.get(`/api/materiales/${pinturaId}`).expect(200);
      expect(material.body.stockActual).toBe(0.3);
    });

    it('un material inexistente devuelve 404', async () => {
      await http
        .post('/api/movimientos')
        .send({
          materialId: '00000000-0000-4000-8000-00000000dead',
          tipo: 'ENTRADA',
          motivo: 'COMPRA',
          cantidad: 1,
        })
        .expect(404);
    });

    it('GET /api/movimientos lista con la forma paginada', async () => {
      const res = await http.get('/api/movimientos?pagina=1&limite=20').expect(200);
      expect(res.body.datos.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('total');
    });

    it('filtra por materialId y por tipo', async () => {
      const res = await http
        .get(`/api/movimientos?materialId=${materialId}&tipo=ENTRADA`)
        .expect(200);
      expect(res.body.datos.every((m: any) => m.tipo === 'ENTRADA')).toBe(true);
    });

    it('REGRESION: el filtro por fecha del día de hoy incluye los movimientos de hoy', async () => {
      const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const res = await http
        .get(`/api/movimientos?fechaDesde=${hoy}&fechaHasta=${hoy}`)
        .expect(200);
      expect(res.body.datos.length).toBeGreaterThan(0);
    });

    it('el listado incluye el nombre del material y del proveedor', async () => {
      const res = await http.get(`/api/movimientos?materialId=${materialId}`).expect(200);
      const conProveedor = res.body.datos.find((m: any) => m.proveedorNombre);
      expect(conProveedor.materialNombre).toBe('Cable 2.5mm');
      expect(conProveedor.proveedorNombre).toBe('Ferretería Central');
    });
  });

  describe('Bajo stock', () => {
    it('marca el material cuyo stock cayó por debajo del mínimo', async () => {
      // Cable: stockMinimo 10, stock actual 5 tras el AJUSTE.
      const res = await http.get('/api/materiales/bajo-stock').expect(200);
      expect(res.body.some((m: any) => m.id === materialId)).toBe(true);
    });

    it('NO marca materiales con stockMinimo 0 (los pendientes de clasificar)', async () => {
      const res = await http.get('/api/materiales/bajo-stock').expect(200);
      expect(res.body.every((m: any) => m.stockMinimo > 0)).toBe(true);
    });
  });

  describe('Edición de movimientos y auditoría', () => {
    let movimientoId: string;

    beforeAll(async () => {
      const res = await http
        .post('/api/materiales')
        .send({ nombre: 'Tornillos', unidad: 'u', categoriaId })
        .expect(201);
      const tornillosId = res.body.id;

      const mov = await http
        .post('/api/movimientos')
        .send({ materialId: tornillosId, tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 50 })
        .expect(201);
      movimientoId = mov.body.id;
    });

    it('exige motivoEdicion (queda en auditoría)', async () => {
      await http.patch(`/api/movimientos/${movimientoId}`).send({ cantidad: 40 }).expect(400);
    });

    it('edita y recalcula el stock', async () => {
      const res = await http
        .patch(`/api/movimientos/${movimientoId}`)
        .send({ cantidad: 40, motivoEdicion: 'se cargó de más' })
        .expect(200);

      expect(res.body.cantidad).toBe(40);
      const material = await http.get(`/api/materiales/${res.body.materialId}`).expect(200);
      expect(material.body.stockActual).toBe(40);
    });

    it('marca el movimiento como editado', async () => {
      const res = await http.get(`/api/movimientos/${movimientoId}`).expect(200);
      expect(res.body.editado).toBe(true);
    });

    it('GET /:id/ediciones devuelve la auditoría con antes/después', async () => {
      const res = await http.get(`/api/movimientos/${movimientoId}/ediciones`).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].motivo).toBe('se cargó de más');
      expect(res.body[0].cambios.antes.cantidad).toBe(50);
      expect(res.body[0].cambios.despues.cantidad).toBe(40);
    });

    it('REGRESION: rechaza una edición que dejaría el stock negativo', async () => {
      // Material nuevo: entra 10, sale 10 -> stock 0.
      const mat = await http
        .post('/api/materiales')
        .send({ nombre: 'Arandelas', unidad: 'u', categoriaId })
        .expect(201);

      const entrada = await http
        .post('/api/movimientos')
        .send({ materialId: mat.body.id, tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 10 })
        .expect(201);

      await http
        .post('/api/movimientos')
        .send({ materialId: mat.body.id, tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 10 })
        .expect(201);

      // Bajar la entrada a 1 dejaría el stock en -9.
      await http
        .patch(`/api/movimientos/${entrada.body.id}`)
        .send({ cantidad: 1, motivoEdicion: 'corrección inválida' })
        .expect(400);

      // El stock queda intacto y no se registró auditoría.
      const material = await http.get(`/api/materiales/${mat.body.id}`).expect(200);
      expect(material.body.stockActual).toBe(0);

      const ediciones = await http.get(`/api/movimientos/${entrada.body.id}/ediciones`).expect(200);
      expect(ediciones.body).toHaveLength(0);
    });

    it('editar un movimiento inexistente devuelve 404', async () => {
      await http
        .patch('/api/movimientos/00000000-0000-4000-8000-00000000dead')
        .send({ cantidad: 1, motivoEdicion: 'no existe' })
        .expect(404);
    });
  });

  describe('Integridad referencial', () => {
    it('no permite borrar un material con movimientos', async () => {
      await http.delete(`/api/materiales/${materialId}`).expect(400);
    });

    it('no permite borrar una categoría en uso', async () => {
      await http.delete(`/api/categorias-material/${categoriaId}`).expect(400);
    });
  });
});
