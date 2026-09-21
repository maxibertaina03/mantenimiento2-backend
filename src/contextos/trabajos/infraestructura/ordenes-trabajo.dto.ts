import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ESTADOS_ORDEN_TRABAJO,
  EstadoOrdenTrabajo,
  TIPOS_TRABAJO,
  TipoTrabajo,
} from '../dominio/orden-trabajo';

/**
 * Los DTO validan la FORMA: que el tipo sea uno de los tres, que la cantidad
 * sea un número, que el título no venga vacío.
 *
 * Las reglas de verdad —no se cierra sin contar qué se hizo, no se cargan
 * materiales en una orden cerrada, no se anula una que ya movió stock— son del
 * dominio, y por eso valen igual para cualquier carga que no entre por HTTP.
 */
export class CrearOrdenTrabajoDto {
  @ApiProperty({ example: 'Perdida en la bomba de recibo' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo!: string;

  @ApiPropertyOptional({ example: 'Pierde por el sello mecanico desde el lunes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;

  @ApiProperty({ enum: TIPOS_TRABAJO })
  @IsIn(TIPOS_TRABAJO)
  tipo!: TipoTrabajo;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Sobre qué equipo. Opcional, y solo lo puede mandar quien tiene permiso de ver equipos.',
  })
  @IsOptional()
  @IsUUID()
  equipoId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'A quién se le asigna. Si no viene, queda para quien la abre.',
  })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string | null;
}

export class ReasignarOrdenTrabajoDto {
  @ApiProperty({ format: 'uuid', description: 'A quién pasa el trabajo.' })
  @IsUUID()
  asignadoAId!: string;
}

export class EditarOrdenTrabajoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;

  @ApiPropertyOptional({ enum: TIPOS_TRABAJO })
  @IsOptional()
  @IsIn(TIPOS_TRABAJO)
  tipo?: TipoTrabajo;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoId?: string | null;
}

export class CerrarOrdenTrabajoDto {
  @ApiProperty({
    example: 'Se cambio el sello mecanico y la junta de la tapa',
    description: 'Qué se hizo. Es lo que va a leer el próximo que agarre la máquina.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  resolucion!: string;
}

export class AnularOrdenTrabajoDto {
  @ApiProperty({ example: 'Se cargo duplicada' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  motivo!: string;
}

export class UsarMaterialDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  materialId!: string;

  @ApiProperty({ example: 2, description: 'Cuánto se usó. Sale del pañol de verdad.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  cantidad!: number;

  @ApiPropertyOptional({ example: 'Se uso uno de repuesto del pañol chico' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string | null;
}

export class ListarOrdenesTrabajoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar?: string;

  @ApiPropertyOptional({ enum: ESTADOS_ORDEN_TRABAJO })
  @IsOptional()
  @IsIn(ESTADOS_ORDEN_TRABAJO)
  estado?: EstadoOrdenTrabajo;

  @ApiPropertyOptional({ enum: TIPOS_TRABAJO })
  @IsOptional()
  @IsIn(TIPOS_TRABAJO)
  tipo?: TipoTrabajo;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo las de esa persona.' })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite?: number;
}
