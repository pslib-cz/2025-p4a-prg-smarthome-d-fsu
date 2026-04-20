import adjustmentIcon from '../assets/adjustment.svg';
import tickIcon from '../assets/tick.svg';
import styles from './SystemStatus.module.css';

export interface StatusSnapshot {
	btStrength: number; // 0-4
	latencyMs?: number;
	gyroAlert: boolean;
	gyroOnline: boolean;
	batteryAlert: boolean;
	batteryLevel?: number;
	batteryVoltage?: number;
}

interface SystemStatusProps {
	/** Optional externally provided telemetry (e.g., BLE). */
	data?: StatusSnapshot;
}

const SIGNAL_BARS = [12, 18, 24, 30];

const clampStrength = (value: number) => Math.max(0, Math.min(SIGNAL_BARS.length, Math.round(value)));

function SignalBars({ strength }: { strength: number }) {
	const normalized = clampStrength(strength);
	return (
		<svg className={styles.signalSvg} viewBox="0 0 40 36" aria-hidden="true">
			{SIGNAL_BARS.map((height, index) => {
				const barWidth = 6;
				const gap = 4;
				const x = index * (barWidth + gap);
				const active = index < normalized;
				const barClass = active ? styles.signalBarActive : styles.signalBarIdle;
				return (
					<rect
						key={index}
						x={x}
						y={36 - height}
						width={barWidth}
						height={height}
						rx={1.5}
						className={barClass}
					/>
				);
			})}
		</svg>
	);
}

const resolveSignalDescriptor = (strength: number) => {
	const normalized = clampStrength(strength);
	if (normalized >= 4) {
		return { label: 'Stabilní', tone: styles.signalGood };
	}
	if (normalized === 3) {
		return { label: 'Silný', tone: styles.signalGood };
	}
	if (normalized === 2) {
		return { label: 'Kolísá', tone: styles.signalWarn };
	}
	if (normalized === 1) {
		return { label: 'Slabý', tone: styles.signalCrit };
	}
	return { label: 'Žádný', tone: styles.signalCrit };
};

const formatLatency = (latency?: number) =>
	latency !== undefined && Number.isFinite(latency) ? `${Math.round(latency)} ms` : '—';

const getLatencyClass = (latency?: number) => {
	if (latency === undefined || !Number.isFinite(latency)) {
		return styles.latencyUnknown;
	}
	if (latency < 100) {
		return styles.latencyGood;
	}
	if (latency < 200) {
		return styles.latencyNeutral;
	}
	return styles.latencyBad;
};

function StatusIndicator({ isOk, okLabel, failLabel }: { isOk: boolean; okLabel: string; failLabel: string }) {
	return (
		<div className={styles.statusIndicator}>
			{isOk ? (
				<img src={tickIcon} alt={okLabel} className={styles.tickIcon} />
			) : (
				<div className={styles.warningIcon} role="img" aria-label={failLabel} />
			)}
		</div>
	);
}

export default function SystemStatus({ data }: SystemStatusProps) {
	if (!data) {
		return null;
	}

	const signalDescriptor = resolveSignalDescriptor(data.btStrength);
	const batteryHasInfo = data.batteryVoltage !== undefined || data.batteryLevel !== undefined;
	const batteryOk = batteryHasInfo && !data.batteryAlert;

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<img src={adjustmentIcon} alt="" className={styles.headerIcon} aria-hidden="true" />
				<h3 className={styles.title}>Stav systému</h3>
			</div>

			<div className={styles.metricsGrid}>
				<div className={styles.metric}>
					<p className={styles.label}>BT signál</p>
					<div className={styles.signalIndicator}>
						<SignalBars strength={data.btStrength} />
					</div>
					<p className={`${styles.statusCaption} ${signalDescriptor.tone}`}>
						{signalDescriptor.label}
					</p>
				</div>

				<div className={styles.metric}>
					<p className={styles.label}>Latence</p>
					<p className={`${styles.latencyValue} ${getLatencyClass(data.latencyMs)}`}>
						{formatLatency(data.latencyMs)}
					</p>
				</div>

				<div className={styles.metric}>
					<p className={styles.label}>Gyroskop</p>
					<StatusIndicator
						isOk={data.gyroOnline}
						okLabel="MPU připojeno"
						failLabel="MPU bez dat"
					/>
				</div>

				<div className={styles.metric}>
					<p className={styles.label}>Batt. info</p>
					<StatusIndicator
						isOk={batteryOk}
						okLabel="Baterie aktivní"
						failLabel={batteryHasInfo ? 'Varování baterie' : 'Baterie bez dat'}
					/>
				</div>
			</div>
		</div>
	);
}
