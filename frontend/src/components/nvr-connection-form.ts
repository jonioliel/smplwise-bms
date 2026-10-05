import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import './sw-field';
import './sw-state-panel';
import { ApiError, describeError } from '../api/client';
import {
  nvrConnection, nvrVendors, removeNvrConnection, saveNvrConnection, testNvrConnection, REMOVE_WORD, SAVE_WORD,
  type ConnectionBody, type NvrConnection, type SaveResult, type TestResult, type Vendor,
} from '../api/nvr-connection';
import {
  addRecorder, recorderConnection, removeRecorder, saveRecorderConnection, testRecorderConnection, PRIMARY_RECORDER,
} from '../api/recorders';
import { can, isApi, onRemote, LOCAL_ONLY_TEXT } from '../api/session';
import { announceRestartPending } from './nvr-restart-banner';

/** Fields the server keeps as columns; any other field of a vendor's catalogue entry travels in `extra`. */
const CORE = new Set(['host', 'http_port', 'rtsp_port', 'username', 'password']);

interface Draft {
  vendor: string;
  host: string;
  http_port: string;
  rtsp_port: string;
  username: string;
  password: string;
  extra: Record<string, string | boolean>;
}

const EMPTY: Draft = { vendor: '', host: '', http_port: '', rtsp_port: '', username: '', password: '', extra: {} };

/** The one-line answers of the connection test (CR-022 section 11). */
const TEST_TEXT: Record<string, string> = {
  source_forbidden: 'שם משתמש או סיסמה שגויים',
  source_unavailable: 'לא ניתן להתחבר',
  timeout: 'לא ניתן להתחבר',
  source_error: 'לא ניתן להתחבר',
  host_refused: 'כתובת לא מותרת',
  port_refused: 'פורט לא מותר',
  username_invalid: 'שם משתמש לא תקין',
  password_required: 'יש להזין את הסיסמה מחדש',
  tls_pin_mismatch: 'תעודת ה־NVR אינה התעודה שננעצה',
  tls_pin_required: 'יש לנעוץ את תעודת ה־NVR לפני השמירה',
  auth_scheme_unsupported: 'שיטת האימות של ה־NVR אינה נתמכת',
  auth_downgrade_refused: 'ה־NVR ביקש שיטת אימות חלשה מבעבר. בחרו את שיטת האימות במפורש',
};
/** CR-025: the warnings a connection test can return; each can be closed for this session (suppressing it for good is a
 * checkbox under "הגדרות מתקדמות"). */
const WARNING_TEXT: Record<string, string> = {
  basic_over_http: 'הסיסמה נשלחת בלי הצפנה (Basic על HTTP). מומלץ לבחור HTTPS.',
  tls_trust_any: 'תעודת ה־HTTPS אינה נבדקת. מומלץ לנעוץ את תעודת המכשיר.',
  vendor_auth_version: 'המכשיר מבקש גרסת אימות של היצרן שאינה נתמכת. אם הכניסה נכשלת, החליפו בשרת ה־API של המכשיר את סוג ההצפנה.',
};
/** 422 answers that name one field (`details.field`): the line is short and the field is marked invalid. */
const FIELD_CODES = new Set(['host_refused', 'host_invalid', 'port_refused', 'port_invalid', 'username_invalid', 'username_required', 'password_required']);
/** Failures of an unreachable NVR: the only ones that may be saved after a typed confirmation (D6). */
const UNREACHABLE = new Set(['source_unavailable', 'timeout']);

/**
 * CR-022: the NVR connection form, one component for the setup wizard and the settings card. The vendor comes from the
 * server's catalogue (a vendor still `planned` is listed as "בקרוב" and cannot be chosen); the fields follow the chosen
 * vendor. The password is write-only: the form never holds the stored one ("הוגדרה סיסמה" + "שנה") and clears what was typed
 * after a save. Save runs the read-only test on the server first; an unreachable NVR can be saved only after typing the word
 * "שמור". A vendor change with cameras needs "הסר NVR" first (the cameras stay, disabled). Holders of system.configure only.
 * Fires `nvr-connection-saved` (detail: the save result) and `nvr-connection-removed`; a restart is then required, which the
 * shell's banner shows (announceRestartPending).
 * CR-024 (multi-NVR): `recorderId` names the recorder (default the first, whose routes are the CR-022 ones); `context="add"` is
 * the "הוסף NVR" sheet: a name field, no "ללא NVR" choice, and the save adds a recorder (`nvr-recorder-added`).
 */
