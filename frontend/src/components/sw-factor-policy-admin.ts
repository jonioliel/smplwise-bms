import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-card';
import './sw-dropdown';
import './sw-field';
import './sw-icon';
import './sw-segmented';
import './sw-toggle';
import './sw-step-up-status';
import type { DropdownChange } from './sw-dropdown';
import type { SegmentedChange } from './sw-segmented';
import { describeError, get, patch } from '../api/client';
import { factorPolicy, POLICY_VALUES, type Compliance, type FactorPolicy, type Person, type PolicyValue } from '../api/factor-screens';
import { settingsStyles } from '../styles/settings';
import { tr } from '../i18n/msg/mfa';

/** The settings this tab edits (all through PATCH settings: system.configure, step-up gated, audited `settings.update`). */
const KEYS = ['security.factor_policy', 'security.factor_policy_mode', 'security.factor_wall_exempt', 'security.remote_long_lived_tokens', 'security.step_up', 'security.step_up_minutes', 'security.step_up_local'] as const;
type Key = (typeof KEYS)[number];
type Values = Partial<Record<Key, string | number>>;

/** The stored values when the server leaves a key out. MFA-SCREENS-2510: step-up is opt-in (owner answer 2026-11-24 Q2 = b). */
const FALLBACK: Record<Key, string | number> = {
  'security.factor_policy': 'optional',
  'security.factor_policy_mode': 'report',
  'security.factor_wall_exempt': 'on',
  'security.remote_long_lived_tokens': 'allow',
  'security.step_up': 'off',
  'security.step_up_minutes': 5,
  'security.step_up_local': 'off',
};

const POLICY_LABEL: Record<PolicyValue, () => string> = {
  optional: () => tr('רשות לכולם'),
  admins: () => tr('חובה למנהלים'),
  sensitive: () => tr('חובה למי שמחזיק הרשאות רגישות'),
  all: () => tr('חובה לכולם'),
};
const LLAT_LABEL: Record<FactorPolicy['long_lived_tokens'], () => string> = {
  allow: () => tr('מותרים'),
  refuse_under_policy: () => tr('נחסמים למי שחייב אימות'),
  refuse: () => tr('נחסמים לכולם'),
};
const REASON_LABEL: Record<string, () => string> = {
  user: () => tr('הגדרה אישית'),
  role: () => tr('לפי תפקיד'),
  global: () => tr('לפי המדיניות'),
  wall: () => tr('עמדת קיר'),
  service: () => tr('משתמש שירות'),
};
const FACTOR_LABEL: Record<string, () => string> = {
  totp: () => tr('אפליקציית אימות'),
  passkey: () => tr('מפתח גישה'),
  ha_mfa: () => tr('אימות של מערכת הבית'),
};
const SHOWN = 8;

/**
 * MFA-SCREENS-2510 (slice 11 of the second-factor train): הגדרות › משתמשים והרשאות › אימות דו־שלבי. The sign-in factor policy of slice 5
 * (who must have a second factor at a remote sign-in, report vs enforce, the wall-panel exemption, long-lived tokens from outside) with
 * its compliance view - and, while a different policy is chosen but not saved yet, the PREVIEW of that policy (`?policy=`: "these users
 * would have to enrol"). Below it the step-up settings of slice 1 (opt-in: off unless switched on - owner answer 2026-11-24), the
 * minutes and the local-channel switch, with the caller's own confirmation. One save row (PATCH settings): while step-up is on the save
 * itself needs a fresh confirmation, which the shell's dialog asks for. Read-only for a holder of rbac.assign without system.configure.
 */
@customElement('sw-factor-policy-admin')
export class SwFactorPolicyAdmin extends LitElement {
  /** system.configure: may change the settings (the screen decides; the server checks again). */
  @property({ type: Boolean }) canEdit = false;
  @state() private stored: Values = {};
  @state() private draft: Values = {};
  @state() private policy: FactorPolicy | null = null;
  @state() private preview: Compliance | null = null;
  @state() private loadError = '';
  @state() private error = '';
  @state() private message = '';
  @state() private busy = false;
  @state() private showAll: '' | 'missing' | 'exempt' = '';

