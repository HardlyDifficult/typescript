# @hardlydifficult/ts-config

A TypeScript configuration package that provides ESLint, Prettier, and TypeScript compiler settings for consistent tooling across projects.

## Installation

```bash
npm install @hardlydifficult/ts-config
```

## Quick Start

Create an ESLint config file that uses this package's shared configuration:

```typescript
import createConfig from "@hardlydifficult/ts-config/eslint.js";

export default createConfig(import.meta.url);
```

For Next.js projects:

```typescript
import createNextConfig from "@hardlydifficult/ts-config/eslint-next.js";

export default createNextConfig(import.meta.url, [
  // Next.js config entries (e.g., from `@next/eslint-plugin-next`)
]);
```

## ESLint Configurations

This package exports two ESLint configuration factories:

### `createConfig(projectRoot: string)`

Creates a shared ESLint flat config for TypeScript projects with strict type checking and import/JSDoc rules.

- Applies recommended TypeScript ESLint strict and stylistic configs
- Includes ESLint and Prettier compatibility
- Enforces import ordering, JSDoc documentation, and unused import removal
- Skips common build and config directories (e.g., `dist`, `node_modules`, `.next`, `.turbo`)

```typescript
import createConfig from "@hardlydifficult/ts-config/eslint.js";

export default [
  createConfig(import.meta.url),
];
```

### `createNextConfig(projectRoot: string, nextConfig: Linter.Config[]): Linter.Config[]`

Creates an ESLint flat config for Next.js projects by combining the base config with React-specific rules.

- Merges provided Next.js config with the shared TypeScript config
- Adds React-specific rules (e.g., disables `react/react-in-jsx-scope`, enforces JSX formatting)

```typescript
import createNextConfig from "@hardlydifficult/ts-config/eslint-next.js";

export default createNextConfig(import.meta.url, [
  // Next.js config entries (e.g., from `@next/eslint-plugin-next`)
]);
```

## Prettier Configuration

### Default Config

Exports a standard Prettier configuration object with strict formatting rules.

| Option                      | Value           |
|-----------------------------|-----------------|
| `semi`                      | `true`          |
| `singleQuote`               | `false`         |
| `tabWidth`                  | `2`             |
| `useTabs`                   | `false`         |
| `trailingComma`             | `"es5"`         |
| `bracketSpacing`            | `true`          |
| `bracketSameLine`           | `false`         |
| `arrowParens`               | `"always"`      |
| `endOfLine`                 | `"lf"`          |
| `printWidth`                | `80`            |
| `quoteProps`                | `"as-needed"`   |
| `jsxSingleQuote`            | `false`         |
| `proseWrap`                 | `"preserve"`    |
| `htmlWhitespaceSensitivity` | `"css"`         |
| `embeddedLanguageFormatting`| `"auto"`        |
| `singleAttributePerLine`    | `false`         |

```typescript
import prettierConfig from "@hardlydifficult/ts-config/prettier.js";

// Use with Prettier API
import { format } from "prettier";
const formatted = await format("console.log('Hello');", {
  ...prettierConfig,
  parser: "typescript",
});
```

## TypeScript Configurations

### Base Config (`tsconfig.base.json`)

Common compiler options for all packages:

- ES2022 target with CommonJS modules
- Strict mode enabled
- Source maps and declaration maps included
- Supports `resolveJsonModule` and `isolatedModules`

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

### Ignored Patterns

By default, ESLint ignores:

```
**/dist/**, **/node_modules/**, **/*.js,
**/tests/**, **/vitest.config.ts,
**/.next/**, **/.turbo/**, **/*.config.mjs
```

### JSDoc Requirements

JSDoc is required for:

- `FunctionDeclaration`
- `ClassDeclaration`
- Public methods are excluded
- Constructors are not checked