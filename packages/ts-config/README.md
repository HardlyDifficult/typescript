# @hardlydifficult/ts-config

A centralized package providing strict TypeScript, ESLint, and Prettier configurations for modern JavaScript and Next.js projects.

## Installation

```bash
npm install @hardlydifficult/ts-config
```

## Quick Start

Apply the shared ESLint and Prettier configurations to your project:

```typescript
// eslint.config.js
import createEslintConfig from "@hardlydifficult/ts-config/eslint";
import prettierConfig from "@hardlydifficult/ts-config/prettier";

export default [
  ...createEslintConfig(import.meta.dirname),
  {
    rules: {
      // your overrides
    },
  },
];

// .prettierrc.js
import prettierConfig from "@hardlydifficult/ts-config/prettier";

export default prettierConfig;
```

### TypeScript Configuration

Extend the base configuration in your `tsconfig.json`:

```jsonc
{
  "extends": "@hardlydifficult/ts-config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

## ESLint Configuration

Exports a factory function that returns a flat ESLint configuration with strict TypeScript rules, import ordering, JSDoc requirements, and auto-fixable stylistic rules.

### `createEslintConfig(projectRoot)`

Creates a fully-featured ESLint config for TypeScript projects.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectRoot` | `string` | Path to the project root directory; used by TypeScript ESLint for project service lookups |

```typescript
import createEslintConfig from "@hardlydifficult/ts-config/eslint";

export default [
  ...createEslintConfig("path/to/project"),
];
```

#### Ignored Patterns

By default, ESLint ignores:

```
**/dist/**, **/node_modules/**, **/*.js,
**/tests/**, **/vitest.config.ts,
**/.next/**, **/.turbo/**, **/*.config.mjs
```

### `createNextEslintConfig(projectRoot, nextConfig)`

Combines the base ESLint config with Next.js-specific rules.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectRoot` | `string` | Project root directory |
| `nextConfig` | `Linter.Config[]` | Next.js ESLint config array (e.g., from `@next/eslint-plugin-next`) |

```typescript
import createNextEslintConfig from "@hardlydifficult/ts-config/eslint-next";
import nextConfig from "@next/eslint-plugin-next/config";

export default [
  ...createNextEslintConfig(import.meta.dirname, nextConfig),
];
```

#### React Rules

| Rule | Level | Options |
|------|-------|---------|
| `react/react-in-jsx-scope` | off | — |
| `react/prop-types` | off | — |
| `react/self-closing-comp` | error | `{ component: true, html: true }` |
| `react/jsx-boolean-value` | error | `"never"` |
| `react/no-array-index-key` | warn | — |
| `react/jsx-curly-brace-presence` | error | `{ props: "never", children: "never" }` |

## Prettier Configuration

Exports a preconfigured Prettier settings object optimized for consistency across TypeScript/JavaScript projects.

### `prettierConfig`

```typescript
import prettierConfig from "@hardlydifficult/ts-config/prettier";

export default prettierConfig;
// {
//   semi: true,
//   singleQuote: false,
//   tabWidth: 2,
//   useTabs: false,
//   trailingComma: "es5",
//   bracketSpacing: true,
//   bracketSameLine: false,
//   arrowParens: "always",
//   endOfLine: "lf",
//   printWidth: 80,
//   quoteProps: "as-needed",
//   jsxSingleQuote: false,
//   proseWrap: "preserve",
//   htmlWhitespaceSensitivity: "css",
//   embeddedLanguageFormatting: "auto",
//   singleAttributePerLine: false,
// }
```

#### Usage with Prettier API

```typescript
import prettierConfig from "@hardlydifficult/ts-config/prettier.js";
import { format } from "prettier";

const formatted = await format("console.log('Hello');", {
  ...prettierConfig,
  parser: "typescript",
});
```

## TypeScript Configuration

Base compiler options for consistent builds across projects.

### `tsconfig.base.json`

The base configuration includes strict type checking, ES2022 targeting, and modern module resolution:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

### Node Config (`tsconfig.json`)

Node-specific configuration extending the base config with:

- `module: "Node16"` and `moduleResolution: "node16"`
- `outDir: "./dist"` and `rootDir: "./src"`

## Appendix

### Rule Categories

The ESLint config enforces auto-fixable and non-auto-fixable rules:

| Auto-fixable | Non-auto-fixable |
|--------------|------------------|
| `curly`, `no-useless-computed-key`, `prefer-const`, `quote-props` | `no-console` (limited), `no-restricted-globals`, `no-loop-func` |

### JSDoc Requirements

JSDoc is required for:

- `FunctionDeclaration`
- `ClassDeclaration`
- Public methods are excluded
- Constructors are not checked

**Supported Node.js version:** >=20.19.0  
**Peer dependencies required:** `eslint`, `typescript-eslint`, `eslint-plugin-import-x`, `eslint-plugin-jsdoc`, `eslint-plugin-unused-imports`, `eslint-config-prettier`, `@eslint/compat`, `@eslint/js`