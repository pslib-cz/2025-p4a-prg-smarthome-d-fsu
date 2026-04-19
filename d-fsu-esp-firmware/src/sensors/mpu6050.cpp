#include "mpu6050.h"

#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <math.h>

#include "../util/log.h"
#include "i2c_buses.h"

namespace dfsu::mpu {

namespace {
Adafruit_MPU6050 sensor;
bool ready = false;

// Per zapojeni.md: AD0→GND ⇒ I2C address 0x68.
constexpr uint8_t kAddr = 0x68;

constexpr float kGravityMs2 = 9.80665f;
}

bool begin() {
    if (ready) return true;
    if (!sensor.begin(kAddr, &i2c::sensorBus())) {
        DFSU_ERR("mpu", "begin failed at 0x%02X", kAddr);
        return false;
    }
    // 8g range gives usable resolution for RC impacts up to ~7g without clipping often.
    sensor.setAccelerometerRange(MPU6050_RANGE_8_G);
    sensor.setGyroRange(MPU6050_RANGE_500_DEG);
    sensor.setFilterBandwidth(MPU6050_BAND_44_HZ);
    ready = true;
    DFSU_LOG("mpu", "ready");
    return true;
}

bool isReady() { return ready; }

bool read(Reading& out) {
    if (!ready) return false;
    sensors_event_t a, g, t;
    if (!sensor.getEvent(&a, &g, &t)) return false;
    out.gX = a.acceleration.x / kGravityMs2;
    out.gY = a.acceleration.y / kGravityMs2;
    out.gZ = a.acceleration.z / kGravityMs2;
    out.peakG = sqrtf(out.gX*out.gX + out.gY*out.gY + out.gZ*out.gZ);
    out.tempC = t.temperature;
    return true;
}

bool configureMotionInterrupt(float thresholdG, uint16_t durationMs) {
    if (!ready) return false;
    // Adafruit library exposes the classic MPU-6050 motion-detection registers.
    // Threshold LSB = 2 mg (@ ±8g range). Clamp to the 8-bit register field.
    uint8_t thresholdReg =
        (uint8_t)fminf(255.0f, fmaxf(1.0f, thresholdG * 1000.0f / 2.0f));
    uint8_t durationReg = (uint8_t)fminf(255, durationMs);  // LSB = 1 ms

    sensor.setMotionDetectionThreshold(thresholdReg);
    sensor.setMotionDetectionDuration(durationReg);
    // Active-LOW + open-drain is ideal for sharing the INT line with an ext1
    // ANY_LOW wake mask. Latched so the pin stays low until we read the status.
    sensor.setInterruptPinLatch(true);
    sensor.setInterruptPinPolarity(true);      // active LOW
    sensor.setMotionInterrupt(true);
    // Clear any latched bit so we don't immediately re-trigger wake.
    sensor.getMotionInterruptStatus();
    DFSU_LOG("mpu", "motion int armed thresh=%.2fg (reg=%u) dur=%ums",
             thresholdG, thresholdReg, durationMs);
    return true;
}

bool readAndClearMotion() {
    if (!ready) return false;
    return sensor.getMotionInterruptStatus();
}

}  // namespace dfsu::mpu
