#pragma once

#include <stdint.h>
#include <string.h>

#include "../app/types.h"

// BLE GATT profile constants + pack helpers. The byte layouts here MUST match
// contracts/gatt-profile.md — any change requires a lockstep update on the
// Android side (BleDataParser.kt). All multi-byte fields are little-endian,
// which matches ESP32 native and Kotlin's ByteBuffer(LITTLE_ENDIAN).

namespace dfsu::ble {

// Service + characteristic UUIDs.
inline constexpr const char* kServiceUuid       = "0000ff01-0000-1000-8000-00805f9b34fb";
inline constexpr const char* kCharTelemetryUuid = "0000ff02-0000-1000-8000-00805f9b34fb";
inline constexpr const char* kCharImpactUuid    = "0000ff03-0000-1000-8000-00805f9b34fb";
inline constexpr const char* kCharLedUuid       = "0000ff04-0000-1000-8000-00805f9b34fb";
inline constexpr const char* kCharOledUuid      = "0000ff05-0000-1000-8000-00805f9b34fb";
inline constexpr const char* kCharDrainUuid     = "0000ff06-0000-1000-8000-00805f9b34fb";
inline constexpr const char* kCharBattExtUuid   = "0000ff07-0000-1000-8000-00805f9b34fb";
inline constexpr const char* kCharDevInfoUuid   = "0000ff08-0000-1000-8000-00805f9b34fb";

// Payload sizes per contract.
inline constexpr size_t kTelemetrySize = 14;
inline constexpr size_t kImpactSize    = 20;
inline constexpr size_t kBattExtSize   = 8;
inline constexpr size_t kLedWriteSize  = 5;
inline constexpr size_t kOledWriteSize = 2;

// Little-endian pack helpers. ESP32 is LE so memcpy works directly.
inline void packU16(uint8_t* dst, uint16_t v) { memcpy(dst, &v, 2); }
inline void packI16(uint8_t* dst, int16_t  v) { memcpy(dst, &v, 2); }
inline void packU32(uint8_t* dst, uint32_t v) { memcpy(dst, &v, 4); }
inline void packF32(uint8_t* dst, float    v) { memcpy(dst, &v, 4); }

inline uint16_t unpackU16(const uint8_t* src) { uint16_t v; memcpy(&v, src, 2); return v; }
inline uint32_t unpackU32(const uint8_t* src) { uint32_t v; memcpy(&v, src, 4); return v; }

// ff02 Telemetry (14 B).
inline void packTelemetry(const TelemetrySnapshot& t, uint8_t out[kTelemetrySize]) {
    packF32(out + 0,  t.temperatureC);
    packF32(out + 4,  t.humidityPct);
    packU16(out + 8,  t.batteryMv);
    packI16(out + 10, t.batteryMa);
    out[12] = t.caseOpen ? 1 : 0;
    out[13] = t.batteryPct;
}

// ff03 Impact (20 B). `unixTs` is the wall-clock timestamp assembled by the
// transport layer (fallback to boot ms / 1000 if no time sync).
inline void packImpact(const ImpactEvent& e, uint32_t unixTs, uint8_t out[kImpactSize]) {
    packU32(out + 0,  e.eventId);
    packU32(out + 4,  unixTs);
    packF32(out + 8,  e.gX);
    packF32(out + 12, e.gY);
    packF32(out + 16, e.gZ);
}

// ff07 Battery Extended (8 B).
inline void packBattExt(uint32_t consumptionMah, uint16_t runtimeOpenMin,
                        uint16_t runtimeClosedMin, uint8_t out[kBattExtSize]) {
    packU32(out + 0, consumptionMah);
    packU16(out + 4, runtimeOpenMin);
    packU16(out + 6, runtimeClosedMin);
}

// ff04 LED write payload (5 B), parsed by gatt_server onWrite handler.
struct LedWrite {
    uint8_t on;
    uint8_t r, g, b;
    uint8_t openBehavior;  // 0=Off 1=SolidOnOpen 2=BreatheOnOpen 3=FlashOnImpact
};

inline bool parseLedWrite(const uint8_t* src, size_t len, LedWrite& out) {
    if (len != kLedWriteSize) return false;
    out.on = src[0];
    out.r = src[1]; out.g = src[2]; out.b = src[3];
    out.openBehavior = src[4];
    return true;
}

// ff06 drain protocol.
//
// Phone → ESP (write):
//   [op=RequestSince(1), sinceIdU32]   request events with eventId > sinceId
//   [op=Ack(2), lastAckedIdU32]        advance bleAckedId cursor
//   [op=Cancel(3)]                     abort an in-progress stream
//   [op=MqttRelayAck(4), upToIdU32]    phone relayed events to HA via REST on
//                                      firmware's behalf; advance mqttAckedId.
//                                      Phone MUST only send after HA confirms.
//
// ESP → phone (indicate on the same characteristic):
//   [0x10, idU32, unixTsU32, gXF32, gYF32, gZF32]   one buffered event (21 B)
//   [0xFF]                                           end-of-stream marker
enum class DrainOp : uint8_t {
    RequestSince  = 1,
    Ack           = 2,
    Cancel        = 3,
    MqttRelayAck  = 4,
};

inline constexpr uint8_t kDrainChunkEvent = 0x10;
inline constexpr uint8_t kDrainChunkEnd   = 0xFF;
inline constexpr size_t  kDrainEventChunkSize = 21;

}  // namespace dfsu::ble
