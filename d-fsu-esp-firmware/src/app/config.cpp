#include "config.h"

namespace dfsu {

RuntimeConfig& config() {
    static RuntimeConfig instance;
    return instance;
}

}  // namespace dfsu
