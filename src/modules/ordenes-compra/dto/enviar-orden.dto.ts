import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** ~6 MB de base64 ≈ 4,5 MB de PDF. Una orden pesa muy por debajo de eso. */
const MAX_BASE64 = 6_000_000;

export class EnviarOrdenDto {
  @ApiProperty({
    description: 'El PDF de la orden en base64, tal como lo genera el navegador',
  })
  @IsString()
  @MinLength(100)
  @MaxLength(MAX_BASE64, {
    message: 'El PDF es demasiado grande para enviarlo por correo.',
  })
  pdfBase64!: string;
}

export class ResultadoEnvioDto {
  @ApiProperty({ description: 'A quién se le mandó' })
  para!: string[];

  @ApiProperty({ description: 'Quién quedó en copia' })
  copia!: string[];

  @ApiProperty({ description: 'A dónde contesta el proveedor si responde' })
  responderA!: string | null;
}
