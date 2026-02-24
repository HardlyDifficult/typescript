import type { Meta, StoryObj } from "@storybook/react-vite";
import { Collapsible } from "../src/index.js";
import { Text } from "../src/index.js";
import { Button } from "../src/index.js";

const meta: Meta<typeof Collapsible> = {
  title: "Navigation/Collapsible",
  component: Collapsible,
};
export default meta;

type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  args: {
    title: "Advanced Settings",
    children: <Text>Hidden content is revealed when expanded.</Text>,
  },
};

export const DefaultOpen: Story = {
  args: {
    title: "Build Details",
    defaultOpen: true,
    children: <Text>This section starts open.</Text>,
  },
};

export const WithActions: Story = {
  render: () => (
    <Collapsible
      title="Deployment Log"
      actions={<Button variant="ghost" size="sm">Clear</Button>}
    >
      <Text>Log entries would appear here.</Text>
    </Collapsible>
  ),
};
