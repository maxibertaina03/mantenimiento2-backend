import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query params de paginación reutilizables por cualquier listado.
 */
export class PaginacionDto {
  @ApiPropertyOptional({ description: 'Página (1-based)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ description: 'Elementos por página', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;

  /** Offset calculado para Prisma (skip). */
  get skip(): number {
    return (this.pagina - 1) * this.limite;
  }
}

/**
 * Forma uniforme de respuesta paginada.
 */
export class RespuestaPaginada<T> {
  @ApiPropertyOptional()
  datos!: T[];

  @ApiPropertyOptional()
  total!: number;

  @ApiPropertyOptional()
  pagina!: number;

  @ApiPropertyOptional()
  limite!: number;
}
