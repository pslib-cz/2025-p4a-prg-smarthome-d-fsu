#pragma once

// Home Assistant MQTT auto-discovery. Publishes retained config topics under
// `homeassistant/<component>/dfsu_<clientId>/<object>/config` so HA creates the
// sensors on its own — no YAML edits required on the HA side.
//
// Call once after mqtt::begin() succeeds. Retained, so it's cheap to re-publish
// on every connect (HA dedupes by topic).

namespace dfsu::net::ha_discovery {

// clientId must match the one used by mqtt::begin() — state_topics are built
// against `dfsu/<clientId>/telemetry` and `dfsu/<clientId>/impact`.
bool publishAll(const char* clientId);

}  // namespace dfsu::net::ha_discovery
