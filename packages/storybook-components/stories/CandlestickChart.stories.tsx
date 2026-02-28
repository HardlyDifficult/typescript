import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CandlestickChart,
  type CandlestickChartCandle,
  type CandlestickChartOrder,
} from "../src/index.js";

const NOW = new Date("2025-01-01T12:00:00.000Z");

// ─── Seeded PRNG ──────────────────────────────────────────────────────────────

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
}

// ─── Data generator ───────────────────────────────────────────────────────────

function generateCandles(
  count: number,
  basePrice: number,
  startTime: number,
  rand: () => number,
): CandlestickChartCandle[] {
  const candles = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const open = price;
    const change = (rand() - 0.48) * basePrice * 0.02; // slight upward bias
    const close = open + change;
    const high = Math.max(open, close) + rand() * basePrice * 0.005;
    const low = Math.min(open, close) - rand() * basePrice * 0.005;
    candles.push({
      ts: startTime + i * 300_000,
      open,
      high,
      low,
      close,
      volume: rand() * 100,
    });
    price = close;
  }
  return candles;
}

// ─── Pre-generated data (module scope for stability across re-renders) ────────

const BASE_TIME = NOW.getTime();
const BASE_PRICE = 2500;

const candles120 = generateCandles(120, BASE_PRICE, BASE_TIME, seededRandom(1));
const candles80 = generateCandles(80, BASE_PRICE, BASE_TIME, seededRandom(2));
const candles200 = generateCandles(200, BASE_PRICE, BASE_TIME, seededRandom(3));
const candles15 = generateCandles(15, BASE_PRICE, BASE_TIME, seededRandom(4));

// Orders spread around the mid price of candles80
const midPrice = (candles80[39].high + candles80[39].low) / 2;
const orders: CandlestickChartOrder[] = [
  { id: "buy-1", side: "buy", price: midPrice * 0.995, sizeUsd: 500 },
  { id: "buy-2", side: "buy", price: midPrice * 0.990, sizeUsd: 1000 },
  { id: "buy-3", side: "buy", price: midPrice * 0.983, sizeUsd: 750 },
  { id: "sell-1", side: "sell", price: midPrice * 1.005, sizeUsd: 500 },
  { id: "sell-2", side: "sell", price: midPrice * 1.010, sizeUsd: 1000 },
  { id: "sell-3", side: "sell", price: midPrice * 1.018, sizeUsd: 750 },
];
const currentPrice80 = candles80[candles80.length - 1].close;

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof CandlestickChart> = {
  title: "Data/CandlestickChart",
  component: CandlestickChart,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    candles: { control: "object" },
    height: { control: "number" },
    visibleCandles: { control: "number" },
    currentPrice: { control: "number" },
    orders: { control: "object" },
  },
};
export default meta;

type Story = StoryObj<typeof CandlestickChart>;

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    candles: candles120,
    height: 300,
  },
};

export const WithOrders: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <CandlestickChart
      candles={candles80}
      orders={orders}
      currentPrice={currentPrice80}
      height={300}
    />
  ),
};

export const ZoomedIn: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <CandlestickChart
      candles={candles200}
      visibleCandles={30}
      height={300}
    />
  ),
};

export const FewCandles: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <CandlestickChart
      candles={candles15}
      height={300}
    />
  ),
};
