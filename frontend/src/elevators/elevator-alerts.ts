import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { describeError } from '../api/client';
import { getAlertSettings, putAlertSettings, type AlertChannel, type AlertSettings, type AlertSettingsBody, type AlertState, type AlertStateSettings } from '../api/elevators';
import { listGroups, listUsers, type AccessGroup, type DirectoryUser } from '../api/access';
import { alertActive, chipOf, recipientChoices, toggled, whatsappLocked } from './model';
import { elevatorCss, stateBadge } from './styles';
import { elt, type EltKey } from '../i18n/elevators';
import { elecCss } from '../electricity/styles';

const CHANNEL_KEY: Record<AlertChannel, EltKey> = { push: 'chPush', app: 'chApp', whatsapp: 'chWhatsapp' };

/**
 * הגדרות › תשתיות › מעליות › התראות מעליות (CR-INFRA-ELEVATORS 2.8.0, owner decision 2026-10-18): the master switch "שליחת התראות מעליות" and,
 * per state (fire service / fault / shutdown), its own switch, its recipients - roles, named users, groups (the generator's routing pattern; none
 * chosen = nobody) - and its extra channels (push, phone app, WhatsApp; the inbox always; no e-mail). Everything defaults OFF. Each change is
 * saved at once (PUT /infra/elevators/alerts, system.configure, revision-guarded); without that permission the card is read-only.
 */
@customElement('elevator-alerts')
export class ElevatorAlerts extends LitElement {
  @state() private s: AlertSettings | null = null;
  @state() private users: DirectoryUser[] = [];
  @state() private groups: AccessGroup[] = [];
  @state() private busy = false;
  @state() private fail = '';
  @state() private userQ = '';

