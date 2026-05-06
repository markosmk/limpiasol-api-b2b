import { afterEach, vi } from "vitest"

import { appEvents, EventTypes } from "@/events/emitter"

// clear mocks after each test
afterEach(() => {
  vi.restoreAllMocks()
  // limpiamos los listeners del evento de config, no tocamos otros eventos (user.registered, etc.)
  appEvents.removeAllListeners(EventTypes.MODULE_CONFIG_UPDATED)
})
