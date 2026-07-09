import { Injectable, NotFoundException } from '@nestjs/common';
import { RolUsuario, Usuario } from '@prisma/client';
import { PaginacionDto, RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { UsuarioRespuestaDto } from './dto/usuario-respuesta.dto';
import { UsuariosRepository } from './usuarios.repository';

/** Datos que aporta Clerk al provisionar un usuario por primera vez (JIT). */
export interface DatosUsuarioClerk {
  idExterno: string;
  email: string;
  nombre: string;
}

@Injectable()
export class UsuariosService {
  constructor(private readonly repo: UsuariosRepository) {}

  /**
   * Provisionamiento just-in-time desde Clerk.
   * - Si ya existe un usuario con ese idExterno, lo devuelve.
   * - Si existe uno con el mismo email (p. ej. el admin del seed) pero sin idExterno,
   *   lo vincula al id de Clerk.
   * - Si no existe, lo crea con rol OPERARIO por defecto.
   * Devuelve la entidad (no el DTO) porque la usa el guard de autenticación.
   */
  async buscarOCrearPorClerk(datos: DatosUsuarioClerk): Promise<Usuario> {
    const porIdExterno = await this.repo.buscarPorIdExterno(datos.idExterno);
    if (porIdExterno) {
      // Sincroniza nombre/email con Clerk en cada login (por si cambió el username).
      if (porIdExterno.nombre !== datos.nombre || porIdExterno.email !== datos.email) {
        return this.repo.actualizar(porIdExterno.id, {
          nombre: datos.nombre,
          email: datos.email,
        });
      }
      return porIdExterno;
    }

    const porEmail = await this.repo.buscarPorEmail(datos.email);
    if (porEmail) {
      return this.repo.actualizar(porEmail.id, {
        idExterno: datos.idExterno,
        nombre: datos.nombre,
      });
    }

    return this.repo.crear({
      idExterno: datos.idExterno,
      email: datos.email,
      nombre: datos.nombre,
      rol: RolUsuario.OPERARIO,
    });
  }

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
