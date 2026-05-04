import { createPoller } from '@/shared/api';
import type { BlockedPayload } from '../model/types';

export const blockedPoller = createPoller<BlockedPayload>('/api/blocked');
