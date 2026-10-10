import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { artworkUrl, KeyThrottle } from '../api/media-screens';
import { effectiveCeiling, interpolatePosition, playerCommandOffered, type PlayerCommand, type PlayerDevice } from '../api/media-players';
import { glyphIcon, mIcon, nameText } from './media-icons';
import { runPlayerCommand } from './media-player-run';
import { playerView } from './media-player-now';
import { mmss } from './media-remote-logic';
import { applyMediaGlass, mediaGlassStyles } from '../styles/media-glass';
import './sw-pill';

/**
 * The Bubble skin's "now playing" hero (phase C, 2026-10-02; the media board's top panel): ONE glass panel over the blurred cover
 * art of the player that plays right now - the art, the title and artist, the room and group chips, the progress bar (LTR, like
 * every timeline), the transport keys (LTR) and the volume as a slider pill. The players page draws it above the groups when
 * the skin is bubble; the panel sends the same one-press commands as the cards (media-player-run.ts) and never guesses a
 * capability the player does not report. Reduced transparency / no backdrop-filter: a solid panel over the plain tint.
 */
@customElement('media-now-hero')
export class MediaNowHero extends LitElement {
  @property({ attribute: false }) device: PlayerDevice | null = null;
  @state() private pending = new Set<string>();
  @state() private note = '';
  private throttle = new KeyThrottle();
  private ticker = 0;
  private timers: number[] = [];

