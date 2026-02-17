# CLAUDE.md

Shared `@hardlydifficult/*` npm packages. Monorepo with Turbo, published via CI.

## Start Here

1. `npm install && npm run build` — install deps and compile all packages (must use Turbo via root scripts)
2. Read this file for structure and patterns

## Commands

```bash
npm install              # Install all workspace dependencies
npm run build            # Build all packages in dependency order (Turbo)
npm run test             # Run all tests (Turbo)
npm run lint             # ESLint across all packages
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run fix              # lint:fix + format (run before committing)
```

**IMPORTANT — Always build via Turbo**: Individual package builds (`npm run build -w @hardlydifficult/foo`) may fail if dependencies haven't been built yet. Use `npm run build` from the repo root — Turbo handles the dependency graph (`^build`). To build a single package with its deps: `npx turbo run build --filter=@hardlydifficult/foo...`

## Verification

**Always run before committing:**

```bash
npm run build            # Must pass — TypeScript compilation
npm run lint             # Must pass — strict ESLint rules (e.g., default-case)
```

## Structure

Workspace packages live in `packages/`. Each is an independent npm package under `@hardlydifficult/` scope.

### Inter-package dependencies use `file:` references

During development, packages reference siblings via `file:../sibling` in `dependencies`/`devDependencies`. The publish script (`packages/ci-scripts/src/publish.ts`) transforms these to real npm versions before publishing. `peerDependencies` use version ranges and are not transformed.

### Publishing (CI only)

`.github/workflows/publish.yml` runs on push to `main`. The publish script:
1. Discovers and topologically sorts packages by dependency order
2. Detects changes via git tags (`{safe-name}-v{version}`)
3. Auto-increments patch version based on npm registry
4. Transforms `file:` references → real versions from `publishedVersions` map
5. Runs `npm publish --access public`, creates git tags

## Patterns

- **Pin all dependencies** — exact versions only, no `^` or `~`
- **ESM** — all packages use `"type": "module"`
- **No `package-lock.json` in git** — `.gitignore` excludes it
