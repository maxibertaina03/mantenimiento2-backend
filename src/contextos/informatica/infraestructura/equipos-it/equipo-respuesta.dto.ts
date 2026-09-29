import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoEquipoIT, TipoAccesoRemoto, TipoDisco } from '@prisma/client';
import { garantiaVencida } from '../../dominio/equipo-it';
import { AsignacionIt, EquipoItConRelaciones } from '../../puertos/repositorio-equipos-it';

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

  /**
   * Toma lo que devuelve el contexto, no una fila de Prisma.
   *
   * Los nombres de los catálogos ya vienen resueltos desde el repositorio.
   */
  static desde(e: EquipoItConRelaciones): EquipoRespuestaDto {
    return {
      ...e,
      estado: e.estado as EstadoEquipoIT,
      discoTipo: e.discoTipo as TipoDisco | null,
      accesoRemoto: e.accesoRemoto as TipoAccesoRemoto,
      // Se calcula acá para que la pantalla no tenga que repetir la regla.
      garantiaVencida: garantiaVencida(e.garantiaHasta, new Date()),
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

  static desde(a: AsignacionIt): AsignacionRespuestaDto {
    return { ...a, vigente: a.hasta === null };
  }
}
