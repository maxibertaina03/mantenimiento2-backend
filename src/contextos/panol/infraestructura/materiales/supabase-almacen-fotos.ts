import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlmacenSupabase } from '../../../../common/almacen/almacen-supabase';
import { AlmacenFotosMateriales } from '../../puertos/almacen-fotos';

const TIPOS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Las fotos de los materiales, en el mismo bucket público que las de los
 * equipos, dentro de la carpeta `materiales/`.
 *
 * Público está bien para la foto de un repuesto, igual que para la de una
 * bomba: no lleva nada que no se vea en el estante.
 */
@Injectable()
export class SupabaseAlmacenFotosMateriales implements AlmacenFotosMateriales {
  private readonly almacen: AlmacenSupabase;

  constructor(config: ConfigService) {
    this.almacen = new AlmacenSupabase(
      new Logger(SupabaseAlmacenFotosMateriales.name),
      AlmacenSupabase.base(config.get<string>('SUPABASE_URL')),
      config.get<string>('SUPABASE_SERVICE_KEY'),
      config.get<string>('SUPABASE_BUCKET') ?? 'equipos',
      TIPOS,
      'jpg',
    );
  }

  estaConfigurado(): boolean {
    return this.almacen.estaConfigurado();
  }

  async subir(contenido: Buffer, nombreOriginal: string, materialId: string): Promise<string> {
    const { ruta } = await this.almacen.subir(
      contenido,
      nombreOriginal,
      `materiales/${materialId}`,
    );
    return this.almacen.urlPublica(ruta);
  }

  borrar(ruta: string): Promise<void> {
    return this.almacen.borrar(ruta);
  }
}
