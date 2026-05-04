import { createPoller } from '@/shared/api';
import type { ScoreEntry } from '../model/types';

export const scorePoller = createPoller<ScoreEntry[]>('/api/score', 30_000);
