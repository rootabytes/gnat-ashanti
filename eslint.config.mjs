// One lint setup for the whole repo: `npm run lint` from the root.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'e2e/screenshots/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // API rows and error objects are typed loosely on purpose; zod guards the inputs.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['backend/**/*.ts', 'e2e/**/*.mjs', 'frontend/scripts/**/*.mjs', '*.mjs', 'frontend/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  // Browser tests also run code inside the page (page.evaluate).
  { files: ['e2e/**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
);
