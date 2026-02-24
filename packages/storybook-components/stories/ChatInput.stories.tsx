import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatInput } from "../src/index.js";

const meta: Meta<typeof ChatInput> = {
  title: "Inputs/ChatInput",
  component: ChatInput,
};
export default meta;

type Story = StoryObj<typeof ChatInput>;

export const Default: Story = {
  args: {
    onSend: (content) => { console.log("Send:", content); },
  },
};

export const WithContext: Story = {
  args: {
    onSend: (content) => { console.log("Send:", content); },
    contextLabel: "workflow: fix-ci-pipeline",
  },
};

export const CustomPlaceholder: Story = {
  args: {
    onSend: (content) => { console.log("Send:", content); },
    placeholder: "Reply to this workflow...",
    contextLabel: "session: ask-abc123",
  },
};

export const Disabled: Story = {
  args: {
    onSend: (content) => { console.log("Send:", content); },
    disabled: true,
    placeholder: "Connecting...",
  },
};
