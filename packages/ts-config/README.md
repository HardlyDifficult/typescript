# @hardlydifficult/ts-config

Opinionated ESLint, Prettier, and TypeScript configurations.

## Installation

```bash
npm install -D @hardlydifficult/ts-config
```

Peer dependencies for ESLint:

```bash
npm install -D @eslint/js eslint eslint-config-prettier eslint-plugin-import typescript-eslint
```

## ESLint

Create `eslint.config.js`:

```js
import createConfig from "@hardlydifficult/ts-config/eslint";
export default createConfig(import.meta.dirname);
```

`createConfig` takes the project root directory (used for TypeScript type-checked linting).

### Rules Included

- Strict TypeScript type checking
- Import ordering and validation
- Prettier integration (formatting errors become lint errors)
- 400-line file limit
- `no-console` (prevents accidental console statements)

## Prettier

Add the `prettier` key to `package.json` to use the shared config:

```json
{
  "prettier": "@hardlydifficult/ts-config/prettier"
}
```

This tells Prettier to load its config from this package. No `.prettierrc` file needed.

## TypeScript

Base config targeting ES2022 with CommonJS modules, strict mode, and declaration output.

Create or update `tsconfig.json`:

```json
{
  "extends": "@hardlydifficult/ts-config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

The `extends` field pulls in all shared compiler options. Add per-project overrides alongside it.
