import { Module } from '@nestjs/common';
import { REPOSITORIO_EQUIPOS } from '../puertos/repositorio-equipos';
import { REPOSITORIO_UBICACIONES } from '../puertos/repositorio-ubicaciones';
import { RELOJ, RelojDelSistema } from '../puertos/reloj';
import {
  CatalogosEquipoService,
  TiposEquipoPlantaController,
  UbicacionesEquipoController,
} from './catalogos.controller';
import { EquiposController } from './equipos.controller';
import { PrismaRepositorioEquipos } from './prisma-repositorio-equipos';
import { PrismaRepositorioUbicaciones } from './prisma-repositorio-ubicaciones';

/**
 * El cableado del contexto: acá se decide qué implementación concreta entra por
 * cada puerto.
 *
 * Es el único lugar donde se nombran juntos el puerto y su adaptador. El
 * dominio y los casos de uso solo conocen las interfaces, y por eso se prueban
 * con las implementaciones en memoria sin cambiar una línea.
 */
@Module({
  controllers: [EquiposController, UbicacionesEquipoController, TiposEquipoPlantaController],
  providers: [
    CatalogosEquipoService,
    { provide: REPOSITORIO_EQUIPOS, useClass: PrismaRepositorioEquipos },
    { provide: REPOSITORIO_UBICACIONES, useClass: PrismaRepositorioUbicaciones },
    { provide: RELOJ, useClass: RelojDelSistema },
  ],
  exports: [REPOSITORIO_EQUIPOS, RELOJ],
})
export class EquiposModule {}