@customElement('nvr-connection-form')
export class NvrConnectionForm extends LitElement {
  /** `wizard`: the form is always open (the step is about choosing); `settings`: a summary first, the form on "עריכה". */
  @property() context: 'settings' | 'wizard' | 'add' = 'settings';
  /** CR-024: the recorder this form edits (ignored in `add`). */
  @property({ attribute: 'recorder-id' }) recorderId = PRIMARY_RECORDER;
  @state() private addName = '';
  @state() private loadState: 'loading' | 'ready' | 'error' = 'loading';
  @state() private loadError = '';
  @state() private view: NvrConnection | null = null;
  @state() private vendors: Vendor[] = [];
  @state() private draft: Draft = { ...EMPTY };
  @state() private editing = false;
  @state() private changePassword = false;
  @state() private busy: '' | 'test' | 'save' | 'remove' = '';
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  @state() private testLine: { ok: boolean; text: string } | null = null;
  /** The last failure was an unreachable NVR: "שמור בכל זאת" is offered. */
  @state() private offerUntested = false;
  @state() private untestedOpen = false;
  @state() private removeOpen = false;
  @state() private word = '';
  /** The server answered `remove_first` (a vendor change with cameras present). */
  @state() private lockedByServer = false;
  /** Someone else changed the connection meanwhile (409 stale): the form offers "טען מחדש" and sends nothing until then. */
  @state() private stale = false;
  /** The field a 422 answer named (`details.field`): marked `aria-invalid` until the draft changes. */
  @state() private invalidField = '';
  /** CR-025: the last test's transport facts, warnings and certificate (cleared when the draft changes). */
  @state() private lastTest: TestResult | null = null;
  @state() private dismissed: string[] = [];
  @state() private advancedOpen = false;

  /** Phone: 44 px targets (the large button size) - the product's touch rule; elsewhere the compact size. */
  private readonly mq = window.matchMedia('(max-width: 767px)');
  private readonly onMq = () => this.requestUpdate();
  private get btn(): 'sm' | 'lg' {
    return this.mq.matches ? 'lg' : 'sm';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq.removeEventListener('change', this.onMq);
  }

  connectedCallback() {
    super.connectedCallback();
    this.mq.addEventListener('change', this.onMq);
    if (isApi() && can('system.configure') && !onRemote()) void this.load();
  }

  private async load() {
    this.loadState = 'loading';
    try {
      const [vendors, view] = await Promise.all([nvrVendors(), this.loadView()]);
      this.vendors = vendors;
      this.view = view;
      this.loadError = '';
      this.lockedByServer = false;
      this.stale = false;
      this.invalidField = '';
      this.loadState = 'ready';
      this.editing = this.context !== 'settings' || !view.vendor || view.state === 'not_chosen' || view.state === 'unreadable' || view.state === 'refused';
      this.seed();
    } catch (err) {
      this.loadError = describeError(err);
      this.loadState = 'error';
    }
  }

  private get primary(): boolean {
    return this.context !== 'add' && this.recorderId === PRIMARY_RECORDER;
  }

  /** CR-024: the stored view of this recorder; in `add` an empty one (nothing stored yet). */
  private loadView(): Promise<NvrConnection> {
    if (this.context === 'add') {
      return Promise.resolve({
        vendor: null, host: null, http_port: null, rtsp_port: null, username: null, user: null, extra: {}, has_password: false, state: 'not_chosen', source: null,
        revision: 0, updated_at: null, updated_by: null, pending_restart: false, legacy_options_differ: false, in_addon: false, restart: 'manual', cameras: 0, vendor_locked: false,
      });
    }
    return this.primary ? nvrConnection() : recorderConnection(this.recorderId);
  }

