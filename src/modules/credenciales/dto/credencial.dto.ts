import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoCredencial } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';
import { EstadoRotacion, estadoDeRotacion } from '../rotacion';

/**
 * Los DTO validan la FORMA de lo que llega. Que una contraseña no se pueda
 * repetir, o que solo un ADMIN pueda verla, son reglas y viven en el servicio.
 */
export class CrearCredencialDto {
  @ApiProperty({ example: 'Correo administración' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ enum: TipoCredencial, default: TipoCredencial.OTRO })
  @IsOptional()
  @IsEnum(TipoCredencial)
  tipo?: TipoCredencial;

  @ApiPropertyOptional({ example: 'administracion@lacteoslastres.com.ar' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  usuario?: string;

  @ApiProperty({ description: 'La contraseña. Se guarda cifrada y nunca vuelve en un listado.' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  secreto!: string;

  @ApiPropertyOptional({ example: 'https://webmail.lacteoslastres.com.ar' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;

  @ApiPropertyOptional({ description: 'Si el acceso pertenece a un equipo de IT', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoItId?: string;

  @ApiPropertyOptional({ description: 'Cada cuántos días hay que cambiarla', example: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rotarCadaDias?: number;
}

/** Editar los datos de alrededor. La contraseña se cambia rotando, no editando. */
export class ActualizarCredencialDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nombre?: string;
  @ApiPropertyOptional({ enum: TipoCredencial })
  @IsOptional()
  @IsEnum(TipoCredencial)
  tipo?: TipoCredencial;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) usuario?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notas?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() equipoItId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rotarCadaDias?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}

export class RotarCredencialDto {
  @ApiProperty({ description: 'La contraseña nueva' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  secreto!: string;

  @ApiPropertyOptional({
    description: 'Por qué se rota: vencimiento, sospecha, alguien que se fue',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class ListarCredencialesDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Busca en nombre, usuario y notas' })
  @IsOptional()
  @IsString()
  buscar?: string;

  @ApiPropertyOptional({ enum: TipoCredencial })
  @IsOptional()
  @IsEnum(TipoCredencial)
  tipo?: TipoCredencial;

  @ApiPropertyOptional({ description: 'Las de un equipo de IT', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  equipoItId?: string;

  @ApiPropertyOptional({
    description: 'Solo las que hay que rotar: `vencida`, `por-vencer`, o `pendiente` para ambas',
    enum: ['vencida', 'por-vencer', 'pendiente'],
  })
  @IsOptional()
  @IsString()
  rotacion?: string;

  @ApiPropertyOptional({ description: 'Por defecto solo las activas', enum: ['activas', 'todas'] })
  @IsOptional()
  @IsString()
  mostrar?: string;
}

/** Forma de la fila que llega del repositorio. */
interface FilaCredencial {
  id: string;
  nombre: string;
  tipo: TipoCredencial;
  usuario: string | null;
  url: string | null;
  notas: string | null;
  equipoItId: string | null;
  rotarCadaDias: number | null;
  rotadaEn: Date;
  proximaRotacion: Date | null;
  activo: boolean;
  creadoEn: Date;
  equipoIt?: { codigoInterno: string | null; marca: string; modelo: string } | null;
  _count?: { rotaciones: number; vistas: number };
}

/**
 * Lo que sale por la API.
 *
 * No tiene `secreto`, ni `secretoCifrado`, ni `huella`. No es un descuido: la
 * contraseña se pide aparte, y ese pedido queda registrado. Si viajara en el
 * listado, cualquier pantalla que muestre credenciales la tendría en memoria y
 * el registro de quién la vio no querría decir nada.
 */
export class CredencialRespuestaDto {
  @ApiProperty() id!: string;
  @ApiProperty() nombre!: string;
  @ApiProperty({ enum: TipoCredencial }) tipo!: TipoCredencial;
  @ApiPropertyOptional() usuario!: string | null;
  @ApiPropertyOptional() url!: string | null;
  @ApiPropertyOptional() notas!: string | null;
  @ApiPropertyOptional() equipoItId!: string | null;
  @ApiPropertyOptional({ description: 'Cómo se llama el equipo, para mostrarlo sin otra consulta' })
  equipoItNombre!: string | null;
  @ApiPropertyOptional() rotarCadaDias!: number | null;
  @ApiProperty() rotadaEn!: Date;
  @ApiPropertyOptional() proximaRotacion!: Date | null;
  @ApiProperty({ enum: ['sin-rotacion', 'al-dia', 'por-vencer', 'vencida'] })
  estadoRotacion!: EstadoRotacion;
  @ApiProperty({ description: 'Cuántas veces se rotó' }) rotaciones!: number;
  @ApiProperty({ description: 'Cuántas veces se vio la contraseña' }) vistas!: number;
  @ApiProperty() activo!: boolean;
  @ApiProperty() creadoEn!: Date;

  static desde(f: FilaCredencial, hoy: Date): CredencialRespuestaDto {
    const equipo = f.equipoIt;
    return {
      id: f.id,
      nombre: f.nombre,
      tipo: f.tipo,
      usuario: f.usuario,
      url: f.url,
      notas: f.notas,
      equipoItId: f.equipoItId,
      equipoItNombre: equipo
        ? [equipo.codigoInterno, equipo.marca, equipo.modelo].filter(Boolean).join(' ')
        : null,
      rotarCadaDias: f.rotarCadaDias,
      rotadaEn: f.rotadaEn,
      proximaRotacion: f.proximaRotacion,
      estadoRotacion: estadoDeRotacion(f.proximaRotacion, hoy),
      rotaciones: f._count?.rotaciones ?? 0,
      vistas: f._count?.vistas ?? 0,
      activo: f.activo,
      creadoEn: f.creadoEn,
    };
  }
}

/** Lo único que devuelve el endpoint de revelar. */
export class SecretoReveladoDto {
  @ApiProperty() id!: string;
  @ApiProperty() nombre!: string;
  @ApiPropertyOptional() usuario!: string | null;
  @ApiProperty({ description: 'La contraseña en claro. No se registra en ningún log.' })
  secreto!: string;
  @ApiProperty({ description: 'Queda anotado que se vio, con quién y cuándo' }) vistaEn!: Date;
}

/** Una rotación del historial. Sin la contraseña vieja: solo el hecho. */
export class RotacionRespuestaDto {
  @ApiProperty() id!: string;
  @ApiProperty() rotadaEn!: Date;
  @ApiPropertyOptional() rotadaPor!: string | null;
  @ApiPropertyOptional() motivo!: string | null;
}

/** Una consulta de la contraseña: quién la vio y cuándo. */
export class VistaRespuestaDto {
  @ApiProperty() id!: string;
  @ApiProperty() vistaEn!: Date;
  @ApiProperty() usuario!: string;
}

export class HistorialCredencialDto {
  @ApiProperty({ type: [RotacionRespuestaDto] }) rotaciones!: RotacionRespuestaDto[];
  @ApiProperty({ type: [VistaRespuestaDto] }) vistas!: VistaRespuestaDto[];
}
