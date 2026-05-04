import { createPoller } from '@/shared/api';
import type { GraphResponse } from '../model/types';

export const graphPoller = createPoller<GraphResponse>('/api/graph');
