import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ComprobantesService } from './comprobantes.service';

/**
 * Los remitos y facturas adjuntos a una orden.
 *
 * Lo que se protege: que no entre cualquier archivo, que una entrega con veinte
 * fotos no llene el almacen, y que el enlace al archivo venza. Un remito lleva
 * proveedor, cantidades y precios.
 */
const ORDEN = { id: 'ord-1', numero: 'OC-2026-0001' };

function armar(opciones: { configurado?: boolean; comprobantes?: any[] } = {}) {
  const configurado = opciones.configurado ?? true;
  const comprobantes = opciones.comprobantes ?? [];

  const comprobanteOrden = {
    findMany: jest.fn<Promise<any>, any[]>(async () => comprobantes),
    findFirst: jest.fn<Promise<any>, any[]>(
      async ({ where }: any) => comprobantes.find((c) => c.id === where.id) ?? null,
    ),
    count: jest.fn<Promise<any>, any[]>(async () => comprobantes.length),
    create: jest.fn<Promise<any>, any[]>(async ({ data }: any) => ({
      id: 'comp-nuevo',
      subidoEn: new Date(),
      ...data,
    })),
    delete: jest.fn<Promise<any>, any[]>(async () => undefined),
  };

  const prisma = {
    ordenCompra: { findUnique: jest.fn<Promise<any>, any[]>(async () => ORDEN) },
    comprobanteOrden,
  } as unknown as PrismaService;

  const config = {
    get: jest.fn((clave: string) => {
      if (!configurado) return undefined;
      if (clave === 'SUPABASE_URL') return 'https://proyecto.supabase.co';
      if (clave === 'SUPABASE_SERVICE_KEY') return 'clave-de-servicio';
      return undefined;
    }),
  } as unknown as ConfigService;

  const service = new ComprobantesService(prisma, config);

  // El almacen se reemplaza por un doble: lo que se prueba acá son las reglas,
  // no que Supabase conteste.
  const almacen = {
    subidos: [] as { nombre: string; carpeta: string }[],
    borrados: [] as string[],
    estaConfigurado: () => configurado,
    aceptaA: (n: string) =>
      ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(n.split('.').pop() ?? ''),
    extensionesAceptadas: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
    subir: jest.fn(async (_c: Buffer, nombre: string, carpeta: string) => {
      almacen.subidos.push({ nombre, carpeta });
      return { ruta: `${carpeta}/123-${nombre}`, contentType: 'application/pdf' };
    }),
    urlFirmada: jest.fn(async (ruta: string) => `https://firmada/${ruta}?token=abc`),
    borrar: jest.fn(async (ruta: string) => {
      almacen.borrados.push(ruta);
    }),
  };
  (service as unknown as { almacen: unknown }).almacen = almacen;

  return { service, prisma, comprobanteOrden, almacen };
}

/** Un base64 de N bytes. */
const base64De = (bytes: number) => Buffer.alloc(bytes, 7).toString('base64');

