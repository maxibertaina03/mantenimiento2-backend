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
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Roles } from '../../../common/auth/decorators/roles.decorator';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Los catálogos del contexto: dónde está el equipo, qué clase de equipo es, y
 * de qué marca y modelo.
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

@ApiTags('Equipos · Marcas')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN)
@Controller('marcas-equipo')
export class MarcasEquipoController {
  constructor(
    private readonly servicio: CatalogosEquipoService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar marcas' })
  listar(@Query('soloActivos') soloActivos?: string) {
    return this.servicio.listar(comoCatalogo(this.prisma.marcaEquipo), soloActivos === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Crear una marca' })
  crear(@Body() dto: CrearItemCatalogoDto) {
    return this.servicio.crear(comoCatalogo(this.prisma.marcaEquipo), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una marca' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarItemCatalogoDto) {
    return this.servicio.actualizar(comoCatalogo(this.prisma.marcaEquipo), id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una marca (solo si no la usa ningún equipo)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.eliminar(comoCatalogo(this.prisma.marcaEquipo), id, 'la marca');
  }
}

export class CrearModeloDto extends CrearItemCatalogoDto {
  @ApiPropertyOptional({ description: 'La marca a la que pertenece', format: 'uuid' })
  @IsUUID()
  marcaId!: string;
}

/**
 * Los modelos, que cuelgan de una marca.
 *
 * No usa el servicio genérico porque tiene una dimensión más: un modelo sin
 * marca no significa nada, y el nombre es único DENTRO de cada marca, no en
 * todo el catálogo. Un "5030" de Grundfos y un "5030" de Siemens conviven sin
 * pisarse.
 */
@ApiTags('Equipos · Modelos')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN)
@Controller('modelos-equipo')
export class ModelosEquipoController {
  constructor(private readonly prisma: PrismaService) {}

  private aItem(f: {
    id: string;
    marcaId: string;
    nombre: string;
    orden: number;
    activo: boolean;
    marca?: { nombre: string } | null;
    _count?: { equipos: number };
  }) {
    return {
      id: f.id,
      marcaId: f.marcaId,
      marcaNombre: f.marca?.nombre ?? null,
      nombre: f.nombre,
      orden: f.orden,
      activo: f.activo,
      equipos: f._count?.equipos ?? 0,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Listar modelos',
    description: 'Con `marcaId`, solo los de esa marca: es lo que usa el desplegable de la ficha.',
  })
  async listar(@Query('marcaId') marcaId?: string, @Query('soloActivos') soloActivos?: string) {
    const filas = await this.prisma.modeloEquipo.findMany({
      where: {
        ...(marcaId ? { marcaId } : {}),
        ...(soloActivos === 'true' ? { activo: true } : {}),
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { marca: { select: { nombre: true } }, _count: { select: { equipos: true } } },
    });
    return filas.map((f) => this.aItem(f));
  }

  @Post()
  @ApiOperation({ summary: 'Crear un modelo dentro de una marca' })
  async crear(@Body() dto: CrearModeloDto) {
    const marca = await this.prisma.marcaEquipo.findUnique({ where: { id: dto.marcaId } });
    if (!marca) {
      throw new NotFoundException(`No existe la marca con id ${dto.marcaId}`);
    }
    const nombre = dto.nombre.trim();

    // El índice único ya lo garantiza; esto lo convierte en un mensaje que se
    // entiende, en vez de un error de restricción de la base.
    const repetido = await this.prisma.modeloEquipo.findFirst({
      where: { marcaId: dto.marcaId, nombre: { equals: nombre, mode: 'insensitive' } },
    });
    if (repetido) {
      throw new BadRequestException(
        `${marca.nombre} ya tiene un modelo "${repetido.nombre}". Usá ese en vez de crear otro.`,
      );
    }

    const fila = await this.prisma.modeloEquipo.create({
      data: { marcaId: dto.marcaId, nombre, orden: dto.orden ?? 0, activo: dto.activo ?? true },
      include: { marca: { select: { nombre: true } }, _count: { select: { equipos: true } } },
    });
    return this.aItem(fila);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un modelo, o desactivarlo' })
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarItemCatalogoDto) {
    const fila = await this.prisma.modeloEquipo.update({
      where: { id },
      data: { nombre: dto.nombre?.trim(), orden: dto.orden, activo: dto.activo },
      include: { marca: { select: { nombre: true } }, _count: { select: { equipos: true } } },
    });
    return this.aItem(fila);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un modelo (solo si no lo usa ningún equipo)' })
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    const fila = await this.prisma.modeloEquipo.findUnique({
      where: { id },
      include: { _count: { select: { equipos: true } } },
    });
    if (!fila) throw new NotFoundException(`No existe el modelo con id ${id}`);
    if (fila._count.equipos > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${fila.nombre}": lo usan ${fila._count.equipos} equipo(s). ` +
          'Si ya no se usa, desactivalo en vez de borrarlo.',
      );
    }
    await this.prisma.modeloEquipo.delete({ where: { id } });
  }
}
