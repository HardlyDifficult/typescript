import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert } from "../src/index.js";

const meta: Meta<typeof Alert> = {
  title: "Feedback/Alert",
  component: Alert,
};
export default meta;

type Story = StoryObj<typeof Alert>;

export const Error: Story = {
  args: { variant: "error", children: "Build failed. Check the logs for details." },
};

export const Warning: Story = {
  args: { variant: "warning", children: "Your API key expires in 3 days." },
};

export const Success: Story = {
  args: { variant: "success", children: "Deployment completed successfully." },
};

export const Info: Story = {
  args: { variant: "info", children: "A new version is available." },
};
