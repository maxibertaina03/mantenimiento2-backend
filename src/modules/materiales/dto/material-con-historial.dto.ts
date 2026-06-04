import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CategoriaMaterial,
  Material,
  MovimientoStock,
  MotivoMovimiento,
  TipoMovimiento,
} from '@prisma/client';
import { MaterialRespuestaDto } from './material-respuesta.dto';

/**
 * Ítem de historial: forma resumida de un movimiento para mostrar dentro del material.
 * Se mantiene local al módulo materiales para no acoplarlo al módulo de movimientos.
 */
export class HistorialMovimientoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: TipoMovimiento })
  tipo!: TipoMovimiento;

  @ApiProperty({ enum: MotivoMovimiento })
  motivo!: MotivoMovimiento;

  @ApiProperty({ example: 50 })
  cantidad!: number;

  @ApiProperty()
  fecha!: Date;

  @ApiPropertyOptional({ nullable: true })
  proveedorId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usuarioId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  referenciaTrabajo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notas!: string | null;

  static desde(m: MovimientoStock): HistorialMovimientoDto {
    return {
      id: m.id,
      tipo: m.tipo,
      motivo: m.motivo,
      cantidad: Number(m.cantidad),
      fecha: m.fecha,
      proveedorId: m.proveedorId,
      usuarioId: m.usuarioId,
      referenciaTrabajo: m.referenciaTrabajo,
      notas: m.notas,
    };
  }
}

type MaterialConRelaciones = Material & {
  categoria?: CategoriaMaterial | null;
  movimientos: MovimientoStock[];
};

/**
 * Material con su historial completo de movimientos (orden cronológico descendente).
 */
export class MaterialConHistorialDto extends MaterialRespuestaDto {
  @ApiProperty({ type: [HistorialMovimientoDto] })
  movimientos!: HistorialMovimientoDto[];

  static desdeMaterial(m: MaterialConRelaciones): MaterialConHistorialDto {
    return {
      ...MaterialRespuestaDto.desde(m),
      movimientos: m.movimientos.map(HistorialMovimientoDto.desde),
    };
  }
}
