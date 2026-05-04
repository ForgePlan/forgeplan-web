import { createPoller } from '@/shared/api';
import type { ClaimsPayload } from '../model/types';

export const claimsPoller = createPoller<ClaimsPayload>('/api/claims');
