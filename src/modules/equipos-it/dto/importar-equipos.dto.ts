import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Una fila de la planilla, tal cual viene. Todo es texto: la normalización a
 * los enums del sistema la hace el backend (ver importacion/normalizar.ts),
 * para que las reglas de mapeo vivan en un solo lugar y estén testeadas.
 */
export class FilaImportacionDto {
  @ApiPropertyOptional({ description: 'Columna "Nombre del Equipo" (ej: PC1)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombreEquipo?: string;

  @ApiPropertyOptional({ description: 'Columna "Tipo de Equipo"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tipo?: string;

  @ApiPropertyOptional({ description: 'Columna "Modelo" (puede mezclar marca y modelo)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  modelo?: string;

  @ApiPropertyOptional({ description: 'Columna "Estado"' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  estado?: string;

  @ApiPropertyOptional({ description: 'Columna "Ubicación"' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ubicacion?: string;

  @ApiPropertyOptional({ description: 'Columna "Usuario Asignado"' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  asignadoA?: string;

  @ApiPropertyOptional({ description: 'Columna "Any desk"' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  accesoRemotoId?: string;

  @ApiPropertyOptional({ description: 'Notas libres' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;
}

export class ImportarEquiposDto {
  @ApiProperty({ type: [FilaImportacionDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'No hay filas para importar.' })
  // Tope defensivo: una planilla de inventario no tiene miles de filas, y un
  // envío enorme podría tumbar la instancia.
  @ArrayMaxSize(2000, { message: 'Son demasiadas filas para una sola importación.' })
  @ValidateNested({ each: true })
  @Type(() => FilaImportacionDto)
  filas!: FilaImportacionDto[];
}

/** Qué pasó con cada fila, para mostrarlo al terminar. */
export class ResultadoImportacionDto {
  @ApiProperty() creados!: number;
  @ApiProperty() actualizados!: number;
  @ApiProperty({ description: 'Filas con error: no se importó nada de ellas' })
  conError!: number;
  @ApiProperty({ description: 'Personas dadas de alta como usuarios sin acceso' })
  usuariosCreados!: string[];
  @ApiProperty({ description: 'Equipos cuya marca no se pudo reconocer' })
  revisarMarca!: string[];
  @ApiProperty({ type: [Object] })
  errores!: { fila: number; equipo: string; motivo: string }[];
}
