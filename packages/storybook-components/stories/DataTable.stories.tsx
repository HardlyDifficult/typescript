import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataTable } from "../src/index.js";

const meta: Meta<typeof DataTable> = {
  title: "Data/DataTable",
  component: DataTable,
  argTypes: {
    columns: { control: "object" },
    rows: { control: "object" },
    rowKey: { control: "text" },
    selectable: { control: "boolean" },
    emptyMessage: { control: "text" },
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
    columns: [
      { key: "name", header: "Name" },
      { key: "role", header: "Role" },
      { key: "status", header: "Status" },
    ],
    rows: sampleRows,
    rowKey: "id",
  },
};

export const Selectable: Story = {
  parameters: { controls: { disable: true } },
  args: {
    columns: [
      { key: "name", header: "Name" },
      { key: "role", header: "Role" },
    ],
    rows: sampleRows,
    rowKey: "id",
    selectable: true,
  },
};

export const Empty: Story = {
  parameters: { controls: { disable: true } },
  args: {
    columns: [
      { key: "name", header: "Name" },
      { key: "role", header: "Role" },
    ],
    rows: [],
    rowKey: "id",
    emptyMessage: "No team members found",
  },
};
