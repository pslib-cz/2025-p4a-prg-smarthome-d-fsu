#pragma once

#include "../app/types.h"

namespace dfsu::oled {

bool begin();                                 // init, show boot splash
void showBootSplash();
void render(const TelemetrySnapshot& t);      // update visible fields
void off();                                   // DISPLAYOFF — used in Sleep mode (Phase 3)
void on();

}  // namespace dfsu::oled
