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

