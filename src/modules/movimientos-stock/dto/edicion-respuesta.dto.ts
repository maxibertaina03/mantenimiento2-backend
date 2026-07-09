import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EdicionMovimiento } from '@prisma/client';

type EdicionConUsuario = EdicionMovimiento & { usuario?: { nombre: string } | null };

/** Registro de auditoría de una edición de movimiento. */
export class EdicionRespuestaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  motivo!: string;

  @ApiPropertyOptional({ description: 'Quién editó', nullable: true })
  usuarioNombre!: string | null;

  @ApiProperty({ description: 'Snapshot { antes, despues } de los campos editados' })
  cambios!: unknown;

  @ApiProperty()
  creadoEn!: Date;

  static desde(e: EdicionConUsuario): EdicionRespuestaDto {
    return {
      id: e.id,
      motivo: e.motivo,
      usuarioNombre: e.usuario?.nombre ?? null,
      cambios: e.cambios,
      creadoEn: e.creadoEn,
    };
  }
}
