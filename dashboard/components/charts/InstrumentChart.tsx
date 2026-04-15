"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CrosshairMode, LineStyle } from "lightweight-charts";

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

export default function InstrumentChart({
  instrument, contract, bars, vwap, vwapUpper1, vwapLower1,
  ema20, ema50, ibHigh, ibLow, poc,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [tf, setTf] = useState("15m");

  useEffect(() => {
    if (!ref.current) return;

    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#1A1D24" },
        textColor: "#8B949E",
      },
      grid: {
        vertLines: { color: "#21262D" },
        horzLines: { color: "#21262D" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#30363D" },
      timeScale: { borderColor: "#30363D", timeVisible: true },
      width: ref.current.clientWidth,
      height: ref.current.clientHeight,
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#00FF88", downColor: "#FF4444",
      borderUpColor: "#00FF88", borderDownColor: "#FF4444",
      wickUpColor: "#00FF88", wickDownColor: "#FF4444",
    });
    candles.setData(bars);

    const vwapLine = chart.addLineSeries({ color: "#F0A500", lineWidth: 2, title: "VWAP" });
    vwapLine.setData(vwap);

    const upper1 = chart.addLineSeries({ color: "rgba(240,165,0,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed });
    upper1.setData(vwapUpper1);
    const lower1 = chart.addLineSeries({ color: "rgba(240,165,0,0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed });
    lower1.setData(vwapLower1);

    const ema20Line = chart.addLineSeries({ color: "#2E7D9E", lineWidth: 1, title: "EMA20" });
    ema20Line.setData(ema20);
    const ema50Line = chart.addLineSeries({ color: "#A8B2C1", lineWidth: 1, title: "EMA50" });
    ema50Line.setData(ema50);

    if (poc) {
      const pocLine = chart.addLineSeries({ color: "#FF4444", lineWidth: 1, lineStyle: LineStyle.Dotted, title: "POC" });
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
    <div className="bg-[#1A1D24] border border-[#30363D] rounded flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363D]">
        <div>
          <span className="text-[#E6EDF3] font-medium text-sm">{instrument}</span>
          <span className="text-[#8B949E] text-xs ml-2">{contract}</span>
        </div>
        <div className="flex gap-1">
          {["1m","5m","15m","1h"].map(t => (
            <button key={t} onClick={() => setTf(t)}
              className={`px-2 py-0.5 text-xs rounded transition-colors
                ${tf===t ? "bg-[#2E7D9E] text-white" : "text-[#8B949E] hover:text-[#E6EDF3]"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} className="flex-1 min-h-0" />
    </div>
  );
}
