import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-kpi';
import '../components/sw-button';
import '../components/sw-state-panel';
import '../components/sw-dialog';
import '../components/sw-field';
import type { PanelState } from '../components/sw-state-panel';
import type { StateKind } from '../components/sw-badge';
import { can, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import {
  actionOutcome,
  getIntercomOverview,
  getIntercomTtsEngines,
  releaseIntercomDoor,
  signalIntercomCall,
  speakAtIntercom,
  subscribeIntercom,
  type IntercomCallCommand,
  type IntercomCallResult,
  type IntercomFeed,
  type IntercomFeedState,
  type IntercomLock,
  type IntercomOverview,
  type IntercomStation,
  type IntercomTtsEngines,
  type IntercomTtsStatus,
} from '../api/intercom';
import { formatTime, t, UTC_ZONE } from './wiskey-format';

/** A timestamp as epoch milliseconds for ordering; unparseable ones sort last. */
export function instant(ts: string | null | undefined): number {
  const ms = ts ? Date.parse(ts) : NaN;
  return Number.isNaN(ms) ? -Infinity : ms;
}

/** WisKey's door filter (wiskey-v4-overview.ts `WiskeyDoorFilter`). */
type DoorFilter = 'all' | 'online' | 'attention';

const PAGE = 12; // WisKey's entry center never shows more than 12 doors a page (fitWall capacity ceiling)
const POLL_MS = 30000; // WisKey's own panel polls `overview` every 30 s; used here only while the notices are down
const ARM_MS = 4000; // a call control's second tap must follow the first within this long ...
const ARM_MIN_MS = 500; // ... and not sooner: a double-click / double-tap is one gesture, not a confirmation
const UNKNOWN_HOLD_MS = 10_000; // after a release with an unknown outcome, that relay's button waits this long (backend: UNKNOWN_HOLD_S)
const TTS_MAX = 500; // WisKey's own limit (audio_tts.py), after collapsing whitespace

const CALL_LABELS: Record<IntercomCallCommand, string> = { answer: 'מענה', reject: 'דחייה', hangUp: 'סיום שיחה' };

type Tone = 'ok' | 'warn' | 'err';

/** A physical action that did not succeed, as the caller must read it. Only a structured "not sent" / "refused" from
 * the backend is a plain failure; everything else - including a dropped connection or a proxy error, which
 * describeError would show as a plain "no connection" - is "outcome unknown", in amber, never a reassurance that
 * nothing happened (T054 review S4). */
function failure(err: unknown): { tone: Tone; text: string; unknown: boolean } {
  const outcome = actionOutcome(err);
  if (outcome !== 'unknown') return { tone: 'err', text: describeError(err), unknown: false };
  // the backend's own "unknown" message already says what to do; any other failure gets that advice here
  const text =
    err instanceof ApiError && err.body?.details?.outcome === 'unknown'
      ? `לא ידוע אם הפקודה בוצעה: ${err.message}`
      : `לא ידוע אם הפקודה בוצעה: לא התקבלה תשובה ברורה מהשרת (${describeError(err)}). בדקו במצלמה או במקום לפני שמנסים שוב.`;
  return { tone: 'warn', text, unknown: true };
}

/** Only what WisKey's answer says: the device acknowledgement and the call state observed afterwards. */
function callText(c: IntercomCallResult): string {
  const ack = c.acknowledged === true ? 'העמדה אישרה קבלה' : 'לא התקבל אישור קבלה מהעמדה';
  const seen = c.observation === 'unavailable' || !c.observed_state ? 'מצב השיחה אחרי הפקודה לא נקרא' : `מצב שנצפה אחרי הפקודה: ${t(c.observed_state)}${c.observation === 'unchanged' ? ' (לא השתנה)' : ''}`;
  return `${CALL_LABELS[c.command as IntercomCallCommand] ?? c.command} נשלח · ${ack} · ${seen}`;
}

const TTS_REASONS: Record<string, string> = {
  connection_lost: 'החיבור ל־Home Assistant נותק',
  tts_cancelled: 'בוטלה',
  tts_generation_timeout: 'ההקראה לא הוכנה בזמן',
  tts_generation_failed: 'מנוע ההקראה נכשל',
  tts_audio_too_long: 'ההקראה ארוכה מדי',
  tts_playback_failed: 'ההשמעה בעמדה נכשלה',
  audio_busy: 'ערוץ השמע של העמדה תפוס',
};

function ttsText(s: IntercomTtsStatus): string {
  switch (s.state) {
    case 'started':
      return 'הכרזה: נשלחה ל־WisKey';
    case 'generating':
      return 'הכרזה: מכינה את ההקראה…';
    case 'speaking':
      return 'הכרזה: מושמעת בעמדה…';
    case 'completed':
      return 'הכרזה: WisKey סיים להשמיע אותה. אין אישור שנשמעה בפועל.';
    default:
      return `הכרזה: נעצרה (${TTS_REASONS[s.reason ?? ''] ?? s.reason ?? 'ללא סיבה'})`;
  }
}

function lockLabel(station: IntercomStation, lock: IntercomLock): string {
  return station.locks.length > 1 ? lock.name || `מנעול ${lock.physical_index}` : '';
}

const DEMO: IntercomOverview = {
  version: 'demo',
  api_version: 1,
  default_zone: { kind: 'iana', name: 'Asia/Jerusalem' },
  user_count: 48,
  stations: [
    { id: 'd1', name: 'שער ראשי', online: true, call_state: 'ringing', sync_state: 'synced', lock_enabled: true, lock_count: 1, locks: [{ physical_index: 1, name: null }], has_camera: true, last_error: null, last_seen: '2026-09-27T08:00:00+03:00', pending_user_count: 0, managed_user_count: 42, zone: { kind: 'iana', name: 'Asia/Jerusalem' }, last_access: { timestamp: '2026-09-27T07:58:12+03:00', time_source: 'device', person_name: 'דנה כהן', employee_no: '1001', authentication: 'card', result: 'granted', event_type: 'access_granted', recovered: false, door: 1 } },
    { id: 'd2', name: 'לובי', online: true, call_state: 'idle', sync_state: 'synced', lock_enabled: true, lock_count: 2, locks: [{ physical_index: 1, name: 'כניסה' }, { physical_index: 2, name: 'מחסום' }], has_camera: true, last_error: null, last_seen: '2026-09-27T08:00:00+03:00', pending_user_count: 0, managed_user_count: 42, zone: { kind: 'iana', name: 'Asia/Jerusalem' }, last_access: { timestamp: '2026-09-27T07:41:03+03:00', time_source: 'device', person_name: null, employee_no: '2044', authentication: 'pin', result: 'granted', event_type: 'access_granted', recovered: false, door: 2 } },
    { id: 'd3', name: 'חניון', online: true, call_state: 'idle', sync_state: 'pending', lock_enabled: false, lock_count: 0, locks: [], has_camera: true, last_error: null, last_seen: '2026-09-27T08:00:00+03:00', pending_user_count: 3, managed_user_count: 39, zone: { kind: 'iana', name: 'Asia/Jerusalem' }, last_access: { timestamp: '2026-09-26T22:10:40+03:00', time_source: 'received', person_name: null, employee_no: null, authentication: 'unknown', result: 'denied', event_type: 'access_denied', recovered: true, door: null } },
    { id: 'd4', name: 'מחסן', online: false, call_state: 'unavailable', sync_state: 'offline', lock_enabled: true, lock_count: 1, locks: [{ physical_index: 1, name: null }], has_camera: false, last_error: null, last_seen: '2026-09-26T19:02:00+03:00', pending_user_count: 1, managed_user_count: null, zone: null, last_access: null },
  ],
};

/** The honest message for each feed state the entry center cannot show stations in. */
const FEED_PANELS: Record<Exclude<IntercomFeedState, 'ready'>, { panel: PanelState; heading: string; hint: string }> = {
  ha_not_configured: {
    panel: 'stale',
    heading: 'WisKey אינו מחובר בסביבה הזו',
    hint: 'ל־SMPLWISE אין כאן גישה ל־Home Assistant, ולכן אין נתוני אינטרקום להצגה. בתוך Home Assistant המסך מתחבר לאינטגרציית WisKey (hikvision_intercom) מעצמו.',
  },
  connecting: { panel: 'loading', heading: 'מתחבר ל־WisKey…', hint: 'הנתונים יופיעו ברגע ש־Home Assistant יענה.' },
  ha_unavailable: { panel: 'stale', heading: 'Home Assistant אינו זמין כרגע', hint: 'אין חיבור ל־Home Assistant, ולכן אין נתוני אינטרקום עדכניים. החיבור מתחדש אוטומטית.' },
  not_installed: {
    panel: 'empty',
    heading: 'אינטגרציית WisKey אינה מותקנת ב־Home Assistant',
    hint: 'Home Assistant לא מכיר את הפקודות של WisKey (hikvision_intercom). אחרי התקנה המסך יתחבר אליה מעצמו תוך כמה דקות.',
  },
  forbidden: { panel: 'forbidden', heading: 'WisKey דחה את הגישה של SMPLWISE', hint: 'המשתמש של ה־Add-on ב־Home Assistant אינו מורשה בהרשאות של WisKey, ולכן אין נתונים להצגה.' },
  error: { panel: 'error', heading: 'WisKey החזיר שגיאה', hint: 'הבקשה ל־WisKey לא הושלמה. הניסיון יחזור אוטומטית.' },
};

/**
 * WisKey tab: the entry center (CR-005 phase 1a, read-only). Ported from the owner's WisKey frontend - the WisKey 04
 * overview (`wiskeyOverview()`, wiskey-v4-overview.ts: stats, search, door filter, door grid, recent activity,
 * attention) and the station last-access block (panel.ts `lastAccess()`) - with WisKey's `hass.callWS` replaced by the
 * SMPLWISE API and WisKey's styles replaced by SMPLWISE's own components.
 *
 * Phase 3 (owner-approved, `access.release` only): per-door physical actions - release (behind a confirmation dialog,
 * which WisKey's own panel does not have), call answer / reject / hang up (two taps: the first arms, the second sends;
 * shown only while the station is ringing or in a call), and a spoken announcement composed in a dialog. Each result is
 * shown as exactly what WisKey said - a release is "accepted", never "the door opened". No camera or edit controls.
 */
@customElement('wiskey-overview')
export class WiskeyOverview extends LitElement {
  @state() private feed: IntercomFeed | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private query = '';
  @state() private filter: DoorFilter = 'all';
  @state() private page = 0;
  // physical actions
  @state() private confirmRelease: { station: IntercomStation; lock: IntercomLock } | null = null;
  @state() private releasing = new Set<string>(); // `${station}/${lock}` releases waiting for WisKey
  @state() private results: Record<string, { tone: Tone; text: string }> = {}; // per station: the last action's outcome
  @state() private held: Record<string, number> = {}; // `${station}/${lock}` -> until when a release stays blocked (unknown outcome)
  @state() private callBusy = new Set<string>();
  /** The armed call control: which station and command, when (performance.now) and in which call state it was armed. */
  @state() private armed: { id: string; command: IntercomCallCommand; at: number; callState: string } | null = null;
  private holdTimer = 0;
  @state() private speakFor: IntercomStation | null = null;
  @state() private engines: IntercomTtsEngines | null = null;
  @state() private enginesNote = '';
  @state() private ttsEngine = '';
  @state() private ttsLanguage = '';
  @state() private ttsMessage = '';
  @state() private ttsBusy = false;
  @state() private ttsError = '';
  @state() private ttsStatus: Record<string, IntercomTtsStatus> = {};
  private armTimer = 0;
  private stop: (() => void) | null = null;
  private poll = 0;
  private loading = false;
  private loadAgain = false;

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    if (!can('access.read')) {
      this.forbidden = true;
      return;
    }
    void this.load();
    this.stop = subscribeIntercom(
      (m) => {
        if (m.type === 'intercom_tts') this.ttsStatus = { ...this.ttsStatus, [m.status.station_id]: m.status };
        else if (m.type !== 'heartbeat') void this.load();
      },
      (connected) => {
        this.setPolling(!connected);
        if (connected) void this.load(); // notices sent while the socket was down are gone: catch up now
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop?.();
    this.stop = null;
    this.setPolling(false);
    window.clearTimeout(this.armTimer);
    window.clearTimeout(this.holdTimer);
  }

  private setPolling(on: boolean) {
    window.clearInterval(this.poll);
    this.poll = on ? window.setInterval(() => void this.load(), POLL_MS) : 0;
  }

  /** Single-flight refetch with coalescing, as WisKey's own `refresh()` (`_refreshAgain`). */
  private async load() {
    if (this.loading) {
      this.loadAgain = true;
      return;
    }
    this.loading = true;
    try {
      do {
        this.loadAgain = false;
        try {
          this.feed = await getIntercomOverview();
          this.error = '';
          this.dropStaleArm();
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) this.forbidden = true;
          else this.error = describeError(err);
        }
      } while (this.loadAgain);
    } finally {
      this.loading = false;
    }
  }

  // ------------------------------------------------------------------ physical actions (access.release)

  /** The stricter permission: `access.read` shows the doors, only `access.release` acts on them. */
  private canAct(): boolean {
    return isApi() && can('access.release');
  }

  private setResult(stationId: string, tone: Tone, text: string) {
    this.results = { ...this.results, [stationId]: { tone, text } };
  }

  private isHeld(key: string): boolean {
    return (this.held[key] ?? 0) > Date.now();
  }

  /** After an unknown outcome the relay's button waits (the backend holds the relay too): nobody fires a second release
   * straight into an ambiguous state. */
  private hold(key: string) {
    this.held = { ...this.held, [key]: Date.now() + UNKNOWN_HOLD_MS };
    window.clearTimeout(this.holdTimer);
    this.holdTimer = window.setTimeout(() => (this.held = { ...this.held }), UNKNOWN_HOLD_MS + 50); // re-render when it ends
  }

  private askRelease(station: IntercomStation, lock: IntercomLock) {
    const key = `${station.id}/${lock.physical_index}`;
    if (this.releasing.has(key) || this.isHeld(key)) return;
    this.confirmRelease = { station, lock };
  }

  /** Runs only from the confirmation dialog's own button: the release is never one click away. */
  private async doRelease() {
    const c = this.confirmRelease;
    if (!c) return;
    const key = `${c.station.id}/${c.lock.physical_index}`;
    if (this.releasing.has(key) || this.isHeld(key)) return;
    this.releasing = new Set([...this.releasing, key]);
    try {
      // a success reply always means `accepted: true` (anything else is raised as "outcome unknown" by the backend)
      await releaseIntercomDoor(c.station.id, c.lock.physical_index);
      const at = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.setResult(c.station.id, 'ok', `הפקודה נשלחה ו־WisKey קיבל אותה (${at}). אין אישור שהדלת נפתחה בפועל - בדקו במצלמה או במקום.`);
    } catch (err) {
      const f = failure(err);
      this.setResult(c.station.id, f.tone, f.text);
      if (f.unknown) this.hold(key);
    } finally {
      const next = new Set(this.releasing);
      next.delete(key);
      this.releasing = next;
      if (this.confirmRelease === c) this.confirmRelease = null;
    }
  }

  /** Call controls take two taps: the first arms the button for ARM_MS, the second sends. Lighter than the release
   * dialog - the operator is already dealing with a ringing call - but never a single stray gesture: the second click
   * of a double-click (`detail > 1`) and any tap sooner than ARM_MIN_MS after arming are ignored, and an arm is only
   * good for the call state it was made in (see dropStaleArm). */
  private onCall(e: MouseEvent, station: IntercomStation, command: IntercomCallCommand) {
    if (this.callBusy.has(station.id) || this.feed?.state !== 'ready') return;
    if (e.detail > 1) return; // the 2nd (3rd ...) click of one multi-click: the same gesture as the arming click
    const a = this.armed;
    if (a && a.id === station.id && a.command === command && a.callState === station.call_state) {
      if (performance.now() - a.at < ARM_MIN_MS) return; // too quick to be a deliberate second tap
      window.clearTimeout(this.armTimer);
      this.armed = null;
      void this.sendCall(station, command);
      return;
    }
    window.clearTimeout(this.armTimer);
    this.armed = { id: station.id, command, at: performance.now(), callState: station.call_state };
    this.armTimer = window.setTimeout(() => (this.armed = null), ARM_MS);
  }

  /** An arm belongs to the call it was made for: when that station's call state changed (answered elsewhere, ended,
   * went offline), the arm is dropped - never left to fire against a call that no longer exists. */
  private dropStaleArm() {
    const a = this.armed;
    if (!a) return;
    const s = this.feed?.overview?.stations.find((x) => x.id === a.id);
    if (this.feed?.state !== 'ready' || !s || !s.online || s.call_state !== a.callState) {
      window.clearTimeout(this.armTimer);
      this.armed = null;
    }
  }

  private async sendCall(station: IntercomStation, command: IntercomCallCommand) {
    this.callBusy = new Set([...this.callBusy, station.id]);
    try {
      const r = await signalIntercomCall(station.id, command);
      if (r.call) this.setResult(station.id, r.call.acknowledged === true ? 'ok' : 'warn', callText(r.call));
    } catch (err) {
      const f = failure(err);
      this.setResult(station.id, f.tone, f.text);
    } finally {
      const next = new Set(this.callBusy);
      next.delete(station.id);
      this.callBusy = next;
      void this.load(); // the call state changed (or should have): WisKey's own panel refetches too
    }
  }

  private openSpeak(station: IntercomStation) {
    this.speakFor = station;
    this.ttsMessage = '';
    this.ttsError = '';
    if (!this.engines) void this.loadEngines();
  }

  private async loadEngines() {
    this.enginesNote = '';
    try {
      const r = await getIntercomTtsEngines();
      if (r.tts) {
        this.engines = r.tts;
        this.pickEngine(r.tts.default && r.tts.engines.some((e) => e.engine_id === r.tts!.default) ? r.tts.default : (r.tts.engines[0]?.engine_id ?? ''));
        if (!r.tts.engines.length) this.enginesNote = 'אין ב־Home Assistant מנוע הקראה (TTS) ש־WisKey יכול להשתמש בו.';
      } else {
        this.enginesNote = r.state === 'unsupported' ? 'גרסת WisKey המותקנת אינה תומכת בהכרזות.' : `רשימת מנועי ההקראה אינה זמינה כרגע (${r.last_error ?? r.state}).`;
      }
    } catch (err) {
      this.enginesNote = describeError(err);
    }
  }

  /** WisKey's own choice of language (tts-controls.ts:354-366): Hebrew when the engine has it, else its default. */
  private pickEngine(engineId: string) {
    this.ttsEngine = engineId;
    const e = this.engines?.engines.find((x) => x.engine_id === engineId);
    const langs = e?.supported_languages ?? [];
    this.ttsLanguage = langs.includes('he') ? 'he' : langs.includes('iw') ? 'iw' : (e?.default_language ?? langs[0] ?? '');
  }

  private async speak() {
    const station = this.speakFor;
    const message = this.ttsMessage.split(/\s+/).filter(Boolean).join(' ');
    if (!station || this.ttsBusy || !this.ttsEngine || !message || message.length > TTS_MAX) return;
    this.ttsBusy = true;
    this.ttsError = '';
    try {
      const r = await speakAtIntercom(station.id, { engine_id: this.ttsEngine, language: this.ttsLanguage || null, message });
      // the notice socket can deliver later progress before this reply: never step back from it
      const seen = this.ttsStatus[station.id];
      const rank = (s: IntercomTtsStatus) => ['started', 'generating', 'speaking', 'completed', 'closed'].indexOf(s.state);
      if (r.tts && !(seen && seen.at >= r.tts.at && rank(seen) > rank(r.tts))) this.ttsStatus = { ...this.ttsStatus, [station.id]: r.tts };
      this.speakFor = null;
    } catch (err) {
      const f = failure(err);
      if (f.unknown) {
        // it may be playing right now: close the composer (no one-click resend) and say so on the door's card
        this.speakFor = null;
        this.setResult(station.id, f.tone, f.text);
      } else {
        this.ttsError = f.text;
      }
    } finally {
      this.ttsBusy = false;
    }
  }

  // ------------------------------------------------------------------ render

  render() {
    if (!isApi()) return this.renderPage({ state: 'ready', configured: true, fresh: true, fetched_at: null, last_error: null, overview: DEMO }, true);
    if (this.forbidden) {
      return html`<sw-page heading="WisKey" subheading="מרכז הכניסה"><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בבקרת הכניסה" hint="נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    if (!this.feed) {
      return html`<sw-page heading="WisKey" subheading="מרכז הכניסה">${this.error
        ? html`<sw-state-panel data-wiskey-state="load_error" state="error" heading="לא ניתן לטעון את מרכז הכניסה" hint=${this.error}></sw-state-panel>`
        : html`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`;
    }
    return this.renderPage(this.feed, false);
  }

  private renderPage(feed: IntercomFeed, demo: boolean) {
    const ov = feed.overview;
    const sub = `${t('wk4_entry_intro')}${this.canAct() ? '' : ' · צפייה בלבד'}${demo ? ' · נתוני הדגמה' : ''}`;
    return html`<sw-page heading="WisKey · ${t('wk4_entry_center')}" subheading=${sub} wide>
      ${this.renderFeedBadge(feed, demo)}
      ${ov && feed.state !== 'ready' ? this.renderStaleNote(feed) : nothing}
      ${this.error ? html`<div class="note err" role="status">${this.error}</div>` : nothing}
      ${ov ? this.renderOverview(ov) : this.renderFeedPanel(feed)}
      ${this.confirmRelease ? this.renderReleaseConfirm() : nothing}
      ${this.speakFor ? this.renderSpeak() : nothing}
    </sw-page>`;
  }

  private renderReleaseConfirm() {
    const { station, lock } = this.confirmRelease!;
    const name = lockLabel(station, lock);
    const busy = this.releasing.has(`${station.id}/${lock.physical_index}`);
    return html`<sw-dialog open heading="שחרור דלת" subheading=${name ? `${station.name} · ${name}` : station.name} data-wiskey-release-dialog @close=${() => (this.confirmRelease = null)}>
      <p>פקודת שחרור תישלח עכשיו לעמדה <b>${station.name}</b>${name ? html` (${name})` : nothing}. המנעול ישתחרר לזמן שמוגדר בעמדה עצמה, וכל מי שנמצא ליד הדלת יוכל להיכנס.</p>
      <p class="muted">הפעולה נרשמת ביומן הביקורת של SMPLWISE בשמך. תשובת WisKey מאשרת רק שהפקודה התקבלה - לא שהדלת נפתחה בפועל.</p>
      <div slot="footer">
        <sw-button variant="ghost" data-wiskey-release-cancel @click=${() => (this.confirmRelease = null)}>ביטול</sw-button>
        <sw-button variant="danger" icon="unlock" data-wiskey-release-confirm ?disabled=${busy} @click=${() => void this.doRelease()}>${busy ? 'שולח…' : 'שחרר את הדלת'}</sw-button>
      </div>
    </sw-dialog>`;
  }

  private renderSpeak() {
    const station = this.speakFor!;
    const engine = this.engines?.engines.find((e) => e.engine_id === this.ttsEngine);
    const langs = engine?.supported_languages ?? [];
    const length = this.ttsMessage.split(/\s+/).filter(Boolean).join(' ').length;
    const ready = !!engine && length > 0 && length <= TTS_MAX && !this.ttsBusy;
    return html`<sw-dialog open heading="הכרזה בעמדה" subheading=${station.name} data-wiskey-tts-dialog @close=${() => (this.speakFor = null)}>
      <div class="form">
        ${this.engines?.engines.length
          ? html`<sw-field label="מנוע הקראה (Home Assistant)">
                <select data-wiskey-tts-engine .value=${this.ttsEngine} @change=${(e: Event) => this.pickEngine((e.target as HTMLSelectElement).value)}>
                  ${this.engines.engines.map((x) => html`<option value=${x.engine_id} ?selected=${x.engine_id === this.ttsEngine}>${x.name}</option>`)}
                </select>
              </sw-field>
              ${langs.length
                ? html`<sw-field label="שפה">
                    <select data-wiskey-tts-language .value=${this.ttsLanguage} @change=${(e: Event) => (this.ttsLanguage = (e.target as HTMLSelectElement).value)}>
                      ${langs.map((l) => html`<option value=${l} ?selected=${l === this.ttsLanguage}>${l}</option>`)}
                    </select>
                  </sw-field>`
                : nothing}
              <sw-field label="ההודעה" hint=${`${length}/${TTS_MAX}`}>
                <textarea data-wiskey-tts-message rows="3" maxlength=${TTS_MAX} .value=${this.ttsMessage} @input=${(e: Event) => (this.ttsMessage = (e.target as HTMLTextAreaElement).value)}></textarea>
              </sw-field>`
          : html`<div class="muted" data-wiskey-tts-engines-state>${this.enginesNote || 'טוען את מנועי ההקראה…'}</div>`}
        <div class="note info" data-wiskey-tts-external>ההודעה תושמע ברמקול של העמדה ${station.name}. הטקסט נשלח למנוע ההקראה שנבחר ב־Home Assistant - אם זהו שירות ענן, הטקסט יוצא מהמבנה. ההכרזה והטקסט שלה נרשמים ביומן הביקורת בשמך.</div>
        ${this.ttsError ? html`<div class="note err" role="alert" data-wiskey-tts-error>${this.ttsError}</div>` : nothing}
      </div>
      <div slot="footer">
        <sw-button variant="ghost" @click=${() => (this.speakFor = null)}>ביטול</sw-button>
        <sw-button variant="primary" icon="volume" data-wiskey-tts-send ?disabled=${!ready} @click=${() => void this.speak()}>${this.ttsBusy ? 'שולח…' : 'השמע בעמדה'}</sw-button>
      </div>
    </sw-dialog>`;
  }

  private renderFeedBadge(feed: IntercomFeed, demo: boolean) {
    if (demo) return html`<sw-badge slot="actions" kind="neutral" label="נתוני הדגמה"></sw-badge>`;
    const kind: StateKind = feed.state === 'ready' ? 'live' : feed.state === 'connecting' ? 'unknown' : feed.state === 'forbidden' ? 'forbidden' : feed.state === 'error' ? 'error' : 'offline';
    const label = feed.state === 'ready' ? `מחובר ל־WisKey${feed.overview?.version ? ` ${feed.overview.version}` : ''}` : feed.state === 'connecting' ? 'מתחבר' : 'לא מחובר';
    return html`<sw-badge slot="actions" data-wiskey-feed=${feed.state} kind=${kind} label=${label}></sw-badge>`;
  }

  private renderFeedPanel(feed: IntercomFeed) {
    const p = FEED_PANELS[feed.state === 'ready' ? 'error' : feed.state];
    return html`<sw-state-panel data-wiskey-state=${feed.state} state=${p.panel} heading=${p.heading} hint=${p.hint}></sw-state-panel>`;
  }

  private renderStaleNote(feed: IntercomFeed) {
    return html`<div class="note stale" role="status" data-wiskey-stale>
      <sw-icon name="offline" size=${16}></sw-icon>
      <span>${FEED_PANELS[feed.state === 'ready' ? 'error' : feed.state].heading}. מוצג המידע האחרון שהתקבל${feed.fetched_at ? html` (<bdi>${formatTime(feed.fetched_at, 'he-IL', feed.overview?.default_zone ?? UTC_ZONE)}</bdi>)` : nothing} - ייתכן שאינו עדכני.</span>
    </div>`;
  }

  private renderOverview(o: IntercomOverview) {
    // --- ported from wiskeyOverview() (wiskey-v4-overview.ts:41-68)
    const all = o.stations;
    const ringing = all.filter((s) => s.call_state === 'ringing' && s.online);
    const attention = all.filter((s) => !s.online || !!s.last_error || s.pending_user_count > 0);
    const q = this.query.trim().toLocaleLowerCase();
    const matches = all.filter((s) => {
      if (!s.name.toLocaleLowerCase().includes(q)) return false;
      return this.filter === 'all' || (this.filter === 'online' && s.online) || (this.filter === 'attention' && attention.includes(s));
    });
    const pages = Math.max(1, Math.ceil(matches.length / PAGE));
    const page = Math.min(this.page, pages - 1);
    const visible = matches.slice(page * PAGE, (page + 1) * PAGE);
    const events = all
      .filter((s) => s.last_access)
      // by instant, not by text: device time carries the station's own offset, received time is +00:00 (a string
      // sort puts 05:30+00:00 below 07:59+03:00; WisKey's own sort does that, CR-005 fixes it rather than keeps it)
      .sort((a, b) => instant(b.last_access!.timestamp) - instant(a.last_access!.timestamp))
      .slice(0, 5);
    const pending = all.reduce((sum, s) => sum + s.pending_user_count, 0); // panel.ts pendingCount()
    const zone = o.default_zone ?? UTC_ZONE;
    // panel.ts sorts the legacy grid ringing-first; the WisKey 04 grid keeps WisKey's own order
    return html`
      <div class="stats" data-wiskey-stats aria-label="סיכום">
        <sw-kpi icon="door" tone=${all.length && all.every((s) => s.online) ? 'live' : all.some((s) => !s.online) ? 'offline' : 'neutral'} label=${t('online_stations')} value=${`⁦${all.filter((s) => s.online).length} / ${all.length}⁩`}></sw-kpi>
        <sw-kpi icon="users" label=${t('total_users')} value=${String(o.user_count)}></sw-kpi>
        <sw-kpi icon="bell" tone=${ringing.length ? 'stale' : 'neutral'} label=${t('ringing_now')} value=${String(ringing.length)}></sw-kpi>
        <sw-kpi icon="refresh" tone=${pending ? 'stale' : 'neutral'} label=${t('pending_sync')} value=${String(pending)}></sw-kpi>
      </div>
      <div class="layout">
        <div class="main">
          <div class="toolbar">
            <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wiskey-search aria-label=${t('wall_search')} placeholder=${t('wall_search')} .value=${this.query} @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; this.page = 0; }} /></label>
            <div class="filters" role="group" aria-label=${t('wk4_door_filter')}>
              ${(['all', 'online', 'attention'] as const).map((f) => html`<sw-chip data-wiskey-filter=${f} ?selected=${this.filter === f} aria-pressed=${this.filter === f} @click=${() => { this.filter = f; this.page = 0; }}>${t('wk4_filter_' + f)}</sw-chip>`)}
            </div>
            <span class="count" data-wiskey-count>${matches.length} ${t('devices')}</span>
          </div>
          ${matches.length
            ? html`<div class="grid">${repeat(visible, (s) => s.id, (s) => this.renderDoor(s, zone))}</div>`
            : html`<sw-state-panel compact state="empty" data-wiskey-empty heading=${all.length ? 'לא נמצאו דלתות תואמות' : t('no_stations')}></sw-state-panel>`}
          ${pages > 1
            ? html`<div class="pager">
                <sw-button size="sm" variant="ghost" ?disabled=${page === 0} @click=${() => (this.page = page - 1)}>${t('wall_previous')}</sw-button>
                <span role="status"><bdi>${page + 1} / ${pages}</bdi></span>
                <sw-button size="sm" variant="ghost" ?disabled=${page + 1 >= pages} @click=${() => (this.page = page + 1)}>${t('wall_next')}</sw-button>
              </div>`
            : nothing}
        </div>
        <aside class="side">
          <sw-card heading=${t('access_recent_activity')} data-wiskey-activity>
            ${events.length
              ? events.map((s) => html`<div class="event">
                  <strong>${s.last_access!.person_name || t('unknown')}</strong>
                  <small>${s.name} · ${t(s.last_access!.authentication)}</small>
                  <time><bdi>${formatTime(s.last_access!.timestamp, 'he-IL', zone)}</bdi></time>
                </div>`)
              : html`<p class="muted">${t('no_events')}</p>`}
          </sw-card>
          ${attention.length
            ? html`<sw-card heading=${t('access_attention')} data-wiskey-attention>
                <sw-badge slot="actions" kind="stale" label=${String(attention.length)}></sw-badge>
                ${attention.slice(0, 5).map((s) => html`<div class="attn"><strong>${s.name}</strong><small>${!s.online ? t('offline') : s.last_error || t('pending_sync')}</small></div>`)}
              </sw-card>`
            : nothing}
        </aside>
      </div>
    `;
  }

  private renderDoor(s: IntercomStation, zone: typeof UTC_ZONE) {
    const status = !s.online ? 'offline' : s.call_state === 'ringing' ? 'ringing' : 'online';
    const kind: StateKind = status === 'offline' ? 'offline' : status === 'ringing' ? 'stale' : 'live';
    return html`<article class="door ${status}" data-wiskey-door=${s.id} data-status=${status}>
      <div class="door-head">
        <span class="ic"><sw-icon name=${s.online ? 'door' : 'offline'} size=${18}></sw-icon></span>
        <div class="title">
          <b title=${s.name}>${s.name}</b>
          <small>${!s.online && s.last_seen
            ? html`${t('last_seen')}: <bdi>${formatTime(s.last_seen, 'he-IL', zone)}</bdi>`
            : s.pending_user_count
              ? `${t('pending_users')}: ${s.pending_user_count}`
              : t('access_by_permissions')}</small>
        </div>
        <sw-badge kind=${kind} label=${t(status)}></sw-badge>
      </div>
      ${status === 'ringing' ? html`<div class="ring" role="status"><sw-icon name="bell" size=${14}></sw-icon>${t('ringing')}</div>` : nothing}
      <div class="facts">
        <span>${s.lock_enabled ? (s.lock_count > 1 ? `${t('lock_enabled')} · ${s.lock_count}` : t('lock_enabled')) : t('camera_only')}</span>
        <span>סנכרון: ${t(s.sync_state)}</span>
        ${s.online && s.call_state !== 'ringing' ? html`<span>שיחה: ${t(s.call_state)}</span>` : nothing}
      </div>
      ${this.canAct() ? this.renderActions(s) : nothing}
      ${this.renderLastAccess(s)}
    </article>`;
  }

  /** The door's physical controls, for `access.release` holders only. Everything is disabled unless the feed is live
   * (`ready`): a last-known copy is no basis for opening a door. Call controls exist only while the station is ringing
   * (answer / reject) or in a call (hang up), as in WisKey's compact call controls. */
  private renderActions(s: IntercomStation) {
    const live = this.feed?.state === 'ready';
    const locks = s.lock_enabled ? s.locks : [];
    const ringing = s.online && s.call_state === 'ringing';
    const inCall = s.online && s.call_state === 'in_call';
    const result = this.results[s.id];
    const tts = this.ttsStatus[s.id];
    const ttsTone: Tone = tts?.state === 'closed' ? 'warn' : 'ok';
    return html`<div class="actions" data-wiskey-actions=${s.id}>
      ${ringing || inCall
        ? html`<div class="row call" role="group" aria-label="שליטה בשיחה" data-wiskey-call>
            ${(ringing ? (['answer', 'reject'] as const) : (['hangUp'] as const)).map((command) => {
              const armed = this.armed?.id === s.id && this.armed.command === command && this.armed.callState === s.call_state;
              return html`<sw-button
                size="sm"
                variant=${command === 'answer' ? 'primary' : 'danger'}
                icon=${command === 'answer' ? 'check' : 'close'}
                data-wiskey-call-command=${command}
                data-armed=${armed ? 'true' : 'false'}
                ?disabled=${!live || this.callBusy.has(s.id)}
                @click=${(e: MouseEvent) => this.onCall(e, s, command)}
                >${armed ? `לחצו שוב ל${CALL_LABELS[command]}` : CALL_LABELS[command]}</sw-button
              >`;
            })}
          </div>`
        : nothing}
      <div class="row">
        ${locks.map((l) => {
          const name = lockLabel(s, l);
          const key = `${s.id}/${l.physical_index}`;
          const held = this.isHeld(key);
          return html`<sw-button
            size="sm"
            icon="unlock"
            data-wiskey-release=${l.physical_index}
            data-held=${held ? 'true' : 'false'}
            ?disabled=${!live || !s.online || this.releasing.has(key) || held}
            @click=${() => this.askRelease(s, l)}
            >${held ? 'ממתין לבירור…' : name ? `שחרור ${name}` : 'שחרור דלת'}</sw-button
          >`;
        })}
        ${s.online ? html`<sw-button size="sm" variant="ghost" icon="volume" data-wiskey-speak ?disabled=${!live} @click=${() => this.openSpeak(s)}>הכרזה</sw-button>` : nothing}
      </div>
      ${result ? html`<div class="result ${result.tone}" role="status" data-wiskey-result>${result.text}</div>` : nothing}
      ${tts ? html`<div class="result ${ttsTone}" role="status" data-wiskey-tts-status=${tts.state}>${ttsText(tts)}</div>` : nothing}
    </div>`;
  }

  /** panel.ts `lastAccess()` (1079-1096): the station's last access in the station's own clock zone. */
  private renderLastAccess(s: IntercomStation) {
    const e = s.last_access;
    return html`<div class="last" data-wiskey-last>
      <span class="muted">${t('last_access')}</span>
      ${e
        ? html`<div>${e.person_name ?? e.employee_no ?? t('unknown_person')}</div>
            <div class="muted">${t(e.event_type)} · ${t(e.authentication)}</div>
            <div class="muted">
              <bdi>${formatTime(e.timestamp, 'he-IL', s.zone ?? UTC_ZONE)}</bdi>
              ${!e.person_name && !e.employee_no ? html`<div>${t('identity_unavailable')}</div>` : nothing}
              ${e.time_source === 'received' ? html` · ${t('receipt_time')}` : nothing}
              ${e.recovered ? html` · ${t('historical_record')}` : nothing}
            </div>`
        : html`<div class="muted">${t('no_access_recorded')}</div>`}
    </div>`;
  }

  static styles = css`
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 14px;
      align-items: start;
    }
    @media (max-width: 1000px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .main,
    .side {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .search {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding-inline: 10px;
      min-block-size: 34px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text-3);
      flex: 1 1 220px;
      max-inline-size: 360px;
    }
    .search input {
      border: 0;
      outline: 0;
      background: transparent;
      font: inherit;
      color: var(--sw-text);
      inline-size: 100%;
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .count {
      margin-inline-start: auto;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
    }
    .door {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px 14px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      min-inline-size: 0;
    }
    .door.ringing {
      border-color: var(--sw-warning);
      box-shadow: 0 0 0 3px var(--sw-warning-soft);
    }
    .door.offline {
      background: var(--sw-surface-2);
    }
    .door-head {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 8px;
      background: var(--sw-live-soft);
      color: var(--sw-success);
      flex: none;
    }
    .door.offline .ic {
      background: var(--sw-offline-soft);
      color: var(--sw-offline);
    }
    .door.ringing .ic {
      background: var(--sw-warning-soft);
      color: var(--sw-warning);
    }
    .title {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-inline-size: 0;
    }
    .title b {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    small,
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ring {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      padding: 3px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-warning-soft);
      color: var(--sw-warning);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .last {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-block-start: 8px;
      border-block-start: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .event,
    .attn {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-block: 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    .event:last-child,
    .attn:last-child {
      border-block-end: 0;
    }
    .event time {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .note {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .note.stale {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .note.info {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      align-items: flex-start;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-block-start: 8px;
      border-block-start: 1px solid var(--sw-border);
    }
    .actions .row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .result {
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-xs);
      line-height: 1.4;
    }
    .result.ok {
      background: var(--sw-live-soft);
      color: var(--sw-text);
    }
    .result.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-text);
    }
    .result.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    textarea {
      resize: vertical;
      min-block-size: 72px;
    }
  `;
}
