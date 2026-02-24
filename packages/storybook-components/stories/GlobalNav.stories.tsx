import type { Meta, StoryObj } from "@storybook/react-vite";
import { GlobalNav } from "../src/index.js";
import { Badge } from "../src/index.js";
import { Stack } from "../src/index.js";

const NAV_CATEGORIES = [
  {
    label: "Store",
    items: [
      { href: "/", label: "Home" },
      { href: "/products", label: "Products" },
      { href: "/orders", label: "Orders" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/campaigns", label: "Campaigns" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/team", label: "Team" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

const meta: Meta<typeof GlobalNav> = {
  title: "Navigation/GlobalNav",
  component: GlobalNav,
  parameters: { layout: "fullscreen" },
  args: {
    title: "Acme Store",
    categories: NAV_CATEGORIES,
    onSignOut: () => { alert("Sign out"); },
  },
};
export default meta;

type Story = StoryObj<typeof GlobalNav>;

export const Default: Story = {
  args: {
    currentPath: "/",
  },
};

export const WithIndicators: Story = {
  args: {
    currentPath: "/orders",
    indicators: (
      <Stack direction="horizontal" gap="sm" align="center">
        <Badge variant="success" size="sm">3 online</Badge>
        <Badge variant="default" size="sm">v2.1.0</Badge>
      </Stack>
    ),
  },
};

export const ActiveSubpage: Story = {
  args: {
    currentPath: "/campaigns",
  },
};

export const Minimal: Story = {
  args: {
    title: "Admin",
    categories: [
      {
        label: "Pages",
        items: [
          { href: "/", label: "Dashboard" },
          { href: "/users", label: "Users" },
        ],
      },
    ],
    currentPath: "/users",
  },
};
