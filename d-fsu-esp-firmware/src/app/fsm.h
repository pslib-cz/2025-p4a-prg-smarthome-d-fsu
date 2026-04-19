#pragma once

#include <Arduino.h>

// Mode FSM scaffold per firmware-architecture.md §Power States.
// Phase 1A: just the enum + transition helpers. Real transition logic (deep
// sleep entry, impact handling, REPORT scheduling) lands in Phase 3 and 5.

namespace dfsu {

enum class Mode : uint8_t {
    Boot,     // transient: setup() is running
    Active,   // case open OR BLE peer connected — full sensors, UI, transports
    Sleep,    // deep sleep; entered explicitly in Phase 3
    LogSb,    // log-and-sleep-back; only reachable from Sleep via MPU wake (Phase 3)
    Report,   // WiFi + MQTT burst to HA (Phase 5)
};

const char* modeName(Mode m);

class Fsm {
public:
    void setMode(Mode m);
    Mode mode() const { return mode_; }

    // Called periodically from loop(). Phase 1A: no-op beyond logging.
    void tick();

private:
    Mode mode_ = Mode::Boot;
    uint32_t lastTickMs_ = 0;
};

Fsm& fsm();  // singleton accessor

}  // namespace dfsu
