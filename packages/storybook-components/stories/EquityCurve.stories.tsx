import type { Meta, StoryObj } from "@storybook/react-vite";
import { EquityCurve, type EquityCurvePoint } from "../src/index.js";

const NOW = new Date("2025-01-01T12:00:00.000Z");

// ─── Seeded PRNG ──────────────────────────────────────────────────────────────

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
}

// ─── Data generator ───────────────────────────────────────────────────────────

function generateSnapshots(
  count: number,
  startEquity: number,
  startTime: number,
  rand: () => number,
  bias = 0.47,
): EquityCurvePoint[] {
  const points = [];
  let equity = startEquity;
  for (let i = 0; i < count; i++) {
    equity += (rand() - bias) * startEquity * 0.005;
    points.push({ ts: startTime + i * 300_000, equityUsd: equity });
  }
  return points;
}

// ─── Pre-generated data (module scope for stability across re-renders) ────────

const BASE_TIME = NOW.getTime();
const START_EQUITY = 10_000;

const snapshots200 = generateSnapshots(200, START_EQUITY, BASE_TIME, seededRandom(10));
const snapshotsProfitable = generateSnapshots(150, START_EQUITY, BASE_TIME, seededRandom(20), 0.42);
const snapshotsLosing = generateSnapshots(100, START_EQUITY, BASE_TIME, seededRandom(30), 0.55);
const snapshotsBaseline = generateSnapshots(200, START_EQUITY, BASE_TIME, seededRandom(40));

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof EquityCurve> = {
  title: "Data/EquityCurve",
  component: EquityCurve,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    snapshots: { control: "object" },
    height: { control: "number" },
    visiblePoints: { control: "number" },
    baselineLabel: { control: "text" },
  },
};
export default meta;

type Story = StoryObj<typeof EquityCurve>;

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    snapshots: snapshots200,
    height: 200,
  },
};

export const Profitable: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <EquityCurve
      snapshots={snapshotsProfitable}
      height={200}
    />
  ),
};

export const Losing: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <EquityCurve
      snapshots={snapshotsLosing}
      height={200}
    />
  ),
};

export const WithBaseline: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <EquityCurve
      snapshots={snapshotsBaseline}
      height={200}
      baselineLabel="Starting Capital"
    />
  ),
};
