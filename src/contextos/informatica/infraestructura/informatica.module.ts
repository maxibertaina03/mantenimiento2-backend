import { Module } from '@nestjs/common';
import { AuthModule } from '../../../common/auth/auth.module';
import { COFRE } from '../puertos/cofre';
import { CONSULTA_EQUIPOS_IT_BAUL } from '../puertos/consulta-equipos-it';
import { RELOJ_INFORMATICA } from '../puertos/reloj';
import { REPOSITORIO_CREDENCIALES } from '../puertos/repositorio-credenciales';
import { CofreService } from './cofre.service';
import { CredencialesController } from './credenciales.controller';
import { PrismaConsultaEquiposIt } from './prisma-consulta-equipos-it';
import { PrismaRepositorioCredenciales } from './prisma-repositorio-credenciales';

/**
 * El contexto de informática: por ahora, el baúl de credenciales.
 *
 * Acá se elige qué implementación concreta entra por cada puerto. Es el único
 * lugar del contexto donde se nombran las dos cosas a la vez, y por eso es el
 * único que hay que tocar para cambiar de base de datos o de algoritmo de
 * cifrado.
 *
 * `AuthModule` se importa aunque no se use directamente: el guard de permisos
 * que protege el controlador vive ahí, y no es `@Global()`. Olvidarlo hace que
 * la aplicación no arranque, y eso ya pasó una vez con el módulo de trabajos.
 */
@Module({
  imports: [AuthModule],
  controllers: [CredencialesController],
  providers: [
    CofreService,
    { provide: REPOSITORIO_CREDENCIALES, useClass: PrismaRepositorioCredenciales },
    { provide: CONSULTA_EQUIPOS_IT_BAUL, useClass: PrismaConsultaEquiposIt },
    { provide: COFRE, useExisting: CofreService },
    {
      provide: RELOJ_INFORMATICA,
      useValue: { ahora: () => new Date() },
    },
  ],
  exports: [CofreService],
})
export class InformaticaModule {}
