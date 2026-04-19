#pragma once

#include <stdint.h>

#include "../app/types.h"
#include "../storage/impact_log.h"

// MQTT client over TLS (port 8883). Publishes telemetry, impacts, and status
// to Mosquitto on Home Assistant. Impact publishes advance `mqtt_acked_id` on
// successful delivery so the firmware ring can free records.
//
// PubSubClient underneath only supports QoS 0 for publish; we advance the
// cursor optimistically on successful stack submission. A future swap to
// esp-mqtt (ESP-IDF native) would give proper QoS-1 PUBACK callbacks without
// changing this module's API.

namespace dfsu::net::mqtt {

struct Config {
    const char* host;
    uint16_t    port;
    const char* username;
    const char* password;
    const char* clientId;   // unique per device, e.g. "dfsu-A1B2"
    const char* caCertPem;  // REQUIRED; empty string → begin() refuses
};

// Connect to broker. Safe to call repeatedly; a no-op if already connected.
// Returns false if WiFi isn't up, the CA cert is empty, or the TLS handshake
// failed.
bool begin(const Config& cfg);

bool isConnected();

// Pump the network stack — call from the main loop/task. Drives PubSubClient's
// keep-alive + incoming subscription callbacks.
void loop();

// Publish one impact to `dfsu/<clientId>/impact` with eventId-keyed retain so
// HA dedups redundant relays. On success, advances mqttAckedId to the record's
// id immediately (QoS-0 limitation; see file-header note).
bool publishImpact(const impact_log::Record& r);

// Publish the latest telemetry snapshot to `dfsu/<clientId>/telemetry`.
// Fire-and-forget, not retained.
bool publishTelemetry(const TelemetrySnapshot& s);

// Availability ping to `dfsu/<clientId>/availability` (retained, LWT-backed).
// Sent on connect; LWT covers ungraceful disconnects.
bool publishStatus(bool online);

}  // namespace dfsu::net::mqtt