  /** The draft starts from the stored connection (never a password) - or empty when nothing was chosen. */
  private seed() {
    const v = this.view;
    const known = v?.vendor && this.vendors.some((x) => x.id === v.vendor);
    this.draft = known && v
      ? {
          vendor: String(v.vendor), host: v.host ?? '', http_port: v.http_port ? String(v.http_port) : '', rtsp_port: v.rtsp_port ? String(v.rtsp_port) : '',
          username: v.username ?? '', password: '', extra: { ...(v.extra ?? {}) } as Record<string, string | boolean>,
        }
      : { ...EMPTY, extra: {} };
    this.changePassword = false;
    this.testLine = null;
    this.offerUntested = false;
  }

  private get spec(): Vendor | undefined {
    return this.vendors.find((v) => v.id === this.draft.vendor);
  }

  private label(id: string | null | undefined): string {
    if (!id) return '—';
    return this.vendors.find((v) => v.id === id)?.label ?? id;
  }

  private setDraft(patch: Partial<Draft>) {
    this.draft = { ...this.draft, ...patch };
    this.testLine = null;
    this.offerUntested = false;
    this.msg = null;
    this.invalidField = '';
    this.lastTest = null;
  }

  /** A 422 that names a field (security review contract): mark it; `password_required` - also with `details.reason =
   * destination_changed` - drops the "kept" state so the password has to be typed. Returns the short line, or null. */
  private fieldError(err: unknown): string | null {
    if (!(err instanceof ApiError) || !FIELD_CODES.has(err.code)) return null;
    const field = typeof err.body.details?.field === 'string' ? (err.body.details.field as string) : '';
    if (err.code === 'password_required') {
      this.changePassword = true;
      this.draft = { ...this.draft, password: '' };
    }
    this.invalidField = field;
    return TEST_TEXT[err.code] ?? describeError(err);
  }

  /** 409 `stale` or 422 `revision_required`: the loaded connection is not the current one - send nothing until "טען מחדש". */
  private isStale(err: unknown): boolean {
    return err instanceof ApiError && (err.code === 'stale' || err.code === 'revision_required');
  }

  private chooseVendor(id: string) {
    const spec = this.vendors.find((v) => v.id === id);
    if (!spec || spec.status !== 'available') return;
    const d = this.draft;
    // CR-025: select fields start at their first (default) choice, so what the form shows is what is saved
    const extra: Record<string, string | boolean> = { ...d.extra };
    for (const f of spec.fields) if (f.kind === 'select' && extra[f.key] === undefined && f.options?.length) extra[f.key] = f.options[0][0];
    this.setDraft({
      vendor: id,
      http_port: d.http_port || (spec.default_ports.http_port ? String(spec.default_ports.http_port) : ''),
      rtsp_port: d.rtsp_port || (spec.default_ports.rtsp_port ? String(spec.default_ports.rtsp_port) : ''),
      extra,
    });
  }

  /** Whether the stored password still applies: same vendor as stored, and the installer did not choose to change it. */
  private get keepsStoredPassword(): boolean {
    const v = this.view;
    if (!v?.has_password || v.vendor !== this.draft.vendor || this.changePassword) return false;
    // a changed destination (address or port) never inherits the stored password: it has to be typed again (server rule)
    const d = this.draft;
    return d.host.trim() === (v.host ?? "") && d.http_port.trim() === String(v.http_port ?? "") && d.rtsp_port.trim() === String(v.rtsp_port ?? "");
  }

  private body(): ConnectionBody {
    const d = this.draft;
    if (d.vendor === 'none') return { vendor: 'none' };
    const extra: Record<string, string | number | boolean> = {};
    for (const f of this.spec?.fields ?? []) {
      if (CORE.has(f.key)) continue;
      const val = d.extra[f.key];
      if (val !== undefined && val !== '') extra[f.key] = val;
    }
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    return {
      vendor: d.vendor, host: d.host.trim(), http_port: num(d.http_port), rtsp_port: num(d.rtsp_port), username: d.username.trim(),
      ...(d.password ? { password: d.password } : {}), ...(Object.keys(extra).length ? { extra } : {}),
    };
  }

