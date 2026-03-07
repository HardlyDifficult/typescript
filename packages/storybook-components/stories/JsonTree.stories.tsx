import type { Meta, StoryObj } from "@storybook/react-vite";
import { JsonTree } from "../src/index.js";

const meta: Meta<typeof JsonTree> = {
  title: "Data/JsonTree",
  component: JsonTree,
  argTypes: {
    label: { control: "text" },
    defaultExpandDepth: { control: { type: "range", min: 0, max: 5, step: 1 } },
  },
};
export default meta;

type Story = StoryObj<typeof JsonTree>;

export const Default: Story = {
  args: {
    data: {
      name: "workflow-123",
      status: "running",
      steps: 4,
      enabled: true,
      error: null,
    },
    defaultExpandDepth: 1,
  },
};

export const NestedData: Story = {
  args: {
    data: {
      workflow: {
        id: "wf-abc",
        status: "completed",
        tasks: [
          { name: "plan", status: "completed", durationMs: 1200 },
          { name: "code", status: "completed", durationMs: 8500 },
          { name: "test", status: "running", durationMs: 3200 },
        ],
        config: {
          model: "claude-sonnet-4-6",
          maxSteps: 20,
          tools: ["read_file", "write_file", "bash"],
        },
      },
      metadata: {
        triggeredBy: "discord",
        repo: "HardlyDifficult/ai",
        branch: "feature/chat-ui",
        cost: 0.0042,
      },
    },
    defaultExpandDepth: 1,
  },
};

