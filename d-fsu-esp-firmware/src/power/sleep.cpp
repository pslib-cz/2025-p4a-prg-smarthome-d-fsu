#include "sleep.h"

#include <Arduino.h>
#include <driver/rtc_io.h>
#include <esp_sleep.h>

#include "../sensors/pins.h"
#include "../util/log.h"

namespace dfsu::power {

namespace {

// RTC_DATA_ATTR — lives in RTC slow memory, preserved across deep sleep.
RTC_DATA_ATTR uint32_t s_bootCount = 0;
RTC_DATA_ATTR uint32_t s_logSbCount = 0;
RTC_DATA_ATTR uint32_t s_lastSleepEntryMs = 0;
RTC_DATA_ATTR uint64_t s_sleepStartUs = 0;

SleepState s_state{};

uint64_t pinMask(bool includeMpuInt) {
    // ESP32-S3 ext1 takes a 64-bit mask of RTC-capable GPIOs.
    uint64_t m = (1ULL << pins::kCaseSwitch);
    if (includeMpuInt) m |= (1ULL << pins::kMpuInt);
    return m;
}

}  // namespace

WakeCause wakeCause() {
    esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
    switch (cause) {
        case ESP_SLEEP_WAKEUP_EXT1: {
            uint64_t pin = esp_sleep_get_ext1_wakeup_status();
            if (pin & (1ULL << pins::kMpuInt))     return WakeCause::Impact;
            if (pin & (1ULL << pins::kCaseSwitch)) return WakeCause::CaseOpened;
            return WakeCause::Unknown;
        }
        case ESP_SLEEP_WAKEUP_TIMER:
            return WakeCause::Timer;
        case ESP_SLEEP_WAKEUP_UNDEFINED:
        default:
            return WakeCause::PowerOn;
    }
}

void armWakeSources(uint32_t timerSec, bool includeMpuInt) {
    // Both GPIO1 (case switch conducting = open) and GPIO8 (MPU INT active-LOW
    // after mpu::configureMotionInterrupt) pull LOW when triggered, so ANY_LOW
    // covers both without needing separate ext0/ext1 allocations.
    // Clear any leftover wake config so we start from a known state.
    esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
    // Order matters: esp_sleep_enable_ext1_wakeup re-inits RTC GPIO for the
    // selected pins (clearing pull config), so we configure pulls *after*.
    esp_sleep_enable_ext1_wakeup(pinMask(includeMpuInt), ESP_EXT1_WAKEUP_ANY_LOW);
    if (timerSec > 0) {
        esp_sleep_enable_timer_wakeup((uint64_t)timerSec * 1000000ULL);
    }

    // IOMUX pullups do NOT persist through deep sleep on ESP32-S3 — once in
    // RTC mode, only rtc_gpio_* pulls are in effect.
    rtc_gpio_pulldown_dis((gpio_num_t)pins::kCaseSwitch);
    rtc_gpio_pullup_en((gpio_num_t)pins::kCaseSwitch);
    if (includeMpuInt) {
        rtc_gpio_pulldown_dis((gpio_num_t)pins::kMpuInt);
        rtc_gpio_pullup_en((gpio_num_t)pins::kMpuInt);
    }
    // Keep the RTC peripheral domain powered during sleep so the pullups hold.
    esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_ON);
}

[[noreturn]] void enterDeepSleep() {
    s_lastSleepEntryMs = millis();
    s_sleepStartUs = esp_timer_get_time();
    DFSU_LOG("sleep", "entering deep sleep (boots=%u logsb=%u)",
             s_bootCount, s_logSbCount);
    // Do NOT call Serial.flush() — on ESP32-S3 with USB-CDC on boot, if the
    // host terminal isn't draining the TX buffer, flush() blocks indefinitely
    // and we never actually reach esp_deep_sleep_start(). A fixed short delay
    // gives buffered bytes a chance to drain without risking a hang, and
    // Serial.end() tears down the USB peripheral so it doesn't fight sleep.
    delay(50);
    Serial.end();
    esp_deep_sleep_start();
    // unreachable
    for (;;) {}
}

uint32_t bootCount() { return s_bootCount; }
uint32_t logSbCount() { return s_logSbCount; }
void noteLogSbWake() { s_logSbCount++; }

SleepState& state() {
    s_state.bootCount = s_bootCount;
    s_state.logSbCount = s_logSbCount;
    s_state.lastSleepEntryMs = s_lastSleepEntryMs;
    // Approximate sleep duration from the RTC timer if we have a prior entry.
    uint64_t now = esp_timer_get_time();
    s_state.lastSleepDurationS = (s_sleepStartUs > 0 && now > s_sleepStartUs)
        ? (uint32_t)((now - s_sleepStartUs) / 1000000ULL)
        : 0;
    return s_state;
}

// Bump s_bootCount exactly once per cold start.  Done here so callers don't
// have to remember; wakeCause() happens to be the universal entry point.
namespace {
struct BootCounter {
    BootCounter() {
        // Only increment on a fresh power-on; deep-sleep wakes keep the count.
        if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_UNDEFINED) {
            s_bootCount++;
            s_logSbCount = 0;
        }
    }
};
BootCounter s_bootCounterInit;
}

}  // namespace dfsu::power
