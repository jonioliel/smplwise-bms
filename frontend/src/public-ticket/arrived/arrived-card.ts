/**
 * VENDORARRIVAL126-295: the "I have arrived" card on the vendor's page - a lazy chunk (`arrived-card-*`) the ticket page fetches only
 * when its answer carries `vendor_arrival` (the installation switch is on, a vendor link, the work is open). One button, one tap.
 * It never opens a door: when the entry-code step exists the card only points to it (a manager approves every request).
 * Text only through dom.ts `h` (text nodes); it reuses the page's own classes, so it brings no stylesheet.
 */
import { h, icon } from '../dom';
import type { Lang } from '../strings';
import { art, type ArrivedKey } from './arrived-text';

export interface ArrivedBlock {
  state: 'open' | 'expected' | 'late' | 'arrived';
  window_from?: string;
  window_to?: string;
  arrived_at?: string;
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

export interface ArrivedHandle { element: HTMLElement; update(block: ArrivedBlock): void; setLang(lang: Lang): void }

/** "Mon 24 Oct, 09:30" in the installation's zone and the page's language; a bad value shows as it came. */
export function stamp(iso: string | undefined, lang: Lang, zone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(lang, { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

class ArrivedCard {
  readonly element: HTMLElement;
  private block: ArrivedBlock | null = null;
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

  update(block: ArrivedBlock): void {
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
    this.error = r.status === 0 ? 'errOffline' : 'errGeneric';
    this.render();
  }

  private render(): void {
    const b = this.block;
    if (!b) {
      this.element.replaceChildren();
      return;
    }
    this.element.dataset.arrived = b.state;
    const head = h('h2', null, icon('pin'), this.t('title'));
    if (b.state === 'arrived') {
      const done: Node[] = [head,
        h('div', { class: 'banner ok', attrs: { role: 'status', 'data-arrived-state': 'arrived' } }, icon('done'), this.t('arrived', { at: stamp(b.arrived_at, this.host.lang, this.host.zone) }))];
      if (b.offer_access) done.push(h('p', { class: 'muted small', attrs: { 'data-arrived-access': true } }, this.t('access')));
      this.element.replaceChildren(...done);
      return;
    }
    const line = b.state === 'late' ? h('div', { class: 'banner bad', attrs: { role: 'status', 'data-arrived-late': true } }, icon('alert'), this.t('late'))
      : b.state === 'expected' ? h('p', { class: 'msg-body start', attrs: { 'data-arrived-window': true } },
        this.t('expected', { from: stamp(b.window_from, this.host.lang, this.host.zone), to: stamp(b.window_to, this.host.lang, this.host.zone) }))
        : h('p', { class: 'msg-body start' }, this.t('open'));
    const err = this.error ? [h('div', { class: 'field-error', attrs: { role: 'alert', 'data-arrived-error': this.error } }, this.t(this.error))] : [];
    this.element.replaceChildren(head, line, ...err,
      h('button', { class: 'btn primary block', attrs: { type: 'button', disabled: this.busy, 'data-arrived-tap': true }, on: { click: () => void this.tap() } },
        icon('done'), this.t(this.busy ? 'sending' : 'button')));
  }
}

export function mountArrived(host: ArrivedHost): ArrivedHandle {
  return new ArrivedCard(host);
}