describe('ComprobantesService', () => {
  describe('adjuntar', () => {
    it('sube el archivo y lo guarda en la orden', async () => {
      const { service, almacen, comprobanteOrden } = armar();
      await service.adjuntar(
        'ord-1',
        { archivoBase64: base64De(1000), nombreArchivo: 'remito.pdf' },
        { id: 'u1' } as never,
      );

      expect(almacen.subidos[0].carpeta).toBe('ord-1');
      expect(comprobanteOrden.create.mock.calls[0][0].data).toMatchObject({
        ordenId: 'ord-1',
        nombre: 'remito.pdf',
        tipo: 'REMITO',
        subidoPorId: 'u1',
      });
    });

    it('guarda cuanto pesa, para poder mostrarlo', async () => {
      const { service, comprobanteOrden } = armar();
      await service.adjuntar('ord-1', {
        archivoBase64: base64De(2048),
        nombreArchivo: 'factura.pdf',
      });
      expect(comprobanteOrden.create.mock.calls[0][0].data.tamanoBytes).toBe(2048);
    });

    it('REGRESION: rechaza un tipo de archivo que no se puede ver', async () => {
      // Un .docx o un .heic se subirian sin problema y despues nadie los abre.
      const { service } = armar();
      await expect(
        service.adjuntar('ord-1', { archivoBase64: base64De(100), nombreArchivo: 'remito.docx' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('el error dice que tipos si se aceptan', async () => {
      const { service } = armar();
      await expect(
        service.adjuntar('ord-1', { archivoBase64: base64De(100), nombreArchivo: 'x.docx' }),
      ).rejects.toThrow(/pdf/);
    });

    it('REGRESION: rechaza un archivo demasiado grande, diciendo cuanto pesa', async () => {
      const { service } = armar();
      await expect(
        service.adjuntar('ord-1', {
          archivoBase64: base64De(11 * 1024 * 1024),
          nombreArchivo: 'foto.jpg',
        }),
      ).rejects.toThrow(/11\.0 MB/);
    });

    it('rechaza un archivo vacio', async () => {
      const { service } = armar();
      await expect(
        service.adjuntar('ord-1', { archivoBase64: '', nombreArchivo: 'remito.pdf' }),
      ).rejects.toThrow(/vacío/);
    });

    it('REGRESION: hay un tope por orden', async () => {
      // Una entrega fotografiada hoja por hoja llenaria el almacen, que en el
      // plan gratuito es 1 GB compartido con las fotos de los equipos.
      const diez = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` }));
      const { service } = armar({ comprobantes: diez });
      await expect(
        service.adjuntar('ord-1', { archivoBase64: base64De(100), nombreArchivo: 'r.pdf' }),
      ).rejects.toThrow(/máximo/);
    });

    it('REGRESION: si no se puede guardar la fila, borra el archivo subido', async () => {
      // Sin esto queda un archivo ocupando lugar que nadie va a encontrar nunca.
      const { service, comprobanteOrden, almacen } = armar();
      comprobanteOrden.create.mockRejectedValue(new Error('la base fallo'));

      await expect(
        service.adjuntar('ord-1', { archivoBase64: base64De(100), nombreArchivo: 'r.pdf' }),
      ).rejects.toThrow('la base fallo');
      expect(almacen.borrados).toHaveLength(1);
    });

    it('404 si la orden no existe', async () => {
      const { service, prisma } = armar();
      (prisma.ordenCompra.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.adjuntar('nope', { archivoBase64: base64De(100), nombreArchivo: 'r.pdf' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('sin almacen configurado', () => {
    it('avisa que no se puede adjuntar, y que el numero se carga igual', async () => {
      // El resto del sistema tiene que seguir andando: el numero de remito es
      // lo obligatorio, el archivo es un extra.
      const { service } = armar({ configurado: false });
      await expect(
        service.adjuntar('ord-1', { archivoBase64: base64De(100), nombreArchivo: 'r.pdf' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(
        service.adjuntar('ord-1', { archivoBase64: base64De(100), nombreArchivo: 'r.pdf' }),
      ).rejects.toThrow(/se sigue cargando igual|se carga igual/);
    });

    it('lo informa para que la pantalla oculte el boton', () => {
      expect(armar({ configurado: false }).service.estaDisponible()).toBe(false);
      expect(armar().service.estaDisponible()).toBe(true);
    });
  });

  describe('ver el archivo', () => {
    it('REGRESION: el enlace vence', async () => {
      // Un remito lleva proveedor, cantidades y precios: no puede quedar en una
      // direccion que sirve para siempre y que cualquiera puede reenviar.
      const { service } = armar({
        comprobantes: [{ id: 'comp-1', ordenId: 'ord-1', ruta: 'ord-1/123-r.pdf' }],
      });
      const { url, vence } = await service.enlace('ord-1', 'comp-1');

      expect(url).toContain('token=');
      expect(vence.getTime()).toBeGreaterThan(Date.now());
      expect(vence.getTime()).toBeLessThan(Date.now() + 10 * 60 * 1000);
    });

    it('404 si el comprobante no es de esa orden', async () => {
      const { service } = armar({ comprobantes: [] });
      await expect(service.enlace('ord-1', 'comp-ajeno')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listar', () => {
    it('dice si cada uno es imagen, para mostrar la miniatura', async () => {
      const { service } = armar({
        comprobantes: [
          {
            id: 'c1',
            tipo: 'REMITO',
            nombre: 'r.jpg',
            contentType: 'image/jpeg',
            tamanoBytes: 10,
            subidoEn: new Date(),
            subidoPor: null,
          },
          {
            id: 'c2',
            tipo: 'FACTURA',
            nombre: 'f.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 20,
            subidoEn: new Date(),
            subidoPor: null,
          },
        ],
      });
      const lista = await service.listar('ord-1');
      expect(lista[0].esImagen).toBe(true);
      expect(lista[1].esImagen).toBe(false);
    });

    it('REGRESION: el listado no incluye la ruta del archivo', async () => {
      // La ruta es lo unico que hace falta para armarse un enlace por fuera del
      // sistema, salteando el vencimiento.
      const { service } = armar({
        comprobantes: [
          {
            id: 'c1',
            tipo: 'REMITO',
            nombre: 'r.jpg',
            ruta: 'ord-1/secreto.jpg',
            contentType: 'image/jpeg',
            tamanoBytes: 10,
            subidoEn: new Date(),
            subidoPor: null,
          },
        ],
      });
      const lista = await service.listar('ord-1');
      expect(JSON.stringify(lista)).not.toContain('secreto.jpg');
    });
  });

  describe('borrar', () => {
    it('saca la fila y el archivo', async () => {
      const { service, comprobanteOrden, almacen } = armar({
        comprobantes: [{ id: 'c1', ordenId: 'ord-1', ruta: 'ord-1/r.pdf' }],
      });
      await service.borrar('ord-1', 'c1');

      expect(comprobanteOrden.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(almacen.borrados).toEqual(['ord-1/r.pdf']);
    });

    it('404 si no existe', async () => {
      const { service } = armar({ comprobantes: [] });
      await expect(service.borrar('ord-1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
