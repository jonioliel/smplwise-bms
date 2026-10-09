import { css } from 'lit';

/**
 * CR-016 S3: the player panel's look. It extends the remote's glass tokens and base rules (media-remote-css.ts: `--mr-*`, the
 * drawer surface, `.btn`, `.seg`, `.rb`, `.roff`, `.bigpw`, `.srcg`, `.notice` ...) with the pieces of the approved mockup
 * (docs/design/mockups/media/players-index.html): the now-playing card with square artwork, the transport pad, volume rows, "הבא בתור",
 * the library tabs, the group section. Always glass, light or dark by the host's `data-devices-scheme`; every colour is a token.
 *
 * Direction: the page is RTL, so the progress bar and the volume sliders fill from the inline-start (the right); the transport pad
 * and the play / seek glyphs are NEVER mirrored (`direction: ltr` on the pad, the glyphs are drawn once); times and numbers are
 * isolated left-to-right. Targets are at least 44 px.
 */

/** The rules the panel and its volume element share (the volume element lives in its own shadow root). */
export const playerBase = css`
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
  .n {
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
    font-variant-numeric: tabular-nums;
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
  :focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: 2px;
  }
  .rb {
    position: relative;
    flex: none;
    inline-size: 44px;
    block-size: 44px;
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
    font-size: var(--sw-fs-xl);
  }
  .rb:active,
  .rb.hit {
    transform: scale(0.92);
  }
  .rb.muted {
    background: var(--mr-danger-soft);
    color: var(--mr-danger);
    box-shadow: inset 0 0 0 1px var(--mr-danger-soft);
  }
  .rb[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }
  .pendring {
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 2px solid transparent;
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
  /* ---- sliders: fill from the inline-start (the right in RTL), the ceiling marker only where one is set ---- */
  .vrow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 2px;
    min-inline-size: 0;
    direction: rtl;
  }
  .vrow .vv {
    min-inline-size: 30px;
    text-align: end;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .vrow .lbl {
    flex: none;
    min-inline-size: 52px;
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .rngwrap {
    position: relative;
    flex: 1;
    min-inline-size: 0;
    display: flex;
    align-items: center;
  }
  .rng {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    min-inline-size: 0;
    block-size: 44px;
    background: transparent;
    margin: 0;
    direction: rtl;
  }
  .rng::-webkit-slider-runnable-track {
    block-size: 8px;
    border-radius: 999px;
    background: linear-gradient(to left, var(--mr-accent) var(--v, 50%), var(--mr-surface-3) var(--v, 50%));
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
  .rng.sm::-webkit-slider-runnable-track {
    block-size: 6px;
  }
  .rng.sm::-webkit-slider-thumb {
    inline-size: 20px;
    block-size: 20px;
    margin-block-start: -7px;
  }
  .rng.sm::-moz-range-thumb {
    inline-size: 20px;
    block-size: 20px;
  }
  .rng[disabled] {
    opacity: 0.4;
  }
  .rng.seek::-webkit-slider-runnable-track {
    block-size: 5px;
    background: linear-gradient(to left, var(--mr-text) var(--v, 0%), var(--mr-surface-3) var(--v, 0%));
  }
  .rng.seek::-moz-range-progress {
    background: var(--mr-text);
    block-size: 5px;
  }
  .rng.seek::-moz-range-track {
    block-size: 5px;
  }
  .rng.seek::-webkit-slider-thumb {
    inline-size: 16px;
    block-size: 16px;
    margin-block-start: -5.5px;
    background: var(--mr-text);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .rng.seek::-moz-range-thumb {
    inline-size: 16px;
    block-size: 16px;
    background: var(--mr-text);
  }
  /* the ceiling in force (volume_max / the night window) - drawn ONLY where an administrator set one */
  .rngwrap .cap {
    position: absolute;
    inset-block: 14px;
    inset-inline-start: calc(13px + (100% - 26px) * var(--capn) / 100 - 1px);
    inline-size: 2px;
    border-radius: 1px;
    background: var(--mr-warning);
    pointer-events: none;
    opacity: 0.9;
  }
  .rngwrap.sm .cap {
    inset-block: 15px;
    inset-inline-start: calc(10px + (100% - 20px) * var(--capn) / 100 - 1px);
  }
  /* ---- per room ---- */
  .members {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mrow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(88px, 150px) 30px auto;
    align-items: center;
    gap: 10px;
    min-block-size: 52px;
    padding: 4px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--mr-surface-2);
    border: 1px solid var(--mr-border);
  }
  .mrow .nm {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: 1.25;
  }
  .mrow .nm b {
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mrow .nm small {
    font-size: var(--sw-fs-xs);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mrow .nm small.bad {
    color: var(--mr-danger);
    font-weight: 600;
  }
  .mrow .nm small.ok {
    color: var(--mr-success);
    font-weight: 600;
  }
  :host([data-devices-scheme='light']) .mrow .nm small.ok,
  :host([data-devices-scheme='light']) .ckrow .nm small.ok {
    color: var(--sw-success-text);
  }
  .mrow .vv {
    font-size: var(--sw-fs-base);
    font-weight: 700;
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
  .mrow.lead {
    border-color: color-mix(in srgb, var(--mr-accent) 35%, transparent);
  }
  .mrow.dim {
    opacity: 0.55;
  }
  @media (max-width: 767px) {
    .mrow {
      grid-template-columns: minmax(0, 1fr) minmax(70px, 110px) 28px auto;
      padding-inline: 10px;
      gap: 8px;
    }
  }
`;

