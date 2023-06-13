module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'statsig-linter'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  overrides: [
    // Tests
    {
      files: ['**/*.test.ts'],
      rules: {
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },

    // Main
    {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      files: ['**/*.ts'],
      rules: {
        "statsig-linter/public-methods-error-boundary":"error",
        '@typescript-eslint/no-floating-promises': [
          'error',
          { ignoreVoid: false },
        ],
      },
    },
  ],
};
