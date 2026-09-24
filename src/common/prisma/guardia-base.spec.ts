import { revisarBase } from './guardia-base';

/**
 * La guardia que separa la base de trabajo de la de la empresa.
 *
 * El test que más importa no es ninguno de los que frenan: es el que comprueba
 * que en Render NO frena. Una protección que deja a la planta sin sistema es
 * peor que la falta que venía a evitar.
 */
const PRODUCCION = 'postgresql://u:p@aws-1-us-west-2.pooler.supabase.com:5432/postgres';
const LOCAL = 'postgresql://u:p@localhost:5432/mantenimiento';

describe('la base tiene que corresponder al entorno', () => {
  it('REGRESION: el servidor de produccion, que no declara ENTORNO, arranca igual', () => {
    // Render no define ENTORNO. Si esto frenara, el primer despliegue con la
    // guardia dejaria a la empresa sin sistema.
    expect(revisarBase(PRODUCCION, undefined).problema).toBeNull();
  });

  it('produccion declarada como produccion, adelante', () => {
    expect(revisarBase(PRODUCCION, 'produccion').problema).toBeNull();
  });

  it('local contra la base local, adelante', () => {
    expect(revisarBase(LOCAL, 'local').problema).toBeNull();
  });

  it('REGRESION: ENTORNO=local apuntando a produccion se frena', () => {
    // El caso de verdad: el .env de la maquina de uno quedo apuntado a
    // Supabase y levantar el backend escribiria en la base real.
    const { problema } = revisarBase(PRODUCCION, 'local');
    expect(problema).toContain('PRODUCCIÓN');
  });

  it('la base de prueba tampoco puede ser produccion', () => {
    expect(revisarBase(PRODUCCION, 'prueba').problema).toContain('PRODUCCIÓN');
  });

  it('ENTORNO=local contra una base remota cualquiera se frena', () => {
    const neon = 'postgresql://u:p@ep-icy-credit.aws.neon.tech/neondb';
    expect(revisarBase(neon, 'local').problema).toContain('no está en esta máquina');
  });

  it('el mensaje dice a que base se apuntaba, y nunca la contrasenia', () => {
    // Se lee en la consola de alguien que esta apurado: tiene que decir cual
    // era la base, sin filtrar la clave en un log.
    const { problema, host } = revisarBase(PRODUCCION, 'local');
    expect(host).toBe('aws-1-us-west-2.pooler.supabase.com');
    expect(problema).toContain('aws-1-us-west-2.pooler.supabase.com');
    expect(problema).not.toContain('p@');
  });

  it('sin DATABASE_URL y sin entorno no opina: hay comandos que no usan base', () => {
    // Compilar o correr los tests con repositorios en memoria no necesita base.
    expect(revisarBase(undefined, undefined).problema).toBeNull();
  });

  it('sin DATABASE_URL pero con entorno declarado, avisa', () => {
    expect(revisarBase(undefined, 'local').problema).toContain('No hay DATABASE_URL');
  });
});
