import {
  ErrorDatosInvalidos,
  ErrorSinDestinatario,
  ErrorTransicionInvalida,
} from '../dominio/errores';
import { armarMensajeAlTaller } from '../dominio/mensaje-trabajo';
import { CorreoAlTaller, CorreoTrabajos, ContactoDelTaller } from '../puertos/envio';
import { EquiposEnTaller } from '../puertos/equipos-en-taller';
import { Reloj } from '../puertos/reloj';
import { ConsultaEquiposEnMemoria } from './consulta-equipos-en-memoria';
import { ConsultaEquiposItEnMemoria } from './consulta-equipos-it-en-memoria';
import { ConsultaUsuariosEnMemoria } from './consulta-usuarios-en-memoria';
import { EnviarOrdenesTrabajo } from './enviar-ordenes-trabajo';
import { GestionarOrdenesTrabajo } from './gestionar-ordenes-trabajo';
import { PlanesEnMemoria } from './planes-en-memoria';
import { RegistrarTrabajoDePlan } from './registrar-trabajo-de-plan';
import { RepositorioOrdenesEnMemoria } from './repositorio-en-memoria';
import { RepositorioTareasEnMemoria } from './repositorio-tareas-en-memoria';

/**
 * Mandar un equipo a un taller de afuera: el tubo de oxígeno a llenar, la
 * bomba a rebobinar. La máquina figura en reparación mientras está afuera,
 * la orden se le manda al taller, y al volver se cierra con su remito.
 */
const AHORA = new Date('2026-10-14T10:00:00.000Z');
const reloj: Reloj = { ahora: () => AHORA };

/** Lo que equipos haría con cada aviso, anotado en orden. */
class TallerAnotado implements EquiposEnTaller {
  avisos: string[] = [];
  async salioAlTaller(equipoId: string) {
    this.avisos.push(`salio:${equipoId}`);
  }
  async volvioDelTaller(equipoId: string) {
    this.avisos.push(`volvio:${equipoId}`);
  }
}

class CorreoAnotado implements CorreoTrabajos {
  enviados: CorreoAlTaller[] = [];
  configurado = true;
  fallar = false;
  estaConfigurado() {
    return this.configurado;
  }
  async enviar(correo: CorreoAlTaller) {
    if (this.fallar) throw new Error('535 credenciales');
    this.enviados.push(correo);
  }
  explicarError() {
    return 'el servidor rechazó las credenciales.';
  }
}

function armar(contactos: Record<string, ContactoDelTaller> = {}) {
  const repo = new RepositorioOrdenesEnMemoria();
  const equipos = new ConsultaEquiposEnMemoria([
    { id: 'tubo', nombre: 'Tubo 1', codigo: null },
    { id: 'bomba', nombre: 'Bomba recibo 7', codigo: 'B-007' },
  ]);
  const planes = new PlanesEnMemoria([]);
  const taller = new TallerAnotado();
  const correo = new CorreoAnotado();
  const gestionar = new GestionarOrdenesTrabajo(
    repo,
    equipos,
    new ConsultaEquiposItEnMemoria([]),
    new ConsultaUsuariosEnMemoria([{ id: 'u1', nombre: 'Facundo', puedeTrabajar: true }]),
    planes,
    reloj,
    new RegistrarTrabajoDePlan(planes, new RepositorioTareasEnMemoria()),
    taller,
  );
  const enviar = new EnviarOrdenesTrabajo(repo, correo, {
    contacto: async (id) => contactos[id] ?? null,
  });
  return { repo, taller, correo, gestionar, enviar };
}

const AL_TALLER = {
  titulo: 'Llenar el tubo de oxígeno',
  tipo: 'CORRECTIVO',
  abiertaPorId: 'u1',
  equipoId: 'tubo',
  ejecutor: 'EXTERNO',
  proveedorId: 'prov-ox',
} as const;

