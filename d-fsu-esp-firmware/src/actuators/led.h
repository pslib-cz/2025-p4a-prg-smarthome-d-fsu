#pragma once

#include <stdint.h>

// WS2812 COB strip driver. Minimal for Phase 4: master on/off + solid RGB,
// with case-switch-driven "solid on open" behavior. Flash/breathe animations
// are deferred — they need a periodic tick and that belongs in the FSM loop.

namespace dfsu::led {

bool begin();

// Push whatever is in config() to the strip. Call on boot and whenever the
// BLE ff04 write lands.
void applyConfig();

// Case-state hook. Re-evaluates behavior modes that depend on whether the box
// is open (ledBehavior = 1 solid_on_open, 2 breathe_on_open).
void onCaseChange(bool open);

// All LEDs off, regardless of config. Used right before deep sleep.
void off();

}  // namespace dfsu::led
