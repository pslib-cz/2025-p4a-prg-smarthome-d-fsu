#pragma once

#include <stdint.h>

#include "../app/types.h"

// Flash-backed ring buffer for ImpactEvent records.
//
// Phase 3 MVP: uses NVS (Preferences) with a single compact blob that holds
// the head/tail cursors + a bounded array of records. A dedicated flash
// partition (per firmware-architecture.md §Storage Plan) can replace the
// backing store later without changing this API.
//
// Each record gets a monotonic u32 `eventId` assigned here. Records are
// freed when `id <= min(ble_acked_id, mqtt_acked_id)` per the sync contract.

namespace dfsu::impact_log {

constexpr uint16_t kCapacity = 64;  // ~1 KB blob

struct Record {
    uint32_t eventId;
    uint32_t timestampMs;  // boot-relative when LOG_SB writes it; wall-clock if available
    float gX, gY, gZ;
    float peakG;
};
static_assert(sizeof(Record) == 24, "Record must be 24B");

bool begin();

// Assigns next eventId, persists record, returns id (0 on failure).
uint32_t append(const ImpactEvent& ev);

// Returns up to `maxCount` unacked records (id > bleAckedId), oldest-first.
// `out` is written with actual count written.
bool readPending(Record* buf, uint16_t maxCount, uint16_t& outCount);

// Advance BLE ack cursor (free records up to and including `upToId`).
bool ackBle(uint32_t upToId);
bool ackMqtt(uint32_t upToId);

uint32_t bleAckedId();
uint32_t mqttAckedId();
uint32_t nextEventId();  // the id that would be assigned next

// Count of pending (unacked by BLE) records.
uint16_t pendingCount();

}  // namespace dfsu::impact_log
