import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import type { Usuario } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { PERMISOS } from '../../../common/auth/permisos';
import { FiltroErroresDominio } from '../../../common/dominio/filtro-errores-dominio';
import { GestionarRepuestos } from '../aplicacion/gestionar-repuestos';
import { MAX_NOTAS_REPUESTO } from '../dominio/repuesto';

export class CambiarRepuestoDto {
  @ApiPropertyOptional({ example: 2, description: 'Cuántos lleva la máquina. null = no se dice.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  cantidad?: number | null;

  @ApiPropertyOptional({ example: 'Lado motor' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTAS_REPUESTO)
  notas?: string | null;
}

export class AgregarRepuestoDto extends CambiarRepuestoDto {
  @ApiProperty({ format: 'uuid', description: 'El material del pañol' })
  @IsUUID()
  materialId!: string;
}

/**
 * Los repuestos de cada equipo: qué materiales del pañol lleva la máquina.
 *
 * No mueven stock. Lo que se usa en una reparación sigue saliendo por las
 * órdenes de trabajo; esto es la lista de qué ir a buscar.
 */
@ApiTags('Equipos')
@ApiBearerAuth()
@UseFilters(FiltroErroresDominio)
@Controller('equipos')
export class RepuestosController {
  constructor(private readonly gestionar: GestionarRepuestos) {}

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get('de-material/:materialId')
  @ApiOperation({ summary: 'Los equipos que llevan este material como repuesto' })
  deMaterial(@Param('materialId', ParseUUIDPipe) materialId: string) {
    return this.gestionar.equiposQueLoUsan(materialId);
  }

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get(':id/repuestos')
  @ApiOperation({ summary: 'Los repuestos de este equipo, con el stock del pañol' })
  listar(@Param('id', ParseUUIDPipe) id: string) {
    return this.gestionar.listar(id);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Post(':id/repuestos')
  @ApiOperation({ summary: 'Sumar un material del pañol a los repuestos de este equipo' })
  agregar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AgregarRepuestoDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.gestionar.agregar(id, dto, usuario?.id ?? null);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Patch(':id/repuestos/:repuestoId')
  @ApiOperation({ summary: 'Cambiar la cantidad o la nota de un repuesto' })
  cambiar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('repuestoId', ParseUUIDPipe) repuestoId: string,
    @Body() dto: CambiarRepuestoDto,
  ) {
    return this.gestionar.cambiar(id, repuestoId, dto);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Delete(':id/repuestos/:repuestoId')
  @ApiOperation({ summary: 'Sacar un material de los repuestos de este equipo' })
  quitar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('repuestoId', ParseUUIDPipe) repuestoId: string,
  ) {
    return this.gestionar.quitar(id, repuestoId);
  }
}
