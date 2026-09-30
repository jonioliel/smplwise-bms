import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { resourceUrl } from '../api/client';
import {
  KeyThrottle, commandOffered, isDead, isLit, isOn, media,
  type MediaCommand, type MediaDevice, type MediaDeviceDetail, type Size,
} from '../api/media-screens';
import { applyMediaGlass, mediaGlassStyles } from '../styles/media-glass';
import { glyphIcon, mIcon, nameText } from './media-icons';
import { hhmm, nowView, stateLine, type NowView } from './media-now';
import { runCommand, type CommandOutcome } from './media-command';

/**
 * CR-015: ONE card per physical screen (MEDIA_API.md §2.1, mockup v2 "Domus" glass): the now-showing poster (our own hue and a
 * neutral glyph, or the proxied content art), name and state, the power button, volume, mute, the source menu and "שלט".
 * Used by the screens page and - by tag - S3's area card. It shows only what `caps` and `can` allow; the server refuses the
 * same. Every press is one command with an honest outcome (media-command.ts): a spinner until the screen confirms, and after 8 s
 * "המסך לא אישר את הפקודה" with the last confirmed state; a press over the rate limit is dropped with a short shake. The
 * remote opens through the `open-remote` event ({ key, tab }); after a command the card raises `media-changed` ({ key, outcome })
 * so the owner of the list can re-read the device.
 *
 *   <media-screen-card .device=${d} .size=${'m'} ?compact=${phone} @open-remote=${...} @media-changed=${...}></media-screen-card>
 *
 * The page puts its edit chips into the `edit` slot (and sets `editing`: every control of the card is inert then).
 */
