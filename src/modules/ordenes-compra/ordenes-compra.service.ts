import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EstadoOrdenCompra, Usuario, ViaEnvioOrden } from '@prisma/client';
import { RespuestaPaginada } from '../../common/dto/paginacion.dto';
import { aDecimal } from '../../common/dominio/decimal';
import { finDelDia, inicioDelDia } from '../../common/dominio/fechas';
import { MaterialesService } from '../materiales/materiales.service';
import { MovimientosStockService } from '../movimientos-stock/movimientos-stock.service';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { ActualizarOrdenDto } from './dto/actualizar-orden.dto';
import { CrearOrdenDto, RenglonOrdenDto } from './dto/crear-orden.dto';
import { ListarOrdenesDto } from './dto/listar-ordenes.dto';
import { OrdenRespuestaDto } from './dto/orden-respuesta.dto';
import { RecibirOrdenDto } from './dto/recibir-orden.dto';
import { FiltroOrdenes, OrdenesCompraRepository } from './ordenes-compra.repository';
import { ConfigService } from '@nestjs/config';
import { CorreoService, explicarErrorSmtp } from '../../common/correo/correo.service';
import { EnviarOrdenDto, ResultadoEnvioDto } from './dto/enviar-orden.dto';
import { armarMensaje, destinatarios, esEmailValido } from './envio/mensaje-orden';

/**
 * Transiciones de estado permitidas.
 * BORRADOR → EMITIDA → RECIBIDA. Desde borrador o emitida se puede anular;
 * una orden RECIBIDA ya movió stock, así que es terminal.
 */
const TRANSICIONES: Record<EstadoOrdenCompra, EstadoOrdenCompra[]> = {
  [EstadoOrdenCompra.BORRADOR]: [EstadoOrdenCompra.EMITIDA, EstadoOrdenCompra.ANULADA],
  [EstadoOrdenCompra.EMITIDA]: [EstadoOrdenCompra.RECIBIDA, EstadoOrdenCompra.ANULADA],
  [EstadoOrdenCompra.RECIBIDA]: [],
  [EstadoOrdenCompra.ANULADA]: [],
};

