import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Usuario } from '@prisma/client';
import { CorreoService } from '../../../common/correo/correo.service';
import { RespuestaPaginada } from '../../../common/dto/paginacion.dto';
import { finDelDia, inicioDelDia } from '../../../common/dominio/fechas';
import { ProveedoresService } from '../../../modules/proveedores/proveedores.service';
import { MaterialesService } from '../../panol/infraestructura/materiales/materiales.service';
import { MovimientosStockService } from '../../panol/infraestructura/movimientos/movimientos-stock.service';
import { EnviarOrdenes } from '../aplicacion/enviar-ordenes';
import { GestionarOrdenesCompra } from '../aplicacion/gestionar-ordenes-compra';
import {
  CasillasDeLaConfiguracion,
  CorreoDelSistema,
  PanolPorSusServicios,
  ProveedoresDelCatalogo,
} from './adaptadores';
import { ActualizarOrdenDto } from './dto/actualizar-orden.dto';
import { CorregirPreciosDto } from './dto/corregir-precios.dto';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { EnviarOrdenDto, ResultadoEnvioDto } from './dto/enviar-orden.dto';
import { ListarOrdenesDto } from './dto/listar-ordenes.dto';
import { OrdenRespuestaDto } from './dto/orden-respuesta.dto';
import { RecibirOrdenDto } from './dto/recibir-orden.dto';
import { PrismaRepositorioOrdenesCompra } from './prisma-repositorio-ordenes-compra';
import { traducirErrores } from './traducir-errores';

/** Las fechas llegan como texto: el caso de uso trabaja con fechas de verdad. */
function comoFecha(texto: string | undefined): Date | undefined {
  return texto ? new Date(texto) : undefined;
}

/**
 * La puerta de Nest a las órdenes de compra.
 *
 * No decide nada: arma los casos de uso con sus adaptadores, traduce el pedido
 * HTTP, la respuesta a su DTO, y los errores del dominio a las excepciones de
 * siempre. Conserva el nombre, el constructor y las firmas del service de
 * antes, así la API y sus pruebas no se enteraron de la mudanza.
 */
@Injectable()
export class OrdenesCompraService {
  private readonly gestionar: GestionarOrdenesCompra;
  private readonly enviar: EnviarOrdenes;

  constructor(
    repo: PrismaRepositorioOrdenesCompra,
    proveedores: ProveedoresService,
    materiales: MaterialesService,
    movimientos: MovimientosStockService,
    correo: CorreoService,
    config: ConfigService,
  ) {
    this.gestionar = new GestionarOrdenesCompra(
      repo,
      new ProveedoresDelCatalogo(proveedores),
      new PanolPorSusServicios(materiales, movimientos),
    );
    // El correo describe la orden igual que la pantalla y el PDF adjunto.
    this.enviar = new EnviarOrdenes(
      repo,
      new CorreoDelSistema(correo),
      new CasillasDeLaConfiguracion(config),
      OrdenRespuestaDto.desde,
    );
  }

  enviarPorCorreo(id: string, dto: EnviarOrdenDto, usuario?: Usuario): Promise<ResultadoEnvioDto> {
    return traducirErrores(() =>
      this.enviar.porCorreo(id, Buffer.from(dto.pdfBase64, 'base64'), usuario),
    );
  }

  registrarEnvioWhatsapp(
    id: string,
    numero: string,
    usuario?: Usuario,
  ): Promise<OrdenRespuestaDto> {
    return traducirErrores(async () =>
      OrdenRespuestaDto.desde(await this.enviar.porWhatsapp(id, numero, usuario?.id ?? null)),
    );
  }

  listarEnvios(id: string) {
    return traducirErrores(async () =>
      (await this.enviar.envios(id)).map((e) => ({
        id: e.id,
        via: e.via,
        destinatarios: e.destinatarios,
        automatico: e.automatico,
        enviadoEn: e.enviadoEn,
        usuarioNombre: e.usuario?.nombre ?? null,
      })),
    );
  }

  configuracionDeEnvio() {
    return this.enviar.configuracion();
  }

  crear(dto: CrearOrdenDto, usuarioActual?: Usuario): Promise<OrdenRespuestaDto> {
    return traducirErrores(async () =>
      OrdenRespuestaDto.desde(await this.gestionar.crear(dto, usuarioActual?.id ?? null)),
    );
  }

  listar(query: ListarOrdenesDto): Promise<RespuestaPaginada<OrdenRespuestaDto>> {
    return traducirErrores(async () => {
      const { items, total } = await this.gestionar.listar(
        {
          buscar: query.buscar,
          estado: query.estado,
          proveedorId: query.proveedorId,
          fechaDesde: query.fechaDesde ? inicioDelDia(query.fechaDesde) : undefined,
          fechaHasta: query.fechaHasta ? finDelDia(query.fechaHasta) : undefined,
        },
        query.skip,
        query.limite,
      );
      return {
        datos: items.map(OrdenRespuestaDto.desde),
        total,
        pagina: query.pagina,
        limite: query.limite,
      };
    });
  }

  obtener(id: string): Promise<OrdenRespuestaDto> {
    return traducirErrores(async () => OrdenRespuestaDto.desde(await this.gestionar.obtener(id)));
  }

  actualizar(id: string, dto: ActualizarOrdenDto): Promise<OrdenRespuestaDto> {
    return traducirErrores(async () =>
      OrdenRespuestaDto.desde(await this.gestionar.actualizar(id, dto)),
    );
  }

  corregirPrecios(id: string, dto: CorregirPreciosDto): Promise<OrdenRespuestaDto> {
    return traducirErrores(async () =>
      OrdenRespuestaDto.desde(await this.gestionar.corregirPrecios(id, dto.precios)),
    );
  }

  emitir(id: string): Promise<OrdenRespuestaDto> {
    return traducirErrores(async () => OrdenRespuestaDto.desde(await this.gestionar.emitir(id)));
  }

  recibir(id: string, dto: RecibirOrdenDto, usuarioActual?: Usuario): Promise<OrdenRespuestaDto> {
    return traducirErrores(async () =>
      OrdenRespuestaDto.desde(
        await this.gestionar.recibir(
          id,
          { ...dto, fechaRecepcion: comoFecha(dto.fechaRecepcion) },
          usuarioActual?.id ?? null,
        ),
      ),
    );
  }

  anular(id: string): Promise<OrdenRespuestaDto> {
    return traducirErrores(async () => OrdenRespuestaDto.desde(await this.gestionar.anular(id)));
  }

  eliminar(id: string): Promise<void> {
    return traducirErrores(() => this.gestionar.eliminar(id));
  }
}
