import { ErrorNoEncontrado } from '../dominio/errores';
import { resumirMateriales, ResumenTrabajo } from '../dominio/orden-trabajo';
import {
  FiltroOrdenesTrabajo,
  OrdenTrabajoConRelaciones,
  RepositorioOrdenesTrabajo,
} from '../puertos/repositorio-ordenes-trabajo';

export interface PaginaDeOrdenes {
  datos: OrdenTrabajoConRelaciones[];
  total: number;
  pagina: number;
  limite: number;
}

/** La orden con lo que se usó ya sumado, para no hacer esa cuenta en la pantalla. */
export interface OrdenTrabajoConResumen extends OrdenTrabajoConRelaciones {
  resumen: ResumenTrabajo;
}

export class ConsultarOrdenesTrabajo {
  constructor(private readonly repo: RepositorioOrdenesTrabajo) {}

  async listar(
    filtro: FiltroOrdenesTrabajo,
    pagina: number,
    limite: number,
  ): Promise<PaginaDeOrdenes> {
    // En paralelo: son dos consultas independientes y una pantalla que espera
    // las dos en fila tarda el doble sin ninguna razón.
    const [datos, total] = await Promise.all([
      this.repo.listar(filtro, (pagina - 1) * limite, limite),
      this.repo.contar(filtro),
    ]);

    return { datos, total, pagina, limite };
  }

  async buscarPorId(id: string): Promise<OrdenTrabajoConResumen> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) throw new ErrorNoEncontrado(`No existe la orden de trabajo con id ${id}`);
    return { ...orden, resumen: resumirMateriales(orden.materiales) };
  }

  /**
   * Las órdenes que nombraron a un equipo, para mostrarlas en su ficha.
   *
   * Pasa por el mismo filtro que el listado en vez de tener consulta propia: es
   * la misma pregunta con un filtro puesto, y dos caminos distintos para el
   * mismo dato terminan divergiendo.
   */
  async listarPorEquipo(equipoId: string): Promise<OrdenTrabajoConRelaciones[]> {
    return this.repo.listar({ equipoId }, 0, 100);
  }
}
