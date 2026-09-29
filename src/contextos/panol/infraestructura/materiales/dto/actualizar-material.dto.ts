import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearMaterialDto } from './crear-material.dto';

/**
 * No incluye stockActual a propósito: el stock NO se edita a mano,
 * se modifica exclusivamente registrando movimientos (trazabilidad).
 * Para corregir el stock usar un movimiento de tipo AJUSTE.
 */
export class ActualizarMaterialDto extends PartialType(CrearMaterialDto) {
  @ApiPropertyOptional({
    description:
      'false saca el material de circulación sin borrarlo: deja de ofrecerse al ' +
      'cargar movimientos y órdenes, pero conserva su historial.',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
