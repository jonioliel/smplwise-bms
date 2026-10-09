import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { KeyThrottle, artworkUrl, isLit, type Size } from '../api/media-screens';
import { effectiveCeiling, groupChip, isMember, playerCommandOffered, players, powerControlled, unmuteCeiling, type PlayerCommand, type PlayerDevice, type PlayerDeviceDetail } from '../api/media-players';
import { applyMediaGlass, mediaGlassStyles } from '../styles/media-glass';
import { glyphIcon, mIcon, nameText } from './media-icons';
import { runPlayerCommand } from './media-player-run';
import { leaderName, playerView, type PlayerView } from './media-player-now';
import type { CommandOutcome } from './media-command';
import { SkinController } from '../design/skin';
import './sw-pill';

/**
 * CR-016: ONE card per physical speaker, player or receiver (MEDIA_PLAYERS_API.md §2, mockup `players-index.html` "PLAYER CARD"):
 * a square cover (the proxied art with its glow, or our own hue and a neutral glyph; a neutral tile for a receiver), the name,
 * the state line ("סלון · מנגן", "מנגן עם סלון", "כבוי", "לא זמין מאז 11:20"), the group chip, the title of the playing item, the
 * main key (play / pause; power for a receiver and for a player that is off), volume, mute, the receiver's source menu and "נגן"
 * (opens the player panel). It shows only what `caps` and `can` allow (never guessed from a degraded mask: `caps_known` false greys
 * everything and the card says "לא זמין"), the server refuses the same. Every press is one command with an honest outcome
 * (media-player-run.ts): a spinner until the player confirms, and after 8 s "הנגן לא אישר את הפקודה" with the last confirmed
 * state; a press over the rate limit is dropped with a short shake. A command to a member plays on its leader (the server
 * resolves).
 *
 *   <media-player-card .device=${d} .size=${'m'} ?compact=${phone} .leader=${leaderDevice} @open-player=${(e) => e.detail.key}></media-player-card>
 *
 * `open-player` ({ key }) asks the owner of the page to open the player panel; `media-changed` ({ key, outcome }) after a command
 * so the owner can re-read the device. The page puts its edit chips into the `edit` slot (and sets `editing`: every control is
 * inert then). Used by the players page and, by tag, the area card.
 */
