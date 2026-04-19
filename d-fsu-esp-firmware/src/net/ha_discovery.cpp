#include "ha_discovery.h"

#include <ArduinoJson.h>
#include <stdio.h>

#include "../util/log.h"
#include "mqtt.h"

namespace dfsu::net::mqtt {
// Internal hook owned by mqtt.cpp — publishes a retained string at `topic`.
bool publishRetained(const char* topic, const char* payload);
}  // namespace dfsu::net::mqtt

namespace dfsu::net::ha_discovery {

namespace {

// Build the HA `device` object once — same identity on every entity so HA
// groups them under a single device card.
void fillDevice(JsonObject dev, const char* clientId) {
    char devId[32];
    snprintf(devId, sizeof(devId), "dfsu_%s", clientId);
    dev["identifiers"][0] = devId;
    char name[32];
    snprintf(name, sizeof(name), "D-FSU %s", clientId);
    dev["name"]         = name;
    dev["manufacturer"] = "D-FSU";
    dev["model"]        = "ESP32-S3 Transport Box";
    dev["sw_version"]   = DFSU_FW_VERSION;
}

// Sensors derived from the retained telemetry topic. Columns match the table
// in contracts/mqtt-schema.md §Sensors — keep in sync.
struct SensorDef {
    const char* objectId;
    const char* name;
    const char* deviceClass;   // nullable
    const char* unit;          // nullable
    const char* valueTemplate; // Jinja against telemetry JSON
};

constexpr SensorDef kSensors[] = {
    {"temperature",     "Temperature",     "temperature",          "°C",  "{{ value_json.temperature }}"},
    {"humidity",        "Humidity",        "humidity",             "%",   "{{ value_json.humidity }}"},
    {"pressure",        "Pressure",        "atmospheric_pressure", "hPa", "{{ value_json.pressure }}"},
    {"battery_voltage", "Battery Voltage", "voltage",              "V",   "{{ (value_json.battery.voltage | float) / 1000 }}"},
    {"battery_current", "Battery Current", "current",              "mA",  "{{ value_json.battery.current }}"},
    {"battery_pct",     "Battery",         "battery",              "%",   "{{ value_json.battery.pct }}"},
    {"consumption",     "Consumption",     nullptr,                "mAh", "{{ value_json.battery.consumption }}"},
    {"runtime_open",    "Runtime (open)",  "duration",             "min", "{{ value_json.battery.runtimeOpen }}"},
    {"runtime_closed",  "Runtime (closed)","duration",             "min", "{{ value_json.battery.runtimeClosed }}"},
};

void publishSensor(const char* clientId, const SensorDef& s) {
    char topic[128], state[96], avail[96], uniq[64];
    snprintf(topic, sizeof(topic),
             "homeassistant/sensor/dfsu_%s_%s/config", clientId, s.objectId);
    snprintf(state, sizeof(state), "dfsu/%s/telemetry",    clientId);
    snprintf(avail, sizeof(avail), "dfsu/%s/availability", clientId);
    snprintf(uniq,  sizeof(uniq),  "dfsu_%s_%s", clientId, s.objectId);

    JsonDocument doc;
    doc["name"]                  = s.name;
    doc["unique_id"]             = uniq;
    doc["state_topic"]           = state;
    doc["availability_topic"]    = avail;
    doc["payload_available"]     = "online";
    doc["payload_not_available"] = "offline";
    doc["value_template"]        = s.valueTemplate;
    if (s.deviceClass) doc["device_class"]       = s.deviceClass;
    if (s.unit)        doc["unit_of_measurement"] = s.unit;
    fillDevice(doc["device"].to<JsonObject>(), clientId);

    char payload[512];
    serializeJson(doc, payload, sizeof(payload));
    mqtt::publishRetained(topic, payload);
}

// Charging flag — derived from telemetry.charging (published by mqtt.cpp).
void publishChargingBinary(const char* clientId) {
    char topic[128], state[96], avail[96], uniq[64];
    snprintf(topic, sizeof(topic),
             "homeassistant/binary_sensor/dfsu_%s_charging/config", clientId);
    snprintf(state, sizeof(state), "dfsu/%s/telemetry",    clientId);
    snprintf(avail, sizeof(avail), "dfsu/%s/availability", clientId);
    snprintf(uniq,  sizeof(uniq),  "dfsu_%s_charging", clientId);

    JsonDocument doc;
    doc["name"]                  = "Charging";
    doc["unique_id"]             = uniq;
    doc["state_topic"]           = state;
    doc["availability_topic"]    = avail;
    doc["payload_available"]     = "online";
    doc["payload_not_available"] = "offline";
    doc["device_class"]          = "battery_charging";
    doc["value_template"]        = "{{ 'ON' if value_json.charging else 'OFF' }}";
    fillDevice(doc["device"].to<JsonObject>(), clientId);

    char payload[512];
    serializeJson(doc, payload, sizeof(payload));
    mqtt::publishRetained(topic, payload);
}

// Impact — momentary binary_sensor. HA off_delay releases it after 2 s so the
// UI shows a blip rather than a latched state.
void publishImpactBinary(const char* clientId) {
    char topic[128], state[96], avail[96], uniq[64];
    snprintf(topic, sizeof(topic),
             "homeassistant/binary_sensor/dfsu_%s_impact/config", clientId);
    snprintf(state, sizeof(state), "dfsu/%s/impact",       clientId);
    snprintf(avail, sizeof(avail), "dfsu/%s/availability", clientId);
    snprintf(uniq,  sizeof(uniq),  "dfsu_%s_impact", clientId);

    JsonDocument doc;
    doc["name"]                  = "Impact";
    doc["unique_id"]             = uniq;
    doc["state_topic"]           = state;
    doc["availability_topic"]    = avail;
    doc["payload_available"]     = "online";
    doc["payload_not_available"] = "offline";
    doc["device_class"]          = "vibration";
    doc["off_delay"]             = 2;
    // Any message on the impact topic flips the sensor ON; off_delay handles reset.
    doc["value_template"]        = "ON";
    doc["json_attributes_topic"] = state;
    fillDevice(doc["device"].to<JsonObject>(), clientId);

    char payload[640];
    serializeJson(doc, payload, sizeof(payload));
    mqtt::publishRetained(topic, payload);
}

}  // namespace

bool publishAll(const char* clientId) {
    if (!mqtt::isConnected()) return false;
    for (const auto& s : kSensors) publishSensor(clientId, s);
    publishChargingBinary(clientId);
    publishImpactBinary(clientId);
    DFSU_LOG("ha", "discovery published (%u sensors + 2 binary)",
             (unsigned)(sizeof(kSensors) / sizeof(kSensors[0])));
    return true;
}

}  // namespace dfsu::net::ha_discovery
