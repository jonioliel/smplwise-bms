import{a2 as re,b5 as F,i as oe,aL as de,c6 as le,hA as ce,A as m,b as r,m as I,ey as pe,a as z,hB as me,a3 as R,cI as he,d as E,a6 as x,hC as ue,bx as ve,a5 as _,eH as B,o as H,c7 as ge,u as fe,cs as we,hD as be,aU as $e,g as ye,ax as xe,j as w,k as ke}from"./index-DkcUEx2W.js";import{a as ze}from"./automations-glass-CKn9scAq.js";import{a as Se,m as qe}from"./media-page-DEDvn7Sk.js";import{a as Oe}from"./glass-CXLdONPM.js";import{b as O,L as _e}from"./tickets-board-CcQZ1EDU.js";import{t as De}from"./tickets-s4-Ca3attjM.js";import{ticketCostsApi as Pe}from"./tickets-costs-svLaMYNu.js";import{b as Ce,f as S,w as Te}from"./board-model-CmBEp91z.js";import{r as q}from"./rfq-model-Cj-PGvyg.js";import{t as $}from"./icons-BUNxuhzh.js";import{f as K}from"./cost-model-DR8pjFKj.js";import{r as W,a as j,H as Q,i as Me,s as Re}from"./handler-load-BXHEF_X6.js";import{o as t}from"./overview-text-jQVupnTe.js";import{f as Ae,o as Le,a as Ne,p as Fe,b as Ie,d as U,c as D,r as Ee,e as Be,g as He,F as V,k as Ke,s as We,h as je,S as A,M as L,i as Qe,j as Ue,l as Ve,O as P,m as Ge,n as Ye,q as Je,t as G,u as Y,v as J,A as C,w as N,x as Xe,y as Ze,z as ea,B as aa,C as ta,D as sa}from"./overview-model-CZ6DxOQ6.js";import{t as na}from"./chip-selected-CcFP2Hl2.js";import{L as ia}from"./long-lists-CuzkbAQF.js";import"./sw-logo-art-PLtEZJxU.js";import"./lead-reserve-CByVlOBW.js";import"./tickets-costs-mock-C4es686Z.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";const ra=["today","7d","30d"],oa={summary:e=>{const a=new URLSearchParams;e.department_id&&a.set("department_id",e.department_id),e.period&&a.set("period",e.period);const n=a.toString();return F(`tickets/dashboard${n?`?${n}`:""}`)},payments:e=>F(`tickets/dashboard/payments${e.department_id?`?${new URLSearchParams({department_id:e.department_id}).toString()}`:""}`)},da=864e5,X=e=>String(e).padStart(2,"0"),T=e=>`${e.getFullYear()}-${X(e.getMonth()+1)}-${X(e.getDate())}`,la={async summary(e){const a=e.period??"7d",n=a==="today"?1:a==="30d"?30:7,i=new Date,s=await O().board({department_id:e.department_id,state:"closed"}),o=await O().board({department_id:e.department_id}),d=new Date(i.getFullYear(),i.getMonth(),i.getDate()-(n-1)).getTime(),p=new Map;for(const g of s.items){if(!g.assignee||!g.closed_at||Date.parse(g.closed_at)<d)continue;const y=p.get(g.assignee_key)??{key:g.assignee_key,kind:g.assignee.kind==="contact"?"contact":"user",name:g.assignee.name,done:0,closed:0,returned:0,median_seconds:null};y.done+=1,y.closed+=1,p.set(g.assignee_key,y)}const l=[...p.values()].sort((g,y)=>y.done-g.done||g.name.localeCompare(y.name)),c=new Date(i.getFullYear(),i.getMonth(),i.getDate()-13),u=Array.from({length:14},(g,y)=>({date:T(new Date(c.getTime()+y*da+12*36e5)),opened:0,closed:0})),v=new Map(u.map(g=>[g.date,g]));for(const g of[...o.items,...s.items]){const y=v.get(T(new Date(g.created_at)));y&&(y.opened+=1);const k=g.closed_at?v.get(T(new Date(g.closed_at))):void 0;k&&(k.closed+=1)}const b=g=>l.reduce((y,k)=>y+k[g],0);return{period:a,days:n,since:new Date(d).toISOString(),now:i.toISOString(),department_id:e.department_id??null,throughput:{rows:l,total:{done:b("done"),closed:b("closed"),returned:b("returned"),median_seconds:null}},daily:{days:u,net:u.reduce((g,y)=>g+y.opened-y.closed,0),since:c.toISOString()},approvals:{quotes:{count:0,items:[]},claims:{count:0,items:[]},second:{count:0,items:[]}},rfqs:{count:0,decide:0,questions:0,items:[]},departments:null,all_departments:!1,truncated:!1}},async payments(e){return{schedule_on:!1,today:T(new Date),department_id:e.department_id??null,overdue:{count:0,items:[]},upcoming:{count:0,tomorrow:0,items:[]},claims:{count:0,items:[]}}}};function Z(){return re()?oa:la}var ca=Object.defineProperty,pa=Object.getOwnPropertyDescriptor,f=(e,a,n,i)=>{for(var s=i>1?void 0:i?pa(a,n):a,o=e.length-1,d;o>=0;o--)(d=e[o])&&(s=(i?d(a,n,s):d(s))||s);return i&&s&&ca(a,n,s),s};const ma=6e4,ha=6e5,ua=12,va=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/,ga="sw.tickets.overview.kpis.",ee=e=>{try{return globalThis.localStorage.getItem(e)}catch{return null}},ae=(e,a)=>{try{globalThis.localStorage.setItem(e,a)}catch{}};let h=class extends oe{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.route=null,this.screen="loading",this.module=null,this.meta=null,this.data=null,this.dept="",this.rfqs=null,this.rfqFailed=!1,this.details=new Map,this.vendorIds=new Set,this.handled=null,this.approval=null,this.reason="",this.folded=Ae(ee(V),window.matchMedia("(max-width: 767px)").matches),this.allOverdue=!1,this.offline=!1,this.lastOk=null,this.now=new Date,this.phone=window.matchMedia("(max-width: 767px)").matches,this.yesterday=null,this.summary=null,this.summaryFailed=!1,this.period=null,this.expanded=new Set,this.payments=null,this.paymentsFailed=!1,this.paged=h.pagedMq.matches,this.lists=new ia(this,()=>this.pageIdx=0),this.pageIdx=0,this.pageOfKey=new Map,this.pageCount=0,this.onPaged=()=>{this.paged=h.pagedMq.matches,this.pageIdx=0},this.seq=0,this.sumSeq=0,this.slowAt=0,this.slowKey="",this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offNames=null,this.offMe=null,this.pushAt=0,this.live=new _e(()=>{this.now=new Date,this.screen==="ready"&&this.load(!0)},ma),this.onOnline=()=>{this.screen==="ready"&&this.load(!0)},this.onTrack=e=>{const a=e.currentTarget,n=Math.round(Math.abs(a.scrollLeft)/Math.max(1,a.clientWidth));n!==this.pageIdx&&n<this.pageCount&&(this.pageIdx=n)},this.onPagerKey=e=>{const a=getComputedStyle(this).direction==="rtl",n=e.key==="ArrowLeft"?a?1:-1:e.key==="ArrowRight"?a?-1:1:0;let i=-1;n?i=this.pageIdx+n:e.key==="Home"?i=0:e.key==="End"&&(i=this.pageCount-1),!(i<0||i>=this.pageCount)&&(e.preventDefault(),this.goPage(i,!1),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-page-dot="${i}"]`)?.focus()))},this.retryPayments=()=>{this.paymentsFailed=!1,this.loadPayments()},this.retrySummary=()=>{this.summaryFailed=!1,this.loadSummary(!1)},this.retrySlow=()=>{this.slowAt=0,this.loadSlow()}}connectedCallback(){super.connectedCallback(),Oe(this),this.phoneMq.addEventListener("change",this.onPhone),h.pagedMq.addEventListener("change",this.onPaged),this.offNames=le(()=>this.requestUpdate()),this.offMe=ce(e=>{if(e.type!=="notification"||this.screen!=="ready")return;const a=Date.now();a-this.pushAt<5e3||(this.pushAt=a,this.load(!0))}),window.addEventListener("online",this.onOnline),this.live.start(),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),h.pagedMq.removeEventListener("change",this.onPaged),window.removeEventListener("online",this.onOnline),this.offNames?.(),this.offMe?.(),this.live.stop()}willUpdate(e){if(e.has("route")&&this.route){const a=this.route.params.get("dept")??"",n=va.test(a)?a:"";n!==this.dept&&(this.dept=n,this.reason="",this.allOverdue=!1,this.summary=null,this.summaryFailed=!1,this.screen==="ready"&&this.load(!1))}}updated(){Se(this.renderRoot,this.phone),this.paged&&this.pageCount&&this.pageIdx>=this.pageCount&&this.goPage(this.pageCount-1,!1);const e=this.renderRoot.querySelector("[data-dept-chips]");e?.classList.toggle("over",this.paged&&e.scrollWidth>e.clientWidth+1)}track(){return this.renderRoot.querySelector("[data-overview-pages]")}goPage(e,a=!0){const n=Math.max(1,this.pageCount),i=Math.min(n-1,Math.max(0,e));this.pageIdx=i;const s=this.track();if(!s)return;const o=getComputedStyle(s).direction==="rtl"?-1:1,d=window.matchMedia("(prefers-reduced-motion: reduce)").matches;s.scrollTo({left:o*i*s.clientWidth,behavior:a&&!d?"smooth":"auto"})}pager(e){if(e.length<2)return m;const a=e.length,n=Math.min(this.pageIdx,a-1);return r`<div class="pager" role="group" aria-label=${t("pagesGroup")} data-overview-pager @keydown=${this.onPagerKey}>
      <button type="button" class="pgb prev" data-page-prev ?disabled=${n===0} aria-label=${t("pagePrev")} title=${t("pagePrev")} @click=${()=>this.goPage(n-1)}>${$("back")}</button>
      <span class="pds">${e.map((i,s)=>r`<button type="button" class=${`pd${i.some(o=>o.alert)?" alert":""}`} data-page-dot=${s} aria-current=${s===n?"page":"false"}
        aria-label=${t("pageDot",{n:s+1,of:a,names:i.map(o=>o.title).join(", ")})+(i.some(o=>o.alert)?` · ${t("pageAlert")}`:"")} title=${i.map(o=>o.title).join(" · ")} @click=${()=>this.goPage(s)}><i></i></button>`)}</span>
      <span class="pgn" aria-hidden="true"><span class="n">${n+1}/${a}</span></span>
      <button type="button" class="pgb next" data-page-next ?disabled=${n>=a-1} aria-label=${t("pageNext")} title=${t("pageNext")} @click=${()=>this.goPage(n+1)}>${$("back")}</button>
    </div>`}settings(){return Le({...this.module?.ui??{},...this.data?.ui??{}})}async boot(){try{const e=await I().module();if(this.module=e,pe(e.name),!e.enabled){this.screen="off";return}this.meta=await I().meta().catch(()=>null),De().contacts({kind:"vendor"}).then(a=>this.vendorIds=new Set(a.contacts.map(n=>n.id))).catch(()=>{}),await this.load(!1)}catch(e){this.fail(e)}}fail(e){e instanceof z&&e.status===403?this.screen="forbidden":e instanceof z&&e.status===404&&e.body.code==="feature_disabled"?this.screen="off":this.screen="error"}async load(e){const a=++this.seq;!e&&!this.data&&(this.screen="loading");try{const n=await O().board({department_id:this.dept||void 0});if(a!==this.seq)return;this.data=n,this.now=new Date,this.lastOk=this.now,this.offline=!1,this.screen="ready",this.rememberKpis(),this.loadSummary(e);const i=this.dept;(!e||i!==this.slowKey||Date.now()-this.slowAt>=ha)&&(this.slowKey=i,this.slowAt=Date.now(),this.loadSlow())}catch(n){if(a!==this.seq)return;if(this.data&&!(n instanceof z)){this.offline=!0;return}if(e&&this.data&&n instanceof z&&n.status>=500)return;this.fail(n)}}async loadSlow(){const e=this.dept||void 0,a=me();Promise.all(["open","awarded","ordered"].map(s=>a.list({state:s,department_id:e,limit:100}))).then(async s=>{if(this.slowKey!==(e??""))return;const o=s.flatMap(c=>c.items);this.rfqs=o,this.rfqFailed=!1;const d=o.filter(c=>c.state==="awarded"||c.state==="ordered").slice(0,ua),p=await Promise.all(d.map(c=>a.get(c.id).catch(()=>null))),l=new Map;for(const c of p)c&&l.set(c.id,c);this.details=l}).catch(s=>{s instanceof z&&(s.status===403||s.status===404)?(this.rfqs=[],this.rfqFailed=!1):this.rfqFailed=!0});const i=W();O().handlerLoad(i??void 0).then(s=>{const o=j(s.days)??Q;this.handled={days:o,counts:s.handled}}).catch(()=>this.handled=null),R("tickets.costs.view")?Pe().accountClaims({status:["submitted"],...e?{department:e}:{}}).then(s=>this.approval=s.rows.length).catch(()=>this.approval=null):this.approval=null,this.loadPayments()}mayPay(){return R("tickets.costs.view")&&R("tickets.costs")}async loadPayments(){if(!this.mayPay()){this.payments=null,this.paymentsFailed=!1;return}const e=this.dept;try{const a=await Z().payments({department_id:e||void 0});if(e!==this.dept)return;this.payments=a,this.paymentsFailed=!1,this.data&&this.rememberKpis()}catch(a){if(e!==this.dept)return;a instanceof z&&a.status===403?(this.payments=null,this.paymentsFailed=!1):this.payments||(this.paymentsFailed=!0)}}allOverdueRows(){const e=this.data,a=Ne(e.items,this.rfqs??[],this.now);return this.payments?.overdue.items.length?[...a,...Fe(this.payments.overdue.items,this.now)].sort((n,i)=>+(i.tone==="bad")-+(n.tone==="bad")||i.late-n.late):a}chosenPeriod(){return this.period??Ie(W()??Me(this.module?.ui))}async loadSummary(e){const a=++this.sumSeq,n=this.dept,i=this.chosenPeriod();try{const s=await Z().summary({department_id:n||void 0,period:i});if(a!==this.sumSeq)return;this.summary=s,this.summaryFailed=!1,this.data&&this.rememberKpis()}catch{if(a!==this.sumSeq||e&&this.summary&&this.summary.department_id===(n||null))return;this.summary=null,this.summaryFailed=!0}}setPeriod(e){e===this.chosenPeriod()&&this.summary?.period===e||(this.period=e,Re(U(e)),this.loadSummary(!1),O().handlerLoad(U(e)).then(a=>this.handled={days:j(a.days)??Q,counts:a.handled}).catch(()=>this.handled=null))}kpis(){const e=this.data,a=this.summary?D(this.summary.approvals):this.approval;return{open:e.counts.all,stuck:e.counts.stuck,waiting:e.counts.waiting,overdue:this.allOverdueRows().length,approval:a}}rememberKpis(){const e=`${ga}${this.dept||"all"}`,{store:a,yesterday:n}=Ee(He(ee(e)),this.kpis(),Be(this.now));ae(e,JSON.stringify(a)),this.yesterday=n}toggleFold(e){const a=new Set(this.folded);a.has(e)?a.delete(e):a.add(e),this.folded=a,ae(V,JSON.stringify([...a]))}setDept(e){he("/tickets/overview",e?new URLSearchParams({dept:e}):void 0),this.dept=e,this.reason="",this.allOverdue=!1,this.summary=null,this.summaryFailed=!1,this.payments=null,this.paymentsFailed=!1,this.expanded=new Set,this.load(!1)}href(e={},a){return Ce({dept:this.dept,...e},a?{t:a}:{})}widget(e,a,n,i,s={}){const o=this.folded.has(e);return r`<section class=${`glass w ${s.cls??""}${o?" folded":""}`} data-widget=${e} id=${`w-${e}`} style=${s.span?`grid-column: span ${s.span}`:m}>
      <header><h2>${a}${s.badge??m}</h2>${n?r`<span class="q">${n}</span>`:m}${s.extra&&!o?s.extra:m}
        <button type="button" class="fold" data-fold=${e} aria-expanded=${String(!o)} aria-label=${t(o?"unfold":"fold",{name:a})} @click=${()=>this.toggleFold(e)}>${$("chevronDown")}</button></header>
      <div class="wb">${i}</div>
    </section>`}quiet(e){return r`<div class="body"><div class="quiet" data-quiet>${$("check")}${e}</div></div>`}skeleton(e,a){return r`<div class="skel" aria-busy="true">${Array.from({length:e},()=>r`<span class="skl" style=${`block-size:${a}px`}></span>`)}</div>`}header(e=null){const a=this.data,n=a?.departments??[],i=!!a?.all_departments,s=n.reduce((o,d)=>o+d.count,0);return r`<header class="dh" data-overview-header>
      ${this.offline&&this.lastOk?r`<div class="offline-top" role="status" data-offline>${$("offline")}${t("offline",{time:E(this.lastOk)})}</div>`:m}
      ${this.screen==="ready"||this.screen==="loading"?r`<div class="dh-det">
        ${n.length>1?r`<div class="seg sm depts" role="radiogroup" aria-label=${t("deptGroup")} data-dept-chips>
          <button type="button" role="radio" aria-checked=${String(!this.dept)} data-dept="" @click=${()=>this.setDept("")}>${t(i?"allDepts":"allMyDepts")}<small>${s}</small></button>
          ${n.map(o=>r`<button type="button" role="radio" aria-checked=${String(this.dept===o.id)} data-dept=${o.id} @click=${()=>this.setDept(o.id)}>${x(o.name)}<small>${o.count}</small></button>`)}
        </div>`:m}
        ${this.lastOk?r`<span class="amb" data-updated>${t("updated",{when:""}).trim()} <em>${this.now.getTime()-this.lastOk.getTime()<6e4?t("justNow"):ue(this.lastOk.toISOString(),this.now)}</em></span>`:m}
        <span class="grow"></span>
        ${e?this.pager(e):m}
        <a class="btn sm hide-ph" href=${this.href()} data-to-board>${$("ticket")}${t("toBoard")}</a>
      </div>`:m}
    </header>`}kpiRow(){if(this.screen==="loading"||!this.data)return r`<div class="kpis" aria-busy="true">${Array.from({length:5},()=>r`<span class="skl" style="block-size:76px;border-radius:var(--sw-r-lg)"></span>`)}</div>`;const e=this.kpis(),a=Ke(e,this.yesterday),n=this.data.truncated,i=(s,o,d,p,l,c=!1,u="overdue")=>{const v=a[s],b=r`<small>${t(o)}</small><b>${c&&l?r`<span class="least" data-at-least>${t("atLeast",{n:""}).trim()}</span>`:m}<span class="n">${l}</span>${v?r`<span class=${`d ${v>0?"up":"down"}`} title=${t(v>0?"yesterdayUp":"yesterdayDown",{n:Math.abs(v)})} data-delta=${v}>${$(v>0?"up":"down")}<span class="n">${Math.abs(v)}</span><span class="vh">${t(v>0?"yesterdayUp":"yesterdayDown",{n:Math.abs(v)})}</span></span>`:m}</b>`,g=`kpi ${l?d:""}`;return p?r`<a class=${g} href=${p} data-kpi=${s}>${b}</a>`:r`<button type="button" class=${g} data-kpi=${s} @click=${()=>this.reveal(u)}>${b}</button>`};return r`<div class="kpis" data-kpis>
      ${i("open","kOpen","",this.href(),e.open)}
      ${i("stuck","kStuck","warn",this.href({state:"stuck"}),e.stuck)}
      ${i("waiting","kWaiting","",this.href({state:"waiting"}),e.waiting)}
      ${i("overdue","kOverdue","bad",null,e.overdue,n)}
      ${e.approval!==null?this.summary?i("approval","kApproval","",null,e.approval,!1,"approvals"):i("approval","kApproval","","#/tickets/accounts",e.approval):m}
    </div>`}reveal(e){this.folded.has(e)&&this.toggleFold(e);const a=this.paged?this.pageOfKey.get(e):void 0;if(a!==void 0){this.goPage(a);return}this.updateComplete.then(()=>this.renderRoot.querySelector(`#w-${e}`)?.scrollIntoView({block:"start",behavior:"smooth"}))}whereStuck(){const e=this.data;if(!e.counts.stuck&&!e.items.some(d=>d.stuck))return this.quiet(t("stNone"));const a=We(e.items),n=Object.values(a).reduce((d,p)=>d+p,0),i=je(e.items,e.tree,this.reason),s=Math.max(1,...i.map(d=>d.count)),o={unopened:"bad",overdue:"bad",ack:"warn",stuck:"warn",waiting:"acc",unassigned:""};return r`<div class="body">
      <div class="rooms" role="group" aria-label=${t("stReasons")} data-reasons>
        <button type="button" class="rc" aria-pressed=${String(!this.reason)} data-reason="" @click=${()=>this.reason=""}>${t("stAll")}<small>${n}</small></button>
        ${A.filter(d=>a[d]).map(d=>r`<button type="button" class="rc" aria-pressed=${String(this.reason===d)} data-reason=${d} @click=${()=>this.reason=this.reason===d?"":d}>${t(`rs_${d}`)}<small>${a[d]}</small></button>`)}
      </div>
      <div class="tree" role="list" aria-label=${t("stTree")} data-places>
        ${i.map(d=>r`<div class="place" role="listitem" data-place=${d.key}>
            <a class=${`row l${d.level}`} href=${this.href({state:"stuck",place:d.key})}><span class="nm">${d.kind==="none"?t("noPlace"):x(d.name)}</span><span class="n">${d.count}</span></a>
            <div class="track" aria-hidden="true"><span style=${`inline-size:${Math.round(d.count/s*100)}%`}></span></div>
            <span class="mut">${d.level===0&&d.open?t("stOfOpen",{n:d.open}):""}</span>
          </div>
          ${d.level===0&&!this.reason?r`<div class="why" data-why=${d.key}>${A.filter(p=>d.why[p]).map(p=>r`<span><i class=${`dot ${o[p]}`}></i>${t(`rs_${p}`)} <span class="n">${d.why[p]}</span></span>`)}</div>`:m}`)}
      </div>
    </div>`}handlerList(e){const a=this.handled?.days;return r`<div class="crows">${e.map(n=>{const i=n.name.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join("");return r`<a class="crow" href=${this.href({assignee:n.key})} data-handler=${n.key} ?data-busy=${n.busy}>
        <span class=${`av${n.vendor?" ext":""}`} aria-hidden="true">${i}</span>
        <span class="nm"><b>${x(n.name)}${n.vendor&&this.settings().vendors==="tagged"?r`<span class="chip pur xs" data-vendor-tag>${t("ldVendor")}</span>`:m}${n.busy?r`<span class="chip warn xs" data-busy-tag>${t("ldBusy")}</span>`:m}</b>
          <small>${n.open?t("ldOldest",{age:S(this.now.getTime()-Date.parse(n.oldestAt??""))}):t("ldFree")}</small></span>
        <span class="st">
          <span class="cell"><span class="n">${n.open}</span><small>${t("ldOpen")}</small></span>
          <span class=${`cell${n.waiting?" warn":""}`}><span class="n">${n.waiting}</span><small>${t("ldWaiting")}</small></span>
          <span class=${`cell${n.stuck?" bad":""}`}><span class="n">${n.stuck}</span><small>${t("ldStuck")}</small></span>
          ${a&&n.handled!==void 0?r`<span class="cell" data-handled><span class="n">${n.handled}</span><small>${t("ldHandled")}</small></span>`:m}
        </span>
        <span class="ldc"><span class="load" role="img" aria-label=${t("ldMeter",{on:n.meter,total:L})}>${Array.from({length:L},(s,o)=>r`<i class=${o<n.meter?n.busy?"hot":"on":""}></i>`)}</span><small>${n.meter}/${L}</small></span>
      </a>`})}</div>`}loadCard(){const e=this.data,a=this.settings(),n=Qe(e.items,this.vendorIds,a,this.handled?.counts??null),i=n.filter(l=>l.busy).length;if(!n.length)return{body:this.quiet(t("ldNone")),busy:i};const{staff:s,vendors:o}=Ue(n,a.vendors),d=this.handled?.days,p=r`<div class="hhead" aria-hidden="true"><span></span><span></span><span class="st"><span>${t("ldOpen")}</span><span>${t("ldWaiting")}</span><span>${t("ldStuck")}</span>${d?r`<span>${t("ldHandled")} · ${ve(`hd_${d}`)}</span>`:m}</span><span class="ldc">${t("ldLoad")}</span></div>`;return{busy:i,body:r`<div class="body" data-load-mode=${a.vendors}>
        ${p}
        ${a.vendors==="separate"?r`<div class="sect"><h4>${t("ldStaff")} <span class="n">· ${s.length}</span></h4>${this.handlerList(s)}</div>
          ${o.length?r`<div class="sect" data-vendor-list><h4>${t("ldVendors")} <span class="n">· ${o.length}</span></h4>${this.handlerList(o)}</div>`:m}`:this.handlerList(s)}
      </div>`}}whoWaits(){const e=this.data,a=Ve(e.items,this.vendorIds);if(!a.some(s=>s.count))return this.quiet(t("wwNone"));const n={me:{label:"wwMe",icon:"user",cls:"me",href:this.href({state:"waiting"})},staff:{label:"wwStaff",icon:"users",cls:"",href:this.href()},vendors:{label:"wwVendors",icon:"truck",cls:"ext",href:this.href()}},i=(s,o)=>s==="me"?Te(o):A.includes(o)?t(`rs_${o}`):"";return r`<div class="body"><div class="lanes">${a.filter(s=>s.count||s.id==="me").map(s=>{const o=n[s.id],d=s.reasons.map(p=>({t:i(s.id,p.key),n:p.n})).filter(p=>p.t);return r`<a class="blk lane" href=${o.href} data-lane=${s.id}><span class=${`bi ${o.cls}`}>${$(o.icon)}</span>
        <span class="bt"><b>${t(o.label)}${s.oldestAt?r`<span class="mut">${t("wwOldest",{age:S(this.now.getTime()-Date.parse(s.oldestAt))})}</span>`:m}</b>
          ${d.length?r`<small>${d.map((p,l)=>r`${l?r`<span aria-hidden="true">·</span>`:m}<span>${p.t} · <span class="n">${p.n}</span></span>`)}</small>`:m}</span>
        <span class="big"><span class="n">${s.count}</span></span></a>`})}</div></div>`}overdueCard(){const e=this.data,a=this.allOverdueRows();if(!a.length)return{body:this.quiet(t("odNone")),count:0};const n=this.allOverdue?a:a.slice(0,P),i={sla:"odSla",eta:"odEta",rfq:"odRfq",pay:"odPay"};return{count:a.length,body:r`<div class="body"><div class="closedrows" data-overdue>${n.map(s=>r`<a class="cr" href=${s.rfq?q({id:s.id}):this.href({},s.id)} data-overdue-row=${s.kind}>
          <span class="num">${s.ref}</span><b>${x(s.title)}<small><span class=${`cwarn ${s.tone}`}>${$("clock")}${t("odBy",{what:t(i[s.kind]),dur:S(s.late)})}</span></small></b>
          <span class="who">${s.who?x(s.who):t("odNobody")}</span><span class="back">${$("back")}</span></a>`)}</div>
        ${a.length>P?r`<div><button type="button" class="btn sm" aria-expanded=${String(this.allOverdue)} data-overdue-all @click=${()=>this.allOverdue=!this.allOverdue}>${this.allOverdue?t("showLess"):t("showAll")}<small class="mut">· ${a.length}</small></button></div>`:m}
        ${e.truncated?r`<div class="note" data-truncated>${t("truncated",{n:e.items.length})}</div>`:m}
      </div>`}}agendaCard(){const e=this.data,a=this.payments?Ge(this.payments.upcoming.items):Ye([...this.details.values()]),n=Je(e.items,this.rfqs??[],this.details,a,this.vendorIds,this.now),i={visit_vendor:"agVisitVendor",visit_staff:"agVisitStaff",work_start:"agWorkStart",rfq_due:"agRfqDue",payment:"agPayment"},s={visit_vendor:"acc",visit_staff:"acc",work_start:"ok",rfq_due:"pur",payment:"warn"},o=(p,l)=>{const[c,u,v]=p.split("-").map(Number),b=new Date(c,u-1,v).toLocaleDateString(fe(),{weekday:"long",day:"numeric",month:"numeric"});return l===0?`${t("agToday")} · ${b}`:l===1?`${t("agTomorrow")} · ${b}`:b},d=this.rfqFailed?r`<div class="unavail" data-partial>${t("agRfqPartial")}<button type="button" class="btn sm" @click=${this.retrySlow}>${$("refresh")}${t("retry")}</button></div>`:m;return n.length?r`<div class="body" data-agenda>${d}${n.map(p=>r`<div class="sect day" data-day=${p.key}><h4><span class=${p.offset===0?"today":""}>${o(p.key,p.offset)}</span></h4>
      <div class="closedrows">${p.entries.map(l=>r`<a class="cr" href=${l.rfq?q({id:l.id}):this.href({},l.id)} data-agenda-row=${l.kind}>
        <span class="num">${l.timed?E(new Date(l.at)):t("agAllDay")}</span>
        <b><i class=${`dot ${s[l.kind]}`}></i> ${t(i[l.kind])}<small>${[l.who,`${l.ref} · ${l.title}`,l.place].filter(Boolean).map(c=>x(c)).join(" · ")}</small></b>
        <span></span><span class="back">${$("back")}</span></a>`)}</div></div>`)}</div>`:r`${d}${this.quiet(t("agNone"))}`}summaryPending(e,a){return this.summaryFailed?r`<div class="body"><div class="unavail" data-unavailable>${t("unavailable")}<button type="button" class="btn sm" data-retry-summary @click=${this.retrySummary}>${$("refresh")}${t("retry")}</button></div></div>`:this.summary?null:this.skeleton(e,a)}moreButton(e,a){const n=this.expanded.has(e),i=()=>{const s=new Set(this.expanded);n?s.delete(e):s.add(e),this.expanded=s};return r`<div><button type="button" class="btn sm" aria-expanded=${String(n)} data-more=${e} @click=${i}>${n?t("showLess"):t("showAll")}<small class="mut">· ${a}</small></button></div>`}sinceText(e){const a=e?Date.parse(e):NaN;return Number.isNaN(a)?"":t("apWaits",{age:S(this.now.getTime()-a)})}periodSeg(){const e=this.chosenPeriod();return r`<div class="seg sm pseg" role="radiogroup" aria-label=${t("thPeriod")} data-period-seg>${ra.map(a=>r`<button type="button" role="radio" aria-checked=${String(e===a)} data-period=${a} @click=${()=>this.setPeriod(a)}>${t(`pd_${a}`)}</button>`)}</div>`}throughputCard(){const e=this.summaryPending(4,40);if(e)return e;const a=this.summary;if(a.period!==this.chosenPeriod())return this.skeleton(4,40);const n=a.throughput.rows;if(!n.length)return this.quiet(t("thNone"));const i=d=>d===null?"-":S(d*1e3),s=d=>d?x(d):"-",o=a.throughput.total;return r`<div class="body" data-throughput=${a.period}>
      <table class="rtbl tp"><thead><tr><th>${t("thHandler")}</th><th class="num">${t("thDone")}</th><th class="num">${t("thClosed")}</th><th class="num">${t("thReturned")}</th><th class="num">${t("thMedian")}</th></tr></thead>
        <tbody>${n.map(d=>r`<tr data-tp-row=${d.key}><td class="who">${s(d.name)}</td><td class="num"><span class="n">${d.done}</span></td><td class="num"><span class="n">${d.closed}</span></td><td class="num"><span class="n">${d.returned}</span></td><td class="num mut">${i(d.median_seconds)}</td></tr>`)}</tbody>
        <tfoot><tr data-tp-total><td>${t("thTotal")}</td><td class="num"><span class="n">${o.done}</span></td><td class="num"><span class="n">${o.closed}</span></td><td class="num"><span class="n">${o.returned}</span></td><td class="num mut">${i(o.median_seconds)}</td></tr></tfoot></table>
      <div class="dcards">${n.map(d=>r`<div class="dcard" data-tp-card=${d.key}><b>${s(d.name)}</b><span class="nums"><span>${t("thDone")} <em>${d.done}</em></span><span>${t("thClosed")} <em>${d.closed}</em></span><span>${t("thReturned")} <em>${d.returned}</em></span><span>${t("thMedian")} <em>${i(d.median_seconds)}</em></span></span></div>`)}
        <div class="dcard total"><b>${t("thTotal")}</b><span class="nums"><span>${t("thDone")} <em>${o.done}</em></span><span>${t("thClosed")} <em>${o.closed}</em></span><span>${t("thReturned")} <em>${o.returned}</em></span></span></div></div>
    </div>`}dailyCard(){const e=this.summaryPending(1,150);if(e)return e;const a=this.summary.daily.days,n=G(a);if(!n.opened&&!n.closed)return this.quiet(t("dyNone"));const i=420,s=110,o=14,d=9,p=(i-o*2)/Math.max(1,a.length),l=a.map((c,u)=>{const v=o+u*p+p/2,b=c.opened/n.max*s,g=c.closed/n.max*s;return _`<rect x=${v-d-1} y=${s-b} width=${d} height=${b} rx="2.5" class="bo"></rect><rect x=${v+1} y=${s-g} width=${d} height=${g} rx="2.5" class="bc"></rect>
        ${c.opened?_`<text x=${v-d/2-1} y=${s-b-3} class="bl">${c.opened}</text>`:m}${c.closed?_`<text x=${v+d/2+1} y=${s-g-3} class="bl">${c.closed}</text>`:m}
        ${u%2===a.length%2?_`<text x=${v} y=${s+12} class="ax">${Y(c.date)}</text>`:m}`});return r`<div class="body" data-daily>
      <div class="net" data-net=${n.net}>${t("dyNetLabel",{n:J(n.net)})} · ${t("dyOpened")} <span class="n">${n.opened}</span> · ${t("dyClosed")} <span class="n">${n.closed}</span></div>
      <div class="bars" aria-hidden="true"><svg viewBox=${`0 0 ${i} ${s+16}`}><line x1=${o} x2=${i-o} y1=${s+.5} y2=${s+.5} class="base"></line>${l}</svg>
        <div class="lg"><span><i class="o"></i>${t("dyOpened")}</span><span><i class="c"></i>${t("dyClosed")}</span></div></div>
      <table class="vh" data-daily-table><caption>${t("dyChart")}</caption><thead><tr><th>${t("dyDay")}</th><th>${t("dyOpened")}</th><th>${t("dyClosed")}</th></tr></thead>
        <tbody>${a.map(c=>r`<tr><td>${Y(c.date)}</td><td>${c.opened}</td><td>${c.closed}</td></tr>`)}</tbody></table>
    </div>`}approvalsCard(){const e=this.summaryPending(4,44);if(e)return e;const a=this.summary.approvals;if(!D(a))return this.quiet(t("apNone"));const n=this.expanded.has("approvals"),i=B(),s=c=>c.amount_minor!==null&&c.currency?r`<span class="amt n" data-amount>${K(c.amount_minor,c.currency,i)}</span>`:r`<span></span>`,o=(c,u)=>r`<a class="cr ap" href=${`${this.href({},u.ticket.id)}&tab=costs`} data-approval-row=${c}>
      <span class="num">#${u.ticket.number}</span><b>${x(u.ticket.title)}<small>${[u.vendor?x(u.vendor):"",this.sinceText(u.since)].filter(Boolean).join(" · ")}</small></b>${s(u)}<span class="back">${$("back")}</span></a>`,d=c=>r`<a class="cr ap" href=${q({id:c.rfq.id})} data-approval-row="second">
      <span class="num">${c.rfq.ref}</span><b>${x(c.rfq.title)}<small>${[c.vendor?x(c.vendor):"",this.sinceText(c.since)].filter(Boolean).join(" · ")}</small></b>${s(c)}<span class="back">${$("back")}</span></a>`,p=(c,u,v,b)=>v.count?r`<div class="sect" data-approvals=${c}>
      <h4>${u} <span class="n">· ${v.count}</span></h4>
      <div class="closedrows">${(n?v.items:v.items.slice(0,C)).map(b)}</div>
      ${n&&v.count>v.items.length?r`<div class="note" data-truncated>${t("truncated",{n:v.items.length})}</div>`:m}</div>`:m,l=[a.quotes,a.claims,a.second].some(c=>c.count>C);return r`<div class="body">
      ${p("quotes",t("apQuotes"),a.quotes,c=>o("quote",c))}
      ${p("claims",t("apClaims"),a.claims,c=>o("claim",c))}
      ${p("second",t("apSecond"),a.second,d)}
      ${l?this.moreButton("approvals",D(a)??0):m}
    </div>`}paymentsCard(){if(!this.payments)return this.paymentsFailed?r`<div class="body"><div class="unavail" data-unavailable>${t("unavailable")}<button type="button" class="btn sm" data-retry-payments @click=${this.retryPayments}>${$("refresh")}${t("retry")}</button></div></div>`:this.skeleton(3,44);const e=this.payments;if(!N(e))return this.quiet(t("pyNone"));const a=this.expanded.has("payments"),n=B(),i=(l,c)=>l!==null&&c?r`<span class="amt n" data-amount>${K(l,c,n)}</span>`:r`<span></span>`,s=l=>{const c=sa(l.days),u=l.days<0?l.days<=-2?"bad":"warn":l.days<=1?"warn":"info";return r`<a class="cr ap" href=${q({id:l.rfq.id})} data-pay-row="instalment" data-days=${l.days}>
        <span class="num">${l.rfq.ref}</span><b>${x(l.rfq.title)}<small>${[l.vendor?x(l.vendor):"",t(`pyKind_${l.instalment_kind}`),t(l.demand==="open"?"pyDemandOpen":"pyDemandNone")].filter(Boolean).join(" · ")}</small></b>
        <span class="tags"><span class=${`chip xs ${u}`} data-when>${$("clock")}${t(c.key,{n:c.n})}</span>${i(l.amount_minor,l.currency)}</span>
        <span class="back">${$("back")}</span></a>`},o=l=>r`<a class="cr ap" href=${`${this.href({},l.ticket.id)}&tab=costs`} data-pay-row="claim">
      <span class="num">#${l.ticket.number}</span><b>${x(l.ticket.title)}<small>${[l.vendor?x(l.vendor):"",l.since?t("pyApproved",{age:S(this.now.getTime()-Date.parse(l.since))}):""].filter(Boolean).join(" · ")}</small></b>
      ${i(l.amount_minor,l.currency)}<span class="back">${$("back")}</span></a>`,d=(l,c,u,v)=>u.count?r`<div class="sect" data-payments=${l}>
      <h4>${c} <span class="n">· ${u.count}</span></h4>
      <div class="closedrows">${(a?u.items:u.items.slice(0,C)).map(v)}</div>
      ${a&&u.count>u.items.length?r`<div class="note" data-truncated>${t("truncated",{n:u.items.length})}</div>`:m}</div>`:m,p=[e.overdue,e.upcoming,e.claims].some(l=>l.count>C);return r`<div class="body">
      ${d("overdue",t("pyOverdue"),e.overdue,s)}
      ${d("upcoming",t("pyUpcoming"),e.upcoming,s)}
      ${d("claims",t("pyClaims"),e.claims,o)}
      ${p?this.moreButton("payments",N(e)):m}
    </div>`}rfqsCard(){const e=this.summaryPending(4,44);if(e)return e;const a=this.summary.rfqs;if(!a.items.length)return this.quiet(t("rqNone"));const n=this.expanded.has("rfqs"),i=n?a.items:a.items.slice(0,P),s=o=>o?we(new Date(o)):"";return r`<div class="body"><div class="closedrows" data-rfqs>${i.map(o=>{const d=Xe(o);return r`<a class="cr rq" href=${q({id:o.id})} data-rfq-row=${o.stage}>
        <span class="num">${o.ref}</span><b>${x(o.title)}${o.due_at?r`<small>${t("rqDue",{date:s(o.due_at)})}</small>`:m}</b>
        <span class="tags"><span class=${`chip xs ${d.tone}`} data-stage>${t(d.text,{quoted:o.quoted,invited:o.invited})}</span>${o.questions?r`<span class="chip warn xs" data-question>${$("note")}${o.questions>1?t("rqQuestions",{n:o.questions}):t("rqQuestion")}</span>`:m}</span>
        <span class="back">${$("back")}</span></a>`})}</div>
      ${a.items.length>P?this.moreButton("rfqs",a.count):m}
      ${n&&a.count>a.items.length?r`<div class="note" data-truncated>${t("truncated",{n:a.items.length})}</div>`:m}
    </div>`}departmentsCard(){const e=this.summaryPending(3,40);if(e)return e;const a=Ze(this.summary?.departments??[]);if(!this.summary?.departments)return this.departmentsFromBoard();const n=s=>`#/tickets/overview?${new URLSearchParams({dept:s}).toString()}`,i=s=>s>2?" bad":"";return r`<div class="body" data-compare="summary">
      <table class="rtbl"><thead><tr><th>${t("cmpDept")}</th><th class="num">${t("cmpOpen")}</th><th class="num">${t("cmpStuck")}</th><th class="num">${t("cmpOverdue")}</th><th class="num">${t("cmpDecide")}</th><th class="num">${t("cmpDone7")}</th><th class="num">${t("cmpBusy")}</th></tr></thead>
        <tbody>${a.map(s=>r`<tr data-dept-row=${s.id}><td><a class="tl" href=${n(s.id)}>${x(s.name)}</a></td><td class="num"><span class="n">${s.open}</span></td><td class=${`num${i(s.stuck)}`}><span class="n">${s.stuck}</span></td><td class=${`num${i(s.overdue)}`}><span class="n">${s.overdue}</span></td><td class="num"><span class="n">${s.waiting}</span></td><td class="num"><span class="n">${s.done_7d}</span></td><td class="num"><span class="n">${s.busy_handlers}</span></td></tr>`)}</tbody></table>
      <div class="dcards">${a.map(s=>r`<a class="dcard" href=${n(s.id)} data-dept-card=${s.id}><b>${x(s.name)}</b><span class="nums"><span>${t("cmpOpen")} <em>${s.open}</em></span><span>${t("cmpStuck")} <em>${s.stuck}</em></span><span>${t("cmpOverdue")} <em>${s.overdue}</em></span><span>${t("cmpDecide")} <em>${s.waiting}</em></span><span>${t("cmpDone7")} <em>${s.done_7d}</em></span><span>${t("cmpBusy")} <em>${s.busy_handlers}</em></span></span></a>`)}</div>
    </div>`}departmentsFromBoard(){const e=this.data,a=ea(e.items,e.departments,this.vendorIds,this.settings(),this.now),n=i=>`#/tickets/overview?${new URLSearchParams({dept:i}).toString()}`;return r`<div class="body" data-compare>
      <table class="rtbl"><thead><tr><th>${t("cmpDept")}</th><th class="num">${t("cmpOpen")}</th><th class="num">${t("cmpStuck")}</th><th class="num">${t("cmpOverdue")}</th><th class="num">${t("cmpWaiting")}</th><th class="num">${t("cmpBusy")}</th></tr></thead>
        <tbody>${a.map(i=>r`<tr data-dept-row=${i.id}><td><a class="tl" href=${n(i.id)}>${x(i.name)}</a></td><td class="num"><span class="n">${i.open}</span></td><td class=${`num${i.stuck>2?" bad":""}`}><span class="n">${i.stuck}</span></td><td class=${`num${i.overdue>2?" bad":""}`}><span class="n">${i.overdue}</span></td><td class="num"><span class="n">${i.waiting}</span></td><td class="num"><span class="n">${i.busy}</span></td></tr>`)}</tbody></table>
      <div class="dcards">${a.map(i=>r`<a class="dcard" href=${n(i.id)} data-dept-card=${i.id}><b>${x(i.name)}</b><span class="nums"><span>${t("cmpOpen")} <em>${i.open}</em></span><span>${t("cmpStuck")} <em>${i.stuck}</em></span><span>${t("cmpOverdue")} <em>${i.overdue}</em></span><span>${t("cmpWaiting")} <em>${i.waiting}</em></span><span>${t("cmpBusy")} <em>${i.busy}</em></span></span></a>`)}</div>
    </div>`}stateBox(e,a,n){return e==="error"?r`<sw-state-panel state="error" heading=${a} actionLabel=${t("retry")} data-overview-state="error" data-retry
        @action=${()=>{this.screen="loading",this.data=null,this.boot()}}></sw-state-panel>`:e==="forbidden"?r`<sw-state-panel state="forbidden" quiet heading=${a} data-overview-state="forbidden"></sw-state-panel>`:r`<sw-state-panel icon="ticket" state="empty" quiet heading=${a} data-overview-state=${e}>${n??m}</sw-state-panel>`}loadingGrid(){const e=(a,n,i)=>r`<section class=${`glass w ${a}`}><header><span class="skl" style="block-size:20px;inline-size:40%"></span></header>${this.skeleton(n,i)}</section>`;return this.paged?r`<div class="wpages" data-overview-state="loading"><div class="pg">${e("wide",5,40)}${e("",3,56)}${e("wide",5,52)}${e("",4,44)}</div></div>`:r`<div class="wgrid" data-overview-state="loading">${e("wide",5,40)}${e("",3,56)}${e("wide",5,52)}${e("",4,44)}${e("",4,44)}${e("",4,44)}${e("",4,44)}${e("wide",4,40)}${e("",1,150)}</div>`}widgets(){if(this.screen!=="ready"||!this.data)return null;const e=this.data;if(!e.counts.all&&!e.counts.closed_all&&!e.items.length)return null;const a=this.settings(),n=(y,k,te,se,M={},ne=!1)=>({key:y,title:k,span:M.cls==="full"?3:M.cls==="wide"?2:1,alert:ne,make:ie=>this.widget(y,k,te,se,{...M,span:ie})}),i=e.all_departments&&!this.dept&&e.departments.length>1?n("departments",t("cmpTitle"),t("cmpQ"),this.departmentsCard(),{cls:"full"}):null,s=this.loadCard(),o=this.overdueCard(),d=e.counts.stuck,p=this.summary,l=p?D(p.approvals):0,c=p?p.rfqs.count:0,u=N(this.payments),v=!!this.payments?.overdue.count,b=p?G(p.daily.days):null;return{list:[a.compare==="below_numbers"?i:null,n("stuck",t("stTitle"),t("stQ"),this.whereStuck(),{cls:"wide",badge:d?r` <span class="cnt" data-count>${d}</span>`:m}),n("waits",t("wwTitle"),t("wwQ"),this.whoWaits()),n("load",t("ldTitle"),t("ldQ"),s.body,{cls:"wide",badge:s.busy?r` <span class="cnt bad" data-count>${t("ldBusyCount",{n:s.busy})}</span>`:m},!!s.busy),n("overdue",t("odTitle"),t("odQ"),o.body,{badge:o.count?r` <span class="cnt bad" data-count>${o.count}</span>`:m},!!o.count),n("approvals",t("apTitle"),t("apQ"),this.approvalsCard(),{badge:l?r` <span class="cnt" data-count>${l}</span>`:m}),this.payments||this.paymentsFailed?n("payments",t("pyTitle"),t("pyQ"),this.paymentsCard(),{badge:u?r` <span class=${`cnt${v?" bad":""}`} data-count>${u}</span>`:m},v):null,n("rfqs",t("rqTitle"),t("rqQ"),this.rfqsCard(),{badge:c?r` <span class="cnt info" data-count>${c}</span>`:m}),n("upcoming",t("agTitle"),t("agQ"),this.agendaCard()),n("throughput",t("thTitle"),t("thQ"),this.throughputCard(),{cls:"wide",extra:this.periodSeg()}),n("daily",t("dyTitle"),t("dyQ"),this.dailyCard(),{badge:b&&(b.opened||b.closed)?r` <span class=${`cnt${b.net>0?"":" info"}`} data-count data-net-badge>${t("dyNet",{n:J(b.net)})}</span>`:m}),a.compare==="bottom"?i:null].filter(y=>!!y),top:a.compare==="top"?i:null}}body(e,a){switch(this.screen){case"loading":return r`${this.kpiRow()}${this.loadingGrid()}`;case"off":return this.stateBox("off",H("moduleOff"));case"forbidden":return this.stateBox("forbidden",t("notManager"));case"error":return this.stateBox("error",t("loadFailed"))}if(!e)return this.stateBox("empty",t("emptyAll"),this.meta?.can.create?r`<a class="btn primary" href=${ge("mine",be,{create:!0})} data-new>${$("plus")}${t("newTicket")}</a>`:void 0);const n=e.top?r`<div class="wgrid top">${e.top.make()}</div>`:m;if(!a)return r`${n}${this.kpiRow()}<div class="wgrid">${e.list.map(s=>s.make())}</div>`;const i=Math.min(this.pageIdx,a.length-1);return r`${n}${this.kpiRow()}
      <div class="wpages" data-overview-pages tabindex="-1" @scroll=${this.onTrack}>
        ${a.map((s,o)=>r`<div class="pg" role="group" aria-label=${t("pageOf",{n:o+1,of:a.length})} data-page=${o} data-current=${String(o===i)}>${s.map(d=>d.make(d.fill))}</div>`)}
      </div>`}render(){const e=this.widgets(),a=e?aa(e.list.map(i=>i.span),3):[],n=this.paged&&e?this.lists.paged?ta(e.list.map(i=>i.span),3).map(i=>i.map(s=>({...e.list[s],fill:a[s]}))):[e.list.map((i,s)=>({...i,fill:a[s]}))]:null;return this.pageCount=n?.length??0,this.pageOfKey=new Map((n??[]).flatMap((i,s)=>i.map(o=>[o.key,s]))),r`<sw-page wide class=${`page${this.offline?" stale":""}${this.paged?" paged":""}${this.paged&&!this.lists.paged?" scrolls":""}`} data-screen="tickets-overview" heading=${t("title")} crumbs=${H("area")} data-overview-title=${t("title")}>
      ${this.header(n)}
      ${this.body(e,n)}
    </sw-page>`}};h.pagedMq=window.matchMedia("(min-width: 1181px) and (min-height: 700px)");h.styles=[$e,...ze,qe,ye`
    .n { direction: ltr; unicode-bidi: isolate; display: inline-block; font-variant-numeric: tabular-nums; }
    .amb { font-size: var(--sw-fs-md); color: var(--dv-text-2); }
    .amb em { font-style: normal; color: var(--dv-text); font-weight: var(--sw-fw-semibold); }
    /* AUDIT30-C-TICKETS (#6): sw-page is the frame; the controls row under its header neither sticks nor compacts */
    .dh { position: static; padding-block-start: 0; }
    .crumbs { font-size: var(--sw-fs-sm); color: var(--dv-text-2); margin-block-end: 2px; }
    .titles { min-inline-size: 0; }
    .seg button small { font-size: var(--sw-fs-xs); color: var(--dv-text-2); font-weight: var(--sw-fw-semibold); font-variant-numeric: tabular-nums; margin-inline-start: 6px; }
    .offline-top { position: sticky; inset-block-start: 0; z-index: 16; margin: 0 -36px -16px; padding: 8px 36px; background: linear-gradient(var(--dv-warning-soft), var(--dv-warning-soft)), var(--dv-surface-solid); border-block-end: 1px solid color-mix(in srgb, var(--dv-warning) 38%, transparent); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--au-warn-text); display: flex; align-items: center; gap: 8px; }
    /* the numbers row: the RFQ board's tiles */
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--sw-s-3); }
    .kpi { display: flex; flex-direction: column; gap: 4px; padding: 14px 18px; border-radius: var(--sw-r-xl); border: 1px solid var(--dv-border); background: var(--dv-surface); -webkit-backdrop-filter: var(--dv-surface-blur); backdrop-filter: var(--dv-surface-blur); box-shadow: var(--dv-shadow-1); min-inline-size: 0; color: inherit; text-decoration: none; font: inherit; text-align: start; cursor: pointer; }
    /* POLISH-CONTROL-297: the number tile is a link - it answers hover (fine pointers only), the press and the keyboard (it had a pointer
       cursor and nothing else); transform and colour only, token durations - zero under reduced motion */
    .kpi { transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .kpi:active { transform: scale(0.98); }
    .kpi:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 2px; }
    .kpi small { font-size: var(--sw-fs-sm); color: var(--dv-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* round 2 (dataviz hero number): the tile's number at display size, heavy and tight; the word stays a quiet line */
    .kpi b { font-size: var(--sw-fs-4xl); font-weight: 800; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; color: var(--dv-text); overflow-wrap: anywhere; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 6px; }
    .kpi { gap: 6px; padding: 16px 20px; }
    .kpi.warn b { color: var(--au-warn-text); }
    .kpi.bad b { color: var(--dv-danger); }
    .kpi .d { display: inline-flex; align-items: center; gap: 2px; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--dv-text-3); font-variant-numeric: tabular-nums; }
    .kpi .d.up { color: var(--dv-danger); }
    .kpi .d.down { color: var(--au-ok-text); }
    .kpi .d .ic { font-size: var(--sw-fs-2xs); stroke-width: 2.4; }
    .kpi .least { font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--dv-text-3); }
    .page.stale .kpi b, .page.stale .lane .big, .page.stale .tree .n, .page.stale .cell { color: var(--dv-text-3); }
    .page.stale .load i.on, .page.stale .load i.hot { background: var(--dv-border-strong); }
    /* the widget grid and the widget card */
    .wgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--dv-gap-lg, 18px); align-items: start; }
    .w { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 14px; border-radius: var(--sw-r-2xl); min-inline-size: 0; }
    .w.wide { grid-column: span 2; }
    .w.full { grid-column: 1 / -1; }
    .w > header { display: flex; align-items: center; gap: 10px; min-inline-size: 0; }
    .w > header h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); letter-spacing: -0.015em; line-height: 1.25; min-inline-size: 0; }
    .w > header .q { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); color: var(--dv-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
    .w > header .fold { all: unset; box-sizing: border-box; margin-inline-start: auto; display: grid; place-items: center; inline-size: 32px; block-size: 32px; border-radius: 50%; color: var(--dv-text-3); cursor: pointer; flex: none; }
    .w > header .fold { transition: background-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .w > header .fold:active { transform: scale(0.92); }
    .w > header .fold:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 2px; }
    .w > header .fold .ic { font-size: var(--sw-fs-xl); transition: transform var(--mm-motion, 200ms) var(--mm-ease, ease); }
    .w.folded > header .fold .ic { transform: rotate(90deg); }
    .w.folded > :not(header) { display: none; }
    .w .body { display: flex; flex-direction: column; gap: 10px; min-inline-size: 0; }
    .cnt { display: inline-grid; place-items: center; min-inline-size: 22px; block-size: 22px; padding-inline: 6px; box-sizing: border-box; border-radius: var(--sw-r-pill); background: var(--dv-warning-soft); color: var(--au-warn-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .cnt.info { background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .cnt.bad { background: var(--dv-danger-soft); color: var(--dv-danger); }
    .quiet { display: inline-flex; align-items: center; gap: 8px; min-block-size: 36px; font-size: var(--sw-fs-base); font-weight: var(--sw-fw-semibold); color: var(--au-ok-text); }
    .quiet .ic { font-size: var(--sw-fs-lg); }
    /* round 2 loop 1 (impeccable harden): a widget's "not available now" is a tinted field with its retry, not a grey line in an empty card */
    .unavail { display: flex; align-items: center; gap: 10px; min-block-size: 52px; padding: 10px 14px; border-radius: var(--sw-r-lg); background: color-mix(in srgb, var(--dv-text) 5%, transparent); font-size: var(--sw-fs-base); font-weight: var(--sw-fw-semibold); color: var(--dv-text-2); }
    .unavail .btn { margin-inline-start: auto; }
    .skel { display: flex; flex-direction: column; gap: 10px; }
    .mut { color: var(--dv-text-3); font-size: var(--sw-fs-sm); }
    .note { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    /* where stuck */
    .rooms { flex-wrap: wrap; }
    .rc small { display: inline-grid; place-items: center; min-inline-size: 18px; block-size: 18px; padding-inline: 5px; box-sizing: border-box; margin-inline-start: 8px; border-radius: var(--sw-r-pill); background: color-mix(in srgb, var(--dv-text) 8%, transparent); color: var(--dv-text-2); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-bold); font-variant-numeric: tabular-nums; }
    .rc[aria-pressed='true'] small { background: color-mix(in srgb, currentColor 18%, transparent); color: inherit; }
    .tree { display: flex; flex-direction: column; gap: 2px; }
    .place { display: grid; grid-template-columns: minmax(0, 1fr) 110px auto; align-items: center; gap: 12px; }
    .tree .row { box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; min-block-size: 40px; padding-inline: 8px 12px; border-radius: var(--sw-r-lg); color: var(--dv-text); font-size: var(--sw-fs-base); text-decoration: none; }
    .tree .row { transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .tree .row:active { transform: scale(0.99); }
    .tree .row:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: -2px; }
    .tree .row.l0 .nm { font-weight: var(--sw-fw-bold); }
    .tree .row.l1 { padding-inline-start: 28px; color: var(--dv-text-2); }
    .tree .row.l2 { padding-inline-start: 48px; color: var(--dv-text-2); }
    .tree .row .n { color: var(--dv-accent-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
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
    .crow { transition: background-color var(--sw-t-fast) var(--sw-ease); }
    .crow:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: -2px; }
    .crow b { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; font-weight: var(--sw-fw-bold); }
    .crow .nm small { display: block; color: var(--dv-text-3); font-size: var(--sw-fs-xs); }
    .av { display: inline-grid; place-items: center; flex: none; inline-size: 36px; block-size: 36px; border-radius: 50%; font-weight: 800; font-size: var(--sw-fs-sm); background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .av.ext { color: var(--au-warn-text); background: var(--dv-warning-soft); }
    .st { display: flex; gap: 0; }
    .cell { font-size: var(--sw-fs-md); color: var(--dv-text); font-variant-numeric: tabular-nums; min-inline-size: 58px; text-align: center; }
    .cell small { display: none; font-size: var(--sw-fs-xs); color: var(--dv-text-3); }
    .cell.bad { color: var(--dv-danger); font-weight: var(--sw-fw-bold); }
    .cell.warn { color: var(--au-warn-text); font-weight: var(--sw-fw-bold); }
    .ldc { min-inline-size: 70px; display: grid; justify-items: center; gap: 3px; }
    .ldc small { font-size: var(--sw-fs-xs); color: var(--dv-text-3); }
    .load { display: inline-flex; gap: 3px; align-items: center; }
    .load i { inline-size: 14px; block-size: 6px; border-radius: var(--sw-r-pill); background: var(--dv-surface-3); }
    .load i.on { background: var(--dv-accent); }
    .load i.hot { background: var(--dv-danger); }
    /* POLISH-CONTROL-297: the column heads of the handler table one step up from the smallest size (the audit's 10 px tier) */
    .hhead { display: grid; grid-template-columns: 36px minmax(0, 1.4fr) auto auto; gap: 12px; padding-inline: 6px; font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
    .hhead .st span { min-inline-size: 58px; text-align: center; }
    .hhead .ldc { min-inline-size: 70px; text-align: center; }
    .chip.pur { background: color-mix(in srgb, var(--sw-purple) 16%, transparent); color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text)); }
    .sect { display: flex; flex-direction: column; gap: 8px; }
    .sect > h4 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--dv-text-2); }
    .sect > h4 .today { color: var(--dv-accent-text); }
    /* who waits for whom */
    .lanes { display: grid; gap: 8px; }
    a.blk { text-decoration: none; color: inherit; }
    .lane .bt b { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-md); color: var(--dv-text); }
    .lane .bt small { display: flex; flex-wrap: wrap; gap: 2px 10px; }
    .lane .big { font-size: var(--sw-fs-3xl); font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: var(--dv-text); min-inline-size: 32px; text-align: center; }
    .lane .bi.me { background: var(--dv-accent-soft); color: var(--dv-accent-text); }
    .lane .bi.ext { background: color-mix(in srgb, var(--sw-purple) 16%, transparent); color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text)); }
    /* rows: overdue and the agenda */
    .closedrows { display: flex; flex-direction: column; padding: 4px 0; }
    .closedrows .cr { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 6px 14px; min-block-size: 44px; padding: 6px 10px; color: var(--dv-text); font-size: var(--sw-fs-base); text-align: start; text-decoration: none; border-radius: var(--sw-r-lg); }
    .closedrows .cr + .cr { border-block-start: 1px solid var(--dv-border); }
    .closedrows .cr { transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .closedrows .cr:active { transform: scale(0.99); }
    .closedrows .cr:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: -2px; }
    .closedrows .cr .num { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; color: var(--dv-text-3); font-weight: var(--sw-fw-semibold); }
    .closedrows .cr b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-inline-size: 0; }
    .closedrows .cr b small { display: block; font-weight: var(--sw-fw-regular); color: var(--dv-text-2); overflow: hidden; text-overflow: ellipsis; }
    .closedrows .cr .who { color: var(--dv-text-2); white-space: nowrap; }
    .cwarn { display: inline-flex; align-items: center; gap: 6px; font-weight: var(--sw-fw-semibold); color: var(--au-warn-text); }
    .cwarn.bad { color: var(--dv-danger); }
    .back { color: var(--dv-text-3); }
    /* the department comparison */
    .rtbl { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-base); }
    .rtbl th { text-align: start; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--dv-text-2); padding: 6px 8px; border-block-end: 1px solid var(--dv-border); white-space: nowrap; }
    .rtbl td { padding: 10px 8px; border-block-end: 1px solid var(--dv-border); vertical-align: middle; font-variant-numeric: tabular-nums; }
    .rtbl tr:last-child td { border-block-end: 0; }
    .rtbl .num { text-align: center; }
    .rtbl td.bad { color: var(--dv-danger); font-weight: var(--sw-fw-bold); }
    .tl { display: inline-flex; align-items: center; gap: 5px; color: var(--dv-accent-text); font-weight: var(--sw-fw-semibold); text-decoration: none; min-block-size: 32px; }
    @media (hover: hover) and (pointer: fine) {
      .tl:hover { text-decoration: underline; }
    }
    .dcards { display: none; }
    /* phase 3: how much was handled, opened vs closed, waiting for my approval, requests for quotation */
    .w > header .pseg { margin-inline-start: auto; flex: none; }
    .w > header .pseg + .fold { margin-inline-start: 4px; }
    .rtbl.tp td.who { font-weight: var(--sw-fw-semibold); max-inline-size: 0; inline-size: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rtbl.tp td.mut { color: var(--dv-text-2); font-size: var(--sw-fs-sm); }
    .rtbl tfoot td { font-weight: var(--sw-fw-bold); border-block-start: 1px solid var(--dv-border-strong, var(--dv-border)); border-block-end: 0; }
    .net { font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    .bars { display: grid; gap: 6px; }
    .bars svg { inline-size: 100%; block-size: 132px; display: block; overflow: visible; }
    .bars .bo { fill: var(--dv-accent); }
    .bars .bc { fill: var(--dv-success, var(--sw-success)); }
    .bars .bl { font-size: var(--sw-fs-2xs); text-anchor: middle; fill: var(--dv-text-2); }
    .bars .ax { font-size: var(--sw-fs-2xs); text-anchor: middle; fill: var(--dv-text-3); }
    .bars .base { stroke: var(--dv-border); }
    .bars .lg { display: flex; gap: 14px; font-size: var(--sw-fs-xs); color: var(--dv-text-2); }
    .bars .lg span { display: inline-flex; align-items: center; gap: 5px; }
    .bars .lg i { inline-size: 10px; block-size: 10px; border-radius: var(--sw-r-2xs); display: inline-block; }
    .bars .lg i.o { background: var(--dv-accent); }
    .bars .lg i.c { background: var(--dv-success, var(--sw-success)); }
    .closedrows .cr .amt { font-weight: var(--sw-fw-bold); color: var(--dv-text); white-space: nowrap; }
    .closedrows .cr .tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
    .closedrows .cr .tags .chip .ic { font-size: var(--sw-fs-xs); }
    .dcard.total { background: transparent; }
    /* phase 4: an instalment row - the title takes the line, the due chip and the amount the line under it (the card is a third wide) */
    .closedrows .cr[data-pay-row='instalment'] { grid-template-columns: auto minmax(0, 1fr) auto; }
    .closedrows .cr[data-pay-row='instalment'] .tags { grid-column: 2; grid-row: 2; justify-content: flex-start; align-items: center; gap: 8px; }
    .closedrows .cr[data-pay-row='instalment'] .back { grid-column: 3; grid-row: 1 / span 2; }
    .vh { position: absolute !important; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    /* OVERVIEWFIT-297 (owner rule: a control screen never scrolls on a desktop; owner option א): on a desktop (.paged, set from
       TicketsOverview.pagedMq) the screen takes the window's height; the widgets keep their order and grid spans and are cut into pages
       of two rows that fill what is left under the numbers row; the pages sit side by side in a track that snaps page by page (the
       pager, a swipe, a trackpad, the keyboard focus). A long widget scrolls inside its own card. Elsewhere .wb is transparent and the
       page scrolls as before (tablet, phone, a short window). */
    .wb { display: contents; }
    .page.paged { block-size: 100%; min-block-size: 0; box-sizing: border-box; padding-block-end: 0; }
    .paged .wpages { flex: 1 1 auto; min-block-size: 420px; display: grid; grid-auto-flow: column; grid-auto-columns: 100%; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none; margin-inline: -36px; outline: none; }
    .paged .wpages::-webkit-scrollbar { display: none; }
    .paged .pg { box-sizing: border-box; min-inline-size: 0; min-block-size: 0; padding: 2px 36px 22px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: var(--dv-gap-lg, 18px); scroll-snap-align: start; scroll-snap-stop: always; }
    .paged .pg > .w { min-block-size: 0; overflow: hidden; }
    /* PAGING-SETTING-2439: the long lists scroll - one page of every widget, rows of a fixed height, the track scrolls vertically */
    .paged.scrolls .wpages { overflow-x: hidden; overflow-y: auto; scroll-snap-type: none; overscroll-behavior-y: contain; scrollbar-width: thin; }
    .paged.scrolls .pg { grid-template-rows: none; grid-auto-rows: minmax(300px, 38vh); scroll-snap-align: none; }
    .paged .pg > .w.folded { align-self: start; }
    .paged .w > .wb { flex: 1 1 auto; min-block-size: 0; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-width: thin; margin-inline: -6px; padding-inline: 6px; padding-block-end: 14px; -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 18px), transparent); }
    /* break-ui: a reference number never splits over two lines in a third-wide card */
    .closedrows .cr .num { white-space: nowrap; }
    .paged .wgrid.top > .w { max-block-size: 30vh; overflow: hidden; }
    .paged .wgrid.top > .w > .wb { flex: 1 1 auto; min-block-size: 0; overflow-y: auto; scrollbar-width: thin; display: flex; flex-direction: column; gap: 12px; }
    /* many departments: one row that scrolls sideways (the controls row never grows into the widgets' room) */
    .paged .dh-det { flex-wrap: nowrap; }
    .paged .dh-det .depts { flex: 0 1 auto; min-inline-size: 0; overflow-x: auto; scrollbar-width: none; }
    .paged .dh-det .depts.over:dir(rtl) { -webkit-mask-image: linear-gradient(to left, transparent, #000 28px); mask-image: linear-gradient(to left, transparent, #000 28px); }
    .paged .dh-det .depts.over:dir(ltr) { -webkit-mask-image: linear-gradient(to right, transparent, #000 28px); mask-image: linear-gradient(to right, transparent, #000 28px); }
    .paged .dh-det .depts > button { flex: none; }
    .paged .dh-det .amb { white-space: nowrap; }
    .pager { display: inline-flex; align-items: center; gap: 2px; flex: none; }
    .pager .pgb { all: unset; box-sizing: border-box; display: grid; place-items: center; inline-size: 34px; block-size: 34px; border-radius: 50%; color: var(--dv-text-2); cursor: pointer; }
    .pager .pgb .ic { font-size: var(--sw-fs-lg); }
    .pager .pgb.next .ic { transform: scaleX(-1); }
    .pager:dir(ltr) .pgb.prev .ic { transform: scaleX(-1); }
    .pager:dir(ltr) .pgb.next .ic { transform: none; }
    .pager .pgb { transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), background-color 140ms ease; }
    .pager .pgb:active:not([disabled]) { transform: scale(0.94); }
    /* mobile-native: a large touch screen (an iPad Pro in landscape) also gets the pages - no tap flash, no double-tap delay, no label selection */
    .pager .pgb, .pager .pd { touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
    .pager .pgb[disabled] { opacity: 0.35; cursor: default; }
    .pager .pds { display: inline-flex; align-items: center; }
    .pager .pd { all: unset; box-sizing: border-box; display: grid; place-items: center; min-inline-size: 24px; block-size: 34px; padding-inline: 2px; cursor: pointer; }
    .pager .pd i { display: block; inline-size: 8px; block-size: 8px; border-radius: var(--sw-r-pill); background: var(--dv-border-strong, var(--dv-text-3)); transition: inline-size 180ms cubic-bezier(0.23, 1, 0.32, 1), background-color 180ms ease; }
    .pager .pd.alert i { background: var(--dv-danger); }
    .pager .pd[aria-current='page'] i { inline-size: 22px; background: var(--dv-accent); }
    @media (hover: hover) and (pointer: fine) {
      .pager .pgb:hover:not([disabled]) { background: var(--dv-surface-3); color: var(--dv-text); }
      .pager .pd:hover i { background: var(--dv-text-2); }
      .pager .pd[aria-current='page']:hover i { background: var(--dv-accent); }
    }
    .pager .pgb:focus-visible, .pager .pd:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 2px; border-radius: var(--sw-r-pill); }
    .pager .pgn { font-size: var(--sw-fs-sm); color: var(--dv-text-2); font-weight: var(--sw-fw-semibold); min-inline-size: 30px; text-align: center; }
    @media (pointer: coarse) {
      .pager .pgb { inline-size: 44px; block-size: 44px; }
      .pager .pd { block-size: 44px; }
    }
    @media (max-width: 1180px) {
      .wgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 767px) {
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
      .dcard .nums em { font-style: normal; font-weight: var(--sw-fw-bold); color: var(--dv-text); font-variant-numeric: tabular-nums; }
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
    /* POLISH-CONTROL-297: hover is for fine pointers only - a touch never leaves a tile, a row or the fold button lit */
    @media (hover: hover) and (pointer: fine) {
      .kpi:hover { border-color: var(--dv-border-strong, var(--dv-border)); box-shadow: var(--dv-shadow-2); }
      .w > header .fold:hover { background: var(--dv-surface-3); color: var(--dv-text); }
      .tree .row:hover { background: color-mix(in srgb, var(--dv-text) 6%, transparent); }
      .crow:hover { background: var(--dv-surface-2); }
      .closedrows .cr:hover { background: var(--dv-surface-3); }
    }
    @media (prefers-reduced-motion: reduce) {
      .w > header .fold .ic { transition: none; }
      .kpi, .tree .row, .crow, .closedrows .cr, .w > header .fold { transition: none; }
      .pager .pd i, .pager .pgb { transition: none; }
    }
  `,na];f([xe({attribute:!1})],h.prototype,"route",2);f([w()],h.prototype,"screen",2);f([w()],h.prototype,"module",2);f([w()],h.prototype,"meta",2);f([w()],h.prototype,"data",2);f([w()],h.prototype,"dept",2);f([w()],h.prototype,"rfqs",2);f([w()],h.prototype,"rfqFailed",2);f([w()],h.prototype,"details",2);f([w()],h.prototype,"vendorIds",2);f([w()],h.prototype,"handled",2);f([w()],h.prototype,"approval",2);f([w()],h.prototype,"reason",2);f([w()],h.prototype,"folded",2);f([w()],h.prototype,"allOverdue",2);f([w()],h.prototype,"offline",2);f([w()],h.prototype,"lastOk",2);f([w()],h.prototype,"now",2);f([w()],h.prototype,"phone",2);f([w()],h.prototype,"yesterday",2);f([w()],h.prototype,"summary",2);f([w()],h.prototype,"summaryFailed",2);f([w()],h.prototype,"period",2);f([w()],h.prototype,"expanded",2);f([w()],h.prototype,"payments",2);f([w()],h.prototype,"paymentsFailed",2);f([w()],h.prototype,"paged",2);f([w()],h.prototype,"pageIdx",2);h=f([ke("tickets-overview")],h);export{h as TicketsOverview};
