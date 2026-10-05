import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-card';
import './sw-field';
import { describeError } from '../api/client';
import { checkRecorderHealth, healthThresholds, recorderHealth, saveHealthThresholds, type CameraRecordingMode, type HealthState, type HealthThresholds, type RecorderHealthCard, type ThresholdsAnswer } from '../api/recorder-health';
import type { StateKind } from './sw-badge';
import { SkinController } from '../design/skin';
import { cameraHealthText, detectorOverloaded, frigateHealthFor, hoursLeftState, hoursLeftText, type FrigateHealth } from '../api/frigate';
import { he } from '../i18n/he';

const KIND: Record<HealthState, StateKind> = { ok: 'live', warn: 'stale', error: 'offline', unknown: 'unknown', off: 'neutral' };
const STATUS_TEXT: Record<HealthState, string> = { ok: 'תקין', warn: 'לתשומת לב', error: 'תקלה', unknown: 'לא ידוע', off: '' };

/** The thresholds the settings card edits, in screen order: key, label, unit. */
const FIELDS: { key: Exclude<keyof HealthThresholds, 'continuous_recorders' | 'camera_recording'>; label: string; unit: string }[] = [
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
  /** NN5-F1B: the Frigate rows per recorder id (from the card's vendor_details and the recorder's camera names). */
  @state() private frigate: Record<string, FrigateHealth | null> = {};
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
      void this.loadFrigate(r.recorders);
      this.error = '';
      if (this.manage && r.can_manage && !this.th) this.th = await healthThresholds();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async loadFrigate(cards: RecorderHealthCard[]) {
    const next: Record<string, FrigateHealth | null> = {};
    await Promise.all(cards.filter((c) => c.vendor === 'frigate' && c.vendor_details).map(async (c) => {
      const free = (c.disks?.free_pct as number | null | undefined) ?? null;
      next[c.id] = await frigateHealthFor(c.id, c.vendor_details, free).catch(() => null);
    }));
    this.frigate = next;
  }

  private async check() {
    this.busy = true;
    try {
      this.cards = (await checkRecorderHealth()).recorders;
      void this.loadFrigate(this.cards);
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
    .r .k.nm2 {
      flex-shrink: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .r.wrap .k {
      flex-shrink: 1;
    }
    .fcams > summary {
      cursor: pointer;
      padding-block: 6px 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-block-size: 24px;
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
    :host([data-skin='bubble']) .ths select,
    :host([data-skin='bubble']) .chk {
      min-block-size: 44px; /* the bubble skin's touch target */
    }
    .cont {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 16px;
      margin-block-end: 12px;
      font-size: var(--sw-fs-sm);
    }
    .cont-h {
      color: var(--sw-text-2);
      inline-size: 100%;
    }
    .chk {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 32px;
      max-inline-size: 100%;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      cursor: pointer;
    }
    .chk[aria-pressed='true'] {
      border-color: var(--sw-accent);
    }
    .chk span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chk .box {
      inline-size: 16px;
      block-size: 16px;
      border-radius: 4px;
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-style: normal;
      flex-shrink: 0;
    }
    .chk[aria-pressed='true'] .box {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    :host([data-skin='bubble']) .chk {
      min-inline-size: 44px;
    }
    :host([data-skin='bubble']) .card {
      border-color: transparent;
      background: var(--sw-surface-2, var(--sw-surface));
    }
    :host([data-skin='bubble']) .r {
      border-block-start-color: transparent;
    }
    .percam {
      margin-block-end: 12px;
      font-size: var(--sw-fs-sm);
    }
    .percam summary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 32px;
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .percam .n {
      color: var(--sw-accent);
    }
    .pc-h {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      margin-block: 8px 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pc-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
      gap: 6px 16px;
    }
    .pc-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-inline-size: 0;
    }
    .pc-row span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-inline-size: 0;
    }
    .pc-row select {
      flex: 0 0 auto;
      inline-size: 190px;
      max-inline-size: 60%;
      min-block-size: 32px;
      padding: 0 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
    }
    :host([data-skin='bubble']) .pc-row select,
    :host([data-skin='bubble']) .percam summary {
      min-block-size: 44px;
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
      ${this.frigate[c.id] ? this.frigateRows(this.frigate[c.id]!) : nothing}
    </div>`;
  }

  /** NN5-F1B: the rows only a Frigate recorder reports. Partial coverage is a notice, never "no recording" (AGENTS). */
  private frigateRows(f: FrigateHealth) {
    const h = he.frigate.health;
    const det = f.detectors.length
      ? f.detectors.map((d) => `${d.name}${d.inference_ms != null ? ` · ${Math.round(d.inference_ms)} ${h.inference}` : ''}${detectorOverloaded(d) ? ` · ${h.overloaded}` : ''}`).join(', ')
      : he.frigate.summary.noDetectors;
    const detState: HealthState = f.detectors.some(detectorOverloaded) ? 'warn' : f.detectors.length ? 'ok' : 'unknown';
    const left = hoursLeftText(f.storage);
    return html`${this.row('frigate-detectors', h.detectors, { state: detState }, det)}
      ${left ? this.row('frigate-hours-left', h.storageLeft, { state: hoursLeftState(f.storage) }, left) : nothing}
      ${f.partial_coverage ? html`<div class="r wrap" data-rh-row="frigate-partial"><span class="k">${h.partial}</span><span class="v"><i class="dot" data-s="warn"></i></span></div>` : nothing}
      ${f.cameras.length ? html`<details class="fcams" data-rh-frigate-cameras open>
        <summary>${h.cameras} (${f.cameras.filter((c) => c.state === 'ok').length}/${f.cameras.length})</summary>
        ${f.cameras.map((c) => html`<div class="r" data-rh-frigate-camera=${c.id} data-camera-state=${c.state}><span class="k nm2">${c.name}</span><span class="v"><span>${cameraHealthText(c)}${c.state === 'ok' && (c.reconnects_last_hour ?? 0) > 0 ? ` · ${c.reconnects_last_hour} ${h.reconnects}` : ''}</span><i class="dot" data-s=${c.state === 'ok' ? ((c.stalls_last_hour ?? 0) > 0 ? 'warn' : 'ok') : c.state === 'off' ? 'unknown' : 'error'}></i></span></div>`)}
      </details>` : nothing}`;
  }

  private thresholds() {
    if (!this.manage || !this.th) return nothing;
    const v = { ...this.th.values, ...this.draft };
    const cont = v.continuous_recorders ?? [];
    // only recorders that report recording state can be expected to record continuously
    const detailed = (this.cards ?? []).filter((c) => c.detail_supported);
    const set = (key: keyof HealthThresholds, value: unknown) => {
      this.draft = { ...this.draft, [key]: value };
      this.saveMsg = null;
    };
    return html`<sw-card heading="ספי התראה למקליטים" data-rh-settings>
      ${detailed.length ? html`<div class="cont" data-rh-continuous>
        <span class="cont-h">הקלטה רציפה</span>
        ${detailed.map((c) => {
          const on = cont.includes(c.id);
          return html`<button type="button" class="chk" data-rh-continuous-id=${c.id} aria-pressed=${on ? 'true' : 'false'}
            @click=${() => set('continuous_recorders', on ? cont.filter((x) => x !== c.id) : [...cont, c.id])}><i class="box" aria-hidden="true">${on ? '✓' : ''}</i><span>${c.name}</span></button>`;
        })}
      </div>` : nothing}
      ${this.perCamera(detailed, v, set)}
      <div class="ths">
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

  /** NN6B: the per-camera choice over the recorder's (follows the recorder / continuous / events only), for the recorders that
   * report recording state. Collapsed by default: an installation can have many cameras. */
  private perCamera(detailed: RecorderHealthCard[], v: HealthThresholds, set: (key: keyof HealthThresholds, value: unknown) => void) {
    const ids = new Set(detailed.map((c) => c.id));
    const cams = (this.th?.cameras ?? []).filter((c) => ids.has(c.recorder_id));
    if (!cams.length) return nothing;
    const map = v.camera_recording ?? {};
    const cont = v.continuous_recorders ?? [];
    const changed = cams.filter((c) => map[c.id]).length;
    const choose = (id: string, mode: string) => {
      const next = { ...map };
      if (mode === 'continuous' || mode === 'events') next[id] = mode as CameraRecordingMode;
      else delete next[id];
      set('camera_recording', next);
    };
    return html`<details class="percam" data-rh-cameras>
      <summary>לפי מצלמה${changed ? html` <span class="n" data-rh-cameras-changed>(${changed})</span>` : nothing}</summary>
      ${detailed.map((r) => {
        const list = cams.filter((c) => c.recorder_id === r.id);
        if (!list.length) return nothing;
        const inherit = cont.includes(r.id) ? 'כמו המקליט (רציפה)' : 'כמו המקליט (לא רציפה)';
        return html`<div class="pc-h">${r.name}</div>
          <div class="pc-list">${list.map((c) => html`<label class="pc-row"><span>${c.name}</span>
            <select data-rh-camera-id=${c.id} aria-label=${c.name} .value=${map[c.id] ?? ''} @change=${(e: Event) => choose(c.id, (e.target as HTMLSelectElement).value)}>
              <option value="" ?selected=${!map[c.id]}>${inherit}</option>
              <option value="continuous" ?selected=${map[c.id] === 'continuous'}>רציפה</option>
              <option value="events" ?selected=${map[c.id] === 'events'}>לא רציפה</option>
            </select></label>`)}</div>`;
      })}
    </details>`;
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
