import { useEffect, useRef, useState } from 'react';
import type { DfsuTelemetry, DfsuImpact, HaStatus } from '../types/dfsu';

// Port of the Android HaDeviceDataSource. Opens a WS to HA, auths, subscribes
// to the two MQTT topics we care about, and feeds parsed snapshots back.
//
// HA's subscribe_trigger API emits `event` frames whose `event.variables.trigger`
// mirrors the MQTT message — `.payload` is the raw string, `.payload_json` the
// pre-parsed JSON when the broker-side JSON was valid.

const IMPACT_BUFFER = 10;
// Physical impacts often trigger the MPU several times within a few hundred
// ms (mount ringing, rebound). Anything arriving within this window of an
// existing impact is folded in — max peakG wins, count increments.
const MERGE_WINDOW_MS = 2000;

interface UseHomeAssistantResult {
  status: HaStatus;
  error: string | null;
  telemetry: DfsuTelemetry | null;
  impacts: DfsuImpact[];
}

export function useHomeAssistant(): UseHomeAssistantResult {
  const [status, setStatus] = useState<HaStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<DfsuTelemetry | null>(null);
  const [impacts, setImpacts] = useState<DfsuImpact[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const msgIdRef = useRef(0);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_HA_URL?.trim();
    const token = import.meta.env.VITE_HA_TOKEN?.trim();
    if (!baseUrl || !token) {
      setStatus('error');
      setError('VITE_HA_URL / VITE_HA_TOKEN not set');
      return;
    }
    const wsUrl = baseUrl
      .replace(/\/+$/, '')
      .replace(/^http:\/\//, 'ws://')
      .replace(/^https:\/\//, 'wss://') + '/api/websocket';

    let disposed = false;

    const sendJson = (obj: Record<string, unknown>) => {
      wsRef.current?.send(JSON.stringify(obj));
    };

    const subscribeTopics = () => {
      ['dfsu/+/telemetry', 'dfsu/+/impact'].forEach((topic) => {
        msgIdRef.current += 1;
        sendJson({
          id: msgIdRef.current,
          type: 'subscribe_trigger',
          trigger: { platform: 'mqtt', topic },
        });
      });
    };

    const parseTelemetry = (raw: Record<string, unknown>): DfsuTelemetry => {
      const batt = (raw.battery as Record<string, unknown>) ?? {};
      return {
        timestampMs: Number(raw.ts ?? 0) * 1000,
        temperatureC: Number(raw.temperature ?? 0),
        humidityPct: Number(raw.humidity ?? 0),
        pressureHpa: raw.pressure !== undefined ? Number(raw.pressure) : undefined,
        battery: {
          voltageMv: Number(batt.voltage ?? 0),
          currentMa: Number(batt.current ?? 0),
          pct: Number(batt.pct ?? 0),
          consumptionMah: Number(batt.consumption ?? 0),
          runtimeOpenMin: Number(batt.runtimeOpen ?? 0),
          runtimeClosedMin: Number(batt.runtimeClosed ?? 0),
        },
        charging: Boolean(raw.charging ?? false),
        caseOpen: String(raw.case ?? 'open') === 'open',
      };
    };

    const parseImpact = (raw: Record<string, unknown>): DfsuImpact => ({
      id: Number(raw.id ?? 0),
      timestampMs: Number(raw.ts ?? 0) * 1000,
      gX: Number(raw.gX ?? 0),
      gY: Number(raw.gY ?? 0),
      gZ: Number(raw.gZ ?? 0),
      peakG: Number(raw.peakG ?? 0),
      count: 1,
    });

    const handleTrigger = (vars: Record<string, unknown>) => {
      const trigger = vars.trigger as Record<string, unknown> | undefined;
      if (!trigger) return;
      const topic = String(trigger.topic ?? '');
      let payload = trigger.payload_json as Record<string, unknown> | undefined;
      if (!payload) {
        const rawStr = String(trigger.payload ?? '');
        if (!rawStr) return;
        try { payload = JSON.parse(rawStr); } catch { return; }
      }
      if (!payload) return;
      if (topic.endsWith('/telemetry')) {
        setTelemetry(parseTelemetry(payload));
      } else if (topic.endsWith('/impact')) {
        const ev = parseImpact(payload);
        // Drop obvious junk (leftover MPU-6500-era records). Sort desc by
        // timestamp so out-of-order drains (firmware replays old records
        // after reconnect) still display newest-first. De-dupe by eventId.
        if (ev.peakG <= 0) return;
        setImpacts((prev) => {
          if (prev.some((p) => p.id === ev.id)) return prev;
          // Fold into an existing impact if within MERGE_WINDOW_MS — keeps the
          // strongest sample and tracks how many sub-hits it represents.
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
    };

    const connect = () => {
      if (disposed) return;
      setStatus('connecting');
      setError(null);
      msgIdRef.current = 0;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(ev.data); } catch { return; }
        switch (msg.type) {
          case 'auth_required':
            sendJson({ type: 'auth', access_token: token });
            break;
          case 'auth_ok':
            setStatus('authed');
            subscribeTopics();
            break;
          case 'auth_invalid':
            setStatus('error');
            setError('auth_invalid — check VITE_HA_TOKEN');
            ws.close();
            break;
          case 'event': {
            const event = msg.event as Record<string, unknown> | undefined;
            const vars = event?.variables as Record<string, unknown> | undefined;
            if (vars) handleTrigger(vars);
            break;
          }
        }
      };

      ws.onerror = () => {
        setStatus('error');
        setError('websocket error');
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (disposed) return;
        setStatus('closed');
        // Retry every 3s until the component unmounts.
        reconnectRef.current = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return { status, error, telemetry, impacts };
}
