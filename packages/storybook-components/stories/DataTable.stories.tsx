import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataTable } from "../src/index.js";
import { Badge } from "../src/index.js";

const meta: Meta<typeof DataTable> = {
  title: "Data/DataTable",
  component: DataTable,
  argTypes: {
    columns: { control: "object" },
    rows: { control: "object" },
    selectable: { control: "boolean" },
    empty: { control: "text" },
    onSelectionChange: { action: "onSelectionChange" },
  },
};
export default meta;

type Story = StoryObj<typeof DataTable>;

const sampleRows = [
  { id: "1", name: "Alice", role: "Engineer", status: "Active" },
  { id: "2", name: "Bob", role: "Designer", status: "Away" },
  { id: "3", name: "Charlie", role: "PM", status: "Active" },
];

export const Default: Story = {
  args: {
    rows: sampleRows,
  },
};

export const CustomColumns: Story = {
  parameters: { controls: { disable: true } },
  args: {
    rows: sampleRows,
    columns: [
      "name",
      "role",
      {
        key: "status",
        cell: (row) => (
          <Badge variant={row.status === "Active" ? "success" : "default"}>
            {String(row.status)}
          </Badge>
        ),
      },
    ],
  },
};

export const Empty: Story = {
  parameters: { controls: { disable: true } },
  args: {
    columns: ["name", "role"],
    rows: [],
    empty: "No team members found",
  },
};
