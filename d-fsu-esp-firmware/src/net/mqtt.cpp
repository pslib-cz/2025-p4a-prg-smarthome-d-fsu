#include "mqtt.h"

#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "../actuators/led.h"
#include "../app/config.h"
#include "../power/fuel_gauge.h"
#include "../storage/impact_log.h"
#include "../storage/nvs_config.h"
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

// Unix epoch seconds for an event whose boot-relative timestamp is
// `bootRelativeMs`. When NTP has synced, reconstruct the wall-clock time of
// the event itself (now_epoch - seconds_since_event), so stored events keep
// their original timestamps instead of all getting stamped with the publish
// moment. Pre-sync we have no absolute reference, so fall back to
// boot-relative seconds.
uint32_t wallClockSeconds(uint32_t bootRelativeMs) {
    time_t now = time(nullptr);
    if (now > 1704067200) {
        const uint32_t deltaMs = millis() - bootRelativeMs;  // unsigned wrap is fine
        return (uint32_t)now - (deltaMs / 1000);
    }
    return bootRelativeMs / 1000;
}

void buildTopic(const char* suffix) {
    snprintf(sTopic, sizeof(sTopic), "dfsu/%s/%s", sClientId, suffix);
}

// Incoming command handler. Topics follow `dfsu/<id>/cmd/<what>`; dispatched
// by the last path segment. Payloads are small JSON blobs mirroring the BLE
// characteristic layouts — see contracts/mqtt-schema.md §commands.
void onMessage(char* topic, uint8_t* payload, unsigned int length) {
    // Find the suffix after "/cmd/" so we don't depend on clientId at compile time.
    const char* cmd = strstr(topic, "/cmd/");
    if (!cmd) return;
    cmd += 5;  // strlen("/cmd/")

    JsonDocument doc;
    if (deserializeJson(doc, payload, length)) {
        DFSU_WARN("mqtt", "cmd %s: bad JSON (%u B)", cmd, length);
        return;
    }

    if (strcmp(cmd, "led") == 0) {
        auto& c = config();
        if (doc["on"].is<bool>())        c.ledOn = doc["on"];
        if (doc["r"].is<int>())          c.ledR = (uint8_t)(int)doc["r"];
        if (doc["g"].is<int>())          c.ledG = (uint8_t)(int)doc["g"];
        if (doc["b"].is<int>())          c.ledB = (uint8_t)(int)doc["b"];
        if (doc["behavior"].is<int>())   c.ledBehavior = (uint8_t)(int)doc["behavior"];
        nvs::save(c);
        led::applyConfig();
        DFSU_LOG("mqtt", "cmd/led on=%d rgb=%02X%02X%02X beh=%u",
                 c.ledOn, c.ledR, c.ledG, c.ledB, c.ledBehavior);
    } else if (strcmp(cmd, "oled") == 0) {
        auto& c = config();
        if (doc["mask"].is<int>()) {
            c.oledBitmask = (uint16_t)(unsigned)doc["mask"];
            nvs::save(c);
            DFSU_LOG("mqtt", "cmd/oled mask=0x%04X", c.oledBitmask);
        } else {
            DFSU_WARN("mqtt", "cmd/oled: missing 'mask'");
        }
    } else {
        DFSU_WARN("mqtt", "cmd %s: no handler", cmd);
    }
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
#if DFSU_MQTT_INSECURE
        // TEMPORARY diagnostic — bypass CA verification to confirm whether the
        // TLS failure is a pinning issue or something deeper. Remove once the
        // CA path is understood.
        sTls.setInsecure();
        DFSU_WARN("mqtt", "TLS INSECURE mode — remove DFSU_MQTT_INSECURE build flag");
#else
        sTls.setCACert(cfg.caCertPem);
#endif
        sClient.setServer(sHost, cfg.port);
        sClient.setBufferSize(1024);  // impact JSON stays well under this
        sClient.setCallback(onMessage);
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

    // Subscribe to all command topics addressed to us. One wildcard sub keeps
    // future cmd/* additions (oled, threshold, …) working without a reconnect.
    buildTopic("cmd/#");
    if (!sClient.subscribe(sTopic)) {
        DFSU_WARN("mqtt", "subscribe %s failed", sTopic);
    }
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
    doc["ts"]     = wallClockSeconds(r.timestampMs);
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
    doc["ts"]          = wallClockSeconds(s.timestampMs);
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
    doc["case"]     = s.caseOpen ? "open" : "closed";

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
