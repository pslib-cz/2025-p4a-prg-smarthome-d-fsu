#include "fsm.h"

#include "../util/log.h"

namespace dfsu {

const char* modeName(Mode m) {
    switch (m) {
        case Mode::Boot:   return "boot";
        case Mode::Active: return "active";
        case Mode::Sleep:  return "sleep";
        case Mode::LogSb:  return "log_sb";
        case Mode::Report: return "report";
    }
    return "?";
}

void Fsm::setMode(Mode m) {
    if (m == mode_) return;
    DFSU_LOG("fsm", "%s -> %s", modeName(mode_), modeName(m));
    mode_ = m;
}

void Fsm::tick() {
    lastTickMs_ = millis();
    // Phase 1A: no transition logic yet; the box starts in Active and stays there.
}

Fsm& fsm() {
    static Fsm instance;
    return instance;
}

}  // namespace dfsu
