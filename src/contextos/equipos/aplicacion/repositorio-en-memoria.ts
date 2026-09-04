import { Equipo } from '../dominio/equipo';
import {
  EquipoConRelaciones,
  FiltroEquipos,
  PaginaEquipos,
  RepositorioEquipos,
  ResumenEquipos,
} from '../puertos/repositorio-equipos';

/**
 * Repositorio en memoria, para probar los casos de uso sin base de datos.
 *
 * Es una implementación del puerto como cualquier otra: si mañana cambia la
 * interfaz, TypeScript rompe acá y en el adaptador de Prisma al mismo tiempo.
 * Esa es la ventaja concreta de tener el puerto declarado.
 */
export class RepositorioEquiposEnMemoria implements RepositorioEquipos {
  private readonly filas: EquipoConRelaciones[] = [];
  private secuencia = 0;

  constructor(iniciales: Partial<EquipoConRelaciones>[] = []) {
    for (const fila of iniciales) this.sembrar(fila);
  }

  private sembrar(fila: Partial<EquipoConRelaciones>): EquipoConRelaciones {
    const completo: EquipoConRelaciones = {
      id: fila.id ?? `eq-${++this.secuencia}`,
      codigoInterno: fila.codigoInterno ?? null,
      nombre: fila.nombre ?? 'Equipo',
      descripcion: fila.descripcion ?? null,
      marca: fila.marca ?? null,
      modelo: fila.modelo ?? null,
      numeroSerie: fila.numeroSerie ?? null,
      ubicacionId: fila.ubicacionId ?? null,
      tipoId: fila.tipoId ?? null,
      estado: fila.estado ?? 'OPERATIVO',
      fotoUrl: fila.fotoUrl ?? null,
      proveedorId: fila.proveedorId ?? null,
      horasUso: fila.horasUso ?? null,
      fechaAlta: fila.fechaAlta ?? null,
      garantiaHasta: fila.garantiaHasta ?? null,
      ubicacionNombre: fila.ubicacionNombre ?? null,
      tipoNombre: fila.tipoNombre ?? null,
      proveedorNombre: fila.proveedorNombre ?? null,
    };
    this.filas.push(completo);
    return completo;
  }

  async crear(equipo: Omit<Equipo, 'id'>): Promise<EquipoConRelaciones> {
    return this.sembrar(equipo);
  }

  async actualizar(id: string, cambios: Partial<Omit<Equipo, 'id'>>): Promise<EquipoConRelaciones> {
    const fila = this.filas.find((f) => f.id === id);
    if (!fila) throw new Error(`No existe ${id}`);
    Object.assign(fila, cambios);
    return fila;
  }

  async buscarPorId(id: string): Promise<EquipoConRelaciones | null> {
    return this.filas.find((f) => f.id === id) ?? null;
  }

  async buscarPorCodigoInterno(codigo: string): Promise<Equipo | null> {
    return this.filas.find((f) => f.codigoInterno === codigo) ?? null;
  }

  async buscarPorNombreYUbicacion(nombre: string, ubicacionId: string): Promise<Equipo | null> {
    return (
      this.filas.find(
        (f) => f.nombre.toLowerCase() === nombre.toLowerCase() && f.ubicacionId === ubicacionId,
      ) ?? null
    );
  }

  async listarNombresPorUbicaciones(
    ubicacionIds: string[],
  ): Promise<{ nombre: string; ubicacionId: string }[]> {
    return this.filas
      .filter((f) => f.ubicacionId !== null && ubicacionIds.includes(f.ubicacionId))
      .map((f) => ({ nombre: f.nombre, ubicacionId: f.ubicacionId as string }));
  }

  async crearVarios(equipos: Omit<Equipo, 'id'>[]): Promise<number> {
    for (const equipo of equipos) this.sembrar(equipo);
    return equipos.length;
  }

  async listar(filtro: FiltroEquipos): Promise<PaginaEquipos> {
    let filas = [...this.filas];

    if (filtro.buscar) {
      const q = filtro.buscar.toLowerCase();
      filas = filas.filter((f) => f.nombre.toLowerCase().includes(q));
    }
    if (filtro.ubicacionId) filas = filas.filter((f) => f.ubicacionId === filtro.ubicacionId);
    if (filtro.tipoId) filas = filas.filter((f) => f.tipoId === filtro.tipoId);
    if (filtro.estado) filas = filas.filter((f) => f.estado === filtro.estado);
    if (filtro.garantiaVencidaAl) {
      const corte = filtro.garantiaVencidaAl.getTime();
      filas = filas.filter((f) => f.garantiaHasta !== null && f.garantiaHasta.getTime() < corte);
    }

    const total = filas.length;
    return { datos: filas.slice(filtro.skip, filtro.skip + filtro.take), total };
  }

  async eliminar(id: string): Promise<void> {
    const i = this.filas.findIndex((f) => f.id === id);
    if (i >= 0) this.filas.splice(i, 1);
  }

  async resumen(): Promise<ResumenEquipos> {
    const porEstado: Record<string, number> = {};
    for (const e of this.filas) porEstado[e.estado] = (porEstado[e.estado] ?? 0) + 1;

    // Sin planes cargados en el doble, todos los que requieren mantenimiento
    // cuentan como sin plan. Los tests que miran los planes usan su propio
    // repositorio.
    const sinPlan = this.filas.filter(
      (e) => e.estado === 'OPERATIVO' || e.estado === 'EN_REPARACION',
    ).length;

    return { total: this.filas.length, porEstado, sinPlan };
  }
}
