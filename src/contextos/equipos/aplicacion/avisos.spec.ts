import { RelojFijo } from '../puertos/reloj';
import { DestinatariosEnMemoria } from './destinatarios-en-memoria';
import { EnviadorAvisosEnMemoria } from './enviador-avisos-en-memoria';
import { ProcesarAvisos } from './procesar-avisos';
import { RepositorioAvisosEnMemoria } from './repositorio-avisos-en-memoria';
import { RepositorioPlanesEnMemoria } from './repositorio-planes-en-memoria';

const HOY = new Date('2026-09-03T09:00:00.000Z');

/** Una fecha a N días de hoy. Negativo = ya pasó. */
const enDias = (n: number) => {
  const f = new Date(HOY.getTime());
  f.setUTCDate(f.getUTCDate() + n);
  return f;
};

function armar(opciones: { destinatarios?: string[]; correoConfigurado?: boolean } = {}) {
  const planes = new RepositorioPlanesEnMemoria();
  const avisos = new RepositorioAvisosEnMemoria();
  const enviador = new EnviadorAvisosEnMemoria(opciones.correoConfigurado ?? true);
  const reloj = new RelojFijo(HOY);
  const caso = new ProcesarAvisos(
    planes,
    avisos,
    new DestinatariosEnMemoria(opciones.destinatarios ?? ['mantenimiento@lacteoslastres.com.ar']),
    enviador,
    reloj,
  );
  return { caso, planes, avisos, enviador, reloj };
}

/** Carga un plan con su equipo. Devuelve el plan guardado. */
async function plan(
  planes: RepositorioPlanesEnMemoria,
  datos: {
    equipoId?: string;
    nombre?: string;
    dias: number;
    activo?: boolean;
    estadoEquipo?: string;
  },
) {
  const equipoId = datos.equipoId ?? 'eq-1';
  planes.equipos.set(equipoId, {
    nombre: 'Compresor 1',
    estado: datos.estadoEquipo ?? 'OPERATIVO',
  });
  const creado = await planes.crear({
    equipoId,
    nombre: datos.nombre ?? 'Cambio de aceite',
    tareas: null,
    periodicidadDias: 90,
    proximaFecha: enDias(datos.dias),
    activo: datos.activo ?? true,
  });
  return creado;
}

