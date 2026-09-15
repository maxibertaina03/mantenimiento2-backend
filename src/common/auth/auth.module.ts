import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsuariosModule } from '../../modules/usuarios/usuarios.module';
import { CacheUsuarios } from './cache-usuarios';
import { clerkClientProvider } from './clerk.provider';
import { GuardAutenticacion } from './guards/auth.guard';
import { GuardPermisos } from './guards/permisos.guard';
import { PermisosController } from './permisos.controller';
import { PermisosService } from './permisos.service';

/**
 * Autenticación y permisos.
 *
 * Los dos guards son GLOBALES, así que toda la aplicación queda detrás del
 * login y detrás de los permisos. El de permisos falla cerrado: un endpoint que
 * no declara qué necesita, no pasa. Antes era al revés, y por eso alcanzaba con
 * olvidarse un decorador para que cualquiera pudiera escribir.
 */
@Module({
  imports: [UsuariosModule], // para el provisionamiento JIT
  controllers: [PermisosController],
  providers: [
    clerkClientProvider,
    CacheUsuarios,
    PermisosService,
    GuardAutenticacion,
    { provide: APP_GUARD, useClass: GuardAutenticacion },
    // El orden importa: primero autentica (adjunta request.usuario), despues
    // autoriza por permisos.
    { provide: APP_GUARD, useClass: GuardPermisos },
  ],
  exports: [PermisosService],
})
export class AuthModule {}
