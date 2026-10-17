/**
 * CR-RFQ-PAYMENT-SCHEDULE (RFQ contract section 20): the vendor page's two new blocks - the OPTIONAL proposed payment schedule inside
 * the quote form, and, once HIS quote was approved, the approved schedule with the arrival confirmation (confirm the planned date or
 * propose another, acknowledging the schedule). Part of the RFQ chunk (the file name keeps it under the `rfq-page` budget; a ticket
 * link never loads it). Existing classes only (claim.css / rfq.css): the shared style sheet counts against the ticket page's budget.
 * Amounts are the SERVER's (the approved schedule); the form sends decimal strings and plain dates only, never a computed figure.
 */
import type { RfqTerms, RfqView } from '../api';
import { h } from '../dom';
import { dayStartIso, isoToDay, newPay, newPayItem, type FinalDue, type PayDraft, type PayItemDraft, type RfqDraft } from './rfq-state';

export interface TermsHost {
  t(key: string, vars?: Record<string, string | number>): string;
  money(minor: number, currency: string): string;
  totalLabel(): string;
  day(iso: string | null | undefined): string;
  busy: boolean;
  keep(): void;
  render(): void;
}

/** The arrival part of the page's state (kept by the page between renders). */
export interface ArrivalUi { ack: boolean; open: boolean; from: string; to: string }

const plainDay = (d: string | null | undefined): string => (d ? d.split('-').reverse().join('.') : '');

function dueText(host: TermsHost, due: string, date: string | null | undefined, days: number | string | null | undefined): string {
  if (due === 'date') return plainDay(date);
  if (due === 'after_completion') return host.t('payAfterN', { n: String(days ?? 0) });
  return host.t('payOnDone');
}

const KIND_KEY = { advance: 'payAdvance', progress: 'payProgress', final: 'payFinal' } as const;
// RFQPAY2 (contract 20.13 / 20.14): the marker of an instalment date or the arrival window a manager moved after the award. Kept in THIS lazy chunk (own 3 KB budget), not in
// rfq-text.ts: the rfq-page chunk has almost no budget left. ar / ru: developer translations, pending a native review like the page.
const MOVED: Record<string, string> = { he: 'המועד עודכן', en: 'date changed', ar: 'تم تغيير الموعد', ru: 'дата изменена' };
export const movedLabel = (lang: string): string => MOVED[lang] ?? MOVED.he;

// ---------------------------------------------------------------- the proposal inside the quote form

