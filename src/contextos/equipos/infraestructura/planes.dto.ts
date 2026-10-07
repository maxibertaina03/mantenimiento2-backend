import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
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

  @ApiPropertyOptional({
    example: [1, 2, 3, 4, 5],
    description: 'Días que se trabaja: 0 domingo … 6 sábado. Por defecto, lunes a viernes.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[];

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

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 5] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[];

  @ApiPropertyOptional() @IsOptional() @IsDateString() proximaFecha?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}
