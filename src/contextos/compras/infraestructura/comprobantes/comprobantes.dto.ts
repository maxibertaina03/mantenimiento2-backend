import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoComprobante } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdjuntarComprobanteDto {
  @ApiProperty({ description: 'El archivo en base64. PDF o imagen.' })
  @IsString()
  @MinLength(10)
  // ~14 MB de base64 ≈ 10 MB de archivo, que es el tope que valida el servicio.
  // Acá se corta antes para no arrastrar por la red algo que va a ser rechazado.
  @MaxLength(14_000_000, { message: 'El archivo es demasiado grande.' })
  archivoBase64!: string;

  @ApiProperty({ example: 'remito-0001-45678.pdf' })
  @IsString()
  @MaxLength(200)
  nombreArchivo!: string;

  @ApiPropertyOptional({ enum: TipoComprobante, default: TipoComprobante.REMITO })
  @IsOptional()
  @IsEnum(TipoComprobante)
  tipo?: TipoComprobante;
}
