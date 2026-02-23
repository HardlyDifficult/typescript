# @hardlydifficult/storybook-components

A React component library built with TypeScript, Tailwind CSS, and Storybook—featuring atomic primitives and higher-level UI widgets for rapid interface development.

## Installation

```bash
npm install @hardlydifficult/storybook-components
```

## Quick Start

```tsx
import { Button, Text, Stack, Card } from "@hardlydifficult/storybook-components";

export default function Example() {
  return (
    <Card title="Welcome">
      <Stack direction="vertical" gap="lg">
        <Text variant="heading">Hello, world!</Text>
        <Text variant="body">This is a paragraph with some example content.</Text>
        <Button variant="primary" onClick={() => console.log("Clicked!")}>
          Click me
        </Button>
      </Stack>
    </Card>
  );
}
```

## Components

### Primitives

#### `Text`

A semantic typography component supporting multiple visual variants.

| Prop      | Type                                                                 | Default     |
|-----------|----------------------------------------------------------------------|-------------|
| `as`      | `ElementType`                                                        | `'p'`       |
| `variant` | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'p' \| 'small' \| 'label' \| 'heading' \| 'subheading' \| 'caption' \| 'code'` | `'p'`       |
| `color`   | `'neutral' \| 'primary' \| 'success' \| 'warning' \| 'error' \| 'muted'` | `'neutral'` |
| `align`   | `'left' \| 'center' \| 'right'`                                      | `'left'`    |
| `truncate`| `boolean`                                                            | `false`     |
| `weight`  | `'normal' \| 'medium' \| 'semibold' \| 'bold'`                       | `'normal'`  |

```tsx
import { Text } from "@hardlydifficult/storybook-components";

// Headings
<Text variant="heading">Main heading</Text>       // renders <h2>
<Text variant="subheading">Subheading</Text>     // renders <h3>

// Body and captions
<Text variant="body">Normal paragraph text</Text> // renders <p>
<Text variant="caption">Caption text</Text>       // renders <span>
<Text variant="code">code("string")</Text>        // renders <code>
```

#### `Button`

Reusable button component with primary, secondary, and ghost variants.

| Prop      | Type                                      | Default     |
|-----------|-------------------------------------------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'ghost'`     | `'primary'` |
| `size`    | `'sm' \| 'md' \| 'lg'`                    | `'md'`      |
| `isLoading`| `boolean`                                | `false`     |
| `icon`    | `ReactNode`                               | `undefined` |
| `children`| `ReactNode`                               | `undefined` |
| `disabled`| `boolean`                                 | `false`     |

```tsx
import { Button } from "@hardlydifficult/storybook-components";

<Button variant="primary" onClick={() => {}}>
  Primary
</Button>

<Button variant="secondary" icon={<IconSearch />}>
  Secondary with icon
</Button>

<Button variant="ghost" size="sm" disabled>
  Disabled Ghost
</Button>
```

#### `Badge`

Renders semantic status indicators with colored dot indicators.

| Prop     | Type                                                   | Default     |
|----------|--------------------------------------------------------|-------------|
| `variant`| `'default' \| 'success' \| 'warning' \| 'error' \| 'info'` | `'default'` |
| `size`   | `'sm' \| 'md' \| 'lg'`                                 | `'md'`      |
| `children`| `ReactNode`                                           | —           |

```tsx
import { Badge } from "@hardlydifficult/storybook-components";

<Badge variant="default">Draft</Badge>
<Badge variant="success">Published</Badge>
<Badge variant="warning">Pending review</Badge>
<Badge variant="error">Draft error</Badge>
<Badge variant="info" size="sm">New</Badge>
```

#### `Card`

A flexible container with optional header and footer sections.

| Prop     | Type        | Default     |
|----------|-------------|-------------|
| `children`| `ReactNode`| —           |
| `title`  | `string`    | `undefined` |
| `footer` | `ReactNode` | `undefined` |
| `padding`| `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` |

```tsx
import { Card, Text } from "@hardlydifficult/storybook-components";

<Card title="Settings">
  <Text variant="body">Settings content here</Text>
</Card>

<Card
  title="Profile"
  footer={<Button>Save changes</Button>}
>
  <Text variant="body">Profile content</Text>
</Card>
```

#### `Stack`

A layout primitive for vertical/horizontal stacking with configurable gaps.

