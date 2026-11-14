import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-page';
import '../components/sw-cast-stop';
import {
  castAdminScreens, castCheckOrigin, castConfig, castPutConfig, castPutScreen, castTargets, castTest,
  type CastAdminScreen, type CastConfigAnswer, type CastConfigPatch, type CastScreenSettings, type CastTargets,
} from '../api/cast';
import { describeError } from '../api/client';
import { listCameras } from '../api/maps';
import type { Camera } from '../api/types';
import { LOCAL_ONLY_GENERIC, can, canAnywhere, isApi, onRemote } from '../api/session';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { castChip } from './media-cast-label';
import type { CastCapability } from '../api/media-admin';
import { CastWatch, castStore } from '../components/cast-store';
import { BLOCKED_DISPLAY_LABEL, CAST_MINUTES, NOT_READY_ADMIN_TEXT, ORIGIN_REASON_TEXT, SCREEN_METHOD_LABEL, STATE_TEXT, BLOCKED_TEXT, leftText, sessionOfTarget } from './cast-logic';
import { t } from '../i18n/he';
import { tr } from '../i18n/msg/system-a';

const flash = (ms = 3000) => new Promise((r) => setTimeout(r, ms));

/**
 * CR-028 הגדרות › מולטימדיה › "שידור למסכים" (administrator, `system.configure`, LOCAL network only - the routes answer 404 on `/arx`): the general
 * card (the switch, the relay origin with its self-check "בדוק", the cap, the default minutes, the main stream, power-off after the stop, how blocked
 * screens show in the picker), one row per screen (allow / method / minutes / permanent / main stream, and the 60-second test cast) and the status of the
 * relay and the bridge. Every change is saved at once and audited server-side (`media.cast.config` / `media.cast.screen`). The settings screens keep the
 * exact technical names (docs/design/UI_COPY_RULES.md).
 */
