import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MotivoMovimiento, TipoMovimiento } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Edición de un movimiento (corrección por error o ajuste de carga).
 * Todos los campos del movimiento son opcionales, pero `motivoEdicion` es obligatorio:
 * queda registrado en la auditoría.
 */
export class ActualizarMovimientoDto {
  @ApiPropertyOptional({ enum: TipoMovimiento })
  @IsOptional()
  @IsEnum(TipoMovimiento)
  tipo?: TipoMovimiento;

  @ApiPropertyOptional({ enum: MotivoMovimiento })
  @IsOptional()
  @IsEnum(MotivoMovimiento)
  motivo?: MotivoMovimiento;

  @ApiPropertyOptional({ description: 'Siempre positiva', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  cantidad?: number;

  @ApiPropertyOptional({ description: 'Fecha del movimiento (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  fecha?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenciaTrabajo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiProperty({ description: 'Explicación OBLIGATORIA del cambio (queda en auditoría)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  motivoEdicion!: string;
}
