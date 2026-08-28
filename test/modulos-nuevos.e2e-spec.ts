import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FiltroExcepcionesHttp } from '../src/common/filters/http-exception.filter';
import { crearPrismaEnMemoria } from './prisma-en-memoria';

/**
 * E2E de los módulos IT y Órdenes de Compra contra la app real de Nest.
 * El caso central es el ciclo OC → recepción → movimientos de stock.
 */
describe('Módulos IT y Órdenes de compra (e2e)', () => {
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

  // Del catálogo que siembra el Prisma en memoria, igual que en producción.
  const UNIDAD_UNIDAD = 'b0000001-0000-4000-8000-000000000001';
  const UNIDAD_METRO = 'b0000002-0000-4000-8000-000000000002';

  let categoriaId: string;
  let materialA: string;
  let materialB: string;
  let proveedorId: string;
  let usuarioId: string;

  beforeAll(async () => {
    const cat = await http.post('/api/categorias-material').send({ nombre: 'Insumos' }).expect(201);
    categoriaId = cat.body.id;

    const mA = await http
      .post('/api/materiales')
      .send({ nombre: 'Cable 2.5mm', unidadId: UNIDAD_METRO, categoriaId })
      .expect(201);
    materialA = mA.body.id;

    const mB = await http
      .post('/api/materiales')
      .send({ nombre: 'Tornillo 6x40', unidadId: UNIDAD_UNIDAD, categoriaId })
      .expect(201);
    materialB = mB.body.id;

    const prov = await http
      .post('/api/proveedores')
      .send({ nombre: 'Ferretería Central', cuit: '30-12345678-9' })
      .expect(201);
    proveedorId = prov.body.id;

    const user = await http
      .post('/api/usuarios')
      .send({ nombre: 'Juan Pérez', email: 'juan@lastres.com' })
      .expect(201);
    usuarioId = user.body.id;
  });

  // ═════════════════════ Órdenes de compra ═════════════════════

  describe('Órdenes de compra', () => {
    let ordenId: string;

    it('crea una orden con número correlativo automático', async () => {
      const res = await http
        .post('/api/ordenes-compra')
        .send({
          proveedorId,
          observaciones: 'Entregar en portería',
          renglones: [
            { materialId: materialA, cantidad: 100, precioUnitario: 1250.5 },
            { materialId: materialB, cantidad: 500, precioUnitario: 12.75 },
          ],
        })
        .expect(201);

      expect(res.body.numero).toMatch(/^OC-\d{4}-0001$/);
      expect(res.body.estado).toBe('BORRADOR');
      expect(res.body.renglones).toHaveLength(2);
      ordenId = res.body.id;
    });

    it('la orden trae el nombre y CUIT del proveedor (para imprimir)', async () => {
      const res = await http.get(`/api/ordenes-compra/${ordenId}`).expect(200);
      expect(res.body.proveedorNombre).toBe('Ferretería Central');
      expect(res.body.proveedorCuit).toBe('30-12345678-9');
    });

    it('la orden trae el contacto del proveedor (para enviarla)', async () => {
      const res = await http.get(`/api/ordenes-compra/${ordenId}`).expect(200);
      // Sin estos datos la UI no puede ofrecer mail ni WhatsApp.
      expect(res.body).toHaveProperty('proveedorEmail');
      expect(res.body).toHaveProperty('proveedorTelefono');
    });

    it('calcula subtotales y total', async () => {
      const res = await http.get(`/api/ordenes-compra/${ordenId}`).expect(200);
      // 100 × 1250.50 = 125050 ; 500 × 12.75 = 6375
      expect(res.body.total).toBe(131425);
    });

    it('los renglones traen nombre y unidad del material', async () => {
      const res = await http.get(`/api/ordenes-compra/${ordenId}`).expect(200);
      const renglon = res.body.renglones.find((r: any) => r.materialId === materialA);
      expect(renglon.materialNombre).toBe('Cable 2.5mm');
      expect(renglon.unidad).toBe('m');
    });

    it('el segundo número correlativo es 0002', async () => {
      const res = await http
        .post('/api/ordenes-compra')
        .send({ proveedorId, renglones: [{ materialId: materialA, cantidad: 1 }] })
        .expect(201);
      expect(res.body.numero).toMatch(/^OC-\d{4}-0002$/);
    });

    it('rechaza una orden sin renglones', async () => {
      await http.post('/api/ordenes-compra').send({ proveedorId, renglones: [] }).expect(400);
    });

    it('rechaza cantidad 0 o negativa', async () => {
      await http
        .post('/api/ordenes-compra')
        .send({ proveedorId, renglones: [{ materialId: materialA, cantidad: 0 }] })
        .expect(400);
    });

    it('rechaza un proveedor inexistente con 404', async () => {
      await http
        .post('/api/ordenes-compra')
        .send({
          proveedorId: '00000000-0000-4000-8000-00000000dead',
          renglones: [{ materialId: materialA, cantidad: 1 }],
        })
        .expect(404);
    });

    it('REGRESIÓN: rechaza el mismo material repetido en dos renglones', async () => {
      await http
        .post('/api/ordenes-compra')
        .send({
          proveedorId,
          renglones: [
            { materialId: materialA, cantidad: 10 },
            { materialId: materialA, cantidad: 5 },
          ],
        })
        .expect(400);
    });

    it('REGRESIÓN: no se puede recibir sin emitir primero', async () => {
      await http.patch(`/api/ordenes-compra/${ordenId}/recibir`).send({}).expect(400);
    });

    it('emite la orden', async () => {
      const res = await http.patch(`/api/ordenes-compra/${ordenId}/emitir`).expect(200);
      expect(res.body.estado).toBe('EMITIDA');
      expect(res.body.editable).toBe(false);
    });

    it('REGRESIÓN: una orden emitida ya no se puede editar', async () => {
      await http
        .patch(`/api/ordenes-compra/${ordenId}`)
        .send({ observaciones: 'cambio tardío' })
        .expect(400);
    });

    it('RECEPCIÓN: genera los movimientos de ENTRADA y suma el stock', async () => {
      // Antes de recibir, el stock está en 0.
      const antesA = await http.get(`/api/materiales/${materialA}`).expect(200);
      expect(antesA.body.stockActual).toBe(0);

      const res = await http
        .patch(`/api/ordenes-compra/${ordenId}/recibir`)
        .send({ remito: 'R-0001-00012345' })
        .expect(200);
      expect(res.body.estado).toBe('RECIBIDA');

      // El stock de ambos materiales subió por la cantidad pedida.
      const despuesA = await http.get(`/api/materiales/${materialA}`).expect(200);
      expect(despuesA.body.stockActual).toBe(100);
      const despuesB = await http.get(`/api/materiales/${materialB}`).expect(200);
      expect(despuesB.body.stockActual).toBe(500);
    });

    it('TRAZABILIDAD: los movimientos referencian la orden y el remito', async () => {
      const res = await http.get(`/api/movimientos?materialId=${materialA}`).expect(200);
      const movimiento = res.body.datos[0];
      expect(movimiento.tipo).toBe('ENTRADA');
      expect(movimiento.motivo).toBe('COMPRA');
      expect(movimiento.referenciaTrabajo).toMatch(/OC-\d{4}-0001 · Remito R-0001-00012345/);
      expect(movimiento.proveedorNombre).toBe('Ferretería Central');
    });

    it('TRAZABILIDAD: cada renglón queda enlazado a su movimiento', async () => {
      const res = await http.get(`/api/ordenes-compra/${ordenId}`).expect(200);
      for (const renglon of res.body.renglones) {
        expect(renglon.movimientoId).toBeTruthy();
      }
    });

    it('REGRESIÓN: recibir dos veces no duplica el stock', async () => {
      await http.patch(`/api/ordenes-compra/${ordenId}/recibir`).send({}).expect(400);

      const material = await http.get(`/api/materiales/${materialA}`).expect(200);
      expect(material.body.stockActual).toBe(100); // sigue igual
    });

    it('REGRESIÓN: una orden recibida no se puede anular ni eliminar', async () => {
      await http.patch(`/api/ordenes-compra/${ordenId}/anular`).expect(400);
      await http.delete(`/api/ordenes-compra/${ordenId}`).expect(400);
    });

    it('filtra el listado por estado', async () => {
      const res = await http.get('/api/ordenes-compra?estado=RECIBIDA').expect(200);
      expect(res.body.datos.every((o: any) => o.estado === 'RECIBIDA')).toBe(true);
    });

    it('busca por número de orden', async () => {
      const res = await http.get('/api/ordenes-compra?buscar=0002').expect(200);
      expect(res.body.datos.length).toBe(1);
    });
  });

  // ═════════════════════ Equipos IT ═════════════════════

  describe('Equipos IT', () => {
    let notebookId: string;
    /** Ids del catálogo de tipos, por nombre. */
    let tipos: Record<string, string> = {};

    beforeAll(async () => {
      const res = await http.get('/api/tipos-equipo').expect(200);
      tipos = Object.fromEntries(
        res.body.map((t: { nombre: string; id: string }) => [t.nombre, t.id]),
      );
    });

    it('registra una notebook con sus especificaciones', async () => {
      const res = await http
        .post('/api/equipos-it')
        .send({
          codigoInterno: 'IT-0042',
          tipoId: tipos['Notebook'],
          marca: 'Dell',
          modelo: 'Latitude 5420',
          numeroSerie: 'SN-8F3K2P',
          procesador: 'Intel Core i5-1135G7',
          memoriaRamGb: 16,
          discoTipo: 'SSD',
          discoCapacidadGb: 512,
          sistemaOperativo: 'Windows 11 Pro',
          direccionIp: '192.168.1.50',
          direccionMac: '00:1A:2B:3C:4D:5E',
          nombreEnRed: 'PC-ADMIN-01',
          accesoRemoto: 'ANYDESK',
          accesoRemotoId: '123 456 789',
          ubicacion: 'Administración',
          proveedorId,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        tipoNombre: 'Notebook',
        marca: 'Dell',
        memoriaRamGb: 16,
        accesoRemoto: 'ANYDESK',
        estado: 'EN_DEPOSITO',
      });
      notebookId = res.body.id;
    });

    it('registra una cámara de seguridad sin especificaciones de PC', async () => {
      const res = await http
        .post('/api/equipos-it')
        .send({
          tipoId: tipos['Cámara de seguridad'],
          marca: 'Hikvision',
          modelo: 'DS-2CD1043G0',
          direccionIp: '192.168.1.90',
          ubicacion: 'Portón de ingreso',
        })
        .expect(201);
      expect(res.body.memoriaRamGb).toBeNull();
      expect(res.body.direccionIp).toBe('192.168.1.90');
    });

    it('registra un servidor y un celular', async () => {
      await http
        .post('/api/equipos-it')
        .send({
          tipoId: tipos['Servidor'],
          marca: 'HP',
          modelo: 'ProLiant DL380',
          procesador: 'Xeon Silver 4210',
          memoriaRamGb: 64,
          discoTipo: 'NVME',
          discoCapacidadGb: 2000,
          sistemaOperativo: 'Ubuntu Server 24.04',
          accesoRemoto: 'SSH',
        })
        .expect(201);

      await http
        .post('/api/equipos-it')
        .send({ tipoId: tipos['Celular'], marca: 'Samsung', modelo: 'Galaxy A54' })
        .expect(201);
    });

    it('REGRESIÓN: rechaza un código interno duplicado', async () => {
      await http
        .post('/api/equipos-it')
        .send({
          codigoInterno: 'IT-0042',
          tipoId: tipos['PC de escritorio'],
          marca: 'HP',
          modelo: 'EliteDesk',
        })
        .expect(400);
    });

    it('valida el formato de la IP', async () => {
      await http
        .post('/api/equipos-it')
        .send({
          tipoId: tipos['PC de escritorio'],
          marca: 'HP',
          modelo: 'X',
          direccionIp: '999.999.1.1',
        })
        .expect(400);
    });

    it('valida el formato de la MAC', async () => {
      await http
        .post('/api/equipos-it')
        .send({
          tipoId: tipos['PC de escritorio'],
          marca: 'HP',
          modelo: 'X',
          direccionMac: 'no-es-mac',
        })
        .expect(400);
    });

    it('busca por marca, IP o nombre de red', async () => {
      const porMarca = await http.get('/api/equipos-it?buscar=Dell').expect(200);
      expect(porMarca.body.datos.length).toBe(1);

      const porIp = await http.get('/api/equipos-it?buscar=192.168.1.90').expect(200);
      expect(porIp.body.datos[0].marca).toBe('Hikvision');

      const porRed = await http.get('/api/equipos-it?buscar=PC-ADMIN').expect(200);
      expect(porRed.body.datos[0].codigoInterno).toBe('IT-0042');
    });

    it('filtra por tipo del catálogo', async () => {
      const res = await http.get(`/api/equipos-it?tipoId=${tipos['Servidor']}`).expect(200);
      expect(res.body.datos.every((e: any) => e.tipoNombre === 'Servidor')).toBe(true);
      expect(res.body.datos.length).toBe(1);
    });

    it('el resumen cuenta por tipo y por estado', async () => {
      const res = await http.get('/api/equipos-it/resumen').expect(200);
      expect(res.body.total).toBeGreaterThanOrEqual(4);
      expect(res.body.porTipo.length).toBeGreaterThan(1);
    });

    it('ASIGNACIÓN: entregar el equipo lo deja EN_USO', async () => {
      const res = await http
        .patch(`/api/equipos-it/${notebookId}/asignar`)
        .send({ usuarioId, motivo: 'Ingreso de personal' })
        .expect(200);

      expect(res.body.estado).toBe('EN_USO');
      expect(res.body.asignadoANombre).toBe('Juan Pérez');
    });

    it('HISTORIAL: queda registrado el tramo vigente', async () => {
      const res = await http.get(`/api/equipos-it/${notebookId}/asignaciones`).expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        usuarioNombre: 'Juan Pérez',
        motivo: 'Ingreso de personal',
        vigente: true,
      });
    });

    it('REGRESIÓN: reasignar al mismo usuario se rechaza', async () => {
      await http.patch(`/api/equipos-it/${notebookId}/asignar`).send({ usuarioId }).expect(400);
    });

    it('REGRESIÓN: un equipo asignado no se puede eliminar', async () => {
      await http.delete(`/api/equipos-it/${notebookId}`).expect(400);
    });

    it('DEVOLUCIÓN: cierra el tramo anterior y abre uno nuevo', async () => {
      const res = await http
        .patch(`/api/equipos-it/${notebookId}/asignar`)
        .send({ usuarioId: null, motivo: 'Baja del empleado' })
        .expect(200);
      expect(res.body.estado).toBe('EN_DEPOSITO');
      expect(res.body.asignadoAId).toBeNull();

      const historial = await http.get(`/api/equipos-it/${notebookId}/asignaciones`).expect(200);
      expect(historial.body).toHaveLength(2);

      // Solo puede haber UN tramo vigente.
      const vigentes = historial.body.filter((a: any) => a.vigente);
      expect(vigentes).toHaveLength(1);
      expect(vigentes[0].usuarioNombre).toBeNull(); // depósito
    });

    it('REGRESIÓN: un equipo dado de baja no se puede asignar', async () => {
      const equipo = await http
        .post('/api/equipos-it')
        .send({
          tipoId: tipos['PC de escritorio'],
          marca: 'Viejo',
          modelo: 'Pentium',
          estado: 'DADO_DE_BAJA',
        })
        .expect(201);

      await http.patch(`/api/equipos-it/${equipo.body.id}/asignar`).send({ usuarioId }).expect(400);
    });

    it('IMPORTACION: la ruta existe y carga el inventario', async () => {
      // Este test existe porque la ruta puede compilar bien y aun asi no quedar
      // registrada (orden de decoradores, provider sin declarar en el modulo).
      // Un 404 aca es "Cannot POST /api/equipos-it/importar" en produccion.
      const res = await http
        .post('/api/equipos-it/importar')
        .send({
          filas: [
            {
              nombreEquipo: 'IMP-PC1',
              tipo: 'PC Escritorio',
              modelo: 'INTEL',
              estado: 'En uso',
              ubicacion: 'Contaduria',
              asignadoA: 'Luis Rodriguez',
              accesoRemotoId: '737 214 468',
            },
          ],
        })
        .expect(201);

      expect(res.body).toMatchObject({ creados: 1, conError: 0 });
      expect(res.body.usuariosCreados).toEqual(['Luis Rodriguez']);
    });

    it('IMPORTACION: el equipo importado queda consultable', async () => {
      const res = await http.get('/api/equipos-it?buscar=IMP-PC1').expect(200);
      expect(res.body.datos).toHaveLength(1);
      expect(res.body.datos[0]).toMatchObject({
        codigoInterno: 'IMP-PC1',
        tipoNombre: 'PC de escritorio',
        marca: 'Intel',
        accesoRemotoId: '737214468',
      });
    });

    it('IMPORTACION: reimportar actualiza y no duplica', async () => {
      await http
        .post('/api/equipos-it/importar')
        .send({
          filas: [
            { nombreEquipo: 'IMP-PC1', tipo: 'Notebook', modelo: 'HP', estado: 'Disponible' },
          ],
        })
        .expect(201)
        .expect((r) => expect(r.body).toMatchObject({ creados: 0, actualizados: 1 }));

      const res = await http.get('/api/equipos-it?buscar=IMP-PC1').expect(200);
      expect(res.body.datos).toHaveLength(1);
      expect(res.body.datos[0].tipoNombre).toBe('Notebook');
    });

    it('IMPORTACION: rechaza un cuerpo sin filas', async () => {
      await http.post('/api/equipos-it/importar').send({ filas: [] }).expect(400);
    });

    it('marca la garantía vencida', async () => {
      const res = await http
        .post('/api/equipos-it')
        .send({
          tipoId: tipos['PC de escritorio'],
          marca: 'Lenovo',
          modelo: 'ThinkCentre',
          garantiaHasta: '2020-01-01',
        })
        .expect(201);
      expect(res.body.garantiaVencida).toBe(true);
    });
  });
  describe('Unidades de medida', () => {
    it('lista el catálogo ordenado y con el uso de cada unidad', async () => {
      const res = await http.get('/api/unidades-medida').expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      const metro = res.body.find((u: any) => u.simbolo === 'm');
      // Lo usa el material que crea el beforeAll.
      expect(metro.materiales).toBeGreaterThanOrEqual(1);
    });

    it('el material expone el símbolo de la unidad y su id', async () => {
      const res = await http.get(`/api/materiales/${materialA}`).expect(200);
      expect(res.body.unidad).toBe('m');
      expect(res.body.unidadId).toBe(UNIDAD_METRO);
      expect(res.body.unidadNombre).toBe('Metro');
    });

    it('REGRESION: no deja crear una unidad que ya existe con otras mayusculas', async () => {
      // Es exactamente lo que el catálogo viene a impedir: con texto libre "Lt"
      // y "lt" convivían y cualquier reporte por unidad daba mal.
      await http.post('/api/unidades-medida').send({ nombre: 'METRO', simbolo: 'M' }).expect(400);
    });

    it('crea una unidad nueva y queda disponible para los materiales', async () => {
      const nueva = await http
        .post('/api/unidades-medida')
        .send({ nombre: 'Rollo', simbolo: 'rollo', orden: 170 })
        .expect(201);
      expect(nueva.body.materiales).toBe(0);

      const mat = await http
        .post('/api/materiales')
        .send({ nombre: 'Cinta aisladora', unidadId: nueva.body.id, categoriaId })
        .expect(201);
      expect(mat.body.unidad).toBe('rollo');
    });

    it('REGRESION: no borra una unidad en uso (dejaría materiales sin unidad)', async () => {
      await http.delete(`/api/unidades-medida/${UNIDAD_METRO}`).expect(400);
      // El material la conserva.
      const res = await http.get(`/api/materiales/${materialA}`).expect(200);
      expect(res.body.unidad).toBe('m');
    });

    it('una unidad sin uso sí se puede borrar', async () => {
      const nueva = await http
        .post('/api/unidades-medida')
        .send({ nombre: 'Tambor', simbolo: 'tambor' })
        .expect(201);
      await http.delete(`/api/unidades-medida/${nueva.body.id}`).expect(204);
    });

    it('rechaza un material con una unidad inexistente con 404 (no con error de FK)', async () => {
      await http
        .post('/api/materiales')
        .send({
          nombre: 'Fantasma',
          categoriaId,
          unidadId: 'b0000099-0000-4000-8000-000000000099',
        })
        .expect(404);
    });

    it('el alta de material exige la unidad', async () => {
      await http.post('/api/materiales').send({ nombre: 'Sin unidad', categoriaId }).expect(400);
    });
  });
});
