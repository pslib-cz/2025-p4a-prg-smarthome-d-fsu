#pragma once

#include "../app/config.h"

// Persistence layer for RuntimeConfig. Backed by the Preferences library
// (NVS under the hood). Call load() once at boot; save() when config changes.

namespace dfsu::nvs {

bool load(RuntimeConfig& cfg);
bool save(const RuntimeConfig& cfg);

}  // namespace dfsu::nvs
