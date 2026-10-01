import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import './sw-drawer';
import './sw-dialog';
import './sw-button';
import './media-player-volume';
import { ApiError } from '../api/client';
import { isApi } from '../api/session';
import { getAction } from '../api/ha';
import { artworkUrl } from '../api/media-screens';
import {
  JOIN_BATCH_MS, JoinDraft, LIBRARY_TAB_LABEL, UP_NEXT_REFRESH_MS, confirmPreview, errorCode, leaderLabel, libraryTabs, nextRepeat, playerCommandOffered, playerErrorText, players, powerControlled, sendGroupVolume,
  sendJoin, sendLeave, sendPlayerCommand, type GroupPreview, type GroupRecord, type LibraryItem, type LibraryKind, type LibraryPage, type PlayerCommand, type PlayerDevice, type PlayerDeviceDetail,
  type UpNext,
} from '../api/media-players';
import { applyDevicesScheme, loadDevicesPrefs } from '../screens/devices-style';
import { bidi } from '../i18n/bidi';
import { tint } from './media-remote-keys';
import { KeyPress } from './media-remote-press';
import { keyFromEvent, mmss } from './media-remote-logic';
import { remoteStyles, remoteTokens } from './media-remote-css';
import { playerBase, playerStyles } from './media-player-css';
import { gl, ic } from './media-player-icons';
import type { RoomOutcome, VolumeEvent } from './media-player-volume';
import {
  CONFIRM_TIMEOUT_MS, NOT_CONFIRMED, LONG_PRESS_MS, NEUTRAL_GLOW, PlayerGate, RateGap, SEEK_DEBOUNCE_MS, confirmCopy, enqueueOffered, failedLines, fraction, greyed, groupKeysOf, groupSectionRows,
  groupSectionShown, groupVolumeOffered, hasNow, isGroupedView, joinPlan, leaderOf, nowStatusWord, panelMode, pendId, pickTab, playerExpectation, playerPowerOffer, playerUnavailableLine, positionOf,
  repeatLabel, roomRows, seekState, transferOffered, transferSources, transportButtons, upNextView, viewOnly, zoneView, zoneViews, type ExpectContext, type JoinPlan,
} from './media-player-logic';

const POLL_MS = 4000;
const CONFIRM_POLL_MS = 600;
const LIST_EVERY = 2; // the players list is read every second poll
const RECORD_POLL_MS = 500;
const RECORD_MAX_MS = 8000;

/**
 * The player panel (CR-016 §7.2): what the TV remote is to a screen, for a speaker, a player, a receiver or a group. It lives in the same
 * `sw-drawer` (a side panel on a desktop / tablet, a bottom sheet on a phone) and is opened exactly the way the remote is:
 *
 *   <media-player-panel .deviceKey=${key} .open=${open} @close=${...}></media-player-panel>
 *
 * (`<media-remote>` routes the non-screen kinds here; the area card and the home widget open it through that.)
 *
 * It draws what `caps` of the device allows and nothing else; the server re-checks every command. Body, in order: now playing (square artwork,
 * title, artist, album, a seekable bar - a station has "שידור חי" and no bar), the transport pad (shuffle, previous, play / pause, next, repeat -
 * never mirrored), volume (one slider; for a leader or a static group the group slider and "לפי חדר"), transfer ("העבר את המוזיקה לכאן", MA
 * only), "הבא בתור" (current + next + "עוד N"; an unconfirmed read is "לא זמין", never an empty list), the library tabs (favourites, stations,
 * playlists - absent without a library; the playlists tab absent with the Sonos provider), and the group section (rooms of the SAME layer as
 * checkboxes, batched 500 ms into one join diff, the 4+ rooms / more than one floor confirmation before anything is sent, the outcome by room).
 * A receiver gets power, volume, sources and sound modes (no keys) and a zone switch when it has a Zone2.
 *
 * Safety (media-player-logic.ts): opening sends nothing; every press goes through `PlayerGate` (the client's KeyThrottle plus the CR §6.4 rates:
 * a press over it is dropped with a short shake, never queued); volume steps repeat while held (200 ms, at most 10 s); one power command in
 * flight per device; an accepted command shows as pending until the state confirms it, after 8 s "הנגן לא אישר את הפקודה" and the last
 * confirmed state is back; controls are greyed with `caps_known` false; a ceiling is shown only where one is set.
 *
 * States: loading, error, unavailable ("הרמקול לא זמין · מאז HH:MM"), off (the big "הפעל" over a dimmed body), view-only (`media.read` only: the
 * state and "הבא בתור"), pending, not confirmed, rate-limited, conflict ("קיבוץ לא תואם").
 *
 * Events: `close`, `media-changed` { key } after every refreshed state (cards refetch).
 */
@customElement('media-player-panel')
export class MediaPlayerPanel extends LitElement {
  @property({ attribute: 'device-key' }) deviceKey = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** The colour scheme when the host already knows it (light | dark | auto); empty = the installation's `devices.scheme`. */
  @property() scheme: '' | 'light' | 'dark' | 'auto' = '';
  /** The clock of the night window and the progress bar (specs pin it). */
  @property({ attribute: false }) clock: () => Date = () => new Date();

  @state() private detail: PlayerDeviceDetail | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private devices: PlayerDevice[] | null = null;
  @state() private upNext: UpNext | null | 'error' = null;
  @state() private libAbsent = false;
  @state() private lib: Partial<Record<LibraryKind, LibraryPage | 'error'>> = {};
  @state() private kindsOn: LibraryKind[] | null = null;
  @state() private libTab: LibraryKind | null = null;
  @state() private pend = new Set<string>();
  @state() private notice: string[] = [];
  @state() private shaking = false;
  @state() private byRoom = false;
  @state() private zone = '';
  @state() private outcomes: Record<string, RoomOutcome> = {};
  @state() private joining = new Set<string>();
  @state() private tick = 0;
  @state() private confirm: { plan: JoinPlan; preview: GroupPreview | null } | null = null;
  @state() private trMenu = false;
  @state() private seekDraft: number | null = null;
  @state() private nowMs = Date.now();

  private gate = new PlayerGate();
  private readonly press = new KeyPress((key) => this.onStepKey(key));
  private draft = new JoinDraft();
  private groupGap = new RateGap(500);
  private token = 0;
  private polls = 0;
  private pollTimer = 0;
  private tickTimer = 0;
  private noticeTimer = 0;
  private refreshTimer = 0;
  private joinTimer = 0;
  private seekTimer = 0;
  private upNextAt = 0;
  private upNextTitle: string | null = null;
  private longTimer = 0;
  private longFired = false;

  static styles = [remoteTokens, remoteStyles, playerBase, playerStyles];

