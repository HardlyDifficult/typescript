# @hardlydifficult/ts-config

Opinionated ESLint, Prettier, and TypeScript configuration package with Next.js support.

## Installation

```bash
npm install @hardlydifficult/ts-config
```

## Quick Start

```typescript
// .eslintrc.cjs
import createConfig from "@hardlydifficult/ts-config/eslint";
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";

export default [
  ...createConfig(__dirname),
  // For Next.js projects:
  // ...createNextConfig(__dirname, [
  //   ...nextConfig,
  // ]),
];
```

## ESLint Configurations

### Base ESLint Config

Creates a strict ESLint flat config for TypeScript projects with type checking, import ordering, JSDoc, and code style rules.

```typescript
import createConfig from "@hardlydifficult/ts-config/eslint";

const config = createConfig("path/to/project/root");
// Returns ESLint flat config array
```

**Key features:**
- TypeScript strict type-checking via `typescript-eslint`
- Import ordering with `eslint-plugin-import-x`
- JSDoc enforcement on exported symbols
- Unused import removal via `eslint-plugin-unused-imports`
- Auto-fixable style rules: `prefer-const`, `no-var`, `curly: "all"`, etc.

**Ignores:**
- `**/dist/**`, `**/node_modules/**`, `**/*.js`
- `**/tests/**`, `**/vitest.config.ts`
- `**/.next/**`, `**/.turbo/**`, `**/*.config.mjs`

### Next.js ESLint Config

Creates an ESLint config combining the base config with Next.js-specific rules.

```typescript
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";
import type { Linter } from "eslint";
import nextConfig from "./next.config.js";

const config: Linter.Config[] = createNextConfig(__dirname, [
  ...(nextConfig as Linter.Config[]),
]);
```

**Next-specific rules:**
- `react/react-in-jsx-scope: "off"`
- `react/prop-types: "off"`
- `react/self-closing-comp: ["error", { component: true, html: true }]`
- `react/jsx-boolean-value: ["error", "never"`
- `react/no-array-index-key: "warn"`
- `react/jsx-curly-brace-presence: ["error", { props: "never", children: "never" }]`

## Prettier Configuration

Exports a consistent Prettier configuration for TypeScript/JavaScript projects.

```typescript
import prettierConfig from "@hardlydifficult/ts-config/prettier";

export default prettierConfig;
```

| Option                      | Value                    |
|-----------------------------|--------------------------|
| `semi`                      | `true`                   |
| `singleQuote`               | `false`                  |
| `tabWidth`                  | `2`                      |
| `useTabs`                   | `false`                  |
| `trailingComma`             | `"es5"`                  |
| `bracketSpacing`            | `true`                   |
| `bracketSameLine`           | `false`                  |
| `arrowParens`               | `"always"`               |
| `endOfLine`                 | `"lf"`                   |
| `printWidth`                | `80`                     |
| `quoteProps`                | `"as-needed"`            |
| `jsxSingleQuote`            | `false`                  |
| `proseWrap`                 | `"preserve"`             |
| `htmlWhitespaceSensitivity` | `"css"`                  |
| `embeddedLanguageFormatting`| `"auto"`                 |
| `singleAttributePerLine`    | `false`                  |

## TypeScript Configuration

### Base tsconfig

Provides strict settings and modern ES2022 features for consistent builds.

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

### Project tsconfig

Base TypeScript configuration for Node.js projects.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

## API Reference

| Export               | Type     | Description                                     |
|----------------------|----------|-----------------------------------------------|
| `eslint`             | `function` | Creates shared ESLint config for TypeScript   |
| `eslint-next`        | `function` | Creates ESLint config for Next.js projects    |
| `prettier`           | `object`   | Prettier configuration object                 |
| `tsconfig.base.json` | `string`   | Path to base TypeScript config JSON (copied)  |