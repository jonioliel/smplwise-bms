import { css } from 'lit';
import { applyDevicesPrefs, DEVICES_PREFS_DEFAULT, loadDevicesPrefs, devicesStyleTokens, type DevicesPrefs } from '../screens/devices-style';
import { currentSkin, onDesign } from '../design/apply';

/**
 * CR-015: the look of the multimedia screens and the remote - ALWAYS the glass style (owner decision 14a, the remote is built
 * around the material), light or dark by the installation's `devices.scheme` (13a), whatever `devices.style` says.
 *
 * It stands on the device-screen theme layer (styles/devices-themes.ts + devices-palettes.ts: the `--dv-*` knobs, bridged to
 * the v2 `--sw-*` tokens, so every shared component inside follows by inheritance) and adds the knobs the approved mockup
 * (docs/design/mockups/media/index.html v2, "PROPOSED" block) needs for the media material: `--mm-*`. Those knobs are the
 * palette-independent part of the media look - sheen, art glow, the sheet, the physical remote's keys and d-pad - with a light
 * block, a dark block (host attribute `data-devices-scheme="dark"`, never the OS scheme) and phone sizes. A designer who
 * wants another media theme edits this one file (and the `--dv-*` palette it stands on); no screen changes.
 *
 * Every component of the media area (screens page, screen card, bulk dialog, the remote and the area card of S3) puts
 * `mediaGlassStyles` first in its `static styles` and calls `applyMediaGlass(this)` when it connects: the host then carries
 * `data-devices-style="glass"` plus the installation's palette and scheme, and every rule below reads knobs only.
 * DomusUI (GPL-3.0) informed the ideas only; no code or CSS of it is used.
 */

/** The media knobs (`--mm-*`), documented. Keep in step with the blocks below. */
export const MEDIA_KNOBS: Record<string, string> = {
  '--mm-sheen': 'the top highlight laid over every glass panel',
  '--mm-accent-glow': 'the soft shadow of the accent (power button on, primary button)',
  '--mm-text-inverse': 'text on the dark chip of a selected room / on the accent',
  '--mm-fs-page-title': 'the large page title; --mm-fs-page-title-compact when the header is stuck',
  '--mm-art-glow-blur': 'blur of the now-showing colour glow behind a lit card',
  '--mm-art-glow-alpha': 'opacity of that glow; --mm-art-halo-alpha the card\'s outer halo',
  '--mm-art-veil': 'the veil between the glow and the card text',
  '--mm-screen-off': 'fill of the screen thumbnail when the screen is off',
  '--mm-sheet-surface': 'the remote panel / dialog / menu surface (more opaque than a card)',
  '--mm-sheet-blur': 'its blur; --mm-sheet-w the remote panel\'s width',
  '--mm-seg-thumb': 'the selected segment\'s thumb',
  '--mm-key-size': 'the round keys of the remote; --mm-key-bg / --mm-key-fg / --mm-key-shadow their material',
  '--mm-remote-body': 'the remote body\'s glass',
  '--mm-dpad-size': 'the d-pad; --mm-dpad-ring / --mm-dpad-shadow / --mm-dpad-groove / --mm-ok-bg its material',
  '--mm-rocker-w': 'the volume / channel rocker\'s width',
  '--mm-motion': 'the one transition duration; --mm-ease its curve',
  '--mm-cover-size': 'CR-016: the square cover of a player card (--mm-cover-radius its corners, --mm-cover-shadow its glow shadow)',
  '--mm-tkey-size': 'CR-016: the transport keys of a player (--mm-tkey-main-size the play / pause key); --mm-member-row-h a group member row',
};

