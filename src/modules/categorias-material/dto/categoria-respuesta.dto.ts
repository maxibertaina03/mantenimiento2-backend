import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoriaMaterial } from '@prisma/client';

export class CategoriaRespuestaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiPropertyOptional({ nullable: true })
  descripcion!: string | null;

  static desde(c: CategoriaMaterial): CategoriaRespuestaDto {
    return { id: c.id, nombre: c.nombre, descripcion: c.descripcion };
  }
}
