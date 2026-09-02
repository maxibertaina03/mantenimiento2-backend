import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Roles } from '../../../common/auth/decorators/roles.decorator';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Los dos catálogos del contexto: dónde está el equipo y qué clase de equipo es.
 *
 * Van escritos derecho contra Prisma, sin dominio ni puertos. Es deliberado:
 * son ABM de tres campos con una sola regla —no se borra lo que está en uso— y
 * envolverlos en entidad, caso de uso y mapper triplicaría los archivos sin
 * agregar una sola garantía. Las capas están donde hay reglas que proteger.
 */
export class CrearItemCatalogoDto {
  @ApiPropertyOptional({ example: 'Caldera' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre!: string;

  @ApiPropertyOptional({ description: 'Orden en el listado', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({ description: 'Los inactivos no se ofrecen al cargar' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarItemCatalogoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(60) nombre?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) orden?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

/** La forma que comparten los dos catálogos, con el conteo de uso. */
interface ItemCatalogo {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  equipos: number;
}

/** La fila que devuelven los dos catálogos, con el conteo de uso incluido. */
interface FilaCatalogo {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  _count?: { equipos: number };
}

/**
 * Lo mínimo que este servicio le pide a un delegado de Prisma.
 *
 * Se declara la forma en vez de usar `Function`: así TypeScript sigue
 * verificando qué devuelve cada llamada, en lugar de aceptar cualquier cosa
 * invocable.
 */
interface DelegadoCatalogo {
  findMany(args: unknown): Promise<FilaCatalogo[]>;
  findUnique(args: unknown): Promise<FilaCatalogo | null>;
  create(args: unknown): Promise<FilaCatalogo>;
  update(args: unknown): Promise<FilaCatalogo>;
  delete(args: unknown): Promise<unknown>;
}

/** Los delegados de Prisma cumplen esta forma; el cast se hace una sola vez. */
function comoCatalogo(delegado: unknown): DelegadoCatalogo {
  return delegado as DelegadoCatalogo;
}

/**
 * La lógica es idéntica para los dos catálogos, así que vive una sola vez.
 * Duplicarla garantizaría que en algún momento se arregle un bug en uno y no
 * en el otro.
 */
@Injectable()
export class CatalogosEquipoService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly conUso = { _count: { select: { equipos: true } } };

  private aItem(fila: FilaCatalogo): ItemCatalogo {
    return {
      id: fila.id,
      nombre: fila.nombre,
      orden: fila.orden,
      activo: fila.activo,
      equipos: fila._count?.equipos ?? 0,
    };
  }

  async listar(delegado: DelegadoCatalogo, soloActivos: boolean): Promise<ItemCatalogo[]> {
    const filas = await delegado.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: this.conUso,
    });
    return filas.map((f) => this.aItem(f));
  }

  async crear(delegado: DelegadoCatalogo, dto: CrearItemCatalogoDto): Promise<ItemCatalogo> {
    const fila = await delegado.create({
      data: { nombre: dto.nombre.trim(), orden: dto.orden ?? 0, activo: dto.activo ?? true },
      include: this.conUso,
    });
    return this.aItem(fila);
  }

  async actualizar(
    delegado: DelegadoCatalogo,
    id: string,
    dto: ActualizarItemCatalogoDto,
  ): Promise<ItemCatalogo> {
    const fila = await delegado.update({
      where: { id },
      data: { nombre: dto.nombre?.trim(), orden: dto.orden, activo: dto.activo },
      include: this.conUso,
    });
    return this.aItem(fila);
  }

  /**
   * Solo se borra lo que no usa ningún equipo. Si está en uso, lo correcto es
   * desactivarlo: deja de ofrecerse al cargar, pero los equipos que ya lo
   * tienen conservan su ubicación o su tipo.
   */
  async eliminar(delegado: DelegadoCatalogo, id: string, que: string): Promise<void> {
    const fila = await delegado.findUnique({ where: { id }, include: this.conUso });
    if (!fila) {
      throw new NotFoundException(`No existe ${que} con id ${id}`);
    }
    const item = this.aItem(fila);
    if (item.equipos > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${item.nombre}": lo usan ${item.equipos} equipo(s). ` +
          'Si ya no se usa, desactivalo en vez de borrarlo.',
      );
    }
    await delegado.delete({ where: { id } });
  }
}

@ApiTags('Equipos · Ubicaciones')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN)
@Controller('ubicaciones-equipo')
export class UbicacionesEquipoController {
  constructor(
    private readonly servicio: CatalogosEquipoService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar ubicaciones' })
  listar(@Query('soloActivos') soloActivos?: string) {
    return this.servicio.listar(comoCatalogo(this.prisma.ubicacionEquipo), soloActivos === 'true');
  }

  @Post()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Crear una ubicación' })
  crear(@Body() dto: CrearItemCatalogoDto) {
    return this.servicio.crear(comoCatalogo(this.prisma.ubicacionEquipo), dto);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Editar una ubicación' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarItemCatalogoDto) {
    return this.servicio.actualizar(comoCatalogo(this.prisma.ubicacionEquipo), id, dto);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una ubicación (solo si no la usa ningún equipo)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.eliminar(comoCatalogo(this.prisma.ubicacionEquipo), id, 'la ubicación');
  }
}

@ApiTags('Equipos · Tipos')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN)
@Controller('tipos-equipo-planta')
export class TiposEquipoPlantaController {
  constructor(
    private readonly servicio: CatalogosEquipoService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar tipos de equipo de planta' })
  listar(@Query('soloActivos') soloActivos?: string) {
    return this.servicio.listar(comoCatalogo(this.prisma.tipoEquipoPlanta), soloActivos === 'true');
  }

  @Post()
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Crear un tipo' })
  crear(@Body() dto: CrearItemCatalogoDto) {
    return this.servicio.crear(comoCatalogo(this.prisma.tipoEquipoPlanta), dto);
  }

  @Patch(':id')
  @Roles(RolUsuario.ADMIN)
  @ApiOperation({ summary: 'Editar un tipo' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarItemCatalogoDto) {
    return this.servicio.actualizar(comoCatalogo(this.prisma.tipoEquipoPlanta), id, dto);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un tipo (solo si no lo usa ningún equipo)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.eliminar(comoCatalogo(this.prisma.tipoEquipoPlanta), id, 'el tipo');
  }
}
