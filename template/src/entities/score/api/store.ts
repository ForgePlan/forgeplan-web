import { createPoller } from "@/shared/api";
import type { ScoreResponse } from "../model/types";

// 60s: `score --all` is the heaviest CLI spawn (needs the workspace lock +
// scores 100+ artifacts). Halving the poll rate halves lock contention with
// agent sessions; Stats freshness does not need 30s granularity.
export const scorePoller = createPoller<ScoreResponse>("/api/score", 60_000);
