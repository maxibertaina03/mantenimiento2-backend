import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoEquipoIT, TipoEquipoIT } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Filtros del listado de equipos IT. */
export class ListarEquiposDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca en código, marca, modelo, serie, IP y nombre de red' })
  @IsOptional()
  @IsString()
  buscar?: string;

  @ApiPropertyOptional({ enum: TipoEquipoIT })
  @IsOptional()
  @IsEnum(TipoEquipoIT)
  tipo?: TipoEquipoIT;

  @ApiPropertyOptional({ enum: EstadoEquipoIT })
  @IsOptional()
  @IsEnum(EstadoEquipoIT)
  estado?: EstadoEquipoIT;

  @ApiPropertyOptional({ description: 'Equipos asignados a este usuario', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string;
}
