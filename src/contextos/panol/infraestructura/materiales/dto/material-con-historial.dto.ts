import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MotivoMovimiento, TipoMovimiento } from '@prisma/client';
import type {
  MaterialConHistorial,
  MovimientoDelHistorial,
} from '../../../puertos/repositorio-materiales';
import { MaterialRespuestaDto } from './material-respuesta.dto';

/**
 * Ítem de historial: forma resumida de un movimiento para mostrar dentro del material.
 * Separada del DTO de movimientos para no acoplar la ficha del material a él.
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

  static desde(m: MovimientoDelHistorial): HistorialMovimientoDto {
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

/**
 * Material con su historial completo de movimientos (orden cronológico descendente).
 */
export class MaterialConHistorialDto extends MaterialRespuestaDto {
  @ApiProperty({ type: [HistorialMovimientoDto] })
  movimientos!: HistorialMovimientoDto[];

  static desdeMaterial(m: MaterialConHistorial): MaterialConHistorialDto {
    return {
      ...MaterialRespuestaDto.desde(m),
      movimientos: m.movimientos.map(HistorialMovimientoDto.desde),
    };
  }
}
