import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-drawer';
import '../components/sw-state-panel';
import { getPolicies, previewPolicy, putPolicy, resetPolicies, type GenDevice, type PoliciesResponse, type PolicyBodyValue, type PolicyItem, type Severity } from '../api/generator';
import { listUsers, type DirectoryUser } from '../api/access';
import { ApiError, describeError } from '../api/client';
import { he } from '../i18n/he';
import { elecCss } from '../electricity/styles';
import { SkinController } from '../design/skin';
import { genCss } from './gen-styles';
import { fill, hasRecipients, routeGroups, routingEmpty } from './gen-logic';

const G = he.generator;
const S = G.settings;
const SEVS: Severity[] = ['critical', 'alert', 'info'];
const DEFAULT_POLICY: PolicyBodyValue = { enabled: true, severity: null, recipients: { roles: [], users: [] }, channels: [], quiet_mode: 'matrix', escalate: false, after_s: 0, row_version: 0 };
const chLabel = (c: string) => (S.ch as Record<string, string>)[c] ?? c;

/**
 * הגדרות › תשתיות › גנרטור › ניתוב התראות (CR-031 GEN1): per generator and per alert type - recipients (roles and named users), channels, severity, quiet hours,
 * escalation and the message text with a live preview. The routing STARTS EMPTY (no recipients anywhere) and the screen says so. Types whose sensors the controller
 * does not expose are greyed with the sensor they need and are never emitted; a group with no available type is hidden. These are Arx alert settings only: nothing is
 * ever sent to the controller. The text editor writes `template_he` (a variable whose sensor is missing is dropped from the sentence).
 */
