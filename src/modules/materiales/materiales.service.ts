import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { aDecimal } from '../../common/dominio/decimal';
import { CategoriasMaterialService } from '../categorias-material/categorias-material.service';
import { CrearMaterialDto } from './dto/crear-material.dto';
import { ActualizarMaterialDto } from './dto/actualizar-material.dto';
import { ListarMaterialesDto } from './dto/listar-materiales.dto';
import { MaterialRespuestaDto } from './dto/material-respuesta.dto';
import { MaterialConHistorialDto } from './dto/material-con-historial.dto';
import { MaterialesRepository } from './materiales.repository';
import { AsignarUnidadMasivaDto, ResultadoAsignacionDto } from './dto/asignar-unidad-masiva.dto';
import { UnidadesMedidaService } from '../unidades-medida/unidades-medida.service';

@Injectable()
export class MaterialesService {
  constructor(
    private readonly repo: MaterialesRepository,
    private readonly categorias: CategoriasMaterialService,
    private readonly unidades: UnidadesMedidaService,
  ) {}

  async crear(dto: CrearMaterialDto): Promise<MaterialRespuestaDto> {
    // Valida que categoría y unidad existan, con un error claro en vez de un
    // fallo de FK genérico.
    await this.categorias.obtener(dto.categoriaId);
    await this.unidades.obtener(dto.unidadId);

    const creado = await this.repo.crear({
      nombre: dto.nombre,
      stockMinimo: dto.stockMinimo ?? 0,
      notas: dto.notas,
      categoria: { connect: { id: dto.categoriaId } },
      unidad: { connect: { id: dto.unidadId } },
      // stockActual arranca en 0; solo cambia vía movimientos.
    });
    return MaterialRespuestaDto.desde(creado);
  }

  /** Traduce el filtro pedido a un `where` de Prisma. */
  private async armarFiltro(query: ListarMaterialesDto): Promise<Prisma.MaterialWhereInput> {
    const where: Prisma.MaterialWhereInput = {};

    // Por defecto el listado muestra solo los materiales en uso. Con 896 en el
    // catálogo, arrastrar los jubilados en cada búsqueda es justamente lo que
    // se quiere evitar; los desactivados se siguen pudiendo mirar pidiéndolos.
    if (query.mostrar === 'activos' || query.mostrar === undefined) where.activo = true;
    else if (query.mostrar === 'inactivos') where.activo = false;

    if (query.buscar) {
      where.nombre = { contains: query.buscar, mode: 'insensitive' };
    }
    if (query.categoriaId) where.categoriaId = query.categoriaId;

    // sinUnidad gana sobre unidadId: pedir las dos cosas es contradictorio, y
    // dejar el `unidadId` filtraría por una unidad Y por no tener ninguna,
    // devolviendo siempre vacío sin explicar por qué.
    if (query.sinUnidad === 'true') where.unidadId = null;
    else if (query.unidadId) where.unidadId = query.unidadId;

    if (query.stockMin !== undefined || query.stockMax !== undefined) {
      where.stockActual = {
        ...(query.stockMin !== undefined ? { gte: aDecimal(query.stockMin) } : {}),
        ...(query.stockMax !== undefined ? { lte: aDecimal(query.stockMax) } : {}),
      };
    }

    if (query.bajoStock === 'true') {
      // Compara columna contra columna, así que se resuelve aparte y se cruza
      // por id con el resto de los filtros.
      where.id = { in: await this.repo.idsBajoStock() };
    }

    return where;
  }

  /**
   * Orden del listado.
   *
   * El nombre queda siempre como criterio final: con muchos materiales
   * empatados —por ejemplo todos en stock 0— sin un desempate estable las
   * páginas 1 y 2 podrían repetir o saltear filas.
   */
  private armarOrden(query: ListarMaterialesDto): Prisma.MaterialOrderByWithRelationInput[] {
    const dir = query.direccion ?? 'asc';
    switch (query.ordenarPor) {
      case 'stock':
        return [{ stockActual: dir }, { nombre: 'asc' }];
      case 'categoria':
        return [{ categoria: { nombre: dir } }, { nombre: 'asc' }];
      case 'unidad':
        return [{ unidad: { nombre: dir } }, { nombre: 'asc' }];
      default:
        return [{ nombre: dir }];
    }
  }

