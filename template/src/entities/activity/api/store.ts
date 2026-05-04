import { createPoller } from '@/shared/api';
import type { ActivityPayload } from '../model/types';

export const logPoller = createPoller<ActivityPayload>('/api/log');
