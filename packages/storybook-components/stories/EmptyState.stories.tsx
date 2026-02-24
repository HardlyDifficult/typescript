import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "../src/index.js";

const meta: Meta<typeof EmptyState> = {
  title: "Feedback/EmptyState",
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: "No sessions found",
    children: "Start a new session to see activity here.",
  },
};
