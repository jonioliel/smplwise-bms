import{C as B,D as A,E,F as T,G as m,a as R,S as G,b as j,A as o,v as d,t as w,e as r,q as y,H as U,y as V,hC as S,p,o as W,f as z,s as K,j as H,R as Y,d as q,bv as X,u as J,mG as Z,mB as tt,nu as et,r as st}from"./index-DzjkD5gF.js";import{l as b,N as C,F as at,d as it,s as rt,o as nt,e as ot,p as P,f as lt,g as dt,h as ct,i as ht,j as pt,a as ut,q as mt,k as M,m as bt,u as ft,n as gt}from"./list-filter-row-nJmEZ_TW.js";import{c as $t}from"./ticket-detail-BsqpTpgH.js";import{p as Q,n as wt,c as D,b as v,d as N,e as vt,s as yt,g as kt,h as xt,i as St}from"./board-model-6Ht-3CQW.js";import"./tickets-handlers-twEBYDRO.js";import{m as Tt,a as Ct}from"./media-page-B6OKDrZF.js";import{L as _t,b as _,a as Ot}from"./tickets-board-8c1uxJwo.js";import{d as zt}from"./drawer-model-DmH2_QAX.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-fanWbGht.js";import"./geometry-Buq2ZUMw.js";import"./tickets-phone-verify-Mx16Adj5.js";import"./identity-card-5PJxJxQp.js";import"./access-grants-CIrRADIR.js";import"./access-people-DfeC4yhh.js";import"./wiskey-format-B1C9aa4N.js";import"./recordings-BxIyWJhO.js";import"./settings-styles-B-YnaI29.js";import"./handler-load-BXHEF_X6.js";import"./settings-tabs-CcQjb9O6.js";var Ht=Object.defineProperty,qt=Object.getOwnPropertyDescriptor,x=(t,e,s,a)=>{for(var i=a>1?void 0:a?qt(e,s):e,c=t.length-1,l;c>=0;c--)(l=t[c])&&(i=(a?l(e,s,i):l(i))||i);return a&&i&&Ht(e,s,i),i};let k=class extends R{constructor(){super(...arguments),this.bubbleSkin=new G(this),this.nodes=[],this.selected="",this.total=0,this.closed=new Set}connectedCallback(){super.connectedCallback(),j(this)}pick(t){this.dispatchEvent(new CustomEvent("place-pick",{detail:{key:t},bubbles:!0,composed:!0}))}toggle(t){const e=new Set(this.closed);e.has(t)?e.delete(t):e.add(t),this.closed=e}branch(t,e){const s=t.node,a=!this.closed.has(s.key),i=t.children.length>0,c=Q(s);return r`<div role="treeitem" aria-level=${e+1} aria-expanded=${i?String(a):o} aria-selected=${String(this.selected===s.key)}>
      <div class=${`row l${Math.min(e,2)}`} role="button" tabindex="0" aria-pressed=${String(this.selected===s.key)} data-place=${s.key}
        @click=${()=>this.pick(s.key)} @keydown=${l=>{(l.key==="Enter"||l.key===" ")&&(l.preventDefault(),this.pick(s.key))}}>
        ${i?r`<button type="button" class="tw" aria-expanded=${String(a)} aria-label=${d(a?"collapse":"expand",{name:c})} data-twist=${s.key}
          @click=${l=>{l.stopPropagation(),this.toggle(s.key)}}>${w("chevronDown")}</button>`:r`<span></span>`}
        <span class="nm">${e===0?r`<b>${y(c)}</b>`:y(c)}</span>
        <span class="n">${s.count}</span>
      </div>
      ${i&&a?r`<div role="group">${t.children.map(l=>this.branch(l,e+1))}</div>`:o}
    </div>`}render(){const t=wt(this.nodes);return r`<nav class="tree glass" aria-label=${d("floors")} data-board-tree>
      <div role="tree" aria-label=${d("floors")}>
        <div class="row l0" role="button" tabindex="0" aria-pressed=${String(!this.selected)} data-place=""
          @click=${()=>this.pick("")} @keydown=${e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.pick(""))}}>
          <span></span><span class="nm"><b>${d("allFloors")}</b></span><span class="n">${this.total}</span>
        </div>
        ${t.map(e=>this.branch(e,0))}
      </div>
    </nav>`}};k.styles=[B,...A,E`
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
  `];x([T({attribute:!1})],k.prototype,"nodes",2);x([T()],k.prototype,"selected",2);x([T({type:Number})],k.prototype,"total",2);x([m()],k.prototype,"closed",2);k=x([U("ticket-board-tree")],k);const Pt=2,Mt=["closed","cancelled"],F=t=>String(t).padStart(2,"0"),I=t=>`${F(t.getHours())}:${F(t.getMinutes())}`,L=(t,e)=>t.getFullYear()===e.getFullYear()&&t.getMonth()===e.getMonth()&&t.getDate()===e.getDate();function Dt(t,e,s){const a=t.filter(n=>!Mt.includes(n.status)),i=[],c=a.filter(n=>n.eta_at&&n.assignee).map(n=>({x:n,at:new Date(n.eta_at)})).filter(({at:n})=>!Number.isNaN(n.getTime())&&L(n,s)&&n.getTime()>=s.getTime()).sort((n,g)=>n.at.getTime()-g.at.getTime()).slice(0,Pt);for(const{x:n,at:g}of c)i.push({kind:"visit",time:I(g),label:`${b("bdVisit")} · ${n.assignee?.name??""}`,what:n.place_text||n.device_name,tone:"info",id:n.id});const l=a.filter(n=>n.sla_cell&&!n.sla_cell.over).map(n=>({x:n,at:new Date(n.sla_cell.at)})).filter(({at:n})=>!Number.isNaN(n.getTime())&&L(n,s)&&n.getTime()>=s.getTime()).sort((n,g)=>n.at.getTime()-g.at.getTime());if(l.length){const{x:n,at:g}=l[0];i.push({kind:"sla",time:I(g),label:b("bdSla"),what:`#${n.number} ${$t(n.title,28)}`,tone:"warn",id:n.id})}return e.waiting>0&&i.push({kind:"waiting",time:"",label:b(e.waiting===1?"bdWaitingMineOne":"bdWaitingMine",{n:e.waiting}),what:"",tone:"ok",id:""}),i}const O=4;function Nt(t){return{on:Math.max(0,Math.min(O,t)),total:O,hot:t>=O}}var Ft=Object.defineProperty,It=Object.getOwnPropertyDescriptor,u=(t,e,s,a)=>{for(var i=a>1?void 0:a?It(e,s):e,c=t.length-1,l;c>=0;c--)(l=t[c])&&(i=(a?l(e,s,i):l(i))||i);return a&&i&&Ft(e,s,i),i};function $(t,e){if(!e){window.location.hash=t;return}const s=t.replace(/^#/,""),[a,i=""]=s.split("?");st(a,new URLSearchParams(i))}let h=class extends R{constructor(){super(...arguments),this.bubbleSkin=new G(this),this.route=null,this.r=D(new URLSearchParams),this.module=null,this.meta=null,this.data=null,this.screen="loading",this.failed="",this.phone=window.matchMedia("(max-width: 767px)").matches,this.treeHidden=!1,this.filterOpen=!1,this.showClosed=!1,this.drawerUsed=!1,this.now=new Date,this.q="",this.toast=null,this.filters={...C},this.compactHeader=!1,this.panelCtl=new at(this,()=>this.filterOpen,t=>this.filterOpen=t),this.pendingQ=null,this.key="",this.seq=0,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.qTimer=0,this.live=new _t(()=>{this.now=new Date,this.screen==="ready"&&this.load(!0)}),this.toastTimer=0,this.offNames=null,this.onScroll=()=>{const t=this.scrollTop>40&&!this.filterOpen;t!==this.compactHeader&&(this.compactHeader=t)},this.pickMode=t=>{t!=="board"&&(it(t==="calendar"),t!=="calendar"&&rt({view:t}),window.location.hash=V(et()))},this.onCardAction=t=>{const{item:e,action:s}=t.detail;if(s==="open")$(this.hrefOf(e.id),!1);else if(s==="full")$(S(e.id),!1);else if(s==="copy"){const a=`${location.origin}${location.pathname}${location.search}${S(e.id)}`;navigator.clipboard?.writeText(a).then(()=>this.say(p("linkCopied"))).catch(()=>this.say(a))}},this.closeDrawer=()=>this.isConnected&&$(v(this.r),!1),this.onGone=t=>{if(this.closeDrawer(),t.detail?.deleted){this.say(zt("deletedOne"));const e=t.detail.id;this.data&&(this.data={...this.data,items:this.data.items.filter(s=>s.id!==e),closed:this.data.closed.filter(s=>s.id!==e)})}this.load(!0)},this.resetFilters=()=>{this.filters={...C},(this.r.dept||this.r.assignee)&&this.go({dept:"",assignee:void 0})}}connectedCallback(){super.connectedCallback(),j(this),this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offNames=W(()=>this.requestUpdate()),this.live.start(),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),this.offNames?.(),this.live.stop(),window.clearTimeout(this.qTimer),window.clearTimeout(this.toastTimer)}updated(){Tt(this.renderRoot,this.phone)}stripTip(t){const e=this.data;if(!e||t==="closed")return"";const s=t==="waiting"?a=>a.group==="waiting":t==="stuck"?a=>!!a.stuck:t==="unassigned"?a=>["new","returned"].includes(a.status):()=>!0;return nt(e.items.filter(s),this.now)}willUpdate(t){t.has("route")&&this.route&&(this.r=D(this.route.params),this.r.ticketId&&(this.drawerUsed=!0),(this.pendingQ===null||this.r.q!==this.pendingQ.trim())&&(this.q=this.r.q,this.pendingQ=null),(this.screen==="ready"||this.screen==="error")&&this.reloadIfNeeded())}async boot(){try{const t=await z().module();if(this.module=t,K(t.name),!t.enabled){this.screen="off";return}const[e,s]=await Promise.all([z().meta(),_().treeHidden().catch(()=>!1)]);this.meta=e,this.treeHidden=s,this.reloadIfNeeded(!0)}catch(t){this.fail(t)}}fail(t){t instanceof H&&t.status===403?this.screen="forbidden":t instanceof H&&t.status===404&&t.body.code==="feature_disabled"?this.screen="off":(this.failed=Y(t),this.screen="error")}queryKey(){return`${this.r.state}|${this.r.dept}|${this.r.place}|${this.r.q.trim()}|${this.r.assignee??""}`}reloadIfNeeded(t=!1){const e=this.queryKey();!t&&e===this.key||(this.key=e,this.load(!1))}async load(t){const e=++this.seq;!t&&!this.data&&(this.screen="loading");try{const s=await _().board({state:this.r.state,department_id:this.r.dept||void 0,place:this.r.place||void 0,q:this.r.q,assignee:this.r.assignee||void 0});if(e!==this.seq)return;this.data=s,this.now=new Date,this.screen="ready"}catch(s){if(e!==this.seq||t)return;this.fail(s)}}say(t,e="ok"){this.toast={text:t,tone:e},window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast=null,e==="bad"?7e3:3500)}assigneeName(){const t=this.r.assignee??"";return t==="none"?d("noAssigneeGroup"):(this.data?.items.find(s=>s.assignee_key===t)??this.data?.closed.find(s=>s.assignee_key===t))?.assignee?.name??this.data?.handling.find(s=>s.key===t)?.name??q("ldTitle")}ui(){return Ot(this.data?{...this.module,ui:{...this.module?.ui??{},...this.data.ui}}:this.module)}go(t,e=!1){$(v({...this.r,...t},{t:this.r.ticketId||void 0}),e)}onSearch(t){this.q=t,this.pendingQ=t,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>this.go({q:t},!0),300)}detailMode(){return this.module?.ui.detail??"drawer_fullscreen"}hrefOf(t,e=!1){if(this.detailMode()==="fullscreen")return S(t);const s=v(this.r,{t});return e?`${s}${s.includes("?")?"&":"?"}view=timeline`:s}async setTreeHidden(t){this.treeHidden=t;try{await _().setTreeHidden(t)}catch{}}chips(){const t=this.data,e=[];if(this.r.dept){const s=t?.departments.find(a=>a.id===this.r.dept);e.push({key:"department",label:s?s.name:b("tbDept"),remove:()=>this.go({dept:""})})}return this.r.assignee&&e.push({key:"assignee",label:this.assigneeName(),remove:()=>this.go({assignee:void 0}),attrs:{"data-assignee-filter":this.r.assignee,"aria-label":q("clearHandler",{name:this.assigneeName()})}}),t&&e.push(...ot([...t.items,...t.closed],this.filters,s=>this.filters=s)),e}panelBody(t){const e=this.data,s=e?.departments??[];return r`
      ${s.length>1?P(b("tbDept"),r`<div class="fchips" role="group" aria-label=${p("departmentsGroup")} data-dept-chips>
        <button type="button" class="rc" aria-pressed=${String(!this.r.dept)} data-dept="" @click=${()=>this.go({dept:""})}>${p("allDepartments")}<small>${s.reduce((a,i)=>a+i.count,0)}</small></button>
        ${s.map(a=>r`<button type="button" class="rc" aria-pressed=${String(this.r.dept===a.id)} data-dept=${a.id} @click=${()=>this.go({dept:a.id})}>${y(a.name)}<small>${a.count}</small></button>`)}
      </div>`,"department"):o}
      ${t.treeInFilter&&e?P(b("tbPlace"),this.tree(e),"place"):o}
      ${e?lt([...e.items,...e.closed],this.filters,a=>this.filters=a):o}`}tree(t){const e=t.tree.reduce((s,a)=>s+(a.parent?0:a.count),0);return r`<ticket-board-tree .nodes=${t.tree} .selected=${this.r.place} .total=${e} @place-pick=${s=>this.go({place:s.detail.key})}></ticket-board-tree>`}header(){const t=this.data,e=this.ui(),s=N(e.board_floors,this.treeHidden,this.phone),a=this.screen==="ready"||this.screen==="loading",i=!!this.meta?.can.create,c=t&&s.chips?vt(t.tree):[],l=this.r.pane==="handlers",n=this.chips(),g=this.filterOpen?dt(this.panelBody(s),n.length,this.resetFilters,()=>this.filterOpen=!1):o;return r`<header class=${`dh${this.compactHeader?" compact":""}`} data-board-header>
      <div class="dh-row">
        <h1 data-tickets-title>${p("area")}</h1>
        ${this.meta?.can.manage?r`<div class="seg sm" role="radiogroup" aria-label=${p("dmPaneGroup")} data-board-pane>
          <button type="button" role="radio" aria-checked=${String(!l)} data-pane="cards" @click=${()=>this.go({pane:"cards"})}>${p("area")}</button>
          <button type="button" role="radio" aria-checked=${String(l)} data-pane="handlers" @click=${()=>this.go({pane:"handlers"})}>${p("hdTitle")}</button>
        </div>`:o}
        ${c.length&&!l?r`<div class="rooms" role="group" aria-label=${d("floors")} data-floor-chips>
          <button type="button" class="rc" aria-pressed=${String(!this.r.place)} data-place="" @click=${()=>this.go({place:""})}>${d("allFloors")}</button>
          ${c.map(f=>r`<button type="button" class="rc" aria-pressed=${String(this.r.place===f.key)} data-place=${f.key} @click=${()=>this.go({place:f.key})}>${y(Q(f))}<small>${f.count}</small></button>`)}
        </div>`:o}
        ${a&&!l?r`<div class="pact">
          ${ct("board",!0,this.pickMode)}
          ${i?r`<button type="button" class="btn primary newbtn" data-new aria-label=${p("newTitle")} @click=${()=>$(v(this.r,{create:!0}),!1)}>${w("plus")}<span class="lbl">${p("newShort")}</span></button>`:o}
        </div>`:o}
      </div>
      ${a&&!l?r`<div class="dh-det tb" role="group" aria-label=${b("lfGroup")} data-toolbar>
        ${t?r`<div class="seg sm stf" role="radiogroup" aria-label=${d("stateStrip")} data-state-strip>
          ${yt(e.closed_strip,t.counts).map(f=>r`<button type="button" role="radio" aria-checked=${String(this.r.state===f.id)} data-state=${f.id} title=${this.stripTip(f.id)} @click=${()=>this.go({state:f.id})}>${f.label}<small>${f.count}</small></button>`)}
        </div>`:o}
        <label class="search">${w("search")}<span class="vh">${p("searchShort")}</span><input type="search" data-search maxlength="80" placeholder=${this.phone?p("searchShort"):p("search")} .value=${this.q} @input=${f=>this.onSearch(f.target.value)} /></label>
        <span class="fanchor">
          ${ht(this.filterOpen,n.length,()=>this.filterOpen=!this.filterOpen,s.treeInFilter?"board":"")}
          ${this.phone?o:g}
        </span>
        ${pt(n,this.resetFilters)}
        ${s.toggle&&this.treeHidden?r`<button type="button" class="btn sm treeshow" aria-pressed="false" data-tree-toggle @click=${()=>void this.setTreeHidden(!1)}>${w("tree")}${d("treeShow")}</button>`:o}
        ${this.phone?g:o}
      </div>`:o}
    </header>`}stateBox(t,e,s,a){return r`<div class="statebox glass" role="status" data-tickets-state=${s}><span class="ring">${w(t)}</span><b>${e}</b>${a??o}</div>`}card(t){const e=this.detailMode()!=="drawer";return r`<ticket-card .item=${t} .board=${!0} .role=${ut(t,this.meta)} .now=${this.now} .href=${this.hrefOf(t.id)} .timelineHref=${this.hrefOf(t.id,!0)} .fullScreen=${e} ?data-picked=${this.r.ticketId===t.id} @card-action=${this.onCardAction}></ticket-card>`}grid(t,e){return r`<div class="cgrid" data-cards=${e}>${X(t,s=>s.id,s=>this.card(s))}</div>`}section(t,e,s,a,i){return r`<section class="fsec" data-section=${t}>
      <div class="sh"><h2>${e}</h2><span class="cnt" data-section-count>${a}</span><small>${s}</small></div>
      ${i}
    </section>`}handling(t){const s=this.data.handling.filter(a=>t.some(i=>a.ids.includes(i.id)));return s.length<=1?this.grid(t,"handling"):r`${s.map(a=>{const i=t.filter(n=>a.ids.includes(n.id)),c=Nt(i.length),l=mt(i[0])[0];return r`<div class="assignee-block" data-assignee=${a.key}>
        <div class="hgroup sub">${l&&a.name?r`<span class=${`av ${l.kind}`} aria-hidden="true">${l.ini}</span>`:o}<b>${a.name?y(a.name):d("noAssigneeGroup")}</b><span>${b("bdHandlingBy",{n:a.count,age:kt(a.oldest_at,this.now)})}</span>
          <span class="load" role="img" aria-label=${b("bdLoadLabel",{n:i.length})} data-load=${c.on}>${Array.from({length:c.total},(n,g)=>r`<i class=${g<c.on?c.hot&&g===c.total-1?"hot":"on":""}></i>`)}</span></div>
        ${this.grid(i,"handling")}
      </div>`})}`}today(t){const e=Dt(t.items,t.counts,this.now);return e.length?r`<div class="today glass" role="list" aria-label=${b("bdTodayGroup")} data-board-today><b>${b("bdToday")}</b>
      ${e.map(s=>s.id?r`<button type="button" class=${`up ${s.tone}`} role="listitem" data-today=${s.kind} @click=${()=>$(this.hrefOf(s.id),!1)}><i></i><time>${s.time}</time><span>${y(s.label)}</span>${s.what?r`<span class="what">${y(s.what)}</span>`:o}</button>`:r`<span class=${`up ${s.tone}`} role="listitem" data-today=${s.kind}><i></i><span>${s.label}</span></span>`)}
    </div>`:o}closedRows(t){return r`<div class="closedrows glass" data-cards="closed">${t.map(e=>r`<a class="cr" href=${this.hrefOf(e.id)} data-closed-row=${e.id} aria-label=${b("bdOpenRow",{n:e.number})}>
      <span class="num">#${e.number}</span><b>${e.title}</b><span class="hide-p">${e.assignee?.name?y(e.assignee.name):""}</span><span>${J(e.closed_at??e.last_activity_at,this.now)}</span></a>`)}</div>`}cards(){const t=this.data,e=this.ui(),s=M(t.items,this.filters),a=M(t.closed,this.filters);if(!t.items.length)return this.r.q.trim()||this.r.dept||this.r.place||this.r.state!=="all"?this.stateBox("search",this.r.state!=="all"&&!this.r.q.trim()?d("emptyState"):p("emptyFiltered"),"no-match",r`<button type="button" class="btn sm" data-clear-filters @click=${()=>$(v({}),!1)}>${p("clearFilters")}</button>`):this.stateBox("ticket",d("emptyBoard"),"empty");if(!s.length&&!a.length)return this.stateBox("search",b("lfNoMatch"),"no-match-filters",r`<button type="button" class="btn sm" data-clear-card-filters @click=${()=>this.filters={...C}}>${w("x")}${b("lfClear")}</button>`);if(!xt(e.grouping,this.r.state))return this.grid(s,"flat");const i=St(s);return r`<div class="groups">
      ${i.waiting.length?this.section("waiting",d("grpWaiting"),d("grpWaitingSub"),i.waiting.length,this.grid(i.waiting,"waiting")):o}
      ${i.stuck.length?this.section("stuck",d("grpStuck"),d("grpStuckSub"),i.stuck.length,this.grid(i.stuck,"stuck")):o}
      ${i.handling.length?this.section("handling",d("grpHandling"),d("grpHandlingSub"),i.handling.length,this.handling(i.handling)):o}
      ${this.r.state==="all"&&e.closed_strip!=="hidden"&&a.length?r`<section class="fsec" data-section="closed">
        <div class="sh"><h2>${d("grpClosed")}</h2><span class="cnt">${a.length}</span>
          <button type="button" class="btn sm" aria-expanded=${String(this.showClosed)} data-closed-toggle @click=${()=>this.showClosed=!this.showClosed}>${this.showClosed?d("hideClosed"):d("showClosed")}</button></div>
        ${this.showClosed?this.closedRows(a):o}
      </section>`:o}
    </div>`}body(){switch(this.screen){case"loading":{const i=r`<ticket-card skeleton .board=${!0}></ticket-card>`;return r`<div data-tickets-state="loading" aria-busy="true"><div class="cgrid">${Array.from({length:this.phone?3:6},()=>i)}</div></div>`}case"off":return this.stateBox("ticket",p("moduleOff"),"off");case"forbidden":return this.stateBox("lock",d("notManager"),"forbidden");case"error":return this.stateBox("warning",p("loadFailed"),"error",r`${this.failed?r`<span class="vh" data-error-detail>${this.failed}</span>`:o}<button type="button" class="btn sm" data-retry @click=${()=>{this.screen="loading",this.data=null,this.boot()}}>${w("refresh")}${p("retry")}</button>`)}if(this.r.pane==="handlers")return r`<tickets-handlers embedded data-board-handlers></tickets-handlers>`;const t=this.data,e=this.ui(),s=N(e.board_floors,this.treeHidden,this.phone),a=t.counts.stuck>0&&this.r.state!=="stuck"?r`<div class="banner warn" role="status" data-stuck-banner>${w("warning")}<div><b>${d("banner",{n:t.counts.stuck})}</b></div><button type="button" class="btn sm" data-stuck-go @click=${()=>this.go({state:"stuck"})}>${d("bannerGo")}</button></div>`:o;return r`
      ${this.today(t)}
      <div class=${`layout${s.tree?" with-tree":""}`}>
        ${s.tree?r`<aside class="side" aria-label=${b("tbTree")}>
          ${s.toggle?r`<div class="sidehead"><b>${d("floors")}</b><button type="button" class="btn sm" aria-pressed="true" data-tree-toggle @click=${()=>void this.setTreeHidden(!0)}>${w("tree")}${d("treeHide")}</button></div>`:o}
          ${this.tree(t)}
        </aside>`:o}
        <div class="groups" data-board-main>
          ${a}
          ${this.cards()}
          ${t.truncated?r`<div class="note" data-truncated>${d("truncated")}</div>`:o}
        </div>
      </div>`}render(){const t=this.module?.ui,e=!!this.r.ticketId&&this.screen==="ready";return r`<div class="page" data-screen="tickets-board">
      ${this.header()}
      <div class="scr" data-board-scroll>${this.body()}</div>
    </div>
    ${this.drawerUsed&&this.module?.enabled?r`<ticket-detail mode="drawer" .open=${e} .ticketId=${this.r.ticketId} .detailMode=${t?.detail??"drawer_fullscreen"} .scope=${"department"} .focusTimeline=${this.route?.params.get("view")==="timeline"} .initialTab=${this.route?.params.get("tab")??""}
      .defaultTab=${t?.detail_tab??""} .sizeSetting=${t?.drawer_size??""} .sheetSetting=${t?.phone_sheet??""} .cameraViewfinder=${t?.camera_viewfinder===!0} .assignContact=${Z(this.route?.params.get("assign"))}
      @assign-consumed=${()=>$(v(this.r,{t:this.r.ticketId}),!0)}
      @drawer-close=${this.closeDrawer} @ticket-changed=${()=>void this.load(!0)} @ticket-gone=${this.onGone}></ticket-detail>`:o}
    ${this.module?.enabled&&this.meta?.can.create?r`<ticket-create .open=${this.r.creating&&this.screen==="ready"} .meta=${this.meta} .mode=${t?.new_ticket??"sheet"} .scope=${"department"} .detailMode=${t?.detail??"drawer_fullscreen"}
      @close=${()=>$(v(this.r),!1)} @created=${s=>{const a=s.detail;this.say(a.failedPhotos?p("photosFailed",{n:a.failedPhotos}):p(a.result==="absorbed"?"absorbed":"created",{n:a.number}),a.failedPhotos?"bad":"ok");const i=this.detailMode()==="fullscreen"?S(a.id):v(this.r,{t:a.id});$(a.assignContact&&a.result==="created"?tt(i,a.assignContact):i,!0),this.load(!1)}}></ticket-create>`:o}
    ${this.toast?r`<div class=${`banner flt ${this.toast.tone==="bad"?"bad":"info"}`} role="status" data-tickets-toast>${w(this.toast.tone==="bad"?"warning":"check")}<div>${this.toast.text}</div></div>`:o}`}};h.styles=[B,...A,Ct,bt,ft,gt,E`
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
  `];u([T({attribute:!1})],h.prototype,"route",2);u([m()],h.prototype,"r",2);u([m()],h.prototype,"module",2);u([m()],h.prototype,"meta",2);u([m()],h.prototype,"data",2);u([m()],h.prototype,"screen",2);u([m()],h.prototype,"failed",2);u([m()],h.prototype,"phone",2);u([m()],h.prototype,"treeHidden",2);u([m()],h.prototype,"filterOpen",2);u([m()],h.prototype,"showClosed",2);u([m()],h.prototype,"drawerUsed",2);u([m()],h.prototype,"now",2);u([m()],h.prototype,"q",2);u([m()],h.prototype,"toast",2);u([m()],h.prototype,"filters",2);u([m()],h.prototype,"compactHeader",2);h=u([U("tickets-board")],h);export{h as TicketsBoard};
//# sourceMappingURL=tickets-board-ZQIj0TJE.js.map
