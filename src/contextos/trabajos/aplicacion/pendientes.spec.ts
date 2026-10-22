import { ErrorDatosInvalidos, ErrorNoEsSuyo, ErrorTransicionInvalida } from '../dominio/errores';
import { ordenarPendientes, validarTextoPendiente } from '../dominio/pendiente';
import type {
  CambiosPendiente,
  NuevoPendiente,
  PendienteConNombres,
  RepositorioPendientes,
} from '../puertos/repositorio-pendientes';
import { GestionarPendientes } from './gestionar-pendientes';

class PendientesEnMemoria implements RepositorioPendientes {
  filas: PendienteConNombres[] = [];
  private n = 0;
  constructor(private readonly ahora: () => Date) {}

  async abiertos() {
    return this.filas.filter((p) => !p.hechaEn);
  }
  async hechosDesde(desde: Date) {
    return this.filas
      .filter((p) => p.hechaEn && p.hechaEn >= desde)
      .sort((a, b) => b.hechaEn!.getTime() - a.hechaEn!.getTime());
  }
  async buscar(id: string) {
    return this.filas.find((p) => p.id === id) ?? null;
  }
  async crear(d: NuevoPendiente) {
    const p: PendienteConNombres = {
      id: `p${++this.n}`,
      ...d,
      creadoEn: this.ahora(),
      hechaEn: null,
      hechaPorId: null,
      asignadoANombre: null,
      equipoNombre: null,
      creadoPorNombre: null,
      hechaPorNombre: null,
    };
    this.filas.push(p);
    return p;
  }
  async actualizar(id: string, c: CambiosPendiente) {
    const p = this.filas.find((x) => x.id === id)!;
    for (const [k, v] of Object.entries(c)) if (v !== undefined) (p as never)[k] = v as never;
    return p;
  }
  async borrar(id: string) {
    this.filas = this.filas.filter((p) => p.id !== id);
  }
}

function armar() {
  let ahora = new Date('2026-10-22T12:00:00Z');
  const repo = new PendientesEnMemoria(() => ahora);
  const caso = new GestionarPendientes(repo, { ahora: () => ahora });
  return {
    repo,
    caso,
    avanzar: (dias: number) => (ahora = new Date(ahora.getTime() + dias * 86400000)),
  };
}

describe('Pendientes - dominio', () => {
  it('el texto se limpia; vacío o de más de 500 letras no va', () => {
    expect(validarTextoPendiente('  comprar   rulemanes  ')).toBe('comprar rulemanes');
    expect(() => validarTextoPendiente('   ')).toThrow(ErrorDatosInvalidos);
    expect(() => validarTextoPendiente('x'.repeat(501))).toThrow(/hasta 500/);
  });

  it('los urgentes primero, y entre iguales los más viejos', () => {
    const p = (id: string, urgente: boolean, dia: number) => ({
      id,
      urgente,
      creadoEn: new Date(2026, 9, dia),
    });
    const orden = ordenarPendientes([
      p('a', false, 1),
      p('b', true, 5),
      p('c', true, 2),
      p('d', false, 3),
    ]);
    expect(orden.map((x) => x.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('GestionarPendientes', () => {
  it('se anota, se tilda como hecho y pasa a «hechos»', async () => {
    const { caso } = armar();
    const p = await caso.crear({ texto: 'Mandar a rebobinar el motor de la bomba 2' }, 'u1');
    expect(await caso.listar('abiertos')).toHaveLength(1);

    const hecho = await caso.marcarHecho(p.id, 'u2');
    expect(hecho.hechaPorId).toBe('u2');
    expect(await caso.listar('abiertos')).toHaveLength(0);
    expect((await caso.listar('hechos')).map((x) => x.id)).toEqual([p.id]);
  });

  it('no se tilda dos veces, y reabrir lo vuelve a la lista', async () => {
    const { caso } = armar();
    const p = await caso.crear({ texto: 'Comprar lámparas' }, 'u1');
    await caso.marcarHecho(p.id, 'u1');
    await expect(caso.marcarHecho(p.id, 'u1')).rejects.toThrow(ErrorTransicionInvalida);
    await caso.reabrir(p.id);
    expect(await caso.listar('abiertos')).toHaveLength(1);
    await expect(caso.reabrir(p.id)).rejects.toThrow(ErrorTransicionInvalida);
  });

  it('los hechos hace más de 60 días ya no se muestran', async () => {
    const { caso, avanzar } = armar();
    const p = await caso.crear({ texto: 'Pedir presupuesto de pintura' }, 'u1');
    await caso.marcarHecho(p.id, 'u1');
    avanzar(61);
    expect(await caso.listar('hechos')).toHaveLength(0);
  });

  it('borrar: quien lo anotó o un administrador; el resto, no', async () => {
    const { caso } = armar();
    const p = await caso.crear({ texto: 'Revisar la pérdida del tanque' }, 'u1');
    await expect(caso.borrar(p.id, 'u2', false)).rejects.toThrow(ErrorNoEsSuyo);
    await caso.borrar(p.id, 'u1', false);
    expect(await caso.listar('abiertos')).toHaveLength(0);

    const q = await caso.crear({ texto: 'Otro' }, 'u1');
    await caso.borrar(q.id, 'u3', true);
    expect(await caso.listar('abiertos')).toHaveLength(0);
  });

  it('editar valida el texto y deja lo que no se manda', async () => {
    const { caso } = armar();
    const p = await caso.crear({ texto: 'Comprar grasa', urgente: true }, 'u1');
    const editado = await caso.editar(p.id, { texto: 'Comprar grasa de litio' });
    expect(editado.texto).toBe('Comprar grasa de litio');
    expect(editado.urgente).toBe(true);
    await expect(caso.editar(p.id, { texto: '' })).rejects.toThrow(ErrorDatosInvalidos);
  });
});
