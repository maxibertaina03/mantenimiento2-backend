import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MotivoMovimiento, TipoMovimiento } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CrearMovimientoDto {
  @ApiProperty({ description: 'Material afectado', format: 'uuid' })
  @IsUUID()
  materialId!: string;

  @ApiProperty({
    enum: TipoMovimiento,
    description: 'ENTRADA suma, SALIDA resta, AJUSTE fija el stock al valor de `cantidad`',
  })
  @IsEnum(TipoMovimiento)
  tipo!: TipoMovimiento;

  @ApiProperty({ enum: MotivoMovimiento })
  @IsEnum(MotivoMovimiento)
  motivo!: MotivoMovimiento;

  @ApiProperty({
    description: 'Siempre positiva. ENTRADA/SALIDA = delta; AJUSTE = nuevo stock absoluto',
    example: 50,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  cantidad!: number;

  @ApiPropertyOptional({ description: 'Fecha del movimiento (ISO 8601). Por defecto: ahora' })
  @IsOptional()
  @IsISO8601()
  fecha?: string;

  @ApiPropertyOptional({ description: 'Proveedor (se usa con motivo COMPRA)', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ description: 'Usuario que registra el movimiento', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiPropertyOptional({ description: 'Referencia de trabajo (OT, etc.)', example: 'OT-1001' })
  @IsOptional()
  @IsString()
  referenciaTrabajo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
