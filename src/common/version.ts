import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * La versión del servidor, la de `package.json`.
 *
 * Se lee del archivo y no con un `import` del JSON: importarlo haría que el
 * compilador saque `package.json` de `src/` y cambie la carpeta de salida
 * (`dist/src/main.js` en vez de `dist/main.js`), que es justo lo que rompe el
 * arranque en Render. Desde `src/common/` y desde `dist/common/`, el archivo
 * está dos carpetas más arriba.
 */
export function versionDelServidor(): string {
  try {
    const ruta = join(__dirname, '..', '..', 'package.json');
    return (JSON.parse(readFileSync(ruta, 'utf8')) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** El commit desplegado, que Render pone en el entorno; en local, «local». */
export function commitDesplegado(): string {
  return process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local';
}
