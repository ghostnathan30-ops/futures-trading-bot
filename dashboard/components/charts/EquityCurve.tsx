"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format } from "date-fns";

interface Props { data: { ts: string; net_liq: number }[]; }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = Number(payload[0]?.value ?? 0);
  return (
    <div style={{
      background: "#0D1018",
      border: "1px solid #2E3A58",
      borderRadius: 6,
      padding: "10px 14px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
    }}>
      <div style={{ fontSize: 10, color: "#3D4760", marginBottom: 4, letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 15, fontWeight: 700, color: "#C9A84C" }}>
        ${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}

export default function EquityCurve({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        height: 280,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "#3D4760",
      }}>
        <div style={{ fontSize: 28, opacity: 0.3 }}>◈</div>
        <div style={{ fontSize: 12, letterSpacing: "0.05em" }}>Awaiting first account snapshot</div>
        <div style={{ fontSize: 10, color: "#232B42" }}>Bot writes equity data every 60 seconds</div>
      </div>
    );
  }

  const formatted = data
    .map(d => ({ time: format(new Date(d.ts), "MM/dd HH:mm"), value: Number(d.net_liq) }))
    .filter(d => isFinite(d.value));

  if (formatted.length === 0) return null;

  const values = formatted.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.08 || 1000;
  const baseline = formatted[0].value;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={formatted} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#C9A84C" stopOpacity={0.25} />
            <stop offset="60%"  stopColor="#C9A84C" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fill: "#3D4760", fontSize: 10, fontFamily: "JetBrains Mono" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[min - padding, max + padding]}
          tick={{ fill: "#3D4760", fontSize: 10, fontFamily: "JetBrains Mono" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          width={52}
        />
        <ReferenceLine
          y={baseline}
          stroke="#2E3A58"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#C9A84C"
          strokeWidth={2}
          fill="url(#goldGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#C9A84C", stroke: "#080B12", strokeWidth: 2 }}
          isAnimationActive={true}
          animationDuration={1200}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