export const mediaGlassKnobs = css`
  :host([data-devices-style='glass']) {
    --mm-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 46%);
    --mm-accent-glow: rgba(0, 122, 255, 0.3);
    --mm-text-inverse: #ffffff;
    --mm-fs-page-title: 44px;
    --mm-fs-page-title-compact: 24px;
    --mm-art-glow-blur: 46px;
    --mm-art-glow-alpha: 0.5;
    --mm-art-halo-alpha: 0.2;
    --mm-art-veil: rgba(255, 255, 255, 0.38);
    --mm-screen-off: linear-gradient(155deg, rgba(120, 120, 128, 0.2), rgba(120, 120, 128, 0.08));
    --mm-sheet-surface: rgba(248, 250, 253, 0.84);
    --mm-sheet-blur: blur(40px) saturate(1.8);
    --mm-sheet-w: 440px;
    --mm-seg-thumb: #ffffff;
    --mm-key-size: 52px;
    --mm-key-bg: linear-gradient(180deg, #ffffff, #eef1f6);
    --mm-key-fg: #1c1c1e;
    --mm-key-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 1px 2px rgba(31, 45, 80, 0.12), 0 4px 12px rgba(31, 45, 80, 0.08), 0 0 0 1px rgba(60, 60, 67, 0.1);
    --mm-remote-body: linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.4));
    --mm-dpad-size: 216px;
    --mm-rocker-w: 62px;
    --mm-dpad-ring: radial-gradient(circle at 50% 28%, #ffffff 0%, #f2f5f9 55%, #e3e8f0 100%);
    --mm-dpad-shadow: 0 16px 36px rgba(31, 45, 80, 0.16), inset 0 1px 0 #fff, inset 0 -8px 18px rgba(31, 45, 80, 0.06), 0 0 0 1px rgba(60, 60, 67, 0.1);
    --mm-dpad-groove: inset 0 2px 6px rgba(31, 45, 80, 0.16), inset 0 -1px 0 rgba(255, 255, 255, 0.9);
    --mm-ok-bg: linear-gradient(180deg, #ffffff, #edf1f6);
    --mm-motion: 240ms;
    --mm-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --mm-hit: 44px;
    --mm-cover-size: 104px;
    --mm-cover-radius: 18px;
    --mm-cover-shadow: 0 12px 28px rgb(var(--art, 20 24 34) / 0.32);
    --mm-tkey-size: 48px;
    --mm-tkey-main-size: 66px;
    --mm-member-row-h: 52px;
  }
  :host([data-devices-style='glass'][data-devices-scheme='dark']) {
    --mm-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.015) 50%);
    --mm-accent-glow: rgba(10, 132, 255, 0.45);
    --mm-text-inverse: #1c1c1e;
    --mm-art-glow-alpha: 0.62;
    --mm-art-halo-alpha: 0.3;
    --mm-art-veil: rgba(18, 18, 20, 0.34);
    --mm-screen-off: linear-gradient(155deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025));
    --mm-sheet-surface: rgba(22, 22, 25, 0.84);
    --mm-seg-thumb: rgba(118, 118, 128, 0.5);
    --mm-key-bg: linear-gradient(180deg, rgba(78, 78, 84, 0.95), rgba(50, 50, 54, 0.95));
    --mm-key-fg: #f5f5f7;
    --mm-key-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06);
    --mm-remote-body: linear-gradient(180deg, rgba(58, 58, 62, 0.55), rgba(30, 30, 33, 0.35));
    --mm-dpad-ring: radial-gradient(circle at 50% 28%, #3b3b40 0%, #2a2a2e 58%, #1d1d20 100%);
    --mm-dpad-shadow: 0 18px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -8px 18px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.07);
    --mm-dpad-groove: inset 0 2px 8px rgba(0, 0, 0, 0.6), inset 0 -1px 0 rgba(255, 255, 255, 0.07);
    --mm-ok-bg: linear-gradient(180deg, #4b4b51, #323236);
    --mm-cover-shadow: 0 14px 32px rgb(var(--art, 0 0 0) / 0.45);
  }
  @media (max-width: 767px) {
    :host([data-devices-style='glass']) {
      --mm-fs-page-title: 32px;
      --mm-fs-page-title-compact: 20px;
      --mm-dpad-size: 196px;
      --mm-rocker-w: 56px;
      --mm-key-size: 50px;
      --mm-cover-size: 84px;
      --mm-cover-radius: 16px;
      --mm-tkey-size: 46px;
      --mm-tkey-main-size: 62px;
    }
  }
  /* no backdrop-filter, or the viewer asked for less transparency: solid sheets, same layout */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    :host([data-devices-style='glass']) {
      --mm-sheet-surface: var(--dv-surface-solid);
      --mm-sheet-blur: none;
    }
  }
  @media (prefers-reduced-transparency: reduce) {
    :host([data-devices-style='glass']) {
      --mm-sheet-surface: var(--dv-surface-solid);
      --mm-sheet-blur: none;
    }
  }
`;