  /** Required fields present: every `required` field of the vendor (the password counts when one is already stored). */
  private get complete(): boolean {
    const d = this.draft;
    if (!d.vendor) return false;
    if (this.context === 'add' && (!this.addName.trim() || d.vendor === 'none')) return false;
    if (d.vendor === 'none') return true;
    for (const f of this.spec?.fields ?? []) {
      if (!f.required) continue;
      if (f.key === 'password') {
        if (!d.password && !this.keepsStoredPassword) return false;
      } else if (f.key === 'host' && !d.host.trim()) return false;
      else if (f.key === 'username' && !d.username.trim()) return false;
      else if (!CORE.has(f.key) && (d.extra[f.key] === undefined || d.extra[f.key] === '')) return false;
    }
    return true;
  }

  private testText(r: TestResult): string {
    if (r.ok) return ['מחובר', r.model, r.channels != null ? `${r.channels} ערוצים` : null].filter(Boolean).join(' · ');
    return TEST_TEXT[r.code] ?? 'לא ניתן להתחבר';
  }

  private async runTest() {
    if (this.busy || !this.complete || this.draft.vendor === 'none') return;
    this.busy = 'test';
    this.msg = null;
    this.offerUntested = false;
    try {
      const body = { ...this.body(), use_stored_password: this.keepsStoredPassword };
      // a new recorder has nothing stored: its candidate is tested through the first recorder's test route (typed password only)
      const r = this.primary || this.context === 'add' ? await testNvrConnection(this.context === 'add' ? { ...body, use_stored_password: false } : body)
        : await testRecorderConnection(this.recorderId, body);
      this.testLine = { ok: r.ok, text: this.testText(r) };
      this.offerUntested = !r.ok && UNREACHABLE.has(r.code);
      this.lastTest = r;
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      this.testLine = { ok: false, text: this.fieldError(err) ?? TEST_TEXT[code] ?? describeError(err) };
    } finally {
      this.busy = '';
    }
  }

  private async save(untested = false) {
    if (this.busy || !this.complete) return;
    this.busy = 'save';
    this.msg = null;
    this.testLine = null;
    try {
      const extra = untested ? { save_untested: true, confirm_text: SAVE_WORD } : {};
      if (this.context === 'add') {
        const added = await addRecorder({ ...this.body(), name: this.addName.trim(), ...extra });
        this.untestedOpen = false;
        this.word = '';
        this.draft = { ...EMPTY, extra: {} };
        this.addName = '';
        this.msg = { tone: 'ok', text: added.untested ? 'נוסף בלי בדיקת חיבור' : ['נוסף', added.device?.model].filter(Boolean).join(' · ') };
        announceRestartPending(true);
        this.dispatchEvent(new CustomEvent('nvr-recorder-added', { bubbles: true, composed: true, detail: added }));
        return;
      }
      const body = { ...this.body(), if_revision: this.view?.revision ?? 0, ...extra };
      const r: SaveResult = this.primary ? await saveNvrConnection(body) : await saveRecorderConnection(this.recorderId, body);
      if (r.new_recorder) {
        // CR-024: a different device than the removed first recorder - saved under a new id; this form keeps showing the first recorder
        this.untestedOpen = false;
        this.word = '';
        await this.load();
        this.msg = { tone: 'ok', text: 'נשמר כ־NVR חדש' };
        announceRestartPending(true);
        this.dispatchEvent(new CustomEvent('nvr-connection-saved', { bubbles: true, composed: true, detail: r }));
        return;
      }
      this.view = r;
      this.editing = this.context === 'wizard';
      this.untestedOpen = false;
      this.word = '';
      this.seed(); // the typed password is gone: the form never keeps it
      this.msg = {
        tone: 'ok',
        text: r.vendor === 'none' ? 'נשמר: ללא NVR' : r.untested ? 'נשמר בלי בדיקת חיבור' : ['החיבור נבדק ונשמר', r.device?.model, r.device?.channels != null ? `${r.device.channels} ערוצים` : null].filter(Boolean).join(' · '),
      };
      announceRestartPending(true);
      this.dispatchEvent(new CustomEvent('nvr-connection-saved', { bubbles: true, composed: true, detail: r }));
    } catch (err) {
      this.untestedOpen = false;
      this.word = '';
      const fieldLine = this.fieldError(err);
      if (this.isStale(err)) {
        this.msg = { tone: 'err', text: describeError(err) };
        this.stale = true;
      } else if (fieldLine) {
        this.msg = { tone: 'err', text: fieldLine };
      } else {
        if (err instanceof ApiError && err.code === 'remove_first') this.lockedByServer = true;
        this.msg = { tone: 'err', text: describeError(err) };
        this.offerUntested = err instanceof ApiError && err.body.details?.can_save_untested === true;
      }
    } finally {
      this.busy = '';
    }
  }

