import { css } from 'lit';

/**
 * CR-015 S3: the remote's look. Always glass (owner decision 14a) whatever `devices.style` says; light or dark by the
 * installation's `devices.scheme` (13a) through the host's `data-devices-scheme` attribute, set by `applyDevicesScheme`
 * (screens/devices-style.ts). The values are the approved mockup's v2 knobs (docs/design/mockups/media/index.html: the
 * "palette default" light and dark blocks plus its PROPOSED remote knobs), renamed `--mr-*` so the remote stays
 * self-contained wherever it is opened (screens page, area card, home widget) - a host that already defines the
 * `--mm-*` tokens of the screens page can alias them here without touching a component.
 *
 * Every rule below reads only these tokens (plus a few structural lengths); nothing is a literal colour except the four
 * colour keys, which ARE colours (the TV's red / green / yellow / blue buttons).
 */
export const remoteTokens = css`
  :host {
    --mr-text: #1c1c1e;
    --mr-text-2: #4c4c50;
    --mr-text-3: #6e6e73;
    --mr-text-inverse: #ffffff;
    --mr-surface: rgba(255, 255, 255, 0.64);
    --mr-surface-2: rgba(255, 255, 255, 0.5);
    --mr-surface-3: rgba(120, 120, 128, 0.14);
    --mr-surface-solid: #f7f9fc;
    --mr-border: rgba(60, 60, 67, 0.12);
    --mr-border-strong: rgba(60, 60, 67, 0.22);
    --mr-accent: #007aff;
    --mr-accent-hover: #0066d6;
    --mr-accent-soft: rgba(0, 122, 255, 0.13);
    --mr-accent-text: #0062cc;
    --mr-accent-glow: rgba(0, 122, 255, 0.3);
    --mr-focus: #007aff;
    --mr-success: #34c759;
    --mr-danger: #d70015;
    --mr-danger-soft: rgba(255, 59, 48, 0.13);
    --mr-warning: #b25000;
    --mr-seg-thumb: #ffffff;
    --mr-shadow-control: 0 1px 4px rgba(0, 0, 0, 0.18);
    --mr-shadow-3: 0 24px 64px rgba(15, 23, 42, 0.26);
    --mr-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 46%);
    --mr-key-size: 52px;
    --mr-key-bg: linear-gradient(180deg, #ffffff, #eef1f6);
    --mr-key-fg: #1c1c1e;
    --mr-key-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 1px 2px rgba(31, 45, 80, 0.12), 0 4px 12px rgba(31, 45, 80, 0.08), 0 0 0 1px rgba(60, 60, 67, 0.1);
    --mr-remote-body: linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.4));
    --mr-dpad-size: 216px;
    --mr-ok-size: 96px;
    --mr-rocker-w: 62px;
    --mr-dpad-ring: radial-gradient(circle at 50% 28%, #ffffff 0%, #f2f5f9 55%, #e3e8f0 100%);
    --mr-dpad-shadow: 0 16px 36px rgba(31, 45, 80, 0.16), inset 0 1px 0 #fff, inset 0 -8px 18px rgba(31, 45, 80, 0.06), 0 0 0 1px rgba(60, 60, 67, 0.1);
    --mr-dpad-groove: inset 0 2px 6px rgba(31, 45, 80, 0.16), inset 0 -1px 0 rgba(255, 255, 255, 0.9);
    --mr-ok-bg: linear-gradient(180deg, #ffffff, #edf1f6);
    --mr-screen-off: linear-gradient(155deg, rgba(120, 120, 128, 0.2), rgba(120, 120, 128, 0.08));
    --mr-art-veil: rgba(255, 255, 255, 0.38);
    --mr-glow-alpha: 0.36;
    --mr-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --mr-motion: 240ms;
    --mr-font: -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', 'Noto Sans Hebrew', 'Heebo', Roboto, Arial, sans-serif;
    color-scheme: light;
  }
  :host([data-devices-scheme='dark']) {
    --mr-text: #f5f5f7;
    --mr-text-2: rgba(235, 235, 245, 0.72);
    --mr-text-3: rgba(235, 235, 245, 0.56);
    --mr-text-inverse: #1c1c1e;
    --mr-surface: rgba(28, 28, 30, 0.72);
    --mr-surface-2: rgba(44, 44, 46, 0.62);
    --mr-surface-3: rgba(235, 235, 245, 0.14);
    --mr-surface-solid: #161619;
    --mr-border: rgba(255, 255, 255, 0.13);
    --mr-border-strong: rgba(255, 255, 255, 0.24);
    --mr-accent: #0a84ff;
    --mr-accent-hover: #409cff;
    --mr-accent-soft: rgba(10, 132, 255, 0.26);
    --mr-accent-text: #64d2ff;
    --mr-accent-glow: rgba(10, 132, 255, 0.45);
    --mr-focus: #64d2ff;
    --mr-success: #30d158;
    --mr-danger: #ff453a;
    --mr-danger-soft: rgba(255, 69, 58, 0.2);
    --mr-warning: #ff9f0a;
    --mr-seg-thumb: rgba(118, 118, 128, 0.5);
    --mr-shadow-control: 0 1px 4px rgba(0, 0, 0, 0.35);
    --mr-shadow-3: 0 26px 70px rgba(0, 0, 0, 0.6);
    --mr-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.015) 50%);
    --mr-key-bg: linear-gradient(180deg, rgba(78, 78, 84, 0.95), rgba(50, 50, 54, 0.95));
    --mr-key-fg: #f5f5f7;
    --mr-key-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06);
    --mr-remote-body: linear-gradient(180deg, rgba(58, 58, 62, 0.55), rgba(30, 30, 33, 0.35));
    --mr-dpad-ring: radial-gradient(circle at 50% 28%, #3b3b40 0%, #2a2a2e 58%, #1d1d20 100%);
    --mr-dpad-shadow: 0 18px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -8px 18px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.07);
    --mr-dpad-groove: inset 0 2px 8px rgba(0, 0, 0, 0.6), inset 0 -1px 0 rgba(255, 255, 255, 0.07);
    --mr-ok-bg: linear-gradient(180deg, #4b4b51, #323236);
    --mr-screen-off: linear-gradient(155deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025));
    --mr-art-veil: rgba(18, 18, 20, 0.34);
    --mr-glow-alpha: 0.5;
    color-scheme: dark;
  }
  /* the Bubble skin (phase C): the remote and the player panel read the product's tokens - the sheet, the keys, the rows follow
     the skin and its scheme (data-theme on <html>), not devices.scheme; declared after the dark block so it wins */
  :host([data-skin='bubble']) {
    --mr-text: var(--sw-text);
    --mr-text-2: var(--sw-text-2);
    --mr-text-3: var(--sw-text-3);
    --mr-text-inverse: var(--sw-text-inverse);
    --mr-surface: var(--sw-layer);
    --mr-surface-2: var(--sw-layer-2);
    --mr-surface-3: var(--sw-surface-2);
    --mr-surface-solid: var(--sw-surface-solid);
    --mr-border: transparent;
    --mr-border-strong: var(--sw-border-strong);
    --mr-accent: var(--sw-accent);
    --mr-accent-hover: var(--sw-accent-hover);
    --mr-accent-soft: var(--sw-accent-soft);
    --mr-accent-text: var(--sw-accent-text);
    --mr-accent-glow: transparent;
    --mr-focus: var(--sw-focus);
    --mr-success: var(--sw-success);
    --mr-danger: var(--sw-danger);
    --mr-danger-soft: var(--sw-danger-soft);
    --mr-warning: var(--sw-warning);
    --mr-seg-thumb: var(--sw-surface-solid);
    --mr-shadow-control: none;
    --mr-shadow-3: var(--sw-shadow-3);
    --mr-sheen: none;
    --mr-key-bg: var(--sw-surface-2);
    --mr-key-fg: var(--sw-text);
    --mr-key-shadow: none;
    --mr-remote-body: var(--sw-layer);
    --mr-dpad-ring: var(--sw-surface-2);
    --mr-dpad-shadow: none;
    --mr-dpad-groove: none;
    --mr-ok-bg: var(--sw-surface-solid);
    --mr-screen-off: var(--sw-surface-2);
    --mr-art-veil: rgba(var(--sw-sheet-rgb), 0.3);
    --mr-glow-alpha: 0.3;
    --mr-ease: var(--sw-ease);
    --mr-motion: var(--sw-t-med);
    --mr-font: var(--sw-font);
  }
  @media (max-width: 767px) {
    :host {
      --mr-dpad-size: 196px;
      --mr-ok-size: 88px;
      --mr-rocker-w: 56px;
      --mr-key-size: 50px;
    }
  }
  /* no backdrop blur is used by the remote itself (the sheet is a solid panel with a tinted glow); transparency settings
     therefore need nothing here. Reduced motion: only the state changes stay, the movement goes. */
  @media (prefers-reduced-motion: reduce) {
    :host {
      --mr-motion: 0.01ms;
    }
  }
`;

