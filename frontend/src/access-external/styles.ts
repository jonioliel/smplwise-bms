import { css } from 'lit';

/**
 * SHAREDID-293: the shared look of the external-access screen and the identity card - tokens only (`--sw-*`), so every skin and
 * palette (light and dark) follows. Tones: ok / acc / warn / err / off map to the product's state colours.
 */
export const xCss = css`
  :host {
    --x-ok: var(--sw-success);
    --x-acc: var(--sw-accent);
    --x-warn: var(--sw-warning);
    --x-err: var(--sw-danger);
    --x-off: var(--sw-text-3);
  }
  [data-tone='ok'] { --c: var(--sw-success); --cs: var(--sw-success-soft); --ct: var(--sw-success-text); }
  [data-tone='acc'] { --c: var(--sw-accent); --cs: var(--sw-accent-soft); --ct: var(--sw-accent-text); }
  [data-tone='warn'] { --c: var(--sw-warning); --cs: var(--sw-warning-soft); --ct: var(--sw-warning-text); }
  [data-tone='err'] { --c: var(--sw-danger); --cs: var(--sw-danger-soft); --ct: var(--sw-danger-text); }
  [data-tone='off'] { --c: var(--sw-unknown); --cs: var(--sw-unknown-soft); --ct: var(--sw-unknown-text); }
  .chip {
    display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 999px; font-size: var(--sw-fs-sm);
    font-weight: 600; line-height: 20px; white-space: nowrap; max-inline-size: 100%;
    background: var(--cs, var(--sw-surface-3)); color: var(--ct, var(--sw-text-2));
  }
  .chip.door { font-weight: 500; white-space: normal; line-height: 1.35; padding-block: 3px; }
  .chip.door.add { --cs: var(--sw-success-soft); --ct: var(--sw-success-text); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; min-inline-size: 0; }
  .badge {
    display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 3px 11px; font-size: var(--sw-fs-sm);
    font-weight: 600; white-space: nowrap; line-height: 1.4; background: var(--c); color: var(--sw-text-inverse);
  }
  .badge.soft { background: var(--cs); color: var(--ct); }
  .callout {
    display: grid; grid-template-columns: auto 1fr; gap: 10px; padding: 12px; border-radius: var(--sw-r-md); font-size: var(--sw-fs-sm);
    background: var(--cs, var(--sw-accent-soft)); color: var(--sw-text); align-items: start;
  }
  .callout > sw-icon { color: var(--c, var(--x-acc)); margin-top: 1px; }
  .callout b { display: block; color: var(--sw-heading); margin-block-end: 2px; }
  .callout ul { margin: 6px 0 0; padding-inline-start: 18px; display: grid; gap: 4px; }
  .sec { display: grid; gap: 8px; }
  .sec > h4 { margin: 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: 600; display: flex; gap: 6px; align-items: center; }
  .kv { display: grid; font-size: var(--sw-fs-base); }
  .kv > div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-block-end: 1px solid var(--sw-border-strong); align-items: center; }
  .kv > div:last-child { border: 0; }
  .kv span { color: var(--sw-text-2); }
  .kv b { color: var(--sw-heading); font-weight: 600; text-align: end; min-inline-size: 0; overflow-wrap: anywhere; }
  .num, .ltr { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  .dtable { display: grid; font-size: var(--sw-fs-base); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); overflow: hidden; }
  .dtable > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 9px 12px; border-block-end: 1px solid var(--sw-border); align-items: center; }
  .dtable > div:last-child { border: 0; }
  .dtable small { display: block; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
  .ladder { display: grid; grid-template-columns: repeat(var(--n, 5), 1fr); position: relative; }
  .ladder .stp { display: grid; justify-items: center; gap: 6px; text-align: center; position: relative; font-size: var(--sw-fs-xs); color: var(--sw-text-3); line-height: 1.25; padding: 0 2px; }
  .ladder .stp::before { content: ''; position: absolute; top: 10px; inset-inline-start: calc(-50% + 12px); inset-inline-end: calc(50% + 12px); block-size: 2px; background: var(--sw-surface-3); }
  .ladder .stp:first-child::before { display: none; }
  .ladder .stp i { inline-size: 22px; block-size: 22px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-size: 12px; font-weight: 700; position: relative; z-index: 1; background: var(--sw-surface-3); color: var(--sw-text-3); }
  .ladder .stp[data-s='done'] i { background: var(--x-ok); color: var(--sw-text-inverse); }
  .ladder .stp[data-s='done']::before { background: var(--x-ok); }
  .ladder .stp[data-s='done'] { color: var(--sw-text-2); }
  .ladder .stp[data-s='cur'] i { background: var(--x-acc); color: var(--sw-text-inverse); box-shadow: 0 0 0 4px color-mix(in srgb, var(--x-acc) 20%, transparent); }
  .ladder .stp[data-s='cur'] { color: var(--x-acc); font-weight: 600; }
  .ladder .stp[data-s='unk'] i { background: transparent; border: 2px dashed var(--x-warn); color: var(--x-warn); }
  .ladder .stp[data-s='unk'] { color: var(--x-warn); font-weight: 600; }
  .ladder .stp[data-s='stop'] i { background: var(--x-err); color: var(--sw-text-inverse); }
  .ladder .stp[data-s='stop'] { color: var(--x-err); font-weight: 600; }
  .note { font-size: var(--sw-fs-xs); color: var(--sw-text-3); display: flex; gap: 6px; align-items: flex-start; margin: 0; }
  .tl { display: grid; margin: 0; padding: 0; list-style: none; }
  .tl li { display: grid; grid-template-columns: 78px 14px 1fr; gap: 8px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding-block-end: 10px; position: relative; }
  .tl li time { color: var(--sw-text-3); font-variant-numeric: tabular-nums; direction: ltr; text-align: end; }
  .tl li i { inline-size: 9px; block-size: 9px; border-radius: 50%; background: var(--c); margin-top: 5px; justify-self: center; position: relative; z-index: 1; }
  .tl li:not(:last-child)::after { content: ''; position: absolute; top: 14px; bottom: -2px; inset-inline-start: calc(78px + 8px + 6px); inline-size: 1px; background: var(--sw-border-strong); }
  .ku { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ku > div { padding: 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); display: grid; gap: 6px; align-content: start; }
  .ku h4 { margin: 0; font-size: var(--sw-fs-sm); display: flex; gap: 6px; align-items: center; }
  .ku ul { margin: 0; padding-inline-start: 18px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); display: grid; gap: 4px; }
  .ku .unk h4 { color: var(--x-warn); }
  .field { display: grid; gap: 6px; }
  .field label { font-size: var(--sw-fs-sm); font-weight: 600; color: var(--sw-text-2); }
  .field .hint { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  .field .hint.e { color: var(--x-err); font-weight: 600; }
  .in {
    min-block-size: var(--sw-touch-desktop); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface-solid);
    padding: 0 12px; inline-size: 100%; box-sizing: border-box; font: inherit; color: var(--sw-text);
  }
  .in:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 1px; }
  .in[aria-invalid='true'] { border-color: var(--x-err); }
  label.cb { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: start; padding: 8px 10px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border-strong); cursor: pointer; min-block-size: var(--sw-touch-desktop); box-sizing: border-box; }
  label.cb input { inline-size: 18px; block-size: 18px; margin: 2px 0 0; accent-color: var(--sw-accent); }
  label.cb small { display: block; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
  .stack { display: grid; gap: 14px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .row .sp { flex: 1; }
  .err-line { color: var(--x-err); font-size: var(--sw-fs-sm); font-weight: 600; margin: 0; }
  @media (max-width: 560px) {
    .ku { grid-template-columns: 1fr; }
    .tl li { grid-template-columns: 64px 14px 1fr; }
    .tl li:not(:last-child)::after { inset-inline-start: calc(64px + 8px + 6px); }
  }
`;
