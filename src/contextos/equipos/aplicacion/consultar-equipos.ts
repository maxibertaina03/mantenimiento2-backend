import { garantiaVencida } from '../dominio/equipo';
import { ErrorNoEncontrado } from '../dominio/errores';
import {
  EquipoConRelaciones,
  FiltroEquipos,
  RepositorioEquipos,
} from '../puertos/repositorio-equipos';
import { Reloj } from '../puertos/reloj';

/** Un equipo tal como se muestra, con lo derivado ya resuelto. */
export interface EquipoParaMostrar extends EquipoConRelaciones {
  garantiaVencida: boolean;
}

export interface ListadoEquipos {
  datos: EquipoParaMostrar[];
  total: number;
}

/**
 * Agrega lo derivado a un equipo.
 *
 * Vive suelta y no dentro de ConsultarEquipos porque el alta y la edición
 * también tienen que devolver la misma forma: si el POST respondiera sin
 * `garantiaVencida` y el GET con él, la pantalla mostraría distinto según
 * viniera de guardar o de recargar.
 */
export function aEquipoParaMostrar(equipo: EquipoConRelaciones, hoy: Date): EquipoParaMostrar {
  return { ...equipo, garantiaVencida: garantiaVencida(equipo.garantiaHasta, hoy) };
}

/**
 * Leer equipos.
 *
 * Los datos derivados (si la garantía venció) se calculan acá y no se guardan:
 * un campo `garantiaVencida` en la base quedaría desactualizado al día
 * siguiente, y habría que tener algo que lo recalcule todas las noches.
 */
export class ConsultarEquipos {
  constructor(
    private readonly repo: RepositorioEquipos,
    private readonly reloj: Reloj,
  ) {}

  private decorar(equipo: EquipoConRelaciones): EquipoParaMostrar {
    return aEquipoParaMostrar(equipo, this.reloj.ahora());
  }

  async listar(filtro: FiltroEquipos): Promise<ListadoEquipos> {
    const pagina = await this.repo.listar(filtro);
    return { datos: pagina.datos.map((e) => this.decorar(e)), total: pagina.total };
  }

  async obtener(id: string): Promise<EquipoParaMostrar> {
    const equipo = await this.repo.buscarPorId(id);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${id}`);
    return this.decorar(equipo);
  }
}
