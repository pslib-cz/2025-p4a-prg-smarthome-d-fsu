#pragma once

#include <stdint.h>

namespace dfsu::ina {

struct Reading {
    float busVoltageV;    // battery voltage (BMS side)
    float shuntVoltageMv; // across 0.1 Ω shunt
    float currentMa;      // signed: negative = charging (depends on wiring — see below)
    float powerMw;
};

bool begin();
bool read(Reading& out);

// Battery state derivation. Thin, not a full fuel gauge — see firmware-architecture.md
// §Battery Tracking for the coulomb counter that consumes these readings.
uint8_t estimateBatteryPct(float busVoltageV, uint32_t packCapacityMah, float mAhRemaining);

}  // namespace dfsu::ina
