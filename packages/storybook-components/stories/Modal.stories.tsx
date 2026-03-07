import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Modal, Text, Button, Stack } from "../src/index.js";

const meta: Meta<typeof Modal> = {
  title: "Feedback/Modal",
  component: Modal,
  argTypes: {
    title: { control: "text" },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "full"],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Modal>;

export const Default: Story = {
  args: {
    title: "Modal Title",
    size: "md",
  },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => { setOpen(true); }}>Open Modal</Button>
        {open && (
          <Modal {...args} onClose={() => { setOpen(false); }}>
            <Text>Modal content goes here.</Text>
          </Modal>
        )}
      </>
    );
  },
};

export const ConfirmAction: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => { setOpen(true); }}>Open Modal</Button>
        {open && (
          <Modal title="Confirm Action" size="sm" onClose={() => { setOpen(false); }}>
            <Stack direction="vertical" gap="md">
              <Text>Are you sure you want to delete this workflow? This cannot be undone.</Text>
              <Stack direction="horizontal" gap="sm" align="center">
                <Button variant="danger">Delete</Button>
                <Button variant="secondary" onClick={() => { setOpen(false); }}>Cancel</Button>
              </Stack>
            </Stack>
          </Modal>
        )}
      </>
    );
  },
};

