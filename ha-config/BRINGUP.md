# D-FSU HA + Mosquitto bring-up (Docker on laptop)

One-time setup for the local development stack. Takes ~15 minutes.

## 0. Prereqs

- Docker Desktop installed and running.
- A bash-compatible shell for the cert script (Git Bash on Windows works).
- Your laptop's LAN IP. On Windows: `ipconfig | findstr IPv4`. Write it down —
  we'll need it for both the cert SAN and the firmware NVS.

## 1. Generate TLS certs

The firmware refuses to connect without pinning a real CA, so this is step one.

```bash
cd ha-config/certs
BROKER_CN=localhost BROKER_IP=<your-laptop-ip> ./gen-certs.sh
```

The script prints `dfsu-ca.crt` at the end. Copy that PEM (including the
`-----BEGIN/END CERTIFICATE-----` lines) into
`d-fsu-esp-firmware/src/net/ca_cert.h` between the `R"CERT(...)CERT"`
delimiters.

## 2. Create the Mosquitto passwords file

Pick a device id — I'll use `a1b2` as a placeholder; you'll replace it with
the real MAC suffix once the firmware boots and logs its client id.

```bash
cd ha-config
mkdir -p mosquitto-data
docker run --rm -v "$PWD/mosquitto-data:/mosquitto/config" \
    eclipse-mosquitto:2 \
    mosquitto_passwd -c -b /mosquitto/config/passwords dfsu_a1b2 <pick-a-secret>

# Repeat (without -c this time) to add HA's own user:
docker run --rm -v "$PWD/mosquitto-data:/mosquitto/config" \
    eclipse-mosquitto:2 \
    mosquitto_passwd -b /mosquitto/config/passwords homeassistant <pick-a-secret>
```

## 3. Bring up the stack

From `ha-config/`:

```bash
docker compose up -d
docker compose logs -f         # watch until both containers settle
```

HA UI: <http://localhost:8123>. First boot takes a minute; follow the
onboarding to create your admin user. Skip location/weather setup if asked.

## 4. Point HA at Mosquitto

In the HA web UI: **Settings → Devices & Services → Add Integration → MQTT**.

- Broker: `mosquitto`  (container-network name — HA and Mosquitto share the
  compose network, so they resolve each other by service name)
- Port: `8883`
- Username / password: the `homeassistant` creds from step 2
- Enable: Use a client certificate — No
- Advanced: Broker certificate validation — **Custom**, upload
  `ha-config/certs/dfsu-ca.crt`

Save. HA should report "connected" within seconds.

## 5. Provision firmware creds

Before flashing, set NVS keys so `loadCreds()` finds WiFi + MQTT info. The
simplest path is a one-shot provisioning sketch — or burn them via a serial
Preferences shim. Concretely, the firmware expects the NVS namespace
`dfsu_net` with these keys (see `src/net/creds.cpp`):

- `ssid`  — your WiFi SSID
- `psk`   — your WiFi password
- `host`  — your laptop's LAN IP (the one you put in the cert SAN)
- `port`  — `8883`
- `user`  — `dfsu_a1b2` (or whatever id you chose)
- `pass`  — the matching secret from step 2

And flip `haEnabled` to true in the `dfsu_cfg` namespace (NVS key `ha_on`).

> **TODO** — we still need a BLE command on characteristic ff06 (or a dedicated
> provisioning characteristic) to write these over the air. For now, either:
> (a) hardcode them temporarily in `setup()` via `Preferences p; p.begin("dfsu_net", false); p.putString(...)` and flash once, then remove the code; or
> (b) write a one-shot `provision.ino` sketch that burns them and reboots.

## 6. Verify end-to-end

Flash firmware. Watch the serial monitor for:

```
[mqtt] connected host=192.168.x.y:8883
[ha]   discovery published (9 sensors + 2 binary)
```

Then check HA: **Settings → Devices & Services → MQTT → Devices**. You
should see a "D-FSU a1b2" device card with 9 sensors and 2 binary sensors.

## Common failures

| Symptom | Fix |
|---|---|
| `[mqtt] CA cert empty — refusing to connect` | Step 1 wasn't copied into `ca_cert.h`, or the `R"CERT(...)CERT"` delimiters got broken. |
| `[mqtt] connect failed state=-2` | Broker unreachable. Check laptop IP, firewall on port 8883, `docker compose ps`. |
| `state=5` | Auth failure. Username/password in NVS doesn't match `mosquitto_passwd` entry. |
| TLS handshake fails only on ESP32 | The cert SAN doesn't cover whatever hostname/IP is in NVS. Regenerate certs with the right `BROKER_IP`. |
| HA connects but no sensors appear | Discovery topics went out before HA subscribed. Power-cycle the box once HA is up, or manually restart the MQTT integration. |
