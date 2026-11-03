import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-icon';
import './wk-action-button';
import { ApiError, describeError } from '../api/client';
import { intercomSnapshotUrl, releaseIntercomDoor, signalIntercomCall, subscribeIntercom } from '../api/intercom';
import { getActiveCalls, stationDrawerHref, type ActiveCalls, type IncomingCall } from '../api/intercom-calls';
import { canAnywhere, isApi, onSession } from '../api/session';
import { getStationMedia, newRequestId, startTalk, stopTalk, talkSocketUrl, type StationMedia, type StationMediaTalk } from '../api/station-media';
import { fill, ict } from '../i18n/incoming-calls';
import { smt } from '../i18n/wiskey-station-media';
import { onRouteChange, parseRoute, type RouteState } from '../router';
import { wkIcon } from '../screens/wiskey-stations-icons';
import { armRingTone, Ringer, ringBlocked } from '../wiskey/ring-tone';
import { openMic } from '../wiskey/talk-mic';
import { TalkSession, type TalkDeps } from '../wiskey/talk-session';
import { answerPlan, clockText, doorLabel, elapsedNow, pollDelay, shouldRing, talkReasonText, visibleCalls } from './incoming-call-logic';

const HIDDEN_KEY = 'sw.calls.hidden';
const PICTURE_MS = 2_000;

type Note = { text: string; tone: 'ok' | 'warn' | 'error' };

/**
 * WISKEY-INBOUND-CALLS-2382: the incoming-call banner, over every screen of the application (sw-app mounts it once). When someone
 * presses the call button at a door station, the users the setting names (routers/intercom_calls.py: OFF by default; then everyone
 * holding the call right on that station, or only chosen roles / stations) see the station's name, its picture (a still refreshed
 * every PICTURE_MS) and three actions: answer, decline, open the door.
 *
 *   answer   - when the station's media offers talk: the call is answered (POST intercom/stations/{id}/call, the same route and audit
 *              as the stations screen) and Arx's own talk session opens from here (POST access-control/stations/{id}/talk, the
 *              microphone asked in the same gesture); when talk is not offered (off in Settings, only in the classic panel, no
 *              permission) nothing is sent: the station opens in the stations screen, and the reason is said in one line.
 *   decline  - one signal; the banner goes when the station stops ringing.
 *   door     - an inline confirmation ("open X?") and ONE release (POST intercom/stations/{id}/release, confirmed); "sent", never "opened".
 *
 * The ring is a short chime (wiskey/ring-tone.ts) only while the server says it may sound (quiet hours hold it; the critical sound
 * never applies to a doorbell), until silenced here. "Hide" puts a ringing call away on this device. A ringing call whose station
 * drawer is open right now is left to the drawer. On a phone the banner is a bottom sheet with large buttons.
 *
 * Kept apart from the station drawer's talk / dial (another slice): its own file, its own talk session over the same routes.
 */
@customElement('sw-incoming-call')
export class SwIncomingCall extends LitElement {
  @state() private active: ActiveCalls | null = null;
  @state() private tick = 0;
  @state() private front = 0;
  @state() private muted = false;
  @state() private notes: Record<string, Note> = {};
  @state() private busy: Record<string, string> = {};
  @state() private doorAsk: string | null = null;
  @state() private picture = Date.now();
  private fetchedAt = 0;
  private hiddenCalls = new Set<string>();
  private talking = new Set<string>();
  /** Calls whose "answer" opened the station (no talk here): kept in view with the reason, even over their open drawer. */
  private kept = new Set<string>();
  private sessions = new Map<string, TalkSession>();
  private media = new Map<string, StationMedia | null | Promise<StationMedia | null>>();
  private route: RouteState | null = null;
  private ringer = new Ringer();
  private socketUp = false;
  private stops: Array<() => void> = [];
  private pollTimer = 0;
  private clockTimer = 0;
  private pictureTimer = 0;
  private started = false;
  private loading = false;

