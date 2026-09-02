import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
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
import { PaginacionDto } from '../../../common/dto/paginacion.dto';
import { CRITICIDADES, Criticidad } from '../dominio/equipo';
import { ESTADOS_EQUIPO, EstadoEquipo } from '../dominio/estado-equipo';

/**
 * Los DTO validan la FORMA de lo que entra (que sea un texto, un uuid, una
 * fecha). Las REGLAS —que el nombre no esté vacío, que el código no se repita,
 * que un equipo de baja no vuelva— son del dominio.
 *
 * La diferencia importa: si las reglas vivieran acá, probarlas exigiría montar
 * el pipe de validación de Nest, y no valdrían para nada que no entre por HTTP
 * (una importación masiva, por ejemplo).
 */
export class CrearEquipoDto {
  @ApiProperty({ example: 'Compresor 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ example: 'COMP-01' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  codigoInterno?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) marca?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) modelo?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) numeroSerie?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ubicacionId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tipoId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string | null;

  @ApiPropertyOptional({ enum: CRITICIDADES })
  @IsOptional()
  @IsIn(CRITICIDADES)
  criticidad?: Criticidad;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fotoUrl?: string | null;

  @ApiPropertyOptional({ example: 1250.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  horasUso?: number | null;

  @ApiPropertyOptional({ example: '2024-03-15' })
  @IsOptional()
  @IsDateString()
  fechaAlta?: string | null;

  @ApiPropertyOptional({ example: '2027-03-15' })
  @IsOptional()
  @IsDateString()
  garantiaHasta?: string | null;
}

export class ActualizarEquipoDto extends PartialType(CrearEquipoDto) {
  @ApiPropertyOptional({ enum: ESTADOS_EQUIPO })
  @IsOptional()
  @IsIn(ESTADOS_EQUIPO)
  estado?: EstadoEquipo;
}

export const ORDENES_EQUIPO = ['nombre', 'codigo', 'ubicacion', 'criticidad'] as const;

export class ListarEquiposDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o por código interno' })
  @IsOptional()
  @IsString()
  buscar?: string;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() ubicacionId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() tipoId?: string;

  @ApiPropertyOptional({ enum: ESTADOS_EQUIPO })
  @IsOptional()
  @IsIn(ESTADOS_EQUIPO)
  estado?: EstadoEquipo;

  @ApiPropertyOptional({ enum: CRITICIDADES })
  @IsOptional()
  @IsIn(CRITICIDADES)
  criticidad?: Criticidad;

  @ApiPropertyOptional({ description: 'Solo los que ya no están en garantía' })
  @IsOptional()
  @IsIn(['true', 'false'])
  garantiaVencida?: string;

  @ApiPropertyOptional({ enum: ORDENES_EQUIPO })
  @IsOptional()
  @IsIn(ORDENES_EQUIPO)
  ordenarPor?: (typeof ORDENES_EQUIPO)[number];

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  direccion?: 'asc' | 'desc';
}
