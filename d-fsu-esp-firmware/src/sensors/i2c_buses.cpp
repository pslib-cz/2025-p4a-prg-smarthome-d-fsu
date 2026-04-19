#include "i2c_buses.h"

#include "../util/log.h"
#include "pins.h"

namespace dfsu::i2c {

bool initBuses() {
    // ESP32 Arduino exposes two TwoWire instances: Wire (I2C0) and Wire1 (I2C1).
    if (!Wire.begin(pins::kI2C0Sda, pins::kI2C0Scl, 400000)) {
        DFSU_ERR("i2c", "bus 0 begin failed");
        return false;
    }
    if (!Wire1.begin(pins::kI2C1Sda, pins::kI2C1Scl, 400000)) {
        DFSU_ERR("i2c", "bus 1 begin failed");
        return false;
    }
    DFSU_LOG("i2c", "bus0 SDA=%d SCL=%d | bus1 SDA=%d SCL=%d",
             pins::kI2C0Sda, pins::kI2C0Scl, pins::kI2C1Sda, pins::kI2C1Scl);
    return true;
}

TwoWire& sensorBus() { return Wire; }
TwoWire& uxBus()     { return Wire1; }

}  // namespace dfsu::i2c
