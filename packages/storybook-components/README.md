# @hardlydifficult/storybook-components

Component library with Storybook for development and documentation.

## Local Development

```bash
# From repo root
npm install
npm run build

# Start Storybook dev server
cd packages/storybook-components
npm run storybook
# Opens at http://localhost:6006
```

## Screenshots

Screenshots are auto-captured in CI whenever `packages/storybook-components/` changes. They use `agent-browser` to visit each story and save PNGs to `screenshots/`.

To capture locally:

```bash
cd packages/storybook-components
npx agent-browser install          # one-time: installs Chromium
npm run build:storybook
npm run screenshots
```

## GitHub Pages Setup

A workflow at `.github/workflows/storybook.yml` deploys the built Storybook to GitHub Pages on push to `main` (when storybook-components files change).

**One-time setup required in the GitHub repo:**

1. Go to **Settings > Pages**
2. Under **Build and deployment > Source**, select **GitHub Actions**
3. That's it — the next push to `main` touching this package will deploy

The Storybook will be available at `https://HardlyDifficult.github.io/typescript/`.

## Components

**Primitives:** `Button`, `Card`, `Badge`, `Text`, `Stack`

**Widgets:** `ActivityFeed` — a composite widget demonstrating all primitives together

## Adding a Component

1. Create `src/components/MyComponent.tsx`
2. Create `stories/MyComponent.stories.tsx`
3. Export from `src/index.ts`
4. Run `npm run storybook` to preview
