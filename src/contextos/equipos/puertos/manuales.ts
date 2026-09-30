/**
 * Los puertos de los manuales: dónde se anotan y dónde se guarda el archivo.
 */

export interface Manual {
  id: string;
  equipoId: string;
  nombre: string;
  ruta: string;
  tamanoBytes: number;
  subidoEn: Date;
  subidoPorNombre: string | null;
}

export interface RepositorioManuales {
  listar(equipoId: string): Promise<Manual[]>;
  buscar(equipoId: string, manualId: string): Promise<Manual | null>;
  contar(equipoId: string): Promise<number>;
  crear(datos: {
    equipoId: string;
    nombre: string;
    ruta: string;
    tamanoBytes: number;
    subidoPorId: string | null;
  }): Promise<Manual>;
  eliminar(manualId: string): Promise<void>;
}

export const REPOSITORIO_MANUALES = Symbol('RepositorioManuales');

/**
 * El almacén de los PDF. Es privado: el archivo se entrega con un enlace que
 * vence, igual que los comprobantes de compras.
 */
export interface AlmacenManuales {
  estaConfigurado(): boolean;
  subir(contenido: Buffer, nombreArchivo: string, carpeta: string): Promise<{ ruta: string }>;
  enlace(ruta: string, segundos: number): Promise<string>;
  borrar(ruta: string): Promise<void>;
}

export const ALMACEN_MANUALES = Symbol('AlmacenManuales');