  private async removeNvr() {
    if (this.busy || this.word.trim() !== REMOVE_WORD) return;
    this.busy = 'remove';
    this.msg = null;
    try {
      if (this.primary) await removeNvrConnection(this.word.trim(), this.view?.revision ?? 0);
      else await removeRecorder(this.recorderId, this.word.trim(), this.view?.revision ?? 0);
      this.removeOpen = false;
      this.word = '';
      announceRestartPending(true);
      await this.load();
      this.msg = { tone: 'ok', text: 'ה־NVR הוסר' };
      this.dispatchEvent(new CustomEvent('nvr-connection-removed', { bubbles: true, composed: true }));
    } catch (err) {
      this.removeOpen = false;
      this.msg = { tone: 'err', text: describeError(err) };
      if (this.isStale(err)) this.stale = true;
    } finally {
      this.busy = '';
    }
  }

  private cancelEdit() {
    this.editing = false;
    this.seed();
    this.msg = null;
  }

  // ------------------------------------------------------------------ rendering

  private summary(v: NvrConnection) {
    const none = v.vendor === 'none';
    const rows: [string, unknown, string?][] = [['סוג', none ? 'ללא NVR' : this.label(v.vendor)]];
    if (!none) {
      rows.push(['כתובת · פורט HTTP · RTSP', html`<span class="ltr">${v.host ?? '—'} · ${v.http_port ?? '—'} · ${v.rtsp_port ?? '—'}</span>`]);
      rows.push(['משתמש', v.state === 'unreadable' ? 'יש להזין סיסמה מחדש' : html`<span class="ltr">${v.username ?? '—'}</span> · ${v.has_password ? 'הוגדרה סיסמה' : 'חסרה סיסמה'}`, v.has_password ? 'ok' : 'warn']);
    }
    return html`<div data-conn-summary>${rows.map(([k, val, tone]) => html`<div class="row"><span>${k}</span><span class=${`val ${tone ?? ''}`}>${val}</span></div>`)}</div>`;
  }

  private field(f: Vendor['fields'][number]) {
    const d = this.draft;
    const key = f.key;
    if (key === 'password') return this.passwordField(f);
    if (f.kind === 'select') {
      const cur = String(d.extra[key] ?? f.options?.[0]?.[0] ?? '');
      return html`<sw-field label=${f.label}><select data-conn-field=${key} @change=${(e: Event) => this.setDraft({ extra: { ...d.extra, [key]: (e.target as HTMLSelectElement).value } })}>
        ${(f.options ?? []).map(([val, lab]) => html`<option value=${val} ?selected=${val === cur}>${lab}</option>`)}
      </select></sw-field>`;
    }
    if (f.kind === 'bool') {
      return html`<label class="chk"><input type="checkbox" data-conn-field=${key} .checked=${d.extra[key] === true} @change=${(e: Event) => this.setDraft({ extra: { ...d.extra, [key]: (e.target as HTMLInputElement).checked } })} />${f.label}</label>`;
    }
    const isPort = f.kind === 'port';
    const value = key === 'host' ? d.host : key === 'http_port' ? d.http_port : key === 'rtsp_port' ? d.rtsp_port : key === 'username' ? d.username : String(d.extra[key] ?? '');
    const set = (s: string) => this.setDraft(key === 'host' ? { host: s } : key === 'http_port' ? { http_port: s } : key === 'rtsp_port' ? { rtsp_port: s } : key === 'username' ? { username: s } : { extra: { ...d.extra, [key]: s } });
    return html`<sw-field label=${f.label}><input data-ltr data-conn-field=${key} aria-invalid=${this.invalidField === key ? 'true' : 'false'} type=${isPort ? 'number' : 'text'} inputmode=${isPort ? 'numeric' : 'text'} autocomplete="off" autocapitalize="off" spellcheck="false" .value=${value} @input=${(e: Event) => set((e.target as HTMLInputElement).value)} /></sw-field>`;
  }

