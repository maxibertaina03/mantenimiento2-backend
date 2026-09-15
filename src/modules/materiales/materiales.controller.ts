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
import { AsignarUnidadMasivaDto } from './dto/asignar-unidad-masiva.dto';
import { CrearMaterialDto } from './dto/crear-material.dto';
import { MarcarQrMaterialesDto } from './dto/marcar-qr.dto';
import { ActualizarMaterialDto } from './dto/actualizar-material.dto';
import { ListarMaterialesDto } from './dto/listar-materiales.dto';
import { MaterialesService } from './materiales.service';
import { Permisos } from '../../common/auth/decorators/permisos.decorator';
import { PERMISOS } from '../../common/auth/permisos';

@ApiTags('Materiales')
@Controller('materiales')
export class MaterialesController {
  constructor(private readonly service: MaterialesService) {}

  @Permisos(PERMISOS.MATERIALES_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Crear un material (stock inicial 0; se carga con movimientos)' })
  crear(@Body() dto: CrearMaterialDto) {
    return this.service.crear(dto);
  }

  @Permisos(PERMISOS.MATERIALES_VER)
  @Get()
  @ApiOperation({ summary: 'Listar materiales (paginado, con búsqueda por nombre)' })
  listar(@Query() query: ListarMaterialesDto) {
    return this.service.listar(query);
  }

  @Permisos(PERMISOS.MATERIALES_VER)
  @Get('bajo-stock')
  @ApiOperation({ summary: 'Materiales con stock por debajo (o igual) del mínimo' })
  bajoStock() {
    return this.service.listarBajoStock();
  }

  @Permisos(PERMISOS.MATERIALES_EDITAR)
  @Post('qr/marcar-generados')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dejar constancia de que a estos materiales se les imprimió la etiqueta QR',
    description:
      'Lo llama la pantalla después de mandar a imprimir. Sirve para no volver a imprimir ' +
      'las que ya están pegadas en el estante.',
  })
  marcarQrGenerados(@Body() dto: MarcarQrMaterialesDto) {
    return this.service.marcarQrGenerado(dto.ids);
  }

  // Declarada ANTES de @Get(':id') o la ruta la tomaría como un id.
  @Permisos(PERMISOS.MATERIALES_VER)
  @Get('cobertura-alertas')
  @ApiOperation({
    summary: 'A cuántos materiales puede avisar la alerta de bajo stock, y a cuántos no',
  })
  coberturaAlertas() {
    return this.service.coberturaDeAlertas();
  }

  // Declarada ANTES de @Get(':id') o la ruta la tomaría como un id.
  @Permisos(PERMISOS.MATERIALES_VER)
  @Get('sin-unidad')
  @ApiOperation({ summary: 'Cuántos materiales todavía no tienen unidad cargada' })
  sinUnidad() {
    return this.service.contarSinUnidad();
  }

  @Permisos(PERMISOS.MATERIALES_EDITAR)
  @Post('asignar-unidad-masiva')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Asignar una unidad por defecto a los materiales que no tienen' })
  asignarUnidadMasiva(@Body() dto: AsignarUnidadMasivaDto) {
    return this.service.asignarUnidadMasiva(dto);
  }

  @Permisos(PERMISOS.MATERIALES_VER)
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un material por id' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Permisos(PERMISOS.MATERIALES_VER)
  @Get(':id/historial')
  @ApiOperation({ summary: 'Obtener un material con su historial de movimientos' })
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtenerConHistorial(id);
  }

  @Permisos(PERMISOS.MATERIALES_EDITAR)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un material (no modifica el stock)' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarMaterialDto) {
    return this.service.actualizar(id, dto);
  }

  @Permisos(PERMISOS.MATERIALES_EDITAR)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un material (si no tiene movimientos)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
