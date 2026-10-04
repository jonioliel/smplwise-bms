import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-card';
import './sw-field';
import { describeError } from '../api/client';
import { checkRecorderHealth, healthThresholds, recorderHealth, saveHealthThresholds, type HealthState, type HealthThresholds, type RecorderHealthCard, type ThresholdsAnswer } from '../api/recorder-health';
import type { StateKind } from './sw-badge';
import { SkinController } from '../design/skin';

const KIND: Record<HealthState, StateKind> = { ok: 'live', warn: 'stale', error: 'offline', unknown: 'unknown', off: 'neutral' };
const STATUS_TEXT: Record<HealthState, string> = { ok: 'תקין', warn: 'לתשומת לב', error: 'תקלה', unknown: 'לא ידוע', off: '' };

/** The thresholds the settings card edits, in screen order: key, label, unit. */
const FIELDS: { key: Exclude<keyof HealthThresholds, 'recording_mode'>; label: string; unit: string }[] = [
  { key: 'recording_gap_min', label: 'מצלמה לא מקליטה', unit: 'דקות' },
  { key: 'clock_drift_s', label: 'סטיית שעון', unit: 'שניות' },
  { key: 'latency_ms', label: 'תגובה איטית', unit: 'מ״ש' },
  { key: 'disk_fill_days', label: 'דיסק יתמלא בתוך', unit: 'ימים' },
  { key: 'cert_days', label: 'תעודה פגה בתוך', unit: 'ימים' },
  { key: 'recover_s', label: 'זמן עד סגירת התראה', unit: 'שניות' },
  { key: 'interval_s', label: 'בדיקה כל', unit: 'שניות' },
];

const names = (list: { name: string }[] | undefined) => (list ?? []).slice(0, 2).map((x) => x.name).join(', ') + ((list?.length ?? 0) > 2 ? ` +${(list?.length ?? 0) - 2}` : '');

/**
 * CR-026: הגדרות › בריאות ועבודות - one card per recorder (connection, disks, recording, cameras, clock, certificate; a part the
 * vendor does not report is not shown) and, for system.configure, the thresholds. Short values only, no explanations.
 */
