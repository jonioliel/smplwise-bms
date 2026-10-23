import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-card';
import './sw-button';
import './sw-badge';
import './sw-toggle';
import type { StateKind } from './sw-badge';
import { describeError } from '../api/client';
import {
  createClient, createEndpoint, createToken, deleteClient, deleteEndpoint, getPartnerOptions, getPartnerSettings, listClients, listDead,
  listDeliveries, listEndpoints, listTokens, pauseEndpoint, pingEndpoint, putPartnerSettings, redeliver, revokeToken, rotateEndpointSecret,
  rotateToken, setClientState,
  type Delivery, type OutboxRow, type PartnerClient, type PartnerEndpoint, type PartnerOptions, type PartnerSettings, type PartnerToken,
} from '../api/partners';
import { pt, ptCode, ptLang } from '../i18n/partners';

type Tab = 'partners' | 'tokens' | 'endpoints' | 'log' | 'settings';

function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const locale = { he: 'he-IL', en: 'en-GB', ar: 'ar', ru: 'ru-RU' }[ptLang()];
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function stateKind(s: string): StateKind {
  return s === 'active' ? 'live' : s === 'paused' || s === 'pending' ? 'partial' : s === 'expired' || s === 'revoked' || s === 'disabled' ? 'neutral' : 'stale';
}

/**
 * PARTNERAPI113-295: "ממשק לשותפים" / Partner interface - Settings › Connections, after the bridge-key card. `partner.manage` only
 * (system administrator; the card hides itself on 403 and the server enforces everything). Both switches stay OFF and disabled while
 * the build has no activation permit (owner answer 171). A token or a webhook secret is shown ONCE, in a box that forgets it when
 * closed; nothing is kept in browser storage. Lists are bounded and scroll inside the card (a settings screen, not a control screen).
 */
@customElement('sw-partner-api-card')
export class SwPartnerApiCard extends LitElement {
  @state() private s: PartnerSettings | null = null;
  @state() private notShown = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private ok = '';
  @state() private tab: Tab = 'partners';
  @state() private clients: PartnerClient[] = [];
  @state() private tokens: PartnerToken[] = [];
  @state() private endpoints: PartnerEndpoint[] = [];
  @state() private log: Delivery[] = [];
  @state() private deadRows: OutboxRow[] = [];
  @state() private opts: PartnerOptions | null = null;
  @state() private once: string | null = null;
  @state() private confirm: { text: string; action: string; run: () => Promise<unknown> } | null = null;
  // the forms
  @state() private fClient = '';
  @state() private fToken = { client: '', label: '', scopes: new Set<string>(), kind: 'installation', ids: new Set<string>(), depts: new Set<string>(), text: true, people: false, days: 0, cidrs: '' };
  @state() private fEp = { client: '', label: '', url: '', events: new Set<string>(), kind: 'installation', ids: new Set<string>(), skipOwn: true };
  @state() private values: Record<string, number> = {};

