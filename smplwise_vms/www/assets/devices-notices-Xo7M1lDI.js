import{jR as s,b as a,g as w,ax as D,j as l,i as P,sA as x,sB as T,A as d,k as z,sC as A,n as b,jY as j,a as _,sD as C,sE as L,sF as B,sG as F,sH as q,sI as M,sJ as K,sK as U,e1 as H,sL as I,j_ as V,sM as W,sN as Y,sO as N,jO as G,jX as J,sP as Q,jZ as X,sQ as Z,sR as ee,bh as te}from"./index-Cwrvr-7C.js";import{c as se,r as ae}from"./compose-dialog-C8WidB5H.js";import"./sw-table-YC-wBEqU.js";import{n as S}from"./styles-CRpKoblm.js";import"./sw-logo-art-PLtEZJxU.js";var ie=Object.defineProperty,re=Object.getOwnPropertyDescriptor,O=(e,t,i,r)=>{for(var o=r>1?void 0:r?re(t,i):t,p=e.length-1,u;p>=0;p--)(u=e[p])&&(o=(r?u(t,i,o):u(o))||o);return r&&o&&ie(t,i,o),o};const oe=w`
  .with-tree { display: grid; grid-template-columns: 232px minmax(0, 1fr); gap: 14px; align-items: start; }
  .with-tree > .main { min-inline-size: 0; }
  .tree-m { display: none; }
  @media (max-width: 767px) {
    .with-tree { grid-template-columns: minmax(0, 1fr); }
    .with-tree > notice-places { display: none; }
    .tree-m { display: block; padding: 10px 10px 0; }
    .tree-m select { inline-size: 100%; font: inherit; color: var(--sw-text); background: var(--sw-surface-solid); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); padding: 8px 10px; min-block-size: 44px; }
  }
`;function ne(e,t,i){return a`<div class="tree-m"><select aria-label=${s("placeSelect")} data-place-select @change=${r=>i(r.target.value)}>
    ${e.map(r=>a`<option value=${r.id} ?selected=${r.id===t}>${r.depth?"- ".repeat(r.depth):""}${r.name} (${r.count})</option>`)}</select></div>`}let g=class extends P{constructor(){super(...arguments),this.nodes=[],this.value=x,this.folded=new Set}toggle(e){const t=new Set(this.folded);t.delete(e)||t.add(e),this.folded=t}pick(e){this.dispatchEvent(new CustomEvent("place-change",{detail:e,bubbles:!0,composed:!0}))}render(){return a`<div class="box"><nav aria-label=${s("places")} data-places>
      <div class="ttl">${s("places")}</div>
      ${T(this.nodes,this.folded).map(e=>a`<div class="line ${e.foldable?"grp":""}" data-place-line=${e.id}>
        ${e.foldable?a`<button type="button" class="fold" aria-expanded=${String(!this.folded.has(e.id))} aria-label=${s(this.folded.has(e.id)?"unfoldPlace":"foldPlace",{name:e.name})}
          data-place-fold=${e.id} @click=${()=>this.toggle(e.id)}><sw-icon name="chevronDown" size="14"></sw-icon></button>`:d}
        <button type="button" class="pick d${e.depth}" aria-current=${String(this.value===e.id)} data-place=${e.id} @click=${()=>this.pick(e.id)}>
          ${e.kind==="all"?a`<sw-icon name="building" size="14"></sw-icon>`:e.look?a`<span class="dot" data-look=${e.look} aria-hidden="true"></span>`:d}
          <span class="name">${e.name}</span><span class="n">${e.count}</span></button></div>`)}
    </nav></div>`}};g.styles=w`
    :host { display: block; }
    .box { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-xl); overflow: hidden; }
    nav { display: flex; flex-direction: column; gap: 2px; padding: var(--sw-s-2, 8px); }
    .ttl { padding: var(--sw-s-2, 8px) var(--sw-s-3, 12px) var(--sw-s-1, 4px); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); }
    .line { display: flex; align-items: stretch; gap: 2px; }
    button { font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text); display: flex; align-items: center; gap: var(--sw-s-2, 8px); min-block-size: 36px; padding-inline: var(--sw-s-3, 12px);
      border: 0; border-radius: var(--sw-r-sm, 6px); background: transparent; cursor: pointer; text-align: start; }
    button:hover { background: var(--sw-hover-wash, var(--sw-surface-2)); }
    button:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: -2px; }
    button.pick { flex: 1; min-inline-size: 0; }
    button.pick .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    button.fold { justify-content: center; min-inline-size: 36px; padding-inline: 0; color: var(--sw-text-3); }
    button.fold sw-icon { transition: transform var(--sw-t-fast, 120ms) var(--sw-ease, ease); }
    button.fold[aria-expanded='false'] sw-icon { transform: rotate(var(--fold-rot, 90deg)); }
    :host-context([dir='ltr']) { --fold-rot: -90deg; }
    .grp .name { font-weight: var(--sw-fw-semibold); }
    .d1 { padding-inline-start: var(--sw-s-4, 16px); }
    .d2 { padding-inline-start: calc(var(--sw-s-4, 16px) * 2); }
    button[aria-current='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .n { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-variant-numeric: tabular-nums; }
    .dot { flex: none; inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--c, var(--sw-unknown)); }
    [data-look='warn'] { --c: var(--sw-warning); }
    [data-look='alarm'] { --c: var(--sw-danger); }
    [data-look='acc'], [data-look='ok'] { --c: var(--sw-accent); }
  `;O([D({attribute:!1})],g.prototype,"nodes",2);O([D()],g.prototype,"value",2);O([l()],g.prototype,"folded",2);g=O([z("notice-places")],g);const y=e=>("0"+e).slice(-2);function le(e){const t=new Date(e);return Number.isNaN(t.getTime())?"":`${y(t.getDate())}.${y(t.getMonth()+1)} ${y(t.getHours())}:${y(t.getMinutes())}`}function de(e){const t=Array.isArray(e.users)&&Array.isArray(e.unread),i=t?e.users.length:e.read,r=t?e.users.length+e.unread.length:e.audience,o=(n,k)=>n.name.localeCompare(k.name,"he"),p=(e.users??[]).map(n=>({name:n.name,place:n.place??"",at:n.read_at}));p.sort((n,k)=>Date.parse(k.at)-Date.parse(n.at)||o(n,k));const u=(e.unread??[]).map(n=>({name:n.name,place:n.place??"",at:""})).sort(o);return{read:i,unread:Math.max(0,r-i),total:r,pct:r>0?Math.round(i*100/r):0,named:t,rows:{read:p,unread:u}}}var ce=Object.defineProperty,pe=Object.getOwnPropertyDescriptor,$=(e,t,i,r)=>{for(var o=r>1?void 0:r?pe(t,i):t,p=e.length-1,u;p>=0;p--)(u=e[p])&&(o=(r?u(t,i,o):u(o))||o);return r&&o&&ce(t,i,o),o};let f=class extends P{constructor(){super(...arguments),this.notice=null,this.data=null,this.error="",this.seg="read",this.seq=0}willUpdate(e){e.has("notice")&&this.load()}async load(){const e=this.notice,t=++this.seq;if(this.data=null,this.error="",this.seg="read",!!e)try{const i=await A(e.id);t===this.seq&&(this.data=i)}catch(i){t===this.seq&&(this.error=b(i))}}close(){this.dispatchEvent(new CustomEvent("reads-close",{bubbles:!0,composed:!0}))}columns(){const e=[{key:"name",label:s("colName"),render:t=>a`<span class="t1">${t.name}</span>`},{key:"place",label:s("colPlace"),kind:"muted",render:t=>t.place||s("allPlaces"),cellAttrs:()=>({"data-reads-place":!0})}];return this.seg==="read"&&e.push({key:"at",label:s("colReadAt"),render:t=>a`<span class="num">${le(t.at)}</span>`}),e}body(){if(this.error)return a`<sw-state-panel compact state="error" heading=${s("readsLoadError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return a`<sw-state-panel compact state="loading"></sw-state-panel>`;const e=de(this.data),t=e.rows[this.seg];return a`<div class="body-grid" data-reads-body>
      <div class="reads"><div class="kpis" data-reads-kpis>
        <div class="kpi" data-look="ok"><span class="dot"></span><div><b class="num" data-reads-read>${e.read}</b><span class="l">${s("segReadShort")}</span></div></div>
        <div class="kpi" data-look="off"><span class="dot"></span><div><b class="num" data-reads-unread>${e.unread}</b><span class="l">${s("segUnreadShort")}</span></div></div>
        <div class="kpi" data-look="acc"><span class="dot"></span><div><b class="num" data-reads-total>${e.total}</b><span class="l">${s("recipients")}</span></div></div></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${e.pct} aria-label=${s("readSheet")}><i style=${`inline-size:${e.pct}%`}></i></div></div>
      ${e.named?a`
        <sw-segmented label=${s("readsList")} data-reads-seg value=${this.seg} @change=${i=>this.seg=i.detail.value}
          .options=${[{value:"read",label:s("readN",{n:e.read}),attrs:{"data-seg":"read"}},{value:"unread",label:s("unreadN",{n:e.unread}),attrs:{"data-seg":"unread"}}]}></sw-segmented>
        ${t.length?a`<div class="list"><sw-table bare static-rows data-reads-table .columns=${this.columns()} .rows=${t}
              .rowAttrs=${()=>({"data-reads-row":!0})}></sw-table></div>`:a`<p class="mut" data-reads-none>${s("readsNone")}</p>`}`:d}
    </div>`}render(){const e=this.notice;return a`<sw-dialog ?open=${!!e} heading=${s("readSheet")} subheading=${e?.title??""} @close=${()=>this.close()}>
      ${e?this.body():d}
      <sw-button slot="footer" variant="primary" @click=${()=>this.close()}>${s("close")}</sw-button></sw-dialog>`}};f.styles=[S,w`
    .reads { display: grid; gap: 8px; }
    .reads .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
    .reads .kpi { cursor: default; }
    .bar { block-size: 8px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3, var(--sw-surface-2)); overflow: hidden; }
    .bar i { display: block; block-size: 100%; background: var(--sw-success); border-radius: inherit; }
    .body-grid { display: grid; gap: 12px; }
    .list { max-block-size: 280px; overflow: auto; }
    /* CR-CMP2-TABLES-2450: the shared table, inside the sheet (no card of its own, never wider than the dialog) */
    .list sw-table { --sw-table-min: 0; }
    @media (max-width: 767px) { .reads .kpi { padding: 8px 10px; } }
  `];$([D({attribute:!1})],f.prototype,"notice",2);$([l()],f.prototype,"data",2);$([l()],f.prototype,"error",2);$([l()],f.prototype,"seg",2);f=$([z("notice-reads")],f);const E=e=>e.state==="active",he=e=>e.state==="active"&&e.severity==="critical",R=(e,t,i)=>!!e&&!i&&(!E(e)||t);function ue(e,t){return e.state==="draft"||e.status==="draft"?!0:t}var fe=Object.defineProperty,ve=Object.getOwnPropertyDescriptor,m=(e,t,i,r)=>{for(var o=r>1?void 0:r?ve(t,i):t,p=e.length-1,u;p>=0;p--)(u=e[p])&&(o=(r?u(t,i,o):u(o))||o);return r&&o&&fe(t,i,o),o};let v=class extends P{constructor(){super(...arguments),this.notice=null,this.ticked=!1,this.busy=!1,this.err=""}willUpdate(e){e.has("notice")&&(this.ticked=!1,this.busy=!1,this.err="")}close(){this.dispatchEvent(new CustomEvent("notice-delete-close",{bubbles:!0,composed:!0}))}async confirm(){const e=this.notice;if(!(!e||!R(e,this.ticked,this.busy))){this.busy=!0,this.err="";try{await j(e.id,E(e)),this.dispatchEvent(new CustomEvent("notice-deleted",{detail:{id:e.id},bubbles:!0,composed:!0}))}catch(t){this.err=t instanceof _&&t.status===403&&t.code==="emergency_notice"?s("delRefused"):b(t)}finally{this.busy=!1}}}render(){const e=this.notice;return e?a`<sw-dialog open data-delete-dialog heading=${s("delTitle")} @close=${()=>this.close()}>
      <p data-delete-line>${s("delBody",{title:e.title})}</p>
      ${E(e)?a`<label class="ck"><input type="checkbox" data-delete-live .checked=${this.ticked} @change=${t=>this.ticked=t.target.checked}>${s(he(e)?"delUrgentTick":"delLiveTick")}</label>`:d}
      ${this.err?a`<p class="err" role="alert" data-delete-error>${this.err}</p>`:d}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-delete-confirm ?disabled=${!R(e,this.ticked,this.busy)} @click=${()=>this.confirm()}>${s("delConfirm")}</sw-button>
    </sw-dialog>`:a`<sw-dialog></sw-dialog>`}};v.styles=w`
    p { margin: 0 0 var(--sw-s-3, 12px); color: var(--sw-text); }
    .ck { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); margin: 8px 0 0; }
  `;m([D({attribute:!1})],v.prototype,"notice",2);m([l()],v.prototype,"ticked",2);m([l()],v.prototype,"busy",2);m([l()],v.prototype,"err",2);v=m([z("notice-delete")],v);const ge=w`
  .top h1 {
    font-weight: var(--sw-fw-bold);
    letter-spacing: -0.01em;
  }
  .kpi {
    transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color),
      background var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .kpi b {
    font-weight: var(--sw-fw-bold);
    font-variant-numeric: tabular-nums;
  }
  .kpi:active,
  .seg button:active,
  .pick:active:not(:disabled) {
    transform: scale(var(--sw-press-scale));
  }
  .kpi:focus-visible,
  .seg button:focus-visible,
  .pick:focus-visible,
  .search:focus-within {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  .seg button {
    transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  @media (hover: hover) and (pointer: fine) {
    .kpi:hover {
      border-color: var(--sw-border-strong);
      background: var(--sw-surface-2);
    }
    .seg button:hover:not([aria-pressed='true']) {
      color: var(--sw-text);
    }
    .card.go:hover {
      background: var(--sw-hover-wash);
    }
  }
  /* POLISH4-WP4: the row wash is gated to a hovering fine pointer in the shared sheet itself (notices/styles.ts, POLISH4-WP1), so the
     local cancel that lived here is gone */
  table.t tr.go:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }
  table.t tr.go:focus-visible td {
    background: var(--sw-surface-2);
  }
  table.t td .t1 {
    display: flex;
    align-items: center;
    gap: var(--sw-s-1h);
  }
  .card.go {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--sw-t-hover) var(--sw-ease-color);
  }
  .card.go:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: -2px;
  }
  .card .t1 {
    display: flex;
    align-items: center;
    gap: var(--sw-s-1h);
  }
  .new {
    flex: none;
    margin-inline-start: 0;
  }
  .toast {
    transition: opacity var(--sw-t-hover) var(--sw-ease-color), translate var(--sw-t-hover) var(--sw-ease);
  }
  @starting-style {
    .toast {
      opacity: 0;
      translate: 0 8px;
    }
  }
  /* a phone: the toolbar's search takes the rest of the row, the KPI tiles and the segment keys reach a 44 px target */
  @media (max-width: 767px) {
    .search {
      flex: 1;
      min-inline-size: 0;
      min-block-size: var(--sw-touch-desktop);
      box-sizing: border-box;
    }
    .search input {
      inline-size: 100%;
      font-size: var(--sw-fs-md);
    }
    .seg button {
      min-block-size: var(--sw-touch);
    }
    .kpi {
      min-block-size: var(--sw-touch-desktop);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .kpi,
    .seg button,
    .card.go,
    .toast {
      transition-duration: 0ms;
    }
    @starting-style {
      .toast {
        translate: none;
      }
    }
  }
`;var we=Object.defineProperty,be=Object.getOwnPropertyDescriptor,h=(e,t,i,r)=>{for(var o=r>1?void 0:r?be(t,i):t,p=e.length-1,u;p>=0;p--)(u=e[p])&&(o=(r?u(t,i,o):u(o))||o);return r&&o&&we(t,i,o),o};let c=class extends P{constructor(){super(...arguments),this.data=null,this.manager=!1,this.error="",this.off=!1,this.forbidden=!1,this.kpi="all",this.seg="all",this.q="",this.boards=[],this.floors=[],this.groups=[],this.roles=[],this.areas=[],this.place=x,this.readsFor=null,this.draft=null,this.deleting=null,this.resending=null,this.reading=null,this.toast="",this.toastTimer=0}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{let e;try{e=await C("all"),this.manager=!0}catch(t){if(t instanceof _&&t.status===403)e=await C("mine"),this.manager=!1;else throw t}this.data=e,this.off=!1,this.forbidden=!1,this.manager&&!this.boards.length&&this.loadOptions()}catch(e){e instanceof _&&e.status===404?this.off=!0:e instanceof _&&e.status===403?this.forbidden=!0:this.error=b(e)}}async loadOptions(){try{const[e,t]=await Promise.all([L(),B()]);this.boards=e.boards,this.floors=t.floors,this.areas=t.areas??[],this.groups=t.groups,this.roles=t.roles}catch{}}say(e){this.toast=e,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}render(){if(this.off)return a`<sw-page heading=${s("title")}><sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${s("off")} hint=${s("offHint")}
        actionLabel=${s("toSettings")} @action=${()=>location.hash=F}></sw-state-panel></sw-page>`;if(this.forbidden)return a`<sw-page heading=${s("title")}><sw-state-panel state="forbidden" heading=${s("forbidden")}></sw-state-panel></sw-page>`;if(this.error)return a`<sw-page heading=${s("title")}><sw-state-panel state="error" heading=${s("loadError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.data)return a`<sw-page heading=${s("title")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.data.notices,t=q(e),r=this.data.defaults.show_places_tree!==!1&&this.manager&&this.floors.length?M(e.filter(n=>K(n,"all","all","",!0)),this.floors,this.areas):[],o=r.some(n=>n.id===this.place)?this.place:x,p=U(e,{kpi:this.kpi,seg:this.seg,q:this.q,manager:this.manager,place:o,floors:this.floors,areas:this.areas}),u=this.manager?s("subtitleMgr",{n:t.all,s:t.scheduled,d:t.drafts}):s("subtitle",{n:t.all});return a`
      <sw-page heading="" data-notices-page>
        <div class="top"><div><h1>${s("title")}</h1><p class="sub">${u}</p></div><span class="sp"></span>
          <div class="meta">${this.manager?a`<sw-button variant="primary" icon="plus" data-compose @click=${()=>this.compose()}>${s("newNotice")}</sw-button>`:d}</div></div>
        ${e.length?a`
            ${this.kpis(t)}
            <div class=${r.length?"with-tree":""}>
            ${r.length?a`<notice-places .nodes=${r} .value=${o} @place-change=${n=>this.place=n.detail}></notice-places>`:d}
            <div class="panel flush main">
              ${r.length?ne(r,o,n=>this.place=n):d}
              <div class="toolbar">
                ${this.manager?a`<sw-segmented label=${s("colBoards")} value=${this.seg} @change=${n=>this.seg=n.detail.value}
                      .options=${["all","mine","tv"].map(n=>({value:n,label:s(n==="all"?"segAll":n==="mine"?"segMine":"segTv")}))}></sw-segmented>`:d}
                <span class="sp"></span>
                <label class="search"><sw-icon name="search" size="14" aria-hidden="true"></sw-icon><input type="search" placeholder=${s("search")} aria-label=${s("search")} .value=${this.q} @input=${n=>this.q=n.target.value}></label>
              </div>
              <div class="scrollx">${this.table(p)}</div>
              <div class="cards">${p.length?p.map(n=>this.card(n)):a`<div class="card" data-no-rows><span class="mut">${s("noRows")}</span> <button type="button" class="pick" data-clear-filters @click=${()=>this.clearFilters()}>${s("clearFilters")}</button></div>`}</div>
            </div></div>`:a`<sw-state-panel icon="inbox" state="empty" heading=${s("emptyTitle")} hint=${this.manager?s("emptyManager"):s("emptyReader")}
              actionLabel=${this.manager?s("firstNotice"):""} @action=${()=>this.compose()}></sw-state-panel>`}
      </sw-page>
      ${this.composeDialog()} ${this.readDialog()} ${this.resendDialog()}
      <notice-delete .notice=${this.deleting} @notice-delete-close=${()=>this.deleting=null} @notice-deleted=${()=>this.deleted()}></notice-delete>
      <notice-reads .notice=${this.readsFor} @reads-close=${()=>this.readsFor=null}></notice-reads>
      ${this.toast?a`<div class="toast" role="status" ${H()}>${this.toast}</div>`:d}`}kpis(e){const t=this.manager?[{k:"all",look:"acc",label:s("kpiActive")},{k:"urgent",look:"alarm",label:s("kpiUrgent")},{k:"scheduled",look:"acc",label:s("kpiScheduled")},{k:"expired",look:"off",label:s("kpiExpired")},{k:"drafts",look:"unk",label:s("kpiDrafts")}]:[{k:"all",look:"acc",label:s("kpiActive")},{k:"urgent",look:"alarm",label:s("kpiUrgent")},{k:"unread",look:"acc",label:s("kpiUnread")}];return a`<div class="kpis" role="group" data-kpis>${t.map(i=>a`<button type="button" class="kpi" data-k=${i.k} data-look=${i.look} aria-pressed=${String(this.kpi===i.k)}
      @click=${()=>this.kpi=this.kpi===i.k&&i.k!=="all"?"all":i.k}><span class="dot" aria-hidden="true"></span><div><b class="num">${e[i.k]}</b><span class="l">${i.label}</span></div></button>`)}</div>`}boardNames(e){return e.boards.map(t=>this.boards.find(i=>i.id===t)?.name??"").filter(Boolean)}look(e){return e.state==="draft"?"unk":e.state==="expired"||e.state==="archived"?"off":I[e.severity]}badge(e){const t=e.state==="active"?e.severity==="info"?s("stActive"):s(V[e.severity]):s(W[e.state]);return a`<span class="badge" data-look=${this.look(e)}>${e.severity==="critical"&&e.state==="active"?a`<sw-icon name="warning" size="12"></sw-icon>`:d}${t}</span>`}table(e){const t=Object.fromEntries(this.floors.map(i=>[i.id,i.name]));return a`<table class="t"><thead><tr><th>${s("colState")}</th><th>${s("colNotice")}</th>${this.manager?a`<th>${s("colAudience")}</th><th>${s("colBoards")}</th>`:d}
      <th>${s("colWindow")}</th>${this.manager?a`<th>${s("colReads")}</th><th></th>`:d}</tr></thead><tbody>
 ${e.length?d:a`<tr data-no-rows><td colspan=${this.manager?7:3}><span class="mut">${s("noRows")}</span> <button type="button" class="pick" data-clear-filters @click=${()=>this.clearFilters()}>${s("clearFilters")}</button></td></tr>`}
      ${e.map(i=>a`<tr class="go" tabindex="0" data-notice=${i.id} data-look=${this.look(i)} @click=${()=>this.open(i)} @keydown=${r=>this.rowKey(r,i)}>
        <td>${this.badge(i)}</td>
        <td><span class="t1">${i.title}${i.read===!1&&i.state==="active"&&!this.manager?a`${this.unreadDot()}`:d}</span><span class="t2">${i.body.split(`
`)[0]}</span></td>
        ${this.manager?a`<td><span class="chips">${Y(i.audience,t).map(r=>a`<span class="chip">${r}</span>`)}</span></td>
          <td>${this.boardNames(i).length?a`<span class="chips">${this.boardNames(i).map(r=>a`<span class="chip">${r}</span>`)}</span>`:a`<span class="mut">-</span>`}</td>`:d}
        <td class="num mut">${N(i)}</td>
        ${this.manager?a`<td class="num mut">${this.readsButton(i)}</td><td class="act" @click=${r=>r.stopPropagation()}>${this.actions(i)}</td>`:d}
      </tr>`)}
      </tbody></table>`}card(e){return a`<div class="card go" tabindex="0" data-look=${this.look(e)} @click=${()=>this.open(e)} @keydown=${t=>this.rowKey(t,e)}>
      <div class="row">${this.badge(e)}<span class="mut num">${N(e)}</span></div>
      <span class="t1">${e.title}${e.read===!1&&e.state==="active"&&!this.manager?this.unreadDot():d}</span><span class="t2">${e.body.split(`
`)[0]}</span>
      ${this.manager?a`<div class="row" @click=${t=>t.stopPropagation()}>${this.readsButton(e)}${this.actions(e)}</div>`:d}</div>`}unreadDot(){return a`<span class="new" role="img" aria-label=${s("widgetNew")}></span>`}rowKey(e,t){e.target!==e.currentTarget||e.key!=="Enter"&&e.key!==" "||(e.preventDefault(),this.open(t))}readsButton(e){return e.state==="draft"?"-":a`<button type="button" class="pick" data-reads=${e.id} aria-label=${s("readsOf",{title:e.title})} @click=${t=>{t.stopPropagation(),this.readsFor=e}}>${e.reads??0}</button>`}actions(e){const t=this.manager&&ue(e,this.data?.can.delete??!1)?a`<sw-button size="sm" variant="ghost" data-delete @click=${()=>this.askDelete(e.id)}>${s("delete")}</sw-button>`:d;return e.state==="archived"?t:a`${e.state!=="expired"?a`<sw-button size="sm" variant=${e.state==="draft"?"primary":"secondary"} @click=${()=>this.open(e)}>${s(e.state==="draft"?"continueEdit":"edit")}</sw-button>`:d}
      ${se(e,this.data?.can.push??!1)?a`<sw-button size="sm" data-resend @click=${()=>this.askResend(e)}>${s("resend")}</sw-button>`:d}
      ${e.state!=="draft"?a`<sw-button size="sm" data-archive @click=${()=>this.archive(e)}>${s("archive")}</sw-button>`:d}${t}`}askResend(e){this.resending={n:e,count:null,busy:!1},G(e.audience??{}).then(t=>{this.resending?.n.id===e.id&&(this.resending={...this.resending,count:t.users})}).catch(()=>{})}async resend(){const e=this.resending;if(!(!e||e.busy)){this.resending={...e,busy:!0};try{const t=ae((await J(e.n.id)).push);this.resending=null,this.say(s(t.key,{n:t.n})),await this.load()}catch(t){this.resending=null,this.say(b(t))}}}resendDialog(){const e=this.resending;return a`<sw-dialog ?open=${!!e} heading=${e?s("resendAsk",{title:e.n.title}):""} @close=${()=>this.resending=null} data-resend-confirm>
      ${e?a`<p>${e.count!==null?s("resendBody",{n:e.count}):s("resendBodyNoCount")}</p>`:d}
      <sw-button slot="footer" @click=${()=>this.resending=null}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" ?disabled=${e?.busy??!1} data-resend-go @click=${()=>this.resend()}>${s("resend")}</sw-button></sw-dialog>`}askDelete(e){const t=this.data?.notices.find(i=>i.id===e);t&&(this.draft=null,this.deleting={id:t.id,title:t.title,state:t.state,severity:t.severity})}clearFilters(){this.kpi="all",this.seg="all",this.q="",this.place=x}async deleted(){this.deleting=null,this.draft=null,this.say(s("delDone")),await this.load()}open(e){if(this.manager){this.compose(e);return}this.reading=e,e.read===!1&&Q(e.id).then(()=>{this.data&&(this.data={...this.data,notices:this.data.notices.map(t=>t.id===e.id?{...t,read:!0}:t)})}).catch(()=>{})}async archive(e){try{await X(e.id),this.say(s("archived")),await this.load()}catch(t){this.say(b(t))}}readDialog(){const e=this.reading;return a`<sw-dialog ?open=${!!e} heading=${e?.title??""} subheading=${e?N(e):""} @close=${()=>this.reading=null}>
      ${e?a`<p>${e.body.split(`
`).map(t=>a`${t}<br>`)}</p>`:d}
      <sw-button slot="footer" variant="primary" @click=${()=>this.reading=null}>${s("close")}</sw-button></sw-dialog>`}compose(e){const t=this.data?.defaults??{default_days:7,default_severity:"info"};this.draft=e?Z(e):ee(new Date,t.default_days,t.default_severity)}async saved(e){this.draft=null,this.say(e.detail.message),await this.load()}composeDialog(){return a`<notice-compose .draft=${this.draft} .canDelete=${this.data?.can.delete??!1} .canPush=${this.data?.can.push??!1} .pushDefault=${this.data?.defaults.push_default??"by_severity"} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${()=>this.draft=null} @notice-delete=${e=>this.askDelete(e.detail.id)} @notice-saved=${e=>this.saved(e)}></notice-compose>`}};c.styles=[S,oe,ge,te,w`
      @media (max-width: 767px) {
        sw-segmented {
          --sw-seg-h: var(--sw-touch);
        }
      }
    `];h([l()],c.prototype,"data",2);h([l()],c.prototype,"manager",2);h([l()],c.prototype,"error",2);h([l()],c.prototype,"off",2);h([l()],c.prototype,"forbidden",2);h([l()],c.prototype,"kpi",2);h([l()],c.prototype,"seg",2);h([l()],c.prototype,"q",2);h([l()],c.prototype,"boards",2);h([l()],c.prototype,"floors",2);h([l()],c.prototype,"groups",2);h([l()],c.prototype,"roles",2);h([l()],c.prototype,"areas",2);h([l()],c.prototype,"place",2);h([l()],c.prototype,"readsFor",2);h([l()],c.prototype,"draft",2);h([l()],c.prototype,"deleting",2);h([l()],c.prototype,"resending",2);h([l()],c.prototype,"reading",2);h([l()],c.prototype,"toast",2);c=h([z("devices-notices")],c);export{c as DevicesNotices};
