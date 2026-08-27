import { PartialType } from '@nestjs/swagger';
import { CrearOrdenDto } from './crear-orden.dto';

/**
 * Edición de una orden. Solo se permite mientras está en BORRADOR:
 * una vez emitida, el proveedor ya tiene el documento en la mano.
 */
export class ActualizarOrdenDto extends PartialType(CrearOrdenDto) {}
