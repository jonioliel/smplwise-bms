import{Y as Rs,j as c,k as T,xe as s,b as n,em as R,A as o,g as st,ax as _,i as Ot,aL as Vt,a as Jt,ek as ct,a5 as nt,Cz as qe,n as dt,mA as Te,CA as we,cx as js,xf as gt,a2 as Ls,bm as re,b5 as Bs,Bl as As,aV as Fs,CB as Vs,mB as qs,CC as Ks,CD as Us,CE as Ws,CF as Hs,CG as Gs,d8 as f,aU as us,eo as $s,CH as Zs,CI as Ys,CJ as Xs,CK as Qs,CL as Ke,CM as Js,CN as ta}from"./index-rXjlW4bK.js";import{E as Y,n as u,o as Xt,p as b,s as E,q as et,r as g,t as _e,u as Pe,v as tt,w as Tt,x as q,y as M,z as he,A as $t,B as C,C as ke,D as S,F as ea,G as sa,H as jt,I as A,J as Ue,K as We,L as ze,N as Ne,O as aa,P as ia,Q as ra,R as lt,S as na,T as la,U as Lt,V as da,W as oa,X as j,Y as ut,Z as Ie,_ as ca,$ as ha,a0 as He,a1 as pa,a2 as ua,a3 as $a,a4 as va,a5 as vs,a6 as ms,a7 as ma,a8 as xe,a9 as fa,c as Ge,d as ba,e as ga,g as Ze,h as ya,i as wa,aa as _a,ab as le,ac as ne,ad as ka,ae as xa,af as Ea,ag as Ye,ah as Xe,ai as fs,aj as bs,ak as De,al as Qe,am as Ca,f as Bt,an as Yt,ao as de,b as pe,m as Sa,M as Oa,a as gs,j as Pa,k as za,l as Na,ap as Je,aq as Ee}from"./meters-page-base-l01UknPw.js";import{e as yt}from"./styles-CJNCG9DU.js";import{b as Qt}from"./day-key-Bn1dxlC5.js";import"./sw-place-tree-CLZutrtt.js";import{FIXTURE_NOW as Ia}from"./fixtures-Db2whdpa.js";const Nt="/infra/electricity",Ma="/system/infra",kt=t=>`#${t}`,I={accounts:()=>`${Nt}/accounts`,accountNew:()=>`${Nt}/accounts/new`,account:(t,e="")=>`${Nt}/accounts/${t}${e?`/${e}`:""}`,bills:()=>`${Nt}/bills`,bill:t=>`${Nt}/bills/${t}`,customers:()=>`${Nt}/customers`,customer:t=>`${Nt}/customers/${t}`,settings:t=>`${Ma}/${t}`},z={accounts:()=>kt(I.accounts()),accountNew:()=>kt(I.accountNew()),account:(t,e="")=>kt(I.account(t,e)),bills:()=>kt(I.bills()),bill:t=>kt(I.bill(t)),customers:()=>kt(I.customers()),customer:t=>kt(I.customer(t)),settings:t=>kt(I.settings(t))},Z=t=>Rs(t);var Ta=Object.defineProperty,Da=Object.getOwnPropertyDescriptor,te=(t,e,a,r)=>{for(var i=r>1?void 0:r?Da(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ta(e,a,i),i};const ts="sw.elec.accounts.view";let At=class extends Y{constructor(){super(...arguments),this.st="loading",this.rows=[],this.q="",this.view="table",this.status=t=>t.stale?n`<span class="chip c-warn">${s("מונה לא מדווח")}</span>`:n`<span class="chip c-ok">${s("תקין")}</span>`,this.last=t=>{const e=t.account.last_bill;return e?n`${e.number?u(e.number):s("טיוטה")} ${Xt(e.state)}`:n`<span class="mut">-</span>`}}connectedCallback(){super.connectedCallback();try{this.view=localStorage.getItem(ts)==="cards"?"cards":"table"}catch{}this.load()}async load(){this.st="loading";try{this.rows=await b().listAccounts(),this.st=this.rows.length?"ready":"empty"}catch{this.st="error"}}setView(t){this.view=t;try{localStorage.setItem(ts,t)}catch{}}render(){const t=R(),e=t.bills;if(!t.view)return n`<div class="page" data-elec="accounts" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לצפות בחשבונות"))}</div>`;const a=this.q.trim(),r=this.rows.filter(l=>!a||l.account.name.includes(a)||l.account.customer.name.includes(a)),i=n`<div class="row">
      <input type="search" data-search aria-label=${s("חיפוש חשבון או לקוח")} placeholder=${s("חיפוש חשבון או לקוח")} .value=${this.q} @input=${l=>this.q=l.target.value} />
      ${this.phone?o:n`<div class="seg" role="group" aria-label=${s("תצוגה")}>
        <button type="button" data-view="cards" aria-pressed=${this.view==="cards"} @click=${()=>this.setView("cards")}>${s("כרטיסים")}</button>
        <button type="button" data-view="table" aria-pressed=${this.view==="table"} @click=${()=>this.setView("table")}>${s("טבלה")}</button></div>`}
      <span class="sp"></span>
      ${t.manage?n`<a class="btn pri ${this.phone?"sm":""}" data-new-account href=${z.accountNew()}>${s("+ חשבון חדש")}</a>`:o}
    </div>`;let d;return this.st==="loading"?d=et(6):this.st==="error"?d=E("error","warning",s("לא ניתן לטעון את החשבונות"),{label:s("נסה שוב"),run:()=>void this.load()}):this.st==="empty"?d=E("empty","bolt",s("אין חשבונות עדיין"),t.manage?{label:s("+ חשבון חדש"),primary:!0,run:()=>Z(I.accountNew())}:void 0):r.length?this.phone?d=n`<div class="list" data-elec-list>${r.map(l=>n`<a class="li" href=${z.account(l.account.id)} data-account-row=${l.account.id}>
        <div class="grow"><div class="t1">${l.account.name}</div><div class="t2">${l.account.customer.name} · ${u(g(l.kwh??0))} ${s("קוט״ש")}${e&&l.amount!==void 0?n` · ${u(_e(l.amount))}`:o}</div></div>${this.status(l)}</a>`)}</div>`:this.view==="cards"?d=n`<div class="grid-cards" data-elec-list>${r.map(l=>n`<div class="card" data-account-row=${l.account.id}>
        <div class="row"><a class="rowlink h3" href=${z.account(l.account.id)}>${l.account.name}</a><span class="sp"></span>${this.status(l)}</div>
        <div class="mut">${l.account.customer.name} · ${Pe(l.account.period_months,l.account.period_anchor_day,l.account.period_anchor_month)}</div>
        <div class="row" style="margin-block-start:10px;align-items:baseline"><span class="big">${u(g(l.kwh??0))}</span><span class="mut">${s("קוט״ש בתקופה")}</span><span class="sp"></span>${e&&l.amount!==void 0?n`<b class="big amt">${u(_e(l.amount))}</b>`:o}</div>
        ${e?n`<div class="mut" style="margin-block-start:6px">${s("חיוב אחרון:")} ${this.last(l)}</div>`:o}</div>`)}</div>`:d=n`<div class="card flush scrollx" data-elec-list><table class="t">
        <thead><tr><th>${s("חשבון")}</th><th>${s("לקוח")}</th><th class="hide-tablet">${s("נוסחה")}</th><th>${s("תקופה")}</th><th class="num">${s("צריכה בתקופה")}</th>${e?n`<th class="num">${s("סכום עד כה")}</th><th>${s("חיוב אחרון")}</th>`:o}<th>${s("מצב")}</th></tr></thead>
        <tbody>${r.map(l=>n`<tr class="go" data-account-row=${l.account.id} @click=${()=>Z(I.account(l.account.id))}>
          <td class="b"><a class="rowlink" href=${z.account(l.account.id)} @click=${h=>h.stopPropagation()}>${l.account.name}</a></td><td>${l.account.customer.name}</td>
          <td class="mut ell hide-tablet">${l.account.formula.sentence_he}</td><td>${Pe(l.account.period_months,l.account.period_anchor_day,l.account.period_anchor_month)}</td>
          <td class="num">${g(l.kwh??0)}</td>${e?n`<td class="num">${l.amount!==void 0?_e(l.amount):""}</td><td>${this.last(l)}</td>`:o}<td>${this.status(l)}</td></tr>`)}</tbody></table></div>`:d=E("empty","search",s("לא נמצאו חשבונות")),n`<div class="page" data-elec="accounts" data-state=${this.st==="ready"&&!r.length?"empty":this.st}>
      ${this.st==="ready"||this.st==="empty"||this.st==="loading"?i:o}
      ${d}
    </div>`}};te([c()],At.prototype,"st",2);te([c()],At.prototype,"rows",2);te([c()],At.prototype,"q",2);te([c()],At.prototype,"view",2);At=te([T("elec-accounts-list")],At);var Ra=Object.defineProperty,ja=Object.getOwnPropertyDescriptor,ft=(t,e,a,r)=>{for(var i=r>1?void 0:r?ja(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ra(e,a,i),i};let at=class extends Ot{constructor(){super(...arguments),this.account=null,this.open=!1,this.choice="last",this.from="",this.to="",this.busy=!1,this.error="",this.errorBill="",this.existing=[],this.skin=new Vt(this)}willUpdate(t){if(t.has("open")&&this.open&&this.account){this.choice="last",this.error="",this.errorBill="";const e=this.periods();this.from=e.last.from,this.to=e.last.to,b().listBills({account_id:this.account.id}).then(a=>this.existing=a.items).catch(()=>this.existing=[])}}periods(){const t=this.account,e=tt(),a=Tt(e,t.period_months,t.period_anchor_day,t.period_anchor_month),r=Qt(a.from,-1);return{last:{from:Tt(r,t.period_months,t.period_anchor_day,t.period_anchor_month).from,to:r},current:{from:a.from,to:e}}}range(){const t=this.periods();return this.choice==="last"?t.last:this.choice==="current"?t.current:{from:this.from,to:this.to}}rangeError(){return this.choice!=="range"?"":!q(this.from)||!q(this.to)?s("צריך לבחור תאריך התחלה ותאריך סיום"):this.to<this.from?s("תאריך הסיום חייב להיות אחרי תאריך ההתחלה"):""}overlap(){const t=this.range();return this.existing.find(e=>e.state!=="void"&&e.state!=="draft"&&!(t.to<e.period.from||t.from>e.period.to))}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async create(){if(!this.account||this.busy)return;this.busy=!0,this.error="",this.errorBill="";const t=this.range(),e=this.choice==="last"?{kind:"last"}:{kind:"range",from:t.from,to:t.to};try{const a=await b().createBill(this.account.id,e);this.close(),Z(I.bill(a.id))}catch(a){this.error=M(a),a instanceof Jt&&(he(a)==="period_overlap"||he(a)==="draft_exists")&&(this.errorBill=String(a.body.details?.bill_id??""))}finally{this.busy=!1}}render(){const t=this.account;if(!t)return o;const e=this.periods(),a=this.overlap(),r=this.rangeError(),i=(d,l,h)=>n`<label class="li ${this.choice===d?"sel":""}"><input type="radio" name="period" data-period=${d} .checked=${this.choice===d} @change=${()=>{this.choice=d,this.error=""}} /><span class="ind"></span>
      <div class="grow"><div class="t1">${l}</div>${h?n`<div class="t2">${h}</div>`:o}</div></label>`;return n`<elec-dialog heading=${s("הפקת חיוב")} ?open=${this.open} data-bill-create @close=${()=>this.close()}>
      <div class="mut">${t.name}</div>
      <div class="list" role="radiogroup" aria-label=${s("תקופה")}>
        ${i("last",s("התקופה האחרונה"),u($t(e.last.from,e.last.to)))}
        ${i("current",s("התקופה הנוכחית עד היום"),u($t(e.current.from,e.current.to)))}
        ${i("range",s("טווח אחר"),o)}
      </div>
      ${this.choice==="range"?n`<div class="form">
            <div class="fld"><label for="bf">${s("מתאריך")}</label><input id="bf" type="date" lang=${ct()} name="from" data-range-from .value=${this.from} @change=${d=>this.from=d.target.value} /></div>
            <div class="fld"><label for="bt">${s("עד תאריך")}</label><input id="bt" type="date" lang=${ct()} name="to" data-range-to .value=${this.to} @change=${d=>this.to=d.target.value} /></div>
          </div>`:o}
      ${r?C("err",r):o}
      ${a?C("err",n`${s("כבר קיים חיוב")} ${u(a.number??"")} ${s("לתקופה הזו. אפשר")} <a class="lnk" href=${z.bill(a.id)}>${s("לתקן אותו")}</a> ${s("במקום ליצור חדש.")}`):o}
      ${this.error&&!a?C("err",n`${this.error}${this.errorBill?n` <a class="lnk" href=${z.bill(this.errorBill)}>${s("לפתיחת החיוב")}</a>`:o}`):o}
      <sw-button variant="primary" slot="actions" data-create ?disabled=${this.busy||!!a||!!r} @click=${()=>void this.create()}>${s("יצירת טיוטה")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
    </elec-dialog>`}};at.styles=[yt,st`:host { display: contents; }`];ft([_({attribute:!1})],at.prototype,"account",2);ft([_({type:Boolean,reflect:!0})],at.prototype,"open",2);ft([c()],at.prototype,"choice",2);ft([c()],at.prototype,"from",2);ft([c()],at.prototype,"to",2);ft([c()],at.prototype,"busy",2);ft([c()],at.prototype,"error",2);ft([c()],at.prototype,"errorBill",2);ft([c()],at.prototype,"existing",2);at=ft([T("elec-bill-create")],at);function ys(t){if(!t)return[];const e=[],a=t.same_period_last_year,r=!!a&&t.previous.some(i=>i.from===a.from&&i.to===a.to&&i.kwh!==null);a&&a.kwh!==null&&!r&&e.push({key:"ly",label:ke(a.to),title:s("אותה תקופה אשתקד, {range}",{range:$t(a.from,a.to)}),kwh:Number(a.kwh),kind:"ly",partial:a.status==="partial"});for(const i of t.previous.slice(-12))e.push({key:`p${i.to}`,label:ke(i.to),title:$t(i.from,i.to),kwh:i.kwh===null?null:Number(i.kwh),kind:"prev",partial:i.status==="partial",lyMark:!!a&&i.from===a.from&&i.to===a.to});return t.current&&e.push({key:"cur",label:ke(t.current.to),title:s("התקופה הנוכחית, {range}",{range:$t(t.current.from,t.current.to)}),kwh:Number(t.current.kwh),kind:"cur",partial:!1}),e}const La=24;function Ba(t,e,a,r,i=4){const d=Math.min(i,a/2,r);return`M${t},${e+r} V${e+d} Q${t},${e} ${t+d},${e} H${t+a-d} Q${t+a},${e} ${t+a},${e+d} V${e+r} Z`}function Aa(t){const e=new Set;let a=null;for(const r of t)r.kwh!==null&&((r.kind==="cur"||r.kind==="ly"||r.lyMark)&&e.add(r.key),(!a||r.kwh>a.kwh)&&(a=r));return a&&e.add(a.key),e}const Re=t=>ys(t).some(e=>e.kind!=="cur"&&e.kwh!==null);var Fa=Object.defineProperty,Va=Object.getOwnPropertyDescriptor,Pt=(t,e,a,r)=>{for(var i=r>1?void 0:r?Va(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Fa(e,a,i),i};let vt=class extends Ot{constructor(){super(...arguments),this.series=null,this.table="sr",this.print=!1,this.height=200,this.w=640,this.showTable=!1,this.hot=null}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(t=>{const e=Math.round(t[0].contentRect.width);e>120&&Math.abs(e-this.w)>2&&(this.w=e)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}render(){const t=ys(this.series);if(!Re(this.series))return o;const e=this.w,a=this.height,r=12,i=18,d=22,l=t.length,h=(e-r*2)/l,m=t.map(w=>w.kwh??0),p=Math.max(...m,1)*1.12,v=Math.min(h*.68,La),$=w=>w/p*(a-i-d),y=a-d,B=w=>e-r-(w+1)*h,bt=w=>B(w)+(h-v)/2,Ss=h<30?2:1,Os=Aa(t),Ps=h>=30,Le=t.find(w=>w.kind==="cur"),se=t.find(w=>w.kind==="ly"||w.lyMark),ve=se&&se.kwh!==null?y-$(se.kwh):null,zs=t.some(w=>w.partial),Ns=s("צריכה לפי תקופה: {list}",{list:t.filter(w=>w.kwh!==null).map(w=>`${w.label} ${g(w.kwh)} ${s("קוט״ש")}`).join(", ")}),me=this.hot===null?-1:t.findIndex(w=>w.key===this.hot),zt=me>=0?t[me]:null;return n`
      <svg viewBox="0 0 ${e} ${a}" role="img" aria-label=${Ns} data-elec-chart @pointerleave=${()=>this.hot=null}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--c-bar2)"></rect><rect width="2.5" height="6" fill="var(--c-bar)" opacity="0.55"></rect></pattern>
        </defs>
        <line class="grid" x1=${r} x2=${e-r} y1=${y} y2=${y}></line>
        ${ve!==null&&Le?nt`<line class="lyline" x1=${r} x2=${e-r} y1=${ve} y2=${ve}></line>`:o}
        ${t.map((w,fe)=>{const be=bt(fe),ae=be+v/2,Is=w.kind==="ly"?s("אשתקד"):w.label,Be=fe%Ss===0||w.kind!=="prev"?nt`<text x=${ae} y=${a-6} text-anchor="middle">${Is}</text>`:o,Ae=this.hot===w.key,Fe=nt`<rect class="hit" x=${B(fe)} y=${i-10} width=${h} height=${a-i+10-d+4}></rect>`,ie=()=>this.hot=w.key,Ve=()=>{this.hot===w.key&&(this.hot=null)};if(w.kwh===null)return nt`<g class=${Ae?"band hot":"band"} data-bar="gap" tabindex="0" aria-label=${`${w.title}: ${s("אין נתונים")}`} @pointerenter=${ie} @focus=${ie} @blur=${Ve}>
              ${Fe}<line class="gap" x1=${ae-5} x2=${ae+5} y1=${y-4} y2=${y-4}></line>${Be}</g>`;const ge=Math.max(2,$(w.kwh)),ye=y-ge,Ms=w.lyMark?nt`<rect class="ly" x=${be-2} y=${ye-2} width=${v+4} height=${ge+2} rx="4"></rect>`:o,Ts=w.kind==="cur"?"bar":w.kind==="ly"?"ly":w.partial?"part":"bar2",Ds=Ps&&Os.has(w.key)?nt`<text class="v" x=${ae} y=${ye-5} text-anchor="middle">${g(w.kwh).replace(/\.00$/,"")}</text>`:o;return nt`<g class=${Ae?"band hot":"band"} data-bar=${w.kind} tabindex="0" aria-label=${`${w.title}: ${g(w.kwh)} ${s("קוט״ש")}${w.partial?` (${s("נתונים חלקיים")})`:""}`} @pointerenter=${ie} @focus=${ie} @blur=${Ve}>
            ${Fe}<path class=${Ts} d=${Ba(be,ye,v,ge)}></path>
            ${Ms}${Ds}${Be}</g>`})}
      </svg>
      ${zt?n`<div class="tip" role="tooltip" data-chart-tip style=${`left:${(bt(me)+v/2)/e*100}%; inset-block-start:${(zt.kwh===null?y-8:y-Math.max(2,$(zt.kwh)))/a*100}%`}>
            <b>${zt.kwh===null?s("אין נתונים"):`${g(zt.kwh)} ${s("קוט״ש")}`}</b><small>${zt.title}${zt.partial?` · ${s("נתונים חלקיים")}`:""}</small>
          </div>`:o}
      <div class="legend">
        ${Le?n`<span><i class="l-cur"></i>${s("התקופה הנוכחית")}</span>`:o}
        <span><i class="l-prev"></i>${s("תקופות קודמות")}</span>
        ${se?n`<span><i class="l-ly"></i>${s("אותה תקופה אשתקד")}</span>`:o}
        ${zs?n`<span><i class="l-part"></i>${s("נתונים חלקיים")}</span>`:o}
      </div>
      ${this.renderTable(t)}
    `}renderTable(t){const e=n`<div class=${this.table==="sr"?"sr":"tw"}><table data-elec-chart-table>
      <thead><tr>${t.map(a=>n`<th scope="col" title=${a.title}>${a.kind==="ly"?s("אשתקד"):a.label}</th>`)}</tr></thead>
      <tbody><tr>${t.map(a=>n`<td>${a.kwh===null?"-":g(a.kwh)}</td>`)}</tr></tbody>
    </table></div>`;return this.table==="details"?n`<button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.showTable} @click=${()=>this.showTable=!this.showTable}>${this.showTable?s("הסתרת טבלת מספרים"):s("טבלת מספרים")}</button>${this.showTable?e:o}`:e}};vt.styles=st`
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
  `;Pt([_({attribute:!1})],vt.prototype,"series",2);Pt([_()],vt.prototype,"table",2);Pt([_({type:Boolean,reflect:!0})],vt.prototype,"print",2);Pt([_({type:Number})],vt.prototype,"height",2);Pt([c()],vt.prototype,"w",2);Pt([c()],vt.prototype,"showTable",2);Pt([c()],vt.prototype,"hot",2);vt=Pt([T("elec-chart")],vt);const qa=t=>Z(I.bill(t.id)),Ka=t=>t.stopPropagation();function je(t,e){return e.phone?n`<div class="list" data-elec-bills>
      ${t.map(a=>n`<a class="li" href=${z.bill(a.id)} data-bill-row=${a.id} data-bill-state=${a.state}>
          <div class="grow"><div class="t1">${a.number?n`<span class="num">${a.number}</span>`:s("טיוטה")} · ${a.account_name}</div><div class="t2">${$t(a.period.from,a.period.to)} · <span class="num">${g(a.kwh)}</span> ${s("קוט״ש")}</div></div>
          <div style="text-align:end"><b class="num">${g(a.total)} ₪</b><div style="margin-block-start:4px">${Xt(a.state)}</div></div>
        </a>`)}
    </div>`:n`<div class="card flush scrollx" data-elec-bills>
    <table class="t">
      <thead><tr><th>${s("מספר")}</th>${e.compact?o:n`<th>${s("לקוח")}</th><th>${s("חשבון")}</th>`}<th>${s("תקופה")}</th><th class="num">${s("קוט״ש")}</th><th class="num">${s("סה״כ לתשלום")}</th><th>${s("מצב")}</th><th class="hide-tablet">${s("הונפק")}</th></tr></thead>
      <tbody>
        ${t.map(a=>n`<tr class="go" data-bill-row=${a.id} data-bill-state=${a.state} @click=${()=>qa(a)}>
            <td class="b"><a class="rowlink" href=${z.bill(a.id)} @click=${Ka}>${a.number?n`<span class="num">${a.number}</span>`:n`<span class="mut">${s("טיוטה")}</span>`}</a></td>
            ${e.compact?o:n`<td>${a.customer.name}</td><td>${a.account_name}</td>`}
            <td><span class="num">${$t(a.period.from,a.period.to)}</span></td>
            <td class="num">${g(a.kwh)}</td>
            <td class="num">${g(a.total)} ₪</td>
            <td>${Xt(a.state)}</td>
            <td class="num hide-tablet" style="text-align:start">${a.issue_date?S(a.issue_date):"-"}</td>
          </tr>`)}
      </tbody>
    </table>
  </div>`}var Ua=Object.defineProperty,Wa=Object.getOwnPropertyDescriptor,X=(t,e,a,r)=>{for(var i=r>1?void 0:r?Wa(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ua(e,a,i),i};let W=class extends Y{constructor(){super(...arguments),this.accountId="",this.tab="status",this.st="loading",this.err="",this.status=null,this.hist=null,this.histMonths=12,this.histSt="loading",this.bills=[],this.billsSt="loading",this.createOpen=!1,this.flash="",this.loaded=""}willUpdate(t){t.has("accountId")&&this.accountId&&this.loaded!==this.accountId&&(this.loaded=this.accountId,this.load()),(t.has("tab")||t.has("accountId"))&&this.accountId&&(this.tab==="history"&&this.loadHistory(),this.tab==="bills"&&this.loadBills())}async load(){this.st="loading";try{this.flash=ea(),this.status=await b().accountStatus(this.accountId),this.st="ready"}catch(t){this.err=M(t),this.st="error"}}async loadHistory(){this.histSt="loading";try{this.hist=await b().accountHistory(this.accountId,this.histMonths),this.histSt=this.hist.rows.some(t=>t.kwh!==null)||Re(this.hist.comparison)?"ready":"empty"}catch{this.histSt="error"}}async loadBills(){this.billsSt="loading";try{this.bills=(await b().listBills({account_id:this.accountId})).items,this.billsSt=this.bills.length?"ready":"empty"}catch{this.billsSt="error"}}head(t){const a=this.status?.account,r=[["status",s("מצב")],["history",s("היסטוריה")],...t.bills?[["bills",s("חיובים")]]:[]];return n`<div class="row"><a class="btn ghost sm" href=${z.accounts()} data-back>${s("→ חשבונות")}</a></div>
      <div class="row">
        <div><b class="h2" data-account-name>${a?.name??""}</b>
          <div class="mut">${a?n`${t.bills?n`<a class="lnk" href=${z.customer(a.customer.id)}>${a.customer.name}</a>`:a.customer.name} · ${Pe(a.period_months,a.period_anchor_day,a.period_anchor_month)}`:""}</div></div>
        <span class="sp"></span>
        ${t.bills&&a?n`<sw-button variant="primary" data-create-bill @click=${()=>this.createOpen=!0}>${s("הפקת חיוב")}</sw-button>`:o}
        ${t.manage&&a?n`<a class="btn" data-edit-account href=${z.account(a.id,"edit")}>${s("עריכה")}</a>`:o}
      </div>
      <div class="seg" style="align-self:flex-start" role="tablist" aria-label=${s("חלקי החשבון")}>
        ${r.map(([i,d])=>n`<button type="button" role="tab" data-tab=${i} aria-pressed=${this.tab===i} @click=${()=>Z(I.account(this.accountId,i==="status"?"":i))}>${d}</button>`)}
      </div>`}render(){const t=R();return t.view?this.tab==="bills"&&!t.bills?n`<div class="page" data-elec="account" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לחיובים"))}</div>`:this.st==="loading"?n`<div class="page" data-elec="account" data-state="loading">${et(5)}</div>`:this.st==="error"||!this.status?n`<div class="page" data-elec="account" data-state="error"><div class="row"><a class="btn ghost sm" href=${z.accounts()}>${s("→ חשבונות")}</a></div>${E("error","warning",this.err||s("לא ניתן לטעון את החשבון"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`:n`<div class="page" data-elec="account" data-state="ready" data-tab-now=${this.tab}>
      ${this.head(t)}
      ${this.flash?C("warn",this.flash):o}
      ${this.tab==="status"?this.renderStatus(this.status,t):this.tab==="history"?this.renderHistory(t):this.renderBills()}
      <elec-bill-create .account=${this.status.account} ?open=${this.createOpen} @close=${()=>this.createOpen=!1}></elec-bill-create>
    </div>`:n`<div class="page" data-elec="account" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לצפות בחשבון"))}</div>`}renderStatus(t,e){const a=t.rows.some(h=>h.start!==null),r=t.customer,i=t.rows,d=n`${t.stale?C("warn",n`<b>${t.stale.meter}</b> ${s("לא מדווח")}${t.stale.since?n` ${s("מאז")} ${u(t.stale.since)}`:""}. ${s("הצריכה תיספר כשהמונה יחזור לדווח.")}`):o}
      ${t.notes.map(h=>C("warn",h.text_he))}
      <div class="tiles" data-elec-tiles>
        <div class="tile"><div class="k">${s("צריכה בתקופה")}</div><div class="v">${u(g(t.kwh))}<span class="u">${s("קוט״ש")}</span></div></div>
        <div class="tile"><div class="k">${s("יום")} ${u(t.period.day)} ${s("מתוך")} ${u(t.period.days)}</div><div class="prog" style="margin-block-start:14px" role="progressbar" aria-valuenow=${t.period.day} aria-valuemin="0" aria-valuemax=${t.period.days}><i style="inline-size:${Math.round(t.period.day/t.period.days*100)}%"></i></div></div>
        <div class="tile"><div class="k">${s("צפי לסוף התקופה")}</div><div class="v">${u(sa(t.forecast_kwh))}<span class="u">${s("קוט״ש")}</span></div></div>
        ${t.amount_so_far!==void 0?n`<div class="tile" data-tile="amount"><div class="k">${s("סכום עד כה")}</div><div class="v">${u(t.amount_so_far)}<span class="u">₪</span></div></div>`:n`<div class="tile"><div class="k">${s("ממוצע ליום")}</div><div class="v">${u(g(t.avg_per_day))}<span class="u">${s("קוט״ש")}</span></div></div>`}
      </div>
      <div class="card ${this.phone?"":"flush"}"><div class="hd"><b class="h3">${s("מונים בנוסחה")}</b><span class="sp"></span><span class="mut">${t.account.formula.sentence_he}</span></div>
        ${this.phone?n`<div class="list">${i.map(h=>n`<div class="li"><div class="grow"><div class="t1">${h.name}${h.factor?n` <span class="mut">(${h.factor})</span>`:o}</div><div class="t2">${a&&h.start!==null?n`${u(g(h.start))} ${s("←")} ${u(g(h.end??0))}`:n`${u(g(h.kwh))} ${s("קוט״ש")}`}</div></div><b class="num">${g(h.part)}</b></div>`)}</div>
            <div class="row" style="margin-block-start:10px"><b>${s("סה״כ לחיוב")}</b><span class="sp"></span><b class="num">${g(t.kwh)}</b></div>`:n`<div class="scrollx"><table class="t" data-elec-meters><thead><tr><th>${s("מונה")}</th>${a?n`<th class="num">${s("קריאה בתחילת התקופה")}</th><th class="num">${s("קריאה נוכחית")}</th>`:o}<th class="num">${s("צריכה")}</th><th class="num">${s("חלק")}</th><th class="num">${s("לחיוב (קוט״ש)")}</th></tr></thead>
            <tbody>${i.map(h=>n`<tr><td class="b">${h.name} ${h.stale?n`<span class="chip c-warn">${s("לא מדווח")}</span>`:o}</td>${a?n`<td class="num">${jt(h.start)}</td><td class="num">${jt(h.end)}</td>`:o}<td class="num">${g(h.kwh)}</td><td class="num">${h.factor}</td><td class="num b">${g(h.part)}</td></tr>`)}</tbody>
            <tfoot><tr><td colspan=${a?5:3}>${s("סה״כ לחיוב")}</td><td class="num">${g(t.kwh)}</td></tr></tfoot></table></div>`}
      </div>`,l=n`<div class="card"><div class="hd"><b class="h3">${s("לקוח")}</b><span class="sp"></span>${e.bills&&r?n`<a class="btn ghost sm" href=${z.customer(r.id)}>${s("כרטיס לקוח")}</a>`:o}</div>
        <dl class="kv"><dt>${s("שם")}</dt><dd>${t.account.customer.name}</dd><dt>${s("מספר לקוח")}</dt><dd>${u(t.account.customer.customer_number)}</dd>${e.bills&&r?.phone?n`<dt>${s("טלפון")}</dt><dd>${u(r.phone)}</dd>`:o}${e.bills&&r?.email?n`<dt>${s("דוא״ל")}</dt><dd>${u(r.email)}</dd>`:o}</dl></div>
      ${t.price&&e.bills?n`<div class="card" data-card="price"><div class="hd"><b class="h3">${s("מחיר")}</b></div><dl class="kv"><dt>${s("תעריף")}</dt><dd>${t.price.tariff}</dd><dt>${s("לפני מע״מ")}</dt><dd>${u(A(t.price.ex_vat)+" ₪")}</dd><dt>${s("כולל מע״מ")}</dt><dd>${u(A(t.price.inc_vat)+" ₪")}</dd><dt>${s("מע״מ")}</dt><dd>${u(t.price.vat+"%")}</dd></dl></div>`:t.account.tariff.kind==="tou"&&e.bills?n`<div class="card" data-card="price" data-kind="tou"><div class="hd"><b class="h3">${s("מחיר")}</b></div><dl class="kv"><dt>${s("תעריף")}</dt><dd>${t.account.tariff.name}</dd><dt>${s("חישוב")}</dt><dd>${s("לפי שעות (תעו״ז)")}</dd></dl></div>`:o}
      <div class="card" data-card="next"><div class="hd"><b class="h3">${s("חיוב הבא")}</b></div><dl class="kv"><dt>${s("תקופה")}</dt><dd>${u(S(t.next.from))} - ${u(S(t.next.to))}</dd><dt>${s("מספר צפוי")}</dt><dd>${u(t.next.number)}</dd>${t.account.auto_mode!=="off"?n`<dt>${t.account.auto_mode==="issue"?s("הנפקה אוטומטית"):s("טיוטה אוטומטית")}</dt><dd>${u(S(t.next.draft_on))}</dd>`:o}</dl></div>`;return n`<div class="cols side-l"><div class="col">${d}</div><div class="col">${l}</div></div>`}renderHistory(t){if(this.histSt==="loading")return et(5);if(this.histSt==="error")return E("error","warning",s("לא ניתן לטעון את ההיסטוריה"),{label:s("נסה שוב"),run:()=>void this.loadHistory()});const e=this.hist;if(this.histSt==="empty")return E("empty","bolt",s("אין עדיין נתוני עבר לחשבון"));const a=t.bills,r=[...e.rows].reverse(),i=l=>l.kwh===null?n`<span class="mut" data-no-data>${s("אין נתונים")}</span>`:n`${u(g(l.kwh))}${l.status==="partial"?n` <span class="chip c-warn nodot" data-partial>${s("חלקי")}</span>`:o}`,d=l=>l.change_pct!==null?(l.change_pct>0?"+":"")+l.change_pct.toFixed(1)+"%":"-";return n`<div class="card" data-elec-history><div class="hd"><b class="h3">${s("צריכה לפי תקופה")}</b><span class="sp"></span>
        <div class="seg" role="group" aria-label=${s("טווח")}><button type="button" data-months="12" aria-pressed=${this.histMonths===12} @click=${()=>this.setMonths(12)}>${s("12 תקופות")}</button><button type="button" data-months="24" aria-pressed=${this.histMonths===24} @click=${()=>this.setMonths(24)}>${s("24 תקופות")}</button></div></div>
      <elec-chart .series=${e.comparison} table="details" .height=${this.phone?200:220}></elec-chart></div>
      <div class="card ${this.phone?"":"flush"}">${this.phone?n`<div class="list">${r.map(l=>n`<div class="li" data-history-row data-status=${l.status}><div class="grow"><div class="t1">${u(l.label)}</div><div class="t2">${i(l)}${l.kwh!==null?n` ${s("קוט״ש")}`:""}${l.change_pct!==null?n` · ${u(d(l))}`:o}</div></div>${a&&l.amount!==void 0?n`<b class="num">${g(l.amount)} ₪</b>`:o}</div>`)}</div>`:n`<table class="t" data-elec-history-table><thead><tr><th>${s("תקופה")}</th><th class="num">${s("קוט״ש")}</th><th class="num">${s("שינוי")}</th>${a?n`<th class="num">${s("סכום")}</th><th>${s("חיוב")}</th>`:o}</tr></thead>
          <tbody>${r.map(l=>n`<tr data-history-row data-status=${l.status}><td class="num" style="text-align:start">${l.label}</td><td class="num">${i(l)}</td><td class="num">${d(l)}</td>${a?n`<td class="num">${l.amount!==void 0?g(l.amount)+" ₪":""}</td><td>${l.bill?n`<a class="lnk num" href=${z.bill(l.bill.id)}>${l.bill.number}</a> ${Xt(l.bill.state)}`:n`<span class="mut">-</span>`}</td>`:o}</tr>`)}</tbody></table>`}</div>`}setMonths(t){this.histMonths=t,this.loadHistory()}renderBills(){return this.billsSt==="loading"?et(4):this.billsSt==="error"?E("error","warning",s("לא ניתן לטעון את החיובים"),{label:s("נסה שוב"),run:()=>void this.loadBills()}):this.billsSt==="empty"?E("empty","bolt",s("אין חיובים לחשבון הזה"),{label:s("הפקת חיוב"),primary:!0,run:()=>this.createOpen=!0}):je(this.bills,{phone:this.phone,compact:!0})}};X([_()],W.prototype,"accountId",2);X([_()],W.prototype,"tab",2);X([c()],W.prototype,"st",2);X([c()],W.prototype,"err",2);X([c()],W.prototype,"status",2);X([c()],W.prototype,"hist",2);X([c()],W.prototype,"histMonths",2);X([c()],W.prototype,"histSt",2);X([c()],W.prototype,"bills",2);X([c()],W.prototype,"billsSt",2);X([c()],W.prototype,"createOpen",2);X([c()],W.prototype,"flash",2);W=X([T("elec-account-page")],W);var Ha=Object.defineProperty,Ga=Object.getOwnPropertyDescriptor,Q=(t,e,a,r)=>{for(var i=r>1?void 0:r?Ga(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ha(e,a,i),i};let K=class extends Ot{constructor(){super(...arguments),this.meters=[],this.tokens=[],this.preset="custom",this.mode="builder",this.text="",this.textIssues=[],this.selected=-1,this.menu=!1,this.mainId="",this.pctVal="30",this.preview=null,this.previewErr="",this.skin=new Vt(this),this.seq=0,this.timer=0,this.lastKey="",this.nameOf=t=>this.meters.find(e=>e.id===t)?.name??t,this.idOf=t=>this.meters.find(e=>e.name.trim()===t.trim())?.id??null,this.lastOf=t=>this.meters.find(e=>e.id===t)?.last_period_kwh??null}willUpdate(t){t.has("meters")&&!this.mainId&&(this.mainId=this.meters[0]?.id??""),t.has("tokens")&&this.tokens.length&&(this.preset=Ue(this.tokens,this.meters.map(e=>e.id)))}updated(t){t.has("tokens")&&(this.selected=Math.min(this.selected,this.tokens.length-1),this.mode==="text"&&!this.textIssues.length&&(this.text=We(this.tokens,this.nameOf)),this.scheduleCheck())}parse(){return ze(this.tokens)}emit(t,e=this.preset){this.preset=e,this.tokens=t,this.selected=-1;const a=ze(t),r={tokens:t,ast:a.ast,valid:!a.issues.length&&!!a.ast,preset:e};this.dispatchEvent(new CustomEvent("change",{detail:r,bubbles:!0,composed:!0}))}edit(t){this.emit(t,Ue(t,this.meters.map(e=>e.id)))}scheduleCheck(){window.clearTimeout(this.timer);const t=this.parse(),e=JSON.stringify(t.ast);if(!t.ast||t.issues.length){this.preview=null,this.previewErr="",this.lastKey="";return}if(e===this.lastKey){this.emitChecked();return}this.timer=window.setTimeout(()=>void this.runCheck(t.ast,e),150)}async runCheck(t,e){const a=++this.seq;try{const r=await b().checkFormula(t);if(a!==this.seq)return;this.lastKey=e,this.preview=r,this.previewErr=""}catch(r){if(a!==this.seq)return;this.preview=null,this.previewErr=M(r)}this.emitChecked()}emitChecked(){const t=!!this.preview&&!this.preview.negative&&!this.previewErr;this.dispatchEvent(new CustomEvent("checked",{detail:{ok:t,result:this.preview?.result_kwh??null,negative:this.preview?.negative??!1,error:this.previewErr},bubbles:!0,composed:!0}))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}applyPreset(t){const e=this.meters.map(r=>r.id);if(t==="custom"){this.preset="custom";return}const a=t==="pct"?Ne("pct",[this.mainId||e[0]],{pct:this.pctVal}):Ne(t,e,{main:this.mainId});this.emit(a,t)}add(t){const e=[...this.tokens],a=this.selected>=0?this.selected+1:e.length;e.splice(a,0,t),this.edit(e),this.selected=a}addMeter(t){this.menu=!1,this.add({t:"m",id:t})}addOp(t){this.add({t:"op",v:t})}togglePercent(){const t=this.selected>=0?this.selected:this.tokens.length-1,e=this.tokens[t];if(e?.t!=="n")return;const a=[...this.tokens];a[t]={...e,pct:!e.pct},this.edit(a),this.selected=t}backspace(){const t=[...this.tokens],e=this.selected>=0?this.selected:t.length-1;e<0||(t.splice(e,1),this.edit(t),this.selected=Math.min(e-1,t.length-1))}addNumber(t,e){this.add({t:"n",v:t,pct:e})}setMode(t){t!==this.mode&&(t==="text"?(this.text=We(this.tokens,this.nameOf),this.textIssues=[]):this.textIssues.length&&(this.textIssues=[]),this.mode=t)}onText(t){this.text=t.target.value;const e=aa(this.text,this.idOf);if(this.textIssues=e.issues,!e.issues.length)this.edit(e.toks);else{const a={tokens:this.tokens,ast:null,valid:!1,preset:this.preset};this.dispatchEvent(new CustomEvent("change",{detail:a,bubbles:!0,composed:!0}))}}tok(t,e,a){const r=`tok ${t.t==="m"?"m":t.t==="op"?"op":"k"} ${a.has(e)?"bad":""} ${this.selected===e?"sel":""}`,i=()=>this.selected=this.selected===e?-1:e;if(t.t==="m"){const d=this.lastOf(t.id);return n`<button type="button" class=${r} data-tok="meter" aria-pressed=${this.selected===e} @click=${i}>${this.nameOf(t.id)}${d!==null?n`<small class="num">${g(d)}</small>`:o}</button>`}return t.t==="op"?n`<button type="button" class=${r} data-tok="op" aria-pressed=${this.selected===e} aria-label=${t.v==="*"?s("כפל"):t.v==="-"?s("מינוס"):t.v==="+"?s("פלוס"):t.v==="/"?s("חילוק"):t.v} @click=${i}>${t.v==="*"?"×":t.v==="-"?"−":t.v==="/"?"÷":t.v}</button>`:n`<button type="button" class=${r} data-tok="num" aria-pressed=${this.selected===e} @click=${i}><span class="num">${t.v}${t.pct?"%":""}</span></button>`}render(){const t=this.parse(),e=new Set(t.issues.map(p=>p.at).filter(p=>p>=0)),a=this.preview,r=!!a?.negative,i=this.mode==="text"&&this.textIssues.length?this.textIssues.map(p=>p.message):t.issues.map(p=>p.message),d=i.length||r||this.previewErr,l=!i.length&&!r&&!this.previewErr&&!!t.ast&&!!a,h=this.tokens.length?ia(this.tokens,this.nameOf):"",m=t.warnings;return n`<div data-elec="formula-editor" data-formula-state=${d?"error":l?"ok":"pending"} data-preset=${this.preset}>
      <div class="presets" role="group" aria-label=${s("תבנית נוסחה")}>
        ${ra.map(p=>n`<button type="button" class="preset" data-preset-btn=${p.id} aria-pressed=${this.preset===p.id} @click=${()=>this.applyPreset(p.id)}><b>${p.label}</b><span>${p.hint}</span></button>`)}
      </div>
      ${this.preset==="mainsub"||this.preset==="pct"?n`<div class="row">
            <div class="fld" style="min-inline-size:200px"><label for="main">${this.preset==="pct"?s("מונה"):s("מונה ראשי")}</label>
              <select id="main" data-preset-main @change=${p=>{this.mainId=p.target.value,this.applyPreset(this.preset)}}>
                ${this.meters.map(p=>n`<option value=${p.id} ?selected=${p.id===this.mainId}>${p.name}</option>`)}
              </select></div>
            ${this.preset==="pct"?n`<div class="fld" style="inline-size:120px"><label for="pct">${s("אחוז")}</label><input id="pct" class="ltr" data-preset-pct inputmode="decimal" .value=${this.pctVal} @input=${p=>{this.pctVal=p.target.value,Number(this.pctVal)>0&&this.applyPreset("pct")}} /></div>`:o}
          </div>`:o}
      <div class="row"><b class="h3">${s("הנוסחה")}</b><span class="sp"></span>
        <div class="seg" role="group" aria-label=${s("מצב עריכה")}>
          <button type="button" data-mode="builder" aria-pressed=${this.mode==="builder"} @click=${()=>this.setMode("builder")}>${s("בונה")}</button>
          <button type="button" data-mode="text" aria-pressed=${this.mode==="text"} @click=${()=>this.setMode("text")}>${s("טקסט")}</button>
        </div>
      </div>
      ${this.mode==="text"?n`<textarea class="code ${this.textIssues.length?"err":""}" data-text aria-label=${s("נוסחה בטקסט")} dir="ltr" spellcheck="false" .value=${this.text} @input=${this.onText}></textarea>
            <div class="mut">${s("שמות מונים בסוגריים מרובעים. פעולות: + − × ( ) ומספרים או אחוזים.")}</div>`:n`<div class="expr ${i.length||r?"err":""}" data-expr>
              ${this.tokens.length?this.tokens.map((p,v)=>this.tok(p,v,e)):n`<span class="mut">${s("הוסיפו מונה או בחרו תבנית")}</span>`}
            </div>
            <div class="pal">
              <button type="button" class="btn" data-add-meter aria-expanded=${this.menu} aria-haspopup="listbox" @click=${()=>this.menu=!this.menu}>${s("+ מונה")} ▾</button>
              ${["+","-","*"].map(p=>n`<button type="button" class="btn" data-op=${p} aria-label=${p==="+"?s("פלוס"):p==="-"?s("מינוס"):s("כפל")} @click=${()=>this.addOp(p)}>${p==="*"?"×":p==="-"?"−":p}</button>`)}
              <button type="button" class="btn" data-op="percent" aria-label=${s("אחוז")} @click=${()=>this.togglePercent()}>%</button>
              <button type="button" class="btn" data-op="(" aria-label=${s("סוגר פותח")} @click=${()=>this.addOp("(")}>(</button>
              <button type="button" class="btn" data-op=")" aria-label=${s("סוגר סוגר")} @click=${()=>this.addOp(")")}>)</button>
              <sw-button data-number-btn @click=${()=>this.dispatchEvent(new CustomEvent("number-request",{bubbles:!0,composed:!0}))}>${s("מספר")}</sw-button>
              <span class="sp"></span>
              <sw-button variant="ghost" data-backspace @click=${()=>this.backspace()}>⌫ ${s("מחיקה")}</sw-button>
            </div>
            ${this.menu?n`<div class="menu" role="listbox" data-meter-menu>${this.meters.map(p=>n`<button type="button" role="option" data-meter-option=${p.id} @click=${()=>this.addMeter(p.id)}><span>${p.name}</span>${p.last_period_kwh!==null?n`<span class="mut num">${g(p.last_period_kwh)}</span>`:o}</button>`)}</div>`:o}`}
      ${h?n`<div class="mut" data-sentence>${h}</div>`:o}
      ${i.map(p=>C("err",p))}
      ${m.map(p=>C("warn",p))}
      ${r&&a?C("err",n`${s("התוצאה שלילית בתקופה האחרונה")} (${u(g(a.result_kwh??0))} ${s("קוט״ש")}). ${s("בדקו את הסימנים בנוסחה.")}`):o}
      ${this.previewErr?C("err",this.previewErr):o}
      ${l?C("ok",s("הנוסחה תקינה")):o}
      ${a&&!i.length?this.renderPreview(a):o}
    </div>`}renderPreview(t){return n`<div class="card soft" data-formula-preview>
      <div class="hd"><b class="h3">${s("בדיקה על {period}",{period:t.period_from?`${S(t.period_from)} - ${S(t.period_to)}`:s("התקופה האחרונה")})}</b></div>
      <div class="scrollx"><table class="t"><thead><tr><th>${s("מונה")}</th><th class="num">${s("צריכה (קוט״ש)")}</th></tr></thead>
        <tbody>${t.rows.map(e=>n`<tr><td>${e.name}</td><td class="num">${g(e.kwh)}</td></tr>`)}</tbody>
        <tfoot><tr><td>${s("צריכת החשבון")}</td><td class="num ${t.negative?"bad":""}" data-formula-result>${g(t.result_kwh??0)}</td></tr></tfoot></table></div>
    </div>`}};K.styles=[yt,st`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      textarea.code {
        min-block-size: 76px;
        font-size: var(--sw-fs-lg);
      }
    `];Q([_({attribute:!1})],K.prototype,"meters",2);Q([_({attribute:!1})],K.prototype,"tokens",2);Q([c()],K.prototype,"preset",2);Q([c()],K.prototype,"mode",2);Q([c()],K.prototype,"text",2);Q([c()],K.prototype,"textIssues",2);Q([c()],K.prototype,"selected",2);Q([c()],K.prototype,"menu",2);Q([c()],K.prototype,"mainId",2);Q([c()],K.prototype,"pctVal",2);Q([c()],K.prototype,"preview",2);Q([c()],K.prototype,"previewErr",2);K=Q([T("elec-formula-editor")],K);function ot(t){const e=(t.device_name??"").trim(),a=(t.entity_name??"").trim()||t.name;return t.name&&t.name!==a&&t.name!==e?{primary:t.name,secondary:[...new Set([e,a].filter(i=>i&&i!==t.name))].join(" · ")}:{primary:e||a,secondary:e&&a!==e?a:""}}function ws(t){return[t.name,t.device_name,t.entity_name].filter(Boolean).join(" ").toLowerCase()}const es=120;function oe(t,e){const a=t.trim(),r=a.toLocaleLowerCase(),i=!!a&&e.some(d=>d.trim().toLocaleLowerCase()===r);return a?a.length>es?{name:a,error:s("השם ארוך מדי (עד {max} תווים)",{max:es}),duplicate:i}:i?{name:a,error:_s,duplicate:i}:{name:a,error:"",duplicate:i}:{name:a,error:s("צריך להזין שם למונה"),duplicate:!1}}const _s=s("קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם"),Za=s("השם החדש יופיע במסמכים חדשים. חשבוניות שכבר הונפקו לא ישתנו.");var Ya=Object.defineProperty,Xa=Object.getOwnPropertyDescriptor,it=(t,e,a,r)=>{for(var i=r>1?void 0:r?Xa(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ya(e,a,i),i};let H=class extends Ot{constructor(){super(...arguments),this.bubbleSkin=new Vt(this),this.mode="register",this.multi=!0,this.sensors=!1,this.selected=[],this.meters=null,this.q="",this.area="",this.items=[],this.phase="loading",this.error="",this.rejected=null,this.timer=0,this.seq=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){window.clearTimeout(this.timer),super.disconnectedCallback()}updated(t){t.has("meters")&&t.get("meters")!==void 0&&this.mode==="choose"&&this.load()}async load(){const t=++this.seq;this.phase="loading";try{const e=this.mode==="choose"?await this.loadChoose():this.fromCandidates(await qe(this.q,this.area||void 0));if(t!==this.seq)return;this.items=e,this.phase="ready"}catch(e){if(t!==this.seq)return;this.error=dt(e),this.phase="error"}}async loadChoose(){const[t,e]=await Promise.all([this.meters?Promise.resolve(this.meters):Te(),this.sensors?qe("").catch(()=>[]):Promise.resolve([])]);return[...this.fromMeters(t),...this.fromSensors(e)]}fromCandidates(t){return t.map(e=>({id:e.entity_id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:e.value??"",verdict:e.already_added?"added":e.verdict,message:e.already_added?"":we(e),sensor:!1}))}fromMeters(t){return t.map(e=>({id:e.id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:`${lt(e.reading_kwh)} kWh`,verdict:e.status==="reporting"?"ok":"warn",message:e.status==="stale"?s("המונה לא מדווח כרגע"):e.status==="paused"?s("המונה מושהה"):"",sensor:!1,tag:e.status==="stale"?s("לא מדווח"):e.status==="paused"?s("מושהה"):void 0}))}fromSensors(t){return t.filter(e=>e.verdict!=="ok"&&!e.already_added).map(e=>({id:e.entity_id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:e.value??"",verdict:e.verdict==="warn"?"warn":"rejected",message:e.verdict==="warn"?`${we(e)} ${s("צריך להוסיף אותו קודם במסך המונים.")}`:we(e),sensor:!0}))}listed(){if(this.phase!=="ready")return[];if(this.mode!=="choose")return this.items;const t=this.q.trim().toLowerCase();return this.items.filter(e=>(!this.area||e.area===this.area)&&(!t||ws({name:e.name,device_name:e.device,entity_name:e.entity}).includes(t)||e.area.toLowerCase().includes(t)))}onSearch(t){this.q=t.target.value,this.mode!=="choose"&&(window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.load(),250))}onArea(t){this.area=t.target.value,this.mode!=="choose"&&this.load()}off(t){return t.sensor||t.verdict==="rejected"||t.verdict==="added"}toggle(t){if(this.off(t)){this.rejected=t.verdict==="added"?null:t;return}this.rejected=null;const e=this.selected.includes(t.id),a=this.multi?e?this.selected.filter(i=>i!==t.id):[...this.selected,t.id]:e?[]:[t.id];this.selected=a;const r={};for(const i of a){const d=this.items.find(l=>l.id===i);d&&(r[i]=ot({name:d.name,device_name:d.device,entity_name:d.entity}).primary)}this.dispatchEvent(new CustomEvent("change",{detail:{selected:a,names:r},bubbles:!0,composed:!0}))}chip(t){return t.verdict==="ok"?n`<span class="chip c-ok" data-verdict="ok">${s("מתאים")}</span>`:t.verdict==="warn"?n`<span class="chip c-warn" data-verdict="warn">${t.tag??s("אזהרה")}</span>`:t.verdict==="added"?n`<span class="chip c-acc" data-verdict="added">${s("נוסף")}</span>`:n`<span class="chip c-err" data-verdict="rejected">${s("לא מתאים")}</span>`}render(){const t=this.mode==="choose",e=[...new Set(this.items.map(r=>r.area).filter(Boolean))],a=this.listed();return n`
      <div class="head">
        <label class="inp">
          <sw-icon name="search" size="16"></sw-icon>
          <input type="search" data-picker-search placeholder=${t?s("חיפוש מונה לפי שם"):s("חיפוש לפי שם")} aria-label=${t?s("חיפוש מונה לפי שם"):s("חיפוש לפי שם")} .value=${this.q} @input=${this.onSearch} />
        </label>
        <label class="inp">
          <select data-picker-area aria-label=${s("אזור")} @change=${this.onArea}>
            <option value="" ?selected=${!this.area}>${s("כל האזורים")}</option>
            ${[...new Set([...e,this.area].filter(Boolean))].map(r=>n`<option value=${r} ?selected=${r===this.area}>${r}</option>`)}
          </select>
        </label>
      </div>
      ${this.rejected?n`<div class="alert err" role="alert" data-picker-reject><span class="x" aria-hidden="true">!</span><div><b>${ot({name:this.rejected.name,device_name:this.rejected.device,entity_name:this.rejected.entity}).primary}</b> ${s("לא נבחר.")} ${this.rejected.message}</div></div>`:o}
      ${this.phase==="loading"?n`<sw-state-panel state="loading" compact></sw-state-panel>`:o}
      ${this.phase==="error"?n`<sw-state-panel state="error" compact heading=${t?s("לא ניתן לטעון את המונים"):s("לא ניתן לטעון את החיישנים")} hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel>`:o}
      ${this.phase==="ready"&&!a.length?n`<sw-state-panel icon="bolt" state="empty" compact data-no-match heading=${t?this.items.length?s("לא נמצא מונה בשם הזה"):s("אין מונים עדיין"):s("לא נמצאו חיישנים")}></sw-state-panel>`:o}
      ${a.length?n`<div class="list scroll" role="listbox" aria-multiselectable=${this.multi?"true":"false"} aria-label=${t?s("מונים"):s("חיישנים")} data-picker-list>
            ${a.map(r=>{const i=this.selected.includes(r.id),d=this.off(r),l=ot({name:r.name,device_name:r.device,entity_name:r.entity});return n`<button type="button" class="li pick ${i?"sel":""} ${d?"dis":""} ${this.rejected?.id===r.id?"flag":""}" role="option" aria-selected=${i?"true":"false"} aria-disabled=${d?"true":"false"} data-picker-item=${r.id} data-verdict=${r.verdict} ?data-sensor=${r.sensor} @click=${()=>this.toggle(r)}>
                <span class="check ${i?"on":""} ${d?"dis":""}">${i?n`<sw-icon name="check" size="14"></sw-icon>`:o}</span>
                <span class="grow">
                  <div class="t1" data-picker-name>${l.primary}</div>
                  ${l.secondary?n`<div class="t2 ent" data-picker-entity title=${s("שם הישות")}>${l.secondary}</div>`:o}
                  <div class="t2">${r.area}${r.area&&r.value?" · ":""}<span class="num">${r.value}</span></div>
                  ${r.message&&(r.verdict==="warn"||r.verdict==="rejected")?n`<div class="t2 wrap" style="color:${r.verdict==="warn"?"var(--sw-warning-text)":"var(--sw-danger-text)"}">${r.message}</div>`:o}
                </span>
                ${this.chip(r)}
              </button>`})}
          </div>`:o}
    `}};H.styles=[yt,st`
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
    `];it([_()],H.prototype,"mode",2);it([_({type:Boolean})],H.prototype,"multi",2);it([_({type:Boolean})],H.prototype,"sensors",2);it([_({attribute:!1})],H.prototype,"selected",2);it([_({attribute:!1})],H.prototype,"meters",2);it([c()],H.prototype,"q",2);it([c()],H.prototype,"area",2);it([c()],H.prototype,"items",2);it([c()],H.prototype,"phase",2);it([c()],H.prototype,"error",2);it([c()],H.prototype,"rejected",2);H=it([T("elec-meter-picker")],H);var Qa=Object.defineProperty,Ja=Object.getOwnPropertyDescriptor,x=(t,e,a,r)=>{for(var i=r>1?void 0:r?Ja(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Qa(e,a,i),i};const Ce=[s("בחירת מונים"),s("נוסחת החשבון"),s("מחיר ומע״מ"),s("תקופת חיוב"),s("כרטיס לקוח"),s("סיכום והפקה")],ti=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,ss=()=>({name:"",customer_number:"",tax_id:"",address:"",phone:"",email:"",notes:""});let k=class extends Y{constructor(){super(...arguments),this.accountId="",this.loadSt="loading",this.step=1,this.reached=1,this.meters=[],this.tariffs=[],this.vat=null,this.settings=null,this.customers=[],this.nextNo="",this.meterIds=[],this.tokens=[],this.formulaValid=!1,this.formulaChecked=!1,this.tariffId="",this.tariffOpen=!1,this.tf={name:"",price:"",mode:"ex_vat",from:"",err:{},busy:!1,error:""},this.months=1,this.anchorDay=1,this.anchorMonth=1,this.firstStart="",this.custMode="new",this.custQ="",this.existingId="",this.nc=ss(),this.ncErr={},this.accName="",this.accNameErr="",this.auto="draft",this.afterSave="draft",this.saving=!1,this.saveErr="",this.sampleResult=null,this.numOpen=!1,this.numVal="",this.numPct=!0,this.numErr="",this.account=null,this.createdCustomerId="",this.draftPossible=()=>!!this.lastPeriod(),this.onFormula=t=>{this.tokens=t.detail.tokens,this.formulaValid=t.detail.valid,this.formulaChecked=!1},this.onChecked=t=>{this.formulaChecked=t.detail.ok&&this.formulaValid,this.sampleResult=t.detail.result}}connectedCallback(){super.connectedCallback(),this.init()}get edit(){return!!this.accountId}async init(){this.loadSt="loading";const t=R();try{const e=b(),[a,r,i,d,l,h]=await Promise.all([na(),e.listTariffs(),e.getVat(),e.getSettings().catch(()=>null),t.view?e.listCustomers().catch(()=>[]):Promise.resolve([]),e.nextCustomerNumber().catch(()=>"")]);if(this.meters=a,this.tariffs=r,this.vat=i,this.settings=d,this.customers=l,this.nextNo=h,this.nc={...ss(),customer_number:h},this.tf={...this.tf,mode:d?.default_price_mode??"ex_vat",from:tt()},this.firstStart=tt(),r.length===1&&(this.tariffId=r[0].id),this.edit){const m=await e.getAccount(this.accountId);this.account=m,this.meterIds=m.formula.meter_ids,this.tokens=la(m.formula.ast),this.formulaValid=!0,this.tariffId=m.tariff.id,this.months=m.period_months,this.anchorDay=m.period_anchor_day,this.anchorMonth=m.period_anchor_month,this.firstStart=m.first_period_start,this.auto=m.auto_mode,this.accName=m.name,this.existingId=m.customer.id,this.custMode="existing",this.reached=6}this.loadSt="ready"}catch{this.loadSt="error"}}chosen(){return this.meterIds.map(t=>this.meters.find(e=>e.id===t)).filter(t=>!!t)}tariff(){return this.tariffs.find(t=>t.id===this.tariffId)}cust(){if(this.custMode==="existing"){const t=this.customers.find(e=>e.id===this.existingId)??(this.account?{name:this.account.customer.name,customer_number:this.account.customer.customer_number,account_count:1}:null);return t?{name:t.name,number:t.customer_number,count:t.account_count}:{name:"",number:this.nextNo,count:0}}return{name:this.nc.name,number:this.nc.customer_number||this.nextNo,count:0}}canNext(){switch(this.step){case 1:return this.meterIds.length>0;case 2:return this.formulaValid&&this.formulaChecked;case 3:return!!this.tariffId&&!!this.vat?.current;case 4:return q(this.firstStart)&&this.anchorDay>=1&&this.anchorDay<=28;case 5:return!0;default:return!0}}goStep(t){t<1||t>6||t>this.reached||(this.step=t)}next(){this.step===5&&!this.validateStep5()||!this.canNext()||this.step>=6||(this.step===1&&this.enterFormula(),this.step+=1,this.reached=Math.max(this.reached,this.step),this.step===2&&(this.formulaChecked=!1))}enterFormula(){this.tokens.every(e=>e.t!=="m"||this.meterIds.includes(e.id))&&this.tokens.some(e=>e.t==="m")||(this.tokens=Ne("sum",this.meterIds),this.formulaValid=!0,this.formulaChecked=!1)}validateStep5(){this.ncErr={},this.accNameErr="";let t=!0;return this.accName.trim()||(this.accNameErr=s("צריך לתת שם לחשבון"),t=!1),this.edit||(this.custMode==="new"?(this.nc.name.trim()||(this.ncErr={...this.ncErr,name:s("צריך לכתוב שם ללקוח")},t=!1),this.nc.email&&!ti.test(this.nc.email)&&(this.ncErr={...this.ncErr,email:s("כתובת דוא״ל לא תקינה")},t=!1),/^\d{1,9}$/.test(this.nc.customer_number)||(this.ncErr={...this.ncErr,customer_number:s("מספר לקוח הוא ספרות בלבד")},t=!1)):this.existingId||(t=!1)),t}async save(){if(this.saving)return;const t=this.tariff(),e=ze(this.tokens).ast;if(!t||!e)return;this.saving=!0,this.saveErr="";const a=b();try{if(this.edit&&this.account){await a.updateAccount(this.account.id,this.account.revision,{name:this.accName.trim(),formula:{ast:e},tariff_id:this.tariffId,auto_mode:this.auto}),Z(I.account(this.account.id));return}let r=this.existingId;if(this.custMode==="new"){if(!this.createdCustomerId)try{const d=await a.createCustomer({name:this.nc.name.trim(),customer_number:this.nc.customer_number,address:this.nc.address,phone:this.nc.phone,email:this.nc.email,tax_id:this.nc.tax_id,notes:this.nc.notes});this.createdCustomerId=d.id}catch(d){const l=Lt(d);this.ncErr=Object.keys(l).length?l:{customer_number:M(d)},!Object.keys(l).length&&!da(d)&&(this.ncErr={name:M(d)}),this.step=5;return}r=this.createdCustomerId}const i=await a.createAccount({name:this.accName.trim(),customer_id:r,formula:{ast:e},tariff_id:this.tariffId,period_months:this.months,period_anchor_day:this.anchorDay,period_anchor_month:this.months===2?this.anchorMonth:1,first_period_start:this.firstStart,auto_mode:this.auto},this.draftPossible()?this.afterSave:"none");i.billError&&oa(s("החשבון נשמר, אבל לא נוצרה טיוטה: {error}",{error:i.billError})),Z(I.account(i.account.id))}catch(r){this.saveErr=M(r)}finally{this.saving=!1}}lastPeriod(){const t=tt(),e=Tt(t,this.months,this.anchorDay,this.months===2?this.anchorMonth:1),a=Qt(e.from,-1);return!q(this.firstStart)||a<this.firstStart?null:{from:this.firstStart>Tt(a,this.months,this.anchorDay,this.months===2?this.anchorMonth:1).from?this.firstStart:Tt(a,this.months,this.anchorDay,this.months===2?this.anchorMonth:1).from,to:a}}renderStep1(){const t=this.chosen();return n`<elec-meter-picker mode="choose" multi sensors .meters=${this.meters} .selected=${this.meterIds} data-meter-picker
        @change=${e=>this.meterIds=e.detail.selected}></elec-meter-picker>
      <div class="row" data-chosen><span class="chip c-acc nodot">${t.length===1?s("נבחרו 1 מונה"):s("נבחרו {n} מונים",{n:t.length})}</span><span class="mut">${t.map(e=>ot(e).primary).join(", ")}</span></div>`}renderStep2(){return n`<elec-formula-editor .meters=${this.chosen()} .tokens=${this.tokens} @change=${this.onFormula} @checked=${this.onChecked} @number-request=${()=>{this.numOpen=!0,this.numErr=""}}></elec-formula-editor>`}confirmNumber(){const t=this.numVal.trim().replace(",",".");if(!/^\d+(\.\d+)?$/.test(t)||Number(t)<=0){this.numErr=s("צריך להקליד מספר גדול מאפס");return}if(this.numPct&&Number(t)>1e3){this.numErr=s("האחוז גדול מדי");return}this.numOpen=!1,this.numErr="",this.renderRoot.querySelector("elec-formula-editor")?.addNumber(t,this.numPct),this.numVal=""}renderNumberDialog(){return n`<elec-dialog heading=${s("הוספת מספר")} ?open=${this.numOpen} data-number-dialog @close=${()=>this.numOpen=!1}>
      <div class="fld"><label for="numv">${s("ערך")}</label>
        <input id="numv" class="ltr ${this.numErr?"err":""}" data-number-input inputmode="decimal" .value=${this.numVal} @input=${t=>{this.numVal=t.target.value,this.numErr=""}} @keydown=${t=>t.key==="Enter"&&this.confirmNumber()} />
        ${this.numErr?n`<div class="msg" role="alert">${this.numErr}</div>`:o}</div>
      <div class="seg" role="group" aria-label=${s("סוג")}>
        <button type="button" data-number-kind="pct" aria-pressed=${this.numPct} @click=${()=>this.numPct=!0}>${s("אחוז")}</button>
        <button type="button" data-number-kind="num" aria-pressed=${!this.numPct} @click=${()=>this.numPct=!1}>${s("מספר")}</button>
      </div>
      <sw-button variant="primary" slot="actions" data-number-ok @click=${()=>this.confirmNumber()}>${s("הוספה")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.numOpen=!1}>${s("ביטול")}</sw-button>
    </elec-dialog>`}exOf(t){const e=t.current,a=this.vat?.current?Number(this.vat.current.rate_percent)/100:0,r=e?Number(e.price):0;return e?.price_mode==="inc_vat"?{ex:r/(1+a),inc:r,vat:a}:{ex:r,inc:r*(1+a),vat:a}}renderStep3(){const t=this.tariff(),e=this.vat?.current;return n`${e?o:C("err",n`${s("לא הוגדר שיעור מע״מ.")} <a class="lnk" href=${z.settings("prices")}>${s("הגדרת שיעור מע״מ")}</a>`)}
      ${this.tariffs.length?n`<div class="list" role="radiogroup" aria-label=${s("תעריף")} data-tariff-list>
        ${this.tariffs.map(a=>n`<label class="li ${a.id===this.tariffId?"sel":""}" data-tariff-row=${a.id}><input type="radio" name="tariff" .checked=${a.id===this.tariffId} @change=${()=>this.tariffId=a.id} /><span class="ind"></span>
          <div class="grow"><div class="t1">${a.name}</div><div class="t2">${a.current?.price_mode==="inc_vat"?s("הוזן כולל מע״מ"):s("הוזן לפני מע״מ")} ${s("· בתוקף מ-")}${u(S(a.current?.effective_from??""))}</div></div>${a.kind==="tou"?n`<span class="chip c-acc nodot">${s("לפי שעות")}</span>`:n`<b class="num">${A(a.current?.price??0)} ₪</b>`}</label>`)}</div>
        <div class="row"><sw-button variant="ghost" size="sm" data-new-tariff @click=${()=>this.tariffOpen=!0}>${s("+ תעריף חדש")}</sw-button></div>`:E("empty","bolt",s("אין תעריפים עדיין"),{label:s("+ תעריף חדש"),primary:!0,run:()=>this.tariffOpen=!0})}
      ${t&&e?this.priceCard(t):o}`}priceCard(t){if(t.kind==="tou"){const i=t.current?.definition;return n`<div class="card soft" data-price-card data-kind="tou"><dl class="kv"><dt>${s("תעריף")}</dt><dd>${s("לפי שעות (תעו״ז)")}${i?n`: ${i.bands.map(d=>j("bands",d,t.current?.names_en)).join(" / ")}, ${i.seasons.map(d=>j("seasons",d,t.current?.names_en)).join(" / ")}`:o}</dd>
        <dt>${s("מע״מ")}</dt><dd>${u((this.exOf(t).vat*100).toFixed(0)+"%")} <span class="mut">${s("(מההגדרות)")}</span></dd></dl>
        <div class="mut" style="margin-block-start:8px">${s("הסכום מחושב לפי שעות הצריכה בפועל, בכל פס ועונה במחיר שלהם.")}</div></div>`}const e=this.exOf(t),a=this.sampleKwh(),r=t.current?.price_mode==="inc_vat"?ut(a*e.inc):ut(ut(a*e.ex)+ut(ut(a*e.ex)*e.vat));return n`<div class="card soft" data-price-card><dl class="kv"><dt>${s("מחיר לקוט״ש לפני מע״מ")}</dt><dd>${u(A(e.ex)+" ₪")}</dd><dt>${s("מע״מ")}</dt><dd>${u((e.vat*100).toFixed(0)+"%")} <span class="mut">${s("(מההגדרות)")}</span></dd><dt>${s("מחיר לקוט״ש כולל מע״מ")}</dt><dd>${u(A(e.inc)+" ₪")}</dd>
      ${a?n`<dt>${s("לדוגמה,")} ${Ie(Qt(Tt(tt(),1,1,1).from,-1))}</dt><dd>${u(g(a))} ${s("קוט״ש =")} ${u(g(r)+" ₪")}</dd>`:o}</dl></div>`}sampleKwh(){return this.sampleResult!==null&&this.sampleResult>0?this.sampleResult:0}renderStep4(){const t=this.months===2?this.anchorMonth:1,e=q(this.firstStart)?ca(this.firstStart,this.months,this.anchorDay,t,"",3):[],a=this.cust();return n`<div class="form">
        <div class="fld"><span class="lbl" id="len">${s("אורך תקופה")}</span><div class="seg" role="group" aria-labelledby="len"><button type="button" data-months="1" aria-pressed=${this.months===1} ?disabled=${this.edit} @click=${()=>this.months=1}>${s("חודשית")}</button><button type="button" data-months="2" aria-pressed=${this.months===2} ?disabled=${this.edit} @click=${()=>this.months=2}>${s("דו-חודשית")}</button></div></div>
        ${this.months===2?n`<div class="fld"><label for="am">${s("חודש פתיחת המחזור")}</label><select id="am" data-anchor-month ?disabled=${this.edit} @change=${r=>this.anchorMonth=Number(r.target.value)}>${ha.map((r,i)=>n`<option value=${i+1} ?selected=${this.anchorMonth===i+1}>${r}</option>`)}</select></div>`:o}
        <div class="fld"><label for="ad">${s("יום תחילת תקופה")}</label><div class="unit"><input id="ad" class="ltr" type="number" min="1" max="28" data-anchor-day ?disabled=${this.edit} .value=${String(this.anchorDay)} @input=${r=>this.anchorDay=Number(r.target.value)} /><span>${s("בחודש")}</span></div>
          ${this.anchorDay<1||this.anchorDay>28?n`<div class="msg" role="alert">${s("היום חייב להיות בין 1 ל-28")}</div>`:o}</div>
        <div class="fld"><label for="fs">${s("תחילת החיוב הראשון")}</label><input id="fs" type="date" lang=${ct()} class="ltr ${q(this.firstStart)?"":"err"}" data-first-start ?disabled=${this.edit} .value=${this.firstStart} @change=${r=>this.firstStart=r.target.value} />
          ${q(this.firstStart)?o:n`<div class="msg" role="alert">${s("צריך לבחור תאריך")}</div>`}</div>
      </div>
      <div class="card flush soft"><div class="hd"><b class="h3">${s("התקופות הבאות")}</b></div>${e.length?n`<table class="t" data-periods><thead><tr><th>${s("תקופה")}</th><th>${s("מספר חיוב")}</th></tr></thead><tbody>
        ${e.map(r=>n`<tr><td><span class="num">${$t(r.from,r.to)}</span></td><td class="num" style="text-align:start">${He(r.to,a.number,"")}</td></tr>`)}</tbody></table>`:n`<div class="mut" style="padding:0 16px 14px">${s("בחרו תאריך התחלה")}</div>`}</div>`}renderStep5(){const t=(i,d,l={})=>{const h=this.ncErr[i];return n`<div class="fld ${l.wide?"wide":""}"><label for="c-${i}">${d}</label>
        ${l.area?n`<textarea id="c-${i}" name=${i} .value=${this.nc[i]} placeholder=${l.ph??""} @input=${m=>this.nc={...this.nc,[i]:m.target.value}}></textarea>`:n`<input id="c-${i}" name=${i} class="${l.ltr?"ltr":""} ${h?"err":""}" aria-invalid=${h?"true":"false"} placeholder=${l.ph??""} .value=${this.nc[i]} @input=${m=>{this.nc={...this.nc,[i]:m.target.value},this.ncErr[i]&&(this.ncErr={...this.ncErr,[i]:""})}} />`}
        ${h?n`<div class="msg" role="alert" data-field-error=${i}>${h}</div>`:o}</div>`},e=this.customers.find(i=>i.id===this.existingId),a=this.custQ.trim(),r=this.customers.filter(i=>!a||i.name.includes(a)||i.customer_number.includes(a));return n`${this.edit?C("info",n`${s("הלקוח של חשבון קיים לא משתנה כאן.")} <b>${this.account?.customer.name}</b>`):n`<div class="seg" style="align-self:flex-start" role="group" aria-label=${s("לקוח")}><button type="button" data-cust-mode="new" aria-pressed=${this.custMode==="new"} @click=${()=>this.custMode="new"}>${s("לקוח חדש")}</button><button type="button" data-cust-mode="existing" aria-pressed=${this.custMode==="existing"} @click=${()=>this.custMode="existing"}>${s("לקוח קיים")}</button></div>`}
      ${this.edit?o:this.custMode==="existing"?n`<input type="search" data-cust-search style="max-inline-size:none" aria-label=${s("חיפוש לקוח")} placeholder=${s("חיפוש לקוח")} .value=${this.custQ} @input=${i=>this.custQ=i.target.value} />
            <div class="list" role="radiogroup" aria-label=${s("לקוח קיים")} data-cust-list>${r.map(i=>n`<label class="li ${i.id===this.existingId?"sel":""}" data-cust-row=${i.id}><input type="radio" name="cust" .checked=${i.id===this.existingId} @change=${()=>this.existingId=i.id} /><span class="ind"></span><div class="grow"><div class="t1">${i.name}</div><div class="t2">${s("מספר לקוח")} ${u(i.customer_number)} · ${i.account_count} ${s("חשבונות")}</div></div></label>`)}
              ${r.length?o:n`<div class="mut">${s("לא נמצא לקוח")}</div>`}</div>
            ${e&&e.account_count>0?C("warn",n`${e.account_count===1?s("ללקוח יש כבר 1 חשבון."):s("ללקוח יש כבר {n} חשבונות.",{n:e.account_count})} ${s("חיובים של אותו לקוח שמסתיימים באותו חודש יקבלו סיומת רצה, למשל")} <b class="num">${He(Tt(tt(),1,1,1).to,e.customer_number,"")}/2</b>.`,"i"):o}`:n`<div class="form">${t("name",s("שם הלקוח"),{wide:!0})}${t("customer_number",s("מספר לקוח"),{ltr:!0})}${t("tax_id",s("ח.פ. / ע.מ. (לא חובה)"),{ltr:!0,ph:s("לא חובה")})}${t("address",s("כתובת למשלוח החיוב"),{wide:!0})}${t("phone",s("טלפון"),{ltr:!0})}${t("email",s("דוא״ל"),{ltr:!0})}${t("notes",s("הערות"),{wide:!0,ph:s("לא חובה"),area:!0})}</div>`}
      <div class="fld"><label for="an">${s("שם החשבון")}</label><input id="an" name="account_name" data-account-name class="${this.accNameErr?"err":""}" .value=${this.accName} placeholder=${s("למשל: סטודיו אורן - קומה 1")} @input=${i=>{this.accName=i.target.value,this.accNameErr=""}} />
        ${this.accNameErr?n`<div class="msg" role="alert" data-field-error="account_name">${this.accNameErr}</div>`:o}</div>`}renderStep6(){const t=this.tariff(),e=this.cust(),a=this.sampleKwh(),r=t?this.exOf(t):null,i=this.tokens.map(p=>p.t==="m"?this.meters.find(v=>v.id===p.id)?.name??"":p.t==="n"?p.v+(p.pct?"%":""):p.v==="*"?"×":p.v==="-"?"−":p.v).join(" ").replace(/\( /g,"(").replace(/ \)/g,")"),d=this.settings?.payment_terms,l=this.lastPeriod(),h=r&&t?t.current?.price_mode==="inc_vat"?ut(a*r.inc):ut(ut(a*r.ex)+ut(ut(a*r.ex)*r.vat)):0,m=(p,v,$,y,B,bt=!1)=>n`<label class="li ${y?"sel":""} ${bt?"dis":""}"><input type="radio" name=${p} data-opt=${v} .checked=${y} ?disabled=${bt} @change=${B} /><span class="ind"></span><div class="grow t1">${$}</div></label>`;return n`<dl class="kv" data-summary><dt>${s("מונים")}</dt><dd>${this.chosen().map(p=>ot(p).primary).join(", ")}</dd><dt>${s("נוסחה")}</dt><dd>${i}</dd>
        <dt>${s("מחיר")}</dt><dd>${t?n`${t.name}, ${t.kind==="tou"?s("לפי שעות"):u(A(t.current?.price??0)+" ₪")} ${t.current?.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}, ${s("מע״מ")} ${u(this.vat?.current?.rate_percent??"")}%`:""}</dd>
        <dt>${s("תקופה")}</dt><dd>${s("{period}, מה-{day} בחודש, החל מ-",{period:this.months===1?s("חודשית"):s("דו-חודשית"),day:this.anchorDay})}${u(S(this.firstStart))}</dd>
        <dt>${s("לקוח")}</dt><dd>${e.name}, ${s("מספר")} ${u(e.number)}</dd><dt>${s("שם החשבון")}</dt><dd>${this.accName}</dd>
        <dt>${s("תנאי תשלום")}</dt><dd data-payment>${d?d.mode==="net_days"?n`${u(d.days)} ${s("ימים מיום ההפקה")}`:n`${s("ב-")}${u(d.day_of_month)} ${s("בחודש")}`:"-"} <a class="lnk" href=${z.settings("business")}>${s("שינוי בהגדרות")}</a></dd></dl>
      ${a?n`<div class="card soft"><div class="hd"><b class="h3">${s("לפי הנתונים של התקופה האחרונה")}</b></div><div class="row"><span style="font-size:var(--sw-fs-2xl);font-weight:700">${u(g(a))}</span><span class="mut">${s("קוט״ש")}</span><span class="sp"></span>${t?.kind==="tou"?n`<span class="mut">${s("הסכום לפי שעות הצריכה")}</span>`:n`<span style="font-size:var(--sw-fs-2xl);font-weight:700">${u(g(h)+" ₪")}</span>`}</div></div>`:o}
      <div class="fld"><span class="lbl">${s("יצירה אוטומטית בסוף כל תקופה")}</span><div class="list" role="radiogroup" aria-label=${s("יצירה אוטומטית")}>
        ${["draft","issue","off"].map(p=>m("auto",p,pa[p],this.auto===p,()=>this.auto=p))}</div>
        ${this.auto==="issue"?C("warn",s("החיוב יונפק ויקבל מספר בלי בדיקה שלך. אפשר לבטל או לתקן אחר כך.")):o}</div>
      ${this.edit?o:n`<div class="fld"><span class="lbl">${s("אחרי השמירה")}</span><div class="list" role="radiogroup" aria-label=${s("אחרי השמירה")}>
        ${m("after","draft",l?s("שמירה והפקת טיוטה ל{period}",{period:this.months===1?Ie(l.to):$t(l.from,l.to)}):s("שמירה והפקת טיוטה (אין עדיין תקופה שהסתיימה)"),this.afterSave==="draft"&&!!l,()=>this.afterSave="draft",!l)}
        ${m("after","none",s("שמירה בלבד"),this.afterSave==="none"||!l,()=>this.afterSave="none")}</div></div>`}
      ${this.saveErr?C("err",this.saveErr):o}`}async saveTariff(){const t=this.tf,e={};if(t.name.trim()||(e.name=s("צריך לתת שם לתעריף")),Number(t.price)>0||(e.price=s("המחיר חייב להיות מספר גדול מאפס")),q(t.from)||(e.from=s("צריך לבחור תאריך")),Object.keys(e).length){this.tf={...t,err:e};return}this.tf={...t,busy:!0,error:"",err:{}};try{const a=await b().createTariff({name:t.name.trim(),price:t.price,price_mode:t.mode,effective_from:t.from});this.tariffs=[...this.tariffs,a],this.tariffId=a.id,this.tariffOpen=!1,this.tf={...this.tf,name:"",price:"",busy:!1}}catch(a){this.tf={...this.tf,busy:!1,error:M(a),err:Lt(a)}}}renderTariffDialog(){const t=this.tf,e=(a,r)=>this.tf={...this.tf,[a]:r,err:{...this.tf.err,[a]:""}};return n`<elec-dialog heading=${s("תעריף חדש")} ?open=${this.tariffOpen} data-tariff-dialog @close=${()=>this.tariffOpen=!1}>
      <div class="form">
        <div class="fld wide"><label for="tn">${s("שם התעריף")}</label><input id="tn" class="${t.err.name?"err":""}" data-tariff-name .value=${t.name} @input=${a=>e("name",a.target.value)} />${t.err.name?n`<div class="msg" role="alert">${t.err.name}</div>`:o}</div>
        <div class="fld"><label for="tp">${s("מחיר לקוט״ש")}</label><div class="unit"><input id="tp" class="ltr ${t.err.price?"err":""}" data-tariff-price inputmode="decimal" .value=${t.price} @input=${a=>e("price",a.target.value)} /><span>₪</span></div>${t.err.price?n`<div class="msg" role="alert">${t.err.price}</div>`:o}</div>
        <div class="fld"><span class="lbl">${s("המחיר שהוזן")}</span><div class="seg" role="group" aria-label=${s("סוג מחיר")}><button type="button" data-tariff-mode="ex_vat" aria-pressed=${t.mode==="ex_vat"} @click=${()=>this.tf={...t,mode:"ex_vat"}}>${s("לפני מע״מ")}</button><button type="button" data-tariff-mode="inc_vat" aria-pressed=${t.mode==="inc_vat"} @click=${()=>this.tf={...t,mode:"inc_vat"}}>${s("כולל מע״מ")}</button></div></div>
        <div class="fld"><label for="tf">${s("בתוקף מתאריך")}</label><input id="tf" type="date" lang=${ct()} class="ltr ${t.err.from?"err":""}" data-tariff-from .value=${t.from} @change=${a=>e("from",a.target.value)} />${t.err.from?n`<div class="msg" role="alert">${t.err.from}</div>`:o}</div>
      </div>
      ${t.error?C("err",t.error):o}
      <sw-button variant="primary" slot="actions" data-tariff-save ?disabled=${t.busy} @click=${()=>void this.saveTariff()}>${s("שמירה")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.tariffOpen=!1}>${s("ביטול")}</sw-button>
    </elec-dialog>`}render(){if(!R().manage)return n`<div class="page" data-elec="wizard" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לניהול חשבונות"))}</div>`;if(this.loadSt==="loading")return n`<div class="page" data-elec="wizard" data-state="loading">${et(5)}</div>`;if(this.loadSt==="error")return n`<div class="page" data-elec="wizard" data-state="error">${E("error","warning",s("לא ניתן לטעון את האשף"),{label:s("נסה שוב"),run:()=>void this.init()})}</div>`;const e=this.step,a=[this.renderStep1,this.renderStep2,this.renderStep3,this.renderStep4,this.renderStep5,this.renderStep6][e-1].call(this),r=this.canNext();return n`<div class="page" data-elec="wizard" data-state="ready" data-step=${e}>
      <div class="row"><a class="btn ghost sm" href=${this.edit?z.account(this.accountId):z.accounts()} data-back>${this.edit?s("→ לחשבון"):s("→ חשבונות")}</a><b class="h2">${this.edit?s("עריכת חשבון"):s("חשבון חדש")}</b></div>
      <div class="wiz">
        <nav class="card steps" aria-label=${s("שלבי האשף")}>${Ce.map((i,d)=>n`<button type="button" data-step-btn=${d+1} class="${d+1===e?"on":d+1<e?"done":""}" aria-current=${d+1===e?"step":"false"} ?disabled=${d+1>this.reached} @click=${()=>this.goStep(d+1)}><span class="n">${d+1<e?"✓":d+1}</span>${i}</button>`)}</nav>
        <div class="card col" style="gap:14px">
          <div class="pstep"><b>${s("שלב {n} מתוך 6",{n:e})}</b><span class="mut">${Ce[e-1]}</span><div class="bar"><i style="inline-size:${e/6*100}%"></i></div></div>
          <b class="h2 hide-phone" data-step-title>${Ce[e-1]}</b>
          ${a}
          <div class="wfoot">${e>1?n`<sw-button data-prev @click=${()=>this.step=e-1}>${s("הקודם")}</sw-button>`:n`<span></span>`}
            ${e<6?n`<sw-button variant="primary" data-next ?disabled=${!r} @click=${()=>this.next()}>${s("הבא")}</sw-button>`:n`<sw-button variant="primary" data-save ?disabled=${this.saving||!this.accName.trim()} @click=${()=>void this.save()}>${this.edit?s("שמירת שינויים"):this.afterSave==="draft"&&this.draftPossible()?s("שמירה והפקת טיוטה"):s("שמירה")}</sw-button>`}</div>
        </div>
      </div>
      ${this.renderTariffDialog()}${this.renderNumberDialog()}
    </div>`}};x([_()],k.prototype,"accountId",2);x([c()],k.prototype,"loadSt",2);x([c()],k.prototype,"step",2);x([c()],k.prototype,"reached",2);x([c()],k.prototype,"meters",2);x([c()],k.prototype,"tariffs",2);x([c()],k.prototype,"vat",2);x([c()],k.prototype,"settings",2);x([c()],k.prototype,"customers",2);x([c()],k.prototype,"nextNo",2);x([c()],k.prototype,"meterIds",2);x([c()],k.prototype,"tokens",2);x([c()],k.prototype,"formulaValid",2);x([c()],k.prototype,"formulaChecked",2);x([c()],k.prototype,"tariffId",2);x([c()],k.prototype,"tariffOpen",2);x([c()],k.prototype,"tf",2);x([c()],k.prototype,"months",2);x([c()],k.prototype,"anchorDay",2);x([c()],k.prototype,"anchorMonth",2);x([c()],k.prototype,"firstStart",2);x([c()],k.prototype,"custMode",2);x([c()],k.prototype,"custQ",2);x([c()],k.prototype,"existingId",2);x([c()],k.prototype,"nc",2);x([c()],k.prototype,"ncErr",2);x([c()],k.prototype,"accName",2);x([c()],k.prototype,"accNameErr",2);x([c()],k.prototype,"auto",2);x([c()],k.prototype,"afterSave",2);x([c()],k.prototype,"saving",2);x([c()],k.prototype,"saveErr",2);x([c()],k.prototype,"sampleResult",2);x([c()],k.prototype,"numOpen",2);x([c()],k.prototype,"numVal",2);x([c()],k.prototype,"numPct",2);x([c()],k.prototype,"numErr",2);k=x([T("elec-account-wizard")],k);var ei=Object.defineProperty,si=Object.getOwnPropertyDescriptor,qt=(t,e,a,r)=>{for(var i=r>1?void 0:r?si(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&ei(e,a,i),i};let Dt=class extends Y{constructor(){super(...arguments),this.st="loading",this.all=[],this.filter="",this.month="",this.q=""}connectedCallback(){super.connectedCallback(),R().bills&&this.load()}async load(){this.st="loading";try{this.all=(await b().listBills()).items,this.st=this.all.length?"ready":"empty"}catch{this.st="error"}}render(){if(!R().bills)return n`<div class="page" data-elec="bills" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לחיובים"))}</div>`;if(this.st==="loading")return n`<div class="page" data-elec="bills" data-state="loading">${et(7)}</div>`;if(this.st==="error")return n`<div class="page" data-elec="bills" data-state="error">${E("error","warning",s("לא ניתן לטעון את החיובים"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;if(this.st==="empty")return n`<div class="page" data-elec="bills" data-state="empty">${E("empty","bolt",s("אין חיובים עדיין"),{label:s("לחשבונות"),primary:!0,run:()=>Z(I.accounts())})}</div>`;const t=i=>this.all.filter(d=>d.state===i).length,e=[...new Set(this.all.map(i=>i.period.to.slice(0,7)))].sort().reverse(),a=this.q.trim(),r=this.all.filter(i=>(!this.filter||i.state===this.filter)&&(!this.month||i.period.to.startsWith(this.month))&&(!a||(i.number??"").includes(a)||i.customer.name.includes(a)||i.account_name.includes(a)));return n`<div class="page" data-elec="bills" data-state=${r.length?"ready":"filtered-empty"}>
      <div class="row">
        <div class="seg" role="group" aria-label=${s("סינון לפי מצב")} data-state-filter>
          <button type="button" data-filter="" aria-pressed=${this.filter===""} @click=${()=>this.filter=""}>${s("הכול")} ${u(this.all.length)}</button>
          ${ua.map(i=>n`<button type="button" data-filter=${i} aria-pressed=${this.filter===i} @click=${()=>this.filter=i}>${$a[i]} ${u(t(i))}</button>`)}
        </div>
        <span class="sp"></span>
        <select data-month aria-label=${s("חודש")} style="inline-size:auto" @change=${i=>this.month=i.target.value}><option value="">${s("כל החודשים")}</option>${e.map(i=>n`<option value=${i} ?selected=${i===this.month}>${Ie(`${i}-01`)}</option>`)}</select>
        <input type="search" data-search aria-label=${s("חיפוש מספר או לקוח")} placeholder=${s("חיפוש מספר או לקוח")} .value=${this.q} @input=${i=>this.q=i.target.value} />
      </div>
      ${r.length?je(r,{phone:this.phone}):E("empty","search",s("לא נמצאו חיובים"))}
    </div>`}};qt([c()],Dt.prototype,"st",2);qt([c()],Dt.prototype,"all",2);qt([c()],Dt.prototype,"filter",2);qt([c()],Dt.prototype,"month",2);qt([c()],Dt.prototype,"q",2);Dt=qt([T("elec-bills-list")],Dt);var ai=Object.defineProperty,ii=Object.getOwnPropertyDescriptor,Kt=(t,e,a,r)=>{for(var i=r>1?void 0:r?ii(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&ai(e,a,i),i};const V=t=>n`<span class="n">${t}</span>`;let Et=class extends Ot{constructor(){super(...arguments),this.snapshot=null,this.watermark="",this.logo="",this.hash="",this.zoom=1}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(t=>{const e=t[0].contentRect.width-(t[0].contentRect.width<520?16:40),a=Math.max(.3,Math.min(1,e/794));Math.abs(a-this.zoom)>.005&&(this.zoom=a)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}render(){const t=this.snapshot;if(!t)return o;const e=t.business,a=t.totals.total,r=t.bill.due_date??t.bill.expected_due_date,i=t.lines.length>1,d=new Set(t.lines.map($=>`${$.from}|${$.to}`)).size,l=$=>$==="interpolated"||$==="carried",h=t.meters.filter($=>l($.start.kind)||$.end.kind!=="reading"&&$.end.reading_kwh!==null),m=t.history.previous.filter($=>$.kwh!==null),p=m.length?m[m.length-1].kwh:null,v=this.watermark;return n`<div class="wrap" data-elec-paper>
      <div class="box" style="zoom:${this.zoom}">
        <div class="paper" style="--acc:${e.accent_color||"#2767ed"}">
          ${v?n`<div class="wm ${v==="בוטל"?"void":""}" data-watermark>${v}</div>`:o}
          <div class="ph">
            <div>
              <h1>${t.doc.title_he}</h1>
              <div class="sub">${t.doc.subtitle_he}</div>
              <div style="margin-block-start:12px">
                <b>מספר:</b> ${V(t.bill.number??"-")}${t.bill.replaces?n` <span class="sub">(מחליף את ${V(t.bill.replaces.number)})</span>`:o}<br />
                <b>תאריך הפקה:</b> ${V(S(t.bill.issue_date??"")||"-")}
              </div>
            </div>
            <div class="biz">
              <div class="info">
                <b>${e.name}</b><br />
                <span class="sub">${e.registration_no?n`ח.פ. ${V(e.registration_no)}<br />`:o}${e.address}<br />${e.phone?V(e.phone):o}${e.phone&&e.email?" · ":""}${e.email?V(e.email):o}</span>
              </div>
              <div class="logo">${this.logo?n`<img src=${this.logo} alt="" />`:(e.name||"A").slice(0,2)}</div>
            </div>
          </div>
          <div class="two">
            <div class="bx"><b>לכבוד</b><br />${t.customer.name}<br />${t.customer.address}<br />מספר לקוח: ${V(t.customer.customer_number)}<br />חשבון: ${t.account.name}</div>
            <div class="bx">
              <b>תקופת החיוב</b><br />מתאריך ${V(S(t.period.from))} עד תאריך ${V(S(t.period.to))} (${t.period.days} ימים)<br />תעריף: ${t.account.tariff.name}<br />לתשלום עד: ${V(S(r??""))}
            </div>
          </div>
          <div class="big"><span>סה״כ לתשלום</span><b class="n">${g(a)} ₪</b></div>
          <table>
            <thead><tr><th>מונה</th><th class="r">קריאה בתחילת התקופה</th><th class="r">קריאה בסוף התקופה</th><th class="r">צריכה (קוט״ש)</th><th class="r">חלק</th><th class="r">לחיוב (קוט״ש)</th></tr></thead>
            <tbody>
              ${t.meters.map($=>n`<tr data-meter=${$.meter_id}><td>${$.name}</td><td class="r" data-start-kind=${$.start.kind}>${jt($.start.reading_kwh)}</td><td class="r">${jt($.end.reading_kwh)}</td><td class="r">${g($.consumption_kwh)}</td><td class="r">${va(Number($.coefficient))}</td><td class="r">${g($.contribution_kwh)}</td></tr>`)}
            </tbody>
          </table>
          <div class="note">נוסחת החשבון: ${t.account.formula.sentence_he}</div>
          ${h.map($=>{const y=$.end.kind!=="reading"&&$.end.reading_kwh!==null,B=l($.start.kind);return n`<div class="note">${$.name}: ${y?n`קריאת סוף התקופה ב-${V(vs($.end.at))}`:""}${B&&y?"; ":""}${B?n`קריאת תחילת התקופה לפי ${ms($.start.kind)}`:""}.</div>`})}
          <table>
            <thead><tr><th>פירוט</th><th class="r">כמות</th><th class="r">מחיר ליחידה</th><th class="r">סכום (₪)</th></tr></thead>
            <tbody>
              ${t.lines.map($=>n`<tr data-line=${$.band?.id??"flat"}><td>צריכת חשמל${$.band?` - ${$.band.name_he}${$.season?` (${$.season.name_he})`:""}`:""}${($.band?d>1:i)?n` (${V(S($.from))} - ${V(S($.to))})`:o}</td><td class="r">${g($.kwh)} קוט״ש</td><td class="r">${A($.unit_price_ex_vat)} ₪</td><td class="r">${g($.amount_ex_vat)}</td></tr>`)}
              <tr><td>סה״כ לפני מע״מ</td><td></td><td></td><td class="r">${g(t.totals.amount_ex_vat)}</td></tr>
              <tr><td>מע״מ ${V(t.totals.vat_breakdown[0]?.rate_percent??t.lines[0]?.vat_rate_percent??"")}%</td><td></td><td></td><td class="r">${g(t.totals.vat_amount)}</td></tr>
              <tr class="tot"><td>סה״כ לתשלום</td><td></td><td></td><td class="r">${g(a)} ₪</td></tr>
            </tbody>
          </table>
          <div class="note">
            ${t.totals.price_mode_note_he?n`${t.totals.price_mode_note_he}; המחיר לפני מע״מ מוצג מעוגל ל-4 ספרות. `:o}הקריאות הן קריאות מונה מצטברות שנמדדו בפועל; הצריכה של כל מונה היא קריאת הסוף פחות קריאת הפתיחה.${p?n` צריכה בתקופה הקודמת: ${V(g(p))} קוט״ש.`:o}
          </div>
          ${t.notes.map($=>n`<div class="note" data-note=${$.code}>${$.text_he}</div>`)}
          ${e.footer_note?n`<div class="note"><b>הערות:</b> ${e.footer_note}</div>`:o}
          ${Re(t.history)?n`<div class="sec">השוואת צריכה</div><elec-chart print .series=${t.history} table="visible" .height=${190}></elec-chart>`:o}
          <div class="spacer"></div>
          <div class="foot"><span>הופק ב-SmplWise Arx</span><span>עמוד 1 מתוך 1</span><span class="n">${this.hash}</span></div>
        </div>
      </div>
    </div>`}};Et.styles=st`
    ${js}
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
  `;Kt([_({attribute:!1})],Et.prototype,"snapshot",2);Kt([_()],Et.prototype,"watermark",2);Kt([_()],Et.prototype,"logo",2);Kt([_()],Et.prototype,"hash",2);Kt([c()],Et.prototype,"zoom",2);Et=Kt([T("elec-bill-paper")],Et);const Gt=t=>`energy/meters/${encodeURIComponent(t)}`,ri={log:t=>Bs(`${Gt(t)}/manual-readings`),async addReading(t,e){const a=await re(`${Gt(t)}/manual-readings`,e);return{reading:a.reading,log:a.log??null}},undoReading:(t,e,a)=>re(`${Gt(t)}/manual-readings/${encodeURIComponent(e)}/undo`,a?{reason:a}:{}),async addCalibration(t,e){const a=await re(`${Gt(t)}/calibrations`,e);return{calibration:a.calibration,log:a.log??null}},undoCalibration:(t,e,a)=>re(`${Gt(t)}/calibrations/${encodeURIComponent(e)}/undo`,a?{reason:a}:{})},ni={kWh:1e3,Wh:1,MWh:1e6},ks={open_gap:"הקריאה השלימה את הפער מאז הדיווח האחרון. הצריכה עד הקריאה חולקה לפי זמן.",closed_gap:"הקריאה חילקה מחדש את הצריכה בפער הדיווח. הסכום הכולל לא השתנה.",head_gap:"הקריאה נקבעה כקריאת פתיחה לפני הקריאה הראשונה של המונה. הצריכה עד הקריאה הראשונה חולקה לפי זמן.",reported:"המונה דיווח בזמן הזה. הקריאה נשמרה להשוואה בלבד.",outside_counter:"הקריאה שונה מערך המונה במערכת. היא נשמרה להשוואה; לתיקון קבוע אפשר להגדיר כיול.",no_counter_data:"אין במערכת קריאות סביב הזמן הזה. הקריאה נשמרה להשוואה בלבד.",counter_events:"בזמן הזה היה איפוס או קפיצה במונה. הקריאה נשמרה להשוואה בלבד.",implausible:"הקריאה גבוהה מהסביר להספק המרבי של המונה. היא נשמרה להשוואה בלבד.",billed:"התקופה הזו כבר חויבה. הקריאה נשמרה להשוואה בלבד."};function li(t,e=0){const r={meter_id:t,items:[],calibrations:[],calibration:{factor:"1.0",offset_kwh:0,calibration_id:null,effective_date:null,identity:!0},suggestion:null,billed_until:"2026-09-30T21:00:00Z",first_calibration_date:"2026-10-01",undo_window_hours:24},i=(d,l,h,m,p,v,$={})=>({id:d,read_at:l,value_kwh:h,value_wh:Math.round(h*1e3),typed_value:String(h),typed_unit:"kWh",system_kwh:m,system_exact:m!=null,deviation_kwh:m==null?null:Math.round((h-m)*1e3)/1e3,effect:p,effect_reason:v,message:ks[v],note:null,created_at:l,created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!1,undo_until:null,...$});return t==="m1"&&(r.items=[i("r2","2026-10-01T06:10:00Z",247215.6,245830.1,"record","reported"),i("r1","2026-09-01T06:05:00Z",230981,229712.4,"record","reported",{note:"קריאה בלוח הראשי"})],r.calibrations=[{id:"c1",effective_date:"2026-10-02",effective_from:"2026-10-01T21:00:00Z",factor:"1.0",offset_kwh:1385.5,anchor_reading_id:"r2",note:null,in_force:!0,created_at:"2026-10-01T06:20:00Z",created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!1,undo_until:null}],r.calibration={factor:"1.0",offset_kwh:1385.5,calibration_id:"c1",effective_date:"2026-10-02",identity:!1},r.suggestion={factor:"1.0073",from_reading_id:"r1",to_reading_id:"r2",anchor_reading_id:"r2"}),t==="m8"&&(r.items=[i("r3","2026-10-04T17:30:00Z",e||18131.4,null,"allocation","open_gap",{created_at:Ia,can_undo:!0,undo_until:"2026-10-05T18:49:00Z"})]),r}const Se=new Map,It=t=>new Promise(e=>setTimeout(()=>e(t),60)),Mt=t=>JSON.parse(JSON.stringify(t));function xt(t,e,a,r={}){throw new Jt(t,{code:e,user_message:a,retryable:!1,correlation_id:"demo",details:r})}const Zt=t=>(Se.has(t)||Se.set(t,li(t)),Se.get(t)),di={log:t=>It(Mt(Zt(t))),addReading(t,e){const a=Zt(t),r=Number(e.value)*ni[e.unit]/1e3;if(!Number.isFinite(r)||r<0)return xt(422,"validation","הערך אינו מספר.",{fields:["value"]});if(Date.parse(e.read_at)>Date.now()+3e5)return xt(422,"validation","זמן הקריאה בעתיד.",{fields:["read_at"]});const d=a.items.filter(p=>!p.voided_at).filter(p=>p.read_at<e.read_at).sort((p,v)=>p.read_at<v.read_at?1:-1)[0];if(d&&r<d.value_kwh)return xt(422,"reading_not_monotonic","הקריאה נמוכה מקריאה ידנית קודמת של אותו מונה.",{fields:["value"]});const l=t==="m8"?null:1e3,h=t==="m8"?"open_gap":"reported",m={id:e.dry_run?null:`r${Date.now()}`,read_at:e.read_at,value_kwh:r,value_wh:Math.round(r*1e3),typed_value:e.value,typed_unit:e.unit,system_kwh:l,system_exact:l!=null,deviation_kwh:l==null?null:Math.round((r-l)*1e3)/1e3,effect:t==="m8"?"allocation":"record",effect_reason:h,message:ks[h],note:e.note??null,created_at:new Date().toISOString(),created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!0,undo_until:new Date(Date.now()+864e5).toISOString()};return e.dry_run?It({reading:m,log:null}):(a.items=[m,...a.items].sort((p,v)=>p.read_at<v.read_at?1:-1),It({reading:Mt(m),log:Mt(a)}))},undoReading(t,e,a){const r=Zt(t),i=r.items.find(d=>d.id===e);return i?i.can_undo?(Object.assign(i,{voided_at:new Date().toISOString(),voided_by_name:"דנה",void_reason:a??null,can_undo:!1}),It(Mt(r))):xt(409,"undo_window_passed","עבר הזמן שבו אפשר לבטל את הקריאה (24 שעות)."):xt(404,"not_found","הקריאה לא נמצאה.")},addCalibration(t,e){const a=Zt(t),r=Number(e.factor);if(!Number.isFinite(r)||r<.5||r>2)return xt(422,"validation","המקדם חייב להיות בין 0.5 ל-2.",{fields:["factor"]});if(a.first_calibration_date&&e.effective_date<a.first_calibration_date)return xt(409,"calibration_billed","התקופה הזו כבר חויבה. אפשר לכייל רק מ-"+a.first_calibration_date.split("-").reverse().join(".")+" והלאה.");const i=a.items.find(h=>h.id===e.anchor_reading_id),d=i&&i.system_kwh!=null?Math.round((i.value_kwh-r*i.system_kwh)*1e3)/1e3:Number(e.offset_kwh??0),l={id:e.dry_run?null:`c${Date.now()}`,effective_date:e.effective_date,effective_from:`${e.effective_date}T00:00:00Z`,factor:String(r),offset_kwh:d,anchor_reading_id:e.anchor_reading_id??null,note:e.note??null,in_force:!1,created_at:new Date().toISOString(),created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!0,undo_until:new Date(Date.now()+864e5).toISOString()};return e.dry_run?It({calibration:l,log:null}):(a.calibrations=[l,...a.calibrations],It({calibration:Mt(l),log:Mt(a)}))},undoCalibration(t,e,a){const r=Zt(t),i=r.calibrations.find(d=>d.id===e);return i?(Object.assign(i,{voided_at:new Date().toISOString(),voided_by_name:"דנה",void_reason:a??null,can_undo:!1,in_force:!1}),It(Mt(r))):xt(404,"not_found","הכיול לא נמצא.")}},ee=()=>Ls()?ri:di,oi=t=>ee().log(t),Me=(t,e)=>ee().addReading(t,e),ci=(t,e,a)=>ee().undoReading(t,e,a),as=(t,e)=>ee().addCalibration(t,e),hi=(t,e,a)=>ee().undoCalibration(t,e,a);function ce(t){const e=t.trim().replace(/[\s ]/g,"").replace(/,(?=\d{3}(\D|$))/g,"").replace(",",".");return/^\d+(\.\d+)?$/.test(e)?e:null}function pi(t){const e=t.trim().replace(",",".");if(!/^\d+(\.\d{1,6})?$/.test(e))return null;const a=Number(e);return a>=.5&&a<=2?e:null}function ui(t){if(!t)return null;const e=new Date(t);return Number.isNaN(e.getTime())?null:e.toISOString()}function Oe(t){const e=a=>String(a).padStart(2,"0");return`${t.getFullYear()}-${e(t.getMonth()+1)}-${e(t.getDate())}T${e(t.getHours())}:${e(t.getMinutes())}`}const $i={open_gap:gt("השלימה פער"),closed_gap:gt("חילקה פער"),head_gap:gt("קריאת פתיחה"),reported:gt("להשוואה"),outside_counter:gt("להשוואה"),no_counter_data:gt("להשוואה"),counter_events:gt("להשוואה"),implausible:gt("להשוואה"),billed:gt("להשוואה")};var vi=Object.defineProperty,mi=Object.getOwnPropertyDescriptor,F=(t,e,a,r)=>{for(var i=r>1?void 0:r?mi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&vi(e,a,i),i};const is={email:s("דוא״ל"),hand:s("מסירה ידנית"),other:s("אחר")};let L=class extends Y{constructor(){super(...arguments),this.billId="",this.st="loading",this.bill=null,this.events=[],this.dlg="",this.busy=!1,this.error="",this.pdfFail=null,this.reason="",this.reasonTouched=!1,this.date="",this.how="email",this.text="",this.openingMeter=null,this.openingInfo="",this.daily=!1,this.loaded=""}willUpdate(t){t.has("billId")&&this.billId&&this.loaded!==this.billId&&(this.loaded=this.billId,this.load())}async load(){this.st="loading",this.pdfFail=null;try{const[t,e]=await Promise.all([b().getBill(this.billId),b().billEvents(this.billId).catch(()=>[])]);this.bill=t,this.events=e,this.st="ready"}catch(t){this.error=M(t),this.st=he(t)==="forbidden"?"forbidden":"error"}}async refreshEvents(){this.events=await b().billEvents(this.billId).catch(()=>this.events)}open(t){this.dlg=t,this.error="",this.reason="",this.reasonTouched=!1,this.text="",this.date=tt(),this.how="email"}close(){this.dlg=""}async act(t,e){if(!this.busy){this.busy=!0,this.error="";try{const a=await t();a&&(this.bill=a),this.close(),await this.refreshEvents(),e?.(a)}catch(a){this.error=M(a)}finally{this.busy=!1}}}issue(){const t=this.bill;this.act(()=>b().issueBill(t),()=>{this.pdf("check")})}async pdf(t){const e=this.bill;this.pdfFail=null;try{const a=await b().fetchPdf(e.id);if(e.state!=="draft"&&e.pdf&&e.pdf.state!=="stored"&&(this.bill=await b().getBill(e.id).catch(()=>this.bill)),t==="check")return;const r=URL.createObjectURL(a);if(t==="view")window.open(r,"_blank","noopener");else{const i=document.createElement("a");i.href=r,i.download=`${e.number??`draft-${e.id}`}.pdf`,i.click()}window.setTimeout(()=>URL.revokeObjectURL(r),3e4)}catch(a){this.pdfFail={code:he(a),text:M(a)}}}btn(t,e){switch(t){case"issue":return n`<sw-button variant="primary" data-act="issue" @click=${()=>this.open("issue")}>${s("הנפקה")}</sw-button>`;case"sent":return n`<sw-button variant=${e.state==="issued"?"primary":"secondary"} data-act="sent" @click=${()=>this.open("sent")}>${s("סימון כנשלח")}</sw-button>`;case"paid":return n`<sw-button variant=${e.state==="sent"?"primary":"secondary"} data-act="paid" @click=${()=>this.open("paid")}>${s("סימון כשולם")}</sw-button>`;case"recalculate":return n`<sw-button data-act="recalculate" ?disabled=${this.busy} @click=${()=>void this.act(()=>b().recalcBill(e))}>${s("חישוב מחדש")}</sw-button>`;case"pdf":return e.state==="draft"?n`<sw-button data-act="pdf" @click=${()=>void this.pdf("view")}>${s("תצוגת PDF")}</sw-button>`:n`<sw-button data-act="pdf" @click=${()=>void this.pdf("download")}>${s("הורדת PDF")}</sw-button>`;case"correct":return n`<sw-button data-act="correct" @click=${()=>this.open("correct")}>${s("תיקון")}</sw-button>`;case"void":return n`<sw-button variant="danger" data-act="void" @click=${()=>this.open("void")}>${s("ביטול")}</sw-button>`;case"delete":return n`<sw-button variant="danger" data-act="delete" @click=${()=>this.open("delete")}>${s("מחיקת טיוטה")}</sw-button>`;default:return o}}render(){if(!R().bills)return n`<div class="page" data-elec="bill" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לחיובים"))}</div>`;if(this.st==="loading")return n`<div class="page" data-elec="bill" data-state="loading">${et(4)}</div>`;if(this.st!=="ready"||!this.bill)return n`<div class="page" data-elec="bill" data-state=${this.st}><div class="row"><a class="btn ghost sm" href=${z.bills()}>${s("→ חיובים")}</a></div>${E(this.st==="forbidden"?"forbidden":"error",this.st==="forbidden"?"lock":"warning",this.error||s("לא ניתן לטעון את החיוב"),this.st==="error"?{label:s("נסה שוב"),run:()=>void this.load()}:void 0)}</div>`;const t=this.bill,e=t.snapshot,a=t.state==="draft"?"טיוטה":t.state==="void"?"בוטל":"",r=n`${t.actions.map(l=>this.btn(l,t))}`,i=t.state==="draft"?e.notes.filter(l=>l.code==="meter_not_reporting"||l.code==="carried_in"):[],d=n`<div class="card"><div class="hd"><b class="h3">${s("פרטים")}</b></div><dl class="kv" data-bill-details>
        <dt>${s("חשבון")}</dt><dd><a class="lnk" href=${z.account(t.account_id)}>${t.account_name}</a></dd><dt>${s("לקוח")}</dt><dd>${t.customer.name}</dd>
        <dt>${s("תקופה")}</dt><dd>${u(S(t.period.from))} - ${u(S(t.period.to))}</dd>
        ${t.issue_date?n`<dt>${s("הונפק")}</dt><dd>${u(S(t.issue_date))}</dd>`:o}${t.due_date?n`<dt>${s("לתשלום עד")}</dt><dd>${u(S(t.due_date))}</dd>`:o}
        ${t.sent?n`<dt>${s("נשלח")}</dt><dd><span class="num" data-sent-at>${S(t.sent.at)}</span> · ${is[t.sent.how]}</dd>`:o}${t.paid?n`<dt>${s("שולם")}</dt><dd><span class="num" data-paid-at>${S(t.paid.at)}</span>${t.paid.reference?n` · ${u(t.paid.reference)}`:o}</dd>`:o}
        <dt>${s("מקור")}</dt><dd>${t.origin==="auto"?s("נוצר אוטומטית"):s("נוצר ידנית")}</dd></dl></div>
      ${this.openingCard(t)}
      ${this.touCard(e)}
      <div class="card"><div class="hd"><b class="h3">${s("יומן")}</b></div><div class="list" data-bill-log>${this.events.map(l=>n`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${vs(l.at)}</span><span>${l.text}</span></div>`)}</div></div>`;return n`<div class="page" data-elec="bill" data-state="ready" data-bill-state=${t.state} data-bill-id=${t.id}>
      <div class="row"><a class="btn ghost sm" href=${z.bills()} data-back>${s("→ חיובים")}</a></div>
      <div class="row"><b class="h2 num" data-bill-number>${t.number??s("טיוטה")}</b>${Xt(t.state)}
        ${t.replaces_bill_id&&e.bill.replaces?n`<span class="mut">${s("מחליף את")} <a class="lnk num" href=${z.bill(t.replaces_bill_id)}>${e.bill.replaces.number}</a></span>`:o}
        ${t.replaced_by_bill_id?n`<span class="mut">${s("הוחלף בחיוב")} <a class="lnk" href=${z.bill(t.replaced_by_bill_id)}>${s("המתוקן")}</a></span>`:o}
        <span class="sp"></span>${this.phone?o:r}</div>
      ${this.phone?n`<div class="row" data-actions>${r}</div>`:o}
      ${this.pdfNotice(t)}
      ${t.state==="void"&&t.void?C("err",n`<b>${s("בוטל:")}</b> ${t.void.reason}`):o}
      ${i.map(l=>C("warn",l.text_he))}
      <div class="cols side-l"><div style="min-inline-size:0"><elec-bill-paper .snapshot=${e} watermark=${a} .hash=${(t.snapshot_sha256??"").slice(0,12).replace(/(.{4})/g,"$1 ").trim()} .logo=${this.logoSrc()}></elec-bill-paper></div><div class="col">${d}</div></div>
      ${this.daily&&e.tou?this.dailyTable(e.tou):o}
      ${this.dialogs(t)}
    </div>`}openingCard(t){const e=t.snapshot.period.start_utc,a=t.snapshot.meters.filter(r=>r.start.kind==="first_reading"||r.start.kind==="none");return t.state!=="draft"||!e||!a.length||!R().manage?o:n`<div class="card" data-card="opening"><div class="hd"><b class="h3">${s("קריאת פתיחה")}</b></div>
      <div class="list">${a.map(r=>n`<div class="row" data-opening-meter=${r.meter_id} style="flex-wrap:nowrap"><div class="grow"><div class="b">${r.name}</div><div class="mut">${r.start.reading_kwh===null?jt(null):n`${u(jt(r.start.reading_kwh))} · ${ms(r.start.kind)}`}</div></div>
        <sw-button size="sm" data-opening-enter @click=${()=>this.openOpening(r)}>${s("הזנה")}</sw-button></div>`)}</div></div>`}openOpening(t){this.open("opening"),this.openingMeter=t,this.openingInfo=""}async saveOpening(){const t=this.bill,e=this.openingMeter,a=ce(this.text),r=t.snapshot.period.start_utc;if(!(!e||a===null||!r||this.busy)){this.busy=!0,this.error="";try{const i=await Me(e.meter_id,{read_at:r,value:a,unit:"kWh",note:this.reason.trim()||void 0});if(i.reading.effect!=="allocation"){this.openingInfo=i.reading.message;return}this.bill=await b().recalcBill(t),this.close(),await this.refreshEvents()}catch(i){this.error=M(i)}finally{this.busy=!1}}}touCard(t){const e=t.tou;return e?n`<div class="card" data-card="tou"><div class="hd"><b class="h3">${s("לפי שעות")}</b><span class="sp"></span>
        <button type="button" class="btn ghost sm" data-tou-daily aria-expanded=${this.daily?"true":"false"} @click=${()=>this.daily=!this.daily}>${this.daily?s("הסתרת הפירוט היומי"):s("פירוט יומי")}</button></div>
      <div class="scrollx"><table class="t" data-tou-bands><thead><tr><th>${s("פס")}</th><th class="num">${s("שעות")}</th><th class="num">${s("קוט״ש")}</th><th class="num">${s("לפני מע״מ")}</th></tr></thead>
        <tbody>${e.by_band.map(a=>n`<tr data-band=${a.band.id}><td class="b">${j("bands",a.band,e.names_en)}</td><td class="num">${g(a.hours)}</td><td class="num">${g(a.kwh)}</td><td class="num">${g(a.amount_ex_vat)} ₪</td></tr>`)}</tbody></table></div>
      ${e.special_days.some(a=>a.kind!=="regular")?n`<div class="mut" style="margin-block-start:8px">${s("ימים מיוחדים:")} ${e.special_days.filter(a=>a.kind!=="regular").map(a=>`${S(a.date)} ${a.name_he}`).join(", ")}</div>`:o}</div>`:o}dailyTable(t){const a=Object.keys(t.names.bands).filter(r=>t.daily.some(i=>i.bands.some(d=>d.band===r)));return n`<div class="card flush" data-tou-daily-table><div class="hd"><b class="h3">${s("פירוט יומי לפי שעות (קוט״ש)")}</b><span class="sp"></span><span class="mut">${s("לעיון; כל ערך מעוגל בנפרד")}</span></div>
      <div class="scrollx"><table class="t"><thead><tr><th>${s("תאריך")}</th><th>${s("סוג יום")}</th>${a.map(r=>n`<th class="num">${j("bands",{id:r,name_he:t.names.bands[r]},t.names_en)}</th>`)}<th class="num">${s("סה״כ")}</th></tr></thead>
        <tbody>${t.daily.map(r=>n`<tr data-day=${r.date}><td class="num" style="text-align:start">${S(r.date)}</td><td>${t.names.day_types[r.day_type]!==void 0?j("day_types",{id:r.day_type,name_he:t.names.day_types[r.day_type]},t.names_en):r.day_type}${r.special?n` <span class="chip c-acc nodot">${r.special.name_he}</span>`:o}</td>
          ${a.map(i=>{const d=r.bands.find(l=>l.band===i);return n`<td class="num">${d?g(d.kwh):""}</td>`})}<td class="num b">${g(r.kwh)}</td></tr>`)}</tbody></table></div></div>`}pdfNotice(t){const e=t.pdf?.state,a=t.pdf?.error_code||"pdf_render_failed",r=this.pdfFail??(e==="failed"?{code:a,text:xe[a]??xe.pdf_render_failed}:e==="unavailable"?{code:"pdf_unavailable",text:xe.pdf_unavailable}:null);if(!r)return o;const i=ma.includes(r.code),d=r.code==="pdf_unavailable"?"unavailable":"failed";return n`<div class="alert ${i?"err":"warn"}" role="alert" data-pdf-error data-pdf-state=${d} data-pdf-code=${r.code}><span class="x" aria-hidden="true">!</span><div>${r.text}</div>${i?n`<sw-button size="sm" data-pdf-retry @click=${()=>void this.pdf(t.state==="draft"?"view":"download")}>${s("הפקת PDF מחדש")}</sw-button>`:o}</div>`}logoSrc(){const t=this.bill.snapshot.business.logo;return t?b().logoUrl(t.sha256):""}dialogs(t){const e=this.error?C("err",this.error):o,a=(d=s("ביטול"))=>n`<sw-button slot="actions" @click=${()=>this.close()}>${d}</sw-button>`,r=`${fa(t.number??"")}-${t.revision+1}`,i=!this.reason.trim();return n`
      <elec-dialog heading=${s("הנפקת חיוב")} ?open=${this.dlg==="issue"} data-dialog="issue" @close=${()=>this.close()}>
        <div>${s("החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.")}</div>
        <dl class="kv"><dt>${s("חשבון")}</dt><dd>${t.account_name}</dd><dt>${s("תקופה")}</dt><dd>${u($t(t.period.from,t.period.to))}</dd><dt>${s("סה״כ לתשלום")}</dt><dd>${u(g(t.total)+" ₪")}</dd></dl>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>this.issue()}>${s("הנפקה")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("ביטול חיוב {no}",{no:t.number??""})} ?open=${this.dlg==="void"} data-dialog="void" @close=${()=>this.close()}>
        <div>${s("החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.")}</div>
        <div class="fld"><label for="vr">${s("סיבת הביטול")}</label>
          <textarea id="vr" data-reason class="${i&&this.reasonTouched?"err":""}" aria-required="true" placeholder=${s("חובה")} .value=${this.reason} @input=${d=>{this.reason=d.target.value,this.reasonTouched=!0}} @blur=${()=>this.reasonTouched=!0}></textarea>
          ${i&&this.reasonTouched?n`<div class="msg" role="alert" data-reason-error>${s("צריך לכתוב סיבה")}</div>`:o}</div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy||i} @click=${()=>void this.act(()=>b().voidBill(t.id,this.reason))}>${s("ביטול החיוב")}</sw-button>${a(s("חזרה"))}
      </elec-dialog>
      <elec-dialog heading=${s("תיקון חיוב")} ?open=${this.dlg==="correct"} data-dialog="correct" @close=${()=>this.close()}>
        <div>${s("תיווצר טיוטה מתוקנת")}${t.number?n` ${s("עם המספר")} <b class="num">${r}</b>`:""}. ${s("כשהיא תונפק, החיוב")} ${u(t.number??"")} ${s("יבוטל אוטומטית.")}</div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{const d=await b().correctBill(t.id);Z(I.bill(d.id)),this.billId=d.id})}>${s("יצירת טיוטה מתוקנת")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("סימון כנשלח")} ?open=${this.dlg==="sent"} data-dialog="sent" @close=${()=>this.close()}>
        <div class="form">
          <div class="fld"><label for="sd">${s("תאריך משלוח")}</label><input id="sd" type="date" lang=${ct()} class="ltr ${q(this.date)?"":"err"}" data-date .value=${this.date} @change=${d=>this.date=d.target.value} /></div>
          <div class="fld"><span class="lbl">${s("אופן משלוח")}</span><div class="seg" role="group" aria-label=${s("אופן משלוח")}>${["email","hand","other"].map(d=>n`<button type="button" data-how=${d} aria-pressed=${this.how===d} @click=${()=>this.how=d}>${is[d]}</button>`)}</div></div>
        </div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy||!q(this.date)} @click=${()=>void this.act(()=>b().markSent(t.id,{at:this.date,how:this.how,note:"",row_version:t.row_version}))}>${s("שמירה")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("סימון כשולם")} ?open=${this.dlg==="paid"} data-dialog="paid" @close=${()=>this.close()}>
        <div class="form">
          <div class="fld"><label for="pd">${s("תאריך תשלום")}</label><input id="pd" type="date" lang=${ct()} class="ltr ${q(this.date)?"":"err"}" data-date .value=${this.date} @change=${d=>this.date=d.target.value} /></div>
          <div class="fld"><label for="pr">${s("אסמכתה (לא חובה)")}</label><input id="pr" class="ltr" data-reference placeholder=${s("לא חובה")} .value=${this.text} @input=${d=>this.text=d.target.value} /></div>
        </div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy||!q(this.date)} @click=${()=>void this.act(()=>b().markPaid(t.id,{at:this.date,reference:this.text.trim(),row_version:t.row_version}))}>${s("שמירה")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("קריאת פתיחה - {name}",{name:this.openingMeter?.name??""})} ?open=${this.dlg==="opening"} data-dialog="opening" @close=${()=>this.close()}>
        <div>${s("מה הראה המונה ב-")}${u(S(t.period.from))} ${s("בשעה 00:00. הצריכה מאז ועד הקריאה הראשונה שנקלטה תתווסף לחיוב.")}</div>
        <div class="form">
          <div class="fld"><label for="ov">${s("קריאה (קוט״ש)")}</label><input id="ov" class="ltr ${this.text&&ce(this.text)===null?"err":""}" inputmode="decimal" data-opening-value .value=${this.text} @input=${d=>this.text=d.target.value} /></div>
          <div class="fld"><label for="on">${s("הערה (לא חובה)")}</label><input id="on" data-opening-note placeholder=${s("לא חובה")} .value=${this.reason} @input=${d=>this.reason=d.target.value} /></div>
        </div>${this.openingInfo?C("warn",this.openingInfo):o}${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy||ce(this.text)===null} @click=${()=>void this.saveOpening()}>${s("שמירה וחישוב מחדש")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("מחיקת טיוטה")} ?open=${this.dlg==="delete"} data-dialog="delete" @close=${()=>this.close()}>
        <div>${s("הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.")}</div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{await b().deleteDraft(t),Z(I.bills())})}>${s("מחיקה")}</sw-button>${a()}
      </elec-dialog>`}};F([_()],L.prototype,"billId",2);F([c()],L.prototype,"st",2);F([c()],L.prototype,"bill",2);F([c()],L.prototype,"events",2);F([c()],L.prototype,"dlg",2);F([c()],L.prototype,"busy",2);F([c()],L.prototype,"error",2);F([c()],L.prototype,"pdfFail",2);F([c()],L.prototype,"reason",2);F([c()],L.prototype,"reasonTouched",2);F([c()],L.prototype,"date",2);F([c()],L.prototype,"how",2);F([c()],L.prototype,"text",2);F([c()],L.prototype,"openingMeter",2);F([c()],L.prototype,"openingInfo",2);F([c()],L.prototype,"daily",2);L=F([T("elec-bill-page")],L);var fi=Object.defineProperty,bi=Object.getOwnPropertyDescriptor,J=(t,e,a,r)=>{for(var i=r>1?void 0:r?bi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&fi(e,a,i),i};let U=class extends Y{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams,this.st="loading",this.list=[],this.q="",this.card=null,this.cardSt="loading",this.form=Ge(),this.errs={},this.busy=!1,this.error="",this.confirmDel=!1,this.shown=""}connectedCallback(){super.connectedCallback(),R().bills&&this.loadList()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?(this.card=null,this.cardSt="ready",this.form=Ge(),b().nextCustomerNumber().then(a=>this.form={...this.form,customer_number:a}).catch(()=>{})):this.loadCard(e):this.card=null)}async loadList(){this.st="loading";try{this.list=await b().listCustomers(),this.st=this.list.length?"ready":"empty"}catch{this.st="error"}}async loadCard(t){this.cardSt="loading";try{const e=await b().getCustomer(t);this.card=e,this.form=ba(e),this.cardSt="ready"}catch{this.cardSt="error"}}close(){Z(I.customers())}validate(){const t={name:s("צריך לכתוב שם ללקוח"),email:s("כתובת דוא״ל לא תקינה"),customer_number:s("מספר לקוח הוא ספרות בלבד")},e={};for(const a of ga(this.form,{numberRequired:!0}))e[a]=t[a];return this.errs=e,!Object.keys(e).length}async save(){if(!(this.busy||!this.validate())){this.busy=!0,this.error="";try{if(this.card)this.card=await b().updateCustomer(this.card.id,this.card.revision,Ze(this.form,this.card));else{const t=await b().createCustomer(Ze(this.form));await this.loadList(),Z(I.customer(t.id));return}await this.loadList()}catch(t){const e=Lt(t);Object.keys(e).length?this.errs=e:this.error=M(t)}finally{this.busy=!1}}}async removeCustomer(){if(!(!this.card||this.busy)){this.busy=!0;try{await b().deleteCustomer(this.card.id,this.card.revision),this.confirmDel=!1,await this.loadList(),this.close()}catch(t){this.confirmDel=!1,this.error=M(t)}finally{this.busy=!1}}}field(t,e,a={}){return ya(t,{idPrefix:"f-",label:e,value:this.form[t],error:this.errs[t],readonly:a.ro||!R().manage,wide:a.wide,ltr:a.ltr,area:a.area,placeholder:a.ph??"",onInput:r=>{this.form={...this.form,[t]:r},!a.area&&this.errs[t]&&(this.errs={...this.errs,[t]:""})}})}renderCard(){const t=R(),e=this.card;return n`<sw-sheet open wide .heading=${e?s("כרטיס לקוח"):s("לקוח חדש")} data-customer-card @close=${()=>this.close()}>
        <div class="col" style="gap:14px">
        ${this.cardSt==="loading"?et(4):this.cardSt==="error"?E("error","warning",s("לא ניתן לטעון את הלקוח"),{label:s("נסה שוב"),run:()=>void this.loadCard(this.segments[0])}):n`
          <div class="form">${this.field("name",s("שם הלקוח"),{wide:!0})}${this.field("customer_number",s("מספר לקוח"),{ltr:!0})}${this.field("tax_id",s("ח.פ. / ע.מ. (לא חובה)"),{ltr:!0,ph:s("לא חובה")})}
            ${this.field("address",s("כתובת למשלוח החיוב"),{wide:!0})}${this.field("phone",s("טלפון"),{ltr:!0})}${this.field("email",s("דוא״ל"),{ltr:!0})}${this.field("notes",s("הערות"),{wide:!0,ph:s("לא חובה"),area:!0})}</div>
          ${e?n`<b class="h3">${s("חשבונות")}</b>
            <div class="list" data-customer-accounts>${(e.accounts??[]).map(a=>n`<a class="li" href=${z.account(a.id)}><div class="grow"><div class="t1">${a.name}</div></div></a>`)}${e.accounts?.length?o:n`<div class="mut">${s("אין חשבונות ללקוח")}</div>`}</div>
            ${e.bills?.length?n`<b class="h3">${s("חיובים אחרונים")}</b>${je(e.bills.slice(0,4),{phone:!0})}`:o}`:o}
          ${this.error?C("err",this.error):o}
          ${t.manage?n`<div class="row"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button><span class="sp"></span>${e?n`<sw-button variant="danger" data-delete @click=${()=>this.confirmDel=!0}>${s("מחיקת לקוח")}</sw-button>`:o}</div>`:o}`}
        <elec-dialog heading=${s("מחיקת לקוח")} ?open=${this.confirmDel} data-dialog="delete-customer" @close=${()=>this.confirmDel=!1}>
          <div>${s("הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.")}</div>
          <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeCustomer()}>${s("מחיקה")}</sw-button>
          <sw-button slot="actions" @click=${()=>this.confirmDel=!1}>${s("ביטול")}</sw-button>
        </elec-dialog>
        </div>
      </sw-sheet>`}render(){const t=R();if(!t.bills)return n`<div class="page" data-elec="customers" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה ללקוחות"))}</div>`;const e=this.list.filter(r=>wa(r,this.q));let a;return this.st==="loading"?a=et(5):this.st==="error"?a=E("error","warning",s("לא ניתן לטעון את הלקוחות"),{label:s("נסה שוב"),run:()=>void this.loadList()}):this.st==="empty"?a=E("empty","user",s("אין לקוחות עדיין"),t.manage?{label:s("+ לקוח חדש"),primary:!0,run:()=>Z(`${I.customers()}/new`)}:void 0):e.length?a=n`<div class="grid-cards" data-elec-list>${e.map(r=>n`<div class="card" data-customer-row=${r.id}>
        <div class="row" style="flex-wrap:nowrap"><div class="chip c-acc nodot" style="inline-size:36px;block-size:36px;justify-content:center;padding:0" aria-hidden="true">${r.name.slice(0,2)}</div><div style="min-inline-size:0"><a class="rowlink h3" href=${z.customer(r.id)}>${r.name}</a><div class="mut">${s("מספר לקוח")} ${u(r.customer_number)}</div></div></div>
        <dl class="kv" style="margin-block-start:10px"><dt>${s("חשבונות")}</dt><dd>${r.account_count}</dd>${r.phone?n`<dt>${s("טלפון")}</dt><dd>${u(r.phone)}</dd>`:o}${r.email?n`<dt>${s("דוא״ל")}</dt><dd>${u(r.email)}</dd>`:o}</dl></div>`)}</div>`:a=E("empty","search",s("לא נמצאו לקוחות")),n`<div class="page" data-elec="customers" data-state=${this.st}>
      <div class="row"><input type="search" data-search aria-label=${s("חיפוש לקוח")} placeholder=${s("חיפוש לקוח")} .value=${this.q} @input=${r=>this.q=r.target.value} /><span class="sp"></span>
        ${t.manage?n`<a class="btn pri ${this.phone?"sm":""}" data-new-customer href=${`#${I.customers()}/new`}>${s("+ לקוח חדש")}</a>`:o}</div>
      ${a}
      ${this.segments[0]?this.renderCard():o}
    </div>`}};U.styles=[yt];J([_({attribute:!1})],U.prototype,"segments",2);J([_({attribute:!1})],U.prototype,"params",2);J([c()],U.prototype,"st",2);J([c()],U.prototype,"list",2);J([c()],U.prototype,"q",2);J([c()],U.prototype,"card",2);J([c()],U.prototype,"cardSt",2);J([c()],U.prototype,"form",2);J([c()],U.prototype,"errs",2);J([c()],U.prototype,"busy",2);J([c()],U.prototype,"error",2);J([c()],U.prototype,"confirmDel",2);U=J([T("elec-customers-page")],U);var gi=Object.defineProperty,yi=Object.getOwnPropertyDescriptor,Ut=(t,e,a,r)=>{for(var i=r>1?void 0:r?yi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&gi(e,a,i),i};const rs=Array.from({length:97},(t,e)=>_a(e*15)),ns=/^\d{2}-\d{2}$/;let Ct=class extends Y{constructor(){super(...arguments),this.definition=null,this.readonly=!1,this.errorPath="",this.priceMode="ex_vat",this.vatRate=null}emit(t){this.definition=t,this.dispatchEvent(new CustomEvent("tou-change",{detail:t,bubbles:!0,composed:!0}))}edit(t){if(!this.definition||this.readonly)return;const e=le(this.definition);t(e),this.emit(e)}bad(t){return this.errorPath&&(this.errorPath===t||this.errorPath.startsWith(t+"[")||this.errorPath.startsWith(t+"."))?"err-on":""}bandName(t){const e=this.definition?.bands.find(a=>a.id===t);return e?j("bands",e):t}prices(t){const e=this.vatRate;return n`<div class="card flush" data-tou-prices>
      <div class="hd"><b class="h3">${s("מחירים לקוט״ש")}</b><span class="sp"></span><span class="hint">${this.priceMode==="inc_vat"?s("המחירים כוללים מע״מ"):s("המחירים לפני מע״מ")}</span></div>
      <div class="scrollx"><table class="t">
        <thead><tr><th>${s("פס")}</th>${t.seasons.map(a=>n`<th>${j("seasons",a)}</th>`)}</tr></thead>
        <tbody>${t.bands.map(a=>n`<tr><td class="b"><span class="sw" style="background:${ne(t,a.id)}"></span>${j("bands",a)}${a.id===t.default_band?n` <span class="hint">(${s("שאר השעות")})</span>`:o}</td>
          ${t.seasons.map(r=>{const i=ka(t,r.id).includes(a.id),d=t.prices[r.id]?.[a.id]??"",l=`prices.${r.id}.${a.id}`;if(!i&&(d===""||d===null))return n`<td class="pc"><span class="hint">-</span></td>`;const h=Number(d),m=e!==null&&d!==""&&Number.isFinite(h)?this.priceMode==="ex_vat"?h*(1+e):h/(1+e):null;return n`<td class="pc"><div class="unit"><input class="ltr ${this.bad(l)?"err":""}" inputmode="decimal" aria-label=${s("{band} ב{season}",{band:j("bands",a),season:j("seasons",r)})} data-tou-price=${`${r.id}:${a.id}`} .value=${d??""} ?disabled=${this.readonly}
              @input=${p=>this.edit(v=>{(v.prices[r.id]??={})[a.id]=p.target.value.trim()||null})} /><span>₪</span></div>
              ${m!==null?n`<div class="hint">${this.priceMode==="ex_vat"?s("כולל מע״מ"):s("לפני מע״מ")} ${u(A(m))}</div>`:o}</td>`})}</tr>`)}</tbody>
      </table></div>
    </div>`}dayRow(t,e,a,r,i){const d=t.schedule[e]?.[a]??[],l=t.bands.filter(v=>v.id!==t.default_band),h=i[e]?.[a]??[],m=(v,$)=>(Number($.slice(0,2))*60+Number($.slice(3))-(Number(v.slice(0,2))*60+Number(v.slice(3))))/1440*100,p=`schedule.${e}.${a}`;return n`<div class="b">${r}</div>
      <div class="day ${this.bad(p)}" data-tou-day=${`${e}:${a}`}>
        <div class="bar" role="img" aria-label=${`${r}: `+h.map(v=>`${v.from}-${v.to} ${this.bandName(v.band)}`).join(", ")}>${h.map(v=>n`<i style="inline-size:${m(v.from,v.to)}%;background:${ne(t,v.band)}" title=${`${v.from}-${v.to} ${this.bandName(v.band)}`} data-cell=${v.band}></i>`)}</div>
        <div class="ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        ${d.map((v,$)=>n`<div class="rng" data-tou-range=${`${e}:${a}:${$}`}>
          <select aria-label=${s("משעה")} ?disabled=${this.readonly} @change=${y=>this.edit(B=>{B.schedule[e][a][$][0]=y.target.value})}>${rs.slice(0,96).map(y=>n`<option .selected=${y===v[0]} value=${y}>${y}</option>`)}</select>
          <span>${s("עד")}</span>
          <select aria-label=${s("עד שעה")} ?disabled=${this.readonly} @change=${y=>this.edit(B=>{B.schedule[e][a][$][1]=y.target.value})}>${rs.slice(1).map(y=>n`<option .selected=${y===v[1]} value=${y}>${y}</option>`)}</select>
          <select aria-label=${s("פס")} ?disabled=${this.readonly} @change=${y=>this.edit(B=>{B.schedule[e][a][$][2]=y.target.value})}>${t.bands.map(y=>n`<option .selected=${y.id===v[2]} value=${y.id}>${j("bands",y)}</option>`)}</select>
          ${this.readonly?o:n`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת טווח")} data-tou-remove @click=${()=>this.edit(y=>{y.schedule[e][a].splice($,1),y.schedule[e][a].length||delete y.schedule[e][a]})}></sw-button>`}
        </div>`)}
        ${this.readonly||!l.length?o:n`<div><sw-button variant="ghost" size="sm" data-tou-add=${`${e}:${a}`} @click=${()=>this.edit(v=>{((v.schedule[e]??={})[a]??=[]).push(["17:00","22:00",l[0].id])})}>${s("+ טווח שעות")}</sw-button></div>`}
      </div>`}hours(t){const e=xa(t),a=r=>r.ranges.map(([i,d])=>`${i.split("-").reverse().join(".")}-${d.split("-").reverse().join(".")}`).join(", ");return n`<div class="card" data-tou-hours>
      <div class="hd"><b class="h3">${s("שעות לפי עונה")}</b><span class="sp"></span>
        <span class="legend">${t.bands.map(r=>n`<span><i style="background:${ne(t,r.id)}"></i>${j("bands",r)}</span>`)}</span></div>
      <div class="col">${t.seasons.map(r=>n`<div class="season" data-tou-season=${r.id}>
        <div class="row"><b class="h3">${j("seasons",r)}</b><span class="mut">${u(a(r))}</span></div>
        <div class="dt">${t.day_types.map(i=>this.dayRow(t,r.id,i.id,j("day_types",i),e))}</div>
      </div>`)}</div>
      <div class="hint" style="margin-block-start:8px">${s("כל שעה שאינה בטווח שייכת ל{band}. השעות הן שעון מקומי; טווח שעובר את חצות (22:00 עד 06:00) נספר באותו תאריך.",{band:this.bandName(t.default_band)})}</div>
    </div>`}nameEn(t,e,a,r){const i=r??"",d=Ea(i);return n`<div class="en">
      <input class="ltr ${d&&!this.bad(`${t}[${e}].name_en`)?"":"err"}" dir="ltr" lang="en" maxlength=${Ye} aria-label=${s("שם באנגלית")} placeholder=${s("שם באנגלית (רשות)")}
        data-tou-name-en=${`${t}:${a}`} .value=${i} ?disabled=${this.readonly} aria-invalid=${d?"false":"true"}
        @input=${l=>this.setNameEn(t,e,l.target.value)} />
      ${d?o:n`<span class="hint bad" data-tou-name-en-error>${s("שם באנגלית: אותיות לטיניות בלבד, עד {max} תווים.",{max:Ye})}</span>`}
    </div>`}setNameEn(t,e,a){this.edit(r=>{const i=r[t][e];i&&(a.trim()?i.name_en=a:delete i.name_en)})}structure(t){const e=this.readonly,a=(r,i,d,l)=>n`<select class="${this.bad(i)?"err":""}" ?disabled=${e} @change=${h=>this.edit(m=>d(m,h.target.value||null))}>
      ${l?n`<option value="" .selected=${r===null}>${s("ללא שינוי")}</option>`:o}${t.day_types.map(h=>n`<option value=${h.id} .selected=${h.id===r}>${j("day_types",h)}</option>`)}</select>`;return n`<details class="card" data-tou-structure ?open=${!!this.errorPath&&/^(seasons|bands|week|holiday|day_types|default_band)/.test(this.errorPath)}>
      <summary>${s("מבנה התעריף: עונות, פסים וימים")}</summary>
      <div class="stru">
        <div class="col">
          <b>${s("עונות")}</b>
          ${t.seasons.map((r,i)=>n`<div class="season ${this.bad(`seasons[${i}]`)}" data-tou-season-def=${r.id}>
            <div class="row"><input aria-label=${s("שם העונה")} .value=${r.name_he} ?disabled=${e} @input=${d=>this.edit(l=>{l.seasons[i].name_he=d.target.value})} />
              ${e||t.seasons.length<2?o:n`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת העונה")} @click=${()=>this.edit(d=>{const[l]=d.seasons.splice(i,1);delete d.schedule[l.id],delete d.prices[l.id]})}></sw-button>`}</div>
            ${this.nameEn("seasons",i,r.id,r.name_en)}
            ${r.ranges.map((d,l)=>n`<div class="rng"><span class="mut">${s("מ")}</span><input class="md ltr" aria-label=${s("מתאריך (חודש-יום)")} placeholder="MM-DD" .value=${d[0]} ?disabled=${e} @change=${h=>{const m=h.target.value.trim();ns.test(m)&&this.edit(p=>{p.seasons[i].ranges[l][0]=m})}} />
              <span class="mut">${s("עד")}</span><input class="md ltr" aria-label=${s("עד תאריך (חודש-יום)")} placeholder="MM-DD" .value=${d[1]} ?disabled=${e} @change=${h=>{const m=h.target.value.trim();ns.test(m)&&this.edit(p=>{p.seasons[i].ranges[l][1]=m})}} />
              ${e||r.ranges.length<2?o:n`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת טווח תאריכים")} @click=${()=>this.edit(h=>{h.seasons[i].ranges.splice(l,1)})}></sw-button>`}</div>`)}
            ${e?o:n`<div><sw-button variant="ghost" size="sm" @click=${()=>this.edit(d=>{d.seasons[i].ranges.push(["01-01","01-31"])})}>${s("+ טווח תאריכים")}</sw-button></div>`}
          </div>`)}
          ${e?o:n`<div><sw-button size="sm" data-tou-add-season @click=${()=>this.edit(r=>{const i=Xe("season",r.seasons.map(d=>d.id));r.seasons.push({id:i,name_he:"עונה חדשה",ranges:[["01-01","01-31"]]}),r.prices[i]={}})}>${s("+ עונה")}</sw-button></div>`}
          <div class="hint">${s("העונות חייבות לכסות את כל השנה בלי חפיפה. 29 בפברואר שייך לעונה של 28 בפברואר.")}</div>
        </div>
        <div class="col">
          <b>${s("פסי תעריף")}</b>
          ${t.bands.map((r,i)=>n`<div class="row ${this.bad(`bands[${i}]`)}"><span class="sw" style="background:${ne(t,r.id)}"></span>
            <input aria-label=${s("שם הפס")} .value=${r.name_he} data-tou-band-name=${r.id} ?disabled=${e} @input=${d=>this.edit(l=>{l.bands[i].name_he=d.target.value})} />
            ${e||r.id===t.default_band||t.bands.length<2?o:n`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת הפס")} @click=${()=>this.edit(d=>{d.bands.splice(i,1);for(const l of Object.values(d.schedule))for(const h of Object.keys(l))l[h]=l[h].filter(m=>m[2]!==r.id),l[h].length||delete l[h];for(const l of Object.values(d.prices))delete l[r.id]})}></sw-button>`}</div>
            ${this.nameEn("bands",i,r.id,r.name_en)}`)}
          ${e||t.bands.length>=8?o:n`<div><sw-button size="sm" data-tou-add-band @click=${()=>this.edit(r=>{r.bands.push({id:Xe("band",r.bands.map(i=>i.id)),name_he:"פס חדש"})})}>${s("+ פס")}</sw-button></div>`}
          <div class="fld"><label>${s("שאר השעות שייכות ל")}</label><select ?disabled=${e} @change=${r=>this.edit(i=>{i.default_band=r.target.value})}>${t.bands.map(r=>n`<option value=${r.id} .selected=${r.id===t.default_band}>${j("bands",r)}</option>`)}</select></div>
          <b>${s("סוגי ימים")}</b>
          <div class="dt" data-tou-day-types>${t.day_types.map((r,i)=>n`<span class="${this.bad(`day_types[${i}]`)}">${r.name_he}</span>${this.nameEn("day_types",i,r.id,r.name_en)}`)}</div>
          <b>${s("ימים")}</b>
          <div class="dt">${fs.map(r=>n`<span>${bs[r]}</span>${a(t.week[r],`week.${r}`,(i,d)=>{i.week[r]=d??i.day_types[0].id},!1)}`)}
            <span>${s("חג")}</span>${a(t.holiday,"holiday",(r,i)=>{r.holiday=i},!0)}
            <span>${s("ערב חג")}</span>${a(t.holiday_eve,"holiday_eve",(r,i)=>{r.holiday_eve=i},!0)}</div>
          <div class="hint">${s("יום שמתאים לכמה סוגים (שבת שהיא גם ערב חג) מקבל את הסוג המאוחר ברשימה:")} ${t.day_types.map(r=>j("day_types",r)).join(` ${s("←")} `)}.</div>
        </div>
      </div>
    </details>`}render(){const t=this.definition;return t?n`<div class="tou" data-tou-editor>${this.prices(t)}${this.hours(t)}${this.structure(t)}</div>`:o}};Ct.styles=[...Y.styles,st`
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
      .en {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-inline-size: 0;
      }
      .en .hint.bad {
        color: var(--sw-danger-text);
      }
      @media (max-width: 767px) {
        .dt {
          grid-template-columns: minmax(0, 1fr);
        }
        .stru {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `];Ut([_({attribute:!1})],Ct.prototype,"definition",2);Ut([_({type:Boolean})],Ct.prototype,"readonly",2);Ut([_()],Ct.prototype,"errorPath",2);Ut([_()],Ct.prototype,"priceMode",2);Ut([_({type:Number})],Ct.prototype,"vatRate",2);Ct=Ut([T("elec-tou-editor")],Ct);var wi=Object.defineProperty,_i=Object.getOwnPropertyDescriptor,O=(t,e,a,r)=>{for(var i=r>1?void 0:r?_i(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&wi(e,a,i),i};const ls=/^\d+(\.\d+)?$/,ds=/^#[0-9a-fA-F]{6}$/,ki=t=>{const e=[1,3,5].map(a=>parseInt(t.slice(a,a+2),16)/255).map(a=>a<=.03928?a/12.92:((a+.055)/1.055)**2.4);return .2126*e[0]+.7152*e[1]+.0722*e[2]};function os(t){const e=t.current?.definition;return e?`${e.bands.map(a=>j("bands",a,t.current?.names_en)).join(" / ")} · ${s("{n} עונות",{n:e.seasons.length})}`:s("לפי שעות")}let D=class extends Y{constructor(){super(...arguments),this.st="loading",this.tariffs=[],this.vat=null,this.settings=null,this.tOpen=!1,this.tEdit=null,this.tf={name:"",price:"",mode:"ex_vat",from:""},this.tErr={},this.tVer=null,this.tPlan=null,this.tKind="fixed",this.tDef=null,this.tErrPath="",this.tSource="",this.vOpen=!1,this.vf={rate:"",from:""},this.vErr={},this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{const t=b();[this.tariffs,this.vat,this.settings]=await Promise.all([t.listTariffs(),t.getVat(),t.getSettings().catch(()=>null)]),this.st="ready"}catch(t){this.st=De(t)?"forbidden":"error"}}rate(){return this.vat?.current?Number(this.vat.current.rate_percent)/100:0}derived(t,e){const a=Number(t)||0,r=this.rate();return e==="ex_vat"?{ex:a,vat:a*r,inc:a*(1+r)}:{ex:a/(1+r),vat:a-a/(1+r),inc:a}}openTariff(t){this.tEdit=t,this.tf=t?.current?{name:t.name,price:t.current.price??"",mode:t.current.price_mode,from:tt()}:{name:"",price:"",mode:this.settings?.default_price_mode??"ex_vat",from:tt()},this.tKind=t?.kind==="tou"?"tou":"fixed",this.tDef=t?.kind==="tou"&&t.current?.definition?le(t.current.definition):null,this.tSource="",this.tErrPath="",this.tErr={},this.tVer=null,this.tPlan=null,this.error="",this.tOpen=!0}async setKind(t){if(!(this.tEdit||this.tKind===t)&&(this.tKind=t,this.tErrPath="",this.error="",t==="tou"&&!this.tDef))try{const e=(await b().touTemplates())[0];this.tDef=le(e?.definition??Qe()),this.tSource=e?Ca(e.source_he,e.source_en):""}catch(e){this.tDef=Qe(),this.error=M(e)}}editVersion(t){this.tEdit&&(this.tVer=t,this.tPlan=null,this.tErr={},this.tErrPath="",this.error="",this.tf={name:this.tEdit.name,price:t.price??"",mode:t.price_mode,from:t.effective_from},t.definition&&(this.tDef=le(t.definition)))}setTf(t){this.tf={...this.tf,...t},this.tPlan=null}planText(t){const e=a=>a.price===null?a.price_mode==="inc_vat"?s("מחירים לפי שעות כולל מע״מ"):s("מחירים לפי שעות לפני מע״מ"):`${A(a.price)} ₪ ${a.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}`;return`${e(t.old)} ← ${e(t.new)}. ${t.message_he}`}async saveTariff(){const t=this.tf,e=this.tKind==="tou",a={};if(t.name.trim()||(a.name=s("צריך לתת שם לתעריף")),!e&&(!ls.test(t.price)||Number(t.price)<=0)&&(a.price=s("המחיר חייב להיות מספר גדול מאפס")),q(t.from)||(a.from=s("צריך לבחור תאריך")),this.tErr=a,!(Object.keys(a).length||this.busy||e&&!this.tDef)){this.busy=!0,this.error="",this.tErrPath="";try{const r={name:t.name.trim(),price:e?"":t.price,price_mode:t.mode,effective_from:t.from,definition:e?this.tDef:null};if(this.tEdit){const i=await b().correctTariffVersion(this.tEdit.id,r,{replaceId:this.tVer?.id??null,base:this.tVer,confirm:!!this.tPlan});if(!i.applied&&i.plan){this.tPlan=i.plan;return}}else await b().createTariff(r);this.tPlan=null,this.tOpen=!1,this.tariffs=await b().listTariffs()}catch(r){const i=Lt(r);Object.keys(i).length?this.tErr=i:this.error=M(r);const d=r instanceof Jt?r.body.details?.errors?.[0]:void 0;d?.path!==void 0&&(this.tErrPath=d.path)}finally{this.busy=!1}}}async saveVat(){const t={};if((!ls.test(this.vf.rate)||Number(this.vf.rate)>50)&&(t.rate_percent=s("שיעור המע״מ חייב להיות בין 0 ל-50")),q(this.vf.from)||(t.effective_from=s("צריך לבחור תאריך")),this.vErr=t,!(Object.keys(t).length||this.busy)){this.busy=!0,this.error="";try{this.vat=await b().addVat(this.vf.rate,this.vf.from),this.vOpen=!1}catch(e){const a=Lt(e);Object.keys(a).length?this.vErr=a:this.error=M(e)}finally{this.busy=!1}}}async setMode(t){if(!(!this.settings||!R().manage||this.settings.default_price_mode===t))try{this.settings=await b().saveSettings(this.settings.revision,{default_price_mode:t}),this.error=""}catch(e){this.error=M(e)}}render(){const t=R();if(!t.bills&&!t.manage)return n`<div class="page" data-elec="settings-prices" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה למחירים"))}</div>`;if(this.st==="loading")return n`<div class="page" data-elec="settings-prices" data-state="loading">${et(4)}</div>`;if(this.st==="forbidden")return n`<div class="page" data-elec="settings-prices" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה למחירים"))}</div>`;if(this.st==="error")return n`<div class="page" data-elec="settings-prices" data-state="error">${E("error","warning",s("לא ניתן לטעון את המחירים"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;const e=this.vat?.current,a=(this.vat?.items??[]).slice().sort((l,h)=>l.effective_from<h.effective_from?1:-1),r=t.manage,i=this.derived(this.tf.price,this.tf.mode),d=this.settings?.default_price_mode??"ex_vat";return n`<div class="page" data-elec="settings-prices" data-state="ready">
      ${this.error&&!this.tOpen&&!this.vOpen?C("err",this.error):o}
      ${e?o:C("warn",s("לא הוגדר שיעור מע״מ. בלי שיעור אי אפשר להפיק חיובים."))}
      <div class="cols side-l">
        <div class="card ${this.phone?"":"flush"}"><div class="hd"><b class="h3">${s("תעריפים")}</b><span class="sp"></span>${r?n`<sw-button variant="primary" size="sm" data-new-tariff @click=${()=>this.openTariff(null)}>${s("+ תעריף")}</sw-button>`:o}</div>
          ${this.tariffs.length?this.phone?n`<div class="list" data-tariffs>${this.tariffs.map(l=>n`<button type="button" class="li" data-tariff-row=${l.id} data-kind=${l.kind} ?disabled=${!r} @click=${()=>r&&this.openTariff(l)}><div class="grow"><div class="t1">${l.name}</div><div class="t2">${l.kind==="tou"?n`${os(l)} · `:o}${l.current?.price_mode==="inc_vat"?s("הוזן כולל מע״מ"):s("הוזן לפני מע״מ")} · ${s("מ-")}${u(S(l.current?.effective_from??""))}</div></div>${l.kind==="tou"?n`<span class="chip c-acc nodot">${s("לפי שעות")}</span>`:n`<b class="num">${A(l.current?.price??0)} ₪</b>`}</button>`)}</div>`:n`<div class="scrollx"><table class="t" data-tariffs><thead><tr><th>${s("שם")}</th><th class="num">${s("מחיר שהוזן")}</th><th>${s("הוזן")}</th><th class="num">${s("לפני מע״מ")}</th><th class="num">${s("כולל מע״מ")}</th><th>${s("בתוקף מ")}</th><th>${s("חשבונות")}</th></tr></thead><tbody>
                ${this.tariffs.map(l=>{const h=this.derived(l.current?.price??"0",l.current?.price_mode??"ex_vat"),m=l.kind==="tou";return n`<tr class="${r?"go":""}" data-tariff-row=${l.id} data-kind=${l.kind} @click=${()=>r&&this.openTariff(l)}><td class="b">${l.name}${m?n` <span class="chip c-acc nodot">${s("לפי שעות")}</span>`:o}</td>${m?n`<td colspan="1" class="mut">${os(l)}</td><td>${l.current?.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}</td><td class="num">-</td><td class="num">-</td>`:n`<td class="num">${A(l.current?.price??0)} ₪</td><td>${l.current?.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}</td><td class="num">${A(h.ex)} ₪</td><td class="num">${A(h.inc)} ₪</td>`}<td class="num" style="text-align:start">${S(l.current?.effective_from??"")}</td><td>${l.used_by}</td></tr>`})}</tbody></table></div>`:E("empty","bolt",s("אין תעריפים עדיין"),r?{label:s("+ תעריף"),primary:!0,run:()=>this.openTariff(null)}:void 0)}
        </div>
        <div class="col">
          <div class="card" data-card="vat"><div class="hd"><b class="h3">${s("שיעור מע״מ")}</b><span class="sp"></span>${r?n`<sw-button size="sm" data-new-vat @click=${()=>{this.vf={rate:"",from:tt()},this.vErr={},this.error="",this.vOpen=!0}}>${s("+ שיעור חדש")}</sw-button>`:o}</div>
            ${e?n`<div class="row" style="align-items:baseline"><span style="font-size:var(--sw-fs-3xl);font-weight:700" data-vat-rate>${u(e.rate_percent+"%")}</span><span class="mut">${s("מ-")}${u(S(e.effective_from))}</span></div>`:n`<div class="mut">${s("לא הוגדר")}</div>`}
            ${a.slice(1).map((l,h)=>n`<div class="ver" style="margin-block-start:8px"><span class="num">${l.rate_percent}%</span><span>${s("עד")} ${u(S(Qt(a[h].effective_from,-1)))}</span></div>`)}</div>
          <div class="card" data-card="mode"><div class="hd"><b class="h3">${s("ברירת מחדל להזנת מחיר")}</b></div><div class="list" role="radiogroup" aria-label=${s("ברירת מחדל להזנת מחיר")}>
            ${["ex_vat","inc_vat"].map(l=>n`<label class="li ${d===l?"sel":""}"><input type="radio" name="mode" data-default-mode=${l} .checked=${d===l} ?disabled=${!r} @change=${()=>void this.setMode(l)} /><span class="ind"></span><div class="grow t1">${l==="ex_vat"?s("לפני מע״מ"):s("כולל מע״מ")}</div></label>`)}</div></div>
        </div>
      </div>
      <elec-dialog heading=${this.tEdit?s("עריכת תעריף"):s("תעריף חדש")} ?open=${this.tOpen} ?wide=${this.tKind==="tou"} data-dialog="tariff" @close=${()=>this.tOpen=!1}>
        <div class="form">
          <div class="fld wide"><label for="tn">${s("שם התעריף")}</label><input id="tn" class="${this.tErr.name?"err":""}" data-tariff-name .value=${this.tf.name} @input=${l=>this.setTf({name:l.target.value})} />${this.tErr.name?n`<div class="msg" role="alert">${this.tErr.name}</div>`:o}</div>
          ${this.tEdit?o:n`<div class="fld wide"><span class="lbl">${s("סוג התעריף")}</span><div class="seg" role="group" aria-label=${s("סוג התעריף")}><button type="button" data-tariff-kind="fixed" aria-pressed=${this.tKind==="fixed"} @click=${()=>void this.setKind("fixed")}>${s("מחיר קבוע")}</button><button type="button" data-tariff-kind="tou" aria-pressed=${this.tKind==="tou"} @click=${()=>void this.setKind("tou")}>${s("לפי שעות (תעו״ז)")}</button></div></div>`}
          ${this.tKind==="fixed"?n`<div class="fld"><label for="tp">${s("מחיר לקוט״ש")}</label><div class="unit"><input id="tp" class="ltr ${this.tErr.price?"err":""}" data-tariff-price inputmode="decimal" .value=${this.tf.price} @input=${l=>this.setTf({price:l.target.value})} /><span>₪</span></div>${this.tErr.price?n`<div class="msg" role="alert">${this.tErr.price}</div>`:o}</div>`:o}
          <div class="fld"><span class="lbl">${this.tKind==="tou"?s("המחירים שהוזנו"):s("המחיר שהוזן")}</span><div class="seg" role="group" aria-label=${s("סוג מחיר")}><button type="button" data-tariff-mode="ex_vat" aria-pressed=${this.tf.mode==="ex_vat"} @click=${()=>this.setTf({mode:"ex_vat"})}>${s("לפני מע״מ")}</button><button type="button" data-tariff-mode="inc_vat" aria-pressed=${this.tf.mode==="inc_vat"} @click=${()=>this.setTf({mode:"inc_vat"})}>${s("כולל מע״מ")}</button></div></div>
          <div class="fld"><label for="tf">${s("בתוקף מתאריך")}</label><input id="tf" type="date" lang=${ct()} class="ltr ${this.tErr.effective_from?"err":""}" data-tariff-from .value=${this.tf.from} @change=${l=>this.setTf({from:l.target.value})} />${this.tErr.effective_from?n`<div class="msg" role="alert">${this.tErr.effective_from}</div>`:o}</div>
        </div>
        ${this.tKind==="fixed"&&e?n`<div class="card soft" data-tariff-derived><dl class="kv"><dt>${s("לפני מע״מ")}</dt><dd>${u(A(i.ex)+" ₪")}</dd><dt>${s("מע״מ")} ${u(e.rate_percent+"%")}</dt><dd>${u(A(i.vat)+" ₪")}</dd><dt>${s("כולל מע״מ")}</dt><dd>${u(A(i.inc)+" ₪")}</dd></dl></div>`:o}
        ${this.tKind==="tou"&&this.tSource&&!this.tEdit?C("info",this.tSource):o}
        ${this.tKind==="tou"&&this.tDef?n`<elec-tou-editor .definition=${this.tDef} .priceMode=${this.tf.mode} .vatRate=${e?Number(e.rate_percent)/100:null} .errorPath=${this.tErrPath}
            @tou-change=${l=>{this.tDef=l.detail,this.tPlan=null,this.tErrPath=""}}></elec-tou-editor>`:o}
        ${this.tEdit&&this.tEdit.versions.length?n`<b class="h3">${s("גרסאות")}</b><div class="list" data-tariff-versions>${this.tEdit.versions.map(l=>n`<div class="ver" data-version=${l.id} aria-current=${this.tVer?.id===l.id?"true":"false"}><span class="num">${l.definition?s("לפי שעות"):`${A(l.price??0)} ₪`}</span><span>${l.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")} · ${s("מ-")}${u(S(l.effective_from))}</span>${R().manage?n`<button type="button" class="btn ghost sm" data-version-edit=${l.id} aria-label=${s("תיקון המחיר")} @click=${()=>this.editVersion(l)}>${s("תיקון")}</button>`:o}</div>`)}</div>`:o}
        ${this.tPlan?C("warn",this.planText(this.tPlan)):o}
        ${this.error?C("err",this.error):o}
        <sw-button variant="primary" slot="actions" data-save ?disabled=${this.busy} @click=${()=>void this.saveTariff()}>${this.tPlan?s("אישור והחלפה"):this.tVer?s("שמירת תיקון"):s("שמירה")}</sw-button>
        <sw-button slot="actions" @click=${()=>this.tOpen=!1}>${s("ביטול")}</sw-button>
      </elec-dialog>
      <elec-dialog heading=${s("שיעור מע״מ חדש")} ?open=${this.vOpen} data-dialog="vat" @close=${()=>this.vOpen=!1}>
        <div class="form">
          <div class="fld"><label for="vr">${s("שיעור")}</label><div class="unit"><input id="vr" class="ltr ${this.vErr.rate_percent?"err":""}" data-vat-input inputmode="decimal" .value=${this.vf.rate} @input=${l=>this.vf={...this.vf,rate:l.target.value}} /><span>%</span></div>${this.vErr.rate_percent?n`<div class="msg" role="alert">${this.vErr.rate_percent}</div>`:o}</div>
          <div class="fld"><label for="vf">${s("בתוקף מתאריך")}</label><input id="vf" type="date" lang=${ct()} class="ltr ${this.vErr.effective_from?"err":""}" data-vat-from .value=${this.vf.from} @change=${l=>this.vf={...this.vf,from:l.target.value}} />${this.vErr.effective_from?n`<div class="msg" role="alert">${this.vErr.effective_from}</div>`:o}</div>
        </div>
        ${this.error?C("err",this.error):o}
        <sw-button variant="primary" slot="actions" data-save ?disabled=${this.busy} @click=${()=>void this.saveVat()}>${s("שמירה")}</sw-button>
        <sw-button slot="actions" @click=${()=>this.vOpen=!1}>${s("ביטול")}</sw-button>
      </elec-dialog>
    </div>`}};O([c()],D.prototype,"st",2);O([c()],D.prototype,"tariffs",2);O([c()],D.prototype,"vat",2);O([c()],D.prototype,"settings",2);O([c()],D.prototype,"tOpen",2);O([c()],D.prototype,"tEdit",2);O([c()],D.prototype,"tf",2);O([c()],D.prototype,"tErr",2);O([c()],D.prototype,"tVer",2);O([c()],D.prototype,"tPlan",2);O([c()],D.prototype,"tKind",2);O([c()],D.prototype,"tDef",2);O([c()],D.prototype,"tErrPath",2);O([c()],D.prototype,"tSource",2);O([c()],D.prototype,"vOpen",2);O([c()],D.prototype,"vf",2);O([c()],D.prototype,"vErr",2);O([c()],D.prototype,"busy",2);O([c()],D.prototype,"error",2);D=O([T("elec-settings-prices")],D);function xi(t,e,a){const r=tt();return{schema:"arx.energy.bill_snapshot/1",doc:{title_he:"חשבון צריכת חשמל ודרישת תשלום",subtitle_he:"אינו חשבונית מס",is_tax_invoice:!1},bill:{id:"",number:"2026-09-0001",revision:1,replaces:null,state:"issued",issue_date:r,due_date:e.mode==="net_days"?Qt(r,e.days):`${r.slice(0,7)}-${String(e.day_of_month).padStart(2,"0")}`,expected_due_date:null,payment_terms:{mode:e.mode,days:e.days,day_of_month:e.day_of_month}},period:{from:"2026-09-01",to:"2026-09-30",days:30},business:{...t,logo:a?{sha256:"x",mime:"image/png"}:null},customer:{id:"c",customer_number:"0001",name:"לקוח לדוגמה",address:"רחוב הדוגמה 12, עיר לדוגמה",phone:"",email:"",tax_id:""},account:{id:"a",name:"חשבון לדוגמה",tariff:{id:"t",name:"תעריף"},formula:{text:"[מונה]",sentence_he:"מונה לדוגמה"}},meters:[{meter_id:"m",name:"מונה לדוגמה",coefficient:"1",start:{at:"2026-09-01T00:00:00Z",reading_kwh:"1000.00",kind:"reading"},end:{at:"2026-09-30T23:59:00Z",reading_kwh:"1776.20",kind:"reading"},consumption_kwh:"776.20",contribution_kwh:"776.20"}],lines:[{from:"2026-09-01",to:"2026-09-30",kwh:"776.20",price_entered:"0.5430",price_mode:"ex_vat",unit_price_ex_vat:"0.5430",amount_ex_vat:"421.48",vat_rate_percent:"18",vat_amount:"75.87",total:"497.35"}],totals:{currency:"ILS",kwh:"776.20",amount_ex_vat:"421.48",vat_amount:"75.87",total:"497.35",vat_breakdown:[{rate_percent:"18",base:"421.48",vat:"75.87"}],price_mode_note_he:null},notes:[],history:{current:null,previous:[],same_period_last_year:null},meta:{software_version:"",computed_at:""}}}let ht=class extends Y{constructor(){super(...arguments),this.st="loading",this.s=null,this.biz={name:"",registration_no:"",address:"",phone:"",email:"",accent_color:"#2767ed",footer_note:""},this.terms={mode:"net_days",days:14,day_of_month:15},this.delay="6",this.errs={},this.busy=!1,this.error="",this.ok=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{this.apply(await b().getSettings()),this.st="ready"}catch(t){this.st=De(t)?"forbidden":"error"}}apply(t){this.s=t,this.biz={...t.business},this.terms={...t.payment_terms},this.delay=String(t.auto.delay_hours)}validate(){const t={};return this.biz.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.biz.email)&&(t.email=s("כתובת דוא״ל לא תקינה")),ds.test(this.biz.accent_color)?ki(this.biz.accent_color)>.6&&(t.accent_color=s("הצבע בהיר מדי להדפסה")):t.accent_color=s("צבע לא תקין"),this.terms.mode==="net_days"&&!(Number.isInteger(this.terms.days)&&this.terms.days>=0&&this.terms.days<=120)&&(t.days=s("מספר הימים חייב להיות בין 0 ל-120")),this.terms.mode==="day_of_month"&&!(Number.isInteger(this.terms.day_of_month)&&this.terms.day_of_month>=1&&this.terms.day_of_month<=31)&&(t.day_of_month=s("היום בחודש חייב להיות בין 1 ל-31")),(!/^\d+$/.test(this.delay)||Number(this.delay)>72)&&(t.delay_hours=s("ההשהיה חייבת להיות בין 0 ל-72 שעות")),this.errs=t,!Object.keys(t).length}async save(){if(!(!this.s||this.busy||!this.validate())){this.busy=!0,this.error="",this.ok=!1;try{this.apply(await b().saveSettings(this.s.revision,{business:this.biz,payment_terms:this.terms,auto:{delay_hours:Number(this.delay)}})),this.ok=!0}catch(t){const e=Lt(t);Object.keys(e).length?this.errs=e:this.error=M(t)}finally{this.busy=!1}}}async logo(t){if(t){if(this.error="",!/^image\/(png|jpeg)$/.test(t.type)||t.size>1024*1024){this.error=s("הלוגו חייב להיות PNG או JPEG עד 1MB.");return}try{await b().uploadLogo(t),this.apply(await b().getSettings())}catch(e){this.error=M(e)}}}async removeLogo(){try{await b().removeLogo(),this.apply(await b().getSettings())}catch(t){this.error=M(t)}}fld(t,e,a={}){const r=this.errs[t];return n`<div class="fld ${a.wide?"wide":""}"><label for="b-${t}">${e}</label>
      ${a.area?n`<textarea id="b-${t}" name=${t} .value=${this.biz[t]} @input=${i=>this.biz={...this.biz,[t]:i.target.value}}></textarea>`:n`<input id="b-${t}" name=${t} class="${a.ltr?"ltr":""} ${r?"err":""}" aria-invalid=${r?"true":"false"} .value=${this.biz[t]} @input=${i=>{this.biz={...this.biz,[t]:i.target.value},this.errs={...this.errs,[t]:""}}} />`}
      ${r?n`<div class="msg" role="alert" data-field-error=${t}>${r}</div>`:o}</div>`}render(){const t=R();if(!t.bills&&!t.manage)return n`<div class="page" data-elec="settings-business" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לפרטי העסק"))}</div>`;if(this.st==="loading")return n`<div class="page" data-elec="settings-business" data-state="loading">${et(4)}</div>`;if(this.st==="forbidden")return n`<div class="page" data-elec="settings-business" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לפרטי העסק"))}</div>`;if(this.st==="error"||!this.s)return n`<div class="page" data-elec="settings-business" data-state="error">${E("error","warning",s("לא ניתן לטעון את ההגדרות"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;const e=t.manage,a=this.s,r=a.logo?b().logoUrl(a.logo.sha256):"",i=As("accent","light",8),d=this.terms;return n`<div class="page" data-elec="settings-business" data-state="ready">
      <div class="cols side-l"><div class="card" style="min-inline-size:0"><fieldset style="border:0;margin:0;padding:0;min-inline-size:0" ?disabled=${!e}><div class="form">
        <div class="fld wide"><span class="lbl">${s("לוגו")}</span><div class="row">
          <div class="chip c-mut nodot" style="inline-size:96px;block-size:96px;padding:0;justify-content:center;border-radius:var(--sw-r-lg);overflow:hidden" data-logo>${r?n`<img src=${r} alt=${s("לוגו")} style="max-inline-size:100%;max-block-size:100%" />`:n`<span class="mut">${s("אין לוגו")}</span>`}</div>
          <div><label class="btn" style="cursor:pointer">${a.logo?s("החלפה"):s("העלאת לוגו")}<input type="file" accept="image/png,image/jpeg" data-logo-input style="position:absolute;inline-size:1px;block-size:1px;opacity:0" @change=${l=>void this.logo(l.target.files?.[0])} /></label>
            ${a.logo?n` <sw-button variant="ghost" data-logo-remove @click=${()=>void this.removeLogo()}>${s("הסרה")}</sw-button>`:o}<div class="mut" style="margin-block-start:6px">${s("PNG או JPEG, עד 1MB")}</div></div></div></div>
        ${this.fld("name",s("שם העסק"),{wide:!0})}${this.fld("registration_no",s("ח.פ. / ע.מ."),{ltr:!0})}${this.fld("phone",s("טלפון"),{ltr:!0})}${this.fld("address",s("כתובת"),{wide:!0})}${this.fld("email",s("דוא״ל"),{ltr:!0})}
        <div class="fld"><span class="lbl" id="acc">${s("צבע המותג")}</span><div class="row" role="group" aria-labelledby="acc" data-accent>
          ${i.map(l=>n`<button type="button" class="tok swatch" data-swatch=${l} aria-label=${s("צבע {c}",{c:l})} aria-pressed=${this.biz.accent_color.toLowerCase()===l} style="background:${l};border:2px solid ${this.biz.accent_color.toLowerCase()===l?"var(--sw-text)":"transparent"}" @click=${()=>this.biz={...this.biz,accent_color:l}}></button>`)}
          <input type="color" data-accent-color aria-label=${s("בחירה חופשית של צבע")} .value=${ds.test(this.biz.accent_color)?this.biz.accent_color:"#2767ed"} @input=${l=>this.biz={...this.biz,accent_color:l.target.value}} /></div>
          ${this.errs.accent_color?n`<div class="msg" role="alert" data-field-error="accent_color">${this.errs.accent_color}</div>`:o}</div>
        ${this.fld("footer_note",s("הערה קבועה בתחתית החיוב"),{wide:!0,area:!0})}
        <div class="fld wide"><span class="lbl">${s("מספור חיובים")}</span><div class="row" data-numbering style="padding:8px 12px;border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-sm)"><span class="num">${a.numbering.format}</span><span class="sp"></span><span class="mut">${s("שנה-חודש-מספר לקוח, למשל")} ${u("2026-12-0001")}</span></div></div>
        <div class="fld wide"><span class="lbl" id="pt">${s("תנאי תשלום")}</span><div class="row"><div class="seg" role="group" aria-labelledby="pt"><button type="button" data-terms="net_days" aria-pressed=${d.mode==="net_days"} @click=${()=>this.terms={...d,mode:"net_days"}}>${s("ימים מיום ההפקה")}</button><button type="button" data-terms="day_of_month" aria-pressed=${d.mode==="day_of_month"} @click=${()=>this.terms={...d,mode:"day_of_month"}}>${s("יום קבוע בחודש")}</button></div>
          ${d.mode==="net_days"?n`<div class="unit"><input class="ltr" data-days type="number" min="0" max="120" aria-label=${s("ימים לתשלום")} style="inline-size:90px" .value=${String(d.days)} @input=${l=>this.terms={...d,days:Number(l.target.value)}} /><span>${s("ימים")}</span></div>`:n`<div class="unit"><input class="ltr" data-day-of-month type="number" min="1" max="31" aria-label=${s("יום בחודש")} style="inline-size:90px" .value=${String(d.day_of_month)} @input=${l=>this.terms={...d,day_of_month:Number(l.target.value)}} /><span>${s("בחודש")}</span></div>`}</div>
          ${this.errs.days||this.errs.day_of_month?n`<div class="msg" role="alert" data-field-error="terms">${this.errs.days||this.errs.day_of_month}</div>`:o}</div>
        <div class="fld wide"><label for="dl">${s("יצירת טיוטה אוטומטית")}</label><div class="unit"><input id="dl" class="ltr ${this.errs.delay_hours?"err":""}" data-delay type="number" min="0" max="72" style="inline-size:90px" .value=${this.delay} @input=${l=>{this.delay=l.target.value,this.errs={...this.errs,delay_hours:""}}} /><span>${s("שעות אחרי סוף התקופה")}</span></div>${this.errs.delay_hours?n`<div class="msg" role="alert" data-field-error="delay_hours">${this.errs.delay_hours}</div>`:o}</div>
      </div></fieldset>
      ${this.error?C("err",this.error):o}${this.ok?C("ok",s("ההגדרות נשמרו")):o}
      ${e?n`<div class="row" style="margin-block-start:14px"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button></div>`:o}</div>
      <div class="card"><div class="hd"><b class="h3">${s("תצוגה מקדימה")}</b></div><div style="overflow:hidden;max-block-size:320px;border-radius:var(--sw-r-sm)" data-preview><elec-bill-paper .snapshot=${xi(this.biz,d,!!a.logo)} .logo=${r} hash=""></elec-bill-paper></div></div></div>
    </div>`}};O([c()],ht.prototype,"st",2);O([c()],ht.prototype,"s",2);O([c()],ht.prototype,"biz",2);O([c()],ht.prototype,"terms",2);O([c()],ht.prototype,"delay",2);O([c()],ht.prototype,"errs",2);O([c()],ht.prototype,"busy",2);O([c()],ht.prototype,"error",2);O([c()],ht.prototype,"ok",2);ht=O([T("elec-settings-business")],ht);var Ei=Object.defineProperty,Ci=Object.getOwnPropertyDescriptor,Wt=(t,e,a,r)=>{for(var i=r>1?void 0:r?Ci(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ei(e,a,i),i};let ue=class extends Y{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams}render(){const[t,e]=this.segments;return t?t==="new"?n`<elec-account-wizard></elec-account-wizard>`:e==="edit"?n`<elec-account-wizard .accountId=${t}></elec-account-wizard>`:n`<elec-account-page .accountId=${t} .tab=${e==="history"||e==="bills"?e:"status"}></elec-account-page>`:n`<elec-accounts-list></elec-accounts-list>`}};Wt([_({attribute:!1})],ue.prototype,"segments",2);Wt([_({attribute:!1})],ue.prototype,"params",2);ue=Wt([T("elec-accounts-page")],ue);let $e=class extends Y{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams}render(){const[t]=this.segments;return t?n`<elec-bill-page .billId=${t}></elec-bill-page>`:n`<elec-bills-list></elec-bills-list>`}};Wt([_({attribute:!1})],$e.prototype,"segments",2);Wt([_({attribute:!1})],$e.prototype,"params",2);$e=Wt([T("elec-bills-page")],$e);var Si=Object.defineProperty,Oi=Object.getOwnPropertyDescriptor,P=(t,e,a,r)=>{for(var i=r>1?void 0:r?Oi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Si(e,a,i),i};const Pi=[{id:"kWh",label:s("קוט״ש")},{id:"Wh",label:s("וואט־שעה")},{id:"MWh",label:s("מגוואט־שעה")}],xs=st`
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
  ${Fs}
`;let Ft=class extends Ot{constructor(){super(...arguments),this.bubbleSkin=new Vt(this),this.log=null,this.canManage=!1,this.error=""}open(t){this.dispatchEvent(new CustomEvent("open-dialog",{detail:t}))}calLine(t){const e=t.calibration;return e.identity?n`<div class="cal" data-calibration="none">${s("ללא כיול: הקריאות כפי שהמונה מדווח")}</div>`:n`<div class="cal" data-calibration=${e.calibration_id??""}>${s("כיול מ-")}<span class="num">${Bt(e.effective_date)}</span> · ${s("מקדם")} <span class="num">${e.factor}</span>
      · ${s("הפרש")} <span class="num ltr">${Yt(e.offset_kwh)}</span> ${s("קוט״ש")}</div>`}reading(t){const e=t.deviation_kwh==null?s("אין ערך מערכת לזמן הזה"):n`${s("מהמערכת")} <span class="num ltr">${Yt(t.deviation_kwh)}</span>`;return n`<div class="li ${t.voided_at?"dis":""}" data-reading=${t.id??""}>
      <div class="grow">
        <div class="t1"><span class="num">${de(t.value_kwh)}</span> ${s("קוט״ש")} · <span class="num">${pe(t.read_at)}</span></div>
        <div class="t2 wrap">${e}${t.created_by_name?` · ${t.created_by_name}`:""}${t.note?` · ${t.note}`:""}${t.voided_at?n` · <b>${s("בוטלה")}</b>${t.voided_by_name?` (${t.voided_by_name})`:""}`:""}</div>
      </div>
      <span class="chip nodot ${t.effect==="allocation"?"c-acc":"c-mut"}" data-effect=${t.effect_reason} title=${t.message}>${$i[t.effect_reason]}</span>
      ${this.canManage&&t.can_undo&&t.id?n`<sw-button size="sm" variant="ghost" data-reading-undo=${t.id} @click=${()=>this.open({kind:"undo-reading",id:t.id})}>${s("ביטול")}</sw-button>`:o}
    </div>`}calibration(t){return n`<div class="li ${t.voided_at?"dis":""}" data-cal=${t.id??""}>
      <div class="grow">
        <div class="t1">${s("מ-")}<span class="num">${Bt(t.effective_date)}</span> · ${s("מקדם")} <span class="num">${t.factor}</span> · ${s("הפרש")} <span class="num ltr">${Yt(t.offset_kwh)}</span></div>
        <div class="t2 wrap">${t.created_by_name??""}${t.note?` · ${t.note}`:""}${t.voided_at?n` · <b>${s("בוטל")}</b>`:""}</div>
      </div>
      ${t.in_force?n`<span class="chip nodot c-acc">${s("בתוקף")}</span>`:o}
      ${this.canManage&&t.can_undo&&t.id?n`<sw-button size="sm" variant="ghost" data-cal-undo=${t.id} @click=${()=>this.open({kind:"undo-calibration",id:t.id})}>${s("ביטול")}</sw-button>`:o}
    </div>`}render(){const t=this.log;return n`<div class="rd" data-readings>
      <div class="row"><h3>${s("קריאות ידניות וכיול")}</h3><span class="sp"></span>
        ${this.canManage&&t?n`<div class="acts"><sw-button size="sm" data-reading-add @click=${()=>this.open({kind:"reading"})}>${s("קריאה ידנית")}</sw-button>
              <sw-button size="sm" data-calibrate @click=${()=>this.open({kind:"calibrate"})}>${s("כיול")}</sw-button></div>`:o}</div>
      ${this.error?n`<div class="alert err" role="alert" data-readings-error>${this.error}</div>`:o}
      ${t?n`${this.calLine(t)}
            ${this.canManage&&t.suggestion?n`<div class="alert info sug" data-suggestion><div>${s("לפי שתי קריאות ההשוואה: מקדם")} <span class="num">${t.suggestion.factor}</span></div><span class="sp"></span>
                  <sw-button size="sm" data-suggestion-apply @click=${()=>this.open({kind:"calibrate",factor:t.suggestion.factor,anchor:t.suggestion.anchor_reading_id})}>${s("כיול לפי ההצעה")}</sw-button></div>`:o}
            ${t.items.length?n`<div class="list" data-reading-list>${t.items.map(e=>this.reading(e))}</div>`:n`<div class="mut" data-reading-empty>${s("אין קריאות ידניות")}</div>`}
            ${t.calibrations.length?n`<h4>${s("כיולים")}</h4><div class="list" data-cal-list>${t.calibrations.map(e=>this.calibration(e))}</div>`:o}`:this.error?o:n`<div class="skl" style="inline-size:60%"></div>`}
    </div>`}};Ft.styles=[yt,xs];P([_({attribute:!1})],Ft.prototype,"log",2);P([_({type:Boolean})],Ft.prototype,"canManage",2);P([_()],Ft.prototype,"error",2);Ft=P([T("elec-meter-readings")],Ft);let N=class extends Ot{constructor(){super(...arguments),this.bubbleSkin=new Vt(this),this.meterId="",this.log=null,this.kind="",this.targetId="",this.presetFactor="",this.presetAnchor="",this.when="",this.value="",this.unit="kWh",this.note="",this.preview=null,this.previewError="",this.error="",this.fieldErrors={},this.busy=!1,this.date="",this.mode="anchor",this.anchor="",this.factor="1",this.offset="0",this.reason="",this.timer=0,this.seq=0}willUpdate(t){t.has("kind")&&this.kind&&this.reset()}disconnectedCallback(){window.clearTimeout(this.timer),super.disconnectedCallback()}reset(){if(this.preview=null,this.previewError="",this.error="",this.fieldErrors={},this.busy=!1,this.reason="",this.note="",this.kind==="reading"&&(this.when=Oe(new Date),this.value="",this.unit="kWh"),this.kind==="calibrate"){const t=Oe(new Date).slice(0,10),e=this.log?.first_calibration_date??"";this.date=e&&e>t?e:t,this.factor=this.presetFactor||"1";const a=this.anchors();this.anchor=this.presetAnchor||a[0]?.id||"",this.mode=a.length?"anchor":"offset",this.offset="0",this.schedule()}}anchors(){return(this.log?.items??[]).filter(t=>!t.voided_at&&t.id&&(t.system_kwh!=null||t.effect==="allocation"))}close(){window.clearTimeout(this.timer),this.dispatchEvent(new CustomEvent("close"))}saved(t){this.dispatchEvent(new CustomEvent("saved",{detail:t}))}readingBody(t){const e={},a=ui(this.when);a?Date.parse(a)>Date.now()+3e5&&(e.when=s("זמן הקריאה בעתיד")):e.when=s("צריך לבחור תאריך ושעה");const r=ce(this.value);return r==null&&(e.value=s("צריך להזין מספר תקין")),t||(this.fieldErrors=e),Object.keys(e).length||!a||r==null?null:{read_at:a,value:r,unit:this.unit,...this.note.trim()?{note:this.note.trim()}:{},dry_run:t}}calibrationBody(t){const e={};/^\d{4}-\d{2}-\d{2}$/.test(this.date)||(e.date=s("צריך לבחור תאריך"));const a=pi(this.factor);a==null&&(e.factor=s("מקדם בין 0.5 ל-2"));let r="0";if(this.mode==="offset"){const i=this.offset.trim().replace(",",".");r=/^[-−]?\d+(\.\d+)?$/.test(i)?i.replace("−","-"):null,r==null&&(e.offset=s("צריך להזין מספר תקין"))}else this.anchor||(e.anchor=s("צריך לבחור קריאה"));return t||(this.fieldErrors=e),Object.keys(e).length||a==null?null:{effective_date:this.date,factor:a,...this.mode==="anchor"?{anchor_reading_id:this.anchor}:{offset_kwh:r??"0"},...this.note.trim()?{note:this.note.trim()}:{},dry_run:t}}schedule(){window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.runPreview(),350)}async runPreview(){const t=++this.seq;try{if(this.kind==="reading"){const e=this.readingBody(!0);if(!e)return this.preview=null,void(this.previewError="");const a=await Me(this.meterId,e);t===this.seq&&(this.preview=a.reading,this.previewError="")}else if(this.kind==="calibrate"){const e=this.calibrationBody(!0);if(!e)return this.preview=null,void(this.previewError="");const a=await as(this.meterId,e);t===this.seq&&(this.preview=a.calibration,this.previewError="")}}catch(e){t===this.seq&&(this.preview=null,this.previewError=dt(e))}}async save(){if(this.busy)return;const t=this.kind==="reading"?this.readingBody(!1):this.calibrationBody(!1);if(t){this.busy=!0,this.error="";try{const e=this.kind==="reading"?await Me(this.meterId,t):await as(this.meterId,t);e.log&&this.saved(e.log),this.close()}catch(e){this.error=dt(e);const a=e instanceof Jt?e.body.details?.fields??[]:[];a.length&&(this.fieldErrors=Object.fromEntries(a.map(r=>[r==="read_at"?"when":r==="effective_date"?"date":r==="offset_kwh"?"offset":r==="anchor_reading_id"?"anchor":r," "])))}finally{this.busy=!1}}}async undo(){if(!this.busy){this.busy=!0,this.error="";try{const t=this.kind==="undo-reading"?await ci(this.meterId,this.targetId,this.reason.trim()||void 0):await hi(this.meterId,this.targetId,this.reason.trim()||void 0);this.saved(t),this.close()}catch(t){this.error=dt(t)}finally{this.busy=!1}}}fieldMsg(t){const e=this.fieldErrors[t];return e&&e.trim()?n`<div class="msg" role="alert" data-field-error=${t}>${e}</div>`:o}readingPreview(){const t=this.preview;return this.previewError?n`<div class="alert warn" role="status" data-reading-preview="error">${this.previewError}</div>`:t?n`<div class="pv" data-reading-preview=${t.effect_reason}>
      <dl class="kv">
        <dt>${s("המערכת באותו זמן")}</dt><dd>${t.system_kwh==null?s("אין ערך"):n`<span class="num">${de(t.system_kwh)}</span> ${s("קוט״ש")}`}</dd>
        ${t.deviation_kwh==null?o:n`<dt>${s("הפרש")}</dt><dd><span class="num ltr">${Yt(t.deviation_kwh)}</span> ${s("קוט״ש")}</dd>`}
      </dl>
      <div data-preview-message>${t.message}</div>
    </div>`:o}renderReading(){const t=(e,a)=>{this[e]=a,e!=="note"&&(this.fieldErrors={...this.fieldErrors,[e]:""},this.schedule())};return n`<sw-dialog open heading=${s("קריאה ידנית")} data-reading-dialog @close=${e=>{e.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="fld"><label for="rw">${s("תאריך ושעה")}</label>
          <div class="inp ${this.fieldErrors.when?"err":""}"><input id="rw" type="datetime-local" lang=${ct()} data-reading-when max=${Oe(new Date)} .value=${this.when} @input=${e=>t("when",e.target.value)} /></div>
          ${this.fieldMsg("when")}</div>
        <div class="fld"><label for="rv">${s("קריאת המונה")}</label>
          <div class="inp ${this.fieldErrors.value?"err":""}"><input id="rv" data-reading-value inputmode="decimal" autocomplete="off" dir="ltr" .value=${this.value} @input=${e=>t("value",e.target.value)} />
            <select data-reading-unit aria-label=${s("יחידה")} @change=${e=>{this.unit=e.target.value,this.schedule()}}>
              ${Pi.map(e=>n`<option value=${e.id} ?selected=${e.id===this.unit}>${e.label}</option>`)}</select></div>
          ${this.fieldMsg("value")}</div>
        <div class="fld wide"><label for="rn">${s("הערה (לא חובה)")}</label><div class="inp"><input id="rn" data-reading-note maxlength="500" .value=${this.note} @input=${e=>t("note",e.target.value)} /></div></div>
        <div class="wide">${this.readingPreview()}</div>
        ${this.error?n`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:o}
      </div>
      <sw-button slot="footer" variant="primary" data-reading-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
    </sw-dialog>`}renderCalibrate(){const t=this.anchors(),e=this.preview,a=this.log?.first_calibration_date??"",r=(i,d)=>{this[i]=d,this.fieldErrors={...this.fieldErrors,[i]:""},this.schedule()};return n`<sw-dialog open heading=${s("כיול מונה")} data-calibrate-dialog @close=${i=>{i.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="hint wide">${s("מהתאריך: קריאה פיזית = מקדם × מונה המערכת + הפרש. חיובים שהופקו לא משתנים.")}</div>
        <div class="fld"><label for="cd">${s("בתוקף מ-")}</label>
          <div class="inp ${this.fieldErrors.date?"err":""}"><input id="cd" type="date" lang=${ct()} data-cal-date min=${a} .value=${this.date} @input=${i=>r("date",i.target.value)} /></div>
          ${this.fieldMsg("date")}</div>
        <div class="fld"><label for="cf">${s("מקדם")}</label>
          <div class="inp ${this.fieldErrors.factor?"err":""}"><input id="cf" data-cal-factor inputmode="decimal" dir="ltr" .value=${this.factor} @input=${i=>r("factor",i.target.value)} /></div>
          ${this.fieldMsg("factor")}</div>
        <div class="fld wide"><span class="lbl">${s("הפרש")}</span>
          <div class="seg" role="group" aria-label=${s("הפרש")}>
            <button type="button" data-cal-mode="anchor" aria-pressed=${this.mode==="anchor"?"true":"false"} ?disabled=${!t.length} @click=${()=>{this.mode="anchor",this.schedule()}}>${s("לפי קריאה ידנית")}</button>
            <button type="button" data-cal-mode="offset" aria-pressed=${this.mode==="offset"?"true":"false"} @click=${()=>{this.mode="offset",this.schedule()}}>${s("הזנה ידנית")}</button></div></div>
        ${this.mode==="anchor"?n`<div class="fld wide"><label for="ca">${s("קריאה")}</label>
              <div class="inp ${this.fieldErrors.anchor?"err":""}"><select id="ca" data-cal-anchor @change=${i=>r("anchor",i.target.value)}>
                ${t.map(i=>n`<option value=${i.id} ?selected=${i.id===this.anchor}>${pe(i.read_at)} · ${de(i.value_kwh)} ${s("קוט״ש")}</option>`)}</select></div>
              ${this.fieldMsg("anchor")}</div>`:n`<div class="fld wide"><label for="co">${s("הפרש (קוט״ש)")}</label>
              <div class="inp ${this.fieldErrors.offset?"err":""}"><input id="co" data-cal-offset inputmode="decimal" dir="ltr" .value=${this.offset} @input=${i=>r("offset",i.target.value)} /></div>
              ${this.fieldMsg("offset")}</div>`}
        <div class="fld wide"><label for="cn">${s("הערה (לא חובה)")}</label><div class="inp"><input id="cn" data-cal-note maxlength="500" .value=${this.note} @input=${i=>this.note=i.target.value} /></div></div>
        ${this.previewError?n`<div class="alert warn wide" role="status" data-cal-preview="error">${this.previewError}</div>`:e?n`<div class="pv wide" data-cal-preview><div>${s("מ-")}<span class="num">${Bt(e.effective_date)}</span>: ${s("מקדם")} <span class="num">${e.factor}</span>, ${s("הפרש")} <span class="num ltr">${Yt(e.offset_kwh)}</span> ${s("קוט״ש")}</div></div>`:o}
        ${this.error?n`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:o}
      </div>
      <sw-button slot="footer" variant="primary" data-cal-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
    </sw-dialog>`}renderUndo(){const t=this.kind==="undo-reading",e=t?this.log?.items.find(i=>i.id===this.targetId):void 0,a=t?void 0:this.log?.calibrations.find(i=>i.id===this.targetId),r=e?n`${s("הקריאה")} <span class="num">${de(e.value_kwh)}</span> ${s("קוט״ש מ-")}<span class="num">${pe(e.read_at)}</span>`:a?n`${s("הכיול מ-")}<span class="num">${Bt(a.effective_date)}</span>`:"";return n`<sw-dialog open heading=${t?s("ביטול קריאה ידנית"):s("ביטול כיול")} data-undo-dialog @close=${i=>{i.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="wide">${r} ${s("תבוטל ותישאר ברשימה כמבוטלת.")}</div>
        <div class="fld wide"><label for="ur">${s("סיבה (לא חובה)")}</label><div class="inp"><input id="ur" data-undo-reason maxlength="300" .value=${this.reason} @input=${i=>this.reason=i.target.value} /></div></div>
        ${this.error?n`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:o}
      </div>
      <sw-button slot="footer" variant="danger" data-undo-confirm ?disabled=${this.busy} @click=${()=>void this.undo()}>${t?s("ביטול הקריאה"):s("ביטול הכיול")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>${s("חזרה")}</sw-button>
    </sw-dialog>`}render(){return this.kind==="reading"?this.renderReading():this.kind==="calibrate"?this.renderCalibrate():this.kind==="undo-reading"||this.kind==="undo-calibration"?this.renderUndo():o}};N.styles=[yt,xs,st`
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
    `];P([_()],N.prototype,"meterId",2);P([_({attribute:!1})],N.prototype,"log",2);P([_()],N.prototype,"kind",2);P([_()],N.prototype,"targetId",2);P([_()],N.prototype,"presetFactor",2);P([_()],N.prototype,"presetAnchor",2);P([c()],N.prototype,"when",2);P([c()],N.prototype,"value",2);P([c()],N.prototype,"unit",2);P([c()],N.prototype,"note",2);P([c()],N.prototype,"preview",2);P([c()],N.prototype,"previewError",2);P([c()],N.prototype,"error",2);P([c()],N.prototype,"fieldErrors",2);P([c()],N.prototype,"busy",2);P([c()],N.prototype,"date",2);P([c()],N.prototype,"mode",2);P([c()],N.prototype,"anchor",2);P([c()],N.prototype,"factor",2);P([c()],N.prototype,"offset",2);P([c()],N.prototype,"reason",2);N=P([T("elec-reading-dialogs")],N);var zi=Object.defineProperty,Ni=Object.getOwnPropertyDescriptor,rt=(t,e,a,r)=>{for(var i=r>1?void 0:r?Ni(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&zi(e,a,i),i};const Es={reporting:s("מדווח"),stale:s("לא מדווח"),paused:s("מושהה")},Cs={reporting:"c-ok",stale:"c-warn",paused:"c-mut"},cs={hours:s("24 שעות"),days:s("30 ימים"),months:s("12 חודשים")},Ii={install:s("התקנה"),reset:s("איפוס"),replace:s("החלפת מונה"),source_change:s("שינוי מקור")};function Mi(t,e){if(!t.length)return n`<div class="mut">${s("אין נתונים לתקופה")}</div>`;const d=Math.max(...t.map(v=>v.value),1)*1.15,l=588/t.length,h=Math.min(l*.64,24),m=Math.ceil(t.length/12),p=t.reduce((v,$,y)=>$.value>t[v].value?y:v,0);return n`<svg class="chart" viewBox="0 0 ${640} ${170}" role="img" aria-label=${e} data-chart>
    ${nt`<line x1=${26} x2=${614} y1=${148} y2=${148} class="grid" />`}
    ${t.map((v,$)=>{const y=Math.max(v.value>0?2:0,v.value/d*126),B=614-($+1)*l+(l-h)/2,bt=$===t.length-1;return nt`<rect class=${bt?"bar hi":"bar"} x=${B} y=${148-y} width=${h} height=${y} rx="3"><title>${v.label}: ${lt(v.value)}</title></rect>
        ${$%m===0||bt?nt`<text x=${B+h/2} y=${164} text-anchor="middle">${v.label}</text>`:o}
        ${bt||$===p?nt`<text x=${B+h/2} y=${143-y} text-anchor="middle" class="val">${Math.round(v.value)}</text>`:o}`})}
  </svg>`}let G=class extends Oa{constructor(){super("days"),this.points=[],this.log=null,this.logError="",this.dlgDetail=null,this.newName="",this.otherNames=[],this.nameError="",this.finalReading="",this.startReading="0",this.note="",this.replaceError=""}fetchDetail(){return Vs(this.meterId)}beforeLoad(){this.log?.meter_id!==this.meterId&&(this.log=null)}afterLoad(){this.loadSeries(),this.loadLog()}async fetchSeries(t,e,a,r){let i=await qs(this.meterId,e,a,r);return t==="months"&&(i=Ti(i)),()=>{this.points=i}}titles(t){return{heading:ot(t).primary,subheading:ot(t).secondary}}texts(){return{loadError:s("לא ניתן לטעון את המונה"),retry:s("נסה שוב")}}async loadLog(){const t=this.meterId;try{const e=await oi(t);if(t!==this.meterId)return;this.log=e,this.logError=""}catch(e){t===this.meterId&&(this.logError=dt(e))}}openReadingsDialog(t){this.dlgDetail=t.detail,this.dlg=t.detail.kind}async onReadingsSaved(t){this.log=t.detail,this.fire("changed"),await this.refresh(),this.loadSeries()}label(t){const e=new Date(t.t);return this.range==="hours"?gs(t.t).slice(0,2):this.range==="months"?`${e.getMonth()+1}/${String(e.getFullYear()).slice(2)}`:String(e.getDate())}async toggleStatus(){const t=this.detail;if(!(!t||this.busy)){this.busy=!0,this.actionError="";try{await(t.status==="paused"?Ks(t):Us(t)),this.fire("changed"),await this.load()}catch(e){this.actionError=dt(e)}finally{this.busy=!1}}}async confirmRemove(){const t=this.detail;if(!(!t||this.busy)){this.busy=!0,this.actionError="";try{await Ws(t),this.dlg="",this.fire("changed"),this.fire("close")}catch(e){this.actionError=dt(e)}finally{this.busy=!1}}}openRename(){const t=this.detail;t&&(this.newName=t.name,this.nameError="",this.otherNames=[],this.dlg="rename",this.updateComplete.then(()=>window.setTimeout(()=>{const e=this.renderRoot.querySelector("[data-rename-input]");e?.focus(),e?.select()},80)),Te().then(e=>this.otherNames=e.filter(a=>a.id!==t.id).map(a=>a.name)).catch(()=>{}))}async rename(){const t=this.detail;if(!t||this.busy)return;const e=oe(this.newName,this.otherNames);if(e.name&&e.name.toLocaleLowerCase()===t.name.trim().toLocaleLowerCase()&&e.name===t.name)return void(this.dlg="");if(e.error)return void(this.nameError=e.error);this.busy=!0,this.nameError="";try{await Hs(t,e.name),this.dlg="",this.fire("changed"),await this.refresh()}catch(a){a instanceof Jt&&a.code==="revision_conflict"?(this.nameError=s("מישהו אחר שינה את המונה בינתיים. הנתונים רועננו, בדקו את השם ושמרו שוב."),await this.refresh()):this.nameError=dt(a)}finally{this.busy=!1}}openReplace(){this.finalReading=this.detail?.reading_kwh!=null?String(this.detail.reading_kwh):"",this.startReading="0",this.note="",this.replaceError="",this.dlg="replace"}async replace(){const t=this.detail,e=Number(this.finalReading),a=Number(this.startReading);if(!(!t||this.busy)){if(this.finalReading.trim()===""||!Number.isFinite(e)||e<0)return void(this.replaceError=s("צריך להזין קריאה סופית תקינה"));if(this.startReading.trim()===""||!Number.isFinite(a)||a<0)return void(this.replaceError=s("צריך להזין קריאת התחלה תקינה"));this.busy=!0,this.replaceError="";try{this.detail=await Gs(t,{final_reading_kwh:e,start_reading_kwh:a,note:this.note.trim()||void 0}),this.dlg="",this.fire("changed")}catch(r){this.replaceError=dt(r)}finally{this.busy=!1}}}renderBody(t){const e=this.points.map(a=>({label:this.label(a),value:a.kwh}));return n`<div class="body" data-meter-card=${t.id}>
      <div class="row"><span class="chip ${Cs[t.status]}" data-meter-status=${t.status}>${Es[t.status]}</span></div>
      <dl class="kv">
        <dt>${s("אזור")}</dt><dd>${t.area_name??"-"}${t.floor_name?` · ${t.floor_name}`:""}</dd>
        <dt>${s("קריאה נוכחית")}</dt><dd><span class="num">${lt(t.reading_kwh)}</span> <span class="mut">${s("קוט״ש")}</span></dd>
        <dt>${s("דיווח אחרון")}</dt><dd><span class="num">${pe(t.last_report_at)}</span></dd>
        <dt>${s("יחידה")}</dt><dd>${s("קוט״ש")} · ${s("מונה מצטבר")}</dd>
        <dt>${s("בחשבונות")}</dt><dd>${t.accounts.length?t.accounts.join(", "):n`<span class="mut">-</span>`}</dd>
      </dl>
      <div class="row"><h3>${s("צריכה")}</h3><span class="sp"></span>
        ${this.rangeSeg(s("טווח"),a=>cs[a])}</div>
      ${this.chartError?n`<div class="alert err" role="alert">${s("לא ניתן לטעון את גרף הצריכה")}</div>`:Mi(e,s("גרף צריכה, {range}",{range:cs[this.range]}))}
      <h3>${s("תקופות מונה")}</h3>
      <div class="list" data-epochs>${t.epochs.map(a=>n`<div class="li"><div class="grow"><div class="t1">${Ii[a.reason]??a.reason} · <span class="num">${Bt(a.started_at)}</span></div>
        <div class="t2 wrap">${s("קריאת התחלה")} <span class="num">${lt(a.start_reading_kwh)}</span>${a.ended_at?n` · ${s("עד")} <span class="num">${Bt(a.ended_at)}</span>`:""}${a.note?` · ${a.note}`:""}</div></div>${a.ended_at?o:n`<span class="chip acc nodot">${s("פעיל")}</span>`}</div>`)}</div>
      <elec-meter-readings .log=${this.log} error=${this.logError} ?canManage=${this.canManage} @open-dialog=${a=>this.openReadingsDialog(a)}></elec-meter-readings>
      ${this.actionError?n`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>`:o}
      ${this.canManage?this.actionsRow({rename:s("שינוי שם"),replace:s("החלפת מונה"),pause:t.status==="paused"?s("חידוש"):s("השהיה"),remove:s("הסרה"),pauseDisabled:this.busy,onRename:()=>this.openRename(),onReplace:()=>this.openReplace(),onPause:()=>void this.toggleStatus(),onRemove:()=>{this.actionError="",this.dlg="remove"}}):o}
    </div>`}renderDialogs(){return n`
      <sw-dialog ?open=${this.dlg==="remove"} heading=${s("הסרת המונה")} data-meter-remove-dialog @close=${()=>this.dlg=""}>
        <div>${s("המונה יוסר מהרשימה. הנתונים שנאספו יישמרו.")}</div>
        ${this.actionError&&this.dlg==="remove"?n`<div class="alert err" role="alert">${this.actionError}</div>`:o}
        <sw-button slot="footer" variant="danger" data-meter-remove-confirm ?disabled=${this.busy} @click=${()=>void this.confirmRemove()}>${s("הסרה")}</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>${s("ביטול")}</sw-button>
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="rename"} heading=${s("שינוי שם המונה")} data-meter-rename-dialog @close=${()=>this.dlg=""}>
        ${(()=>{const t=oe(this.newName,this.otherNames);return t.name===this.detail?.name&&(t.duplicate=!1),n`<div class="fld">
            <label for="rn">${s("שם המונה")}</label>
            <div class="inp ${this.nameError?"err":""}"><input id="rn" data-rename-input autocomplete="off" aria-invalid=${this.nameError?"true":"false"} aria-describedby="rn-msg" .value=${this.newName}
              @input=${a=>{this.newName=a.target.value,this.nameError=""}}
              @keydown=${a=>{a.key==="Enter"&&(a.preventDefault(),this.rename())}} /></div>
            <div id="rn-msg">
              ${this.nameError?n`<div class="msg" role="alert" data-rename-error>${this.nameError}</div>`:o}
              ${!this.nameError&&t.duplicate?n`<div class="msg" role="alert" data-rename-dup>${_s}</div>`:o}
              <div class="mut" data-rename-hint>${Za}</div>
            </div>
          </div>`})()}
        <sw-button slot="footer" variant="primary" data-rename-save ?disabled=${this.busy||oe(this.newName,this.otherNames).duplicate&&this.newName.trim()!==this.detail?.name} @click=${()=>void this.rename()}>${s("שמירה")}</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>${s("ביטול")}</sw-button>
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="replace"} heading=${s("החלפת מונה")} data-meter-replace-dialog @close=${()=>this.dlg=""}>
        <div class="form">
          <div class="fld"><label for="fr">${s("קריאה סופית של המונה הישן")}</label><div class="inp ${this.replaceError&&!this.finalReading?"err":""}"><input id="fr" data-replace-final inputmode="decimal" .value=${this.finalReading} @input=${t=>this.finalReading=t.target.value} /><span class="mut">${s("קוט״ש")}</span></div></div>
          <div class="fld"><label for="sr">${s("קריאת התחלה של המונה החדש")}</label><div class="inp"><input id="sr" data-replace-start inputmode="decimal" .value=${this.startReading} @input=${t=>this.startReading=t.target.value} /><span class="mut">${s("קוט״ש")}</span></div></div>
          <div class="fld wide"><label for="nt">${s("הערה (לא חובה)")}</label><div class="inp"><input id="nt" data-replace-note .value=${this.note} @input=${t=>this.note=t.target.value} /></div></div>
          ${this.replaceError?n`<div class="alert err wide" role="alert" data-replace-error>${this.replaceError}</div>`:o}
        </div>
        <sw-button slot="footer" variant="primary" data-replace-save ?disabled=${this.busy} @click=${()=>void this.replace()}>${s("החלפה")}</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>${s("ביטול")}</sw-button>
      </sw-dialog>
      ${this.dlg==="reading"||this.dlg==="calibrate"||this.dlg==="undo-reading"||this.dlg==="undo-calibration"?n`<elec-reading-dialogs .meterId=${this.meterId} .log=${this.log} .kind=${this.dlg} .targetId=${this.dlgDetail?.id??""} .presetFactor=${this.dlgDetail?.factor??""}
            .presetAnchor=${this.dlgDetail?.anchor??""} @close=${()=>{this.dlg="",this.dlgDetail=null}} @saved=${t=>void this.onReadingsSaved(t)}></elec-reading-dialogs>`:o}`}};G.styles=[yt,Sa,st`
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
    `];rt([c()],G.prototype,"points",2);rt([c()],G.prototype,"log",2);rt([c()],G.prototype,"logError",2);rt([c()],G.prototype,"dlgDetail",2);rt([c()],G.prototype,"newName",2);rt([c()],G.prototype,"otherNames",2);rt([c()],G.prototype,"nameError",2);rt([c()],G.prototype,"finalReading",2);rt([c()],G.prototype,"startReading",2);rt([c()],G.prototype,"note",2);rt([c()],G.prototype,"replaceError",2);G=rt([T("elec-meter-card")],G);function Ti(t){const e=new Map;for(const a of t){const r=new Date(a.t),i=`${r.getFullYear()}-${String(r.getMonth()+1).padStart(2,"0")}-01T00:00:00Z`;e.set(i,(e.get(i)??0)+a.kwh)}return[...e.entries()].map(([a,r])=>({t:a,kwh:Math.round(r*100)/100}))}var Di=Object.defineProperty,Ri=Object.getOwnPropertyDescriptor,Ht=(t,e,a,r)=>{for(var i=r>1?void 0:r?Ri(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Di(e,a,i),i};const ji={search:f("חיפוש מונה"),view:f("תצוגה"),cards:f("כרטיסים"),table:f("טבלה"),area:f("אזור"),areas:f("אזורים"),allAreas:f("כל האזורים"),fold:f("כיווץ"),unfold:f("הרחבה"),addMeter:f("הוספת מונה"),loadError:f("לא ניתן לטעון את המונים"),retry:f("נסה שוב")};let St=class extends Na{constructor(){super({viewKey:"sw.elec.meters.view",collapseKey:"sw.elec.meters.collapsed",route:"/infra/electricity/meters",access:R,onAccess:$s}),this.picked=[],this.pickedNames={},this.nameTouched=!1,this.adding=!1,this.addErrors=[],this.noticeTimer=0}disconnectedCallback(){window.clearTimeout(this.noticeTimer),super.disconnectedCallback()}texts(){return ji}fetchMeters(){return Te()}areaTree(){return Zs(this.meters)}inArea(t,e){const a=e.startsWith("floor:")?e.slice(6):"";return a?(t.floor_id??t.floor_name??"_none")===a:t.area_id===e}matchesSearch(t,e){return ws(t).includes(e)||(t.area_name??"").toLowerCase().includes(e)}flash(t){this.notice=t,window.clearTimeout(this.noticeTimer),this.noticeTimer=window.setTimeout(()=>this.notice="",6e3)}openAdd(){this.picked=[],this.pickedNames={},this.nameTouched=!1,this.addErrors=[],this.setParams({add:"1",meter:null})}closeAdd(){this.setParams({add:null})}onPick(t){this.picked=t.detail.selected;const e={};for(const a of this.picked)e[a]=this.pickedNames[a]??t.detail.names?.[a]??"";this.pickedNames=e}nameChecks(){return this.picked.map(t=>{const e=[...this.meters.map(a=>a.name),...this.picked.filter(a=>a!==t).map(a=>this.pickedNames[a]??"")];return{id:t,...oe(this.pickedNames[t]??"",e)}})}async confirmAdd(){if(!this.picked.length||this.adding)return;this.nameTouched=!0;const t=this.nameChecks();if(t.some(a=>a.error))return;this.adding=!0,this.addErrors=[];const e=await Ys(t.map(a=>({entity_id:a.id,name:a.name})));this.adding=!1,e.added.length&&(await this.load(!1),this.flash(e.added.length===1?f("המונה נוסף"):f("{n} מונים נוספו",{n:e.added.length}))),e.failed.length?(this.addErrors=e.failed.map(a=>a.message),this.picked=e.failed.map(a=>a.entity_id)):(this.picked=[],this.closeAdd())}statusChip(t){return n`<span class="chip ${Cs[t.status]}" data-status=${t.status}>${Es[t.status]}</span>`}staleNote(t){return t.status==="stale"&&t.last_report_at?n` <span class="mut">${f("מ-")}<span class="num">${gs(t.last_report_at)}</span></span>`:o}openMeter(t){this.setParams({meter:t.id})}renderTiles(){const t=Xs(this.meters);return n`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${f("היום")}</div><div class="v"><span class="num">${Je(t.today_kwh)}</span><span class="u">${f("קוט״ש")}</span></div></div>
      <div class="tile"><div class="k">${f("מתחילת החודש")}</div><div class="v"><span class="num" data-month>${this.meters.some(e=>e.month_kwh!=null)?Je(t.month_kwh):"-"}</span><span class="u">${f("קוט״ש")}</span></div></div>
      <div class="tile"><div class="k">${f("מדווחים")}</div><div class="v"><span class="num" data-count="reporting">${t.reporting}</span><span class="u">${f("מתוך {n}",{n:t.total})}</span></div></div>
      <div class="tile" ?data-warn=${t.stale>0}><div class="k">${f("לא מדווחים")}</div><div class="v" style=${t.stale?"color:var(--sw-warning-text)":""}><span class="num" data-count="stale">${t.stale}</span></div></div>
    </div>`}entityLine(t,e){const a=ot(t).secondary;return a?n`<div class="${e} ent" data-meter-entity title=${f("שם הישות")}>${a}</div>`:o}nameOf(t){return n`${ot(t).primary}${this.entityLine(t,"mut")}`}renderTable(t){const e=t.some(a=>a.accounts_count!=null);return n`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>${f("שם")}</th><th>${f("אזור")}</th><th class="n">${f("קריאה נוכחית (קוט״ש)")}</th><th class="n">${f("היום")}</th><th class="n">${f("מתחילת החודש")}</th><th>${f("מצב")}</th>${e?n`<th class="dsk">${f("בחשבונות")}</th>`:o}</tr></thead>
      <tbody>${t.map(a=>n`<tr class="pick" tabindex="0" data-meter=${a.id} @click=${()=>this.openMeter(a)} @keydown=${r=>this.onKey(r,a)}>
        <td class="b">${this.nameOf(a)}</td><td>${a.area_name??"-"}<span class="mut dsk"> · ${a.floor_name??""}</span></td>
        <td class="n"><span class="num">${lt(a.reading_kwh)}</span></td><td class="n"><span class="num">${lt(a.today_kwh)}</span></td><td class="n"><span class="num">${lt(a.month_kwh)}</span></td>
        <td>${this.statusChip(a)}${this.staleNote(a)}</td>${e?n`<td class="dsk">${a.accounts_count||n`<span class="mut">-</span>`}</td>`:o}</tr>`)}</tbody></table></div>`}renderCards(t){return n`<div class="cards desk-only" data-meters-cards>${t.map(e=>n`<div class="card mcard" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="row"><b>${ot(e).primary}</b><span class="sp"></span>${this.statusChip(e)}</div>
      ${this.entityLine(e,"mut")}
      <div class="mut">${e.area_name??""}${e.floor_name?` · ${e.floor_name}`:""}</div>
      <div class="row" style="align-items:baseline"><span class="big num">${lt(e.today_kwh)}</span><span class="mut">${f("קוט״ש היום")}</span><span class="sp"></span><span class="mut num">${lt(e.reading_kwh)}</span></div></div>`)}</div>`}renderRows(t){return n`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${t.map(e=>n`<div class="li pick" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="grow"><div class="t1">${ot(e).primary}</div>${this.entityLine(e,"t2")}<div class="t2">${e.area_name??""} · ${f("היום")} <span class="num">${lt(e.today_kwh)}</span> ${f("קוט״ש")}</div></div>
      <div style="text-align:end">${this.statusChip(e)}<div class="t2 num" style="margin-block-start:4px">${lt(e.reading_kwh)}</div></div></div>`)}</div>`}renderNames(){return n`<div class="names" data-add-names>
      ${this.nameChecks().map((t,e)=>{const a=t.error&&(this.nameTouched||t.duplicate);return n`<div class="fld">
          <label for="mn${e}">${this.picked.length>1?f("שם המונה {n}",{n:e+1}):f("שם המונה")}</label>
          <div class="inp ${a?"err":""}"><input id="mn${e}" data-add-name=${t.id} autocomplete="off" aria-invalid=${a?"true":"false"} .value=${this.pickedNames[t.id]??""}
            @input=${r=>this.pickedNames={...this.pickedNames,[t.id]:r.target.value}} /></div>
          ${a?n`<div class="msg" role="alert" data-add-name-error>${t.error}</div>`:o}
        </div>`})}
    </div>`}renderAdd(){const t=this.params.get("add")==="1"&&this.access.manage;return n`<sw-dialog ?open=${t} wide heading=${f("הוספת מונה")} data-add-dialog @close=${()=>this.closeAdd()}>
      ${t?n`<elec-meter-picker mode="register" multi .selected=${this.picked} @change=${e=>this.onPick(e)}></elec-meter-picker>`:o}
      ${t&&this.picked.length?this.renderNames():o}
      ${this.addErrors.length?n`<div class="errs" data-add-errors>${this.addErrors.map(e=>n`<div class="alert err" role="alert">${e}</div>`)}</div>`:o}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked.length||this.adding||this.nameChecks().some(e=>e.duplicate)} @click=${()=>void this.confirmAdd()}>${f("הוספה")}${this.picked.length>1?` (${this.picked.length})`:""}</sw-button>
      <sw-button slot="footer" data-add-cancel @click=${()=>this.closeAdd()}>${f("ביטול")}</sw-button>
    </sw-dialog>`}frame(t,e){return n`<div data-elec="meters" data-state=${t} aria-busy=${t==="loading"?"true":o} style=${t==="ready"?"display:flex;flex-direction:column;gap:14px":o}>${e}</div>`}renderForbidden(){return n`<sw-state-panel state="forbidden" data-elec="meters" data-state="forbidden"></sw-state-panel>`}skeletonRow(t){return n`<div class="row" style="padding:10px 0">${t}</div>`}renderEmpty(t){return n`<sw-state-panel icon="bolt" state="empty" heading=${f("אין מונים עדיין")}>${t}</sw-state-panel>`}renderNoResults(){return n`<sw-state-panel icon="bolt" state="empty" compact heading=${f("לא נמצאו מונים")} data-no-results></sw-state-panel>`}renderCard(t){return n`<elec-meter-card .meterId=${t} ?canManage=${this.access.manage} @close=${()=>this.setParams({meter:null})} @changed=${()=>void this.load(!1)}></elec-meter-card>`}};St.styles=[yt,Pa,st`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-inline-size: 0;
      }
      .head .inp {
        flex: 0 1 280px;
      }
      .ent {
        font-weight: var(--sw-fw-regular);
        font-size: var(--sw-fs-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-inline-size: 100%;
      }
      td .ent {
        max-inline-size: 320px;
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
    `,za,st`
      @media (max-width: 899px) {
        .phone-only {
          display: flex;
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
      /* R5 fix: the R5 type (bolder chips and names) made the meters table 8 px wider than its card at 1024 px (classic); the cells
         give 2 px of inline padding a side back so the table fits its card again */
      table.t[data-meters-table] th,
      table.t[data-meters-table] td {
        padding-inline: 10px;
      }
    `,us];Ht([c()],St.prototype,"picked",2);Ht([c()],St.prototype,"pickedNames",2);Ht([c()],St.prototype,"nameTouched",2);Ht([c()],St.prototype,"adding",2);Ht([c()],St.prototype,"addErrors",2);St=Ht([T("elec-meters-page")],St);var Li=Object.defineProperty,Bi=Object.getOwnPropertyDescriptor,wt=(t,e,a,r)=>{for(var i=r>1?void 0:r?Bi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Li(e,a,i),i};const hs=[{id:"holiday",label:s("חג (כמו שבת)")},{id:"holiday_eve",label:s("ערב חג (כמו שישי)")},{id:"regular",label:s("יום רגיל")}],ps=t=>bs[fs[new Date(`${t}T12:00:00Z`).getUTCDay()]];let mt=class extends Y{constructor(){super(...arguments),this.st="loading",this.year=Number(tt().slice(0,4)),this.data=null,this.busy=!1,this.error="",this.note="",this.add={date:"",kind:"holiday",name:""},this.addErr=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{this.data=await b().getCalendar(this.year),this.st="ready"}catch(t){this.error=M(t),this.st=De(t)?"forbidden":"error"}}setYear(t){this.year=t,this.note="",this.load()}async run(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await t();this.data=e.year===this.year?e:await b().getCalendar(this.year);const a=e.drafts_to_recalculate??0;this.note=a?a===1?s('טיוטה אחת מושפעת מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".'):s('{n} טיוטות מושפעות מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".',{n:a}):""}catch(e){this.error=M(e)}finally{this.busy=!1}}}setKind(t,e){if(!this.data)return;const a=this.data.revision;this.run(()=>b().setCalendarDay(t.date,e,t.name_he,a))}restore(t){if(!this.data)return;const e=this.data.revision;this.run(()=>b().removeCalendarDay(t.date,e))}addDay(){const t=this.add;if(this.addErr=q(t.date)?"":s("צריך לבחור תאריך"),this.addErr||!this.data)return;const e=this.data.revision;this.run(async()=>{const a=await b().setCalendarDay(t.date,t.kind,t.name,e);return this.add={date:"",kind:"holiday",name:""},Number(t.date.slice(0,4))!==this.year&&(this.year=Number(t.date.slice(0,4))),a})}render(){const t=R();if(!t.view&&!t.bills&&!t.manage)return n`<div class="page" data-elec="settings-calendar" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה"))}</div>`;if(this.st==="loading")return n`<div class="page" data-elec="settings-calendar" data-state="loading">${et(5)}</div>`;if(this.st==="forbidden")return n`<div class="page" data-elec="settings-calendar" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה"))}</div>`;if(this.st==="error"||!this.data)return n`<div class="page" data-elec="settings-calendar" data-state="error">${E("error","warning",s("לא ניתן לטעון את הימים המיוחדים"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;const e=this.data,a=t.manage,r=e.days;return n`<div class="page" data-elec="settings-calendar" data-state="ready">
      ${this.error?C("err",this.error):o}
      ${this.note?C("info",this.note):o}
      <div class="card ${this.phone?"":"flush"}">
        <div class="hd"><b class="h3">${s("ימים מיוחדים")}</b>
          <div class="row" role="group" aria-label=${s("שנה")}><sw-button variant="ghost" size="sm" iconOnly icon="chevronBack" label=${s("השנה הקודמת")} data-year-prev @click=${()=>this.setYear(this.year-1)}></sw-button><b class="num" data-year>${this.year}</b><sw-button variant="ghost" size="sm" iconOnly icon="chevron" label=${s("השנה הבאה")} data-year-next @click=${()=>this.setYear(this.year+1)}></sw-button></div>
          <span class="sp"></span>
          <div class="seg" role="group" aria-label=${s("מקור החגים")}><button type="button" data-generator="israel" aria-pressed=${e.generator==="israel"} ?disabled=${!a||this.busy} @click=${()=>e.generator!=="israel"&&void this.run(()=>b().setCalendarGenerator("israel",e.revision,this.year))}>${s("חגי ישראל מחושבים")}</button><button type="button" data-generator="none" aria-pressed=${e.generator==="none"} ?disabled=${!a||this.busy} @click=${()=>e.generator!=="none"&&void this.run(()=>b().setCalendarGenerator("none",e.revision,this.year))}>${s("ימים ידניים בלבד")}</button></div>
        </div>
        ${r.length?this.phone?n`<div class="list" data-calendar>${r.map(i=>n`<div class="li" data-day=${i.date} data-kind=${i.kind} style="flex-wrap:wrap"><div class="grow"><div class="t1">${i.name_he||i.kind_he}</div><div class="t2">${u(S(i.date))} · ${s("יום {weekday}",{weekday:ps(i.date)})} · ${i.source==="manual"?s("ידני"):s("מחושב")}</div></div>${this.kindCell(i,a)}
                ${a&&i.source==="manual"?n`<sw-button variant="ghost" size="sm" data-restore=${i.date} ?disabled=${this.busy} @click=${()=>this.restore(i)}>${i.generated?s("החזרה לחישוב"):s("הסרה")}</sw-button>`:o}</div>`)}</div>`:n`<div class="scrollx"><table class="t" data-calendar><thead><tr><th>${s("תאריך")}</th><th>${s("יום")}</th><th>${s("שם")}</th><th>${s("נחשב")}</th><th>${s("מקור")}</th><th></th></tr></thead><tbody>
              ${r.map(i=>n`<tr data-day=${i.date} data-kind=${i.kind}><td class="num" style="text-align:start">${S(i.date)}</td><td>${ps(i.date)}</td><td class="b">${i.name_he||(i.generated?.name_he??"")}</td><td>${this.kindCell(i,a)}</td>
                <td>${i.source==="manual"?n`<span class="chip c-warn nodot">${s("ידני")}</span>`:n`<span class="chip c-mut nodot">${s("מחושב")}</span>`}</td>
                <td>${a?i.source==="manual"?n`<sw-button variant="ghost" size="sm" data-restore=${i.date} ?disabled=${this.busy} @click=${()=>this.restore(i)}>${i.generated?s("החזרה לחישוב"):s("הסרה")}</sw-button>`:o:o}</td></tr>`)}</tbody></table></div>`:n`<div class="mut" style="padding:0 16px 16px" data-calendar-empty>${s("אין ימים מיוחדים בשנה הזו.")}</div>`}
      </div>
      ${a?n`<div class="card" data-calendar-add><div class="hd"><b class="h3">${s("הוספת יום")}</b></div>
        <div class="form">
          <div class="fld"><label for="cd">${s("תאריך")}</label><input id="cd" type="date" lang=${ct()} class="ltr ${this.addErr?"err":""}" data-add-date .value=${this.add.date} @change=${i=>{this.add={...this.add,date:i.target.value},this.addErr=""}} />${this.addErr?n`<div class="msg" role="alert">${this.addErr}</div>`:o}</div>
          <div class="fld"><label for="ck">${s("נחשב")}</label><select id="ck" data-add-kind @change=${i=>this.add={...this.add,kind:i.target.value}}>${hs.map(i=>n`<option value=${i.id} .selected=${i.id===this.add.kind}>${i.label}</option>`)}</select></div>
          <div class="fld wide"><label for="cn">${s("שם (לא חובה)")}</label><input id="cn" data-add-name maxlength="60" .value=${this.add.name} @input=${i=>this.add={...this.add,name:i.target.value}} /></div>
        </div>
        <div class="row" style="margin-block-start:12px"><sw-button variant="primary" data-add-day ?disabled=${this.busy} @click=${()=>this.addDay()}>${s("הוספה")}</sw-button></div></div>`:o}
      <div class="mut">${e.note_he}</div>
    </div>`}kindCell(t,e){return e?n`<select aria-label=${s("סוג היום {date}",{date:S(t.date)})} data-kind-select=${t.date} ?disabled=${this.busy} @change=${a=>this.setKind(t,a.target.value)}>${hs.map(a=>n`<option value=${a.id} .selected=${a.id===t.kind}>${a.label}</option>`)}</select>`:n`<span>${t.kind_he}</span>`}};wt([c()],mt.prototype,"st",2);wt([c()],mt.prototype,"year",2);wt([c()],mt.prototype,"data",2);wt([c()],mt.prototype,"busy",2);wt([c()],mt.prototype,"error",2);wt([c()],mt.prototype,"note",2);wt([c()],mt.prototype,"add",2);wt([c()],mt.prototype,"addErr",2);mt=wt([T("elec-settings-calendar")],mt);var Ai=Object.defineProperty,Fi=Object.getOwnPropertyDescriptor,_t=(t,e,a,r)=>{for(var i=r>1?void 0:r?Fi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(r?l(e,a,i):l(i))||i);return r&&i&&Ai(e,a,i),i};const Rt=[{key:"raw_retention_days",label:f("קריאות גולמיות"),usage:"raw_bytes",owner:"system"},{key:"interval_retention_months",label:f("נתוני רבע שעה"),usage:"interval_bytes",owner:"system"},{key:"bill_retention_years",label:f("חיובים וקבצי PDF"),usage:"bill_bytes",owner:"system"},{key:"draft_retention_days",label:f("טיוטות שלא הונפקו"),usage:"draft_bytes",owner:"manage"}],Vi={ימים:f("ימים"),חודשים:f("חודשים"),שנים:f("שנים")};let pt=class extends Ot{constructor(){super(...arguments),this.bubbleSkin=new Vt(this),this.data=null,this.phase="loading",this.error="",this.values={},this.saving=!1,this.saveError="",this.saved=!1,this.access=R()}connectedCallback(){super.connectedCallback(),this.stop=$s(t=>this.access=t),this.load()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}async load(){this.phase="loading";try{const t=await Qs();this.data=t,this.values=Object.fromEntries(Rt.map(e=>[e.key,String(t[e.key])])),this.phase="ready"}catch(t){this.error=dt(t),this.phase="error"}}editable(t){return!!this.data?.editable[t.key]}problem(t){const e=(this.values[t.key]??"").trim(),a=this.data?.ranges[t.key]??Ke[t.key],r=Number(e);return e===""||!Number.isInteger(r)||r<a.min||r>a.max?f("הערך חייב להיות בין {min} ל-{max}",{min:a.min,max:a.max}):""}changed(){const t={};if(!this.data)return t;for(const e of Rt){const a=Number(this.values[e.key]);this.editable(e)&&!this.problem(e)&&a!==this.data[e.key]&&(t[e.key]=a)}return t}async save(){const t=this.changed();if(!(!Object.keys(t).length||this.saving)){this.saving=!0,this.saveError="",this.saved=!1;try{this.data=await Js(t),this.values=Object.fromEntries(Rt.map(e=>[e.key,String(this.data[e.key])])),this.saved=!0}catch(e){this.saveError=dt(e)}finally{this.saving=!1}}}render(){if(!this.access.system&&!this.access.manage)return n`<sw-state-panel state="forbidden" data-elec="retention" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return n`<div data-elec="retention" data-state="loading" aria-busy="true" class="card">${[0,1,2,3].map(()=>n`<div class="row" style="padding:12px 0"><div class="skl" style="inline-size:36%"></div><span class="sp"></span><div class="skl" style="inline-size:20%"></div></div>`)}</div>`;if(this.phase==="error"||!this.data)return n`<div data-elec="retention" data-state="error"><sw-state-panel state="error" heading=${f("לא ניתן לטעון את ההגדרות")} hint=${this.error} actionLabel=${f("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel></div>`;const t=this.data,e=Rt.reduce((i,d)=>i+(t.usage[d.usage]??0),0),a=Object.keys(this.changed()).length>0,r=Rt.some(i=>this.editable(i)&&this.problem(i));return n`<div data-elec="retention" data-state="ready" class="card">
      <div class="list">${Rt.map(i=>{const d={...Ke[i.key],...t.ranges[i.key]},l=this.editable(i)?this.problem(i):"",h=Number(this.values[i.key]),m=!l&&h!==t[i.key];return n`<div class="rowx" data-retention=${i.key}>
          <div class="grow"><div class="t1">${i.label}</div>
            <div class="t2">${f("{min} עד {max}",{min:d.min,max:d.max})} · ${f("בשימוש")} <span class="num" data-usage>${t.usage[i.usage]==null?"-":Ee(t.usage[i.usage])}</span>${m&&i.key!=="draft_retention_days"?n` · ${f("הערכה לערך החדש")} <span class="num" data-estimate>${Ee(ta(i.key,h,t.meter_count))}</span>`:o}</div></div>
          <div class="fld"><div class="inp ${l?"err":""}"><input inputmode="numeric" data-retention-input=${i.key} aria-label=${i.label} aria-invalid=${l?"true":"false"} ?disabled=${!this.editable(i)} .value=${this.values[i.key]??""}
            @input=${p=>{this.saved=!1,this.values={...this.values,[i.key]:p.target.value}}} /><span class="mut">${Vi[d.unit]??d.unit}</span></div>
            ${l?n`<div class="msg" role="alert" data-retention-error=${i.key}>${l}</div>`:o}</div>
        </div>`})}</div>
      ${this.saveError?n`<div class="alert err" role="alert" style="margin-block-start:12px" data-save-error>${this.saveError}</div>`:o}
      <div class="foot"><span class="mut">${f("נתונים בתוך תקופה של טיוטה פתוחה לא נמחקים.")}</span><span class="mut">${f("סה״כ בשימוש")} <span class="num">${Ee(e)}</span></span><span class="sp"></span>
        ${this.saved?n`<span class="ok" role="status" data-saved>${f("נשמר")}</span>`:o}
        <sw-button variant="primary" data-retention-save ?disabled=${!a||r||this.saving} @click=${()=>void this.save()}>${f("שמירה")}</sw-button></div>
    </div>`}};pt.styles=[yt,st`
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
    `,us];_t([c()],pt.prototype,"data",2);_t([c()],pt.prototype,"phase",2);_t([c()],pt.prototype,"error",2);_t([c()],pt.prototype,"values",2);_t([c()],pt.prototype,"saving",2);_t([c()],pt.prototype,"saveError",2);_t([c()],pt.prototype,"saved",2);_t([c()],pt.prototype,"access",2);pt=_t([T("elec-settings-retention")],pt);
