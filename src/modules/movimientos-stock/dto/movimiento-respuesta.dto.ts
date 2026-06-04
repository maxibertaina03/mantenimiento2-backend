import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MotivoMovimiento, MovimientoStock, TipoMovimiento } from '@prisma/client';

export class MovimientoRespuestaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  materialId!: string;

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

  @ApiProperty()
  creadoEn!: Date;

  static desde(m: MovimientoStock): MovimientoRespuestaDto {
    return {
      id: m.id,
      materialId: m.materialId,
      tipo: m.tipo,
      motivo: m.motivo,
      cantidad: Number(m.cantidad),
      fecha: m.fecha,
      proveedorId: m.proveedorId,
      usuarioId: m.usuarioId,
      referenciaTrabajo: m.referenciaTrabajo,
      notas: m.notas,
      creadoEn: m.creadoEn,
    };
  }
}
