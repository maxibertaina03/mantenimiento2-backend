import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ActualizarProveedorDto } from './dto/actualizar-proveedor.dto';
import { ListarProveedoresDto } from './dto/listar-proveedores.dto';
import { ProveedorRespuestaDto } from './dto/proveedor-respuesta.dto';
import { ProveedoresRepository } from './proveedores.repository';

@Injectable()
export class ProveedoresService {
  constructor(private readonly repo: ProveedoresRepository) {}

  async crear(dto: CrearProveedorDto): Promise<ProveedorRespuestaDto> {
    const creado = await this.repo.crear(dto);
    return ProveedorRespuestaDto.desde(creado);
  }

  async listar(query: ListarProveedoresDto): Promise<RespuestaPaginada<ProveedorRespuestaDto>> {
    // Filtro por nombre o CUIT (contiene, sin distinguir mayúsculas/minúsculas).
    const where: Prisma.ProveedorWhereInput = query.buscar
      ? {
          OR: [
            { nombre: { contains: query.buscar, mode: 'insensitive' } },
            { cuit: { contains: query.buscar, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.repo.buscarTodos(query.skip, query.limite, where),
      this.repo.contar(where),
    ]);
    return {
      datos: items.map(ProveedorRespuestaDto.desde),
      total,
      pagina: query.pagina,
      limite: query.limite,
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