export function payEditor(host: TermsHost, d: RfqDraft, v: RfqView): HTMLElement | null {
  const cfg = v.form?.payment;
  if (!cfg) return null;
  if (!d.pay) {
    return h('div', { class: 'swc-row' }, h('button', { class: 'swc-btn swc-small', attrs: { type: 'button', 'data-rfq-pay-add': true },
      on: { click: () => { d.pay = newPay(); host.keep(); host.render(); } } }, host.t('payAdd')));
  }
  const p: PayDraft = d.pay;
  const today = isoToDay(new Date().toISOString(), v.time_zone);
  const box = h('div', { class: 'swc-card', attrs: { 'data-rfq-pay': p.items.length + 1 } },
    h('h3', { class: 'swc-sub' }, host.t('pay')), h('p', { class: 'swc-muted' }, host.t('payNote')));
  const input = (value: string, attrs: Record<string, string | boolean>, set: (x: string) => void, type = 'text') => {
    const el = h('input', { class: 'swc-input', attrs: { type, dir: 'ltr', ...(type === 'text' ? { inputmode: 'decimal', autocomplete: 'off' } : {}), ...attrs },
      on: { change: (e) => { set((e.target as HTMLInputElement).value); host.keep(); } } });
    el.value = value;
    return el;
  };
  p.items.forEach((it: PayItemDraft, i) => {
    const seg = h('div', { class: 'swc-seg', attrs: { role: 'radiogroup' } });
    for (const mode of ['percent', 'amount'] as const) {
      seg.appendChild(h('button', { class: 'swc-seg-btn', attrs: { type: 'button', role: 'radio', 'aria-checked': String(it.mode === mode), 'data-rfq-pay-mode': `${i}:${mode}` },
        on: { click: () => { it.mode = mode; host.keep(); host.render(); } } }, host.t(mode === 'percent' ? 'payPercent' : 'payAmount')));
    }
    box.appendChild(h('div', { class: 'swc-line', attrs: { 'data-rfq-pay-item': it.kind } },
      h('div', { class: 'swc-line-top' }, h('span', { class: 'swc-label' }, host.t(KIND_KEY[it.kind])), seg,
        h('button', { class: 'swc-btn swc-icon', attrs: { type: 'button', 'aria-label': host.t('cancel'), 'data-rfq-pay-remove': i },
          on: { click: () => { p.items.splice(i, 1); host.keep(); host.render(); } } }, '✕')),
      h('div', { class: 'swc-nums' },
        h('label', { class: 'swc-field swc-num' }, h('span', { class: 'swc-label' }, host.t(it.mode === 'percent' ? 'payPercent' : 'payAmount')),
          input(it.value, { 'data-rfq-pay-value': String(i) }, (x) => { it.value = x; })),
        h('label', { class: 'swc-field swc-num' }, h('span', { class: 'swc-label' }, host.t('payDate')),
          input(it.date, { 'data-rfq-pay-date': String(i), min: today }, (x) => { it.date = x; }, 'date')))));
  });
  const add = h('div', { class: 'swc-row swc-add' });
  if (p.items.length + 1 < cfg.max_items) {
    if (!p.items.some((x) => x.kind === 'advance')) {
      add.appendChild(h('button', { class: 'swc-btn swc-small', attrs: { type: 'button', 'data-rfq-pay-advance': true },
        on: { click: () => { p.items.unshift(newPayItem('advance')); host.keep(); host.render(); } } }, `+ ${host.t('payAdvance')}`));
    }
    add.appendChild(h('button', { class: 'swc-btn swc-small', attrs: { type: 'button', 'data-rfq-pay-progress': true },
      on: { click: () => { p.items.push(newPayItem('progress')); host.keep(); host.render(); } } }, host.t('payAddProgress')));
  }
  box.appendChild(add);
  const sel = h('select', { class: 'swc-input', attrs: { 'aria-label': host.t('payFinal'), 'data-rfq-pay-due': p.due },
    on: { change: (e) => { p.due = (e.target as HTMLSelectElement).value as FinalDue; host.keep(); host.render(); } } });
  for (const [due, key] of [['completion', 'payOnDone'], ['date', 'payOnDate'], ['after_completion', 'payAfter']] as const) {
    sel.appendChild(h('option', { attrs: { value: due, selected: p.due === due } }, host.t(key)));
  }
  const fin = h('div', { class: 'swc-nums' }, h('label', { class: 'swc-field swc-num' }, h('span', { class: 'swc-label' }, `${host.t('payFinal')} · ${host.t('payRest')}`), sel));
  if (p.due === 'date') fin.appendChild(h('label', { class: 'swc-field swc-num' }, h('span', { class: 'swc-label' }, host.t('payDate')),
    input(p.date, { 'data-rfq-pay-final-date': true, min: today }, (x) => { p.date = x; }, 'date')));
  if (p.due === 'after_completion') fin.appendChild(h('label', { class: 'swc-field swc-num' }, h('span', { class: 'swc-label' }, host.t('payAfter')),
    input(p.days, { 'data-rfq-pay-days': true, inputmode: 'numeric', maxlength: '3' }, (x) => { p.days = x.trim(); })));
  box.appendChild(h('div', { class: 'swc-line', attrs: { 'data-rfq-pay-item': 'final' } }, fin));
  box.appendChild(h('div', { class: 'swc-row' }, h('button', { class: 'swc-btn swc-small', attrs: { type: 'button', 'data-rfq-pay-drop': true },
    on: { click: () => { d.pay = null; host.keep(); host.render(); } } }, host.t('cancel'))));
  return box;
}

// ---------------------------------------------------------------- the approved terms and the arrival confirmation

