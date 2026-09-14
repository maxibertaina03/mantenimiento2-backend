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
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buscarNombreRepetido } from '../../common/dominio/nombres';

/**
 * Las estanterías del depósito.
 *
 * Es un ABM de tres campos con una sola regla —no se borra lo que está en uso—
 * así que va escrito derecho contra Prisma, sin entidad ni caso de uso. Las
 * capas están donde hay reglas que proteger.
 */
export class CrearEstanteriaDto {
  @ApiPropertyOptional({ example: 'Estantería A' })
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
}

export class ActualizarEstanteriaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(60) nombre?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) orden?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

interface EstanteriaConUso {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  /** Cuántos materiales están guardados ahí: si es > 0 no se puede borrar. */
  materiales: number;
}

@Injectable()
export class EstanteriasMaterialService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly conUso = { _count: { select: { materiales: true } } };

  private aItem(f: {
    id: string;
    nombre: string;
    orden: number;
    activo: boolean;
    _count?: { materiales: number };
  }): EstanteriaConUso {
    return {
      id: f.id,
      nombre: f.nombre,
      orden: f.orden,
      activo: f.activo,
      materiales: f._count?.materiales ?? 0,
    };
  }

  async listar(soloActivas: boolean): Promise<EstanteriaConUso[]> {
    const filas = await this.prisma.estanteriaMaterial.findMany({
      where: soloActivas ? { activo: true } : {},
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: this.conUso,
    });
    return filas.map((f) => this.aItem(f));
  }

  /**
   * Rechaza un nombre que ya está en uso, salvo que sea el de la propia
   * estantería. Se compara en memoria porque Postgres, sin la extensión
   * `unaccent`, no ignora los acentos: ver `common/dominio/nombres`.
   */
  private async verificarNombreLibre(nombre: string, exceptoId?: string): Promise<void> {
    const todas = await this.prisma.estanteriaMaterial.findMany({
      select: { id: true, nombre: true },
    });
    const repetida = buscarNombreRepetido(todas, nombre, exceptoId);
    if (repetida) {
      throw new BadRequestException(
        `Ya existe una estantería llamada "${repetida.nombre}". Usá esa en vez de crear otra.`,
      );
    }
  }

  async crear(dto: CrearEstanteriaDto): Promise<EstanteriaConUso> {
    const nombre = dto.nombre.trim();
    await this.verificarNombreLibre(nombre);

    const fila = await this.prisma.estanteriaMaterial.create({
      data: { nombre, orden: dto.orden ?? 0 },
      include: this.conUso,
    });
    return this.aItem(fila);
  }

  async actualizar(id: string, dto: ActualizarEstanteriaDto): Promise<EstanteriaConUso> {
    // También al renombrar: sin esto, «Estantería B» se puede pasar a llamar
    // «Estanteria A» y quedan dos, que es el mismo problema por la otra puerta.
    if (dto.nombre) await this.verificarNombreLibre(dto.nombre.trim(), id);

    const fila = await this.prisma.estanteriaMaterial.update({
      where: { id },
      data: { nombre: dto.nombre?.trim(), orden: dto.orden, activo: dto.activo },
      include: this.conUso,
    });
    return this.aItem(fila);
  }

  /**
   * Solo se borra lo que no usa ningún material. Si está en uso, lo correcto es
   * desactivarla: deja de ofrecerse al cargar, pero los materiales que ya están
   * ahí conservan su ubicación.
   */
  async eliminar(id: string): Promise<void> {
    const fila = await this.prisma.estanteriaMaterial.findUnique({
      where: { id },
      include: this.conUso,
    });
    if (!fila) throw new NotFoundException(`No existe la estantería con id ${id}`);

    const item = this.aItem(fila);
    if (item.materiales > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${item.nombre}": hay ${item.materiales} material(es) guardados ahí. ` +
          'Si ya no se usa, desactivala en vez de borrarla.',
      );
    }
    await this.prisma.estanteriaMaterial.delete({ where: { id } });
  }
}

@ApiTags('Estanterías de material')
@Controller('estanterias-material')
export class EstanteriasMaterialController {
  constructor(private readonly service: EstanteriasMaterialService) {}

  @Get()
  @ApiOperation({ summary: 'Listar estanterías del depósito' })
  listar(@Query('soloActivas') soloActivas?: string) {
    return this.service.listar(soloActivas === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Crear una estantería' })
  crear(@Body() dto: CrearEstanteriaDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una estantería, o desactivarla' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarEstanteriaDto) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una estantería (solo si no la usa ningún material)' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
