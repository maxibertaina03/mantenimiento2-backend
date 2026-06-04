import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsuariosModule } from '../../modules/usuarios/usuarios.module';
import { clerkClientProvider } from './clerk.provider';
import { GuardAutenticacion } from './guards/auth.guard';

/**
 * Módulo de autenticación. Registra el GuardAutenticacion como guard GLOBAL,
 * de modo que toda la app queda detrás del login (salvo rutas @Public()).
 */
@Module({
  imports: [UsuariosModule], // para el provisionamiento JIT
  providers: [
    clerkClientProvider,
    GuardAutenticacion,
    { provide: APP_GUARD, useClass: GuardAutenticacion },
  ],
})
export class AuthModule {}
