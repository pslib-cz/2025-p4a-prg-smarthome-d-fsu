import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './PartyModeOverlay.module.css';

/** Duration of the party mode in seconds (3 phases × 5s each). */
const PARTY_DURATION_S = 15;
const TICK_INTERVAL_MS = 100;

const CIRCLE_RADIUS = 88;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

interface PartyModeOverlayProps {
	onComplete: () => void;
	onCancel: () => void;
}

export default function PartyModeOverlay({ onComplete, onCancel }: PartyModeOverlayProps) {
	const [remainingMs, setRemainingMs] = useState(PARTY_DURATION_S * 1000);
	const startTimeRef = useRef(performance.now());
	const rafRef = useRef<number | null>(null);

	const tick = useCallback(() => {
		const elapsed = performance.now() - startTimeRef.current;
		const remaining = Math.max(0, PARTY_DURATION_S * 1000 - elapsed);
		setRemainingMs(remaining);

		if (remaining <= 0) {
			onComplete();
			return;
		}

		rafRef.current = requestAnimationFrame(tick);
	}, [onComplete]);

	useEffect(() => {
		// Use setInterval for reliable ticking + rAF for smooth ring animation
		const intervalId = setInterval(() => {
			const elapsed = performance.now() - startTimeRef.current;
			const remaining = Math.max(0, PARTY_DURATION_S * 1000 - elapsed);
			setRemainingMs(remaining);

			if (remaining <= 0) {
				clearInterval(intervalId);
				onComplete();
			}
		}, TICK_INTERVAL_MS);

		return () => {
			clearInterval(intervalId);
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [onComplete, tick]);

	const remainingSeconds = Math.ceil(remainingMs / 1000);
	const progress = remainingMs / (PARTY_DURATION_S * 1000);
	const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - progress);

	return (
		<div className={styles.overlay} role="alertdialog" aria-label="Party Mode probíhá">
			<div className={styles.title}>
				PARTY MODE
			</div>

			<div className={styles.timerRing}>
				<svg className={styles.timerSvg} viewBox="0 0 200 200">
					<circle
						className={styles.timerTrack}
						cx="100"
						cy="100"
						r={CIRCLE_RADIUS}
					/>
					<circle
						className={styles.timerProgress}
						cx="100"
						cy="100"
						r={CIRCLE_RADIUS}
						strokeDasharray={CIRCLE_CIRCUMFERENCE}
						strokeDashoffset={dashOffset}
					/>
				</svg>
				<span className={styles.timerValue}>{remainingSeconds}</span>
			</div>

			<button
				type="button"
				className={styles.cancelButton}
				onClick={onCancel}
			>
				Zrušit
			</button>
		</div>
	);
}
