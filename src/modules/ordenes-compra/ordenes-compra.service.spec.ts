import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EstadoOrdenCompra, Usuario } from '@prisma/client';
import { OrdenesCompraService } from './ordenes-compra.service';
import { ConfigService } from '@nestjs/config';
import { CorreoService } from '../../common/correo/correo.service';
import { OrdenesCompraRepository } from './ordenes-compra.repository';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { MaterialesService } from '../materiales/materiales.service';
import { MovimientosStockService } from '../movimientos-stock/movimientos-stock.service';
import { aDecimal } from '../../common/dominio/decimal';

const ordenBase = {
  id: 'oc-1',
  numero: 'OC-2026-0001',
  estado: EstadoOrdenCompra.BORRADOR,
  proveedorId: 'prov-1',
  fecha: new Date('2026-08-01T10:00:00.000Z'),
  fechaEntregaEstimada: null,
  observaciones: null,
  creadoPorId: null,
  emitidaEn: null,
  recibidaEn: null,
  recibidaPorId: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
  renglones: [
    {
      id: 'r1',
      ordenId: 'oc-1',
      materialId: 'mat-1',
      cantidad: aDecimal(100),
      precioUnitario: aDecimal(10),
      notas: null,
      movimientoId: null,
    },
  ],
};

const dtoBase = {
  proveedorId: 'prov-1',
  renglones: [{ materialId: 'mat-1', cantidad: 100, precioUnitario: 10 }],
};

function armar(orden: any = ordenBase) {
  const repo = {
    crear: jest.fn<Promise<any>, any[]>(async () => orden),
    buscarConFiltros: jest.fn<Promise<any>, any[]>(async () => [orden]),
    contar: jest.fn<Promise<any>, any[]>(async () => 1),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => orden),
    actualizar: jest.fn<Promise<any>, any[]>(async () => orden),
    cambiarEstado: jest.fn<Promise<any>, any[]>(async () => orden),
    recibir: jest.fn<Promise<any>, any[]>(async () => ({
      ...orden,
      estado: EstadoOrdenCompra.RECIBIDA,
    })),
    eliminar: jest.fn<Promise<any>, any[]>(async () => undefined),
    // Registrar el envio emite la orden si estaba en BORRADOR: el doble
    // devuelve la orden ya emitida, como la de verdad.
    registrarEnvio: jest.fn<Promise<any>, any[]>(async () => ({
      ...orden,
      estado: EstadoOrdenCompra.EMITIDA,
    })),
    listarEnvios: jest.fn<Promise<any>, any[]>(async () => []),
  };
  const proveedores = { obtener: jest.fn<Promise<any>, any[]>(async () => ({ id: 'prov-1' })) };
  const materiales = {
    obtener: jest.fn<Promise<any>, any[]>(async () => ({ id: 'mat-1' })),
    // Las ordenes validan con `obtenerEnUso`: no tiene sentido comprar algo
    // que se saco de circulacion.
    obtenerEnUso: jest.fn<Promise<any>, any[]>(async () => ({ id: 'mat-1', activo: true })),
  };
  // Por defecto el material no tiene ajustes: la regla de la fecha no estorba a
  // las pruebas que estan mirando otra cosa.
  const movimientos = {
    verificarFechaContraAjustes: jest.fn<Promise<any>, any[]>(async () => undefined),
  };
  const correo = {
    estaConfigurado: jest.fn(() => true),
    enviar: jest.fn<Promise<any>, any[]>(async () => undefined),
  };
  const config = {
    get: jest.fn((clave: string) =>
      clave === 'MAIL_ADMINISTRACION' ? 'administracion@lacteoslastres.com.ar' : undefined,
    ),
  };

  return {
    repo,
    proveedores,
    materiales,
    movimientos,
    correo,
    config,
    service: new OrdenesCompraService(
      repo as unknown as OrdenesCompraRepository,
      proveedores as unknown as ProveedoresService,
      materiales as unknown as MaterialesService,
      movimientos as unknown as MovimientosStockService,
      correo as unknown as CorreoService,
      config as unknown as ConfigService,
    ),
  };
}

