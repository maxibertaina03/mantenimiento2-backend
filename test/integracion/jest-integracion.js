/**
 * Config de Jest para los tests de integración: la aplicación real contra un
 * Postgres real y vacío. Ver docs/tests-de-integracion.md.
 *
 * De a un archivo por vez (maxWorkers 1): todos usan la misma base y cada test
 * la vacía.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../..',
  testEnvironment: 'node',
  testRegex: '\.int-spec\.ts$',
  globalSetup: '<rootDir>/test/integracion/preparar-base.ts',
  setupFiles: ['<rootDir>/test/integracion/entorno.ts'],
  maxWorkers: 1,
  testTimeout: 30000,
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
};
