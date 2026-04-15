"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function MLPage() {
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => { api.mlMetrics().then(setMetrics).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      <div className="bg-[#1A1D24] border border-[#30363D] rounded p-6">
        <h2 className="text-[#E6EDF3] font-semibold mb-1">LightGBM Signal Filter</h2>
        <p className="text-[#8B949E] text-sm mb-6">
          Walk-forward trained on IBKR + yfinance historical data. Retrained weekly.
          Only signals where ML confidence ≥ threshold are executed.
        </p>

        {metrics.length === 0 ? (
          <div className="text-[#484F58] text-sm">
            No models trained yet. Run the bot with <span className="font-mono">ml_enabled=true</span> to trigger training.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {metrics.map((m, i) => (
              <div key={i} className="bg-[#21262D] border border-[#30363D] rounded p-4">
                <div className="text-[#E6EDF3] font-semibold mb-1">{m.instrument}</div>
                <div className="text-[#484F58] text-xs mb-3">
                  Trained: {new Date(m.trained_at).toLocaleDateString()}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Accuracy",  value: `${(m.accuracy*100).toFixed(1)}%` },
                    { label: "Precision", value: `${(m.precision_score*100).toFixed(1)}%` },
                    { label: "Recall",    value: `${(m.recall_score*100).toFixed(1)}%` },
                    { label: "F1",        value: m.f1_score?.toFixed(3) ?? "--" },
                    { label: "Samples",   value: m.n_samples?.toLocaleString() ?? "--" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-[#484F58] text-xs">{label}</div>
                      <div className="font-mono text-[#E6EDF3] text-sm font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#1A1D24] border border-[#30363D] rounded p-4">
        <h3 className="text-[#8B949E] text-xs uppercase tracking-wider mb-3">How the ML Filter Works</h3>
        <ol className="space-y-2 text-sm text-[#8B949E]">
          {[
            "Historical bars downloaded from IBKR + yfinance (up to 5 years of 15m data)",
            "Feature engineering: 11 features built from indicators, VWAP distance, delta, z-score",
            "Walk-forward cross-validation (5 folds, time-series aware — no lookahead bias)",
            "LightGBM trained to predict: will this signal produce >0.5 ATR profit in next 3 bars?",
            "Live inference: each signal scored 0-1. Only signals above threshold (default 0.65) execute",
            "Model retrained every Sunday night automatically with latest market data",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-[#2E7D9E] font-medium shrink-0">{i+1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
