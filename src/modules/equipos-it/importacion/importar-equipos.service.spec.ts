import { EstadoEquipoIT } from '@prisma/client';
import { ImportarEquiposService } from './importar-equipos.service';
import { EquiposItRepository } from '../equipos-it.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TiposEquipoRepository } from '../../tipos-equipo/tipos-equipo.repository';

/**
 * Las filas de estos tests son las del inventario real que se va a importar.
 * Si el mapeo falla con esos datos, la importación mete basura en el sistema.
 */
function armar(opciones: { existentes?: Record<string, any> } = {}) {
  const existentes = opciones.existentes ?? {};
  let secuencia = 0;

  const repo = {
    crear: jest.fn<Promise<any>, any[]>(async (datos: any) => ({
      id: `eq-${++secuencia}`,
      ...datos,
    })),
    buscarPorCodigoInterno: jest.fn<Promise<any>, any[]>(
      async (codigo: string) => existentes[codigo] ?? null,
    ),
    actualizar: jest.fn<Promise<any>, any[]>(async () => ({})),
    reasignar: jest.fn<Promise<any>, any[]>(async () => ({})),
  };

  /**
   * Doble de Prisma con las tablas que toca el importador. Guardan de verdad en
   * memoria: asi se ejerce que la segunda fila con el mismo responsable, o la
   * misma marca, encuentre a la primera en vez de crear otra.
   */
  function tabla<T extends { id: string; nombre: string }>(prefijo: string) {
    const filas: T[] = [];
    return {
      filas,
      findMany: jest.fn<Promise<any>, any[]>(async (args?: any) =>
        args?.where?.marcaId
          ? filas.filter((f: any) => f.marcaId === args.where.marcaId)
          : [...filas],
      ),
      create: jest.fn<Promise<any>, any[]>(async ({ data }: any) => {
        const fila = { id: `${prefijo}-${filas.length + 1}`, ...data } as T;
        filas.push(fila);
        return fila;
      }),
    };
  }

  const responsable = tabla<any>('resp');
  const marcaEquipo = tabla<any>('marca');
  const modeloEquipo = tabla<any>('modelo');
  const ubicacionEquipo = tabla<any>('ubi');
  const prisma = { responsable, marcaEquipo, modeloEquipo, ubicacionEquipo };

  // Catálogo como el que quedó en la base tras la migración.
  const catalogo = [
    { id: 'pc', nombre: 'PC de escritorio', alias: 'pc escritorio,pc' },
    { id: 'nb', nombre: 'Notebook', alias: 'notebook' },
    { id: 'srv', nombre: 'Servidor', alias: 'servidor' },
    { id: 'cel', nombre: 'Celular', alias: 'telefonos,telefono' },
    { id: 'cam', nombre: 'Cámara de seguridad', alias: 'camara de seguridad,camara' },
    { id: 'imp', nombre: 'Impresora', alias: 'impresora' },
    { id: 'red', nombre: 'Equipo de red', alias: 'router/switch,router' },
    { id: 'isp', nombre: 'ISP', alias: 'isp' },
    { id: 'car', nombre: 'Cargador', alias: 'cargadores telefonos,cargador' },
  ];
  const tipos = { buscarTodos: jest.fn<Promise<any>, any[]>(async () => catalogo) };

  return {
    repo,
    prisma,
    responsable,
    marcaEquipo,
    modeloEquipo,
    ubicacionEquipo,
    tipos,
    service: new ImportarEquiposService(
      repo as unknown as EquiposItRepository,
      tipos as unknown as TiposEquipoRepository,
      prisma as unknown as PrismaService,
    ),
  };
}

/** Fila típica del inventario de Notion. */
const filaPC1 = {
  nombreEquipo: 'PC1',
  tipo: 'PC Escritorio',
  modelo: 'INTEL',
  estado: 'En uso',
  ubicacion: 'Contaduria',
  asignadoA: 'Luis Rodriguez',
  accesoRemotoId: '737 214 468',
};

