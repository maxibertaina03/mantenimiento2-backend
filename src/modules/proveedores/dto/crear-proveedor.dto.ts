import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearProveedorDto {
  @ApiProperty({ example: 'Ferretería Central' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ example: '30-12345678-9' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cuit?: string;

  @ApiPropertyOptional({ example: 'ventas@proveedor.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+54 11 4000-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @ApiPropertyOptional({ example: 'Entrega en 48hs' })
  @IsOptional()
  @IsString()
  notas?: string;
}
