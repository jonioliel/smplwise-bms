import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { ApiError, describeError } from '../api/client';
import type { PublicSettings, SettingsDoc, SettingsPatch } from '../api/tickets';
import { ticketsS4Api, type ProbeAnswer, type TicketsHealth } from '../api/tickets-s4';
import { ticketSettingsCss } from './settings-styles';
import { TICKET_TEXT_KEYS, tt, type TicketTextKey } from './text';
import { sampleLink } from './public-address';

const DEFAULT_PUBLIC: PublicSettings = { base_url: '', trusted_proxy_cidrs: ['172.30.32.0/23'], client_ip_header: 'cf-connecting-ip', theme: 'light' };
const THEMES: PublicSettings['theme'][] = ['light', 'dark', 'auto'];
const HEADERS: PublicSettings['client_ip_header'][] = ['cf-connecting-ip', 'x-forwarded-for'];

/**
 * CR-038 slice 4: Settings › the module › כללי › "דף המטפלים" (spec 10 / 14.1 / 17; system.configure). The handler page's state (on /
 * what is missing: the add-on option `tickets_public`, its listener, the public address, the module key), the organisation name the
 * page shows, the public address with a check (the server probes it SSRF-safe and says whether the answer came through this
 * listener and whether the proxy's client-address header arrived), and - folded - the proxies whose client-address header is
 * believed and which header that is. Saving goes through the screen's one settings document (`save-doc` {patch}); the link lifetime
 * is slice 2's card beside this one. Events: `save-doc` {patch}, `notice` {ok | error}.
 */
