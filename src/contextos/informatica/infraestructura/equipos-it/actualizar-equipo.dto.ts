import { PartialType } from '@nestjs/swagger';
import { CrearEquipoDto } from './crear-equipo.dto';

/**
 * Edición de un equipo: todos los campos opcionales.
 * La asignación NO se cambia por acá — tiene su propio endpoint para que quede
 * registrada en el historial (ver AsignarEquipoDto).
 */
export class ActualizarEquipoDto extends PartialType(CrearEquipoDto) {}
