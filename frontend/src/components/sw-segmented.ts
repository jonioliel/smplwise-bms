import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { segmentedFocusStep, segmentedTabStop } from './segmented-logic';

/** One key of a segmented control. */
export interface SegmentOption<V extends string = string> {
  value: V;
  label: string;
  /** A small number after the label (e.g. "only failures 3"); 0 / '' shows nothing. */
  count?: number | string;
  disabled?: boolean;
  /** A tooltip (the key's `title`). */
  title?: string;
  /** Attributes copied onto the key's `<button>` (the data-* hooks a screen and its specs already used, e.g. `{ 'data-lock-level': 'full' }`). */
  attrs?: Readonly<Record<string, string>>;
  /** CR-CMP2-SEGMENTED-C-2450: an icon at the start of the key (the screen's own icon template: `sw-icon`, an inline svg). With
   * `labels="none"` / `"chosen"` the key may show the icon alone; its label then names the key (`aria-label`) and is its tooltip. */
  icon?: TemplateResult;
  /** A second, smaller line under the label (a two-line key: the assignee kinds' "why"). */
  sub?: string;
  /** A short tag after the label in the accent tone (the nav size's "current" preset); `badgeAttrs` go on it (its data-* hooks). */
  badge?: string;
  badgeAttrs?: Readonly<Record<string, string>>;
  /** The key can still be chosen but cannot be used now: its label dims and its second line takes the warning ink (the line says why). */
  dimmed?: boolean;
}

export interface SegmentedChange<V extends string = string> {
  value: V;
}

/**
 * CR-CMP2-SELECTS-2450 (owner N11, 19.11; 06:CMP-2): THE segmented control - a short row of mutually exclusive keys on a sunken track,
 * the chosen key a lifted thumb. The look is the settings key style the owner chose (POLISH4-WP1, Q3a: styles/settings.ts
 * `settingsSegStyles`), so a screen that swaps its hand-built `.seg` for this element keeps that language; the `--sw-seg-*` knobs a
 * glass host sets (TKUI6, the service-management pages) still reach every part through the shadow boundary.
 *
 *     <sw-segmented label="רמת פירוט" .options=${[{ value: 'generic', label: 'כללי' }, ...]} value=${s.lockscreen}
 *       @change=${(e: CustomEvent<SegmentedChange>) => this.patch({ lockscreen: e.detail.value })}></sw-segmented>
 *
 * Behaviour, kept from the hand-built keys it replaces:
 *  - CONTROLLED: a press never moves the thumb by itself. It fires `change` ({ value }) and the host re-renders with the new `value`
 *    (a key showed the model's value before too - a refused save leaves the thumb where it was). A press on the chosen key fires as
 *    well: some screens reopen something from it (the "selected users" key opens the picker again).
 *  - each key is a `<button aria-pressed>` in a `role="group"` named by `label`; the screens' specs that read `button[aria-pressed]`
 *    keep working (Playwright's CSS pierces the shadow root). The arrow keys and Home / End move the focus along the keys.
 *  - `size="sm"`: the 28 px key of the compact rows (notification settings); default 34 px. `block`: the track fills its row and the
 *    keys share it equally; a host that only stretches it on some widths sets `--sw-seg-key-flex: 1 1 auto` there. On a coarse pointer every key keeps a 44 px tall touch target (an absolute ::before, no layout change).
 *  - knobs a host may set beside the track ones (CR-CMP2-SEGMENTED-B-2450, so a screen keeps its key through the shadow root):
 *    --sw-seg-fg (the ink of a key that is not chosen), --sw-seg-fs / --sw-seg-fw / --sw-seg-on-fw (the label size, weight, the
 *    chosen key's weight), --sw-seg-key-min-w,
 *    --sw-seg-count-bg / --sw-seg-count-on-bg (the count pill), --sw-seg-count-fs / --sw-seg-count-pad / --sw-seg-count-min-w (its size:
 *    a host whose counts were plain small figures - the glass keys - sets no pill, so its strip keeps its width).
 *  - motion (emil-design-eng): a settings key is pressed tens of times a day, so the thumb does not slide; colour fades on the
 *    hover curve and a key gives on pointer-down (`--sw-press-scale`, 1 = none in the skins that turn press feedback off).
 *  - rich keys (CR-CMP2-SEGMENTED-C-2450): an option may carry an `icon`, a second line (`sub`), a `badge` and `dimmed`. `labels`
 *    decides which keys show their label beside the icon: `all` (default), `chosen` (the others show the icon alone - the tickets
 *    list's view switch) or `none` (icon-only keys). An icon-only key is named by its label and takes it as its tooltip. The parts
 *    `key`, `icon`, `label`, `sub`, `badge` let a host shape a key it must (a phone hides the label: `::part(label)`); the chosen
 *    key adds `key-on` / `icon-on` (the view switch's accent icon: `::part(icon-on)`).
 *    Two-line keys stack the label over the second line; the knobs --sw-seg-axis (the track: `column` stacks the keys),
 *    --sw-seg-key-axis / --sw-seg-key-justify / --sw-seg-key-align / --sw-seg-text-align (inside a key), --sw-seg-sub-fg and
 *    --sw-seg-dim-fg / --sw-seg-dim-sub-fg (the dimmed key), --sw-seg-badge-bg / --sw-seg-badge-fg; --sw-seg-wrap (`nowrap` keeps a
 *    long strip on one line for a host that scrolls it sideways itself).
 *  - `roving`: a group the screen used as its view's tabs (the tickets handlers' segments): only one key is in the Tab order and
 *    an arrow key CHOOSES the next key (fires `change`) as well as focusing it - a radio group's own keyboard rule.
 */
