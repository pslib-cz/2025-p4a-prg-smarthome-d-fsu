#include "led.h"

#define FASTLED_INTERNAL  // silence pragma-message spam
#include <FastLED.h>

#include "../app/config.h"
#include "../sensors/case_switch.h"
#include "../sensors/pins.h"
#include "../util/log.h"

namespace dfsu::led {

namespace {

// COB strip length. Ballpark for a transport-box interior accent — bump if the
// user fits a longer strip. FastLED allocates the CRGB array at compile time.
constexpr uint16_t kNumPixels = 16;

CRGB s_pixels[kNumPixels];
bool s_began = false;

void fill(uint8_t r, uint8_t g, uint8_t b) {
    for (auto& p : s_pixels) p.setRGB(r, g, b);
    FastLED.show();
}

}  // namespace

bool begin() {
    if (s_began) return true;
    FastLED.addLeds<WS2812, pins::kLedData, GRB>(s_pixels, kNumPixels);
    FastLED.setBrightness(160);  // ~62%, gives head-room for the 3 A budget
    fill(0, 0, 0);
    s_began = true;
    applyConfig();
    return true;
}

void applyConfig() {
    if (!s_began) return;
    const auto& cfg = config();
    if (!cfg.ledOn) { fill(0, 0, 0); return; }

    // Behavior-driven gating. Flash-on-impact is handled by the impact path
    // calling us with a transient color; here we only handle the steady states.
    switch (cfg.ledBehavior) {
        case 1:  // solid_on_open
        case 2:  // breathe_on_open — solid until we add the tick loop
            if (caseswitch::isOpen()) fill(cfg.ledR, cfg.ledG, cfg.ledB);
            else                      fill(0, 0, 0);
            break;
        case 3:  // flash_on_impact — idle dark, impact path flashes
            fill(0, 0, 0);
            break;
        case 0:  // always on (master enable only)
        default:
            fill(cfg.ledR, cfg.ledG, cfg.ledB);
            break;
    }
}

void onCaseChange(bool /*open*/) { applyConfig(); }

void off() { if (s_began) fill(0, 0, 0); }

}  // namespace dfsu::led
