# Mosquitto configuration

TLS-only MQTT broker config for D-FSU. See `mosquitto.conf` and `acl` — both
are annotated.

## Provisioning a new device

1. Pick a device id (lowercase MAC suffix, e.g. `a1b2`). This is the same id
   the firmware logs as its MQTT client id (`dfsu-A1B2` → lowercase `a1b2`).
2. Append a user + password via `mosquitto_passwd` on the broker host:
   ```
   mosquitto_passwd -b /share/mosquitto/passwords dfsu_a1b2 <secret>
   ```
3. Duplicate the `dfsu_a1b2` block in `acl`, substituting the new id.
4. Restart the Mosquitto add-on / service.
5. Provision the firmware: write the matching `mqttUser` / `mqttPass` into
   NVS (see `d-fsu-esp-firmware/src/net/creds.{h,cpp}`). Host + port go there
   too — point the firmware at your HA's LAN IP on 8883.

## TLS material

See `../certs/README.md` for regenerating the self-signed CA + broker cert.
The CA must match the PEM pinned in `d-fsu-esp-firmware/src/net/ca_cert.h` —
if the fingerprints diverge, the firmware fails closed and silently refuses
to connect.
