import type { Meta, StoryObj } from "@storybook/react-vite";
import { NotificationToast } from "../src/index.js";

const meta: Meta<typeof NotificationToast> = {
  title: "Widgets/NotificationToast",
  component: NotificationToast,
};
export default meta;

type Story = StoryObj<typeof NotificationToast>;

export const Success: Story = {
  render: () => (
    <NotificationToast
      variant="success"
      title="Deployment successful"
      message="v2.4.1 is live on production."
      onDismiss={() => {}}
    />
  ),
};

export const Error: Story = {
  render: () => (
    <NotificationToast
      variant="error"
      title="Build failed"
      message="Exit code 1 — test suite timed out after 30s."
      onDismiss={() => {}}
      action={{ label: "View logs", onClick: () => {} }}
    />
  ),
};

export const Warning: Story = {
  render: () => (
    <NotificationToast
      variant="warning"
      title="Disk space low"
      message="Storage is at 87% capacity on us-east-1."
      action={{ label: "Manage storage", onClick: () => {} }}
    />
  ),
};

export const Info: Story = {
  render: () => (
    <NotificationToast
      variant="info"
      title="New version available"
      message="Claude Code 1.4 is ready to install."
      onDismiss={() => {}}
      action={{ label: "Update now", onClick: () => {} }}
    />
  ),
};
