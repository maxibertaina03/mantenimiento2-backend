import { SetMetadata } from '@nestjs/common';

export const CLAVE_PUBLICO = 'esPublico';

/**
 * Marca un endpoint como público (sin autenticación) aunque el guard global esté activo.
 * Uso:  @Public()  sobre un método o controller.
 */
export const Public = () => SetMetadata(CLAVE_PUBLICO, true);
