#pragma once

#include <stdint.h>

// Deep sleep + wake source dispatch, per firmware-architecture.md §Power States.
//
// Wake sources share an ext1 ANY_LOW bitmask:
//   GPIO1 — case switch (conducts to GND when case OPEN; reverse-wired build)
//   GPIO8 — MPU-6050 INT pin, configured active-LOW (mpu::configureMotionInterrupt)
//
// The boot dispatcher (main.cpp) reads wakeCause() before initializing anything
// heavy and routes to LOG_SB / ACTIVE accordingly.

namespace dfsu::power {

enum class WakeCause : uint8_t {
    PowerOn,      // cold boot, reset button, or brownout
    CaseOpened,   // ext1 on GPIO1
    Impact,       // ext1 on GPIO8 (MPU motion interrupt)
    Timer,        // RTC timer — scheduled REPORT wake
    Unknown,
};

// Call once at boot, before peripheral init. Decodes the ESP-IDF wake reason
// into the domain enum and reads which pin (if any) triggered ext1.
WakeCause wakeCause();

// Configure ext1 ANY_LOW on {GPIO1, GPIO8} and arm for deep sleep.
// `timerSec == 0` disables the timer wake source.
// `includeMpuInt = false` drops GPIO8 from the mask — use when the MPU isn't
// on the bus, since its INT line may float/park low and wake us instantly.
void armWakeSources(uint32_t timerSec = 0, bool includeMpuInt = true);

// Power down everything and enter deep sleep. Never returns.
[[noreturn]] void enterDeepSleep();

// Counter in RTC slow memory — persists across deep sleep cycles.
uint32_t bootCount();
uint32_t logSbCount();   // # of LOG_SB wakes since last full boot
void     noteLogSbWake();

// RTC-mem state shared with the coulomb counter + time module.
struct SleepState {
    uint32_t bootCount;
    uint32_t logSbCount;
    uint32_t lastSleepEntryMs;   // millis() at sleep entry (boot-relative)
    uint32_t lastSleepDurationS; // filled in on wake
};
SleepState& state();

}  // namespace dfsu::power
