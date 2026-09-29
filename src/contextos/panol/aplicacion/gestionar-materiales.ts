import { normalizarNombre } from '../../../common/dominio/nombres';
import { ErrorNoEncontrado } from '../dominio/errores';
import {
  ubicacionFinal,
  validarEliminable,
  validarEnUso,
  validarNombreLibre,
  validarUbicacion,
} from '../dominio/material';
import { ConsultaCatalogos } from '../puertos/consulta-catalogos';
import { Reloj, relojDelSistema } from '../puertos/reloj';
import {
  CambiosMaterial,
  FiltroMateriales,
  MaterialConHistorial,
  MaterialConRelaciones,
  OrdenMateriales,
  RepositorioMateriales,
} from '../puertos/repositorio-materiales';

/** Lo que se pide al dar de alta un material. No incluye el stock: ese solo cambia por movimientos. */
export interface DatosAltaMaterial {
  nombre: string;
  categoriaId: string;
  unidadId: string;
  stockMinimo?: number;
  estanteriaId?: string | null;
  fila?: number | null;
  notas?: string;
}

/** Lo que se puede cambiar de la ficha. */
export interface DatosCambioMaterial {
  nombre?: string;
  categoriaId?: string;
  unidadId?: string;
  stockMinimo?: number;
  estanteriaId?: string | null;
  fila?: number | null;
  notas?: string | null;
  activo?: boolean;
}

/** El filtro del listado, más el de bajo stock, que se resuelve aparte. */
export type ConsultaMateriales = Omit<FiltroMateriales, 'soloIds'> & { bajoStock?: boolean };

/**
 * El catálogo de materiales del pañol: la ficha, no el stock.
 *
 * Las decisiones las toma el dominio; este caso de uso le acerca lo que
 * necesita saber —qué nombres existen, si la categoría existe— y guarda lo que
 * el dominio decide. No conoce Nest, ni Prisma, ni HTTP.
 */
export class GestionarMateriales {
  constructor(
    private readonly repo: RepositorioMateriales,
    private readonly catalogos: ConsultaCatalogos,
    private readonly reloj: Reloj = relojDelSistema,
  ) {}

  /** Valida que categoría y unidad existan, con un error claro en vez de un fallo de FK. */
  private async validarCategoria(id: string): Promise<void> {
    if (!(await this.catalogos.existeCategoria(id))) {
      throw new ErrorNoEncontrado(`No existe la categoría con id ${id}`);
    }
  }

  private async validarUnidad(id: string): Promise<void> {
    if (!(await this.catalogos.existeUnidad(id))) {
      throw new ErrorNoEncontrado(`No existe la unidad de medida con id ${id}`);
    }
  }

  async crear(datos: DatosAltaMaterial): Promise<MaterialConRelaciones> {
    await this.validarCategoria(datos.categoriaId);
    await this.validarUnidad(datos.unidadId);

    const nombre = normalizarNombre(datos.nombre);
    validarNombreLibre(await this.repo.listarNombres(), nombre);
    validarUbicacion(datos.estanteriaId, datos.fila);

    return this.repo.crear({
      nombre,
      stockMinimo: datos.stockMinimo ?? 0,
      notas: datos.notas,
      categoriaId: datos.categoriaId,
      unidadId: datos.unidadId,
      ...(datos.estanteriaId
        ? { ubicacion: { estanteriaId: datos.estanteriaId, fila: datos.fila ?? null } }
        : {}),
    });
  }

  async listar(
    consulta: ConsultaMateriales,
    orden: OrdenMateriales,
    skip: number,
    limite: number,
  ): Promise<{ items: MaterialConRelaciones[]; total: number }> {
    const { bajoStock, ...filtro } = consulta;
    // El bajo stock compara columna contra columna, así que se resuelve aparte
    // y se cruza por id con el resto de los filtros.
    const conBajoStock: FiltroMateriales = bajoStock
      ? { ...filtro, soloIds: await this.repo.idsBajoStock() }
      : filtro;

    // El total se cuenta con el MISMO filtro que el listado: si no, la
    // paginación diría "1 de 831" filtrando por una categoría.
    const [items, total] = await Promise.all([
      this.repo.listar(conBajoStock, orden, skip, limite),
      this.repo.contar(conBajoStock),
    ]);
    return { items, total };
  }

  async obtener(id: string): Promise<MaterialConRelaciones> {
    const material = await this.repo.buscarPorId(id);
    if (!material) throw new ErrorNoEncontrado(`No existe el material con id ${id}`);
    return material;
  }

