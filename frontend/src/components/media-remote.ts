import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import './sw-drawer';
import './media-remote-pad';
import './media-player-panel';
import '../screens/multimedia-remote-editor';
import { ApiError } from '../api/client';
import { getAction } from '../api/ha';
import { isApi } from '../api/session';
import { players } from '../api/media-players';
import {
  ERROR_LABEL, CONFIRM_TIMEOUT_MS, artworkUrl, commandOffered, media, sendCommand,
  type KeyId, type MediaCommand, type MediaDeviceDetail, type MediaStatus, type RemoteSection, type SourceItem, type TransportAction,
} from '../api/media-screens';
import { applyDevicesScheme, loadDevicesPrefs } from '../screens/devices-style';
import { mirrorSkin } from '../styles/media-glass';
import { registerScreenEdit } from '../shell/screen-edit';
import { bidi } from '../i18n/bidi';
import { COLOR_KEYS, ICON, KEY_GLYPH, KEY_LABEL, NUM_KEYS, XTRA_KEYS, XTRA_SPOKEN_ELSEWHERE, glyphPath, tint } from './media-remote-keys';
import {
  CommandGate, cleanText, digitOf, expectation, isCurrent, isRepeatable, keyFromEvent, layoutOf, mmss, padModes, positionNow, powerOffer, pushDigit,
  recentChips, remoteMode, remoteTabs, unavailableLine, viewOnly, volumeTarget, artSwitchOffered, type RemoteTab,
} from './media-remote-logic';
import { KeyPress } from './media-remote-press';
import { remoteStyles, remoteTokens } from './media-remote-css';

const ic = (name: string): TemplateResult => html`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${unsafeSVG(ICON[name] ?? '')}</svg>`;
const POLL_MS = 4000;
const CONFIRM_POLL_MS = 600;
const VOLUME_DEBOUNCE_MS = 250;

/**
 * The remote ("שלט", CR-015 §7.2): ONE component for the screens page, the area card and the home widget. A modal `sw-drawer`
 * - a side panel on desktop / tablet (next to the rail, at the start edge), a bottom sheet with a grab handle on a phone.
 *
 *   <media-remote .deviceKey=${key} .open=${open} @close=${...}></media-remote>
 *
 * It draws what `caps` of the screen allows and nothing else; the server re-checks every command. Safety (media-remote-logic.ts):
 * opening sends nothing; every key / volume step / mute / transport press goes through `CommandGate` (the client's KeyThrottle,
 * 5/s burst 8; a press over it is dropped - a short shake, no text, never queued); arrows and volume repeat while held (200 ms,
 * at most 10 s); there is no power key - power is the turn_on / turn_off buttons only, one command in flight per screen; an
 * accepted command shows as pending until the screen's state confirms it, after 8 s "המסך לא אישר את הפקודה" and the last
 * confirmed state is back.
 *
 * States: loading, error, unavailable ("המסך לא זמין · מאז HH:MM" and nothing else), off (the big "הפעל" over a dimmed pad), art
 * (Frame art mode: turn off / switch to viewing), no remote wake (power-on disabled, the reason in its tooltip), view-only
 * (`media.read` only: the state, no controls), pending, not confirmed, rate-limited.
 *
 * Events: `close` (from the drawer), `media-changed` { key } after every refreshed state (cards refetch), `media-remote-open`
 * { key } when the remote opens itself through the user menu's "עריכת השלט". Editing ("עריכת השלט") is registered in the user
 * menu for holders of media.layout and replaces the body with `<media-remote-editor>`.
 */
@customElement('media-remote')
export class MediaRemote extends LitElement {
  @property({ attribute: 'device-key' }) deviceKey = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** The colour scheme when the host already knows it (light | dark | auto); empty = the installation's `devices.scheme`. */
  @property() scheme: '' | 'light' | 'dark' | 'auto' = '';
  /** CR-016: the device's kind when the host knows it. A speaker, player, receiver or group (anything but a screen) is drawn by
   * `<media-player-panel>` in the same drawer; empty = a screen, or learned from the first read of the device. */
  @property() kind = '';

  @state() private detail: MediaDeviceDetail | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private tab: RemoteTab = 'pad';
  @state() private more = false;
  @state() private pad: 'dpad' | 'touch' = 'dpad';
  @state() private audio: 'screen' | 'linked' | null = null;
  @state() private pend = new Set<string>();
  @state() private notice = '';
  @state() private shaking = false;
  @state() private volDraft: number | null = null;
  @state() private typed = '';
  @state() private chbuf = '';
  @state() private editing = false;
  @state() private nowMs = Date.now();
  @state() private status: MediaStatus | null = null;

  private gate = new CommandGate();
  private readonly press = new KeyPress((key) => this.onKey(key));
  private token = 0;
  private pollTimer = 0;
  private tickTimer = 0;
  private noticeTimer = 0;
  private volTimer = 0;
  private chTimer = 0;
  private refreshTimer = 0;
  private offEdit: (() => void) | null = null;
  private openedOnce = false;

  static styles = [remoteTokens, remoteStyles];

