// Mirrors the MQTT JSON schemas published by the ESP32 firmware. See
// 2025-p4a-prg-smarthome-d-fsu/contracts/mqtt-schema.md.

export interface DfsuTelemetry {
  timestampMs: number;
  temperatureC: number;
  humidityPct: number;
  pressureHpa?: number;
  battery: {
    voltageMv: number;
    currentMa: number;
    pct: number;
    consumptionMah: number;
    runtimeOpenMin: number;
    runtimeClosedMin: number;
  };
  charging: boolean;
  caseOpen: boolean;
}

export interface DfsuImpact {
  id: number;
  timestampMs: number;
  gX: number;
  gY: number;
  gZ: number;
  peakG: number;
  // Number of raw events that got merged into this one (closely-spaced hits
  // from a single physical impact). 1 = single event, >1 = combined.
  count: number;
}

export type HaStatus = 'idle' | 'connecting' | 'authed' | 'error' | 'closed';
