import { test, expect } from '@playwright/test';
import {
  bulkPlan,
  bulkSummary,
  composerView,
  draftProblem,
  hasCredentialPlaceholder,
  looksLikeCredential,
  newBulkId,
  orderRows,
  quotaLeft,
  recipientBlock,
  renderTemplate,
  retryMinutes,
  runBulk,
  usableTemplates,
  type MessageDraft,
  type MessagingConfig,
  type RecipientInfo,
  type SendResult,
} from '../src/access-control/messaging-logic';
import { sendFailureOf } from '../src/api/access-messaging';
import { ApiError } from '../src/api/client';

// CR-036 S7 / WA: the message dialog's pure logic. The WisKey side of the messaging (ask W11) is unanswered; everything here is the
// dialog's rules against fakes. Node only.

const config = (over: Partial<MessagingConfig> = {}): MessagingConfig => ({
  feature: true, enabled: true, can_send: true, can_reveal_phone: true, free_text: true, bulk_max: 10, text_max: 1000, templates_revision: 3, pace_ms: 0,
  templates: [{ id: 't1', label: 'Reminder', body: 'שלום {name}, תוקף הכניסה שלך מסתיים בקרוב.' }], quota: { limit: 5, used: 1, resets_in_s: 900 }, ...over,
});
const rcpt = (id: string, over: Partial<RecipientInfo> = {}): RecipientInfo => ({ person_id: id, name: `P ${id}`, phone_masked: '••••••••01', has_phone: true, consent: 'granted', ...over });
const draft = (text: string, template_id: string | null = null): MessageDraft => ({ template_id, text });

test.describe('a message never carries a credential', () => {
  test('a credential placeholder is recognised in a template or a text', () => {
    for (const bad of ['שלום {pin}', 'code: {code}', '{ PIN }', '{card_number}', '{credential_section}', '{password}', '{token}', '{secret}']) {
      expect(hasCredentialPlaceholder(bad), bad).toBe(true);
    }
    for (const ok of ['שלום {name}', '{organization}', 'ברוך הבא ל{organization}']) expect(hasCredentialPlaceholder(ok), ok).toBe(false);
  });

  test('a text that reads like "the code is 4821" is a credential; times, dates and plain numbers are not', () => {
    for (const bad of ['הקוד שלך 4821', 'קוד הגישה: 123456', 'your PIN is 4821', 'PIN 1234', 'code 98765', 'סיסמה 5566', 'הסיסמת כניסה: 12345678']) {
      expect(looksLikeCredential(bad), bad).toBe(true);
    }
    for (const ok of ['הכניסה סגורה בין 12:00 ל־14:00', 'תוקף עד 31.12.2026', 'חדר 4821', 'שלום, מספר העובד שלך 1001', 'נא להגיע בקומה 3', 'the code of conduct is on page 12']) {
      expect(looksLikeCredential(ok), ok).toBe(false);
    }
  });

  test('a template with a credential placeholder is not offered', () => {
    const list = usableTemplates([
      { id: 'a', label: 'ok', body: 'שלום {name}' },
      { id: 'b', label: 'pin', body: 'הקוד שלך {pin}' },
      { id: 'c', label: 'empty', body: '   ' },
      { id: '', label: 'no id', body: 'x' },
    ]);
    expect(list.map((t) => t.id)).toEqual(['a']);
  });

  test('a template is copied into the text only by the sender picking it; rendering fills known placeholders only', () => {
    expect(renderTemplate('שלום {name} מ{organization} {unknown}', { name: 'דנה', organization: 'המשרד' })).toBe('שלום דנה מהמשרד {unknown}');
  });
});

