import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlmacenImagenes, ImagenSubida } from '../puertos/almacen-imagenes';

/** Tipos que aceptamos, con su extensión canónica. */
const TIPOS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Almacén de imágenes sobre Supabase Storage.
 *
 * Habla por HTTP y no con el SDK: es una sola llamada por operación, y evita
 * sumar una dependencia con su propia cadena de paquetes para algo que son
 * treinta líneas.
 *
 * Como el correo, si falta configuración no rompe nada al arrancar: queda
 * apagado y la pantalla oculta la carga de fotos.
 */
@Injectable()
export class SupabaseAlmacenImagenes implements AlmacenImagenes {
  private readonly logger = new Logger(SupabaseAlmacenImagenes.name);
  private readonly url: string | undefined;
  private readonly clave: string | undefined;
  private readonly bucket: string;

  /** Si Supabase no contesta en este tiempo, se corta con un error claro. */
  private static readonly TIMEOUT_MS = 30_000;

  /**
   * Deja la URL en la base del proyecto.
   *
   * El panel de Supabase muestra la URL con `/rest/v1/` al final —es la de la
   * API REST— y es la que cualquiera copia. Sin limpiarla, las rutas de Storage
   * quedarían pegadas después de ese tramo y fallarían con un 404 que no
   * explica nada.
   */
  private static base(url: string | undefined): string | undefined {
    return url
      ?.trim()
      .replace(/\/+(rest|storage|auth)\/v\d+\/?$/i, '')
      .replace(/\/+$/, '');
  }

  constructor(config: ConfigService) {
    this.url = SupabaseAlmacenImagenes.base(config.get<string>('SUPABASE_URL'));
    this.clave = config.get<string>('SUPABASE_SERVICE_KEY');
    this.bucket = config.get<string>('SUPABASE_BUCKET') ?? 'equipos';

    if (!this.estaConfigurado()) {
      this.logger.warn(
        'Almacén de imágenes no configurado (faltan SUPABASE_URL o SUPABASE_SERVICE_KEY). ' +
          'La carga de fotos queda deshabilitada; el resto del módulo funciona igual.',
      );
    } else {
      this.logger.log(`Fotos de equipos en Supabase Storage, bucket "${this.bucket}"`);
    }
  }

  estaConfigurado(): boolean {
    return Boolean(this.url && this.clave);
  }

  /**
   * Arma un nombre de archivo seguro.
   *
   * Los nombres reales traen tildes, espacios y hasta comillas ("Esferica 1/4"
   * Bronce.jpg"). Sin limpiarlos, la URL sale rota o el objeto queda con un
   * nombre imposible de borrar después.
   */
  private nombreSeguro(nombreOriginal: string): { archivo: string; tipo: string } {
    const extension = (nombreOriginal.split('.').pop() ?? 'jpg').toLowerCase();
    const ext = extension in TIPOS ? extension : 'jpg';

    const base = nombreOriginal
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // saca las tildes
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .toLowerCase();

    // El timestamp evita que subir dos veces la misma foto pise la anterior
    // antes de que la ficha apunte a la nueva.
    return { archivo: `${Date.now()}-${base || 'foto'}.${ext}`, tipo: TIPOS[ext] };
  }

  async subir(contenido: Buffer, nombreOriginal: string, carpeta: string): Promise<ImagenSubida> {
    if (!this.estaConfigurado()) throw new Error('Almacén de imágenes no configurado');

    const { archivo, tipo } = this.nombreSeguro(nombreOriginal);
    const ruta = `${carpeta}/${archivo}`;

    const respuesta = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${ruta}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.clave}`,
        'content-type': tipo,
        'cache-control': '31536000',
      },
      body: new Uint8Array(contenido),
      signal: AbortSignal.timeout(SupabaseAlmacenImagenes.TIMEOUT_MS),
    });

    if (!respuesta.ok) {
      // El cuerpo dice exactamente qué está mal: bucket inexistente, clave
      // equivocada, archivo repetido. Es lo que hace falta para arreglarlo.
      throw new Error(`Supabase respondió ${respuesta.status}: ${await respuesta.text()}`);
    }

    return { url: `${this.url}/storage/v1/object/public/${this.bucket}/${ruta}`, ruta };
  }

  async borrar(ruta: string): Promise<void> {
    if (!this.estaConfigurado()) return;

    const respuesta = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${ruta}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${this.clave}` },
      signal: AbortSignal.timeout(SupabaseAlmacenImagenes.TIMEOUT_MS),
    });

    // Que ya no esté no es un error: borrar algo borrado es el mismo resultado.
    if (!respuesta.ok && respuesta.status !== 404) {
      this.logger.warn(`No se pudo borrar la imagen ${ruta}: ${respuesta.status}`);
    }
  }
}
