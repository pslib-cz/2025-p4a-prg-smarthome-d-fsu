#include "gatt_server.h"

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <esp_mac.h>

#include "../actuators/led.h"
#include "../app/config.h"
#include "../storage/impact_log.h"
#include "../storage/nvs_config.h"
#include "../util/log.h"
#include "gatt_profile.h"

namespace dfsu::ble {

namespace {

NimBLEServer*         server = nullptr;
NimBLECharacteristic* chTele = nullptr;
NimBLECharacteristic* chImp  = nullptr;
NimBLECharacteristic* chLed  = nullptr;
NimBLECharacteristic* chOled = nullptr;
NimBLECharacteristic* chDrn  = nullptr;
NimBLECharacteristic* chBatt = nullptr;
NimBLECharacteristic* chInfo = nullptr;

volatile bool connected = false;

String macSuffix() {
    uint8_t mac[6] = {0};
    esp_read_mac(mac, ESP_MAC_BT);
    char buf[5];
    snprintf(buf, sizeof(buf), "%02X%02X", mac[4], mac[5]);
    return String(buf);
}

String buildDeviceInfoJson() {
    // Kept simple; ff08 is only read once per connection and the phone parses it loosely.
    String json = "{";
    json += "\"fw\":\"" DFSU_FW_VERSION "\"";
    json += ",\"chip\":\"";     json += ESP.getChipModel(); json += "\"";
    json += ",\"macSuffix\":\""; json += macSuffix();        json += "\"";
    json += ",\"capacityMah\":"; json += config().packCapacityMah;
    json += "}";
    return json;
}

class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer*, NimBLEConnInfo&) override {
        connected = true;
        DFSU_LOG("ble", "central connected");
    }
    void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int reason) override {
        connected = false;
        DFSU_LOG("ble", "central disconnected (reason=%d) — advertising again", reason);
        NimBLEDevice::startAdvertising();
    }
};

class LedCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* c, NimBLEConnInfo&) override {
        auto val = c->getValue();
        LedWrite w{};
        if (!parseLedWrite((const uint8_t*)val.data(), val.length(), w)) {
            DFSU_ERR("ble", "ff04 write wrong len=%u (expected %u)",
                     (unsigned)val.length(), (unsigned)kLedWriteSize);
            return;
        }
        auto& cfg = config();
        cfg.ledOn = w.on != 0;
        cfg.ledR = w.r; cfg.ledG = w.g; cfg.ledB = w.b;
        cfg.ledBehavior = w.openBehavior;
        nvs::save(cfg);
        led::applyConfig();
        DFSU_LOG("ble", "ff04 led=%u rgb=#%02X%02X%02X behavior=%u",
                 w.on, w.r, w.g, w.b, w.openBehavior);
    }
};

class OledCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* c, NimBLEConnInfo&) override {
        auto val = c->getValue();
        if (val.length() != kOledWriteSize) {
            DFSU_ERR("ble", "ff05 write wrong len=%u", (unsigned)val.length());
            return;
        }
        uint16_t mask = unpackU16((const uint8_t*)val.data());
        config().oledBitmask = mask;
        nvs::save(config());
        DFSU_LOG("ble", "ff05 oled bitmask=0x%04X", mask);
    }
};

class DrainCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* c, NimBLEConnInfo&) override {
        auto val = c->getValue();
        if (val.length() < 1) return;
        uint8_t op = (uint8_t)val.data()[0];
        switch ((DrainOp)op) {
            case DrainOp::RequestSince: {
                uint32_t since = (val.length() >= 5)
                    ? unpackU32((const uint8_t*)val.data() + 1) : 0;
                streamPending(c, since);
                break;
            }
            case DrainOp::Ack: {
                if (val.length() >= 5) {
                    uint32_t last = unpackU32((const uint8_t*)val.data() + 1);
                    impact_log::ackBle(last);
                    DFSU_LOG("ble", "ff06 ack up to id=%u (pending=%u)",
                             (unsigned)last, (unsigned)impact_log::pendingCount());
                }
                break;
            }
            case DrainOp::Cancel:
                DFSU_LOG("ble", "ff06 cancel");
                break;
            case DrainOp::MqttRelayAck: {
                if (val.length() >= 5) {
                    uint32_t upTo = unpackU32((const uint8_t*)val.data() + 1);
                    impact_log::ackMqtt(upTo);
                    DFSU_LOG("ble", "ff06 mqtt-relay ack up to id=%u (pending=%u)",
                             (unsigned)upTo, (unsigned)impact_log::pendingCount());
                }
                break;
            }
            default:
                DFSU_WARN("ble", "ff06 unknown op=%u", op);
                break;
        }
    }

    static void streamPending(NimBLECharacteristic* c, uint32_t since) {
        // Pull pending records (those with id > ble_ack). `since` lets the
        // phone filter further if it has already seen some of them.
        impact_log::Record buf[impact_log::kCapacity];
        uint16_t count = 0;
        impact_log::readPending(buf, impact_log::kCapacity, count);

        uint16_t sent = 0;
        for (uint16_t i = 0; i < count; ++i) {
            const auto& r = buf[i];
            if (r.eventId <= since) continue;
            uint8_t chunk[kDrainEventChunkSize];
            chunk[0] = kDrainChunkEvent;
            packU32(chunk + 1,  r.eventId);
            packU32(chunk + 5,  r.timestampMs / 1000);  // best-effort wall-clock
            packF32(chunk + 9,  r.gX);
            packF32(chunk + 13, r.gY);
            packF32(chunk + 17, r.gZ);
            c->setValue(chunk, sizeof(chunk));
            if (!c->indicate()) {
                DFSU_WARN("ble", "ff06 indicate failed at id=%u; aborting stream",
                          (unsigned)r.eventId);
                return;
            }
            sent++;
        }
        uint8_t end = kDrainChunkEnd;
        c->setValue(&end, 1);
        c->indicate();
        DFSU_LOG("ble", "ff06 drain: streamed %u/%u events (since=%u)",
                 (unsigned)sent, (unsigned)count, (unsigned)since);
    }
};

}  // namespace

bool begin() {
    if (server) return true;

    String name = String("D-FSU-") + macSuffix();
    NimBLEDevice::init(name.c_str());
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);  // +9 dBm — range over battery drain for Phase 2

    server = NimBLEDevice::createServer();
    server->setCallbacks(new ServerCallbacks());

    NimBLEService* svc = server->createService(kServiceUuid);

    chTele = svc->createCharacteristic(kCharTelemetryUuid,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);

    chImp  = svc->createCharacteristic(kCharImpactUuid,
        NIMBLE_PROPERTY::NOTIFY);

    chLed  = svc->createCharacteristic(kCharLedUuid,
        NIMBLE_PROPERTY::WRITE);
    chLed->setCallbacks(new LedCallbacks());

    chOled = svc->createCharacteristic(kCharOledUuid,
        NIMBLE_PROPERTY::WRITE);
    chOled->setCallbacks(new OledCallbacks());

    chDrn  = svc->createCharacteristic(kCharDrainUuid,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::INDICATE);
    chDrn->setCallbacks(new DrainCallbacks());

    chBatt = svc->createCharacteristic(kCharBattExtUuid,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);

    chInfo = svc->createCharacteristic(kCharDevInfoUuid,
        NIMBLE_PROPERTY::READ);
    String info = buildDeviceInfoJson();
    chInfo->setValue((uint8_t*)info.c_str(), info.length());

    svc->start();

    // Split the 128-bit service UUID (18 B on-air) and the device name across
    // the adv payload and scan response — both fit in 31 B individually, but
    // not together.
    NimBLEAdvertisementData advData;
    advData.setFlags(BLE_HS_ADV_F_DISC_GEN);
    advData.addServiceUUID(kServiceUuid);

    NimBLEAdvertisementData scanResp;
    scanResp.setName(name.c_str());

    NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
    adv->setAdvertisementData(advData);
    adv->setScanResponseData(scanResp);
    adv->start();

    DFSU_LOG("ble", "advertising as %s", name.c_str());
    return true;
}

void publishTelemetry(const TelemetrySnapshot& t) {
    if (!chTele) return;
    uint8_t buf[kTelemetrySize];
    packTelemetry(t, buf);
    chTele->setValue(buf, sizeof(buf));
    if (connected) chTele->notify();
}

void publishImpact(const ImpactEvent& e, uint32_t unixTs) {
    if (!chImp) return;
    uint8_t buf[kImpactSize];
    packImpact(e, unixTs, buf);
    chImp->setValue(buf, sizeof(buf));
    if (connected) chImp->notify();
}

void publishBattExt(uint32_t consumptionMah, uint16_t runtimeOpenMin, uint16_t runtimeClosedMin) {
    if (!chBatt) return;
    uint8_t buf[kBattExtSize];
    packBattExt(consumptionMah, runtimeOpenMin, runtimeClosedMin, buf);
    chBatt->setValue(buf, sizeof(buf));
    if (connected) chBatt->notify();
}

bool isConnected() { return connected; }

}  // namespace dfsu::ble
