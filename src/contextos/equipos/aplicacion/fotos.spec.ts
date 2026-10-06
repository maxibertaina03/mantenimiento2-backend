import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import {
  MAXIMO_BYTES_FOTO,
  MAXIMO_FOTOS_POR_EQUIPO,
  limpiarDescripcion,
  rutaDeUrlPublica,
  validarFoto,
} from '../dominio/foto';
import { Foto, RepositorioFotos } from '../puertos/fotos';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';
import { AlmacenImagenesEnMemoria } from './almacen-en-memoria';
import { GestionarFotos } from './gestionar-fotos';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe('Fotos de un equipo - dominio', () => {
  it('rechaza la vacía, la demasiado grande y la que se pasa de la cantidad', () => {
    expect(() => validarFoto(Buffer.alloc(0), 0)).toThrow(/vacía/);
    expect(() => validarFoto(Buffer.alloc(MAXIMO_BYTES_FOTO + 1), 0)).toThrow(/máximo son 5 MB/);
    expect(() => validarFoto(JPG, MAXIMO_FOTOS_POR_EQUIPO)).toThrow(/ya tiene 12/);
    expect(() => validarFoto(JPG, MAXIMO_FOTOS_POR_EQUIPO - 1)).not.toThrow();
  });

  it('la descripción se limpia; vacía queda sin descripción', () => {
    expect(limpiarDescripcion('  Chapa   característica ')).toBe('Chapa característica');
    expect(limpiarDescripcion('   ')).toBeNull();
    expect(limpiarDescripcion(undefined)).toBeNull();
    expect(() => limpiarDescripcion('x'.repeat(101))).toThrow(ErrorDatosInvalidos);
  });

  it('saca la ruta del almacén de la URL pública', () => {
    expect(
      rutaDeUrlPublica('https://x.supabase.co/storage/v1/object/public/equipos/eq-1/foto.jpg'),
    ).toBe('eq-1/foto.jpg');
    expect(rutaDeUrlPublica('https://otro.lado/foto.jpg')).toBeNull();
  });
});

describe('GestionarFotos', () => {
  function armar(opciones: { almacenListo?: boolean; principal?: string | null } = {}) {
    const filas: Foto[] = [];
    const equipo = { id: 'eq-1', fotoUrl: opciones.principal ?? null };
    const repo: RepositorioFotos = {
      listar: async (equipoId) => filas.filter((f) => f.equipoId === equipoId),
      buscar: async (equipoId, id) =>
        filas.find((f) => f.id === id && f.equipoId === equipoId) ?? null,
      contar: async (equipoId) => filas.filter((f) => f.equipoId === equipoId).length,
      crear: async (d) => {
        const f = {
          id: `foto-${filas.length + 1}`,
          subidoEn: new Date(),
          subidoPorNombre: null,
          ...d,
        };
        filas.push(f);
        return f;
      },
      cambiarDescripcion: async (id, descripcion) => {
        const f = filas.find((x) => x.id === id)!;
        f.descripcion = descripcion;
        return f;
      },
      eliminar: async (id) => {
        filas.splice(
          filas.findIndex((f) => f.id === id),
          1,
        );
      },
      intercambiarConPrincipal: async (foto, anterior) => {
        equipo.fotoUrl = foto.url;
        const f = filas.find((x) => x.id === foto.id)!;
        if (anterior) {
          Object.assign(f, {
            url: anterior,
            ruta: rutaDeUrlPublica(anterior) ?? '',
            descripcion: null,
          });
        } else {
          filas.splice(filas.indexOf(f), 1);
        }
      },
    };
    const equipos = {
      buscarPorId: async (id: string) => (id === equipo.id ? equipo : null),
    } as unknown as RepositorioEquipos;
    const almacen = new AlmacenImagenesEnMemoria(opciones.almacenListo ?? true);
    return { gestionar: new GestionarFotos(repo, almacen, equipos), filas, almacen, equipo };
  }

  it('agrega la chapa con su descripción, sin tocar la principal', async () => {
    const { gestionar, equipo } = armar({
      principal: 'https://a/object/public/equipos/eq-1/maquina.jpg',
    });
    const foto = await gestionar.subir('eq-1', JPG, 'chapa.jpg', ' Chapa característica ', 'u-1');

    expect(foto.descripcion).toBe('Chapa característica');
    expect(foto.url).toContain('eq-1/1-chapa.jpg');
    expect(equipo.fotoUrl).toContain('maquina.jpg');
    expect(await gestionar.listar('eq-1')).toHaveLength(1);
  });

  it('sin almacén configurado lo dice, y no anota nada', async () => {
    const { gestionar, filas } = armar({ almacenListo: false });
    await expect(gestionar.subir('eq-1', JPG, 'a.jpg', null, null)).rejects.toThrow(
      /no está configurada/,
    );
    expect(filas).toHaveLength(0);
  });

  it('un equipo que no existe o una foto de otro equipo dan "no encontrado"', async () => {
    const { gestionar } = armar();
    await expect(gestionar.subir('eq-9', JPG, 'a.jpg', null, null)).rejects.toThrow(
      ErrorNoEncontrado,
    );
    await expect(gestionar.borrar('eq-1', 'foto-9')).rejects.toThrow(ErrorNoEncontrado);
  });

  it('cambia la descripción', async () => {
    const { gestionar } = armar();
    const foto = await gestionar.subir('eq-1', JPG, 'a.jpg', null, null);
    expect((await gestionar.cambiarDescripcion('eq-1', foto.id, 'Tablero')).descripcion).toBe(
      'Tablero',
    );
  });

  it('usar como principal: cambian de lugar y no se borra ninguna imagen', async () => {
    const principal = 'https://a/storage/v1/object/public/equipos/eq-1/maquina.jpg';
    const { gestionar, filas, almacen, equipo } = armar({ principal });
    const chapa = await gestionar.subir('eq-1', JPG, 'chapa.jpg', 'Chapa', null);

    const urlChapa = chapa.url;

    await gestionar.hacerPrincipal('eq-1', chapa.id);

    expect(equipo.fotoUrl).toBe(urlChapa);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ url: principal, ruta: 'eq-1/maquina.jpg', descripcion: null });
    expect(almacen.borradas).toEqual([]);
  });

  it('usar como principal un equipo sin principal: la foto sale de la lista', async () => {
    const { gestionar, filas, equipo } = armar();
    const foto = await gestionar.subir('eq-1', JPG, 'maquina.jpg', null, null);

    await gestionar.hacerPrincipal('eq-1', foto.id);

    expect(equipo.fotoUrl).toBe(foto.url);
    expect(filas).toHaveLength(0);
  });

  it('borrar saca la fila y la imagen del almacén', async () => {
    const { gestionar, filas, almacen } = armar();
    const foto = await gestionar.subir('eq-1', JPG, 'a.jpg', null, null);

    await gestionar.borrar('eq-1', foto.id);

    expect(filas).toHaveLength(0);
    expect(almacen.borradas).toEqual([foto.ruta]);
  });

  it('REGRESION: una principal vieja de otro lado, al borrarla, no borra nada del almacén', async () => {
    const { gestionar, filas, almacen } = armar({ principal: 'https://otro.lado/foto.jpg' });
    const foto = await gestionar.subir('eq-1', JPG, 'a.jpg', null, null);
    await gestionar.hacerPrincipal('eq-1', foto.id);

    await gestionar.borrar('eq-1', filas[0].id);

    expect(almacen.borradas).toEqual([]);
  });
});
