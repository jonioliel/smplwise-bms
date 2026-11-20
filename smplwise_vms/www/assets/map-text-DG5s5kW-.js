import{g as p,cx as _,bi as C,bj as A,pH as U,A as c,a6 as u,b as s,pI as l,pJ as S,pK as I,pL as R,bs as T,a2 as f,c0 as L,br as O,b5 as E,hr as P,eH as N,bG as j,bH as H}from"./index-koYOOmpL.js";import{t as d}from"./icons-NUq-07uG.js";import{o as X}from"./readiness-model-DGhavIGL.js";function Y(e){return e?e.handlers?e.handlers:(e.users??[]).map(t=>({key:`user:${t.id}`,kind:"user",id:t.id,name:t.name,account:!0,member_role:t.member_role,phone:null,has_phone:!1,preferred_channel:"inapp"})):[]}function ee(e){return{kind:e.kind,id:e.id}}function w(e){return e&&e.id?`${e.kind==="contact"?"contact":"user"}:${e.id}`:""}function te(e,t){return!!e&&w(e)===t.key}function ae(e){const t=new Map;for(const a of e)for(const r of a)t.has(r.key)||t.set(r.key,r);return[...t.values()].sort((a,r)=>Number(r.account)-Number(a.account)||a.name.localeCompare(r.name))}function re(e){const t=new Map;for(const a of e){const r=w(a.assignee);r&&a.assignee&&!t.has(r)&&t.set(r,{key:r,name:a.assignee.name,account:a.assignee.kind!=="contact"})}return[...t.values()].sort((a,r)=>a.name.localeCompare(r.name))}const ie=p`
  :host {
    display: block;
    min-inline-size: 0;
    position: relative;
  }
  :host([data-menu]) {
    z-index: 20;
  }
  .tcard {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 11px;
    padding: 16px 18px 14px;
    block-size: 100%;
    box-sizing: border-box;
    background: var(--mm-sheen), var(--dv-surface);
    -webkit-backdrop-filter: var(--dv-surface-blur);
    backdrop-filter: var(--dv-surface-blur);
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-2xl);
    box-shadow: var(--dv-shadow-1);
    transition: box-shadow var(--mm-motion) var(--mm-ease), border-color var(--mm-motion), transform var(--sw-t-press) var(--sw-ease);
    -webkit-tap-highlight-color: transparent;
  }
  /* POLISH-CLASSIC-DOMUS-297 second pass (P4): the shared hover convention (a pointer that hovers) and a small press of the card
     itself - not while a button or link inside it is the thing pressed (that control gives its own feedback) */
  @media (hover: hover) and (pointer: fine) {
    .tcard:hover {
      box-shadow: var(--dv-shadow-2);
    }
  }
  .tcard:active:not(:has(button:active, a:active, input:active, select:active, sw-button:active)) {
    transform: scale(calc(1 - (1 - var(--sw-press-scale)) / 3));
  }
  .tcard:focus-within,
  :host([data-picked]) .tcard {
    border-color: color-mix(in srgb, var(--dv-accent) 55%, transparent);
    box-shadow: var(--dv-shadow-2), 0 0 0 3px var(--dv-accent-soft);
  }
  .tcard.urgent {
    border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
  }
  header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-inline-size: 0;
  }
  .ttl {
    flex: 1;
    min-inline-size: 0;
  }
  h3 {
    margin: 0;
    font-size: var(--sw-fs-xl);
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 1.25;
    /* UXFIX-RTL: two lines, then an ellipsis; the title text carries dir="auto" so a Latin / Cyrillic title keeps its beginning
       (a one-line ellipsis in an RTL box cut the start of it) and the full text is the link's title attribute. */
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow-wrap: anywhere;
    text-align: start;
    text-overflow: ellipsis; /* UXFIX-NAV-295 (same fix as UXFIX-RTL) */
    white-space: normal;
  }
  a.name {
    color: inherit;
    text-decoration: none;
  }
  a.name::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
  a.name:focus-visible {
    outline: none;
  }
  .where {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 8px;
    margin-block-start: 3px;
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
    min-inline-size: 0;
  }
  .where b {
    color: var(--dv-text);
    font-weight: 700;
    white-space: nowrap;
  }
  .where .ic {
    font-size: var(--sw-fs-md);
    color: var(--dv-text-3);
  }
  .ctl {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
  }
  .more {
    display: grid;
    place-items: center;
    inline-size: 36px;
    block-size: 36px;
    border-radius: 50%;
    border: 0;
    background: transparent;
    color: var(--dv-text-2);
  }
  .more:hover,
  .more[aria-expanded='true'] {
    background: var(--dv-surface-3);
    color: var(--dv-text);
  }
  .more .ic {
    font-size: var(--sw-fs-2xl);
  }
  .excerpt {
    margin: 0;
    font-size: var(--sw-fs-md);
    line-height: 1.55;
    color: var(--dv-text);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  footer {
    position: relative;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin-block-start: auto;
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
  }
  .run {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-inline-size: 0;
  }
  .num {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
    color: var(--dv-text-3);
    font-weight: 600;
  }
  a.tl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--dv-accent-text);
    font-weight: 600;
    text-decoration: none;
    min-block-size: 32px;
    border-radius: var(--sw-r-sm);
  }
  a.tl .ic {
    font-size: var(--sw-fs-lg);
  }
  a.tl:hover {
    text-decoration: underline;
  }
  a.tl:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  .chips {
    position: relative;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip .dot {
    inline-size: 6px;
    block-size: 6px;
  }
  .pop {
    position: absolute;
    z-index: 30;
    display: flex;
    flex-direction: column;
    padding: 6px;
    background: var(--sw-menu-surface);
    border: 1px solid var(--sw-menu-border);
    border-radius: var(--sw-r-lg);
    box-shadow: var(--dv-shadow-2);
    inset-block-start: 52px;
    inset-inline-end: 12px;
    min-inline-size: 190px;
  }
  /* 2.5.5: placed by tickets/overlay-menu.ts in the top layer (a popover), never clipped by a scroll box or a blurred ancestor */
  .pop.ov {
    position: fixed;
    inset: auto;
    margin: 0;
    max-inline-size: calc(100vw - 16px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .pop button {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    padding-inline: 12px;
    border: 0;
    border-radius: var(--sw-r-md);
    background: transparent;
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-md);
    text-align: start;
  }
  .pop button:hover,
  .pop button:focus-visible {
    background: var(--dv-surface-3);
    outline: none;
  }
  .pop button .ic {
    font-size: var(--sw-fs-lg);
    color: var(--dv-text-2);
  }
  @media (pointer: coarse), (max-width: 767px) {
    .more {
      inline-size: 44px;
      block-size: 44px;
    }
    a.tl {
      min-block-size: 44px;
    }
  }
  @media (max-width: 767px) {
    .tcard {
      padding: 14px 16px 12px;
    }
    /* UXFIX-NAV-295: on a phone the title column was 115-200 px (the chip and the menu shared its row) and cut even short titles:
       the chip and the menu take the first row, the title gets the full width of the second */
    header {
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .ctl {
      order: 1;
      margin-inline-start: auto;
    }
    .ttl {
      order: 2;
      flex: 1 1 100%;
    }
  }
  :host([data-skin='bubble']) .tcard {
    border-radius: var(--sw-r-lg);
  }
`,ne=p`
  ${_}
  .stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-inline-size: 0;
  }
  .sentence {
    overflow-wrap: anywhere;
  }
  .sentence .desc {
    white-space: pre-line;
  }
  .sect > h4 .cnt {
    font-variant-numeric: tabular-nums;
    color: var(--dv-text-3);
  }
  .sect > h4 .sp {
    flex: 1;
  }
  .sect > h4 .btn {
    color: var(--dv-text);
  }
  /* the state strip wraps to a second row when the states do not fit (a drawer, a phone): nothing is hidden behind a scroll */
  .strip {
    display: flex;
    flex-wrap: wrap;
    inline-size: 100%;
    box-sizing: border-box;
    border-radius: var(--sw-r-xl);
  }
  .strip button {
    flex: 1 0 auto;
    padding-inline: 10px;
  }
  .strip button .sub {
    display: block;
    font-size: var(--sw-fs-xs);
    font-weight: 500;
    line-height: 1.2;
    opacity: 0.85;
  }
  .strip button[disabled]:not([aria-pressed='true']) {
    color: var(--dv-text-3);
  }
  .side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .who {
    font-weight: 700;
  }
  .blk .acts {
    display: flex;
    gap: 6px;
    flex: none;
  }
  .photos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
  }
  .ph {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--sw-r-md);
    overflow: hidden;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
  }
  .ph img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .ph .rm {
    position: absolute;
    inset-block-start: 4px;
    inset-inline-end: 4px;
    inline-size: 32px;
    block-size: 32px;
    border-radius: 50%;
    border: 0;
    display: grid;
    place-items: center;
    background: var(--sw-menu-surface);
    color: var(--dv-danger);
    box-shadow: var(--dv-shadow-1);
  }
  .ph .tag {
    position: absolute;
    inset-block-end: 4px;
    inset-inline-start: 4px;
  }
  .ph.add {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 2px;
    color: var(--dv-text-2);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    border-style: dashed;
    cursor: pointer;
  }
  .ph.add .ic {
    font-size: var(--sw-fs-2xl);
  }
  .ph.add input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .ph.add:focus-within {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  .tline {
    list-style: none;
    margin: 0;
    padding: 4px 0 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    position: relative;
  }
  .tline::before {
    content: '';
    position: absolute;
    inset-block: 18px 18px;
    inset-inline-start: 15px;
    inline-size: 2px;
    background: var(--dv-border);
  }
  .tline li {
    position: relative;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    min-inline-size: 0;
  }
  .tline .ring {
    flex: none;
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    inline-size: 32px;
    block-size: 32px;
    border-radius: 50%;
    background: var(--dv-surface-solid);
    border: 1px solid var(--dv-border);
    color: var(--dv-text-2);
  }
  .tline .ring .ic {
    font-size: var(--sw-fs-md);
  }
  .tline li[data-kind='status'] .ring,
  .tline li[data-kind='assigned'] .ring,
  .tline li[data-kind='reassigned'] .ring {
    color: var(--dv-accent-text);
  }
  .tline li[data-kind='closed'] .ring,
  .tline li[data-kind='created'] .ring {
    color: var(--dv-text);
  }
  .tline .tx {
    flex: 1;
    min-inline-size: 0;
    padding-block-start: 5px;
  }
  .tline .meta {
    display: block;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-3);
  }
  .tline .line {
    font-size: var(--sw-fs-md);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .tline .body {
    margin-block-start: 6px;
    padding: 10px 14px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface);
    border: 1px solid var(--dv-border);
    font-size: var(--sw-fs-md);
    line-height: 1.55;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .composer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .composer textarea,
  textarea.inp {
    min-block-size: 88px;
    padding-block: 10px;
    resize: vertical;
    line-height: 1.5;
    border-radius: var(--sw-r-lg);
  }
  .composer .row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .composer .row .grow {
    flex: 1;
  }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-block-size: 44px;
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
    cursor: pointer;
  }
  .chk input {
    inline-size: 18px;
    block-size: 18px;
    accent-color: var(--dv-accent);
  }
  .err {
    color: var(--dv-danger);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
  }
  .muted {
    color: var(--dv-text-2);
    font-size: var(--sw-fs-base);
  }
  .foot2 {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  :host([data-skin='bubble']) .tline .body,
  :host([data-skin='bubble']) .ph {
    border-radius: var(--sw-r-md);
  }
`,oe=p`
  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-inline-size: 0;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .fld > span {
    font-weight: 600;
  }
  .fld .req {
    color: var(--dv-danger);
  }
  .prio {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .prio .rc {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 38px;
    padding-inline: 14px;
    border-radius: 999px;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
    font-weight: 600;
  }
  /* AUDIT30-C-TICKETS (#4, Q3 option 1): Blue Wash, never the black key */
  .prio .rc[aria-checked='true'] {
    ${C}
  }
  /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
  .prio .rc[aria-checked='true']::before {
    ${A}
  }
  .similar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-warning-soft);
  }
  .similar b {
    font-size: var(--sw-fs-sm);
  }
  .similar a {
    color: var(--dv-text);
    font-size: var(--sw-fs-base);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .similar a:hover {
    text-decoration: underline;
  }
  /* TKUI7 (ONE scroll per surface): a picker list grows with its rows and the drawer / dialog / sheet body scrolls; only the searchable
     vendor / contact list (.xpick, with its search field above it) keeps a capped box of its own */
  .pick {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pick.xpick {
    max-block-size: 280px;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .pick label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    padding-inline: 12px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    cursor: pointer;
  }
  .pick label:has(input:checked) {
    border-color: var(--dv-accent);
    background: var(--dv-accent-soft);
  }
  .pick input {
    accent-color: var(--dv-accent);
  }
  .pick small {
    color: var(--dv-text-3);
    margin-inline-start: auto;
  }
  .sheetfoot {
    display: flex;
    align-items: center;
    gap: 10px;
    inline-size: 100%;
  }
  .sheetfoot .hint {
    margin-inline-start: auto;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-sm);
  }
  .thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .thumbs .ph {
    inline-size: 72px;
    block-size: 72px;
    aspect-ratio: auto;
  }
  @media (max-width: 767px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
`;function D(e){const t=I({kind:e.kind,from:e.from,to:e.to,changed:e.changed},"generic"),a=t.from||t.to?`${t.from?`${t.from} ← `:""}${t.to}`:t.verb,r=`actor_${e.actor.type}`,n=l(r in F?r:"actor_unknown"),o=e.actor.type!=="person"&&e.actor.name?`${n}: ${e.actor.name}`:n;return{when:R(e.at),what:a,who:o}}const F=Object.fromEntries(["actor_person","actor_automation","actor_script","actor_scene","actor_schedule","actor_device","actor_system","actor_unknown"].map(e=>[e,!0]));function M(e){return e?e.withheld||e.source==="none"?l("historyWithheld"):e.count?l("historyAttach",{h:e.window_hours,n:e.count}):l("historyNone",{h:e.window_hours}):""}function se(e,t){const a=e.data,r=(a?.items??[]).filter(o=>!U.includes(o.status)),n=M(a?.history);return s`<div class="devblk" data-create-device=${e.id}>
      <span class="di">${d("layers")}</span>
      <div class="dt"><b>${u(a?.entity.name||e.name)}</b>${a?.place_text?s`<small data-create-place>${u(a.place_text)}</small>`:c}
        ${n?s`<small class="hn" data-create-history>${d("clock")}${n}</small>`:c}</div>
    </div>
    ${r.length?s`<div class="similar" data-device-open><b>${l("existing")}</b>${r.map(o=>s`<a href=${t(o.id)} data-device-open-item=${o.id}>#${o.number} · ${o.title}</a>`)}</div>`:c}`}function le(e){if(!e)return c;const t=s`<h4><span class="tag">${d("clock")}</span>${l("sHistory")}<span class="cnt">${e.count||""}</span></h4>`;if(e.withheld||e.source==="none")return s`<section class="sect" data-sect="device-history">${t}<p class="hmuted" data-history-state="withheld">${l("historyNotAttached")}</p></section>`;const a=(e.coverage?.gaps?.length??0)>0||e.coverage?.availability==="partial";return s`<section class="sect" data-sect="device-history">${t}
    <p class="hmuted">${l("historyWindow",{h:e.window_hours})}${e.truncated?s` · <span data-history-cut>${l("historyCut",{n:e.count})}</span>`:c}${a?s` · <span data-history-gaps>${l("historyGaps")}</span>`:c}</p>
    ${e.lines.length?s`<ol class="tline" data-device-history>
      ${e.lines.map(r=>{const n=D(r);return s`<li data-kind="device" data-history-line>
          <span class="ring">${d("clock")}</span>
          <div class="tx"><span class="meta"><time datetime=${r.at} title=${S(r.at)}>${n.when}</time> · ${u(n.who)}</span><span class="line"><bdi>${n.what}</bdi></span></div>
        </li>`})}
    </ol>`:s`<p class="hmuted" data-history-state="empty">${l("historyEmpty")}</p>`}
  </section>`}const ce=p`
  .devblk {
    display: flex; align-items: flex-start; gap: var(--sw-s-3); padding: var(--sw-s-3); border-radius: var(--sw-r-lg);
    background: var(--sw-surface-2); border: 1px solid var(--sw-border);
  }
  .devblk .di { flex: none; display: grid; place-items: center; inline-size: 36px; block-size: 36px; border-radius: var(--sw-r-md); background: var(--sw-accent-soft); color: var(--sw-accent-text); font-size: var(--sw-fs-lg); }
  .devblk .dt { display: grid; gap: 2px; min-inline-size: 0; }
  .devblk .dt b { font-weight: var(--sw-fw-semibold); }
  .devblk .dt small { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  .devblk .hn { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-text-3); }
  .hmuted { margin: 0 0 var(--sw-s-2); color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
`,B=6,K="later",V=e=>`h:${e.key}`,W=e=>`v:${e.id}`;function de(e){return e.startsWith("h:")?{kind:"handler",id:e.slice(2)}:e.startsWith("v:")?{kind:"vendor",id:e.slice(2)}:{kind:"later",id:""}}const b=e=>(e??"").trim().toLowerCase();function pe(e){const t=b(e.query),a=(...i)=>!t||i.some($=>b($).includes(t)),r=e.handlers.filter(i=>i.account),n=e.handlers.filter(i=>!i.account),o=(e.contacts??[]).filter(i=>i.contact_kind!=="employee"),v=e.contacts===null&&e.external?null:X("person",{external:e.external,readiness:e.readiness,publicReady:e.publicReady,count:o.length}),h=i=>({value:V(i),label:i.name,sub:i.phone??""}),y=[{key:"later",options:[{value:K,label:"",sub:""}],total:1,blocked:null},{key:"account",options:r.filter(i=>a(i.name)).map(h),total:r.length,blocked:null},{key:"staff",options:n.filter(i=>a(i.name,i.phone)).map(h),total:n.length,blocked:null},{key:"vendor",options:v?[]:o.filter(i=>a(i.name,i.company,i.vendor_name)).map(i=>({value:W(i),label:i.name,sub:[i.vendor_name??i.company,i.phone].filter(Boolean).join(" · ")})),total:o.length,blocked:v}],z=r.length+n.length+(v?0:o.length);return{groups:y,searchable:z>B}}function q(e){return`contact:${e}`}function ve(e){const t=/^contact:([A-Za-z0-9_-]{1,64})$/.exec(e??"");return t?t[1]:""}function fe(e,t){return`${e}${e.includes("?")?"&":"?"}assign=${encodeURIComponent(q(t))}`}const m=new Map;function g(e){return m.get(e)??{ticket_id:e,element:null,can:{attach:!0,detach:!1}}}const ue={get:e=>f()?E(`tickets/${encodeURIComponent(e)}/map-element`):Promise.resolve(g(e)),attach:(e,t,a)=>{if(!f()){const r={ticket_id:e,can:{attach:!0,detach:!0},element:{kind:t.element?t.element.kind:"anchor",type:t.resource?t.resource.type:"object",name:a?.name??"",floor_name:a?.floorName??"",room_name:null,attached_at:new Date().toISOString(),present:!0,vendor_image:!0}};return m.set(e,r),Promise.resolve(r)}return O(`tickets/${encodeURIComponent(e)}/map-element`,t.element?{element:t.element}:{resource:t.resource})},detach:e=>f()?L(`tickets/${encodeURIComponent(e)}/map-element`,{method:"DELETE"}):(m.delete(e),Promise.resolve(g(e))),vendorPreviewUrl:e=>T(`tickets/${encodeURIComponent(e)}/map-element/vendor.svg`)};function me(e){if(!e.present||!e.floor_id)return null;const t=`#/explore/floors/${encodeURIComponent(e.floor_id)}`;return e.type==="camera"&&e.resource_id?`${t}?camera=${encodeURIComponent(e.resource_id)}`:e.type==="ha_entity"&&e.resource_id?`${t}?entity=${encodeURIComponent(e.resource_id)}`:e.type==="object"&&e.element_id?`${t}?focus=${encodeURIComponent(`object:${e.element_id}`)}`:t}const x={section:"רכיב במפה",add:"הוסף רכיב מהמפה",replace:"החלף רכיב",remove:"הסר",show:"הצג במפה",vendorPreview:"מה הספק רואה",vendorPreviewHide:"הסתר תמונה",vendorNoImage:"הספק יראה את התיאור בלבד (אין תמונת מפה).",gone:"הרכיב כבר לא במפה - נשמר התיאור מרגע הצירוף.",pickTitle:"בחירת רכיב מהמפה",pickFloor:"קומה",pickHint:"לחצו על רכיב במפה (מצלמה, התקן או עצם).",pickNone:"אין במפה של הקומה הזו רכיבים לבחירה.",pickNoPlan:"לקומה הזו אין תוכנית מפורסמת.",pickChosen:"נבחר",pickSave:"צרף לבקשה",pickCancel:"ביטול",pickLoading:"טוען את המפה...",attached:"הרכיב צורף לבקשה",removed:"הרכיב הוסר מהבקשה",createLine:"רכיב מהמפה"},k=j("en","tickets/map-text","en");function G(e,t=N()){const a=(t==="en"?k[e]:void 0)??x[e];return P(a,t)}const xe=Object.defineProperties({},Object.fromEntries(Object.keys(x).map(e=>[e,{get:()=>G(e),enumerable:!0}])));H("tickets/map-text",{he:x,en:k});export{K as L,xe as M,ee as a,ne as b,pe as c,se as d,oe as e,ce as f,ve as g,Y as h,ie as i,re as j,w as k,te as l,ae as m,me as n,le as o,de as p,ue as t,fe as w};
