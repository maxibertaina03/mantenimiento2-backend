import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlmacenSupabase } from '../../../common/almacen/almacen-supabase';
import { AlmacenManuales } from '../puertos/manuales';

/**
 * Los manuales en Supabase Storage, en un bucket PRIVADO propio.
 *
 * Aparte del de las fotos, que es público: las fotos se muestran en la ficha
 * con una dirección fija, y un manual se abre con un enlace que vence. El
 * bucket se crea solo la primera vez que se sube algo.
 */
@Injectable()
export class SupabaseAlmacenManuales implements AlmacenManuales {
  private readonly logger = new Logger(SupabaseAlmacenManuales.name);
  private readonly almacen: AlmacenSupabase;

  constructor(config: ConfigService) {
    const bucket = config.get<string>('SUPABASE_BUCKET_MANUALES') ?? 'manuales';
    this.almacen = new AlmacenSupabase(
      this.logger,
      AlmacenSupabase.base(config.get<string>('SUPABASE_URL')),
      config.get<string>('SUPABASE_SERVICE_KEY'),
      bucket,
      { pdf: 'application/pdf' },
      'pdf',
      false,
    );
  }

  estaConfigurado(): boolean {
    return this.almacen.estaConfigurado();
  }

  async subir(
    contenido: Buffer,
    nombreArchivo: string,
    carpeta: string,
  ): Promise<{ ruta: string }> {
    const { ruta } = await this.almacen.subir(contenido, nombreArchivo, carpeta);
    return { ruta };
  }

  enlace(ruta: string, segundos: number): Promise<string> {
    return this.almacen.urlFirmada(ruta, segundos);
  }

  borrar(ruta: string): Promise<void> {
    return this.almacen.borrar(ruta);
  }
}
