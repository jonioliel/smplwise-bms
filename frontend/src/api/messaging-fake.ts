/**
 * CR-036 S7 / WA: the message dialog's client for the STATIC PREVIEW only (no backend) - a fake, named so. The real client is
 * api/access-messaging.ts (`createHttpTransport`, the typed routes); this one never leaves the page: scripted people, a small allowance,
 * deterministic outcomes, an in-memory history. It exists so the dialog can be looked at and screenshotted without a server.
 */
import { maskPhone } from '../access-control/people-logic';
import type { MessageDraft, MessageHistoryItem, MessagingConfig, MessagingTransport, PersonMessages, RecipientInfo, SendContext, SendResult } from '../access-control/messaging-logic';

interface DemoRecipient {
  name: string;
  phone: string | null;
  consent: RecipientInfo['consent'];
  unregistered?: boolean;
}

/** People of the static preview (the ids of the screen's demo page). Invented numbers in the documentation range. */
const DEMO_RECIPIENTS: Record<string, DemoRecipient> = {
  p1: { name: 'דנה כהן', phone: '050-000-0001', consent: 'granted' },
  p2: { name: 'יוסי לוי', phone: '050-000-0002', consent: 'granted' },
  p3: { name: 'מאיה כץ', phone: null, consent: 'unknown' },
  p4: { name: 'אורן ברק', phone: '050-000-0004', consent: 'declined' },
  p5: { name: 'נועה שלו', phone: '050-000-0005', consent: 'unknown', unregistered: true },
};

const DEMO_TEMPLATES = [
  { id: 'card_ready', label: 'כרטיס מוכן', body: 'שלום {name}, כרטיס הכניסה שלך מוכן לאיסוף במשרד.' },
  { id: 'validity_reminder', label: 'תזכורת תוקף', body: 'שלום {name}, תוקף הכניסה שלך מסתיים בקרוב. נא לפנות למשרד.' },
  { id: 'closure', label: 'הכניסה סגורה', body: 'שלום {name}, הכניסה לחניון סגורה היום בין 12:00 ל־14:00.' },
];

export function createFakeDemoTransport(delayMs = 350): MessagingTransport {
  const quota = { limit: 6, used: 0, resets_in_s: 1800 };
  const history = new Map<string, MessageHistoryItem[]>();
  const optOut = new Map<string, { at: string; by: string | null }>();
  const config = (): MessagingConfig => ({
    feature: true, enabled: true, can_send: true, can_reveal_phone: true, free_text: true, bulk_max: 20, text_max: 1000, templates: DEMO_TEMPLATES.map((t) => ({ ...t })),
    templates_revision: 1, quota: { ...quota }, pace_ms: 0,
  });
  const wait = () => new Promise<void>((r) => setTimeout(r, delayMs));
  const consentOf = (id: string): PersonMessages['consent'] => (optOut.has(id) ? 'declined' : DEMO_RECIPIENTS[id]?.consent ?? 'unknown');
  return {
    async config() {
      return config();
    },
    async recipients(ids) {
      return ids.map((id) => {
        const d = DEMO_RECIPIENTS[id];
        return { person_id: id, name: d?.name ?? id, phone_masked: d?.phone ? maskPhone(d.phone) : null, has_phone: d ? d.phone !== null : false, consent: consentOf(id), allowed: true };
      });
    },
    async send(id: string, draft: MessageDraft, ctx: SendContext): Promise<SendResult> {
      await wait();
      const d = DEMO_RECIPIENTS[id];
      if (!d?.phone) return { ok: false, reason: 'no_phone' };
      if (consentOf(id) === 'declined') return { ok: false, reason: 'no_consent' };
      if (quota.used >= quota.limit) return { ok: false, reason: 'rate', retry_after_s: quota.resets_in_s };
      if (d.unregistered) return { ok: false, reason: 'not_registered' };
      if (!draft.text.trim()) return { ok: false, reason: 'empty' };
      quota.used += 1;
      const at = new Date().toISOString();
      const template = DEMO_TEMPLATES.find((t) => t.id === draft.template_id);
      history.set(id, [{ id: `demo-${id}-${quota.used}`, at, by: 'בודק', kind: draft.template_id ? 'template' : 'free', template_id: draft.template_id, template_label: template?.label ?? null, outcome: 'sent', reason: null, bulk: !!ctx.bulk }, ...(history.get(id) ?? [])]);
      return { ok: true, sent_at: at, quota: { ...quota } };
    },
    async history(id) {
      return { messages: history.get(id) ?? [], opt_out: optOut.get(id) ?? null, consent: consentOf(id) };
    },
    async setOptOut(id, optedOut) {
      if (optedOut) optOut.set(id, { at: new Date().toISOString(), by: 'בודק' });
      else optOut.delete(id);
      return { opt_out: optOut.get(id) ?? null, consent: consentOf(id) };
    },
  };
}
