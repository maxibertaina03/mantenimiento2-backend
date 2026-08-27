import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsuariosModule } from '../../modules/usuarios/usuarios.module';
import { CacheUsuarios } from './cache-usuarios';
import { clerkClientProvider } from './clerk.provider';
import { GuardAutenticacion } from './guards/auth.guard';
import { GuardRoles } from './guards/roles.guard';

/**
 * Módulo de autenticación. Registra el GuardAutenticacion como guard GLOBAL,
 * de modo que toda la app queda detrás del login (salvo rutas @Public()).
 */
@Module({
  imports: [UsuariosModule], // para el provisionamiento JIT
  providers: [
    clerkClientProvider,
    CacheUsuarios,
    GuardAutenticacion,
    { provide: APP_GUARD, useClass: GuardAutenticacion },
    // El orden importa: primero autentica (adjunta request.usuario), despues
    // autoriza por rol.
    { provide: APP_GUARD, useClass: GuardRoles },
  ],
})
export class AuthModule {}
