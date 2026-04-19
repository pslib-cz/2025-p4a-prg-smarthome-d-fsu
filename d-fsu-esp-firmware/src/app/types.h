#pragma once

#include <stdint.h>

// Domain types shared across sensor producers and transport consumers.
// Byte layouts here are internal; on-the-wire layouts for BLE/MQTT are defined
// in contracts/gatt-profile.md and contracts/mqtt-schema.md and converted by the
// ble/ and net/ modules.

namespace dfsu {

struct TelemetrySnapshot {
    uint32_t timestampMs;  // millis() since boot; real Unix ts added by transport layer
    float temperatureC;
    float humidityPct;
    float pressureHpa;
    uint16_t batteryMv;    // 0..65535
    int16_t batteryMa;     // negative = charging
    uint8_t batteryPct;    // 0..100
    bool caseOpen;
};

struct ImpactEvent {
    uint32_t eventId;      // monotonic, allocated by storage/impact_log
    uint32_t timestampMs;  // boot-relative; wall-clock assembled at transport
    float gX;
    float gY;
    float gZ;
    float peakG;           // precomputed magnitude
};

struct CaseEvent {
    uint32_t timestampMs;
    bool open;
};

}  // namespace dfsu
