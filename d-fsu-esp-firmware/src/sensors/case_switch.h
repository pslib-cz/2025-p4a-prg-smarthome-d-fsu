#pragma once

#include <stdint.h>

namespace dfsu::caseswitch {

// Initializes the switch pin with pull-up + change interrupt. Posts CaseEvent
// to the event bus on debounced edges.
bool begin();

// Returns the current debounced state (true = case open).
bool isOpen();

}  // namespace dfsu::caseswitch
