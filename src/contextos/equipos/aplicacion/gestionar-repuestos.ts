import { ErrorNoEncontrado } from '../dominio/errores';
import { datosDelRepuesto, EquipoParaRepuesto, validarRepuestoNuevo } from '../dominio/repuesto';
import { EquipoQueLoUsa, RepositorioRepuestos, RepuestoDeEquipo } from '../puertos/repuestos';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';

/**
 * La lista de repuestos de cada equipo: qué materiales del pañol lleva.
 *
 * Sirve para el día que se rompe: abrir la ficha de la máquina y ver qué ir a
 * buscar, si hay y dónde está, sin revolver el historial de trabajos.
 */
export class GestionarRepuestos {
  constructor(
    private readonly repuestos: RepositorioRepuestos,
    private readonly equipos: RepositorioEquipos,
  ) {}

  private async traerEquipo(id: string): Promise<EquipoParaRepuesto> {
    const equipo = await this.equipos.buscarPorId(id);
    if (!equipo) throw new ErrorNoEncontrado(`No existe el equipo con id ${id}`);
    return equipo;
  }

  /** El repuesto, comprobando que sea de ese equipo: el id solo no alcanza. */
  private async traerDelEquipo(equipoId: string, repuestoId: string) {
    const repuesto = await this.repuestos.buscar(repuestoId);
    if (!repuesto || repuesto.equipoId !== equipoId) {
      throw new ErrorNoEncontrado('Ese repuesto no está en la lista de este equipo.');
    }
    return repuesto;
  }

  async listar(equipoId: string): Promise<RepuestoDeEquipo[]> {
    await this.traerEquipo(equipoId);
    return this.repuestos.delEquipo(equipoId);
  }

  async agregar(
    equipoId: string,
    datos: { materialId: string; cantidad?: number | null; notas?: string | null },
    registradoPorId: string | null,
  ): Promise<RepuestoDeEquipo[]> {
    const equipo = await this.traerEquipo(equipoId);
    const material = await this.repuestos.buscarMaterial(datos.materialId);
    if (!material) throw new ErrorNoEncontrado(`No existe el material con id ${datos.materialId}`);

    validarRepuestoNuevo(equipo, material, await this.repuestos.existe(equipoId, material.id));
    const { cantidad, notas } = datosDelRepuesto(datos);

    await this.repuestos.agregar({
      equipoId,
      materialId: material.id,
      cantidad: cantidad ?? null,
      notas: notas ?? null,
      registradoPorId,
    });
    return this.repuestos.delEquipo(equipoId);
  }

  async cambiar(
    equipoId: string,
    repuestoId: string,
    cambios: { cantidad?: number | null; notas?: string | null },
  ): Promise<RepuestoDeEquipo[]> {
    await this.traerDelEquipo(equipoId, repuestoId);
    await this.repuestos.actualizar(repuestoId, datosDelRepuesto(cambios));
    return this.repuestos.delEquipo(equipoId);
  }

  async quitar(equipoId: string, repuestoId: string): Promise<RepuestoDeEquipo[]> {
    await this.traerDelEquipo(equipoId, repuestoId);
    await this.repuestos.quitar(repuestoId);
    return this.repuestos.delEquipo(equipoId);
  }

  /** En qué equipos va un material: «¿para qué tenemos este retén?». */
  async equiposQueLoUsan(materialId: string): Promise<EquipoQueLoUsa[]> {
    const material = await this.repuestos.buscarMaterial(materialId);
    if (!material) throw new ErrorNoEncontrado(`No existe el material con id ${materialId}`);
    return this.repuestos.equiposQueLoUsan(materialId);
  }
}
