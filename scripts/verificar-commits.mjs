// Revisa que los commits nuevos tengan el formato acordado (CONTRIBUTING.md):
//
//   tipo(ámbito): qué cambia          ← el título, hasta 72 caracteres
//
//   Por qué, en el cuerpo (opcional).
//
// Lo corre el CI sobre los commits de cada push o pull request; no mira el
// historial viejo, que no se reescribe. Los merges no se revisan: los arma
// GitHub. También se puede correr a mano antes de subir:
//
//   node scripts/verificar-commits.mjs origin/develop..HEAD
import { execFileSync } from 'node:child_process';

const TIPOS = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];
const LARGO_MAXIMO = 72;
const FORMATO = new RegExp(`^(${TIPOS.join('|')})(\\([a-z0-9áéíóúñ/-]+\\))?!?: \\S`);

const rango = process.argv[2];
if (!rango) {
  console.error('Uso: node scripts/verificar-commits.mjs <desde>..<hasta>');
  process.exit(2);
}

const salida = execFileSync('git', ['log', '--no-merges', '--format=%h%x09%s', rango], {
  encoding: 'utf8',
}).trim();
const commits = salida ? salida.split('\n').map((l) => l.split('\t')) : [];

const problemas = [];
for (const [hash, titulo] of commits) {
  // `git revert` arma su propio título: se acepta tal cual.
  if (titulo.startsWith('Revert "')) continue;
  if (!FORMATO.test(titulo)) {
    problemas.push(
      `${hash}  «${titulo}»\n         debe empezar con tipo(ámbito): …  (tipos: ${TIPOS.join(', ')})`,
    );
  } else if (titulo.length > LARGO_MAXIMO) {
    problemas.push(
      `${hash}  «${titulo}»\n         el título tiene ${titulo.length} caracteres; el máximo es ${LARGO_MAXIMO}`,
    );
  }
}

if (problemas.length > 0) {
  console.error(`❌ ${problemas.length} de ${commits.length} commits no siguen el formato:\n`);
  for (const p of problemas) console.error(`  ${p}\n`);
  console.error(
    'Se corrige con `git commit --amend` (el último) o `git rebase -i` antes de subir.',
  );
  process.exit(1);
}
console.log(`✅ ${commits.length} commits con el formato acordado.`);
