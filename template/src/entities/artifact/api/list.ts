import { createPoller } from '@/shared/api';
import type { ArtifactSummary } from '../model/types';

export const listPoller = createPoller<ArtifactSummary[]>('/api/list');
