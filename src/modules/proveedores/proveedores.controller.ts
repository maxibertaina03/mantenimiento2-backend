import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ActualizarProveedorDto } from './dto/actualizar-proveedor.dto';
import { ListarProveedoresDto } from './dto/listar-proveedores.dto';
import { ProveedoresService } from './proveedores.service';

@ApiTags('Proveedores')
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly service: ProveedoresService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un proveedor' })
  crear(@Body() dto: CrearProveedorDto) {
    return this.service.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proveedores (paginado, con búsqueda por nombre/CUIT)' })
  listar(@Query() query: ListarProveedoresDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un proveedor por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un proveedor' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarProveedorDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un proveedor' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
