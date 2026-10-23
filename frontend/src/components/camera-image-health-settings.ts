import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-button';
import './sw-card';
import './sw-field';
import './sw-toggle';
import './sw-state-panel';
import { describeError, get, put } from '../api/client';
import { cameraImageSettings, saveCameraImageSettings, type ImageHealthSettings, type ImageHealthSettingsAnswer } from '../api/camera-image-health';
import { RECIPIENT_LABEL, type NotifyPolicy } from '../api/notifications';
import { cit, type CitKey } from '../i18n/camera-image-health';
import { SkinController } from '../design/skin';

type NumKey = 'interval_s' | 'per_pass_max' | 'dark_level' | 'blur_min' | 'freeze_diff' | 'freeze_samples' | 'shift_pct' | 'shift_corr_min' | 'confirm_samples' | 'recover_s';
type BoolKey = 'check_dark' | 'check_blur' | 'check_freeze' | 'check_shift';

/** Every threshold, in screen order. */
const NUMS: NumKey[] = ['interval_s', 'per_pass_max', 'dark_level', 'blur_min', 'freeze_diff', 'freeze_samples', 'shift_pct', 'shift_corr_min', 'confirm_samples', 'recover_s'];
/** The thresholds that take a fraction (the rest are whole numbers; the backend refuses a fraction for them). */
const FLOATS = new Set<NumKey>(['blur_min', 'freeze_diff', 'shift_corr_min']);
const CHECKS: { key: BoolKey; label: CitKey }[] = [
  { key: 'check_dark', label: 'checkDark' },
  { key: 'check_blur', label: 'checkBlur' },
  { key: 'check_freeze', label: 'checkFreeze' },
  { key: 'check_shift', label: 'checkShift' },
];
const RULES: NotifyPolicy['recipients']['rule'][] = ['managers', 'scope', 'users'];

/**
 * CAMHEALTH091: הגדרות › בריאות ועבודות - the camera picture check (OFF by default): the switch, the sampling interval, every
 * threshold, which checks run, the excluded cameras, and the recipients of the `camera.image` alert (its notification policy - the
 * same one the notifications settings edit; shown only to a user who may manage notifications). Short labels only.
 */
