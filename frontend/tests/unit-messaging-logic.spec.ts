import { test, expect } from '@playwright/test';
import {
  bulkPlan,
  composerView,
  draftProblem,
  hasCredentialPlaceholder,
  looksLikeCredential,
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
import { sendFailureOf } from '../src/api/messaging-fake';
import { ApiError } from '../src/api/client';

// CR-036 S7: the message dialog's pure logic. There is NO real send path in this build (WisKey ask W11 is open); everything here
// is the dialog's rules against fakes. Node only.

const config = (over: Partial<MessagingConfig> = {}): MessagingConfig => ({
  enabled: true, can_send: true, can_reveal_phone: true, free_text: true, bulk_max: 10, text_max: 1000,
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

  test('the service is not connected, the person has no phone, the person asked not to be messaged: calm, blocked, text dimmed', () => {
    for (const [over, reason] of [
      [{ config: config({ enabled: false }) }, 'no_service'],
      [{ recipient: rcpt('1', { has_phone: false, phone_masked: null }) }, 'no_phone'],
      [{ recipient: null }, 'no_phone'],
      [{ recipient: rcpt('1', { consent: 'declined' }) }, 'no_consent'],
    ] as const) {
      const v = composerView(ok(over));
      expect(v.blocked).toBe(reason);
      expect(v.canSend).toBe(false);
      expect(v.textDisabled).toBe(true);
      expect(v.line).toEqual({ tone: 'warn', kind: 'cant', reason });
    }
  });

  test('consent unknown does not block (it is shown, not enforced here)', () => {
    expect(composerView(ok({ recipient: rcpt('1', { consent: 'unknown' }) })).canSend).toBe(true);
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

  test('sequential sends: a failure never stops the rest; progress is reported', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2'), rcpt('3')], config(), draft('x'));
    const calls: string[] = [];
    const progress: [number, number][] = [];
    const out = await runBulk(plan, draft('x'), async (id) => {
      calls.push(id);
      return id === '2' ? { ok: false, reason: 'not_registered' } : { ok: true, sent_at: 't' };
    }, (d, t) => progress.push([d, t]));
    expect(calls).toEqual(['1', '2', '3']);
    expect(out).toEqual({ sent: ['1', '3'], failed: [{ id: '2', reason: 'not_registered' }] });
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  test('a rate refusal stops the run (every later send would be refused the same way); the rest are reported as not sent for it', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2'), rcpt('3')], config(), draft('x'));
    const calls: string[] = [];
    const out = await runBulk(plan, draft('x'), async (id): Promise<SendResult> => {
      calls.push(id);
      return id === '2' ? { ok: false, reason: 'rate', retry_after_s: 60 } : { ok: true, sent_at: 't' };
    });
    expect(calls).toEqual(['1', '2']);
    expect(out.sent).toEqual(['1']);
    expect(out.failed).toEqual([{ id: '2', reason: 'rate' }, { id: '3', reason: 'rate' }]);
  });

  test('a send that throws is uncertain, never retried', async () => {
    const plan = bulkPlan([rcpt('1'), rcpt('2')], config(), draft('x'));
    let n = 0;
    const out = await runBulk(plan, draft('x'), async () => {
      n++;
      throw new Error('boom');
    });
    expect(n).toBe(2);
    expect(out.failed).toEqual([{ id: '1', reason: 'uncertain' }, { id: '2', reason: 'uncertain' }]);
  });
});

test.describe('the draft contract: server error codes -> what the dialog says', () => {
  const err = (status: number, code: string, details: Record<string, unknown> = {}) => new ApiError(status, { code, user_message: 'x', retryable: false, correlation_id: '', details });

  test('known codes', () => {
    expect(sendFailureOf(err(422, 'message_no_phone')).reason).toBe('no_phone');
    expect(sendFailureOf(err(409, 'message_no_consent')).reason).toBe('no_consent');
    expect(sendFailureOf(err(503, 'message_service_unavailable')).reason).toBe('no_service');
    expect(sendFailureOf(err(502, 'message_not_registered')).reason).toBe('not_registered');
    expect(sendFailureOf(err(429, 'message_rate_limited', { retry_after_s: 840 }))).toEqual({ reason: 'rate', retry_after_s: 840 });
    expect(sendFailureOf(err(422, 'message_forbidden_content')).reason).toBe('credential');
    expect(sendFailureOf(err(403, 'message_free_text_disabled')).reason).toBe('free_text_off');
    expect(sendFailureOf(err(410, 'message_expired')).reason).toBe('expired');
  });

  test('anything else: a server fault or a dropped connection is uncertain (no blind retry); a refusal we do not know is unknown', () => {
    expect(sendFailureOf(err(500, 'oops')).reason).toBe('uncertain');
    expect(sendFailureOf(err(504, 'gateway')).reason).toBe('uncertain');
    expect(sendFailureOf(err(422, 'something_new')).reason).toBe('unknown');
    expect(sendFailureOf(new TypeError('network')).reason).toBe('uncertain');
  });
});
