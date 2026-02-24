import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../src/index.js";

const meta: Meta<typeof Checkbox> = {
  title: "Inputs/Checkbox",
  component: Checkbox,
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return <Checkbox checked={checked} onChange={setChecked} label="Enable notifications" />;
  },
};

export const Checked: Story = {
  render: () => {
    const [checked, setChecked] = useState(true);
    return <Checkbox checked={checked} onChange={setChecked} label="Auto-deploy" />;
  },
};
