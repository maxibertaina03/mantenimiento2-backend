import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RenglonOrdenDto {
  @ApiProperty({ description: 'Material que se pide', format: 'uuid' })
  @IsUUID()
  materialId!: string;

  @ApiProperty({ description: 'Cantidad a comprar (> 0)', example: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  cantidad!: number;

  @ApiPropertyOptional({ description: 'Precio unitario pactado', example: 1250.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioUnitario?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notas?: string;
}

export class CrearOrdenDto {
  @ApiProperty({ description: 'Proveedor al que se le compra', format: 'uuid' })
  @IsUUID()
  proveedorId!: string;

  @ApiPropertyOptional({ description: 'Observaciones que salen impresas en la orden' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  @ApiProperty({ type: [RenglonOrdenDto], description: 'Detalle de lo que se pide' })
  @IsArray()
  @ArrayMinSize(1, { message: 'La orden debe tener al menos un renglón.' })
  @ValidateNested({ each: true })
  @Type(() => RenglonOrdenDto)
  renglones!: RenglonOrdenDto[];
}