  async listar(query: ListarMaterialesDto): Promise<RespuestaPaginada<MaterialRespuestaDto>> {
    const where = await this.armarFiltro(query);
    const orderBy = this.armarOrden(query);

    const [items, total] = await Promise.all([
      this.repo.buscarTodosOrdenado(query.skip, query.limite, where, orderBy),
      this.repo.contar(where),
    ]);
    return {
      datos: items.map(MaterialRespuestaDto.desde),
      total,
      pagina: query.pagina,
      limite: query.limite,
    };
  }

  async obtener(id: string): Promise<MaterialRespuestaDto> {
    const material = await this.repo.buscarPorId(id);
    if (!material) {
      throw new NotFoundException(`No existe el material con id ${id}`);
    }
    return MaterialRespuestaDto.desde(material);
  }

  async obtenerConHistorial(id: string): Promise<MaterialConHistorialDto> {
    const material = await this.repo.buscarConHistorial(id);
    if (!material) {
      throw new NotFoundException(`No existe el material con id ${id}`);
    }
    return MaterialConHistorialDto.desdeMaterial(material);
  }

  async listarBajoStock(): Promise<MaterialRespuestaDto[]> {
    const materiales = await this.repo.buscarBajoStock();
    return materiales.map(MaterialRespuestaDto.desde);
  }

  /**
   * Igual que `obtener`, pero rechaza los materiales jubilados.
   *
   * Lo usan las operaciones que CARGAN algo nuevo: un movimiento, una orden de
   * compra. Editar un movimiento viejo de un material jubilado sigue estando
   * permitido, porque eso es corregir historia, no seguir usándolo.
   */
  async obtenerEnUso(id: string): Promise<MaterialRespuestaDto> {
    const material = await this.obtener(id);
    if (!material.activo) {
      throw new BadRequestException(
        `El material "${material.nombre}" está desactivado y no se puede usar en cargas ` +
          'nuevas. Si volvió a hacer falta, activalo de nuevo desde su ficha.',
      );
    }
    return material;
  }

  async actualizar(id: string, dto: ActualizarMaterialDto): Promise<MaterialRespuestaDto> {
    await this.obtener(id);
    if (dto.categoriaId) {
      await this.categorias.obtener(dto.categoriaId);
    }
    if (dto.unidadId) {
      await this.unidades.obtener(dto.unidadId);
    }

    const actualizado = await this.repo.actualizar(id, {
      nombre: dto.nombre,
      stockMinimo: dto.stockMinimo,
      notas: dto.notas,
      ...(dto.categoriaId ? { categoria: { connect: { id: dto.categoriaId } } } : {}),
      ...(dto.unidadId ? { unidad: { connect: { id: dto.unidadId } } } : {}),
    });
    return MaterialRespuestaDto.desde(actualizado);
  }

  /** Cuántos materiales siguen sin unidad: lo muestra la pantalla de unidades. */
  async contarSinUnidad(): Promise<{ sinUnidad: number }> {
    return { sinUnidad: await this.repo.contarSinUnidad() };
  }

  /**
   * Pone una unidad por defecto a los materiales que no tienen.
   *
   * Valida la unidad antes de tocar nada: si no existiera, un updateMany
   * fallaría a mitad de camino con un error de FK poco claro.
   */
  async asignarUnidadMasiva(dto: AsignarUnidadMasivaDto): Promise<ResultadoAsignacionDto> {
    await this.unidades.obtener(dto.unidadId);
    const actualizados = await this.repo.asignarUnidadMasiva(
      dto.unidadId,
      dto.soloSinUnidad ?? true,
    );
    return { actualizados, sinUnidad: await this.repo.contarSinUnidad() };
  }

  async eliminar(id: string): Promise<void> {
    await this.obtener(id);
    const movimientos = await this.repo.contarMovimientos(id);
    if (movimientos > 0) {
      // Borrarlo se llevaría puesto el historial, que es lo que hay que
      // conservar. Desactivarlo hace lo que la persona quiere —sacarlo de las
      // listas— sin perder nada, así que el mensaje lo ofrece en vez de dejarla
      // sin salida.
      throw new BadRequestException(
        `No se puede eliminar: el material tiene ${movimientos} movimiento(s) registrado(s), ` +
          'y borrarlo se llevaría ese historial. Si ya no se usa, desactivalo: deja de ' +
          'aparecer al cargar movimientos y órdenes, pero se conserva todo lo registrado.',
      );
    }
    await this.repo.eliminar(id);
  }
}
