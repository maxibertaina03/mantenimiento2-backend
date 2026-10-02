import {
  EquipoQueLoUsa,
  MaterialDelPanol,
  RepositorioRepuestos,
  RepuestoDeEquipo,
} from '../puertos/repuestos';
import { RepositorioEquiposEnMemoria } from './repositorio-en-memoria';

/** Un material del pañol de los tests. */
export interface MaterialDePrueba extends MaterialDelPanol {
  unidad?: string;
  stockActual?: number;
  stockMinimo?: number;
}

interface Fila {
  id: string;
  equipoId: string;
  materialId: string;
  cantidad: number | null;
  notas: string | null;
  registradoPorId: string | null;
  creadoEn: Date;
}

/** La lista de repuestos en memoria, para probar el caso de uso sin base. */
export class RepositorioRepuestosEnMemoria implements RepositorioRepuestos {
  readonly filas: Fila[] = [];
  private secuencia = 0;

  constructor(
    private readonly equipos: RepositorioEquiposEnMemoria,
    private readonly materiales: MaterialDePrueba[] = [],
  ) {}

  private material(id: string): MaterialDePrueba {
    const m = this.materiales.find((x) => x.id === id);
    if (!m) throw new Error(`No hay material ${id} en la prueba`);
    return m;
  }

  async delEquipo(equipoId: string): Promise<RepuestoDeEquipo[]> {
    return this.filas
      .filter((f) => f.equipoId === equipoId)
      .map((f) => {
        const m = this.material(f.materialId);
        const stockActual = m.stockActual ?? 0;
        const stockMinimo = m.stockMinimo ?? 0;
        return {
          ...f,
          materialNombre: m.nombre,
          unidad: m.unidad ?? '',
          stockActual,
          stockMinimo,
          bajoStock: stockMinimo > 0 && stockActual <= stockMinimo,
          materialActivo: m.activo,
          ubicacion: null,
        };
      })
      .sort((a, b) => a.materialNombre.localeCompare(b.materialNombre));
  }

  async equiposQueLoUsan(materialId: string): Promise<EquipoQueLoUsa[]> {
    const salida: EquipoQueLoUsa[] = [];
    for (const f of this.filas.filter((x) => x.materialId === materialId)) {
      const e = await this.equipos.buscarPorId(f.equipoId);
      if (!e) continue;
      salida.push({
        repuestoId: f.id,
        equipoId: e.id,
        equipoNombre: e.nombre,
        equipoEstado: e.estado,
        ubicacionNombre: e.ubicacionNombre,
        fotoUrl: e.fotoUrl,
        cantidad: f.cantidad,
        notas: f.notas,
      });
    }
    return salida.sort((a, b) => a.equipoNombre.localeCompare(b.equipoNombre));
  }

  async buscarMaterial(materialId: string): Promise<MaterialDelPanol | null> {
    return this.materiales.find((m) => m.id === materialId) ?? null;
  }

  async buscar(id: string) {
    return this.filas.find((f) => f.id === id) ?? null;
  }

  async existe(equipoId: string, materialId: string): Promise<boolean> {
    return this.filas.some((f) => f.equipoId === equipoId && f.materialId === materialId);
  }

  async agregar(datos: Omit<Fila, 'id' | 'creadoEn'>): Promise<void> {
    this.filas.push({ ...datos, id: `rep-${++this.secuencia}`, creadoEn: new Date() });
  }

  async actualizar(
    id: string,
    cambios: { cantidad?: number | null; notas?: string | null },
  ): Promise<void> {
    const f = this.filas.find((x) => x.id === id);
    if (!f) throw new Error(`No existe el repuesto ${id}`);
    if (cambios.cantidad !== undefined) f.cantidad = cambios.cantidad;
    if (cambios.notas !== undefined) f.notas = cambios.notas;
  }

  async quitar(id: string): Promise<void> {
    const i = this.filas.findIndex((x) => x.id === id);
    if (i >= 0) this.filas.splice(i, 1);
  }
}
