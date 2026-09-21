import { Module } from '@nestjs/common';
import { MovimientosStockModule } from '../../../modules/movimientos-stock/movimientos-stock.module';
import { CONSULTA_EQUIPOS } from '../puertos/consulta-equipos';
import { RELOJ_TRABAJOS, RelojDelSistema } from '../puertos/reloj';
import { REPOSITORIO_ORDENES_TRABAJO } from '../puertos/repositorio-ordenes-trabajo';
import { STOCK } from '../puertos/stock';
import { OrdenesTrabajoController } from './ordenes-trabajo.controller';
import { PrismaConsultaEquipos } from './prisma-consulta-equipos';
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
 * Importa el módulo de movimientos porque el pañol de verdad vive ahí. Es la
 * única dependencia hacia afuera, y pasa por el service del otro módulo, no por
 * su base: las reglas de stock siguen siendo suyas.
 */
@Module({
  imports: [MovimientosStockModule],
  controllers: [OrdenesTrabajoController],
  providers: [
    { provide: REPOSITORIO_ORDENES_TRABAJO, useClass: PrismaRepositorioOrdenesTrabajo },
    { provide: CONSULTA_EQUIPOS, useClass: PrismaConsultaEquipos },
    { provide: STOCK, useClass: StockPorMovimientos },
    { provide: RELOJ_TRABAJOS, useClass: RelojDelSistema },
  ],
})
export class TrabajosModule {}
