#include "event_bus.h"

#include "../util/log.h"

namespace dfsu {

bool EventBus::begin() {
    if (queue_) return true;
    queue_ = xQueueCreate(kQueueDepth, sizeof(Event));
    if (!queue_) {
        DFSU_ERR("bus", "xQueueCreate failed");
        return false;
    }
    return true;
}

bool EventBus::post(const Event& e, TickType_t timeout) {
    if (!queue_) return false;
    return xQueueSend(queue_, &e, timeout) == pdTRUE;
}

bool EventBus::receive(Event& out, TickType_t timeout) {
    if (!queue_) return false;
    return xQueueReceive(queue_, &out, timeout) == pdTRUE;
}

bool EventBus::postTelemetry(const TelemetrySnapshot& s) {
    Event e{};
    e.kind = EventKind::Telemetry;
    e.telemetry = s;
    return post(e);
}

bool EventBus::postImpact(const ImpactEvent& i) {
    Event e{};
    e.kind = EventKind::Impact;
    e.impact = i;
    return post(e);
}

bool EventBus::postCaseChange(const CaseEvent& c) {
    Event e{};
    e.kind = EventKind::CaseChange;
    e.caseChange = c;
    return post(e);
}

EventBus& bus() {
    static EventBus instance;
    return instance;
}

}  // namespace dfsu
