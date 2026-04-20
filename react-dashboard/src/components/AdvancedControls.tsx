import styles from './AdvancedControls.module.css';

export type AdvancedControlId = 'stability' | 'powerSplit' | 'throttle' | 'brakeBalance';

export type AdvancedControlConfig = {
  id: AdvancedControlId;
  label: string;
  minLabel: string;
  maxLabel: string;
  midLabel?: string;
  min?: number;
  max?: number;
  step?: number;
};

export const ADVANCED_CONTROL_CONFIG: AdvancedControlConfig[] = [
  {
    id: 'stability',
    label: 'Citlivost stabilizace',
    minLabel: 'Žádná',
    maxLabel: 'Max.'
  },
  {
    id: 'powerSplit',
    label: 'Rozdělení výkonu',
    minLabel: 'FWD',
    midLabel: 'AWD',
    maxLabel: 'RWD'
  },
  {
    id: 'throttle',
    label: 'Citlivost plynu',
    minLabel: 'Plynulá',
    maxLabel: 'Agresivní'
  },
  {
    id: 'brakeBalance',
    label: 'Vyvážení brzd',
    minLabel: 'Zadní',
    maxLabel: 'Přední',
    min: 40,
    max: 80
  }
];

interface AdvancedControlsProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export default function AdvancedControls({ isOpen, onToggle, className }: AdvancedControlsProps) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className={`${styles.toggleButton} ${className || ''} ${isOpen ? styles.open : ''}`}
    >
      <span className={styles.label}>Pokročilé nastavení</span>
      <span className={styles.chevron} aria-hidden="true" />
    </button>
  );
}
