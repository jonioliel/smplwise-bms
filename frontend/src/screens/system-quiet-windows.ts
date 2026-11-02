import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import { can, isApi } from '../api/session';
import {
  QUIET_CHANNELS, QW_DEFAULTS, QW_MINUTES, getQuietSettings, putQuietSettings, qwChanges, qwEndsWindows, qwFromApi, qwProblem,
  type QuietChannels, type QuietWindowSettings,
} from '../api/quiet-windows';
import { qwt } from '../i18n/quiet-windows';
import { settingsStyles } from '../styles/settings';

/**
 * CR-QUIET103 + APP-SERVER-LEFTOVERS-2380: the quiet-window card of הגדרות › התראות (the five `quiet.windows.*` settings; until 2.38 they
 * were API only). The settings kit: `.row` wells, pill-thumb `.seg` keys for the two-way choices, number fields for the lengths, a
 * `.foot.sticky` save row that stays in view on a phone. A draft is saved on "שמור" after a confirmation (the server needs `confirmed`;
 * switching off ends every open window, the dialog says so). Read-only without `system.configure` and in demo mode.
 */
@customElement('system-quiet-windows')
export class SystemQuietWindows extends LitElement {
  @state() private saved: QuietWindowSettings = QW_DEFAULTS;
  @state() private draft: QuietWindowSettings = QW_DEFAULTS;
  @state() private loaded = false;
  @state() private busy = false;
  @state() private asking = false;
  @state() private message = '';
  @state() private error = '';

  static styles = [settingsStyles, css`
    :host { display: block; }
    .card { display: grid; gap: 0; }
    .sub { margin: 0 0 10px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .ctl input { inline-size: 100%; }
    .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 12px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    if (!isApi()) {
      this.loaded = true;
      return;
    }
    void getQuietSettings()
      .then((r) => this.adopt(qwFromApi(r.settings)))
      .catch((e) => {
        this.loaded = true;
        this.error = `${qwt('loadError')}: ${describeError(e)}`;
      });
  }

  private adopt(s: QuietWindowSettings): void {
    this.saved = s;
    this.draft = { ...s };
    this.loaded = true;
  }

  private get editable(): boolean {
    return isApi() && can('system.configure') && this.loaded;
  }

  private set(p: Partial<QuietWindowSettings>): void {
    this.draft = { ...this.draft, ...p };
    this.message = '';
    this.error = '';
  }

  private problemText(): string {
    const p = qwProblem(this.draft);
    return p === 'range' ? qwt('errRange', { lo: QW_MINUTES[0], hi: QW_MINUTES[1] }) : p === 'default_over_max' ? qwt('errOverMax') : '';
  }

  private async save(): Promise<void> {
    this.asking = false;
    const changes = qwChanges(this.saved, this.draft);
    if (!Object.keys(changes).length || qwProblem(this.draft)) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await putQuietSettings(changes);
      this.adopt(qwFromApi(r.settings));
      this.message = qwt('saved');
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private seg<T extends string | boolean>(field: keyof QuietWindowSettings, values: readonly T[], label: (v: T) => string, name: string, off: boolean) {
    const cur = this.draft[field] as unknown as T;
    return html`<div class="seg" role="group" aria-label=${name} data-qw-seg=${field}>${values.map((v) => html`<button type="button" data-v=${String(v)} aria-pressed=${String(cur === v)} ?disabled=${off}
      @click=${() => this.set({ [field]: v } as Partial<QuietWindowSettings>)}>${label(v)}</button>`)}</div>`;
  }

  private minutes(field: 'default_minutes' | 'max_minutes', off: boolean) {
    return html`<sw-field class="ctl"><input type="number" inputmode="numeric" min=${QW_MINUTES[0]} max=${QW_MINUTES[1]} step="5" data-ltr data-qw-minutes=${field}
      aria-invalid=${String(!!qwProblem(this.draft))} .value=${String(this.draft[field])} ?disabled=${off}
      @change=${(e: Event) => this.set({ [field]: Number((e.target as HTMLInputElement).value) })} /></sw-field>`;
  }

  render() {
    const ro = !this.editable || this.busy;
    const d = this.draft;
    const onOff = (v: boolean) => qwt(v ? 'on' : 'off');
    const dirty = Object.keys(qwChanges(this.saved, d)).length > 0;
    const problem = this.problemText();
    const range = qwt('minutesHint', { lo: QW_MINUTES[0], hi: QW_MINUTES[1] });
    return html`<div class="card" data-quiet-windows-card>
      <p class="sub">${qwt('sub')}</p>
      <div class="set-col">
        <div class="row" data-qw-row="enabled"><span class="lbl">${qwt('enabled')}<span class="muted">${qwt('enabledHint')}</span></span>${this.seg('enabled', [false, true] as const, onOff, qwt('enabled'), ro)}</div>
        <div class="row" data-qw-row="default"><span class="lbl">${qwt('defaultMinutes')}<span class="muted">${range}</span></span>${this.minutes('default_minutes', ro)}</div>
        <div class="row" data-qw-row="max"><span class="lbl">${qwt('maxMinutes')}<span class="muted">${range}</span></span>${this.minutes('max_minutes', ro)}</div>
        <div class="row" data-qw-row="mute-alerts"><span class="lbl">${qwt('muteAlerts')}<span class="muted">${qwt('muteAlertsHint')}</span></span>${this.seg('mute_alerts', [false, true] as const, onOff, qwt('muteAlerts'), ro)}</div>
        <div class="row" data-qw-row="channels"><span class="lbl">${qwt('channels')}<span class="muted">${qwt('channelsHint')}</span></span>${this.seg('channels', QUIET_CHANNELS, (v: QuietChannels) => qwt(v === 'all' ? 'ch_all' : 'ch_push'), qwt('channels'), ro)}</div>
      </div>
      ${problem ? html`<div class="err" role="alert" data-qw-problem>${problem}</div>` : nothing}
      ${this.editable
        ? html`<div class="foot sticky" data-qw-foot>
            <sw-button variant="primary" size="sm" icon="check" data-qw-save ?disabled=${!dirty || !!problem || this.busy} @click=${() => (this.asking = true)}>${qwt('save')}</sw-button>
            ${this.message ? html`<span class="ok" role="status" data-qw-message>${this.message}</span>` : nothing}
            ${this.error ? html`<span class="err" role="alert" data-qw-error>${this.error}</span>` : nothing}
          </div>`
        : html`<div class="muted" data-qw-readonly>${this.error || qwt(isApi() ? 'readOnly' : 'demo')}</div>`}
      <sw-dialog ?open=${this.asking} heading=${qwt('confirmTitle')} @close=${() => (this.asking = false)} data-qw-confirm>
        <p>${qwt('confirmBody')}</p>
        ${qwEndsWindows(this.saved, d) ? html`<p class="err" data-qw-confirm-ends>${qwt('confirmEnds')}</p>` : nothing}
        <sw-button slot="footer" @click=${() => (this.asking = false)}>${qwt('cancel')}</sw-button>
        <sw-button slot="footer" variant="primary" data-qw-confirm-go @click=${() => void this.save()}>${qwt('confirmGo')}</sw-button>
      </sw-dialog>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-quiet-windows': SystemQuietWindows;
  }
}
