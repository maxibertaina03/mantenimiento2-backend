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
