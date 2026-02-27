import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "../src/index.js";

const meta: Meta<typeof EmptyState> = {
  title: "Feedback/EmptyState",
  component: EmptyState,
  argTypes: {
    title: { control: "text" },
    children: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: "No sessions found",
    children: "Start a new session to see activity here.",
  },
};

export const WithIcon: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <EmptyState icon="📭" title="No messages" >
      You're all caught up. New messages will appear here.
    </EmptyState>
  ),
};
