#include "mpu6050.h"

#include <Wire.h>
#include <math.h>

#include "../util/log.h"
#include "i2c_buses.h"

// Direct-register driver. The breakout sold as "MPU-6050" is sometimes a
// MPU-6500 clone (WHO_AM_I=0x70) — registers for basic accel/gyro/temp are
// compatible across both, but motion-detection differs. This driver reads
// raw registers so it works on either chip; motion-interrupt configuration
// uses the MPU-6050 MOT_DETECT path, which is a no-op on MPU-6500. Hardware
// wake-on-motion on 6500 would need WOM_THR + ACCEL_INTEL_CTRL instead.

namespace dfsu::mpu {

namespace {

constexpr uint8_t kAddr        = 0x68;
constexpr uint8_t kAddrAlt     = 0x69;
constexpr float   kGravityMs2  = 9.80665f;

// Register addresses (shared MPU-6050 / MPU-6500).
constexpr uint8_t REG_SMPLRT_DIV   = 0x19;
constexpr uint8_t REG_CONFIG       = 0x1A;
constexpr uint8_t REG_GYRO_CONFIG  = 0x1B;
constexpr uint8_t REG_ACCEL_CONFIG = 0x1C;
constexpr uint8_t REG_MOT_THR      = 0x1F;  // MPU-6050 MOT_THR / MPU-6500 WOM_THR
constexpr uint8_t REG_MOT_DUR      = 0x20;  // MPU-6050 only
constexpr uint8_t REG_INT_PIN_CFG  = 0x37;
constexpr uint8_t REG_INT_ENABLE   = 0x38;
constexpr uint8_t REG_INT_STATUS   = 0x3A;
constexpr uint8_t REG_ACCEL_XOUT_H = 0x3B;
constexpr uint8_t REG_MOT_DETECT_CTRL = 0x69;  // MPU-6050 only
constexpr uint8_t REG_PWR_MGMT_1   = 0x6B;
constexpr uint8_t REG_WHO_AM_I     = 0x75;

uint8_t sAddr   = kAddr;
uint8_t sWhoAmI = 0;
bool    ready   = false;

// ±8g range → 4096 LSB/g per datasheet (both 6050 and 6500).
constexpr float kAccelLsbPerG = 4096.0f;

bool writeReg(uint8_t reg, uint8_t val) {
    auto& bus = i2c::sensorBus();
    bus.beginTransmission(sAddr);
    bus.write(reg);
    bus.write(val);
    return bus.endTransmission() == 0;
}

int readReg(uint8_t reg) {
    auto& bus = i2c::sensorBus();
    bus.beginTransmission(sAddr);
    bus.write(reg);
    if (bus.endTransmission(false) != 0) return -1;
    if (bus.requestFrom((int)sAddr, 1) != 1) return -1;
    return bus.read();
}

bool readBlock(uint8_t reg, uint8_t* buf, size_t n) {
    auto& bus = i2c::sensorBus();
    bus.beginTransmission(sAddr);
    bus.write(reg);
    if (bus.endTransmission(false) != 0) return false;
    if ((size_t)bus.requestFrom((int)sAddr, (int)n) != n) return false;
    for (size_t i = 0; i < n; ++i) buf[i] = bus.read();
    return true;
}

void scanBus() {
    auto& bus = i2c::sensorBus();
    char found[96] = {0};
    size_t n = 0;
    for (uint8_t addr = 1; addr < 127; ++addr) {
        bus.beginTransmission(addr);
        if (bus.endTransmission() == 0 && n < sizeof(found) - 6) {
            n += snprintf(found + n, sizeof(found) - n, "0x%02X ", addr);
        }
    }
    DFSU_LOG("mpu", "bus0 scan: %s", n ? found : "(no devices)");
}

bool probe(uint8_t addr) {
    sAddr = addr;
    int who = readReg(REG_WHO_AM_I);
    if (who < 0) return false;
    sWhoAmI = (uint8_t)who;
    // Known IDs: 0x68 = MPU-6050, 0x70 = MPU-6500, 0x71 = MPU-9250,
    // 0x73 = MPU-9255. Accept anything that's not 0/0xFF — the read path
    // is identical for all of them.
    return sWhoAmI != 0 && sWhoAmI != 0xFF;
}

}  // namespace

bool begin() {
    if (ready) return true;

    scanBus();

    if (!probe(kAddr) && !probe(kAddrAlt)) {
        DFSU_ERR("mpu", "no WHO_AM_I response at 0x68/0x69");
        return false;
    }
    DFSU_LOG("mpu", "found at 0x%02X WHO_AM_I=0x%02X", sAddr, sWhoAmI);

    // Reset, wait, wake, select PLL clock.
    if (!writeReg(REG_PWR_MGMT_1, 0x80)) {  // reset
        DFSU_ERR("mpu", "reset write failed");
        return false;
    }
    delay(100);
    writeReg(REG_PWR_MGMT_1, 0x01);         // wake, CLKSEL=PLL gyro-X
    delay(10);

    writeReg(REG_SMPLRT_DIV, 0x00);          // 1 kHz / (1+0) = 1 kHz
    writeReg(REG_CONFIG,     0x03);          // DLPF 44 Hz accel / 42 Hz gyro
    writeReg(REG_GYRO_CONFIG,  0x08);        // FS_SEL=1 → ±500 dps
    writeReg(REG_ACCEL_CONFIG, 0x10);        // AFS_SEL=2 → ±8 g

    ready = true;
    DFSU_LOG("mpu", "ready");
    return true;
}

bool isReady() { return ready; }

bool read(Reading& out) {
    if (!ready) return false;
    uint8_t b[14];
    if (!readBlock(REG_ACCEL_XOUT_H, b, sizeof(b))) return false;

    int16_t ax = (int16_t)((b[0] << 8) | b[1]);
    int16_t ay = (int16_t)((b[2] << 8) | b[3]);
    int16_t az = (int16_t)((b[4] << 8) | b[5]);
    int16_t t  = (int16_t)((b[6] << 8) | b[7]);
    // gyro raw in b[8..13] — not used by the impact path, skipped.

    out.gX = ax / kAccelLsbPerG;
    out.gY = ay / kAccelLsbPerG;
    out.gZ = az / kAccelLsbPerG;
    out.peakG = sqrtf(out.gX*out.gX + out.gY*out.gY + out.gZ*out.gZ);
    // MPU-6050 temp: t/340 + 36.53. MPU-6500: t/333.87 + 21. Close enough for
    // a sanity value; don't use for anything precise.
    out.tempC = (sWhoAmI == 0x68) ? (t / 340.0f + 36.53f)
                                  : (t / 333.87f + 21.0f);
    return true;
}

bool configureMotionInterrupt(float thresholdG, uint16_t durationMs) {
    if (!ready) return false;

    // MPU-6050 MOT_DETECT path. On MPU-6500 these registers exist but the
    // wake-on-motion flow needs ACCEL_INTEL_CTRL + LP_ACCEL mode — skipped
    // for now; the chip will still produce samples, just no INT line.
    if (sWhoAmI != 0x68) {
        DFSU_WARN("mpu", "motion int not implemented for WHO_AM_I=0x%02X — "
                         "telemetry still works, no hardware wake", sWhoAmI);
        return false;
    }

    uint8_t thresholdReg =
        (uint8_t)fminf(255.0f, fmaxf(1.0f, thresholdG * 1000.0f / 2.0f));
    uint8_t durationReg = (uint8_t)fminf(255, durationMs);

    writeReg(REG_MOT_THR, thresholdReg);
    writeReg(REG_MOT_DUR, durationReg);
    writeReg(REG_MOT_DETECT_CTRL, 0x15);  // accel HPF + 1 ms decrement
    writeReg(REG_INT_PIN_CFG, 0xA0);      // active-low, open-drain, latch until read
    writeReg(REG_INT_ENABLE, 0x40);       // MOT_EN
    (void)readReg(REG_INT_STATUS);        // clear any latched bit

    DFSU_LOG("mpu", "motion int armed thresh=%.2fg (reg=%u) dur=%ums",
             thresholdG, thresholdReg, durationMs);
    return true;
}

bool readAndClearMotion() {
    if (!ready) return false;
    int s = readReg(REG_INT_STATUS);
    return s > 0 && (s & 0x40);
}

}  // namespace dfsu::mpu
