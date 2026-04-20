import React from 'react';
import styles from './SuspensionStatus.module.css';
import chassisSvg from '../assets/chassis.svg';

interface WheelData {
  position: number; // 0-100, kde 50 je střed
}

interface SuspensionStatusProps {
  frontLeft?: WheelData;
  frontRight?: WheelData;
  rearLeft?: WheelData;
  rearRight?: WheelData;
}

const SuspensionStatus: React.FC<SuspensionStatusProps> = React.memo(({
  frontLeft = { position: 50 },
  frontRight = { position: 50 },
  rearLeft = { position: 50 },
  rearRight = { position: 50 }
}) => {
  const renderProgressBar = (label: string, data: WheelData) => {
    const isInRedZone = data.position < 20 || data.position > 80;
    
    return (
      <div className={styles.wheelContainer}>
        <div className={styles.wheelLabel}>{label}</div>
        <div className={styles.progressBarWrapper}>
          <div className={styles.progressBar}>
            <div className={styles.progressTrack}>
              {/* Středová čára */}
              <div className={styles.centerLine} />
              {/* Vyplněná část */}
              <div 
                className={`${styles.progressFill} ${isInRedZone ? styles.progressFillRed : ''}`}
                style={{ height: `${data.position}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.visualizationWrapper}>
        {/* Levé kola */}
        <div className={styles.leftWheels}>
          {renderProgressBar('FL', frontLeft)}
          {renderProgressBar('RL', rearLeft)}
        </div>

        {/* SVG podvozku uprostřed */}
        <div className={styles.chassisContainer}>
          <img src={chassisSvg} alt="Chassis" className={styles.chassisImage} />
        </div>

        {/* Pravé kola */}
        <div className={styles.rightWheels}>
          {renderProgressBar('FR', frontRight)}
          {renderProgressBar('RR', rearRight)}
        </div>
      </div>
    </div>
  );
});

export default SuspensionStatus;
