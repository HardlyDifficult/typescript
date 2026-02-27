import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../src/index.js";

const meta: Meta<typeof Checkbox> = {
  title: "Inputs/Checkbox",
  component: Checkbox,
  argTypes: {
    checked: { control: "boolean" },
    label: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {
    checked: false,
    label: "Enable notifications",
  },
  render: (args) => {
    const [checked, setChecked] = useState(args.checked ?? false);
    return (
      <Checkbox
        {...args}
        checked={checked}
        onChange={(v) => setChecked(v)}
      />
    );
  },
};

export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Checkbox checked={false} onChange={() => {}} label="Unchecked" />
      <Checkbox checked={true} onChange={() => {}} label="Checked" />
      <Checkbox checked={false} onChange={() => {}} />
      <Checkbox checked={true} onChange={() => {}} />
    </div>
  ),
};
