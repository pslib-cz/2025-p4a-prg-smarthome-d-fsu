#include "oled.h"

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include "../app/config.h"
#include "../sensors/i2c_buses.h"
#include "../util/log.h"

namespace dfsu::oled {

namespace {

// Panel is physically 128x64 landscape; we rotate 90° CW so the logical
// canvas becomes 64 wide × 128 tall (portrait).
constexpr uint8_t kPanelW = 128;
constexpr uint8_t kPanelH = 64;
constexpr uint8_t kAddr   = 0x3C;

constexpr uint8_t kW = 64;
constexpr uint8_t kH = 128;

Adafruit_SSD1306 display(kPanelW, kPanelH, &i2c::uxBus(), /*rst=*/-1);
bool ready = false;

// How many telemetry ticks each hero page stays visible before advancing.
// render() is called ~1 Hz, so 2 = ~2 s per page.
constexpr uint8_t kTicksPerPage = 2;

uint8_t tickCount = 0;
uint8_t pageCursor = 0;

// Each page maps to one bit in RuntimeConfig::oledBitmask. Keep the numbers
// aligned with contracts/gatt-profile.md #ff05 (bit 10 = pressure is a
// firmware-local extension).
enum class Page : uint8_t {
    Temperature = 0,
    Humidity    = 1,
    BatteryPct  = 2,
    Voltage     = 3,
    Current     = 4,
    Case        = 6,
    Pressure    = 10,
};

// Fixed display order for the cycle.
const Page kAllPages[] = {
    Page::Temperature,
    Page::Humidity,
    Page::Pressure,
    Page::BatteryPct,
    Page::Voltage,
    Page::Current,
    Page::Case,
};
constexpr uint8_t kAllPagesCount = sizeof(kAllPages) / sizeof(kAllPages[0]);

// Labels — Czech, stripped of diacritics because the Adafruit GFX default
// font covers CP437 (which lacks č/š/ř/ě/ž/á/í/é).
const char* pageLabel(Page p) {
    switch (p) {
        case Page::Temperature: return "TEPLOTA";
        case Page::Humidity:    return "VLHKOST";
        case Page::Pressure:    return "TLAK";
        case Page::BatteryPct:  return "BATERIE";
        case Page::Voltage:     return "NAPETI";
        case Page::Current:     return "PROUD";
        case Page::Case:        return "POUZDRO";
    }
    return "";
}

void printCenteredX(const char* s, int16_t y, uint8_t size) {
    display.setTextSize(size);
    int16_t x1, y1; uint16_t w, h;
    display.getTextBounds(s, 0, y, &x1, &y1, &w, &h);
    int16_t x = (kW - (int16_t)w) / 2;
    if (x < 0) x = 0;
    display.setCursor(x, y);
    display.print(s);
}

void drawHeader() {
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(2, 2);
    display.print(F("D-FSU"));
    const char* v = "v" DFSU_FW_VERSION;
    int16_t x1, y1; uint16_t w, h;
    display.getTextBounds(v, 0, 0, &x1, &y1, &w, &h);
    display.setCursor(kW - (int16_t)w - 2, 2);
    display.print(v);
    display.drawFastHLine(0, 12, kW, SSD1306_WHITE);
}

void drawPageDots(uint8_t active, uint8_t count) {
    if (count == 0) return;
    constexpr int16_t y = kH - 16;
    constexpr int16_t dotR = 2;
    constexpr int16_t gap  = 7;
    int16_t totalW = (int16_t)count * gap - (gap - 2 * dotR);
    int16_t x = (kW - totalW) / 2 + dotR;
    for (uint8_t i = 0; i < count; ++i) {
        if (i == active) display.fillCircle(x, y, dotR, SSD1306_WHITE);
        else             display.drawCircle(x, y, dotR, SSD1306_WHITE);
        x += gap;
    }
}

void drawStatusRow(const TelemetrySnapshot& t) {
    constexpr int16_t y = kH - 10;

    constexpr int16_t barX = 2;
    constexpr int16_t barW = 28;
    constexpr int16_t barH = 8;
    display.drawRect(barX, y, barW, barH, SSD1306_WHITE);
    display.drawFastVLine(barX + barW, y + 2, barH - 4, SSD1306_WHITE);
    uint8_t pct = t.batteryPct > 100 ? 100 : t.batteryPct;
    int16_t fill = (barW - 2) * pct / 100;
    if (fill > 0) display.fillRect(barX + 1, y + 1, fill, barH - 2, SSD1306_WHITE);

    display.setTextSize(1);
    char pctBuf[6];
    snprintf(pctBuf, sizeof(pctBuf), "%u%%", (unsigned)pct);
    display.setCursor(barX + barW + 4, y);
    display.print(pctBuf);

    // Case icon: filled = closed, hollow = open.
    constexpr int16_t iconX = kW - 10;
    if (t.caseOpen) display.drawRect(iconX, y, 8, 8, SSD1306_WHITE);
    else            display.fillRect(iconX, y, 8, 8, SSD1306_WHITE);
}

void drawHero(Page p, const TelemetrySnapshot& t) {
    char value[12];
    const char* unit = "";

    switch (p) {
        case Page::Temperature:
            snprintf(value, sizeof(value), "%.1f", t.temperatureC);
            unit = "C";
            break;
        case Page::Humidity:
            snprintf(value, sizeof(value), "%.0f", t.humidityPct);
            unit = "%";
            break;
        case Page::Pressure:
            snprintf(value, sizeof(value), "%.0f", t.pressureHpa);
            unit = "hPa";
            break;
        case Page::BatteryPct:
            snprintf(value, sizeof(value), "%u", (unsigned)t.batteryPct);
            unit = "%";
            break;
        case Page::Voltage:
            snprintf(value, sizeof(value), "%.2f", t.batteryMv / 1000.0f);
            unit = "V";
            break;
        case Page::Current:
            snprintf(value, sizeof(value), "%d", (int)t.batteryMa);
            unit = "mA";
            break;
        case Page::Case:
            // Czech, stripped: OTEVRENO (open), ZAVRENO (closed).
            snprintf(value, sizeof(value), "%s", t.caseOpen ? "OTEVR" : "ZAVR");
            unit = "";
            break;
    }

    printCenteredX(pageLabel(p), 22, 1);
    uint8_t valSize = (strlen(value) <= 3) ? 3 : 2;
    int16_t valY = (valSize == 3) ? 50 : 56;
    printCenteredX(value, valY, valSize);
    if (unit[0]) printCenteredX(unit, 90, 1);
}

// Build a filtered list of pages enabled in the current bitmask. Returns
// the number of active pages written to `out`. `out` must hold kAllPagesCount.
uint8_t buildActivePages(Page* out) {
    const uint16_t mask = config().oledBitmask;
    uint8_t n = 0;
    for (uint8_t i = 0; i < kAllPagesCount; ++i) {
        Page p = kAllPages[i];
        if (mask & (1u << (uint8_t)p)) out[n++] = p;
    }
    return n;
}

}  // namespace

bool begin() {
    if (ready) return true;
    if (!display.begin(SSD1306_SWITCHCAPVCC, kAddr, /*reset=*/true, /*periphBegin=*/false)) {
        DFSU_ERR("oled", "begin failed at 0x%02X — check addr jumper (0x3C vs 0x3D) and wiring", kAddr);
        return false;
    }
    display.setRotation(1);  // portrait, 90° clockwise
    ready = true;
    DFSU_LOG("oled", "ready (portrait)");
    showBootSplash();
    return true;
}

void showBootSplash() {
    if (!ready) return;
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);

