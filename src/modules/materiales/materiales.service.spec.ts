import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MaterialesService } from './materiales.service';
import { MaterialesRepository } from './materiales.repository';
import { CategoriasMaterialService } from '../categorias-material/categorias-material.service';
import { UnidadesMedidaService } from '../unidades-medida/unidades-medida.service';

const categoria = { id: 'cat-1', nombre: 'Electricidad', descripcion: null };
const unidadMetro = { id: 'uni-1', nombre: 'Metro', simbolo: 'm', orden: 90, activo: true };

const material = {
  id: 'mat-1',
  nombre: 'Cable 2.5mm',
  categoriaId: 'cat-1',
  unidadId: 'uni-1',
  unidad: unidadMetro,
  stockActual: 50,
  stockMinimo: 10,
  notas: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
  categoria,
};

function armar() {
  const repo = {
    crear: jest.fn<Promise<any>, any[]>(async () => material),
    buscarTodos: jest.fn<Promise<any>, any[]>(async () => [material]),
    contar: jest.fn<Promise<any>, any[]>(async () => 1),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => material),
    buscarConHistorial: jest.fn<Promise<any>, any[]>(async () => ({
      ...material,
      movimientos: [],
    })),
    buscarBajoStock: jest.fn<Promise<any>, any[]>(async () => [material]),
    actualizar: jest.fn<Promise<any>, any[]>(async () => material),
    eliminar: jest.fn<Promise<any>, any[]>(async () => material),
    contarMovimientos: jest.fn<Promise<any>, any[]>(async () => 0),
    contarSinUnidad: jest.fn<Promise<any>, any[]>(async () => 0),
    // Nombre libre por defecto: el choque de duplicados se prueba aparte.
    buscarPorNombreParecido: jest.fn<Promise<any>, any[]>(async () => []),
    contarSinStockMinimo: jest.fn<Promise<any>, any[]>(async () => 0),
    idsBajoStock: jest.fn<Promise<any>, any[]>(async () => ['mat-1', 'mat-2']),
    buscarTodosOrdenado: jest.fn<Promise<any>, any[]>(async () => [material]),
    asignarUnidadMasiva: jest.fn<Promise<any>, any[]>(async () => 831),
  };

  const categorias = {
    obtener: jest.fn<Promise<any>, any[]>(async () => categoria),
  };

  const unidades = {
    obtener: jest.fn<Promise<any>, any[]>(async () => unidadMetro),
  };

  return {
    repo,
    categorias,
    unidades,
    service: new MaterialesService(
      repo as unknown as MaterialesRepository,
      categorias as unknown as CategoriasMaterialService,
      unidades as unknown as UnidadesMedidaService,
    ),
  };
}

