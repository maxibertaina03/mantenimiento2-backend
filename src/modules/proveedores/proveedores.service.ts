import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginacionDto, RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ActualizarProveedorDto } from './dto/actualizar-proveedor.dto';
import { ProveedorRespuestaDto } from './dto/proveedor-respuesta.dto';
import { ProveedoresRepository } from './proveedores.repository';

@Injectable()
export class ProveedoresService {
  constructor(private readonly repo: ProveedoresRepository) {}

  async crear(dto: CrearProveedorDto): Promise<ProveedorRespuestaDto> {
    const creado = await this.repo.crear(dto);
    return ProveedorRespuestaDto.desde(creado);
  }

  async listar(paginacion: PaginacionDto): Promise<RespuestaPaginada<ProveedorRespuestaDto>> {
    const [items, total] = await Promise.all([
      this.repo.buscarTodos(paginacion.skip, paginacion.limite),
      this.repo.contar(),
    ]);
    return {
      datos: items.map(ProveedorRespuestaDto.desde),
      total,
      pagina: paginacion.pagina,
      limite: paginacion.limite,
    };
  }

  async obtener(id: string): Promise<ProveedorRespuestaDto> {
    const proveedor = await this.repo.buscarPorId(id);
    if (!proveedor) {
      throw new NotFoundException(`No existe el proveedor con id ${id}`);
    }
    return ProveedorRespuestaDto.desde(proveedor);
  }

  async actualizar(id: string, dto: ActualizarProveedorDto): Promise<ProveedorRespuestaDto> {
    await this.obtener(id); // valida existencia con error claro
    const actualizado = await this.repo.actualizar(id, dto);
    return ProveedorRespuestaDto.desde(actualizado);
  }

  async eliminar(id: string): Promise<void> {
    await this.obtener(id);
    await this.repo.eliminar(id);
  }
}
