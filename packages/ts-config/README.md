# @hardlydifficult/ts-config

Opinionated ESLint, Prettier, and TypeScript config package with Next.js support.

## Installation

```bash
npm install @hardlydifficult/ts-config
```

## Quick Start

```typescript
// .eslintrc.cjs
import createConfig from "@hardlydifficult/ts-config/eslint";
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";
import prettierConfig from "@hardlydifficult/ts-config/prettier";

export default [
  ...createConfig(__dirname),
  // For Next.js projects:
  // ...createNextConfig(__dirname, [
  //   ...nextConfig,
  // ]),
];
```

```json
// .prettierrc.json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "printWidth": 80,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "proseWrap": "preserve",
  "htmlWhitespaceSensitivity": "css",
  "embeddedLanguageFormatting": "auto",
  "singleAttributePerLine": false
}
```

## ESLint Configurations

### Base ESLint Config

The shared ESLint flat config provides strict type-checking, import ordering, JSDoc, and code style rules for TypeScript projects.

```typescript
import createConfig from "@hardlydifficult/ts-config/eslint";
import type { Linter } from "eslint";

const config: Linter.Config[] = createConfig("path/to/project/root");
```

**Key Features:**
- TypeScript strict type-checking via `typescript-eslint`
- Import ordering with `eslint-plugin-import-x`
- JSDoc enforcement on exported symbols via `eslint-plugin-jsdoc`
- Unused import removal via `eslint-plugin-unused-imports`
- Code style enforcement (e.g., `prefer-const`, `no-var`, `curly: "all"`)

**Ignores:**
- `**/dist/**`
- `**/node_modules/**`
- `**/*.js`
- `**/tests/**`
- `**/vitest.config.ts`
- `**/.next/**`
- `**/.turbo/**`
- `**/*.config.mjs`

### Next.js ESLint Config

For Next.js projects, combine the base config with Next-specific rules.

```typescript
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";
import type { Linter } from "eslint";
import nextConfig from "./next.config.js";

const config: Linter.Config[] = createNextConfig(__dirname, [
  ...(nextConfig as Linter.Config[]),
]);
```

**Next-specific rules:**
- Disables React scope rule (`react/react-in-jsx-scope: "off"`)
- Disables prop-types (`react/prop-types: "off"`)
- Enforces self-closing components for components and HTML
- Enforces consistent JSX boolean value style (`never`)
- Warns on array index keys
- Enforces JSX curly brace presence (`props: "never", children: "never"`)

## Prettier Configuration

Prettier code formatting configuration for TypeScript/JavaScript projects.

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

Provides strict settings and modern ES2022 features for consistent builds across the project.

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

| Export                 | Type              | Description                                           |
|------------------------|-------------------|-------------------------------------------------------|
| `eslint`               | `function`        | Creates the shared ESLint config for TypeScript       |
| `eslint-next`          | `function`        | Creates ESLint config for Next.js projects            |
| `prettier`             | `object`          | Prettier configuration object                         |
| `tsconfig.base.json`   | `string` (path)   | Base TypeScript configuration (copied to output dir) |