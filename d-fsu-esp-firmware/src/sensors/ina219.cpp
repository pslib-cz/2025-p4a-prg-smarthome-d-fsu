#include "ina219.h"

#include <Adafruit_INA219.h>

#include "../util/log.h"
#include "i2c_buses.h"

namespace dfsu::ina {

namespace {
// Using the constructor that takes the i2c address; we pass the UX bus via begin().
Adafruit_INA219 sensor(0x40);
bool ready = false;
}

bool begin() {
    if (ready) return true;
    if (!sensor.begin(&i2c::uxBus())) {
        DFSU_ERR("ina", "begin failed at 0x40");
        return false;
    }
    // 32V / 2A range matches a 2S Li-ion BMS comfortably.
    sensor.setCalibration_32V_2A();
    ready = true;
    DFSU_LOG("ina", "ready");
    return true;
}

bool read(Reading& out) {
    if (!ready) return false;
    out.busVoltageV    = sensor.getBusVoltage_V();
    out.shuntVoltageMv = sensor.getShuntVoltage_mV();
    out.currentMa      = sensor.getCurrent_mA();
    out.powerMw        = sensor.getPower_mW();
    return true;
}

uint8_t estimateBatteryPct(float busVoltageV, uint32_t packCapacityMah, float mAhRemaining) {
    // Coulomb-counter reading if we have it; otherwise fall back to voltage heuristic.
    // Phase 1A just gets the fallback — proper integrator comes in Phase 3.
    if (packCapacityMah > 0 && mAhRemaining >= 0.0f) {
        float pct = (mAhRemaining / (float)packCapacityMah) * 100.0f;
        if (pct < 0) pct = 0;
        if (pct > 100) pct = 100;
        return (uint8_t)pct;
    }
    // 2S Li-ion open-circuit curve (rough):
    //   8.4V = 100%, 7.4V = ~50%, 6.4V = 0% (cutoff well before this).
    constexpr float vFull   = 8.4f;
    constexpr float vEmpty  = 6.4f;
    float clamped = busVoltageV;
    if (clamped < vEmpty) clamped = vEmpty;
    if (clamped > vFull)  clamped = vFull;
    return (uint8_t)((clamped - vEmpty) / (vFull - vEmpty) * 100.0f);
}

}  // namespace dfsu::ina
