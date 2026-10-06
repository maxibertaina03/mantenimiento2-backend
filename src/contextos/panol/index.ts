/**
 * La puerta pública del pañol: lo único que otro contexto puede usar.
 *
 * Compras y trabajos mueven stock y consultan materiales por acá. Las reglas
 * del pañol —que un material desactivado no se use, que no se mueva stock
 * antes del último ajuste— siguen siendo del pañol: se le pide, no se copia.
 * Entrar a sus carpetas internas lo prohíbe la regla de límites de .eslintrc.cjs.
 */
export { PanolModule } from './infraestructura/panol.module';
export { MaterialesService } from './infraestructura/materiales/materiales.service';
export { MovimientosStockService } from './infraestructura/movimientos/movimientos-stock.service';
