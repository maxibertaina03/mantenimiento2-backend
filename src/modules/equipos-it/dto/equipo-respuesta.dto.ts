import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AsignacionEquipoIT,
  EquipoIT,
  EstadoEquipoIT,
  TipoAccesoRemoto,
  TipoDisco,
  TipoEquipoIT,
} from '@prisma/client';

export type EquipoConRelaciones = EquipoIT & {
  proveedor?: { nombre: string } | null;
  asignadoA?: { nombre: string } | null;
};

export type AsignacionConRelaciones = AsignacionEquipoIT & {
  usuario?: { nombre: string } | null;
  registradoPor?: { nombre: string } | null;
};

export class EquipoRespuestaDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) codigoInterno!: string | null;
  @ApiProperty({ enum: TipoEquipoIT }) tipo!: TipoEquipoIT;
  @ApiProperty({ enum: EstadoEquipoIT }) estado!: EstadoEquipoIT;

  @ApiProperty() marca!: string;
  @ApiProperty() modelo!: string;
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

  @ApiPropertyOptional({ nullable: true }) ubicacion!: string | null;

  @ApiPropertyOptional({ nullable: true }) proveedorId!: string | null;
  @ApiPropertyOptional({ nullable: true }) proveedorNombre!: string | null;
  @ApiPropertyOptional({ nullable: true }) fechaCompra!: Date | null;
  @ApiPropertyOptional({ nullable: true }) garantiaHasta!: Date | null;

  @ApiProperty({ description: 'true si la garantía ya venció' })
  garantiaVencida!: boolean;

  @ApiPropertyOptional({ nullable: true }) notas!: string | null;

  @ApiPropertyOptional({ nullable: true }) asignadoAId!: string | null;
  @ApiPropertyOptional({ nullable: true }) asignadoANombre!: string | null;

  @ApiProperty() creadoEn!: Date;

  static desde(e: EquipoConRelaciones): EquipoRespuestaDto {
    return {
      id: e.id,
      codigoInterno: e.codigoInterno,
      tipo: e.tipo,
      estado: e.estado,
      marca: e.marca,
      modelo: e.modelo,
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
      ubicacion: e.ubicacion,
      proveedorId: e.proveedorId,
      proveedorNombre: e.proveedor?.nombre ?? null,
      fechaCompra: e.fechaCompra,
      garantiaHasta: e.garantiaHasta,
      // Se calcula acá para que la UI no tenga que repetir la regla.
      garantiaVencida: e.garantiaHasta ? e.garantiaHasta.getTime() < Date.now() : false,
      notas: e.notas,
      asignadoAId: e.asignadoAId,
      asignadoANombre: e.asignadoA?.nombre ?? null,
      creadoEn: e.creadoEn,
    };
  }
}

/** Un tramo del historial: quién tuvo el equipo y en qué período. */
export class AsignacionRespuestaDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) usuarioId!: string | null;
  @ApiPropertyOptional({ description: 'null = depósito', nullable: true })
  usuarioNombre!: string | null;
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
      usuarioId: a.usuarioId,
      usuarioNombre: a.usuario?.nombre ?? null,
      registradoPorNombre: a.registradoPor?.nombre ?? null,
      desde: a.desde,
      hasta: a.hasta,
      motivo: a.motivo,
      notas: a.notas,
      vigente: a.hasta === null,
    };
  }
}
