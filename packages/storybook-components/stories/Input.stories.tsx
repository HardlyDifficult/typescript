import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../src/index.js";

const meta: Meta<typeof Input> = {
  title: "Inputs/Input",
  component: Input,
  argTypes: {
    value: { control: "text" },
    placeholder: { control: "text" },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
    type: { control: "text" },
    multiline: { control: "boolean" },
  },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
    size: "md",
    multiline: false,
  },
  render: (args) => {
    const [value, setValue] = useState(args.value ?? "");
    return (
      <Input
        {...args}
        value={value}
        onChange={(v) => setValue(v)}
      />
    );
  },
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [sm, setSm] = useState("");
    const [md, setMd] = useState("");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "320px" }}>
        <Input value={sm} onChange={setSm} placeholder="Small input" size="sm" />
        <Input value={md} onChange={setMd} placeholder="Medium input" size="md" />
      </div>
    );
  },
};

export const Multiline: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [value, setValue] = useState("");
    return (
      <div style={{ maxWidth: "400px" }}>
        <Input value={value} onChange={setValue} placeholder="Write a description..." multiline />
      </div>
    );
  },
};
