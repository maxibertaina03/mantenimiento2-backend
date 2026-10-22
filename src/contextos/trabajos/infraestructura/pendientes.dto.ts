import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { LARGO_MAXIMO_PENDIENTE } from '../dominio/pendiente';

export class ListarPendientesDto {
  @ApiPropertyOptional({ enum: ['abiertos', 'hechos'], default: 'abiertos' })
  @IsOptional()
  @IsIn(['abiertos', 'hechos'])
  estado?: 'abiertos' | 'hechos';
}

export class CrearPendienteDto {
  @ApiProperty({ example: 'Comprar rulemanes 6204 para la bomba 2' })
  @IsString()
  // El dominio da el mensaje claro; esto solo frena lo absurdo.
  @MaxLength(LARGO_MAXIMO_PENDIENTE * 2)
  texto!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  urgente?: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'A quién le toca. Vacío: a cualquiera.' })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Sobre qué equipo, si es sobre uno.' })
  @IsOptional()
  @IsUUID()
  equipoId?: string | null;
}

export class EditarPendienteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(LARGO_MAXIMO_PENDIENTE * 2)
  texto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  urgente?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  equipoId?: string | null;
}
