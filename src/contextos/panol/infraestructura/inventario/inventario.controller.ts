import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Permisos } from '../../../../common/auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../../../common/auth/decorators/usuario-actual.decorator';
import { PERMISOS } from '../../../../common/auth/permisos';
import { RegistrarMovimientos } from '../../aplicacion/registrar-movimientos';
import { TomarInventario } from '../../aplicacion/tomar-inventario';
import {
  REPOSITORIO_MOVIMIENTOS,
  RepositorioMovimientos,
} from '../../puertos/repositorio-movimientos';
import { REPOSITORIO_TOMAS, RepositorioTomas } from '../../puertos/repositorio-tomas';
import { traducirErrores } from '../traducir-errores';

export class AbrirTomaDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Contar solo esta categoría' })
  @IsOptional()
  @IsUUID()
  categoriaId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Contar solo esta estantería' })
  @IsOptional()
  @IsUUID()
  estanteriaId?: string | null;

  @ApiPropertyOptional({ example: 'Conteo de fin de mes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string | null;
}

export class ContarDto {
  @ApiProperty({
    example: 12,
    nullable: true,
    description: 'Lo que se contó. null borra el conteo de ese material.',
  })
  @ValidateIf((_, valor) => valor !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  contado!: number | null;
}

export class ContarEnCeroDto {
  @ApiProperty({
    type: [String],
    description: 'Los renglones que se miraron y están en 0 (los de la pestaña «En cero»).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  renglonIds!: string[];
}

export class ReubicarDto {
  @ApiProperty({ format: 'uuid', description: 'La estantería donde quedó el material' })
  @IsUUID()
  estanteriaId!: string;

  @ApiPropertyOptional({ nullable: true, example: 3, description: 'La fila. Vacía: no se sabe.' })
  @ValidateIf((_, valor) => valor !== null && valor !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  fila?: number | null;
}

export class AnularTomaDto {
  @ApiProperty({ example: 'Se abrió sobre la estantería equivocada' })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo!: string;
}

/** Arma el caso de uso con sus dos repositorios: el de las tomas y el de los movimientos. */
@Injectable()
export class TomasInventarioService {
  readonly casoDeUso: TomarInventario;

  constructor(
    @Inject(REPOSITORIO_TOMAS) tomas: RepositorioTomas,
    @Inject(REPOSITORIO_MOVIMIENTOS) movimientos: RepositorioMovimientos,
  ) {
    this.casoDeUso = new TomarInventario(tomas, new RegistrarMovimientos(movimientos));
  }
}

/**
 * La toma de inventario: abrir, contar, confirmar.
 *
 * Con permisos propios, que reparte el administrador: ver, contar (abrir y
 * cargar conteos) y ajustar (confirmar, cerrar y anular).
 */
@ApiTags('Toma de inventario')
@ApiBearerAuth()
@Controller('tomas-inventario')
export class InventarioController {
  constructor(private readonly servicio: TomasInventarioService) {}

  private get tomas() {
    return this.servicio.casoDeUso;
  }

  @Permisos(PERMISOS.INVENTARIO_VER)
  @Get()
  @ApiOperation({ summary: 'Las tomas, la última primero' })
  listar() {
    return traducirErrores(() => this.tomas.listar());
  }

  @Permisos(PERMISOS.INVENTARIO_CONTAR)
  @Post()
  @ApiOperation({ summary: 'Abrir una toma sobre una categoría, una estantería o todo el pañol' })
  abrir(@Body() dto: AbrirTomaDto, @UsuarioActual() usuario?: Usuario) {
    return traducirErrores(() => this.tomas.abrir(dto, usuario?.id ?? null));
  }

  @Permisos(PERMISOS.INVENTARIO_VER)
  @Get(':id')
  @ApiOperation({ summary: 'La toma con sus renglones y el resumen' })
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return traducirErrores(() => this.tomas.detalle(id));
  }

  @Permisos(PERMISOS.INVENTARIO_CONTAR)
  @Patch(':id/renglones/:renglonId')
  @ApiOperation({ summary: 'Cargar (o corregir, o borrar) lo que se contó de un material' })
  contar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('renglonId', ParseUUIDPipe) renglonId: string,
    @Body() dto: ContarDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return traducirErrores(() =>
      this.tomas.contar(id, renglonId, dto.contado, usuario?.id ?? null),
    );
  }

  @Permisos(PERMISOS.INVENTARIO_CONTAR)
  @Post(':id/contar-en-cero')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dar por contados en 0 los materiales que figuran en 0',
    description:
      'Solo los que siguen figurando en 0 y sin contar: si a alguno le entró stock mientras ' +
      'tanto, se saltea y se avisa en `salteados`.',
  })
  contarEnCero(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContarEnCeroDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return traducirErrores(() => this.tomas.contarEnCero(id, dto.renglonIds, usuario?.id ?? null));
  }

  @Permisos(PERMISOS.INVENTARIO_CONTAR)
  @Post(':id/renglones/:renglonId/reubicar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambiar de lugar un material de la toma',
    description:
      'El material queda con la ubicación nueva en todo el sistema, y la toma guarda de dónde ' +
      'a dónde se movió, quién y cuándo. Solo con la toma abierta.',
  })
  reubicar(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('renglonId', ParseUUIDPipe) renglonId: string,
    @Body() dto: ReubicarDto,
    @UsuarioActual() usuario?: Usuario,
  ) {
    return traducirErrores(() =>
      this.tomas.reubicar(
        id,
        renglonId,
        { estanteriaId: dto.estanteriaId, fila: dto.fila ?? null },
        usuario?.id ?? null,
      ),
    );
  }

  @Permisos(PERMISOS.INVENTARIO_AJUSTAR)
  @Post(':id/confirmar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ajustar el stock a lo contado',
    description:
      'Cada diferencia genera un AJUSTE con la nota de la toma. Lo que se movió después de ' +
      'contarlo queda para volver a contar, y la toma sigue abierta. Lo no contado no se toca.',
  })
  confirmar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario?: Usuario) {
    return traducirErrores(() => this.tomas.confirmar(id, usuario?.id ?? null));
  }

  @Permisos(PERMISOS.INVENTARIO_AJUSTAR)
  @Post(':id/cerrar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dar por terminada la toma',
    description: 'Lo que no se contó queda como estaba. Lo contado tiene que estar confirmado.',
  })
  cerrar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario?: Usuario) {
    return traducirErrores(() => this.tomas.cerrar(id, usuario?.id ?? null));
  }

  @Permisos(PERMISOS.INVENTARIO_AJUSTAR)
  @Post(':id/anular')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anular una toma que todavía no ajustó nada' })
  anular(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnularTomaDto) {
    return traducirErrores(() => this.tomas.anular(id, dto.motivo));
  }
}
