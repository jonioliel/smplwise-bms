import{E as i}from"./index-Do3zNa2z.js";const w=i`
  :host {
    --gen-flow: var(--sw-accent);
    --gen-gen: var(--sw-success);
    --gen-grid: var(--sw-accent);
    /* POLISH4-WP5: the diagram's three private colours are tokens now (each scheme has its own value in the token sheet, so the
       per-scheme overrides are gone): the load is the product's purple, the wire's base a tint of the ink, the node shadow the
       overlay ink */
    --gen-load: var(--sw-purple);
    --gen-shadow: var(--sw-overlay);
    --gen-base: color-mix(in srgb, var(--sw-text) 18%, transparent);
    --gen-surface: var(--sw-surface-solid, var(--sw-surface));
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    gap: 16px;
  }
  .hero.one {
    grid-template-columns: minmax(0, 1fr);
  }
  .status-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .status-strip .big {
    font-size: var(--sw-fs-3xl);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .pulse {
    inline-size: 12px;
    block-size: 12px;
    border-radius: 50%;
    background: var(--sw-success);
    color: var(--sw-success);
    animation: gen-pulse 1.6s ease-out infinite;
  }
  .pulse.warn {
    background: var(--sw-warning);
    color: var(--sw-warning);
  }
  .pulse.err {
    background: var(--sw-danger);
    color: var(--sw-danger);
  }
  .pulse.off {
    background: var(--sw-text-3);
    animation: none;
  }
  @keyframes gen-pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 45%, transparent);
    }
    100% {
      box-shadow: 0 0 0 12px transparent;
    }
  }
  .sev {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 10px;
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
    line-height: 20px;
    white-space: nowrap;
  }
  /* POLISH-CONTROL-297: the severity chip's word is the theme's readable text token of its tone (the raw status colour on its soft tint
     fell under 4.5:1 for the warning and the cleared chips, light and dark) */
  .sev.critical {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .sev.alert {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .sev.info {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .sev.cleared {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .sev.mut {
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
  }

  /* power flow */
  svg.flow {
    direction: ltr;
    inline-size: 100%;
    block-size: auto;
    display: block;
  }
  svg.flow.vert {
    max-inline-size: 360px;
    margin-inline: auto;
  }
  .hero-card {
    padding: 20px 18px 10px;
  }
  .flow .w-base {
    fill: none;
    stroke: var(--gen-base);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .flow .w-glow {
    fill: none;
    stroke-width: 9;
    stroke-linecap: round;
    opacity: 0.35;
  }
  .flow .w-glow.gen {
    stroke: var(--gen-gen);
  }
  .flow .w-glow.grid {
    stroke: var(--gen-grid);
  }
  .flow .w-on {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
  }
  .flow .w-dot {
    fill: var(--sw-text-inverse);
    stroke-width: 1.5;
  }
  .flow .w-dot.gen {
    stroke: var(--gen-gen);
  }
  .flow .w-dot.grid {
    stroke: var(--gen-grid);
  }
  .flow .fcard {
    fill: var(--gen-surface);
  }
  .flow .fring {
    fill: none;
    stroke: var(--sw-border-strong, var(--sw-border));
    stroke-width: 1;
    opacity: 0.7;
  }
  .flow .fnode.gen:not(.dim) .fring {
    stroke: var(--gen-gen);
    opacity: 0.55;
  }
  .flow .fnode.grid:not(.dim) .fring {
    stroke: var(--gen-grid);
    opacity: 0.55;
  }
  .flow .fnode.load:not(.dim) .fring {
    stroke: var(--gen-load);
    opacity: 0.55;
  }
  .flow .fico-bg {
    fill: var(--sw-surface-3);
  }
  .flow .fnode.gen:not(.dim) .fico-bg {
    fill: color-mix(in srgb, var(--gen-gen) 16%, transparent);
  }
  .flow .fnode.grid:not(.dim) .fico-bg {
    fill: color-mix(in srgb, var(--gen-grid) 16%, transparent);
  }
  .flow .fnode.load:not(.dim) .fico-bg {
    fill: color-mix(in srgb, var(--gen-load) 16%, transparent);
  }
  .flow .fico {
    fill: none;
    stroke: var(--sw-text-3);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .flow .fnode.gen:not(.dim) .fico {
    stroke: var(--gen-gen);
  }
  .flow .fnode.grid:not(.dim) .fico {
    stroke: var(--gen-grid);
  }
  .flow .fnode.load:not(.dim) .fico {
    stroke: var(--gen-load);
  }
  .flow text {
    font-family: var(--sw-font);
  }
  .flow .ft {
    font-size: var(--sw-fs-sm);
    fill: var(--sw-text-2);
  }
  .flow .fv {
    font-size: var(--sw-fs-lg);
    font-weight: 700;
    fill: var(--sw-heading);
  }
  .flow .fs {
    font-size: var(--sw-fs-xs);
    fill: var(--sw-text-3);
  }
  .flow .fnode.dim .fv {
    fill: var(--sw-text-3);
    font-weight: 600;
  }
  .flow .fpill rect {
    fill: var(--sw-surface-3);
  }
  .flow .fpill text {
    font-size: var(--sw-fs-2xs);
    font-weight: 700;
    fill: var(--sw-text-2);
  }
  .flow .fpill circle {
    fill: var(--sw-text-3);
  }
  .flow .fpill.gen rect {
    fill: var(--sw-success-soft);
  }
  .flow .fpill.gen text,
  .flow .fpill.gen circle {
    fill: var(--gen-gen);
  }
  .flow .fpill.grid rect {
    fill: var(--sw-accent-soft);
  }
  .flow .fpill.grid text,
  .flow .fpill.grid circle {
    fill: var(--gen-grid);
  }
  .flow .fpill.err rect {
    fill: var(--sw-danger-soft);
  }
  .flow .fpill.err text,
  .flow .fpill.err circle {
    fill: var(--sw-danger);
  }
  .flow .fpill.mut circle {
    display: none;
  }
  .flow .fats .fp.grid {
    fill: var(--gen-grid);
  }
  .flow .fats .fp.gen {
    fill: var(--gen-gen);
  }
  .flow .fblade {
    stroke: var(--sw-accent);
    stroke-width: 3.2;
    stroke-linecap: round;
  }
  .flow .fats.gen .fblade {
    stroke: var(--gen-gen);
  }
  .flow .fats.grid .fblade {
    stroke: var(--gen-grid);
  }
  .flow .fblade.off {
    stroke: var(--sw-text-3);
  }
  .flow .fpivot {
    fill: var(--gen-surface);
    stroke: var(--sw-text-2);
    stroke-width: 2;
  }
  .flow .fs.c {
    fill: var(--sw-text-3);
  }
  @media (prefers-reduced-motion: reduce) {
    .flow .w-dot,
    .pulse {
      display: none;
      animation: none;
    }
  }

  /* gauges */
  .gauges {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .gauge {
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-lg);
    padding: 10px 12px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-inline-size: 0;
  }
  .gauge svg {
    inline-size: 100%;
    max-inline-size: 150px;
    block-size: auto;
    display: block;
    direction: ltr;
  }
  .gauge .track {
    fill: none;
    stroke: var(--sw-surface-3);
    stroke-width: 10;
    stroke-linecap: round;
  }
  .gauge .arc {
    fill: none;
    stroke: var(--sw-accent);
    stroke-width: 10;
    stroke-linecap: round;
  }
  .gauge .arc.ok {
    stroke: var(--sw-success);
  }
  .gauge .arc.warn {
    stroke: var(--sw-warning);
  }
  .gauge .arc.err {
    stroke: var(--sw-danger);
  }
  .gauge .gv {
    font-size: var(--sw-fs-3xl);
    font-weight: 700;
    fill: var(--sw-heading);
    font-family: var(--sw-font);
  }
  .gauge .gu {
    font-size: var(--sw-fs-xs);
    fill: var(--sw-text-3);
    font-family: var(--sw-font);
  }
  .gauge .k {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
    font-weight: 500;
    text-align: center;
  }
  .gauge .lim {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .stale {
    opacity: 0.55;
    filter: grayscale(0.5);
  }
  .pbar {
    block-size: 6px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-3);
    overflow: hidden;
    min-inline-size: 70px;
  }
  .pbar i {
    display: block;
    block-size: 100%;
    background: var(--sw-accent);
  }
  .pbar i.warn {
    background: var(--sw-warning);
  }
  .pbar i.err {
    background: var(--sw-danger);
  }
  .last-seen {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-3);
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .kpi-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
    gap: 8px;
  }
  .kpi {
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    box-shadow: var(--sw-shadow-1);
    padding: 8px 10px;
    min-inline-size: 0;
  }
  /* POLISH-CONTROL-297: the small number's label in the secondary text colour, one line (it was the faintest tier at the smallest size) */
  .kpi .k {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kpi .v {
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--sw-heading);
  }

  /* picker, notices, banners */
  .gpick {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .notice {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 14px;
    border-radius: var(--sw-r-md);
    background: var(--sw-accent-soft);
    color: var(--sw-text);
    border: 1px solid color-mix(in srgb, var(--sw-accent) 30%, transparent);
  }
  .notice.warnbox {
    background: var(--sw-warning-soft);
    border-color: color-mix(in srgb, var(--sw-warning) 35%, transparent);
  }
  .banner {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 14px;
    border-radius: var(--sw-r-md);
    background: var(--sw-warning-soft);
    border: 1px solid color-mix(in srgb, var(--sw-warning) 40%, transparent);
    flex-wrap: wrap;
  }
  .banner.err {
    background: var(--sw-danger-soft);
    border-color: color-mix(in srgb, var(--sw-danger) 40%, transparent);
  }

  /* charts */
  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }
  .chartcard {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-inline-size: 0;
  }
  .chartcard.clickable {
    cursor: pointer;
    transition: transform var(--sw-t-press) var(--sw-ease-out);
  }
  .chartcard.clickable:active {
    transform: scale(var(--sw-press-scale));
  }
  .chartcard.clickable:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  .chartcard .cur {
    font-weight: 700;
    color: var(--sw-heading);
  }
  .plot {
    position: relative;
  }
  .plot svg.chart {
    inline-size: 100%;
    block-size: 120px;
    display: block;
  }
  .plot svg.chart.big {
    block-size: 300px;
  }
  .plot .axy {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    pointer-events: none;
    direction: ltr;
  }
  .axx {
    display: flex;
    justify-content: space-between;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    direction: ltr;
  }
  .stats {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    font-size: var(--sw-fs-sm);
  }
  .nodata {
    display: grid;
    place-items: center;
    block-size: 120px;
    color: var(--sw-text-3);
  }

  /* alerts */
  .al {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 14px;
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    cursor: pointer;
    text-align: start;
    inline-size: 100%;
    font: inherit;
    color: inherit;
  }
  /* round 2 (impeccable detector: no side-tab stripe): an alert row is a flat tinted field of its severity with its icon tile */
  .al {
    transition: background-color var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .al:active {
    transform: scale(var(--sw-press-scale));
  }
  .al:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  .al.critical {
    background: color-mix(in srgb, var(--sw-danger) 7%, var(--sw-surface));
    border-color: color-mix(in srgb, var(--sw-danger) 35%, transparent);
  }
  .al.alert {
    background: color-mix(in srgb, var(--sw-warning) 7%, var(--sw-surface));
    border-color: color-mix(in srgb, var(--sw-warning) 35%, transparent);
  }
  .al.info {
    background: color-mix(in srgb, var(--sw-accent) 5%, var(--sw-surface));
  }
  @media (hover: hover) and (pointer: fine) {
    .al.info:hover {
      border-color: var(--sw-border-strong);
    }
    .al.critical:hover {
      border-color: var(--sw-danger);
    }
    .al.alert:hover {
      border-color: var(--sw-warning);
    }
  }
  .al .ic {
    inline-size: 36px;
    block-size: 36px;
    border-radius: var(--sw-r-md);
    display: grid;
    place-items: center;
    flex: none;
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
  }
  .al.critical .ic {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .al.alert .ic {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .al.info .ic {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .al .grow {
    flex: 1;
    min-inline-size: 0;
  }
  .al .t1 {
    font-weight: 700;
    color: var(--sw-heading);
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .al .t2 {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-3);
    margin-block-start: 4px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .tl {
    display: flex;
    flex-direction: column;
  }
  .tl .ev {
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: 10px;
    padding-block-end: 14px;
    position: relative;
  }
  .tl .ev::before {
    content: '';
    position: absolute;
    inset-inline-start: 10px;
    top: 20px;
    bottom: 0;
    inline-size: 2px;
    background: var(--sw-border-strong, var(--sw-border));
  }
  .tl .ev:last-child::before {
    display: none;
  }
  .tl .dot {
    inline-size: 22px;
    block-size: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
    position: relative;
    z-index: 1;
  }
  .tl .dot.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger);
  }
  .tl .dot.ok {
    background: var(--sw-success-soft);
    color: var(--sw-success);
  }
  .tl .dot.acc {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .tl .dot.warn {
    background: var(--sw-warning-soft);
    color: var(--sw-warning);
  }
  .tl .ev b {
    color: var(--sw-heading);
    font-weight: 600;
  }
  .tl .ev small {
    display: block;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .snap {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
  }
  .snap div {
    background: var(--sw-surface-2);
    border-radius: var(--sw-r-sm);
    padding: 8px 10px;
  }
  .snap div span {
    display: block;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .snap div b {
    font-size: var(--sw-fs-lg);
    color: var(--sw-heading);
  }
  .drawer-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 2px 12px;
  }
  textarea.note {
    min-block-size: 64px;
    inline-size: 100%;
    resize: vertical;
  }

  /* routing */
  table.routing th.c,
  table.routing td.c {
    text-align: center;
  }
  table.routing tr.grp td {
    background: var(--sw-surface-2);
    font-weight: 700;
    color: var(--sw-heading);
    font-size: var(--sw-fs-sm);
    padding: 7px 12px;
  }
  table.routing tr.off td:not(.c1) {
    opacity: 0.5;
  }
  table.routing tr.na td {
    color: var(--sw-text-3);
  }
  table.routing tr.pick {
    cursor: pointer;
  }
  .chs {
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .ch {
    min-inline-size: 28px;
    block-size: 28px;
    padding-inline: 8px;
    border-radius: var(--sw-r-sm);
    display: inline-grid;
    place-items: center;
    background: var(--sw-surface-3);
    color: var(--sw-text-3);
    border: 1px solid transparent;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
  }
  .ch.on {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    border-color: color-mix(in srgb, var(--sw-accent) 35%, transparent);
  }
  .ch.soon {
    opacity: 0.4;
    border-style: dashed;
    border-color: var(--sw-border-strong, var(--sw-border));
  }
  .rec {
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .rec span {
    padding: 1px 8px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    white-space: nowrap;
  }
  .rec span.usr {
    background: var(--sw-success-soft);
    color: var(--sw-success);
  }
  .chooser {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .chooser label {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    background: var(--gen-surface);
    min-block-size: var(--elec-touch);
  }
  .chooser label.on {
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
  }
  .chooser label.dis {
    opacity: 0.45;
  }
  .preview {
    border: 1px dashed var(--sw-border-strong, var(--sw-border));
    border-radius: var(--sw-r-sm);
    padding: 8px 10px;
    background: var(--sw-surface-2);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .vars code {
    background: var(--sw-surface-3);
    border-radius: var(--sw-r-2xs);
    padding: 0 4px;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .det {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 14px;
    align-items: center;
  }
  .det .ic {
    inline-size: 44px;
    block-size: 44px;
    border-radius: var(--sw-r-md);
    display: grid;
    place-items: center;
    background: var(--sw-success-soft);
    color: var(--sw-success);
  }
  .det .ic.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger);
  }
  .det b {
    display: block;
    color: var(--sw-heading);
  }
  .det small {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .only-phone {
    display: none !important;
  }
  .th-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .map-row {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.6fr) auto;
    gap: 10px;
    align-items: center;
    padding: 8px 12px;
    border-block-end: 1px solid var(--sw-border);
  }

  @media (max-width: 1100px) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
    }
    .gauges {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
  }
  @media (max-width: 767px) {
    .status-strip .big {
      font-size: var(--sw-fs-xl);
    }
    .hero-card {
      padding: 14px 10px 6px;
    }
    .gauges {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .gauges.n1,
    .gauges.n3 {
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    }
    .gauge .gv {
      font-size: var(--sw-fs-2xl);
    }
    .plot svg.chart.big {
      block-size: 220px;
    }
    .charts {
      grid-template-columns: minmax(0, 1fr);
    }
    .only-phone {
      display: flex !important;
    }
    .al {
      flex-wrap: wrap;
    }
    .al .grow {
      flex-basis: calc(100% - 50px);
    }
    .al > .btn {
      margin-inline-start: auto;
    }
    .chooser {
      grid-template-columns: minmax(0, 1fr);
    }
    .det {
      grid-template-columns: auto 1fr;
    }
    /* POLISH4-WP5: the history filters were a sideways-scrolling strip of full-width fields on a phone (each select took the whole row's
       width); they are a two-column grid now - the search and the window switch take the full row, the selects pair up - so every
       filter is in view without a sideways scroll */
    .filters {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .filters > input[type='search'],
    .filters > .seg,
    .filters > .btn {
      grid-column: 1 / -1;
    }
    .filters > .seg {
      display: flex;
      flex-wrap: nowrap;
    }
    .filters > .seg > button {
      flex: 1 1 0;
      min-inline-size: 0;
    }
    .map-row {
      grid-template-columns: minmax(0, 1fr);
    }
    table.phase td:nth-child(5),
    table.phase th:nth-child(5) {
      display: none;
    }
    table.phase td,
    table.phase th {
      padding-inline: 8px;
      white-space: nowrap;
    }
  }
`,t={page:"יומן הפעלות",title:"יומן הפעלות הגנרטור",sub:"כל הפעלה של המנוע, נגזרת מקריאות הבקר. צפייה בלבד.",r7d:"7 ימים",r30d:"30 יום",r90d:"90 יום",r365d:"שנה",kindAll:"כל הסוגים",kind_test:"מבחן",kind_mains_failure:"הפסקת רשת",kind_manual:"ידני",kind_other:"אחר",kpiRuns:"הפעלות",kpiHours:"שעות עבודה",kpiFuel:"דלק שנצרך",kpiRefills:"מילויי דלק",kpiLastTest:"מבחן אחרון",kpiCounter:"מונה שעות הבקר",byKind:"{t} מבחנים · {m} הפסקות רשת · {o} אחרות",noTest:"לא נרשם מבחן",testOverdue:"מבחן באיחור",testDue:"הבא עד {t}",runningNow:"הגנרטור פועל עכשיו · {kind} · {d}",colStart:"התחלה",colKind:"סוג",colDur:"משך",colHours:"שעות",colFuel:"דלק",colLoad:"עומס",colEnd:"סיום",open:"פועל",noLoad:"ללא עומס",loadPeak:"שיא {n}%",loaded:"בעומס",short:"מבחן קצר",noData:"נסגר ללא נתונים",empty:"לא נרשמו הפעלות בטווח",emptyBody:"היומן מתמלא אוטומטית מרגע שהגנרטור פועל.",page_of:"עמוד {p} מתוך {n}",prev:"הקודם",next:"הבא",fuelTitle:"אירועי דלק",fuelRefill:"מילוי {a}% ← {b}%",fuelDrop:"ירידה במנוחה {a}% ← {b}%",fuelNone:"אין אירועי דלק בטווח",min:"דק׳",h:"ש׳",why_mode_test:"הבקר במצב מבחן",why_start_reason:"לפי סיבת ההתנעה בבקר",why_mains_lost:"הרשת נפלה",why_mode_manual:"הבקר במצב ידני",why_unloaded:"ריצה ללא עומס כשהרשת תקינה",why_none:"ללא סימן מזהה",loadError:"לא ניתן לטעון את יומן ההפעלות",off:"יומן ההפעלות כבוי",setSub:"יומן הפעלות",setIntro:"יומן ההפעלות נגזר מקריאות הבקר ואינו שולח דבר לבקר. כל הספים והחלונות כאן.",setEnabled:"הצגת יומן ההפעלות במסך הגנרטור",set_min_run_s:"ריצה קצרה מזה אינה נרשמת (שניות)",set_mains_lookback_s:"הרשת נפלה עד כך לפני ההתנעה = הפסקת רשת (שניות)",set_test_min_minutes:'מבחן קצר מזה מסומן "מבחן קצר" (דקות)',set_test_max_minutes:"ריצה ללא עומס ארוכה מזה אינה מבחן (דקות)",set_classify_unloaded_as_test:"ריצה ללא עומס כשהרשת תקינה נחשבת מבחן",set_test_interval_days:"מרווח המבחנים הצפוי (ימים, 0 = ללא מעקב)",set_no_data_close_min:"ריצה ללא קריאות נסגרת אחרי (דקות)",set_refill_min_pct:"עלייה במפלס שנחשבת מילוי (%)",set_refill_settle_min:"המילוי נסגר אחרי שהמפלס יציב (דקות)",set_drop_min_pct:"ירידה במנוחה שנרשמת לבדיקה (%)",set_fuel_window_h:"חלון ההשוואה של מפלס הדלק (שעות)",set_retention_days:"שמירת היומן (ימים)"},l={page:"Run log",title:"Generator run log",sub:"Every engine run, derived from the controller readings. View only.",r7d:"7 days",r30d:"30 days",r90d:"90 days",r365d:"Year",kindAll:"All kinds",kind_test:"Test",kind_mains_failure:"Mains failure",kind_manual:"Manual",kind_other:"Other",kpiRuns:"Runs",kpiHours:"Run hours",kpiFuel:"Fuel used",kpiRefills:"Refills",kpiLastTest:"Last test",kpiCounter:"Controller hour meter",byKind:"{t} tests · {m} mains failures · {o} other",noTest:"No test recorded",testOverdue:"Test overdue",testDue:"Next by {t}",runningNow:"The generator is running now · {kind} · {d}",colStart:"Start",colKind:"Kind",colDur:"Duration",colHours:"Hours",colFuel:"Fuel",colLoad:"Load",colEnd:"End",open:"Running",noLoad:"No load",loadPeak:"Peak {n}%",loaded:"On load",short:"Short test",noData:"Closed without data",empty:"No runs in this range",emptyBody:"The log fills itself as soon as the generator runs.",page_of:"Page {p} of {n}",prev:"Previous",next:"Next",fuelTitle:"Fuel events",fuelRefill:"Refill {a}% → {b}%",fuelDrop:"Drop at rest {a}% → {b}%",fuelNone:"No fuel events in this range",min:"min",h:"h",why_mode_test:"Controller in test mode",why_start_reason:"From the controller start reason",why_mains_lost:"Mains lost",why_mode_manual:"Controller in manual mode",why_unloaded:"Unloaded run with the mains present",why_none:"No identifying signal",loadError:"The run log could not be loaded",off:"The run log is off",setSub:"Run log",setIntro:"The run log is derived from the controller readings and never sends anything to the controller. Every threshold and window is here.",setEnabled:"Show the run log on the generator screen",set_min_run_s:"A run shorter than this is not logged (seconds)",set_mains_lookback_s:"Mains lost this long before the start = mains failure (seconds)",set_test_min_minutes:'A test shorter than this is marked "short test" (minutes)',set_test_max_minutes:"An unloaded run longer than this is not a test (minutes)",set_classify_unloaded_as_test:"An unloaded run with the mains present counts as a test",set_test_interval_days:"Expected test interval (days, 0 = not tracked)",set_no_data_close_min:"A run without readings closes after (minutes)",set_refill_min_pct:"A level rise that counts as a refill (%)",set_refill_settle_min:"A refill closes once the level is stable (minutes)",set_drop_min_pct:"A drop at rest logged for a check (%)",set_fuel_window_h:"Fuel level comparison window (hours)",set_retention_days:"Keep the log (days)"},d={page:"سجل التشغيل",title:"سجل تشغيل المولد",kind_test:"اختبار",kind_mains_failure:"انقطاع الشبكة",kind_manual:"يدوي",kind_other:"آخر",kpiRuns:"مرات التشغيل",kpiHours:"ساعات العمل",kpiFuel:"الوقود المستهلك",empty:"لا توجد مرات تشغيل في النطاق",prev:"السابق",next:"التالي"},c={page:"Журнал запусков",title:"Журнал запусков генератора",kind_test:"Тест",kind_mains_failure:"Отключение сети",kind_manual:"Вручную",kind_other:"Другое",kpiRuns:"Запуски",kpiHours:"Моточасы",kpiFuel:"Израсходовано топлива",empty:"Нет запусков в диапазоне",prev:"Назад",next:"Далее"};function p(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}const f={he:t,en:l,ar:d,ru:c};function u(e,r,o=p()){const a=f[o][e]??t[e]??e;return r?a.replace(/\{(\w+)\}/g,(n,s)=>s in r?String(r[s]):n):a}export{u as a,w as g};
//# sourceMappingURL=generator-log-BsNDe5Q8.js.map
