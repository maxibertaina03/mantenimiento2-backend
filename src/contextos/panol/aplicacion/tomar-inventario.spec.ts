import { ErrorMaterialDesactivado } from '../dominio/errores';
import {
  contarRenglon,
  decidir,
  RenglonToma,
  resumirToma,
  TomaInventario,
  validarAnulable,
} from '../dominio/toma-inventario';
import { Reloj } from '../puertos/reloj';
import {
  RenglonConMaterial,
  RepositorioTomas,
  ReubicacionConNombres,
  TomaConRelaciones,
} from '../puertos/repositorio-tomas';
import { RegistrarMovimientos } from './registrar-movimientos';
import { TomarInventario } from './tomar-inventario';

/**
 * La toma de inventario: contar, ver diferencias y ajustar.
 *
 * El cuidado central: lo que se movió después de contarlo no se ajusta a
 * ciegas (pisaría ese movimiento), queda para volver a contar.
 */
const AHORA = new Date('2026-10-16T12:00:00.000Z');
const reloj: Reloj = { ahora: () => AHORA };
const ABIERTA = { numero: 'TI-2026-0001', estado: 'ABIERTA' as const };

describe('las reglas de la toma', () => {
  it('contar guarda lo que figuraba en ese momento', () => {
    const c = contarRenglon(ABIERTA, { resultado: null }, 7, 10, AHORA, 'u1');
    expect(c).toEqual({
      contado: 7,
      stockAlContar: 10,
      contadoEn: AHORA,
      contadoPorId: 'u1',
      resultado: null,
    });
  });

  it('volver a contar uno marcado «recontar» lo deja pendiente otra vez', () => {
    expect(
      contarRenglon(ABIERTA, { resultado: 'RECONTAR' }, 5, 5, AHORA, 'u1').resultado,
    ).toBeNull();
  });

  it('un renglón ya ajustado no se cuenta de nuevo, ni una toma cerrada', () => {
    expect(() => contarRenglon(ABIERTA, { resultado: 'AJUSTADO' }, 5, 5, AHORA, 'u1')).toThrow(
      /ya se confirmó/,
    );
    expect(() =>
      contarRenglon({ ...ABIERTA, estado: 'CERRADA' }, { resultado: null }, 5, 5, AHORA, 'u1'),
    ).toThrow(/cerrada/);
  });

  it('negativo no; cero sí (el estante está vacío)', () => {
    expect(() => contarRenglon(ABIERTA, { resultado: null }, -1, 5, AHORA, 'u1')).toThrow();
    expect(contarRenglon(ABIERTA, { resultado: null }, 0, 5, AHORA, 'u1').contado).toBe(0);
  });

  it('null borra el conteo', () => {
    expect(contarRenglon(ABIERTA, { resultado: null }, null, 5, AHORA, 'u1').contado).toBeNull();
  });

  it('decidir: ajustar, sin diferencia, recontar, o nada', () => {
    expect(decidir({ contado: 7, resultado: null }, 10, false)).toEqual({
      tipo: 'AJUSTAR',
      cantidad: 7,
    });
    expect(decidir({ contado: 2.5, resultado: null }, 2.5, false)).toEqual({
      tipo: 'SIN_DIFERENCIA',
    });
    expect(decidir({ contado: 7, resultado: null }, 10, true)).toEqual({ tipo: 'RECONTAR' });
    expect(decidir({ contado: null, resultado: null }, 10, false)).toEqual({ tipo: 'NADA' });
    expect(decidir({ contado: 7, resultado: 'AJUSTADO' }, 7, false)).toEqual({ tipo: 'NADA' });
  });

  it('se anula solo si no ajustó nada, y con motivo', () => {
    expect(validarAnulable(ABIERTA, [{ resultado: null }], ' Me equivoqué ')).toBe('Me equivoqué');
    expect(() => validarAnulable(ABIERTA, [{ resultado: 'AJUSTADO' }], 'Motivo')).toThrow(
      /ya ajustó stock/,
    );
    expect(() => validarAnulable(ABIERTA, [], ' ')).toThrow(/por qué/);
  });

  it('el resumen cuenta lo contado, lo que difiere y lo pendiente', () => {
    const r = resumirToma([
      { contado: 7, stockAlContar: 10, resultado: null },
      { contado: 3, stockAlContar: 3, resultado: null },
      { contado: null, stockAlContar: null, resultado: null },
      { contado: 1, stockAlContar: 2, resultado: 'RECONTAR' },
    ]);
    expect(r).toEqual({
      total: 4,
      contados: 3,
      sinContar: 1,
      conDiferencia: 2,
      ajustados: 0,
      sinDiferencia: 0,
      recontar: 1,
    });
  });
});

