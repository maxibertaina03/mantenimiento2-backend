import { Module } from '@nestjs/common';
import { ProveedoresModule } from '../../../modules/proveedores/proveedores.module';
import { PanolModule } from '../../panol';
import { ComprobantesService } from './comprobantes/comprobantes.service';
import { OrdenesCompraController } from './ordenes-compra.controller';
import { OrdenesCompraService } from './ordenes-compra.service';
import { casosDeUsoCompras } from './casos-de-uso.providers';
import { PrismaRepositorioOrdenesCompra } from './prisma-repositorio-ordenes-compra';

/**
 * El contexto de compras: las órdenes, sus comprobantes y su envío.
 *
 * Proveedores sigue siendo un módulo aparte, a propósito: es un catálogo. El
 * pañol es otro contexto: compras le pregunta por su puerta pública si un
 * material se puede comprar y si una fecha de recepción choca con un ajuste.
 * El correo y la configuración son globales.
 *
 * Los comprobantes quedaron como estaban, un service de infraestructura: son
 * casi solo el almacén de archivos, y partirlos en cuatro capas sería
 * ceremonia.
 */
@Module({
  imports: [ProveedoresModule, PanolModule],
  controllers: [OrdenesCompraController],
  providers: [
    ComprobantesService,
    OrdenesCompraService,
    PrismaRepositorioOrdenesCompra,
    ...casosDeUsoCompras,
  ],
  exports: [OrdenesCompraService],
})
export class ComprasModule {}
