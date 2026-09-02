import { RepositorioUbicaciones, Ubicacion } from '../puertos/repositorio-ubicaciones';

/** La implementación en memoria del puerto, para probar sin base de datos. */
export class RepositorioUbicacionesEnMemoria implements RepositorioUbicaciones {
  readonly filas: Ubicacion[] = [];
  private secuencia = 0;

  constructor(iniciales: string[] = []) {
    for (const nombre of iniciales) this.filas.push({ id: `ub-${++this.secuencia}`, nombre });
  }

  async buscarPorNombre(nombre: string): Promise<Ubicacion | null> {
    return this.filas.find((f) => f.nombre.toLowerCase() === nombre.trim().toLowerCase()) ?? null;
  }

  async crear(nombre: string): Promise<Ubicacion> {
    const fila = { id: `ub-${++this.secuencia}`, nombre: nombre.trim() };
    this.filas.push(fila);
    return fila;
  }
}
