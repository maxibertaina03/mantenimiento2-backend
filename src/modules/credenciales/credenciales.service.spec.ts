import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Cofre, generarClave, leerClave } from './cofre';
import { CofreService } from './cofre.service';
import { CredencialesRepository } from './credenciales.repository';
import { CredencialesService } from './credenciales.service';

/**
 * El baul de credenciales.
 *
 * Las pruebas usan el cofre DE VERDAD, no un doble: si el cifrado se pudiera
 * simular, todas estas pruebas pasarian igual con las contrasenas guardadas en
 * texto plano, que es justamente lo que no puede pasar.
 */
const cofreReal = new Cofre(leerClave(generarClave()));
const cofre = {
  cifrar: (s: string) => cofreReal.cifrar(s),
  descifrar: (s: string) => cofreReal.descifrar(s),
  huella: (s: string) => cofreReal.huella(s),
  coincideConLaHuella: (s: string, h: string) => cofreReal.coincideConLaHuella(s, h),
} as unknown as CofreService;

const ADMIN = { id: 'usr-1', nombre: 'Máximo' } as any;

const credencial = {
  id: 'cred-1',
  nombre: 'Correo administración',
  tipo: 'CORREO',
  usuario: 'administracion@lacteoslastres.com.ar',
  url: null,
  notas: null,
  equipoItId: null,
  rotarCadaDias: 90,
  rotadaEn: new Date('2026-06-16T12:00:00.000Z'),
  proximaRotacion: new Date('2026-09-14T12:00:00.000Z'),
  activo: true,
  creadoEn: new Date('2026-06-16T12:00:00.000Z'),
  equipoIt: null,
  _count: { rotaciones: 0, vistas: 0 },
};

function armar(secretoGuardado = 'ClaveVieja123') {
  const estado = {
    secretoCifrado: cofreReal.cifrar(secretoGuardado),
    huella: cofreReal.huella(secretoGuardado),
    huellasAnteriores: [] as string[],
  };

  const repo = {
    buscarTodas: jest.fn<Promise<any>, any[]>(async () => [credencial]),
    contar: jest.fn<Promise<any>, any[]>(async () => 1),
    buscarPorId: jest.fn<Promise<any>, any[]>(async () => credencial),
    listarNombres: jest.fn<Promise<any>, any[]>(async () => [
      { id: 'cred-1', nombre: 'Correo administración' },
    ]),
    buscarSecreto: jest.fn<Promise<any>, any[]>(async () => ({
      secretoCifrado: estado.secretoCifrado,
      huella: estado.huella,
    })),
    huellasUsadas: jest.fn<Promise<any>, any[]>(async () => [
      estado.huella,
      ...estado.huellasAnteriores,
    ]),
    crear: jest.fn<Promise<any>, any[]>(async (data: any) => ({ ...credencial, ...data })),
    actualizar: jest.fn<Promise<any>, any[]>(async (_id: string, data: any) => ({
      ...credencial,
      ...data,
    })),
    rotar: jest.fn<Promise<any>, any[]>(async (p: any) => {
      estado.huellasAnteriores.push(estado.huella);
      estado.secretoCifrado = p.secretoCifrado;
      estado.huella = p.huella;
      return { ...credencial, rotadaEn: p.rotadaEn, proximaRotacion: p.proximaRotacion };
    }),
    registrarVista: jest.fn<Promise<any>, any[]>(async () => ({ vistaEn: new Date() })),
    historial: jest.fn<Promise<any>, any[]>(async () => [[], []]),
    eliminar: jest.fn<Promise<any>, any[]>(async () => undefined),
  };

  return {
    repo,
    estado,
    service: new CredencialesService(repo as unknown as CredencialesRepository, cofre),
  };
}

