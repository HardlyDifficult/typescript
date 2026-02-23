# @hardlydifficult/ts-config

Centralized TypeScript/ESLint/Prettier configuration package for consistent tooling across projects.

## Installation

```bash
npm install @hardlydifficult/ts-config
```

## Quick Start

Configure your project with shared ESLint, Prettier, and TypeScript settings:

```typescript
// eslint.config.mjs
import createConfig from "@hardlydifficult/ts-config/eslint";
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";
import prettierConfig from "@hardlydifficult/ts-config/prettier";

export default [
  createConfig(process.cwd()),
  // For Next.js projects:
  // createNextConfig(process.cwd(), nextConfig),
];
```

```jsonc
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

```jsonc
// tsconfig.json
{
  "extends": "@hardlydifficult/ts-config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

## ESLint Configuration

Shared ESLint flat config for TypeScript projects with strict type checking, import rules, and JSDoc enforcement.

### `createConfig(projectRoot: string)`

Creates the base ESLint configuration with:

- Strict TypeScript rules (`tseslit`) with type checking
- JSDoc validation requiring docs for exported declarations
- Import ordering and cycle detection
- Unused import removal
- Auto-fixable rules (e.g., `prefer-const`, `prefer-template`)
- Skips common build and config directories (e.g., `dist`, `node_modules`, `.next`, `.turbo`)

```typescript
import createConfig from "@hardlydifficult/ts-config/eslint";

export default createConfig(process.cwd());
```

### Ignored Patterns

By default, ESLint ignores:

```
**/dist/**, **/node_modules/**, **/*.js,
**/tests/**, **/vitest.config.ts,
**/.next/**, **/.turbo/**, **/*.config.mjs
```

## Next.js ESLint Configuration

Extended ESLint setup for Next.js projects with React-specific rules.

### `createNextConfig(projectRoot: string, nextConfig: Linter.Config[])`

Combines the base ESLint config with Next.js and React rules.

```typescript
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";
import nextPlugin from "@next/eslint-plugin-next";

const nextConfig = [
  {
    plugins: {
      next: nextPlugin,
    },
    rules: {
      "next/no-img-element": "warn",
    },
  },
];

export default createNextConfig(process.cwd(), nextConfig);
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

Standardized code formatting for TypeScript/JavaScript projects.

### `prettierConfig: Config`

Exports the predefined Prettier configuration with consistent formatting rules.

```typescript
import config from "@hardlydifficult/ts-config/prettier";

// Use in your .prettierrc.js
export default config;
```

#### Formatting Options

| Option | Value |
|--------|-------|
| `semi` | `true` |
| `singleQuote` | `false` |
| `tabWidth` | `2` |
| `useTabs` | `false` |
| `trailingComma` | `"es5"` |
| `bracketSpacing` | `true` |
| `bracketSameLine` | `false` |
| `arrowParens` | `"always"` |
| `endOfLine` | `"lf"` |
| `printWidth` | `80` |
| `quoteProps` | `"as-needed"` |
| `jsxSingleQuote` | `false` |
| `proseWrap` | `"preserve"` |
| `htmlWhitespaceSensitivity` | `"css"` |
| `embeddedLanguageFormatting` | `"auto"` |
| `singleAttributePerLine` | `false` |

### Usage with Prettier API

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

To extend in a project:

```jsonc
{
  "extends": "@hardlydifficult/ts-config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
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