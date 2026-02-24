# @hardlydifficult/storybook-components

A React component library for Storybook, offering atomic design primitives and domain-specific UI widgets built with Tailwind CSS and TypeScript.

## Installation

```bash
npm install @hardlydifficult/storybook-components
```

## Quick Start

```tsx
import { Button, Stack, Text } from '@hardlydifficult/storybook-components';

function Example() {
  return (
    <Stack gap="md">
      <Text variant="h1">Hello, World!</Text>
      <Button variant="primary">Click me</Button>
    </Stack>
  );
}
```

## Primitives

### Stack

A flexible layout primitive for vertical and horizontal stacking using CSS Flexbox.

```tsx
import { Stack } from '@hardlydifficult/storybook-components';

// Horizontal layout with default spacing
<Stack direction="horizontal">
  <div>Item 1</div>
  <div>Item 2</div>
</Stack>

// Vertical layout with custom gap
<Stack direction="vertical" gap="lg">
  <div>Top</div>
  <div>Bottom</div>
</Stack>
```

### Text

A typography primitive supporting semantic HTML elements and variant-based styling.

| Variant   | HTML Element | Example Usage                     |
|-----------|--------------|-----------------------------------|
| `h1`      | `<h1>`       | `<Text variant="h1">Heading 1</Text>` |
| `h2`      | `<h2>`       | `<Text variant="h2">Heading 2</Text>` |
| `body`    | `<p>`        | `<Text variant="body">Paragraph</Text>` |
| `caption` | `<small>`    | `<Text variant="caption">Note</Text>` |

```tsx
import { Text } from '@hardlydifficult/storybook-components';

<Text variant="h2">Section Title</Text>
<Text variant="body" className="text-gray-600">
  This is descriptive text.
</Text>
```

### Button

A reusable button component supporting multiple visual variants and optional icons.

| Variant    | Use Case                         |
|------------|----------------------------------|
| `primary`  | Main actions (e.g., Save)        |
| `secondary`| Secondary actions (e.g., Cancel) |
| `ghost`    | Minimal emphasis (e.g., icons)   |

```tsx
import { Button } from '@hardlydifficult/storybook-components';

<Button variant="primary">Submit</Button>
<Button variant="secondary">Reset</Button>
<Button variant="ghost" aria-label="More options">
  ⋮
</Button>
```

### Card

A container component with optional header and footer sections and dynamic padding.

```tsx
import { Card, Stack, Text } from '@hardlydifficult/storybook-components';

<Card>
  <Card.Header>
    <Text variant="h3">Card Title</Text>
  </Card.Header>
  <Card.Body>
    <Stack gap="sm">
      <Text variant="body">Content goes here.</Text>
    </Stack>
  </Card.Body>
  <Card.Footer>
    <Text variant="caption">Footer content</Text>
  </Card.Footer>
</Card>
```

### Badge

Renders semantic status indicators with colored dot and variant-based styling.

| Variant   | Dot Color | Use Case                         |
|-----------|-----------|----------------------------------|
| `success` | Green     | Active / Completed               |
| `warning` | Orange    | Warning / Pending                |
| `error`   | Red       | Error / Failed                   |
| `info`    | Blue      | Information                      |
| `default` | Gray      | Neutral / Default state          |

```tsx
import { Badge } from '@hardlydifficult/storybook-components';

<Badge variant="success">Online</Badge>
<Badge variant="warning" size="sm">Pending</Badge>
```

## Widgets

### GlobalNav

A responsive global navigation bar with dropdown menus, external link rendering, and keyboard interaction support.

```tsx
import { GlobalNav } from '@hardlydifficult/storybook-components';

<GlobalNav
  brand="App"
  links={[
    { label: 'Dashboard', url: '/dashboard' },
    {
      label: 'More',
      dropdown: [
        { label: 'Settings', url: '/settings' },
        { label: 'Help', url: '/help', external: true },
      ],
    },
  ]}
  user={{ name: 'Alice', avatar: '/alice.png' }}
/>
```

### ActivityFeed

Renders chronological activity items with avatars, timestamps, and optional status indicators.

