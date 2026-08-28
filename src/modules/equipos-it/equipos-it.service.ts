import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoEquipoIT, Usuario } from '@prisma/client';
import { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ActualizarEquipoDto } from './dto/actualizar-equipo.dto';
import { AsignarEquipoDto } from './dto/asignar-equipo.dto';
import { CrearEquipoDto } from './dto/crear-equipo.dto';
import { AsignacionRespuestaDto, EquipoRespuestaDto } from './dto/equipo-respuesta.dto';
import { ListarEquiposDto } from './dto/listar-equipos.dto';
import { EquiposItRepository, FiltroEquipos } from './equipos-it.repository';

@Injectable()
export class EquiposItService {
  constructor(
    private readonly repo: EquiposItRepository,
    private readonly usuarios: UsuariosService,
  ) {}

  /** Un equipo dado de baja no puede estar en manos de nadie. */
  private validarBajaSinTenedor(estado: EstadoEquipoIT, asignadoAId?: string | null): void {
    if (estado === EstadoEquipoIT.DADO_DE_BAJA && asignadoAId) {
      throw new BadRequestException(
        'Un equipo dado de baja no puede quedar asignado a un usuario. Devolvelo a depósito primero.',
      );
    }
  }

  /** El código interno es la etiqueta física: no puede repetirse. */
  private async validarCodigoLibre(codigoInterno: string, idPropio?: string): Promise<void> {
    const existente = await this.repo.buscarPorCodigoInterno(codigoInterno);
    if (existente && existente.id !== idPropio) {
      throw new BadRequestException(
        `Ya existe un equipo con el código interno "${codigoInterno}" (${existente.marca} ${existente.modelo}).`,
      );
    }
  }

  private async validarUsuarioExiste(usuarioId: string): Promise<void> {
    // Lanza 404 con un mensaje claro si el usuario no existe.
    await this.usuarios.obtener(usuarioId);
  }

  async crear(dto: CrearEquipoDto): Promise<EquipoRespuestaDto> {
    if (dto.codigoInterno) await this.validarCodigoLibre(dto.codigoInterno);
    if (dto.asignadoAId) await this.validarUsuarioExiste(dto.asignadoAId);

    const estado =
      dto.estado ?? (dto.asignadoAId ? EstadoEquipoIT.EN_USO : EstadoEquipoIT.EN_DEPOSITO);
    this.validarBajaSinTenedor(estado, dto.asignadoAId);

    const creado = await this.repo.crear({
      codigoInterno: dto.codigoInterno,
      tipo: { connect: { id: dto.tipoId } },
      estado,
      marca: dto.marca,
      modelo: dto.modelo,
      numeroSerie: dto.numeroSerie,
      procesador: dto.procesador,
      memoriaRamGb: dto.memoriaRamGb,
      discoTipo: dto.discoTipo,
      discoCapacidadGb: dto.discoCapacidadGb,
      sistemaOperativo: dto.sistemaOperativo,
      direccionIp: dto.direccionIp,
      direccionMac: dto.direccionMac,
      nombreEnRed: dto.nombreEnRed,
      accesoRemoto: dto.accesoRemoto,
      accesoRemotoId: dto.accesoRemotoId,
      ubicacion: dto.ubicacion,
      fechaCompra: dto.fechaCompra ? new Date(dto.fechaCompra) : undefined,
      garantiaHasta: dto.garantiaHasta ? new Date(dto.garantiaHasta) : undefined,
      notas: dto.notas,
      ...(dto.proveedorId ? { proveedor: { connect: { id: dto.proveedorId } } } : {}),
      ...(dto.asignadoAId ? { asignadoA: { connect: { id: dto.asignadoAId } } } : {}),
    });

    // Si nace asignado, el historial tiene que arrancar con ese tramo.
    if (dto.asignadoAId) {
      await this.repo.reasignar({
        equipoId: creado.id,
        usuarioId: dto.asignadoAId,
        registradoPorId: null,
        motivo: 'Alta del equipo',
        estadoResultante: estado,
      });
      return this.obtener(creado.id);
    }

    return EquipoRespuestaDto.desde(creado);
  }

  async listar(query: ListarEquiposDto): Promise<RespuestaPaginada<EquipoRespuestaDto>> {
    const filtro: FiltroEquipos = {
      buscar: query.buscar,
      tipoId: query.tipoId,
      estado: query.estado,
      asignadoAId: query.asignadoAId,
    };

    const [items, total] = await Promise.all([
      this.repo.buscarConFiltros(filtro, query.skip, query.limite),
      this.repo.contar(filtro),
    ]);

    return {
      datos: items.map(EquipoRespuestaDto.desde),
      total,
      pagina: query.pagina,
      limite: query.limite,
    };
  }

