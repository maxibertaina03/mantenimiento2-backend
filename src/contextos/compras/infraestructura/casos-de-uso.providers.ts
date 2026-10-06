import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CorreoService } from '../../../common/correo/correo.service';
import { ProveedoresService } from '../../../modules/proveedores/proveedores.service';
import { MaterialesService, MovimientosStockService } from '../../panol';
import { EnviarOrdenes } from '../aplicacion/enviar-ordenes';
import { GestionarOrdenesCompra } from '../aplicacion/gestionar-ordenes-compra';
import {
  CasillasDeLaConfiguracion,
  CorreoDelSistema,
  PanolPorSusServicios,
  ProveedoresDelCatalogo,
} from './adaptadores';
import { OrdenRespuestaDto } from './dto/orden-respuesta.dto';
import { PrismaRepositorioOrdenesCompra } from './prisma-repositorio-ordenes-compra';

/**
 * Cómo se arman los casos de uso de compras.
 *
 * Es el único lugar de compras que nombra los servicios del pañol, de
 * proveedores y del correo, y los envuelve en sus adaptadores: el caso de uso
 * solo ve los puertos. Las fábricas se exportan para que el test del service
 * arme exactamente lo mismo que la aplicación.
 */
export function armarGestionarOrdenesCompra(
  repo: PrismaRepositorioOrdenesCompra,
  proveedores: ProveedoresService,
  materiales: MaterialesService,
  movimientos: MovimientosStockService,
): GestionarOrdenesCompra {
  return new GestionarOrdenesCompra(
    repo,
    new ProveedoresDelCatalogo(proveedores),
    new PanolPorSusServicios(materiales, movimientos),
  );
}

export function armarEnviarOrdenes(
  repo: PrismaRepositorioOrdenesCompra,
  correo: CorreoService,
  config: ConfigService,
): EnviarOrdenes {
  // El correo describe la orden igual que la pantalla y el PDF adjunto.
  return new EnviarOrdenes(
    repo,
    new CorreoDelSistema(correo),
    new CasillasDeLaConfiguracion(config),
    OrdenRespuestaDto.desde,
  );
}

export const casosDeUsoCompras: Provider[] = [
  {
    provide: GestionarOrdenesCompra,
    useFactory: armarGestionarOrdenesCompra,
    inject: [
      PrismaRepositorioOrdenesCompra,
      ProveedoresService,
      MaterialesService,
      MovimientosStockService,
    ],
  },
  {
    provide: EnviarOrdenes,
    useFactory: armarEnviarOrdenes,
    inject: [PrismaRepositorioOrdenesCompra, CorreoService, ConfigService],
  },
];
