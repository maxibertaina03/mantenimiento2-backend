import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoEquipoIT, Usuario } from '@prisma/client';
import { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { ResponsablesService } from '../responsables/responsables.controller';
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
    private readonly responsables: ResponsablesService,
  ) {}

  /** Un equipo dado de baja no puede estar en manos de nadie. */
  private validarBajaSinTenedor(estado: EstadoEquipoIT, responsableId?: string | null): void {
    if (estado === EstadoEquipoIT.DADO_DE_BAJA && responsableId) {
      throw new BadRequestException(
        'Un equipo dado de baja no puede quedar a cargo de alguien. Devolvelo a depósito primero.',
      );
    }
  }

  /** El código interno es la etiqueta física: no puede repetirse. */
  private async validarCodigoLibre(codigoInterno: string, idPropio?: string): Promise<void> {
    const existente = await this.repo.buscarPorCodigoInterno(codigoInterno);
    if (existente && existente.id !== idPropio) {
      const comoSeLlama =
        [existente.marca?.nombre, existente.modelo?.nombre].filter(Boolean).join(' ') ||
        'sin marca cargada';
      throw new BadRequestException(
        `Ya existe un equipo con el código interno "${codigoInterno}" (${comoSeLlama}).`,
      );
    }
  }

  private async validarResponsableExiste(responsableId: string): Promise<void> {
    // Lanza 404 con un mensaje claro si el responsable no existe.
    await this.responsables.obtener(responsableId);
  }

  async crear(dto: CrearEquipoDto): Promise<EquipoRespuestaDto> {
    if (dto.codigoInterno) await this.validarCodigoLibre(dto.codigoInterno);
    if (dto.responsableId) await this.validarResponsableExiste(dto.responsableId);

    const estado =
      dto.estado ?? (dto.responsableId ? EstadoEquipoIT.EN_USO : EstadoEquipoIT.EN_DEPOSITO);
    this.validarBajaSinTenedor(estado, dto.responsableId);

    const creado = await this.repo.crear({
      codigoInterno: dto.codigoInterno,
      tipoId: dto.tipoId,
      estado,
      marcaId: dto.marcaId,
      modeloId: dto.modeloId,
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
      ubicacionId: dto.ubicacionId,
      fechaCompra: dto.fechaCompra ? new Date(dto.fechaCompra) : undefined,
      garantiaHasta: dto.garantiaHasta ? new Date(dto.garantiaHasta) : undefined,
      notas: dto.notas,
      proveedorId: dto.proveedorId,
      responsableId: dto.responsableId,
    });

    // Si nace a cargo de alguien, el historial arranca con ese tramo.
    if (dto.responsableId) {
      await this.repo.reasignar({
        equipoId: creado.id,
        responsableId: dto.responsableId,
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
      responsableId: query.responsableId,
      marcaId: query.marcaId,
      ubicacionId: query.ubicacionId,
      sinResponsable: query.sinResponsable === 'true',
      sinQr: query.sinQr === 'true',
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

  /**
   * Deja constancia de que a estos equipos se les imprimió la etiqueta QR.
   *
   * El reloj lo pone el service y no la pantalla: la fecha tiene que ser la del
   * servidor, no la de la máquina desde la que se imprimió.
   */
  async marcarQrGenerado(ids: string[]): Promise<number> {
    return this.repo.marcarQrGenerado(ids, new Date());
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
    this.validarBajaSinTenedor(estado, actual.responsableId);

    const actualizado = await this.repo.actualizar(id, {
      codigoInterno: dto.codigoInterno,
      tipoId: dto.tipoId,
      estado: dto.estado,
      marcaId: dto.marcaId,
      modeloId: dto.modeloId,
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
      ubicacionId: dto.ubicacionId,
      fechaCompra: dto.fechaCompra ? new Date(dto.fechaCompra) : undefined,
      garantiaHasta: dto.garantiaHasta ? new Date(dto.garantiaHasta) : undefined,
      notas: dto.notas,
      proveedorId: dto.proveedorId,
    });

    return EquipoRespuestaDto.desde(actualizado);
  }

  /**
   * Pone el equipo a cargo de un responsable, o lo devuelve a depósito
   * (`responsableId` en null). Deja el tramo anterior cerrado en el historial.
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

    const responsableId = dto.responsableId ?? null;
    if (responsableId) await this.validarResponsableExiste(responsableId);

    if (equipo.responsableId === responsableId) {
      throw new BadRequestException(
        responsableId
          ? 'El equipo ya está a cargo de esa persona.'
          : 'El equipo ya está en depósito.',
      );
    }

    // Entregarlo lo pone EN_USO; devolverlo, EN_DEPOSITO. Si estaba en
    // reparación, se respeta ese estado (volvió del service, no cambió de mano).
    const estadoResultante = responsableId ? EstadoEquipoIT.EN_USO : EstadoEquipoIT.EN_DEPOSITO;

    const actualizado = await this.repo.reasignar({
      equipoId: id,
      responsableId,
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

  async eliminar(id: string): Promise<void> {
    const equipo = await this.repo.buscarPorId(id);
    if (!equipo) {
      throw new NotFoundException(`No existe el equipo con id ${id}`);
    }
    if (equipo.responsableId) {
      throw new BadRequestException(
        'No se puede eliminar un equipo que está a cargo de alguien. Devolvelo a depósito primero.',
      );
    }
    await this.repo.eliminar(id);
  }
}
