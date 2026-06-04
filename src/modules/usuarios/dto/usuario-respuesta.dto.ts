import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RolUsuario, Usuario } from '@prisma/client';

export class UsuarioRespuestaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  idExterno!: string | null;

  @ApiProperty({ enum: RolUsuario })
  rol!: RolUsuario;

  @ApiProperty()
  creadoEn!: Date;

  @ApiProperty()
  actualizadoEn!: Date;

  static desde(u: Usuario): UsuarioRespuestaDto {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      idExterno: u.idExterno,
      rol: u.rol,
      creadoEn: u.creadoEn,
      actualizadoEn: u.actualizadoEn,
    };
  }
}
