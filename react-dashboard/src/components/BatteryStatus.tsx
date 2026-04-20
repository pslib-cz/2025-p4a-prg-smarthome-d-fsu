import styles from './BatteryStatus.module.css';

interface BatteryTelemetry {
	voltage?: number;
	currentA?: number;
	drawnMah?: number;
	powerW?: number;
}

interface BatteryStatusProps {
	batteryData?: BatteryTelemetry;
}

// 2200 mAh battery, 80% DoD = 1760 mAh usable
const BATTERY_CAPACITY_MAH = 2200;
const SAFE_USABLE_MAH = 1760;

const GAUGE_RADIUS = 62;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

const clampLevel = (value: number) => Math.max(0, Math.min(1, value));

function BatteryStatus({ batteryData }: BatteryStatusProps) {
	if (!batteryData) {
		return null;
	}

	const drawnMah = batteryData.drawnMah ?? 0;
	const remaining = Math.max(0, SAFE_USABLE_MAH - drawnMah);
	const level = clampLevel(remaining / SAFE_USABLE_MAH);
	const percentage = Math.round(level * 100);
	const dashOffset = GAUGE_CIRCUMFERENCE * (1 - level);

	const isLow = percentage <= 20;
	const isCritical = percentage <= 10;

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
					<rect x="3" y="6" width="16" height="12" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none" />
					<rect x="19" y="10" width="2" height="4" rx="1" fill="currentColor" />
				</svg>
				<h3 className={styles.title}>Baterie</h3>
			</div>

			<div className={styles.content}>
				<div className={styles.statsColumn}>
					<div className={styles.statRow}>
						<span className={styles.statLabel}>Napětí</span>
						<span className={styles.statValue}>
							{batteryData.voltage !== undefined ? `${batteryData.voltage.toFixed(2)} V` : '—'}
						</span>
					</div>
					<div className={styles.statRow}>
						<span className={styles.statLabel}>Proud</span>
						<span className={styles.statValue}>
							{batteryData.currentA !== undefined ? `${batteryData.currentA.toFixed(1)} A` : '—'}
						</span>
					</div>
					<div className={styles.statRow}>
						<span className={styles.statLabel}>Výkon</span>
						<span className={styles.statValue}>
							{batteryData.powerW !== undefined ? `${batteryData.powerW.toFixed(0)} W` : '—'}
						</span>
					</div>
					<div className={styles.statRow}>
						<span className={styles.statLabel}>Odebráno</span>
						<span className={styles.statValue}>
							{`${Math.round(drawnMah)} mAh`}
						</span>
					</div>
					<div className={styles.statRow}>
						<span className={styles.statLabel}>Kapacita</span>
						<span className={styles.statValueSmall}>
							{`${BATTERY_CAPACITY_MAH} mAh`}
						</span>
					</div>
				</div>

				<div
					className={styles.gaugeWrapper}
					role="img"
					aria-label={`Zbývající kapacita baterie ${percentage}%`}
				>
					<svg className={styles.gaugeSvg} viewBox="0 0 160 160">
						<circle
							className={styles.progressTrack}
							cx="80"
							cy="80"
							r={GAUGE_RADIUS}
							transform="rotate(-90 80 80)"
						/>
						<circle
							className={`${styles.progressValue} ${isCritical ? styles.critical : isLow ? styles.low : ''}`}
							cx="80"
							cy="80"
							r={GAUGE_RADIUS}
							transform="rotate(-90 80 80)"
							strokeDasharray={GAUGE_CIRCUMFERENCE}
							strokeDashoffset={dashOffset}
						/>
					</svg>

					<div className={styles.percentageOverlay}>
						<span className={`${styles.percentageValue} ${isCritical ? styles.criticalText : isLow ? styles.lowText : ''}`}>{percentage}%</span>
						<span className={styles.percentageLabel}>zbývá</span>
					</div>
				</div>
			</div>
		</div>
	);
}

export default BatteryStatus;
