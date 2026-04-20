import { memo } from 'react';
import styles from './BatteryGauge.module.css';

interface BatteryGaugeProps {
  power?: number;
  peakPower?: number;
}

const MIN_POWER = 0;
const MAX_POWER = 1000;
const REDLINE_START = 850;
const REDLINE_END = 1000;

const calculateAngle = (value: number): number => {
  const clampedValue = Math.max(MIN_POWER, Math.min(MAX_POWER, value));
  const percentage = (clampedValue - MIN_POWER) / (MAX_POWER - MIN_POWER);
  return -135 + (percentage * 270);
};

function BatteryGauge({ power, peakPower }: BatteryGaugeProps) {
  if (power === undefined) {
    return null;
  }

  const needleAngle = calculateAngle(power);
  const isInRedzone = power >= REDLINE_START && power <= REDLINE_END;

  const renderScaleMarks = () => {
    const marks = [];
    const totalMarks = 50;
    
    for (let i = 0; i <= totalMarks; i++) {
      const angle = -135 + (i / totalMarks) * 270;
      const powerAtMark = MIN_POWER + (i / totalMarks) * (MAX_POWER - MIN_POWER);
      const isRedline = powerAtMark >= REDLINE_START && powerAtMark <= REDLINE_END;
      const isMajor = i % 10 === 0;
      
      marks.push(
        <div
          key={i}
          className={`${styles.scaleMark} ${isMajor ? styles.majorMark : styles.minorMark} ${isRedline ? styles.redlineMark : ''}`}
          style={{
            transform: `rotate(${angle}deg) translateY(-85px)`
          }}
        />
      );
    }
    
    return marks;
  };

  const renderNumbers = () => {
    const numbers: React.ReactElement[] = [];
    const numbersToShow = [
      { value: 0, angle: 225, isHalf: false },
      { value: 200, angle: 279, isHalf: false },
      { value: 400, angle: 333, isHalf: false },
      { value: 600, angle: 27, isHalf: false },
      { value: 800, angle: 81, isHalf: false },
      { value: 1000, angle: 135, isHalf: false, display: '1k' }
    ];
    
    numbersToShow.forEach(({ value, angle, isHalf, display }: { value: number; angle: number; isHalf: boolean; display?: string }) => {
      const isRedline = value >= REDLINE_START && value <= REDLINE_END;
      const radius = 65;
      const angleRad = ((angle - 90) * Math.PI) / 180;
      const x = Math.cos(angleRad) * radius;
      const y = Math.sin(angleRad) * radius;
      
      numbers.push(
        <span
          key={value}
          className={`${styles.number} ${isHalf ? styles.halfNumber : ''} ${isRedline ? styles.redlineNumber : ''}`}
          style={{
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`
          }}
        >
          {display ?? value}
        </span>
      );
    });
    
    return numbers;
  };

  return (
    <div className={styles.batteryGaugeContainer}>
      <div className={styles.header}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4C7.58172 4 4 7.58172 4 12C4 14.5 5 16.5 6.5 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M12 4C16.4183 4 20 7.58172 20 12C20 14.5 19 16.5 17.5 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          <path d="M12 12L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <h3 className={styles.title}>Výkon</h3>
      </div>
      
      <div className={styles.gaugeWrapper}>
        <svg className={styles.gaugeSvg} viewBox="0 0 200 200">
          <defs>
            <linearGradient id="scaleBackground" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.9)" />
              <stop offset="50%" stopColor="rgba(255, 255, 255, 0.7)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.9)" />
            </linearGradient>
            <linearGradient id="scaleBackgroundDark" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(64, 63, 69, 0.5)" />
              <stop offset="50%" stopColor="rgba(64, 63, 69, 0.25)" />
              <stop offset="100%" stopColor="rgba(64, 63, 69, 0.5)" />
            </linearGradient>
            <linearGradient id="centerRing" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(129, 129, 129, 0.6)" />
              <stop offset="50%" stopColor="rgba(129, 129, 129, 0.3)" />
              <stop offset="100%" stopColor="rgba(129, 129, 129, 0.6)" />
            </linearGradient>
            
            <path id="segmentShape" d="M 145 120 A 50 50 0 1 0 55 120 Z" />
            
            <clipPath id="clipInsideSegment">
              <use href="#segmentShape" />
            </clipPath>
          </defs>
          
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="url(#scaleBackground)"
            opacity="0.8"
            className={styles.scaleBackgroundCircle}
          />
          
          <circle
            cx="100"
            cy="100"
            r="95"
            className={styles.outerCircle}
            fill="none"
            strokeWidth="2"
          />
          <circle
            cx="100"
            cy="100"
            r="90"
            className={styles.innerCircle}
            fill="none"
            strokeWidth="1"
          />
          
          <use href="#segmentShape" fill="url(#centerRing)" opacity="0.25" />
          
          <use 
            href="#segmentShape" 
            stroke="url(#centerRing)" 
            strokeWidth="4" 
            clipPath="url(#clipInsideSegment)" 
            fill="none"
            opacity="0.9"
          />
          
          <foreignObject x="0" y="0" width="200" height="200">
            <div className={styles.scaleContainer}>
              {renderScaleMarks()}
            </div>
            
            <div className={styles.numbersContainer}>
              {renderNumbers()}
            </div>
            
            <div className={styles.needleContainer}>
              <div
                className={styles.needle}
                style={{
                  transform: `rotate(${needleAngle}deg)`
                }}
              />
              <div className={styles.needleCenter} />
            </div>
            
            <div className={styles.valueDisplay}>
              <h2 className={`${styles.value} ${isInRedzone ? styles.redValue : ''}`}>
                {Math.round(power)}
              </h2>
              <span className={styles.unit}>Wattů</span>
            </div>
          </foreignObject>
        </svg>
      </div>

      <p className={styles.peakText}>
        Peak výkon <span className={styles.peakTextValue}>{peakPower !== undefined ? `${Math.round(peakPower)} W` : '— W'}</span>
      </p>
    </div>
  );
}

export default memo(BatteryGauge);
