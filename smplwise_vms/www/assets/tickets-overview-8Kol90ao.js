import{i as L,S as M,f as C,L as N,a as P,o as F,b as H,m as I,c as B,t as S,s as K,d as V,A as x,e as O,g as W,r as U,h as j,H as Q,j as G,k as J,l as q,n as Z,p as Y,q as X,F as _,u as aa,v as ea,w as c,x as n,y as e,z as f,B as A,C as g,D as ta,E as sa,G as ia,I as na,J as y,M as k,K as z,N as ra,O as oa,P as la,Q as da,R as D,T,U as ca,V as pa,W as ha,X as ua,Y as va,Z as ma,_ as fa,$ as wa,a0 as ga,a1 as ba,a2 as xa,a3 as v,a4 as $a}from"./index-COD9JXrQ.js";var ya=Object.defineProperty,ka=Object.getOwnPropertyDescriptor,u=(a,s,i,r)=>{for(var t=r>1?void 0:r?ka(s,i):s,l=a.length-1,o;l>=0;l--)(o=a[l])&&(t=(r?o(s,i,t):o(t))||t);return r&&t&&ya(s,i,t),t};const za=6e4,Sa=6e5,Oa=12,qa=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/,_a="sw.tickets.overview.kpis.",E=a=>{try{return globalThis.localStorage.getItem(a)}catch{return null}},R=(a,s)=>{try{globalThis.localStorage.setItem(a,s)}catch{}};let h=class extends L{constructor(){super(...arguments),this.bubbleSkin=new M(this),this.route=null,this.screen="loading",this.module=null,this.meta=null,this.data=null,this.dept="",this.rfqs=null,this.rfqFailed=!1,this.details=new Map,this.vendorIds=new Set,this.handled=null,this.approval=null,this.reason="",this.folded=C(E(_),window.matchMedia("(max-width: 767px)").matches),this.allOverdue=!1,this.offline=!1,this.lastOk=null,this.now=new Date,this.phone=window.matchMedia("(max-width: 767px)").matches,this.compactHeader=!1,this.yesterday=null,this.seq=0,this.slowAt=0,this.slowKey="",this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offNames=null,this.offMe=null,this.pushAt=0,this.live=new N(()=>{this.now=new Date,this.screen==="ready"&&this.load(!0)},za),this.onOnline=()=>{this.screen==="ready"&&this.load(!0)},this.onScroll=()=>{const a=this.scrollTop>40;a!==this.compactHeader&&(this.compactHeader=a)},this.retrySlow=()=>{this.slowAt=0,this.loadSlow()}}connectedCallback(){super.connectedCallback(),P(this),this.phoneMq.addEventListener("change",this.onPhone),this.addEventListener("scroll",this.onScroll,{passive:!0}),this.offNames=F(()=>this.requestUpdate()),this.offMe=H(a=>{if(a.type!=="notification"||this.screen!=="ready")return;const s=Date.now();s-this.pushAt<5e3||(this.pushAt=s,this.load(!0))}),window.addEventListener("online",this.onOnline),this.live.start(),this.boot()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq.removeEventListener("change",this.onPhone),this.removeEventListener("scroll",this.onScroll),window.removeEventListener("online",this.onOnline),this.offNames?.(),this.offMe?.(),this.live.stop()}willUpdate(a){if(a.has("route")&&this.route){const s=this.route.params.get("dept")??"",i=qa.test(s)?s:"";i!==this.dept&&(this.dept=i,this.reason="",this.allOverdue=!1,this.screen==="ready"&&this.load(!1))}}updated(){I(this.renderRoot,this.phone)}settings(){return B({...this.module?.ui??{},...this.data?.ui??{}})}async boot(){try{const a=await S().module();if(this.module=a,K(a.name),!a.enabled){this.screen="off";return}this.meta=await S().meta().catch(()=>null),V().contacts({kind:"vendor"}).then(s=>this.vendorIds=new Set(s.contacts.map(i=>i.id))).catch(()=>{}),await this.load(!1)}catch(a){this.fail(a)}}fail(a){a instanceof x&&a.status===403?this.screen="forbidden":a instanceof x&&a.status===404&&a.body.code==="feature_disabled"?this.screen="off":this.screen="error"}async load(a){const s=++this.seq;!a&&!this.data&&(this.screen="loading");try{const i=await O().board({department_id:this.dept||void 0});if(s!==this.seq)return;this.data=i,this.now=new Date,this.lastOk=this.now,this.offline=!1,this.screen="ready",this.rememberKpis();const r=this.dept;(!a||r!==this.slowKey||Date.now()-this.slowAt>=Sa)&&(this.slowKey=r,this.slowAt=Date.now(),this.loadSlow())}catch(i){if(s!==this.seq)return;if(this.data&&!(i instanceof x)){this.offline=!0;return}if(a&&this.data&&i instanceof x&&i.status>=500)return;this.fail(i)}}async loadSlow(){const a=this.dept||void 0,s=W();Promise.all(["open","awarded","ordered"].map(t=>s.list({state:t,department_id:a,limit:100}))).then(async t=>{if(this.slowKey!==(a??""))return;const l=t.flatMap(m=>m.items);this.rfqs=l,this.rfqFailed=!1;const o=l.filter(m=>m.state==="awarded"||m.state==="ordered").slice(0,Oa),d=await Promise.all(o.map(m=>s.get(m.id).catch(()=>null))),p=new Map;for(const m of d)m&&p.set(m.id,m);this.details=p}).catch(t=>{t instanceof x&&(t.status===403||t.status===404)?(this.rfqs=[],this.rfqFailed=!1):this.rfqFailed=!0});const r=U();O().handlerLoad(r??void 0).then(t=>{const l=j(t.days)??Q;this.handled={days:l,counts:t.handled}}).catch(()=>this.handled=null),G("tickets.costs.view")?J().accountClaims({status:["submitted"],...a?{department:a}:{}}).then(t=>this.approval=t.rows.length).catch(()=>this.approval=null):this.approval=null}kpis(){const a=this.data;return{open:a.counts.all,stuck:a.counts.stuck,waiting:a.counts.waiting,overdue:q(a.items,this.rfqs??[],this.now).length,approval:this.approval}}rememberKpis(){const a=`${_a}${this.dept||"all"}`,{store:s,yesterday:i}=Z(X(E(a)),this.kpis(),Y(this.now));R(a,JSON.stringify(s)),this.yesterday=i}toggleFold(a){const s=new Set(this.folded);s.has(a)?s.delete(a):s.add(a),this.folded=s,R(_,JSON.stringify([...s]))}setDept(a){aa("/tickets/overview",a?new URLSearchParams({dept:a}):void 0),this.dept=a,this.reason="",this.allOverdue=!1,this.load(!1)}href(a={},s){return ea({dept:this.dept,...a},s?{t:s}:{})}widget(a,s,i,r,t={}){const l=this.folded.has(a);return n`<section class=${`glass w ${t.cls??""}${l?" folded":""}`} data-widget=${a} id=${`w-${a}`}>
      <header><h2>${s}${t.badge??c}</h2>${i?n`<span class="q">${i}</span>`:c}
        <button type="button" class="fold" data-fold=${a} aria-expanded=${String(!l)} aria-label=${e(l?"unfold":"fold",{name:s})} @click=${()=>this.toggleFold(a)}>${f("chevronDown")}</button></header>
      ${r}
    </section>`}quiet(a){return n`<div class="body"><div class="quiet" data-quiet>${f("check")}${a}</div></div>`}skeleton(a,s){return n`<div class="skel" aria-busy="true">${Array.from({length:a},()=>n`<span class="skl" style=${`block-size:${s}px`}></span>`)}</div>`}header(){const a=this.data,s=a?.departments??[],i=!!a?.all_departments,r=s.reduce((t,l)=>t+l.count,0);return n`<header class=${`dh${this.compactHeader?" compact":""}`} data-overview-header>
      ${this.offline&&this.lastOk?n`<div class="offline-top" role="status" data-offline>${f("offline")}${e("offline",{time:this.lastOk.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})})}</div>`:c}
      <div class="dh-row"><div class="titles"><div class="crumbs">${A("area")}</div><h1 data-overview-title>${e("title")}</h1></div></div>
      ${this.screen==="ready"||this.screen==="loading"?n`<div class="dh-det">
        ${s.length>1?n`<div class="seg sm depts" role="radiogroup" aria-label=${e("deptGroup")} data-dept-chips>
          <button type="button" role="radio" aria-checked=${String(!this.dept)} data-dept="" @click=${()=>this.setDept("")}>${e(i?"allDepts":"allMyDepts")}<small>${r}</small></button>
          ${s.map(t=>n`<button type="button" role="radio" aria-checked=${String(this.dept===t.id)} data-dept=${t.id} @click=${()=>this.setDept(t.id)}>${g(t.name)}<small>${t.count}</small></button>`)}
        </div>`:c}
        ${this.lastOk?n`<span class="amb" data-updated>${e("updated",{when:""}).trim()} <em>${this.now.getTime()-this.lastOk.getTime()<6e4?e("justNow"):ta(this.lastOk.toISOString(),this.now)}</em></span>`:c}
        <span class="grow"></span>
        <a class="btn sm hide-ph" href=${this.href()} data-to-board>${f("ticket")}${e("toBoard")}</a>
      </div>`:c}
    </header>`}kpiRow(){if(this.screen==="loading"||!this.data)return n`<div class="kpis" aria-busy="true">${Array.from({length:5},()=>n`<span class="skl" style="block-size:76px;border-radius:14px"></span>`)}</div>`;const a=this.kpis(),s=sa(a,this.yesterday),i=this.data.truncated,r=(t,l,o,d,p,m=!1)=>{const w=s[t],$=n`<small>${e(l)}</small><b>${m&&p?n`<span class="least" data-at-least>${e("atLeast",{n:""}).trim()}</span>`:c}<span class="n">${p}</span>${w?n`<span class=${`d ${w>0?"up":"down"}`} title=${e(w>0?"yesterdayUp":"yesterdayDown",{n:Math.abs(w)})} data-delta=${w}>${f(w>0?"up":"down")}<span class="n">${Math.abs(w)}</span><span class="vh">${e(w>0?"yesterdayUp":"yesterdayDown",{n:Math.abs(w)})}</span></span>`:c}</b>`,b=`kpi ${p?o:""}`;return d?n`<a class=${b} href=${d} data-kpi=${t}>${$}</a>`:n`<button type="button" class=${b} data-kpi=${t} @click=${()=>this.reveal("overdue")}>${$}</button>`};return n`<div class="kpis" data-kpis>
      ${r("open","kOpen","",this.href(),a.open)}
      ${r("stuck","kStuck","warn",this.href({state:"stuck"}),a.stuck)}
      ${r("waiting","kWaiting","",this.href({state:"waiting"}),a.waiting)}
      ${r("overdue","kOverdue","bad",null,a.overdue,i)}
      ${a.approval!==null?r("approval","kApproval","","#/tickets/accounts",a.approval):c}
    </div>`}reveal(a){this.folded.has(a)&&this.toggleFold(a),this.updateComplete.then(()=>this.renderRoot.querySelector(`#w-${a}`)?.scrollIntoView({block:"start",behavior:"smooth"}))}whereStuck(){const a=this.data;if(!a.counts.stuck&&!a.items.some(o=>o.stuck))return this.quiet(e("stNone"));const s=ia(a.items),i=Object.values(s).reduce((o,d)=>o+d,0),r=na(a.items,a.tree,this.reason),t=Math.max(1,...r.map(o=>o.count)),l={unopened:"bad",overdue:"bad",ack:"warn",stuck:"warn",waiting:"acc",unassigned:""};return n`<div class="body">
      <div class="rooms" role="group" aria-label=${e("stReasons")} data-reasons>
        <button type="button" class="rc" aria-pressed=${String(!this.reason)} data-reason="" @click=${()=>this.reason=""}>${e("stAll")}<small>${i}</small></button>
        ${y.filter(o=>s[o]).map(o=>n`<button type="button" class="rc" aria-pressed=${String(this.reason===o)} data-reason=${o} @click=${()=>this.reason=this.reason===o?"":o}>${e(`rs_${o}`)}<small>${s[o]}</small></button>`)}
      </div>
      <div class="tree" role="list" aria-label=${e("stTree")} data-places>
        ${r.map(o=>n`<div class="place" role="listitem" data-place=${o.key}>
            <a class=${`row l${o.level}`} href=${this.href({state:"stuck",place:o.key})}><span class="nm">${o.kind==="none"?e("noPlace"):g(o.name)}</span><span class="n">${o.count}</span></a>
            <div class="track" aria-hidden="true"><span style=${`inline-size:${Math.round(o.count/t*100)}%`}></span></div>
            <span class="mut">${o.level===0&&o.open?e("stOfOpen",{n:o.open}):""}</span>
          </div>
          ${o.level===0&&!this.reason?n`<div class="why" data-why=${o.key}>${y.filter(d=>o.why[d]).map(d=>n`<span><i class=${`dot ${l[d]}`}></i>${e(`rs_${d}`)} <span class="n">${o.why[d]}</span></span>`)}</div>`:c}`)}
      </div>
    </div>`}handlerList(a){const s=this.handled?.days;return n`<div class="crows">${a.map(i=>{const r=i.name.split(/\s+/).filter(Boolean).slice(0,2).map(t=>t[0]).join("");return n`<a class="crow" href=${this.href({assignee:i.key})} data-handler=${i.key} ?data-busy=${i.busy}>
        <span class=${`av${i.vendor?" ext":""}`} aria-hidden="true">${r}</span>
        <span class="nm"><b>${g(i.name)}${i.vendor&&this.settings().vendors==="tagged"?n`<span class="chip pur xs" data-vendor-tag>${e("ldVendor")}</span>`:c}${i.busy?n`<span class="chip warn xs" data-busy-tag>${e("ldBusy")}</span>`:c}</b>
          <small>${i.open?e("ldOldest",{age:z(this.now.getTime()-Date.parse(i.oldestAt??""))}):e("ldFree")}</small></span>
        <span class="st">
          <span class="cell"><span class="n">${i.open}</span><small>${e("ldOpen")}</small></span>
          <span class=${`cell${i.waiting?" warn":""}`}><span class="n">${i.waiting}</span><small>${e("ldWaiting")}</small></span>
          <span class=${`cell${i.stuck?" bad":""}`}><span class="n">${i.stuck}</span><small>${e("ldStuck")}</small></span>
          ${s&&i.handled!==void 0?n`<span class="cell" data-handled><span class="n">${i.handled}</span><small>${e("ldHandled")}</small></span>`:c}
        </span>
        <span class="ldc"><span class="load" role="img" aria-label=${e("ldMeter",{on:i.meter,total:k})}>${Array.from({length:k},(t,l)=>n`<i class=${l<i.meter?i.busy?"hot":"on":""}></i>`)}</span><small>${i.meter}/${k}</small></span>
      </a>`})}</div>`}loadCard(){const a=this.data,s=this.settings(),i=ra(a.items,this.vendorIds,s,this.handled?.counts??null),r=i.filter(p=>p.busy).length;if(!i.length)return{body:this.quiet(e("ldNone")),busy:r};const{staff:t,vendors:l}=oa(i,s.vendors),o=this.handled?.days,d=n`<div class="hhead" aria-hidden="true"><span></span><span></span><span class="st"><span>${e("ldOpen")}</span><span>${e("ldWaiting")}</span><span>${e("ldStuck")}</span>${o?n`<span>${e("ldHandled")} · ${la(`hd_${o}`)}</span>`:c}</span><span class="ldc">${e("ldLoad")}</span></div>`;return{busy:r,body:n`<div class="body" data-load-mode=${s.vendors}>
        ${d}
        ${s.vendors==="separate"?n`<div class="sect"><h4>${e("ldStaff")} <span class="n">· ${t.length}</span></h4>${this.handlerList(t)}</div>
          ${l.length?n`<div class="sect" data-vendor-list><h4>${e("ldVendors")} <span class="n">· ${l.length}</span></h4>${this.handlerList(l)}</div>`:c}`:this.handlerList(t)}
      </div>`}}whoWaits(){const a=this.data,s=da(a.items,this.vendorIds);if(!s.some(t=>t.count))return this.quiet(e("wwNone"));const i={me:{label:"wwMe",icon:"user",cls:"me",href:this.href({state:"waiting"})},staff:{label:"wwStaff",icon:"users",cls:"",href:this.href()},vendors:{label:"wwVendors",icon:"truck",cls:"ext",href:this.href()}},r=(t,l)=>t==="me"?ma(l):y.includes(l)?e(`rs_${l}`):"";return n`<div class="body"><div class="lanes">${s.filter(t=>t.count||t.id==="me").map(t=>{const l=i[t.id],o=t.reasons.map(d=>({t:r(t.id,d.key),n:d.n})).filter(d=>d.t);return n`<a class="blk lane" href=${l.href} data-lane=${t.id}><span class=${`bi ${l.cls}`}>${f(l.icon)}</span>
        <span class="bt"><b>${e(l.label)}${t.oldestAt?n`<span class="mut">${e("wwOldest",{age:z(this.now.getTime()-Date.parse(t.oldestAt))})}</span>`:c}</b>
          ${o.length?n`<small>${o.map((d,p)=>n`${p?n`<span aria-hidden="true">·</span>`:c}<span>${d.t} · <span class="n">${d.n}</span></span>`)}</small>`:c}</span>
        <span class="big"><span class="n">${t.count}</span></span></a>`})}</div></div>`}overdueCard(){const a=this.data,s=q(a.items,this.rfqs??[],this.now);if(!s.length)return{body:this.quiet(e("odNone")),count:0};const i=this.allOverdue?s:s.slice(0,D),r={sla:"odSla",eta:"odEta",rfq:"odRfq"};return{count:s.length,body:n`<div class="body"><div class="closedrows" data-overdue>${i.map(t=>n`<a class="cr" href=${t.rfq?T({id:t.id}):this.href({},t.id)} data-overdue-row=${t.kind}>
          <span class="num">${t.ref}</span><b>${g(t.title)}<small><span class=${`cwarn ${t.tone}`}>${f("clock")}${e("odBy",{what:e(r[t.kind]),dur:z(t.late)})}</span></small></b>
          <span class="who">${t.who?g(t.who):e("odNobody")}</span><span class="back">${f("back")}</span></a>`)}</div>
        ${s.length>D?n`<div><button type="button" class="btn sm" aria-expanded=${String(this.allOverdue)} data-overdue-all @click=${()=>this.allOverdue=!this.allOverdue}>${this.allOverdue?e("showLess"):e("showAll")}<small class="mut">· ${s.length}</small></button></div>`:c}
        ${a.truncated?n`<div class="note" data-truncated>${e("truncated",{n:a.items.length})}</div>`:c}
      </div>`}}agendaCard(){const a=this.data,s=ca([...this.details.values()]),i=pa(a.items,this.rfqs??[],this.details,s,this.vendorIds,this.now),r={visit_vendor:"agVisitVendor",visit_staff:"agVisitStaff",work_start:"agWorkStart",rfq_due:"agRfqDue",payment:"agPayment"},t={visit_vendor:"acc",visit_staff:"acc",work_start:"ok",rfq_due:"pur",payment:"warn"},l=(d,p)=>{const[m,w,$]=d.split("-").map(Number),b=new Date(m,w-1,$).toLocaleDateString([],{weekday:"long",day:"numeric",month:"numeric"});return p===0?`${e("agToday")} · ${b}`:p===1?`${e("agTomorrow")} · ${b}`:b},o=this.rfqFailed?n`<div class="unavail" data-partial>${e("agRfqPartial")}<button type="button" class="btn sm" @click=${this.retrySlow}>${f("refresh")}${e("retry")}</button></div>`:c;return i.length?n`<div class="body" data-agenda>${o}${i.map(d=>n`<div class="sect day" data-day=${d.key}><h4><span class=${d.offset===0?"today":""}>${l(d.key,d.offset)}</span></h4>
      <div class="closedrows">${d.entries.map(p=>n`<a class="cr" href=${p.rfq?T({id:p.id}):this.href({},p.id)} data-agenda-row=${p.kind}>
        <span class="num">${p.timed?new Date(p.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):e("agAllDay")}</span>
        <b><i class=${`dot ${t[p.kind]}`}></i> ${e(r[p.kind])}<small>${[p.who,`${p.ref} · ${p.title}`,p.place].filter(Boolean).map(m=>g(m)).join(" · ")}</small></b>
        <span></span><span class="back">${f("back")}</span></a>`)}</div></div>`)}</div>`:n`${o}${this.quiet(e("agNone"))}`}departmentsCard(){const a=this.data,s=ha(a.items,a.departments,this.vendorIds,this.settings(),this.now),i=r=>`#/tickets/overview?${new URLSearchParams({dept:r}).toString()}`;return n`<div class="body" data-compare>
      <table class="rtbl"><thead><tr><th>${e("cmpDept")}</th><th class="num">${e("cmpOpen")}</th><th class="num">${e("cmpStuck")}</th><th class="num">${e("cmpOverdue")}</th><th class="num">${e("cmpWaiting")}</th><th class="num">${e("cmpBusy")}</th></tr></thead>
        <tbody>${s.map(r=>n`<tr data-dept-row=${r.id}><td><a class="tl" href=${i(r.id)}>${g(r.name)}</a></td><td class="num"><span class="n">${r.open}</span></td><td class=${`num${r.stuck>2?" bad":""}`}><span class="n">${r.stuck}</span></td><td class=${`num${r.overdue>2?" bad":""}`}><span class="n">${r.overdue}</span></td><td class="num"><span class="n">${r.waiting}</span></td><td class="num"><span class="n">${r.busy}</span></td></tr>`)}</tbody></table>
      <div class="dcards">${s.map(r=>n`<a class="dcard" href=${i(r.id)} data-dept-card=${r.id}><b>${g(r.name)}</b><span class="nums"><span>${e("cmpOpen")} <em>${r.open}</em></span><span>${e("cmpStuck")} <em>${r.stuck}</em></span><span>${e("cmpOverdue")} <em>${r.overdue}</em></span><span>${e("cmpWaiting")} <em>${r.waiting}</em></span><span>${e("cmpBusy")} <em>${r.busy}</em></span></span></a>`)}</div>
    </div>`}stateBox(a,s,i,r){return n`<div class="statebox glass" role="status" data-overview-state=${i}><span class="ring">${f(a)}</span><b>${s}</b>${r??c}</div>`}loadingGrid(){const a=(s,i,r)=>n`<section class=${`glass w ${s}`}><header><span class="skl" style="block-size:20px;inline-size:40%"></span></header>${this.skeleton(i,r)}</section>`;return n`<div class="wgrid" data-overview-state="loading">${a("wide",5,40)}${a("",3,56)}${a("wide",5,52)}${a("",4,44)}${a("full",4,44)}</div>`}body(){switch(this.screen){case"loading":return n`${this.kpiRow()}${this.loadingGrid()}`;case"off":return this.stateBox("ticket",A("moduleOff"),"off");case"forbidden":return this.stateBox("lock",e("notManager"),"forbidden");case"error":return this.stateBox("warning",e("loadFailed"),"error",n`<button type="button" class="btn sm" data-retry @click=${()=>{this.screen="loading",this.data=null,this.boot()}}>${f("refresh")}${e("retry")}</button>`)}const a=this.data;if(!a.counts.all&&!a.counts.closed_all&&!a.items.length)return this.stateBox("ticket",e("emptyAll"),"empty",this.meta?.can.create?n`<a class="btn primary" href=${ua("mine",va,{create:!0})} data-new>${f("plus")}${e("newTicket")}</a>`:void 0);const s=this.settings(),i=a.all_departments&&!this.dept&&a.departments.length>1?this.widget("departments",e("cmpTitle"),e("cmpQ"),this.departmentsCard(),{cls:"full"}):c,r=this.loadCard(),t=this.overdueCard(),l=a.counts.stuck;return n`
      ${s.compare==="top"?n`<div class="wgrid">${i}</div>`:c}
      ${this.kpiRow()}
      <div class="wgrid">
        ${s.compare==="below_numbers"?i:c}
        ${this.widget("stuck",e("stTitle"),e("stQ"),this.whereStuck(),{cls:"wide",badge:l?n` <span class="cnt" data-count>${l}</span>`:c})}
        ${this.widget("waits",e("wwTitle"),e("wwQ"),this.whoWaits())}
        ${this.widget("load",e("ldTitle"),e("ldQ"),r.body,{cls:"wide",badge:r.busy?n` <span class="cnt bad" data-count>${e("ldBusyCount",{n:r.busy})}</span>`:c})}
        ${this.widget("overdue",e("odTitle"),e("odQ"),t.body,{badge:t.count?n` <span class="cnt bad" data-count>${t.count}</span>`:c})}
        ${this.widget("upcoming",e("agTitle"),e("agQ"),this.agendaCard(),{cls:"full"})}
        ${s.compare==="bottom"?i:c}
      </div>`}render(){return n`<div class=${`page${this.offline?" stale":""}`} data-screen="tickets-overview">
      ${this.header()}
      ${this.body()}
    </div>`}};h.styles=[fa,...wa,ga,ba`
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
    }
    @media (pointer: coarse) {
      .tree .row, .closedrows .cr, .tl { min-block-size: 44px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .w > header .fold .ic { transition: none; }
    }
  `];u([xa({attribute:!1})],h.prototype,"route",2);u([v()],h.prototype,"screen",2);u([v()],h.prototype,"module",2);u([v()],h.prototype,"meta",2);u([v()],h.prototype,"data",2);u([v()],h.prototype,"dept",2);u([v()],h.prototype,"rfqs",2);u([v()],h.prototype,"rfqFailed",2);u([v()],h.prototype,"details",2);u([v()],h.prototype,"vendorIds",2);u([v()],h.prototype,"handled",2);u([v()],h.prototype,"approval",2);u([v()],h.prototype,"reason",2);u([v()],h.prototype,"folded",2);u([v()],h.prototype,"allOverdue",2);u([v()],h.prototype,"offline",2);u([v()],h.prototype,"lastOk",2);u([v()],h.prototype,"now",2);u([v()],h.prototype,"phone",2);u([v()],h.prototype,"compactHeader",2);u([v()],h.prototype,"yesterday",2);h=u([$a("tickets-overview")],h);export{Oa as DETAIL_CAP,za as OVERVIEW_REFRESH_MS,Sa as SLOW_REFRESH_MS,h as TicketsOverview};
//# sourceMappingURL=tickets-overview-8Kol90ao.js.map
