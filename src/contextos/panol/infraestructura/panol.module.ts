import { Module } from '@nestjs/common';
import { CONSULTA_CATALOGOS } from '../puertos/consulta-catalogos';
import { REPOSITORIO_MATERIALES } from '../puertos/repositorio-materiales';
import { REPOSITORIO_MOVIMIENTOS } from '../puertos/repositorio-movimientos';
import { REPOSITORIO_TOMAS } from '../puertos/repositorio-tomas';
import { InventarioController, TomasInventarioService } from './inventario/inventario.controller';
import { PrismaRepositorioTomas } from './inventario/prisma-repositorio-tomas';
import { MaterialesController } from './materiales/materiales.controller';
import { MaterialesService } from './materiales/materiales.service';
import { PrismaRepositorioMateriales } from './materiales/prisma-repositorio-materiales';
import { MovimientosStockController } from './movimientos/movimientos-stock.controller';
import { MovimientosStockService } from './movimientos/movimientos-stock.service';
import { PrismaRepositorioMovimientos } from './movimientos/prisma-repositorio-movimientos';
import { PrismaConsultaCatalogos } from './prisma-consulta-catalogos';

/**
 * El contexto del pañol: los materiales y los movimientos que mueven su stock.
 *
 * Categorías, unidades y estanterías siguen siendo módulos aparte, a
 * propósito: son catálogos, y envolverlos en cuatro capas sería ceremonia. Se
 * los consulta por un puerto angosto.
 *
 * Exporta los dos services con los mismos nombres que tenían antes de la
 * mudanza: órdenes de compra y órdenes de trabajo los usan, y siguen hablando
 * con el pañol por esa puerta, no por su base. Las reglas de stock siguen
 * siendo de acá.
 *
 * Acá se elige qué implementación concreta entra por cada puerto. Es el único
 * lugar del contexto donde se nombran las dos cosas a la vez.
 */
@Module({
  controllers: [MaterialesController, MovimientosStockController, InventarioController],
  providers: [
    MaterialesService,
    MovimientosStockService,
    { provide: REPOSITORIO_MATERIALES, useClass: PrismaRepositorioMateriales },
    { provide: REPOSITORIO_MOVIMIENTOS, useClass: PrismaRepositorioMovimientos },
    { provide: CONSULTA_CATALOGOS, useClass: PrismaConsultaCatalogos },
    { provide: REPOSITORIO_TOMAS, useClass: PrismaRepositorioTomas },
    TomasInventarioService,
  ],
  exports: [MaterialesService, MovimientosStockService],
})
export class PanolModule {}