| Prop      | Type                                  | Default     |
|-----------|---------------------------------------|-------------|
| `direction`| `'vertical' \| 'horizontal'`         | `'vertical'`|
| `gap`     | `'none' \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'`      |
| `children`| `ReactNode[] \| ReactNode`            | —           |

```tsx
import { Stack, Button } from "@hardlydifficult/storybook-components";

<Stack direction="vertical" gap="md">
  <Button>One</Button>
  <Button>Two</Button>
</Stack>

<Stack direction="horizontal" gap="lg">
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Cancel</Button>
</Stack>
```

### Widgets

#### `ActivityFeed`

Renders chronological events with avatars, status indicators, and relative timestamps.

| Prop             | Type                                                                                                                 | Default                    |
|------------------|----------------------------------------------------------------------------------------------------------------------|----------------------------|
| `events`         | `Array<{ id: string; message: string; timestamp: Date; status: 'success' \| 'error' \| 'warning' \| 'info' \| 'pending'; actor?: { name: string; avatar?: string }; detail?: string }>` | —                          |
| `emptyMessage`   | `ReactNode`                                                                                                          | `'No recent activity'`     |
| `showSystemEvents`| `boolean`                                                                                                           | `false`                    |
| `title`          | `string`                                                                                                             | `undefined`                |

```tsx
import { ActivityFeed, type ActivityEvent } from "@hardlydifficult/storybook-components";

const events: ActivityEvent[] = [
  {
    id: "1",
    message: "Deployment completed",
    timestamp: new Date(),
    status: "success",
    actor: { name: "Alice" },
    detail: "prod-2024-04"
  },
  {
    id: "2",
    message: "Build failed",
    timestamp: new Date(Date.now() - 86400000),
    status: "error",
    detail: "unit-tests"
  }
];

<ActivityFeed events={events} title="Recent Activity" />
```

#### `NotificationToast`

Dismissable notification toasts with status-specific styling.

| Prop       | Type                                    | Default     |
|------------|-----------------------------------------|-------------|
| `variant`  | `'success' \| 'error' \| 'warning' \| 'info'` | —           |
| `title`    | `string`                                | `undefined` |
| `message`  | `string`                                | `undefined` |
| `onDismiss`| `() => void`                            | `undefined` |
| `action`   | `{ label: string; onClick: () => void }`| `undefined` |

```tsx
import { NotificationToast } from "@hardlydifficult/storybook-components";

<NotificationToast
  variant="success"
  title="Deployment successful"
  message="Your changes are now live."
  onDismiss={() => console.log("Dismissed")}
  action={{ label: "View", onClick: () => {} }}
/>
```

#### `ProgressBar`

Renders a linear progress bar with optional label and dynamic color.

| Prop  | Type     | Default     |
|-------|----------|-------------|
| `value`| `number` | —           |
| `label`| `string` | `undefined` |

```tsx
import { ProgressBar } from "@hardlydifficult/storybook-components";

<ProgressBar value={75} label="Upload progress" />
<ProgressBar value={100} /> // Auto-colors green
```

#### `StatCard`

Renders metric cards with optional trend indicator (up/down icon and percentage).

| Prop     | Type               | Default     |
|----------|--------------------|-------------|
| `label`  | `string`           | —           |
| `value`  | `string \| number` | —           |
| `trend`  | `number`           | `undefined` |
| `caption`| `string`           | `undefined` |

```tsx
import { StatCard } from "@hardlydifficult/storybook-components";

<StatCard label="Revenue" value="$12,345" trend={12} caption="vs last month" />
<StatCard label="Error rate" value="0.4%" trend={-2} />
<StatCard label="Users" value="1,024" />
```

#### `UserCard`

User profile card with deterministic avatar, status indicator, and optional action.

| Prop     | Type                                    | Default     |
|----------|-----------------------------------------|-------------|
| `name`   | `string`                                | —           |
| `role`   | `string`                                | —           |
| `status` | `'online' \| 'away' \| 'offline'`       | `undefined` |
| `action` | `{ label: string; onClick: () => void }`| `undefined` |

```tsx
import { UserCard } from "@hardlydifficult/storybook-components";

<UserCard name="Alice Johnson" role="Product Manager" status="online" />
<UserCard
  name="Bob Smith"
  role="Developer"
  status="away"
  action={{ label: "Message", onClick: () => {} }}
/>
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