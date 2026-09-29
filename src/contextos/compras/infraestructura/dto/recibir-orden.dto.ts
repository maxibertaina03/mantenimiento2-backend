import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Marca la orden como recibida. Genera un movimiento de ENTRADA por cada
 * renglón, con la orden como referencia de trabajo.
 *
 * Exige el comprobante: sin número de remito o de factura no se puede cerrar la
 * orden. Es lo único que ata la entrada de stock al papel que quedó en la
 * empresa, y sin eso una diferencia de inventario no se puede reconstruir.
 * Cada campo por separado es opcional porque a veces llega uno y a veces el
 * otro; lo que no se acepta es que no venga ninguno.
 */
export class RecibirOrdenDto {
  @ApiPropertyOptional({
    description: 'Fecha real de recepción (ISO 8601). Por defecto: ahora.',
  })
  @IsOptional()
  @IsISO8601()
  fechaRecepcion?: string;

  @ApiPropertyOptional({
    description: 'Nº de remito del proveedor. Obligatorio si no viene el de factura.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  remito?: string;

  @ApiPropertyOptional({
    description: 'Nº de factura del proveedor. Obligatorio si no viene el de remito.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  factura?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