test.describe('the single composer', () => {
  const ok = (over: object = {}) => ({ config: config(), recipient: rcpt('1'), draft: draft('שלום'), phase: 'idle' as const, ...over });

  test('nothing in the way: the sender may send', () => {
    expect(composerView(ok())).toEqual({ blocked: null, canSend: true, textDisabled: false, line: null });
  });

  test('the service is not connected, the person has no phone, the person asked not to be messaged, the caller may not message them: calm, blocked, text dimmed', () => {
    for (const [over, reason] of [
      [{ config: config({ enabled: false }) }, 'no_service'],
      [{ recipient: rcpt('1', { has_phone: false, phone_masked: null }) }, 'no_phone'],
      [{ recipient: null }, 'no_phone'],
      [{ recipient: rcpt('1', { consent: 'declined' }) }, 'no_consent'],
      [{ recipient: rcpt('1', { allowed: false }) }, 'forbidden'],
    ] as const) {
      const v = composerView(ok(over));
      expect(v.blocked).toBe(reason);
      expect(v.canSend).toBe(false);
      expect(v.textDisabled).toBe(true);
      expect(v.line).toEqual({ tone: 'warn', kind: 'cant', reason });
    }
  });

  test('consent unknown does not block (it is shown, not enforced here); a person the server did not look up is not blocked either', () => {
    expect(composerView(ok({ recipient: rcpt('1', { consent: 'unknown' }) })).canSend).toBe(true);
    expect(composerView(ok({ recipient: rcpt('1', { has_phone: null, phone_masked: null }) })).canSend).toBe(true);
  });

  test('hidden-phone mode: a sender who may not see the number still sends', () => {
    const hidden = ok({ config: config({ can_reveal_phone: false }), recipient: rcpt('1', { phone_masked: null, has_phone: true }) });
    expect(composerView(hidden).canSend).toBe(true);
    expect(recipientBlock(config({ can_reveal_phone: false }), rcpt('1', { phone_masked: null, has_phone: true }))).toBeNull();
  });

  test('the quota: used up -> one warm line with minutes; a rate refusal from the server says the same', () => {
    const used = composerView(ok({ config: config({ quota: { limit: 5, used: 5, resets_in_s: 840 } }) }));
    expect(used.blocked).toBe('rate');
    expect(used.canSend).toBe(false);
    expect(used.line).toEqual({ tone: 'warn', kind: 'rate', minutes: 14 });
    const refused = composerView(ok({ phase: 'failed', failure: 'rate', retryAfterS: 61 }));
    expect(refused.line).toEqual({ tone: 'warn', kind: 'rate', minutes: 2 });
    expect(quotaLeft({ limit: 5, used: 1, resets_in_s: 1 })).toBe(4);
    expect(quotaLeft({ limit: 5, used: 9, resets_in_s: 1 })).toBe(0);
    expect(quotaLeft(null)).toBeNull();
    expect(retryMinutes(undefined)).toBe(1);
    expect(retryMinutes(0)).toBe(1);
    expect(retryMinutes(3601)).toBe(61);
  });

  test('the text: empty, too long, free text switched off by the administrator, a credential', () => {
    expect(draftProblem(config(), draft('   '))).toBe('empty');
    expect(composerView(ok({ draft: draft('') })).canSend).toBe(false);
    expect(composerView(ok({ draft: draft('') })).line).toBeNull(); // nothing is said before the sender writes
    expect(draftProblem(config({ text_max: 5 }), draft('123456'))).toBe('too_long');
    expect(draftProblem(config({ free_text: false }), draft('שלום'))).toBe('free_text_off');
    expect(draftProblem(config({ free_text: false }), draft('שלום', 't1'))).toBeNull();
    expect(draftProblem(config(), draft('הקוד שלך 4821'))).toBe('credential');
    const blocked = composerView(ok({ draft: draft('הקוד שלך 4821') }));
    expect(blocked.canSend).toBe(false);
    expect(blocked.line).toEqual({ tone: 'err', kind: 'cant', reason: 'credential' });
  });

  test('sending, sent and failed phases', () => {
    expect(composerView(ok({ phase: 'sending' }))).toMatchObject({ canSend: false, textDisabled: true, line: { tone: 'wait', kind: 'sending' } });
    expect(composerView(ok({ phase: 'sent' }))).toMatchObject({ canSend: true, line: { tone: 'ok', kind: 'sent' } });
    expect(composerView(ok({ phase: 'failed', failure: 'not_registered' }))).toMatchObject({ canSend: true, line: { tone: 'err', kind: 'failed', reason: 'not_registered' } });
    expect(composerView(ok({ phase: 'failed', failure: 'uncertain' })).line).toEqual({ tone: 'err', kind: 'failed', reason: 'uncertain' });
  });
});

