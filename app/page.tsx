"use client";

import { useEffect, useState, useCallback } from "react";

type Status = { on: boolean; timerMinutes: number };

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timerInput, setTimerInput] = useState(30);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/heater/status");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStatus(data);
      setTimerInput(data.timerMinutes || 30);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  async function toggle() {
    if (!status) return;
    setBusy(true);
    try {
      const res = await fetch("/api/heater/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: !status.on }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await fetchStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyTimer() {
    setBusy(true);
    try {
      const res = await fetch("/api/heater/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: timerInput }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await fetchStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const on = status?.on ?? false;

  return (
    <div className="wrap">
      <div className="panel">
        <div className="eyebrow">Backyard Sauna</div>
        <h1>Heater Control</h1>

        <div className={`gauge ${on ? "on" : "off"}`}>
          <div className="gauge-face">
            <div className="gauge-state">{on ? "Heating" : "Idle"}</div>
            <div className="gauge-sub">
              {status ? `Timer: ${status.timerMinutes} min` : "Loading..."}
            </div>
          </div>
        </div>

        <button
          className={`lever ${on ? "stop" : ""}`}
          onClick={toggle}
          disabled={busy || !status}
        >
          {on ? "Turn Off" : "Turn On"}
        </button>

        <div className="timer-block">
          <div className="timer-label">
            <span>Auto-off timer</span>
            <strong>{timerInput} min</strong>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={timerInput}
            onChange={(e) => setTimerInput(Number(e.target.value))}
          />
          <button className="lever" onClick={applyTimer} disabled={busy}>
            Set Timer
          </button>
        </div>

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
