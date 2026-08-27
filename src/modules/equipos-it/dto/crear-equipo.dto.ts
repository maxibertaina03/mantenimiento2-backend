import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoEquipoIT, TipoAccesoRemoto, TipoDisco, TipoEquipoIT } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsIP,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Formato MAC: 6 pares hexadecimales separados por ":" o "-". */
const REGEX_MAC = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

export class CrearEquipoDto {
  @ApiPropertyOptional({
    description: 'Etiqueta de inventario pegada al equipo (única)',
    example: 'IT-0042',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  codigoInterno?: string;

  @ApiProperty({ enum: TipoEquipoIT })
  @IsEnum(TipoEquipoIT)
  tipo!: TipoEquipoIT;

  @ApiPropertyOptional({ enum: EstadoEquipoIT, default: EstadoEquipoIT.EN_DEPOSITO })
  @IsOptional()
  @IsEnum(EstadoEquipoIT)
  estado?: EstadoEquipoIT;

  @ApiProperty({ example: 'Dell' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  marca!: string;

  @ApiProperty({ example: 'OptiPlex 3080' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  modelo!: string;

  @ApiPropertyOptional({ example: 'SN-8F3K2P' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  numeroSerie?: string;

  // ── Especificaciones técnicas (opcionales: una cámara no tiene RAM) ──

  @ApiPropertyOptional({ example: 'Intel Core i5-10500' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  procesador?: string;

  @ApiPropertyOptional({ description: 'Memoria RAM en GB', example: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4096)
  memoriaRamGb?: number;

  @ApiPropertyOptional({ enum: TipoDisco })
  @IsOptional()
  @IsEnum(TipoDisco)
  discoTipo?: TipoDisco;

  @ApiPropertyOptional({ description: 'Capacidad del disco en GB', example: 512 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  discoCapacidadGb?: number;

  @ApiPropertyOptional({ example: 'Windows 11 Pro' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sistemaOperativo?: string;

  // ── Red y acceso remoto ──

  @ApiPropertyOptional({ example: '192.168.1.50' })
  @IsOptional()
  @IsIP()
  direccionIp?: string;

  @ApiPropertyOptional({ example: '00:1A:2B:3C:4D:5E' })
  @IsOptional()
  @Matches(REGEX_MAC, { message: 'direccionMac debe tener formato 00:1A:2B:3C:4D:5E' })
  direccionMac?: string;

  @ApiPropertyOptional({ description: 'Nombre del equipo en la red', example: 'PC-ADMIN-01' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nombreEnRed?: string;

  @ApiPropertyOptional({ enum: TipoAccesoRemoto, default: TipoAccesoRemoto.NINGUNO })
  @IsOptional()
  @IsEnum(TipoAccesoRemoto)
  accesoRemoto?: TipoAccesoRemoto;

  @ApiPropertyOptional({
    description: 'ID de AnyDesk / TeamViewer / host de RDP',
    example: '123 456 789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  accesoRemotoId?: string;

  @ApiPropertyOptional({ example: 'Oficina administración' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ubicacion?: string;

  // ── Compra y garantía ──

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ description: 'Fecha de compra (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  fechaCompra?: string;

  @ApiPropertyOptional({ description: 'Vencimiento de garantía (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  garantiaHasta?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;

  @ApiPropertyOptional({ description: 'Usuario al que se asigna el equipo', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  asignadoAId?: string;
}
