import { aDecimal } from '../../../common/dominio/decimal';
import { ErrorDatosInvalidos, ErrorNoEncontrado } from '../dominio/errores';
import { rutaDeUrlPublica } from '../dominio/foto-material';
import { ultimoInventario } from '../dominio/ultimo-inventario';
import { AlmacenFotosMateriales } from '../puertos/almacen-fotos';
import { MaterialConRelaciones, RepositorioMateriales } from '../puertos/repositorio-materiales';
import { FotoMaterial } from './foto-material';

const BASE = 'https://x.supabase.co/storage/v1/object/public/equipos';

function material(fotoUrl: string | null = null): MaterialConRelaciones {
  return {
    id: 'm1',
    nombre: 'Retén bomba',
    categoriaId: 'c1',
    unidadId: 'u1',
    stockActual: aDecimal(3),
    stockMinimo: aDecimal(0),
    activo: true,
    estanteriaId: null,
    fila: null,
    qrGeneradoEn: null,
    fotoUrl,
    notas: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };
}

function armar(actual: MaterialConRelaciones | null, configurado = true) {
  const pasos: string[] = [];
  let guardado = actual;
  const repo = {
    buscarPorId: jest.fn(async () => guardado),
    actualizar: jest.fn(async (_id: string, cambios: { fotoUrl?: string | null }) => {
      pasos.push(`ficha:${cambios.fotoUrl}`);
      guardado = { ...guardado!, fotoUrl: cambios.fotoUrl ?? null };
      return guardado;
    }),
  };
  const almacen: AlmacenFotosMateriales = {
    estaConfigurado: () => configurado,
    subir: jest.fn(async (_c: Buffer, nombre: string, id: string) => {
      pasos.push('subir');
      return `${BASE}/materiales/${id}/${nombre}`;
    }),
    borrar: jest.fn(async (ruta: string) => {
      pasos.push(`borrar:${ruta}`);
    }),
  };
  const caso = new FotoMaterial(repo as unknown as RepositorioMateriales, almacen);
  return { caso, pasos, almacen };
}

const imagen = Buffer.from('una foto');

describe('FotoMaterial', () => {
  it('sube, apunta la ficha y recién después borra la anterior', async () => {
    const { caso, pasos } = armar(material(`${BASE}/materiales/m1/vieja.jpg`));
    const resultado = await caso.cambiar('m1', imagen, 'nueva.jpg');

    expect(resultado.fotoUrl).toBe(`${BASE}/materiales/m1/nueva.jpg`);
    expect(pasos).toEqual([
      'subir',
      `ficha:${BASE}/materiales/m1/nueva.jpg`,
      'borrar:materiales/m1/vieja.jpg',
    ]);
  });

  it('sin foto anterior no borra nada', async () => {
    const { caso, almacen } = armar(material());
    await caso.cambiar('m1', imagen, 'nueva.jpg');
    expect(almacen.borrar).not.toHaveBeenCalled();
  });

  it('rechaza una imagen vacía o de más de 5 MB, sin subir nada', async () => {
    const { caso, almacen } = armar(material());
    await expect(caso.cambiar('m1', Buffer.alloc(0), 'a.jpg')).rejects.toThrow(ErrorDatosInvalidos);
    await expect(caso.cambiar('m1', Buffer.alloc(6 * 1024 * 1024), 'a.jpg')).rejects.toThrow(
      /máximo son 5 MB/,
    );
    expect(almacen.subir).not.toHaveBeenCalled();
  });

  it('sin almacén configurado lo dice claro', async () => {
    const { caso } = armar(material(), false);
    await expect(caso.cambiar('m1', imagen, 'a.jpg')).rejects.toThrow(/no está configurada/);
  });

  it('un material que no existe es 404', async () => {
    const { caso } = armar(null);
    await expect(caso.cambiar('m1', imagen, 'a.jpg')).rejects.toThrow(ErrorNoEncontrado);
  });

  it('sacar la foto vacía la ficha y borra el archivo', async () => {
    const { caso, pasos } = armar(material(`${BASE}/materiales/m1/vieja.jpg`));
    const resultado = await caso.quitar('m1');
    expect(resultado.fotoUrl).toBeNull();
    expect(pasos).toEqual(['ficha:null', 'borrar:materiales/m1/vieja.jpg']);
  });

  it('sacar la foto a uno que no tiene no hace nada', async () => {
    const { caso, pasos } = armar(material());
    await caso.quitar('m1');
    expect(pasos).toEqual([]);
  });

  it('saca la ruta del almacén de la URL pública', () => {
    expect(rutaDeUrlPublica(`${BASE}/materiales/m1/a.jpg`)).toBe('materiales/m1/a.jpg');
    expect(rutaDeUrlPublica('https://otra-cosa/a.jpg')).toBeNull();
  });
});

describe('ultimoInventario', () => {
  const toma = {
    fecha: new Date('2026-10-16T12:00:00Z'),
    tomaId: 't1',
    tomaNumero: 'TI-2026-0001',
    contado: aDecimal(9),
    figuraba: aDecimal(10),
    resultado: 'AJUSTADO',
    porNombre: 'Facundo',
  };
  const ajuste = {
    fecha: new Date('2026-08-03T12:00:00Z'),
    cantidad: aDecimal(4),
    porNombre: null,
  };

  it('nunca contado: null', () => {
    expect(ultimoInventario(null, null)).toBeNull();
  });

  it('gana lo más reciente: la toma', () => {
    expect(ultimoInventario(toma, ajuste)).toMatchObject({
      origen: 'TOMA',
      tomaNumero: 'TI-2026-0001',
    });
  });

  it('gana lo más reciente: el ajuste a mano', () => {
    const despues = { ...ajuste, fecha: new Date('2026-10-18T12:00:00Z') };
    expect(ultimoInventario(toma, despues)).toMatchObject({ origen: 'AJUSTE' });
  });

  it('sin tomas, el ajuste a mano cuenta como inventario', () => {
    expect(ultimoInventario(null, ajuste)).toMatchObject({ origen: 'AJUSTE' });
  });
});
