import { memo, useEffect, useMemo, useState } from 'react';
import styles from './GMeter.module.css';

interface GForceVector {
	x: number;
	y: number;
}

interface GMeterProps {
	/**
	 * Optional externally provided G-force data (e.g., from BLE).
	 * When omitted, the component runs a showcase animation.
	 */
	gForce?: GForceVector;
}

const LEVEL_RADIUS = 75;
const LEVELS = [0.5, 1, 1.5, 2];
const DEFAULT_LEVEL_STEP = 0.5;
const VISIBLE_MAX_G = LEVELS[LEVELS.length - 1] ?? 1;
const LEVEL_STEP =
	LEVELS.length > 1
		? LEVELS[1] - LEVELS[0]
		: LEVELS.length === 1
			? LEVELS[0]
			: DEFAULT_LEVEL_STEP;
const DISPLAY_MAX_G = VISIBLE_MAX_G + LEVEL_STEP;
const PIXELS_PER_G = VISIBLE_MAX_G === 0 ? 0 : LEVEL_RADIUS / VISIBLE_MAX_G;
const POINTER_RADIUS = PIXELS_PER_G * DISPLAY_MAX_G;
const MAX_PEAK_G = 4;
const TRACE_LENGTH = 32;

const getMagnitude = (vector: GForceVector) => Math.sqrt(vector.x ** 2 + vector.y ** 2);

const clampVectorToMagnitude = (vector: GForceVector, maxMagnitude: number): GForceVector => {
	const magnitude = getMagnitude(vector);
	if (magnitude <= maxMagnitude || magnitude === 0) return vector;
	const scale = maxMagnitude / magnitude;
	return {
		x: vector.x * scale,
		y: vector.y * scale
	};
};

interface TracePoint {
	x: number;
	y: number;
	intensity: number;
}

function GMeter({ gForce }: GMeterProps) {
	if (!gForce) {
		return null;
	}

	const [currentForce, setCurrentForce] = useState<GForceVector>(gForce);
	const [trace, setTrace] = useState<TracePoint[]>([]);
	const [peak, setPeak] = useState(0);

	useEffect(() => {
		setCurrentForce(gForce);
	}, [gForce]);

	useEffect(() => {
		const tracePoint = projectToSvg(currentForce);

		setTrace(prev => {
			const appended = [...prev, tracePoint];
			const trimmed = appended.slice(-TRACE_LENGTH);
			const length = trimmed.length;
			return trimmed.map((point, index) => ({
				...point,
				intensity: (index + 1) / length
			}));
		});

		const magnitude = Math.min(MAX_PEAK_G, getMagnitude(currentForce));
		setPeak(prev => Math.max(prev, magnitude));
	}, [currentForce]);

	const pointerPoint = trace[trace.length - 1] ?? projectToSvg(currentForce);
	const currentMagnitude = Math.min(MAX_PEAK_G, getMagnitude(currentForce));

	const tracePolyline = useMemo(() => {
		if (trace.length < 2) return '';
		return trace.map(point => `${point.x},${point.y}`).join(' ');
	}, [trace]);

	return (
		<div className={styles.gMeterContainer}>
			<div className={styles.header}>
				<svg className={styles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
					<path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" />
					<circle cx="12" cy="12" r="2" fill="currentColor" />
				</svg>
				<h3 className={styles.title}>Přetížení</h3>
			</div>

			<div className={styles.gaugeWrapper}>
				<svg
					className={styles.gaugeSvg}
					viewBox="0 0 200 200"
					role="img"
					aria-label={`Aktuální přetížení ${currentMagnitude.toFixed(2)} G`}
				>

					<circle cx="100" cy="100" r={POINTER_RADIUS} className={styles.outerRing} />

					{LEVELS.map(level => {
						const radius = VISIBLE_MAX_G === 0 ? 0 : (level / VISIBLE_MAX_G) * LEVEL_RADIUS;
						return (
							<g key={level}>
								<circle
									cx="100"
									cy="100"
									r={radius}
									className={styles.levelCircle}
								/>
								<text
									x="100"
									y={100 - radius - 4}
									className={styles.levelLabel}
								>
									{level.toFixed(1)}G
								</text>
							</g>
						);
					})}

					<line x1="25" y1="100" x2="175" y2="100" className={styles.crosshair} />
					<line x1="100" y1="25" x2="100" y2="175" className={styles.crosshair} />

					{trace.length > 1 && tracePolyline && (
						<g className={styles.traceLayer}>
							<polyline points={tracePolyline} className={styles.traceLine} />
							{trace.map((point, index) => (
								<circle
									key={`trace-${index}`}
									cx={point.x}
									cy={point.y}
									r={1.5 + point.intensity * 2.5}
									className={styles.traceDot}
									style={{ opacity: 0.2 + point.intensity * 0.5 }}
								/>
							))}
						</g>
					)}

					<g className={styles.pointerGroup} transform={`translate(${pointerPoint.x}, ${pointerPoint.y})`}>
						<circle r={10} className={styles.pointerHalo} />
						<circle r={5} className={styles.pointerCore} />
					</g>

				</svg>
			</div>

			<p className={styles.peak}>
				Aktuální přetížení <span className={styles.peakValue}>{currentMagnitude.toFixed(2)} G</span>
			</p>

			<p className={styles.peak}>
				Peak přetížení <span className={styles.peakValue}>{peak.toFixed(2)} G</span>
			</p>
		</div>
	);
}

function projectToSvg(vector: GForceVector): TracePoint {
	const clamped = clampVectorToMagnitude(vector, DISPLAY_MAX_G);
	const normalized = {
		x: DISPLAY_MAX_G === 0 ? 0 : clamped.x / DISPLAY_MAX_G,
		y: DISPLAY_MAX_G === 0 ? 0 : clamped.y / DISPLAY_MAX_G
	};

	return {
		x: 100 + normalized.x * POINTER_RADIUS,
		y: 100 - normalized.y * POINTER_RADIUS,
		intensity: 1
	};
}

export default memo(GMeter);
