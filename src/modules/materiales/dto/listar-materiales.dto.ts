import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Campos por los que se puede ordenar el listado. */
export const ORDENES_MATERIAL = ['nombre', 'stock', 'categoria', 'unidad'] as const;
export type OrdenMaterial = (typeof ORDENES_MATERIAL)[number];

/** Qué materiales trae el listado según estén en uso o jubilados. */
export const VISTAS_MATERIAL = ['activos', 'inactivos', 'todos'] as const;
export type VistaMaterial = (typeof VISTAS_MATERIAL)[number];

/** Filtros del listado de materiales. */
export class ListarMaterialesDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por nombre (contiene, sin distinguir mayúsculas)' })
  @IsOptional()
  @IsString()
  buscar?: string;

  @ApiPropertyOptional({ description: 'Filtra por categoría', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  @ApiPropertyOptional({ description: 'Filtra por unidad de medida', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({ description: 'Solo los que tienen AL MENOS este stock', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockMin?: number;

  @ApiPropertyOptional({ description: 'Solo los que tienen COMO MUCHO este stock', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockMax?: number;

  @ApiPropertyOptional({
    description: 'Solo los materiales que están en (o por debajo de) su stock mínimo',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  bajoStock?: string;

  @ApiPropertyOptional({
    description: 'Solo los materiales que todavía no tienen unidad cargada',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  sinUnidad?: string;

  @ApiPropertyOptional({
    enum: VISTAS_MATERIAL,
    default: 'activos',
    description:
      'Por defecto solo los que están en uso. Los desactivados conservan su ' +
      'historial y se pueden volver a mirar con "inactivos" o "todos".',
  })
  @IsOptional()
  @IsIn(VISTAS_MATERIAL)
  mostrar?: VistaMaterial;

  @ApiPropertyOptional({ enum: ORDENES_MATERIAL, default: 'nombre' })
  @IsOptional()
  @IsIn(ORDENES_MATERIAL)
  ordenarPor?: OrdenMaterial;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  direccion?: 'asc' | 'desc';
}
