import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';
import { installAccessMock, type AccessMock, type MockOptions } from './access-control-mocks';
import { settingsProblems } from '../src/access-control/messaging-templates';
import type { MessagingLimits } from '../src/api/access-messaging';

// CR-036 WA: the mock layer of the Settings page "הודעות" (Settings > access control > messages). The app runs for real; the rest of the
// access-control reads are tests/access-control-mocks.ts's, and this adds the two routes of the page - GET and PUT
// `/api/v1/access-control/messaging/settings` - as a STATEFUL server: the reply shapes come from tests/fixtures/messaging_wire.json (the backend test
// test_intercom_messaging.py::test_the_mock_replies_have_the_shape_of_the_real_routes checks them against the real routes), the rules are the ones
// the server applies (services/intercom_messaging.py `validate_settings`, here the browser's own copy in src/access-control/messaging-templates.ts,
// which the server's tests pin to the same codes). Nothing here can reach a phone. Everything is invented.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WIRE = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'messaging_wire.json'), 'utf8')) as Record<string, any>;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export interface SettingsDoc {
  revision: number;
  enabled: boolean;
  free_text: boolean;
  bulk_max: number;
  rate_per_hour: number;
  organization: string;
  account: string;
  templates: { id: string; label: string; body: string }[];
}

export interface MessagingSettingsMock {
  doc: SettingsDoc;
  service: { state: string; connected: boolean | null; accounts: { id: string; name: string }[]; problem: string | null; last_error: string | null };
  /** The PUT bodies the page sent, in order. */
  puts: Record<string, any>[];
  gets: number;
  /** What the next PUT does: `ok` (validated and saved), `conflict` (someone else saved first: 409), `server_problem` (422 with `problems`), `fail` (500). */
  next: 'ok' | 'conflict' | 'server_problem' | 'fail';
  problems: { path: string; code: string }[];
  /** The read answers after this long (to look at the loading state). */
  delay: number;
  /** The read fails (500): the error panel. */
  readFails: boolean;
}

const err = (code: string, user_message: string, details: Record<string, unknown> = {}) => ({ code, user_message, retryable: false, correlation_id: 'c0ffee', details });

export function newSettings(): MessagingSettingsMock {
  const wire = clone(WIRE.settings);
  return {
    doc: { ...wire.settings, enabled: false, organization: '', revision: 0 },
    service: clone(wire.service),
    puts: [], gets: 0, next: 'ok', problems: [], delay: 0, readFails: false,
  };
}

/** The app's mocked backend plus the two message-settings routes (registered last, so they win over the generic access-control answers). */
export async function installMessagingSettings(page: Page, opts: MockOptions = {}, init: Partial<MessagingSettingsMock> = {}): Promise<{ access: AccessMock; ms: MessagingSettingsMock }> {
  const access = await installAccessMock(page, opts);
  const ms: MessagingSettingsMock = { ...newSettings(), ...init };
  const limits = clone(WIRE.settings.limits) as MessagingLimits;
  const reply = () => ({ ...clone(WIRE.settings), settings: clone(ms.doc), limits, service: clone(ms.service) });
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(/\/api\/v1\/access-control\/messaging\/settings$/, async (route) => {
    const req = route.request();
    if (ms.delay) await new Promise((r) => setTimeout(r, ms.delay));
    if (req.method() === 'GET') {
      ms.gets += 1;
      if (ms.readFails) return json(route, err('intercom_unavailable', 'בקרת הכניסה אינה זמינה כרגע.'), 503);
      return json(route, reply());
    }
    const body = req.postDataJSON() as Record<string, any>;
    ms.puts.push(body);
    if (ms.next === 'fail') return json(route, err('internal', 'שגיאת שרת.'), 500);
    if (ms.next === 'conflict') {
      ms.next = 'ok';
      ms.doc.revision += 1;
      return json(route, err('message_settings_conflict', 'ההגדרות נשמרו בינתיים על ידי מישהו אחר - טענו מחדש.', { revision: ms.doc.revision }), 409);
    }
    if (ms.next === 'server_problem') {
      ms.next = 'ok';
      return json(route, err('message_settings_invalid', 'הגדרות ההודעות אינן תקינות.', { errors: ms.problems }), 422);
    }
    if (body.base_revision !== ms.doc.revision) return json(route, err('message_settings_conflict', 'ההגדרות נשמרו בינתיים על ידי מישהו אחר - טענו מחדש.', { revision: ms.doc.revision }), 409);
    const next = {
      bulk_max: body.bulk_max, rate_per_hour: body.rate_per_hour, organization: String(body.organization ?? ''),
      account: String(body.account ?? ''), templates: (body.templates ?? []) as { id?: string; label: string; body: string }[],
    };
    const problems = settingsProblems(next, limits);
    if (problems.length) return json(route, err('message_settings_invalid', 'הגדרות ההודעות אינן תקינות.', { errors: problems }), 422);
    let n = ms.doc.templates.length;
    ms.doc = {
      revision: ms.doc.revision + 1, enabled: body.enabled === true, free_text: body.free_text === true, bulk_max: next.bulk_max, rate_per_hour: next.rate_per_hour,
      organization: next.organization.trim(), account: next.account, templates: next.templates.map((t) => ({ id: t.id ?? `t${String(++n).padStart(8, '0')}`, label: t.label.trim(), body: t.body.trim() })),
    };
    return json(route, reply());
  });
  return { access, ms };
}
