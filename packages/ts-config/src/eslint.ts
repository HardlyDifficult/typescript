import { fixupConfigRules } from "@eslint/compat";
import eslint from "@eslint/js";
import { type ESLint } from "eslint";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import { importX } from "eslint-plugin-import-x";
import jsdoc from "eslint-plugin-jsdoc";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

/** Creates the shared ESLint flat config with TypeScript, import, and JSDoc rules for all packages. */
export default function createConfig(projectRoot: string) {
  return defineConfig(
    {
      ignores: [
        "**/dist/**",
        "**/node_modules/**",
        "**/*.js",
        "**/tests/**",
        "**/vitest.config.ts",
        "**/.next/**",
        "**/.turbo/**",
        "**/*.config.mjs",
      ],
    },
    eslint.configs.recommended,
    ...fixupConfigRules(tseslint.configs.strictTypeChecked),
    ...fixupConfigRules(tseslint.configs.stylisticTypeChecked),
    eslintConfigPrettier,
    {
      plugins: {
        "import-x": importX as unknown as ESLint.Plugin,
        jsdoc: jsdoc as unknown as ESLint.Plugin,
        "unused-imports": unusedImports as unknown as ESLint.Plugin,
      },
    },
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: projectRoot,
        },
      },
    },
    {
      rules: {
        // File size limit
        "max-lines": [
          "error",
          {
            max: 400,
            skipBlankLines: true,
            skipComments: true,
          },
        ],

        // Auto-fixable rules
        curly: ["error", "all"],
        "dot-notation": "error",
        eqeqeq: ["error", "always"],
        "no-else-return": ["error", { allowElseIf: false }],
        "no-extra-boolean-cast": "error",
        "no-lonely-if": "error",
        "no-object-constructor": "error",
        "no-useless-computed-key": "error",
        "no-useless-rename": "error",
        "no-useless-return": "error",
        "no-var": "error",
        "object-shorthand": ["error", "always"],
        "prefer-arrow-callback": "error",
        "prefer-const": "error",
        "prefer-destructuring": [
          "error",
          {
            array: false,
            object: true,
          },
        ],
        "prefer-numeric-literals": "error",
        "prefer-rest-params": "error",
        "prefer-spread": "error",
        "prefer-template": "error",
        "quote-props": ["error", "as-needed"],
        "sort-imports": [
          "error",
          {
            ignoreCase: true,
            ignoreDeclarationSort: true,
            ignoreMemberSort: false,
          },
        ],
        yoda: "error",

        // Non-auto-fixable rules
        "array-callback-return": ["error", { allowImplicit: true }],
        "default-case": "error",
        "default-case-last": "error",
        "default-param-last": "error",
        "no-duplicate-imports": "error",
        "no-empty-function": ["error", { allow: ["arrowFunctions"] }],
        "no-nested-ternary": "error",
        "no-invalid-this": "error",
        "no-loop-func": "error",
        "no-restricted-globals": [
          "error",
          {
            name: "event",
            message: "Use local event parameter instead.",
          },
        ],
        "no-promise-executor-return": "error",
        "no-self-compare": "error",
        "no-template-curly-in-string": "error",
        "no-unneeded-ternary": ["error", { defaultAssignment: false }],
        "no-unused-expressions": [
          "error",
          {
            allowShortCircuit: true,
            allowTernary: true,
          },
        ],
        "no-useless-concat": "error",
        "no-use-before-define": ["error", { functions: false, classes: false }],
        "require-atomic-updates": "error",
        "no-console": ["error", { allow: ["error", "warn"] }],

        // Import rules
        "import-x/extensions": "off",
        "import-x/no-unresolved": "off",
        "import-x/export": "error",
        "import-x/no-absolute-path": "error",
        "import-x/no-self-import": "error",
        "import-x/no-cycle": ["error", { maxDepth: 10 }],
        "import-x/no-useless-path-segments": [
          "error",
          { noUselessIndex: true },
        ],
        "import-x/order": [
          "error",
          {
            groups: [
              "builtin",
              "external",
              "internal",
              "parent",
              "sibling",
              "index",
            ],
            "newlines-between": "always",
            alphabetize: {
              order: "asc",
              caseInsensitive: true,
            },
          },
        ],

        // TypeScript rules
        // Auto-remove unused imports
        "unused-imports/no-unused-imports": "error",

        // Detect unused variables (preserves _ prefix pattern)
        "unused-imports/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
          },
        ],

        // Disable the original TypeScript rule (replaced by unused-imports)
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/consistent-type-imports": [
          "error",
          { prefer: "type-imports", fixStyle: "inline-type-imports" },
        ],
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-non-null-assertion": "warn",
        "@typescript-eslint/strict-boolean-expressions": "error",
        "@typescript-eslint/no-floating-promises": "error",
        "@typescript-eslint/await-thenable": "error",
        "@typescript-eslint/no-misused-promises": "error",
        "@typescript-eslint/prefer-nullish-coalescing": "error",
        "@typescript-eslint/prefer-optional-chain": "error",

        // JSDoc — require on all exported symbols
        "jsdoc/require-jsdoc": [
          "error",
          {
            publicOnly: true,
            require: {
              FunctionDeclaration: true,
              MethodDefinition: false,
              ClassDeclaration: true,
              ArrowFunctionExpression: false,
              FunctionExpression: false,
            },
            checkConstructors: false,
          },
        ],
        "jsdoc/require-description": [
          "error",
          {
            checkConstructors: false,
          },
        ],
      },
    }
  );
}
