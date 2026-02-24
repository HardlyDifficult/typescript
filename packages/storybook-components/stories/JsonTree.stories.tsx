import type { Meta, StoryObj } from "@storybook/react-vite";
import { JsonTree } from "../src/index.js";

const meta: Meta<typeof JsonTree> = {
  title: "Data/JsonTree",
  component: JsonTree,
  argTypes: {
    defaultExpandDepth: { control: { type: "range", min: 0, max: 5, step: 1 } },
  },
};
export default meta;

type Story = StoryObj<typeof JsonTree>;

export const SimpleObject: Story = {
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

export const FullyExpanded: Story = {
  args: {
    data: {
      request: {
        prompt: "Fix the CI pipeline",
        model: "claude-sonnet-4-6",
        tools: ["read_file", "bash"],
      },
      response: {
        text: "I found the issue in the test configuration.",
        tokens: { input: 1500, output: 420 },
      },
    },
    defaultExpandDepth: 5,
  },
};

export const FullyCollapsed: Story = {
  args: {
    data: {
      a: { b: { c: "deep" } },
      list: [1, 2, 3],
    },
    defaultExpandDepth: 0,
  },
};

export const WithLabel: Story = {
  args: {
    label: "Event Details",
    data: {
      requestId: "req-456",
      prompt: "Summarize the PR changes",
      response: "The PR adds a new chat interface to the dashboard.",
      inputTokens: 2400,
      outputTokens: 180,
      costUsd: 0.0018,
    },
    defaultExpandDepth: 1,
  },
};

export const ArrayRoot: Story = {
  args: {
    data: [
      { id: 1, name: "Alice", role: "admin" },
      { id: 2, name: "Bob", role: "user" },
      { id: 3, name: "Charlie", role: "user" },
    ],
    defaultExpandDepth: 1,
  },
};

export const PrimitiveValue: Story = {
  args: {
    data: "Just a string",
    defaultExpandDepth: 1,
  },
};
