import { useCallback, useEffect, useRef, useState } from 'react';

const SERVICE_UUID = 'f12c2474-3303-4e4e-b2c9-42eaea146567';
const CHARACTERISTIC_UUID_TX = '189aebdb-4292-4001-b6e0-a3e360e15658';
const CHARACTERISTIC_UUID_RX = '342fe289-3be5-4219-b9d2-7809f10a6895';

const FRAME_DELIMITER = /\r?\n/;
const ACK_MIN_INTERVAL_MS = 750;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;
const LATENCY_PING_INTERVAL_MS = 2500;
const MAX_PENDING_PINGS = 10;
const TELEMETRY_IDEAL_INTERVAL_MS = 110;
const SIGNAL_MEMORY_WEIGHT = 0.6;
const SIGNAL_INSTANT_WEIGHT = 0.4;

export type BLEConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface BatterySnapshot {
  voltage?: number;
  level?: number;
  estimatedMinutes?: number;
  alert?: boolean;
  currentA?: number;
  drawnMah?: number;
}

export interface IMUSnapshot {
  rollDeg?: number;
  pitchDeg?: number;
  gForce?: { x: number; y: number };
  gyroAlert?: boolean;
  yawRate?: number;
}

export interface SuspensionSnapshot {
  frontLeft?: number;
  frontRight?: number;
  rearLeft?: number;
  rearRight?: number;
}

export interface SystemSnapshot {
  btStrength?: number;
  latencyMs?: number;
  temperatureC?: number;
  imuOnline?: boolean;
}

export interface DiagnosticSnapshot {
  errors?: string[];
  frameDrop?: boolean;
}

export interface ControlSnapshot {
  steeringPosition?: number;
  chassisPwm?: number;
  frontPowerReduction?: number;
  rearPowerReduction?: number;
}

export interface AssistantSnapshot {
  antiRoll?: boolean;
  antiSquat?: boolean;
  antiDive?: boolean;
}

export interface InterventionSnapshot {
  tractionCount?: number;
  antiDiveActivity?: number;
  antiSquatActivity?: number;
}

export interface DashSettingsSnapshot {
  stability?: number;
  powerSplit?: number;
  throttleCurve?: number;
  brakeBalance?: number;
  heightFL?: number;
  heightFR?: number;
  heightRL?: number;
  heightRR?: number;
  antiRollEnabled?: boolean;
  antiSquatEnabled?: boolean;
  antiDiveEnabled?: boolean;
  drivingMode?: number;
  triggerPartyMode?: boolean;
}

export interface BLEData {
  timestamp?: number;
  seq?: number;
  power?: number;
  battery?: BatterySnapshot;
  imu?: IMUSnapshot;
  suspension?: SuspensionSnapshot;
  system?: SystemSnapshot;
  diagnostics?: DiagnosticSnapshot;
  control?: ControlSnapshot;
  assistants?: AssistantSnapshot;
  interventions?: InterventionSnapshot;
  dash?: DashSettingsSnapshot;
}

export interface UseBLEReturn {
  status: BLEConnectionStatus;
  data: BLEData | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendData: (data: string) => Promise<void>;
  authenticate: (password: string) => Promise<boolean>;
  isAuthenticated: boolean;
  isSupported: boolean;
  isAvailable: boolean | null;
}

const BLE_ERROR_FALLBACK = 'Při připojování došlo k neočekávané chybě. Zkuste akci zopakovat.';

const domExceptionNameMap: Record<string, string> = {
  AbortError: 'Operace byla přerušena. Zkuste vyhledat zařízení znovu.',
  NotFoundError: 'Nebyla nalezena žádná zařízení s podporovanou službou.',
  NotAllowedError: 'Přístup k Bluetooth byl zamítnut. Zkontrolujte oprávnění prohlížeče.',
  SecurityError: 'Prohlížeč nepovolil komunikaci přes Bluetooth.',
  InvalidStateError: 'Zařízení je již používáno jinou aplikací. Odpojte jej a zkuste to znovu.',
  NetworkError: 'Spojení se zařízením bylo neočekávaně přerušeno.',
  NotSupportedError: 'Vybrané zařízení nepodporuje požadovanou službu.',
  TimeoutError: 'Připojení se nepodařilo v časovém limitu.'
};

