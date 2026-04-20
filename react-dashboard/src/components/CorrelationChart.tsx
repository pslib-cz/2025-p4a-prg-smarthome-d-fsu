import { useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import styles from './CorrelationChart.module.css';

export interface ChartDataPoint {
  time: string;
  // Mode A
  lateralG?: number;
  rollAngle?: number;
  chassisPwm?: number;
  // Mode B
  yawRate?: number;
  steeringPosition?: number;
  powerReduction?: number;
}

interface CorrelationChartProps {
  data: ChartDataPoint[];
}

type ChartMode = 'A' | 'B';

/* custom tooltip */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipTime}>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className={styles.tooltipRow} style={{ color: entry.color }}>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* custom legend formatter — ensures bar labels are readable */
function legendFormatter(value: string) {
  return <span style={{ color: 'var(--text-primary)', fontSize: '11px' }}>{value}</span>;
}

export default function CorrelationChart({ data }: CorrelationChartProps) {
  const [mode, setMode] = useState<ChartMode>('A');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Korelační graf dynamiky</h3>
        <div className={styles.modeSwitcher}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'A' ? styles.active : ''}`}
            onClick={() => setMode('A')}
          >
            Anti-roll
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'B' ? styles.active : ''}`}
            onClick={() => setMode('B')}
          >
            Trakce
          </button>
        </div>
      </div>

      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'A' ? (
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(0,0,0,0.12)' }}
                minTickGap={20}
              />
              {/* G axis — visible left, red ticks */}
              <YAxis
                yAxisId="g"
                orientation="left"
                tick={{ fontSize: 9, fill: 'var(--color-red, #c50000)' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 5]}
                width={28}
                label={{ value: 'G', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'var(--color-red, #c50000)' } }}
              />
              {/* Roll axis — visible left */}
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 9, fill: '#555555' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 'auto']}
                width={28}
                label={{ value: '°', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: '#555555' } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                width={30}
                label={{ value: '%', angle: 90, position: 'insideRight', style: { fontSize: 9, fill: 'var(--text-secondary)' } }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '2px' }}
                iconSize={10}
                formatter={legendFormatter}
              />
              <Bar
                yAxisId="right"
                dataKey="chassisPwm"
                name="PWM serva (%)"
                fill="rgba(197, 0, 0, 0.2)"
                stroke="rgba(197, 0, 0, 0.45)"
                strokeWidth={1}
                radius={0}
                legendType="square"
                isAnimationActive={false}
              />
              <Line
                yAxisId="g"
                type="monotone"
                dataKey="lateralG"
                name="Boční G"
                stroke="var(--color-red, #c50000)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="rollAngle"
                name="Roll (°)"
                stroke="#555555"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(0,0,0,0.12)' }}
                minTickGap={20}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 'auto']}
                width={35}
                label={{ value: '°/s / %', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'var(--text-secondary)' } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                width={35}
                label={{ value: '%', angle: 90, position: 'insideRight', style: { fontSize: 9, fill: 'var(--text-secondary)' } }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                iconSize={10}
                formatter={legendFormatter}
              />
              <Bar
                yAxisId="right"
                dataKey="powerReduction"
                name="Omezení výkonu (%)"
                fill="rgba(197, 0, 0, 0.2)"
                stroke="rgba(197, 0, 0, 0.45)"
                strokeWidth={1}
                radius={0}
                legendType="square"
                isAnimationActive={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="yawRate"
                name="Yaw rate (°/s)"
                stroke="var(--color-red, #c50000)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="steeringPosition"
                name="Volant (%)"
                stroke="#555555"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
