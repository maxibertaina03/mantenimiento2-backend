import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Proveedor } from '@prisma/client';

/**
 * DTO de salida: define la forma pública del Proveedor en las respuestas.
 */
export class ProveedorRespuestaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nombre!: string;

  @ApiPropertyOptional({ nullable: true })
  cuit!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  telefono!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notas!: string | null;

  @ApiProperty()
  creadoEn!: Date;

  @ApiProperty()
  actualizadoEn!: Date;

  static desde(p: Proveedor): ProveedorRespuestaDto {
    return {
      id: p.id,
      nombre: p.nombre,
      cuit: p.cuit,
      email: p.email,
      telefono: p.telefono,
      notas: p.notas,
      creadoEn: p.creadoEn,
      actualizadoEn: p.actualizadoEn,
    };
  }
}
