import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Modal } from "../src/index.js";
import { Text } from "../src/index.js";
import { Button } from "../src/index.js";
import { Stack } from "../src/index.js";

const meta: Meta<typeof Modal> = {
  title: "Feedback/Modal",
  component: Modal,
};
export default meta;

type Story = StoryObj<typeof Modal>;

export const ConfirmAction: Story = {
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
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => { setOpen(true); }}>View Details</Button>
        {open && (
          <Modal title="Build Output" size="md" onClose={() => { setOpen(false); }}>
            <Stack direction="vertical" gap="sm">
              <Text variant="caption" color="muted">Build #482 completed in 34s</Text>
              <Text mono variant="body">
                Installing dependencies...{"\n"}
                Compiling 24 modules...{"\n"}
                Bundle size: 33.7 kB (gzip: 7.4 kB){"\n"}
                Build successful.
              </Text>
            </Stack>
          </Modal>
        )}
      </>
    );
  },
};

export const LargeContent: Story = {
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
