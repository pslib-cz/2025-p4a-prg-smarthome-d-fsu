#pragma once

#include <stdint.h>

// WiFi + MQTT credentials live in their own NVS namespace ("dfsu_net") so the
// main RuntimeConfig stays small and these stringy secrets don't round-trip
// through every config save. Loaded lazily at WiFi/MQTT bring-up.

namespace dfsu::net {

struct Creds {
    char     wifiSsid[33];   // 32 chars + NUL (WiFi spec max)
    char     wifiPsk[65];    // 64 + NUL
    char     mqttHost[64];   // hostname or IP
    uint16_t mqttPort;       // typically 8883 (TLS)
    char     mqttUser[33];
    char     mqttPass[65];

    bool hasWifi() const { return wifiSsid[0] != '\0'; }
    bool hasMqtt() const { return mqttHost[0] != '\0'; }
};

// Load creds from NVS. Returns false and zero-fills on first boot (no namespace
// yet). Callers should check hasWifi()/hasMqtt() before using.
bool loadCreds(Creds& out);

// Persist creds (called by BLE/MQTT config-write handlers in later phases).
bool saveCreds(const Creds& c);

}  // namespace dfsu::net
