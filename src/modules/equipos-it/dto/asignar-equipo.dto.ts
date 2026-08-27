import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Asigna un equipo a un usuario, o lo devuelve a depósito si `usuarioId` viene
 * en null. Cierra la asignación vigente y abre una nueva, dejando historial.
 */
export class AsignarEquipoDto {
  @ApiProperty({
    description: 'Usuario que recibe el equipo. null = devolver a depósito.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  usuarioId?: string | null;

  @ApiPropertyOptional({
    description: 'Por qué se mueve el equipo',
    example: 'Ingreso de personal',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  motivo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}