/** The panel itself. */
export const playerStyles = css`
  /* ---- header action (power) and the sticky notice ---- */
  .hpw {
    position: relative;
    inline-size: 44px;
    block-size: 44px;
    border-radius: 50%;
    border: 0;
    display: grid;
    place-items: center;
    background: var(--mr-key-bg);
    color: var(--mr-text-2);
    box-shadow: var(--mr-key-shadow);
    flex: none;
    transition: transform 120ms var(--mr-ease), background var(--mr-motion);
  }
  .hpw.on {
    background: var(--mr-accent);
    color: #fff;
    box-shadow: 0 6px 18px var(--mr-accent-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  .hpw .ic {
    font-size: var(--sw-fs-2xl);
    stroke-width: 2;
  }
  .hpw:active {
    transform: scale(0.92);
  }
  .hpw[disabled] {
    opacity: 0.38;
    pointer-events: none;
    box-shadow: none;
  }
  .notice {
    position: sticky;
    inset-block-start: 0;
    z-index: 4;
    /* opaque under the tint: the body scrolls beneath it */
    background: color-mix(in srgb, var(--mr-danger) 16%, var(--mr-surface-solid));
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  }
  .notice span {
    flex: 1;
    min-inline-size: 0;
  }
  .notice ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rbody {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .rbody > * {
    flex-shrink: 0;
  }
  .dimmed {
    opacity: 0.3;
    filter: saturate(0.2);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* ---- now playing ---- */
  .npb {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border-radius: var(--sw-r-2xl);
    background: var(--mr-surface-2);
    border: 1px solid var(--mr-border);
  }
  .npb .top {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
  }
  .npb .thumb {
    inline-size: 96px;
    block-size: 96px;
    border-radius: var(--sw-r-2xl);
    box-shadow: 0 12px 26px rgb(var(--art, 20 24 34) / 0.38);
  }
  .npb .thumb .tile {
    border-radius: inherit;
  }
  .npb .t {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    gap: 2px;
    line-height: 1.25;
  }
  .npb .t small {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .npb .t b {
    font-size: var(--sw-fs-xl);
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .npb .t span {
    font-size: var(--sw-fs-base);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .npb .t .al {
    color: var(--mr-text-3);
    font-size: var(--sw-fs-sm);
  }
  .pprog {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--sw-fs-xs);
    color: var(--mr-text-2);
    min-inline-size: 0;
  }
  .pprog .tm {
    min-inline-size: 34px;
    flex: none;
  }
  .pprog .tm:last-child {
    text-align: end;
  }
  .pprog .bar {
    flex: 1;
    block-size: 5px;
    border-radius: 3px;
    background: var(--mr-surface-3);
    overflow: hidden;
  }
  .pprog .bar i {
    display: block;
    block-size: 100%;
    inline-size: var(--p, 0%);
    background: var(--mr-text);
    border-radius: 3px;
  }
  .pprog .live {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--mr-text-2);
  }
  .pprog .live i {
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background: var(--sw-danger);
    box-shadow: 0 0 6px var(--sw-danger);
    animation: pn-blink 1.6s ease-in-out infinite;
  }
  @keyframes pn-blink {
    50% { opacity: 0.35; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pprog .live i {
      animation: none;
    }
  }
  .idle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 18px 0 6px;
    text-align: center;
  }
  .idle .ic {
    font-size: 38px;
    color: var(--mr-text-3);
  }
  .idle b {
    font-size: var(--sw-fs-lg);
    font-weight: 600;
  }

  /* ---- transport: never mirrored ---- */
  .tport {
    direction: ltr;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 4px 0;
  }
  .tport.shake {
    animation: mr-shake 240ms var(--mr-ease);
  }
  @keyframes mr-shake {
    20% { transform: translateX(-4px); }
    45% { transform: translateX(4px); }
    70% { transform: translateX(-2px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tport.shake {
      animation: pn-flash 240ms linear;
    }
    @keyframes pn-flash {
      50% { opacity: 0.6; }
    }
  }
  .tport .kb {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 0;
    background: transparent;
    padding: 0;
    min-inline-size: 0;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .tport .kc {
    position: relative;
    inline-size: 48px;
    block-size: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--mr-key-bg);
    color: var(--mr-key-fg);
    box-shadow: var(--mr-key-shadow);
    transition: transform 120ms var(--mr-ease), box-shadow 220ms var(--mr-ease), color 220ms;
  }
  .tport .kc .ic {
    font-size: var(--sw-fs-2xl);
  }
  .tport .kb:active .kc,
  .tport .kb.hit .kc {
    transform: scale(0.93);
    color: var(--mr-accent);
    box-shadow: var(--mr-key-shadow), 0 0 0 4px var(--mr-accent-soft), 0 0 22px var(--mr-accent-glow);
  }
  .tport .kb:focus-visible {
    outline: none;
  }
  .tport .kb:focus-visible .kc {
    outline: 2px solid var(--mr-focus);
    outline-offset: 3px;
  }
  .tport .kb.main .kc {
    inline-size: 66px;
    block-size: 66px;
    background: var(--mr-text);
    color: var(--mr-text-inverse);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }
  .tport .kb.main .kc .ic {
    font-size: var(--sw-fs-3xl);
    stroke-width: 2;
  }
  .tport .kb.main:active .kc {
    color: var(--mr-text-inverse);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2), 0 0 0 4px var(--mr-accent-soft);
  }
  .tport .kb.side .kc {
    inline-size: 44px;
    block-size: 44px;
  }
  .tport .kb.side .kc .ic {
    font-size: var(--sw-fs-xl);
  }
  .tport .kb.side[aria-pressed='true'] .kc {
    color: var(--mr-accent-text);
    box-shadow: var(--mr-key-shadow), inset 0 0 0 1.5px var(--mr-accent);
  }
  .tport .kc .one {
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 50%;
    transform: translate(-50%, -45%);
    font-size: var(--sw-fs-2xs);
    font-weight: 800;
  }
  .tport .kb[disabled] {
    opacity: 0.38;
    pointer-events: none;
  }
  .tport .kb.pend .kc {
    color: var(--mr-accent);
  }

  /* ---- section heads ---- */
  .psh {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px 0;
    min-block-size: 28px;
  }
  .psh h4 {
    margin: 0;
    font-size: var(--sw-fs-base);
    font-weight: 700;
    color: var(--mr-text-2);
    letter-spacing: 0.01em;
  }
  .psh small {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-3);
    font-variant-numeric: tabular-nums;
  }
  .psh .lnk {
    all: unset;
    cursor: pointer;
    margin-inline-start: auto;
    min-block-size: 28px;
    padding-inline: 6px;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--mr-accent-text);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--sw-r-sm);
  }
  .psh .lnk .ic {
    font-size: var(--sw-fs-md);
    transition: transform var(--mr-motion) var(--mr-ease);
  }
  .psh .lnk[aria-expanded='true'] .ic {
    transform: rotate(180deg);
  }
  .psh .lnk:focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: 2px;
  }
  .psh .lnk[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }

  /* ---- up next ---- */
  .uq {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border-radius: var(--sw-r-2xl);
    background: var(--mr-surface-2);
    border: 1px solid var(--mr-border);
  }
  .uq .row {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: var(--sw-r-md);
    min-block-size: 44px;
  }
  .uq .row.cur {
    background: var(--mr-accent-soft);
  }
  .uq .ix {
    display: grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: var(--sw-r-sm);
    background: var(--mr-surface-3);
    color: var(--mr-text-2);
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .uq .row.cur .ix {
    background: var(--mr-accent);
    color: #fff;
  }
  .uq .ix .ic {
    font-size: var(--sw-fs-base);
  }
  .uq .t {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: 1.25;
  }
  .uq .t b {
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .uq .t small {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .uq .dur {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
  }
  .uq .umore {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-block-size: 36px;
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .uq .unav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-block-size: 48px;
    font-size: var(--sw-fs-base);
    color: var(--mr-text-2);
    font-weight: 500;
  }
  .uq .unav .ic {
    color: var(--mr-text-3);
    font-size: var(--sw-fs-lg);
  }

  /* ---- library ---- */
  .libg {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .libi {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px;
    padding-inline: 6px 10px;
    min-block-size: 56px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    text-align: start;
    color: var(--mr-text);
    min-inline-size: 0;
    touch-action: manipulation;
    transition: transform 120ms, border-color var(--mr-motion), background var(--mr-motion);
  }
  .libi:hover {
    border-color: var(--mr-border-strong);
    background: var(--mr-surface);
  }
  .libi:active {
    transform: scale(0.97);
  }
  .libi .gi {
    inline-size: 42px;
    block-size: 42px;
    border-radius: var(--sw-r-md);
  }
  .libi .gi .ic {
    font-size: var(--sw-fs-2xl);
  }
  .libi .t {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: 1.25;
  }
  .libi .t b {
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .libi .t small {
    font-size: var(--sw-fs-xs);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .libi[aria-current='true'] {
    border-color: var(--mr-accent);
    background: var(--mr-accent-soft);
  }
  .libi[aria-current='true'] .t b {
    color: var(--mr-accent-text);
  }
  .libi.pend .gi::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    background: rgba(0, 0, 0, 0.3);
  }
  .libi.pend .gi::after {
    content: '';
    position: absolute;
    inset: 0;
    margin: auto;
    inline-size: 18px;
    block-size: 18px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-block-start-color: #fff;
    animation: mr-spin 800ms linear infinite;
    z-index: 3;
    background: none;
    box-shadow: none;
  }
  .libi[disabled] {
    opacity: 0.5;
    pointer-events: none;
  }
  .libempty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: 56px;
    color: var(--mr-text-2);
    font-size: var(--sw-fs-base);
    font-weight: 500;
  }

  /* ---- the group section ---- */
  .gsec {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ckrow {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 48px;
    padding: 4px 8px;
    padding-inline: 12px 8px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    text-align: start;
    color: var(--mr-text);
    inline-size: 100%;
    touch-action: manipulation;
    transition: background var(--mr-motion), border-color var(--mr-motion);
  }
  .ckrow:hover {
    background: var(--mr-surface);
  }
  .ckrow .nm {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .ckrow .nm b {
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ckrow .nm small {
    font-size: var(--sw-fs-xs);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ckrow .nm small.bad {
    color: var(--mr-danger);
    font-weight: 600;
  }
  .ckrow .nm small.ok {
    color: var(--mr-success);
    font-weight: 600;
  }
  .ckrow .ck {
    position: relative;
    flex: none;
    inline-size: 26px;
    block-size: 26px;
    border-radius: 50%;
    border: 2px solid var(--mr-border-strong);
    display: grid;
    place-items: center;
    color: #fff;
    transition: background var(--mr-motion), border-color var(--mr-motion);
  }
  .ckrow .ck .ic {
    font-size: var(--sw-fs-lg);
    stroke-width: 2.6;
    opacity: 0;
  }
  .ckrow[aria-checked='true'] {
    border-color: color-mix(in srgb, var(--mr-accent) 45%, transparent);
    background: var(--mr-accent-soft);
  }
  .ckrow[aria-checked='true'] .ck {
    background: var(--mr-accent);
    border-color: var(--mr-accent);
  }
  .ckrow[aria-checked='true'] .ck .ic {
    opacity: 1;
  }
  .ckrow.lead {
    border-color: color-mix(in srgb, var(--mr-accent) 45%, transparent);
    cursor: default;
  }
  .ckrow.lead .ck {
    background: var(--mr-text);
    border-color: var(--mr-text);
  }
  .ckrow.lead .ck .ic {
    opacity: 1;
    color: var(--mr-text-inverse);
  }
  .ckrow[disabled] {
    opacity: 0.6;
    pointer-events: none;
  }
  .ckrow.warn {
    border-color: color-mix(in srgb, var(--mr-warning) 50%, transparent);
    background: color-mix(in srgb, var(--mr-warning) 14%, transparent);
  }
  .ckrow.warn > .ic {
    color: var(--mr-warning);
    font-size: var(--sw-fs-2xl);
  }
  .ckrow .gi {
    inline-size: 30px;
    block-size: 30px;
    border-radius: var(--sw-r-sm);
  }
  .ckrow .gi .ic {
    font-size: var(--sw-fs-md);
  }
  .ckrow .pendring {
    inset: -6px;
  }

  /* ---- transfer ---- */
  .ctas {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ctas .btn {
    min-block-size: 46px;
    font-size: var(--sw-fs-md);
  }
  .ctas .btn small {
    font-weight: 500;
    color: var(--mr-text-2);
  }
  .pop {
    display: flex;
    flex-direction: column;
    padding: 4px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
  }
  .pop button {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 48px;
    padding: 4px 8px;
    border: 0;
    border-radius: var(--sw-r-md);
    background: transparent;
    text-align: start;
    font-size: var(--sw-fs-base);
    font-weight: 600;
  }
  .pop button:hover {
    background: var(--mr-surface-3);
  }
  .pop .gi {
    inline-size: 32px;
    block-size: 32px;
    border-radius: var(--sw-r-md);
  }
  .pop .gi .ic {
    font-size: var(--sw-fs-lg);
  }
  .pop .cnt {
    margin-inline-start: auto;
    font-size: var(--sw-fs-sm);
    font-weight: 500;
    color: var(--mr-text-2);
    max-inline-size: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- receiver ---- */
  .modes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .modes .srci {
    min-block-size: 44px;
    padding: 8px 12px;
    flex-direction: row;
    align-items: center;
    font-size: var(--sw-fs-base);
    border-radius: var(--sw-r-lg);
    gap: 6px;
  }
  .modes .srci .ck {
    position: static;
    margin-inline-start: auto;
    font-size: var(--sw-fs-lg);
  }
  .srci > span:not(.gi):not(.ck) {
    min-inline-size: 0;
  }
  .zone-pw {
    position: relative;
  }
  .rzone {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .rzone .rng {
    flex: 1;
  }

  /* ---- confirmation (rendered inside the drawer) ---- */
  .cd-line {
    margin: 0;
    font-size: var(--sw-fs-base);
    color: var(--mr-text-2);
  }
  .cd details {
    font-size: var(--sw-fs-base);
    color: var(--mr-text-2);
  }
  .cd summary {
    cursor: pointer;
    inline-size: max-content;
    min-block-size: 32px;
    display: inline-flex;
    align-items: center;
  }
  .cd ul {
    margin: 6px 0 0;
    padding-inline-start: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .skl-row {
    display: block;
    block-size: 48px;
    border-radius: var(--sw-r-lg);
  }
`;
