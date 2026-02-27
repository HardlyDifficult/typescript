import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Modal, Text, Button, Stack, CodeBlock } from "../src/index.js";

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

export const MediumContent: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => { setOpen(true); }}>View Details</Button>
        {open && (
          <Modal title="Build Output" size="md" onClose={() => { setOpen(false); }}>
            <Stack direction="vertical" gap="sm">
              <Text variant="caption" color="muted">Build #482 completed in 34s</Text>
              <CodeBlock language="text">
                {`Installing dependencies...\nCompiling 24 modules...\nBundle size: 33.7 kB (gzip: 7.4 kB)\nBuild successful.`}
              </CodeBlock>
            </Stack>
          </Modal>
        )}
      </>
    );
  },
};

export const LargeContent: Story = {
  parameters: { controls: { disable: true } },
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => { setOpen(true); }}>Open Editor</Button>
        {open && (
          <Modal title="Edit Configuration" size="lg" onClose={() => { setOpen(false); }}>
            <Text variant="caption" color="muted">
              The lg size takes most of the viewport, suited for editors or long-form content.
            </Text>
          </Modal>
        )}
      </>
    );
  },
};
