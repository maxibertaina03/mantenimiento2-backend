import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** Tope por tanda. Una hoja A4 entra unas 24 etiquetas; 300 son doce hojas. */
const MAXIMO_POR_TANDA = 300;

/**
 * Los equipos de informática a los que se les acaba de imprimir la etiqueta.
 *
 * Es igual al del contexto de equipos de planta y está repetido a propósito: un
 * módulo convencional no importa de adentro de un bounded context. Son veinte
 * líneas; la dependencia cruzada costaría más.
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
