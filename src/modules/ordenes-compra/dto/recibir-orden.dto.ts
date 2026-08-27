import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Marca la orden como recibida. Genera un movimiento de ENTRADA por cada
 * renglón, con la orden como referencia de trabajo.
 */
export class RecibirOrdenDto {
  @ApiPropertyOptional({
    description: 'Fecha real de recepción (ISO 8601). Por defecto: ahora.',
  })
  @IsOptional()
  @IsISO8601()
  fechaRecepcion?: string;

  @ApiPropertyOptional({ description: 'Nº de remito del proveedor' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  remito?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
