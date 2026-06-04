import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'Juan Operario' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({ example: 'juan@mantenimiento.local' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'Futuro ID externo de Clerk (hoy null, auth desactivada)',
  })
  @IsOptional()
  @IsString()
  idExterno?: string;

  @ApiPropertyOptional({ enum: RolUsuario, default: RolUsuario.OPERARIO })
  @IsOptional()
  @IsEnum(RolUsuario)
  rol?: RolUsuario;
}
