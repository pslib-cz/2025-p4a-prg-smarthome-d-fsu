#pragma once

#include <stdint.h>

// Coulomb counter + voltage anchors, per firmware-architecture.md §Battery Tracking.
// State lives in RTC slow memory so deep sleep preserves it.

namespace dfsu::power::gauge {

struct State {
    float    mAhRemaining;       // signed so we can detect underflow; clamped on read
    float    consumptionMahSinceFull;
    uint32_t lastSampleMs;       // millis() at last sample
    float    avgMaOpen;          // EWMA of awake draw (case open or active closed)
};

// Initialise once per boot.  If this is a cold boot (not deep-sleep wake) and
// no anchor has fired yet, seeds mAhRemaining to packCapacityMah.  For sleep
// wakes the RTC-mem state is preserved.
void begin(uint32_t packCapacityMah, float busVoltageV);

// Integrate one sample.  `currentMa` follows INA219 convention: negative while
// charging.  `nowMs` is millis(); we compute Δt from the stored lastSampleMs.
void integrate(float currentMa, float busVoltageV, bool caseOpen, uint32_t nowMs);

// Apply the full-charge / cutoff voltage anchors.  Called from integrate()
// automatically; also exposed for explicit triggering on mode transitions.
void applyAnchors(float currentMa, float busVoltageV);

// Account for deep-sleep drain using the learned I_sleep_nominal.
void debitSleep(uint32_t sleepSeconds);

// Fixed debit for one LOG_SB wake (~200 ms @ 80 mA burst).
void debitLogSbWake();

// Accessors in the form the ff07 / telemetry packers need.
uint32_t consumptionMah();
uint16_t runtimeOpenMin();
uint16_t runtimeClosedMin();
uint8_t  batteryPct(uint32_t packCapacityMah);

}  // namespace dfsu::power::gauge