  // ------------------------------------------------------------------------------------------------ lifecycle

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute('data-devices-scheme')) this.setAttribute('data-devices-scheme', 'light');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.end();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('deviceKey') && changed.get('deviceKey') !== undefined) this.resetForDevice();
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has('open') || changed.has('deviceKey')) {
      if (this.open && this.deviceKey) this.begin();
      else if (!this.open) this.end();
    }
    this.syncGlow();
  }

  private resetForDevice() {
    this.detail = null;
    this.phase = 'loading';
    this.devices = null;
    this.upNext = null;
    this.libAbsent = false;
    this.lib = {};
    this.libTab = null;
    this.pend = new Set();
    this.notice = [];
    this.byRoom = false;
    this.zone = '';
    this.outcomes = {};
    this.joining = new Set();
    this.confirm = null;
    this.trMenu = false;
    this.seekDraft = null;
    this.draft.clear();
    this.upNextAt = 0;
    this.upNextTitle = null;
    this.polls = 0;
    this.gate = new PlayerGate();
    this.press.stopAll();
  }

  private begin() {
    if (this.scheme) applyDevicesScheme(this, this.scheme);
    else void loadDevicesPrefs().then((p) => applyDevicesScheme(this, p.scheme));
    void players().favourites().then((c) => (this.kindsOn = c.kinds_on)).catch(() => undefined);
    void this.load(true);
    window.clearInterval(this.pollTimer);
    this.pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && this.pend.size === 0 && this.joining.size === 0) void this.load(false);
    }, POLL_MS);
    window.clearInterval(this.tickTimer);
    this.tickTimer = window.setInterval(() => {
      if (this.detail?.live.play === 'playing') this.nowMs = Date.now();
    }, 1000);
    document.addEventListener('keydown', this.onDocKeyDown, true);
    document.addEventListener('keyup', this.onDocKeyUp, true);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onBlur);
  }

  private end() {
    window.clearInterval(this.pollTimer);
    window.clearInterval(this.tickTimer);
    for (const t of [this.noticeTimer, this.refreshTimer, this.joinTimer, this.seekTimer, this.longTimer]) window.clearTimeout(t);
    this.token++; // in-flight loads and confirmations stop mattering
    this.press.stopAll();
    document.removeEventListener('keydown', this.onDocKeyDown, true);
    document.removeEventListener('keyup', this.onDocKeyUp, true);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onBlur);
    this.pend = new Set();
    this.joining = new Set();
    this.draft.clear();
    this.confirm = null;
    this.trMenu = false;
    this.gate.powerDone();
  }

  private onBlur = () => {
    if (document.visibilityState === 'hidden' || !document.hasFocus()) this.press.stopAll();
  };

  /** The glow behind the header follows what plays (the drawer's surface reads --mr-art through --dv-surface-solid). */
  private syncGlow() {
    const d = this.detail;
    const n = d?.live.now;
    const lit = !!d && panelMode(d) === 'on' && !!n && (d.live.play === 'playing' || d.live.play === 'paused') && n.hue !== null;
    this.style.setProperty('--mr-art', lit && n ? tint(n.hue).rgb : NEUTRAL_GLOW);
  }

  // ------------------------------------------------------------------------------------------------ data

  private async load(first: boolean): Promise<void> {
    const key = this.deviceKey;
    if (!key) return;
    const token = ++this.token;
    if (first && !(this.detail && this.detail.key === key)) this.phase = 'loading';
    try {
      const d = await players().get(key);
      if (token !== this.token || key !== this.deviceKey) return;
      this.applyDetail(d);
      void this.loadSide(d, token, first);
    } catch {
      if (token !== this.token) return;
      if (!this.detail) this.phase = 'error';
    }
  }

  private applyDetail(d: PlayerDeviceDetail) {
    this.detail = d;
    this.phase = 'ready';
    if (this.zone === '' && d.zones?.length) this.zone = d.zones[0].id;
    this.dispatchEvent(new CustomEvent('media-changed', { detail: { key: d.key }, bubbles: true, composed: true }));
  }

  private refreshSoon(ms = 500) {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => void this.load(false), ms);
  }

  /** The reads that go with the state: the players list (groups, transfer), the queue window, the library tab. Reads only. */
  private async loadSide(d: PlayerDeviceDetail, token: number, first: boolean): Promise<void> {
    const dead = panelMode(d) === 'unavailable';
    if (dead) return;
    if (first && d.music_provider !== 'none' && (d.caps.up_next || d.caps.favourites || d.caps.stations)) {
      // the status says whether the music library answers at all (`library.state`, the bridge's last word about it): when it does not, the panel has no
      // library tabs and "הבא בתור" reads "לא זמין" - without a read that would fail
      try {
        const lib = (await players().status()).library;
        if (token === this.token) this.libAbsent = lib.state === 'unavailable' && lib.provider === d.music_provider;
      } catch {
        /* the reads below say it themselves */
      }
    }
    const wantList = d.caps.group || d.caps.transfer || d.kind === 'group' || d.live.group.role !== 'none';
    if (wantList && (first || this.polls++ % LIST_EVERY === 0 || !this.devices)) {
      try {
        const { devices } = await players().list();
        if (token === this.token) this.devices = devices;
      } catch {
        /* the group section and transfer wait for the next read */
      }
    }
    const lead = this.devices ? leaderOf(d, this.devices) : d;
    if (d.caps.up_next && hasNow(d.live)) {
      const title = d.live.now.title;
      if (first || title !== this.upNextTitle || Date.now() - this.upNextAt >= UP_NEXT_REFRESH_MS) {
        this.upNextTitle = title;
        this.upNextAt = Date.now();
        try {
          const u = await players().upNext(lead.key);
          if (token === this.token) this.upNext = u;
        } catch (err) {
          if (token === this.token) {
            if (errorCode(err) === 'no_library') this.libAbsent = true;
            this.upNext = 'error';
          }
        }
      }
    } else if (!hasNow(d.live)) {
      this.upNextTitle = null;
    }
    const tabs = libraryTabs(d, this.kindsOn);
    const tab = pickTab(tabs, this.libTab);
    if (tab && (first || !this.lib[tab])) await this.loadLib(d.key, tab, token);
  }

  private async loadLib(key: string, kind: LibraryKind, token = this.token): Promise<void> {
    try {
      const page = await players().library(key, kind);
      if (token === this.token) this.lib = { ...this.lib, [kind]: page };
    } catch (err) {
      if (token !== this.token) return;
      if (errorCode(err) === 'no_library') this.libAbsent = true;
      this.lib = { ...this.lib, [kind]: 'error' };
    }
  }

  // ------------------------------------------------------------------------------------------------ feedback

  private shake() {
    this.shaking = true;
    window.setTimeout(() => (this.shaking = false), 260);
  }

  private say(lines: string | string[], ms = 3600) {
    this.notice = Array.isArray(lines) ? lines : [lines];
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => (this.notice = []), ms);
  }

  private setPend(id: string, on: boolean) {
    const next = new Set(this.pend);
    if (on) next.add(id);
    else next.delete(id);
    this.pend = next;
  }

  private onError(err: unknown) {
    if (err instanceof ApiError && (err.code === 'rate_limited' || err.status === 429)) {
      this.shake();
      return;
    }
    this.say(err instanceof ApiError ? playerErrorText(err) : NOT_CONFIRMED);
    const code = errorCode(err);
    if (code && ['screen_off', 'unavailable', 'not_found', 'caps_unknown', 'unknown_item', 'not_playing'].includes(code)) this.refreshSoon(0);
    if (code === 'unknown_item') this.lib = {};
  }

  // ------------------------------------------------------------------------------------------------ sending

  /** The one way out: gate -> sendPlayerCommand -> (pending until the state confirms, for commands that can be confirmed). `target` is the
   * device the command is for (the panel's own, or a room of the group for its slider / mute); `ctrl` the spinner id. */
  private async exec(cmd: PlayerCommand, target: PlayerDevice | null = this.detail, ctx: ExpectContext = {}, ctrl: string = pendId(cmd)): Promise<boolean> {
    if (!target) return false;
    const verdict = this.gate.check(target, cmd);
    if (verdict === 'dropped') {
      this.shake();
      return false;
    }
    if (verdict !== 'send') return false;
    const power = cmd.command === 'power_on' || cmd.command === 'power_off';
    const expect = playerExpectation(cmd, target.live, ctx);
    if (expect) this.setPend(ctrl, true);
    let res;
    try {
      res = await sendPlayerCommand(target.key, cmd);
    } catch (err) {
      this.setPend(ctrl, false);
      if (power) this.gate.powerDone();
      this.onError(err);
      return false;
    }
    if (res.status === 'refused') {
      this.setPend(ctrl, false);
      if (power) this.gate.powerDone();
      this.say(playerErrorText(new ApiError(409, { code: res.error ?? 'not_confirmed', user_message: NOT_CONFIRMED, retryable: false, correlation_id: '', details: {} })));
      this.refreshSoon(0);
      return false;
    }
    if (!expect || res.status === 'sent') {
      this.setPend(ctrl, false);
      if (power) this.gate.powerDone();
      this.refreshSoon(cmd.command === 'volume_step' || cmd.command === 'mute' ? 600 : 300);
      return true;
    }
    return this.confirmCmd(target.key, ctrl, expect, res.action_id, power);
  }

  /** Pending until `expect` holds for a fresh state, or 8 s pass: then "הנגן לא אישר את הפקודה" and the last confirmed state. */
  private async confirmCmd(key: string, ctrl: string, expect: NonNullable<ReturnType<typeof playerExpectation>>, actionId: string | null, power: boolean): Promise<boolean> {
    const own = key === this.deviceKey;
    const token = this.token;
    const t0 = Date.now();
    while (Date.now() - t0 < CONFIRM_TIMEOUT_MS) {
      if (token !== this.token) return false;
      try {
        const d = await players().get(key);
        if (token !== this.token) return false;
        if (own) this.applyDetail(d);
        if (expect(d.live)) {
          this.setPend(ctrl, false);
          if (power) this.gate.powerDone();
          this.seekDraft = null;
          if (!own) this.refreshSoon(0);
          else void this.loadSide(d, token, false);
          return true;
        }
      } catch {
        /* keep trying until the timeout */
      }
      if (actionId && isApi()) {
        try {
          const a = await getAction(actionId);
          if (a.status === 'failed' || a.status === 'denied') break;
        } catch {
          /* the action record is a hint only */
        }
      }
      await new Promise((r) => window.setTimeout(r, CONFIRM_POLL_MS));
    }
    if (token !== this.token) return false;
    this.setPend(ctrl, false);
    if (power) this.gate.powerDone();
    this.seekDraft = null;
    this.say(NOT_CONFIRMED);
    void this.load(false); // the last confirmed state
    return false;
  }

  // ------------------------------------------------------------------------------------------------ transport, seek, volume

  private transport(action: 'play_pause' | 'next' | 'previous') {
    void this.exec({ command: 'transport', action });
  }

  private onShuffle() {
    const l = this.detail?.live;
    if (l) void this.exec({ command: 'shuffle', on: !(l.shuffle ?? false) });
  }

  private onRepeat() {
    const l = this.detail?.live;
    if (l) void this.exec({ command: 'repeat', mode: nextRepeat(l.repeat) });
  }

  private onSeekInput = (e: Event) => {
    const d = this.detail;
    const dur = d?.live.now.duration_s;
    if (!d || !dur) return;
    this.seekDraft = Math.round((Number((e.target as HTMLInputElement).value) / 1000) * dur);
  };

  private onSeekChange = (e: Event) => {
    const d = this.detail;
    const dur = d?.live.now.duration_s;
    if (!d || !dur) return;
    const to = Math.round((Number((e.target as HTMLInputElement).value) / 1000) * dur);
    this.seekDraft = to;
    window.clearTimeout(this.seekTimer);
    this.seekTimer = window.setTimeout(() => {
      void this.exec({ command: 'seek', position_s: to }).then((sent) => {
        if (!sent) this.seekDraft = null;
      });
    }, SEEK_DEBOUNCE_MS);
  };

  private deviceOf(key: string): PlayerDevice | null {
    if (key === this.detail?.key) return this.detail;
    return this.devices?.find((x) => x.key === key) ?? null;
  }

  private onVolume = (e: CustomEvent<VolumeEvent>) => {
    e.stopPropagation();
    const { key, level, zone } = e.detail;
    const target = this.deviceOf(key);
    const z = zone && target?.zones && zone !== target.zones[0]?.id ? zone : undefined;
    if (target) void this.exec({ command: 'volume_set', level, ...(z ? { zone: z } : {}) }, target, {}, `vol:${key}${z ? `@${z}` : ''}`);
  };

  private onGroupVolume = (e: CustomEvent<{ level: number }>) => {
    e.stopPropagation();
    void this.runGroupVolume(e.detail.level, 'relative');
  };

  private onEqualize = (e: Event) => {
    e.stopPropagation();
    const d = this.detail;
    const lead = d && this.devices ? leaderOf(d, this.devices) : d;
    const rooms = lead ? roomRows(lead, this.devices ?? []) : [];
    const level = rooms.length ? Math.max(...rooms.map((r) => r.level ?? 0)) : null;
    if (level !== null) void this.runGroupVolume(level, 'absolute');
  };

  private async runGroupVolume(level: number, mode: 'relative' | 'absolute') {
    const d = this.detail;
    if (!d) return;
    const lead = this.devices ? leaderOf(d, this.devices) : d;
    if (!groupVolumeOffered(lead)) return;
    if (!this.groupGap.take()) {
      this.shake();
      return;
    }
    this.setPend('gvol', true);
    try {
      const res = await sendGroupVolume(lead.key, level, mode);
      const rec = await this.follow(res.bulk_id);
      if (rec) this.showRecord(rec, false);
    } catch (err) {
      this.onError(err);
    } finally {
      this.setPend('gvol', false);
      this.refreshSoon(0);
    }
  }

  /** A mute press (a room's or the device's own); steps and holds go through `KeyPress`. */
  private onMute(key: string) {
    const target = this.deviceOf(key);
    if (target) void this.exec({ command: 'mute', muted: !(target.live.volume.muted ?? false) }, target, {}, `mute:${key}`);
  }

  /** A held step / the keyboard's +/-: a volume step through the gate (the client's token bucket drops what is too fast). */
  private onStepKey(key: string) {
    const d = this.detail;
    if (!d) return;
    const dir = key === 'volup' ? 'up' : 'down';
    const zone = this.zone && d.zones && this.zone !== d.zones[0]?.id ? this.zone : undefined;
    if (d.caps.volume_step) void this.exec({ command: 'volume_step', direction: dir, ...(zone ? { zone } : {}) }, d, {}, 'step');
  }

  // ------------------------------------------------------------------------------------------------ the library and transfer

  private onItemDown = (_item: LibraryItem) => {
    const d = this.detail;
    this.longFired = false;
    if (!d || !enqueueOffered(d)) return;
    window.clearTimeout(this.longTimer);
    this.longTimer = window.setTimeout(() => {
      this.longFired = true;
      void this.exec({ command: 'play_item', item_ref: _item.item_ref, enqueue: 'next' }, d, {}, `item:${_item.item_ref}`);
    }, LONG_PRESS_MS);
  };

  private onItemUp = () => window.clearTimeout(this.longTimer);

  private onItem(item: LibraryItem) {
    window.clearTimeout(this.longTimer);
    if (this.longFired) {
      this.longFired = false;
      return;
    }
    void this.exec({ command: 'play_item', item_ref: item.item_ref }, this.detail, { itemName: item.name });
  }

  private onTransfer(from: PlayerDevice) {
    this.trMenu = false;
    void this.exec({ command: 'transfer', from_key: from.key });
  }

  // ------------------------------------------------------------------------------------------------ the group section

  private tickRoom(key: string, member: boolean) {
    const d = this.detail;
    if (!d || this.joining.size) return;
    this.draft.toggle(key, member);
    this.tick++;
    window.clearTimeout(this.joinTimer);
    this.joinTimer = window.setTimeout(() => void this.flushJoin(), JOIN_BATCH_MS);
  }

  private currentPlan(): JoinPlan | null {
    const d = this.detail;
    if (!d || !this.devices) return null;
    const lead = leaderOf(d, this.devices);
    const current = groupKeysOf(lead).filter((k) => k !== lead.key);
    return joinPlan(lead, current, this.draft.desired(current), this.devices);
  }

  /** 500 ms of quiet: the ticks become ONE join diff (who leaves, who joins). The party rule asks before anything is sent. */
  private async flushJoin() {
    const plan = this.currentPlan();
    if (!plan) return;
    if (!plan.diff.join.length && !plan.diff.leave.length) {
      this.draft.clear();
      this.tick++;
      return;
    }
    if (plan.needsConfirmation) {
      this.confirm = { plan, preview: null };
      return;
    }
    await this.runJoin(plan, false);
  }

  private async runJoin(plan: JoinPlan, confirmed: boolean) {
    const d = this.detail;
    if (!d) return;
    const lead = plan.after[0];
    this.joining = new Set([...plan.diff.join, ...plan.diff.leave]);
    this.outcomes = {};
    let asked = false;
    try {
      if (plan.diff.leave.length) {
        const r = await sendLeave(plan.diff.leave);
        const rec = await this.follow(r.bulk_id);
        if (rec) this.showRecord(rec, true);
      }
      if (plan.diff.join.length) {
        try {
          const r = await sendJoin(lead.key, plan.diff.join, confirmed);
          const rec = await this.follow(r.bulk_id);
          if (rec) this.showRecord(rec, true);
        } catch (err) {
          const pv = confirmPreview(err);
          if (!pv) throw err;
          asked = true;
          this.confirm = { plan, preview: pv };
        }
      }
    } catch (err) {
      this.onError(err);
    } finally {
      this.joining = new Set();
      if (!asked) {
        this.draft.clear();
        this.tick++;
      }
      void this.load(false);
    }
  }

  private async onConfirm() {
    const c = this.confirm;
    this.confirm = null;
    if (c) await this.runJoin(c.plan, true);
  }

  private onCancelConfirm() {
    this.confirm = null;
    this.draft.clear();
    this.tick++;
  }

  private async onUngroup() {
    const d = this.detail;
    if (!d || !this.devices || this.joining.size) return;
    const lead = leaderOf(d, this.devices);
    const members = groupKeysOf(lead).filter((k) => k !== lead.key);
    if (!members.length) return;
    this.joining = new Set(members);
    this.outcomes = {};
    try {
      const r = await sendLeave(members);
      const rec = await this.follow(r.bulk_id);
      if (rec) this.showRecord(rec, true);
    } catch (err) {
      this.onError(err);
    } finally {
      this.joining = new Set();
      void this.load(false);
    }
  }

  /** The record of a group run (join, leave, group volume): polled until done or 8 s; null = unknown (the state read tells the truth). */
  private async follow(bulkId: string): Promise<GroupRecord | null> {
    const token = this.token;
    const t0 = Date.now();
    while (Date.now() - t0 < RECORD_MAX_MS) {
      if (token !== this.token) return null;
      try {
        const r = await players().groupRecord(bulkId);
        if (r.status === 'done') return r;
      } catch {
        return null;
      }
      await new Promise((r) => window.setTimeout(r, RECORD_POLL_MS));
    }
    return null;
  }

  /** The outcome by room under each name, and the failures as lines at the top ("פרגולה לא הצטרף"). */
  private showRecord(rec: GroupRecord, join: boolean) {
    const out: Record<string, RoomOutcome> = {};
    const names = new Map<string, string>();
    for (const x of [this.detail, ...(this.devices ?? [])]) if (x) names.set(x.key, x.area_name ?? x.name);
    for (const m of rec.members) out[m.device_key] = { outcome: m.outcome };
    this.outcomes = out;
    const lines = failedLines(rec.members, names);
    if (lines.length) this.say(lines, 6000);
    else if (join) window.setTimeout(() => (this.outcomes = {}), 6000);
  }

  // ------------------------------------------------------------------------------------------------ events of the body

  /** The drawer's own `close` only: the confirmation inside it raises a `close` of its own that bubbles through the drawer. */
  private onClose = (e: Event) => {
    if (e.target !== e.currentTarget) return;
    this.open = false;
  };

  private stepKeyOf(e: Event): string | null {
    const el = (e.composedPath()[0] as HTMLElement | undefined)?.closest?.('[data-key]') as HTMLElement | null | undefined;
    if (!el || el.hasAttribute('disabled')) return null;
    const k = el.dataset.key ?? '';
    return k === 'volup' || k === 'voldown' ? k : null;
  }

  private onDown = (e: PointerEvent) => {
    const k = this.stepKeyOf(e);
    if (!k) return;
    this.press.down(e, k as never);
    const stop = () => {
      this.press.up();
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  private onClick = (e: MouseEvent) => {
    const path = e.composedPath() as HTMLElement[];
    const mute = path.find((n) => n.dataset?.muteKey !== undefined);
    if (mute) {
      this.onMute(mute.dataset.muteKey as string);
      return;
    }
    const k = this.stepKeyOf(e);
    if (k) this.press.click(e, k as never);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = this.stepKeyOf(e);
    if (k) this.press.keyDown(e, k as never);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = this.stepKeyOf(e);
    if (k) this.press.keyUp(e, k as never);
  };

  /** The desktop keyboard: +/- (held repeats) and M - only while the panel is open, on, and nobody is typing. */
  private onDocKeyDown = (e: KeyboardEvent) => {
    const d = this.detail;
    if (!this.open || !d || panelMode(d) !== 'on' || !d.can.control || this.confirm) return;
    const t = e.composedPath()[0] as HTMLElement | undefined;
    const key = keyFromEvent({ key: e.key, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, repeat: e.repeat, target: t ? { tagName: t.tagName, isContentEditable: t.isContentEditable } : null });
    if (key === 'mute' && d.caps.mute) {
      e.preventDefault();
      if (!e.repeat) this.onMute(d.key);
    } else if ((key === 'volup' || key === 'voldown') && d.caps.volume_step) {
      e.preventDefault();
      this.press.global(key, true, e.repeat);
    }
  };

  private onDocKeyUp = (e: KeyboardEvent) => {
    const key = keyFromEvent({ key: e.key });
    if (key === 'volup' || key === 'voldown') this.press.global(key, false);
  };

  // ------------------------------------------------------------------------------------------------ render

  render() {
    const d = this.detail;
    const sub = d ? [d.area_name, d.floor_name].filter(Boolean).map((x) => bidi(x)).join(' · ') : '';
    return html`<sw-drawer modal .open=${this.open} heading=${d ? bidi(d.name) : ''} subheading=${sub} @close=${this.onClose}>${d ? this.headerPower(d) : nothing}${this.body()}${this.dialog()}</sw-drawer>`;
  }

  /** The power button of the header (next to the close). A speaker's own power; a receiver's Main power (Zone2 has its own below). */
  private headerPower(d: PlayerDeviceDetail): TemplateResult | typeof nothing {
    if (viewOnly(d) || panelMode(d) === 'unavailable' || greyed(d) || (!d.caps.power_on && !d.caps.power_off)) return nothing; // no power capability: no button
    const main = zoneViews(d)[0];
    const p = playerPowerOffer(d, main?.id);
    if (p.action === 'none') return nothing;
    const lit = p.action === 'off';
    const pend = this.pend.has('power');
    return html`<button type="button" slot="action" class=${classMap({ hpw: true, on: lit })} data-pn-power=${p.action} aria-pressed=${String(lit)} aria-label=${lit ? 'כבה' : 'הפעל'} title=${p.enabled ? (lit ? 'כבה' : 'הפעל') : 'אין הפעלה מרחוק'}
      ?disabled=${!p.enabled || pend} @click=${() => void this.exec({ command: lit ? 'power_off' : 'power_on' })}>${ic('power')}${pend ? html`<span class="pendring"></span>` : nothing}</button>`;
  }

  private body(): TemplateResult {
    const d = this.detail;
    if (!d) {
      return this.phase === 'error'
        ? html`<div class="r" data-pn-state="error"><div class="errbox">${ic('warning')}<b>לא ניתן לטעון את הנגן</b><button type="button" class="btn" @click=${() => void this.load(true)}>נסו שוב</button></div></div>`
        : html`<div class="r" data-pn-state="loading" aria-busy="true"><span class="skl" style="block-size:132px;border-radius:22px"></span><span class="skl" style="block-size:66px;border-radius:33px"></span><span class="skl" style="block-size:44px"></span><span class="skl" style="block-size:160px;border-radius:18px"></span></div>`;
    }
    const mode = panelMode(d);
    const vo = viewOnly(d);
    return html`<div class="r" data-pn data-pn-state=${mode} data-pn-kind=${d.kind} ?data-view-only=${vo} ?data-greyed=${greyed(d)} ?data-not-confirmed=${!d.live.confirmed}
      @pointerdown=${this.onDown} @click=${this.onClick} @keydown=${this.onKeyDown} @keyup=${this.onKeyUp}
      @pv-volume=${this.onVolume} @pv-group-volume=${this.onGroupVolume} @pv-equalize=${this.onEqualize} @pv-rooms=${(e: CustomEvent<{ open: boolean }>) => (this.byRoom = e.detail.open)}>
      <div class="notice" role="status" aria-live="polite" ?hidden=${!this.notice.length}>${this.notice.length ? html`${ic('warning')}<span data-pn-notice>${this.notice.length > 1 ? html`<ul>${this.notice.map((n) => html`<li>${bidi(n)}</li>`)}</ul>` : bidi(this.notice[0])}</span>` : nothing}</div>
      ${mode === 'unavailable'
        ? this.unavailableBody(d)
        : d.kind === 'receiver'
        ? this.receiverBody(d, mode, vo)
        : mode === 'off'
        ? this.offBody(d, vo)
        : this.onBody(d, vo)}
    </div>`;
  }

  // --- unavailable, off

  private unavailableBody(d: PlayerDeviceDetail): TemplateResult {
    const u = playerUnavailableLine(d);
    return html`<div class="roff" data-pn-unavailable>${ic('wifiOff')}<b>${u.title}</b>${u.since ? html`<small>מאז <span class="n">${u.since}</span></small>` : nothing}</div>`;
  }

  private bigPower(d: PlayerDeviceDetail, vo: boolean, zone?: string): TemplateResult {
    const p = playerPowerOffer(d, zone);
    const pend = this.pend.has(zone ? `power:${zone}` : 'power');
    const on = p.action === 'on';
    const tip = vo || p.action === 'none' ? 'כבוי' : !p.enabled ? 'אין הפעלה מרחוק' : 'הפעל';
    // no power control at all (a Cast-only speaker asleep): a state, never a button
    if (!zone && !powerControlled(d)) return html`<div class="roff" data-pn-off data-pn-no-power>${ic(d.kind === 'player' ? 'playRect' : 'speaker')}<b>כבוי</b></div>`;
    return html`<div class="roff" data-pn-off>
      <button type="button" class=${classMap({ bigpw: true, pend })} data-pn-power=${on ? 'on' : 'none'} aria-label=${on ? 'הפעל' : 'כבוי'} title=${tip} ?disabled=${vo || !on || !p.enabled || pend}
        @click=${() => void this.exec({ command: 'power_on', ...(zone ? { zone } : {}) })}>${ic('power')}${pend ? html`<span class="pendring"></span>` : nothing}</button>
      <b>${on && p.enabled && !vo ? 'הפעל' : 'כבוי'}</b></div>`;
  }

  private offBody(d: PlayerDeviceDetail, vo: boolean): TemplateResult {
    return html`${this.bigPower(d, vo)}
      ${vo ? nothing : html`<div class="dimmed" aria-hidden="true" inert>${this.transportPad(d, d)}${this.volume(d, d, null)}</div>`}`;
  }

  // --- on: a speaker, a player, a group

  private onBody(d: PlayerDeviceDetail, vo: boolean): TemplateResult {
    const devices = this.devices ?? [];
    const lead = this.devices ? leaderOf(d, devices) : d;
    const src = hasNow(d.live) || !hasNow(lead.live) ? d : lead;
    if (vo) return html`${this.nowPlaying(d, src, lead, true)}${this.upNextBlock(d)}`;
    return html`${this.nowPlaying(d, src, lead, false)}${this.transportPad(d, src)}${this.volume(d, lead, devices)}${this.transferBlock(d, devices)}${this.upNextBlock(d)}${this.libraryBlock(d)}${this.groupBlock(d, lead, devices)}`;
  }

  private art(n: PlayerDevice['live']['now']): TemplateResult {
    const t = tint(n.hue);
    const station = n.kind === 'station';
    return html`<div class="thumb" style="--a1:${t.a1};--a2:${t.a2};--art:${t.rgb}" aria-hidden="true" data-pn-art=${station ? 'station' : n.artwork ? 'image' : 'tile'}>
      ${n.artwork ? html`<img src=${artworkUrl(n.artwork)} alt="" loading="lazy" />` : html`<span class="tile"></span>${gl(station ? 'radio' : n.glyph)}`}</div>`;
  }

  private nowPlaying(d: PlayerDeviceDetail, src: PlayerDevice, lead: PlayerDevice, vo: boolean): TemplateResult {
    const l = src.live;
    if (!hasNow(l)) {
      return html`<div class="idle" data-pn-idle>${ic(d.kind === 'player' ? 'playRect' : d.kind === 'group' ? 'group' : 'speaker')}<b>לא מנגן</b></div>`;
    }
    const n = l.now;
    const word = nowStatusWord(d, d.live.group.role === 'member' ? lead : null);
    const seek = seekState(src);
    const pos = this.seekDraft ?? positionOf(l, this.nowMs);
    const dur = n.duration_s;
    const f = fraction(pos, dur);
    const bar = seek === 'live'
      ? html`<div class="pprog" data-pn-live><span class="live"><i></i>שידור חי</span></div>`
      : seek === 'none'
      ? nothing
      : html`<div class="pprog" data-pn-progress><span class="tm n" data-pn-pos>${mmss(pos)}</span>
          ${seek === 'seek' && !vo
            ? html`<input class="rng seek" type="range" min="0" max="1000" step="1" .value=${String(Math.round(f * 1000))} style="--v:${Math.round(f * 100)}%" aria-label="מיקום בשיר" data-pn-seek @input=${this.onSeekInput} @change=${this.onSeekChange} />`
            : html`<span class="bar" style="--p:${Math.round(f * 100)}%"><i></i></span>`}
          <span class="tm n" data-pn-dur>${mmss(dur)}</span></div>`;
    return html`<div class="npb" data-pn-now data-pn-now-kind=${n.kind}><div class="top">${this.art(n)}<div class="t"><small data-pn-word>${word}</small><b data-pn-title>${bidi(n.title)}</b>${n.artist ? html`<span data-pn-artist>${bidi(n.artist)}</span>` : nothing}${n.album ? html`<span class="al">${bidi(n.album)}</span>` : nothing}</div></div>${bar}</div>`;
  }

  /** The pad. Each button only where `caps` allow it; `direction: ltr` so the glyphs are never mirrored. */
  private transportPad(d: PlayerDeviceDetail, src: PlayerDevice): TemplateResult | typeof nothing {
    const buttons = transportButtons(d);
    if (!buttons.length) return nothing;
    const playing = src.live.play === 'playing';
    const pend = (id: string) => this.pend.has(id);
    const k = (id: string, glyph: string, label: string, cls: string, act: () => void, extra: { pressed?: boolean; one?: boolean } = {}) => {
      const on = this.canSend(d, id);
      return html`<button type="button" class=${classMap({ kb: true, [cls]: true, pend: pend(id === 'play_pause' ? 'toggle' : id) })} data-pn-tp=${id} aria-label=${label} title=${label}
        aria-pressed=${extra.pressed === undefined ? nothing : String(extra.pressed)} ?disabled=${!on} @click=${act}><span class="kc">${ic(glyph)}${extra.one ? html`<span class="one">1</span>` : nothing}${pend(id === 'play_pause' ? 'toggle' : id) ? html`<span class="pendring"></span>` : nothing}</span></button>`;
    };
    return html`<div class=${classMap({ tport: true, shake: this.shaking })} role="group" aria-label="ניגון" data-pn-transport>${buttons.map((b) => {
      switch (b.id) {
        case 'shuffle': return k('shuffle', 'shuffle', d.live.shuffle ? 'ביטול ערבוב' : 'ערבוב', 'side', () => this.onShuffle(), { pressed: d.live.shuffle === true });
        case 'previous': return k('previous', 'prev', 'הקודם', '', () => this.transport('previous'));
        case 'play_pause': return k('play_pause', playing ? 'pause' : 'play', playing ? 'השהה' : 'נגן', 'main', () => this.transport('play_pause'));
        case 'next': return k('next', 'next', 'הבא', '', () => this.transport('next'));
        case 'repeat': return k('repeat', 'repeat', repeatLabel(d.live.repeat), 'side', () => this.onRepeat(), { pressed: d.live.repeat !== null && d.live.repeat !== 'off', one: d.live.repeat === 'one' });
      }
    })}</div>`;
  }

  /** Whether the pad button is live right now (capability, state, permission): else it is drawn greyed. */
  private canSend(d: PlayerDeviceDetail, id: string): boolean {
    if (panelMode(d) !== 'on') return false;
    const c: PlayerCommand = id === 'shuffle' ? { command: 'shuffle', on: true } : id === 'repeat' ? { command: 'repeat', mode: 'all' } : { command: 'transport', action: id as 'play_pause' | 'next' | 'previous' };
    return !greyed(d) && playerCommandOffered(d, c);
  }

  private volume(d: PlayerDeviceDetail, lead: PlayerDevice, devices: PlayerDevice[] | null): TemplateResult | typeof nothing {
    const rooms = devices ? roomRows(lead, devices) : [];
    const grouped = !!devices && isGroupedView(lead, rooms) && (lead.kind === 'group' || d.live.group.role !== 'none');
    const interactive = d.can.control && !greyed(d);
    if (grouped) {
      return html`<media-player-volume .group=${true} .device=${lead} .rooms=${rooms} .byRoom=${this.byRoom} .groupOffered=${groupVolumeOffered(lead)} .outcomes=${this.outcomes} .pend=${this.pend}
        .interactive=${interactive} .now=${this.clock()}></media-player-volume>`;
    }
    if (!d.caps.volume_set && !d.caps.volume_step && !d.caps.mute) return nothing;
    return html`<media-player-volume .device=${d} .pend=${this.pend} .interactive=${interactive} .now=${this.clock()}></media-player-volume>`;
  }

  private transferBlock(d: PlayerDeviceDetail, devices: PlayerDevice[]): TemplateResult | typeof nothing {
    const from = transferSources(d, devices);
    if (!transferOffered(d, from)) return nothing;
    const one = from.length === 1;
    const pend = this.pend.has('transfer');
    return html`<div class="ctas" data-pn-transfer><button type="button" class=${classMap({ btn: true, quiet: true, pend })} aria-haspopup=${one ? 'false' : 'menu'} aria-expanded=${one ? nothing : String(this.trMenu)} ?disabled=${pend}
        @click=${() => (one ? this.onTransfer(from[0]) : (this.trMenu = !this.trMenu))}>${ic('transfer')}העבר את המוזיקה לכאן${one ? html`<small>· מ${bidi(leaderLabel(from[0]))}</small>` : nothing}${pend ? html`<span class="pendring" style="inset:-4px;border-radius:999px"></span>` : nothing}</button>
      ${!one && this.trMenu ? html`<div class="pop" role="menu">${from.map((x) => html`<button type="button" role="menuitem" data-pn-transfer-from=${x.key} @click=${() => this.onTransfer(x)}><span class="gi" style=${`--a1:${tint(x.live.now.hue).a1};--a2:${tint(x.live.now.hue).a2}`}>${gl(x.live.now.kind === 'station' ? 'radio' : x.live.now.glyph)}</span>${bidi(leaderLabel(x))}<span class="cnt">${bidi(x.live.now.title)}</span></button>`)}</div>` : nothing}</div>`;
  }

  private upNextBlock(d: PlayerDeviceDetail): TemplateResult | typeof nothing {
    const v = upNextView(d, this.upNext, this.libAbsent);
    if (v.kind === 'none') return nothing;
    const head = html`<div class="psh"><h4>הבא בתור</h4>${v.kind === 'rows' && v.count ? html`<small class="n">${v.count}</small>` : nothing}</div>`;
    if (v.kind === 'loading') return html`${head}<div class="uq" aria-busy="true" data-pn-upnext="loading"><span class="skl skl-row"></span><span class="skl skl-row"></span></div>`;
    if (v.kind === 'unavailable') return html`${head}<div class="uq" data-pn-upnext="unavailable"><div class="unav">${ic('wifiOff')}לא זמין</div></div>`;
    return html`${head}<div class="uq" data-pn-upnext="rows">
      <div class="row cur"><span class="ix">${ic(v.current.playing ? 'play' : 'pause')}</span><div class="t"><b>${bidi(v.current.name)}</b>${v.current.artist ? html`<small>${bidi(v.current.artist)}</small>` : nothing}</div><span class="dur n">${v.current.duration_s ? mmss(v.current.duration_s) : ''}</span></div>
      ${v.next ? html`<div class="row" data-pn-next><span class="ix n">${v.next.index !== null ? v.next.index + 1 : ''}</span><div class="t"><b>${bidi(v.next.name)}</b>${v.next.artist ? html`<small>${bidi(v.next.artist)}</small>` : nothing}</div><span class="dur n">${v.next.duration_s ? mmss(v.next.duration_s) : ''}</span></div>` : nothing}
      ${v.more > 0 ? html`<div class="umore" data-pn-more>${ic('chevronDown')}עוד <span class="n">${v.more}</span></div>` : nothing}</div>`;
  }

  private libraryBlock(d: PlayerDeviceDetail): TemplateResult | typeof nothing {
    if (this.libAbsent || !d.live.caps_known) return nothing;
    const tabs = libraryTabs(d, this.kindsOn);
    if (!tabs.length) return nothing;
    const tab = pickTab(tabs, this.libTab) as LibraryKind;
    const page = this.lib[tab];
    const items = page && page !== 'error' ? page.items : null;
    const cur = d.live.now.title;
    return html`<div class="seg full sm" role="tablist" aria-label="ספרייה" data-pn-libtabs>${tabs.map((k) => html`<button type="button" role="tab" aria-selected=${String(tab === k)} data-pn-libtab=${k}
        @click=${() => { this.libTab = k; if (!this.lib[k]) void this.loadLib(d.key, k); }}>${LIBRARY_TAB_LABEL[k]}</button>`)}</div>
      ${items === null
        ? page === 'error'
          ? html`<div class="libempty" data-pn-lib="error">לא זמין</div>`
          : html`<div class="libg" aria-busy="true" data-pn-lib="loading"><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span></div>`
        : items.length
        ? html`<div class="libg" role="list" data-pn-lib=${tab}>${repeat(items, (i) => i.item_ref, (i) => this.libItem(d, i, cur))}</div>`
        : html`<div class="libempty" data-pn-lib="empty">אין פריטים</div>`}`;
  }

  private libItem(d: PlayerDeviceDetail, i: LibraryItem, current: string | null): TemplateResult {
    const t = tint(i.hue);
    const pend = this.pend.has(`item:${i.item_ref}`);
    const can = d.can.control && !greyed(d);
    return html`<button type="button" role="listitem" class=${classMap({ libi: true, pend })} data-pn-item=${i.item_ref} aria-current=${String(current !== null && i.name === current)} ?disabled=${!can || pend}
      title=${enqueueOffered(d) ? 'נגן עכשיו · לחיצה ארוכה: אחרי הנוכחי' : 'נגן עכשיו'} @pointerdown=${() => this.onItemDown(i)} @pointerup=${this.onItemUp} @pointerleave=${this.onItemUp} @pointercancel=${this.onItemUp} @click=${() => this.onItem(i)}>
      <span class="gi" style="--a1:${t.a1};--a2:${t.a2};--art:${t.rgb}">${gl(i.kind === 'radio' ? 'radio' : i.glyph, 'ic')}</span>
      <span class="t"><b>${bidi(i.name)}</b>${i.artist ? html`<small>${bidi(i.artist)}</small>` : nothing}</span></button>`;
  }

  private groupBlock(d: PlayerDeviceDetail, lead: PlayerDevice, devices: PlayerDevice[]): TemplateResult | typeof nothing {
    if (!this.devices) return nothing;
    if (lead.live.group.conflict || d.live.group.conflict) {
      return html`<div class="psh"><h4>קבוצה</h4></div><div class="ckrow warn" role="status" data-pn-conflict>${ic('warning')}<div class="nm"><b>קיבוץ לא תואם</b><small>מנהל יפרק אחת מהשכבות בהגדרות</small></div></div>`;
    }
    const rows = groupSectionRows(lead, devices);
    if (!groupSectionShown(lead, rows)) return nothing;
    void this.tick;
    const members = rows.filter((r) => r.member).length;
    return html`<div class="psh"><h4>קבוצה</h4>${members > 1 ? html`<small data-pn-gcount>${members} חדרים</small>` : nothing}${members > 1 ? html`<button type="button" class="lnk" data-pn-ungroup ?disabled=${this.joining.size > 0} @click=${() => void this.onUngroup()}>פרק</button>` : nothing}</div>
      <div class="gsec" role="group" aria-label="חדרים בקבוצה" data-pn-group>${rows.map((r) => {
        const drafted = this.draft.has(r.key);
        const checked = r.leader ? true : drafted ? !r.member : r.member;
        const o = this.outcomes[r.key]?.outcome;
        const bad = o === 'not_joined' || o === 'unknown' || o === 'not_allowed';
        const dev = r.leader ? lead : devices.find((x) => x.key === r.key);
        const sub = o && o !== 'joined' && o !== 'left' ? html`<small class=${bad ? 'bad' : 'ok'} data-pn-gout=${o}>${o === 'not_joined' ? 'לא הצטרף' : o === 'unknown' ? 'לא ידוע' : o === 'not_allowed' ? 'אין הרשאה' : ''}</small>` : html`<small>${bidi(r.sub)}</small>`;
        const spin = drafted || this.joining.has(r.key);
        const t = r.playing ? tint(r.playing.hue) : null;
        return html`<button type="button" class=${classMap({ ckrow: true, lead: r.leader })} role="checkbox" aria-checked=${String(checked)} data-pn-room=${r.key} ?disabled=${r.leader || !dev || this.joining.size > 0}
          @click=${() => this.tickRoom(r.key, r.member)}><span class="ck">${ic('check')}${spin ? html`<span class="pendring"></span>` : nothing}</span><div class="nm"><b>${bidi(r.name)}</b>${sub}</div>
          ${r.playing && t ? html`<span class="gi" style="--a1:${t.a1};--a2:${t.a2}">${gl(r.playing.glyph, 'ic')}</span>` : nothing}</button>`;
      })}</div>`;
  }

  // --- the confirmation of a big group (rendered inside the drawer: everything outside the top layer is inert)

  private dialog(): TemplateResult | typeof nothing {
    const c = this.confirm;
    if (!c) return nothing;
    const copy = confirmCopy(c.preview, c.plan);
    const names = c.preview ? c.preview.members.map((m) => m.name) : c.plan.after.map((x) => x.name);
    return html`<sw-dialog open heading=${copy.question} data-pn-dialog="confirm" @close=${(e: Event) => { e.stopPropagation(); this.onCancelConfirm(); }}>
      <div class="cd">${copy.line ? html`<p class="cd-line">${copy.line}</p>` : nothing}
        <details data-pn-details><summary>פרטים</summary><ul>${names.map((n) => html`<li>${bidi(n)}</li>`)}</ul></details></div>
      <sw-button slot="footer" data-pn-cancel @click=${() => this.onCancelConfirm()}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-pn-confirm @click=${() => void this.onConfirm()}>צרף</sw-button></sw-dialog>`;
  }

  // --- a receiver: zones, power, volume, sources, sound modes (no keys)

  private sourceIcon(s: { id: string; glyph: string }): string {
    const id = s.id.toLowerCase();
    return id.includes('bluetooth') ? 'bt' : id.includes('tuner') || id.includes('radio') ? 'radio' : id === 'tv' ? 'tv' : s.glyph === 'speaker' ? 'speaker' : 'hdmi';
  }

  private receiverBody(d: PlayerDeviceDetail, mode: 'on' | 'off', vo: boolean): TemplateResult {
    const zones = zoneViews(d);
    const zid = zones.length ? (zones.find((z) => z.id === this.zone) ?? zones[0]).id : '';
    const z = zones.length ? zoneView(d, zid) : null;
    const second = !!z && !z.main;
    const zoneTabs = zones.length > 1
      ? html`<div class="seg full" role="tablist" aria-label="אזור" data-pn-zones>${zones.map((x) => html`<button type="button" role="tab" aria-selected=${String(x.id === zid)} data-pn-zone=${x.id} @click=${() => (this.zone = x.id)}>${x.name}${!x.main ? html` <small>${x.power === 'on' ? 'פועל' : 'כבוי'}</small>` : nothing}</button>`)}</div>`
      : nothing;
    if (vo) return html`${zoneTabs}<div class="roff" data-pn-viewonly>${ic('receiver')}<b>${second ? (z?.power === 'on' ? 'פועל' : 'כבוי') : mode === 'on' ? d.live.now.label || 'דולק' : 'כבוי'}</b></div>`;
    if (!second && mode === 'off') return html`${zoneTabs}${this.bigPower(d, vo)}<div class="dimmed" aria-hidden="true" inert>${this.receiverControls(d, null)}</div>`;
    if (second && z && z.power !== 'on') {
      return html`${zoneTabs}${this.bigPower(d, vo, zid)}<div class="dimmed" aria-hidden="true" inert>${this.receiverControls(d, zid)}</div>`;
    }
    return html`${zoneTabs}${second ? this.zonePower(d, z!) : nothing}${this.receiverControls(d, second ? zid : null)}`;
  }

  /** A second zone's own power (the header button is Main's). */
  private zonePower(d: PlayerDeviceDetail, z: { id: string; name: string }): TemplateResult | typeof nothing {
    const p = playerPowerOffer(d, z.id);
    if (p.action === 'none') return nothing;
    const lit = p.action === 'off';
    const pend = this.pend.has(`power:${z.id}`);
    return html`<div class="rzone"><button type="button" class=${classMap({ hpw: true, on: lit, 'zone-pw': true })} data-pn-zone-power=${p.action} aria-pressed=${String(lit)} aria-label=${`${lit ? 'כבה' : 'הפעל'} · ${z.name}`} ?disabled=${!p.enabled || pend}
      @click=${() => void this.exec({ command: lit ? 'power_off' : 'power_on', zone: z.id })}>${ic('power')}${pend ? html`<span class="pendring"></span>` : nothing}</button></div>`;
  }

  private receiverControls(d: PlayerDeviceDetail, zone: string | null): TemplateResult {
    const z = zone ? zoneView(d, zone) : null;
    const curSrc = z && !z.main ? z.source_id : d.live.now.source_id;
    const curMode = z && !z.main ? z.sound_mode : d.live.sound_output;
    const interactive = d.can.control && !greyed(d);
    const canSrc = d.can.power && d.caps.sources && !greyed(d);
    const srcs = d.sources.length && d.caps.sources
      ? html`<div class="psh"><h4>${z && !z.main ? `מקור · ${z.name}` : 'מקורות'}</h4></div><div class="srcg" role="radiogroup" aria-label="מקורות" data-pn-sources>${d.sources.map((s) => {
          const [a, b] = s.label.split(' · ');
          const cur = s.id === curSrc;
          const pend = this.pend.has(`src:${s.id}`);
          return html`<button type="button" class="srci" role="radio" aria-checked=${String(cur)} data-pn-source=${s.id} ?disabled=${!canSrc || pend}
            @click=${() => void this.exec({ command: 'source', source_id: s.id, ...(z && !z.main ? { zone: z.id } : {}) })}>
            <span class="gi src">${ic(this.sourceIcon(s))}</span><span><bdi>${a}</bdi>${b ? html`<small>${bidi(b)}</small>` : nothing}</span>${cur && !pend ? html`<span class="ck">${ic('check')}</span>` : nothing}${pend ? html`<span class="pendring" style="inset:8px;inset-inline-start:auto;inline-size:18px;block-size:18px;border-width:2px"></span>` : nothing}</button>`;
        })}</div>`
      : nothing;
    const modes = !(z && !z.main) && d.caps.sound_outputs.length && d.can.power
      ? html`<div class="psh"><h4>מצב שמע</h4>${d.caps.sound_outputs.length > 4 ? html`<small class="n">${d.caps.sound_outputs.length}</small>` : nothing}</div><div class="modes" role="radiogroup" aria-label="מצב שמע" data-pn-modes>${d.caps.sound_outputs.map((m) => {
          const cur = m === curMode;
          const pend = this.pend.has(`mode:${m}`);
          return html`<button type="button" class="srci" role="radio" aria-checked=${String(cur)} data-pn-mode=${m} ?disabled=${greyed(d) || pend} @click=${() => void this.exec({ command: 'sound_output', output: m })}>${bidi(m)}${cur ? html`<span class="ck">${ic('check')}</span>` : nothing}</button>`;
        })}</div>`
      : nothing;
    const vol = d.caps.volume_set || d.caps.volume_step || d.caps.mute
      ? html`<media-player-volume .device=${d} .zone=${z && !z.main ? z.id : null} .pend=${this.pend} .interactive=${interactive} .now=${this.clock()}></media-player-volume>`
      : nothing;
    return html`${vol}${srcs}${modes}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-player-panel': MediaPlayerPanel;
  }
}
