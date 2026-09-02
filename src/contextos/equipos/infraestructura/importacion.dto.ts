import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Una fila ya revisada en la pantalla de importación. */
export class FilaImportacionDto {
  @ApiProperty({ example: 'Bomba caldera 1' })
  @IsString()
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({ example: 'Caldera' })
  @IsString()
  @MaxLength(60)
  ubicacion!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string | null;
}

export class ImportarEquiposDto {
  @ApiProperty({ type: [FilaImportacionDto] })
  @IsArray()
  // 1000 con margen sobre los 389 detectados hoy. Sin tope, una request podría
  // tumbar el proceso en el plan gratuito de Render.
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => FilaImportacionDto)
  filas!: FilaImportacionDto[];
}
