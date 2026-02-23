# @hardlydifficult/storybook-components

A React component library built with TypeScript, Tailwind CSS, and Storybook—featuring atomic primitives and higher-level UI widgets for rapid interface development.

## Installation

```bash
npm install @hardlydifficult/storybook-components
```

## Quick Start

```tsx
import { Button, Text, Badge } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <div>
      <Text variant="heading">Welcome</Text>
      <Button variant="primary" onClick={() => console.log("Clicked!")}>
        Click me
      </Button>
      <Badge variant="success">Active</Badge>
    </div>
  );
}
```

## Atomic Components

### Text

Typography primitive with semantic variants: heading, subheading, body, caption, and code.

| Property | Type | Default |
|----------|------|---------|
| `as` | `ElementType` | `'p'` |
| `variant` | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'p' \| 'small' \| 'label' \| 'heading' \| 'subheading' \| 'caption' \| 'code'` | `'p'` |
| `color` | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'error' \| 'muted'` | `'neutral'` |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` |
| `truncate` | `boolean` | `false` |
| `weight` | `'normal' \| 'medium' \| 'semibold' \| 'bold'` | `'normal'` |

```tsx
import { Text } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <>
      <Text variant="heading">Heading</Text>
      <Text variant="body">Body text</Text>
      <Text variant="code">const x = 1;</Text>
    </>
  );
}
```

### Button

Reusable button with primary, secondary, and ghost variants, supports icons and optional click handler.

| Property | Type | Default |
|----------|------|---------|
| `variant` | `"primary" \| "secondary" \| "ghost"` | `"primary"` |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` |
| `disabled` | `boolean` | `false` |
| `isLoading` | `boolean` | `false` |
| `icon` | `ReactNode` | `undefined` |
| `onClick` | `MouseEventHandler<HTMLButtonElement>` | `undefined` |

```tsx
import { Button } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <>
      <Button variant="primary">Primary</Button>
      <Button icon={<span>⚡</span>}>With Icon</Button>
      <Button variant="ghost" disabled>Disabled</Button>
    </>
  );
}
```

### Badge

Semantic status badge with a colored dot indicator.

| Property | Type | Default |
|----------|------|---------|
| `variant` | `"default" \| "success" \| "warning" \| "error" \| "info"` | `"default"` |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` |

```tsx
import { Badge } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge size="sm">Small</Badge>
    </>
  );
}
```

### Card

Container component with optional header and footer sections.

| Property | Type | Default |
|----------|------|---------|
| `title` | `string` | `undefined` |
| `footer` | `ReactNode` | `undefined` |
| `children` | `ReactNode` | required |
| `padding` | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` |

```tsx
import { Card, Text } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <Card title="Header" footer={<button>Footer</button>}>
      <Text variant="body">Content goes here</Text>
    </Card>
  );
}
```

### Stack

Flex layout primitive for vertical or horizontal stacking.

| Property | Type | Default |
|----------|------|---------|
| `direction` | `"vertical" \| "horizontal"` | `"vertical"` |
| `gap` | `"none" \| "xs" \| "sm" \| "md" \| "lg" \| "xl"` | `"md"` |

```tsx
import { Stack, Button, Text } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <Stack direction="horizontal" gap="lg">
      <Button>One</Button>
      <Button>Two</Button>
    </Stack>
  );
}
```

## Widgets

### ActivityFeed

Renders a chronological list of activity events with status indicators, avatars, and relative timestamps.

| Property | Type | Default |
|----------|------|---------|
| `events` | `ActivityEvent[]` | required |
| `title` | `string` | `undefined` |
| `emptyMessage` | `ReactNode` | `"No recent activity"` |
| `showSystemEvents` | `boolean` | `false` |

`ActivityEvent` interface:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `message` | `string` | Event description |
| `timestamp` | `Date` | Event time |
| `status` | `"success" \| "error" \| "warning" \| "info" \| "pending"` | Event status |
| `actor?` | `{ name: string; avatar?: string }` | Optional actor information |
| `detail?` | `string` | Optional detail text |

```tsx
import { ActivityFeed } from "@hardlydifficult/storybook-components";

const events: ActivityFeed.ActivityEvent[] = [
  {
    id: "1",
    message: "Deployment successful",
    timestamp: new Date(),
    status: "success",
    actor: { name: "Jane Doe" },
    detail: "v2.3.1",
  },
];

function Example() {
  return <ActivityFeed events={events} title="Recent Activity" />;
}
```

### NotificationToast

Dismissable notification toast with status-specific styling and optional action button.

| Property | Type | Default |
|----------|------|---------|
| `variant` | `"success" \| "error" \| "warning" \| "info"` | required |
| `title` | `string` | required |
| `message` | `string` | `undefined` |
| `onDismiss` | `() => void` | `undefined` |
| `action?` | `{ label: string; onClick: () => void }` | `undefined` |

```tsx
import { NotificationToast } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <NotificationToast
      variant="success"
      title="Saved"
      message="Changes have been saved successfully."
      onDismiss={() => console.log("Dismissed")}
    />
  );
}
```

### ProgressBar

Linear progress bar with dynamic color and optional label.

| Property | Type | Default |
|----------|------|---------|
| `value` | `number` | required (0–100, clamped) |
| `label?` | `string` | `undefined` |

```tsx
import { ProgressBar } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <>
      <ProgressBar value={60} label="Upload progress" />
      <ProgressBar value={100} />
    </>
  );
}
```

### StatCard

Metric card showing a label, value, optional trend (up/down with percentage), and caption.

| Property | Type | Default |
|----------|------|---------|
| `label` | `string` | required |
| `value` | `string \| number` | required |
| `trend?` | `number` | `undefined` |
| `caption?` | `string` | `undefined` |

```tsx
import { StatCard } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <>
      <StatCard label="Revenue" value="$12.4k" trend={12.5} />
      <StatCard label="Error rate" value="0.3%" trend={-1.2} caption="Better than last week" />
    </>
  );
}
```

### UserCard

User profile card with deterministic avatar, role, status indicator, and optional action button.

| Property | Type | Default |
|----------|------|---------|
| `name` | `string` | required |
| `role` | `string` | required |
| `status?` | `"online" \| "away" \| "offline"` | `undefined` |
| `action?` | `{ label: string; onClick: () => void }` | `undefined` |

```tsx
import { UserCard } from "@hardlydifficult/storybook-components";

function Example() {
  return (
    <UserCard
      name="John Smith"
      role="Product Designer"
      status="online"
      action={{ label: "View Profile", onClick: () => {} }}
    />
  );
}
```

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
```

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