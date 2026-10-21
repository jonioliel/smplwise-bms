/**
 * GRANTS3-295 (CR-ARX-WISKEY-SHARED-IDENTITY section 5): the arrival step on the vendor's handler page - "who arrives, when" - as a lazy
 * chunk (`arrival-card-*`), fetched only when the ticket answer says `arrival: true` (an RFQ work order, or a regular assignment the
 * manager ticked "access needed", with the external-access feature on). It can only create a REQUEST: a manager approves it.
 *
 * After the approval the card shows the approved doors (names), the dates and hours and, for a personal code, when it goes by WhatsApp
 * and to which number (····NN) - never the code itself (the page never has it; the server does not hold it either). The privacy notice is
 * the server's text in the vendor's language. Text only through dom.ts `h` (text nodes); no link is ever built.
 */
import cssUrl from './arrival-card.css?url'; // its own stylesheet file (cssCodeSplit is off: an import would grow the ticket page's CSS)
import { h, icon } from '../dom';
import type { Lang } from '../strings';
import { at, type ArrivalKey } from './arrival-text';
import { bodyOf, codeKey, ltr, draftProblem, firstDraft, outsideWindow, refusalKey, shortDay, type ArrivalDraft, type ArrivalView } from './arrival-model';

export interface ArrivalHost {
  fetchJson(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<{ status: number; body: unknown }>;
  lang: Lang;
  zone: string;
  newRequestId(): string;
}

export interface ArrivalHandle { element: HTMLElement; refresh(): Promise<void>; setLang(lang: Lang): void }

function todayIn(zone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

class ArrivalCard {
  readonly element: HTMLElement;
  private view: ArrivalView | null = null;
  private draft: ArrivalDraft | null = null;
  private editing = false;
  private busy = false;
  private error: ArrivalKey | null = null;
  private crid: string | null = null;

  constructor(private host: ArrivalHost) {
    this.element = h('section', { class: 'card arrival', attrs: { 'data-arrival': 'loading', 'aria-busy': 'true' } });
  }

  setLang(lang: Lang): void {
    this.host.lang = lang;
    this.render();
  }

  private t(key: ArrivalKey, vars: Record<string, string | number> = {}): string {
    return at(this.host.lang, key, vars);
  }

  async refresh(): Promise<void> {
    const a = await this.host.fetchJson('/t/api/arrival');
    if (a.status !== 200 || !a.body || typeof a.body !== 'object') {
      this.view = null;
      this.element.hidden = true; // switched off / no longer available: the card leaves the page (the uniform 404)
      return;
    }
    this.element.hidden = false;
    this.view = a.body as ArrivalView;
    if (!this.draft || !this.editing) this.draft = firstDraft(this.view, todayIn(this.host.zone));
    this.render();
  }

  private async send(): Promise<void> {
    const v = this.view;
    const d = this.draft;
    if (!v || !d || this.busy) return;
    const problem = draftProblem(d, v, todayIn(this.host.zone));
    if (problem) {
      this.error = problem;
      this.render();
      return;
    }
    this.busy = true;
    this.error = null;
    this.crid = this.crid ?? this.host.newRequestId(); // kept until answered: a retry on bad reception never requests twice
    this.render();
    const r = await this.host.fetchJson('/t/api/arrival', { method: 'POST', body: bodyOf(d, v, this.crid) });
    this.busy = false;
    if (r.status === 200) {
      this.crid = null;
      this.editing = false;
      await this.refresh();
      return;
    }
    if (r.status !== 0) this.crid = null;
    const code = r.body && typeof r.body === 'object' ? (r.body as { code?: string }).code : undefined;
    this.error = refusalKey(r.status, code);
    this.render();
  }

  private set(patch: Partial<ArrivalDraft>, again = false): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, ...patch };
    this.error = null;
    if (again) this.render();
  }