  static styles = css`
    :host { display: block; min-inline-size: 0; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px 14px; padding: 8px 0; border-block-end: 1px solid var(--sw-border); flex-wrap: wrap; }
    .row:last-child { border-block-end: 0; }
    .lbl { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); min-inline-size: 0; overflow-wrap: anywhere; }
    .val, .note { font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; overflow-wrap: anywhere; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .acts { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; padding-block: 8px; border-block-end: 1px solid var(--sw-border); }
    .tabs button { font: inherit; font-size: var(--sw-fs-sm); min-block-size: 32px; padding-inline: 10px; border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); cursor: pointer; }
    .tabs button[aria-selected='true'] { background: var(--sw-accent, var(--sw-primary)); color: var(--sw-on-accent, #fff); border-color: transparent; }
    .list { max-block-size: 320px; overflow-y: auto; }
    .form { display: grid; gap: 8px; padding-block: 10px; border-block-end: 1px solid var(--sw-border); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: var(--sw-fs-sm); }
    .chips label { display: inline-flex; align-items: center; gap: 4px; }
    input[type='text'], input[type='number'], input[type='url'], select { min-block-size: 36px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm);
      background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); padding-inline: 8px; min-inline-size: 0; }
    .once { display: grid; gap: 6px; padding: 10px; margin-block: 8px; border: 1px solid var(--sw-warning-border, var(--sw-border-strong)); border-radius: var(--sw-r-md);
      background: var(--sw-warning-bg, var(--sw-surface-2)); }
    .once code { font-family: var(--sw-font-mono, monospace); font-size: var(--sw-fs-sm); overflow-wrap: anywhere; direction: ltr; unicode-bidi: isolate; user-select: all; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); padding-block: 6px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); padding-block: 6px; }
    @media (max-width: 767px) and (pointer: coarse) {
      input, select, .tabs button { min-block-size: 44px; }
      sw-button { --sw-ctl-h-sm: 44px; }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private get on(): boolean {
    return !!this.s && (this.s.api_active || this.s.webhooks_active);
  }

  private async load(): Promise<void> {
    try {
      this.s = await getPartnerSettings();
      this.values = { ...this.s.values };
      this.error = '';
      if (this.on) {
        const [c, t, e, o] = await Promise.all([listClients(), listTokens(), listEndpoints(), getPartnerOptions()]);
        this.clients = c.items;
        this.tokens = t.items;
        this.endpoints = e.items;
        this.opts = o;
        if (this.tab === 'log') await this.loadLog();
      } else if (this.tab !== 'settings') {
        this.tab = 'settings';
      }
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403) this.notShown = true;
      else this.error = describeError(err);
    }
  }

  private async loadLog(): Promise<void> {
    const [l, d] = await Promise.all([listDeliveries(), listDead()]);
    this.log = l.items;
    this.deadRows = d.items;
  }

  private async run(fn: () => Promise<unknown>, okText = ''): Promise<void> {
    this.busy = true;
    this.error = '';
    this.ok = '';
    try {
      await fn();
      this.ok = okText;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
    await this.load();
  }

  private showOnce(value: string | undefined): void {
    this.once = value ?? null;
  }

  private toggleIn(set: Set<string>, v: string): Set<string> {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  }

  private clientName(id: string): string {
    return this.clients.find((c) => c.id === id)?.label ?? id;
  }

  private placeOptions(kind: string): { id: string; name: string }[] {
    const o = this.opts;
    if (!o) return [];
    return kind === 'site' ? o.sites : kind === 'building' ? o.buildings : kind === 'floor' ? o.floors : [];
  }

  // ---------------------------------------------------------------- pieces

  private renderSwitches(s: PartnerSettings) {
    const kind: StateKind = this.on ? 'live' : s.go_live_permitted ? 'neutral' : 'partial';
    const label = this.on ? pt('stateOn') : s.go_live_permitted ? pt('stateOff') : pt('stateBlocked');
    const sw = (key: 'api' | 'webhooks', text: string) => html`<div class="row">
      <span class="lbl">${text}</span>
      <sw-toggle .checked=${s[key]} ?disabled=${this.busy || (!s[key] && (!s.go_live_permitted || s.remote))} label=${text} labelHidden
        data-partner-switch=${key} @change=${(e: CustomEvent<{ checked: boolean }>) => void this.run(() => putPartnerSettings({ [key]: e.detail.checked }))}></sw-toggle>
    </div>`;
    return html`<div class="row"><span class="lbl">${pt('title')}</span><sw-badge kind=${kind} label=${label} data-partner-state></sw-badge></div>
      ${sw('api', pt('apiSwitch'))}${sw('webhooks', pt('webhooksSwitch'))}
      ${!s.go_live_permitted ? html`<div class="note" role="status" data-partner-not-permitted>${pt('notPermitted')}</div>` : nothing}
      ${s.go_live_permitted && s.remote ? html`<div class="note" role="status">${pt('localOnly')}</div>` : nothing}`;
  }

  private renderTabs() {
    const tabs: Tab[] = this.on ? ['partners', 'tokens', 'endpoints', 'log', 'settings'] : ['settings'];
    const names: Record<Tab, string> = { partners: pt('tabPartners'), tokens: pt('tabTokens'), endpoints: pt('tabEndpoints'), log: pt('tabLog'), settings: pt('tabSettings') };
    return html`<div class="tabs" role="tablist">${tabs.map((t) => html`<button role="tab" aria-selected=${this.tab === t ? 'true' : 'false'} data-partner-tab=${t}
      @click=${() => { this.tab = t; if (t === 'log') void this.loadLog(); }}>${names[t]}</button>`)}</div>`;
  }

  private renderOnce() {
    if (!this.once) return nothing;
    const value = this.once;
    return html`<div class="once" role="alert" data-partner-once>
      <span class="val">${pt('shownOnce')}</span>
      <code>${value}</code>
      <span class="acts">
        <sw-button size="sm" @click=${async () => { try { await navigator.clipboard.writeText(value); this.ok = pt('copied'); } catch { /* the text stays selectable */ } }}>${pt('copy')}</sw-button>
        <sw-button size="sm" variant="ghost" data-partner-once-close @click=${() => (this.once = null)}>${pt('close')}</sw-button>
      </span>
    </div>`;
  }

  private renderConfirm() {
    if (!this.confirm) return nothing;
    const c = this.confirm;
    return html`<div class="row" data-partner-confirm><span class="val">${c.text}</span><span class="acts">
      <sw-button size="sm" variant="primary" ?disabled=${this.busy} @click=${() => { this.confirm = null; void this.run(c.run); }}>${c.action}</sw-button>
      <sw-button size="sm" variant="ghost" @click=${() => (this.confirm = null)}>${pt('cancel')}</sw-button></span></div>`;
  }

  private renderPartners() {
    return html`<div class="form">
        <input type="text" maxlength="80" .value=${this.fClient} placeholder=${pt('partnerName')} aria-label=${pt('partnerName')}
          @input=${(e: Event) => (this.fClient = (e.target as HTMLInputElement).value)} />
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy || !this.fClient.trim()} data-partner-add
          @click=${() => void this.run(async () => { await createClient(this.fClient.trim()); this.fClient = ''; }, pt('saved'))}>${pt('addPartner')}</sw-button></span>
      </div>
      <div class="list">${this.clients.length ? this.clients.map((c) => html`<div class="row" data-partner-client=${c.id}>
        <span class="lbl">${c.label}</span>
        <span class="acts">
          <sw-badge kind=${stateKind(c.state)} label=${ptCode('st_', c.state)}></sw-badge>
          <span class="val">${pt('tabTokens')} ${c.tokens} · ${pt('tabEndpoints')} ${c.endpoints}</span>
          <sw-button size="sm" ?disabled=${this.busy} @click=${() => void this.run(() => setClientState(c.id, c.state === 'active' ? 'disabled' : 'active'))}>${c.state === 'active' ? pt('disable') : pt('enable')}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.confirm = { text: pt('confirmRemove'), action: pt('remove'), run: () => deleteClient(c.id) })}>${pt('remove')}</sw-button>
        </span></div>`) : html`<div class="note">${pt('none')}</div>`}</div>`;
  }

  private renderRestriction(kind: string, ids: Set<string>, onKind: (k: string) => void, onIds: (s: Set<string>) => void) {
    const s = this.s!;
    return html`<span class="chips"><span class="val">${pt('restriction')}</span>
        <select aria-label=${pt('restriction')} @change=${(e: Event) => onKind((e.target as HTMLSelectElement).value)}>
          ${s.restriction_kinds.map((k) => html`<option value=${k} ?selected=${k === kind}>${ptCode('rk_', k)}</option>`)}
        </select></span>
      ${kind !== 'installation' ? html`<span class="chips">${this.placeOptions(kind).map((p) => html`<label><input type="checkbox" .checked=${ids.has(p.id)}
        @change=${() => onIds(this.toggleIn(ids, p.id))} />${p.name}</label>`)}</span>` : nothing}`;
  }

  private renderTokens() {
    const f = this.fToken;
    const s = this.s!;
    const tickets = [...f.scopes].some((x) => x.startsWith('tickets.'));
    const can = !!f.client && f.scopes.size > 0 && (f.kind === 'installation' || f.ids.size > 0) && (!f.scopes.has('tickets.create') || f.depts.size > 0);
    const submit = () => void this.run(async () => {
      const cidrs = f.cidrs.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
      const res = await createToken(f.client, {
        label: f.label.trim() || undefined, scopes: [...f.scopes], restriction_kind: f.kind, restriction_ids: f.kind === 'installation' ? undefined : [...f.ids],
        departments: tickets ? [...f.depts] : undefined, source_cidrs: cidrs.length ? cidrs : undefined,
        personal: { ticket_text: f.text, ticket_people: f.people }, expires_days: f.days > 0 ? f.days : undefined,
      });
      this.showOnce(res.token);
      this.fToken = { ...this.fToken, label: '', scopes: new Set(), ids: new Set(), depts: new Set(), cidrs: '', days: 0 };
    }, pt('saved'));
    return html`<div class="form" data-partner-token-form>
        <span class="chips"><select aria-label=${pt('choosePartner')} @change=${(e: Event) => (this.fToken = { ...f, client: (e.target as HTMLSelectElement).value })}>
          <option value="">${pt('choosePartner')}</option>
          ${this.clients.filter((c) => c.state === 'active').map((c) => html`<option value=${c.id} ?selected=${c.id === f.client}>${c.label}</option>`)}
        </select>
        <input type="text" maxlength="80" .value=${f.label} placeholder=${pt('label')} aria-label=${pt('label')} @input=${(e: Event) => (this.fToken = { ...f, label: (e.target as HTMLInputElement).value })} /></span>
        <span class="chips"><span class="val">${pt('scopes')}</span>${s.scopes.map((sc) => html`<label><input type="checkbox" .checked=${f.scopes.has(sc)}
          data-partner-scope=${sc} @change=${() => (this.fToken = { ...f, scopes: this.toggleIn(f.scopes, sc) })} />${ptCode('sc_', sc)}</label>`)}</span>
        ${this.renderRestriction(f.kind, f.ids, (k) => (this.fToken = { ...f, kind: k, ids: new Set() }), (ids) => (this.fToken = { ...f, ids }))}
        ${tickets ? html`<span class="chips"><span class="val">${pt('departments')}</span>${(this.opts?.departments ?? []).map((d) => html`<label><input type="checkbox" .checked=${f.depts.has(d.id)}
          @change=${() => (this.fToken = { ...f, depts: this.toggleIn(f.depts, d.id) })} />${d.name}</label>`)}</span>
          <span class="chips"><label><input type="checkbox" .checked=${f.text} @change=${() => (this.fToken = { ...f, text: !f.text })} />${pt('textOption')}</label>
          <label><input type="checkbox" .checked=${f.people} data-partner-people @change=${() => (this.fToken = { ...f, people: !f.people })} />${pt('peopleOption')}</label></span>` : nothing}
        <span class="chips"><label>${pt('expiresDays')} <input type="number" min="1" max=${s.values['token_max_days'] ?? 365} placeholder=${String(s.values['token_default_days'] ?? 90)}
          .value=${f.days ? String(f.days) : ''} @input=${(e: Event) => (this.fToken = { ...f, days: Number((e.target as HTMLInputElement).value) || 0 })} /></label>
          <input type="text" class="ltr" .value=${f.cidrs} placeholder=${pt('sourceCidrs')} aria-label=${pt('sourceCidrs')} @input=${(e: Event) => (this.fToken = { ...f, cidrs: (e.target as HTMLInputElement).value })} /></span>
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy || !can} data-partner-token-create @click=${submit}>${pt('createToken')}</sw-button></span>
      </div>
      <div class="list">${this.tokens.length ? this.tokens.map((t) => html`<div class="row" data-partner-token=${t.id}>
        <span class="lbl">${this.clientName(t.client_id)}${t.label ? ` · ${t.label}` : ''} <span class="val ltr">…${t.last4}</span></span>
        <span class="val">${t.scopes.map((x) => ptCode('sc_', x)).join(', ')} · ${ptCode('rk_', t.restriction_kind)} · ${pt('expires')} ${when(t.expires_at)}${t.last_used_at ? ` · ${pt('lastUsed')} ${when(t.last_used_at)}` : ''}</span>
        <span class="acts">
          <sw-badge kind=${stateKind(t.state)} label=${ptCode('st_', t.state)}></sw-badge>
          ${t.owner_gone ? html`<sw-badge kind="stale" label=${pt('ownerGone')}></sw-badge>` : nothing}
          ${t.state === 'active' ? html`<sw-button size="sm" ?disabled=${this.busy} @click=${() => void this.run(async () => this.showOnce((await rotateToken(t.id)).token))}>${pt('rotate')}</sw-button>
            <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.confirm = { text: pt('confirmRevoke'), action: pt('revoke'), run: () => revokeToken(t.id) })}>${pt('revoke')}</sw-button>` : nothing}
        </span></div>`) : html`<div class="note">${pt('none')}</div>`}</div>`;
  }

  private renderEndpoints() {
    const f = this.fEp;
    const s = this.s!;
    const can = !!f.client && f.url.startsWith('https://') && f.events.size > 0 && (f.kind === 'installation' || f.ids.size > 0);
    const submit = () => void this.run(async () => {
      const res = await createEndpoint(f.client, { label: f.label.trim() || undefined, url: f.url.trim(), events: [...f.events], restriction_kind: f.kind,
        restriction_ids: f.kind === 'installation' ? undefined : [...f.ids], skip_own: f.skipOwn });
      this.showOnce(res.secret);
      this.fEp = { ...this.fEp, label: '', url: '', events: new Set(), ids: new Set() };
    }, pt('saved'));
    return html`<div class="form" data-partner-endpoint-form>
        <span class="chips"><select aria-label=${pt('choosePartner')} @change=${(e: Event) => (this.fEp = { ...f, client: (e.target as HTMLSelectElement).value })}>
          <option value="">${pt('choosePartner')}</option>
          ${this.clients.filter((c) => c.state === 'active').map((c) => html`<option value=${c.id} ?selected=${c.id === f.client}>${c.label}</option>`)}
        </select>
        <input type="text" maxlength="80" .value=${f.label} placeholder=${pt('label')} aria-label=${pt('label')} @input=${(e: Event) => (this.fEp = { ...f, label: (e.target as HTMLInputElement).value })} /></span>
        <input type="url" class="ltr" maxlength="2048" .value=${f.url} placeholder=${pt('url', { ports: s.allowed_ports.join(' / ') })} aria-label=${pt('url', { ports: s.allowed_ports.join(' / ') })}
          data-partner-url @input=${(e: Event) => (this.fEp = { ...f, url: (e.target as HTMLInputElement).value })} />
        <span class="chips"><span class="val">${pt('events')}</span>${s.event_types.map((ev) => html`<label><input type="checkbox" .checked=${f.events.has(ev)}
          @change=${() => (this.fEp = { ...f, events: this.toggleIn(f.events, ev) })} />${ptCode('ev_', ev)}</label>`)}</span>
        ${this.renderRestriction(f.kind, f.ids, (k) => (this.fEp = { ...f, kind: k, ids: new Set() }), (ids) => (this.fEp = { ...f, ids }))}
        <span class="chips"><label><input type="checkbox" .checked=${f.skipOwn} @change=${() => (this.fEp = { ...f, skipOwn: !f.skipOwn })} />${pt('skipOwn')}</label></span>
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy || !can} data-partner-endpoint-create @click=${submit}>${pt('createEndpoint')}</sw-button></span>
      </div>
      <div class="list">${this.endpoints.length ? this.endpoints.map((e) => html`<div class="row" data-partner-endpoint=${e.id}>
        <span class="lbl">${this.clientName(e.client_id)}${e.label ? ` · ${e.label}` : ''} <span class="val ltr">${e.host}</span></span>
        <span class="val">${e.events.map((x) => ptCode('ev_', x)).join(', ')} · ${pt('queued')} ${e.queued} · ${pt('dead')} ${e.dead}</span>
        <span class="acts">
          <sw-badge kind=${stateKind(e.state)} label=${ptCode('st_', e.state)}></sw-badge>
          <sw-button size="sm" ?disabled=${this.busy || !s.webhooks_active} @click=${() => void this.run(async () => { const r = await pingEndpoint(e.id); if (r.state !== 'delivered') throw new Error(pt('pingFail')); }, pt('pingOk'))}>${pt('ping')}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy} @click=${() => void this.run(() => pauseEndpoint(e.id, e.state !== 'paused'))}>${e.state === 'paused' ? pt('resume') : pt('pause')}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy} @click=${() => void this.run(async () => this.showOnce((await rotateEndpointSecret(e.id)).secret))}>${pt('rotateSecret')}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.confirm = { text: pt('confirmRemoveEndpoint'), action: pt('remove'), run: () => deleteEndpoint(e.id) })}>${pt('remove')}</sw-button>
        </span></div>`) : html`<div class="note">${pt('none')}</div>`}</div>`;
  }

  private renderLog() {
    return html`<div class="list" data-partner-log>
      ${this.deadRows.map((d) => html`<div class="row"><span class="val">${when(d.occurred_at)} · ${ptCode('ev_', d.type)} · ${d.dead_reason ?? ''}</span>
        <sw-button size="sm" ?disabled=${this.busy} @click=${() => void this.run(() => redeliver(d.id))}>${pt('redeliver')}</sw-button></div>`)}
      ${this.log.length ? this.log.map((l) => html`<div class="row"><span class="val">${when(l.started_at)} · ${ptCode('ev_', l.type)} · ${pt('attempt')} ${l.attempt}</span>
        <span class="val ltr">${l.http_status ?? ''} ${l.error_class ?? ''} · ${l.duration_ms} ms</span></div>`) : html`<div class="note">${pt('none')}</div>`}
    </div>`;
  }

  private renderSettings() {
    const s = this.s!;
    return html`<div class="form" data-partner-settings>
      ${Object.keys(s.values).map((k) => html`<label class="row"><span class="val">${ptCode('v_', k)}</span>
        <input type="number" min=${s.ranges[k]?.[0] ?? 0} max=${s.ranges[k]?.[1] ?? 0} .value=${String(this.values[k] ?? s.values[k])}
          @input=${(e: Event) => (this.values = { ...this.values, [k]: Number((e.target as HTMLInputElement).value) })} /></label>`)}
      <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy} data-partner-settings-save
        @click=${() => { const changed = Object.fromEntries(Object.entries(this.values).filter(([k, v]) => v !== s.values[k])); void this.run(() => putPartnerSettings({ values: changed }), pt('saved')); }}>${pt('save')}</sw-button></span>
    </div>`;
  }

  render() {
    if (this.notShown) return nothing;
    const s = this.s;
    if (!s) return this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing;
    const body = { partners: () => this.renderPartners(), tokens: () => this.renderTokens(), endpoints: () => this.renderEndpoints(), log: () => this.renderLog(),
      settings: () => this.renderSettings() }[this.tab]();
    return html`<sw-card heading=${pt('title')} data-partner-api>
      ${this.renderSwitches(s)}
      ${this.renderTabs()}
      ${this.renderOnce()}
      ${this.renderConfirm()}
      ${body}
      ${this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing}
      ${this.ok ? html`<p class="ok" role="status">${this.ok}</p>` : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-partner-api-card': SwPartnerApiCard;
  }
}
