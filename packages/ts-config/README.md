# @hardlydifficult/ts-config

Opinionated ESLint, Prettier, and TypeScript configurations for consistent tooling across projects.

## Installation

```bash
npm install -D @hardlydifficult/ts-config
```

Peer dependencies for ESLint:

```bash
npm install -D @eslint/js eslint eslint-config-prettier eslint-plugin-import typescript-eslint
```

## Quick Start

```typescript
// eslint.config.js
import createConfig from "@hardlydifficult/ts-config/eslint";
export default createConfig(import.meta.dirname);
```

Add Prettier config to `package.json`:

```json
{
  "prettier": "@hardlydifficult/ts-config/prettier"
}
```

Extend the base TypeScript config:

```json
{
  "extends": "@hardlydifficult/ts-config/tsconfig.base.json"
}
```

## ESLint

Exports a default function `createConfig(projectRoot: string)` that returns a flat ESLint configuration.

- **projectRoot**: Used for TypeScript type-checked linting via `tsconfigRootDir`.

### Features

- Strict TypeScript type checking with `@typescript-eslint/eslint-plugin`
- Import ordering and validation using `eslint-plugin-import-x`
- 400-line file limit to keep files concise
- `no-console` (allows `console.error` and `console.warn`)
- Prettier integration (formatting errors become lint errors)

### Usage

```typescript
// eslint.config.js
import createConfig from "@hardlydifficult/ts-config/eslint";
export default createConfig(import.meta.dirname);
```

### Rules Included

| Rule | Level | Notes |
|------|-------|-------|
| `max-lines` | error | Max 400 lines per file |
| `no-console` | error | Allow `error`, `warn` |
| `curly` | error | Require braces for all blocks |
| `eqeqeq` | error | Always require `===`/`!==` |
| `prefer-const` | error | Enforce `const` where possible |
| `import-x/order` | error | Enforce import groups and alphabetical order |
| `unused-imports/no-unused-imports` | error | Remove unused imports |
| `jsdoc/require-jsdoc` | error | JSDoc for public declarations |

## ESLint for Next.js

Exports `createNextConfig(projectRoot: string, nextConfig: Linter.Config[])`.

Combines the base ESLint config with Next.js and React rules.

### Usage

```typescript
// eslint.config.js
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";
import next from "@next/eslint-plugin-next";
import react from "eslint-plugin-react";

const nextConfig = [
  ...next.configs.recommended,
  ...react.configs.flat.recommended,
];

export default createNextConfig(import.meta.dirname, nextConfig);
```

### React Rules

| Rule | Level | Notes |
|------|-------|-------|
| `react/react-in-jsx-scope` | off | Not needed in Next.js 13+ |
| `react/prop-types` | off | TypeScript handles props |
| `react/self-closing-comp` | error | Auto-close elements |
| `react/jsx-boolean-value` | error | Never omit boolean props |

## Prettier

Exports a default `Config` object with consistent formatting rules.

### Config Values

| Option | Value |
|--------|-------|
| `semi` | `true` |
| `singleQuote` | `false` |
| `tabWidth` | `2` |
| `trailingComma` | `"es5"` |
| `printWidth` | `80` |
| `arrowParens` | `"always"` |
| `endOfLine` | `"lf"` |

### Usage

Add to `package.json`:

```json
{
  "prettier": "@hardlydifficult/ts-config/prettier"
}
```

No `.prettierrc` file required.

## TypeScript

### Base Config

Extends `@hardlydifficult/ts-config/tsconfig.base.json` for shared compiler options:

- Target: `ES2022`
- Module: `CommonJS`
- Strict mode enabled
- Declaration and source map generation

### Node Config

Extends `@hardlydifficult/ts-config/tsconfig.json` for Node.js-specific builds:

- Module: `Node16`
- Output to `./dist`
- Includes `src/**/*`

### Usage

```json
{
  "extends": "@hardlydifficult/ts-config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```