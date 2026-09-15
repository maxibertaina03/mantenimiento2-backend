import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TipoComprobante } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import { AlmacenSupabase } from '../../../common/almacen/almacen-supabase';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Lo que se acepta como comprobante.
 *
 * Una foto del celular y un PDF del proveedor cubren todos los casos reales.
 * El HEIC de los iPhone no entra: el navegador lo convierte a JPEG antes de
 * subirlo, y aceptarlo acá guardaría archivos que después no se ven en Windows.
 */
const TIPOS: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Tope por archivo. Una foto de celular ronda los 3 MB; un PDF escaneado, menos. */
const MAXIMO_BYTES = 10 * 1024 * 1024;

/** Cuántos comprobantes puede tener una orden. */
const MAXIMO_POR_ORDEN = 10;

/**
 * Los remitos y facturas adjuntos a una orden de compra.
 *
 * El número del comprobante ya se guardaba; esto guarda el papel. Sirve para lo
 * que el usuario pidió: comparar contra el físico sin tenerlo a mano, y para
 * que el papel no se pierda cuando el original se archiva o se moja.
 */
@Injectable()
export class ComprobantesService {
  private readonly logger = new Logger(ComprobantesService.name);
  private readonly almacen: AlmacenSupabase;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const bucket = config.get<string>('SUPABASE_BUCKET_COMPROBANTES') ?? 'comprobantes';
    this.almacen = new AlmacenSupabase(
      this.logger,
      AlmacenSupabase.base(config.get<string>('SUPABASE_URL')),
      config.get<string>('SUPABASE_SERVICE_KEY'),
      bucket,
      TIPOS,
      'pdf',
      // Privado: un remito lleva proveedor, cantidades y precios. Se entrega
      // con enlaces firmados que vencen, no con una direccion para siempre.
      false,
    );

    if (!this.almacen.estaConfigurado()) {
      this.logger.warn(
        'Comprobantes de órdenes deshabilitados: faltan SUPABASE_URL o SUPABASE_SERVICE_KEY. ' +
          'El número de remito y de factura se sigue cargando igual.',
      );
    } else {
      this.logger.log(`Comprobantes de órdenes en Supabase Storage, bucket "${bucket}"`);
    }
  }

  estaDisponible(): boolean {
    return this.almacen.estaConfigurado();
  }

  private exigirAlmacen(): void {
    if (!this.estaDisponible()) {
      throw new ServiceUnavailableException(
        'Este servidor no tiene configurado dónde guardar los archivos, así que no se pueden ' +
          'adjuntar comprobantes. El número de remito y de factura se carga igual.',
      );
    }
  }

  async listar(ordenId: string) {
    const orden = await this.prisma.ordenCompra.findUnique({ where: { id: ordenId } });
    if (!orden) throw new NotFoundException(`No existe la orden con id ${ordenId}`);

    const filas = await this.prisma.comprobanteOrden.findMany({
      where: { ordenId },
      orderBy: { subidoEn: 'asc' },
      include: { subidoPor: { select: { nombre: true } } },
    });

    return filas.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      nombre: f.nombre,
      contentType: f.contentType,
      tamanoBytes: f.tamanoBytes,
      esImagen: f.contentType.startsWith('image/'),
      subidoEn: f.subidoEn,
      subidoPor: f.subidoPor?.nombre ?? null,
    }));
  }

  /**
   * Un enlace para abrir el archivo, que vence a los cinco minutos.
   *
   * No se guarda en la base ni se devuelve en el listado: se pide cuando
   * alguien va a mirar el archivo. Un remito lleva el proveedor, las cantidades
   * y los precios, así que no puede quedar en una dirección que sirve para
   * siempre y que cualquiera puede reenviar.
   */
  async enlace(ordenId: string, comprobanteId: string): Promise<{ url: string; vence: Date }> {
    this.exigirAlmacen();
    const fila = await this.prisma.comprobanteOrden.findFirst({
      where: { id: comprobanteId, ordenId },
    });
    if (!fila) throw new NotFoundException('No existe ese comprobante en esta orden.');

    const SEGUNDOS = 300;
    return {
      url: await this.almacen.urlFirmada(fila.ruta, SEGUNDOS),
      vence: new Date(Date.now() + SEGUNDOS * 1000),
    };
  }

  async adjuntar(
    ordenId: string,
    datos: { archivoBase64: string; nombreArchivo: string; tipo?: TipoComprobante },
    quien?: Usuario,
  ) {
    this.exigirAlmacen();

    const orden = await this.prisma.ordenCompra.findUnique({ where: { id: ordenId } });
    if (!orden) throw new NotFoundException(`No existe la orden con id ${ordenId}`);

    if (!this.almacen.aceptaA(datos.nombreArchivo)) {
      throw new BadRequestException(
        `Ese tipo de archivo no se puede adjuntar. Se aceptan: ${this.almacen.extensionesAceptadas.join(', ')}.`,
      );
    }

    const contenido = Buffer.from(datos.archivoBase64, 'base64');
    if (contenido.length === 0) {
      throw new BadRequestException('El archivo llegó vacío. Probá de nuevo.');
    }
    if (contenido.length > MAXIMO_BYTES) {
      const mb = (contenido.length / 1024 / 1024).toFixed(1);
      throw new BadRequestException(
        `El archivo pesa ${mb} MB y el tope es ${MAXIMO_BYTES / 1024 / 1024} MB. ` +
          'Si es una foto, sacala con menos calidad o recortala.',
      );
    }

    // El tope por orden evita que una entrega con veinte fotos llene el
    // almacén, que en el plan gratuito es 1 GB compartido con las fotos de los
    // equipos.
    const cuantos = await this.prisma.comprobanteOrden.count({ where: { ordenId } });
    if (cuantos >= MAXIMO_POR_ORDEN) {
      throw new BadRequestException(
        `Esta orden ya tiene ${MAXIMO_POR_ORDEN} comprobantes, que es el máximo. ` +
          'Borrá alguno si necesitás subir otro.',
      );
    }

    const subido = await this.almacen.subir(contenido, datos.nombreArchivo, ordenId);

    try {
      const fila = await this.prisma.comprobanteOrden.create({
        data: {
          ordenId,
          tipo: datos.tipo ?? TipoComprobante.REMITO,
          nombre: datos.nombreArchivo.slice(0, 200),
          ruta: subido.ruta,
          contentType: subido.contentType,
          tamanoBytes: contenido.length,
          subidoPorId: quien?.id ?? null,
        },
      });
      return { id: fila.id, nombre: fila.nombre, tipo: fila.tipo, subidoEn: fila.subidoEn };
    } catch (e) {
      // Si la fila no se pudo guardar, el archivo ya subido no sirve para nada
      // y ocupa lugar. Se borra para no dejar basura que nadie va a encontrar.
      await this.almacen.borrar(subido.ruta);
      throw e;
    }
  }

  async borrar(ordenId: string, comprobanteId: string): Promise<void> {
    const fila = await this.prisma.comprobanteOrden.findFirst({
      where: { id: comprobanteId, ordenId },
    });
    if (!fila) throw new NotFoundException('No existe ese comprobante en esta orden.');

    // Primero la fila y después el archivo: si fallara el borrado del archivo,
    // queda un archivo huérfano, que es un problema menor comparado con una
    // fila que apunta a algo que ya no está.
    await this.prisma.comprobanteOrden.delete({ where: { id: comprobanteId } });
    await this.almacen.borrar(fila.ruta);
  }
}
