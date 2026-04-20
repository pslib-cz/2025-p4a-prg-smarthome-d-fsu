#include <Arduino.h>

#include "actuators/led.h"
#include "actuators/oled.h"
#include "app/config.h"
#include "app/event_bus.h"
#include "app/fsm.h"
#include "app/types.h"
#include "ble/gatt_server.h"
#include "net/ca_cert.h"
#include "net/creds.h"
#include "net/ha_discovery.h"
#include "net/mqtt.h"
#include "net/wifi.h"

// Optional one-shot provisioning header — seeds NVS on first boot if present.
// Copy provision_local.h.example → provision_local.h locally and fill in real
// values; the file is gitignored. Without it, the firmware still boots but
// MQTT stays disabled until NVS is provisioned by other means.
#if __has_include("net/provision_local.h")
#include "net/provision_local.h"
#define DFSU_HAS_PROVISION 1
#else
#define DFSU_HAS_PROVISION 0
#endif
#include "power/fuel_gauge.h"
#include "power/sleep.h"
#include "sensors/bme280.h"
#include "sensors/case_switch.h"
#include "sensors/i2c_buses.h"
#include "sensors/ina219.h"
#include "sensors/mpu6050.h"
#include "sensors/pins.h"
#include "storage/impact_log.h"
#include "storage/nvs_config.h"
#include "util/log.h"

// Boot dispatcher:
//   PowerOn / CaseOpened  → full init → ACTIVE
//   Impact (MPU)          → LOG_SB short path: read peak-G, append to ring, sleep
//   Timer (REPORT)        → periodic heartbeat wake; cadence = config().heartbeatSec
//
// ACTIVE → SLEEP transition fires after kIdleMs with case closed AND no BLE
// central connected. Any activity (case change, impact, new connection) resets
// the idle timer.

using namespace dfsu;