@customElement('system-cast')
export class SystemCast extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private phase: 'loading' | 'ready' | 'error' | 'forbidden' | 'local' = 'loading';
  @state() private err = '';
  @state() private cfg: CastConfigAnswer | null = null;
  @state() private screens: CastAdminScreen[] = [];
  @state() private origin = '';
  @state() private originBusy = false;
  @state() private originMsg: { ok: boolean; text: string } | null = null;
  @state() private saved = '';
  @state() private cams: Camera[] = [];
  @state() private testFor = '';
  @state() private testCam = '';
  @state() private testBusy = false;
  @state() private testMsg = '';
  private watch = new CastWatch(this);

  static styles = [bubbleChrome, css`
    :host {
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .mono {
      font-family: var(--sw-font-mono);
      direction: ltr;
      unicode-bidi: isolate;
    }
    input[type='text'],
    input[type='number'],
    select {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      max-inline-size: 100%;
    }
    input[type='text'] {
      inline-size: 240px;
      direction: ltr;
      text-align: start;
    }
    input[type='number'] {
      inline-size: 80px;
    }
    .inl {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .bad {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    /* MEDIA-POLISH-2331: the error stays in view at the top while the person scrolls (a save that failed far down the screens list
       used to report above the first card, out of sight); the "נשמר" note floats at the bottom of the window, where it is seen
       whichever row was changed */
    .err {
      position: sticky;
      inset-block-start: var(--sw-s-2);
      z-index: 5;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface));
      border: 1px solid color-mix(in srgb, var(--sw-danger) 30%, transparent);
      box-shadow: var(--sw-shadow-1);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .toast {
      position: fixed;
      z-index: 60;
      inset-inline: 0;
      inset-block-end: var(--sw-s-6);
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100% - var(--sw-s-6));
      padding: var(--sw-s-2) var(--sw-s-4);
      border-radius: var(--sw-r-pill);
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      box-shadow: var(--sw-shadow-3);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    /* the screens table: ONE grid; the header and every row share its columns (subgrid). Each row used to be a grid of its own with
       auto columns, so the header labels and the controls under them never lined up. */
    .sgrid {
      display: grid;
      grid-template-columns: minmax(150px, 1.4fr) repeat(6, auto);
      column-gap: 14px;
      margin-block-start: var(--sw-s-2);
    }
    .scr {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: subgrid;
      row-gap: 8px;
      align-items: center;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .scr:last-child {
      border-block-end: 0;
    }
    .scr .wide {
      grid-column: 1 / -1;
      justify-self: start;
    }
    .scr.head {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      padding-block: 4px;
    }
    .scr .nm {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .scr .nm b {
      font-weight: var(--sw-fw-medium);
    }
    .scr .cl {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .scr .cl .lb {
      display: none;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .test {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 8px 10px;
      border: 1px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
    }
    @media (pointer: coarse) {
      input[type='text'],
      input[type='number'],
      select {
        min-block-size: 44px;
      }
    }
    @media (max-width: 767px) {
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h, 0px) + var(--sw-s-3));
      }
    }
    @media (max-width: 860px) {
      .scr.head {
        display: none;
      }
      .sgrid {
        grid-template-columns: 1fr 1fr;
      }
      .scr .nm {
        grid-column: 1 / -1;
      }
      .scr .cl .lb {
        display: block;
      }
    }
    sw-state-panel {
      min-block-size: 160px;
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    if (!isApi()) {
      this.phase = 'ready';
      return;
    }
    if (onRemote()) {
      this.phase = 'local';
      return;
    }
    if (!can('system.configure')) {
      this.phase = 'forbidden';
      return;
    }
    this.phase = 'loading';
    this.err = '';
    try {
      const [cfg, sc] = await Promise.all([castConfig(), castAdminScreens()]);
      this.cfg = cfg;
      this.screens = sc.screens;
      this.origin = cfg.config.origin ?? '';
      this.phase = 'ready';
      void castStore.refresh();
    } catch (err) {
      this.err = describeError(err);
      this.phase = 'error';
    }
  }

  private note(msg: string) {
    this.saved = msg;
    void flash().then(() => {
      if (this.saved === msg) this.saved = '';
    });
  }

  private async saveCfg(patch: CastConfigPatch) {
    this.err = '';
    try {
      const r = await castPutConfig(patch);
      this.cfg = r;
      this.origin = r.config.origin ?? '';
      this.note(tr('נשמר'));
    } catch (err) {
      const msg = describeError(err);
      await this.load();
      this.err = msg; // a reload clears the message; the person must still read why the value was not kept
    }
  }

  private async checkOrigin() {
    this.originBusy = true;
    this.originMsg = null;
    try {
      const r = await castCheckOrigin();
      this.originMsg = r.ok ? { ok: true, text: tr('הכתובת נבדקה: ה־relay עונה') } : { ok: false, text: ORIGIN_REASON_TEXT[r.reason ?? ''] ?? tr('הבדיקה נכשלה') };
      const c = await castConfig();
      this.cfg = c;
    } catch (err) {
      this.originMsg = { ok: false, text: describeError(err) };
    } finally {
      this.originBusy = false;
    }
  }

  private async saveScreen(s: CastAdminScreen, patch: Partial<CastScreenSettings>) {
    this.err = '';
    try {
      const r = await castPutScreen(s.key, patch);
      this.screens = this.screens.map((x) => (x.key === s.key ? { ...x, settings: r.settings } : x));
      this.note(tr('נשמר'));
    } catch (err) {
      const msg = describeError(err);
      await this.load();
      this.err = msg;
    }
  }

  private async openTest(key: string) {
    this.testFor = this.testFor === key ? '' : key;
    this.testMsg = '';
    if (this.testFor && !this.cams.length) {
      try {
        this.cams = (await listCameras()).cameras.filter((c) => c.enabled && c.can_view_live !== false);
        this.testCam = this.cams[0]?.id ?? '';
      } catch (err) {
        this.testMsg = describeError(err);
      }
    }
  }

  private async runTest(key: string) {
    if (!this.testCam) return;
    this.testBusy = true;
    this.testMsg = '';
    try {
      const r = await castTest({ target_key: key, camera_id: this.testCam });
      castStore.put(r.session);
      this.testMsg = r.status === 'refused' ? tr('המסך סירב לשידור הבדיקה') : tr('שידור בדיקה התחיל (60 שניות)');
    } catch (err) {
      this.testMsg = describeError(err);
    } finally {
      this.testBusy = false;
    }
  }

  private general(c: CastConfigAnswer): TemplateResult {
    const cf = c.config;
    const reason = c.ready ? null : NOT_READY_ADMIN_TEXT[c.reason ?? ''] ?? c.reason;
    return html`<sw-card heading=${tr('שידור למסכים')} data-cast-general>
      <div class="row"><span class="lbl">${tr('שידור מצלמות למסכים')}<span class="muted">${tr('כבוי = אף משתמש לא רואה את הכפתור "שדר למסך"')}</span></span>
        <sw-toggle label=${tr('שידור למסכים')} labelHidden .checked=${cf.enabled} data-cast-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveCfg({ enabled: e.detail.checked })}></sw-toggle></div>
      <div class="row"><span class="lbl">${tr('מצב')}<span class="muted" data-cast-ready>${c.ready ? tr('מוכן לשידור') : reason}</span></span>
        <sw-badge kind=${c.ready ? 'live' : 'stale'} label=${c.ready ? tr('מוכן') : tr('לא מוכן')}></sw-badge></div>
      <div class="row"><span class="lbl">${tr('כתובת המקור (ה־relay ברשת הביתית)')}<span class="muted">${tr('http://כתובת-IP:פורט של שרת Home Assistant; המסך מושך משם את התמונה. שם מארח לא מתקבל.')}</span></span>
        <span class="inl"><input type="text" data-cast-origin dir="ltr" aria-label=${tr('כתובת המקור')} placeholder="http://192.168.x.x:18092" .value=${this.origin} @input=${(e: Event) => (this.origin = (e.target as HTMLInputElement).value)} />
          <sw-button size="sm" data-cast-origin-save ?disabled=${this.origin.trim() === (cf.origin ?? '')} @click=${() => void this.saveCfg({ origin: this.origin.trim() })}>${tr('שמור')}</sw-button>
          <sw-button size="sm" variant="primary" data-cast-origin-check ?disabled=${this.originBusy || !cf.origin} @click=${() => void this.checkOrigin()}>${this.originBusy ? tr('בודק…') : tr('בדוק')}</sw-button>
          ${cf.origin_verified_at && !this.originMsg ? html`<span class="ok" data-cast-origin-verified>${tr('נבדקה')}</span>` : nothing}
          ${this.originMsg ? html`<span class=${this.originMsg.ok ? 'ok' : 'bad'} data-cast-origin-result role="status">${this.originMsg.text}</span>` : nothing}</span></div>
      <div class="row"><span class="lbl">${tr('מקסימום שידורים בו־זמנית')}<span class="muted">1-8</span></span>
        <input type="number" min="1" max="8" data-cast-max aria-label=${tr('מקסימום שידורים בו־זמנית')} .value=${String(cf.max_sessions)} @change=${(e: Event) => void this.saveCfg({ max_sessions: Number((e.target as HTMLInputElement).value) })} /></div>
      <div class="row"><span class="lbl">${tr('משך שידור ברירת מחדל')}<span class="muted">${tr('דקות; אפשר להאריך עד {n} פעמים', { n: cf.max_extensions })}</span></span>
        <select data-cast-minutes aria-label=${tr('משך שידור ברירת מחדל')} .value=${String(cf.minutes)} @change=${(e: Event) => void this.saveCfg({ minutes: Number((e.target as HTMLSelectElement).value) })}>
          ${[...new Set([...CAST_MINUTES, cf.minutes])].sort((a, b) => a - b).map((m) => html`<option value=${m} ?selected=${m === cf.minutes}>${tr('{n} דקות', { n: m })}</option>`)}</select></div>
      <div class="row"><span class="lbl">${tr('זרם ראשי (איכות גבוהה)')}<span class="muted">${tr('רק למצלמה ב־H.264 ולמסך שאישר. כבוי = תמיד הזרם המשני.')}</span></span>
        <sw-toggle label=${tr('זרם ראשי')} labelHidden .checked=${cf.allow_main} data-cast-allow-main @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveCfg({ allow_main: e.detail.checked })}></sw-toggle></div>
      <div class="row"><span class="lbl">${tr('כיבוי המסך אחרי העצירה')}<span class="muted">${tr('רק כשהמסך היה כבוי לפני השידור; המשתמש יכול לבטל בעצירה')}</span></span>
        <sw-toggle label=${tr('כיבוי אחרי עצירה')} labelHidden .checked=${cf.power_off_after} data-cast-power-off @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveCfg({ power_off_after: e.detail.checked })}></sw-toggle></div>
      <div class="row"><span class="lbl">${tr('מסכים חסומים בבורר')}<span class="muted">${tr('מסך שהמשתמש לא יכול לשדר אליו')}</span></span>
        <select data-cast-blocked-display aria-label=${tr('מסכים חסומים בבורר')} @change=${(e: Event) => void this.saveCfg({ blocked_display: (e.target as HTMLSelectElement).value as CastConfigPatch['blocked_display'] })}>
          ${Object.entries(BLOCKED_DISPLAY_LABEL).map(([k, v]) => html`<option value=${k} ?selected=${k === cf.blocked_display}>${v}</option>`)}</select></div>
      <div class="row"><span class="lbl">${tr('רכיבים')}<span class="muted" data-cast-parts>relay: ${c.relay.option ? (c.relay.listening ? tr('מאזין (פורט {port})', { port: c.relay.container_port }) : `${tr('מופעל, לא מאזין')}${c.relay.error ? ` · ${c.relay.error}` : ''}`) : tr('כבוי (cast_relay)')} · ${tr('גשר Arx:')} ${c.bridge.paired ? `${tr('גרסה {version}', { version: c.bridge.version ?? '?' })}${c.bridge.ready ? '' : ` · ${tr('נדרש {version}+', { version: c.bridge.required })}`}` : tr('לא מצומד')}</span></span></div>
    </sw-card>`;
  }

  private screenRow(s: CastAdminScreen): TemplateResult {
    const st = s.settings;
    const chip = castChip({ method: s.effective.method, confidence: s.effective.confidence === 'manual' ? 'confirmed' : s.effective.confidence, reason: s.effective.reason, via: s.target_entity_id } as CastCapability);
    const testable = s.approved && s.effective.method === 'cast_hls';
    const test = castStore.open().find((x) => x.device_key === s.key && x.kind === 'test');
    return html`<div class="scr" data-cast-screen=${s.key}>
      <div class="nm"><b>${s.name}</b><span class="muted">${[s.floor_name, s.area_name].filter(Boolean).join(' · ') || '—'}${s.approved ? '' : ' · ' + tr('לא מאושר')}${s.public ? ' · ' + tr('ציבורי') : ''}</span></div>
      <div class="cl">${chip ? html`<sw-badge kind=${chip.kind} label=${chip.label} title=${chip.title}></sw-badge>` : '—'}</div>
      <div class="cl"><span class="lb">${tr('מותר לשדר')}</span><sw-toggle label=${`${tr('מותר לשדר')}: ${s.name}`} labelHidden .checked=${st.allow} data-cast-allow=${s.key} @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveScreen(s, { allow: e.detail.checked })}></sw-toggle></div>
      <div class="cl"><span class="lb">${tr('שיטה')}</span><select aria-label=${`${tr('שיטה')}: ${s.name}`} data-cast-method=${s.key} @change=${(e: Event) => void this.saveScreen(s, { method: (e.target as HTMLSelectElement).value as CastScreenSettings['method'] })}>
        ${Object.entries(SCREEN_METHOD_LABEL).map(([k, v]) => html`<option value=${k} ?selected=${k === st.method}>${v}</option>`)}</select></div>
      <div class="cl"><span class="lb">${tr('משך')}</span><select aria-label=${`${tr('משך')}: ${s.name}`} data-cast-screen-minutes=${s.key} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; void this.saveScreen(s, { minutes: v ? Number(v) : null }); }}>
        <option value="" ?selected=${st.minutes == null}>${tr('ברירת מחדל')}</option>${CAST_MINUTES.map((m) => html`<option value=${m} ?selected=${m === st.minutes}>${tr('{n} דקות', { n: m })}</option>`)}</select></div>
      <div class="cl"><span class="lb">${tr('שידור קבוע')}</span><sw-toggle label=${`${tr('שידור קבוע')}: ${s.name}`} labelHidden .checked=${st.permanent} data-cast-permanent=${s.key} @change=${(e: CustomEvent<{ checked: boolean }>) => void this.saveScreen(s, { permanent: e.detail.checked })}></sw-toggle></div>
      <div class="cl"><span class="lb">${tr('זרם ראשי')}</span><select aria-label=${`${tr('זרם ראשי')}: ${s.name}`} data-cast-screen-main=${s.key} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; void this.saveScreen(s, { allow_main: v === '' ? null : v === 'yes' }); }}>
        <option value="" ?selected=${st.allow_main == null}>${tr('לפי ההתקנה')}</option><option value="yes" ?selected=${st.allow_main === true}>${tr('מותר')}</option><option value="no" ?selected=${st.allow_main === false}>${tr('אסור')}</option></select></div>
      ${testable ? html`<div class="cl wide"><sw-button size="sm" data-cast-test-open=${s.key} @click=${() => void this.openTest(s.key)}>${tr('בדיקת שידור (60 שניות)')}</sw-button></div>` : nothing}
      ${this.testFor === s.key
        ? html`<div class="test" data-cast-test-panel=${s.key}>
            <label class="inl">${tr('מצלמה')} <select data-cast-test-camera .value=${this.testCam} @change=${(e: Event) => (this.testCam = (e.target as HTMLSelectElement).value)}>${this.cams.map((c) => html`<option value=${c.id} ?selected=${c.id === this.testCam}>${c.alias || c.name}</option>`)}</select></label>
            <sw-button size="sm" variant="primary" data-cast-test-run ?disabled=${this.testBusy || !this.testCam || !!test} @click=${() => void this.runTest(s.key)}>${tr('התחל בדיקה')}</sw-button>
            ${test ? html`<span data-cast-test-state>${test.state === 'playing' ? tr('משדר') : test.state === 'not_confirmed' ? tr('המסך לא הגיע לזרם') : tr('מתחבר…')} · ${leftText(test, castStore.now)}</span><sw-cast-stop .session=${test}></sw-cast-stop>` : nothing}
            ${this.testMsg ? html`<span class="muted" role="status" data-cast-test-msg>${this.testMsg}</span>` : nothing}
          </div>`
        : nothing}
    </div>`;
  }

  render() {
    void this.watch;
    const wrap = (inner: TemplateResult) => html`<div data-system-cast>${inner}</div>`;
    if (!isApi()) return wrap(html`<sw-state-panel icon="cast" state="empty" heading=${tr('שידור למסכים')} hint=${tr('ההגדרות זמינות בהתקנה עם שרת.')}></sw-state-panel>`);
    if (this.phase === 'local') return wrap(html`<sw-state-panel data-cast-admin-state="local" state="forbidden" heading=${tr('שידור למסכים')} hint=${LOCAL_ONLY_GENERIC}></sw-state-panel>`);
    if (this.phase === 'forbidden') return wrap(html`<sw-state-panel data-cast-admin-state="forbidden" state="forbidden" heading=${tr('אין לך הרשאה להגדרות השידור')} hint=${tr('נדרשת ההרשאה להגדרת המערכת.')}></sw-state-panel>`);
    if (this.phase === 'loading') return wrap(html`<sw-state-panel state="loading"></sw-state-panel>`);
    if (this.phase === 'error' || !this.cfg) return wrap(html`<sw-state-panel data-cast-admin-state="error" state="error" heading=${tr('לא ניתן לטעון את הגדרות השידור')} hint=${this.err} actionLabel=${tr('נסה שוב')} @action=${() => void this.load()}></sw-state-panel>`);
    return wrap(html`<div class="stack">
      ${this.err ? html`<div class="err" role="alert" data-cast-err>${this.err}</div>` : nothing}
      ${this.general(this.cfg)}
      <sw-card heading=${tr('מסכים לשידור')} data-cast-screens>
        <div class="muted">${tr('ברירת המחדל: כל מסך כבוי עד שמנהל מפעיל אותו. בדיקת שידור עובדת גם לפני ההפעלה, 60 שניות, על המסך שנבחר בלבד.')}</div>
        ${this.screens.length
          ? html`<div class="sgrid"><div class="scr head" aria-hidden="true"><span>${tr('מסך')}</span><span>${tr('זיהוי')}</span><span>${tr('מותר')}</span><span>${tr('שיטה')}</span><span>${tr('משך')}</span><span>${tr('קבוע')}</span><span>${tr('זרם ראשי')}</span></div>
            ${this.screens.map((s) => this.screenRow(s))}</div>`
          : html`<sw-state-panel icon="cast" state="empty" heading=${tr('לא זוהו מסכים לשידור')}></sw-state-panel>`}
      </sw-card>
      ${this.saved ? html`<div class="toast" role="status" data-cast-saved>${this.saved}</div>` : nothing}
    </div>`);
  }
}

/**
 * CR-028 "המסכים שלי לשידור" (owner Q5 A: a tab of הגדרות › מולטימדיה plus a link from the picker): what the picker shows for this person without a camera -
 * the screens they may cast to with their state, and below them the ones they cannot with the reason (as the installation's `blocked_display` allows).
 * Operators (who cannot open the administrator's settings) reach it at `#/multimedia/cast`. Read only.
 */
