# D-FSU TLS certificates

Self-signed CA + broker cert for the D-FSU Mosquitto instance. The firmware
pins the CA (see `d-fsu-esp-firmware/src/net/ca_cert.h`) — it verifies the
broker's chain against this one cert and refuses to connect otherwise.

## Files

- `dfsu-ca.key` — CA private key. **Never leaves the host that generates certs.**
- `dfsu-ca.crt` — CA public cert. Embedded in firmware + copied to the broker.
- `broker.key` / `broker.crt` — broker server cert, signed by the CA.

Nothing here should be committed to git outside of a private mirror. The repo
ships `dfsu-ca.crt` (public) only so CI can verify the firmware embeds the
right CA fingerprint; all `.key` files stay local.

## Regenerate (one-shot)

```bash
cd ha-config/certs
./gen-certs.sh                 # creates CA + broker cert valid 10 years
```

After regeneration:

1. Copy `dfsu-ca.crt` + `broker.crt` + `broker.key` to the Mosquitto host at
   `/share/mosquitto/certs/` (HA addon) or `/etc/mosquitto/certs/` (bare).
2. Paste the contents of `dfsu-ca.crt` between the `R"CERT(` delimiters in
   `d-fsu-esp-firmware/src/net/ca_cert.h`.
3. Rebuild + flash firmware; restart Mosquitto.

## Verifying the broker cert matches the firmware CA

```bash
openssl s_client -connect <ha-lan-ip>:8883 -CAfile dfsu-ca.crt -showcerts < /dev/null
```

Should return `Verify return code: 0 (ok)`. A mismatch here is exactly what the
firmware sees — fix it broker-side before expecting the ESP32 to connect.
