import { Logger } from '@nestjs/common';

export interface ArchivoSubido {
  /** La ruta dentro del almacén. Es lo que se guarda en la base. */
  ruta: string;
  /** El tipo con el que se subió, para devolverlo al descargar. */
  contentType: string;
}

/** Extensión aceptada y el tipo MIME con el que se guarda. */
export type TiposAceptados = Record<string, string>;

/**
 * Guardar y traer archivos de Supabase Storage.
 *
 * Habla por HTTP y no con el SDK: es una sola llamada por operación, y evita
 * sumar una dependencia con su propia cadena de paquetes para algo que son
 * treinta líneas.
 *
 * Existe suelto, y no pegado a las fotos de equipos, porque ahora hay dos cosas
 * que guardar: las fotos y los comprobantes de las órdenes. Lo que cambia entre
 * las dos es el bucket, los tipos aceptados y si el enlace es público; lo que
 * no cambia es todo lo demás, y duplicarlo garantizaba que en algún momento se
 * arreglara un timeout en uno y no en el otro.
 */
export class AlmacenSupabase {
  private static readonly TIMEOUT_MS = 30_000;

  constructor(
    private readonly logger: Logger,
    private readonly url: string | undefined,
    private readonly clave: string | undefined,
    private readonly bucket: string,
    private readonly tipos: TiposAceptados,
    private readonly extensionPorDefecto: string,
    /** Si el bucket entrega los archivos a cualquiera que tenga la dirección. */
    private readonly publico = true,
  ) {}

  /** Se verifica una vez por arranque: preguntar en cada subida sería un viaje de más. */
  private bucketVerificado = false;

  /**
   * Deja la URL en la base del proyecto.
   *
   * El panel de Supabase muestra la URL con `/rest/v1/` al final —es la de la
   * API REST— y es la que cualquiera copia. Sin limpiarla, las rutas de Storage
   * quedarían pegadas después de ese tramo y fallarían con un 404 que no
   * explica nada.
   */
  static base(url: string | undefined): string | undefined {
    return url
      ?.trim()
      .replace(/\/+(rest|storage|auth)\/v\d+\/?$/i, '')
      .replace(/\/+$/, '');
  }

  estaConfigurado(): boolean {
    return Boolean(this.url && this.clave);
  }

  /** Si el archivo es de un tipo que este almacén acepta. */
  aceptaA(nombreArchivo: string): boolean {
    return (nombreArchivo.split('.').pop() ?? '').toLowerCase() in this.tipos;
  }

  get extensionesAceptadas(): string[] {
    return Object.keys(this.tipos);
  }

  /**
   * Arma un nombre de archivo seguro.
   *
   * Los nombres reales traen tildes, espacios y hasta comillas ("Esferica 1/4"
   * Bronce.jpg"). Sin limpiarlos, la URL sale rota o el objeto queda con un
   * nombre imposible de borrar después.
   */
  private nombreSeguro(nombreOriginal: string): { archivo: string; tipo: string } {
    const extension = (nombreOriginal.split('.').pop() ?? '').toLowerCase();
    const ext = extension in this.tipos ? extension : this.extensionPorDefecto;

    const base = nombreOriginal
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .toLowerCase();

    // El timestamp evita que subir dos veces el mismo archivo pise el anterior
    // antes de que la ficha apunte al nuevo.
    return { archivo: `${Date.now()}-${base || 'archivo'}.${ext}`, tipo: this.tipos[ext] };
  }

  /**
   * Crea el bucket si no existe, una sola vez por arranque.
   *
   * Sin esto, la primera subida falla con un 404 de Supabase que no dice qué
   * hacer, y arreglarlo pide entrar al panel a crear un bucket con el nombre
   * exacto y la privacidad correcta. Es un paso manual que se puede olvidar y
   * que solo hace falta una vez en la vida del sistema.
   *
   * Se crea PRIVADO cuando corresponde: un bucket público entrega cualquier
   * archivo a quien tenga la dirección, para siempre.
   */
  private async asegurarBucket(): Promise<void> {
    if (this.bucketVerificado) return;

    const respuesta = await fetch(`${this.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.clave}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: this.bucket, name: this.bucket, public: this.publico }),
      signal: AbortSignal.timeout(AlmacenSupabase.TIMEOUT_MS),
    });

    // Que ya exista es el caso normal a partir de la segunda vez.
    if (respuesta.ok || respuesta.status === 409) {
      if (respuesta.ok) this.logger.log(`Bucket "${this.bucket}" creado.`);
      this.bucketVerificado = true;
      return;
    }

    const detalle = await respuesta.text();
    if (detalle.includes('already exists') || detalle.includes('Duplicate')) {
      this.bucketVerificado = true;
      return;
    }
    throw new Error(`No se pudo preparar el bucket "${this.bucket}": ${detalle}`);
  }

  async subir(contenido: Buffer, nombreOriginal: string, carpeta: string): Promise<ArchivoSubido> {
    if (!this.estaConfigurado()) throw new Error('Almacén no configurado');
    await this.asegurarBucket();

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
      signal: AbortSignal.timeout(AlmacenSupabase.TIMEOUT_MS),
    });

    if (!respuesta.ok) {
      // El cuerpo dice exactamente qué está mal: bucket inexistente, clave
      // equivocada, archivo repetido. Es lo que hace falta para arreglarlo.
      throw new Error(`Supabase respondió ${respuesta.status}: ${await respuesta.text()}`);
    }

    return { ruta, contentType: tipo };
  }

  /** El enlace público. Solo sirve en buckets públicos. */
  urlPublica(ruta: string): string {
    return `${this.url}/storage/v1/object/public/${this.bucket}/${ruta}`;
  }

  /**
   * Un enlace que vence, para lo que no puede quedar público.
   *
   * Un remito o una factura llevan el proveedor, los precios y las cantidades:
   * no es información que deba quedar en una dirección que sirve para siempre y
   * que cualquiera puede reenviar. Con el enlace firmado, quien lo recibe lo
   * puede abrir durante unos minutos y después deja de servir.
   */
  async urlFirmada(ruta: string, segundos = 300): Promise<string> {
    if (!this.estaConfigurado()) throw new Error('Almacén no configurado');

    const respuesta = await fetch(`${this.url}/storage/v1/object/sign/${this.bucket}/${ruta}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.clave}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: segundos }),
      signal: AbortSignal.timeout(AlmacenSupabase.TIMEOUT_MS),
    });

    if (!respuesta.ok) {
      throw new Error(`Supabase respondió ${respuesta.status}: ${await respuesta.text()}`);
    }

    const { signedURL } = (await respuesta.json()) as { signedURL: string };
    return `${this.url}/storage/v1${signedURL}`;
  }

  async borrar(ruta: string): Promise<void> {
    if (!this.estaConfigurado()) return;

    const respuesta = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${ruta}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${this.clave}` },
      signal: AbortSignal.timeout(AlmacenSupabase.TIMEOUT_MS),
    });

    // Que ya no esté no es un error: borrar algo borrado es el mismo resultado.
    if (!respuesta.ok && respuesta.status !== 404) {
      this.logger.warn(`No se pudo borrar ${ruta}: ${respuesta.status}`);
    }
  }
}
