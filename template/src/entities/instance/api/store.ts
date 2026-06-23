import { createPoller } from "@/shared/api";
import type { InstancesPayload } from "../model/types";

const INSTANCE_POLL_INTERVAL_MS = 3_000;

export const instancePoller = createPoller<InstancesPayload>(
  "/api/instances",
  INSTANCE_POLL_INTERVAL_MS,
);
