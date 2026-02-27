import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "../src/index.js";

const meta: Meta<typeof Tabs> = {
  title: "Navigation/Tabs",
  component: Tabs,
  argTypes: {
    tabs: { control: "object" },
  },
};
export default meta;

type Story = StoryObj<typeof Tabs>;

const DEFAULT_TABS = [
  { value: "overview", label: "Overview" },
  { value: "activity", label: "Activity" },
  { value: "settings", label: "Settings" },
];

export const Default: Story = {
  args: {
    tabs: DEFAULT_TABS,
  },
  render: (args) => {
    const [value, setValue] = useState(args.tabs[0]?.value ?? "");
    return <Tabs tabs={args.tabs} value={value} onChange={setValue} />;
  },
};

export const ManyTabs: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [value, setValue] = useState("overview");
    return (
      <Tabs
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "activity", label: "Activity" },
          { value: "settings", label: "Settings" },
          { value: "logs", label: "Logs" },
          { value: "metrics", label: "Metrics" },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  },
};