test.describe('the bulk plan', () => {
  const people = [rcpt('1'), rcpt('2', { has_phone: false, phone_masked: null }), rcpt('3', { consent: 'declined' }), rcpt('4')];

  test('who gets it and who does not, and why', () => {
    const plan = bulkPlan(people, config(), draft('שלום'));
    expect(plan.send.map((r) => r.person_id)).toEqual(['1', '4']);
    expect(plan.skip.map((s) => [s.recipient.person_id, s.reason])).toEqual([['2', 'no_phone'], ['3', 'no_consent']]);
    expect(plan.canSend).toBe(true);
    expect(plan.tooMany).toBe(false);
    expect(plan.overQuota).toBeNull();
  });

  test('a person the server did not look up is sent to (decided as the message goes); one the caller may not message is skipped', () => {
    const plan = bulkPlan([rcpt('1', { has_phone: null, phone_masked: null }), rcpt('2', { allowed: false })], config(), draft('שלום'));
    expect(plan.send.map((r) => r.person_id)).toEqual(['1']);
    expect(plan.skip.map((s) => [s.recipient.person_id, s.reason])).toEqual([['2', 'forbidden']]);
  });

  test('more people than the administrator allows, more than the quota has left, nobody eligible, a bad text', () => {
    expect(bulkPlan(people, config({ bulk_max: 3 }), draft('x')).tooMany).toBe(true);
    expect(bulkPlan(people, config({ bulk_max: 3 }), draft('x')).canSend).toBe(false);
    const over = bulkPlan(people, config({ quota: { limit: 3, used: 2, resets_in_s: 60 } }), draft('x'));
    expect(over.overQuota).toBe(1);
    expect(over.canSend).toBe(false);
    expect(bulkPlan([people[1], people[2]], config(), draft('x')).canSend).toBe(false);
    expect(bulkPlan(people, config(), draft('')).canSend).toBe(false);
    expect(bulkPlan(people, config(), draft('PIN 1234')).canSend).toBe(false);
    expect(bulkPlan(people, config({ enabled: false }), draft('x')).send).toEqual([]);
  });
});

test.describe('a bulk run', () => {
  const sleeps: number[] = [];
  const sleep = async (ms: number) => {
    sleeps.push(ms);
  };
  test.beforeEach(() => {
    sleeps.length = 0;
  });
  const sent = (): SendResult => ({ ok: true, sent_at: '2026-10-12T08:21:00Z' });

  test('sequential sends: a failure never stops the rest; progress is reported; the table has a row for everyone', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2'), rcpt('3'), rcpt('4', { has_phone: false, phone_masked: null })], config(), draft('x'));
    const calls: string[] = [];
    const progress: [number, number][] = [];
    const out = await runBulk(plan, draft('x'), async (id): Promise<SendResult> => {
      calls.push(id);
      return id === '2' ? { ok: false, reason: 'not_registered' } : sent();
    }, (d, t) => progress.push([d, t]));
    expect(calls).toEqual(['1', '2', '3']);
    expect(out.sent).toEqual(['1', '3']);
    expect(out.failed).toEqual([{ id: '2', reason: 'not_registered' }]);
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(out.rows.map((r) => [r.id, r.status, r.reason])).toEqual([['4', 'failed', 'no_phone'], ['1', 'sent', undefined], ['2', 'failed', 'not_registered'], ['3', 'sent', undefined]]);
    expect(orderRows(['1', '2', '3', '4'], out.rows).map((r) => r.id)).toEqual(['1', '2', '3', '4']);
    expect(bulkSummary(out)).toEqual({ sent: 2, held: 0, failed: 2, unknown: 0 });
  });

  test('the server\'s pace is kept between the sends - not before the first, not after the last', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2'), rcpt('3')], config(), draft('x'));
    await runBulk(plan, draft('x'), async () => sent(), { paceMs: 2200, sleep });
    expect(sleeps).toEqual([2200, 2200]);
  });

  test('the hour\'s allowance stops the run (every later send would be refused the same way); the rest are reported as not sent for it', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2'), rcpt('3')], config(), draft('x'));
    const calls: string[] = [];
    const out = await runBulk(plan, draft('x'), async (id): Promise<SendResult> => {
      calls.push(id);
      return id === '2' ? { ok: false, reason: 'rate', retry_after_s: 60 } : sent();
    });
    expect(calls).toEqual(['1', '2']);
    expect(out.sent).toEqual(['1']);
    expect(out.failed).toEqual([{ id: '2', reason: 'rate' }, { id: '3', reason: 'rate' }]);
  });

  test('a service that is down, switched off, or a catalogue that changed stops the run too', async () => {
    for (const reason of ['no_service', 'disabled', 'template_changed'] as const) {
      const plan = bulkPlan([rcpt('1'), rcpt('2')], config(), draft('x'));
      const calls: string[] = [];
      const out = await runBulk(plan, draft('x'), async (id): Promise<SendResult> => {
        calls.push(id);
        return { ok: false, reason };
      });
      expect(calls, reason).toEqual(['1']);
      expect(out.failed, reason).toEqual([{ id: '1', reason }, { id: '2', reason }]);
    }
  });

  test('a burst refusal ("wait a moment") is waited out and the same person tried again - it provably sent nothing', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2')], config(), draft('x'));
    let refusals = 2;
    const calls: string[] = [];
    const out = await runBulk(plan, draft('x'), async (id): Promise<SendResult> => {
      calls.push(id);
      if (id === '1' && refusals-- > 0) return { ok: false, reason: 'rate', transient: true, retry_after_s: 3 };
      return sent();
    }, { sleep });
    expect(calls).toEqual(['1', '1', '1', '2']);
    expect(out.sent).toEqual(['1', '2']);
    expect(sleeps).toEqual([3000, 3000]);
  });

  test('a burst refusal that does not pass stops the run after three waits', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2')], config(), draft('x'));
    const calls: string[] = [];
    const out = await runBulk(plan, draft('x'), async (id): Promise<SendResult> => {
      calls.push(id);
      return { ok: false, reason: 'rate', transient: true, retry_after_s: 60 };
    }, { sleep });
    expect(calls).toEqual(['1', '1', '1', '1']);
    expect(sleeps).toEqual([10000, 10000, 10000]);
    expect(out.failed).toEqual([{ id: '1', reason: 'rate' }, { id: '2', reason: 'rate' }]);
  });

  test('the stop button ends the run after the message in flight; the rest are "stopped"', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2'), rcpt('3')], config(), draft('x'));
    let stop = false;
    const out = await runBulk(plan, draft('x'), async (id): Promise<SendResult> => {
      if (id === '1') stop = true;
      return sent();
    }, { shouldStop: () => stop });
    expect(out.sent).toEqual(['1']);
    expect(out.failed).toEqual([{ id: '2', reason: 'stopped' }, { id: '3', reason: 'stopped' }]);
  });

  test('a send that throws is uncertain, never retried; the table says unknown, not failed', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2')], config(), draft('x'));
    let n = 0;
    const out = await runBulk(plan, draft('x'), async () => {
      n++;
      throw new Error('boom');
    });
    expect(n).toBe(2);
    expect(out.failed).toEqual([{ id: '1', reason: 'uncertain' }, { id: '2', reason: 'uncertain' }]);
    expect(out.rows.map((r) => r.status)).toEqual(['unknown', 'unknown']);
    expect(bulkSummary(out)).toEqual({ sent: 0, held: 0, failed: 0, unknown: 2 });
  });

  test('HARDEN271: a message held for the consent of the person is not counted as sent', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2'), rcpt('3')], config(), draft('x'));
    const out = await runBulk(plan, draft('x'), async (id): Promise<SendResult> =>
      id === '1' ? sent() : { ok: true, sent_at: '2026-10-12T08:21:00Z', held: id === '2' ? 'held' : 'consent_requested' });
    expect(out.rows.map((r) => r.status)).toEqual(['sent', 'held', 'held']);
    expect(bulkSummary(out)).toEqual({ sent: 1, held: 2, failed: 0, unknown: 0 });
  });

  test('a run has its own id', () => {
    const a = newBulkId();
    expect(a).toMatch(/^bulk-[0-9a-f]{24}$/);
    expect(newBulkId()).not.toBe(a);
  });
});

