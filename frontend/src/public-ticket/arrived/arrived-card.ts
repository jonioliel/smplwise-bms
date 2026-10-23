/**
 * VENDORARRIVAL126B-295: the "I have arrived" card on the vendor's page - a lazy chunk (`arrived-card-*`) the ticket page fetches only
 * when its answer carries the `visit` block (services/tickets/visits.py `public_block`: this assignment's own planned visit; absent
 * while visits are off). It is the page of the EXISTING visits flow: the same `POST /t/api/arrived`, no second route, no second table.
 * It never opens a door: when the server sets `offer_access` the card only points to the existing entry-code step (a manager
 * approves every request). Text only through dom.ts `h` (text nodes); it reuses the page's own classes, so it brings no stylesheet.
 */
import { h, icon } from '../dom';
import type { Lang } from '../strings';
import { art, type ArrivedKey } from './arrived-text';

/** the server's `visit` block of `GET /t/api/ticket` */
export interface VisitBlock {
  state: 'planned' | 'reported' | 'arrived' | 'missed' | 'done' | 'cancelled';
  planned_from?: string;
  planned_to?: string;
  can_arrive: boolean;
  arrived_at?: string | null;
  late?: boolean;
  offer_access?: boolean;
}

export interface ArrivedHost {
  post(crid: string): Promise<{ status: number; body: unknown }>;
  newRequestId(): string;
  lang: Lang;
  zone: string;
  /** the ticket answer changed (the tap was stored): the page reloads its view */
  reload(): void;
}

export interface ArrivedHandle { element: HTMLElement; update(block: VisitBlock): void; setLang(lang: Lang): void }

/** "Mon 24 Oct, 09:30" in the installation's zone and the page's language; a bad value shows as it came. */
export function stamp(iso: string | null | undefined, lang: Lang, zone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(lang, { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** Which line the card shows: `done` (arrived / reported), or the open states. Pure, for the unit test. */
export function view(b: VisitBlock): 'arrived' | 'reported' | 'late' | 'ready' | 'notYet' {
  if (b.state === 'arrived' || b.state === 'done') return 'arrived';
  if (b.state === 'reported') return 'reported';
  if (b.state === 'missed') return b.can_arrive ? 'late' : 'notYet';
  return b.can_arrive ? 'ready' : 'notYet';
}

class ArrivedCard {
  readonly element: HTMLElement;
  private block: VisitBlock | null = null;
  private busy = false;
  private error: ArrivedKey | null = null;
  private crid: string | null = null;

  constructor(private host: ArrivedHost) {
    this.element = h('section', { class: 'card arrived', attrs: { 'data-arrived': 'loading' } });
  }

  setLang(lang: Lang): void {
    this.host.lang = lang;
    this.render();
  }

  update(block: VisitBlock): void {
    this.block = block;
    this.render();
  }

  private t(key: ArrivedKey, vars: Record<string, string | number> = {}): string {
    return art(this.host.lang, key, vars);
  }

  private async tap(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = null;
    this.crid = this.crid ?? this.host.newRequestId(); // kept until answered: a retry on bad reception is the same request
    this.render();
    const r = await this.host.post(this.crid);
    this.busy = false;
    if (r.status === 200) {
      this.crid = null;
      this.host.reload();
      return;
    }
    if (r.status !== 0) this.crid = null;
    this.error = r.status === 0 ? 'errOffline' : r.status === 422 ? 'errOutside' : 'errGeneric';
    this.render();
  }

  private render(): void {
    const b = this.block;
    if (!b || b.state === 'cancelled') {
      this.element.replaceChildren();
      return;
    }
    const kind = view(b);
    this.element.dataset.arrived = kind;
    const head = h('h2', null, icon('pin'), this.t('title'));
    const at = stamp(b.arrived_at, this.host.lang, this.host.zone);
    if (kind === 'arrived' || kind === 'reported') {
      const done: Node[] = [head,
        h('div', { class: 'banner ok', attrs: { role: 'status', 'data-arrived-state': kind } }, icon('done'), this.t(kind === 'arrived' ? 'arrived' : 'reported', { at }))];
      if (b.offer_access) done.push(h('p', { class: 'muted small', attrs: { 'data-arrived-access': true } }, this.t('access')));
      this.element.replaceChildren(...done);
      return;
    }
    const window = b.planned_from && b.planned_to
      ? h('p', { class: 'msg-body start', attrs: { 'data-arrived-window': true } },
        this.t('expected', { from: stamp(b.planned_from, this.host.lang, this.host.zone), to: stamp(b.planned_to, this.host.lang, this.host.zone) }))
      : null;
    const late = kind === 'late' || b.late ? h('div', { class: 'banner bad', attrs: { role: 'status', 'data-arrived-late': true } }, icon('alert'), this.t('late')) : null;
    const err = this.error ? h('div', { class: 'field-error', attrs: { role: 'alert', 'data-arrived-error': this.error } }, this.t(this.error)) : null;
    const tail = kind === 'notYet'
      ? h('p', { class: 'muted small', attrs: { 'data-arrived-notyet': true } }, this.t('notYet'))
      : h('button', { class: 'btn primary block', attrs: { type: 'button', disabled: this.busy, 'data-arrived-tap': true }, on: { click: () => void this.tap() } },
        icon('done'), this.t(this.busy ? 'sending' : 'button'));
    const parts: Node[] = [head];
    for (const n of [window, late, err, tail]) if (n) parts.push(n);
    this.element.replaceChildren(...parts);
  }
}

export function mountArrived(host: ArrivedHost): ArrivedHandle {
  return new ArrivedCard(host);
}