@customElement('cast-my-screens')
export class CastMyScreens extends LitElement {
  /** Inside a settings tab: no page frame. */
  @property({ type: Boolean }) embedded = false;
  @state() private phase: 'loading' | 'ready' | 'error' | 'forbidden' = 'loading';
  @state() private err = '';
  @state() private data: CastTargets | null = null;
  private watch = new CastWatch(this);

  static styles = [bubbleChrome, css`
    :host {
      display: block;
    }
    .list {
      display: flex;
      flex-direction: column;
    }
    .it {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .it:last-child {
      border-block-end: 0;
    }
    .ic {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .tx {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
    }
    .nm {
      font-weight: var(--sw-fw-medium);
    }
    .ln {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    /* POLISH4-WP5: a screen that cannot be cast to is shown quieter by its ink, not by a see-through row (opacity took the name below AA) */
    .it.no .nm {
      color: var(--sw-text-2);
    }
    .nm,
    .ln {
      overflow-wrap: anywhere;
    }
    h4 {
      margin-block: 16px 4px;
      margin-inline: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* a phone: the allowed duration drops under the name instead of squeezing it */
    @media (max-width: 767px) {
      .it {
        flex-wrap: wrap;
      }
      .it > .muted {
        flex: 1 0 100%;
        padding-inline-start: 48px;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    if (!isApi()) {
      this.phase = 'ready';
      return;
    }
    if (!canAnywhere('media.cast')) {
      this.phase = 'forbidden';
      return;
    }
    this.phase = 'loading';
    try {
      this.data = await castTargets();
      this.phase = 'ready';
      void castStore.refresh();
    } catch (err) {
      this.err = describeError(err);
      this.phase = 'error';
    }
  }

  private body(): TemplateResult {
    if (!isApi()) return html`<sw-state-panel icon="cast" state="empty" heading=${t('cast.mine')} hint=${tr('זמין בהתקנה עם שרת.')}></sw-state-panel>`;
    if (this.phase === 'loading') return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (this.phase === 'forbidden') return html`<sw-state-panel state="forbidden" data-cast-mine-state="forbidden" heading=${tr('אין לך הרשאת שידור')} hint=${tr('ההרשאה לשדר למסכים ניתנת על ידי מנהל המערכת.')}></sw-state-panel>`;
    if (this.phase === 'error' || !this.data) return html`<sw-state-panel state="error" data-cast-mine-state="error" heading=${tr('לא ניתן לטעון את המסכים')} hint=${this.err} actionLabel=${t('states.retry')} @action=${() => void this.load()}></sw-state-panel>`;
    const d = this.data;
    if (!d.ready) return html`<sw-state-panel icon="cast" state="empty" data-cast-mine-state="notready" heading=${t('cast.notReady')} hint=${can('system.configure') ? t('cast.notReadyAdmin') : ''}></sw-state-panel>`;
    const ok = d.targets.filter((x) => !x.blocked);
    const no = d.targets.filter((x) => x.blocked);
    const item = (x: CastTargets['targets'][number]) => {
      const sess = sessionOfTarget(castStore.sessions, x.casting_session_id ? x.key : '');
      const line = x.blocked ? BLOCKED_TEXT[x.blocked] : x.state === 'casting' && sess?.camera_name ? `${STATE_TEXT.casting}: ${sess.camera_name}` : STATE_TEXT[x.state];
      return html`<div class=${`it ${x.blocked ? 'no' : ''}`} data-cast-mine-item=${x.key}><span class="ic"><sw-icon name=${x.blocked ? 'lock' : 'media'} size=${18}></sw-icon></span>
        <span class="tx"><span class="nm">${x.name}</span><span class="ln">${[x.floor_name, x.area_name].filter(Boolean).join(' · ')}${x.floor_name || x.area_name ? ' · ' : ''}${line}</span></span>
        ${!x.blocked ? html`<span class="muted">${x.permanent_allowed ? tr('משך קבוע אפשרי') + ' · ' : ''}${x.minutes} ${t('cast.minutes')}</span>` : nothing}</div>`;
    };
    return html`<div data-cast-mine-list>
      <div class="muted">${d.active}/${d.max_sessions} · ${t('cast.mine')}</div>
      ${ok.length ? html`<div class="list" data-cast-mine-ok>${ok.map(item)}</div>` : html`<sw-state-panel icon="cast" state="empty" heading=${t('cast.empty')}></sw-state-panel>`}
      ${no.length ? html`<h4>${tr('לא זמינים לי')}</h4><div class="list" data-cast-mine-blocked>${no.map(item)}</div>` : nothing}
    </div>`;
  }

  render() {
    void this.watch;
    if (this.embedded) return html`<sw-card heading=${t('cast.mine')} data-cast-mine>${this.body()}</sw-card>`;
    return html`<sw-page heading=${t('cast.mine')} subheading=${tr('המסכים שאפשר לשדר אליהם מצלמה')}><div data-cast-mine>${this.body()}</div></sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-cast': SystemCast;
    'cast-my-screens': CastMyScreens;
  }
}
