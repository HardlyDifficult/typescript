import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserCard } from "../src/index.js";

const meta: Meta<typeof UserCard> = {
  title: "Widgets/UserCard",
  component: UserCard,
};
export default meta;

type Story = StoryObj<typeof UserCard>;

export const Online: Story = {
  render: () => (
    <UserCard
      name="Alice Chen"
      role="Senior Engineer"
      status="online"
      action={{ label: "View profile", onClick: () => {} }}
    />
  ),
};

export const Away: Story = {
  render: () => (
    <UserCard
      name="Jordan Liu"
      role="Product Manager"
      status="away"
    />
  ),
};

export const Offline: Story = {
  render: () => (
    <UserCard
      name="Sam Park"
      role="Designer"
      status="offline"
      action={{ label: "Send message", onClick: () => {} }}
    />
  ),
};

export const NoStatus: Story = {
  render: () => (
    <UserCard
      name="Morgan Taylor"
      role="Engineering Manager"
    />
  ),
};
