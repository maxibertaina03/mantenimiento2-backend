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
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { buscarNombreRepetido, normalizarNombre } from '../../common/dominio/nombres';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Permisos } from '../../common/auth/decorators/permisos.decorator';
import { PERMISOS } from '../../common/auth/permisos';

/**
 * Quién tiene a cargo cada equipo de informática.
 *
 * Se planteó mal al principio: cada persona a la que se le asignaba una
 * notebook entraba como usuario del sistema, con un correo inventado terminado
 * en `@sin-acceso.local` y un rol que nunca usaba. De 35 usuarios, 31 existían
 * solo para figurar en una asignación.
 *
 * Y varios ni siquiera son personas: "Operarios de expedición", "Queco y
 * German", "José Luis y Mónica". Un sector, o dos personas compartiendo una
 * máquina, nunca van a poder ser un usuario con clave.
 *
 * Es un ABM de tres campos con dos reglas, así que va escrito derecho contra
 * Prisma. Las capas están donde hay reglas que proteger.
 */
export class CrearResponsableDto {
  @ApiPropertyOptional({ example: 'Julieta Redolfi' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ example: 'Administración' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;
}

export class ActualizarResponsableDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) sector?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notas?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

interface ResponsableConUso {
  id: string;
  nombre: string;
  sector: string | null;
  notas: string | null;
  activo: boolean;
  /** Cuántos equipos tiene a cargo AHORA. Si es > 0 no se puede borrar. */
  equipos: number;
  /** Cuántas veces figuró en el historial, incluso por equipos que ya devolvió. */
  asignaciones: number;
}

@Injectable()
export class ResponsablesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly conUso = {
    _count: { select: { equiposIt: true, asignaciones: true } },
  };

  private aItem(f: {
    id: string;
    nombre: string;
    sector: string | null;
    notas: string | null;
    activo: boolean;
    _count?: { equiposIt: number; asignaciones: number };
  }): ResponsableConUso {
    return {
      id: f.id,
      nombre: f.nombre,
      sector: f.sector,
      notas: f.notas,
      activo: f.activo,
      equipos: f._count?.equiposIt ?? 0,
      asignaciones: f._count?.asignaciones ?? 0,
    };
  }

  /**
   * Rechaza un nombre que ya está en la lista, salvo que sea el del propio
   * responsable. Se compara en memoria porque Postgres, sin la extensión
   * `unaccent`, no ignora los acentos: ver `common/dominio/nombres`.
   */
  private async verificarNombreLibre(nombre: string, exceptoId?: string): Promise<void> {
    const todos = await this.prisma.responsable.findMany({ select: { id: true, nombre: true } });
    const repetido = buscarNombreRepetido(todos, nombre, exceptoId);
    if (repetido) {
      throw new BadRequestException(
        `Ya hay un responsable llamado "${repetido.nombre}". Usá ese en vez de cargar otro: ` +
          'dos fichas para la misma persona reparten sus equipos entre las dos.',
      );
    }
  }

  async listar(soloActivos: boolean): Promise<ResponsableConUso[]> {
    const filas = await this.prisma.responsable.findMany({
      where: soloActivos ? { activo: true } : {},
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      include: this.conUso,
    });
    return filas.map((f) => this.aItem(f));
  }

  async obtener(id: string): Promise<ResponsableConUso> {
    const fila = await this.prisma.responsable.findUnique({
      where: { id },
      include: this.conUso,
    });
    if (!fila) throw new NotFoundException(`No existe el responsable con id ${id}`);
    return this.aItem(fila);
  }

  async crear(dto: CrearResponsableDto): Promise<ResponsableConUso> {
    const nombre = normalizarNombre(dto.nombre);
    await this.verificarNombreLibre(nombre);

    const fila = await this.prisma.responsable.create({
      data: { nombre, sector: dto.sector?.trim() || null, notas: dto.notas?.trim() || null },
      include: this.conUso,
    });
    return this.aItem(fila);
  }

