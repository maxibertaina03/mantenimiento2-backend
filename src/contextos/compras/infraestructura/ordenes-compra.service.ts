import { Injectable } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import { RespuestaPaginada } from '../../../common/dto/paginacion.dto';
import { finDelDia, inicioDelDia } from '../../../common/dominio/fechas';
import { EnviarOrdenes } from '../aplicacion/enviar-ordenes';
import { GestionarOrdenesCompra } from '../aplicacion/gestionar-ordenes-compra';
import { ActualizarOrdenDto } from './dto/actualizar-orden.dto';
import { CorregirPreciosDto } from './dto/corregir-precios.dto';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { EnviarOrdenDto, ResultadoEnvioDto } from './dto/enviar-orden.dto';
import { ListarOrdenesDto } from './dto/listar-ordenes.dto';
import { OrdenRespuestaDto } from './dto/orden-respuesta.dto';
import { RecibirOrdenDto } from './dto/recibir-orden.dto';
import { traducirErrores } from './traducir-errores';

/** Las fechas llegan como texto: el caso de uso trabaja con fechas de verdad. */
function comoFecha(texto: string | undefined): Date | undefined {
  return texto ? new Date(texto) : undefined;
}

/**
 * La puerta de Nest a las órdenes de compra.
 *
 * No decide nada: traduce el pedido HTTP, la respuesta a su DTO, y los errores
 * del dominio a las excepciones de siempre. Conserva el nombre y las firmas
 * del service de antes, así la API no se enteró de la mudanza. Los casos de
 * uso los recibe armados (casos-de-uso.providers.ts).
 */
@Injectable()
export class OrdenesCompraService {
  // Los casos de uso llegan armados: se componen en casos-de-uso.providers.ts.
  constructor(
    private readonly gestionar: GestionarOrdenesCompra,
    private readonly enviar: EnviarOrdenes,
  ) {}

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
