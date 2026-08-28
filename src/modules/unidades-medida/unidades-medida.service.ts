import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActualizarUnidadMedidaDto,
  CrearUnidadMedidaDto,
  UnidadMedidaRespuestaDto,
} from './dto/unidad-medida.dto';
import { UnidadesMedidaRepository } from './unidades-medida.repository';

/**
 * Catálogo de unidades de medida.
 *
 * Antes la unidad era texto libre en el material. Eso hacía que "lt", "Lt" y
 * "litros" fueran tres unidades distintas, y cualquier reporte que agrupe por
 * unidad daba números que no cierran. Como catálogo, la unidad es un dato
 * analizable: hay una sola fila por unidad y los materiales la referencian.
 */
@Injectable()
export class UnidadesMedidaService {
  constructor(private readonly repo: UnidadesMedidaRepository) {}

  /**
   * Nombre y símbolo son únicos y se comparan sin distinguir mayúsculas: si se
   * pudiera cargar "Lt" teniendo "lt", el catálogo repetiría el problema que
   * vino a resolver.
   */
  private async validarLibre(valor: string, idPropia?: string): Promise<void> {
    const existente = await this.repo.buscarPorNombreOSimbolo(valor);
    if (existente && existente.id !== idPropia) {
      throw new BadRequestException(
        `Ya existe la unidad "${existente.nombre}" (${existente.simbolo}).`,
      );
    }
  }

  async listar(soloActivas = false): Promise<UnidadMedidaRespuestaDto[]> {
    const unidades = await this.repo.buscarTodas(soloActivas);
    return unidades.map(UnidadMedidaRespuestaDto.desde);
  }

  async obtener(id: string): Promise<UnidadMedidaRespuestaDto> {
    const unidad = await this.repo.buscarPorId(id);
    if (!unidad) throw new NotFoundException(`No existe la unidad de medida con id ${id}`);
    return UnidadMedidaRespuestaDto.desde(unidad);
  }

  async crear(dto: CrearUnidadMedidaDto): Promise<UnidadMedidaRespuestaDto> {
    await this.validarLibre(dto.nombre);
    await this.validarLibre(dto.simbolo);

    const creada = await this.repo.crear({
      nombre: dto.nombre.trim(),
      simbolo: dto.simbolo.trim(),
      orden: dto.orden ?? 0,
      activo: dto.activo ?? true,
    });
    return UnidadMedidaRespuestaDto.desde(creada);
  }

  async actualizar(id: string, dto: ActualizarUnidadMedidaDto): Promise<UnidadMedidaRespuestaDto> {
    await this.obtener(id);
    if (dto.nombre) await this.validarLibre(dto.nombre, id);
    if (dto.simbolo) await this.validarLibre(dto.simbolo, id);

    const actualizada = await this.repo.actualizar(id, {
      nombre: dto.nombre?.trim(),
      simbolo: dto.simbolo?.trim(),
      orden: dto.orden,
      activo: dto.activo,
    });
    return UnidadMedidaRespuestaDto.desde(actualizada);
  }

  /**
   * Solo se borra una unidad que no use ningún material. Si está en uso, lo
   * correcto es desactivarla: deja de ofrecerse al cargar, pero los materiales
   * que ya la tienen conservan su unidad.
   */
  async eliminar(id: string): Promise<void> {
    const unidad = await this.obtener(id);
    if (unidad.materiales > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${unidad.nombre}": la usan ${unidad.materiales} material(es). ` +
          'Si ya no se usa, desactivala en vez de borrarla.',
      );
    }
    await this.repo.eliminar(id);
  }
}
