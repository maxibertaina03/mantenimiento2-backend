import { Module } from '@nestjs/common';
import { MovimientosStockController } from './movimientos-stock.controller';
import { MovimientosStockService } from './movimientos-stock.service';
import { MovimientosStockRepository } from './movimientos-stock.repository';

@Module({
  controllers: [MovimientosStockController],
  providers: [MovimientosStockService, MovimientosStockRepository],
  exports: [MovimientosStockService],
})
export class MovimientosStockModule {}
