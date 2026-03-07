"use client";

import {
  AreaSeries,
  BarSeries,
  type CandlestickData,
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  LineSeries,
  type LineData,
  type BarData,
  type AreaData,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Public types (unchanged)
// ---------------------------------------------------------------------------

export type CandlestickChartType = "candlestick" | "line" | "area" | "bar";

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
  /** Chart series type (default: "candlestick") */
  type?: CandlestickChartType;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addSeriesForType(
  chart: IChartApi,
  type: CandlestickChartType,
  candles: CandlestickChartCandle[],
) {
  const time = (c: CandlestickChartCandle) => (c.ts / 1000) as UTCTimestamp;

  if (type === "line") {
    const s = chart.addSeries(LineSeries, { color: COLORS.info });
    const data: LineData<UTCTimestamp>[] = candles.map((c) => ({
      time: time(c),
      value: c.close,
    }));
    s.setData(data);
    return s;
  }

  if (type === "area") {
    const s = chart.addSeries(AreaSeries, {
      lineColor: COLORS.info,
      topColor: "rgba(59,130,246,0.3)",
      bottomColor: "rgba(59,130,246,0)",
    });
    const data: AreaData<UTCTimestamp>[] = candles.map((c) => ({
      time: time(c),
      value: c.close,
    }));
    s.setData(data);
    return s;
  }

  if (type === "bar") {
    const s = chart.addSeries(BarSeries, {
      upColor: COLORS.success,
      downColor: COLORS.error,
    });
    const data: BarData<UTCTimestamp>[] = candles.map((c) => ({
      time: time(c),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    s.setData(data);
    return s;
  }

  // default: candlestick
  const s = chart.addSeries(CandlestickSeries, {
    upColor: COLORS.success,
    downColor: COLORS.error,
    borderUpColor: COLORS.success,
    borderDownColor: COLORS.error,
    wickUpColor: COLORS.success,
    wickDownColor: COLORS.error,
  });
  const data: CandlestickData<UTCTimestamp>[] = candles.map((c) => ({
    time: time(c),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
  s.setData(data);
  return s;
}

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
  type: initialType = "candlestick",
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const [activeType, setActiveType] = useState<CandlestickChartType>(initialType);

  // Create chart once (or when layout-affecting props change)
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
  }, [height]);

  // Swap series whenever data, type, orders, or currentPrice changes
  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) {return;}

    // Remove existing series
    if (seriesRef.current !== null) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    if (candles.length === 0) {return;}

    const series = addSeriesForType(chart, activeType, candles);
    seriesRef.current = series;

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
    const visibleCount = Math.min(initialVisibleCandles, candles.length);
    const from = candles.length - visibleCount;
    chart.timeScale().setVisibleLogicalRange({
      from,
      to: candles.length - 1,
    });
  }, [candles, orders, currentPrice, initialVisibleCandles, activeType]);

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

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Type selector overlay */}
      <select
        value={activeType}
        onChange={(e) => { setActiveType(e.target.value as CandlestickChartType); }}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          zIndex: 10,
          background: "#1f2937",
          color: COLORS.textSecondary,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 4,
          padding: "2px 4px",
          fontSize: 11,
          fontFamily: "monospace",
          cursor: "pointer",
          outline: "none",
        }}
      >
        <option value="candlestick">Candlestick</option>
        <option value="line">Line</option>
        <option value="area">Area</option>
        <option value="bar">Bar</option>
      </select>
      <div ref={containerRef} style={{ width: "100%" }} />
    </div>
  );
}
