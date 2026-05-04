import { createPoller } from '@/shared/api';
import type { HealthResponse } from '../model/types';

export const healthPoller = createPoller<HealthResponse>('/api/health');