@Injectable()
export class OrdenesCompraService {
  constructor(
    private readonly repo: OrdenesCompraRepository,
    private readonly proveedores: ProveedoresService,
    private readonly materiales: MaterialesService,
    private readonly movimientos: MovimientosStockService,
    private readonly correo: CorreoService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Manda la orden por correo, con el PDF adjunto.
   *
   * El cliente aporta SOLO el PDF: el texto y los destinatarios se arman acá
   * con los datos de la base. Si el cliente pudiera elegir a quién se le manda,
   * cualquiera con una sesión podría usar la casilla de la empresa para
   * escribirle a quien quisiera.
   */
  async enviarPorCorreo(
    id: string,
    dto: EnviarOrdenDto,
    usuario?: Usuario,
  ): Promise<ResultadoEnvioDto> {
    if (!this.correo.estaConfigurado()) {
      throw new ServiceUnavailableException(
        'El envío automático de correo no está configurado. ' +
          'Podés enviar la orden manualmente desde el sistema.',
      );
    }

    const orden = await this.obtener(id);
    const mailAdministracion =
      this.config.get<string>('MAIL_ADMINISTRACION') ?? 'administracion@lacteoslastres.com.ar';
    const { para, copia } = destinatarios(orden, mailAdministracion);
    const { asunto, cuerpo } = armarMensaje(orden);

    // El correo del usuario va en Reply-To: el remitente es la casilla del
    // sistema, pero el proveedor le contesta a la persona que hizo la orden.
    const responderA = esEmailValido(usuario?.email) ? usuario!.email : undefined;

    const pdf = Buffer.from(dto.pdfBase64, 'base64');
    if (pdf.length === 0) {
      throw new BadRequestException('El PDF adjunto vino vacío.');
    }

    try {
      await this.correo.enviar({
        para,
        copia,
        responderA,
        nombreRemitente: usuario?.nombre
          ? `${usuario.nombre} · Lácteos Las Tres S.R.L.`
          : 'Lácteos Las Tres S.R.L.',
        asunto,
        texto: cuerpo,
        adjuntos: [{ nombre: `${orden.numero}.pdf`, contenido: pdf, tipo: 'application/pdf' }],
      });
    } catch (error) {
      // El motivo real (credenciales rechazadas, puerto bloqueado, límite de
      // envíos) se pierde si esto sale como un 500 genérico, y es justo lo que
      // hace falta para saber qué corregir. No expone credenciales: el mensaje
      // de SMTP no las incluye.
      // 502 y no 503: el 503 lo reserva el sistema para "el correo no está
      // configurado", que es lo único que justifica caer al envío manual.
      throw new BadGatewayException(
        `No se pudo enviar el correo: ${explicarErrorSmtp(error)} ` +
          'La orden no cambió de estado; podés reintentar o mandarla a mano.',
      );
    }

    // Se registra DESPUES de que el correo salio. Al reves, un fallo de Brevo
    // dejaria constancia de un envio que nunca ocurrio, y "ya se la mandamos"
    // pasaria a ser mentira justo cuando alguien lo consulta.
    //
    // Emitir va junto: una orden que ya salio no puede seguir editandose, o el
    // proveedor termina con un PDF que no coincide con lo que dice el sistema.
    const actualizada = await this.repo.registrarEnvio({
      ordenId: id,
      via: ViaEnvioOrden.CORREO,
      destinatarios: [...para, ...copia].join(', '),
      automatico: true,
      usuarioId: usuario?.id ?? null,
    });

    return {
      para,
      copia,
      responderA: responderA ?? null,
      estado: actualizada.estado,
    };
  }

  /**
   * Deja constancia de que la orden se mando por WhatsApp.
   *
   * WhatsApp no sale solo: el sistema abre el chat con el texto escrito y la
   * persona toca enviar y adjunta el PDF. Por eso se registra `automatico:
   * false`, y por eso lo llama el frontend cuando la persona abre el chat, no
   * cuando WhatsApp confirma nada.
   *
   * Es deliberadamente optimista: si alguien abre el chat y despues no manda,
   * queda un envio registrado de mas. Lo contrario —no registrar nada— deja la
   * orden en BORRADOR y editable despues de que el proveedor la recibio, que es
   * bastante peor.
   */
  async registrarEnvioWhatsapp(
    id: string,
    numero: string,
    usuario?: Usuario,
  ): Promise<OrdenRespuestaDto> {
    await this.obtener(id); // 404 con mensaje claro si no existe

    const actualizada = await this.repo.registrarEnvio({
      ordenId: id,
      via: ViaEnvioOrden.WHATSAPP,
      destinatarios: numero,
      automatico: false,
      usuarioId: usuario?.id ?? null,
    });
    return OrdenRespuestaDto.desde(actualizada);
  }

  /** Por dónde y cuándo salió esta orden. */
  async listarEnvios(id: string) {
    await this.obtener(id);
    const envios = await this.repo.listarEnvios(id);
    return envios.map((e) => ({
      id: e.id,
      via: e.via,
      destinatarios: e.destinatarios,
      automatico: e.automatico,
      enviadoEn: e.enviadoEn,
      usuarioNombre: e.usuario?.nombre ?? null,
    }));
  }

  /**
   * Los datos fijos de la empresa que la pantalla de envío necesita.
   *
   * Salen del servidor y no de una constante en el frontend: la casilla de
   * administración ya estaba escrita en los dos lados, y el día que cambie hay
   * que acordarse de los dos. El número de WhatsApp estaba solo en el frontend,
   * donde nadie con acceso al panel de Render puede cambiarlo.
   */
  configuracionDeEnvio() {
    return {
      mailAdministracion:
        this.config.get<string>('MAIL_ADMINISTRACION') ?? 'administracion@lacteoslastres.com.ar',
      whatsappAdministracion: this.config.get<string>('WHATSAPP_ADMINISTRACION') ?? null,
      correoConfigurado: this.correo.estaConfigurado(),
    };
  }

  /** Valida que existan el proveedor y todos los materiales del detalle. */
  private async validarReferencias(
    proveedorId: string,
    renglones: RenglonOrdenDto[],
  ): Promise<void> {
    await this.proveedores.obtener(proveedorId); // 404 con mensaje claro

    // Un mismo material dos veces en la misma orden confunde al proveedor y
    // duplica el movimiento de stock: mejor un solo renglón con la suma.
    const vistos = new Set<string>();
    for (const renglon of renglones) {
      if (vistos.has(renglon.materialId)) {
        throw new BadRequestException(
          'La orden tiene el mismo material en más de un renglón. Unificalos en uno solo.',
        );
      }
      vistos.add(renglon.materialId);
      // `obtenerEnUso` y no `obtener`: no tiene sentido comprar algo que se
      // saco de circulacion.
      await this.materiales.obtenerEnUso(renglon.materialId);
    }
  }

  private aDatosRenglones(renglones: RenglonOrdenDto[]) {
    return renglones.map((r) => ({
      materialId: r.materialId,
      cantidad: aDecimal(r.cantidad),
      precioUnitario: r.precioUnitario === undefined ? null : aDecimal(r.precioUnitario),
      notas: r.notas ?? null,
    }));
  }

  async crear(dto: CrearOrdenDto, usuarioActual?: Usuario): Promise<OrdenRespuestaDto> {
    await this.validarReferencias(dto.proveedorId, dto.renglones);

    const creada = await this.repo.crear({
      proveedorId: dto.proveedorId,
      observaciones: dto.observaciones ?? null,
      creadoPorId: usuarioActual?.id ?? null,
      renglones: this.aDatosRenglones(dto.renglones),
    });

    return OrdenRespuestaDto.desde(creada);
  }

  async listar(query: ListarOrdenesDto): Promise<RespuestaPaginada<OrdenRespuestaDto>> {
    const filtro: FiltroOrdenes = {
      buscar: query.buscar,
      estado: query.estado,
      proveedorId: query.proveedorId,
      fechaDesde: query.fechaDesde ? inicioDelDia(query.fechaDesde) : undefined,
      fechaHasta: query.fechaHasta ? finDelDia(query.fechaHasta) : undefined,
    };

    const [items, total] = await Promise.all([
      this.repo.buscarConFiltros(filtro, query.skip, query.limite),
      this.repo.contar(filtro),
    ]);

    return {
      datos: items.map(OrdenRespuestaDto.desde),
      total,
      pagina: query.pagina,
      limite: query.limite,
    };
  }

  async obtener(id: string): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    return OrdenRespuestaDto.desde(orden);
  }