test.describe('the routes\' error codes -> what the dialog says', () => {
  const err = (status: number, code: string, details: Record<string, unknown> = {}) => new ApiError(status, { code, user_message: 'x', retryable: false, correlation_id: '', details });

  test('known codes', () => {
    expect(sendFailureOf(err(422, 'message_no_phone')).reason).toBe('no_phone');
    expect(sendFailureOf(err(409, 'message_no_consent')).reason).toBe('no_consent');
    expect(sendFailureOf(err(503, 'message_service_unavailable')).reason).toBe('no_service');
    expect(sendFailureOf(err(502, 'message_not_registered')).reason).toBe('not_registered');
    expect(sendFailureOf(err(429, 'message_rate_limited', { retry_after_s: 840, scope: 'hour' }))).toEqual({ ok: false, reason: 'rate', retry_after_s: 840, transient: false });
    expect(sendFailureOf(err(429, 'message_rate_limited', { retry_after_s: 5, scope: 'burst' }))).toEqual({ ok: false, reason: 'rate', retry_after_s: 5, transient: true });
    expect(sendFailureOf(err(422, 'message_forbidden_content')).reason).toBe('credential');
    expect(sendFailureOf(err(403, 'message_free_text_disabled')).reason).toBe('free_text_off');
    expect(sendFailureOf(err(410, 'message_expired')).reason).toBe('expired');
    expect(sendFailureOf(err(403, 'message_forbidden')).reason).toBe('forbidden');
    expect(sendFailureOf(err(404, 'intercom_person_not_found')).reason).toBe('gone');
    expect(sendFailureOf(err(409, 'message_template_changed', { templates_revision: 4 }))).toEqual({ ok: false, reason: 'template_changed', templates_revision: 4 });
    expect(sendFailureOf(err(409, 'message_disabled')).reason).toBe('disabled');
    expect(sendFailureOf(err(409, 'message_duplicate')).reason).toBe('duplicate');
    expect(sendFailureOf(err(502, 'message_refused')).reason).toBe('refused');
    expect(sendFailureOf(err(504, 'message_uncertain')).reason).toBe('uncertain');
    expect(sendFailureOf(err(422, 'message_empty')).reason).toBe('empty');
    expect(sendFailureOf(err(422, 'message_too_long')).reason).toBe('too_long');
  });

  test('the feed\'s own budget is a burst refusal too', () => {
    expect(sendFailureOf(err(429, 'intercom_rate_limited'))).toMatchObject({ reason: 'rate', transient: true });
    expect(sendFailureOf(err(429, 'intercom_busy'))).toMatchObject({ reason: 'rate', transient: true });
  });

  test('anything else: a server fault or a dropped connection is uncertain (no blind retry); a refusal we do not know is unknown', () => {
    expect(sendFailureOf(err(500, 'oops')).reason).toBe('uncertain');
    expect(sendFailureOf(err(504, 'gateway')).reason).toBe('uncertain');
    expect(sendFailureOf(err(422, 'something_new')).reason).toBe('unknown');
    expect(sendFailureOf(new TypeError('network')).reason).toBe('uncertain');
  });

  test('the 2.6.5 caps: a recipient or a station refuses that person only; the sender cap, the run window and the send hours halt', () => {
    expect(sendFailureOf(err(429, 'message_rate_limited', { scope: 'person', retry_after_s: 9000 })).reason).toBe('person_limit');
    expect(sendFailureOf(err(429, 'message_rate_limited', { scope: 'station', retry_after_s: 900 })).reason).toBe('station_limit');
    expect(sendFailureOf(err(429, 'message_rate_limited', { scope: 'sender', retry_after_s: 900 }))).toMatchObject({ reason: 'rate', transient: false });
    expect(sendFailureOf(err(422, 'message_bulk_too_many', { scope: 'window' })).reason).toBe('rate');
    expect(sendFailureOf(err(409, 'message_outside_hours', { next_allowed_at: '2026-10-15T05:00:00Z' })).reason).toBe('outside_hours');
  });
});