  static styles = [
    settingsStyles,
    css`
      :host {
        display: block;
      }
      .sections {
        max-inline-size: none;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: var(--sw-s-2);
      }
      .stat {
        display: flex;
        flex-direction: column;
        gap: var(--sw-s-1);
        padding: var(--sw-s-3);
        border-radius: var(--sw-r-md);
        background: var(--sw-well, var(--sw-surface-2));
      }
      .stat b {
        font-size: var(--sw-fs-xl);
        font-weight: var(--sw-fw-bold);
        color: var(--sw-heading, var(--sw-text));
        font-variant-numeric: tabular-nums;
      }
      .stat span {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .stat.warn b {
        color: var(--sw-warning-text);
      }
      .people {
        list-style: none;
        margin: var(--sw-s-3) 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .people li {
        display: flex;
        align-items: center;
        gap: var(--sw-s-2);
        flex-wrap: wrap;
        padding: var(--sw-s-2) 0;
        border-block-end: thin solid var(--sw-border);
        font-size: var(--sw-fs-sm);
      }
      .people li:last-child {
        border-block-end: 0;
      }
      .people .who {
        flex: 1 1 10rem;
        min-inline-size: 0;
        overflow-wrap: anywhere;
        color: var(--sw-text);
        font-weight: var(--sw-fw-medium);
      }
      .people .why {
        color: var(--sw-text-2);
        font-size: var(--sw-fs-xs);
      }
      .sub {
        margin: var(--sw-s-4) 0 0;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading, var(--sw-text));
      }
      .pv {
        display: flex;
        align-items: center;
        gap: var(--sw-s-1h);
        margin-block-end: var(--sw-s-3);
        font-size: var(--sw-fs-sm);
        color: var(--sw-accent-text);
      }
      .row sw-dropdown,
      .row sw-segmented {
        flex: none;
      }
      .num {
        inline-size: 6rem;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const [s, p] = await Promise.all([get<{ settings: Record<string, unknown> }>('settings'), factorPolicy()]);
      const vals: Values = {};
      for (const k of KEYS) if (s.settings[k] !== undefined && s.settings[k] !== null) vals[k] = s.settings[k] as string | number;
      this.stored = vals;
      this.policy = p;
      this.loadError = '';
    } catch (err) {
      this.loadError = describeError(err);
    }
  }

  private value(k: Key): string | number {
    return this.draft[k] ?? this.stored[k] ?? FALLBACK[k];
  }

  private set(k: Key, v: string | number) {
    const next = { ...this.draft };
    if (String(this.stored[k] ?? FALLBACK[k]) === String(v)) delete next[k];
    else next[k] = v;
    this.draft = next;
    this.message = '';
    this.error = '';
    if (k === 'security.factor_policy') void this.loadPreview();
  }

  private previewSeq = 0;

  /** The compliance view of the chosen (not yet saved) policy; none while the chosen one is the stored one. */
  private async loadPreview() {
    const mine = ++this.previewSeq;
    const chosen = this.draft['security.factor_policy'] as PolicyValue | undefined;
    if (!chosen) {
      this.preview = null;
      return;
    }
    try {
      const p = await factorPolicy(chosen);
      if (mine === this.previewSeq) this.preview = p.compliance;
    } catch (err) {
      if (mine === this.previewSeq) {
        this.preview = null;
        this.error = describeError(err);
      }
    }
  }

  private async save() {
    if (!Object.keys(this.draft).length) return;
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      await patch('settings', this.draft);
      this.draft = {};
      this.preview = null;
      await this.load();
      this.message = tr('נשמר');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderPeople(kind: 'missing' | 'exempt', people: Person[], total: number) {
    if (!total) return nothing;
    const all = this.showAll === kind;
    const shown = all ? people : people.slice(0, SHOWN);
    return html`<div class="sub" id=${`fp-${kind}`}>${kind === 'missing' ? tr('יצטרכו להפעיל אימות דו־שלבי') : tr('פטורים')}</div>
      <ul class="people" aria-labelledby=${`fp-${kind}`} data-fp-people=${kind}>
        ${shown.map(
          (p) => html`<li data-fp-person=${p.user_id}>
            <span class="who">${p.name || p.user_id}</span>
            <sw-badge kind="neutral" label=${p.kind === 'local' ? 'Arx' : tr('מערכת הבית')}></sw-badge>
            <span class="why">${(REASON_LABEL[p.reason] ?? (() => p.reason))()}${p.factor ? ` · ${(FACTOR_LABEL[p.factor] ?? (() => p.factor ?? ''))()}` : ''}</span>
          </li>`,
        )}
      </ul>
      ${people.length > SHOWN
        ? html`<sw-button size="sm" variant="ghost" data-fp-more=${kind} @click=${() => (this.showAll = all ? '' : kind)}>${all ? tr('פחות') : tr('הצג את כולם ({n})', { n: total })}</sw-button>`
        : nothing}`;
  }

  private renderCompliance() {
    const p = this.policy;
    if (!p) return nothing;
    const c = this.preview ?? p.compliance;
    const previewing = !!this.preview;
    const stat = (key: string, n: number, label: string, warn = false) => html`<div class="stat ${warn && n ? 'warn' : ''}" data-fp-stat=${key}><b>${n}</b><span>${label}</span></div>`;
    return html`<sw-card heading=${tr('עמידה במדיניות')} subheading=${tr('מי חייב אימות דו־שלבי בכניסה מרחוק, ולמי הוא חסר')} data-fp-compliance data-fp-preview=${previewing ? c.policy : ''}>
      ${previewing ? html`<div class="pv" role="status" data-fp-preview-note><sw-icon name="eye" size=${16}></sw-icon>${tr('תצוגה מקדימה: {policy} · עוד לא נשמר', { policy: POLICY_LABEL[c.policy]() })}</div>` : nothing}
      <div class="stats">
        ${stat('total', c.users_total, tr('משתמשים'))}
        ${stat('covered', c.covered, tr('חייבים אימות'))}
        ${stat('enrolled', c.enrolled, tr('מהם עם אימות'))}
        ${stat('missing', c.missing_count, tr('חסר להם אימות'), true)}
        ${stat('exempt', c.exempt_count, tr('פטורים'))}
      </div>
      ${this.renderPeople('missing', c.missing, c.missing_count)}
      ${this.renderPeople('exempt', c.exempt, c.exempt_count)}
      ${p.mode === 'report' && !this.draft['security.factor_policy_mode'] && c.missing_count
        ? html`<div class="hint" data-fp-report-note style="margin-block-start:var(--sw-s-3)">${tr('במצב דיווח אף אחד לא נחסם. באכיפה, מי שחסר לו אימות יתבקש להפעיל אותו בכניסה הבאה מרחוק.')}</div>`
        : nothing}
    </sw-card>`;
  }

  private renderPolicy(ro: boolean) {
    const policy = String(this.value('security.factor_policy')) as PolicyValue;
    const mode = String(this.value('security.factor_policy_mode'));
    const wall = String(this.value('security.factor_wall_exempt')) !== 'off';
    const llat = String(this.value('security.remote_long_lived_tokens')) as FactorPolicy['long_lived_tokens'];
    return html`<sw-card heading=${tr('מדיניות אימות בכניסה מרחוק')} subheading=${tr('נבדקת בכל כניסה חדשה מרחוק. ברשת המקומית לא נשאלים.')} data-fp-policy-card>
      <div class="row" data-fp-row="policy"><span class="lbl">${tr('מי חייב אימות דו־שלבי')}</span>
        ${ro
          ? html`<span class="val" data-fp-policy-ro>${POLICY_LABEL[policy]?.() ?? policy}</span>`
          : html`<sw-dropdown tall label=${tr('מי חייב אימות דו־שלבי')} data-fp-policy .value=${policy}
              .items=${POLICY_VALUES.map((v) => ({ id: v, label: POLICY_LABEL[v]() }))}
              @change=${(e: CustomEvent<DropdownChange>) => this.set('security.factor_policy', e.detail.id)}></sw-dropdown>`}</div>
      <div class="row" data-fp-row="mode"><span class="lbl">${tr('מצב')}<span class="muted">${tr('דיווח: רק מציג למי חסר · אכיפה: נדרש בכניסה הבאה מרחוק')}</span></span>
        <sw-segmented label=${tr('מצב')} data-fp-mode value=${mode} ?disabled=${ro}
          .options=${[{ value: 'report', label: tr('דיווח'), attrs: { 'data-fp-mode-option': 'report' } }, { value: 'enforce', label: tr('אכיפה'), attrs: { 'data-fp-mode-option': 'enforce' } }]}
          @change=${(e: CustomEvent<SegmentedChange>) => this.set('security.factor_policy_mode', e.detail.value)}></sw-segmented></div>
      <div class="row" data-fp-row="wall"><span class="lbl">${tr('פטור לעמדות קיר')}<span class="muted">${tr('משתמש של עמדת קיר נכנס בלי אימות דו־שלבי')}</span></span>
        <sw-toggle data-fp-wall .checked=${wall} ?disabled=${ro} label=${tr('פטור לעמדות קיר')} labelHidden
          @change=${(e: CustomEvent<{ checked: boolean }>) => this.set('security.factor_wall_exempt', e.detail.checked ? 'on' : 'off')}></sw-toggle></div>
      <div class="row" data-fp-row="long-lived"><span class="lbl">${tr('אסימונים ארוכי טווח מבחוץ')}<span class="muted">${tr('אסימון ארוך טווח אינו עובר אימות דו־שלבי')}</span></span>
        ${ro
          ? html`<span class="val" data-fp-llat-ro>${LLAT_LABEL[llat]?.() ?? llat}</span>`
          : html`<sw-dropdown tall label=${tr('אסימונים ארוכי טווח מבחוץ')} data-fp-llat .value=${llat}
              .items=${(['allow', 'refuse_under_policy', 'refuse'] as const).map((v) => ({ id: v, label: LLAT_LABEL[v]() }))}
              @change=${(e: CustomEvent<DropdownChange>) => this.set('security.remote_long_lived_tokens', e.detail.id)}></sw-dropdown>`}</div>
    </sw-card>`;
  }

  private renderStepUp(ro: boolean) {
    const on = String(this.value('security.step_up')) === 'on';
    const local = String(this.value('security.step_up_local')) === 'on';
    const minutes = Number(this.value('security.step_up_minutes'));
    return html`<sw-card heading=${tr('אישור לפני שינויים רגישים')} subheading=${tr('כבוי כברירת מחדל: האימות הדו־שלבי נשאל רק בכניסה')} data-fp-step-up-card>
      <div class="row" data-fp-row="step-up"><span class="lbl">${tr('לבקש אישור לפני שינויים')}<span class="muted">${tr('לפני שינוי הגדרות, משתמשים או הרשאות, נטרול אזעקה ופתיחת דלת')}</span></span>
        <sw-toggle data-fp-step-up .checked=${on} ?disabled=${ro} label=${tr('לבקש אישור לפני שינויים')} labelHidden
          @change=${(e: CustomEvent<{ checked: boolean }>) => this.set('security.step_up', e.detail.checked ? 'on' : 'off')}></sw-toggle></div>
      <div class="row" data-fp-row="minutes"><span class="lbl">${tr('משך האישור (דקות)')}<span class="muted">${tr('0 עד 30 · 0 = בכל שינוי')}</span></span>
        <sw-field class="num"><input type="number" min="0" max="30" step="1" inputmode="numeric" data-ltr data-fp-minutes aria-label=${tr('משך האישור (דקות)')} .value=${String(minutes)} ?disabled=${ro || !on}
          @change=${(e: Event) => this.set('security.step_up_minutes', Math.min(30, Math.max(0, Math.round(Number((e.target as HTMLInputElement).value) || 0))))} /></sw-field></div>
      <div class="row" data-fp-row="local"><span class="lbl">${tr('גם ברשת המקומית')}<span class="muted">${tr('כבוי: ברשת המקומית לא נשאלים, כדרך חזרה למערכת')}</span></span>
        <sw-toggle data-fp-step-up-local .checked=${local} ?disabled=${ro || !on} label=${tr('גם ברשת המקומית')} labelHidden
          @change=${(e: CustomEvent<{ checked: boolean }>) => this.set('security.step_up_local', e.detail.checked ? 'on' : 'off')}></sw-toggle></div>
      <div class="row" data-fp-row="mine"><span class="lbl">${tr('האישור שלך')}<span class="muted"><sw-step-up-status></sw-step-up-status></span></span></div>
    </sw-card>`;
  }

  render() {
    if (this.loadError && !this.policy) return html`<div class="sections"><div class="msg err" role="alert" data-fp-load-error>${this.loadError}</div></div>`;
    if (!this.policy) return html`<div class="sections"><div class="muted">${tr('טוען…')}</div></div>`;
    const ro = !this.canEdit;
    const dirty = Object.keys(this.draft).length > 0;
    return html`<div class="sections" data-fp-admin>
      ${this.renderPolicy(ro)}
      ${this.renderCompliance()}
      ${this.renderStepUp(ro)}
      ${this.canEdit
        ? html`<div class="foot sticky"><sw-button variant="primary" icon="check" data-fp-save ?disabled=${!dirty || this.busy} @click=${() => void this.save()}>${tr('שמור')}</sw-button>
            ${this.message ? html`<span class="msg ok" role="status" data-fp-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}
            ${this.error ? html`<span class="msg err" role="alert" data-fp-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}</div>`
        : html`<div class="muted" data-fp-readonly>${tr('שינוי ההגדרות דורש הרשאת מנהל מערכת.')}</div>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-factor-policy-admin': SwFactorPolicyAdmin;
  }
}
