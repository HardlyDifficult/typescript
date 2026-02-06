import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.js', '**/tests/**', '**/vitest.config.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,
  {
    plugins: {
      import: importPlugin,
    },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname + '/..',
      },
    },
  },
  {
    rules: {
      // File size limit
      'max-lines': [
        'error',
        {
          max: 400,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      // Auto-fixable rules
      curly: ['error', 'all'],
      'dot-notation': 'error',
      eqeqeq: ['error', 'always'],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-extra-boolean-cast': 'error',
      'no-lonely-if': 'error',
      'no-object-constructor': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'prefer-destructuring': [
        'error',
        {
          array: false,
          object: true,
        },
      ],
      'prefer-numeric-literals': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
      'quote-props': ['error', 'as-needed'],
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
        },
      ],
      yoda: 'error',

      // Non-auto-fixable rules
      'array-callback-return': ['error', { allowImplicit: true }],
      'default-case': 'error',
      'default-case-last': 'error',
      'default-param-last': 'error',
      'no-duplicate-imports': 'error',
      'no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      'no-nested-ternary': 'error',
      'no-invalid-this': 'error',
      'no-loop-func': 'error',
      'no-restricted-globals': [
        'error',
        {
          name: 'event',
          message: 'Use local event parameter instead.',
        },
      ],
      'no-promise-executor-return': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unneeded-ternary': ['error', { defaultAssignment: false }],
      'no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
        },
      ],
      'no-useless-concat': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true }],
      'require-atomic-updates': 'error',
      'no-console': ['error', { allow: ['error', 'warn'] }],

      // Import rules
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/export': 'error',
      'import/no-absolute-path': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': ['error', { maxDepth: 10 }],
      'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
    },
  },
);