// ── El caso de uso, con dobles ──────────────────────────────────────────────

class TomasEnMemoria implements RepositorioTomas {
  toma: TomaConRelaciones | null = null;
  renglonesGuardados: RenglonConMaterial[] = [];
  /** materialId → stock que figura. */
  stock = new Map<string, number>();
  /** Materiales que tuvieron movimientos después de contarlos. */
  movidos = new Set<string>();
  materiales: { id: string; nombre: string; stock: number }[] = [];

  async materialesDelAlcance() {
    return this.materiales.map((m) => m.id);
  }

  async crear(toma: Omit<TomaInventario, 'id' | 'numero'>, materialIds: string[]) {
    this.toma = {
      ...toma,
      id: 'toma-1',
      numero: 'TI-2026-0001',
      categoriaNombre: null,
      estanteriaNombre: null,
      abiertaPorNombre: null,
      cerradaPorNombre: null,
      totalRenglones: materialIds.length,
      contados: 0,
    };
    for (const m of this.materiales) this.stock.set(m.id, m.stock);
    this.renglonesGuardados = materialIds.map((materialId, i) => ({
      id: `r-${i + 1}`,
      tomaId: 'toma-1',
      materialId,
      contado: null,
      stockAlContar: null,
      contadoEn: null,
      contadoPorId: null,
      resultado: null,
      movimientoId: null,
      materialNombre: this.materiales.find((m) => m.id === materialId)!.nombre,
      unidad: 'u',
      estanteriaId: null,
      estanteriaNombre: null,
      fila: null,
      stockActual: 0,
      contadoPorNombre: null,
    }));
    return this.toma;
  }

  async listar() {
    return this.toma ? [this.toma] : [];
  }
  async buscarPorId(id: string) {
    return this.toma?.id === id ? this.toma : null;
  }
  async actualizar(_id: string, cambios: Partial<TomaInventario>) {
    this.toma = { ...this.toma!, ...cambios };
    return this.toma;
  }
  private conStock(r: RenglonConMaterial): RenglonConMaterial {
    return { ...r, stockActual: this.stock.get(r.materialId) ?? 0 };
  }
  async renglones() {
    return this.renglonesGuardados.map((r) => this.conStock(r));
  }
  async buscarRenglon(id: string) {
    const r = this.renglonesGuardados.find((x) => x.id === id);
    return r ? this.conStock(r) : null;
  }
  async actualizarRenglon(id: string, cambios: Partial<RenglonToma>) {
    const i = this.renglonesGuardados.findIndex((x) => x.id === id);
    this.renglonesGuardados[i] = { ...this.renglonesGuardados[i], ...cambios };
    return this.conStock(this.renglonesGuardados[i]);
  }
  async seMovioDespues(materialId: string) {
    return this.movidos.has(materialId);
  }
  /** Las estanterías en uso. */
  estanterias = new Set(['est-a', 'est-b']);
  async estanteriaActiva(id: string) {
    return this.estanterias.has(id);
  }
  registro: (ReubicacionConNombres & { hechaPorId: string | null })[] = [];
  async reubicar(d: Parameters<RepositorioTomas['reubicar']>[0]) {
    for (const r of this.renglonesGuardados.filter((x) => x.materialId === d.materialId)) {
      r.estanteriaId = d.hacia.estanteriaId;
      r.fila = d.hacia.fila;
    }
    this.registro.push({
      id: `reub-${this.registro.length + 1}`,
      materialId: d.materialId,
      materialNombre: d.materialId,
      desdeEstanteria: d.desde.estanteriaId,
      desdeFila: d.desde.fila,
      haciaEstanteria: d.hacia.estanteriaId,
      haciaFila: d.hacia.fila,
      hechaEn: d.hechaEn,
      hechaPorId: d.hechaPorId,
      hechaPorNombre: null,
    });
  }
  async reubicaciones() {
    return this.registro;
  }
}

function armar(materiales: { id: string; nombre: string; stock: number }[]) {
  const repo = new TomasEnMemoria();
  repo.materiales = materiales;
  const ajustes: { materialId: string; cantidad: number; notas?: string }[] = [];
  const desactivados = new Set<string>();
  const movimientos = {
    crear: async (datos: { materialId: string; cantidad: number; notas?: string }) => {
      if (desactivados.has(datos.materialId)) {
        throw new ErrorMaterialDesactivado('El material está fuera de circulación.');
      }
      ajustes.push({ materialId: datos.materialId, cantidad: datos.cantidad, notas: datos.notas });
      repo.stock.set(datos.materialId, datos.cantidad);
      return { id: `mov-${ajustes.length}` };
    },
  } as unknown as RegistrarMovimientos;
  return { repo, ajustes, desactivados, tomas: new TomarInventario(repo, movimientos, reloj) };
}