describe('el equipo figura en reparación mientras está en un taller', () => {
  it('abrir la orden externa lo manda; cerrarla lo trae', async () => {
    const { gestionar, taller } = armar();
    const orden = await gestionar.crear(AL_TALLER);
    expect(taller.avisos).toEqual(['salio:tubo']);

    await gestionar.cerrar(orden.id, 'Lo llenaron', 'u1');
    expect(taller.avisos).toEqual(['salio:tubo', 'volvio:tubo']);
  });

  it('anular la orden externa también lo trae', async () => {
    const { gestionar, taller } = armar();
    const orden = await gestionar.crear(AL_TALLER);
    await gestionar.anular(orden.id, 'Al final se llenó en fábrica', 'u1');
    expect(taller.avisos).toEqual(['salio:tubo', 'volvio:tubo']);
  });

  it('con dos talleres a la vez, vuelve recién cuando vuelve de los dos', async () => {
    const { gestionar, taller } = armar();
    const llenar = await gestionar.crear(AL_TALLER);
    const pintar = await gestionar.crear({ ...AL_TALLER, titulo: 'Pintar', proveedorId: 'p2' });

    await gestionar.cerrar(llenar.id, 'Lleno', 'u1');
    expect(taller.avisos.at(-1)).toBe('salio:tubo');

    await gestionar.cerrar(pintar.id, 'Pintado', 'u1');
    expect(taller.avisos.at(-1)).toBe('volvio:tubo');
  });

  it('mandar afuera una orden que era de fábrica lo manda; traerla a fábrica lo trae', async () => {
    const { gestionar, taller } = armar();
    const orden = await gestionar.crear({ ...AL_TALLER, ejecutor: 'INTERNO', proveedorId: null });
    expect(taller.avisos).toEqual([]);

    await gestionar.editar(orden.id, { ejecutor: 'EXTERNO', proveedorId: 'prov-ox' }, 'u1');
    expect(taller.avisos).toEqual(['salio:tubo']);

    await gestionar.editar(orden.id, { ejecutor: 'INTERNO' }, 'u1');
    expect(taller.avisos).toEqual(['salio:tubo', 'volvio:tubo']);
  });

  it('reabrir una orden externa lo vuelve a mandar', async () => {
    const { gestionar, taller } = armar();
    const orden = await gestionar.crear(AL_TALLER);
    await gestionar.cerrar(orden.id, 'Lleno', 'u1');
    await gestionar.reabrir(orden.id, 'u1');
    expect(taller.avisos.at(-1)).toBe('salio:tubo');
  });

  it('los trabajos de fábrica, y los externos ya hechos, no tocan el estado', async () => {
    // Si alguien marcó la máquina en reparación a mano, cerrar un trabajo de
    // fábrica no tiene por qué ponerla operativa.
    const { gestionar, taller } = armar();
    const interna = await gestionar.crear({ ...AL_TALLER, ejecutor: 'INTERNO', proveedorId: null });
    await gestionar.cerrar(interna.id, 'Hecho', 'u1');
    await gestionar.crear({ ...AL_TALLER, resolucion: 'Ya lo habían llenado' });
    expect(taller.avisos).toEqual([]);
  });

  it('al cerrar, guarda el remito del taller', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear(AL_TALLER);
    const cerrada = await gestionar.cerrar(orden.id, 'Lo llenaron', 'u1', {
      comprobanteExterno: '  R-0001-00004930 ',
      costoManoObra: 18000,
    });
    expect(cerrada.comprobanteExterno).toBe('R-0001-00004930');
    expect(cerrada.costoManoObra).toBe(18000);
  });

  it('el remito del taller no queda en un trabajo de fábrica', async () => {
    const { gestionar } = armar();
    const orden = await gestionar.crear({ ...AL_TALLER, ejecutor: 'INTERNO', proveedorId: null });
    const cerrada = await gestionar.cerrar(orden.id, 'Hecho', 'u1', {
      comprobanteExterno: 'R-1',
    });
    expect(cerrada.comprobanteExterno).toBeNull();
  });

  it('lo que está afuera se lista con el filtro de externas abiertas', async () => {
    const { gestionar, repo } = armar();
    await gestionar.crear(AL_TALLER);
    await gestionar.crear({ ...AL_TALLER, ejecutor: 'INTERNO', proveedorId: null });
    const afuera = await repo.listar({ estado: 'ABIERTA', ejecutor: 'EXTERNO' }, 0, 20);
    expect(afuera.map((o) => o.titulo)).toEqual(['Llenar el tubo de oxígeno']);
  });
});

