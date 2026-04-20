#include "wifi.h"

#include <Arduino.h>
#include <WiFi.h>
#include <time.h>

#include "../util/log.h"

namespace dfsu::net::wifi {

bool begin(const char* ssid, const char* psk, uint32_t timeoutMs) {
    if (WiFi.status() == WL_CONNECTED) return true;
    if (!ssid || !ssid[0]) {
        DFSU_WARN("wifi", "no SSID configured");
        return false;
    }

    // STA mode only — we're a client, never an AP. Explicit mode call keeps
    // us out of persistent-flash config (saves wear, avoids surprises after
    // reboot if the user had previously run AP-mode for provisioning).
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, psk);

    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > timeoutMs) {
            DFSU_WARN("wifi", "connect timeout (%u ms) ssid=%s", timeoutMs, ssid);
            return false;
        }
        delay(100);
    }
    DFSU_LOG("wifi", "connected ssid=%s rssi=%d ip=%s",
             ssid, (int)WiFi.RSSI(), WiFi.localIP().toString().c_str());
    return true;
}

bool isConnected() { return WiFi.status() == WL_CONNECTED; }

void disconnect() {
    WiFi.disconnect(/*wifioff=*/true);
    DFSU_LOG("wifi", "disconnected");
}

int8_t rssi() {
    return isConnected() ? (int8_t)WiFi.RSSI() : 0;
}

bool syncTime(uint32_t timeoutMs) {
    // Already synced? Treat "after 2024-01-01" as "plausibly correct" — the
    // boot-default epoch-0 clock is what breaks TLS cert validity checks.
    time_t now = time(nullptr);
    if (now > 1704067200) return true;

    // Three public pools — redundancy in case the first one isn't reachable.
    // TZ=UTC is fine for cert validity; wall-clock display can shift later.
    configTime(0, 0, "pool.ntp.org", "time.nist.gov", "time.google.com");

    const uint32_t start = millis();
    while ((now = time(nullptr)) <= 1704067200) {
        if (millis() - start > timeoutMs) {
            DFSU_WARN("wifi", "NTP sync timeout (%u ms) — TLS will reject certs",
                      timeoutMs);
            return false;
        }
        delay(200);
    }
    DFSU_LOG("wifi", "NTP synced: %ld", (long)now);
    return true;
}

}  // namespace dfsu::net::wifi
