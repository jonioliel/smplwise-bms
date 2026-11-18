import{Y as Ms,j as c,k as T,uD as s,b as r,em as R,A as o,g as et,ay as _,i as St,aL as Ft,a as Qt,ei as ot,a6 as rt,C9 as Ve,n as lt,mr as Me,Ca as ye,uE as bt,a3 as Ts,bn as ie,b4 as Ds,AX as Rs,Cb as js,ms as Ls,Cc as Bs,Cd as As,Ce as Fs,Cf as Vs,Cg as qs,d7 as f,aU as cs,eo as hs,Ch as Ks,Ci as Us,Cj as Ws,Ck as Hs,Cl as qe,Cm as Zs,Cn as Gs}from"./index-BiEy1mLY.js";import{E as G,n as u,g as Yt,h as b,s as E,i as tt,j as g,k as we,p as Oe,l as J,o as Mt,q as V,r as M,t as ce,u as ut,v as C,w as _e,x as S,y as Ys,z as Xs,A as Rt,B,C as Ke,D as Ue,F as Pe,G as ze,H as Qs,I as Js,P as ta,J as nt,K as ea,L as sa,N as jt,O as aa,Q as ia,R as pt,S as Ne,T as ra,U as na,V as We,W as la,X as da,Y as oa,Z as ca,_ as ps,$ as us,a0 as ha,a1 as ke,a2 as pa,a3 as ua,a4 as ne,a5 as re,a6 as $a,a7 as ma,a8 as He,a9 as $s,aa as ms,ab as Te,ac as Ze,f as Lt,ad as Gt,ae as le,b as he,m as va,M as fa,a as vs,c as ba,d as ga,e as ya,af as Ge,ag as xe}from"./meters-page-base-DqVYD_DT.js";import{e as gt}from"./styles-CsZmZ4S-.js";import{b as Xt}from"./day-key-Bn1dxlC5.js";import"./sw-place-tree-x5LSOFBw.js";import{FIXTURE_NOW as wa}from"./fixtures-Db2whdpa.js";const zt="/infra/electricity",_a="/system/infra",_t=t=>`#${t}`,I={accounts:()=>`${zt}/accounts`,accountNew:()=>`${zt}/accounts/new`,account:(t,e="")=>`${zt}/accounts/${t}${e?`/${e}`:""}`,bills:()=>`${zt}/bills`,bill:t=>`${zt}/bills/${t}`,customers:()=>`${zt}/customers`,customer:t=>`${zt}/customers/${t}`,settings:t=>`${_a}/${t}`},z={accounts:()=>_t(I.accounts()),accountNew:()=>_t(I.accountNew()),account:(t,e="")=>_t(I.account(t,e)),bills:()=>_t(I.bills()),bill:t=>_t(I.bill(t)),customers:()=>_t(I.customers()),customer:t=>_t(I.customer(t)),settings:t=>_t(I.settings(t))},Z=t=>Ms(t);var ka=Object.defineProperty,xa=Object.getOwnPropertyDescriptor,Jt=(t,e,a,n)=>{for(var i=n>1?void 0:n?xa(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&ka(e,a,i),i};const Ye="sw.elec.accounts.view";let Bt=class extends G{constructor(){super(...arguments),this.st="loading",this.rows=[],this.q="",this.view="table",this.status=t=>t.stale?r`<span class="chip c-warn">${s("מונה לא מדווח")}</span>`:r`<span class="chip c-ok">${s("תקין")}</span>`,this.last=t=>{const e=t.account.last_bill;return e?r`${e.number?u(e.number):s("טיוטה")} ${Yt(e.state)}`:r`<span class="mut">-</span>`}}connectedCallback(){super.connectedCallback();try{this.view=localStorage.getItem(Ye)==="cards"?"cards":"table"}catch{}this.load()}async load(){this.st="loading";try{this.rows=await b().listAccounts(),this.st=this.rows.length?"ready":"empty"}catch{this.st="error"}}setView(t){this.view=t;try{localStorage.setItem(Ye,t)}catch{}}render(){const t=R(),e=t.bills;if(!t.view)return r`<div class="page" data-elec="accounts" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לצפות בחשבונות"))}</div>`;const a=this.q.trim(),n=this.rows.filter(l=>!a||l.account.name.includes(a)||l.account.customer.name.includes(a)),i=r`<div class="row">
      <input type="search" data-search aria-label=${s("חיפוש חשבון או לקוח")} placeholder=${s("חיפוש חשבון או לקוח")} .value=${this.q} @input=${l=>this.q=l.target.value} />
      ${this.phone?o:r`<div class="seg" role="group" aria-label=${s("תצוגה")}>
        <button type="button" data-view="cards" aria-pressed=${this.view==="cards"} @click=${()=>this.setView("cards")}>${s("כרטיסים")}</button>
        <button type="button" data-view="table" aria-pressed=${this.view==="table"} @click=${()=>this.setView("table")}>${s("טבלה")}</button></div>`}
      <span class="sp"></span>
      ${t.manage?r`<a class="btn pri ${this.phone?"sm":""}" data-new-account href=${z.accountNew()}>${s("+ חשבון חדש")}</a>`:o}
    </div>`;let d;return this.st==="loading"?d=tt(6):this.st==="error"?d=E("error","warning",s("לא ניתן לטעון את החשבונות"),{label:s("נסה שוב"),run:()=>void this.load()}):this.st==="empty"?d=E("empty","bolt",s("אין חשבונות עדיין"),t.manage?{label:s("+ חשבון חדש"),primary:!0,run:()=>Z(I.accountNew())}:void 0):n.length?this.phone?d=r`<div class="list" data-elec-list>${n.map(l=>r`<a class="li" href=${z.account(l.account.id)} data-account-row=${l.account.id}>
        <div class="grow"><div class="t1">${l.account.name}</div><div class="t2">${l.account.customer.name} · ${u(g(l.kwh??0))} ${s("קוט״ש")}${e&&l.amount!==void 0?r` · ${u(we(l.amount))}`:o}</div></div>${this.status(l)}</a>`)}</div>`:this.view==="cards"?d=r`<div class="grid-cards" data-elec-list>${n.map(l=>r`<div class="card" data-account-row=${l.account.id}>
        <div class="row"><a class="rowlink h3" href=${z.account(l.account.id)}>${l.account.name}</a><span class="sp"></span>${this.status(l)}</div>
        <div class="mut">${l.account.customer.name} · ${Oe(l.account.period_months,l.account.period_anchor_day,l.account.period_anchor_month)}</div>
        <div class="row" style="margin-block-start:10px;align-items:baseline"><span class="big">${u(g(l.kwh??0))}</span><span class="mut">${s("קוט״ש בתקופה")}</span><span class="sp"></span>${e&&l.amount!==void 0?r`<b class="big amt">${u(we(l.amount))}</b>`:o}</div>
        ${e?r`<div class="mut" style="margin-block-start:6px">${s("חיוב אחרון:")} ${this.last(l)}</div>`:o}</div>`)}</div>`:d=r`<div class="card flush scrollx" data-elec-list><table class="t">
        <thead><tr><th>${s("חשבון")}</th><th>${s("לקוח")}</th><th class="hide-tablet">${s("נוסחה")}</th><th>${s("תקופה")}</th><th class="num">${s("צריכה בתקופה")}</th>${e?r`<th class="num">${s("סכום עד כה")}</th><th>${s("חיוב אחרון")}</th>`:o}<th>${s("מצב")}</th></tr></thead>
        <tbody>${n.map(l=>r`<tr class="go" data-account-row=${l.account.id} @click=${()=>Z(I.account(l.account.id))}>
          <td class="b"><a class="rowlink" href=${z.account(l.account.id)} @click=${h=>h.stopPropagation()}>${l.account.name}</a></td><td>${l.account.customer.name}</td>
          <td class="mut ell hide-tablet">${l.account.formula.sentence_he}</td><td>${Oe(l.account.period_months,l.account.period_anchor_day,l.account.period_anchor_month)}</td>
          <td class="num">${g(l.kwh??0)}</td>${e?r`<td class="num">${l.amount!==void 0?we(l.amount):""}</td><td>${this.last(l)}</td>`:o}<td>${this.status(l)}</td></tr>`)}</tbody></table></div>`:d=E("empty","search",s("לא נמצאו חשבונות")),r`<div class="page" data-elec="accounts" data-state=${this.st==="ready"&&!n.length?"empty":this.st}>
      ${this.st==="ready"||this.st==="empty"||this.st==="loading"?i:o}
      ${d}
    </div>`}};Jt([c()],Bt.prototype,"st",2);Jt([c()],Bt.prototype,"rows",2);Jt([c()],Bt.prototype,"q",2);Jt([c()],Bt.prototype,"view",2);Bt=Jt([T("elec-accounts-list")],Bt);var Ea=Object.defineProperty,Ca=Object.getOwnPropertyDescriptor,vt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ca(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ea(e,a,i),i};let st=class extends St{constructor(){super(...arguments),this.account=null,this.open=!1,this.choice="last",this.from="",this.to="",this.busy=!1,this.error="",this.errorBill="",this.existing=[],this.skin=new Ft(this)}willUpdate(t){if(t.has("open")&&this.open&&this.account){this.choice="last",this.error="",this.errorBill="";const e=this.periods();this.from=e.last.from,this.to=e.last.to,b().listBills({account_id:this.account.id}).then(a=>this.existing=a.items).catch(()=>this.existing=[])}}periods(){const t=this.account,e=J(),a=Mt(e,t.period_months,t.period_anchor_day,t.period_anchor_month),n=Xt(a.from,-1);return{last:{from:Mt(n,t.period_months,t.period_anchor_day,t.period_anchor_month).from,to:n},current:{from:a.from,to:e}}}range(){const t=this.periods();return this.choice==="last"?t.last:this.choice==="current"?t.current:{from:this.from,to:this.to}}rangeError(){return this.choice!=="range"?"":!V(this.from)||!V(this.to)?s("צריך לבחור תאריך התחלה ותאריך סיום"):this.to<this.from?s("תאריך הסיום חייב להיות אחרי תאריך ההתחלה"):""}overlap(){const t=this.range();return this.existing.find(e=>e.state!=="void"&&e.state!=="draft"&&!(t.to<e.period.from||t.from>e.period.to))}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async create(){if(!this.account||this.busy)return;this.busy=!0,this.error="",this.errorBill="";const t=this.range(),e=this.choice==="last"?{kind:"last"}:{kind:"range",from:t.from,to:t.to};try{const a=await b().createBill(this.account.id,e);this.close(),Z(I.bill(a.id))}catch(a){this.error=M(a),a instanceof Qt&&(ce(a)==="period_overlap"||ce(a)==="draft_exists")&&(this.errorBill=String(a.body.details?.bill_id??""))}finally{this.busy=!1}}render(){const t=this.account;if(!t)return o;const e=this.periods(),a=this.overlap(),n=this.rangeError(),i=(d,l,h)=>r`<label class="li ${this.choice===d?"sel":""}"><input type="radio" name="period" data-period=${d} .checked=${this.choice===d} @change=${()=>{this.choice=d,this.error=""}} /><span class="ind"></span>
      <div class="grow"><div class="t1">${l}</div>${h?r`<div class="t2">${h}</div>`:o}</div></label>`;return r`<elec-dialog heading=${s("הפקת חיוב")} ?open=${this.open} data-bill-create @close=${()=>this.close()}>
      <div class="mut">${t.name}</div>
      <div class="list" role="radiogroup" aria-label=${s("תקופה")}>
        ${i("last",s("התקופה האחרונה"),u(ut(e.last.from,e.last.to)))}
        ${i("current",s("התקופה הנוכחית עד היום"),u(ut(e.current.from,e.current.to)))}
        ${i("range",s("טווח אחר"),o)}
      </div>
      ${this.choice==="range"?r`<div class="form">
            <div class="fld"><label for="bf">${s("מתאריך")}</label><input id="bf" type="date" lang=${ot()} name="from" data-range-from .value=${this.from} @change=${d=>this.from=d.target.value} /></div>
            <div class="fld"><label for="bt">${s("עד תאריך")}</label><input id="bt" type="date" lang=${ot()} name="to" data-range-to .value=${this.to} @change=${d=>this.to=d.target.value} /></div>
          </div>`:o}
      ${n?C("err",n):o}
      ${a?C("err",r`${s("כבר קיים חיוב")} ${u(a.number??"")} ${s("לתקופה הזו. אפשר")} <a class="lnk" href=${z.bill(a.id)}>${s("לתקן אותו")}</a> ${s("במקום ליצור חדש.")}`):o}
      ${this.error&&!a?C("err",r`${this.error}${this.errorBill?r` <a class="lnk" href=${z.bill(this.errorBill)}>${s("לפתיחת החיוב")}</a>`:o}`):o}
      <sw-button variant="primary" slot="actions" data-create ?disabled=${this.busy||!!a||!!n} @click=${()=>void this.create()}>${s("יצירת טיוטה")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
    </elec-dialog>`}};st.styles=[gt,et`:host { display: contents; }`];vt([_({attribute:!1})],st.prototype,"account",2);vt([_({type:Boolean,reflect:!0})],st.prototype,"open",2);vt([c()],st.prototype,"choice",2);vt([c()],st.prototype,"from",2);vt([c()],st.prototype,"to",2);vt([c()],st.prototype,"busy",2);vt([c()],st.prototype,"error",2);vt([c()],st.prototype,"errorBill",2);vt([c()],st.prototype,"existing",2);st=vt([T("elec-bill-create")],st);function fs(t){if(!t)return[];const e=[],a=t.same_period_last_year,n=!!a&&t.previous.some(i=>i.from===a.from&&i.to===a.to&&i.kwh!==null);a&&a.kwh!==null&&!n&&e.push({key:"ly",label:_e(a.to),title:s("אותה תקופה אשתקד, {range}",{range:ut(a.from,a.to)}),kwh:Number(a.kwh),kind:"ly",partial:a.status==="partial"});for(const i of t.previous.slice(-12))e.push({key:`p${i.to}`,label:_e(i.to),title:ut(i.from,i.to),kwh:i.kwh===null?null:Number(i.kwh),kind:"prev",partial:i.status==="partial",lyMark:!!a&&i.from===a.from&&i.to===a.to});return t.current&&e.push({key:"cur",label:_e(t.current.to),title:s("התקופה הנוכחית, {range}",{range:ut(t.current.from,t.current.to)}),kwh:Number(t.current.kwh),kind:"cur",partial:!1}),e}const Sa=24;function Oa(t,e,a,n,i=4){const d=Math.min(i,a/2,n);return`M${t},${e+n} V${e+d} Q${t},${e} ${t+d},${e} H${t+a-d} Q${t+a},${e} ${t+a},${e+d} V${e+n} Z`}function Pa(t){const e=new Set;let a=null;for(const n of t)n.kwh!==null&&((n.kind==="cur"||n.kind==="ly"||n.lyMark)&&e.add(n.key),(!a||n.kwh>a.kwh)&&(a=n));return a&&e.add(a.key),e}const De=t=>fs(t).some(e=>e.kind!=="cur"&&e.kwh!==null);var za=Object.defineProperty,Na=Object.getOwnPropertyDescriptor,Ot=(t,e,a,n)=>{for(var i=n>1?void 0:n?Na(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&za(e,a,i),i};let $t=class extends St{constructor(){super(...arguments),this.series=null,this.table="sr",this.print=!1,this.height=200,this.w=640,this.showTable=!1,this.hot=null}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(t=>{const e=Math.round(t[0].contentRect.width);e>120&&Math.abs(e-this.w)>2&&(this.w=e)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}render(){const t=fs(this.series);if(!De(this.series))return o;const e=this.w,a=this.height,n=12,i=18,d=22,l=t.length,h=(e-n*2)/l,v=t.map(w=>w.kwh??0),p=Math.max(...v,1)*1.12,m=Math.min(h*.68,Sa),$=w=>w/p*(a-i-d),y=a-d,L=w=>e-n-(w+1)*h,ft=w=>L(w)+(h-m)/2,xs=h<30?2:1,Es=Pa(t),Cs=h>=30,je=t.find(w=>w.kind==="cur"),ee=t.find(w=>w.kind==="ly"||w.lyMark),$e=ee&&ee.kwh!==null?y-$(ee.kwh):null,Ss=t.some(w=>w.partial),Os=s("צריכה לפי תקופה: {list}",{list:t.filter(w=>w.kwh!==null).map(w=>`${w.label} ${g(w.kwh)} ${s("קוט״ש")}`).join(", ")}),me=this.hot===null?-1:t.findIndex(w=>w.key===this.hot),Pt=me>=0?t[me]:null;return r`
      <svg viewBox="0 0 ${e} ${a}" role="img" aria-label=${Os} data-elec-chart @pointerleave=${()=>this.hot=null}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--c-bar2)"></rect><rect width="2.5" height="6" fill="var(--c-bar)" opacity="0.55"></rect></pattern>
        </defs>
        <line class="grid" x1=${n} x2=${e-n} y1=${y} y2=${y}></line>
        ${$e!==null&&je?rt`<line class="lyline" x1=${n} x2=${e-n} y1=${$e} y2=${$e}></line>`:o}
        ${t.map((w,ve)=>{const fe=ft(ve),se=fe+m/2,Ps=w.kind==="ly"?s("אשתקד"):w.label,Le=ve%xs===0||w.kind!=="prev"?rt`<text x=${se} y=${a-6} text-anchor="middle">${Ps}</text>`:o,Be=this.hot===w.key,Ae=rt`<rect class="hit" x=${L(ve)} y=${i-10} width=${h} height=${a-i+10-d+4}></rect>`,ae=()=>this.hot=w.key,Fe=()=>{this.hot===w.key&&(this.hot=null)};if(w.kwh===null)return rt`<g class=${Be?"band hot":"band"} data-bar="gap" tabindex="0" aria-label=${`${w.title}: ${s("אין נתונים")}`} @pointerenter=${ae} @focus=${ae} @blur=${Fe}>
              ${Ae}<line class="gap" x1=${se-5} x2=${se+5} y1=${y-4} y2=${y-4}></line>${Le}</g>`;const be=Math.max(2,$(w.kwh)),ge=y-be,zs=w.lyMark?rt`<rect class="ly" x=${fe-2} y=${ge-2} width=${m+4} height=${be+2} rx="4"></rect>`:o,Ns=w.kind==="cur"?"bar":w.kind==="ly"?"ly":w.partial?"part":"bar2",Is=Cs&&Es.has(w.key)?rt`<text class="v" x=${se} y=${ge-5} text-anchor="middle">${g(w.kwh).replace(/\.00$/,"")}</text>`:o;return rt`<g class=${Be?"band hot":"band"} data-bar=${w.kind} tabindex="0" aria-label=${`${w.title}: ${g(w.kwh)} ${s("קוט״ש")}${w.partial?` (${s("נתונים חלקיים")})`:""}`} @pointerenter=${ae} @focus=${ae} @blur=${Fe}>
            ${Ae}<path class=${Ns} d=${Oa(fe,ge,m,be)}></path>
            ${zs}${Is}${Le}</g>`})}
      </svg>
      ${Pt?r`<div class="tip" role="tooltip" data-chart-tip style=${`left:${(ft(me)+m/2)/e*100}%; inset-block-start:${(Pt.kwh===null?y-8:y-Math.max(2,$(Pt.kwh)))/a*100}%`}>
            <b>${Pt.kwh===null?s("אין נתונים"):`${g(Pt.kwh)} ${s("קוט״ש")}`}</b><small>${Pt.title}${Pt.partial?` · ${s("נתונים חלקיים")}`:""}</small>
          </div>`:o}
      <div class="legend">
        ${je?r`<span><i class="l-cur"></i>${s("התקופה הנוכחית")}</span>`:o}
        <span><i class="l-prev"></i>${s("תקופות קודמות")}</span>
        ${ee?r`<span><i class="l-ly"></i>${s("אותה תקופה אשתקד")}</span>`:o}
        ${Ss?r`<span><i class="l-part"></i>${s("נתונים חלקיים")}</span>`:o}
      </div>
      ${this.renderTable(t)}
    `}renderTable(t){const e=r`<div class=${this.table==="sr"?"sr":"tw"}><table data-elec-chart-table>
      <thead><tr>${t.map(a=>r`<th scope="col" title=${a.title}>${a.kind==="ly"?s("אשתקד"):a.label}</th>`)}</tr></thead>
      <tbody><tr>${t.map(a=>r`<td>${a.kwh===null?"-":g(a.kwh)}</td>`)}</tr></tbody>
    </table></div>`;return this.table==="details"?r`<button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.showTable} @click=${()=>this.showTable=!this.showTable}>${this.showTable?s("הסתרת טבלת מספרים"):s("טבלת מספרים")}</button>${this.showTable?e:o}`:e}};$t.styles=et`
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
  `;Ot([_({attribute:!1})],$t.prototype,"series",2);Ot([_()],$t.prototype,"table",2);Ot([_({type:Boolean,reflect:!0})],$t.prototype,"print",2);Ot([_({type:Number})],$t.prototype,"height",2);Ot([c()],$t.prototype,"w",2);Ot([c()],$t.prototype,"showTable",2);Ot([c()],$t.prototype,"hot",2);$t=Ot([T("elec-chart")],$t);const Ia=t=>Z(I.bill(t.id)),Ma=t=>t.stopPropagation();function Re(t,e){return e.phone?r`<div class="list" data-elec-bills>
      ${t.map(a=>r`<a class="li" href=${z.bill(a.id)} data-bill-row=${a.id} data-bill-state=${a.state}>
          <div class="grow"><div class="t1">${a.number?r`<span class="num">${a.number}</span>`:s("טיוטה")} · ${a.account_name}</div><div class="t2">${ut(a.period.from,a.period.to)} · <span class="num">${g(a.kwh)}</span> ${s("קוט״ש")}</div></div>
          <div style="text-align:end"><b class="num">${g(a.total)} ₪</b><div style="margin-block-start:4px">${Yt(a.state)}</div></div>
        </a>`)}
    </div>`:r`<div class="card flush scrollx" data-elec-bills>
    <table class="t">
      <thead><tr><th>${s("מספר")}</th>${e.compact?o:r`<th>${s("לקוח")}</th><th>${s("חשבון")}</th>`}<th>${s("תקופה")}</th><th class="num">${s("קוט״ש")}</th><th class="num">${s("סה״כ לתשלום")}</th><th>${s("מצב")}</th><th class="hide-tablet">${s("הונפק")}</th></tr></thead>
      <tbody>
        ${t.map(a=>r`<tr class="go" data-bill-row=${a.id} data-bill-state=${a.state} @click=${()=>Ia(a)}>
            <td class="b"><a class="rowlink" href=${z.bill(a.id)} @click=${Ma}>${a.number?r`<span class="num">${a.number}</span>`:r`<span class="mut">${s("טיוטה")}</span>`}</a></td>
            ${e.compact?o:r`<td>${a.customer.name}</td><td>${a.account_name}</td>`}
            <td><span class="num">${ut(a.period.from,a.period.to)}</span></td>
            <td class="num">${g(a.kwh)}</td>
            <td class="num">${g(a.total)} ₪</td>
            <td>${Yt(a.state)}</td>
            <td class="num hide-tablet" style="text-align:start">${a.issue_date?S(a.issue_date):"-"}</td>
          </tr>`)}
      </tbody>
    </table>
  </div>`}var Ta=Object.defineProperty,Da=Object.getOwnPropertyDescriptor,Y=(t,e,a,n)=>{for(var i=n>1?void 0:n?Da(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ta(e,a,i),i};let U=class extends G{constructor(){super(...arguments),this.accountId="",this.tab="status",this.st="loading",this.err="",this.status=null,this.hist=null,this.histMonths=12,this.histSt="loading",this.bills=[],this.billsSt="loading",this.createOpen=!1,this.flash="",this.loaded=""}willUpdate(t){t.has("accountId")&&this.accountId&&this.loaded!==this.accountId&&(this.loaded=this.accountId,this.load()),(t.has("tab")||t.has("accountId"))&&this.accountId&&(this.tab==="history"&&this.loadHistory(),this.tab==="bills"&&this.loadBills())}async load(){this.st="loading";try{this.flash=Ys(),this.status=await b().accountStatus(this.accountId),this.st="ready"}catch(t){this.err=M(t),this.st="error"}}async loadHistory(){this.histSt="loading";try{this.hist=await b().accountHistory(this.accountId,this.histMonths),this.histSt=this.hist.rows.some(t=>t.kwh!==null)||De(this.hist.comparison)?"ready":"empty"}catch{this.histSt="error"}}async loadBills(){this.billsSt="loading";try{this.bills=(await b().listBills({account_id:this.accountId})).items,this.billsSt=this.bills.length?"ready":"empty"}catch{this.billsSt="error"}}head(t){const a=this.status?.account,n=[["status",s("מצב")],["history",s("היסטוריה")],...t.bills?[["bills",s("חיובים")]]:[]];return r`<div class="row"><a class="btn ghost sm" href=${z.accounts()} data-back>${s("→ חשבונות")}</a></div>
      <div class="row">
        <div><b class="h2" data-account-name>${a?.name??""}</b>
          <div class="mut">${a?r`${t.bills?r`<a class="lnk" href=${z.customer(a.customer.id)}>${a.customer.name}</a>`:a.customer.name} · ${Oe(a.period_months,a.period_anchor_day,a.period_anchor_month)}`:""}</div></div>
        <span class="sp"></span>
        ${t.bills&&a?r`<sw-button variant="primary" data-create-bill @click=${()=>this.createOpen=!0}>${s("הפקת חיוב")}</sw-button>`:o}
        ${t.manage&&a?r`<a class="btn" data-edit-account href=${z.account(a.id,"edit")}>${s("עריכה")}</a>`:o}
      </div>
      <div class="seg" style="align-self:flex-start" role="tablist" aria-label=${s("חלקי החשבון")}>
        ${n.map(([i,d])=>r`<button type="button" role="tab" data-tab=${i} aria-pressed=${this.tab===i} @click=${()=>Z(I.account(this.accountId,i==="status"?"":i))}>${d}</button>`)}
      </div>`}render(){const t=R();return t.view?this.tab==="bills"&&!t.bills?r`<div class="page" data-elec="account" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לחיובים"))}</div>`:this.st==="loading"?r`<div class="page" data-elec="account" data-state="loading">${tt(5)}</div>`:this.st==="error"||!this.status?r`<div class="page" data-elec="account" data-state="error"><div class="row"><a class="btn ghost sm" href=${z.accounts()}>${s("→ חשבונות")}</a></div>${E("error","warning",this.err||s("לא ניתן לטעון את החשבון"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`:r`<div class="page" data-elec="account" data-state="ready" data-tab-now=${this.tab}>
      ${this.head(t)}
      ${this.flash?C("warn",this.flash):o}
      ${this.tab==="status"?this.renderStatus(this.status,t):this.tab==="history"?this.renderHistory(t):this.renderBills()}
      <elec-bill-create .account=${this.status.account} ?open=${this.createOpen} @close=${()=>this.createOpen=!1}></elec-bill-create>
    </div>`:r`<div class="page" data-elec="account" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לצפות בחשבון"))}</div>`}renderStatus(t,e){const a=t.rows.some(h=>h.start!==null),n=t.customer,i=t.rows,d=r`${t.stale?C("warn",r`<b>${t.stale.meter}</b> ${s("לא מדווח")}${t.stale.since?r` ${s("מאז")} ${u(t.stale.since)}`:""}. ${s("הצריכה תיספר כשהמונה יחזור לדווח.")}`):o}
      ${t.notes.map(h=>C("warn",h.text_he))}
      <div class="tiles" data-elec-tiles>
        <div class="tile"><div class="k">${s("צריכה בתקופה")}</div><div class="v">${u(g(t.kwh))}<span class="u">${s("קוט״ש")}</span></div></div>
        <div class="tile"><div class="k">${s("יום")} ${u(t.period.day)} ${s("מתוך")} ${u(t.period.days)}</div><div class="prog" style="margin-block-start:14px" role="progressbar" aria-valuenow=${t.period.day} aria-valuemin="0" aria-valuemax=${t.period.days}><i style="inline-size:${Math.round(t.period.day/t.period.days*100)}%"></i></div></div>
        <div class="tile"><div class="k">${s("צפי לסוף התקופה")}</div><div class="v">${u(Xs(t.forecast_kwh))}<span class="u">${s("קוט״ש")}</span></div></div>
        ${t.amount_so_far!==void 0?r`<div class="tile" data-tile="amount"><div class="k">${s("סכום עד כה")}</div><div class="v">${u(t.amount_so_far)}<span class="u">₪</span></div></div>`:r`<div class="tile"><div class="k">${s("ממוצע ליום")}</div><div class="v">${u(g(t.avg_per_day))}<span class="u">${s("קוט״ש")}</span></div></div>`}
      </div>
      <div class="card ${this.phone?"":"flush"}"><div class="hd"><b class="h3">${s("מונים בנוסחה")}</b><span class="sp"></span><span class="mut">${t.account.formula.sentence_he}</span></div>
        ${this.phone?r`<div class="list">${i.map(h=>r`<div class="li"><div class="grow"><div class="t1">${h.name}${h.factor?r` <span class="mut">(${h.factor})</span>`:o}</div><div class="t2">${a&&h.start!==null?r`${u(g(h.start))} ${s("←")} ${u(g(h.end??0))}`:r`${u(g(h.kwh))} ${s("קוט״ש")}`}</div></div><b class="num">${g(h.part)}</b></div>`)}</div>
            <div class="row" style="margin-block-start:10px"><b>${s("סה״כ לחיוב")}</b><span class="sp"></span><b class="num">${g(t.kwh)}</b></div>`:r`<div class="scrollx"><table class="t" data-elec-meters><thead><tr><th>${s("מונה")}</th>${a?r`<th class="num">${s("קריאה בתחילת התקופה")}</th><th class="num">${s("קריאה נוכחית")}</th>`:o}<th class="num">${s("צריכה")}</th><th class="num">${s("חלק")}</th><th class="num">${s("לחיוב (קוט״ש)")}</th></tr></thead>
            <tbody>${i.map(h=>r`<tr><td class="b">${h.name} ${h.stale?r`<span class="chip c-warn">${s("לא מדווח")}</span>`:o}</td>${a?r`<td class="num">${Rt(h.start)}</td><td class="num">${Rt(h.end)}</td>`:o}<td class="num">${g(h.kwh)}</td><td class="num">${h.factor}</td><td class="num b">${g(h.part)}</td></tr>`)}</tbody>
            <tfoot><tr><td colspan=${a?5:3}>${s("סה״כ לחיוב")}</td><td class="num">${g(t.kwh)}</td></tr></tfoot></table></div>`}
      </div>`,l=r`<div class="card"><div class="hd"><b class="h3">${s("לקוח")}</b><span class="sp"></span>${e.bills&&n?r`<a class="btn ghost sm" href=${z.customer(n.id)}>${s("כרטיס לקוח")}</a>`:o}</div>
        <dl class="kv"><dt>${s("שם")}</dt><dd>${t.account.customer.name}</dd><dt>${s("מספר לקוח")}</dt><dd>${u(t.account.customer.customer_number)}</dd>${e.bills&&n?.phone?r`<dt>${s("טלפון")}</dt><dd>${u(n.phone)}</dd>`:o}${e.bills&&n?.email?r`<dt>${s("דוא״ל")}</dt><dd>${u(n.email)}</dd>`:o}</dl></div>
      ${t.price&&e.bills?r`<div class="card" data-card="price"><div class="hd"><b class="h3">${s("מחיר")}</b></div><dl class="kv"><dt>${s("תעריף")}</dt><dd>${t.price.tariff}</dd><dt>${s("לפני מע״מ")}</dt><dd>${u(B(t.price.ex_vat)+" ₪")}</dd><dt>${s("כולל מע״מ")}</dt><dd>${u(B(t.price.inc_vat)+" ₪")}</dd><dt>${s("מע״מ")}</dt><dd>${u(t.price.vat+"%")}</dd></dl></div>`:t.account.tariff.kind==="tou"&&e.bills?r`<div class="card" data-card="price" data-kind="tou"><div class="hd"><b class="h3">${s("מחיר")}</b></div><dl class="kv"><dt>${s("תעריף")}</dt><dd>${t.account.tariff.name}</dd><dt>${s("חישוב")}</dt><dd>${s("לפי שעות (תעו״ז)")}</dd></dl></div>`:o}
      <div class="card" data-card="next"><div class="hd"><b class="h3">${s("חיוב הבא")}</b></div><dl class="kv"><dt>${s("תקופה")}</dt><dd>${u(S(t.next.from))} - ${u(S(t.next.to))}</dd><dt>${s("מספר צפוי")}</dt><dd>${u(t.next.number)}</dd>${t.account.auto_mode!=="off"?r`<dt>${t.account.auto_mode==="issue"?s("הנפקה אוטומטית"):s("טיוטה אוטומטית")}</dt><dd>${u(S(t.next.draft_on))}</dd>`:o}</dl></div>`;return r`<div class="cols side-l"><div class="col">${d}</div><div class="col">${l}</div></div>`}renderHistory(t){if(this.histSt==="loading")return tt(5);if(this.histSt==="error")return E("error","warning",s("לא ניתן לטעון את ההיסטוריה"),{label:s("נסה שוב"),run:()=>void this.loadHistory()});const e=this.hist;if(this.histSt==="empty")return E("empty","bolt",s("אין עדיין נתוני עבר לחשבון"));const a=t.bills,n=[...e.rows].reverse(),i=l=>l.kwh===null?r`<span class="mut" data-no-data>${s("אין נתונים")}</span>`:r`${u(g(l.kwh))}${l.status==="partial"?r` <span class="chip c-warn nodot" data-partial>${s("חלקי")}</span>`:o}`,d=l=>l.change_pct!==null?(l.change_pct>0?"+":"")+l.change_pct.toFixed(1)+"%":"-";return r`<div class="card" data-elec-history><div class="hd"><b class="h3">${s("צריכה לפי תקופה")}</b><span class="sp"></span>
        <div class="seg" role="group" aria-label=${s("טווח")}><button type="button" data-months="12" aria-pressed=${this.histMonths===12} @click=${()=>this.setMonths(12)}>${s("12 תקופות")}</button><button type="button" data-months="24" aria-pressed=${this.histMonths===24} @click=${()=>this.setMonths(24)}>${s("24 תקופות")}</button></div></div>
      <elec-chart .series=${e.comparison} table="details" .height=${this.phone?200:220}></elec-chart></div>
      <div class="card ${this.phone?"":"flush"}">${this.phone?r`<div class="list">${n.map(l=>r`<div class="li" data-history-row data-status=${l.status}><div class="grow"><div class="t1">${u(l.label)}</div><div class="t2">${i(l)}${l.kwh!==null?r` ${s("קוט״ש")}`:""}${l.change_pct!==null?r` · ${u(d(l))}`:o}</div></div>${a&&l.amount!==void 0?r`<b class="num">${g(l.amount)} ₪</b>`:o}</div>`)}</div>`:r`<table class="t" data-elec-history-table><thead><tr><th>${s("תקופה")}</th><th class="num">${s("קוט״ש")}</th><th class="num">${s("שינוי")}</th>${a?r`<th class="num">${s("סכום")}</th><th>${s("חיוב")}</th>`:o}</tr></thead>
          <tbody>${n.map(l=>r`<tr data-history-row data-status=${l.status}><td class="num" style="text-align:start">${l.label}</td><td class="num">${i(l)}</td><td class="num">${d(l)}</td>${a?r`<td class="num">${l.amount!==void 0?g(l.amount)+" ₪":""}</td><td>${l.bill?r`<a class="lnk num" href=${z.bill(l.bill.id)}>${l.bill.number}</a> ${Yt(l.bill.state)}`:r`<span class="mut">-</span>`}</td>`:o}</tr>`)}</tbody></table>`}</div>`}setMonths(t){this.histMonths=t,this.loadHistory()}renderBills(){return this.billsSt==="loading"?tt(4):this.billsSt==="error"?E("error","warning",s("לא ניתן לטעון את החיובים"),{label:s("נסה שוב"),run:()=>void this.loadBills()}):this.billsSt==="empty"?E("empty","bolt",s("אין חיובים לחשבון הזה"),{label:s("הפקת חיוב"),primary:!0,run:()=>this.createOpen=!0}):Re(this.bills,{phone:this.phone,compact:!0})}};Y([_()],U.prototype,"accountId",2);Y([_()],U.prototype,"tab",2);Y([c()],U.prototype,"st",2);Y([c()],U.prototype,"err",2);Y([c()],U.prototype,"status",2);Y([c()],U.prototype,"hist",2);Y([c()],U.prototype,"histMonths",2);Y([c()],U.prototype,"histSt",2);Y([c()],U.prototype,"bills",2);Y([c()],U.prototype,"billsSt",2);Y([c()],U.prototype,"createOpen",2);Y([c()],U.prototype,"flash",2);U=Y([T("elec-account-page")],U);var Ra=Object.defineProperty,ja=Object.getOwnPropertyDescriptor,X=(t,e,a,n)=>{for(var i=n>1?void 0:n?ja(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ra(e,a,i),i};let q=class extends St{constructor(){super(...arguments),this.meters=[],this.tokens=[],this.preset="custom",this.mode="builder",this.text="",this.textIssues=[],this.selected=-1,this.menu=!1,this.mainId="",this.pctVal="30",this.preview=null,this.previewErr="",this.skin=new Ft(this),this.seq=0,this.timer=0,this.lastKey="",this.nameOf=t=>this.meters.find(e=>e.id===t)?.name??t,this.idOf=t=>this.meters.find(e=>e.name.trim()===t.trim())?.id??null,this.lastOf=t=>this.meters.find(e=>e.id===t)?.last_period_kwh??null}willUpdate(t){t.has("meters")&&!this.mainId&&(this.mainId=this.meters[0]?.id??""),t.has("tokens")&&this.tokens.length&&(this.preset=Ke(this.tokens,this.meters.map(e=>e.id)))}updated(t){t.has("tokens")&&(this.selected=Math.min(this.selected,this.tokens.length-1),this.mode==="text"&&!this.textIssues.length&&(this.text=Ue(this.tokens,this.nameOf)),this.scheduleCheck())}parse(){return Pe(this.tokens)}emit(t,e=this.preset){this.preset=e,this.tokens=t,this.selected=-1;const a=Pe(t),n={tokens:t,ast:a.ast,valid:!a.issues.length&&!!a.ast,preset:e};this.dispatchEvent(new CustomEvent("change",{detail:n,bubbles:!0,composed:!0}))}edit(t){this.emit(t,Ke(t,this.meters.map(e=>e.id)))}scheduleCheck(){window.clearTimeout(this.timer);const t=this.parse(),e=JSON.stringify(t.ast);if(!t.ast||t.issues.length){this.preview=null,this.previewErr="",this.lastKey="";return}if(e===this.lastKey){this.emitChecked();return}this.timer=window.setTimeout(()=>void this.runCheck(t.ast,e),150)}async runCheck(t,e){const a=++this.seq;try{const n=await b().checkFormula(t);if(a!==this.seq)return;this.lastKey=e,this.preview=n,this.previewErr=""}catch(n){if(a!==this.seq)return;this.preview=null,this.previewErr=M(n)}this.emitChecked()}emitChecked(){const t=!!this.preview&&!this.preview.negative&&!this.previewErr;this.dispatchEvent(new CustomEvent("checked",{detail:{ok:t,result:this.preview?.result_kwh??null,negative:this.preview?.negative??!1,error:this.previewErr},bubbles:!0,composed:!0}))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}applyPreset(t){const e=this.meters.map(n=>n.id);if(t==="custom"){this.preset="custom";return}const a=t==="pct"?ze("pct",[this.mainId||e[0]],{pct:this.pctVal}):ze(t,e,{main:this.mainId});this.emit(a,t)}add(t){const e=[...this.tokens],a=this.selected>=0?this.selected+1:e.length;e.splice(a,0,t),this.edit(e),this.selected=a}addMeter(t){this.menu=!1,this.add({t:"m",id:t})}addOp(t){this.add({t:"op",v:t})}togglePercent(){const t=this.selected>=0?this.selected:this.tokens.length-1,e=this.tokens[t];if(e?.t!=="n")return;const a=[...this.tokens];a[t]={...e,pct:!e.pct},this.edit(a),this.selected=t}backspace(){const t=[...this.tokens],e=this.selected>=0?this.selected:t.length-1;e<0||(t.splice(e,1),this.edit(t),this.selected=Math.min(e-1,t.length-1))}addNumber(t,e){this.add({t:"n",v:t,pct:e})}setMode(t){t!==this.mode&&(t==="text"?(this.text=Ue(this.tokens,this.nameOf),this.textIssues=[]):this.textIssues.length&&(this.textIssues=[]),this.mode=t)}onText(t){this.text=t.target.value;const e=Qs(this.text,this.idOf);if(this.textIssues=e.issues,!e.issues.length)this.edit(e.toks);else{const a={tokens:this.tokens,ast:null,valid:!1,preset:this.preset};this.dispatchEvent(new CustomEvent("change",{detail:a,bubbles:!0,composed:!0}))}}tok(t,e,a){const n=`tok ${t.t==="m"?"m":t.t==="op"?"op":"k"} ${a.has(e)?"bad":""} ${this.selected===e?"sel":""}`,i=()=>this.selected=this.selected===e?-1:e;if(t.t==="m"){const d=this.lastOf(t.id);return r`<button type="button" class=${n} data-tok="meter" aria-pressed=${this.selected===e} @click=${i}>${this.nameOf(t.id)}${d!==null?r`<small class="num">${g(d)}</small>`:o}</button>`}return t.t==="op"?r`<button type="button" class=${n} data-tok="op" aria-pressed=${this.selected===e} aria-label=${t.v==="*"?s("כפל"):t.v==="-"?s("מינוס"):t.v==="+"?s("פלוס"):t.v==="/"?s("חילוק"):t.v} @click=${i}>${t.v==="*"?"×":t.v==="-"?"−":t.v==="/"?"÷":t.v}</button>`:r`<button type="button" class=${n} data-tok="num" aria-pressed=${this.selected===e} @click=${i}><span class="num">${t.v}${t.pct?"%":""}</span></button>`}render(){const t=this.parse(),e=new Set(t.issues.map(p=>p.at).filter(p=>p>=0)),a=this.preview,n=!!a?.negative,i=this.mode==="text"&&this.textIssues.length?this.textIssues.map(p=>p.message):t.issues.map(p=>p.message),d=i.length||n||this.previewErr,l=!i.length&&!n&&!this.previewErr&&!!t.ast&&!!a,h=this.tokens.length?Js(this.tokens,this.nameOf):"",v=t.warnings;return r`<div data-elec="formula-editor" data-formula-state=${d?"error":l?"ok":"pending"} data-preset=${this.preset}>
      <div class="presets" role="group" aria-label=${s("תבנית נוסחה")}>
        ${ta.map(p=>r`<button type="button" class="preset" data-preset-btn=${p.id} aria-pressed=${this.preset===p.id} @click=${()=>this.applyPreset(p.id)}><b>${p.label}</b><span>${p.hint}</span></button>`)}
      </div>
      ${this.preset==="mainsub"||this.preset==="pct"?r`<div class="row">
            <div class="fld" style="min-inline-size:200px"><label for="main">${this.preset==="pct"?s("מונה"):s("מונה ראשי")}</label>
              <select id="main" data-preset-main @change=${p=>{this.mainId=p.target.value,this.applyPreset(this.preset)}}>
                ${this.meters.map(p=>r`<option value=${p.id} ?selected=${p.id===this.mainId}>${p.name}</option>`)}
              </select></div>
            ${this.preset==="pct"?r`<div class="fld" style="inline-size:120px"><label for="pct">${s("אחוז")}</label><input id="pct" class="ltr" data-preset-pct inputmode="decimal" .value=${this.pctVal} @input=${p=>{this.pctVal=p.target.value,Number(this.pctVal)>0&&this.applyPreset("pct")}} /></div>`:o}
          </div>`:o}
      <div class="row"><b class="h3">${s("הנוסחה")}</b><span class="sp"></span>
        <div class="seg" role="group" aria-label=${s("מצב עריכה")}>
          <button type="button" data-mode="builder" aria-pressed=${this.mode==="builder"} @click=${()=>this.setMode("builder")}>${s("בונה")}</button>
          <button type="button" data-mode="text" aria-pressed=${this.mode==="text"} @click=${()=>this.setMode("text")}>${s("טקסט")}</button>
        </div>
      </div>
      ${this.mode==="text"?r`<textarea class="code ${this.textIssues.length?"err":""}" data-text aria-label=${s("נוסחה בטקסט")} dir="ltr" spellcheck="false" .value=${this.text} @input=${this.onText}></textarea>
            <div class="mut">${s("שמות מונים בסוגריים מרובעים. פעולות: + − × ( ) ומספרים או אחוזים.")}</div>`:r`<div class="expr ${i.length||n?"err":""}" data-expr>
              ${this.tokens.length?this.tokens.map((p,m)=>this.tok(p,m,e)):r`<span class="mut">${s("הוסיפו מונה או בחרו תבנית")}</span>`}
            </div>
            <div class="pal">
              <button type="button" class="btn" data-add-meter aria-expanded=${this.menu} aria-haspopup="listbox" @click=${()=>this.menu=!this.menu}>${s("+ מונה")} ▾</button>
              ${["+","-","*"].map(p=>r`<button type="button" class="btn" data-op=${p} aria-label=${p==="+"?s("פלוס"):p==="-"?s("מינוס"):s("כפל")} @click=${()=>this.addOp(p)}>${p==="*"?"×":p==="-"?"−":p}</button>`)}
              <button type="button" class="btn" data-op="percent" aria-label=${s("אחוז")} @click=${()=>this.togglePercent()}>%</button>
              <button type="button" class="btn" data-op="(" aria-label=${s("סוגר פותח")} @click=${()=>this.addOp("(")}>(</button>
              <button type="button" class="btn" data-op=")" aria-label=${s("סוגר סוגר")} @click=${()=>this.addOp(")")}>)</button>
              <sw-button data-number-btn @click=${()=>this.dispatchEvent(new CustomEvent("number-request",{bubbles:!0,composed:!0}))}>${s("מספר")}</sw-button>
              <span class="sp"></span>
              <sw-button variant="ghost" data-backspace @click=${()=>this.backspace()}>⌫ ${s("מחיקה")}</sw-button>
            </div>
            ${this.menu?r`<div class="menu" role="listbox" data-meter-menu>${this.meters.map(p=>r`<button type="button" role="option" data-meter-option=${p.id} @click=${()=>this.addMeter(p.id)}><span>${p.name}</span>${p.last_period_kwh!==null?r`<span class="mut num">${g(p.last_period_kwh)}</span>`:o}</button>`)}</div>`:o}`}
      ${h?r`<div class="mut" data-sentence>${h}</div>`:o}
      ${i.map(p=>C("err",p))}
      ${v.map(p=>C("warn",p))}
      ${n&&a?C("err",r`${s("התוצאה שלילית בתקופה האחרונה")} (${u(g(a.result_kwh??0))} ${s("קוט״ש")}). ${s("בדקו את הסימנים בנוסחה.")}`):o}
      ${this.previewErr?C("err",this.previewErr):o}
      ${l?C("ok",s("הנוסחה תקינה")):o}
      ${a&&!i.length?this.renderPreview(a):o}
    </div>`}renderPreview(t){return r`<div class="card soft" data-formula-preview>
      <div class="hd"><b class="h3">${s("בדיקה על {period}",{period:t.period_from?`${S(t.period_from)} - ${S(t.period_to)}`:s("התקופה האחרונה")})}</b></div>
      <div class="scrollx"><table class="t"><thead><tr><th>${s("מונה")}</th><th class="num">${s("צריכה (קוט״ש)")}</th></tr></thead>
        <tbody>${t.rows.map(e=>r`<tr><td>${e.name}</td><td class="num">${g(e.kwh)}</td></tr>`)}</tbody>
        <tfoot><tr><td>${s("צריכת החשבון")}</td><td class="num ${t.negative?"bad":""}" data-formula-result>${g(t.result_kwh??0)}</td></tr></tfoot></table></div>
    </div>`}};q.styles=[gt,et`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      textarea.code {
        min-block-size: 76px;
        font-size: var(--sw-fs-lg);
      }
    `];X([_({attribute:!1})],q.prototype,"meters",2);X([_({attribute:!1})],q.prototype,"tokens",2);X([c()],q.prototype,"preset",2);X([c()],q.prototype,"mode",2);X([c()],q.prototype,"text",2);X([c()],q.prototype,"textIssues",2);X([c()],q.prototype,"selected",2);X([c()],q.prototype,"menu",2);X([c()],q.prototype,"mainId",2);X([c()],q.prototype,"pctVal",2);X([c()],q.prototype,"preview",2);X([c()],q.prototype,"previewErr",2);q=X([T("elec-formula-editor")],q);function dt(t){const e=(t.device_name??"").trim(),a=(t.entity_name??"").trim()||t.name;return t.name&&t.name!==a&&t.name!==e?{primary:t.name,secondary:[...new Set([e,a].filter(i=>i&&i!==t.name))].join(" · ")}:{primary:e||a,secondary:e&&a!==e?a:""}}function bs(t){return[t.name,t.device_name,t.entity_name].filter(Boolean).join(" ").toLowerCase()}const Xe=120;function de(t,e){const a=t.trim(),n=a.toLocaleLowerCase(),i=!!a&&e.some(d=>d.trim().toLocaleLowerCase()===n);return a?a.length>Xe?{name:a,error:s("השם ארוך מדי (עד {max} תווים)",{max:Xe}),duplicate:i}:i?{name:a,error:gs,duplicate:i}:{name:a,error:"",duplicate:i}:{name:a,error:s("צריך להזין שם למונה"),duplicate:!1}}const gs=s("קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם"),La=s("השם החדש יופיע במסמכים חדשים. חשבוניות שכבר הונפקו לא ישתנו.");var Ba=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,at=(t,e,a,n)=>{for(var i=n>1?void 0:n?Aa(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ba(e,a,i),i};let W=class extends St{constructor(){super(...arguments),this.bubbleSkin=new Ft(this),this.mode="register",this.multi=!0,this.sensors=!1,this.selected=[],this.meters=null,this.q="",this.area="",this.items=[],this.phase="loading",this.error="",this.rejected=null,this.timer=0,this.seq=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){window.clearTimeout(this.timer),super.disconnectedCallback()}updated(t){t.has("meters")&&t.get("meters")!==void 0&&this.mode==="choose"&&this.load()}async load(){const t=++this.seq;this.phase="loading";try{const e=this.mode==="choose"?await this.loadChoose():this.fromCandidates(await Ve(this.q,this.area||void 0));if(t!==this.seq)return;this.items=e,this.phase="ready"}catch(e){if(t!==this.seq)return;this.error=lt(e),this.phase="error"}}async loadChoose(){const[t,e]=await Promise.all([this.meters?Promise.resolve(this.meters):Me(),this.sensors?Ve("").catch(()=>[]):Promise.resolve([])]);return[...this.fromMeters(t),...this.fromSensors(e)]}fromCandidates(t){return t.map(e=>({id:e.entity_id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:e.value??"",verdict:e.already_added?"added":e.verdict,message:e.already_added?"":ye(e),sensor:!1}))}fromMeters(t){return t.map(e=>({id:e.id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:`${nt(e.reading_kwh)} kWh`,verdict:e.status==="reporting"?"ok":"warn",message:e.status==="stale"?s("המונה לא מדווח כרגע"):e.status==="paused"?s("המונה מושהה"):"",sensor:!1,tag:e.status==="stale"?s("לא מדווח"):e.status==="paused"?s("מושהה"):void 0}))}fromSensors(t){return t.filter(e=>e.verdict!=="ok"&&!e.already_added).map(e=>({id:e.entity_id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:e.value??"",verdict:e.verdict==="warn"?"warn":"rejected",message:e.verdict==="warn"?`${ye(e)} ${s("צריך להוסיף אותו קודם במסך המונים.")}`:ye(e),sensor:!0}))}listed(){if(this.phase!=="ready")return[];if(this.mode!=="choose")return this.items;const t=this.q.trim().toLowerCase();return this.items.filter(e=>(!this.area||e.area===this.area)&&(!t||bs({name:e.name,device_name:e.device,entity_name:e.entity}).includes(t)||e.area.toLowerCase().includes(t)))}onSearch(t){this.q=t.target.value,this.mode!=="choose"&&(window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.load(),250))}onArea(t){this.area=t.target.value,this.mode!=="choose"&&this.load()}off(t){return t.sensor||t.verdict==="rejected"||t.verdict==="added"}toggle(t){if(this.off(t)){this.rejected=t.verdict==="added"?null:t;return}this.rejected=null;const e=this.selected.includes(t.id),a=this.multi?e?this.selected.filter(i=>i!==t.id):[...this.selected,t.id]:e?[]:[t.id];this.selected=a;const n={};for(const i of a){const d=this.items.find(l=>l.id===i);d&&(n[i]=dt({name:d.name,device_name:d.device,entity_name:d.entity}).primary)}this.dispatchEvent(new CustomEvent("change",{detail:{selected:a,names:n},bubbles:!0,composed:!0}))}chip(t){return t.verdict==="ok"?r`<span class="chip c-ok" data-verdict="ok">${s("מתאים")}</span>`:t.verdict==="warn"?r`<span class="chip c-warn" data-verdict="warn">${t.tag??s("אזהרה")}</span>`:t.verdict==="added"?r`<span class="chip c-acc" data-verdict="added">${s("נוסף")}</span>`:r`<span class="chip c-err" data-verdict="rejected">${s("לא מתאים")}</span>`}render(){const t=this.mode==="choose",e=[...new Set(this.items.map(n=>n.area).filter(Boolean))],a=this.listed();return r`
      <div class="head">
        <label class="inp">
          <sw-icon name="search" size="16"></sw-icon>
          <input type="search" data-picker-search placeholder=${t?s("חיפוש מונה לפי שם"):s("חיפוש לפי שם")} aria-label=${t?s("חיפוש מונה לפי שם"):s("חיפוש לפי שם")} .value=${this.q} @input=${this.onSearch} />
        </label>
        <label class="inp">
          <select data-picker-area aria-label=${s("אזור")} @change=${this.onArea}>
            <option value="" ?selected=${!this.area}>${s("כל האזורים")}</option>
            ${[...new Set([...e,this.area].filter(Boolean))].map(n=>r`<option value=${n} ?selected=${n===this.area}>${n}</option>`)}
          </select>
        </label>
      </div>
      ${this.rejected?r`<div class="alert err" role="alert" data-picker-reject><span class="x" aria-hidden="true">!</span><div><b>${dt({name:this.rejected.name,device_name:this.rejected.device,entity_name:this.rejected.entity}).primary}</b> ${s("לא נבחר.")} ${this.rejected.message}</div></div>`:o}
      ${this.phase==="loading"?r`<sw-state-panel state="loading" compact></sw-state-panel>`:o}
      ${this.phase==="error"?r`<sw-state-panel state="error" compact heading=${t?s("לא ניתן לטעון את המונים"):s("לא ניתן לטעון את החיישנים")} hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel>`:o}
      ${this.phase==="ready"&&!a.length?r`<sw-state-panel icon="bolt" state="empty" compact data-no-match heading=${t?this.items.length?s("לא נמצא מונה בשם הזה"):s("אין מונים עדיין"):s("לא נמצאו חיישנים")}></sw-state-panel>`:o}
      ${a.length?r`<div class="list scroll" role="listbox" aria-multiselectable=${this.multi?"true":"false"} aria-label=${t?s("מונים"):s("חיישנים")} data-picker-list>
            ${a.map(n=>{const i=this.selected.includes(n.id),d=this.off(n),l=dt({name:n.name,device_name:n.device,entity_name:n.entity});return r`<button type="button" class="li pick ${i?"sel":""} ${d?"dis":""} ${this.rejected?.id===n.id?"flag":""}" role="option" aria-selected=${i?"true":"false"} aria-disabled=${d?"true":"false"} data-picker-item=${n.id} data-verdict=${n.verdict} ?data-sensor=${n.sensor} @click=${()=>this.toggle(n)}>
                <span class="check ${i?"on":""} ${d?"dis":""}">${i?r`<sw-icon name="check" size="14"></sw-icon>`:o}</span>
                <span class="grow">
                  <div class="t1" data-picker-name>${l.primary}</div>
                  ${l.secondary?r`<div class="t2 ent" data-picker-entity title=${s("שם הישות")}>${l.secondary}</div>`:o}
                  <div class="t2">${n.area}${n.area&&n.value?" · ":""}<span class="num">${n.value}</span></div>
                  ${n.message&&(n.verdict==="warn"||n.verdict==="rejected")?r`<div class="t2 wrap" style="color:${n.verdict==="warn"?"var(--sw-warning-text)":"var(--sw-danger-text)"}">${n.message}</div>`:o}
                </span>
                ${this.chip(n)}
              </button>`})}
          </div>`:o}
    `}};W.styles=[gt,et`
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
    `];at([_()],W.prototype,"mode",2);at([_({type:Boolean})],W.prototype,"multi",2);at([_({type:Boolean})],W.prototype,"sensors",2);at([_({attribute:!1})],W.prototype,"selected",2);at([_({attribute:!1})],W.prototype,"meters",2);at([c()],W.prototype,"q",2);at([c()],W.prototype,"area",2);at([c()],W.prototype,"items",2);at([c()],W.prototype,"phase",2);at([c()],W.prototype,"error",2);at([c()],W.prototype,"rejected",2);W=at([T("elec-meter-picker")],W);var Fa=Object.defineProperty,Va=Object.getOwnPropertyDescriptor,x=(t,e,a,n)=>{for(var i=n>1?void 0:n?Va(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Fa(e,a,i),i};const Ee=[s("בחירת מונים"),s("נוסחת החשבון"),s("מחיר ומע״מ"),s("תקופת חיוב"),s("כרטיס לקוח"),s("סיכום והפקה")],qa=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,Qe=()=>({name:"",customer_number:"",tax_id:"",address:"",phone:"",email:"",notes:""});let k=class extends G{constructor(){super(...arguments),this.accountId="",this.loadSt="loading",this.step=1,this.reached=1,this.meters=[],this.tariffs=[],this.vat=null,this.settings=null,this.customers=[],this.nextNo="",this.meterIds=[],this.tokens=[],this.formulaValid=!1,this.formulaChecked=!1,this.tariffId="",this.tariffOpen=!1,this.tf={name:"",price:"",mode:"ex_vat",from:"",err:{},busy:!1,error:""},this.months=1,this.anchorDay=1,this.anchorMonth=1,this.firstStart="",this.custMode="new",this.custQ="",this.existingId="",this.nc=Qe(),this.ncErr={},this.accName="",this.accNameErr="",this.auto="draft",this.afterSave="draft",this.saving=!1,this.saveErr="",this.sampleResult=null,this.numOpen=!1,this.numVal="",this.numPct=!0,this.numErr="",this.account=null,this.createdCustomerId="",this.draftPossible=()=>!!this.lastPeriod(),this.onFormula=t=>{this.tokens=t.detail.tokens,this.formulaValid=t.detail.valid,this.formulaChecked=!1},this.onChecked=t=>{this.formulaChecked=t.detail.ok&&this.formulaValid,this.sampleResult=t.detail.result}}connectedCallback(){super.connectedCallback(),this.init()}get edit(){return!!this.accountId}async init(){this.loadSt="loading";const t=R();try{const e=b(),[a,n,i,d,l,h]=await Promise.all([ea(),e.listTariffs(),e.getVat(),e.getSettings().catch(()=>null),t.view?e.listCustomers().catch(()=>[]):Promise.resolve([]),e.nextCustomerNumber().catch(()=>"")]);if(this.meters=a,this.tariffs=n,this.vat=i,this.settings=d,this.customers=l,this.nextNo=h,this.nc={...Qe(),customer_number:h},this.tf={...this.tf,mode:d?.default_price_mode??"ex_vat",from:J()},this.firstStart=J(),n.length===1&&(this.tariffId=n[0].id),this.edit){const v=await e.getAccount(this.accountId);this.account=v,this.meterIds=v.formula.meter_ids,this.tokens=sa(v.formula.ast),this.formulaValid=!0,this.tariffId=v.tariff.id,this.months=v.period_months,this.anchorDay=v.period_anchor_day,this.anchorMonth=v.period_anchor_month,this.firstStart=v.first_period_start,this.auto=v.auto_mode,this.accName=v.name,this.existingId=v.customer.id,this.custMode="existing",this.reached=6}this.loadSt="ready"}catch{this.loadSt="error"}}chosen(){return this.meterIds.map(t=>this.meters.find(e=>e.id===t)).filter(t=>!!t)}tariff(){return this.tariffs.find(t=>t.id===this.tariffId)}cust(){if(this.custMode==="existing"){const t=this.customers.find(e=>e.id===this.existingId)??(this.account?{name:this.account.customer.name,customer_number:this.account.customer.customer_number,account_count:1}:null);return t?{name:t.name,number:t.customer_number,count:t.account_count}:{name:"",number:this.nextNo,count:0}}return{name:this.nc.name,number:this.nc.customer_number||this.nextNo,count:0}}canNext(){switch(this.step){case 1:return this.meterIds.length>0;case 2:return this.formulaValid&&this.formulaChecked;case 3:return!!this.tariffId&&!!this.vat?.current;case 4:return V(this.firstStart)&&this.anchorDay>=1&&this.anchorDay<=28;case 5:return!0;default:return!0}}goStep(t){t<1||t>6||t>this.reached||(this.step=t)}next(){this.step===5&&!this.validateStep5()||!this.canNext()||this.step>=6||(this.step===1&&this.enterFormula(),this.step+=1,this.reached=Math.max(this.reached,this.step),this.step===2&&(this.formulaChecked=!1))}enterFormula(){this.tokens.every(e=>e.t!=="m"||this.meterIds.includes(e.id))&&this.tokens.some(e=>e.t==="m")||(this.tokens=ze("sum",this.meterIds),this.formulaValid=!0,this.formulaChecked=!1)}validateStep5(){this.ncErr={},this.accNameErr="";let t=!0;return this.accName.trim()||(this.accNameErr=s("צריך לתת שם לחשבון"),t=!1),this.edit||(this.custMode==="new"?(this.nc.name.trim()||(this.ncErr={...this.ncErr,name:s("צריך לכתוב שם ללקוח")},t=!1),this.nc.email&&!qa.test(this.nc.email)&&(this.ncErr={...this.ncErr,email:s("כתובת דוא״ל לא תקינה")},t=!1),/^\d{1,9}$/.test(this.nc.customer_number)||(this.ncErr={...this.ncErr,customer_number:s("מספר לקוח הוא ספרות בלבד")},t=!1)):this.existingId||(t=!1)),t}async save(){if(this.saving)return;const t=this.tariff(),e=Pe(this.tokens).ast;if(!t||!e)return;this.saving=!0,this.saveErr="";const a=b();try{if(this.edit&&this.account){await a.updateAccount(this.account.id,this.account.revision,{name:this.accName.trim(),formula:{ast:e},tariff_id:this.tariffId,auto_mode:this.auto}),Z(I.account(this.account.id));return}let n=this.existingId;if(this.custMode==="new"){if(!this.createdCustomerId)try{const d=await a.createCustomer({name:this.nc.name.trim(),customer_number:this.nc.customer_number,address:this.nc.address,phone:this.nc.phone,email:this.nc.email,tax_id:this.nc.tax_id,notes:this.nc.notes});this.createdCustomerId=d.id}catch(d){const l=jt(d);this.ncErr=Object.keys(l).length?l:{customer_number:M(d)},!Object.keys(l).length&&!aa(d)&&(this.ncErr={name:M(d)}),this.step=5;return}n=this.createdCustomerId}const i=await a.createAccount({name:this.accName.trim(),customer_id:n,formula:{ast:e},tariff_id:this.tariffId,period_months:this.months,period_anchor_day:this.anchorDay,period_anchor_month:this.months===2?this.anchorMonth:1,first_period_start:this.firstStart,auto_mode:this.auto},this.draftPossible()?this.afterSave:"none");i.billError&&ia(s("החשבון נשמר, אבל לא נוצרה טיוטה: {error}",{error:i.billError})),Z(I.account(i.account.id))}catch(n){this.saveErr=M(n)}finally{this.saving=!1}}lastPeriod(){const t=J(),e=Mt(t,this.months,this.anchorDay,this.months===2?this.anchorMonth:1),a=Xt(e.from,-1);return!V(this.firstStart)||a<this.firstStart?null:{from:this.firstStart>Mt(a,this.months,this.anchorDay,this.months===2?this.anchorMonth:1).from?this.firstStart:Mt(a,this.months,this.anchorDay,this.months===2?this.anchorMonth:1).from,to:a}}renderStep1(){const t=this.chosen();return r`<elec-meter-picker mode="choose" multi sensors .meters=${this.meters} .selected=${this.meterIds} data-meter-picker
        @change=${e=>this.meterIds=e.detail.selected}></elec-meter-picker>
      <div class="row" data-chosen><span class="chip c-acc nodot">${t.length===1?s("נבחרו 1 מונה"):s("נבחרו {n} מונים",{n:t.length})}</span><span class="mut">${t.map(e=>dt(e).primary).join(", ")}</span></div>`}renderStep2(){return r`<elec-formula-editor .meters=${this.chosen()} .tokens=${this.tokens} @change=${this.onFormula} @checked=${this.onChecked} @number-request=${()=>{this.numOpen=!0,this.numErr=""}}></elec-formula-editor>`}confirmNumber(){const t=this.numVal.trim().replace(",",".");if(!/^\d+(\.\d+)?$/.test(t)||Number(t)<=0){this.numErr=s("צריך להקליד מספר גדול מאפס");return}if(this.numPct&&Number(t)>1e3){this.numErr=s("האחוז גדול מדי");return}this.numOpen=!1,this.numErr="",this.renderRoot.querySelector("elec-formula-editor")?.addNumber(t,this.numPct),this.numVal=""}renderNumberDialog(){return r`<elec-dialog heading=${s("הוספת מספר")} ?open=${this.numOpen} data-number-dialog @close=${()=>this.numOpen=!1}>
      <div class="fld"><label for="numv">${s("ערך")}</label>
        <input id="numv" class="ltr ${this.numErr?"err":""}" data-number-input inputmode="decimal" .value=${this.numVal} @input=${t=>{this.numVal=t.target.value,this.numErr=""}} @keydown=${t=>t.key==="Enter"&&this.confirmNumber()} />
        ${this.numErr?r`<div class="msg" role="alert">${this.numErr}</div>`:o}</div>
      <div class="seg" role="group" aria-label=${s("סוג")}>
        <button type="button" data-number-kind="pct" aria-pressed=${this.numPct} @click=${()=>this.numPct=!0}>${s("אחוז")}</button>
        <button type="button" data-number-kind="num" aria-pressed=${!this.numPct} @click=${()=>this.numPct=!1}>${s("מספר")}</button>
      </div>
      <sw-button variant="primary" slot="actions" data-number-ok @click=${()=>this.confirmNumber()}>${s("הוספה")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.numOpen=!1}>${s("ביטול")}</sw-button>
    </elec-dialog>`}exOf(t){const e=t.current,a=this.vat?.current?Number(this.vat.current.rate_percent)/100:0,n=e?Number(e.price):0;return e?.price_mode==="inc_vat"?{ex:n/(1+a),inc:n,vat:a}:{ex:n,inc:n*(1+a),vat:a}}renderStep3(){const t=this.tariff(),e=this.vat?.current;return r`${e?o:C("err",r`${s("לא הוגדר שיעור מע״מ.")} <a class="lnk" href=${z.settings("prices")}>${s("הגדרת שיעור מע״מ")}</a>`)}
      ${this.tariffs.length?r`<div class="list" role="radiogroup" aria-label=${s("תעריף")} data-tariff-list>
        ${this.tariffs.map(a=>r`<label class="li ${a.id===this.tariffId?"sel":""}" data-tariff-row=${a.id}><input type="radio" name="tariff" .checked=${a.id===this.tariffId} @change=${()=>this.tariffId=a.id} /><span class="ind"></span>
          <div class="grow"><div class="t1">${a.name}</div><div class="t2">${a.current?.price_mode==="inc_vat"?s("הוזן כולל מע״מ"):s("הוזן לפני מע״מ")} ${s("· בתוקף מ-")}${u(S(a.current?.effective_from??""))}</div></div>${a.kind==="tou"?r`<span class="chip c-acc nodot">${s("לפי שעות")}</span>`:r`<b class="num">${B(a.current?.price??0)} ₪</b>`}</label>`)}</div>
        <div class="row"><sw-button variant="ghost" size="sm" data-new-tariff @click=${()=>this.tariffOpen=!0}>${s("+ תעריף חדש")}</sw-button></div>`:E("empty","bolt",s("אין תעריפים עדיין"),{label:s("+ תעריף חדש"),primary:!0,run:()=>this.tariffOpen=!0})}
      ${t&&e?this.priceCard(t):o}`}priceCard(t){if(t.kind==="tou"){const i=t.current?.definition;return r`<div class="card soft" data-price-card data-kind="tou"><dl class="kv"><dt>${s("תעריף")}</dt><dd>${s("לפי שעות (תעו״ז)")}${i?r`: ${i.bands.map(d=>d.name_he).join(" / ")}, ${i.seasons.map(d=>d.name_he).join(" / ")}`:o}</dd>
        <dt>${s("מע״מ")}</dt><dd>${u((this.exOf(t).vat*100).toFixed(0)+"%")} <span class="mut">${s("(מההגדרות)")}</span></dd></dl>
        <div class="mut" style="margin-block-start:8px">${s("הסכום מחושב לפי שעות הצריכה בפועל, בכל פס ועונה במחיר שלהם.")}</div></div>`}const e=this.exOf(t),a=this.sampleKwh(),n=t.current?.price_mode==="inc_vat"?pt(a*e.inc):pt(pt(a*e.ex)+pt(pt(a*e.ex)*e.vat));return r`<div class="card soft" data-price-card><dl class="kv"><dt>${s("מחיר לקוט״ש לפני מע״מ")}</dt><dd>${u(B(e.ex)+" ₪")}</dd><dt>${s("מע״מ")}</dt><dd>${u((e.vat*100).toFixed(0)+"%")} <span class="mut">${s("(מההגדרות)")}</span></dd><dt>${s("מחיר לקוט״ש כולל מע״מ")}</dt><dd>${u(B(e.inc)+" ₪")}</dd>
      ${a?r`<dt>${s("לדוגמה,")} ${Ne(Xt(Mt(J(),1,1,1).from,-1))}</dt><dd>${u(g(a))} ${s("קוט״ש =")} ${u(g(n)+" ₪")}</dd>`:o}</dl></div>`}sampleKwh(){return this.sampleResult!==null&&this.sampleResult>0?this.sampleResult:0}renderStep4(){const t=this.months===2?this.anchorMonth:1,e=V(this.firstStart)?ra(this.firstStart,this.months,this.anchorDay,t,"",3):[],a=this.cust();return r`<div class="form">
        <div class="fld"><span class="lbl" id="len">${s("אורך תקופה")}</span><div class="seg" role="group" aria-labelledby="len"><button type="button" data-months="1" aria-pressed=${this.months===1} ?disabled=${this.edit} @click=${()=>this.months=1}>${s("חודשית")}</button><button type="button" data-months="2" aria-pressed=${this.months===2} ?disabled=${this.edit} @click=${()=>this.months=2}>${s("דו-חודשית")}</button></div></div>
        ${this.months===2?r`<div class="fld"><label for="am">${s("חודש פתיחת המחזור")}</label><select id="am" data-anchor-month ?disabled=${this.edit} @change=${n=>this.anchorMonth=Number(n.target.value)}>${na.map((n,i)=>r`<option value=${i+1} ?selected=${this.anchorMonth===i+1}>${n}</option>`)}</select></div>`:o}
        <div class="fld"><label for="ad">${s("יום תחילת תקופה")}</label><div class="unit"><input id="ad" class="ltr" type="number" min="1" max="28" data-anchor-day ?disabled=${this.edit} .value=${String(this.anchorDay)} @input=${n=>this.anchorDay=Number(n.target.value)} /><span>${s("בחודש")}</span></div>
          ${this.anchorDay<1||this.anchorDay>28?r`<div class="msg" role="alert">${s("היום חייב להיות בין 1 ל-28")}</div>`:o}</div>
        <div class="fld"><label for="fs">${s("תחילת החיוב הראשון")}</label><input id="fs" type="date" lang=${ot()} class="ltr ${V(this.firstStart)?"":"err"}" data-first-start ?disabled=${this.edit} .value=${this.firstStart} @change=${n=>this.firstStart=n.target.value} />
          ${V(this.firstStart)?o:r`<div class="msg" role="alert">${s("צריך לבחור תאריך")}</div>`}</div>
      </div>
      <div class="card flush soft"><div class="hd"><b class="h3">${s("התקופות הבאות")}</b></div>${e.length?r`<table class="t" data-periods><thead><tr><th>${s("תקופה")}</th><th>${s("מספר חיוב")}</th></tr></thead><tbody>
        ${e.map(n=>r`<tr><td><span class="num">${ut(n.from,n.to)}</span></td><td class="num" style="text-align:start">${We(n.to,a.number,"")}</td></tr>`)}</tbody></table>`:r`<div class="mut" style="padding:0 16px 14px">${s("בחרו תאריך התחלה")}</div>`}</div>`}renderStep5(){const t=(i,d,l={})=>{const h=this.ncErr[i];return r`<div class="fld ${l.wide?"wide":""}"><label for="c-${i}">${d}</label>
        ${l.area?r`<textarea id="c-${i}" name=${i} .value=${this.nc[i]} placeholder=${l.ph??""} @input=${v=>this.nc={...this.nc,[i]:v.target.value}}></textarea>`:r`<input id="c-${i}" name=${i} class="${l.ltr?"ltr":""} ${h?"err":""}" aria-invalid=${h?"true":"false"} placeholder=${l.ph??""} .value=${this.nc[i]} @input=${v=>{this.nc={...this.nc,[i]:v.target.value},this.ncErr[i]&&(this.ncErr={...this.ncErr,[i]:""})}} />`}
        ${h?r`<div class="msg" role="alert" data-field-error=${i}>${h}</div>`:o}</div>`},e=this.customers.find(i=>i.id===this.existingId),a=this.custQ.trim(),n=this.customers.filter(i=>!a||i.name.includes(a)||i.customer_number.includes(a));return r`${this.edit?C("info",r`${s("הלקוח של חשבון קיים לא משתנה כאן.")} <b>${this.account?.customer.name}</b>`):r`<div class="seg" style="align-self:flex-start" role="group" aria-label=${s("לקוח")}><button type="button" data-cust-mode="new" aria-pressed=${this.custMode==="new"} @click=${()=>this.custMode="new"}>${s("לקוח חדש")}</button><button type="button" data-cust-mode="existing" aria-pressed=${this.custMode==="existing"} @click=${()=>this.custMode="existing"}>${s("לקוח קיים")}</button></div>`}
      ${this.edit?o:this.custMode==="existing"?r`<input type="search" data-cust-search style="max-inline-size:none" aria-label=${s("חיפוש לקוח")} placeholder=${s("חיפוש לקוח")} .value=${this.custQ} @input=${i=>this.custQ=i.target.value} />
            <div class="list" role="radiogroup" aria-label=${s("לקוח קיים")} data-cust-list>${n.map(i=>r`<label class="li ${i.id===this.existingId?"sel":""}" data-cust-row=${i.id}><input type="radio" name="cust" .checked=${i.id===this.existingId} @change=${()=>this.existingId=i.id} /><span class="ind"></span><div class="grow"><div class="t1">${i.name}</div><div class="t2">${s("מספר לקוח")} ${u(i.customer_number)} · ${i.account_count} ${s("חשבונות")}</div></div></label>`)}
              ${n.length?o:r`<div class="mut">${s("לא נמצא לקוח")}</div>`}</div>
            ${e&&e.account_count>0?C("warn",r`${e.account_count===1?s("ללקוח יש כבר 1 חשבון."):s("ללקוח יש כבר {n} חשבונות.",{n:e.account_count})} ${s("חיובים של אותו לקוח שמסתיימים באותו חודש יקבלו סיומת רצה, למשל")} <b class="num">${We(Mt(J(),1,1,1).to,e.customer_number,"")}/2</b>.`,"i"):o}`:r`<div class="form">${t("name",s("שם הלקוח"),{wide:!0})}${t("customer_number",s("מספר לקוח"),{ltr:!0})}${t("tax_id",s("ח.פ. / ע.מ. (לא חובה)"),{ltr:!0,ph:s("לא חובה")})}${t("address",s("כתובת למשלוח החיוב"),{wide:!0})}${t("phone",s("טלפון"),{ltr:!0})}${t("email",s("דוא״ל"),{ltr:!0})}${t("notes",s("הערות"),{wide:!0,ph:s("לא חובה"),area:!0})}</div>`}
      <div class="fld"><label for="an">${s("שם החשבון")}</label><input id="an" name="account_name" data-account-name class="${this.accNameErr?"err":""}" .value=${this.accName} placeholder=${s("למשל: סטודיו אורן - קומה 1")} @input=${i=>{this.accName=i.target.value,this.accNameErr=""}} />
        ${this.accNameErr?r`<div class="msg" role="alert" data-field-error="account_name">${this.accNameErr}</div>`:o}</div>`}renderStep6(){const t=this.tariff(),e=this.cust(),a=this.sampleKwh(),n=t?this.exOf(t):null,i=this.tokens.map(p=>p.t==="m"?this.meters.find(m=>m.id===p.id)?.name??"":p.t==="n"?p.v+(p.pct?"%":""):p.v==="*"?"×":p.v==="-"?"−":p.v).join(" ").replace(/\( /g,"(").replace(/ \)/g,")"),d=this.settings?.payment_terms,l=this.lastPeriod(),h=n&&t?t.current?.price_mode==="inc_vat"?pt(a*n.inc):pt(pt(a*n.ex)+pt(pt(a*n.ex)*n.vat)):0,v=(p,m,$,y,L,ft=!1)=>r`<label class="li ${y?"sel":""} ${ft?"dis":""}"><input type="radio" name=${p} data-opt=${m} .checked=${y} ?disabled=${ft} @change=${L} /><span class="ind"></span><div class="grow t1">${$}</div></label>`;return r`<dl class="kv" data-summary><dt>${s("מונים")}</dt><dd>${this.chosen().map(p=>dt(p).primary).join(", ")}</dd><dt>${s("נוסחה")}</dt><dd>${i}</dd>
        <dt>${s("מחיר")}</dt><dd>${t?r`${t.name}, ${t.kind==="tou"?s("לפי שעות"):u(B(t.current?.price??0)+" ₪")} ${t.current?.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}, ${s("מע״מ")} ${u(this.vat?.current?.rate_percent??"")}%`:""}</dd>
        <dt>${s("תקופה")}</dt><dd>${s("{period}, מה-{day} בחודש, החל מ-",{period:this.months===1?s("חודשית"):s("דו-חודשית"),day:this.anchorDay})}${u(S(this.firstStart))}</dd>
        <dt>${s("לקוח")}</dt><dd>${e.name}, ${s("מספר")} ${u(e.number)}</dd><dt>${s("שם החשבון")}</dt><dd>${this.accName}</dd>
        <dt>${s("תנאי תשלום")}</dt><dd data-payment>${d?d.mode==="net_days"?r`${u(d.days)} ${s("ימים מיום ההפקה")}`:r`${s("ב-")}${u(d.day_of_month)} ${s("בחודש")}`:"-"} <a class="lnk" href=${z.settings("business")}>${s("שינוי בהגדרות")}</a></dd></dl>
      ${a?r`<div class="card soft"><div class="hd"><b class="h3">${s("לפי הנתונים של התקופה האחרונה")}</b></div><div class="row"><span style="font-size:var(--sw-fs-2xl);font-weight:700">${u(g(a))}</span><span class="mut">${s("קוט״ש")}</span><span class="sp"></span>${t?.kind==="tou"?r`<span class="mut">${s("הסכום לפי שעות הצריכה")}</span>`:r`<span style="font-size:var(--sw-fs-2xl);font-weight:700">${u(g(h)+" ₪")}</span>`}</div></div>`:o}
      <div class="fld"><span class="lbl">${s("יצירה אוטומטית בסוף כל תקופה")}</span><div class="list" role="radiogroup" aria-label=${s("יצירה אוטומטית")}>
        ${["draft","issue","off"].map(p=>v("auto",p,la[p],this.auto===p,()=>this.auto=p))}</div>
        ${this.auto==="issue"?C("warn",s("החיוב יונפק ויקבל מספר בלי בדיקה שלך. אפשר לבטל או לתקן אחר כך.")):o}</div>
      ${this.edit?o:r`<div class="fld"><span class="lbl">${s("אחרי השמירה")}</span><div class="list" role="radiogroup" aria-label=${s("אחרי השמירה")}>
        ${v("after","draft",l?s("שמירה והפקת טיוטה ל{period}",{period:this.months===1?Ne(l.to):ut(l.from,l.to)}):s("שמירה והפקת טיוטה (אין עדיין תקופה שהסתיימה)"),this.afterSave==="draft"&&!!l,()=>this.afterSave="draft",!l)}
        ${v("after","none",s("שמירה בלבד"),this.afterSave==="none"||!l,()=>this.afterSave="none")}</div></div>`}
      ${this.saveErr?C("err",this.saveErr):o}`}async saveTariff(){const t=this.tf,e={};if(t.name.trim()||(e.name=s("צריך לתת שם לתעריף")),Number(t.price)>0||(e.price=s("המחיר חייב להיות מספר גדול מאפס")),V(t.from)||(e.from=s("צריך לבחור תאריך")),Object.keys(e).length){this.tf={...t,err:e};return}this.tf={...t,busy:!0,error:"",err:{}};try{const a=await b().createTariff({name:t.name.trim(),price:t.price,price_mode:t.mode,effective_from:t.from});this.tariffs=[...this.tariffs,a],this.tariffId=a.id,this.tariffOpen=!1,this.tf={...this.tf,name:"",price:"",busy:!1}}catch(a){this.tf={...this.tf,busy:!1,error:M(a),err:jt(a)}}}renderTariffDialog(){const t=this.tf,e=(a,n)=>this.tf={...this.tf,[a]:n,err:{...this.tf.err,[a]:""}};return r`<elec-dialog heading=${s("תעריף חדש")} ?open=${this.tariffOpen} data-tariff-dialog @close=${()=>this.tariffOpen=!1}>
      <div class="form">
        <div class="fld wide"><label for="tn">${s("שם התעריף")}</label><input id="tn" class="${t.err.name?"err":""}" data-tariff-name .value=${t.name} @input=${a=>e("name",a.target.value)} />${t.err.name?r`<div class="msg" role="alert">${t.err.name}</div>`:o}</div>
        <div class="fld"><label for="tp">${s("מחיר לקוט״ש")}</label><div class="unit"><input id="tp" class="ltr ${t.err.price?"err":""}" data-tariff-price inputmode="decimal" .value=${t.price} @input=${a=>e("price",a.target.value)} /><span>₪</span></div>${t.err.price?r`<div class="msg" role="alert">${t.err.price}</div>`:o}</div>
        <div class="fld"><span class="lbl">${s("המחיר שהוזן")}</span><div class="seg" role="group" aria-label=${s("סוג מחיר")}><button type="button" data-tariff-mode="ex_vat" aria-pressed=${t.mode==="ex_vat"} @click=${()=>this.tf={...t,mode:"ex_vat"}}>${s("לפני מע״מ")}</button><button type="button" data-tariff-mode="inc_vat" aria-pressed=${t.mode==="inc_vat"} @click=${()=>this.tf={...t,mode:"inc_vat"}}>${s("כולל מע״מ")}</button></div></div>
        <div class="fld"><label for="tf">${s("בתוקף מתאריך")}</label><input id="tf" type="date" lang=${ot()} class="ltr ${t.err.from?"err":""}" data-tariff-from .value=${t.from} @change=${a=>e("from",a.target.value)} />${t.err.from?r`<div class="msg" role="alert">${t.err.from}</div>`:o}</div>
      </div>
      ${t.error?C("err",t.error):o}
      <sw-button variant="primary" slot="actions" data-tariff-save ?disabled=${t.busy} @click=${()=>void this.saveTariff()}>${s("שמירה")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.tariffOpen=!1}>${s("ביטול")}</sw-button>
    </elec-dialog>`}render(){if(!R().manage)return r`<div class="page" data-elec="wizard" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לניהול חשבונות"))}</div>`;if(this.loadSt==="loading")return r`<div class="page" data-elec="wizard" data-state="loading">${tt(5)}</div>`;if(this.loadSt==="error")return r`<div class="page" data-elec="wizard" data-state="error">${E("error","warning",s("לא ניתן לטעון את האשף"),{label:s("נסה שוב"),run:()=>void this.init()})}</div>`;const e=this.step,a=[this.renderStep1,this.renderStep2,this.renderStep3,this.renderStep4,this.renderStep5,this.renderStep6][e-1].call(this),n=this.canNext();return r`<div class="page" data-elec="wizard" data-state="ready" data-step=${e}>
      <div class="row"><a class="btn ghost sm" href=${this.edit?z.account(this.accountId):z.accounts()} data-back>${this.edit?s("→ לחשבון"):s("→ חשבונות")}</a><b class="h2">${this.edit?s("עריכת חשבון"):s("חשבון חדש")}</b></div>
      <div class="wiz">
        <nav class="card steps" aria-label=${s("שלבי האשף")}>${Ee.map((i,d)=>r`<button type="button" data-step-btn=${d+1} class="${d+1===e?"on":d+1<e?"done":""}" aria-current=${d+1===e?"step":"false"} ?disabled=${d+1>this.reached} @click=${()=>this.goStep(d+1)}><span class="n">${d+1<e?"✓":d+1}</span>${i}</button>`)}</nav>
        <div class="card col" style="gap:14px">
          <div class="pstep"><b>${s("שלב {n} מתוך 6",{n:e})}</b><span class="mut">${Ee[e-1]}</span><div class="bar"><i style="inline-size:${e/6*100}%"></i></div></div>
          <b class="h2 hide-phone" data-step-title>${Ee[e-1]}</b>
          ${a}
          <div class="wfoot">${e>1?r`<sw-button data-prev @click=${()=>this.step=e-1}>${s("הקודם")}</sw-button>`:r`<span></span>`}
            ${e<6?r`<sw-button variant="primary" data-next ?disabled=${!n} @click=${()=>this.next()}>${s("הבא")}</sw-button>`:r`<sw-button variant="primary" data-save ?disabled=${this.saving||!this.accName.trim()} @click=${()=>void this.save()}>${this.edit?s("שמירת שינויים"):this.afterSave==="draft"&&this.draftPossible()?s("שמירה והפקת טיוטה"):s("שמירה")}</sw-button>`}</div>
        </div>
      </div>
      ${this.renderTariffDialog()}${this.renderNumberDialog()}
    </div>`}};x([_()],k.prototype,"accountId",2);x([c()],k.prototype,"loadSt",2);x([c()],k.prototype,"step",2);x([c()],k.prototype,"reached",2);x([c()],k.prototype,"meters",2);x([c()],k.prototype,"tariffs",2);x([c()],k.prototype,"vat",2);x([c()],k.prototype,"settings",2);x([c()],k.prototype,"customers",2);x([c()],k.prototype,"nextNo",2);x([c()],k.prototype,"meterIds",2);x([c()],k.prototype,"tokens",2);x([c()],k.prototype,"formulaValid",2);x([c()],k.prototype,"formulaChecked",2);x([c()],k.prototype,"tariffId",2);x([c()],k.prototype,"tariffOpen",2);x([c()],k.prototype,"tf",2);x([c()],k.prototype,"months",2);x([c()],k.prototype,"anchorDay",2);x([c()],k.prototype,"anchorMonth",2);x([c()],k.prototype,"firstStart",2);x([c()],k.prototype,"custMode",2);x([c()],k.prototype,"custQ",2);x([c()],k.prototype,"existingId",2);x([c()],k.prototype,"nc",2);x([c()],k.prototype,"ncErr",2);x([c()],k.prototype,"accName",2);x([c()],k.prototype,"accNameErr",2);x([c()],k.prototype,"auto",2);x([c()],k.prototype,"afterSave",2);x([c()],k.prototype,"saving",2);x([c()],k.prototype,"saveErr",2);x([c()],k.prototype,"sampleResult",2);x([c()],k.prototype,"numOpen",2);x([c()],k.prototype,"numVal",2);x([c()],k.prototype,"numPct",2);x([c()],k.prototype,"numErr",2);k=x([T("elec-account-wizard")],k);var Ka=Object.defineProperty,Ua=Object.getOwnPropertyDescriptor,Vt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ua(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ka(e,a,i),i};let Tt=class extends G{constructor(){super(...arguments),this.st="loading",this.all=[],this.filter="",this.month="",this.q=""}connectedCallback(){super.connectedCallback(),R().bills&&this.load()}async load(){this.st="loading";try{this.all=(await b().listBills()).items,this.st=this.all.length?"ready":"empty"}catch{this.st="error"}}render(){if(!R().bills)return r`<div class="page" data-elec="bills" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לחיובים"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="bills" data-state="loading">${tt(7)}</div>`;if(this.st==="error")return r`<div class="page" data-elec="bills" data-state="error">${E("error","warning",s("לא ניתן לטעון את החיובים"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;if(this.st==="empty")return r`<div class="page" data-elec="bills" data-state="empty">${E("empty","bolt",s("אין חיובים עדיין"),{label:s("לחשבונות"),primary:!0,run:()=>Z(I.accounts())})}</div>`;const t=i=>this.all.filter(d=>d.state===i).length,e=[...new Set(this.all.map(i=>i.period.to.slice(0,7)))].sort().reverse(),a=this.q.trim(),n=this.all.filter(i=>(!this.filter||i.state===this.filter)&&(!this.month||i.period.to.startsWith(this.month))&&(!a||(i.number??"").includes(a)||i.customer.name.includes(a)||i.account_name.includes(a)));return r`<div class="page" data-elec="bills" data-state=${n.length?"ready":"filtered-empty"}>
      <div class="row">
        <div class="seg" role="group" aria-label=${s("סינון לפי מצב")} data-state-filter>
          <button type="button" data-filter="" aria-pressed=${this.filter===""} @click=${()=>this.filter=""}>${s("הכול")} ${u(this.all.length)}</button>
          ${da.map(i=>r`<button type="button" data-filter=${i} aria-pressed=${this.filter===i} @click=${()=>this.filter=i}>${oa[i]} ${u(t(i))}</button>`)}
        </div>
        <span class="sp"></span>
        <select data-month aria-label=${s("חודש")} style="inline-size:auto" @change=${i=>this.month=i.target.value}><option value="">${s("כל החודשים")}</option>${e.map(i=>r`<option value=${i} ?selected=${i===this.month}>${Ne(`${i}-01`)}</option>`)}</select>
        <input type="search" data-search aria-label=${s("חיפוש מספר או לקוח")} placeholder=${s("חיפוש מספר או לקוח")} .value=${this.q} @input=${i=>this.q=i.target.value} />
      </div>
      ${n.length?Re(n,{phone:this.phone}):E("empty","search",s("לא נמצאו חיובים"))}
    </div>`}};Vt([c()],Tt.prototype,"st",2);Vt([c()],Tt.prototype,"all",2);Vt([c()],Tt.prototype,"filter",2);Vt([c()],Tt.prototype,"month",2);Vt([c()],Tt.prototype,"q",2);Tt=Vt([T("elec-bills-list")],Tt);var Wa=Object.defineProperty,Ha=Object.getOwnPropertyDescriptor,qt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ha(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Wa(e,a,i),i};const F=t=>r`<span class="n">${t}</span>`;let xt=class extends St{constructor(){super(...arguments),this.snapshot=null,this.watermark="",this.logo="",this.hash="",this.zoom=1}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(t=>{const e=t[0].contentRect.width-(t[0].contentRect.width<520?16:40),a=Math.max(.3,Math.min(1,e/794));Math.abs(a-this.zoom)>.005&&(this.zoom=a)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}render(){const t=this.snapshot;if(!t)return o;const e=t.business,a=t.totals.total,n=t.bill.due_date??t.bill.expected_due_date,i=t.lines.length>1,d=new Set(t.lines.map($=>`${$.from}|${$.to}`)).size,l=$=>$==="interpolated"||$==="carried",h=t.meters.filter($=>l($.start.kind)||$.end.kind!=="reading"&&$.end.reading_kwh!==null),v=t.history.previous.filter($=>$.kwh!==null),p=v.length?v[v.length-1].kwh:null,m=this.watermark;return r`<div class="wrap" data-elec-paper>
      <div class="box" style="zoom:${this.zoom}">
        <div class="paper" style="--acc:${e.accent_color||"#2767ed"}">
          ${m?r`<div class="wm ${m==="בוטל"?"void":""}" data-watermark>${m}</div>`:o}
          <div class="ph">
            <div>
              <h1>${t.doc.title_he}</h1>
              <div class="sub">${t.doc.subtitle_he}</div>
              <div style="margin-block-start:12px">
                <b>מספר:</b> ${F(t.bill.number??"-")}${t.bill.replaces?r` <span class="sub">(מחליף את ${F(t.bill.replaces.number)})</span>`:o}<br />
                <b>תאריך הפקה:</b> ${F(S(t.bill.issue_date??"")||"-")}
              </div>
            </div>
            <div class="biz">
              <div class="info">
                <b>${e.name}</b><br />
                <span class="sub">${e.registration_no?r`ח.פ. ${F(e.registration_no)}<br />`:o}${e.address}<br />${e.phone?F(e.phone):o}${e.phone&&e.email?" · ":""}${e.email?F(e.email):o}</span>
              </div>
              <div class="logo">${this.logo?r`<img src=${this.logo} alt="" />`:(e.name||"A").slice(0,2)}</div>
            </div>
          </div>
          <div class="two">
            <div class="bx"><b>לכבוד</b><br />${t.customer.name}<br />${t.customer.address}<br />מספר לקוח: ${F(t.customer.customer_number)}<br />חשבון: ${t.account.name}</div>
            <div class="bx">
              <b>תקופת החיוב</b><br />מתאריך ${F(S(t.period.from))} עד תאריך ${F(S(t.period.to))} (${t.period.days} ימים)<br />תעריף: ${t.account.tariff.name}<br />לתשלום עד: ${F(S(n??""))}
            </div>
          </div>
          <div class="big"><span>סה״כ לתשלום</span><b class="n">${g(a)} ₪</b></div>
          <table>
            <thead><tr><th>מונה</th><th class="r">קריאה בתחילת התקופה</th><th class="r">קריאה בסוף התקופה</th><th class="r">צריכה (קוט״ש)</th><th class="r">חלק</th><th class="r">לחיוב (קוט״ש)</th></tr></thead>
            <tbody>
              ${t.meters.map($=>r`<tr data-meter=${$.meter_id}><td>${$.name}</td><td class="r" data-start-kind=${$.start.kind}>${Rt($.start.reading_kwh)}</td><td class="r">${Rt($.end.reading_kwh)}</td><td class="r">${g($.consumption_kwh)}</td><td class="r">${ca(Number($.coefficient))}</td><td class="r">${g($.contribution_kwh)}</td></tr>`)}
            </tbody>
          </table>
          <div class="note">נוסחת החשבון: ${t.account.formula.sentence_he}</div>
          ${h.map($=>{const y=$.end.kind!=="reading"&&$.end.reading_kwh!==null,L=l($.start.kind);return r`<div class="note">${$.name}: ${y?r`קריאת סוף התקופה ב-${F(ps($.end.at))}`:""}${L&&y?"; ":""}${L?r`קריאת תחילת התקופה לפי ${us($.start.kind)}`:""}.</div>`})}
          <table>
            <thead><tr><th>פירוט</th><th class="r">כמות</th><th class="r">מחיר ליחידה</th><th class="r">סכום (₪)</th></tr></thead>
            <tbody>
              ${t.lines.map($=>r`<tr data-line=${$.band?.id??"flat"}><td>צריכת חשמל${$.band?` - ${$.band.name_he}${$.season?` (${$.season.name_he})`:""}`:""}${($.band?d>1:i)?r` (${F(S($.from))} - ${F(S($.to))})`:o}</td><td class="r">${g($.kwh)} קוט״ש</td><td class="r">${B($.unit_price_ex_vat)} ₪</td><td class="r">${g($.amount_ex_vat)}</td></tr>`)}
              <tr><td>סה״כ לפני מע״מ</td><td></td><td></td><td class="r">${g(t.totals.amount_ex_vat)}</td></tr>
              <tr><td>מע״מ ${F(t.totals.vat_breakdown[0]?.rate_percent??t.lines[0]?.vat_rate_percent??"")}%</td><td></td><td></td><td class="r">${g(t.totals.vat_amount)}</td></tr>
              <tr class="tot"><td>סה״כ לתשלום</td><td></td><td></td><td class="r">${g(a)} ₪</td></tr>
            </tbody>
          </table>
          <div class="note">
            ${t.totals.price_mode_note_he?r`${t.totals.price_mode_note_he}; המחיר לפני מע״מ מוצג מעוגל ל-4 ספרות. `:o}הקריאות הן קריאות מונה מצטברות שנמדדו בפועל; הצריכה של כל מונה היא קריאת הסוף פחות קריאת הפתיחה.${p?r` צריכה בתקופה הקודמת: ${F(g(p))} קוט״ש.`:o}
          </div>
          ${t.notes.map($=>r`<div class="note" data-note=${$.code}>${$.text_he}</div>`)}
          ${e.footer_note?r`<div class="note"><b>הערות:</b> ${e.footer_note}</div>`:o}
          ${De(t.history)?r`<div class="sec">השוואת צריכה</div><elec-chart print .series=${t.history} table="visible" .height=${190}></elec-chart>`:o}
          <div class="spacer"></div>
          <div class="foot"><span>הופק ב-SmplWise Arx</span><span>עמוד 1 מתוך 1</span><span class="n">${this.hash}</span></div>
        </div>
      </div>
    </div>`}};xt.styles=et`
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
  `;qt([_({attribute:!1})],xt.prototype,"snapshot",2);qt([_()],xt.prototype,"watermark",2);qt([_()],xt.prototype,"logo",2);qt([_()],xt.prototype,"hash",2);qt([c()],xt.prototype,"zoom",2);xt=qt([T("elec-bill-paper")],xt);const Ht=t=>`energy/meters/${encodeURIComponent(t)}`,Za={log:t=>Ds(`${Ht(t)}/manual-readings`),async addReading(t,e){const a=await ie(`${Ht(t)}/manual-readings`,e);return{reading:a.reading,log:a.log??null}},undoReading:(t,e,a)=>ie(`${Ht(t)}/manual-readings/${encodeURIComponent(e)}/undo`,a?{reason:a}:{}),async addCalibration(t,e){const a=await ie(`${Ht(t)}/calibrations`,e);return{calibration:a.calibration,log:a.log??null}},undoCalibration:(t,e,a)=>ie(`${Ht(t)}/calibrations/${encodeURIComponent(e)}/undo`,a?{reason:a}:{})},Ga={kWh:1e3,Wh:1,MWh:1e6},ys={open_gap:"הקריאה השלימה את הפער מאז הדיווח האחרון. הצריכה עד הקריאה חולקה לפי זמן.",closed_gap:"הקריאה חילקה מחדש את הצריכה בפער הדיווח. הסכום הכולל לא השתנה.",head_gap:"הקריאה נקבעה כקריאת פתיחה לפני הקריאה הראשונה של המונה. הצריכה עד הקריאה הראשונה חולקה לפי זמן.",reported:"המונה דיווח בזמן הזה. הקריאה נשמרה להשוואה בלבד.",outside_counter:"הקריאה שונה מערך המונה במערכת. היא נשמרה להשוואה; לתיקון קבוע אפשר להגדיר כיול.",no_counter_data:"אין במערכת קריאות סביב הזמן הזה. הקריאה נשמרה להשוואה בלבד.",counter_events:"בזמן הזה היה איפוס או קפיצה במונה. הקריאה נשמרה להשוואה בלבד.",implausible:"הקריאה גבוהה מהסביר להספק המרבי של המונה. היא נשמרה להשוואה בלבד.",billed:"התקופה הזו כבר חויבה. הקריאה נשמרה להשוואה בלבד."};function Ya(t,e=0){const n={meter_id:t,items:[],calibrations:[],calibration:{factor:"1.0",offset_kwh:0,calibration_id:null,effective_date:null,identity:!0},suggestion:null,billed_until:"2026-09-30T21:00:00Z",first_calibration_date:"2026-10-01",undo_window_hours:24},i=(d,l,h,v,p,m,$={})=>({id:d,read_at:l,value_kwh:h,value_wh:Math.round(h*1e3),typed_value:String(h),typed_unit:"kWh",system_kwh:v,system_exact:v!=null,deviation_kwh:v==null?null:Math.round((h-v)*1e3)/1e3,effect:p,effect_reason:m,message:ys[m],note:null,created_at:l,created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!1,undo_until:null,...$});return t==="m1"&&(n.items=[i("r2","2026-10-01T06:10:00Z",247215.6,245830.1,"record","reported"),i("r1","2026-09-01T06:05:00Z",230981,229712.4,"record","reported",{note:"קריאה בלוח הראשי"})],n.calibrations=[{id:"c1",effective_date:"2026-10-02",effective_from:"2026-10-01T21:00:00Z",factor:"1.0",offset_kwh:1385.5,anchor_reading_id:"r2",note:null,in_force:!0,created_at:"2026-10-01T06:20:00Z",created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!1,undo_until:null}],n.calibration={factor:"1.0",offset_kwh:1385.5,calibration_id:"c1",effective_date:"2026-10-02",identity:!1},n.suggestion={factor:"1.0073",from_reading_id:"r1",to_reading_id:"r2",anchor_reading_id:"r2"}),t==="m8"&&(n.items=[i("r3","2026-10-04T17:30:00Z",e||18131.4,null,"allocation","open_gap",{created_at:wa,can_undo:!0,undo_until:"2026-10-05T18:49:00Z"})]),n}const Ce=new Map,Nt=t=>new Promise(e=>setTimeout(()=>e(t),60)),It=t=>JSON.parse(JSON.stringify(t));function kt(t,e,a,n={}){throw new Qt(t,{code:e,user_message:a,retryable:!1,correlation_id:"demo",details:n})}const Zt=t=>(Ce.has(t)||Ce.set(t,Ya(t)),Ce.get(t)),Xa={log:t=>Nt(It(Zt(t))),addReading(t,e){const a=Zt(t),n=Number(e.value)*Ga[e.unit]/1e3;if(!Number.isFinite(n)||n<0)return kt(422,"validation","הערך אינו מספר.",{fields:["value"]});if(Date.parse(e.read_at)>Date.now()+3e5)return kt(422,"validation","זמן הקריאה בעתיד.",{fields:["read_at"]});const d=a.items.filter(p=>!p.voided_at).filter(p=>p.read_at<e.read_at).sort((p,m)=>p.read_at<m.read_at?1:-1)[0];if(d&&n<d.value_kwh)return kt(422,"reading_not_monotonic","הקריאה נמוכה מקריאה ידנית קודמת של אותו מונה.",{fields:["value"]});const l=t==="m8"?null:1e3,h=t==="m8"?"open_gap":"reported",v={id:e.dry_run?null:`r${Date.now()}`,read_at:e.read_at,value_kwh:n,value_wh:Math.round(n*1e3),typed_value:e.value,typed_unit:e.unit,system_kwh:l,system_exact:l!=null,deviation_kwh:l==null?null:Math.round((n-l)*1e3)/1e3,effect:t==="m8"?"allocation":"record",effect_reason:h,message:ys[h],note:e.note??null,created_at:new Date().toISOString(),created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!0,undo_until:new Date(Date.now()+864e5).toISOString()};return e.dry_run?Nt({reading:v,log:null}):(a.items=[v,...a.items].sort((p,m)=>p.read_at<m.read_at?1:-1),Nt({reading:It(v),log:It(a)}))},undoReading(t,e,a){const n=Zt(t),i=n.items.find(d=>d.id===e);return i?i.can_undo?(Object.assign(i,{voided_at:new Date().toISOString(),voided_by_name:"דנה",void_reason:a??null,can_undo:!1}),Nt(It(n))):kt(409,"undo_window_passed","עבר הזמן שבו אפשר לבטל את הקריאה (24 שעות)."):kt(404,"not_found","הקריאה לא נמצאה.")},addCalibration(t,e){const a=Zt(t),n=Number(e.factor);if(!Number.isFinite(n)||n<.5||n>2)return kt(422,"validation","המקדם חייב להיות בין 0.5 ל-2.",{fields:["factor"]});if(a.first_calibration_date&&e.effective_date<a.first_calibration_date)return kt(409,"calibration_billed","התקופה הזו כבר חויבה. אפשר לכייל רק מ-"+a.first_calibration_date.split("-").reverse().join(".")+" והלאה.");const i=a.items.find(h=>h.id===e.anchor_reading_id),d=i&&i.system_kwh!=null?Math.round((i.value_kwh-n*i.system_kwh)*1e3)/1e3:Number(e.offset_kwh??0),l={id:e.dry_run?null:`c${Date.now()}`,effective_date:e.effective_date,effective_from:`${e.effective_date}T00:00:00Z`,factor:String(n),offset_kwh:d,anchor_reading_id:e.anchor_reading_id??null,note:e.note??null,in_force:!1,created_at:new Date().toISOString(),created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!0,undo_until:new Date(Date.now()+864e5).toISOString()};return e.dry_run?Nt({calibration:l,log:null}):(a.calibrations=[l,...a.calibrations],Nt({calibration:It(l),log:It(a)}))},undoCalibration(t,e,a){const n=Zt(t),i=n.calibrations.find(d=>d.id===e);return i?(Object.assign(i,{voided_at:new Date().toISOString(),voided_by_name:"דנה",void_reason:a??null,can_undo:!1,in_force:!1}),Nt(It(n))):kt(404,"not_found","הכיול לא נמצא.")}},te=()=>Ts()?Za:Xa,Qa=t=>te().log(t),Ie=(t,e)=>te().addReading(t,e),Ja=(t,e,a)=>te().undoReading(t,e,a),Je=(t,e)=>te().addCalibration(t,e),ti=(t,e,a)=>te().undoCalibration(t,e,a);function oe(t){const e=t.trim().replace(/[\s ]/g,"").replace(/,(?=\d{3}(\D|$))/g,"").replace(",",".");return/^\d+(\.\d+)?$/.test(e)?e:null}function ei(t){const e=t.trim().replace(",",".");if(!/^\d+(\.\d{1,6})?$/.test(e))return null;const a=Number(e);return a>=.5&&a<=2?e:null}function si(t){if(!t)return null;const e=new Date(t);return Number.isNaN(e.getTime())?null:e.toISOString()}function Se(t){const e=a=>String(a).padStart(2,"0");return`${t.getFullYear()}-${e(t.getMonth()+1)}-${e(t.getDate())}T${e(t.getHours())}:${e(t.getMinutes())}`}const ai={open_gap:bt("השלימה פער"),closed_gap:bt("חילקה פער"),head_gap:bt("קריאת פתיחה"),reported:bt("להשוואה"),outside_counter:bt("להשוואה"),no_counter_data:bt("להשוואה"),counter_events:bt("להשוואה"),implausible:bt("להשוואה"),billed:bt("להשוואה")};var ii=Object.defineProperty,ri=Object.getOwnPropertyDescriptor,A=(t,e,a,n)=>{for(var i=n>1?void 0:n?ri(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&ii(e,a,i),i};const ts={email:s("דוא״ל"),hand:s("מסירה ידנית"),other:s("אחר")};let j=class extends G{constructor(){super(...arguments),this.billId="",this.st="loading",this.bill=null,this.events=[],this.dlg="",this.busy=!1,this.error="",this.pdfFail=null,this.reason="",this.reasonTouched=!1,this.date="",this.how="email",this.text="",this.openingMeter=null,this.openingInfo="",this.daily=!1,this.loaded=""}willUpdate(t){t.has("billId")&&this.billId&&this.loaded!==this.billId&&(this.loaded=this.billId,this.load())}async load(){this.st="loading",this.pdfFail=null;try{const[t,e]=await Promise.all([b().getBill(this.billId),b().billEvents(this.billId).catch(()=>[])]);this.bill=t,this.events=e,this.st="ready"}catch(t){this.error=M(t),this.st=ce(t)==="forbidden"?"forbidden":"error"}}async refreshEvents(){this.events=await b().billEvents(this.billId).catch(()=>this.events)}open(t){this.dlg=t,this.error="",this.reason="",this.reasonTouched=!1,this.text="",this.date=J(),this.how="email"}close(){this.dlg=""}async act(t,e){if(!this.busy){this.busy=!0,this.error="";try{const a=await t();a&&(this.bill=a),this.close(),await this.refreshEvents(),e?.(a)}catch(a){this.error=M(a)}finally{this.busy=!1}}}issue(){const t=this.bill;this.act(()=>b().issueBill(t),async()=>{await this.pdf("check")})}async pdf(t){const e=this.bill;this.pdfFail=null;try{const a=await b().fetchPdf(e.id);if(e.state!=="draft"&&e.pdf&&e.pdf.state!=="stored"&&(this.bill=await b().getBill(e.id).catch(()=>this.bill)),t==="check")return;const n=URL.createObjectURL(a);if(t==="view")window.open(n,"_blank","noopener");else{const i=document.createElement("a");i.href=n,i.download=`${e.number??`draft-${e.id}`}.pdf`,i.click()}window.setTimeout(()=>URL.revokeObjectURL(n),3e4)}catch(a){this.pdfFail={code:ce(a),text:M(a)}}}btn(t,e){switch(t){case"issue":return r`<sw-button variant="primary" data-act="issue" @click=${()=>this.open("issue")}>${s("הנפקה")}</sw-button>`;case"sent":return r`<sw-button variant=${e.state==="issued"?"primary":"secondary"} data-act="sent" @click=${()=>this.open("sent")}>${s("סימון כנשלח")}</sw-button>`;case"paid":return r`<sw-button variant=${e.state==="sent"?"primary":"secondary"} data-act="paid" @click=${()=>this.open("paid")}>${s("סימון כשולם")}</sw-button>`;case"recalculate":return r`<sw-button data-act="recalculate" ?disabled=${this.busy} @click=${()=>void this.act(()=>b().recalcBill(e))}>${s("חישוב מחדש")}</sw-button>`;case"pdf":return e.state==="draft"?r`<sw-button data-act="pdf" @click=${()=>void this.pdf("view")}>${s("תצוגת PDF")}</sw-button>`:r`<sw-button data-act="pdf" @click=${()=>void this.pdf("download")}>${s("הורדת PDF")}</sw-button>`;case"correct":return r`<sw-button data-act="correct" @click=${()=>this.open("correct")}>${s("תיקון")}</sw-button>`;case"void":return r`<sw-button variant="danger" data-act="void" @click=${()=>this.open("void")}>${s("ביטול")}</sw-button>`;case"delete":return r`<sw-button variant="danger" data-act="delete" @click=${()=>this.open("delete")}>${s("מחיקת טיוטה")}</sw-button>`;default:return o}}render(){if(!R().bills)return r`<div class="page" data-elec="bill" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לחיובים"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="bill" data-state="loading">${tt(4)}</div>`;if(this.st!=="ready"||!this.bill)return r`<div class="page" data-elec="bill" data-state=${this.st}><div class="row"><a class="btn ghost sm" href=${z.bills()}>${s("→ חיובים")}</a></div>${E(this.st==="forbidden"?"forbidden":"error",this.st==="forbidden"?"lock":"warning",this.error||s("לא ניתן לטעון את החיוב"),this.st==="error"?{label:s("נסה שוב"),run:()=>void this.load()}:void 0)}</div>`;const t=this.bill,e=t.snapshot,a=t.state==="draft"?"טיוטה":t.state==="void"?"בוטל":"",n=r`${t.actions.map(l=>this.btn(l,t))}`,i=t.state==="draft"?e.notes.filter(l=>l.code==="meter_not_reporting"||l.code==="carried_in"):[],d=r`<div class="card"><div class="hd"><b class="h3">${s("פרטים")}</b></div><dl class="kv" data-bill-details>
        <dt>${s("חשבון")}</dt><dd><a class="lnk" href=${z.account(t.account_id)}>${t.account_name}</a></dd><dt>${s("לקוח")}</dt><dd>${t.customer.name}</dd>
        <dt>${s("תקופה")}</dt><dd>${u(S(t.period.from))} - ${u(S(t.period.to))}</dd>
        ${t.issue_date?r`<dt>${s("הונפק")}</dt><dd>${u(S(t.issue_date))}</dd>`:o}${t.due_date?r`<dt>${s("לתשלום עד")}</dt><dd>${u(S(t.due_date))}</dd>`:o}
        ${t.sent?r`<dt>${s("נשלח")}</dt><dd><span class="num" data-sent-at>${S(t.sent.at)}</span> · ${ts[t.sent.how]}</dd>`:o}${t.paid?r`<dt>${s("שולם")}</dt><dd><span class="num" data-paid-at>${S(t.paid.at)}</span>${t.paid.reference?r` · ${u(t.paid.reference)}`:o}</dd>`:o}
        <dt>${s("מקור")}</dt><dd>${t.origin==="auto"?s("נוצר אוטומטית"):s("נוצר ידנית")}</dd></dl></div>
      ${this.openingCard(t)}
      ${this.touCard(e)}
      <div class="card"><div class="hd"><b class="h3">${s("יומן")}</b></div><div class="list" data-bill-log>${this.events.map(l=>r`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${ps(l.at)}</span><span>${l.text}</span></div>`)}</div></div>`;return r`<div class="page" data-elec="bill" data-state="ready" data-bill-state=${t.state} data-bill-id=${t.id}>
      <div class="row"><a class="btn ghost sm" href=${z.bills()} data-back>${s("→ חיובים")}</a></div>
      <div class="row"><b class="h2 num" data-bill-number>${t.number??s("טיוטה")}</b>${Yt(t.state)}
        ${t.replaces_bill_id&&e.bill.replaces?r`<span class="mut">${s("מחליף את")} <a class="lnk num" href=${z.bill(t.replaces_bill_id)}>${e.bill.replaces.number}</a></span>`:o}
        ${t.replaced_by_bill_id?r`<span class="mut">${s("הוחלף בחיוב")} <a class="lnk" href=${z.bill(t.replaced_by_bill_id)}>${s("המתוקן")}</a></span>`:o}
        <span class="sp"></span>${this.phone?o:n}</div>
      ${this.phone?r`<div class="row" data-actions>${n}</div>`:o}
      ${this.pdfNotice(t)}
      ${t.state==="void"&&t.void?C("err",r`<b>${s("בוטל:")}</b> ${t.void.reason}`):o}
      ${i.map(l=>C("warn",l.text_he))}
      <div class="cols side-l"><div style="min-inline-size:0"><elec-bill-paper .snapshot=${e} watermark=${a} .hash=${(t.snapshot_sha256??"").slice(0,12).replace(/(.{4})/g,"$1 ").trim()} .logo=${this.logoSrc()}></elec-bill-paper></div><div class="col">${d}</div></div>
      ${this.daily&&e.tou?this.dailyTable(e.tou):o}
      ${this.dialogs(t)}
    </div>`}openingCard(t){const e=t.snapshot.period.start_utc,a=t.snapshot.meters.filter(n=>n.start.kind==="first_reading"||n.start.kind==="none");return t.state!=="draft"||!e||!a.length||!R().manage?o:r`<div class="card" data-card="opening"><div class="hd"><b class="h3">${s("קריאת פתיחה")}</b></div>
      <div class="list">${a.map(n=>r`<div class="row" data-opening-meter=${n.meter_id} style="flex-wrap:nowrap"><div class="grow"><div class="b">${n.name}</div><div class="mut">${n.start.reading_kwh===null?Rt(null):r`${u(Rt(n.start.reading_kwh))} · ${us(n.start.kind)}`}</div></div>
        <sw-button size="sm" data-opening-enter @click=${()=>this.openOpening(n)}>${s("הזנה")}</sw-button></div>`)}</div></div>`}openOpening(t){this.open("opening"),this.openingMeter=t,this.openingInfo=""}async saveOpening(){const t=this.bill,e=this.openingMeter,a=oe(this.text),n=t.snapshot.period.start_utc;if(!(!e||a===null||!n||this.busy)){this.busy=!0,this.error="";try{const i=await Ie(e.meter_id,{read_at:n,value:a,unit:"kWh",note:this.reason.trim()||void 0});if(i.reading.effect!=="allocation"){this.openingInfo=i.reading.message;return}this.bill=await b().recalcBill(t),this.close(),await this.refreshEvents()}catch(i){this.error=M(i)}finally{this.busy=!1}}}touCard(t){const e=t.tou;return e?r`<div class="card" data-card="tou"><div class="hd"><b class="h3">${s("לפי שעות")}</b><span class="sp"></span>
        <button type="button" class="btn ghost sm" data-tou-daily aria-expanded=${this.daily?"true":"false"} @click=${()=>this.daily=!this.daily}>${this.daily?s("הסתרת הפירוט היומי"):s("פירוט יומי")}</button></div>
      <div class="scrollx"><table class="t" data-tou-bands><thead><tr><th>${s("פס")}</th><th class="num">${s("שעות")}</th><th class="num">${s("קוט״ש")}</th><th class="num">${s("לפני מע״מ")}</th></tr></thead>
        <tbody>${e.by_band.map(a=>r`<tr data-band=${a.band.id}><td class="b">${a.band.name_he}</td><td class="num">${g(a.hours)}</td><td class="num">${g(a.kwh)}</td><td class="num">${g(a.amount_ex_vat)} ₪</td></tr>`)}</tbody></table></div>
      ${e.special_days.some(a=>a.kind!=="regular")?r`<div class="mut" style="margin-block-start:8px">${s("ימים מיוחדים:")} ${e.special_days.filter(a=>a.kind!=="regular").map(a=>`${S(a.date)} ${a.name_he}`).join(", ")}</div>`:o}</div>`:o}dailyTable(t){const a=Object.keys(t.names.bands).filter(n=>t.daily.some(i=>i.bands.some(d=>d.band===n)));return r`<div class="card flush" data-tou-daily-table><div class="hd"><b class="h3">${s("פירוט יומי לפי שעות (קוט״ש)")}</b><span class="sp"></span><span class="mut">${s("לעיון; כל ערך מעוגל בנפרד")}</span></div>
      <div class="scrollx"><table class="t"><thead><tr><th>${s("תאריך")}</th><th>${s("סוג יום")}</th>${a.map(n=>r`<th class="num">${t.names.bands[n]}</th>`)}<th class="num">${s("סה״כ")}</th></tr></thead>
        <tbody>${t.daily.map(n=>r`<tr data-day=${n.date}><td class="num" style="text-align:start">${S(n.date)}</td><td>${t.names.day_types[n.day_type]??n.day_type}${n.special?r` <span class="chip c-acc nodot">${n.special.name_he}</span>`:o}</td>
          ${a.map(i=>{const d=n.bands.find(l=>l.band===i);return r`<td class="num">${d?g(d.kwh):""}</td>`})}<td class="num b">${g(n.kwh)}</td></tr>`)}</tbody></table></div></div>`}pdfNotice(t){const e=t.pdf?.state,a=t.pdf?.error_code||"pdf_render_failed",n=this.pdfFail??(e==="failed"?{code:a,text:ke[a]??ke.pdf_render_failed}:e==="unavailable"?{code:"pdf_unavailable",text:ke.pdf_unavailable}:null);if(!n)return o;const i=ha.includes(n.code),d=n.code==="pdf_unavailable"?"unavailable":"failed";return r`<div class="alert ${i?"err":"warn"}" role="alert" data-pdf-error data-pdf-state=${d} data-pdf-code=${n.code}><span class="x" aria-hidden="true">!</span><div>${n.text}</div>${i?r`<sw-button size="sm" data-pdf-retry @click=${()=>void this.pdf(t.state==="draft"?"view":"download")}>${s("הפקת PDF מחדש")}</sw-button>`:o}</div>`}logoSrc(){const t=this.bill.snapshot.business.logo;return t?b().logoUrl(t.sha256):""}dialogs(t){const e=this.error?C("err",this.error):o,a=(d=s("ביטול"))=>r`<sw-button slot="actions" @click=${()=>this.close()}>${d}</sw-button>`,n=`${pa(t.number??"")}-${t.revision+1}`,i=!this.reason.trim();return r`
      <elec-dialog heading=${s("הנפקת חיוב")} ?open=${this.dlg==="issue"} data-dialog="issue" @close=${()=>this.close()}>
        <div>${s("החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.")}</div>
        <dl class="kv"><dt>${s("חשבון")}</dt><dd>${t.account_name}</dd><dt>${s("תקופה")}</dt><dd>${u(ut(t.period.from,t.period.to))}</dd><dt>${s("סה״כ לתשלום")}</dt><dd>${u(g(t.total)+" ₪")}</dd></dl>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>this.issue()}>${s("הנפקה")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("ביטול חיוב {no}",{no:t.number??""})} ?open=${this.dlg==="void"} data-dialog="void" @close=${()=>this.close()}>
        <div>${s("החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.")}</div>
        <div class="fld"><label for="vr">${s("סיבת הביטול")}</label>
          <textarea id="vr" data-reason class="${i&&this.reasonTouched?"err":""}" aria-required="true" placeholder=${s("חובה")} .value=${this.reason} @input=${d=>{this.reason=d.target.value,this.reasonTouched=!0}} @blur=${()=>this.reasonTouched=!0}></textarea>
          ${i&&this.reasonTouched?r`<div class="msg" role="alert" data-reason-error>${s("צריך לכתוב סיבה")}</div>`:o}</div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy||i} @click=${()=>void this.act(()=>b().voidBill(t.id,this.reason))}>${s("ביטול החיוב")}</sw-button>${a(s("חזרה"))}
      </elec-dialog>
      <elec-dialog heading=${s("תיקון חיוב")} ?open=${this.dlg==="correct"} data-dialog="correct" @close=${()=>this.close()}>
        <div>${s("תיווצר טיוטה מתוקנת")}${t.number?r` ${s("עם המספר")} <b class="num">${n}</b>`:""}. ${s("כשהיא תונפק, החיוב")} ${u(t.number??"")} ${s("יבוטל אוטומטית.")}</div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{const d=await b().correctBill(t.id);Z(I.bill(d.id)),this.billId=d.id})}>${s("יצירת טיוטה מתוקנת")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("סימון כנשלח")} ?open=${this.dlg==="sent"} data-dialog="sent" @close=${()=>this.close()}>
        <div class="form">
          <div class="fld"><label for="sd">${s("תאריך משלוח")}</label><input id="sd" type="date" lang=${ot()} class="ltr ${V(this.date)?"":"err"}" data-date .value=${this.date} @change=${d=>this.date=d.target.value} /></div>
          <div class="fld"><span class="lbl">${s("אופן משלוח")}</span><div class="seg" role="group" aria-label=${s("אופן משלוח")}>${["email","hand","other"].map(d=>r`<button type="button" data-how=${d} aria-pressed=${this.how===d} @click=${()=>this.how=d}>${ts[d]}</button>`)}</div></div>
        </div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy||!V(this.date)} @click=${()=>void this.act(()=>b().markSent(t.id,{at:this.date,how:this.how,note:"",row_version:t.row_version}))}>${s("שמירה")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("סימון כשולם")} ?open=${this.dlg==="paid"} data-dialog="paid" @close=${()=>this.close()}>
        <div class="form">
          <div class="fld"><label for="pd">${s("תאריך תשלום")}</label><input id="pd" type="date" lang=${ot()} class="ltr ${V(this.date)?"":"err"}" data-date .value=${this.date} @change=${d=>this.date=d.target.value} /></div>
          <div class="fld"><label for="pr">${s("אסמכתה (לא חובה)")}</label><input id="pr" class="ltr" data-reference placeholder=${s("לא חובה")} .value=${this.text} @input=${d=>this.text=d.target.value} /></div>
        </div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy||!V(this.date)} @click=${()=>void this.act(()=>b().markPaid(t.id,{at:this.date,reference:this.text.trim(),row_version:t.row_version}))}>${s("שמירה")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("קריאת פתיחה - {name}",{name:this.openingMeter?.name??""})} ?open=${this.dlg==="opening"} data-dialog="opening" @close=${()=>this.close()}>
        <div>${s("מה הראה המונה ב-")}${u(S(t.period.from))} ${s("בשעה 00:00. הצריכה מאז ועד הקריאה הראשונה שנקלטה תתווסף לחיוב.")}</div>
        <div class="form">
          <div class="fld"><label for="ov">${s("קריאה (קוט״ש)")}</label><input id="ov" class="ltr ${this.text&&oe(this.text)===null?"err":""}" inputmode="decimal" data-opening-value .value=${this.text} @input=${d=>this.text=d.target.value} /></div>
          <div class="fld"><label for="on">${s("הערה (לא חובה)")}</label><input id="on" data-opening-note placeholder=${s("לא חובה")} .value=${this.reason} @input=${d=>this.reason=d.target.value} /></div>
        </div>${this.openingInfo?C("warn",this.openingInfo):o}${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy||oe(this.text)===null} @click=${()=>void this.saveOpening()}>${s("שמירה וחישוב מחדש")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("מחיקת טיוטה")} ?open=${this.dlg==="delete"} data-dialog="delete" @close=${()=>this.close()}>
        <div>${s("הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.")}</div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{await b().deleteDraft(t),Z(I.bills())})}>${s("מחיקה")}</sw-button>${a()}
      </elec-dialog>`}};A([_()],j.prototype,"billId",2);A([c()],j.prototype,"st",2);A([c()],j.prototype,"bill",2);A([c()],j.prototype,"events",2);A([c()],j.prototype,"dlg",2);A([c()],j.prototype,"busy",2);A([c()],j.prototype,"error",2);A([c()],j.prototype,"pdfFail",2);A([c()],j.prototype,"reason",2);A([c()],j.prototype,"reasonTouched",2);A([c()],j.prototype,"date",2);A([c()],j.prototype,"how",2);A([c()],j.prototype,"text",2);A([c()],j.prototype,"openingMeter",2);A([c()],j.prototype,"openingInfo",2);A([c()],j.prototype,"daily",2);j=A([T("elec-bill-page")],j);var ni=Object.defineProperty,li=Object.getOwnPropertyDescriptor,Q=(t,e,a,n)=>{for(var i=n>1?void 0:n?li(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&ni(e,a,i),i};const di=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,es=(t="")=>({name:"",customer_number:t,tax_id:"",address:"",phone:"",email:"",notes:""});let K=class extends G{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams,this.st="loading",this.list=[],this.q="",this.card=null,this.cardSt="loading",this.form=es(),this.errs={},this.busy=!1,this.error="",this.confirmDel=!1,this.shown=""}connectedCallback(){super.connectedCallback(),R().bills&&this.loadList()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?(this.card=null,this.cardSt="ready",this.form=es(),b().nextCustomerNumber().then(a=>this.form={...this.form,customer_number:a}).catch(()=>{})):this.loadCard(e):this.card=null)}async loadList(){this.st="loading";try{this.list=await b().listCustomers(),this.st=this.list.length?"ready":"empty"}catch{this.st="error"}}async loadCard(t){this.cardSt="loading";try{const e=await b().getCustomer(t);this.card=e,this.form={name:e.name,customer_number:e.customer_number,tax_id:e.tax_id??"",address:e.address??"",phone:e.phone??"",email:e.email??"",notes:e.notes??""},this.cardSt="ready"}catch{this.cardSt="error"}}close(){Z(I.customers())}validate(){const t={};return this.form.name.trim()||(t.name=s("צריך לכתוב שם ללקוח")),this.form.email&&!di.test(this.form.email)&&(t.email=s("כתובת דוא״ל לא תקינה")),/^\d{1,9}$/.test(this.form.customer_number)||(t.customer_number=s("מספר לקוח הוא ספרות בלבד")),this.errs=t,!Object.keys(t).length}async save(){if(!(this.busy||!this.validate())){this.busy=!0,this.error="";try{const t={...this.form,name:this.form.name.trim()};if(this.card){const e={...t};t.customer_number===this.card.customer_number&&delete e.customer_number,this.card=await b().updateCustomer(this.card.id,this.card.revision,e)}else{const e=await b().createCustomer(t);await this.loadList(),Z(I.customer(e.id));return}await this.loadList()}catch(t){const e=jt(t);Object.keys(e).length?this.errs=e:this.error=M(t)}finally{this.busy=!1}}}async removeCustomer(){if(!(!this.card||this.busy)){this.busy=!0;try{await b().deleteCustomer(this.card.id,this.card.revision),this.confirmDel=!1,await this.loadList(),this.close()}catch(t){this.confirmDel=!1,this.error=M(t)}finally{this.busy=!1}}}field(t,e,a={}){const n=this.errs[t],i=a.ro||!R().manage;return r`<div class="fld ${a.wide?"wide":""}"><label for="f-${t}">${e}</label>
      ${a.area?r`<textarea id="f-${t}" name=${t} ?readonly=${i} placeholder=${a.ph??""} .value=${this.form[t]} @input=${d=>this.form={...this.form,[t]:d.target.value}}></textarea>`:r`<input id="f-${t}" name=${t} class="${a.ltr?"ltr":""} ${n?"err":""}" aria-invalid=${n?"true":"false"} ?readonly=${i} placeholder=${a.ph??""} .value=${this.form[t]} @input=${d=>{this.form={...this.form,[t]:d.target.value},this.errs[t]&&(this.errs={...this.errs,[t]:""})}} />`}
      ${n?r`<div class="msg" role="alert" data-field-error=${t}>${n}</div>`:o}</div>`}renderCard(){const t=R(),e=this.card;return r`<sw-sheet open wide .heading=${e?s("כרטיס לקוח"):s("לקוח חדש")} data-customer-card @close=${()=>this.close()}>
        <div class="col" style="gap:14px">
        ${this.cardSt==="loading"?tt(4):this.cardSt==="error"?E("error","warning",s("לא ניתן לטעון את הלקוח"),{label:s("נסה שוב"),run:()=>void this.loadCard(this.segments[0])}):r`
          <div class="form">${this.field("name",s("שם הלקוח"),{wide:!0})}${this.field("customer_number",s("מספר לקוח"),{ltr:!0})}${this.field("tax_id",s("ח.פ. / ע.מ. (לא חובה)"),{ltr:!0,ph:s("לא חובה")})}
            ${this.field("address",s("כתובת למשלוח החיוב"),{wide:!0})}${this.field("phone",s("טלפון"),{ltr:!0})}${this.field("email",s("דוא״ל"),{ltr:!0})}${this.field("notes",s("הערות"),{wide:!0,ph:s("לא חובה"),area:!0})}</div>
          ${e?r`<b class="h3">${s("חשבונות")}</b>
            <div class="list" data-customer-accounts>${(e.accounts??[]).map(a=>r`<a class="li" href=${z.account(a.id)}><div class="grow"><div class="t1">${a.name}</div></div></a>`)}${e.accounts?.length?o:r`<div class="mut">${s("אין חשבונות ללקוח")}</div>`}</div>
            ${e.bills?.length?r`<b class="h3">${s("חיובים אחרונים")}</b>${Re(e.bills.slice(0,4),{phone:!0})}`:o}`:o}
          ${this.error?C("err",this.error):o}
          ${t.manage?r`<div class="row"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button><span class="sp"></span>${e?r`<sw-button variant="danger" data-delete @click=${()=>this.confirmDel=!0}>${s("מחיקת לקוח")}</sw-button>`:o}</div>`:o}`}
        <elec-dialog heading=${s("מחיקת לקוח")} ?open=${this.confirmDel} data-dialog="delete-customer" @close=${()=>this.confirmDel=!1}>
          <div>${s("הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.")}</div>
          <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeCustomer()}>${s("מחיקה")}</sw-button>
          <sw-button slot="actions" @click=${()=>this.confirmDel=!1}>${s("ביטול")}</sw-button>
        </elec-dialog>
        </div>
      </sw-sheet>`}render(){const t=R();if(!t.bills)return r`<div class="page" data-elec="customers" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה ללקוחות"))}</div>`;const e=this.q.trim(),a=this.list.filter(i=>!e||i.name.includes(e)||i.customer_number.includes(e));let n;return this.st==="loading"?n=tt(5):this.st==="error"?n=E("error","warning",s("לא ניתן לטעון את הלקוחות"),{label:s("נסה שוב"),run:()=>void this.loadList()}):this.st==="empty"?n=E("empty","user",s("אין לקוחות עדיין"),t.manage?{label:s("+ לקוח חדש"),primary:!0,run:()=>Z(`${I.customers()}/new`)}:void 0):a.length?n=r`<div class="grid-cards" data-elec-list>${a.map(i=>r`<div class="card" data-customer-row=${i.id}>
        <div class="row" style="flex-wrap:nowrap"><div class="chip c-acc nodot" style="inline-size:36px;block-size:36px;justify-content:center;padding:0" aria-hidden="true">${i.name.slice(0,2)}</div><div style="min-inline-size:0"><a class="rowlink h3" href=${z.customer(i.id)}>${i.name}</a><div class="mut">${s("מספר לקוח")} ${u(i.customer_number)}</div></div></div>
        <dl class="kv" style="margin-block-start:10px"><dt>${s("חשבונות")}</dt><dd>${i.account_count}</dd>${i.phone?r`<dt>${s("טלפון")}</dt><dd>${u(i.phone)}</dd>`:o}${i.email?r`<dt>${s("דוא״ל")}</dt><dd>${u(i.email)}</dd>`:o}</dl></div>`)}</div>`:n=E("empty","search",s("לא נמצאו לקוחות")),r`<div class="page" data-elec="customers" data-state=${this.st}>
      <div class="row"><input type="search" data-search aria-label=${s("חיפוש לקוח")} placeholder=${s("חיפוש לקוח")} .value=${this.q} @input=${i=>this.q=i.target.value} /><span class="sp"></span>
        ${t.manage?r`<a class="btn pri ${this.phone?"sm":""}" data-new-customer href=${`#${I.customers()}/new`}>${s("+ לקוח חדש")}</a>`:o}</div>
      ${n}
      ${this.segments[0]?this.renderCard():o}
    </div>`}};K.styles=[gt];Q([_({attribute:!1})],K.prototype,"segments",2);Q([_({attribute:!1})],K.prototype,"params",2);Q([c()],K.prototype,"st",2);Q([c()],K.prototype,"list",2);Q([c()],K.prototype,"q",2);Q([c()],K.prototype,"card",2);Q([c()],K.prototype,"cardSt",2);Q([c()],K.prototype,"form",2);Q([c()],K.prototype,"errs",2);Q([c()],K.prototype,"busy",2);Q([c()],K.prototype,"error",2);Q([c()],K.prototype,"confirmDel",2);K=Q([T("elec-customers-page")],K);var oi=Object.defineProperty,ci=Object.getOwnPropertyDescriptor,Kt=(t,e,a,n)=>{for(var i=n>1?void 0:n?ci(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&oi(e,a,i),i};const ss=Array.from({length:97},(t,e)=>ua(e*15)),as=/^\d{2}-\d{2}$/;let Et=class extends G{constructor(){super(...arguments),this.definition=null,this.readonly=!1,this.errorPath="",this.priceMode="ex_vat",this.vatRate=null}emit(t){this.definition=t,this.dispatchEvent(new CustomEvent("tou-change",{detail:t,bubbles:!0,composed:!0}))}edit(t){if(!this.definition||this.readonly)return;const e=ne(this.definition);t(e),this.emit(e)}bad(t){return this.errorPath&&(this.errorPath===t||this.errorPath.startsWith(t+"[")||this.errorPath.startsWith(t+"."))?"err-on":""}bandName(t){return this.definition?.bands.find(e=>e.id===t)?.name_he??t}prices(t){const e=this.vatRate;return r`<div class="card flush" data-tou-prices>
      <div class="hd"><b class="h3">${s("מחירים לקוט״ש")}</b><span class="sp"></span><span class="hint">${this.priceMode==="inc_vat"?s("המחירים כוללים מע״מ"):s("המחירים לפני מע״מ")}</span></div>
      <div class="scrollx"><table class="t">
        <thead><tr><th>${s("פס")}</th>${t.seasons.map(a=>r`<th>${a.name_he}</th>`)}</tr></thead>
        <tbody>${t.bands.map(a=>r`<tr><td class="b"><span class="sw" style="background:${re(t,a.id)}"></span>${a.name_he}${a.id===t.default_band?r` <span class="hint">(${s("שאר השעות")})</span>`:o}</td>
          ${t.seasons.map(n=>{const i=$a(t,n.id).includes(a.id),d=t.prices[n.id]?.[a.id]??"",l=`prices.${n.id}.${a.id}`;if(!i&&(d===""||d===null))return r`<td class="pc"><span class="hint">-</span></td>`;const h=Number(d),v=e!==null&&d!==""&&Number.isFinite(h)?this.priceMode==="ex_vat"?h*(1+e):h/(1+e):null;return r`<td class="pc"><div class="unit"><input class="ltr ${this.bad(l)?"err":""}" inputmode="decimal" aria-label=${s("{band} ב{season}",{band:a.name_he,season:n.name_he})} data-tou-price=${`${n.id}:${a.id}`} .value=${d??""} ?disabled=${this.readonly}
              @input=${p=>this.edit(m=>{(m.prices[n.id]??={})[a.id]=p.target.value.trim()||null})} /><span>₪</span></div>
              ${v!==null?r`<div class="hint">${this.priceMode==="ex_vat"?s("כולל מע״מ"):s("לפני מע״מ")} ${u(B(v))}</div>`:o}</td>`})}</tr>`)}</tbody>
      </table></div>
    </div>`}dayRow(t,e,a,n,i){const d=t.schedule[e]?.[a]??[],l=t.bands.filter(m=>m.id!==t.default_band),h=i[e]?.[a]??[],v=(m,$)=>(Number($.slice(0,2))*60+Number($.slice(3))-(Number(m.slice(0,2))*60+Number(m.slice(3))))/1440*100,p=`schedule.${e}.${a}`;return r`<div class="b">${n}</div>
      <div class="day ${this.bad(p)}" data-tou-day=${`${e}:${a}`}>
        <div class="bar" role="img" aria-label=${`${n}: `+h.map(m=>`${m.from}-${m.to} ${this.bandName(m.band)}`).join(", ")}>${h.map(m=>r`<i style="inline-size:${v(m.from,m.to)}%;background:${re(t,m.band)}" title=${`${m.from}-${m.to} ${this.bandName(m.band)}`} data-cell=${m.band}></i>`)}</div>
        <div class="ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        ${d.map((m,$)=>r`<div class="rng" data-tou-range=${`${e}:${a}:${$}`}>
          <select aria-label=${s("משעה")} ?disabled=${this.readonly} @change=${y=>this.edit(L=>{L.schedule[e][a][$][0]=y.target.value})}>${ss.slice(0,96).map(y=>r`<option .selected=${y===m[0]} value=${y}>${y}</option>`)}</select>
          <span>${s("עד")}</span>
          <select aria-label=${s("עד שעה")} ?disabled=${this.readonly} @change=${y=>this.edit(L=>{L.schedule[e][a][$][1]=y.target.value})}>${ss.slice(1).map(y=>r`<option .selected=${y===m[1]} value=${y}>${y}</option>`)}</select>
          <select aria-label=${s("פס")} ?disabled=${this.readonly} @change=${y=>this.edit(L=>{L.schedule[e][a][$][2]=y.target.value})}>${t.bands.map(y=>r`<option .selected=${y.id===m[2]} value=${y.id}>${y.name_he}</option>`)}</select>
          ${this.readonly?o:r`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת טווח")} data-tou-remove @click=${()=>this.edit(y=>{y.schedule[e][a].splice($,1),y.schedule[e][a].length||delete y.schedule[e][a]})}></sw-button>`}
        </div>`)}
        ${this.readonly||!l.length?o:r`<div><sw-button variant="ghost" size="sm" data-tou-add=${`${e}:${a}`} @click=${()=>this.edit(m=>{((m.schedule[e]??={})[a]??=[]).push(["17:00","22:00",l[0].id])})}>${s("+ טווח שעות")}</sw-button></div>`}
      </div>`}hours(t){const e=ma(t),a=n=>n.ranges.map(([i,d])=>`${i.split("-").reverse().join(".")}-${d.split("-").reverse().join(".")}`).join(", ");return r`<div class="card" data-tou-hours>
      <div class="hd"><b class="h3">${s("שעות לפי עונה")}</b><span class="sp"></span>
        <span class="legend">${t.bands.map(n=>r`<span><i style="background:${re(t,n.id)}"></i>${n.name_he}</span>`)}</span></div>
      <div class="col">${t.seasons.map(n=>r`<div class="season" data-tou-season=${n.id}>
        <div class="row"><b class="h3">${n.name_he}</b><span class="mut">${u(a(n))}</span></div>
        <div class="dt">${t.day_types.map(i=>this.dayRow(t,n.id,i.id,i.name_he,e))}</div>
      </div>`)}</div>
      <div class="hint" style="margin-block-start:8px">${s("כל שעה שאינה בטווח שייכת ל{band}. השעות הן שעון מקומי; טווח שעובר את חצות (22:00 עד 06:00) נספר באותו תאריך.",{band:this.bandName(t.default_band)})}</div>
    </div>`}structure(t){const e=this.readonly,a=(n,i,d,l)=>r`<select class="${this.bad(i)?"err":""}" ?disabled=${e} @change=${h=>this.edit(v=>d(v,h.target.value||null))}>
      ${l?r`<option value="" .selected=${n===null}>${s("ללא שינוי")}</option>`:o}${t.day_types.map(h=>r`<option value=${h.id} .selected=${h.id===n}>${h.name_he}</option>`)}</select>`;return r`<details class="card" data-tou-structure ?open=${!!this.errorPath&&/^(seasons|bands|week|holiday|day_types|default_band)/.test(this.errorPath)}>
      <summary>${s("מבנה התעריף: עונות, פסים וימים")}</summary>
      <div class="stru">
        <div class="col">
          <b>${s("עונות")}</b>
          ${t.seasons.map((n,i)=>r`<div class="season ${this.bad(`seasons[${i}]`)}" data-tou-season-def=${n.id}>
            <div class="row"><input aria-label=${s("שם העונה")} .value=${n.name_he} ?disabled=${e} @input=${d=>this.edit(l=>{l.seasons[i].name_he=d.target.value})} />
              ${e||t.seasons.length<2?o:r`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת העונה")} @click=${()=>this.edit(d=>{const[l]=d.seasons.splice(i,1);delete d.schedule[l.id],delete d.prices[l.id]})}></sw-button>`}</div>
            ${n.ranges.map((d,l)=>r`<div class="rng"><span class="mut">${s("מ")}</span><input class="md ltr" aria-label=${s("מתאריך (חודש-יום)")} placeholder="MM-DD" .value=${d[0]} ?disabled=${e} @change=${h=>{const v=h.target.value.trim();as.test(v)&&this.edit(p=>{p.seasons[i].ranges[l][0]=v})}} />
              <span class="mut">${s("עד")}</span><input class="md ltr" aria-label=${s("עד תאריך (חודש-יום)")} placeholder="MM-DD" .value=${d[1]} ?disabled=${e} @change=${h=>{const v=h.target.value.trim();as.test(v)&&this.edit(p=>{p.seasons[i].ranges[l][1]=v})}} />
              ${e||n.ranges.length<2?o:r`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת טווח תאריכים")} @click=${()=>this.edit(h=>{h.seasons[i].ranges.splice(l,1)})}></sw-button>`}</div>`)}
            ${e?o:r`<div><sw-button variant="ghost" size="sm" @click=${()=>this.edit(d=>{d.seasons[i].ranges.push(["01-01","01-31"])})}>${s("+ טווח תאריכים")}</sw-button></div>`}
          </div>`)}
          ${e?o:r`<div><sw-button size="sm" data-tou-add-season @click=${()=>this.edit(n=>{const i=He("season",n.seasons.map(d=>d.id));n.seasons.push({id:i,name_he:"עונה חדשה",ranges:[["01-01","01-31"]]}),n.prices[i]={}})}>${s("+ עונה")}</sw-button></div>`}
          <div class="hint">${s("העונות חייבות לכסות את כל השנה בלי חפיפה. 29 בפברואר שייך לעונה של 28 בפברואר.")}</div>
        </div>
        <div class="col">
          <b>${s("פסי תעריף")}</b>
          ${t.bands.map((n,i)=>r`<div class="row ${this.bad(`bands[${i}]`)}"><span class="sw" style="background:${re(t,n.id)}"></span>
            <input aria-label=${s("שם הפס")} .value=${n.name_he} data-tou-band-name=${n.id} ?disabled=${e} @input=${d=>this.edit(l=>{l.bands[i].name_he=d.target.value})} />
            ${e||n.id===t.default_band||t.bands.length<2?o:r`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת הפס")} @click=${()=>this.edit(d=>{d.bands.splice(i,1);for(const l of Object.values(d.schedule))for(const h of Object.keys(l))l[h]=l[h].filter(v=>v[2]!==n.id),l[h].length||delete l[h];for(const l of Object.values(d.prices))delete l[n.id]})}></sw-button>`}</div>`)}
          ${e||t.bands.length>=8?o:r`<div><sw-button size="sm" data-tou-add-band @click=${()=>this.edit(n=>{n.bands.push({id:He("band",n.bands.map(i=>i.id)),name_he:"פס חדש"})})}>${s("+ פס")}</sw-button></div>`}
          <div class="fld"><label>${s("שאר השעות שייכות ל")}</label><select ?disabled=${e} @change=${n=>this.edit(i=>{i.default_band=n.target.value})}>${t.bands.map(n=>r`<option value=${n.id} .selected=${n.id===t.default_band}>${n.name_he}</option>`)}</select></div>
          <b>${s("ימים")}</b>
          <div class="dt">${$s.map(n=>r`<span>${ms[n]}</span>${a(t.week[n],`week.${n}`,(i,d)=>{i.week[n]=d??i.day_types[0].id},!1)}`)}
            <span>${s("חג")}</span>${a(t.holiday,"holiday",(n,i)=>{n.holiday=i},!0)}
            <span>${s("ערב חג")}</span>${a(t.holiday_eve,"holiday_eve",(n,i)=>{n.holiday_eve=i},!0)}</div>
          <div class="hint">${s("יום שמתאים לכמה סוגים (שבת שהיא גם ערב חג) מקבל את הסוג המאוחר ברשימה:")} ${t.day_types.map(n=>n.name_he).join(` ${s("←")} `)}.</div>
        </div>
      </div>
    </details>`}render(){const t=this.definition;return t?r`<div class="tou" data-tou-editor>${this.prices(t)}${this.hours(t)}${this.structure(t)}</div>`:o}};Et.styles=[...G.styles,et`
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
    `];Kt([_({attribute:!1})],Et.prototype,"definition",2);Kt([_({type:Boolean})],Et.prototype,"readonly",2);Kt([_()],Et.prototype,"errorPath",2);Kt([_()],Et.prototype,"priceMode",2);Kt([_({type:Number})],Et.prototype,"vatRate",2);Et=Kt([T("elec-tou-editor")],Et);var hi=Object.defineProperty,pi=Object.getOwnPropertyDescriptor,O=(t,e,a,n)=>{for(var i=n>1?void 0:n?pi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&hi(e,a,i),i};const is=/^\d+(\.\d+)?$/,rs=/^#[0-9a-fA-F]{6}$/,ui=t=>{const e=[1,3,5].map(a=>parseInt(t.slice(a,a+2),16)/255).map(a=>a<=.03928?a/12.92:((a+.055)/1.055)**2.4);return .2126*e[0]+.7152*e[1]+.0722*e[2]};function ns(t){const e=t.current?.definition;return e?`${e.bands.map(a=>a.name_he).join(" / ")} · ${s("{n} עונות",{n:e.seasons.length})}`:s("לפי שעות")}let D=class extends G{constructor(){super(...arguments),this.st="loading",this.tariffs=[],this.vat=null,this.settings=null,this.tOpen=!1,this.tEdit=null,this.tf={name:"",price:"",mode:"ex_vat",from:""},this.tErr={},this.tVer=null,this.tPlan=null,this.tKind="fixed",this.tDef=null,this.tErrPath="",this.tSource="",this.vOpen=!1,this.vf={rate:"",from:""},this.vErr={},this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{const t=b();[this.tariffs,this.vat,this.settings]=await Promise.all([t.listTariffs(),t.getVat(),t.getSettings().catch(()=>null)]),this.st="ready"}catch(t){this.st=Te(t)?"forbidden":"error"}}rate(){return this.vat?.current?Number(this.vat.current.rate_percent)/100:0}derived(t,e){const a=Number(t)||0,n=this.rate();return e==="ex_vat"?{ex:a,vat:a*n,inc:a*(1+n)}:{ex:a/(1+n),vat:a-a/(1+n),inc:a}}openTariff(t){this.tEdit=t,this.tf=t?.current?{name:t.name,price:t.current.price??"",mode:t.current.price_mode,from:J()}:{name:"",price:"",mode:this.settings?.default_price_mode??"ex_vat",from:J()},this.tKind=t?.kind==="tou"?"tou":"fixed",this.tDef=t?.kind==="tou"&&t.current?.definition?ne(t.current.definition):null,this.tSource="",this.tErrPath="",this.tErr={},this.tVer=null,this.tPlan=null,this.error="",this.tOpen=!0}async setKind(t){if(!(this.tEdit||this.tKind===t)&&(this.tKind=t,this.tErrPath="",this.error="",t==="tou"&&!this.tDef))try{const e=(await b().touTemplates())[0];this.tDef=ne(e?.definition??Ze()),this.tSource=e?.source_he??""}catch(e){this.tDef=Ze(),this.error=M(e)}}editVersion(t){this.tEdit&&(this.tVer=t,this.tPlan=null,this.tErr={},this.tErrPath="",this.error="",this.tf={name:this.tEdit.name,price:t.price??"",mode:t.price_mode,from:t.effective_from},t.definition&&(this.tDef=ne(t.definition)))}setTf(t){this.tf={...this.tf,...t},this.tPlan=null}planText(t){const e=a=>a.price===null?a.price_mode==="inc_vat"?s("מחירים לפי שעות כולל מע״מ"):s("מחירים לפי שעות לפני מע״מ"):`${B(a.price)} ₪ ${a.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}`;return`${e(t.old)} ← ${e(t.new)}. ${t.message_he}`}async saveTariff(){const t=this.tf,e=this.tKind==="tou",a={};if(t.name.trim()||(a.name=s("צריך לתת שם לתעריף")),!e&&(!is.test(t.price)||Number(t.price)<=0)&&(a.price=s("המחיר חייב להיות מספר גדול מאפס")),V(t.from)||(a.from=s("צריך לבחור תאריך")),this.tErr=a,!(Object.keys(a).length||this.busy||e&&!this.tDef)){this.busy=!0,this.error="",this.tErrPath="";try{const n={name:t.name.trim(),price:e?"":t.price,price_mode:t.mode,effective_from:t.from,definition:e?this.tDef:null};if(this.tEdit){const i=await b().correctTariffVersion(this.tEdit.id,n,{replaceId:this.tVer?.id??null,base:this.tVer,confirm:!!this.tPlan});if(!i.applied&&i.plan){this.tPlan=i.plan;return}}else await b().createTariff(n);this.tPlan=null,this.tOpen=!1,this.tariffs=await b().listTariffs()}catch(n){const i=jt(n);Object.keys(i).length?this.tErr=i:this.error=M(n);const d=n instanceof Qt?n.body.details?.errors?.[0]:void 0;d?.path!==void 0&&(this.tErrPath=d.path)}finally{this.busy=!1}}}async saveVat(){const t={};if((!is.test(this.vf.rate)||Number(this.vf.rate)>50)&&(t.rate_percent=s("שיעור המע״מ חייב להיות בין 0 ל-50")),V(this.vf.from)||(t.effective_from=s("צריך לבחור תאריך")),this.vErr=t,!(Object.keys(t).length||this.busy)){this.busy=!0,this.error="";try{this.vat=await b().addVat(this.vf.rate,this.vf.from),this.vOpen=!1}catch(e){const a=jt(e);Object.keys(a).length?this.vErr=a:this.error=M(e)}finally{this.busy=!1}}}async setMode(t){if(!(!this.settings||!R().manage||this.settings.default_price_mode===t))try{this.settings=await b().saveSettings(this.settings.revision,{default_price_mode:t}),this.error=""}catch(e){this.error=M(e)}}render(){const t=R();if(!t.bills&&!t.manage)return r`<div class="page" data-elec="settings-prices" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה למחירים"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="settings-prices" data-state="loading">${tt(4)}</div>`;if(this.st==="forbidden")return r`<div class="page" data-elec="settings-prices" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה למחירים"))}</div>`;if(this.st==="error")return r`<div class="page" data-elec="settings-prices" data-state="error">${E("error","warning",s("לא ניתן לטעון את המחירים"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;const e=this.vat?.current,a=(this.vat?.items??[]).slice().sort((l,h)=>l.effective_from<h.effective_from?1:-1),n=t.manage,i=this.derived(this.tf.price,this.tf.mode),d=this.settings?.default_price_mode??"ex_vat";return r`<div class="page" data-elec="settings-prices" data-state="ready">
      ${this.error&&!this.tOpen&&!this.vOpen?C("err",this.error):o}
      ${e?o:C("warn",s("לא הוגדר שיעור מע״מ. בלי שיעור אי אפשר להפיק חיובים."))}
      <div class="cols side-l">
        <div class="card ${this.phone?"":"flush"}"><div class="hd"><b class="h3">${s("תעריפים")}</b><span class="sp"></span>${n?r`<sw-button variant="primary" size="sm" data-new-tariff @click=${()=>this.openTariff(null)}>${s("+ תעריף")}</sw-button>`:o}</div>
          ${this.tariffs.length?this.phone?r`<div class="list" data-tariffs>${this.tariffs.map(l=>r`<button type="button" class="li" data-tariff-row=${l.id} data-kind=${l.kind} ?disabled=${!n} @click=${()=>n&&this.openTariff(l)}><div class="grow"><div class="t1">${l.name}</div><div class="t2">${l.kind==="tou"?r`${ns(l)} · `:o}${l.current?.price_mode==="inc_vat"?s("הוזן כולל מע״מ"):s("הוזן לפני מע״מ")} · ${s("מ-")}${u(S(l.current?.effective_from??""))}</div></div>${l.kind==="tou"?r`<span class="chip c-acc nodot">${s("לפי שעות")}</span>`:r`<b class="num">${B(l.current?.price??0)} ₪</b>`}</button>`)}</div>`:r`<div class="scrollx"><table class="t" data-tariffs><thead><tr><th>${s("שם")}</th><th class="num">${s("מחיר שהוזן")}</th><th>${s("הוזן")}</th><th class="num">${s("לפני מע״מ")}</th><th class="num">${s("כולל מע״מ")}</th><th>${s("בתוקף מ")}</th><th>${s("חשבונות")}</th></tr></thead><tbody>
                ${this.tariffs.map(l=>{const h=this.derived(l.current?.price??"0",l.current?.price_mode??"ex_vat"),v=l.kind==="tou";return r`<tr class="${n?"go":""}" data-tariff-row=${l.id} data-kind=${l.kind} @click=${()=>n&&this.openTariff(l)}><td class="b">${l.name}${v?r` <span class="chip c-acc nodot">${s("לפי שעות")}</span>`:o}</td>${v?r`<td colspan="1" class="mut">${ns(l)}</td><td>${l.current?.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}</td><td class="num">-</td><td class="num">-</td>`:r`<td class="num">${B(l.current?.price??0)} ₪</td><td>${l.current?.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}</td><td class="num">${B(h.ex)} ₪</td><td class="num">${B(h.inc)} ₪</td>`}<td class="num" style="text-align:start">${S(l.current?.effective_from??"")}</td><td>${l.used_by}</td></tr>`})}</tbody></table></div>`:E("empty","bolt",s("אין תעריפים עדיין"),n?{label:s("+ תעריף"),primary:!0,run:()=>this.openTariff(null)}:void 0)}
        </div>
        <div class="col">
          <div class="card" data-card="vat"><div class="hd"><b class="h3">${s("שיעור מע״מ")}</b><span class="sp"></span>${n?r`<sw-button size="sm" data-new-vat @click=${()=>{this.vf={rate:"",from:J()},this.vErr={},this.error="",this.vOpen=!0}}>${s("+ שיעור חדש")}</sw-button>`:o}</div>
            ${e?r`<div class="row" style="align-items:baseline"><span style="font-size:var(--sw-fs-3xl);font-weight:700" data-vat-rate>${u(e.rate_percent+"%")}</span><span class="mut">${s("מ-")}${u(S(e.effective_from))}</span></div>`:r`<div class="mut">${s("לא הוגדר")}</div>`}
            ${a.slice(1).map((l,h)=>r`<div class="ver" style="margin-block-start:8px"><span class="num">${l.rate_percent}%</span><span>${s("עד")} ${u(S(Xt(a[h].effective_from,-1)))}</span></div>`)}</div>
          <div class="card" data-card="mode"><div class="hd"><b class="h3">${s("ברירת מחדל להזנת מחיר")}</b></div><div class="list" role="radiogroup" aria-label=${s("ברירת מחדל להזנת מחיר")}>
            ${["ex_vat","inc_vat"].map(l=>r`<label class="li ${d===l?"sel":""}"><input type="radio" name="mode" data-default-mode=${l} .checked=${d===l} ?disabled=${!n} @change=${()=>void this.setMode(l)} /><span class="ind"></span><div class="grow t1">${l==="ex_vat"?s("לפני מע״מ"):s("כולל מע״מ")}</div></label>`)}</div></div>
        </div>
      </div>
      <elec-dialog heading=${this.tEdit?s("עריכת תעריף"):s("תעריף חדש")} ?open=${this.tOpen} ?wide=${this.tKind==="tou"} data-dialog="tariff" @close=${()=>this.tOpen=!1}>
        <div class="form">
          <div class="fld wide"><label for="tn">${s("שם התעריף")}</label><input id="tn" class="${this.tErr.name?"err":""}" data-tariff-name .value=${this.tf.name} @input=${l=>this.setTf({name:l.target.value})} />${this.tErr.name?r`<div class="msg" role="alert">${this.tErr.name}</div>`:o}</div>
          ${this.tEdit?o:r`<div class="fld wide"><span class="lbl">${s("סוג התעריף")}</span><div class="seg" role="group" aria-label=${s("סוג התעריף")}><button type="button" data-tariff-kind="fixed" aria-pressed=${this.tKind==="fixed"} @click=${()=>void this.setKind("fixed")}>${s("מחיר קבוע")}</button><button type="button" data-tariff-kind="tou" aria-pressed=${this.tKind==="tou"} @click=${()=>void this.setKind("tou")}>${s("לפי שעות (תעו״ז)")}</button></div></div>`}
          ${this.tKind==="fixed"?r`<div class="fld"><label for="tp">${s("מחיר לקוט״ש")}</label><div class="unit"><input id="tp" class="ltr ${this.tErr.price?"err":""}" data-tariff-price inputmode="decimal" .value=${this.tf.price} @input=${l=>this.setTf({price:l.target.value})} /><span>₪</span></div>${this.tErr.price?r`<div class="msg" role="alert">${this.tErr.price}</div>`:o}</div>`:o}
          <div class="fld"><span class="lbl">${this.tKind==="tou"?s("המחירים שהוזנו"):s("המחיר שהוזן")}</span><div class="seg" role="group" aria-label=${s("סוג מחיר")}><button type="button" data-tariff-mode="ex_vat" aria-pressed=${this.tf.mode==="ex_vat"} @click=${()=>this.setTf({mode:"ex_vat"})}>${s("לפני מע״מ")}</button><button type="button" data-tariff-mode="inc_vat" aria-pressed=${this.tf.mode==="inc_vat"} @click=${()=>this.setTf({mode:"inc_vat"})}>${s("כולל מע״מ")}</button></div></div>
          <div class="fld"><label for="tf">${s("בתוקף מתאריך")}</label><input id="tf" type="date" lang=${ot()} class="ltr ${this.tErr.effective_from?"err":""}" data-tariff-from .value=${this.tf.from} @change=${l=>this.setTf({from:l.target.value})} />${this.tErr.effective_from?r`<div class="msg" role="alert">${this.tErr.effective_from}</div>`:o}</div>
        </div>
        ${this.tKind==="fixed"&&e?r`<div class="card soft" data-tariff-derived><dl class="kv"><dt>${s("לפני מע״מ")}</dt><dd>${u(B(i.ex)+" ₪")}</dd><dt>${s("מע״מ")} ${u(e.rate_percent+"%")}</dt><dd>${u(B(i.vat)+" ₪")}</dd><dt>${s("כולל מע״מ")}</dt><dd>${u(B(i.inc)+" ₪")}</dd></dl></div>`:o}
        ${this.tKind==="tou"&&this.tSource&&!this.tEdit?C("info",this.tSource):o}
        ${this.tKind==="tou"&&this.tDef?r`<elec-tou-editor .definition=${this.tDef} .priceMode=${this.tf.mode} .vatRate=${e?Number(e.rate_percent)/100:null} .errorPath=${this.tErrPath}
            @tou-change=${l=>{this.tDef=l.detail,this.tPlan=null,this.tErrPath=""}}></elec-tou-editor>`:o}
        ${this.tEdit&&this.tEdit.versions.length?r`<b class="h3">${s("גרסאות")}</b><div class="list" data-tariff-versions>${this.tEdit.versions.map(l=>r`<div class="ver" data-version=${l.id} aria-current=${this.tVer?.id===l.id?"true":"false"}><span class="num">${l.definition?s("לפי שעות"):`${B(l.price??0)} ₪`}</span><span>${l.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")} · ${s("מ-")}${u(S(l.effective_from))}</span>${R().manage?r`<button type="button" class="btn ghost sm" data-version-edit=${l.id} aria-label=${s("תיקון המחיר")} @click=${()=>this.editVersion(l)}>${s("תיקון")}</button>`:o}</div>`)}</div>`:o}
        ${this.tPlan?C("warn",this.planText(this.tPlan)):o}
        ${this.error?C("err",this.error):o}
        <sw-button variant="primary" slot="actions" data-save ?disabled=${this.busy} @click=${()=>void this.saveTariff()}>${this.tPlan?s("אישור והחלפה"):this.tVer?s("שמירת תיקון"):s("שמירה")}</sw-button>
        <sw-button slot="actions" @click=${()=>this.tOpen=!1}>${s("ביטול")}</sw-button>
      </elec-dialog>
      <elec-dialog heading=${s("שיעור מע״מ חדש")} ?open=${this.vOpen} data-dialog="vat" @close=${()=>this.vOpen=!1}>
        <div class="form">
          <div class="fld"><label for="vr">${s("שיעור")}</label><div class="unit"><input id="vr" class="ltr ${this.vErr.rate_percent?"err":""}" data-vat-input inputmode="decimal" .value=${this.vf.rate} @input=${l=>this.vf={...this.vf,rate:l.target.value}} /><span>%</span></div>${this.vErr.rate_percent?r`<div class="msg" role="alert">${this.vErr.rate_percent}</div>`:o}</div>
          <div class="fld"><label for="vf">${s("בתוקף מתאריך")}</label><input id="vf" type="date" lang=${ot()} class="ltr ${this.vErr.effective_from?"err":""}" data-vat-from .value=${this.vf.from} @change=${l=>this.vf={...this.vf,from:l.target.value}} />${this.vErr.effective_from?r`<div class="msg" role="alert">${this.vErr.effective_from}</div>`:o}</div>
        </div>
        ${this.error?C("err",this.error):o}
        <sw-button variant="primary" slot="actions" data-save ?disabled=${this.busy} @click=${()=>void this.saveVat()}>${s("שמירה")}</sw-button>
        <sw-button slot="actions" @click=${()=>this.vOpen=!1}>${s("ביטול")}</sw-button>
      </elec-dialog>
    </div>`}};O([c()],D.prototype,"st",2);O([c()],D.prototype,"tariffs",2);O([c()],D.prototype,"vat",2);O([c()],D.prototype,"settings",2);O([c()],D.prototype,"tOpen",2);O([c()],D.prototype,"tEdit",2);O([c()],D.prototype,"tf",2);O([c()],D.prototype,"tErr",2);O([c()],D.prototype,"tVer",2);O([c()],D.prototype,"tPlan",2);O([c()],D.prototype,"tKind",2);O([c()],D.prototype,"tDef",2);O([c()],D.prototype,"tErrPath",2);O([c()],D.prototype,"tSource",2);O([c()],D.prototype,"vOpen",2);O([c()],D.prototype,"vf",2);O([c()],D.prototype,"vErr",2);O([c()],D.prototype,"busy",2);O([c()],D.prototype,"error",2);D=O([T("elec-settings-prices")],D);function $i(t,e,a){const n=J();return{schema:"arx.energy.bill_snapshot/1",doc:{title_he:"חשבון צריכת חשמל ודרישת תשלום",subtitle_he:"אינו חשבונית מס",is_tax_invoice:!1},bill:{id:"",number:"2026-09-0001",revision:1,replaces:null,state:"issued",issue_date:n,due_date:e.mode==="net_days"?Xt(n,e.days):`${n.slice(0,7)}-${String(e.day_of_month).padStart(2,"0")}`,expected_due_date:null,payment_terms:{mode:e.mode,days:e.days,day_of_month:e.day_of_month}},period:{from:"2026-09-01",to:"2026-09-30",days:30},business:{...t,logo:a?{sha256:"x",mime:"image/png"}:null},customer:{id:"c",customer_number:"0001",name:"לקוח לדוגמה",address:"רחוב הדוגמה 12, עיר לדוגמה",phone:"",email:"",tax_id:""},account:{id:"a",name:"חשבון לדוגמה",tariff:{id:"t",name:"תעריף"},formula:{text:"[מונה]",sentence_he:"מונה לדוגמה"}},meters:[{meter_id:"m",name:"מונה לדוגמה",coefficient:"1",start:{at:"2026-09-01T00:00:00Z",reading_kwh:"1000.00",kind:"reading"},end:{at:"2026-09-30T23:59:00Z",reading_kwh:"1776.20",kind:"reading"},consumption_kwh:"776.20",contribution_kwh:"776.20"}],lines:[{from:"2026-09-01",to:"2026-09-30",kwh:"776.20",price_entered:"0.5430",price_mode:"ex_vat",unit_price_ex_vat:"0.5430",amount_ex_vat:"421.48",vat_rate_percent:"18",vat_amount:"75.87",total:"497.35"}],totals:{currency:"ILS",kwh:"776.20",amount_ex_vat:"421.48",vat_amount:"75.87",total:"497.35",vat_breakdown:[{rate_percent:"18",base:"421.48",vat:"75.87"}],price_mode_note_he:null},notes:[],history:{current:null,previous:[],same_period_last_year:null},meta:{software_version:"",computed_at:""}}}let ct=class extends G{constructor(){super(...arguments),this.st="loading",this.s=null,this.biz={name:"",registration_no:"",address:"",phone:"",email:"",accent_color:"#2767ed",footer_note:""},this.terms={mode:"net_days",days:14,day_of_month:15},this.delay="6",this.errs={},this.busy=!1,this.error="",this.ok=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{this.apply(await b().getSettings()),this.st="ready"}catch(t){this.st=Te(t)?"forbidden":"error"}}apply(t){this.s=t,this.biz={...t.business},this.terms={...t.payment_terms},this.delay=String(t.auto.delay_hours)}validate(){const t={};return this.biz.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.biz.email)&&(t.email=s("כתובת דוא״ל לא תקינה")),rs.test(this.biz.accent_color)?ui(this.biz.accent_color)>.6&&(t.accent_color=s("הצבע בהיר מדי להדפסה")):t.accent_color=s("צבע לא תקין"),this.terms.mode==="net_days"&&!(Number.isInteger(this.terms.days)&&this.terms.days>=0&&this.terms.days<=120)&&(t.days=s("מספר הימים חייב להיות בין 0 ל-120")),this.terms.mode==="day_of_month"&&!(Number.isInteger(this.terms.day_of_month)&&this.terms.day_of_month>=1&&this.terms.day_of_month<=31)&&(t.day_of_month=s("היום בחודש חייב להיות בין 1 ל-31")),(!/^\d+$/.test(this.delay)||Number(this.delay)>72)&&(t.delay_hours=s("ההשהיה חייבת להיות בין 0 ל-72 שעות")),this.errs=t,!Object.keys(t).length}async save(){if(!(!this.s||this.busy||!this.validate())){this.busy=!0,this.error="",this.ok=!1;try{this.apply(await b().saveSettings(this.s.revision,{business:this.biz,payment_terms:this.terms,auto:{delay_hours:Number(this.delay)}})),this.ok=!0}catch(t){const e=jt(t);Object.keys(e).length?this.errs=e:this.error=M(t)}finally{this.busy=!1}}}async logo(t){if(t){if(this.error="",!/^image\/(png|jpeg)$/.test(t.type)||t.size>1024*1024){this.error=s("הלוגו חייב להיות PNG או JPEG עד 1MB.");return}try{await b().uploadLogo(t),this.apply(await b().getSettings())}catch(e){this.error=M(e)}}}async removeLogo(){try{await b().removeLogo(),this.apply(await b().getSettings())}catch(t){this.error=M(t)}}fld(t,e,a={}){const n=this.errs[t];return r`<div class="fld ${a.wide?"wide":""}"><label for="b-${t}">${e}</label>
      ${a.area?r`<textarea id="b-${t}" name=${t} .value=${this.biz[t]} @input=${i=>this.biz={...this.biz,[t]:i.target.value}}></textarea>`:r`<input id="b-${t}" name=${t} class="${a.ltr?"ltr":""} ${n?"err":""}" aria-invalid=${n?"true":"false"} .value=${this.biz[t]} @input=${i=>{this.biz={...this.biz,[t]:i.target.value},this.errs={...this.errs,[t]:""}}} />`}
      ${n?r`<div class="msg" role="alert" data-field-error=${t}>${n}</div>`:o}</div>`}render(){const t=R();if(!t.bills&&!t.manage)return r`<div class="page" data-elec="settings-business" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לפרטי העסק"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="settings-business" data-state="loading">${tt(4)}</div>`;if(this.st==="forbidden")return r`<div class="page" data-elec="settings-business" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לפרטי העסק"))}</div>`;if(this.st==="error"||!this.s)return r`<div class="page" data-elec="settings-business" data-state="error">${E("error","warning",s("לא ניתן לטעון את ההגדרות"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;const e=t.manage,a=this.s,n=a.logo?b().logoUrl(a.logo.sha256):"",i=Rs("accent","light",8),d=this.terms;return r`<div class="page" data-elec="settings-business" data-state="ready">
      <div class="cols side-l"><div class="card" style="min-inline-size:0"><fieldset style="border:0;margin:0;padding:0;min-inline-size:0" ?disabled=${!e}><div class="form">
        <div class="fld wide"><span class="lbl">${s("לוגו")}</span><div class="row">
          <div class="chip c-mut nodot" style="inline-size:96px;block-size:96px;padding:0;justify-content:center;border-radius:var(--sw-r-lg);overflow:hidden" data-logo>${n?r`<img src=${n} alt=${s("לוגו")} style="max-inline-size:100%;max-block-size:100%" />`:r`<span class="mut">${s("אין לוגו")}</span>`}</div>
          <div><label class="btn" style="cursor:pointer">${a.logo?s("החלפה"):s("העלאת לוגו")}<input type="file" accept="image/png,image/jpeg" data-logo-input style="position:absolute;inline-size:1px;block-size:1px;opacity:0" @change=${l=>void this.logo(l.target.files?.[0])} /></label>
            ${a.logo?r` <sw-button variant="ghost" data-logo-remove @click=${()=>void this.removeLogo()}>${s("הסרה")}</sw-button>`:o}<div class="mut" style="margin-block-start:6px">${s("PNG או JPEG, עד 1MB")}</div></div></div></div>
        ${this.fld("name",s("שם העסק"),{wide:!0})}${this.fld("registration_no",s("ח.פ. / ע.מ."),{ltr:!0})}${this.fld("phone",s("טלפון"),{ltr:!0})}${this.fld("address",s("כתובת"),{wide:!0})}${this.fld("email",s("דוא״ל"),{ltr:!0})}
        <div class="fld"><span class="lbl" id="acc">${s("צבע המותג")}</span><div class="row" role="group" aria-labelledby="acc" data-accent>
          ${i.map(l=>r`<button type="button" class="tok swatch" data-swatch=${l} aria-label=${s("צבע {c}",{c:l})} aria-pressed=${this.biz.accent_color.toLowerCase()===l} style="background:${l};border:2px solid ${this.biz.accent_color.toLowerCase()===l?"var(--sw-text)":"transparent"}" @click=${()=>this.biz={...this.biz,accent_color:l}}></button>`)}
          <input type="color" data-accent-color aria-label=${s("בחירה חופשית של צבע")} .value=${rs.test(this.biz.accent_color)?this.biz.accent_color:"#2767ed"} @input=${l=>this.biz={...this.biz,accent_color:l.target.value}} /></div>
          ${this.errs.accent_color?r`<div class="msg" role="alert" data-field-error="accent_color">${this.errs.accent_color}</div>`:o}</div>
        ${this.fld("footer_note",s("הערה קבועה בתחתית החיוב"),{wide:!0,area:!0})}
        <div class="fld wide"><span class="lbl">${s("מספור חיובים")}</span><div class="row" data-numbering style="padding:8px 12px;border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-sm)"><span class="num">${a.numbering.format}</span><span class="sp"></span><span class="mut">${s("שנה-חודש-מספר לקוח, למשל")} ${u("2026-12-0001")}</span></div></div>
        <div class="fld wide"><span class="lbl" id="pt">${s("תנאי תשלום")}</span><div class="row"><div class="seg" role="group" aria-labelledby="pt"><button type="button" data-terms="net_days" aria-pressed=${d.mode==="net_days"} @click=${()=>this.terms={...d,mode:"net_days"}}>${s("ימים מיום ההפקה")}</button><button type="button" data-terms="day_of_month" aria-pressed=${d.mode==="day_of_month"} @click=${()=>this.terms={...d,mode:"day_of_month"}}>${s("יום קבוע בחודש")}</button></div>
          ${d.mode==="net_days"?r`<div class="unit"><input class="ltr" data-days type="number" min="0" max="120" aria-label=${s("ימים לתשלום")} style="inline-size:90px" .value=${String(d.days)} @input=${l=>this.terms={...d,days:Number(l.target.value)}} /><span>${s("ימים")}</span></div>`:r`<div class="unit"><input class="ltr" data-day-of-month type="number" min="1" max="31" aria-label=${s("יום בחודש")} style="inline-size:90px" .value=${String(d.day_of_month)} @input=${l=>this.terms={...d,day_of_month:Number(l.target.value)}} /><span>${s("בחודש")}</span></div>`}</div>
          ${this.errs.days||this.errs.day_of_month?r`<div class="msg" role="alert" data-field-error="terms">${this.errs.days||this.errs.day_of_month}</div>`:o}</div>
        <div class="fld wide"><label for="dl">${s("יצירת טיוטה אוטומטית")}</label><div class="unit"><input id="dl" class="ltr ${this.errs.delay_hours?"err":""}" data-delay type="number" min="0" max="72" style="inline-size:90px" .value=${this.delay} @input=${l=>{this.delay=l.target.value,this.errs={...this.errs,delay_hours:""}}} /><span>${s("שעות אחרי סוף התקופה")}</span></div>${this.errs.delay_hours?r`<div class="msg" role="alert" data-field-error="delay_hours">${this.errs.delay_hours}</div>`:o}</div>
      </div></fieldset>
      ${this.error?C("err",this.error):o}${this.ok?C("ok",s("ההגדרות נשמרו")):o}
      ${e?r`<div class="row" style="margin-block-start:14px"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button></div>`:o}</div>
      <div class="card"><div class="hd"><b class="h3">${s("תצוגה מקדימה")}</b></div><div style="overflow:hidden;max-block-size:320px;border-radius:var(--sw-r-sm)" data-preview><elec-bill-paper .snapshot=${$i(this.biz,d,!!a.logo)} .logo=${n} hash=""></elec-bill-paper></div></div></div>
    </div>`}};O([c()],ct.prototype,"st",2);O([c()],ct.prototype,"s",2);O([c()],ct.prototype,"biz",2);O([c()],ct.prototype,"terms",2);O([c()],ct.prototype,"delay",2);O([c()],ct.prototype,"errs",2);O([c()],ct.prototype,"busy",2);O([c()],ct.prototype,"error",2);O([c()],ct.prototype,"ok",2);ct=O([T("elec-settings-business")],ct);var mi=Object.defineProperty,vi=Object.getOwnPropertyDescriptor,Ut=(t,e,a,n)=>{for(var i=n>1?void 0:n?vi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&mi(e,a,i),i};let pe=class extends G{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams}render(){const[t,e]=this.segments;return t?t==="new"?r`<elec-account-wizard></elec-account-wizard>`:e==="edit"?r`<elec-account-wizard .accountId=${t}></elec-account-wizard>`:r`<elec-account-page .accountId=${t} .tab=${e==="history"||e==="bills"?e:"status"}></elec-account-page>`:r`<elec-accounts-list></elec-accounts-list>`}};Ut([_({attribute:!1})],pe.prototype,"segments",2);Ut([_({attribute:!1})],pe.prototype,"params",2);pe=Ut([T("elec-accounts-page")],pe);let ue=class extends G{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams}render(){const[t]=this.segments;return t?r`<elec-bill-page .billId=${t}></elec-bill-page>`:r`<elec-bills-list></elec-bills-list>`}};Ut([_({attribute:!1})],ue.prototype,"segments",2);Ut([_({attribute:!1})],ue.prototype,"params",2);ue=Ut([T("elec-bills-page")],ue);var fi=Object.defineProperty,bi=Object.getOwnPropertyDescriptor,P=(t,e,a,n)=>{for(var i=n>1?void 0:n?bi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&fi(e,a,i),i};const gi=[{id:"kWh",label:s("קוט״ש")},{id:"Wh",label:s("וואט־שעה")},{id:"MWh",label:s("מגוואט־שעה")}],ws=et`
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
`;let At=class extends St{constructor(){super(...arguments),this.bubbleSkin=new Ft(this),this.log=null,this.canManage=!1,this.error=""}open(t){this.dispatchEvent(new CustomEvent("open-dialog",{detail:t}))}calLine(t){const e=t.calibration;return e.identity?r`<div class="cal" data-calibration="none">${s("ללא כיול: הקריאות כפי שהמונה מדווח")}</div>`:r`<div class="cal" data-calibration=${e.calibration_id??""}>${s("כיול מ-")}<span class="num">${Lt(e.effective_date)}</span> · ${s("מקדם")} <span class="num">${e.factor}</span>
      · ${s("הפרש")} <span class="num ltr">${Gt(e.offset_kwh)}</span> ${s("קוט״ש")}</div>`}reading(t){const e=t.deviation_kwh==null?s("אין ערך מערכת לזמן הזה"):r`${s("מהמערכת")} <span class="num ltr">${Gt(t.deviation_kwh)}</span>`;return r`<div class="li ${t.voided_at?"dis":""}" data-reading=${t.id??""}>
      <div class="grow">
        <div class="t1"><span class="num">${le(t.value_kwh)}</span> ${s("קוט״ש")} · <span class="num">${he(t.read_at)}</span></div>
        <div class="t2 wrap">${e}${t.created_by_name?` · ${t.created_by_name}`:""}${t.note?` · ${t.note}`:""}${t.voided_at?r` · <b>${s("בוטלה")}</b>${t.voided_by_name?` (${t.voided_by_name})`:""}`:""}</div>
      </div>
      <span class="chip nodot ${t.effect==="allocation"?"c-acc":"c-mut"}" data-effect=${t.effect_reason} title=${t.message}>${ai[t.effect_reason]}</span>
      ${this.canManage&&t.can_undo&&t.id?r`<sw-button size="sm" variant="ghost" data-reading-undo=${t.id} @click=${()=>this.open({kind:"undo-reading",id:t.id})}>${s("ביטול")}</sw-button>`:o}
    </div>`}calibration(t){return r`<div class="li ${t.voided_at?"dis":""}" data-cal=${t.id??""}>
      <div class="grow">
        <div class="t1">${s("מ-")}<span class="num">${Lt(t.effective_date)}</span> · ${s("מקדם")} <span class="num">${t.factor}</span> · ${s("הפרש")} <span class="num ltr">${Gt(t.offset_kwh)}</span></div>
        <div class="t2 wrap">${t.created_by_name??""}${t.note?` · ${t.note}`:""}${t.voided_at?r` · <b>${s("בוטל")}</b>`:""}</div>
      </div>
      ${t.in_force?r`<span class="chip nodot c-acc">${s("בתוקף")}</span>`:o}
      ${this.canManage&&t.can_undo&&t.id?r`<sw-button size="sm" variant="ghost" data-cal-undo=${t.id} @click=${()=>this.open({kind:"undo-calibration",id:t.id})}>${s("ביטול")}</sw-button>`:o}
    </div>`}render(){const t=this.log;return r`<div class="rd" data-readings>
      <div class="row"><h3>${s("קריאות ידניות וכיול")}</h3><span class="sp"></span>
        ${this.canManage&&t?r`<div class="acts"><sw-button size="sm" data-reading-add @click=${()=>this.open({kind:"reading"})}>${s("קריאה ידנית")}</sw-button>
              <sw-button size="sm" data-calibrate @click=${()=>this.open({kind:"calibrate"})}>${s("כיול")}</sw-button></div>`:o}</div>
      ${this.error?r`<div class="alert err" role="alert" data-readings-error>${this.error}</div>`:o}
      ${t?r`${this.calLine(t)}
            ${this.canManage&&t.suggestion?r`<div class="alert info sug" data-suggestion><div>${s("לפי שתי קריאות ההשוואה: מקדם")} <span class="num">${t.suggestion.factor}</span></div><span class="sp"></span>
                  <sw-button size="sm" data-suggestion-apply @click=${()=>this.open({kind:"calibrate",factor:t.suggestion.factor,anchor:t.suggestion.anchor_reading_id})}>${s("כיול לפי ההצעה")}</sw-button></div>`:o}
            ${t.items.length?r`<div class="list" data-reading-list>${t.items.map(e=>this.reading(e))}</div>`:r`<div class="mut" data-reading-empty>${s("אין קריאות ידניות")}</div>`}
            ${t.calibrations.length?r`<h4>${s("כיולים")}</h4><div class="list" data-cal-list>${t.calibrations.map(e=>this.calibration(e))}</div>`:o}`:this.error?o:r`<div class="skl" style="inline-size:60%"></div>`}
    </div>`}};At.styles=[gt,ws];P([_({attribute:!1})],At.prototype,"log",2);P([_({type:Boolean})],At.prototype,"canManage",2);P([_()],At.prototype,"error",2);At=P([T("elec-meter-readings")],At);let N=class extends St{constructor(){super(...arguments),this.bubbleSkin=new Ft(this),this.meterId="",this.log=null,this.kind="",this.targetId="",this.presetFactor="",this.presetAnchor="",this.when="",this.value="",this.unit="kWh",this.note="",this.preview=null,this.previewError="",this.error="",this.fieldErrors={},this.busy=!1,this.date="",this.mode="anchor",this.anchor="",this.factor="1",this.offset="0",this.reason="",this.timer=0,this.seq=0}willUpdate(t){t.has("kind")&&this.kind&&this.reset()}disconnectedCallback(){window.clearTimeout(this.timer),super.disconnectedCallback()}reset(){if(this.preview=null,this.previewError="",this.error="",this.fieldErrors={},this.busy=!1,this.reason="",this.note="",this.kind==="reading"&&(this.when=Se(new Date),this.value="",this.unit="kWh"),this.kind==="calibrate"){const t=Se(new Date).slice(0,10),e=this.log?.first_calibration_date??"";this.date=e&&e>t?e:t,this.factor=this.presetFactor||"1";const a=this.anchors();this.anchor=this.presetAnchor||a[0]?.id||"",this.mode=a.length?"anchor":"offset",this.offset="0",this.schedule()}}anchors(){return(this.log?.items??[]).filter(t=>!t.voided_at&&t.id&&(t.system_kwh!=null||t.effect==="allocation"))}close(){window.clearTimeout(this.timer),this.dispatchEvent(new CustomEvent("close"))}saved(t){this.dispatchEvent(new CustomEvent("saved",{detail:t}))}readingBody(t){const e={},a=si(this.when);a?Date.parse(a)>Date.now()+3e5&&(e.when=s("זמן הקריאה בעתיד")):e.when=s("צריך לבחור תאריך ושעה");const n=oe(this.value);return n==null&&(e.value=s("צריך להזין מספר תקין")),t||(this.fieldErrors=e),Object.keys(e).length||!a||n==null?null:{read_at:a,value:n,unit:this.unit,...this.note.trim()?{note:this.note.trim()}:{},dry_run:t}}calibrationBody(t){const e={};/^\d{4}-\d{2}-\d{2}$/.test(this.date)||(e.date=s("צריך לבחור תאריך"));const a=ei(this.factor);a==null&&(e.factor=s("מקדם בין 0.5 ל-2"));let n="0";if(this.mode==="offset"){const i=this.offset.trim().replace(",",".");n=/^[-−]?\d+(\.\d+)?$/.test(i)?i.replace("−","-"):null,n==null&&(e.offset=s("צריך להזין מספר תקין"))}else this.anchor||(e.anchor=s("צריך לבחור קריאה"));return t||(this.fieldErrors=e),Object.keys(e).length||a==null?null:{effective_date:this.date,factor:a,...this.mode==="anchor"?{anchor_reading_id:this.anchor}:{offset_kwh:n??"0"},...this.note.trim()?{note:this.note.trim()}:{},dry_run:t}}schedule(){window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.runPreview(),350)}async runPreview(){const t=++this.seq;try{if(this.kind==="reading"){const e=this.readingBody(!0);if(!e)return this.preview=null,void(this.previewError="");const a=await Ie(this.meterId,e);t===this.seq&&(this.preview=a.reading,this.previewError="")}else if(this.kind==="calibrate"){const e=this.calibrationBody(!0);if(!e)return this.preview=null,void(this.previewError="");const a=await Je(this.meterId,e);t===this.seq&&(this.preview=a.calibration,this.previewError="")}}catch(e){t===this.seq&&(this.preview=null,this.previewError=lt(e))}}async save(){if(this.busy)return;const t=this.kind==="reading"?this.readingBody(!1):this.calibrationBody(!1);if(t){this.busy=!0,this.error="";try{const e=this.kind==="reading"?await Ie(this.meterId,t):await Je(this.meterId,t);e.log&&this.saved(e.log),this.close()}catch(e){this.error=lt(e);const a=e instanceof Qt?e.body.details?.fields??[]:[];a.length&&(this.fieldErrors=Object.fromEntries(a.map(n=>[n==="read_at"?"when":n==="effective_date"?"date":n==="offset_kwh"?"offset":n==="anchor_reading_id"?"anchor":n," "])))}finally{this.busy=!1}}}async undo(){if(!this.busy){this.busy=!0,this.error="";try{const t=this.kind==="undo-reading"?await Ja(this.meterId,this.targetId,this.reason.trim()||void 0):await ti(this.meterId,this.targetId,this.reason.trim()||void 0);this.saved(t),this.close()}catch(t){this.error=lt(t)}finally{this.busy=!1}}}fieldMsg(t){const e=this.fieldErrors[t];return e&&e.trim()?r`<div class="msg" role="alert" data-field-error=${t}>${e}</div>`:o}readingPreview(){const t=this.preview;return this.previewError?r`<div class="alert warn" role="status" data-reading-preview="error">${this.previewError}</div>`:t?r`<div class="pv" data-reading-preview=${t.effect_reason}>
      <dl class="kv">
        <dt>${s("המערכת באותו זמן")}</dt><dd>${t.system_kwh==null?s("אין ערך"):r`<span class="num">${le(t.system_kwh)}</span> ${s("קוט״ש")}`}</dd>
        ${t.deviation_kwh==null?o:r`<dt>${s("הפרש")}</dt><dd><span class="num ltr">${Gt(t.deviation_kwh)}</span> ${s("קוט״ש")}</dd>`}
      </dl>
      <div data-preview-message>${t.message}</div>
    </div>`:o}renderReading(){const t=(e,a)=>{this[e]=a,e!=="note"&&(this.fieldErrors={...this.fieldErrors,[e]:""},this.schedule())};return r`<sw-dialog open heading=${s("קריאה ידנית")} data-reading-dialog @close=${e=>{e.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="fld"><label for="rw">${s("תאריך ושעה")}</label>
          <div class="inp ${this.fieldErrors.when?"err":""}"><input id="rw" type="datetime-local" lang=${ot()} data-reading-when max=${Se(new Date)} .value=${this.when} @input=${e=>t("when",e.target.value)} /></div>
          ${this.fieldMsg("when")}</div>
        <div class="fld"><label for="rv">${s("קריאת המונה")}</label>
          <div class="inp ${this.fieldErrors.value?"err":""}"><input id="rv" data-reading-value inputmode="decimal" autocomplete="off" dir="ltr" .value=${this.value} @input=${e=>t("value",e.target.value)} />
            <select data-reading-unit aria-label=${s("יחידה")} @change=${e=>{this.unit=e.target.value,this.schedule()}}>
              ${gi.map(e=>r`<option value=${e.id} ?selected=${e.id===this.unit}>${e.label}</option>`)}</select></div>
          ${this.fieldMsg("value")}</div>
        <div class="fld wide"><label for="rn">${s("הערה (לא חובה)")}</label><div class="inp"><input id="rn" data-reading-note maxlength="500" .value=${this.note} @input=${e=>t("note",e.target.value)} /></div></div>
        <div class="wide">${this.readingPreview()}</div>
        ${this.error?r`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:o}
      </div>
      <sw-button slot="footer" variant="primary" data-reading-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
    </sw-dialog>`}renderCalibrate(){const t=this.anchors(),e=this.preview,a=this.log?.first_calibration_date??"",n=(i,d)=>{this[i]=d,this.fieldErrors={...this.fieldErrors,[i]:""},this.schedule()};return r`<sw-dialog open heading=${s("כיול מונה")} data-calibrate-dialog @close=${i=>{i.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="hint wide">${s("מהתאריך: קריאה פיזית = מקדם × מונה המערכת + הפרש. חיובים שהופקו לא משתנים.")}</div>
        <div class="fld"><label for="cd">${s("בתוקף מ-")}</label>
          <div class="inp ${this.fieldErrors.date?"err":""}"><input id="cd" type="date" lang=${ot()} data-cal-date min=${a} .value=${this.date} @input=${i=>n("date",i.target.value)} /></div>
          ${this.fieldMsg("date")}</div>
        <div class="fld"><label for="cf">${s("מקדם")}</label>
          <div class="inp ${this.fieldErrors.factor?"err":""}"><input id="cf" data-cal-factor inputmode="decimal" dir="ltr" .value=${this.factor} @input=${i=>n("factor",i.target.value)} /></div>
          ${this.fieldMsg("factor")}</div>
        <div class="fld wide"><span class="lbl">${s("הפרש")}</span>
          <div class="seg" role="group" aria-label=${s("הפרש")}>
            <button type="button" data-cal-mode="anchor" aria-pressed=${this.mode==="anchor"?"true":"false"} ?disabled=${!t.length} @click=${()=>{this.mode="anchor",this.schedule()}}>${s("לפי קריאה ידנית")}</button>
            <button type="button" data-cal-mode="offset" aria-pressed=${this.mode==="offset"?"true":"false"} @click=${()=>{this.mode="offset",this.schedule()}}>${s("הזנה ידנית")}</button></div></div>
        ${this.mode==="anchor"?r`<div class="fld wide"><label for="ca">${s("קריאה")}</label>
              <div class="inp ${this.fieldErrors.anchor?"err":""}"><select id="ca" data-cal-anchor @change=${i=>n("anchor",i.target.value)}>
                ${t.map(i=>r`<option value=${i.id} ?selected=${i.id===this.anchor}>${he(i.read_at)} · ${le(i.value_kwh)} ${s("קוט״ש")}</option>`)}</select></div>
              ${this.fieldMsg("anchor")}</div>`:r`<div class="fld wide"><label for="co">${s("הפרש (קוט״ש)")}</label>
              <div class="inp ${this.fieldErrors.offset?"err":""}"><input id="co" data-cal-offset inputmode="decimal" dir="ltr" .value=${this.offset} @input=${i=>n("offset",i.target.value)} /></div>
              ${this.fieldMsg("offset")}</div>`}
        <div class="fld wide"><label for="cn">${s("הערה (לא חובה)")}</label><div class="inp"><input id="cn" data-cal-note maxlength="500" .value=${this.note} @input=${i=>this.note=i.target.value} /></div></div>
        ${this.previewError?r`<div class="alert warn wide" role="status" data-cal-preview="error">${this.previewError}</div>`:e?r`<div class="pv wide" data-cal-preview><div>${s("מ-")}<span class="num">${Lt(e.effective_date)}</span>: ${s("מקדם")} <span class="num">${e.factor}</span>, ${s("הפרש")} <span class="num ltr">${Gt(e.offset_kwh)}</span> ${s("קוט״ש")}</div></div>`:o}
        ${this.error?r`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:o}
      </div>
      <sw-button slot="footer" variant="primary" data-cal-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
    </sw-dialog>`}renderUndo(){const t=this.kind==="undo-reading",e=t?this.log?.items.find(i=>i.id===this.targetId):void 0,a=t?void 0:this.log?.calibrations.find(i=>i.id===this.targetId),n=e?r`${s("הקריאה")} <span class="num">${le(e.value_kwh)}</span> ${s("קוט״ש מ-")}<span class="num">${he(e.read_at)}</span>`:a?r`${s("הכיול מ-")}<span class="num">${Lt(a.effective_date)}</span>`:"";return r`<sw-dialog open heading=${t?s("ביטול קריאה ידנית"):s("ביטול כיול")} data-undo-dialog @close=${i=>{i.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="wide">${n} ${s("תבוטל ותישאר ברשימה כמבוטלת.")}</div>
        <div class="fld wide"><label for="ur">${s("סיבה (לא חובה)")}</label><div class="inp"><input id="ur" data-undo-reason maxlength="300" .value=${this.reason} @input=${i=>this.reason=i.target.value} /></div></div>
        ${this.error?r`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:o}
      </div>
      <sw-button slot="footer" variant="danger" data-undo-confirm ?disabled=${this.busy} @click=${()=>void this.undo()}>${t?s("ביטול הקריאה"):s("ביטול הכיול")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>${s("חזרה")}</sw-button>
    </sw-dialog>`}render(){return this.kind==="reading"?this.renderReading():this.kind==="calibrate"?this.renderCalibrate():this.kind==="undo-reading"||this.kind==="undo-calibration"?this.renderUndo():o}};N.styles=[gt,ws,et`
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
    `];P([_()],N.prototype,"meterId",2);P([_({attribute:!1})],N.prototype,"log",2);P([_()],N.prototype,"kind",2);P([_()],N.prototype,"targetId",2);P([_()],N.prototype,"presetFactor",2);P([_()],N.prototype,"presetAnchor",2);P([c()],N.prototype,"when",2);P([c()],N.prototype,"value",2);P([c()],N.prototype,"unit",2);P([c()],N.prototype,"note",2);P([c()],N.prototype,"preview",2);P([c()],N.prototype,"previewError",2);P([c()],N.prototype,"error",2);P([c()],N.prototype,"fieldErrors",2);P([c()],N.prototype,"busy",2);P([c()],N.prototype,"date",2);P([c()],N.prototype,"mode",2);P([c()],N.prototype,"anchor",2);P([c()],N.prototype,"factor",2);P([c()],N.prototype,"offset",2);P([c()],N.prototype,"reason",2);N=P([T("elec-reading-dialogs")],N);var yi=Object.defineProperty,wi=Object.getOwnPropertyDescriptor,it=(t,e,a,n)=>{for(var i=n>1?void 0:n?wi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&yi(e,a,i),i};const _s={reporting:s("מדווח"),stale:s("לא מדווח"),paused:s("מושהה")},ks={reporting:"c-ok",stale:"c-warn",paused:"c-mut"},ls={hours:s("24 שעות"),days:s("30 ימים"),months:s("12 חודשים")},_i={install:s("התקנה"),reset:s("איפוס"),replace:s("החלפת מונה"),source_change:s("שינוי מקור")};function ki(t,e){if(!t.length)return r`<div class="mut">${s("אין נתונים לתקופה")}</div>`;const d=Math.max(...t.map(m=>m.value),1)*1.15,l=588/t.length,h=Math.min(l*.64,24),v=Math.ceil(t.length/12),p=t.reduce((m,$,y)=>$.value>t[m].value?y:m,0);return r`<svg class="chart" viewBox="0 0 ${640} ${170}" role="img" aria-label=${e} data-chart>
    ${rt`<line x1=${26} x2=${614} y1=${148} y2=${148} class="grid" />`}
    ${t.map((m,$)=>{const y=Math.max(m.value>0?2:0,m.value/d*126),L=614-($+1)*l+(l-h)/2,ft=$===t.length-1;return rt`<rect class=${ft?"bar hi":"bar"} x=${L} y=${148-y} width=${h} height=${y} rx="3"><title>${m.label}: ${nt(m.value)}</title></rect>
        ${$%v===0||ft?rt`<text x=${L+h/2} y=${164} text-anchor="middle">${m.label}</text>`:o}
        ${ft||$===p?rt`<text x=${L+h/2} y=${143-y} text-anchor="middle" class="val">${Math.round(m.value)}</text>`:o}`})}
  </svg>`}let H=class extends fa{constructor(){super("days"),this.points=[],this.log=null,this.logError="",this.dlgDetail=null,this.newName="",this.otherNames=[],this.nameError="",this.finalReading="",this.startReading="0",this.note="",this.replaceError=""}fetchDetail(){return js(this.meterId)}beforeLoad(){this.log?.meter_id!==this.meterId&&(this.log=null)}afterLoad(){this.loadSeries(),this.loadLog()}async fetchSeries(t,e,a,n){let i=await Ls(this.meterId,e,a,n);return t==="months"&&(i=xi(i)),()=>{this.points=i}}titles(t){return{heading:dt(t).primary,subheading:dt(t).secondary}}texts(){return{loadError:s("לא ניתן לטעון את המונה"),retry:s("נסה שוב")}}async loadLog(){const t=this.meterId;try{const e=await Qa(t);if(t!==this.meterId)return;this.log=e,this.logError=""}catch(e){t===this.meterId&&(this.logError=lt(e))}}openReadingsDialog(t){this.dlgDetail=t.detail,this.dlg=t.detail.kind}async onReadingsSaved(t){this.log=t.detail,this.fire("changed"),await this.refresh(),this.loadSeries()}label(t){const e=new Date(t.t);return this.range==="hours"?vs(t.t).slice(0,2):this.range==="months"?`${e.getMonth()+1}/${String(e.getFullYear()).slice(2)}`:String(e.getDate())}async toggleStatus(){const t=this.detail;if(!(!t||this.busy)){this.busy=!0,this.actionError="";try{await(t.status==="paused"?Bs(t):As(t)),this.fire("changed"),await this.load()}catch(e){this.actionError=lt(e)}finally{this.busy=!1}}}async confirmRemove(){const t=this.detail;if(!(!t||this.busy)){this.busy=!0,this.actionError="";try{await Fs(t),this.dlg="",this.fire("changed"),this.fire("close")}catch(e){this.actionError=lt(e)}finally{this.busy=!1}}}openRename(){const t=this.detail;t&&(this.newName=t.name,this.nameError="",this.otherNames=[],this.dlg="rename",this.updateComplete.then(()=>window.setTimeout(()=>{const e=this.renderRoot.querySelector("[data-rename-input]");e?.focus(),e?.select()},80)),Me().then(e=>this.otherNames=e.filter(a=>a.id!==t.id).map(a=>a.name)).catch(()=>{}))}async rename(){const t=this.detail;if(!t||this.busy)return;const e=de(this.newName,this.otherNames);if(e.name&&e.name.toLocaleLowerCase()===t.name.trim().toLocaleLowerCase()&&e.name===t.name)return void(this.dlg="");if(e.error)return void(this.nameError=e.error);this.busy=!0,this.nameError="";try{await Vs(t,e.name),this.dlg="",this.fire("changed"),await this.refresh()}catch(a){a instanceof Qt&&a.code==="revision_conflict"?(this.nameError=s("מישהו אחר שינה את המונה בינתיים. הנתונים רועננו, בדקו את השם ושמרו שוב."),await this.refresh()):this.nameError=lt(a)}finally{this.busy=!1}}openReplace(){this.finalReading=this.detail?.reading_kwh!=null?String(this.detail.reading_kwh):"",this.startReading="0",this.note="",this.replaceError="",this.dlg="replace"}async replace(){const t=this.detail,e=Number(this.finalReading),a=Number(this.startReading);if(!(!t||this.busy)){if(this.finalReading.trim()===""||!Number.isFinite(e)||e<0)return void(this.replaceError=s("צריך להזין קריאה סופית תקינה"));if(this.startReading.trim()===""||!Number.isFinite(a)||a<0)return void(this.replaceError=s("צריך להזין קריאת התחלה תקינה"));this.busy=!0,this.replaceError="";try{this.detail=await qs(t,{final_reading_kwh:e,start_reading_kwh:a,note:this.note.trim()||void 0}),this.dlg="",this.fire("changed")}catch(n){this.replaceError=lt(n)}finally{this.busy=!1}}}renderBody(t){const e=this.points.map(a=>({label:this.label(a),value:a.kwh}));return r`<div class="body" data-meter-card=${t.id}>
      <div class="row"><span class="chip ${ks[t.status]}" data-meter-status=${t.status}>${_s[t.status]}</span></div>
      <dl class="kv">
        <dt>${s("אזור")}</dt><dd>${t.area_name??"-"}${t.floor_name?` · ${t.floor_name}`:""}</dd>
        <dt>${s("קריאה נוכחית")}</dt><dd><span class="num">${nt(t.reading_kwh)}</span> <span class="mut">${s("קוט״ש")}</span></dd>
        <dt>${s("דיווח אחרון")}</dt><dd><span class="num">${he(t.last_report_at)}</span></dd>
        <dt>${s("יחידה")}</dt><dd>${s("קוט״ש")} · ${s("מונה מצטבר")}</dd>
        <dt>${s("בחשבונות")}</dt><dd>${t.accounts.length?t.accounts.join(", "):r`<span class="mut">-</span>`}</dd>
      </dl>
      <div class="row"><h3>${s("צריכה")}</h3><span class="sp"></span>
        ${this.rangeSeg(s("טווח"),a=>ls[a])}</div>
      ${this.chartError?r`<div class="alert err" role="alert">${s("לא ניתן לטעון את גרף הצריכה")}</div>`:ki(e,s("גרף צריכה, {range}",{range:ls[this.range]}))}
      <h3>${s("תקופות מונה")}</h3>
      <div class="list" data-epochs>${t.epochs.map(a=>r`<div class="li"><div class="grow"><div class="t1">${_i[a.reason]??a.reason} · <span class="num">${Lt(a.started_at)}</span></div>
        <div class="t2 wrap">${s("קריאת התחלה")} <span class="num">${nt(a.start_reading_kwh)}</span>${a.ended_at?r` · ${s("עד")} <span class="num">${Lt(a.ended_at)}</span>`:""}${a.note?` · ${a.note}`:""}</div></div>${a.ended_at?o:r`<span class="chip acc nodot">${s("פעיל")}</span>`}</div>`)}</div>
      <elec-meter-readings .log=${this.log} error=${this.logError} ?canManage=${this.canManage} @open-dialog=${a=>this.openReadingsDialog(a)}></elec-meter-readings>
      ${this.actionError?r`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>`:o}
      ${this.canManage?this.actionsRow({rename:s("שינוי שם"),replace:s("החלפת מונה"),pause:t.status==="paused"?s("חידוש"):s("השהיה"),remove:s("הסרה"),pauseDisabled:this.busy,onRename:()=>this.openRename(),onReplace:()=>this.openReplace(),onPause:()=>void this.toggleStatus(),onRemove:()=>{this.actionError="",this.dlg="remove"}}):o}
    </div>`}renderDialogs(){return r`
      <sw-dialog ?open=${this.dlg==="remove"} heading=${s("הסרת המונה")} data-meter-remove-dialog @close=${()=>this.dlg=""}>
        <div>${s("המונה יוסר מהרשימה. הנתונים שנאספו יישמרו.")}</div>
        ${this.actionError&&this.dlg==="remove"?r`<div class="alert err" role="alert">${this.actionError}</div>`:o}
        <sw-button slot="footer" variant="danger" data-meter-remove-confirm ?disabled=${this.busy} @click=${()=>void this.confirmRemove()}>${s("הסרה")}</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>${s("ביטול")}</sw-button>
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="rename"} heading=${s("שינוי שם המונה")} data-meter-rename-dialog @close=${()=>this.dlg=""}>
        ${(()=>{const t=de(this.newName,this.otherNames);return t.name===this.detail?.name&&(t.duplicate=!1),r`<div class="fld">
            <label for="rn">${s("שם המונה")}</label>
            <div class="inp ${this.nameError?"err":""}"><input id="rn" data-rename-input autocomplete="off" aria-invalid=${this.nameError?"true":"false"} aria-describedby="rn-msg" .value=${this.newName}
              @input=${a=>{this.newName=a.target.value,this.nameError=""}}
              @keydown=${a=>{a.key==="Enter"&&(a.preventDefault(),this.rename())}} /></div>
            <div id="rn-msg">
              ${this.nameError?r`<div class="msg" role="alert" data-rename-error>${this.nameError}</div>`:o}
              ${!this.nameError&&t.duplicate?r`<div class="msg" role="alert" data-rename-dup>${gs}</div>`:o}
              <div class="mut" data-rename-hint>${La}</div>
            </div>
          </div>`})()}
        <sw-button slot="footer" variant="primary" data-rename-save ?disabled=${this.busy||de(this.newName,this.otherNames).duplicate&&this.newName.trim()!==this.detail?.name} @click=${()=>void this.rename()}>${s("שמירה")}</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>${s("ביטול")}</sw-button>
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="replace"} heading=${s("החלפת מונה")} data-meter-replace-dialog @close=${()=>this.dlg=""}>
        <div class="form">
          <div class="fld"><label for="fr">${s("קריאה סופית של המונה הישן")}</label><div class="inp ${this.replaceError&&!this.finalReading?"err":""}"><input id="fr" data-replace-final inputmode="decimal" .value=${this.finalReading} @input=${t=>this.finalReading=t.target.value} /><span class="mut">${s("קוט״ש")}</span></div></div>
          <div class="fld"><label for="sr">${s("קריאת התחלה של המונה החדש")}</label><div class="inp"><input id="sr" data-replace-start inputmode="decimal" .value=${this.startReading} @input=${t=>this.startReading=t.target.value} /><span class="mut">${s("קוט״ש")}</span></div></div>
          <div class="fld wide"><label for="nt">${s("הערה (לא חובה)")}</label><div class="inp"><input id="nt" data-replace-note .value=${this.note} @input=${t=>this.note=t.target.value} /></div></div>
          ${this.replaceError?r`<div class="alert err wide" role="alert" data-replace-error>${this.replaceError}</div>`:o}
        </div>
        <sw-button slot="footer" variant="primary" data-replace-save ?disabled=${this.busy} @click=${()=>void this.replace()}>${s("החלפה")}</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>${s("ביטול")}</sw-button>
      </sw-dialog>
      ${this.dlg==="reading"||this.dlg==="calibrate"||this.dlg==="undo-reading"||this.dlg==="undo-calibration"?r`<elec-reading-dialogs .meterId=${this.meterId} .log=${this.log} .kind=${this.dlg} .targetId=${this.dlgDetail?.id??""} .presetFactor=${this.dlgDetail?.factor??""}
            .presetAnchor=${this.dlgDetail?.anchor??""} @close=${()=>{this.dlg="",this.dlgDetail=null}} @saved=${t=>void this.onReadingsSaved(t)}></elec-reading-dialogs>`:o}`}};H.styles=[gt,va,et`
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
    `];it([c()],H.prototype,"points",2);it([c()],H.prototype,"log",2);it([c()],H.prototype,"logError",2);it([c()],H.prototype,"dlgDetail",2);it([c()],H.prototype,"newName",2);it([c()],H.prototype,"otherNames",2);it([c()],H.prototype,"nameError",2);it([c()],H.prototype,"finalReading",2);it([c()],H.prototype,"startReading",2);it([c()],H.prototype,"note",2);it([c()],H.prototype,"replaceError",2);H=it([T("elec-meter-card")],H);function xi(t){const e=new Map;for(const a of t){const n=new Date(a.t),i=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01T00:00:00Z`;e.set(i,(e.get(i)??0)+a.kwh)}return[...e.entries()].map(([a,n])=>({t:a,kwh:Math.round(n*100)/100}))}var Ei=Object.defineProperty,Ci=Object.getOwnPropertyDescriptor,Wt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ci(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ei(e,a,i),i};const Si={search:f("חיפוש מונה"),view:f("תצוגה"),cards:f("כרטיסים"),table:f("טבלה"),area:f("אזור"),areas:f("אזורים"),allAreas:f("כל האזורים"),fold:f("כיווץ"),unfold:f("הרחבה"),addMeter:f("הוספת מונה"),loadError:f("לא ניתן לטעון את המונים"),retry:f("נסה שוב")};let Ct=class extends ya{constructor(){super({viewKey:"sw.elec.meters.view",collapseKey:"sw.elec.meters.collapsed",route:"/infra/electricity/meters",access:R,onAccess:hs}),this.picked=[],this.pickedNames={},this.nameTouched=!1,this.adding=!1,this.addErrors=[],this.noticeTimer=0}disconnectedCallback(){window.clearTimeout(this.noticeTimer),super.disconnectedCallback()}texts(){return Si}fetchMeters(){return Me()}areaTree(){return Ks(this.meters)}inArea(t,e){const a=e.startsWith("floor:")?e.slice(6):"";return a?(t.floor_id??t.floor_name??"_none")===a:t.area_id===e}matchesSearch(t,e){return bs(t).includes(e)||(t.area_name??"").toLowerCase().includes(e)}flash(t){this.notice=t,window.clearTimeout(this.noticeTimer),this.noticeTimer=window.setTimeout(()=>this.notice="",6e3)}openAdd(){this.picked=[],this.pickedNames={},this.nameTouched=!1,this.addErrors=[],this.setParams({add:"1",meter:null})}closeAdd(){this.setParams({add:null})}onPick(t){this.picked=t.detail.selected;const e={};for(const a of this.picked)e[a]=this.pickedNames[a]??t.detail.names?.[a]??"";this.pickedNames=e}nameChecks(){return this.picked.map(t=>{const e=[...this.meters.map(a=>a.name),...this.picked.filter(a=>a!==t).map(a=>this.pickedNames[a]??"")];return{id:t,...de(this.pickedNames[t]??"",e)}})}async confirmAdd(){if(!this.picked.length||this.adding)return;this.nameTouched=!0;const t=this.nameChecks();if(t.some(a=>a.error))return;this.adding=!0,this.addErrors=[];const e=await Us(t.map(a=>({entity_id:a.id,name:a.name})));this.adding=!1,e.added.length&&(await this.load(!1),this.flash(e.added.length===1?f("המונה נוסף"):f("{n} מונים נוספו",{n:e.added.length}))),e.failed.length?(this.addErrors=e.failed.map(a=>a.message),this.picked=e.failed.map(a=>a.entity_id)):(this.picked=[],this.closeAdd())}statusChip(t){return r`<span class="chip ${ks[t.status]}" data-status=${t.status}>${_s[t.status]}</span>`}staleNote(t){return t.status==="stale"&&t.last_report_at?r` <span class="mut">${f("מ-")}<span class="num">${vs(t.last_report_at)}</span></span>`:o}openMeter(t){this.setParams({meter:t.id})}renderTiles(){const t=Ws(this.meters);return r`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${f("היום")}</div><div class="v"><span class="num">${Ge(t.today_kwh)}</span><span class="u">${f("קוט״ש")}</span></div></div>
      <div class="tile"><div class="k">${f("מתחילת החודש")}</div><div class="v"><span class="num" data-month>${this.meters.some(e=>e.month_kwh!=null)?Ge(t.month_kwh):"-"}</span><span class="u">${f("קוט״ש")}</span></div></div>
      <div class="tile"><div class="k">${f("מדווחים")}</div><div class="v"><span class="num" data-count="reporting">${t.reporting}</span><span class="u">${f("מתוך {n}",{n:t.total})}</span></div></div>
      <div class="tile" ?data-warn=${t.stale>0}><div class="k">${f("לא מדווחים")}</div><div class="v" style=${t.stale?"color:var(--sw-warning-text)":""}><span class="num" data-count="stale">${t.stale}</span></div></div>
    </div>`}entityLine(t,e){const a=dt(t).secondary;return a?r`<div class="${e} ent" data-meter-entity title=${f("שם הישות")}>${a}</div>`:o}nameOf(t){return r`${dt(t).primary}${this.entityLine(t,"mut")}`}renderTable(t){const e=t.some(a=>a.accounts_count!=null);return r`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>${f("שם")}</th><th>${f("אזור")}</th><th class="n">${f("קריאה נוכחית (קוט״ש)")}</th><th class="n">${f("היום")}</th><th class="n">${f("מתחילת החודש")}</th><th>${f("מצב")}</th>${e?r`<th class="dsk">${f("בחשבונות")}</th>`:o}</tr></thead>
      <tbody>${t.map(a=>r`<tr class="pick" tabindex="0" data-meter=${a.id} @click=${()=>this.openMeter(a)} @keydown=${n=>this.onKey(n,a)}>
        <td class="b">${this.nameOf(a)}</td><td>${a.area_name??"-"}<span class="mut dsk"> · ${a.floor_name??""}</span></td>
        <td class="n"><span class="num">${nt(a.reading_kwh)}</span></td><td class="n"><span class="num">${nt(a.today_kwh)}</span></td><td class="n"><span class="num">${nt(a.month_kwh)}</span></td>
        <td>${this.statusChip(a)}${this.staleNote(a)}</td>${e?r`<td class="dsk">${a.accounts_count||r`<span class="mut">-</span>`}</td>`:o}</tr>`)}</tbody></table></div>`}renderCards(t){return r`<div class="cards desk-only" data-meters-cards>${t.map(e=>r`<div class="card mcard" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="row"><b>${dt(e).primary}</b><span class="sp"></span>${this.statusChip(e)}</div>
      ${this.entityLine(e,"mut")}
      <div class="mut">${e.area_name??""}${e.floor_name?` · ${e.floor_name}`:""}</div>
      <div class="row" style="align-items:baseline"><span class="big num">${nt(e.today_kwh)}</span><span class="mut">${f("קוט״ש היום")}</span><span class="sp"></span><span class="mut num">${nt(e.reading_kwh)}</span></div></div>`)}</div>`}renderRows(t){return r`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${t.map(e=>r`<div class="li pick" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="grow"><div class="t1">${dt(e).primary}</div>${this.entityLine(e,"t2")}<div class="t2">${e.area_name??""} · ${f("היום")} <span class="num">${nt(e.today_kwh)}</span> ${f("קוט״ש")}</div></div>
      <div style="text-align:end">${this.statusChip(e)}<div class="t2 num" style="margin-block-start:4px">${nt(e.reading_kwh)}</div></div></div>`)}</div>`}renderNames(){return r`<div class="names" data-add-names>
      ${this.nameChecks().map((t,e)=>{const a=t.error&&(this.nameTouched||t.duplicate);return r`<div class="fld">
          <label for="mn${e}">${this.picked.length>1?f("שם המונה {n}",{n:e+1}):f("שם המונה")}</label>
          <div class="inp ${a?"err":""}"><input id="mn${e}" data-add-name=${t.id} autocomplete="off" aria-invalid=${a?"true":"false"} .value=${this.pickedNames[t.id]??""}
            @input=${n=>this.pickedNames={...this.pickedNames,[t.id]:n.target.value}} /></div>
          ${a?r`<div class="msg" role="alert" data-add-name-error>${t.error}</div>`:o}
        </div>`})}
    </div>`}renderAdd(){const t=this.params.get("add")==="1"&&this.access.manage;return r`<sw-dialog ?open=${t} wide heading=${f("הוספת מונה")} data-add-dialog @close=${()=>this.closeAdd()}>
      ${t?r`<elec-meter-picker mode="register" multi .selected=${this.picked} @change=${e=>this.onPick(e)}></elec-meter-picker>`:o}
      ${t&&this.picked.length?this.renderNames():o}
      ${this.addErrors.length?r`<div class="errs" data-add-errors>${this.addErrors.map(e=>r`<div class="alert err" role="alert">${e}</div>`)}</div>`:o}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked.length||this.adding||this.nameChecks().some(e=>e.duplicate)} @click=${()=>void this.confirmAdd()}>${f("הוספה")}${this.picked.length>1?` (${this.picked.length})`:""}</sw-button>
      <sw-button slot="footer" data-add-cancel @click=${()=>this.closeAdd()}>${f("ביטול")}</sw-button>
    </sw-dialog>`}frame(t,e){return r`<div data-elec="meters" data-state=${t} aria-busy=${t==="loading"?"true":o} style=${t==="ready"?"display:flex;flex-direction:column;gap:14px":o}>${e}</div>`}renderForbidden(){return r`<sw-state-panel state="forbidden" data-elec="meters" data-state="forbidden"></sw-state-panel>`}skeletonRow(t){return r`<div class="row" style="padding:10px 0">${t}</div>`}renderEmpty(t){return r`<sw-state-panel icon="bolt" state="empty" heading=${f("אין מונים עדיין")}>${t}</sw-state-panel>`}renderNoResults(){return r`<sw-state-panel icon="bolt" state="empty" compact heading=${f("לא נמצאו מונים")} data-no-results></sw-state-panel>`}renderCard(t){return r`<elec-meter-card .meterId=${t} ?canManage=${this.access.manage} @close=${()=>this.setParams({meter:null})} @changed=${()=>void this.load(!1)}></elec-meter-card>`}};Ct.styles=[gt,ba,et`
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
    `,ga,et`
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
    `,cs];Wt([c()],Ct.prototype,"picked",2);Wt([c()],Ct.prototype,"pickedNames",2);Wt([c()],Ct.prototype,"nameTouched",2);Wt([c()],Ct.prototype,"adding",2);Wt([c()],Ct.prototype,"addErrors",2);Ct=Wt([T("elec-meters-page")],Ct);var Oi=Object.defineProperty,Pi=Object.getOwnPropertyDescriptor,yt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Pi(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Oi(e,a,i),i};const ds=[{id:"holiday",label:s("חג (כמו שבת)")},{id:"holiday_eve",label:s("ערב חג (כמו שישי)")},{id:"regular",label:s("יום רגיל")}],os=t=>ms[$s[new Date(`${t}T12:00:00Z`).getUTCDay()]];let mt=class extends G{constructor(){super(...arguments),this.st="loading",this.year=Number(J().slice(0,4)),this.data=null,this.busy=!1,this.error="",this.note="",this.add={date:"",kind:"holiday",name:""},this.addErr=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{this.data=await b().getCalendar(this.year),this.st="ready"}catch(t){this.error=M(t),this.st=Te(t)?"forbidden":"error"}}setYear(t){this.year=t,this.note="",this.load()}async run(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await t();this.data=e.year===this.year?e:await b().getCalendar(this.year);const a=e.drafts_to_recalculate??0;this.note=a?a===1?s('טיוטה אחת מושפעת מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".'):s('{n} טיוטות מושפעות מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".',{n:a}):""}catch(e){this.error=M(e)}finally{this.busy=!1}}}setKind(t,e){if(!this.data)return;const a=this.data.revision;this.run(()=>b().setCalendarDay(t.date,e,t.name_he,a))}restore(t){if(!this.data)return;const e=this.data.revision;this.run(()=>b().removeCalendarDay(t.date,e))}addDay(){const t=this.add;if(this.addErr=V(t.date)?"":s("צריך לבחור תאריך"),this.addErr||!this.data)return;const e=this.data.revision;this.run(async()=>{const a=await b().setCalendarDay(t.date,t.kind,t.name,e);return this.add={date:"",kind:"holiday",name:""},Number(t.date.slice(0,4))!==this.year&&(this.year=Number(t.date.slice(0,4))),a})}render(){const t=R();if(!t.view&&!t.bills&&!t.manage)return r`<div class="page" data-elec="settings-calendar" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="settings-calendar" data-state="loading">${tt(5)}</div>`;if(this.st==="forbidden")return r`<div class="page" data-elec="settings-calendar" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה"))}</div>`;if(this.st==="error"||!this.data)return r`<div class="page" data-elec="settings-calendar" data-state="error">${E("error","warning",s("לא ניתן לטעון את הימים המיוחדים"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;const e=this.data,a=t.manage,n=e.days;return r`<div class="page" data-elec="settings-calendar" data-state="ready">
      ${this.error?C("err",this.error):o}
      ${this.note?C("info",this.note):o}
      <div class="card ${this.phone?"":"flush"}">
        <div class="hd"><b class="h3">${s("ימים מיוחדים")}</b>
          <div class="row" role="group" aria-label=${s("שנה")}><sw-button variant="ghost" size="sm" iconOnly icon="chevronBack" label=${s("השנה הקודמת")} data-year-prev @click=${()=>this.setYear(this.year-1)}></sw-button><b class="num" data-year>${this.year}</b><sw-button variant="ghost" size="sm" iconOnly icon="chevron" label=${s("השנה הבאה")} data-year-next @click=${()=>this.setYear(this.year+1)}></sw-button></div>
          <span class="sp"></span>
          <div class="seg" role="group" aria-label=${s("מקור החגים")}><button type="button" data-generator="israel" aria-pressed=${e.generator==="israel"} ?disabled=${!a||this.busy} @click=${()=>e.generator!=="israel"&&void this.run(()=>b().setCalendarGenerator("israel",e.revision,this.year))}>${s("חגי ישראל מחושבים")}</button><button type="button" data-generator="none" aria-pressed=${e.generator==="none"} ?disabled=${!a||this.busy} @click=${()=>e.generator!=="none"&&void this.run(()=>b().setCalendarGenerator("none",e.revision,this.year))}>${s("ימים ידניים בלבד")}</button></div>
        </div>
        ${n.length?this.phone?r`<div class="list" data-calendar>${n.map(i=>r`<div class="li" data-day=${i.date} data-kind=${i.kind} style="flex-wrap:wrap"><div class="grow"><div class="t1">${i.name_he||i.kind_he}</div><div class="t2">${u(S(i.date))} · ${s("יום {weekday}",{weekday:os(i.date)})} · ${i.source==="manual"?s("ידני"):s("מחושב")}</div></div>${this.kindCell(i,a)}
                ${a&&i.source==="manual"?r`<sw-button variant="ghost" size="sm" data-restore=${i.date} ?disabled=${this.busy} @click=${()=>this.restore(i)}>${i.generated?s("החזרה לחישוב"):s("הסרה")}</sw-button>`:o}</div>`)}</div>`:r`<div class="scrollx"><table class="t" data-calendar><thead><tr><th>${s("תאריך")}</th><th>${s("יום")}</th><th>${s("שם")}</th><th>${s("נחשב")}</th><th>${s("מקור")}</th><th></th></tr></thead><tbody>
              ${n.map(i=>r`<tr data-day=${i.date} data-kind=${i.kind}><td class="num" style="text-align:start">${S(i.date)}</td><td>${os(i.date)}</td><td class="b">${i.name_he||(i.generated?.name_he??"")}</td><td>${this.kindCell(i,a)}</td>
                <td>${i.source==="manual"?r`<span class="chip c-warn nodot">${s("ידני")}</span>`:r`<span class="chip c-mut nodot">${s("מחושב")}</span>`}</td>
                <td>${a?i.source==="manual"?r`<sw-button variant="ghost" size="sm" data-restore=${i.date} ?disabled=${this.busy} @click=${()=>this.restore(i)}>${i.generated?s("החזרה לחישוב"):s("הסרה")}</sw-button>`:o:o}</td></tr>`)}</tbody></table></div>`:r`<div class="mut" style="padding:0 16px 16px" data-calendar-empty>${s("אין ימים מיוחדים בשנה הזו.")}</div>`}
      </div>
      ${a?r`<div class="card" data-calendar-add><div class="hd"><b class="h3">${s("הוספת יום")}</b></div>
        <div class="form">
          <div class="fld"><label for="cd">${s("תאריך")}</label><input id="cd" type="date" lang=${ot()} class="ltr ${this.addErr?"err":""}" data-add-date .value=${this.add.date} @change=${i=>{this.add={...this.add,date:i.target.value},this.addErr=""}} />${this.addErr?r`<div class="msg" role="alert">${this.addErr}</div>`:o}</div>
          <div class="fld"><label for="ck">${s("נחשב")}</label><select id="ck" data-add-kind @change=${i=>this.add={...this.add,kind:i.target.value}}>${ds.map(i=>r`<option value=${i.id} .selected=${i.id===this.add.kind}>${i.label}</option>`)}</select></div>
          <div class="fld wide"><label for="cn">${s("שם (לא חובה)")}</label><input id="cn" data-add-name maxlength="60" .value=${this.add.name} @input=${i=>this.add={...this.add,name:i.target.value}} /></div>
        </div>
        <div class="row" style="margin-block-start:12px"><sw-button variant="primary" data-add-day ?disabled=${this.busy} @click=${()=>this.addDay()}>${s("הוספה")}</sw-button></div></div>`:o}
      <div class="mut">${e.note_he}</div>
    </div>`}kindCell(t,e){return e?r`<select aria-label=${s("סוג היום {date}",{date:S(t.date)})} data-kind-select=${t.date} ?disabled=${this.busy} @change=${a=>this.setKind(t,a.target.value)}>${ds.map(a=>r`<option value=${a.id} .selected=${a.id===t.kind}>${a.label}</option>`)}</select>`:r`<span>${t.kind_he}</span>`}};yt([c()],mt.prototype,"st",2);yt([c()],mt.prototype,"year",2);yt([c()],mt.prototype,"data",2);yt([c()],mt.prototype,"busy",2);yt([c()],mt.prototype,"error",2);yt([c()],mt.prototype,"note",2);yt([c()],mt.prototype,"add",2);yt([c()],mt.prototype,"addErr",2);mt=yt([T("elec-settings-calendar")],mt);var zi=Object.defineProperty,Ni=Object.getOwnPropertyDescriptor,wt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ni(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&zi(e,a,i),i};const Dt=[{key:"raw_retention_days",label:f("קריאות גולמיות"),usage:"raw_bytes",owner:"system"},{key:"interval_retention_months",label:f("נתוני רבע שעה"),usage:"interval_bytes",owner:"system"},{key:"bill_retention_years",label:f("חיובים וקבצי PDF"),usage:"bill_bytes",owner:"system"},{key:"draft_retention_days",label:f("טיוטות שלא הונפקו"),usage:"draft_bytes",owner:"manage"}],Ii={ימים:f("ימים"),חודשים:f("חודשים"),שנים:f("שנים")};let ht=class extends St{constructor(){super(...arguments),this.bubbleSkin=new Ft(this),this.data=null,this.phase="loading",this.error="",this.values={},this.saving=!1,this.saveError="",this.saved=!1,this.access=R()}connectedCallback(){super.connectedCallback(),this.stop=hs(t=>this.access=t),this.load()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}async load(){this.phase="loading";try{const t=await Hs();this.data=t,this.values=Object.fromEntries(Dt.map(e=>[e.key,String(t[e.key])])),this.phase="ready"}catch(t){this.error=lt(t),this.phase="error"}}editable(t){return!!this.data?.editable[t.key]}problem(t){const e=(this.values[t.key]??"").trim(),a=this.data?.ranges[t.key]??qe[t.key],n=Number(e);return e===""||!Number.isInteger(n)||n<a.min||n>a.max?f("הערך חייב להיות בין {min} ל-{max}",{min:a.min,max:a.max}):""}changed(){const t={};if(!this.data)return t;for(const e of Dt){const a=Number(this.values[e.key]);this.editable(e)&&!this.problem(e)&&a!==this.data[e.key]&&(t[e.key]=a)}return t}async save(){const t=this.changed();if(!(!Object.keys(t).length||this.saving)){this.saving=!0,this.saveError="",this.saved=!1;try{this.data=await Zs(t),this.values=Object.fromEntries(Dt.map(e=>[e.key,String(this.data[e.key])])),this.saved=!0}catch(e){this.saveError=lt(e)}finally{this.saving=!1}}}render(){if(!this.access.system&&!this.access.manage)return r`<sw-state-panel state="forbidden" data-elec="retention" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return r`<div data-elec="retention" data-state="loading" aria-busy="true" class="card">${[0,1,2,3].map(()=>r`<div class="row" style="padding:12px 0"><div class="skl" style="inline-size:36%"></div><span class="sp"></span><div class="skl" style="inline-size:20%"></div></div>`)}</div>`;if(this.phase==="error"||!this.data)return r`<div data-elec="retention" data-state="error"><sw-state-panel state="error" heading=${f("לא ניתן לטעון את ההגדרות")} hint=${this.error} actionLabel=${f("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel></div>`;const t=this.data,e=Dt.reduce((i,d)=>i+(t.usage[d.usage]??0),0),a=Object.keys(this.changed()).length>0,n=Dt.some(i=>this.editable(i)&&this.problem(i));return r`<div data-elec="retention" data-state="ready" class="card">
      <div class="list">${Dt.map(i=>{const d={...qe[i.key],...t.ranges[i.key]},l=this.editable(i)?this.problem(i):"",h=Number(this.values[i.key]),v=!l&&h!==t[i.key];return r`<div class="rowx" data-retention=${i.key}>
          <div class="grow"><div class="t1">${i.label}</div>
            <div class="t2">${f("{min} עד {max}",{min:d.min,max:d.max})} · ${f("בשימוש")} <span class="num" data-usage>${t.usage[i.usage]==null?"-":xe(t.usage[i.usage])}</span>${v&&i.key!=="draft_retention_days"?r` · ${f("הערכה לערך החדש")} <span class="num" data-estimate>${xe(Gs(i.key,h,t.meter_count))}</span>`:o}</div></div>
          <div class="fld"><div class="inp ${l?"err":""}"><input inputmode="numeric" data-retention-input=${i.key} aria-label=${i.label} aria-invalid=${l?"true":"false"} ?disabled=${!this.editable(i)} .value=${this.values[i.key]??""}
            @input=${p=>{this.saved=!1,this.values={...this.values,[i.key]:p.target.value}}} /><span class="mut">${Ii[d.unit]??d.unit}</span></div>
            ${l?r`<div class="msg" role="alert" data-retention-error=${i.key}>${l}</div>`:o}</div>
        </div>`})}</div>
      ${this.saveError?r`<div class="alert err" role="alert" style="margin-block-start:12px" data-save-error>${this.saveError}</div>`:o}
      <div class="foot"><span class="mut">${f("נתונים בתוך תקופה של טיוטה פתוחה לא נמחקים.")}</span><span class="mut">${f("סה״כ בשימוש")} <span class="num">${xe(e)}</span></span><span class="sp"></span>
        ${this.saved?r`<span class="ok" role="status" data-saved>${f("נשמר")}</span>`:o}
        <sw-button variant="primary" data-retention-save ?disabled=${!a||n||this.saving} @click=${()=>void this.save()}>${f("שמירה")}</sw-button></div>
    </div>`}};ht.styles=[gt,et`
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
    `,cs];wt([c()],ht.prototype,"data",2);wt([c()],ht.prototype,"phase",2);wt([c()],ht.prototype,"error",2);wt([c()],ht.prototype,"values",2);wt([c()],ht.prototype,"saving",2);wt([c()],ht.prototype,"saveError",2);wt([c()],ht.prototype,"saved",2);wt([c()],ht.prototype,"access",2);ht=wt([T("elec-settings-retention")],ht);
