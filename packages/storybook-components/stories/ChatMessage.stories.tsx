import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatMessage } from "../src/index.js";

const meta: Meta<typeof ChatMessage> = {
  title: "Content/ChatMessage",
  component: ChatMessage,
  argTypes: {
    variant: {
      control: "select",
      options: ["user", "bot"],
    },
    content: { control: "text" },
    timestamp: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof ChatMessage>;

export const Default: Story = {
  args: {
    content: "Can you check why CI is failing on the main branch?",
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    variant: "user",
  },
};

export const BotMessage: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <ChatMessage
      content="I found 3 failing tests in the auth module. The issue is a missing environment variable `AUTH_SECRET` in the CI config. I'll create a fix."
      timestamp={new Date(Date.now() - 60 * 1000).toISOString()}
      variant="bot"
    />
  ),
};

export const MultilineMessage: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <ChatMessage
      content={"Here's what I found:\n\n1. Test `auth.login` fails due to missing env var\n2. Test `auth.signup` times out\n3. Test `auth.reset` has a type error"}
      timestamp={new Date(Date.now() - 5 * 60 * 1000).toISOString()}
      variant="bot"
    />
  ),
};

export const Conversation: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxWidth: 600 }}>
      <ChatMessage
        content="What PRs are open right now?"
        timestamp={new Date(Date.now() - 10 * 60 * 1000).toISOString()}
        variant="user"
      />
      <ChatMessage
        content={"There are 3 open PRs:\n- #42 fix-auth-flow (ready for review)\n- #43 update-deps (CI failing)\n- #44 add-dashboard-chat (draft)"}
        timestamp={new Date(Date.now() - 9 * 60 * 1000).toISOString()}
        variant="bot"
      />
      <ChatMessage
        content="Can you review #42?"
        timestamp={new Date(Date.now() - 8 * 60 * 1000).toISOString()}
        variant="user"
      />
      <ChatMessage
        content="Starting code review for #42 fix-auth-flow..."
        timestamp={new Date(Date.now() - 7 * 60 * 1000).toISOString()}
        variant="bot"
      />
    </div>
  ),
};
