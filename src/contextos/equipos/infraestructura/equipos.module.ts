import { Module } from '@nestjs/common';
import { ALMACEN_IMAGENES } from '../puertos/almacen-imagenes';
import { DESTINATARIOS_AVISOS } from '../puertos/destinatarios-avisos';
import { ENVIADOR_AVISOS } from '../puertos/enviador-avisos';
import { REPOSITORIO_AVISOS } from '../puertos/repositorio-avisos';
import { REPOSITORIO_INTERVENCIONES } from '../puertos/repositorio-intervenciones';
import { REPOSITORIO_PLANES } from '../puertos/repositorio-planes';
import { REPOSITORIO_EQUIPOS } from '../puertos/repositorio-equipos';
import { REPOSITORIO_UBICACIONES } from '../puertos/repositorio-ubicaciones';
import { RELOJ, RelojDelSistema } from '../puertos/reloj';
import {
  CatalogosEquipoService,
  TiposEquipoPlantaController,
  UbicacionesEquipoController,
} from './catalogos.controller';
import { AvisosController } from './avisos.controller';
import { CorreoEnviadorAvisos } from './correo-enviador-avisos';
import { EquiposController } from './equipos.controller';
import { PrismaDestinatariosAvisos } from './prisma-destinatarios-avisos';
import { PrismaRepositorioAvisos } from './prisma-repositorio-avisos';
import { PrismaRepositorioEquipos } from './prisma-repositorio-equipos';
import { PrismaRepositorioIntervenciones } from './prisma-repositorio-intervenciones';
import { PrismaRepositorioPlanes } from './prisma-repositorio-planes';
import { PrismaRepositorioUbicaciones } from './prisma-repositorio-ubicaciones';
import { SupabaseAlmacenImagenes } from './supabase-almacen-imagenes';

/**
 * El cableado del contexto: acá se decide qué implementación concreta entra por
 * cada puerto.
 *
 * Es el único lugar donde se nombran juntos el puerto y su adaptador. El
 * dominio y los casos de uso solo conocen las interfaces, y por eso se prueban
 * con las implementaciones en memoria sin cambiar una línea.
 */
@Module({
  controllers: [
    EquiposController,
    AvisosController,
    UbicacionesEquipoController,
    TiposEquipoPlantaController,
  ],
  providers: [
    CatalogosEquipoService,
    { provide: REPOSITORIO_EQUIPOS, useClass: PrismaRepositorioEquipos },
    { provide: REPOSITORIO_UBICACIONES, useClass: PrismaRepositorioUbicaciones },
    { provide: REPOSITORIO_INTERVENCIONES, useClass: PrismaRepositorioIntervenciones },
    { provide: REPOSITORIO_PLANES, useClass: PrismaRepositorioPlanes },
    { provide: ALMACEN_IMAGENES, useClass: SupabaseAlmacenImagenes },
    { provide: REPOSITORIO_AVISOS, useClass: PrismaRepositorioAvisos },
    { provide: DESTINATARIOS_AVISOS, useClass: PrismaDestinatariosAvisos },
    { provide: ENVIADOR_AVISOS, useClass: CorreoEnviadorAvisos },
    { provide: RELOJ, useClass: RelojDelSistema },
  ],
  exports: [REPOSITORIO_EQUIPOS, RELOJ],
})
export class EquiposModule {}
