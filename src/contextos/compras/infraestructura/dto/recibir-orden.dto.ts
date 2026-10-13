import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Lo que llegó de un renglón en esta entrega. */
export class RenglonRecibidoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  renglonId!: string;

  @ApiProperty({ example: 10, description: '0 = no llegó nada de este renglón' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  cantidad!: number;
}

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

  @ApiPropertyOptional({
    type: [RenglonRecibidoDto],
    description:
      'Lo que llegó en esta entrega. Sin esto, llegó todo lo que faltaba (la recepción ' +
      'de siempre). Con esto, lo que no llega queda pendiente y la orden «Recibida en parte».',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RenglonRecibidoDto)
  renglones?: RenglonRecibidoDto[];
}

/** El proveedor no va a entregar el resto: la orden se cierra con lo que llegó. */
export class CerrarConFaltanteDto {
  @ApiProperty({ example: 'El proveedor no tiene stock del acrílico' })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo!: string;
}
