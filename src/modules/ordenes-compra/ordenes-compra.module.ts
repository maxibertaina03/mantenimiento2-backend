import { Module } from '@nestjs/common';
import { MaterialesModule } from '../materiales/materiales.module';
import { ProveedoresModule } from '../proveedores/proveedores.module';
import { OrdenesCompraController } from './ordenes-compra.controller';
import { OrdenesCompraRepository } from './ordenes-compra.repository';
import { OrdenesCompraService } from './ordenes-compra.service';

@Module({
  // Validan proveedor y materiales del detalle con errores claros (404).
  imports: [ProveedoresModule, MaterialesModule],
  controllers: [OrdenesCompraController],
  providers: [OrdenesCompraService, OrdenesCompraRepository],
  exports: [OrdenesCompraService],
})
export class OrdenesCompraModule {}
