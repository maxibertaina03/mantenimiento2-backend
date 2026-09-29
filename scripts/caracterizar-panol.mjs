/**
 * Graba lo que responde el pañol a una secuencia fija de pedidos.
 *
 * Es la segunda red del refactor del pañol, además de los e2e. Los e2e corren
 * contra un Prisma en memoria, que ya escondió diferencias con Postgres más de
 * una vez. Esto corre contra la base local de verdad —una copia de producción—
 * con la API levantada:
 *
 *   1. se saca una foto de la base local          (foto-local --guardar)
 *   2. con el código VIEJO, se corre esto          -> antes.json
 *   3. se repone la foto                           (foto-local --reponer)
 *   4. con el código NUEVO, se corre esto          -> despues.json
 *   5. se comparan los dos archivos: tienen que ser idénticos.
 *
 * Mira las dos cosas que no se pueden torcer: el stock de cada material y el
 * historial de movimientos. Incluye la suma del stock de TODOS los materiales
 * reales, así una diferencia en cualquiera se ve aunque no esté en la muestra.
 *
 * Lo que cambia entre corridas sin que cambie el comportamiento —ids nuevos,
 * la hora de ahora— se normaliza antes de guardar.
 *
 *   node scripts/caracterizar-panol.mjs salida.json
 */
import { writeFileSync } from 'node:fs';

const salida = process.argv[2] ?? 'caracterizacion.json';
const API = process.env.URL_API ?? 'http://localhost:3000/api';

if (!/localhost|127\.0\.0\.1/.test(API)) {
  console.error(`\n⛔ ${API} no es local. Esto escribe datos: solo contra la API local.\n`);
  process.exit(1);
}

const resultado = [];

/** Un pedido a la API, guardado con su código y su cuerpo. */
async function pedir(nombre, metodo, ruta, cuerpo) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  resultado.push({ nombre, estado: r.status, datos });
  return { estado: r.status, datos };
}

/**
 * Deja estable lo que cambia entre corridas sin que cambie el comportamiento.
 *
 * - Los uuid pasan a "id#1", "id#2"... en orden de aparición: los reales
 *   aparecen igual en las dos corridas, y los recién creados también.
 * - Las fechas de hoy pasan a "<hoy>": son la hora de la corrida.
 * - `timestamp` y `path` de los errores también varían.
 */
function normalizar(valor, ids = new Map(), hoy = new Date().toISOString().slice(0, 10)) {
  if (Array.isArray(valor)) return valor.map((v) => normalizar(v, ids, hoy));
  if (valor && typeof valor === 'object') {
    const salidaObj = {};
    for (const [clave, v] of Object.entries(valor)) {
      if (clave === 'timestamp') continue;
      salidaObj[clave] = normalizar(v, ids, hoy);
    }
    return salidaObj;
  }
  if (typeof valor === 'string') {
    let texto = valor.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      (uuid) => {
        if (!ids.has(uuid)) ids.set(uuid, `id#${ids.size + 1}`);
        return ids.get(uuid);
      },
    );
    if (/^\d{4}-\d{2}-\d{2}T/.test(texto) && texto.slice(0, 10) >= hoy) texto = '<hoy>';
    return texto;
  }
  return valor;
}

// ── 1. Lectura sobre los datos reales ─────────────────────────────────────
const p1 = await pedir('materiales pag 1', 'GET', '/materiales?limite=100&pagina=1');
await pedir('materiales pag 2', 'GET', '/materiales?limite=100&pagina=2');
await pedir('buscar cable', 'GET', '/materiales?buscar=cable&limite=50');
await pedir('bajo stock (lista)', 'GET', '/materiales?bajoStock=true&limite=100');
await pedir('bajo stock (endpoint)', 'GET', '/materiales/bajo-stock');
await pedir('sin unidad', 'GET', '/materiales/sin-unidad');
await pedir('cobertura de alertas', 'GET', '/materiales/cobertura-alertas');
await pedir('orden por stock desc', 'GET', '/materiales?limite=30&ordenarPor=stock&direccion=desc');
await pedir('movimientos pag 1', 'GET', '/movimientos?limite=100&pagina=1');
await pedir('movimientos salidas', 'GET', '/movimientos?tipo=SALIDA&limite=50');
await pedir('movimientos ajustes', 'GET', '/movimientos?tipo=AJUSTE&limite=50');
await pedir('movimientos por fecha', 'GET', '/movimientos?fechaDesde=2026-09-01&fechaHasta=2026-09-15&limite=100');

