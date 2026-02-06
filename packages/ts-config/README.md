# @hardlydifficult/ts-config

Shared ESLint, Prettier, and TypeScript configurations for the `@hardlydifficult` ecosystem.

## Installation

```bash
npm install -D @hardlydifficult/ts-config
```

Peer dependencies for ESLint:

```bash
npm install -D @eslint/js eslint eslint-config-prettier eslint-plugin-import typescript-eslint
```

## ESLint

Exports a `createConfig(projectRoot)` function for ESLint flat config.

Create `eslint.config.js`:

```js
import createConfig from "@hardlydifficult/ts-config/eslint";
export default createConfig(import.meta.dirname);
```

For monorepos with config in a subdirectory (e.g., `.config/eslint.config.js`):

```js
import createConfig from "@hardlydifficult/ts-config/eslint";
export default createConfig(import.meta.dirname + "/..");
```

### Rules Included

- Strict TypeScript type checking
- Import ordering and validation
- Prettier integration (formatting errors become lint errors)
- 400-line file limit
- `no-console` (prevents accidental console statements)

## Prettier

Exports a shared Prettier config object. Add to `package.json`:

```json
"prettier": "@hardlydifficult/ts-config/prettier"
```

## TypeScript

Base TypeScript config targeting ES2022 with CommonJS modules, strict mode, and declaration output.

In `tsconfig.json`:

```json
{ "extends": "@hardlydifficult/ts-config/tsconfig.base.json" }
```
