import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, validateSync } from 'class-validator';

/**
 * Esquema de las variables de entorno. Si falta algo crítico, la app
 * no arranca (fail-fast) en lugar de explotar más tarde.
 */
class VariablesEntorno {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  DIRECT_URL!: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  CLERK_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  CLERK_PUBLISHABLE_KEY?: string;

  @IsOptional()
  @IsString()
  AUTH_DISABLED?: string;

  /**
   * La clave del baúl de credenciales: 32 bytes en base64 o hexadecimal.
   *
   * Opcional a propósito. Sin ella el baúl queda deshabilitado y el resto del
   * sistema funciona igual, como pasa con el almacén de fotos. Un servidor
   * caído por una variable que falta es peor que una pantalla que explica qué
   * falta. Lo que NO pasa nunca es que se guarde en claro.
   *
   * Si se pierde, las contraseñas guardadas no se recuperan. Va fuera de la
   * base y fuera del backup.
   */
  @IsOptional()
  @IsString()
  CLAVE_SECRETOS?: string;
}

export function validarEntorno(config: Record<string, unknown>) {
  const validado = plainToInstance(VariablesEntorno, config, {
    enableImplicitConversion: true,
  });
  const errores = validateSync(validado, { skipMissingProperties: false });

  if (errores.length > 0) {
    throw new Error(`Configuración de entorno inválida:\n${errores.toString()}`);
  }
  return validado;
}
