import { Module } from '@nestjs/common';
import { MaterialesModule } from '../materiales/materiales.module';
import { MovimientosStockModule } from '../movimientos-stock/movimientos-stock.module';
import { ProveedoresModule } from '../proveedores/proveedores.module';
import { OrdenesCompraController } from './ordenes-compra.controller';
import { OrdenesCompraRepository } from './ordenes-compra.repository';
import { OrdenesCompraService } from './ordenes-compra.service';

@Module({
  // Proveedores y materiales validan el detalle con errores claros (404).
  // Movimientos aporta la regla de la fecha contra el último ajuste: recibir
  // una orden genera movimientos de stock y le toca la misma regla.
  imports: [ProveedoresModule, MaterialesModule, MovimientosStockModule],
  controllers: [OrdenesCompraController],
  providers: [OrdenesCompraService, OrdenesCompraRepository],
  exports: [OrdenesCompraService],
})
export class OrdenesCompraModule {}
