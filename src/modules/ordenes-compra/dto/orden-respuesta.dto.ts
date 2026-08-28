import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoOrdenCompra, OrdenCompra, RenglonOrdenCompra } from '@prisma/client';
import { aNumero } from '../../../common/dominio/decimal';

export type RenglonConRelaciones = RenglonOrdenCompra & {
  material?: { nombre: string; unidad: string } | null;
};

export type OrdenConRelaciones = OrdenCompra & {
  proveedor?: {
    nombre: string;
    cuit: string | null;
    email: string | null;
    telefono: string | null;
  } | null;
  creadoPor?: { nombre: string } | null;
  recibidaPor?: { nombre: string } | null;
  renglones?: RenglonConRelaciones[];
};

export class RenglonRespuestaDto {
  @ApiProperty() id!: string;
  @ApiProperty() materialId!: string;
  @ApiPropertyOptional({ nullable: true }) materialNombre!: string | null;
  @ApiPropertyOptional({ nullable: true }) unidad!: string | null;
  @ApiProperty({ example: 100 }) cantidad!: number;
  @ApiPropertyOptional({ nullable: true, example: 1250.5 }) precioUnitario!: number | null;
  @ApiPropertyOptional({ description: 'cantidad × precioUnitario', nullable: true })
  subtotal!: number | null;
  @ApiPropertyOptional({ nullable: true }) notas!: string | null;
  @ApiPropertyOptional({
    description: 'Movimiento de stock generado al recibir la orden',
    nullable: true,
  })
  movimientoId!: string | null;

  static desde(r: RenglonConRelaciones): RenglonRespuestaDto {
    const cantidad = aNumero(r.cantidad);
    const precioUnitario = r.precioUnitario === null ? null : aNumero(r.precioUnitario);
    return {
      id: r.id,
      materialId: r.materialId,
      materialNombre: r.material?.nombre ?? null,
      unidad: r.material?.unidad ?? null,
      cantidad,
      precioUnitario,
      subtotal: precioUnitario === null ? null : Number((cantidad * precioUnitario).toFixed(2)),
      notas: r.notas,
      movimientoId: r.movimientoId,
    };
  }
}

export class OrdenRespuestaDto {
  @ApiProperty({ example: 'OC-2026-0001' }) numero!: string;
  @ApiProperty() id!: string;
  @ApiProperty({ enum: EstadoOrdenCompra }) estado!: EstadoOrdenCompra;

  @ApiProperty() proveedorId!: string;
  @ApiPropertyOptional({ nullable: true }) proveedorNombre!: string | null;
  @ApiPropertyOptional({ nullable: true }) proveedorCuit!: string | null;
  @ApiPropertyOptional({ description: 'Para enviarle la orden', nullable: true })
  proveedorEmail!: string | null;
  @ApiPropertyOptional({ description: 'Para enviarle la orden por WhatsApp', nullable: true })
  proveedorTelefono!: string | null;

  @ApiProperty() fecha!: Date;
  @ApiPropertyOptional({ nullable: true }) observaciones!: string | null;

  @ApiPropertyOptional({ nullable: true }) creadoPorNombre!: string | null;
  @ApiPropertyOptional({ nullable: true }) emitidaEn!: Date | null;
  @ApiPropertyOptional({ nullable: true }) recibidaEn!: Date | null;
  @ApiPropertyOptional({ nullable: true }) recibidaPorNombre!: string | null;

  @ApiProperty({ type: [RenglonRespuestaDto] }) renglones!: RenglonRespuestaDto[];

  @ApiPropertyOptional({
    description: 'Suma de los subtotales. null si algún renglón no tiene precio.',
    nullable: true,
  })
  total!: number | null;

  @ApiProperty({ description: 'true si todavía se puede editar (está en BORRADOR)' })
  editable!: boolean;

  @ApiProperty() creadoEn!: Date;

  static desde(o: OrdenConRelaciones): OrdenRespuestaDto {
    const renglones = (o.renglones ?? []).map(RenglonRespuestaDto.desde);
    // Si falta algún precio, el total no es confiable: mejor null que un número
    // que parece completo pero deja renglones afuera.
    const faltaPrecio = renglones.some((r) => r.precioUnitario === null);
    const total = faltaPrecio
      ? null
      : Number(renglones.reduce((suma, r) => suma + (r.subtotal ?? 0), 0).toFixed(2));

    return {
      id: o.id,
      numero: o.numero,
      estado: o.estado,
      proveedorId: o.proveedorId,
      proveedorNombre: o.proveedor?.nombre ?? null,
      proveedorCuit: o.proveedor?.cuit ?? null,
      proveedorEmail: o.proveedor?.email ?? null,
      proveedorTelefono: o.proveedor?.telefono ?? null,
      fecha: o.fecha,
      observaciones: o.observaciones,
      creadoPorNombre: o.creadoPor?.nombre ?? null,
      emitidaEn: o.emitidaEn,
      recibidaEn: o.recibidaEn,
      recibidaPorNombre: o.recibidaPor?.nombre ?? null,
      renglones,
      total,
      editable: o.estado === EstadoOrdenCompra.BORRADOR,
      creadoEn: o.creadoEn,
    };
  }
}
