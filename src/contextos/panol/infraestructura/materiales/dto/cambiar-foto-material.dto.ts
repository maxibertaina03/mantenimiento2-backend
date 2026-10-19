import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CambiarFotoMaterialDto {
  @ApiProperty({ description: 'La imagen en base64, ya comprimida por el navegador' })
  @IsString()
  @MinLength(100)
  // ~7 MB de base64 ≈ 5 MB de imagen, que es el tope que valida el dominio.
  @MaxLength(7_000_000, { message: 'La imagen es demasiado grande.' })
  imagenBase64!: string;

  @ApiProperty({ example: 'reten-bomba.jpg' })
  @IsString()
  @MaxLength(200)
  nombreArchivo!: string;
}
