import { PartialType } from '@nestjs/swagger';
import { CrearUsuarioDto } from './crear-usuario.dto';

export class ActualizarUsuarioDto extends PartialType(CrearUsuarioDto) {}