  /** Write-only: a stored password is "הוגדרה סיסמה" with "שנה"; the input only ever holds what is being typed now. */
  private passwordField(f: Vendor['fields'][number]) {
    if (this.keepsStoredPassword) {
      return html`<div class="pwset" data-conn-password-set><span>${f.label}: הוגדרה סיסמה</span><button type="button" class="linkbtn" data-conn-password-change @click=${() => (this.changePassword = true)}>שנה</button></div>`;
    }
    return html`<sw-field label=${f.label}><input type="password" data-ltr data-conn-field="password" data-conn-password aria-invalid=${this.invalidField === 'password' ? 'true' : 'false'} autocomplete="new-password" .value=${this.draft.password} @input=${(e: Event) => this.setDraft({ password: (e.target as HTMLInputElement).value })} /></sw-field>`;
  }

  /** CR-025: fields that do not apply to the current choices are hidden (HTTPS port / certificate only over HTTPS). */
  private visibleFields(spec: Vendor) {
    const https = this.draft.extra.scheme === 'https';
    return spec.fields.filter((f) => https || !['https_port', 'tls_mode', 'tls_pin', 'suppress_tls_warning'].includes(f.key));
  }

  /** CR-025: what the last test learned - dismissible warnings and the certificate to pin. */
  private testExtras() {
    const r = this.lastTest;
    if (!r) return nothing;
    const warnings = (r.warnings ?? []).filter((w) => WARNING_TEXT[w] && !this.dismissed.includes(w));
    const cert = r.certificate;
    const pinned = this.draft.extra.tls_pin && cert && this.draft.extra.tls_pin === cert.sha256;
    return html`${warnings.map((w) => html`<div class="note warn warnrow" role="note" data-conn-warning=${w}><span>${WARNING_TEXT[w]}</span>
        <button type="button" class="linkbtn" aria-label="סגור" data-conn-warning-dismiss=${w} @click=${() => (this.dismissed = [...this.dismissed, w])}>×</button></div>`)}
      ${cert ? html`<div class="note cert" data-conn-certificate>
          <span>תעודת המכשיר${cert.self_signed ? ' (חתומה עצמית)' : ''}: <span class="ltr mono">${cert.sha256.slice(0, 16)}…</span>${cert.matches_pin === false ? html` · <b>שונה מהתעודה שננעצה</b>` : nothing}</span>
          ${pinned ? html`<span class="ok">ננעצה</span>` : html`<button type="button" class="linkbtn" data-conn-pin @click=${() => this.setDraft({ extra: { ...this.draft.extra, tls_mode: 'pin', tls_pin: cert.sha256 } })}>נעץ תעודה זו</button>`}
        </div>` : nothing}`;
  }

