module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: ['semistandard', 'plugin:import/recommended', 'plugin:sonarjs/recommended', 'plugin:promise/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // turn off some stricter rules for flexibility
    'global-require': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/prefer-default-export': 'off',
    'no-template-curly-in-string': 'off',
    'no-console': 'off',
    'func-names': 'off',
    'no-useless-escape': 'off',
    'sonarjs/cognitive-complexity': 'off',
    'sonarjs/no-nested-template-literals': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // allow _ as ignored params
    'sort-imports': 'off', // turned off in favour of import/order rule
    'import/order': [
      'error',
      {
        'newlines-between': 'ignore',
        // enforce import ordering
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      },
    ],
  },
  // 'only-warn' plugin turns all errors and warnings reported by eslint into warnings so that its easier to check in CI env
  plugins: ['only-warn', 'import', 'sonarjs', 'promise'],
};
