import { ApiPropertyOptional } from '@nestjs/swagger';
import { MotivoMovimiento, TipoMovimiento } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/**
 * Filtros del listado de movimientos. Extiende la paginación.
 */
export class FiltrarMovimientosDto extends PaginacionDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por material' })
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @ApiPropertyOptional({ enum: TipoMovimiento })
  @IsOptional()
  @IsEnum(TipoMovimiento)
  tipo?: TipoMovimiento;

  @ApiPropertyOptional({ enum: MotivoMovimiento })
  @IsOptional()
  @IsEnum(MotivoMovimiento)
  motivo?: MotivoMovimiento;

  @ApiPropertyOptional({ description: 'Fecha desde (ISO 8601, inclusive)' })
  @IsOptional()
  @IsISO8601()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (ISO 8601, inclusive)' })
  @IsOptional()
  @IsISO8601()
  fechaHasta?: string;
}
