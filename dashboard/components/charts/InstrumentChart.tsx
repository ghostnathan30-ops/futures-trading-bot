"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  type UTCTimestamp,
  type Time,
  type ISeriesMarkersPluginApi,
} from "lightweight-charts";
import { api } from "@/lib/api";
import { wsClient } from "@/lib/websocket";

interface Bar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SignalMarker {
  time: UTCTimestamp;
  direction: "long" | "short";
  score: number;
  fired: boolean;
}

interface Props {
  instrument: string;
  contract: string;
  fill?: { side: string; quantity: number; fill_price: number; pnl: number } | null;
}

const C = {
  surface: "#080B12",
  border: "#1A2035",
  muted: "#8892B0",
  dim: "#3D4760",
  gold: "#C9A84C",
  green: "#00E5A0",
  red: "#FF3A5C",
  text: "#F0F4FF",
};

const TIMEFRAMES = ["15m", "1h", "4h"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

// ── Indicator helpers ─────────────────────────────────────────────────────────

type LinePoint = { time: UTCTimestamp; value: number };

function calcEMA(bars: Bar[], period: number): LinePoint[] {
  const k = 2 / (period + 1);
  const result: LinePoint[] = [];
  let ema = 0;
  for (let i = 0; i < bars.length; i++) {
    ema = i === 0 ? bars[i].close : bars[i].close * k + ema * (1 - k);
    if (i >= period - 1) result.push({ time: bars[i].time, value: +ema.toFixed(4) });
  }
  return result;
}

function calcVWAP(bars: Bar[]): {
  vwap: LinePoint[];
  upper: LinePoint[];
  lower: LinePoint[];
} {
  let cumTPV = 0;
  let cumTPVSq = 0;
  let cumVol = 0;
  const vwap: LinePoint[] = [];
  const upper: LinePoint[] = [];
  const lower: LinePoint[] = [];

  for (const bar of bars) {
    const tp = (bar.high + bar.low + bar.close) / 3;
    const vol = bar.volume || 1;
    cumTPV += tp * vol;
    cumTPVSq += tp * tp * vol;
    cumVol += vol;

    const v = cumTPV / cumVol;
    const variance = cumTPVSq / cumVol - v * v;
    const sigma = Math.sqrt(Math.max(variance, 0));

    vwap.push({ time: bar.time, value: +v.toFixed(4) });
    upper.push({ time: bar.time, value: +(v + sigma).toFixed(4) });
    lower.push({ time: bar.time, value: +(v - sigma).toFixed(4) });
  }

  return { vwap, upper, lower };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function InstrumentChart({ instrument, contract, fill }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const markersApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const signalMarkersRef = useRef<SignalMarker[]>([]);

  const [tf, setTf] = useState<Timeframe>("15m");
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch bars whenever instrument or timeframe changes ────────────────────
  const fetchBars = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await api.chartBars(instrument, tf, 200);
      // Cast unix timestamp (number) to UTCTimestamp for lightweight-charts
      const data: Bar[] = raw.map((b) => ({ ...b, time: b.time as UTCTimestamp }));
      setBars(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load chart data");
    } finally {
      setLoading(false);
    }
  }, [instrument, tf]);

  useEffect(() => {
    fetchBars();
  }, [fetchBars]);

  // ── Build/rebuild chart whenever bars change ───────────────────────────────
  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    // Destroy previous instance
    chartRef.current?.remove();
    chartRef.current = null;
    markersApiRef.current = null;

    const chart = createChart(containerRef.current, {
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
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 260,
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: C.green,
      downColor: C.red,
      borderUpColor: C.green,
      borderDownColor: C.red,
      wickUpColor: C.green,
      wickDownColor: C.red,
    });
    candles.setData(bars);

    const { vwap, upper, lower } = calcVWAP(bars);
    const ema20 = calcEMA(bars, 20);
    const ema50 = calcEMA(bars, 50);

    const vwapLine = chart.addSeries(LineSeries, { color: C.gold, lineWidth: 2, title: "VWAP" });
    vwapLine.setData(vwap);

    const upperBand = chart.addSeries(LineSeries, {
      color: "rgba(201,168,76,0.35)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
    });
    upperBand.setData(upper);

    const lowerBand = chart.addSeries(LineSeries, {
      color: "rgba(201,168,76,0.35)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
    });
    lowerBand.setData(lower);

    const ema20Line = chart.addSeries(LineSeries, { color: "#4488FF", lineWidth: 1, title: "EMA20" });
    ema20Line.setData(ema20);

    const ema50Line = chart.addSeries(LineSeries, { color: C.muted, lineWidth: 1, title: "EMA50" });
    ema50Line.setData(ema50);

    // Attach markers API and replay any accumulated signal markers
    const markersApi = createSeriesMarkers(candles, []);
    markersApiRef.current = markersApi;
    _applySignalMarkers();

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      markersApiRef.current = null;
    };
  }, [bars]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply accumulated signal markers to the chart ─────────────────────────
  function _applySignalMarkers() {
    if (!markersApiRef.current) return;
    const markers = signalMarkersRef.current.map((s) => ({
      time: s.time,
      position: s.direction === "long" ? ("belowBar" as const) : ("aboveBar" as const),
      color: s.fired
        ? s.direction === "long"
          ? C.green
          : C.red
        : "rgba(136,146,176,0.5)",
      shape: s.direction === "long" ? ("arrowUp" as const) : ("arrowDown" as const),
      text: s.fired ? `${s.direction.toUpperCase()} ${s.score}/6` : "",
    }));
    markersApiRef.current.setMarkers(markers);
  }

  // ── Subscribe to signal_fired WS events ───────────────────────────────────
  useEffect(() => {
    const onSignal = (sig: any) => {
      if (sig.instrument !== instrument) return;
      const ts = (sig.ts
        ? Math.floor(new Date(sig.ts).getTime() / 1000)
        : Math.floor(Date.now() / 1000)) as UTCTimestamp;
      signalMarkersRef.current = [
        ...signalMarkersRef.current.slice(-49), // keep last 50
        { time: ts, direction: sig.direction, score: sig.score, fired: sig.fired },
      ];
      _applySignalMarkers();
    };
    wsClient.on("signal_fired", onSignal);
    return () => wsClient.off("signal_fired", onSignal);
  }, [instrument]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived header values ──────────────────────────────────────────────────
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = prev ? (change / prev.close) * 100 : 0;
  const up = change >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.surface }}>

      {/* Header */}
      <div style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div>
          <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 13, color: C.gold }}>
            {instrument}
          </span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: C.dim, marginLeft: 6 }}>
            {contract}
          </span>
        </div>

        {fill && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: "2px 7px",
            borderRadius: 3,
            background: fill.side === "BUY" ? "rgba(0,229,160,0.12)" : "rgba(255,58,92,0.12)",
            color: fill.side === "BUY" ? C.green : C.red,
            border: `1px solid ${fill.side === "BUY" ? "rgba(0,229,160,0.25)" : "rgba(255,58,92,0.25)"}`,
          }}>
            {fill.side} {fill.quantity} @ {fill.fill_price?.toFixed(2)}
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "baseline" }}>
          {last ? (
            <>
              <span style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 14, color: C.text }}>
                {last.close.toFixed(2)}
              </span>
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 600, color: up ? C.green : C.red }}>
                {up ? "+" : ""}{change.toFixed(2)} ({up ? "+" : ""}{changePct.toFixed(2)}%)
              </span>
            </>
          ) : (
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.dim }}>—</span>
          )}
        </div>
      </div>

      {/* Timeframe selector */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "6px 10px", borderBottom: `1px solid ${C.border}`, gap: 4,
      }}>
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            onClick={() => setTf(t)}
            style={{
              padding: "2px 8px", borderRadius: 3, fontSize: 10,
              fontFamily: "JetBrains Mono", fontWeight: 600, cursor: "pointer",
              transition: "all 0.12s",
              background: tf === t ? "rgba(201,168,76,0.12)" : "transparent",
              border: `1px solid ${tf === t ? "rgba(201,168,76,0.3)" : "transparent"}`,
              color: tf === t ? C.gold : C.dim,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: C.surface, zIndex: 2,
          }}>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.dim }}>Loading…</span>
          </div>
        )}
        {error && !loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: C.surface, zIndex: 2,
          }}>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: C.red }}>{error}</span>
          </div>
        )}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
