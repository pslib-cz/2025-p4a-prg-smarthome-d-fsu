# D-FSU ESP32-S3 Firmware

PlatformIO project. Target: `esp32-s3-devkitc-1` on the Arduino framework.

## Build

```
pio run                    # build
pio run -t upload          # flash
pio device monitor         # serial at 115200
```

## Layout

```
src/
├── main.cpp           # Boot dispatch (wake cause → FSM entry)
├── app/               # FSM, event bus, runtime config
├── power/             # Deep sleep, wake sources, RTC state
├── sensors/           # BME280, MPU-6050, INA219, case switch
├── actuators/         # LED strip, OLED
├── storage/           # NVS config, impact_log ring buffer
├── ble/               # NimBLE GATT server + per-char handlers
├── net/               # WiFi, MQTT (TLS), HA Discovery
└── util/              # Logging, time
```

Full architecture: `../../firmware-architecture.md`.
Wire contracts: `../../contracts/gatt-profile.md`, `../../contracts/mqtt-schema.md`.

## Partitions

Custom table (`partitions.csv`) carves a 64 KB `impact_log` partition used as a flash ring buffer for impact events — the hot path when waking from deep sleep on an MPU motion interrupt.

## Phase 0 status

Skeleton only. `main.cpp` boots, prints banner + wake cause + heartbeats. No sensors, BLE, or WiFi yet — those come in Phase 1A.