const formatBleError = (err: unknown): string => {
  const fromMessage = (message: string): string | null => {
    const normalized = message.toLowerCase();
    if (normalized.includes('user cancelled') || normalized.includes('chooser')) {
      return 'Výběr zařízení byl zrušen. Pro připojení vyberte kompatibilní zařízení.';
    }
    if (normalized.includes('networkerror')) {
      return 'Spojení s Bluetooth zařízením bylo přerušeno.';
    }
    if (normalized.includes('notfounderror')) {
      return 'Nebyla nalezena žádná zařízení s podporovanou službou.';
    }
    return null;
  };

  if (err instanceof DOMException) {
    const specific = fromMessage(err.message ?? '');
    if (specific) {
      return specific;
    }
    return domExceptionNameMap[err.name] ?? BLE_ERROR_FALLBACK;
  }

  if (err instanceof Error) {
    return fromMessage(err.message) ?? BLE_ERROR_FALLBACK;
  }

  if (typeof err === 'string') {
    return fromMessage(err) ?? BLE_ERROR_FALLBACK;
  }

  return BLE_ERROR_FALLBACK;
};

const sanitizeTelemetryPayload = (payload: string): string =>
  payload
    .replace(/\u0000/g, '')
    .replace(/(:\s*)(?:-?Infinity|NaN)/gi, (_, prefix: string) => `${prefix}0`);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShortKeys(raw: any): BLEData | null {
  if (!raw || typeof raw !== 'object') return null;

  // Support both full and shortened keys (backwards compatible)
  const bat = raw.bat ?? raw.battery;
  const imu = raw.imu;
  const sus = raw.sus ?? raw.suspension;
  const sys = raw.sys ?? raw.system;
  const ctrl = raw.ctrl ?? raw.control;
  const ast = raw.ast ?? raw.assistants;
  const int = raw.int ?? raw.interventions;
  const diag = raw.diag ?? raw.diagnostics;
  const dash = raw.dash;

  return {
    timestamp: raw.ts ?? raw.timestamp,
    seq: raw.sq ?? raw.seq,
    power: raw.pwr ?? raw.power,
    battery: bat ? {
      voltage: bat.v ?? bat.voltage,
      level: bat.lv ?? bat.level,
      estimatedMinutes: bat.eM ?? bat.estimatedMinutes,
      alert: bat.al ?? bat.alert,
      currentA: bat.cA ?? bat.currentA,
      drawnMah: bat.dM ?? bat.drawnMah,
    } : undefined,
    imu: imu ? {
      rollDeg: imu.rD ?? imu.rollDeg,
      pitchDeg: imu.pD ?? imu.pitchDeg,
      gForce: imu.gF ?? imu.gForce,
      gyroAlert: imu.gA ?? imu.gyroAlert,
      yawRate: imu.yR ?? imu.yawRate,
    } : undefined,
    suspension: sus ? {
      frontLeft: sus.fL ?? sus.frontLeft,
      frontRight: sus.fR ?? sus.frontRight,
      rearLeft: sus.rL ?? sus.rearLeft,
      rearRight: sus.rR ?? sus.rearRight,
    } : undefined,
    system: sys ? {
      btStrength: sys.bt ?? sys.btStrength,
      latencyMs: sys.lat ?? sys.latencyMs,
      temperatureC: sys.tC ?? sys.temperatureC,
      imuOnline: sys.iO ?? sys.imuOnline,
    } : undefined,
    control: ctrl ? {
      steeringPosition: ctrl.sP ?? ctrl.steeringPosition,
      chassisPwm: ctrl.cP ?? ctrl.chassisPwm,
      frontPowerReduction: ctrl.fPR ?? ctrl.frontPowerReduction,
      rearPowerReduction: ctrl.rPR ?? ctrl.rearPowerReduction,
    } : undefined,
    assistants: ast ? {
      antiRoll: ast.aR === 1 || ast.aR === true || ast.antiRoll === true,
      antiSquat: ast.aS === 1 || ast.aS === true || ast.antiSquat === true,
      antiDive: ast.aD === 1 || ast.aD === true || ast.antiDive === true,
    } : undefined,
    interventions: int ? {
      tractionCount: int.tC ?? int.tractionCount,
      antiDiveActivity: int.dA ?? int.antiDiveActivity,
      antiSquatActivity: int.sA ?? int.antiSquatActivity,
    } : undefined,
    diagnostics: diag ? {
      errors: diag.err ?? diag.errors,
      frameDrop: diag.fD ?? diag.frameDrop,
    } : undefined,
    dash: dash ? {
      stability: dash.s ?? dash.stability,
      powerSplit: dash.ps ?? dash.powerSplit,
      throttleCurve: dash.tc ?? dash.throttleCurve,
      brakeBalance: dash.bb ?? dash.brakeBalance,
      heightFL: dash.hFL ?? dash.heightFL,
      heightFR: dash.hFR ?? dash.heightFR,
      heightRL: dash.hRL ?? dash.heightRL,
      heightRR: dash.hRR ?? dash.heightRR,
      antiRollEnabled: dash.aRE === 1 || dash.aRE === true || dash.antiRollEnabled === true,
      antiSquatEnabled: dash.aSE === 1 || dash.aSE === true || dash.antiSquatEnabled === true,
      antiDiveEnabled: dash.aDE === 1 || dash.aDE === true || dash.antiDiveEnabled === true,
      drivingMode: dash.dm ?? dash.drivingMode,
      triggerPartyMode: dash.pm === 1 || dash.pm === true || dash.triggerPartyMode === true,
    } : undefined,
  };
}

