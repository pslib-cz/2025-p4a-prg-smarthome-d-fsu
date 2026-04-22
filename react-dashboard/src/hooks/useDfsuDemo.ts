import { useEffect, useRef, useState } from 'react';
import type { DfsuImpact, DfsuTelemetry, HaStatus } from '../types/dfsu';

// Synthetic D-FSU telemetry for offline demo. Produces plausible drift on
// temperature/humidity/battery and occasionally emits impact events so the
// history list has something to render.

const TELEMETRY_PERIOD_MS = 1000;
const IMPACT_CHANCE_PER_TICK = 0.03;
const IMPACT_BUFFER = 10;
const MERGE_WINDOW_MS = 2000;

interface UseDfsuDemoResult {
  status: HaStatus;
  error: string | null;
  telemetry: DfsuTelemetry | null;
  impacts: DfsuImpact[];
}

export function useDfsuDemo(): UseDfsuDemoResult {
  const [telemetry, setTelemetry] = useState<DfsuTelemetry | null>(null);
  const [impacts, setImpacts] = useState<DfsuImpact[]>([]);
  const tickRef = useRef(0);
  const consumptionRef = useRef(340);
  const batteryRef = useRef(87);
  const caseOpenRef = useRef(false);
  const caseCountdownRef = useRef(14);
  const impactIdRef = useRef(1);

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;

      const temperature = 21 + Math.sin(t / 20) * 1.2 + (Math.random() - 0.5) * 0.1;
      const humidity = 48 + Math.cos(t / 25) * 4 + (Math.random() - 0.5) * 0.3;
      const pressure = 1013 + Math.sin(t / 60) * 2;

      caseCountdownRef.current -= 1;
      if (caseCountdownRef.current <= 0) {
        caseOpenRef.current = !caseOpenRef.current;
        caseCountdownRef.current = caseOpenRef.current ? 8 : 20;
      }

      const currentMa = caseOpenRef.current
        ? 180 + Math.round(Math.random() * 30)
        : 40 + Math.round(Math.random() * 10);
      consumptionRef.current += currentMa / 3600;
      batteryRef.current = Math.max(1, batteryRef.current - 0.02);

      const voltageMv = Math.round(3700 + (batteryRef.current / 100) * 500);

      setTelemetry({
        timestampMs: Date.now(),
        temperatureC: Number(temperature.toFixed(1)),
        humidityPct: Number(humidity.toFixed(0)),
        pressureHpa: Number(pressure.toFixed(0)),
        battery: {
          voltageMv,
          currentMa,
          pct: Math.round(batteryRef.current),
          consumptionMah: Math.round(consumptionRef.current),
          runtimeOpenMin: Math.round((batteryRef.current / 100) * 4 * 60),
          runtimeClosedMin: Math.round((batteryRef.current / 100) * 36 * 60),
        },
        charging: false,
        caseOpen: caseOpenRef.current,
      });

      if (Math.random() < IMPACT_CHANCE_PER_TICK) {
        const gX = (Math.random() - 0.5) * 3;
        const gY = (Math.random() - 0.5) * 3;
        const gZ = 1 + (Math.random() - 0.5) * 2;
        const peakG = Math.sqrt(gX * gX + gY * gY + gZ * gZ);
        const ev: DfsuImpact = {
          id: impactIdRef.current++,
          timestampMs: Date.now(),
          gX: Number(gX.toFixed(2)),
          gY: Number(gY.toFixed(2)),
          gZ: Number(gZ.toFixed(2)),
          peakG: Number(peakG.toFixed(2)),
          count: 1,
        };
        setImpacts((prev) => {
          const nearby = prev.find(
            (p) => Math.abs(p.timestampMs - ev.timestampMs) <= MERGE_WINDOW_MS,
          );
          if (nearby) {
            const merged: DfsuImpact = ev.peakG > nearby.peakG
              ? { ...ev, count: nearby.count + 1 }
              : { ...nearby, count: nearby.count + 1 };
            return prev
              .map((p) => (p === nearby ? merged : p))
              .sort((a, b) => b.timestampMs - a.timestampMs);
          }
          return [ev, ...prev]
            .sort((a, b) => b.timestampMs - a.timestampMs)
            .slice(0, IMPACT_BUFFER);
        });
      }
    }, TELEMETRY_PERIOD_MS);

    return () => clearInterval(interval);
  }, []);

  return { status: 'authed', error: null, telemetry, impacts };
}
