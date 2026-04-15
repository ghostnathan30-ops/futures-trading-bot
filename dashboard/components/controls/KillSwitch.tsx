"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function KillSwitch() {
  const [confirm, setConfirm] = useState(false);
  const [input, setInput] = useState("");
  const [killed, setKilled] = useState(false);

  async function handleKill() {
    if (input !== "KILL") return;
    await api.killSwitch();
    setKilled(true);
    setConfirm(false);
  }

  if (killed) return (
    <div className="border border-[#FF4444] rounded p-6 text-center">
      <div className="text-[#FF4444] text-lg font-semibold mb-1">Kill Switch Activated</div>
      <div className="text-[#8B949E] text-sm">Bot halted. All orders cancelled.</div>
    </div>
  );

  return (
    <div className="border border-[#FF4444]/30 rounded p-6">
      <h3 className="text-[#E6EDF3] font-semibold mb-1">Master Kill Switch</h3>
      <p className="text-[#8B949E] text-sm mb-4">
        Immediately halts the bot and cancels all open orders.
      </p>
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="bg-[#FF4444]/10 border border-[#FF4444] text-[#FF4444]
                     hover:bg-[#FF4444] hover:text-white font-semibold py-2 px-6
                     rounded transition-colors text-sm">
          ACTIVATE KILL SWITCH
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-[#F0A500] text-sm">Type <span className="font-mono font-bold">KILL</span> to confirm:</p>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type KILL"
            className="bg-[#21262D] border border-[#FF4444] text-[#E6EDF3]
                       rounded px-3 py-2 text-sm font-mono outline-none w-40"
          />
          <div className="flex gap-2">
            <button
              onClick={handleKill}
              disabled={input !== "KILL"}
              className="bg-[#FF4444] text-white font-semibold py-2 px-4
                         rounded text-sm disabled:opacity-40 transition-opacity">
              CONFIRM KILL
            </button>
            <button
              onClick={() => { setConfirm(false); setInput(""); }}
              className="text-[#8B949E] hover:text-[#E6EDF3] text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
