import { type CSSProperties, useId } from 'react';
import styles from './ControlSlider.module.css';

type ValueFormatter = (value: number) => string;

export interface ControlSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  minLabel: string;
  maxLabel: string;
  midLabel?: string;
  disabled?: boolean;
  formatValue?: ValueFormatter;
  onChange?: (value: number) => void;
  className?: string;
}

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;

export default function ControlSlider({
  label,
  value,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  step = 1,
  minLabel,
  maxLabel,
  midLabel,
  disabled,
  formatValue,
  onChange,
  className
}: ControlSliderProps) {
  const sliderId = useId();

  const clamped = Math.min(Math.max(value, min), max);
  const range = max - min || 1;
  const progress = ((clamped - min) / range) * 100;
  const displayValue = formatValue ? formatValue(clamped) : `${Math.round(clamped)}%`;
  const sliderStyle = {
    '--slider-progress': `${progress}%`
  } as CSSProperties;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    onChange?.(nextValue);
  };

  return (
    <div className={`${styles.slider} ${className || ''}`} data-disabled={disabled}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{displayValue}</span>
      </div>
      <label className={styles.rangeWrapper} htmlFor={sliderId}>
        <input
          id={sliderId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamped}
          onChange={handleChange}
          className={styles.range}
          // CSS custom property drives the active track fill length
          style={sliderStyle}
          disabled={disabled}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={Number(clamped.toFixed(step < 1 ? 1 : 0))}
          aria-label={label}
        />
      </label>
      <div className={styles.scale} aria-hidden="true">
        <span>{minLabel}</span>
        {midLabel ? <span className={styles.midLabel}>{midLabel}</span> : <span />}
        <span className={styles.rightLabel}>{maxLabel}</span>
      </div>
    </div>
  );
}
