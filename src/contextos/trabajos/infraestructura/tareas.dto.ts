import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { UsarMaterialDto } from './ordenes-trabajo.dto';

/**
 * Los DTO validan la FORMA. Las reglas —que una tarea la cierra quien la tiene
 * asignada, que una rutina no puede terminar antes de empezar— son del dominio.
 */
export class CrearTareaDto {
  @ApiProperty({ example: 'Revisar presion de caldera' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;

  @ApiProperty({ example: '2026-09-25', description: 'El día en que hay que hacerla.' })
  @IsDateString()
  fecha!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'A quién le toca. Vacío es sin repartir.' })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoId?: string | null;
}

export class AsignarTareaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  asignadoAId!: string;
}

export class CompletarTareaDto {
  @ApiProperty({ description: 'Qué se hizo. Va a la orden de trabajo que sale de esto.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  resolucion!: string;

  @ApiPropertyOptional({ type: [UsarMaterialDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UsarMaterialDto)
  materiales?: UsarMaterialDto[];

  @ApiPropertyOptional({ example: 45000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoManoObra?: number | null;

  @ApiPropertyOptional({ example: 3.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  horasParada?: number | null;
}

export class VerCalendarioDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  desde!: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString()
  hasta!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo las de esa persona.' })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoId?: string;

  @ApiPropertyOptional({ description: 'Solo lo que falta hacer.' })
  @IsOptional()
  @IsString()
  soloPendientes?: string;
}

export class CrearRutinaDto {
  @ApiProperty({ example: 'Revisar presion de caldera' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  titulo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string | null;

  @ApiProperty({ example: 1, description: 'Cada cuántos días. 1 es todos los días.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cadaDias!: number;

  @ApiProperty({ example: '2026-09-22' })
  @IsDateString()
  desde!: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Sin esto, para siempre.' })
  @IsOptional()
  @IsDateString()
  hasta?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'A quién le toca siempre.' })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string | null;
}

export class CambiarRutinaDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cadaDias?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hasta?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string | null;

  @ApiPropertyOptional({ description: 'Apagarla deja de generar tareas nuevas.' })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
