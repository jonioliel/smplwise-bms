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

const DEFAULT_PUBLIC: PublicSettings = { base_url: '', trusted_proxy_cidrs: ['172.30.32.0/23'], client_ip_header: 'cf-connecting-ip' };
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
    .end .in {
      flex: 1 1 220px;
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
    details > summary {
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
      padding-block: 8px;
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
    const key = `probe_${p.result}`;
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
        ${h ? html`<span class="tag" data-links-live>${tt('lk_live')}: ${h.links.live}</span>` : nothing}
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
      <div class="row"><span class="lbl">${tt('pubOrg')}</span>
        <span class="end"><input class="in" maxlength="80" data-public-org aria-label=${tt('pubOrg')} .value=${org} @input=${(e: Event) => (this.org = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" variant="primary" data-public-org-save ?disabled=${this.busy || org.trim() === (this.doc?.organization_name ?? '')}
            @click=${() => this.save({ organization_name: org.trim() })}>${tt('save')}</sw-button></span></div>
      <div class="row"><span class="lbl">${tt('pubAddress')}<span class="muted" dir="ltr">${tt('pubAddressHint')}</span></span>
        <span class="end"><input class="in" type="url" dir="ltr" maxlength="300" inputmode="url" autocomplete="off" data-public-address aria-label=${tt('pubAddress')} .value=${address}
          @input=${(e: Event) => { this.address = (e.target as HTMLInputElement).value; this.probe = null; }} />
          <sw-button size="sm" variant="primary" data-public-address-save ?disabled=${this.busy || address.trim() === p.base_url}
            @click=${() => this.save({ public: { base_url: address.trim() } })}>${tt('save')}</sw-button>
          <sw-button size="sm" data-public-probe ?disabled=${this.probing || !address.trim()} @click=${() => void this.runProbe()}>${this.probing ? '…' : tt('pubProbe')}</sw-button></span></div>
      ${this.probe ? html`<div class="row">${this.probeLine()}</div>` : nothing}
      <details ?open=${this.advanced} @toggle=${(e: Event) => (this.advanced = (e.target as HTMLDetailsElement).open)} data-public-advanced>
        <summary>${tt('pubAdvanced')}</summary>
        <div class="row stack"><span class="lbl">${tt('pubTrusted')}</span>
          <textarea class="in" dir="ltr" rows="3" data-public-cidrs aria-label=${tt('pubTrusted')} .value=${cidrs} @input=${(e: Event) => (this.cidrs = (e.target as HTMLTextAreaElement).value)}></textarea>
          <div class="foot"><sw-button size="sm" variant="primary" data-public-cidrs-save ?disabled=${this.busy || cidrList.length > 8 || cidrList.join(',') === p.trusted_proxy_cidrs.join(',')}
            @click=${() => this.save({ public: { trusted_proxy_cidrs: cidrList } })}>${tt('save')}</sw-button></div></div>
        <div class="row"><span class="lbl">${tt('pubClientHeader')}</span>
          <span class="seg" role="radiogroup" aria-label=${tt('pubClientHeader')}>${HEADERS.map((hd) => html`<button type="button" role="radio" dir="ltr"
            aria-checked=${String(p.client_ip_header === hd)} aria-pressed=${String(p.client_ip_header === hd)} data-public-header=${hd} ?disabled=${this.busy}
            @click=${() => this.save({ public: { client_ip_header: hd } })}>${hd}</button>`)}</span></div>
      </details>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-public-card': TicketsPublicCard;
  }
}
