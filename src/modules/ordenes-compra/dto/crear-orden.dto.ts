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
  IsIn,
  ValidateNested,
} from 'class-validator';
import {
  CLASIFICACIONES_EQUIPO,
  ClasificacionEquipo,
} from '../../../common/dominio/renglon-de-compra';

export class RenglonOrdenDto {
  /**
   * Que material se pide. Vacio si el renglon es de un equipo.
   *
   * La regla de que sea uno O el otro vive en el dominio
   * (`common/dominio/renglon-de-compra`), no aca: el DTO comprueba formas, no
   * decide que tiene sentido comprar.
   */
  @ApiPropertyOptional({ description: 'Material que se pide', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @ApiPropertyOptional({
    description: 'Que equipo se compra, cuando el renglon no es de material',
    example: 'Amoladora angular 4 1/2',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcionEquipo?: string;

  @ApiPropertyOptional({
    enum: CLASIFICACIONES_EQUIPO,
    description: 'Si lo que se compra es una maquina o una herramienta',
  })
  @IsOptional()
  @IsIn(CLASIFICACIONES_EQUIPO)
  clasificacion?: ClasificacionEquipo;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoTipoId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoMarcaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoModeloId?: string;

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
