/**
 * VPORTALRFQ: the portal's two extra sections - a lazy chunk of its own (`portal-more-*`), fetched only after sign-in and only when the
 * server says a section is on (`features` in GET /t/api/portal/items; both OFF by default):
 *   1. the vendor's OPEN requests for quotation - per item the reference, the department, the deadline and (unless his link asks for a
 *      code first) the title and his own quote; "open" hands his own RFQ link's token to the page (main.ts opens the existing RFQ page);
 *   2. "company technician requests" - per company its technicians (names), the requests it sent (masked number, state) and a form to
 *      ask a manager to add / replace a technician. No door / access right here.
 * Every call goes through the portal page's own `call` (same-origin cookie, no redirect, no-store); DOM from text nodes only (dom.ts);
 * no link is built; nothing is stored.
 */
import { h, icon } from '../dom';
import type { Lang } from '../strings';
import { money, type Answer } from './portal-model';
import { isRfqs, isTechs, plausibleName, techRefusal, type Company, type RfqItem, type TechView } from './portal-more-model';
import { mt, type MoreKey } from './portal-more-text';

export interface MoreHost {
  lang(): Lang;
  when(iso: string | null | undefined): string;
  call(method: 'GET' | 'POST', route: string, body?: unknown): Promise<Answer>;
  openRfq(token: string): void;
  /** the session (or a section) ended: the portal reloads its list, which says which */
  gone(): void;
}

interface Draft { action: 'add' | 'replace'; replaces: string; name: string; phone: string }

class More {
  private rfqs: RfqItem[] | null = null;
  private techs: TechView | null = null;
  private drafts = new Map<string, Draft>();
  private msg: { company: string; key: MoreKey; ok: boolean } | null = null;
  private busy = false;
  private dead = false;

  constructor(private slot: HTMLElement, private host: MoreHost, private features: { rfqs: boolean; techs: boolean }) {}

  private t(key: MoreKey, vars: Record<string, string | number> = {}): string {
    return mt(this.host.lang(), key, vars);
  }

  async load(): Promise<void> {
    const [r, t] = await Promise.all([
      this.features.rfqs ? this.host.call('GET', '/t/api/portal/rfqs') : null,
      this.features.techs ? this.host.call('GET', '/t/api/portal/techs') : null,
    ]);
    if (this.dead) return;
    if (r?.status === 404 || t?.status === 404) return this.host.gone();
    this.rfqs = r && r.status === 200 && isRfqs(r.data) ? r.data.items : null;
    this.techs = t && t.status === 200 && isTechs(t.data) ? t.data : null;
    this.render();
  }

  destroy(): void {
    this.dead = true;
  }

  render(): void {
    if (this.dead) return;
    this.slot.replaceChildren(...this.rfqSection(), ...(this.techs?.companies ?? []).map((c) => this.company(c)));
  }

  // ---------------------------------------------------------------- requests for quotation

  private rfqSection(): HTMLElement[] {
    const items = this.rfqs;
    if (!items) return [];
    return [h('h2', { class: 'portal-h' }, this.t('rfqH'), ` (${items.length})`),
      ...items.map((i) => this.rfqCard(i))];
  }

  private rfqCard(i: RfqItem): HTMLElement {
    const q = i.quote;
    return h('section', { class: 'card portal-item', attrs: { 'data-portal-rfq': i.ref } },
      h('div', { class: 'row wrap' }, h('span', { class: 'chip num-chip', attrs: { dir: 'ltr' } }, i.ref),
        i.state === 'declined' ? h('span', { class: 'chip' }, this.t('declined')) : null),
      i.code_first ? h('p', { class: 'muted small' }, icon('lock'), ' ', this.t('codeFirst')) : h('div', { class: 'title', attrs: { dir: 'auto' } }, i.title ?? ''),
      i.department ? h('div', { class: 'muted small', attrs: { dir: 'auto' } }, i.department) : null,
      h('div', { class: 'muted small' }, this.t('due', { when: this.host.when(i.due_at) })),
      q ? h('div', { class: 'portal-money', attrs: { 'data-portal-rfq-quote': q.state } }, icon('coin'),
        h('span', null, `${this.t('yourQuote')}: `, h('bdi', null, money(q.total_minor, q.currency, this.host.lang())), ` · ${this.t(`qs_${q.state}`)}`)) : null,
      h('button', { class: 'btn block', attrs: { type: 'button', disabled: this.busy, 'data-portal-rfq-open': i.ref }, on: { click: () => void this.openRfq(i) } },
        this.t('openRfq')));
  }

