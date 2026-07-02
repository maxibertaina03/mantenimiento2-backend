import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Filtros del listado de materiales (paginación + búsqueda por nombre). */
export class ListarMaterialesDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca por nombre (contiene, sin distinguir mayúsculas)' })
  @IsOptional()
  @IsString()
  buscar?: string;
}
