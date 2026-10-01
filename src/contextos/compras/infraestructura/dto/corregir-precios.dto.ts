import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class PrecioRenglonDto {
  @ApiProperty({ format: 'uuid', description: 'El renglón de la orden' })
  @IsUUID()
  renglonId!: string;

  @ApiProperty({ description: 'Precio unitario', example: 1250.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioUnitario!: number;
}

/**
 * Cargar o corregir precios en una orden ya emitida o recibida.
 *
 * Solo precios: cantidades y materiales de una orden que salió no se tocan.
 */
export class CorregirPreciosDto {
  @ApiProperty({ type: [PrecioRenglonDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrecioRenglonDto)
  precios!: PrecioRenglonDto[];
}
