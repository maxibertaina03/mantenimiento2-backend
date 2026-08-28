import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * Carga masiva de la unidad de medida.
 *
 * Los 831 materiales importados de los listados viejos vinieron sin unidad.
 * Asignarles una de a uno no es viable, así que esto pone una por defecto y
 * después se corrigen las que hagan falta desde la ficha de cada material.
 */
export class AsignarUnidadMasivaDto {
  @ApiProperty({ description: 'Unidad a asignar', format: 'uuid' })
  @IsUUID()
  unidadId!: string;

  @ApiPropertyOptional({
    description:
      'Si es false, pisa también la unidad de los materiales que ya tienen una. ' +
      'Por defecto solo completa los que no tienen, para no borrar trabajo hecho a mano.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  soloSinUnidad?: boolean;
}

export class ResultadoAsignacionDto {
  @ApiProperty({ description: 'Cuántos materiales quedaron con la unidad asignada' })
  actualizados!: number;

  @ApiProperty({ description: 'Cuántos siguen sin unidad después de la carga' })
  sinUnidad!: number;
}
