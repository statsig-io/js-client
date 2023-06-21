module.exports = {
  roots: ['./'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.(j|t)s', '**/?(*.)+test.(j|t)s'],
  testPathIgnorePatterns: ['<rootDir>/custom_eslint/', '<rootDir>/node_modules/', '<rootDir>/dist/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
