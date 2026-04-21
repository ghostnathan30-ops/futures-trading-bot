"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode, LineStyle, CandlestickSeries, LineSeries } from "lightweight-charts";

interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number; }

interface Props {
  instrument: string;
  contract: string;
  bars: Bar[];
  vwap: { time: number; value: number }[];
  vwapUpper1: { time: number; value: number }[];
  vwapLower1: { time: number; value: number }[];
  ema20: { time: number; value: number }[];
  ema50: { time: number; value: number }[];
  ibHigh?: number;
  ibLow?: number;
  poc?: number;
}

const C = {
  surface: "#080B12", border: "#1A2035", muted: "#8892B0", dim: "#3D4760",
  gold: "#C9A84C", green: "#00E5A0", red: "#FF3A5C",
};

export default function InstrumentChart({
  instrument, contract, bars, vwap, vwapUpper1, vwapLower1,
  ema20, ema50, ibHigh, ibLow, poc,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tf, setTf] = useState("1h");

  useEffect(() => {
    if (!ref.current) return;

    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: C.surface },
        textColor: C.muted,
      },
      grid: {
        vertLines: { color: "#0D1018" },
        horzLines: { color: "#0D1018" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: C.border },
      timeScale: { borderColor: C.border, timeVisible: true },
      width: ref.current.clientWidth,
      height: ref.current.clientHeight || 280,
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: C.green, downColor: C.red,
      borderUpColor: C.green, borderDownColor: C.red,
      wickUpColor: C.green, wickDownColor: C.red,
    });
    candles.setData(bars);

    const vwapLine = chart.addSeries(LineSeries, { color: C.gold, lineWidth: 2, title: "VWAP" });
    vwapLine.setData(vwap);

    const upper1 = chart.addSeries(LineSeries, { color: "rgba(201,168,76,0.35)", lineWidth: 1, lineStyle: LineStyle.Dashed });
    upper1.setData(vwapUpper1);
    const lower1 = chart.addSeries(LineSeries, { color: "rgba(201,168,76,0.35)", lineWidth: 1, lineStyle: LineStyle.Dashed });
    lower1.setData(vwapLower1);

    const ema20Line = chart.addSeries(LineSeries, { color: "#4488FF", lineWidth: 1, title: "EMA20" });
    ema20Line.setData(ema20);
    const ema50Line = chart.addSeries(LineSeries, { color: "#8892B0", lineWidth: 1, title: "EMA50" });
    ema50Line.setData(ema50);

    if (poc) {
      const pocLine = chart.addSeries(LineSeries, {
        color: C.red, lineWidth: 1, lineStyle: LineStyle.Dotted, title: "POC",
      });
      pocLine.setData(bars.map(b => ({ time: b.time, value: poc })));
    }

    chartRef.current = chart;
    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [bars, vwap, vwapUpper1, vwapLower1, ema20, ema50, poc]);

  return (
    <div style={{ background: C.surface, display: "flex", flexDirection: "column", height: "100%", minHeight: 280 }}>
      {/* Timeframe selector */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "6px 10px", borderBottom: `1px solid ${C.border}`, gap: 4,
      }}>
        {["15m", "1h", "4h"].map(t => (
          <button key={t} onClick={() => setTf(t)}
            style={{
              padding: "2px 8px", borderRadius: 3, fontSize: 10,
              fontFamily: "JetBrains Mono", fontWeight: 600, cursor: "pointer",
              transition: "all 0.12s",
              background: tf === t ? "rgba(201,168,76,0.12)" : "transparent",
              border: `1px solid ${tf === t ? "rgba(201,168,76,0.3)" : "transparent"}`,
              color: tf === t ? C.gold : C.dim,
            }}>
            {t}
          </button>
        ))}
      </div>
      <div ref={ref} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
