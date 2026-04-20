import styles from './AdvancedControls.module.css';

export type SuspensionCornerId = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight';

export type SuspensionHeightConfig = {
  id: SuspensionCornerId;
  label: string;
};

export const HEIGHT_CONTROL_CONFIG: SuspensionHeightConfig[] = [
  { id: 'frontLeft', label: 'Levá přední' },
  { id: 'frontRight', label: 'Pravá přední' },
  { id: 'rearLeft', label: 'Levá zadní' },
  { id: 'rearRight', label: 'Pravá zadní' }
];

interface SuspensionHeightControlsProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export default function SuspensionHeightControls({ isOpen, onToggle, className }: SuspensionHeightControlsProps) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className={`${styles.toggleButton} ${className || ''} ${isOpen ? styles.open : ''}`}
    >
      <span className={styles.label}>Výška podvozku</span>
      <span className={styles.chevron} aria-hidden="true" />
    </button>
  );
}
