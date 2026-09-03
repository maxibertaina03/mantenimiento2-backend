import { PlanMantenimiento } from '../dominio/plan-mantenimiento';
import { PlanConEquipo, RepositorioPlanes } from '../puertos/repositorio-planes';

/** Implementación en memoria del puerto, para probar sin base de datos. */
export class RepositorioPlanesEnMemoria implements RepositorioPlanes {
  readonly filas: PlanMantenimiento[] = [];
  private secuencia = 0;
  /** Nombres de equipo, para poder devolver PlanConEquipo sin otra tabla. */
  readonly equipos = new Map<string, { nombre: string; estado: string }>();

  async crear(plan: Omit<PlanMantenimiento, 'id'>): Promise<PlanMantenimiento> {
    const fila = { ...plan, id: `pl-${++this.secuencia}` };
    this.filas.push(fila);
    return fila;
  }

  async actualizar(
    id: string,
    cambios: Partial<Omit<PlanMantenimiento, 'id'>>,
  ): Promise<PlanMantenimiento> {
    const fila = this.filas.find((f) => f.id === id);
    if (!fila) throw new Error(`No existe ${id}`);
    Object.assign(fila, cambios);
    return fila;
  }

  async buscarPorId(id: string): Promise<PlanMantenimiento | null> {
    return this.filas.find((f) => f.id === id) ?? null;
  }

  async listarPorEquipo(equipoId: string): Promise<PlanMantenimiento[]> {
    return this.filas.filter((f) => f.equipoId === equipoId);
  }

  async listarQueVencenHasta(fechaCorte: Date): Promise<PlanConEquipo[]> {
    return this.filas
      .filter((f) => f.activo && f.proximaFecha.getTime() <= fechaCorte.getTime())
      .filter((f) => {
        const eq = this.equipos.get(f.equipoId);
        // Sin equipo cargado se asume operativo: los tests que no lo declaran
        // están probando otra cosa.
        return !eq || eq.estado === 'OPERATIVO' || eq.estado === 'EN_REPARACION';
      })
      .map((f) => ({
        ...f,
        equipoNombre: this.equipos.get(f.equipoId)?.nombre ?? 'Equipo',
        equipoEstado: this.equipos.get(f.equipoId)?.estado ?? 'OPERATIVO',
        ubicacionNombre: null,
      }));
  }

  async eliminar(id: string): Promise<void> {
    const i = this.filas.findIndex((f) => f.id === id);
    if (i >= 0) this.filas.splice(i, 1);
  }
}