  private render(): void {
    const v = this.view;
    this.element.removeAttribute('aria-busy');
    if (!v) {
      this.element.replaceChildren();
      return;
    }
    const head = h('h2', null, icon('lock'), this.t('title'));
    const cur = v.current;
    if (cur && !this.editing) {
      this.element.dataset.arrival = cur.state;
      this.element.replaceChildren(head, ...this.status(v).filter((n): n is Node => n !== null));
      return;
    }
    this.element.dataset.arrival = 'form';
    this.element.replaceChildren(head, ...this.form(v).filter((n): n is Node => n !== null));
  }

  private status(v: ArrivalView): (Node | null)[] {
    const cur = v.current!;
    const out: (Node | null)[] = [];
    if (cur.state === 'waiting') {
      out.push(h('div', { class: 'arr-state wait', attrs: { role: 'status', 'data-arrival-state': 'waiting' } }, icon('clock'),
        h('div', null, h('b', null, this.t('waiting')), h('small', { attrs: { dir: 'auto' } }, ltr(this.t('waitingFor', { person: cur.person }))))));
    } else if (cur.state === 'ending') {
      out.push(h('div', { class: 'arr-state', attrs: { role: 'status', 'data-arrival-state': 'ending' } }, icon('out'), h('b', null, this.t('ending'))));
    } else if (cur.access) {
      const a = cur.access;
      out.push(h('div', { class: 'arr-state ok', attrs: { role: 'status', 'data-arrival-state': 'approved' } }, icon('done'),
        h('div', null, h('b', null, this.t('approved')), h('small', { attrs: { dir: 'auto' } }, ltr(cur.person)))));
      const dates = a.from === a.to ? shortDay(a.from) : `${shortDay(a.from)} – ${shortDay(a.to)}`;
      out.push(h('dl', { class: 'arr-facts' },
        h('dt', null, this.t('doors')), h('dd', { attrs: { 'data-arrival-doors': true } }, ...a.doors.map((d) => h('span', { class: 'arr-door', attrs: { dir: 'auto' } }, icon('pin'), d))),
        h('dt', null, this.t('dates')), h('dd', { attrs: { dir: 'ltr' } }, dates),
        h('dt', null, this.t('hours')), h('dd', { attrs: { dir: 'ltr' } }, a.hours ?? this.t('allDay'))));
      const key = codeKey(a);
      if (key) {
        const tone = key === 'codeFailed' ? 'bad' : key === 'codeSent' || key === 'cardReady' ? 'ok' : 'info';
        out.push(h('p', { class: `arr-code ${tone}`, attrs: { 'data-arrival-code': a.code?.state ?? a.card?.state ?? '' } },
          icon(key === 'codeFailed' ? 'alert' : 'send'),
          h('span', null, ltr(this.t(key, { to: a.code?.to ?? '', at: shortDay(a.code?.at ?? null) })))));
      }
    }
    if (cur.pending_change) out.push(h('p', { class: 'muted small', attrs: { 'data-arrival-pending': true } }, this.t('pendingChange')));
    if (cur.state === 'waiting' || cur.state === 'approved') {
      out.push(h('button', { class: 'btn ghost', attrs: { type: 'button', 'data-arrival-change': true },
        on: { click: () => { this.editing = true; this.draft = firstDraft(v, todayIn(this.host.zone)); this.render(); } } }, this.t('change')));
    }
    return out;
  }

