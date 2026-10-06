import { Module } from '@nestjs/common';
import { AuthModule } from '../../../common/auth/auth.module';
import { TiposEquipoModule } from '../../../modules/tipos-equipo/tipos-equipo.module';
import { CONSULTA_RESPONSABLES } from '../puertos/consulta-responsables';
import { REPOSITORIO_EQUIPOS_IT } from '../puertos/repositorio-equipos-it';
import { EquiposItController } from './equipos-it.controller';
import { ImportarEquiposItService } from './importar-equipos-it.service';
import { PrismaConsultaResponsables } from './prisma-consulta-responsables';
import { PrismaRepositorioEquiposIt } from './prisma-repositorio-equipos-it';
import { COFRE } from '../puertos/cofre';
import { CONSULTA_EQUIPOS_IT_BAUL } from '../puertos/consulta-equipos-it';
import { RELOJ_INFORMATICA } from '../puertos/reloj';
import { REPOSITORIO_CREDENCIALES } from '../puertos/repositorio-credenciales';
import { CofreService } from './cofre.service';
import { CredencialesController } from './credenciales.controller';
import { PrismaConsultaEquiposIt } from './prisma-consulta-equipos-it';
import { PrismaRepositorioCredenciales } from './prisma-repositorio-credenciales';
import { casosDeUsoInformatica } from './casos-de-uso.providers';

/**
 * El contexto de informática: el inventario de equipos y el baúl de credenciales.
 *
 * Tipos y responsables siguen siendo módulos aparte, a propósito: son
 * catálogos, y envolverlos en cuatro capas sería ceremonia. Se los consulta por
 * un puerto angosto, sin depender de cómo están hechos.
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
  // TiposEquipoModule: el importador resuelve el tipo contra el catálogo.
  imports: [AuthModule, TiposEquipoModule],
  controllers: [CredencialesController, EquiposItController],
  providers: [
    CofreService,
    ImportarEquiposItService,
    { provide: REPOSITORIO_EQUIPOS_IT, useClass: PrismaRepositorioEquiposIt },
    { provide: CONSULTA_RESPONSABLES, useClass: PrismaConsultaResponsables },
    { provide: REPOSITORIO_CREDENCIALES, useClass: PrismaRepositorioCredenciales },
    { provide: CONSULTA_EQUIPOS_IT_BAUL, useClass: PrismaConsultaEquiposIt },
    { provide: COFRE, useExisting: CofreService },
    {
      provide: RELOJ_INFORMATICA,
      useValue: { ahora: () => new Date() },
    },
    ...casosDeUsoInformatica,
  ],
  exports: [CofreService],
})
export class InformaticaModule {}
