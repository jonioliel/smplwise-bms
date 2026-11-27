import{a8 as Fs,k as c,m as D,u$ as s,b as r,ek as j,A as d,j as it,z as y,a as Ot,aX as Ut,c as Re,ei as ht,ai as ot,AD as Ge,q as ct,nM as je,AE as ye,d0 as qs,v0 as P,af as Vs,F as re,bg as Us,hY as Ks,zn as Ws,b4 as Hs,iH as Zs,AF as Gs,nN as Ys,AG as Xs,AH as Qs,AI as Js,AJ as ta,AK as ea,dD as f,em as gs,AL as sa,AM as aa,li as ia,AN as ra,AO as na,AP as la,AQ as oa,AR as Ye,AS as da,AT as ca}from"./index-DlIoBDHe.js";import{E as Q,n as u,o as Ae,p as Le,q as b,r as Rt,s as Pe,u as Dt,v as _e,w as E,x as at,y as st,z as Tt,A as V,B as T,C as he,D as vt,F as C,G as ke,H as k,I as Be,J as S,K as ha,L as jt,N as ua,O as ws,P as F,Q as Xe,R as Qe,S as ze,T as Ne,U as pa,V as ma,W as va,X as dt,Y as $a,Z as fa,_ as Ft,$ as ba,a0 as ga,a1 as A,a2 as mt,a3 as Ie,a4 as Je,a5 as wa,a6 as ya,a7 as _a,a8 as ka,a9 as xa,aa as Ea,ab as ys,ac as _s,ad as Ca,ae as xe,af as Sa,c as ts,d as Oa,e as Pa,g as es,h as za,i as Na,ag as Ia,ah as le,ai as ne,aj as Ma,ak as Ta,al as Da,am as ss,an as as,ao as ks,ap as xs,aq as Fe,ar as is,as as Ra,f as qt,at as Jt,au as oe,b as ue,m as ja,M as Aa,a as Es,j as La,k as Ba,l as Fa,t as qa,av as rs,aw as Ee}from"./meters-page-base-uz3jYmCa.js";import"./sw-table-DYkMWTOG.js";import{e as wt}from"./styles-DllUAnS1.js";import{c as te}from"./day-key-CpLUamnv.js";import"./sw-place-tree-Cfg5QnmX.js";import{FIXTURE_NOW as Va}from"./fixtures-Db2whdpa.js";import{b as Cs}from"./bubble-chrome-BBeQfjBL.js";const Nt="/infra/electricity",Ua="/system/infra",kt=t=>`#${t}`,M={accounts:()=>`${Nt}/accounts`,accountNew:()=>`${Nt}/accounts/new`,account:(t,e="")=>`${Nt}/accounts/${t}${e?`/${e}`:""}`,bills:()=>`${Nt}/bills`,bill:t=>`${Nt}/bills/${t}`,customers:()=>`${Nt}/customers`,customer:t=>`${Nt}/customers/${t}`,settings:t=>`${Ua}/${t}`},N={accounts:()=>kt(M.accounts()),accountNew:()=>kt(M.accountNew()),account:(t,e="")=>kt(M.account(t,e)),bills:()=>kt(M.bills()),bill:t=>kt(M.bill(t)),customers:()=>kt(M.customers()),customer:t=>kt(M.customer(t)),settings:t=>kt(M.settings(t))},X=t=>Fs(t);var Ka=Object.defineProperty,Wa=Object.getOwnPropertyDescriptor,Kt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Wa(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ka(e,a,i),i};const ns="sw.elec.accounts.view";let At=class extends Q{constructor(){super(...arguments),this.st="loading",this.rows=[],this.q="",this.view="table",this.narrow=!1,this.onNarrow=()=>this.narrow=!!this.narrowMq?.matches,this.status=t=>t.stale?r`<span class="chip c-warn">${s("מונה לא מדווח")}</span>`:r`<span class="chip c-ok">${s("תקין")}</span>`,this.last=t=>{const e=t.account.last_bill;return e?r`${e.number?u(e.number):s("טיוטה")} ${Ae(e.state)}`:r`<span class="mut">-</span>`},this.statusCell=t=>t.stale?r`<span class="chip" data-tone="warn">${s("מונה לא מדווח")}</span>`:r`<span class="chip" data-tone="ok">${s("תקין")}</span>`,this.lastCell=t=>{const e=t.account.last_bill;return e?r`${e.number?u(e.number):s("טיוטה")} ${Le(e.state)}`:r`<span class="mut">-</span>`}}connectedCallback(){super.connectedCallback(),this.narrowMq=globalThis.matchMedia?.("(max-width: 1100px)"),this.narrowMq?.addEventListener("change",this.onNarrow),this.onNarrow();try{this.view=localStorage.getItem(ns)==="cards"?"cards":"table"}catch{}this.load()}disconnectedCallback(){this.narrowMq?.removeEventListener("change",this.onNarrow),super.disconnectedCallback()}async load(){this.st="loading";try{this.rows=await b().listAccounts(),this.st=this.rows.length?"ready":"empty"}catch{this.st="error"}}setView(t){this.view=t;try{localStorage.setItem(ns,t)}catch{}}columns(t){const e=[{key:"name",label:s("חשבון"),render:a=>r`<a class="t1" href=${N.account(a.account.id)} @click=${n=>n.stopPropagation()}>${a.account.name}</a>`},{key:"customer",label:s("לקוח"),render:a=>Rt(a.account)},...this.narrow?[]:[{key:"formula",label:s("נוסחה"),kind:["muted","truncate"],render:a=>a.account.formula.sentence_he,cellTitle:a=>a.account.formula.sentence_he}],{key:"period",label:s("תקופה"),render:a=>Pe(a.account.period_months,a.account.period_anchor_day,a.account.period_anchor_month)},{key:"kwh",label:s("צריכה בתקופה"),kind:"num",render:a=>Dt(a.kwh)}];return t&&e.push({key:"amount",label:s("סכום עד כה"),kind:"num",render:a=>a.amount!==void 0?_e(a.amount):""},{key:"last",label:s("חיוב אחרון"),kind:"status",render:a=>this.lastCell(a)}),e.push({key:"state",label:s("מצב"),kind:"status",render:a=>this.statusCell(a)}),e}render(){const t=j(),e=t.bills;if(!t.view)return r`<div class="page" data-elec="accounts" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לצפות בחשבונות"))}</div>`;const a=this.q.trim(),n=this.rows.filter(l=>!a||l.account.name.includes(a)||!!l.account.customer?.name.includes(a)),i=r`<div class="row">
      <input type="search" data-search aria-label=${s("חיפוש חשבון או לקוח")} placeholder=${s("חיפוש חשבון או לקוח")} .value=${this.q} @input=${l=>this.q=l.target.value} />
      ${this.phone?d:r`<sw-segmented label=${s("תצוגה")} value=${this.view} @change=${l=>this.setView(l.detail.value)}
        .options=${[{value:"cards",label:s("כרטיסים"),attrs:{"data-view":"cards"}},{value:"table",label:s("טבלה"),attrs:{"data-view":"table"}}]}></sw-segmented>`}
      <span class="sp"></span>
      ${t.manage?r`<a class="btn pri ${this.phone?"sm":""}" data-new-account href=${N.accountNew()}>${s("+ חשבון חדש")}</a>`:d}
    </div>`;let o;return this.st==="loading"?o=at(6):this.st==="error"?o=E("error","warning",s("לא ניתן לטעון את החשבונות"),{label:s("נסה שוב"),run:()=>void this.load()}):this.st==="empty"?o=E("empty","bolt",s("אין חשבונות עדיין"),t.manage?{label:s("+ חשבון חדש"),primary:!0,run:()=>X(M.accountNew())}:void 0):n.length?this.phone?o=r`<div class="list" data-elec-list>${n.map(l=>r`<a class="li" href=${N.account(l.account.id)} data-account-row=${l.account.id}>
        <div class="grow"><div class="t1">${l.account.name}</div><div class="t2">${Rt(l.account)} · ${u(Dt(l.kwh))} ${s("קוט״ש")}${e&&l.amount!==void 0?r` · ${u(_e(l.amount))}`:d}</div></div>${this.status(l)}</a>`)}</div>`:this.view==="cards"?o=r`<div class="grid-cards" data-elec-list>${n.map(l=>r`<div class="card" data-account-row=${l.account.id}>
        <div class="row"><a class="rowlink h3" href=${N.account(l.account.id)}>${l.account.name}</a><span class="sp"></span>${this.status(l)}</div>
        <div class="mut">${Rt(l.account)} · ${Pe(l.account.period_months,l.account.period_anchor_day,l.account.period_anchor_month)}</div>
        <div class="row" style="margin-block-start:10px;align-items:baseline"><span class="big">${u(Dt(l.kwh))}</span><span class="mut">${s("קוט״ש בתקופה")}</span><span class="sp"></span>${e&&l.amount!==void 0?r`<b class="big amt">${u(_e(l.amount))}</b>`:d}</div>
        ${e?r`<div class="mut" style="margin-block-start:6px">${s("חיוב אחרון:")} ${this.last(l)}</div>`:d}</div>`)}</div>`:o=r`<sw-table class="t card flush" data-elec-list no-focus-rows .columns=${this.columns(e)} .rows=${n}
        .rowAttrs=${l=>({"data-account-row":l.account.id})}
        @row-select=${l=>X(M.account(l.detail.row.account.id))}></sw-table>`:o=E("empty","search",s("לא נמצאו חשבונות")),r`<div class="page" data-elec="accounts" data-state=${this.st==="ready"&&!n.length?"empty":this.st}>
      ${this.st==="ready"||this.st==="empty"||this.st==="loading"?i:d}
      ${o}
    </div>`}};Kt([c()],At.prototype,"st",2);Kt([c()],At.prototype,"rows",2);Kt([c()],At.prototype,"q",2);Kt([c()],At.prototype,"view",2);Kt([c()],At.prototype,"narrow",2);At=Kt([D("elec-accounts-list")],At);var Ha=Object.defineProperty,Za=Object.getOwnPropertyDescriptor,bt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Za(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ha(e,a,i),i};let rt=class extends Ot{constructor(){super(...arguments),this.account=null,this.open=!1,this.choice="last",this.from="",this.to="",this.busy=!1,this.error="",this.errorBill="",this.existing=[],this.skin=new Ut(this)}willUpdate(t){if(t.has("open")&&this.open&&this.account){this.choice="last",this.error="",this.errorBill="";const e=this.periods();this.from=e.last.from,this.to=e.last.to,b().listBills({account_id:this.account.id}).then(a=>this.existing=a.items).catch(()=>this.existing=[])}}periods(){const t=this.account,e=st(),a=Tt(e,t.period_months,t.period_anchor_day,t.period_anchor_month),n=te(a.from,-1);return{last:{from:Tt(n,t.period_months,t.period_anchor_day,t.period_anchor_month).from,to:n},current:{from:a.from,to:e}}}range(){const t=this.periods();return this.choice==="last"?t.last:this.choice==="current"?t.current:{from:this.from,to:this.to}}rangeError(){return this.choice!=="range"?"":!V(this.from)||!V(this.to)?s("צריך לבחור תאריך התחלה ותאריך סיום"):this.to<this.from?s("תאריך הסיום חייב להיות אחרי תאריך ההתחלה"):""}overlap(){const t=this.range();return this.existing.find(e=>e.state!=="void"&&e.state!=="draft"&&!(t.to<e.period.from||t.from>e.period.to))}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async create(){if(!this.account||this.busy)return;this.busy=!0,this.error="",this.errorBill="";const t=this.range(),e=this.choice==="last"?{kind:"last"}:{kind:"range",from:t.from,to:t.to};try{const a=await b().createBill(this.account.id,e);this.close(),X(M.bill(a.id))}catch(a){this.error=T(a),a instanceof Re&&(he(a)==="period_overlap"||he(a)==="draft_exists")&&(this.errorBill=String(a.body.details?.bill_id??""))}finally{this.busy=!1}}render(){const t=this.account;if(!t)return d;const e=this.periods(),a=this.overlap(),n=this.rangeError(),i=(o,l,p)=>r`<label class="li ${this.choice===o?"sel":""}"><input type="radio" name="period" data-period=${o} .checked=${this.choice===o} @change=${()=>{this.choice=o,this.error=""}} /><span class="ind"></span>
      <div class="grow"><div class="t1">${l}</div>${p?r`<div class="t2">${p}</div>`:d}</div></label>`;return r`<elec-dialog heading=${s("הפקת חיוב")} ?open=${this.open} data-bill-create @close=${()=>this.close()}>
      <div class="mut">${t.name}</div>
      <div class="list" role="radiogroup" aria-label=${s("תקופה")}>
        ${i("last",s("התקופה האחרונה"),u(vt(e.last.from,e.last.to)))}
        ${i("current",s("התקופה הנוכחית עד היום"),u(vt(e.current.from,e.current.to)))}
        ${i("range",s("טווח אחר"),d)}
      </div>
      ${this.choice==="range"?r`<div class="form">
            <div class="fld"><label for="bf">${s("מתאריך")}</label><input id="bf" type="date" lang=${ht()} name="from" data-range-from .value=${this.from} @change=${o=>this.from=o.target.value} /></div>
            <div class="fld"><label for="bt">${s("עד תאריך")}</label><input id="bt" type="date" lang=${ht()} name="to" data-range-to .value=${this.to} @change=${o=>this.to=o.target.value} /></div>
          </div>`:d}
      ${n?C("err",n):d}
      ${a?C("err",r`${s("כבר קיים חיוב")} ${u(a.number??"")} ${s("לתקופה הזו. אפשר")} <a class="lnk" href=${N.bill(a.id)}>${s("לתקן אותו")}</a> ${s("במקום ליצור חדש.")}`):d}
      ${this.error&&!a?C("err",r`${this.error}${this.errorBill?r` <a class="lnk" href=${N.bill(this.errorBill)}>${s("לפתיחת החיוב")}</a>`:d}`):d}
      <sw-button variant="primary" slot="actions" data-create ?disabled=${this.busy||!!a||!!n} @click=${()=>void this.create()}>${s("יצירת טיוטה")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
    </elec-dialog>`}};rt.styles=[wt,it`:host { display: contents; }`];bt([y({attribute:!1})],rt.prototype,"account",2);bt([y({type:Boolean,reflect:!0})],rt.prototype,"open",2);bt([c()],rt.prototype,"choice",2);bt([c()],rt.prototype,"from",2);bt([c()],rt.prototype,"to",2);bt([c()],rt.prototype,"busy",2);bt([c()],rt.prototype,"error",2);bt([c()],rt.prototype,"errorBill",2);bt([c()],rt.prototype,"existing",2);rt=bt([D("elec-bill-create")],rt);function Ss(t){if(!t)return[];const e=[],a=t.same_period_last_year,n=!!a&&t.previous.some(i=>i.from===a.from&&i.to===a.to&&i.kwh!==null);a&&a.kwh!==null&&!n&&e.push({key:"ly",label:ke(a.to),title:s("אותה תקופה אשתקד, {range}",{range:vt(a.from,a.to)}),kwh:Number(a.kwh),kind:"ly",partial:a.status==="partial"});for(const i of t.previous.slice(-12))e.push({key:`p${i.to}`,label:ke(i.to),title:vt(i.from,i.to),kwh:i.kwh===null?null:Number(i.kwh),kind:"prev",partial:i.status==="partial",lyMark:!!a&&i.from===a.from&&i.to===a.to});return t.current&&e.push({key:"cur",label:ke(t.current.to),title:s("התקופה הנוכחית, {range}",{range:vt(t.current.from,t.current.to)}),kwh:Number(t.current.kwh),kind:"cur",partial:!1}),e}const Ga=24;function Ya(t,e,a,n,i=4){const o=Math.min(i,a/2,n);return`M${t},${e+n} V${e+o} Q${t},${e} ${t+o},${e} H${t+a-o} Q${t+a},${e} ${t+a},${e+o} V${e+n} Z`}function Xa(t){const e=new Set;let a=null;for(const n of t)n.kwh!==null&&((n.kind==="cur"||n.kind==="ly"||n.lyMark)&&e.add(n.key),(!a||n.kwh>a.kwh)&&(a=n));return a&&e.add(a.key),e}const qe=t=>Ss(t).some(e=>e.kind!=="cur"&&e.kwh!==null);var Qa=Object.defineProperty,Ja=Object.getOwnPropertyDescriptor,Pt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ja(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Qa(e,a,i),i};let $t=class extends Ot{constructor(){super(...arguments),this.series=null,this.table="sr",this.print=!1,this.height=200,this.w=640,this.showTable=!1,this.hot=null}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(t=>{const e=Math.round(t[0].contentRect.width);e>120&&Math.abs(e-this.w)>2&&(this.w=e)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}render(){const t=Ss(this.series);if(!qe(this.series))return d;const e=this.w,a=this.height,n=12,i=18,o=22,l=t.length,p=(e-n*2)/l,$=t.map(w=>w.kwh??0),h=Math.max(...$,1)*1.12,v=Math.min(p*.68,Ga),m=w=>w/h*(a-i-o),g=a-o,B=w=>e-n-(w+1)*p,gt=w=>B(w)+(p-v)/2,Is=p<30?2:1,Ms=Xa(t),Ts=p>=30,Ue=t.find(w=>w.kind==="cur"),se=t.find(w=>w.kind==="ly"||w.lyMark),ve=se&&se.kwh!==null?g-m(se.kwh):null,Ds=t.some(w=>w.partial),Rs=s("צריכה לפי תקופה: {list}",{list:t.filter(w=>w.kwh!==null).map(w=>`${w.label} ${k(w.kwh)} ${s("קוט״ש")}`).join(", ")}),$e=this.hot===null?-1:t.findIndex(w=>w.key===this.hot),zt=$e>=0?t[$e]:null;return r`
      <svg viewBox="0 0 ${e} ${a}" role="img" aria-label=${Rs} data-elec-chart @pointerleave=${()=>this.hot=null}>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--c-bar2)"></rect><rect width="2.5" height="6" fill="var(--c-bar)" opacity="0.55"></rect></pattern>
        </defs>
        <line class="grid" x1=${n} x2=${e-n} y1=${g} y2=${g}></line>
        ${ve!==null&&Ue?ot`<line class="lyline" x1=${n} x2=${e-n} y1=${ve} y2=${ve}></line>`:d}
        ${t.map((w,fe)=>{const be=gt(fe),ae=be+v/2,js=w.kind==="ly"?s("אשתקד"):w.label,Ke=fe%Is===0||w.kind!=="prev"?ot`<text x=${ae} y=${a-6} text-anchor="middle">${js}</text>`:d,We=this.hot===w.key,He=ot`<rect class="hit" x=${B(fe)} y=${i-10} width=${p} height=${a-i+10-o+4}></rect>`,ie=()=>this.hot=w.key,Ze=()=>{this.hot===w.key&&(this.hot=null)};if(w.kwh===null)return ot`<g class=${We?"band hot":"band"} data-bar="gap" tabindex="0" aria-label=${`${w.title}: ${s("אין נתונים")}`} @pointerenter=${ie} @focus=${ie} @blur=${Ze}>
              ${He}<line class="gap" x1=${ae-5} x2=${ae+5} y1=${g-4} y2=${g-4}></line>${Ke}</g>`;const ge=Math.max(2,m(w.kwh)),we=g-ge,As=w.lyMark?ot`<rect class="ly" x=${be-2} y=${we-2} width=${v+4} height=${ge+2} rx="4"></rect>`:d,Ls=w.kind==="cur"?"bar":w.kind==="ly"?"ly":w.partial?"part":"bar2",Bs=Ts&&Ms.has(w.key)?ot`<text class="v" x=${ae} y=${we-5} text-anchor="middle">${k(w.kwh).replace(/\.00$/,"")}</text>`:d;return ot`<g class=${We?"band hot":"band"} data-bar=${w.kind} tabindex="0" aria-label=${`${w.title}: ${k(w.kwh)} ${s("קוט״ש")}${w.partial?` (${s("נתונים חלקיים")})`:""}`} @pointerenter=${ie} @focus=${ie} @blur=${Ze}>
            ${He}<path class=${Ls} d=${Ya(be,we,v,ge)}></path>
            ${As}${Bs}${Ke}</g>`})}
      </svg>
      ${zt?r`<div class="tip" role="tooltip" data-chart-tip style=${`left:${(gt($e)+v/2)/e*100}%; inset-block-start:${(zt.kwh===null?g-8:g-Math.max(2,m(zt.kwh)))/a*100}%`}>
            <b>${zt.kwh===null?s("אין נתונים"):`${k(zt.kwh)} ${s("קוט״ש")}`}</b><small>${zt.title}${zt.partial?` · ${s("נתונים חלקיים")}`:""}</small>
          </div>`:d}
      <div class="legend">
        ${Ue?r`<span><i class="l-cur"></i>${s("התקופה הנוכחית")}</span>`:d}
        <span><i class="l-prev"></i>${s("תקופות קודמות")}</span>
        ${se?r`<span><i class="l-ly"></i>${s("אותה תקופה אשתקד")}</span>`:d}
        ${Ds?r`<span><i class="l-part"></i>${s("נתונים חלקיים")}</span>`:d}
      </div>
      ${this.renderTable(t)}
    `}renderTable(t){const e=r`<div class=${this.table==="sr"?"sr":"tw"}><table data-elec-chart-table>
      <thead><tr>${t.map(a=>r`<th scope="col" title=${a.title}>${a.kind==="ly"?s("אשתקד"):a.label}</th>`)}</tr></thead>
      <tbody><tr>${t.map(a=>r`<td>${a.kwh===null?"-":k(a.kwh)}</td>`)}</tr></tbody>
    </table></div>`;return this.table==="details"?r`<button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.showTable} @click=${()=>this.showTable=!this.showTable}>${this.showTable?s("הסתרת טבלת מספרים"):s("טבלת מספרים")}</button>${this.showTable?e:d}`:e}};$t.styles=it`
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
  `;Pt([y({attribute:!1})],$t.prototype,"series",2);Pt([y()],$t.prototype,"table",2);Pt([y({type:Boolean,reflect:!0})],$t.prototype,"print",2);Pt([y({type:Number})],$t.prototype,"height",2);Pt([c()],$t.prototype,"w",2);Pt([c()],$t.prototype,"showTable",2);Pt([c()],$t.prototype,"hot",2);$t=Pt([D("elec-chart")],$t);const ti=t=>X(M.bill(t.id)),ei=t=>t.stopPropagation();function si(t){return[{key:"number",label:s("מספר"),render:e=>r`<a class="t1" href=${N.bill(e.id)} @click=${ei}>${e.number?r`<span class="num">${e.number}</span>`:r`<span class="mut">${s("טיוטה")}</span>`}</a>`},...t?[]:[{key:"customer",label:s("לקוח"),render:e=>e.customer.name},{key:"account",label:s("חשבון"),render:e=>e.account_name}],{key:"period",label:s("תקופה"),render:e=>r`<span class="num">${vt(e.period.from,e.period.to)}</span>`},{key:"kwh",label:s("קוט״ש"),kind:"num",render:e=>k(e.kwh)},{key:"total",label:s("סה״כ לתשלום"),kind:"num",render:e=>Be(e.total)},{key:"state",label:s("מצב"),kind:"status",render:e=>Le(e.state)},{key:"issued",label:s("הונפק"),hideBelow:"tablet",render:e=>r`<span class="num">${e.issue_date?S(e.issue_date):"-"}</span>`}]}function Ve(t,e){return e.phone?r`<div class="list" data-elec-bills>
      ${t.map(a=>r`<a class="li" href=${N.bill(a.id)} data-bill-row=${a.id} data-bill-state=${a.state}>
          <div class="grow"><div class="t1">${a.number?r`<span class="num">${a.number}</span>`:s("טיוטה")} · ${a.account_name}</div><div class="t2">${vt(a.period.from,a.period.to)} · <span class="num">${k(a.kwh)}</span> ${s("קוט״ש")}</div></div>
          <div style="text-align:end"><b class="num">${Be(a.total)}</b><div style="margin-block-start:4px">${Ae(a.state)}</div></div>
        </a>`)}
    </div>`:r`<sw-table class="t card flush" data-elec-bills no-focus-rows .columns=${si(!!e.compact)} .rows=${t}
    .rowAttrs=${a=>({"data-bill-row":String(a.id),"data-bill-state":String(a.state)})}
    @row-select=${a=>ti(a.detail.row)}></sw-table>`}var ai=Object.defineProperty,ii=Object.getOwnPropertyDescriptor,J=(t,e,a,n)=>{for(var i=n>1?void 0:n?ii(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&ai(e,a,i),i};let H=class extends Q{constructor(){super(...arguments),this.accountId="",this.tab="status",this.st="loading",this.err="",this.status=null,this.hist=null,this.histMonths=12,this.histSt="loading",this.bills=[],this.billsSt="loading",this.createOpen=!1,this.flash="",this.loaded=""}willUpdate(t){t.has("accountId")&&this.accountId&&this.loaded!==this.accountId&&(this.loaded=this.accountId,this.load()),(t.has("tab")||t.has("accountId"))&&this.accountId&&(this.tab==="history"&&this.loadHistory(),this.tab==="bills"&&this.loadBills())}async load(){this.st="loading";try{this.flash=ha(),this.status=await b().accountStatus(this.accountId),this.st="ready"}catch(t){this.err=T(t),this.st="error"}}async loadHistory(){this.histSt="loading";try{this.hist=await b().accountHistory(this.accountId,this.histMonths),this.histSt=this.hist.rows.some(t=>t.kwh!==null)||qe(this.hist.comparison)?"ready":"empty"}catch{this.histSt="error"}}async loadBills(){this.billsSt="loading";try{this.bills=(await b().listBills({account_id:this.accountId})).items,this.billsSt=this.bills.length?"ready":"empty"}catch{this.billsSt="error"}}head(t){const a=this.status?.account,n=[["status",s("מצב")],["history",s("היסטוריה")],...t.bills?[["bills",s("חיובים")]]:[]];return r`<div class="row"><a class="btn ghost sm" href=${N.accounts()} data-back>${s("→ חשבונות")}</a></div>
      <div class="row">
        <div><b class="h2" data-account-name>${a?.name??""}</b>
          <div class="mut">${a?r`${t.bills&&a.customer?r`<a class="lnk" href=${N.customer(a.customer.id)}>${a.customer.name}</a>`:Rt(a)} · ${Pe(a.period_months,a.period_anchor_day,a.period_anchor_month)}`:""}</div></div>
        <span class="sp"></span>
        ${t.bills&&a?r`<sw-button variant="primary" data-create-bill @click=${()=>this.createOpen=!0}>${s("הפקת חיוב")}</sw-button>`:d}
        ${t.manage&&a?r`<a class="btn" data-edit-account href=${N.account(a.id,"edit")}>${s("עריכה")}</a>`:d}
      </div>
      <div class="seg" style="align-self:flex-start" role="tablist" aria-label=${s("חלקי החשבון")}>
        ${n.map(([i,o])=>r`<button type="button" role="tab" data-tab=${i} aria-pressed=${this.tab===i} @click=${()=>X(M.account(this.accountId,i==="status"?"":i))}>${o}</button>`)}
      </div>`}render(){const t=j();return t.view?this.tab==="bills"&&!t.bills?r`<div class="page" data-elec="account" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לחיובים"))}</div>`:this.st==="loading"?r`<div class="page" data-elec="account" data-state="loading">${at(5)}</div>`:this.st==="error"||!this.status?r`<div class="page" data-elec="account" data-state="error"><div class="row"><a class="btn ghost sm" href=${N.accounts()}>${s("→ חשבונות")}</a></div>${E("error","warning",this.err||s("לא ניתן לטעון את החשבון"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`:r`<div class="page" data-elec="account" data-state="ready" data-tab-now=${this.tab}>
      ${this.head(t)}
      ${this.flash?C("warn",this.flash):d}
      ${this.tab==="status"?this.renderStatus(this.status,t):this.tab==="history"?this.renderHistory(t):this.renderBills()}
      <elec-bill-create .account=${this.status.account} ?open=${this.createOpen} @close=${()=>this.createOpen=!1}></elec-bill-create>
    </div>`:r`<div class="page" data-elec="account" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לצפות בחשבון"))}</div>`}meterColumns(t,e){return[{key:"name",label:s("מונה"),render:a=>r`<b>${a.name}</b>${a.stale?r` <span class="chip" data-tone="warn">${s("לא מדווח")}</span>`:d}`,foot:()=>s("סה״כ לחיוב")},...e?[{key:"start",label:s("קריאה בתחילת התקופה"),kind:"num",render:a=>jt(a.start)},{key:"end",label:s("קריאה נוכחית"),kind:"num",render:a=>jt(a.end)}]:[],{key:"kwh",label:s("צריכה"),kind:"num",render:a=>k(a.kwh)},{key:"factor",label:s("חלק"),kind:"num",render:a=>String(a.factor)},{key:"part",label:s("לחיוב (קוט״ש)"),kind:"num",render:a=>r`<b>${k(a.part)}</b>`,foot:()=>Dt(t.kwh)}]}historyColumns(t,e,a){const n=[{key:"label",label:s("תקופה"),render:i=>u(i.label)},{key:"kwh",label:s("קוט״ש"),kind:"num",render:i=>r`${e(i)}`},{key:"change",label:s("שינוי"),kind:"num",render:i=>a(i)}];return t&&n.push({key:"amount",label:s("סכום"),kind:"num",render:i=>i.amount!==void 0?k(i.amount)+" ₪":""},{key:"bill",label:s("חיוב"),kind:"status",render:i=>i.bill?r`<a class="lnk num" href=${N.bill(i.bill.id)}>${i.bill.number}</a> ${Le(i.bill.state)}`:r`<span class="mut">-</span>`}),n}renderStatus(t,e){const a=t.rows.some(h=>h.start!==null),n=t.customer,i=t.rows,o=t.period,l=o?r`<div class="tile"><div class="k">${s("יום")} ${u(o.day)} ${s("מתוך")} ${u(o.days)}</div><div class="prog" style="margin-block-start:14px" role="progressbar" aria-valuenow=${o.day} aria-valuemin="0" aria-valuemax=${o.days}><i style="inline-size:${Math.round(o.day/o.days*100)}%"></i></div></div>`:r`<div class="tile" data-no-period><div class="k">${s("תקופה")}</div><div class="v mut">${s("אין עדיין תקופה פעילה")}</div></div>`,p=r`${t.error?C("warn",t.error):d}${t.stale?C("warn",r`<b>${t.stale.meter}</b> ${s("לא מדווח")}${t.stale.since?r` ${s("מאז")} ${u(t.stale.since)}`:""}. ${s("הצריכה תיספר כשהמונה יחזור לדווח.")}`):d}
      ${t.notes.map(h=>C("warn",h.text_he))}
      ${t.gaps.map(h=>C("warn",r`<span data-billing-gap=${h.from}>${s("פער בחיובים: הימים {from} - {to} נמצאים בין חיובים שהונפקו ואינם כלולים באף חיוב.",{from:S(h.from),to:S(h.to)})}</span>`))}
      <div class="tiles" data-elec-tiles>
        <div class="tile"><div class="k">${s("צריכה בתקופה")}</div><div class="v">${u(Dt(t.kwh))}<span class="u">${s("קוט״ש")}</span></div></div>
        ${l}
        <div class="tile"><div class="k">${s("צפי לסוף התקופה")}</div><div class="v">${u(ua(t.forecast_kwh))}<span class="u">${s("קוט״ש")}</span></div></div>
        ${t.amount_so_far!==void 0?r`<div class="tile" data-tile="amount"><div class="k">${s("סכום עד כה")}</div><div class="v">${u(t.amount_so_far)}<span class="u">₪</span></div></div>`:r`<div class="tile"><div class="k">${s("ממוצע ליום")}</div><div class="v">${u(Dt(t.avg_per_day))}<span class="u">${s("קוט״ש")}</span></div></div>`}
      </div>
      <div class="card ${this.phone?"":"flush"}"><div class="hd"><b class="h3">${s("מונים בנוסחה")}</b><span class="sp"></span><span class="mut">${t.account.formula.sentence_he}</span></div>
        ${this.phone?r`<div class="list">${i.map(h=>r`<div class="li"><div class="grow"><div class="t1">${h.name}${h.factor?r` <span class="mut">(${h.factor})</span>`:d}</div><div class="t2">${a&&h.start!==null?r`${u(k(h.start))} ${s("←")} ${u(jt(h.end))}`:r`${u(k(h.kwh))} ${s("קוט״ש")}`}</div></div><b class="num">${k(h.part)}</b></div>`)}</div>
            <div class="row" style="margin-block-start:10px"><b>${s("סה״כ לחיוב")}</b><span class="sp"></span><b class="num">${Dt(t.kwh)}</b></div>`:r`<sw-table bare static-rows class="t" data-elec-meters .columns=${this.meterColumns(t,a)} .rows=${i}></sw-table>`}
      </div>`,$=r`<div class="card"><div class="hd"><b class="h3">${s("לקוח")}</b><span class="sp"></span>${e.bills&&n?r`<a class="btn ghost sm" href=${N.customer(n.id)}>${s("כרטיס לקוח")}</a>`:d}</div>
        <dl class="kv"><dt>${s("שם")}</dt><dd>${Rt(t.account)}</dd><dt>${s("מספר לקוח")}</dt><dd>${u(t.account.customer?.customer_number??ws)}</dd>${e.bills&&n?.phone?r`<dt>${s("טלפון")}</dt><dd>${u(n.phone)}</dd>`:d}${e.bills&&n?.email?r`<dt>${s("דוא״ל")}</dt><dd>${u(n.email)}</dd>`:d}</dl></div>
      ${t.price&&e.bills?r`<div class="card" data-card="price"><div class="hd"><b class="h3">${s("מחיר")}</b></div><dl class="kv"><dt>${s("תעריף")}</dt><dd>${t.price.tariff}</dd><dt>${s("לפני מע״מ")}</dt><dd>${u(F(t.price.ex_vat)+" ₪")}</dd><dt>${s("כולל מע״מ")}</dt><dd>${u(F(t.price.inc_vat)+" ₪")}</dd><dt>${s("מע״מ")}</dt><dd>${u(t.price.vat+"%")}</dd></dl></div>`:t.account.tariff.kind==="tou"&&e.bills?r`<div class="card" data-card="price" data-kind="tou"><div class="hd"><b class="h3">${s("מחיר")}</b></div><dl class="kv"><dt>${s("תעריף")}</dt><dd>${t.account.tariff.name}</dd><dt>${s("חישוב")}</dt><dd>${s("לפי שעות (תעו״ז)")}</dd></dl></div>`:d}
      <div class="card" data-card="next"><div class="hd"><b class="h3">${s("חיוב הבא")}</b></div>${t.next?this.nextBill(t.next,t.account.auto_mode):r`<div class="mut" data-no-next>${s("אין עדיין תקופה הבאה")}</div>`}</div>`;return r`<div class="cols side-l"><div class="col">${p}</div><div class="col">${$}</div></div>`}nextBill(t,e){return r`<dl class="kv"><dt>${s("תקופה")}</dt><dd>${u(S(t.from))} - ${u(S(t.to))}</dd><dt>${s("מספר צפוי")}</dt><dd>${u(t.number)}</dd>${e!=="off"?r`<dt>${e==="issue"?s("הנפקה אוטומטית"):s("טיוטה אוטומטית")}</dt><dd>${u(S(t.draft_on))}</dd>`:d}</dl>`}renderHistory(t){if(this.histSt==="loading")return at(5);if(this.histSt==="error")return E("error","warning",s("לא ניתן לטעון את ההיסטוריה"),{label:s("נסה שוב"),run:()=>void this.loadHistory()});const e=this.hist;if(this.histSt==="empty")return E("empty","bolt",s("אין עדיין נתוני עבר לחשבון"));const a=t.bills,n=[...e.rows].reverse(),i=l=>l.kwh===null?r`<span class="mut" data-no-data>${s("אין נתונים")}</span>`:r`${u(k(l.kwh))}${l.status==="partial"?r` <span class="chip c-warn nodot" data-tone="warn" data-nodot data-partial>${s("חלקי")}</span>`:d}`,o=l=>l.change_pct!==null?(l.change_pct>0?"+":"")+l.change_pct.toFixed(1)+"%":"-";return r`<div class="card" data-elec-history><div class="hd"><b class="h3">${s("צריכה לפי תקופה")}</b><span class="sp"></span>
        <sw-segmented label=${s("טווח")} value=${String(this.histMonths)} @change=${l=>this.setMonths(Number(l.detail.value))}
        .options=${[{value:"12",label:s("12 תקופות"),attrs:{"data-months":"12"}},{value:"24",label:s("24 תקופות"),attrs:{"data-months":"24"}}]}></sw-segmented></div>
      <elec-chart .series=${e.comparison} table="details" .height=${this.phone?200:220}></elec-chart></div>
      <div class="card ${this.phone?"":"flush"}">${this.phone?r`<div class="list">${n.map(l=>r`<div class="li" data-history-row data-status=${l.status}><div class="grow"><div class="t1">${u(l.label)}</div><div class="t2">${i(l)}${l.kwh!==null?r` ${s("קוט״ש")}`:""}${l.change_pct!==null?r` · ${u(o(l))}`:d}</div></div>${a&&l.amount!==void 0?r`<b class="num">${k(l.amount)} ₪</b>`:d}</div>`)}</div>`:r`<sw-table bare static-rows class="t" data-elec-history-table .columns=${this.historyColumns(a,i,o)} .rows=${n}
            .rowAttrs=${l=>({"data-history-row":!0,"data-status":String(l.status)})}></sw-table>`}</div>`}setMonths(t){this.histMonths=t,this.loadHistory()}renderBills(){return this.billsSt==="loading"?at(4):this.billsSt==="error"?E("error","warning",s("לא ניתן לטעון את החיובים"),{label:s("נסה שוב"),run:()=>void this.loadBills()}):this.billsSt==="empty"?E("empty","bolt",s("אין חיובים לחשבון הזה"),{label:s("הפקת חיוב"),primary:!0,run:()=>this.createOpen=!0}):Ve(this.bills,{phone:this.phone,compact:!0})}};J([y()],H.prototype,"accountId",2);J([y()],H.prototype,"tab",2);J([c()],H.prototype,"st",2);J([c()],H.prototype,"err",2);J([c()],H.prototype,"status",2);J([c()],H.prototype,"hist",2);J([c()],H.prototype,"histMonths",2);J([c()],H.prototype,"histSt",2);J([c()],H.prototype,"bills",2);J([c()],H.prototype,"billsSt",2);J([c()],H.prototype,"createOpen",2);J([c()],H.prototype,"flash",2);H=J([D("elec-account-page")],H);var ri=Object.defineProperty,ni=Object.getOwnPropertyDescriptor,tt=(t,e,a,n)=>{for(var i=n>1?void 0:n?ni(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&ri(e,a,i),i};function li(t){return[{key:"name",label:s("מונה"),render:e=>e.name,foot:()=>s("צריכת החשבון")},{key:"kwh",label:s("צריכה (קוט״ש)"),kind:"num",render:e=>k(e.kwh),foot:()=>r`<span part=${t.negative?"bad":d} data-formula-result>${k(t.result_kwh??0)}</span>`}]}let K=class extends Ot{constructor(){super(...arguments),this.meters=[],this.tokens=[],this.preset="custom",this.mode="builder",this.text="",this.textIssues=[],this.selected=-1,this.menu=!1,this.mainId="",this.pctVal="30",this.preview=null,this.previewErr="",this.skin=new Ut(this),this.seq=0,this.timer=0,this.lastKey="",this.nameOf=t=>this.meters.find(e=>e.id===t)?.name??t,this.idOf=t=>this.meters.find(e=>e.name.trim()===t.trim())?.id??null,this.lastOf=t=>this.meters.find(e=>e.id===t)?.last_period_kwh??null}willUpdate(t){t.has("meters")&&!this.mainId&&(this.mainId=this.meters[0]?.id??""),t.has("tokens")&&this.tokens.length&&(this.preset=Xe(this.tokens,this.meters.map(e=>e.id)))}updated(t){t.has("tokens")&&(this.selected=Math.min(this.selected,this.tokens.length-1),this.mode==="text"&&!this.textIssues.length&&(this.text=Qe(this.tokens,this.nameOf)),this.scheduleCheck())}parse(){return ze(this.tokens)}emit(t,e=this.preset){this.preset=e,this.tokens=t,this.selected=-1;const a=ze(t),n={tokens:t,ast:a.ast,valid:!a.issues.length&&!!a.ast,preset:e};this.dispatchEvent(new CustomEvent("change",{detail:n,bubbles:!0,composed:!0}))}edit(t){this.emit(t,Xe(t,this.meters.map(e=>e.id)))}scheduleCheck(){window.clearTimeout(this.timer);const t=this.parse(),e=JSON.stringify(t.ast);if(!t.ast||t.issues.length){this.preview=null,this.previewErr="",this.lastKey="";return}if(e===this.lastKey){this.emitChecked();return}this.timer=window.setTimeout(()=>void this.runCheck(t.ast,e),150)}async runCheck(t,e){const a=++this.seq;try{const n=await b().checkFormula(t);if(a!==this.seq)return;this.lastKey=e,this.preview=n,this.previewErr=""}catch(n){if(a!==this.seq)return;this.preview=null,this.previewErr=T(n)}this.emitChecked()}emitChecked(){const t=!!this.preview&&!this.preview.negative&&!this.previewErr;this.dispatchEvent(new CustomEvent("checked",{detail:{ok:t,result:this.preview?.result_kwh??null,negative:this.preview?.negative??!1,error:this.previewErr},bubbles:!0,composed:!0}))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}applyPreset(t){const e=this.meters.map(n=>n.id);if(t==="custom"){this.preset="custom";return}const a=t==="pct"?Ne("pct",[this.mainId||e[0]],{pct:this.pctVal}):Ne(t,e,{main:this.mainId});this.emit(a,t)}add(t){const e=[...this.tokens],a=this.selected>=0?this.selected+1:e.length;e.splice(a,0,t),this.edit(e),this.selected=a}addMeter(t){this.menu=!1,this.add({t:"m",id:t})}addOp(t){this.add({t:"op",v:t})}togglePercent(){const t=this.selected>=0?this.selected:this.tokens.length-1,e=this.tokens[t];if(e?.t!=="n")return;const a=[...this.tokens];a[t]={...e,pct:!e.pct},this.edit(a),this.selected=t}backspace(){const t=[...this.tokens],e=this.selected>=0?this.selected:t.length-1;e<0||(t.splice(e,1),this.edit(t),this.selected=Math.min(e-1,t.length-1))}addNumber(t,e){this.add({t:"n",v:t,pct:e})}setMode(t){t!==this.mode&&(t==="text"?(this.text=Qe(this.tokens,this.nameOf),this.textIssues=[]):this.textIssues.length&&(this.textIssues=[]),this.mode=t)}onText(t){this.text=t.target.value;const e=pa(this.text,this.idOf);if(this.textIssues=e.issues,!e.issues.length)this.edit(e.toks);else{const a={tokens:this.tokens,ast:null,valid:!1,preset:this.preset};this.dispatchEvent(new CustomEvent("change",{detail:a,bubbles:!0,composed:!0}))}}tok(t,e,a){const n=`tok ${t.t==="m"?"m":t.t==="op"?"op":"k"} ${a.has(e)?"bad":""} ${this.selected===e?"sel":""}`,i=()=>this.selected=this.selected===e?-1:e;if(t.t==="m"){const o=this.lastOf(t.id);return r`<button type="button" class=${n} data-tok="meter" aria-pressed=${this.selected===e} @click=${i}>${this.nameOf(t.id)}${o!==null?r`<small class="num">${k(o)}</small>`:d}</button>`}return t.t==="op"?r`<button type="button" class=${n} data-tok="op" aria-pressed=${this.selected===e} aria-label=${t.v==="*"?s("כפל"):t.v==="-"?s("מינוס"):t.v==="+"?s("פלוס"):t.v==="/"?s("חילוק"):t.v} @click=${i}>${t.v==="*"?"×":t.v==="-"?"−":t.v==="/"?"÷":t.v}</button>`:r`<button type="button" class=${n} data-tok="num" aria-pressed=${this.selected===e} @click=${i}><span class="num">${t.v}${t.pct?"%":""}</span></button>`}render(){const t=this.parse(),e=new Set(t.issues.map(h=>h.at).filter(h=>h>=0)),a=this.preview,n=!!a?.negative,i=this.mode==="text"&&this.textIssues.length?this.textIssues.map(h=>h.message):t.issues.map(h=>h.message),o=i.length||n||this.previewErr,l=!i.length&&!n&&!this.previewErr&&!!t.ast&&!!a,p=this.tokens.length?ma(this.tokens,this.nameOf):"",$=t.warnings;return r`<div data-elec="formula-editor" data-formula-state=${o?"error":l?"ok":"pending"} data-preset=${this.preset}>
      <div class="presets" role="group" aria-label=${s("תבנית נוסחה")}>
        ${va.map(h=>r`<button type="button" class="preset" data-preset-btn=${h.id} aria-pressed=${this.preset===h.id} @click=${()=>this.applyPreset(h.id)}><b>${h.label}</b><span>${h.hint}</span></button>`)}
      </div>
      ${this.preset==="mainsub"||this.preset==="pct"?r`<div class="row">
            <div class="fld" style="min-inline-size:200px"><label for="main">${this.preset==="pct"?s("מונה"):s("מונה ראשי")}</label>
              <select id="main" data-preset-main @change=${h=>{this.mainId=h.target.value,this.applyPreset(this.preset)}}>
                ${this.meters.map(h=>r`<option value=${h.id} ?selected=${h.id===this.mainId}>${h.name}</option>`)}
              </select></div>
            ${this.preset==="pct"?r`<div class="fld" style="inline-size:120px"><label for="pct">${s("אחוז")}</label><input id="pct" class="ltr" data-preset-pct inputmode="decimal" .value=${this.pctVal} @input=${h=>{this.pctVal=h.target.value,Number(this.pctVal)>0&&this.applyPreset("pct")}} /></div>`:d}
          </div>`:d}
      <div class="row"><b class="h3">${s("הנוסחה")}</b><span class="sp"></span>
        <sw-segmented label=${s("מצב עריכה")} value=${this.mode} @change=${h=>{h.stopPropagation(),this.setMode(h.detail.value)}}
        .options=${[{value:"builder",label:s("בונה"),attrs:{"data-mode":"builder"}},{value:"text",label:s("טקסט"),attrs:{"data-mode":"text"}}]}></sw-segmented>
      </div>
      ${this.mode==="text"?r`<textarea class="code ${this.textIssues.length?"err":""}" data-text aria-label=${s("נוסחה בטקסט")} dir="ltr" spellcheck="false" .value=${this.text} @input=${this.onText}></textarea>
            <div class="mut">${s("שמות מונים בסוגריים מרובעים. פעולות: + − × ( ) ומספרים או אחוזים.")}</div>`:r`<div class="expr ${i.length||n?"err":""}" data-expr>
              ${this.tokens.length?this.tokens.map((h,v)=>this.tok(h,v,e)):r`<span class="mut">${s("הוסיפו מונה או בחרו תבנית")}</span>`}
            </div>
            <div class="pal">
              <button type="button" class="btn" data-add-meter aria-expanded=${this.menu} aria-haspopup="listbox" @click=${()=>this.menu=!this.menu}>${s("+ מונה")} ▾</button>
              ${["+","-","*"].map(h=>r`<button type="button" class="btn" data-op=${h} aria-label=${h==="+"?s("פלוס"):h==="-"?s("מינוס"):s("כפל")} @click=${()=>this.addOp(h)}>${h==="*"?"×":h==="-"?"−":h}</button>`)}
              <button type="button" class="btn" data-op="percent" aria-label=${s("אחוז")} @click=${()=>this.togglePercent()}>%</button>
              <button type="button" class="btn" data-op="(" aria-label=${s("סוגר פותח")} @click=${()=>this.addOp("(")}>(</button>
              <button type="button" class="btn" data-op=")" aria-label=${s("סוגר סוגר")} @click=${()=>this.addOp(")")}>)</button>
              <sw-button data-number-btn @click=${()=>this.dispatchEvent(new CustomEvent("number-request",{bubbles:!0,composed:!0}))}>${s("מספר")}</sw-button>
              <span class="sp"></span>
              <sw-button variant="ghost" data-backspace @click=${()=>this.backspace()}>⌫ ${s("מחיקה")}</sw-button>
            </div>
            ${this.menu?r`<div class="menu" role="listbox" data-meter-menu>${this.meters.map(h=>r`<button type="button" role="option" data-meter-option=${h.id} @click=${()=>this.addMeter(h.id)}><span>${h.name}</span>${h.last_period_kwh!==null?r`<span class="mut num">${k(h.last_period_kwh)}</span>`:d}</button>`)}</div>`:d}`}
      ${p?r`<div class="mut" data-sentence>${p}</div>`:d}
      ${i.map(h=>C("err",h))}
      ${$.map(h=>C("warn",h))}
      ${n&&a?C("err",r`${s("התוצאה שלילית בתקופה האחרונה")} (${u(k(a.result_kwh??0))} ${s("קוט״ש")}). ${s("בדקו את הסימנים בנוסחה.")}`):d}
      ${this.previewErr?C("err",this.previewErr):d}
      ${l?C("ok",s("הנוסחה תקינה")):d}
      ${a&&!i.length?this.renderPreview(a):d}
    </div>`}renderPreview(t){return r`<div class="card soft" data-formula-preview>
      <div class="hd"><b class="h3">${s("בדיקה על {period}",{period:t.period_from?`${S(t.period_from)} - ${S(t.period_to)}`:s("התקופה האחרונה")})}</b></div>
      <sw-table bare static-rows class="t" .columns=${li(t)} .rows=${t.rows}></sw-table>
    </div>`}};K.styles=[wt,it`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      textarea.code {
        min-block-size: 76px;
        font-size: var(--sw-fs-lg);
      }
    `];tt([y({attribute:!1})],K.prototype,"meters",2);tt([y({attribute:!1})],K.prototype,"tokens",2);tt([c()],K.prototype,"preset",2);tt([c()],K.prototype,"mode",2);tt([c()],K.prototype,"text",2);tt([c()],K.prototype,"textIssues",2);tt([c()],K.prototype,"selected",2);tt([c()],K.prototype,"menu",2);tt([c()],K.prototype,"mainId",2);tt([c()],K.prototype,"pctVal",2);tt([c()],K.prototype,"preview",2);tt([c()],K.prototype,"previewErr",2);K=tt([D("elec-formula-editor")],K);function Y(t){const e=(t.device_name??"").trim(),a=(t.entity_name??"").trim()||t.name;return t.name&&t.name!==a&&t.name!==e?{primary:t.name,secondary:[...new Set([e,a].filter(i=>i&&i!==t.name))].join(" · ")}:{primary:e||a,secondary:e&&a!==e?a:""}}function Os(t){return[t.name,t.device_name,t.entity_name].filter(Boolean).join(" ").toLowerCase()}const ls=120;function de(t,e){const a=t.trim(),n=a.toLocaleLowerCase(),i=!!a&&e.some(o=>o.trim().toLocaleLowerCase()===n);return a?a.length>ls?{name:a,error:s("השם ארוך מדי (עד {max} תווים)",{max:ls}),duplicate:i}:i?{name:a,error:Ps,duplicate:i}:{name:a,error:"",duplicate:i}:{name:a,error:s("צריך להזין שם למונה"),duplicate:!1}}const Ps=s("קיים כבר מונה בשם הזה, לא ניתן להקים שני מונים באותו שם"),oi=s("השם החדש יופיע במסמכים חדשים. חשבוניות שכבר הונפקו לא ישתנו.");var di=Object.defineProperty,ci=Object.getOwnPropertyDescriptor,nt=(t,e,a,n)=>{for(var i=n>1?void 0:n?ci(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&di(e,a,i),i};let Z=class extends Ot{constructor(){super(...arguments),this.bubbleSkin=new Ut(this),this.mode="register",this.multi=!0,this.sensors=!1,this.selected=[],this.meters=null,this.q="",this.area="",this.items=[],this.phase="loading",this.error="",this.rejected=null,this.timer=0,this.seq=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){window.clearTimeout(this.timer),super.disconnectedCallback()}updated(t){t.has("meters")&&t.get("meters")!==void 0&&this.mode==="choose"&&this.load()}async load(){const t=++this.seq;this.phase="loading";try{const e=this.mode==="choose"?await this.loadChoose():this.fromCandidates(await Ge(this.q,this.area||void 0));if(t!==this.seq)return;this.items=e,this.phase="ready"}catch(e){if(t!==this.seq)return;this.error=ct(e),this.phase="error"}}async loadChoose(){const[t,e]=await Promise.all([this.meters?Promise.resolve(this.meters):je(),this.sensors?Ge("").catch(()=>[]):Promise.resolve([])]);return[...this.fromMeters(t),...this.fromSensors(e)]}fromCandidates(t){return t.map(e=>({id:e.entity_id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:e.value??"",verdict:e.already_added?"added":e.verdict,message:e.already_added?"":ye(e),sensor:!1}))}fromMeters(t){return t.map(e=>({id:e.id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:`${dt(e.reading_kwh)} kWh`,verdict:e.status==="reporting"?"ok":"warn",message:e.status==="stale"?s("המונה לא מדווח כרגע"):e.status==="paused"?s("המונה מושהה"):"",sensor:!1,tag:e.status==="stale"?s("לא מדווח"):e.status==="paused"?s("מושהה"):void 0}))}fromSensors(t){return t.filter(e=>e.verdict!=="ok"&&!e.already_added).map(e=>({id:e.entity_id,name:e.name,device:e.device_name??"",entity:e.entity_name??"",area:e.area_name??"",value:e.value??"",verdict:e.verdict==="warn"?"warn":"rejected",message:e.verdict==="warn"?`${ye(e)} ${s("צריך להוסיף אותו קודם במסך המונים.")}`:ye(e),sensor:!0}))}listed(){if(this.phase!=="ready")return[];if(this.mode!=="choose")return this.items;const t=this.q.trim().toLowerCase();return this.items.filter(e=>(!this.area||e.area===this.area)&&(!t||Os({name:e.name,device_name:e.device,entity_name:e.entity}).includes(t)||e.area.toLowerCase().includes(t)))}onSearch(t){this.q=t.target.value,this.mode!=="choose"&&(window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.load(),250))}onArea(t){this.area=t.target.value,this.mode!=="choose"&&this.load()}off(t){return t.sensor||t.verdict==="rejected"||t.verdict==="added"}toggle(t){if(this.off(t)){this.rejected=t.verdict==="added"?null:t;return}this.rejected=null;const e=this.selected.includes(t.id),a=this.multi?e?this.selected.filter(i=>i!==t.id):[...this.selected,t.id]:e?[]:[t.id];this.selected=a;const n={};for(const i of a){const o=this.items.find(l=>l.id===i);o&&(n[i]=Y({name:o.name,device_name:o.device,entity_name:o.entity}).primary)}this.dispatchEvent(new CustomEvent("change",{detail:{selected:a,names:n},bubbles:!0,composed:!0}))}chip(t){return t.verdict==="ok"?r`<span class="chip c-ok" data-verdict="ok">${s("מתאים")}</span>`:t.verdict==="warn"?r`<span class="chip c-warn" data-verdict="warn">${t.tag??s("אזהרה")}</span>`:t.verdict==="added"?r`<span class="chip c-acc" data-verdict="added">${s("נוסף")}</span>`:r`<span class="chip c-err" data-verdict="rejected">${s("לא מתאים")}</span>`}render(){const t=this.mode==="choose",e=[...new Set(this.items.map(n=>n.area).filter(Boolean))],a=this.listed();return r`
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
      ${this.rejected?r`<div class="alert err" role="alert" data-picker-reject><span class="x" aria-hidden="true">!</span><div><b>${Y({name:this.rejected.name,device_name:this.rejected.device,entity_name:this.rejected.entity}).primary}</b> ${s("לא נבחר.")} ${this.rejected.message}</div></div>`:d}
      ${this.phase==="loading"?r`<sw-state-panel state="loading" compact></sw-state-panel>`:d}
      ${this.phase==="error"?r`<sw-state-panel state="error" compact heading=${t?s("לא ניתן לטעון את המונים"):s("לא ניתן לטעון את החיישנים")} hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel>`:d}
      ${this.phase==="ready"&&!a.length?r`<sw-state-panel icon="bolt" state="empty" compact data-no-match heading=${t?this.items.length?s("לא נמצא מונה בשם הזה"):s("אין מונים עדיין"):s("לא נמצאו חיישנים")}></sw-state-panel>`:d}
      ${a.length?r`<div class="list scroll" role="listbox" aria-multiselectable=${this.multi?"true":"false"} aria-label=${t?s("מונים"):s("חיישנים")} data-picker-list>
            ${a.map(n=>{const i=this.selected.includes(n.id),o=this.off(n),l=Y({name:n.name,device_name:n.device,entity_name:n.entity});return r`<button type="button" class="li pick ${i?"sel":""} ${o?"dis":""} ${this.rejected?.id===n.id?"flag":""}" role="option" aria-selected=${i?"true":"false"} aria-disabled=${o?"true":"false"} data-picker-item=${n.id} data-verdict=${n.verdict} ?data-sensor=${n.sensor} @click=${()=>this.toggle(n)}>
                <span class="check ${i?"on":""} ${o?"dis":""}">${i?r`<sw-icon name="check" size="14"></sw-icon>`:d}</span>
                <span class="grow">
                  <div class="t1" data-picker-name>${l.primary}</div>
                  ${l.secondary?r`<div class="t2 ent" data-picker-entity title=${s("שם הישות")}>${l.secondary}</div>`:d}
                  <div class="t2">${n.area}${n.area&&n.value?" · ":""}<span class="num">${n.value}</span></div>
                  ${n.message&&(n.verdict==="warn"||n.verdict==="rejected")?r`<div class="t2 wrap" style="color:${n.verdict==="warn"?"var(--sw-warning-text)":"var(--sw-danger-text)"}">${n.message}</div>`:d}
                </span>
                ${this.chip(n)}
              </button>`})}
          </div>`:d}
    `}};Z.styles=[wt,it`
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
    `];nt([y()],Z.prototype,"mode",2);nt([y({type:Boolean})],Z.prototype,"multi",2);nt([y({type:Boolean})],Z.prototype,"sensors",2);nt([y({attribute:!1})],Z.prototype,"selected",2);nt([y({attribute:!1})],Z.prototype,"meters",2);nt([c()],Z.prototype,"q",2);nt([c()],Z.prototype,"area",2);nt([c()],Z.prototype,"items",2);nt([c()],Z.prototype,"phase",2);nt([c()],Z.prototype,"error",2);nt([c()],Z.prototype,"rejected",2);Z=nt([D("elec-meter-picker")],Z);var hi=Object.defineProperty,ui=Object.getOwnPropertyDescriptor,x=(t,e,a,n)=>{for(var i=n>1?void 0:n?ui(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&hi(e,a,i),i};const Ce=[s("בחירת מונים"),s("נוסחת החשבון"),s("מחיר ומע״מ"),s("תקופת חיוב"),s("כרטיס לקוח"),s("סיכום והפקה")],pi=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,os=()=>({name:"",customer_number:"",tax_id:"",address:"",phone:"",email:"",notes:""});let _=class extends Q{constructor(){super(...arguments),this.accountId="",this.loadSt="loading",this.step=1,this.reached=1,this.meters=[],this.tariffs=[],this.vat=null,this.settings=null,this.customers=[],this.nextNo="",this.meterIds=[],this.tokens=[],this.formulaValid=!1,this.formulaChecked=!1,this.tariffId="",this.tariffOpen=!1,this.tf={name:"",price:"",mode:"ex_vat",from:"",err:{},busy:!1,error:""},this.months=1,this.anchorDay=1,this.anchorMonth=1,this.firstStart="",this.custMode="new",this.custQ="",this.existingId="",this.nc=os(),this.ncErr={},this.accName="",this.accNameErr="",this.auto="draft",this.afterSave="draft",this.saving=!1,this.saveErr="",this.sampleResult=null,this.numOpen=!1,this.numVal="",this.numPct=!0,this.numErr="",this.account=null,this.createdCustomerId="",this.draftPossible=()=>!!this.lastPeriod(),this.onFormula=t=>{this.tokens=t.detail.tokens,this.formulaValid=t.detail.valid,this.formulaChecked=!1},this.onChecked=t=>{this.formulaChecked=t.detail.ok&&this.formulaValid,this.sampleResult=t.detail.result}}connectedCallback(){super.connectedCallback(),this.init()}get edit(){return!!this.accountId}async init(){this.loadSt="loading";const t=j();try{const e=b(),[a,n,i,o,l,p]=await Promise.all([$a(),e.listTariffs(),e.getVat(),e.getSettings().catch(()=>null),t.view?e.listCustomers().catch(()=>[]):Promise.resolve([]),e.nextCustomerNumber().catch(()=>"")]);if(this.meters=a,this.tariffs=n,this.vat=i,this.settings=o,this.customers=l,this.nextNo=p,this.nc={...os(),customer_number:p},this.tf={...this.tf,mode:o?.default_price_mode??"ex_vat",from:st()},this.firstStart=st(),n.length===1&&(this.tariffId=n[0].id),this.edit){const $=await e.getAccount(this.accountId);this.account=$,this.meterIds=$.formula.meter_ids,this.tokens=fa($.formula.ast),this.formulaValid=!0,this.tariffId=$.tariff.id,this.months=$.period_months,this.anchorDay=$.period_anchor_day,this.anchorMonth=$.period_anchor_month,this.firstStart=$.first_period_start,this.auto=$.auto_mode,this.accName=$.name,this.existingId=$.customer?.id??"",this.custMode="existing",this.reached=6}this.loadSt="ready"}catch{this.loadSt="error"}}chosen(){return this.meterIds.map(t=>this.meters.find(e=>e.id===t)).filter(t=>!!t)}tariff(){return this.tariffs.find(t=>t.id===this.tariffId)}cust(){if(this.custMode==="existing"){const t=this.customers.find(e=>e.id===this.existingId)??(this.account?{name:Rt(this.account),customer_number:this.account.customer?.customer_number??ws,account_count:1}:null);return t?{name:t.name,number:t.customer_number,count:t.account_count}:{name:"",number:this.nextNo,count:0}}return{name:this.nc.name,number:this.nc.customer_number||this.nextNo,count:0}}canNext(){switch(this.step){case 1:return this.meterIds.length>0;case 2:return this.formulaValid&&this.formulaChecked;case 3:return!!this.tariffId&&!!this.vat?.current;case 4:return V(this.firstStart)&&this.anchorDay>=1&&this.anchorDay<=28;case 5:return!0;default:return!0}}goStep(t){t<1||t>6||t>this.reached||(this.step=t)}next(){this.step===5&&!this.validateStep5()||!this.canNext()||this.step>=6||(this.step===1&&this.enterFormula(),this.step+=1,this.reached=Math.max(this.reached,this.step),this.step===2&&(this.formulaChecked=!1))}enterFormula(){this.tokens.every(e=>e.t!=="m"||this.meterIds.includes(e.id))&&this.tokens.some(e=>e.t==="m")||(this.tokens=Ne("sum",this.meterIds),this.formulaValid=!0,this.formulaChecked=!1)}validateStep5(){this.ncErr={},this.accNameErr="";let t=!0;return this.accName.trim()||(this.accNameErr=s("צריך לתת שם לחשבון"),t=!1),this.edit||(this.custMode==="new"?(this.nc.name.trim()||(this.ncErr={...this.ncErr,name:s("צריך לכתוב שם ללקוח")},t=!1),this.nc.email&&!pi.test(this.nc.email)&&(this.ncErr={...this.ncErr,email:s("כתובת דוא״ל לא תקינה")},t=!1),/^\d{1,9}$/.test(this.nc.customer_number)||(this.ncErr={...this.ncErr,customer_number:s("מספר לקוח הוא ספרות בלבד")},t=!1)):this.existingId||(t=!1)),t}async save(){if(this.saving)return;const t=this.tariff(),e=ze(this.tokens).ast;if(!t||!e)return;this.saving=!0,this.saveErr="";const a=b();try{if(this.edit&&this.account){await a.updateAccount(this.account.id,this.account.revision,{name:this.accName.trim(),formula:{ast:e},tariff_id:this.tariffId,auto_mode:this.auto}),X(M.account(this.account.id));return}let n=this.existingId;if(this.custMode==="new"){if(!this.createdCustomerId)try{const o=await a.createCustomer({name:this.nc.name.trim(),customer_number:this.nc.customer_number,address:this.nc.address,phone:this.nc.phone,email:this.nc.email,tax_id:this.nc.tax_id,notes:this.nc.notes});this.createdCustomerId=o.id}catch(o){const l=Ft(o);this.ncErr=Object.keys(l).length?l:{customer_number:T(o)},!Object.keys(l).length&&!ba(o)&&(this.ncErr={name:T(o)}),this.step=5;return}n=this.createdCustomerId}const i=await a.createAccount({name:this.accName.trim(),customer_id:n,formula:{ast:e},tariff_id:this.tariffId,period_months:this.months,period_anchor_day:this.anchorDay,period_anchor_month:this.months===2?this.anchorMonth:1,first_period_start:this.firstStart,auto_mode:this.auto},this.draftPossible()?this.afterSave:"none");i.billError&&ga(s("החשבון נשמר, אבל לא נוצרה טיוטה: {error}",{error:i.billError})),X(M.account(i.account.id))}catch(n){this.saveErr=T(n)}finally{this.saving=!1}}lastPeriod(){const t=st(),e=Tt(t,this.months,this.anchorDay,this.months===2?this.anchorMonth:1),a=te(e.from,-1);return!V(this.firstStart)||a<this.firstStart?null:{from:this.firstStart>Tt(a,this.months,this.anchorDay,this.months===2?this.anchorMonth:1).from?this.firstStart:Tt(a,this.months,this.anchorDay,this.months===2?this.anchorMonth:1).from,to:a}}renderStep1(){const t=this.chosen();return r`<elec-meter-picker mode="choose" multi sensors .meters=${this.meters} .selected=${this.meterIds} data-meter-picker
        @change=${e=>this.meterIds=e.detail.selected}></elec-meter-picker>
      <div class="row" data-chosen><span class="chip c-acc nodot">${t.length===1?s("נבחרו 1 מונה"):s("נבחרו {n} מונים",{n:t.length})}</span><span class="mut">${t.map(e=>Y(e).primary).join(", ")}</span></div>`}renderStep2(){return r`<elec-formula-editor .meters=${this.chosen()} .tokens=${this.tokens} @change=${this.onFormula} @checked=${this.onChecked} @number-request=${()=>{this.numOpen=!0,this.numErr=""}}></elec-formula-editor>`}confirmNumber(){const t=this.numVal.trim().replace(",",".");if(!/^\d+(\.\d+)?$/.test(t)||Number(t)<=0){this.numErr=s("צריך להקליד מספר גדול מאפס");return}if(this.numPct&&Number(t)>1e3){this.numErr=s("האחוז גדול מדי");return}this.numOpen=!1,this.numErr="",this.renderRoot.querySelector("elec-formula-editor")?.addNumber(t,this.numPct),this.numVal=""}renderNumberDialog(){return r`<elec-dialog heading=${s("הוספת מספר")} ?open=${this.numOpen} data-number-dialog @close=${()=>this.numOpen=!1}>
      <div class="fld"><label for="numv">${s("ערך")}</label>
        <input id="numv" class="ltr ${this.numErr?"err":""}" data-number-input inputmode="decimal" .value=${this.numVal} @input=${t=>{this.numVal=t.target.value,this.numErr=""}} @keydown=${t=>t.key==="Enter"&&this.confirmNumber()} />
        ${this.numErr?r`<div class="msg" role="alert">${this.numErr}</div>`:d}</div>
      <sw-segmented label=${s("סוג")} value=${this.numPct?"pct":"num"} @change=${t=>this.numPct=t.detail.value==="pct"}
        .options=${[{value:"pct",label:s("אחוז"),attrs:{"data-number-kind":"pct"}},{value:"num",label:s("מספר"),attrs:{"data-number-kind":"num"}}]}></sw-segmented>
      <sw-button variant="primary" slot="actions" data-number-ok @click=${()=>this.confirmNumber()}>${s("הוספה")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.numOpen=!1}>${s("ביטול")}</sw-button>
    </elec-dialog>`}exOf(t){const e=t.current,a=this.vat?.current?Number(this.vat.current.rate_percent)/100:0,n=e?Number(e.price):0;return e?.price_mode==="inc_vat"?{ex:n/(1+a),inc:n,vat:a}:{ex:n,inc:n*(1+a),vat:a}}renderStep3(){const t=this.tariff(),e=this.vat?.current;return r`${e?d:C("err",r`${s("לא הוגדר שיעור מע״מ.")} <a class="lnk" href=${N.settings("prices")}>${s("הגדרת שיעור מע״מ")}</a>`)}
      ${this.tariffs.length?r`<div class="list" role="radiogroup" aria-label=${s("תעריף")} data-tariff-list>
        ${this.tariffs.map(a=>r`<label class="li ${a.id===this.tariffId?"sel":""}" data-tariff-row=${a.id}><input type="radio" name="tariff" .checked=${a.id===this.tariffId} @change=${()=>this.tariffId=a.id} /><span class="ind"></span>
          <div class="grow"><div class="t1">${a.name}</div><div class="t2">${a.current?.price_mode==="inc_vat"?s("הוזן כולל מע״מ"):s("הוזן לפני מע״מ")} ${s("· בתוקף מ-")}${u(S(a.current?.effective_from??""))}</div></div>${a.kind==="tou"?r`<span class="chip c-acc nodot">${s("לפי שעות")}</span>`:r`<b class="num">${F(a.current?.price??0)} ₪</b>`}</label>`)}</div>
        <div class="row"><sw-button variant="ghost" size="sm" data-new-tariff @click=${()=>this.tariffOpen=!0}>${s("+ תעריף חדש")}</sw-button></div>`:E("empty","bolt",s("אין תעריפים עדיין"),{label:s("+ תעריף חדש"),primary:!0,run:()=>this.tariffOpen=!0})}
      ${t&&e?this.priceCard(t):d}`}priceCard(t){if(t.kind==="tou"){const i=t.current?.definition;return r`<div class="card soft" data-price-card data-kind="tou"><dl class="kv"><dt>${s("תעריף")}</dt><dd>${s("לפי שעות (תעו״ז)")}${i?r`: ${i.bands.map(o=>A("bands",o,t.current?.names_en)).join(" / ")}, ${i.seasons.map(o=>A("seasons",o,t.current?.names_en)).join(" / ")}`:d}</dd>
        <dt>${s("מע״מ")}</dt><dd>${u((this.exOf(t).vat*100).toFixed(0)+"%")} <span class="mut">${s("(מההגדרות)")}</span></dd></dl>
        <div class="mut" style="margin-block-start:8px">${s("הסכום מחושב לפי שעות הצריכה בפועל, בכל פס ועונה במחיר שלהם.")}</div></div>`}const e=this.exOf(t),a=this.sampleKwh(),n=t.current?.price_mode==="inc_vat"?mt(a*e.inc):mt(mt(a*e.ex)+mt(mt(a*e.ex)*e.vat));return r`<div class="card soft" data-price-card><dl class="kv"><dt>${s("מחיר לקוט״ש לפני מע״מ")}</dt><dd>${u(F(e.ex)+" ₪")}</dd><dt>${s("מע״מ")}</dt><dd>${u((e.vat*100).toFixed(0)+"%")} <span class="mut">${s("(מההגדרות)")}</span></dd><dt>${s("מחיר לקוט״ש כולל מע״מ")}</dt><dd>${u(F(e.inc)+" ₪")}</dd>
      ${a?r`<dt>${s("לדוגמה,")} ${Ie(te(Tt(st(),1,1,1).from,-1))}</dt><dd>${u(k(a))} ${s("קוט״ש =")} ${u(k(n)+" ₪")}</dd>`:d}</dl></div>`}sampleKwh(){return this.sampleResult!==null&&this.sampleResult>0?this.sampleResult:0}periodColumns(t){return[{key:"period",label:s("תקופה"),render:e=>r`<span class="num">${vt(e.from,e.to)}</span>`},{key:"number",label:s("מספר חיוב"),render:e=>r`<span class="num">${Je(e.to,t,"")}</span>`}]}renderStep4(){const t=this.months===2?this.anchorMonth:1,e=V(this.firstStart)?wa(this.firstStart,this.months,this.anchorDay,t,"",3):[],a=this.cust(),n=this.anchorDay<1||this.anchorDay>28;return r`<div class="form">
        <div class="fld"><span class="lbl" id="len">${s("אורך תקופה")}</span><sw-segmented label=${s("אורך תקופה")} ?disabled=${this.edit} value=${String(this.months)} @change=${i=>this.months=Number(i.detail.value)}
        .options=${[{value:"1",label:s("חודשית"),attrs:{"data-months":"1"}},{value:"2",label:s("דו-חודשית"),attrs:{"data-months":"2"}}]}></sw-segmented></div>
        ${this.months===2?r`<sw-field class="fld" label=${s("חודש פתיחת המחזור")}><select id="am" data-anchor-month ?disabled=${this.edit} @change=${i=>this.anchorMonth=Number(i.target.value)}>${ya.map((i,o)=>r`<option value=${o+1} ?selected=${this.anchorMonth===o+1}>${i}</option>`)}</select></sw-field>`:d}
        <sw-field class="fld" label=${s("יום תחילת תקופה")} unit=${s("בחודש")}><input id="ad" class="ltr ${n?"err":""}" type="number" min="1" max="28" data-anchor-day aria-invalid=${n?"true":"false"} ?disabled=${this.edit} .value=${String(this.anchorDay)} @input=${i=>this.anchorDay=Number(i.target.value)} />
          ${n?r`<div class="msg" role="alert" slot="message">${s("היום חייב להיות בין 1 ל-28")}</div>`:d}</sw-field>
        <sw-field class="fld" label=${s("תחילת החיוב הראשון")}><input id="fs" type="date" lang=${ht()} class="ltr ${V(this.firstStart)?"":"err"}" aria-invalid=${V(this.firstStart)?"false":"true"} data-first-start ?disabled=${this.edit} .value=${this.firstStart} @change=${i=>this.firstStart=i.target.value} />
          ${V(this.firstStart)?d:r`<div class="msg" role="alert" slot="message">${s("צריך לבחור תאריך")}</div>`}</sw-field>
      </div>
      <div class="card flush soft"><div class="hd"><b class="h3">${s("התקופות הבאות")}</b></div>${e.length?r`<sw-table bare static-rows class="t" data-periods .columns=${this.periodColumns(a.number)} .rows=${e}></sw-table>`:r`<div class="mut" style="padding:0 16px 14px">${s("בחרו תאריך התחלה")}</div>`}</div>`}renderStep5(){const t=(i,o,l={})=>{const p=this.ncErr[i];return r`<div class="fld ${l.wide?"wide":""}"><label for="c-${i}">${o}</label>
        ${l.area?r`<textarea id="c-${i}" name=${i} .value=${this.nc[i]} placeholder=${l.ph??""} @input=${$=>this.nc={...this.nc,[i]:$.target.value}}></textarea>`:r`<input id="c-${i}" name=${i} class="${l.ltr?"ltr":""} ${p?"err":""}" aria-invalid=${p?"true":"false"} placeholder=${l.ph??""} .value=${this.nc[i]} @input=${$=>{this.nc={...this.nc,[i]:$.target.value},this.ncErr[i]&&(this.ncErr={...this.ncErr,[i]:""})}} />`}
        ${p?r`<div class="msg" role="alert" data-field-error=${i}>${p}</div>`:d}</div>`},e=this.customers.find(i=>i.id===this.existingId),a=this.custQ.trim(),n=this.customers.filter(i=>!a||i.name.includes(a)||i.customer_number.includes(a));return r`${this.edit?C("info",r`${s("הלקוח של חשבון קיים לא משתנה כאן.")} <b>${this.account?Rt(this.account):""}</b>`):r`<sw-segmented label=${s("לקוח")} style="align-self:flex-start" value=${this.custMode} @change=${i=>this.custMode=i.detail.value}
        .options=${[{value:"new",label:s("לקוח חדש"),attrs:{"data-cust-mode":"new"}},{value:"existing",label:s("לקוח קיים"),attrs:{"data-cust-mode":"existing"}}]}></sw-segmented>`}
      ${this.edit?d:this.custMode==="existing"?r`<input type="search" data-cust-search style="max-inline-size:none" aria-label=${s("חיפוש לקוח")} placeholder=${s("חיפוש לקוח")} .value=${this.custQ} @input=${i=>this.custQ=i.target.value} />
            <div class="list" role="radiogroup" aria-label=${s("לקוח קיים")} data-cust-list>${n.map(i=>r`<label class="li ${i.id===this.existingId?"sel":""}" data-cust-row=${i.id}><input type="radio" name="cust" .checked=${i.id===this.existingId} @change=${()=>this.existingId=i.id} /><span class="ind"></span><div class="grow"><div class="t1">${i.name}</div><div class="t2">${s("מספר לקוח")} ${u(i.customer_number)} · ${i.account_count} ${s("חשבונות")}</div></div></label>`)}
              ${n.length?d:r`<div class="mut">${s("לא נמצא לקוח")}</div>`}</div>
            ${e&&e.account_count>0?C("warn",r`${e.account_count===1?s("ללקוח יש כבר 1 חשבון."):s("ללקוח יש כבר {n} חשבונות.",{n:e.account_count})} ${s("חיובים של אותו לקוח שמסתיימים באותו חודש יקבלו סיומת רצה, למשל")} <b class="num">${Je(Tt(st(),1,1,1).to,e.customer_number,"")}/2</b>.`,"i"):d}`:r`<div class="form">${t("name",s("שם הלקוח"),{wide:!0})}${t("customer_number",s("מספר לקוח"),{ltr:!0})}${t("tax_id",s("ח.פ. / ע.מ. (לא חובה)"),{ltr:!0,ph:s("לא חובה")})}${t("address",s("כתובת למשלוח החיוב"),{wide:!0})}${t("phone",s("טלפון"),{ltr:!0})}${t("email",s("דוא״ל"),{ltr:!0})}${t("notes",s("הערות"),{wide:!0,ph:s("לא חובה"),area:!0})}</div>`}
      <div class="fld"><label for="an">${s("שם החשבון")}</label><input id="an" name="account_name" data-account-name class="${this.accNameErr?"err":""}" .value=${this.accName} placeholder=${s("למשל: סטודיו אורן - קומה 1")} @input=${i=>{this.accName=i.target.value,this.accNameErr=""}} />
        ${this.accNameErr?r`<div class="msg" role="alert" data-field-error="account_name">${this.accNameErr}</div>`:d}</div>`}renderStep6(){const t=this.tariff(),e=this.cust(),a=this.sampleKwh(),n=t?this.exOf(t):null,i=this.tokens.map(h=>h.t==="m"?this.meters.find(v=>v.id===h.id)?.name??"":h.t==="n"?h.v+(h.pct?"%":""):h.v==="*"?"×":h.v==="-"?"−":h.v).join(" ").replace(/\( /g,"(").replace(/ \)/g,")"),o=this.settings?.payment_terms,l=this.lastPeriod(),p=n&&t?t.current?.price_mode==="inc_vat"?mt(a*n.inc):mt(mt(a*n.ex)+mt(mt(a*n.ex)*n.vat)):0,$=(h,v,m,g,B,gt=!1)=>r`<label class="li ${g?"sel":""} ${gt?"dis":""}"><input type="radio" name=${h} data-opt=${v} .checked=${g} ?disabled=${gt} @change=${B} /><span class="ind"></span><div class="grow t1">${m}</div></label>`;return r`<dl class="kv" data-summary><dt>${s("מונים")}</dt><dd>${this.chosen().map(h=>Y(h).primary).join(", ")}</dd><dt>${s("נוסחה")}</dt><dd>${i}</dd>
        <dt>${s("מחיר")}</dt><dd>${t?r`${t.name}, ${t.kind==="tou"?s("לפי שעות"):u(F(t.current?.price??0)+" ₪")} ${t.current?.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}, ${s("מע״מ")} ${u(this.vat?.current?.rate_percent??"")}%`:""}</dd>
        <dt>${s("תקופה")}</dt><dd>${s("{period}, מה-{day} בחודש, החל מ-",{period:this.months===1?s("חודשית"):s("דו-חודשית"),day:this.anchorDay})}${u(S(this.firstStart))}</dd>
        <dt>${s("לקוח")}</dt><dd>${e.name}, ${s("מספר")} ${u(e.number)}</dd><dt>${s("שם החשבון")}</dt><dd>${this.accName}</dd>
        <dt>${s("תנאי תשלום")}</dt><dd data-payment>${o?o.mode==="net_days"?r`${u(o.days)} ${s("ימים מיום ההפקה")}`:r`${s("ב-")}${u(o.day_of_month)} ${s("בחודש")}`:"-"} <a class="lnk" href=${N.settings("business")}>${s("שינוי בהגדרות")}</a></dd></dl>
      ${a?r`<div class="card soft"><div class="hd"><b class="h3">${s("לפי הנתונים של התקופה האחרונה")}</b></div><div class="row"><span style="font-size:var(--sw-fs-2xl);font-weight:700">${u(k(a))}</span><span class="mut">${s("קוט״ש")}</span><span class="sp"></span>${t?.kind==="tou"?r`<span class="mut">${s("הסכום לפי שעות הצריכה")}</span>`:r`<span style="font-size:var(--sw-fs-2xl);font-weight:700">${u(k(p)+" ₪")}</span>`}</div></div>`:d}
      <div class="fld"><span class="lbl">${s("יצירה אוטומטית בסוף כל תקופה")}</span><div class="list" role="radiogroup" aria-label=${s("יצירה אוטומטית")}>
        ${["draft","issue","off"].map(h=>$("auto",h,_a[h],this.auto===h,()=>this.auto=h))}</div>
        ${this.auto==="issue"?C("warn",s("החיוב יונפק ויקבל מספר בלי בדיקה שלך. אפשר לבטל או לתקן אחר כך.")):d}</div>
      ${this.edit?d:r`<div class="fld"><span class="lbl">${s("אחרי השמירה")}</span><div class="list" role="radiogroup" aria-label=${s("אחרי השמירה")}>
        ${$("after","draft",l?s("שמירה והפקת טיוטה ל{period}",{period:this.months===1?Ie(l.to):vt(l.from,l.to)}):s("שמירה והפקת טיוטה (אין עדיין תקופה שהסתיימה)"),this.afterSave==="draft"&&!!l,()=>this.afterSave="draft",!l)}
        ${$("after","none",s("שמירה בלבד"),this.afterSave==="none"||!l,()=>this.afterSave="none")}</div></div>`}
      ${this.saveErr?C("err",this.saveErr):d}`}async saveTariff(){const t=this.tf,e={};if(t.name.trim()||(e.name=s("צריך לתת שם לתעריף")),Number(t.price)>0||(e.price=s("המחיר חייב להיות מספר גדול מאפס")),V(t.from)||(e.from=s("צריך לבחור תאריך")),Object.keys(e).length){this.tf={...t,err:e};return}this.tf={...t,busy:!0,error:"",err:{}};try{const a=await b().createTariff({name:t.name.trim(),price:t.price,price_mode:t.mode,effective_from:t.from});this.tariffs=[...this.tariffs,a],this.tariffId=a.id,this.tariffOpen=!1,this.tf={...this.tf,name:"",price:"",busy:!1}}catch(a){this.tf={...this.tf,busy:!1,error:T(a),err:Ft(a)}}}renderTariffDialog(){const t=this.tf,e=(a,n)=>this.tf={...this.tf,[a]:n,err:{...this.tf.err,[a]:""}};return r`<elec-dialog heading=${s("תעריף חדש")} ?open=${this.tariffOpen} data-tariff-dialog @close=${()=>this.tariffOpen=!1}>
      <div class="form">
        <sw-field class="fld wide" label=${s("שם התעריף")}><input id="tn" class="${t.err.name?"err":""}" aria-invalid=${t.err.name?"true":"false"} data-tariff-name .value=${t.name} @input=${a=>e("name",a.target.value)} />${t.err.name?r`<div class="msg" role="alert" slot="message">${t.err.name}</div>`:d}</sw-field>
        <sw-field class="fld" label=${s("מחיר לקוט״ש")} unit="₪"><input id="tp" class="ltr ${t.err.price?"err":""}" aria-invalid=${t.err.price?"true":"false"} data-tariff-price inputmode="decimal" .value=${t.price} @input=${a=>e("price",a.target.value)} />${t.err.price?r`<div class="msg" role="alert" slot="message">${t.err.price}</div>`:d}</sw-field>
        <div class="fld"><span class="lbl">${s("המחיר שהוזן")}</span><sw-segmented label=${s("סוג מחיר")} value=${t.mode} @change=${a=>this.tf={...t,mode:a.detail.value}}
        .options=${[{value:"ex_vat",label:s("לפני מע״מ"),attrs:{"data-tariff-mode":"ex_vat"}},{value:"inc_vat",label:s("כולל מע״מ"),attrs:{"data-tariff-mode":"inc_vat"}}]}></sw-segmented></div>
        <sw-field class="fld" label=${s("בתוקף מתאריך")}><input id="tf" type="date" lang=${ht()} class="ltr ${t.err.from?"err":""}" aria-invalid=${t.err.from?"true":"false"} data-tariff-from .value=${t.from} @change=${a=>e("from",a.target.value)} />${t.err.from?r`<div class="msg" role="alert" slot="message">${t.err.from}</div>`:d}</sw-field>
      </div>
      ${t.error?C("err",t.error):d}
      <sw-button variant="primary" slot="actions" data-tariff-save ?disabled=${t.busy} @click=${()=>void this.saveTariff()}>${s("שמירה")}</sw-button>
      <sw-button slot="actions" @click=${()=>this.tariffOpen=!1}>${s("ביטול")}</sw-button>
    </elec-dialog>`}render(){if(!j().manage)return r`<div class="page" data-elec="wizard" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לניהול חשבונות"))}</div>`;if(this.loadSt==="loading")return r`<div class="page" data-elec="wizard" data-state="loading">${at(5)}</div>`;if(this.loadSt==="error")return r`<div class="page" data-elec="wizard" data-state="error">${E("error","warning",s("לא ניתן לטעון את האשף"),{label:s("נסה שוב"),run:()=>void this.init()})}</div>`;const e=this.step,a=[this.renderStep1,this.renderStep2,this.renderStep3,this.renderStep4,this.renderStep5,this.renderStep6][e-1].call(this),n=this.canNext();return r`<div class="page" data-elec="wizard" data-state="ready" data-step=${e}>
      <div class="row"><a class="btn ghost sm" href=${this.edit?N.account(this.accountId):N.accounts()} data-back>${this.edit?s("→ לחשבון"):s("→ חשבונות")}</a><b class="h2">${this.edit?s("עריכת חשבון"):s("חשבון חדש")}</b></div>
      <div class="wiz">
        <nav class="card steps" aria-label=${s("שלבי האשף")}>${Ce.map((i,o)=>r`<button type="button" data-step-btn=${o+1} class="${o+1===e?"on":o+1<e?"done":""}" aria-current=${o+1===e?"step":"false"} ?disabled=${o+1>this.reached} @click=${()=>this.goStep(o+1)}><span class="n">${o+1<e?"✓":o+1}</span>${i}</button>`)}</nav>
        <div class="card col" style="gap:14px">
          <div class="pstep"><b>${s("שלב {n} מתוך 6",{n:e})}</b><span class="mut">${Ce[e-1]}</span><div class="bar"><i style="inline-size:${e/6*100}%"></i></div></div>
          <b class="h2 hide-phone" data-step-title>${Ce[e-1]}</b>
          ${a}
          <div class="wfoot">${e>1?r`<sw-button data-prev @click=${()=>this.step=e-1}>${s("הקודם")}</sw-button>`:r`<span></span>`}
            ${e<6?r`<sw-button variant="primary" data-next ?disabled=${!n} @click=${()=>this.next()}>${s("הבא")}</sw-button>`:r`<sw-button variant="primary" data-save ?disabled=${this.saving||!this.accName.trim()} @click=${()=>void this.save()}>${this.edit?s("שמירת שינויים"):this.afterSave==="draft"&&this.draftPossible()?s("שמירה והפקת טיוטה"):s("שמירה")}</sw-button>`}</div>
        </div>
      </div>
      ${this.renderTariffDialog()}${this.renderNumberDialog()}
    </div>`}};x([y()],_.prototype,"accountId",2);x([c()],_.prototype,"loadSt",2);x([c()],_.prototype,"step",2);x([c()],_.prototype,"reached",2);x([c()],_.prototype,"meters",2);x([c()],_.prototype,"tariffs",2);x([c()],_.prototype,"vat",2);x([c()],_.prototype,"settings",2);x([c()],_.prototype,"customers",2);x([c()],_.prototype,"nextNo",2);x([c()],_.prototype,"meterIds",2);x([c()],_.prototype,"tokens",2);x([c()],_.prototype,"formulaValid",2);x([c()],_.prototype,"formulaChecked",2);x([c()],_.prototype,"tariffId",2);x([c()],_.prototype,"tariffOpen",2);x([c()],_.prototype,"tf",2);x([c()],_.prototype,"months",2);x([c()],_.prototype,"anchorDay",2);x([c()],_.prototype,"anchorMonth",2);x([c()],_.prototype,"firstStart",2);x([c()],_.prototype,"custMode",2);x([c()],_.prototype,"custQ",2);x([c()],_.prototype,"existingId",2);x([c()],_.prototype,"nc",2);x([c()],_.prototype,"ncErr",2);x([c()],_.prototype,"accName",2);x([c()],_.prototype,"accNameErr",2);x([c()],_.prototype,"auto",2);x([c()],_.prototype,"afterSave",2);x([c()],_.prototype,"saving",2);x([c()],_.prototype,"saveErr",2);x([c()],_.prototype,"sampleResult",2);x([c()],_.prototype,"numOpen",2);x([c()],_.prototype,"numVal",2);x([c()],_.prototype,"numPct",2);x([c()],_.prototype,"numErr",2);_=x([D("elec-account-wizard")],_);var mi=Object.defineProperty,vi=Object.getOwnPropertyDescriptor,Wt=(t,e,a,n)=>{for(var i=n>1?void 0:n?vi(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&mi(e,a,i),i};let Lt=class extends Q{constructor(){super(...arguments),this.st="loading",this.all=[],this.filter="",this.month="",this.q=""}connectedCallback(){super.connectedCallback(),j().bills&&this.load()}async load(){this.st="loading";try{this.all=(await b().listBills()).items,this.st=this.all.length?"ready":"empty"}catch{this.st="error"}}render(){if(!j().bills)return r`<div class="page" data-elec="bills" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לחיובים"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="bills" data-state="loading">${at(7)}</div>`;if(this.st==="error")return r`<div class="page" data-elec="bills" data-state="error">${E("error","warning",s("לא ניתן לטעון את החיובים"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;if(this.st==="empty")return r`<div class="page" data-elec="bills" data-state="empty">${E("empty","bolt",s("אין חיובים עדיין"),{label:s("לחשבונות"),primary:!0,run:()=>X(M.accounts())})}</div>`;const t=i=>this.all.filter(o=>o.state===i).length,e=[...new Set(this.all.map(i=>i.period.to.slice(0,7)))].sort().reverse(),a=this.q.trim(),n=this.all.filter(i=>(!this.filter||i.state===this.filter)&&(!this.month||i.period.to.startsWith(this.month))&&(!a||(i.number??"").includes(a)||i.customer.name.includes(a)||i.account_name.includes(a)));return r`<div class="page" data-elec="bills" data-state=${n.length?"ready":"filtered-empty"}>
      <div class="row">
        <sw-segmented label=${s("סינון לפי מצב")} data-state-filter value=${this.filter} @change=${i=>this.filter=i.detail.value}
          .options=${[{value:"",label:s("הכול"),count:u(this.all.length),attrs:{"data-filter":""}},...ka.map(i=>({value:i,label:xa[i],count:u(t(i)),attrs:{"data-filter":i}}))]}></sw-segmented>
        <span class="sp"></span>
        <select data-month aria-label=${s("חודש")} style="inline-size:auto" @change=${i=>this.month=i.target.value}><option value="">${s("כל החודשים")}</option>${e.map(i=>r`<option value=${i} ?selected=${i===this.month}>${Ie(`${i}-01`)}</option>`)}</select>
        <input type="search" data-search aria-label=${s("חיפוש מספר או לקוח")} placeholder=${s("חיפוש מספר או לקוח")} .value=${this.q} @input=${i=>this.q=i.target.value} />
      </div>
      ${n.length?Ve(n,{phone:this.phone}):E("empty","search",s("לא נמצאו חיובים"))}
    </div>`}};Wt([c()],Lt.prototype,"st",2);Wt([c()],Lt.prototype,"all",2);Wt([c()],Lt.prototype,"filter",2);Wt([c()],Lt.prototype,"month",2);Wt([c()],Lt.prototype,"q",2);Lt=Wt([D("elec-bills-list")],Lt);var $i=Object.defineProperty,fi=Object.getOwnPropertyDescriptor,Ht=(t,e,a,n)=>{for(var i=n>1?void 0:n?fi(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&$i(e,a,i),i};const U=t=>r`<span class="n">${t}</span>`;let Et=class extends Ot{constructor(){super(...arguments),this.snapshot=null,this.watermark="",this.logo="",this.hash="",this.zoom=1}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(t=>{const e=t[0].contentRect.width-(t[0].contentRect.width<520?16:40),a=Math.max(.3,Math.min(1,e/794));Math.abs(a-this.zoom)>.005&&(this.zoom=a)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}render(){const t=this.snapshot;if(!t)return d;const e=t.business,a=t.totals.total,n=t.bill.due_date??t.bill.expected_due_date,i=t.lines.length>1,o=new Set(t.lines.map(m=>`${m.from}|${m.to}`)).size,l=m=>m==="interpolated"||m==="carried",p=t.meters.filter(m=>l(m.start.kind)||m.end.kind!=="reading"&&m.end.reading_kwh!==null),$=t.history.previous.filter(m=>m.kwh!==null),h=$.length?$[$.length-1].kwh:null,v=this.watermark;return r`<div class="wrap" data-elec-paper>
      <div class="box" style="zoom:${this.zoom}">
        <div class="paper" style="--acc:${e.accent_color||"#2767ed"}">
          ${v?r`<div class="wm ${v==="בוטל"?"void":""}" data-watermark>${v}</div>`:d}
          <div class="ph">
            <div>
              <h1>${t.doc.title_he}</h1>
              <div class="sub">${t.doc.subtitle_he}</div>
              <div style="margin-block-start:12px">
                <b>מספר:</b> ${U(t.bill.number??"-")}${t.bill.replaces?r` <span class="sub">(מחליף את ${U(t.bill.replaces.number)})</span>`:d}<br />
                <b>תאריך הפקה:</b> ${U(S(t.bill.issue_date??"")||"-")}
              </div>
            </div>
            <div class="biz">
              <div class="info">
                <b>${e.name}</b><br />
                <span class="sub">${e.registration_no?r`ח.פ. ${U(e.registration_no)}<br />`:d}${e.address}<br />${e.phone?U(e.phone):d}${e.phone&&e.email?" · ":""}${e.email?U(e.email):d}</span>
              </div>
              <div class="logo">${this.logo?r`<img src=${this.logo} alt="" />`:(e.name||"A").slice(0,2)}</div>
            </div>
          </div>
          <div class="two">
            <div class="bx"><b>לכבוד</b><br />${t.customer.name}<br />${t.customer.address}<br />מספר לקוח: ${U(t.customer.customer_number)}<br />חשבון: ${t.account.name}</div>
            <div class="bx">
              <b>תקופת החיוב</b><br />מתאריך ${U(S(t.period.from))} עד תאריך ${U(S(t.period.to))} (${t.period.days} ימים)<br />תעריף: ${t.account.tariff.name}<br />לתשלום עד: ${U(S(n??""))}
            </div>
          </div>
          <div class="big"><span>סה״כ לתשלום</span><b class="n">${k(a)} ₪</b></div>
          <table>
            <thead><tr><th>מונה</th><th class="r">קריאה בתחילת התקופה</th><th class="r">קריאה בסוף התקופה</th><th class="r">צריכה (קוט״ש)</th><th class="r">חלק</th><th class="r">לחיוב (קוט״ש)</th></tr></thead>
            <tbody>
              ${t.meters.map(m=>r`<tr data-meter=${m.meter_id}><td>${m.name}</td><td class="r" data-start-kind=${m.start.kind}>${jt(m.start.reading_kwh)}</td><td class="r">${jt(m.end.reading_kwh)}</td><td class="r">${k(m.consumption_kwh)}</td><td class="r">${Ea(Number(m.coefficient))}</td><td class="r">${k(m.contribution_kwh)}</td></tr>`)}
            </tbody>
          </table>
          <div class="note">נוסחת החשבון: ${t.account.formula.sentence_he}</div>
          ${p.map(m=>{const g=m.end.kind!=="reading"&&m.end.reading_kwh!==null,B=l(m.start.kind);return r`<div class="note">${m.name}: ${g?r`קריאת סוף התקופה ב-${U(ys(m.end.at,t.period.timezone))}`:""}${B&&g?"; ":""}${B?r`קריאת תחילת התקופה לפי ${_s(m.start.kind)}`:""}.</div>`})}
          <table>
            <thead><tr><th>פירוט</th><th class="r">כמות</th><th class="r">מחיר ליחידה</th><th class="r">סכום (₪)</th></tr></thead>
            <tbody>
              ${t.lines.map(m=>r`<tr data-line=${m.band?.id??"flat"}><td>צריכת חשמל${m.band?` - ${m.band.name_he}${m.season?` (${m.season.name_he})`:""}`:""}${(m.band?o>1:i)?r` (${U(S(m.from))} - ${U(S(m.to))})`:d}</td><td class="r">${k(m.kwh)} קוט״ש</td><td class="r">${F(m.unit_price_ex_vat)} ₪</td><td class="r">${k(m.amount_ex_vat)}</td></tr>`)}
              <tr><td>סה״כ לפני מע״מ</td><td></td><td></td><td class="r">${k(t.totals.amount_ex_vat)}</td></tr>
              <tr><td>מע״מ ${U(t.totals.vat_breakdown[0]?.rate_percent??t.lines[0]?.vat_rate_percent??"")}%</td><td></td><td></td><td class="r">${k(t.totals.vat_amount)}</td></tr>
              <tr class="tot"><td>סה״כ לתשלום</td><td></td><td></td><td class="r">${k(a)} ₪</td></tr>
            </tbody>
          </table>
          <div class="note">
            ${t.totals.price_mode_note_he?r`${t.totals.price_mode_note_he}; המחיר לפני מע״מ מוצג מעוגל ל-4 ספרות. `:d}הקריאות הן קריאות מונה מצטברות שנמדדו בפועל; הצריכה של כל מונה היא קריאת הסוף פחות קריאת הפתיחה.${h?r` צריכה בתקופה הקודמת: ${U(k(h))} קוט״ש.`:d}
          </div>
          ${t.notes.map(m=>r`<div class="note" data-note=${m.code}>${m.text_he}</div>`)}
          ${e.footer_note?r`<div class="note"><b>הערות:</b> ${e.footer_note}</div>`:d}
          ${qe(t.history)?r`<div class="sec">השוואת צריכה</div><elec-chart print .series=${t.history} table="visible" .height=${190}></elec-chart>`:d}
          <div class="spacer"></div>
          <div class="foot"><span>הופק ב-SmplWise Arx</span><span>עמוד 1 מתוך 1</span><span class="n">${this.hash}</span></div>
        </div>
      </div>
    </div>`}};Et.styles=it`
    ${qs}
    /* COLOR-LITERAL-B-2480: the print-paper inks this sheet repeats, one value in both schemes (the paper is white whatever the UI) */
    :host { --bp-white: #fff; --bp-ink: #1d2433; --bp-ink-2: #5b6a85; --bp-rule: #e3e7ef; }
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
      background: var(--bp-white);
      color: var(--bp-ink);
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
      color: var(--bp-ink);
    }
    .sub {
      color: var(--bp-ink-2);
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
      background: linear-gradient(135deg, var(--acc), color-mix(in srgb, var(--acc) 60%, var(--bp-white)));
      color: var(--bp-white);
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
      background: var(--bp-white);
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
      background: color-mix(in srgb, var(--acc) 9%, var(--bp-white));
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
      color: var(--bp-ink);
    }
    td {
      border-block-end: 1px solid var(--bp-rule);
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
      border-block-start: 2px solid var(--bp-ink);
      border-block-end: 0;
    }
    .note {
      margin-block-start: 12px;
      color: var(--bp-ink-2);
      font-size: 11.5px;
    }
    .note b {
      color: var(--bp-ink);
    }
    .sec {
      margin-block-start: 18px;
      font-weight: 700;
      color: var(--bp-ink);
    }
    .foot {
      margin-block-start: auto;
      padding-block-start: 8px;
      border-block-start: 1px solid var(--bp-rule);
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
  `;Ht([y({attribute:!1})],Et.prototype,"snapshot",2);Ht([y()],Et.prototype,"watermark",2);Ht([y()],Et.prototype,"logo",2);Ht([y()],Et.prototype,"hash",2);Ht([c()],Et.prototype,"zoom",2);Et=Ht([D("elec-bill-paper")],Et);const Xt=t=>`energy/meters/${encodeURIComponent(t)}`,bi={log:t=>Us(`${Xt(t)}/manual-readings`),async addReading(t,e){const a=await re(`${Xt(t)}/manual-readings`,e);return{reading:a.reading,log:a.log??null}},undoReading:(t,e,a)=>re(`${Xt(t)}/manual-readings/${encodeURIComponent(e)}/undo`,a?{reason:a}:{}),async addCalibration(t,e){const a=await re(`${Xt(t)}/calibrations`,e);return{calibration:a.calibration,log:a.log??null}},undoCalibration:(t,e,a)=>re(`${Xt(t)}/calibrations/${encodeURIComponent(e)}/undo`,a?{reason:a}:{})},gi={kWh:1e3,Wh:1,MWh:1e6},zs={open_gap:P("הקריאה השלימה את הפער מאז הדיווח האחרון. הצריכה עד הקריאה חולקה לפי זמן."),closed_gap:P("הקריאה חילקה מחדש את הצריכה בפער הדיווח. הסכום הכולל לא השתנה."),head_gap:P("הקריאה נקבעה כקריאת פתיחה לפני הקריאה הראשונה של המונה. הצריכה עד הקריאה הראשונה חולקה לפי זמן."),reported:P("המונה דיווח בזמן הזה. הקריאה נשמרה להשוואה בלבד."),outside_counter:P("הקריאה שונה מערך המונה במערכת. היא נשמרה להשוואה; לתיקון קבוע אפשר להגדיר כיול."),no_counter_data:P("אין במערכת קריאות סביב הזמן הזה. הקריאה נשמרה להשוואה בלבד."),counter_events:P("בזמן הזה היה איפוס או קפיצה במונה. הקריאה נשמרה להשוואה בלבד."),implausible:P("הקריאה גבוהה מהסביר להספק המרבי של המונה. היא נשמרה להשוואה בלבד."),billed:P("התקופה הזו כבר חויבה. הקריאה נשמרה להשוואה בלבד.")};function wi(t,e=0){const n={meter_id:t,items:[],calibrations:[],calibration:{factor:"1.0",offset_kwh:0,calibration_id:null,effective_date:null,identity:!0},suggestion:null,billed_until:"2026-09-30T21:00:00Z",first_calibration_date:"2026-10-01",undo_window_hours:24},i=(o,l,p,$,h,v,m={})=>({id:o,read_at:l,value_kwh:p,value_wh:Math.round(p*1e3),typed_value:String(p),typed_unit:"kWh",system_kwh:$,system_exact:$!=null,deviation_kwh:$==null?null:Math.round((p-$)*1e3)/1e3,effect:h,effect_reason:v,message:zs[v],note:null,created_at:l,created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!1,undo_until:null,...m});return t==="m1"&&(n.items=[i("r2","2026-10-01T06:10:00Z",247215.6,245830.1,"record","reported"),i("r1","2026-09-01T06:05:00Z",230981,229712.4,"record","reported",{note:"קריאה בלוח הראשי"})],n.calibrations=[{id:"c1",effective_date:"2026-10-02",effective_from:"2026-10-01T21:00:00Z",factor:"1.0",offset_kwh:1385.5,anchor_reading_id:"r2",note:null,in_force:!0,created_at:"2026-10-01T06:20:00Z",created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!1,undo_until:null}],n.calibration={factor:"1.0",offset_kwh:1385.5,calibration_id:"c1",effective_date:"2026-10-02",identity:!1},n.suggestion={factor:"1.0073",from_reading_id:"r1",to_reading_id:"r2",anchor_reading_id:"r2"}),t==="m8"&&(n.items=[i("r3","2026-10-04T17:30:00Z",e||18131.4,null,"allocation","open_gap",{created_at:Va,can_undo:!0,undo_until:"2026-10-05T18:49:00Z"})]),n}const Se=new Map,It=t=>new Promise(e=>setTimeout(()=>e(t),60)),Mt=t=>JSON.parse(JSON.stringify(t));function xt(t,e,a,n={}){throw new Re(t,{code:e,user_message:a,retryable:!1,correlation_id:"demo",details:n})}const Qt=t=>(Se.has(t)||Se.set(t,wi(t)),Se.get(t)),yi={log:t=>It(Mt(Qt(t))),addReading(t,e){const a=Qt(t),n=Number(e.value)*gi[e.unit]/1e3;if(!Number.isFinite(n)||n<0)return xt(422,"validation",P("הערך אינו מספר."),{fields:["value"]});if(Date.parse(e.read_at)>Date.now()+3e5)return xt(422,"validation",P("זמן הקריאה בעתיד."),{fields:["read_at"]});const o=a.items.filter(h=>!h.voided_at).filter(h=>h.read_at<e.read_at).sort((h,v)=>h.read_at<v.read_at?1:-1)[0];if(o&&n<o.value_kwh)return xt(422,"reading_not_monotonic",P("הקריאה נמוכה מקריאה ידנית קודמת של אותו מונה."),{fields:["value"]});const l=t==="m8"?null:1e3,p=t==="m8"?"open_gap":"reported",$={id:e.dry_run?null:`r${Date.now()}`,read_at:e.read_at,value_kwh:n,value_wh:Math.round(n*1e3),typed_value:e.value,typed_unit:e.unit,system_kwh:l,system_exact:l!=null,deviation_kwh:l==null?null:Math.round((n-l)*1e3)/1e3,effect:t==="m8"?"allocation":"record",effect_reason:p,message:zs[p],note:e.note??null,created_at:new Date().toISOString(),created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!0,undo_until:new Date(Date.now()+864e5).toISOString()};return e.dry_run?It({reading:$,log:null}):(a.items=[$,...a.items].sort((h,v)=>h.read_at<v.read_at?1:-1),It({reading:Mt($),log:Mt(a)}))},undoReading(t,e,a){const n=Qt(t),i=n.items.find(o=>o.id===e);return i?i.can_undo?(Object.assign(i,{voided_at:new Date().toISOString(),voided_by_name:"דנה",void_reason:a??null,can_undo:!1}),It(Mt(n))):xt(409,"undo_window_passed",P("עבר הזמן שבו אפשר לבטל את הקריאה (24 שעות).")):xt(404,"not_found",P("הקריאה לא נמצאה."))},addCalibration(t,e){const a=Qt(t),n=Number(e.factor);if(!Number.isFinite(n)||n<.5||n>2)return xt(422,"validation",P("המקדם חייב להיות בין 0.5 ל-2."),{fields:["factor"]});if(a.first_calibration_date&&e.effective_date<a.first_calibration_date)return xt(409,"calibration_billed",P("התקופה הזו כבר חויבה. אפשר לכייל רק מ-{date} והלאה.",{date:a.first_calibration_date.split("-").reverse().join(".")}));const i=a.items.find(p=>p.id===e.anchor_reading_id),o=i&&i.system_kwh!=null?Math.round((i.value_kwh-n*i.system_kwh)*1e3)/1e3:Number(e.offset_kwh??0),l={id:e.dry_run?null:`c${Date.now()}`,effective_date:e.effective_date,effective_from:`${e.effective_date}T00:00:00Z`,factor:String(n),offset_kwh:o,anchor_reading_id:e.anchor_reading_id??null,note:e.note??null,in_force:!1,created_at:new Date().toISOString(),created_by_name:"דנה",voided_at:null,voided_by_name:null,void_reason:null,can_undo:!0,undo_until:new Date(Date.now()+864e5).toISOString()};return e.dry_run?It({calibration:l,log:null}):(a.calibrations=[l,...a.calibrations],It({calibration:Mt(l),log:Mt(a)}))},undoCalibration(t,e,a){const n=Qt(t),i=n.calibrations.find(o=>o.id===e);return i?(Object.assign(i,{voided_at:new Date().toISOString(),voided_by_name:"דנה",void_reason:a??null,can_undo:!1,in_force:!1}),It(Mt(n))):xt(404,"not_found",P("הכיול לא נמצא."))}},ee=()=>Vs()?bi:yi,_i=t=>ee().log(t),Me=(t,e)=>ee().addReading(t,e),ki=(t,e,a)=>ee().undoReading(t,e,a),ds=(t,e)=>ee().addCalibration(t,e),xi=(t,e,a)=>ee().undoCalibration(t,e,a);function ce(t){const e=t.trim().replace(/[\s ]/g,"").replace(/,(?=\d{3}(\D|$))/g,"").replace(",",".");return/^\d+(\.\d+)?$/.test(e)?e:null}function Ei(t){const e=t.trim().replace(",",".");if(!/^\d+(\.\d{1,6})?$/.test(e))return null;const a=Number(e);return a>=.5&&a<=2?e:null}function Ci(t){if(!t)return null;const e=new Date(t);return Number.isNaN(e.getTime())?null:e.toISOString()}function Oe(t){const e=a=>String(a).padStart(2,"0");return`${t.getFullYear()}-${e(t.getMonth()+1)}-${e(t.getDate())}T${e(t.getHours())}:${e(t.getMinutes())}`}const Si={open_gap:P("השלימה פער"),closed_gap:P("חילקה פער"),head_gap:P("קריאת פתיחה"),reported:P("להשוואה"),outside_counter:P("להשוואה"),no_counter_data:P("להשוואה"),counter_events:P("להשוואה"),implausible:P("להשוואה"),billed:P("להשוואה")};var Oi=Object.defineProperty,Pi=Object.getOwnPropertyDescriptor,q=(t,e,a,n)=>{for(var i=n>1?void 0:n?Pi(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Oi(e,a,i),i};const cs={email:s("דוא״ל"),hand:s("מסירה ידנית"),other:s("אחר")};let L=class extends Q{constructor(){super(...arguments),this.billId="",this.st="loading",this.bill=null,this.events=[],this.dlg="",this.busy=!1,this.error="",this.pdfFail=null,this.reason="",this.reasonTouched=!1,this.date="",this.how="email",this.text="",this.openingMeter=null,this.openingInfo="",this.daily=!1,this.loaded=""}willUpdate(t){t.has("billId")&&this.billId&&this.loaded!==this.billId&&(this.loaded=this.billId,this.load())}async load(){this.st="loading",this.pdfFail=null;try{const[t,e]=await Promise.all([b().getBill(this.billId),b().billEvents(this.billId).catch(()=>[])]);this.bill=t,this.events=e,this.st="ready"}catch(t){this.error=T(t),this.st=he(t)==="forbidden"?"forbidden":"error"}}async refreshEvents(){this.events=await b().billEvents(this.billId).catch(()=>this.events)}open(t){this.dlg=t,this.error="",this.reason="",this.reasonTouched=!1,this.text="",this.date=st(),this.how="email"}close(){this.dlg=""}async act(t,e){if(!this.busy){this.busy=!0,this.error="";try{const a=await t();a&&(this.bill=a),this.close(),await this.refreshEvents(),e?.(a)}catch(a){this.error=T(a)}finally{this.busy=!1}}}issue(){const t=this.bill;this.act(()=>b().issueBill(t),()=>{this.pdf("check")})}async pdf(t){const e=this.bill;this.pdfFail=null;try{const a=await b().fetchPdf(e.id);if(e.state!=="draft"&&e.pdf&&e.pdf.state!=="stored"&&(this.bill=await b().getBill(e.id).catch(()=>this.bill)),t==="check")return;const n=URL.createObjectURL(a);if(t==="view")window.open(n,"_blank","noopener");else{const i=document.createElement("a");i.href=n,i.download=`${e.number??`draft-${e.id}`}.pdf`,i.click()}window.setTimeout(()=>URL.revokeObjectURL(n),3e4)}catch(a){this.pdfFail={code:he(a),text:T(a)}}}btn(t,e){switch(t){case"issue":return r`<sw-button variant="primary" data-act="issue" @click=${()=>this.open("issue")}>${s("הנפקה")}</sw-button>`;case"sent":return r`<sw-button variant=${e.state==="issued"?"primary":"secondary"} data-act="sent" @click=${()=>this.open("sent")}>${s("סימון כנשלח")}</sw-button>`;case"paid":return r`<sw-button variant=${e.state==="sent"?"primary":"secondary"} data-act="paid" @click=${()=>this.open("paid")}>${s("סימון כשולם")}</sw-button>`;case"recalculate":return r`<sw-button data-act="recalculate" ?disabled=${this.busy} @click=${()=>void this.act(()=>b().recalcBill(e))}>${s("חישוב מחדש")}</sw-button>`;case"pdf":return e.state==="draft"?r`<sw-button data-act="pdf" @click=${()=>void this.pdf("view")}>${s("תצוגת PDF")}</sw-button>`:r`<sw-button data-act="pdf" @click=${()=>void this.pdf("download")}>${s("הורדת PDF")}</sw-button>`;case"correct":return r`<sw-button data-act="correct" @click=${()=>this.open("correct")}>${s("תיקון")}</sw-button>`;case"void":return r`<sw-button variant="danger" data-act="void" @click=${()=>this.open("void")}>${s("ביטול")}</sw-button>`;case"delete":return r`<sw-button variant="danger" data-act="delete" @click=${()=>this.open("delete")}>${s("מחיקת טיוטה")}</sw-button>`;default:return d}}render(){if(!j().bills)return r`<div class="page" data-elec="bill" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לחיובים"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="bill" data-state="loading">${at(4)}</div>`;if(this.st!=="ready"||!this.bill)return r`<div class="page" data-elec="bill" data-state=${this.st}><div class="row"><a class="btn ghost sm" href=${N.bills()}>${s("→ חיובים")}</a></div>${E(this.st==="forbidden"?"forbidden":"error",this.st==="forbidden"?"lock":"warning",this.error||s("לא ניתן לטעון את החיוב"),this.st==="error"?{label:s("נסה שוב"),run:()=>void this.load()}:void 0)}</div>`;const t=this.bill,e=t.snapshot,a=t.state==="draft"?"טיוטה":t.state==="void"?"בוטל":"",n=r`${t.actions.map(l=>this.btn(l,t))}`,i=t.state==="draft"?e.notes.filter(l=>l.code==="meter_not_reporting"||l.code==="carried_in"):[],o=r`<div class="card"><div class="hd"><b class="h3">${s("פרטים")}</b></div><dl class="kv" data-bill-details>
        <dt>${s("חשבון")}</dt><dd><a class="lnk" href=${N.account(t.account_id)}>${t.account_name}</a></dd><dt>${s("לקוח")}</dt><dd>${t.customer.name}</dd>
        <dt>${s("תקופה")}</dt><dd>${u(S(t.period.from))} - ${u(S(t.period.to))}</dd>
        ${t.issue_date?r`<dt>${s("הונפק")}</dt><dd>${u(S(t.issue_date))}</dd>`:d}${t.due_date?r`<dt>${s("לתשלום עד")}</dt><dd>${u(S(t.due_date))}</dd>`:d}
        ${t.sent?r`<dt>${s("נשלח")}</dt><dd><span class="num" data-sent-at>${S(t.sent.at,e.period.timezone)}</span> · ${cs[t.sent.how]}</dd>`:d}${t.paid?r`<dt>${s("שולם")}</dt><dd><span class="num" data-paid-at>${S(t.paid.at,e.period.timezone)}</span>${t.paid.reference?r` · ${u(t.paid.reference)}`:d}</dd>`:d}
        <dt>${s("מקור")}</dt><dd>${t.origin==="auto"?s("נוצר אוטומטית"):s("נוצר ידנית")}</dd></dl></div>
      ${this.openingCard(t)}
      ${this.touCard(e)}
      <div class="card"><div class="hd"><b class="h3">${s("יומן")}</b></div><div class="list" data-bill-log>${this.events.map(l=>r`<div class="row" style="align-items:flex-start;flex-wrap:nowrap"><span class="num mut" style="min-inline-size:112px">${ys(l.at,e.period.timezone)}</span><span>${l.text}</span></div>`)}</div></div>`;return r`<div class="page" data-elec="bill" data-state="ready" data-bill-state=${t.state} data-bill-id=${t.id}>
      <div class="row"><a class="btn ghost sm" href=${N.bills()} data-back>${s("→ חיובים")}</a></div>
      <div class="row"><b class="h2 num" data-bill-number>${t.number??s("טיוטה")}</b>${Ae(t.state)}
        ${t.replaces_bill_id&&e.bill.replaces?r`<span class="mut">${s("מחליף את")} <a class="lnk num" href=${N.bill(t.replaces_bill_id)}>${e.bill.replaces.number}</a></span>`:d}
        ${t.replaced_by_bill_id?r`<span class="mut">${s("הוחלף בחיוב")} <a class="lnk" href=${N.bill(t.replaced_by_bill_id)}>${s("המתוקן")}</a></span>`:d}
        <span class="sp"></span>${this.phone?d:n}</div>
      ${this.phone?r`<div class="row" data-actions>${n}</div>`:d}
      ${this.pdfNotice(t)}
      ${t.state==="void"&&t.void?C("err",r`<b>${s("בוטל:")}</b> ${t.void.reason}`):d}
      ${i.map(l=>C("warn",l.text_he))}
      <div class="cols side-l"><div style="min-inline-size:0"><elec-bill-paper .snapshot=${e} watermark=${a} .hash=${(t.snapshot_sha256??"").slice(0,12).replace(/(.{4})/g,"$1 ").trim()} .logo=${this.logoSrc()}></elec-bill-paper></div><div class="col">${o}</div></div>
      ${this.daily&&e.tou?this.dailyTable(e.tou):d}
      ${this.dialogs(t)}
    </div>`}openingCard(t){const e=t.snapshot.period.start_utc,a=t.snapshot.meters.filter(n=>n.start.kind==="first_reading"||n.start.kind==="none");return t.state!=="draft"||!e||!a.length||!j().manage?d:r`<div class="card" data-card="opening"><div class="hd"><b class="h3">${s("קריאת פתיחה")}</b></div>
      <div class="list">${a.map(n=>r`<div class="row" data-opening-meter=${n.meter_id} style="flex-wrap:nowrap"><div class="grow"><div class="b">${n.name}</div><div class="mut">${n.start.reading_kwh===null?jt(null):r`${u(jt(n.start.reading_kwh))} · ${_s(n.start.kind)}`}</div></div>
        <sw-button size="sm" data-opening-enter @click=${()=>this.openOpening(n)}>${s("הזנה")}</sw-button></div>`)}</div></div>`}openOpening(t){this.open("opening"),this.openingMeter=t,this.openingInfo=""}async saveOpening(){const t=this.bill,e=this.openingMeter,a=ce(this.text),n=t.snapshot.period.start_utc;if(!(!e||a===null||!n||this.busy)){this.busy=!0,this.error="";try{const i=await Me(e.meter_id,{read_at:n,value:a,unit:"kWh",note:this.reason.trim()||void 0});if(i.reading.effect!=="allocation"){this.openingInfo=i.reading.message;return}this.bill=await b().recalcBill(t),this.close(),await this.refreshEvents()}catch(i){this.error=T(i)}finally{this.busy=!1}}}touCard(t){const e=t.tou;return e?r`<div class="card" data-card="tou"><div class="hd"><b class="h3">${s("לפי שעות")}</b><span class="sp"></span>
        <button type="button" class="btn ghost sm" data-tou-daily aria-expanded=${this.daily?"true":"false"} @click=${()=>this.daily=!this.daily}>${this.daily?s("הסתרת הפירוט היומי"):s("פירוט יומי")}</button></div>
      <sw-table bare static-rows class="t" data-tou-bands .columns=${this.bandColumns(e)} .rows=${e.by_band}
        .rowAttrs=${a=>({"data-band":a.band.id})}></sw-table>
      ${e.special_days.some(a=>a.kind!=="regular")?r`<div class="mut" style="margin-block-start:8px">${s("ימים מיוחדים:")} ${e.special_days.filter(a=>a.kind!=="regular").map(a=>`${S(a.date)} ${a.name_he}`).join(", ")}</div>`:d}</div>`:d}bandColumns(t){return[{key:"band",label:s("פס"),render:e=>r`<b>${A("bands",e.band,t.names_en)}</b>`},{key:"hours",label:s("שעות"),kind:"num",render:e=>k(e.hours)},{key:"kwh",label:s("קוט״ש"),kind:"num",render:e=>k(e.kwh)},{key:"amount",label:s("לפני מע״מ"),kind:"num",render:e=>`${k(e.amount_ex_vat)} ₪`}]}dailyColumns(t,e){return[{key:"date",label:s("תאריך"),render:a=>r`<span class="num">${S(a.date)}</span>`},{key:"type",label:s("סוג יום"),render:a=>r`${t.names.day_types[a.day_type]!==void 0?A("day_types",{id:a.day_type,name_he:t.names.day_types[a.day_type]},t.names_en):a.day_type}${a.special?r` <span class="chip" data-tone="info" data-nodot>${a.special.name_he}</span>`:d}`},...e.map(a=>({key:`band-${a}`,label:A("bands",{id:a,name_he:t.names.bands[a]},t.names_en),kind:"num",render:n=>{const i=n.bands.find(o=>o.band===a);return i?k(i.kwh):""}})),{key:"total",label:s("סה״כ"),kind:"num",render:a=>r`<b>${k(a.kwh)}</b>`}]}dailyTable(t){const a=Object.keys(t.names.bands).filter(n=>t.daily.some(i=>i.bands.some(o=>o.band===n)));return r`<div class="card flush" data-tou-daily-table><div class="hd"><b class="h3">${s("פירוט יומי לפי שעות (קוט״ש)")}</b><span class="sp"></span><span class="mut">${s("לעיון; כל ערך מעוגל בנפרד")}</span></div>
      <sw-table bare static-rows class="t" .columns=${this.dailyColumns(t,a)} .rows=${t.daily}
        .rowAttrs=${n=>({"data-day":String(n.date)})}></sw-table></div>`}pdfNotice(t){const e=t.pdf?.state,a=t.pdf?.error_code||"pdf_render_failed",n=this.pdfFail??(e==="failed"?{code:a,text:xe[a]??xe.pdf_render_failed}:e==="unavailable"?{code:"pdf_unavailable",text:xe.pdf_unavailable}:null);if(!n)return d;const i=Ca.includes(n.code),o=n.code==="pdf_unavailable"?"unavailable":"failed";return r`<div class="alert ${i?"err":"warn"}" role="alert" data-pdf-error data-pdf-state=${o} data-pdf-code=${n.code}><span class="x" aria-hidden="true">!</span><div>${n.text}</div>${i?r`<sw-button size="sm" data-pdf-retry @click=${()=>void this.pdf(t.state==="draft"?"view":"download")}>${s("הפקת PDF מחדש")}</sw-button>`:d}</div>`}logoSrc(){const t=this.bill.snapshot.business.logo;return t?b().logoUrl(t.sha256):""}dialogs(t){const e=this.error?C("err",this.error):d,a=(o=s("ביטול"))=>r`<sw-button slot="actions" @click=${()=>this.close()}>${o}</sw-button>`,n=`${Sa(t.number??"")}-${t.revision+1}`,i=!this.reason.trim();return r`
      <elec-dialog heading=${s("הנפקת חיוב")} ?open=${this.dlg==="issue"} data-dialog="issue" @close=${()=>this.close()}>
        <div>${s("החיוב יקבל מספר. אחרי ההנפקה אי אפשר לערוך אותו, רק לבטל או לתקן.")}</div>
        <dl class="kv"><dt>${s("חשבון")}</dt><dd>${t.account_name}</dd><dt>${s("תקופה")}</dt><dd>${u(vt(t.period.from,t.period.to))}</dd><dt>${s("סה״כ לתשלום")}</dt><dd>${u(Be(t.total))}</dd></dl>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>this.issue()}>${s("הנפקה")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("ביטול חיוב {no}",{no:t.number??""})} ?open=${this.dlg==="void"} data-dialog="void" @close=${()=>this.close()}>
        <div>${s("החיוב יישאר ברשימה במצב בוטל. המספר לא ישמש שוב.")}</div>
        <div class="fld"><label for="vr">${s("סיבת הביטול")}</label>
          <textarea id="vr" data-reason class="${i&&this.reasonTouched?"err":""}" aria-required="true" placeholder=${s("חובה")} .value=${this.reason} @input=${o=>{this.reason=o.target.value,this.reasonTouched=!0}} @blur=${()=>this.reasonTouched=!0}></textarea>
          ${i&&this.reasonTouched?r`<div class="msg" role="alert" data-reason-error>${s("צריך לכתוב סיבה")}</div>`:d}</div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy||i} @click=${()=>void this.act(()=>b().voidBill(t.id,this.reason))}>${s("ביטול החיוב")}</sw-button>${a(s("חזרה"))}
      </elec-dialog>
      <elec-dialog heading=${s("תיקון חיוב")} ?open=${this.dlg==="correct"} data-dialog="correct" @close=${()=>this.close()}>
        <div>${s("תיווצר טיוטה מתוקנת")}${t.number?r` ${s("עם המספר")} <b class="num">${n}</b>`:""}. ${s("כשהיא תונפק, החיוב")} ${u(t.number??"")} ${s("יבוטל אוטומטית.")}</div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{const o=await b().correctBill(t.id);X(M.bill(o.id)),this.billId=o.id})}>${s("יצירת טיוטה מתוקנת")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("סימון כנשלח")} ?open=${this.dlg==="sent"} data-dialog="sent" @close=${()=>this.close()}>
        <div class="form">
          <div class="fld"><label for="sd">${s("תאריך משלוח")}</label><input id="sd" type="date" lang=${ht()} class="ltr ${V(this.date)?"":"err"}" data-date .value=${this.date} @change=${o=>this.date=o.target.value} /></div>
          <div class="fld"><span class="lbl">${s("אופן משלוח")}</span><sw-segmented label=${s("אופן משלוח")} value=${this.how} @change=${o=>this.how=o.detail.value}
        .options=${["email","hand","other"].map(o=>({value:o,label:cs[o],attrs:{"data-how":o}}))}></sw-segmented></div>
        </div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy||!V(this.date)} @click=${()=>void this.act(()=>b().markSent(t.id,{at:this.date,how:this.how,note:"",row_version:t.row_version}))}>${s("שמירה")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("סימון כשולם")} ?open=${this.dlg==="paid"} data-dialog="paid" @close=${()=>this.close()}>
        <div class="form">
          <div class="fld"><label for="pd">${s("תאריך תשלום")}</label><input id="pd" type="date" lang=${ht()} class="ltr ${V(this.date)?"":"err"}" data-date .value=${this.date} @change=${o=>this.date=o.target.value} /></div>
          <div class="fld"><label for="pr">${s("אסמכתה (לא חובה)")}</label><input id="pr" class="ltr" data-reference placeholder=${s("לא חובה")} .value=${this.text} @input=${o=>this.text=o.target.value} /></div>
        </div>${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy||!V(this.date)} @click=${()=>void this.act(()=>b().markPaid(t.id,{at:this.date,reference:this.text.trim(),row_version:t.row_version}))}>${s("שמירה")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("קריאת פתיחה - {name}",{name:this.openingMeter?.name??""})} ?open=${this.dlg==="opening"} data-dialog="opening" @close=${()=>this.close()}>
        <div>${s("מה הראה המונה ב-")}${u(S(t.period.from))} ${s("בשעה 00:00. הצריכה מאז ועד הקריאה הראשונה שנקלטה תתווסף לחיוב.")}</div>
        <div class="form">
          <div class="fld"><label for="ov">${s("קריאה (קוט״ש)")}</label><input id="ov" class="ltr ${this.text&&ce(this.text)===null?"err":""}" inputmode="decimal" data-opening-value .value=${this.text} @input=${o=>this.text=o.target.value} /></div>
          <div class="fld"><label for="on">${s("הערה (לא חובה)")}</label><input id="on" data-opening-note placeholder=${s("לא חובה")} .value=${this.reason} @input=${o=>this.reason=o.target.value} /></div>
        </div>${this.openingInfo?C("warn",this.openingInfo):d}${e}
        <sw-button variant="primary" slot="actions" data-confirm ?disabled=${this.busy||ce(this.text)===null} @click=${()=>void this.saveOpening()}>${s("שמירה וחישוב מחדש")}</sw-button>${a()}
      </elec-dialog>
      <elec-dialog heading=${s("מחיקת טיוטה")} ?open=${this.dlg==="delete"} data-dialog="delete" @close=${()=>this.close()}>
        <div>${s("הטיוטה תימחק. אפשר ליצור אחרת מעמוד החשבון.")}</div>${e}
        <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.act(async()=>{await b().deleteDraft(t),X(M.bills())})}>${s("מחיקה")}</sw-button>${a()}
      </elec-dialog>`}};q([y()],L.prototype,"billId",2);q([c()],L.prototype,"st",2);q([c()],L.prototype,"bill",2);q([c()],L.prototype,"events",2);q([c()],L.prototype,"dlg",2);q([c()],L.prototype,"busy",2);q([c()],L.prototype,"error",2);q([c()],L.prototype,"pdfFail",2);q([c()],L.prototype,"reason",2);q([c()],L.prototype,"reasonTouched",2);q([c()],L.prototype,"date",2);q([c()],L.prototype,"how",2);q([c()],L.prototype,"text",2);q([c()],L.prototype,"openingMeter",2);q([c()],L.prototype,"openingInfo",2);q([c()],L.prototype,"daily",2);L=q([D("elec-bill-page")],L);var zi=Object.defineProperty,Ni=Object.getOwnPropertyDescriptor,et=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ni(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&zi(e,a,i),i};let W=class extends Q{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams,this.st="loading",this.list=[],this.q="",this.card=null,this.cardSt="loading",this.form=ts(),this.errs={},this.busy=!1,this.error="",this.confirmDel=!1,this.shown=""}connectedCallback(){super.connectedCallback(),j().bills&&this.loadList()}willUpdate(t){if(!t.has("segments"))return;const e=this.segments[0]??"";e!==this.shown&&(this.shown=e,this.error="",this.errs={},this.confirmDel=!1,e?e==="new"?(this.card=null,this.cardSt="ready",this.form=ts(),b().nextCustomerNumber().then(a=>this.form={...this.form,customer_number:a}).catch(()=>{})):this.loadCard(e):this.card=null)}async loadList(){this.st="loading";try{this.list=await b().listCustomers(),this.st=this.list.length?"ready":"empty"}catch{this.st="error"}}async loadCard(t){this.cardSt="loading";try{const e=await b().getCustomer(t);this.card=e,this.form=Oa(e),this.cardSt="ready"}catch{this.cardSt="error"}}close(){X(M.customers())}validate(){const t={name:s("צריך לכתוב שם ללקוח"),email:s("כתובת דוא״ל לא תקינה"),customer_number:s("מספר לקוח הוא ספרות בלבד")},e={};for(const a of Pa(this.form,{numberRequired:!0}))e[a]=t[a];return this.errs=e,!Object.keys(e).length}async save(){if(!(this.busy||!this.validate())){this.busy=!0,this.error="";try{if(this.card)this.card=await b().updateCustomer(this.card.id,this.card.revision,es(this.form,this.card));else{const t=await b().createCustomer(es(this.form));await this.loadList(),X(M.customer(t.id));return}await this.loadList()}catch(t){const e=Ft(t);Object.keys(e).length?this.errs=e:this.error=T(t)}finally{this.busy=!1}}}async removeCustomer(){if(!(!this.card||this.busy)){this.busy=!0;try{await b().deleteCustomer(this.card.id,this.card.revision),this.confirmDel=!1,await this.loadList(),this.close()}catch(t){this.confirmDel=!1,this.error=T(t)}finally{this.busy=!1}}}field(t,e,a={}){return za(t,{idPrefix:"f-",label:e,value:this.form[t],error:this.errs[t],readonly:a.ro||!j().manage,wide:a.wide,ltr:a.ltr,area:a.area,placeholder:a.ph??"",onInput:n=>{this.form={...this.form,[t]:n},!a.area&&this.errs[t]&&(this.errs={...this.errs,[t]:""})}})}renderCard(){const t=j(),e=this.card;return r`<sw-sheet open wide solid .heading=${e?s("כרטיס לקוח"):s("לקוח חדש")} data-customer-card @close=${()=>this.close()}>
        <div class="col" style="gap:14px">
        ${this.cardSt==="loading"?at(4):this.cardSt==="error"?E("error","warning",s("לא ניתן לטעון את הלקוח"),{label:s("נסה שוב"),run:()=>void this.loadCard(this.segments[0])}):r`
          <div class="form">${this.field("name",s("שם הלקוח"),{wide:!0})}${this.field("customer_number",s("מספר לקוח"),{ltr:!0})}${this.field("tax_id",s("ח.פ. / ע.מ. (לא חובה)"),{ltr:!0,ph:s("לא חובה")})}
            ${this.field("address",s("כתובת למשלוח החיוב"),{wide:!0})}${this.field("phone",s("טלפון"),{ltr:!0})}${this.field("email",s("דוא״ל"),{ltr:!0})}${this.field("notes",s("הערות"),{wide:!0,ph:s("לא חובה"),area:!0})}</div>
          ${e?r`<b class="h3">${s("חשבונות")}</b>
            <div class="list" data-customer-accounts>${(e.accounts??[]).map(a=>r`<a class="li" href=${N.account(a.id)}><div class="grow"><div class="t1">${a.name}</div></div></a>`)}${e.accounts?.length?d:r`<div class="mut">${s("אין חשבונות ללקוח")}</div>`}</div>
            ${e.bills?.length?r`<b class="h3">${s("חיובים אחרונים")}</b>${Ve(e.bills.slice(0,4),{phone:!0})}`:d}`:d}
          ${this.error?C("err",this.error):d}
          ${t.manage?r`<div class="row"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button><span class="sp"></span>${e?r`<sw-button variant="danger" data-delete @click=${()=>this.confirmDel=!0}>${s("מחיקת לקוח")}</sw-button>`:d}</div>`:d}`}
        <elec-dialog heading=${s("מחיקת לקוח")} ?open=${this.confirmDel} data-dialog="delete-customer" @close=${()=>this.confirmDel=!1}>
          <div>${s("הלקוח יימחק. חיובים שהונפקו שומרים עותק של פרטיו.")}</div>
          <sw-button variant="danger" slot="actions" data-confirm ?disabled=${this.busy} @click=${()=>void this.removeCustomer()}>${s("מחיקה")}</sw-button>
          <sw-button slot="actions" @click=${()=>this.confirmDel=!1}>${s("ביטול")}</sw-button>
        </elec-dialog>
        </div>
      </sw-sheet>`}render(){const t=j();if(!t.bills)return r`<div class="page" data-elec="customers" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה ללקוחות"))}</div>`;const e=this.list.filter(n=>Na(n,this.q));let a;return this.st==="loading"?a=at(5):this.st==="error"?a=E("error","warning",s("לא ניתן לטעון את הלקוחות"),{label:s("נסה שוב"),run:()=>void this.loadList()}):this.st==="empty"?a=E("empty","user",s("אין לקוחות עדיין"),t.manage?{label:s("+ לקוח חדש"),primary:!0,run:()=>X(`${M.customers()}/new`)}:void 0):e.length?a=r`<div class="grid-cards" data-elec-list>${e.map(n=>r`<div class="card" data-customer-row=${n.id}>
        <div class="row" style="flex-wrap:nowrap"><div class="chip c-acc nodot" style="inline-size:36px;block-size:36px;justify-content:center;padding:0" aria-hidden="true">${n.name.slice(0,2)}</div><div style="min-inline-size:0"><a class="rowlink h3" href=${N.customer(n.id)}>${n.name}</a><div class="mut">${s("מספר לקוח")} ${u(n.customer_number)}</div></div></div>
        <dl class="kv" style="margin-block-start:10px"><dt>${s("חשבונות")}</dt><dd>${n.account_count}</dd>${n.phone?r`<dt>${s("טלפון")}</dt><dd>${u(n.phone)}</dd>`:d}${n.email?r`<dt>${s("דוא״ל")}</dt><dd>${u(n.email)}</dd>`:d}</dl></div>`)}</div>`:a=E("empty","search",s("לא נמצאו לקוחות")),r`<div class="page" data-elec="customers" data-state=${this.st}>
      <div class="row"><input type="search" data-search aria-label=${s("חיפוש לקוח")} placeholder=${s("חיפוש לקוח")} .value=${this.q} @input=${n=>this.q=n.target.value} /><span class="sp"></span>
        ${t.manage?r`<a class="btn pri ${this.phone?"sm":""}" data-new-customer href=${`#${M.customers()}/new`}>${s("+ לקוח חדש")}</a>`:d}</div>
      ${a}
      ${this.segments[0]?this.renderCard():d}
    </div>`}};W.styles=[wt];et([y({attribute:!1})],W.prototype,"segments",2);et([y({attribute:!1})],W.prototype,"params",2);et([c()],W.prototype,"st",2);et([c()],W.prototype,"list",2);et([c()],W.prototype,"q",2);et([c()],W.prototype,"card",2);et([c()],W.prototype,"cardSt",2);et([c()],W.prototype,"form",2);et([c()],W.prototype,"errs",2);et([c()],W.prototype,"busy",2);et([c()],W.prototype,"error",2);et([c()],W.prototype,"confirmDel",2);W=et([D("elec-customers-page")],W);var Ii=Object.defineProperty,Mi=Object.getOwnPropertyDescriptor,Zt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Mi(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ii(e,a,i),i};const hs=Array.from({length:97},(t,e)=>Ia(e*15)),us=/^\d{2}-\d{2}$/;let Ct=class extends Q{constructor(){super(...arguments),this.definition=null,this.readonly=!1,this.errorPath="",this.priceMode="ex_vat",this.vatRate=null}emit(t){this.definition=t,this.dispatchEvent(new CustomEvent("tou-change",{detail:t,bubbles:!0,composed:!0}))}edit(t){if(!this.definition||this.readonly)return;const e=le(this.definition);t(e),this.emit(e)}bad(t){return this.errorPath&&(this.errorPath===t||this.errorPath.startsWith(t+"[")||this.errorPath.startsWith(t+"."))?"err-on":""}bandName(t){const e=this.definition?.bands.find(a=>a.id===t);return e?A("bands",e):t}prices(t){return r`<div class="card" data-tou-prices>
      <div class="hd"><b class="h3">${s("מחירים לקוט״ש")}</b><span class="sp"></span><span class="hint">${this.priceMode==="inc_vat"?s("המחירים כוללים מע״מ"):s("המחירים לפני מע״מ")}</span></div>
      <sw-table bare static-rows class="t" .columns=${this.priceColumns(t)} .rows=${t.bands}
        .rowAttrs=${e=>({"data-tou-band":e.id})}></sw-table>
    </div>`}priceColumns(t){return[{key:"band",label:s("פס"),render:e=>r`<span part="tou-band"><span part="tou-swatch" style="background:${ne(t,e.id)}"></span><b>${A("bands",e)}</b>${e.id===t.default_band?r`<span class="mut">(${s("שאר השעות")})</span>`:d}</span>`},...t.seasons.map(e=>({key:`season-${e.id}`,label:A("seasons",e),render:a=>this.priceCell(t,e,a)}))]}priceCell(t,e,a){const n=t.prices[e.id]?.[a.id]??"";if(!Ma(t,e.id).includes(a.id)&&(n===""||n===null))return r`<span class="mut">-</span>`;const i=this.vatRate,o=Number(n),l=i!==null&&n!==""&&Number.isFinite(o)?this.priceMode==="ex_vat"?o*(1+i):o/(1+i):null,p=l!==null?`${this.priceMode==="ex_vat"?s("כולל מע״מ"):s("לפני מע״מ")} ${F(l)}`:"",$=!!this.bad(`prices.${e.id}.${a.id}`);return r`<sw-field part="field tou-price" unit="₪" hint=${p}><input class="ltr ${$?"err":""}" inputmode="decimal" aria-label=${s("{band} ב{season}",{band:A("bands",a),season:A("seasons",e)})}
      aria-invalid=${$?"true":"false"} data-tou-price=${`${e.id}:${a.id}`} .value=${n??""} ?disabled=${this.readonly}
      @input=${h=>this.edit(v=>{(v.prices[e.id]??={})[a.id]=h.target.value.trim()||null})} /></sw-field>`}dayRow(t,e,a,n,i){const o=t.schedule[e]?.[a]??[],l=t.bands.filter(v=>v.id!==t.default_band),p=i[e]?.[a]??[],$=(v,m)=>(Number(m.slice(0,2))*60+Number(m.slice(3))-(Number(v.slice(0,2))*60+Number(v.slice(3))))/1440*100,h=`schedule.${e}.${a}`;return r`<div class="b">${n}</div>
      <div class="day ${this.bad(h)}" data-tou-day=${`${e}:${a}`}>
        <div class="bar" role="img" aria-label=${`${n}: `+p.map(v=>`${v.from}-${v.to} ${this.bandName(v.band)}`).join(", ")}>${p.map(v=>r`<i style="inline-size:${$(v.from,v.to)}%;background:${ne(t,v.band)}" title=${`${v.from}-${v.to} ${this.bandName(v.band)}`} data-cell=${v.band}></i>`)}</div>
        <div class="ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        ${o.map((v,m)=>r`<div class="rng" data-tou-range=${`${e}:${a}:${m}`}>
          <select aria-label=${s("משעה")} ?disabled=${this.readonly} @change=${g=>this.edit(B=>{B.schedule[e][a][m][0]=g.target.value})}>${hs.slice(0,96).map(g=>r`<option .selected=${g===v[0]} value=${g}>${g}</option>`)}</select>
          <span>${s("עד")}</span>
          <select aria-label=${s("עד שעה")} ?disabled=${this.readonly} @change=${g=>this.edit(B=>{B.schedule[e][a][m][1]=g.target.value})}>${hs.slice(1).map(g=>r`<option .selected=${g===v[1]} value=${g}>${g}</option>`)}</select>
          <select aria-label=${s("פס")} ?disabled=${this.readonly} @change=${g=>this.edit(B=>{B.schedule[e][a][m][2]=g.target.value})}>${t.bands.map(g=>r`<option .selected=${g.id===v[2]} value=${g.id}>${A("bands",g)}</option>`)}</select>
          ${this.readonly?d:r`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת טווח")} data-tou-remove @click=${()=>this.edit(g=>{g.schedule[e][a].splice(m,1),g.schedule[e][a].length||delete g.schedule[e][a]})}></sw-button>`}
        </div>`)}
        ${this.readonly||!l.length?d:r`<div><sw-button variant="ghost" size="sm" data-tou-add=${`${e}:${a}`} @click=${()=>this.edit(v=>{((v.schedule[e]??={})[a]??=[]).push(["17:00","22:00",l[0].id])})}>${s("+ טווח שעות")}</sw-button></div>`}
      </div>`}hours(t){const e=Ta(t),a=n=>n.ranges.map(([i,o])=>`${i.split("-").reverse().join(".")}-${o.split("-").reverse().join(".")}`).join(", ");return r`<div class="card" data-tou-hours>
      <div class="hd"><b class="h3">${s("שעות לפי עונה")}</b><span class="sp"></span>
        <span class="legend">${t.bands.map(n=>r`<span><i style="background:${ne(t,n.id)}"></i>${A("bands",n)}</span>`)}</span></div>
      <div class="col">${t.seasons.map(n=>r`<div class="season" data-tou-season=${n.id}>
        <div class="row"><b class="h3">${A("seasons",n)}</b><span class="mut">${u(a(n))}</span></div>
        <div class="dt">${t.day_types.map(i=>this.dayRow(t,n.id,i.id,A("day_types",i),e))}</div>
      </div>`)}</div>
      <div class="hint" style="margin-block-start:8px">${s("כל שעה שאינה בטווח שייכת ל{band}. השעות הן שעון מקומי; טווח שעובר את חצות (22:00 עד 06:00) נספר באותו תאריך.",{band:this.bandName(t.default_band)})}</div>
    </div>`}nameEn(t,e,a,n){const i=n??"",o=Da(i);return r`<div class="en">
      <input class="ltr ${o&&!this.bad(`${t}[${e}].name_en`)?"":"err"}" dir="ltr" lang="en" maxlength=${ss} aria-label=${s("שם באנגלית")} placeholder=${s("שם באנגלית (רשות)")}
        data-tou-name-en=${`${t}:${a}`} .value=${i} ?disabled=${this.readonly} aria-invalid=${o?"false":"true"}
        @input=${l=>this.setNameEn(t,e,l.target.value)} />
      ${o?d:r`<span class="hint bad" data-tou-name-en-error>${s("שם באנגלית: אותיות לטיניות בלבד, עד {max} תווים.",{max:ss})}</span>`}
    </div>`}setNameEn(t,e,a){this.edit(n=>{const i=n[t][e];i&&(a.trim()?i.name_en=a:delete i.name_en)})}structure(t){const e=this.readonly,a=(n,i,o,l)=>r`<select class="${this.bad(i)?"err":""}" ?disabled=${e} @change=${p=>this.edit($=>o($,p.target.value||null))}>
      ${l?r`<option value="" .selected=${n===null}>${s("ללא שינוי")}</option>`:d}${t.day_types.map(p=>r`<option value=${p.id} .selected=${p.id===n}>${A("day_types",p)}</option>`)}</select>`;return r`<details class="card" data-tou-structure ?open=${!!this.errorPath&&/^(seasons|bands|week|holiday|day_types|default_band)/.test(this.errorPath)}>
      <summary>${s("מבנה התעריף: עונות, פסים וימים")}</summary>
      <div class="stru">
        <div class="col">
          <b>${s("עונות")}</b>
          ${t.seasons.map((n,i)=>r`<div class="season ${this.bad(`seasons[${i}]`)}" data-tou-season-def=${n.id}>
            <div class="row"><input aria-label=${s("שם העונה")} .value=${n.name_he} ?disabled=${e} @input=${o=>this.edit(l=>{l.seasons[i].name_he=o.target.value})} />
              ${e||t.seasons.length<2?d:r`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת העונה")} @click=${()=>this.edit(o=>{const[l]=o.seasons.splice(i,1);delete o.schedule[l.id],delete o.prices[l.id]})}></sw-button>`}</div>
            ${this.nameEn("seasons",i,n.id,n.name_en)}
            ${n.ranges.map((o,l)=>r`<div class="rng"><span class="mut">${s("מ")}</span><input class="md ltr" aria-label=${s("מתאריך (חודש-יום)")} placeholder="MM-DD" .value=${o[0]} ?disabled=${e} @change=${p=>{const $=p.target.value.trim();us.test($)&&this.edit(h=>{h.seasons[i].ranges[l][0]=$})}} />
              <span class="mut">${s("עד")}</span><input class="md ltr" aria-label=${s("עד תאריך (חודש-יום)")} placeholder="MM-DD" .value=${o[1]} ?disabled=${e} @change=${p=>{const $=p.target.value.trim();us.test($)&&this.edit(h=>{h.seasons[i].ranges[l][1]=$})}} />
              ${e||n.ranges.length<2?d:r`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת טווח תאריכים")} @click=${()=>this.edit(p=>{p.seasons[i].ranges.splice(l,1)})}></sw-button>`}</div>`)}
            ${e?d:r`<div><sw-button variant="ghost" size="sm" @click=${()=>this.edit(o=>{o.seasons[i].ranges.push(["01-01","01-31"])})}>${s("+ טווח תאריכים")}</sw-button></div>`}
          </div>`)}
          // i18n-keep: the value of the name_he field (the Hebrew name of a bilingual name pair)
          ${e?d:r`<div><sw-button size="sm" data-tou-add-season @click=${()=>this.edit(n=>{const i=as("season",n.seasons.map(o=>o.id));n.seasons.push({id:i,name_he:"עונה חדשה",ranges:[["01-01","01-31"]]}),n.prices[i]={}})}>${s("+ עונה")}</sw-button></div>`}
          <div class="hint">${s("העונות חייבות לכסות את כל השנה בלי חפיפה. 29 בפברואר שייך לעונה של 28 בפברואר.")}</div>
        </div>
        <div class="col">
          <b>${s("פסי תעריף")}</b>
          ${t.bands.map((n,i)=>r`<div class="row ${this.bad(`bands[${i}]`)}"><span class="sw" style="background:${ne(t,n.id)}"></span>
            <input aria-label=${s("שם הפס")} .value=${n.name_he} data-tou-band-name=${n.id} ?disabled=${e} @input=${o=>this.edit(l=>{l.bands[i].name_he=o.target.value})} />
            ${e||n.id===t.default_band||t.bands.length<2?d:r`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${s("הסרת הפס")} @click=${()=>this.edit(o=>{o.bands.splice(i,1);for(const l of Object.values(o.schedule))for(const p of Object.keys(l))l[p]=l[p].filter($=>$[2]!==n.id),l[p].length||delete l[p];for(const l of Object.values(o.prices))delete l[n.id]})}></sw-button>`}</div>
            ${this.nameEn("bands",i,n.id,n.name_en)}`)}
          // i18n-keep: the value of the name_he field (the Hebrew name of a bilingual name pair)
          ${e||t.bands.length>=8?d:r`<div><sw-button size="sm" data-tou-add-band @click=${()=>this.edit(n=>{n.bands.push({id:as("band",n.bands.map(i=>i.id)),name_he:"פס חדש"})})}>${s("+ פס")}</sw-button></div>`}
          <div class="fld"><label>${s("שאר השעות שייכות ל")}</label><select ?disabled=${e} @change=${n=>this.edit(i=>{i.default_band=n.target.value})}>${t.bands.map(n=>r`<option value=${n.id} .selected=${n.id===t.default_band}>${A("bands",n)}</option>`)}</select></div>
          <b>${s("סוגי ימים")}</b>
          <div class="dt" data-tou-day-types>${t.day_types.map((n,i)=>r`<span class="${this.bad(`day_types[${i}]`)}">${n.name_he}</span>${this.nameEn("day_types",i,n.id,n.name_en)}`)}</div>
          <b>${s("ימים")}</b>
          <div class="dt">${ks.map(n=>r`<span>${xs[n]}</span>${a(t.week[n],`week.${n}`,(i,o)=>{i.week[n]=o??i.day_types[0].id},!1)}`)}
            <span>${s("חג")}</span>${a(t.holiday,"holiday",(n,i)=>{n.holiday=i},!0)}
            <span>${s("ערב חג")}</span>${a(t.holiday_eve,"holiday_eve",(n,i)=>{n.holiday_eve=i},!0)}</div>
          <div class="hint">${s("יום שמתאים לכמה סוגים (שבת שהיא גם ערב חג) מקבל את הסוג המאוחר ברשימה:")} ${t.day_types.map(n=>A("day_types",n)).join(` ${s("←")} `)}.</div>
        </div>
      </div>
    </details>`}render(){const t=this.definition;return t?r`<div class="tou" data-tou-editor>${this.prices(t)}${this.hours(t)}${this.structure(t)}</div>`:d}};Ct.styles=[...Q.styles,it`
      .tou {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      /* CR-FIELD-UNIT-2470: the price grid (sw-table): the band's swatch and name, a price field of one fixed width with the ₪ inside
         its frame; the price cells sit on 8 px so four seasons fit the dialog */
      sw-table.t {
        --sw-table-cell-pad: 8px 10px;
      }
      sw-table.t::part(tou-band) {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px 6px;
      }
      sw-table.t::part(tou-swatch) {
        inline-size: 12px;
        block-size: 12px;
        border-radius: var(--sw-r-2xs);
        border: 1px solid var(--sw-border-strong);
        flex: none;
      }
      sw-table.t::part(tou-price) {
        inline-size: 128px;
        max-inline-size: 100%;
        gap: 4px;
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
    `];Zt([y({attribute:!1})],Ct.prototype,"definition",2);Zt([y({type:Boolean})],Ct.prototype,"readonly",2);Zt([y()],Ct.prototype,"errorPath",2);Zt([y()],Ct.prototype,"priceMode",2);Zt([y({type:Number})],Ct.prototype,"vatRate",2);Ct=Zt([D("elec-tou-editor")],Ct);var Ti=Object.defineProperty,Di=Object.getOwnPropertyDescriptor,O=(t,e,a,n)=>{for(var i=n>1?void 0:n?Di(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ti(e,a,i),i};const ps=/^\d+(\.\d+)?$/,ms=/^#[0-9a-fA-F]{6}$/,Ri=t=>{const e=[1,3,5].map(a=>parseInt(t.slice(a,a+2),16)/255).map(a=>a<=.03928?a/12.92:((a+.055)/1.055)**2.4);return .2126*e[0]+.7152*e[1]+.0722*e[2]};function vs(t){const e=t.current?.definition;return e?`${e.bands.map(a=>A("bands",a,t.current?.names_en)).join(" / ")} · ${s("{n} עונות",{n:e.seasons.length})}`:s("לפי שעות")}let R=class extends Q{constructor(){super(...arguments),this.st="loading",this.tariffs=[],this.vat=null,this.settings=null,this.tOpen=!1,this.tEdit=null,this.tf={name:"",price:"",mode:"ex_vat",from:""},this.tErr={},this.tVer=null,this.tPlan=null,this.tKind="fixed",this.tDef=null,this.tErrPath="",this.tSource="",this.vOpen=!1,this.vf={rate:"",from:""},this.vErr={},this.busy=!1,this.error=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{const t=b();[this.tariffs,this.vat,this.settings]=await Promise.all([t.listTariffs(),t.getVat(),t.getSettings().catch(()=>null)]),this.st="ready"}catch(t){this.st=Fe(t)?"forbidden":"error"}}rate(){return this.vat?.current?Number(this.vat.current.rate_percent)/100:0}tariffColumns(){const t=a=>a.current?.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ"),e=a=>this.derived(a.current?.price??"0",a.current?.price_mode??"ex_vat");return[{key:"name",label:s("שם"),render:a=>r`<b>${a.name}</b>${a.kind==="tou"?r` <span class="chip" data-tone="info" data-nodot>${s("לפי שעות")}</span>`:d}`},{key:"price",label:s("מחיר שהוזן"),align:"end",render:a=>a.kind==="tou"?r`<span class="mut">${vs(a)}</span>`:r`<span class="num">${F(a.current?.price??0)} ₪</span>`},{key:"mode",label:s("הוזן"),render:a=>t(a)},{key:"ex",label:s("לפני מע״מ"),kind:"num",render:a=>a.kind==="tou"?"-":`${F(e(a).ex)} ₪`},{key:"inc",label:s("כולל מע״מ"),kind:"num",render:a=>a.kind==="tou"?"-":`${F(e(a).inc)} ₪`},{key:"from",label:s("בתוקף מ"),render:a=>r`<span class="num">${S(a.current?.effective_from??"")}</span>`},{key:"used",label:s("חשבונות"),render:a=>String(a.used_by)}]}derived(t,e){const a=Number(t)||0,n=this.rate();return e==="ex_vat"?{ex:a,vat:a*n,inc:a*(1+n)}:{ex:a/(1+n),vat:a-a/(1+n),inc:a}}openTariff(t){this.tEdit=t,this.tf=t?.current?{name:t.name,price:t.current.price??"",mode:t.current.price_mode,from:st()}:{name:"",price:"",mode:this.settings?.default_price_mode??"ex_vat",from:st()},this.tKind=t?.kind==="tou"?"tou":"fixed",this.tDef=t?.kind==="tou"&&t.current?.definition?le(t.current.definition):null,this.tSource="",this.tErrPath="",this.tErr={},this.tVer=null,this.tPlan=null,this.error="",this.tOpen=!0}async setKind(t){if(!(this.tEdit||this.tKind===t)&&(this.tKind=t,this.tErrPath="",this.error="",t==="tou"&&!this.tDef))try{const e=(await b().touTemplates())[0];this.tDef=le(e?.definition??is()),this.tSource=e?Ra(e.source_he,e.source_en):""}catch(e){this.tDef=is(),this.error=T(e)}}editVersion(t){this.tEdit&&(this.tVer=t,this.tPlan=null,this.tErr={},this.tErrPath="",this.error="",this.tf={name:this.tEdit.name,price:t.price??"",mode:t.price_mode,from:t.effective_from},t.definition&&(this.tDef=le(t.definition)))}setTf(t){this.tf={...this.tf,...t},this.tPlan=null}planText(t){const e=a=>a.price===null?a.price_mode==="inc_vat"?s("מחירים לפי שעות כולל מע״מ"):s("מחירים לפי שעות לפני מע״מ"):`${F(a.price)} ₪ ${a.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")}`;return`${e(t.old)} ← ${e(t.new)}. ${t.message_he}`}async saveTariff(){const t=this.tf,e=this.tKind==="tou",a={};if(t.name.trim()||(a.name=s("צריך לתת שם לתעריף")),!e&&(!ps.test(t.price)||Number(t.price)<=0)&&(a.price=s("המחיר חייב להיות מספר גדול מאפס")),V(t.from)||(a.from=s("צריך לבחור תאריך")),this.tErr=a,!(Object.keys(a).length||this.busy||e&&!this.tDef)){this.busy=!0,this.error="",this.tErrPath="";try{const n={name:t.name.trim(),price:e?"":t.price,price_mode:t.mode,effective_from:t.from,definition:e?this.tDef:null};if(this.tEdit){const i=await b().correctTariffVersion(this.tEdit.id,n,{replaceId:this.tVer?.id??null,base:this.tVer,confirm:!!this.tPlan});if(!i.applied&&i.plan){this.tPlan=i.plan;return}}else await b().createTariff(n);this.tPlan=null,this.tOpen=!1,this.tariffs=await b().listTariffs()}catch(n){const i=Ft(n);Object.keys(i).length?this.tErr=i:this.error=T(n);const o=Ks(n)[0];o&&(o.field==="definition"||o.field.startsWith("definition."))&&(this.tErrPath=o.field.replace(/^definition\.?/,""))}finally{this.busy=!1}}}async saveVat(){const t={};if((!ps.test(this.vf.rate)||Number(this.vf.rate)>50)&&(t.rate_percent=s("שיעור המע״מ חייב להיות בין 0 ל-50")),V(this.vf.from)||(t.effective_from=s("צריך לבחור תאריך")),this.vErr=t,!(Object.keys(t).length||this.busy)){this.busy=!0,this.error="";try{this.vat=await b().addVat(this.vf.rate,this.vf.from),this.vOpen=!1}catch(e){const a=Ft(e);Object.keys(a).length?this.vErr=a:this.error=T(e)}finally{this.busy=!1}}}async setMode(t){if(!(!this.settings||!j().manage||this.settings.default_price_mode===t))try{this.settings=await b().saveSettings(this.settings.revision,{default_price_mode:t}),this.error=""}catch(e){this.error=T(e)}}render(){const t=j();if(!t.bills&&!t.manage)return r`<div class="page" data-elec="settings-prices" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה למחירים"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="settings-prices" data-state="loading">${at(4)}</div>`;if(this.st==="forbidden")return r`<div class="page" data-elec="settings-prices" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה למחירים"))}</div>`;if(this.st==="error")return r`<div class="page" data-elec="settings-prices" data-state="error">${E("error","warning",s("לא ניתן לטעון את המחירים"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;const e=this.vat?.current,a=(this.vat?.items??[]).slice().sort((l,p)=>l.effective_from<p.effective_from?1:-1),n=t.manage,i=this.derived(this.tf.price,this.tf.mode),o=this.settings?.default_price_mode??"ex_vat";return r`<div class="page" data-elec="settings-prices" data-state="ready">
      ${this.error&&!this.tOpen&&!this.vOpen?C("err",this.error):d}
      ${e?d:C("warn",s("לא הוגדר שיעור מע״מ. בלי שיעור אי אפשר להפיק חיובים."))}
      <div class="cols side-l">
        <div class="card ${this.phone?"":"flush"}"><div class="hd"><b class="h3">${s("תעריפים")}</b><span class="sp"></span>${n?r`<sw-button variant="primary" size="sm" data-new-tariff @click=${()=>this.openTariff(null)}>${s("+ תעריף")}</sw-button>`:d}</div>
          ${this.tariffs.length?this.phone?r`<div class="list" data-tariffs>${this.tariffs.map(l=>r`<button type="button" class="li" data-tariff-row=${l.id} data-kind=${l.kind} ?disabled=${!n} @click=${()=>n&&this.openTariff(l)}><div class="grow"><div class="t1">${l.name}</div><div class="t2">${l.kind==="tou"?r`${vs(l)} · `:d}${l.current?.price_mode==="inc_vat"?s("הוזן כולל מע״מ"):s("הוזן לפני מע״מ")} · ${s("מ-")}${u(S(l.current?.effective_from??""))}</div></div>${l.kind==="tou"?r`<span class="chip c-acc nodot">${s("לפי שעות")}</span>`:r`<b class="num">${F(l.current?.price??0)} ₪</b>`}</button>`)}</div>`:r`<sw-table bare class="t" data-tariffs ?static-rows=${!n} .columns=${this.tariffColumns()} .rows=${this.tariffs}
                  .rowAttrs=${l=>({"data-tariff-row":String(l.id),"data-kind":String(l.kind)})}
                  @row-select=${n?l=>this.openTariff(l.detail.row):d}></sw-table>`:E("empty","bolt",s("אין תעריפים עדיין"),n?{label:s("+ תעריף"),primary:!0,run:()=>this.openTariff(null)}:void 0)}
        </div>
        <div class="col">
          <div class="card" data-card="vat"><div class="hd"><b class="h3">${s("שיעור מע״מ")}</b><span class="sp"></span>${n?r`<sw-button size="sm" data-new-vat @click=${()=>{this.vf={rate:"",from:st()},this.vErr={},this.error="",this.vOpen=!0}}>${s("+ שיעור חדש")}</sw-button>`:d}</div>
            ${e?r`<div class="row" style="align-items:baseline"><span style="font-size:var(--sw-fs-3xl);font-weight:700" data-vat-rate>${u(e.rate_percent+"%")}</span><span class="mut">${s("מ-")}${u(S(e.effective_from))}</span></div>`:r`<div class="mut">${s("לא הוגדר")}</div>`}
            ${a.slice(1).map((l,p)=>r`<div class="ver" style="margin-block-start:8px"><span class="num">${l.rate_percent}%</span><span>${s("עד")} ${u(S(te(a[p].effective_from,-1)))}</span></div>`)}</div>
          <div class="card" data-card="mode"><div class="hd"><b class="h3">${s("ברירת מחדל להזנת מחיר")}</b></div><div class="list" role="radiogroup" aria-label=${s("ברירת מחדל להזנת מחיר")}>
            ${["ex_vat","inc_vat"].map(l=>r`<label class="li ${o===l?"sel":""}"><input type="radio" name="mode" data-default-mode=${l} .checked=${o===l} ?disabled=${!n} @change=${()=>void this.setMode(l)} /><span class="ind"></span><div class="grow t1">${l==="ex_vat"?s("לפני מע״מ"):s("כולל מע״מ")}</div></label>`)}</div></div>
        </div>
      </div>
      <elec-dialog heading=${this.tEdit?s("עריכת תעריף"):s("תעריף חדש")} ?open=${this.tOpen} ?wide=${this.tKind==="tou"} data-dialog="tariff" @close=${()=>this.tOpen=!1}>
        <div class="form">
          <sw-field class="fld wide" label=${s("שם התעריף")}><input id="tn" class="${this.tErr.name?"err":""}" aria-invalid=${this.tErr.name?"true":"false"} data-tariff-name .value=${this.tf.name} @input=${l=>this.setTf({name:l.target.value})} />${this.tErr.name?r`<div class="msg" role="alert" slot="message">${this.tErr.name}</div>`:d}</sw-field>
          ${this.tEdit?d:r`<div class="fld wide"><span class="lbl">${s("סוג התעריף")}</span><sw-segmented label=${s("סוג התעריף")} value=${this.tKind} @change=${l=>void this.setKind(l.detail.value)}
        .options=${[{value:"fixed",label:s("מחיר קבוע"),attrs:{"data-tariff-kind":"fixed"}},{value:"tou",label:s("לפי שעות (תעו״ז)"),attrs:{"data-tariff-kind":"tou"}}]}></sw-segmented></div>`}
          ${this.tKind==="fixed"?r`<sw-field class="fld" label=${s("מחיר לקוט״ש")} unit="₪"><input id="tp" class="ltr ${this.tErr.price?"err":""}" aria-invalid=${this.tErr.price?"true":"false"} data-tariff-price inputmode="decimal" .value=${this.tf.price} @input=${l=>this.setTf({price:l.target.value})} />${this.tErr.price?r`<div class="msg" role="alert" slot="message">${this.tErr.price}</div>`:d}</sw-field>`:d}
          <div class="fld"><span class="lbl">${this.tKind==="tou"?s("המחירים שהוזנו"):s("המחיר שהוזן")}</span><sw-segmented label=${s("סוג מחיר")} value=${this.tf.mode} @change=${l=>this.setTf({mode:l.detail.value})}
        .options=${[{value:"ex_vat",label:s("לפני מע״מ"),attrs:{"data-tariff-mode":"ex_vat"}},{value:"inc_vat",label:s("כולל מע״מ"),attrs:{"data-tariff-mode":"inc_vat"}}]}></sw-segmented></div>
          <sw-field class="fld" label=${s("בתוקף מתאריך")}><input id="tf" type="date" lang=${ht()} class="ltr ${this.tErr.effective_from?"err":""}" aria-invalid=${this.tErr.effective_from?"true":"false"} data-tariff-from .value=${this.tf.from} @change=${l=>this.setTf({from:l.target.value})} />${this.tErr.effective_from?r`<div class="msg" role="alert" slot="message">${this.tErr.effective_from}</div>`:d}</sw-field>
        </div>
        ${this.tKind==="fixed"&&e?r`<div class="card soft" data-tariff-derived><dl class="kv"><dt>${s("לפני מע״מ")}</dt><dd>${u(F(i.ex)+" ₪")}</dd><dt>${s("מע״מ")} ${u(e.rate_percent+"%")}</dt><dd>${u(F(i.vat)+" ₪")}</dd><dt>${s("כולל מע״מ")}</dt><dd>${u(F(i.inc)+" ₪")}</dd></dl></div>`:d}
        ${this.tKind==="tou"&&this.tSource&&!this.tEdit?C("info",this.tSource):d}
        ${this.tKind==="tou"&&this.tDef?r`<elec-tou-editor .definition=${this.tDef} .priceMode=${this.tf.mode} .vatRate=${e?Number(e.rate_percent)/100:null} .errorPath=${this.tErrPath}
            @tou-change=${l=>{this.tDef=l.detail,this.tPlan=null,this.tErrPath=""}}></elec-tou-editor>`:d}
        ${this.tEdit&&this.tEdit.versions.length?r`<b class="h3">${s("גרסאות")}</b><div class="list" data-tariff-versions>${this.tEdit.versions.map(l=>r`<div class="ver" data-version=${l.id} aria-current=${this.tVer?.id===l.id?"true":"false"}><span class="num">${l.definition?s("לפי שעות"):`${F(l.price??0)} ₪`}</span><span>${l.price_mode==="inc_vat"?s("כולל מע״מ"):s("לפני מע״מ")} · ${s("מ-")}${u(S(l.effective_from))}</span>${j().manage?r`<button type="button" class="btn ghost sm" data-version-edit=${l.id} aria-label=${s("תיקון המחיר")} @click=${()=>this.editVersion(l)}>${s("תיקון")}</button>`:d}</div>`)}</div>`:d}
        ${this.tPlan?C("warn",this.planText(this.tPlan)):d}
        ${this.error?C("err",this.error):d}
        <sw-button variant="primary" slot="actions" data-save ?disabled=${this.busy} @click=${()=>void this.saveTariff()}>${this.tPlan?s("אישור והחלפה"):this.tVer?s("שמירת תיקון"):s("שמירה")}</sw-button>
        <sw-button slot="actions" @click=${()=>this.tOpen=!1}>${s("ביטול")}</sw-button>
      </elec-dialog>
      <elec-dialog heading=${s("שיעור מע״מ חדש")} ?open=${this.vOpen} data-dialog="vat" @close=${()=>this.vOpen=!1}>
        <div class="form">
          <sw-field class="fld" label=${s("שיעור")} unit="%"><input id="vr" class="ltr ${this.vErr.rate_percent?"err":""}" aria-invalid=${this.vErr.rate_percent?"true":"false"} data-vat-input inputmode="decimal" .value=${this.vf.rate} @input=${l=>this.vf={...this.vf,rate:l.target.value}} />${this.vErr.rate_percent?r`<div class="msg" role="alert" slot="message">${this.vErr.rate_percent}</div>`:d}</sw-field>
          <sw-field class="fld" label=${s("בתוקף מתאריך")}><input id="vf" type="date" lang=${ht()} class="ltr ${this.vErr.effective_from?"err":""}" aria-invalid=${this.vErr.effective_from?"true":"false"} data-vat-from .value=${this.vf.from} @change=${l=>this.vf={...this.vf,from:l.target.value}} />${this.vErr.effective_from?r`<div class="msg" role="alert" slot="message">${this.vErr.effective_from}</div>`:d}</sw-field>
        </div>
        ${this.error?C("err",this.error):d}
        <sw-button variant="primary" slot="actions" data-save ?disabled=${this.busy} @click=${()=>void this.saveVat()}>${s("שמירה")}</sw-button>
        <sw-button slot="actions" @click=${()=>this.vOpen=!1}>${s("ביטול")}</sw-button>
      </elec-dialog>
    </div>`}};O([c()],R.prototype,"st",2);O([c()],R.prototype,"tariffs",2);O([c()],R.prototype,"vat",2);O([c()],R.prototype,"settings",2);O([c()],R.prototype,"tOpen",2);O([c()],R.prototype,"tEdit",2);O([c()],R.prototype,"tf",2);O([c()],R.prototype,"tErr",2);O([c()],R.prototype,"tVer",2);O([c()],R.prototype,"tPlan",2);O([c()],R.prototype,"tKind",2);O([c()],R.prototype,"tDef",2);O([c()],R.prototype,"tErrPath",2);O([c()],R.prototype,"tSource",2);O([c()],R.prototype,"vOpen",2);O([c()],R.prototype,"vf",2);O([c()],R.prototype,"vErr",2);O([c()],R.prototype,"busy",2);O([c()],R.prototype,"error",2);R=O([D("elec-settings-prices")],R);function ji(t,e,a){const n=st();return{schema:"arx.energy.bill_snapshot/1",doc:{title_he:"חשבון צריכת חשמל ודרישת תשלום",subtitle_he:"אינו חשבונית מס",is_tax_invoice:!1},bill:{id:"",number:"2026-09-0001",revision:1,replaces:null,state:"issued",issue_date:n,due_date:e.mode==="net_days"?te(n,e.days):`${n.slice(0,7)}-${String(e.day_of_month).padStart(2,"0")}`,expected_due_date:null,payment_terms:{mode:e.mode,days:e.days,day_of_month:e.day_of_month}},period:{from:"2026-09-01",to:"2026-09-30",days:30},business:{...t,logo:a?{sha256:"x",mime:"image/png"}:null},customer:{id:"c",customer_number:"0001",name:"לקוח לדוגמה",address:"רחוב הדוגמה 12, עיר לדוגמה",phone:"",email:"",tax_id:""},account:{id:"a",name:"חשבון לדוגמה",tariff:{id:"t",name:"תעריף"},formula:{text:"[מונה]",sentence_he:"מונה לדוגמה"}},meters:[{meter_id:"m",name:"מונה לדוגמה",coefficient:"1",start:{at:"2026-09-01T00:00:00Z",reading_kwh:"1000.00",kind:"reading"},end:{at:"2026-09-30T23:59:00Z",reading_kwh:"1776.20",kind:"reading"},consumption_kwh:"776.20",contribution_kwh:"776.20"}],lines:[{from:"2026-09-01",to:"2026-09-30",kwh:"776.20",price_entered:"0.5430",price_mode:"ex_vat",unit_price_ex_vat:"0.5430",amount_ex_vat:"421.48",vat_rate_percent:"18",vat_amount:"75.87",total:"497.35"}],totals:{currency:"ILS",kwh:"776.20",amount_ex_vat:"421.48",vat_amount:"75.87",total:"497.35",vat_breakdown:[{rate_percent:"18",base:"421.48",vat:"75.87"}],price_mode_note_he:null},notes:[],history:{current:null,previous:[],same_period_last_year:null},meta:{software_version:"",computed_at:""}}}let ut=class extends Q{constructor(){super(...arguments),this.st="loading",this.s=null,this.biz={name:"",registration_no:"",address:"",phone:"",email:"",accent_color:"#2767ed",footer_note:""},this.terms={mode:"net_days",days:14,day_of_month:15},this.delay="6",this.errs={},this.busy=!1,this.error="",this.ok=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{this.apply(await b().getSettings()),this.st="ready"}catch(t){this.st=Fe(t)?"forbidden":"error"}}apply(t){this.s=t,this.biz={...t.business},this.terms={...t.payment_terms},this.delay=String(t.auto.delay_hours)}validate(){const t={};return this.biz.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.biz.email)&&(t.email=s("כתובת דוא״ל לא תקינה")),ms.test(this.biz.accent_color)?Ri(this.biz.accent_color)>.6&&(t.accent_color=s("הצבע בהיר מדי להדפסה")):t.accent_color=s("צבע לא תקין"),this.terms.mode==="net_days"&&!(Number.isInteger(this.terms.days)&&this.terms.days>=0&&this.terms.days<=120)&&(t.days=s("מספר הימים חייב להיות בין 0 ל-120")),this.terms.mode==="day_of_month"&&!(Number.isInteger(this.terms.day_of_month)&&this.terms.day_of_month>=1&&this.terms.day_of_month<=31)&&(t.day_of_month=s("היום בחודש חייב להיות בין 1 ל-31")),(!/^\d+$/.test(this.delay)||Number(this.delay)>72)&&(t.delay_hours=s("ההשהיה חייבת להיות בין 0 ל-72 שעות")),this.errs=t,!Object.keys(t).length}async save(){if(!(!this.s||this.busy||!this.validate())){this.busy=!0,this.error="",this.ok=!1;try{this.apply(await b().saveSettings(this.s.revision,{business:this.biz,payment_terms:this.terms,auto:{delay_hours:Number(this.delay)}})),this.ok=!0}catch(t){const e=Ft(t);Object.keys(e).length?this.errs=e:this.error=T(t)}finally{this.busy=!1}}}async logo(t){if(t){if(this.error="",!/^image\/(png|jpeg)$/.test(t.type)||t.size>1024*1024){this.error=s("הלוגו חייב להיות PNG או JPEG עד 1MB.");return}try{await b().uploadLogo(t),this.apply(await b().getSettings())}catch(e){this.error=T(e)}}}async removeLogo(){try{await b().removeLogo(),this.apply(await b().getSettings())}catch(t){this.error=T(t)}}fld(t,e,a={}){const n=this.errs[t];return r`<sw-field class="fld ${a.wide?"wide":""}" label=${e}>
      ${a.area?r`<textarea id="b-${t}" name=${t} .value=${this.biz[t]} @input=${i=>this.biz={...this.biz,[t]:i.target.value}}></textarea>`:r`<input id="b-${t}" name=${t} class="${a.ltr?"ltr":""} ${n?"err":""}" aria-invalid=${n?"true":"false"} .value=${this.biz[t]} @input=${i=>{this.biz={...this.biz,[t]:i.target.value},this.errs={...this.errs,[t]:""}}} />`}
      ${n?r`<div class="msg" role="alert" slot="message" data-field-error=${t}>${n}</div>`:d}</sw-field>`}render(){const t=j();if(!t.bills&&!t.manage)return r`<div class="page" data-elec="settings-business" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לפרטי העסק"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="settings-business" data-state="loading">${at(4)}</div>`;if(this.st==="forbidden")return r`<div class="page" data-elec="settings-business" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה לפרטי העסק"))}</div>`;if(this.st==="error"||!this.s)return r`<div class="page" data-elec="settings-business" data-state="error">${E("error","warning",s("לא ניתן לטעון את ההגדרות"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;const e=t.manage,a=this.s,n=a.logo?b().logoUrl(a.logo.sha256):"",i=Ws("accent","light",8),o=this.terms;return r`<div class="page" data-elec="settings-business" data-state="ready">
      <div class="cols side-l"><div class="card" style="min-inline-size:0"><fieldset style="border:0;margin:0;padding:0;min-inline-size:0" ?disabled=${!e}><div class="form">
        <div class="fld wide"><span class="lbl">${s("לוגו")}</span><div class="row">
          <div class="chip c-mut nodot" style="inline-size:96px;block-size:96px;padding:0;justify-content:center;border-radius:var(--sw-r-lg);overflow:hidden" data-logo>${n?r`<img src=${n} alt=${s("לוגו")} style="max-inline-size:100%;max-block-size:100%" />`:r`<span class="mut">${s("אין לוגו")}</span>`}</div>
          <div><label class="btn" style="cursor:pointer">${a.logo?s("החלפה"):s("העלאת לוגו")}<input type="file" accept="image/png,image/jpeg" data-logo-input style="position:absolute;inline-size:1px;block-size:1px;opacity:0" @change=${l=>void this.logo(l.target.files?.[0])} /></label>
            ${a.logo?r` <sw-button variant="ghost" data-logo-remove @click=${()=>void this.removeLogo()}>${s("הסרה")}</sw-button>`:d}<div class="mut" style="margin-block-start:6px">${s("PNG או JPEG, עד 1MB")}</div></div></div></div>
        ${this.fld("name",s("שם העסק"),{wide:!0})}${this.fld("registration_no",s("ח.פ. / ע.מ."),{ltr:!0})}${this.fld("phone",s("טלפון"),{ltr:!0})}${this.fld("address",s("כתובת"),{wide:!0})}${this.fld("email",s("דוא״ל"),{ltr:!0})}
        <div class="fld"><span class="lbl" id="acc">${s("צבע המותג")}</span><div class="row" role="group" aria-labelledby="acc" data-accent>
          ${i.map(l=>r`<button type="button" class="tok swatch" data-swatch=${l} aria-label=${s("צבע {c}",{c:l})} aria-pressed=${this.biz.accent_color.toLowerCase()===l} style="background:${l};border:2px solid ${this.biz.accent_color.toLowerCase()===l?"var(--sw-text)":"transparent"}" @click=${()=>this.biz={...this.biz,accent_color:l}}></button>`)}
          <input type="color" data-accent-color aria-label=${s("בחירה חופשית של צבע")} .value=${ms.test(this.biz.accent_color)?this.biz.accent_color:"#2767ed"} @input=${l=>this.biz={...this.biz,accent_color:l.target.value}} /></div>
          ${this.errs.accent_color?r`<div class="msg" role="alert" data-field-error="accent_color">${this.errs.accent_color}</div>`:d}</div>
        ${this.fld("footer_note",s("הערה קבועה בתחתית החיוב"),{wide:!0,area:!0})}
        <div class="fld wide"><span class="lbl">${s("מספור חיובים")}</span><div class="row" data-numbering style="padding:8px 12px;border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-sm)"><span class="num">${a.numbering.format}</span><span class="sp"></span><span class="mut">${s("שנה-חודש-מספר לקוח, למשל")} ${u("2026-12-0001")}</span></div></div>
        <div class="fld wide"><span class="lbl" id="pt">${s("תנאי תשלום")}</span><div class="row"><sw-segmented label=${s("תנאי תשלום")} value=${o.mode} @change=${l=>this.terms={...o,mode:l.detail.value}}
        .options=${[{value:"net_days",label:s("ימים מיום ההפקה"),attrs:{"data-terms":"net_days"}},{value:"day_of_month",label:s("יום קבוע בחודש"),attrs:{"data-terms":"day_of_month"}}]}></sw-segmented>
          ${o.mode==="net_days"?r`<sw-field class="terms-n" style="inline-size:132px" unit=${s("ימים")}><input class="ltr ${this.errs.days?"err":""}" data-days type="number" min="0" max="120" aria-label=${s("ימים לתשלום")} aria-invalid=${this.errs.days?"true":"false"} .value=${String(o.days)} @input=${l=>this.terms={...o,days:Number(l.target.value)}} /></sw-field>`:r`<sw-field class="terms-n" style="inline-size:132px" unit=${s("בחודש")}><input class="ltr ${this.errs.day_of_month?"err":""}" data-day-of-month type="number" min="1" max="31" aria-label=${s("יום בחודש")} aria-invalid=${this.errs.day_of_month?"true":"false"} .value=${String(o.day_of_month)} @input=${l=>this.terms={...o,day_of_month:Number(l.target.value)}} /></sw-field>`}</div>
          ${this.errs.days||this.errs.day_of_month?r`<div class="msg" role="alert" data-field-error="terms">${this.errs.days||this.errs.day_of_month}</div>`:d}</div>
        <sw-field class="fld wide delay" style="max-inline-size:340px" label=${s("יצירת טיוטה אוטומטית")} unit=${s("שעות אחרי סוף התקופה")}><input id="dl" class="ltr ${this.errs.delay_hours?"err":""}" aria-invalid=${this.errs.delay_hours?"true":"false"} data-delay type="number" min="0" max="72" .value=${this.delay} @input=${l=>{this.delay=l.target.value,this.errs={...this.errs,delay_hours:""}}} />${this.errs.delay_hours?r`<div class="msg" role="alert" slot="message" data-field-error="delay_hours">${this.errs.delay_hours}</div>`:d}</sw-field>
      </div></fieldset>
      ${this.error?C("err",this.error):d}${this.ok?C("ok",s("ההגדרות נשמרו")):d}
      ${e?r`<div class="row" style="margin-block-start:14px"><sw-button variant="primary" data-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button></div>`:d}</div>
      <div class="card"><div class="hd"><b class="h3">${s("תצוגה מקדימה")}</b></div><div style="overflow:hidden;max-block-size:320px;border-radius:var(--sw-r-sm)" data-preview><elec-bill-paper .snapshot=${ji(this.biz,o,!!a.logo)} .logo=${n} hash=""></elec-bill-paper></div></div></div>
    </div>`}};O([c()],ut.prototype,"st",2);O([c()],ut.prototype,"s",2);O([c()],ut.prototype,"biz",2);O([c()],ut.prototype,"terms",2);O([c()],ut.prototype,"delay",2);O([c()],ut.prototype,"errs",2);O([c()],ut.prototype,"busy",2);O([c()],ut.prototype,"error",2);O([c()],ut.prototype,"ok",2);ut=O([D("elec-settings-business")],ut);var Ai=Object.defineProperty,Li=Object.getOwnPropertyDescriptor,Gt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Li(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ai(e,a,i),i};let pe=class extends Q{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams}render(){const[t,e]=this.segments;return t?t==="new"?r`<elec-account-wizard></elec-account-wizard>`:e==="edit"?r`<elec-account-wizard .accountId=${t}></elec-account-wizard>`:r`<elec-account-page .accountId=${t} .tab=${e==="history"||e==="bills"?e:"status"}></elec-account-page>`:r`<elec-accounts-list></elec-accounts-list>`}};Gt([y({attribute:!1})],pe.prototype,"segments",2);Gt([y({attribute:!1})],pe.prototype,"params",2);pe=Gt([D("elec-accounts-page")],pe);let me=class extends Q{constructor(){super(...arguments),this.segments=[],this.params=new URLSearchParams}render(){const[t]=this.segments;return t?r`<elec-bill-page .billId=${t}></elec-bill-page>`:r`<elec-bills-list></elec-bills-list>`}};Gt([y({attribute:!1})],me.prototype,"segments",2);Gt([y({attribute:!1})],me.prototype,"params",2);me=Gt([D("elec-bills-page")],me);var Bi=Object.defineProperty,Fi=Object.getOwnPropertyDescriptor,z=(t,e,a,n)=>{for(var i=n>1?void 0:n?Fi(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Bi(e,a,i),i};const qi=[{id:"kWh",label:s("קוט״ש")},{id:"Wh",label:s("וואט־שעה")},{id:"MWh",label:s("מגוואט־שעה")}],Ns=it`
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
  ${Hs}
`;let Vt=class extends Ot{constructor(){super(...arguments),this.bubbleSkin=new Ut(this),this.log=null,this.canManage=!1,this.error=""}open(t){this.dispatchEvent(new CustomEvent("open-dialog",{detail:t}))}calLine(t){const e=t.calibration;return e.identity?r`<div class="cal" data-calibration="none">${s("ללא כיול: הקריאות כפי שהמונה מדווח")}</div>`:r`<div class="cal" data-calibration=${e.calibration_id??""}>${s("כיול מ-")}<span class="num">${qt(e.effective_date)}</span> · ${s("מקדם")} <span class="num">${e.factor}</span>
      · ${s("הפרש")} <span class="num ltr">${Jt(e.offset_kwh)}</span> ${s("קוט״ש")}</div>`}reading(t){const e=t.deviation_kwh==null?s("אין ערך מערכת לזמן הזה"):r`${s("מהמערכת")} <span class="num ltr">${Jt(t.deviation_kwh)}</span>`;return r`<div class="li ${t.voided_at?"dis":""}" data-reading=${t.id??""}>
      <div class="grow">
        <div class="t1"><span class="num">${oe(t.value_kwh)}</span> ${s("קוט״ש")} · <span class="num">${ue(t.read_at)}</span></div>
        <div class="t2 wrap">${e}${t.created_by_name?` · ${t.created_by_name}`:""}${t.note?` · ${t.note}`:""}${t.voided_at?r` · <b>${s("בוטלה")}</b>${t.voided_by_name?` (${t.voided_by_name})`:""}`:""}</div>
      </div>
      <span class="chip nodot ${t.effect==="allocation"?"c-acc":"c-mut"}" data-effect=${t.effect_reason} title=${t.message}>${Si[t.effect_reason]}</span>
      ${this.canManage&&t.can_undo&&t.id?r`<sw-button size="sm" variant="ghost" data-reading-undo=${t.id} @click=${()=>this.open({kind:"undo-reading",id:t.id})}>${s("ביטול")}</sw-button>`:d}
    </div>`}calibration(t){return r`<div class="li ${t.voided_at?"dis":""}" data-cal=${t.id??""}>
      <div class="grow">
        <div class="t1">${s("מ-")}<span class="num">${qt(t.effective_date)}</span> · ${s("מקדם")} <span class="num">${t.factor}</span> · ${s("הפרש")} <span class="num ltr">${Jt(t.offset_kwh)}</span></div>
        <div class="t2 wrap">${t.created_by_name??""}${t.note?` · ${t.note}`:""}${t.voided_at?r` · <b>${s("בוטל")}</b>`:""}</div>
      </div>
      ${t.in_force?r`<span class="chip nodot c-acc">${s("בתוקף")}</span>`:d}
      ${this.canManage&&t.can_undo&&t.id?r`<sw-button size="sm" variant="ghost" data-cal-undo=${t.id} @click=${()=>this.open({kind:"undo-calibration",id:t.id})}>${s("ביטול")}</sw-button>`:d}
    </div>`}render(){const t=this.log;return r`<div class="rd" data-readings>
      <div class="row"><h3>${s("קריאות ידניות וכיול")}</h3><span class="sp"></span>
        ${this.canManage&&t?r`<div class="acts"><sw-button size="sm" data-reading-add @click=${()=>this.open({kind:"reading"})}>${s("קריאה ידנית")}</sw-button>
              <sw-button size="sm" data-calibrate @click=${()=>this.open({kind:"calibrate"})}>${s("כיול")}</sw-button></div>`:d}</div>
      ${this.error?r`<div class="alert err" role="alert" data-readings-error>${this.error}</div>`:d}
      ${t?r`${this.calLine(t)}
            ${this.canManage&&t.suggestion?r`<div class="alert info sug" data-suggestion><div>${s("לפי שתי קריאות ההשוואה: מקדם")} <span class="num">${t.suggestion.factor}</span></div><span class="sp"></span>
                  <sw-button size="sm" data-suggestion-apply @click=${()=>this.open({kind:"calibrate",factor:t.suggestion.factor,anchor:t.suggestion.anchor_reading_id})}>${s("כיול לפי ההצעה")}</sw-button></div>`:d}
            ${t.items.length?r`<div class="list" data-reading-list>${t.items.map(e=>this.reading(e))}</div>`:r`<div class="mut" data-reading-empty>${s("אין קריאות ידניות")}</div>`}
            ${t.calibrations.length?r`<h4>${s("כיולים")}</h4><div class="list" data-cal-list>${t.calibrations.map(e=>this.calibration(e))}</div>`:d}`:this.error?d:r`<div class="skl" style="inline-size:60%"></div>`}
    </div>`}};Vt.styles=[wt,Ns];z([y({attribute:!1})],Vt.prototype,"log",2);z([y({type:Boolean})],Vt.prototype,"canManage",2);z([y()],Vt.prototype,"error",2);Vt=z([D("elec-meter-readings")],Vt);let I=class extends Ot{constructor(){super(...arguments),this.bubbleSkin=new Ut(this),this.meterId="",this.log=null,this.kind="",this.targetId="",this.presetFactor="",this.presetAnchor="",this.when="",this.value="",this.unit="kWh",this.note="",this.preview=null,this.previewError="",this.error="",this.fieldErrors={},this.busy=!1,this.date="",this.mode="anchor",this.anchor="",this.factor="1",this.offset="0",this.reason="",this.timer=0,this.seq=0}willUpdate(t){t.has("kind")&&this.kind&&this.reset()}disconnectedCallback(){window.clearTimeout(this.timer),super.disconnectedCallback()}reset(){if(this.preview=null,this.previewError="",this.error="",this.fieldErrors={},this.busy=!1,this.reason="",this.note="",this.kind==="reading"&&(this.when=Oe(new Date),this.value="",this.unit="kWh"),this.kind==="calibrate"){const t=Oe(new Date).slice(0,10),e=this.log?.first_calibration_date??"";this.date=e&&e>t?e:t,this.factor=this.presetFactor||"1";const a=this.anchors();this.anchor=this.presetAnchor||a[0]?.id||"",this.mode=a.length?"anchor":"offset",this.offset="0",this.schedule()}}anchors(){return(this.log?.items??[]).filter(t=>!t.voided_at&&t.id&&(t.system_kwh!=null||t.effect==="allocation"))}close(){window.clearTimeout(this.timer),this.dispatchEvent(new CustomEvent("close"))}saved(t){this.dispatchEvent(new CustomEvent("saved",{detail:t}))}readingBody(t){const e={},a=Ci(this.when);a?Date.parse(a)>Date.now()+3e5&&(e.when=s("זמן הקריאה בעתיד")):e.when=s("צריך לבחור תאריך ושעה");const n=ce(this.value);return n==null&&(e.value=s("צריך להזין מספר תקין")),t||(this.fieldErrors=e),Object.keys(e).length||!a||n==null?null:{read_at:a,value:n,unit:this.unit,...this.note.trim()?{note:this.note.trim()}:{},dry_run:t}}calibrationBody(t){const e={};/^\d{4}-\d{2}-\d{2}$/.test(this.date)||(e.date=s("צריך לבחור תאריך"));const a=Ei(this.factor);a==null&&(e.factor=s("מקדם בין 0.5 ל-2"));let n="0";if(this.mode==="offset"){const i=this.offset.trim().replace(",",".");n=/^[-−]?\d+(\.\d+)?$/.test(i)?i.replace("−","-"):null,n==null&&(e.offset=s("צריך להזין מספר תקין"))}else this.anchor||(e.anchor=s("צריך לבחור קריאה"));return t||(this.fieldErrors=e),Object.keys(e).length||a==null?null:{effective_date:this.date,factor:a,...this.mode==="anchor"?{anchor_reading_id:this.anchor}:{offset_kwh:n??"0"},...this.note.trim()?{note:this.note.trim()}:{},dry_run:t}}schedule(){window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.runPreview(),350)}async runPreview(){const t=++this.seq;try{if(this.kind==="reading"){const e=this.readingBody(!0);if(!e)return this.preview=null,void(this.previewError="");const a=await Me(this.meterId,e);t===this.seq&&(this.preview=a.reading,this.previewError="")}else if(this.kind==="calibrate"){const e=this.calibrationBody(!0);if(!e)return this.preview=null,void(this.previewError="");const a=await ds(this.meterId,e);t===this.seq&&(this.preview=a.calibration,this.previewError="")}}catch(e){t===this.seq&&(this.preview=null,this.previewError=ct(e))}}async save(){if(this.busy)return;const t=this.kind==="reading"?this.readingBody(!1):this.calibrationBody(!1);if(t){this.busy=!0,this.error="";try{const e=this.kind==="reading"?await Me(this.meterId,t):await ds(this.meterId,t);e.log&&this.saved(e.log),this.close()}catch(e){this.error=ct(e);const a=Zs(e);a.length&&(this.fieldErrors=Object.fromEntries(a.map(n=>[n==="read_at"?"when":n==="effective_date"?"date":n==="offset_kwh"?"offset":n==="anchor_reading_id"?"anchor":n," "])))}finally{this.busy=!1}}}async undo(){if(!this.busy){this.busy=!0,this.error="";try{const t=this.kind==="undo-reading"?await ki(this.meterId,this.targetId,this.reason.trim()||void 0):await xi(this.meterId,this.targetId,this.reason.trim()||void 0);this.saved(t),this.close()}catch(t){this.error=ct(t)}finally{this.busy=!1}}}fieldMsg(t){const e=this.fieldErrors[t];return e&&e.trim()?r`<div class="msg" role="alert" data-field-error=${t}>${e}</div>`:d}readingPreview(){const t=this.preview;return this.previewError?r`<div class="alert warn" role="status" data-reading-preview="error">${this.previewError}</div>`:t?r`<div class="pv" data-reading-preview=${t.effect_reason}>
      <dl class="kv">
        <dt>${s("המערכת באותו זמן")}</dt><dd>${t.system_kwh==null?s("אין ערך"):r`<span class="num">${oe(t.system_kwh)}</span> ${s("קוט״ש")}`}</dd>
        ${t.deviation_kwh==null?d:r`<dt>${s("הפרש")}</dt><dd><span class="num ltr">${Jt(t.deviation_kwh)}</span> ${s("קוט״ש")}</dd>`}
      </dl>
      <div data-preview-message>${t.message}</div>
    </div>`:d}renderReading(){const t=(e,a)=>{this[e]=a,e!=="note"&&(this.fieldErrors={...this.fieldErrors,[e]:""},this.schedule())};return r`<sw-dialog open heading=${s("קריאה ידנית")} data-reading-dialog @close=${e=>{e.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="fld"><label for="rw">${s("תאריך ושעה")}</label>
          <div class="inp ${this.fieldErrors.when?"err":""}"><input id="rw" type="datetime-local" lang=${ht()} data-reading-when max=${Oe(new Date)} .value=${this.when} @input=${e=>t("when",e.target.value)} /></div>
          ${this.fieldMsg("when")}</div>
        <div class="fld"><label for="rv">${s("קריאת המונה")}</label>
          <div class="inp ${this.fieldErrors.value?"err":""}"><input id="rv" data-reading-value inputmode="decimal" autocomplete="off" dir="ltr" .value=${this.value} @input=${e=>t("value",e.target.value)} />
            <select data-reading-unit aria-label=${s("יחידה")} @change=${e=>{this.unit=e.target.value,this.schedule()}}>
              ${qi.map(e=>r`<option value=${e.id} ?selected=${e.id===this.unit}>${e.label}</option>`)}</select></div>
          ${this.fieldMsg("value")}</div>
        <div class="fld wide"><label for="rn">${s("הערה (לא חובה)")}</label><div class="inp"><input id="rn" data-reading-note maxlength="500" .value=${this.note} @input=${e=>t("note",e.target.value)} /></div></div>
        <div class="wide">${this.readingPreview()}</div>
        ${this.error?r`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:d}
      </div>
      <sw-button slot="footer" variant="primary" data-reading-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
    </sw-dialog>`}renderCalibrate(){const t=this.anchors(),e=this.preview,a=this.log?.first_calibration_date??"",n=(i,o)=>{this[i]=o,this.fieldErrors={...this.fieldErrors,[i]:""},this.schedule()};return r`<sw-dialog open heading=${s("כיול מונה")} data-calibrate-dialog @close=${i=>{i.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="hint wide">${s("מהתאריך: קריאה פיזית = מקדם × מונה המערכת + הפרש. חיובים שהופקו לא משתנים.")}</div>
        <div class="fld"><label for="cd">${s("בתוקף מ-")}</label>
          <div class="inp ${this.fieldErrors.date?"err":""}"><input id="cd" type="date" lang=${ht()} data-cal-date min=${a} .value=${this.date} @input=${i=>n("date",i.target.value)} /></div>
          ${this.fieldMsg("date")}</div>
        <div class="fld"><label for="cf">${s("מקדם")}</label>
          <div class="inp ${this.fieldErrors.factor?"err":""}"><input id="cf" data-cal-factor inputmode="decimal" dir="ltr" .value=${this.factor} @input=${i=>n("factor",i.target.value)} /></div>
          ${this.fieldMsg("factor")}</div>
        <div class="fld wide"><span class="lbl">${s("הפרש")}</span>
          <sw-segmented label=${s("הפרש")} value=${this.mode} @change=${i=>{this.mode=i.detail.value,this.schedule()}}
            .options=${[{value:"anchor",label:s("לפי קריאה ידנית"),disabled:!t.length,attrs:{"data-cal-mode":"anchor"}},{value:"offset",label:s("הזנה ידנית"),attrs:{"data-cal-mode":"offset"}}]}></sw-segmented></div>
        ${this.mode==="anchor"?r`<div class="fld wide"><label for="ca">${s("קריאה")}</label>
              <div class="inp ${this.fieldErrors.anchor?"err":""}"><select id="ca" data-cal-anchor @change=${i=>n("anchor",i.target.value)}>
                ${t.map(i=>r`<option value=${i.id} ?selected=${i.id===this.anchor}>${ue(i.read_at)} · ${oe(i.value_kwh)} ${s("קוט״ש")}</option>`)}</select></div>
              ${this.fieldMsg("anchor")}</div>`:r`<div class="fld wide"><label for="co">${s("הפרש (קוט״ש)")}</label>
              <div class="inp ${this.fieldErrors.offset?"err":""}"><input id="co" data-cal-offset inputmode="decimal" dir="ltr" .value=${this.offset} @input=${i=>n("offset",i.target.value)} /></div>
              ${this.fieldMsg("offset")}</div>`}
        <div class="fld wide"><label for="cn">${s("הערה (לא חובה)")}</label><div class="inp"><input id="cn" data-cal-note maxlength="500" .value=${this.note} @input=${i=>this.note=i.target.value} /></div></div>
        ${this.previewError?r`<div class="alert warn wide" role="status" data-cal-preview="error">${this.previewError}</div>`:e?r`<div class="pv wide" data-cal-preview><div>${s("מ-")}<span class="num">${qt(e.effective_date)}</span>: ${s("מקדם")} <span class="num">${e.factor}</span>, ${s("הפרש")} <span class="num ltr">${Jt(e.offset_kwh)}</span> ${s("קוט״ש")}</div></div>`:d}
        ${this.error?r`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:d}
      </div>
      <sw-button slot="footer" variant="primary" data-cal-save ?disabled=${this.busy} @click=${()=>void this.save()}>${s("שמירה")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>${s("ביטול")}</sw-button>
    </sw-dialog>`}renderUndo(){const t=this.kind==="undo-reading",e=t?this.log?.items.find(i=>i.id===this.targetId):void 0,a=t?void 0:this.log?.calibrations.find(i=>i.id===this.targetId),n=e?r`${s("הקריאה")} <span class="num">${oe(e.value_kwh)}</span> ${s("קוט״ש מ-")}<span class="num">${ue(e.read_at)}</span>`:a?r`${s("הכיול מ-")}<span class="num">${qt(a.effective_date)}</span>`:"";return r`<sw-dialog open heading=${t?s("ביטול קריאה ידנית"):s("ביטול כיול")} data-undo-dialog @close=${i=>{i.stopPropagation(),this.close()}}>
      <div class="form">
        <div class="wide">${n} ${s("תבוטל ותישאר ברשימה כמבוטלת.")}</div>
        <div class="fld wide"><label for="ur">${s("סיבה (לא חובה)")}</label><div class="inp"><input id="ur" data-undo-reason maxlength="300" .value=${this.reason} @input=${i=>this.reason=i.target.value} /></div></div>
        ${this.error?r`<div class="alert err wide" role="alert" data-dialog-error>${this.error}</div>`:d}
      </div>
      <sw-button slot="footer" variant="danger" data-undo-confirm ?disabled=${this.busy} @click=${()=>void this.undo()}>${t?s("ביטול הקריאה"):s("ביטול הכיול")}</sw-button>
      <sw-button slot="footer" @click=${()=>this.close()}>${s("חזרה")}</sw-button>
    </sw-dialog>`}render(){return this.kind==="reading"?this.renderReading():this.kind==="calibrate"?this.renderCalibrate():this.kind==="undo-reading"||this.kind==="undo-calibration"?this.renderUndo():d}};I.styles=[wt,Ns,it`
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
    `];z([y()],I.prototype,"meterId",2);z([y({attribute:!1})],I.prototype,"log",2);z([y()],I.prototype,"kind",2);z([y()],I.prototype,"targetId",2);z([y()],I.prototype,"presetFactor",2);z([y()],I.prototype,"presetAnchor",2);z([c()],I.prototype,"when",2);z([c()],I.prototype,"value",2);z([c()],I.prototype,"unit",2);z([c()],I.prototype,"note",2);z([c()],I.prototype,"preview",2);z([c()],I.prototype,"previewError",2);z([c()],I.prototype,"error",2);z([c()],I.prototype,"fieldErrors",2);z([c()],I.prototype,"busy",2);z([c()],I.prototype,"date",2);z([c()],I.prototype,"mode",2);z([c()],I.prototype,"anchor",2);z([c()],I.prototype,"factor",2);z([c()],I.prototype,"offset",2);z([c()],I.prototype,"reason",2);I=z([D("elec-reading-dialogs")],I);var Vi=Object.defineProperty,Ui=Object.getOwnPropertyDescriptor,lt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Ui(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Vi(e,a,i),i};const Te={reporting:s("מדווח"),stale:s("לא מדווח"),paused:s("מושהה")},De={reporting:"c-ok",stale:"c-warn",paused:"c-mut"},$s={hours:s("24 שעות"),days:s("30 ימים"),months:s("12 חודשים")},Ki={install:s("התקנה"),reset:s("איפוס"),replace:s("החלפת מונה"),source_change:s("שינוי מקור")};function Wi(t,e){if(!t.length)return r`<div class="mut">${s("אין נתונים לתקופה")}</div>`;const o=Math.max(...t.map(v=>v.value),1)*1.15,l=588/t.length,p=Math.min(l*.64,24),$=Math.ceil(t.length/12),h=t.reduce((v,m,g)=>m.value>t[v].value?g:v,0);return r`<svg class="chart" viewBox="0 0 ${640} ${170}" role="img" aria-label=${e} data-chart>
    ${ot`<line x1=${26} x2=${614} y1=${148} y2=${148} class="grid" />`}
    ${t.map((v,m)=>{const g=Math.max(v.value>0?2:0,v.value/o*126),B=614-(m+1)*l+(l-p)/2,gt=m===t.length-1;return ot`<rect class=${gt?"bar hi":"bar"} x=${B} y=${148-g} width=${p} height=${g} rx="3"><title>${v.label}: ${dt(v.value)}</title></rect>
        ${m%$===0||gt?ot`<text x=${B+p/2} y=${164} text-anchor="middle">${v.label}</text>`:d}
        ${gt||m===h?ot`<text x=${B+p/2} y=${143-g} text-anchor="middle" class="val">${Math.round(v.value)}</text>`:d}`})}
  </svg>`}let G=class extends Aa{constructor(){super("days"),this.points=[],this.log=null,this.logError="",this.dlgDetail=null,this.newName="",this.otherNames=[],this.nameError="",this.finalReading="",this.startReading="0",this.note="",this.replaceError=""}fetchDetail(){return Gs(this.meterId)}beforeLoad(){this.log?.meter_id!==this.meterId&&(this.log=null)}afterLoad(){this.loadSeries(),this.loadLog()}async fetchSeries(t,e,a,n){let i=await Ys(this.meterId,e,a,n);return t==="months"&&(i=Hi(i)),()=>{this.points=i}}titles(t){return{heading:Y(t).primary,subheading:Y(t).secondary}}texts(){return{loadError:s("לא ניתן לטעון את המונה"),retry:s("נסה שוב")}}async loadLog(){const t=this.meterId;try{const e=await _i(t);if(t!==this.meterId)return;this.log=e,this.logError=""}catch(e){t===this.meterId&&(this.logError=ct(e))}}openReadingsDialog(t){this.dlgDetail=t.detail,this.dlg=t.detail.kind}async onReadingsSaved(t){this.log=t.detail,this.fire("changed"),await this.refresh(),this.loadSeries()}label(t){const e=new Date(t.t);return this.range==="hours"?Es(t.t).slice(0,2):this.range==="months"?`${e.getMonth()+1}/${String(e.getFullYear()).slice(2)}`:String(e.getDate())}async toggleStatus(){const t=this.detail;if(!(!t||this.busy)){this.busy=!0,this.actionError="";try{await(t.status==="paused"?Xs(t):Qs(t)),this.fire("changed"),await this.load()}catch(e){this.actionError=ct(e)}finally{this.busy=!1}}}async confirmRemove(){const t=this.detail;if(!(!t||this.busy)){this.busy=!0,this.actionError="";try{await Js(t),this.dlg="",this.fire("changed"),this.fire("close")}catch(e){this.actionError=ct(e)}finally{this.busy=!1}}}openRename(){const t=this.detail;t&&(this.newName=t.name,this.nameError="",this.otherNames=[],this.dlg="rename",this.updateComplete.then(()=>window.setTimeout(()=>{const e=this.renderRoot.querySelector("[data-rename-input]");e?.focus(),e?.select()},80)),je().then(e=>this.otherNames=e.filter(a=>a.id!==t.id).map(a=>a.name)).catch(()=>{}))}async rename(){const t=this.detail;if(!t||this.busy)return;const e=de(this.newName,this.otherNames);if(e.name&&e.name.toLocaleLowerCase()===t.name.trim().toLocaleLowerCase()&&e.name===t.name)return void(this.dlg="");if(e.error)return void(this.nameError=e.error);this.busy=!0,this.nameError="";try{await ta(t,e.name),this.dlg="",this.fire("changed"),await this.refresh()}catch(a){a instanceof Re&&a.code==="revision_conflict"?(this.nameError=s("מישהו אחר שינה את המונה בינתיים. הנתונים רועננו, בדקו את השם ושמרו שוב."),await this.refresh()):this.nameError=ct(a)}finally{this.busy=!1}}openReplace(){this.finalReading=this.detail?.reading_kwh!=null?String(this.detail.reading_kwh):"",this.startReading="0",this.note="",this.replaceError="",this.dlg="replace"}async replace(){const t=this.detail,e=Number(this.finalReading),a=Number(this.startReading);if(!(!t||this.busy)){if(this.finalReading.trim()===""||!Number.isFinite(e)||e<0)return void(this.replaceError=s("צריך להזין קריאה סופית תקינה"));if(this.startReading.trim()===""||!Number.isFinite(a)||a<0)return void(this.replaceError=s("צריך להזין קריאת התחלה תקינה"));this.busy=!0,this.replaceError="";try{this.detail=await ea(t,{final_reading_kwh:e,start_reading_kwh:a,note:this.note.trim()||void 0}),this.dlg="",this.fire("changed")}catch(n){this.replaceError=ct(n)}finally{this.busy=!1}}}renderBody(t){const e=this.points.map(a=>({label:this.label(a),value:a.kwh}));return r`<div class="body" data-meter-card=${t.id}>
      <div class="row"><span class="chip ${De[t.status]}" data-meter-status=${t.status}>${Te[t.status]}</span></div>
      <dl class="kv">
        <dt>${s("אזור")}</dt><dd>${t.area_name??"-"}${t.floor_name?` · ${t.floor_name}`:""}</dd>
        <dt>${s("קריאה נוכחית")}</dt><dd><span class="num">${dt(t.reading_kwh)}</span> <span class="mut">${s("קוט״ש")}</span></dd>
        <dt>${s("דיווח אחרון")}</dt><dd><span class="num">${ue(t.last_report_at)}</span></dd>
        <dt>${s("יחידה")}</dt><dd>${s("קוט״ש")} · ${s("מונה מצטבר")}</dd>
        <dt>${s("בחשבונות")}</dt><dd>${t.accounts.length?t.accounts.join(", "):r`<span class="mut">-</span>`}</dd>
      </dl>
      <div class="row"><h3>${s("צריכה")}</h3><span class="sp"></span>
        ${this.rangeSeg(s("טווח"),a=>$s[a])}</div>
      ${this.chartError?r`<div class="alert err" role="alert">${s("לא ניתן לטעון את גרף הצריכה")}</div>`:Wi(e,s("גרף צריכה, {range}",{range:$s[this.range]}))}
      <h3>${s("תקופות מונה")}</h3>
      <div class="list" data-epochs>${t.epochs.map(a=>r`<div class="li"><div class="grow"><div class="t1">${Ki[a.reason]??a.reason} · <span class="num">${qt(a.started_at)}</span></div>
        <div class="t2 wrap">${s("קריאת התחלה")} <span class="num">${dt(a.start_reading_kwh)}</span>${a.ended_at?r` · ${s("עד")} <span class="num">${qt(a.ended_at)}</span>`:""}${a.note?` · ${a.note}`:""}</div></div>${a.ended_at?d:r`<span class="chip acc nodot">${s("פעיל")}</span>`}</div>`)}</div>
      <elec-meter-readings .log=${this.log} error=${this.logError} ?canManage=${this.canManage} @open-dialog=${a=>this.openReadingsDialog(a)}></elec-meter-readings>
      ${this.actionError?r`<div class="alert err" role="alert" data-meter-action-error>${this.actionError}</div>`:d}
      ${this.canManage?this.actionsRow({rename:s("שינוי שם"),replace:s("החלפת מונה"),pause:t.status==="paused"?s("חידוש"):s("השהיה"),remove:s("הסרה"),pauseDisabled:this.busy,onRename:()=>this.openRename(),onReplace:()=>this.openReplace(),onPause:()=>void this.toggleStatus(),onRemove:()=>{this.actionError="",this.dlg="remove"}}):d}
    </div>`}renderDialogs(){const t=!!this.replaceError&&!this.finalReading;return r`
      <sw-dialog ?open=${this.dlg==="remove"} heading=${s("הסרת המונה")} data-meter-remove-dialog @close=${()=>this.dlg=""}>
        <div>${s("המונה יוסר מהרשימה. הנתונים שנאספו יישמרו.")}</div>
        ${this.actionError&&this.dlg==="remove"?r`<div class="alert err" role="alert">${this.actionError}</div>`:d}
        <sw-button slot="footer" variant="danger" data-meter-remove-confirm ?disabled=${this.busy} @click=${()=>void this.confirmRemove()}>${s("הסרה")}</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>${s("ביטול")}</sw-button>
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="rename"} heading=${s("שינוי שם המונה")} data-meter-rename-dialog @close=${()=>this.dlg=""}>
        ${(()=>{const e=de(this.newName,this.otherNames);return e.name===this.detail?.name&&(e.duplicate=!1),r`<div class="fld">
            <label for="rn">${s("שם המונה")}</label>
            <div class="inp ${this.nameError?"err":""}"><input id="rn" data-rename-input autocomplete="off" aria-invalid=${this.nameError?"true":"false"} aria-describedby="rn-msg" .value=${this.newName}
              @input=${n=>{this.newName=n.target.value,this.nameError=""}}
              @keydown=${n=>{n.key==="Enter"&&(n.preventDefault(),this.rename())}} /></div>
            <div id="rn-msg">
              ${this.nameError?r`<div class="msg" role="alert" data-rename-error>${this.nameError}</div>`:d}
              ${!this.nameError&&e.duplicate?r`<div class="msg" role="alert" data-rename-dup>${Ps}</div>`:d}
              <div class="mut" data-rename-hint>${oi}</div>
            </div>
          </div>`})()}
        <sw-button slot="footer" variant="primary" data-rename-save ?disabled=${this.busy||de(this.newName,this.otherNames).duplicate&&this.newName.trim()!==this.detail?.name} @click=${()=>void this.rename()}>${s("שמירה")}</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>${s("ביטול")}</sw-button>
      </sw-dialog>
      <sw-dialog ?open=${this.dlg==="replace"} heading=${s("החלפת מונה")} data-meter-replace-dialog @close=${()=>this.dlg=""}>
        <div class="form">
          <sw-field class="fld" label=${s("קריאה סופית של המונה הישן")} unit=${s("קוט״ש")}><input id="fr" class=${t?"err":""} aria-invalid=${t?"true":"false"} data-replace-final inputmode="decimal" .value=${this.finalReading} @input=${e=>this.finalReading=e.target.value} /></sw-field>
          <sw-field class="fld" label=${s("קריאת התחלה של המונה החדש")} unit=${s("קוט״ש")}><input id="sr" data-replace-start inputmode="decimal" .value=${this.startReading} @input=${e=>this.startReading=e.target.value} /></sw-field>
          <sw-field class="fld wide" label=${s("הערה (לא חובה)")}><input id="nt" data-replace-note .value=${this.note} @input=${e=>this.note=e.target.value} /></sw-field>
          ${this.replaceError?r`<div class="alert err wide" role="alert" data-replace-error>${this.replaceError}</div>`:d}
        </div>
        <sw-button slot="footer" variant="primary" data-replace-save ?disabled=${this.busy} @click=${()=>void this.replace()}>${s("החלפה")}</sw-button>
        <sw-button slot="footer" @click=${()=>this.dlg=""}>${s("ביטול")}</sw-button>
      </sw-dialog>
      ${this.dlg==="reading"||this.dlg==="calibrate"||this.dlg==="undo-reading"||this.dlg==="undo-calibration"?r`<elec-reading-dialogs .meterId=${this.meterId} .log=${this.log} .kind=${this.dlg} .targetId=${this.dlgDetail?.id??""} .presetFactor=${this.dlgDetail?.factor??""}
            .presetAnchor=${this.dlgDetail?.anchor??""} @close=${()=>{this.dlg="",this.dlgDetail=null}} @saved=${e=>void this.onReadingsSaved(e)}></elec-reading-dialogs>`:d}`}};G.styles=[wt,ja,it`
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
    `];lt([c()],G.prototype,"points",2);lt([c()],G.prototype,"log",2);lt([c()],G.prototype,"logError",2);lt([c()],G.prototype,"dlgDetail",2);lt([c()],G.prototype,"newName",2);lt([c()],G.prototype,"otherNames",2);lt([c()],G.prototype,"nameError",2);lt([c()],G.prototype,"finalReading",2);lt([c()],G.prototype,"startReading",2);lt([c()],G.prototype,"note",2);lt([c()],G.prototype,"replaceError",2);G=lt([D("elec-meter-card")],G);function Hi(t){const e=new Map;for(const a of t){const n=new Date(a.t),i=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-01T00:00:00Z`;e.set(i,(e.get(i)??0)+a.kwh)}return[...e.entries()].map(([a,n])=>({t:a,kwh:Math.round(n*100)/100}))}var Zi=Object.defineProperty,Gi=Object.getOwnPropertyDescriptor,Yt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Gi(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Zi(e,a,i),i};const Yi={search:f("חיפוש מונה"),view:f("תצוגה"),cards:f("כרטיסים"),table:f("טבלה"),area:f("אזור"),areas:f("אזורים"),allAreas:f("כל האזורים"),fold:f("כיווץ"),unfold:f("הרחבה"),addMeter:f("הוספת מונה"),loadError:f("לא ניתן לטעון את המונים"),retry:f("נסה שוב")};let St=class extends Fa{constructor(){super({viewKey:"sw.elec.meters.view",collapseKey:"sw.elec.meters.collapsed",route:"/infra/electricity/meters",access:j,onAccess:gs}),this.picked=[],this.pickedNames={},this.nameTouched=!1,this.adding=!1,this.addErrors=[]}texts(){return Yi}fetchMeters(){return je()}readBuildingFilter(){return sa()}inBuilding(t,e){return aa(t.buildings,e)}alsoTag(t){const e=ia(t.buildings,this.building,this.buildingMeta);return e?r`<span class="mut" data-also> · ${e}</span>`:d}areaTree(){return ra(this.scoped())}inArea(t,e){const a=e.startsWith("floor:")?e.slice(6):"";return a?(t.floor_id??t.floor_name??"_none")===a:t.area_id===e}matchesSearch(t,e){return Os(t).includes(e)||(t.area_name??"").toLowerCase().includes(e)}flash(t){this.toaster.show(t,{ms:6e3})}openAdd(){this.picked=[],this.pickedNames={},this.nameTouched=!1,this.addErrors=[],this.setParams({add:"1",meter:null})}closeAdd(){this.setParams({add:null})}onPick(t){this.picked=t.detail.selected;const e={};for(const a of this.picked)e[a]=this.pickedNames[a]??t.detail.names?.[a]??"";this.pickedNames=e}nameChecks(){return this.picked.map(t=>{const e=[...this.meters.map(a=>a.name),...this.picked.filter(a=>a!==t).map(a=>this.pickedNames[a]??"")];return{id:t,...de(this.pickedNames[t]??"",e)}})}async confirmAdd(){if(!this.picked.length||this.adding)return;this.nameTouched=!0;const t=this.nameChecks();if(t.some(a=>a.error))return;this.adding=!0,this.addErrors=[];const e=await na(t.map(a=>({entity_id:a.id,name:a.name})));this.adding=!1,e.added.length&&(await this.load(!1),this.flash(e.added.length===1?f("המונה נוסף"):f("{n} מונים נוספו",{n:e.added.length}))),e.failed.length?(this.addErrors=e.failed.map(a=>a.message),this.picked=e.failed.map(a=>a.entity_id)):(this.picked=[],this.closeAdd())}statusChip(t){return r`<span class="chip ${De[t.status]}" data-status=${t.status}>${Te[t.status]}</span>`}statusCellChip(t){return r`<span class="chip" data-tone=${qa(De[t.status])} data-status=${t.status}>${Te[t.status]}</span>`}staleNote(t){return t.status==="stale"&&t.last_report_at?r` <span class="mut">${f("מ-")}<span class="num">${Es(t.last_report_at)}</span></span>`:d}openMeter(t){this.setParams({meter:t.id})}renderTiles(){const t=la(this.scoped());return r`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${f("היום")}</div><div class="v"><span class="num">${rs(t.today_kwh)}</span><span class="u">${f("קוט״ש")}</span></div></div>
      <div class="tile"><div class="k">${f("מתחילת החודש")}</div><div class="v"><span class="num" data-month>${this.meters.some(e=>e.month_kwh!=null)?rs(t.month_kwh):"-"}</span><span class="u">${f("קוט״ש")}</span></div></div>
      <div class="tile"><div class="k">${f("מדווחים")}</div><div class="v"><span class="num" data-count="reporting">${t.reporting}</span><span class="u">${f("מתוך {n}",{n:t.total})}</span></div></div>
      <div class="tile" ?data-warn=${t.stale>0}><div class="k">${f("לא מדווחים")}</div><div class="v" style=${t.stale?"color:var(--sw-warning-text)":""}><span class="num" data-count="stale">${t.stale}</span></div></div>
    </div>`}entityLine(t,e){const a=Y(t).secondary;return a?r`<div class="${e} ent" data-meter-entity title=${f("שם הישות")}>${a}</div>`:d}tableColumns(t){const e=[{key:"name",label:f("שם"),kind:"truncate",cellTitle:a=>[Y(a).primary,Y(a).secondary].filter(Boolean).join(" - "),render:a=>r`<span class="t1">${Y(a).primary}</span>${this.entityLine(a,"t2")}`},{key:"area",label:f("אזור"),render:a=>r`${a.area_name??"-"}${this.narrow?d:r`<span class="mut"> · ${a.floor_name??""}</span>`}${this.alsoTag(a)}`},{key:"reading",label:f("קריאה נוכחית (קוט״ש)"),kind:"num",render:a=>dt(a.reading_kwh)},{key:"today",label:f("היום"),kind:"num",render:a=>dt(a.today_kwh)},{key:"month",label:f("מתחילת החודש"),kind:"num",render:a=>dt(a.month_kwh)},{key:"status",label:f("מצב"),kind:"status",render:a=>r`${this.statusCellChip(a)}${this.staleNote(a)}`}];return t&&!this.narrow&&e.push({key:"accounts",label:f("בחשבונות"),render:a=>a.accounts_count?String(a.accounts_count):r`<span class="mut">-</span>`}),e}renderTable(t){const e=t.some(a=>a.accounts_count!=null);return r`<sw-table class="t card flush scrollx desk-only" data-meters-table .columns=${this.tableColumns(e)} .rows=${t}
      .rowAttrs=${a=>({"data-meter":String(a.id)})} @row-select=${a=>this.openMeter(a.detail.row)}></sw-table>`}renderCards(t){return r`<div class="cards desk-only" data-meters-cards>${t.map(e=>r`<div class="card mcard" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="row"><b>${Y(e).primary}</b><span class="sp"></span>${this.statusChip(e)}</div>
      ${this.entityLine(e,"mut")}
      <div class="mut">${e.area_name??""}${e.floor_name?` · ${e.floor_name}`:""}${this.alsoTag(e)}</div>
      <div class="row" style="align-items:baseline"><span class="big num">${dt(e.today_kwh)}</span><span class="mut">${f("קוט״ש היום")}</span><span class="sp"></span><span class="mut num">${dt(e.reading_kwh)}</span></div></div>`)}</div>`}renderRows(t){return r`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${t.map(e=>r`<div class="li pick" role="button" tabindex="0" data-meter=${e.id} @click=${()=>this.openMeter(e)} @keydown=${a=>this.onKey(a,e)}>
      <div class="grow"><div class="t1">${Y(e).primary}</div>${this.entityLine(e,"t2")}<div class="t2">${e.area_name??""}${this.alsoTag(e)} · ${f("היום")} <span class="num">${dt(e.today_kwh)}</span> ${f("קוט״ש")}</div></div>
      <div style="text-align:end">${this.statusChip(e)}<div class="t2 num" style="margin-block-start:4px">${dt(e.reading_kwh)}</div></div></div>`)}</div>`}renderNames(){return r`<div class="names" data-add-names>
      ${this.nameChecks().map((t,e)=>{const a=t.error&&(this.nameTouched||t.duplicate);return r`<div class="fld">
          <label for="mn${e}">${this.picked.length>1?f("שם המונה {n}",{n:e+1}):f("שם המונה")}</label>
          <div class="inp ${a?"err":""}"><input id="mn${e}" data-add-name=${t.id} autocomplete="off" aria-invalid=${a?"true":"false"} .value=${this.pickedNames[t.id]??""}
            @input=${n=>this.pickedNames={...this.pickedNames,[t.id]:n.target.value}} /></div>
          ${a?r`<div class="msg" role="alert" data-add-name-error>${t.error}</div>`:d}
        </div>`})}
    </div>`}renderAdd(){const t=this.params.get("add")==="1"&&this.access.manage;return r`<sw-dialog ?open=${t} wide heading=${f("הוספת מונה")} data-add-dialog @close=${()=>this.closeAdd()}>
      ${t?r`<elec-meter-picker mode="register" multi .selected=${this.picked} @change=${e=>this.onPick(e)}></elec-meter-picker>`:d}
      ${t&&this.picked.length?this.renderNames():d}
      ${this.addErrors.length?r`<div class="errs" data-add-errors>${this.addErrors.map(e=>r`<div class="alert err" role="alert">${e}</div>`)}</div>`:d}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked.length||this.adding||this.nameChecks().some(e=>e.duplicate)} @click=${()=>void this.confirmAdd()}>${f("הוספה")}${this.picked.length>1?` (${this.picked.length})`:""}</sw-button>
      <sw-button slot="footer" data-add-cancel @click=${()=>this.closeAdd()}>${f("ביטול")}</sw-button>
    </sw-dialog>`}frame(t,e){return r`<div data-elec="meters" data-state=${t} aria-busy=${t==="loading"?"true":d} style=${t==="ready"?"display:flex;flex-direction:column;gap:14px":d}>${e}</div>`}renderForbidden(){return r`<sw-state-panel state="forbidden" data-elec="meters" data-state="forbidden"></sw-state-panel>`}skeletonRow(t){return r`<div class="row" style="padding:10px 0">${t}</div>`}renderEmpty(t){return r`<sw-state-panel icon="bolt" state="empty" heading=${f("אין מונים עדיין")}>${t}</sw-state-panel>`}renderNoResults(){return r`<sw-state-panel icon="bolt" state="empty" compact heading=${f("לא נמצאו מונים")} data-no-results></sw-state-panel>`}renderCard(t){return r`<elec-meter-card .meterId=${t} ?canManage=${this.access.manage} @close=${()=>this.setParams({meter:null})} @changed=${()=>void this.load(!1)}></elec-meter-card>`}};St.styles=[wt,La,it`
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
    `,Ba,it`
      @media (max-width: 899px) {
        .phone-only {
          display: flex;
        }
        .desk-only {
          display: none;
        }
      }
      /* R5 fix: the R5 type (bolder chips and names) made the meters table 8 px wider than its card at 1024 px (classic); the cells
         give 2 px of inline padding a side back so the table fits its card again. The sensor's name line is cut at 320 px. */
      sw-table[data-meters-table] {
        --sw-table-cell-pad: 12px 10px;
        --sw-table-trunc: 320px;
      }
    `,Cs];Yt([c()],St.prototype,"picked",2);Yt([c()],St.prototype,"pickedNames",2);Yt([c()],St.prototype,"nameTouched",2);Yt([c()],St.prototype,"adding",2);Yt([c()],St.prototype,"addErrors",2);St=Yt([D("elec-meters-page")],St);var Xi=Object.defineProperty,Qi=Object.getOwnPropertyDescriptor,yt=(t,e,a,n)=>{for(var i=n>1?void 0:n?Qi(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Xi(e,a,i),i};const fs=[{id:"holiday",label:s("חג (כמו שבת)")},{id:"holiday_eve",label:s("ערב חג (כמו שישי)")},{id:"regular",label:s("יום רגיל")}],bs=t=>xs[ks[new Date(`${t}T12:00:00Z`).getUTCDay()]];let ft=class extends Q{constructor(){super(...arguments),this.st="loading",this.year=Number(st().slice(0,4)),this.data=null,this.busy=!1,this.error="",this.note="",this.add={date:"",kind:"holiday",name:""},this.addErr=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.st="loading";try{this.data=await b().getCalendar(this.year),this.st="ready"}catch(t){this.error=T(t),this.st=Fe(t)?"forbidden":"error"}}setYear(t){this.year=t,this.note="",this.load()}async run(t){if(!this.busy){this.busy=!0,this.error="";try{const e=await t();this.data=e.year===this.year?e:await b().getCalendar(this.year);const a=e.drafts_to_recalculate??0;this.note=a?a===1?s('טיוטה אחת מושפעת מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".'):s('{n} טיוטות מושפעות מהשינוי. השינוי יופיע בהן אחרי "חישוב מחדש".',{n:a}):""}catch(e){this.error=T(e)}finally{this.busy=!1}}}setKind(t,e){if(!this.data)return;const a=this.data.revision;this.run(()=>b().setCalendarDay(t.date,e,t.name_he,a))}restore(t){if(!this.data)return;const e=this.data.revision;this.run(()=>b().removeCalendarDay(t.date,e))}addDay(){const t=this.add;if(this.addErr=V(t.date)?"":s("צריך לבחור תאריך"),this.addErr||!this.data)return;const e=this.data.revision;this.run(async()=>{const a=await b().setCalendarDay(t.date,t.kind,t.name,e);return this.add={date:"",kind:"holiday",name:""},Number(t.date.slice(0,4))!==this.year&&(this.year=Number(t.date.slice(0,4))),a})}render(){const t=j();if(!t.view&&!t.bills&&!t.manage)return r`<div class="page" data-elec="settings-calendar" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה"))}</div>`;if(this.st==="loading")return r`<div class="page" data-elec="settings-calendar" data-state="loading">${at(5)}</div>`;if(this.st==="forbidden")return r`<div class="page" data-elec="settings-calendar" data-state="forbidden">${E("forbidden","lock",s("אין הרשאה"))}</div>`;if(this.st==="error"||!this.data)return r`<div class="page" data-elec="settings-calendar" data-state="error">${E("error","warning",s("לא ניתן לטעון את הימים המיוחדים"),{label:s("נסה שוב"),run:()=>void this.load()})}</div>`;const e=this.data,a=t.manage,n=e.days;return r`<div class="page" data-elec="settings-calendar" data-state="ready">
      ${this.error?C("err",this.error):d}
      ${this.note?C("info",this.note):d}
      <div class="card ${this.phone?"":"flush"}">
        <div class="hd"><b class="h3">${s("ימים מיוחדים")}</b>
          <div class="row" role="group" aria-label=${s("שנה")}><sw-button variant="ghost" size="sm" iconOnly icon="chevronBack" label=${s("השנה הקודמת")} data-year-prev @click=${()=>this.setYear(this.year-1)}></sw-button><b class="num" data-year>${this.year}</b><sw-button variant="ghost" size="sm" iconOnly icon="chevron" label=${s("השנה הבאה")} data-year-next @click=${()=>this.setYear(this.year+1)}></sw-button></div>
          <span class="sp"></span>
          <sw-segmented label=${s("מקור החגים")} value=${e.generator} ?disabled=${!a||this.busy}
        @change=${i=>{const o=i.detail.value;e.generator!==o&&this.run(()=>b().setCalendarGenerator(o,e.revision,this.year))}}
        .options=${[{value:"israel",label:s("חגי ישראל מחושבים"),attrs:{"data-generator":"israel"}},{value:"none",label:s("ימים ידניים בלבד"),attrs:{"data-generator":"none"}}]}></sw-segmented>
        </div>
        ${n.length?this.phone?r`<div class="list" data-calendar>${n.map(i=>r`<div class="li" data-day=${i.date} data-kind=${i.kind} style="flex-wrap:wrap"><div class="grow"><div class="t1">${i.name_he||i.kind_he}</div><div class="t2">${u(S(i.date))} · ${s("יום {weekday}",{weekday:bs(i.date)})} · ${i.source==="manual"?s("ידני"):s("מחושב")}</div></div>${this.kindCell(i,a)}
                ${a&&i.source==="manual"?r`<sw-button variant="ghost" size="sm" data-restore=${i.date} ?disabled=${this.busy} @click=${()=>this.restore(i)}>${i.generated?s("החזרה לחישוב"):s("הסרה")}</sw-button>`:d}</div>`)}</div>`:r`<sw-table bare static-rows class="t" data-calendar .columns=${this.dayColumns(a)} .rows=${n}
                .rowAttrs=${i=>({"data-day":String(i.date),"data-kind":String(i.kind)})}></sw-table>`:r`<div class="mut" style="padding:0 16px 16px" data-calendar-empty>${s("אין ימים מיוחדים בשנה הזו.")}</div>`}
      </div>
      ${a?r`<div class="card" data-calendar-add><div class="hd"><b class="h3">${s("הוספת יום")}</b></div>
        <div class="form">
          <div class="fld"><label for="cd">${s("תאריך")}</label><input id="cd" type="date" lang=${ht()} class="ltr ${this.addErr?"err":""}" data-add-date .value=${this.add.date} @change=${i=>{this.add={...this.add,date:i.target.value},this.addErr=""}} />${this.addErr?r`<div class="msg" role="alert">${this.addErr}</div>`:d}</div>
          <div class="fld"><label for="ck">${s("נחשב")}</label><select id="ck" data-add-kind @change=${i=>this.add={...this.add,kind:i.target.value}}>${fs.map(i=>r`<option value=${i.id} .selected=${i.id===this.add.kind}>${i.label}</option>`)}</select></div>
          <div class="fld wide"><label for="cn">${s("שם (לא חובה)")}</label><input id="cn" data-add-name maxlength="60" .value=${this.add.name} @input=${i=>this.add={...this.add,name:i.target.value}} /></div>
        </div>
        <div class="row" style="margin-block-start:12px"><sw-button variant="primary" data-add-day ?disabled=${this.busy} @click=${()=>this.addDay()}>${s("הוספה")}</sw-button></div></div>`:d}
      <div class="mut">${e.note_he}</div>
    </div>`}dayColumns(t){return[{key:"date",label:s("תאריך"),render:e=>r`<span class="num">${S(e.date)}</span>`},{key:"weekday",label:s("יום"),render:e=>bs(e.date)},{key:"name",label:s("שם"),render:e=>r`<b>${e.name_he||(e.generated?.name_he??"")}</b>`},{key:"kind",label:s("נחשב"),render:e=>this.kindCell(e,t)},{key:"source",label:s("מקור"),kind:"status",render:e=>e.source==="manual"?r`<span class="chip" data-tone="warn" data-nodot>${s("ידני")}</span>`:r`<span class="chip" data-nodot>${s("מחושב")}</span>`},{key:"act",label:"",kind:"actions",render:e=>t&&e.source==="manual"?r`<sw-button variant="ghost" size="sm" data-restore=${e.date} ?disabled=${this.busy} @click=${()=>this.restore(e)}>${e.generated?s("החזרה לחישוב"):s("הסרה")}</sw-button>`:d}]}kindCell(t,e){return e?r`<sw-field part="field"><select aria-label=${s("סוג היום {date}",{date:S(t.date)})} data-kind-select=${t.date} ?disabled=${this.busy} @change=${a=>this.setKind(t,a.target.value)}>${fs.map(a=>r`<option value=${a.id} .selected=${a.id===t.kind}>${a.label}</option>`)}</select></sw-field>`:r`<span>${t.kind_he}</span>`}};yt([c()],ft.prototype,"st",2);yt([c()],ft.prototype,"year",2);yt([c()],ft.prototype,"data",2);yt([c()],ft.prototype,"busy",2);yt([c()],ft.prototype,"error",2);yt([c()],ft.prototype,"note",2);yt([c()],ft.prototype,"add",2);yt([c()],ft.prototype,"addErr",2);ft=yt([D("elec-settings-calendar")],ft);var Ji=Object.defineProperty,tr=Object.getOwnPropertyDescriptor,_t=(t,e,a,n)=>{for(var i=n>1?void 0:n?tr(e,a):e,o=t.length-1,l;o>=0;o--)(l=t[o])&&(i=(n?l(e,a,i):l(i))||i);return n&&i&&Ji(e,a,i),i};const Bt=[{key:"raw_retention_days",label:f("קריאות גולמיות"),usage:"raw_bytes",owner:"system"},{key:"interval_retention_months",label:f("נתוני רבע שעה"),usage:"interval_bytes",owner:"system"},{key:"bill_retention_years",label:f("חיובים וקבצי PDF"),usage:"bill_bytes",owner:"system"},{key:"draft_retention_days",label:f("טיוטות שלא הונפקו"),usage:"draft_bytes",owner:"manage"}],er={ימים:f("ימים"),חודשים:f("חודשים"),שנים:f("שנים")};let pt=class extends Ot{constructor(){super(...arguments),this.bubbleSkin=new Ut(this),this.data=null,this.phase="loading",this.error="",this.values={},this.saving=!1,this.saveError="",this.saved=!1,this.access=j()}connectedCallback(){super.connectedCallback(),this.stop=gs(t=>this.access=t),this.load()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}async load(){this.phase="loading";try{const t=await oa();this.data=t,this.values=Object.fromEntries(Bt.map(e=>[e.key,String(t[e.key])])),this.phase="ready"}catch(t){this.error=ct(t),this.phase="error"}}editable(t){return!!this.data?.editable[t.key]}problem(t){const e=(this.values[t.key]??"").trim(),a=this.data?.ranges[t.key]??Ye[t.key],n=Number(e);return e===""||!Number.isInteger(n)||n<a.min||n>a.max?f("הערך חייב להיות בין {min} ל-{max}",{min:a.min,max:a.max}):""}changed(){const t={};if(!this.data)return t;for(const e of Bt){const a=Number(this.values[e.key]);this.editable(e)&&!this.problem(e)&&a!==this.data[e.key]&&(t[e.key]=a)}return t}async save(){const t=this.changed();if(!(!Object.keys(t).length||this.saving)){this.saving=!0,this.saveError="",this.saved=!1;try{this.data=await da(t),this.values=Object.fromEntries(Bt.map(e=>[e.key,String(this.data[e.key])])),this.saved=!0}catch(e){this.saveError=ct(e)}finally{this.saving=!1}}}render(){if(!this.access.system&&!this.access.manage)return r`<sw-state-panel state="forbidden" data-elec="retention" data-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return r`<div data-elec="retention" data-state="loading" aria-busy="true" class="card">${[0,1,2,3].map(()=>r`<div class="row" style="padding:12px 0"><div class="skl" style="inline-size:36%"></div><span class="sp"></span><div class="skl" style="inline-size:20%"></div></div>`)}</div>`;if(this.phase==="error"||!this.data)return r`<div data-elec="retention" data-state="error"><sw-state-panel state="error" heading=${f("לא ניתן לטעון את ההגדרות")} hint=${this.error} actionLabel=${f("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel></div>`;const t=this.data,e=Bt.reduce((i,o)=>i+(t.usage[o.usage]??0),0),a=Object.keys(this.changed()).length>0,n=Bt.some(i=>this.editable(i)&&this.problem(i));return r`<div data-elec="retention" data-state="ready" class="card">
      <div class="list">${Bt.map(i=>{const o={...Ye[i.key],...t.ranges[i.key]},l=this.editable(i)?this.problem(i):"",p=Number(this.values[i.key]),$=!l&&p!==t[i.key];return r`<div class="rowx" data-retention=${i.key}>
          <div class="grow"><div class="t1">${i.label}</div>
            <div class="t2">${f("{min} עד {max}",{min:o.min,max:o.max})} · ${f("בשימוש")} <span class="num" data-usage>${t.usage[i.usage]==null?"-":Ee(t.usage[i.usage])}</span>${$&&i.key!=="draft_retention_days"?r` · ${f("הערכה לערך החדש")} <span class="num" data-estimate>${Ee(ca(i.key,p,t.meter_count))}</span>`:d}</div></div>
          <sw-field class="fld" unit=${er[o.unit]??o.unit}><input class="ltr ${l?"err":""}" inputmode="numeric" data-retention-input=${i.key} aria-label=${i.label} aria-invalid=${l?"true":"false"} ?disabled=${!this.editable(i)} .value=${this.values[i.key]??""}
            @input=${h=>{this.saved=!1,this.values={...this.values,[i.key]:h.target.value}}} />
            ${l?r`<div class="msg" role="alert" slot="message" data-retention-error=${i.key}>${l}</div>`:d}</sw-field>
        </div>`})}</div>
      ${this.saveError?r`<div class="alert err" role="alert" style="margin-block-start:12px" data-save-error>${this.saveError}</div>`:d}
      <div class="foot"><span class="mut">${f("נתונים בתוך תקופה של טיוטה פתוחה לא נמחקים.")}</span><span class="mut">${f("סה״כ בשימוש")} <span class="num">${Ee(e)}</span></span><span class="sp"></span>
        ${this.saved?r`<span class="ok" role="status" data-saved>${f("נשמר")}</span>`:d}
        <sw-button variant="primary" data-retention-save ?disabled=${!a||n||this.saving} @click=${()=>void this.save()}>${f("שמירה")}</sw-button></div>
    </div>`}};pt.styles=[wt,it`
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
    `,Cs];_t([c()],pt.prototype,"data",2);_t([c()],pt.prototype,"phase",2);_t([c()],pt.prototype,"error",2);_t([c()],pt.prototype,"values",2);_t([c()],pt.prototype,"saving",2);_t([c()],pt.prototype,"saveError",2);_t([c()],pt.prototype,"saved",2);_t([c()],pt.prototype,"access",2);pt=_t([D("elec-settings-retention")],pt);
