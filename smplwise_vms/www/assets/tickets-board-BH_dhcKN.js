import{C as K,D as W,E as Q,F as M,G as m,a as V,S as Y,b as X,A as c,v as d,t as y,e as r,q as x,H as J,y as it,g$ as T,p as b,o as rt,f as B,s as nt,j as F,Y as ot,d as D,ct as lt,u as dt,o8 as ct,o3 as ht,oY as pt,r as ut}from"./index-Cx0qJkOE.js";import{N as _,P as N,d as gt,s as ft,e as O,g as mt,o as bt,f as wt,h as $t,l as vt,a as yt,k as kt,i as L,p as xt,j as St,m as Ct}from"./list-filter-row-CQk3CZHQ.js";import{c as Ht}from"./ticket-detail-D-f_NIpK.js";import{p as Z,n as Tt,c as G,b as k,d as I,e as Ot,s as Mt,g as _t,h as E,i as P}from"./board-model-1MGxcq9R.js";import"./tickets-handlers-DRilp8x3.js";import"./sw-pager-BafkMmYy.js";import{m as Pt,a as qt}from"./media-page-zRowab4i.js";import{L as zt,b as q,a as Bt}from"./tickets-board-C62BHESs.js";import{d as Ft}from"./drawer-model-BX_ObKqk.js";import{F as Dt,p as A,f as Nt,a as Lt,b as Gt,t as It}from"./list-toolbar-DBWBll8_.js";import{l as w}from"./list-text-DcuV1CFx.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-QbFkJ1fQ.js";import"./geometry-CziiQPlI.js";import"./tickets-phone-verify-CIEW6EzC.js";import"./identity-card-Cz1CyEu7.js";import"./access-grants-BaUoerMD.js";import"./access-people-DgCu1ul3.js";import"./wiskey-format-DJ4vUeXA.js";import"./recordings-B76S5ya9.js";import"./settings-styles-CmswnmUh.js";import"./handler-load-BXHEF_X6.js";import"./settings-tabs-CcQjb9O6.js";var Et=Object.defineProperty,At=Object.getOwnPropertyDescriptor,H=(t,e,s,i)=>{for(var a=i>1?void 0:i?At(e,s):e,l=t.length-1,o;l>=0;l--)(o=t[l])&&(a=(i?o(e,s,a):o(a))||a);return i&&a&&Et(e,s,a),a};let S=class extends V{constructor(){super(...arguments),this.bubbleSkin=new Y(this),this.nodes=[],this.selected="",this.total=0,this.closed=new Set}connectedCallback(){super.connectedCallback(),X(this)}pick(t){this.dispatchEvent(new CustomEvent("place-pick",{detail:{key:t},bubbles:!0,composed:!0}))}toggle(t){const e=new Set(this.closed);e.has(t)?e.delete(t):e.add(t),this.closed=e}branch(t,e){const s=t.node,i=!this.closed.has(s.key),a=t.children.length>0,l=Z(s);return r`<div role="treeitem" aria-level=${e+1} aria-expanded=${a?String(i):c} aria-selected=${String(this.selected===s.key)}>
      <div class=${`row l${Math.min(e,2)}`} role="button" tabindex="0" aria-pressed=${String(this.selected===s.key)} data-place=${s.key}
        @click=${()=>this.pick(s.key)} @keydown=${o=>{(o.key==="Enter"||o.key===" ")&&(o.preventDefault(),this.pick(s.key))}}>
        ${a?r`<button type="button" class="tw" aria-expanded=${String(i)} aria-label=${d(i?"collapse":"expand",{name:l})} data-twist=${s.key}
          @click=${o=>{o.stopPropagation(),this.toggle(s.key)}}>${y("chevronDown")}</button>`:r`<span></span>`}
        <span class="nm">${e===0?r`<b>${x(l)}</b>`:x(l)}</span>
        <span class="n">${s.count}</span>
      </div>
      ${a&&i?r`<div role="group">${t.children.map(o=>this.branch(o,e+1))}</div>`:c}
    </div>`}render(){const t=Tt(this.nodes);return r`<nav class="tree glass" aria-label=${d("floors")} data-board-tree>
      <div role="tree" aria-label=${d("floors")}>
        <div class="row l0" role="button" tabindex="0" aria-pressed=${String(!this.selected)} data-place=""
          @click=${()=>this.pick("")} @keydown=${e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.pick(""))}}>
          <span></span><span class="nm"><b>${d("allFloors")}</b></span><span class="n">${this.total}</span>
        </div>
        ${t.map(e=>this.branch(e,0))}
      </div>
    </nav>`}};S.styles=[K,...W,Q`
    :host { display: block; }
    .tree {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px;
      border-radius: var(--sw-r-2xl);
      box-sizing: border-box;
    }
    .row {
      all: unset;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      padding-inline: 8px 12px;
      border-radius: var(--sw-r-lg);
      cursor: pointer;
      color: var(--dv-text);
      font-size: var(--sw-fs-base);
    }
    .row:hover { background: var(--dv-hover, color-mix(in srgb, var(--dv-text) 6%, transparent)); }
    .row[aria-pressed='true'] { background: var(--dv-accent-soft); color: var(--dv-accent-text); font-weight: 700; }
    .row:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 1px; }
    .row.l0 b { font-weight: 700; }
    .row.l1 { padding-inline-start: 28px; color: var(--dv-text-2); }
    .row.l2 { padding-inline-start: 48px; color: var(--dv-text-2); }
    .row .n { font-variant-numeric: tabular-nums; color: var(--dv-accent-text); font-size: var(--sw-fs-sm); font-weight: 600; }
    .row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tw {
      all: unset;
      display: inline-grid;
      place-items: center;
      inline-size: 24px;
      block-size: 24px;
      border-radius: var(--sw-r-sm);
      color: var(--dv-text-3);
      cursor: pointer;
    }
    .tw:focus-visible { outline: 2px solid var(--dv-focus); }
    .tw .ic { font-size: var(--sw-fs-lg); transition: transform var(--mm-motion, 160ms) ease; }
    .tw[aria-expanded='false'] .ic { transform: rotate(90deg); }
    :host-context([dir='ltr']) .tw[aria-expanded='false'] .ic { transform: rotate(-90deg); }
  `];H([M({attribute:!1})],S.prototype,"nodes",2);H([M()],S.prototype,"selected",2);H([M({type:Number})],S.prototype,"total",2);H([m()],S.prototype,"closed",2);S=H([J("ticket-board-tree")],S);const Rt=2,jt=["closed","cancelled"],R=t=>String(t).padStart(2,"0"),j=t=>`${R(t.getHours())}:${R(t.getMinutes())}`,U=(t,e)=>t.getFullYear()===e.getFullYear()&&t.getMonth()===e.getMonth()&&t.getDate()===e.getDate();function Ut(t,e,s){const i=t.filter(n=>!jt.includes(n.status)),a=[],l=i.filter(n=>n.eta_at&&n.assignee).map(n=>({x:n,at:new Date(n.eta_at)})).filter(({at:n})=>!Number.isNaN(n.getTime())&&U(n,s)&&n.getTime()>=s.getTime()).sort((n,u)=>n.at.getTime()-u.at.getTime()).slice(0,Rt);for(const{x:n,at:u}of l)a.push({kind:"visit",time:j(u),label:`${w("bdVisit")} · ${n.assignee?.name??""}`,what:n.place_text||n.device_name,tone:"info",id:n.id});const o=i.filter(n=>n.sla_cell&&!n.sla_cell.over).map(n=>({x:n,at:new Date(n.sla_cell.at)})).filter(({at:n})=>!Number.isNaN(n.getTime())&&U(n,s)&&n.getTime()>=s.getTime()).sort((n,u)=>n.at.getTime()-u.at.getTime());if(o.length){const{x:n,at:u}=o[0];a.push({kind:"sla",time:j(u),label:w("bdSla"),what:`#${n.number} ${Ht(n.title,28)}`,tone:"warn",id:n.id})}return e.waiting>0&&a.push({kind:"waiting",time:"",label:w(e.waiting===1?"bdWaitingMineOne":"bdWaitingMine",{n:e.waiting}),what:"",tone:"ok",id:""}),a}const z=4;function Kt(t){return{on:Math.max(0,Math.min(z,t)),total:z,hot:t>=z}}var Wt=Object.defineProperty,Qt=Object.getOwnPropertyDescriptor,f=(t,e,s,i)=>{for(var a=i>1?void 0:i?Qt(e,s):e,l=t.length-1,o;l>=0;l--)(o=t[l])&&(a=(i?o(e,s,a):o(a))||a);return i&&a&&Wt(e,s,a),a};function v(t,e){if(!e){window.location.hash=t;return}const s=t.replace(/^#/,""),[i,a=""]=s.split("?");ut(i,new URLSearchParams(a))}let g=class extends V{constructor(){super(...arguments),this.bubbleSkin=new Y(this),this.route=null,this.r=G(new URLSearchParams),this.module=null,this.meta=null,this.data=null,this.screen="loading",this.failed="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.treeHidden=!1,this.filterOpen=!1,this.showClosed=!1,this.drawerUsed=!1,this.now=new Date,this.q="",this.toast=null,this.filters={..._},this.compactHeader=!1,this.panelCtl=new Dt(this,()=>this.filterOpen,t=>this.filterOpen=t),this.pendingQ=null,this.key="",this.seq=0,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.paged=window.matchMedia(N).matches,this.cardPage=1,this.fit=null,this.pagedMq=window.matchMedia(N),this.onPaged=()=>{this.paged=this.pagedMq.matches,this.fit=null,this.maxH={row:0,head:0,sub:0,cr:0},this.cardH.clear()},this.maxH={row:0,head:0,sub:0,cr:0},this.cardH=new Map,this.fitObserver=null,this.fitBox=null,this.pageCount=1,this.pageKey="",this.qTimer=0,this.live=new zt(()=>{this.now=new Date,this.screen==="ready"&&this.load(!0)}),this.toastTimer=0,this.offNames=null,this.onScroll=()=>{const t=this.scrollTop>40&&!this.filterOpen;t!==this.compactHeader&&(this.compactHeader=t)},this.pickMode=t=>{t!=="board"&&(gt(t==="calendar"),t!=="calendar"&&ft({view:t}),window.location.hash=it(pt()))},this.onCardAction=t=>{const{item:e,action:s}=t.detail;if(s==="open")v(this.hrefOf(e.id),!1);else if(s==="full")v(T(e.id),!1);else if(s==="copy"){const i=`${location.origin}${location.pathname}${location.search}${T(e.id)}`;navigator.clipboard?.writeText(i).then(()=>this.say(b("linkCopied"))).catch(()=>this.say(i))}},this.closeDrawer=()=>this.isConnected&&v(k(this.r),!1),this.onGone=t=>{if(this.closeDrawer(),t.detail?.deleted){this.say(Ft("deletedOne"));const e=t.detail.id;this.data&&(this.data={...this.data,items:this.data.items.filter(s=>s.id!==e),closed:this.data.closed.filter(s=>s.id!==e)})}this.load(!0)},this.resetFilters=()=>{this.filters={..._},(this.r.dept||this.r.assignee)&&this.go({dept:"",assignee:void 0})}}connectedCallback(){super.connectedCallback(),X(this),this.phoneMq.addEventListener("change",this.onPhone),this.pagedMq.addEventListener("change",this.onPaged),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offNames=rt(()=>this.requestUpdate()),this.live.start(),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.pagedMq.removeEventListener("change",this.onPaged),this.fitObserver?.disconnect(),this.fitObserver=null,this.fitBox=null,this.removeEventListener("scroll",this.onScroll),this.offNames?.(),this.live.stop(),window.clearTimeout(this.qTimer),window.clearTimeout(this.toastTimer)}updated(){Pt(this.renderRoot,this.phone),this.watchFit()}pagedBoard(){return this.paged&&this.screen==="ready"&&this.r.pane!=="handlers"&&!!this.data?.items.length}watchFit(){const t=this.pagedBoard()?this.renderRoot.querySelector("[data-board-pages]"):null;t!==this.fitBox&&(this.fitObserver?.disconnect(),this.fitObserver=null,this.fitBox=t,t&&typeof ResizeObserver<"u"&&(this.fitObserver=new ResizeObserver(()=>this.measureFit()),this.fitObserver.observe(t))),t&&this.measureFit()}measureFit(){const t=this.fitBox;if(!t||!t.isConnected)return;const e=t.querySelector(".cgrid"),s=[...t.querySelectorAll(".cgrid > ticket-card")];if(!e||!s.length)return;const i=h=>Math.max(0,...[...t.querySelectorAll(h)].map($=>$.offsetHeight)),a=this.maxH;a.row=Math.max(a.row,...s.map(h=>h.offsetHeight));let l=!1;for(const h of s){const $=h.item?.id;$&&h.offsetHeight>(this.cardH.get($)??0)&&(this.cardH.set($,h.offsetHeight),l=!0)}a.head=Math.max(a.head,i(".fsec > .sh")),a.sub=Math.max(a.sub,i(".assignee-block > .sub")),a.cr=Math.max(a.cr,i(".closedrows > .cr"));const o=t.querySelector(".closedrows"),n=o?(parseFloat(getComputedStyle(o).paddingBlockStart)||0)+(parseFloat(getComputedStyle(o).paddingBlockEnd)||0):8,u={room:t.clientHeight,cols:mt(e),rowH:a.row,gap:O(e),headH:a.head||40,subH:a.sub||36,secGap:O(t.querySelector(":scope > .groups")),inGap:O(t.querySelector(".fsec")),blkGap:O(t.querySelector(".assignee-block"))||10,crH:a.cr||44,crPad:n},p=this.fit;(!p||l||Object.keys(u).some(h=>p[h]!==u[h]))&&(this.fit=u)}stripTip(t){const e=this.data;if(!e||t==="closed")return"";const s=t==="waiting"?i=>i.group==="waiting":t==="stuck"?i=>!!i.stuck:t==="unassigned"?i=>["new","returned"].includes(i.status):()=>!0;return bt(e.items.filter(s),this.now)}willUpdate(t){if(t.has("route")&&this.route){this.r=G(this.route.params),this.r.ticketId&&(this.drawerUsed=!0),(this.pendingQ===null||this.r.q!==this.pendingQ.trim())&&(this.q=this.r.q,this.pendingQ=null),(this.screen==="ready"||this.screen==="error")&&this.reloadIfNeeded();const s=[this.r.q,this.r.dept,this.r.place,this.r.state,this.r.pane].join("|");s!==this.pageKey&&(this.pageKey=s,this.cardPage=1)}const e=t;(e.has("filters")||e.has("showClosed"))&&(this.cardPage=1)}async boot(){try{const t=await B().module();if(this.module=t,nt(t.name),!t.enabled){this.screen="off";return}const[e,s]=await Promise.all([B().meta(),q().treeHidden().catch(()=>!1)]);this.meta=e,this.treeHidden=s,this.reloadIfNeeded(!0)}catch(t){this.fail(t)}}fail(t){t instanceof F&&t.status===403?this.screen="forbidden":t instanceof F&&t.status===404&&t.body.code==="feature_disabled"?this.screen="off":(this.failed=ot(t),this.screen="error")}queryKey(){return`${this.r.state}|${this.r.dept}|${this.r.place}|${this.r.q.trim()}|${this.r.assignee??""}`}reloadIfNeeded(t=!1){const e=this.queryKey();!t&&e===this.key||(this.key=e,this.load(!1))}async load(t){const e=++this.seq;!t&&!this.data&&(this.screen="loading");try{const s=await q().board({state:this.r.state,department_id:this.r.dept||void 0,place:this.r.place||void 0,q:this.r.q,assignee:this.r.assignee||void 0});if(e!==this.seq)return;this.data=s,this.now=new Date,this.screen="ready"}catch(s){if(e!==this.seq||t)return;this.fail(s)}}say(t,e="ok"){this.toast={text:t,tone:e},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,e==="bad"?7e3:3500)}assigneeName(){const t=this.r.assignee??"";return t==="none"?d("noAssigneeGroup"):(this.data?.items.find(s=>s.assignee_key===t)??this.data?.closed.find(s=>s.assignee_key===t))?.assignee?.name??this.data?.handling.find(s=>s.key===t)?.name??D("ldTitle")}ui(){return Bt(this.data?{...this.module,ui:{...this.module?.ui??{},...this.data.ui}}:this.module)}go(t,e=!1){v(k({...this.r,...t},{t:this.r.ticketId||void 0}),e)}onSearch(t){this.q=t,this.pendingQ=t,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>this.go({q:t},!0),300)}detailMode(){return this.module?.ui.detail??"drawer_fullscreen"}hrefOf(t,e=!1){if(this.detailMode()==="fullscreen")return T(t);const s=k(this.r,{t});return e?`${s}${s.includes("?")?"&":"?"}view=timeline`:s}async setTreeHidden(t){this.treeHidden=t;try{await q().setTreeHidden(t)}catch{}}chips(){const t=this.data,e=[];if(this.r.dept){const s=t?.departments.find(i=>i.id===this.r.dept);e.push({key:"department",label:s?s.name:w("tbDept"),remove:()=>this.go({dept:""})})}return this.r.assignee&&e.push({key:"assignee",label:this.assigneeName(),remove:()=>this.go({assignee:void 0}),attrs:{"data-assignee-filter":this.r.assignee,"aria-label":D("clearHandler",{name:this.assigneeName()})}}),t&&e.push(...wt([...t.items,...t.closed],this.filters,s=>this.filters=s)),e}panelBody(t){const e=this.data,s=e?.departments??[];return r`
      ${s.length>1?A(w("tbDept"),r`<div class="fchips" role="group" aria-label=${b("departmentsGroup")} data-dept-chips>
        <button type="button" class="rc" aria-pressed=${String(!this.r.dept)} data-dept="" @click=${()=>this.go({dept:""})}>${b("allDepartments")}<small>${s.reduce((i,a)=>i+a.count,0)}</small></button>
        ${s.map(i=>r`<button type="button" class="rc" aria-pressed=${String(this.r.dept===i.id)} data-dept=${i.id} @click=${()=>this.go({dept:i.id})}>${x(i.name)}<small>${i.count}</small></button>`)}
      </div>`,"department"):c}
      ${t.treeInFilter&&e?A(w("tbPlace"),this.tree(e),"place"):c}
      ${e?$t([...e.items,...e.closed],this.filters,i=>this.filters=i):c}`}tree(t){const e=t.tree.reduce((s,i)=>s+(i.parent?0:i.count),0);return r`<ticket-board-tree .nodes=${t.tree} .selected=${this.r.place} .total=${e} @place-pick=${s=>this.go({place:s.detail.key})}></ticket-board-tree>`}header(){const t=this.data,e=this.ui(),s=I(e.board_floors,this.treeHidden,this.phone),i=this.screen==="ready"||this.screen==="loading",a=!!this.meta?.can.create,l=t&&s.chips?Ot(t.tree):[],o=this.r.pane==="handlers",n=this.chips(),u=this.filterOpen?Nt(this.panelBody(s),n.length,this.resetFilters,()=>this.filterOpen=!1):c;return r`<header class=${`dh${this.compactHeader?" compact":""}`} data-board-header>
      <div class="dh-row">
        <h1 data-tickets-title>${b("area")}</h1>
        ${this.meta?.can.manage?r`<div class="seg sm" role="radiogroup" aria-label=${b("dmPaneGroup")} data-board-pane>
          <button type="button" role="radio" aria-checked=${String(!o)} data-pane="cards" @click=${()=>this.go({pane:"cards"})}>${b("area")}</button>
          <button type="button" role="radio" aria-checked=${String(o)} data-pane="handlers" @click=${()=>this.go({pane:"handlers"})}>${b("hdTitle")}</button>
        </div>`:c}
        ${l.length&&!o?r`<div class="rooms" role="group" aria-label=${d("floors")} data-floor-chips>
          <button type="button" class="rc" aria-pressed=${String(!this.r.place)} data-place="" @click=${()=>this.go({place:""})}>${d("allFloors")}</button>
          ${l.map(p=>r`<button type="button" class="rc" aria-pressed=${String(this.r.place===p.key)} data-place=${p.key} @click=${()=>this.go({place:p.key})}>${x(Z(p))}<small>${p.count}</small></button>`)}
        </div>`:c}
        ${i&&!o?r`<div class="pact">
          ${vt("board",!0,this.pickMode)}
          ${a?r`<button type="button" class="btn primary newbtn" data-new aria-label=${b("newTitle")} @click=${()=>v(k(this.r,{create:!0}),!1)}>${y("plus")}<span class="lbl">${b("newShort")}</span></button>`:c}
        </div>`:c}
      </div>
      ${i&&!o?r`<div class="dh-det tb" role="group" aria-label=${w("lfGroup")} data-toolbar>
        ${t?r`<div class="seg sm stf" role="radiogroup" aria-label=${d("stateStrip")} data-state-strip>
          ${Mt(e.closed_strip,t.counts).map(p=>r`<button type="button" role="radio" aria-checked=${String(this.r.state===p.id)} data-state=${p.id} title=${this.stripTip(p.id)} @click=${()=>this.go({state:p.id})}>${p.label}<small>${p.count}</small></button>`)}
        </div>`:c}
        <label class="search">${y("search")}<span class="vh">${b("searchShort")}</span><input type="search" data-search maxlength="80" placeholder=${this.phone?b("searchShort"):b("search")} .value=${this.q} @input=${p=>this.onSearch(p.target.value)} /></label>
        <span class="fanchor">
          ${Lt(this.filterOpen,n.length,()=>this.filterOpen=!this.filterOpen,s.treeInFilter?"board":"")}
          ${this.phone?c:u}
        </span>
        ${Gt(n,this.resetFilters)}
        ${s.toggle&&this.treeHidden?r`<button type="button" class="btn sm treeshow" aria-pressed="false" data-tree-toggle @click=${()=>void this.setTreeHidden(!1)}>${y("tree")}${d("treeShow")}</button>`:c}
        ${this.pagedBoard()?this.pagerRow():c}
        ${this.phone?u:c}
      </div>`:c}
    </header>`}stateBox(t,e,s,i){return r`<div class="statebox glass" role="status" data-tickets-state=${s}><span class="ring">${y(t)}</span><b>${e}</b>${i??c}</div>`}card(t){const e=this.detailMode()!=="drawer";return r`<ticket-card .item=${t} .board=${!0} .role=${yt(t,this.meta)} .now=${this.now} .href=${this.hrefOf(t.id)} .timelineHref=${this.hrefOf(t.id,!0)} .fullScreen=${e} ?data-picked=${this.r.ticketId===t.id} @card-action=${this.onCardAction}></ticket-card>`}grid(t,e){return r`<div class="cgrid" data-cards=${e}>${lt(t,s=>s.id,s=>this.card(s))}</div>`}section(t,e,s,i,a){return r`<section class="fsec" data-section=${t}>
      <div class="sh"><h2>${e}</h2><span class="cnt" data-section-count>${i}</span><small>${s}</small></div>
      ${a}
    </section>`}handling(t,e=!1){const i=this.data.handling.filter(a=>t.some(l=>a.ids.includes(l.id)));return i.length<=1&&!e?this.grid(t,"handling"):r`${i.map(a=>{const l=t.filter(u=>a.ids.includes(u.id)),o=Kt(l.length),n=kt(l[0])[0];return r`<div class="assignee-block" data-assignee=${a.key}>
        <div class="hgroup sub">${n&&a.name?r`<span class=${`av ${n.kind}`} aria-hidden="true">${n.ini}</span>`:c}<b>${a.name?x(a.name):d("noAssigneeGroup")}</b><span>${w("bdHandlingBy",{n:a.count,age:_t(a.oldest_at,this.now)})}</span>
          <span class="load" role="img" aria-label=${w("bdLoadLabel",{n:l.length})} data-load=${o.on}>${Array.from({length:o.total},(u,p)=>r`<i class=${p<o.on?o.hot&&p===o.total-1?"hot":"on":""}></i>`)}</span></div>
        ${this.grid(l,"handling")}
      </div>`})}`}today(t){const e=Ut(t.items,t.counts,this.now);return e.length?r`<div class="today glass" role="list" aria-label=${w("bdTodayGroup")} data-board-today><b>${w("bdToday")}</b>
      ${e.map(s=>s.id?r`<button type="button" class=${`up ${s.tone}`} role="listitem" data-today=${s.kind} @click=${()=>v(this.hrefOf(s.id),!1)}><i></i><time>${s.time}</time><span>${x(s.label)}</span>${s.what?r`<span class="what">${x(s.what)}</span>`:c}</button>`:r`<span class=${`up ${s.tone}`} role="listitem" data-today=${s.kind}><i></i><span>${s.label}</span></span>`)}
    </div>`:c}closedRows(t){return r`<div class="closedrows glass" data-cards="closed">${t.map(e=>r`<a class="cr" href=${this.hrefOf(e.id)} data-closed-row=${e.id} aria-label=${w("bdOpenRow",{n:e.number})}>
      <span class="num">#${e.number}</span><b>${e.title}</b><span class="hide-p">${e.assignee?.name?x(e.assignee.name):""}</span><span>${dt(e.closed_at??e.last_activity_at,this.now)}</span></a>`)}</div>`}cards(){const t=this.data,e=this.ui(),s=L(t.items,this.filters),i=L(t.closed,this.filters);if(!t.items.length)return this.r.q.trim()||this.r.dept||this.r.place||this.r.state!=="all"?this.stateBox("search",this.r.state!=="all"&&!this.r.q.trim()?d("emptyState"):b("emptyFiltered"),"no-match",r`<button type="button" class="btn sm" data-clear-filters @click=${()=>v(k({}),!1)}>${b("clearFilters")}</button>`):this.stateBox("ticket",d("emptyBoard"),"empty");if(!s.length&&!i.length)return this.stateBox("search",w("lfNoMatch"),"no-match-filters",r`<button type="button" class="btn sm" data-clear-card-filters @click=${()=>this.filters={..._}}>${y("x")}${w("lfClear")}</button>`);if(this.pagedBoard()&&this.fit)return this.pagedCards(s,i);if(!E(e.grouping,this.r.state))return this.grid(s,"flat");const a=P(s);return r`<div class="groups">
      ${a.waiting.length?this.section("waiting",d("grpWaiting"),d("grpWaitingSub"),a.waiting.length,this.grid(a.waiting,"waiting")):c}
      ${a.stuck.length?this.section("stuck",d("grpStuck"),d("grpStuckSub"),a.stuck.length,this.grid(a.stuck,"stuck")):c}
      ${a.handling.length?this.section("handling",d("grpHandling"),d("grpHandlingSub"),a.handling.length,this.handling(a.handling)):c}
      ${this.r.state==="all"&&e.closed_strip!=="hidden"&&i.length?r`<section class="fsec" data-section="closed">
        <div class="sh"><h2>${d("grpClosed")}</h2><span class="cnt">${i.length}</span>
          <button type="button" class="btn sm" aria-expanded=${String(this.showClosed)} data-closed-toggle @click=${()=>this.showClosed=!this.showClosed}>${this.showClosed?d("hideClosed"):d("showClosed")}</button></div>
        ${this.showClosed?this.closedRows(i):c}
      </section>`:c}
    </div>`}packSections(t,e){const s=this.data,i=this.ui(),a=this.fit,l=(u,p,h=!1)=>({key:u,sub:h,items:p,cols:a.cols,rowH:a.rowH,gap:a.gap,heightOf:$=>this.cardH.get($.id)});if(!E(i.grouping,this.r.state))return[{id:"flat",head:!1,groups:[l("flat",t)]}];const o=P(t),n=[];if(o.waiting.length&&n.push({id:"waiting",head:!0,groups:[l("waiting",o.waiting)]}),o.stuck.length&&n.push({id:"stuck",head:!0,groups:[l("stuck",o.stuck)]}),o.handling.length){const u=s.handling.filter(p=>o.handling.some(h=>p.ids.includes(h.id)));n.push({id:"handling",head:!0,groups:u.length<=1?[l("handling",o.handling)]:u.map(p=>l(`h:${p.key}`,o.handling.filter(h=>p.ids.includes(h.id)),!0))})}return this.r.state==="all"&&i.closed_strip!=="hidden"&&e.length&&n.push({id:"closed",head:!0,groups:this.showClosed?[{key:"closed",sub:!1,items:e,cols:1,rowH:a.crH,gap:0,pad:a.crPad}]:[]}),n}pagedCards(t,e){const s=this.fit,i=this.packSections(t,e),a=xt(i,{room:s.room,headH:s.headH,subH:s.subH,secGap:s.secGap,inGap:s.inGap,blkGap:s.blkGap});this.pageCount=Math.max(1,a.length);const l=Math.min(Math.max(1,this.cardPage),this.pageCount),o=a[l-1]??[],n=P(t),u=h=>h==="waiting"?n.waiting.length:h==="stuck"?n.stuck.length:h==="handling"?n.handling.length:e.length;return o.length===1&&o[0].id==="flat"?this.grid(o[0].groups[0]?.items??[],"flat"):r`<div class="groups">${o.map(h=>{const $=h.groups.flatMap(C=>C.items);if(h.id==="closed")return r`<section class="fsec" data-section="closed">
          <div class="sh"><h2>${d("grpClosed")}</h2><span class="cnt">${e.length}</span>
            <button type="button" class="btn sm" aria-expanded=${String(this.showClosed)} data-closed-toggle @click=${()=>this.showClosed=!this.showClosed}>${this.showClosed?d("hideClosed"):d("showClosed")}</button></div>
          ${this.showClosed&&$.length?this.closedRows($):c}
        </section>`;const tt=i.find(C=>C.id===h.id)?.groups.some(C=>C.sub)??!1,et=h.id==="handling"?this.handling($,tt):this.grid($,h.id),st=h.id==="waiting"?d("grpWaiting"):h.id==="stuck"?d("grpStuck"):d("grpHandling"),at=h.id==="waiting"?d("grpWaitingSub"):h.id==="stuck"?d("grpStuckSub"):d("grpHandlingSub");return this.section(h.id,st,at,u(h.id),et)})}</div>`}pagerRow(){if(this.pageCount<=1)return c;const t=Math.min(Math.max(1,this.cardPage),this.pageCount);return r`<sw-pager class="bpager" data-board-pager .page=${t} .pages=${this.pageCount} @page-change=${e=>this.cardPage=e.detail.page}></sw-pager>`}body(){switch(this.screen){case"loading":{const a=r`<ticket-card skeleton .board=${!0}></ticket-card>`;return r`<div data-tickets-state="loading" aria-busy="true"><div class="cgrid">${Array.from({length:this.phone?3:6},()=>a)}</div></div>`}case"off":return this.stateBox("ticket",b("moduleOff"),"off");case"forbidden":return this.stateBox("lock",d("notManager"),"forbidden");case"error":return this.stateBox("warning",b("loadFailed"),"error",r`${this.failed?r`<span class="vh" data-error-detail>${this.failed}</span>`:c}<button type="button" class="btn sm" data-retry @click=${()=>{this.screen="loading",this.data=null,this.boot()}}>${y("refresh")}${b("retry")}</button>`)}if(this.r.pane==="handlers")return r`<tickets-handlers embedded data-board-handlers></tickets-handlers>`;const t=this.data,e=this.ui(),s=I(e.board_floors,this.treeHidden,this.phone),i=t.counts.stuck>0&&this.r.state!=="stuck"?r`<div class="banner warn" role="status" data-stuck-banner>${y("warning")}<div><b>${d("banner",{n:t.counts.stuck})}</b></div><button type="button" class="btn sm" data-stuck-go @click=${()=>this.go({state:"stuck"})}>${d("bannerGo")}</button></div>`:c;return r`
      ${this.today(t)}
      <div class=${`layout${s.tree?" with-tree":""}`}>
        ${s.tree?r`<aside class="side" aria-label=${w("tbTree")}>
          ${s.toggle?r`<div class="sidehead"><b>${d("floors")}</b><button type="button" class="btn sm" aria-pressed="true" data-tree-toggle @click=${()=>void this.setTreeHidden(!0)}>${y("tree")}${d("treeHide")}</button></div>`:c}
          ${this.tree(t)}
        </aside>`:c}
        <div class="groups" data-board-main>
          ${i}
          ${this.pagedBoard()?r`<div class="pgbox" data-board-pages data-page=${Math.min(Math.max(1,this.cardPage),this.pageCount)} data-pages=${this.pageCount}>${this.cards()}</div>`:this.cards()}
          ${t.truncated?r`<div class="note" data-truncated>${d("truncated")}</div>`:c}
        </div>
      </div>`}render(){const t=this.module?.ui,e=!!this.r.ticketId&&this.screen==="ready";this.pageCount=1;const s=this.body();return r`<div class="page" data-screen="tickets-board">
      ${this.header()}
      <div class=${`scr${this.pagedBoard()?" paged":""}`} data-board-scroll>${s}</div>
    </div>
    ${this.drawerUsed&&this.module?.enabled?r`<ticket-detail mode="drawer" .open=${e} .ticketId=${this.r.ticketId} .detailMode=${t?.detail??"drawer_fullscreen"} .scope=${"department"} .focusTimeline=${this.route?.params.get("view")==="timeline"} .initialTab=${this.route?.params.get("tab")??""}
      .defaultTab=${t?.detail_tab??""} .sizeSetting=${t?.drawer_size??""} .sheetSetting=${t?.phone_sheet??""} .cameraViewfinder=${t?.camera_viewfinder===!0} .assignContact=${ct(this.route?.params.get("assign"))}
      @assign-consumed=${()=>v(k(this.r,{t:this.r.ticketId}),!0)}
      @drawer-close=${this.closeDrawer} @ticket-changed=${()=>void this.load(!0)} @ticket-gone=${this.onGone}></ticket-detail>`:c}
    ${this.module?.enabled&&this.meta?.can.create?r`<ticket-create .open=${this.r.creating&&this.screen==="ready"} .meta=${this.meta} .mode=${t?.new_ticket??"sheet"} .scope=${"department"} .detailMode=${t?.detail??"drawer_fullscreen"}
      @close=${()=>v(k(this.r),!1)} @created=${i=>{const a=i.detail;this.say(a.failedPhotos?b("photosFailed",{n:a.failedPhotos}):b(a.result==="absorbed"?"absorbed":"created",{n:a.number}),a.failedPhotos?"bad":"ok");const l=this.detailMode()==="fullscreen"?T(a.id):k(this.r,{t:a.id});v(a.assignContact&&a.result==="created"?ht(l,a.assignContact):l,!0),this.load(!1)}}></ticket-create>`:c}
    ${this.toast?r`<div class=${`banner flt ${this.toast.tone==="bad"?"bad":"info"}`} role="status" data-tickets-toast>${y(this.toast.tone==="bad"?"warning":"check")}<div>${this.toast.text}</div></div>`:c}`}};g.styles=[K,...W,qt,St,Ct,It,Q`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--dv-gap-lg, 16px);
      align-items: start;
    }
    .layout.with-tree {
      grid-template-columns: 280px minmax(0, 1fr);
    }
    .side {
      position: sticky;
      inset-block-start: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* TICKETS-POLISH-2331 (audit §7.5.9): the tree's own head carries its hide control (it was a third button on the title row) */
    .sidehead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-inline: 6px 2px;
      min-block-size: 32px;
    }
    .sidehead b {
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      color: var(--dv-text-2);
    }
    .sidehead .btn {
      box-shadow: none;
    }
    .treeshow {
      flex: none;
      margin-inline-start: auto;
    }
    .cgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
      gap: var(--dv-gap-lg, 16px);
      align-items: stretch;
    }
    .cnt {
      display: inline-grid;
      place-items: center;
      min-inline-size: 22px;
      block-size: 22px;
      padding-inline: 6px;
      box-sizing: border-box;
      border-radius: var(--sw-r-pill);
      background: var(--dv-warning-soft);
      color: var(--au-warn-text);
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .seg button small,
    .rc small {
      font-variant-numeric: tabular-nums;
      margin-inline-start: 6px;
    }
    /* a floor's count is a small badge, never read as part of the floor's own number ("קומה 1" + 2) */
    .rc small {
      display: inline-grid;
      place-items: center;
      min-inline-size: 18px;
      block-size: 18px;
      padding-inline: 5px;
      box-sizing: border-box;
      margin-inline-start: 8px;
      border-radius: var(--sw-r-pill);
      background: color-mix(in srgb, var(--dv-text) 8%, transparent);
      color: var(--dv-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: 700;
    }
    .rc[aria-pressed='true'] small {
      background: color-mix(in srgb, currentColor 18%, transparent);
      color: inherit;
    }
    .sub {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding-inline: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .sub b {
      color: var(--dv-text);
      font-size: var(--sw-fs-md);
    }
    .assignee-block {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      text-align: center;
    }
    .flt {
      position: fixed;
      inset-block-end: 24px;
      inset-inline: 0;
      margin-inline: auto;
      inline-size: fit-content;
      max-inline-size: calc(100% - 32px);
      box-sizing: border-box;
      z-index: 40;
      box-shadow: var(--dv-shadow-2);
    }
    /* NOSCROLL-297 + TICKETS-POLISH-2331 (owner rule: a control screen fits the viewport): from a tablet up, below the header the board (the
       today row, the tree, the groups of cards) scrolls in its own region - the page itself never scrolls and the controls stay in place;
       the tree stays beside the cards (sticky inside the region). On a phone the region is transparent and the page scrolls. */
    .scr {
      display: contents;
    }
    @media (min-width: 768px) {
      :host {
        overflow: hidden;
      }
      .page {
        block-size: 100%;
        min-block-size: 0;
        box-sizing: border-box;
        padding-block-end: 0;
        gap: 18px;
      }
      .scr {
        display: flex;
        flex-direction: column;
        gap: 18px;
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--dv-border-strong) transparent;
        margin-inline: -36px;
        padding: 2px 36px 28px;
      }
    }
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30 #5): on a desktop the board is paged - the "today"
       row and the banner stay, the groups take the room left (.pgbox: its height set by the layout, never by the cards) and show what fits;
       the tree scrolls inside its own column; the pager is at the end of the toolbar row. The region keeps overflow: auto only as the
       fallback of a window shorter than one group header and one row of cards. */
    .bpager {
      flex: none;
      margin-inline-start: auto;
    }
    @media (min-width: 1024px) {
      .scr.paged {
        padding-block-end: 20px;
      }
      .scr.paged > .layout {
        flex: 1 1 0;
        min-block-size: 0;
        grid-template-rows: minmax(0, 1fr);
        align-items: stretch;
      }
      .scr.paged .side {
        position: static;
        min-block-size: 0;
        max-block-size: 100%;
        overflow-y: auto;
        scrollbar-width: thin;
      }
      .scr.paged [data-board-main] {
        min-block-size: 0;
        gap: 14px;
      }
      .scr.paged .pgbox {
        flex: 1 1 0;
        min-block-size: 0;
      }
      .scr.paged .pgbox > .groups {
        gap: 18px;
      }
      .scr.paged .pgbox .cgrid {
        align-content: start;
      }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .scr {
        margin-inline: -24px;
        padding-inline: 24px;
      }
      .layout.with-tree {
        grid-template-columns: 240px minmax(0, 1fr);
      }
      /* a portrait tablet: "סינון" and "+ חדשה" are icon buttons (their names stay in aria-label), and the toolbar may take a second line
         rather than run past the screen's edge (the layout guard found both labels cut by the board at 768) */
      .tb .filterbtn .lbl,
      .dh-row .pact .newbtn .lbl {
        display: none;
      }
      .dh-row .pact .newbtn {
        min-inline-size: 44px;
        justify-content: center;
      }
      .dh-det.tb {
        flex-wrap: wrap;
      }
    }
    @media (max-width: 767px) {
      .dh-row {
        grid-template-areas: 't p .' 'b b b' 'r r r';
        grid-template-columns: minmax(0, 1fr) auto var(--sw-float-reserve, 0px);
      }
      .dh-row .pact {
        grid-area: p;
      }
      /* the manager's "board / handlers" switch takes a whole row of its own, above the floor chips (it chooses the pane they filter); it
         folds away with the floor chips while the header is compact */
      .dh-row > [data-board-pane] {
        grid-area: b;
        justify-self: start;
      }
      .dh.compact .dh-row > [data-board-pane] {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
      /* the state strip: three a row (nothing hidden behind a scroll, every count readable) */
      .tb > .seg.stf {
        grid-auto-flow: row;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .flt {
        inset-block-end: calc(84px + env(safe-area-inset-bottom, 0px));
      }
    }
  `];f([M({attribute:!1})],g.prototype,"route",2);f([m()],g.prototype,"r",2);f([m()],g.prototype,"module",2);f([m()],g.prototype,"meta",2);f([m()],g.prototype,"data",2);f([m()],g.prototype,"screen",2);f([m()],g.prototype,"failed",2);f([m()],g.prototype,"phone",2);f([m()],g.prototype,"treeHidden",2);f([m()],g.prototype,"filterOpen",2);f([m()],g.prototype,"showClosed",2);f([m()],g.prototype,"drawerUsed",2);f([m()],g.prototype,"now",2);f([m()],g.prototype,"q",2);f([m()],g.prototype,"toast",2);f([m()],g.prototype,"filters",2);f([m()],g.prototype,"compactHeader",2);f([m()],g.prototype,"paged",2);f([m()],g.prototype,"cardPage",2);f([m()],g.prototype,"fit",2);g=f([J("tickets-board")],g);export{g as TicketsBoard};
//# sourceMappingURL=tickets-board-BH_dhcKN.js.map
