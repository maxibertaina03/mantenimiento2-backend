/** Config de Jest para los tests E2E (app real + persistencia en memoria). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: '\.e2e-spec\.ts$',
  setupFiles: ['<rootDir>/test/setup-e2e.ts'],
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
};
