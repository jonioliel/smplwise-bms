import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import './sw-live-player';
import './wk-talk-button';
import './wk-listen-button';
import './wk-action-button';
import type { SwLivePlayer } from './sw-live-player';
import { playerModeFor, startProfile, type MediaProfileId, type StationMedia } from '../api/station-media';
import { smt } from '../i18n/wiskey-station-media';

/**
 * A station's live picture and push-to-talk in the stations screen's drawer (CR-036 slice S18). The picture is the product's one
 * live player (sw-live-player) on the relay path the server named for the station (`livePath`): the sub profile plays WebRTC
 * first with MSE as the fallback, the main profile plays MSE (api/station-media.ts `playerModeFor`). The still stays as the
 * poster until the first frame. Below it: the quality choice (only when the station offers both profiles) and the talk control -
 * the native push-to-talk when the descriptor offers talk and the caller may call, else the classic-panel link (`classicHref`)
 * when the screen's policy shows one. A half-duplex station's sound is muted while the operator holds the floor.
 *
 * Video geometry is never mirrored by RTL (AGENTS.md): the frame sets `direction: ltr` for the player only.
 */
@customElement('wk-station-live')
export class WkStationLive extends LitElement {
  @property() stationId = '';
  @property() stationName = '';
  @property({ attribute: false }) media: StationMedia | null = null;
  @property() poster = '';
  /** The feed is live and the station online (no talk on a last-known copy). */
  @property({ type: Boolean }) live = true;
  /** The classic-panel talk link is offered when native talk is not (the policy `access.talk_button` and the caller's rights). */
  @property() classicHref = '';
  @property() classicLabel = '';

  @state() private profile: MediaProfileId | null = null;
  @query('sw-live-player') private player?: SwLivePlayer;
  private mutedBefore: boolean | null = null;

  static styles = css`
    :host {
      display: grid;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .frame {
      position: relative;
      direction: ltr;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-media, var(--sw-r-md));
      overflow: hidden;
      background: var(--sw-video-bg);
    }
    sw-live-player,
    .frame img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }
    .frame img {
      object-fit: cover;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .seg {
      display: inline-flex;
      align-items: stretch;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      background: var(--sw-surface);
    }
    .seg button {
      min-block-size: var(--sw-touch-desktop, 44px);
      min-inline-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3);
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: calc(-1 * var(--sw-focus-w));
    }
    .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    @media (max-width: 1100px) {
      .seg button {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('media') || changed.has('stationId')) {
      const ids = this.media?.video?.profiles.map((p) => p.id) ?? [];
      if (!this.profile || !ids.includes(this.profile) || changed.has('stationId')) this.profile = startProfile(this.media?.video ?? null);
    }
  }

  private onFloor = (e: Event): void => {
    const held = (e as CustomEvent<{ held: boolean }>).detail.held;
    const p = this.player;
    if (!p || this.media?.talk?.duplex === 'full') return;
    if (held) {
      this.mutedBefore = p.muted;
      p.muted = true;
    } else if (this.mutedBefore !== null) {
      p.muted = this.mutedBefore;
      this.mutedBefore = null;
    }
  };

  render() {
    const m = this.media;
    const v = m?.video;
    const t = smt();
    const prof = v?.profiles.find((p) => p.id === this.profile);
    const path = prof ? v?.paths[prof.id] : undefined;
    const talk = m?.talk;
    return html`
      ${path
        ? html`<div class="frame" data-wk-live-frame data-profile=${prof!.id}>
            <sw-live-player .livePath=${path} .profile=${prof!.id} .mode=${playerModeFor(prof)} .poster=${this.poster} data-wk-live-player aria-label=${`${t.live.label} · ${this.stationName}`}></sw-live-player>
          </div>`
        : this.poster
          ? html`<div class="frame" data-wk-live-frame data-profile=""><img src=${this.poster} alt=${`${t.live.poster} · ${this.stationName}`} decoding="async" /></div>`
          : nothing}
      ${v && v.profiles.length > 1 && path
        ? html`<div class="bar">
            <span class="lbl" id="q">${t.live.quality}</span>
            <div class="seg" role="group" aria-labelledby="q" data-wk-quality>
              ${v.profiles.map(
                (p) => html`<button type="button" data-profile=${p.id} aria-pressed=${String(p.id === this.profile)} @click=${() => (this.profile = p.id)}>${p.id === 'main' ? t.live.main : t.live.sub}</button>`,
              )}
            </div>
          </div>`
        : nothing}
      ${talk?.available
        ? html`<wk-talk-button .stationId=${this.stationId} .talk=${talk} .live=${this.live} data-wk-talk="native" @talk-floor=${this.onFloor}></wk-talk-button>`
        : this.classicHref
          ? html`<wk-action-button tone="dashed" icon="window" block size="lg" href=${this.classicHref} data-wk-talk="classic">${this.classicLabel}</wk-action-button>`
          : nothing}
      ${m?.state === 'ready' ? html`<wk-listen-button .stationId=${this.stationId} .live=${this.live}></wk-listen-button>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wk-station-live': WkStationLive;
  }
}
