import { PartialType } from '@nestjs/swagger';
import { CrearMaterialDto } from './crear-material.dto';

/**
 * No incluye stockActual a propósito: el stock NO se edita a mano,
 * se modifica exclusivamente registrando movimientos (trazabilidad).
 * Para corregir el stock usar un movimiento de tipo AJUSTE.
 */
export class ActualizarMaterialDto extends PartialType(CrearMaterialDto) {}
