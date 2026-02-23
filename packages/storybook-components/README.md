# @hardlydifficult/storybook-components

A React component library built with TypeScript, Tailwind CSS, and Storybook—featuring atomic primitives and higher-level UI widgets for rapid interface development.

## Installation

```bash
npm install @hardlydifficult/storybook-components
```

## Quick Start

```tsx
import { Button, Card, Text } from '@hardlydifficult/storybook-components';

export default function App() {
  return (
    <Card>
      <Card.Header>
        <Text variant="h2">Hello, world!</Text>
      </Card.Header>
      <Card.Body>
        <Button variant="primary">Click me</Button>
      </Card.Body>
    </Card>
  );
}
```

## Components

### Primitives

#### `Text`

A semantic typography component supporting multiple visual variants.

| Prop | Type | Default |
|------|------|---------|
| `as` | `ElementType` | `'p'` |
| `variant` | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'p' \| 'small' \| 'label'` | `'p'` |
| `color` | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'error' \| 'muted'` | `'neutral'` |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` |
| `truncate` | `boolean` | `false` |
| `weight` | `'normal' \| 'medium' \| 'semibold' \| 'bold'` | `'normal'` |

```tsx
import { Text } from '@hardlydifficult/storybook-components';

<Text variant="h2" color="primary">
  Section heading
</Text>
```

#### `Button`

Reusable button component with primary, secondary, and ghost variants.

| Prop | Type | Default |
|------|------|---------|
| `variant` | `'primary' \| 'secondary' \| 'ghost'` | `'primary'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `isLoading` | `boolean` | `false` |
| `icon` | `ReactNode` | `undefined` |
| `children` | `ReactNode` | `undefined` |
| `disabled` | `boolean` | `false` |

```tsx
import { Button } from '@hardlydifficult/storybook-components';

<Button variant="secondary" size="lg" isLoading>
  Saving...
</Button>
```

#### `Badge`

Renders semantic status indicators with colored dot indicators.

| Prop | Type | Default |
|------|------|---------|
| `variant` | `'success' \| 'warning' \| 'error' \| 'info'` | `'neutral'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `children` | `ReactNode` | — |

```tsx
import { Badge } from '@hardlydifficult/storybook-components';

<Badge variant="success">Completed</Badge>
```

#### `Card`

A flexible container with optional header and footer sections.

| Prop | Type | Default |
|------|------|---------|
| `children` | `ReactNode` | — |
| `header` | `ReactNode` | `undefined` |
| `footer` | `ReactNode` | `undefined` |
| `padding` | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` |

```tsx
import { Card } from '@hardlydifficult/storybook-components';

<Card padding="lg" header={<Text variant="h3">Title</Text>} footer={<Button>Action</Button>}>
  <Text>Card content here</Text>
</Card>
```

#### `Stack`

A layout primitive for vertical/horizontal stacking with configurable gaps.

| Prop | Type | Default |
|------|------|---------|
| `direction` | `'vertical' \| 'horizontal'` | `'vertical'` |
| `gap` | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` |
| `children` | `ReactNode[] \| ReactNode` | — |

```tsx
import { Stack, Button, Text } from '@hardlydifficult/storybook-components';

<Stack direction="horizontal" gap="sm">
  <Button variant="primary">Primary</Button>
  <Button variant="secondary">Secondary</Button>
</Stack>
```

### Widgets

#### `ActivityFeed`

Renders chronological events with avatars, status indicators, and relative timestamps.

| Prop | Type | Default |
|------|------|---------|
| `events` | `Array<{ id: string; actor: string; verb: string; object?: string; timestamp: Date; status?: 'success' \| 'warning' \| 'error' \| 'info' }>` | — |
| `emptyMessage` | `ReactNode` | `'No recent activity'` |
| `showSystemEvents` | `boolean` | `false` |

```tsx
import { ActivityFeed } from '@hardlydifficult/storybook-components';
import { formatRelative } from 'date-fns';

const events = [
  {
    id: '1',
    actor: 'Alice',
    verb: 'uploaded',
    object: 'report.pdf',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    status: 'success',
  },
  {
    id: '2',
    actor: 'Bob',
    verb: 'created',
    object: 'Project X',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
];

<ActivityFeed events={events} emptyMessage={<Text color="muted">No activity yet</Text>} />;
```

#### `NotificationToast`

Dismissable notification toasts with status-specific styling.

| Prop | Type | Default |
|------|------|---------|
| `status` | `'success' \| 'error' \| 'warning' \| 'info'` | `'info'` |
| `title` | `string` | `undefined` |
| `message` | `string` | `''` |
| `onDismiss` | `() => void` | `undefined` |
| `actionLabel` | `string` | `undefined` |
| `onActionClick` | `() => void` | `undefined` |

```tsx
import { NotificationToast } from '@hardlydifficult/storybook-components';

<NotificationToast
  status="success"
  title="Saved"
  message="Your changes have been saved successfully."
  onDismiss={() => {}}
/>;
```

#### `ProgressBar`

Renders a linear progress bar with optional label and dynamic color.

| Prop | Type | Default |
|------|------|---------|
| `value` | `number` | `0` |
| `max` | `number` | `100` |
| `label` | `string` | `undefined` |
| `showValue` | `boolean` | `false` |

```tsx
import { ProgressBar } from '@hardlydifficult/storybook-components';

<ProgressBar value={75} max={100} label="Progress" showValue />;
```

#### `StatCard`

Renders metric cards with optional trend indicator (up/down icon and percentage).

| Prop | Type | Default |
|------|------|---------|
| `label` | `string` | — |
| `value` | `string \| number` | — |
| `trendValue` | `number` | `undefined` |
| `trendType` | `'up' \| 'down' \| 'neutral'` | `'neutral'` |

```tsx
import { StatCard } from '@hardlydifficult/storybook-components';

<StatCard label="Revenue" value="$42,500" trendValue={5.2} trendType="up" />;
```

#### `UserCard`

User profile card with deterministic avatar, status indicator, and optional action.

| Prop | Type | Default |
|------|------|---------|
| `name` | `string` | — |
| `email` | `string` | — |
| `status` | `'online' \| 'away' \| 'offline'` | `'offline'` |
| `avatarSize` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `action` | `{ label: string; onClick: () => void }` | `undefined` |

```tsx
import { UserCard } from '@hardlydifficult/storybook-components';

<UserCard
  name="Alice Smith"
  email="alice@example.com"
  status="online"
  action={{ label: 'View', onClick: () => {} }}
/>;
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