describe('mandarle la orden al taller', () => {
  const OXIGENO = { nombre: 'Oxígeno Central', email: 'taller@oxigeno.com', telefono: null };
  const PDF = Buffer.from('%PDF-1.4 orden');

  it('por correo: al correo del taller, con el PDF, y queda registrado', async () => {
    const { gestionar, enviar, correo } = armar({ 'prov-ox': OXIGENO });
    const orden = await gestionar.crear(AL_TALLER);

    const res = await enviar.porCorreo(orden.id, PDF, {
      id: 'u1',
      nombre: 'Facundo',
      email: 'facundo@lacteos.com',
    });

    expect(res).toEqual({ para: ['taller@oxigeno.com'], responderA: 'facundo@lacteos.com' });
    expect(correo.enviados[0].asunto).toContain(orden.numero);
    expect(correo.enviados[0].texto).toContain('Trabajo a realizar: Llenar el tubo de oxígeno');
    expect(correo.enviados[0].adjuntos[0].nombre).toBe(`${orden.numero}.pdf`);
    const envios = await enviar.envios(orden.id);
    expect(envios).toEqual([
      expect.objectContaining({
        via: 'CORREO',
        destinatarios: 'taller@oxigeno.com',
        automatico: true,
      }),
    ]);
  });

  it('sin correo del taller, no se manda ni se registra', async () => {
    const { gestionar, enviar } = armar({ 'prov-ox': { ...OXIGENO, email: null } });
    const orden = await gestionar.crear(AL_TALLER);
    await expect(enviar.porCorreo(orden.id, PDF)).rejects.toThrow(ErrorSinDestinatario);
    expect(await enviar.envios(orden.id)).toEqual([]);
  });

  it('si el correo falla, no queda registrado como enviado', async () => {
    const { gestionar, enviar, correo } = armar({ 'prov-ox': OXIGENO });
    correo.fallar = true;
    const orden = await gestionar.crear(AL_TALLER);
    await expect(enviar.porCorreo(orden.id, PDF)).rejects.toThrow(/credenciales/);
    expect(await enviar.envios(orden.id)).toEqual([]);
  });

  it('una orden de fábrica, o ya cerrada, no se le manda a ningún taller', async () => {
    const { gestionar, enviar } = armar({ 'prov-ox': OXIGENO });
    const interna = await gestionar.crear({ ...AL_TALLER, ejecutor: 'INTERNO', proveedorId: null });
    await expect(enviar.porWhatsapp(interna.id, '5493564123456', 'u1')).rejects.toThrow(
      ErrorDatosInvalidos,
    );

    const externa = await gestionar.crear(AL_TALLER);
    await gestionar.cerrar(externa.id, 'Lleno', 'u1');
    await expect(enviar.porWhatsapp(externa.id, '5493564123456', 'u1')).rejects.toThrow(
      ErrorTransicionInvalida,
    );
  });

  it('por WhatsApp: queda la constancia, marcada como hecha a mano', async () => {
    const { gestionar, enviar } = armar();
    const orden = await gestionar.crear(AL_TALLER);
    await enviar.porWhatsapp(orden.id, '5493564123456', 'u1');
    expect(await enviar.envios(orden.id)).toEqual([
      expect.objectContaining({
        via: 'WHATSAPP',
        destinatarios: '5493564123456',
        automatico: false,
      }),
    ]);
  });
});

describe('el mensaje al taller', () => {
  it('dice qué equipo va y qué hay que hacerle', () => {
    const { asunto, cuerpo } = armarMensajeAlTaller({
      numero: 'OT-2026-0040',
      titulo: 'Bobinado nuevo',
      descripcion: 'El motor de 5,5 HP no arranca',
      equipoNombre: 'Bomba recibo 7',
      equipoCodigo: 'B-007',
      equipoItNombre: null,
      proveedorNombre: 'Rebobinados Sur',
    });
    expect(asunto).toBe(
      'Orden de trabajo OT-2026-0040 - Bomba recibo 7 (B-007) - Lácteos Las Tres S.R.L.',
    );
    expect(cuerpo).toContain('Estimados de Rebobinados Sur:');
    expect(cuerpo).toContain('Equipo: Bomba recibo 7 (B-007)');
    expect(cuerpo).toContain('Trabajo a realizar: Bobinado nuevo');
    expect(cuerpo).toContain('Detalle: El motor de 5,5 HP no arranca');
  });
});