describe('MaterialesService', () => {
  describe('crear()', () => {
    it('valida que la categoria exista antes de crear', async () => {
      const { service, categorias } = armar();
      await service.crear({ nombre: 'X', unidadId: 'uni-1', categoriaId: 'cat-1' } as any);
      expect(categorias.obtener).toHaveBeenCalledWith('cat-1');
    });

    it('propaga el 404 si la categoria no existe', async () => {
      const { service, categorias } = armar();
      categorias.obtener.mockRejectedValue(new NotFoundException('no existe'));
      await expect(
        service.crear({ nombre: 'X', unidadId: 'uni-1', categoriaId: 'fantasma' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('el stock inicial NO se puede setear desde el alta (solo via movimientos)', async () => {
      const { service, repo } = armar();
      await service.crear({
        nombre: 'X',
        unidadId: 'uni-1',
        categoriaId: 'cat-1',
        stockActual: 999,
      } as any);
      expect(repo.crear.mock.calls[0][0]).not.toHaveProperty('stockActual');
    });

    it('stockMinimo por defecto es 0', async () => {
      const { service, repo } = armar();
      await service.crear({ nombre: 'X', unidadId: 'uni-1', categoriaId: 'cat-1' } as any);
      expect(repo.crear.mock.calls[0][0].stockMinimo).toBe(0);
    });
  });

  describe('listar()', () => {
    it('sin busqueda solo esconde los materiales jubilados', async () => {
      // Con 896 materiales en el catalogo, arrastrar los que ya no se usan en
      // cada busqueda es justo lo que se quiere evitar. Se los sigue pudiendo
      // mirar pidiendolos con `mostrar`.
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);
      expect(repo.buscarTodosOrdenado.mock.calls[0][2]).toEqual({ activo: true });
    });

    it('mostrar=todos trae tambien los jubilados', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0, mostrar: 'todos' } as any);
      expect(repo.buscarTodosOrdenado.mock.calls[0][2]).toEqual({});
    });

    it('mostrar=inactivos trae solo los jubilados', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0, mostrar: 'inactivos' } as any);
      expect(repo.buscarTodosOrdenado.mock.calls[0][2]).toEqual({ activo: false });
    });

    it('con busqueda filtra por nombre sin distinguir mayusculas', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0, buscar: 'cable' } as any);
      expect(repo.buscarTodosOrdenado.mock.calls[0][2]).toEqual({
        activo: true,
        nombre: { contains: 'cable', mode: 'insensitive' },
      });
    });

    it('devuelve la forma paginada completa', async () => {
      const { service } = armar();
      const res = await service.listar({ pagina: 2, limite: 20, skip: 20 } as any);
      expect(res).toMatchObject({ total: 1, pagina: 2, limite: 20 });
      expect(res.datos).toHaveLength(1);
    });
  });

  describe('obtener()', () => {
    it('lanza 404 si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.obtener('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('obtenerConHistorial lanza 404 si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarConHistorial.mockResolvedValue(null);
      await expect(service.obtenerConHistorial('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('eliminar()', () => {
    it('impide borrar un material con movimientos (integridad del historial)', async () => {
      const { service, repo } = armar();
      repo.contarMovimientos.mockResolvedValue(3);
      await expect(service.eliminar('mat-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it('borra si no tiene movimientos', async () => {
      const { service, repo } = armar();
      await service.eliminar('mat-1');
      expect(repo.eliminar).toHaveBeenCalledWith('mat-1');
    });

    it('lanza 404 antes de contar movimientos si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.eliminar('nope')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.contarMovimientos).not.toHaveBeenCalled();
    });
  });

  describe('actualizar()', () => {
    it('valida la nueva categoria si se envia', async () => {
      const { service, categorias } = armar();
      await service.actualizar('mat-1', { categoriaId: 'cat-2' } as any);
      expect(categorias.obtener).toHaveBeenCalledWith('cat-2');
    });

    it('no toca la categoria si no se envia', async () => {
      const { service, repo } = armar();
      await service.actualizar('mat-1', { nombre: 'Nuevo' } as any);
      expect(repo.actualizar.mock.calls[0][1]).not.toHaveProperty('categoria');
    });
  });
  describe('asignarUnidadMasiva()', () => {
    it('por defecto solo completa los materiales SIN unidad', async () => {
      // Pisar los que ya tienen borraria el trabajo hecho a mano.
      const { service, repo } = armar();
      await service.asignarUnidadMasiva({ unidadId: 'uni-1' });
      expect(repo.asignarUnidadMasiva).toHaveBeenCalledWith('uni-1', true);
    });

    it('con soloSinUnidad=false pisa todas', async () => {
      const { service, repo } = armar();
      await service.asignarUnidadMasiva({ unidadId: 'uni-1', soloSinUnidad: false });
      expect(repo.asignarUnidadMasiva).toHaveBeenCalledWith('uni-1', false);
    });

    it('REGRESION: valida la unidad ANTES de tocar ningun material', async () => {
      // Sin esto el updateMany fallaria a mitad con un error de FK poco claro.
      const { service, repo, unidades } = armar();
      unidades.obtener.mockRejectedValue(new NotFoundException('no existe'));
      await expect(service.asignarUnidadMasiva({ unidadId: 'fantasma' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.asignarUnidadMasiva).not.toHaveBeenCalled();
    });

    it('informa cuantos actualizo y cuantos siguen sin unidad', async () => {
      const { service, repo } = armar();
      repo.contarSinUnidad.mockResolvedValue(3);
      await expect(service.asignarUnidadMasiva({ unidadId: 'uni-1' })).resolves.toEqual({
        actualizados: 831,
        sinUnidad: 3,
      });
    });
  });
});

describe('MaterialesService - listar() con filtros', () => {
  /** El `where` con el que se consulto el listado. */
  const filtro = (repo: any) => repo.buscarTodosOrdenado.mock.calls[0][2];
  /** El `orderBy` con el que se consulto el listado. */
  const orden = (repo: any) => repo.buscarTodosOrdenado.mock.calls[0][3];

  it('sin filtros la unica condicion es esconder los jubilados', async () => {
    const { service, repo } = armar();
    await service.listar({ skip: 0, limite: 20, pagina: 1 } as any);
    expect(filtro(repo)).toEqual({ activo: true });
  });

  it('filtra por categoria y por unidad', async () => {
    const { service, repo } = armar();
    await service.listar({
      skip: 0,
      limite: 20,
      pagina: 1,
      categoriaId: 'cat-1',
      unidadId: 'uni-1',
    } as any);
    expect(filtro(repo)).toMatchObject({ categoriaId: 'cat-1', unidadId: 'uni-1' });
  });

  it('stockMin y stockMax arman un rango', async () => {
    const { service, repo } = armar();
    await service.listar({ skip: 0, limite: 20, pagina: 1, stockMin: 10, stockMax: 100 } as any);
    const stock = (filtro(repo) as any).stockActual;
    expect(Number(stock.gte)).toBe(10);
    expect(Number(stock.lte)).toBe(100);
  });

  it('REGRESION: stockMin 0 se aplica, no se descarta por ser falsy', async () => {
    // Con `if (query.stockMin)` el 0 se caeria, y "stock exactamente 0" es
    // justo el filtro mas util para ver que falta comprar.
    const { service, repo } = armar();
    await service.listar({ skip: 0, limite: 20, pagina: 1, stockMin: 0, stockMax: 0 } as any);
    const stock = (filtro(repo) as any).stockActual;
    expect(Number(stock.gte)).toBe(0);
    expect(Number(stock.lte)).toBe(0);
  });

  it('el stock se compara como Decimal, no como float', async () => {
    // El stock es Decimal(14,3): comparar con un float arrastra el error de
    // punto flotante justo en los bordes del filtro.
    const { service, repo } = armar();
    await service.listar({ skip: 0, limite: 20, pagina: 1, stockMin: 0.1 } as any);
    expect(String((filtro(repo) as any).stockActual.gte)).toBe('0.1');
  });

  it('bajoStock cruza por id con los ids que devuelve el repo', async () => {
    const { service, repo } = armar();
    await service.listar({ skip: 0, limite: 20, pagina: 1, bajoStock: 'true' } as any);
    expect(filtro(repo)).toMatchObject({ id: { in: ['mat-1', 'mat-2'] } });
  });

  it('bajoStock se combina con los otros filtros, no los reemplaza', async () => {
    const { service, repo } = armar();
    await service.listar({
      skip: 0,
      limite: 20,
      pagina: 1,
      bajoStock: 'true',
      categoriaId: 'cat-1',
      buscar: 'cable',
    } as any);
    expect(filtro(repo)).toMatchObject({
      id: { in: ['mat-1', 'mat-2'] },
      categoriaId: 'cat-1',
      nombre: { contains: 'cable', mode: 'insensitive' },
    });
  });

  it('REGRESION: sinUnidad gana sobre unidadId', async () => {
    // Pedir las dos cosas es contradictorio: dejar el unidadId filtraria por
    // una unidad Y por no tener ninguna, devolviendo siempre vacio.
    const { service, repo } = armar();
    await service.listar({
      skip: 0,
      limite: 20,
      pagina: 1,
      sinUnidad: 'true',
      unidadId: 'uni-1',
    } as any);
    expect(filtro(repo)).toMatchObject({ unidadId: null });
  });

  it('ordena por stock descendente cuando se pide', async () => {
    const { service, repo } = armar();
    await service.listar({
      skip: 0,
      limite: 20,
      pagina: 1,
      ordenarPor: 'stock',
      direccion: 'desc',
    } as any);
    expect(orden(repo)[0]).toEqual({ stockActual: 'desc' });
  });

  it('REGRESION: el nombre queda como desempate en todos los ordenes', async () => {
    // Sin un desempate estable, con muchos materiales empatados (todos en 0)
    // las paginas 1 y 2 pueden repetir o saltear filas.
    const { service, repo } = armar();
    for (const campo of ['stock', 'categoria', 'unidad'] as const) {
      repo.buscarTodosOrdenado.mockClear();
      await service.listar({ skip: 0, limite: 20, pagina: 1, ordenarPor: campo } as any);
      expect(orden(repo).at(-1)).toEqual({ nombre: 'asc' });
    }
  });

  it('por defecto ordena por nombre ascendente', async () => {
    const { service, repo } = armar();
    await service.listar({ skip: 0, limite: 20, pagina: 1 } as any);
    expect(orden(repo)).toEqual([{ nombre: 'asc' }]);
  });

  it('ordenar por categoria usa el nombre de la relacion', async () => {
    const { service, repo } = armar();
    await service.listar({ skip: 0, limite: 20, pagina: 1, ordenarPor: 'categoria' } as any);
    expect(orden(repo)[0]).toEqual({ categoria: { nombre: 'asc' } });
  });

  it('el total se cuenta con el MISMO filtro que el listado', async () => {
    // Si no, la paginacion mostraria "1 de 831" filtrando por una categoria.
    const { service, repo } = armar();
    await service.listar({ skip: 0, limite: 20, pagina: 1, categoriaId: 'cat-1' } as any);
    expect(repo.contar).toHaveBeenCalledWith(filtro(repo));
  });
});

describe('MaterialesService - nombres duplicados', () => {
  it('REGRESION: no deja crear un material que ya existe con otras mayusculas', async () => {
    // Dos fichas para lo mismo parten el stock en dos y ninguna queda bien.
    const { service, repo } = armar();
    repo.buscarPorNombreParecido.mockResolvedValue([{ id: 'otro', nombre: 'Rodamiento 6204' }]);

    await expect(
      service.crear({
        nombre: 'RODAMIENTO 6204',
        categoriaId: 'cat-1',
        unidadId: 'uni-1',
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('el mensaje muestra como esta escrito el que ya existe', async () => {
    // Para que la persona pueda ir a buscarlo, en vez de adivinar.
    const { service, repo } = armar();
    repo.buscarPorNombreParecido.mockResolvedValue([{ id: 'otro', nombre: 'Rodamiento 6204' }]);

    let mensaje = '';
    try {
      await service.crear({
        nombre: 'rodamiento 6204',
        categoriaId: 'cat-1',
        unidadId: 'uni-1',
      } as any);
    } catch (e) {
      mensaje = (e as BadRequestException).message;
    }
    expect(mensaje).toContain('Rodamiento 6204');
  });

  it('guarda el nombre sin espacios de sobra', async () => {
    const { service, repo } = armar();

    await service.crear({
      nombre: '  Rodamiento   6204 ',
      categoriaId: 'cat-1',
      unidadId: 'uni-1',
    } as any);

    expect(repo.crear.mock.calls[0][0].nombre).toBe('Rodamiento 6204');
  });

  it('un nombre libre se crea sin problema', async () => {
    const { service, repo } = armar();

    await service.crear({
      nombre: 'Rodamiento 6205',
      categoriaId: 'cat-1',
      unidadId: 'uni-1',
    } as any);

    expect(repo.crear).toHaveBeenCalled();
  });

  it('renombrar un material a lo que ya se llamaba sigue funcionando', async () => {
    // Se excluye a si mismo: si no, corregirle una mayuscula seria imposible.
    const { service, repo } = armar();
    repo.buscarPorNombreParecido.mockResolvedValue([{ id: 'mat-1', nombre: 'Cable NYA' }]);

    await service.actualizar('mat-1', { nombre: 'Cable nya' } as any);

    expect(repo.actualizar).toHaveBeenCalled();
  });

  it('pero no se lo puede renombrar al nombre de OTRO material', async () => {
    const { service, repo } = armar();
    repo.buscarPorNombreParecido.mockResolvedValue([{ id: 'otro', nombre: 'Cable NYA' }]);

    await expect(service.actualizar('mat-1', { nombre: 'cable nya' } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.actualizar).not.toHaveBeenCalled();
  });
});

describe('MaterialesService - cobertura de las alertas', () => {
  it('dice a cuantos materiales puede avisar y a cuantos no', async () => {
    // La alerta solo mira los que tienen minimo definido. Si casi ninguno lo
    // tiene, la pantalla diria "todo OK" mientras media planta esta en cero.
    const { service, repo } = armar();
    repo.contar.mockResolvedValue(920);
    repo.contarSinStockMinimo.mockResolvedValue(785);
    repo.idsBajoStock.mockResolvedValue(['a', 'b', 'c']);

    expect(await service.coberturaDeAlertas()).toEqual({
      enUso: 920,
      conMinimo: 135,
      sinMinimo: 785,
      bajoStock: 3,
    });
  });

  it('con todos los minimos cargados no queda ninguno fuera', async () => {
    const { service, repo } = armar();
    repo.contar.mockResolvedValue(10);
    repo.contarSinStockMinimo.mockResolvedValue(0);
    repo.idsBajoStock.mockResolvedValue([]);

    const r = await service.coberturaDeAlertas();
    expect(r.sinMinimo).toBe(0);
    expect(r.conMinimo).toBe(10);
  });
});
