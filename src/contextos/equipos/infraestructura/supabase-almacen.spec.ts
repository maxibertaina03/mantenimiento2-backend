import { ConfigService } from '@nestjs/config';
import { SupabaseAlmacenImagenes } from './supabase-almacen-imagenes';

/**
 * El panel de Supabase muestra la URL con `/rest/v1/` al final, que es la de la
 * API REST. Es la que cualquiera copia, y sin limpiarla las rutas de Storage
 * quedan pegadas despues de ese tramo y fallan con un 404 que no explica nada.
 */
function almacen(env: Record<string, string | undefined>) {
  return new SupabaseAlmacenImagenes({ get: (k: string) => env[k] } as unknown as ConfigService);
}

const BASE = 'https://txbyhafznilcbuiplwzw.supabase.co';
const CLAVE = { SUPABASE_SERVICE_KEY: 'service-role-falsa', SUPABASE_BUCKET: 'equipos' };

/** La URL que arma para una imagen, que es donde se ve si la base quedo bien. */
async function urlDeUna(a: SupabaseAlmacenImagenes): Promise<string> {
  const fetchOriginal = global.fetch;
  global.fetch = (async () => ({ ok: true, status: 200, text: async () => '' })) as never;
  try {
    return (await a.subir(Buffer.from('x'), 'foto.jpg', 'eq-1')).url;
  } finally {
    global.fetch = fetchOriginal;
  }
}

describe('SupabaseAlmacenImagenes — la URL del proyecto', () => {
  it('con la URL base, arma bien la ruta de Storage', async () => {
    const url = await urlDeUna(almacen({ SUPABASE_URL: BASE, ...CLAVE }));
    expect(url.startsWith(`${BASE}/storage/v1/object/public/equipos/eq-1/`)).toBe(true);
  });

  it('REGRESION: tolera la URL con /rest/v1/ que muestra el panel', async () => {
    const url = await urlDeUna(almacen({ SUPABASE_URL: `${BASE}/rest/v1/`, ...CLAVE }));
    expect(url).not.toContain('/rest/v1');
    expect(url.startsWith(`${BASE}/storage/v1/object/public/equipos/`)).toBe(true);
  });

  it('tolera la barra final suelta', async () => {
    const url = await urlDeUna(almacen({ SUPABASE_URL: `${BASE}/`, ...CLAVE }));
    expect(url.startsWith(`${BASE}/storage/v1/`)).toBe(true);
  });

  it('tolera espacios al copiar y pegar', async () => {
    const url = await urlDeUna(almacen({ SUPABASE_URL: `  ${BASE}  `, ...CLAVE }));
    expect(url.startsWith(`${BASE}/storage/v1/`)).toBe(true);
  });

  it('sin URL queda apagado, aunque haya clave', async () => {
    expect(almacen(CLAVE).estaConfigurado()).toBe(false);
  });

  it('sin clave queda apagado, aunque haya URL', async () => {
    expect(almacen({ SUPABASE_URL: BASE }).estaConfigurado()).toBe(false);
  });

  it('el bucket por defecto es "equipos"', async () => {
    const url = await urlDeUna(almacen({ SUPABASE_URL: BASE, SUPABASE_SERVICE_KEY: 'x' }));
    expect(url).toContain('/public/equipos/');
  });

  it('REGRESION: limpia tildes y comillas del nombre del archivo', async () => {
    // Los nombres reales de la planta traen cosas como
    // 'Esferica 1/4" Bronce.jpg', que darian una URL rota.
    const url = await urlDeUna(almacen({ SUPABASE_URL: BASE, ...CLAVE }));
    const fetchOriginal = global.fetch;
    global.fetch = (async () => ({ ok: true, status: 200, text: async () => '' })) as never;
    const a = almacen({ SUPABASE_URL: BASE, ...CLAVE });
    const r = await a.subir(Buffer.from('x'), 'Esférica 1/4" Bronce.jpg', 'eq-1');
    global.fetch = fetchOriginal;

    expect(r.url).toMatch(/esferica-1-4-bronce\.jpg$/);
    expect(url).toBeDefined();
  });
});
