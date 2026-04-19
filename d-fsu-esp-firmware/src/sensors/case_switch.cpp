#include "case_switch.h"

#include <Arduino.h>

#include "../app/event_bus.h"
#include "../util/log.h"
#include "pins.h"

namespace dfsu::caseswitch {

namespace {
// Switch wired: pin ↔ GND via the switch contacts, pullup enabled internally.
// This build uses a "reverse" switch — contacts conduct only when the case is
// OPEN (saves battery since the case is closed most of the time, so no current
// flows through the pullup). With internal pullup:
//   LOW  = switch closed (conducting) → case OPEN
//   HIGH = switch open  (not conducting) → case CLOSED
// Flip this to `true` if you ever swap back to a normally-closed reed.
constexpr bool kOpenIsHigh = false;

volatile uint32_t lastIsrMs = 0;
volatile bool dirty = false;
bool debouncedOpen = false;

constexpr uint32_t kDebounceMs = 25;

void IRAM_ATTR isr() {
    lastIsrMs = millis();
    dirty = true;
}

bool readRaw() {
    int level = digitalRead(pins::kCaseSwitch);
    return kOpenIsHigh ? (level == HIGH) : (level == LOW);
}

void pollTask(void*) {
    while (true) {
        if (dirty && (millis() - lastIsrMs) >= kDebounceMs) {
            dirty = false;
            bool now = readRaw();
            if (now != debouncedOpen) {
                debouncedOpen = now;
                CaseEvent ev{ .timestampMs = millis(), .open = now };
                bus().postCaseChange(ev);
                DFSU_LOG("case", "state=%s", now ? "open" : "closed");
            }
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
}

bool begin() {
    pinMode(pins::kCaseSwitch, INPUT_PULLUP);
    debouncedOpen = readRaw();
    DFSU_LOG("case", "initial=%s", debouncedOpen ? "open" : "closed");
    attachInterrupt(digitalPinToInterrupt(pins::kCaseSwitch), isr, CHANGE);
    xTaskCreatePinnedToCore(pollTask, "case_poll", 2048, nullptr, 2, nullptr, 1);
    return true;
}

bool isOpen() { return debouncedOpen; }

}  // namespace dfsu::caseswitch