describe('OrdenesCompraService - crear()', () => {
  it('valida que el proveedor exista', async () => {
    const { service, proveedores } = armar();
    await service.crear(dtoBase as any);
    expect(proveedores.obtener).toHaveBeenCalledWith('prov-1');
  });

  it('valida que cada material exista Y este en uso', async () => {
    const { service, materiales } = armar();
    await service.crear({
      proveedorId: 'prov-1',
      renglones: [
        { materialId: 'mat-1', cantidad: 1 },
        { materialId: 'mat-2', cantidad: 2 },
      ],
    } as any);
    expect(materiales.obtenerEnUso).toHaveBeenCalledTimes(2);
  });

  it('REGRESION: no deja comprar un material jubilado', async () => {
    // Se lo saco de circulacion justamente para que deje de aparecer en las
    // cargas nuevas; una orden de compra es la mas nueva de todas.
    const { service, materiales } = armar();
    materiales.obtenerEnUso.mockRejectedValue(
      new BadRequestException('El material "Cable viejo" está desactivado'),
    );

    await expect(service.crear(dtoBase as any)).rejects.toThrow(BadRequestException);
  });

  it('propaga 404 si el proveedor no existe', async () => {
    const { service, proveedores } = armar();
    proveedores.obtener.mockRejectedValue(new NotFoundException('no existe'));
    await expect(service.crear(dtoBase as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('REGRESION: rechaza el mismo material repetido en dos renglones', async () => {
    const { service } = armar();
    await expect(
      service.crear({
        proveedorId: 'prov-1',
        renglones: [
          { materialId: 'mat-1', cantidad: 10 },
          { materialId: 'mat-1', cantidad: 5 },
        ],
      } as any),
    ).rejects.toThrow(/mismo material/);
  });

  it('registra quien creo la orden', async () => {
    const { service, repo } = armar();
    await service.crear(dtoBase as any, { id: 'user-9' } as Usuario);
    expect(repo.crear.mock.calls[0][0].creadoPorId).toBe('user-9');
  });

  it('la orden nace en BORRADOR y editable', async () => {
    const { service } = armar();
    const res = await service.crear(dtoBase as any);
    expect(res.estado).toBe(EstadoOrdenCompra.BORRADOR);
    expect(res.editable).toBe(true);
  });
});

describe('OrdenesCompraService - numero y totales', () => {
  it('expone el numero correlativo asignado', async () => {
    const { service } = armar();
    const res = await service.crear(dtoBase as any);
    expect(res.numero).toBe('OC-2026-0001');
  });

  it('calcula el total sumando los subtotales', async () => {
    const { service } = armar();
    const res = await service.crear(dtoBase as any);
    expect(res.renglones[0].subtotal).toBe(1000); // 100 x 10
    expect(res.total).toBe(1000);
  });

  it('el total es null si algun renglon no tiene precio', async () => {
    const sinPrecio = {
      ...ordenBase,
      renglones: [
        { ...ordenBase.renglones[0] },
        {
          id: 'r2',
          ordenId: 'oc-1',
          materialId: 'mat-2',
          cantidad: aDecimal(5),
          precioUnitario: null,
          notas: null,
          movimientoId: null,
        },
      ],
    };
    const { service } = armar(sinPrecio);
    const res = await service.crear(dtoBase as any);
    expect(res.total).toBeNull();
  });
});

describe('OrdenesCompraService - transiciones de estado', () => {
  function conEstado(estado: EstadoOrdenCompra) {
    return armar({ ...ordenBase, estado });
  }

  it('BORRADOR -> EMITIDA se permite', async () => {
    const { service, repo } = conEstado(EstadoOrdenCompra.BORRADOR);
    await service.emitir('oc-1');
    expect(repo.cambiarEstado.mock.calls[0][1]).toBe(EstadoOrdenCompra.EMITIDA);
  });

  it('EMITIDA -> RECIBIDA se permite', async () => {
    const { service, repo } = conEstado(EstadoOrdenCompra.EMITIDA);
    await service.recibir('oc-1', {} as any);
    expect(repo.recibir).toHaveBeenCalled();
  });

  it('REGRESION: BORRADOR -> RECIBIDA NO se permite (hay que emitir primero)', async () => {
    const { service, repo } = conEstado(EstadoOrdenCompra.BORRADOR);
    await expect(service.recibir('oc-1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.recibir).not.toHaveBeenCalled();
  });

  it('REGRESION: una orden RECIBIDA no se puede volver a recibir (duplicaria el stock)', async () => {
    const { service, repo } = conEstado(EstadoOrdenCompra.RECIBIDA);
    await expect(service.recibir('oc-1', {} as any)).rejects.toThrow(/no puede pasar a RECIBIDA/);
    expect(repo.recibir).not.toHaveBeenCalled();
  });

  it('una orden ANULADA no se puede emitir ni recibir', async () => {
    const { service } = conEstado(EstadoOrdenCompra.ANULADA);
    await expect(service.emitir('oc-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.recibir('oc-1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('una orden RECIBIDA no se puede anular (ya movio stock)', async () => {
    const { service } = conEstado(EstadoOrdenCompra.RECIBIDA);
    await expect(service.anular('oc-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('BORRADOR y EMITIDA se pueden anular', async () => {
    for (const estado of [EstadoOrdenCompra.BORRADOR, EstadoOrdenCompra.EMITIDA]) {
      const { service, repo } = conEstado(estado);
      await service.anular('oc-1');
      expect(repo.cambiarEstado.mock.calls[0][1]).toBe(EstadoOrdenCompra.ANULADA);
    }
  });

  it('lanza 404 si la orden no existe', async () => {
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(null);
    await expect(service.emitir('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrdenesCompraService - recepcion', () => {
  it('usa el numero de orden como referencia del movimiento', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await service.recibir('oc-1', {} as any);
    expect(repo.recibir.mock.calls[0][0].referencia).toBe('OC-2026-0001');
  });

  it('si hay remito, queda en la referencia (trazabilidad)', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await service.recibir('oc-1', { remito: 'R-0001-00012345' } as any);
    expect(repo.recibir.mock.calls[0][0].referencia).toBe('OC-2026-0001 · Remito R-0001-00012345');
  });

  it('registra quien recibio', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await service.recibir('oc-1', {} as any, { id: 'user-7' } as Usuario);
    expect(repo.recibir.mock.calls[0][0].recibidaPorId).toBe('user-7');
  });

  it('sin fecha explicita usa el momento actual', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    const antes = Date.now();
    await service.recibir('oc-1', {} as any);
    const usada = repo.recibir.mock.calls[0][0].fechaRecepcion as Date;
    expect(usada.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('respeta la fecha de recepcion informada', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await service.recibir('oc-1', { fechaRecepcion: '2026-08-20T09:00:00.000Z' } as any);
    expect((repo.recibir.mock.calls[0][0].fechaRecepcion as Date).toISOString()).toBe(
      '2026-08-20T09:00:00.000Z',
    );
  });
});

describe('OrdenesCompraService - edicion y borrado', () => {
  it('REGRESION: no se edita una orden ya emitida', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });
    await expect(service.actualizar('oc-1', { observaciones: 'cambio' } as any)).rejects.toThrow(
      /no se puede editar/,
    );
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('se edita una orden en BORRADOR', async () => {
    const { service, repo } = armar();
    await service.actualizar('oc-1', { observaciones: 'urgente' } as any);
    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('rechaza dejar la orden sin renglones', async () => {
    const { service } = armar();
    await expect(service.actualizar('oc-1', { renglones: [] } as any)).rejects.toThrow(
      /al menos un renglón/,
    );
  });

  it('solo se elimina una orden en BORRADOR', async () => {
    const { service, repo } = armar();
    await service.eliminar('oc-1');
    expect(repo.eliminar).toHaveBeenCalledWith('oc-1');
  });

  it('REGRESION: una orden recibida no se elimina, se anula', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.RECIBIDA });
    await expect(service.eliminar('oc-1')).rejects.toThrow(/anulala/);
    expect(repo.eliminar).not.toHaveBeenCalled();
  });
});

describe('OrdenesCompraService - listado', () => {
  it('expande fechaHasta al fin del dia', async () => {
    const { service, repo } = armar();
    await service.listar({ pagina: 1, limite: 20, skip: 0, fechaHasta: '2026-08-25' } as any);
    const filtro = repo.buscarConFiltros.mock.calls[0][0];
    expect(filtro.fechaHasta.toISOString()).toBe('2026-08-25T23:59:59.999Z');
  });

  it('devuelve la forma paginada', async () => {
    const { service } = armar();
    const res = await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);
    expect(res).toMatchObject({ total: 1, pagina: 1, limite: 20 });
  });
});

describe('OrdenesCompraService - enviarPorCorreo()', () => {
  const PDF = Buffer.from('%PDF-1.4 contenido de prueba').toString('base64');
  const conProveedor = (email: string | null, telefono: string | null = null) => ({
    ...ordenBase,
    proveedor: { nombre: 'Ferreteria Central', cuit: '30-1', email, telefono },
  });

  it('manda al proveedor con administracion en copia', async () => {
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('ventas@ferreteria.com.ar'));

    const res = await service.enviarPorCorreo('oc-1', { pdfBase64: PDF });

    expect(res.para).toEqual(['ventas@ferreteria.com.ar']);
    expect(res.copia).toEqual(['administracion@lacteoslastres.com.ar']);
    expect(correo.enviar).toHaveBeenCalledTimes(1);
  });

  it('REGRESION: sin correo del proveedor, la orden va igual a administracion', async () => {
    // Si no, el envio se perderia del todo y no quedaria constancia interna.
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor(null));

    const res = await service.enviarPorCorreo('oc-1', { pdfBase64: PDF });

    expect(res.para).toEqual(['administracion@lacteoslastres.com.ar']);
    expect(res.copia).toEqual([]);
  });

  it('un correo invalido del proveedor se trata como si no hubiera', async () => {
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('no-es-un-mail'));

    const res = await service.enviarPorCorreo('oc-1', { pdfBase64: PDF });
    expect(res.para).toEqual(['administracion@lacteoslastres.com.ar']);
  });

  it('el correo del usuario va en Reply-To, no como remitente', async () => {
    // El remitente es la casilla del sistema; el proveedor le contesta a la
    // persona que hizo la orden.
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('ventas@ferreteria.com.ar'));

    await service.enviarPorCorreo('oc-1', { pdfBase64: PDF }, {
      nombre: 'Maxi',
      email: 'mantenimiento@lacteoslastres.com.ar',
    } as any);

    const enviado = correo.enviar.mock.calls[0][0];
    expect(enviado.responderA).toBe('mantenimiento@lacteoslastres.com.ar');
    expect(enviado.nombreRemitente).toContain('Maxi');
  });

  it('sin usuario, no se inventa un Reply-To', async () => {
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('ventas@ferreteria.com.ar'));

    await service.enviarPorCorreo('oc-1', { pdfBase64: PDF });
    expect(correo.enviar.mock.calls[0][0].responderA).toBeUndefined();
  });

  it('adjunta el PDF con el numero de orden como nombre', async () => {
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('ventas@ferreteria.com.ar'));

    await service.enviarPorCorreo('oc-1', { pdfBase64: PDF });

    const [adjunto] = correo.enviar.mock.calls[0][0].adjuntos;
    expect(adjunto.nombre).toBe('OC-2026-0001.pdf');
    expect(adjunto.tipo).toBe('application/pdf');
    expect(adjunto.contenido.toString()).toContain('%PDF-1.4');
  });

  it('el asunto y el cuerpo los arma el servidor con los datos de la orden', async () => {
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('ventas@ferreteria.com.ar'));

    await service.enviarPorCorreo('oc-1', { pdfBase64: PDF });

    const enviado = correo.enviar.mock.calls[0][0];
    expect(enviado.asunto).toContain('OC-2026-0001');
    expect(enviado.texto).toContain('Ferreteria Central');
    expect(enviado.texto).toContain('adjunta');
  });

  it('REGRESION: si el SMTP no esta configurado avisa, no rompe', async () => {
    // La app tiene que seguir andando con el envio manual.
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('ventas@ferreteria.com.ar'));
    correo.estaConfigurado.mockReturnValue(false);

    await expect(service.enviarPorCorreo('oc-1', { pdfBase64: PDF })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(correo.enviar).not.toHaveBeenCalled();
  });

  it('REGRESION: si Gmail rechaza el envio, el motivo real llega al usuario', async () => {
    // Con un 500 generico no se sabria si son las credenciales, el puerto
    // bloqueado o el limite de envios: justo lo que hace falta para arreglarlo.
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('ventas@ferreteria.com.ar'));
    correo.enviar.mockRejectedValue(
      new Error('Invalid login: 535-5.7.8 Username and Password not accepted'),
    );

    await expect(service.enviarPorCorreo('oc-1', { pdfBase64: PDF })).rejects.toThrow(
      /535-5\.7\.8/,
    );
  });

  it('REGRESION: un fallo de envio es 502, no 503', async () => {
    // El 503 queda reservado para "no configurado": es lo unico que justifica
    // que la pantalla caiga al envio manual.
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('ventas@ferreteria.com.ar'));
    correo.enviar.mockRejectedValue(new Error('Connection timeout'));

    await expect(service.enviarPorCorreo('oc-1', { pdfBase64: PDF })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('404 si la orden no existe, sin mandar nada', async () => {
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(null);

    await expect(service.enviarPorCorreo('fantasma', { pdfBase64: PDF })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(correo.enviar).not.toHaveBeenCalled();
  });

  it('REGRESION: rechaza un PDF vacio en vez de mandar un adjunto de 0 bytes', async () => {
    const { service, repo, correo } = armar();
    repo.buscarPorId.mockResolvedValue(conProveedor('ventas@ferreteria.com.ar'));

    await expect(service.enviarPorCorreo('oc-1', { pdfBase64: '!!!!' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(correo.enviar).not.toHaveBeenCalled();
  });
});

describe('OrdenesCompraService - recibir() y la fecha del ultimo ajuste', () => {
  it('REGRESION: no recibe con una fecha anterior al ultimo ajuste del material', async () => {
    // Recibir genera un movimiento de ENTRADA por renglon con la fecha de
    // recepcion: es la misma puerta al mismo problema que cargar el movimiento
    // a mano, y si la regla valiera solo en un lado se colaria por el otro.
    const { service, movimientos, repo } = armar({
      ...ordenBase,
      estado: EstadoOrdenCompra.EMITIDA,
    });
    movimientos.verificarFechaContraAjustes.mockRejectedValue(
      new BadRequestException('La fecha es anterior al último ajuste'),
    );

    await expect(
      service.recibir('oc-1', { fechaRecepcion: '2026-08-15T12:00:00.000Z' } as any),
    ).rejects.toThrow(BadRequestException);

    // Y no se recibio nada: ni media orden.
    expect(repo.recibir).not.toHaveBeenCalled();
  });

  it('comprueba TODOS los renglones antes de tocar el stock', async () => {
    // Si se comprobara renglon por renglon mientras se recibe, una orden podria
    // quedar a medio recibir y sin forma de retomarla: el estado ya cambio.
    const orden = {
      ...ordenBase,
      estado: EstadoOrdenCompra.EMITIDA,
      renglones: [
        { ...ordenBase.renglones[0], id: 'r1', materialId: 'mat-1' },
        { ...ordenBase.renglones[0], id: 'r2', materialId: 'mat-2' },
      ],
    };
    const { service, movimientos } = armar(orden);

    await service.recibir('oc-1', {} as any);

    expect(movimientos.verificarFechaContraAjustes).toHaveBeenCalledTimes(2);
  });

  it('sin ajustes de por medio, recibir sigue funcionando igual', async () => {
    const { service, repo } = armar({ ...ordenBase, estado: EstadoOrdenCompra.EMITIDA });

    await service.recibir('oc-1', {} as any);

    expect(repo.recibir).toHaveBeenCalled();
  });
});

describe('OrdenesCompraService - constancia de los envios', () => {
  it('REGRESION: mandar la orden la emite, no la deja editable', async () => {
    // Una orden que ya salio no puede seguir editandose, o el proveedor termina
    // con un PDF que no coincide con lo que dice el sistema.
    const { service, repo } = armar();

    const r = await service.enviarPorCorreo('oc-1', { pdfBase64: 'JVBERi0=' } as any);

    expect(repo.registrarEnvio).toHaveBeenCalled();
    expect(r.estado).toBe(EstadoOrdenCompra.EMITIDA);
  });

  it('REGRESION: si el correo falla, no queda constancia de un envio que no paso', async () => {
    // Al reves, "ya se la mandamos" seria mentira justo cuando alguien lo
    // consulta para no mandarla dos veces.
    const { service, repo, correo } = armar();
    correo.enviar.mockRejectedValue(new Error('Brevo respondio 500'));

    await expect(
      service.enviarPorCorreo('oc-1', { pdfBase64: 'JVBERi0=' } as any),
    ).rejects.toThrow();
    expect(repo.registrarEnvio).not.toHaveBeenCalled();
  });

  it('guarda a quien se le mando, destinatarios y copia juntos', async () => {
    // Para poder contestar "¿por que no le llego?" sin adivinar.
    const { service, repo } = armar();

    await service.enviarPorCorreo('oc-1', { pdfBase64: 'JVBERi0=' } as any);

    const registro = repo.registrarEnvio.mock.calls[0][0];
    expect(registro.via).toBe('CORREO');
    expect(registro.automatico).toBe(true);
    expect(registro.destinatarios).toContain('administracion@lacteoslastres.com.ar');
  });

  it('el envio por WhatsApp se registra como NO automatico', async () => {
    // El sistema abre el chat; quien manda es la persona. Marcarlo como
    // automatico haria leer el registro como una confirmacion de entrega.
    const { service, repo } = armar();

    await service.registrarEnvioWhatsapp('oc-1', '5493534403519');

    const registro = repo.registrarEnvio.mock.calls[0][0];
    expect(registro.via).toBe('WHATSAPP');
    expect(registro.automatico).toBe(false);
    expect(registro.destinatarios).toBe('5493534403519');
  });

  it('mandar por WhatsApp tambien emite la orden', async () => {
    const { service, repo } = armar();

    await service.registrarEnvioWhatsapp('oc-1', '5493534403519');

    expect(repo.registrarEnvio).toHaveBeenCalled();
  });

  it('registrar un envio de una orden que no existe da 404', async () => {
    const { service, repo } = armar();
    repo.buscarPorId.mockResolvedValue(null);

    await expect(service.registrarEnvioWhatsapp('oc-9', '549353')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.registrarEnvio).not.toHaveBeenCalled();
  });

  it('lista los envios con quien los hizo', async () => {
    const { service, repo } = armar();
    repo.listarEnvios.mockResolvedValue([
      {
        id: 'e1',
        via: 'CORREO',
        destinatarios: 'proveedor@x.com',
        automatico: true,
        enviadoEn: new Date('2026-09-04'),
        usuario: { nombre: 'Máximo' },
      },
    ]);

    const envios = await service.listarEnvios('oc-1');

    expect(envios[0].usuarioNombre).toBe('Máximo');
    expect(envios[0].via).toBe('CORREO');
  });

  it('un envio sin usuario no rompe el listado', async () => {
    // Los movimientos viejos y los cargados sin sesion no tienen usuario.
    const { service, repo } = armar();
    repo.listarEnvios.mockResolvedValue([
      {
        id: 'e1',
        via: 'WHATSAPP',
        destinatarios: '549353',
        automatico: false,
        enviadoEn: new Date('2026-09-04'),
        usuario: null,
      },
    ]);

    expect((await service.listarEnvios('oc-1'))[0].usuarioNombre).toBeNull();
  });
});
