import { type ChangeEvent } from 'react';
import styles from './AssistantToggles.module.css';

export interface AssistantState {
  antiRoll: boolean;
  antiSquat: boolean;
  antiDive: boolean;
}

interface AssistantTogglesProps {
  state: AssistantState;
  onChange: (id: keyof AssistantState, value: boolean) => void;
}

const ASSISTANTS: { id: keyof AssistantState; label: string; description: string }[] = [
  { id: 'antiRoll', label: 'Anti-roll', description: 'Stabilizace bočního náklonu v zatáčkách' },
  { id: 'antiSquat', label: 'Anti-squat', description: 'Kompenzace zadního propadu při akceleraci' },
  { id: 'antiDive', label: 'Anti-dive', description: 'Kompenzace předního propadu při brzdění' }
];

export default function AssistantToggles({ state, onChange }: AssistantTogglesProps) {
  const handleToggle = (id: keyof AssistantState) => (e: ChangeEvent<HTMLInputElement>) => {
    onChange(id, e.target.checked);
  };

  return (
    <div className={styles.container}>
      {ASSISTANTS.map(({ id, label, description }) => {
        const active = state[id];
        return (
          <label key={id} className={`${styles.toggleRow} ${active ? styles.rowActive : ''}`}>
            <div className={styles.labelBlock}>
              <span className={styles.name}>{label}</span>
              <span className={styles.desc}>{description}</span>
            </div>
            <div className={styles.toggleBtn}>
              <input
                type="checkbox"
                checked={active}
                onChange={handleToggle(id)}
                className={styles.hiddenInput}
              />
              <span className={`${styles.toggleLabel} ${active ? styles.on : styles.off}`}>
                {active ? 'ON' : 'OFF'}
              </span>
            </div>
          </label>
        );
      })}
    </div>
  );
}
