#pragma once

#include "../app/types.h"

namespace dfsu::ble {

// Brings up the NimBLE stack, registers the D-FSU service, and starts
// advertising as "D-FSU-XXXX". Safe to call once at boot.
bool begin();

// Notify current telemetry on ff02. No-op before begin() or if no subscribers.
void publishTelemetry(const TelemetrySnapshot& t);

// Notify an impact event on ff03. The transport layer supplies a wall-clock
// Unix timestamp — for Phase 2 before NTP we pass boot-seconds (0-based).
void publishImpact(const ImpactEvent& e, uint32_t unixTs);

// Notify extended battery info on ff07. Call opportunistically (~1 Hz or on change).
void publishBattExt(uint32_t consumptionMah, uint16_t runtimeOpenMin, uint16_t runtimeClosedMin);

// True if at least one central is connected.
bool isConnected();

}  // namespace dfsu::ble
