import{je as m,a as g,aX as x,ha as k,jf as y,jg as $,fe as n,f5 as z,q as E,A as c,jh as O,ji as j,b as i,jj as C,jk as I,jl as D,jm as S,jn as P,jo as A,jp as R,jq as b,jr as w,js as T,jt as u,fo as _,ju as H,j as M,z as L,k as v,m as N}from"./index-CoJbESCx.js";import"./cert-row-Bwjj8LCX.js";import{e as K}from"./styles-owcGQqPd.js";import{b as Y}from"./bubble-chrome-Da7T662v.js";import{l as F}from"./lead-reserve-DAN8SNxO.js";import"./sw-logo-art-PLtEZJxU.js";import"./maintenance-Mkwmb9FM.js";import"./model-DGFg_0wZ.js";function G(e){for(const a of e){const t=a.getAttribute?.("data-elevator")??null;if(t)return t;const s=(a.tagName??"").toLowerCase(),r=a.getAttribute?.("role")??"";if(s==="a"||s==="button"||s==="input"||s==="select"||s==="textarea"||r==="button")return null}return null}class B extends m{constructor(a,t){super(a),this.open=t}find(a){const t=a.composedPath(),s=G(t);if(!s)return null;const r=t.find(o=>o.getAttribute?.("data-elevator")===s);return r?{id:s,el:r}:null}findPress(a){return this.find(a)}findMenu(a){return this.find(a)}longPress(a){this.open(a.id,a.el)}contextMenu(a,t){this.open(t.id,t.el)}keyDown(a){const t=a.key==="Enter"&&a.altKey&&!a.ctrlKey&&!a.metaKey&&!a.shiftKey,s=a.key==="ContextMenu"||a.key==="F10"&&a.shiftKey;if(!t&&!s)return;const r=this.find(a);r&&(a.preventDefault(),a.stopPropagation(),this.open(r.id,r.el))}}var q=Object.defineProperty,V=Object.getOwnPropertyDescriptor,h=(e,a,t,s)=>{for(var r=s>1?void 0:s?V(a,t):a,o=e.length-1,d;o>=0;o--)(d=e[o])&&(r=(s?d(a,t,r):d(r))||r);return s&&r&&q(a,t,r),r};const W=15e3,X=24*36e5;let p=class extends g{constructor(){super(...arguments),this.bubbleSkin=new x(this),this.route=null,this.access=k(),this.data=null,this.error="",this.historyId=null,this.editing=!1,this.historyOpener=null,this.press=new B(this,(e,a)=>this.openHistory(e,a))}connectedCallback(){super.connectedCallback(),this.stop=y(e=>{this.access=e,e.manage||(this.editing=!1)}),this.offScreenEdit=$({id:"elevators-edit",label:n("editPage"),icon:"edit",can:()=>this.access.manage&&!this.editing,run:()=>{this.editing=!0}}),this.load(),this.timer=window.setInterval(()=>{document.visibilityState==="visible"&&this.load()},W)}disconnectedCallback(){window.clearInterval(this.timer),this.stop?.(),this.offScreenEdit?.(),super.disconnectedCallback()}async load(){if(this.access.view)try{this.data=await z(24),this.error=""}catch(e){this.error=E(e)}}openHistory(e,a){this.historyOpener=a,this.historyId=e}closeHistory(){this.historyId=null;const e=this.historyOpener;this.historyOpener=null,e?.isConnected&&this.updateComplete.then(()=>e.focus())}historyDialog(e,a){const t=e.find(o=>o.id===this.historyId);if(!t)return c;const s=O(t.history,a),r=o=>_(new Date(o));return i`<sw-dialog open heading=${n("historyTitle",{name:t.name})} subheading=${n("last24")} data-elevator-history-dialog @close=${()=>this.closeHistory()}>
      ${s.length?i`<ol class="hist" data-history-rows>${s.map(o=>i`<li data-look=${o.look} data-history-state=${o.state}><span class="dot" aria-hidden="true"></span><span class="t">${o.label}</span><span class="w">${r(o.from)} - ${r(o.to)} · ${j(o.minutes)}</span></li>`)}</ol>`:i`<p>${n("noHistory")}</p>`}
    </sw-dialog>`}kpis(e,a){const t=C(e,a),s=(r,o,d,f)=>i`<div class="kpi" data-look=${r} data-elevators-kpi=${f} ?data-nz=${o>0}><span class="dot" aria-hidden="true"></span><div><b>${o}</b><span class="l">${n(d)}</span></div></div>`;return i`<div class="kpis" role="group" aria-label=${n("title")}>
      ${s("unk",t.total,"title","total")}${s("wait",t.ok,"kpiOk","ok")}${s("fault",t.fault,"kpiFault","fault")}${s("off",t.off,"kpiOff","off")}${s("fire",t.fire,"kpiFire","fire")}${t.usesTravel?s("trav",t.travel,"kpiTravel","travel"):c}
    </div>`}card(e,a,t,s=0){const r=I({state:e.state,stale:a||e.stale,roles:e.roles,flags:e.flags}),o=r.state==="unknown"?"":D(e.since,new Date(t)),d=S(e.history,t-X,t),f=e.extras.filter(l=>l.on!==null);return i`<article class="ecard" tabindex="0" style=${`--i:${Math.min(s,8)}`} data-elevator=${e.id} data-state=${r.state} data-look=${r.look} aria-label=${`${e.name}: ${r.label}`}>
      <div class="head"><h3>${e.name}${e.area_name?i`<small>${e.area_name}</small>`:c}</h3>${P(r)}<button type="button" class="hbtn" data-elevator-history aria-label=${n("historyOpen",{name:e.name})} title=${n("historyOpen",{name:e.name})} @click=${l=>this.openHistory(e.id,l.currentTarget)}><sw-icon name="clock" size="16"></sw-icon></button></div>
      <div class="body">${A(r,74)}
        <div class="meta">
          <div class="leds" role="list" aria-label=${n("sensorsLit")}>${R(e,a||e.stale).map(l=>i`<span class="led" role="listitem" data-look=${l.look} data-on=${String(l.on)} ?data-na=${l.na} data-led=${l.role} aria-label=${b(l)} title=${b(l)}><i aria-hidden="true"></i>${l.label}</span>`)}</div>
          ${f.length?i`<div class="ext">${f.map(l=>i`<span class="chip ${l.on?"c-acc":"c-mut"} nodot" data-extra=${l.position}>${l.label}</span>`)}</div>`:c}
          ${e.history!==null&&e.history!==void 0?i`<div class="tl" data-elevator-bar role="img" aria-label=${w(d)} title=${w(d)}>${d.lead>0&&d.parts.length?i`<span class="lead" style=${`flex:${d.lead}`}></span>`:c}${d.parts.map(l=>i`<span data-look=${l.look} data-bar-state=${l.state} style=${`flex:${l.pct}`}></span>`)}</div>`:c}
          <div class="row2"><span>${e.history?d.parts.length?n("last24"):n("noHistory"):e.partial?n("partial"):""}</span><span data-elevator-ago>${o}</span></div>
          <maint-cert-row kind="elevator" subjectId=${e.id}></maint-cert-row>
        </div>
      </div>
    </article>`}render(){if(!this.access.view)return i`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;if(!this.data)return this.error?i`<sw-state-panel state="error" heading=${n("loadError")} hint=${this.error} data-state="error"></sw-state-panel>`:i`<div class="skl" data-state="loading" aria-busy="true" aria-label=${n("title")}>
            <div class="sk-top"><div class="sk sk-h1"></div><div class="sk sk-sub"></div></div>
            <div class="kpis">${[0,1,2,3,4].map(()=>i`<div class="sk sk-kpi"></div>`)}</div>
            <div class="grid">${[0,1,2].map(()=>i`<div class="sk sk-card"></div>`)}</div>
          </div>`;const e=this.data.elevators,a=this.access.manage,t=T(a,this.editing),s=this.data.stale,r=Date.now(),o=i`<div class="top lead-head"><div><h1>${n("title")}</h1><p class="sub">${n("subtitle")}</p></div><span class="sp"></span>
      ${s?i`<sw-badge kind="stale" label=${n("stale")} data-elevators-stale></sw-badge>`:c}
      ${t.newButton?i`<a class="new" href=${u} data-elevators-new><sw-icon name="plus" size="16"></sw-icon>${n("newElevator")}</a>`:c}
      ${t.doneButton?i`<button type="button" class="new" data-elevators-edit-done @click=${()=>{this.editing=!1}}><sw-icon name="check" size="16"></sw-icon>${n("editDone")}</button>`:c}</div>`;return e.length?i`${o}${this.kpis(e,s)}
      <div class="grid" data-elevators>
        ${e.map((d,f)=>this.card(d,s,r,f))}
        ${t.addCard?i`<a class="add" href=${u} data-elevators-add><div><b>+</b>${n("addCard")}</div></a>`:c}
      </div>
      ${this.historyDialog(e,r)}`:i`${o}${t.addCard?i`<div class="grid"><a class="add" href=${u} data-elevators-add data-state="empty"><div><b>+</b>${n("addCard")}</div></a></div>`:i`<sw-state-panel icon="elevator" state="empty" heading=${n("empty")} data-state="empty"></sw-state-panel>`}`}};p.styles=[K,H,F,M`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 14px var(--sw-page-pad) 24px;
      max-inline-size: var(--sw-content-max);
      inline-size: 100%;
      box-sizing: border-box;
    }
    .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .top h1 { margin: 0; font-size: var(--sw-fs-3xl); line-height: 1.2; }
    .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .top .sp { flex: 1; }
    .new {
      display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 8px 16px; text-decoration: none;
      background: var(--sw-accent); color: var(--sw-text-inverse); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1);
    }
    button.new { border: 0; font: inherit; cursor: pointer; }
    /* POLISH-CONTROL-297: the focus ring is the product's (the same token as the temperature screen), and every pressable thing answers
       the press (transform only, token durations - zero under reduced motion) */
    .new:focus-visible, .add:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 3px; }
    .new, .add, .hbtn { transition: border-color var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .new:active { transform: scale(0.97); }
    .add:active { transform: scale(0.99); }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    /* POLISH-CONTROL-297 round 2: the number is the hero of the tile - display size, heavy, tight and tabular (dataviz "hero number"),
       the word under it one quiet line; the tile sits on the card elevation with a lit top edge */
    /* R5-MEDIA-ENERGY-297 (HOMEFABLE tiers): the counter is a tone step DOWN from the elevator cards (surface-2, a hairline, no shadow) so
       the cards read as the page's objects; its label gets two lines before an ellipsis */
    /* loop 2 (visible-difference test): surface-2 read as "another white card"; the counter is a surface-3 well with no outline and no shadow,
       its mark a 20 px disc with a ring; a counter that is not zero on fault / fire / out-of-service is a filled status field (impeccable
       detect flagged the first try - a 6 px side border - as the "side-tab accent border" tell; replaced by the field) */
    .kpi {
      display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: var(--sw-r-lg, 22px);
      background: var(--sw-surface-3); border: 1px solid transparent; box-shadow: none; min-inline-size: 0;
    }
    .kpi[data-nz][data-look='fault'], .kpi[data-nz][data-look='fire'], .kpi[data-nz][data-look='off'] { background: color-mix(in srgb, var(--el-c) 18%, var(--sw-surface)); }
    .kpi[data-nz] span.l { color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
    .kpi .dot { inline-size: 20px; block-size: 20px; border-radius: 50%; background: var(--el-c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--el-c) 22%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.35); }
    .kpi > div { min-inline-size: 0; }
    .kpi b { display: block; font-size: var(--sw-fs-4xl); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; color: var(--sw-heading, var(--sw-text)); }
    .kpi span.l { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; margin-block-start: 4px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); color: var(--sw-text-2); overflow: hidden; line-height: 1.25; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(330px, 100%), 1fr)); gap: 16px; }
    .ecard {
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
      position: relative; display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: var(--sw-r-lg, 26px); overflow: hidden;
      /* R5-MEDIA-ENERGY-297: the elevator card is the hero tier - the ladder's second step and a lit top edge; it sinks on pointer-down */
      background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); min-inline-size: 0;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .ecard:active { transform: scale(var(--sw-press-scale)); box-shadow: var(--sw-shadow-1); }
    /* round 2 (find-animation-opportunities, occasional screen entry): the cards arrive as a 40 ms cascade - transform and opacity only,
       off the main thread; under reduced motion only the fade remains */
    @media (prefers-reduced-motion: no-preference) {
      .ecard { animation: el-in 360ms var(--sw-ease-out) both; animation-delay: calc(var(--i, 0) * 40ms); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ecard { animation: el-fade 200ms var(--sw-ease) both; }
    }
    @keyframes el-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } }
    @keyframes el-fade { from { opacity: 0; } }
    /* round 2 (taste-skill: no gradients; impeccable detector: no side-tab border): an alerting card is a flat tinted field of its colour,
       the out-of-service card a dashed frame - the state is told by the field, the solid badge and the icon, never by a stripe */
    /* R5-MEDIA-ENERGY-297 (status as a filled field): a solid tinted field with a strong frame, readable across the room in light and dark */
    .ecard[data-look='fire'] { background: color-mix(in srgb, var(--sw-el-fire) 16%, var(--sw-surface)); border-color: color-mix(in srgb, var(--sw-el-fire) 70%, transparent); }
    .ecard[data-look='fault'] { background: color-mix(in srgb, var(--sw-el-fault) 14%, var(--sw-surface)); border-color: color-mix(in srgb, var(--sw-el-fault) 70%, transparent); }
    .ecard[data-look='off'] { border-style: dashed; border-color: color-mix(in srgb, var(--sw-el-off) 70%, transparent); background: color-mix(in srgb, var(--sw-el-off) 8%, var(--sw-surface)); }
    .head { display: flex; align-items: center; gap: 10px; min-inline-size: 0; }
    /* the elevator name is the card's title - 20 px / 800 in the heading ink */
    .head h3 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; color: var(--sw-heading); flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .head small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-state); font-weight: var(--sw-fw-regular); overflow: hidden; text-overflow: ellipsis; }
    .body { display: flex; gap: 16px; align-items: center; min-inline-size: 0; }
    .meta { flex: 1; display: grid; gap: 8px; min-inline-size: 0; }
    .row2 { display: flex; justify-content: space-between; gap: 8px; color: var(--sw-text-2); font-size: var(--sw-fs-state); font-variant-numeric: tabular-nums; }
    .ext { display: flex; flex-wrap: wrap; gap: 6px; }
    .ecard:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    /* the history button is a real target (32 px, 44 px on touch layouts) with a wash on hover, not a bare glyph that only changes colour */
    .hbtn { border: 0; background: transparent; color: var(--sw-text-2); border-radius: 999px; padding: 0; inline-size: 32px; block-size: 32px; display: inline-grid; place-items: center; cursor: pointer; flex: none; }
    .hbtn:active { transform: scale(0.94); }
    .hbtn:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .hist { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; max-block-size: 60vh; overflow: auto; }
    /* R5-MEDIA-ENERGY-297: history rows are wells inside the dialog (no outlined boxes inside a panel), the state in the heading ink */
    .hist li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--sw-r-md); border: 0; background: var(--sw-surface-2); min-block-size: 44px; }
    .hist .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--el-c); flex: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-c) 18%, transparent); }
    .hist .t { flex: 1; min-inline-size: 0; font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    .hist .w { color: var(--sw-text-2); font-size: var(--sw-fs-state); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .add {
      display: grid; place-items: center; min-block-size: 200px; border-radius: var(--sw-r-lg, 26px); border: 2px dashed var(--sw-border);
      color: var(--sw-text-2); text-decoration: none; text-align: center; padding: 16px;
    }
    .add b { display: block; font-size: calc(var(--sw-fs-3xl) * 1.3); color: var(--sw-accent); line-height: 1; }
    /* the loading state draws the shape of the page (title, the KPI row, three cards) instead of one grey bar - the temperature screen's skeleton */
    .skl { display: flex; flex-direction: column; gap: 14px; block-size: auto; background: none; animation: none; border-radius: 0; }
    .sk {
      border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); box-sizing: border-box;
      background: linear-gradient(90deg, var(--sw-surface-3) 0%, var(--sw-surface) 50%, var(--sw-surface-3) 100%); background-size: 200% 100%; animation: el-shimmer 1.4s var(--sw-ease) infinite;
    }
    .sk-top { display: grid; gap: 8px; padding-block: 4px; }
    .sk-h1 { inline-size: 160px; block-size: 30px; }
    .sk-sub { inline-size: 300px; max-inline-size: 100%; block-size: 14px; border-radius: var(--sw-r-xs); }
    .sk-kpi { block-size: 64px; }
    .sk-card { block-size: 220px; border-radius: var(--sw-r-lg); }
    @keyframes el-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
    /* hover is only for fine pointers - a touch must not leave a card lit */
    @media (hover: hover) and (pointer: fine) {
      .ecard:hover { box-shadow: var(--sw-shadow-2); }
      .ecard:hover:not([data-look='fire']):not([data-look='fault']):not([data-look='off']) { border-color: var(--sw-border-strong); }
      .kpi:hover { border-color: var(--sw-border-strong); }
      .hbtn:hover { color: var(--sw-accent-text); background: var(--sw-accent-soft); }
      .add:hover { border-color: var(--sw-border-strong); color: var(--sw-text); }
    }
    @media (max-width: 1100px) {
      .hbtn { inline-size: 44px; block-size: 44px; margin-block: -6px; }
    }
    @media (max-width: 600px) {
      /* round 2 loop 1: on a phone the tile's word may take two lines instead of an ellipsis ("ממתינות או פעי...") */
      .kpi span.l { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; line-height: 1.25; }
      /* the title first, the button under it: the top start corner belongs to the floating search */
      .top { flex-direction: column; align-items: stretch; }
      .top .sp { display: none; }
      .new { align-self: flex-start; }
    }
    @media (max-width: 420px) {
      .body { gap: 12px; }
    }
  `,Y];h([L({attribute:!1})],p.prototype,"route",2);h([v()],p.prototype,"access",2);h([v()],p.prototype,"data",2);h([v()],p.prototype,"error",2);h([v()],p.prototype,"historyId",2);h([v()],p.prototype,"editing",2);p=h([N("infra-elevators")],p);export{p as InfraElevators};