describe('ProcesarAvisos', () => {
  it('avisa de un service que vence dentro de la semana', async () => {
    const { caso, planes, enviador } = armar();
    await plan(planes, { dias: 3 });

    const r = await caso.ejecutar();

    expect(r.enviado).toBe(true);
    expect(r.nuevos).toBe(1);
    expect(enviador.enviados).toHaveLength(1);
    expect(enviador.enviados[0].destinatarios).toEqual(['mantenimiento@lacteoslastres.com.ar']);
    expect(enviador.enviados[0].cuerpo).toContain('Compresor 1');
  });

  it('avisa tambien de los vencidos: si nadie lo hizo, sigue pendiente', async () => {
    const { caso, planes, enviador } = armar();
    await plan(planes, { dias: -20 });

    const r = await caso.ejecutar();

    expect(r.enviado).toBe(true);
    expect(enviador.enviados[0].asunto).toContain('1 vencido');
  });

  it('no avisa de lo que todavia esta lejos', async () => {
    const { caso, planes, enviador } = armar();
    await plan(planes, { dias: 30 });

    const r = await caso.ejecutar();

    expect(r.enviado).toBe(false);
    expect(r.serviciosEnPlazo).toBe(0);
    expect(enviador.enviados).toHaveLength(0);
  });

  it('el que vence justo dentro de una semana entra', async () => {
    // El borde exacto: siete dias es la regla, y "menor" en vez de "menor o
    // igual" lo dejaria fuera por un dia.
    const { caso, planes } = armar();
    await plan(planes, { dias: 7 });

    expect((await caso.ejecutar()).enviado).toBe(true);
  });

  it('REGRESION: no repite el aviso al dia siguiente', async () => {
    // Es la razon de ser de la tabla de avisos. Un service vencido que nadie
    // atiende mandaria un correo identico cada manana, y a la semana alguien
    // arma una regla de bandeja que los archiva sin leer.
    const { caso, planes, enviador, reloj } = armar();
    await plan(planes, { dias: -2 });

    expect((await caso.ejecutar()).enviado).toBe(true);

    reloj.mover(enDias(1));
    const segundo = await caso.ejecutar();

    expect(segundo.enviado).toBe(false);
    expect(segundo.serviciosEnPlazo).toBe(1);
    expect(segundo.nuevos).toBe(0);
    expect(enviador.enviados).toHaveLength(1);
  });

  it('REGRESION: correr dos veces el mismo dia manda un solo correo', async () => {
    // El disparador de GitHub Actions se puede reintentar, o alguien puede
    // llamar al endpoint a mano.
    const { caso, planes, enviador } = armar();
    await plan(planes, { dias: 1 });

    await caso.ejecutar();
    await caso.ejecutar();

    expect(enviador.enviados).toHaveLength(1);
  });

  it('avisa de nuevo cuando el plan avanza al ciclo siguiente', async () => {
    // Hecho el trabajo, la proxima fecha se mueve: ese es OTRO service y tiene
    // que volver a avisarse. La clave (plan, fecha) lo resuelve sin nada mas.
    const { caso, planes, enviador, reloj } = armar();
    const p = await plan(planes, { dias: 2 });

    await caso.ejecutar();

    // Se registra el trabajo y el plan salta noventa dias.
    await planes.actualizar(p.id, { proximaFecha: enDias(92) });
    expect((await caso.ejecutar()).enviado).toBe(false); // todavia esta lejos

    // Pasa el tiempo y el nuevo vencimiento se acerca.
    reloj.mover(enDias(88));

    expect((await caso.ejecutar()).enviado).toBe(true);
    expect(enviador.enviados).toHaveLength(2);
  });

  it('junta todo en UN correo, no uno por service', async () => {
    const { caso, planes, enviador } = armar();
    await plan(planes, { equipoId: 'a', dias: 1 });
    await plan(planes, { equipoId: 'b', dias: 2 });
    await plan(planes, { equipoId: 'c', dias: -1 });

    const r = await caso.ejecutar();

    expect(r.nuevos).toBe(3);
    expect(enviador.enviados).toHaveLength(1);
  });

  it('el correo muestra todo lo pendiente, no solo lo nuevo', async () => {
    // Quien lo abre tiene que ver el panorama. Si el mes pasado quedo algo
    // vencido, tiene que seguir apareciendo aunque el aviso nuevo sea otro.
    const { caso, planes, enviador } = armar();
    await plan(planes, { equipoId: 'viejo', nombre: 'Filtro', dias: -10 });
    await caso.ejecutar();

    await plan(planes, { equipoId: 'nuevo', nombre: 'Correas', dias: 1 });
    await caso.ejecutar();

    const ultimo = enviador.enviados[1];
    expect(ultimo.cuerpo).toContain('Correas');
    expect(ultimo.cuerpo).toContain('Filtro');
  });

  it('un plan desactivado no avisa', async () => {
    const { caso, planes } = armar();
    await plan(planes, { dias: 1, activo: false });

    expect((await caso.ejecutar()).serviciosEnPlazo).toBe(0);
  });

  it.each(['FUERA_DE_SERVICIO', 'DADO_DE_BAJA'])(
    'un equipo %s no genera avisos',
    async (estado) => {
      // No tiene sentido pedir un service de algo desafectado.
      const { caso, planes } = armar();
      await plan(planes, { dias: 1, estadoEquipo: estado });

      expect((await caso.ejecutar()).serviciosEnPlazo).toBe(0);
    },
  );

  it('un equipo en reparacion sigue avisando', async () => {
    const { caso, planes } = armar();
    await plan(planes, { dias: 1, estadoEquipo: 'EN_REPARACION' });

    expect((await caso.ejecutar()).enviado).toBe(true);
  });

  it('sin planes que venzan no manda nada', async () => {
    const { caso, enviador } = armar();

    const r = await caso.ejecutar();

    expect(r).toEqual({ serviciosEnPlazo: 0, nuevos: 0, enviado: false, destinatarios: [] });
    expect(enviador.enviados).toHaveLength(0);
  });

  it('sin destinatarios no manda, y lo dice', async () => {
    const { caso, planes, enviador } = armar({ destinatarios: [] });
    await plan(planes, { dias: 1 });

    const r = await caso.ejecutar();

    expect(r.enviado).toBe(false);
    expect(r.motivo).toMatch(/direcci[oó]n/i);
    expect(enviador.enviados).toHaveLength(0);
  });

  it('sin correo configurado no manda, y lo dice', async () => {
    const { caso, planes } = armar({ correoConfigurado: false });
    await plan(planes, { dias: 1 });

    const r = await caso.ejecutar();

    expect(r.enviado).toBe(false);
    expect(r.motivo).toMatch(/no est[aá] configurado/i);
  });

  it('REGRESION: si no se pudo mandar, no queda marcado como avisado', async () => {
    // Al reves, un fallo de Brevo dejaria el aviso registrado y nadie se
    // enteraria nunca de ese service.
    const planes = new RepositorioPlanesEnMemoria();
    const avisos = new RepositorioAvisosEnMemoria();
    const roto = new EnviadorAvisosEnMemoria(true, true);
    const caso = new ProcesarAvisos(
      planes,
      avisos,
      new DestinatariosEnMemoria(['a@b.com']),
      roto,
      new RelojFijo(HOY),
    );
    await plan(planes, { dias: 1 });

    await expect(caso.ejecutar()).rejects.toThrow();
    expect(avisos.todos()).toHaveLength(0);

    // Y al reintentar con el correo andando, el aviso sale.
    const bueno = new EnviadorAvisosEnMemoria();
    const reintento = new ProcesarAvisos(
      planes,
      avisos,
      new DestinatariosEnMemoria(['a@b.com']),
      bueno,
      new RelojFijo(HOY),
    );
    expect((await reintento.ejecutar()).enviado).toBe(true);
  });

  it('deja registrado a quienes se les mando', async () => {
    // Para poder contestar "¿por que no me llego?" sin adivinar.
    const { caso, planes, avisos } = armar({ destinatarios: ['a@b.com', 'c@d.com'] });
    await plan(planes, { dias: 1 });

    await caso.ejecutar();

    expect(avisos.todos()[0].destinatarios).toBe('a@b.com, c@d.com');
  });

  it('se puede pedir un adelanto distinto de siete dias', async () => {
    const { caso, planes } = armar();
    await plan(planes, { dias: 20 });

    expect((await caso.ejecutar()).enviado).toBe(false);
    expect((await caso.ejecutar(30)).enviado).toBe(true);
  });
});
