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
  argTypes: {
    title: { control: "text" },
    currentPath: {
      control: "select",
      options: ["/", "/products", "/orders", "/campaigns", "/analytics", "/team", "/settings"],
    },
    theme: {
      control: "radio",
      options: ["light", "dark"],
    },
    // Not meaningful to control in Storybook
    categories: { table: { disable: true } },
    indicators: { table: { disable: true } },
    renderLink: { table: { disable: true } },
    onSignOut: { table: { disable: true } },
    onToggleTheme: { table: { disable: true } },
  },
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
  parameters: { controls: { disable: true } },
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
  parameters: { controls: { disable: true } },
  args: {
    currentPath: "/campaigns",
  },
};

export const Minimal: Story = {
  parameters: { controls: { disable: true } },
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
