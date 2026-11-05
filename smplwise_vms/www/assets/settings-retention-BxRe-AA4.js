import{ak as ps,G as d,H as T,e as i,lS as R,A as o,E as ht,F as $,a as ft,S as St,j as Gt,bP as ot,w as rt,lU as Le,T as G,lV as ze,lW as be,i as Rs,b8 as ee,g as js,lX as Ls,lY as As,lZ as Ae,l_ as Bs,l$ as qs,m0 as Fs,m1 as Vs,m2 as Ks,m3 as Us,C as us,lT as ms,m4 as Ws,m5 as Hs,m6 as Be,m7 as Ys,m8 as qe,m9 as Gs,ma as Zs}from"./index-CiVWQgDq.js";import{E as Q,n as p,b as Ht,e as f,s as k,a as st,f as b,i as $e,p as Ee,c as et,d as Nt,g as Yt,h as K,j as C,k as le,l as ut,m as x,o as ge,q as E,t as Qs,r as Xs,u as Dt,v as B,w as Fe,x as Ve,y as Se,z as Oe,A as Js,B as ta,P as ea,C as nt,D as sa,F as aa,G as Rt,H as ia,I as pt,J as Pe,K as ra,M as na,L as Ke,N as la,O as oa,Q as da,R as ca,S as vs,T as fs,U as ha,V as ye,W as pa,X as ua,Y as ae,Z as se,_ as ma,$ as va,a0 as Ue,a1 as bs,a2 as $s,a3 as We,a4 as jt,a5 as Wt,a6 as ie,a7 as oe,a8 as gs,a9 as He,aa as we}from"./format-Bu5oO64h.js";import{e as gt}from"./styles-CM4jOaeP.js";const Ct="/infra/electricity",fa="/system/infra",_t=t=>`#${t}`,N={accounts:()=>`${Ct}/accounts`,accountNew:()=>`${Ct}/accounts/new`,account:(t,e="")=>`${Ct}/accounts/${t}${e?`/${e}`:""}`,bills:()=>`${Ct}/bills`,bill:t=>`${Ct}/bills/${t}`,customers:()=>`${Ct}/customers`,customer:t=>`${Ct}/customers/${t}`,settings:t=>`${fa}/${t}`},P={accounts:()=>_t(N.accounts()),accountNew:()=>_t(N.accountNew()),account:(t,e="")=>_t(N.account(t,e)),bills:()=>_t(N.bills()),bill:t=>_t(N.bill(t)),customers:()=>_t(N.customers()),customer:t=>_t(N.customer(t)),settings:t=>_t(N.settings(t))},Z=t=>ps(t);var ba=Object.defineProperty,$a=Object.getOwnPropertyDescriptor,Zt=(t,e,s,r)=>{for(var a=r>1?void 0:r?$a(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&ba(e,s,a),a};const Ye="sw.elec.accounts.view";let Lt=class extends Q{constructor(){super(...arguments),this.st="loading",this.rows=[],this.q="",this.view="table",this.status=t=>t.stale?i`<span class="chip c-warn">מונה לא מדווח</span>`:i`<span class="chip c-ok">תקין</span>`,this.last=t=>{const e=t.account.last_bill;return e?i`${e.number?p(e.number):"טיוטה"} ${Ht(e.state)}`:i`<span class="mut">-</span>`}}connectedCallback(){super.connectedCallback();try{this.view=localStorage.getItem(Ye)==="cards"?"cards":"table"}catch{}this.load()}async load(){this.st="loading";try{this.rows=await f().listAccounts(),this.st=this.rows.length?"ready":"empty"}catch{this.st="error"}}setView(t){this.view=t;try{localStorage.setItem(Ye,t)}catch{}}render(){const t=R(),e=t.bills;if(!t.view)return i`<div class="page" data-elec="accounts" data-state="forbidden">${k("forbidden","lock","אין הרשאה לצפות בחשבונות")}</div>`;const s=this.q.trim(),r=this.rows.filter(n=>!s||n.account.name.includes(s)||n.account.customer.name.includes(s)),a=i`<div class="row">
      <input type="search" data-search aria-label="חיפוש חשבון או לקוח" placeholder="חיפוש חשבון או לקוח" .value=${this.q} @input=${n=>this.q=n.target.value} />
      ${this.phone?o:i`<div class="seg" role="group" aria-label="תצוגה">
        <button type="button" data-view="cards" aria-pressed=${this.view==="cards"} @click=${()=>this.setView("cards")}>כרטיסים</button>
        <button type="button" data-view="table" aria-pressed=${this.view==="table"} @click=${()=>this.setView("table")}>טבלה</button></div>`}
      <span class="sp"></span>
      ${t.manage?i`<a class="btn pri ${this.phone?"sm":""}" data-new-account href=${P.accountNew()}>+ חשבון חדש</a>`:o}
    </div>`;let l;return this.st==="loading"?l=st(6):this.st==="error"?l=k("error","warning","לא ניתן לטעון את החשבונות",{label:"נסה שוב",run:()=>void this.load()}):this.st==="empty"?l=k("empty","bolt","אין חשבונות עדיין",t.manage?{label:"+ חשבון חדש",primary:!0,run:()=>Z(N.accountNew())}:void 0):r.length?this.phone?l=i`<div class="list" data-elec-list>${r.map(n=>i`<a class="li" href=${P.account(n.account.id)} data-account-row=${n.account.id}>
        <div class="grow"><div class="t1">${n.account.name}</div><div class="t2">${n.account.customer.name} · ${p(b(n.kwh??0))} קוט״ש${e&&n.amount!==void 0?i` · ${p($e(n.amount))}`:o}</div></div>${this.status(n)}</a>`)}</div>`:this.view==="cards"?l=i`<div class="grid-cards" data-elec-list>${r.map(n=>i`<div class="card" data-account-row=${n.account.id}>
        <div class="row"><a class="rowlink h3" href=${P.account(n.account.id)}>${n.account.name}</a><span class="sp"></span>${this.status(n)}</div>
        <div class="mut">${n.account.customer.name} · ${Ee(n.account.period_months,n.account.period_anchor_day,n.account.period_anchor_month)}</div>
        <div class="row" style="margin-block-start:10px;align-items:baseline"><span class="big">${p(b(n.kwh??0))}</span><span class="mut">קוט״ש בתקופה</span><span class="sp"></span>${e&&n.amount!==void 0?i`<b class="big amt">${p($e(n.amount))}</b>`:o}</div>
        ${e?i`<div class="mut" style="margin-block-start:6px">חיוב אחרון: ${this.last(n)}</div>`:o}</div>`)}</div>`:l=i`<div class="card flush scrollx" data-elec-list><table class="t">
        <thead><tr><th>חשבון</th><th>לקוח</th><th class="hide-tablet">נוסחה</th><th>תקופה</th><th class="num">צריכה בתקופה</th>${e?i`<th class="num">סכום עד כה</th><th>חיוב אחרון</th>`:o}<th>מצב</th></tr></thead>
        <tbody>${r.map(n=>i`<tr class="go" data-account-row=${n.account.id} @click=${()=>Z(N.account(n.account.id))}>
          <td class="b"><a class="rowlink" href=${P.account(n.account.id)} @click=${c=>c.stopPropagation()}>${n.account.name}</a></td><td>${n.account.customer.name}</td>
          <td class="mut ell hide-tablet">${n.account.formula.sentence_he}</td><td>${Ee(n.account.period_months,n.account.period_anchor_day,n.account.period_anchor_month)}</td>
          <td class="num">${b(n.kwh??0)}</td>${e?i`<td class="num">${n.amount!==void 0?$e(n.amount):""}</td><td>${this.last(n)}</td>`:o}<td>${this.status(n)}</td></tr>`)}</tbody></table></div>`:l=k("empty","search","לא נמצאו חשבונות"),i`<div class="page" data-elec="accounts" data-state=${this.st==="ready"&&!r.length?"empty":this.st}>
      ${this.st==="ready"||this.st==="empty"||this.st==="loading"?a:o}
      ${l}
    </div>`}};Zt([d()],Lt.prototype,"st",2);Zt([d()],Lt.prototype,"rows",2);Zt([d()],Lt.prototype,"q",2);Zt([d()],Lt.prototype,"view",2);Lt=Zt([T("elec-accounts-list")],Lt);var ga=Object.defineProperty,ya=Object.getOwnPropertyDescriptor,bt=(t,e,s,r)=>{for(var a=r>1?void 0:r?ya(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&ga(e,s,a),a};let at=class extends ft{constructor(){super(...arguments),this.account=null,this.open=!1,this.choice="last",this.from="",this.to="",this.busy=!1,this.error="",this.errorBill="",this.existing=[],this.skin=new St(this)}willUpdate(t){if(t.has("open")&&this.open&&this.account){this.choice="last",this.error="",this.errorBill="";const e=this.periods();this.from=e.last.from,this.to=e.last.to,f().listBills({account_id:this.account.id}).then(s=>this.existing=s.items).catch(()=>this.existing=[])}}periods(){const t=this.account,e=et(),s=Nt(e,t.period_months,t.period_anchor_day,t.period_anchor_month),r=Yt(s.from,-1);return{last:{from:Nt(r,t.period_months,t.period_anchor_day,t.period_anchor_month).from,to:r},current:{from:s.from,to:e}}}range(){const t=this.periods();return this.choice==="last"?t.last:this.choice==="current"?t.current:{from:this.from,to:this.to}}rangeError(){return this.choice!=="range"?"":!K(this.from)||!K(this.to)?"צריך לבחור תאריך התחלה ותאריך סיום":this.to<this.from?"תאריך הסיום חייב להיות אחרי תאריך ההתחלה":""}overlap(){const t=this.range();return this.existing.find(e=>e.state!=="void"&&e.state!=="draft"&&!(t.to<e.period.from||t.from>e.period.to))}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async create(){if(!this.account||this.busy)return;this.busy=!0,this.error="",this.errorBill="";const t=this.range(),e=this.choice==="last"?{kind:"last"}:{kind:"range",from:t.from,to:t.to};try{const s=await f().createBill(this.account.id,e);this.close(),Z(N.bill(s.id))}catch(s){this.error=C(s),s instanceof Gt&&(le(s)==="period_overlap"||le(s)==="draft_exists")&&(this.errorBill=String(s.body.details?.bill_id??""))}finally{this.busy=!1}}render(){const t=this.account;if(!t)return o;const e=this.periods(),s=this.overlap(),r=this.rangeError(),a=(l,n,c)=>i`<label class="li ${this.choice===l?"sel":""}"><input type="radio" name="period" data-period=${l} .checked=${this.choice===l} @change=${()=>{this.choice=l,this.error=""}} /><span class="ind"></span>
      <div class="grow"><div class="t1">${n}</div>${c?i`<div class="t2">${c}</div>`:o}</div></label>`;return i`<elec-dialog heading="הפקת חיוב" ?open=${this.open} data-bill-create @close=${()=>this.close()}>
      <div class="mut">${t.name}</div>
      <div class="list" role="radiogroup" aria-label="תקופה">
        ${a("last","התקופה האחרונה",p(ut(e.last.from,e.last.to)))}
        ${a("current","התקופה הנוכחית עד היום",p(ut(e.current.from,e.current.to)))}
        ${a("range","טווח אחר",o)}
      </div>
      ${this.choice==="range"?i`<div class="form">
            <div class="fld"><label for="bf">מתאריך</label><input id="bf" type="date" lang=${ot()} name="from" data-range-from .value=${this.from} @change=${l=>this.from=l.target.value} /></div>
            <div class="fld"><label for="bt">עד תאריך</label><input id="bt" type="date" lang=${ot()} name="to" data-range-to .value=${this.to} @change=${l=>this.to=l.target.value} /></div>
          </div>`:o}
      ${r?x("err",r):o}
      ${s?x("err",i`כבר קיים חיוב ${p(s.number??"")} לתקופה הזו. אפשר <a class="lnk" href=${P.bill(s.id)}>לתקן אותו</a> במקום ליצור חדש.`):o}
      ${this.error&&!s?x("err",i`${this.error}${this.errorBill?i` <a class="lnk" href=${P.bill(this.errorBill)}>לפתיחת החיוב</a>`:o}`):o}
      <button slot="actions" type="button" class="btn pri" data-create ?disabled=${this.busy||!!s||!!r} @click=${()=>void this.create()}>יצירת טיוטה</button>
      <button slot="actions" type="button" class="btn" @click=${()=>this.close()}>ביטול</button>
    </elec-dialog>`}};at.styles=[gt,ht`:host { display: contents; }`];bt([$({attribute:!1})],at.prototype,"account",2);bt([$({type:Boolean,reflect:!0})],at.prototype,"open",2);bt([d()],at.prototype,"choice",2);bt([d()],at.prototype,"from",2);bt([d()],at.prototype,"to",2);bt([d()],at.prototype,"busy",2);bt([d()],at.prototype,"error",2);bt([d()],at.prototype,"errorBill",2);bt([d()],at.prototype,"existing",2);at=bt([T("elec-bill-create")],at);function ys(t){if(!t)return[];const e=[],s=t.same_period_last_year,r=!!s&&t.previous.some(a=>a.from===s.from&&a.to===s.to&&a.kwh!==null);s&&s.kwh!==null&&!r&&e.push({key:"ly",label:ge(s.to),title:`אותה תקופה אשתקד, ${ut(s.from,s.to)}`,kwh:Number(s.kwh),kind:"ly",partial:s.status==="partial"});for(const a of t.previous.slice(-12))e.push({key:`p${a.to}`,label:ge(a.to),title:ut(a.from,a.to),kwh:a.kwh===null?null:Number(a.kwh),kind:"prev",partial:a.status==="partial",lyMark:!!s&&a.from===s.from&&a.to===s.to});return t.current&&e.push({key:"cur",label:ge(t.current.to),title:`התקופה הנוכחית, ${ut(t.current.from,t.current.to)}`,kwh:Number(t.current.kwh),kind:"cur",partial:!1}),e}const wa=24;function _a(t,e,s,r,a=4){const l=Math.min(a,s/2,r);return`M${t},${e+r} V${e+l} Q${t},${e} ${t+l},${e} H${t+s-l} Q${t+s},${e} ${t+s},${e+l} V${e+r} Z`}function ka(t){const e=new Set;let s=null;for(const r of t)r.kwh!==null&&((r.kind==="cur"||r.kind==="ly"||r.lyMark)&&e.add(r.key),(!s||r.kwh>s.kwh)&&(s=r));return s&&e.add(s.key),e}const Ie=t=>ys(t).some(e=>e.kind!=="cur"&&e.kwh!==null);var xa=Object.defineProperty,Ea=Object.getOwnPropertyDescriptor,Ot=(t,e,s,r)=>{for(var a=r>1?void 0:r?Ea(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&xa(e,s,a),a};let mt=class extends ft{constructor(){super(...arguments),this.series=null,this.table="sr",this.print=!1,this.height=200,this.w=640,this.showTable=!1,this.hot=null}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(t=>{const e=Math.round(t[0].contentRect.width);e>120&&Math.abs(e-this.w)>2&&(this.w=e)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}render(){const t=ys(this.series);if(!Ie(this.series))return o;const e=this.w,s=this.height,r=12,a=18,l=22,n=t.length,c=(e-r*2)/n,v=t.map(y=>y.kwh??0),h=Math.max(...v,1)*1.12,m=Math.min(c*.68,wa),u=y=>y/h*(s-a-l),g=s-l,A=y=>e-r-(y+1)*c,$t=y=>A(y)+(c-m)/2,Os=c<30?2:1,Ps=ka(t),Cs=c>=30,Te=t.find(y=>y.kind==="cur"),Xt=t.find(y=>y.kind==="ly"||y.lyMark),he=Xt&&Xt.kwh!==null?g-u(Xt.kwh):null,zs=t.some(y=>y.partial),Is=`צריכה לפי תקופה: ${t.filter(y=>y.kwh!==null).map(y=>`${y.label} ${b(y.kwh)} קוט״ש`).join(", ")}`,pe=this.hot===null?-1:t.findIndex(y=>y.key===this.hot),Pt=pe>=0?t[pe]:null;return i`
      <svg viewBox="0 0 ${e} ${s}" role="img" aria-label=${Is} data-elec-chart @pointerleave=${()=>this.hot=null}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--c-bar2)"></rect><rect width="2.5" height="6" fill="var(--c-bar)" opacity="0.55"></rect></pattern>
        </defs>
        <line class="grid" x1=${r} x2=${e-r} y1=${g} y2=${g}></line>
        ${he!==null&&Te?rt`<line class="lyline" x1=${r} x2=${e-r} y1=${he} y2=${he}></line>`:o}
        ${t.map((y,ue)=>{const me=$t(ue),Jt=me+m/2,Ns=y.kind==="ly"?"אשתקד":y.label,Me=ue%Os===0||y.kind!=="prev"?rt`<text x=${Jt} y=${s-6} text-anchor="middle">${Ns}</text>`:o,De=this.hot===y.key,Re=rt`<rect class="hit" x=${A(ue)} y=${a-10} width=${c} height=${s-a+10-l+4}></rect>`,te=()=>this.hot=y.key,je=()=>{this.hot===y.key&&(this.hot=null)};if(y.kwh===null)return rt`<g class=${De?"band hot":"band"} data-bar="gap" tabindex="0" aria-label=${`${y.title}: אין נתונים`} @pointerenter=${te} @focus=${te} @blur=${je}>
              ${Re}<line class="gap" x1=${Jt-5} x2=${Jt+5} y1=${g-4} y2=${g-4}></line>${Me}</g>`;const ve=Math.max(2,u(y.kwh)),fe=g-ve,Ts=y.lyMark?rt`<rect class="ly" x=${me-2} y=${fe-2} width=${m+4} height=${ve+2} rx="4"></rect>`:o,Ms=y.kind==="cur"?"bar":y.kind==="ly"?"ly":y.partial?"part":"bar2",Ds=Cs&&Ps.has(y.key)?rt`<text class="v" x=${Jt} y=${fe-5} text-anchor="middle">${b(y.kwh).replace(/\.00$/,"")}</text>`:o;return rt`<g class=${De?"band hot":"band"} data-bar=${y.kind} tabindex="0" aria-label=${`${y.title}: ${b(y.kwh)} קוט״ש${y.partial?" (נתונים חלקיים)":""}`} @pointerenter=${te} @focus=${te} @blur=${je}>
            ${Re}<path class=${Ms} d=${_a(me,fe,m,ve)}></path>
            ${Ts}${Ds}${Me}</g>`})}
      </svg>
      ${Pt?i`<div class="tip" role="tooltip" data-chart-tip style=${`left:${($t(pe)+m/2)/e*100}%; inset-block-start:${(Pt.kwh===null?g-8:g-Math.max(2,u(Pt.kwh)))/s*100}%`}>
            <b>${Pt.kwh===null?"אין נתונים":`${b(Pt.kwh)} קוט״ש`}</b><small>${Pt.title}${Pt.partial?" · נתונים חלקיים":""}</small>
          </div>`:o}
      <div class="legend">
        ${Te?i`<span><i class="l-cur"></i>התקופה הנוכחית</span>`:o}
        <span><i class="l-prev"></i>תקופות קודמות</span>
        ${Xt?i`<span><i class="l-ly"></i>אותה תקופה אשתקד</span>`:o}
        ${zs?i`<span><i class="l-part"></i>נתונים חלקיים</span>`:o}
      </div>
      ${this.renderTable(t)}
    `}renderTable(t){const e=i`<div class=${this.table==="sr"?"sr":"tw"}><table data-elec-chart-table>
      <thead><tr>${t.map(s=>i`<th scope="col" title=${s.title}>${s.kind==="ly"?"אשתקד":s.label}</th>`)}</tr></thead>
      <tbody><tr>${t.map(s=>i`<td>${s.kwh===null?"-":b(s.kwh)}</td>`)}</tr></tbody>
    </table></div>`;return this.table==="details"?i`<button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.showTable} @click=${()=>this.showTable=!this.showTable}>${this.showTable?"הסתרת טבלת מספרים":"טבלת מספרים"}</button>${this.showTable?e:o}`:e}};mt.styles=ht`
    :host {
      display: block;
      position: relative;
      min-inline-size: 0;
      contain: inline-size;
      --c-bar: var(--sw-accent);
      --c-bar2: color-mix(in srgb, var(--sw-accent) 38%, var(--sw-surface-3));
      --c-text: var(--sw-text-3);
      --c-grid: var(--sw-border);
      --c-ly: var(--sw-text-2);
      --c-tip-bg: var(--sw-toast-bg);
      --c-tip-text: var(--sw-toast-text);
    }
    :host([print]) {
      --c-bar: #2767ed;
      --c-bar2: #a9c1f7;
      --c-text: #5b6a85;
      --c-grid: #d5dbe6;
      --c-ly: #1d2433;
      font-family: 'Heebo', Arial, sans-serif;
    }
    svg {
      inline-size: 100%;
      display: block;
      overflow: visible;
    }
    text {
      fill: var(--c-text);
      font-size: var(--sw-fs-xs);
      font-family: inherit;
    }
    text.v {
      font-variant-numeric: tabular-nums;
      fill: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    :host([print]) text.v {
      fill: var(--c-ly);
    }
    .bar {
      fill: var(--c-bar);
    }
    .bar2 {
      fill: var(--c-bar2);
    }
    .part {
      fill: url(#hatch);
    }
    .ly {
      fill: none;
      stroke: var(--c-ly);
      stroke-width: 1.6;
      stroke-dasharray: 4 3;
    }
    .grid {
      stroke: var(--c-grid);
      stroke-width: 1;
      shape-rendering: crispEdges;
    }
    .lyline {
      stroke: var(--c-ly);
      stroke-width: 1;
      stroke-dasharray: 2 3;
      opacity: 0.6;
    }
    .gap {
      stroke: var(--c-text);
      stroke-width: 1.5;
    }
    /* the hit area of a band: wider than the mark, invisible; hover and focus light the bar */
    .hit {
      fill: transparent;
      cursor: default;
    }
    g.band:focus {
      outline: none;
    }
    g.band:focus-visible .hit {
      fill: color-mix(in srgb, var(--sw-focus) 10%, transparent);
    }
    g.band.hot .hit {
      fill: color-mix(in srgb, var(--sw-text) 5%, transparent);
    }
    g.band.hot .bar2 {
      fill: color-mix(in srgb, var(--sw-accent) 55%, var(--sw-surface-3));
    }
    .tip {
      position: absolute;
      inset-block-start: 0;
      transform: translate(-50%, -100%) translateY(-6px);
      background: var(--c-tip-bg);
      color: var(--c-tip-text);
      border-radius: var(--sw-r-sm);
      padding: 6px 9px;
      font-size: var(--sw-fs-sm);
      line-height: 1.35;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: var(--sw-shadow-2);
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }
    .tip b {
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .tip small {
      font-size: var(--sw-fs-xs);
      opacity: 0.85;
    }
    .legend {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
      color: var(--c-text);
      margin-block-start: 6px;
    }
    .legend i {
      display: inline-block;
      inline-size: 12px;
      block-size: 12px;
      border-radius: var(--sw-r-2xs);
      margin-inline-end: 5px;
      vertical-align: -1px;
    }
    .legend .l-cur {
      background: var(--c-bar);
    }
    .legend .l-prev {
      background: var(--c-bar2);
    }
    .legend .l-ly {
      border: 1.6px dashed var(--c-ly);
    }
    .legend .l-part {
      background: repeating-linear-gradient(45deg, var(--c-bar2) 0 3px, transparent 3px 6px);
      border: 1px solid var(--c-bar2);
    }
    .tw {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      inline-size: 100%;
      margin-block-start: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--c-text);
    }
    th,
    td {
      padding: 3px 6px;
      border-block-end: 1px solid var(--c-grid);
      text-align: center;
      font-weight: 500;
    }
    td {
      direction: ltr;
      font-variant-numeric: tabular-nums;
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .tgl {
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-sm);
      margin-block-start: 6px;
      color: var(--sw-accent-text);
      background: none;
      border: 0;
      padding: 0 4px;
      min-block-size: var(--elec-touch, 32px);
      display: inline-flex;
      align-items: center;
    }
    @media (max-width: 1100px) {
      :host {
        --elec-touch: 44px;
      }
    }
    @media print {
      .tip {
        display: none;
      }
    }
  `;Ot([$({attribute:!1})],mt.prototype,"series",2);Ot([$()],mt.prototype,"table",2);Ot([$({type:Boolean,reflect:!0})],mt.prototype,"print",2);Ot([$({type:Number})],mt.prototype,"height",2);Ot([d()],mt.prototype,"w",2);Ot([d()],mt.prototype,"showTable",2);Ot([d()],mt.prototype,"hot",2);mt=Ot([T("elec-chart")],mt);const Sa=t=>Z(N.bill(t.id)),Oa=t=>t.stopPropagation();function Ne(t,e){return e.phone?i`<div class="list" data-elec-bills>
      ${t.map(s=>i`<a class="li" href=${P.bill(s.id)} data-bill-row=${s.id} data-bill-state=${s.state}>
          <div class="grow"><div class="t1">${s.number?i`<span class="num">${s.number}</span>`:"טיוטה"} · ${s.account_name}</div><div class="t2">${ut(s.period.from,s.period.to)} · <span class="num">${b(s.kwh)}</span> קוט״ש</div></div>
          <div style="text-align:end"><b class="num">${b(s.total)} ₪</b><div style="margin-block-start:4px">${Ht(s.state)}</div></div>
        </a>`)}
    </div>`:i`<div class="card flush scrollx" data-elec-bills>
    <table class="t">
      <thead><tr><th>מספר</th>${e.compact?o:i`<th>לקוח</th><th>חשבון</th>`}<th>תקופה</th><th class="num">קוט״ש</th><th class="num">סה״כ לתשלום</th><th>מצב</th><th class="hide-tablet">הונפק</th></tr></thead>
      <tbody>
        ${t.map(s=>i`<tr class="go" data-bill-row=${s.id} data-bill-state=${s.state} @click=${()=>Sa(s)}>
            <td class="b"><a class="rowlink" href=${P.bill(s.id)} @click=${Oa}>${s.number?i`<span class="num">${s.number}</span>`:i`<span class="mut">טיוטה</span>`}</a></td>
            ${e.compact?o:i`<td>${s.customer.name}</td><td>${s.account_name}</td>`}
            <td><span class="num">${ut(s.period.from,s.period.to)}</span></td>
            <td class="num">${b(s.kwh)}</td>
            <td class="num">${b(s.total)} ₪</td>
            <td>${Ht(s.state)}</td>
            <td class="num hide-tablet" style="text-align:start">${s.issue_date?E(s.issue_date):"-"}</td>
          </tr>`)}
      </tbody>
    </table>
  </div>`}var Pa=Object.defineProperty,Ca=Object.getOwnPropertyDescriptor,X=(t,e,s,r)=>{for(var a=r>1?void 0:r?Ca(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&Pa(e,s,a),a};let H=class extends Q{constructor(){super(...arguments),this.accountId="",this.tab="status",this.st="loading",this.err="",this.status=null,this.hist=null,this.histMonths=12,this.histSt="loading",this.bills=[],this.billsSt="loading",this.createOpen=!1,this.flash="",this.loaded=""}willUpdate(t){t.has("accountId")&&this.accountId&&this.loaded!==this.accountId&&(this.loaded=this.accountId,this.load()),(t.has("tab")||t.has("accountId"))&&this.accountId&&(this.tab==="history"&&this.loadHistory(),this.tab==="bills"&&this.loadBills())}async load(){this.st="loading";try{this.flash=Qs(),this.status=await f().accountStatus(this.accountId),this.st="ready"}catch(t){this.err=C(t),this.st="error"}}async loadHistory(){this.histSt="loading";try{this.hist=await f().accountHistory(this.accountId,this.histMonths),this.histSt=this.hist.rows.some(t=>t.kwh!==null)||Ie(this.hist.comparison)?"ready":"empty"}catch{this.histSt="error"}}async loadBills(){this.billsSt="loading";try{this.bills=(await f().listBills({account_id:this.accountId})).items,this.billsSt=this.bills.length?"ready":"empty"}catch{this.billsSt="error"}}head(t){const s=this.status?.account,r=[["status","מצב"],["history","היסטוריה"],...t.bills?[["bills","חיובים"]]:[]];return i`<div class="row"><a class="btn ghost sm" href=${P.accounts()} data-back>→ חשבונות</a></div>
      <div class="row">
        <div><b class="h2" data-account-name>${s?.name??""}</b>
          <div class="mut">${s?i`${t.bills?i`<a class="lnk" href=${P.customer(s.customer.id)}>${s.customer.name}</a>`:s.customer.name} · ${Ee(s.period_months,s.period_anchor_day,s.period_anchor_month)}`:""}</div></div>
        <span class="sp"></span>
        ${t.bills&&s?i`<button type="button" class="btn pri" data-create-bill @click=${()=>this.createOpen=!0}>הפקת חיוב</button>`:o}
        ${t.manage&&s?i`<a class="btn" data-edit-account href=${P.account(s.id,"edit")}>עריכה</a>`:o}
      </div>
      <div class="seg" style="align-self:flex-start" role="tablist" aria-label="חלקי החשבון">
        ${r.map(([a,l])=>i`<button type="button" role="tab" data-tab=${a} aria-pressed=${this.tab===a} @click=${()=>Z(N.account(this.accountId,a==="status"?"":a))}>${l}</button>`)}
      </div>`}render(){const t=R();return t.view?this.tab==="bills"&&!t.bills?i`<div class="page" data-elec="account" data-state="forbidden">${k("forbidden","lock","אין הרשאה לחיובים")}</div>`:this.st==="loading"?i`<div class="page" data-elec="account" data-state="loading">${st(5)}</div>`:this.st==="error"||!this.status?i`<div class="page" data-elec="account" data-state="error"><div class="row"><a class="btn ghost sm" href=${P.accounts()}>→ חשבונות</a></div>${k("error","warning",this.err||"לא ניתן לטעון את החשבון",{label:"נסה שוב",run:()=>void this.load()})}</div>`:i`<div class="page" data-elec="account" data-state="ready" data-tab-now=${this.tab}>
      ${this.head(t)}
      ${this.flash?x("warn",this.flash):o}
      ${this.tab==="status"?this.renderStatus(this.status,t):this.tab==="history"?this.renderHistory(t):this.renderBills()}
      <elec-bill-create .account=${this.status.account} ?open=${this.createOpen} @close=${()=>this.createOpen=!1}></elec-bill-create>
    </div>`:i`<div class="page" data-elec="account" data-state="forbidden">${k("forbidden","lock","אין הרשאה לצפות בחשבון")}</div>`}renderStatus(t,e){const s=t.rows.some(c=>c.start!==null),r=t.customer,a=t.rows,l=i`${t.stale?x("warn",i`<b>${t.stale.meter}</b> לא מדווח${t.stale.since?i` מאז ${p(t.stale.since)}`:""}. הצריכה תיספר כשהמונה יחזור לדווח.`):o}
      ${t.notes.map(c=>x("warn",c.text_he))}
      <div class="tiles" data-elec-tiles>
        <div class="tile"><div class="k">צריכה בתקופה</div><div class="v">${p(b(t.kwh))}<span class="u">קוט״ש</span></div></div>
        <div class="tile"><div class="k">יום ${p(t.period.day)} מתוך ${p(t.period.days)}</div><div class="prog" style="margin-block-start:14px" role="progressbar" aria-valuenow=${t.period.day} aria-valuemin="0" aria-valuemax=${t.period.days}><i style="inline-size:${Math.round(t.period.day/t.period.days*100)}%"></i></div></div>
        <div class="tile"><div class="k">צפי לסוף התקופה</div><div class="v">${p(Xs(t.forecast_kwh))}<span class="u">קוט״ש</span></div></div>
        ${t.amount_so_far!==void 0?i`<div class="tile" data-tile="amount"><div class="k">סכום עד כה</div><div class="v">${p(t.amount_so_far)}<span class="u">₪</span></div></div>`:i`<div class="tile"><div class="k">ממוצע ליום</div><div class="v">${p(b(t.avg_per_day))}<span class="u">קוט״ש</span></div></div>`}
      </div>
      <div class="card ${this.phone?"":"flush"}"><div class="hd"><b class="h3">מונים בנוסחה</b><span class="sp"></span><span class="mut">${t.account.formula.sentence_he}</span></div>
        ${this.phone?i`<div class="list">${a.map(c=>i`<div class="li"><div class="grow"><div class="t1">${c.name}${c.factor?i` <span class="mut">(${c.factor})</span>`:o}</div><div class="t2">${s&&c.start!==null?i`${p(b(c.start))} ← ${p(b(c.end??0))}`:i`${p(b(c.kwh))} קוט״ש`}</div></div><b class="num">${b(c.part)}</b></div>`)}</div>
            <div class="row" style="margin-block-start:10px"><b>סה״כ לחיוב</b><span class="sp"></span><b class="num">${b(t.kwh)}</b></div>`:i`<div class="scrollx"><table class="t" data-elec-meters><thead><tr><th>מונה</th>${s?i`<th class="num">קריאה בתחילת התקופה</th><th class="num">קריאה נוכחית</th>`:o}<th class="num">צריכה</th><th class="num">חלק</th><th class="num">לחיוב (קוט״ש)</th></tr></thead>
            <tbody>${a.map(c=>i`<tr><td class="b">${c.name} ${c.stale?i`<span class="chip c-warn">לא מדווח</span>`:o}</td>${s?i`<td class="num">${Dt(c.start)}</td><td class="num">${Dt(c.end)}</td>`:o}<td class="num">${b(c.kwh)}</td><td class="num">${c.factor}</td><td class="num b">${b(c.part)}</td></tr>`)}</tbody>
            <tfoot><tr><td colspan=${s?5:3}>סה״כ לחיוב</td><td class="num">${b(t.kwh)}</td></tr></tfoot></table></div>`}
      </div>`,n=i`<div class="card"><div class="hd"><b class="h3">לקוח</b><span class="sp"></span>${e.bills&&r?i`<a class="btn ghost sm" href=${P.customer(r.id)}>כרטיס לקוח</a>`:o}</div>
        <dl class="kv"><dt>שם</dt><dd>${t.account.customer.name}</dd><dt>מספר לקוח</dt><dd>${p(t.account.customer.customer_number)}</dd>${e.bills&&r?.phone?i`<dt>טלפון</dt><dd>${p(r.phone)}</dd>`:o}${e.bills&&r?.email?i`<dt>דוא״ל</dt><dd>${p(r.email)}</dd>`:o}</dl></div>
      ${t.price&&e.bills?i`<div class="card" data-card="price"><div class="hd"><b class="h3">מחיר</b></div><dl class="kv"><dt>תעריף</dt><dd>${t.price.tariff}</dd><dt>לפני מע״מ</dt><dd>${p(B(t.price.ex_vat)+" ₪")}</dd><dt>כולל מע״מ</dt><dd>${p(B(t.price.inc_vat)+" ₪")}</dd><dt>מע״מ</dt><dd>${p(t.price.vat+"%")}</dd></dl></div>`:t.account.tariff.kind==="tou"&&e.bills?i`<div class="card" data-card="price" data-kind="tou"><div class="hd"><b class="h3">מחיר</b></div><dl class="kv"><dt>תעריף</dt><dd>${t.account.tariff.name}</dd><dt>חישוב</dt><dd>לפי שעות (תעו״ז)</dd></dl></div>`:o}
      <div class="card" data-card="next"><div class="hd"><b class="h3">חיוב הבא</b></div><dl class="kv"><dt>תקופה</dt><dd>${p(E(t.next.from))} - ${p(E(t.next.to))}</dd><dt>מספר צפוי</dt><dd>${p(t.next.number)}</dd>${t.account.auto_mode!=="off"?i`<dt>${t.account.auto_mode==="issue"?"הנפקה אוטומטית":"טיוטה אוטומטית"}</dt><dd>${p(E(t.next.draft_on))}</dd>`:o}</dl></div>`;return i`<div class="cols side-l"><div class="col">${l}</div><div class="col">${n}</div></div>`}renderHistory(t){if(this.histSt==="loading")return st(5);if(this.histSt==="error")return k("error","warning","לא ניתן לטעון את ההיסטוריה",{label:"נסה שוב",run:()=>void this.loadHistory()});const e=this.hist;if(this.histSt==="empty")return k("empty","bolt","אין עדיין נתוני עבר לחשבון");const s=t.bills,r=[...e.rows].reverse(),a=n=>n.kwh===null?i`<span class="mut" data-no-data>אין נתונים</span>`:i`${p(b(n.kwh))}${n.status==="partial"?i` <span class="chip c-warn nodot" data-partial>חלקי</span>`:o}`,l=n=>n.change_pct!==null?(n.change_pct>0?"+":"")+n.change_pct.toFixed(1)+"%":"-";return i`<div class="card" data-elec-history><div class="hd"><b class="h3">צריכה לפי תקופה</b><span class="sp"></span>
        <div class="seg" role="group" aria-label="טווח"><button type="button" data-months="12" aria-pressed=${this.histMonths===12} @click=${()=>this.setMonths(12)}>12 תקופות</button><button type="button" data-months="24" aria-pressed=${this.histMonths===24} @click=${()=>this.setMonths(24)}>24 תקופות</button></div></div>
      <elec-chart .series=${e.comparison} table="details" .height=${this.phone?200:220}></elec-chart></div>
      <div class="card ${this.phone?"":"flush"}">${this.phone?i`<div class="list">${r.map(n=>i`<div class="li" data-history-row data-status=${n.status}><div class="grow"><div class="t1">${p(n.label)}</div><div class="t2">${a(n)}${n.kwh!==null?" קוט״ש":""}${n.change_pct!==null?i` · ${p(l(n))}`:o}</div></div>${s&&n.amount!==void 0?i`<b class="num">${b(n.amount)} ₪</b>`:o}</div>`)}</div>`:i`<table class="t" data-elec-history-table><thead><tr><th>תקופה</th><th class="num">קוט״ש</th><th class="num">שינוי</th>${s?i`<th class="num">סכום</th><th>חיוב</th>`:o}</tr></thead>
          <tbody>${r.map(n=>i`<tr data-history-row data-status=${n.status}><td class="num" style="text-align:start">${n.label}</td><td class="num">${a(n)}</td><td class="num">${l(n)}</td>${s?i`<td class="num">${n.amount!==void 0?b(n.amount)+" ₪":""}</td><td>${n.bill?i`<a class="lnk num" href=${P.bill(n.bill.id)}>${n.bill.number}</a> ${Ht(n.bill.state)}`:i`<span class="mut">-</span>`}</td>`:o}</tr>`)}</tbody></table>`}</div>`}setMonths(t){this.histMonths=t,this.loadHistory()}renderBills(){return this.billsSt==="loading"?st(4):this.billsSt==="error"?k("error","warning","לא ניתן לטעון את החיובים",{label:"נסה שוב",run:()=>void this.loadBills()}):this.billsSt==="empty"?k("empty","bolt","אין חיובים לחשבון הזה",{label:"הפקת חיוב",primary:!0,run:()=>this.createOpen=!0}):Ne(this.bills,{phone:this.phone,compact:!0})}};X([$()],H.prototype,"accountId",2);X([$()],H.prototype,"tab",2);X([d()],H.prototype,"st",2);X([d()],H.prototype,"err",2);X([d()],H.prototype,"status",2);X([d()],H.prototype,"hist",2);X([d()],H.prototype,"histMonths",2);X([d()],H.prototype,"histSt",2);X([d()],H.prototype,"bills",2);X([d()],H.prototype,"billsSt",2);X([d()],H.prototype,"createOpen",2);X([d()],H.prototype,"flash",2);H=X([T("elec-account-page")],H);var za=Object.defineProperty,Ia=Object.getOwnPropertyDescriptor,J=(t,e,s,r)=>{for(var a=r>1?void 0:r?Ia(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&za(e,s,a),a};let U=class extends ft{constructor(){super(...arguments),this.meters=[],this.tokens=[],this.preset="custom",this.mode="builder",this.text="",this.textIssues=[],this.selected=-1,this.menu=!1,this.mainId="",this.pctVal="30",this.preview=null,this.previewErr="",this.skin=new St(this),this.seq=0,this.timer=0,this.lastKey="",this.nameOf=t=>this.meters.find(e=>e.id===t)?.name??t,this.idOf=t=>this.meters.find(e=>e.name.trim()===t.trim())?.id??null,this.lastOf=t=>this.meters.find(e=>e.id===t)?.last_period_kwh??null}willUpdate(t){t.has("meters")&&!this.mainId&&(this.mainId=this.meters[0]?.id??""),t.has("tokens")&&this.tokens.length&&(this.preset=Fe(this.tokens,this.meters.map(e=>e.id)))}updated(t){t.has("tokens")&&(this.selected=Math.min(this.selected,this.tokens.length-1),this.mode==="text"&&!this.textIssues.length&&(this.text=Ve(this.tokens,this.nameOf)),this.scheduleCheck())}parse(){return Se(this.tokens)}emit(t,e=this.preset){this.preset=e,this.tokens=t,this.selected=-1;const s=Se(t),r={tokens:t,ast:s.ast,valid:!s.issues.length&&!!s.ast,preset:e};this.dispatchEvent(new CustomEvent("change",{detail:r,bubbles:!0,composed:!0}))}edit(t){this.emit(t,Fe(t,this.meters.map(e=>e.id)))}scheduleCheck(){window.clearTimeout(this.timer);const t=this.parse(),e=JSON.stringify(t.ast);if(!t.ast||t.issues.length){this.preview=null,this.previewErr="",this.lastKey="";return}if(e===this.lastKey){this.emitChecked();return}this.timer=window.setTimeout(()=>void this.runCheck(t.ast,e),150)}async runCheck(t,e){const s=++this.seq;try{const r=await f().checkFormula(t);if(s!==this.seq)return;this.lastKey=e,this.preview=r,this.previewErr=""}catch(r){if(s!==this.seq)return;this.preview=null,this.previewErr=C(r)}this.emitChecked()}emitChecked(){const t=!!this.preview&&!this.preview.negative&&!this.previewErr;this.dispatchEvent(new CustomEvent("checked",{detail:{ok:t,result:this.preview?.result_kwh??null,negative:this.preview?.negative??!1,error:this.previewErr},bubbles:!0,composed:!0}))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}applyPreset(t){const e=this.meters.map(r=>r.id);if(t==="custom"){this.preset="custom";return}const s=t==="pct"?Oe("pct",[this.mainId||e[0]],{pct:this.pctVal}):Oe(t,e,{main:this.mainId});this.emit(s,t)}add(t){const e=[...this.tokens],s=this.selected>=0?this.selected+1:e.length;e.splice(s,0,t),this.edit(e),this.selected=s}addMeter(t){this.menu=!1,this.add({t:"m",id:t})}addOp(t){this.add({t:"op",v:t})}togglePercent(){const t=this.selected>=0?this.selected:this.tokens.length-1,e=this.tokens[t];if(e?.t!=="n")return;const s=[...this.tokens];s[t]={...e,pct:!e.pct},this.edit(s),this.selected=t}backspace(){const t=[...this.tokens],e=this.selected>=0?this.selected:t.length-1;e<0||(t.splice(e,1),this.edit(t),this.selected=Math.min(e-1,t.length-1))}addNumber(t,e){this.add({t:"n",v:t,pct:e})}setMode(t){t!==this.mode&&(t==="text"?(this.text=Ve(this.tokens,this.nameOf),this.textIssues=[]):this.textIssues.length&&(this.textIssues=[]),this.mode=t)}onText(t){this.text=t.target.value;const e=Js(this.text,this.idOf);if(this.textIssues=e.issues,!e.issues.length)this.edit(e.toks);else{const s={tokens:this.tokens,ast:null,valid:!1,preset:this.preset};this.dispatchEvent(new CustomEvent("change",{detail:s,bubbles:!0,composed:!0}))}}tok(t,e,s){const r=`tok ${t.t==="m"?"m":t.t==="op"?"op":"k"} ${s.has(e)?"bad":""} ${this.selected===e?"sel":""}`,a=()=>this.selected=this.selected===e?-1:e;if(t.t==="m"){const l=this.lastOf(t.id);return i`<button type="button" class=${r} data-tok="meter" aria-pressed=${this.selected===e} @click=${a}>${this.nameOf(t.id)}${l!==null?i`<small class="num">${b(l)}</small>`:o}</button>`}return t.t==="op"?i`<button type="button" class=${r} data-tok="op" aria-pressed=${this.selected===e} aria-label=${t.v==="*"?"כפל":t.v==="-"?"מינוס":t.v==="+"?"פלוס":t.v==="/"?"חילוק":t.v} @click=${a}>${t.v==="*"?"×":t.v==="-"?"−":t.v==="/"?"÷":t.v}</button>`:i`<button type="button" class=${r} data-tok="num" aria-pressed=${this.selected===e} @click=${a}><span class="num">${t.v}${t.pct?"%":""}</span></button>`}render(){const t=this.parse(),e=new Set(t.issues.map(h=>h.at).filter(h=>h>=0)),s=this.preview,r=!!s?.negative,a=this.mode==="text"&&this.textIssues.length?this.textIssues.map(h=>h.message):t.issues.map(h=>h.message),l=a.length||r||this.previewErr,n=!a.length&&!r&&!this.previewErr&&!!t.ast&&!!s,c=this.tokens.length?ta(this.tokens,this.nameOf):"",v=t.warnings;return i`<div data-elec="formula-editor" data-formula-state=${l?"error":n?"ok":"pending"} data-preset=${this.preset}>
      <div class="presets" role="group" aria-label="תבנית נוסחה">
        ${ea.map(h=>i`<button type="button" class="preset" data-preset-btn=${h.id} aria-pressed=${this.preset===h.id} @click=${()=>this.applyPreset(h.id)}><b>${h.label}</b><span>${h.hint}</span></button>`)}
      </div>
      ${this.preset==="mainsub"||this.preset==="pct"?i`<div class="row">
            <div class="fld" style="min-inline-size:200px"><label for="main">${this.preset==="pct"?"מונה":"מונה ראשי"}</label>
              <select id="main" data-preset-main @change=${h=>{this.mainId=h.target.value,this.applyPreset(this.preset)}}>
                ${this.meters.map(h=>i`<option value=${h.id} ?selected=${h.id===this.mainId}>${h.name}</option>`)}
              </select></div>
            ${this.preset==="pct"?i`<div class="fld" style="inline-size:120px"><label for="pct">אחוז</label><input id="pct" class="ltr" data-preset-pct inputmode="decimal" .value=${this.pctVal} @input=${h=>{this.pctVal=h.target.value,Number(this.pctVal)>0&&this.applyPreset("pct")}} /></div>`:o}
          </div>`:o}
      <div class="row"><b class="h3">הנוסחה</b><span class="sp"></span>
        <div class="seg" role="group" aria-label="מצב עריכה">
          <button type="button" data-mode="builder" aria-pressed=${this.mode==="builder"} @click=${()=>this.setMode("builder")}>בונה</button>
          <button type="button" data-mode="text" aria-pressed=${this.mode==="text"} @click=${()=>this.setMode("text")}>טקסט</button>
        </div>
      </div>
      ${this.mode==="text"?i`<textarea class="code ${this.textIssues.length?"err":""}" data-text aria-label="נוסחה בטקסט" dir="ltr" spellcheck="false" .value=${this.text} @input=${this.onText}></textarea>
            <div class="mut">שמות מונים בסוגריים מרובעים. פעולות: + − × ( ) ומספרים או אחוזים.</div>`:i`<div class="expr ${a.length||r?"err":""}" data-expr>
              ${this.tokens.length?this.tokens.map((h,m)=>this.tok(h,m,e)):i`<span class="mut">הוסיפו מונה או בחרו תבנית</span>`}
            </div>
            <div class="pal">
              <button type="button" class="btn" data-add-meter aria-expanded=${this.menu} aria-haspopup="listbox" @click=${()=>this.menu=!this.menu}>+ מונה ▾</button>
              ${["+","-","*"].map(h=>i`<button type="button" class="btn" data-op=${h} aria-label=${h==="+"?"פלוס":h==="-"?"מינוס":"כפל"} @click=${()=>this.addOp(h)}>${h==="*"?"×":h==="-"?"−":h}</button>`)}
              <button type="button" class="btn" data-op="percent" aria-label="אחוז" @click=${()=>this.togglePercent()}>%</button>
              <button type="button" class="btn" data-op="(" aria-label="סוגר פותח" @click=${()=>this.addOp("(")}>(</button>
              <button type="button" class="btn" data-op=")" aria-label="סוגר סוגר" @click=${()=>this.addOp(")")}>)</button>
              <button type="button" class="btn" data-number-btn @click=${()=>this.dispatchEvent(new CustomEvent("number-request",{bubbles:!0,composed:!0}))}>מספר</button>
              <span class="sp"></span>
              <button type="button" class="btn ghost" data-backspace @click=${()=>this.backspace()}>⌫ מחיקה</button>
            </div>
            ${this.menu?i`<div class="menu" role="listbox" data-meter-menu>${this.meters.map(h=>i`<button type="button" role="option" data-meter-option=${h.id} @click=${()=>this.addMeter(h.id)}><span>${h.name}</span>${h.last_period_kwh!==null?i`<span class="mut num">${b(h.last_period_kwh)}</span>`:o}</button>`)}</div>`:o}`}
      ${c?i`<div class="mut" data-sentence>${c}</div>`:o}
      ${a.map(h=>x("err",h))}
      ${v.map(h=>x("warn",h))}
      ${r&&s?x("err",i`התוצאה שלילית בתקופה האחרונה (${p(b(s.result_kwh??0))} קוט״ש). בדקו את הסימנים בנוסחה.`):o}
      ${this.previewErr?x("err",this.previewErr):o}
      ${n?x("ok","הנוסחה תקינה"):o}
      ${s&&!a.length?this.renderPreview(s):o}
    </div>`}renderPreview(t){return i`<div class="card soft" data-formula-preview>
      <div class="hd"><b class="h3">בדיקה על ${t.period_from?`${E(t.period_from)} - ${E(t.period_to)}`:"התקופה האחרונה"}</b></div>
      <div class="scrollx"><table class="t"><thead><tr><th>מונה</th><th class="num">צריכה (קוט״ש)</th></tr></thead>
        <tbody>${t.rows.map(e=>i`<tr><td>${e.name}</td><td class="num">${b(e.kwh)}</td></tr>`)}</tbody>
        <tfoot><tr><td>צריכת החשבון</td><td class="num ${t.negative?"bad":""}" data-formula-result>${b(t.result_kwh??0)}</td></tr></tfoot></table></div>
    </div>`}};U.styles=[gt,ht`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      textarea.code {
        min-block-size: 76px;
        font-size: var(--sw-fs-lg);
      }
    `];J([$({attribute:!1})],U.prototype,"meters",2);J([$({attribute:!1})],U.prototype,"tokens",2);J([d()],U.prototype,"preset",2);J([d()],U.prototype,"mode",2);J([d()],U.prototype,"text",2);J([d()],U.prototype,"textIssues",2);J([d()],U.prototype,"selected",2);J([d()],U.prototype,"menu",2);J([d()],U.prototype,"mainId",2);J([d()],U.prototype,"pctVal",2);J([d()],U.prototype,"preview",2);J([d()],U.prototype,"previewErr",2);U=J([T("elec-formula-editor")],U);function lt(t){const e=(t.device_name??"").trim(),s=(t.entity_name??"").trim()||t.name;return t.name&&t.name!==s&&t.name!==e?{primary:t.name,secondary:[...new Set([e,s].filter(a=>a&&a!==t.name))].join(" · ")}:{primary:e||s,secondary:e&&s!==e?s:""}}function ws(t){return[t.name,t.device_name,t.entity_name].filter(Boolean).join(" ").toLowerCase()}const Ge=120;function re(t,e){const s=t.trim(),r=s.toLocaleLowerCase(),a=!!s&&e.some(l=>l.trim().toLocaleLowerCase()===r);return s?s.length>Ge?{name:s,error:`השם ארוך מדי (עד ${Ge} תווים)`,duplicate:a}:a?{name:s,error:_s,duplicate:a}:{name:s,error:"",duplicate:a}:{name:s,error:"צריך להזין שם למונה",duplicate:!1}}const _s="קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם",Na="השם החדש יופיע במסמכים חדשים. חשבוניות שכבר הונפקו לא ישתנו.";var Ta=Object.defineProperty,Ma=Object.getOwnPropertyDescriptor,it=(t,e,s,r)=>{for(var a=r>1?void 0:r?Ma(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&Ta(e,s,a),a};let Y=class extends ft{constructor(){super(...arguments),this.bubbleSkin=new St(this),this.mode="register",this.multi=!0,this.sensors=!1,this.selected=[],this.meters=null,this.q="",this.area="",this.items=[],this.phase="loading",this.error="",this.rejected=null,this.timer=0,this.seq=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){window.clearTimeout(this.timer),super.disconnectedCallback()}updated(t){t.has("meters")&&t.get("meters")!==void 0&&this.mode==="choose"&&this.load()}async load(){const t=++this.seq;this.phase="loading";try{const e=this.mode==="choose"?await this.loadChoose():this.fromCandidates(await Le(this.q,this.area||void 0));if(t!==this.seq)return;this.items=e,this.phase="ready"}catch(e){if(t!==this.seq)return;this.error=G(e),this.phase="error"}}async loadChoose(){const[t,e]=await Promise.all([this.meters?Promise.resolve(this.meters):ze(),this.sensors?Le("").catch(()=>[]):Promise.resolve([])]);return[...this.fromMeters(t),...this.fromSensors(e)]}fromCandidates(t){return t.map(e=>({id:e.entity_id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:e.value??"",verdict:e.already_added?"added":e.verdict,message:e.already_added?"":be(e),sensor:!1}))}fromMeters(t){return t.map(e=>({id:e.id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:`${nt(e.reading_kwh)} kWh`,verdict:e.status==="reporting"?"ok":"warn",message:e.status==="stale"?"המונה לא מדווח כרגע":e.status==="paused"?"המונה מושהה":"",sensor:!1,tag:e.status==="stale"?"לא מדווח":e.status==="paused"?"מושהה":void 0}))}fromSensors(t){return t.filter(e=>e.verdict!=="ok"&&!e.already_added).map(e=>({id:e.entity_id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:e.value??"",verdict:e.verdict==="warn"?"warn":"rejected",message:e.verdict==="warn"?`${be(e)} צריך להוסיף אותו קודם במסך המונים.`:be(e),sensor:!0}))}listed(){if(this.phase!=="ready")return[];if(this.mode!=="choose")return this.items;const t=this.q.trim().toLowerCase();return this.items.filter(e=>(!this.area||e.area===this.area)&&(!t||ws({name:e.name,device_name:e.device,entity_name:e.entity}).includes(t)||e.area.toLowerCase().includes(t)))}onSearch(t){this.q=t.target.value,this.mode!=="choose"&&(window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.load(),250))}onArea(t){this.area=t.target.value,this.mode!=="choose"&&this.load()}off(t){return t.sensor||t.verdict==="rejected"||t.verdict==="added"}toggle(t){if(this.off(t)){this.rejected=t.verdict==="added"?null:t;return}this.rejected=null;const e=this.selected.includes(t.id),s=this.multi?e?this.selected.filter(a=>a!==t.id):[...this.selected,t.id]:e?[]:[t.id];this.selected=s;const r={};for(const a of s){const l=this.items.find(n=>n.id===a);l&&(r[a]=lt({name:l.name,device_name:l.device,entity_name:l.entity}).primary)}this.dispatchEvent(new CustomEvent("change",{detail:{selected:s,names:r},bubbles:!0,composed:!0}))}chip(t){return t.verdict==="ok"?i`<span class="chip c-ok" data-verdict="ok">מתאים</span>`:t.verdict==="warn"?i`<span class="chip c-warn" data-verdict="warn">${t.tag??"אזהרה"}</span>`:t.verdict==="added"?i`<span class="chip c-acc" data-verdict="added">נוסף</span>`:i`<span class="chip c-err" data-verdict="rejected">לא מתאים</span>`}render(){const t=this.mode==="choose",e=[...new Set(this.items.map(r=>r.area).filter(Boolean))],s=this.listed();return i`
      <div class="head">
        <label class="inp">
          <sw-icon name="search" size="16"></sw-icon>
          <input type="search" data-picker-search placeholder=${t?"חיפוש מונה לפי שם":"חיפוש לפי שם"} aria-label=${t?"חיפוש מונה לפי שם":"חיפוש לפי שם"} .value=${this.q} @input=${this.onSearch} />
        </label>
        <label class="inp">
          <select data-picker-area aria-label="אזור" @change=${this.onArea}>
            <option value="" ?selected=${!this.area}>כל האזורים</option>
            ${[...new Set([...e,this.area].filter(Boolean))].map(r=>i`<option value=${r} ?selected=${r===this.area}>${r}</option>`)}
          </select>
        </label>
      </div>
      ${this.rejected?i`<div class="alert err" role="alert" data-picker-reject><span class="x" aria-hidden="true">!</span><div><b>${lt({name:this.rejected.name,device_name:this.rejected.device,entity_name:this.rejected.entity}).primary}</b> לא נבחר. ${this.rejected.message}</div></div>`:o}
      ${this.phase==="loading"?i`<sw-state-panel state="loading" compact></sw-state-panel>`:o}
      ${this.phase==="error"?i`<sw-state-panel state="error" compact heading=${t?"לא ניתן לטעון את המונים":"לא ניתן לטעון את החיישנים"} hint=${this.error} actionLabel="נסה שוב" @action=${()=>void this.load()}></sw-state-panel>`:o}
      ${this.phase==="ready"&&!s.length?i`<sw-state-panel icon="bolt" state="empty" compact data-no-match heading=${t?this.items.length?"לא נמצא מונה בשם הזה":"אין מונים עדיין":"לא נמצאו חיישנים"}></sw-state-panel>`:o}
      ${s.length?i`<div class="list scroll" role="listbox" aria-multiselectable=${this.multi?"true":"false"} aria-label=${t?"מונים":"חיישנים"} data-picker-list>
            ${s.map(r=>{const a=this.selected.includes(r.id),l=this.off(r),n=lt({name:r.name,device_name:r.device,entity_name:r.entity});return i`<button type="button" class="li pick ${a?"sel":""} ${l?"dis":""} ${this.rejected?.id===r.id?"flag":""}" role="option" aria-selected=${a?"true":"false"} aria-disabled=${l?"true":"false"} data-picker-item=${r.id} data-verdict=${r.verdict} ?data-sensor=${r.sensor} @click=${()=>this.toggle(r)}>
                <span class="check ${a?"on":""} ${l?"dis":""}">${a?i`<sw-icon name="check" size="14"></sw-icon>`:o}</span>
                <span class="grow">
                  <div class="t1" data-picker-name>${n.primary}</div>
                  ${n.secondary?i`<div class="t2 ent" data-picker-entity title="שם הישות">${n.secondary}</div>`:o}
                  <div class="t2">${r.area}${r.area&&r.value?" · ":""}<span class="num">${r.value}</span></div>
                  ${r.message&&(r.verdict==="warn"||r.verdict==="rejected")?i`<div class="t2 wrap" style="color:${r.verdict==="warn"?"var(--sw-warning-text)":"var(--sw-danger-text)"}">${r.message}</div>`:o}
                </span>
                ${this.chip(r)}
              </button>`})}
          </div>`:o}
    `}};Y.styles=[gt,ht`
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-inline-size: 0;
      }
      .head {
        display: flex;
        gap: 10px;
        align-items: stretch;
      }
      .head .inp:first-child {
        flex: 1;
      }
      .head .inp:last-child {
        flex: 0 1 190px;
      }
      .check {
        flex: none;
        inline-size: 20px;
        block-size: 20px;
        border: 2px solid var(--sw-border-strong);
        border-radius: var(--sw-r-xs);
        display: grid;
        place-items: center;
        color: var(--sw-text-inverse);
      }
      .check.on {
        background: var(--sw-accent);
        border-color: var(--sw-accent);
      }
      .check.dis {
        opacity: 0.4;
      }
      .scroll {
        max-block-size: min(46vh, 420px);
        overflow: auto;
      }
      .li .t2.ent {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .li.pick[aria-disabled='true'] {
        cursor: help;
      }
      .li.pick.flag {
        border-color: var(--sw-danger);
        opacity: 1;
      }
      @media (max-width: 600px) {
        .head {
          flex-direction: column;
        }
        .head .inp:last-child {
          flex: 1;
        }
      }
    `];it([$()],Y.prototype,"mode",2);it([$({type:Boolean})],Y.prototype,"multi",2);it([$({type:Boolean})],Y.prototype,"sensors",2);it([$({attribute:!1})],Y.prototype,"selected",2);it([$({attribute:!1})],Y.prototype,"meters",2);it([d()],Y.prototype,"q",2);it([d()],Y.prototype,"area",2);it([d()],Y.prototype,"items",2);it([d()],Y.prototype,"phase",2);it([d()],Y.prototype,"error",2);it([d()],Y.prototype,"rejected",2);Y=it([T("elec-meter-picker")],Y);var Da=Object.defineProperty,Ra=Object.getOwnPropertyDescriptor,_=(t,e,s,r)=>{for(var a=r>1?void 0:r?Ra(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&Da(e,s,a),a};const _e=["בחירת מונים","נוסחת החשבון","מחיר ומע״מ","תקופת חיוב","כרטיס לקוח","סיכום והפקה"],ja=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,Ze=()=>({name:"",customer_number:"",tax_id:"",address:"",phone:"",email:"",notes:""});let w=class extends Q{constructor(){super(...arguments),this.accountId="",this.loadSt="loading",this.step=1,this.reached=1,this.meters=[],this.tariffs=[],this.vat=null,this.settings=null,this.customers=[],this.nextNo="",this.meterIds=[],this.tokens=[],this.formulaValid=!1,this.formulaChecked=!1,this.tariffId="",this.tariffOpen=!1,this.tf={name:"",price:"",mode:"ex_vat",from:"",err:{},busy:!1,error:""},this.months=1,this.anchorDay=1,this.anchorMonth=1,this.firstStart="",this.custMode="new",this.custQ="",this.existingId="",this.nc=Ze(),this.ncErr={},this.accName="",this.accNameErr="",this.auto="draft",this.afterSave="draft",this.saving=!1,this.saveErr="",this.sampleResult=null,this.numOpen=!1,this.numVal="",this.numPct=!0,this.numErr="",this.account=null,this.createdCustomerId="",this.draftPossible=()=>!!this.lastPeriod(),this.onFormula=t=>{this.tokens=t.detail.tokens,this.formulaValid=t.detail.valid,this.formulaChecked=!1},this.onChecked=t=>{this.formulaChecked=t.detail.ok&&this.formulaValid,this.sampleResult=t.detail.result}}connectedCallback(){super.connectedCallback(),this.init()}get edit(){return!!this.accountId}async init(){this.loadSt="loading";const t=R();try{const e=f(),[s,r,a,l,n,c]=await Promise.all([sa(),e.listTariffs(),e.getVat(),e.getSettings().catch(()=>null),t.view?e.listCustomers().catch(()=>[]):Promise.resolve([]),e.nextCustomerNumber().catch(()=>"")]);if(this.meters=s,this.tariffs=r,this.vat=a,this.settings=l,this.customers=n,this.nextNo=c,this.nc={...Ze(),customer_number:c},this.tf={...this.tf,mode:l?.default_price_mode??"ex_vat",from:et()},this.firstStart=et(),r.length===1&&(this.tariffId=r[0].id),this.edit){const v=await e.getAccount(this.accountId);this.account=v,this.meterIds=v.formula.meter_ids,this.tokens=aa(v.formula.ast),this.formulaValid=!0,this.tariffId=v.tariff.id,this.months=v.period_months,this.anchorDay=v.period_anchor_day,this.anchorMonth=v.period_anchor_month,this.firstStart=v.first_period_start,this.auto=v.auto_mode,this.accName=v.name,this.existingId=v.customer.id,this.custMode="existing",this.reached=6}this.loadSt="ready"}catch{this.loadSt="error"}}chosen(){return this.meterIds.map(t=>this.meters.find(e=>e.id===t)).filter(t=>!!t)}tariff(){return this.tariffs.find(t=>t.id===this.tariffId)}cust(){if(this.custMode==="existing"){const t=this.customers.find(e=>e.id===this.existingId)??(this.account?{name:this.account.customer.name,customer_number:this.account.customer.customer_number,account_count:1}:null);return t?{name:t.name,number:t.customer_number,count:t.account_count}:{name:"",number:this.nextNo,count:0}}return{name:this.nc.name,number:this.nc.customer_number||this.nextNo,count:0}}canNext(){switch(this.step){case 1:return this.meterIds.length>0;case 2:return this.formulaValid&&this.formulaChecked;case 3:return!!this.tariffId&&!!this.vat?.current;case 4:return K(this.firstStart)&&this.anchorDay>=1&&this.anchorDay<=28;case 5:return!0;default:return!0}}goStep(t){t<1||t>6||t>this.reached||(this.step=t)}next(){this.step===5&&!this.validateStep5()||!this.canNext()||this.step>=6||(this.step===1&&this.enterFormula(),this.step+=1,this.reached=Math.max(this.reached,this.step),this.step===2&&(this.formulaChecked=!1))}enterFormula(){this.tokens.every(e=>e.t!=="m"||this.meterIds.includes(e.id))&&this.tokens.some(e=>e.t==="m")||(this.tokens=Oe("sum",this.meterIds),this.formulaValid=!0,this.formulaChecked=!1)}validateStep5(){this.ncErr={},this.accNameErr="";let t=!0;return this.accName.trim()||(this.accNameErr="צריך לתת שם לחשבון",t=!1),this.edit||(this.custMode==="new"?(this.nc.name.trim()||(this.ncErr={...this.ncErr,name:"צריך לכתוב שם ללקוח"},t=!1),this.nc.email&&!ja.test(this.nc.email)&&(this.ncErr={...this.ncErr,email:"כתובת דוא״ל לא תקינה"},t=!1),/^\d{1,9}$/.test(this.nc.customer_number)||(this.ncErr={...this.ncErr,customer_number:"מספר לקוח הוא ספרות בלבד"},t=!1)):this.existingId||(t=!1)),t}async save(){if(this.saving)return;const t=this.tariff(),e=Se(this.tokens).ast;if(!t||!e)return;this.saving=!0,this.saveErr="";const s=f();try{if(this.edit&&this.account){await s.updateAccount(this.account.id,this.account.revision,{name:this.accName.trim(),formula:{ast:e},tariff_id:this.tariffId,auto_mode:this.auto}),Z(N.account(this.account.id));return}let r=this.existingId;if(this.custMode==="new"){if(!this.createdCustomerId)try{const l=await s.createCustomer({name:this.nc.name.trim(),customer_number:this.nc.customer_number,address:this.nc.address,phone:this.nc.phone,email:this.nc.email,tax_id:this.nc.tax_id,notes:this.nc.notes});this.createdCustomerId=l.id}catch(l){const n=Rt(l);this.ncErr=Object.keys(n).length?n:{customer_number:C(l)},!Object.keys(n).length&&!/מספר/.test(C(l))&&(this.ncErr={name:C(l)}),this.step=5;return}r=this.createdCustomerId}const a=await s.createAccount({name:this.accName.trim(),customer_id:r,formula:{ast:e},tariff_id:this.tariffId,period_months:this.months,period_anchor_day:this.anchorDay,period_anchor_month:this.months===2?this.anchorMonth:1,first_period_start:this.firstStart,auto_mode:this.auto},this.draftPossible()?this.afterSave:"none");a.billError&&ia(`החשבון נשמר, אבל לא נוצרה טיוטה: ${a.billError}`),Z(N.account(a.account.id))}catch(r){this.saveErr=C(r)}finally{this.saving=!1}}lastPeriod(){const t=et(),e=Nt(t,this.months,this.anchorDay,this.months===2?this.anchorMonth:1),s=Yt(e.from,-1);return!K(this.firstStart)||s<this.firstStart?null:{from:this.firstStart>Nt(s,this.months,this.anchorDay,this.months===2?this.anchorMonth:1).from?this.firstStart:Nt(s,this.months,this.anchorDay,this.months===2?this.anchorMonth:1).from,to:s}}renderStep1(){const t=this.chosen();return i`<elec-meter-picker mode="choose" multi sensors .meters=${this.meters} .selected=${this.meterIds} data-meter-picker
        @change=${e=>this.meterIds=e.detail.selected}></elec-meter-picker>
      <div class="row" data-chosen><span class="chip c-acc nodot">נבחרו ${t.length} ${t.length===1?"מונה":"מונים"}</span><span class="mut">${t.map(e=>lt(e).primary).join(", ")}</span></div>`}renderStep2(){return i`<elec-formula-editor .meters=${this.chosen()} .tokens=${this.tokens} @change=${this.onFormula} @checked=${this.onChecked} @number-request=${()=>{this.numOpen=!0,this.numErr=""}}></elec-formula-editor>`}confirmNumber(){const t=this.numVal.trim().replace(",",".");if(!/^\d+(\.\d+)?$/.test(t)||Number(t)<=0){this.numErr="צריך להקליד מספר גדול מאפס";return}if(this.numPct&&Number(t)>1e3){this.numErr="האחוז גדול מדי";return}this.numOpen=!1,this.numErr="",this.renderRoot.querySelector("elec-formula-editor")?.addNumber(t,this.numPct),this.numVal=""}renderNumberDialog(){return i`<elec-dialog heading="הוספת מספר" ?open=${this.numOpen} data-number-dialog @close=${()=>this.numOpen=!1}>
      <div class="fld"><label for="numv">ערך</label>
        <input id="numv" class="ltr ${this.numErr?"err":""}" data-number-input inputmode="decimal" .value=${this.numVal} @input=${t=>{this.numVal=t.target.value,this.numErr=""}} @keydown=${t=>t.key==="Enter"&&this.confirmNumber()} />
        ${this.numErr?i`<div class="msg" role="alert">${this.numErr}</div>`:o}</div>
      <div class="seg" role="group" aria-label="סוג">
        <button type="button" data-number-kind="pct" aria-pressed=${this.numPct} @click=${()=>this.numPct=!0}>אחוז</button>
        <button type="button" data-number-kind="num" aria-pressed=${!this.numPct} @click=${()=>this.numPct=!1}>מספר</button>
      </div>
      <button slot="actions" type="button" class="btn pri" data-number-ok @click=${()=>this.confirmNumber()}>הוספה</button>
      <button slot="actions" type="button" class="btn" @click=${()=>this.numOpen=!1}>ביטול</button>
    </elec-dialog>`}exOf(t){const e=t.current,s=this.vat?.current?Number(this.vat.current.rate_percent)/100:0,r=e?Number(e.price):0;return e?.price_mode==="inc_vat"?{ex:r/(1+s),inc:r,vat:s}:{ex:r,inc:r*(1+s),vat:s}}renderStep3(){const t=this.tariff(),e=this.vat?.current;return i`${e?o:x("err",i`לא הוגדר שיעור מע״מ. <a class="lnk" href=${P.settings("prices")}>הגדרת שיעור מע״מ</a>`)}
      ${this.tariffs.length?i`<div class="list" role="radiogroup" aria-label="תעריף" data-tariff-list>
        ${this.tariffs.map(s=>i`<label class="li ${s.id===this.tariffId?"sel":""}" data-tariff-row=${s.id}><input type="radio" name="tariff" .checked=${s.id===this.tariffId} @change=${()=>this.tariffId=s.id} /><span class="ind"></span>
          <div class="grow"><div class="t1">${s.name}</div><div class="t2">הוזן ${s.current?.price_mode==="inc_vat"?"כולל":"לפני"} מע״מ · בתוקף מ-${p(E(s.current?.effective_from??""))}</div></div>${s.kind==="tou"?i`<span class="chip c-acc nodot">לפי שעות</span>`:i`<b class="num">${B(s.current?.price??0)} ₪</b>`}</label>`)}</div>
        <div class="row"><button type="button" class="btn ghost sm" data-new-tariff @click=${()=>this.tariffOpen=!0}>+ תעריף חדש</button></div>`:k("empty","bolt","אין תעריפים עדיין",{label:"+ תעריף חדש",primary:!0,run:()=>this.tariffOpen=!0})}
      ${t&&e?this.priceCard(t):o}`}priceCard(t){if(t.kind==="tou"){const a=t.current?.definition;return i`<div class="card soft" data-price-card data-kind="tou"><dl class="kv"><dt>תעריף</dt><dd>לפי שעות (תעו״ז)${a?i`: ${a.bands.map(l=>l.name_he).join(" / ")}, ${a.seasons.map(l=>l.name_he).join(" / ")}`:o}</dd>
        <dt>מע״מ</dt><dd>${p((this.exOf(t).vat*100).toFixed(0)+"%")} <span class="mut">(מההגדרות)</span></dd></dl>
        <div class="mut" style="margin-block-start:8px">הסכום מחושב לפי שעות הצריכה בפועל, בכל פס ועונה במחיר שלהם.</div></div>`}const e=this.exOf(t),s=this.sampleKwh(),r=t.current?.price_mode==="inc_vat"?pt(s*e.inc):pt(pt(s*e.ex)+pt(pt(s*e.ex)*e.vat));return i`<div class="card soft" data-price-card><dl class="kv"><dt>מחיר לקוט״ש לפני מע״מ</dt><dd>${p(B(e.ex)+" ₪")}</dd><dt>מע״מ</dt><dd>${p((e.vat*100).toFixed(0)+"%")} <span class="mut">(מההגדרות)</span></dd><dt>מחיר לקוט״ש כולל מע״מ</dt><dd>${p(B(e.inc)+" ₪")}</dd>
      ${s?i`<dt>לדוגמה, ${Pe(Yt(Nt(et(),1,1,1).from,-1))}</dt><dd>${p(b(s))} קוט״ש = ${p(b(r)+" ₪")}</dd>`:o}</dl></div>`}sampleKwh(){return this.sampleResult!==null&&this.sampleResult>0?this.sampleResult:0}renderStep4(){const t=this.months===2?this.anchorMonth:1,e=K(this.firstStart)?ra(this.firstStart,this.months,this.anchorDay,t,"",3):[],s=this.cust();return i`<div class="form">
        <div class="fld"><span class="lbl" id="len">אורך תקופה</span><div class="seg" role="group" aria-labelledby="len"><button type="button" data-months="1" aria-pressed=${this.months===1} ?disabled=${this.edit} @click=${()=>this.months=1}>חודשית</button><button type="button" data-months="2" aria-pressed=${this.months===2} ?disabled=${this.edit} @click=${()=>this.months=2}>דו-חודשית</button></div></div>
        ${this.months===2?i`<div class="fld"><label for="am">חודש פתיחת המחזור</label><select id="am" data-anchor-month ?disabled=${this.edit} @change=${r=>this.anchorMonth=Number(r.target.value)}>${na.map((r,a)=>i`<option value=${a+1} ?selected=${this.anchorMonth===a+1}>${r}</option>`)}</select></div>`:o}
        <div class="fld"><label for="ad">יום תחילת תקופה</label><div class="unit"><input id="ad" class="ltr" type="number" min="1" max="28" data-anchor-day ?disabled=${this.edit} .value=${String(this.anchorDay)} @input=${r=>this.anchorDay=Number(r.target.value)} /><span>בחודש</span></div>
          ${this.anchorDay<1||this.anchorDay>28?i`<div class="msg" role="alert">היום חייב להיות בין 1 ל-28</div>`:o}</div>
        <div class="fld"><label for="fs">תחילת החיוב הראשון</label><input id="fs" type="date" lang=${ot()} class="ltr ${K(this.firstStart)?"":"err"}" data-first-start ?disabled=${this.edit} .value=${this.firstStart} @change=${r=>this.firstStart=r.target.value} />
          ${K(this.firstStart)?o:i`<div class="msg" role="alert">צריך לבחור תאריך</div>`}</div>
      </div>
      <div class="card flush soft"><div class="hd"><b class="h3">התקופות הבאות</b></div>${e.length?i`<table class="t" data-periods><thead><tr><th>תקופה</th><th>מספר חיוב</th></tr></thead><tbody>
        ${e.map(r=>i`<tr><td><span class="num">${ut(r.from,r.to)}</span></td><td class="num" style="text-align:start">${Ke(r.to,s.number,"")}</td></tr>`)}</tbody></table>`:i`<div class="mut" style="padding:0 16px 14px">בחרו תאריך התחלה</div>`}</div>`}renderStep5(){const t=(a,l,n={})=>{const c=this.ncErr[a];return i`<div class="fld ${n.wide?"wide":""}"><label for="c-${a}">${l}</label>
        ${n.area?i`<textarea id="c-${a}" name=${a} .value=${this.nc[a]} placeholder=${n.ph??""} @input=${v=>this.nc={...this.nc,[a]:v.target.value}}></textarea>`:i`<input id="c-${a}" name=${a} class="${n.ltr?"ltr":""} ${c?"err":""}" aria-invalid=${c?"true":"false"} placeholder=${n.ph??""} .value=${this.nc[a]} @input=${v=>{this.nc={...this.nc,[a]:v.target.value},this.ncErr[a]&&(this.ncErr={...this.ncErr,[a]:""})}} />`}
        ${c?i`<div class="msg" role="alert" data-field-error=${a}>${c}</div>`:o}</div>`},e=this.customers.find(a=>a.id===this.existingId),s=this.custQ.trim(),r=this.customers.filter(a=>!s||a.name.includes(s)||a.customer_number.includes(s));return i`${this.edit?x("info",i`הלקוח של חשבון קיים לא משתנה כאן. <b>${this.account?.customer.name}</b>`):i`<div class="seg" style="align-self:flex-start" role="group" aria-label="לקוח"><button type="button" data-cust-mode="new" aria-pressed=${this.custMode==="new"} @click=${()=>this.custMode="new"}>לקוח חדש</button><button type="button" data-cust-mode="existing" aria-pressed=${this.custMode==="existing"} @click=${()=>this.custMode="existing"}>לקוח קיים</button></div>`}
      ${this.edit?o:this.custMode==="existing"?i`<input type="search" data-cust-search style="max-inline-size:none" aria-label="חיפוש לקוח" placeholder="חיפוש לקוח" .value=${this.custQ} @input=${a=>this.custQ=a.target.value} />
            <div class="list" role="radiogroup" aria-label="לקוח קיים" data-cust-list>${r.map(a=>i`<label class="li ${a.id===this.existingId?"sel":""}" data-cust-row=${a.id}><input type="radio" name="cust" .checked=${a.id===this.existingId} @change=${()=>this.existingId=a.id} /><span class="ind"></span><div class="grow"><div class="t1">${a.name}</div><div class="t2">מספר לקוח ${p(a.customer_number)} · ${a.account_count} חשבונות</div></div></label>`)}
              ${r.length?o:i`<div class="mut">לא נמצא לקוח</div>`}</div>
            ${e&&e.account_count>0?x("warn",i`ללקוח יש כבר ${e.account_count} ${e.account_count===1?"חשבון":"חשבונות"}. חיובים של אותו לקוח שמסתיימים באותו חודש יקבלו סיומת רצה, למשל <b class="num">${Ke(Nt(et(),1,1,1).to,e.customer_number,"")}/2</b>.`,"i"):o}`:i`<div class="form">${t("name","שם הלקוח",{wide:!0})}${t("customer_number","מספר לקוח",{ltr:!0})}${t("tax_id","ח.פ. / ע.מ. (לא חובה)",{ltr:!0,ph:"לא חובה"})}${t("address","כתובת למשלוח החיוב",{wide:!0})}${t("phone","טלפון",{ltr:!0})}${t("email","דוא״ל",{ltr:!0})}${t("notes","הערות",{wide:!0,ph:"לא חובה",area:!0})}</div>`}
      <div class="fld"><label for="an">שם החשבון</label><input id="an" name="account_name" data-account-name class="${this.accNameErr?"err":""}" .value=${this.accName} placeholder="למשל: סטודיו אורן - קומה 1" @input=${a=>{this.accName=a.target.value,this.accNameErr=""}} />
        ${this.accNameErr?i`<div class="msg" role="alert" data-field-error="account_name">${this.accNameErr}</div>`:o}</div>`}renderStep6(){const t=this.tariff(),e=this.cust(),s=this.sampleKwh(),r=t?this.exOf(t):null,a=this.tokens.map(h=>h.t==="m"?this.meters.find(m=>m.id===h.id)?.name??"":h.t==="n"?h.v+(h.pct?"%":""):h.v==="*"?"×":h.v==="-"?"−":h.v).join(" ").replace(/\( /g,"(").replace(/ \)/g,")"),l=this.settings?.payment_terms,n=this.lastPeriod(),c=r&&t?t.current?.price_mode==="inc_vat"?pt(s*r.inc):pt(pt(s*r.ex)+pt(pt(s*r.ex)*r.vat)):0,v=(h,m,u,g,A,$t=!1)=>i`<label class="li ${g?"sel":""} ${$t?"dis":""}"><input type="radio" name=${h} data-opt=${m} .checked=${g} ?disabled=${$t} @change=${A} /><span class="ind"></span><div class="grow t1">${u}</div></label>`;return i`<dl class="kv" data-summary><dt>מונים</dt><dd>${this.chosen().map(h=>lt(h).primary).join(", ")}</dd><dt>נוסחה</dt><dd>${a}</dd>
        <dt>מחיר</dt><dd>${t?i`${t.name}, ${t.kind==="tou"?"לפי שעות":p(B(t.current?.price??0)+" ₪")} ${t.current?.price_mode==="inc_vat"?"כולל":"לפני"} מע״מ, מע״מ ${p(this.vat?.current?.rate_percent??"")}%`:""}</dd>
        <dt>תקופה</dt><dd>${this.months===1?"חודשית":"דו-חודשית"}, מה-${this.anchorDay} בחודש, החל מ-${p(E(this.firstStart))}</dd>
        <dt>לקוח</dt><dd>${e.name}, מספר ${p(e.number)}</dd><dt>שם החשבון</dt><dd>${this.accName}</dd>
        <dt>תנאי תשלום</dt><dd data-payment>${l?l.mode==="net_days"?i`${p(l.days)} ימים מיום ההפקה`:i`ב-${p(l.day_of_month)} בחודש`:"-"} <a class="lnk" href=${P.settings("business")}>שינוי בהגדרות</a></dd></dl>
      ${s?i`<div class="card soft"><div class="hd"><b class="h3">לפי הנתונים של התקופה האחרונה</b></div><div class="row"><span style="font-size:var(--sw-fs-2xl);font-weight:700">${p(b(s))}</span><span class="mut">קוט״ש</span><span class="sp"></span>${t?.kind==="tou"?i`<span class="mut">הסכום לפי שעות הצריכה</span>`:i`<span style="font-size:var(--sw-fs-2xl);font-weight:700">${p(b(c)+" ₪")}</span>`}</div></div>`:o}
      <div class="fld"><span class="lbl">יצירה אוטומטית בסוף כל תקופה</span><div class="list" role="radiogroup" aria-label="יצירה אוטומטית">
        ${["draft","issue","off"].map(h=>v("auto",h,la[h],this.auto===h,()=>this.auto=h))}</div>
        ${this.auto==="issue"?x("warn","החיוב יונפק ויקבל מספר בלי בדיקה שלך. אפשר לבטל או לתקן אחר כך."):o}</div>
      ${this.edit?o:i`<div class="fld"><span class="lbl">אחרי השמירה</span><div class="list" role="radiogroup" aria-label="אחרי השמירה">
        ${v("after","draft",n?`שמירה והפקת טיוטה ל${this.months===1?Pe(n.to):ut(n.from,n.to)}`:"שמירה והפקת טיוטה (אין עדיין תקופה שהסתיימה)",this.afterSave==="draft"&&!!n,()=>this.afterSave="draft",!n)}
        ${v("after","none","שמירה בלבד",this.afterSave==="none"||!n,()=>this.afterSave="none")}</div></div>`}
      ${this.saveErr?x("err",this.saveErr):o}`}async saveTariff(){const t=this.tf,e={};if(t.name.trim()||(e.name="צריך לתת שם לתעריף"),Number(t.price)>0||(e.price="המחיר חייב להיות מספר גדול מאפס"),K(t.from)||(e.from="צריך לבחור תאריך"),Object.keys(e).length){this.tf={...t,err:e};return}this.tf={...t,busy:!0,error:"",err:{}};try{const s=await f().createTariff({name:t.name.trim(),price:t.price,price_mode:t.mode,effective_from:t.from});this.tariffs=[...this.tariffs,s],this.tariffId=s.id,this.tariffOpen=!1,this.tf={...this.tf,name:"",price:"",busy:!1}}catch(s){this.tf={...this.tf,busy:!1,error:C(s),err:Rt(s)}}}renderTariffDialog(){const t=this.tf,e=(s,r)=>this.tf={...this.tf,[s]:r,err:{...this.tf.err,[s]:""}};return i`<elec-dialog heading="תעריף חדש" ?open=${this.tariffOpen} data-tariff-dialog @close=${()=>this.tariffOpen=!1}>
      <div class="form">
        <div class="fld wide"><label for="tn">שם התעריף</label><input id="tn" class="${t.err.name?"err":""}" data-tariff-name .value=${t.name} @input=${s=>e("name",s.target.value)} />${t.err.name?i`<div class="msg" role="alert">${t.err.name}</div>`:o}</div>
        <div class="fld"><label for="tp">מחיר לקוט״ש</label><div class="unit"><input id="tp" class="ltr ${t.err.price?"err":""}" data-tariff-price inputmode="decimal" .value=${t.price} @input=${s=>e("price",s.target.value)} /><span>₪</span></div>${t.err.price?i`<div class="msg" role="alert">${t.err.price}</div>`:o}</div>
        <div class="fld"><span class="lbl">המחיר שהוזן</span><div class="seg" role="group" aria-label="סוג מחיר"><button type="button" data-tariff-mode="ex_vat" aria-pressed=${t.mode==="ex_vat"} @click=${()=>this.tf={...t,mode:"ex_vat"}}>לפני מע״מ</button><button type="button" data-tariff-mode="inc_vat" aria-pressed=${t.mode==="inc_vat"} @click=${()=>this.tf={...t,mode:"inc_vat"}}>כולל מע״מ</button></div></div>
        <div class="fld"><label for="tf">בתוקף מתאריך</label><input id="tf" type="date" lang=${ot()} class="ltr ${t.err.from?"err":""}" data-tariff-from .value=${t.from} @change=${s=>e("from",s.target.value)} />${t.err.from?i`<div class="msg" role="alert">${t.err.from}</div>`:o}</div>
      </div>
      ${t.error?x("err",t.error):o}
      <button slot="actions" type="button" class="btn pri" data-tariff-save ?disabled=${t.busy} @click=${()=>void this.saveTariff()}>שמירה</button>
      <button slot="actions" type="button" class="btn" @click=${()=>this.tariffOpen=!1}>ביטול</button>
    </elec-dialog>`}render(){if(!R().manage)return i`<div class="page" data-elec="wizard" data-state="forbidden">${k("forbidden","lock","אין הרשאה לניהול חשבונות")}</div>`;if(this.loadSt==="loading")return i`<div class="page" data-elec="wizard" data-state="loading">${st(5)}</div>`;if(this.loadSt==="error")return i`<div class="page" data-elec="wizard" data-state="error">${k("error","warning","לא ניתן לטעון את האשף",{label:"נסה שוב",run:()=>void this.init()})}</div>`;const e=this.step,s=[this.renderStep1,this.renderStep2,this.renderStep3,this.renderStep4,this.renderStep5,this.renderStep6][e-1].call(this),r=this.canNext();return i`<div class="page" data-elec="wizard" data-state="ready" data-step=${e}>
      <div class="row"><a class="btn ghost sm" href=${this.edit?P.account(this.accountId):P.accounts()} data-back>${this.edit?"→ לחשבון":"→ חשבונות"}</a><b class="h2">${this.edit?"עריכת חשבון":"חשבון חדש"}</b></div>
      <div class="wiz">
        <nav class="card steps" aria-label="שלבי האשף">${_e.map((a,l)=>i`<button type="button" data-step-btn=${l+1} class="${l+1===e?"on":l+1<e?"done":""}" aria-current=${l+1===e?"step":"false"} ?disabled=${l+1>this.reached} @click=${()=>this.goStep(l+1)}><span class="n">${l+1<e?"✓":l+1}</span>${a}</button>`)}</nav>
        <div class="card col" style="gap:14px">
          <div class="pstep"><b>שלב ${e} מתוך 6</b><span class="mut">${_e[e-1]}</span><div class="bar"><i style="inline-size:${e/6*100}%"></i></div></div>
          <b class="h2 hide-phone" data-step-title>${_e[e-1]}</b>
          ${s}
          <div class="wfoot">${e>1?i`<button type="button" class="btn" data-prev @click=${()=>this.step=e-1}>הקודם</button>`:i`<span></span>`}
            ${e<6?i`<button type="button" class="btn pri" data-next ?disabled=${!r} @click=${()=>this.next()}>הבא</button>`:i`<button type="button" class="btn pri" data-save ?disabled=${this.saving||!this.accName.trim()} @click=${()=>void this.save()}>${this.edit?"שמירת שינויים":this.afterSave==="draft"&&this.draftPossible()?"שמירה והפקת טיוטה":"שמירה"}</button>`}</div>
        </div>
      </div>
      ${this.renderTariffDialog()}${this.renderNumberDialog()}
    </div>`}};_([$()],w.prototype,"accountId",2);_([d()],w.prototype,"loadSt",2);_([d()],w.prototype,"step",2);_([d()],w.prototype,"reached",2);_([d()],w.prototype,"meters",2);_([d()],w.prototype,"tariffs",2);_([d()],w.prototype,"vat",2);_([d()],w.prototype,"settings",2);_([d()],w.prototype,"customers",2);_([d()],w.prototype,"nextNo",2);_([d()],w.prototype,"meterIds",2);_([d()],w.prototype,"tokens",2);_([d()],w.prototype,"formulaValid",2);_([d()],w.prototype,"formulaChecked",2);_([d()],w.prototype,"tariffId",2);_([d()],w.prototype,"tariffOpen",2);_([d()],w.prototype,"tf",2);_([d()],w.prototype,"months",2);_([d()],w.prototype,"anchorDay",2);_([d()],w.prototype,"anchorMonth",2);_([d()],w.prototype,"firstStart",2);_([d()],w.prototype,"custMode",2);_([d()],w.prototype,"custQ",2);_([d()],w.prototype,"existingId",2);_([d()],w.prototype,"nc",2);_([d()],w.prototype,"ncErr",2);_([d()],w.prototype,"accName",2);_([d()],w.prototype,"accNameErr",2);_([d()],w.prototype,"auto",2);_([d()],w.prototype,"afterSave",2);_([d()],w.prototype,"saving",2);_([d()],w.prototype,"saveErr",2);_([d()],w.prototype,"sampleResult",2);_([d()],w.prototype,"numOpen",2);_([d()],w.prototype,"numVal",2);_([d()],w.prototype,"numPct",2);_([d()],w.prototype,"numErr",2);w=_([T("elec-account-wizard")],w);var La=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,Bt=(t,e,s,r)=>{for(var a=r>1?void 0:r?Aa(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&La(e,s,a),a};let Tt=class extends Q{constructor(){super(...arguments),this.st="loading",this.all=[],this.filter="",this.month="",this.q=""}connectedCallback(){super.connectedCallback(),R().bills&&this.load()}async load(){this.st="loading";try{this.all=(await f().listBills()).items,this.st=this.all.length?"ready":"empty"}catch{this.st="error"}}render(){if(!R().bills)return i`<div class="page" data-elec="bills" data-state="forbidden">${k("forbidden","lock","אין הרשאה לחיובים")}</div>`;if(this.st==="loading")return i`<div class="page" data-elec="bills" data-state="loading">${st(7)}</div>`;if(this.st==="error")return i`<div class="page" data-elec="bills" data-state="error">${k("error","warning","לא ניתן לטעון את החיובים",{label:"נסה שוב",run:()=>void this.load()})}</div>`;if(this.st==="empty")return i`<div class="page" data-elec="bills" data-state="empty">${k("empty","bolt","אין חיובים עדיין",{label:"לחשבונות",primary:!0,run:()=>Z(N.accounts())})}</div>`;const t=a=>this.all.filter(l=>l.state===a).length,e=[...new Set(this.all.map(a=>a.period.to.slice(0,7)))].sort().reverse(),s=this.q.trim(),r=this.all.filter(a=>(!this.filter||a.state===this.filter)&&(!this.month||a.period.to.startsWith(this.month))&&(!s||(a.number??"").includes(s)||a.customer.name.includes(s)||a.account_name.includes(s)));return i`<div class="page" data-elec="bills" data-state=${r.length?"ready":"filtered-empty"}>
      <div class="row">
        <div class="seg" role="group" aria-label="סינון לפי מצב" data-state-filter>
          <button type="button" data-filter="" aria-pressed=${this.filter===""} @click=${()=>this.filter=""}>הכול ${p(this.all.length)}</button>
          ${oa.map(a=>i`<button type="button" data-filter=${a} aria-pressed=${this.filter===a} @click=${()=>this.filter=a}>${da[a]} ${p(t(a))}</button>`)}
        </div>
        <span class="sp"></span>
        <select data-month aria-label="חודש" style="inline-size:auto" @change=${a=>this.month=a.target.value}><option value="">כל החודשים</option>${e.map(a=>i`<option value=${a} ?selected=${a===this.month}>${Pe(`${a}-01`)}</option>`)}</select>
        <input type="search" data-search aria-label="חיפוש מספר או לקוח" placeholder="חיפוש מספר או לקוח" .value=${this.q} @input=${a=>this.q=a.target.value} />
      </div>
      ${r.length?Ne(r,{phone:this.phone}):k("empty","search","לא נמצאו חיובים")}
    </div>`}};Bt([d()],Tt.prototype,"st",2);Bt([d()],Tt.prototype,"all",2);Bt([d()],Tt.prototype,"filter",2);Bt([d()],Tt.prototype,"month",2);Bt([d()],Tt.prototype,"q",2);Tt=Bt([T("elec-bills-list")],Tt);var Ba=Object.defineProperty,qa=Object.getOwnPropertyDescriptor,qt=(t,e,s,r)=>{for(var a=r>1?void 0:r?qa(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&Ba(e,s,a),a};const V=t=>i`<span class="n">${t}</span>`;let xt=class extends ft{constructor(){super(...arguments),this.snapshot=null,this.watermark="",this.logo="",this.hash="",this.zoom=1}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(t=>{const e=t[0].contentRect.width-(t[0].contentRect.width<520?16:40),s=Math.max(.3,Math.min(1,e/794));Math.abs(s-this.zoom)>.005&&(this.zoom=s)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}render(){const t=this.snapshot;if(!t)return o;const e=t.business,s=t.totals.total,r=t.bill.due_date??t.bill.expected_due_date,a=t.lines.length>1,l=new Set(t.lines.map(u=>`${u.from}|${u.to}`)).size,n=u=>u==="interpolated"||u==="carried",c=t.meters.filter(u=>n(u.start.kind)||u.end.kind!=="reading"&&u.end.reading_kwh!==null),v=t.history.previous.filter(u=>u.kwh!==null),h=v.length?v[v.length-1].kwh:null,m=this.watermark;return i`<div class="wrap" data-elec-paper>
      <div class="box" style="zoom:${this.zoom}">
        <div class="paper" style="--acc:${e.accent_color||"#2767ed"}">
          ${m?i`<div class="wm ${m==="בוטל"?"void":""}" data-watermark>${m}</div>`:o}
          <div class="ph">
            <div>
              <h1>${t.doc.title_he}</h1>
              <div class="sub">${t.doc.subtitle_he}</div>
              <div style="margin-block-start:12px">
                <b>מספר:</b> ${V(t.bill.number??"-")}${t.bill.replaces?i` <span class="sub">(מחליף את ${V(t.bill.replaces.number)})</span>`:o}<br />
                <b>תאריך הפקה:</b> ${V(E(t.bill.issue_date??"")||"-")}
              </div>
            </div>
            <div class="biz">
              <div class="info">
                <b>${e.name}</b><br />
                <span class="sub">${e.registration_no?i`ח.פ. ${V(e.registration_no)}<br />`:o}${e.address}<br />${e.phone?V(e.phone):o}${e.phone&&e.email?" · ":""}${e.email?V(e.email):o}</span>
              </div>
              <div class="logo">${this.logo?i`<img src=${this.logo} alt="" />`:(e.name||"A").slice(0,2)}</div>
            </div>
          </div>
          <div class="two">
            <div class="bx"><b>לכבוד</b><br />${t.customer.name}<br />${t.customer.address}<br />מספר לקוח: ${V(t.customer.customer_number)}<br />חשבון: ${t.account.name}</div>
            <div class="bx">
              <b>תקופת החיוב</b><br />מתאריך ${V(E(t.period.from))} עד תאריך ${V(E(t.period.to))} (${t.period.days} ימים)<br />תעריף: ${t.account.tariff.name}<br />לתשלום עד: ${V(E(r??""))}
            </div>
          </div>
          <div class="big"><span>סה״כ לתשלום</span><b class="n">${b(s)} ₪</b></div>
          <table>
            <thead><tr><th>מונה</th><th class="r">קריאה בתחילת התקופה</th><th class="r">קריאה בסוף התקופה</th><th class="r">צריכה (קוט״ש)</th><th class="r">חלק</th><th class="r">לחיוב (קוט״ש)</th></tr></thead>
            <tbody>
              ${t.meters.map(u=>i`<tr data-meter=${u.meter_id}><td>${u.name}</td><td class="r" data-start-kind=${u.start.kind}>${Dt(u.start.reading_kwh)}</td><td class="r">${Dt(u.end.reading_kwh)}</td><td class="r">${b(u.consumption_kwh)}</td><td class="r">${ca(Number(u.coefficient))}</td><td class="r">${b(u.contribution_kwh)}</td></tr>`)}
            </tbody>
          </table>
          <div class="note">נוסחת החשבון: ${t.account.formula.sentence_he}</div>
          ${c.map(u=>{const g=u.end.kind!=="reading"&&u.end.reading_kwh!==null,A=n(u.start.kind);return i`<div class="note">${u.name}: ${g?i`קריאת סוף התקופה ב-${V(vs(u.end.at))}`:""}${A&&g?"; ":""}${A?i`קריאת תחילת התקופה לפי ${fs(u.start.kind)}`:""}.</div>`})}
          <table>
            <thead><tr><th>פירוט</th><th class="r">כמות</th><th class="r">מחיר ליחידה</th><th class="r">סכום (₪)</th></tr></thead>
            <tbody>
              ${t.lines.map(u=>i`<tr data-line=${u.band?.id??"flat"}><td>צריכת חשמל${u.band?` - ${u.band.name_he}${u.season?` (${u.season.name_he})`:""}`:""}${(u.band?l>1:a)?i` (${V(E(u.from))} - ${V(E(u.to))})`:o}</td><td class="r">${b(u.kwh)} קוט״ש</td><td class="r">${B(u.unit_price_ex_vat)} ₪</td><td class="r">${b(u.amount_ex_vat)}</td></tr>`)}
              <tr><td>סה״כ לפני מע״מ</td><td></td><td></td><td class="r">${b(t.totals.amount_ex_vat)}</td></tr>
              <tr><td>מע״מ ${V(t.totals.vat_breakdown[0]?.rate_percent??t.lines[0]?.vat_rate_percent??"")}%</td><td></td><td></td><td class="r">${b(t.totals.vat_amount)}</td></tr>
              <tr class="tot"><td>סה״כ לתשלום</td><td></td><td></td><td class="r">${b(s)} ₪</td></tr>
            </tbody>
          </table>
          <div class="note">
            ${t.totals.price_mode_note_he?i`${t.totals.price_mode_note_he}; המחיר לפני מע״מ מוצג מעוגל ל-4 ספרות. `:o}הקריאות הן קריאות מונה מצטברות שנמדדו בפועל; הצריכה של כל מונה היא קריאת הסוף פחות קריאת הפתיחה.${h?i` צריכה בתקופה הקודמת: ${V(b(h))} קוט״ש.`:o}
          </div>
          ${t.notes.map(u=>i`<div class="note" data-note=${u.code}>${u.text_he}</div>`)}
          ${e.footer_note?i`<div class="note"><b>הערות:</b> ${e.footer_note}</div>`:o}
          ${Ie(t.history)?i`<div class="sec">השוואת צריכה</div><elec-chart print .series=${t.history} table="visible" .height=${190}></elec-chart>`:o}
          <div class="spacer"></div>
          <div class="foot"><span>הופק ב-SmplWise Arx</span><span>עמוד 1 מתוך 1</span><span class="n">${this.hash}</span></div>
        </div>
      </div>
    </div>`}};xt.styles=ht`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .wrap {
      display: flex;
      justify-content: center;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-lg);
      padding: 20px;
      overflow: hidden;
    }
    .box {
      flex: none;
    }
    .paper {
      inline-size: 794px;
      min-block-size: 1123px;
      background: #fff;
      color: #1d2433;
      box-shadow: 0 6px 30px rgba(0, 0, 0, 0.18);
      padding: 56px 52px 40px;
      font-family: 'Heebo', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      position: relative;
      direction: rtl;
      display: flex;
      flex-direction: column;
      --acc: #2767ed;
      color-scheme: light;
    }
    .ph {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border-block-end: 3px solid var(--acc);
      padding-block-end: 18px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      color: #1d2433;
    }
    .sub {
      color: #5b6a85;
      font-size: 12px;
    }
    .biz {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .biz .info {
      text-align: end;
    }
    .logo {
      inline-size: 64px;
      block-size: 64px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--acc), color-mix(in srgb, var(--acc) 60%, #fff));
      color: #fff;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 22px;
      flex: none;
      overflow: hidden;
    }
    .logo img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
      background: #fff;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-block-start: 18px;
    }
    .bx {
      border: 1px solid #d5dbe6;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .big {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-block-start: 18px;
      background: color-mix(in srgb, var(--acc) 9%, #fff);
      border-radius: 10px;
      padding: 14px 18px;
    }
    .big b {
      font-size: 26px;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      margin-block-start: 16px;
    }
    th {
      background: #f1f4f9;
      text-align: start;
      padding: 7px 9px;
      font-size: 12px;
      color: #1d2433;
    }
    td {
      border-block-end: 1px solid #e3e7ef;
      padding: 7px 9px;
    }
    .n {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    td.r,
    th.r {
      text-align: left;
    }
    td.r {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
    .tot td {
      font-weight: 800;
      font-size: 16px;
      border-block-start: 2px solid #1d2433;
      border-block-end: 0;
    }
    .note {
      margin-block-start: 12px;
      color: #5b6a85;
      font-size: 11.5px;
    }
    .note b {
      color: #1d2433;
    }
    .sec {
      margin-block-start: 18px;
      font-weight: 700;
      color: #1d2433;
    }
    .foot {
      margin-block-start: auto;
      padding-block-start: 8px;
      border-block-start: 1px solid #e3e7ef;
      display: flex;
      justify-content: space-between;
      color: #8a94a8;
      font-size: 10.5px;
    }
    .spacer {
      flex: 1;
      min-block-size: 24px;
    }
    .wm {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      pointer-events: none;
      font-size: 130px;
      font-weight: 800;
      color: rgba(39, 103, 237, 0.08);
      transform: rotate(-24deg);
      overflow: hidden;
    }
    .wm.void {
      color: rgba(217, 56, 56, 0.13);
    }
  `;qt([$({attribute:!1})],xt.prototype,"snapshot",2);qt([$()],xt.prototype,"watermark",2);qt([$()],xt.prototype,"logo",2);qt([$()],xt.prototype,"hash",2);qt([d()],xt.prototype,"zoom",2);xt=qt([T("elec-bill-paper")],xt);const Kt=t=>`energy/meters/${encodeURIComponent(t)}`,Fa={log:t=>js(`${Kt(t)}/manual-readings`),async addReading(t,e){const s=await ee(`${Kt(t)}/manual-readings`,e);return{reading:s.reading,log:s.log??null}},undoReading:(t,e,s)=>ee(`${Kt(t)}/manual-readings/${encodeURIComponent(e)}/undo`,s?{reason:s}:{}),async addCalibration(t,e){const s=await ee(`${Kt(t)}/calibrations`,e);return{calibration:s.calibration,log:s.log??null}},undoCalibration:(t,e,s)=>ee(`${Kt(t)}/calibrations/${encodeURIComponent(e)}/undo`,s?{reason:s}:{})},Va={kWh:1e3,Wh:1,MWh:1e6},ks={open_gap:"הקריאה השלימה את הפער מאז הדיווח האחרון. הצריכה עד הקריאה חולקה לפי זמן.",closed_gap:"הקריאה חילקה מחדש את הצריכה בפער הדיווח. הסכום הכולל לא השתנה.",head_gap:"הקריאה נקבעה כקריאת פתיחה לפני הקריאה הראשונה של המונה. הצריכה עד הקריאה הראשונה חולקה לפי זמן.",reported:"המונה דיווח בזמן הזה. הקריאה נשמרה להשוואה בלבד.",outside_counter:"הקריאה שונה מערך המונה במערכת. היא נשמרה להשוואה; לתיקון קבוע אפשר להגדיר כיול.",no_counter_data:"אין במערכת קריאות סביב הזמן הזה. הקריאה נשמרה להשוואה בלבד.",counter_events:"בזמן הזה היה איפוס או קפיצה במונה. הקריאה נשמרה להשוואה בלבד.",implausible:"הקריאה גבוהה מהסביר להספק המרבי של המונה. היא נשמרה להשוואה בלבד.",billed:"התקופה הזו כבר חויבה. הקריאה נשמרה להשוואה בלבד."};function Ka(t,e=0){const r={meter_id:t,items:[],calibrations:[],calibration:{factor:"1.0",offset_kwh:0,calibration_id:null,effective_date:null,identity:!0},suggestion:null,billed_until:"2026-09-30T21:00:00Z",first_calibration_date:"2026-10-01",undo_window_hours:24},a=(l,n,c,v,h,m,u={})=>({id:l,read_at:n,value_kwh:c,value_wh:Math.round(c*1e3),typed_value:String(c),typed_unit:"kWh",system_kwh:v,system_exact:v!=null,deviation_kwh:v==null?null:Math.round((c-v)*1e3)/1e3,effect:h,effect_reason:m,message:ks[m],note:null,created_at:n,created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!1,undo_until:null,...u});return t==="m1"&&(r.items=[a("r2","2026-10-01T06:10:00Z",247215.6,245830.1,"record","reported"),a("r1","2026-09-01T06:05:00Z",230981,229712.4,"record","reported",{note:"קריאה בלוח הראשי"})],r.calibrations=[{id:"c1",effective_date:"2026-10-02",effective_from:"2026-10-01T21:00:00Z",factor:"1.0",offset_kwh:1385.5,anchor_reading_id:"r2",note:null,in_force:!0,created_at:"2026-10-01T06:20:00Z",created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!1,undo_until:null}],r.calibration={factor:"1.0",offset_kwh:1385.5,calibration_id:"c1",effective_date:"2026-10-02",identity:!1},r.suggestion={factor:"1.0073",from_reading_id:"r1",to_reading_id:"r2",anchor_reading_id:"r2"}),t==="m8"&&(r.items=[a("r3","2026-10-04T17:30:00Z",e||18131.4,null,"allocation","open_gap",{created_at:Ls,can_undo:!0,undo_until:"2026-10-05T18:49:00Z"})]),r}const ke=new Map,zt=t=>new Promise(e=>setTimeout(()=>e(t),60)),It=t=>JSON.parse(JSON.stringify(t));function kt(t,e,s,r={}){throw new Gt(t,{code:e,user_message:s,retryable:!1,correlation_id:"demo",details:r})}const Ut=t=>(ke.has(t)||ke.set(t,Ka(t)),ke.get(t)),Ua={log:t=>zt(It(Ut(t))),addReading(t,e){const s=Ut(t),r=Number(e.value)*Va[e.unit]/1e3;if(!Number.isFinite(r)||r<0)return kt(422,"validation","הערך אינו מספר.",{fields:["value"]});if(Date.parse(e.read_at)>Date.now()+3e5)return kt(422,"validation","זמן הקריאה בעתיד.",{fields:["read_at"]});const l=s.items.filter(h=>!h.voided_at).filter(h=>h.read_at<e.read_at).sort((h,m)=>h.read_at<m.read_at?1:-1)[0];if(l&&r<l.value_kwh)return kt(422,"reading_not_monotonic","הקריאה נמוכה מקריאה ידנית קודמת של אותו מונה.",{fields:["value"]});const n=t==="m8"?null:1e3,c=t==="m8"?"open_gap":"reported",v={id:e.dry_run?null:`r${Date.now()}`,read_at:e.read_at,value_kwh:r,value_wh:Math.round(r*1e3),typed_value:e.value,typed_unit:e.unit,system_kwh:n,system_exact:n!=null,deviation_kwh:n==null?null:Math.round((r-n)*1e3)/1e3,effect:t==="m8"?"allocation":"record",effect_reason:c,message:ks[c],note:e.note??null,created_at:new Date().toISOString(),created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!0,undo_until:new Date(Date.now()+864e5).toISOString()};return e.dry_run?zt({reading:v,log:null}):(s.items=[v,...s.items].sort((h,m)=>h.read_at<m.read_at?1:-1),zt({reading:It(v),log:It(s)}))},undoReading(t,e,s){const r=Ut(t),a=r.items.find(l=>l.id===e);return a?a.can_undo?(Object.assign(a,{voided_at:new Date().toISOString(),voided_by_name:"דנה",void_reason:s??null,can_undo:!1}),zt(It(r))):kt(409,"undo_window_passed","עבר הזמן שבו אפשר לבטל את הקריאה (24 שעות)."):kt(404,"not_found","הקריאה לא נמצאה.")},addCalibration(t,e){const s=Ut(t),r=Number(e.factor);if(!Number.isFinite(r)||r<.5||r>2)return kt(422,"validation","המקדם חייב להיות בין 0.5 ל-2.",{fields:["factor"]});if(s.first_calibration_date&&e.effective_date<s.first_calibration_date)return kt(409,"calibration_billed","התקופה הזו כבר חויבה. אפשר לכייל רק מ-"+s.first_calibration_date.split("-").reverse().join(".")+" והלאה.");const a=s.items.find(c=>c.id===e.anchor_reading_id),l=a&&a.system_kwh!=null?Math.round((a.value_kwh-r*a.system_kwh)*1e3)/1e3:Number(e.offset_kwh??0),n={id:e.dry_run?null:`c${Date.now()}`,effective_date:e.effective_date,effective_from:`${e.effective_date}T00:00:00Z`,factor:String(r),offset_kwh:l,anchor_reading_id:e.anchor_reading_id??null,note:e.note??null,in_force:!1,created_at:new Date().toISOString(),created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!0,undo_until:new Date(Date.now()+864e5).toISOString()};return e.dry_run?zt({calibration:n,log:null}):(s.calibrations=[n,...s.calibrations],zt({calibration:It(n),log:It(s)}))},undoCalibration(t,e,s){const r=Ut(t),a=r.calibrations.find(l=>l.id===e);return a?(Object.assign(a,{voided_at:new Date().toISOString(),voided_by_name:"דנה",void_reason:s??null,can_undo:!1,in_force:!1}),zt(It(r))):kt(404,"not_found","הכיול לא נמצא.")}},Qt=()=>Rs()?Fa:Ua,Wa=t=>Qt().log(t),Ce=(t,e)=>Qt().addReading(t,e),Ha=(t,e,s)=>Qt().undoReading(t,e,s),Qe=(t,e)=>Qt().addCalibration(t,e),Ya=(t,e,s)=>Qt().undoCalibration(t,e,s);function ne(t){const e=t.trim().replace(/[\s ]/g,"").replace(/,(?=\d{3}(\D|$))/g,"").replace(",",".");return/^\d+(\.\d+)?$/.test(e)?e:null}function Ga(t){const e=t.trim().replace(",",".");if(!/^\d+(\.\d{1,6})?$/.test(e))return null;const s=Number(e);return s>=.5&&s<=2?e:null}function Za(t){if(!t)return null;const e=new Date(t);return Number.isNaN(e.getTime())?null:e.toISOString()}function xe(t){const e=s=>String(s).padStart(2,"0");return`${t.getFullYear()}-${e(t.getMonth()+1)}-${e(t.getDate())}T${e(t.getHours())}:${e(t.getMinutes())}`}const Qa={open_gap:"השלימה פער",closed_gap:"חילקה פער",head_gap:"קריאת פתיחה",reported:"להשוואה",outside_counter:"להשוואה",no_counter_data:"להשוואה",counter_events:"להשוואה",implausible:"להשוואה",billed:"להשוואה"};var Xa=Object.defineProperty,Ja=Object.getOwnPropertyDescriptor,q=(t,e,s,r)=>{for(var a=r>1?void 0:r?Ja(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&Xa(e,s,a),a};const Xe={email:"דוא״ל",hand:"מסירה ידנית",other:"אחר"};let j=class extends Q{constructor(){super(...arguments),this.billId="",this.st="loading",this.bill=null,this.events=[],this.dlg="",this.busy=!1,this.error="",this.pdfFail=null,this.reason="",this.reasonTouched=!1,this.date="",this.how="email",this.text="",this.openingMeter=null,this.openingInfo="",this.daily=!1,this.loaded=""}willUpdate(t){t.has("billId")&&this.billId&&this.loaded!==this.billId&&(this.loaded=this.billId,this.load())}async load(){this.st="loading",this.pdfFail=null;try{const[t,e]=await Promise.all([f().getBill(this.billId),f().billEvents(this.billId).catch(()=>[])]);this.bill=t,this.events=e,this.st="ready"}catch(t){this.error=C(t),this.st=le(t)==="forbidden"?"forbidden":"error"}}async refreshEvents(){this.events=await f().billEvents(this.billId).catch(()=>this.events)}open(t){this.dlg=t,this.error="",this.reason="",this.reasonTouched=!1,this.text="",this.date=et(),this.how="email"}close(){this.dlg=""}async act(t,e){if(!this.busy){this.busy=!0,this.error="";try{const s=await t();s&&(this.bill=s),this.close(),await this.refreshEvents(),e?.(s)}catch(s){this.error=C(s)}finally{this.busy=!1}}}issue(){const t=this.bill;this.act(()=>f().issueBill(t),async()=>{await this.pdf("check")})}async pdf(t){const e=this.bill;this.pdfFail=null;try{const s=await f().fetchPdf(e.id);if(e.state!=="draft"&&e.pdf&&e.pdf.state!=="stored"&&(this.bill=await f().getBill(e.id).catch(()=>this.bill)),t==="check")return;const r=URL.createObjectURL(s);if(t==="view")window.open(r,"_blank","noopener");else{const a=document.createElement("a");a.href=r,a.download=`${e.number??`draft-${e.id}`}.pdf`,a.click()}window.setTimeout(()=>URL.revokeObjectURL(r),3e4)}catch(s){this.pdfFail={code:le(s),text:C(s)}}}btn(t,e){switch(t){case"issue":return i`<button type="button" class="btn pri" data-act="issue" @click=${()=>this.open("issue")}>הנפקה</button>`;case"sent":return i`<button type="button" class="btn ${e.state==="issued"?"pri":""}" data-act="sent" @click=${()=>this.open("sent")}>סימון כנשלח</button>`;case"paid":return i`<button type="button" class="btn ${e.state==="sent"?"pri":""}" data-act="paid" @click=${()=>this.open("paid")}>סימון כשולם</button>`;case"recalculate":return i`<button type="button" class="btn" data-act="recalculate" ?disabled=${this.busy} @click=${()=>void this.act(()=>f().recalcBill(e))}>חישוב מחדש</button>`;case"pdf":return e.state==="draft"?i`<button type="button" class="btn" data-act="pdf" @click=${()=>void this.pdf("view")}>תצוגת PDF</button>`:i`<button type="button" class="btn" data-act="pdf" @click=${()=>void this.pdf("download")}>הורדת PDF</button>`;case"correct":return i`<button type="button" class="btn" data-act="correct" @click=${()=>this.open("correct")}>תיקון</button>`;case"void":return i`<button type="button" class="btn dng" data-act="void" @click=${()=>this.open("void")}>ביטול</button>`;case"delete":return i`<button type="button" class="btn dng" data-act="delete" @click=${()=>this.open("delete")}>מחיקת טיוטה</button>`;default:return o}}render(){if(!R().bills)return i`<div class="page" data-elec="bill" data-state="forbidden">${k("forbidden","lock","אין הרשאה לחיובים")}</div>`;if(this.st==="loading")return i`<div class="page" data-elec="bill" data-state="loading">${st(4)}</div>`;if(this.st!=="ready"||!this.bill)return i`<div class="page" data-elec="bill" data-state=${this.st}><div class="row"><a class="btn ghost sm" href=${P.bills()}>→ חיובים</a></div>${k(this.st==="forbidden"?"forbidden":"error",this.st==="forbidden"?"lock":"warning",this.error||"לא ניתן לטעון את החיוב",this.st==="error"?{label:"נסה שוב",run:()=>void this.load()}:void 0)}</div>`;const t=this.bill,e=t.snapshot,s=t.state==="draft"?"טיוטה":t.state==="void"?"בוטל":"",r=i`${t.actions.map(n=>this.btn(n,t))}`,a=t.state==="draft"?e.notes.filter(n=>n.code==="meter_not_reporting"||n.code==="carried_in"):[],l=i`<div class="card"><div class="hd"><b class="h3">פרטים</b></div><dl class="kv" data-bill-details>
        <dt>חשבון</dt><dd><a class="lnk" href=${P.account(t.account_id)}>${t.account_name}</a></dd><dt>לקוח</dt><dd>${t.customer.name}</dd>
        <dt>תקופה</dt><dd>${p(E(t.period.from))} - ${p(E(t.period.to))}</dd>
        ${t.issue_date?i`<dt>הונפק</dt><dd>${p(E(t.issue_date))}</dd>`:o}${t.due_date?i`<dt>לתשלום עד</dt><dd>${p(E(t.due_date))}</dd>`:o}
        ${t.sent?i`<dt>נשלח</dt><dd><span class="num" data-sent-at>${E(t.sent.at)}</span> · ${Xe[t.sent.how]}</dd>`:o}${t.paid?i`<dt>שולם</dt><dd><span class="num" data-paid-at>${E(t.paid.at)}</span>${t.paid.reference?i` · ${p(t.paid.reference)}`:o}</dd>`:o}
        <dt>מקור</dt><dd>${t.origin==="auto"?"נוצר אוטומטית":"נוצר ידנית"}</dd></dl></div>
      ${this.openingCard(t)}
      ${this.touCard(e)}
      <div class="card"><div class="hd"><b class="h3">יומן</b></div><div class="list" data-bill-log>${this.events.map(n=>i`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${vs(n.at)}</span><span>${n.text}</span></div>`)}</div></div>`;return i`<div class="page" data-elec="bill" data-state="ready" data-bill-state=${t.state} data-bill-id=${t.id}>
      <div class="row"><a class="btn ghost sm" href=${P.bills()} data-back>→ חיובים</a></div>
      <div class="row"><b class="h2 num" data-bill-number>${t.number??"טיוטה"}</b>${Ht(t.state)}
        ${t.replaces_bill_id&&e.bill.replaces?i`<span class="mut">מחליף את <a class="lnk num" href=${P.bill(t.replaces_bill_id)}>${e.bill.replaces.number}</a></span>`:o}
        ${t.replaced_by_bill_id?i`<span class="mut">הוחלף בחיוב <a class="lnk" href=${P.bill(t.replaced_by_bill_id)}>המתוקן</a></span>`:o}
        <span class="sp"></span>${this.phone?o:r}</div>
      ${this.phone?i`<div class="row" data-actions>${r}</div>`:o}
      ${this.pdfNotice(t)}
      ${t.state==="void"&&t.void?x("err",i`<b>בוטל:</b> ${t.void.reason}`):o}
      ${a.map(n=>x("warn",n.text_he))}
      <div class="cols side-l"><div style="min-inline-size:0"><elec-bill-paper .snapshot=${e} watermark=${s} .hash=${(t.snapshot_sha256??"").slice(0,12).replace(/(.{4})/g,"$1 ").trim()} .logo=${this.logoSrc()}></elec-bill-paper></div><div class="col">${l}</div></div>
      ${this.daily&&e.tou?this.dailyTable(e.tou):o}
      ${this.dialogs(t)}
    </div>`}openingCard(t){const e=t.snapshot.period.start_utc,s=t.snapshot.meters.filter(r=>r.start.kind==="first_reading"||r.start.kind==="none");return t.state!=="draft"||!e||!s.length||!R().manage?o:i`<div class="card" data-card="opening"><div class="hd"><b class="h3">קריאת פתיחה</b></div>
      <div class="list">${s.map(r=>i`<div class="row" data-opening-meter=${r.meter_id} style="flex-wrap:nowrap"><div class="grow"><div class="b">${r.name}</div><div class="mut">${r.start.reading_kwh===null?Dt(null):i`${p(Dt(r.start.reading_kwh))} · ${fs(r.start.kind)}`}</div></div>
        <button type="button" class="btn sm" data-opening-enter @click=${()=>this.openOpening(r)}>הזנה</button></div>`)}</div></div>`}openOpening(t){this.open("opening"),this.openingMeter=t,this.openingInfo=""}async saveOpening(){const t=this.bill,e=this.openingMeter,s=ne(this.text),r=t.snapshot.period.start_utc;if(!(!e||s===null||!r||this.busy)){this.busy=!0,this.error="";try{const a=await Ce(e.meter_id,{read_at:r,value:s,unit:"kWh",note:this.reason.trim()||void 0});if(a.reading.effect!=="allocation"){this.openingInfo=a.reading.message;return}this.bill=await f().recalcBill(t),this.close(),await this.refreshEvents()}catch(a){this.error=C(a)}finally{this.busy=!1}}}touCard(t){const e=t.tou;return e?i`<div class="card" data-card="tou"><div class="hd"><b class="h3">לפי שעות</b><span class="sp"></span>
        <button type="button" class="btn ghost sm" data-tou-daily aria-expanded=${this.daily?"true":"false"} @click=${()=>this.daily=!this.daily}>${this.daily?"הסתרת הפירוט היומי":"פירוט יומי"}</button></div>
      <div class="scrollx"><table class="t" data-tou-bands><thead><tr><th>פס</th><th class="num">שעות</th><th class="num">קוט״ש</th><th class="num">לפני מע״מ</th></tr></thead>
        <tbody>${e.by_band.map(s=>i`<tr data-band=${s.band.id}><td class="b">${s.band.name_he}</td><td class="num">${b(s.hours)}</td><td class="num">${b(s.kwh)}</td><td class="num">${b(s.amount_ex_vat)} ₪</td></tr>`)}</tbody></table></div>
      ${e.special_days.some(s=>s.kind!=="regular")?i`<div class="mut" style="margin-block-start:8px">ימים מיוחדים: ${e.special_days.filter(s=>s.kind!=="regular").map(s=>`${E(s.date)} ${s.name_he}`).join(", ")}</div>`:o}</div>`:o}dailyTable(t){const s=Object.keys(t.names.bands).filter(r=>t.daily.some(a=>a.bands.some(l=>l.band===r)));return i`<div class="card flush" data-tou-daily-table><div class="hd"><b class="h3">פירוט יומי לפי שעות (קוט״ש)</b><span class="sp"></span><span class="mut">לעיון; כל ערך מעוגל בנפרד</span></div>
      <div class="scrollx"><table class="t"><thead><tr><th>תאריך</th><th>סוג יום</th>${s.map(r=>i`<th class="num">${t.names.bands[r]}</th>`)}<th class="num">סה״כ</th></tr></thead>
        <tbody>${t.daily.map(r=>i`<tr data-day=${r.date}><td class="num" style="text-align:start">${E(r.date)}</td><td>${t.names.day_types[r.day_type]??r.day_type}${r.special?i` <span class="chip c-acc nodot">${r.special.name_he}</span>`:o}</td>
          ${s.map(a=>{const l=r.bands.find(n=>n.band===a);return i`<td class="num">${l?b(l.kwh):""}</td>`})}<td class="num b">${b(r.kwh)}</td></tr>`)}</tbody></table></div></div>`}pdfNotice(t){const e=t.pdf?.state,s=t.pdf?.error_code||"pdf_render_failed",r=this.pdfFail??(e==="failed"?{code:s,text:ye[s]??ye.pdf_render_failed}:e==="unavailable"?{code:"pdf_unavailable",text:ye.pdf_unavailable}:null);if(!r)return o;const a=ha.includes(r.code),l=r.code==="pdf_unavailable"?"unavailable":"failed";return i`<div class="alert ${a?"err":"warn"}" role="alert" data-pdf-error data-pdf-state=${l} data-pdf-code=${r.code}><span class="x" aria-hidden="true">!</span><div>${r.text}</div>${a?i`<button type="button" class="btn sm" data-pdf-retry @click=${()=>void this.pdf(t.state==="draft"?"view":"download")}>הפקת PDF מחדש</button>`:o}</div>`}logoSrc(){const t=this.bill.snapshot.business.logo;return t?f().logoUrl(t.sha256):""}dialogs(t){const e=this.error?x("err",this.error):o,s=(l="ביטול")=>i`<button slot="actions" type="button" class="btn" @click=${()=>this.close()}>${l}</button>`,r=`${pa(t.number??"")}-${t.revision+1}`,a=!this.reason.trim();return i`
      <elec-dialog heading="הנפקת חיוב" ?open=${this.dlg==="issue"} data-dialog="issue" @close=${()=>this.close()}>
        <div>החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.</div>
        <dl class="kv"><dt>חשבון</dt><dd>${t.account_name}</dd><dt>תקופה</dt><dd>${p(ut(t.period.from,t.period.to))}</dd><dt>סה״כ לתשלום</dt><dd>${p(b(t.total)+" ₪")}</dd></dl>${e}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${()=>this.issue()}>הנפקה</button>${s()}
      </elec-dialog>
      <elec-dialog heading=${`ביטול חיוב ${t.number??""}`} ?open=${this.dlg==="void"} data-dialog="void" @close=${()=>this.close()}>
        <div>החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.</div>
        <div class="fld"><label for="vr">סיבת הביטול</label>
          <textarea id="vr" data-reason class="${a&&this.reasonTouched?"err":""}" aria-required="true" placeholder="חובה" .value=${this.reason} @input=${l=>{this.reason=l.target.value,this.reasonTouched=!0}} @blur=${()=>this.reasonTouched=!0}></textarea>
          ${a&&this.reasonTouched?i`<div class="msg" role="alert" data-reason-error>צריך לכתוב סיבה</div>`:o}</div>${e}
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy||a} @click=${()=>void this.act(()=>f().voidBill(t.id,this.reason))}>ביטול החיוב</button>${s("חזרה")}
      </elec-dialog>
      <elec-dialog heading="תיקון חיוב" ?open=${this.dlg==="correct"} data-dialog="correct" @close=${()=>this.close()}>
        <div>תיווצר טיוטה מתוקנת${t.number?i` עם המספר <b class="num">${r}</b>`:""}. כשהיא תונפק, החיוב ${p(t.number??"")} יבוטל אוטומטית.</div>${e}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{const l=await f().correctBill(t.id);Z(N.bill(l.id)),this.billId=l.id})}>יצירת טיוטה מתוקנת</button>${s()}
      </elec-dialog>
      <elec-dialog heading="סימון כנשלח" ?open=${this.dlg==="sent"} data-dialog="sent" @close=${()=>this.close()}>
        <div class="form">
          <div class="fld"><label for="sd">תאריך משלוח</label><input id="sd" type="date" lang=${ot()} class="ltr ${K(this.date)?"":"err"}" data-date .value=${this.date} @change=${l=>this.date=l.target.value} /></div>
          <div class="fld"><span class="lbl">אופן משלוח</span><div class="seg" role="group" aria-label="אופן משלוח">${["email","hand","other"].map(l=>i`<button type="button" data-how=${l} aria-pressed=${this.how===l} @click=${()=>this.how=l}>${Xe[l]}</button>`)}</div></div>
        </div>${e}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy||!K(this.date)} @click=${()=>void this.act(()=>f().markSent(t.id,{at:this.date,how:this.how,note:"",row_version:t.row_version}))}>שמירה</button>${s()}
      </elec-dialog>
      <elec-dialog heading="סימון כשולם" ?open=${this.dlg==="paid"} data-dialog="paid" @close=${()=>this.close()}>
        <div class="form">
          <div class="fld"><label for="pd">תאריך תשלום</label><input id="pd" type="date" lang=${ot()} class="ltr ${K(this.date)?"":"err"}" data-date .value=${this.date} @change=${l=>this.date=l.target.value} /></div>
          <div class="fld"><label for="pr">אסמכתה (לא חובה)</label><input id="pr" class="ltr" data-reference placeholder="לא חובה" .value=${this.text} @input=${l=>this.text=l.target.value} /></div>
        </div>${e}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy||!K(this.date)} @click=${()=>void this.act(()=>f().markPaid(t.id,{at:this.date,reference:this.text.trim(),row_version:t.row_version}))}>שמירה</button>${s()}
      </elec-dialog>
      <elec-dialog heading=${`קריאת פתיחה - ${this.openingMeter?.name??""}`} ?open=${this.dlg==="opening"} data-dialog="opening" @close=${()=>this.close()}>
        <div>מה הראה המונה ב-${p(E(t.period.from))} בשעה 00:00. הצריכה מאז ועד הקריאה הראשונה שנקלטה תתווסף לחיוב.</div>
        <div class="form">
          <div class="fld"><label for="ov">קריאה (קוט״ש)</label><input id="ov" class="ltr ${this.text&&ne(this.text)===null?"err":""}" inputmode="decimal" data-opening-value .value=${this.text} @input=${l=>this.text=l.target.value} /></div>
          <div class="fld"><label for="on">הערה (לא חובה)</label><input id="on" data-opening-note placeholder="לא חובה" .value=${this.reason} @input=${l=>this.reason=l.target.value} /></div>
        </div>${this.openingInfo?x("warn",this.openingInfo):o}${e}
        <button slot="actions" type="button" class="btn pri" data-confirm ?disabled=${this.busy||ne(this.text)===null} @click=${()=>void this.saveOpening()}>שמירה וחישוב מחדש</button>${s()}
      </elec-dialog>
      <elec-dialog heading="מחיקת טיוטה" ?open=${this.dlg==="delete"} data-dialog="delete" @close=${()=>this.close()}>
        <div>הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.</div>${e}
        <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{await f().deleteDraft(t),Z(N.bills())})}>מחיקה</button>${s()}
      </elec-dialog>`}};q([$()],j.prototype,"billId",2);q([d()],j.prototype,"st",2);q([d()],j.prototype,"bill",2);q([d()],j.prototype,"events",2);q([d()],j.prototype,"dlg",2);q([d()],j.prototype,"busy",2);q([d()],j.prototype,"error",2);q([d()],j.prototype,"pdfFail",2);q([d()],j.prototype,"reason",2);q([d()],j.prototype,"reasonTouched",2);q([d()],j.prototype,"date",2);q([d()],j.prototype,"how",2);q([d()],j.prototype,"text",2);q([d()],j.prototype,"openingMeter",2);q([d()],j.prototype,"openingInfo",2);q([d()],j.prototype,"daily",2);j=q([T("elec-bill-page")],j);var ti=Object.defineProperty,ei=Object.getOwnPropertyDescriptor,tt=(t,e,s,r)=>{for(var a=r>1?void 0:r?ei(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&ti(e,s,a),a};const si=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,Je=(t="")=>({name:"",customer_number:t,tax_id:"",address:"",phone:"",email:"",notes:""});let W=class extends Q{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams,this.st="loading",this.list=[],this.q="",this.card=null,this.cardSt="loading",this.form=Je(),this.errs={},this.busy=!1,this.error="",this.confirmDel=!1,this.shown=""}connectedCallback(){super.connectedCallback(),R().bills&&this.loadList()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?(this.card=null,this.cardSt="ready",this.form=Je(),f().nextCustomerNumber().then(s=>this.form={...this.form,customer_number:s}).catch(()=>{})):this.loadCard(e):this.card=null)}async loadList(){this.st="loading";try{this.list=await f().listCustomers(),this.st=this.list.length?"ready":"empty"}catch{this.st="error"}}async loadCard(t){this.cardSt="loading";try{const e=await f().getCustomer(t);this.card=e,this.form={name:e.name,customer_number:e.customer_number,tax_id:e.tax_id??"",address:e.address??"",phone:e.phone??"",email:e.email??"",notes:e.notes??""},this.cardSt="ready"}catch{this.cardSt="error"}}close(){Z(N.customers())}validate(){const t={};return this.form.name.trim()||(t.name="צריך לכתוב שם ללקוח"),this.form.email&&!si.test(this.form.email)&&(t.email="כתובת דוא״ל לא תקינה"),/^\d{1,9}$/.test(this.form.customer_number)||(t.customer_number="מספר לקוח הוא ספרות בלבד"),this.errs=t,!Object.keys(t).length}async save(){if(!(this.busy||!this.validate())){this.busy=!0,this.error="";try{const t={...this.form,name:this.form.name.trim()};if(this.card){const e={...t};t.customer_number===this.card.customer_number&&delete e.customer_number,this.card=await f().updateCustomer(this.card.id,this.card.revision,e)}else{const e=await f().createCustomer(t);await this.loadList(),Z(N.customer(e.id));return}await this.loadList()}catch(t){const e=Rt(t);Object.keys(e).length?this.errs=e:this.error=C(t)}finally{this.busy=!1}}}async removeCustomer(){if(!(!this.card||this.busy)){this.busy=!0;try{await f().deleteCustomer(this.card.id,this.card.revision),this.confirmDel=!1,await this.loadList(),this.close()}catch(t){this.confirmDel=!1,this.error=C(t)}finally{this.busy=!1}}}field(t,e,s={}){const r=this.errs[t],a=s.ro||!R().manage;return i`<div class="fld ${s.wide?"wide":""}"><label for="f-${t}">${e}</label>
      ${s.area?i`<textarea id="f-${t}" name=${t} ?readonly=${a} placeholder=${s.ph??""} .value=${this.form[t]} @input=${l=>this.form={...this.form,[t]:l.target.value}}></textarea>`:i`<input id="f-${t}" name=${t} class="${s.ltr?"ltr":""} ${r?"err":""}" aria-invalid=${r?"true":"false"} ?readonly=${a} placeholder=${s.ph??""} .value=${this.form[t]} @input=${l=>{this.form={...this.form,[t]:l.target.value},this.errs[t]&&(this.errs={...this.errs,[t]:""})}} />`}
      ${r?i`<div class="msg" role="alert" data-field-error=${t}>${r}</div>`:o}</div>`}renderCard(){const t=R(),e=this.card;return i`<sw-sheet open wide .heading=${e?"כרטיס לקוח":"לקוח חדש"} data-customer-card @close=${()=>this.close()}>
        <div class="col" style="gap:14px">
        ${this.cardSt==="loading"?st(4):this.cardSt==="error"?k("error","warning","לא ניתן לטעון את הלקוח",{label:"נסה שוב",run:()=>void this.loadCard(this.segments[0])}):i`
          <div class="form">${this.field("name","שם הלקוח",{wide:!0})}${this.field("customer_number","מספר לקוח",{ltr:!0})}${this.field("tax_id","ח.פ. / ע.מ. (לא חובה)",{ltr:!0,ph:"לא חובה"})}
            ${this.field("address","כתובת למשלוח החיוב",{wide:!0})}${this.field("phone","טלפון",{ltr:!0})}${this.field("email","דוא״ל",{ltr:!0})}${this.field("notes","הערות",{wide:!0,ph:"לא חובה",area:!0})}</div>
          ${e?i`<b class="h3">חשבונות</b>
            <div class="list" data-customer-accounts>${(e.accounts??[]).map(s=>i`<a class="li" href=${P.account(s.id)}><div class="grow"><div class="t1">${s.name}</div></div></a>`)}${e.accounts?.length?o:i`<div class="mut">אין חשבונות ללקוח</div>`}</div>
            ${e.bills?.length?i`<b class="h3">חיובים אחרונים</b>${Ne(e.bills.slice(0,4),{phone:!0})}`:o}`:o}
          ${this.error?x("err",this.error):o}
          ${t.manage?i`<div class="row"><button type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>שמירה</button><span class="sp"></span>${e?i`<button type="button" class="btn dng" data-delete @click=${()=>this.confirmDel=!0}>מחיקת לקוח</button>`:o}</div>`:o}`}
        <elec-dialog heading="מחיקת לקוח" ?open=${this.confirmDel} data-dialog="delete-customer" @close=${()=>this.confirmDel=!1}>
          <div>הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.</div>
          <button slot="actions" type="button" class="btn dng pri" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeCustomer()}>מחיקה</button>
          <button slot="actions" type="button" class="btn" @click=${()=>this.confirmDel=!1}>ביטול</button>
        </elec-dialog>
        </div>
      </sw-sheet>`}render(){const t=R();if(!t.bills)return i`<div class="page" data-elec="customers" data-state="forbidden">${k("forbidden","lock","אין הרשאה ללקוחות")}</div>`;const e=this.q.trim(),s=this.list.filter(a=>!e||a.name.includes(e)||a.customer_number.includes(e));let r;return this.st==="loading"?r=st(5):this.st==="error"?r=k("error","warning","לא ניתן לטעון את הלקוחות",{label:"נסה שוב",run:()=>void this.loadList()}):this.st==="empty"?r=k("empty","user","אין לקוחות עדיין",t.manage?{label:"+ לקוח חדש",primary:!0,run:()=>Z(`${N.customers()}/new`)}:void 0):s.length?r=i`<div class="grid-cards" data-elec-list>${s.map(a=>i`<div class="card" data-customer-row=${a.id}>
        <div class="row" style="flex-wrap:nowrap"><div class="chip c-acc nodot" style="inline-size:36px;block-size:36px;justify-content:center;padding:0" aria-hidden="true">${a.name.slice(0,2)}</div><div style="min-inline-size:0"><a class="rowlink h3" href=${P.customer(a.id)}>${a.name}</a><div class="mut">מספר לקוח ${p(a.customer_number)}</div></div></div>
        <dl class="kv" style="margin-block-start:10px"><dt>חשבונות</dt><dd>${a.account_count}</dd>${a.phone?i`<dt>טלפון</dt><dd>${p(a.phone)}</dd>`:o}${a.email?i`<dt>דוא״ל</dt><dd>${p(a.email)}</dd>`:o}</dl></div>`)}</div>`:r=k("empty","search","לא נמצאו לקוחות"),i`<div class="page" data-elec="customers" data-state=${this.st}>
      <div class="row"><input type="search" data-search aria-label="חיפוש לקוח" placeholder="חיפוש לקוח" .value=${this.q} @input=${a=>this.q=a.target.value} /><span class="sp"></span>
        ${t.manage?i`<a class="btn pri ${this.phone?"sm":""}" data-new-customer href=${`#${N.customers()}/new`}>+ לקוח חדש</a>`:o}</div>
      ${r}
      ${this.segments[0]?this.renderCard():o}
    </div>`}};W.styles=[gt];tt([$({attribute:!1})],W.prototype,"segments",2);tt([$({attribute:!1})],W.prototype,"params",2);tt([d()],W.prototype,"st",2);tt([d()],W.prototype,"list",2);tt([d()],W.prototype,"q",2);tt([d()],W.prototype,"card",2);tt([d()],W.prototype,"cardSt",2);tt([d()],W.prototype,"form",2);tt([d()],W.prototype,"errs",2);tt([d()],W.prototype,"busy",2);tt([d()],W.prototype,"error",2);tt([d()],W.prototype,"confirmDel",2);W=tt([T("elec-customers-page")],W);var ai=Object.defineProperty,ii=Object.getOwnPropertyDescriptor,Ft=(t,e,s,r)=>{for(var a=r>1?void 0:r?ii(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&ai(e,s,a),a};const ts=Array.from({length:97},(t,e)=>ua(e*15)),es=/^\d{2}-\d{2}$/;let Et=class extends Q{constructor(){super(...arguments),this.definition=null,this.readonly=!1,this.errorPath="",this.priceMode="ex_vat",this.vatRate=null}emit(t){this.definition=t,this.dispatchEvent(new CustomEvent("tou-change",{detail:t,bubbles:!0,composed:!0}))}edit(t){if(!this.definition||this.readonly)return;const e=ae(this.definition);t(e),this.emit(e)}bad(t){return this.errorPath&&(this.errorPath===t||this.errorPath.startsWith(t+"[")||this.errorPath.startsWith(t+"."))?"err-on":""}bandName(t){return this.definition?.bands.find(e=>e.id===t)?.name_he??t}prices(t){const e=this.vatRate;return i`<div class="card flush" data-tou-prices>
      <div class="hd"><b class="h3">מחירים לקוט״ש</b><span class="sp"></span><span class="hint">${this.priceMode==="inc_vat"?"המחירים כוללים מע״מ":"המחירים לפני מע״מ"}</span></div>
      <div class="scrollx"><table class="t">
        <thead><tr><th>פס</th>${t.seasons.map(s=>i`<th>${s.name_he}</th>`)}</tr></thead>
        <tbody>${t.bands.map(s=>i`<tr><td class="b"><span class="sw" style="background:${se(t,s.id)}"></span>${s.name_he}${s.id===t.default_band?i` <span class="hint">(שאר השעות)</span>`:o}</td>
          ${t.seasons.map(r=>{const a=ma(t,r.id).includes(s.id),l=t.prices[r.id]?.[s.id]??"",n=`prices.${r.id}.${s.id}`;if(!a&&(l===""||l===null))return i`<td class="pc"><span class="hint">-</span></td>`;const c=Number(l),v=e!==null&&l!==""&&Number.isFinite(c)?this.priceMode==="ex_vat"?c*(1+e):c/(1+e):null;return i`<td class="pc"><div class="unit"><input class="ltr ${this.bad(n)?"err":""}" inputmode="decimal" aria-label=${`${s.name_he} ב${r.name_he}`} data-tou-price=${`${r.id}:${s.id}`} .value=${l??""} ?disabled=${this.readonly}
              @input=${h=>this.edit(m=>{(m.prices[r.id]??={})[s.id]=h.target.value.trim()||null})} /><span>₪</span></div>
              ${v!==null?i`<div class="hint">${this.priceMode==="ex_vat"?"כולל מע״מ":"לפני מע״מ"} ${p(B(v))}</div>`:o}</td>`})}</tr>`)}</tbody>
      </table></div>
    </div>`}dayRow(t,e,s,r,a){const l=t.schedule[e]?.[s]??[],n=t.bands.filter(m=>m.id!==t.default_band),c=a[e]?.[s]??[],v=(m,u)=>(Number(u.slice(0,2))*60+Number(u.slice(3))-(Number(m.slice(0,2))*60+Number(m.slice(3))))/1440*100,h=`schedule.${e}.${s}`;return i`<div class="b">${r}</div>
      <div class="day ${this.bad(h)}" data-tou-day=${`${e}:${s}`}>
        <div class="bar" role="img" aria-label=${`${r}: `+c.map(m=>`${m.from}-${m.to} ${this.bandName(m.band)}`).join(", ")}>${c.map(m=>i`<i style="inline-size:${v(m.from,m.to)}%;background:${se(t,m.band)}" title=${`${m.from}-${m.to} ${this.bandName(m.band)}`} data-cell=${m.band}></i>`)}</div>
        <div class="ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        ${l.map((m,u)=>i`<div class="rng" data-tou-range=${`${e}:${s}:${u}`}>
          <select aria-label="משעה" ?disabled=${this.readonly} @change=${g=>this.edit(A=>{A.schedule[e][s][u][0]=g.target.value})}>${ts.slice(0,96).map(g=>i`<option .selected=${g===m[0]} value=${g}>${g}</option>`)}</select>
          <span>עד</span>
          <select aria-label="עד שעה" ?disabled=${this.readonly} @change=${g=>this.edit(A=>{A.schedule[e][s][u][1]=g.target.value})}>${ts.slice(1).map(g=>i`<option .selected=${g===m[1]} value=${g}>${g}</option>`)}</select>
          <select aria-label="פס" ?disabled=${this.readonly} @change=${g=>this.edit(A=>{A.schedule[e][s][u][2]=g.target.value})}>${t.bands.map(g=>i`<option .selected=${g.id===m[2]} value=${g.id}>${g.name_he}</option>`)}</select>
          ${this.readonly?o:i`<button type="button" class="btn ghost sm ic" aria-label="הסרת טווח" data-tou-remove @click=${()=>this.edit(g=>{g.schedule[e][s].splice(u,1),g.schedule[e][s].length||delete g.schedule[e][s]})}>✕</button>`}
        </div>`)}
        ${this.readonly||!n.length?o:i`<div><button type="button" class="btn ghost sm" data-tou-add=${`${e}:${s}`} @click=${()=>this.edit(m=>{((m.schedule[e]??={})[s]??=[]).push(["17:00","22:00",n[0].id])})}>+ טווח שעות</button></div>`}
      </div>`}hours(t){const e=va(t),s=r=>r.ranges.map(([a,l])=>`${a.split("-").reverse().join(".")}-${l.split("-").reverse().join(".")}`).join(", ");return i`<div class="card" data-tou-hours>
      <div class="hd"><b class="h3">שעות לפי עונה</b><span class="sp"></span>
        <span class="legend">${t.bands.map(r=>i`<span><i style="background:${se(t,r.id)}"></i>${r.name_he}</span>`)}</span></div>
      <div class="col">${t.seasons.map(r=>i`<div class="season" data-tou-season=${r.id}>
        <div class="row"><b class="h3">${r.name_he}</b><span class="mut">${p(s(r))}</span></div>
        <div class="dt">${t.day_types.map(a=>this.dayRow(t,r.id,a.id,a.name_he,e))}</div>
      </div>`)}</div>
      <div class="hint" style="margin-block-start:8px">כל שעה שאינה בטווח שייכת ל${this.bandName(t.default_band)}. השעות הן שעון מקומי; טווח שעובר את חצות (22:00 עד 06:00) נספר באותו תאריך.</div>
    </div>`}structure(t){const e=this.readonly,s=(r,a,l,n)=>i`<select class="${this.bad(a)?"err":""}" ?disabled=${e} @change=${c=>this.edit(v=>l(v,c.target.value||null))}>
      ${n?i`<option value="" .selected=${r===null}>ללא שינוי</option>`:o}${t.day_types.map(c=>i`<option value=${c.id} .selected=${c.id===r}>${c.name_he}</option>`)}</select>`;return i`<details class="card" data-tou-structure ?open=${!!this.errorPath&&/^(seasons|bands|week|holiday|day_types|default_band)/.test(this.errorPath)}>
      <summary>מבנה התעריף: עונות, פסים וימים</summary>
      <div class="stru">
        <div class="col">
          <b>עונות</b>
          ${t.seasons.map((r,a)=>i`<div class="season ${this.bad(`seasons[${a}]`)}" data-tou-season-def=${r.id}>
            <div class="row"><input aria-label="שם העונה" .value=${r.name_he} ?disabled=${e} @input=${l=>this.edit(n=>{n.seasons[a].name_he=l.target.value})} />
              ${e||t.seasons.length<2?o:i`<button type="button" class="btn ghost sm ic" aria-label="הסרת העונה" @click=${()=>this.edit(l=>{const[n]=l.seasons.splice(a,1);delete l.schedule[n.id],delete l.prices[n.id]})}>✕</button>`}</div>
            ${r.ranges.map((l,n)=>i`<div class="rng"><span class="mut">מ</span><input class="md ltr" aria-label="מתאריך (חודש-יום)" placeholder="MM-DD" .value=${l[0]} ?disabled=${e} @change=${c=>{const v=c.target.value.trim();es.test(v)&&this.edit(h=>{h.seasons[a].ranges[n][0]=v})}} />
              <span class="mut">עד</span><input class="md ltr" aria-label="עד תאריך (חודש-יום)" placeholder="MM-DD" .value=${l[1]} ?disabled=${e} @change=${c=>{const v=c.target.value.trim();es.test(v)&&this.edit(h=>{h.seasons[a].ranges[n][1]=v})}} />
              ${e||r.ranges.length<2?o:i`<button type="button" class="btn ghost sm ic" aria-label="הסרת טווח תאריכים" @click=${()=>this.edit(c=>{c.seasons[a].ranges.splice(n,1)})}>✕</button>`}</div>`)}
            ${e?o:i`<div><button type="button" class="btn ghost sm" @click=${()=>this.edit(l=>{l.seasons[a].ranges.push(["01-01","01-31"])})}>+ טווח תאריכים</button></div>`}
          </div>`)}
          ${e?o:i`<div><button type="button" class="btn sm" data-tou-add-season @click=${()=>this.edit(r=>{const a=Ue("season",r.seasons.map(l=>l.id));r.seasons.push({id:a,name_he:"עונה חדשה",ranges:[["01-01","01-31"]]}),r.prices[a]={}})}>+ עונה</button></div>`}
          <div class="hint">העונות חייבות לכסות את כל השנה בלי חפיפה. 29 בפברואר שייך לעונה של 28 בפברואר.</div>
        </div>
        <div class="col">
          <b>פסי תעריף</b>
          ${t.bands.map((r,a)=>i`<div class="row ${this.bad(`bands[${a}]`)}"><span class="sw" style="background:${se(t,r.id)}"></span>
            <input aria-label="שם הפס" .value=${r.name_he} data-tou-band-name=${r.id} ?disabled=${e} @input=${l=>this.edit(n=>{n.bands[a].name_he=l.target.value})} />
            ${e||r.id===t.default_band||t.bands.length<2?o:i`<button type="button" class="btn ghost sm ic" aria-label="הסרת הפס" @click=${()=>this.edit(l=>{l.bands.splice(a,1);for(const n of Object.values(l.schedule))for(const c of Object.keys(n))n[c]=n[c].filter(v=>v[2]!==r.id),n[c].length||delete n[c];for(const n of Object.values(l.prices))delete n[r.id]})}>✕</button>`}</div>`)}
          ${e||t.bands.length>=8?o:i`<div><button type="button" class="btn sm" data-tou-add-band @click=${()=>this.edit(r=>{r.bands.push({id:Ue("band",r.bands.map(a=>a.id)),name_he:"פס חדש"})})}>+ פס</button></div>`}
          <div class="fld"><label>שאר השעות שייכות ל</label><select ?disabled=${e} @change=${r=>this.edit(a=>{a.default_band=r.target.value})}>${t.bands.map(r=>i`<option value=${r.id} .selected=${r.id===t.default_band}>${r.name_he}</option>`)}</select></div>
          <b>ימים</b>
          <div class="dt">${bs.map(r=>i`<span>${$s[r]}</span>${s(t.week[r],`week.${r}`,(a,l)=>{a.week[r]=l??a.day_types[0].id},!1)}`)}
            <span>חג</span>${s(t.holiday,"holiday",(r,a)=>{r.holiday=a},!0)}
            <span>ערב חג</span>${s(t.holiday_eve,"holiday_eve",(r,a)=>{r.holiday_eve=a},!0)}</div>
          <div class="hint">יום שמתאים לכמה סוגים (שבת שהיא גם ערב חג) מקבל את הסוג המאוחר ברשימה: ${t.day_types.map(r=>r.name_he).join(" ← ")}.</div>
        </div>
      </div>
    </details>`}render(){const t=this.definition;return t?i`<div class="tou" data-tou-editor>${this.prices(t)}${this.hours(t)}${this.structure(t)}</div>`:o}};Et.styles=[...Q.styles,ht`
      .tou {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      table.t td.pc {
        padding: 6px 8px;
        min-inline-size: 120px;
      }
      table.t td.pc .unit {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      table.t td.pc input {
        inline-size: 110px;
      }
      .hint {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-3);
      }
      .sw {
        display: inline-block;
        inline-size: 12px;
        block-size: 12px;
        border-radius: var(--sw-r-2xs);
        vertical-align: -1px;
        margin-inline-end: 6px;
        border: 1px solid var(--sw-border-strong);
      }
      .season {
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .dt {
        display: grid;
        grid-template-columns: 130px minmax(0, 1fr);
        gap: 6px 12px;
        align-items: start;
      }
      .day {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-inline-size: 0;
      }
      .bar {
        display: flex;
        block-size: 22px;
        border-radius: var(--sw-r-xs);
        overflow: hidden;
        border: 1px solid var(--sw-border-strong);
      }
      .bar i {
        display: block;
        block-size: 100%;
      }
      .ticks {
        display: flex;
        justify-content: space-between;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      .rng {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .rng select {
        inline-size: auto;
        min-inline-size: 92px;
      }
      .err-on {
        outline: 2px solid var(--sw-danger);
        outline-offset: 2px;
        border-radius: var(--sw-r-sm);
      }
      details > summary {
        cursor: pointer;
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
        min-block-size: var(--elec-touch);
        display: flex;
        align-items: center;
      }
      .stru {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        margin-block-start: 10px;
      }
      .stru .md {
        inline-size: 92px;
      }
      @media (max-width: 767px) {
        .dt {
          grid-template-columns: minmax(0, 1fr);
        }
        .stru {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `];Ft([$({attribute:!1})],Et.prototype,"definition",2);Ft([$({type:Boolean})],Et.prototype,"readonly",2);Ft([$()],Et.prototype,"errorPath",2);Ft([$()],Et.prototype,"priceMode",2);Ft([$({type:Number})],Et.prototype,"vatRate",2);Et=Ft([T("elec-tou-editor")],Et);var ri=Object.defineProperty,ni=Object.getOwnPropertyDescriptor,S=(t,e,s,r)=>{for(var a=r>1?void 0:r?ni(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&ri(e,s,a),a};const ss=/^\d+(\.\d+)?$/,as=/^#[0-9a-fA-F]{6}$/,li=t=>{const e=[1,3,5].map(s=>parseInt(t.slice(s,s+2),16)/255).map(s=>s<=.03928?s/12.92:((s+.055)/1.055)**2.4);return .2126*e[0]+.7152*e[1]+.0722*e[2]};function is(t){const e=t.current?.definition;return e?`${e.bands.map(s=>s.name_he).join(" / ")} · ${e.seasons.length} עונות`:"לפי שעות"}let D=class extends Q{constructor(){super(...arguments),this.st="loading",this.tariffs=[],this.vat=null,this.settings=null,this.tOpen=!1,this.tEdit=null,this.tf={name:"",price:"",mode:"ex_vat",from:""},this.tErr={},this.tVer=null,this.tPlan=null,this.tKind="fixed",this.tDef=null,this.tErrPath="",this.tSource="",this.vOpen=!1,this.vf={rate:"",from:""},this.vErr={},this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{const t=f();[this.tariffs,this.vat,this.settings]=await Promise.all([t.listTariffs(),t.getVat(),t.getSettings().catch(()=>null)]),this.st="ready"}catch(t){this.st=/הרשאה/.test(C(t))?"forbidden":"error"}}rate(){return this.vat?.current?Number(this.vat.current.rate_percent)/100:0}derived(t,e){const s=Number(t)||0,r=this.rate();return e==="ex_vat"?{ex:s,vat:s*r,inc:s*(1+r)}:{ex:s/(1+r),vat:s-s/(1+r),inc:s}}openTariff(t){this.tEdit=t,this.tf=t?.current?{name:t.name,price:t.current.price??"",mode:t.current.price_mode,from:et()}:{name:"",price:"",mode:this.settings?.default_price_mode??"ex_vat",from:et()},this.tKind=t?.kind==="tou"?"tou":"fixed",this.tDef=t?.kind==="tou"&&t.current?.definition?ae(t.current.definition):null,this.tSource="",this.tErrPath="",this.tErr={},this.tVer=null,this.tPlan=null,this.error="",this.tOpen=!0}async setKind(t){if(!(this.tEdit||this.tKind===t)&&(this.tKind=t,this.tErrPath="",this.error="",t==="tou"&&!this.tDef))try{const e=(await f().touTemplates())[0];this.tDef=ae(e?.definition??We()),this.tSource=e?.source_he??""}catch(e){this.tDef=We(),this.error=C(e)}}editVersion(t){this.tEdit&&(this.tVer=t,this.tPlan=null,this.tErr={},this.tErrPath="",this.error="",this.tf={name:this.tEdit.name,price:t.price??"",mode:t.price_mode,from:t.effective_from},t.definition&&(this.tDef=ae(t.definition)))}setTf(t){this.tf={...this.tf,...t},this.tPlan=null}planText(t){const e=s=>s.price===null?`מחירים לפי שעות ${s.price_mode==="inc_vat"?"כולל":"לפני"} מע״מ`:`${B(s.price)} ₪ ${s.price_mode==="inc_vat"?"כולל":"לפני"} מע״מ`;return`${e(t.old)} ← ${e(t.new)}. ${t.message_he}`}async saveTariff(){const t=this.tf,e=this.tKind==="tou",s={};if(t.name.trim()||(s.name="צריך לתת שם לתעריף"),!e&&(!ss.test(t.price)||Number(t.price)<=0)&&(s.price="המחיר חייב להיות מספר גדול מאפס"),K(t.from)||(s.from="צריך לבחור תאריך"),this.tErr=s,!(Object.keys(s).length||this.busy||e&&!this.tDef)){this.busy=!0,this.error="",this.tErrPath="";try{const r={name:t.name.trim(),price:e?"":t.price,price_mode:t.mode,effective_from:t.from,definition:e?this.tDef:null};if(this.tEdit){const a=await f().correctTariffVersion(this.tEdit.id,r,{replaceId:this.tVer?.id??null,base:this.tVer,confirm:!!this.tPlan});if(!a.applied&&a.plan){this.tPlan=a.plan;return}}else await f().createTariff(r);this.tPlan=null,this.tOpen=!1,this.tariffs=await f().listTariffs()}catch(r){const a=Rt(r);Object.keys(a).length?this.tErr=a:this.error=C(r);const l=r instanceof Gt?r.body.details?.errors?.[0]:void 0;l?.path!==void 0&&(this.tErrPath=l.path)}finally{this.busy=!1}}}async saveVat(){const t={};if((!ss.test(this.vf.rate)||Number(this.vf.rate)>50)&&(t.rate_percent="שיעור המע״מ חייב להיות בין 0 ל-50"),K(this.vf.from)||(t.effective_from="צריך לבחור תאריך"),this.vErr=t,!(Object.keys(t).length||this.busy)){this.busy=!0,this.error="";try{this.vat=await f().addVat(this.vf.rate,this.vf.from),this.vOpen=!1}catch(e){const s=Rt(e);Object.keys(s).length?this.vErr=s:this.error=C(e)}finally{this.busy=!1}}}async setMode(t){if(!(!this.settings||!R().manage||this.settings.default_price_mode===t))try{this.settings=await f().saveSettings(this.settings.revision,{default_price_mode:t}),this.error=""}catch(e){this.error=C(e)}}render(){const t=R();if(!t.bills&&!t.manage)return i`<div class="page" data-elec="settings-prices" data-state="forbidden">${k("forbidden","lock","אין הרשאה למחירים")}</div>`;if(this.st==="loading")return i`<div class="page" data-elec="settings-prices" data-state="loading">${st(4)}</div>`;if(this.st==="forbidden")return i`<div class="page" data-elec="settings-prices" data-state="forbidden">${k("forbidden","lock","אין הרשאה למחירים")}</div>`;if(this.st==="error")return i`<div class="page" data-elec="settings-prices" data-state="error">${k("error","warning","לא ניתן לטעון את המחירים",{label:"נסה שוב",run:()=>void this.load()})}</div>`;const e=this.vat?.current,s=(this.vat?.items??[]).slice().sort((n,c)=>n.effective_from<c.effective_from?1:-1),r=t.manage,a=this.derived(this.tf.price,this.tf.mode),l=this.settings?.default_price_mode??"ex_vat";return i`<div class="page" data-elec="settings-prices" data-state="ready">
      ${this.error&&!this.tOpen&&!this.vOpen?x("err",this.error):o}
      ${e?o:x("warn","לא הוגדר שיעור מע״מ. בלי שיעור אי אפשר להפיק חיובים.")}
      <div class="cols side-l">
        <div class="card ${this.phone?"":"flush"}"><div class="hd"><b class="h3">תעריפים</b><span class="sp"></span>${r?i`<button type="button" class="btn pri sm" data-new-tariff @click=${()=>this.openTariff(null)}>+ תעריף</button>`:o}</div>
          ${this.tariffs.length?this.phone?i`<div class="list" data-tariffs>${this.tariffs.map(n=>i`<button type="button" class="li" data-tariff-row=${n.id} data-kind=${n.kind} ?disabled=${!r} @click=${()=>r&&this.openTariff(n)}><div class="grow"><div class="t1">${n.name}</div><div class="t2">${n.kind==="tou"?i`${is(n)} · `:o}הוזן ${n.current?.price_mode==="inc_vat"?"כולל":"לפני"} מע״מ · מ-${p(E(n.current?.effective_from??""))}</div></div>${n.kind==="tou"?i`<span class="chip c-acc nodot">לפי שעות</span>`:i`<b class="num">${B(n.current?.price??0)} ₪</b>`}</button>`)}</div>`:i`<div class="scrollx"><table class="t" data-tariffs><thead><tr><th>שם</th><th class="num">מחיר שהוזן</th><th>הוזן</th><th class="num">לפני מע״מ</th><th class="num">כולל מע״מ</th><th>בתוקף מ</th><th>חשבונות</th></tr></thead><tbody>
                ${this.tariffs.map(n=>{const c=this.derived(n.current?.price??"0",n.current?.price_mode??"ex_vat"),v=n.kind==="tou";return i`<tr class="${r?"go":""}" data-tariff-row=${n.id} data-kind=${n.kind} @click=${()=>r&&this.openTariff(n)}><td class="b">${n.name}${v?i` <span class="chip c-acc nodot">לפי שעות</span>`:o}</td>${v?i`<td colspan="1" class="mut">${is(n)}</td><td>${n.current?.price_mode==="inc_vat"?"כולל מע״מ":"לפני מע״מ"}</td><td class="num">-</td><td class="num">-</td>`:i`<td class="num">${B(n.current?.price??0)} ₪</td><td>${n.current?.price_mode==="inc_vat"?"כולל מע״מ":"לפני מע״מ"}</td><td class="num">${B(c.ex)} ₪</td><td class="num">${B(c.inc)} ₪</td>`}<td class="num" style="text-align:start">${E(n.current?.effective_from??"")}</td><td>${n.used_by}</td></tr>`})}</tbody></table></div>`:k("empty","bolt","אין תעריפים עדיין",r?{label:"+ תעריף",primary:!0,run:()=>this.openTariff(null)}:void 0)}
        </div>
        <div class="col">
          <div class="card" data-card="vat"><div class="hd"><b class="h3">שיעור מע״מ</b><span class="sp"></span>${r?i`<button type="button" class="btn sm" data-new-vat @click=${()=>{this.vf={rate:"",from:et()},this.vErr={},this.error="",this.vOpen=!0}}>+ שיעור חדש</button>`:o}</div>
            ${e?i`<div class="row" style="align-items:baseline"><span style="font-size:var(--sw-fs-3xl);font-weight:700" data-vat-rate>${p(e.rate_percent+"%")}</span><span class="mut">מ-${p(E(e.effective_from))}</span></div>`:i`<div class="mut">לא הוגדר</div>`}
            ${s.slice(1).map((n,c)=>i`<div class="ver" style="margin-block-start:8px"><span class="num">${n.rate_percent}%</span><span>עד ${p(E(Yt(s[c].effective_from,-1)))}</span></div>`)}</div>
          <div class="card" data-card="mode"><div class="hd"><b class="h3">ברירת מחדל להזנת מחיר</b></div><div class="list" role="radiogroup" aria-label="ברירת מחדל להזנת מחיר">
            ${["ex_vat","inc_vat"].map(n=>i`<label class="li ${l===n?"sel":""}"><input type="radio" name="mode" data-default-mode=${n} .checked=${l===n} ?disabled=${!r} @change=${()=>void this.setMode(n)} /><span class="ind"></span><div class="grow t1">${n==="ex_vat"?"לפני מע״מ":"כולל מע״מ"}</div></label>`)}</div></div>
        </div>
      </div>
      <elec-dialog heading=${this.tEdit?"עריכת תעריף":"תעריף חדש"} ?open=${this.tOpen} ?wide=${this.tKind==="tou"} data-dialog="tariff" @close=${()=>this.tOpen=!1}>
        <div class="form">
          <div class="fld wide"><label for="tn">שם התעריף</label><input id="tn" class="${this.tErr.name?"err":""}" data-tariff-name .value=${this.tf.name} @input=${n=>this.setTf({name:n.target.value})} />${this.tErr.name?i`<div class="msg" role="alert">${this.tErr.name}</div>`:o}</div>
          ${this.tEdit?o:i`<div class="fld wide"><span class="lbl">סוג התעריף</span><div class="seg" role="group" aria-label="סוג התעריף"><button type="button" data-tariff-kind="fixed" aria-pressed=${this.tKind==="fixed"} @click=${()=>void this.setKind("fixed")}>מחיר קבוע</button><button type="button" data-tariff-kind="tou" aria-pressed=${this.tKind==="tou"} @click=${()=>void this.setKind("tou")}>לפי שעות (תעו״ז)</button></div></div>`}
          ${this.tKind==="fixed"?i`<div class="fld"><label for="tp">מחיר לקוט״ש</label><div class="unit"><input id="tp" class="ltr ${this.tErr.price?"err":""}" data-tariff-price inputmode="decimal" .value=${this.tf.price} @input=${n=>this.setTf({price:n.target.value})} /><span>₪</span></div>${this.tErr.price?i`<div class="msg" role="alert">${this.tErr.price}</div>`:o}</div>`:o}
          <div class="fld"><span class="lbl">${this.tKind==="tou"?"המחירים שהוזנו":"המחיר שהוזן"}</span><div class="seg" role="group" aria-label="סוג מחיר"><button type="button" data-tariff-mode="ex_vat" aria-pressed=${this.tf.mode==="ex_vat"} @click=${()=>this.setTf({mode:"ex_vat"})}>לפני מע״מ</button><button type="button" data-tariff-mode="inc_vat" aria-pressed=${this.tf.mode==="inc_vat"} @click=${()=>this.setTf({mode:"inc_vat"})}>כולל מע״מ</button></div></div>
          <div class="fld"><label for="tf">בתוקף מתאריך</label><input id="tf" type="date" lang=${ot()} class="ltr ${this.tErr.effective_from?"err":""}" data-tariff-from .value=${this.tf.from} @change=${n=>this.setTf({from:n.target.value})} />${this.tErr.effective_from?i`<div class="msg" role="alert">${this.tErr.effective_from}</div>`:o}</div>
        </div>
        ${this.tKind==="fixed"&&e?i`<div class="card soft" data-tariff-derived><dl class="kv"><dt>לפני מע״מ</dt><dd>${p(B(a.ex)+" ₪")}</dd><dt>מע״מ ${p(e.rate_percent+"%")}</dt><dd>${p(B(a.vat)+" ₪")}</dd><dt>כולל מע״מ</dt><dd>${p(B(a.inc)+" ₪")}</dd></dl></div>`:o}
        ${this.tKind==="tou"&&this.tSource&&!this.tEdit?x("info",this.tSource):o}
        ${this.tKind==="tou"&&this.tDef?i`<elec-tou-editor .definition=${this.tDef} .priceMode=${this.tf.mode} .vatRate=${e?Number(e.rate_percent)/100:null} .errorPath=${this.tErrPath}
            @tou-change=${n=>{this.tDef=n.detail,this.tPlan=null,this.tErrPath=""}}></elec-tou-editor>`:o}
        ${this.tEdit&&this.tEdit.versions.length?i`<b class="h3">גרסאות</b><div class="list" data-tariff-versions>${this.tEdit.versions.map(n=>i`<div class="ver" data-version=${n.id} aria-current=${this.tVer?.id===n.id?"true":"false"}><span class="num">${n.definition?"לפי שעות":`${B(n.price??0)} ₪`}</span><span>${n.price_mode==="inc_vat"?"כולל מע״מ":"לפני מע״מ"} · מ-${p(E(n.effective_from))}</span>${R().manage?i`<button type="button" class="btn ghost sm" data-version-edit=${n.id} aria-label="תיקון המחיר" @click=${()=>this.editVersion(n)}>תיקון</button>`:o}</div>`)}</div>`:o}
        ${this.tPlan?x("warn",this.planText(this.tPlan)):o}
        ${this.error?x("err",this.error):o}
        <button slot="actions" type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${()=>void this.saveTariff()}>${this.tPlan?"אישור והחלפה":this.tVer?"שמירת תיקון":"שמירה"}</button>
        <button slot="actions" type="button" class="btn" @click=${()=>this.tOpen=!1}>ביטול</button>
      </elec-dialog>
      <elec-dialog heading="שיעור מע״מ חדש" ?open=${this.vOpen} data-dialog="vat" @close=${()=>this.vOpen=!1}>
        <div class="form">
          <div class="fld"><label for="vr">שיעור</label><div class="unit"><input id="vr" class="ltr ${this.vErr.rate_percent?"err":""}" data-vat-input inputmode="decimal" .value=${this.vf.rate} @input=${n=>this.vf={...this.vf,rate:n.target.value}} /><span>%</span></div>${this.vErr.rate_percent?i`<div class="msg" role="alert">${this.vErr.rate_percent}</div>`:o}</div>
          <div class="fld"><label for="vf">בתוקף מתאריך</label><input id="vf" type="date" lang=${ot()} class="ltr ${this.vErr.effective_from?"err":""}" data-vat-from .value=${this.vf.from} @change=${n=>this.vf={...this.vf,from:n.target.value}} />${this.vErr.effective_from?i`<div class="msg" role="alert">${this.vErr.effective_from}</div>`:o}</div>
        </div>
        ${this.error?x("err",this.error):o}
        <button slot="actions" type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${()=>void this.saveVat()}>שמירה</button>
        <button slot="actions" type="button" class="btn" @click=${()=>this.vOpen=!1}>ביטול</button>
      </elec-dialog>
    </div>`}};S([d()],D.prototype,"st",2);S([d()],D.prototype,"tariffs",2);S([d()],D.prototype,"vat",2);S([d()],D.prototype,"settings",2);S([d()],D.prototype,"tOpen",2);S([d()],D.prototype,"tEdit",2);S([d()],D.prototype,"tf",2);S([d()],D.prototype,"tErr",2);S([d()],D.prototype,"tVer",2);S([d()],D.prototype,"tPlan",2);S([d()],D.prototype,"tKind",2);S([d()],D.prototype,"tDef",2);S([d()],D.prototype,"tErrPath",2);S([d()],D.prototype,"tSource",2);S([d()],D.prototype,"vOpen",2);S([d()],D.prototype,"vf",2);S([d()],D.prototype,"vErr",2);S([d()],D.prototype,"busy",2);S([d()],D.prototype,"error",2);D=S([T("elec-settings-prices")],D);function oi(t,e,s){const r=et();return{schema:"arx.energy.bill_snapshot/1",doc:{title_he:"חשבון צריכת חשמל ודרישת תשלום",subtitle_he:"אינו חשבונית מס",is_tax_invoice:!1},bill:{id:"",number:"2026-09-0001",revision:1,replaces:null,state:"issued",issue_date:r,due_date:e.mode==="net_days"?Yt(r,e.days):`${r.slice(0,7)}-${String(e.day_of_month).padStart(2,"0")}`,expected_due_date:null,payment_terms:{mode:e.mode,days:e.days,day_of_month:e.day_of_month}},period:{from:"2026-09-01",to:"2026-09-30",days:30},business:{...t,logo:s?{sha256:"x",mime:"image/png"}:null},customer:{id:"c",customer_number:"0001",name:"לקוח לדוגמה",address:"רחוב הדוגמה 12, עיר לדוגמה",phone:"",email:"",tax_id:""},account:{id:"a",name:"חשבון לדוגמה",tariff:{id:"t",name:"תעריף"},formula:{text:"[מונה]",sentence_he:"מונה לדוגמה"}},meters:[{meter_id:"m",name:"מונה לדוגמה",coefficient:"1",start:{at:"2026-09-01T00:00:00Z",reading_kwh:"1000.00",kind:"reading"},end:{at:"2026-09-30T23:59:00Z",reading_kwh:"1776.20",kind:"reading"},consumption_kwh:"776.20",contribution_kwh:"776.20"}],lines:[{from:"2026-09-01",to:"2026-09-30",kwh:"776.20",price_entered:"0.5430",price_mode:"ex_vat",unit_price_ex_vat:"0.5430",amount_ex_vat:"421.48",vat_rate_percent:"18",vat_amount:"75.87",total:"497.35"}],totals:{currency:"ILS",kwh:"776.20",amount_ex_vat:"421.48",vat_amount:"75.87",total:"497.35",vat_breakdown:[{rate_percent:"18",base:"421.48",vat:"75.87"}],price_mode_note_he:null},notes:[],history:{current:null,previous:[],same_period_last_year:null},meta:{software_version:"",computed_at:""}}}let dt=class extends Q{constructor(){super(...arguments),this.st="loading",this.s=null,this.biz={name:"",registration_no:"",address:"",phone:"",email:"",accent_color:"#2767ed",footer_note:""},this.terms={mode:"net_days",days:14,day_of_month:15},this.delay="6",this.errs={},this.busy=!1,this.error="",this.ok=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{this.apply(await f().getSettings()),this.st="ready"}catch(t){this.st=/הרשאה/.test(C(t))?"forbidden":"error"}}apply(t){this.s=t,this.biz={...t.business},this.terms={...t.payment_terms},this.delay=String(t.auto.delay_hours)}validate(){const t={};return this.biz.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.biz.email)&&(t.email="כתובת דוא״ל לא תקינה"),as.test(this.biz.accent_color)?li(this.biz.accent_color)>.6&&(t.accent_color="הצבע בהיר מדי להדפסה"):t.accent_color="צבע לא תקין",this.terms.mode==="net_days"&&!(Number.isInteger(this.terms.days)&&this.terms.days>=0&&this.terms.days<=120)&&(t.days="מספר הימים חייב להיות בין 0 ל-120"),this.terms.mode==="day_of_month"&&!(Number.isInteger(this.terms.day_of_month)&&this.terms.day_of_month>=1&&this.terms.day_of_month<=31)&&(t.day_of_month="היום בחודש חייב להיות בין 1 ל-31"),(!/^\d+$/.test(this.delay)||Number(this.delay)>72)&&(t.delay_hours="ההשהיה חייבת להיות בין 0 ל-72 שעות"),this.errs=t,!Object.keys(t).length}async save(){if(!(!this.s||this.busy||!this.validate())){this.busy=!0,this.error="",this.ok=!1;try{this.apply(await f().saveSettings(this.s.revision,{business:this.biz,payment_terms:this.terms,auto:{delay_hours:Number(this.delay)}})),this.ok=!0}catch(t){const e=Rt(t);Object.keys(e).length?this.errs=e:this.error=C(t)}finally{this.busy=!1}}}async logo(t){if(t){if(this.error="",!/^image\/(png|jpeg)$/.test(t.type)||t.size>1024*1024){this.error="הלוגו חייב להיות PNG או JPEG עד 1MB.";return}try{await f().uploadLogo(t),this.apply(await f().getSettings())}catch(e){this.error=C(e)}}}async removeLogo(){try{await f().removeLogo(),this.apply(await f().getSettings())}catch(t){this.error=C(t)}}fld(t,e,s={}){const r=this.errs[t];return i`<div class="fld ${s.wide?"wide":""}"><label for="b-${t}">${e}</label>
      ${s.area?i`<textarea id="b-${t}" name=${t} .value=${this.biz[t]} @input=${a=>this.biz={...this.biz,[t]:a.target.value}}></textarea>`:i`<input id="b-${t}" name=${t} class="${s.ltr?"ltr":""} ${r?"err":""}" aria-invalid=${r?"true":"false"} .value=${this.biz[t]} @input=${a=>{this.biz={...this.biz,[t]:a.target.value},this.errs={...this.errs,[t]:""}}} />`}
      ${r?i`<div class="msg" role="alert" data-field-error=${t}>${r}</div>`:o}</div>`}render(){const t=R();if(!t.bills&&!t.manage)return i`<div class="page" data-elec="settings-business" data-state="forbidden">${k("forbidden","lock","אין הרשאה לפרטי העסק")}</div>`;if(this.st==="loading")return i`<div class="page" data-elec="settings-business" data-state="loading">${st(4)}</div>`;if(this.st==="forbidden")return i`<div class="page" data-elec="settings-business" data-state="forbidden">${k("forbidden","lock","אין הרשאה לפרטי העסק")}</div>`;if(this.st==="error"||!this.s)return i`<div class="page" data-elec="settings-business" data-state="error">${k("error","warning","לא ניתן לטעון את ההגדרות",{label:"נסה שוב",run:()=>void this.load()})}</div>`;const e=t.manage,s=this.s,r=s.logo?f().logoUrl(s.logo.sha256):"",a=As("accent","light",8),l=this.terms;return i`<div class="page" data-elec="settings-business" data-state="ready">
      <div class="cols side-l"><div class="card" style="min-inline-size:0"><fieldset style="border:0;margin:0;padding:0;min-inline-size:0" ?disabled=${!e}><div class="form">
        <div class="fld wide"><span class="lbl">לוגו</span><div class="row">
          <div class="chip c-mut nodot" style="inline-size:96px;block-size:96px;padding:0;justify-content:center;border-radius:var(--sw-r-lg);overflow:hidden" data-logo>${r?i`<img src=${r} alt="לוגו" style="max-inline-size:100%;max-block-size:100%" />`:i`<span class="mut">אין לוגו</span>`}</div>
          <div><label class="btn" style="cursor:pointer">${s.logo?"החלפה":"העלאת לוגו"}<input type="file" accept="image/png,image/jpeg" data-logo-input style="position:absolute;inline-size:1px;block-size:1px;opacity:0" @change=${n=>void this.logo(n.target.files?.[0])} /></label>
            ${s.logo?i` <button type="button" class="btn ghost" data-logo-remove @click=${()=>void this.removeLogo()}>הסרה</button>`:o}<div class="mut" style="margin-block-start:6px">PNG או JPEG, עד 1MB</div></div></div></div>
        ${this.fld("name","שם העסק",{wide:!0})}${this.fld("registration_no","ח.פ. / ע.מ.",{ltr:!0})}${this.fld("phone","טלפון",{ltr:!0})}${this.fld("address","כתובת",{wide:!0})}${this.fld("email","דוא״ל",{ltr:!0})}
        <div class="fld"><span class="lbl" id="acc">צבע המותג</span><div class="row" role="group" aria-labelledby="acc" data-accent>
          ${a.map(n=>i`<button type="button" class="tok swatch" data-swatch=${n} aria-label=${`צבע ${n}`} aria-pressed=${this.biz.accent_color.toLowerCase()===n} style="background:${n};border:2px solid ${this.biz.accent_color.toLowerCase()===n?"var(--sw-text)":"transparent"}" @click=${()=>this.biz={...this.biz,accent_color:n}}></button>`)}
          <input type="color" data-accent-color aria-label="בחירה חופשית של צבע" .value=${as.test(this.biz.accent_color)?this.biz.accent_color:"#2767ed"} @input=${n=>this.biz={...this.biz,accent_color:n.target.value}} /></div>
          ${this.errs.accent_color?i`<div class="msg" role="alert" data-field-error="accent_color">${this.errs.accent_color}</div>`:o}</div>
        ${this.fld("footer_note","הערה קבועה בתחתית החיוב",{wide:!0,area:!0})}
        <div class="fld wide"><span class="lbl">מספור חיובים</span><div class="row" data-numbering style="padding:8px 12px;border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-sm)"><span class="num">${s.numbering.format}</span><span class="sp"></span><span class="mut">שנה-חודש-מספר לקוח, למשל ${p("2026-12-0001")}</span></div></div>
        <div class="fld wide"><span class="lbl" id="pt">תנאי תשלום</span><div class="row"><div class="seg" role="group" aria-labelledby="pt"><button type="button" data-terms="net_days" aria-pressed=${l.mode==="net_days"} @click=${()=>this.terms={...l,mode:"net_days"}}>ימים מיום ההפקה</button><button type="button" data-terms="day_of_month" aria-pressed=${l.mode==="day_of_month"} @click=${()=>this.terms={...l,mode:"day_of_month"}}>יום קבוע בחודש</button></div>
          ${l.mode==="net_days"?i`<div class="unit"><input class="ltr" data-days type="number" min="0" max="120" aria-label="ימים לתשלום" style="inline-size:90px" .value=${String(l.days)} @input=${n=>this.terms={...l,days:Number(n.target.value)}} /><span>ימים</span></div>`:i`<div class="unit"><input class="ltr" data-day-of-month type="number" min="1" max="31" aria-label="יום בחודש" style="inline-size:90px" .value=${String(l.day_of_month)} @input=${n=>this.terms={...l,day_of_month:Number(n.target.value)}} /><span>בחודש</span></div>`}</div>
          ${this.errs.days||this.errs.day_of_month?i`<div class="msg" role="alert" data-field-error="terms">${this.errs.days||this.errs.day_of_month}</div>`:o}</div>
        <div class="fld wide"><label for="dl">יצירת טיוטה אוטומטית</label><div class="unit"><input id="dl" class="ltr ${this.errs.delay_hours?"err":""}" data-delay type="number" min="0" max="72" style="inline-size:90px" .value=${this.delay} @input=${n=>{this.delay=n.target.value,this.errs={...this.errs,delay_hours:""}}} /><span>שעות אחרי סוף התקופה</span></div>${this.errs.delay_hours?i`<div class="msg" role="alert" data-field-error="delay_hours">${this.errs.delay_hours}</div>`:o}</div>
      </div></fieldset>
      ${this.error?x("err",this.error):o}${this.ok?x("ok","ההגדרות נשמרו"):o}
      ${e?i`<div class="row" style="margin-block-start:14px"><button type="button" class="btn pri" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>שמירה</button></div>`:o}</div>
      <div class="card"><div class="hd"><b class="h3">תצוגה מקדימה</b></div><div style="overflow:hidden;max-block-size:320px;border-radius:var(--sw-r-sm)" data-preview><elec-bill-paper .snapshot=${oi(this.biz,l,!!s.logo)} .logo=${r} hash=""></elec-bill-paper></div></div></div>
    </div>`}};S([d()],dt.prototype,"st",2);S([d()],dt.prototype,"s",2);S([d()],dt.prototype,"biz",2);S([d()],dt.prototype,"terms",2);S([d()],dt.prototype,"delay",2);S([d()],dt.prototype,"errs",2);S([d()],dt.prototype,"busy",2);S([d()],dt.prototype,"error",2);S([d()],dt.prototype,"ok",2);dt=S([T("elec-settings-business")],dt);var di=Object.defineProperty,ci=Object.getOwnPropertyDescriptor,Vt=(t,e,s,r)=>{for(var a=r>1?void 0:r?ci(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&di(e,s,a),a};let de=class extends Q{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams}render(){const[t,e]=this.segments;return t?t==="new"?i`<elec-account-wizard></elec-account-wizard>`:e==="edit"?i`<elec-account-wizard .accountId=${t}></elec-account-wizard>`:i`<elec-account-page .accountId=${t} .tab=${e==="history"||e==="bills"?e:"status"}></elec-account-page>`:i`<elec-accounts-list></elec-accounts-list>`}};Vt([$({attribute:!1})],de.prototype,"segments",2);Vt([$({attribute:!1})],de.prototype,"params",2);de=Vt([T("elec-accounts-page")],de);let ce=class extends Q{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams}render(){const[t]=this.segments;return t?i`<elec-bill-page .billId=${t}></elec-bill-page>`:i`<elec-bills-list></elec-bills-list>`}};Vt([$({attribute:!1})],ce.prototype,"segments",2);Vt([$({attribute:!1})],ce.prototype,"params",2);ce=Vt([T("elec-bills-page")],ce);var hi=Object.defineProperty,pi=Object.getOwnPropertyDescriptor,O=(t,e,s,r)=>{for(var a=r>1?void 0:r?pi(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&hi(e,s,a),a};const ui=[{id:"kWh",label:"קוט״ש"},{id:"Wh",label:"וואט־שעה"},{id:"MWh",label:"מגוואט־שעה"}],xs=ht`
  .rd {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h3 {
    margin: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
  }
  h4 {
    margin: 4px 0 0;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  .li {
    flex-wrap: wrap;
  }
  .li.dis .t1 .num {
    text-decoration: line-through;
  }
  .acts {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cal {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .sug {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
`;let At=class extends ft{constructor(){super(...arguments),this.bubbleSkin=new St(this),this.log=null,this.canManage=!1,this.error=""}open(t){this.dispatchEvent(new CustomEvent("open-dialog",{detail:t}))}calLine(t){const e=t.calibration;return e.identity?i`<div class="cal" data-calibration="none">ללא כיול: הקריאות כפי שהמונה מדווח</div>`:i`<div class="cal" data-calibration=${e.calibration_id??""}>כיול מ-<span class="num">${jt(e.effective_date)}</span> · מקדם <span class="num">${e.factor}</span>
      · הפרש <span class="num ltr">${Wt(e.offset_kwh)}</span> קוט״ש</div>`}reading(t){const e=t.deviation_kwh==null?"אין ערך מערכת לזמן הזה":i`מהמערכת <span class="num ltr">${Wt(t.deviation_kwh)}</span>`;return i`<div class="li ${t.voided_at?"dis":""}" data-reading=${t.id??""}>
      <div class="grow">
        <div class="t1"><span class="num">${ie(t.value_kwh)}</span> קוט״ש · <span class="num">${oe(t.read_at)}</span></div>
        <div class="t2 wrap">${e}${t.created_by_name?` · ${t.created_by_name}`:""}${t.note?` · ${t.note}`:""}${t.voided_at?i` · <b>בוטלה</b>${t.voided_by_name?` (${t.voided_by_name})`:""}`:""}</div>
      </div>
      <span class="chip nodot ${t.effect==="allocation"?"c-acc":"c-mut"}" data-effect=${t.effect_reason} title=${t.message}>${Qa[t.effect_reason]}</span>
      ${this.canManage&&t.can_undo&&t.id?i`<sw-button size="sm" variant="ghost" data-reading-undo=${t.id} @click=${()=>this.open({kind:"undo-reading",id:t.id})}>ביטול</sw-button>`:o}
    </div>`}calibration(t){return i`<div class="li ${t.voided_at?"dis":""}" data-cal=${t.id??""}>
      <div class="grow">
        <div class="t1">מ-<span class="num">${jt(t.effective_date)}</span> · מקדם <span class="num">${t.factor}</span> · הפרש <span class="num ltr">${Wt(t.offset_kwh)}</span></div>
        <div class="t2 wrap">${t.created_by_name??""}${t.note?` · ${t.note}`:""}${t.voided_at?i` · <b>בוטל</b>`:""}</div>
      </div>
      ${t.in_force?i`<span class="chip nodot c-acc">בתוקף</span>`:o}
      ${this.canManage&&t.can_undo&&t.id?i`<sw-button size="sm" variant="ghost" data-cal-undo=${t.id} @click=${()=>this.open({kind:"undo-calibration",id:t.id})}>ביטול</sw-button>`:o}
    </div>`}render(){const t=this.log;return i`<div class="rd" data-readings>
      <div class="row"><h3>קריאות ידניות וכיול</h3><span class="sp"></span>
        ${this.canManage&&t?i`<div class="acts"><sw-button size="sm" data-reading-add @click=${()=>this.open({kind:"reading"})}>קריאה ידנית</sw-button>
              <sw-button size="sm" data-calibrate @click=${()=>this.open({kind:"calibrate"})}>כיול</sw-button></div>`:o}</div>
      ${this.error?i`<div class="alert err" role="alert" data-readings-error>${this.error}</div>`:o}
      ${t?i`${this.calLine(t)}
            ${this.canManage&&t.suggestion?i`<div class="alert info sug" data-suggestion><div>לפי שתי קריאות ההשוואה: מקדם <span class="num">${t.suggestion.factor}</span></div><span class="sp"></span>
                  <sw-button size="sm" data-suggestion-apply @click=${()=>this.open({kind:"calibrate",factor:t.suggestion.factor,anchor:t.suggestion.anchor_reading_id})}>כיול לפי ההצעה</sw-button></div>`:o}
            ${t.items.length?i`<div class="list" data-reading-list>${t.items.map(e=>this.reading(e))}</div>`:i`<div class="mut" data-reading-empty>אין קריאות ידניות</div>`}
            ${t.calibrations.length?i`<h4>כיולים</h4><div class="list" data-cal-list>${t.calibrations.map(e=>this.calibration(e))}</div>`:o}`:this.error?o:i`<div class="skl" style="inline-size:60%"></div>`}
    </div>`}};At.styles=[gt,xs];O([$({attribute:!1})],At.prototype,"log",2);O([$({type:Boolean})],At.prototype,"canManage",2);O([$()],At.prototype,"error",2);At=O([T("elec-meter-readings")],At);let z=class extends ft{constructor(){super(...arguments),this.bubbleSkin=new St(this),this.meterId="",this.log=null,this.kind="",this.targetId="",this.presetFactor="",this.presetAnchor="",this.when="",this.value="",this.unit="kWh",this.note="",this.preview=null,this.previewError="",this.error="",this.fieldErrors={},this.busy=!1,this.date="",this.mode="anchor",this.anchor="",this.factor="1",this.offset="0",this.reason="",this.timer=0,this.seq=0}willUpdate(t){t.has("kind")&&this.kind&&this.reset()}disconnectedCallback(){window.clearTimeout(this.timer),super.disconnectedCallback()}reset(){if(this.preview=null,this.previewError="",this.error="",this.fieldErrors={},this.busy=!1,this.reason="",this.note="",this.kind==="reading"&&(this.when=xe(new Date),this.value="",this.unit="kWh"),this.kind==="calibrate"){const t=xe(new Date).slice(0,10),e=this.log?.first_calibration_date??"";this.date=e&&e>t?e:t,this.factor=this.presetFactor||"1";const s=this.anchors();this.anchor=this.presetAnchor||s[0]?.id||"",this.mode=s.length?"anchor":"offset",this.offset="0",this.schedule()}}anchors(){return(this.log?.items??[]).filter(t=>!t.voided_at&&t.id&&(t.system_kwh!=null||t.effect==="allocation"))}close(){window.clearTimeout(this.timer),this.dispatchEvent(new CustomEvent("close"))}saved(t){this.dispatchEvent(new CustomEvent("saved",{detail:t}))}readingBody(t){const e={},s=Za(this.when);s?Date.parse(s)>Date.now()+3e5&&(e.when="זמן הקריאה בעתיד"):e.when="צריך לבחור תאריך ושעה";const r=ne(this.value);return r==null&&(e.value="צריך להזין מספר תקין"),t||(this.fieldErrors=e),Object.keys(e).length||!s||r==null?null:{read_at:s,value:r,unit:this.unit,...this.note.trim()?{note:this.note.trim()}:{},dry_run:t}}calibrationBody(t){const e={};/^\d{4}-\d{2}-\d{2}$/.test(this.date)||(e.date="צריך לבחור תאריך");const s=Ga(this.factor);s==null&&(e.factor="מקדם בין 0.5 ל-2");let r="0";if(this.mode==="offset"){const a=this.offset.trim().replace(",",".");r=/^[-−]?\d+(\.\d+)?$/.test(a)?a.replace("−","-"):null,r==null&&(e.offset="צריך להזין מספר תקין")}else this.anchor||(e.anchor="צריך לבחור קריאה");return t||(this.fieldErrors=e),Object.keys(e).length||s==null?null:{effective_date:this.date,factor:s,...this.mode==="anchor"?{anchor_reading_id:this.anchor}:{offset_kwh:r??"0"},...this.note.trim()?{note:this.note.trim()}:{},dry_run:t}}schedule(){window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.runPreview(),350)}async runPreview(){const t=++this.seq;try{if(this.kind==="reading"){const e=this.readingBody(!0);if(!e)return this.preview=null,void(this.previewError="");const s=await Ce(this.meterId,e);t===this.seq&&(this.preview=s.reading,this.previewError="")}else if(this.kind==="calibrate"){const e=this.calibrationBody(!0);if(!e)return this.preview=null,void(this.previewError="");const s=await Qe(this.meterId,e);t===this.seq&&(this.preview=s.calibration,this.previewError="")}}catch(e){t===this.seq&&(this.preview=null,this.previewError=G(e))}}async save(){if(this.busy)return;const t=this.kind==="reading"?this.readingBody(!1):this.calibrationBody(!1);if(t){this.busy=!0,this.error="";try{const e=this.kind==="reading"?await Ce(this.meterId,t):await Qe(this.meterId,t);e.log&&this.saved(e.log),this.close()}catch(e){this.error=G(e);const s=e instanceof Gt?e.body.details?.fields??[]:[];s.length&&(this.fieldErrors=Object.fromEntries(s.map(r=>[r==="read_at"?"when":r==="effective_date"?"date":r==="offset_kwh"?"offset":r==="anchor_reading_id"?"anchor":r," "])))}finally{this.busy=!1}}}async undo(){if(!this.busy){this.busy=!0,this.error="";try{const t=this.kind==="undo-reading"?await Ha(this.meterId,this.targetId,this.reason.trim()||void 0):await Ya(this.meterId,this.targetId,this.reason.trim()||void 0);this.saved(t),this.close()}catch(t){this.error=G(t)}finally{this.busy=!1}}}fieldMsg(t){const e=this.fieldErrors[t];return e&&e.trim()?i`<div class="msg" role="alert" data-field-error=${t}>${e}</div>`:o}readingPreview(){const t=this.preview;return this.previewError?i`<div class="alert warn" role="status" data-reading-preview="error">${this.previewError}</div>`:t?i`<div class="pv" data-reading-preview=${t.effect_reason}>
      <dl class="kv">
        <dt>המערכת באותו זמן</dt><dd>${t.system_kwh==null?"אין ערך":i`<span class="num">${ie(t.system_kwh)}</span> קוט״ש`}</dd>
        ${t.deviation_kwh==null?o:i`<dt>הפרש</dt><dd><span class="num ltr">${Wt(t.deviation_kwh)}</span> קוט״ש</dd>`}
      </dl>
      <div data-preview-message>${t.message}</div>
    </div>`:o}renderReading(){const t=(e,s)=>{this[e]=s,e!=="note"&&(this.fieldErrors={...this.fieldErrors,[e]:""},this.schedule())};return i`<sw-dialog open heading="קריאה ידנית" data-reading-dialog @close=${e=>{e.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="fld"><label for="rw">תאריך ושעה</label>
          <div class="inp ${this.fieldErrors.when?"err":""}"><input id="rw" type="datetime-local" lang=${ot()} data-reading-when max=${xe(new Date)} .value=${this.when} @input=${e=>t("when",e.target.value)} /></div>
          ${this.fieldMsg("when")}</div>
        <div class="fld"><label for="rv">קריאת המונה</label>
          <div class="inp ${this.fieldErrors.value?"err":""}"><input id="rv" data-reading-value inputmode="decimal" autocomplete="off" dir="ltr" .value=${this.value} @input=${e=>t("value",e.target.value)} />
            <select data-reading-unit aria-label="יחידה" @change=${e=>{this.unit=e.target.value,this.schedule()}}>
              ${ui.map(e=>i`<option value=${e.id} ?selected=${e.id===this.unit}>${e.label}</option>`)}</select></div>
          ${this.fieldMsg("value")}</div>
        <div class="fld wide"><label for="rn">הערה (לא חובה)</label><div class="inp"><input id="rn" data-reading-note maxlength="500" .value=${this.note} @input=${e=>t("note",e.target.value)} /></div></div>
        <div class="wide">${this.readingPreview()}</div>
        ${this.error?i`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:o}
      </div>
      <sw-button slot="footer" variant="primary" data-reading-save ?disabled=${this.busy} @click=${()=>void this.save()}>שמירה</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>ביטול</sw-button>
    </sw-dialog>`}renderCalibrate(){const t=this.anchors(),e=this.preview,s=this.log?.first_calibration_date??"",r=(a,l)=>{this[a]=l,this.fieldErrors={...this.fieldErrors,[a]:""},this.schedule()};return i`<sw-dialog open heading="כיול מונה" data-calibrate-dialog @close=${a=>{a.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="hint wide">מהתאריך: קריאה פיזית = מקדם × מונה המערכת + הפרש. חיובים שהופקו לא משתנים.</div>
        <div class="fld"><label for="cd">בתוקף מ-</label>
          <div class="inp ${this.fieldErrors.date?"err":""}"><input id="cd" type="date" lang=${ot()} data-cal-date min=${s} .value=${this.date} @input=${a=>r("date",a.target.value)} /></div>
          ${this.fieldMsg("date")}</div>
        <div class="fld"><label for="cf">מקדם</label>
          <div class="inp ${this.fieldErrors.factor?"err":""}"><input id="cf" data-cal-factor inputmode="decimal" dir="ltr" .value=${this.factor} @input=${a=>r("factor",a.target.value)} /></div>
          ${this.fieldMsg("factor")}</div>
        <div class="fld wide"><span class="lbl">הפרש</span>
          <div class="seg" role="group" aria-label="הפרש">
            <button type="button" data-cal-mode="anchor" aria-pressed=${this.mode==="anchor"?"true":"false"} ?disabled=${!t.length} @click=${()=>{this.mode="anchor",this.schedule()}}>לפי קריאה ידנית</button>
            <button type="button" data-cal-mode="offset" aria-pressed=${this.mode==="offset"?"true":"false"} @click=${()=>{this.mode="offset",this.schedule()}}>הזנה ידנית</button></div></div>
        ${this.mode==="anchor"?i`<div class="fld wide"><label for="ca">קריאה</label>
              <div class="inp ${this.fieldErrors.anchor?"err":""}"><select id="ca" data-cal-anchor @change=${a=>r("anchor",a.target.value)}>
                ${t.map(a=>i`<option value=${a.id} ?selected=${a.id===this.anchor}>${oe(a.read_at)} · ${ie(a.value_kwh)} קוט״ש</option>`)}</select></div>
              ${this.fieldMsg("anchor")}</div>`:i`<div class="fld wide"><label for="co">הפרש (קוט״ש)</label>
              <div class="inp ${this.fieldErrors.offset?"err":""}"><input id="co" data-cal-offset inputmode="decimal" dir="ltr" .value=${this.offset} @input=${a=>r("offset",a.target.value)} /></div>
              ${this.fieldMsg("offset")}</div>`}
        <div class="fld wide"><label for="cn">הערה (לא חובה)</label><div class="inp"><input id="cn" data-cal-note maxlength="500" .value=${this.note} @input=${a=>this.note=a.target.value} /></div></div>
        ${this.previewError?i`<div class="alert warn wide" role="status" data-cal-preview="error">${this.previewError}</div>`:e?i`<div class="pv wide" data-cal-preview><div>מ-<span class="num">${jt(e.effective_date)}</span>: מקדם <span class="num">${e.factor}</span>, הפרש <span class="num ltr">${Wt(e.offset_kwh)}</span> קוט״ש</div></div>`:o}
        ${this.error?i`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:o}
      </div>
      <sw-button slot="footer" variant="primary" data-cal-save ?disabled=${this.busy} @click=${()=>void this.save()}>שמירה</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>ביטול</sw-button>
    </sw-dialog>`}renderUndo(){const t=this.kind==="undo-reading",e=t?this.log?.items.find(a=>a.id===this.targetId):void 0,s=t?void 0:this.log?.calibrations.find(a=>a.id===this.targetId),r=e?i`הקריאה <span class="num">${ie(e.value_kwh)}</span> קוט״ש מ-<span class="num">${oe(e.read_at)}</span>`:s?i`הכיול מ-<span class="num">${jt(s.effective_date)}</span>`:"";return i`<sw-dialog open heading=${t?"ביטול קריאה ידנית":"ביטול כיול"} data-undo-dialog @close=${a=>{a.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="wide">${r} תבוטל ותישאר ברשימה כמבוטלת.</div>
        <div class="fld wide"><label for="ur">סיבה (לא חובה)</label><div class="inp"><input id="ur" data-undo-reason maxlength="300" .value=${this.reason} @input=${a=>this.reason=a.target.value} /></div></div>
        ${this.error?i`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:o}
      </div>
      <sw-button slot="footer" variant="danger" data-undo-confirm ?disabled=${this.busy} @click=${()=>void this.undo()}>ביטול ${t?"הקריאה":"הכיול"}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>חזרה</sw-button>
    </sw-dialog>`}render(){return this.kind==="reading"?this.renderReading():this.kind==="calibrate"?this.renderCalibrate():this.kind==="undo-reading"||this.kind==="undo-calibration"?this.renderUndo():o}};z.styles=[gt,xs,ht`
      :host {
        display: contents;
      }
      .pv {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        font-size: var(--sw-fs-sm);
      }
      dl.kv {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 14px;
        margin: 0;
      }
      dl.kv dt {
        color: var(--sw-text-3);
      }
      dl.kv dd {
        margin: 0;
      }
      .form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .form .wide {
        grid-column: 1 / -1;
      }
      .hint {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-3);
      }
      @media (max-width: 520px) {
        .form {
          grid-template-columns: 1fr;
        }
      }
    `];O([$()],z.prototype,"meterId",2);O([$({attribute:!1})],z.prototype,"log",2);O([$()],z.prototype,"kind",2);O([$()],z.prototype,"targetId",2);O([$()],z.prototype,"presetFactor",2);O([$()],z.prototype,"presetAnchor",2);O([d()],z.prototype,"when",2);O([d()],z.prototype,"value",2);O([d()],z.prototype,"unit",2);O([d()],z.prototype,"note",2);O([d()],z.prototype,"preview",2);O([d()],z.prototype,"previewError",2);O([d()],z.prototype,"error",2);O([d()],z.prototype,"fieldErrors",2);O([d()],z.prototype,"busy",2);O([d()],z.prototype,"date",2);O([d()],z.prototype,"mode",2);O([d()],z.prototype,"anchor",2);O([d()],z.prototype,"factor",2);O([d()],z.prototype,"offset",2);O([d()],z.prototype,"reason",2);z=O([T("elec-reading-dialogs")],z);var mi=Object.defineProperty,vi=Object.getOwnPropertyDescriptor,M=(t,e,s,r)=>{for(var a=r>1?void 0:r?vi(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&mi(e,s,a),a};const Es={reporting:"מדווח",stale:"לא מדווח",paused:"מושהה"},Ss={reporting:"c-ok",stale:"c-warn",paused:"c-mut"},rs={hours:"24 שעות",days:"30 ימים",months:"12 חודשים"},fi={install:"התקנה",reset:"איפוס",replace:"החלפת מונה",source_change:"שינוי מקור"};function bi(t,e){if(!t.length)return i`<div class="mut">אין נתונים לתקופה</div>`;const l=Math.max(...t.map(m=>m.value),1)*1.15,n=588/t.length,c=Math.min(n*.64,24),v=Math.ceil(t.length/12),h=t.reduce((m,u,g)=>u.value>t[m].value?g:m,0);return i`<svg class="chart" viewBox="0 0 ${640} ${170}" role="img" aria-label=${e} data-chart>
    ${rt`<line x1=${26} x2=${614} y1=${148} y2=${148} class="grid" />`}
    ${t.map((m,u)=>{const g=Math.max(m.value>0?2:0,m.value/l*126),A=614-(u+1)*n+(n-c)/2,$t=u===t.length-1;return rt`<rect class=${$t?"bar hi":"bar"} x=${A} y=${148-g} width=${c} height=${g} rx="3"><title>${m.label}: ${nt(m.value)}</title></rect>
        ${u%v===0||$t?rt`<text x=${A+c/2} y=${164} text-anchor="middle">${m.label}</text>`:o}
        ${$t||u===h?rt`<text x=${A+c/2} y=${143-g} text-anchor="middle" class="val">${Math.round(m.value)}</text>`:o}`})}
  </svg>`}let I=class extends ft{constructor(){super(...arguments),this.bubbleSkin=new St(this),this.meterId="",this.canManage=!1,this.detail=null,this.phase="loading",this.error="",this.range="days",this.points=[],this.chartError=!1,this.dlg="",this.log=null,this.logError="",this.dlgDetail=null,this.newName="",this.otherNames=[],this.nameError="",this.busy=!1,this.actionError="",this.finalReading="",this.startReading="0",this.note="",this.replaceError="",this.seq=0}willUpdate(t){t.has("meterId")&&this.meterId&&this.load()}async load(){const t=++this.seq;this.phase="loading",this.log?.meter_id!==this.meterId&&(this.log=null);try{const e=await Ae(this.meterId);if(t!==this.seq)return;this.detail=e,this.phase="ready",this.loadSeries(),this.loadLog()}catch(e){if(t!==this.seq)return;this.error=G(e),this.phase="error"}}async loadSeries(){const t=this.range,e=t==="hours"?"1h":"1d",s=t==="hours"?1:t==="days"?30:365,r=new Date,a=new Date(r.getTime()-s*864e5);try{let l=await Bs(this.meterId,e,a.toISOString(),r.toISOString());if(t==="months"&&(l=$i(l)),t!==this.range)return;this.points=l,this.chartError=!1}catch{this.chartError=!0}}async loadLog(){const t=this.meterId;try{const e=await Wa(t);if(t!==this.meterId)return;this.log=e,this.logError=""}catch(e){t===this.meterId&&(this.logError=G(e))}}openReadingsDialog(t){this.dlgDetail=t.detail,this.dlg=t.detail.kind}async onReadingsSaved(t){this.log=t.detail,this.fire("changed"),await this.refresh(),this.loadSeries()}label(t){const e=new Date(t.t);return this.range==="hours"?gs(t.t).slice(0,2):this.range==="months"?`${e.getMonth()+1}/${String(e.getFullYear()).slice(2)}`:String(e.getDate())}fire(t){this.dispatchEvent(new CustomEvent(t,{bubbles:!0,composed:!0}))}async toggleStatus(){const t=this.detail;if(!(!t||this.busy)){this.busy=!0,this.actionError="";try{await(t.status==="paused"?qs(t):Fs(t)),this.fire("changed"),await this.load()}catch(e){this.actionError=G(e)}finally{this.busy=!1}}}async confirmRemove(){const t=this.detail;if(!(!t||this.busy)){this.busy=!0,this.actionError="";try{await Vs(t),this.dlg="",this.fire("changed"),this.fire("close")}catch(e){this.actionError=G(e)}finally{this.busy=!1}}}openRename(){const t=this.detail;t&&(this.newName=t.name,this.nameError="",this.otherNames=[],this.dlg="rename",this.updateComplete.then(()=>window.setTimeout(()=>{const e=this.renderRoot.querySelector("[data-rename-input]");e?.focus(),e?.select()},80)),ze().then(e=>this.otherNames=e.filter(s=>s.id!==t.id).map(s=>s.name)).catch(()=>{}))}async rename(){const t=this.detail;if(!t||this.busy)return;const e=re(this.newName,this.otherNames);if(e.name&&e.name.toLocaleLowerCase()===t.name.trim().toLocaleLowerCase()&&e.name===t.name)return void(this.dlg="");if(e.error)return void(this.nameError=e.error);this.busy=!0,this.nameError="";try{await Ks(t,e.name),this.dlg="",this.fire("changed"),await this.refresh()}catch(s){s instanceof Gt&&s.code==="revision_conflict"?(this.nameError="מישהו אחר שינה את המונה בינתיים. הנתונים רועננו, בדקו את השם ושמרו שוב.",await this.refresh()):this.nameError=G(s)}finally{this.busy=!1}}async refresh(){try{this.detail=await Ae(this.meterId)}catch{}}openReplace(){this.finalReading=this.detail?.reading_kwh!=null?String(this.detail.reading_kwh):"",this.startReading="0",this.note="",this.replaceError="",this.dlg="replace"}async replace(){const t=this.detail,e=Number(this.finalReading),s=Number(this.startReading);if(!(!t||this.busy)){if(this.finalReading.trim()===""||!Number.isFinite(e)||e<0)return void(this.replaceError="צריך להזין קריאה סופית תקינה");if(this.startReading.trim()===""||!Number.isFinite(s)||s<0)return void(this.replaceError="צריך להזין קריאת התחלה תקינה");this.busy=!0,this.replaceError="";try{this.detail=await Us(t,{final_reading_kwh:e,start_reading_kwh:s,note:this.note.trim()||void 0}),this.dlg="",this.fire("changed")}catch(r){this.replaceError=G(r)}finally{this.busy=!1}}}renderBody(t){const e=this.points.map(s=>({label:this.label(s),value:s.kwh}));return i`<div class="body" data-meter-card=${t.id}>
      <div class="row"><span class="chip ${Ss[t.status]}" data-meter-status=${t.status}>${Es[t.status]}</span></div>
      <dl class="kv">
        <dt>אזור</dt><dd>${t.area_name??"-"}${t.floor_name?` · ${t.floor_name}`:""}</dd>
        <dt>קריאה נוכחית</dt><dd><span class="num">${nt(t.reading_kwh)}</span> <span class="mut">קוט״ש</span></dd>
        <dt>דיווח אחרון</dt><dd><span class="num">${oe(t.last_report_at)}</span></dd>
        <dt>יחידה</dt><dd>קוט״ש · מונה מצטבר</dd>
        <dt>בחשבונות</dt><dd>${t.accounts.length?t.accounts.join(", "):i`<span class="mut">-</span>`}</dd>
      </dl>
      <div class="row"><h3>צריכה</h3><span class="sp"></span>
        <div class="seg" role="group" aria-label="טווח">${["hours","days","months"].map(s=>i`<button type="button" aria-pressed=${this.range===s?"true":"false"} data-range=${s} @click=${()=>{this.range=s,this.loadSeries()}}>${rs[s]}</button>`)}</div></div>
      ${this.chartError?i`<div class="alert err" role="alert">לא ניתן לטעון את גרף הצריכה</div>`:bi(e,`גרף צריכה, ${rs[this.range]}`)}
      <h3>תקופות מונה</h3>
      <div class="list" data-epochs>${t.epochs.map(s=>i`<div class="li"><div class="grow"><div class="t1">${fi[s.reason]??s.reason} · <span class="num">${jt(s.started_at)}</span></div>
        <div class="t2 wrap">קריאת התחלה <span class="num">${nt(s.start_reading_kwh)}</span>${s.ended_at?i` · עד <span class="num">${jt(s.ended_at)}</span>`:""}${s.note?` · ${s.note}`:""}</div></div>${s.ended_at?o:i`<span class="chip acc nodot">פעיל</span>`}</div>`)}</div>
      <elec-meter-readings .log=${this.log} error=${this.logError} ?canManage=${this.canManage} @open-dialog=${s=>this.openReadingsDialog(s)}></elec-meter-readings>
      ${this.actionError?i`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>`:o}
      ${this.canManage?i`<div class="actions">
            <sw-button data-meter-rename @click=${()=>this.openRename()}>שינוי שם</sw-button>
            <sw-button data-meter-replace @click=${()=>this.openReplace()}>החלפת מונה</sw-button>
            <sw-button data-meter-pause ?disabled=${this.busy} @click=${()=>void this.toggleStatus()}>${t.status==="paused"?"חידוש":"השהיה"}</sw-button>
            <span class="sp"></span>
            <sw-button variant="danger" data-meter-remove @click=${()=>{this.actionError="",this.dlg="remove"}}>הסרה</sw-button>
          </div>`:o}
    </div>`}render(){const t=this.detail;return i`
      <!-- a dialog opened from the card sits above the drawer's top layer only while the drawer steps aside -->
      <sw-drawer ?open=${!this.dlg} modal heading=${t?lt(t).primary:""} subheading=${t?lt(t).secondary:""} data-meter-drawer @close=${()=>{this.dlg||this.fire("close")}}>
        ${this.phase==="loading"?i`<sw-state-panel state="loading" compact></sw-state-panel>`:o}
        ${this.phase==="error"?i`<sw-state-panel state="error" compact heading="לא ניתן לטעון את המונה" hint=${this.error} actionLabel="נסה שוב" @action=${()=>void this.load()}></sw-state-panel>`:o}
        ${this.phase==="ready"&&t?this.renderBody(t):o}
      </sw-drawer>
      <sw-dialog ?open=${this.dlg==="remove"} heading="הסרת המונה" data-meter-remove-dialog @close=${()=>this.dlg=""}>
        <div>המונה יוסר מהרשימה. הנתונים שנאספו יישמרו.</div>
        ${this.actionError&&this.dlg==="remove"?i`<div class="alert err" role="alert">${this.actionError}</div>`:o}
        <sw-button slot="footer" variant="danger" data-meter-remove-confirm ?disabled=${this.busy} @click=${()=>void this.confirmRemove()}>הסרה</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>ביטול</sw-button>
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="rename"} heading="שינוי שם המונה" data-meter-rename-dialog @close=${()=>this.dlg=""}>
        ${(()=>{const e=re(this.newName,this.otherNames);return e.name===this.detail?.name&&(e.duplicate=!1),i`<div class="fld">
            <label for="rn">שם המונה</label>
            <div class="inp ${this.nameError?"err":""}"><input id="rn" data-rename-input autocomplete="off" aria-invalid=${this.nameError?"true":"false"} aria-describedby="rn-msg" .value=${this.newName}
              @input=${r=>{this.newName=r.target.value,this.nameError=""}}
              @keydown=${r=>{r.key==="Enter"&&(r.preventDefault(),this.rename())}} /></div>
            <div id="rn-msg">
              ${this.nameError?i`<div class="msg" role="alert" data-rename-error>${this.nameError}</div>`:o}
              ${!this.nameError&&e.duplicate?i`<div class="msg" role="alert" data-rename-dup>${_s}</div>`:o}
              <div class="mut" data-rename-hint>${Na}</div>
            </div>
          </div>`})()}
        <sw-button slot="footer" variant="primary" data-rename-save ?disabled=${this.busy||re(this.newName,this.otherNames).duplicate&&this.newName.trim()!==this.detail?.name} @click=${()=>void this.rename()}>שמירה</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>ביטול</sw-button>
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="replace"} heading="החלפת מונה" data-meter-replace-dialog @close=${()=>this.dlg=""}>
        <div class="form">
          <div class="fld"><label for="fr">קריאה סופית של המונה הישן</label><div class="inp ${this.replaceError&&!this.finalReading?"err":""}"><input id="fr" data-replace-final inputmode="decimal" .value=${this.finalReading} @input=${e=>this.finalReading=e.target.value} /><span class="mut">קוט״ש</span></div></div>
          <div class="fld"><label for="sr">קריאת התחלה של המונה החדש</label><div class="inp"><input id="sr" data-replace-start inputmode="decimal" .value=${this.startReading} @input=${e=>this.startReading=e.target.value} /><span class="mut">קוט״ש</span></div></div>
          <div class="fld wide"><label for="nt">הערה (לא חובה)</label><div class="inp"><input id="nt" data-replace-note .value=${this.note} @input=${e=>this.note=e.target.value} /></div></div>
          ${this.replaceError?i`<div class="alert err wide" role="alert" data-replace-error>${this.replaceError}</div>`:o}
        </div>
        <sw-button slot="footer" variant="primary" data-replace-save ?disabled=${this.busy} @click=${()=>void this.replace()}>החלפה</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>ביטול</sw-button>
      </sw-dialog>
      ${this.dlg==="reading"||this.dlg==="calibrate"||this.dlg==="undo-reading"||this.dlg==="undo-calibration"?i`<elec-reading-dialogs .meterId=${this.meterId} .log=${this.log} .kind=${this.dlg} .targetId=${this.dlgDetail?.id??""} .presetFactor=${this.dlgDetail?.factor??""}
            .presetAnchor=${this.dlgDetail?.anchor??""} @close=${()=>{this.dlg="",this.dlgDetail=null}} @saved=${e=>void this.onReadingsSaved(e)}></elec-reading-dialogs>`:o}`}};I.styles=[gt,ht`
      :host {
        display: contents;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 4px 0 8px;
      }
      dl.kv {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 6px 14px;
        margin: 0;
        font-size: var(--sw-fs-sm);
      }
      dl.kv dt {
        color: var(--sw-text-3);
      }
      dl.kv dd {
        margin: 0;
        min-inline-size: 0;
        overflow-wrap: anywhere;
      }
      h3 {
        margin: 0;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
      }
      svg.chart {
        inline-size: 100%;
        block-size: auto;
        display: block;
      }
      svg.chart .grid {
        stroke: var(--sw-border-strong);
      }
      svg.chart .bar {
        fill: color-mix(in srgb, var(--sw-accent) 38%, var(--sw-surface-3));
      }
      svg.chart .bar.hi {
        fill: var(--sw-accent);
      }
      svg.chart text {
        fill: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
      }
      svg.chart text.val {
        fill: var(--sw-text-2);
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .form .wide {
        grid-column: 1 / -1;
      }
      @media (max-width: 520px) {
        .form {
          grid-template-columns: 1fr;
        }
      }
    `];M([$()],I.prototype,"meterId",2);M([$({type:Boolean})],I.prototype,"canManage",2);M([d()],I.prototype,"detail",2);M([d()],I.prototype,"phase",2);M([d()],I.prototype,"error",2);M([d()],I.prototype,"range",2);M([d()],I.prototype,"points",2);M([d()],I.prototype,"chartError",2);M([d()],I.prototype,"dlg",2);M([d()],I.prototype,"log",2);M([d()],I.prototype,"logError",2);M([d()],I.prototype,"dlgDetail",2);M([d()],I.prototype,"newName",2);M([d()],I.prototype,"otherNames",2);M([d()],I.prototype,"nameError",2);M([d()],I.prototype,"busy",2);M([d()],I.prototype,"actionError",2);M([d()],I.prototype,"finalReading",2);M([d()],I.prototype,"startReading",2);M([d()],I.prototype,"note",2);M([d()],I.prototype,"replaceError",2);I=M([T("elec-meter-card")],I);function $i(t){const e=new Map;for(const s of t){const r=new Date(s.t),a=`${r.getFullYear()}-${String(r.getMonth()+1).padStart(2,"0")}-01T00:00:00Z`;e.set(a,(e.get(a)??0)+s.kwh)}return[...e.entries()].map(([s,r])=>({t:s,kwh:Math.round(r*100)/100}))}var gi=Object.defineProperty,yi=Object.getOwnPropertyDescriptor,F=(t,e,s,r)=>{for(var a=r>1?void 0:r?yi(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&gi(e,s,a),a};const ns="sw.elec.meters.view",ls="sw.elec.meters.collapsed",wi=6e4;function os(t,e){try{const s=localStorage.getItem(t);return s?JSON.parse(s):e}catch{return e}}function ds(t,e){try{localStorage.setItem(t,JSON.stringify(e))}catch{}}let L=class extends ft{constructor(){super(...arguments),this.bubbleSkin=new St(this),this.segments=[],this.params=new URLSearchParams,this.meters=[],this.phase="loading",this.error="",this.q="",this.view=os(ns,"table"),this.collapsed=os(ls,[]),this.access=R(),this.picked=[],this.pickedNames={},this.nameTouched=!1,this.adding=!1,this.addErrors=[],this.notice="",this.poll=0,this.noticeTimer=0}connectedCallback(){super.connectedCallback(),this.stopAccess=ms(t=>this.access=t),this.load(!0),this.poll=window.setInterval(()=>void this.load(!1),wi)}disconnectedCallback(){this.stopAccess?.(),window.clearInterval(this.poll),window.clearTimeout(this.noticeTimer),super.disconnectedCallback()}async load(t){t&&(this.phase="loading");try{this.meters=await ze(),this.phase="ready",this.error=""}catch(e){(t||this.phase!=="ready")&&(this.error=G(e),this.phase="error")}}get areaFilter(){return this.params.get("area")??""}setParams(t){const e=new URLSearchParams(this.params);for(const[r,a]of Object.entries(t))a?e.set(r,a):e.delete(r);const s={};e.forEach((r,a)=>s[a]=r),ps("/infra/electricity/meters",s)}setView(t){this.view=t,ds(ns,t)}toggleFloor(t){this.collapsed=this.collapsed.includes(t)?this.collapsed.filter(e=>e!==t):[...this.collapsed,t],ds(ls,this.collapsed)}visible(){const t=this.q.trim().toLowerCase(),e=this.areaFilter;return this.meters.filter(s=>(!e||s.area_id===e)&&(!t||ws(s).includes(t)||(s.area_name??"").toLowerCase().includes(t)))}flash(t){this.notice=t,window.clearTimeout(this.noticeTimer),this.noticeTimer=window.setTimeout(()=>this.notice="",6e3)}openAdd(){this.picked=[],this.pickedNames={},this.nameTouched=!1,this.addErrors=[],this.setParams({add:"1",meter:null})}closeAdd(){this.setParams({add:null})}onPick(t){this.picked=t.detail.selected;const e={};for(const s of this.picked)e[s]=this.pickedNames[s]??t.detail.names?.[s]??"";this.pickedNames=e}nameChecks(){return this.picked.map(t=>{const e=[...this.meters.map(s=>s.name),...this.picked.filter(s=>s!==t).map(s=>this.pickedNames[s]??"")];return{id:t,...re(this.pickedNames[t]??"",e)}})}async confirmAdd(){if(!this.picked.length||this.adding)return;this.nameTouched=!0;const t=this.nameChecks();if(t.some(s=>s.error))return;this.adding=!0,this.addErrors=[];const e=await Ws(t.map(s=>({entity_id:s.id,name:s.name})));this.adding=!1,e.added.length&&(await this.load(!1),this.flash(e.added.length===1?"המונה נוסף":`${e.added.length} מונים נוספו`)),e.failed.length?(this.addErrors=e.failed.map(s=>s.message),this.picked=e.failed.map(s=>s.entity_id)):(this.picked=[],this.closeAdd())}statusChip(t){return i`<span class="chip ${Ss[t.status]}" data-status=${t.status}>${Es[t.status]}</span>`}staleNote(t){return t.status==="stale"&&t.last_report_at?i` <span class="mut">מ-<span class="num">${gs(t.last_report_at)}</span></span>`:o}open(t){this.setParams({meter:t.id})}onKey(t,e){(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.open(e))}renderTiles(){const t=Hs(this.meters);return i`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">היום</div><div class="v"><span class="num">${He(t.today_kwh)}</span><span class="u">קוט״ש</span></div></div>
      <div class="tile"><div class="k">מתחילת החודש</div><div class="v"><span class="num" data-month>${this.meters.some(e=>e.month_kwh!=null)?He(t.month_kwh):"-"}</span><span class="u">קוט״ש</span></div></div>
      <div class="tile"><div class="k">מדווחים</div><div class="v"><span class="num" data-count="reporting">${t.reporting}</span><span class="u">מתוך ${t.total}</span></div></div>
      <div class="tile" ?data-warn=${t.stale>0}><div class="k">לא מדווחים</div><div class="v" style=${t.stale?"color:var(--sw-warning-text)":""}><span class="num" data-count="stale">${t.stale}</span></div></div>
    </div>`}renderTree(){const t=Be(this.meters),e=this.areaFilter;return i`<nav class="tree" aria-label="אזורים" data-area-tree>
      <button type="button" aria-current=${e?"false":"true"} data-area="" @click=${()=>this.setParams({area:null})}>כל האזורים <span class="cnt num">${this.meters.length}</span></button>
      ${t.map(s=>{const r=this.collapsed.includes(s.floor_id);return i`<button type="button" class="fl" aria-expanded=${r?"false":"true"} data-floor=${s.floor_id} @click=${()=>this.toggleFloor(s.floor_id)}>
            <sw-icon name=${r?"chevronBack":"chevronDown"} size="14"></sw-icon>${s.name}<span class="cnt num">${s.count}</span></button>
          ${r?o:s.areas.map(a=>i`<button type="button" class="ar" aria-current=${e===a.area_id?"true":"false"} data-area=${a.area_id} @click=${()=>this.setParams({area:a.area_id})}>${a.name}<span class="cnt num">${a.count}</span></button>`)}`})}
    </nav>`}entityLine(t,e){const s=lt(t).secondary;return s?i`<div class="${e} ent" data-meter-entity title="שם הישות">${s}</div>`:o}nameOf(t){return i`${lt(t).primary}${this.entityLine(t,"mut")}`}renderTable(t){const e=t.some(s=>s.accounts_count!=null);return i`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>שם</th><th>אזור</th><th class="n">קריאה נוכחית (קוט״ש)</th><th class="n">היום</th><th class="n">מתחילת החודש</th><th>מצב</th>${e?i`<th class="dsk">בחשבונות</th>`:o}</tr></thead>
      <tbody>${t.map(s=>i`<tr class="pick" tabindex="0" data-meter=${s.id} @click=${()=>this.open(s)} @keydown=${r=>this.onKey(r,s)}>
        <td class="b">${this.nameOf(s)}</td><td>${s.area_name??"-"}<span class="mut dsk"> · ${s.floor_name??""}</span></td>
        <td class="n"><span class="num">${nt(s.reading_kwh)}</span></td><td class="n"><span class="num">${nt(s.today_kwh)}</span></td><td class="n"><span class="num">${nt(s.month_kwh)}</span></td>
        <td>${this.statusChip(s)}${this.staleNote(s)}</td>${e?i`<td class="dsk">${s.accounts_count||i`<span class="mut">-</span>`}</td>`:o}</tr>`)}</tbody></table></div>`}renderCards(t){return i`<div class="cards desk-only" data-meters-cards>${t.map(e=>i`<div class="card mcard" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.open(e)} @keydown=${s=>this.onKey(s,e)}>
      <div class="row"><b>${lt(e).primary}</b><span class="sp"></span>${this.statusChip(e)}</div>
      ${this.entityLine(e,"mut")}
      <div class="mut">${e.area_name??""}${e.floor_name?` · ${e.floor_name}`:""}</div>
      <div class="row" style="align-items:baseline"><span class="big num">${nt(e.today_kwh)}</span><span class="mut">קוט״ש היום</span><span class="sp"></span><span class="mut num">${nt(e.reading_kwh)}</span></div></div>`)}</div>`}renderRows(t){return i`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${t.map(e=>i`<div class="li pick" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.open(e)} @keydown=${s=>this.onKey(s,e)}>
      <div class="grow"><div class="t1">${lt(e).primary}</div>${this.entityLine(e,"t2")}<div class="t2">${e.area_name??""} · היום <span class="num">${nt(e.today_kwh)}</span> קוט״ש</div></div>
      <div style="text-align:end">${this.statusChip(e)}<div class="t2 num" style="margin-block-start:4px">${nt(e.reading_kwh)}</div></div></div>`)}</div>`}renderNames(){return i`<div class="names" data-add-names>
      ${this.nameChecks().map((t,e)=>{const s=t.error&&(this.nameTouched||t.duplicate);return i`<div class="fld">
          <label for="mn${e}">${this.picked.length>1?`שם המונה ${e+1}`:"שם המונה"}</label>
          <div class="inp ${s?"err":""}"><input id="mn${e}" data-add-name=${t.id} autocomplete="off" aria-invalid=${s?"true":"false"} .value=${this.pickedNames[t.id]??""}
            @input=${r=>this.pickedNames={...this.pickedNames,[t.id]:r.target.value}} /></div>
          ${s?i`<div class="msg" role="alert" data-add-name-error>${t.error}</div>`:o}
        </div>`})}
    </div>`}renderAdd(){const t=this.params.get("add")==="1"&&this.access.manage;return i`<sw-dialog ?open=${t} wide heading="הוספת מונה" data-add-dialog @close=${()=>this.closeAdd()}>
      ${t?i`<elec-meter-picker mode="register" multi .selected=${this.picked} @change=${e=>this.onPick(e)}></elec-meter-picker>`:o}
      ${t&&this.picked.length?this.renderNames():o}
      ${this.addErrors.length?i`<div class="errs" data-add-errors>${this.addErrors.map(e=>i`<div class="alert err" role="alert">${e}</div>`)}</div>`:o}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked.length||this.adding||this.nameChecks().some(e=>e.duplicate)} @click=${()=>void this.confirmAdd()}>הוספה${this.picked.length>1?` (${this.picked.length})`:""}</sw-button>
      <sw-button slot="footer" data-add-cancel @click=${()=>this.closeAdd()}>ביטול</sw-button>
    </sw-dialog>`}renderHead(){const t=Be(this.meters);return i`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-meters-search placeholder="חיפוש מונה" aria-label="חיפוש מונה" .value=${this.q} @input=${e=>this.q=e.target.value} /></label>
      <div class="seg desk-only" role="group" aria-label="תצוגה"><button type="button" aria-pressed=${this.view==="cards"?"true":"false"} data-view="cards" @click=${()=>this.setView("cards")}>כרטיסים</button><button type="button" aria-pressed=${this.view==="table"?"true":"false"} data-view="table" @click=${()=>this.setView("table")}>טבלה</button></div>
      <span class="sp"></span>
      <label class="inp phone-only"><select data-area-select aria-label="אזור" @change=${e=>this.setParams({area:e.target.value||null})}>
        <option value="" ?selected=${!this.areaFilter}>כל האזורים</option>
        ${t.flatMap(e=>e.areas.map(s=>i`<option value=${s.area_id} ?selected=${s.area_id===this.areaFilter}>${s.name}</option>`))}</select></label>
      ${this.access.manage?i`<sw-button variant="primary" icon="plus" data-add-meter @click=${()=>this.openAdd()}>הוספת מונה</sw-button>`:o}
    </div>`}render(){if(!this.access.view)return i`<sw-state-panel state="forbidden" data-elec="meters" data-state="forbidden"></sw-state-panel>`;const t=this.params.get("meter")??"",e=t?i`<elec-meter-card .meterId=${t} ?canManage=${this.access.manage} @close=${()=>this.setParams({meter:null})} @changed=${()=>void this.load(!1)}></elec-meter-card>`:o;if(this.phase==="loading")return i`<div data-elec="meters" data-state="loading" aria-busy="true"><div class="card">${Array.from({length:7},()=>i`<div class="row" style="padding:10px 0"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;if(this.phase==="error")return i`<div data-elec="meters" data-state="error"><sw-state-panel state="error" heading="לא ניתן לטעון את המונים" hint=${this.error} actionLabel="נסה שוב" @action=${()=>void this.load(!0)}></sw-state-panel></div>`;if(!this.meters.length)return i`<div data-elec="meters" data-state="empty"><sw-state-panel icon="bolt" state="empty" heading="אין מונים עדיין">${this.access.manage?i`<sw-button variant="primary" icon="plus" data-add-meter @click=${()=>this.openAdd()}>הוספת מונה</sw-button>`:o}</sw-state-panel>${this.renderAdd()}</div>`;const s=this.visible(),r=s.length?i`${this.view==="cards"?this.renderCards(s):this.renderTable(s)}${this.renderRows(s)}`:i`<sw-state-panel icon="bolt" state="empty" compact heading="לא נמצאו מונים" data-no-results></sw-state-panel>`;return i`<div data-elec="meters" data-state="ready" style="display:flex;flex-direction:column;gap:14px">
      ${this.renderHead()}
      ${this.notice?i`<div class="notice" role="status" data-notice>${this.notice}</div>`:o}
      ${this.renderTiles()}
      <div class="cols"><div class="card tree-card">${this.renderTree()}</div><div class="mlist">${r}</div></div>
      ${this.renderAdd()}${e}
    </div>`}};L.styles=[gt,ht`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-inline-size: 0;
      }
      .head .inp {
        flex: 0 1 280px;
      }
      .cols {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 14px;
        align-items: start;
      }
      .tree {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tree button {
        display: flex;
        align-items: center;
        gap: 8px;
        inline-size: 100%;
        min-block-size: var(--elec-touch);
        padding: 0 10px;
        border: 0;
        background: transparent;
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        border-radius: var(--sw-r-sm);
        cursor: pointer;
        text-align: start;
        transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      @media (hover: hover) and (pointer: fine) {
        .tree button:hover {
          background: var(--sw-surface-2);
        }
      }
      .tree button:active {
        transform: scale(var(--sw-press-scale));
        background: var(--sw-surface-3);
      }
      /* R5-MEDIA-ENERGY-297: the chosen area is a filled accent field (status as a field), its count on it */
      .tree button[aria-current='true'] {
        background: var(--sw-accent);
        color: var(--sw-text-inverse);
        font-weight: var(--sw-fw-bold);
        box-shadow: var(--sw-shadow-primary);
      }
      .tree button[aria-current='true'] .cnt {
        color: var(--sw-text-inverse);
        opacity: 0.85;
      }
      .tree .fl {
        color: var(--sw-text-2);
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-xs);
      }
      .tree .ar {
        padding-inline-start: 30px;
      }
      .tree .cnt {
        margin-inline-start: auto;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
      }
      .tree sw-icon {
        flex: none;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 12px;
      }
      .ent {
        font-weight: 400;
        font-size: var(--sw-fs-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-inline-size: 100%;
      }
      td .ent {
        max-inline-size: 320px;
      }
      .mcard {
        display: flex;
        flex-direction: column;
        gap: 6px;
        text-align: start;
        font: inherit;
        color: inherit;
        cursor: pointer;
        min-block-size: var(--elec-touch);
      }
      /* R5-MEDIA-ENERGY-297: the reading is the card's display numeral; the card answers the press */
      .mcard .big {
        font-size: var(--sw-fs-4xl);
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.05;
        font-variant-numeric: tabular-nums;
        color: var(--sw-heading, var(--sw-text));
      }
      .mcard {
        transition: transform var(--sw-t-press) var(--sw-ease-out), box-shadow var(--sw-t-fast) var(--sw-ease);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .mcard:active {
        transform: scale(var(--sw-press-scale));
        box-shadow: var(--sw-shadow-1);
      }
      .phone-only {
        display: none;
      }
      .notice {
        font-size: var(--sw-fs-sm);
        color: var(--sw-success-text, var(--sw-live-text));
      }
      .errs {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-block-start: 8px;
      }
      @media (max-width: 899px) {
        .cols {
          grid-template-columns: minmax(0, 1fr);
        }
        .tree-card {
          display: none;
        }
        .phone-only {
          display: flex;
        }
        .head .inp {
          flex: 1 1 200px;
        }
        /* the phone's area select fills the row beside the add button (one tidy row instead of a short select and a shorter button) */
        .head .inp.phone-only {
          flex: 1 1 160px;
        }
        .desk-only {
          display: none;
        }
      }
      @media (max-width: 1099px) {
        .dsk {
          display: none;
        }
      }
      /* NOSCROLL-297 (owner rule: a control screen fits the viewport on a desktop): the tree and the meters list take the height left
         under the head and the tiles; the table (its header row stays in place), the cards and the tree each scroll inside their own
         box, never the page. Below 240 px of room the row keeps that height and the page scrolls (a very short window). */
      @media (min-width: 900px) {
        [data-elec='meters'][data-state='ready'] {
          flex: 1 1 auto;
          min-block-size: 0;
        }
        .cols {
          flex: 1 1 auto;
          min-block-size: 240px;
          grid-template-rows: minmax(0, 1fr);
        }
        .cols > .tree-card {
          max-block-size: 100%;
          box-sizing: border-box;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .cols > .mlist {
          display: flex;
          flex-direction: column;
          max-block-size: 100%;
          min-block-size: 0;
          min-inline-size: 0;
        }
        .mlist > .scrollx,
        .mlist > .cards {
          min-block-size: 0;
          overflow: auto;
          scrollbar-width: thin;
        }
        /* GATEFIX2240-297: in a box of fixed height the grid shared that height out among its rows (the cards are overflow-clipped, so
           their automatic minimum is 0): at 1024 px the meter cards were squeezed and their reading row spilled below the card, at 1440 px
           they were stretched. Rows keep their content height and start at the top; the box scrolls. */
        .mlist > .cards {
          padding: 2px;
          grid-auto-rows: max-content;
          align-content: start;
        }
        .mlist table.t thead th {
          position: sticky;
          inset-block-start: 0;
          z-index: 1;
        }
      }
      /* R5 fix: the R5 type (bolder chips and names) made the meters table 8 px wider than its card at 1024 px (classic); the cells
         give 2 px of inline padding a side back so the table fits its card again */
      table.t[data-meters-table] th,
      table.t[data-meters-table] td {
        padding-inline: 10px;
      }
    `,us];F([$({attribute:!1})],L.prototype,"segments",2);F([$({attribute:!1})],L.prototype,"params",2);F([d()],L.prototype,"meters",2);F([d()],L.prototype,"phase",2);F([d()],L.prototype,"error",2);F([d()],L.prototype,"q",2);F([d()],L.prototype,"view",2);F([d()],L.prototype,"collapsed",2);F([d()],L.prototype,"access",2);F([d()],L.prototype,"picked",2);F([d()],L.prototype,"pickedNames",2);F([d()],L.prototype,"nameTouched",2);F([d()],L.prototype,"adding",2);F([d()],L.prototype,"addErrors",2);F([d()],L.prototype,"notice",2);L=F([T("elec-meters-page")],L);var _i=Object.defineProperty,ki=Object.getOwnPropertyDescriptor,yt=(t,e,s,r)=>{for(var a=r>1?void 0:r?ki(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&_i(e,s,a),a};const cs=[{id:"holiday",label:"חג (כמו שבת)"},{id:"holiday_eve",label:"ערב חג (כמו שישי)"},{id:"regular",label:"יום רגיל"}],hs=t=>$s[bs[new Date(`${t}T12:00:00Z`).getUTCDay()]];let vt=class extends Q{constructor(){super(...arguments),this.st="loading",this.year=Number(et().slice(0,4)),this.data=null,this.busy=!1,this.error="",this.note="",this.add={date:"",kind:"holiday",name:""},this.addErr=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{this.data=await f().getCalendar(this.year),this.st="ready"}catch(t){this.error=C(t),this.st=/הרשאה/.test(this.error)?"forbidden":"error"}}setYear(t){this.year=t,this.note="",this.load()}async run(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await t();this.data=e.year===this.year?e:await f().getCalendar(this.year);const s=e.drafts_to_recalculate??0;this.note=s?`${s===1?"טיוטה אחת מושפעת":`${s} טיוטות מושפעות`} מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".`:""}catch(e){this.error=C(e)}finally{this.busy=!1}}}setKind(t,e){if(!this.data)return;const s=this.data.revision;this.run(()=>f().setCalendarDay(t.date,e,t.name_he,s))}restore(t){if(!this.data)return;const e=this.data.revision;this.run(()=>f().removeCalendarDay(t.date,e))}addDay(){const t=this.add;if(this.addErr=K(t.date)?"":"צריך לבחור תאריך",this.addErr||!this.data)return;const e=this.data.revision;this.run(async()=>{const s=await f().setCalendarDay(t.date,t.kind,t.name,e);return this.add={date:"",kind:"holiday",name:""},Number(t.date.slice(0,4))!==this.year&&(this.year=Number(t.date.slice(0,4))),s})}render(){const t=R();if(!t.view&&!t.bills&&!t.manage)return i`<div class="page" data-elec="settings-calendar" data-state="forbidden">${k("forbidden","lock","אין הרשאה")}</div>`;if(this.st==="loading")return i`<div class="page" data-elec="settings-calendar" data-state="loading">${st(5)}</div>`;if(this.st==="forbidden")return i`<div class="page" data-elec="settings-calendar" data-state="forbidden">${k("forbidden","lock","אין הרשאה")}</div>`;if(this.st==="error"||!this.data)return i`<div class="page" data-elec="settings-calendar" data-state="error">${k("error","warning","לא ניתן לטעון את הימים המיוחדים",{label:"נסה שוב",run:()=>void this.load()})}</div>`;const e=this.data,s=t.manage,r=e.days;return i`<div class="page" data-elec="settings-calendar" data-state="ready">
      ${this.error?x("err",this.error):o}
      ${this.note?x("info",this.note):o}
      <div class="card ${this.phone?"":"flush"}">
        <div class="hd"><b class="h3">ימים מיוחדים</b>
          <div class="row" role="group" aria-label="שנה"><button type="button" class="btn ghost sm ic" aria-label="השנה הקודמת" data-year-prev @click=${()=>this.setYear(this.year-1)}>→</button><b class="num" data-year>${this.year}</b><button type="button" class="btn ghost sm ic" aria-label="השנה הבאה" data-year-next @click=${()=>this.setYear(this.year+1)}>←</button></div>
          <span class="sp"></span>
          <div class="seg" role="group" aria-label="מקור החגים"><button type="button" data-generator="israel" aria-pressed=${e.generator==="israel"} ?disabled=${!s||this.busy} @click=${()=>e.generator!=="israel"&&void this.run(()=>f().setCalendarGenerator("israel",e.revision,this.year))}>חגי ישראל מחושבים</button><button type="button" data-generator="none" aria-pressed=${e.generator==="none"} ?disabled=${!s||this.busy} @click=${()=>e.generator!=="none"&&void this.run(()=>f().setCalendarGenerator("none",e.revision,this.year))}>ימים ידניים בלבד</button></div>
        </div>
        ${r.length?this.phone?i`<div class="list" data-calendar>${r.map(a=>i`<div class="li" data-day=${a.date} data-kind=${a.kind} style="flex-wrap:wrap"><div class="grow"><div class="t1">${a.name_he||a.kind_he}</div><div class="t2">${p(E(a.date))} · יום ${hs(a.date)} · ${a.source==="manual"?"ידני":"מחושב"}</div></div>${this.kindCell(a,s)}
                ${s&&a.source==="manual"?i`<button type="button" class="btn ghost sm" data-restore=${a.date} ?disabled=${this.busy} @click=${()=>this.restore(a)}>${a.generated?"החזרה לחישוב":"הסרה"}</button>`:o}</div>`)}</div>`:i`<div class="scrollx"><table class="t" data-calendar><thead><tr><th>תאריך</th><th>יום</th><th>שם</th><th>נחשב</th><th>מקור</th><th></th></tr></thead><tbody>
              ${r.map(a=>i`<tr data-day=${a.date} data-kind=${a.kind}><td class="num" style="text-align:start">${E(a.date)}</td><td>${hs(a.date)}</td><td class="b">${a.name_he||(a.generated?.name_he??"")}</td><td>${this.kindCell(a,s)}</td>
                <td>${a.source==="manual"?i`<span class="chip c-warn nodot">ידני</span>`:i`<span class="chip c-mut nodot">מחושב</span>`}</td>
                <td>${s?a.source==="manual"?i`<button type="button" class="btn ghost sm" data-restore=${a.date} ?disabled=${this.busy} @click=${()=>this.restore(a)}>${a.generated?"החזרה לחישוב":"הסרה"}</button>`:o:o}</td></tr>`)}</tbody></table></div>`:i`<div class="mut" style="padding:0 16px 16px" data-calendar-empty>אין ימים מיוחדים בשנה הזו.</div>`}
      </div>
      ${s?i`<div class="card" data-calendar-add><div class="hd"><b class="h3">הוספת יום</b></div>
        <div class="form">
          <div class="fld"><label for="cd">תאריך</label><input id="cd" type="date" lang=${ot()} class="ltr ${this.addErr?"err":""}" data-add-date .value=${this.add.date} @change=${a=>{this.add={...this.add,date:a.target.value},this.addErr=""}} />${this.addErr?i`<div class="msg" role="alert">${this.addErr}</div>`:o}</div>
          <div class="fld"><label for="ck">נחשב</label><select id="ck" data-add-kind @change=${a=>this.add={...this.add,kind:a.target.value}}>${cs.map(a=>i`<option value=${a.id} .selected=${a.id===this.add.kind}>${a.label}</option>`)}</select></div>
          <div class="fld wide"><label for="cn">שם (לא חובה)</label><input id="cn" data-add-name maxlength="60" .value=${this.add.name} @input=${a=>this.add={...this.add,name:a.target.value}} /></div>
        </div>
        <div class="row" style="margin-block-start:12px"><button type="button" class="btn pri" data-add-day ?disabled=${this.busy} @click=${()=>this.addDay()}>הוספה</button></div></div>`:o}
      <div class="mut">${e.note_he}</div>
    </div>`}kindCell(t,e){return e?i`<select aria-label=${`סוג היום ${E(t.date)}`} data-kind-select=${t.date} ?disabled=${this.busy} @change=${s=>this.setKind(t,s.target.value)}>${cs.map(s=>i`<option value=${s.id} .selected=${s.id===t.kind}>${s.label}</option>`)}</select>`:i`<span>${t.kind_he}</span>`}};yt([d()],vt.prototype,"st",2);yt([d()],vt.prototype,"year",2);yt([d()],vt.prototype,"data",2);yt([d()],vt.prototype,"busy",2);yt([d()],vt.prototype,"error",2);yt([d()],vt.prototype,"note",2);yt([d()],vt.prototype,"add",2);yt([d()],vt.prototype,"addErr",2);vt=yt([T("elec-settings-calendar")],vt);var xi=Object.defineProperty,Ei=Object.getOwnPropertyDescriptor,wt=(t,e,s,r)=>{for(var a=r>1?void 0:r?Ei(e,s):e,l=t.length-1,n;l>=0;l--)(n=t[l])&&(a=(r?n(e,s,a):n(a))||a);return r&&a&&xi(e,s,a),a};const Mt=[{key:"raw_retention_days",label:"קריאות גולמיות",usage:"raw_bytes",owner:"system"},{key:"interval_retention_months",label:"נתוני רבע שעה",usage:"interval_bytes",owner:"system"},{key:"bill_retention_years",label:"חיובים וקבצי PDF",usage:"bill_bytes",owner:"system"},{key:"draft_retention_days",label:"טיוטות שלא הונפקו",usage:"draft_bytes",owner:"manage"}];let ct=class extends ft{constructor(){super(...arguments),this.bubbleSkin=new St(this),this.data=null,this.phase="loading",this.error="",this.values={},this.saving=!1,this.saveError="",this.saved=!1,this.access=R()}connectedCallback(){super.connectedCallback(),this.stop=ms(t=>this.access=t),this.load()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}async load(){this.phase="loading";try{const t=await Ys();this.data=t,this.values=Object.fromEntries(Mt.map(e=>[e.key,String(t[e.key])])),this.phase="ready"}catch(t){this.error=G(t),this.phase="error"}}editable(t){return!!this.data?.editable[t.key]}problem(t){const e=(this.values[t.key]??"").trim(),s=this.data?.ranges[t.key]??qe[t.key],r=Number(e);return e===""||!Number.isInteger(r)||r<s.min||r>s.max?`הערך חייב להיות בין ${s.min} ל-${s.max}`:""}changed(){const t={};if(!this.data)return t;for(const e of Mt){const s=Number(this.values[e.key]);this.editable(e)&&!this.problem(e)&&s!==this.data[e.key]&&(t[e.key]=s)}return t}async save(){const t=this.changed();if(!(!Object.keys(t).length||this.saving)){this.saving=!0,this.saveError="",this.saved=!1;try{this.data=await Gs(t),this.values=Object.fromEntries(Mt.map(e=>[e.key,String(this.data[e.key])])),this.saved=!0}catch(e){this.saveError=G(e)}finally{this.saving=!1}}}render(){if(!this.access.system&&!this.access.manage)return i`<sw-state-panel state="forbidden" data-elec="retention" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return i`<div data-elec="retention" data-state="loading" aria-busy="true" class="card">${[0,1,2,3].map(()=>i`<div class="row" style="padding:12px 0"><div class="skl" style="inline-size:36%"></div><span class="sp"></span><div class="skl" style="inline-size:20%"></div></div>`)}</div>`;if(this.phase==="error"||!this.data)return i`<div data-elec="retention" data-state="error"><sw-state-panel state="error" heading="לא ניתן לטעון את ההגדרות" hint=${this.error} actionLabel="נסה שוב" @action=${()=>void this.load()}></sw-state-panel></div>`;const t=this.data,e=Mt.reduce((a,l)=>a+(t.usage[l.usage]??0),0),s=Object.keys(this.changed()).length>0,r=Mt.some(a=>this.editable(a)&&this.problem(a));return i`<div data-elec="retention" data-state="ready" class="card">
      <div class="list">${Mt.map(a=>{const l={...qe[a.key],...t.ranges[a.key]},n=this.editable(a)?this.problem(a):"",c=Number(this.values[a.key]),v=!n&&c!==t[a.key];return i`<div class="rowx" data-retention=${a.key}>
          <div class="grow"><div class="t1">${a.label}</div>
            <div class="t2">${l.min} עד ${l.max} · בשימוש <span class="num" data-usage>${t.usage[a.usage]==null?"-":we(t.usage[a.usage])}</span>${v&&a.key!=="draft_retention_days"?i` · הערכה לערך החדש <span class="num" data-estimate>${we(Zs(a.key,c,t.meter_count))}</span>`:o}</div></div>
          <div class="fld"><div class="inp ${n?"err":""}"><input inputmode="numeric" data-retention-input=${a.key} aria-label=${a.label} aria-invalid=${n?"true":"false"} ?disabled=${!this.editable(a)} .value=${this.values[a.key]??""}
            @input=${h=>{this.saved=!1,this.values={...this.values,[a.key]:h.target.value}}} /><span class="mut">${l.unit}</span></div>
            ${n?i`<div class="msg" role="alert" data-retention-error=${a.key}>${n}</div>`:o}</div>
        </div>`})}</div>
      ${this.saveError?i`<div class="alert err" role="alert" style="margin-block-start:12px" data-save-error>${this.saveError}</div>`:o}
      <div class="foot"><span class="mut">נתונים בתוך תקופה של טיוטה פתוחה לא נמחקים.</span><span class="mut">סה״כ בשימוש <span class="num">${we(e)}</span></span><span class="sp"></span>
        ${this.saved?i`<span class="ok" role="status" data-saved>נשמר</span>`:o}
        <sw-button variant="primary" data-retention-save ?disabled=${!s||r||this.saving} @click=${()=>void this.save()}>שמירה</sw-button></div>
    </div>`}};ct.styles=[gt,ht`
      :host {
        display: block;
        max-inline-size: 760px;
      }
      .rowx {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 10px 16px;
        padding: 12px 14px;
        /* R5-MEDIA-ENERGY-297: an option row is a well (a tone step, no outlined box inside the card) */
        background: var(--sw-surface-2);
        border: 1px solid transparent;
        border-radius: var(--sw-r-md);
      }
      .rowx .grow {
        flex: 1 1 200px;
        min-inline-size: 0;
      }
      .rowx .fld {
        flex: 0 0 170px;
      }
      .rowx .t1 {
        font-weight: var(--sw-fw-bold);
        font-size: var(--sw-fs-md);
        color: var(--sw-heading);
      }
      .rowx .t2 {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      .foot {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-block-start: 14px;
      }
      .ok {
        color: var(--sw-success-text, var(--sw-live-text));
        font-size: var(--sw-fs-sm);
      }
      /* POLISH4-WP8 (owner Q7): on a phone the save row stays in view while the long list of data kinds scrolls under it (the settings
         kit's .foot.sticky look, styles/settings.ts); an option row's number field takes its own line */
      @media (max-width: 767px) {
        .foot {
          position: sticky;
          inset-block-end: var(--sw-s-2);
          z-index: 3;
          padding: 10px var(--sw-s-2);
          border: 1px solid var(--sw-border-strong);
          border-radius: var(--sw-r-lg);
          background: var(--sw-surface-solid);
          box-shadow: var(--sw-shadow-3);
        }
        .rowx .fld {
          flex: 1 1 100%;
        }
      }
    `,us];wt([d()],ct.prototype,"data",2);wt([d()],ct.prototype,"phase",2);wt([d()],ct.prototype,"error",2);wt([d()],ct.prototype,"values",2);wt([d()],ct.prototype,"saving",2);wt([d()],ct.prototype,"saveError",2);wt([d()],ct.prototype,"saved",2);wt([d()],ct.prototype,"access",2);ct=wt([T("elec-settings-retention")],ct);
//# sourceMappingURL=settings-retention-BxRe-AA4.js.map
