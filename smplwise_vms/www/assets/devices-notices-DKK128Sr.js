import{ry as s,e as a,E as w,F as D,G as d,a as P,sw as x,sx as R,A as l,H as z,sy as A,T as b,st as L,j as _,rU as S,rS as F,rV as j,s6 as q,sz as B,sA as U,sB as M,sC as K,cM as H,se as I,sf as V,sD as W,sE as Y,sg as O,sk as G,ss as X,sF as J,su as Q,rY as Z,rX as tt,cN as et}from"./index-CH_WvWfd.js";import{c as st,r as at}from"./compose-dialog-OetF7vMM.js";import{n as C}from"./styles-CWklSd3C.js";import"./sw-logo-art-Va6y_cIM.js";var it=Object.defineProperty,rt=Object.getOwnPropertyDescriptor,N=(t,e,i,r)=>{for(var o=r>1?void 0:r?rt(e,i):e,p=t.length-1,u;p>=0;p--)(u=t[p])&&(o=(r?u(e,i,o):u(o))||o);return r&&o&&it(e,i,o),o};const ot=w`
  .with-tree { display: grid; grid-template-columns: 232px minmax(0, 1fr); gap: 14px; align-items: start; }
  .with-tree > .main { min-inline-size: 0; }
  .tree-m { display: none; }
  @media (max-width: 767px) {
    .with-tree { grid-template-columns: minmax(0, 1fr); }
    .with-tree > notice-places { display: none; }
    .tree-m { display: block; padding: 10px 10px 0; }
    .tree-m select { inline-size: 100%; font: inherit; color: var(--sw-text); background: var(--sw-surface-solid); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); padding: 8px 10px; min-block-size: 44px; }
  }
`;function nt(t,e,i){return a`<div class="tree-m"><select aria-label=${s("placeSelect")} data-place-select @change=${r=>i(r.target.value)}>
    ${t.map(r=>a`<option value=${r.id} ?selected=${r.id===e}>${r.depth?"- ".repeat(r.depth):""}${r.name} (${r.count})</option>`)}</select></div>`}let v=class extends P{constructor(){super(...arguments),this.nodes=[],this.value=x,this.folded=new Set}toggle(t){const e=new Set(this.folded);e.delete(t)||e.add(t),this.folded=e}pick(t){this.dispatchEvent(new CustomEvent("place-change",{detail:t,bubbles:!0,composed:!0}))}render(){return a`<div class="box"><nav aria-label=${s("places")} data-places>
      <div class="ttl">${s("places")}</div>
      ${R(this.nodes,this.folded).map(t=>a`<div class="line ${t.foldable?"grp":""}" data-place-line=${t.id}>
        ${t.foldable?a`<button type="button" class="fold" aria-expanded=${String(!this.folded.has(t.id))} aria-label=${s(this.folded.has(t.id)?"unfoldPlace":"foldPlace",{name:t.name})}
          data-place-fold=${t.id} @click=${()=>this.toggle(t.id)}><sw-icon name="chevronDown" size="14"></sw-icon></button>`:l}
        <button type="button" class="pick d${t.depth}" aria-current=${String(this.value===t.id)} data-place=${t.id} @click=${()=>this.pick(t.id)}>
          ${t.kind==="all"?a`<sw-icon name="building" size="14"></sw-icon>`:t.look?a`<span class="dot" data-look=${t.look} aria-hidden="true"></span>`:l}
          <span class="name">${t.name}</span><span class="n">${t.count}</span></button></div>`)}
    </nav></div>`}};v.styles=w`
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
  `;N([D({attribute:!1})],v.prototype,"nodes",2);N([D()],v.prototype,"value",2);N([d()],v.prototype,"folded",2);v=N([z("notice-places")],v);const y=t=>("0"+t).slice(-2);function lt(t){const e=new Date(t);return Number.isNaN(e.getTime())?"":`${y(e.getDate())}.${y(e.getMonth()+1)} ${y(e.getHours())}:${y(e.getMinutes())}`}function dt(t){const e=Array.isArray(t.users)&&Array.isArray(t.unread),i=e?t.users.length:t.read,r=e?t.users.length+t.unread.length:t.audience,o=(n,k)=>n.name.localeCompare(k.name,"he"),p=(t.users??[]).map(n=>({name:n.name,place:n.place??"",at:n.read_at}));p.sort((n,k)=>Date.parse(k.at)-Date.parse(n.at)||o(n,k));const u=(t.unread??[]).map(n=>({name:n.name,place:n.place??"",at:""})).sort(o);return{read:i,unread:Math.max(0,r-i),total:r,pct:r>0?Math.round(i*100/r):0,named:e,rows:{read:p,unread:u}}}var ct=Object.defineProperty,pt=Object.getOwnPropertyDescriptor,$=(t,e,i,r)=>{for(var o=r>1?void 0:r?pt(e,i):e,p=t.length-1,u;p>=0;p--)(u=t[p])&&(o=(r?u(e,i,o):u(o))||o);return r&&o&&ct(e,i,o),o};let f=class extends P{constructor(){super(...arguments),this.notice=null,this.data=null,this.error="",this.seg="read",this.seq=0}willUpdate(t){t.has("notice")&&this.load()}async load(){const t=this.notice,e=++this.seq;if(this.data=null,this.error="",this.seg="read",!!t)try{const i=await A(t.id);e===this.seq&&(this.data=i)}catch(i){e===this.seq&&(this.error=b(i))}}close(){this.dispatchEvent(new CustomEvent("reads-close",{bubbles:!0,composed:!0}))}body(){if(this.error)return a`<sw-state-panel compact state="error" heading=${s("readsLoadError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return a`<sw-state-panel compact state="loading"></sw-state-panel>`;const t=dt(this.data),e=t.rows[this.seg];return a`<div class="body-grid" data-reads-body>
      <div class="reads"><div class="kpis" data-reads-kpis>
        <div class="kpi" data-look="ok"><span class="dot"></span><div><b class="num" data-reads-read>${t.read}</b><span class="l">${s("segReadShort")}</span></div></div>
        <div class="kpi" data-look="off"><span class="dot"></span><div><b class="num" data-reads-unread>${t.unread}</b><span class="l">${s("segUnreadShort")}</span></div></div>
        <div class="kpi" data-look="acc"><span class="dot"></span><div><b class="num" data-reads-total>${t.total}</b><span class="l">${s("recipients")}</span></div></div></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${t.pct} aria-label=${s("readSheet")}><i style=${`inline-size:${t.pct}%`}></i></div></div>
      ${t.named?a`
        <div class="seg" role="group" aria-label=${s("readsList")} data-reads-seg>
          <button aria-pressed=${String(this.seg==="read")} data-seg="read" @click=${()=>this.seg="read"}>${s("readN",{n:t.read})}</button>
          <button aria-pressed=${String(this.seg==="unread")} data-seg="unread" @click=${()=>this.seg="unread"}>${s("unreadN",{n:t.unread})}</button></div>
        ${e.length?a`<div class="list"><table class="t" data-reads-table><thead><tr><th>${s("colName")}</th><th>${s("colPlace")}</th>${this.seg==="read"?a`<th>${s("colReadAt")}</th>`:l}</tr></thead><tbody>
              ${e.map(i=>a`<tr data-reads-row><td><span class="t1">${i.name}</span></td><td class="mut" data-reads-place>${i.place||s("allPlaces")}</td>${this.seg==="read"?a`<td class="date num">${lt(i.at)}</td>`:l}</tr>`)}
            </tbody></table></div>`:a`<p class="mut" data-reads-none>${s("readsNone")}</p>`}`:l}
    </div>`}render(){const t=this.notice;return a`<sw-dialog ?open=${!!t} heading=${s("readSheet")} subheading=${t?.title??""} @close=${()=>this.close()}>
      ${t?this.body():l}
      <sw-button slot="footer" variant="primary" @click=${()=>this.close()}>${s("close")}</sw-button></sw-dialog>`}};f.styles=[C,w`
    .reads { display: grid; gap: 8px; }
    .reads .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
    .reads .kpi { cursor: default; }
    .bar { block-size: 8px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3, var(--sw-surface-2)); overflow: hidden; }
    .bar i { display: block; block-size: 100%; background: var(--sw-success); border-radius: inherit; }
    .body-grid { display: grid; gap: 12px; }
    .list { max-block-size: 280px; overflow: auto; }
    .date { white-space: nowrap; }
    @media (max-width: 767px) { .reads .kpi { padding: 8px 10px; } }
  `];$([D({attribute:!1})],f.prototype,"notice",2);$([d()],f.prototype,"data",2);$([d()],f.prototype,"error",2);$([d()],f.prototype,"seg",2);f=$([z("notice-reads")],f);const E=t=>t.state==="active",ht=t=>t.state==="active"&&t.severity==="critical",T=(t,e,i)=>!!t&&!i&&(!E(t)||e);function ut(t,e){return t.state==="draft"||t.status==="draft"?!0:e}var ft=Object.defineProperty,gt=Object.getOwnPropertyDescriptor,m=(t,e,i,r)=>{for(var o=r>1?void 0:r?gt(e,i):e,p=t.length-1,u;p>=0;p--)(u=t[p])&&(o=(r?u(e,i,o):u(o))||o);return r&&o&&ft(e,i,o),o};let g=class extends P{constructor(){super(...arguments),this.notice=null,this.ticked=!1,this.busy=!1,this.err=""}willUpdate(t){t.has("notice")&&(this.ticked=!1,this.busy=!1,this.err="")}close(){this.dispatchEvent(new CustomEvent("notice-delete-close",{bubbles:!0,composed:!0}))}async confirm(){const t=this.notice;if(!(!t||!T(t,this.ticked,this.busy))){this.busy=!0,this.err="";try{await L(t.id,E(t)),this.dispatchEvent(new CustomEvent("notice-deleted",{detail:{id:t.id},bubbles:!0,composed:!0}))}catch(e){this.err=e instanceof _&&e.status===403&&e.code==="emergency_notice"?s("delRefused"):b(e)}finally{this.busy=!1}}}render(){const t=this.notice;return t?a`<sw-dialog open data-delete-dialog heading=${s("delTitle")} @close=${()=>this.close()}>
      <p data-delete-line>${s("delBody",{title:t.title})}</p>
      ${E(t)?a`<label class="ck"><input type="checkbox" data-delete-live .checked=${this.ticked} @change=${e=>this.ticked=e.target.checked}>${s(ht(t)?"delUrgentTick":"delLiveTick")}</label>`:l}
      ${this.err?a`<p class="err" role="alert" data-delete-error>${this.err}</p>`:l}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-delete-confirm ?disabled=${!T(t,this.ticked,this.busy)} @click=${()=>this.confirm()}>${s("delConfirm")}</sw-button>
    </sw-dialog>`:a`<sw-dialog></sw-dialog>`}};g.styles=w`
    p { margin: 0 0 var(--sw-s-3, 12px); color: var(--sw-text); }
    .ck { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); margin: 8px 0 0; }
  `;m([D({attribute:!1})],g.prototype,"notice",2);m([d()],g.prototype,"ticked",2);m([d()],g.prototype,"busy",2);m([d()],g.prototype,"err",2);g=m([z("notice-delete")],g);const vt=w`
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
`;var bt=Object.defineProperty,wt=Object.getOwnPropertyDescriptor,h=(t,e,i,r)=>{for(var o=r>1?void 0:r?wt(e,i):e,p=t.length-1,u;p>=0;p--)(u=t[p])&&(o=(r?u(e,i,o):u(o))||o);return r&&o&&bt(e,i,o),o};let c=class extends P{constructor(){super(...arguments),this.data=null,this.manager=!1,this.error="",this.off=!1,this.forbidden=!1,this.kpi="all",this.seg="all",this.q="",this.boards=[],this.floors=[],this.groups=[],this.roles=[],this.areas=[],this.place=x,this.readsFor=null,this.draft=null,this.deleting=null,this.resending=null,this.reading=null,this.toast="",this.toastTimer=0}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{let t;try{t=await S("all"),this.manager=!0}catch(e){if(e instanceof _&&e.status===403)t=await S("mine"),this.manager=!1;else throw e}this.data=t,this.off=!1,this.forbidden=!1,this.manager&&!this.boards.length&&this.loadOptions()}catch(t){t instanceof _&&t.status===404?this.off=!0:t instanceof _&&t.status===403?this.forbidden=!0:this.error=b(t)}}async loadOptions(){try{const[t,e]=await Promise.all([F(),j()]);this.boards=t.boards,this.floors=e.floors,this.areas=e.areas??[],this.groups=e.groups,this.roles=e.roles}catch{}}say(t){this.toast=t,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}render(){if(this.off)return a`<sw-page heading=${s("title")}><sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${s("off")} hint=${s("offHint")}
        actionLabel=${s("toSettings")} @action=${()=>location.hash=q}></sw-state-panel></sw-page>`;if(this.forbidden)return a`<sw-page heading=${s("title")}><sw-state-panel state="forbidden" heading=${s("forbidden")}></sw-state-panel></sw-page>`;if(this.error)return a`<sw-page heading=${s("title")}><sw-state-panel state="error" heading=${s("loadError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.data)return a`<sw-page heading=${s("title")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=this.data.notices,e=B(t),r=this.data.defaults.show_places_tree!==!1&&this.manager&&this.floors.length?U(t.filter(n=>M(n,"all","all","",!0)),this.floors,this.areas):[],o=r.some(n=>n.id===this.place)?this.place:x,p=K(t,{kpi:this.kpi,seg:this.seg,q:this.q,manager:this.manager,place:o,floors:this.floors,areas:this.areas}),u=this.manager?s("subtitleMgr",{n:e.all,s:e.scheduled,d:e.drafts}):s("subtitle",{n:e.all});return a`
      <sw-page heading="" data-notices-page>
        <div class="top"><div><h1>${s("title")}</h1><p class="sub">${u}</p></div><span class="sp"></span>
          <div class="meta">${this.manager?a`<sw-button variant="primary" icon="plus" data-compose @click=${()=>this.compose()}>${s("newNotice")}</sw-button>`:l}</div></div>
        ${t.length?a`
            ${this.kpis(e)}
            <div class=${r.length?"with-tree":""}>
            ${r.length?a`<notice-places .nodes=${r} .value=${o} @place-change=${n=>this.place=n.detail}></notice-places>`:l}
            <div class="panel flush main">
              ${r.length?nt(r,o,n=>this.place=n):l}
              <div class="toolbar">
                ${this.manager?a`<div class="seg" role="group" aria-label=${s("colBoards")}>${["all","mine","tv"].map(n=>a`<button type="button" aria-pressed=${String(this.seg===n)} @click=${()=>this.seg=n}>${s(n==="all"?"segAll":n==="mine"?"segMine":"segTv")}</button>`)}</div>`:l}
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
      ${this.toast?a`<div class="toast" role="status" ${H()}>${this.toast}</div>`:l}`}kpis(t){const e=this.manager?[{k:"all",look:"acc",label:s("kpiActive")},{k:"urgent",look:"alarm",label:s("kpiUrgent")},{k:"scheduled",look:"acc",label:s("kpiScheduled")},{k:"expired",look:"off",label:s("kpiExpired")},{k:"drafts",look:"unk",label:s("kpiDrafts")}]:[{k:"all",look:"acc",label:s("kpiActive")},{k:"urgent",look:"alarm",label:s("kpiUrgent")},{k:"unread",look:"acc",label:s("kpiUnread")}];return a`<div class="kpis" role="group" data-kpis>${e.map(i=>a`<button type="button" class="kpi" data-k=${i.k} data-look=${i.look} aria-pressed=${String(this.kpi===i.k)}
      @click=${()=>this.kpi=this.kpi===i.k&&i.k!=="all"?"all":i.k}><span class="dot" aria-hidden="true"></span><div><b class="num">${t[i.k]}</b><span class="l">${i.label}</span></div></button>`)}</div>`}boardNames(t){return t.boards.map(e=>this.boards.find(i=>i.id===e)?.name??"").filter(Boolean)}look(t){return t.state==="draft"?"unk":t.state==="expired"||t.state==="archived"?"off":I[t.severity]}badge(t){const e=t.state==="active"?t.severity==="info"?s("stActive"):s(V[t.severity]):s(W[t.state]);return a`<span class="badge" data-look=${this.look(t)}>${t.severity==="critical"&&t.state==="active"?a`<sw-icon name="warning" size="12"></sw-icon>`:l}${e}</span>`}table(t){const e=Object.fromEntries(this.floors.map(i=>[i.id,i.name]));return a`<table class="t"><thead><tr><th>${s("colState")}</th><th>${s("colNotice")}</th>${this.manager?a`<th>${s("colAudience")}</th><th>${s("colBoards")}</th>`:l}
      <th>${s("colWindow")}</th>${this.manager?a`<th>${s("colReads")}</th><th></th>`:l}</tr></thead><tbody>
 ${t.length?l:a`<tr data-no-rows><td colspan=${this.manager?7:3}><span class="mut">${s("noRows")}</span> <button type="button" class="pick" data-clear-filters @click=${()=>this.clearFilters()}>${s("clearFilters")}</button></td></tr>`}
      ${t.map(i=>a`<tr class="go" tabindex="0" data-notice=${i.id} data-look=${this.look(i)} @click=${()=>this.open(i)} @keydown=${r=>this.rowKey(r,i)}>
        <td>${this.badge(i)}</td>
        <td><span class="t1">${i.title}${i.read===!1&&i.state==="active"&&!this.manager?a`${this.unreadDot()}`:l}</span><span class="t2">${i.body.split(`
`)[0]}</span></td>
        ${this.manager?a`<td><span class="chips">${Y(i.audience,e).map(r=>a`<span class="chip">${r}</span>`)}</span></td>
          <td>${this.boardNames(i).length?a`<span class="chips">${this.boardNames(i).map(r=>a`<span class="chip">${r}</span>`)}</span>`:a`<span class="mut">-</span>`}</td>`:l}
        <td class="num mut">${O(i)}</td>
        ${this.manager?a`<td class="num mut">${this.readsButton(i)}</td><td class="act" @click=${r=>r.stopPropagation()}>${this.actions(i)}</td>`:l}
      </tr>`)}
      </tbody></table>`}card(t){return a`<div class="card go" tabindex="0" data-look=${this.look(t)} @click=${()=>this.open(t)} @keydown=${e=>this.rowKey(e,t)}>
      <div class="row">${this.badge(t)}<span class="mut num">${O(t)}</span></div>
      <span class="t1">${t.title}${t.read===!1&&t.state==="active"&&!this.manager?this.unreadDot():l}</span><span class="t2">${t.body.split(`
`)[0]}</span>
      ${this.manager?a`<div class="row" @click=${e=>e.stopPropagation()}>${this.readsButton(t)}${this.actions(t)}</div>`:l}</div>`}unreadDot(){return a`<span class="new" role="img" aria-label=${s("widgetNew")}></span>`}rowKey(t,e){t.target!==t.currentTarget||t.key!=="Enter"&&t.key!==" "||(t.preventDefault(),this.open(e))}readsButton(t){return t.state==="draft"?"-":a`<button type="button" class="pick" data-reads=${t.id} aria-label=${s("readsOf",{title:t.title})} @click=${e=>{e.stopPropagation(),this.readsFor=t}}>${t.reads??0}</button>`}actions(t){const e=this.manager&&ut(t,this.data?.can.delete??!1)?a`<sw-button size="sm" variant="ghost" data-delete @click=${()=>this.askDelete(t.id)}>${s("delete")}</sw-button>`:l;return t.state==="archived"?e:a`${t.state!=="expired"?a`<sw-button size="sm" variant=${t.state==="draft"?"primary":"secondary"} @click=${()=>this.open(t)}>${s(t.state==="draft"?"continueEdit":"edit")}</sw-button>`:l}
      ${st(t,this.data?.can.push??!1)?a`<sw-button size="sm" data-resend @click=${()=>this.askResend(t)}>${s("resend")}</sw-button>`:l}
      ${t.state!=="draft"?a`<sw-button size="sm" data-archive @click=${()=>this.archive(t)}>${s("archive")}</sw-button>`:l}${e}`}askResend(t){this.resending={n:t,count:null,busy:!1},G(t.audience??{}).then(e=>{this.resending?.n.id===t.id&&(this.resending={...this.resending,count:e.users})}).catch(()=>{})}async resend(){const t=this.resending;if(!(!t||t.busy)){this.resending={...t,busy:!0};try{const e=at((await X(t.n.id)).push);this.resending=null,this.say(s(e.key,{n:e.n})),await this.load()}catch(e){this.resending=null,this.say(b(e))}}}resendDialog(){const t=this.resending;return a`<sw-dialog ?open=${!!t} heading=${t?s("resendAsk",{title:t.n.title}):""} @close=${()=>this.resending=null} data-resend-confirm>
      ${t?a`<p>${t.count!==null?s("resendBody",{n:t.count}):s("resendBodyNoCount")}</p>`:l}
      <sw-button slot="footer" @click=${()=>this.resending=null}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" ?disabled=${t?.busy??!1} data-resend-go @click=${()=>this.resend()}>${s("resend")}</sw-button></sw-dialog>`}askDelete(t){const e=this.data?.notices.find(i=>i.id===t);e&&(this.draft=null,this.deleting={id:e.id,title:e.title,state:e.state,severity:e.severity})}clearFilters(){this.kpi="all",this.seg="all",this.q="",this.place=x}async deleted(){this.deleting=null,this.draft=null,this.say(s("delDone")),await this.load()}open(t){if(this.manager){this.compose(t);return}this.reading=t,t.read===!1&&J(t.id).then(()=>{this.data&&(this.data={...this.data,notices:this.data.notices.map(e=>e.id===t.id?{...e,read:!0}:e)})}).catch(()=>{})}async archive(t){try{await Q(t.id),this.say(s("archived")),await this.load()}catch(e){this.say(b(e))}}readDialog(){const t=this.reading;return a`<sw-dialog ?open=${!!t} heading=${t?.title??""} subheading=${t?O(t):""} @close=${()=>this.reading=null}>
      ${t?a`<p>${t.body.split(`
`).map(e=>a`${e}<br>`)}</p>`:l}
      <sw-button slot="footer" variant="primary" @click=${()=>this.reading=null}>${s("close")}</sw-button></sw-dialog>`}compose(t){const e=this.data?.defaults??{default_days:7,default_severity:"info"};this.draft=t?Z(t):tt(new Date,e.default_days,e.default_severity)}async saved(t){this.draft=null,this.say(t.detail.message),await this.load()}composeDialog(){return a`<notice-compose .draft=${this.draft} .canDelete=${this.data?.can.delete??!1} .canPush=${this.data?.can.push??!1} .pushDefault=${this.data?.defaults.push_default??"by_severity"} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${()=>this.draft=null} @notice-delete=${t=>this.askDelete(t.detail.id)} @notice-saved=${t=>this.saved(t)}></notice-compose>`}};c.styles=[C,ot,vt,et];h([d()],c.prototype,"data",2);h([d()],c.prototype,"manager",2);h([d()],c.prototype,"error",2);h([d()],c.prototype,"off",2);h([d()],c.prototype,"forbidden",2);h([d()],c.prototype,"kpi",2);h([d()],c.prototype,"seg",2);h([d()],c.prototype,"q",2);h([d()],c.prototype,"boards",2);h([d()],c.prototype,"floors",2);h([d()],c.prototype,"groups",2);h([d()],c.prototype,"roles",2);h([d()],c.prototype,"areas",2);h([d()],c.prototype,"place",2);h([d()],c.prototype,"readsFor",2);h([d()],c.prototype,"draft",2);h([d()],c.prototype,"deleting",2);h([d()],c.prototype,"resending",2);h([d()],c.prototype,"reading",2);h([d()],c.prototype,"toast",2);c=h([z("devices-notices")],c);export{c as DevicesNotices};
//# sourceMappingURL=devices-notices-DKK128Sr.js.map
