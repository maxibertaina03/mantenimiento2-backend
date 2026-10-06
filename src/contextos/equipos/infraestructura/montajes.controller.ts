import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import type { Usuario } from '@prisma/client';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Permisos } from '../../../common/auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../../common/auth/decorators/usuario-actual.decorator';
import { PERMISOS } from '../../../common/auth/permisos';
import { FiltroErroresDominio } from '../../../common/dominio/filtro-errores-dominio';
import { GestionarMontajes } from '../aplicacion/gestionar-montajes';

export class MontarEquipoDto {
  @ApiProperty({ format: 'uuid', description: 'La máquina donde se monta' })
  @IsUUID()
  equipoPadreId!: string;

  @ApiPropertyOptional({ example: 'Se cambió por la de repuesto' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class DesmontarEquipoDto {
  @ApiPropertyOptional({ example: 'Se mandó a rebobinar' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

/**
 * Equipos montados dentro de otros: la electrobomba en la desnatadora.
 *
 * Trasladar es montar en otra máquina: no hace falta desmontar antes.
 */
@ApiTags('Equipos')
@ApiBearerAuth()
@UseFilters(FiltroErroresDominio)
@Controller('equipos/:id')
export class MontajesController {
  constructor(private readonly gestionar: GestionarMontajes) {}

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get('componentes')
  @ApiOperation({ summary: 'Los equipos montados en esta máquina (primer nivel)' })
  componentes(@Param('id', ParseUUIDPipe) id: string) {
    return this.gestionar.componentes(id);
  }

  @Permisos(PERMISOS.EQUIPOS_VER)
  @Get('montajes')
  @ApiOperation({ summary: 'Por qué máquinas pasó este equipo, del tramo más nuevo al más viejo' })
  montajes(@Param('id', ParseUUIDPipe) id: string) {
    return this.gestionar.historial(id);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Post('montar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Montar este equipo en una máquina (o trasladarlo a otra)',
    description: 'Si ya estaba montado en otra, ese tramo se cierra en el mismo momento.',
  })
  montar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MontarEquipoDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return this.gestionar.montar(id, dto.equipoPadreId, usuario?.id ?? null, dto.motivo);
  }

  @Permisos(PERMISOS.EQUIPOS_EDITAR)
  @Post('desmontar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desmontar este equipo de la máquina donde está' })
  desmontar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DesmontarEquipoDto) {
    return this.gestionar.desmontar(id, dto.motivo);
  }
}