  async actualizar(id: string, dto: ActualizarResponsableDto): Promise<ResponsableConUso> {
    await this.obtener(id);
    const nombre = dto.nombre !== undefined ? normalizarNombre(dto.nombre) : undefined;
    if (nombre) await this.verificarNombreLibre(nombre, id);

    const fila = await this.prisma.responsable.update({
      where: { id },
      data: {
        nombre,
        sector: dto.sector !== undefined ? dto.sector.trim() || null : undefined,
        notas: dto.notas !== undefined ? dto.notas.trim() || null : undefined,
        activo: dto.activo,
      },
      include: this.conUso,
    });
    return this.aItem(fila);
  }

  /**
   * Mueve todos los equipos y el historial de uno a otro, y desactiva el que
   * queda vacío.
   *
   * Existe porque la carga original dejó a la misma persona dos veces con
   * nombres distintos: "Julieta" y "Julieta Redolfi", "Romi Ubino" y "Romina
   * Ubino". Nadie de afuera puede saber cuáles son la misma persona; quien lo
   * sabe es quien usa el sistema, y desde acá lo resuelve en un clic.
   */
  async unificar(idQueQueda: string, idQueSeAbsorbe: string): Promise<ResponsableConUso> {
    if (idQueQueda === idQueSeAbsorbe) {
      throw new BadRequestException('Son el mismo responsable.');
    }
    const queda = await this.obtener(idQueQueda);
    await this.obtener(idQueSeAbsorbe);

    await this.prisma.$transaction(async (tx) => {
      await tx.equipoIT.updateMany({
        where: { responsableId: idQueSeAbsorbe },
        data: { responsableId: idQueQueda },
      });
      await tx.asignacionEquipoIT.updateMany({
        where: { responsableId: idQueSeAbsorbe },
        data: { responsableId: idQueQueda },
      });
      // No se borra: si mañana aparece que eran dos personas distintas, el
      // nombre sigue estando y se puede volver a activar.
      await tx.responsable.update({
        where: { id: idQueSeAbsorbe },
        data: { activo: false },
      });
    });

    return this.obtener(queda.id);
  }

  /**
   * Solo se borra un responsable que no tenga equipos ni historial. Si tuvo
   * alguno alguna vez, lo correcto es desactivarlo: deja de ofrecerse al
   * asignar, pero el historial sigue diciendo quién tenía cada equipo.
   */
  async eliminar(id: string): Promise<void> {
    const r = await this.obtener(id);
    if (r.equipos > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${r.nombre}": tiene ${r.equipos} equipo(s) a cargo. ` +
          'Pasalos a otro responsable primero.',
      );
    }
    if (r.asignaciones > 0) {
      throw new BadRequestException(
        `No se puede eliminar "${r.nombre}": figura en ${r.asignaciones} movimiento(s) del ` +
          'historial. Si ya no está, desactivalo en vez de borrarlo.',
      );
    }
    await this.prisma.responsable.delete({ where: { id } });
  }
}

@ApiTags('Responsables de equipos')
@ApiBearerAuth()
@Controller('responsables')
export class ResponsablesController {
  constructor(private readonly service: ResponsablesService) {}

  @Permisos(PERMISOS.IT_VER)
  @Get()
  @ApiOperation({
    summary: 'Listar responsables',
    description: 'No son usuarios del sistema: son las personas o sectores que tienen un equipo.',
  })
  listar(@Query('soloActivos') soloActivos?: string) {
    return this.service.listar(soloActivos === 'true');
  }

  @Permisos(PERMISOS.IT_VER)
  @Get(':id')
  @ApiOperation({ summary: 'La ficha de un responsable' })
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Post()
  @ApiOperation({ summary: 'Cargar un responsable' })
  crear(@Body() dto: CrearResponsableDto) {
    return this.service.crear(dto);
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Post(':id/unificar/:otroId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Unificar dos responsables que son la misma persona',
    description:
      'Los equipos y el historial del segundo pasan al primero, y el segundo queda desactivado.',
  })
  unificar(@Param('id', ParseUUIDPipe) id: string, @Param('otroId', ParseUUIDPipe) otroId: string) {
    return this.service.unificar(id, otroId);
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar un responsable, o desactivarlo' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarResponsableDto) {
    return this.service.actualizar(id, dto);
  }

  @Permisos(PERMISOS.IT_EDITAR)
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un responsable sin equipos ni historial' })
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