    printCenteredX("D-FSU", 30, 2);

    display.setTextSize(1);
    printCenteredX("spousti se", 70, 1);
    printCenteredX("v" DFSU_FW_VERSION, 84, 1);

    display.display();
}

void render(const TelemetrySnapshot& t) {
    if (!ready) return;

    Page active[kAllPagesCount];
    uint8_t activeCount = buildActivePages(active);

    if (activeCount == 0) {
        // Nothing enabled: minimal status-only frame so user can tell OLED is alive.
        display.clearDisplay();
        drawHeader();
        drawStatusRow(t);
        display.display();
        return;
    }

    // Advance every kTicksPerPage render() calls.
    if (tickCount >= kTicksPerPage) {
        tickCount = 0;
        pageCursor = (pageCursor + 1) % activeCount;
    }
    if (pageCursor >= activeCount) pageCursor = 0;  // bitmask shrank under us
    ++tickCount;

    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    drawHeader();
    drawHero(active[pageCursor], t);
    drawPageDots(pageCursor, activeCount);
    drawStatusRow(t);
    display.display();
}

void off() {
    if (!ready) return;
    display.ssd1306_command(SSD1306_DISPLAYOFF);
}

void on() {
    if (!ready) return;
    display.ssd1306_command(SSD1306_DISPLAYON);
}

}  // namespace dfsu::oled
