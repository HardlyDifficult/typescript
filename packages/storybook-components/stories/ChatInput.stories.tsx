import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatInput } from "../src/index.js";

const meta: Meta<typeof ChatInput> = {
  title: "Inputs/ChatInput",
  component: ChatInput,
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    contextLabel: { control: "text" },
    onSend: { control: false },
  },
};
export default meta;

type Story = StoryObj<typeof ChatInput>;

export const Default: Story = {
  args: {
    onSend: (content) => { console.log("Send:", content); },
    placeholder: "Type a message...",
    disabled: false,
    contextLabel: undefined,
  },
};

export const WithContext: Story = {
  parameters: { controls: { disable: true } },
  args: {
    onSend: (content) => { console.log("Send:", content); },
    contextLabel: "workflow: fix-ci-pipeline",
  },
};

export const Disabled: Story = {
  parameters: { controls: { disable: true } },
  args: {
    onSend: (content) => { console.log("Send:", content); },
    disabled: true,
    placeholder: "Connecting...",
  },
};
