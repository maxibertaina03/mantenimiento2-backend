import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoriaMaterial, Material } from '@prisma/client';

type MaterialConCategoria = Material & { categoria?: CategoriaMaterial | null };

/**
 * DTO de salida del material. Convierte los Decimal de Prisma a number
 * y agrega el flag derivado `bajoStock`.
 */
export class MaterialRespuestaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  categoriaId!: string;

  @ApiPropertyOptional({ description: 'Nombre de la categoría', nullable: true })
  categoriaNombre!: string | null;

  @ApiProperty({ example: 'u' })
  unidad!: string;

  @ApiProperty({ example: 450 })
  stockActual!: number;

  @ApiProperty({ example: 100 })
  stockMinimo!: number;

  @ApiProperty({ description: 'true si stockActual <= stockMinimo', example: false })
  bajoStock!: boolean;

  @ApiPropertyOptional({ nullable: true })
  notas!: string | null;

  @ApiProperty()
  creadoEn!: Date;

  @ApiProperty()
  actualizadoEn!: Date;

  static desde(m: MaterialConCategoria): MaterialRespuestaDto {
    const stockActual = Number(m.stockActual);
    const stockMinimo = Number(m.stockMinimo);
    return {
      id: m.id,
      nombre: m.nombre,
      categoriaId: m.categoriaId,
      categoriaNombre: m.categoria?.nombre ?? null,
      unidad: m.unidad,
      stockActual,
      stockMinimo,
      bajoStock: stockActual <= stockMinimo,
      notas: m.notas,
      creadoEn: m.creadoEn,
      actualizadoEn: m.actualizadoEn,
    };
  }
}