function mergeTelemetry(previous: BLEData | null, incoming: BLEData): BLEData {
  return {
    timestamp: incoming.timestamp ?? previous?.timestamp,
    seq: incoming.seq ?? previous?.seq,
    power: incoming.power ?? previous?.power,
    battery: incoming.battery ?? previous?.battery,
    imu: incoming.imu ?? previous?.imu,
    suspension: incoming.suspension ?? previous?.suspension,
    system: incoming.system ?? previous?.system,
    diagnostics: incoming.diagnostics ?? previous?.diagnostics,
    control: incoming.control ?? previous?.control,
    assistants: incoming.assistants ?? previous?.assistants,
    interventions: incoming.interventions ?? previous?.interventions,
    dash: incoming.dash ?? previous?.dash
  };
}

const deriveSignalScore = (deltaMs: number) => {
  if (deltaMs <= 140) {
    return 1;
  }
  if (deltaMs <= 260) {
    return 0.85;
  }
  if (deltaMs <= 420) {
    return 0.55;
  }
  if (deltaMs <= 700) {
    return 0.3;
  }
  if (deltaMs <= 1200) {
    return 0.1;
  }
  return 0;
};

interface AckMeta {
  enabled: boolean;
  lastSentAt: number;
}

interface PongFrame {
  type: 'pong';
  clientTs: number;
  deviceTs: number;
}

const isPongFrame = (value: unknown): value is PongFrame => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === 'pong'
    && typeof candidate.clientTs === 'number'
    && typeof candidate.deviceTs === 'number';
};

interface AuthFrame {
  type: 'auth';
  status: 'ok' | 'fail';
}

const isAuthFrame = (value: unknown): value is AuthFrame => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.type === 'auth'
    && (candidate.status === 'ok' || candidate.status === 'fail');
};

