"use client";

import {
  type CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Public types (unchanged)
// ---------------------------------------------------------------------------

export interface CandlestickChartCandle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandlestickChartOrder {
  id: string;
  side: "buy" | "sell";
  price: number;
  sizeUsd: number;
}

export interface CandlestickChartProps {
  candles: CandlestickChartCandle[];
  orders?: CandlestickChartOrder[];
  currentPrice?: number;
  height?: number;
  /** Initial number of visible candles (default: 60) */
  visibleCandles?: number;
}

// ---------------------------------------------------------------------------
// Theme constants
// ---------------------------------------------------------------------------

const COLORS = {
  success: "#22c55e",
  error: "#ef4444",
  info: "#3b82f6",
  textSecondary: "#9ca3af",
  border: "#374151",
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Canvas-based candlestick chart using lightweight-charts. */
export function CandlestickChart({
  candles,
  orders,
  currentPrice,
  height = 300,
  visibleCandles: initialVisibleCandles = 60,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el === null) {return;}

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: COLORS.textSecondary,
        fontFamily: "monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: COLORS.border },
        horzLines: { color: COLORS.border },
      },
      crosshair: {
        mode: 0, // Normal
      },
      rightPriceScale: {
        borderColor: COLORS.border,
      },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.success,
      downColor: COLORS.error,
      borderUpColor: COLORS.success,
      borderDownColor: COLORS.error,
      wickUpColor: COLORS.success,
      wickDownColor: COLORS.error,
    });
    seriesRef.current = series;

    // Set data
    const data: CandlestickData<UTCTimestamp>[] = candles.map((c) => ({
      time: (c.ts / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    series.setData(data);

    // Current price line
    if (currentPrice !== undefined) {
      series.createPriceLine({
        price: currentPrice,
        color: COLORS.info,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      });
    }

    // Order lines
    if (orders !== undefined) {
      for (const order of orders) {
        const color = order.side === "buy" ? COLORS.success : COLORS.error;
        series.createPriceLine({
          price: order.price,
          color,
          lineWidth: 1,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `${order.side.toUpperCase()} $${order.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        });
      }
    }

    // Set visible range to last N candles
    if (candles.length > 0) {
      const visibleCount = Math.min(initialVisibleCandles, candles.length);
      const from = candles.length - visibleCount;
      chart.timeScale().setVisibleLogicalRange({
        from,
        to: candles.length - 1,
      });
    }

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [candles, orders, currentPrice, height, initialVisibleCandles]);

  if (candles.length === 0) {
    return (
      <div
        style={{
          height: `${String(height)}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          fontFamily: "monospace",
          fontSize: "12px",
          background: "var(--color-bg-muted)",
          borderRadius: "var(--radius-md)",
        }}
      >
        No candle data
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%" }} />;
}
