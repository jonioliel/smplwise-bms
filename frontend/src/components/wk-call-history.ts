import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import { getCallLog, type CallLogRow } from '../api/intercom-calls';
import { canAnywhere, isApi } from '../api/session';
import { fill, ict } from '../i18n/incoming-calls';
import { callSeconds, clockText, logLine } from './incoming-call-logic';

const PAGE = 8;
const REFRESH_MS = 30_000;

/** Scoped to the element: it renders into the stations screen's own tree (light DOM), so the drawer's section styles (`.dsec`, `h4`)
 * apply to its heading exactly as to the other sections. A constructable sheet adopted by that tree (the screen's shadow root, or the
 * document): the strict CSP refuses an inline <style> element (`style-src-elem 'self'`, test_remote_hardening M4). */
const CSS = `
  wk-call-history { display: contents; }
  wk-call-history ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  wk-call-history li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--sw-s-2, 8px); padding-block: 6px;
    border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm, 13px); }
  wk-call-history li:last-child { border-block-end: 0; }
  wk-call-history .cw { color: var(--sw-text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  wk-call-history .cx { min-inline-size: 0; display: grid; }
  wk-call-history .cx span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  wk-call-history .cx small, wk-call-history .cd { color: var(--sw-text-3); }
  wk-call-history .cd { font-variant-numeric: tabular-nums; }
  wk-call-history li[data-tone='warn'] .cx span { color: var(--sw-warning-text); }
  wk-call-history li[data-tone='live'] .cx span { color: var(--sw-success-text); font-weight: var(--sw-fw-semibold, 600); }
  wk-call-history .cm { background: none; border: 0; padding: 6px 0; font: inherit; font-size: var(--sw-fs-sm, 13px); color: var(--sw-accent-text); cursor: pointer; min-block-size: 32px; }
  wk-call-history .cm:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 2px; }
`;

let sheet: CSSStyleSheet | null | undefined;
function callHistorySheet(): CSSStyleSheet | null {
  if (sheet === undefined) {
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
    } catch {
      sheet = null; // an engine without constructable sheets: the log is drawn unstyled, never blocked
    }
  }
  return sheet;
}

/** Adopt the sheet once into the tree the element lives in (each stations screen has its own shadow root). */
function adoptInto(root: Node): void {
  const s = callHistorySheet();
  const r = root as Document | ShadowRoot;
  if (!s || !('adoptedStyleSheets' in r) || r.adoptedStyleSheets.includes(s)) return;
  try {
    r.adoptedStyleSheets = [...r.adoptedStyleSheets, s];
  } catch {
    /* ignore: unstyled, as above */
  }
}

/**
 * WISKEY-INBOUND-CALLS-2382: a station's recent calls, a section of the station drawer - one line per call: when it rang, how it ended
 * (answered here by whom / elsewhere, declined, missed), how long it lasted, and whether a door of the station was opened from Arx
 * during it. The station never says who called: no visitor appears anywhere. Rows come from GET intercom/calls (access.read + the
 * activity or call right on the station). The section appears once the station HAS a logged call: nothing is drawn while loading, on
 * an error, for an empty log, or for a user without the right - the drawer is never padded with an empty box. Read-only; refreshed
 * every REFRESH_MS while shown.
 */
@customElement('wk-call-history')
export class WkCallHistory extends LitElement {
  @property({ attribute: 'station-id' }) stationId = '';
  /** The station's IANA zone, when it has one (times are shown in it); the browser's otherwise. */
  @property() zone = '';
  @state() private rows: CallLogRow[] | null = null;
  @state() private next: string | null = null;
  private timer = 0;

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  private allowed(): boolean {
    return isApi() && canAnywhere('access.read') && (canAnywhere('access.events.read') || canAnywhere('access.call'));
  }

  connectedCallback(): void {
    super.connectedCallback();
    adoptInto(this.getRootNode());
    this.style.display = 'contents'; // no box of its own: an empty log never takes a gap of the drawer's column
    this.timer = window.setInterval(() => {
      if (!document.hidden) void this.load(false);
    }, REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('stationId')) {
      this.rows = null;
      this.next = null;
      void this.load(false);
    }
  }

  private async load(more: boolean): Promise<void> {
    if (!this.stationId || !this.allowed()) return;
    const sid = this.stationId;
    try {
      const page = await getCallLog(sid, PAGE, more ? this.next : null);
      if (sid !== this.stationId) return;
      this.rows = more ? [...(this.rows ?? []), ...page.calls] : page.calls;
      this.next = page.next;
    } catch {
      /* the log is a convenience: an error keeps what was shown (or nothing) */
    }
  }

  private when(iso: string): string {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    const lang = document.documentElement.lang || 'he';
    try {
      return new Intl.DateTimeFormat(lang, this.zone ? { ...opts, timeZone: this.zone } : opts).format(d);
    } catch {
      return new Intl.DateTimeFormat(lang, opts).format(d);
    }
  }

  render() {
    if (!this.allowed() || !this.rows?.length) return nothing;
    const text = ict();
    const t = text.log;
    return html`<section class="dsec" data-wk-dsec="calls" data-call-log="ready">
      <h4><sw-icon name="history" size=${14}></sw-icon>${t.title}</h4>
      <ul>
        ${this.rows.map((r) => {
          const line = logLine(r, text);
          const sec = callSeconds(r);
          return html`<li data-call-row=${r.id} data-outcome=${r.outcome ?? r.state} data-tone=${line.tone}>
            <span class="cw" dir="ltr">${this.when(r.rang_at)}</span>
            <span class="cx"><span>${line.text}</span>${r.door_opened_at ? html`<small data-call-row-door>${fill(t.door, { name: r.door_opened_by_name || '' })}</small>` : nothing}</span>
            <span class="cd" dir="ltr">${sec !== null ? clockText(sec) : ''}</span>
          </li>`;
        })}
      </ul>
      ${this.next ? html`<button class="cm" data-call-log-more @click=${() => void this.load(true)}>${t.more}</button>` : nothing}
    </section>`;
  }
}

/** The drawer's "recent calls" of a station. `zone`: the station's display zone, when it is an IANA one. */
export function callLogSection(stationId: string, zone: { kind: string; name: string } | null | undefined): TemplateResult {
  return html`<wk-call-history station-id=${stationId} zone=${zone?.kind === 'iana' ? zone.name : ''}></wk-call-history>`;
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-call-history': WkCallHistory;
  }
}
