import React from 'react';
import styles from './Inclinometer.module.css';

interface InclinometerProps {
  angle?: number;
  label?: string;
  iconSrc?: string;
  iconSize?: 'normal' | 'large';
}

const Inclinometer: React.FC<InclinometerProps> = ({
  angle = 0,
  label,
  iconSrc,
  iconSize = 'normal'
}) => {
  const radius = 48;
  const innerBlackCircleRadius = 40;
  const horizonLineRadius = 38;
  const iconHalfWidth = 32;

  // Velikosti ikon podle typu
  const iconDimensions = iconSize === 'large' 
    ? { width: 110, height: 44, x: -55, y: -22 } // Horní ikona - ještě větší
    : { width: 75, height: 30, x: -37.5, y: -15 }; // Spodní ikona - o trochu větší

  const getCoordinates = (angleDegrees: number, r: number) => {
    const angleRad = (angleDegrees * Math.PI) / 180;
    return {
      x: r * Math.cos(angleRad),
      y: r * Math.sin(angleRad),
    };
  };

  const markerAngles = [0, 10, 20, 30, 40, -10, -20, -30, -40];

  return (
    <div className={styles.container}>
      <svg
        viewBox="-60 -60 120 120"
        className={styles.svg}
        aria-label={label}
      >
        <circle
          cx="0"
          cy="0"
          r={radius}
          fill="var(--inclinometer-bg)"
        />

        <g
          id="rotating-colors"
          transform={`rotate(${-angle})`}
          className={styles.rotating}
        >
          <path
            d="M -48,0 A 48,48 0 0 0 48,0"
            fill="var(--inclinometer-red)"
          />
        </g>
        
        <g id="static-rays">
          {markerAngles.map((a, index) => {
            const svgAngle = (a <= 0 ? -a : 360 - a); 
            const outer = getCoordinates(svgAngle, radius);
            const innerOpposite = getCoordinates(svgAngle, -radius); 

            return (
              <line
                key={`line-${index}`}
                x1={innerOpposite.x} y1={innerOpposite.y}
                x2={outer.x} y2={outer.y}
                stroke="var(--inclinometer-line)"
                strokeWidth="1.5"
              />
            );
          })}
        </g>

        <circle
          cx="0" cy="0"
          r={innerBlackCircleRadius}
          fill="var(--inclinometer-center)"
        />

        <g
          id="rotating-icon"
          transform={`rotate(${-angle})`}
          className={styles.rotating}
        >
          <line
            x1={-horizonLineRadius} y1="0"
            x2={-iconHalfWidth} y2="0"
            stroke="var(--inclinometer-line)"
            strokeWidth="1.5"
          />
          <line
            x1={iconHalfWidth} y1="0"
            x2={horizonLineRadius} y2="0"
            stroke="var(--inclinometer-line)"
            strokeWidth="1.5"
          />

          {iconSrc && (
            <foreignObject 
              x={iconDimensions.x} 
              y={iconDimensions.y} 
              width={iconDimensions.width} 
              height={iconDimensions.height}
            >
              <div className={styles.iconContainer}>
                <img src={iconSrc} alt="" className={styles.carIcon} />
              </div>
            </foreignObject>
          )}
        </g>

        <g id="static-numbers">
          {markerAngles.map((a, index) => {
            const svgAngle = (a <= 0 ? -a : 360 - a);
            const textRadius = radius + 10;
            const { x, y } = getCoordinates(svgAngle, textRadius);

            if (x < 0) return null;

            return (
              <text
                key={`text-${index}`}
                x={x}
                y={y}
                fontSize="8"
                fill="var(--inclinometer-text)"
                textAnchor="start"
                dominantBaseline="middle"
              >
                {Math.abs(a)}
              </text>
            );
          })}
        </g>
      </svg>
      <div className={styles.caption}>
        {label && <div className={styles.label}>{label}</div>}
        <div className={styles.angleDisplay}>{angle.toFixed(1)}°</div>
      </div>
    </div>
  );
};

export default Inclinometer;
