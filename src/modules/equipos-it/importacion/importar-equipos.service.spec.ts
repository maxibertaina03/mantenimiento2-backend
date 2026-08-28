import { EstadoEquipoIT, TipoEquipoIT } from '@prisma/client';
import { ImportarEquiposService } from './importar-equipos.service';
import { EquiposItRepository } from '../equipos-it.repository';
import { UsuariosService } from '../../usuarios/usuarios.service';

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

  const personas: Record<string, any> = {};
  const usuarios = {
    buscarPorNombre: jest.fn<Promise<any>, any[]>(
      async (nombre: string) => personas[nombre.toLowerCase()] ?? null,
    ),
    crearSinAcceso: jest.fn<Promise<any>, any[]>(async ({ nombre, email }: any) => {
      const u = { id: `u-${nombre}`, nombre, email };
      personas[nombre.toLowerCase()] = u;
      return u;
    }),
  };

  return {
    repo,
    usuarios,
    service: new ImportarEquiposService(
      repo as unknown as EquiposItRepository,
      usuarios as unknown as UsuariosService,
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
      tipo: TipoEquipoIT.PC,
      estado: EstadoEquipoIT.EN_USO,
      marca: 'Intel',
      ubicacion: 'Contaduria',
      accesoRemoto: 'ANYDESK',
      accesoRemotoId: '737214468',
    });
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

  it('da de alta a la persona asignada como usuario sin acceso', async () => {
    const { service, usuarios } = armar();
    const r = await service.importar({ filas: [filaPC1] } as any);

    expect(usuarios.crearSinAcceso).toHaveBeenCalledTimes(1);
    expect(usuarios.crearSinAcceso.mock.calls[0][0].nombre).toBe('Luis Rodriguez');
    expect(r.usuariosCreados).toEqual(['Luis Rodriguez']);
  });

  it('el email sintético no pisa un dominio real', async () => {
    const { service, usuarios } = armar();
    await service.importar({ filas: [filaPC1] } as any);
    expect(usuarios.crearSinAcceso.mock.calls[0][0].email).toBe('luis.rodriguez@sin-acceso.local');
  });

  it('la misma persona en varias filas se crea una sola vez', async () => {
    const { service, usuarios } = armar();
    const r = await service.importar({
      filas: [
        { ...filaPC1, nombreEquipo: 'PC7', asignadoA: 'Quecoy German' },
        { ...filaPC1, nombreEquipo: 'PC8', asignadoA: 'Quecoy German' },
      ],
    } as any);

    expect(usuarios.crearSinAcceso).toHaveBeenCalledTimes(1);
    expect(r.usuariosCreados).toEqual(['Quecoy German']);
    expect(r.creados).toBe(2);
  });

  it('REGRESION: "Uso compartido" no genera un usuario', async () => {
    const { service, usuarios, repo } = armar();
    await service.importar({
      filas: [{ ...filaPC1, nombreEquipo: 'PC10', asignadoA: 'Uso compartido' }],
    } as any);

    expect(usuarios.crearSinAcceso).not.toHaveBeenCalled();
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
      existentes: { PC1: { id: 'eq-existente', asignadoAId: 'u-Luis Rodriguez' } },
    });
    const r = await service.importar({ filas: [filaPC1] } as any);

    expect(r.creados).toBe(0);
    expect(r.actualizados).toBe(1);
    expect(repo.crear).not.toHaveBeenCalled();
    expect(repo.actualizar).toHaveBeenCalledWith('eq-existente', expect.anything());
  });

  it('al reimportar no repite la asignación si no cambió', async () => {
    const { service, repo, usuarios } = armar({
      existentes: { PC1: { id: 'eq-1', asignadoAId: 'u-Luis Rodriguez' } },
    });
    // La persona ya existe con ese id.
    usuarios.buscarPorNombre.mockResolvedValue({
      id: 'u-Luis Rodriguez',
      nombre: 'Luis Rodriguez',
    });

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

  it('un equipo sin modelo usa el nombre para no quedar sin referencia', async () => {
    const { service, repo } = armar();
    await service.importar({
      filas: [{ nombreEquipo: 'IMPRESORA 7', tipo: 'Impresora', estado: 'En uso' }],
    } as any);

    expect(repo.crear.mock.calls[0][0].modelo).toBe('IMPRESORA 7');
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
    const tipos = repo.crear.mock.calls.map((c) => c[0].tipo);
    expect(tipos).toEqual([
      TipoEquipoIT.SERVIDOR,
      TipoEquipoIT.CELULAR,
      TipoEquipoIT.EQUIPO_RED,
      TipoEquipoIT.OTRO,
      // Un cargador NO es un celular, aunque la celda diga "Teléfonos".
      TipoEquipoIT.OTRO,
    ]);
  });
});
