import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert } from "../src/index.js";

const meta: Meta<typeof Alert> = {
  title: "Feedback/Alert",
  component: Alert,
  argTypes: {
    variant: {
      control: "select",
      options: ["error", "info", "warning", "success"],
    },
    children: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  args: { variant: "error", children: "Build failed. Check the logs for details." },
};

export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Alert variant="error">Build failed. Check the logs for details.</Alert>
      <Alert variant="warning">Your API key expires in 3 days.</Alert>
      <Alert variant="success">Deployment completed successfully.</Alert>
      <Alert variant="info">A new version is available.</Alert>
    </div>
  ),
};
