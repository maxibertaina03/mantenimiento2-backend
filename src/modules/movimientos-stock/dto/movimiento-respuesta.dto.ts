import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MotivoMovimiento, MovimientoStock, TipoMovimiento } from '@prisma/client';

/** Movimiento con sus relaciones (nombres) para listar/exportar. */
export type MovimientoConRelaciones = MovimientoStock & {
  material?: { nombre: string } | null;
  proveedor?: { nombre: string } | null;
  usuario?: { nombre: string } | null;
  _count?: { ediciones: number };
};

export class MovimientoRespuestaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  materialId!: string;

  @ApiPropertyOptional({ description: 'Nombre del material', nullable: true })
  materialNombre!: string | null;

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

  @ApiPropertyOptional({ description: 'Nombre del proveedor', nullable: true })
  proveedorNombre!: string | null;

  @ApiPropertyOptional({ nullable: true })
  usuarioId!: string | null;

  @ApiPropertyOptional({ description: 'Nombre del usuario que registró', nullable: true })
  usuarioNombre!: string | null;

  @ApiPropertyOptional({ nullable: true })
  referenciaTrabajo!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notas!: string | null;

  @ApiProperty()
  creadoEn!: Date;

  @ApiProperty({ description: 'true si el movimiento fue editado alguna vez' })
  editado!: boolean;

  static desde(m: MovimientoConRelaciones): MovimientoRespuestaDto {
    return {
      id: m.id,
      materialId: m.materialId,
      materialNombre: m.material?.nombre ?? null,
      tipo: m.tipo,
      motivo: m.motivo,
      cantidad: Number(m.cantidad),
      fecha: m.fecha,
      proveedorId: m.proveedorId,
      proveedorNombre: m.proveedor?.nombre ?? null,
      usuarioId: m.usuarioId,
      usuarioNombre: m.usuario?.nombre ?? null,
      referenciaTrabajo: m.referenciaTrabajo,
      notas: m.notas,
      creadoEn: m.creadoEn,
      editado: (m._count?.ediciones ?? 0) > 0,
    };
  }
}
