import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnidadMedida } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CrearUnidadMedidaDto {
  @ApiProperty({
    example: 'Litro',
    description: 'Nombre completo, el que se lee en el desplegable',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nombre!: string;

  @ApiProperty({ example: 'lt', description: 'Abreviatura que acompaña a las cantidades' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  simbolo!: string;

  @ApiPropertyOptional({ description: 'Orden en el listado', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({ description: 'Las inactivas no se ofrecen al cargar', default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarUnidadMedidaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  simbolo?: string;

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

export type UnidadConUso = UnidadMedida & { _count?: { materiales: number } };

export class UnidadMedidaRespuestaDto {
  @ApiProperty() id!: string;
  @ApiProperty() nombre!: string;
  @ApiProperty() simbolo!: string;
  @ApiProperty() orden!: number;
  @ApiProperty() activo!: boolean;
  @ApiProperty({ description: 'Cuántos materiales usan esta unidad' })
  materiales!: number;

  static desde(u: UnidadConUso): UnidadMedidaRespuestaDto {
    return {
      id: u.id,
      nombre: u.nombre,
      simbolo: u.simbolo,
      orden: u.orden,
      activo: u.activo,
      materiales: u._count?.materiales ?? 0,
    };
  }
}
