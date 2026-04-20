import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Card from './Card';
import BatteryGauge from './BatteryGauge';
import BatteryStatus from './BatteryStatus';
import DrivingModes, { type DrivingMode } from './DrivingModes';
import SystemStatus, { type StatusSnapshot } from './SystemStatus';
import GMeter from './GMeter';
import Inclinometer from './Inclinometer';
import SuspensionStatus from './SuspensionStatus';
import ControlSlider from './ControlSlider';
import AdvancedControls, { type AdvancedControlId, ADVANCED_CONTROL_CONFIG } from './AdvancedControls';
import SuspensionHeightControls, { type SuspensionCornerId, HEIGHT_CONTROL_CONFIG } from './SuspensionHeightControls';
import AssistantToggles, { type AssistantState } from './AssistantToggles';
import CorrelationChart, { type ChartDataPoint } from './CorrelationChart';
import InterventionMonitor from './InterventionMonitor';
import PeakValues from './PeakValues';
import PartyModeOverlay from './PartyModeOverlay';
import styles from './Dashboard.module.css';
import carSideView from '../assets/car-side-view.svg';
import carBackSide from '../assets/car-back-side.svg';
import suspensionIcon from '../assets/suspension.svg';
import type { BLEData } from '../hooks/useBLE';

type PresetMode = 'race' | 'eco' | 'drift';

const MODE_PRESETS: Record<PresetMode, {
  advanced: Record<AdvancedControlId, number>;
  height: Record<SuspensionCornerId, number>;
}> = {
  race: {
    advanced: {
      stability: 55,
      powerSplit: 80,
      throttle: 70,
      brakeBalance: 75
    },
    height: {
      frontLeft: -0.3,
      frontRight: -0.3,
      rearLeft: -0.1,
      rearRight: -0.1
    }
  },
  eco: {
    advanced: {
      stability: 85,
      powerSplit: 60,
      throttle: 40,
      brakeBalance: 65
    },
    height: {
      frontLeft: 0.2,
      frontRight: 0.2,
      rearLeft: 0.2,
      rearRight: 0.2
    }
  },
  drift: {
    advanced: {
      stability: 35,
      powerSplit: 90,
      throttle: 85,
      brakeBalance: 45
    },
    height: {
      frontLeft: -0.2,
      frontRight: -0.2,
      rearLeft: 0.2,
      rearRight: 0.2
    }
  }
};