@customElement('media-screen-card')
export class MediaScreenCard extends LitElement {
  @property({ attribute: false }) device!: MediaDevice;
  @property({ reflect: true, attribute: 'data-size' }) size: Size = 'm';
  /** The phone's horizontal card (also what size "s" looks like). */
  @property({ type: Boolean, reflect: true }) compact = false;
  @property({ type: Boolean, reflect: true }) editing = false;
  @property({ type: Boolean, reflect: true, attribute: 'data-dimmed' }) dimmed = false;
  @state() private pending = new Set<string>();
  @state() private nack = '';
  @state() private note = '';
  @state() private shaking = '';
  @state() private menu = false;
  @state() private detail: MediaDeviceDetail | null = null;
  @state() private detailBusy = false;
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
    .scard {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 10px 10px 14px;
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
    .scard > :not(.gbox):not(.pop):not(.edit-slot) {
      position: relative;
      z-index: 1;
    }
    .scard.lit {
      border-color: rgb(var(--art) / 0.34);
      box-shadow: 0 22px 56px rgb(var(--art) / var(--mm-art-halo-alpha)), var(--dv-shadow-1);
    }
    .scard.paused .gbox {
      opacity: 0.55;
    }
    @media (hover: hover) and (prefers-reduced-motion: no-preference) {
      :host(:not([editing])) .scard:not(.un):hover {
        transform: translateY(var(--dv-hover-lift));
        box-shadow: var(--dv-shadow-2);
      }
      :host(:not([editing])) .scard.lit:hover {
        box-shadow: 0 26px 60px rgb(var(--art) / calc(var(--mm-art-halo-alpha) + 0.08)), var(--dv-shadow-2);
      }
    }
    .scard.un {
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
    :host([data-dimmed]) .scard {
      opacity: 0.45;
    }
    :host([editing]) .scard {
      outline: 2px dashed color-mix(in srgb, var(--dv-accent) 55%, transparent);
      outline-offset: 4px;
    }
    /* the poster */
    .shot {
      position: relative;
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 6.3;
      border-radius: calc(var(--dv-radius-md) - 8px);
      overflow: hidden;
      border: 0;
      padding: 0;
      color: #fff;
      text-align: start;
      background: var(--mm-screen-off);
      cursor: pointer;
      isolation: isolate;
      box-shadow: 0 10px 26px rgb(var(--art, 20 24 34) / 0.28);
    }
    :host([data-size='l']) .shot {
      aspect-ratio: 16 / 8.6;
    }
    .shot::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 5;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
      background: linear-gradient(118deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0) 36%);
      pointer-events: none;
    }
    .shot .ov {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0;
      padding: 26px 16px 13px;
      background: linear-gradient(0deg, rgba(0, 0, 0, 0.66), rgba(0, 0, 0, 0));
      display: flex;
      flex-direction: column;
      gap: 1px;
      z-index: 2;
    }
    .shot .ov b {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
    }
    .shot .ov small {
      font-size: 12.5px;
      opacity: 0.92;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .shot .tl {
      position: absolute;
      inset-block-start: 10px;
      inset-inline-start: 10px;
      z-index: 3;
      display: flex;
      gap: 6px;
    }
    .shot .pb {
      position: absolute;
      inset-inline: 14px;
      inset-block-end: 7px;
      block-size: 3px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.25);
      z-index: 3;
      overflow: hidden;
    }
    .shot .pb i {
      display: block;
      block-size: 100%;
      inline-size: var(--p, 0%);
      background: #fff;
      border-radius: 3px;
    }
    .shot .ctr {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 8px;
      color: var(--dv-text-2);
      font-size: 12.5px;
      font-weight: 500;
    }
    .shot .ctr .ic {
      font-size: 24px;
      stroke-width: 1.6;
    }
    .shot.off,
    .shot.un {
      box-shadow: none;
    }
    .shot.un {
      background: repeating-linear-gradient(135deg, var(--dv-surface-3) 0 10px, transparent 10px 20px), var(--dv-surface-2);
    }
    .shot .spin {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(0, 0, 0, 0.32);
      z-index: 4;
      -webkit-backdrop-filter: blur(3px);
      backdrop-filter: blur(3px);
    }
    .shot .spin i {
      inline-size: 30px;
      block-size: 30px;
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      animation: mm-spin 0.8s linear infinite;
    }
    .shot[disabled] {
      cursor: default;
    }
    /* name, state, power, controls */
    .sbody {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-inline: 6px;
    }
    .srow {
      display: flex;
      align-items: center;
      gap: 12px;
      min-inline-size: 0;
    }
    .srow .tx {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    .srow .tx b {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .srow .tx small {
      font-size: 13px;
      color: var(--dv-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .srow .tx small.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
    .sctl {
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
      font-size: 12.5px;
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
      font-size: 13px;
    }
    /* the phone's horizontal card (and size "s") */
    :host([compact]) .scard,
    :host([data-size='s']) .scard {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr) auto;
      grid-template-areas: 'shot tx pw' 'ctl ctl ctl';
      gap: 12px;
      padding: 8px 8px 10px;
    }
    :host([compact]) .sbody,
    :host([compact]) .srow,
    :host([data-size='s']) .sbody,
    :host([data-size='s']) .srow {
      display: contents;
    }
    :host([compact]) .srow .tx,
    :host([data-size='s']) .srow .tx {
      grid-area: tx;
      align-self: center;
    }
    :host([compact]) .srow .pw,
    :host([data-size='s']) .srow .pw {
      grid-area: pw;
      align-self: center;
    }
    :host([compact]) .shot,
    :host([data-size='s']) .shot {
      grid-area: shot;
      aspect-ratio: 16 / 10.5;
      border-radius: 14px;
    }
    :host([compact]) .shot .ov,
    :host([data-size='s']) .shot .ov {
      padding: 14px 9px 7px;
    }
    :host([compact]) .shot .ov b,
    :host([data-size='s']) .shot .ov b {
      font-size: 12px;
    }
    :host([compact]) .shot .ov small,
    :host([compact]) .shot .tl,
    :host([compact]) .shot .ctr span,
    :host([data-size='s']) .shot .ov small,
    :host([data-size='s']) .shot .tl,
    :host([data-size='s']) .shot .ctr span {
      display: none;
    }
    :host([compact]) .shot .pb,
    :host([data-size='s']) .shot .pb {
      inset-inline: 8px;
      inset-block-end: 4px;
    }
    /* the wrappers are display:contents there: the grid items themselves must sit above the glow */
    :host([compact]) .srow .tx,
    :host([compact]) .srow .pw,
    :host([compact]) .sctl,
    :host([data-size='s']) .srow .tx,
    :host([data-size='s']) .srow .pw,
    :host([data-size='s']) .sctl {
      position: relative;
      z-index: 1;
    }
    :host([compact]) .sctl,
    :host([data-size='s']) .sctl {
      grid-area: ctl;
      padding-inline: 2px;
    }
    :host([compact]) .pop,
    :host([data-size='s']) .pop {
      inset-inline-start: 8px;
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
      if (this.menu && !isOn(this.device.live)) this.menu = false; // a screen that went off has no sources to offer
    }
    this.toggleAttribute('data-menu', this.menu);
  }

  protected updated() {
    // the progress bar moves once a second while something plays with a known duration
    const moving = !!this.device && this.device.live.play === 'playing' && this.device.live.power === 'on' && !!this.device.live.now.duration_s;
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

  /** The outcome of a press: drop the spinner, say what went wrong (shortly), and tell the owner of the list to re-read. */
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

  private async send(kind: string, cmd: MediaCommand) {
    if (!commandOffered(this.device, cmd) || this.pending.has(kind)) return;
    if (kind !== 'power' && kind !== 'source' && !this.throttle.take()) return this.shake(kind);
    this.nack = '';
    this.note = '';
    this.setPending(kind, true);
    this.settle(kind, await runCommand(this.device.key, cmd));
  }

  private power() {
    void this.send('power', { command: isLit(this.device.live) ? 'power_off' : 'power_on' });
  }

  private volume(dir: 1 | -1) {
    const d = this.device;
    const step = d.caps.volume_step || d.caps.keys.includes(dir > 0 ? 'volup' : 'voldown');
    const level = Math.max(0, Math.min(100, (d.live.volume.level ?? 0) + dir * 2));
    void this.send('volume', step ? { command: 'volume_step', direction: dir > 0 ? 'up' : 'down' } : { command: 'volume_set', level });
  }

  private mute() {
    void this.send('mute', { command: 'mute', muted: !this.device.live.volume.muted });
  }

  private openRemote(tab?: 'apps') {
    this.menu = false;
    this.dispatchEvent(new CustomEvent('open-remote', { detail: { key: this.device.key, tab: tab ?? null }, bubbles: true, composed: true }));
  }

  private async toggleMenu() {
    this.menu = !this.menu;
    if (!this.menu || this.detail || this.detailBusy) return;
    this.detailBusy = true;
    try {
      const key = this.device.key;
      const d = await media().get(key);
      if (this.device?.key === key) this.detail = d;
    } catch {
      this.menu = false;
    } finally {
      this.detailBusy = false;
    }
  }

  private pick(kind: 'source' | 'app', id: string) {
    this.menu = false;
    void this.send('source', kind === 'source' ? { command: 'source', source_id: id } : { command: 'app', app_id: id });
  }

  // ------------------------------------------------------------------------------------------------ render

  private poster(v: NowView): TemplateResult | typeof nothing {
    if (v.kind === 'art') {
      return html`<div class="art frameart"><svg viewBox="0 0 100 70" aria-hidden="true"><rect x="0" y="0" width="100" height="70" fill="#f7f1e6" stroke="#b9a37e" stroke-width="2"/><circle cx="32" cy="32" r="16" fill="#e0794a" opacity=".85"/><rect x="48" y="18" width="30" height="36" fill="#27496d" opacity=".85"/><path d="M8 58 C30 44 52 60 92 46" stroke="#2f3a2f" stroke-width="2.5" fill="none"/></svg></div>`;
    }
    if (v.kind === 'saver') return html`<div class="art saver">${mIcon('moon', undefined, 'gl')}</div>`;
    if (v.kind === 'un' || v.kind === 'off') return nothing;
    const img = v.artwork ? html`<img src=${this.artworkSrc(v.artwork)} alt="" loading="lazy" />` : nothing;
    return html`<div class="art" style=${`--a1:${v.a1};--a2:${v.a2}`}>${v.channel ? html`<span class="ch">${v.channel}</span>` : glyphIcon(v.glyph, undefined, 'gl')}${img}</div>`;
  }

  private artworkSrc(u: string): string {
    return /^https?:/.test(u) ? u : resourceUrl(u.startsWith('api/') ? u : `api/v1/${u.replace(/^\/+/, '')}`);
  }

  private shotButton(d: MediaDevice, v: NowView) {
    const label = `פתח שלט · ${d.name}`;
    const spin = this.pending.has('power') ? html`<span class="spin"><i></i></span>` : nothing;
    if (v.kind === 'un') return html`<button class="shot un" type="button" ?disabled=${this.editing} @click=${() => this.openRemote()} aria-label=${label}><span class="ctr">${mIcon('wifiOff')}<span>${v.label}</span></span></button>`;
    if (v.kind === 'off') return html`<button class="shot off" type="button" ?disabled=${this.editing} @click=${() => this.openRemote()} aria-label=${label}><span class="ctr">${mIcon('power')}<span>כבוי</span></span>${spin}</button>`;
    const l = d.live;
    const badge = v.kind === 'art'
      ? html`<span class="pilld">${mIcon('frame')}אמנות</span>`
      : l.play === 'playing' ? html`<span class="pilld"><i></i>מנגן</span>` : l.play === 'paused' ? html`<span class="pilld">${mIcon('pause')}מושהה</span>` : nothing;
    return html`<button class="shot" type="button" ?disabled=${this.editing} @click=${() => this.openRemote()} aria-label=${label}>
      ${this.poster(v)}<span class="tl">${badge}</span>
      ${v.kind === 'art' ? nothing : html`<span class="ov"><b>${nameText(v.kind === 'tv' ? 'טלוויזיה' : v.label)}</b>${v.sub ? html`<small>${v.sub}</small>` : nothing}</span>`}
      ${v.prog !== null ? html`<span class="pb" style=${`--p:${Math.round(v.prog * 100)}%`}><i></i></span>` : nothing}${spin}
    </button>`;
  }

  private powerButton(d: MediaDevice) {
    const lit = isLit(d.live);
    const off = { command: 'power_off' } as const;
    const on = { command: 'power_on' } as const;
    const disabled = !commandOffered(d, lit ? off : on) || this.pending.has('power');
    const tip = isDead(d.live) ? 'לא זמין' : !lit && !d.caps.power_on ? (d.caps.power_on_reason === 'no_remote_wake' ? 'אין הפעלה מרחוק' : 'אין הפעלה') : lit ? 'כבה' : 'הפעל';
    return html`<button type="button" class=${classMap({ pw: true, on: lit, pend: this.pending.has('power'), nack: this.nack === 'power', shake: this.shaking === 'power' })} aria-pressed=${String(lit)}
      aria-label=${`${tip} · ${d.name}`} title=${tip} ?disabled=${disabled} @click=${() => this.power()}>${mIcon('power')}</button>`;
  }

  private volumeControls(d: MediaDevice) {
    const can = d.can.control && (d.caps.volume_set || d.caps.volume_step || d.caps.keys.includes('volup'));
    if (!can) return nothing;
    const lv = d.live.volume.level;
    const up = commandOffered(d, { command: 'volume_step', direction: 'up' }) || (d.caps.volume_set && commandOffered(d, { command: 'volume_set', level: (lv ?? 0) + 2 }));
    const down = commandOffered(d, { command: 'volume_step', direction: 'down' }) || (d.caps.volume_set && commandOffered(d, { command: 'volume_set', level: (lv ?? 0) - 2 }));
    return html`<span class=${classMap({ vrock: true, muted: !!d.live.volume.muted, shake: this.shaking === 'volume' })} role="group" aria-label=${`עוצמה · ${d.name}`}>
      <button type="button" aria-label="הנמך" ?disabled=${!down} @click=${() => this.volume(-1)}>${mIcon('minus')}</button>
      <span class="vv"><span class="n">${lv ?? '—'}</span></span>
      <button type="button" aria-label="הגבר" ?disabled=${!up} @click=${() => this.volume(1)}>${mIcon('plus')}</button>
    </span>`;
  }

  private muteButton(d: MediaDevice) {
    if (!d.can.control || !d.caps.mute) return nothing;
    const m = !!d.live.volume.muted;
    const label = m ? 'בטל השתקה' : 'השתק';
    return html`<button type="button" class=${classMap({ rb: true, muted: m, shake: this.shaking === 'mute' })} aria-pressed=${String(m)} aria-label=${label} title=${label} @click=${() => this.mute()}>${mIcon(m ? 'volOff' : 'vol')}</button>`;
  }

  private sourceMenu(d: MediaDevice) {
    if (!this.menu) return nothing;
    const det = this.detail;
    if (!det) return html`<div class="pop" role="menu" aria-label="בחירת מקור"><div class="wait">טוען…</div></div>`;
    const cur = d.live.now;
    const sources = det.sources;
    const apps = det.apps.slice(0, 4);
    const item = (kind: 'source' | 'app', it: { id: string; label: string; glyph: string }) => {
      const on = kind === 'source' ? cur.source_id === it.id : cur.app_id === it.id;
      return html`<button type="button" role="menuitemradio" aria-checked=${String(on)} @click=${() => this.pick(kind, it.id)}>${glyphIcon(it.glyph)}${nameText(it.label)}${on ? html`<span class="ck">${mIcon('check')}</span>` : nothing}</button>`;
    };
    return html`<div class="pop" role="menu" aria-label="בחירת מקור">
      ${sources.map((s) => item('source', s))}${sources.length && apps.length ? html`<hr />` : nothing}${apps.map((a) => item('app', a))}
      ${det.apps.length ? html`<hr /><button type="button" role="menuitem" @click=${() => this.openRemote('apps')}>${mIcon('apps')}כל האפליקציות</button>` : nothing}
    </div>`;
  }

  private controls(d: MediaDevice, v: NowView) {
    if (v.kind === 'un') return html`<span class="unl">${mIcon('wifiOff')}${d.live.power === 'unknown' ? 'מצב לא ידוע' : d.live.since ? html`לא זמין מאז <span class="n">${hhmm(d.live.since)}</span>` : 'לא זמין'}</span>`;
    const ro = !d.can.control && !d.can.power;
    if (ro) return nothing;
    const remote = html`<button type="button" class="rbtn" aria-label=${`שלט · ${d.name}`} @click=${() => this.openRemote()}>${mIcon('remote')}שלט</button>`;
    if (!isOn(d.live)) return html`<span class="grow"></span>${remote}`;
    const src = d.can.power && d.can.public_ok && (d.caps.sources || d.caps.apps)
      ? html`<button type="button" class=${classMap({ rb: true, shake: this.shaking === 'source' })} aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${`מקור: ${v.kind === 'tv' ? 'טלוויזיה' : v.label}`} title="מקור" @click=${() => void this.toggleMenu()}>${mIcon('input')}</button>`
      : nothing;
    return html`${this.volumeControls(d)}${this.muteButton(d)}${src}<span class="grow"></span>${remote}`;
  }

  render() {
    const d = this.device;
    if (!d) return nothing;
    const v = nowView(d);
    const lit = isLit(d.live) && !!v.rgb;
    const ro = !d.can.control && !d.can.power;
    const ctl = this.controls(d, v);
    const sub = this.note ? html`<small class="bad" role="status">${this.note}</small>` : html`<small>${stateLine(d, v)}</small>`;
    return html`<article class=${classMap({ scard: true, glass: true, lit, paused: d.live.play === 'paused', un: v.kind === 'un' })} style=${lit ? `--art:${v.rgb}` : ''} aria-label=${d.name} data-device=${d.key}>
      <span class="gbox" aria-hidden="true">${lit ? this.poster(v) : nothing}</span>
      <div class="edit-slot"><slot name="edit"></slot></div>
      ${this.shotButton(d, v)}
      <div class="sbody" ?inert=${this.editing}>
        <div class="srow"><div class="tx"><b>${nameText(d.name)}</b>${sub}</div>${ro ? nothing : this.powerButton(d)}</div>
        ${ctl === nothing ? nothing : html`<div class="sctl">${ctl}</div>`}
      </div>
      ${this.sourceMenu(d)}
    </article>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-screen-card': MediaScreenCard;
  }
}
