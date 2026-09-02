import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  EJECUTORES,
  Ejecutor,
  TIPOS_INTERVENCION,
  TipoIntervencion,
} from '../dominio/intervencion';

/**
 * El DTO valida la FORMA. Las reglas —que un equipo de baja no reciba
 * intervenciones, que interno lleve usuario y externo lleve proveedor, que la
 * fecha no sea futura— son del dominio, y por eso valen también para cualquier
 * carga que no entre por HTTP.
 */
export class RegistrarIntervencionDto {
  @ApiProperty({ enum: TIPOS_INTERVENCION })
  @IsIn(TIPOS_INTERVENCION)
  tipo!: TipoIntervencion;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  fecha!: string;

  @ApiProperty({ enum: EJECUTORES })
  @IsIn(EJECUTORES)
  ejecutor!: Ejecutor;

  @ApiPropertyOptional({ format: 'uuid', description: 'Quién lo hizo, si fue en fábrica' })
  @IsOptional()
  @IsUUID()
  usuarioId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Quién lo hizo, si fue un tercero' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string | null;

  @ApiProperty({ example: 'Se cambió la correa y se ajustó la tensión' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  descripcion!: string;

  @ApiPropertyOptional({ example: 47000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoManoObra?: number | null;

  @ApiPropertyOptional({ example: 3.5, description: 'Cuántas horas estuvo parado el equipo' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  horasParada?: number | null;

  @ApiPropertyOptional({ description: 'Remito, factura o informe del service' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentoUrl?: string | null;
}
