# @hardlydifficult/ts-config

Opinionated ESLint, Prettier, and TypeScript configurations for consistent code quality.

## Installation

```bash
npm install -D @hardlydifficult/ts-config
```

Peer dependencies for ESLint:

```bash
npm install -D @eslint/js eslint eslint-config-prettier eslint-plugin-import-x eslint-plugin-jsdoc eslint-plugin-unused-imports typescript-eslint
```

## Usage

Create `eslint.config.js` in your project root:

```typescript
import createConfig from "@hardlydifficult/ts-config/eslint";

export default createConfig(import.meta.dirname);
```

For Next.js projects, use the Next-specific config:

```typescript
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";
import { flatConfig } from "next/dist/esm/config";

export default createNextConfig(
  import.meta.dirname,
  flatConfig()
);
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
  "extends": "@hardlydifficult/ts-config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## API Reference

### `createConfig(projectRoot: string)`

Creates the shared ESLint flat config for TypeScript projects with strict type-checking, import ordering, JSDoc, and code style rules.

**Parameters:**

| Parameter | Type | Description |
|---------|------|-------------|
| `projectRoot` | `string` | Path to the project root directory (used for TypeScript type-checked linting) |

**Returns:** `Promise<Linter.Config[]>`

**Example:**

```typescript
import createConfig from "@hardlydifficult/ts-config/eslint";

// ESLint configuration with type checking enabled
export default createConfig("/path/to/project");
```

### `createNextConfig(projectRoot: string, nextConfig: Linter.Config[])`

Creates an ESLint flat config for Next.js projects by combining the base config with React-specific rules.

**Parameters:**

| Parameter | Type | Description |
|---------|------|-------------|
| `projectRoot` | `string` | Path to the project root directory |
| `nextConfig` | `Linter.Config[]` | Next.js ESLint configuration (e.g., from `next/dist/esm/config`) |

**Returns:** `Linter.Config[]`

**Example:**

```typescript
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";
import { flatConfig } from "next/dist/esm/config";

export default createNextConfig(
  "/path/to/nextjs-project",
  flatConfig()
);
```

### Prettier Config

Exports a shared Prettier configuration for TypeScript/JavaScript projects.

**Configuration:**

```json
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

**Example Usage:**

```json
{
  "prettier": "@hardlydifficult/ts-config/prettier"
}
```

### TypeScript Base Config (`tsconfig.base.json`)

Base TypeScript compiler configuration providing strict settings and modern ES2022 features.

**Configuration:**

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

**Example Usage:**

```json
{
  "extends": "@hardlydifficult/ts-config/tsconfig.base.json"
}
```

## Rules Included

- Strict TypeScript type checking (with `@typescript-eslint/strict-boolean-expressions`)
- Import ordering and validation (`import-x/order`)
- JSDoc requirements on exported functions and classes
- 400-line file limit (`max-lines`)
- `no-console` (prevents accidental console statements, allows `console.error` and `console.warn`)
- Prettier integration (formatting errors become lint errors)
- Auto-fixable code style rules (arrow functions, destructuring, etc.)
- Unused import removal (`unused-imports/no-unused-imports`)