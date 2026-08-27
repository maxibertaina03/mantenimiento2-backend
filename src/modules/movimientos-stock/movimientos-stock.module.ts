import { Module } from '@nestjs/common';
import { MovimientosStockController } from './movimientos-stock.controller';
import { MovimientosStockService } from './movimientos-stock.service';
import { MovimientosStockRepository } from './movimientos-stock.repository';
import { REPOSITORIO_MOVIMIENTOS } from './movimientos-stock.puerto';

@Module({
  controllers: [MovimientosStockController],
  providers: [
    MovimientosStockService,
    // El service depende del PUERTO; aca se elige la implementacion concreta.
    { provide: REPOSITORIO_MOVIMIENTOS, useClass: MovimientosStockRepository },
  ],
  exports: [MovimientosStockService],
})
export class MovimientosStockModule {}
