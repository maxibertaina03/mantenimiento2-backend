import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActualizarTipoEquipoDto,
  CrearTipoEquipoDto,
  TipoEquipoRespuestaDto,
} from './dto/tipo-equipo.dto';
import { TiposEquipoRepository } from './tipos-equipo.repository';

/**
 * Catálogo de tipos de equipo, administrable desde el sistema.
 *
 * Antes era un enum: agregar "ISP" o "Cargador" obligaba a tocar el código y
 * migrar la base. Ahora se dan de alta desde la pantalla.
 */
@Injectable()
export class TiposEquipoService {
  constructor(private readonly repo: TiposEquipoRepository) {}

  /** El nombre identifica al tipo en la UI: repetirlo confunde. */
  private async validarNombreLibre(nombre: string, idPropio?: string): Promise<void> {
    const existente = await this.repo.buscarPorNombre(nombre);
    if (existente && existente.id !== idPropio) {
      throw new BadRequestException(`Ya existe un tipo de equipo llamado "${existente.nombre}".`);
    }
  }

  async listar(soloActivos = false): Promise<TipoEquipoRespuestaDto[]> {
    const tipos = await this.repo.buscarTodos(soloActivos);
    return tipos.map(TipoEquipoRespuestaDto.desde);
  }

  async obtener(id: string): Promise<TipoEquipoRespuestaDto> {
    const tipo = await this.repo.buscarPorId(id);
    if (!tipo) throw new NotFoundException(`No existe el tipo de equipo con id ${id}`);
    return TipoEquipoRespuestaDto.desde(tipo);
  }

  async crear(dto: CrearTipoEquipoDto): Promise<TipoEquipoRespuestaDto> {
    await this.validarNombreLibre(dto.nombre);
    const creado = await this.repo.crear({
      nombre: dto.nombre.trim(),
      alias: dto.alias?.trim() || null,
      llevaEspecificaciones: dto.llevaEspecificaciones ?? true,
      orden: dto.orden ?? 0,
      activo: dto.activo ?? true,
    });
    return TipoEquipoRespuestaDto.desde(creado);
  }

  async actualizar(id: string, dto: ActualizarTipoEquipoDto): Promise<TipoEquipoRespuestaDto> {
    await this.obtener(id);
    if (dto.nombre) await this.validarNombreLibre(dto.nombre, id);

    const actualizado = await this.repo.actualizar(id, {
      nombre: dto.nombre?.trim(),
      alias: dto.alias !== undefined ? dto.alias.trim() || null : undefined,
      llevaEspecificaciones: dto.llevaEspecificaciones,
      orden: dto.orden,
      activo: dto.activo,
    });
    return TipoEquipoRespuestaDto.desde(actualizado);
  }

  /**
   * Solo se borra un tipo que no use ningún equipo. Si está en uso, lo correcto
   * es desactivarlo: deja de ofrecerse al cargar, pero los equipos que ya lo
   * tienen conservan su clasificación.
   */
  async eliminar(id: string): Promise<void> {
    const tipo = await this.obtener(id);
    if (tipo.equipos > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${tipo.nombre}": lo usan ${tipo.equipos} equipo(s). ` +
          'Si ya no se usa, desactivalo en vez de borrarlo.',
      );
    }
    await this.repo.eliminar(id);
  }
}