  private form(v: NvrConnection) {
    const d = this.draft;
    const spec = this.spec;
    const locked = v.vendor_locked || this.lockedByServer;
    return html`<div class="form" data-nvr-connection-form>
      ${this.context === 'add'
        ? html`<sw-field label="שם"><input data-conn-name maxlength="60" autocomplete="off" .value=${this.addName} @input=${(e: Event) => { this.addName = (e.target as HTMLInputElement).value; this.msg = null; }} /></sw-field>`
        : nothing}
      <sw-field label="סוג NVR">
        <select data-conn-vendor ?disabled=${v.vendor_locked || this.busy !== ''} @change=${(e: Event) => this.chooseVendor((e.target as HTMLSelectElement).value)}>
          <option value="" disabled ?selected=${!d.vendor}>בחרו סוג NVR</option>
          ${this.vendors.filter((x) => this.primary || x.id !== 'none').map((x) => html`<option value=${x.id} ?disabled=${x.status !== 'available'} ?selected=${x.id === d.vendor}>${x.label}${x.status !== 'available' ? ' · בקרוב' : ''}</option>`)}
        </select>
      </sw-field>
      ${locked ? html`<div class="note" data-conn-vendor-locked>יש להסיר את ה־NVR לפני החלפת סוג</div>` : nothing}
      ${v.state === 'unreadable' ? html`<div class="note warn" data-conn-unreadable>יש להזין סיסמה מחדש</div>` : nothing}
      ${v.state === 'refused' ? html`<div class="note warn" data-conn-refused>הכתובת השמורה אינה מותרת - יש להזין כתובת מחדש</div>` : nothing}
      ${spec && spec.fields.length ? html`<div class="grid">${this.visibleFields(spec).filter((f) => !f.advanced).map((f) => this.field(f))}</div>` : nothing}
      ${spec && spec.fields.some((f) => f.advanced) ? html`<details class="adv" data-conn-advanced ?open=${this.advancedOpen} @toggle=${(e: Event) => (this.advancedOpen = (e.target as HTMLDetailsElement).open)}>
          <summary>הגדרות מתקדמות</summary><div class="grid">${this.visibleFields(spec).filter((f) => f.advanced).map((f) => this.field(f))}</div></details>` : nothing}
      ${this.testLine ? html`<div class=${`line ${this.testLine.ok ? 'ok' : 'err'}`} role="status" data-conn-test-result data-ok=${String(this.testLine.ok)}>${this.testLine.text}</div>` : nothing}
      ${this.testExtras()}
      <div class="actions">
        ${d.vendor && d.vendor !== 'none' ? html`<sw-button size=${this.btn} icon="activity" ?disabled=${!this.complete || this.busy !== ''} data-conn-test @click=${() => this.runTest()}>${this.busy === 'test' ? 'בודק…' : 'בדוק חיבור'}</sw-button>` : nothing}
        <sw-button size=${this.btn} variant="primary" icon="check" ?disabled=${!this.complete || this.busy !== '' || this.stale} data-conn-save @click=${() => this.save()}>${this.busy === 'save' ? 'שומר…' : this.context === 'add' ? 'הוסף' : 'שמור'}</sw-button>
        ${this.offerUntested ? html`<sw-button size=${this.btn} variant="ghost" data-conn-save-anyway ?disabled=${this.busy !== ''} @click=${() => { this.word = ''; this.untestedOpen = true; }}>שמור בכל זאת</sw-button>` : nothing}
        ${this.context === 'settings' && !(this.view?.state === 'not_chosen' || !this.view?.vendor) ? html`<sw-button size=${this.btn} variant="ghost" ?disabled=${this.busy !== ''} data-conn-cancel @click=${() => this.cancelEdit()}>ביטול</sw-button>` : nothing}
      </div>
    </div>`;
  }