export const remoteStyles = css`
  :host {
    display: contents;
    font-family: var(--mr-font);
    color: var(--mr-text);
    /* the drawer (sw-drawer, modal) reads these: its panel surface, title, hairlines and buttons follow the remote's scheme */
    --dv-surface-solid: radial-gradient(130% 34% at 50% 0%, rgb(var(--mr-art, 107 119 136) / var(--mr-glow-alpha)), transparent 72%), var(--mr-surface-solid);
    --sw-text: var(--mr-text);
    --sw-text-2: var(--mr-text-2);
    --sw-text-3: var(--mr-text-3);
    --sw-border: var(--mr-border);
    --sw-border-strong: var(--mr-border-strong);
    --sw-surface: var(--mr-surface-solid);
    --sw-surface-2: var(--mr-surface-2);
    --sw-surface-3: var(--mr-surface-3);
    --sw-accent: var(--mr-accent);
    --sw-accent-soft: var(--mr-accent-soft);
    --sw-focus: var(--mr-focus);
    --sw-fs-lg: 20px;
    --sw-drawer-modal-w: 448px;
  }
  .r {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--mr-text);
    padding-block-end: 6px;
  }
  .r svg.ic {
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
  .r :focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: 2px;
  }
  .n {
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
    font-variant-numeric: tabular-nums;
  }
  bdi {
    unicode-bidi: isolate;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button[disabled] {
    cursor: not-allowed;
  }

  /* ---- now showing ---- */
  .np {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: 12px;
    border-radius: 20px;
    background: var(--mr-surface-2);
    border: 1px solid var(--mr-border);
  }
  .thumb {
    position: relative;
    inline-size: 64px;
    block-size: 64px;
    border-radius: 15px;
    overflow: hidden;
    color: #fff;
    background: var(--mr-screen-off);
    box-shadow: 0 8px 20px rgb(var(--art, 20 24 34) / 0.35);
    display: grid;
    place-items: center;
  }
  .thumb.plain {
    box-shadow: none;
    color: var(--mr-text-2);
  }
  .thumb .tile {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--a1), var(--a2));
  }
  .thumb .tile::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.3), transparent 45%), radial-gradient(circle at 10% 110%, rgba(0, 0, 0, 0.35), transparent 55%);
  }
  .thumb .tile.frameart {
    background: linear-gradient(160deg, #efe6d6, #e2d3bb);
  }
  .thumb .tile.frameart::before {
    display: none;
  }
  .thumb .tile.saver {
    background: radial-gradient(circle at 70% 30%, #2b3656, #0b0f19 70%);
  }
  .thumb svg.gl {
    position: relative;
    inline-size: 66%;
    block-size: 66%;
    color: rgba(255, 255, 255, 0.72);
    stroke-width: 1.4;
  }
  .thumb .num {
    position: relative;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: rgba(255, 255, 255, 0.85);
    direction: ltr;
  }
  .thumb img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  .np .t {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    gap: 1px;
  }
  .np .t small {
    font-size: 12.5px;
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .np .t b {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .prog {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--mr-text-2);
    direction: ltr;
    margin-block-start: 5px;
    font-variant-numeric: tabular-nums;
  }
  .prog .bar {
    flex: 1;
    block-size: 4px;
    border-radius: 2px;
    background: var(--mr-surface-3);
    overflow: hidden;
  }
  .prog .bar i {
    display: block;
    block-size: 100%;
    inline-size: var(--p);
    background: var(--mr-text);
    border-radius: 2px;
  }

  /* ---- segmented control, toggles, buttons ---- */
  .seg {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--mr-surface-3);
    border-radius: 999px;
    padding: 3px;
    max-inline-size: 100%;
  }
  .seg button {
    flex: 1;
    border: 0;
    background: transparent;
    border-radius: 999px;
    padding: 6px 14px;
    font-size: 13.5px;
    font-weight: 600;
    min-block-size: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
    color: var(--mr-text);
    transition: background var(--mr-motion) var(--mr-ease), color var(--mr-motion);
  }
  .seg.sm button {
    min-block-size: 44px;
    font-size: 13px;
    padding: 4px 12px;
  }
  .seg button[aria-selected='true'],
  .seg button[aria-checked='true'],
  .seg button[aria-pressed='true'] {
    background: var(--mr-seg-thumb);
    box-shadow: var(--mr-shadow-control);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-block-size: 44px;
    padding-inline: 18px;
    border-radius: 999px;
    border: 1px solid var(--mr-border);
    background: var(--mr-sheen), var(--mr-surface);
    color: var(--mr-text);
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    box-shadow: var(--mr-shadow-control);
    transition: background var(--mr-motion) var(--mr-ease), transform 120ms var(--mr-ease);
  }
  .btn:active {
    transform: scale(0.97);
  }
  .btn.primary {
    background: var(--mr-accent);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 6px 16px var(--mr-accent-glow);
  }
  .btn.quiet {
    box-shadow: none;
    background: var(--mr-surface-2);
  }
  .btn[disabled] {
    opacity: 0.45;
    pointer-events: none;
  }
  .btn .ic {
    font-size: 16px;
  }

  /* ---- round buttons ---- */
  .rb {
    position: relative;
    flex: none;
    inline-size: 46px;
    block-size: 46px;
    border-radius: 50%;
    border: 0;
    padding: 0;
    display: grid;
    place-items: center;
    background: var(--mr-key-bg);
    color: var(--mr-key-fg);
    box-shadow: var(--mr-key-shadow);
    transition: transform 120ms var(--mr-ease), box-shadow var(--mr-motion), color var(--mr-motion);
  }
  .rb .ic {
    font-size: 19px;
  }
  .rb:active,
  .rb.hit {
    transform: scale(0.92);
  }
  .rb.on {
    background: var(--mr-danger-soft);
    color: var(--mr-danger);
    box-shadow: inset 0 0 0 1px var(--mr-danger-soft);
  }
  .rb[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }

  /* ---- volume slider row, audio switch, recent chips ---- */
  .vrow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 2px;
    direction: ltr;
  }
  .vrow .vv {
    min-inline-size: 30px;
    text-align: start;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .rng {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    min-inline-size: 0;
    block-size: 34px;
    background: transparent;
    margin: 0;
  }
  .rng::-webkit-slider-runnable-track {
    block-size: 8px;
    border-radius: 999px;
    background: linear-gradient(to right, var(--mr-accent) var(--v, 50%), var(--mr-surface-3) var(--v, 50%));
  }
  .rng::-moz-range-track {
    block-size: 8px;
    border-radius: 999px;
    background: var(--mr-surface-3);
  }
  .rng::-moz-range-progress {
    block-size: 8px;
    border-radius: 999px;
    background: var(--mr-accent);
  }
  .rng::-webkit-slider-thumb {
    -webkit-appearance: none;
    inline-size: 26px;
    block-size: 26px;
    border-radius: 50%;
    background: #fff;
    margin-block-start: -9px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  }
  .rng::-moz-range-thumb {
    inline-size: 26px;
    block-size: 26px;
    border: 0;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
  }
  .rng:focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: 2px;
    border-radius: 999px;
  }
  .recent {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 3px 2px;
  }
  .recent .lbl {
    font-size: 12.5px;
    color: var(--mr-text-2);
    font-weight: 600;
    flex: none;
    margin-inline-end: 2px;
  }
  .rchip {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    block-size: 46px;
    padding-inline: 5px 14px;
    border-radius: 15px;
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    font-size: 13.5px;
    font-weight: 500;
    white-space: nowrap;
    flex: none;
    transition: transform 120ms, border-color var(--mr-motion);
  }
  .rchip:hover {
    border-color: var(--mr-border-strong);
  }
  .rchip:active {
    transform: scale(0.96);
  }
  .rchip[aria-current='true'] {
    border-color: var(--mr-accent);
    background: var(--mr-accent-soft);
    color: var(--mr-accent-text);
  }
  .gi {
    position: relative;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(135deg, var(--a1), var(--a2));
    flex: none;
    overflow: hidden;
  }
  .gi::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0) 50%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  }
  .gi.src {
    background: var(--mr-surface-3);
    color: var(--mr-text);
  }
  .gi.src::after {
    display: none;
  }
  .rchip .gi {
    inline-size: 36px;
    block-size: 36px;
    border-radius: 11px;
  }
  .rchip .gi .ic {
    font-size: 17px;
  }

  /* ---- the pad body ---- */
  .rpad {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 18px 16px;
    border-radius: 32px;
    background: var(--mr-remote-body);
    border: 1px solid var(--mr-border);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
    min-inline-size: 0;
  }
  .rpad.dim {
    opacity: 0.3;
    filter: saturate(0.2);
    pointer-events: none;
  }
  .rpad.shake {
    animation: mr-shake 240ms var(--mr-ease);
  }
  @keyframes mr-shake {
    20% { transform: translateX(-4px); }
    45% { transform: translateX(4px); }
    70% { transform: translateX(-2px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .rpad.shake {
      animation: mr-flash 240ms linear;
    }
    @keyframes mr-flash {
      50% { opacity: 0.6; }
    }
  }
  .tcl {
    direction: ltr;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    inline-size: 100%;
    padding-inline: 4px;
  }
  .tcl .grow {
    flex: 1;
  }
  .navk {
    direction: ltr;
    display: flex;
    justify-content: space-between;
    inline-size: 100%;
    max-inline-size: 300px;
  }
  .kb {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    border: 0;
    background: transparent;
    padding: 0;
    font-size: 12px;
    color: var(--mr-text-2);
    font-weight: 500;
    min-inline-size: var(--mr-key-size);
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .kc {
    position: relative;
    inline-size: var(--mr-key-size);
    block-size: var(--mr-key-size);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--mr-key-bg);
    color: var(--mr-key-fg);
    box-shadow: var(--mr-key-shadow);
    transition: transform 120ms var(--mr-ease), box-shadow 220ms var(--mr-ease), color 220ms;
  }
  .kc .ic {
    font-size: 21px;
  }
  .kb:active .kc,
  .kb.hit .kc,
  .kb.pend .kc {
    transform: scale(0.93);
    color: var(--mr-accent);
    box-shadow: var(--mr-key-shadow), 0 0 0 4px var(--mr-accent-soft), 0 0 22px var(--mr-accent-glow);
  }
  .kb:focus-visible {
    outline: none;
  }
  .kb:focus-visible .kc {
    outline: 2px solid var(--mr-focus);
    outline-offset: 3px;
  }
  .kb.pwk .kc {
    color: var(--mr-danger);
  }
  .kb.pwk.off .kc {
    color: var(--mr-accent);
  }
  .kb[disabled] {
    opacity: 0.45;
  }
  .pgrid {
    direction: ltr;
    display: grid;
    grid-template-columns: var(--mr-rocker-w) var(--mr-dpad-size) var(--mr-rocker-w);
    gap: 14px;
    align-items: center;
    justify-content: center;
  }
  .pgrid.solo {
    grid-template-columns: auto;
  }
  .pgrid.duo {
    grid-template-columns: var(--mr-rocker-w) var(--mr-rocker-w);
    gap: 28px;
  }
  @media (max-width: 767px) {
    .pgrid {
      gap: 10px;
    }
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .rock {
    display: grid;
    grid-template-rows: 1fr auto 1fr;
    inline-size: var(--mr-rocker-w);
    block-size: calc(var(--mr-dpad-size) * 0.74);
    border-radius: 999px;
    background: var(--mr-key-bg);
    box-shadow: var(--mr-key-shadow);
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }
  .rock button {
    border: 0;
    background: transparent;
    display: grid;
    place-items: center;
    color: var(--mr-key-fg);
    transition: background 220ms, color 160ms;
    touch-action: manipulation;
  }
  .rock button .ic {
    font-size: 21px;
    stroke-width: 2;
  }
  .rock button:active,
  .rock button.hit {
    background: radial-gradient(circle, var(--mr-accent-soft), transparent 72%);
    color: var(--mr-accent);
  }
  .rock button:focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: -4px;
    border-radius: 999px;
  }
  .rock button[disabled] {
    opacity: 0.4;
  }
  .rock .rv {
    margin-inline: 9px;
    padding: 6px 0 5px;
    border-radius: 12px;
    box-shadow: var(--mr-dpad-groove);
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
    direction: rtl;
  }
  .rock .rv small {
    font-size: 10.5px;
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .rock .rv b {
    font-size: 16px;
    font-variant-numeric: tabular-nums;
    margin-block-start: 1px;
  }
  .pbk {
    direction: ltr;
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
  }
  .pbk .kb {
    min-inline-size: 0;
  }
  .pbk .kc {
    inline-size: 46px;
    block-size: 46px;
  }
  .pbk .kc .ic {
    font-size: 18px;
  }
  .pbk .main .kc {
    inline-size: 62px;
    block-size: 62px;
    background: var(--mr-text);
    color: var(--mr-text-inverse);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }
  .pbk .main .kc .ic {
    font-size: 24px;
  }
  .morebtn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    inline-size: 100%;
    block-size: 44px;
    border-radius: 999px;
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    color: var(--mr-text);
    font-size: 14px;
    font-weight: 600;
  }
  .morebtn:hover {
    background: var(--mr-surface);
  }
  .morebtn .ic {
    font-size: 15px;
    transition: transform var(--mr-motion) var(--mr-ease);
  }
  .morebtn[aria-expanded='true'] .ic {
    transform: rotate(180deg);
  }
  .more {
    display: flex;
    flex-direction: column;
    gap: 20px;
    inline-size: 100%;
  }
  .more h4 {
    margin: 0 0 8px;
    font-size: 12.5px;
    color: var(--mr-text-2);
    font-weight: 600;
    text-align: center;
  }
  .npad {
    direction: ltr;
    display: grid;
    grid-template-columns: repeat(3, 72px);
    gap: 10px;
    justify-content: center;
  }
  .npad button {
    block-size: 52px;
    border-radius: 17px;
    border: 0;
    background: var(--mr-key-bg);
    box-shadow: var(--mr-key-shadow);
    font-size: 20px;
    font-weight: 600;
    color: var(--mr-key-fg);
    display: grid;
    place-items: center;
    transition: transform 120ms, box-shadow 220ms, color 200ms;
    font-variant-numeric: tabular-nums;
    touch-action: manipulation;
  }
  .npad button .ic {
    font-size: 19px;
  }
  .npad button:active,
  .npad button.hit {
    transform: scale(0.93);
    color: var(--mr-accent);
    box-shadow: var(--mr-key-shadow), 0 0 0 4px var(--mr-accent-soft);
  }
  .chentry {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    block-size: 24px;
    font-size: 12.5px;
    color: var(--mr-text-2);
    margin-block-end: 6px;
  }
  .chentry b {
    font-size: 19px;
    color: var(--mr-accent-text);
    letter-spacing: 0.1em;
    direction: ltr;
  }
  .ckeys {
    direction: ltr;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    inline-size: 100%;
    max-inline-size: 300px;
    margin-inline: auto;
  }
  .ckeys button {
    block-size: 44px;
    border-radius: 999px;
    border: 0;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -2px 0 rgba(0, 0, 0, 0.15), 0 3px 8px rgba(0, 0, 0, 0.14);
    transition: transform 120ms;
    background-clip: content-box;
    touch-action: manipulation;
  }
  .ckeys button:active,
  .ckeys button.hit {
    transform: scale(0.92);
  }
  .ckeys .red { background: linear-gradient(180deg, #ff6b6b, #e5484d); }
  .ckeys .green { background: linear-gradient(180deg, #4cd08a, #30a46c); }
  .ckeys .yellow { background: linear-gradient(180deg, #ffd84d, #f5c518); }
  .ckeys .blue { background: linear-gradient(180deg, #6f8cff, #3e63dd); }
  .xkeys {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .kbd {
    display: flex;
    gap: 8px;
    inline-size: 100%;
  }
  .kbd .fld {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    block-size: 48px;
    border-radius: 15px;
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    padding: 0 12px;
    min-inline-size: 0;
  }
  .kbd .fld:focus-within {
    outline: 2px solid var(--mr-focus);
    outline-offset: 1px;
  }
  .kbd input {
    border: 0;
    outline: none;
    flex: 1;
    min-inline-size: 0;
    font: inherit;
    font-size: 14px;
    background: transparent;
    color: var(--mr-text);
  }
  .kbd input::placeholder {
    color: var(--mr-text-2);
  }
  .kbd .fld .ic {
    color: var(--mr-text-2);
    font-size: 17px;
  }
  .kbd .btn {
    min-block-size: 48px;
  }

  /* ---- off / art / unavailable / loading ---- */
  .roff {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 30px 0 12px;
    text-align: center;
  }
  .roff > b {
    font-size: 18px;
    font-weight: 600;
    margin-block-start: 6px;
  }
  .roff small {
    font-size: 13.5px;
    color: var(--mr-text-2);
  }
  .roff > .ic {
    font-size: 42px;
    color: var(--mr-text-3);
  }
  .bigpw {
    position: relative;
    inline-size: 116px;
    block-size: 116px;
    border-radius: 50%;
    border: 0;
    background: var(--mr-key-bg);
    color: var(--mr-accent);
    display: grid;
    place-items: center;
    box-shadow: var(--mr-key-shadow), 0 0 0 10px var(--mr-accent-soft), 0 18px 44px var(--mr-accent-glow);
    transition: transform 140ms var(--mr-ease);
  }
  .bigpw .ic {
    font-size: 44px;
    stroke-width: 2;
  }
  .bigpw:active {
    transform: scale(0.95);
  }
  .bigpw[disabled] {
    color: var(--mr-text-3);
    box-shadow: var(--mr-key-shadow);
  }
  .bigpw.pend,
  .kb.pend {
    cursor: progress;
  }
  .pendring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 3px solid transparent;
    border-block-start-color: var(--mr-accent);
    animation: mr-spin 900ms linear infinite;
    pointer-events: none;
  }
  @keyframes mr-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pendring {
      animation: none;
      border-color: var(--mr-accent);
      opacity: 0.6;
    }
  }
  .skl {
    display: block;
    border-radius: 14px;
    background: linear-gradient(90deg, var(--mr-surface-3) 0%, var(--mr-surface-2) 50%, var(--mr-surface-3) 100%);
    background-size: 200% 100%;
    animation: mr-sh 1.6s linear infinite;
  }
  @keyframes mr-sh {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skl {
      animation: none;
    }
  }
  .errbox {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 36px 12px;
    text-align: center;
    color: var(--mr-text-2);
  }
  .errbox .ic {
    font-size: 34px;
    color: var(--mr-danger);
  }

  /* ---- sources and apps ---- */
  .srcg {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .srci {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    min-block-size: 100px;
    border-radius: 20px;
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    text-align: start;
    font-size: 14px;
    font-weight: 600;
    color: var(--mr-text);
    transition: transform 120ms, background var(--mr-motion), border-color var(--mr-motion);
  }
  .srci:hover {
    background: var(--mr-surface);
  }
  .srci:active {
    transform: scale(0.98);
  }
  .srci .gi {
    inline-size: 42px;
    block-size: 42px;
    border-radius: 50%;
  }
  .srci .gi .ic {
    font-size: 19px;
  }
  .srci small {
    display: block;
    font-size: 12px;
    color: var(--mr-text-2);
    font-weight: 500;
  }
  .srci[aria-checked='true'] {
    border-color: var(--mr-accent);
    background: var(--mr-accent-soft);
  }
  .srci[aria-checked='true'] .gi.src {
    background: var(--mr-accent);
    color: #fff;
  }
  .srci .ck {
    position: absolute;
    inset-block-start: 12px;
    inset-inline-end: 12px;
    color: var(--mr-accent-text);
    font-size: 18px;
  }
  .srci .pendring {
    inset: 6px;
    inline-size: 18px;
    block-size: 18px;
    inset-inline-start: auto;
    inset-block-end: auto;
    border-width: 2px;
  }
  .appg {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px 8px;
  }
  .appt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    padding: 4px 0;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--mr-text);
    border-radius: 14px;
    min-inline-size: 0;
    min-block-size: 44px;
  }
  .appt .gi {
    position: relative;
    inline-size: 62px;
    block-size: 62px;
    border-radius: 19px;
    box-shadow: 0 8px 20px rgb(var(--art) / 0.35);
    transition: transform 140ms var(--mr-ease);
  }
  .appt .gi .ic {
    font-size: 27px;
  }
  .appt span:last-child {
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .appt:active .gi {
    transform: scale(0.92);
  }
  .appt[aria-current='true'] .gi {
    outline: 3px solid var(--mr-accent);
    outline-offset: 3px;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 28px 12px;
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .empty .ic {
    font-size: 30px;
    color: var(--mr-text-3);
  }

  /* ---- the notice above the body (not confirmed / refused) ---- */
  .notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--mr-danger-soft);
    color: var(--mr-text);
    font-size: 13.5px;
    font-weight: 600;
  }
  .notice[hidden] {
    display: none;
  }
  .notice .ic {
    color: var(--mr-danger);
    font-size: 17px;
  }
`;
