import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import { isOutageError } from '../src/components/update-run-logic';

// CR-MAIN-RUNTIME-2438 (review 05:P1-07): an unexpected server error and a busy database now answer the error envelope
// (`internal_error` / `database_busy`, status 500) instead of bare text, which the client turned into the code `http_500`.
// The update screen kept treating such a 500 as "the system is down or restarting"; it still does.

const err = (status: number, code: string) => new ApiError(status, { code, user_message: '', retryable: false, correlation_id: '', details: {} });

test('a 500 in the new envelope is still an outage on the update screen', () => {
  expect(isOutageError(err(500, 'http_500'))).toBe(true); // the old bare-text answer
  expect(isOutageError(err(500, 'internal_error'))).toBe(true);
  expect(isOutageError(err(500, 'database_busy'))).toBe(true);
});

test('the other answers keep their meaning', () => {
  for (const s of [0, 401, 502, 503, 504]) expect(isOutageError(err(s, 'x'))).toBe(true);
  expect(isOutageError(err(404, 'not_found'))).toBe(false);
  expect(isOutageError(err(409, 'conflict'))).toBe(false);
  expect(isOutageError(err(500, 'update_failed'))).toBe(false); // a 500 the run itself reports stays "unknown"
  expect(isOutageError(new TypeError('fetch failed'))).toBe(true);
});
