import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Pone un equipo a cargo de alguien, o lo devuelve a depósito si
 * `responsableId` viene en null. Cierra el tramo vigente y abre uno nuevo,
 * dejando historial.
 *
 * El responsable NO es un usuario del sistema: es quien tiene el equipo. Puede
 * ser una persona que nunca entra al sistema, o un sector entero.
 */
export class AsignarEquipoDto {
  @ApiProperty({
    description: 'Responsable que recibe el equipo. null = devolver a depósito.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  responsableId?: string | null;

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
