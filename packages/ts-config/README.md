# @hardlydifficult/ts-config

Opinionated config package for ESLint, Prettier, and TypeScript with flat-file ESLint API and Next.js support.

## Installation

```bash
npm install @hardlydifficult/ts-config
```

## Quick Start

Create an `eslint.config.js` file at the root of your project:

```typescript
// eslint.config.js
import createConfig from "@hardlydifficult/ts-config/eslint";
import createNextConfig from "@hardlydifficult/ts-config/eslint-next";
import prettierConfig from "@hardlydifficult/ts-config/prettier";

// For a standard TypeScript project
export default createConfig(process.cwd());

// For a Next.js project (replace `nextConfig` with actual Next.js config array)
// export default createNextConfig(process.cwd(), nextConfig);
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

## ESLint Configuration

### `createConfig(projectRoot)`

Creates a shared ESLint flat config for TypeScript projects with strict type-checking, import ordering, JSDoc, and code style rules.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `projectRoot` | `string` | Path to the project root directory (used for TypeScript project service) |

**Returns:** `Linter.Config[]` — ESLint configuration array

**Default ignores:**
- `**/dist/**`
- `**/node_modules/**`
- `**/*.js`
- `**/tests/**`
- `**/vitest.config.ts`
- `**/.next/**`
- `**/.turbo/**`
- `**/*.config.mjs`

**Key rules enabled:**
- Auto-fixable: `curly`, `dot-notation`, `eqeqeq`, `no-else-return`, `prefer-const`, `prefer-template`, `sort-imports`
- Non-auto-fixable: `no-console` (allows `error`/`warn`), `no-floating-promises`, `no-misused-promises`
- Import ordering with `import-x/order` (groups: builtin → external → internal → parent → sibling → index)
- JSDoc required for exported functions and classes
- Unused imports removed automatically

### `createNextConfig(projectRoot, nextConfig)`

Creates an ESLint flat config for Next.js projects by combining the base config with React-specific rules.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `projectRoot` | `string` | Path to the project root directory |
| `nextConfig` | `Linter.Config[]` | Next.js ESLint config array (from `@next/eslint-plugin-next`) |

**Returns:** `Linter.Config[]` — Combined ESLint configuration array

**React-specific rules added:**
- `react/react-in-jsx-scope`: `"off"` (not needed in Next.js 13+)
- `react/prop-types`: `"off"` (TypeScript handles this)
- `react/self-closing-comp`: `["error", { component: true, html: true }]`
- `react/jsx-boolean-value`: `["error", "never"]`
- `react/no-array-index-key`: `"warn"`
- `react/jsx-curly-brace-presence`: `["error", { props: "never", children: "never" }]`

## Prettier Configuration

### `prettierConfig`

Exports a Prettier configuration object for TypeScript/JavaScript projects:

```typescript
{
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  useTabs: false,
  trailingComma: "es5",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  endOfLine: "lf",
  printWidth: 80,
  quoteProps: "as-needed",
  jsxSingleQuote: false,
  proseWrap: "preserve",
  htmlWhitespaceSensitivity: "css",
  embeddedLanguageFormatting: "auto",
  singleAttributePerLine: false,
}
```

**Usage example:**

```typescript
// prettier.config.js
import config from "@hardlydifficult/ts-config/prettier";
export default config;
```

## TypeScript Configuration

### `tsconfig.base.json`

Base TypeScript compiler configuration with strict settings and modern ES2022 features:

- `target`: `ES2022`
- `module`: `CommonJS`
- `moduleResolution`: `node`
- `strict`: `true`
- `esModuleInterop`: `true`
- `skipLibCheck`: `true`
- `forceConsistentCasingInFileNames`: `true`
- `declaration`: `true`
- `declarationMap`: `true`
- `sourceMap`: `true`
- `resolveJsonModule`: `true`
- `isolatedModules`: `true`

To use in your project:

```json
{
  "extends": "@hardlydifficult/ts-config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

## Appendix

### Required peer dependencies

Your project must install these peer dependencies:

- `@eslint/compat` (`>=2.0.0`)
- `@eslint/js` (`>=10.0.0`)
- `eslint` (`>=10.0.0`)
- `eslint-config-prettier` (`>=10.0.0`)
- `eslint-plugin-import-x` (`>=4.0.0`)
- `eslint-plugin-jsdoc` (`>=62.0.0`)
- `eslint-plugin-unused-imports` (`>=4.0.0`)
- `typescript-eslint` (`>=8.0.0`)