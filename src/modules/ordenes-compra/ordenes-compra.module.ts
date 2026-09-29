import { Module } from '@nestjs/common';
import { PanolModule } from '../../contextos/panol/infraestructura/panol.module';
import { ProveedoresModule } from '../proveedores/proveedores.module';
import { OrdenesCompraController } from './ordenes-compra.controller';
import { OrdenesCompraRepository } from './ordenes-compra.repository';
import { ComprobantesService } from './comprobantes/comprobantes.service';
import { OrdenesCompraService } from './ordenes-compra.service';

@Module({
  // Proveedores y materiales validan el detalle con errores claros (404).
  // El pañol aporta además la regla de la fecha contra el último ajuste:
  // recibir una orden genera movimientos de stock y le toca la misma regla.
  imports: [ProveedoresModule, PanolModule],
  controllers: [OrdenesCompraController],
  providers: [ComprobantesService, OrdenesCompraService, OrdenesCompraRepository],
  exports: [OrdenesCompraService],
})
export class OrdenesCompraModule {}
