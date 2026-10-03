import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import {
  PLAYBACK_ITEM_LABEL, VISIBILITY_LABEL, VISIBILITY_VALUES, applyPlaybackDisplay, onPlaybackDisplay, playbackDisplay, type PlaybackItem, type Visibility,
} from '../api/playback-display';
import {
  DEFAULT_TIMELINE_COLORS, TIMELINE_OPTIONS, TIMELINE_OPTION_LABEL, TIMELINE_PALETTE, applyTimelineColors, normalizeTimelineColors, onTimelineColors,
  similarTimelineOptions, timelineColors, timelineHex, type TimelineColors, type TimelineOption,
} from '../api/timeline-colors';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

/**
 * הגדרות › וידאו ומדיה › צבעי ציר הזמן (owner 2026-10-01: the person dots and the recording bars were both blue). One row per
 * thing the investigation timeline draws: its name, a live colour dot, ten palette swatches and a native colour input for
 * a custom colour. Installation-wide (`timeline.colors`, backend services/timeline_colors.py); only who may change settings
 * can edit. Two options with (nearly) the same colour get a soft inline note - never a block, the colours are the owner's choice.
 * A second section, "תצוגה", holds two rows with a three-way choice (לכולם / מתקינים בלבד / מוסתר) for the grey helper line above
 * the timelines (`playback.helper_line`) and the diagnostics block under the recording player (`playback.diagnostics`).
 */
