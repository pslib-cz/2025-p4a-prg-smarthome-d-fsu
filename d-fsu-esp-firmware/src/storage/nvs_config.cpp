#include "nvs_config.h"

#include <Preferences.h>

#include "../util/log.h"

namespace dfsu::nvs {

namespace {
constexpr const char* kNs = "dfsu_cfg";
}

bool load(RuntimeConfig& cfg) {
    Preferences p;
    if (!p.begin(kNs, /*readOnly=*/true)) {
        DFSU_WARN("nvs", "no config namespace yet; using defaults");
        return false;
    }
    cfg.packCapacityMah  = p.getUInt("cap_mah",    cfg.packCapacityMah);
    cfg.impactThresholdG = p.getFloat("imp_g",     cfg.impactThresholdG);
    cfg.lowBatteryPct    = p.getUChar("low_pct",   cfg.lowBatteryPct);
    cfg.haEnabled        = p.getBool("ha_on",      cfg.haEnabled);
    cfg.heartbeatSec     = p.getUInt("hb_sec",     cfg.heartbeatSec);
    cfg.ledOn            = p.getBool("led_on",     cfg.ledOn);
    cfg.ledR             = p.getUChar("led_r",     cfg.ledR);
    cfg.ledG             = p.getUChar("led_g",     cfg.ledG);
    cfg.ledB             = p.getUChar("led_b",     cfg.ledB);
    cfg.ledBehavior      = p.getUChar("led_beh",   cfg.ledBehavior);
    cfg.oledBitmask      = p.getUShort("oled_bm",  cfg.oledBitmask);
    p.end();
    DFSU_LOG("nvs", "config loaded (cap=%u mAh, ha=%d)",
             cfg.packCapacityMah, cfg.haEnabled ? 1 : 0);
    return true;
}

bool save(const RuntimeConfig& cfg) {
    Preferences p;
    if (!p.begin(kNs, /*readOnly=*/false)) {
        DFSU_ERR("nvs", "open for write failed");
        return false;
    }
    p.putUInt("cap_mah",   cfg.packCapacityMah);
    p.putFloat("imp_g",    cfg.impactThresholdG);
    p.putUChar("low_pct",  cfg.lowBatteryPct);
    p.putBool("ha_on",     cfg.haEnabled);
    p.putUInt("hb_sec",    cfg.heartbeatSec);
    p.putBool("led_on",    cfg.ledOn);
    p.putUChar("led_r",    cfg.ledR);
    p.putUChar("led_g",    cfg.ledG);
    p.putUChar("led_b",    cfg.ledB);
    p.putUChar("led_beh",  cfg.ledBehavior);
    p.putUShort("oled_bm", cfg.oledBitmask);
    p.end();
    return true;
}

}  // namespace dfsu::nvs