  async obtener(id: string): Promise<EquipoRespuestaDto> {
    const equipo = await this.repo.buscarPorId(id);
    if (!equipo) {
      throw new NotFoundException(`No existe el equipo con id ${id}`);
    }
    return EquipoRespuestaDto.desde(equipo);
  }

  async actualizar(id: string, dto: ActualizarEquipoDto): Promise<EquipoRespuestaDto> {
    const actual = await this.repo.buscarPorId(id);
    if (!actual) {
      throw new NotFoundException(`No existe el equipo con id ${id}`);
    }

    if (dto.codigoInterno) await this.validarCodigoLibre(dto.codigoInterno, id);

    const estado = dto.estado ?? actual.estado;
    this.validarBajaSinTenedor(estado, actual.asignadoAId);

    const actualizado = await this.repo.actualizar(id, {
      codigoInterno: dto.codigoInterno,
      tipo: { connect: { id: dto.tipoId } },
      estado: dto.estado,
      marca: dto.marca,
      modelo: dto.modelo,
      numeroSerie: dto.numeroSerie,
      procesador: dto.procesador,
      memoriaRamGb: dto.memoriaRamGb,
      discoTipo: dto.discoTipo,
      discoCapacidadGb: dto.discoCapacidadGb,
      sistemaOperativo: dto.sistemaOperativo,
      direccionIp: dto.direccionIp,
      direccionMac: dto.direccionMac,
      nombreEnRed: dto.nombreEnRed,
      accesoRemoto: dto.accesoRemoto,
      accesoRemotoId: dto.accesoRemotoId,
      ubicacion: dto.ubicacion,
      fechaCompra: dto.fechaCompra ? new Date(dto.fechaCompra) : undefined,
      garantiaHasta: dto.garantiaHasta ? new Date(dto.garantiaHasta) : undefined,
      notas: dto.notas,
      ...(dto.proveedorId ? { proveedor: { connect: { id: dto.proveedorId } } } : {}),
    });

    return EquipoRespuestaDto.desde(actualizado);
  }

  /**
   * Asigna el equipo a un usuario o lo devuelve a depósito (usuarioId null).
   * Deja el tramo anterior cerrado en el historial.
   */
  async asignar(
    id: string,
    dto: AsignarEquipoDto,
    usuarioActual?: Usuario,
  ): Promise<EquipoRespuestaDto> {
    const equipo = await this.repo.buscarPorId(id);
    if (!equipo) {
      throw new NotFoundException(`No existe el equipo con id ${id}`);
    }

    if (equipo.estado === EstadoEquipoIT.DADO_DE_BAJA) {
      throw new BadRequestException(
        'El equipo está dado de baja: no se puede asignar. Cambiá su estado primero.',
      );
    }

    const usuarioId = dto.usuarioId ?? null;
    if (usuarioId) await this.validarUsuarioExiste(usuarioId);

    if (equipo.asignadoAId === usuarioId) {
      throw new BadRequestException(
        usuarioId ? 'El equipo ya está asignado a ese usuario.' : 'El equipo ya está en depósito.',
      );
    }

    // Entregarlo lo pone EN_USO; devolverlo, EN_DEPOSITO. Si estaba en
    // reparación, se respeta ese estado (volvió del service, no cambió de mano).
    const estadoResultante = usuarioId ? EstadoEquipoIT.EN_USO : EstadoEquipoIT.EN_DEPOSITO;

    const actualizado = await this.repo.reasignar({
      equipoId: id,
      usuarioId,
      registradoPorId: usuarioActual?.id ?? null,
      motivo: dto.motivo,
      notas: dto.notas,
      estadoResultante,
    });

    return EquipoRespuestaDto.desde(actualizado);
  }

  async listarAsignaciones(id: string): Promise<AsignacionRespuestaDto[]> {
    await this.obtener(id); // valida que exista
    const asignaciones = await this.repo.listarAsignaciones(id);
    return asignaciones.map(AsignacionRespuestaDto.desde);
  }

  resumen() {
    return this.repo.resumen();
  }

  /** Ubicaciones ya usadas, para sugerirlas en el formulario. */
  ubicaciones(): Promise<string[]> {
    return this.repo.ubicacionesUsadas();
  }

  async eliminar(id: string): Promise<void> {
    const equipo = await this.repo.buscarPorId(id);
    if (!equipo) {
      throw new NotFoundException(`No existe el equipo con id ${id}`);
    }
    if (equipo.asignadoAId) {
      throw new BadRequestException(
        'No se puede eliminar un equipo asignado. Devolvelo a depósito primero.',
      );
    }
    await this.repo.eliminar(id);
  }
}
