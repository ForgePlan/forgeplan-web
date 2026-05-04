import { json } from '@sveltejs/kit';
import type { ForgeplanResult } from './forgeplan';

export function respond<T>(result: ForgeplanResult<T>) {
  if (result.ok) {
    return json({ ok: true, data: result.data, cmd: result.cmd });
  }
  return json(
    {
      ok: false,
      error: result.error ?? 'unknown error',
      cmd: result.cmd,
      raw: result.raw
    },
    { status: 502 }
  );
}
