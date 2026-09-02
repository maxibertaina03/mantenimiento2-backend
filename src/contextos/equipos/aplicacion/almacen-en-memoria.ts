import { AlmacenImagenes, ImagenSubida } from '../puertos/almacen-imagenes';

/** Almacén en memoria, para probar los casos de uso sin subir nada a ningún lado. */
export class AlmacenImagenesEnMemoria implements AlmacenImagenes {
  readonly subidas: { ruta: string; bytes: number }[] = [];
  readonly borradas: string[] = [];

  constructor(private readonly configurado = true) {}

  estaConfigurado(): boolean {
    return this.configurado;
  }

  async subir(contenido: Buffer, nombreOriginal: string, carpeta: string): Promise<ImagenSubida> {
    const ruta = `${carpeta}/${this.subidas.length + 1}-${nombreOriginal}`;
    this.subidas.push({ ruta, bytes: contenido.length });
    return { url: `https://almacen.local/storage/v1/object/public/equipos/${ruta}`, ruta };
  }

  async borrar(ruta: string): Promise<void> {
    this.borradas.push(ruta);
  }
}
