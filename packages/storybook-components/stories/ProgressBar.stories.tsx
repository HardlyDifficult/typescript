import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressBar } from "../src/index.js";

const meta: Meta<typeof ProgressBar> = {
  title: "Widgets/ProgressBar",
  component: ProgressBar,
};
export default meta;

type Story = StoryObj<typeof ProgressBar>;

export const InProgress: Story = {
  render: () => (
    <ProgressBar value={62} label="Deploying to production" />
  ),
};

export const Complete: Story = {
  render: () => (
    <ProgressBar value={100} label="Build complete" />
  ),
};

export const Starting: Story = {
  render: () => (
    <ProgressBar value={8} label="Uploading assets" />
  ),
};

export const NoLabel: Story = {
  render: () => (
    <ProgressBar value={45} />
  ),
};