const formatHeight = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}mm`;

const CHART_HISTORY_SIZE = 30;

type ChassisTab = 'telemetry' | 'assistants';

interface DashboardProps {
  telemetry: BLEData | null;
  onSendCommand?: (message: string) => Promise<void>;
}

export default function Dashboard({ telemetry, onSendCommand }: DashboardProps) {
  if (!telemetry) {
    return null;
  }

  const [drivingMode, setDrivingMode] = useState<DrivingMode>('race');
  const [advancedValues, setAdvancedValues] = useState<Record<AdvancedControlId, number>>(
    () => ({ ...MODE_PRESETS.race.advanced })
  );
  const [heightValues, setHeightValues] = useState<Record<SuspensionCornerId, number>>(
    () => ({ ...MODE_PRESETS.race.height })
  );
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isHeightOpen, setIsHeightOpen] = useState(false);
  const [chassisTab, setChassisTab] = useState<ChassisTab>('telemetry');
  const [assistantState, setAssistantState] = useState<AssistantState>({
    antiRoll: true,
    antiSquat: true,
    antiDive: true
  });

  // Peak values tracking
  const [peakValues, setPeakValues] = useState({
    maxLateralG: 0,
    maxLongitudinalG: 0,
    maxRoll: 0,
    maxPitch: 0
  });
  const [peakPower, setPeakPower] = useState(0);

  // Chart history
  const [chartHistory, setChartHistory] = useState<ChartDataPoint[]>([]);
  const chartTickRef = useRef(0);
  const prevDashRef = useRef<NonNullable<BLEData['dash']> | null>(null);

  // Party mode state
  const [partyModeActive, setPartyModeActive] = useState(false);

  // Update peaks and chart history from telemetry
  useEffect(() => {
    if (!telemetry) return;

    const gX = Math.abs(telemetry.imu?.gForce?.x ?? 0);
    const gY = Math.abs(telemetry.imu?.gForce?.y ?? 0);
    const roll = Math.abs(telemetry.imu?.rollDeg ?? 0);
    const pitch = Math.abs(telemetry.imu?.pitchDeg ?? 0);

    setPeakValues(prev => ({
      maxLateralG: Math.max(prev.maxLateralG, gY),
      maxLongitudinalG: Math.max(prev.maxLongitudinalG, gX),
      maxRoll: Math.max(prev.maxRoll, roll),
      maxPitch: Math.max(prev.maxPitch, pitch)
    }));

    const currentPower = telemetry.power ?? 0;
    setPeakPower(prev => Math.max(prev, currentPower));

    // Add chart point every update (telemetry is already throttled to ~10Hz)
    chartTickRef.current += 1;
    if (chartTickRef.current % 10 === 0) {
      const point: ChartDataPoint = {
        time: new Date().toLocaleTimeString('cs-CZ', { minute: '2-digit', second: '2-digit' }),
        lateralG: Math.round(Math.abs(telemetry.imu?.gForce?.y ?? 0) * 100) / 100,
        rollAngle: Math.round(Math.abs(telemetry.imu?.rollDeg ?? 0) * 10) / 10,
        chassisPwm: Math.round(telemetry.control?.chassisPwm ?? 0),
        yawRate: Math.round(Math.abs(telemetry.imu?.yawRate ?? 0) * 10) / 10,
        steeringPosition: Math.round(Math.abs(telemetry.control?.steeringPosition ?? 0) * 10) / 10,
        powerReduction: Math.round(telemetry.control?.rearPowerReduction ?? 0)
      };

      setChartHistory(prev => {
        const next = [...prev, point];
        if (next.length > CHART_HISTORY_SIZE) {
          return next.slice(next.length - CHART_HISTORY_SIZE);
        }
        return next;
      });
    }
  }, [telemetry]);

  // Latest-change-wins sync from telemetry.dash
  useEffect(() => {
    if (!telemetry?.dash) return;
    const current = telemetry.dash;
    const prev = prevDashRef.current;
    
    // DEBUG Z LOGU:
    console.log("[Dashboard Sync] Telemetry dash update:", current);

    if (prev) {
      if (current.heightFL !== prev.heightFL || current.heightFR !== prev.heightFR || 
          current.heightRL !== prev.heightRL || current.heightRR !== prev.heightRR) {
        setHeightValues(prevVals => ({
          ...prevVals,
          frontLeft: current.heightFL ?? prevVals.frontLeft,
          frontRight: current.heightFR ?? prevVals.frontRight,
          rearLeft: current.heightRL ?? prevVals.rearLeft,
          rearRight: current.heightRR ?? prevVals.rearRight
        }));
      }

      if (current.drivingMode !== prev.drivingMode) {
        if (current.drivingMode === 1) setDrivingMode('eco');
        else if (current.drivingMode === 0) setDrivingMode('race');
        else if (current.drivingMode === 2) setDrivingMode('drift');
        else if (current.drivingMode === 4) setDrivingMode('off');
        else setDrivingMode('custom');
      }

      if (current.triggerPartyMode && !prev.triggerPartyMode) {
        setPartyModeActive(true);
      }

      if (current.antiRollEnabled !== prev.antiRollEnabled || 
          current.antiSquatEnabled !== prev.antiSquatEnabled || 
          current.antiDiveEnabled !== prev.antiDiveEnabled) {
        setAssistantState(prevVals => ({
          ...prevVals,
          antiRoll: current.antiRollEnabled ?? prevVals.antiRoll,
          antiSquat: current.antiSquatEnabled ?? prevVals.antiSquat,
          antiDive: current.antiDiveEnabled ?? prevVals.antiDive
        }));
      }

      if (current.stability !== prev.stability || 
          current.powerSplit !== prev.powerSplit || 
          current.throttleCurve !== prev.throttleCurve || 
          current.brakeBalance !== prev.brakeBalance) {
        setAdvancedValues(prevVals => ({
          ...prevVals,
          stability: current.stability ?? prevVals.stability,
          powerSplit: current.powerSplit ?? prevVals.powerSplit,
          throttle: current.throttleCurve ?? prevVals.throttle,
          brakeBalance: current.brakeBalance ?? prevVals.brakeBalance
        }));
      }
    } else {
      // First sync
      setHeightValues({
        frontLeft: current.heightFL ?? 0,
        frontRight: current.heightFR ?? 0,
        rearLeft: current.heightRL ?? 0,
        rearRight: current.heightRR ?? 0
      });
      if (current.drivingMode === 1) setDrivingMode('eco');
      else if (current.drivingMode === 0) setDrivingMode('race');
      else if (current.drivingMode === 2) setDrivingMode('drift');
      else if (current.drivingMode === 4) setDrivingMode('off');
      else setDrivingMode('custom');
      
      setAssistantState({
        antiRoll: current.antiRollEnabled ?? true,
        antiSquat: current.antiSquatEnabled ?? true,
        antiDive: current.antiDiveEnabled ?? true
      });
      
      setAdvancedValues({
        stability: current.stability ?? 55,
        powerSplit: current.powerSplit ?? 80,
        throttle: current.throttleCurve ?? 70,
        brakeBalance: current.brakeBalance ?? 75
      });
    }

    prevDashRef.current = current;
  }, [telemetry?.dash]);

  const emitCommand = useCallback((type: string, payload: string) => {
    if (!onSendCommand) return;
    onSendCommand(`${type}:${payload}`).catch(err => {
      console.error('Failed to send control command', err);
    });
  }, [onSendCommand]);

  const handlePartyModeStart = useCallback(() => {
    setPartyModeActive(true);
    emitCommand('MODE', 'party');
  }, [emitCommand]);

  const handlePartyModeComplete = useCallback(() => {
    setPartyModeActive(false);
  }, []);

  const handlePartyModeCancel = useCallback(() => {
    setPartyModeActive(false);
    emitCommand('MODE', 'partyCancel');
  }, [emitCommand]);

  const isPresetMode = (mode: DrivingMode): mode is PresetMode =>
    mode === 'race' || mode === 'eco' || mode === 'drift';

  const applyPreset = (mode: PresetMode) => {
    const preset = MODE_PRESETS[mode];
    setAdvancedValues({ ...preset.advanced });
    setHeightValues({ ...preset.height });
    emitCommand('MODE', mode);
  };

  const handleModeChange = (mode: DrivingMode) => {
    setDrivingMode(mode);
    if (isPresetMode(mode)) {
      applyPreset(mode);
      return;
    }
    emitCommand('MODE', mode);
  };

  const ensureCustomMode = () => {
    setDrivingMode((prev: DrivingMode) => (prev === 'custom' ? prev : 'custom'));
  };

  const handleAdvancedValueChange = (id: AdvancedControlId, value: number) => {
    setAdvancedValues((prev) => ({ ...prev, [id]: value }));
    ensureCustomMode();
    emitCommand('SLIDER', `${id}:${value.toFixed(2)}`);
  };

  const handleHeightValueChange = (id: SuspensionCornerId, value: number) => {
    setHeightValues((prev) => ({ ...prev, [id]: value }));
    ensureCustomMode();
    emitCommand('SLIDER', `${id}:${value.toFixed(2)}`);
  };

  const handleAssistantToggle = (id: keyof AssistantState, value: boolean) => {
    setAssistantState((prev) => ({ ...prev, [id]: value }));
    emitCommand('ASSIST', `${id}:${value ? '1' : '0'}`);
  };

  const showControlSections = drivingMode !== 'off';

  const hasImuTelemetry = Boolean(telemetry.imu);
  const hasSuspensionTelemetry = Boolean(telemetry.suspension);
  const hasChassisSection = hasImuTelemetry && hasSuspensionTelemetry;

  const sideAngle = telemetry.imu?.rollDeg ?? 0;
  const frontBackAngle = telemetry.imu?.pitchDeg ?? 0;

  const gForceX = telemetry.imu?.gForce?.x;
  const gForceY = telemetry.imu?.gForce?.y;
  const gForce = useMemo(
    () => gForceX !== undefined && gForceY !== undefined ? { x: gForceX, y: gForceY } : undefined,
    [gForceX, gForceY]
  );

  const fl = telemetry.suspension?.frontLeft ?? 50;
  const fr = telemetry.suspension?.frontRight ?? 50;
  const rl = telemetry.suspension?.rearLeft ?? 50;
  const rr = telemetry.suspension?.rearRight ?? 50;
  const suspensionData = useMemo(
    () => telemetry.suspension ? {
      frontLeft: { position: fl },
      frontRight: { position: fr },
      rearLeft: { position: rl },
      rearRight: { position: rr }
    } : undefined,
    [fl, fr, rl, rr, !!telemetry.suspension]
  );

  const powerValue = telemetry.power;

  const bv = telemetry.battery?.voltage;
  const bc = telemetry.battery?.currentA;
  const bm = telemetry.battery?.drawnMah;
  const batteryStatusData = useMemo(
    () => bv !== undefined ? { voltage: bv!, currentA: bc!, drawnMah: bm! } : undefined,
    [bv, bc, bm]
  );

  const btStr = telemetry.system?.btStrength ?? 0;
  const latMs = telemetry.system?.latencyMs;
  const gyroA = telemetry.imu?.gyroAlert ?? false;
  const gyroOn = telemetry.system?.imuOnline ?? Boolean(telemetry.imu);
  const batA = telemetry.battery?.alert ?? false;
  const batL = telemetry.battery?.level;
  const batV = telemetry.battery?.voltage;
  const systemStatusData = useMemo<StatusSnapshot | undefined>(
    () => telemetry ? {
      btStrength: btStr,
      latencyMs: latMs,
      gyroAlert: gyroA,
      gyroOnline: gyroOn,
      batteryAlert: batA,
      batteryLevel: batL,
      batteryVoltage: batV
    } : undefined,
    [btStr, latMs, gyroA, gyroOn, batA, batL, batV, !!telemetry]
  );

  const interventionData = telemetry.interventions;
  
  return (
    <>
    <div className={styles.dashboardWrapper}>
      <div className={styles.dashboard}>
        {/* Row 1: Power gauge + Chassis + G-Meter */}
        {powerValue !== undefined && (
          <Card className={styles.battery} noPadding>
            <BatteryGauge power={powerValue} peakPower={peakPower} />
          </Card>
        )}

        {hasChassisSection && suspensionData && (
          <Card className={styles.chassis}>
            <div className={styles.chassisHeader}>
              <img src={suspensionIcon} alt="" className={styles.chassisIcon} />
              <h3 className={styles.chassisTitle}>Podvozek a odpružení</h3>
              <div className={styles.chassisTabs}>
                <button
                  type="button"
                  className={`${styles.chassisTab} ${chassisTab === 'telemetry' ? styles.activeTab : ''}`}
                  onClick={() => setChassisTab('telemetry')}
                >
                  Telemetrie
                </button>
                <button
                  type="button"
                  className={`${styles.chassisTab} ${chassisTab === 'assistants' ? styles.activeTab : ''}`}
                  onClick={() => setChassisTab('assistants')}
                >
                  Asistenti
                </button>
              </div>
            </div>
            {chassisTab === 'telemetry' ? (
              <div className={styles.chassisContent}>
                <div className={styles.inclinometers}>
                  <Inclinometer 
                    angle={sideAngle} 
                    label="Boční náklon" 
                    iconSrc={carSideView}
                    iconSize="large"
                  />
                  <Inclinometer 
                    angle={frontBackAngle} 
                    label="Přední/zadní náklon" 
                    iconSrc={carBackSide}
                    iconSize="normal"
                  />
                </div>
                <div className={styles.suspensionBlock}>
                  <div className={styles.suspensionWrapper}>
                    <SuspensionStatus
                      frontLeft={suspensionData.frontLeft}
                      frontRight={suspensionData.frontRight}
                      rearLeft={suspensionData.rearLeft}
                      rearRight={suspensionData.rearRight}
                    />
                  </div>
                  <p className={styles.suspensionCaption}>Výška odpružení</p>
                </div>
              </div>
            ) : (
              <div className={styles.chassisContent}>
                <AssistantToggles
                  state={assistantState}
                  onChange={handleAssistantToggle}
                />
              </div>
            )}
          </Card>
        )}

        {gForce && (
          <Card className={styles.overload} noPadding>
            <GMeter gForce={gForce} />
          </Card>
        )}

        {/* Row 2: Battery status + Driving modes + System status */}
        {batteryStatusData && (
          <Card className={styles.batteryStatus}>
            <BatteryStatus batteryData={{...batteryStatusData, powerW: powerValue}} />
          </Card>
        )}

        <Card className={styles.drivingModes}>
          <DrivingModes
            activeMode={drivingMode}
            onChange={handleModeChange}
            onPartyMode={handlePartyModeStart}
            partyModeActive={partyModeActive}
          />
        </Card>

        {systemStatusData && (
          <Card className={styles.systemStatus}>
            <SystemStatus data={systemStatusData} />
          </Card>
        )}

        {/* Row 3: Analytics row — inside main grid, above dropdowns */}
        <Card className={styles.interventionMonitor} noPadding>
          <InterventionMonitor
            tractionCount={interventionData?.tractionCount ?? 0}
            antiDiveActivity={interventionData?.antiDiveActivity ?? 0}
            antiSquatActivity={interventionData?.antiSquatActivity ?? 0}
          />
        </Card>

        <Card className={styles.correlationChart} noPadding>
          <CorrelationChart data={chartHistory} />
        </Card>

        <Card className={styles.peakValues} noPadding>
          <PeakValues
            maxLateralG={peakValues.maxLateralG}
            maxLongitudinalG={peakValues.maxLongitudinalG}
            maxRoll={peakValues.maxRoll}
            maxPitch={peakValues.maxPitch}
          />
        </Card>

        {/* Row 4: Advanced controls + Height controls */}
        {showControlSections && (
          <>
            <AdvancedControls
              isOpen={isAdvancedOpen}
              onToggle={() => setIsAdvancedOpen((prev) => !prev)}
              className={styles.advancedToggle}
            />

            {isAdvancedOpen &&
              ADVANCED_CONTROL_CONFIG.map((control) => (
                <div key={`adv-${control.id}`} className={styles.advancedSlider}>
                  <ControlSlider
                    label={control.label}
                    minLabel={control.minLabel}
                    maxLabel={control.maxLabel}
                    midLabel={control.midLabel}
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={advancedValues[control.id]}
                    onChange={(value) => handleAdvancedValueChange(control.id, value)}
                  />
                </div>
              ))}

            <SuspensionHeightControls
              isOpen={isHeightOpen}
              onToggle={() => setIsHeightOpen((prev) => !prev)}
              className={styles.heightToggle}
            />

            {isHeightOpen &&
              HEIGHT_CONTROL_CONFIG.map((control) => (
                <div key={`height-${control.id}`} className={styles.heightSlider}>
                  <ControlSlider
                    label={control.label}
                    minLabel="Min."
                    midLabel="Střed"
                    maxLabel="Max."
                    min={-3}
                    max={3}
                    step={0.1}
                    value={heightValues[control.id]}
                    formatValue={formatHeight}
                    onChange={(value) => handleHeightValueChange(control.id, value)}
                  />
                </div>
              ))}
          </>
        )}
      </div>
    </div>

    {partyModeActive && (
      <PartyModeOverlay
        onComplete={handlePartyModeComplete}
        onCancel={handlePartyModeCancel}
      />
    )}
  </>
  );
}