@customElement('sw-segmented')
export class SwSegmented<V extends string = string> extends LitElement {
  @property({ attribute: false }) options: readonly SegmentOption<V>[] = [];
  @property() value = '';
  /** The group's accessible name. */
  @property() label = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ reflect: true }) size: 'md' | 'sm' = 'md';
  @property({ type: Boolean, reflect: true }) block = false;
  /** CR-CMP2-SEGMENTED-B-2450: a choice the screen already named a radio group (the settings rows of tickets, calendars, timeline
   * colours ...): the track is a `radiogroup` and each key a `radio` with `aria-checked`. The key keeps `aria-pressed` beside it, as
   * the hand-built groups did (their specs read either attribute); the look reads `aria-pressed` only. */
  @property({ type: Boolean }) radio = false;
  /** CR-CMP2-SEGMENTED-C-2450: which keys show their label beside their icon (a key without an icon always shows its label). */
  @property({ reflect: true }) labels: 'all' | 'chosen' | 'none' = 'all';
  /** CR-CMP2-SEGMENTED-C-2450: one Tab stop (the chosen key); the arrow keys choose as they move (see the class comment). */
  @property({ type: Boolean }) roving = false;

  static styles = css`
    :host {
      display: inline-flex;
      flex: none;
      max-inline-size: 100%;
      vertical-align: middle;
    }
    :host([hidden]) {
      display: none;
    }
    :host([block]) {
      display: flex;
      flex: 1 1 auto;
    }
    .seg {
      display: inline-flex;
      flex-wrap: wrap;
      inline-size: 100%;
      max-inline-size: 100%;
      box-sizing: border-box;
      border: 1px solid var(--sw-seg-border, transparent);
      border-radius: var(--sw-seg-radius, var(--sw-r-md));
      background: var(--sw-seg-track, var(--sw-surface-3));
      padding: var(--sw-seg-pad, 3px);
      gap: var(--sw-seg-gap, 2px);
    }
    :host([block]) .seg {
      display: flex;
      inline-size: 100%;
    }
    button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-sizing: border-box;
      min-block-size: var(--sw-seg-h, 34px);
      padding: 0 var(--sw-seg-key-pad, 14px);
      border: 0;
      border-radius: var(--sw-seg-btn-radius, var(--sw-r-sm));
      background: transparent;
      color: var(--sw-seg-fg, var(--sw-text-2));
      font: inherit;
      font-size: var(--sw-seg-fs, var(--sw-fs-md));
      font-weight: var(--sw-seg-fw, var(--sw-fw-semibold));
      min-inline-size: var(--sw-seg-key-min-w, 0);
      line-height: 1.2;
      white-space: nowrap;
      /* a host that stretches the control (a phone row) may let the keys share the line: --sw-seg-key-flex: 1 1 auto */
      flex: var(--sw-seg-key-flex, 0 1 auto);
      cursor: pointer;
      transition:
        transform var(--sw-t-press, 120ms) var(--sw-ease),
        background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        box-shadow var(--sw-t-hover, 120ms) var(--sw-ease-color, ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    :host([size='sm']) button {
      min-block-size: var(--sw-seg-h, 28px);
      padding: 0 var(--sw-seg-key-pad, 10px);
      font-size: var(--sw-seg-fs, var(--sw-fs-sm));
    }
    :host([block]) button {
      flex: 1 1 0;
      min-inline-size: 0;
    }
    button + button {
      border-inline-start: var(--sw-seg-divider, 0 solid transparent);
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not([aria-pressed='true']):not(:disabled) {
        background: var(--sw-hover-wash);
        color: var(--sw-text);
      }
    }
    button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale, 1));
    }
    .seg button[aria-pressed='true'] .n {
      background: var(--sw-seg-count-on-bg, var(--sw-seg-count-bg, color-mix(in srgb, currentColor 14%, transparent)));
    }
    .seg button[aria-pressed='true'] {
      /* GATE2370-B: in dark the chosen key is the light pill (--sw-seg-key / --sw-seg-key-ink) - 3:1 from the track (WCAG 1.4.11) */
      background: var(--sw-seg-on-bg, var(--sw-seg-key, var(--sw-surface)));
      color: var(--sw-seg-on-fg, var(--sw-seg-key-ink, var(--sw-accent-text)));
      box-shadow: var(--sw-seg-on-shadow, var(--sw-seg-thumb-shadow, var(--sw-shadow-1)));
      font-weight: var(--sw-seg-on-fw, var(--sw-seg-fw, var(--sw-fw-semibold)));
    }
    button:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: -2px;
    }
    button:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: not-allowed;
    }
    /* CR-CMP2-SEGMENTED-C-2450: rich keys - an icon, a second line, a badge, a dimmed key */
    .seg {
      flex-direction: var(--sw-seg-axis, row);
      /* a host that scrolls a long strip sideways itself (a glass toolbar on a phone) keeps it on one line: --sw-seg-wrap: nowrap */
      flex-wrap: var(--sw-seg-wrap, wrap);
    }
    .ic {
      display: inline-flex;
      flex: none;
      align-items: center;
      line-height: 0;
    }
    /* the app's inline icon (components/icon-paths.ts iconSvg: a stroked 24-unit glyph sized by the font) - the host's own svg.ic rule
       does not reach into this shadow root, so the same rule stands here; an sw-icon sizes itself */
    .ic > svg.ic {
      inline-size: var(--sw-seg-icon-size, 1em);
      block-size: var(--sw-seg-icon-size, 1em);
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    button.ico {
      padding-inline: var(--sw-seg-ico-pad, 8px);
      min-inline-size: max(var(--sw-seg-key-min-w, 0px), var(--sw-seg-h, 34px));
    }
    :host([size='sm']) button.ico {
      min-inline-size: max(var(--sw-seg-key-min-w, 0px), var(--sw-seg-h, 28px));
    }
    button.two {
      flex-direction: var(--sw-seg-key-axis, column);
      justify-content: var(--sw-seg-key-justify, center);
      align-items: var(--sw-seg-key-align, center);
      gap: 1px 8px;
      padding-block: 6px;
      white-space: normal;
      text-align: var(--sw-seg-text-align, center);
    }
    button.two .l,
    .sub {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .sub {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-seg-sub-fg, var(--sw-text-3));
    }
    button.dim .l {
      color: var(--sw-seg-dim-fg, var(--sw-text-3));
    }
    button.dim .sub {
      color: var(--sw-seg-dim-sub-fg, var(--sw-warning-text));
    }
    .badge {
      font-size: var(--sw-fs-2xs, 11px);
      font-weight: var(--sw-fw-semibold);
      padding: 1px 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-seg-badge-bg, var(--sw-accent-soft));
      color: var(--sw-seg-badge-fg, var(--sw-accent-text));
    }
    .n {
      font-size: var(--sw-seg-count-fs, var(--sw-fs-2xs, 11px));
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      min-inline-size: var(--sw-seg-count-min-w, 18px);
      padding: var(--sw-seg-count-pad, 1px 5px);
      box-sizing: border-box;
      border-radius: var(--sw-r-pill);
      background: var(--sw-seg-count-bg, color-mix(in srgb, currentColor 14%, transparent));
      text-align: center;
    }
    /* UIPOLISH-2320 rule (sw-toggle): on a phone the key keeps a 44 px tall touch target, grown in the block axis only */
    @media (max-width: 767px) and (pointer: coarse) {
      button::before {
        content: '';
        position: absolute;
        inset-inline: 0;
        inset-block: min(0px, calc((var(--sw-seg-h, 34px) - 44px) / 2));
      }
      :host([size='sm']) button::before {
        inset-block: min(0px, calc((var(--sw-seg-h, 28px) - 44px) / 2));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition-duration: 0ms;
      }
    }
  `;

  /** The keys (rendered), in order. */
  private get keys(): HTMLButtonElement[] {
    return [...(this.renderRoot?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  }

  /** CR-CMP2-SEGMENTED-C-2450: focusing the element focuses its chosen key (else the first enabled one), so a host that moves the
   * focus to the group itself (a menu's Tab trap) lands on a key. */
  override focus(options?: FocusOptions) {
    const keys = this.keys;
    const i = segmentedTabStop(this.options.map((o) => o.value), this.value, keys.map((k) => !k.disabled));
    if (i >= 0) keys[i].focus(options);
  }

  private press(o: SegmentOption<V>) {
    if (this.disabled || o.disabled) return;
    this.dispatchEvent(new CustomEvent<SegmentedChange<V>>('change', { detail: { value: o.value }, bubbles: true, composed: true }));
  }

  private onKey(e: KeyboardEvent) {
    const keys = this.keys;
    const from = keys.indexOf(e.target as HTMLButtonElement);
    if (from < 0) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const to = segmentedFocusStep(e.key, from, keys.map((k) => !k.disabled), rtl);
    if (to < 0) return;
    e.preventDefault();
    keys[to].focus();
    // a roving group chooses as it moves (the radio rule); the host confirms by re-rendering `value`, and the Tab stop follows it
    const o = this.options[to];
    if (this.roving && o && o.value !== this.value) this.press(o);
  }

  /** Sets the data-* hooks given on an element (and removes the ones an option dropped). */
  private static hooks(el: Element | null | undefined, want: Readonly<Record<string, string>>) {
    if (!el) return;
    for (const a of [...el.attributes]) if (a.name.startsWith('data-') && !(a.name in want)) el.removeAttribute(a.name);
    for (const [name, v] of Object.entries(want)) if (el.getAttribute(name) !== v) el.setAttribute(name, v);
  }

  protected updated(changed: PropertyValues) {
    if (!changed.has('options') && !changed.has('value') && !changed.has('labels')) return;
    // the screens' data-* hooks: set on the keys (and their badges) as given. `value` too: a badge comes and goes with the choice.
    const keys = this.keys;
    this.options.forEach((o, i) => {
      const k = keys[i];
      if (!k) return;
      SwSegmented.hooks(k, o.attrs ?? {});
      SwSegmented.hooks(k.querySelector('.badge'), o.badgeAttrs ?? {});
    });
  }

  render() {
    const radio = this.radio;
    const enabled = this.options.map((o) => !(this.disabled || o.disabled));
    const stop = this.roving ? segmentedTabStop(this.options.map((o) => o.value), this.value, enabled) : -1;
    return html`<div class="seg" part="track" role=${radio ? 'radiogroup' : 'group'} aria-label=${this.label || nothing} @keydown=${this.onKey}>
      ${this.options.map((o, i) => {
        const on = o.value === this.value;
        // an icon key shows its label unless the group says otherwise; a key without an icon always shows it
        const shown = !o.icon || this.labels === 'all' || (this.labels === 'chosen' && on);
        const cls = [o.icon && !shown ? 'ico' : '', o.sub ? 'two' : '', o.dimmed ? 'dim' : ''].filter(Boolean).join(' ');
        return html`<button type="button" part=${on ? 'key key-on' : 'key'} class=${cls || nothing} aria-pressed=${on ? 'true' : 'false'} role=${radio ? 'radio' : nothing} aria-checked=${radio ? String(on) : nothing}
          ?disabled=${!enabled[i]} title=${o.title || (shown ? nothing : o.label)} aria-label=${shown ? nothing : o.label}
          tabindex=${this.roving ? (i === stop ? '0' : '-1') : nothing}
          @click=${() => this.press(o)}>${o.icon ? html`<span class="ic" part=${on ? 'icon icon-on' : 'icon'} aria-hidden="true">${o.icon}</span>` : nothing}${shown ? html`<span class="l" part="label">${o.label}</span>` : nothing}${o.sub ? html`<small class="sub" part="sub">${o.sub}</small>` : nothing}${o.badge ? html`<span class="badge" part="badge">${o.badge}</span>` : nothing}${o.count ? html`<small class="n">${o.count}</small>` : nothing}</button>`;
      })}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-segmented': SwSegmented;
  }
}