describe('CredencialesService', () => {
  describe('alta', () => {
    it('guarda la contrasena cifrada, nunca en claro', async () => {
      const { service, repo } = armar();
      repo.listarNombres.mockResolvedValue([]);

      await service.crear({ nombre: 'Router principal', secreto: 'Admin2026!' } as any);

      const guardado = repo.crear.mock.calls[0][0];
      expect(guardado.secretoCifrado).not.toContain('Admin2026!');
      expect(cofreReal.descifrar(guardado.secretoCifrado)).toBe('Admin2026!');
    });

    it('REGRESION: la respuesta del alta no trae la contrasena', async () => {
      // Si viajara acá, viajaría en cada pantalla que muestre credenciales, y
      // el registro de quién la vio no querría decir nada.
      const { service, repo } = armar();
      repo.listarNombres.mockResolvedValue([]);

      const creada: any = await service.crear({
        nombre: 'Router principal',
        secreto: 'Admin2026!',
      } as any);

      expect(JSON.stringify(creada)).not.toContain('Admin2026!');
      expect(creada.secreto).toBeUndefined();
      expect(creada.secretoCifrado).toBeUndefined();
      expect(creada.huella).toBeUndefined();
    });

    it('calcula cuando toca rotarla', async () => {
      const { service, repo } = armar();
      repo.listarNombres.mockResolvedValue([]);

      await service.crear({ nombre: 'Router', secreto: 'x', rotarCadaDias: 90 } as any);

      const { rotadaEn, proximaRotacion } = repo.crear.mock.calls[0][0];
      const dias = Math.round(
        (proximaRotacion.getTime() - rotadaEn.getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(dias).toBe(90);
    });

    it('sin rotacion configurada no hay fecha de vencimiento', async () => {
      const { service, repo } = armar();
      repo.listarNombres.mockResolvedValue([]);

      await service.crear({ nombre: 'Router', secreto: 'x' } as any);

      expect(repo.crear.mock.calls[0][0].proximaRotacion).toBeNull();
    });

    it('REGRESION: no deja dos credenciales con el mismo nombre', async () => {
      // En un baul, dos fichas indistinguibles llevan a probar la contrasena
      // equivocada en el lugar equivocado.
      const { service, repo } = armar();
      await expect(
        service.crear({ nombre: 'Correo administracion', secreto: 'x' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.crear).not.toHaveBeenCalled();
    });
  });

  describe('listado', () => {
    it('REGRESION: ninguna credencial del listado trae la contrasena', async () => {
      const { service } = armar();
      const pagina = await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);

      expect(JSON.stringify(pagina)).not.toContain('ClaveVieja123');
      for (const fila of pagina.datos as any[]) {
        expect(fila.secreto).toBeUndefined();
        expect(fila.secretoCifrado).toBeUndefined();
      }
    });

    it('por defecto muestra solo las activas', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);
      expect(repo.buscarTodas.mock.calls[0][0]).toMatchObject({ activo: true });
    });

    it('el filtro de rotacion pendiente junta vencidas y por vencer', async () => {
      const { service, repo } = armar();
      await service.listar({ pagina: 1, limite: 20, skip: 0, rotacion: 'pendiente' } as any);

      const where = repo.buscarTodas.mock.calls[0][0];
      // Una sola cota superior: todo lo que vence de acá a una semana, incluido
      // lo que ya vencio. Con dos cotas quedarian afuera las vencidas.
      expect(where.proximaRotacion.lte).toBeInstanceOf(Date);
      expect(where.proximaRotacion.gte).toBeUndefined();
    });

    it('dice en que estado esta cada una', async () => {
      const { service } = armar();
      const pagina: any = await service.listar({ pagina: 1, limite: 20, skip: 0 } as any);
      expect(pagina.datos[0].estadoRotacion).toBeDefined();
    });
  });

  describe('ver la contrasena', () => {
    it('la devuelve descifrada', async () => {
      const { service } = armar('ClaveVieja123');
      const visto = await service.revelar('cred-1', ADMIN);
      expect(visto.secreto).toBe('ClaveVieja123');
    });

    it('REGRESION: queda registrado quien la vio', async () => {
      // Es lo unico que separa un gestor de una planilla de contrasenas.
      const { service, repo } = armar();
      await service.revelar('cred-1', ADMIN);
      expect(repo.registrarVista).toHaveBeenCalledWith('cred-1', 'usr-1');
    });

    it('404 si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.revelar('nope', ADMIN)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('rotar', () => {
    it('guarda la nueva cifrada y avanza la fecha', async () => {
      const { service, repo, estado } = armar('ClaveVieja123');
      await service.rotar('cred-1', { secreto: 'ClaveNueva456' }, ADMIN);

      expect(cofreReal.descifrar(estado.secretoCifrado)).toBe('ClaveNueva456');
      expect(repo.rotar.mock.calls[0][0].proximaRotacion).toBeInstanceOf(Date);
    });

    it('REGRESION: el historial guarda la HUELLA de la vieja, no la vieja', async () => {
      // Guardar las contrasenas viejas multiplicaria el dano de una filtracion:
      // en vez de perder la vigente, se perderian todas las que se usaron.
      const { service, repo } = armar('ClaveVieja123');
      await service.rotar('cred-1', { secreto: 'ClaveNueva456' }, ADMIN);

      const rotacion = repo.rotar.mock.calls[0][0];
      expect(rotacion.huellaAnterior).not.toContain('ClaveVieja123');
      expect(cofreReal.coincideConLaHuella('ClaveVieja123', rotacion.huellaAnterior)).toBe(true);
    });

    it('REGRESION: rechaza volver a la contrasena actual', async () => {
      const { service, repo } = armar('ClaveVieja123');
      await expect(
        service.rotar('cred-1', { secreto: 'ClaveVieja123' }, ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.rotar).not.toHaveBeenCalled();
    });

    it('REGRESION: rechaza volver a una que se uso hace dos rotaciones', async () => {
      // Rotar hacia una vieja deja el sistema diciendo que se roto cuando en la
      // practica no cambio nada.
      const { service } = armar('Clave1');
      await service.rotar('cred-1', { secreto: 'Clave2' }, ADMIN);
      await service.rotar('cred-1', { secreto: 'Clave3' }, ADMIN);

      await expect(service.rotar('cred-1', { secreto: 'Clave1' }, ADMIN)).rejects.toThrow(
        /ya se usó/,
      );
    });

    it('anota quien roto y por que', async () => {
      const { service, repo } = armar();
      await service.rotar('cred-1', { secreto: 'Nueva!', motivo: 'Se fue un empleado' }, ADMIN);

      expect(repo.rotar.mock.calls[0][0]).toMatchObject({
        rotadaPorId: 'usr-1',
        motivo: 'Se fue un empleado',
      });
    });
  });

  describe('editar', () => {
    it('REGRESION: editar NO cambia la contrasena', async () => {
      // Si se pudiera editar como un campo mas, el historial diria que la clave
      // tiene dos anos cuando en realidad se cambio ayer.
      const { service, repo } = armar();
      await service.actualizar('cred-1', { nombre: 'Correo admin', secreto: 'Colada!' } as any);

      const guardado = repo.actualizar.mock.calls[0][1];
      expect(guardado.secretoCifrado).toBeUndefined();
      expect(guardado.huella).toBeUndefined();
      expect(JSON.stringify(guardado)).not.toContain('Colada!');
    });

    it('REGRESION: cambiar cada cuantos dias recalcula desde la ultima rotacion', async () => {
      // Desde hoy, pasar de 90 a 30 dias dejaria la credencial "al dia" cuando
      // en realidad hace tres meses que no se toca. Es justo lo que se quiere
      // ver al acortar el plazo.
      const { service, repo } = armar();
      await service.actualizar('cred-1', { rotarCadaDias: 30 } as any);

      const { proximaRotacion } = repo.actualizar.mock.calls[0][1];
      const esperada = new Date(credencial.rotadaEn);
      esperada.setUTCDate(esperada.getUTCDate() + 30);
      expect(proximaRotacion).toEqual(esperada);
    });

    it('no toca la fecha si no se cambia el plazo', async () => {
      const { service, repo } = armar();
      await service.actualizar('cred-1', { notas: 'algo' } as any);
      expect(repo.actualizar.mock.calls[0][1].proximaRotacion).toBeUndefined();
    });

    it('REGRESION: no deja renombrar una credencial encima de otra', async () => {
      const { service, repo } = armar();
      repo.listarNombres.mockResolvedValue([
        { id: 'cred-1', nombre: 'Correo administración' },
        { id: 'cred-2', nombre: 'Router' },
      ]);
      await expect(
        service.actualizar('cred-2', { nombre: 'correo administracion' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.actualizar).not.toHaveBeenCalled();
    });

    it('renombrarse a si misma no choca', async () => {
      const { service, repo } = armar();
      await service.actualizar('cred-1', { nombre: 'Correo administración' } as any);
      expect(repo.actualizar).toHaveBeenCalled();
    });
  });

  describe('baja', () => {
    it('404 si no existe', async () => {
      const { service, repo } = armar();
      repo.buscarPorId.mockResolvedValue(null);
      await expect(service.eliminar('nope')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.eliminar).not.toHaveBeenCalled();
    });

    it('borra una que existe', async () => {
      const { service, repo } = armar();
      await service.eliminar('cred-1');
      expect(repo.eliminar).toHaveBeenCalledWith('cred-1');
    });
  });
});
