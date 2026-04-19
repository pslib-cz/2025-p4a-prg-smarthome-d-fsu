#include "impact_log.h"

#include <Preferences.h>
#include <string.h>

#include "../util/log.h"

namespace dfsu::impact_log {

namespace {

constexpr const char* kNs = "dfsu_imp";
constexpr const char* kKeyHead    = "head";       // next write slot
constexpr const char* kKeyCount   = "count";      // #slots in use (<= kCapacity)
constexpr const char* kKeyNextId  = "next_id";    // next eventId to assign
constexpr const char* kKeyBleAck  = "ble_ack";
constexpr const char* kKeyMqttAck = "mqtt_ack";
constexpr const char* kKeyRing    = "ring";       // blob of kCapacity * Record

struct State {
    uint16_t head = 0;     // oldest entry: (head + kCapacity - count) % kCapacity
    uint16_t count = 0;
    uint32_t nextId = 1;   // 0 reserved for "unset"
    uint32_t bleAck = 0;
    uint32_t mqttAck = 0;
    Record ring[kCapacity]{};
    bool ready = false;
};

State g;

bool loadAll() {
    Preferences p;
    if (!p.begin(kNs, /*readOnly=*/true)) {
        // Fresh install; leave defaults.
        return true;
    }
    g.head    = p.getUShort(kKeyHead,    0);
    g.count   = p.getUShort(kKeyCount,   0);
    g.nextId  = p.getUInt(kKeyNextId,    1);
    g.bleAck  = p.getUInt(kKeyBleAck,    0);
    g.mqttAck = p.getUInt(kKeyMqttAck,   0);
    size_t bytes = p.getBytesLength(kKeyRing);
    if (bytes == sizeof(g.ring)) {
        p.getBytes(kKeyRing, g.ring, sizeof(g.ring));
    }
    p.end();
    if (g.count > kCapacity) g.count = kCapacity;
    return true;
}

bool persistHeader(Preferences& p) {
    p.putUShort(kKeyHead,  g.head);
    p.putUShort(kKeyCount, g.count);
    p.putUInt(kKeyNextId,  g.nextId);
    p.putUInt(kKeyBleAck,  g.bleAck);
    p.putUInt(kKeyMqttAck, g.mqttAck);
    return true;
}

bool persistAll() {
    Preferences p;
    if (!p.begin(kNs, /*readOnly=*/false)) {
        DFSU_ERR("imp", "nvs open for write failed");
        return false;
    }
    persistHeader(p);
    p.putBytes(kKeyRing, g.ring, sizeof(g.ring));
    p.end();
    return true;
}

bool persistHeaderOnly() {
    Preferences p;
    if (!p.begin(kNs, /*readOnly=*/false)) return false;
    persistHeader(p);
    p.end();
    return true;
}

// Free records at the tail whose id <= min(bleAck, mqttAck).
void compact() {
    uint32_t floor = g.bleAck < g.mqttAck ? g.bleAck : g.mqttAck;
    // Safety net: if one cursor stalls >100 behind the other, drag it forward.
    uint32_t lead  = g.bleAck > g.mqttAck ? g.bleAck : g.mqttAck;
    if (lead > floor + 100) {
        floor = lead;
        if (g.bleAck  < floor) g.bleAck  = floor;
        if (g.mqttAck < floor) g.mqttAck = floor;
    }
    while (g.count > 0) {
        uint16_t tail = (g.head + kCapacity - g.count) % kCapacity;
        if (g.ring[tail].eventId > floor) break;
        g.count--;
    }
}

}  // namespace

bool begin() {
    if (g.ready) return true;
    loadAll();
    compact();
    g.ready = true;
    DFSU_LOG("imp", "log ready: count=%u next_id=%u ble_ack=%u",
             g.count, g.nextId, g.bleAck);
    return true;
}

uint32_t append(const ImpactEvent& ev) {
    if (!g.ready) return 0;
    Record r{};
    r.eventId = g.nextId++;
    r.timestampMs = ev.timestampMs;
    r.gX = ev.gX; r.gY = ev.gY; r.gZ = ev.gZ;
    r.peakG = ev.peakG;

    g.ring[g.head] = r;
    g.head = (g.head + 1) % kCapacity;
    if (g.count < kCapacity) {
        g.count++;
    } else {
        // Overwrote oldest — pull BLE cursor forward if it would have pointed there.
        uint16_t tail = (g.head + kCapacity - g.count) % kCapacity;
        uint32_t oldestId = g.ring[tail].eventId;
        if (g.bleAck  + 1 < oldestId) g.bleAck  = oldestId - 1;
        if (g.mqttAck + 1 < oldestId) g.mqttAck = oldestId - 1;
    }
    persistAll();
    return r.eventId;
}

bool readPending(Record* buf, uint16_t maxCount, uint16_t& outCount) {
    outCount = 0;
    if (!g.ready || !buf || maxCount == 0) return false;
    uint16_t tail = (g.head + kCapacity - g.count) % kCapacity;
    for (uint16_t i = 0; i < g.count && outCount < maxCount; ++i) {
        uint16_t idx = (tail + i) % kCapacity;
        if (g.ring[idx].eventId > g.bleAck) {
            buf[outCount++] = g.ring[idx];
        }
    }
    return true;
}

bool ackBle(uint32_t upToId) {
    if (!g.ready) return false;
    if (upToId <= g.bleAck) return true;
    g.bleAck = upToId;
    compact();
    return persistAll();
}

bool ackMqtt(uint32_t upToId) {
    if (!g.ready) return false;
    if (upToId <= g.mqttAck) return true;
    g.mqttAck = upToId;
    compact();
    return persistAll();
}

uint32_t bleAckedId()  { return g.bleAck; }
uint32_t mqttAckedId() { return g.mqttAck; }
uint32_t nextEventId() { return g.nextId; }

uint16_t pendingCount() {
    if (!g.ready) return 0;
    uint16_t pending = 0;
    uint16_t tail = (g.head + kCapacity - g.count) % kCapacity;
    for (uint16_t i = 0; i < g.count; ++i) {
        uint16_t idx = (tail + i) % kCapacity;
        if (g.ring[idx].eventId > g.bleAck) pending++;
    }
    return pending;
}

}  // namespace dfsu::impact_log
