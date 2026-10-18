/**
 * CR-CLAIM-PREFILL (docs/changes/CR-CLAIM-PREFILL.md): the payment demand LOADED from the vendor's approved quote - a lazy chunk the claim
 * step fetches only when GET /t/api/claim carries `prefill` (an approved quote on the link's own assignment). Its own gzip cap in the
 * bundle guards (`claim-prefill-*`); the ticket page and the claim step do not grow.
 *
 * What it adds to the step: the form starts from the approved lines (or from ONE instalment of the approved payment schedule - the one a
 * manager opened a demand for is pre-selected), the approved amount next to the totals with the difference, and - only when the demand
 * is ABOVE the approved total / instalment - a short reason field (the server refuses the demand without it: `above_reason` `required`).
 * Every field stays editable; a different demand is accepted and flagged for the manager. No bank data anywhere.
 *
 * Rendering rules as the step (spec 16): text through `textContent` only, no innerHTML, no style attributes - claim.css classes only.
 */
import {
  type ClaimForm,
  type ClaimFormSettings,
  type ClaimInfo,
  type ClaimPayload,
  type FieldError,
  type LineDraft,
  type LineKind,
  type Revision,
  cleanText,
  computeForm,
  formFromRevision,
  formatMoney,
  minorToInput,
  newLine,
  textLength,
} from './claim-model';

type Key = 'inst' | 'whole' | 'advance' | 'progress' | 'final' | 'approved' | 'approved_inst' | 'vs' | 'reason' | 'earlier' | 'done' | 'sent';

// ar / ru: developer translations, pending a native review like the rest of the page
const TEXT: Record<'he' | 'en' | 'ar' | 'ru', Record<Key, string>> = {
  he: {
    inst: 'עבור איזה תשלום',
    whole: 'כל ההצעה המאושרת',
    advance: 'מקדמה',
    progress: 'תשלום ביניים',
    final: 'תשלום סופי',
    approved: 'ההצעה המאושרת: {amount}',
    approved_inst: 'התשלום המאושר: {amount}',
    vs: 'הפרש מהמאושר: {delta}',
    reason: 'סיבה לסכום גבוה מהמאושר',
    earlier: '{what}: {amount} ({state})',
    done: 'אושר',
    sent: 'הוגש',
  },
  en: {
    inst: 'Which payment',
    whole: 'The whole approved quote',
    advance: 'Advance',
    progress: 'Progress payment',
    final: 'Final payment',
    approved: 'Approved quote: {amount}',
    approved_inst: 'Approved payment: {amount}',
    vs: 'Difference from the approved amount: {delta}',
    reason: 'Reason for an amount above the approved one',
    earlier: '{what}: {amount} ({state})',
    done: 'approved',
    sent: 'submitted',
  },
  ar: {
    inst: 'عن أي دفعة',
    whole: 'كامل العرض المعتمد',
    advance: 'دفعة مقدمة',
    progress: 'دفعة مرحلية',
    final: 'دفعة نهائية',
    approved: 'العرض المعتمد: {amount}',
    approved_inst: 'الدفعة المعتمدة: {amount}',
    vs: 'الفرق عن المبلغ المعتمد: {delta}',
    reason: 'سبب مبلغ أعلى من المعتمد',
    earlier: '{what}: {amount} ({state})',
    done: 'تمت الموافقة',
    sent: 'قُدّمت',
  },
  ru: {
    inst: 'За какой платёж',
    whole: 'Всё одобренное предложение',
    advance: 'Аванс',
    progress: 'Промежуточный платёж',
    final: 'Окончательный платёж',
    approved: 'Одобренное предложение: {amount}',
    approved_inst: 'Одобренный платёж: {amount}',
    vs: 'Разница с одобренной суммой: {delta}',
    reason: 'Причина суммы выше одобренной',
    earlier: '{what}: {amount} ({state})',
    done: 'одобрено',
    sent: 'подано',
  },
};

export interface PrefillHost {
  lang: string;
  info: () => ClaimInfo | null;
  settings: () => ClaimFormSettings | null;
  form: () => ClaimForm;
  /** replace the form (an instalment was picked) - the step stores the draft and renders again */
  set: (f: ClaimForm) => void;
  /** the step's error slot for a field (painted by the step's own error pass) */
  slot: (field: string) => HTMLElement;
  /** a field changed: the step re-validates when errors are shown */
  changed: () => void;
}

