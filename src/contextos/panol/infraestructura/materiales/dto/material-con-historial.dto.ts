import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MotivoMovimiento, TipoMovimiento } from '@prisma/client';
import type { UltimoInventario } from '../../../dominio/ultimo-inventario';
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

/** La última vez que se contó el material: en una toma o con un ajuste a mano. */
export class UltimoInventarioDto {
  @ApiProperty({ enum: ['TOMA', 'AJUSTE'] })
  origen!: 'TOMA' | 'AJUSTE';

  @ApiProperty()
  fecha!: Date;

  @ApiProperty({ description: 'Cuánto se contó (o a cuánto se ajustó)', example: 12 })
  contado!: number;

  @ApiPropertyOptional({ description: 'Cuánto figuraba al contarlo (solo tomas)', nullable: true })
  figuraba!: number | null;

  @ApiPropertyOptional({ enum: ['AJUSTADO', 'SIN_DIFERENCIA'], nullable: true })
  resultado!: string | null;

  @ApiPropertyOptional({ nullable: true })
  tomaId!: string | null;

  @ApiPropertyOptional({ example: 'TI-2026-0001', nullable: true })
  tomaNumero!: string | null;

  @ApiPropertyOptional({ description: 'Quién lo contó o cargó el ajuste', nullable: true })
  porNombre!: string | null;

  static desde(u: UltimoInventario): UltimoInventarioDto {
    if (u.origen === 'TOMA') {
      return {
        origen: 'TOMA',
        fecha: u.fecha,
        contado: Number(u.contado),
        figuraba: u.figuraba === null ? null : Number(u.figuraba),
        resultado: u.resultado,
        tomaId: u.tomaId,
        tomaNumero: u.tomaNumero,
        porNombre: u.porNombre,
      };
    }
    return {
      origen: 'AJUSTE',
      fecha: u.fecha,
      contado: Number(u.cantidad),
      figuraba: null,
      resultado: null,
      tomaId: null,
      tomaNumero: null,
      porNombre: u.porNombre,
    };
  }
}

/**
 * Material con su historial completo de movimientos (orden cronológico descendente).
 */
export class MaterialConHistorialDto extends MaterialRespuestaDto {
  @ApiProperty({ type: [HistorialMovimientoDto] })
  movimientos!: HistorialMovimientoDto[];

  @ApiPropertyOptional({
    type: UltimoInventarioDto,
    nullable: true,
    description: 'La última vez que se lo contó. null = nunca.',
  })
  ultimoInventario!: UltimoInventarioDto | null;

  static desdeMaterial(
    m: MaterialConHistorial & { ultimoInventario: UltimoInventario | null },
  ): MaterialConHistorialDto {
    return {
      ...MaterialRespuestaDto.desde(m),
      movimientos: m.movimientos.map(HistorialMovimientoDto.desde),
      ultimoInventario: m.ultimoInventario ? UltimoInventarioDto.desde(m.ultimoInventario) : null,
    };
  }
}
