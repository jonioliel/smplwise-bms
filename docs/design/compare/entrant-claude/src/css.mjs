import { cssBlock } from './tokens.mjs';
import { current } from './skin.mjs';

// Fonts are local under boards/fonts/; skin boards live one level deeper (boards/<skin>/), hence the prefix.
export const fontFace = (prefix = 'fonts/') => [400, 500, 600, 700].map((w) => `
@font-face{font-family:"Heebo";font-style:normal;font-weight:${w};font-display:swap;src:url("${prefix}heebo-hebrew-${w}.woff2") format("woff2");unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:"Heebo";font-style:normal;font-weight:${w};font-display:swap;src:url("${prefix}heebo-latin-${w}.woff2") format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`).join('');

export const tokensCss = () => `
:root, [data-scheme="light"], .scheme-light { color-scheme: light;
${cssBlock('light')}
}
[data-scheme="dark"], .scheme-dark { color-scheme: dark;
${cssBlock('dark')}
}`;

export const skinRules = () => `\n/* ---------- skin rules: ${current().id} ---------- */\n${current().rules}`;

// The shared structure. Every value is a token; no material (blur, glow, highlight, gradients) lives here —
// those are per-skin rules. A render with no skin rules is a plain, flat, correct version of every board.
export const baseCss = `
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:var(--sw-font);font-size:var(--sw-fs-md);line-height:var(--sw-lh);color:var(--sw-text);background:var(--sw-bg);min-height:100vh;-webkit-font-smoothing:antialiased;font-variant-numeric:var(--sw-nums)}
.canvas{background:var(--sw-canvas) fixed,var(--sw-bg)}
.scheme-light,.scheme-dark{color:var(--sw-text);background:var(--sw-canvas),var(--sw-bg);font-variant-numeric:var(--sw-nums)}
h1,h2,h3{color:var(--sw-heading);line-height:var(--sw-lh-tight);font-weight:var(--sw-fw-bold)}
a{color:var(--sw-accent-text);text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.ic{display:inline-block;vertical-align:middle;flex:none}
[dir="ltr"] .ic-dir, .ltr .ic-dir{transform:scaleX(-1)}
.num,.mono{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}
.mono{font-family:var(--sw-font-mono)}
.muted{color:var(--sw-text-2)} .faint{color:var(--sw-text-3)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* ---------- surfaces: L1 panel, L2 nested, L3 inset (material per skin) ---------- */
.glass{position:relative;background:var(--sw-surface);border:1px solid var(--sw-border);border-radius:var(--sw-r-lg);box-shadow:var(--sw-shadow-1)}
.glass-2{background:var(--sw-surface-2);border:1px solid var(--sw-border);border-radius:var(--sw-r-md)}
.inset{background:var(--sw-surface-3);border-radius:var(--sw-r-sm)}
.solid .glass,.solid.glass{background:var(--sw-surface-solid);-webkit-backdrop-filter:none;backdrop-filter:none}
.solid .glass-2,.solid.glass-2{background:var(--sw-surface-2-solid)}
.solid .inset,.solid.inset{background:var(--sw-surface-3-solid)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.glass{background:var(--sw-surface-solid)}.glass-2{background:var(--sw-surface-2-solid)}.inset{background:var(--sw-surface-3-solid)}}
@media (prefers-reduced-transparency:reduce){.glass{background:var(--sw-surface-solid);-webkit-backdrop-filter:none;backdrop-filter:none}.glass-2{background:var(--sw-surface-2-solid)}.inset{background:var(--sw-surface-3-solid)}}
@media (prefers-contrast:more){.glass{background:color-mix(in srgb,var(--sw-surface-solid) 94%,transparent)}.glass-2{background:var(--sw-surface-2-solid)}.glass,.glass-2{border-color:var(--sw-border-strong)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{transition-duration:0ms!important;animation-duration:0ms!important}.lift:hover{transform:none!important}}
.lift{transition:transform var(--sw-t-fast) var(--sw-ease),box-shadow var(--sw-t-fast) var(--sw-ease)}
.lift:hover{transform:translateY(var(--sw-hover-lift));box-shadow:var(--sw-shadow-2)}

/* ---------- focus ---------- */
.focus,:focus-visible{outline:var(--sw-focus-w) solid var(--sw-focus);outline-offset:var(--sw-focus-offset)}
.focus-video{outline:0;box-shadow:0 0 0 2px var(--sw-text-inverse),0 0 0 4px var(--sw-focus)}

/* ---------- shell: rail (a flush column by default; skins float it or rule it) ---------- */
.app{display:grid;grid-template-columns:var(--sw-rail-w) 1fr;min-height:100vh}
.rail{position:sticky;top:0;height:100vh;padding:0}
.rail-in{height:100%;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:0;border-inline-end:1px solid var(--sw-border)}
.brand{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;margin-bottom:10px;color:#fff;font-weight:800;font-size:20px;letter-spacing:-.5px;background:var(--sw-accent)}
.rail-item{position:relative;width:100%;min-height:var(--nav-item-h,64px);padding:8px 4px 6px;border-radius:var(--sw-r-md);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--sw-text-2);font-size:var(--nav-label,12px);font-weight:var(--sw-fw-medium);line-height:1;transition:background var(--sw-t-fast) var(--sw-ease),color var(--sw-t-fast) var(--sw-ease)}
.rail-item .ic{width:var(--nav-icon,25px);height:var(--nav-icon,25px)}
.rail-item:hover,.rail-item.hover{background:var(--sw-surface-3);color:var(--sw-text)}
.rail-item.active{background:var(--sw-accent-soft);color:var(--sw-accent-text)}
.rail-item.nolabel{gap:0}
.rail-spacer{flex:1}
.avatar{position:relative;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-weight:var(--sw-fw-semibold);font-size:var(--sw-fs-sm);color:var(--sw-accent-text);background:var(--sw-accent-soft);border:1px solid var(--sw-border)}
.avatar.lg{width:44px;height:44px;font-size:var(--sw-fs-md)}
.avatar .adot{position:absolute;top:-1px;inset-inline-end:-1px;width:10px;height:10px;border-radius:50%;background:var(--sw-danger);border:2px solid var(--sw-surface-solid)}
.rail-foot{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0;font-size:var(--nav-label,12px);color:var(--sw-text-2)}
.rail-s{--nav-item-h:46px;--nav-icon:18px;--nav-label:10px}.rail-m{--nav-item-h:52px;--nav-icon:20px;--nav-label:10.5px}.rail-l{--nav-item-h:64px;--nav-icon:25px;--nav-label:12px}.rail-xl{--nav-item-h:76px;--nav-icon:30px;--nav-label:13.5px}

/* ---------- shell: phone bottom bar ---------- */
.bar{position:sticky;bottom:0;z-index:var(--sw-z-topbar);display:flex;align-items:stretch;justify-content:space-around;padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px));min-height:var(--sw-bottomnav-h);border-top:1px solid var(--sw-border);background:var(--sw-surface)}
.solid .bar{background:var(--sw-surface-solid)}
.bar-item{flex:1;min-width:44px;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--sw-text-2);font-size:11.5px;font-weight:var(--sw-fw-medium);border-radius:var(--sw-r-md)}
.bar-item .pill{width:52px;height:30px;border-radius:var(--sw-r-pill);display:grid;place-items:center;transition:background var(--sw-t-fast) var(--sw-ease)}
.bar-item.active{color:var(--sw-accent-text)}
.bar-item .avatar{width:30px;height:30px;font-size:11px}

/* ---------- corner float ---------- */
.corner{position:absolute;top:14px;inset-inline-end:16px;z-index:var(--sw-z-map-ui);display:flex;align-items:center;gap:2px;padding:4px;border-radius:var(--sw-r-pill);background:var(--sw-surface);border:1px solid var(--sw-border);box-shadow:var(--sw-shadow-1)}
.corner .cbtn{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:var(--sw-text)}
.corner .cbtn:hover{background:var(--sw-surface-3)}
.corner .health{width:36px;height:36px;display:grid;place-items:center}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--sw-offline);flex:none}
.dot.live,.dot.ok{background:var(--sw-live)} .dot.stale,.dot.warn{background:var(--sw-stale)} .dot.error,.dot.forbidden{background:var(--sw-forbidden)} .dot.unknown{background:var(--sw-unknown)} .dot.on{background:rgb(var(--sw-on-warm))} .dot.recorded{background:var(--sw-recorded)}
.dot.lg{width:10px;height:10px}

/* ---------- page ---------- */
.content{position:relative;min-width:0}
.page{padding:var(--sw-page-pad);padding-block-start:22px;display:flex;flex-direction:column;gap:16px;min-height:100vh}
.crumbs{display:flex;align-items:center;gap:6px;font-size:var(--sw-fs-sm);color:var(--sw-text-3)}
.crumbs .ic{width:14px;height:14px;opacity:.7}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.page > .head:first-child,.ahead .top,.page > .sections{padding-inline-end:132px} /* room for the floating corner */
.h1{font-size:var(--sw-h1);font-weight:var(--sw-h1-weight);letter-spacing:var(--sw-h1-tracking);line-height:var(--sw-h1-lh)}
.sub{margin-top:6px;font-size:var(--sw-fs-lg);color:var(--sw-text-2)}
.h2{font-size:var(--sw-h2);letter-spacing:var(--sw-h2-tracking)}
.sec-title{font-size:var(--sw-fs-section);font-weight:var(--sw-fw-section);color:var(--sw-heading)}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.row.between{justify-content:space-between}
.grow{flex:1;min-width:0}
/* ambient facts line under a title: glyph + number pairs */
.facts{display:flex;gap:6px 14px;flex-wrap:wrap;font-size:var(--sw-fs-sm);color:var(--sw-text-2);font-variant-numeric:tabular-nums}
.facts span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.facts .ic{width:15px;height:15px;color:var(--sw-text-3)}
.facts b{color:var(--sw-text);font-weight:var(--sw-fw-semibold)}
.facts .on b{color:var(--sw-role-warm-fg)}
/* floor / view switch button with chevron */
.fbtn{display:inline-flex;align-items:center;gap:6px;min-height:var(--sw-touch);padding:0 14px 0 10px;border-radius:var(--sw-r-sm);border:1px solid var(--sw-border-strong);background:var(--sw-surface-2);color:var(--sw-heading);font-size:var(--sw-fs-lg);font-weight:var(--sw-fw-semibold)}
.fbtn .ic{width:18px;height:18px;rotate:90deg;color:var(--sw-text-3)}

/* ---------- card / tile ---------- */
.card{padding:var(--sw-card-pad)}
.card.flush{padding:0;overflow:hidden}
.card-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.card-head .sec-title{flex:1;min-width:0;display:flex;align-items:center;gap:6px}
.card-head .count{color:var(--sw-text-2);font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-regular);white-space:nowrap}
.card-head .sec-title > span:first-child,.card-head .sec-title .tt{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-head .disc{width:16px;height:16px;color:var(--sw-text-3)}
.dbadge{width:var(--sw-icon-ring);height:var(--sw-icon-ring);border-radius:12px;display:grid;place-items:center;color:var(--role-fg,var(--sw-accent-text));background:rgb(var(--role,var(--sw-role-accent)) / var(--sw-role-fill-a));flex:none}
.dbadge .ic{width:20px;height:20px}
.dbadge.lg{width:var(--sw-icon-ring-lg);height:var(--sw-icon-ring-lg);border-radius:14px} .dbadge.lg .ic{width:24px;height:24px}
.ring{width:var(--sw-icon-ring);height:var(--sw-icon-ring);border-radius:50%;display:grid;place-items:center;background:var(--sw-surface-3);color:var(--sw-text);flex:none}
.ring .ic{width:19px;height:19px}
.card.interactive{cursor:pointer}

/* KPI */
.kpi{display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 14px;border-radius:var(--sw-r-md);text-align:start;width:100%}
.kpi .ring{background:rgb(var(--tone,var(--sw-role-neutral)) / var(--sw-role-fill-a));color:var(--tone-fg,var(--sw-text))}
.kpi .kv{font-size:22px;font-weight:var(--sw-fw-bold);color:var(--sw-heading);line-height:1.1;font-variant-numeric:tabular-nums}
.kpi .kl{font-size:var(--sw-fs-sm);color:var(--sw-text-2);margin-top:2px}
.kpi .kd{font-size:var(--sw-fs-xs);color:var(--sw-live-text);font-weight:var(--sw-fw-semibold)}
.kpi.cards{flex-direction:column;align-items:flex-start;min-height:120px;padding:16px}
.kpi.cards .kv{font-size:28px}
.kpi .badge{margin-inline-start:auto}
.kpi.live{--tone:var(--sw-role-success);--tone-fg:var(--sw-role-success-fg)} .kpi.stale{--tone:var(--sw-role-warning);--tone-fg:var(--sw-role-warning-fg)} .kpi.forbidden{--tone:var(--sw-role-danger);--tone-fg:var(--sw-role-danger-fg)} .kpi.accent{--tone:var(--sw-role-accent);--tone-fg:var(--sw-role-accent-fg)} .kpi.warm{--tone:var(--sw-role-warm);--tone-fg:var(--sw-role-warm-fg)} .kpi.cool{--tone:var(--sw-role-cool);--tone-fg:var(--sw-role-cool-fg)}

/* badge */
.badge{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:var(--sw-r-pill);font-size:var(--sw-fs-xs);font-weight:var(--sw-fw-semibold);color:var(--b,var(--sw-text-2));background:var(--bs,var(--sw-surface-3));white-space:nowrap}
.badge .dot{background:var(--bd,currentColor);width:6px;height:6px}
.badge.live{--b:var(--sw-live-text);--bd:var(--sw-live);--bs:var(--sw-live-soft)} .badge.recorded{--b:var(--sw-recorded-text);--bd:var(--sw-recorded);--bs:var(--sw-recorded-soft)} .badge.offline{--b:var(--sw-offline-text);--bd:var(--sw-offline);--bs:var(--sw-offline-soft)} .badge.stale{--b:var(--sw-stale-text);--bd:var(--sw-stale);--bs:var(--sw-stale-soft)} .badge.unknown{--b:var(--sw-unknown-text);--bd:var(--sw-unknown);--bs:var(--sw-unknown-soft)} .badge.forbidden{--b:var(--sw-forbidden-text);--bd:var(--sw-forbidden);--bs:var(--sw-forbidden-soft)} .badge.error{--b:var(--sw-danger-text);--bd:var(--sw-danger);--bs:var(--sw-danger-soft)} .badge.partial{--b:var(--sw-purple-text);--bd:var(--sw-purple);--bs:rgba(124,92,240,.14)} .badge.historic{--b:var(--sw-text-2);--bs:var(--sw-surface-3)}
.badge.image{--b:#fff;--bs:rgba(8,12,20,.72)}
.badge.count{--b:var(--sw-text-inverse);--bs:var(--sw-danger);height:18px;padding:0 6px;min-width:18px;justify-content:center}

/* ---------- buttons ---------- */
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:var(--sw-control-h);padding:0 14px;border-radius:var(--sw-r-sm);font-weight:var(--sw-fw-medium);font-size:var(--sw-fs-md);white-space:nowrap;border:1px solid transparent;transition:background var(--sw-t-fast) var(--sw-ease),color var(--sw-t-fast) var(--sw-ease),box-shadow var(--sw-t-fast) var(--sw-ease)}
.btn .ic{width:18px;height:18px}
.btn.sm{height:var(--sw-control-h-sm);padding:0 10px;font-size:var(--sw-fs-sm)} .btn.sm .ic{width:16px;height:16px}
.btn.lg{height:var(--sw-control-h-lg);padding:0 18px;font-size:var(--sw-fs-lg);border-radius:var(--sw-r-md)}
.btn.touch::after{content:"";position:absolute;inset:50% auto auto 50%;translate:-50% -50%;width:max(100%,44px);height:max(100%,44px)}
.btn.primary{background:var(--sw-accent);color:var(--sw-text-inverse)}
.btn.primary:hover,.btn.primary.hover{background:var(--sw-accent-hover)}
.btn.secondary{background:var(--sw-surface-2);border-color:var(--sw-border-strong);color:var(--sw-text)}
.btn.secondary:hover,.btn.secondary.hover{background:var(--sw-surface-3)}
.btn.ghost{color:var(--sw-text-2)} .btn.ghost:hover,.btn.ghost.hover{background:var(--sw-surface-3);color:var(--sw-text)}
.btn.danger{color:var(--sw-danger-text);border-color:color-mix(in srgb,var(--sw-danger) 45%,transparent);background:var(--sw-danger-soft)}
.btn.danger:hover,.btn.danger.hover{background:var(--sw-danger);color:#fff}
.btn.danger.fill{background:var(--sw-danger);color:#fff;border-color:transparent}
.btn.icon{width:var(--sw-control-h);padding:0} .btn.icon.sm{width:var(--sw-control-h-sm)} .btn.icon.lg{width:var(--sw-control-h-lg)}
.btn.round{border-radius:50%}
.btn:disabled,.btn.disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
.btn.active{background:var(--sw-accent-soft);color:var(--sw-accent-text)}

/* master control */
.master{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--sw-accent);color:var(--sw-accent-text);position:relative;background:var(--sw-surface-2);flex:none}
.master.on{background:var(--sw-accent);color:var(--sw-text-inverse);border-color:transparent}
.master .badge.count{position:absolute;top:-4px;inset-inline-end:-4px}

/* ---------- segmented / tabs / chips ---------- */
.seg{display:inline-flex;padding:3px;border-radius:var(--sw-r-pill);background:var(--sw-surface-3);gap:2px;position:relative}
.seg > *{min-height:32px;padding:0 14px;border-radius:var(--sw-r-pill);display:inline-flex;align-items:center;gap:6px;font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-medium);color:var(--sw-text-2);transition:color var(--sw-t-fast) var(--sw-ease);white-space:nowrap}
.seg > .on{background:var(--sw-surface-2-solid);color:var(--sw-heading)}
.seg > *:hover:not(.on){color:var(--sw-text)}
.seg.lg > *{min-height:38px;padding:0 16px;font-size:var(--sw-fs-md)}
.seg.disabled{opacity:.45}
.seg .ic{width:16px;height:16px}
.tabs{display:flex;gap:4px;align-items:center;overflow:hidden;position:relative}
.tabs .tab{min-height:36px;padding:0 14px;border-radius:var(--sw-r-pill);display:inline-flex;align-items:center;gap:6px;font-size:var(--sw-fs-md);font-weight:var(--sw-fw-medium);color:var(--sw-text-2);white-space:nowrap;transition:background var(--sw-t-fast) var(--sw-ease)}
.tabs .tab:hover,.tabs .tab.hover{background:var(--sw-surface-3);color:var(--sw-text)}
.tabs .tab.on{background:var(--sw-surface-2);color:var(--sw-accent-text)}
.tabs .tab .n{font-size:var(--sw-fs-xs);color:var(--sw-text-3);font-variant-numeric:tabular-nums}
.tabs.fade::after{content:"";position:absolute;inset:0 auto 0 0;width:48px;background:linear-gradient(to right,var(--sw-bg),transparent);pointer-events:none}
.tabs.underline{gap:0;border-bottom:1px solid var(--sw-border)}
.tabs.underline .tab{border-radius:0;min-height:44px;padding:0 12px;position:relative}
.tabs.underline .tab.on{background:none;border:0;box-shadow:none;color:var(--sw-accent-text)}
.tabs.underline .tab.on::after{content:"";position:absolute;inset-inline:10px;bottom:-1px;height:2px;border-radius:1px;background:var(--sw-accent)}
.tabs.rooms .tab{min-height:40px;font-size:var(--sw-fs-lg)}
.chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:var(--sw-r-pill);font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-medium);color:var(--sw-text);background:var(--sw-surface-2);border:1px solid var(--sw-border);white-space:nowrap}
.chip .ic{width:15px;height:15px;color:var(--sw-text-2)}
.chip.sel{background:var(--sw-accent-soft);border-color:color-mix(in srgb,var(--sw-accent) 40%,transparent);color:var(--sw-accent-text)}
.chip.sel .ic{color:inherit}
.chip .n{color:var(--sw-text-3);font-variant-numeric:tabular-nums}
.chip.warm{background:rgb(var(--sw-role-warm) / var(--sw-role-fill-a));border-color:rgb(var(--sw-role-warm) / .35);color:var(--sw-role-warm-fg)} .chip.warm .ic{color:inherit}
.chip.disabled{opacity:.45}
.chip.ghost{background:transparent;border-style:dashed;color:var(--sw-text-3)} .chip.ghost .ic{color:inherit}

/* ---------- toggle ---------- */
.tg{position:relative;display:inline-flex;align-items:center;gap:10px;min-height:44px;cursor:pointer}
.tg .tr{width:46px;height:28px;border-radius:var(--sw-r-pill);background:var(--sw-surface-3);border:1px solid var(--sw-border);position:relative;transition:background var(--sw-t-med) var(--sw-ease);flex:none}
.tg .tr::after{content:"";position:absolute;top:2px;inset-inline-start:2px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:var(--sw-shadow-thumb);transition:translate var(--sw-t-med) var(--sw-ease-thumb)}
.tg.on .tr{background:var(--sw-toggle-on);border-color:transparent}
.tg.on .tr::after{translate:18px 0}
[dir="rtl"] .tg.on .tr::after,.rtl .tg.on .tr::after{translate:-18px 0}
.tg.disabled{opacity:.45;cursor:not-allowed}
.tg.small .tr{width:40px;height:24px} .tg.small .tr::after{width:18px;height:18px} .tg.small.on .tr::after{translate:16px 0} [dir="rtl"] .tg.small.on .tr::after{translate:-16px 0}

/* ---------- device tile ---------- */
.tile{position:relative;display:flex;align-items:center;gap:12px;min-height:var(--sw-row-h);padding:8px 10px 8px 12px;border-radius:var(--sw-r-md);background:var(--sw-surface-2);border:1px solid var(--sw-border);transition:transform var(--sw-t-fast) var(--sw-ease),box-shadow var(--sw-t-fast) var(--sw-ease)}
.tile .tname{font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold);color:var(--sw-heading);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile .tstate{font-size:var(--sw-fs-sm);color:var(--sw-text-2);margin-top:2px;white-space:nowrap}
.tile .tbody{flex:1;min-width:0}
.tile .tctl{margin-inline-start:auto;display:flex;align-items:center;gap:6px}
.tile.on{--g:var(--sw-on-cool);border-color:rgb(var(--g) / var(--sw-glow-border))}
.tile.on.warm{--g:var(--sw-on-warm)} .tile.on.switch{--g:var(--sw-on-switch)}
.tile.on .tstate{color:var(--sw-text)}
.tile.unavail{border-style:dashed;background:transparent}
.tile.unavail .tname{color:var(--sw-text-2)} .tile.unavail .tstate{color:var(--sw-text-3)} .tile.unavail .ring{opacity:.6}
.tile.col{flex-wrap:wrap}
.tile.col{grid-column:1 / -1}
.tile .slider{flex-basis:100%;margin-top:4px}
.slider{position:relative;height:28px;display:flex;align-items:center}
.slider .track{height:6px;width:100%;border-radius:3px;background:var(--sw-surface-3);overflow:hidden}
.slider .fill{height:100%;background:var(--sw-accent);border-radius:3px}
.slider .thumb{position:absolute;top:50%;translate:50% -50%;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:var(--sw-shadow-thumb),0 0 0 1px rgba(0,0,0,.05)}
.slider .thumb::after{content:"";position:absolute;inset:-11px}
.stepper{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:var(--sw-r-pill);background:var(--sw-surface-3)}
.stepper .btn{width:36px;height:36px;padding:0;border-radius:50%;background:var(--sw-surface-2-solid);box-shadow:var(--sw-shadow-thumb)}
.stepper .val{min-width:56px;text-align:center;font-weight:var(--sw-fw-bold);font-size:var(--sw-fs-lg);color:var(--sw-heading);font-variant-numeric:tabular-nums}
.cover-ctl{display:inline-flex;gap:4px}
.cover-ctl .btn{width:36px;height:36px;padding:0;border-radius:var(--sw-r-sm);background:var(--sw-surface-3)}
.cover-ctl .btn.on{background:var(--sw-accent-soft);color:var(--sw-accent-text)}
.bar-ind{height:4px;border-radius:2px;background:var(--sw-surface-3);flex-basis:100%;overflow:hidden;margin-top:2px}
.bar-ind i{display:block;height:100%;background:var(--sw-accent);border-radius:2px}

/* sensor tile */
.sens{display:flex;align-items:center;gap:10px;min-height:56px;padding:8px 12px;border-radius:var(--sw-r-md);background:var(--sw-surface-2);border:1px solid var(--sw-border)}
.sens .sv{font-size:20px;font-weight:var(--sw-fw-bold);color:var(--sw-heading);line-height:1.1;font-variant-numeric:tabular-nums}
.sens .sl{font-size:var(--sw-fs-xs);color:var(--sw-text-2)}

/* area tile (compact, tiles view) */
.atile{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:var(--sw-r-md);background:var(--sw-surface-2);border:1px solid var(--sw-border);min-height:96px}
.atile .an{font-weight:var(--sw-fw-semibold);color:var(--sw-heading);display:flex;align-items:center;gap:8px}
.atile .ac{display:flex;gap:10px;flex-wrap:wrap;font-size:var(--sw-fs-sm);color:var(--sw-text-2);font-variant-numeric:tabular-nums}
.atile .ac span{display:inline-flex;align-items:center;gap:4px}
.atile .ac .ic{width:14px;height:14px}
.atile.on{--g:var(--sw-on-warm);border-color:rgb(var(--g) / var(--sw-glow-border))}
.atile .dots{position:absolute;top:8px;inset-inline-end:8px;color:var(--sw-text-3)}

/* room card (home, cards view): a room, not a KPI — name, ambient facts, master */
.room{position:relative;display:flex;flex-direction:column;gap:12px;padding:var(--sw-card-pad);min-height:150px;color:inherit}
.room .rh{display:flex;align-items:center;gap:12px}
.room .rn{font-size:var(--sw-fs-2xl);font-weight:var(--sw-fw-bold);color:var(--sw-heading);letter-spacing:var(--sw-h2-tracking);line-height:1.1;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.room .rs{font-size:var(--sw-fs-sm);color:var(--sw-text-2);margin-top:2px}
.room .amb{display:flex;flex-wrap:wrap;gap:6px}
.room .amb .chip{height:30px;padding:0 10px;font-size:var(--sw-fs-sm)}
.room .rf{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;font-size:var(--sw-fs-sm);color:var(--sw-text-2)}
.room .rf .more{display:inline-flex;align-items:center;gap:4px;color:var(--sw-text-2);min-height:44px}
.room .rf .more .ic{width:16px;height:16px}
.room.on{--g:var(--sw-on-warm);border-color:rgb(var(--g) / var(--sw-glow-border))}
.room .dbadge{--role:var(--sw-role-neutral);--role-fg:var(--sw-role-neutral-fg)}

/* list rows (list view): one line = thing + facts + state + control */
.ltable{display:flex;flex-direction:column;padding:0;overflow:hidden}
.lhead{display:grid;align-items:center;gap:12px;min-height:40px;padding:0 var(--sw-card-pad);font-size:var(--sw-fs-xs);font-weight:var(--sw-fw-semibold);color:var(--sw-text-3);letter-spacing:.3px;border-bottom:1px solid var(--sw-border)}
.lgroup{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 var(--sw-card-pad);background:var(--sw-surface-3);color:var(--sw-heading);font-weight:var(--sw-fw-semibold);font-size:var(--sw-fs-md);border-bottom:1px solid var(--sw-border);white-space:nowrap}
.lgroup .count{color:var(--sw-text-2);font-weight:var(--sw-fw-regular);font-size:var(--sw-fs-sm)}
.lgroup .act{margin-inline-start:auto}
.lrow{display:grid;align-items:center;gap:12px;min-height:var(--sw-row-h-compact);padding:4px var(--sw-card-pad);border-bottom:1px solid var(--sw-border);background:var(--sw-surface-2);color:inherit;font-size:var(--sw-fs-md)}
.lrow:last-child{border-bottom:0}
.lrow .lname{display:flex;align-items:center;gap:10px;min-width:0;font-weight:var(--sw-fw-semibold);color:var(--sw-heading)}
.lrow .lname span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lrow .lname .ring{width:30px;height:30px} .lrow .lname .ring .ic{width:16px;height:16px}
.lrow .lc{display:inline-flex;align-items:center;gap:5px;color:var(--sw-text-2);font-variant-numeric:tabular-nums;white-space:nowrap}
.lrow .lc .ic{width:14px;height:14px;color:var(--sw-text-3)}
.lrow .lc b{color:var(--sw-text);font-weight:var(--sw-fw-semibold)}
.lrow .lc.on b{color:var(--sw-role-warm-fg)}
.lrow .lact{display:flex;justify-content:flex-end;gap:2px}
.lrow.on{--g:var(--sw-on-cool)} .lrow.on.warm{--g:var(--sw-on-warm)} .lrow.on.switch{--g:var(--sw-on-switch)}
.lrow.unavail .lname,.lrow.unavail .lc{color:var(--sw-text-3)} .lrow.unavail .ring{opacity:.6;border:1px dashed var(--sw-border-strong);background:transparent}
.lrow .thumb{width:64px;height:36px;border-radius:var(--sw-r-sm);overflow:hidden;position:relative;background:var(--sw-video-bg);flex:none}
.lrow .thumb .scene::after{display:none}

/* tree */
.tree{display:flex;flex-direction:column;gap:2px}
.tree .trow{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 10px;border-radius:var(--sw-r-sm);color:var(--sw-text);font-size:var(--sw-fs-md)}
.tree .trow.floor{font-weight:var(--sw-fw-semibold);color:var(--sw-heading);margin-top:6px}
.tree .trow.sel{background:var(--sw-accent-soft);color:var(--sw-accent-text);font-weight:var(--sw-fw-semibold)}
.tree .trow .lit{margin-inline-start:auto;display:inline-flex;align-items:center;gap:4px;min-width:44px;justify-content:flex-end;color:var(--sw-text-2);font-size:var(--sw-fs-sm);font-variant-numeric:tabular-nums}
.tree .trow .lit.on{color:var(--sw-role-warm-fg)}
.tree .trow .ic{width:16px;height:16px;color:var(--sw-text-3)}
.tree .trow.area{padding-inline-start:26px}

/* widgets */
.reading{font-size:var(--sw-fs-reading);font-weight:var(--sw-fw-reading);letter-spacing:var(--sw-reading-tracking);line-height:1;color:var(--sw-heading);font-variant-numeric:tabular-nums}
.reading small{font-size:.42em;font-weight:var(--sw-fw-medium);color:var(--sw-text-3);letter-spacing:0}
.wlabel{font-size:var(--sw-fs-xs);font-weight:var(--sw-fw-semibold);color:var(--sw-text-3);letter-spacing:.3px;display:flex;align-items:center;gap:6px}
.wlabel .ic{width:14px;height:14px}
.forecast{display:flex;justify-content:space-between;gap:4px;margin-top:auto}
.forecast div{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:var(--sw-fs-xs);color:var(--sw-text-2)}
.forecast .ic{width:18px;height:18px;color:var(--sw-text-2)}
.forecast b{color:var(--sw-text);font-weight:var(--sw-fw-semibold);font-variant-numeric:tabular-nums}

/* ---------- camera tile (cheap: no blur, no shadow, no animation) ---------- */
.cam{position:relative;border-radius:var(--sw-r-md);overflow:hidden;background:var(--sw-video-bg);border:1px solid var(--sw-border);color:#fff;min-height:0}
.cam .pic{position:absolute;inset:0}
.cam .nm{position:absolute;inset-inline-start:0;inset-inline-end:0;bottom:0;padding:22px 12px 9px;display:flex;align-items:center;gap:7px;font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-semibold);background:linear-gradient(to top,rgba(4,8,16,.78),rgba(4,8,16,0));text-shadow:0 1px 2px rgba(0,0,0,.5)}
.cam .nm .dot{border:1.5px solid rgba(255,255,255,.85);width:9px;height:9px}
.cam .tag{position:absolute;top:8px;inset-inline-start:8px}
.cam .tag .ic{width:12px;height:12px}
.cam.snapshot .pic{filter:saturate(.75)}
.cam.offline,.cam.forbidden,.cam.connecting,.cam.unknown{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--sw-text-2);background:var(--sw-surface-3-solid);text-align:center;padding:12px}
.cam.offline{border:1.5px dashed var(--sw-border-strong)}
.cam.forbidden{background:repeating-linear-gradient(135deg,var(--sw-surface-3-solid) 0 8px,var(--sw-surface-2-solid) 8px 16px)}
.cam .st{font-size:var(--sw-fs-md);font-weight:var(--sw-fw-semibold);color:var(--sw-text)}
.cam .rs{font-size:var(--sw-fs-xs);color:var(--sw-text-3)}
.cam .nm.plain{background:none;text-shadow:none;color:var(--sw-text-2)}
.cam{container-type:size}
@container (max-height:120px){.cam .rs{display:none}.cam .ic.big{width:22px;height:22px}.cam .st{font-size:var(--sw-fs-sm)}}
@container (max-height:120px){.cam.offline,.cam.forbidden,.cam.connecting,.cam.unknown{justify-content:flex-start;padding-top:10px}}
.cam .ic.big{width:28px;height:28px;color:var(--sw-text-3)}
.cam.selected{outline:2px solid var(--sw-accent);outline-offset:2px}
.scene{position:absolute;inset:0}
.scene.s1{background:linear-gradient(180deg,#8fb3d9 0%,#c9d7e6 42%,#6d7d6b 43%,#4b5a49 100%)}
.scene.s2{background:linear-gradient(180deg,#3a3f4a 0%,#5a606c 55%,#2d3138 56%,#1e2126 100%)}
.scene.s3{background:linear-gradient(180deg,#6b7c93 0%,#9fb0c3 40%,#7b7f6c 41%,#4a4f3e 100%)}
.scene.s4{background:linear-gradient(180deg,#f0c98a 0%,#e0a866 45%,#6b5a48 46%,#3b3128 100%)}
.scene.s5{background:linear-gradient(180deg,#2b3247 0%,#3a4360 50%,#1d2233 51%,#0f1220 100%)}
.scene.s6{background:linear-gradient(180deg,#a7c7d9 0%,#dbe7ee 48%,#8a8f80 49%,#5a6050 100%)}
.scene::before{content:"";position:absolute;inset:0;background:radial-gradient(70% 60% at 50% 40%,transparent 50%,rgba(0,0,0,.28) 100%)}
.scene::after{content:"";position:absolute;inset-inline-start:18%;bottom:14%;width:26%;height:30%;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.14);border-radius:3px}

/* ---------- dialog / drawer / sheet ---------- */
.scrim{position:absolute;inset:0;background:var(--sw-overlay)}
.dialog{width:var(--sw-dialog-w);max-width:100%;padding:22px;border-radius:var(--sw-r-xl);box-shadow:var(--sw-shadow-3)}
.dialog .q{font-size:var(--sw-fs-2xl);font-weight:var(--sw-fw-bold);color:var(--sw-heading);letter-spacing:-.3px}
.dialog .acts{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
.dialog .details{margin-top:14px;font-size:var(--sw-fs-sm);color:var(--sw-text-2);display:flex;align-items:center;gap:6px}
.drawer{width:var(--sw-drawer-w);border-radius:var(--sw-r-lg);box-shadow:var(--sw-shadow-3);padding:18px;display:flex;flex-direction:column;gap:12px}
.sheet{width:100%;border-radius:var(--sw-r-lg) var(--sw-r-lg) 0 0;box-shadow:var(--sw-shadow-3);padding:8px 16px 16px}
.handle{width:40px;height:5px;border-radius:3px;background:var(--sw-border-strong);margin:4px auto 14px}

/* ---------- field ---------- */
.field{display:flex;flex-direction:column;gap:6px}
.field label{font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-medium);color:var(--sw-text-2)}
.field .in{height:44px;padding:0 12px;border-radius:var(--sw-r-sm);background:var(--sw-surface-2);border:1px solid var(--sw-border-strong);display:flex;align-items:center;color:var(--sw-text);font-size:var(--sw-fs-md)}
.field .in.ph{color:var(--sw-text-3)}
.field.focus .in{border-color:var(--sw-focus);box-shadow:0 0 0 3px var(--sw-accent-soft)}
.field.error .in{border-color:var(--sw-danger);box-shadow:0 0 0 3px var(--sw-danger-soft)}
.field.error .hint{color:var(--sw-danger)}
.field .hint{font-size:var(--sw-fs-xs);color:var(--sw-text-3)}
.field.disabled{opacity:.5}
.field.ro .in{background:transparent;border-style:dashed}
.field.inline{flex-direction:row;align-items:center;gap:12px}
.field.inline label{min-width:96px}
.select{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:var(--sw-r-sm);background:var(--sw-surface-2);border:1px solid var(--sw-border-strong);font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-medium);color:var(--sw-text)}
.select .ic{width:14px;height:14px;rotate:90deg;color:var(--sw-text-3)}

/* ---------- state panel ---------- */
.state{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;padding:48px 24px}
.state .sic{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;background:var(--sw-surface-3);color:var(--sw-text-2)}
.state .sic .ic{width:26px;height:26px}
.state .st{font-size:var(--sw-fs-xl);font-weight:var(--sw-fw-bold);color:var(--sw-heading)}
.state .sh{font-size:var(--sw-fs-md);color:var(--sw-text-2)}
.state.error .sic{background:var(--sw-danger-soft);color:var(--sw-danger)} .state.forbidden .sic{background:var(--sw-forbidden-soft);color:var(--sw-forbidden)} .state.stale .sic{background:var(--sw-stale-soft);color:var(--sw-stale)}
.state.compact{flex-direction:row;text-align:start;padding:14px 16px;gap:12px} .state.compact .sic{width:40px;height:40px;border-radius:12px}
.skeleton{background:linear-gradient(90deg,var(--sw-surface-3) 25%,var(--sw-surface-2) 50%,var(--sw-surface-3) 75%);background-size:200% 100%;border-radius:8px;animation:sk 1.4s linear infinite}
@keyframes sk{to{background-position:-200% 0}}
.spin{animation:sp 1s linear infinite}@keyframes sp{to{rotate:360deg}}

/* ---------- board chrome (not product) ---------- */
.board-label{position:absolute;top:4px;left:50%;translate:-50% 0;z-index:99;font:600 10px/1 var(--sw-font);color:var(--sw-text-3);opacity:.7;pointer-events:none;direction:ltr;white-space:nowrap}
`;

export const phoneCss = `
@media (max-width:767px){
  .app{grid-template-columns:1fr}
  .rail{display:none}
  .page{padding:var(--sw-page-pad-phone);padding-block-start:18px;gap:14px;min-height:auto}
  .h1{font-size:var(--sw-h1-phone)}
  .sub{font-size:var(--sw-fs-md);margin-top:4px}
  .reading{font-size:var(--sw-fs-reading-phone)}
  .corner{top:12px;inset-inline-end:12px}
  .tabs.fade::after{width:36px}
  .room{min-height:0}
  .page > .head:first-child,.ahead .top,.page > .sections{padding-inline-end:96px}
}`;
