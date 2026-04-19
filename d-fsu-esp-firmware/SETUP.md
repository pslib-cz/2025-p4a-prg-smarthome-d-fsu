# D-FSU Firmware — First Flash Tutorial

Walks through setting up PlatformIO, building the Phase 1A skeleton, flashing an ESP32-S3 DevKitC-1, and verifying all four sensors show up on the serial console.

Time budget: ~30 min if you've never used PlatformIO, ~10 min if you have.

## 1. Install PlatformIO

**Option A — VS Code (recommended):**
1. Install VS Code if you don't already have it.
2. In VS Code: Extensions (`Ctrl+Shift+X`) → search `PlatformIO IDE` → Install.
3. First launch takes a few minutes (downloads the toolchain). Wait for the status bar to show the house icon (PIO Home).

**Option B — CLI only:**
```bash
pip install platformio
```
Verify: `pio --version`.

## 2. Open the firmware project

In VS Code: `File → Open Folder…` → select
`C:\_dev\d-fsu\2025-p4a-prg-smarthome-d-fsu\d-fsu-esp-firmware`.

PlatformIO will auto-detect `platformio.ini` and start fetching dependencies (BME280, MPU6050, INA219, SSD1306, NimBLE, PubSubClient, ArduinoJson, FastLED). First run downloads ~100 MB; subsequent builds are cached.

You'll see a status bar at the bottom of VS Code with PIO icons: ✓ (build), → (upload), plug (monitor).

## 3. Wire the hardware

Per `../prep/zapojeni.md`. Quick summary:

| What | ESP32-S3 pin |
|---|---|
| I2C bus 0 SDA (BME280 + MPU-6050) | GPIO5 |
| I2C bus 0 SCL (BME280 + MPU-6050) | GPIO4 |
| I2C bus 1 SDA (INA219 + OLED) | GPIO7 |
| I2C bus 1 SCL (INA219 + OLED) | GPIO6 |
| MPU-6050 INT | GPIO8 |
| Case switch | GPIO1 ↔ GND |
| WS2812 COB strip DIN | GPIO2 |

Power: BMS 5V → INA219 VIN+, INA219 VIN- → ESP32-S3 5V pin, common GND.

**For this first flash**, you don't strictly need every sensor connected. The firmware tolerates missing sensors — anything that fails to `begin()` will print an `[xx...]` error and be skipped. Minimum to see telemetry: at least one of BME280 / INA219 / MPU-6050.

## 4. Build

In VS Code: click the ✓ in the PIO status bar (or `Ctrl+Alt+B`).

First build takes a few minutes — PlatformIO downloads all lib_deps. Subsequent builds are ~10–20 seconds.

Expected success line:
```
======= [SUCCESS] Took N seconds =======
```

If you see errors, read the first one — the rest are usually cascading. Common first-time issues:
- Lib download failed: retry; it's a network hiccup.
- Wrong Python: PIO bundles its own; if you have system Python interference, reopen VS Code.

## 5. Flash the ESP32-S3

1. Plug the ESP32-S3 DevKitC-1 into USB (use the `USB` port, not `UART`, on boards that have both).
2. Pick the COM port: PIO usually auto-detects. If not, go to Device Manager → note the COM number → add `upload_port = COMx` to `platformio.ini` under `[env:esp32-s3-devkitc-1]`.
3. Click the → in the PIO status bar (or `Ctrl+Alt+U`).

If you get `A fatal error occurred: Failed to connect to ESP32-S3`, hold the `BOOT` button on the board, click upload, release `BOOT` when you see "Connecting…". Some boards don't auto-enter bootloader mode.

## 6. Open the serial monitor

Click the plug icon in the PIO status bar (or `Ctrl+Alt+S`).

Expected output within 2 seconds of reset:

```
===== D-FSU boot =====
fw:       0.1.0
chip:     ESP32-S3 rev 0
cpu:      240 MHz
wake:     0
======================
[i2c] bus0 SDA=5 SCL=4 | bus1 SDA=7 SCL=6
[bme] ready
[mpu] ready
[ina] ready
[case] initial=closed
[fsm] boot -> active
[tele] T=24.52C RH=41.3% P=1011.2hPa V=7.85V I=42mA 72% case=closed
[tele] T=24.53C RH=41.3% P=1011.2hPa V=7.85V I=41mA 72% case=closed
```

## 7. Smoke tests

Run these to confirm each subsystem works:

**Sensors present.** You should see `[bme] ready`, `[mpu] ready`, `[ina] ready` on boot. If any is missing, check wiring; if INA219 fails, verify the board jumper for address 0x40.

**Telemetry flowing.** `[tele]` lines every second. Temperature should match the room; battery voltage should match your pack (7.4–8.4 V for a 2S Li-ion).

**Case switch interrupt.** Open and close the case (or short/unshort GPIO1 to GND). You should see:
```
[case] state=open
[case] event: OPEN
[case] state=closed
[case] event: CLOSED
```
Both lines — the first from the case switch module, the second from the debug consumer reading the event bus. This proves the bus is working end-to-end.

**Impact detection.** Tap the MPU-6050 briskly. You should see `[imp] peak=2.4g ...` lines. (Phase 1A prints anything over 1.5 g; Phase 3 will introduce the real threshold + flash logging.)

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Build fails on `Adafruit_BME280.h not found` | Delete `.pio/` folder and rebuild — lib cache issue. |
| `[xx bme] begin failed at 0x76` | Address might be 0x77 if SDO→3V3 instead of GND. Edit `sensors/bme280.cpp` `kAddr`. |
| `[xx ina] begin failed at 0x40` | Check the A0/A1 jumpers on the INA219 board — default is 0x40. |
| Constant case-switch flipping | Pull-up noise. Increase `kDebounceMs` in `case_switch.cpp` from 25 to 50. |
| Garbled serial | Baud mismatch. Ensure monitor is 115200 (matches `monitor_speed` in platformio.ini). |

## 9. When you're done

Report back what you see — `[bme]`, `[mpu]`, `[ina]`, `[case]` lines all present, rough values sane. That's the signal that Phase 1A is done on hardware, and we move to Phase 2 (BLE bring-up + Android `RealDeviceDataSource`).

If something didn't work and the fixes above don't resolve it, paste the full serial output and the exact error.
