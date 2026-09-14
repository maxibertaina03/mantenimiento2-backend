import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { CategoriaRespuestaDto } from './dto/categoria-respuesta.dto';
import { CategoriasMaterialRepository } from './categorias-material.repository';
import { buscarNombreRepetido, normalizarNombre } from '../../common/dominio/nombres';

@Injectable()
export class CategoriasMaterialService {
  constructor(private readonly repo: CategoriasMaterialRepository) {}

  /**
   * Rechaza un nombre que ya existe, salvo que sea el de la propia categoría.
   *
   * Dos categorías iguales dejan el desplegable con dos filas idénticas y los
   * materiales repartidos entre las dos. Desde ahí, ningún filtro por categoría
   * vuelve a dar el total, y el que lo mira no tiene cómo darse cuenta.
   */
  private async verificarNombreLibre(nombre: string, exceptoId?: string): Promise<void> {
    const choque = buscarNombreRepetido(await this.repo.listarNombres(), nombre, exceptoId);
    if (choque) {
      throw new BadRequestException(
        `Ya existe una categoría llamada "${choque.nombre}". Usá esa en vez de crear otra.`,
      );
    }
  }

  async crear(dto: CrearCategoriaDto): Promise<CategoriaRespuestaDto> {
    const nombre = normalizarNombre(dto.nombre);
    await this.verificarNombreLibre(nombre);
    const creada = await this.repo.crear({ ...dto, nombre });
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
    const nombre = dto.nombre !== undefined ? normalizarNombre(dto.nombre) : undefined;
    if (nombre) await this.verificarNombreLibre(nombre, id);
    const actualizada = await this.repo.actualizar(id, { ...dto, nombre });
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
