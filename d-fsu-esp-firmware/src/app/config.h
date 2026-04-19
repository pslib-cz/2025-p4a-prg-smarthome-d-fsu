#pragma once

#include <stdint.h>

// Runtime config. Mutable at runtime (via MQTT cmd/config or BLE), persisted
// to NVS by storage/nvs_config. Access the global via config().

namespace dfsu {

struct RuntimeConfig {
    // Battery / power
    uint32_t packCapacityMah = 5000;     // 2S BMS, 2x 2500 mAh cells in parallel-of-cells fashion
    float impactThresholdG = 3.0f;       // trigger LOG_SB path + burst capture scene
    uint8_t lowBatteryPct = 15;          // notify/LED amber below

    // HA / MQTT
    bool haEnabled = false;              // off by default during RC transport
    uint32_t heartbeatSec = 1800;        // REPORT mode fallback cadence

    // LED (mirrored in storage/impact_log separately; this is the default bootup state)
    bool ledOn = false;
    uint8_t ledR = 0xCC, ledG = 0x00, ledB = 0x00;
    uint8_t ledBehavior = 0;             // 0=off, 1=solid_on_open, 2=breathe_on_open, 3=flash_on_impact

    // OLED page bitmask. Each bit enables one hero page in the portrait cycle.
    // Bit layout (extended from contracts/gatt-profile.md #ff05):
    //   0 temperature  1 humidity  2 battery_pct  3 voltage  4 current
    //   5 runtime      6 case      7 impact_g     8 conn     9 firmware
    //  10 pressure (firmware-local, not in GATT yet)
    // Default enables the 7 pages we cycle through in portrait mode.
    uint16_t oledBitmask = 0b10001011111;  // temp, hum, battPct, V, I, case, pressure
};

RuntimeConfig& config();  // mutable singleton

}  // namespace dfsu
