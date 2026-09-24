import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AsignacionEquipoIT,
  EquipoIT,
  EstadoEquipoIT,
  TipoAccesoRemoto,
  TipoDisco,
} from '@prisma/client';

export type EquipoConRelaciones = EquipoIT & {
  tipo?: { nombre: string; llevaEspecificaciones: boolean } | null;
  proveedor?: { nombre: string } | null;
  marca?: { nombre: string } | null;
  modelo?: { nombre: string } | null;
  ubicacion?: { nombre: string } | null;
  responsable?: { nombre: string; activo?: boolean } | null;
};

export type AsignacionConRelaciones = AsignacionEquipoIT & {
  responsable?: { nombre: string } | null;
  registradoPor?: { nombre: string } | null;
};

export class EquipoRespuestaDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) codigoInterno!: string | null;
  @ApiProperty() tipoId!: string;
  @ApiPropertyOptional({ nullable: true }) tipoNombre!: string | null;
  @ApiProperty({ description: 'Si el formulario debe pedir procesador, RAM y disco' })
  llevaEspecificaciones!: boolean;
  @ApiProperty({ enum: EstadoEquipoIT }) estado!: EstadoEquipoIT;

  /** Cuándo se imprimió la etiqueta QR. `null` si todavía no se imprimió. */
  @ApiPropertyOptional({ nullable: true }) qrGeneradoEn!: Date | null;

  // Marca, modelo y ubicación salen de catálogos. Se devuelve el id, para el
  // desplegable, y el nombre, para mostrarlo sin una consulta más.
  @ApiPropertyOptional({ nullable: true }) marcaId!: string | null;
  @ApiPropertyOptional({ nullable: true }) marcaNombre!: string | null;
  @ApiPropertyOptional({ nullable: true }) modeloId!: string | null;
  @ApiPropertyOptional({ nullable: true }) modeloNombre!: string | null;
  @ApiPropertyOptional({ nullable: true }) numeroSerie!: string | null;

  @ApiPropertyOptional({ nullable: true }) procesador!: string | null;
  @ApiPropertyOptional({ nullable: true }) memoriaRamGb!: number | null;
  @ApiPropertyOptional({ enum: TipoDisco, nullable: true }) discoTipo!: TipoDisco | null;
  @ApiPropertyOptional({ nullable: true }) discoCapacidadGb!: number | null;
  @ApiPropertyOptional({ nullable: true }) sistemaOperativo!: string | null;

  @ApiPropertyOptional({ nullable: true }) direccionIp!: string | null;
  @ApiPropertyOptional({ nullable: true }) direccionMac!: string | null;
  @ApiPropertyOptional({ nullable: true }) nombreEnRed!: string | null;
  @ApiProperty({ enum: TipoAccesoRemoto }) accesoRemoto!: TipoAccesoRemoto;
  @ApiPropertyOptional({ nullable: true }) accesoRemotoId!: string | null;

  @ApiPropertyOptional({ nullable: true }) ubicacionId!: string | null;
  @ApiPropertyOptional({ nullable: true }) ubicacionNombre!: string | null;

  @ApiPropertyOptional({ nullable: true }) proveedorId!: string | null;
  @ApiPropertyOptional({ nullable: true }) proveedorNombre!: string | null;
  @ApiPropertyOptional({ nullable: true }) fechaCompra!: Date | null;
  @ApiPropertyOptional({ nullable: true }) garantiaHasta!: Date | null;

  @ApiProperty({ description: 'true si la garantía ya venció' })
  garantiaVencida!: boolean;

  @ApiPropertyOptional({ nullable: true }) notas!: string | null;

  // Quién tiene el equipo. Es un responsable, no un usuario del sistema: ver
  // el modelo `Responsable` en el esquema.
  @ApiPropertyOptional({ nullable: true }) responsableId!: string | null;
  @ApiPropertyOptional({ nullable: true }) responsableNombre!: string | null;

  @ApiProperty() creadoEn!: Date;

  static desde(e: EquipoConRelaciones): EquipoRespuestaDto {
    return {
      id: e.id,
      codigoInterno: e.codigoInterno,
      tipoId: e.tipoId,
      tipoNombre: e.tipo?.nombre ?? null,
      llevaEspecificaciones: e.tipo?.llevaEspecificaciones ?? true,
      estado: e.estado,
      qrGeneradoEn: e.qrGeneradoEn,
      marcaId: e.marcaId,
      marcaNombre: e.marca?.nombre ?? null,
      modeloId: e.modeloId,
      modeloNombre: e.modelo?.nombre ?? null,
      numeroSerie: e.numeroSerie,
      procesador: e.procesador,
      memoriaRamGb: e.memoriaRamGb,
      discoTipo: e.discoTipo,
      discoCapacidadGb: e.discoCapacidadGb,
      sistemaOperativo: e.sistemaOperativo,
      direccionIp: e.direccionIp,
      direccionMac: e.direccionMac,
      nombreEnRed: e.nombreEnRed,
      accesoRemoto: e.accesoRemoto,
      accesoRemotoId: e.accesoRemotoId,
      ubicacionId: e.ubicacionId,
      ubicacionNombre: e.ubicacion?.nombre ?? null,
      proveedorId: e.proveedorId,
      proveedorNombre: e.proveedor?.nombre ?? null,
      fechaCompra: e.fechaCompra,
      garantiaHasta: e.garantiaHasta,
      // Se calcula acá para que la UI no tenga que repetir la regla.
      garantiaVencida: e.garantiaHasta ? e.garantiaHasta.getTime() < Date.now() : false,
      notas: e.notas,
      responsableId: e.responsableId,
      responsableNombre: e.responsable?.nombre ?? null,
      creadoEn: e.creadoEn,
    };
  }
}

/** Un tramo del historial: quién tuvo el equipo y en qué período. */
export class AsignacionRespuestaDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) responsableId!: string | null;
  @ApiPropertyOptional({ description: 'null = depósito', nullable: true })
  responsableNombre!: string | null;
  @ApiPropertyOptional({ nullable: true }) registradoPorNombre!: string | null;
  @ApiProperty() desde!: Date;
  @ApiPropertyOptional({ description: 'null = asignación vigente', nullable: true })
  hasta!: Date | null;
  @ApiPropertyOptional({ nullable: true }) motivo!: string | null;
  @ApiPropertyOptional({ nullable: true }) notas!: string | null;
  @ApiProperty({ description: 'true si es la asignación actual' }) vigente!: boolean;

  static desde(a: AsignacionConRelaciones): AsignacionRespuestaDto {
    return {
      id: a.id,
      responsableId: a.responsableId,
      responsableNombre: a.responsable?.nombre ?? null,
      registradoPorNombre: a.registradoPor?.nombre ?? null,
      desde: a.desde,
      hasta: a.hasta,
      motivo: a.motivo,
      notas: a.notas,
      vigente: a.hasta === null,
    };
  }
}