  render() {
    if (!isApi() || !can('system.configure')) return nothing;
    if (onRemote()) return html`<p class="note" data-nvr-local-only role="status">${LOCAL_ONLY_TEXT}</p>`;
    if (this.loadState === 'loading') return html`<sw-state-panel state="loading" compact heading="קורא את פרטי החיבור…"></sw-state-panel>`;
    if (this.loadState === 'error' || !this.view) return html`<sw-state-panel state="error" compact heading="פרטי החיבור לא נטענו" hint=${this.loadError} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    const v = this.view;
    const hasConnection = !!v.vendor && v.state !== 'not_chosen';
    return html`<div class="wrap" data-conn-form-root data-conn-state=${v.state}>
      ${!this.editing && hasConnection ? this.summary(v) : nothing}
      ${v.legacy_options_differ && !this.editing ? html`<div class="note" data-conn-legacy>פרטי חיבור ישנים בתשתית המערכת אינם בשימוש</div>` : nothing}
      ${this.editing ? this.form(v) : html`<div class="actions">
          <sw-button size=${this.btn} icon="edit" data-conn-edit @click=${() => { this.seed(); this.editing = true; this.msg = null; }}>עריכה</sw-button>
          ${v.vendor && v.vendor !== 'none' ? html`<sw-button size=${this.btn} variant="danger" icon="trash" data-conn-remove @click=${() => { this.word = ''; this.removeOpen = true; }}>הסר NVR</sw-button>` : nothing}
        </div>`}
      ${this.editing && hasConnection && v.vendor !== 'none' && this.context === 'settings' ? html`<div class="actions"><sw-button size=${this.btn} variant="danger" icon="trash" data-conn-remove ?disabled=${this.busy !== ''} @click=${() => { this.word = ''; this.removeOpen = true; }}>הסר NVR</sw-button></div>` : nothing}
      ${this.msg ? html`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-conn-msg>${this.msg.text}</div>` : nothing}
      ${this.stale ? html`<div class="actions"><sw-button size=${this.btn} icon="refresh" data-conn-reload @click=${() => void this.load()}>טען מחדש</sw-button></div>` : nothing}
      ${this.untestedOpen
        ? html`<sw-dialog open heading="שמירה בלי בדיקת חיבור" subheading="לא ניתן להתחבר ל־NVR כרגע" data-conn-untested-dialog @close=${() => (this.untestedOpen = false)}>
            <sw-field label=${`לאישור הקלידו „${SAVE_WORD}”`}><input data-ltr data-conn-untested-word autocomplete="off" .value=${this.word} @input=${(e: Event) => (this.word = (e.target as HTMLInputElement).value)} /></sw-field>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.busy !== '' || this.word.trim() !== SAVE_WORD} data-conn-untested-confirm @click=${() => this.save(true)}>${this.busy === 'save' ? 'שומר…' : 'שמור'}</sw-button><sw-button variant="ghost" @click=${() => (this.untestedOpen = false)}>ביטול</sw-button></div>
          </sw-dialog>`
        : nothing}
      ${this.removeOpen
        ? html`<sw-dialog open heading="הסרת NVR" subheading="המצלמות יישארו במערכת ויושבתו" data-conn-remove-dialog @close=${() => (this.removeOpen = false)}>
            <sw-field label=${`להסרה הקלידו „${REMOVE_WORD}”`}><input data-ltr data-conn-remove-word autocomplete="off" .value=${this.word} @input=${(e: Event) => (this.word = (e.target as HTMLInputElement).value)} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.busy !== '' || this.word.trim() !== REMOVE_WORD} data-conn-remove-confirm @click=${() => this.removeNvr()}>${this.busy === 'remove' ? 'מסיר…' : 'הסר NVR'}</sw-button><sw-button variant="ghost" @click=${() => (this.removeOpen = false)}>ביטול</sw-button></div>
          </sw-dialog>`
        : nothing}
    </div>`;
  }

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .wrap,
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .val {
      color: var(--sw-text-2);
      text-align: end;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .val.ok {
      color: var(--sw-success, #15803d);
    }
    .val.warn {
      color: var(--sw-warning, #b45309);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .note,
    .line {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .note.warn {
      color: var(--sw-warning-text, var(--sw-warning));
    }
    .line.ok {
      color: var(--sw-success, #15803d);
    }
    .line.err {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    .pwset {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      min-block-size: 44px;
    }
    .linkbtn {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      color: var(--sw-accent-text, var(--sw-accent));
      font-weight: var(--sw-fw-semibold);
      padding-inline: 12px;
      min-inline-size: 44px;
      min-block-size: 44px;
      display: inline-grid;
      place-items: center;
    }
    .linkbtn:focus-visible {
      outline: 2px solid var(--sw-accent);
      border-radius: 6px;
    }
    .adv summary {
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      min-block-size: 32px;
      display: flex;
      align-items: center;
    }
    .adv .grid {
      margin-block-start: 8px;
    }
    .warnrow,
    .cert {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .cert .ok {
      color: var(--sw-success, #15803d);
    }
    .mono {
      font-family: var(--sw-font-mono, monospace);
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      input:not([type='checkbox']),
      select {
        min-block-size: 44px;
      }
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-connection-form': NvrConnectionForm;
  }
}
