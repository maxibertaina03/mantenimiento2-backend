import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { CategoriaRespuestaDto } from './dto/categoria-respuesta.dto';
import { CategoriasMaterialRepository } from './categorias-material.repository';

@Injectable()
export class CategoriasMaterialService {
  constructor(private readonly repo: CategoriasMaterialRepository) {}

  async crear(dto: CrearCategoriaDto): Promise<CategoriaRespuestaDto> {
    const creada = await this.repo.crear(dto);
    return CategoriaRespuestaDto.desde(creada);
  }

  async listar(): Promise<CategoriaRespuestaDto[]> {
    const categorias = await this.repo.buscarTodas();
    return categorias.map(CategoriaRespuestaDto.desde);
  }

  async obtener(id: string): Promise<CategoriaRespuestaDto> {
    const categoria = await this.repo.buscarPorId(id);
    if (!categoria) {
      throw new NotFoundException(`No existe la categoría con id ${id}`);
    }
    return CategoriaRespuestaDto.desde(categoria);
  }

  async actualizar(id: string, dto: ActualizarCategoriaDto): Promise<CategoriaRespuestaDto> {
    await this.obtener(id);
    const actualizada = await this.repo.actualizar(id, dto);
    return CategoriaRespuestaDto.desde(actualizada);
  }

  async eliminar(id: string): Promise<void> {
    await this.obtener(id);
    const enUso = await this.repo.contarMateriales(id);
    if (enUso > 0) {
      throw new BadRequestException(
        `No se puede eliminar: la categoría tiene ${enUso} material(es) asociado(s).`,
      );
    }
    await this.repo.eliminar(id);
  }
}
