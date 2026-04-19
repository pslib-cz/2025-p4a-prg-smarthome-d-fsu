#pragma once

namespace dfsu::bme {

struct Reading {
    float temperatureC;
    float humidityPct;
    float pressureHpa;
};

bool begin();              // call after i2c::initBuses(). false if chip not present.
bool read(Reading& out);   // returns false on read failure / not initialized.

}  // namespace dfsu::bme
