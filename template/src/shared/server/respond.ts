import { json } from '@sveltejs/kit';
import type { ForgeplanResult } from './forgeplan';

function statusFor(error: string | undefined): number {
  if (!error) return 502;
  if (error.startsWith('timeout ')) return 504;
  if (error.startsWith('failed to parse JSON')) return 500;
  if (error.startsWith('forbidden subcommand')) return 403;
  if (error.startsWith('exit code ')) return 400;
  return 400;
}

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
    { status: statusFor(result.error) }
  );
}