const MATERIALES = [
  { id: 'cable', nombre: 'Cable 2,5 mm', stock: 10 },
  { id: 'llave', nombre: 'Llave térmica', stock: 3 },
  { id: 'cinta', nombre: 'Cinta aisladora', stock: 8 },
];

describe('TomarInventario', () => {
  it('abre con un renglón por material en uso', async () => {
    const { tomas } = armar(MATERIALES);
    const toma = await tomas.abrir({ categoriaId: 'electricidad' }, 'u1');
    expect(toma.totalRenglones).toBe(3);
    expect(toma.estado).toBe('ABIERTA');
  });

  it('reubicar: el material cambia de lugar y la toma lo registra', async () => {
    const { tomas, repo } = armar(MATERIALES);
    await tomas.abrir({}, 'u1');
    const renglon = await tomas.reubicar('toma-1', 'r-1', { estanteriaId: 'est-a', fila: 3 }, 'u2');
    expect(renglon).toEqual(expect.objectContaining({ estanteriaId: 'est-a', fila: 3 }));
    expect(repo.registro).toEqual([
      expect.objectContaining({
        materialId: 'cable',
        desdeEstanteria: null,
        desdeFila: null,
        haciaEstanteria: 'est-a',
        haciaFila: 3,
        hechaPorId: 'u2',
      }),
    ]);
    expect((await tomas.detalle('toma-1')).reubicaciones).toHaveLength(1);
  });

  it('reubicar: no al mismo lugar, ni a una estantería que no se usa, ni con la toma cerrada', async () => {
    const { tomas, repo } = armar(MATERIALES);
    await tomas.abrir({}, 'u1');
    await tomas.reubicar('toma-1', 'r-1', { estanteriaId: 'est-a', fila: 3 }, 'u1');
    await expect(
      tomas.reubicar('toma-1', 'r-1', { estanteriaId: 'est-a', fila: 3 }, 'u1'),
    ).rejects.toThrow(/ya está en ese lugar/);
    await expect(
      tomas.reubicar('toma-1', 'r-1', { estanteriaId: 'est-vieja', fila: null }, 'u1'),
    ).rejects.toThrow(/no existe o ya no se usa/);
    await expect(
      tomas.reubicar('toma-1', 'r-99', { estanteriaId: 'est-b', fila: null }, 'u1'),
    ).rejects.toThrow(/no está en esta toma/);

    await tomas.cerrar('toma-1', 'u1');
    await expect(
      tomas.reubicar('toma-1', 'r-2', { estanteriaId: 'est-b', fila: 1 }, 'u1'),
    ).rejects.toThrow(/cerrada: no se puede reubicar/);
    expect(repo.registro).toHaveLength(1);
  });

  it('contar en cero: los que figuran en 0 y no se contaron quedan contados en 0', async () => {
    const { tomas, repo } = armar([
      { id: 'cable', nombre: 'Cable 2,5 mm', stock: 0 },
      { id: 'llave', nombre: 'Llave térmica', stock: 0 },
      { id: 'cinta', nombre: 'Cinta aisladora', stock: 8 },
    ]);
    await tomas.abrir({}, 'u1');
    // Mientras se miraba, a la llave le entró stock: se saltea, no se cuenta en 0 a ciegas.
    repo.stock.set('llave', 2);

    const res = await tomas.contarEnCero('toma-1', ['r-1', 'r-2'], 'u2');
    expect(res.contadosEnCero).toBe(1);
    expect(res.salteados).toEqual(['Llave térmica']);
    expect(repo.renglonesGuardados[0]).toEqual(
      expect.objectContaining({ contado: 0, stockAlContar: 0, contadoPorId: 'u2' }),
    );
    expect(repo.renglonesGuardados[1].contado).toBeNull();

    // Uno ya contado tampoco se pisa.
    const otra = await tomas.contarEnCero('toma-1', ['r-1'], 'u3');
    expect(otra.contadosEnCero).toBe(0);
    expect(repo.renglonesGuardados[0].contadoPorId).toBe('u2');
  });

  it('contar en cero: un renglón de otra toma no va, y con la toma cerrada tampoco', async () => {
    const { tomas } = armar([{ id: 'cable', nombre: 'Cable 2,5 mm', stock: 0 }]);
    await tomas.abrir({}, 'u1');
    await expect(tomas.contarEnCero('toma-1', ['r-99'], 'u1')).rejects.toThrow(/no están/);
    await tomas.cerrar('toma-1', 'u1');
    await expect(tomas.contarEnCero('toma-1', ['r-1'], 'u1')).rejects.toThrow(/cerrada/);
  });

  it('sin materiales en el alcance, no abre', async () => {
    const { tomas } = armar([]);
    await expect(tomas.abrir({}, 'u1')).rejects.toThrow(/No hay materiales/);
  });

  it('confirma: ajusta lo que difiere, deja lo igual, no toca lo no contado, y sigue abierta', async () => {
    const { tomas, repo, ajustes } = armar(MATERIALES);
    await tomas.abrir({}, 'u1');
    await tomas.contar('toma-1', 'r-1', 7, 'u1'); // cable: figuraban 10
    await tomas.contar('toma-1', 'r-2', 3, 'u1'); // llave: igual
    // La cinta no se cuenta.

    const res = await tomas.confirmar('toma-1', 'u2');
    expect(ajustes).toEqual([expect.objectContaining({ materialId: 'cable', cantidad: 7 })]);
    expect(ajustes[0].notas).toBe(
      'Toma de inventario TI-2026-0001: se contaron 7 u, figuraban 10.',
    );
    expect(res).toEqual(expect.objectContaining({ ajustados: 1, sinDiferencia: 1, recontar: 0 }));
    expect(repo.renglonesGuardados.map((r) => r.resultado)).toEqual([
      'AJUSTADO',
      'SIN_DIFERENCIA',
      null,
    ]);
    // Falta contar la cinta: se puede seguir contando por tandas.
    expect(repo.toma!.estado).toBe('ABIERTA');
    await tomas.cerrar('toma-1', 'u2');
    expect(repo.toma!.estado).toBe('CERRADA');
  });

  it('contado todo y confirmado, se cierra sola', async () => {
    const { tomas, repo } = armar(MATERIALES);
    await tomas.abrir({}, 'u1');
    for (const [id, n] of [
      ['r-1', 10],
      ['r-2', 3],
      ['r-3', 8],
    ] as const) {
      await tomas.contar('toma-1', id, n, 'u1');
    }
    await tomas.confirmar('toma-1', 'u2');
    expect(repo.toma!.estado).toBe('CERRADA');
  });

  it('no se cierra con conteos sin confirmar: se perderían', async () => {
    const { tomas } = armar(MATERIALES);
    await tomas.abrir({}, 'u1');
    await tomas.contar('toma-1', 'r-1', 4, 'u1');
    await expect(tomas.cerrar('toma-1', 'u2')).rejects.toThrow(/sin confirmar/);
  });

  it('REGRESION: lo que se movió después de contarlo no se ajusta, y la toma sigue abierta', async () => {
    const { tomas, repo, ajustes } = armar(MATERIALES);
    await tomas.abrir({}, 'u1');
    await tomas.contar('toma-1', 'r-1', 7, 'u1');
    // Mientras tanto, alguien sacó 2 cables con una salida.
    repo.movidos.add('cable');
    repo.stock.set('cable', 8);

    const res = await tomas.confirmar('toma-1', 'u2');
    expect(ajustes).toEqual([]);
    expect(res.recontar).toBe(1);
    expect(repo.toma!.estado).toBe('ABIERTA');

    // Se vuelve a contar y se confirma de nuevo.
    repo.movidos.clear();
    await tomas.contar('toma-1', 'r-1', 5, 'u1');
    await tomas.confirmar('toma-1', 'u2');
    expect(ajustes).toEqual([expect.objectContaining({ materialId: 'cable', cantidad: 5 })]);
    expect(repo.renglonesGuardados[0].resultado).toBe('AJUSTADO');
  });

  it('un material que salió de circulación no frena los demás: se avisa y la toma sigue abierta', async () => {
    const { tomas, repo, ajustes, desactivados } = armar(MATERIALES);
    await tomas.abrir({}, 'u1');
    await tomas.contar('toma-1', 'r-1', 7, 'u1');
    await tomas.contar('toma-1', 'r-3', 2, 'u1');
    desactivados.add('cable');

    const res = await tomas.confirmar('toma-1', 'u2');
    expect(ajustes.map((a) => a.materialId)).toEqual(['cinta']);
    expect(res.errores).toEqual([
      { materialNombre: 'Cable 2,5 mm', motivo: 'El material está fuera de circulación.' },
    ]);
    expect(repo.toma!.estado).toBe('ABIERTA');
  });

  it('sin nada contado no se confirma', async () => {
    const { tomas } = armar(MATERIALES);
    await tomas.abrir({}, 'u1');
    await expect(tomas.confirmar('toma-1', 'u2')).rejects.toThrow(/no se contó nada/);
  });

  it('un renglón de otra toma no se cuenta desde esta', async () => {
    const { tomas } = armar(MATERIALES);
    await tomas.abrir({}, 'u1');
    await expect(tomas.contar('toma-1', 'r-99', 1, 'u1')).rejects.toThrow(/no está en esta toma/);
  });
});
