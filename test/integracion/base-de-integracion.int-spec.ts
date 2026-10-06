import { urlDeIntegracion } from './base-de-integracion';

/**
 * La guarda que impide que los tests de integración —que vacían la base—
 * corran contra otra cosa que la base de integración.
 */
describe('la base de los tests de integración', () => {
  const original = process.env.INTEGRACION_DATABASE_URL;
  afterEach(() => {
    process.env.INTEGRACION_DATABASE_URL = original;
  });

  const con = (url: string | undefined) => {
    // Asignar undefined la dejaría con el texto «undefined»: hay que borrarla.
    if (url === undefined) delete process.env.INTEGRACION_DATABASE_URL;
    else process.env.INTEGRACION_DATABASE_URL = url;
    return () => urlDeIntegracion();
  };

  it('REGRESION: se niega a producción (Supabase), aunque el nombre termine en _integracion', () => {
    expect(
      con('postgresql://u:c@aws-1-us-west-2.pooler.supabase.com:5432/postgres_integracion'),
    ).toThrow(/no es local/);
  });

  it('REGRESION: se niega a la copia local de producción', () => {
    expect(con('postgresql://u:c@localhost:5432/mantenimiento')).toThrow(/_integracion/);
  });

  it('sin la variable no corre, y explica cómo', () => {
    expect(con(undefined)).toThrow(/INTEGRACION_DATABASE_URL/);
  });

  it('acepta la base de integración local y la del CI', () => {
    expect(con('postgresql://u:c@localhost:5432/mantenimiento_integracion')).not.toThrow();
    expect(con('postgresql://u:c@postgres:5432/mantenimiento_integracion')).not.toThrow();
  });
});
