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

// Block until SNTP has set the system clock to a plausibly recent time, or
// until `timeoutMs` elapses. Required before any TLS connect — mbedtls checks
// cert validity dates, and the ESP32 boots at epoch 0, which makes every cert
// look "not yet valid" and fails the handshake with X509 -0x2700.
// Returns true once the clock advances past 2024-01-01.
bool syncTime(uint32_t timeoutMs = 10000);

}  // namespace dfsu::net::wifi
