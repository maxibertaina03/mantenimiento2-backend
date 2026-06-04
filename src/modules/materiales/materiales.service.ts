import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginacionDto, RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { CategoriasMaterialService } from '../categorias-material/categorias-material.service';
import { CrearMaterialDto } from './dto/crear-material.dto';
import { ActualizarMaterialDto } from './dto/actualizar-material.dto';
import { MaterialRespuestaDto } from './dto/material-respuesta.dto';
import { MaterialConHistorialDto } from './dto/material-con-historial.dto';
import { MaterialesRepository } from './materiales.repository';

@Injectable()
export class MaterialesService {
  constructor(
    private readonly repo: MaterialesRepository,
    private readonly categorias: CategoriasMaterialService,
  ) {}

  async crear(dto: CrearMaterialDto): Promise<MaterialRespuestaDto> {
    // Valida que la categoría exista con un error claro (en vez de un FK genérico).
    await this.categorias.obtener(dto.categoriaId);

    const creado = await this.repo.crear({
      nombre: dto.nombre,
      unidad: dto.unidad,
      stockMinimo: dto.stockMinimo ?? 0,
      notas: dto.notas,
      categoria: { connect: { id: dto.categoriaId } },
      // stockActual arranca en 0; solo cambia vía movimientos.
    });
    return MaterialRespuestaDto.desde(creado);
  }

  async listar(paginacion: PaginacionDto): Promise<RespuestaPaginada<MaterialRespuestaDto>> {
    const [items, total] = await Promise.all([
      this.repo.buscarTodos(paginacion.skip, paginacion.limite),
      this.repo.contar(),
    ]);
    return {
      datos: items.map(MaterialRespuestaDto.desde),
      total,
      pagina: paginacion.pagina,
      limite: paginacion.limite,
    };
  }

  async obtener(id: string): Promise<MaterialRespuestaDto> {
    const material = await this.repo.buscarPorId(id);
    if (!material) {
      throw new NotFoundException(`No existe el material con id ${id}`);
    }
    return MaterialRespuestaDto.desde(material);
  }

  async obtenerConHistorial(id: string): Promise<MaterialConHistorialDto> {
    const material = await this.repo.buscarConHistorial(id);
    if (!material) {
      throw new NotFoundException(`No existe el material con id ${id}`);
    }
    return MaterialConHistorialDto.desdeMaterial(material);
  }

  async listarBajoStock(): Promise<MaterialRespuestaDto[]> {
    const materiales = await this.repo.buscarBajoStock();
    return materiales.map(MaterialRespuestaDto.desde);
  }

  async actualizar(id: string, dto: ActualizarMaterialDto): Promise<MaterialRespuestaDto> {
    await this.obtener(id);
    if (dto.categoriaId) {
      await this.categorias.obtener(dto.categoriaId);
    }

    const actualizado = await this.repo.actualizar(id, {
      nombre: dto.nombre,
      unidad: dto.unidad,
      stockMinimo: dto.stockMinimo,
      notas: dto.notas,
      ...(dto.categoriaId ? { categoria: { connect: { id: dto.categoriaId } } } : {}),
    });
    return MaterialRespuestaDto.desde(actualizado);
  }

  async eliminar(id: string): Promise<void> {
    await this.obtener(id);
    const movimientos = await this.repo.contarMovimientos(id);
    if (movimientos > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el material tiene ${movimientos} movimiento(s) registrado(s).`,
      );
    }
    await this.repo.eliminar(id);
  }
}