@customElement('camera-image-health-settings')
export class CameraImageHealthSettings extends LitElement {
  readonly skin = new SkinController(this);
  @state() private th: ImageHealthSettingsAnswer | null = null;
  @state() private draft: Partial<ImageHealthSettings> = {};
  @state() private error = '';
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  @state() private policy: NotifyPolicy | null = null;
  @state() private users: { id: string; name: string }[] = [];
  @state() private ruleDraft: NotifyPolicy['recipients'] | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.th = await cameraImageSettings();
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
      return;
    }
    try {
      this.policy = await get<NotifyPolicy>(`notify/policies/${encodeURIComponent(this.th.source)}`);
      const { listUsers } = await import('../api/access');
      this.users = (await listUsers()).users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name || u.username }));
    } catch {
      this.policy = null; // not a notifications manager: the recipients row is not shown
    }
  }

  private set<K extends keyof ImageHealthSettings>(key: K, value: ImageHealthSettings[K]) {
    this.draft = { ...this.draft, [key]: value };
    this.msg = null;
  }

  private get dirty() {
    return Object.keys(this.draft).length > 0 || this.ruleDraft !== null;
  }

  private async save() {
    if (!this.dirty || !this.th) return;
    this.busy = true;
    this.msg = null;
    try {
      if (Object.keys(this.draft).length) {
        this.th = await saveCameraImageSettings(this.draft);
        this.draft = {};
      }
      if (this.ruleDraft && this.policy) {
        this.policy = await put<NotifyPolicy>(`notify/policies/${encodeURIComponent(this.th.source)}`, { recipients: this.ruleDraft, base_revision: this.policy.revision });
        this.ruleDraft = null;
      }
      this.msg = { tone: 'ok', text: cit('saved') };
    } catch (err) {
      this.msg = { tone: 'err', text: describeError(err) };
    } finally {
      this.busy = false;
    }
  }

  static styles = css`
    :host {
      display: block;
    }
    .top {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 20px;
      margin-block-end: 10px;
    }
    .ths {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
      gap: 8px 10px;
    }
    .ths input,
    .row select {
      inline-size: 100%;
      box-sizing: border-box;
    }
    .row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
      margin-block-start: 10px;
      font-size: var(--sw-fs-sm);
    }
    .row > .k {
      color: var(--sw-text-2);
      min-inline-size: 110px;
    }
    .chk {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 30px;
      max-inline-size: 100%;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .chk[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: color-mix(in srgb, var(--sw-accent) 10%, var(--sw-surface));
    }
    .chk span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chk:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .row select {
      inline-size: auto;
      min-block-size: 30px;
      padding: 0 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
    }
    details summary {
      cursor: pointer;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      min-block-size: 30px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    details summary:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    details .list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 6px;
    }
    .n {
      color: var(--sw-accent);
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-block-start: 12px;
    }
    .ok {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    :host([data-skin='bubble']) .chk,
    :host([data-skin='bubble']) .ths input,
    :host([data-skin='bubble']) .row select {
      min-block-size: 44px;
    }
  `;

  private chip(on: boolean, label: string, attr: string, onClick: () => void) {
    return html`<button type="button" class="chk" data-cih-chip=${attr} aria-pressed=${on ? 'true' : 'false'} @click=${onClick}><span>${label}</span></button>`;
  }

  private recipients() {
    const p = this.policy;
    if (!p) return nothing;
    const r = this.ruleDraft ?? p.recipients;
    const ids = r.user_ids ?? [];
    return html`<div class="row" data-cih-recipients>
      <span class="k">${cit('recipients')}</span>
      <select aria-label=${cit('recipients')} data-cih-rule @change=${(e: Event) => {
        const rule = (e.target as HTMLSelectElement).value as NotifyPolicy['recipients']['rule'];
        this.ruleDraft = rule === 'users' ? { rule, user_ids: ids } : { rule };
        this.msg = null;
      }}>${(RULES.includes(r.rule) ? RULES : [...RULES, r.rule]).map((x) => html`<option value=${x} .selected=${r.rule === x}>${RECIPIENT_LABEL[x]}</option>`)}</select>
      ${r.rule === 'users'
        ? this.users.map((u) => this.chip(ids.includes(u.id), u.name, `user:${u.id}`, () => {
            this.ruleDraft = { rule: 'users', user_ids: ids.includes(u.id) ? ids.filter((x) => x !== u.id) : [...ids, u.id] };
            this.msg = null;
          }))
        : nothing}
    </div>`;
  }

  render() {
    if (this.error && !this.th) return html`<sw-card heading=${cit('settingsTitle')}><sw-state-panel compact state="error" heading=${cit('settingsTitle')} hint=${this.error} data-cih-error></sw-state-panel></sw-card>`;
    if (!this.th) return html`<sw-card heading=${cit('settingsTitle')}><sw-state-panel compact state="loading" heading=${cit('loading')}></sw-state-panel></sw-card>`;
    const v = { ...this.th.values, ...this.draft };
    const excluded = v.excluded ?? [];
    const invalidUsers = (this.ruleDraft?.rule === 'users' && !(this.ruleDraft.user_ids ?? []).length);
    return html`<sw-card heading=${cit('settingsTitle')} data-cih-settings>
      <div class="top">
        <sw-toggle label=${cit('enabled')} data-cih-enabled .checked=${v.enabled} @change=${(e: CustomEvent<{ checked: boolean }>) => this.set('enabled', e.detail.checked)}></sw-toggle>
        <sw-toggle label=${cit('passiveOnly')} data-cih-passive .checked=${v.passive_only} @change=${(e: CustomEvent<{ checked: boolean }>) => this.set('passive_only', e.detail.checked)}></sw-toggle>
      </div>
      <div class="ths">
        ${NUMS.map((k) => {
          const rg = this.th!.ranges[k];
          const isFloat = FLOATS.has(k);
          return html`<sw-field label=${cit(k)}><input class="ltr" data-cih-field=${k} type="number" inputmode=${isFloat ? 'decimal' : 'numeric'} step=${isFloat ? 'any' : '1'}
            min=${rg?.min ?? 0} max=${rg?.max ?? 99999} .value=${String(v[k])}
            @input=${(e: Event) => { const n = Number((e.target as HTMLInputElement).value); if (Number.isFinite(n) && (isFloat || Number.isInteger(n))) this.set(k, n); }} /></sw-field>`;
        })}
      </div>
      <div class="row" data-cih-checks>
        <span class="k">${cit('checks')}</span>
        ${CHECKS.map((c) => this.chip(v[c.key], cit(c.label), c.key, () => this.set(c.key, !v[c.key])))}
      </div>
      ${this.th.cameras.length ? html`<div class="row"><details data-cih-excluded>
        <summary>${cit('excludedCams')}${excluded.length ? html` <span class="n">(${excluded.length})</span>` : nothing}</summary>
        <div class="list">${this.th.cameras.map((c) => this.chip(excluded.includes(c.id), c.name, `exclude:${c.id}`, () => this.set('excluded', excluded.includes(c.id) ? excluded.filter((x) => x !== c.id) : [...excluded, c.id])))}</div>
      </details></div>` : nothing}
      ${this.recipients()}
      <div class="actions">
        <sw-button size="sm" variant="primary" data-cih-save ?disabled=${this.busy || !this.dirty || invalidUsers} @click=${() => this.save()}>${cit('save')}</sw-button>
        ${this.msg ? html`<span class=${this.msg.tone} role="status" data-cih-msg>${this.msg.text}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'camera-image-health-settings': CameraImageHealthSettings;
  }
}
