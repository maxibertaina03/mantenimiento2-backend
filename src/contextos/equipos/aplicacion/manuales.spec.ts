import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import {
  MAXIMO_BYTES_MANUAL,
  MAXIMO_MANUALES_POR_EQUIPO,
  esPdf,
  nombreParaMostrar,
  validarManual,
} from '../dominio/manual';
import { AlmacenManuales, Manual, RepositorioManuales } from '../puertos/manuales';
import { RepositorioEquipos } from '../puertos/repositorio-equipos';
import { GestionarManuales } from './gestionar-manuales';

const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj << >> endobj\n%%EOF');

describe('Manuales - dominio', () => {
  it('reconoce un PDF por su contenido, no por la extensión', () => {
    expect(esPdf(PDF)).toBe(true);
    expect(esPdf(Buffer.from('PK\u0003\u0004 esto es un .docx'))).toBe(false);
  });

  it('REGRESION: un archivo renombrado a .pdf no pasa', () => {
    expect(() => validarManual('manual.pdf', Buffer.from('no soy un pdf'), 0)).toThrow(
      /tiene que ser un PDF/,
    );
  });

  it('un PDF sin la extensión tampoco: se mostraría con otro nombre', () => {
    expect(() => validarManual('manual.docx', PDF, 0)).toThrow(ErrorDatosInvalidos);
  });

  it('rechaza el vacío, el demasiado grande y el que se pasa de la cantidad', () => {
    expect(() => validarManual('m.pdf', Buffer.alloc(0), 0)).toThrow(/vacío/);
    const grande = Buffer.concat([PDF, Buffer.alloc(MAXIMO_BYTES_MANUAL)]);
    expect(() => validarManual('m.pdf', grande, 0)).toThrow(/máximo son 25 MB/);
    expect(() => validarManual('m.pdf', PDF, MAXIMO_MANUALES_POR_EQUIPO)).toThrow(/ya tiene 10/);
    expect(() => validarManual('m.pdf', PDF, MAXIMO_MANUALES_POR_EQUIPO - 1)).not.toThrow();
  });

  it('el nombre se muestra sin carpetas', () => {
    expect(nombreParaMostrar('C:\\Users\\x\\Manual bomba.pdf')).toBe('Manual bomba.pdf');
    expect(nombreParaMostrar('  ')).toBe('manual.pdf');
  });
});

describe('GestionarManuales', () => {
  function armar(opciones: { almacenListo?: boolean; equipoExiste?: boolean } = {}) {
    const filas: Manual[] = [];
    const archivos = new Map<string, Buffer>();
    const repo: RepositorioManuales = {
      listar: async (equipoId) => filas.filter((m) => m.equipoId === equipoId),
      buscar: async (equipoId, id) =>
        filas.find((m) => m.id === id && m.equipoId === equipoId) ?? null,
      contar: async (equipoId) => filas.filter((m) => m.equipoId === equipoId).length,
      crear: async (d) => {
        const m = {
          id: `man-${filas.length + 1}`,
          subidoEn: new Date(),
          subidoPorNombre: null,
          ...d,
        };
        filas.push(m);
        return m;
      },
      eliminar: async (id) => {
        filas.splice(
          filas.findIndex((m) => m.id === id),
          1,
        );
      },
    };
    const almacen: AlmacenManuales & { archivos: Map<string, Buffer> } = {
      archivos,
      estaConfigurado: () => opciones.almacenListo ?? true,
      subir: async (contenido, nombre, carpeta) => {
        const ruta = `${carpeta}/${archivos.size + 1}-${nombre}`;
        archivos.set(ruta, contenido);
        return { ruta };
      },
      enlace: async (ruta, segundos) => `https://almacen/${ruta}?vence=${segundos}`,
      borrar: async (ruta) => {
        archivos.delete(ruta);
      },
    };
    const equipos = {
      buscarPorId: async (id: string) => ((opciones.equipoExiste ?? true) ? { id } : null),
    } as unknown as RepositorioEquipos;
    const reloj = { ahora: () => new Date('2026-09-30T12:00:00.000Z') };
    return { filas, almacen, caso: new GestionarManuales(repo, almacen, equipos, reloj) };
  }

  it('sube el PDF, lo anota y lo lista', async () => {
    const { caso, almacen } = armar();
    const m = await caso.subir('eq-1', PDF, 'Manual de servicio.pdf', 'u1');

    expect(m.nombre).toBe('Manual de servicio.pdf');
    expect(m.tamanoBytes).toBe(PDF.length);
    expect(almacen.archivos.get(m.ruta)).toEqual(PDF);
    expect((await caso.listar('eq-1')).map((x) => x.nombre)).toEqual(['Manual de servicio.pdf']);
  });

  it('el enlace vence a los cinco minutos', async () => {
    const { caso } = armar();
    const m = await caso.subir('eq-1', PDF, 'm.pdf', null);
    const { url, vence } = await caso.enlace('eq-1', m.id);
    expect(url).toContain('vence=300');
    expect(vence.toISOString()).toBe('2026-09-30T12:05:00.000Z');
  });

  it('borrar se lleva la fila y el archivo', async () => {
    const { caso, almacen, filas } = armar();
    const m = await caso.subir('eq-1', PDF, 'm.pdf', null);
    await caso.borrar('eq-1', m.id);
    expect(filas).toHaveLength(0);
    expect(almacen.archivos.size).toBe(0);
  });

  it('un manual de otro equipo no se abre ni se borra desde este', async () => {
    const { caso } = armar();
    const m = await caso.subir('eq-1', PDF, 'm.pdf', null);
    await expect(caso.enlace('eq-2', m.id)).rejects.toThrow(ErrorNoEncontrado);
    await expect(caso.borrar('eq-2', m.id)).rejects.toThrow(ErrorNoEncontrado);
  });

  it('sin almacén configurado lo dice, en vez de fallar a medias', async () => {
    const { caso } = armar({ almacenListo: false });
    await expect(caso.subir('eq-1', PDF, 'm.pdf', null)).rejects.toThrow(/no tiene configurado/);
  });

  it('a un equipo que no existe no se le sube nada', async () => {
    const { caso, almacen } = armar({ equipoExiste: false });
    await expect(caso.subir('nope', PDF, 'm.pdf', null)).rejects.toThrow(ErrorNoEncontrado);
    expect(almacen.archivos.size).toBe(0);
  });

  it('REGRESION: si no se puede anotar, el archivo subido se borra', async () => {
    const { caso, almacen } = armar();
    // El repositorio falla al guardar la fila.
    (caso as unknown as { manuales: RepositorioManuales }).manuales.crear = async () => {
      throw new Error('se cayó la base');
    };
    await expect(caso.subir('eq-1', PDF, 'm.pdf', null)).rejects.toThrow('se cayó la base');
    expect(almacen.archivos.size).toBe(0);
  });
});
