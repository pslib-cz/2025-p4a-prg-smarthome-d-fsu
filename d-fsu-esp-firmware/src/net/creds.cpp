#include "creds.h"

#include <Preferences.h>
#include <string.h>

#include "../util/log.h"

namespace dfsu::net {

namespace {
constexpr const char* kNs = "dfsu_net";

void copyStr(char* dst, size_t dstLen, const String& src) {
    size_t n = src.length();
    if (n >= dstLen) n = dstLen - 1;
    memcpy(dst, src.c_str(), n);
    dst[n] = '\0';
}
}  // namespace

bool loadCreds(Creds& out) {
    memset(&out, 0, sizeof(out));
    out.mqttPort = 8883;

    Preferences p;
    if (!p.begin(kNs, /*readOnly=*/true)) {
        DFSU_WARN("net", "no creds namespace yet — WiFi/MQTT disabled until provisioned");
        return false;
    }
    copyStr(out.wifiSsid, sizeof(out.wifiSsid), p.getString("ssid", ""));
    copyStr(out.wifiPsk,  sizeof(out.wifiPsk),  p.getString("psk",  ""));
    copyStr(out.mqttHost, sizeof(out.mqttHost), p.getString("host", ""));
    out.mqttPort = p.getUShort("port", 8883);
    copyStr(out.mqttUser, sizeof(out.mqttUser), p.getString("user", ""));
    copyStr(out.mqttPass, sizeof(out.mqttPass), p.getString("pass", ""));
    p.end();

    DFSU_LOG("net", "creds loaded: ssid=%s host=%s:%u",
             out.wifiSsid[0] ? out.wifiSsid : "<none>",
             out.mqttHost[0] ? out.mqttHost : "<none>",
             out.mqttPort);
    return true;
}

bool saveCreds(const Creds& c) {
    Preferences p;
    if (!p.begin(kNs, /*readOnly=*/false)) {
        DFSU_ERR("net", "creds nvs open failed");
        return false;
    }
    p.putString("ssid", c.wifiSsid);
    p.putString("psk",  c.wifiPsk);
    p.putString("host", c.mqttHost);
    p.putUShort("port", c.mqttPort);
    p.putString("user", c.mqttUser);
    p.putString("pass", c.mqttPass);
    p.end();
    return true;
}

}  // namespace dfsu::net
