import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { getCallBannerSettings, putCallBannerSettings, type CallBannerMode, type CallBannerSettings, type CallBannerSettingsView } from '../api/intercom-calls';
import { can, isApi } from '../api/session';
import { ict } from '../i18n/incoming-calls';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';

const MODES: readonly CallBannerMode[] = ['off', 'everyone', 'roles'];

/**
 * WISKEY-INBOUND-CALLS-2382: "שיחות נכנסות מעמדות" - who gets the incoming-call banner (components/sw-incoming-call.ts), in Settings ›
 * כללי › מתגי מסכי כניסה, under the stations screen's display settings. New behaviour, so OFF by default: nobody / everyone holding
 * the call right on the station / only chosen roles; optionally only some stations (none chosen = all); and whether it rings (the
 * quiet hours of the notification settings still hold the ring). GET / PUT intercom/calls/settings, `system.configure`, audited by
 * the server. The banner never widens a right: whoever gets it still needs the call right on that station's chain.
 */
@customElement('system-call-banner')
export class SystemCallBanner extends LitElement {
  @state() private view: CallBannerSettingsView | null = null;
  @state() private draft: CallBannerSettings | null = null;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  @state() private failed = '';
  /** The server has no such setting (an older backend): the card is not drawn at all. */
  @state() private absent = false;
  private gen = 0;

  static styles = [
    settingsStyles,
    css`
      :host {
        display: block;
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px));
        --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px));
      }
      .checks {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
      }
      .checks label,
      label.one {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-block-size: 44px;
        cursor: pointer;
      }
      input[type='checkbox'] {
        inline-size: 18px;
        block-size: 18px;
        accent-color: var(--sw-accent, #4f46e5);
      }
      .row.stack {
        flex-direction: column;
        align-items: stretch;
      }
      .row.stack .lbl {
        flex: none;
      }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    this.gen += 1;
    super.disconnectedCallback();
  }

  private async load(): Promise<void> {
    const gen = ++this.gen;
    this.failed = '';
    if (!isApi() || !can('system.configure')) return;
    try {
      const v = await getCallBannerSettings();
      if (gen !== this.gen) return;
      this.view = v;
      this.draft = { ...v.settings, roles: [...v.settings.roles], stations: [...v.settings.stations] };
    } catch (err) {
      if (gen !== this.gen) return;
      if (!(err instanceof ApiError) || err.status === 404) this.absent = true;
      else this.failed = describeError(err);
    }
  }

  private patch(p: Partial<CallBannerSettings>): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, ...p };
    this.message = '';
    this.error = '';
  }

  private toggle(list: 'roles' | 'stations', id: string, on: boolean): void {
    if (!this.draft) return;
    const cur = this.draft[list].filter((x) => x !== id);
    this.patch({ [list]: on ? [...cur, id] : cur });
  }

  private dirty(): boolean {
    const a = this.view?.settings;
    const b = this.draft;
    if (!a || !b) return false;
    const same = (x: string[], y: string[]) => x.length === y.length && [...x].sort().join('\n') === [...y].sort().join('\n');
    return a.mode !== b.mode || a.sound !== b.sound || !same(a.roles, b.roles) || !same(a.stations, b.stations);
  }

  private async save(): Promise<void> {
    const d = this.draft;
    if (!d || this.busy || !this.dirty()) return;
    this.busy = true;
    this.error = '';
    try {
      const v = await putCallBannerSettings(d);
      this.view = v;
      this.draft = { ...v.settings, roles: [...v.settings.roles], stations: [...v.settings.stations] };
      this.message = ict().setting.saved;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (!isApi() || !can('system.configure') || this.absent) return nothing;
    const t = ict().setting;
    if (this.failed) {
      return html`<sw-card heading=${t.title} data-call-banner-setting="error"><div class="row"><span class="lbl">${t.error}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${() => void this.load()}>${t.retry}</sw-button></div></sw-card>`;
    }
    const v = this.view;
    const d = this.draft;
    if (!v || !d) return nothing; // drawn once it is known (an older backend has no such setting: never a flash of an empty card)
    const label: Record<CallBannerMode, string> = { off: t.off, everyone: t.everyone, roles: t.roles };
    const needRole = d.mode === 'roles' && d.roles.length === 0;
    return html`<sw-card heading=${t.title} subheading=${t.sub} data-call-banner-setting="ready" data-mode=${d.mode}>
      <div class="row"><span class="lbl">${t.mode}<span class="muted">${t.modeText}</span></span>
        <sw-field class="ctl"><select data-call-banner-mode ?disabled=${this.busy} @change=${(e: Event) => this.patch({ mode: (e.target as HTMLSelectElement).value as CallBannerMode })}>
          ${MODES.map((m) => html`<option value=${m} ?selected=${d.mode === m}>${label[m]}</option>`)}
        </select></sw-field></div>
      ${d.mode === 'roles'
        ? html`<div class="row stack" data-call-banner-roles><span class="lbl">${t.rolesLabel}${needRole ? html`<span class="muted" role="alert">${t.needRole}</span>` : nothing}</span>
            <div class="checks">${v.roles.map((r) => html`<label><input type="checkbox" data-call-banner-role=${r.id} .checked=${d.roles.includes(r.id)} ?disabled=${this.busy}
              @change=${(e: Event) => this.toggle('roles', r.id, (e.target as HTMLInputElement).checked)} />${r.name}</label>`)}</div></div>`
        : nothing}
      ${d.mode !== 'off'
        ? html`<div class="row stack" data-call-banner-stations><span class="lbl">${t.stationsLabel}<span class="muted">${d.stations.length ? '' : t.stationsAll}</span></span>
              ${v.stations.length
                ? html`<div class="checks">${v.stations.map((s) => html`<label><input type="checkbox" data-call-banner-station=${s.id} .checked=${d.stations.includes(s.id)} ?disabled=${this.busy}
                    @change=${(e: Event) => this.toggle('stations', s.id, (e.target as HTMLInputElement).checked)} />${s.name || '—'}</label>`)}</div>`
                : html`<span class="muted">${t.stationsNone}</span>`}</div>
            <div class="row"><span class="lbl">${t.sound}<span class="muted">${t.soundText}</span></span>
              <label class="one"><input type="checkbox" data-call-banner-sound aria-label=${t.sound} .checked=${d.sound} ?disabled=${this.busy} @change=${(e: Event) => this.patch({ sound: (e.target as HTMLInputElement).checked })} /></label></div>`
        : nothing}
      <div class="foot">
        <sw-button variant="primary" icon="check" data-save-call-banner ?disabled=${!this.dirty() || needRole || this.busy} @click=${() => void this.save()}>${t.save}</sw-button>
        ${this.message ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}
        ${this.error ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-call-banner': SystemCallBanner;
  }
}
