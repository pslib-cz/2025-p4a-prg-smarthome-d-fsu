import styles from './InterventionMonitor.module.css';

interface InterventionMonitorProps {
  tractionCount: number;
  antiDiveActivity: number;
  antiSquatActivity: number;
}

export default function InterventionMonitor({
  tractionCount,
  antiDiveActivity,
  antiSquatActivity
}: InterventionMonitorProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 9V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
        <h3 className={styles.title}>Statistika zásahů</h3>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statNumber}>{tractionCount}</span>
          <span className={styles.statLabel}>Zásahy trakce</span>
          <div className={styles.statBar}>
            <div
              className={`${styles.statBarFill} ${styles.tractionBar}`}
              style={{ width: `${Math.min(100, tractionCount / 2)}%` }}
            />
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statNumber}>{antiDiveActivity.toFixed(1)}%</span>
          <span className={styles.statLabel}>Anti-dive aktivita</span>
          <div className={styles.statBar}>
            <div
              className={`${styles.statBarFill} ${styles.diveBar}`}
              style={{ width: `${Math.min(100, antiDiveActivity)}%` }}
            />
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statNumber}>{antiSquatActivity.toFixed(1)}%</span>
          <span className={styles.statLabel}>Anti-squat aktivita</span>
          <div className={styles.statBar}>
            <div
              className={`${styles.statBarFill} ${styles.squatBar}`}
              style={{ width: `${Math.min(100, antiSquatActivity)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
