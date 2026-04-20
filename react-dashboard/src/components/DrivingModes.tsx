import { useState } from 'react';
import steeringWheelIcon from '../assets/steering-wheel.svg';
import styles from './DrivingModes.module.css';

export type DrivingMode = 'race' | 'eco' | 'drift' | 'custom' | 'off';

interface DrivingModesProps {
	/**
	 * Optional externally provided active mode (e.g., from BLE/controller).
	 * When omitted, the component keeps local state.
	 */
	activeMode?: DrivingMode;
	/**
	 * Callback fired whenever local selection changes.
	 */
	onChange?: (mode: DrivingMode) => void;
	/**
	 * Fires when the user presses the Party Mode button.
	 */
	onPartyMode?: () => void;
	/**
	 * Whether party mode is currently running (disables the button).
	 */
	partyModeActive?: boolean;
	/**
	 * Initial mode used while waiting for external data.
	 */
	defaultMode?: DrivingMode;
}

const MODES: { id: DrivingMode; label: string }[] = [
	{ id: 'race', label: 'RACE' },
	{ id: 'eco', label: 'ECO' },
	{ id: 'drift', label: 'DRIFT' },
	{ id: 'custom', label: 'CUSTOM' },
	{ id: 'off', label: 'OFF' }
];

function isValidMode(mode: string | undefined): mode is DrivingMode {
	return MODES.some(item => item.id === mode);
}

export default function DrivingModes({
	activeMode,
	onChange,
	onPartyMode,
	partyModeActive = false,
	defaultMode = 'race'
}: DrivingModesProps) {
	const fallbackDefault: DrivingMode = isValidMode(defaultMode) ? defaultMode : 'race';
	const [localMode, setLocalMode] = useState<DrivingMode>(fallbackDefault);
	const resolvedExternal = isValidMode(activeMode) ? activeMode : undefined;
	const currentMode = resolvedExternal ?? localMode;

	const handleSelect = (mode: DrivingMode) => {
		if (mode === currentMode) return;

		if (!resolvedExternal) {
			setLocalMode(mode);
		}

		onChange?.(mode);
	};

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<img src={steeringWheelIcon} alt="" className={styles.icon} aria-hidden="true" />
				<h3 className={styles.title}>Jízdní režimy</h3>
			</div>

			<div className={styles.modesRow} role="radiogroup" aria-label="Volba jízdního režimu">
				{MODES.map(({ id, label }) => {
					const selected = currentMode === id;
					return (
						<button
							key={id}
							type="button"
							className={`${styles.modeButton} ${selected ? styles.selected : ''}`}
							onClick={() => handleSelect(id)}
							aria-pressed={selected}
							role="radio"
							aria-checked={selected}
							disabled={partyModeActive}
						>
							{label}
						</button>
					);
				})}

				<button
					type="button"
					className={`${styles.modeButton} ${styles.partyButton}`}
					onClick={onPartyMode}
					disabled={partyModeActive}
					aria-label="Spustit Party Mode"
				>
					PARTY
				</button>
			</div>
		</div>
	);
}

