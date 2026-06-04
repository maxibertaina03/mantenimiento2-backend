import { ConfigService } from '@nestjs/config';
import { createClerkClient, type ClerkClient } from '@clerk/backend';

/** Token de inyección para el cliente de Clerk. */
export const CLERK_CLIENT = 'CLERK_CLIENT';

/**
 * Provee un ClerkClient configurado con la secret key.
 * Si no hay secret key (p. ej. AUTH_DISABLED en dev), devuelve null y el guard
 * no intentará verificar tokens.
 */
export const clerkClientProvider = {
  provide: CLERK_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): ClerkClient | null => {
    const secretKey = config.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) return null;
    return createClerkClient({ secretKey });
  },
};
