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
import { ActualizarTipoEquipoDto, CrearTipoEquipoDto } from './dto/tipo-equipo.dto';
import { TiposEquipoService } from './tipos-equipo.service';

@ApiTags('Tipos de equipo')
@ApiBearerAuth()
// El catálogo lo administra el área de sistemas, igual que el módulo IT.
@Roles(RolUsuario.ADMIN)
@Controller('tipos-equipo')
export class TiposEquipoController {
  constructor(private readonly service: TiposEquipoService) {}

  @Get()
  @ApiOperation({ summary: 'Listar los tipos de equipo' })
  @ApiQuery({ name: 'soloActivos', required: false, type: Boolean })
  listar(@Query('soloActivos') soloActivos?: string) {
    return this.service.listar(soloActivos === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Crear un tipo de equipo' })
  crear(@Body() dto: CrearTipoEquipoDto) {
    return this.service.crear(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un tipo por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un tipo de equipo' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarTipoEquipoDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un tipo (solo si no lo usa ningún equipo)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
