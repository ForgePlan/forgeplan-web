import { createPoller } from '@/shared/api';
import type { StalePayload } from '../model/types';

export const stalePoller = createPoller<StalePayload>('/api/stale');