@customElement('tickets-public-card')
export class TicketsPublicCard extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) doc: SettingsDoc | null = null;
  @property({ type: Boolean }) busy = false;
  /** 2.5.3: a remote session (the tunnel) cannot change the public address, proxies or header - shown read-only with one line saying so. */
  @property({ type: Boolean }) remote = false;
  /** 2.5.3: the server's message when saving a public key failed (shown beside the field, not only in the page banner). */
  @property({ attribute: false }) saveError = '';
  @state() private health: TicketsHealth | null = null;
  @state() private org: string | null = null;
  @state() private address: string | null = null;
  @state() private cidrs: string | null = null;
  @state() private probe: ProbeAnswer | null = null;
  @state() private probing = false;
  @state() private advanced = false;

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
    }
    .line .in {
      flex: 1 1 220px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .state {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .probe {
      font-size: var(--sw-fs-sm);
    }
    .probe.ok {
      color: var(--sw-success-text);
    }
    .probe.bad {
      color: var(--sw-warning-text);
    }
    .fold {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .fold::before {
      content: '▸';
    }
    .fold:dir(rtl)::before {
      content: '◂';
    }
    .fold[aria-expanded='true']::before {
      content: '▾';
    }
    textarea.in {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadHealth();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('doc')) {
      const prev = changed.get('doc') as SettingsDoc | null | undefined;
      if (prev && this.doc && prev.revision !== this.doc.revision) {
        this.org = null;
        this.address = null;
        this.cidrs = null;
        void this.loadHealth();
      }
    }
  }

  private async loadHealth(): Promise<void> {
    try {
      this.health = await ticketsS4Api().health();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 403)) this.health = null;
    }
  }

  private get pub(): PublicSettings {
    return { ...DEFAULT_PUBLIC, ...(this.doc?.public ?? {}) };
  }

  private save(patch: SettingsPatch): void {
    this.dispatchEvent(new CustomEvent('save-doc', { detail: { patch }, bubbles: true, composed: true }));
  }

  private async runProbe(): Promise<void> {
    if (this.probing) return;
    this.probing = true;
    this.probe = null;
    try {
      const typed = this.address ?? this.pub.base_url;
      this.probe = await ticketsS4Api().probe(typed === this.pub.base_url ? undefined : typed);
    } catch (e) {
      this.dispatchEvent(new CustomEvent('notice', { detail: { error: describeError(e) }, bubbles: true, composed: true }));
    } finally {
      this.probing = false;
    }
  }

  private probeLine(): TemplateResult | typeof nothing {
    const p = this.probe;
    if (!p) return nothing;
    const ok = p.result === 'reachable' && (p.listener?.header_ok ?? true);
    const key = p.result === 'wrong_answer' && p.code === 'not_routed' ? 'probe_not_routed' : `probe_${p.result}`;
    const lines = [(TICKET_TEXT_KEYS as readonly string[]).includes(key) ? tt(key as TicketTextKey) : tt('probe_unreachable')];
    if (p.result === 'reachable' && p.listener && !p.listener.seen) lines.push(tt('probe_not_seen'));
    if (p.result === 'reachable' && p.listener && p.listener.seen && !p.listener.header_ok) lines.push(tt('probe_header_missing'));
    return html`<div class=${`probe ${ok ? 'ok' : 'bad'}`} role="status" data-probe-result=${p.result}>${lines.join(' · ')}</div>`;
  }

  private stateRow(): TemplateResult {
    const h = this.health;
    const missing = h?.missing ?? [];
    return html`<div class="row"><span class="lbl">${tt('pubStatus')}</span>
      <span class="state" data-public-state=${missing.length ? 'missing' : h ? 'ready' : 'unknown'}>
        ${h && !missing.length ? html`<span class="tag ok">${tt('pubReady')}</span>` : nothing}
        ${missing.map((m) => html`<span class="tag warn" data-missing=${m}>${tt(`pubMissing_${m}` as TicketTextKey)}</span>`)}
        ${h ? html`<span class="tag" data-links-live>${tt('pubLiveLinks', { n: h.links.live })}</span>` : nothing}
      </span></div>`;
  }

  render() {
    const p = this.pub;
    const org = this.org ?? this.doc?.organization_name ?? '';
    const address = this.address ?? p.base_url;
    const cidrs = this.cidrs ?? p.trusted_proxy_cidrs.join('\n');
    const cidrList = cidrs.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    return html`<sw-card heading=${tt('pubCard')} subheading=${tt('pubSub')} data-card="public">
      ${this.stateRow()}
      <div class="row stack"><span class="lbl">${tt('pubOrg')}</span>
        <div class="line"><input class="in" maxlength="80" data-public-org aria-label=${tt('pubOrg')} .value=${org} @input=${(e: Event) => (this.org = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" variant="primary" data-public-org-save ?disabled=${this.busy || org.trim() === (this.doc?.organization_name ?? '')}
            @click=${() => this.save({ organization_name: org.trim() })}>${tt('save')}</sw-button></div></div>
      <div class="row"><span class="lbl">${tt('pubTheme')}</span>
        <span class="seg" role="radiogroup" aria-label=${tt('pubTheme')}>${THEMES.map((m) => html`<button type="button" role="radio"
          aria-checked=${String(p.theme === m)} aria-pressed=${String(p.theme === m)} data-public-theme=${m} ?disabled=${this.busy}
          @click=${() => { if (p.theme !== m) this.save({ public: { theme: m } }); }}>${tt(m === 'light' ? 'pubThemeLight' : m === 'dark' ? 'pubThemeDark' : 'pubThemeAuto')}</button>`)}</span></div>
      <div class="hint" data-public-theme-note>${tt('pubThemeNote')}</div>
      <div class="row stack"><span class="lbl">${tt('pubAddress')}</span>
        <div class="line"><input class="in" type="url" dir="ltr" maxlength="300" inputmode="url" autocomplete="off" data-public-address aria-label=${tt('pubAddress')}
          placeholder=${tt('pubAddressHint')} ?readonly=${this.remote} .value=${address} @input=${(e: Event) => { this.address = (e.target as HTMLInputElement).value; this.probe = null; }} />
          <sw-button size="sm" variant="primary" data-public-address-save ?disabled=${this.busy || this.remote || address.trim() === p.base_url}
            @click=${() => this.save({ public: { base_url: address.trim() } })}>${tt('save')}</sw-button>
          <sw-button size="sm" data-public-probe ?disabled=${this.probing || this.remote || !address.trim()} @click=${() => void this.runProbe()}>${this.probing ? '…' : tt('pubProbe')}</sw-button></div>
        <div class="hint" data-public-address-note>${tt('pubAddressNote')}</div>
        ${sampleLink(address) ? html`<div class="hint" dir="ltr" data-public-sample>${tt('pubSampleLink', { url: sampleLink(address) })}</div>` : nothing}
        ${this.remote ? html`<div class="hint" data-public-local-only>${tt('pubLocalOnly')}</div>` : nothing}
        ${this.saveError ? html`<div class="probe bad" role="alert" data-public-save-error>${this.saveError}</div>` : nothing}
        ${this.probe ? this.probeLine() : nothing}</div>
      <div class="row"><button type="button" class="fold" aria-expanded=${String(this.advanced)} aria-controls="public-advanced" data-public-advanced
        @click=${() => (this.advanced = !this.advanced)}>${tt('pubAdvanced')}</button></div>
      ${this.advanced ? html`<div id="public-advanced" data-public-advanced-body>
        <div class="row stack"><span class="lbl">${tt('pubTrusted')}</span>
          <textarea class="in" dir="ltr" rows="3" data-public-cidrs aria-label=${tt('pubTrusted')} ?readonly=${this.remote} .value=${cidrs} @input=${(e: Event) => (this.cidrs = (e.target as HTMLTextAreaElement).value)}></textarea>
          <div class="foot"><sw-button size="sm" variant="primary" data-public-cidrs-save ?disabled=${this.busy || this.remote || cidrList.length > 8 || cidrList.join(',') === p.trusted_proxy_cidrs.join(',')}
            @click=${() => this.save({ public: { trusted_proxy_cidrs: cidrList } })}>${tt('save')}</sw-button></div></div>
        <div class="row"><span class="lbl">${tt('pubClientHeader')}</span>
          <span class="seg" role="radiogroup" aria-label=${tt('pubClientHeader')}>${HEADERS.map((hd) => html`<button type="button" role="radio" dir="ltr"
            aria-checked=${String(p.client_ip_header === hd)} aria-pressed=${String(p.client_ip_header === hd)} data-public-header=${hd} ?disabled=${this.busy || this.remote}
            @click=${() => this.save({ public: { client_ip_header: hd } })}>${hd}</button>`)}</span></div>
      </div>` : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-public-card': TicketsPublicCard;
  }
}