/**
 * The shared element rules (rules read knobs only): glass panels, buttons, segments, toggles, round keys, the power button,
 * the volume rocker, chips, popovers, skeletons and states. Used by the screen card, the page, the bulk dialog and S3's remote.
 */
export const mediaGlassControls = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  button,
  input,
  select {
    font: inherit;
    color: inherit;
  }
  button {
    cursor: pointer;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  .n {
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
    font-variant-numeric: tabular-nums;
  }
  svg.ic {
    inline-size: 1em;
    block-size: 1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex: none;
    vertical-align: middle;
  }
  .vh {
    position: absolute !important;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .grow {
    flex: 1;
  }
  .glass {
    background: var(--mm-sheen), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    border: 1px solid var(--dv-border);
    border-radius: var(--dv-radius-md);
    box-shadow: var(--dv-shadow-1);
  }
  /* buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-block-size: 38px;
    padding-inline: 16px;
    border-radius: var(--dv-radius-control);
    border: 1px solid var(--dv-border);
    background: var(--mm-sheen), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    color: var(--dv-text);
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    box-shadow: var(--dv-shadow-control);
    transition: background var(--mm-motion) var(--mm-ease), transform 120ms var(--mm-ease);
  }
  .btn:hover {
    background: var(--mm-sheen), var(--dv-surface-solid);
  }
  a.btn {
    text-decoration: none;
  }
  .btn:active {
    transform: scale(0.97);
  }
  .btn .ic {
    font-size: 16px;
  }
  .btn.sm {
    min-block-size: 34px;
    padding-inline: 13px;
    font-size: 12.5px;
    gap: 6px;
  }
  .btn.sm .ic {
    font-size: 14px;
  }
  .btn.primary {
    background: var(--dv-accent);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 6px 16px var(--mm-accent-glow);
  }
  .btn.primary:hover {
    background: var(--dv-accent-hover);
  }
  .btn.quiet {
    box-shadow: none;
    background: var(--dv-surface-2);
  }
  .btn.quiet .ic {
    color: var(--dv-text-2);
  }
  .btn.quiet.dz .ic {
    color: var(--dv-danger);
  }
  .btn.danger {
    background: var(--dv-danger);
    border-color: transparent;
    color: #fff;
    box-shadow: none;
  }
  .btn[disabled] {
    opacity: 0.45;
    pointer-events: none;
  }
  /* segmented control */
  .seg {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--dv-surface-3);
    border-radius: var(--dv-radius-control);
    padding: 3px;
    max-inline-size: 100%;
  }
  .seg button {
    border: 0;
    background: transparent;
    border-radius: var(--dv-radius-control);
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--dv-text);
    min-block-size: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
    transition: background var(--mm-motion) var(--mm-ease), color var(--mm-motion);
  }
  .seg button[aria-selected='true'],
  .seg button[aria-pressed='true'],
  .seg button[aria-checked='true'] {
    background: var(--mm-seg-thumb);
    box-shadow: var(--dv-shadow-control);
  }
  .seg button small {
    font-size: 11px;
    color: var(--dv-text-2);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .seg button[aria-selected='true'] small,
  .seg button[aria-pressed='true'] small,
  .seg button[aria-checked='true'] small {
    color: var(--dv-text);
  }
  .seg.sm button {
    padding: 4px 12px;
    min-block-size: 30px;
    font-size: 12.5px;
  }
  /* switch */
  .tog {
    position: relative;
    flex: none;
    inline-size: 46px;
    block-size: 28px;
    border-radius: 999px;
    background: var(--dv-surface-3);
    border: 0;
    padding: 0;
    transition: background var(--mm-motion);
  }
  .tog::after {
    content: '';
    position: absolute;
    inset-block-start: 2px;
    inset-inline-start: 2px;
    inline-size: 24px;
    block-size: 24px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.28);
    transition: inset-inline-start var(--mm-motion) var(--mm-ease);
  }
  .tog[aria-checked='true'] {
    background: var(--dv-toggle-on);
  }
  .tog[aria-checked='true']::after {
    inset-inline-start: 20px;
  }
  /* round keys, the power button, the volume rocker, the remote button */
  .rb {
    position: relative;
    flex: none;
    inline-size: 40px;
    block-size: 40px;
    border-radius: 50%;
    border: 0;
    display: grid;
    place-items: center;
    background: var(--mm-key-bg);
    color: var(--mm-key-fg);
    box-shadow: var(--mm-key-shadow);
    transition: transform 120ms var(--mm-ease), box-shadow var(--mm-motion), color var(--mm-motion);
  }
  .rb .ic {
    font-size: 18px;
  }
  .rb:active {
    transform: scale(0.92);
  }
  .rb.muted {
    background: var(--dv-danger-soft);
    color: var(--dv-danger);
    box-shadow: inset 0 0 0 1px var(--dv-danger-soft);
  }
  .rb[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }
  .pw {
    position: relative;
    flex: none;
    inline-size: 44px;
    block-size: 44px;
    border-radius: 50%;
    border: 0;
    display: grid;
    place-items: center;
    background: var(--mm-key-bg);
    color: var(--dv-text-2);
    box-shadow: var(--mm-key-shadow);
    transition: transform 120ms var(--mm-ease), background var(--mm-motion), box-shadow var(--mm-motion);
  }
  .pw .ic {
    font-size: 19px;
    stroke-width: 2;
  }
  .pw.on {
    background: var(--dv-accent);
    color: #fff;
    box-shadow: 0 6px 18px var(--mm-accent-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  .pw:active {
    transform: scale(0.92);
  }
  .pw[disabled] {
    opacity: 0.38;
    pointer-events: none;
    box-shadow: none;
  }
  .pw.nack {
    box-shadow: 0 0 0 3px var(--dv-danger-soft), 0 0 0 1.5px var(--dv-danger);
  }
  @keyframes mm-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .pw.pend::after {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: var(--dv-accent);
    animation: mm-spin 0.8s linear infinite;
  }
  @keyframes mm-shake {
    20%,
    60% {
      transform: translateX(-3px);
    }
    40%,
    80% {
      transform: translateX(3px);
    }
  }
  .shake {
    animation: mm-shake 260ms linear;
  }
  .vrock {
    display: inline-flex;
    align-items: center;
    gap: 0;
    block-size: 40px;
    padding: 3px;
    border-radius: var(--dv-radius-control);
    background: var(--dv-surface-3);
    flex: none;
  }
  .vrock button {
    inline-size: 34px;
    block-size: 34px;
    border-radius: 50%;
    border: 0;
    background: transparent;
    display: grid;
    place-items: center;
    color: var(--dv-text);
    transition: background var(--mm-motion), transform 120ms;
  }
  .vrock button:hover {
    background: var(--mm-seg-thumb);
    box-shadow: var(--dv-shadow-control);
  }
  .vrock button:active {
    transform: scale(0.9);
  }
  .vrock button[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }
  .vrock button .ic {
    font-size: 16px;
  }
  .vrock .vv {
    min-inline-size: 30px;
    text-align: center;
    font-weight: 700;
    font-size: 13.5px;
    font-variant-numeric: tabular-nums;
  }
  .vrock.muted .vv {
    color: var(--dv-text-3);
    text-decoration: line-through;
  }
  .rbtn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    block-size: 40px;
    padding-inline: 14px 16px;
    border-radius: var(--dv-radius-control);
    border: 0;
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
    font-weight: 600;
    font-size: 13.5px;
    flex: none;
    transition: background var(--mm-motion), transform 120ms;
  }
  .rbtn:hover {
    background: color-mix(in srgb, var(--dv-accent) 22%, transparent);
  }
  .rbtn:active {
    transform: scale(0.96);
  }
  .rbtn .ic {
    font-size: 17px;
  }
  .chipx {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    block-size: 30px;
    padding-inline: 12px;
    border-radius: var(--dv-radius-control);
    background: var(--dv-surface-2);
    border: 1px solid var(--dv-border);
    font-size: 12.5px;
    font-weight: 500;
    color: var(--dv-text-2);
    white-space: nowrap;
  }
  .pilld {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    block-size: 24px;
    padding-inline: 10px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.4);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #fff;
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
  }
  .pilld i {
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background: #30d158;
    box-shadow: 0 0 8px #30d158;
  }
  .pilld .ic {
    font-size: 12px;
  }
  /* popover menu (floor menu, source menu) */
  @keyframes mm-pop {
    from {
      transform: scale(0.96);
      opacity: 0;
    }
  }
  .pop {
    position: absolute;
    z-index: 25;
    min-inline-size: 230px;
    /* a menu sits inside glass panels (a nested backdrop-filter cannot blur what lies beyond its parent): near-solid */
    background: color-mix(in srgb, var(--dv-surface-solid) 96%, transparent);
    max-block-size: min(60vh, 440px);
    overflow-y: auto;
    border: 1px solid var(--dv-border);
    border-radius: 18px;
    box-shadow: var(--dv-shadow-3);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--dv-text);
    animation: mm-pop 180ms var(--mm-ease);
  }
  .pop button {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    background: transparent;
    border-radius: 12px;
    padding: 9px 10px;
    text-align: start;
    font-size: 13.5px;
    font-weight: 500;
    min-block-size: 44px;
  }
  .pop button:hover {
    background: var(--dv-surface-3);
  }
  .pop button .ic {
    font-size: 17px;
    color: var(--dv-text-2);
  }
  .pop button[aria-checked='true'] {
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
    font-weight: 600;
  }
  .pop button[aria-checked='true'] .ic {
    color: var(--dv-accent-text);
  }
  .pop .ck {
    margin-inline-start: auto;
  }
  .pop .cnt {
    margin-inline-start: auto;
    font-size: 12px;
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
  }
  .pop hr {
    border: 0;
    border-block-start: 1px solid var(--dv-border);
    margin: 4px 6px;
  }
  /* skeleton, states */
  @keyframes mm-shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
  .skl {
    background: linear-gradient(90deg, var(--dv-surface-3) 0%, var(--dv-surface-2) 50%, var(--dv-surface-3) 100%);
    background-size: 200% 100%;
    animation: mm-shimmer 1.6s linear infinite;
    border-radius: 12px;
    display: block;
  }
  .statebox {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 64px 24px;
  }
  .statebox .ring {
    inline-size: 72px;
    block-size: 72px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
    font-size: 32px;
    margin-block-end: 4px;
  }
  .statebox b {
    font-size: 18px;
    font-weight: 600;
  }
  .errbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 8px 8px 16px;
    padding-inline: 16px 8px;
    border-radius: var(--dv-radius-md);
    background: linear-gradient(var(--dv-danger-soft), var(--dv-danger-soft)), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    border: 1px solid color-mix(in srgb, var(--dv-danger) 30%, transparent);
    color: var(--dv-text);
    font-size: 13.5px;
    font-weight: 500;
  }
  .errbar > .ic {
    color: var(--dv-danger);
    font-size: 18px;
  }
  .errbar .btn {
    margin-inline-start: auto;
  }
  .editbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px 12px;
    padding-inline: 16px 10px;
    border-radius: var(--dv-radius-md);
    background: var(--mm-sheen), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    border: 1px solid color-mix(in srgb, var(--dv-accent) 45%, transparent);
    box-shadow: var(--dv-shadow-1), 0 0 0 4px var(--dv-accent-soft);
  }
  .editbar .t {
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .editbar .t .ic {
    color: var(--dv-accent-text);
    font-size: 17px;
  }
  /* the now-showing "poster": a gradient of our own hue and a neutral glyph (never a logo, never a brand colour) */
  .art {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(135deg, var(--a1), var(--a2));
    overflow: hidden;
  }
  .art::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.3), transparent 45%), radial-gradient(circle at 10% 110%, rgba(0, 0, 0, 0.35), transparent 55%);
  }
  .art .gl {
    position: absolute;
    inset-inline-end: -2%;
    inset-block-start: -6%;
    inline-size: 60%;
    block-size: auto;
    aspect-ratio: 1;
    color: rgba(255, 255, 255, 0.16);
    stroke-width: 1.1;
  }
  .art .ch {
    position: absolute;
    inset-block-start: 8%;
    inset-inline-end: 8%;
    font-size: 68px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: rgba(255, 255, 255, 0.22);
    direction: ltr;
  }
  .art img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  .art.frameart {
    background: linear-gradient(160deg, #efe6d6, #e2d3bb);
  }
  .art.frameart::before {
    background: none;
  }
  .art.frameart svg {
    position: absolute;
    inset: 10% 16%;
    inline-size: 68%;
    block-size: 80%;
  }
  .art.saver {
    background: radial-gradient(circle at 70% 30%, #2b3656, #0b0f19 70%);
  }
  .art.saver::before {
    background: radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 60% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 80% 70%, #fff, transparent), radial-gradient(1px 1px at 35% 75%, #fff, transparent);
    opacity: 0.6;
  }
  @media (prefers-reduced-motion: reduce) {
    .skl,
    .pw.pend::after {
      animation-duration: 3s;
    }
    .shake {
      animation: none;
    }
  }
  /* touch: every control is a 44 px target (the owner's operator-screen rule) */
  @media (pointer: coarse), (max-width: 767px) {
    .btn,
    .btn.sm {
      min-block-size: 44px;
    }
    .seg button,
    .seg.sm button {
      min-block-size: 44px;
    }
    .rb {
      inline-size: 44px;
      block-size: 44px;
    }
    .rbtn {
      block-size: 44px;
    }
    .vrock {
      block-size: 50px;
    }
    .vrock button {
      inline-size: 44px;
      block-size: 44px;
    }
    .tog {
      inline-size: 50px;
      block-size: 30px;
    }
  }
`;

/**
 * The Bubble skin (phase C, 2026-10-02; the approved board docs/design/mockups/bubble-taste/media.html): every knob the media
 * components read is pointed at the product's `--sw-*` tokens, so the pages, the cards and the dialogs follow the skin and ITS
 * scheme (light / dark by `data-theme`, not by `devices.scheme`): flat pills, no sheen, no glass blur on scrolling lists (the
 * phone performance rule), pill radii, the sheet translucent at the transparency dial. Keyed on the host's `data-skin`, which
 * applyMediaGlass mirrors from the design layer; declared after the dark block so it wins at equal specificity.
 */
export const mediaBubbleKnobs = css`
  :host([data-skin='bubble'][data-devices-style='glass']) {
    /* the glass bridge (devices-themes.ts) rewrites these --sw-* names from the --dv-* knobs; here the knobs are the --sw-* names,
       so the bridge is undone first (inherit = the page's own tokens) or every pair would be a cycle */
    --sw-glass-blur: inherit;
    --sw-bg: inherit;
    --sw-surface: inherit;
    --sw-surface-2: inherit;
    --sw-surface-3: inherit;
    --sw-border: inherit;
    --sw-border-strong: inherit;
    --sw-overlay: inherit;
    --sw-text: inherit;
    --sw-heading: inherit;
    --sw-text-2: inherit;
    --sw-text-3: inherit;
    --sw-accent: inherit;
    --sw-accent-hover: inherit;
    --sw-accent-soft: inherit;
    --sw-accent-text: inherit;
    --sw-focus: inherit;
    --sw-live: inherit;
    --sw-live-soft: inherit;
    --sw-success: inherit;
    --sw-success-soft: inherit;
    --sw-warning: inherit;
    --sw-warning-soft: inherit;
    --sw-stale: inherit;
    --sw-stale-soft: inherit;
    --sw-danger: inherit;
    --sw-danger-soft: inherit;
    --sw-offline: inherit;
    --sw-offline-soft: inherit;
    --sw-unknown-soft: inherit;
    --sw-recorded-soft: inherit;
    --sw-r-sm: inherit;
    --sw-r-md: inherit;
    --sw-r-lg: inherit;
    --sw-r-pill: inherit;
    --sw-shadow-1: inherit;
    --sw-shadow-2: inherit;
    --sw-shadow-3: inherit;
    --sw-font: inherit;
    color-scheme: inherit;
    --dv-color-scheme: inherit;
    --dv-backdrop: transparent;
    --dv-surface: var(--sw-surface);
    --dv-surface-2: var(--sw-surface-2);
    --dv-surface-3: var(--sw-surface-3);
    --dv-surface-solid: var(--sw-surface-solid);
    --dv-surface-2-solid: var(--sw-surface-2-solid);
    --dv-surface-blur: none;
    --dv-border: transparent;
    --dv-border-strong: var(--sw-border-strong);
    --dv-overlay: var(--sw-overlay);
    --dv-font: var(--sw-font);
    --dv-text: var(--sw-text);
    --dv-text-2: var(--sw-text-2);
    --dv-text-3: var(--sw-text-3);
    --dv-accent: var(--sw-accent);
    --dv-accent-hover: var(--sw-accent-hover);
    --dv-accent-soft: var(--sw-accent-soft);
    --dv-accent-text: var(--sw-accent-text);
    --dv-focus: var(--sw-focus);
    --dv-success: var(--sw-success);
    --dv-success-soft: var(--sw-success-soft);
    --dv-warning: var(--sw-warning);
    --dv-warning-soft: var(--sw-warning-soft);
    --dv-warning-text: var(--sw-warning-text);
    --dv-danger: var(--sw-danger);
    --dv-danger-soft: var(--sw-danger-soft);
    --dv-neutral-soft: var(--sw-unknown-soft);
    --dv-radius-sm: var(--sw-r-md);
    --dv-radius-md: var(--sw-r-lg);
    --dv-radius-lg: var(--sw-r-xl);
    --dv-radius-control: var(--sw-r-pill);
    --dv-shadow-1: none;
    --dv-shadow-2: none;
    --dv-shadow-3: var(--sw-shadow-3);
    --dv-shadow-control: none;
    --dv-toggle-on: var(--sw-toggle-on);
    --dv-hover-lift: 0px;
    --mm-sheen: none;
    --mm-accent-glow: transparent;
    --mm-text-inverse: var(--sw-bg); /* text on a chip filled with --sw-text (the chosen room): the page colour, both schemes */
    --mm-fs-page-title: var(--sw-h1);
    --mm-fs-page-title-compact: var(--sw-fs-lg);
    --mm-art-glow-alpha: 0.42;
    --mm-art-halo-alpha: 0;
    --mm-art-veil: rgba(var(--sw-sheet-rgb), 0.3);
    --mm-screen-off: var(--sw-surface-2);
    --mm-sheet-surface: rgba(var(--sw-sheet-rgb), var(--sw-sheet-alpha));
    --mm-sheet-blur: var(--sw-glass-blur-sheet);
    --mm-seg-thumb: var(--sw-surface-solid);
    --mm-key-bg: var(--sw-surface-2);
    --mm-key-fg: var(--sw-text);
    --mm-key-shadow: none;
    --mm-remote-body: var(--sw-layer);
    --mm-dpad-ring: var(--sw-surface-2);
    --mm-dpad-shadow: none;
    --mm-dpad-groove: none;
    --mm-ok-bg: var(--sw-surface-solid);
    --mm-motion: var(--sw-t-med);
    --mm-ease: var(--sw-ease);
    --mm-cover-radius: var(--sw-r-media);
    --mm-cover-shadow: none;
  }
  @media (prefers-reduced-transparency: reduce) {
    :host([data-skin='bubble'][data-devices-style='glass']) {
      --mm-sheet-surface: var(--sw-surface-solid);
      --mm-sheet-blur: none;
    }
  }
  /* the bubble skin's targets: every control at least the desktop touch dial (44 / 32) and 44 px in touch layouts (the layout guard);
     the page header no longer sticks (a floating bar over the rows is the one thing the owner's rule forbids) */
  :host([data-skin='bubble']) .btn,
  :host([data-skin='bubble']) .btn.sm,
  :host([data-skin='bubble']) .seg button,
  :host([data-skin='bubble']) .seg.sm button,
  :host([data-skin='bubble']) .rc,
  :host([data-skin='bubble']) .floorbtn,
  :host([data-skin='bubble']) .search,
  :host([data-skin='bubble']) .shlink,
  :host([data-skin='bubble']) .pop button,
  :host([data-skin='bubble']) .rbtn,
  :host([data-skin='bubble']) .tog {
    min-block-size: var(--sw-touch-desktop, 44px);
    block-size: auto;
  }
  :host([data-skin='bubble']) .rb,
  :host([data-skin='bubble']) .pw,
  :host([data-skin='bubble']) .vrock button,
  :host([data-skin='bubble']) .rbtn,
  :host([data-skin='bubble']) .ecard button {
    min-inline-size: var(--sw-touch-desktop, 44px);
    min-block-size: var(--sw-touch-desktop, 44px);
  }
  :host([data-skin='bubble']) .vrock {
    block-size: auto;
    min-block-size: var(--sw-touch-desktop, 44px);
  }
  :host([data-skin='bubble']) .search input {
    min-block-size: var(--sw-touch-desktop, 44px);
  }
  :host([data-skin='bubble']) .dh {
    position: static;
    margin-inline: 0;
    padding-inline: 0;
  }
  :host([data-skin='bubble']) .dh::before {
    display: none;
  }
  :host([data-skin='bubble']) .dh.compact {
    background: transparent;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    border: 0;
    box-shadow: none;
    padding-block: 16px 4px;
  }
  :host([data-skin='bubble']) .dh.compact h1 {
    font-size: var(--mm-fs-page-title);
  }
  :host([data-skin='bubble']) .dh.compact .dh-det {
    max-block-size: 120px;
    opacity: 1;
    overflow: visible;
    margin-block-end: 0;
    pointer-events: auto;
  }
  :host([data-skin='bubble']) .dh.compact .rooms {
    display: flex;
  }
  :host([data-skin='bubble']) .rooms {
    padding-inline: 4px;
    -webkit-mask-image: none;
    mask-image: none;
  }
  @media (max-width: 1100px) {
    :host([data-skin='bubble']) .btn,
    :host([data-skin='bubble']) .btn.sm,
    :host([data-skin='bubble']) .seg button,
    :host([data-skin='bubble']) .rc,
    :host([data-skin='bubble']) .floorbtn,
    :host([data-skin='bubble']) .search,
    :host([data-skin='bubble']) .search input,
    :host([data-skin='bubble']) .shlink,
    :host([data-skin='bubble']) .pop button,
    :host([data-skin='bubble']) .rbtn,
    :host([data-skin='bubble']) .tog,
    :host([data-skin='bubble']) .vrock {
      min-block-size: 44px;
    }
    :host([data-skin='bubble']) .rb,
    :host([data-skin='bubble']) .pw,
    :host([data-skin='bubble']) .vrock button,
    :host([data-skin='bubble']) .rbtn,
    :host([data-skin='bubble']) .ecard button {
      min-inline-size: 44px;
      min-block-size: 44px;
    }
  }
`;

/** The style set every media component starts with: the device theme layer, the media knobs, the shared controls. */
export const mediaGlassStyles = [devicesStyleTokens, mediaGlassKnobs, mediaGlassControls, mediaBubbleKnobs];

/** Mirrors the skin in force onto a media host (`data-skin`) and follows every change while the host is connected. */
export function mirrorSkin(host: HTMLElement): void {
  const put = () => {
    const id = currentSkin();
    if (host.getAttribute('data-skin') !== id) host.setAttribute('data-skin', id);
  };
  put();
  const off = onDesign(() => {
    if (!host.isConnected) {
      off();
      return;
    }
    put();
  });
}

/** Puts the glass style (always), the installation's palette and scheme on a media component's host. The first paint
 * already carries the glass style in the default light scheme; the installation's scheme and palette follow when its
 * settings arrive (devices-style.ts loadDevicesPrefs: the shared settings cache, never throws). The skin (bubble) is
 * mirrored too: in the bubble skin the knobs follow the product tokens and the skin's own scheme. */
export function applyMediaGlass(host: HTMLElement): Promise<DevicesPrefs> {
  applyDevicesPrefs(host, { ...DEVICES_PREFS_DEFAULT, style: 'glass' });
  mirrorSkin(host);
  return loadDevicesPrefs().then((p) => {
    const prefs: DevicesPrefs = { ...p, style: 'glass' };
    if (host.isConnected) applyDevicesPrefs(host, prefs);
    return prefs;
  });
}
