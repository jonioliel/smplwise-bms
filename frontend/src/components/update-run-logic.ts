import { ApiError } from '../api/client';

/** The update screen's answer classification, without the component (node unit tests import it). */

/** A 500 that the server now answers in the error envelope (CR-MAIN-RUNTIME-2438) - before, the same answer was bare text (`http_500`). */
const SERVER_TROUBLE_500 = new Set(['internal_error', 'database_busy']);

/** An answer that means "the system is down or restarting", not "the run is unknown". */
export function isOutageError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 401 || err.status === 502 || err.status === 503 || err.status === 504 || err.status === 0 || err.code.startsWith('http_5')
    || (err.status === 500 && SERVER_TROUBLE_500.has(err.code));
  return true; // a TypeError from fetch: the connection is down
}
