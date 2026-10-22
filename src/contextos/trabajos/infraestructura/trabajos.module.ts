import { Module } from '@nestjs/common';
import { AuthModule } from '../../../common/auth/auth.module';
import { CorreoModule } from '../../../common/correo/correo.module';
import { ProveedoresModule } from '../../../modules/proveedores/proveedores.module';
import { EquiposModule } from '../../equipos';
import { PanolModule } from '../../panol';
import { CONSULTA_EQUIPOS } from '../puertos/consulta-equipos';
import { CONSULTA_EQUIPOS_IT } from '../puertos/consulta-equipos-it';
import { CONSULTA_USUARIOS } from '../puertos/consulta-usuarios';
import { CONTACTOS_DE_TALLERES, CORREO_TRABAJOS } from '../puertos/envio';
import { EQUIPOS_EN_TALLER } from '../puertos/equipos-en-taller';
import { REPOSITORIO_TAREAS } from '../puertos/repositorio-tareas';
import { REPOSITORIO_PENDIENTES } from '../puertos/repositorio-pendientes';
import { PLANES_DE_MANTENIMIENTO } from '../puertos/planes-de-mantenimiento';
import { RELOJ_TRABAJOS, RelojDelSistema } from '../puertos/reloj';
import { REPOSITORIO_ORDENES_TRABAJO } from '../puertos/repositorio-ordenes-trabajo';
import { STOCK } from '../puertos/stock';
import { AvisadorDeTareas } from './avisador-de-tareas';
import {
  ContactosPorProveedores,
  CorreoDeTrabajos,
  EquiposEnTallerPorEstado,
} from './adaptadores-taller';
import { CalendarioController } from './calendario.controller';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller';
import { PrismaRepositorioTareas } from './prisma-repositorio-tareas';
import { PrismaRepositorioPendientes } from './prisma-repositorio-pendientes';
import { PendientesController } from './pendientes.controller';
import { PrismaConsultaEquipos } from './prisma-consulta-equipos';
import { PrismaConsultaEquiposIt } from './prisma-consulta-equipos-it';
import { PlanesPorEquipos } from './planes-por-equipos';
import { PrismaConsultaUsuarios } from './prisma-consulta-usuarios';
import { PrismaRepositorioOrdenesTrabajo } from './prisma-repositorio-ordenes-trabajo';
import { StockPorMovimientos } from './stock-por-movimientos';
import { casosDeUsoTrabajos } from './casos-de-uso.providers';

/**
 * El cableado del contexto: acá se decide qué implementación concreta entra por
 * cada puerto.
 *
 * Es el único lugar donde se nombran juntos el puerto y su adaptador. El
 * dominio y los casos de uso solo conocen las interfaces, y por eso se prueban
 * con las implementaciones en memoria sin cambiar una línea.
 *
 * Importa el pañol porque el stock de verdad vive ahí. Pasa por su service,
 * no por su base: las reglas de stock siguen siendo suyas.
 *
 * Y el de auth porque el controlador pregunta si quien carga puede ver equipos,
 * para decidir si lo deja atar la orden a una máquina. `AuthModule` no es
 * global: sus guards sí lo son, pero `PermisosService` solo lo ve quien lo
 * importa. Olvidarlo no rompe la compilación, rompe el arranque.
 */
@Module({
  imports: [PanolModule, AuthModule, EquiposModule, CorreoModule, ProveedoresModule],
  controllers: [OrdenesTrabajoController, CalendarioController, PendientesController],
  providers: [
    { provide: REPOSITORIO_ORDENES_TRABAJO, useClass: PrismaRepositorioOrdenesTrabajo },
    { provide: CONSULTA_EQUIPOS, useClass: PrismaConsultaEquipos },
    { provide: CONSULTA_EQUIPOS_IT, useClass: PrismaConsultaEquiposIt },
    { provide: CONSULTA_USUARIOS, useClass: PrismaConsultaUsuarios },
    { provide: PLANES_DE_MANTENIMIENTO, useClass: PlanesPorEquipos },
    { provide: REPOSITORIO_TAREAS, useClass: PrismaRepositorioTareas },
    { provide: REPOSITORIO_PENDIENTES, useClass: PrismaRepositorioPendientes },
    AvisadorDeTareas,
    { provide: STOCK, useClass: StockPorMovimientos },
    { provide: RELOJ_TRABAJOS, useClass: RelojDelSistema },
    { provide: EQUIPOS_EN_TALLER, useClass: EquiposEnTallerPorEstado },
    { provide: CORREO_TRABAJOS, useClass: CorreoDeTrabajos },
    { provide: CONTACTOS_DE_TALLERES, useClass: ContactosPorProveedores },
    ...casosDeUsoTrabajos,
  ],
})
export class TrabajosModule {}