export function termsCard(host: TermsHost, v: RfqView, ui: ArrivalUi, act: (action: 'confirm' | 'propose') => void): HTMLElement | null {
  const terms: RfqTerms | null | undefined = v.terms;
  if (!terms) return null;
  const s = terms.schedule;
  const a = terms.arrival;
  const list = h('ul', { class: 'swc-rev-lines' });
  for (const it of s.items) {
    list.appendChild(h('li', { class: 'swc-rev-line', attrs: { 'data-rfq-terms-item': it.kind } },
      h('span', { class: 'swc-rev-what' }, `${host.t(KIND_KEY[it.kind])} - ${dueText(host, it.due, it.date, it.days)}`,
        it.date_changed ? h('small', { class: 'swc-muted', attrs: { 'data-rfq-terms-moved': true } }, ` (${movedLabel(v.lang)})`) : null),
      h('span', { class: 'swc-amount', attrs: { dir: 'ltr' } }, host.money(it.amount_minor, s.currency))));
  }
  const planned = a.planned_from ? [host.day(a.planned_from), a.planned_to && a.planned_to !== a.planned_from ? host.day(a.planned_to) : ''].filter(Boolean).join(' – ') : host.t('termsNone');
  const proposed = a.proposed_from ? [host.day(a.proposed_from), a.proposed_to ? host.day(a.proposed_to) : ''].filter(Boolean).join(' – ') : '';
  const banner = a.state === 'confirmed' ? ['ok', 'termsConfirmed'] : a.state === 'proposed' ? ['info', 'termsProposed'] : a.rejected ? ['bad', 'termsRejected'] : null;
  const card = h('section', { class: 'swc swq', attrs: { 'data-rfq-terms': a.state } },
    h('header', { class: 'swc-head' }, h('h2', { class: 'swc-title' }, host.t('termsTitle'))),
    banner ? h('div', { class: `banner ${banner[0]}`, attrs: { role: 'status', 'data-rfq-terms-state': banner[1] } }, host.t(banner[1])) : null,
    h('div', { class: 'rfq-fact', attrs: { 'data-rfq-terms-planned': true } }, h('span', { class: 'lbl' }, host.t('termsArrival')), h('span', { class: 'val' }, planned,
      a.changed ? h('small', { class: 'swc-muted', attrs: { 'data-rfq-terms-arrival-moved': true } }, ` (${movedLabel(v.lang)})`) : null)),
    proposed ? h('div', { class: 'rfq-fact' }, h('span', { class: 'lbl' }, host.t('termsPropose')), h('span', { class: 'val' }, proposed)) : null,
    h('h3', { class: 'swc-sub' }, host.t('termsSchedule')), list,
    h('div', { class: 'swc-total-row swc-grand' }, h('span', null, host.totalLabel()), h('span', { class: 'swc-amount', attrs: { dir: 'ltr' } }, host.money(s.total_minor, s.currency))));
  if (!terms.can.confirm && !terms.can.propose) return card;
  const box = h('input', { attrs: { type: 'checkbox', 'data-rfq-terms-ack': true }, on: { change: (e) => { ui.ack = (e.target as HTMLInputElement).checked; host.render(); } } });
  (box as HTMLInputElement).checked = ui.ack;
  card.appendChild(h('label', { class: 'swc-check' }, box, h('span', null, host.t('termsAck'))));
  const actions = h('div', { class: 'swc-row swc-actions' },
    terms.can.confirm ? h('button', { class: 'swc-btn swc-primary', attrs: { type: 'button', disabled: host.busy || !ui.ack, 'data-rfq-arrival-confirm': true },
      on: { click: () => act('confirm') } }, host.t('termsConfirm')) : null,
    terms.can.propose ? h('button', { class: 'swc-btn', attrs: { type: 'button', 'aria-pressed': String(ui.open), 'data-rfq-arrival-propose': true },
      on: { click: () => { ui.open = !ui.open; host.render(); } } }, host.t('termsPropose')) : null);
  card.appendChild(actions);
  if (ui.open && terms.can.propose) {
    const today = isoToDay(new Date().toISOString(), v.time_zone);
    const date = (key: 'from' | 'to', label: string) => {
      const el = h('input', { class: 'swc-input', attrs: { type: 'date', dir: 'ltr', min: today, [`data-rfq-arrival-${key}`]: true },
        on: { change: (e) => { ui[key] = (e.target as HTMLInputElement).value; host.render(); } } });
      el.value = ui[key];
      return h('label', { class: 'swc-field swc-num' }, h('span', { class: 'swc-label' }, host.t(label)), el);
    };
    card.appendChild(h('div', { class: 'swc-nums' }, date('from', 'from'), date('to', 'to')));
    card.appendChild(h('div', { class: 'swc-row swc-actions' }, h('button', { class: 'swc-btn swc-primary',
      attrs: { type: 'button', disabled: host.busy || !ui.ack || !ui.from || (!!ui.to && ui.to < ui.from), 'data-rfq-arrival-send': true },
      on: { click: () => act('propose') } }, host.t('termsSend'))));
  }
  return card;
}

/** The body of POST /t/api/rfq/arrival (contract 20.5): the action, the dates as the start of the day in the building's zone. */
export function arrivalWire(action: 'confirm' | 'propose', ui: ArrivalUi, zone: string): Record<string, unknown> {
  const body: Record<string, unknown> = { action, acknowledge_schedule: ui.ack };
  if (action === 'propose') {
    body.work_from = dayStartIso(ui.from, zone);
    if (ui.to) body.work_to = dayStartIso(ui.to, zone);
  }
  return body;
}
