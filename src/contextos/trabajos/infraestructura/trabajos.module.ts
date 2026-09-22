import { Module } from '@nestjs/common';
import { AuthModule } from '../../../common/auth/auth.module';
import { EquiposModule } from '../../equipos/infraestructura/equipos.module';
import { MovimientosStockModule } from '../../../modules/movimientos-stock/movimientos-stock.module';
import { CONSULTA_EQUIPOS } from '../puertos/consulta-equipos';
import { CONSULTA_USUARIOS } from '../puertos/consulta-usuarios';
import { PLANES_DE_MANTENIMIENTO } from '../puertos/planes-de-mantenimiento';
import { RELOJ_TRABAJOS, RelojDelSistema } from '../puertos/reloj';
import { REPOSITORIO_ORDENES_TRABAJO } from '../puertos/repositorio-ordenes-trabajo';
import { STOCK } from '../puertos/stock';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller';
import { PrismaConsultaEquipos } from './prisma-consulta-equipos';
import { PlanesPorEquipos } from './planes-por-equipos';
import { PrismaConsultaUsuarios } from './prisma-consulta-usuarios';
import { PrismaRepositorioOrdenesTrabajo } from './prisma-repositorio-ordenes-trabajo';
import { StockPorMovimientos } from './stock-por-movimientos';

/**
 * El cableado del contexto: acá se decide qué implementación concreta entra por
 * cada puerto.
 *
 * Es el único lugar donde se nombran juntos el puerto y su adaptador. El
 * dominio y los casos de uso solo conocen las interfaces, y por eso se prueban
 * con las implementaciones en memoria sin cambiar una línea.
 *
 * Importa el módulo de movimientos porque el pañol de verdad vive ahí. Pasa por
 * el service del otro módulo, no por su base: las reglas de stock siguen siendo
 * suyas.
 *
 * Y el de auth porque el controlador pregunta si quien carga puede ver equipos,
 * para decidir si lo deja atar la orden a una máquina. `AuthModule` no es
 * global: sus guards sí lo son, pero `PermisosService` solo lo ve quien lo
 * importa. Olvidarlo no rompe la compilación, rompe el arranque.
 */
@Module({
  imports: [MovimientosStockModule, AuthModule, EquiposModule],
  controllers: [OrdenesTrabajoController],
  providers: [
    { provide: REPOSITORIO_ORDENES_TRABAJO, useClass: PrismaRepositorioOrdenesTrabajo },
    { provide: CONSULTA_EQUIPOS, useClass: PrismaConsultaEquipos },
    { provide: CONSULTA_USUARIOS, useClass: PrismaConsultaUsuarios },
    { provide: PLANES_DE_MANTENIMIENTO, useClass: PlanesPorEquipos },
    { provide: STOCK, useClass: StockPorMovimientos },
    { provide: RELOJ_TRABAJOS, useClass: RelojDelSistema },
  ],
})
export class TrabajosModule {}