  async obtenerConHistorial(id: string): Promise<MaterialConHistorial> {
    const material = await this.repo.buscarConHistorial(id);
    if (!material) throw new ErrorNoEncontrado(`No existe el material con id ${id}`);
    return material;
  }

  listarBajoStock(): Promise<MaterialConRelaciones[]> {
    return this.repo.buscarBajoStock();
  }

  /**
   * Igual que `obtener`, pero rechaza los materiales jubilados.
   *
   * Lo usan las operaciones que CARGAN algo nuevo, como una orden de compra.
   */
  async obtenerEnUso(id: string): Promise<MaterialConRelaciones> {
    const material = await this.obtener(id);
    validarEnUso(material);
    return material;
  }

  async actualizar(id: string, datos: DatosCambioMaterial): Promise<MaterialConRelaciones> {
    const actual = await this.obtener(id);

    let nombre: string | undefined;
    if (datos.nombre !== undefined) {
      nombre = normalizarNombre(datos.nombre);
      // `id` exceptuado: renombrar un material a lo que ya se llamaba (o solo
      // cambiarle una mayúscula) tiene que seguir siendo posible.
      validarNombreLibre(await this.repo.listarNombres(), nombre, id);
    }
    if (datos.categoriaId) await this.validarCategoria(datos.categoriaId);
    if (datos.unidadId) await this.validarUnidad(datos.unidadId);

    const final = ubicacionFinal(actual, datos);
    validarUbicacion(final.estanteriaId, final.fila);

    // Vaciar la estantería vacía también la fila: sin estantería no ubica nada.
    const quitaEstanteria = datos.estanteriaId !== undefined && !datos.estanteriaId;

    const cambios: CambiosMaterial = {
      nombre,
      stockMinimo: datos.stockMinimo,
      notas: datos.notas,
      categoriaId: datos.categoriaId || undefined,
      unidadId: datos.unidadId || undefined,
      estanteriaId:
        datos.estanteriaId !== undefined
          ? datos.estanteriaId
            ? datos.estanteriaId
            : null
          : undefined,
      fila: quitaEstanteria
        ? null
        : datos.fila !== undefined && final.estanteriaId
          ? datos.fila
          : undefined,
      // "Sacar de circulación". Faltó durante un tiempo: el pedido traía
      // `activo`, el servidor contestaba 200 y lo descartaba.
      activo: datos.activo,
    };
    return this.repo.actualizar(id, cambios);
  }

  /**
   * Deja constancia de que a estos materiales ya se les generó la etiqueta QR.
   *
   * En una sola llamada porque las etiquetas se imprimen de a tandas. La fecha
   * la pone el servidor, no la pantalla.
   */
  async marcarQrGenerado(ids: string[]): Promise<number> {
    return this.repo.marcarQrGenerado(ids, this.reloj.ahora());
  }

  contarSinUnidad(): Promise<number> {
    return this.repo.contarSinUnidad();
  }

  /**
   * Cuántos materiales cubre la alerta de bajo stock y cuántos no.
   *
   * La alerta solo mira los materiales con un mínimo definido. Si casi ninguno
   * lo tiene, la pantalla puede decir "todo OK" mientras media planta está en
   * cero, y nadie sabría que la alerta estaba ciega.
   */
  async coberturaDeAlertas(): Promise<{
    enUso: number;
    conMinimo: number;
    sinMinimo: number;
    bajoStock: number;
  }> {
    const [enUso, sinMinimo, bajos] = await Promise.all([
      this.repo.contar({ mostrar: 'activos' }),
      this.repo.contarSinStockMinimo(),
      this.repo.idsBajoStock(),
    ]);
    return { enUso, conMinimo: enUso - sinMinimo, sinMinimo, bajoStock: bajos.length };
  }

  /**
   * Pone una unidad por defecto a los materiales que no tienen.
   *
   * Valida la unidad antes de tocar nada: si no existiera, el cambio masivo
   * fallaría a mitad de camino con un error de FK poco claro.
   */
  async asignarUnidadMasiva(
    unidadId: string,
    soloSinUnidad: boolean,
  ): Promise<{ actualizados: number; sinUnidad: number }> {
    await this.validarUnidad(unidadId);
    const actualizados = await this.repo.asignarUnidadMasiva(unidadId, soloSinUnidad);
    return { actualizados, sinUnidad: await this.repo.contarSinUnidad() };
  }

  async eliminar(id: string): Promise<void> {
    await this.obtener(id);
    validarEliminable(await this.repo.contarMovimientos(id));
    await this.repo.eliminar(id);
  }
}
