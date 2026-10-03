import { css } from 'lit';
import { mediaGlassStyles } from './media-glass';

/**
 * CR-017: the look of the automations area (the list, the card, the drawer, the trace, the capture table, the runner). ALWAYS the glass
 * style of the multimedia area (styles/media-glass.ts: the `--dv-*` palette and the `--mm-*` knobs, light or dark by `devices.scheme`);
 * this file adds only the pieces that area does not have: the automation card, the state chips (the sensitive chip is amber or red by
 * the owner's setting `automations.sensitive_chip`: the screen's host sets `--au-sens-bg` / `--au-sens-fg`, which every component below inherits), the banners, the sentence box, the block rows, the
 * drawer's sections and footer. A designer who restyles the area edits this file and the two glass files; no screen changes.
 * Rules read knobs only; logical properties only (RTL is the product's default).
 */
export const automationsControls = css`
  :host {
    /* readable text on the soft success / warning fills (the palette's own colours are fills first) */
    --au-ok-text: color-mix(in srgb, var(--dv-success) 58%, #02300f);
    --au-warn-text: color-mix(in srgb, var(--dv-warning) 50%, #3d2400);
  }
  :host([data-devices-scheme='dark']) {
    --au-ok-text: var(--dv-success);
    --au-warn-text: var(--dv-warning);
  }
  .grow { flex: 1; }
  /* the switch is 28-30 px high: its hit area is 44 px (an invisible margin of the button itself) */
  .tog::before { content: ''; position: absolute; inset: -8px -4px; }
  .tog[disabled] { opacity: 0.5; pointer-events: none; }
  /* chips: state of an item, never a paragraph */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    block-size: 26px;
    padding-inline: 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
    border: 1px solid transparent;
  }
  .chip .ic { font-size: 13px; }
  .chip.ok { background: var(--dv-success-soft); color: var(--au-ok-text); }
  .chip.info { background: var(--dv-accent-soft); color: var(--dv-accent-text); }
  .chip.warn { background: var(--dv-warning-soft); color: var(--au-warn-text); }
  .chip.bad { background: var(--dv-danger-soft); color: var(--dv-danger); }
  /* the sensitive chip: amber (default) or red, the owner's setting */
  .chip.sens { background: var(--au-sens-bg, var(--dv-warning-soft)); color: var(--au-sens-fg, var(--au-warn-text)); }
  .dot { inline-size: 8px; block-size: 8px; border-radius: 50%; flex: none; background: var(--dv-offline, #98989d); }
  .dot.ok { background: #30d158; }
  .dot.bad { background: #ff453a; }
  .dot.run { background: var(--dv-accent); box-shadow: 0 0 0 3px var(--dv-accent-soft); }
  /* banners above a list or inside the drawer */
  .banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--dv-radius-md);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    font-size: 13.5px;
    font-weight: 500;
    color: var(--dv-text);
  }
  .banner > .ic { font-size: 20px; flex: none; }
  .banner b { display: block; font-size: 14px; font-weight: 700; }
  .banner small { display: block; font-size: 12.5px; font-weight: 500; color: var(--dv-text-2); margin-block-start: 2px; }
  .banner.warn { background: linear-gradient(var(--dv-warning-soft), var(--dv-warning-soft)), var(--dv-surface); border-color: color-mix(in srgb, var(--dv-warning) 38%, transparent); }
  .banner.warn > .ic { color: var(--au-warn-text); }
  .banner.bad { background: linear-gradient(var(--dv-danger-soft), var(--dv-danger-soft)), var(--dv-surface); border-color: color-mix(in srgb, var(--dv-danger) 30%, transparent); }
  .banner.bad > .ic { color: var(--dv-danger); }
  .banner.info > .ic { color: var(--dv-accent-text); }
  .banner .btn { margin-inline-start: auto; }
  /* the sentence of an item: the one Hebrew line (a short paragraph) in an accent box */
  .sentence {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px 16px;
    border-radius: var(--dv-radius-md);
    background: var(--dv-accent-soft);
    color: var(--dv-text);
    font-size: 15px;
    font-weight: 500;
    line-height: 1.55;
  }
  .sentence > .ic { font-size: 20px; color: var(--dv-accent-text); flex: none; margin-block-start: 2px; }
  .sentence small { display: block; font-size: 12.5px; color: var(--dv-text-2); margin-block-start: 3px; font-weight: 500; }
  /* drawer sections: כאשר / אם / אז, devices, runs */
  .sect { display: flex; flex-direction: column; gap: 8px; }
  .sect > h4 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--dv-text-2);
  }
  .sect > h4 .num { font-variant-numeric: tabular-nums; }
  .sect > h4 .tag {
    display: inline-grid;
    place-items: center;
    inline-size: 22px;
    block-size: 22px;
    border-radius: 7px;
    color: #fff;
    background: var(--dv-accent);
  }
  .sect > h4 .tag .ic { font-size: 13px; }
  .sect > h4 .tag.t1 { background: #ff9f0a; }
  .sect > h4 .tag.t2 { background: #8e8e93; }
  .sect > h4 .tag.t3 { background: var(--dv-accent); }
  .blk {
    display: flex;
    align-items: center;
    gap: 12px;
    min-block-size: 48px;
    padding: 8px 12px;
    border-radius: 14px;
    background: var(--dv-surface);
    border: 1px solid var(--dv-border);
    font-size: 14px;
    min-inline-size: 0;
  }
  .blk .bi {
    flex: none;
    display: grid;
    place-items: center;
    inline-size: 32px;
    block-size: 32px;
    border-radius: 50%;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .blk .bi .ic { font-size: 16px; }
  .blk .bt { flex: 1; min-inline-size: 0; }
  .blk .bt small { display: block; color: var(--dv-text-3); font-size: 12px; }
  .blk.locked { border-style: dashed; background: var(--dv-surface-2); }
  .blk.nested { margin-inline-start: 22px; }
  .blk .chip { flex: none; }
  .tpl-badge { direction: ltr; font-family: var(--sw-font-mono, monospace); font-size: 11px; padding: 1px 6px; border-radius: 6px; background: var(--dv-surface-3); color: var(--dv-text-2); }
  /* a small round back / close button on a sheet header */
  .rb.sm { inline-size: 36px; block-size: 36px; }
  .rb.sm .ic { font-size: 16px; }
  /* sheet footer and its buttons */
  .foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .foot .btn { flex: none; }
  /* inputs of the glass style */
  .fld {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 12.5px;
    color: var(--dv-text-2);
    min-inline-size: 0;
  }
  .inp {
    box-sizing: border-box;
    min-block-size: 44px;
    padding-inline: 14px;
    border-radius: var(--dv-radius-control);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    color: var(--dv-text);
    font: inherit;
    font-size: 14px;
    min-inline-size: 0;
  }
  .inp:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 1px; }
  select.inp { padding-inline: 10px; }
  .sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .empty-note { color: var(--dv-text-2); font-size: 13.5px; padding: 6px 2px; }
  @media (pointer: coarse), (max-width: 767px) {
    .rb.sm { inline-size: 44px; block-size: 44px; }
    .chip { block-size: 28px; }
  }
`;

/** The style set every component of the area starts with: the device theme layer, the media knobs, the shared controls, and this file. */
/** 0.1.157: in the bubble skin the automation / scene / script cards take the skin's large radius (the knobs already flatten them:
 * no sheen, no blur, no hairline through mediaBubbleKnobs); the banner and block rows follow the medium radius. Keyed on the
 * host's `data-skin` (applyAutomationsGlass mirrors it; the card has its own SkinController). */
export const automationsBubble = css`
  :host([data-skin='bubble']) .acard,
  :host([data-skin='bubble']) .scard,
  :host([data-skin='bubble']) .pcard {
    border-radius: var(--sw-r-lg);
  }
  :host([data-skin='bubble']) .blk,
  :host([data-skin='bubble']) .banner,
  :host([data-skin='bubble']) .sentence {
    border-radius: var(--sw-r-md);
  }
`;

export const automationsStyles = [mediaGlassStyles, automationsControls, automationsBubble];
