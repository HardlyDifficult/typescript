import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "../src/index.js";

const meta: Meta<typeof Select> = {
  title: "Inputs/Select",
  component: Select,
  argTypes: {
    placeholder: { control: "text" },
    value: { control: false },
    onChange: { control: false },
    options: { control: false },
  },
};
export default meta;

type Story = StoryObj<typeof Select>;

const FRAMEWORK_OPTIONS = [
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "svelte", label: "Svelte" },
];

export const Default: Story = {
  args: {
    placeholder: undefined,
  },
  render: (args) => {
    const [value, setValue] = useState("react");
    return (
      <Select
        {...args}
        value={value}
        onChange={setValue}
        options={FRAMEWORK_OPTIONS}
      />
    );
  },
};

export const WithPlaceholder: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [value, setValue] = useState("");
    return (
      <Select
        value={value}
        onChange={setValue}
        placeholder="Choose a framework..."
        options={FRAMEWORK_OPTIONS}
      />
    );
  },
};
