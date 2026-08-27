/**
 * Config de Jest para los tests UNITARIOS del backend.
 * Los E2E corren aparte con test/jest-e2e.js (necesitan otro setup).
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  // Solo src/: evita levantar los E2E de test/, que tienen su propia config.
  roots: ['<rootDir>/src'],
  testRegex: '\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};