// review F1 (2.6.5): the same counterexamples as tests/test_intercom_messaging_review265.py - the browser's guard is an early answer only
test.describe('the credential guard after the 2.6.5 review', () => {
  const evasions = [
    'קוד:\n4821', 'קוד 4 8 2 1', 'קוד 48 21', 'code 48-21', 'pincode 4821', 'Zugangscode 4821', 'PIN code: 4 8 2 1', 'P.I.N. 4821',
    'c​ode 4821', 'קו​ד 4821', 'рin 4821', 'код 4821', 'пароль 4821', 'رمز 4821', 'كلمة السر 4821', 'mot de passe 4821',
    'pass 4821', 'your pin is four eight two one', 'הקוד: ארבע-שמונה-שתיים-אחת', 'קוד 48²¹', 'קוד ①②③④', 'סִיסְמָה 4821',
    'קוד לכניסה הראשית בבניין 4821', 'PIN ٤٨٢١', 'קוד ۴۸۲۱', 'пин 4821', 'كود 4821',
  ];
  const ordinary = ['הכניסה סגורה בין 12:00 ל־14:00', 'שלום דנה, כרטיס הכניסה מוכן', 'נפגש ב־15.10.2026 בשעה 09:30', 'מספר העובד שלך 1001', 'קוד הלבוש: חליפה', 'Meeting room 3 at 14:00', 'שלום, אחת ושתיים ושלוש', 'one two three'];
  test('every evasion of the review is caught', () => {
    for (const t of evasions) expect(looksLikeCredential(t), t).toBe(true);
  });
  test('ordinary text still passes', () => {
    for (const t of ordinary) expect(looksLikeCredential(t), t).toBe(false);
  });
  test('outside the send hours nobody can be messaged; the tighter allowance counts', () => {
    const closed = config({ send_hours: { from: '08:00', to: '21:00', open_now: false, next_opening: '2026-10-15T05:00:00Z' } });
    expect(recipientBlock(closed, rcpt('a'))).toBe('outside_hours');
    const mine = config({ quota: { limit: 60, used: 1, resets_in_s: 900 }, sender_quota: { limit: 2, used: 2, resets_in_s: 600 } });
    expect(composerView({ config: mine, recipient: rcpt('a'), draft: draft('שלום'), phase: 'idle' }).blocked).toBe('rate');
  });
});
