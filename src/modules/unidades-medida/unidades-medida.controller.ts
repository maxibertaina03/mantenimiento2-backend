import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { ActualizarUnidadMedidaDto, CrearUnidadMedidaDto } from './dto/unidad-medida.dto';
import { UnidadesMedidaService } from './unidades-medida.service';

@ApiTags('Unidades de medida')
@ApiBearerAuth()
@Controller('unidades-medida')
export class UnidadesMedidaController {
  constructor(private readonly service: UnidadesMedidaService) {}

  // Listar queda abierto a cualquier usuario autenticado: quien carga un
  // material necesita elegir la unidad. Administrar el catálogo es de admin.
  @Get()
  @ApiOperation({ summary: 'Listar las unidades de medida' })
  @ApiQuery({ name: 'soloActivas', required: false, type: Boolean })
  listar(@Query('soloActivas') soloActivas?: string) {
    return this.service.listar(soloActivas === 'true');
  }

  @Post()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Crear una unidad de medida' })
  crear(@Body() dto: CrearUnidadMedidaDto) {
    return this.service.crear(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una unidad por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Editar una unidad de medida' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarUnidadMedidaDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una unidad (solo si no la usa ningún material)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
