/**
 * Graba lo que responden las órdenes de compra a una secuencia fija de pedidos.
 *
 * Es la segunda red del refactor de compras, además de los e2e, y funciona
 * igual que `caracterizar-panol.mjs`: corre contra la base local de verdad
 * —una copia de producción— con la API levantada.
 *
 *   1. se repone la foto de la base local          (foto-local --reponer)
 *   2. con el código VIEJO, se corre esto          -> antes.json
 *   3. se repone la foto otra vez
 *   4. con el código NUEVO, se corre esto          -> despues.json
 *   5. se comparan los dos archivos: tienen que ser idénticos.
 *
 * Mira lo que no se puede torcer: el ciclo de vida de la orden, el stock que
 * suma al recibir, las fichas de equipo que da de alta, y los mensajes de
 * cada rechazo.
 *
 * NO manda correos: el envío por correo no se llama nunca. El WhatsApp solo
 * deja constancia, no manda nada.
 *
 *   node scripts/caracterizar-compras.mjs salida.json
 */
import { writeFileSync } from 'node:fs';

const salida = process.argv[2] ?? 'caracterizacion-compras.json';
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

/** Igual que en caracterizar-panol: ids en orden de aparición, la hora de hoy fuera. */
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

const INEXISTENTE = '00000000-0000-4000-8000-00000000dead';

// ── 1. Lectura sobre los datos reales ─────────────────────────────────────
const lista = await pedir('ordenes pag 1', 'GET', '/ordenes-compra?limite=100&pagina=1');
await pedir('ordenes recibidas', 'GET', '/ordenes-compra?estado=RECIBIDA&limite=100');
await pedir('ordenes anuladas', 'GET', '/ordenes-compra?estado=ANULADA&limite=100');
await pedir(
  'ordenes por fecha',
  'GET',
  '/ordenes-compra?fechaDesde=2026-09-01&fechaHasta=2026-09-30',
);
await pedir('buscar OC-2026', 'GET', '/ordenes-compra?buscar=OC-2026&limite=5');
await pedir('configuracion de envio', 'GET', '/ordenes-compra/configuracion-envio');

for (const o of (lista.datos?.datos ?? []).slice(0, 6)) {
  await pedir(`orden ${o.numero}`, 'GET', `/ordenes-compra/${o.id}`);
  await pedir(`envios ${o.numero}`, 'GET', `/ordenes-compra/${o.id}/envios`);
}

// ── 2. Escritura con un material y un proveedor de la copia ───────────────
const proveedores = await fetch(`${API}/proveedores?limite=1`).then((r) => r.json());
const proveedorId = (proveedores.datos ?? proveedores)[0]?.id;
const materiales = await fetch(`${API}/materiales?limite=1`).then((r) => r.json());
const base = materiales.datos[0];

const creado = await pedir('crear material de prueba', 'POST', '/materiales', {
  nombre: 'ZZ Caracterizacion de compras',
  categoriaId: base.categoriaId,
  unidadId: base.unidadId ?? undefined,
});
const materialId = creado.datos?.id;
const otro = await pedir('crear otro material', 'POST', '/materiales', {
  nombre: 'ZZ Caracterizacion de compras 2',
  categoriaId: base.categoriaId,
  unidadId: base.unidadId ?? undefined,
});
const materialConAjuste = otro.datos?.id;
await pedir('ajuste del segundo', 'POST', '/movimientos', {
  materialId: materialConAjuste,
  tipo: 'AJUSTE',
  motivo: 'AJUSTE',
  cantidad: 8,
  fecha: '2026-09-20T12:00:00.000Z',
});

const oc = (n, renglones, extra = {}) =>
  pedir(n, 'POST', '/ordenes-compra', { proveedorId, renglones, ...extra });

// Rechazos al cargar.
await oc('sin renglones (400)', []);
await oc('material repetido (400)', [
  { materialId, cantidad: 1 },
  { materialId, cantidad: 2 },
]);
await oc('material inexistente (404)', [{ materialId: INEXISTENTE, cantidad: 1 }]);
await pedir('proveedor inexistente (404)', 'POST', '/ordenes-compra', {
  proveedorId: INEXISTENTE,
  renglones: [{ materialId, cantidad: 1 }],
});
await oc('material y equipo a la vez (400)', [
  { materialId, descripcionEquipo: 'Algo', cantidad: 1 },
]);
await oc('media herramienta (400)', [
  { descripcionEquipo: 'ZZ Llave', cantidad: 1.5, clasificacion: 'HERRAMIENTA' },
]);

