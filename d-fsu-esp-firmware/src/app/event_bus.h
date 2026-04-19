#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

#include "types.h"

// Single-producer-multi-consumer-ish event bus using a FreeRTOS queue.
// Events are small, POD, and tagged. Transport/UI consumers read and fan out.

namespace dfsu {

enum class EventKind : uint8_t {
    Telemetry,
    Impact,
    CaseChange,
};

struct Event {
    EventKind kind;
    union {
        TelemetrySnapshot telemetry;
        ImpactEvent impact;
        CaseEvent caseChange;
    };
};

class EventBus {
public:
    // Capacity sized for a few seconds of backlog at worst-case produce rates.
    static constexpr size_t kQueueDepth = 32;

    bool begin();

    // From any task/ISR-safe context for fromISR; Phase 1A only uses the
    // non-ISR variants (case_switch notifies via a deferred task).
    bool post(const Event& e, TickType_t timeout = pdMS_TO_TICKS(10));
    bool receive(Event& out, TickType_t timeout);

    // Helpers so producers don't build the Event struct by hand.
    bool postTelemetry(const TelemetrySnapshot& s);
    bool postImpact(const ImpactEvent& i);
    bool postCaseChange(const CaseEvent& c);

private:
    QueueHandle_t queue_ = nullptr;
};

EventBus& bus();  // singleton accessor

}  // namespace dfsu
