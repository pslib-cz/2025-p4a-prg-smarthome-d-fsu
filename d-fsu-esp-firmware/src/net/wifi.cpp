#include "wifi.h"

#include <Arduino.h>
#include <WiFi.h>

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

}  // namespace dfsu::net::wifi