const reales = p1.datos?.datos ?? [];
for (const m of reales.slice(0, 5)) {
  await pedir(`ficha ${m.nombre}`, 'GET', `/materiales/${m.id}`);
  await pedir(`historial ${m.nombre}`, 'GET', `/materiales/${m.id}/historial`);
}

// La suma de TODO el stock: una diferencia en cualquier material se ve acá.
let pagina = 1;
let suma = 0;
let cantidad = 0;
for (;;) {
  const r = await fetch(`${API}/materiales?limite=100&pagina=${pagina}&mostrar=todos`);
  const d = await r.json();
  for (const m of d.datos ?? []) {
    suma += Number(m.stockActual);
    cantidad += 1;
  }
  if (!d.datos || d.datos.length < 100) break;
  pagina += 1;
}
resultado.push({ nombre: 'suma de todo el stock', estado: 200, datos: { cantidad, suma: suma.toFixed(3) } });

// ── 2. Escritura sobre un material de prueba ──────────────────────────────
const base = reales[0];
const creado = await pedir('crear material', 'POST', '/materiales', {
  nombre: 'ZZ Caracterizacion del panol',
  categoriaId: base?.categoriaId,
  unidadId: base?.unidadId ?? undefined,
  stockMinimo: 5,
});
const id = creado.datos?.id;

const mov = (n, d) => pedir(n, 'POST', '/movimientos', { materialId: id, ...d });
const e1 = await mov('entrada 10', { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 10, fecha: '2026-09-10T12:00:00.000Z' });
await mov('salida 3,5', { tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 3.5, fecha: '2026-09-11T12:00:00.000Z' });
await mov('salida de mas (400)', { tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 100, fecha: '2026-09-12T12:00:00.000Z' });
await mov('motivo incoherente (400)', { tipo: 'ENTRADA', motivo: 'TRABAJO', cantidad: 1 });
await mov('ajuste a 20', { tipo: 'AJUSTE', motivo: 'AJUSTE', cantidad: 20, fecha: '2026-09-20T12:00:00.000Z' });
await mov('retrofechado detras del ajuste (400)', { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 5, fecha: '2026-09-15T12:00:00.000Z' });
const e2 = await mov('entrada despues del ajuste', { tipo: 'ENTRADA', motivo: 'COMPRA', cantidad: 0.125, fecha: '2026-09-21T12:00:00.000Z' });
await pedir('ficha tras movimientos', 'GET', `/materiales/${id}`);

// Por detras del ajuste: se rechaza, porque movería el stock sola.
await pedir('editar entrada detras del ajuste (400)', 'PATCH', `/movimientos/${e1.datos?.id}`, {
  cantidad: 12,
  motivoEdicion: 'Caracterizacion',
});
// Despues del ajuste: se acepta y el stock se recalcula del historial.
await pedir('editar entrada despues del ajuste', 'PATCH', `/movimientos/${e2.datos?.id}`, {
  cantidad: 1,
  motivoEdicion: 'Caracterizacion',
});
await pedir('ediciones de la entrada editada', 'GET', `/movimientos/${e2.datos?.id}/ediciones`);
await pedir('ficha tras editar', 'GET', `/materiales/${id}`);
await pedir('historial tras editar', 'GET', `/materiales/${id}/historial`);

await pedir('borrar con movimientos (400)', 'DELETE', `/materiales/${id}`);
await pedir('desactivar', 'PATCH', `/materiales/${id}`, { activo: false });
await mov('movimiento sobre desactivado (400)', { tipo: 'SALIDA', motivo: 'TRABAJO', cantidad: 1 });
await pedir('ficha desactivado', 'GET', `/materiales/${id}`);
await pedir('bajo stock al final', 'GET', '/materiales/bajo-stock');

writeFileSync(salida, JSON.stringify(normalizar(resultado), null, 2));
console.log(`Grabados ${resultado.length} pedidos en ${salida}`);
const errores = resultado.filter((r) => r.estado >= 500);
if (errores.length) console.log(`ATENCION: ${errores.length} respuestas 5xx: ${errores.map((e) => e.nombre).join(', ')}`);
