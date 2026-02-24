import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "../src/index.js";

const meta: Meta<typeof Select> = {
  title: "Inputs/Select",
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("react");
    return (
      <Select
        value={value}
        onChange={setValue}
        options={[
          { value: "react", label: "React" },
          { value: "vue", label: "Vue" },
          { value: "svelte", label: "Svelte" },
        ]}
      />
    );
  },
};
