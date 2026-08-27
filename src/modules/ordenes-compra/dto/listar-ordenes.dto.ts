import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoOrdenCompra } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

export class ListarOrdenesDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por número de orden o nombre de proveedor' })
  @IsOptional()
  @IsString()
  buscar?: string;

  @ApiPropertyOptional({ enum: EstadoOrdenCompra })
  @IsOptional()
  @IsEnum(EstadoOrdenCompra)
  estado?: EstadoOrdenCompra;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ description: 'Fecha desde (ISO 8601, inclusive)' })
  @IsOptional()
  @IsISO8601()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (ISO 8601, inclusive)' })
  @IsOptional()
  @IsISO8601()
  fechaHasta?: string;
}
