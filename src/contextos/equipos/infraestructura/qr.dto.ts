import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** Tope por tanda. Una hoja A4 entra unas 24 etiquetas; 300 son doce hojas. */
const MAXIMO_POR_TANDA = 300;

/**
 * Los equipos a los que se les acaba de imprimir la etiqueta.
 *
 * Va por lista y no de a uno porque las etiquetas se imprimen de a tandas: son
 * 326 máquinas y nadie las va a etiquetar una por una.
 */
export class MarcarQrDto {
  @ApiProperty({
    description: 'Ids de los equipos cuya etiqueta se mandó a imprimir',
    type: [String],
    format: 'uuid',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAXIMO_POR_TANDA)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
