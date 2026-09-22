import { MaterialUsado, OrdenTrabajo } from '../dominio/orden-trabajo';
import {
  FiltroOrdenesTrabajo,
  MaterialUsadoConRelaciones,
  OrdenTrabajoConRelaciones,
  RepositorioOrdenesTrabajo,
} from '../puertos/repositorio-ordenes-trabajo';

/**
 * El repositorio de los tests.
 *
 * Existe para que los casos de uso se prueben sin base de datos: las reglas de
 * "no se cargan materiales en una orden cerrada" o "el stock se devuelve si
 * falla el guardado" no tienen nada que ver con Postgres, y probarlas contra
 * una base real las haría lentas y frágiles sin verificar nada más.
 */
export class RepositorioOrdenesEnMemoria implements RepositorioOrdenesTrabajo {
  private ordenes: OrdenTrabajoConRelaciones[] = [];
  private materiales: MaterialUsadoConRelaciones[] = [];
  private contador = 0;

  /** Nombres de materiales, para que el read model devuelva algo legible. */
  constructor(private readonly nombresDeMaterial: Record<string, string> = {}) {}

  /** Hace fallar el próximo `agregarMaterial`, para probar la compensación. */
  fallarAlAgregarMaterial = false;

  private conMateriales(orden: OrdenTrabajoConRelaciones): OrdenTrabajoConRelaciones {
    return { ...orden, materiales: this.materiales.filter((m) => m.ordenTrabajoId === orden.id) };
  }

  async crear(
    orden: Omit<OrdenTrabajo, 'id' | 'numero' | 'creadoEn'>,
  ): Promise<OrdenTrabajoConRelaciones> {
    this.contador += 1;
    const guardada: OrdenTrabajoConRelaciones = {
      ...orden,
      id: `ot-${this.contador}`,
      numero: `OT-2026-${String(this.contador).padStart(4, '0')}`,
      creadoEn: orden.abiertaEn,
      equipoNombre: orden.equipoId ? `Equipo ${orden.equipoId}` : null,
      equipoCodigo: null,
      proveedorNombre: orden.proveedorId ? `Proveedor ${orden.proveedorId}` : null,
      planNombre: orden.planId ? `Plan ${orden.planId}` : null,
      abiertaPorNombre: null,
      asignadoANombre: orden.asignadoAId ? `Usuario ${orden.asignadoAId}` : null,
      cerradaPorNombre: null,
      materiales: [],
    };
    this.ordenes.push(guardada);
    return this.conMateriales(guardada);
  }

  async buscarPorId(id: string): Promise<OrdenTrabajoConRelaciones | null> {
    const orden = this.ordenes.find((o) => o.id === id);
    return orden ? this.conMateriales(orden) : null;
  }

  async listar(
    filtro: FiltroOrdenesTrabajo,
    skip: number,
    take: number,
  ): Promise<OrdenTrabajoConRelaciones[]> {
    return this.filtradas(filtro)
      .slice(skip, skip + take)
      .map((o) => this.conMateriales(o));
  }

  async contar(filtro: FiltroOrdenesTrabajo): Promise<number> {
    return this.filtradas(filtro).length;
  }

  private filtradas(filtro: FiltroOrdenesTrabajo): OrdenTrabajoConRelaciones[] {
    return this.ordenes.filter((o) => {
      if (filtro.estado && o.estado !== filtro.estado) return false;
      if (filtro.tipo && o.tipo !== filtro.tipo) return false;
      if (filtro.equipoId && o.equipoId !== filtro.equipoId) return false;
      if (filtro.asignadoAId && o.asignadoAId !== filtro.asignadoAId) return false;
      if (filtro.buscar) {
        const texto = `${o.numero} ${o.titulo} ${o.descripcion ?? ''}`.toLowerCase();
        if (!texto.includes(filtro.buscar.toLowerCase())) return false;
      }
      return true;
    });
  }

  async actualizar(id: string, cambios: Partial<OrdenTrabajo>): Promise<OrdenTrabajoConRelaciones> {
    const indice = this.ordenes.findIndex((o) => o.id === id);
    if (indice === -1) throw new Error(`No existe la orden ${id}`);
    this.ordenes[indice] = { ...this.ordenes[indice], ...cambios };
    return this.conMateriales(this.ordenes[indice]);
  }

  async eliminar(id: string): Promise<void> {
    this.ordenes = this.ordenes.filter((o) => o.id !== id);
  }

  async agregarMaterial(
    material: Omit<MaterialUsado, 'id' | 'creadoEn'>,
  ): Promise<MaterialUsadoConRelaciones> {
    if (this.fallarAlAgregarMaterial) {
      this.fallarAlAgregarMaterial = false;
      throw new Error('falla simulada al guardar el renglón');
    }

    this.contador += 1;
    const guardado: MaterialUsadoConRelaciones = {
      ...material,
      id: `mu-${this.contador}`,
      creadoEn: new Date(),
      materialNombre: this.nombresDeMaterial[material.materialId] ?? material.materialId,
      unidad: 'u',
    };
    this.materiales.push(guardado);
    return guardado;
  }

  async buscarMaterialUsado(id: string): Promise<MaterialUsado | null> {
    return this.materiales.find((m) => m.id === id) ?? null;
  }

  async quitarMaterial(id: string): Promise<void> {
    this.materiales = this.materiales.filter((m) => m.id !== id);
  }
}
