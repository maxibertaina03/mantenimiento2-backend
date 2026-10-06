/**
 * Los límites entre contextos (src/contextos/*), controlados solos.
 *
 * Un contexto usa a otro solo por su puerta pública, el `index.ts` de la
 * carpeta del contexto: `import { PanolModule } from '../../panol'`. Entrar a
 * sus carpetas internas —dominio, aplicacion, puertos, infraestructura— es un
 * error de lint, y el CI no deja pasarlo. Sin esto, la frontera dependía de que
 * nadie se olvidara: compras llegó a usar los servicios internos del pañol.
 *
 * Si otro contexto necesita algo más, se agrega a la puerta pública del que lo
 * ofrece, a la vista, en vez de ir a buscarlo adentro.
 */
const CONTEXTOS = ['compras', 'equipos', 'informatica', 'panol', 'trabajos'];
const CAPAS = ['dominio', 'aplicacion', 'puertos', 'infraestructura'];

const limitesEntreContextos = CONTEXTOS.map((contexto) => ({
  files: [`src/contextos/${contexto}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: CONTEXTOS.filter((otro) => otro !== contexto).map((otro) => ({
          group: CAPAS.map((capa) => `**/${otro}/${capa}/**`),
          message: `Desde ${contexto}, ${otro} se usa solo por su puerta pública: '../../${otro}' (src/contextos/${otro}/index.ts).`,
        })),
      },
    ],
  },
}));

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  root: true,
  env: {
    node: true,
  },
  ignorePatterns: ['.eslintrc.cjs', 'dist', 'node_modules'],
  overrides: limitesEntreContextos,
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
