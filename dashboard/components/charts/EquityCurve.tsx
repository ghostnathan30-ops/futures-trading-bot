"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface Props { data: { ts: string; net_liq: number }[]; }

export default function EquityCurve({ data }: Props) {
  const formatted = data.map(d => ({
    time: format(new Date(d.ts), "MM/dd HH:mm"),
    value: Number(d.net_liq),
  }));
  const min = Math.min(...formatted.map(d => d.value)) * 0.999;
  const max = Math.max(...formatted.map(d => d.value)) * 1.001;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2E7D9E" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2E7D9E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" tick={{ fill: "#8B949E", fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis domain={[min, max]} tick={{ fill: "#8B949E", fontSize: 10, fontFamily: "JetBrains Mono" }}
               tickLine={false} axisLine={false}
               tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ background: "#21262D", border: "1px solid #30363D", borderRadius: 4 }}
          labelStyle={{ color: "#8B949E", fontSize: 11 }}
          itemStyle={{ color: "#E6EDF3", fontFamily: "JetBrains Mono", fontSize: 12 }}
          formatter={(v: number) => [`$${v.toLocaleString("en-US", {minimumFractionDigits:2})}`, "Equity"]}
        />
        <Area type="monotone" dataKey="value" stroke="#2E7D9E" strokeWidth={2}
              fill="url(#equityGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