  static styles = [elecCss, elevatorCss, css`
    :host { display: block; }
    .sw { display: flex; align-items: center; gap: 10px; font-weight: 600; }
    .st { border: 1px solid var(--sw-border); border-radius: 14px; padding: 10px 12px; display: grid; gap: 8px; }
    .st[data-on='false'] .body { opacity: 0.6; }
    .st .hd { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .grp { display: grid; gap: 4px; }
    .grp > span { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .opts { display: flex; flex-wrap: wrap; gap: 4px 14px; }
    .opts.scroll { max-block-size: 180px; overflow: auto; }
    .warn { color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
    .col { display: grid; gap: 10px; margin-block-start: 8px; }
    input[type='search'] { max-inline-size: 260px; }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.s = await getAlertSettings();
    } catch (e) {
      this.fail = describeError(e);
      return;
    }
    if (this.s.can_edit) {
      void listUsers().then((r) => (this.users = r.users.filter((u) => u.active))).catch(() => undefined);
      void listGroups().then((r) => (this.groups = r.groups)).catch(() => undefined);
    }
  }

  private async save(body: AlertSettingsBody) {
    if (!this.s) return;
    this.busy = true;
    this.fail = '';
    try {
      this.s = await putAlertSettings({ ...body, row_version: this.s.row_version });
    } catch (e) {
      this.fail = describeError(e);
      await this.load(); // a refusal or a conflict: show what is stored
    } finally {
      this.busy = false;
    }
  }

  private patchState(st: AlertState, patch: Partial<AlertStateSettings>) {
    void this.save({ states: { [st]: patch } });
  }

  private check(label: string, on: boolean, attr: string, change: (on: boolean) => void, disabled: boolean) {
    return html`<label class="row"><input type="checkbox" data-elevator-alert=${attr} .checked=${on} ?disabled=${disabled} @change=${(e: Event) => change((e.target as HTMLInputElement).checked)} /> ${label}</label>`;
  }

  private stateCard(st: AlertState) {
    const s = this.s!;
    const cfg = s.states[st];
    const ro = !s.can_edit || this.busy;
    const rec = cfg.recipients;
    const users = this.users.filter((u) => !this.userQ || (u.name || u.username).toLowerCase().includes(this.userQ.toLowerCase()));
    const known = new Map(this.users.map((u) => [u.id, u.name || u.username]));
    return html`<div class="st" data-elevator-alert-state=${st} data-on=${String(alertActive(s, st))}>
      <div class="hd">${this.check('', cfg.enabled, `${st}:enabled`, (on) => this.patchState(st, { enabled: on }), ro)}${stateBadge(chipOf({ state: st, stale: false }), true)}
        <span class=${recipientChoices(rec) ? 'mut' : 'warn'} data-elevator-alert-recipients=${st}>${recipientChoices(rec) ? elt('recipientsCount', { n: recipientChoices(rec) }) : elt('noRecipients')}</span></div>
      <div class="body col">
        <div class="grp"><span>${elt('recRoles')}</span><div class="opts">${s.roles.map((r) => this.check(r.label, rec.roles.includes(r.id), `${st}:role:${r.id}`, (on) => this.patchState(st, { recipients: { ...rec, roles: toggled(rec.roles, r.id, on) } }), ro))}</div></div>
        ${this.groups.length || rec.groups.length
          ? html`<div class="grp"><span>${elt('recGroups')}</span><div class="opts">${(this.groups.length ? this.groups : rec.groups.map((id) => ({ id, name: id }) as AccessGroup)).map((g) => this.check(g.name, rec.groups.includes(g.id), `${st}:group:${g.id}`, (on) => this.patchState(st, { recipients: { ...rec, groups: toggled(rec.groups, g.id, on) } }), ro))}</div></div>`
          : nothing}
        ${this.users.length
          ? html`<div class="grp"><span>${elt('recUsers')}</span>${this.users.length > 8 ? html`<input type="search" aria-label=${elt('search')} placeholder=${elt('search')} .value=${this.userQ} @input=${(e: Event) => (this.userQ = (e.target as HTMLInputElement).value)} />` : nothing}
              <div class="opts scroll">${users.map((u) => this.check(u.name || u.username, rec.users.includes(u.id), `${st}:user:${u.id}`, (on) => this.patchState(st, { recipients: { ...rec, users: toggled(rec.users, u.id, on) } }), ro))}</div></div>`
          : rec.users.length ? html`<div class="grp"><span>${elt('recUsers')}</span><div class="opts">${rec.users.map((u) => html`<span>${known.get(u) ?? u}</span>`)}</div></div>` : nothing}
        <div class="grp"><span>${elt('channels')}</span><div class="opts"><label class="row"><input type="checkbox" checked disabled /> ${elt('chInbox')}</label>
          ${s.channels.map((c) => this.check(elt(CHANNEL_KEY[c]), cfg.channels.includes(c), `${st}:channel:${c}`, (on) => this.patchState(st, { channels: toggled(cfg.channels, c, on) }), ro || whatsappLocked(s, cfg, c)))}</div>
          <span class="mut">${elt('chNote')}</span></div>
      </div>
    </div>`;
  }

  render() {
    if (!this.s) return this.fail ? html`<div class="card" data-elevator-alerts><div class="alert err" role="alert"><span class="x">!</span><div>${this.fail}</div></div></div>` : nothing;
    const s = this.s;
    return html`<div class="card" data-elevator-alerts>
      <div class="b">${elt('alertsTitle')}</div>
      <div class="col">
        <label class="sw"><input type="checkbox" data-elevator-alert="master" .checked=${s.enabled} ?disabled=${!s.can_edit || this.busy} @change=${(e: Event) => void this.save({ enabled: (e.target as HTMLInputElement).checked })} /> ${elt('alertsMaster')}</label>
        <div class="mut">${s.enabled ? elt('alertsRule') : elt('alertsOff')}</div>
        ${!s.can_edit ? html`<div class="mut" data-elevator-alerts-readonly>${elt('alertsReadOnly')}</div>` : nothing}
        ${s.states_order.map((st) => this.stateCard(st))}
      </div>
      ${this.fail ? html`<div class="alert err" role="alert"><span class="x">!</span><div>${this.fail}</div></div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elevator-alerts': ElevatorAlerts;
  }
}
