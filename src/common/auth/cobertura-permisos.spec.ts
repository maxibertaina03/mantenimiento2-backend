import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Que ningún endpoint quede sin declarar qué permiso pide.
 *
 * El guard falla cerrado: lo que no declara nada, no pasa. Eso convierte el
 * olvido en "nadie puede usar esto" en vez de "cualquiera puede escribir", que
 * es el error que se prefiere. Pero un endpoint inutilizable tampoco sirve, y
 * sin este test se descubriría recién cuando alguien lo toque.
 *
 * Lee los archivos en vez de levantar la aplicación a propósito: así falla al
 * correr los tests, antes de subir nada, y señala el archivo y la línea.
 */
const VERBO = /^@(Get|Post|Patch|Put|Delete)\(/;
const DECLARA = /@(Permisos|SoloAutenticado|Public)\(/;

function controladores(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...controladores(ruta));
    else if (nombre.endsWith('.controller.ts')) salida.push(ruta);
  }
  return salida;
}

interface Endpoint {
  archivo: string;
  linea: number;
  metodo: string;
  declarado: boolean;
}

/**
 * Un endpoint está cubierto si en su bloque de decoradores, o en el de su
 * controller, aparece `@Permisos`, `@SoloAutenticado` o `@Public`.
 *
 * El bloque se junta a los dos lados de la línea del verbo. Mirar solo hacia
 * abajo perdía la mitad de los endpoints, porque el orden en que están
 * escritos los decoradores no es siempre el mismo.
 */
function endpointsDe(archivo: string): Endpoint[] {
  const lineas = readFileSync(archivo, 'utf8').split(/\r?\n/);

  const claseCubierta = lineas.some(
    (l, i) =>
      /^(export )?(abstract )?class \w+/.test(l) &&
      lineas.slice(Math.max(0, i - 14), i).some((p) => DECLARA.test(p)),
  );

  /** Si la línea puede formar parte del bloque de decoradores de un método. */
  const esDelBloque = (l: string) =>
    /^\s*@/.test(l) || /^\s*(\/\*|\*|\/\/)/.test(l) || /^\s{4,}\S/.test(l);

  const salida: Endpoint[] = [];
  for (const [i, linea] of lineas.entries()) {
    const verbo = linea.trim().match(VERBO);
    if (!verbo) continue;

    const bloque: string[] = [linea];
    for (let j = i - 1; j >= 0 && esDelBloque(lineas[j]); j--) bloque.push(lineas[j]);
    for (let j = i + 1; j < lineas.length && esDelBloque(lineas[j]); j++) bloque.push(lineas[j]);

    salida.push({
      archivo: archivo.replace(/\\/g, '/').replace(/^.*?src\//, 'src/'),
      linea: i + 1,
      metodo: verbo[1],
      declarado: bloque.some((l) => DECLARA.test(l)) || claseCubierta,
    });
  }
  return salida;
}

const TODOS = controladores(join(__dirname, '..', '..')).flatMap(endpointsDe);

describe('cobertura de permisos', () => {
  it('encuentra todos los endpoints del sistema', () => {
    // Si el buscador dejara de encontrarlos, el test pasaría sin mirar nada y
    // no protegería nada. Son 121 contando a mano; el piso va con holgura para
    // que agregar uno no lo rompa, pero no tanta como para que perder veinte
    // pase inadvertido.
    expect(TODOS.length).toBeGreaterThan(115);
  });

  it('REGRESION: todos los endpoints declaran qué permiso piden', () => {
    // `@Public()` también cuenta: es el disparador de avisos, al que llama una
    // máquina con su propio token y no un usuario con un rol.
    const sinDeclarar = TODOS.filter((e) => !e.declarado);
    const detalle = sinDeclarar.map((e) => `  ${e.archivo}:${e.linea}  ${e.metodo}`).join('\n');

    expect(
      sinDeclarar.length === 0
        ? ''
        : `${sinDeclarar.length} endpoint(s) sin declarar permiso:\n${detalle}`,
    ).toBe('');
  });
});
