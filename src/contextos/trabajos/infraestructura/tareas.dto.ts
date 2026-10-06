import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { UsarMaterialDto } from './ordenes-trabajo.dto';
import { EJECUTORES, Ejecutor } from '../dominio/orden-trabajo';

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

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Sobre qué equipo de informática. Excluyente con equipoId.',
  })
  @IsOptional()
  @IsUUID()
  equipoItId?: string | null;
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

  @ApiPropertyOptional({ enum: EJECUTORES, default: 'INTERNO' })
  @IsOptional()
  @IsIn(EJECUTORES)
  ejecutor?: Ejecutor;

  @ApiPropertyOptional({ format: 'uuid', description: 'Obligatorio si lo hizo un externo' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string | null;
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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoItId?: string;

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

  @ApiPropertyOptional({
    example: [1, 2, 3, 4, 5],
    description: 'Días en que sale: 0 domingo … 6 sábado. Por defecto, lunes a viernes.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[];

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

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Sobre qué equipo de informática. Excluyente con equipoId.',
  })
  @IsOptional()
  @IsUUID()
  equipoItId?: string | null;

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

  @ApiPropertyOptional({
    example: [1, 2, 3, 4, 5],
    description: 'Días en que sale: 0 domingo … 6 sábado. Por defecto, lunes a viernes.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana?: number[];

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
