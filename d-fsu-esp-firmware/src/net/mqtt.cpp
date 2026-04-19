#include "mqtt.h"

#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include "../power/fuel_gauge.h"
#include "../storage/impact_log.h"
#include "../util/log.h"
#include "wifi.h"

namespace dfsu::net::mqtt {

namespace {

WiFiClientSecure sTls;
PubSubClient     sClient(sTls);

// Cached config — PubSubClient holds const char* by reference, so these need
// to outlive begin(). Copied into static buffers on first begin() call.
char sHost[64];
char sUser[33];
char sPass[65];
char sClientId[32];
bool sConfigured = false;

// Topic scratch — built on demand, reused across publishes.
char sTopic[96];

void buildTopic(const char* suffix) {
    snprintf(sTopic, sizeof(sTopic), "dfsu/%s/%s", sClientId, suffix);
}

}  // namespace

bool begin(const Config& cfg) {
    if (!cfg.caCertPem || !cfg.caCertPem[0]) {
        DFSU_ERR("mqtt", "CA cert empty — refusing to connect (fail-closed)");
        return false;
    }
    if (!cfg.host || !cfg.host[0] || !cfg.clientId || !cfg.clientId[0]) {
        DFSU_ERR("mqtt", "host/clientId missing");
        return false;
    }
    if (!wifi::isConnected()) {
        DFSU_WARN("mqtt", "wifi not connected — skipping broker connect");
        return false;
    }

    if (!sConfigured) {
        strncpy(sHost,     cfg.host,                    sizeof(sHost) - 1);
        strncpy(sUser,     cfg.username ? cfg.username : "", sizeof(sUser) - 1);
        strncpy(sPass,     cfg.password ? cfg.password : "", sizeof(sPass) - 1);
        strncpy(sClientId, cfg.clientId,                sizeof(sClientId) - 1);
        sTls.setCACert(cfg.caCertPem);
        sClient.setServer(sHost, cfg.port);
        sClient.setBufferSize(1024);  // impact JSON stays well under this
        sConfigured = true;
    }

    if (sClient.connected()) return true;

    // Retained LWT → HA shows box "offline" if we drop without a clean disconnect.
    buildTopic("availability");
    const bool ok = sClient.connect(
        sClientId,
        sUser[0] ? sUser : nullptr,
        sPass[0] ? sPass : nullptr,
        sTopic, /*willQos=*/0, /*willRetain=*/true, /*willMsg=*/"offline");

    if (!ok) {
        DFSU_WARN("mqtt", "connect failed state=%d", sClient.state());
        return false;
    }
    DFSU_LOG("mqtt", "connected host=%s:%u", sHost, (unsigned)cfg.port);
    publishStatus(true);
    return true;
}

bool isConnected() { return sClient.connected(); }

void loop() {
    if (sConfigured) sClient.loop();
}

bool publishImpact(const impact_log::Record& r) {
    if (!sClient.connected()) return false;

    // Schema per contracts/mqtt-schema.md §impact — `id`/`ts`, stream semantics
    // (not retained). `id` matches ff03.eventId so HA automations can dedupe.
    JsonDocument doc;
    doc["id"]     = r.eventId;
    doc["ts"]     = r.timestampMs / 1000;  // Unix-ish — firmware upgrade path: swap for real RTC
    doc["gX"]     = r.gX;
    doc["gY"]     = r.gY;
    doc["gZ"]     = r.gZ;
    doc["peakG"]  = r.peakG;

    char payload[256];
    const size_t n = serializeJson(doc, payload, sizeof(payload));

    buildTopic("impact");
    if (!sClient.publish(sTopic, (const uint8_t*)payload, n, /*retained=*/false)) {
        DFSU_WARN("mqtt", "impact publish failed id=%u state=%d",
                  (unsigned)r.eventId, sClient.state());
        return false;
    }
    // QoS-0 limitation: advance cursor on successful stack submission. See
    // file header note — esp-mqtt would give us a real PUBACK callback.
    impact_log::ackMqtt(r.eventId);
    DFSU_LOG("mqtt", "impact published id=%u peakG=%.2f", (unsigned)r.eventId, r.peakG);
    return true;
}

bool publishTelemetry(const TelemetrySnapshot& s) {
    if (!sClient.connected()) return false;

    // Schema per contracts/mqtt-schema.md §telemetry — nested battery object,
    // voltage in mV, current in mA (negative = charging), runtimes in min.
    JsonDocument doc;
    doc["ts"]          = s.timestampMs / 1000;
    doc["temperature"] = s.temperatureC;
    doc["humidity"]    = s.humidityPct;
    doc["pressure"]    = s.pressureHpa;

    JsonObject batt = doc["battery"].to<JsonObject>();
    batt["voltage"]       = s.batteryMv;
    batt["current"]       = s.batteryMa;
    batt["pct"]           = s.batteryPct;
    batt["consumption"]   = power::gauge::consumptionMah();
    batt["runtimeOpen"]   = power::gauge::runtimeOpenMin();
    batt["runtimeClosed"] = power::gauge::runtimeClosedMin();

    doc["charging"] = (s.batteryMa < 0);

    char payload[384];
    const size_t n = serializeJson(doc, payload, sizeof(payload));

    buildTopic("telemetry");
    return sClient.publish(sTopic, (const uint8_t*)payload, n, /*retained=*/false);
}

// Internal hook for ha_discovery — publishes a retained string at `topic`.
// Declared in ha_discovery.cpp so we don't widen mqtt.h's public surface.
bool publishRetained(const char* topic, const char* payload) {
    if (!sClient.connected()) return false;
    return sClient.publish(topic, payload, /*retained=*/true);
}

bool publishStatus(bool online) {
    if (!sClient.connected()) return false;
    buildTopic("availability");
    return sClient.publish(sTopic, online ? "online" : "offline", /*retained=*/true);
}

}  // namespace dfsu::net::mqtt
