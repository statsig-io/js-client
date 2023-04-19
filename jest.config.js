module.exports = {
  roots: ['./'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.(j|t)s', '**/?(*.)+test.(j|t)s'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
  ],
};