  static styles = [mediaGlassStyles, css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      border-radius: var(--sw-r-xl);
      background: linear-gradient(135deg, var(--a1, #111827), var(--a2, #3f4a5c));
      color: var(--sw-text);
      container-type: inline-size;
    }
    .bg {
      position: absolute;
      inset: -12%;
      z-index: 0;
      background-size: cover;
      background-position: center;
      filter: blur(28px) saturate(1.4);
      opacity: 0.9;
    }
    .veil {
      position: absolute;
      inset: 0;
      z-index: 1;
      background: rgba(var(--sw-sheet-rgb), 0.62);
    }
    .in {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas: 'art meta' 'art bar' 'art keys';
      gap: 10px 20px;
      align-items: center;
      padding: 18px 20px;
    }
    .art {
      grid-area: art;
      inline-size: 180px;
      block-size: 180px;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      position: relative;
      background: linear-gradient(135deg, var(--a1, #111827), var(--a2, #3f4a5c));
      display: grid;
      place-items: center;
      color: var(--sw-on-video);
      font-size: 56px;
      box-shadow: var(--sw-shadow-2);
    }
    .art img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .meta {
      grid-area: meta;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-layer);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
    }
    .ttl {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      unicode-bidi: plaintext;
      text-align: start;
    }
    .sub {
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      unicode-bidi: plaintext;
      text-align: start;
    }
    .bad {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    /* the progress: LTR like every timeline */
    .bar {
      grid-area: bar;
      direction: ltr;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-2);
    }
    .bar .tr {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-layer);
      overflow: hidden;
    }
    .bar .tr i {
      display: block;
      block-size: 100%;
      inline-size: var(--p, 0%);
      background: var(--sw-text);
      border-radius: 3px;
    }
    .bar .live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-bold);
    }
    .bar .live i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-danger);
    }
    .keys {
      grid-area: keys;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .tp {
      direction: ltr;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: none;
    }
    .k {
      inline-size: 52px;
      block-size: 52px;
      min-inline-size: 44px;
      min-block-size: 44px;
      border: 0;
      border-radius: 50%;
      background: var(--sw-layer);
      color: var(--sw-text);
      display: grid;
      place-items: center;
      cursor: pointer;
      font-size: var(--sw-fs-2xl);
      padding: 0;
      transition: transform 120ms var(--sw-ease);
    }
    .k.main {
      inline-size: 60px;
      block-size: 60px;
      background: var(--sw-text);
      color: var(--sw-bg);
      font-size: var(--sw-fs-3xl);
    }
    .k:active {
      transform: scale(0.94);
    }
    .k[disabled] {
      opacity: 0.4;
      cursor: default;
    }
    .k:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    sw-pill.vol {
      flex: 1 1 200px;
      min-inline-size: 0;
      --pill-base: var(--sw-layer);
    }
    /* a narrow panel stacks: the art on top, centred */
    @container (max-width: 560px) {
      .in {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: 'art' 'meta' 'bar' 'keys';
        justify-items: center;
        text-align: center;
        padding: 16px;
      }
      .art {
        inline-size: min(180px, 48cqw);
        block-size: min(180px, 48cqw);
      }
      .meta {
        inline-size: 100%;
        align-items: center;
      }
      .chips {
        justify-content: center;
      }
      .bar,
      .keys {
        inline-size: 100%;
      }
      .keys {
        justify-content: center;
      }
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      .veil {
        background: rgba(var(--sw-sheet-rgb), 0.78);
      }
    }
    @media (prefers-reduced-transparency: reduce) {
      .bg {
        display: none;
      }
      .veil {
        background: var(--sw-surface-solid);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .k {
        transition: none;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void applyMediaGlass(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.ticker);
    this.ticker = 0;
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
  }

  protected updated() {
    const d = this.device;
    const moving = !!d && d.live.play === 'playing' && !!d.live.now.duration_s && d.live.now.kind !== 'station';
    if (moving && !this.ticker) this.ticker = window.setInterval(() => this.requestUpdate(), 1000);
    else if (!moving && this.ticker) {
      window.clearInterval(this.ticker);
      this.ticker = 0;
    }
  }

  private async send(kind: string, cmd: PlayerCommand) {
    const d = this.device;
    if (!d || !playerCommandOffered(d, cmd) || this.pending.has(kind)) return;
    if (!this.throttle.take()) return;
    this.note = '';
    const next = new Set(this.pending);
    next.add(kind);
    this.pending = next;
    const o = await runPlayerCommand(d.key, cmd);
    const done = new Set(this.pending);
    done.delete(kind);
    this.pending = done;
    if (o.outcome === 'not_confirmed' || o.outcome === 'refused') {
      this.note = o.message;
      this.timers.push(window.setTimeout(() => (this.note = ''), 6000));
    }
    this.dispatchEvent(new CustomEvent('media-changed', { detail: { key: d.key, outcome: o.outcome }, bubbles: true, composed: true }));
  }

  render() {
    const d = this.device;
    if (!d) return nothing;
    const v = playerView(d);
    const n = d.live.now;
    const playing = v.playing;
    const pos = v.kind === 'station' ? null : interpolatePosition(n, playing, Date.now());
    const dur = n.duration_s ?? null;
    const pct = pos !== null && dur ? Math.max(0, Math.min(100, (pos / dur) * 100)) : 0;
    const lv = d.live.volume.level ?? 0;
    const ceiling = effectiveCeiling(d);
    const can = d.can.control;
    const tp = (action: 'previous' | 'play_pause' | 'next') => () => void this.send(action, { command: 'transport', action });
    const members = d.live.group.role === 'leader' ? d.live.group.member_keys.length + 1 : 0;
    const art = v.artwork ? artworkUrl(v.artwork) : '';
    return html`<section class="hero" style=${`--a1:${v.a1};--a2:${v.a2}`} aria-label=${`מתנגן עכשיו · ${d.name}`} data-now-hero=${d.key} data-playing=${String(playing)}>
      <div class="bg" style=${art ? `background-image:url("${art}")` : nothing}></div>
      <div class="veil"></div>
      <div class="in">
        <div class="art">${art ? html`<img src=${art} alt="" />` : glyphIcon(v.glyph)}</div>
        <div class="meta">
          <div class="chips">
            <span class="chip">${mIcon(d.kind === 'player' ? 'media' : 'speaker')}${nameText(d.area_name || d.name)}</span>
            ${members ? html`<span class="chip">${mIcon('group')}${members} חדרים</span>` : nothing}
          </div>
          <div class="ttl" data-now-title>${nameText(n.title || v.line || d.name)}</div>
          ${n.artist || n.album ? html`<div class="sub">${nameText([n.artist, n.album].filter(Boolean).join(' · '))}</div>` : nothing}
          ${this.note ? html`<div class="bad" role="status">${this.note}</div>` : nothing}
        </div>
        <div class="bar">
          ${v.kind === 'station'
            ? html`<span class="live"><i></i>שידור חי</span><span class="tr"></span><span></span>`
            : html`<span>${pos !== null ? mmss(pos) : '–:––'}</span><span class="tr" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(pct)} style=${`--p:${pct}%`}><i></i></span><span>${dur ? mmss(dur) : '–:––'}</span>`}
        </div>
        <div class="keys">
          ${can
            ? html`<span class="tp" role="group" aria-label="ניגון">
                <button type="button" class="k" aria-label="הקודם" ?disabled=${!playerCommandOffered(d, { command: 'transport', action: 'previous' })} @click=${tp('previous')}>${mIcon('prev')}</button>
                <button type="button" class=${classMap({ k: true, main: true })} aria-label=${playing ? 'השהה' : 'נגן'} ?disabled=${!playerCommandOffered(d, { command: 'transport', action: 'play_pause' }) || this.pending.has('play_pause')} @click=${tp('play_pause')}>${mIcon(playing ? 'pause' : 'play')}</button>
                <button type="button" class="k" aria-label="הבא" ?disabled=${!playerCommandOffered(d, { command: 'transport', action: 'next' })} @click=${tp('next')}>${mIcon('next')}</button>
              </span>`
            : nothing}
          ${can && d.caps.volume_set
            ? html`<sw-pill class="vol" variant="slider" icon="volume" label="עוצמה" .state=${`${lv}%${d.live.volume.muted ? ' · מושתק' : ''}`} .value=${lv / 100} on keep-text fill-color="var(--sw-accent-soft)" ?unavailable=${this.pending.has('volume')}
                @toggle=${() => void this.send('mute', { command: 'mute', muted: !d.live.volume.muted })} @change=${(e: CustomEvent<{ value: number }>) => void this.send('volume', { command: 'volume_set', level: Math.max(0, Math.min(ceiling ?? 100, Math.round(e.detail.value * 100))) })}></sw-pill>`
            : nothing}
        </div>
      </div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-now-hero': MediaNowHero;
  }
}