namespace {

constexpr uint32_t kTelemetryPeriodMs = 1000;
constexpr uint32_t kImuPeriodMs       = 20;    // 50 Hz in ACTIVE — catches sharp peaks
constexpr uint32_t kIdleSleepMs       = 60000; // 1 min of idleness → sleep
// Motion-wake threshold. MUST be comfortably above 1 g or gravity + noise
// re-latches the MPU INT pin between clear and deep-sleep entry, causing an
// immediate wake loop. The MPU6050 motion register clamps at 0.51 g @ ±8 g, so
// raising this value past 0.51 g just pins to the max — effective filtering
// comes from the duration gate below.
constexpr float    kMotionThresholdG  = 2.0f;
constexpr uint16_t kMotionDurationMs  = 20;    // must persist this long to wake

volatile uint32_t g_lastActivityMs = 0;

void noteActivity() { g_lastActivityMs = millis(); }

// Stable per-device MQTT client id: "dfsu-XXYYZZ" from the last 3 MAC bytes.
// Populated once in setup(); outlives mqtt's config copy.
char g_clientId[16] = {0};
net::Creds g_creds{};

void makeClientId() {
    uint64_t mac = ESP.getEfuseMac();
    snprintf(g_clientId, sizeof(g_clientId), "dfsu-%02X%02X%02X",
             (unsigned)((mac >> 16) & 0xFF),
             (unsigned)((mac >>  8) & 0xFF),
             (unsigned)( mac        & 0xFF));
}

// If provision_local.h is present and NVS hasn't been populated yet, seed
// creds + haEnabled from those constants. Idempotent — on subsequent boots
// hasWifi()/hasMqtt() return true and we skip the write entirely, so the
// header can stay untouched in the source tree.
void provisionIfNeeded() {
    // One-shot migration: the old impact threshold (3.0g) was too tight — the
    // peakG formula includes 1g of gravity, so a moderate hit never crossed
    // it. Lower any persisted value >= 2.5g to the new default. Safe to leave
    // in; runs only until the stored value is the new default.
    if (config().impactThresholdG >= 2.5f) {
        DFSU_LOG("prov", "migrating impactThresholdG %.2f → 1.5",
                 config().impactThresholdG);
        config().impactThresholdG = 1.5f;
        nvs::save(config());
    }

#if DFSU_HAS_PROVISION
    if (g_creds.hasWifi() && g_creds.hasMqtt()) return;

    DFSU_LOG("prov", "seeding NVS from provision_local.h (one-shot)");
    net::Creds c{};
    strncpy(c.wifiSsid, provision::kWifiSsid, sizeof(c.wifiSsid) - 1);
    strncpy(c.wifiPsk,  provision::kWifiPsk,  sizeof(c.wifiPsk)  - 1);
    strncpy(c.mqttHost, provision::kMqttHost, sizeof(c.mqttHost) - 1);
    c.mqttPort = provision::kMqttPort;
    strncpy(c.mqttUser, provision::kMqttUser, sizeof(c.mqttUser) - 1);
    strncpy(c.mqttPass, provision::kMqttPass, sizeof(c.mqttPass) - 1);
    net::saveCreds(c);
    g_creds = c;

    if (provision::kEnableHaOnFirstBoot && !config().haEnabled) {
        config().haEnabled = true;
        nvs::save(config());
    }
#endif
}

// Bring up WiFi + MQTT + HA discovery, then drain any impacts the ring has
// queued up from previous boots. Safe to call repeatedly; each stage early-
// exits if already up. Returns true if MQTT ends up connected.
bool bringUpNetwork() {
    if (!config().haEnabled)   return false;
    if (!g_creds.hasWifi())    return false;
    if (!g_creds.hasMqtt())    return false;

    if (!net::wifi::isConnected()) {
        if (!net::wifi::begin(g_creds.wifiSsid, g_creds.wifiPsk)) return false;
    }
    // TLS handshake fails closed against the cert's notBefore date unless the
    // clock is post-2024. First call on a fresh boot actually hits NTP; later
    // calls short-circuit immediately.
    net::wifi::syncTime();

    net::mqtt::Config mc{
        .host       = g_creds.mqttHost,
        .port       = g_creds.mqttPort,
        .username   = g_creds.mqttUser,
        .password   = g_creds.mqttPass,
        .clientId   = g_clientId,
        .caCertPem  = net::kCaCertPem,
    };
    if (!net::mqtt::begin(mc)) return false;

    net::ha_discovery::publishAll(g_clientId);

    // Drain ring — publishImpact advances mqttAckedId on each success.
    // readPending filters by bleAckedId, so we additionally skip records the
    // mqtt cursor already covers (HA dedupes by eventId anyway, but avoiding
    // duplicate sends keeps the topic quiet).
    impact_log::Record buf[8];
    uint16_t n = 0;
    const uint32_t mqttAck = impact_log::mqttAckedId();
    if (impact_log::readPending(buf, 8, n)) {
        for (uint16_t i = 0; i < n; ++i) {
            if (buf[i].eventId <= mqttAck) continue;
            // Skip junk from the MPU-6500 break window — ack so compact drops
            // them, but don't pollute the MQTT stream with 0g "impacts".
            if (buf[i].peakG < config().impactThresholdG) {
                impact_log::ackMqtt(buf[i].eventId);
                continue;
            }
            if (!net::mqtt::publishImpact(buf[i])) break;
        }
    }
    return true;
}

void sensorProducerTask(void*) {
    uint32_t nextTelemetry = 0;
    uint32_t nextImu = 0;

    while (true) {
        uint32_t now = millis();

        if (now >= nextTelemetry) {
            nextTelemetry = now + kTelemetryPeriodMs;

            bme::Reading b{};
            ina::Reading i{};
            bme::read(b);
            ina::read(i);

            // Coulomb counter integrates every INA sample.
            power::gauge::integrate(i.currentMa, i.busVoltageV,
                                    caseswitch::isOpen(), now);

            TelemetrySnapshot s{};
            s.timestampMs   = now;
            s.temperatureC  = b.temperatureC;
            s.humidityPct   = b.humidityPct;
            s.pressureHpa   = b.pressureHpa;
            s.batteryMv     = (uint16_t)(i.busVoltageV * 1000.0f);
            s.batteryMa     = (int16_t)i.currentMa;
            s.batteryPct    = power::gauge::batteryPct(config().packCapacityMah);
            s.caseOpen      = caseswitch::isOpen();

            bus().postTelemetry(s);
        }

        if (now >= nextImu) {
            nextImu = now + kImuPeriodMs;

            mpu::Reading m{};
            if (mpu::read(m) && m.peakG > config().impactThresholdG) {
                ImpactEvent ev{};
                ev.timestampMs = now;
                ev.gX = m.gX; ev.gY = m.gY; ev.gZ = m.gZ;
                ev.peakG = m.peakG;
                bus().postImpact(ev);
                noteActivity();
            }
        }

        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

void debugConsumerTask(void*) {
    Event e{};
    while (true) {
        if (!bus().receive(e, pdMS_TO_TICKS(500))) continue;
        switch (e.kind) {
            case EventKind::Telemetry: {
                const auto& t = e.telemetry;
                DFSU_LOG("tele", "T=%.2fC RH=%.1f%% P=%.1fhPa V=%.2fV I=%dmA %u%% case=%s",
                         t.temperatureC, t.humidityPct, t.pressureHpa,
                         t.batteryMv / 1000.0f, (int)t.batteryMa,
                         (unsigned)t.batteryPct, t.caseOpen ? "open" : "closed");
                oled::render(t);
                ble::publishTelemetry(t);
                ble::publishBattExt(power::gauge::consumptionMah(),
                                    power::gauge::runtimeOpenMin(),
                                    power::gauge::runtimeClosedMin());
                net::mqtt::publishTelemetry(t);
                break;
            }
            case EventKind::Impact: {
                auto i = e.impact;
                i.eventId = impact_log::append(i);
                DFSU_LOG("imp",  "id=%u peak=%.2fg (x=%.2f y=%.2f z=%.2f) pending=%u",
                         (unsigned)i.eventId, i.peakG, i.gX, i.gY, i.gZ,
                         (unsigned)impact_log::pendingCount());
                ble::publishImpact(i, i.timestampMs / 1000);
                // Publish the event we just appended — NOT the oldest in the
                // ring. Build the Record directly from the ImpactEvent + the
                // eventId returned by append(). readPending() returns the tail
                // (oldest unacked), which would republish stale records every
                // time a new impact happens.
                impact_log::Record r{};
                r.eventId     = i.eventId;
                r.timestampMs = i.timestampMs;
                r.gX = i.gX; r.gY = i.gY; r.gZ = i.gZ;
                r.peakG = i.peakG;
                net::mqtt::publishImpact(r);
                break;
            }
            case EventKind::CaseChange: {
                const auto& c = e.caseChange;
                DFSU_LOG("case", "event: %s", c.open ? "OPEN" : "CLOSED");
                led::onCaseChange(c.open);
                noteActivity();
                break;
            }
        }
    }
}

// Watches ACTIVE idle: if case closed, no BLE peer, and no new events for
// kIdleSleepMs, arm wake sources and enter deep sleep.
void sleepWatchdogTask(void*) {
    noteActivity();
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
        if (ble::isConnected())    { noteActivity(); continue; }
        if (caseswitch::isOpen())  { noteActivity(); continue; }
        if (millis() - g_lastActivityMs < kIdleSleepMs) continue;

        DFSU_LOG("sleep", "idle %u ms — entering SLEEP",
                 (unsigned)(millis() - g_lastActivityMs));
        fsm().setMode(Mode::Sleep);
        // Give serial a moment to flush.
        delay(50);
        led::off();
        oled::off();

        const bool mpuUp = mpu::isReady();
        if (mpuUp) {
            mpu::configureMotionInterrupt(kMotionThresholdG, kMotionDurationMs);

            // Guard against the "INT pin still low at sleep entry → instant
            // wake" loop. If the MPU is still asserting motion, re-clear a
            // few times before deferring sleep by one idle cycle.
            pinMode(pins::kMpuInt, INPUT_PULLUP);
            int tries = 0;
            while (digitalRead(pins::kMpuInt) == LOW && tries++ < 5) {
                mpu::readAndClearMotion();
                delay(10);
            }
            if (digitalRead(pins::kMpuInt) == LOW) {
                DFSU_WARN("sleep", "MPU INT still low after %d clears — deferring sleep", tries);
                oled::on();         // bring the display back so we don't look bricked
                noteActivity();     // restart the idle timer
                fsm().setMode(Mode::Active);
                continue;
            }
        } else {
            DFSU_WARN("sleep", "MPU not on bus — sleeping with case switch only");
        }

        power::armWakeSources(config().heartbeatSec, /*includeMpuInt=*/mpuUp);
        power::enterDeepSleep();
    }
}

void printBootBanner(power::WakeCause cause) {
    printf("\n===== D-FSU boot =====\n");
    printf("fw:       %s\n", DFSU_FW_VERSION);
    printf("chip:     %s rev %d\n", ESP.getChipModel(), ESP.getChipRevision());
    printf("cpu:      %d MHz\n", ESP.getCpuFreqMHz());
    printf("wake:     %d (cause=%d)\n",
           (int)esp_sleep_get_wakeup_cause(), (int)cause);
    printf("boots:    %u (logsb=%u)\n",
           power::bootCount(), power::logSbCount());
    printf("======================\n");
}

// LOG_SB short path — no BLE, no OLED, no full FSM. Read peak-G from the
// latched MPU sample, append to the ring, go back to sleep.
[[noreturn]] void runLogSbPath() {
    DFSU_LOG("logsb", "impact wake path");
    power::noteLogSbWake();

    i2c::initBuses();
    mpu::begin();
    ina::begin();

    // Clear the latched motion flag so the pin releases.
    bool motion = mpu::readAndClearMotion();
    mpu::Reading m{};
    mpu::read(m);

    ImpactEvent ev{};
    ev.timestampMs = millis();
    ev.gX = m.gX; ev.gY = m.gY; ev.gZ = m.gZ;
    ev.peakG = m.peakG;

    impact_log::begin();
    uint32_t id = 0;
    if (ev.peakG > config().impactThresholdG) {
        id = impact_log::append(ev);
        DFSU_LOG("logsb", "motion=%d peak=%.2fg id=%u pending=%u",
                 motion ? 1 : 0, ev.peakG, (unsigned)id,
                 (unsigned)impact_log::pendingCount());
    } else {
        // MPU hiccup or spurious wake — don't pollute the log with 0g events.
        DFSU_WARN("logsb", "spurious wake (peak=%.2fg < threshold %.2fg) — skipping append",
                  ev.peakG, config().impactThresholdG);
    }

    // One-shot INA read for the fuel-gauge LOG_SB debit.
    ina::Reading r{};
    ina::read(r);
    power::gauge::begin(config().packCapacityMah, r.busVoltageV);
    power::gauge::debitLogSbWake();

    const bool mpuUp = mpu::isReady();
    if (mpuUp) {
        mpu::configureMotionInterrupt(kMotionThresholdG, kMotionDurationMs);

        // Same INT-low guard as the watchdog path. On LOG_SB we can't defer —
        // we're out of the active loop — so just keep clearing until the pin
        // releases or we time out, then sleep either way.
        pinMode(pins::kMpuInt, INPUT_PULLUP);
        for (int i = 0; i < 20 && digitalRead(pins::kMpuInt) == LOW; ++i) {
            mpu::readAndClearMotion();
            delay(10);
        }
    }

    power::armWakeSources(config().heartbeatSec, /*includeMpuInt=*/mpuUp);
    power::enterDeepSleep();
}

}  // namespace

void setup() {
    Serial.begin(115200);
    // Short (not zero) USB-CDC TX timeout. Zero drops everything the instant
    // the host buffer has any backpressure (we lose the boot banner etc.).
    // Infinite (the default) deadlocks if no terminal is attached. 100 ms is
    // long enough for a connected terminal to drain, short enough that a
    // disconnected host can't hang the firmware for noticeable time.
    Serial.setTxTimeoutMs(100);
    delay(100);

    power::WakeCause cause = power::wakeCause();
    printBootBanner(cause);

    nvs::load(config());

    if (cause == power::WakeCause::Impact) {
        // Short path — never returns.
        runLogSbPath();
    }

    // Full boot path: PowerOn, CaseOpened, Timer, or Unknown.
    if (!bus().begin())    DFSU_ERR("boot", "event bus init failed");
    if (!i2c::initBuses()) DFSU_ERR("boot", "i2c init failed");

    bme::begin();
    mpu::begin();
    ina::begin();
    caseswitch::begin();
    led::begin();
    oled::begin();
    impact_log::begin();

    // Seed the fuel gauge from whatever voltage we measure right now.
    ina::Reading r{};
    ina::read(r);
    power::gauge::begin(config().packCapacityMah, r.busVoltageV);

    // If we woke from deep sleep, debit the estimated sleep drain.
    if (cause != power::WakeCause::PowerOn) {
        power::gauge::debitSleep(power::state().lastSleepDurationS);
    }

    ble::begin();

    // Network stack — off by default; enabled once user provisions creds and
    // flips haEnabled via BLE config or NVS. bringUpNetwork() is a no-op when
    // either is missing.
    makeClientId();
    net::loadCreds(g_creds);
    provisionIfNeeded();
    bringUpNetwork();

    fsm().setMode(Mode::Active);

    xTaskCreatePinnedToCore(sensorProducerTask,  "sens_prod", 4096, nullptr, 3, nullptr, 0);
    xTaskCreatePinnedToCore(debugConsumerTask,   "dbg_cons",  4096, nullptr, 2, nullptr, 1);
    xTaskCreatePinnedToCore(sleepWatchdogTask,   "sleep_wd",  2048, nullptr, 1, nullptr, 1);
}

void loop() {
    fsm().tick();

    // MQTT keep-alive + incoming callbacks. Reconnect lazily every ~10 s when
    // haEnabled but the link is down (WiFi dropout, broker restart, etc.).
    net::mqtt::loop();
    static uint32_t lastReconnect = 0;
    if (config().haEnabled && !net::mqtt::isConnected() &&
        millis() - lastReconnect > 10000) {
        lastReconnect = millis();
        bringUpNetwork();
    }

    delay(100);
}