  async actualizar(id: string, dto: ActualizarOrdenDto): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    if (orden.estado !== EstadoOrdenCompra.BORRADOR) {
      throw new BadRequestException(
        `La orden ${orden.numero} está ${orden.estado} y ya no se puede editar. ` +
          'Solo se editan las órdenes en BORRADOR.',
      );
    }

    if (dto.renglones && dto.renglones.length === 0) {
      throw new BadRequestException('La orden debe tener al menos un renglón.');
    }

    await this.validarReferencias(dto.proveedorId ?? orden.proveedorId, dto.renglones ?? []);

    const actualizada = await this.repo.actualizar(id, {
      proveedorId: dto.proveedorId,
      observaciones: dto.observaciones,
      renglones: dto.renglones ? this.aDatosRenglones(dto.renglones) : undefined,
    });

    return OrdenRespuestaDto.desde(actualizada);
  }

  /** Valida la transición y da un mensaje que explica por qué no se puede. */
  private validarTransicion(
    numero: string,
    actual: EstadoOrdenCompra,
    destino: EstadoOrdenCompra,
  ): void {
    if (!TRANSICIONES[actual].includes(destino)) {
      throw new BadRequestException(
        `La orden ${numero} está ${actual} y no puede pasar a ${destino}.`,
      );
    }
  }

  /** Marca la orden como emitida (ya se le mandó al proveedor). */
  async emitir(id: string): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    this.validarTransicion(orden.numero, orden.estado, EstadoOrdenCompra.EMITIDA);

    if (!orden.renglones?.length) {
      throw new BadRequestException('No se puede emitir una orden sin renglones.');
    }

    const emitida = await this.repo.cambiarEstado(id, EstadoOrdenCompra.EMITIDA, {
      emitidaEn: new Date(),
    });
    return OrdenRespuestaDto.desde(emitida);
  }

  /**
   * Recibe la mercadería: genera un movimiento de ENTRADA por renglón y suma
   * el stock. Es la operación que conecta compras con inventario.
   */
  async recibir(
    id: string,
    dto: RecibirOrdenDto,
    usuarioActual?: Usuario,
  ): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    this.validarTransicion(orden.numero, orden.estado, EstadoOrdenCompra.RECIBIDA);

    // Sin comprobante no se cierra la orden. Es lo único que ata la entrada de
    // stock al papel que quedó en la empresa: sin eso, una diferencia de
    // inventario no se puede reconstruir contra nada. La regla vive acá y no
    // solo en el DTO para que valga también si mañana la recepción entra por
    // otro lado (una importación, un script).
    const remito = dto.remito?.trim() || null;
    const factura = dto.factura?.trim() || null;
    if (!remito && !factura) {
      throw new BadRequestException(
        `Para cerrar la orden ${orden.numero} hace falta el número de remito o el de ` +
          'factura del proveedor. Es lo que después permite cruzar el stock con el papel.',
      );
    }

    const fechaRecepcion = dto.fechaRecepcion ? new Date(dto.fechaRecepcion) : new Date();

    // Recibir genera un movimiento de ENTRADA por renglón con esta fecha, así
    // que le corresponde la misma regla que a un movimiento cargado a mano: no
    // puede quedar por detrás del último ajuste del material. Se comprueban
    // TODOS antes de tocar nada, para no dejar media orden recibida.
    for (const renglon of orden.renglones ?? []) {
      await this.movimientos.verificarFechaContraAjustes(renglon.materialId, fechaRecepcion, {
        nombreDelMaterial: renglon.material?.nombre,
      });
    }

    // La referencia queda en cada movimiento: desde el stock se llega a la orden
    // y al comprobante sin abrir nada más.
    const comprobante = [remito ? `Remito ${remito}` : null, factura ? `Factura ${factura}` : null]
      .filter(Boolean)
      .join(' · ');
    const referencia = `${orden.numero} · ${comprobante}`;

    const recibida = await this.repo.recibir({
      id,
      fechaRecepcion,
      recibidaPorId: usuarioActual?.id ?? null,
      referencia,
      remito,
      factura,
      notas: dto.notas ?? null,
    });

    return OrdenRespuestaDto.desde(recibida);
  }

  async anular(id: string): Promise<OrdenRespuestaDto> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    this.validarTransicion(orden.numero, orden.estado, EstadoOrdenCompra.ANULADA);

    const anulada = await this.repo.cambiarEstado(id, EstadoOrdenCompra.ANULADA);
    return OrdenRespuestaDto.desde(anulada);
  }

  async eliminar(id: string): Promise<void> {
    const orden = await this.repo.buscarPorId(id);
    if (!orden) {
      throw new NotFoundException(`No existe la orden de compra con id ${id}`);
    }
    if (orden.estado !== EstadoOrdenCompra.BORRADOR) {
      throw new BadRequestException(
        `Solo se pueden eliminar órdenes en BORRADOR. La orden ${orden.numero} está ${orden.estado}; ` +
          'si ya no corresponde, anulala para conservar el registro.',
      );
    }
    await this.repo.eliminar(id);
  }
}
