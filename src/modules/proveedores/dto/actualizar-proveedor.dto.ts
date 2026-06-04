import { PartialType } from '@nestjs/swagger';
import { CrearProveedorDto } from './crear-proveedor.dto';

/**
 * Todas las props opcionales para actualizaciones parciales (PATCH).
 */
export class ActualizarProveedorDto extends PartialType(CrearProveedorDto) {}