| Feed Type       | Behavior                                |
|-----------------|-----------------------------------------|
| `normal`        | Standard user activity with avatars     |
| `empty`         | Displays empty state when no activities |
| `system-events` | Highlights system-generated events      |

```tsx
import { ActivityFeed } from '@hardlydifficult/storybook-components';

const activities = [
  {
    id: '1',
    type: 'user',
    user: { name: 'Bob', avatar: '/bob.png' },
    verb: 'commented on',
    object: 'Task #123',
    timestamp: '2024-06-10T14:30:00Z',
  },
];

<ActivityFeed activities={activities} />
```

### NotificationToast

A dismissable notification component supporting success, error, warning, and info variants.

| Variant   | Styling             | Example Use                        |
|-----------|---------------------|------------------------------------|
| `success` | Green bar + check   | Save successful                    |
| `error`   | Red bar + X         | Failed to load                     |
| `warning` | Orange bar + alert  | Deprecated API usage               |
| `info`    | Blue bar + info     | New feature available              |

```tsx
import { NotificationToast } from '@hardlydifficult/storybook-components';

<NotificationToast
  variant="success"
  title="Saved!"
  message="Your changes were saved successfully."
  onDismiss={() => console.log('Dismissed')}
/>
```

### ProgressBar

Renders a linear progress bar with dynamic color and optional label.

```tsx
import { ProgressBar } from '@hardlydifficult/storybook-components';

<ProgressBar progress={75} label="Uploading..." />
<ProgressBar progress={100} variant="success" />
```

### StatCard

Displays metric cards with optional trend indicators (up/down icon + percentage).

```tsx
import { StatCard } from '@hardlydifficult/storybook-components';

<StatCard
  title="Revenue"
  value="$12,450"
  trend={{ value: 12.5, direction: 'up' }}
/>
<StatCard
  title="Errors"
  value="2.1%"
  trend={{ value: 0.3, direction: 'down' }}
/>
<StatCard
  title="Users"
  value="1,024"
  // No trend indicator
/>
```

### UserCard

A user profile card with deterministic avatar selection, status indicator, and optional action button.

| Status   | Dot Color | Description          |
|----------|-----------|----------------------|
| `online` | Green     | User is active       |
| `busy`   | Red       | Do not disturb       |
| `offline`| Gray      | User is away         |

```tsx
import { UserCard } from '@hardlydifficult/storybook-components';

<UserCard
  user={{
    name: 'Alice',
    avatar: '/alice.png',
    status: 'online',
  }}
  action={{ label: 'Message', onClick: () => {} }}
/>
```

## Setup

This package is intended for use with Storybook, which is already configured in the `.storybook` directory using Vite and Tailwind CSS. To use these components in a Storybook project:

1. Install the package:
   ```bash
   npm install @hardlydifficult/storybook-components
   ```
2. Import components directly in your stories:
   ```tsx
   import { Button } from '@hardlydifficult/storybook-components';
   ```

No additional environment variables or configuration is required beyond Storybook itself.

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

Screenshots are auto-captured in CI whenever `packages/storybook-components/` changes. They use `agent-browser` to visit each story and save PNGs to `.screenshots/`. That directory is fully regenerated on each run so removed or renamed stories show up as a clean diff.

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

## Adding a Component

1. Create `src/components/MyComponent.tsx`
2. Create `stories/MyComponent.stories.tsx`
3. Export from `src/index.ts`
4. Run `npm run storybook` to preview

## Exports

All components are exported via the barrel entry `@hardlydifficult/storybook-components`:

```ts
// Primitives
export { Badge } from './components/Badge';
export { Button } from './components/Button';
export { Card } from './components/Card';
export { Stack } from './components/Stack';
export { Text } from './components/Text';

// Widgets
export { ActivityFeed } from './widgets/ActivityFeed';
export { NotificationToast } from './widgets/NotificationToast';
export { ProgressBar } from './widgets/ProgressBar';
export { StatCard } from './widgets/StatCard';
export { UserCard } from './widgets/UserCard';
export { GlobalNav } from './widgets/GlobalNav';
```

## Appendix

No behavioral differences across platforms or environments are present in this package. All components are purely UI-focused and rely on Tailwind CSS for rendering. Variant behavior is standardized and documented in tables above.