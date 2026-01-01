module.exports = {
  // Legacy config kept for editors and tools that prefer .eslintrc
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  settings: { react: { version: 'detect' } },
  env: { browser: true, node: true, es2021: true },
  rules: { 'react/react-in-jsx-scope': 'off' }
};
