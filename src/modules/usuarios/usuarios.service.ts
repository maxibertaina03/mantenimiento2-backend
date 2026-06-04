import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginacionDto, RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { UsuarioRespuestaDto } from './dto/usuario-respuesta.dto';
import { UsuariosRepository } from './usuarios.repository';

@Injectable()
export class UsuariosService {
  constructor(private readonly repo: UsuariosRepository) {}

  async crear(dto: CrearUsuarioDto): Promise<UsuarioRespuestaDto> {
    const creado = await this.repo.crear(dto);
    return UsuarioRespuestaDto.desde(creado);
  }

  async listar(paginacion: PaginacionDto): Promise<RespuestaPaginada<UsuarioRespuestaDto>> {
    const [items, total] = await Promise.all([
      this.repo.buscarTodos(paginacion.skip, paginacion.limite),
      this.repo.contar(),
    ]);
    return {
      datos: items.map(UsuarioRespuestaDto.desde),
      total,
      pagina: paginacion.pagina,
      limite: paginacion.limite,
    };
  }

  async obtener(id: string): Promise<UsuarioRespuestaDto> {
    const usuario = await this.repo.buscarPorId(id);
    if (!usuario) {
      throw new NotFoundException(`No existe el usuario con id ${id}`);
    }
    return UsuarioRespuestaDto.desde(usuario);
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto): Promise<UsuarioRespuestaDto> {
    await this.obtener(id);
    const actualizado = await this.repo.actualizar(id, dto);
    return UsuarioRespuestaDto.desde(actualizado);
  }

  async eliminar(id: string): Promise<void> {
    await this.obtener(id);
    await this.repo.eliminar(id);
  }
}
