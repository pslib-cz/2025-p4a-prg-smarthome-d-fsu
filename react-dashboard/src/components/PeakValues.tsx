import styles from './PeakValues.module.css';

interface PeakValuesProps {
  maxLateralG: number;
  maxLongitudinalG: number;
  maxRoll: number;
  maxPitch: number;
}

export default function PeakValues({
  maxLateralG,
  maxLongitudinalG,
  maxRoll,
  maxPitch
}: PeakValuesProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
        </svg>
        <h3 className={styles.title}>Dosažené extrémy</h3>
      </div>

      <div className={styles.peakGrid}>
        <div className={styles.peakCard}>
          <div className={styles.peakLabel}>Max boční G</div>
          <div className={styles.peakValue}>
            <span className={styles.peakNumber}>{maxLateralG.toFixed(2)}</span>
            <span className={styles.peakUnit}>G</span>
          </div>
        </div>

        <div className={styles.peakCard}>
          <div className={styles.peakLabel}>Max podélné G</div>
          <div className={styles.peakValue}>
            <span className={styles.peakNumber}>{maxLongitudinalG.toFixed(2)}</span>
            <span className={styles.peakUnit}>G</span>
          </div>
        </div>

        <div className={styles.peakCard}>
          <div className={styles.peakLabel}>Max Roll</div>
          <div className={styles.peakValue}>
            <span className={styles.peakNumber}>{maxRoll.toFixed(1)}</span>
            <span className={styles.peakUnit}>°</span>
          </div>
        </div>

        <div className={styles.peakCard}>
          <div className={styles.peakLabel}>Max Pitch</div>
          <div className={styles.peakValue}>
            <span className={styles.peakNumber}>{maxPitch.toFixed(1)}</span>
            <span className={styles.peakUnit}>°</span>
          </div>
        </div>
      </div>
    </div>
  );
}