  private form(v: ArrivalView): (Node | null)[] {
    const d = this.draft!;
    const persons = h('div', { class: 'pills arr-persons', attrs: { role: 'radiogroup', 'aria-label': this.t('who') } });
    const pick = (id: string, label: string) => persons.appendChild(h('button', { class: `pill ${d.personId === id ? 'on' : ''}`,
      attrs: { type: 'button', role: 'radio', 'aria-checked': String(d.personId === id), 'data-arrival-person': id, dir: 'auto' },
      on: { click: () => this.set({ personId: id }, true) } }, ltr(label)));
    for (const p of v.persons) pick(p.id, p.label);
    if (v.can_add) pick('new', this.t('addNew'));
    const fresh = d.personId === 'new' ? h('div', { class: 'arr-new' },
      h('label', { class: 'field' }, h('span', null, this.t('newName')), h('input', { class: 'input', attrs: { type: 'text', maxlength: 60, autocomplete: 'off', dir: 'auto',
        'data-arrival-new-name': true, value: d.newName }, on: { input: (e) => this.set({ newName: (e.target as HTMLInputElement).value }) } })),
      h('label', { class: 'field' }, h('span', null, this.t('newPhone')), h('input', { class: 'input', attrs: { type: 'tel', maxlength: 20, autocomplete: 'off', dir: 'ltr',
        inputmode: 'tel', 'data-arrival-new-phone': true, value: d.newPhone }, on: { input: (e) => this.set({ newPhone: (e.target as HTMLInputElement).value }) } })),
      h('p', { class: 'muted small' }, this.t('newNote'))) : null;
    const today = todayIn(this.host.zone);
    const date = (key: 'from' | 'to') => h('label', { class: 'field' }, h('span', null, this.t(key)),
      h('input', { class: 'input', attrs: { type: 'date', min: today, dir: 'ltr', value: d[key], [`data-arrival-${key}`]: true },
        on: { change: (e) => this.set({ [key]: (e.target as HTMLInputElement).value } as Partial<ArrivalDraft>, true) } }));
    const hours = h('select', { class: 'input', attrs: { 'data-arrival-hours': true, 'aria-label': this.t('hours') },
      on: { change: (e) => this.set({ hours: (e.target as HTMLSelectElement).value }) } });
    for (const x of v.hours) hours.appendChild(h('option', { attrs: { value: x, selected: x === d.hours, dir: 'ltr' } }, x === '00:00-24:00' ? this.t('allDay') : x));
    const ack = h('label', { class: 'arr-ack' }, h('input', { attrs: { type: 'checkbox', checked: d.ack, 'data-arrival-ack': true },
      on: { change: (e) => this.set({ ack: (e.target as HTMLInputElement).checked }, true) } }), h('span', { attrs: { dir: 'auto' } }, v.notice.attest));
    return [
      h('p', { class: 'msg-body start' }, this.t('lead')),
      h('div', { class: 'field' }, h('span', { class: 'arr-label' }, this.t('who')), persons),
      fresh,
      h('div', { class: 'arr-dates' }, date('from'), date('to'), h('label', { class: 'field' }, h('span', null, this.t('hours')), hours)),
      v.window.from || v.window.to ? h('p', { class: 'muted small', attrs: { 'data-arrival-window': true } },
        this.t('windowNote', { from: shortDay(v.window.from), to: shortDay(v.window.to) })) : null,
      outsideWindow(d, v) ? h('p', { class: 'arr-warn', attrs: { 'data-arrival-outside': true } }, icon('alert'), this.t('outside')) : null,
      h('p', { class: 'muted small' }, this.t('maxDays', { n: v.max_days })),
      h('details', { class: 'arr-notice', attrs: { 'data-arrival-notice': v.notice.version } }, h('summary', null, icon('info'), this.t('notice')),
        h('p', { attrs: { dir: 'auto', lang: v.notice.lang } }, v.notice.text)),
      ack,
      this.error ? h('div', { class: 'field-error', attrs: { role: 'alert', 'data-arrival-error': this.error } }, this.t(this.error)) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', attrs: { type: 'button', disabled: this.busy, 'data-arrival-send': true }, on: { click: () => void this.send() } },
          icon('send'), this.t(this.busy ? 'sending' : 'send')),
        v.current ? h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: () => { this.editing = false; this.error = null; this.render(); } } }, this.t('cancel')) : null),
    ];
  }
}

export function mountArrival(host: ArrivalHost): ArrivalHandle {
  if (!document.querySelector('link[data-arrival-css]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.setAttribute('href', cssUrl); // a file of this page's own origin (CSP style-src 'self')
    css.setAttribute('data-arrival-css', '');
    document.head.appendChild(css);
  }
  const card = new ArrivalCard(host);
  void card.refresh();
  return { element: card.element, refresh: () => card.refresh(), setLang: (l) => card.setLang(l) };
}
