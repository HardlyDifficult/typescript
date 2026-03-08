# @hardlydifficult/storybook-components

Opinionated React components for internal tools. The goal is expressive client code, not maximum flexibility.

## Installation

```bash
npm install @hardlydifficult/storybook-components
```

## Design Principles

- Layout components use the same header vocabulary: `title`, `description`, `actions`.
- Tables are row-first. If rows already look like table data, they should render without extra wiring.
- Defaults should match the obvious case. Extra props exist to clarify intent, not to make every decision configurable.

## Quick Start

```tsx
import {
  Badge,
  Button,
  DataTable,
  Page,
  Section,
  Stack,
} from "@hardlydifficult/storybook-components";

const team = [
  { id: "1", name: "Alice", role: "Engineer", status: "Active" },
  { id: "2", name: "Bob", role: "Designer", status: "Away" },
];

export function Example() {
  return (
    <Page
      title="Team"
      description="The page shell handles spacing and header layout."
      actions={<Button size="sm">Invite</Button>}
    >
      <Stack gap="md">
        <Section
          title="Members"
          description="`Section` uses the same header prop names as `Page`."
        >
          <DataTable
            rows={team}
            columns={[
              "name",
              "role",
              {
                key: "status",
                cell: (member) => (
                  <Badge
                    variant={member.status === "Active" ? "success" : "default"}
                  >
                    {String(member.status)}
                  </Badge>
                ),
              },
            ]}
          />
        </Section>
      </Stack>
    </Page>
  );
}
```

## Components

### `Page`

Use `Page` for the outer app shell.

```tsx
<Page
  title="Deployments"
  description="Recent production activity"
  actions={<Button size="sm">Ship</Button>}
>
  {content}
</Page>
```

### `Section`

Use `Section` to group related content inside a page.

```tsx
<Section
  title="Queue"
  description="Last 30 minutes"
  actions={
    <Button variant="ghost" size="sm">
      Refresh
    </Button>
  }
>
  {content}
</Section>
```

### `DataTable`

`DataTable` assumes rows have an `id`. Columns are optional:

- Omit `columns` to infer them from the first row.
- Use string keys for straightforward columns.
- Use `{ key, label?, cell? }` when one column needs custom rendering.
- Selection callbacks return the selected rows, not just their ids.

```tsx
<DataTable rows={rows} />

<DataTable
  rows={rows}
  columns={[
    "name",
    "role",
    { key: "status", cell: (row) => <Badge>{String(row.status)}</Badge> },
  ]}
  selectable
  onSelectionChange={(selectedRows) => {
    console.log(selectedRows);
  }}
/>
```

## Local Development

```bash
npm install
npm --workspace @hardlydifficult/storybook-components run storybook
```

## Build

```bash
npm --workspace @hardlydifficult/storybook-components run build
npm --workspace @hardlydifficult/storybook-components run lint
```