  // ------------------------------------------------------------------------------------------------ lifecycle

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute('data-devices-scheme')) this.setAttribute('data-devices-scheme', 'light');
    mirrorSkin(this); // the bubble skin: the remote's tokens follow the product's (media-remote-css.ts)
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.end();
    this.offEdit?.();
    this.offEdit = null;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('deviceKey') && changed.get('deviceKey') !== undefined) {
      if (!changed.has('kind')) this.kind = ''; // the next device may be a screen again; its first read says
      this.resetForDevice();
    }
  }

  /** The device is not a screen: the player panel draws it (CR-016). */
  private get isPlayer(): boolean {
    return this.kind !== '' && this.kind !== 'screen';
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has('kind') && this.isPlayer) this.end();
    if (this.isPlayer) return;
    if (changed.has('open') || changed.has('deviceKey')) {
      if (this.open && this.deviceKey) this.begin();
      else if (!this.open) this.end();
    }
    this.syncGlow();
  }

  private resetForDevice() {
    this.detail = null;
    this.phase = 'loading';
    this.tab = 'pad';
    this.more = false;
    this.audio = null;
    this.pend = new Set();
    this.notice = '';
    this.volDraft = null;
    this.typed = '';
    this.chbuf = '';
    this.gate = new CommandGate();
    this.press.stopAll();
  }

  private begin() {
    if (!this.openedOnce) {
      this.openedOnce = true;
      this.registerEdit();
    }
    if (this.scheme) applyDevicesScheme(this, this.scheme);
    else void loadDevicesPrefs().then((p) => applyDevicesScheme(this, p.scheme));
    void media().status().then((s) => (this.status = s)).catch(() => undefined);
    void this.load(true);
    window.clearInterval(this.pollTimer);
    this.pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && this.pend.size === 0 && !this.editing) void this.load(false);
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
    window.clearTimeout(this.noticeTimer);
    window.clearTimeout(this.volTimer);
    window.clearTimeout(this.chTimer);
    window.clearTimeout(this.refreshTimer);
    this.token++; // in-flight loads and confirmations stop mattering
    this.press.stopAll();
    this.pad_()?.stop();
    document.removeEventListener('keydown', this.onDocKeyDown, true);
    document.removeEventListener('keyup', this.onDocKeyUp, true);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onBlur);
    this.pend = new Set();
    this.gate.powerDone();
    this.editing = false;
  }

  private onBlur = () => {
    if (document.visibilityState === 'hidden' || !document.hasFocus()) {
      this.press.stopAll();
      this.pad_()?.stop();
    }
  };

  private pad_(): { stop: () => void } | null {
    return this.renderRoot.querySelector('media-remote-pad');
  }

  private registerEdit() {
    this.offEdit?.();
    this.offEdit = registerScreenEdit({
      id: 'multimedia-remote',
      label: 'עריכת השלט',
      icon: 'edit',
      can: () => !!this.deviceKey && this.status?.can.layout === true && !this.editing,
      run: () => {
        this.editing = true;
        if (!this.open) {
          this.open = true;
          this.dispatchEvent(new CustomEvent('media-remote-open', { detail: { key: this.deviceKey }, bubbles: true, composed: true }));
        }
      },
    });
  }

  /** The glow behind the header follows what is showing (the drawer's surface reads --mr-art through --dv-surface-solid). */
  private syncGlow() {
    const d = this.detail;
    let rgb = '107 119 136';
    if (d && (d.live.power === 'on' || d.live.power === 'art')) {
      const n = d.live.now;
      rgb = n.kind === 'art' ? '214 160 104' : n.kind === 'saver' ? '70 92 170' : n.kind === 'channel' || n.kind === 'source' ? '64 118 214' : tint(n.hue).rgb;
    }
    this.style.setProperty('--mr-art', rgb);
  }

  // ------------------------------------------------------------------------------------------------ data

  private async load(first: boolean): Promise<void> {
    const key = this.deviceKey;
    if (!key) return;
    const token = ++this.token;
    if (first) this.phase = this.detail && this.detail.key === key ? this.phase : 'loading';
    try {
      const d = await media().get(key);
      if (token !== this.token || key !== this.deviceKey) return;
      this.applyDetail(d);
    } catch {
      if (token !== this.token) return;
      if (!this.detail && (await this.learnPlayer(key, token))) return;
      if (!this.detail) this.phase = 'error';
    }
  }

  /** A key the screens client does not know (the demo's mock keeps players apart): ask the players client; a non-screen is routed to the panel. */
  private async learnPlayer(key: string, token: number): Promise<boolean> {
    try {
      const p = await players().get(key);
      if (token !== this.token || key !== this.deviceKey || p.kind === 'screen') return false;
      this.kind = p.kind;
      return true;
    } catch {
      return false;
    }
  }

  private applyDetail(d: MediaDeviceDetail) {
    if (d.kind !== 'screen') {
      this.kind = d.kind; // the real backend answers players on the same route
      return;
    }
    this.detail = d;
    this.phase = 'ready';
    if (this.audio === null && d.audio_link) this.audio = d.live.volume.target ?? d.audio_link.default;
    if (!remoteTabs(d).includes(this.tab)) this.tab = 'pad';
    this.dispatchEvent(new CustomEvent('media-changed', { detail: { key: d.key }, bubbles: true, composed: true }));
  }

  private refreshSoon(ms = 500) {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => void this.load(false), ms);
  }

  // ------------------------------------------------------------------------------------------------ sending

  /** A key press from any control (pointer, keyboard, the pad): mapped to its command, then through the gate. */
  private onKey(key: KeyId) {
    const d = this.detail;
    if (!d || this.editing) return;
    const target = d.audio_link ? volumeTarget(d, this.audio) : undefined;
    let cmd: MediaCommand;
    switch (key) {
      case 'volup': cmd = { command: 'volume_step', direction: 'up', target }; break;
      case 'voldown': cmd = { command: 'volume_step', direction: 'down', target }; break;
      case 'mute': cmd = { command: 'mute', muted: !(d.live.volume.muted ?? false), target }; break;
      default: cmd = { command: 'key', key };
    }
    if (key.startsWith('n') && digitOf(key)) this.noteDigit(digitOf(key));
    void this.exec(cmd);
  }

  private transport(action: TransportAction) {
    void this.exec({ command: 'transport', action });
  }

  private noteDigit(d: string) {
    this.chbuf = pushDigit(this.chbuf, d);
    window.clearTimeout(this.chTimer);
    this.chTimer = window.setTimeout(() => {
      this.chbuf = '';
      this.refreshSoon(300);
    }, 1300);
  }

  private shake() {
    this.shaking = true;
    window.setTimeout(() => (this.shaking = false), 260);
  }

  private say(text: string, ms = 3200) {
    this.notice = text;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => (this.notice = ''), ms);
  }

  private setPend(id: string, on: boolean) {
    const next = new Set(this.pend);
    if (on) next.add(id);
    else next.delete(id);
    this.pend = next;
  }

  /** The one way out: gate -> sendCommand -> (pending until the state confirms, for commands that can be confirmed). */
  private async exec(cmd: MediaCommand): Promise<void> {
    const d = this.detail;
    if (!d) return;
    const verdict = this.gate.check(d, cmd);
    if (verdict === 'dropped') {
      this.shake();
      return;
    }
    if (verdict !== 'send') return;
    const ctrl = this.ctrlOf(cmd);
    const confirmable = expectation(cmd, d.live);
    const keyLike = confirmable === null;
    if (!keyLike) this.setPend(ctrl, true);
    let res;
    try {
      res = await sendCommand(d.key, cmd);
    } catch (err) {
      this.setPend(ctrl, false);
      if (cmd.command === 'power_on' || cmd.command === 'power_off') this.gate.powerDone();
      this.onError(err);
      return;
    }
    if (res.status === 'refused') {
      this.setPend(ctrl, false);
      if (cmd.command === 'power_on' || cmd.command === 'power_off') this.gate.powerDone();
      this.say(ERROR_LABEL[res.error ?? ''] ?? ERROR_LABEL.not_confirmed);
      this.refreshSoon(0);
      return;
    }
    if (keyLike || res.status === 'sent') {
      this.setPend(ctrl, false);
      if (cmd.command === 'volume_step' || cmd.command === 'mute') this.refreshSoon(600);
      return;
    }
    await this.confirm(cmd, ctrl, confirmable, res.action_id);
  }

  private ctrlOf(c: MediaCommand): string {
    switch (c.command) {
      case 'power_on': case 'power_off': return 'power';
      case 'source': return `src:${c.source_id}`;
      case 'app': return `app:${c.app_id}`;
      case 'volume_set': return 'vol';
      case 'volume_step': return 'step';
      default: return c.command;
    }
  }

  /** Pending until `expect` holds for a fresh state, or 8 s pass: then "המסך לא אישר את הפקודה" and the last confirmed state. */
  private async confirm(cmd: MediaCommand, ctrl: string, expect: NonNullable<ReturnType<typeof expectation>>, actionId: string | null): Promise<void> {
    const key = this.deviceKey;
    const token = this.token;
    const t0 = Date.now();
    while (Date.now() - t0 < CONFIRM_TIMEOUT_MS) {
      if (token !== this.token || key !== this.deviceKey) return;
      try {
        const d = await media().get(key);
        if (token !== this.token) return;
        this.applyDetail(d);
        if (expect(d.live)) {
          this.setPend(ctrl, false);
          if (cmd.command === 'power_on' || cmd.command === 'power_off') this.gate.powerDone();
          this.volDraft = null;
          return;
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
    if (token !== this.token) return;
    this.setPend(ctrl, false);
    if (cmd.command === 'power_on' || cmd.command === 'power_off') this.gate.powerDone();
    this.volDraft = null;
    this.say(ERROR_LABEL.not_confirmed);
    void this.load(false); // the last confirmed state
  }

  private onError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.code === 'rate_limited' || err.status === 429) {
        this.shake();
        return;
      }
      this.say(ERROR_LABEL[err.code] ?? err.body.user_message ?? ERROR_LABEL.not_confirmed);
      if (['screen_off', 'unavailable', 'not_found'].includes(err.code)) this.refreshSoon(0);
      return;
    }
    this.say(ERROR_LABEL.not_confirmed);
  }

  // ------------------------------------------------------------------------------------------------ events of the body

  /** The remote's own drawer closed. Ignored once the device turned out to be a player: removing the remote's open drawer to make room
   * for the player panel fires one `close`, which must not close the panel that replaces it. */
  private onClose = () => {
    if (this.isPlayer) return;
    this.open = false;
  };

  private onPanelClose = () => {
    this.open = false;
  };

  private keyOf(e: Event): { el: HTMLElement; key: KeyId } | null {
    const el = (e.composedPath()[0] as HTMLElement | undefined)?.closest?.('[data-key]') as HTMLElement | null | undefined;
    if (!el || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return null;
    return { el, key: el.dataset.key as KeyId };
  }

  private onDown = (e: PointerEvent) => {
    const k = this.keyOf(e);
    if (!k) return;
    this.press.down(e, k.key);
    this.flashEl(k.el);
    try {
      navigator.vibrate?.(8);
    } catch {
      /* no haptics */
    }
    const stop = () => {
      this.press.up();
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  private onClick = (e: MouseEvent) => {
    const k = this.keyOf(e);
    if (k) this.press.click(e, k.key);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = this.keyOf(e);
    if (k) this.press.keyDown(e, k.key);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = this.keyOf(e);
    if (k) this.press.keyUp(e, k.key);
  };

  private flashEl(el: HTMLElement) {
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
    window.setTimeout(() => el.classList.remove('hit'), 180);
  }

  /** The desktop keyboard: arrows, Enter, Backspace, +/-, M, Page Up / Down - only while the remote is open, not editing, and not typing. */
  private onDocKeyDown = (e: KeyboardEvent) => {
    if (!this.open || this.editing || !this.detail || remoteMode(this.detail) !== 'on') return;
    const t = e.composedPath()[0] as HTMLElement | undefined;
    const key = keyFromEvent({ key: e.key, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, repeat: e.repeat, target: t ? { tagName: t.tagName, isContentEditable: t.isContentEditable } : null });
    if (!key || !this.detail.caps.keys.includes(key) && !['volup', 'voldown', 'mute'].includes(key)) return;
    if (!this.detail.can.control) return;
    e.preventDefault();
    this.press.global(key, true, e.repeat);
    const el = this.renderRoot.querySelector<HTMLElement>(`[data-key="${key}"]`);
    if (el && !e.repeat) this.flashEl(el);
  };

  private onDocKeyUp = (e: KeyboardEvent) => {
    const key = keyFromEvent({ key: e.key });
    if (key && isRepeatable(key)) this.press.global(key, false);
    else if (key) this.press.global(key, false);
  };

  private onPadKey = (e: CustomEvent<{ key: KeyId }>) => {
    e.stopPropagation();
    this.onKey(e.detail.key);
  };

  private onVolume = (e: Event) => {
    const v = Number((e.target as HTMLInputElement).value);
    this.volDraft = v;
    window.clearTimeout(this.volTimer);
    this.volTimer = window.setTimeout(() => {
      const d = this.detail;
      const target = d?.audio_link ? volumeTarget(d, this.audio) : undefined;
      void this.exec({ command: 'volume_set', level: v, target });
    }, VOLUME_DEBOUNCE_MS);
  };

  private onText = (e: Event) => {
    const el = e.target as HTMLInputElement;
    const v = cleanText(el.value);
    if (v !== el.value) el.value = v;
    this.typed = v;
  };

  private sendText() {
    const text = this.typed.trim();
    if (!text) return;
    void this.exec({ command: 'text', text }).then(() => {
      this.typed = '';
    });
  }

  // ------------------------------------------------------------------------------------------------ render

  render() {
    if (this.isPlayer) {
      return html`<media-player-panel .deviceKey=${this.deviceKey} .open=${this.open} .scheme=${this.scheme} @close=${this.onPanelClose}></media-player-panel>`;
    }
    const d = this.detail;
    const sub = d ? [d.area_name, d.floor_name].filter(Boolean).map((x) => bidi(x)).join(' · ') : '';
    return html`<sw-drawer modal .open=${this.open} heading=${d ? bidi(d.name) : ''} subheading=${sub} @close=${this.onClose}>${this.body()}</sw-drawer>`;
  }

  private body(): TemplateResult {
    const d = this.detail;
    if (!d) {
      return this.phase === 'error'
        ? html`<div class="r" data-mr-state="error"><div class="errbox">${ic('warning')}<b>לא ניתן לטעון את המסך</b><button type="button" class="btn" @click=${() => void this.load(true)}>נסו שוב</button></div></div>`
        : html`<div class="r" data-mr-state="loading" aria-busy="true"><span class="skl" style="block-size:92px;border-radius:20px"></span><span class="skl" style="block-size:48px"></span><span class="skl" style="block-size:340px;border-radius:32px"></span></div>`;
    }
    if (this.editing) {
      return html`<div class="r" data-mr-state="editing"><media-remote-editor .device=${d} .canConfigure=${this.status?.can.configure === true}
        @editor-done=${this.onEditorDone}></media-remote-editor></div>`;
    }
    const mode = remoteMode(d);
    const vo = viewOnly(d);
    return html`<div class="r" data-mr data-mr-state=${mode} data-mr-profile=${d.profile} ?data-view-only=${vo} ?data-not-confirmed=${!d.live.confirmed}
      @pointerdown=${this.onDown} @click=${this.onClick} @keydown=${this.onKeyDown} @keyup=${this.onKeyUp}>
      <div class="notice" role="status" aria-live="polite" ?hidden=${!this.notice}>${this.notice ? html`${ic('warning')}<span data-mr-notice>${this.notice}</span>` : nothing}</div>
      ${mode === 'unavailable'
        ? this.unavailableBody(d)
        : mode === 'on'
        ? html`${this.nowPlaying(d)}${vo ? nothing : this.onBody(d)}`
        : vo
        ? this.viewOnlyBody(mode)
        : mode === 'art'
        ? this.artBody(d)
        : this.offBody(d)}
    </div>`;
  }

  private onEditorDone = (e: CustomEvent<{ detail?: MediaDeviceDetail }>) => {
    this.editing = false;
    if (e.detail?.detail) this.applyDetail(e.detail.detail);
    else void this.load(false);
  };

  // --- now showing

  private thumb(d: MediaDeviceDetail): TemplateResult {
    const n = d.live.now;
    const off = remoteMode(d) !== 'on' && d.live.power !== 'art';
    if (off) return html`<div class="thumb plain" aria-hidden="true">${ic(d.live.power === 'unavailable' ? 'wifiOff' : 'power')}</div>`;
    if (n.artwork) {
      const src = artworkUrl(n.artwork);
      return html`<div class="thumb" style="--art:${tint(n.hue).rgb}" aria-hidden="true"><img src=${src} alt="" loading="lazy" /></div>`;
    }
    if (n.kind === 'art') {
      return html`<div class="thumb" style="--art:214 160 104" aria-hidden="true"><span class="tile frameart"></span><svg viewBox="0 0 100 70" style="position:absolute;inset:10% 14%;inline-size:72%;block-size:80%"><rect x="0" y="0" width="100" height="70" fill="#f7f1e6" stroke="#b9a37e" stroke-width="3"/><circle cx="32" cy="32" r="16" fill="#e0794a" opacity=".85"/><rect x="48" y="18" width="30" height="36" fill="#27496d" opacity=".85"/><path d="M8 58 C30 44 52 60 92 46" stroke="#2f3a2f" stroke-width="2.5" fill="none"/></svg></div>`;
    }
    if (n.kind === 'saver') return html`<div class="thumb" style="--art:70 92 170" aria-hidden="true"><span class="tile saver"></span><svg class="ic gl" viewBox="0 0 24 24">${unsafeSVG(ICON.moon)}</svg></div>`;
    const t = n.kind === 'channel' || (n.kind === 'source' && n.glyph === 'antenna') ? { a1: '#0f172a', a2: '#3b4a66', rgb: '64 118 214' } : n.kind === 'home' ? { a1: '#1e1b4b', a2: '#4f46e5', rgb: '79 70 229' } : n.kind === 'source' ? { a1: '#111827', a2: '#3f4a5c', rgb: '110 124 150' } : tint(n.hue);
    const ch = n.channel && n.glyph === 'antenna' ? n.channel : '';
    return html`<div class="thumb" style="--a1:${t.a1};--a2:${t.a2};--art:${t.rgb}" aria-hidden="true"><span class="tile"></span>${ch ? html`<span class="num">${ch}</span>` : html`<svg class="ic gl" viewBox="0 0 24 24">${unsafeSVG(glyphPath(n.glyph))}</svg>`}</div>`;
  }

  private nowPlaying(d: MediaDeviceDetail): TemplateResult {
    const l = d.live;
    const n = l.now;
    let top = '';
    let line: string;
    if (n.kind === 'saver') {
      top = 'שומר מסך';
      line = d.name;
    } else if (n.kind === 'home') {
      top = 'מסך הבית';
      line = d.name;
    } else if (n.glyph === 'antenna' && n.channel) {
      top = n.label || 'טלוויזיה';
      line = `ערוץ ${n.channel}`;
    } else {
      top = n.title ? n.label : '';
      line = n.title || n.label || d.name;
    }
    const pos = positionNow(l, this.nowMs);
    const dur = n.duration_s && n.duration_s > 0 ? n.duration_s : null;
    const prog = pos !== null && dur ? html`<div class="prog"><span class="n">${mmss(pos)}</span><span class="bar" style="--p:${Math.round((pos / dur) * 100)}%"><i></i></span><span class="n">${mmss(dur)}</span></div>` : nothing;
    return html`<div class="np" data-mr-now>${this.thumb(d)}<div class="t">${top ? html`<small>${bidi(top)}</small>` : nothing}<b>${bidi(line)}</b>${prog}</div></div>`;
  }

  // --- unavailable, view-only, off, art

  private unavailableBody(d: MediaDeviceDetail): TemplateResult {
    const u = unavailableLine(d.live);
    return html`<div class="roff" data-mr-unavailable>${ic('wifiOff')}<b>${u.title}</b>${u.since ? html`<small>מאז <span class="n">${u.since}</span></small>` : nothing}</div>`;
  }

  private viewOnlyBody(mode: string): TemplateResult {
    return html`<div class="roff" data-mr-viewonly>${ic(mode === 'art' ? 'frame' : 'power')}<b>${mode === 'art' ? 'מצב אמנות' : 'כבוי'}</b></div>`;
  }

  private bigPower(action: 'on' | 'off', label: string, enabled: boolean, reason: string | null): TemplateResult {
    const pend = this.pend.has('power');
    const tip = !enabled && reason === 'no_remote_wake' ? 'אין הפעלה מרחוק' : !enabled && reason === 'unavailable' ? 'המסך לא זמין' : label;
    return html`<button type="button" class=${classMap({ bigpw: true, pend })} data-mr-power=${action} aria-label=${label} title=${tip} ?disabled=${!enabled || pend} aria-busy=${String(pend)}
      @click=${() => void this.exec({ command: action === 'on' ? 'power_on' : 'power_off' })}>${ic('power')}${pend ? html`<span class="pendring"></span>` : nothing}</button>`;
  }

  private offBody(d: MediaDeviceDetail): TemplateResult {
    const p = powerOffer(d);
    const L = layoutOf(d);
    const hasPad = L.main.length + L.more.length > 0 && d.caps.keys.length > 0;
    return html`<div class="roff" data-mr-off>
        ${p.action === 'on' ? this.bigPower('on', 'הפעל', p.enabled, p.reason) : html`${ic('power')}`}
        <b>${p.action === 'on' && p.enabled ? 'הפעל' : 'כבוי'}</b>
      </div>
      ${hasPad ? html`<div class="rpad dim" aria-hidden="true" inert>${this.padContent(d, L, true)}</div>` : nothing}`;
  }

  private artBody(d: MediaDeviceDetail): TemplateResult {
    const off = powerOffer(d);
    return html`<div class="roff" data-mr-art>
      ${this.bigPower('off', 'כבה', off.enabled, off.reason)}<b>מצב אמנות</b>
      ${artSwitchOffered(d) ? html`<button type="button" class="btn" data-mr-art-watch ?disabled=${this.pend.has('power')} @click=${() => void this.exec({ command: 'power_on' })}>${ic('tv')}מעבר לצפייה</button>` : nothing}
    </div>`;
  }

  // --- on

  private onBody(d: MediaDeviceDetail): TemplateResult {
    const L = layoutOf(d);
    const tabs = remoteTabs(d);
    const tab = tabs.includes(this.tab) ? this.tab : 'pad';
    return html`${this.audioSwitch(d, L.main)}${this.volumeRow(d, L.main)}${L.main.includes('recent') ? this.recent(d) : nothing}
      ${tabs.length > 1
        ? html`<div class="seg" role="tablist" aria-label="שלט">${tabs.map((t) => html`<button type="button" role="tab" aria-selected=${String(tab === t)} data-mr-tab=${t} @click=${() => (this.tab = t)}>${t === 'pad' ? 'שלט' : t === 'sources' ? 'מקורות' : 'אפליקציות'}</button>`)}</div>`
        : nothing}
      ${tab === 'sources' ? this.sources(d) : tab === 'apps' ? this.apps(d) : html`<div class=${classMap({ rpad: true, shake: this.shaking })} data-mr-pad>${this.padContent(d, L, false)}</div>`}`;
  }

  private audioSwitch(d: MediaDeviceDetail, main: RemoteSection[]): TemplateResult | typeof nothing {
    if (!d.audio_link || !d.can.control || !main.includes('vol')) return nothing;
    const cur = volumeTarget(d, this.audio);
    return html`<div class="seg sm" role="radiogroup" aria-label="יציאת שמע" data-mr-audio>
      <button type="button" role="radio" aria-checked=${String(cur === 'screen')} @click=${() => (this.audio = 'screen')}>${ic('tv')}רמקולי המסך</button>
      <button type="button" role="radio" aria-checked=${String(cur === 'linked')} @click=${() => (this.audio = 'linked')}>${ic('speaker')}${bidi(d.audio_link.name)}</button>
    </div>`;
  }

  private volumeRow(d: MediaDeviceDetail, main: RemoteSection[]): TemplateResult | typeof nothing {
    if (!main.includes('vol') || !d.can.control || !d.caps.volume_set) return nothing;
    const target = d.audio_link ? volumeTarget(d, this.audio) : d.live.volume.target;
    const level = target !== d.live.volume.target ? null : d.live.volume.level;
    const v = this.volDraft ?? level ?? 0;
    const muted = d.live.volume.muted === true;
    return html`<div class="vrow" data-mr-vrow>
      ${d.caps.mute ? html`<button type="button" class=${classMap({ rb: true, on: muted })} data-key="mute" aria-pressed=${String(muted)} aria-label=${muted ? 'בטל השתקה' : 'השתק'}>${ic(muted ? 'volOff' : 'vol')}</button>` : nothing}
      <input class="rng" type="range" min="0" max="100" step="1" .value=${String(v)} style="--v:${v}%" aria-label=${d.audio_link ? `עוצמה · ${d.audio_link.name}` : 'עוצמה'} @input=${this.onVolume} />
      <span class="vv n" data-mr-volval>${this.volDraft !== null || level !== null ? v : '–'}</span>
    </div>`;
  }

  private glyph(item: { glyph: string; hue?: number | null }, src = false): TemplateResult {
    if (src) return html`<span class="gi src">${ic(item.glyph)}</span>`;
    const t = tint(item.hue ?? null);
    return html`<span class="gi" style="--a1:${t.a1};--a2:${t.a2};--art:${t.rgb}">${ic(item.glyph)}</span>`;
  }

  private recent(d: MediaDeviceDetail): TemplateResult | typeof nothing {
    const chips = recentChips(d);
    if (!chips.length) return nothing;
    const all = [...d.sources, ...d.apps];
    return html`<div class="recent" role="group" aria-label="אחרונים" data-mr-recent><span class="lbl">אחרונים</span>${chips.map((c) => {
      const item = all.find((x) => x.id === c.id && x.kind === (c.kind === 'app' ? 'app' : 'source'));
      const current = c.kind === 'app' ? d.live.now.app_id === c.id : d.live.now.source_id === c.id;
      const src = c.kind === 'source';
      return html`<button type="button" class="rchip" aria-current=${String(current)} data-mr-recent-item=${c.id} @click=${() => void this.exec(c.kind === 'app' ? { command: 'app', app_id: c.id } : { command: 'source', source_id: c.id })}>${this.glyph({ glyph: c.glyph, hue: item?.hue ?? null }, src)}<bdi>${c.label}</bdi></button>`;
    })}</div>`;
  }

  private sources(d: MediaDeviceDetail): TemplateResult {
    if (!d.sources.length) return html`<div class="empty">${ic('input')}אין מקורות</div>`;
    return html`<div class="srcg" role="radiogroup" aria-label="מקורות" data-mr-sources>${repeat(d.sources, (s) => s.id, (s) => this.sourceTile(d, s))}</div>`;
  }

  private sourceTile(d: MediaDeviceDetail, s: SourceItem): TemplateResult {
    const cur = isCurrent(d.live, s);
    const pend = this.pend.has(`src:${s.id}`);
    const ch = cur && d.live.now.channel && s.glyph === 'antenna' ? `ערוץ ${d.live.now.channel}` : '';
    return html`<button type="button" class="srci" role="radio" aria-checked=${String(cur)} data-mr-source=${s.id} ?disabled=${pend} @click=${() => void this.exec({ command: 'source', source_id: s.id })}>
      <span class="gi src">${ic(s.glyph)}</span><span><bdi>${s.label}</bdi>${ch ? html`<small>${ch}</small>` : nothing}</span>${cur && !pend ? html`<span class="ck">${ic('check')}</span>` : nothing}${pend ? html`<span class="pendring"></span>` : nothing}</button>`;
  }

  private apps(d: MediaDeviceDetail): TemplateResult {
    if (!d.apps.length) return html`<div class="empty">${ic('apps')}אין אפליקציות</div>`;
    return html`<div class="appg" data-mr-apps>${repeat(d.apps, (a) => a.id, (a) => {
      const cur = isCurrent(d.live, a);
      const pend = this.pend.has(`app:${a.id}`);
      const t = tint(a.hue);
      return html`<button type="button" class="appt" data-mr-app=${a.id} aria-current=${String(cur)} ?disabled=${pend} @click=${() => void this.exec({ command: 'app', app_id: a.id })}>
        <span class="gi" style="--a1:${t.a1};--a2:${t.a2};--art:${t.rgb}">${ic(a.glyph)}${pend ? html`<span class="pendring" style="inset:-5px;border-radius:22px"></span>` : nothing}</span><span><bdi>${a.label}</bdi></span></button>`;
    })}</div>`;
  }

  // --- the pad

  private kb(d: MediaDeviceDetail, key: KeyId, opts: { label?: string; glyph?: string; cls?: string } = {}): TemplateResult | typeof nothing {
    if (!d.caps.keys.includes(key)) return nothing;
    const label = opts.label ?? KEY_LABEL[key];
    return html`<button type="button" class="kb ${opts.cls ?? ''}" data-key=${key} aria-label=${KEY_LABEL[key]}><span class="kc">${ic(opts.glyph ?? KEY_GLYPH[key] ?? 'app')}</span><span>${label}</span></button>`;
  }

  private topCluster(d: MediaDeviceDetail, dim: boolean): TemplateResult {
    const tabs = remoteTabs(d);
    const powerOn = d.can.power && d.caps.power_off && !dim;
    const pend = this.pend.has('power');
    const cfgOn = (id: RemoteSection) => d.remote.sections.some((s) => s.id === id && s.on);
    const guide = cfgOn('xtra') ? this.kb(d, 'guide') : nothing;
    const off = dim && d.can.power;
    return html`<div class="tcl">
      ${powerOn
        ? html`<button type="button" class=${classMap({ kb: true, pwk: true, pend })} data-mr-power="off" aria-label="כבה" ?disabled=${pend} @click=${() => void this.exec({ command: 'power_off' })}><span class="kc">${ic('power')}${pend ? html`<span class="pendring"></span>` : nothing}</span><span>כבה</span></button>`
        : off
        ? html`<button type="button" class="kb pwk off" aria-label="הפעל" disabled><span class="kc">${ic('power')}</span><span>הפעל</span></button>`
        : nothing}
      <span class="grow"></span>${guide}
      ${tabs.includes('sources') ? html`<button type="button" class="kb" data-mr-goto="sources" aria-label="מקורות" @click=${() => (this.tab = 'sources')}><span class="kc">${ic('input')}</span><span>מקור</span></button>` : nothing}
      ${tabs.includes('apps') ? html`<button type="button" class="kb" data-mr-goto="apps" aria-label="אפליקציות" @click=${() => (this.tab = 'apps')}><span class="kc">${ic('apps')}</span><span>אפליקציות</span></button>` : nothing}
    </div>`;
  }

  private rocker(d: MediaDeviceDetail, kind: 'vol' | 'ch'): TemplateResult {
    const vol = kind === 'vol';
    const up: KeyId = vol ? 'volup' : 'chup';
    const dn: KeyId = vol ? 'voldown' : 'chdown';
    const upOk = vol ? commandOffered(d, { command: 'volume_step', direction: 'up' }) : d.caps.keys.includes(up);
    const dnOk = vol ? commandOffered(d, { command: 'volume_step', direction: 'down' }) : d.caps.keys.includes(dn);
    const value = vol
      ? (d.audio_link && volumeTarget(d, this.audio) !== d.live.volume.target ? '–' : d.live.volume.level ?? '–')
      : d.live.now.channel ?? '–';
    const muted = d.live.volume.muted === true;
    return html`<div class="col" data-mr-rocker=${kind}>
      <div class="rock" role="group" aria-label=${vol ? 'עוצמה' : 'ערוצים'}>
        <button type="button" data-key=${up} aria-label=${KEY_LABEL[up]} ?disabled=${!upOk}>${ic(vol ? 'plus' : 'up')}</button>
        <span class="rv"><small>${vol ? 'עוצמה' : 'ערוץ'}</small><b class="n" data-mr-value=${kind}>${value}</b></span>
        <button type="button" data-key=${dn} aria-label=${KEY_LABEL[dn]} ?disabled=${!dnOk}>${ic(vol ? 'minus' : 'down')}</button>
      </div>
      ${vol && d.caps.mute ? html`<button type="button" class=${classMap({ rb: true, on: muted })} data-key="mute" aria-pressed=${String(muted)} aria-label=${muted ? 'בטל השתקה' : 'השתק'}>${ic(muted ? 'volOff' : 'vol')}</button>` : nothing}
      ${!vol && d.caps.keys.includes('chlist') ? html`<button type="button" class="rb" data-key="chlist" aria-label=${KEY_LABEL.chlist}>${ic('list')}</button>` : nothing}
    </div>`;
  }

  private padContent(d: MediaDeviceDetail, L: { main: RemoteSection[]; more: RemoteSection[] }, dim: boolean): TemplateResult {
    const parts: TemplateResult[] = [];
    const modes = padModes(d);
    parts.push(this.topCluster(d, dim));
    let grid = false;
    for (const id of L.main) {
      if (id === 'vol' || id === 'ch' || id === 'dpad' || id === 'touch') {
        if (grid) continue;
        grid = true;
        parts.push(this.grid(d, L.main, modes));
      } else if (id !== 'recent') {
        const p = this.section(d, id);
        if (p) parts.push(p);
      }
    }
    if (L.more.length) {
      parts.push(html`<button type="button" class="morebtn" data-mr-more aria-expanded=${String(this.more)} @click=${() => (this.more = !this.more)}>${this.more ? 'פחות מקשים' : 'עוד מקשים'}${ic('chevronDown')}</button>`);
      if (this.more) parts.push(html`<div class="more" data-mr-morebody>${L.more.map((id) => (id === 'vol' || id === 'ch' || id === 'dpad' || id === 'touch' ? this.grid(d, [id], modes, true) : this.section(d, id)))}</div>`);
    }
    return html`${parts}`;
  }

  /** volume rocker | d-pad or touchpad | channel rocker - one row, geometry never mirrored. */
  private grid(d: MediaDeviceDetail, main: RemoteSection[], modes: { dpad: boolean; touch: boolean }, only = false): TemplateResult {
    const hasVol = main.includes('vol') && (d.caps.volume_step || d.caps.keys.includes('volup') || d.caps.keys.includes('voldown'));
    const hasCh = main.includes('ch') && d.caps.keys.some((k) => k === 'chup' || k === 'chdown');
    const center = main.includes('dpad') || main.includes('touch') ? (main.includes('touch') && !main.includes('dpad') ? 'touch' : this.pad) : null;
    const showMode = !only && modes.dpad && modes.touch;
    const mode = center === 'touch' && modes.touch ? 'touch' : 'dpad';
    if (!center && !hasVol && !hasCh) return html``; // nothing to draw (a slider-only volume has no rocker)
    const cls = center ? 'pgrid' : hasVol && hasCh ? 'pgrid duo' : 'pgrid solo';
    return html`${showMode
        ? html`<div class="seg sm" role="radiogroup" aria-label="סוג משטח" style="inline-size:auto"><button type="button" role="radio" aria-checked=${String(this.pad === 'dpad')} @click=${() => (this.pad = 'dpad')}>חצים</button><button type="button" role="radio" aria-checked=${String(this.pad === 'touch')} @click=${() => (this.pad = 'touch')}>${ic('touch')}משטח</button></div>`
        : nothing}
      <div class=${cls}>
        ${center ? (hasVol ? this.rocker(d, 'vol') : html`<div class="col"></div>`) : hasVol ? this.rocker(d, 'vol') : nothing}
        ${center ? html`<media-remote-pad .keys=${d.caps.keys} .mode=${mode} @mr-key=${this.onPadKey}></media-remote-pad>` : nothing}
        ${center ? (hasCh ? this.rocker(d, 'ch') : html`<div class="col"></div>`) : hasCh ? this.rocker(d, 'ch') : nothing}
      </div>`;
  }

  private section(d: MediaDeviceDetail, id: RemoteSection): TemplateResult | null {
    switch (id) {
      case 'nav': {
        const keys = (['back', 'home', 'menu'] as KeyId[]).filter((k) => d.caps.keys.includes(k));
        return keys.length ? html`<div class="navk" data-mr-nav>${keys.map((k) => this.kb(d, k))}</div>` : null;
      }
      case 'pbk': {
        const t = d.caps.transport;
        const l = d.live;
        if (l.play === null && l.now.kind !== 'app') return null;
        const playing = l.play === 'playing';
        const tk = (action: TransportAction, glyph: string, label: string, cls = '') => html`<button type="button" class="kb ${cls}" aria-label=${label} data-mr-transport=${action} @click=${() => this.transport(action)}><span class="kc">${ic(glyph)}</span></button>`;
        return html`<div class="pbk" role="group" aria-label="ניגון" data-mr-pbk>
          ${t.previous ? tk('previous', 'prev', 'הקודם') : nothing}${d.caps.keys.includes('rew') ? this.kb(d, 'rew', { label: '', glyph: 'rew' }) : nothing}
          ${tk('play_pause', playing ? 'pause' : 'play', playing ? 'השהה' : 'נגן', 'main')}
          ${d.caps.keys.includes('ff') ? this.kb(d, 'ff', { label: '', glyph: 'ff' }) : nothing}${t.next ? tk('next', 'next', 'הבא') : nothing}</div>`;
      }
      case 'nums': {
        if (!NUM_KEYS.some((k) => d.caps.keys.includes(k))) return null;
        return html`<div data-mr-nums><h4>מספרים</h4><div class="chentry" aria-live="polite">${this.chbuf ? html`ערוץ <b>${this.chbuf}</b>` : nothing}</div>
          <div class="npad">${NUM_KEYS.map((k) => (d.caps.keys.includes(k) ? html`<button type="button" data-key=${k} aria-label=${KEY_LABEL[k]}>${digitOf(k) || ic(k === 'prech' ? 'history' : 'info')}</button>` : html`<span></span>`))}</div></div>`;
      }
      case 'colors': {
        const keys = COLOR_KEYS.filter((k) => d.caps.keys.includes(k));
        return keys.length ? html`<div data-mr-colors><h4>מקשי צבע</h4><div class="ckeys">${keys.map((k) => html`<button type="button" class=${k} data-key=${k} aria-label=${KEY_LABEL[k]}></button>`)}</div></div>` : null;
      }
      case 'text': {
        if (!d.caps.text) return null;
        return html`<div data-mr-text><h4>הקלדה במסך</h4><div class="kbd"><label class="fld">${ic('keyboard')}<span style="position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip:rect(0 0 0 0)">טקסט לשליחה</span>
          <input type="text" maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="הקלדה" .value=${this.typed} @input=${this.onText} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.sendText(); } }} /></label>
          <button type="button" class="btn primary" data-mr-send ?disabled=${!this.typed.trim()} @click=${() => this.sendText()}>${ic('send')}שלח</button></div></div>`;
      }
      case 'xtra': {
        const nums = this.detail ? this.detail.remote.sections.some((s) => s.id === 'nums' && s.on) : false;
        const keys = XTRA_KEYS.filter((k) => d.caps.keys.includes(k) && !XTRA_SPOKEN_ELSEWHERE.includes(k) && !(nums && (k === 'prech' || k === 'info')));
        return keys.length ? html`<div data-mr-xtra><h4>מקשים נוספים</h4><div class="xkeys">${keys.map((k) => html`<button type="button" class="btn quiet" data-key=${k}>${ic(KEY_GLYPH[k] ?? 'app')}${KEY_LABEL[k]}</button>`)}</div></div>` : null;
      }
      default:
        return null;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-remote': MediaRemote;
  }
}
