import { Inject, Injectable } from '@nestjs/common';
import { RespuestaPaginada } from '../../../../common/dto/paginacion.dto';
import { GestionarMateriales } from '../../aplicacion/gestionar-materiales';
import { CONSULTA_CATALOGOS, ConsultaCatalogos } from '../../puertos/consulta-catalogos';
import {
  REPOSITORIO_MATERIALES,
  RepositorioMateriales,
} from '../../puertos/repositorio-materiales';
import { traducirErrores } from '../traducir-errores';
import { ActualizarMaterialDto } from './dto/actualizar-material.dto';
import { AsignarUnidadMasivaDto, ResultadoAsignacionDto } from './dto/asignar-unidad-masiva.dto';
import { CrearMaterialDto } from './dto/crear-material.dto';
import { ListarMaterialesDto } from './dto/listar-materiales.dto';
import { MaterialConHistorialDto } from './dto/material-con-historial.dto';
import { MaterialRespuestaDto } from './dto/material-respuesta.dto';

/**
 * La puerta de Nest a los materiales del pañol.
 *
 * No decide nada: traduce el pedido HTTP al caso de uso, la respuesta a su
 * DTO, y los errores del dominio a las excepciones de siempre. Conserva el
 * nombre y las firmas del service de antes porque órdenes de compra lo usa, y
 * así no se enteró de la mudanza.
 */
@Injectable()
export class MaterialesService {
  private readonly gestionar: GestionarMateriales;

  constructor(
    @Inject(REPOSITORIO_MATERIALES) repo: RepositorioMateriales,
    @Inject(CONSULTA_CATALOGOS) catalogos: ConsultaCatalogos,
  ) {
    this.gestionar = new GestionarMateriales(repo, catalogos);
  }

  crear(dto: CrearMaterialDto): Promise<MaterialRespuestaDto> {
    return traducirErrores(async () => MaterialRespuestaDto.desde(await this.gestionar.crear(dto)));
  }

  listar(query: ListarMaterialesDto): Promise<RespuestaPaginada<MaterialRespuestaDto>> {
    return traducirErrores(async () => {
      const { items, total } = await this.gestionar.listar(
        {
          mostrar: query.mostrar,
          buscar: query.buscar,
          categoriaId: query.categoriaId,
          sinUnidad: query.sinUnidad === 'true',
          unidadId: query.unidadId,
          stockMin: query.stockMin,
          stockMax: query.stockMax,
          estanteriaId: query.estanteriaId,
          sinUbicacion: query.sinUbicacion === 'true',
          sinQr: query.sinQr === 'true',
          bajoStock: query.bajoStock === 'true',
        },
        { campo: query.ordenarPor, direccion: query.direccion },
        query.skip,
        query.limite,
      );
      return {
        datos: items.map(MaterialRespuestaDto.desde),
        total,
        pagina: query.pagina,
        limite: query.limite,
      };
    });
  }

  obtener(id: string): Promise<MaterialRespuestaDto> {
    return traducirErrores(async () =>
      MaterialRespuestaDto.desde(await this.gestionar.obtener(id)),
    );
  }

  obtenerConHistorial(id: string): Promise<MaterialConHistorialDto> {
    return traducirErrores(async () =>
      MaterialConHistorialDto.desdeMaterial(await this.gestionar.obtenerConHistorial(id)),
    );
  }

  listarBajoStock(): Promise<MaterialRespuestaDto[]> {
    return traducirErrores(async () =>
      (await this.gestionar.listarBajoStock()).map(MaterialRespuestaDto.desde),
    );
  }

  /**
   * Igual que `obtener`, pero rechaza los materiales jubilados.
   *
   * Lo usa órdenes de compra: cargar una orden con un material jubilado es
   * seguir usándolo, que es justo de lo que se lo sacó.
   */
  obtenerEnUso(id: string): Promise<MaterialRespuestaDto> {
    return traducirErrores(async () =>
      MaterialRespuestaDto.desde(await this.gestionar.obtenerEnUso(id)),
    );
  }

  actualizar(id: string, dto: ActualizarMaterialDto): Promise<MaterialRespuestaDto> {
    return traducirErrores(async () =>
      MaterialRespuestaDto.desde(await this.gestionar.actualizar(id, dto)),
    );
  }

  marcarQrGenerado(ids: string[]): Promise<{ marcados: number }> {
    return traducirErrores(async () => ({
      marcados: await this.gestionar.marcarQrGenerado(ids),
    }));
  }

  /** Cuántos materiales siguen sin unidad: lo muestra la pantalla de unidades. */
  contarSinUnidad(): Promise<{ sinUnidad: number }> {
    return traducirErrores(async () => ({ sinUnidad: await this.gestionar.contarSinUnidad() }));
  }

  coberturaDeAlertas(): Promise<{
    enUso: number;
    conMinimo: number;
    sinMinimo: number;
    bajoStock: number;
  }> {
    return traducirErrores(() => this.gestionar.coberturaDeAlertas());
  }

  asignarUnidadMasiva(dto: AsignarUnidadMasivaDto): Promise<ResultadoAsignacionDto> {
    return traducirErrores(() =>
      this.gestionar.asignarUnidadMasiva(dto.unidadId, dto.soloSinUnidad ?? true),
    );
  }

  eliminar(id: string): Promise<void> {
    return traducirErrores(() => this.gestionar.eliminar(id));
  }
}
