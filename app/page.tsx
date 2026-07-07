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
const HISTORY_WINDOW_MS = 20 * 60 * 1000;

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

function estimateRate(samples: Sample[]): number | null {
  if (samples.length < 2) return null;
  const t0 = samples[0].t;
  const xs = samples.map((s) => (s.t - t0) / 60000);
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

const R = 100;
const CIRC = 2 * Math.PI * R;

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timerInput, setTimerInput] = useState(30);
  const [targetInput, setTargetInput] = useState(150);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [heatingState, setHeatingState] = useState<"idle" | "heating" | "holding">("idle");
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

      if (!data.on) {
        setHeatingState("idle");
      } else {
        setHeatingState("heating");
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
        body: JSON.stringify({ on: !status.on, targetTempF: targetInput }),
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
  const current = status?.currentTempF ?? 0;
  const target = status?.targetTempF ?? targetInput;
  const frac = target > 0 ? Math.max(0, Math.min(1, current / target)) : 0;
  const dash = `${frac * CIRC} ${CIRC}`;

  const stateLabel = heatingState === "heating" ? "Heating" : "Idle";

  return (
    <div className="wrap">
      <div className="panel">
        <div className="topbar">
          <span className="topbar-title">Backyard Sauna</span>
          <span className="topbar-sub">
            {status ? "Connected" : error ? "Offline" : "Connecting..."}
          </span>
        </div>

        <div className="gauge-wrap">
          <svg viewBox="0 0 220 220">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f0a24a" />
                <stop offset="100%" stopColor="#d6431f" />
              </linearGradient>
            </defs>
            <circle className="gauge-track" cx="110" cy="110" r={R} />
            <circle
              className="gauge-progress"
              cx="110"
              cy="110"
              r={R}
              stroke="url(#gaugeGrad)"
              strokeDasharray={dash}
            />
          </svg>
          <div className="gauge-center">
            <div className="gauge-temp">{status ? Math.round(current) : "--"}°F</div>
            <div className="gauge-target">Target {Math.round(target)}°F</div>
            <div className="gauge-meta">
              {stateLabel}
              {etaMinutes !== null && ` · ~${etaMinutes} min left`}
            </div>
          </div>
        </div>

        <button
          className={`cta ${on ? "" : "off"}`}
          onClick={toggle}
          disabled={busy || !status}
        >
          <span className="cta-title">
            {on ? "Turn off" : `Preheat to ${targetInput}°F`}
          </span>
          <span className="cta-sub">
            {on
              ? etaMinutes !== null
                ? `~${etaMinutes} min to target`
                : stateLabel
              : "Tap to start"}
          </span>
        </button>

        <div className="status-row">
          <div className="status-card">
            <span className="status-label">{on ? "Running" : "Idle"}</span>
            <span className="status-sub">Heater · {status ? "online" : "..."}</span>
          </div>
          <div className="status-card">
            <span className="status-label">{timerInput} min</span>
            <span className="status-sub">Auto-off timer</span>
          </div>
        </div>

        <div className="control-block">
          <div className="control-label">
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
          <button className="set-btn" onClick={applyTarget} disabled={busy}>
            Set target
          </button>
        </div>

        <div className="control-block">
          <div className="control-label">
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
          <button className="set-btn" onClick={applyTimer} disabled={busy}>
            Set timer
          </button>
        </div>

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
