import{qK as s,e as i,E as b,F as D,G as d,a as P,rG as y,rH as A,A as n,H as z,rI as L,R as _,rD as R,j as x,r3 as S,r1 as q,r4 as F,rh as j,rJ as K,rK as B,rL as M,rM as U,rp as H,rq as I,rN as G,rO as V,rr as E,rP as W,rE as Y,r7 as J,r6 as Q}from"./index-CcnB1Mea.js";import"./compose-dialog-CPVZM0ni.js";import{n as C}from"./styles-1NOaMTe2.js";import"./sw-logo-art-Va6y_cIM.js";var X=Object.defineProperty,Z=Object.getOwnPropertyDescriptor,O=(t,e,a,r)=>{for(var o=r>1?void 0:r?Z(e,a):e,c=t.length-1,u;c>=0;c--)(u=t[c])&&(o=(r?u(e,a,o):u(o))||o);return r&&o&&X(e,a,o),o};const tt=b`
  .with-tree { display: grid; grid-template-columns: 232px minmax(0, 1fr); gap: 14px; align-items: start; }
  .with-tree > .main { min-inline-size: 0; }
  .tree-m { display: none; }
  @media (max-width: 767px) {
    .with-tree { grid-template-columns: minmax(0, 1fr); }
    .with-tree > notice-places { display: none; }
    .tree-m { display: block; padding: 10px 10px 0; }
    .tree-m select { inline-size: 100%; font: inherit; color: var(--sw-text); background: var(--sw-surface-solid); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); padding: 8px 10px; min-block-size: 44px; }
  }
`;function et(t,e,a){return i`<div class="tree-m"><select aria-label=${s("placeSelect")} data-place-select @change=${r=>a(r.target.value)}>
    ${t.map(r=>i`<option value=${r.id} ?selected=${r.id===e}>${r.depth?"- ".repeat(r.depth):""}${r.name} (${r.count})</option>`)}</select></div>`}let g=class extends P{constructor(){super(...arguments),this.nodes=[],this.value=y,this.folded=new Set}toggle(t){const e=new Set(this.folded);e.delete(t)||e.add(t),this.folded=e}pick(t){this.dispatchEvent(new CustomEvent("place-change",{detail:t,bubbles:!0,composed:!0}))}render(){return i`<div class="box"><nav aria-label=${s("places")} data-places>
      <div class="ttl">${s("places")}</div>
      ${A(this.nodes,this.folded).map(t=>i`<div class="line ${t.foldable?"grp":""}" data-place-line=${t.id}>
        ${t.foldable?i`<button type="button" class="fold" aria-expanded=${String(!this.folded.has(t.id))} aria-label=${s(this.folded.has(t.id)?"unfoldPlace":"foldPlace",{name:t.name})}
          data-place-fold=${t.id} @click=${()=>this.toggle(t.id)}><sw-icon name="chevronDown" size="14"></sw-icon></button>`:n}
        <button type="button" class="pick d${t.depth}" aria-current=${String(this.value===t.id)} data-place=${t.id} @click=${()=>this.pick(t.id)}>
          ${t.kind==="all"?i`<sw-icon name="building" size="14"></sw-icon>`:t.look?i`<span class="dot" data-look=${t.look} aria-hidden="true"></span>`:n}
          <span class="name">${t.name}</span><span class="n">${t.count}</span></button></div>`)}
    </nav></div>`}};g.styles=b`
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
  `;O([D({attribute:!1})],g.prototype,"nodes",2);O([D()],g.prototype,"value",2);O([d()],g.prototype,"folded",2);g=O([z("notice-places")],g);const k=t=>("0"+t).slice(-2);function st(t){const e=new Date(t);return Number.isNaN(e.getTime())?"":`${k(e.getDate())}.${k(e.getMonth()+1)} ${k(e.getHours())}:${k(e.getMinutes())}`}function at(t){const e=Array.isArray(t.users)&&Array.isArray(t.unread),a=e?t.users.length:t.read,r=e?t.users.length+t.unread.length:t.audience,o=(l,m)=>l.name.localeCompare(m.name,"he"),c=(t.users??[]).map(l=>({name:l.name,place:l.place??"",at:l.read_at}));c.sort((l,m)=>Date.parse(m.at)-Date.parse(l.at)||o(l,m));const u=(t.unread??[]).map(l=>({name:l.name,place:l.place??"",at:""})).sort(o);return{read:a,unread:Math.max(0,r-a),total:r,pct:r>0?Math.round(a*100/r):0,named:e,rows:{read:c,unread:u}}}var it=Object.defineProperty,rt=Object.getOwnPropertyDescriptor,w=(t,e,a,r)=>{for(var o=r>1?void 0:r?rt(e,a):e,c=t.length-1,u;c>=0;c--)(u=t[c])&&(o=(r?u(e,a,o):u(o))||o);return r&&o&&it(e,a,o),o};let v=class extends P{constructor(){super(...arguments),this.notice=null,this.data=null,this.error="",this.seg="read",this.seq=0}willUpdate(t){t.has("notice")&&this.load()}async load(){const t=this.notice,e=++this.seq;if(this.data=null,this.error="",this.seg="read",!!t)try{const a=await L(t.id);e===this.seq&&(this.data=a)}catch(a){e===this.seq&&(this.error=_(a))}}close(){this.dispatchEvent(new CustomEvent("reads-close",{bubbles:!0,composed:!0}))}body(){if(this.error)return i`<sw-state-panel compact state="error" heading=${s("readsLoadError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return i`<sw-state-panel compact state="loading"></sw-state-panel>`;const t=at(this.data),e=t.rows[this.seg];return i`<div class="body-grid" data-reads-body>
      <div class="reads"><div class="kpis" data-reads-kpis>
        <div class="kpi" data-look="ok"><span class="dot"></span><div><b class="num" data-reads-read>${t.read}</b><span class="l">${s("segReadShort")}</span></div></div>
        <div class="kpi" data-look="off"><span class="dot"></span><div><b class="num" data-reads-unread>${t.unread}</b><span class="l">${s("segUnreadShort")}</span></div></div>
        <div class="kpi" data-look="acc"><span class="dot"></span><div><b class="num" data-reads-total>${t.total}</b><span class="l">${s("recipients")}</span></div></div></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${t.pct} aria-label=${s("readSheet")}><i style=${`inline-size:${t.pct}%`}></i></div></div>
      ${t.named?i`
        <div class="seg" role="group" aria-label=${s("readsList")} data-reads-seg>
          <button aria-pressed=${String(this.seg==="read")} data-seg="read" @click=${()=>this.seg="read"}>${s("readN",{n:t.read})}</button>
          <button aria-pressed=${String(this.seg==="unread")} data-seg="unread" @click=${()=>this.seg="unread"}>${s("unreadN",{n:t.unread})}</button></div>
        ${e.length?i`<div class="list"><table class="t" data-reads-table><thead><tr><th>${s("colName")}</th><th>${s("colPlace")}</th>${this.seg==="read"?i`<th>${s("colReadAt")}</th>`:n}</tr></thead><tbody>
              ${e.map(a=>i`<tr data-reads-row><td><span class="t1">${a.name}</span></td><td class="mut" data-reads-place>${a.place||s("allPlaces")}</td>${this.seg==="read"?i`<td class="date num">${st(a.at)}</td>`:n}</tr>`)}
            </tbody></table></div>`:i`<p class="mut" data-reads-none>${s("readsNone")}</p>`}`:n}
    </div>`}render(){const t=this.notice;return i`<sw-dialog ?open=${!!t} heading=${s("readSheet")} subheading=${t?.title??""} @close=${()=>this.close()}>
      ${t?this.body():n}
      <sw-button slot="footer" variant="primary" @click=${()=>this.close()}>${s("close")}</sw-button></sw-dialog>`}};v.styles=[C,b`
    .reads { display: grid; gap: 8px; }
    .reads .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; }
    .reads .kpi { cursor: default; }
    .bar { block-size: 8px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3, var(--sw-surface-2)); overflow: hidden; }
    .bar i { display: block; block-size: 100%; background: var(--sw-success); border-radius: inherit; }
    .body-grid { display: grid; gap: 12px; }
    .list { max-block-size: 280px; overflow: auto; }
    .date { white-space: nowrap; }
    @media (max-width: 767px) { .reads .kpi { padding: 8px 10px; } }
  `];w([D({attribute:!1})],v.prototype,"notice",2);w([d()],v.prototype,"data",2);w([d()],v.prototype,"error",2);w([d()],v.prototype,"seg",2);v=w([z("notice-reads")],v);const N=t=>t.state==="active",ot=t=>t.state==="active"&&t.severity==="critical",T=(t,e,a)=>!!t&&!a&&(!N(t)||e);function lt(t,e){return t.state==="draft"||t.status==="draft"?!0:e}var nt=Object.defineProperty,dt=Object.getOwnPropertyDescriptor,$=(t,e,a,r)=>{for(var o=r>1?void 0:r?dt(e,a):e,c=t.length-1,u;c>=0;c--)(u=t[c])&&(o=(r?u(e,a,o):u(o))||o);return r&&o&&nt(e,a,o),o};let f=class extends P{constructor(){super(...arguments),this.notice=null,this.ticked=!1,this.busy=!1,this.err=""}willUpdate(t){t.has("notice")&&(this.ticked=!1,this.busy=!1,this.err="")}close(){this.dispatchEvent(new CustomEvent("notice-delete-close",{bubbles:!0,composed:!0}))}async confirm(){const t=this.notice;if(!(!t||!T(t,this.ticked,this.busy))){this.busy=!0,this.err="";try{await R(t.id,N(t)),this.dispatchEvent(new CustomEvent("notice-deleted",{detail:{id:t.id},bubbles:!0,composed:!0}))}catch(e){this.err=e instanceof x&&e.status===403&&e.code==="emergency_notice"?s("delRefused"):_(e)}finally{this.busy=!1}}}render(){const t=this.notice;return t?i`<sw-dialog open data-delete-dialog heading=${s("delTitle")} @close=${()=>this.close()}>
      <p data-delete-line>${s("delBody",{title:t.title})}</p>
      ${N(t)?i`<label class="ck"><input type="checkbox" data-delete-live .checked=${this.ticked} @change=${e=>this.ticked=e.target.checked}>${s(ot(t)?"delUrgentTick":"delLiveTick")}</label>`:n}
      ${this.err?i`<p class="err" role="alert" data-delete-error>${this.err}</p>`:n}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-delete-confirm ?disabled=${!T(t,this.ticked,this.busy)} @click=${()=>this.confirm()}>${s("delConfirm")}</sw-button>
    </sw-dialog>`:i`<sw-dialog></sw-dialog>`}};f.styles=b`
    p { margin: 0 0 var(--sw-s-3, 12px); color: var(--sw-text); }
    .ck { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); margin: 8px 0 0; }
  `;$([D({attribute:!1})],f.prototype,"notice",2);$([d()],f.prototype,"ticked",2);$([d()],f.prototype,"busy",2);$([d()],f.prototype,"err",2);f=$([z("notice-delete")],f);const ct=b`
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
`;var pt=Object.defineProperty,ht=Object.getOwnPropertyDescriptor,h=(t,e,a,r)=>{for(var o=r>1?void 0:r?ht(e,a):e,c=t.length-1,u;c>=0;c--)(u=t[c])&&(o=(r?u(e,a,o):u(o))||o);return r&&o&&pt(e,a,o),o};let p=class extends P{constructor(){super(...arguments),this.data=null,this.manager=!1,this.error="",this.off=!1,this.forbidden=!1,this.kpi="all",this.seg="all",this.q="",this.boards=[],this.floors=[],this.groups=[],this.roles=[],this.areas=[],this.place=y,this.readsFor=null,this.draft=null,this.deleting=null,this.reading=null,this.toast="",this.toastTimer=0}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{let t;try{t=await S("all"),this.manager=!0}catch(e){if(e instanceof x&&e.status===403)t=await S("mine"),this.manager=!1;else throw e}this.data=t,this.off=!1,this.forbidden=!1,this.manager&&!this.boards.length&&this.loadOptions()}catch(t){t instanceof x&&t.status===404?this.off=!0:t instanceof x&&t.status===403?this.forbidden=!0:this.error=_(t)}}async loadOptions(){try{const[t,e]=await Promise.all([q(),F()]);this.boards=t.boards,this.floors=e.floors,this.areas=e.areas??[],this.groups=e.groups,this.roles=e.roles}catch{}}say(t){this.toast=t,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}render(){if(this.off)return i`<sw-page heading=${s("title")}><sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${s("off")} hint=${s("offHint")}
        actionLabel=${s("toSettings")} @action=${()=>location.hash=j}></sw-state-panel></sw-page>`;if(this.forbidden)return i`<sw-page heading=${s("title")}><sw-state-panel state="forbidden" heading=${s("forbidden")}></sw-state-panel></sw-page>`;if(this.error)return i`<sw-page heading=${s("title")}><sw-state-panel state="error" heading=${s("loadError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.data)return i`<sw-page heading=${s("title")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=this.data.notices,e=K(t),r=this.data.defaults.show_places_tree!==!1&&this.manager&&this.floors.length?B(t.filter(l=>M(l,"all","all","",!0)),this.floors,this.areas):[],o=r.some(l=>l.id===this.place)?this.place:y,c=U(t,{kpi:this.kpi,seg:this.seg,q:this.q,manager:this.manager,place:o,floors:this.floors,areas:this.areas}),u=this.manager?s("subtitleMgr",{n:e.all,s:e.scheduled,d:e.drafts}):s("subtitle",{n:e.all});return i`
      <sw-page heading="" data-notices-page>
        <div class="top"><div><h1>${s("title")}</h1><p class="sub">${u}</p></div><span class="sp"></span>
          <div class="meta">${this.manager?i`<sw-button variant="primary" icon="plus" data-compose @click=${()=>this.compose()}>${s("newNotice")}</sw-button>`:n}</div></div>
        ${t.length?i`
            ${this.kpis(e)}
            <div class=${r.length?"with-tree":""}>
            ${r.length?i`<notice-places .nodes=${r} .value=${o} @place-change=${l=>this.place=l.detail}></notice-places>`:n}
            <div class="panel flush main">
              ${r.length?et(r,o,l=>this.place=l):n}
              <div class="toolbar">
                ${this.manager?i`<div class="seg" role="group" aria-label=${s("colBoards")}>${["all","mine","tv"].map(l=>i`<button type="button" aria-pressed=${String(this.seg===l)} @click=${()=>this.seg=l}>${s(l==="all"?"segAll":l==="mine"?"segMine":"segTv")}</button>`)}</div>`:n}
                <span class="sp"></span>
                <label class="search"><sw-icon name="search" size="14" aria-hidden="true"></sw-icon><input type="search" placeholder=${s("search")} aria-label=${s("search")} .value=${this.q} @input=${l=>this.q=l.target.value}></label>
              </div>
              <div class="scrollx">${this.table(c)}</div>
              <div class="cards">${c.length?c.map(l=>this.card(l)):i`<div class="card" data-no-rows><span class="mut">${s("noRows")}</span> <button type="button" class="pick" data-clear-filters @click=${()=>this.clearFilters()}>${s("clearFilters")}</button></div>`}</div>
            </div></div>`:i`<sw-state-panel icon="inbox" state="empty" heading=${s("emptyTitle")} hint=${this.manager?s("emptyManager"):s("emptyReader")}
              actionLabel=${this.manager?s("firstNotice"):""} @action=${()=>this.compose()}></sw-state-panel>`}
      </sw-page>
      ${this.composeDialog()} ${this.readDialog()}
      <notice-delete .notice=${this.deleting} @notice-delete-close=${()=>this.deleting=null} @notice-deleted=${()=>this.deleted()}></notice-delete>
      <notice-reads .notice=${this.readsFor} @reads-close=${()=>this.readsFor=null}></notice-reads>
      ${this.toast?i`<div class="toast" role="status">${this.toast}</div>`:n}`}kpis(t){const e=this.manager?[{k:"all",look:"acc",label:s("kpiActive")},{k:"urgent",look:"alarm",label:s("kpiUrgent")},{k:"scheduled",look:"acc",label:s("kpiScheduled")},{k:"expired",look:"off",label:s("kpiExpired")},{k:"drafts",look:"unk",label:s("kpiDrafts")}]:[{k:"all",look:"acc",label:s("kpiActive")},{k:"urgent",look:"alarm",label:s("kpiUrgent")},{k:"unread",look:"acc",label:s("kpiUnread")}];return i`<div class="kpis" role="group" data-kpis>${e.map(a=>i`<button type="button" class="kpi" data-k=${a.k} data-look=${a.look} aria-pressed=${String(this.kpi===a.k)}
      @click=${()=>this.kpi=this.kpi===a.k&&a.k!=="all"?"all":a.k}><span class="dot" aria-hidden="true"></span><div><b class="num">${t[a.k]}</b><span class="l">${a.label}</span></div></button>`)}</div>`}boardNames(t){return t.boards.map(e=>this.boards.find(a=>a.id===e)?.name??"").filter(Boolean)}look(t){return t.state==="draft"?"unk":t.state==="expired"||t.state==="archived"?"off":H[t.severity]}badge(t){const e=t.state==="active"?t.severity==="info"?s("stActive"):s(I[t.severity]):s(G[t.state]);return i`<span class="badge" data-look=${this.look(t)}>${t.severity==="critical"&&t.state==="active"?i`<sw-icon name="warning" size="12"></sw-icon>`:n}${e}</span>`}table(t){const e=Object.fromEntries(this.floors.map(a=>[a.id,a.name]));return i`<table class="t"><thead><tr><th>${s("colState")}</th><th>${s("colNotice")}</th>${this.manager?i`<th>${s("colAudience")}</th><th>${s("colBoards")}</th>`:n}
      <th>${s("colWindow")}</th>${this.manager?i`<th>${s("colReads")}</th><th></th>`:n}</tr></thead><tbody>
 ${t.length?n:i`<tr data-no-rows><td colspan=${this.manager?7:3}><span class="mut">${s("noRows")}</span> <button type="button" class="pick" data-clear-filters @click=${()=>this.clearFilters()}>${s("clearFilters")}</button></td></tr>`}
      ${t.map(a=>i`<tr class="go" tabindex="0" data-notice=${a.id} data-look=${this.look(a)} @click=${()=>this.open(a)} @keydown=${r=>this.rowKey(r,a)}>
        <td>${this.badge(a)}</td>
        <td><span class="t1">${a.title}${a.read===!1&&a.state==="active"&&!this.manager?i`${this.unreadDot()}`:n}</span><span class="t2">${a.body.split(`
`)[0]}</span></td>
        ${this.manager?i`<td><span class="chips">${V(a.audience,e).map(r=>i`<span class="chip">${r}</span>`)}</span></td>
          <td>${this.boardNames(a).length?i`<span class="chips">${this.boardNames(a).map(r=>i`<span class="chip">${r}</span>`)}</span>`:i`<span class="mut">-</span>`}</td>`:n}
        <td class="num mut">${E(a)}</td>
        ${this.manager?i`<td class="num mut">${this.readsButton(a)}</td><td class="act" @click=${r=>r.stopPropagation()}>${this.actions(a)}</td>`:n}
      </tr>`)}
      </tbody></table>`}card(t){return i`<div class="card go" tabindex="0" data-look=${this.look(t)} @click=${()=>this.open(t)} @keydown=${e=>this.rowKey(e,t)}>
      <div class="row">${this.badge(t)}<span class="mut num">${E(t)}</span></div>
      <span class="t1">${t.title}${t.read===!1&&t.state==="active"&&!this.manager?this.unreadDot():n}</span><span class="t2">${t.body.split(`
`)[0]}</span>
      ${this.manager?i`<div class="row" @click=${e=>e.stopPropagation()}>${this.readsButton(t)}${this.actions(t)}</div>`:n}</div>`}unreadDot(){return i`<span class="new" role="img" aria-label=${s("widgetNew")}></span>`}rowKey(t,e){t.target!==t.currentTarget||t.key!=="Enter"&&t.key!==" "||(t.preventDefault(),this.open(e))}readsButton(t){return t.state==="draft"?"-":i`<button type="button" class="pick" data-reads=${t.id} aria-label=${s("readsOf",{title:t.title})} @click=${e=>{e.stopPropagation(),this.readsFor=t}}>${t.reads??0}</button>`}actions(t){const e=this.manager&&lt(t,this.data?.can.delete??!1)?i`<sw-button size="sm" variant="ghost" data-delete @click=${()=>this.askDelete(t.id)}>${s("delete")}</sw-button>`:n;return t.state==="archived"?e:i`${t.state!=="expired"?i`<sw-button size="sm" variant=${t.state==="draft"?"primary":"secondary"} @click=${()=>this.open(t)}>${s(t.state==="draft"?"continueEdit":"edit")}</sw-button>`:n}
      ${t.state!=="draft"?i`<sw-button size="sm" data-archive @click=${()=>this.archive(t)}>${s("archive")}</sw-button>`:n}${e}`}askDelete(t){const e=this.data?.notices.find(a=>a.id===t);e&&(this.draft=null,this.deleting={id:e.id,title:e.title,state:e.state,severity:e.severity})}clearFilters(){this.kpi="all",this.seg="all",this.q="",this.place=y}async deleted(){this.deleting=null,this.draft=null,this.say(s("delDone")),await this.load()}open(t){if(this.manager){this.compose(t);return}this.reading=t,t.read===!1&&W(t.id).then(()=>{this.data&&(this.data={...this.data,notices:this.data.notices.map(e=>e.id===t.id?{...e,read:!0}:e)})}).catch(()=>{})}async archive(t){try{await Y(t.id),this.say(s("archived")),await this.load()}catch(e){this.say(_(e))}}readDialog(){const t=this.reading;return i`<sw-dialog ?open=${!!t} heading=${t?.title??""} subheading=${t?E(t):""} @close=${()=>this.reading=null}>
      ${t?i`<p>${t.body.split(`
`).map(e=>i`${e}<br>`)}</p>`:n}
      <sw-button slot="footer" variant="primary" @click=${()=>this.reading=null}>${s("close")}</sw-button></sw-dialog>`}compose(t){const e=this.data?.defaults??{default_days:7,default_severity:"info"};this.draft=t?J(t):Q(new Date,e.default_days,e.default_severity)}async saved(t){this.draft=null,this.say(t.detail.message),await this.load()}composeDialog(){return i`<notice-compose .draft=${this.draft} .canDelete=${this.data?.can.delete??!1} .canPush=${this.data?.can.push??!1} .pushDefault=${this.data?.defaults.push_default??"by_severity"} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${()=>this.draft=null} @notice-delete=${t=>this.askDelete(t.detail.id)} @notice-saved=${t=>this.saved(t)}></notice-compose>`}};p.styles=[C,tt,ct];h([d()],p.prototype,"data",2);h([d()],p.prototype,"manager",2);h([d()],p.prototype,"error",2);h([d()],p.prototype,"off",2);h([d()],p.prototype,"forbidden",2);h([d()],p.prototype,"kpi",2);h([d()],p.prototype,"seg",2);h([d()],p.prototype,"q",2);h([d()],p.prototype,"boards",2);h([d()],p.prototype,"floors",2);h([d()],p.prototype,"groups",2);h([d()],p.prototype,"roles",2);h([d()],p.prototype,"areas",2);h([d()],p.prototype,"place",2);h([d()],p.prototype,"readsFor",2);h([d()],p.prototype,"draft",2);h([d()],p.prototype,"deleting",2);h([d()],p.prototype,"reading",2);h([d()],p.prototype,"toast",2);p=h([z("devices-notices")],p);export{p as DevicesNotices};
//# sourceMappingURL=devices-notices-BoRDjIhb.js.map