// La orden principal: material + equipo, editada, emitida por WhatsApp y recibida.
const a = await oc(
  'crear orden A',
  [
    { materialId, cantidad: 12.5, precioUnitario: 100.25 },
    { descripcionEquipo: 'ZZ Hidrolavadora', cantidad: 1, clasificacion: 'EQUIPO' },
  ],
  { observaciones: 'Caracterizacion' },
);
const idA = a.datos?.id;
await pedir('editar A', 'PATCH', `/ordenes-compra/${idA}`, {
  observaciones: 'Caracterizacion editada',
  renglones: [
    { materialId, cantidad: 10, precioUnitario: 99.99 },
    { descripcionEquipo: 'ZZ Hidrolavadora', cantidad: 2, clasificacion: 'HERRAMIENTA' },
  ],
});
await pedir('editar A sin renglones (400)', 'PATCH', `/ordenes-compra/${idA}`, { renglones: [] });
await pedir('recibir A en borrador (400)', 'PATCH', `/ordenes-compra/${idA}/recibir`, {
  remito: 'R-1',
});
await pedir('whatsapp A', 'POST', `/ordenes-compra/${idA}/registrar-whatsapp`, {
  numero: '3510000000',
});
await pedir('envios A', 'GET', `/ordenes-compra/${idA}/envios`);
await pedir('editar A emitida (400)', 'PATCH', `/ordenes-compra/${idA}`, { observaciones: 'x' });
await pedir('borrar A emitida (400)', 'DELETE', `/ordenes-compra/${idA}`);
await pedir('recibir A sin comprobante (400)', 'PATCH', `/ordenes-compra/${idA}/recibir`, {
  remito: '  ',
});
await pedir('recibir A', 'PATCH', `/ordenes-compra/${idA}/recibir`, {
  remito: 'ZZ-0001-00000001',
  factura: 'A-0001-00000002',
  fechaRecepcion: '2026-09-22T12:00:00.000Z',
  notas: 'Llegó completo',
});
await pedir('recibir A otra vez (400)', 'PATCH', `/ordenes-compra/${idA}/recibir`, {
  remito: 'R-2',
});
await pedir('anular A recibida (400)', 'PATCH', `/ordenes-compra/${idA}/anular`);
await pedir('ficha del material tras recibir', 'GET', `/materiales/${materialId}`);
await pedir('historial del material', 'GET', `/materiales/${materialId}/historial`);
await pedir('equipos creados', 'GET', '/equipos?buscar=ZZ Hidrolavadora');
await pedir('buscar A por remito', 'GET', '/ordenes-compra?buscar=ZZ-0001');

// La fecha contra el ajuste: no se recibe, y no queda media orden.
const b = await oc('crear orden B', [
  { materialId, cantidad: 3 },
  { materialId: materialConAjuste, cantidad: 3 },
]);
const idB = b.datos?.id;
await pedir('emitir B', 'PATCH', `/ordenes-compra/${idB}/emitir`);
await pedir('emitir B otra vez (400)', 'PATCH', `/ordenes-compra/${idB}/emitir`);
await pedir('recibir B detras del ajuste (400)', 'PATCH', `/ordenes-compra/${idB}/recibir`, {
  remito: 'R-B',
  fechaRecepcion: '2026-09-15T12:00:00.000Z',
});
await pedir('orden B sigue emitida', 'GET', `/ordenes-compra/${idB}`);
await pedir('material sin tocar', 'GET', `/materiales/${materialId}`);
await pedir('anular B', 'PATCH', `/ordenes-compra/${idB}/anular`);
await pedir('recibir B anulada (400)', 'PATCH', `/ordenes-compra/${idB}/recibir`, { remito: 'R' });

// Un borrador que se borra.
const c = await oc('crear orden C', [{ materialId, cantidad: 1 }]);
await pedir('borrar C', 'DELETE', `/ordenes-compra/${c.datos?.id}`);
await pedir('C ya no existe (404)', 'GET', `/ordenes-compra/${c.datos?.id}`);

// Un material desactivado no se compra.
await pedir('desactivar material', 'PATCH', `/materiales/${materialConAjuste}`, { activo: false });
await oc('comprar desactivado (400)', [{ materialId: materialConAjuste, cantidad: 1 }]);

// Lo que no existe.
for (const [n, m, r] of [
  ['obtener', 'GET', ''],
  ['emitir', 'PATCH', '/emitir'],
  ['anular', 'PATCH', '/anular'],
  ['envios', 'GET', '/envios'],
  ['borrar', 'DELETE', ''],
]) {
  await pedir(`${n} inexistente (404)`, m, `/ordenes-compra/${INEXISTENTE}${r}`);
}
await pedir('recibir inexistente (404)', 'PATCH', `/ordenes-compra/${INEXISTENTE}/recibir`, {
  remito: 'R',
});

await pedir('ordenes al final', 'GET', '/ordenes-compra?limite=100&pagina=1');

writeFileSync(salida, JSON.stringify(normalizar(resultado), null, 2));
console.log(`Grabados ${resultado.length} pedidos en ${salida}`);
const errores = resultado.filter((r) => r.estado >= 500);
if (errores.length)
  console.log(
    `ATENCION: ${errores.length} respuestas 5xx: ${errores.map((e) => e.nombre).join(', ')}`,
  );
