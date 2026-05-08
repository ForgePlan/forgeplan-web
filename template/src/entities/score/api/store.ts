import { createPoller } from '@/shared/api';
import type { ScoreResponse } from '../model/types';

export const scorePoller = createPoller<ScoreResponse>('/api/score', 30_000);
