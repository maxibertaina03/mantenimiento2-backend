import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoriaMaterial, Material, UnidadMedida } from '@prisma/client';

type MaterialConRelaciones = Material & {
  categoria?: CategoriaMaterial | null;
  unidad?: UnidadMedida | null;
};

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

  @ApiPropertyOptional({ description: 'Id de la unidad de medida', nullable: true })
  unidadId!: string | null;

  @ApiPropertyOptional({ description: 'Nombre de la unidad', example: 'Unidad', nullable: true })
  unidadNombre!: string | null;

  // Se sigue exponiendo un `unidad` plano con el símbolo: es lo que se muestra
  // al lado de cada cantidad en las pantallas, el PDF y los mensajes. Ahora sale
  // del catálogo en vez de ser texto libre.
  @ApiProperty({ description: 'Símbolo de la unidad, o "" si no tiene', example: 'u' })
  unidad!: string;

  @ApiProperty({ example: 450 })
  stockActual!: number;

  @ApiProperty({ example: 100 })
  stockMinimo!: number;

  @ApiProperty({ description: 'true si stockActual <= stockMinimo', example: false })
  bajoStock!: boolean;

  @ApiProperty({
    description: 'false = jubilado: conserva su historial pero no se ofrece al cargar',
    example: true,
  })
  activo!: boolean;

  @ApiPropertyOptional({ nullable: true })
  notas!: string | null;

  @ApiProperty()
  creadoEn!: Date;

  @ApiProperty()
  actualizadoEn!: Date;

  static desde(m: MaterialConRelaciones): MaterialRespuestaDto {
    const stockActual = Number(m.stockActual);
    const stockMinimo = Number(m.stockMinimo);
    return {
      id: m.id,
      nombre: m.nombre,
      categoriaId: m.categoriaId,
      categoriaNombre: m.categoria?.nombre ?? null,
      unidadId: m.unidadId,
      unidadNombre: m.unidad?.nombre ?? null,
      unidad: m.unidad?.simbolo ?? '',
      stockActual,
      stockMinimo,
      // Solo se marca bajo stock si hay un mínimo definido (> 0).
      bajoStock: stockMinimo > 0 && stockActual <= stockMinimo,
      activo: m.activo,
      notas: m.notas,
      creadoEn: m.creadoEn,
      actualizadoEn: m.actualizadoEn,
    };
  }
}
