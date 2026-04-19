#pragma once

#include <stdint.h>

namespace dfsu::mpu {

struct Reading {
    float gX;
    float gY;
    float gZ;
    float peakG;   // sqrt(x²+y²+z²) precomputed
    float tempC;   // die temp, useful as a redundant read
};

bool begin();
bool isReady();            // true iff begin() succeeded (i.e. sensor on the bus)
bool read(Reading& out);

// Arm the MPU-6050 motion-interrupt so it pulls INT LOW on the first sample
// whose |a| > thresholdG for at least durationMs. Called before entering deep
// sleep; the INT pin wakes the ESP via ext1.
//
// After configuration, a pending interrupt is cleared — any latched "motion
// happened" flag from before the call is dropped so we don't immediately
// re-wake the CPU.
bool configureMotionInterrupt(float thresholdG, uint16_t durationMs = 1);

// Read + clear the latched motion-interrupt status. Returns true if motion was
// detected since the last read. Call on LOG_SB boot to confirm the wake cause
// and grab a fresh peak-G reading.
bool readAndClearMotion();

}  // namespace dfsu::mpu
