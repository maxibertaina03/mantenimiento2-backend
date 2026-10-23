import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SoloAutenticado } from '../../common/auth/decorators/permisos.decorator';
import { commitDesplegado, versionDelServidor } from '../../common/version';

/**
 * Qué versión del servidor está corriendo.
 *
 * Las pantallas la muestran al pie del menú, junto a la suya: así cualquiera
 * puede decir con qué versión le pasó algo, o comprobar que una publicación
 * ya le llegó. Alcanza con haber entrado: no es un dato sensible.
 */
@ApiTags('Sistema')
@ApiBearerAuth()
@Controller('version')
export class VersionController {
  private readonly version = versionDelServidor();
  private readonly commit = commitDesplegado();

  @SoloAutenticado()
  @Get()
  @ApiOperation({ summary: 'La versión del servidor y el commit desplegado' })
  ver(): { version: string; commit: string } {
    return { version: this.version, commit: this.commit };
  }
}