@customElement('gen-routing')
export class GenRouting extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) device!: GenDevice;
  @state() private data: PoliciesResponse | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private editing: PolicyItem | null = null;
  @state() private draft: PolicyBodyValue = { ...DEFAULT_POLICY };
  @state() private text = '';
  @state() private users: DirectoryUser[] = [];
  @state() private userQ = '';
  @state() private q = '';
  @state() private busy = false;
  @state() private msg = '';
  @state() private fail = '';
  @state() private tplError = '';
  @state() private previewText = '';
  private seq = 0;
  private previewTimer = 0;

  static styles = [elecCss, genCss];

  protected updated(c: Map<string, unknown>) {
    if (c.has('device')) {
      this.editing = null; // the routing is per generator: never carry an editor, a message or a draft across generators
      this.msg = '';
      this.fail = '';
      this.data = null;
      void this.load();
    }
  }
  connectedCallback() {
    super.connectedCallback();
    void listUsers().then((r) => (this.users = r.users.filter((u) => u.active))).catch(() => undefined);
  }

  private async load() {
    if (!this.device) return;
    const my = ++this.seq;
    this.phase = 'loading';
    try {
      const r = await getPolicies(this.device.id);
      if (my !== this.seq) return;
      this.data = r;
      this.phase = 'ready';
    } catch (e) {
      if (my !== this.seq) return;
      this.error = describeError(e);
      this.phase = 'error';
    }
  }

  private edit(i: PolicyItem) {
    if (!i.available) return;
    this.editing = i;
    this.draft = { ...DEFAULT_POLICY, ...(i.policy ?? {}), recipients: { roles: [...(i.policy?.recipients.roles ?? [])], users: [...(i.policy?.recipients.users ?? [])] }, channels: [...(i.policy?.channels ?? [])] };
    this.text = i.policy?.template_he || i.message;
    this.fail = '';
    this.tplError = '';
    this.previewText = i.message_sample ?? '';
  }
  private tplInput(v: string) {
    this.text = v;
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => void this.refreshPreview(), 300);
  }
  private async refreshPreview() {
    const i = this.editing;
    if (!i) return;
    try {
      this.previewText = (await previewPolicy(this.device.id, i.key, this.text.trim() || null)).text;
      this.tplError = '';
    } catch (e) {
      this.tplError = this.templateMessage(e);
    }
  }
  private templateMessage(e: unknown): string {
    if (e instanceof ApiError && e.body.code === 'template_invalid') {
      const d = (e.body.details ?? {}) as { unknown?: string[]; allowed?: string[] };
      const bad = (d.unknown ?? []).map((x) => `{${x}}`).join(' ');
      return `${S.tplInvalid}${bad ? `: ${bad}` : ''}${d.allowed?.length ? `. ${S.tplAllowed}: ${d.allowed.map((x) => `{${x}}`).join(' ')}` : ''}`;
    }
    return describeError(e);
  }
  private patch(p: Partial<PolicyBodyValue>) {
    this.draft = { ...this.draft, ...p };
  }
  private toggle(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  private async save() {
    const i = this.editing;
    if (!i) return;
    this.busy = true;
    this.fail = '';
    const d = this.draft;
    const body: Record<string, unknown> = { enabled: d.enabled, severity: d.severity ?? i.default_severity, recipients: d.recipients, channels: d.channels, quiet_mode: d.quiet_mode, escalate: d.escalate && hasRecipients(d), after_s: d.after_s, row_version: i.policy?.row_version };
    const t = this.text.trim();
    if (t !== (i.policy?.template_he || i.message).trim()) body.template_he = !t || t === i.message.trim() ? null : t;
    try {
      const saved = await putPolicy(this.device.id, i.key, body);
      this.data = { ...this.data!, items: this.data!.items.map((x) => (x.key === i.key ? { ...x, policy: saved } : x)) };
      this.editing = null;
      this.msg = S.routeSaved;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        this.fail = S.conflict;
        await this.load();
      } else if (e instanceof ApiError && e.body.code === 'template_invalid') this.tplError = this.templateMessage(e);
      else this.fail = describeError(e);
    } finally {
      this.busy = false;
    }
  }
  private async reset() {
    if (!window.confirm(S.confirmReset)) return;
    this.busy = true;
    try {
      await resetPolicies(this.device.id);
      this.msg = S.resetDone;
      await this.load();
    } catch (e) {
      this.fail = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private recChips(p: PolicyItem['policy']) {
    if (!hasRecipients(p)) return html`<span class="mut">${S.noRec}</span>`;
    const names = new Map(this.users.map((u) => [u.id, u.name || u.username]));
    return html`<span class="rec">${p!.recipients.roles.map((r) => html`<span>${(S.roleNames as Record<string, string>)[r] ?? r}</span>`)}${p!.recipients.users.map((u) => html`<span class="usr">${names.get(u) ?? u}</span>`)}</span>`;
  }
  private chIcons(p: PolicyItem['policy']) {
    const on = new Set(['inbox', ...(p?.channels ?? [])]);
    return html`<span class="chs">${['inbox', ...(this.data?.channels ?? [])].map((c) => html`<span class="ch ${on.has(c) ? 'on' : ''}" title=${c === 'inbox' ? S.inboxAlways : chLabel(c)}>${c === 'inbox' ? html`<sw-icon name="bell" size="14"></sw-icon>` : chLabel(c)}</span>`)}</span>`;
  }

  private drawer() {
    const i = this.editing;
    const d = this.draft;
    const data = this.data!;
    const ph = data.placeholders ?? {};
    const max = data.template_max ?? 500;
    const users = this.users.filter((u) => !this.userQ || (u.name || u.username).toLowerCase().includes(this.userQ.toLowerCase()));
    const chk = (label: string, on: boolean, fn: () => void, dis = false, extra = '') => html`<label class="${on ? 'on' : ''} ${dis ? 'dis' : ''}"><input type="checkbox" .checked=${on} ?disabled=${dis} @change=${fn} /> ${label}${extra ? html` <span class="mut">${extra}</span>` : nothing}</label>`;
    return html`<sw-drawer modal .open=${!!i} heading=${i ? fill(S.editTitle, { name: i.title }) : ''} @close=${() => (this.editing = null)} data-drawer="routing">
      ${i ? html`<div class="drawer-body">
        <label class="row"><input type="checkbox" .checked=${d.enabled} @change=${() => this.patch({ enabled: !d.enabled })} data-enabled /> <span>${S.active}</span></label>
        <div class="fld"><label>${S.severity}</label><div class="seg" role="group" data-severity>${SEVS.map((s) => html`<button aria-pressed=${(d.severity ?? i.default_severity) === s} @click=${() => this.patch({ severity: s })}>${G.alerts.sev[s]}</button>`)}</div></div>
        ${hasRecipients(d) ? nothing : html`<div class="notice warnbox" data-empty-note>${S.routingEmpty}: ${S.routingEmptyShort}</div>`}
        <div class="fld"><label>${S.recRoles}</label><div class="chooser" data-roles>${data.roles.map((r) => chk(r.label, d.recipients.roles.includes(r.id), () => this.patch({ recipients: { ...d.recipients, roles: this.toggle(d.recipients.roles, r.id) } })))}</div></div>
        ${this.users.length ? html`<div class="fld"><label>${S.recUsers}</label>
          ${this.users.length > 6 ? html`<input type="search" placeholder=${G.history.search} .value=${this.userQ} @input=${(e: Event) => (this.userQ = (e.target as HTMLInputElement).value)} />` : nothing}
          <div class="chooser" data-users style="max-block-size:220px;overflow:auto">${users.map((u) => chk(u.name || u.username, d.recipients.users.includes(u.id), () => this.patch({ recipients: { ...d.recipients, users: this.toggle(d.recipients.users, u.id) } })))}</div></div>` : nothing}
        <div class="fld"><label>${S.channels}</label><div class="chooser" data-channels>${chk(S.inboxAlways, true, () => undefined, true)}${data.channels.map((c) => chk(chLabel(c), d.channels.includes(c), () => this.patch({ channels: this.toggle(d.channels, c) })))}${data.channels_reserved.map((c) => chk(chLabel(c), false, () => undefined, true, S.soon))}</div></div>
        <div class="fld"><label>${S.quietHours}</label><div class="seg" role="group" data-quiet>${(data.quiet_modes as ('pass' | 'matrix' | 'hold')[]).map((m) => html`<button aria-pressed=${d.quiet_mode === m} @click=${() => this.patch({ quiet_mode: m })}>${S.quietLong[m]}</button>`)}</div></div>
        <div class="fld"><label>${S.escalate}</label><div class="row"><input type="checkbox" .checked=${d.escalate && hasRecipients(d)} ?disabled=${!hasRecipients(d)} @change=${() => this.patch({ escalate: !d.escalate })} data-escalate />
          ${hasRecipients(d) ? html`<input type="number" min="0" style="inline-size:90px" .value=${String(Math.round(d.after_s / 60))} @change=${(e: Event) => this.patch({ after_s: Math.max(0, Number((e.target as HTMLInputElement).value) || 0) * 60 })} /> <span class="mut">${S.escalateAfter}</span>` : html`<span class="mut">${S.escalateOff}</span>`}</div></div>
        <div class="fld"><label for="tpl">${S.message}</label>
          <textarea id="tpl" class="note" dir="rtl" .value=${this.text} maxlength=${max} @input=${(e: Event) => this.tplInput((e.target as HTMLTextAreaElement).value)} data-template></textarea>
          <div class="row mut"><span data-counter>${fill(S.tplCounter, { n: this.text.length, max })}</span><span>${S.tplClip}</span></div>
          <div class="mut vars" data-vars>${S.vars}: ${Object.entries(ph).map(([k, d]) => html`<code title=${d}>{${k}}</code> <span>${d}</span> `)}<div>${S.tplDetailNote}</div></div>
          ${this.tplError ? html`<div class="alert err" role="alert" data-tpl-error><span class="x">!</span><div>${this.tplError}</div></div>` : nothing}
          <div class="preview" data-preview><div class="mut">${S.preview}</div><b>${i.title}</b><div>${this.previewText}</div></div></div>
        ${this.fail ? html`<div class="alert err" role="alert"><span class="x">!</span><div>${this.fail}</div></div>` : nothing}
        <div class="row"><button class="btn pri" ?disabled=${this.busy} @click=${() => this.save()} data-save>${S.save}</button><button class="btn" @click=${() => (this.editing = null)}>${S.cancel}</button><button class="btn ghost" @click=${() => { this.text = i.message; void this.refreshPreview(); }} data-restore>${S.tplRestore}</button></div>
      </div>` : nothing}</sw-drawer>`;
  }

  render() {
    if (this.phase === 'loading' && !this.data) return html`<div class="col" data-state="loading"><div class="skl" style="block-size:60px"></div><div class="skl" style="block-size:240px"></div></div>`;
    if (this.phase === 'error' && !this.data) return html`<sw-state-panel state="error" heading=${G.loadError} hint=${this.error} data-state="error"></sw-state-panel>`;
    const data = this.data!;
    const groups = routeGroups(data.groups, data.items);
    const q = this.q.trim().toLowerCase();
    const match = (i: PolicyItem) => !q || i.title.toLowerCase().includes(q);
    const active = data.items.filter((i) => i.available && (i.policy?.enabled ?? true)).length;
    const row = (i: PolicyItem) => {
      const p = i.policy;
      const on = p?.enabled ?? true;
      if (!i.available) return html`<tr class="off na" data-type=${i.key}><td class="c1 c"><input type="checkbox" disabled /></td><td class="b">${i.title}</td><td colspan="5"><span class="chip c-mut nodot">${fill(S.needs, { n: i.needs ?? '' })}</span></td></tr>`;
      return html`<tr class="pick ${on ? '' : 'off'}" data-type=${i.key} @click=${() => this.edit(i)}><td class="c1 c"><input type="checkbox" .checked=${on} aria-label=${S.colOn} @click=${(e: Event) => e.stopPropagation()} @change=${async (e: Event) => { const v = (e.target as HTMLInputElement).checked; try { const saved = await putPolicy(this.device.id, i.key, { enabled: v, row_version: p?.row_version }); this.data = { ...data, items: data.items.map((x) => (x.key === i.key ? { ...x, policy: saved } : x)) }; } catch (er) { this.fail = describeError(er); await this.load(); } }} /></td>
        <td class="b">${i.title}</td><td><span class="sev ${p?.severity ?? i.default_severity}">${G.alerts.sev[p?.severity ?? i.default_severity]}</span></td><td>${this.recChips(p)}</td><td>${this.chIcons(p)}</td>
        <td class="c"><span class="mut">${S.quiet[p?.quiet_mode ?? 'matrix']}</span></td><td class="c">${p?.escalate ? html`<span class="chip c-ok nodot">v</span>` : html`<span class="mut">-</span>`}</td></tr>`;
    };
    const phoneRow = (i: PolicyItem) => !i.available
      ? html`<div class="li dis"><div class="grow"><div class="t1">${i.title}</div><div class="t2">${fill(S.needs, { n: i.needs ?? '' })}</div></div></div>`
      : html`<button class="li" data-type=${i.key} @click=${() => this.edit(i)}><div class="grow"><div class="t1">${i.title}</div><div class="t2">${this.recChips(i.policy)}</div><div style="margin-block-start:6px">${this.chIcons(i.policy)}</div></div><span class="sev ${i.policy?.severity ?? i.default_severity}">${G.alerts.sev[i.policy?.severity ?? i.default_severity]}</span></button>`;
    return html`<div class="col" data-gen-routing>
      ${routingEmpty(data.items) ? html`<div class="notice warnbox" data-routing-empty role="status"><sw-icon name="info" size="18"></sw-icon><span><b>${S.routingEmpty}.</b> ${S.routingEmptyBody}</span></div>` : nothing}
      <div class="notice"><sw-icon name="info" size="18"></sw-icon><span>${S.routingNote}</span></div>
      <div class="row"><span class="h3">${S.subs.routing}</span><span class="mut">${fill(S.activeCount, { n: active })}${data.total - data.available ? ` · ${fill(S.noSensor, { n: data.total - data.available })}` : ''}</span><div class="sp"></div>
        <input type="search" placeholder=${G.history.search} aria-label=${G.history.search} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></div>
      <div class="card flush hide-phone"><div class="scrollx"><table class="t routing"><thead><tr><th class="c">${S.colOn}</th><th>${S.colAlert}</th><th>${S.colSev}</th><th>${S.colRec}</th><th>${S.colCh}</th><th class="c">${S.colQuiet}</th><th class="c">${S.escalateShort}</th></tr></thead>
        <tbody>${groups.map((g) => html`<tr class="grp"><td colspan="7">${g.title}</td></tr>${g.items.filter(match).map(row)}`)}</tbody></table></div></div>
      <div class="list only-phone" style="flex-direction:column">${groups.map((g) => html`<div class="h3">${g.title}</div>${g.items.filter(match).map(phoneRow)}`)}</div>
      ${this.msg ? html`<div class="mut" role="status" data-saved>${this.msg}</div>` : nothing}${!this.editing && this.fail ? html`<div class="bad" role="alert">${this.fail}</div>` : nothing}
      <div class="row"><button class="btn" ?disabled=${this.busy} @click=${() => this.reset()} data-reset>${S.reset}</button></div>
      ${this.drawer()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gen-routing': GenRouting;
  }
}
