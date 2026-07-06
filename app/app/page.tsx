"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Status = {
  on: boolean;
  timerMinutes: number;
  currentTempF: number;
  targetTempF: number;
  workMode: string;
};

type Sample = { t: number; temp: number };

const HISTORY_KEY = "sauna_temp_history";
const HISTORY_WINDOW_MS = 20 * 60 * 1000; // 20 min

function loadHistory(): Sample[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(samples: Sample[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(samples));
  } catch {}
}

// Simple linear regression slope (°F per minute)
function estimateRate(samples: Sample[]): number | null {
  if (samples.length < 2) return null;
  const t0 = samples[0].t;
  const xs = samples.map((s) => (s.t - t0) / 60000); // minutes
  const ys = samples.map((s) => s.temp);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timerInput, setTimerInput] = useState(30);
  const [targetInput, setTargetInput] = useState(150);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const historyRef = useRef<Sample[]>([]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/heater/status");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStatus(data);
      setTimerInput(data.timerMinutes || 30);
      if (data.targetTempF) setTargetInput(data.targetTempF);
      setError(null);

      const now = Date.now();
      const history = [...historyRef.current, { t: now, temp: data.currentTempF }].filter(
        (s) => now - s.t <= HISTORY_WINDOW_MS
      );
      historyRef.current = history;
      saveHistory(history);

      if (data.on && data.targetTempF > data.currentTempF) {
        const rate = estimateRate(history);
        if (rate && rate > 0.05) {
          const remaining = (data.targetTempF - data.currentTempF) / rate;
          setEtaMinutes(Math.max(0, Math.round(remaining)));
        } else {
          setEtaMinutes(null);
        }
      } else {
        setEtaMinutes(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    historyRef.current = loadHistory().filter(
      (s) => Date.now() - s.t <= HISTORY_WINDOW_MS
    );
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

  async function applyTarget() {
    setBusy(true);
    try {
      const res = await fetch("/api/heater/temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTempF: targetInput }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      historyRef.current = [];
      saveHistory([]);
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
            <div className="gauge-state">
              {status ? `${Math.round(status.currentTempF)}°F` : "..."}
            </div>
            <div className="gauge-sub">
              {on ? "Heating" : "Idle"}
              {etaMinutes !== null && ` · ~${etaMinutes} min to target`}
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
            <span>Target temperature</span>
            <strong>{targetInput}°F</strong>
          </div>
          <input
            type="range"
            min={90}
            max={194}
            step={5}
            value={targetInput}
            onChange={(e) => setTargetInput(Number(e.target.value))}
          />
          <button className="lever" onClick={applyTarget} disabled={busy}>
            Set Target
          </button>
        </div>

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
