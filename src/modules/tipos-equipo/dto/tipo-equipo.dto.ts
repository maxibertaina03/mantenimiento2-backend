import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoEquipo } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CrearTipoEquipoDto {
  @ApiProperty({ example: 'Cámara de seguridad' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Términos que reconoce la importación, separados por coma',
    example: 'camara de seguridad,camara',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  alias?: string;

  @ApiPropertyOptional({
    description: 'Si el formulario pide procesador, RAM y disco',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  llevaEspecificaciones?: boolean;

  @ApiPropertyOptional({ description: 'Orden en el listado', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({ description: 'Los inactivos no se ofrecen al cargar', default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarTipoEquipoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  alias?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  llevaEspecificaciones?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export type TipoConUso = TipoEquipo & { _count?: { equipos: number } };

export class TipoEquipoRespuestaDto {
  @ApiProperty() id!: string;
  @ApiProperty() nombre!: string;
  @ApiPropertyOptional({ nullable: true }) alias!: string | null;
  @ApiProperty() llevaEspecificaciones!: boolean;
  @ApiProperty() orden!: number;
  @ApiProperty() activo!: boolean;
  @ApiProperty({ description: 'Cuántos equipos usan este tipo' })
  equipos!: number;

  static desde(t: TipoConUso): TipoEquipoRespuestaDto {
    return {
      id: t.id,
      nombre: t.nombre,
      alias: t.alias,
      llevaEspecificaciones: t.llevaEspecificaciones,
      orden: t.orden,
      activo: t.activo,
      equipos: t._count?.equipos ?? 0,
    };
  }
}
