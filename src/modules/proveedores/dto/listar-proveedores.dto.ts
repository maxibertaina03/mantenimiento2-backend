import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Filtros del listado de proveedores (paginación + búsqueda por nombre/CUIT). */
export class ListarProveedoresDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o CUIT (contiene, sin distinguir mayúsculas)' })
  @IsOptional()
  @IsString()
  buscar?: string;
}
