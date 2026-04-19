#pragma once

// Pin assignments. Single source of truth; mirrored in prep/zapojeni.md.
// Change one, change the other.

namespace dfsu::pins {

// I2C bus 0 — sensor bus (BME280 + MPU-6050). Stays alive in Active mode.
constexpr int kI2C0Sda = 5;
constexpr int kI2C0Scl = 4;

// I2C bus 1 — UX bus (INA219 + SSD1306 OLED). De-powered in Sleep.
constexpr int kI2C1Sda = 7;
constexpr int kI2C1Scl = 6;

// Interrupts / discrete IO
constexpr int kMpuInt      = 8;   // MPU-6050 INT → deep-sleep wake source (Phase 3)
constexpr int kCaseSwitch  = 1;   // Reed/magnetic switch, active-low (closes to GND when open)
constexpr int kLedData     = 2;   // WS2812 COB strip DIN

}  // namespace dfsu::pins