@customElement('media-player-card')
export class MediaPlayerCard extends LitElement {
  @property({ attribute: false }) device!: PlayerDevice;
  @property({ reflect: true, attribute: 'data-size' }) size: Size = 'm';
  /** The phone's compact card. */
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: Boolean, reflect: true }) editing = false;
  @property({ type: Boolean, reflect: true, attribute: 'data-dimmed' }) dimmed = false;
  /** The leader of a member, for "מנגן עם סלון" (optional: the group's own name stands in). */
  @property({ attribute: false }) leader: PlayerDevice | null = null;
  @state() private pending = new Set<string>();
  @state() private nack = '';
  @state() private note = '';
  @state() private shaking = '';
  @state() private menu = false;
  @state() private detail: PlayerDeviceDetail | null = null;
  @state() private detailBusy = false;
  /** Bubble skin: the row is morphed into its volume slider. */
  @state() private volOpen = false;
  private skin = new SkinController(this);
  private throttle = new KeyThrottle();
  private timers: number[] = [];
  private ticker = 0;
  private detailKey = '';

  static styles = [mediaGlassStyles, css`
    :host {
      display: block;
      position: relative;
      min-inline-size: 0;
      color: var(--dv-text);
      font-family: var(--dv-font);
    }
    :host([data-menu]) {
      z-index: 20;
    }
    .pcard {
      position: relative;
      display: grid;
      grid-template-columns: var(--mm-cover-size) minmax(0, 1fr) auto;
      grid-template-areas: 'cov tx main' 'ctl ctl ctl';
      gap: 12px 14px;
      align-items: center;
      padding: 10px 14px 12px 10px;
      padding-inline: 10px 14px;
      min-inline-size: 0;
      transition: box-shadow var(--mm-motion) var(--mm-ease), transform var(--mm-motion) var(--mm-ease), border-color var(--mm-motion);
    }
    .gbox {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      overflow: hidden;
      z-index: 0;
      pointer-events: none;
    }
    .gbox .art {
      inset: -35%;
      filter: blur(var(--mm-art-glow-blur)) saturate(1.5);
      opacity: var(--mm-art-glow-alpha);
      -webkit-mask-image: linear-gradient(180deg, #000 22%, transparent 88%);
      mask-image: linear-gradient(180deg, #000 22%, transparent 88%);
    }
    .gbox::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--mm-art-veil);
    }
    .pcard > :not(.gbox):not(.pop):not(.edit-slot) {
      position: relative;
      z-index: 1;
    }
    .pcard.lit {
      border-color: rgb(var(--art) / 0.34);
      box-shadow: 0 22px 56px rgb(var(--art) / var(--mm-art-halo-alpha)), var(--dv-shadow-1);
    }
    .pcard.paused .gbox {
      opacity: 0.55;
    }
    @media (hover: hover) and (prefers-reduced-motion: no-preference) {
      :host(:not([editing])) .pcard:not(.un):hover {
        transform: translateY(var(--dv-hover-lift));
        box-shadow: var(--dv-shadow-2);
      }
      :host(:not([editing])) .pcard.lit:hover {
        box-shadow: 0 26px 60px rgb(var(--art) / calc(var(--mm-art-halo-alpha) + 0.08)), var(--dv-shadow-2);
      }
    }
    .pcard.un {
      background: var(--dv-surface-2);
      box-shadow: none;
      border-style: dashed;
      border-color: var(--dv-border-strong);
    }
    .edit-slot {
      position: absolute;
      inset: 0;
      z-index: 6;
      pointer-events: none;
    }
    .edit-slot ::slotted(*) {
      pointer-events: auto;
    }
    :host([data-dimmed]) .pcard {
      opacity: 0.45;
    }
    :host([editing]) .pcard {
      outline: 2px dashed color-mix(in srgb, var(--dv-accent) 55%, transparent);
      outline-offset: 4px;
    }
    /* the cover */
    .cov {
      grid-area: cov;
      position: relative;
      display: block;
      inline-size: var(--mm-cover-size);
      block-size: var(--mm-cover-size);
      border-radius: var(--mm-cover-radius);
      overflow: hidden;
      border: 0;
      padding: 0;
      background: var(--mm-screen-off);
      color: var(--sw-on-video);
      cursor: pointer;
      isolation: isolate;
      box-shadow: var(--mm-cover-shadow);
      transition: transform 140ms var(--mm-ease);
    }
    .cov:active {
      transform: scale(0.97);
    }
    .cov::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 5;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
      background: linear-gradient(118deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0) 40%);
      pointer-events: none;
    }
    .cov .ctr {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-3xl);
      z-index: 2;
    }
    .cov .ctr .ic {
      stroke-width: 1.5;
    }
    .cov.off,
    .cov.un,
    .cov.idle {
      box-shadow: none;
    }
    .cov.un {
      background: repeating-linear-gradient(135deg, var(--dv-surface-3) 0 10px, transparent 10px 20px), var(--dv-surface-2);
    }
    .cov .pilld {
      position: absolute;
      inset-block-start: 7px;
      inset-inline-start: 7px;
      z-index: 3;
      block-size: 22px;
      padding-inline: 8px;
      font-size: var(--sw-fs-xs);
    }
    .cov .pb {
      position: absolute;
      inset-inline: 8px;
      inset-block-end: 6px;
      block-size: 3px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.25);
      z-index: 3;
      overflow: hidden;
    }
    .cov .pb i {
      display: block;
      block-size: 100%;
      inline-size: var(--p, 0%);
      background: #fff;
      border-radius: 3px;
    }
    .cov .live {
      position: absolute;
      inset-block-end: 7px;
      inset-inline-start: 8px;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: var(--sw-fs-2xs);
      font-weight: 700;
      color: var(--sw-on-video);
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    }
    .cov .live i {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: var(--sw-danger);
      box-shadow: 0 0 6px var(--sw-danger);
      animation: blink 1.6s ease-in-out infinite;
    }
    @keyframes blink {
      50% {
        opacity: 0.35;
      }
    }
    .cov .pend {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(0, 0, 0, 0.32);
      z-index: 4;
      -webkit-backdrop-filter: var(--sw-perf-blur, blur(3px));
      backdrop-filter: var(--sw-perf-blur, blur(3px));
    }
    .cov .pend i {
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      animation: mm-spin 0.8s linear infinite;
    }
    .cov.rcv {
      background: var(--mm-key-bg);
      color: var(--dv-text);
      box-shadow: var(--mm-key-shadow);
    }
    .cov.rcv .ctr {
      color: var(--dv-text);
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      padding: 8px;
      text-align: center;
      line-height: 1.2;
    }
    .cov.rcv .ctr .ic {
      font-size: var(--sw-fs-3xl);
      color: var(--dv-text-2);
    }
    .cov.rcv .ctr span {
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* name, state, title */
    .tx {
      grid-area: tx;
      align-self: center;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
      line-height: 1.3;
    }
    .tx b {
      font-size: var(--sw-fs-lg);
      font-weight: 600;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tx .st {
      display: flex;
      align-items: center;
      gap: 6px 8px;
      min-inline-size: 0;
      flex-wrap: wrap;
    }
    .tx small {
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 0 1 auto;
    }
    .tx small.now {
      color: var(--dv-text);
      font-weight: 500;
      unicode-bidi: plaintext;
      text-align: start;
    }
    .tx small.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
    .gchip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      block-size: 24px;
      padding-inline: 7px 9px;
      border-radius: 999px;
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      white-space: nowrap;
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gchip .ic {
      font-size: var(--sw-fs-base);
    }
    .gchip.warn {
      background: var(--dv-warning-soft);
      color: var(--dv-warning-text);
    }
    .main {
      grid-area: main;
      align-self: center;
    }
    /* play / pause: the dark key of the remote's playback row */
    .pk {
      position: relative;
      flex: none;
      inline-size: 50px;
      block-size: 50px;
      border-radius: 50%;
      border: 0;
      display: grid;
      place-items: center;
      background: var(--dv-text);
      color: var(--mm-text-inverse);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
      transition: transform 120ms var(--mm-ease), background var(--mm-motion), box-shadow var(--mm-motion);
    }
    .pk .ic {
      font-size: var(--sw-fs-3xl);
      stroke-width: 2;
    }
    .pk:active {
      transform: scale(0.92);
    }
    .pk.idle {
      background: var(--mm-key-bg);
      color: var(--dv-text);
      box-shadow: var(--mm-key-shadow);
    }
    .pk[disabled] {
      opacity: 0.38;
      pointer-events: none;
      box-shadow: none;
    }
    .pk.pend::after {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 50%;
      border: 2px solid transparent;
      border-top-color: var(--dv-accent);
      animation: mm-spin 0.8s linear infinite;
    }
    .pk.nack {
      box-shadow: 0 0 0 3px var(--dv-danger-soft), 0 0 0 1.5px var(--dv-danger);
    }
    .sctl {
      grid-area: ctl;
      display: flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
      flex-wrap: wrap;
    }
    .unl {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .unl .ic {
      color: var(--dv-danger);
    }
    .pop {
      inset-block-start: calc(100% - 10px);
      inset-inline-start: 10px;
    }
    .pop .wait {
      padding: 14px;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-base);
    }
    :host([compact]) .pcard,
    :host([data-size='s']) .pcard {
      gap: 10px 12px;
      padding: 8px 10px 10px 8px;
      padding-inline: 8px 10px;
    }
    :host([compact]) .tx b,
    :host([data-size='s']) .tx b {
      font-size: var(--sw-fs-lg);
    }
    :host([compact]) .pk,
    :host([data-size='s']) .pk {
      inline-size: 46px;
      block-size: 46px;
    }
    :host([compact]) .pop,
    :host([data-size='s']) .pop {
      inset-inline-start: 8px;
    }
    /* ---- the Bubble skin (phase C): the card is a pill row - a round cover ring, the name and the state, the play key and
       the volume button at the end; the volume button MORPHS the row into a slider (mute · slider · % · close · play), as in
       the Bubble Card video. No blur, no shadow: a scrolling list stays cheap on a phone. ---- */
    :host([data-skin='bubble']) .pcard {
      --mm-cover-size: calc(var(--sw-icon-ring) * var(--sw-look-scale));
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: 'cov tx main';
      gap: 6px 10px;
      padding: 6px 8px;
      min-block-size: calc(var(--sw-pill-h) * var(--sw-look-scale));
      border-radius: var(--sw-r-pill);
      border: 0;
      background: var(--sw-surface);
      box-shadow: none;
      transition: background var(--sw-t-state) var(--sw-ease);
    }
    :host([data-skin='bubble']) .pcard.lit {
      background: var(--sw-lit);
      color: var(--sw-on-lit);
      box-shadow: none;
    }
    :host([data-skin='bubble']) .pcard.lit .tx small,
    :host([data-skin='bubble']) .pcard.lit .tx small.now {
      color: inherit;
      opacity: 0.86;
    }
    :host([data-skin='bubble']) .pcard.paused {
      background: var(--sw-lit-soft);
      color: var(--sw-text);
    }
    :host([data-skin='bubble']) .pcard.paused .gbox,
    :host([data-skin='bubble']) .pcard .gbox {
      display: none;
    }
    :host([data-skin='bubble']) .pcard.un {
      background: var(--sw-surface);
      opacity: 0.6;
      border: 0;
    }
    :host([data-skin='bubble']) .cov {
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
      border-radius: 50%;
      box-shadow: none;
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    :host([data-skin='bubble']) .cov::after {
      display: none;
    }
    :host([data-skin='bubble']) .cov .pilld,
    :host([data-skin='bubble']) .cov .pb,
    :host([data-skin='bubble']) .cov .live {
      display: none;
    }
    :host([data-skin='bubble']) .cov .ctr {
      font-size: var(--sw-fs-2xl);
      color: inherit;
    }
    :host([data-skin='bubble']) .cov.rcv .ctr span {
      display: none;
    }
    :host([data-skin='bubble']) .cov.rcv .ctr .ic {
      font-size: var(--sw-fs-2xl);
      color: inherit;
    }
    :host([data-skin='bubble']) .tx b {
      font-size: calc(var(--sw-fs-name) * var(--sw-look-scale));
      font-weight: var(--sw-fw-semibold);
    }
    :host([data-skin='bubble']) .tx small {
      font-size: calc(var(--sw-fs-state) * var(--sw-look-scale));
    }
    :host([data-skin='bubble']) .tx .st {
      flex-wrap: nowrap;
    }
    :host([data-skin='bubble']) .gchip {
      block-size: 22px;
      padding-inline: 8px;
      background: rgba(0, 0, 0, 0.12);
      color: inherit;
    }
    /* the end of the row: play / power, the volume button (morph), mute, source and "נגן" as round sub-buttons */
    :host([data-skin='bubble']) .main {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    :host([data-skin='bubble']) .pk,
    :host([data-skin='bubble']) .pw,
    :host([data-skin='bubble']) .rb,
    :host([data-skin='bubble']) .vb {
      inline-size: calc(var(--sw-sub) * var(--sw-look-scale));
      block-size: calc(var(--sw-sub) * var(--sw-look-scale));
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
      box-shadow: none;
      border: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      padding: 0;
    }
    :host([data-skin='bubble']) .pk {
      background: var(--sw-text);
      color: var(--sw-bg);
    }
    :host([data-skin='bubble']) .pk .ic {
      font-size: var(--sw-fs-2xl);
    }
    :host([data-skin='bubble']) .pcard.lit .pk {
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
    }
    :host([data-skin='bubble']) .pk.idle,
    :host([data-skin='bubble']) .pw,
    :host([data-skin='bubble']) .rb,
    :host([data-skin='bubble']) .vb {
      background: rgba(0, 0, 0, 0.1);
      color: inherit;
    }
    :host([data-skin='bubble']) .pw.on {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: none;
    }
    :host([data-skin='bubble']) .rb.muted {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      box-shadow: none;
    }
    :host([data-skin='bubble']) .vb[aria-expanded='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    :host([data-skin='bubble']) .sctl {
      display: none;
    }
    :host([data-skin='bubble']) .main .rbtn {
      min-block-size: var(--sw-touch-desktop);
      border: 0;
      border-radius: var(--sw-r-pill);
      background: rgba(0, 0, 0, 0.1);
      color: inherit;
      box-shadow: none;
      padding-inline: 12px;
    }
    /* the morph: the whole row becomes mute · the slider pill · close · the main key */
    :host([data-skin='bubble']) .vmorph {
      grid-column: 1 / -1;
      grid-row: 1;
      min-inline-size: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    :host([data-skin='bubble']) .vmorph sw-pill {
      flex: 1 1 120px;
      min-inline-size: 0;
      --pill-base: rgba(0, 0, 0, 0.1);
      --sw-pill-h: 44px;
    }
    :host([data-skin='bubble']) .pcard.morph .cov {
      display: none;
    }
    :host([data-skin='bubble']) .pop {
      border: 0;
      border-radius: var(--sw-r-lg);
      background: rgba(var(--sw-sheet-rgb), var(--sw-sheet-alpha));
      -webkit-backdrop-filter: var(--sw-glass-blur-sheet);
      backdrop-filter: var(--sw-glass-blur-sheet);
      box-shadow: var(--sw-shadow-3);
    }
    @media (max-width: 1100px) {
      :host([data-skin='bubble']) .pk,
      :host([data-skin='bubble']) .pw,
      :host([data-skin='bubble']) .rb,
      :host([data-skin='bubble']) .vb {
        min-inline-size: 44px;
        min-block-size: 44px;
      }
      :host([data-skin='bubble']) .cov {
        min-inline-size: 44px;
        min-block-size: 44px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host([data-skin='bubble']) .pcard {
        transition: none;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void applyMediaGlass(this);
    window.addEventListener('pointerdown', this.onOutside, true);
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('pointerdown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey);
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
    window.clearInterval(this.ticker);
    this.ticker = 0;
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('device') && this.device) {
      if (this.detailKey !== this.device.key) {
        this.detail = null;
        this.detailKey = this.device.key;
      }
      if (this.menu && !isLit(this.device.live)) this.menu = false;
    }
    this.toggleAttribute('data-menu', this.menu);
  }

  protected updated() {
    const d = this.device;
    const moving = !!d && d.live.play === 'playing' && d.live.power === 'on' && !!d.live.now.duration_s && d.live.now.kind !== 'station';
    if (moving && !this.ticker) this.ticker = window.setInterval(() => this.requestUpdate(), 1000);
    else if (!moving && this.ticker) {
      window.clearInterval(this.ticker);
      this.ticker = 0;
    }
  }

  private onOutside = (e: Event) => {
    if (this.menu && !e.composedPath().includes(this)) this.menu = false;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.menu) this.menu = false;
  };

  private later(fn: () => void, ms: number) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private setPending(k: string, on: boolean) {
    const next = new Set(this.pending);
    if (on) next.add(k);
    else next.delete(k);
    this.pending = next;
  }

  private settle(kind: string, o: CommandOutcome) {
    this.setPending(kind, false);
    if (o.outcome === 'rate_limited') this.shake(kind);
    else if (o.outcome === 'not_confirmed' || o.outcome === 'refused') {
      this.nack = kind;
      this.note = o.message;
      this.later(() => {
        this.nack = '';
        this.note = '';
      }, 6000);
    }
    this.dispatchEvent(new CustomEvent('media-changed', { detail: { key: this.device.key, outcome: o.outcome }, bubbles: true, composed: true }));
  }

  private shake(kind: string) {
    this.shaking = kind;
    this.later(() => (this.shaking = ''), 300);
  }

  private async send(kind: string, cmd: PlayerCommand) {
    if (!playerCommandOffered(this.device, cmd) || this.pending.has(kind)) return;
    if (kind !== 'power' && kind !== 'source' && !this.throttle.take()) return this.shake(kind);
    this.nack = '';
    this.note = '';
    this.setPending(kind, true);
    this.settle(kind, await runPlayerCommand(this.device.key, cmd));
  }

  private power() {
    void this.send('power', { command: isLit(this.device.live) ? 'power_off' : 'power_on' });
  }

  private toggle() {
    void this.send('pb', { command: 'transport', action: 'play_pause' });
  }

  private volume(dir: 1 | -1) {
    const d = this.device;
    const level = Math.max(0, Math.min(100, (d.live.volume.level ?? 0) + dir * 2));
    void this.send('volume', d.caps.volume_set ? { command: 'volume_set', level } : { command: 'volume_step', direction: dir > 0 ? 'up' : 'down' });
  }

  /** The morphed slider's release (bubble skin): one volume_set, capped by the ceiling the night window sets. */
  private setVolume(level: number) {
    const d = this.device;
    const ceiling = effectiveCeiling(d);
    const v = Math.max(0, Math.min(ceiling ?? 100, Math.round(level)));
    void this.send('volume', { command: 'volume_set', level: v });
  }

  private async mute() {
    const d = this.device;
    const ceiling = d.live.volume.muted ? unmuteCeiling(d) : null; // an unmute above a ceiling set later is refused: lower the level first
    if (ceiling !== null && playerCommandOffered(d, { command: 'volume_set', level: ceiling })) await runPlayerCommand(d.key, { command: 'volume_set', level: ceiling });
    void this.send('mute', { command: 'mute', muted: !d.live.volume.muted });
  }

  private openPlayer() {
    this.menu = false;
    this.dispatchEvent(new CustomEvent('open-player', { detail: { key: this.device.key }, bubbles: true, composed: true }));
  }

  private async toggleMenu() {
    this.menu = !this.menu;
    if (!this.menu || this.detail || this.detailBusy) return;
    this.detailBusy = true;
    try {
      const key = this.device.key;
      const d = await players().get(key);
      if (this.device?.key === key) this.detail = d;
    } catch {
      this.menu = false;
    } finally {
      this.detailBusy = false;
    }
  }

  private pick(id: string) {
    this.menu = false;
    void this.send('source', { command: 'source', source_id: id });
  }

  // ------------------------------------------------------------------------------------------------ render

  private art(v: PlayerView): TemplateResult {
    const img = v.artwork ? html`<img src=${artworkUrl(v.artwork)} alt="" loading="lazy" />` : nothing;
    return html`<div class="art" style=${`--a1:${v.a1};--a2:${v.a2}`}>${glyphIcon(v.glyph, undefined, 'gl')}${img}</div>`;
  }

  private cover(d: PlayerDevice, v: PlayerView): TemplateResult {
    const label = `פתח נגן · ${d.name}`;
    const spin = this.pending.has('power') ? html`<span class="pend"><i></i></span>` : nothing;
    const dis = this.editing;
    if (v.kind === 'un') return html`<button class="cov un" type="button" ?disabled=${dis} @click=${() => this.openPlayer()} aria-label=${label}><span class="ctr">${mIcon('wifiOff')}</span></button>`;
    if (v.kind === 'off') return html`<button class="cov off" type="button" ?disabled=${dis} @click=${() => this.openPlayer()} aria-label=${label}><span class="ctr">${mIcon(powerControlled(d) ? 'power' : d.kind === 'player' ? 'media' : 'speaker')}</span>${spin}</button>`;
    if (v.kind === 'rcv') return html`<button class="cov rcv" type="button" ?disabled=${dis} @click=${() => this.openPlayer()} aria-label=${label}><span class="ctr">${glyphIcon(v.glyph)}<span>${nameText(v.tile)}</span></span>${spin}</button>`;
    if (v.kind === 'idle') return html`<button class="cov idle" type="button" ?disabled=${dis} @click=${() => this.openPlayer()} aria-label=${label}><span class="ctr">${mIcon(d.kind === 'player' ? 'media' : 'speaker')}</span>${spin}</button>`;
    const badge = v.playing ? html`<span class="pilld"><i></i>מנגן</span>` : html`<span class="pilld">${mIcon('pause')}מושהה</span>`;
    const prog = v.kind === 'station' ? html`<span class="live"><i></i>חי</span>` : v.prog !== null ? html`<span class="pb" style=${`--p:${Math.round(v.prog * 100)}%`}><i></i></span>` : nothing;
    return html`<button class="cov" type="button" ?disabled=${dis} @click=${() => this.openPlayer()} aria-label=${label}>${this.art(v)}${badge}${prog}${spin}</button>`;
  }

  private mainKey(d: PlayerDevice, v: PlayerView): TemplateResult | typeof nothing {
    const ro = !d.can.control && !d.can.power;
    if (v.kind === 'un' || ro) return nothing;
    if ((d.kind === 'receiver' || v.kind === 'off') && !powerControlled(d)) return nothing; // a Cast-only speaker has no power control: asleep is a state, not a button
    if (d.kind === 'receiver' || v.kind === 'off') {
      const lit = isLit(d.live);
      const off = { command: 'power_off' } as const;
      const on = { command: 'power_on' } as const;
      const disabled = !playerCommandOffered(d, lit ? off : on) || this.pending.has('power');
      const tip = !d.live.caps_known ? 'לא זמין' : !lit && !d.caps.power_on ? 'אין הפעלה מרחוק' : lit ? 'כבה' : 'הפעל';
      return html`<div class="main"><button type="button" class=${classMap({ pw: true, on: lit, pend: this.pending.has('power'), nack: this.nack === 'power', shake: this.shaking === 'power' })} aria-pressed=${String(lit)} aria-label=${`${tip} · ${d.name}`} title=${tip} ?disabled=${disabled} @click=${() => this.power()}>${mIcon('power')}</button></div>`;
    }
    const playing = v.playing;
    const idle = v.kind === 'idle';
    const lbl = playing ? 'השהה' : idle ? 'נגן' : 'המשך';
    const disabled = !playerCommandOffered(d, { command: 'transport', action: 'play_pause' }) || this.pending.has('pb');
    return html`<div class="main"><button type="button" class=${classMap({ pk: true, idle, pend: this.pending.has('pb'), nack: this.nack === 'pb', shake: this.shaking === 'pb' })} aria-label=${`${lbl} · ${d.name}`} title=${lbl} ?disabled=${disabled} @click=${() => this.toggle()}>${mIcon(playing ? 'pause' : 'play')}</button></div>`;
  }

  private volumeControls(d: PlayerDevice) {
    if (!d.can.control || !(d.caps.volume_set || d.caps.volume_step)) return nothing;
    const lv = d.live.volume.level;
    const ceiling = effectiveCeiling(d);
    const up = playerCommandOffered(d, d.caps.volume_set ? { command: 'volume_set', level: (lv ?? 0) + 2 } : { command: 'volume_step', direction: 'up' }) && (ceiling === null || (lv ?? 0) < ceiling);
    const down = playerCommandOffered(d, d.caps.volume_set ? { command: 'volume_set', level: (lv ?? 0) - 2 } : { command: 'volume_step', direction: 'down' }) && (lv ?? 0) > 0;
    return html`<span class=${classMap({ vrock: true, muted: !!d.live.volume.muted, shake: this.shaking === 'volume' })} role="group" aria-label=${`עוצמה · ${d.name}`}>
      <button type="button" aria-label="הנמך" ?disabled=${!down} @click=${() => this.volume(-1)}>${mIcon('minus')}</button>
      <span class="vv"><span class="n">${lv ?? '—'}</span></span>
      <button type="button" aria-label="הגבר" ?disabled=${!up} @click=${() => this.volume(1)}>${mIcon('plus')}</button>
    </span>`;
  }

  private muteButton(d: PlayerDevice) {
    if (!d.can.control || !d.caps.mute) return nothing;
    const m = !!d.live.volume.muted;
    const label = m ? 'בטל השתקה' : 'השתק';
    return html`<button type="button" class=${classMap({ rb: true, muted: m, shake: this.shaking === 'mute' })} aria-pressed=${String(m)} aria-label=${label} title=${label} @click=${() => this.mute()}>${mIcon(m ? 'volOff' : 'vol')}</button>`;
  }

  private sourceMenu(d: PlayerDevice) {
    if (!this.menu) return nothing;
    const det = this.detail;
    if (!det) return html`<div class="pop" role="menu" aria-label="בחירת מקור"><div class="wait">טוען…</div></div>`;
    const cur = d.live.now.source_id;
    return html`<div class="pop" role="menu" aria-label="בחירת מקור">
      ${det.sources.map((s) => html`<button type="button" role="menuitemradio" aria-checked=${String(cur === s.id)} @click=${() => this.pick(s.id)}>${glyphIcon(s.glyph)}${nameText(s.label)}${cur === s.id ? html`<span class="ck">${mIcon('check')}</span>` : nothing}</button>`)}
    </div>`;
  }

  private controls(d: PlayerDevice, v: PlayerView) {
    const open = d.kind === 'receiver'
      ? html`<button type="button" class="rbtn" aria-label=${`שלט · ${d.name}`} @click=${() => this.openPlayer()}>${mIcon('remote')}שלט</button>`
      : html`<button type="button" class="rbtn" aria-label=${`נגן · ${d.name}`} @click=${() => this.openPlayer()}>נגן${mIcon('music')}</button>`;
    if (v.kind === 'un') return html`<span class="unl">${mIcon('wifiOff')}${v.line}</span><span class="grow"></span>${open}`;
    const ro = !d.can.control && !d.can.power;
    if (ro) return nothing;
    if (v.kind === 'off') return html`<span class="grow"></span>${open}`;
    const src = d.can.power && d.caps.sources
      ? html`<button type="button" class=${classMap({ rb: true, shake: this.shaking === 'source' })} aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`מקור: ${d.live.now.label || d.name}`} title="מקור" @click=${() => void this.toggleMenu()}>${mIcon('input')}</button>`
      : nothing;
    return html`${this.volumeControls(d)}${this.muteButton(d)}${src}<span class="grow"></span>${open}`;
  }

  /** The bubble row's end: play / power, the volume button (the morph), mute, source, "נגן" - the same commands as the classic card. */
  private bubbleKeys(d: PlayerDevice, v: PlayerView) {
    const main = this.mainKey(d, v);
    const ro = !d.can.control && !d.can.power;
    const open = html`<button type="button" class="rbtn" aria-label=${`${d.kind === 'receiver' ? 'שלט' : 'נגן'} · ${d.name}`} @click=${() => this.openPlayer()}>${mIcon(d.kind === 'receiver' ? 'remote' : 'music')}</button>`;
    if (v.kind === 'un') return html`<div class="main">${open}</div>`;
    if (ro) return html`<div class="main">${main === nothing ? nothing : main}</div>`;
    const canVol = d.can.control && d.caps.volume_set && v.kind !== 'off';
    const vol = canVol
      ? html`<button type="button" class="vb" aria-label=${`עוצמה · ${d.name}`} aria-expanded=${String(this.volOpen)} aria-controls="vol" @click=${() => (this.volOpen = !this.volOpen)}>${mIcon(d.live.volume.muted ? 'volOff' : 'vol')}</button>`
      : v.kind === 'off' ? nothing : this.volumeControls(d);
    const src = d.can.power && d.caps.sources && v.kind !== 'off' ? html`<button type="button" class=${classMap({ rb: true, shake: this.shaking === 'source' })} aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`מקור: ${d.live.now.label || d.name}`} title="מקור" @click=${() => void this.toggleMenu()}>${mIcon('input')}</button>` : nothing;
    return html`<div class="main">${vol}${src}${open}${main === nothing ? nothing : main}</div>`;
  }

  /** The morph (bubble skin): mute · the slider pill · close · the main key, the whole row. */
  private bubbleSlider(d: PlayerDevice, v: PlayerView) {
    const lv = d.live.volume.level ?? 0;
    const ceiling = effectiveCeiling(d);
    const main = this.mainKey(d, v);
    // the slider pill's tap is mute / unmute (its ring too), so no mute key is needed beside it: the row stays wide enough at 300 px
    return html`<div class="vmorph" id="vol" data-volume-morph>
      <sw-pill variant="slider" density="compact" .icon=${d.live.volume.muted ? 'volume' : 'volume'} label=${d.live.volume.muted ? 'מושתק' : 'עוצמה'} .state=${`${lv}%${ceiling !== null ? ` · עד ${ceiling}%` : ''}`} .value=${lv / 100} on keep-text fill-color="var(--sw-accent-soft)" ?unavailable=${this.pending.has('volume')} ?accent=${!!d.live.volume.muted}
        @toggle=${() => void this.mute()} @icon-click=${() => void this.mute()} @change=${(e: CustomEvent<{ value: number }>) => this.setVolume(e.detail.value * 100)}></sw-pill>
      <button type="button" class="rb" aria-label="סגור את העוצמה" data-volume-close @click=${() => (this.volOpen = false)}>${mIcon('close')}</button>
      ${main === nothing ? nothing : (main as TemplateResult)}
    </div>`;
  }

  render() {
    const d = this.device;
    if (!d) return nothing;
    const lead = this.leader;
    const v = playerView(d, lead);
    const lit = !!v.rgb && (v.playing || v.paused);
    if (this.skin.bubble) {
      const chip = isMember(d) ? null : groupChip(d);
      const line = [d.live.group.role === 'member' || v.kind === 'un' ? '' : d.area_name ?? '', v.kind === 'un' ? 'לא זמין' : v.line].filter(Boolean).join(' · ');
      const sub = this.note ? html`<small class="bad" role="status">${this.note}</small>` : html`<small>${line}${!this.note && v.title ? html` · ${nameText(v.title)}` : nothing}</small>`;
      const chipEl = chip ? html`<span class=${classMap({ gchip: true, warn: chip.kind === 'conflict' })}>${mIcon(chip.kind === 'conflict' ? 'warning' : 'group')}${chip.text}</span>` : nothing;
      const morph = this.volOpen && d.can.control && d.caps.volume_set && v.kind !== 'off';
      return html`<article class=${classMap({ pcard: true, glass: true, lit, paused: v.paused, un: v.kind === 'un', morph })} aria-label=${d.name} data-device=${d.key} data-kind=${d.kind} data-state=${v.kind} data-group-role=${d.live.group.role} data-leader=${leaderName(d, lead) ?? ''}>
        <div class="edit-slot"><slot name="edit"></slot></div>
        ${morph ? this.bubbleSlider(d, v) : html`${this.cover(d, v)}<div class="tx"><b>${nameText(d.name)}</b><span class="st">${sub}${chipEl}</span></div>${this.editing ? nothing : this.bubbleKeys(d, v)}`}
        ${this.sourceMenu(d)}
      </article>`;
    }
    const ctl = this.controls(d, v);
    const chip = isMember(d) ? null : groupChip(d);
    const line = [d.live.group.role === 'member' || v.kind === 'un' ? '' : d.area_name ?? '', v.kind === 'un' ? 'לא זמין' : v.line].filter(Boolean).join(' · ');
    const sub = this.note ? html`<small class="bad" role="status">${this.note}</small>` : html`<small>${line}</small>`;
    const chipEl = chip ? html`<span class=${classMap({ gchip: true, warn: chip.kind === 'conflict' })}>${mIcon(chip.kind === 'conflict' ? 'warning' : 'group')}${chip.text}</span>` : nothing;
    const now = !this.note && v.title ? html`<small class="now">${nameText(v.title)}${v.sub ? html` · ${nameText(v.sub)}` : nothing}</small>` : nothing;
    const name = leaderName(d, lead);
    return html`<article class=${classMap({ pcard: true, glass: true, lit, paused: v.paused, un: v.kind === 'un' })} style=${lit ? `--art:${v.rgb}` : ''} aria-label=${d.name} data-device=${d.key} data-kind=${d.kind} data-state=${v.kind} data-group-role=${d.live.group.role} data-leader=${name ?? ''}>
      <span class="gbox" aria-hidden="true">${lit ? this.art(v) : nothing}</span>
      <div class="edit-slot"><slot name="edit"></slot></div>
      ${this.cover(d, v)}
      <div class="tx"><b>${nameText(d.name)}</b><span class="st">${sub}${chipEl}</span>${now}</div>
      ${this.editing ? nothing : this.mainKey(d, v)}
      ${ctl === nothing ? nothing : html`<div class="sctl" ?inert=${this.editing}>${ctl}</div>`}
      ${this.sourceMenu(d)}
    </article>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-player-card': MediaPlayerCard;
  }
}
