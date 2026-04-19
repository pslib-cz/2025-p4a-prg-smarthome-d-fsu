#pragma once

#include <stdint.h>

// WiFi STA bring-up. Non-blocking connect with a bounded timeout — MQTT and
// anything else that needs IP waits on isConnected() before proceeding.

namespace dfsu::net::wifi {

// Start connecting. Returns true once associated + DHCP complete, or false on
// timeout. Safe to call repeatedly; a no-op if already connected.
bool begin(const char* ssid, const char* psk, uint32_t timeoutMs = 15000);

bool isConnected();

void disconnect();

// Signed RSSI in dBm; 0 if not connected.
int8_t rssi();

}  // namespace dfsu::net::wifi