  private async openRfq(i: RfqItem): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const a = await this.host.call('POST', '/t/api/portal/rfqs/open', { item: i.id });
    this.busy = false;
    if (this.dead) return;
    const token = a.status === 200 && a.data && typeof a.data === 'object' ? (a.data as { token?: unknown }).token : null;
    if (typeof token === 'string' && token) return this.host.openRfq(token);
    this.host.gone(); // the session, the section or the invitation ended: the list says which
  }

  // ---------------------------------------------------------------- company technician requests

  private draft(c: Company): Draft {
    let d = this.drafts.get(c.id);
    if (!d) this.drafts.set(c.id, (d = { action: 'add', replaces: '', name: '', phone: '' }));
    return d;
  }

  private company(c: Company): HTMLElement {
    const d = this.draft(c);
    const m = this.msg && this.msg.company === c.id ? this.msg : null;
    const input = (key: 'name' | 'phone', extra: Record<string, string | number | boolean>) => {
      const el = h('input', { class: 'input', attrs: { 'aria-label': this.t(key), maxlength: key === 'name' ? 80 : 24, [`data-portal-tech-${key}`]: true, ...extra },
        on: { input: (e) => { d[key] = (e.target as HTMLInputElement).value; } } });
      el.value = d[key];
      return h('label', { class: 'field' }, h('span', { class: 'lbl' }, this.t(key)), el);
    };
    const sel = (opts: [string, string][], value: string, label: MoreKey, attr: string, set: (v: string) => void) => {
      const s = h('select', { class: 'input', attrs: { 'aria-label': this.t(label), [attr]: true },
        on: { change: (e) => { set((e.target as HTMLSelectElement).value); this.render(); } } });
      for (const [v, text] of opts) s.appendChild(h('option', { attrs: { value: v, selected: v === value } }, text));
      return h('label', { class: 'field' }, h('span', { class: 'lbl' }, this.t(label)), s);
    };
    return h('section', { class: 'card portal-item', attrs: { 'data-portal-company': true } },
      h('h2', { class: 'portal-h', attrs: { dir: 'auto' } }, this.t('techH', { company: c.name })),
      c.techs.length ? h('div', { class: 'row wrap' }, ...c.techs.map((x) => h('span', { class: 'chip', attrs: { dir: 'auto' } }, x.name)))
        : h('p', { class: 'muted small' }, this.t('techNone')),
      c.requests.length ? h('div', { class: 'muted small' }, this.t('reqH')) : null,
      ...c.requests.map((r) => h('div', { class: 'row wrap', attrs: { 'data-portal-tech-request': r.state } },
        h('span', { attrs: { dir: 'auto' } }, `${r.action === 'add' ? this.t('a_add') : this.t('a_replace', { name: r.replaces ?? '' })}: ${r.name}`),
        r.phone ? h('bdi', { class: 'muted small' }, r.phone) : null,
        h('span', { class: 'chip' }, this.t(`r_${r.state}`)),
        r.state === 'pending' ? h('button', { class: 'linkish', attrs: { type: 'button', 'data-portal-tech-cancel': true }, on: { click: () => void this.cancel(r.id) } },
          this.t('cancel')) : null)),
      m ? h('div', { class: `banner ${m.ok ? 'ok' : 'bad'}`, attrs: { role: m.ok ? 'status' : 'alert', 'data-portal-tech-msg': m.key } }, this.t(m.key)) : null,
      h('form', { class: 'portal-form', attrs: { novalidate: true }, on: { submit: (e) => { e.preventDefault(); void this.send(c); } } },
        sel([['add', this.t('add')], ...(c.techs.length ? [['replace', this.t('replace')] as [string, string]] : [])], d.action, 'add', 'data-portal-tech-action',
          (v) => { d.action = v === 'replace' ? 'replace' : 'add'; }),
        d.action === 'replace' ? sel([['', this.t('choose')], ...c.techs.map((x) => [x.id, x.name] as [string, string])], d.replaces, 'instead',
          'data-portal-tech-replaces', (v) => { d.replaces = v; }) : null,
        input('name', { autocomplete: 'off', dir: 'auto' }),
        input('phone', { type: 'tel', inputmode: 'tel', autocomplete: 'off', dir: 'ltr' }),
        h('p', { class: 'muted small' }, this.t('note')),
        h('button', { class: 'btn primary block', attrs: { type: 'submit', disabled: this.busy, 'data-portal-tech-send': true } }, this.t('send'))));
  }

  private say(company: string, key: MoreKey, ok = false): void {
    this.msg = { company, key, ok };
    this.render();
  }

  private async send(c: Company): Promise<void> {
    const d = this.draft(c);
    if (this.busy) return;
    if (!plausibleName(d.name)) return this.say(c.id, 'badName');
    if (d.action === 'replace' && !d.replaces) return this.say(c.id, 'badReplace');
    this.busy = true;
    const a = await this.host.call('POST', '/t/api/portal/techs', { company: c.id, action: d.action, name: d.name, phone: d.phone,
      ...(d.action === 'replace' ? { replaces: d.replaces } : {}) });
    this.busy = false;
    if (this.dead) return;
    if (a.status === 201) {
      this.drafts.delete(c.id);
      this.msg = { company: c.id, key: 'sent', ok: true };
      return this.load();
    }
    const k = techRefusal(a.status, a.data, a.offline);
    if (k === 'gone') return this.host.gone();
    this.say(c.id, k);
  }

  private async cancel(id: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const a = await this.host.call('POST', '/t/api/portal/techs/cancel', { item: id });
    this.busy = false;
    if (this.dead) return;
    this.msg = null;
    if (a.status === 200) return this.load();
    this.host.gone();
  }
}

/** Mounts the sections into `slot` (kept by the portal page across its re-renders). */
export function mountMore(slot: HTMLElement, host: MoreHost, features: { rfqs: boolean; techs: boolean }): { render(): void; destroy(): void } {
  const m = new More(slot, host, features);
  void m.load();
  return m;
}
