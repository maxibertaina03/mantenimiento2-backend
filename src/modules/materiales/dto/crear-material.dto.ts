import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CrearMaterialDto {
  @ApiProperty({ example: 'Tornillo autorroscante 6x40' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({ description: 'Id de la categoría', format: 'uuid' })
  @IsUUID()
  categoriaId!: string;

  // Obligatoria al crear, aunque en la base sea nullable: los materiales viejos
  // se importaron sin unidad y no hay valor honesto para inventarles, pero todo
  // lo que se cargue desde el sistema tiene que traerla.
  @ApiProperty({ description: 'Id de la unidad de medida', format: 'uuid' })
  @IsUUID()
  unidadId!: string;

  @ApiPropertyOptional({ description: 'Umbral de alerta de stock', example: 100, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockMinimo?: number;

  @ApiPropertyOptional({ example: 'Caja x 500' })
  @IsOptional()
  @IsString()
  notas?: string;
}
