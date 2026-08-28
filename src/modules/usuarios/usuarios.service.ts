import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

    // Upsert atomico por email: cubre tanto el caso "ya existe con ese email pero
    // sin idExterno" (lo vincula) como el alta nueva, sin race entre ambos.
    return this.repo.upsertPorEmail({
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

  /** Busca a una persona por nombre. Devuelve null si no existe. */
  buscarPorNombre(nombre: string): Promise<Usuario | null> {
    return this.repo.buscarPorNombre(nombre);
  }

  /**
   * Da de alta a una persona que NO usa el sistema (personal al que se le
   * asignan equipos). Sin `idExterno` no puede iniciar sesión, y entra como
   * OPERARIO: nunca como administrador.
   */
  crearSinAcceso(datos: { nombre: string; email: string }): Promise<Usuario> {
    return this.repo.crear({
      nombre: datos.nombre,
      email: datos.email,
      rol: RolUsuario.OPERARIO,
    });
  }

  /**
   * Impide dejar el sistema sin administradores.
   *
   * Sin esto, el único ADMIN podía quitarse el rol a sí mismo desde la pantalla
   * de usuarios y nadie quedaba con permiso para devolvérselo: el sistema se
   * cerraba solo y había que arreglarlo por SQL.
   */
  private async validarQueQuedeUnAdmin(usuarioId: string, rolActual: RolUsuario): Promise<void> {
    if (rolActual !== RolUsuario.ADMIN) return;
    const admins = await this.repo.contarPorRol(RolUsuario.ADMIN);
    if (admins <= 1) {
      throw new BadRequestException(
        'Es el único administrador del sistema. Nombrá a otro antes de quitarle el rol.',
      );
    }
    void usuarioId;
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto): Promise<UsuarioRespuestaDto> {
    const actual = await this.obtener(id);

    // Solo si REALMENTE se le está quitando el rol de administrador.
    if (dto.rol && dto.rol !== RolUsuario.ADMIN) {
      await this.validarQueQuedeUnAdmin(id, actual.rol);
    }

    const actualizado = await this.repo.actualizar(id, dto);
    return UsuarioRespuestaDto.desde(actualizado);
  }

  async eliminar(id: string): Promise<void> {
    const actual = await this.obtener(id);
    await this.validarQueQuedeUnAdmin(id, actual.rol);
    await this.repo.eliminar(id);
  }
}