@customElement('recorder-health-panel')
export class RecorderHealthPanel extends LitElement {
  readonly skin = new SkinController(this);
  /** Show the thresholds card (the host passes whether the user may change settings). */
  @property({ type: Boolean }) manage = false;
  @state() private cards: RecorderHealthCard[] | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private th: ThresholdsAnswer | null = null;
  @state() private draft: Partial<HealthThresholds> = {};
  @state() private saveMsg: { tone: 'ok' | 'err'; text: string } | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const r = await recorderHealth();
      this.cards = r.recorders;
      this.error = '';
      if (this.manage && r.can_manage && !this.th) this.th = await healthThresholds();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async check() {
    this.busy = true;
    try {
      this.cards = (await checkRecorderHealth()).recorders;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async save() {
    if (!Object.keys(this.draft).length) return;
    this.busy = true;
    this.saveMsg = null;
    try {
      this.th = await saveHealthThresholds(this.draft);
      this.draft = {};
      this.saveMsg = { tone: 'ok', text: 'נשמר' };
    } catch (err) {
      this.saveMsg = { tone: 'err', text: describeError(err) };
    } finally {
      this.busy = false;
    }
  }

  static styles = css`
    :host {
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
      gap: 10px;
    }
    .card {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      background: var(--sw-surface);
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
    }
    .card[data-status='error'] {
      border-color: var(--sw-danger);
    }
    .card[data-status='warn'] {
      border-color: var(--sw-stale);
    }
    .hh {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .hh .nm {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .r {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 5px 0;
      border-block-start: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
      min-inline-size: 0;
    }
    .r .k {
      color: var(--sw-text-2);
      flex-shrink: 0;
    }
    .r .v {
      display: flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
      text-align: end;
    }
    .r .v span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--sw-text-3);
    }
    .dot[data-s='ok'] {
      background: var(--sw-live, #16a34a);
    }
    .dot[data-s='warn'] {
      background: var(--sw-stale, #d97706);
    }
    .dot[data-s='error'] {
      background: var(--sw-danger, #dc2626);
    }
    .bar {
      display: flex;
      justify-content: flex-end;
      margin-block-end: 8px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .ths {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
      gap: 10px;
    }
    .ths input,
    .ths select {
      inline-size: 100%;
      box-sizing: border-box;
    }
    :host([data-skin='bubble']) .ths input,
    :host([data-skin='bubble']) .ths select {
      min-block-size: 44px; /* the bubble skin's touch target */
    }
    :host([data-skin='bubble']) .card {
      border-color: transparent;
      background: var(--sw-surface-2, var(--sw-surface));
    }
    :host([data-skin='bubble']) .r {
      border-block-start-color: transparent;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-block-start: 10px;
      flex-wrap: wrap;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
  `;

  private row(key: string, label: string, s: { state: HealthState } | null | undefined, value: string) {
    if (!s || s.state === 'off') return nothing;
    return html`<div class="r" data-rh-row=${key}><span class="k">${label}</span><span class="v"><span>${value}</span><i class="dot" data-s=${s.state}></i></span></div>`;
  }

  private card(c: RecorderHealthCard) {
    const a = c.api;
    const api = a.state === 'unknown' ? 'טרם נבדק' : a.state === 'error' ? String(a.text ?? 'אין תשובה') : `${a.latency_ms ?? '—'} מ״ש`;
    const d = c.disks;
    const bad = d?.items?.find((i) => !['ok', 'formatting', 'unknown'].includes(i.state));
    const disk = !d || d.state === 'unknown' ? 'לא ידוע' : bad ? (bad.state === 'missing' ? 'אין דיסק' : `דיסק ${bad.ref}: ${bad.text}`) : d.alarms?.length ? 'תקלת דיסק' : d.fill_days != null && d.state === 'warn' ? `יתמלא בעוד ${d.fill_days} ימים` : d.full ? 'מלא' : d.free_pct != null ? `${d.free_pct}% פנוי` : 'תקין';
    const r = c.recording;
    const rec = !r || r.state === 'unknown' ? 'לא ידוע' : r.exception?.length ? `תקלה: ${names(r.exception)}` : r.stopped?.length ? `לא מקליטות: ${names(r.stopped)}` : `${r.recording ?? 0}/${r.watched ?? 0}`;
    const ch = c.channels;
    const cams = !ch || ch.state === 'unknown' ? 'לא ידוע' : ch.disconnected?.length ? `מנותקות: ${names(ch.disconnected)}` : `${ch.connected ?? 0}/${ch.total ?? 0}`;
    const k = c.clock;
    const drift = k?.drift_s == null ? null : Math.round(k.drift_s);
    const clock = drift == null ? 'לא ידוע' : drift === 0 ? 'מדויק' : `${drift > 0 ? 'מקדים' : 'מאחר'} ${Math.abs(drift)} שנ׳`;
    const t = c.certificate;
    const cert = !t || t.days_left == null ? '' : t.days_left <= 0 ? 'פגה' : `עוד ${t.days_left} ימים`;
    return html`<div class="card" data-rh-card=${c.id} data-status=${c.status}>
      <div class="hh"><span class="nm">${c.name}</span><sw-badge kind=${KIND[c.status]} label=${STATUS_TEXT[c.status]}></sw-badge></div>
      ${this.row('api', 'חיבור', a, api)}
      ${this.row('disks', 'דיסקים', d, disk)}
      ${this.row('recording', 'הקלטה', r, rec)}
      ${this.row('channels', 'מצלמות', ch, cams)}
      ${this.row('clock', 'שעון', k, clock)}
      ${t ? this.row('certificate', 'תעודה', t, cert) : nothing}
    </div>`;
  }

  private thresholds() {
    if (!this.manage || !this.th) return nothing;
    const v = { ...this.th.values, ...this.draft };
    const set = (key: keyof HealthThresholds, value: unknown) => {
      this.draft = { ...this.draft, [key]: value };
      this.saveMsg = null;
    };
    return html`<sw-card heading="ספי התראה למקליטים" data-rh-settings>
      <div class="ths">
        <sw-field label="מצב הקלטה"><select data-rh-field="recording_mode" @change=${(e: Event) => set('recording_mode', (e.target as HTMLSelectElement).value)}>
          <option value="continuous" ?selected=${v.recording_mode === 'continuous'}>רציפה</option>
          <option value="exceptions" ?selected=${v.recording_mode === 'exceptions'}>תקלות בלבד</option>
        </select></sw-field>
        ${FIELDS.map((f) => {
          const rg = this.th!.ranges[f.key];
          return html`<sw-field label=${`${f.label} (${f.unit})`}><input class="ltr" data-rh-field=${f.key} type="number" inputmode="numeric" min=${rg?.min ?? 0} max=${rg?.max ?? 99999} .value=${String(v[f.key])}
            @input=${(e: Event) => { const n = Number((e.target as HTMLInputElement).value); if (Number.isInteger(n)) set(f.key, n); }} /></sw-field>`;
        })}
      </div>
      <div class="actions">
        <sw-button size="sm" variant="primary" data-rh-save ?disabled=${this.busy || !Object.keys(this.draft).length} @click=${() => this.save()}>שמירה</sw-button>
        ${this.saveMsg ? html`<span class=${this.saveMsg.tone} data-rh-save-msg role="status">${this.saveMsg.text}</span>` : nothing}
      </div>
    </sw-card>`;
  }

  render() {
    if (this.error && !this.cards) return html`<div class="err" role="alert" data-rh-error>${this.error}</div>`;
    if (!this.cards) return html`<div class="ok" data-rh-loading>טוען…</div>`;
    if (!this.cards.length) return nothing;
    return html`<sw-card heading="מקליטים" data-rh-panel data-state="ready">
        ${this.manage ? html`<div class="bar"><sw-button size="sm" icon="refresh" data-rh-check ?disabled=${this.busy} @click=${() => this.check()}>בדוק עכשיו</sw-button></div>` : nothing}
        <div class="grid">${this.cards.map((c) => this.card(c))}</div>
        ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      </sw-card>
      ${this.thresholds()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'recorder-health-panel': RecorderHealthPanel;
  }
}
