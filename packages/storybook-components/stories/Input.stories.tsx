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

