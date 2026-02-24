import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../src/index.js";

const meta: Meta<typeof Input> = {
  title: "Inputs/Input",
  component: Input,
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return <Input value={value} onChange={setValue} placeholder="Enter text..." />;
  },
};

export const Small: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return <Input value={value} onChange={setValue} placeholder="Small input" size="sm" />;
  },
};

export const Multiline: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return <Input value={value} onChange={setValue} placeholder="Write a description..." multiline rows={4} />;
  },
};

export const MonospaceMultiline: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return <Input value={value} onChange={setValue} placeholder="{ }" multiline rows={6} mono />;
  },
};
