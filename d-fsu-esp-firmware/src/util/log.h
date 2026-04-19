#pragma once

#include <stdio.h>

// Thin log wrapper. We use plain printf() (routed by ESP-IDF stdout) rather
// than Serial.printf because on ESP32-S3 with USB-CDC-on-boot, Serial writes
// can silently drop while the IDF stdout path keeps working — same channel
// NimBLE and the esp32-hal i2c logs come through.
// Do not print secrets (WiFi creds, MQTT passwords, TLS keys).

#define DFSU_LOG(tag,  fmt, ...) printf("[" tag "] " fmt "\n", ##__VA_ARGS__)
#define DFSU_WARN(tag, fmt, ...) printf("[!" tag "] " fmt "\n", ##__VA_ARGS__)
#define DFSU_ERR(tag,  fmt, ...) printf("[xx" tag "] " fmt "\n", ##__VA_ARGS__)
