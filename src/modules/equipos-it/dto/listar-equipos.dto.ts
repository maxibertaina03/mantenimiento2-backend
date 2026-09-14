import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoEquipoIT } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Filtros del listado de equipos IT. */
export class ListarEquiposDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca en código, marca, modelo, serie, IP y nombre de red' })
  @IsOptional()
  @IsString()
  buscar?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo del catálogo', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tipoId?: string;

  @ApiPropertyOptional({ enum: EstadoEquipoIT })
  @IsOptional()
  @IsEnum(EstadoEquipoIT)
  estado?: EstadoEquipoIT;

  @ApiPropertyOptional({ description: 'Equipos a cargo de este responsable', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por marca del catálogo', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  marcaId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ubicación del catálogo', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ubicacionId?: string;

  @ApiPropertyOptional({
    description: 'Solo los que no tienen responsable. Gana sobre `responsableId`.',
  })
  @IsOptional()
  @IsString()
  sinResponsable?: string;
}
