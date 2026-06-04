import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearCategoriaDto {
  @ApiProperty({ example: 'Tornillería' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;

  @ApiPropertyOptional({ example: 'Tornillos, tuercas, arandelas y bulones' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
