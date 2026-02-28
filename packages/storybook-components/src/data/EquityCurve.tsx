"use client";

import {
  BaselineSeries,
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

// ─── Public types (unchanged) ───────────────────────────────────────────────

export interface EquityCurvePoint {
  ts: number; // timestamp ms
  equityUsd: number;
}

export interface EquityCurveProps {
  snapshots: EquityCurvePoint[];
  height?: number;
  /** Initial number of visible points (default: all) */
  visiblePoints?: number;
  /** Label for the starting value baseline (default: none) */
  baselineLabel?: string;
}

// ─── Theme constants ────────────────────────────────────────────────────────

const COLORS = {
  success: "#22c55e",
  error: "#ef4444",
  textSecondary: "#9ca3af",
  border: "#374151",
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

/** Canvas-based equity curve using lightweight-charts BaselineSeries. */
export function EquityCurve({
  snapshots,
  height = 200,
  visiblePoints,
  baselineLabel,
}: EquityCurveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el === null || snapshots.length === 0) {return;}

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

    const startingValue = snapshots[0].equityUsd;

    const series = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: startingValue },
      topLineColor: COLORS.success,
      topFillColor1: `${COLORS.success}28`,
      topFillColor2: `${COLORS.success}05`,
      bottomLineColor: COLORS.error,
      bottomFillColor1: `${COLORS.error}05`,
      bottomFillColor2: `${COLORS.error}28`,
      lineWidth: 2,
    });

    series.setData(
      snapshots.map((s) => ({
        time: (s.ts / 1000) as UTCTimestamp,
        value: s.equityUsd,
      })),
    );

    // Baseline price line at starting equity
    if (baselineLabel !== undefined) {
      series.createPriceLine({
        price: startingValue,
        color: COLORS.textSecondary,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `${baselineLabel} $${startingValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      });
    }

    // Set visible range
    if (visiblePoints !== undefined && visiblePoints < snapshots.length) {
      const from = snapshots.length - visiblePoints;
      chart.timeScale().setVisibleLogicalRange({
        from,
        to: snapshots.length - 1,
      });
    } else {
      chart.timeScale().fitContent();
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
    };
  }, [snapshots, height, visiblePoints, baselineLabel]);

  if (snapshots.length === 0) {
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
        No data
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%" }} />;
}
