#include "bme280.h"

#include <Adafruit_BME280.h>

#include "../util/log.h"
#include "i2c_buses.h"

namespace dfsu::bme {

namespace {
Adafruit_BME280 sensor;
bool ready = false;

// Per zapojeni.md: SDO→GND => I2C address 0x76; CSB→3V3 => I2C mode.
constexpr uint8_t kAddr = 0x76;
}

bool begin() {
    if (ready) return true;
    if (!sensor.begin(kAddr, &i2c::sensorBus())) {
        DFSU_ERR("bme", "begin failed at 0x%02X", kAddr);
        return false;
    }
    // Weather-station defaults: low power, one-shot-ish sampling.
    sensor.setSampling(Adafruit_BME280::MODE_NORMAL,
                       Adafruit_BME280::SAMPLING_X1,   // temp
                       Adafruit_BME280::SAMPLING_X1,   // pressure
                       Adafruit_BME280::SAMPLING_X1,   // humidity
                       Adafruit_BME280::FILTER_OFF,
                       Adafruit_BME280::STANDBY_MS_1000);
    ready = true;
    DFSU_LOG("bme", "ready");
    return true;
}

bool read(Reading& out) {
    if (!ready) return false;
    out.temperatureC = sensor.readTemperature();
    out.humidityPct  = sensor.readHumidity();
    out.pressureHpa  = sensor.readPressure() / 100.0f;
    return !isnan(out.temperatureC) && !isnan(out.humidityPct);
}

}  // namespace dfsu::bme
