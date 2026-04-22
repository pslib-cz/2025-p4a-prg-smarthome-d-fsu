import { useHomeAssistant } from '../hooks/useHomeAssistant';
import { useDfsuDemo } from '../hooks/useDfsuDemo';
import ThemeToggle from './ThemeToggle';
import ExitButton from './ExitButton';
import styles from './DfsuDashboard.module.css';
import type { DfsuImpact, DfsuTelemetry, HaStatus } from '../types/dfsu';

// Public read-only dashboard for D-FSU. Data flows ESP32 → Mosquitto →
// Home Assistant → this page over a WebSocket. Token is a long-lived
// read-only HA user token baked at build time.

function formatTime(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return d.toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatRuntime(min: number): string {
  // 0xFFFF = firmware "unknown" sentinel (avg load not yet learned).
  if (min >= 65535) return '—';
  if (min < 1) return '< 1m';
  if (min >= 2880) {  // > 2 days → show days
    const days = Math.floor(min / 1440);
    const hours = Math.floor((min % 1440) / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function batteryClass(pct: number): string {
  if (pct < 10) return styles.crit;
  if (pct < 20) return styles.warn;
  return '';
}

// Small animated box SVG that mirrors caseOpen state.
function BoxIcon({ open }: { open: boolean }) {
  return (
    <svg className={styles.boxVis} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* body */}
      <rect x="18" y="46" width="64" height="38" stroke="currentColor" strokeWidth="2" />
      {/* lid */}
      <g
        style={{
          transform: open ? 'translateY(-14px)' : 'translateY(0)',
          transition: 'transform 600ms cubic-bezier(.2,.8,.2,1)',
          transformOrigin: '50px 46px',
        }}
      >
        <rect x="14" y="40" width="72" height="8" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.08" />
      </g>
    </svg>
  );
}

interface DfsuDashboardViewProps {
  status: HaStatus;
  error: string | null;
  telemetry: DfsuTelemetry | null;
  impacts: DfsuImpact[];
  demo?: boolean;
}

export function DfsuDashboardView({ status, error, telemetry, impacts, demo = false }: DfsuDashboardViewProps) {
  const live = status === 'authed' && telemetry !== null;
  const statusLabel = demo ? 'Demo' :
    status === 'authed' ? (telemetry ? 'Live' : 'Waiting') :
    status === 'connecting' ? 'Connecting' :
    status === 'error' ? 'Error' :
    status === 'closed' ? 'Reconnecting' : 'Idle';
  const dotClass = live ? styles.live : status === 'error' ? styles.err : '';

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>D-FSU</span>
            <span className={styles.brandSub}>Přepravní box</span>
          </div>
        </div>
        <div className={styles.topActions}>
          <span className={styles.statusPill}>
            <span className={`${styles.statusDot} ${dotClass}`} />
            {statusLabel}
          </span>
          <ThemeToggle />
          <ExitButton />
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {!telemetry ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>
            {status === 'error' ? 'Nelze se připojit' : 'Čekám na první data z boxu'}
          </span>
        </div>
      ) : (
        <>
          <section className={styles.hero}>
            <div className={styles.heroBig}>
              <span className={styles.heroBigLabel}>Stav pouzdra</span>
              <span className={`${styles.heroBigValue} ${telemetry.caseOpen ? styles.accent : ''}`}>
                {telemetry.caseOpen ? 'OTEVŘENO' : 'ZAVŘENO'}
              </span>
              <BoxIcon open={telemetry.caseOpen} />
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroBigLabel}>Teplota</span>
              <span className={styles.heroBigValue}>
                {telemetry.temperatureC.toFixed(1)}<span className={styles.metricUnit}>°C</span>
              </span>
              <span className={styles.metricSub}>
                Tlak {telemetry.pressureHpa ? telemetry.pressureHpa.toFixed(0) : '—'} hPa
              </span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroBigLabel}>Vlhkost</span>
              <span className={styles.heroBigValue}>
                {telemetry.humidityPct.toFixed(0)}<span className={styles.metricUnit}>%</span>
              </span>
              <span className={styles.metricSub}>Relativní vlhkost vzduchu</span>
            </div>
          </section>

          <section className={styles.grid}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Baterie</span>
              <span className={styles.metricValue}>
                {telemetry.battery.pct}<span className={styles.metricUnit}>%</span>
              </span>
              <div className={styles.bar}>
                <div
                  className={`${styles.barFill} ${batteryClass(telemetry.battery.pct)}`}
                  style={{ width: `${Math.min(100, Math.max(0, telemetry.battery.pct))}%` }}
                />
              </div>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Napětí</span>
              <span className={styles.metricValue}>
                {(telemetry.battery.voltageMv / 1000).toFixed(2)}<span className={styles.metricUnit}>V</span>
              </span>
              <span className={styles.metricSub}>{telemetry.battery.voltageMv} mV</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Proud</span>
              <span className={styles.metricValue}>
                {Math.abs(telemetry.battery.currentMa)}<span className={styles.metricUnit}>mA</span>
              </span>
              <span className={`${styles.trend} ${telemetry.charging ? '' : styles.discharge}`}>
                {telemetry.charging ? '↓ Nabíjení' : '↑ Vybíjení'}
              </span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Spotřebováno</span>
              <span className={styles.metricValue}>
                {telemetry.battery.consumptionMah}<span className={styles.metricUnit}>mAh</span>
              </span>
              <span className={styles.metricSub}>Od posledního resetu</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Výdrž · otevřený</span>
              <span className={styles.metricSmall}>
                {formatRuntime(telemetry.battery.runtimeOpenMin)}
              </span>
              <span className={styles.metricSub}>Odhad při aktuálním odběru</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Výdrž · zavřený</span>
              <span className={styles.metricSmall}>
                {formatRuntime(telemetry.battery.runtimeClosedMin)}
              </span>
              <span className={styles.metricSub}>Odhad v režimu spánku</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Posledni update</span>
              <span className={styles.metricSmall}>{formatTime(telemetry.timestampMs)}</span>
              <span className={styles.metricSub}>ESP32 časové razítko</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Počet nárazů</span>
              <span className={styles.metricValue}>{impacts.length}</span>
              <span className={styles.metricSub}>V této relaci</span>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Historie nárazů</h2>
              <span className={styles.sectionCount}>
                {impacts.length === 0 ? 'Žádné události' : `Posledních ${impacts.length}`}
              </span>
            </div>
            {impacts.length === 0 ? (
              <div className={styles.placeholder}>
                Žádné nárazy zatím nebyly zaznamenány. Zatřeste boxem nebo mu dejte ránu.
              </div>
            ) : (
              <ul className={styles.impactList}>
                {impacts.map((ev) => (
                  <li key={`${ev.id}-${ev.timestampMs}`} className={styles.impactItem}>
                    <div className={styles.impactSeverity}>
                      <span className={styles.impactPeak}>
                        {ev.peakG.toFixed(2)}
                        {ev.count > 1 && <span className={styles.impactBurst}> ×{ev.count}</span>}
                      </span>
                      <span className={styles.impactPeakUnit}>
                        {ev.count > 1 ? 'Peak G · Série' : 'Peak G'}
                      </span>
                    </div>
                    <div className={styles.impactAxes}>
                      <span className={styles.impactAxis}>
                        <span className={styles.impactAxisKey}>X</span>{ev.gX.toFixed(2)}
                      </span>
                      <span className={styles.impactAxis}>
                        <span className={styles.impactAxisKey}>Y</span>{ev.gY.toFixed(2)}
                      </span>
                      <span className={styles.impactAxis}>
                        <span className={styles.impactAxisKey}>Z</span>{ev.gZ.toFixed(2)}
                      </span>
                    </div>
                    <span className={styles.impactTime}>{formatTime(ev.timestampMs)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <footer className={styles.footer}>
        {demo ? 'Demo režim · simulovaná data' : 'ESP32-S3 · Mosquitto · Home Assistant · Cloudflare Tunnel'}
      </footer>
    </div>
  );
}

export default function DfsuDashboard() {
  const data = useHomeAssistant();
  return <DfsuDashboardView {...data} />;
}

export function DfsuDemoDashboard() {
  const data = useDfsuDemo();
  return <DfsuDashboardView {...data} demo />;
}
