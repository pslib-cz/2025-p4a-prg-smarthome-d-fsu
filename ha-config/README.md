# D-FSU Home Assistant Configuration

Mirror of the HA-side config that supports the D-FSU device integration. Deploys into a real HA instance by copying these files into HA's `/config/`.

## Layout

```
ha-config/
├── lovelace/        # Custom dashboard YAML (D-FSU panel + fallback view)
├── automations/     # Automation YAML per scene (see contracts/mqtt-schema.md for topics)
├── mosquitto/       # Mosquitto broker config + ACL (TLS on 8883)
├── certs/           # Self-signed CA + server cert/key (gitignored in production)
└── configuration-snippets/  # Pieces to paste into HA's configuration.yaml
```

## Deployment

Manual until we script it. On the HA host:
1. Copy `mosquitto/` into the Mosquitto add-on config dir, restart add-on.
2. Copy `certs/dfsu-ca.crt` alongside — fingerprint must match the one pinned in firmware (`net/mqtt.cpp`).
3. Paste `configuration-snippets/*.yaml` content into `configuration.yaml` (MQTT, http, panel_iframe).
4. Copy `automations/*.yaml` into HA automations.
5. Copy `lovelace/dfsu.yaml` to HA dashboards.
6. Serve the React box build from `/config/www/dfsu/` — see `../dashboard-deploy/README.md` (Phase 6).

## References

- Topic tree + payload schemas: `../../contracts/mqtt-schema.md`
- Firmware side: `../../firmware-architecture.md`
- Scenes defined: `firmware-architecture.md` §Scenes / automations
