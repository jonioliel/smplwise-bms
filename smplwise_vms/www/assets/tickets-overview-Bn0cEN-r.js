import{i as st,g as M,b as q,a as at,S as et,f as nt,L as it,c as rt,o as ot,d as dt,m as lt,e as ct,t as L,s as pt,h as mt,A as k,j as ht,r as E,k as B,H,l as A,n as ut,p as vt,q as ft,u as wt,v as gt,w as $t,x as I,y as O,z as bt,B as yt,C as xt,F as K,D as kt,E as zt,G as p,I as i,J as s,K as $,M as j,N as Q,O as b,P as St,Q as qt,R as _t,T as Ot,U as C,V as F,W as z,X as Dt,Y as Pt,Z as Tt,_ as Rt,$ as D,a0 as S,a1 as At,a2 as Ct,a3 as Ft,a4 as W,a5 as P,a6 as U,a7 as V,a8 as G,a9 as T,aa as N,ab as Nt,ac as Mt,ad as Lt,ae as Et,af as Bt,ag as Ht,ah as It,ai as Kt,aj as Y,ak as jt,al as Qt,am as Wt,an as Ut,ao as Vt,ap as g,aq as Gt}from"./index-D5l5DMYH.js";import"./transit-logic-DKeOUjSD.js";const Yt=["today","7d","30d"],Jt={summary:t=>{const a=new URLSearchParams;t.department_id&&a.set("department_id",t.department_id),t.period&&a.set("period",t.period);const n=a.toString();return M(`tickets/dashboard${n?`?${n}`:""}`)},payments:t=>M(`tickets/dashboard/payments${t.department_id?`?${new URLSearchParams({department_id:t.department_id}).toString()}`:""}`)},Zt=864e5,J=t=>String(t).padStart(2,"0"),R=t=>`${t.getFullYear()}-${J(t.getMonth()+1)}-${J(t.getDate())}`,Xt={async summary(t){const a=t.period??"7d",n=a==="today"?1:a==="30d"?30:7,r=new Date,e=await q().board({department_id:t.department_id,state:"closed"}),d=await q().board({department_id:t.department_id}),o=new Date(r.getFullYear(),r.getMonth(),r.getDate()-(n-1)).getTime(),m=new Map;for(const v of e.items){if(!v.assignee||!v.closed_at||Date.parse(v.closed_at)<o)continue;const x=m.get(v.assignee_key)??{key:v.assignee_key,kind:v.assignee.kind==="contact"?"contact":"user",name:v.assignee.name,done:0,closed:0,returned:0,median_seconds:null};x.done+=1,x.closed+=1,m.set(v.assignee_key,x)}const l=[...m.values()].sort((v,x)=>x.done-v.done||v.name.localeCompare(x.name)),c=new Date(r.getFullYear(),r.getMonth(),r.getDate()-13),h=Array.from({length:14},(v,x)=>({date:R(new Date(c.getTime()+x*Zt+12*36e5)),opened:0,closed:0})),u=new Map(h.map(v=>[v.date,v]));for(const v of[...d.items,...e.items]){const x=u.get(R(new Date(v.created_at)));x&&(x.opened+=1);const _=v.closed_at?u.get(R(new Date(v.closed_at))):void 0;_&&(_.closed+=1)}const y=v=>l.reduce((x,_)=>x+_[v],0);return{period:a,days:n,since:new Date(o).toISOString(),now:r.toISOString(),department_id:t.department_id??null,throughput:{rows:l,total:{done:y("done"),closed:y("closed"),returned:y("returned"),median_seconds:null}},daily:{days:h,net:h.reduce((v,x)=>v+x.opened-x.closed,0),since:c.toISOString()},approvals:{quotes:{count:0,items:[]},claims:{count:0,items:[]},second:{count:0,items:[]}},rfqs:{count:0,decide:0,questions:0,items:[]},departments:null,all_departments:!1,truncated:!1}},async payments(t){return{schedule_on:!1,today:R(new Date),department_id:t.department_id??null,overdue:{count:0,items:[]},upcoming:{count:0,tomorrow:0,items:[]},claims:{count:0,items:[]}}}};function Z(){return st()?Jt:Xt}var ts=Object.defineProperty,ss=Object.getOwnPropertyDescriptor,w=(t,a,n,r)=>{for(var e=r>1?void 0:r?ss(a,n):a,d=t.length-1,o;d>=0;d--)(o=t[d])&&(e=(r?o(a,n,e):o(e))||e);return r&&e&&ts(a,n,e),e};const as=6e4,es=6e5,ns=12,is=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/,rs="sw.tickets.overview.kpis.",X=t=>{try{return globalThis.localStorage.getItem(t)}catch{return null}},tt=(t,a)=>{try{globalThis.localStorage.setItem(t,a)}catch{}};let f=class extends at{constructor(){super(...arguments),this.bubbleSkin=new et(this),this.route=null,this.screen="loading",this.module=null,this.meta=null,this.data=null,this.dept="",this.rfqs=null,this.rfqFailed=!1,this.details=new Map,this.vendorIds=new Set,this.handled=null,this.approval=null,this.reason="",this.folded=nt(X(K),window.matchMedia("(max-width: 767px)").matches),this.allOverdue=!1,this.offline=!1,this.lastOk=null,this.now=new Date,this.phone=window.matchMedia("(max-width: 767px)").matches,this.compactHeader=!1,this.yesterday=null,this.summary=null,this.summaryFailed=!1,this.period=null,this.expanded=new Set,this.payments=null,this.paymentsFailed=!1,this.seq=0,this.sumSeq=0,this.slowAt=0,this.slowKey="",this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offNames=null,this.offMe=null,this.pushAt=0,this.live=new it(()=>{this.now=new Date,this.screen==="ready"&&this.load(!0)},as),this.onOnline=()=>{this.screen==="ready"&&this.load(!0)},this.onScroll=()=>{const t=this.scrollTop>40;t!==this.compactHeader&&(this.compactHeader=t)},this.retryPayments=()=>{this.paymentsFailed=!1,this.loadPayments()},this.retrySummary=()=>{this.summaryFailed=!1,this.loadSummary(!1)},this.retrySlow=()=>{this.slowAt=0,this.loadSlow()}}connectedCallback(){super.connectedCallback(),rt(this),this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offNames=ot(()=>this.requestUpdate()),this.offMe=dt(t=>{if(t.type!=="notification"||this.screen!=="ready")return;const a=Date.now();a-this.pushAt<5e3||(this.pushAt=a,this.load(!0))}),window.addEventListener("online",this.onOnline),this.live.start(),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),window.removeEventListener("online",this.onOnline),this.offNames?.(),this.offMe?.(),this.live.stop()}willUpdate(t){if(t.has("route")&&this.route){const a=this.route.params.get("dept")??"",n=is.test(a)?a:"";n!==this.dept&&(this.dept=n,this.reason="",this.allOverdue=!1,this.summary=null,this.summaryFailed=!1,this.screen==="ready"&&this.load(!1))}}updated(){lt(this.renderRoot,this.phone)}settings(){return ct({...this.module?.ui??{},...this.data?.ui??{}})}async boot(){try{const t=await L().module();if(this.module=t,pt(t.name),!t.enabled){this.screen="off";return}this.meta=await L().meta().catch(()=>null),mt().contacts({kind:"vendor"}).then(a=>this.vendorIds=new Set(a.contacts.map(n=>n.id))).catch(()=>{}),await this.load(!1)}catch(t){this.fail(t)}}fail(t){t instanceof k&&t.status===403?this.screen="forbidden":t instanceof k&&t.status===404&&t.body.code==="feature_disabled"?this.screen="off":this.screen="error"}async load(t){const a=++this.seq;!t&&!this.data&&(this.screen="loading");try{const n=await q().board({department_id:this.dept||void 0});if(a!==this.seq)return;this.data=n,this.now=new Date,this.lastOk=this.now,this.offline=!1,this.screen="ready",this.rememberKpis(),this.loadSummary(t);const r=this.dept;(!t||r!==this.slowKey||Date.now()-this.slowAt>=es)&&(this.slowKey=r,this.slowAt=Date.now(),this.loadSlow())}catch(n){if(a!==this.seq)return;if(this.data&&!(n instanceof k)){this.offline=!0;return}if(t&&this.data&&n instanceof k&&n.status>=500)return;this.fail(n)}}async loadSlow(){const t=this.dept||void 0,a=ht();Promise.all(["open","awarded","ordered"].map(e=>a.list({state:e,department_id:t,limit:100}))).then(async e=>{if(this.slowKey!==(t??""))return;const d=e.flatMap(c=>c.items);this.rfqs=d,this.rfqFailed=!1;const o=d.filter(c=>c.state==="awarded"||c.state==="ordered").slice(0,ns),m=await Promise.all(o.map(c=>a.get(c.id).catch(()=>null))),l=new Map;for(const c of m)c&&l.set(c.id,c);this.details=l}).catch(e=>{e instanceof k&&(e.status===403||e.status===404)?(this.rfqs=[],this.rfqFailed=!1):this.rfqFailed=!0});const r=E();q().handlerLoad(r??void 0).then(e=>{const d=B(e.days)??H;this.handled={days:d,counts:e.handled}}).catch(()=>this.handled=null),A("tickets.costs.view")?ut().accountClaims({status:["submitted"],...t?{department:t}:{}}).then(e=>this.approval=e.rows.length).catch(()=>this.approval=null):this.approval=null,this.loadPayments()}mayPay(){return A("tickets.costs.view")&&A("tickets.costs")}async loadPayments(){if(!this.mayPay()){this.payments=null,this.paymentsFailed=!1;return}const t=this.dept;try{const a=await Z().payments({department_id:t||void 0});if(t!==this.dept)return;this.payments=a,this.paymentsFailed=!1,this.data&&this.rememberKpis()}catch(a){if(t!==this.dept)return;a instanceof k&&a.status===403?(this.payments=null,this.paymentsFailed=!1):this.payments||(this.paymentsFailed=!0)}}allOverdueRows(){const t=this.data,a=vt(t.items,this.rfqs??[],this.now);return this.payments?.overdue.items.length?[...a,...ft(this.payments.overdue.items,this.now)].sort((n,r)=>+(r.tone==="bad")-+(n.tone==="bad")||r.late-n.late):a}chosenPeriod(){return this.period??wt(E()??gt(this.module?.ui))}async loadSummary(t){const a=++this.sumSeq,n=this.dept,r=this.chosenPeriod();try{const e=await Z().summary({department_id:n||void 0,period:r});if(a!==this.sumSeq)return;this.summary=e,this.summaryFailed=!1,this.data&&this.rememberKpis()}catch{if(a!==this.sumSeq||t&&this.summary&&this.summary.department_id===(n||null))return;this.summary=null,this.summaryFailed=!0}}setPeriod(t){t===this.chosenPeriod()&&this.summary?.period===t||(this.period=t,$t(I(t)),this.loadSummary(!1),q().handlerLoad(I(t)).then(a=>this.handled={days:B(a.days)??H,counts:a.handled}).catch(()=>this.handled=null))}kpis(){const t=this.data,a=this.summary?O(this.summary.approvals):this.approval;return{open:t.counts.all,stuck:t.counts.stuck,waiting:t.counts.waiting,overdue:this.allOverdueRows().length,approval:a}}rememberKpis(){const t=`${rs}${this.dept||"all"}`,{store:a,yesterday:n}=bt(xt(X(t)),this.kpis(),yt(this.now));tt(t,JSON.stringify(a)),this.yesterday=n}toggleFold(t){const a=new Set(this.folded);a.has(t)?a.delete(t):a.add(t),this.folded=a,tt(K,JSON.stringify([...a]))}setDept(t){kt("/tickets/overview",t?new URLSearchParams({dept:t}):void 0),this.dept=t,this.reason="",this.allOverdue=!1,this.summary=null,this.summaryFailed=!1,this.payments=null,this.paymentsFailed=!1,this.expanded=new Set,this.load(!1)}href(t={},a){return zt({dept:this.dept,...t},a?{t:a}:{})}widget(t,a,n,r,e={}){const d=this.folded.has(t);return i`<section class=${`glass w ${e.cls??""}${d?" folded":""}`} data-widget=${t} id=${`w-${t}`}>
      <header><h2>${a}${e.badge??p}</h2>${n?i`<span class="q">${n}</span>`:p}${e.extra&&!d?e.extra:p}
        <button type="button" class="fold" data-fold=${t} aria-expanded=${String(!d)} aria-label=${s(d?"unfold":"fold",{name:a})} @click=${()=>this.toggleFold(t)}>${$("chevronDown")}</button></header>
      ${r}
    </section>`}quiet(t){return i`<div class="body"><div class="quiet" data-quiet>${$("check")}${t}</div></div>`}skeleton(t,a){return i`<div class="skel" aria-busy="true">${Array.from({length:t},()=>i`<span class="skl" style=${`block-size:${a}px`}></span>`)}</div>`}header(){const t=this.data,a=t?.departments??[],n=!!t?.all_departments,r=a.reduce((e,d)=>e+d.count,0);return i`<header class=${`dh${this.compactHeader?" compact":""}`} data-overview-header>
      ${this.offline&&this.lastOk?i`<div class="offline-top" role="status" data-offline>${$("offline")}${s("offline",{time:j(this.lastOk)})}</div>`:p}
      <div class="dh-row"><div class="titles"><div class="crumbs">${Q("area")}</div><h1 data-overview-title>${s("title")}</h1></div></div>
      ${this.screen==="ready"||this.screen==="loading"?i`<div class="dh-det">
        ${a.length>1?i`<div class="seg sm depts" role="radiogroup" aria-label=${s("deptGroup")} data-dept-chips>
          <button type="button" role="radio" aria-checked=${String(!this.dept)} data-dept="" @click=${()=>this.setDept("")}>${s(n?"allDepts":"allMyDepts")}<small>${r}</small></button>
          ${a.map(e=>i`<button type="button" role="radio" aria-checked=${String(this.dept===e.id)} data-dept=${e.id} @click=${()=>this.setDept(e.id)}>${b(e.name)}<small>${e.count}</small></button>`)}
        </div>`:p}
        ${this.lastOk?i`<span class="amb" data-updated>${s("updated",{when:""}).trim()} <em>${this.now.getTime()-this.lastOk.getTime()<6e4?s("justNow"):St(this.lastOk.toISOString(),this.now)}</em></span>`:p}
        <span class="grow"></span>
        <a class="btn sm hide-ph" href=${this.href()} data-to-board>${$("ticket")}${s("toBoard")}</a>
      </div>`:p}
    </header>`}kpiRow(){if(this.screen==="loading"||!this.data)return i`<div class="kpis" aria-busy="true">${Array.from({length:5},()=>i`<span class="skl" style="block-size:76px;border-radius:14px"></span>`)}</div>`;const t=this.kpis(),a=qt(t,this.yesterday),n=this.data.truncated,r=(e,d,o,m,l,c=!1,h="overdue")=>{const u=a[e],y=i`<small>${s(d)}</small><b>${c&&l?i`<span class="least" data-at-least>${s("atLeast",{n:""}).trim()}</span>`:p}<span class="n">${l}</span>${u?i`<span class=${`d ${u>0?"up":"down"}`} title=${s(u>0?"yesterdayUp":"yesterdayDown",{n:Math.abs(u)})} data-delta=${u}>${$(u>0?"up":"down")}<span class="n">${Math.abs(u)}</span><span class="vh">${s(u>0?"yesterdayUp":"yesterdayDown",{n:Math.abs(u)})}</span></span>`:p}</b>`,v=`kpi ${l?o:""}`;return m?i`<a class=${v} href=${m} data-kpi=${e}>${y}</a>`:i`<button type="button" class=${v} data-kpi=${e} @click=${()=>this.reveal(h)}>${y}</button>`};return i`<div class="kpis" data-kpis>
      ${r("open","kOpen","",this.href(),t.open)}
      ${r("stuck","kStuck","warn",this.href({state:"stuck"}),t.stuck)}
      ${r("waiting","kWaiting","",this.href({state:"waiting"}),t.waiting)}
      ${r("overdue","kOverdue","bad",null,t.overdue,n)}
      ${t.approval!==null?this.summary?r("approval","kApproval","",null,t.approval,!1,"approvals"):r("approval","kApproval","","#/tickets/accounts",t.approval):p}
    </div>`}reveal(t){this.folded.has(t)&&this.toggleFold(t),this.updateComplete.then(()=>this.renderRoot.querySelector(`#w-${t}`)?.scrollIntoView({block:"start",behavior:"smooth"}))}whereStuck(){const t=this.data;if(!t.counts.stuck&&!t.items.some(o=>o.stuck))return this.quiet(s("stNone"));const a=_t(t.items),n=Object.values(a).reduce((o,m)=>o+m,0),r=Ot(t.items,t.tree,this.reason),e=Math.max(1,...r.map(o=>o.count)),d={unopened:"bad",overdue:"bad",ack:"warn",stuck:"warn",waiting:"acc",unassigned:""};return i`<div class="body">
      <div class="rooms" role="group" aria-label=${s("stReasons")} data-reasons>
        <button type="button" class="rc" aria-pressed=${String(!this.reason)} data-reason="" @click=${()=>this.reason=""}>${s("stAll")}<small>${n}</small></button>
        ${C.filter(o=>a[o]).map(o=>i`<button type="button" class="rc" aria-pressed=${String(this.reason===o)} data-reason=${o} @click=${()=>this.reason=this.reason===o?"":o}>${s(`rs_${o}`)}<small>${a[o]}</small></button>`)}
      </div>
      <div class="tree" role="list" aria-label=${s("stTree")} data-places>
        ${r.map(o=>i`<div class="place" role="listitem" data-place=${o.key}>
            <a class=${`row l${o.level}`} href=${this.href({state:"stuck",place:o.key})}><span class="nm">${o.kind==="none"?s("noPlace"):b(o.name)}</span><span class="n">${o.count}</span></a>
            <div class="track" aria-hidden="true"><span style=${`inline-size:${Math.round(o.count/e*100)}%`}></span></div>
            <span class="mut">${o.level===0&&o.open?s("stOfOpen",{n:o.open}):""}</span>
          </div>
          ${o.level===0&&!this.reason?i`<div class="why" data-why=${o.key}>${C.filter(m=>o.why[m]).map(m=>i`<span><i class=${`dot ${d[m]}`}></i>${s(`rs_${m}`)} <span class="n">${o.why[m]}</span></span>`)}</div>`:p}`)}
      </div>
    </div>`}handlerList(t){const a=this.handled?.days;return i`<div class="crows">${t.map(n=>{const r=n.name.split(/\s+/).filter(Boolean).slice(0,2).map(e=>e[0]).join("");return i`<a class="crow" href=${this.href({assignee:n.key})} data-handler=${n.key} ?data-busy=${n.busy}>
        <span class=${`av${n.vendor?" ext":""}`} aria-hidden="true">${r}</span>
        <span class="nm"><b>${b(n.name)}${n.vendor&&this.settings().vendors==="tagged"?i`<span class="chip pur xs" data-vendor-tag>${s("ldVendor")}</span>`:p}${n.busy?i`<span class="chip warn xs" data-busy-tag>${s("ldBusy")}</span>`:p}</b>
          <small>${n.open?s("ldOldest",{age:z(this.now.getTime()-Date.parse(n.oldestAt??""))}):s("ldFree")}</small></span>
        <span class="st">
          <span class="cell"><span class="n">${n.open}</span><small>${s("ldOpen")}</small></span>
          <span class=${`cell${n.waiting?" warn":""}`}><span class="n">${n.waiting}</span><small>${s("ldWaiting")}</small></span>
          <span class=${`cell${n.stuck?" bad":""}`}><span class="n">${n.stuck}</span><small>${s("ldStuck")}</small></span>
          ${a&&n.handled!==void 0?i`<span class="cell" data-handled><span class="n">${n.handled}</span><small>${s("ldHandled")}</small></span>`:p}
        </span>
        <span class="ldc"><span class="load" role="img" aria-label=${s("ldMeter",{on:n.meter,total:F})}>${Array.from({length:F},(e,d)=>i`<i class=${d<n.meter?n.busy?"hot":"on":""}></i>`)}</span><small>${n.meter}/${F}</small></span>
      </a>`})}</div>`}loadCard(){const t=this.data,a=this.settings(),n=Dt(t.items,this.vendorIds,a,this.handled?.counts??null),r=n.filter(l=>l.busy).length;if(!n.length)return{body:this.quiet(s("ldNone")),busy:r};const{staff:e,vendors:d}=Pt(n,a.vendors),o=this.handled?.days,m=i`<div class="hhead" aria-hidden="true"><span></span><span></span><span class="st"><span>${s("ldOpen")}</span><span>${s("ldWaiting")}</span><span>${s("ldStuck")}</span>${o?i`<span>${s("ldHandled")} · ${Tt(`hd_${o}`)}</span>`:p}</span><span class="ldc">${s("ldLoad")}</span></div>`;return{busy:r,body:i`<div class="body" data-load-mode=${a.vendors}>
        ${m}
        ${a.vendors==="separate"?i`<div class="sect"><h4>${s("ldStaff")} <span class="n">· ${e.length}</span></h4>${this.handlerList(e)}</div>
          ${d.length?i`<div class="sect" data-vendor-list><h4>${s("ldVendors")} <span class="n">· ${d.length}</span></h4>${this.handlerList(d)}</div>`:p}`:this.handlerList(e)}
      </div>`}}whoWaits(){const t=this.data,a=Rt(t.items,this.vendorIds);if(!a.some(e=>e.count))return this.quiet(s("wwNone"));const n={me:{label:"wwMe",icon:"user",cls:"me",href:this.href({state:"waiting"})},staff:{label:"wwStaff",icon:"users",cls:"",href:this.href()},vendors:{label:"wwVendors",icon:"truck",cls:"ext",href:this.href()}},r=(e,d)=>e==="me"?Ht(d):C.includes(d)?s(`rs_${d}`):"";return i`<div class="body"><div class="lanes">${a.filter(e=>e.count||e.id==="me").map(e=>{const d=n[e.id],o=e.reasons.map(m=>({t:r(e.id,m.key),n:m.n})).filter(m=>m.t);return i`<a class="blk lane" href=${d.href} data-lane=${e.id}><span class=${`bi ${d.cls}`}>${$(d.icon)}</span>
        <span class="bt"><b>${s(d.label)}${e.oldestAt?i`<span class="mut">${s("wwOldest",{age:z(this.now.getTime()-Date.parse(e.oldestAt))})}</span>`:p}</b>
          ${o.length?i`<small>${o.map((m,l)=>i`${l?i`<span aria-hidden="true">·</span>`:p}<span>${m.t} · <span class="n">${m.n}</span></span>`)}</small>`:p}</span>
        <span class="big"><span class="n">${e.count}</span></span></a>`})}</div></div>`}overdueCard(){const t=this.data,a=this.allOverdueRows();if(!a.length)return{body:this.quiet(s("odNone")),count:0};const n=this.allOverdue?a:a.slice(0,D),r={sla:"odSla",eta:"odEta",rfq:"odRfq",pay:"odPay"};return{count:a.length,body:i`<div class="body"><div class="closedrows" data-overdue>${n.map(e=>i`<a class="cr" href=${e.rfq?S({id:e.id}):this.href({},e.id)} data-overdue-row=${e.kind}>
          <span class="num">${e.ref}</span><b>${b(e.title)}<small><span class=${`cwarn ${e.tone}`}>${$("clock")}${s("odBy",{what:s(r[e.kind]),dur:z(e.late)})}</span></small></b>
          <span class="who">${e.who?b(e.who):s("odNobody")}</span><span class="back">${$("back")}</span></a>`)}</div>
        ${a.length>D?i`<div><button type="button" class="btn sm" aria-expanded=${String(this.allOverdue)} data-overdue-all @click=${()=>this.allOverdue=!this.allOverdue}>${this.allOverdue?s("showLess"):s("showAll")}<small class="mut">· ${a.length}</small></button></div>`:p}
        ${t.truncated?i`<div class="note" data-truncated>${s("truncated",{n:t.items.length})}</div>`:p}
      </div>`}}agendaCard(){const t=this.data,a=this.payments?At(this.payments.upcoming.items):Ct([...this.details.values()]),n=Ft(t.items,this.rfqs??[],this.details,a,this.vendorIds,this.now),r={visit_vendor:"agVisitVendor",visit_staff:"agVisitStaff",work_start:"agWorkStart",rfq_due:"agRfqDue",payment:"agPayment"},e={visit_vendor:"acc",visit_staff:"acc",work_start:"ok",rfq_due:"pur",payment:"warn"},d=(m,l)=>{const[c,h,u]=m.split("-").map(Number),y=new Date(c,h-1,u).toLocaleDateString([],{weekday:"long",day:"numeric",month:"numeric"});return l===0?`${s("agToday")} · ${y}`:l===1?`${s("agTomorrow")} · ${y}`:y},o=this.rfqFailed?i`<div class="unavail" data-partial>${s("agRfqPartial")}<button type="button" class="btn sm" @click=${this.retrySlow}>${$("refresh")}${s("retry")}</button></div>`:p;return n.length?i`<div class="body" data-agenda>${o}${n.map(m=>i`<div class="sect day" data-day=${m.key}><h4><span class=${m.offset===0?"today":""}>${d(m.key,m.offset)}</span></h4>
      <div class="closedrows">${m.entries.map(l=>i`<a class="cr" href=${l.rfq?S({id:l.id}):this.href({},l.id)} data-agenda-row=${l.kind}>
        <span class="num">${l.timed?j(new Date(l.at)):s("agAllDay")}</span>
        <b><i class=${`dot ${e[l.kind]}`}></i> ${s(r[l.kind])}<small>${[l.who,`${l.ref} · ${l.title}`,l.place].filter(Boolean).map(c=>b(c)).join(" · ")}</small></b>
        <span></span><span class="back">${$("back")}</span></a>`)}</div></div>`)}</div>`:i`${o}${this.quiet(s("agNone"))}`}summaryPending(t,a){return this.summaryFailed?i`<div class="body"><div class="unavail" data-unavailable>${s("unavailable")}<button type="button" class="btn sm" data-retry-summary @click=${this.retrySummary}>${$("refresh")}${s("retry")}</button></div></div>`:this.summary?null:this.skeleton(t,a)}moreButton(t,a){const n=this.expanded.has(t),r=()=>{const e=new Set(this.expanded);n?e.delete(t):e.add(t),this.expanded=e};return i`<div><button type="button" class="btn sm" aria-expanded=${String(n)} data-more=${t} @click=${r}>${n?s("showLess"):s("showAll")}<small class="mut">· ${a}</small></button></div>`}sinceText(t){const a=t?Date.parse(t):NaN;return Number.isNaN(a)?"":s("apWaits",{age:z(this.now.getTime()-a)})}periodSeg(){const t=this.chosenPeriod();return i`<div class="seg sm pseg" role="radiogroup" aria-label=${s("thPeriod")} data-period-seg>${Yt.map(a=>i`<button type="button" role="radio" aria-checked=${String(t===a)} data-period=${a} @click=${()=>this.setPeriod(a)}>${s(`pd_${a}`)}</button>`)}</div>`}throughputCard(){const t=this.summaryPending(4,40);if(t)return t;const a=this.summary;if(a.period!==this.chosenPeriod())return this.skeleton(4,40);const n=a.throughput.rows;if(!n.length)return this.quiet(s("thNone"));const r=o=>o===null?"-":z(o*1e3),e=o=>o?b(o):"-",d=a.throughput.total;return i`<div class="body" data-throughput=${a.period}>
      <table class="rtbl tp"><thead><tr><th>${s("thHandler")}</th><th class="num">${s("thDone")}</th><th class="num">${s("thClosed")}</th><th class="num">${s("thReturned")}</th><th class="num">${s("thMedian")}</th></tr></thead>
        <tbody>${n.map(o=>i`<tr data-tp-row=${o.key}><td class="who">${e(o.name)}</td><td class="num"><span class="n">${o.done}</span></td><td class="num"><span class="n">${o.closed}</span></td><td class="num"><span class="n">${o.returned}</span></td><td class="num mut">${r(o.median_seconds)}</td></tr>`)}</tbody>
        <tfoot><tr data-tp-total><td>${s("thTotal")}</td><td class="num"><span class="n">${d.done}</span></td><td class="num"><span class="n">${d.closed}</span></td><td class="num"><span class="n">${d.returned}</span></td><td class="num mut">${r(d.median_seconds)}</td></tr></tfoot></table>
      <div class="dcards">${n.map(o=>i`<div class="dcard" data-tp-card=${o.key}><b>${e(o.name)}</b><span class="nums"><span>${s("thDone")} <em>${o.done}</em></span><span>${s("thClosed")} <em>${o.closed}</em></span><span>${s("thReturned")} <em>${o.returned}</em></span><span>${s("thMedian")} <em>${r(o.median_seconds)}</em></span></span></div>`)}
        <div class="dcard total"><b>${s("thTotal")}</b><span class="nums"><span>${s("thDone")} <em>${d.done}</em></span><span>${s("thClosed")} <em>${d.closed}</em></span><span>${s("thReturned")} <em>${d.returned}</em></span></span></div></div>
    </div>`}dailyCard(){const t=this.summaryPending(1,150);if(t)return t;const a=this.summary.daily.days,n=W(a);if(!n.opened&&!n.closed)return this.quiet(s("dyNone"));const r=420,e=110,d=14,o=9,m=(r-d*2)/Math.max(1,a.length),l=a.map((c,h)=>{const u=d+h*m+m/2,y=c.opened/n.max*e,v=c.closed/n.max*e;return P`<rect x=${u-o-1} y=${e-y} width=${o} height=${y} rx="2.5" class="bo"></rect><rect x=${u+1} y=${e-v} width=${o} height=${v} rx="2.5" class="bc"></rect>
        ${c.opened?P`<text x=${u-o/2-1} y=${e-y-3} class="bl">${c.opened}</text>`:p}${c.closed?P`<text x=${u+o/2+1} y=${e-v-3} class="bl">${c.closed}</text>`:p}
        ${h%2===a.length%2?P`<text x=${u} y=${e+12} class="ax">${U(c.date)}</text>`:p}`});return i`<div class="body" data-daily>
      <div class="net" data-net=${n.net}>${s("dyNetLabel",{n:V(n.net)})} · ${s("dyOpened")} <span class="n">${n.opened}</span> · ${s("dyClosed")} <span class="n">${n.closed}</span></div>
      <div class="bars" aria-hidden="true"><svg viewBox=${`0 0 ${r} ${e+16}`}><line x1=${d} x2=${r-d} y1=${e+.5} y2=${e+.5} class="base"></line>${l}</svg>
        <div class="lg"><span><i class="o"></i>${s("dyOpened")}</span><span><i class="c"></i>${s("dyClosed")}</span></div></div>
      <table class="vh" data-daily-table><caption>${s("dyChart")}</caption><thead><tr><th>${s("dyDay")}</th><th>${s("dyOpened")}</th><th>${s("dyClosed")}</th></tr></thead>
        <tbody>${a.map(c=>i`<tr><td>${U(c.date)}</td><td>${c.opened}</td><td>${c.closed}</td></tr>`)}</tbody></table>
    </div>`}approvalsCard(){const t=this.summaryPending(4,44);if(t)return t;const a=this.summary.approvals;if(!O(a))return this.quiet(s("apNone"));const n=this.expanded.has("approvals"),r=G(),e=c=>c.amount_minor!==null&&c.currency?i`<span class="amt n" data-amount>${Y(c.amount_minor,c.currency,r)}</span>`:i`<span></span>`,d=(c,h)=>i`<a class="cr ap" href=${`${this.href({},h.ticket.id)}&tab=costs`} data-approval-row=${c}>
      <span class="num">#${h.ticket.number}</span><b>${b(h.ticket.title)}<small>${[h.vendor?b(h.vendor):"",this.sinceText(h.since)].filter(Boolean).join(" · ")}</small></b>${e(h)}<span class="back">${$("back")}</span></a>`,o=c=>i`<a class="cr ap" href=${S({id:c.rfq.id})} data-approval-row="second">
      <span class="num">${c.rfq.ref}</span><b>${b(c.rfq.title)}<small>${[c.vendor?b(c.vendor):"",this.sinceText(c.since)].filter(Boolean).join(" · ")}</small></b>${e(c)}<span class="back">${$("back")}</span></a>`,m=(c,h,u,y)=>u.count?i`<div class="sect" data-approvals=${c}>
      <h4>${h} <span class="n">· ${u.count}</span></h4>
      <div class="closedrows">${(n?u.items:u.items.slice(0,T)).map(y)}</div>
      ${n&&u.count>u.items.length?i`<div class="note" data-truncated>${s("truncated",{n:u.items.length})}</div>`:p}</div>`:p,l=[a.quotes,a.claims,a.second].some(c=>c.count>T);return i`<div class="body">
      ${m("quotes",s("apQuotes"),a.quotes,c=>d("quote",c))}
      ${m("claims",s("apClaims"),a.claims,c=>d("claim",c))}
      ${m("second",s("apSecond"),a.second,o)}
      ${l?this.moreButton("approvals",O(a)??0):p}
    </div>`}paymentsCard(){if(!this.payments)return this.paymentsFailed?i`<div class="body"><div class="unavail" data-unavailable>${s("unavailable")}<button type="button" class="btn sm" data-retry-payments @click=${this.retryPayments}>${$("refresh")}${s("retry")}</button></div></div>`:this.skeleton(3,44);const t=this.payments;if(!N(t))return this.quiet(s("pyNone"));const a=this.expanded.has("payments"),n=G(),r=(l,c)=>l!==null&&c?i`<span class="amt n" data-amount>${Y(l,c,n)}</span>`:i`<span></span>`,e=l=>{const c=Kt(l.days),h=l.days<0?l.days<=-2?"bad":"warn":l.days<=1?"warn":"info";return i`<a class="cr ap" href=${S({id:l.rfq.id})} data-pay-row="instalment" data-days=${l.days}>
        <span class="num">${l.rfq.ref}</span><b>${b(l.rfq.title)}<small>${[l.vendor?b(l.vendor):"",s(`pyKind_${l.instalment_kind}`),s(l.demand==="open"?"pyDemandOpen":"pyDemandNone")].filter(Boolean).join(" · ")}</small></b>
        <span class="tags"><span class=${`chip xs ${h}`} data-when>${$("clock")}${s(c.key,{n:c.n})}</span>${r(l.amount_minor,l.currency)}</span>
        <span class="back">${$("back")}</span></a>`},d=l=>i`<a class="cr ap" href=${`${this.href({},l.ticket.id)}&tab=costs`} data-pay-row="claim">
      <span class="num">#${l.ticket.number}</span><b>${b(l.ticket.title)}<small>${[l.vendor?b(l.vendor):"",l.since?s("pyApproved",{age:z(this.now.getTime()-Date.parse(l.since))}):""].filter(Boolean).join(" · ")}</small></b>
      ${r(l.amount_minor,l.currency)}<span class="back">${$("back")}</span></a>`,o=(l,c,h,u)=>h.count?i`<div class="sect" data-payments=${l}>
      <h4>${c} <span class="n">· ${h.count}</span></h4>
      <div class="closedrows">${(a?h.items:h.items.slice(0,T)).map(u)}</div>
      ${a&&h.count>h.items.length?i`<div class="note" data-truncated>${s("truncated",{n:h.items.length})}</div>`:p}</div>`:p,m=[t.overdue,t.upcoming,t.claims].some(l=>l.count>T);return i`<div class="body">
      ${o("overdue",s("pyOverdue"),t.overdue,e)}
      ${o("upcoming",s("pyUpcoming"),t.upcoming,e)}
      ${o("claims",s("pyClaims"),t.claims,d)}
      ${m?this.moreButton("payments",N(t)):p}
    </div>`}rfqsCard(){const t=this.summaryPending(4,44);if(t)return t;const a=this.summary.rfqs;if(!a.items.length)return this.quiet(s("rqNone"));const n=this.expanded.has("rfqs"),r=n?a.items:a.items.slice(0,D),e=d=>d?It(new Date(d)):"";return i`<div class="body"><div class="closedrows" data-rfqs>${r.map(d=>{const o=Nt(d);return i`<a class="cr rq" href=${S({id:d.id})} data-rfq-row=${d.stage}>
        <span class="num">${d.ref}</span><b>${b(d.title)}${d.due_at?i`<small>${s("rqDue",{date:e(d.due_at)})}</small>`:p}</b>
        <span class="tags"><span class=${`chip xs ${o.tone}`} data-stage>${s(o.text,{quoted:d.quoted,invited:d.invited})}</span>${d.questions?i`<span class="chip warn xs" data-question>${$("note")}${d.questions>1?s("rqQuestions",{n:d.questions}):s("rqQuestion")}</span>`:p}</span>
        <span class="back">${$("back")}</span></a>`})}</div>
      ${a.items.length>D?this.moreButton("rfqs",a.count):p}
      ${n&&a.count>a.items.length?i`<div class="note" data-truncated>${s("truncated",{n:a.items.length})}</div>`:p}
    </div>`}departmentsCard(){const t=this.summaryPending(3,40);if(t)return t;const a=Mt(this.summary?.departments??[]);if(!this.summary?.departments)return this.departmentsFromBoard();const n=e=>`#/tickets/overview?${new URLSearchParams({dept:e}).toString()}`,r=e=>e>2?" bad":"";return i`<div class="body" data-compare="summary">
      <table class="rtbl"><thead><tr><th>${s("cmpDept")}</th><th class="num">${s("cmpOpen")}</th><th class="num">${s("cmpStuck")}</th><th class="num">${s("cmpOverdue")}</th><th class="num">${s("cmpDecide")}</th><th class="num">${s("cmpDone7")}</th><th class="num">${s("cmpBusy")}</th></tr></thead>
        <tbody>${a.map(e=>i`<tr data-dept-row=${e.id}><td><a class="tl" href=${n(e.id)}>${b(e.name)}</a></td><td class="num"><span class="n">${e.open}</span></td><td class=${`num${r(e.stuck)}`}><span class="n">${e.stuck}</span></td><td class=${`num${r(e.overdue)}`}><span class="n">${e.overdue}</span></td><td class="num"><span class="n">${e.waiting}</span></td><td class="num"><span class="n">${e.done_7d}</span></td><td class="num"><span class="n">${e.busy_handlers}</span></td></tr>`)}</tbody></table>
      <div class="dcards">${a.map(e=>i`<a class="dcard" href=${n(e.id)} data-dept-card=${e.id}><b>${b(e.name)}</b><span class="nums"><span>${s("cmpOpen")} <em>${e.open}</em></span><span>${s("cmpStuck")} <em>${e.stuck}</em></span><span>${s("cmpOverdue")} <em>${e.overdue}</em></span><span>${s("cmpDecide")} <em>${e.waiting}</em></span><span>${s("cmpDone7")} <em>${e.done_7d}</em></span><span>${s("cmpBusy")} <em>${e.busy_handlers}</em></span></span></a>`)}</div>
    </div>`}departmentsFromBoard(){const t=this.data,a=Lt(t.items,t.departments,this.vendorIds,this.settings(),this.now),n=r=>`#/tickets/overview?${new URLSearchParams({dept:r}).toString()}`;return i`<div class="body" data-compare>
      <table class="rtbl"><thead><tr><th>${s("cmpDept")}</th><th class="num">${s("cmpOpen")}</th><th class="num">${s("cmpStuck")}</th><th class="num">${s("cmpOverdue")}</th><th class="num">${s("cmpWaiting")}</th><th class="num">${s("cmpBusy")}</th></tr></thead>
        <tbody>${a.map(r=>i`<tr data-dept-row=${r.id}><td><a class="tl" href=${n(r.id)}>${b(r.name)}</a></td><td class="num"><span class="n">${r.open}</span></td><td class=${`num${r.stuck>2?" bad":""}`}><span class="n">${r.stuck}</span></td><td class=${`num${r.overdue>2?" bad":""}`}><span class="n">${r.overdue}</span></td><td class="num"><span class="n">${r.waiting}</span></td><td class="num"><span class="n">${r.busy}</span></td></tr>`)}</tbody></table>
      <div class="dcards">${a.map(r=>i`<a class="dcard" href=${n(r.id)} data-dept-card=${r.id}><b>${b(r.name)}</b><span class="nums"><span>${s("cmpOpen")} <em>${r.open}</em></span><span>${s("cmpStuck")} <em>${r.stuck}</em></span><span>${s("cmpOverdue")} <em>${r.overdue}</em></span><span>${s("cmpWaiting")} <em>${r.waiting}</em></span><span>${s("cmpBusy")} <em>${r.busy}</em></span></span></a>`)}</div>
    </div>`}stateBox(t,a,n,r){return i`<div class="statebox glass" role="status" data-overview-state=${n}><span class="ring">${$(t)}</span><b>${a}</b>${r??p}</div>`}loadingGrid(){const t=(a,n,r)=>i`<section class=${`glass w ${a}`}><header><span class="skl" style="block-size:20px;inline-size:40%"></span></header>${this.skeleton(n,r)}</section>`;return i`<div class="wgrid" data-overview-state="loading">${t("wide",5,40)}${t("",3,56)}${t("wide",5,52)}${t("",4,44)}${t("",4,44)}${t("",4,44)}${t("",4,44)}${t("wide",4,40)}${t("",1,150)}</div>`}body(){switch(this.screen){case"loading":return i`${this.kpiRow()}${this.loadingGrid()}`;case"off":return this.stateBox("ticket",Q("moduleOff"),"off");case"forbidden":return this.stateBox("lock",s("notManager"),"forbidden");case"error":return this.stateBox("warning",s("loadFailed"),"error",i`<button type="button" class="btn sm" data-retry @click=${()=>{this.screen="loading",this.data=null,this.boot()}}>${$("refresh")}${s("retry")}</button>`)}const t=this.data;if(!t.counts.all&&!t.counts.closed_all&&!t.items.length)return this.stateBox("ticket",s("emptyAll"),"empty",this.meta?.can.create?i`<a class="btn primary" href=${Et("mine",Bt,{create:!0})} data-new>${$("plus")}${s("newTicket")}</a>`:void 0);const a=this.settings(),n=t.all_departments&&!this.dept&&t.departments.length>1?this.widget("departments",s("cmpTitle"),s("cmpQ"),this.departmentsCard(),{cls:"full"}):p,r=this.loadCard(),e=this.overdueCard(),d=t.counts.stuck,o=this.summary,m=o?O(o.approvals):0,l=o?o.rfqs.count:0,c=N(this.payments),h=o?W(o.daily.days):null;return i`
      ${a.compare==="top"?i`<div class="wgrid">${n}</div>`:p}
      ${this.kpiRow()}
      <div class="wgrid">
        ${a.compare==="below_numbers"?n:p}
        ${this.widget("stuck",s("stTitle"),s("stQ"),this.whereStuck(),{cls:"wide",badge:d?i` <span class="cnt" data-count>${d}</span>`:p})}
        ${this.widget("waits",s("wwTitle"),s("wwQ"),this.whoWaits())}
        ${this.widget("load",s("ldTitle"),s("ldQ"),r.body,{cls:"wide",badge:r.busy?i` <span class="cnt bad" data-count>${s("ldBusyCount",{n:r.busy})}</span>`:p})}
        ${this.widget("overdue",s("odTitle"),s("odQ"),e.body,{badge:e.count?i` <span class="cnt bad" data-count>${e.count}</span>`:p})}
        ${this.widget("approvals",s("apTitle"),s("apQ"),this.approvalsCard(),{badge:m?i` <span class="cnt" data-count>${m}</span>`:p})}
        ${this.payments||this.paymentsFailed?this.widget("payments",s("pyTitle"),s("pyQ"),this.paymentsCard(),{badge:c?i` <span class=${`cnt${this.payments?.overdue.count?" bad":""}`} data-count>${c}</span>`:p}):p}
        ${this.widget("rfqs",s("rqTitle"),s("rqQ"),this.rfqsCard(),{badge:l?i` <span class="cnt info" data-count>${l}</span>`:p})}
        ${this.widget("upcoming",s("agTitle"),s("agQ"),this.agendaCard())}
        ${this.widget("throughput",s("thTitle"),s("thQ"),this.throughputCard(),{cls:"wide",extra:this.periodSeg()})}
        ${this.widget("daily",s("dyTitle"),s("dyQ"),this.dailyCard(),{badge:h&&(h.opened||h.closed)?i` <span class=${`cnt${h.net>0?"":" info"}`} data-count data-net-badge>${s("dyNet",{n:V(h.net)})}</span>`:p})}
        ${a.compare==="bottom"?n:p}
      </div>`}render(){return i`<div class=${`page${this.offline?" stale":""}`} data-screen="tickets-overview">
      ${this.header()}
      ${this.body()}
    </div>`}};f.styles=[jt,...Qt,Wt,Ut`
    .n { direction: ltr; unicode-bidi: isolate; display: inline-block; font-variant-numeric: tabular-nums; }
    .amb { font-size: var(--sw-fs-md); color: var(--dv-text-2); }
    .amb em { font-style: normal; color: var(--dv-text); font-weight: 600; }
    .crumbs { font-size: var(--sw-fs-sm); color: var(--dv-text-2); margin-block-end: 2px; }
    .titles { min-inline-size: 0; }
    .seg button small { font-size: var(--sw-fs-xs); color: var(--dv-text-2); font-weight: 600; font-variant-numeric: tabular-nums; margin-inline-start: 6px; }
    .offline-top { position: sticky; inset-block-start: 0; z-index: 16; margin: 0 -36px -16px; padding: 8px 36px; background: linear-gradient(var(--dv-warning-soft), var(--dv-warning-soft)), var(--dv-surface-solid); border-block-end: 1px solid color-mix(in srgb, var(--dv-warning) 38%, transparent); font-size: var(--sw-fs-sm); font-weight: 600; color: var(--au-warn-text); display: flex; align-items: center; gap: 8px; }
    /* the numbers row: the RFQ board's tiles */
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--sw-s-3); }
    .kpi { display: flex; flex-direction: column; gap: 4px; padding: 14px 18px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border); background: var(--dv-surface); -webkit-backdrop-filter: var(--dv-surface-blur); backdrop-filter: var(--dv-surface-blur); box-shadow: var(--dv-shadow-1); min-inline-size: 0; color: inherit; text-decoration: none; font: inherit; text-align: start; cursor: pointer; }
    .kpi small { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    .kpi b { font-size: var(--sw-fs-2xl); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--dv-text); overflow-wrap: anywhere; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 6px; }
    .kpi.warn b { color: var(--au-warn-text); }
    .kpi.bad b { color: var(--dv-danger); }
    .kpi .d { display: inline-flex; align-items: center; gap: 2px; font-size: var(--sw-fs-xs); font-weight: 600; color: var(--dv-text-3); font-variant-numeric: tabular-nums; }
    .kpi .d.up { color: var(--dv-danger); }
    .kpi .d.down { color: var(--au-ok-text); }
    .kpi .d .ic { font-size: var(--sw-fs-2xs); stroke-width: 2.4; }
    .kpi .least { font-size: var(--sw-fs-xs); font-weight: 600; color: var(--dv-text-3); }
    .page.stale .kpi b, .page.stale .lane .big, .page.stale .tree .n, .page.stale .cell { color: var(--dv-text-3); }
    .page.stale .load i.on, .page.stale .load i.hot { background: var(--dv-border-strong); }
    /* the widget grid and the widget card */
    .wgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--dv-gap-lg, 18px); align-items: start; }
    .w { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 14px; border-radius: var(--sw-r-2xl); min-inline-size: 0; }
    .w.wide { grid-column: span 2; }
    .w.full { grid-column: 1 / -1; }
    .w > header { display: flex; align-items: center; gap: 10px; min-inline-size: 0; }
    .w > header h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-lg); font-weight: 700; letter-spacing: -0.015em; line-height: 1.25; min-inline-size: 0; }
    .w > header .q { font-size: var(--sw-fs-sm); font-weight: 500; color: var(--dv-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
    .w > header .fold { all: unset; box-sizing: border-box; margin-inline-start: auto; display: grid; place-items: center; inline-size: 32px; block-size: 32px; border-radius: 50%; color: var(--dv-text-3); cursor: pointer; flex: none; }
    .w > header .fold:hover { background: var(--dv-surface-3); color: var(--dv-text); }
    .w > header .fold:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 2px; }
    .w > header .fold .ic { font-size: var(--sw-fs-xl); transition: transform var(--mm-motion, 200ms) var(--mm-ease, ease); }
    .w.folded > header .fold .ic { transform: rotate(90deg); }
    .w.folded > :not(header) { display: none; }
    .w .body { display: flex; flex-direction: column; gap: 10px; min-inline-size: 0; }
    .cnt { display: inline-grid; place-items: center; min-inline-size: 22px; block-size: 22px; padding-inline: 6px; box-sizing: border-box; border-radius: var(--sw-r-pill); background: var(--dv-warning-soft); color: var(--au-warn-text); font-size: var(--sw-fs-sm); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .cnt.info { background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .cnt.bad { background: var(--dv-danger-soft); color: var(--dv-danger); }
    .quiet { display: inline-flex; align-items: center; gap: 8px; min-block-size: 36px; font-size: var(--sw-fs-base); font-weight: 600; color: var(--au-ok-text); }
    .quiet .ic { font-size: var(--sw-fs-lg); }
    .unavail { display: flex; align-items: center; gap: 10px; min-block-size: 44px; font-size: var(--sw-fs-base); color: var(--dv-text-2); }
    .unavail .btn { margin-inline-start: auto; }
    .skel { display: flex; flex-direction: column; gap: 10px; }
    .mut { color: var(--dv-text-3); font-size: var(--sw-fs-sm); }
    .note { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    /* where stuck */
    .rooms { flex-wrap: wrap; }
    .rc small { display: inline-grid; place-items: center; min-inline-size: 18px; block-size: 18px; padding-inline: 5px; box-sizing: border-box; margin-inline-start: 8px; border-radius: var(--sw-r-pill); background: color-mix(in srgb, var(--dv-text) 8%, transparent); color: var(--dv-text-2); font-size: var(--sw-fs-xs); font-weight: 700; font-variant-numeric: tabular-nums; }
    .rc[aria-pressed='true'] small { background: color-mix(in srgb, currentColor 18%, transparent); color: inherit; }
    .tree { display: flex; flex-direction: column; gap: 2px; }
    .place { display: grid; grid-template-columns: minmax(0, 1fr) 110px auto; align-items: center; gap: 12px; }
    .tree .row { box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; min-block-size: 40px; padding-inline: 8px 12px; border-radius: var(--sw-r-lg); color: var(--dv-text); font-size: var(--sw-fs-base); text-decoration: none; }
    .tree .row:hover, .tree .row:focus-visible { background: color-mix(in srgb, var(--dv-text) 6%, transparent); outline: none; }
    .tree .row.l0 .nm { font-weight: 700; }
    .tree .row.l1 { padding-inline-start: 28px; color: var(--dv-text-2); }
    .tree .row.l2 { padding-inline-start: 48px; color: var(--dv-text-2); }
    .tree .row .n { color: var(--dv-accent-text); font-size: var(--sw-fs-sm); font-weight: 600; }
    .tree .row .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { display: flex; block-size: 6px; border-radius: var(--sw-r-pill); background: var(--dv-surface-3); overflow: hidden; }
    .track span { background: var(--dv-warning); }
    .why { display: flex; flex-wrap: wrap; gap: 4px 10px; padding-inline-start: 8px; margin-block: -2px 4px; font-size: var(--sw-fs-xs); color: var(--dv-text-3); }
    .why span { display: inline-flex; align-items: center; gap: 4px; }
    .dot { inline-size: 6px; block-size: 6px; border-radius: 50%; flex: none; background: var(--dv-offline); display: inline-block; }
    .dot.bad { background: var(--sw-danger); }
    .dot.warn { background: var(--sw-warning); }
    .dot.acc { background: var(--dv-accent); }
    .dot.ok { background: var(--sw-success); }
    .dot.pur { background: var(--sw-purple); }
    /* handler load */
    .crows { display: flex; flex-direction: column; }
    .crow { display: grid; grid-template-columns: auto minmax(0, 1.4fr) auto auto; gap: 12px; align-items: center; padding: 6px; min-block-size: 56px; border-block-end: 1px solid var(--dv-border); color: inherit; text-decoration: none; font-size: var(--sw-fs-md); }
    .crow:last-child { border-block-end: 0; }
    .crow:hover, .crow:focus-visible { background: var(--dv-surface-2); outline: none; }
    .crow b { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; font-weight: 700; }
    .crow .nm small { display: block; color: var(--dv-text-3); font-size: var(--sw-fs-xs); }
    .av { display: inline-grid; place-items: center; flex: none; inline-size: 36px; block-size: 36px; border-radius: 50%; font-weight: 800; font-size: var(--sw-fs-sm); background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .av.ext { color: var(--au-warn-text); background: var(--dv-warning-soft); }
    .st { display: flex; gap: 0; }
    .cell { font-size: var(--sw-fs-md); color: var(--dv-text); font-variant-numeric: tabular-nums; min-inline-size: 58px; text-align: center; }
    .cell small { display: none; font-size: var(--sw-fs-2xs); color: var(--dv-text-3); }
    .cell.bad { color: var(--dv-danger); font-weight: 700; }
    .cell.warn { color: var(--au-warn-text); font-weight: 700; }
    .ldc { min-inline-size: 70px; display: grid; justify-items: center; gap: 3px; }
    .ldc small { font-size: var(--sw-fs-2xs); color: var(--dv-text-3); }
    .load { display: inline-flex; gap: 3px; align-items: center; }
    .load i { inline-size: 14px; block-size: 6px; border-radius: var(--sw-r-pill); background: var(--dv-surface-3); }
    .load i.on { background: var(--dv-accent); }
    .load i.hot { background: var(--dv-danger); }
    .hhead { display: grid; grid-template-columns: 36px minmax(0, 1.4fr) auto auto; gap: 12px; padding-inline: 6px; font-size: var(--sw-fs-2xs); color: var(--dv-text-3); }
    .hhead .st span { min-inline-size: 58px; text-align: center; }
    .hhead .ldc { min-inline-size: 70px; text-align: center; }
    .chip.pur { background: color-mix(in srgb, var(--sw-purple) 16%, transparent); color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text)); }
    .sect { display: flex; flex-direction: column; gap: 8px; }
    .sect > h4 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); font-weight: 600; color: var(--dv-text-2); }
    .sect > h4 .today { color: var(--dv-accent-text); }
    /* who waits for whom */
    .lanes { display: grid; gap: 8px; }
    a.blk { text-decoration: none; color: inherit; }
    .lane .bt b { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-md); color: var(--dv-text); }
    .lane .bt small { display: flex; flex-wrap: wrap; gap: 2px 10px; }
    .lane .big { font-size: var(--sw-fs-2xl); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--dv-text); min-inline-size: 28px; text-align: center; }
    .lane .bi.me { background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .lane .bi.ext { background: color-mix(in srgb, var(--sw-purple) 16%, transparent); color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text)); }
    /* rows: overdue and the agenda */
    .closedrows { display: flex; flex-direction: column; padding: 4px 0; }
    .closedrows .cr { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 6px 14px; min-block-size: 44px; padding: 6px 10px; color: var(--dv-text); font-size: var(--sw-fs-base); text-align: start; text-decoration: none; border-radius: var(--sw-r-lg); }
    .closedrows .cr + .cr { border-block-start: 1px solid var(--dv-border); }
    .closedrows .cr:hover, .closedrows .cr:focus-visible { background: var(--dv-surface-3); outline: none; }
    .closedrows .cr .num { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; color: var(--dv-text-3); font-weight: 600; }
    .closedrows .cr b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; }
    .closedrows .cr b small { display: block; font-weight: 400; color: var(--dv-text-2); overflow: hidden; text-overflow: ellipsis; }
    .closedrows .cr .who { color: var(--dv-text-2); white-space: nowrap; }
    .cwarn { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--au-warn-text); }
    .cwarn.bad { color: var(--dv-danger); }
    .back { color: var(--dv-text-3); }
    /* the department comparison */
    .rtbl { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-base); }
    .rtbl th { text-align: start; font-size: var(--sw-fs-sm); font-weight: 600; color: var(--dv-text-2); padding: 6px 8px; border-block-end: 1px solid var(--dv-border); white-space: nowrap; }
    .rtbl td { padding: 10px 8px; border-block-end: 1px solid var(--dv-border); vertical-align: middle; font-variant-numeric: tabular-nums; }
    .rtbl tr:last-child td { border-block-end: 0; }
    .rtbl .num { text-align: center; }
    .rtbl td.bad { color: var(--dv-danger); font-weight: 700; }
    .tl { display: inline-flex; align-items: center; gap: 5px; color: var(--dv-accent-text); font-weight: 600; text-decoration: none; min-block-size: 32px; }
    .tl:hover { text-decoration: underline; }
    .dcards { display: none; }
    /* phase 3: how much was handled, opened vs closed, waiting for my approval, requests for quotation */
    .w > header .pseg { margin-inline-start: auto; flex: none; }
    .w > header .pseg + .fold { margin-inline-start: 4px; }
    .rtbl.tp td.who { font-weight: 600; max-inline-size: 0; inline-size: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rtbl.tp td.mut { color: var(--dv-text-2); font-size: var(--sw-fs-sm); }
    .rtbl tfoot td { font-weight: 700; border-block-start: 1px solid var(--dv-border-strong, var(--dv-border)); border-block-end: 0; }
    .net { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    .bars { display: grid; gap: 6px; }
    .bars svg { inline-size: 100%; block-size: 132px; display: block; overflow: visible; }
    .bars .bo { fill: var(--dv-accent); }
    .bars .bc { fill: var(--dv-success, var(--sw-success)); }
    .bars .bl { font-size: 8.5px; text-anchor: middle; fill: var(--dv-text-3); }
    .bars .ax { font-size: var(--sw-fs-2xs); text-anchor: middle; fill: var(--dv-text-3); }
    .bars .base { stroke: var(--dv-border); }
    .bars .lg { display: flex; gap: 14px; font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
    .bars .lg span { display: inline-flex; align-items: center; gap: 5px; }
    .bars .lg i { inline-size: 10px; block-size: 10px; border-radius: 3px; display: inline-block; }
    .bars .lg i.o { background: var(--dv-accent); }
    .bars .lg i.c { background: var(--dv-success, var(--sw-success)); }
    .closedrows .cr .amt { font-weight: 700; color: var(--dv-text); white-space: nowrap; }
    .closedrows .cr .tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
    .closedrows .cr .tags .chip .ic { font-size: var(--sw-fs-xs); }
    .dcard.total { background: transparent; }
    /* phase 4: an instalment row - the title takes the line, the due chip and the amount the line under it (the card is a third wide) */
    .closedrows .cr[data-pay-row='instalment'] { grid-template-columns: auto minmax(0, 1fr) auto; }
    .closedrows .cr[data-pay-row='instalment'] .tags { grid-column: 2; grid-row: 2; justify-content: flex-start; align-items: center; gap: 8px; }
    .closedrows .cr[data-pay-row='instalment'] .back { grid-column: 3; grid-row: 1 / span 2; }
    .vh { position: absolute !important; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    @media (max-width: 1180px) {
      .wgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 767px) {
      .dh-row { display: grid; grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px); grid-template-areas: 't .'; gap: 10px; }
      .amb, .hide-ph { display: none; }
      .dh-det .seg { inline-size: 100%; box-sizing: border-box; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: var(--sw-r-xl); }
      .dh-det .seg button { min-inline-size: 0; padding-inline: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dh-det .grow { display: none; }
      .offline-top { margin: 0 -14px -10px; padding: 8px 14px; }
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .kpi { padding: 12px 14px; }
      .wgrid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
      .w.wide, .w.full { grid-column: auto; }
      .w { padding: 14px 14px 12px; }
      .w > header .q { display: none; }
      .w > header .fold { inline-size: 44px; block-size: 44px; margin-block: -6px; }
      .place { grid-template-columns: minmax(0, 1fr) auto; }
      .place .track { display: none; }
      .rooms { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-inline: -14px; padding-inline: 14px; }
      .hhead { display: none; }
      .crow { grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: 'av nm ld' 'av st st'; row-gap: 4px; padding-block: 10px; }
      .crow .av { grid-area: av; }
      .crow .nm { grid-area: nm; }
      .crow .ldc { grid-area: ld; }
      .crow .st { grid-area: st; display: flex; gap: 16px; }
      .cell { min-inline-size: 0; text-align: start; display: inline-flex; gap: 4px; align-items: baseline; font-size: var(--sw-fs-base); }
      .cell small { display: inline; font-size: var(--sw-fs-xs); }
      .closedrows .cr { grid-template-columns: auto minmax(0, 1fr) auto; }
      .closedrows .cr .who { display: none; }
      .rtbl { display: none; }
      .dcards { display: flex; flex-direction: column; gap: 8px; }
      .dcard { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--sw-r-lg); background: var(--dv-surface); border: 1px solid var(--dv-border); color: inherit; text-decoration: none; min-block-size: 44px; }
      .dcard .nums { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
      .dcard .nums em { font-style: normal; font-weight: 700; color: var(--dv-text); font-variant-numeric: tabular-nums; }
      .bars svg { block-size: 110px; }
      .closedrows .cr.ap { grid-template-columns: auto minmax(0, 1fr) auto; }
      .closedrows .cr.ap .back, .closedrows .cr.rq .back { display: none; }
      .closedrows .cr.rq { grid-template-columns: auto minmax(0, 1fr); }
      .closedrows .cr.rq .tags { grid-column: 2; justify-content: flex-start; }
      .closedrows .cr[data-pay-row] .back { display: none; }
      .w > header .pseg button { min-block-size: 36px; }
    }
    @media (pointer: coarse) {
      .tree .row, .closedrows .cr, .tl { min-block-size: 44px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .w > header .fold .ic { transition: none; }
    }
  `];w([Vt({attribute:!1})],f.prototype,"route",2);w([g()],f.prototype,"screen",2);w([g()],f.prototype,"module",2);w([g()],f.prototype,"meta",2);w([g()],f.prototype,"data",2);w([g()],f.prototype,"dept",2);w([g()],f.prototype,"rfqs",2);w([g()],f.prototype,"rfqFailed",2);w([g()],f.prototype,"details",2);w([g()],f.prototype,"vendorIds",2);w([g()],f.prototype,"handled",2);w([g()],f.prototype,"approval",2);w([g()],f.prototype,"reason",2);w([g()],f.prototype,"folded",2);w([g()],f.prototype,"allOverdue",2);w([g()],f.prototype,"offline",2);w([g()],f.prototype,"lastOk",2);w([g()],f.prototype,"now",2);w([g()],f.prototype,"phone",2);w([g()],f.prototype,"compactHeader",2);w([g()],f.prototype,"yesterday",2);w([g()],f.prototype,"summary",2);w([g()],f.prototype,"summaryFailed",2);w([g()],f.prototype,"period",2);w([g()],f.prototype,"expanded",2);w([g()],f.prototype,"payments",2);w([g()],f.prototype,"paymentsFailed",2);f=w([Gt("tickets-overview")],f);export{ns as DETAIL_CAP,as as OVERVIEW_REFRESH_MS,es as SLOW_REFRESH_MS,f as TicketsOverview};
//# sourceMappingURL=tickets-overview-Bn0cEN-r.js.map
