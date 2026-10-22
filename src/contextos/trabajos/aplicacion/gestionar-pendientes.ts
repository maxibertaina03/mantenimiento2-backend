import {
  ordenarPendientes,
  validarQueEsteHecho,
  validarQuePuedeBorrar,
  validarQueSigaPendiente,
  validarTextoPendiente,
} from '../dominio/pendiente';
import { ErrorNoEncontrado } from '../dominio/errores';
import type { Reloj } from '../puertos/reloj';
import type {
  CambiosPendiente,
  PendienteConNombres,
  RepositorioPendientes,
} from '../puertos/repositorio-pendientes';

/** Cuánto tiempo se siguen mostrando los hechos: lo de hace dos meses ya no importa. */
export const DIAS_DE_HECHOS = 60;

export interface DatosPendiente {
  texto: string;
  urgente?: boolean;
  asignadoAId?: string | null;
  equipoId?: string | null;
}

/**
 * El anotador de pendientes de mantenimiento.
 *
 * Las reglas son pocas a propósito: tiene que ser más rápido anotar acá que en
 * un papel, o se termina anotando en un papel.
 */
export class GestionarPendientes {
  constructor(
    private readonly repo: RepositorioPendientes,
    private readonly reloj: Reloj,
  ) {}

  private async buscar(id: string): Promise<PendienteConNombres> {
    const p = await this.repo.buscar(id);
    if (!p) throw new ErrorNoEncontrado(`No existe el pendiente ${id}`);
    return p;
  }

  async listar(estado: 'abiertos' | 'hechos'): Promise<PendienteConNombres[]> {
    if (estado === 'abiertos') return ordenarPendientes(await this.repo.abiertos());
    const desde = new Date(this.reloj.ahora().getTime() - DIAS_DE_HECHOS * 24 * 3600 * 1000);
    return this.repo.hechosDesde(desde);
  }

  crear(datos: DatosPendiente, creadoPorId: string | null): Promise<PendienteConNombres> {
    return this.repo.crear({
      texto: validarTextoPendiente(datos.texto),
      urgente: datos.urgente ?? false,
      asignadoAId: datos.asignadoAId ?? null,
      equipoId: datos.equipoId ?? null,
      creadoPorId,
    });
  }

  async editar(id: string, datos: Partial<DatosPendiente>): Promise<PendienteConNombres> {
    await this.buscar(id);
    const cambios: CambiosPendiente = {
      texto: datos.texto === undefined ? undefined : validarTextoPendiente(datos.texto),
      urgente: datos.urgente,
      asignadoAId: datos.asignadoAId,
      equipoId: datos.equipoId,
    };
    return this.repo.actualizar(id, cambios);
  }

  async marcarHecho(id: string, usuarioId: string | null): Promise<PendienteConNombres> {
    validarQueSigaPendiente(await this.buscar(id));
    return this.repo.actualizar(id, { hechaEn: this.reloj.ahora(), hechaPorId: usuarioId });
  }

  async reabrir(id: string): Promise<PendienteConNombres> {
    validarQueEsteHecho(await this.buscar(id));
    return this.repo.actualizar(id, { hechaEn: null, hechaPorId: null });
  }

  async borrar(id: string, usuarioId: string | null, esAdministrador: boolean): Promise<void> {
    validarQuePuedeBorrar(await this.buscar(id), usuarioId, esAdministrador);
    await this.repo.borrar(id);
  }
}
