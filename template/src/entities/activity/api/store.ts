import { createPoller } from "@/shared/api";
import type { ActivityPayload } from "../model/types";

export const logPoller = createPoller<ActivityPayload>("/api/log");

// PRD-010 / RFC-009 — the default logPoller's 20-entry window is too small for
// velocity / status-transition / trend reconstruction, which need the full
// history. This dedicated poller pulls a wide window (/api/log accepts a
// 1–4 digit `limit`). Polled at 30s — these stats don't need 10s freshness.
export const statsLogPoller = createPoller<ActivityPayload>(
  "/api/log?limit=5000",
  30_000,
);
