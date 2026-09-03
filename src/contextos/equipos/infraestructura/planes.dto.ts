import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearPlanDto {
  @ApiProperty({ example: 'Cambio de aceite' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ example: 'Vaciar, cambiar filtro, cargar 5 lt de ISO 68' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tareas?: string | null;

  @ApiProperty({ example: 90, description: 'Cada cuántos días se repite' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodicidadDias!: number;

  @ApiProperty({ example: '2026-12-01', description: 'Cuándo toca la próxima vez' })
  @IsDateString()
  proximaFecha!: string;
}

export class ActualizarPlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) nombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) tareas?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodicidadDias?: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString() proximaFecha?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

/** El plan al que responde un trabajo, si responde a alguno. */
export class PlanDeIntervencionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  planId?: string | null;
}
