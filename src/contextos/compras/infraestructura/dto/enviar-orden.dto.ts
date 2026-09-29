import { ApiProperty } from '@nestjs/swagger';
import { EstadoOrdenCompra } from '@prisma/client';
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

  @ApiProperty({
    enum: EstadoOrdenCompra,
    description: 'Estado en que quedó la orden. Al mandarla, un BORRADOR pasa a EMITIDA.',
  })
  estado!: EstadoOrdenCompra;
}

/** El envío por WhatsApp lo hace la persona; el sistema solo deja constancia. */
export class RegistrarWhatsappDto {
  @ApiProperty({ description: 'El número al que se abrió el chat', example: '5493534403519' })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  numero!: string;
}