@customElement('system-timeline-colors')
export class SystemTimelineColors extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private draft: TimelineColors = { ...timelineColors() };
  @state() private display: Record<PlaybackItem, Visibility> = { ...playbackDisplay() };
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  private stop?: () => void;
  private stopDisplay?: () => void;

  static styles = [css`
    :host {
      display: block;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(96px, 150px) 1fr;
      align-items: center;
      gap: 6px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    .name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: var(--sw-fw-medium);
    }
    .dot {
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      background: var(--c);
      box-shadow: 0 0 0 1px var(--sw-border-strong);
      flex: none;
    }
    .sw {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .sw button {
      inline-size: 24px;
      block-size: 24px;
      border-radius: 50%;
      border: 2px solid transparent;
      background: var(--c);
      padding: 0;
      cursor: pointer;
      box-shadow: 0 0 0 1px var(--sw-border-strong);
    }
    .sw button[aria-pressed='true'] {
      border-color: var(--sw-surface);
      box-shadow: 0 0 0 2px var(--sw-text);
    }
    .sw button:disabled,
    .sw input:disabled {
      cursor: default;
      opacity: 0.6;
    }
    .sw button:focus-visible,
    .sw input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    .sw input[type='color'] {
      inline-size: 28px;
      block-size: 28px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: 6px;
      background: none;
      cursor: pointer;
    }
    h4 {
      margin: 14px 0 2px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 2px;
      border-radius: 8px;
      background: var(--sw-surface-3);
    }
    .seg button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 5px 10px;
      border-radius: 6px;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .seg button[aria-checked='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .seg button:disabled {
      cursor: default;
      opacity: 0.6;
    }
    .seg button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    .warn {
      grid-column: 1 / -1;
      color: var(--sw-warning-text, #b45309);
      font-size: var(--sw-fs-xs);
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-block-start: 12px;
    }
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 480px) {
      .row {
        grid-template-columns: 1fr;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onTimelineColors(() => {
      if (!this.dirty) this.draft = { ...timelineColors() };
    });
    this.stopDisplay = onPlaybackDisplay(() => {
      if (!this.displayDirty) this.display = { ...playbackDisplay() };
    });
    if (isApi()) {
      void getSettings()
        .then((r) => {
          this.canEdit = r.can_edit;
          applyTimelineColors(r.settings['timeline.colors']);
          applyPlaybackDisplay(r.settings);
          this.draft = { ...timelineColors() };
          this.display = { ...playbackDisplay() };
        })
        .catch(() => undefined);
    }
  }

  disconnectedCallback() {
    this.stop?.();
    this.stopDisplay?.();
    super.disconnectedCallback();
  }

  private get colorsDirty(): boolean {
    const now = timelineColors();
    return TIMELINE_OPTIONS.some((o) => this.draft[o] !== now[o]);
  }

  private get displayDirty(): boolean {
    const now = playbackDisplay();
    return this.display.helper_line !== now.helper_line || this.display.diagnostics !== now.diagnostics;
  }

  private get dirty(): boolean {
    return this.colorsDirty || this.displayDirty;
  }

  private get atDefaults(): boolean {
    return TIMELINE_OPTIONS.every((o) => this.draft[o] === DEFAULT_TIMELINE_COLORS[o]);
  }

  private pick(option: TimelineOption, value: string) {
    this.draft = { ...this.draft, [option]: value };
    this.message = '';
  }

  private setDisplay(item: PlaybackItem, value: Visibility) {
    this.display = { ...this.display, [item]: value };
    this.message = '';
  }

  private reset() {
    this.draft = { ...DEFAULT_TIMELINE_COLORS };
    this.message = '';
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      // only what changed is sent
      const body: Parameters<typeof patchSettings>[0] = {};
      if (this.colorsDirty) body['timeline.colors'] = this.draft;
      if (this.display.helper_line !== playbackDisplay().helper_line) body['playback.helper_line'] = this.display.helper_line;
      if (this.display.diagnostics !== playbackDisplay().diagnostics) body['playback.diagnostics'] = this.display.diagnostics;
      const r = await patchSettings(body);
      invalidateSettings();
      applyTimelineColors(r.settings['timeline.colors']); // every open timeline follows at once
      applyPlaybackDisplay(r.settings); // ... and the helper line / diagnostics block
      this.draft = normalizeTimelineColors(r.settings['timeline.colors']);
      this.display = { ...playbackDisplay() };
      this.message = 'הצבעים נשמרו';
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const editable = this.canEdit && isApi();
    return html`<sw-card heading="צבעי ציר הזמן" data-timeline-colors>
      ${TIMELINE_OPTIONS.map((o) => {
        const hex = timelineHex(this.draft[o]) ?? '#000000';
        const similar = similarTimelineOptions(this.draft, o).map((x) => TIMELINE_OPTION_LABEL[x]);
        return html`<div class="row" data-timeline-option=${o}>
          <span class="name"><i class="dot" style="--c:${hex}" data-timeline-dot></i><span class="lbl">${TIMELINE_OPTION_LABEL[o]}</span></span>
          <span class="sw" role="group" aria-label=${TIMELINE_OPTION_LABEL[o]}>
            ${Object.entries(TIMELINE_PALETTE).map(
              ([token, p]) => html`<button type="button" style="--c:${p.hex}" title=${p.label} aria-label=${p.label} aria-pressed=${this.draft[o] === token ? 'true' : 'false'} data-timeline-swatch=${token} ?disabled=${!editable || this.busy} @click=${() => this.pick(o, token)}></button>`,
            )}
            <input type="color" .value=${hex} aria-label=${`${TIMELINE_OPTION_LABEL[o]}: צבע מותאם`} data-timeline-custom ?disabled=${!editable || this.busy} @change=${(e: Event) => this.pick(o, (e.target as HTMLInputElement).value.toLowerCase())} />
          </span>
          ${similar.length ? html`<span class="warn" role="note" data-timeline-warning>דומה ל${similar.join(', ')}</span>` : nothing}
        </div>`;
      })}
      <h4>תצוגה</h4>
      ${(['helper_line', 'diagnostics'] as const).map(
        (item) => html`<div class="row" data-playback-display=${item}>
          <span class="name"><span class="lbl">${PLAYBACK_ITEM_LABEL[item]}</span></span>
          <span class="seg" role="radiogroup" aria-label=${PLAYBACK_ITEM_LABEL[item]}>
            ${VISIBILITY_VALUES.map((v) => html`<button type="button" role="radio" aria-checked=${this.display[item] === v ? 'true' : 'false'} data-visibility=${v} ?disabled=${!editable || this.busy} @click=${() => this.setDisplay(item, v)}>${VISIBILITY_LABEL[v]}</button>`)}
          </span>
        </div>`,
      )}
      ${editable
        ? html`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-timeline-save ?disabled=${!this.dirty || this.busy} @click=${() => void this.save()}>שמור</sw-button>
            <sw-button variant="ghost" size="sm" data-timeline-reset ?disabled=${this.atDefaults || this.busy} @click=${() => this.reset()}>איפוס לברירת מחדל</sw-button>
            ${this.message ? html`<span class="ok" role="status" data-timeline-message>${this.message}</span>` : nothing}
            ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
          </div>`
        : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-timeline-colors': SystemTimelineColors;
  }
}