  static styles = css`
    :host {
      display: contents;
    }
    .sheet {
      position: fixed;
      inset-block-start: max(12px, env(safe-area-inset-top));
      inset-inline-end: 16px;
      z-index: 2147482000;
      inline-size: min(380px, calc(100vw - 32px));
      box-sizing: border-box;
      display: grid;
      gap: var(--sw-s-3, 12px);
      padding: var(--sw-s-3, 12px);
      border-radius: var(--sw-r-lg, 16px);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.12);
      font-size: var(--sw-fs-base, 14px);
    }
    .sheet[data-state='ringing'] {
      border-color: color-mix(in srgb, var(--sw-success) 55%, var(--sw-border-strong));
    }
    @media (prefers-reduced-motion: no-preference) {
      .sheet {
        animation: enter 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .sheet[data-state='ringing'] .ring {
        animation: pulse 1.6s ease-in-out infinite;
      }
    }
    @keyframes enter {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
      }
    }
    @keyframes pulse {
      0%,
      100% {
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--sw-success) 45%, transparent);
      }
      50% {
        box-shadow: 0 0 0 8px transparent;
      }
    }
    .head {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2, 8px);
      min-inline-size: 0;
    }
    .ring {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .sheet[data-state='in_call'] .ring {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .ttl {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: grid;
      line-height: 1.25;
    }
    .ttl small {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm, 13px);
    }
    .ttl b {
      font-size: var(--sw-fs-md, 16px);
      font-weight: var(--sw-fw-semibold, 600);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .clock {
      flex: none;
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm, 13px);
    }
    .icon-btn {
      flex: none;
      display: inline-grid;
      place-items: center;
      inline-size: var(--sw-touch-desktop, 40px);
      block-size: var(--sw-touch-desktop, 40px);
      border-radius: var(--sw-r-sm, 8px);
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .icon-btn:hover {
      background: var(--sw-surface-2);
    }
    .icon-btn:focus-visible,
    a:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .pic {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md, 12px);
      overflow: hidden;
      background: var(--sw-surface-sunken, var(--sw-surface-3));
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .pic img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .pic .none {
      display: grid;
      justify-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm, 13px);
    }
    .line {
      margin: 0;
      font-size: var(--sw-fs-sm, 13px);
      color: var(--sw-text-2);
    }
    .line[data-tone='ok'] {
      color: var(--sw-success-text);
    }
    .line[data-tone='warn'] {
      color: var(--sw-warning-text);
    }
    .line[data-tone='error'] {
      color: var(--sw-danger-text);
    }
    /* the call's own actions on one row (answer + decline, or end); the doors under them, each as wide as its name needs */
    .acts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
      gap: var(--sw-s-2, 8px);
    }
    .acts.doors {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
    .acts wk-action-button {
      display: flex;
    }
    .ask {
      display: grid;
      gap: var(--sw-s-2, 8px);
      padding: var(--sw-s-2, 8px);
      border-radius: var(--sw-r-md, 12px);
      background: var(--sw-surface-2);
    }
    .ask .row {
      display: flex;
      gap: var(--sw-s-2, 8px);
    }
    .ask .row wk-action-button {
      flex: 1 1 0;
      display: flex;
    }
    .talk {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2, 8px);
      justify-content: space-between;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2, 8px);
      font-size: var(--sw-fs-sm, 13px);
    }
    .foot a,
    .foot button.link {
      color: var(--sw-accent-text);
      text-decoration: none;
      background: none;
      border: 0;
      font: inherit;
      cursor: pointer;
      padding: 6px 2px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 32px;
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    /* a phone: a bottom sheet over the screen's lower part, large press targets, clear of the home indicator */
    @media (max-width: 600px) {
      .sheet {
        inset-block-start: auto;
        inset-block-end: 0;
        inset-inline: 0;
        inline-size: auto;
        border-radius: var(--sw-r-lg, 16px) var(--sw-r-lg, 16px) 0 0;
        border-inline: 0;
        border-block-end: 0;
        padding-block-end: max(12px, env(safe-area-inset-bottom));
        box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.3);
      }
      .pic {
        max-block-size: 34vh;
      }
    }
    @media (prefers-color-scheme: dark) {
      .sheet {
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.6);
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    armRingTone();
    try {
      for (const id of JSON.parse(sessionStorage.getItem(HIDDEN_KEY) || '[]') as string[]) this.hiddenCalls.add(String(id));
    } catch {
      /* storage unavailable: nothing hidden */
    }
    this.route = parseRoute();
    this.stops.push(onRouteChange((r) => ((this.route = r), this.requestUpdate())));
    this.stops.push(onSession(() => this.maybeStart()));
    this.maybeStart();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stops.forEach((s) => s());
    this.stops = [];
    window.clearTimeout(this.pollTimer);
    window.clearInterval(this.clockTimer);
    window.clearInterval(this.pictureTimer);
    this.clockTimer = this.pictureTimer = 0;
    this.ringer.dispose();
    for (const s of this.sessions.values()) s.dispose();
    this.sessions.clear();
    this.started = false;
  }

  /** Only a signed-in user who may take calls somewhere ever asks the server (the banner is off for everyone else). */
  private maybeStart(): void {
    if (this.started || !isApi() || !canAnywhere('access.call')) return;
    this.started = true;
    this.stops.push(
      subscribeIntercom(
        (m) => {
          if (m.type === 'intercom_refresh' || m.type === 'intercom_state') void this.refresh();
        },
        (up) => {
          this.socketUp = up;
          if (up) void this.refresh();
        },
      ),
    );
    void this.refresh();
  }

  private schedule(): void {
    window.clearTimeout(this.pollTimer);
    const a = this.active;
    this.pollTimer = window.setTimeout(() => void this.refresh(), pollDelay(!!a?.enabled, this.socketUp, !!a?.calls.length));
  }

  private async refresh(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const prev = new Set((this.active?.calls ?? []).map((c) => c.call_id));
      this.active = await getActiveCalls();
      this.fetchedAt = Date.now();
      const now = new Set(this.active.calls.map((c) => c.call_id));
      for (const id of prev) if (!now.has(id)) this.ended(id);
      const live = new Set(this.active.calls.map((c) => c.station_id));
      for (const id of [...this.media.keys()]) if (!live.has(id)) this.media.delete(id); // read again at the next call (the setting may change)
      for (const c of this.active.calls) void this.mediaOf(c.station_id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.active = null; // the call right was removed: quiet until the next check
    } finally {
      this.loading = false;
      this.schedule();
      this.sync();
    }
  }

  /** A call left the server's list (ended, answered elsewhere, no longer offered): its talk ends with it. */
  private ended(callId: string): void {
    const s = this.sessions.get(callId);
    if (s) {
      s.dispose();
      this.sessions.delete(callId);
    }
    this.talking.delete(callId);
    this.kept.delete(callId);
    const { [callId]: _n, ...notes } = this.notes;
    this.notes = notes;
    if (this.doorAsk?.startsWith(`${callId}/`)) this.doorAsk = null;
  }

  /** The station's media descriptor (talk or not, and why) - read once per station while its call is shown. */
  private mediaOf(stationId: string): Promise<StationMedia | null> {
    const have = this.media.get(stationId);
    if (have instanceof Promise) return have;
    if (have !== undefined) return Promise.resolve(have);
    const p = getStationMedia(stationId).then(
      (m) => (this.media.set(stationId, m), m),
      () => (this.media.set(stationId, null), null),
    );
    this.media.set(stationId, p);
    return p;
  }

  private shown(): IncomingCall[] {
    return visibleCalls(this.active, this.hiddenCalls, this.route, new Set([...this.talking, ...this.kept]));
  }

  /** The ring, the clocks and the picture follow what is shown. */
  private sync(): void {
    const shown = this.shown();
    this.ringer.set(shouldRing(this.active, shown, this.muted));
    const any = shown.length > 0;
    if (any && !this.clockTimer) this.clockTimer = window.setInterval(() => (this.tick += 1), 1000);
    if (!any && this.clockTimer) (window.clearInterval(this.clockTimer), (this.clockTimer = 0));
    if (any && !this.pictureTimer) this.pictureTimer = window.setInterval(() => (document.hidden ? undefined : (this.picture = Date.now())), PICTURE_MS);
    if (!any && this.pictureTimer) (window.clearInterval(this.pictureTimer), (this.pictureTimer = 0));
    if (this.front >= shown.length) this.front = 0;
  }

  protected updated(): void {
    this.ringer.set(shouldRing(this.active, this.shown(), this.muted));
  }

  // ------------------------------------------------------------------ actions

  private note(callId: string, n: Note | null): void {
    const { [callId]: _old, ...rest } = this.notes;
    this.notes = n ? { ...rest, [callId]: n } : rest;
  }

  private setBusy(callId: string, what: string | null): void {
    const { [callId]: _old, ...rest } = this.busy;
    this.busy = what ? { ...rest, [callId]: what } : rest;
  }

  private talkFor(c: IncomingCall, t: StationMediaTalk): TalkSession {
    const have = this.sessions.get(c.call_id);
    if (have) return have;
    const frameBytes = Math.max(80, Math.round(((t.sample_rate ?? 8000) * (t.frame_ms ?? 20)) / 1000));
    const deps: TalkDeps = {
      start: (id, rid) => startTalk(id, rid),
      stop: (s) => stopTalk(s),
      socket: (path) => new WebSocket(talkSocketUrl(path)) as unknown as ReturnType<TalkDeps['socket']>,
      mic: (codec, bytes, onFrame) => openMic(codec, bytes, onFrame),
      requestId: () => newRequestId(),
      now: () => Date.now(),
      after: (fn, ms) => window.setTimeout(fn, ms),
      cancel: (id) => window.clearTimeout(id),
      changed: () => this.requestUpdate(),
    };
    const s = new TalkSession(c.station_id, t.codec === 'pcma' ? 'pcma' : 'pcmu', frameBytes, deps);
    this.sessions.set(c.call_id, s);
    return s;
  }

  private async answer(c: IncomingCall): Promise<void> {
    if (this.busy[c.call_id]) return;
    const t = ict();
    const have = this.media.get(c.station_id);
    const media = have instanceof Promise || have === undefined ? await this.mediaOf(c.station_id) : have;
    const plan = answerPlan(media);
    if (plan.kind === 'drawer') {
      // no talk from here: nothing is sent - the station opens (its drawer, or the classic panel where the native screen is off)
      this.note(c.call_id, { text: fill(t.banner.noTalk, { why: talkReasonText(plan.reason, t) }), tone: 'warn' });
      this.kept.add(c.call_id);
      window.location.hash = stationDrawerHref(c.station_id);
      return;
    }
    this.setBusy(c.call_id, 'answer');
    this.note(c.call_id, null);
    const session = this.talkFor(c, media!.talk!);
    this.talking.add(c.call_id);
    const opening = session.start(); // the microphone is asked for in the operator's own gesture
    try {
      await signalIntercomCall(c.station_id, 'answer');
    } catch (err) {
      session.end();
      this.talking.delete(c.call_id);
      this.note(c.call_id, { text: fill(t.banner.failed, { why: describeError(err) }), tone: 'error' });
      this.setBusy(c.call_id, null);
      return;
    }
    this.setBusy(c.call_id, null);
    void this.refresh();
    await opening;
  }

  private async signal(c: IncomingCall, command: 'reject' | 'hangUp'): Promise<void> {
    if (this.busy[c.call_id]) return;
    this.setBusy(c.call_id, command);
    if (command === 'hangUp') this.sessions.get(c.call_id)?.end();
    try {
      await signalIntercomCall(c.station_id, command);
      this.note(c.call_id, null);
    } catch (err) {
      this.note(c.call_id, { text: fill(ict().banner.failed, { why: describeError(err) }), tone: 'error' });
    } finally {
      this.setBusy(c.call_id, null);
      void this.refresh();
    }
  }

  private async openDoor(c: IncomingCall, lock: number): Promise<void> {
    const t = ict();
    this.doorAsk = null;
    this.setBusy(c.call_id, 'door');
    try {
      await releaseIntercomDoor(c.station_id, lock);
      this.note(c.call_id, { text: t.banner.doorSent, tone: 'ok' });
    } catch (err) {
      this.note(c.call_id, { text: fill(t.banner.doorFailed, { why: describeError(err) }), tone: 'error' });
    } finally {
      this.setBusy(c.call_id, null);
    }
  }

  private hide(c: IncomingCall): void {
    this.hiddenCalls.add(c.call_id);
    this.kept.delete(c.call_id);
    try {
      sessionStorage.setItem(HIDDEN_KEY, JSON.stringify([...this.hiddenCalls].slice(-50)));
    } catch {
      /* storage unavailable: hidden for this page only */
    }
    this.front = 0;
    this.requestUpdate();
    this.sync();
  }

  // ------------------------------------------------------------------ view

  private picture_(c: IncomingCall): TemplateResult {
    const t = ict().banner;
    if (!c.online) return html`<div class="pic" data-call-picture="offline"><span class="none"><sw-icon name="offline" size=${22}></sw-icon>${t.offline}</span></div>`;
    if (!c.has_camera || !c.still) return html`<div class="pic" data-call-picture="none"><span class="none"><sw-icon name="camera" size=${22}></sw-icon>${t.noPicture}</span></div>`;
    return html`<div class="pic" data-call-picture="still"><img src=${intercomSnapshotUrl(c.station_id, this.picture)} alt=${fill(t.pictureAlt, { name: c.station_name })} decoding="async" /></div>`;
  }

  private talkLine(c: IncomingCall): TemplateResult | typeof nothing {
    const s = this.sessions.get(c.call_id);
    if (!s) return nothing;
    const t = ict().banner;
    if (s.problem) return html`<p class="line" data-tone="error" data-call-talk="problem">${(smt().talk.problems as Record<string, string>)[s.problem] ?? smt().talk.problems.failed}</p>`;
    if (s.phase === 'idle') return nothing;
    const word = s.phase === 'starting' ? t.mic.starting : s.muted ? t.mic.muted : t.mic.talking;
    return html`<div class="talk" data-call-talk=${s.phase} data-muted=${s.muted ? 'true' : 'false'}>
      <span class="line">${word}</span>
      ${s.phase === 'starting' ? nothing : html`<wk-action-button icon="mic" data-call-mute @click=${() => s.toggleMute()}>${s.muted ? t.mic.unmute : t.mic.mute}</wk-action-button>`}
    </div>`;
  }

  private soundLine(): TemplateResult | typeof nothing {
    const a = this.active;
    const t = ict().banner;
    if (!a || this.muted) return nothing;
    if (a.sound === 'silent' && a.sound_reason === 'quiet_hours') return html`<p class="line" data-call-sound="quiet">${t.quiet}</p>`;
    if (a.sound === 'ring' && ringBlocked()) return html`<p class="line" data-call-sound="blocked">${t.soundBlocked}</p>`;
    return nothing;
  }

  private doorPart(c: IncomingCall): TemplateResult | typeof nothing {
    if (!c.can_open_door || !c.locks.length) return nothing;
    const t = ict().banner;
    const ask = this.doorAsk?.startsWith(`${c.call_id}/`) ? Number(this.doorAsk.split('/')[1]) : null;
    if (ask !== null) {
      const lock = c.locks.find((l) => l.physical_index === ask);
      const name = lock?.name || c.station_name;
      return html`<div class="ask" role="group" data-call-door-ask=${ask}>
        <span>${fill(t.doorAsk, { name })}</span>
        <div class="row">
          <wk-action-button tone="primary" icon="unlock" size="lg" block data-call-door-yes @click=${() => void this.openDoor(c, ask)}>${t.doorYes}</wk-action-button>
          <wk-action-button size="lg" block data-call-door-no @click=${() => (this.doorAsk = null)}>${t.doorNo}</wk-action-button>
        </div>
      </div>`;
    }
    return nothing;
  }

  private doorButtons(c: IncomingCall): TemplateResult[] {
    if (!c.can_open_door || !c.online) return [];
    const t = ict().banner;
    const sending = this.busy[c.call_id] === 'door';
    return c.locks.map(
      (l) => html`<wk-action-button icon="unlock" size="lg" block data-call-door=${l.physical_index} ?busy=${sending} ?disabled=${sending || !!this.doorAsk}
        @click=${() => (this.doorAsk = `${c.call_id}/${l.physical_index}`)}>${sending ? t.doorSending : doorLabel(l, c.locks.length, ict())}</wk-action-button>`,
    );
  }

  render() {
    void this.tick;
    const shown = this.shown();
    if (!shown.length) return nothing;
    const t = ict().banner;
    const c = shown[Math.min(this.front, shown.length - 1)];
    const mine = c.answered_by_me || this.talking.has(c.call_id);
    const st = mine ? 'in_call' : 'ringing';
    const busy = this.busy[c.call_id];
    const sec = elapsedNow(c, this.fetchedAt, Date.now());
    const n = this.notes[c.call_id];
    const others = shown.length - 1;
    return html`<section class="sheet" role="region" aria-label=${t.region} data-incoming-call=${c.call_id} data-station=${c.station_id} data-state=${st}>
      <span class="sr" role="status">${st === 'ringing' ? `${t.ringing} ${fill(t.from, { name: c.station_name })}` : ''}</span>
      <div class="head">
        <span class="ring">${st === 'ringing' ? html`<sw-icon name="bell" size=${18}></sw-icon>` : wkIcon('phone', 18)}</span>
        <span class="ttl"><small>${st === 'ringing' ? t.ringing : t.inCall}</small><b data-call-station>${c.station_name}</b></span>
        <span class="clock" dir="ltr" data-call-clock>${clockText(sec)}</span>
        ${st === 'ringing' && this.active?.sound === 'ring'
          ? html`<button class="icon-btn" data-call-silence aria-pressed=${this.muted ? 'true' : 'false'} aria-label=${this.muted ? t.unmute : t.mute} title=${this.muted ? t.unmute : t.mute}
              @click=${() => ((this.muted = !this.muted), this.sync())}><sw-icon name="volume" size=${18}></sw-icon></button>`
          : nothing}
        ${st === 'ringing' ? html`<button class="icon-btn" data-call-hide aria-label=${t.hide} title=${t.hide} @click=${() => this.hide(c)}><sw-icon name="close" size=${18}></sw-icon></button>` : nothing}
      </div>
      ${this.picture_(c)}
      ${n ? html`<p class="line" data-tone=${n.tone} role="status" data-call-note=${n.tone}>${n.text}</p>` : nothing}
      ${st === 'ringing' ? this.soundLine() : this.talkLine(c)}
      ${this.doorPart(c)}
      <div class="acts">
        ${st === 'ringing'
          ? html`<wk-action-button tone="ok" icon="phone" size="lg" block data-call-answer ?busy=${busy === 'answer'} ?disabled=${!!busy || !c.online} @click=${() => void this.answer(c)}
                >${busy === 'answer' ? t.answering : t.answer}</wk-action-button
              ><wk-action-button tone="danger" icon="close" size="lg" block data-call-reject ?busy=${busy === 'reject'} ?disabled=${!!busy || !c.online} @click=${() => void this.signal(c, 'reject')}
                >${t.reject}</wk-action-button
              >`
          : html`<wk-action-button tone="danger" icon="hangup" size="lg" block data-call-hangup ?busy=${busy === 'hangUp'} ?disabled=${!!busy} @click=${() => void this.signal(c, 'hangUp')}
              >${t.hangUp}</wk-action-button
            >`}
      </div>
      ${c.can_open_door && c.online && c.locks.length ? html`<div class="acts doors">${this.doorButtons(c)}</div>` : nothing}
      <div class="foot">
        <a href=${stationDrawerHref(c.station_id)} data-call-open-station>${wkIcon('window', 14)}${t.station}</a>
        ${others > 0 ? html`<button class="link" data-call-next aria-label=${t.next} @click=${() => (this.front = (this.front + 1) % shown.length)}>${fill(t.more, { n: others })}</button>` : nothing}
      </div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-incoming-call': SwIncomingCall;
  }
}
