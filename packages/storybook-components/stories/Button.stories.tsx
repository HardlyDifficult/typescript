import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../src/index.js";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: "primary", children: "Deploy" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Cancel" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Learn more" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Delete" },
};

export const Small: Story = {
  args: { variant: "primary", size: "sm", children: "Save" },
};

export const Disabled: Story = {
  args: { variant: "primary", disabled: true, children: "Processing..." },
};

// A simple inline SVG deploy/rocket icon
const DeployIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 1.5C9 1.5 12.5 3 12.5 7C12.5 9.5 10.5 12 7 12.5C3.5 12 1.5 9.5 1.5 7C1.5 3 5 1.5 7 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M7 4.5V7.5M7 7.5L5.5 6M7 7.5L8.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// A simple plus icon
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M7 2.5V11.5M2.5 7H11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const WithIcon: Story = {
  render: () => <Button icon={<DeployIcon />}>Deploy</Button>,
};

export const SecondaryWithIcon: Story = {
  render: () => <Button variant="secondary" icon={<PlusIcon />}>New branch</Button>,
};
