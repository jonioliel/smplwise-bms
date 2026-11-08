import{jY as g,jZ as x,a as k,S as y,j_ as $,j$ as z,ey as E,k0 as n,k1 as O,T,A as c,k2 as L,k3 as S,e as r,k4 as C,k5 as D,k6 as I,k7 as A,k8 as R,k9 as _,ka as P,kb as w,kc as b,i as j,jM as H,jN as m,jO as N,kd as M,ke as u,kf as Y,jQ as F,kg as G,C as K,E as B,F as U,G as v,H as X}from"./index-CH_WvWfd.js";import"./cert-row-C5ac5_iA.js";import{e as q}from"./styles-OgCbpC2k.js";import{l as Q}from"./lead-reserve-KQP1A-1b.js";import"./sw-logo-art-Va6y_cIM.js";function V(a){for(const t of a){const i=t.getAttribute?.("data-elevator")??null;if(i)return i;const e=(t.tagName??"").toLowerCase(),s=t.getAttribute?.("role")??"";if(e==="a"||e==="button"||e==="input"||e==="select"||e==="textarea"||s==="button")return null}return null}class W{constructor(t,i){this.host=t,this.open=i,this.start=null,this.swallowUntil=0,this.lastType="mouse",this.down=e=>{if(this.lastType=e.pointerType||"mouse",this.cancel(),e.pointerType==="mouse"&&e.button!==0||!e.isPrimary)return;const s=this.find(e);s&&(this.start={x:e.clientX,y:e.clientY,...s},this.timer=window.setTimeout(()=>this.fire(),g))},this.move=e=>{!this.start||this.timer===void 0||x(e.clientX-this.start.x,e.clientY-this.start.y)&&this.cancel()},this.up=()=>this.cancel(),this.click=e=>{Date.now()<this.swallowUntil&&this.find(e)&&(e.stopPropagation(),e.preventDefault(),this.swallowUntil=0)},this.ctx=e=>{const s=this.find(e);s&&(e.preventDefault(),!(this.lastType==="touch"||this.lastType==="pen")&&(this.cancel(),this.lastType="mouse",this.open(s.id,s.el)))},this.key=e=>{const s=e.key==="Enter"&&e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey,o=e.key==="ContextMenu"||e.key==="F10"&&e.shiftKey;if(!s&&!o)return;const d=this.find(e);d&&(e.preventDefault(),e.stopPropagation(),this.open(d.id,d.el))},t.addController(this)}hostConnected(){const t=this.host;t.addEventListener("pointerdown",this.down,!0),t.addEventListener("pointermove",this.move,!0),t.addEventListener("pointerup",this.up,!0),t.addEventListener("pointercancel",this.up,!0),t.addEventListener("click",this.click,!0),t.addEventListener("contextmenu",this.ctx,!0),t.addEventListener("keydown",this.key)}hostDisconnected(){const t=this.host;t.removeEventListener("pointerdown",this.down,!0),t.removeEventListener("pointermove",this.move,!0),t.removeEventListener("pointerup",this.up,!0),t.removeEventListener("pointercancel",this.up,!0),t.removeEventListener("click",this.click,!0),t.removeEventListener("contextmenu",this.ctx,!0),t.removeEventListener("keydown",this.key),this.cancel()}find(t){const i=t.composedPath(),e=V(i);if(!e)return null;const s=i.find(o=>o.getAttribute?.("data-elevator")===e);return s?{id:e,el:s}:null}fire(){const t=this.start;if(this.timer=void 0,this.start=null,!!t){this.swallowUntil=Date.now()+800;try{navigator.vibrate?.(10)}catch{}this.open(t.id,t.el)}}cancel(){this.timer!==void 0&&window.clearTimeout(this.timer),this.timer=void 0,this.start=null}}var Z=Object.defineProperty,J=Object.getOwnPropertyDescriptor,f=(a,t,i,e)=>{for(var s=e>1?void 0:e?J(t,i):t,o=a.length-1,d;o>=0;o--)(d=a[o])&&(s=(e?d(t,i,s):d(s))||s);return e&&s&&Z(t,i,s),s};const ee=15e3,te=24*36e5;let p=class extends k{constructor(){super(...arguments),this.bubbleSkin=new y(this),this.route=null,this.access=$(),this.data=null,this.error="",this.historyId=null,this.editing=!1,this.historyOpener=null,this.press=new W(this,(a,t)=>this.openHistory(a,t))}connectedCallback(){super.connectedCallback(),this.stop=z(a=>{this.access=a,a.manage||(this.editing=!1)}),this.offScreenEdit=E({id:"elevators-edit",label:n("editPage"),icon:"edit",can:()=>this.access.manage&&!this.editing,run:()=>{this.editing=!0}}),this.load(),this.timer=window.setInterval(()=>{document.visibilityState==="visible"&&this.load()},ee)}disconnectedCallback(){window.clearInterval(this.timer),this.stop?.(),this.offScreenEdit?.(),super.disconnectedCallback()}async load(){if(this.access.view)try{this.data=await O(24),this.error=""}catch(a){this.error=T(a)}}openHistory(a,t){this.historyOpener=t,this.historyId=a}closeHistory(){this.historyId=null;const a=this.historyOpener;this.historyOpener=null,a?.isConnected&&this.updateComplete.then(()=>a.focus())}historyDialog(a,t){const i=a.find(o=>o.id===this.historyId);if(!i)return c;const e=L(i.history,t),s=o=>Y(new Date(o));return r`<sw-dialog open heading=${n("historyTitle",{name:i.name})} subheading=${n("last24")} data-elevator-history-dialog @close=${()=>this.closeHistory()}>
      ${e.length?r`<ol class="hist" data-history-rows>${e.map(o=>r`<li data-look=${o.look} data-history-state=${o.state}><span class="dot" aria-hidden="true"></span><span class="t">${o.label}</span><span class="w">${s(o.from)} - ${s(o.to)} · ${S(o.minutes)}</span></li>`)}</ol>`:r`<p>${n("noHistory")}</p>`}
    </sw-dialog>`}kpis(a,t){const i=C(a,t),e=(s,o,d,h)=>r`<div class="kpi" data-look=${s} data-elevators-kpi=${h} ?data-nz=${o>0}><span class="dot" aria-hidden="true"></span><div><b>${o}</b><span class="l">${n(d)}</span></div></div>`;return r`<div class="kpis" role="group" aria-label=${n("title")}>
      ${e("unk",i.total,"title","total")}${e("wait",i.ok,"kpiOk","ok")}${e("fault",i.fault,"kpiFault","fault")}${e("off",i.off,"kpiOff","off")}${e("fire",i.fire,"kpiFire","fire")}${i.usesTravel?e("trav",i.travel,"kpiTravel","travel"):c}
    </div>`}card(a,t,i,e=0){const s=D({state:a.state,stale:t||a.stale,roles:a.roles,flags:a.flags}),o=s.state==="unknown"?"":I(a.since,new Date(i)),d=A(a.history,i-te,i),h=a.extras.filter(l=>l.on!==null);return r`<article class="ecard" tabindex="0" style=${`--i:${Math.min(e,8)}`} data-elevator=${a.id} data-state=${s.state} data-look=${s.look} aria-label=${`${a.name}: ${s.label}`}>
      <div class="head"><h3>${a.name}${a.area_name?r`<small>${a.area_name}</small>`:c}</h3>${R(s)}<button type="button" class="hbtn" data-elevator-history aria-label=${n("historyOpen",{name:a.name})} title=${n("historyOpen",{name:a.name})} @click=${l=>this.openHistory(a.id,l.currentTarget)}><sw-icon name="clock" size="16"></sw-icon></button></div>
      <div class="body">${_(s,74)}
        <div class="meta">
          <div class="leds" role="list" aria-label=${n("sensorsLit")}>${P(a,t||a.stale).map(l=>r`<span class="led" role="listitem" data-look=${l.look} data-on=${String(l.on)} ?data-na=${l.na} data-led=${l.role} aria-label=${w(l)} title=${w(l)}><i aria-hidden="true"></i>${l.label}</span>`)}</div>
          ${h.length?r`<div class="ext">${h.map(l=>r`<span class="chip ${l.on?"c-acc":"c-mut"} nodot" data-extra=${l.position}>${l.label}</span>`)}</div>`:c}
          ${a.history!==null&&a.history!==void 0?r`<div class="tl" data-elevator-bar role="img" aria-label=${b(d)} title=${b(d)}>${d.lead>0&&d.parts.length?r`<span class="lead" style=${`flex:${d.lead}`}></span>`:c}${d.parts.map(l=>r`<span data-look=${l.look} data-bar-state=${l.state} style=${`flex:${l.pct}`}></span>`)}</div>`:c}
          <div class="row2"><span>${a.history?d.parts.length?n("last24"):n("noHistory"):a.partial?n("partial"):""}</span><span data-elevator-ago>${o}</span></div>
          <maint-cert-row kind="elevator" subjectId=${a.id}></maint-cert-row>
        </div>
      </div>
    </article>`}render(){const a=j()&&H(m,!0,F).length<2?r`<sw-tabs .items=${m.filter(h=>h.id==="elevators")} active="elevators" .variant=${N("infra")} data-infra-l1></sw-tabs>`:c;if(!this.access.view)return r`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;if(!this.data)return this.error?r`${a}<sw-state-panel state="error" heading=${n("loadError")} hint=${this.error} data-state="error"></sw-state-panel>`:r`${a}<div class="skl" data-state="loading" aria-busy="true" aria-label=${n("title")}>
            <div class="sk-top"><div class="sk sk-h1"></div><div class="sk sk-sub"></div></div>
            <div class="kpis">${[0,1,2,3,4].map(()=>r`<div class="sk sk-kpi"></div>`)}</div>
            <div class="grid">${[0,1,2].map(()=>r`<div class="sk sk-card"></div>`)}</div>
          </div>`;const t=this.data.elevators,i=this.access.manage,e=M(i,this.editing),s=this.data.stale,o=Date.now(),d=r`<div class="top lead-head"><div><h1>${n("title")}</h1><p class="sub">${n("subtitle")}</p></div><span class="sp"></span>
      ${s?r`<sw-badge kind="stale" label=${n("stale")} data-elevators-stale></sw-badge>`:c}
      ${e.newButton?r`<a class="new" href=${u} data-elevators-new><sw-icon name="plus" size="16"></sw-icon>${n("newElevator")}</a>`:c}
      ${e.doneButton?r`<button type="button" class="new" data-elevators-edit-done @click=${()=>{this.editing=!1}}><sw-icon name="check" size="16"></sw-icon>${n("editDone")}</button>`:c}</div>`;return t.length?r`${a}${d}${this.kpis(t,s)}
      <div class="grid" data-elevators>
        ${t.map((h,l)=>this.card(h,s,o,l))}
        ${e.addCard?r`<a class="add" href=${u} data-elevators-add><div><b>+</b>${n("addCard")}</div></a>`:c}
      </div>
      ${this.historyDialog(t,o)}`:r`${d}${e.addCard?r`<div class="grid"><a class="add" href=${u} data-elevators-add data-state="empty"><div><b>+</b>${n("addCard")}</div></a></div>`:r`<sw-state-panel icon="elevator" state="empty" heading=${n("empty")} data-state="empty"></sw-state-panel>`}`}};p.styles=[q,G,Q,B`
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
      background: var(--sw-accent); color: var(--sw-text-inverse); font-weight: 600; box-shadow: var(--sw-shadow-1);
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
    .head small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-state); font-weight: 400; overflow: hidden; text-overflow: ellipsis; }
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
  `,K];f([U({attribute:!1})],p.prototype,"route",2);f([v()],p.prototype,"access",2);f([v()],p.prototype,"data",2);f([v()],p.prototype,"error",2);f([v()],p.prototype,"historyId",2);f([v()],p.prototype,"editing",2);p=f([X("infra-elevators")],p);export{p as InfraElevators};
//# sourceMappingURL=infra-elevators-CsznnUJQ.js.map
