import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlmacenSupabase } from '../../../common/almacen/almacen-supabase';
import { AlmacenImagenes, ImagenSubida } from '../puertos/almacen-imagenes';

/** Tipos que aceptamos, con su extensión canónica. */
const TIPOS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Almacén de fotos de equipos sobre Supabase Storage.
 *
 * El trabajo de hablar con Supabase vive en `AlmacenSupabase`, compartido con
 * los comprobantes de las órdenes. Acá queda lo propio de las fotos: qué tipos
 * se aceptan, en qué bucket van, y que el enlace es público.
 *
 * Público está bien para una foto de una bomba. No lo estaría para un remito,
 * que lleva proveedor y precios; por eso ese otro almacén firma sus enlaces.
 *
 * Como el correo, si falta configuración no rompe nada al arrancar: queda
 * apagado y la pantalla oculta la carga de fotos.
 */
@Injectable()
export class SupabaseAlmacenImagenes implements AlmacenImagenes {
  private readonly logger = new Logger(SupabaseAlmacenImagenes.name);
  private readonly almacen: AlmacenSupabase;

  constructor(config: ConfigService) {
    const bucket = config.get<string>('SUPABASE_BUCKET') ?? 'equipos';
    this.almacen = new AlmacenSupabase(
      this.logger,
      AlmacenSupabase.base(config.get<string>('SUPABASE_URL')),
      config.get<string>('SUPABASE_SERVICE_KEY'),
      bucket,
      TIPOS,
      'jpg',
    );

    if (!this.estaConfigurado()) {
      this.logger.warn(
        'Almacén de imágenes no configurado (faltan SUPABASE_URL o SUPABASE_SERVICE_KEY). ' +
          'La carga de fotos queda deshabilitada; el resto del módulo funciona igual.',
      );
    } else {
      this.logger.log(`Fotos de equipos en Supabase Storage, bucket "${bucket}"`);
    }
  }

  estaConfigurado(): boolean {
    return this.almacen.estaConfigurado();
  }

  async subir(contenido: Buffer, nombreOriginal: string, carpeta: string): Promise<ImagenSubida> {
    const { ruta } = await this.almacen.subir(contenido, nombreOriginal, carpeta);
    return { url: this.almacen.urlPublica(ruta), ruta };
  }

  borrar(ruta: string): Promise<void> {
    return this.almacen.borrar(ruta);
  }
}