export function useBLE(): UseBLEReturn {
  const [status, setStatus] = useState<BLEConnectionStatus>('disconnected');
  const [data, setData] = useState<BLEData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const txCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const rxCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceDisconnectHandlerRef = useRef<((event: Event) => void) | null>(null);

  const decoderRef = useRef<TextDecoder | null>(null);
  const encoderRef = useRef<TextEncoder | null>(null);
  const inboundBufferRef = useRef('');
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const reconnectAttemptsRef = useRef(0);
  const ackMetaRef = useRef<AckMeta>({ enabled: true, lastSentAt: 0 });
  const pendingPingsRef = useRef<Map<number, number>>(new Map());
  const latencyIntervalRef = useRef<number | null>(null);
  const nextPingIdRef = useRef(1);
  const latestLatencyRef = useRef<number | null>(null);
  const lastHeartbeatRef = useRef<number | null>(null);
  const signalScoreRef = useRef(0);
  const storedPasswordRef = useRef<string | null>(null);  // Zapamatovane heslo pro auto-reauth
  const authResolverRef = useRef<((success: boolean) => void) | null>(null);

  const isSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  const getDecoder = () => {
    if (!decoderRef.current) {
      decoderRef.current = new TextDecoder('utf-8');
    }
    return decoderRef.current;
  };

  const getEncoder = () => {
    if (!encoderRef.current) {
      encoderRef.current = new TextEncoder();
    }
    return encoderRef.current;
  };

  const resetAckState = () => {
    ackMetaRef.current = { enabled: true, lastSentAt: 0 };
  };

  const queueWrite = useCallback((payload: string) => {
    const characteristic = rxCharacteristicRef.current;
    if (!characteristic) {
      return Promise.reject(new Error('BLE není připraveno k zápisu'));
    }

    const encoded = getEncoder().encode(payload);
    writeQueueRef.current = writeQueueRef.current
      .catch(() => {})
      .then(() => characteristic.writeValue(encoded));

    return writeQueueRef.current;
  }, []);

  const parseFrame = useCallback((frame: string): unknown => {
    const trimmed = frame.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const sanitized = sanitizeTelemetryPayload(trimmed);
      return JSON.parse(sanitized);
    } catch (parseError) {
      console.error('Failed to parse BLE frame:', parseError, trimmed);
      return null;
    }
  }, []);

  const updateLatencyOnTelemetry = useCallback((frame: BLEData) => {
    if (latestLatencyRef.current === null) {
      return frame;
    }

    const nextSystem = { ...frame.system, latencyMs: latestLatencyRef.current };
    return { ...frame, system: nextSystem };
  }, []);

  const applySignalStrength = useCallback((frame: BLEData) => {
    const now = performance.now();
    const lastHeartbeat = lastHeartbeatRef.current;
    const delta = lastHeartbeat === null ? TELEMETRY_IDEAL_INTERVAL_MS : now - lastHeartbeat;
    lastHeartbeatRef.current = now;

    const score = deriveSignalScore(delta);
    const previousScore = signalScoreRef.current;
    const blended = previousScore * SIGNAL_MEMORY_WEIGHT + score * SIGNAL_INSTANT_WEIGHT;
    signalScoreRef.current = blended;
    const normalized = Math.max(0, Math.min(4, Math.round(blended * 4)));

    const systemSnapshot = frame.system ?? {};
    return { ...frame, system: { ...systemSnapshot, btStrength: normalized } };
  }, []);

  const maybeSendAck = useCallback((seq?: number) => {
    if (seq === undefined) {
      return;
    }

    const meta = ackMetaRef.current;
    if (!meta.enabled) {
      return;
    }

    const now = Date.now();
    if (now - meta.lastSentAt < ACK_MIN_INTERVAL_MS) {
      return;
    }

    meta.lastSentAt = now;
    queueWrite(`ACK:${seq}`).catch(err => {
      meta.enabled = false;
      console.warn('BLE ACKs disabled after write error:', err);
    });
  }, [queueWrite]);

  const handleParsedObject = useCallback((parsed: unknown) => {
    if (!parsed) {
      return;
    }

    if (isPongFrame(parsed)) {
      const sentAt = pendingPingsRef.current.get(parsed.clientTs);
      if (sentAt === undefined) {
        return;
      }
      pendingPingsRef.current.delete(parsed.clientTs);
      const roundTrip = Math.max(performance.now() - sentAt, 0);
      const latencyMs = roundTrip / 2;
      latestLatencyRef.current = latencyMs;
      setData(prev => {
        if (!prev) {
          return prev;
        }
        const system = { ...prev.system, latencyMs };
        return { ...prev, system };
      });
      return;
    }

    if (isAuthFrame(parsed)) {
      const success = parsed.status === 'ok';
      if (success) {
        setIsAuthenticated(true);
      }
      if (authResolverRef.current) {
        authResolverRef.current(success);
        authResolverRef.current = null;
      }
      return;
    }

    const mapped = mapShortKeys(parsed);
    if (!mapped) return;
    const telemetryFrame = updateLatencyOnTelemetry(mapped);
    const enrichedFrame = applySignalStrength(telemetryFrame);
    setData(prev => mergeTelemetry(prev, enrichedFrame));
    maybeSendAck(enrichedFrame.seq);
  }, [applySignalStrength, maybeSendAck, updateLatencyOnTelemetry]);

  const processChunk = useCallback((chunk: string) => {
    inboundBufferRef.current += chunk;
    const frames = inboundBufferRef.current.split(FRAME_DELIMITER);
    inboundBufferRef.current = frames.pop() ?? '';

    frames.forEach(frame => {
      const parsed = parseFrame(frame);
      if (parsed) {
        handleParsedObject(parsed);
      }
    });

    const pending = inboundBufferRef.current.trim();
    if (pending.startsWith('{') && pending.endsWith('}')) {
      inboundBufferRef.current = '';
      const parsed = parseFrame(pending);
      if (parsed) {
        handleParsedObject(parsed);
      }
    }
  }, [handleParsedObject, parseFrame]);

  const handleNotification = useCallback((event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) {
      return;
    }

    const text = getDecoder().decode(value);
    processChunk(text);
  }, [processChunk]);

  const releaseGattResources = useCallback(() => {
    if (txCharacteristicRef.current) {
      txCharacteristicRef.current.removeEventListener('characteristicvaluechanged', handleNotification);
    }

    if (serverRef.current?.connected) {
      try {
        serverRef.current.disconnect();
      } catch (disconnectError) {
        console.warn('Failed to disconnect GATT server cleanly:', disconnectError);
      }
    }

    pendingPingsRef.current.clear();
    if (latencyIntervalRef.current !== null) {
      clearInterval(latencyIntervalRef.current);
      latencyIntervalRef.current = null;
    }
    serverRef.current = null;
    txCharacteristicRef.current = null;
    rxCharacteristicRef.current = null;
    inboundBufferRef.current = '';
    writeQueueRef.current = Promise.resolve();
    resetAckState();
    lastHeartbeatRef.current = null;
    signalScoreRef.current = 0;
  }, [handleNotification]);

  const detachDeviceListener = useCallback(() => {
    if (deviceRef.current && deviceDisconnectHandlerRef.current) {
      deviceRef.current.removeEventListener('gattserverdisconnected', deviceDisconnectHandlerRef.current);
      deviceDisconnectHandlerRef.current = null;
    }
  }, []);

  const teardownDevice = useCallback(() => {
    releaseGattResources();
    detachDeviceListener();
    deviceRef.current = null;
    reconnectAttemptsRef.current = 0;
    latestLatencyRef.current = null;
    storedPasswordRef.current = null;  // Vymazat heslo pri uplnem odpojeni
  }, [detachDeviceListener, releaseGattResources]);

  const establishGattConnection = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) {
      throw new Error('Není vybráno žádné zařízení');
    }

    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error('Nepodařilo se připojit k GATT serveru');
    }
    serverRef.current = server;

    const service = await server.getPrimaryService(SERVICE_UUID);
    const txCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID_TX);
    const rxCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID_RX);

    await txCharacteristic.startNotifications();
    txCharacteristic.addEventListener('characteristicvaluechanged', handleNotification);

    txCharacteristicRef.current = txCharacteristic;
    rxCharacteristicRef.current = rxCharacteristic;
    reconnectAttemptsRef.current = 0;
    inboundBufferRef.current = '';
    resetAckState();
    writeQueueRef.current = Promise.resolve();

    setStatus('connected');
    setError(null);
    console.info('BLE connected');

    // Auto-reauth: pokud mame ulozene heslo, automaticky se znovu autentizovat
    const savedPassword = storedPasswordRef.current;
    if (savedPassword) {
      console.info('[BLE] Auto re-authentication...');
      const encoder = getEncoder();
      const encoded = encoder.encode(`AUTH:${savedPassword}`);
      try {
        await rxCharacteristic.writeValue(encoded);
      } catch (authErr) {
        console.warn('[BLE] Auto re-auth write failed:', authErr);
      }
    }
  }, [handleNotification]);

  const scheduleReconnect = useCallback(() => {
    if (!deviceRef.current) {
      setStatus('disconnected');
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('error');
      setError('Nepodařilo se obnovit spojení');
      teardownDevice();
      return;
    }

    reconnectAttemptsRef.current += 1;
    setStatus('reconnecting');

    setTimeout(() => {
      establishGattConnection().catch(err => {
        console.error('Reconnection attempt failed:', err);
        scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  }, [establishGattConnection, teardownDevice]);

  const handleDeviceDisconnect = useCallback(() => {
    console.warn('BLE device disconnected');
    // isAuthenticated NERESETUJEME — auto-reauth v establishGattConnection to vyresi
    releaseGattResources();
    scheduleReconnect();
  }, [releaseGattResources, scheduleReconnect]);

  const connect = useCallback(async () => {
    if (!isSupported) {
      setStatus('error');
      setError('Web Bluetooth API není podporováno v tomto prohlížeči');
      return;
    }

    try {
      setStatus('connecting');
      setError(null);

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID]
      });

      teardownDevice();
      deviceRef.current = device;
      deviceDisconnectHandlerRef.current = handleDeviceDisconnect;
      device.addEventListener('gattserverdisconnected', handleDeviceDisconnect);

      await establishGattConnection();
    } catch (connectError) {
      console.error('Connection error:', connectError);
      setError(formatBleError(connectError));
      setStatus('error');
      teardownDevice();
    }
  }, [establishGattConnection, handleDeviceDisconnect, isSupported, teardownDevice]);

  const disconnect = useCallback(() => {
    teardownDevice();
    setStatus('disconnected');
    setData(null);
    setError(null);
    setIsAuthenticated(false);
  }, [teardownDevice]);

  const sendData = useCallback((payload: string) => queueWrite(payload), [queueWrite]);

  const authenticate = useCallback(async (password: string): Promise<boolean> => {
    // Zrusit predchozi cekani pokud existuje
    const prevResolver = authResolverRef.current;
    if (prevResolver) {
      prevResolver(false);
    }
    authResolverRef.current = null;

    const authPromise = new Promise<boolean>((resolve) => {
      authResolverRef.current = resolve;
      // Timeout — pokud ESP32 neodpovi do 10s
      setTimeout(() => {
        if (authResolverRef.current === resolve) {
          authResolverRef.current = null;
          resolve(false);
        }
      }, 10000);
    });

    try {
      await queueWrite(`AUTH:${password}`);
    } catch (_err) {
      const currentResolver = authResolverRef.current as ((success: boolean) => void) | null;
      if (currentResolver) {
        currentResolver(false);
      }
      authResolverRef.current = null;
      return false;
    }

    const success = await authPromise;
    if (success) {
      storedPasswordRef.current = password;  // Zapamatovat pro auto-reauth
    }
    return success;
  }, [queueWrite]);

  useEffect(() => {
    if (status !== 'connected') {
      pendingPingsRef.current.clear();
      if (latencyIntervalRef.current !== null) {
        clearInterval(latencyIntervalRef.current);
        latencyIntervalRef.current = null;
      }
      return;
    }

    const sendLatencyPing = () => {
      if (!rxCharacteristicRef.current) {
        return;
      }
      const pingId = nextPingIdRef.current++;
      pendingPingsRef.current.set(pingId, performance.now());
      if (pendingPingsRef.current.size > MAX_PENDING_PINGS) {
        const iterator = pendingPingsRef.current.keys().next();
        if (!iterator.done) {
          pendingPingsRef.current.delete(iterator.value);
        }
      }
      queueWrite(`PING:${pingId}`).catch(err => {
        pendingPingsRef.current.delete(pingId);
        console.warn('Latency ping failed:', err);
      });
    };

    sendLatencyPing();
    latencyIntervalRef.current = window.setInterval(sendLatencyPing, LATENCY_PING_INTERVAL_MS);

    return () => {
      pendingPingsRef.current.clear();
      if (latencyIntervalRef.current !== null) {
        clearInterval(latencyIntervalRef.current);
        latencyIntervalRef.current = null;
      }
    };
  }, [queueWrite, status]);

  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  useEffect(() => {
    return () => {
      disconnectRef.current();
    };
  }, []);

  useEffect(() => {
    if (status === 'connected') {
      return;
    }
    lastHeartbeatRef.current = null;
    signalScoreRef.current = 0;
    setData(prev => {
      if (!prev?.system) {
        return prev;
      }
      if (prev.system.btStrength === 0) {
        return prev;
      }
      return { ...prev, system: { ...prev.system, btStrength: 0 } };
    });
  }, [status]);

  useEffect(() => {
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as typeof window & { enableBleAcks?: () => void }).enableBleAcks = () => {
        ackMetaRef.current.enabled = true;
        ackMetaRef.current.lastSentAt = 0;
        console.info('BLE ACKs re-enabled');
      };
    }
  }, []);

  useEffect(() => {
    if (!isSupported) {
      setIsAvailable(false);
      return;
    }

    navigator.bluetooth.getAvailability()
      .then(available => {
        setIsAvailable(available);
        if (!available) {
          setStatus('error');
          setError('Bluetooth není k dispozici na tomto zařízení');
        }
      })
      .catch(() => {
        setIsAvailable(false);
      });
  }, [isSupported]);

  return {
    status,
    data,
    error,
    connect,
    disconnect,
    sendData,
    authenticate,
    isAuthenticated,
    isSupported,
    isAvailable
  };
}
