import { useEffect, useRef, useState } from 'react';
import type { BLEData } from './useBLE';

// Demo cycle period in seconds (full loop)
const CYCLE_PERIOD = 15;
// Update data at 5 Hz via setInterval (NOT rAF — avoids 60fps callback overhead)
const UPDATE_INTERVAL_MS = 200;

export function useDemoTelemetry(): BLEData {
    const [telemetry, setTelemetry] = useState<BLEData | null>(null);
    const startTimeRef = useRef(performance.now());
    const frameRef = useRef(0);
    const drawnMahRef = useRef(0);
    const tractionCountRef = useRef(0);

    useEffect(() => {
        const tick = () => {
            const now = performance.now();
            const dt = UPDATE_INTERVAL_MS / 1000;
            const elapsed = (now - startTimeRef.current) / 1000;
            const cycleProgress = (elapsed % CYCLE_PERIOD) / CYCLE_PERIOD;
            const angle = cycleProgress * Math.PI * 2;

            // Power: oscillate 0-1000W
            const power = 500 + Math.sin(angle) * 350 + Math.sin(angle * 3) * 100 + Math.cos(angle * 2.5) * 50;
            const clampedPower = Math.max(0, Math.min(1000, power));

            // Battery
            const batteryVoltage = 7.8 - (clampedPower / 1000) * 1.5 + Math.sin(angle * 0.3) * 0.2;
            const currentA = clampedPower / Math.max(batteryVoltage, 6);
            drawnMahRef.current += (currentA * 1000 * dt) / 3600 * 20;
            if (drawnMahRef.current > 2000) drawnMahRef.current = 0;
            const drawnMah = drawnMahRef.current;
            const safeUsable = 1760;
            const batteryLevel = Math.max(0, Math.min(1, (safeUsable - drawnMah) / safeUsable));

            // G-force
            const gX = Math.sin(angle) * 1.5 + Math.sin(angle * 3) * 0.3;
            const gY = Math.sin(angle * 2) * 2.5 + Math.cos(angle * 2.5) * 0.5;

            // Roll and pitch
            const roll = Math.sin(angle * 1.3) * 30 + Math.sin(angle * 2.7) * 5;
            const pitch = Math.cos(angle * 0.9) * 25 + Math.cos(angle * 2.1) * 8;
            const yawRate = Math.sin(angle * 1.7) * 120 + Math.cos(angle * 3.1) * 40;

            // Suspension
            const suspBase = 50 + Math.sin(angle) * 45;
            const suspFL = suspBase + Math.sin(angle * 1.5) * 5;
            const suspFR = suspBase + Math.cos(angle * 1.5) * 5;
            const suspRL = suspBase + Math.sin(angle * 1.5 + 0.5) * 5;
            const suspRR = suspBase + Math.cos(angle * 1.5 + 0.5) * 5;

            // System
            const btStrength = Math.round(2 + Math.sin(angle * 0.7) * 2);
            const latency = 30 + Math.sin(angle * 3) * 25 + Math.abs(Math.sin(angle * 7)) * 15;
            const temperature = 35 + Math.sin(angle * 0.5) * 15;

            // Control data
            const steeringPosition = Math.sin(angle * 1.3) * 80;
            const chassisPwm = Math.abs(Math.sin(angle * 1.5)) * 100;
            const rearPowerReduction = Math.max(0, Math.abs(yawRate) > 80 ? (Math.abs(yawRate) - 80) * 0.8 : 0);
            const frontPowerReduction = Math.max(0, rearPowerReduction * 0.5);

            // Interventions
            if (Math.random() < 0.02 && Math.abs(gX) > 1.0) {
                tractionCountRef.current += 1;
            }
            const antiDiveActivity = 20 + Math.sin(angle * 0.8) * 15 + Math.abs(Math.sin(angle * 2)) * 10;
            const antiSquatActivity = 15 + Math.cos(angle * 0.6) * 12 + Math.abs(Math.cos(angle * 1.8)) * 8;

            setTelemetry({
                timestamp: Date.now(),
                seq: frameRef.current++,
                power: Math.round(clampedPower),
                battery: {
                    voltage: Math.round(batteryVoltage * 100) / 100,
                    level: Math.round(batteryLevel * 100) / 100,
                    estimatedMinutes: Math.round(Math.max(5, batteryLevel * 60)),
                    alert: batteryVoltage < 6.5,
                    currentA: Math.round(currentA * 10) / 10,
                    drawnMah: Math.round(drawnMah)
                },
                imu: {
                    rollDeg: Math.round(roll * 10) / 10,
                    pitchDeg: Math.round(pitch * 10) / 10,
                    gForce: {
                        x: Math.round(gX * 100) / 100,
                        y: Math.round(gY * 100) / 100
                    },
                    gyroAlert: Math.abs(roll) > 28 || Math.abs(pitch) > 22,
                    yawRate: Math.round(yawRate * 10) / 10
                },
                suspension: {
                    frontLeft: Math.round(Math.max(5, Math.min(95, suspFL))),
                    frontRight: Math.round(Math.max(5, Math.min(95, suspFR))),
                    rearLeft: Math.round(Math.max(5, Math.min(95, suspRL))),
                    rearRight: Math.round(Math.max(5, Math.min(95, suspRR)))
                },
                system: {
                    btStrength: Math.max(0, Math.min(4, btStrength)),
                    latencyMs: Math.round(Math.max(15, latency)),
                    temperatureC: Math.round(temperature),
                    imuOnline: true
                },
                diagnostics: {
                    errors: [],
                    frameDrop: Math.random() < 0.02
                },
                control: {
                    steeringPosition: Math.round(steeringPosition * 10) / 10,
                    chassisPwm: Math.round(chassisPwm),
                    frontPowerReduction: Math.round(frontPowerReduction * 10) / 10,
                    rearPowerReduction: Math.round(rearPowerReduction * 10) / 10
                },
                interventions: {
                    tractionCount: tractionCountRef.current,
                    antiDiveActivity: Math.round(antiDiveActivity * 10) / 10,
                    antiSquatActivity: Math.round(antiSquatActivity * 10) / 10
                }
            });
        };

        // Use setInterval, NOT requestAnimationFrame
        // setInterval fires on timer thread, doesn't block compositor animations
        const intervalId = setInterval(tick, UPDATE_INTERVAL_MS);
        tick(); // first tick immediately
        return () => clearInterval(intervalId);
    }, []);

    return telemetry!;
}
