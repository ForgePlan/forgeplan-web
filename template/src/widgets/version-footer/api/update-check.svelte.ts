import { createPoller, type Poller } from '@/shared/api';

export interface UpdateData {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
}

// PRD-013 SC-3 / FR-008: poll registry once at app mount, then every 30 min.
const THIRTY_MINUTES_MS = 30 * 60_000;

export const updatePoller: Poller<UpdateData> = createPoller<UpdateData>(
  '/api/update-check',
  THIRTY_MINUTES_MS,
);
