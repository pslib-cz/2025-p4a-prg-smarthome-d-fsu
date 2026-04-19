#include "fuel_gauge.h"

#include <Arduino.h>
#include <esp_sleep.h>
#include <math.h>

#include "../util/log.h"

namespace dfsu::power::gauge {

namespace {

// Per firmware-architecture.md §Battery Tracking — RTC-mem state survives
// deep sleep so the counter keeps running across LOG_SB hops.
RTC_DATA_ATTR State s_state = {
    .mAhRemaining            = -1.0f,  // -1 = uninitialized, seeded on first begin()
    .consumptionMahSinceFull = 0.0f,
    .lastSampleMs            = 0,
    .avgMaOpen               = 140.0f,  // placeholder: measured ACTIVE draw on bench
};

// Hardcoded placeholders — EWMA on sleep current is meaningless because we're
// asleep while it's drawing. Fill these in after bench-measuring with a
// multimeter; values below are educated guesses for an ESP32-S3 + MPU-6050
// INT-armed deep sleep with RTC peripherals on.
// TODO(bench): measure and replace.
constexpr float kSleepCurrentMa = 0.20f;   // ~200 µA placeholder
constexpr float kLogSbWakeMah   = 0.005f;  // ~200 ms × 80 mA / 3600 s ≈ 4.4 µAh

// The pack is 2× 18650 Li-ion behind a BMS + boost/buck regulator. The INA
// sits on the regulated 5 V output, so bus voltage is flat at ~5.0 V across
// most of the discharge curve — it drops abruptly only when the regulator
// loses input headroom (cells nearly dead). Voltage-based SOC is therefore
// useless; we rely on the coulomb counter and treat these as guard rails.
// While the BEC/BMS holds the rail at ~5.05 V we treat the pack as full and
// re-anchor to packCapacity on every sample. Below that the regulator is
// losing headroom → cells are draining → coulomb-count from whatever we have.
constexpr float kFullChargeV = 5.05f;
constexpr float kCutoffV     = 4.50f;   // hard-empty anchor
constexpr float kEwmaAlphaLoad = 0.05f;

float clampPositive(float v) { return v < 0.0f ? 0.0f : v; }

}  // namespace

void begin(uint32_t packCapacityMah, float busVoltageV) {
    bool cold = (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_UNDEFINED);
    if (cold || s_state.mAhRemaining < 0.0f) {
        // Regulated rail: bus voltage is flat across the discharge curve, so
        // voltage-based SOC is meaningless. Seed to full and trust the coulomb
        // counter from here — treats "cold boot" as "user just charged / swapped
        // cells". If that's wrong, the cutoff anchor corrects when V collapses.
        s_state.mAhRemaining = (float)packCapacityMah;
        s_state.consumptionMahSinceFull = 0.0f;
        s_state.lastSampleMs = 0;
        DFSU_LOG("gauge", "cold init: seeded %u mAh (full) V=%.2f",
                 (unsigned)packCapacityMah, busVoltageV);
    }
}

void applyAnchors(float /*currentMa*/, float busVoltageV) {
    // Rail still at nominal → pack is effectively full, keep re-anchoring.
    // Only once it sags below kFullChargeV do we start counting down.
    if (busVoltageV >= kFullChargeV) {
        s_state.mAhRemaining = 1e6f;  // caller clamps against packCapacity
        s_state.consumptionMahSinceFull = 0.0f;
    } else if (busVoltageV < kCutoffV) {
        s_state.mAhRemaining = 0.0f;
        DFSU_WARN("gauge", "cutoff anchor (V=%.2f)", busVoltageV);
    }
}

void integrate(float currentMa, float busVoltageV, bool caseOpen, uint32_t nowMs) {
    if (s_state.lastSampleMs == 0) {
        s_state.lastSampleMs = nowMs;
        return;
    }
    uint32_t dtMs = nowMs - s_state.lastSampleMs;
    s_state.lastSampleMs = nowMs;
    if (dtMs == 0) return;

    float dtH = dtMs / 3600000.0f;
    float dQ  = currentMa * dtH;  // mAh
    s_state.mAhRemaining -= dQ;
    if (dQ > 0) s_state.consumptionMahSinceFull += dQ;

    // EWMA only tracks awake draw (case open or active closed). Sleep current
    // is hardcoded — we can't learn it while asleep, and awake-closed is not a
    // valid proxy (80 mA vs µA).
    (void)caseOpen;
    if (currentMa > 0.0f) {
        s_state.avgMaOpen = s_state.avgMaOpen * (1.0f - kEwmaAlphaLoad)
                          + currentMa * kEwmaAlphaLoad;
    }

    applyAnchors(currentMa, busVoltageV);
}

void debitSleep(uint32_t sleepSeconds) {
    if (sleepSeconds == 0) return;
    float dq = kSleepCurrentMa * (sleepSeconds / 3600.0f);
    s_state.mAhRemaining -= dq;
    s_state.consumptionMahSinceFull += dq;
}

void debitLogSbWake() {
    s_state.mAhRemaining -= kLogSbWakeMah;
    s_state.consumptionMahSinceFull += kLogSbWakeMah;
}

uint32_t consumptionMah() {
    return (uint32_t)clampPositive(s_state.consumptionMahSinceFull);
}

uint16_t runtimeOpenMin() {
    if (s_state.avgMaOpen < 1.0f) return 0xFFFF;
    float mins = s_state.mAhRemaining / s_state.avgMaOpen * 60.0f;
    if (mins < 0) mins = 0;
    if (mins > 65535.0f) mins = 65535.0f;
    return (uint16_t)mins;
}

uint16_t runtimeClosedMin() {
    if (kSleepCurrentMa < 0.001f) return 0xFFFF;
    float mins = s_state.mAhRemaining / kSleepCurrentMa * 60.0f;
    if (mins < 0) mins = 0;
    if (mins > 65535.0f) mins = 65535.0f;
    return (uint16_t)mins;
}

uint8_t batteryPct(uint32_t packCapacityMah) {
    if (packCapacityMah == 0) return 0;
    float capped = s_state.mAhRemaining;
    if (capped > (float)packCapacityMah) capped = packCapacityMah;
    float pct = capped / (float)packCapacityMah * 100.0f;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    return (uint8_t)pct;
}

}  // namespace dfsu::power::gauge