describe('ImportarEquiposService', () => {
  it('importa una fila completa con los valores normalizados', async () => {
    const { service, repo } = armar();
    const r = await service.importar({ filas: [filaPC1] } as any);

    expect(r.creados).toBe(1);
    expect(r.conError).toBe(0);

    const datos = repo.crear.mock.calls[0][0];
    expect(datos).toMatchObject({
      codigoInterno: 'PC1',
      tipoId: 'pc',
      estado: EstadoEquipoIT.EN_USO,
      accesoRemoto: 'ANYDESK',
      accesoRemotoId: '737214468',
    });
  });

  it('marca y ubicacion se dan de alta en el catalogo y el equipo las referencia', async () => {
    // Antes eran texto libre en el equipo, y por eso convivian "Tp Link" y
    // "Tplink" como dos marcas distintas.
    const { service, repo, marcaEquipo, ubicacionEquipo } = armar();
    await service.importar({ filas: [filaPC1] } as any);

    expect(marcaEquipo.filas.map((f: any) => f.nombre)).toEqual(['Intel']);
    expect(ubicacionEquipo.filas.map((f: any) => f.nombre)).toEqual(['Contaduria']);

    const datos = repo.crear.mock.calls[0][0];
    expect(datos.marcaId).toBe(marcaEquipo.filas[0].id);
    expect(datos.ubicacionId).toBe(ubicacionEquipo.filas[0].id);
  });

  it('REGRESION: la misma marca escrita distinto no entra dos veces', async () => {
    // Es el caso real: en el inventario estaban "Tp Link" y "Tplink".
    const { service, marcaEquipo } = armar();
    await service.importar({
      filas: [
        { ...filaPC1, nombreEquipo: 'CAM1', tipo: 'Camara', modelo: 'Tp Link C-100' },
        { ...filaPC1, nombreEquipo: 'CAM2', tipo: 'Camara', modelo: 'TP LINK C-310' },
      ],
    } as any);

    expect(marcaEquipo.filas).toHaveLength(1);
  });

  it('REGRESION: el modelo que repite el nombre del equipo no entra al catalogo', async () => {
    // En treinta equipos del inventario el "modelo" era el codigo repetido:
    // PC1 con modelo "PC1". Eso no es un modelo, y catalogarlo llenaria la
    // lista de entradas usadas una sola vez.
    const { service, modeloEquipo } = armar();
    await service.importar({
      filas: [{ ...filaPC1, nombreEquipo: 'PC1', modelo: 'Intel PC1' }],
    } as any);

    expect(modeloEquipo.filas).toHaveLength(0);
  });

  it('REGRESION: nunca importa contraseñas', async () => {
    const { service, repo } = armar();
    // Aunque la planilla las traiga, no hay campo donde guardarlas.
    await service.importar({
      filas: [{ ...filaPC1, notas: 'sin secretos' }],
    } as any);

    const datos = JSON.stringify(repo.crear.mock.calls[0][0]);
    expect(datos).not.toContain('eeuu122');
    expect(datos).not.toContain('Lacteos315');
    expect(datos).not.toMatch(/contrase/i);
  });

  it('REGRESION: la persona entra como responsable, NO como usuario del sistema', async () => {
    // Antes se creaba un usuario con un correo inventado terminado en
    // @sin-acceso.local. Asi quedaron 31 usuarios que nunca iban a entrar.
    const { service, responsable } = armar();
    const r = await service.importar({ filas: [filaPC1] } as any);

    expect(responsable.create).toHaveBeenCalledTimes(1);
    expect(responsable.filas[0].nombre).toBe('Luis Rodriguez');
    expect(JSON.stringify(responsable.filas[0])).not.toContain('sin-acceso.local');
    expect(r.usuariosCreados).toEqual(['Luis Rodriguez']);
  });

  it('la misma persona en varias filas se crea una sola vez', async () => {
    const { service, responsable } = armar();
    const r = await service.importar({
      filas: [
        { ...filaPC1, nombreEquipo: 'PC7', asignadoA: 'Quecoy German' },
        { ...filaPC1, nombreEquipo: 'PC8', asignadoA: 'Quecoy German' },
      ],
    } as any);

    expect(responsable.create).toHaveBeenCalledTimes(1);
    expect(r.usuariosCreados).toEqual(['Quecoy German']);
    expect(r.creados).toBe(2);
  });

  it('REGRESION: los acentos no crean dos veces a la misma persona', async () => {
    const { service, responsable } = armar();
    await service.importar({
      filas: [
        { ...filaPC1, nombreEquipo: 'PC7', asignadoA: 'José Pérez' },
        { ...filaPC1, nombreEquipo: 'PC8', asignadoA: 'Jose Perez' },
      ],
    } as any);

    expect(responsable.create).toHaveBeenCalledTimes(1);
  });

  it('REGRESION: "Uso compartido" no genera un responsable', async () => {
    const { service, responsable, repo } = armar();
    await service.importar({
      filas: [{ ...filaPC1, nombreEquipo: 'PC10', asignadoA: 'Uso compartido' }],
    } as any);

    expect(responsable.create).not.toHaveBeenCalled();
    expect(repo.reasignar).not.toHaveBeenCalled();
  });

  it('registra la asignación en el historial', async () => {
    const { service, repo } = armar();
    await service.importar({ filas: [filaPC1] } as any);

    expect(repo.reasignar).toHaveBeenCalledTimes(1);
    expect(repo.reasignar.mock.calls[0][0].motivo).toBe('Importación de inventario');
  });

  it('IDEMPOTENTE: reimportar actualiza en vez de duplicar', async () => {
    const { service, repo } = armar({
      existentes: { PC1: { id: 'eq-existente', responsableId: 'resp-1' } },
    });
    const r = await service.importar({ filas: [filaPC1] } as any);

    expect(r.creados).toBe(0);
    expect(r.actualizados).toBe(1);
    expect(repo.crear).not.toHaveBeenCalled();
    expect(repo.actualizar).toHaveBeenCalledWith('eq-existente', expect.anything());
  });

  it('al reimportar no repite la asignación si no cambió', async () => {
    const { service, repo, responsable } = armar({
      existentes: { PC1: { id: 'eq-1', responsableId: 'resp-1' } },
    });
    // La persona ya esta cargada con ese mismo id.
    responsable.filas.push({ id: 'resp-1', nombre: 'Luis Rodriguez' });

    await service.importar({ filas: [filaPC1] } as any);
    expect(repo.reasignar).not.toHaveBeenCalled();
  });

  it('REGRESION: una fila con error no frena las demás', async () => {
    const { service, repo } = armar();
    const r = await service.importar({
      filas: [
        filaPC1,
        { nombreEquipo: 'RARO', tipo: 'Cafetera', modelo: 'X' },
        { ...filaPC1, nombreEquipo: 'PC2' },
      ],
    } as any);

    expect(r.creados).toBe(2);
    expect(r.conError).toBe(1);
    expect(repo.crear).toHaveBeenCalledTimes(2);
  });

  it('el error dice qué fila y por qué', async () => {
    const { service } = armar();
    const r = await service.importar({
      filas: [filaPC1, { nombreEquipo: 'RARO', tipo: 'Cafetera' }],
    } as any);

    expect(r.errores).toHaveLength(1);
    // Fila 3 del archivo: encabezado + la primera fila de datos.
    expect(r.errores[0]).toMatchObject({ fila: 3, equipo: 'RARO' });
    expect(r.errores[0].motivo).toMatch(/tipo de equipo/i);
  });

  it('señala los equipos cuya marca no se reconoció', async () => {
    const { service } = armar();
    const r = await service.importar({
      filas: [
        { nombreEquipo: 'GRABADORA 1', tipo: 'Cámara de Seguridad', modelo: 'DS-7616NI-E2 / 16P' },
      ],
    } as any);

    expect(r.revisarMarca).toEqual(['GRABADORA 1']);
  });

  it('un equipo sin modelo queda sin modelo, y no pierde nada', async () => {
    // Antes se copiaba el nombre del equipo en el campo modelo para "no perder
    // la referencia". Eso llenaba el inventario de modelos que no eran modelos,
    // y la referencia ya estaba en el codigo interno.
    const { service, repo, modeloEquipo } = armar();
    await service.importar({
      filas: [{ nombreEquipo: 'IMPRESORA 7', tipo: 'Impresora', estado: 'En uso' }],
    } as any);

    expect(repo.crear.mock.calls[0][0].modeloId).toBeNull();
    expect(repo.crear.mock.calls[0][0].codigoInterno).toBe('IMPRESORA 7');
    expect(modeloEquipo.filas).toHaveLength(0);
  });

  it('cubre los tipos variados del inventario real', async () => {
    const { service, repo } = armar();
    const r = await service.importar({
      filas: [
        { nombreEquipo: 'SERVIDOR 1', tipo: 'Servidor', modelo: 'INTEL', estado: 'En uso' },
        { nombreEquipo: 'TELEFONO 1', tipo: 'Teléfonos', modelo: 'Samsung Galaxy A03 Core' },
        { nombreEquipo: 'Mikrotik OFICINA', tipo: 'Router/Switch', modelo: 'RB9551G2HnD' },
        { nombreEquipo: 'STARLINK OFICINA', tipo: 'ISP', modelo: '', estado: 'Activo' },
        { nombreEquipo: 'CARGADOR 1', tipo: 'Cargadores Teléfonos', modelo: 'Only Turbo' },
      ],
    } as any);

    expect(r.creados).toBe(5);
    expect(r.conError).toBe(0);
    const tipos = repo.crear.mock.calls.map((c) => c[0].tipoId);
    expect(tipos).toEqual([
      'srv',
      'cel',
      'red',
      // ISP y Cargador ya son tipos propios: no caen en "Otro".
      'isp',
      // Un cargador NO es un celular, aunque la celda diga "Teléfonos".
      'car',
    ]);
  });
});
