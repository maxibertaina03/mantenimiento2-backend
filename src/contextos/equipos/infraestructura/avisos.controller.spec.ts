import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLAVE_PUBLICO } from '../../../common/auth/decorators/public.decorator';
import { DestinatariosEnMemoria } from '../aplicacion/destinatarios-en-memoria';
import { EnviadorAvisosEnMemoria } from '../aplicacion/enviador-avisos-en-memoria';
import { RepositorioAvisosEnMemoria } from '../aplicacion/repositorio-avisos-en-memoria';
import { RepositorioPlanesEnMemoria } from '../aplicacion/repositorio-planes-en-memoria';
import { RelojFijo } from '../puertos/reloj';
import { AvisosController } from './avisos.controller';

const HOY = new Date('2026-09-03T09:00:00.000Z');
const TOKEN = 'un-token-largo-y-secreto-de-prueba';

function armar(tokenConfigurado: string | undefined = TOKEN) {
  const config = {
    get: (clave: string) => (clave === 'TOKEN_AVISOS' ? tokenConfigurado : undefined),
  };
  const planes = new RepositorioPlanesEnMemoria();
  const enviador = new EnviadorAvisosEnMemoria();
  const controlador = new AvisosController(
    config as unknown as ConfigService,
    planes,
    new RepositorioAvisosEnMemoria(),
    new DestinatariosEnMemoria(['mantenimiento@lacteoslastres.com.ar']),
    enviador,
    new RelojFijo(HOY),
  );
  return { controlador, planes, enviador };
}

async function planQueVence(planes: RepositorioPlanesEnMemoria, dias: number) {
  planes.equipos.set('eq-1', { nombre: 'Compresor 1', estado: 'OPERATIVO' });
  const proximaFecha = new Date(HOY.getTime());
  proximaFecha.setUTCDate(proximaFecha.getUTCDate() + dias);
  await planes.crear({
    equipoId: 'eq-1',
    nombre: 'Cambio de aceite',
    tareas: null,
    periodicidadDias: 90,
    proximaFecha,
    activo: true,
  });
}

describe('AvisosController', () => {
  it('es publico: lo llama GitHub Actions, que no tiene sesion de Clerk', () => {
    expect(Reflect.getMetadata(CLAVE_PUBLICO, AvisosController.prototype.procesar)).toBe(true);
  });

  it('con el token correcto, procesa y manda', async () => {
    const { controlador, planes, enviador } = armar();
    await planQueVence(planes, 3);

    const r = await controlador.procesar(TOKEN);

    expect(r.enviado).toBe(true);
    expect(enviador.enviados).toHaveLength(1);
  });

  it('REGRESION: sin token no manda nada', async () => {
    // Es publico por necesidad; si ademas no pidiera token, cualquiera podria
    // disparar correos a toda la empresa desde internet.
    const { controlador, planes, enviador } = armar();
    await planQueVence(planes, 3);

    await expect(controlador.procesar(undefined)).rejects.toThrow(UnauthorizedException);
    expect(enviador.enviados).toHaveLength(0);
  });

  it('con un token equivocado tampoco', async () => {
    const { controlador, planes, enviador } = armar();
    await planQueVence(planes, 3);

    await expect(controlador.procesar('otra-cosa')).rejects.toThrow(UnauthorizedException);
    expect(enviador.enviados).toHaveLength(0);
  });

  it('un token del largo justo pero distinto tampoco pasa', async () => {
    // timingSafeEqual explota si los largos no coinciden; este es el caso que
    // llega hasta la comparacion de verdad.
    const { controlador } = armar();
    const mismoLargo = 'X'.repeat(TOKEN.length);

    await expect(controlador.procesar(mismoLargo)).rejects.toThrow(UnauthorizedException);
  });

  it('REGRESION: sin TOKEN_AVISOS configurado el endpoint queda cerrado', async () => {
    // Lo contrario —dejarlo abierto cuando falta la variable— es la clase de
    // descuido que expone el disparador el dia que alguien la borra de Render.
    const { controlador, planes } = armar(undefined);
    await planQueVence(planes, 3);

    await expect(controlador.procesar(undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controlador.procesar('cualquier-cosa')).rejects.toThrow(UnauthorizedException);
  });

  it('acepta un adelanto distinto por query', async () => {
    const { controlador, planes } = armar();
    await planQueVence(planes, 20);

    expect((await controlador.procesar(TOKEN)).enviado).toBe(false);
    expect((await controlador.procesar(TOKEN, '30')).enviado).toBe(true);
  });
});
