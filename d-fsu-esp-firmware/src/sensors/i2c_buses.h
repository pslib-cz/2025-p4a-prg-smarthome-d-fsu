#pragma once

#include <Wire.h>

// Dual I2C bus bring-up. Call initBuses() once in setup() before any sensor begin().

namespace dfsu::i2c {

bool initBuses();

// Bus 0: BME280 + MPU-6050 (sensor bus). Exposed as the default Wire instance.
TwoWire& sensorBus();

// Bus 1: INA219 + SSD1306 OLED (UX bus).
TwoWire& uxBus();

}  // namespace dfsu::i2c
