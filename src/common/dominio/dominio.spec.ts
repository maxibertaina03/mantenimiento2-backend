import { aDecimal, aNumero } from './decimal';
import { finDelDia, inicioDelDia } from './fechas';
import { PaginacionDto } from '../dto/paginacion.dto';
import { CacheUsuarios } from '../auth/cache-usuarios';
import { RolUsuario, Usuario } from '@prisma/client';

describe('decimal', () => {
  it('suma sin error de punto flotante', () => {
    expect(aDecimal(0.1).plus(aDecimal(0.2)).toString()).toBe('0.3');
  });

  it('resta sin error de punto flotante', () => {
    expect(aDecimal(1.1).minus(aDecimal(1.0)).toString()).toBe('0.1');
  });

  it('redondea a la escala de la DB (3 decimales)', () => {
    expect(aDecimal(1.23456).toString()).toBe('1.235');
  });

  it('detecta negativos exactos (sin falsos positivos por epsilon)', () => {
    const stock = aDecimal(0.1).plus(aDecimal(0.2));
    expect(stock.minus(aDecimal(0.3)).isNegative()).toBe(false);
    expect(stock.minus(aDecimal(0.3)).isZero()).toBe(true);
  });

  it('acumula 10 sumas de 0.1 exactamente en 1', () => {
    let s = aDecimal(0);
    for (let i = 0; i < 10; i++) s = s.plus(aDecimal(0.1));
    expect(s.toString()).toBe('1');
  });

  it('aNumero serializa para JSON', () => {
    expect(aNumero(aDecimal(12.5))).toBe(12.5);
    expect(typeof aNumero('3.001')).toBe('number');
  });
});

describe('fechas', () => {
  it('inicioDelDia lleva YYYY-MM-DD a las 00:00:00.000', () => {
    expect(inicioDelDia('2026-08-25').toISOString()).toBe('2026-08-25T00:00:00.000Z');
  });

  it('finDelDia lleva YYYY-MM-DD a las 23:59:59.999', () => {
    expect(finDelDia('2026-08-25').toISOString()).toBe('2026-08-25T23:59:59.999Z');
  });

  it('un rango de un solo dia contiene a ese dia entero', () => {
    const desde = inicioDelDia('2026-08-25');
    const hasta = finDelDia('2026-08-25');
    const mediodia = new Date('2026-08-25T12:00:00.000Z');
    expect(mediodia >= desde && mediodia <= hasta).toBe(true);
  });

  it('un ISO con hora se respeta sin expandir', () => {
    const iso = '2026-08-25T10:30:00.000Z';
    expect(finDelDia(iso).toISOString()).toBe(iso);
    expect(inicioDelDia(iso).toISOString()).toBe(iso);
  });
});

describe('PaginacionDto', () => {
  it('la primera pagina no saltea nada', () => {
    const dto = new PaginacionDto();
    expect(dto.skip).toBe(0);
  });

  it('calcula el offset correcto', () => {
    const dto = new PaginacionDto();
    dto.pagina = 3;
    dto.limite = 20;
    expect(dto.skip).toBe(40);
  });

  it('valores por defecto: pagina 1, limite 20', () => {
    const dto = new PaginacionDto();
    expect(dto.pagina).toBe(1);
    expect(dto.limite).toBe(20);
  });
});

describe('CacheUsuarios', () => {
  const usuario = { id: 'u-1', nombre: 'maxi', rol: RolUsuario.OPERARIO } as Usuario;

  it('devuelve undefined si no hay nada cacheado', () => {
    expect(new CacheUsuarios().obtener('clerk_1')).toBeUndefined();
  });

  it('devuelve el usuario guardado', () => {
    const cache = new CacheUsuarios();
    cache.guardar('clerk_1', usuario);
    expect(cache.obtener('clerk_1')).toBe(usuario);
  });

  it('expira despues del TTL', () => {
    jest.useFakeTimers();
    try {
      const cache = new CacheUsuarios();
      cache.guardar('clerk_1', usuario);
      jest.advanceTimersByTime(61_000);
      expect(cache.obtener('clerk_1')).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('invalidar borra la entrada', () => {
    const cache = new CacheUsuarios();
    cache.guardar('clerk_1', usuario);
    cache.invalidar('clerk_1');
    expect(cache.obtener('clerk_1')).toBeUndefined();
  });

  it('no crece sin limite', () => {
    const cache = new CacheUsuarios();
    for (let i = 0; i < 6000; i++) cache.guardar(`clerk_${i}`, usuario);
    // La entrada mas vieja se descarto al llenarse.
    expect(cache.obtener('clerk_0')).toBeUndefined();
    expect(cache.obtener('clerk_5999')).toBe(usuario);
  });
});