export interface PrefillExt {
  /** the form a fresh demand starts from */
  form(): ClaimForm;
  /** under the totals: the instalment choice, the approved amount with the difference, the reason when above */
  paint(host: HTMLElement): void;
  /** "against the approved ..." under a read-only revision (null in another currency) */
  delta(rev: Revision): HTMLElement | null;
  /** the client-side check the server repeats (`above_reason` required / too long) */
  check(errors: FieldError[]): void;
  /** the body's extra fields */
  payload(body: ClaimPayload): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function attach(h: PrefillHost): PrefillExt {
  const tx = TEXT[(h.lang in TEXT ? h.lang : 'he') as keyof typeof TEXT];
  const t = (k: Key, vars: Record<string, string> = {}) => tx[k].replace(/\{(\w+)\}/g, (_m, v: string) => vars[v] ?? '');
  const pre = () => h.info()?.prefill ?? null;
  const last = (): Revision | null => {
    const revs = h.info()?.revisions ?? [];
    return revs.length ? revs[revs.length - 1] : null;
  };
  const money = (minor: number, currency: string) => formatMoney(minor, currency, h.lang);
  // the vendor's last choice (a correction keeps it), else the instalment a manager opened a demand for
  let inst: number | null = last()?.basis?.instalment_index ?? pre()?.instalment ?? null;
  let reason = last()?.basis?.above_reason ?? '';

  // 0116: a claim bound to an instalment keeps it, whatever the page chose before
  const cur = (): number | null => (h.info()?.instalment_fixed ? h.info()?.instalment_index ?? inst : inst);
  const item = () => {
    const i = cur();
    return i === null ? null : pre()?.instalments.find((x) => x.index === i) ?? null;
  };
  const basis = (): number | null => item()?.amount_minor ?? pre()?.total_minor ?? null;

  /** ONE line of the approved amount, of a kind the quote has (so it is never an exceptional line); schedule amounts include VAT. */
  function instalmentForm(amount: number, kind: string): ClaimForm {
    const p = pre()!;
    const s = h.settings();
    const k: LineKind = (p.lines[0]?.kind as LineKind) || 'labor';
    const ln: LineDraft = newLine(k, null);
    ln.description = tx[kind as Key] ?? '';
    const v = minorToInput(amount);
    if (k === 'labor') {
      ln.hours = '1';
      ln.rate = v;
    } else if (k === 'parts') {
      ln.quantity = '1';
      ln.unit_price = v;
    } else ln.amount = v;
    return { lines: [ln], currency: p.currency, include_vat: !s?.vat.exempt, no_charge: false, vendor_ref: '', notes: '' };
  }

  function fresh(): ClaimForm {
    const it = item();
    return it ? instalmentForm(it.amount_minor, it.kind) : formFromRevision(pre()!, h.settings());
  }

  /** the demand's total when it can be compared with the basis (complete, same currency, not "no charge") */
  function above(): boolean {
    const f = h.form();
    const p = pre();
    const b = basis();
    if (!p || b === null || f.no_charge || f.currency !== p.currency) return false;
    const fig = computeForm(f, h.settings());
    return fig.complete && fig.total > b;
  }

  function deltaLine(total: number, currency: string, b: number): HTMLElement {
    const d = total - b;
    const p = el('p', d > 0 ? 'swc-muted swc-delta swc-up' : 'swc-muted swc-delta', t('vs', { delta: `${d > 0 ? '+' : ''}${money(d, currency)}` }));
    p.dataset.quoteDelta = String(d);
    return p;
  }

  return {
    form() {
      // a new form (0116: possibly the NEXT instalment's claim): the choice and the reason come from the claim now on the page
      inst = last()?.basis?.instalment_index ?? pre()?.instalment ?? null;
      reason = last()?.basis?.above_reason ?? '';
      return fresh();
    },
    paint(host) {
      const p = pre();
      const b = basis();
      if (!p || b === null) return;
      const f = h.form();
      const info = h.info();
      // 0116: his other demands of this assignment (one per instalment) - what was already asked, and its state
      for (const c of info?.claims ?? []) {
        const it = p.instalments.find((x) => x.index === c.instalment_index);
        if (c.total_minor !== null) host.prepend(el('p', 'swc-muted', t('earlier', { what: it ? tx[it.kind] : t('whole'), amount: money(c.total_minor, c.currency), state: t(c.status === 'approved' || c.status === 'paid' ? 'done' : 'sent') })));
      }
      if (p.instalments.length && !info?.instalment_fixed) {
        const lab = el('label', 'swc-field');
        lab.appendChild(el('span', 'swc-label', t('inst')));
        const sel = el('select', 'swc-input');
        sel.dataset.prefillInstalment = '';
        const opt = (value: string, text: string, on: boolean) => {
          const o = el('option', '', text);
          o.value = value;
          o.selected = on;
          sel.appendChild(o);
        };
        opt('', `${t('whole')} - ${money(p.total_minor, p.currency)}`, inst === null);
        for (const it of p.instalments) {
          if (it.amount_minor > 0) opt(String(it.index), `${tx[it.kind]} - ${money(it.amount_minor, p.currency)}${it.due_date ? ` (${it.due_date})` : ''}`, inst === it.index);
        }
        sel.addEventListener('change', () => {
          inst = sel.value === '' ? null : Number(sel.value);
          h.set(fresh());
        });
        lab.appendChild(sel);
        host.prepend(lab);
      }
      const ref = el('p', 'swc-muted', t(item() ? 'approved_inst' : 'approved', { amount: money(b, p.currency) }));
      ref.dataset.prefillApproved = String(b);
      host.appendChild(ref);
      const fig = computeForm(f, h.settings());
      if (fig.complete && !f.no_charge && f.currency === p.currency) host.appendChild(deltaLine(fig.total, f.currency, b));
      if (above()) {
        const lab = el('label', 'swc-field');
        lab.appendChild(el('span', 'swc-label', t('reason')));
        const input = el('input', 'swc-input');
        input.type = 'text';
        input.value = reason;
        input.maxLength = 1000;
        input.dataset.prefillReason = '';
        input.addEventListener('input', () => {
          reason = input.value;
          h.changed();
        });
        lab.appendChild(input);
        const slot = h.slot('above_reason');
        input.setAttribute('aria-describedby', slot.id);
        lab.appendChild(slot);
        host.appendChild(lab);
      }
    },
    delta(rev) {
      const p = pre();
      const b = rev.basis?.basis_minor ?? p?.total_minor;
      if (!p || b === undefined || rev.currency !== p.currency) return null;
      return deltaLine(rev.total_minor, rev.currency, b);
    },
    check(errors) {
      if (!above()) return;
      const r = cleanText(reason);
      if (!r) errors.push({ field: 'above_reason', code: 'required' });
      else if (textLength(r) > 500) errors.push({ field: 'above_reason', code: 'too_long' });
    },
    payload(body) {
      const f = h.form();
      const i = cur();
      if (i !== null && !f.no_charge) body.instalment_index = i;
      const r = cleanText(reason);
      if (r && above()) body.above_reason = r;
    },
  };
}
