import{g as I,j as $,ax as E,b as l,A as c,a5 as M,cw as st,i as at,k as U,b5 as D,bA as q,bm as ht,bv as ut,u as $t,a as j,dE as F}from"./index-Cwrvr-7C.js";import{t as e}from"./wiskey-DlGj9nAm.js";import{s as vt,c as ft,d as mt}from"./settings-C0oL8AFl.js";import{U as gt,a as bt}from"./wiskey-format-C-N8adHH.js";import"./sw-logo-art-PLtEZJxU.js";const it=["overview","operations","investigations","capacity","events","exports"],wt="#/system/intercom-operations";function yt(t){return it.includes(t)?t:"overview"}const r={title:e("תפעול האינטרקום"),sub:e("מה קורה במערכת האינטרקום: פעולות סנכרון, משימות, ציר זמן לחקירה, קיבולת העמדות ודוח האירועים"),tabs:{overview:e("סיכום"),operations:e("פעולות ומשימות"),investigations:e("חקירות"),capacity:e("קיבולת ומגמות"),events:e("דוח אירועים"),exports:e("ייצוא")},loading:e("טוען את נתוני התפעול…"),forbiddenTitle:e("אין לכם הרשאה לתפעול האינטרקום"),forbiddenHint:e("נדרשת הרשאת צפייה בבקרת כניסה ברמת ההתקנה כולה."),errorTitle:e("לא ניתן לטעון את תפעול האינטרקום"),unavailable:e("מערכת האינטרקום המותקנת אינה מציעה את התצוגה הזו."),retry:e("נסו שוב"),refresh:e("רענון"),fetchedAt:e("עודכן"),empty:e("אין מה להציג"),kpi:{stations:e("עמדות"),online:e("מחוברות"),offline:e("לא מחוברות"),pending_users:e("ממתינים לסנכרון"),sync_problems:e("עמדות עם תקלת סנכרון"),near_capacity:e("קרובות למגבלה")},stationsTitle:e("העמדות"),table:{station:e("עמדה"),state:e("מצב"),sync:e("סנכרון"),pending:e("ממתינים"),users:e("משתמשים"),cards:e("כרטיסים"),use:e("ניצולת"),error:e("שגיאה אחרונה")},online:e("מחוברת"),offline:e("לא מחוברת"),opsTitle:e("פעולות"),opsHint:e("סנכרון של אדם לעמדה, עריכות מרוכזות וייבוא קבצים, עם ההתקדמות של כל אחת."),jobsTitle:e("משימות מרוכזות"),jobsHint:e("משימות עריכה מרוכזת וייבוא שנוצרו דרך Arx. שורות שנכשלו מופיעות עם קוד השגיאה."),jobsEmpty:e("אין משימות מרוכזות."),filterKind:e("סוג"),filterState:e("מצב"),filterStation:e("עמדה"),filterSearch:e("חיפוש"),all:e("הכול"),people:t=>t===1?e("אדם אחד"):e("{n} אנשים",{n:t}),stationsCount:t=>t===1?e("עמדה אחת"):e("{n} עמדות",{n:t}),progress:(t,s)=>e("{done} מתוך {total}",{done:t,total:s}),cancel:e("ביטול המשימה"),cancelTitle:e("לבטל את המשימה?"),cancelBody:e("שורות שעדיין לא נשמרו יבוטלו. שורות שכבר נשמרו ממשיכות להסתנכרן לעמדות. הפעולה נשלחת פעם אחת."),cancelConfirm:e("כן, לבטל"),cancelKeep:e("השארת המשימה"),cancelled:e("המשימה בוטלה."),errorsCsv:e("הורדת השורות שנכשלו"),rowsFailed:t=>t===1?e("שורה אחת נכשלה"):e("{n} שורות נכשלו",{n:t}),row:e("שורה"),more:e("הבא"),prev:e("הקודם"),stale:e("הנתונים השתנו מאז הטעינה - רעננו כדי לראות את המצב העדכני."),invTitle:e("ציר זמן לחקירה"),invHint:e("כניסות, שינויים וסנכרון זה לצד זה, 30 הימים האחרונים. סמיכות בזמן אינה מוכיחה קשר בין אירועים."),invSource:e("מקור"),invFrom:e("מתאריך"),invTo:e("עד תאריך"),hiddenFields:e("חלק מהפרטים מוסתרים לפי ההרשאות שלכם."),storageFailed:e("שמירת האירועים במערכת האינטרקום נכשלה - ייתכן שחסרים אירועים."),operator:e("מפעיל"),capTitle:e("קיבולת לפי עמדה"),capHint:e("משתמשים וכרטיסים מול המגבלה שהעמדה מדווחת. התחזית היא הערכה לפי הצמיחה שנמדדה."),trendTitle:e("מגמה"),trendHint:e("מספר המשתמשים בעמדה לאורך זמן, מתוך הדגימות ש־Arx שמר. הקו האופקי הוא המגבלה שהעמדה מדווחת."),trendNone:e("עדיין אין מספיק דגימות כדי לצייר מגמה לעמדה הזו. כל צפייה בדף שומרת דגימה חדשה כשיש."),days:t=>e("{n} ימים",{n:t}),usersOf:(t,s)=>t===null?"—":s===null?`${t}`:`${t} / ${s}`,daysToLimit:t=>e("כ־{n} ימים עד המגבלה",{n:Math.round(t)}),growth:t=>e("{g} ביום",{g:`${t>0?"+":""}${t}`}),sampledAt:e("נדגם"),evTitle:e("דוח אירועים"),evHint:e("סיכום יומן הכניסות: לפי יום (באזור הזמן של העמדה), לפי עמדה, אמצעי זיהוי וחריגות. מספרים בלבד, ללא פרטי אנשים."),granted:e("אושרו"),denied:e("נדחו"),other:e("אירועים אחרים"),total:e('סה"כ'),byDay:e("כניסות לפי יום"),byStation:e("לפי עמדה"),methods:e("אמצעי זיהוי"),anomalies:e("חריגות"),showTable:e("הצגה כטבלה"),hideTable:e("הסתרת הטבלה"),expTitle:e("ייצוא"),expHint:e("קבצי CSV שנוצרים ב־Arx. כל ייצוא נרשם ביומן הפעולות."),expInventory:e("מלאי העמדות"),expInventoryHint:e("דגם, קושחה, סנכרון וקיבולת של כל עמדה, מהנתונים השמורים (בלי פנייה לעמדות)."),expAudit:e("יומן השינויים של מערכת האינטרקום"),expAuditHint:e("מה שונה במערכת האינטרקום ב־30 הימים האחרונים ועל ידי מי."),download:e("הורדה"),downloaded:t=>t===null?e("הקובץ הורד."):e("הקובץ הורד ({n} שורות).",{n:t}),adminOnly:e("הייצוא זמין למנהלי בקרת הכניסה בלבד.")},C={pending:e("ממתין"),failed:e("נכשל"),verified:e("אומת בעמדה"),settled:e("הסתיים"),saved:e("נשמר"),unknown:e("לא ידוע"),paused:e("מושהה"),running:e("פועל"),completed:e("הושלם"),completed_with_errors:e("הושלם עם שגיאות"),cancelled:e("בוטל"),synced:e("מסונכרן"),syncing:e("מסתנכרן"),offline:e("לא מחובר"),conflict:e("התנגשות"),error:e("שגיאה"),delete_pending:e("מחיקה ממתינה"),granted:e("אושר"),denied:e("נדחה")},N={sync:e("סנכרון"),bulk:e("עריכה מרוכזת"),csv:e("ייבוא קובץ"),unknown:e("לא ידוע")},P={access:e("כניסה"),change:e("שינוי"),sync:e("סנכרון"),unknown:e("לא ידוע")},V={"sync/user_station":e("סנכרון אדם לעמדה"),"bulk/csv_import":e("ייבוא קובץ"),"bulk/enable":e("הפעלה מרוכזת"),"bulk/disable":e("השבתה מרוכזת"),"bulk/assign":e("שיוך מרוכז"),"bulk/unassign":e("הסרת שיוך מרוכזת"),"bulk/delete":e("מחיקה מרוכזת"),"bulk/renew":e("חידוש מרוכז"),"users/create":e("יצירת אדם"),"users/update":e("עדכון אדם"),"users/delete":e("מחיקת אדם"),"users/archive":e("העברה לארכיון"),access_granted:e("כניסה אושרה"),access_denied:e("כניסה נדחתה"),door_open:e("דלת נפתחה"),door_not_closed:e("דלת לא נסגרה"),ring:e("צלצול")},xt={access_denied:e("כניסות שנדחו"),attempt_limit:e("חריגה ממספר ניסיונות"),unlock_exception:e("פתיחה חריגה"),door_not_closed:e("דלת לא נסגרה")},kt={card:e("כרטיס"),pin:e("קוד"),unknown:e("לא ידוע")},_t={unknown:e("אין נתון"),stale:e("הנתון ישן"),at_limit:e("במגבלה"),near_limit:e("קרוב למגבלה"),growth_to_limit:e("יגיע למגבלה בקרוב"),observed:e("תקין")},k=(t,s)=>s?t[s]??s:"—";function St(t){return t==="at_limit"?"err":t==="near_limit"||t==="growth_to_limit"?"warn":t==="observed"?"ok":"neutral"}function A(t){return t==="failed"||t==="error"||t==="conflict"||t==="completed_with_errors"?"err":t==="pending"||t==="syncing"||t==="paused"||t==="running"||t==="offline"?"warn":t==="verified"||t==="synced"||t==="completed"||t==="settled"||t==="saved"?"ok":"neutral"}function Tt(t){return t===null?"neutral":t>=95?"err":t>=80?"warn":"ok"}function zt(t){return t.progress.verified+t.progress.settled}function Mt(t,s){return s&&t.cancellable&&t.revision!==null}function rt(t){if(!Number.isFinite(t)||t<=1)return 1;const s=10**Math.floor(Math.log10(t));for(const n of[1,1.2,1.5,2,2.5,3,4,5,6,8,10])if(Math.round(n*s*1e3)/1e3>=t)return Math.round(n*s*1e3)/1e3;return 10*s}function nt(t){return[0,t/4,t/2,3*t/4,t].map(s=>Math.round(s*100)/100)}function ot(t){return Math.abs(t)>=1e3?`${Math.round(t/100)/10}K`:String(Math.round(t*10)/10)}const Et=24,X=2;function Ct(t,s,n,i,a=!0){const o=t.length;if(!o||s<=0||n<=0)return[];const p=s/o,g=Math.max(2,Math.min(Et,p*.6));return t.map((m,u)=>{const b=(a?o-1-u:u)*p+(p-g)/2,_=i>0?m.granted/i*n:0,H=i>0?m.denied/i*n:0,y=n-_,h=m.denied>0?Math.max(0,H-(m.granted>0?X:0)):0;return{key:m.day,x:b,w:g,granted:{y,h:_},denied:{y:y-(m.granted>0&&m.denied>0?X:0)-h,h},values:{granted:m.granted,denied:m.denied}}})}function G(t,s,n,i,a=4){if(i<=0)return"";const o=Math.min(a,n/2,i);return`M${t},${s+i}V${s+o}Q${t},${s} ${t+o},${s}H${t+n-o}Q${t+n},${s} ${t+n},${s+o}V${s+i}Z`}function Ot(t,s,n,i,a=!0){const o=t.filter(u=>u.users!==null&&Number.isFinite(Date.parse(u.at)));if(!o.length)return[];const p=Date.parse(o[0].at),g=Date.parse(o[o.length-1].at),m=Math.max(1,g-p);return o.map(u=>{const w=o.length===1?1:(Date.parse(u.at)-p)/m,b=a?s-w*s:w*s,_=i>0?n-u.users/i*n:n;return{x:Math.round(b*10)/10,y:Math.round(_*10)/10,at:u.at,v:u.users}})}function Q(t){return t.map((s,n)=>`${n?"L":"M"}${s.x},${s.y}`).join("")}function Ht(t,s){let n=-1,i=1/0;return t.forEach((a,o)=>{const p=Math.abs(a.x-s);p<i&&(i=p,n=o)}),n}function B(t){const s=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t);return s?`${Number(s[3])}.${Number(s[2])}`:t}var Ft=Object.defineProperty,jt=Object.getOwnPropertyDescriptor,x=(t,s,n,i)=>{for(var a=i>1?void 0:i?jt(s,n):s,o=t.length-1,p;o>=0;o--)(p=t[o])&&(a=(i?p(s,n,a):p(a))||a);return i&&a&&Ft(s,n,a),a};const lt=I`
  :host {
    display: block;
    position: relative;
    min-inline-size: 0;
    contain: inline-size;
    /* two categorical slots, validated (light #2a78d6 / #eb6834, dark #3987e5 / #d95926) */
    --c-s1: light-dark(#2a78d6, #3987e5);
    --c-s2: light-dark(#eb6834, #d95926);
    --c-text: var(--sw-text-3);
    --c-grid: var(--sw-border);
    --c-surface: var(--sw-surface);
    --c-tip-bg: var(--sw-toast-bg);
    --c-tip-text: var(--sw-toast-text);
  }
  svg {
    inline-size: 100%;
    display: block;
    overflow: visible;
    /* the geometry is drawn in absolute x (axis at the right, time running right to left); text anchors must not flip with RTL */
    direction: ltr;
  }
  text {
    fill: var(--c-text);
    font-size: var(--sw-fs-xs);
    font-family: inherit;
  }
  text.v {
    fill: var(--sw-text-2);
    font-weight: var(--sw-fw-medium);
    font-variant-numeric: tabular-nums;
  }
  .grid {
    stroke: var(--c-grid);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .hit {
    fill: transparent;
  }
  g.band:focus {
    outline: none;
  }
  g.band:focus-visible .hit {
    fill: color-mix(in srgb, var(--sw-focus) 12%, transparent);
  }
  g.band.hot .hit {
    fill: color-mix(in srgb, var(--sw-text) 5%, transparent);
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
    display: grid;
    gap: 2px;
  }
  .tip b {
    font-weight: var(--sw-fw-semibold);
    font-variant-numeric: tabular-nums;
  }
  .tip .k {
    display: inline-block;
    inline-size: 10px;
    block-size: 2px;
    border-radius: 1px;
    vertical-align: middle;
    margin-inline-end: 6px;
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
    color: var(--sw-text-2);
    margin-block-start: 6px;
  }
  .legend i {
    display: inline-block;
    inline-size: 12px;
    block-size: 12px;
    border-radius: var(--sw-r-2xs, 2px);
    margin-inline-end: 6px;
    vertical-align: -1px;
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
    min-block-size: 40px;
    display: inline-flex;
    align-items: center;
  }
  .tgl:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
    border-radius: var(--sw-r-sm);
  }
  .tw {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    inline-size: 100%;
    margin-block-start: 8px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  th,
  td {
    padding: 4px 8px;
    border-block-end: 1px solid var(--c-grid);
    text-align: start;
    font-weight: var(--sw-fw-regular, 400);
  }
  th {
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-medium);
  }
  td.n {
    font-variant-numeric: tabular-nums;
  }
  .sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .empty {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    padding: 12px 0;
  }
`;class K extends at{constructor(){super(...arguments),this.w=640}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(s=>{const n=Math.round(s[0].contentRect.width);n>160&&Math.abs(n-this.w)>2&&(this.w=n)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}}x([$()],K.prototype,"w",2);let O=class extends K{constructor(){super(...arguments),this.days=[],this.height=200,this.hot=null,this.table=!1}render(){const t=this.days;if(!t.length)return l`<div class="empty" data-chart-empty>${r.empty}</div>`;const s=this.w,n=this.height,i=34,a=16,o=22,p=s-i,g=n-a-o,m=rt(Math.max(...t.map(d=>d.granted+d.denied),1)),u=Ct(t,p,g,m,!0),w=u.length>1?p/u.length:p,b=w<34?Math.ceil(34/w):1,_=t.reduce((d,S,J)=>S.granted+S.denied>t[d].granted+t[d].denied?J:d,0),H=this.hot===null?-1:u.findIndex(d=>d.key===this.hot),y=H>=0?u[H]:null,h=`${r.byDay}: ${t.map(d=>`${B(d.day)} ${r.granted} ${d.granted}, ${r.denied} ${d.denied}`).join("; ")}`;return l`
      <svg viewBox="0 0 ${s} ${n}" role="img" aria-label=${h} data-day-chart @pointerleave=${()=>this.hot=null}>
        ${nt(m).map(d=>{const S=a+g-d/m*g;return M`<line class="grid" x1="0" x2=${p} y1=${S} y2=${S} opacity=${d===0?1:.6}></line>
            <text x=${s-4} y=${S+4} text-anchor="end">${ot(d)}</text>`})}
        ${u.map((d,S)=>{const J=()=>this.hot=d.key,dt=()=>{this.hot===d.key&&(this.hot=null)},Y=d.x+d.w/2,Z=d.values.granted+d.values.denied,ct=S%b===0||S===u.length-1?M`<text x=${Y} y=${n-6} text-anchor="middle">${B(d.key)}</text>`:c,pt=S===_&&Z>0?M`<text class="v" x=${Y} y=${a+Math.min(d.granted.y,d.denied.h?d.denied.y:d.granted.y)-5} text-anchor="middle">${Z}</text>`:c;return M`<g class=${this.hot===d.key?"band hot":"band"} tabindex="0" data-day=${d.key} aria-label=${`${B(d.key)}: ${r.granted} ${d.values.granted}, ${r.denied} ${d.values.denied}`}
              @pointerenter=${J} @focus=${J} @blur=${dt}>
            <rect class="hit" x=${d.x-(w-d.w)/2} y=${a-6} width=${w} height=${g+6}></rect>
            <g transform=${`translate(0 ${a})`}>
              ${d.granted.h>0?M`<path class="g" d=${G(d.x,d.granted.y,d.w,d.granted.h,d.denied.h>0?0:4)}></path>`:c}
              ${d.denied.h>0?M`<path class="d" d=${G(d.x,d.denied.y,d.w,d.denied.h)}></path>`:c}
            </g>
            ${pt}${ct}
          </g>`})}
      </svg>
      ${y?l`<div class="tip" role="tooltip" data-chart-tip style=${`left:${(y.x+y.w/2)/s*100}%; inset-block-start:${(a+Math.min(y.granted.y,y.denied.h?y.denied.y:y.granted.y))/n*100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${y.values.granted}</b> ${r.granted}</span>
            <span><span class="k" style="background:var(--c-s2)"></span><b>${y.values.denied}</b> ${r.denied}</span>
            <small>${B(y.key)}</small>
          </div>`:c}
      <div class="legend" data-chart-legend><span><i class="lg"></i>${r.granted}</span><span><i class="ld"></i>${r.denied}</span></div>
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${()=>this.table=!this.table}>${this.table?r.hideTable:r.showTable}</button>
      <div class=${this.table?"tw":"sr"}>
        <table data-chart-table>
          <thead><tr><th scope="col">${st("יום")}</th><th scope="col">${r.granted}</th><th scope="col">${r.denied}</th></tr></thead>
          <tbody>${t.map(d=>l`<tr><td>${B(d.day)}</td><td class="n">${d.granted}</td><td class="n">${d.denied}</td></tr>`)}</tbody>
        </table>
      </div>
    `}};O.styles=[lt,I`
      .g {
        fill: var(--c-s1);
      }
      .d {
        fill: var(--c-s2);
      }
      g.band.hot .g,
      g.band.hot .d {
        filter: brightness(1.08);
      }
      .legend .lg {
        background: var(--c-s1);
      }
      .legend .ld {
        background: var(--c-s2);
      }
    `];x([E({attribute:!1})],O.prototype,"days",2);x([E({type:Number})],O.prototype,"height",2);x([$()],O.prototype,"hot",2);x([$()],O.prototype,"table",2);O=x([U("wk-ops-day-chart")],O);let T=class extends K{constructor(){super(...arguments),this.points=[],this.limit=null,this.label="",this.height=180,this.fmt=t=>t,this.hot=-1,this.table=!1}move(t,s){const n=this.renderRoot.querySelector("svg");if(!n)return;const i=n.getBoundingClientRect();this.hot=Ht(s,(t.clientX-i.left)/i.width*this.w)}key(t,s){if(t.key!=="ArrowLeft"&&t.key!=="ArrowRight")return;t.preventDefault();const n=t.key==="ArrowLeft"?1:-1;this.hot=Math.max(0,Math.min(s-1,(this.hot<0?s-1:this.hot)+n))}render(){const t=this.points.filter(h=>h.users!==null);if(t.length<2)return l`<div class="empty" data-trend-empty>${r.trendNone}</div>`;const s=this.w,n=this.height,i=40,a=14,o=8,p=s-i,g=n-a-o,m=rt(Math.max(...t.map(h=>h.users),this.limit??0,1)*1.05),u=Ot(t,p-8,g,m,!0).map(h=>({...h,x:h.x+4})),w=u[u.length-1],b=this.hot>=0&&this.hot<u.length?u[this.hot]:null,_=this.limit!==null?a+g-this.limit/m*g:null,H=`${Q(u.map(h=>({x:h.x,y:h.y+a})))}L${w.x},${a+g}L${u[0].x},${a+g}Z`,y=`${this.label}: ${t.map(h=>`${this.fmt(h.at)} ${h.users}`).join("; ")}`;return l`
      <svg viewBox="0 0 ${s} ${n}" role="img" aria-label=${y} data-trend-chart>
        ${nt(m).map(h=>{const d=a+g-h/m*g;return M`<line class="grid" x1="0" x2=${p} y1=${d} y2=${d} opacity=${h===0?1:.6}></line><text x=${s-4} y=${d+4} text-anchor="end">${ot(h)}</text>`})}
        ${_!==null?M`<line class="limit" x1="0" x2=${p} y1=${_} y2=${_} data-trend-limit></line><text x=${p-4} y=${_-5} text-anchor="end" data-trend-limit-label>${st("מגבלה {n}",{n:String(this.limit)})}</text>`:c}
        <path class="area" d=${H}></path>
        <path class="line" d=${Q(u.map(h=>({x:h.x,y:h.y+a})))}></path>
        <circle class="dot" cx=${w.x} cy=${w.y+a} r="4"></circle>
        <text class="v" x=${w.x} y=${w.y+a-9} text-anchor="middle">${w.v}</text>
        ${b?M`<line class="cross" x1=${b.x} x2=${b.x} y1=${a} y2=${a+g}></line><circle class="dot" cx=${b.x} cy=${b.y+a} r="4"></circle>`:c}
        <rect class="plot" x="0" y=${a} width=${p} height=${g} fill="transparent" tabindex="0" aria-label=${this.label}
          @pointermove=${h=>this.move(h,u)} @pointerleave=${()=>this.hot=-1} @focus=${()=>this.hot=u.length-1} @blur=${()=>this.hot=-1}
          @keydown=${h=>this.key(h,u.length)}></rect>
      </svg>
      ${b?l`<div class="tip" role="tooltip" data-chart-tip style=${`left:${b.x/s*100}%; inset-block-start:${(b.y+a)/n*100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${b.v}</b> ${this.label}</span><small>${this.fmt(b.at)}</small>
          </div>`:c}
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${()=>this.table=!this.table}>${this.table?r.hideTable:r.showTable}</button>
      <div class=${this.table?"tw":"sr"}>
        <table data-chart-table>
          <thead><tr><th scope="col">${r.sampledAt}</th><th scope="col">${this.label}</th></tr></thead>
          <tbody>${t.map(h=>l`<tr><td>${this.fmt(h.at)}</td><td class="n">${h.users}</td></tr>`)}</tbody>
        </table>
      </div>
    `}};T.styles=[lt,I`
      .line {
        fill: none;
        stroke: var(--c-s1);
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .area {
        fill: var(--c-s1);
        opacity: 0.1;
      }
      .dot {
        fill: var(--c-s1);
        stroke: var(--c-surface);
        stroke-width: 2;
      }
      .limit {
        stroke: var(--sw-text-3);
        stroke-width: 1;
        shape-rendering: crispEdges;
      }
      .cross {
        stroke: var(--sw-text-3);
        stroke-width: 1;
      }
      .plot:focus {
        outline: none;
      }
      .plot:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
      }
    `];x([E({attribute:!1})],T.prototype,"points",2);x([E({type:Number})],T.prototype,"limit",2);x([E()],T.prototype,"label",2);x([E({type:Number})],T.prototype,"height",2);x([E({attribute:!1})],T.prototype,"fmt",2);x([$()],T.prototype,"hot",2);x([$()],T.prototype,"table",2);T=x([U("wk-ops-trend-chart")],T);const L=t=>{const s=new URLSearchParams;for(const[i,a]of Object.entries(t))a!=null&&a!==""&&s.set(i,String(a));const n=s.toString();return n?`?${n}`:""},z="access-control/operations",Dt=()=>D(`${z}/overview`),At=(t={})=>D(`${z}/operations${L({...t})}`),Bt=(t={})=>D(`${z}/investigations${L({...t})}`),Rt=()=>D(`${z}/jobs`),Lt=t=>D(`${z}/capacity${L({days:t})}`),Jt=(t={})=>D(`${z}/events-report${L({...t})}`);function Nt(t,s,n=Date.now()){const i=q(n+3e4);return ht(`${z}/jobs/${encodeURIComponent(t)}/cancel`,{client_request_id:crypto.randomUUID().replace(/-/g,""),expires_at:i,confirmed:!0,revision:s})}async function W(t,s){const{blob:n,headers:i}=await ut(t),a=i.get("X-Export-Rows"),o=/filename="?([^";]+)"?/.exec(i.get("Content-Disposition")??"")?.[1];return{blob:n,rows:a===null?null:Number(a),filename:o||s}}const It=()=>W(`${z}/exports/fleet-inventory.csv`,"intercom-fleet-inventory.csv"),Pt=(t={})=>W(`${z}/exports/audit.csv${L({...t})}`,"intercom-change-log.csv"),qt=t=>W(`${z}/jobs/${encodeURIComponent(t)}/errors.csv`,"intercom-job-errors.csv");function Ut(t){const s=URL.createObjectURL(t.blob),n=document.createElement("a");n.href=s,n.download=t.filename,document.body.appendChild(n),n.click(),n.remove(),setTimeout(()=>URL.revokeObjectURL(s),1e3)}var Kt=Object.defineProperty,Wt=Object.getOwnPropertyDescriptor,f=(t,s,n,i)=>{for(var a=i>1?void 0:i?Wt(s,n):s,o=t.length-1,p;o>=0;o--)(p=t[o])&&(a=(i?p(s,n,a):p(a))||a);return i&&a&&Kt(s,n,a),a};const tt=864e5,et=[1,7,30];function R(t){return t instanceof j?{s:"error",code:t.body.code,message:t.body.user_message||t.body.code,status:t.status}:{s:"error",code:"error",message:String(t),status:0}}let v=class extends at{constructor(){super(...arguments),this.view="",this.overview=null,this.loadState="loading",this.loadError="",this.ops={s:"idle"},this.opsFilter={kind:"all",state:"all",station_id:"",query:"",offset:0},this.jobs={s:"idle"},this.openJob="",this.confirmJob=null,this.cancelBusy=!1,this.cancelError="",this.flash="",this.timeline={s:"idle"},this.tlFilter={source:"all",station_id:"",query:"",period:7,offset:0},this.capacity={s:"idle"},this.trendStation="",this.trendDays=30,this.report={s:"idle"},this.evFilter={station_id:"",period:7},this.exportBusy="",this.exportMsg=null}connectedCallback(){super.connectedCallback(),this.load()}get tab(){return yt(this.view)}get zone(){const t=this.overview?.summary;return t&&t.state==="ready"?t.data.zone:gt}get stations(){const t=this.overview?.summary;return t&&t.state==="ready"?t.data.stations:[]}name(t){return this.stations.find(s=>s.id===t)?.name??t}time(t){return bt(t,$t(),this.zone)}async load(){this.loadState="loading";try{this.overview=await Dt(),this.loadState="ready",this.loadTab(this.tab)}catch(t){this.loadState=t instanceof j&&t.status===403?"forbidden":"error",this.loadError=t instanceof j?t.body.user_message:String(t)}}updated(t){t.has("view")&&t.get("view")!==void 0&&this.loadState==="ready"&&this.loadTab(this.tab);const s=this.renderRoot.querySelector("nav.tabs"),n=s?.querySelector('a[aria-current="page"]');if(s&&n){const i=s.getBoundingClientRect(),a=n.getBoundingClientRect();a.left<i.left?s.scrollLeft-=i.left-a.left+8:a.right>i.right&&(s.scrollLeft+=a.right-i.right+8)}}loadTab(t){t==="operations"?(this.ops.s==="idle"&&this.loadOps(),this.jobs.s==="idle"&&this.loadJobs()):t==="investigations"&&this.timeline.s==="idle"?this.loadTimeline():t==="capacity"&&this.capacity.s==="idle"?this.loadCapacity():t==="events"&&this.report.s==="idle"&&this.loadReport()}offered(t){return this.overview?.views?.[t]!==!1}async loadOps(){this.ops={s:"loading"};const t=this.opsFilter;try{const s=await At({kind:t.kind,state:t.state,station_id:t.station_id||void 0,query:t.query||void 0,offset:t.offset,limit:25});this.ops={s:"ready",v:s.data}}catch(s){this.ops=R(s)}}async loadJobs(){this.jobs={s:"loading"};try{this.jobs={s:"ready",v:await Rt()}}catch(t){this.jobs=R(t)}}async loadTimeline(){this.timeline={s:"loading"};const t=this.tlFilter,s=t.period?q(Date.now()-t.period*tt):void 0;try{const n=await Bt({source:t.source,station_id:t.station_id||void 0,query:t.query||void 0,start:s,offset:t.offset,limit:25});this.timeline={s:"ready",v:n.data}}catch(n){this.timeline=R(n)}}async loadCapacity(){this.capacity={s:"loading"};try{const t=await Lt(this.trendDays);if(this.capacity={s:"ready",v:t},!this.trendStation||!t.data.records.some(s=>s.station_id===this.trendStation)){const s=[...t.data.records].sort((n,i)=>(i.users.used_percent??-1)-(n.users.used_percent??-1))[0];this.trendStation=s?.station_id??""}}catch(t){this.capacity=R(t)}}async loadReport(){this.report={s:"loading"};const t=this.evFilter,s=q(Date.now()-t.period*tt);try{this.report={s:"ready",v:await Jt({station_id:t.station_id||void 0,start:s})}}catch(n){this.report=R(n)}}pill(t,s,n=""){return l`<span class="pill" data-tone=${t} data-pill=${n}>${s}</span>`}partState(t,s,n){return t.s==="idle"||t.s==="loading"?l`<sw-state-panel state="loading" compact heading=${r.loading} data-part-state="loading"></sw-state-panel>`:t.s==="error"?t.status===501||!this.offered(s)?l`<sw-state-panel icon="wrench" state="empty" compact heading=${r.unavailable} data-part-state="unavailable"></sw-state-panel>`:l`<sw-state-panel state="error" compact heading=${r.errorTitle} hint=${t.message} actionLabel=${r.retry} @action=${n} data-part-state="error"></sw-state-panel>`:null}stationSelect(t,s,n){return l`<label class="f">${r.filterStation}
      <sw-field><select data-filter=${n} .value=${t} @change=${i=>s(i.target.value)}>
        <option value="">${r.all}</option>
        ${this.stations.map(i=>l`<option value=${i.id} ?selected=${i.id===t}>${i.name}</option>`)}
      </select></sw-field></label>`}meter(t,s,n){const i=s.used_percent,a=Tt(i);return l`<div class="meter" data-tone=${a} data-meter=${n} role="meter" aria-valuemin="0" aria-valuemax=${s.limit??0} aria-valuenow=${s.count??0} aria-label=${t}>
      <div class="lbl"><span>${t}</span><b><bdi dir="ltr">${r.usersOf(s.count,s.limit)}</bdi>${i!==null?l` · <bdi dir="ltr">${Math.round(i)}%</bdi>`:c}</b></div>
      <div class="bar"><i style=${`inline-size:${Math.max(0,Math.min(100,i??0))}%`}></i></div>
    </div>`}renderOverview(){const t=this.overview.summary;if(t.state==="error")return l`<sw-state-panel state="error" heading=${r.errorTitle} hint=${t.message} actionLabel=${r.retry} @action=${()=>void this.load()} data-part-state="error"></sw-state-panel>`;const s=t.data.kpis,n=(i,a,o,p)=>l`<sw-kpi data-kpi=${p} label=${r.kpi[i]} value=${String(s[i])} icon=${a} tone=${o}></sw-kpi>`;return l`
      <div class="kpis" data-kpis>
        ${n("stations","door","neutral","stations")}
        ${n("online","wifi",s.online===s.stations?"live":"neutral","online")}
        ${n("offline","offline",s.offline?"error":"neutral","offline")}
        ${n("pending_users","clock",s.pending_users?"partial":"neutral","pending")}
        ${n("sync_problems","warning",s.sync_problems?"error":"neutral","sync")}
        ${n("near_capacity","storage",s.near_capacity?"partial":"neutral","capacity")}
      </div>
      <section class="part" data-stations>
        <header><div><h2>${r.stationsTitle}</h2><p class="hint">${r.fetchedAt} ${this.time(t.fetched_at)}</p></div>
          <sw-button size="sm" icon="refresh" @click=${()=>void this.load()} data-refresh>${r.refresh}</sw-button></header>
        ${t.data.stations.length?l`<div class="list">${t.data.stations.map(i=>l`<article class="item" data-station=${i.id}>
                <div class="main"><b>${i.name}</b>${this.pill(i.online?"ok":"err",i.online?r.online:r.offline,"online")}${this.pill(A(i.sync_state),k(C,i.sync_state),"sync")}</div>
                <div class="end">${i.max_users?this.meter(r.table.users,{count:i.users,limit:i.max_users,used_percent:i.users!==null?Math.round(1e3*i.users/i.max_users)/10:null,remaining:null,growth_per_day:null,days_to_limit:null,alert:"observed"},"users"):c}</div>
                <div class="meta">
                  ${i.pending_users?l`<span>${r.table.pending}: ${i.pending_users}</span>`:c}
                  ${i.cards!==null?l`<span>${r.table.cards}: <bdi dir="ltr">${i.cards}${i.max_cards?` / ${i.max_cards}`:""}</bdi></span>`:c}
                  ${i.last_error?l`<span>${r.table.error}: <code>${i.last_error}</code></span>`:c}
                </div>
              </article>`)}</div>`:l`<sw-state-panel icon="door" state="empty" compact heading=${r.empty}></sw-state-panel>`}
      </section>`}renderOperations(){const t=this.opsFilter,s=a=>{this.opsFilter={...t,offset:0,...a},this.loadOps()},n=this.partState(this.ops,"operations",()=>void this.loadOps()),i=this.ops.s==="ready"?this.ops.v:null;return l`
      ${this.flash?l`<div class="msg ok" role="status" data-flash>${this.flash}</div>`:c}
      <section class="part" data-ops>
        <header><div><h2>${r.opsTitle}</h2><p class="hint">${r.opsHint}</p></div></header>
        <div class="filters">
          <label class="f">${r.filterKind}<sw-field><select data-filter="kind" .value=${t.kind} @change=${a=>s({kind:a.target.value})}>
            ${["all","sync","bulk","csv"].map(a=>l`<option value=${a} ?selected=${a===t.kind}>${a==="all"?r.all:N[a]}</option>`)}</select></sw-field></label>
          <label class="f">${r.filterState}<sw-field><select data-filter="state" .value=${t.state} @change=${a=>s({state:a.target.value})}>
            ${["all","pending","failed","verified","settled","saved"].map(a=>l`<option value=${a} ?selected=${a===t.state}>${a==="all"?r.all:C[a]}</option>`)}</select></sw-field></label>
          ${this.stationSelect(t.station_id,a=>s({station_id:a}),"station")}
          <sw-button size="sm" icon="refresh" @click=${()=>void this.loadOps()} data-ops-refresh>${r.refresh}</sw-button>
        </div>
        ${n??l`${i.stale?l`<div class="msg warn" role="status">${r.stale}</div>`:c}
          <div class="filters" data-ops-summary>${["pending","failed","verified","settled","saved"].map(a=>this.pill(A(a),`${C[a]}: ${i.summary[a]}`,a))}</div>
          ${i.records.length?l`<div class="list">${i.records.map(a=>l`<article class="item" data-op=${a.id}>
                  <div class="main"><b>${k(V,a.action)}</b>${this.pill("neutral",k(N,a.kind),"kind")}${this.pill(A(a.state),k(C,a.state),"state")}</div>
                  <div class="end"><span class="muted">${r.progress(zt(a),a.progress.total)}</span></div>
                  <div class="meta">
                    <span>${r.people(a.user_ids.length)}</span>
                    <span>${a.station_ids.map(o=>this.name(o)).join(", ")}</span>
                    <span>${this.time(a.updated_at)}</span>
                    ${a.errors.map(o=>l`<code>${o}</code>`)}
                  </div>
                </article>`)}</div>
              ${this.pager(i,a=>{this.opsFilter={...t,offset:a},this.loadOps()})}`:l`<sw-state-panel icon="activity" state="empty" compact heading=${r.empty} data-part-state="empty"></sw-state-panel>`}`}
      </section>
      ${this.renderJobs()}
      ${this.renderCancelDialog()}`}pager(t,s){return t.next_offset===null&&t.previous_offset===null?c:l`<div class="pager" data-pager><bdi dir="ltr">${t.offset+1}–${Math.min(t.total,t.offset+(t.limit??25))} / ${t.total}</bdi>
      <sw-button size="sm" ?disabled=${t.previous_offset===null} @click=${()=>t.previous_offset!==null&&s(t.previous_offset)}>${r.prev}</sw-button>
      <sw-button size="sm" ?disabled=${t.next_offset===null} @click=${()=>t.next_offset!==null&&s(t.next_offset)}>${r.more}</sw-button></div>`}renderJobs(){const t=this.partState(this.jobs,"jobs",()=>void this.loadJobs()),s=this.jobs.s==="ready"?this.jobs.v:null,n=!!s?.can_cancel;return l`<section class="part" data-jobs>
      <header><div><h2>${r.jobsTitle}</h2><p class="hint">${r.jobsHint}</p></div></header>
      ${t??(s.data.records.length?l`<div class="list">${s.data.records.map(i=>{const a=this.openJob===i.id;return l`<article class="item" data-job=${i.id}>
              <div class="main"><b>${k(N,i.kind)}</b>${this.pill(A(i.state),k(C,i.state),"state")}
                <span class="muted">${r.progress(i.saved,i.total)}</span>${i.failed?this.pill("err",r.rowsFailed(i.failed),"failed"):c}</div>
              <div class="end">
                ${i.errors.length?l`<sw-button size="sm" variant="ghost" @click=${()=>this.openJob=a?"":i.id} aria-expanded=${a} data-job-errors-toggle>${r.rowsFailed(i.errors.length)}</sw-button>`:c}
                ${n&&i.errors.length?l`<sw-button size="sm" icon="download" @click=${()=>void this.download("job",()=>qt(i.id))} data-job-errors-csv>${r.errorsCsv}</sw-button>`:c}
                ${Mt(i,n)?l`<sw-button size="sm" variant="danger" @click=${()=>this.askCancel(i)} data-job-cancel>${r.cancel}</sw-button>`:c}
              </div>
              <div class="meta"><span>${this.time(i.created_at)}</span>${i.pending?l`<span>${C.pending}: ${i.pending}</span>`:c}</div>
              ${a?l`<ul class="errs" data-job-error-rows>${i.errors.map(o=>l`<li>${r.row} ${o.row??"—"}: <code>${o.code}</code></li>`)}</ul>`:c}
            </article>`})}</div>`:l`<sw-state-panel icon="list" state="empty" compact heading=${r.jobsEmpty} data-part-state="empty"></sw-state-panel>`)}
      ${this.exportMsg&&this.exportMsg.kind==="job"?l`<div class="msg ${this.exportMsg.ok?"ok":"err"}" role="status" data-export-msg>${this.exportMsg.text}</div>`:c}
    </section>`}askCancel(t){this.cancelError="",this.confirmJob=t}async doCancel(){const t=this.confirmJob;if(!(!t||t.revision===null||this.cancelBusy)){this.cancelBusy=!0,this.cancelError="";try{await Nt(t.id,t.revision),this.confirmJob=null,this.flash=r.cancelled,await this.loadJobs()}catch(s){this.cancelError=s instanceof j?s.body.user_message||s.body.code:String(s),s instanceof j&&s.body.details?.outcome!=="not_sent"&&this.loadJobs()}finally{this.cancelBusy=!1}}}renderCancelDialog(){const t=this.confirmJob;return l`<sw-dialog ?open=${!!t} heading=${r.cancelTitle} ?locked=${this.cancelBusy} @close=${()=>this.confirmJob=null} data-cancel-dialog>
      <p>${r.cancelBody}</p>
      ${t?l`<p class="muted">${k(N,t.kind)} · ${r.progress(t.saved,t.total)} · ${this.time(t.created_at)}</p>`:c}
      ${this.cancelError?l`<div class="msg err" role="alert" data-cancel-error>${this.cancelError}</div>`:c}
      <sw-button slot="footer" @click=${()=>this.confirmJob=null} ?disabled=${this.cancelBusy} data-cancel-keep>${r.cancelKeep}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>void this.doCancel()} ?disabled=${this.cancelBusy||!!this.cancelError} data-cancel-confirm>${r.cancelConfirm}</sw-button>
    </sw-dialog>`}renderInvestigations(){const t=this.tlFilter,s=this.overview.can,n=o=>{this.tlFilter={...t,offset:0,...o},this.loadTimeline()},i=this.partState(this.timeline,"investigations",()=>void this.loadTimeline()),a=this.timeline.s==="ready"?this.timeline.v:null;return l`<section class="part" data-timeline>
      <header><div><h2>${r.invTitle}</h2><p class="hint">${r.invHint}</p></div></header>
      <div class="filters">
        <label class="f">${r.invSource}<sw-field><select data-filter="source" .value=${t.source} @change=${o=>n({source:o.target.value})}>
          ${["all","access","change","sync"].map(o=>l`<option value=${o} ?selected=${o===t.source}>${o==="all"?r.all:P[o]}</option>`)}</select></sw-field></label>
        ${this.stationSelect(t.station_id,o=>n({station_id:o}),"station")}
        <label class="f">${r.invFrom}<sw-field><select data-filter="period" .value=${String(t.period)} @change=${o=>n({period:Number(o.target.value)})}>
          ${et.map(o=>l`<option value=${o} ?selected=${o===t.period}>${o===1?F("24 שעות"):r.days(o)}</option>`)}</select></sw-field></label>
        ${s.names?l`<label class="f">${r.filterSearch}<sw-field><input type="search" data-filter="query" .value=${t.query} maxlength="128"
              @change=${o=>n({query:o.target.value.trim()})} /></sw-field></label>`:c}
      </div>
      ${i??l`${a.fields_hidden.length?l`<div class="msg warn" role="status" data-hidden-fields>${r.hiddenFields}</div>`:c}
        ${a.access_storage_failed?l`<div class="msg err" role="status">${r.storageFailed}</div>`:c}
        <div class="filters">${["access","change","sync"].map(o=>this.pill("neutral",`${P[o]}: ${a.summary[o]}`,o))}</div>
        ${a.records.length?l`<div class="list">${a.records.map(o=>l`<article class="item" data-tl=${o.id} data-source=${o.source}>
                <div class="main"><b>${k(V,o.action)}</b>${this.pill("neutral",k(P,o.source),"source")}${this.pill(A(o.status),k(C,o.status),"status")}</div>
                <div class="end"><span class="muted">${this.time(o.time)}</span></div>
                <div class="meta">
                  <span>${o.station_ids.map(p=>this.name(p)).join(", ")}${o.door?` · ${F("דלת {door}",{door:o.door})}`:""}</span>
                  ${o.person_name?l`<span data-person>${o.person_name}${o.employee_no?` (${o.employee_no})`:""}</span>`:c}
                  ${o.actor?l`<span data-actor>${r.operator}: ${a.actors[o.actor]??o.actor}</span>`:c}
                  ${o.fields.length?l`<span>${o.fields.join(", ")}</span>`:c}
                  <code>${o.evidence}</code>
                </div>
              </article>`)}</div>
            ${this.pager(a,o=>{this.tlFilter={...t,offset:o},this.loadTimeline()})}`:l`<sw-state-panel icon="history" state="empty" compact heading=${r.empty} data-part-state="empty"></sw-state-panel>`}`}
    </section>`}renderCapacity(){const t=this.partState(this.capacity,"capacity",()=>void this.loadCapacity()),s=this.capacity.s==="ready"?this.capacity.v:null,n=s?.data.records??[],i=n.find(o=>o.station_id===this.trendStation)??null,a=s?.trend.series[this.trendStation]??[];return l`<section class="part" data-capacity>
        <header><div><h2>${r.capTitle}</h2><p class="hint">${r.capHint}</p></div>
          <sw-button size="sm" icon="refresh" @click=${()=>void this.loadCapacity()} data-cap-refresh>${r.refresh}</sw-button></header>
        ${t??(n.length?l`<div class="cap-grid">${n.map(o=>l`<article class="cap" data-cap=${o.station_id}>
                <header><b>${o.name}</b>${this.pill(St(o.users.alert),_t[o.users.alert],"alert")}</header>
                ${this.meter(r.table.users,o.users,"users")}${this.meter(r.table.cards,o.cards,"cards")}
                <div class="muted">
                  ${o.users.growth_per_day!==null?l`<span><bdi dir="ltr">${o.users.growth_per_day>0?"+":""}${o.users.growth_per_day}</bdi> ${F("ביום")}</span>`:c}
                  ${o.users.days_to_limit!==null?l` · <span data-days-to-limit>${r.daysToLimit(o.users.days_to_limit)}</span>`:c}
                  <div>${r.sampledAt}: ${this.time(o.sampled_at)}</div>
                </div>
              </article>`)}</div>`:l`<sw-state-panel icon="users" state="empty" compact heading=${r.empty} data-part-state="empty"></sw-state-panel>`)}
      </section>
      ${s&&n.length?l`<section class="part" data-trend>
            <header><div><h2>${r.trendTitle}${i?` · ${i.name}`:""}</h2><p class="hint">${r.trendHint}</p></div></header>
            <div class="filters">
              <label class="f">${r.filterStation}<sw-field><select data-filter="trend-station" .value=${this.trendStation} @change=${o=>this.trendStation=o.target.value}>
                ${n.map(o=>l`<option value=${o.station_id} ?selected=${o.station_id===this.trendStation}>${o.name}</option>`)}</select></sw-field></label>
              <label class="f">${F("טווח")}<sw-field><select data-filter="trend-days" .value=${String(this.trendDays)} @change=${o=>{this.trendDays=Number(o.target.value),this.loadCapacity()}}>${[7,30,90,365].map(o=>l`<option value=${o} ?selected=${o===this.trendDays}>${r.days(o)}</option>`)}</select></sw-field></label>
            </div>
            <wk-ops-trend-chart .points=${a} .limit=${i?.users.limit??null} label=${r.table.users} .fmt=${o=>this.time(o)}></wk-ops-trend-chart>
          </section>`:c}`}renderEvents(){const t=this.evFilter,s=a=>{this.evFilter={...t,...a},this.loadReport()},n=this.partState(this.report,"events_report",()=>void this.loadReport()),i=this.report.s==="ready"?this.report.v.data:null;return l`<section class="part" data-events>
      <header><div><h2>${r.evTitle}</h2><p class="hint">${r.evHint}</p></div></header>
      <div class="filters">
        ${this.stationSelect(t.station_id,a=>s({station_id:a}),"station")}
        <label class="f">${r.invFrom}<sw-field><select data-filter="period" .value=${String(t.period)} @change=${a=>s({period:Number(a.target.value)})}>
          ${et.map(a=>l`<option value=${a} ?selected=${a===t.period}>${a===1?F("24 שעות"):r.days(a)}</option>`)}</select></sw-field></label>
      </div>
      ${n??l`
        ${i.storage_failed?l`<div class="msg err" role="status">${r.storageFailed}</div>`:c}
        <div class="kpis" data-ev-kpis>
          <sw-kpi label=${r.total} value=${String(i.totals.records)} icon="activity" tone="neutral" data-kpi="records"></sw-kpi>
          <sw-kpi label=${r.granted} value=${String(i.totals.granted)} icon="check" tone="neutral" data-kpi="granted"></sw-kpi>
          <sw-kpi label=${r.denied} value=${String(i.totals.denied)} icon="lock" tone=${i.totals.denied?"partial":"neutral"} data-kpi="denied"></sw-kpi>
          <sw-kpi label=${r.other} value=${String(i.totals.other)} icon="info" tone="neutral" data-kpi="other"></sw-kpi>
        </div>
        <h3>${r.byDay}</h3>
        <wk-ops-day-chart .days=${i.by_day.map(a=>({day:a.day,granted:a.granted,denied:a.denied}))}></wk-ops-day-chart>
        <div class="two">
          <div>
            <h3>${r.byStation}</h3>
            <table class="t" data-ev-stations>
              <thead><tr><th scope="col">${r.table.station}</th><th scope="col">${r.granted}</th><th scope="col">${r.denied}</th><th scope="col">${r.other}</th></tr></thead>
              <tbody>${i.by_station.map(a=>l`<tr><td>${this.name(a.station_id)}</td><td class="n">${a.granted}</td><td class="n">${a.denied}</td><td class="n">${a.other}</td></tr>`)}</tbody>
            </table>
          </div>
          <div>
            <h3>${r.anomalies}</h3>
            <table class="t" data-ev-anomalies>
              <tbody>${Object.entries(i.anomalies).map(([a,o])=>l`<tr><td>${k(xt,a)}</td><td class="n">${o}</td></tr>`)}</tbody>
            </table>
            <h3>${r.methods}</h3>
            <table class="t" data-ev-methods>
              <tbody>${Object.entries(i.methods).map(([a,o])=>l`<tr><td>${k(kt,a)}</td><td class="n">${o}</td></tr>`)}</tbody>
            </table>
          </div>
        </div>`}
    </section>`}async download(t,s){if(!this.exportBusy){this.exportBusy=t,this.exportMsg=null;try{const n=await s();Ut(n),this.exportMsg={kind:t,ok:!0,text:r.downloaded(n.rows)}}catch(n){this.exportMsg={kind:t,ok:!1,text:n instanceof j?n.body.user_message||n.body.code:String(n)}}finally{this.exportBusy=""}}}renderExports(){const t=this.overview.can,s=n=>this.exportMsg&&this.exportMsg.kind===n?l`<div class="msg ${this.exportMsg.ok?"ok":"err"}" role="status" data-export-msg=${n}>${this.exportMsg.text}</div>`:c;return l`<section class="part" data-exports>
      <header><div><h2>${r.expTitle}</h2><p class="hint">${r.expHint}</p></div></header>
      ${t.export?l`<div class="two">
            <div class="exp" data-export="inventory"><b>${r.expInventory}</b><span class="muted">${r.expInventoryHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy||!this.offered("inventory")} @click=${()=>void this.download("inventory",It)} data-export-btn="inventory">${r.download}</sw-button>${s("inventory")}</div>
            <div class="exp" data-export="audit"><b>${r.expAudit}</b><span class="muted">${r.expAuditHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy||!this.offered("audit_export")} @click=${()=>void this.download("audit",()=>Pt())} data-export-btn="audit">${r.download}</sw-button>${s("audit")}</div>
          </div>`:l`<sw-state-panel state="forbidden" compact heading=${r.adminOnly} data-part-state="forbidden"></sw-state-panel>`}
    </section>`}body(t){return t==="operations"?this.renderOperations():t==="investigations"?this.renderInvestigations():t==="capacity"?this.renderCapacity():t==="events"?this.renderEvents():t==="exports"?this.renderExports():this.renderOverview()}render(){const t=(n,i)=>l`<sw-page crumbs=${F("הגדרות")} heading=${r.title} subheading=${r.sub} data-intercom-ops data-state=${i}>${n}</sw-page>`;if(this.loadState==="loading")return t(l`<sw-state-panel state="loading" heading=${r.loading}></sw-state-panel>`,"loading");if(this.loadState==="forbidden")return t(l`<sw-state-panel state="forbidden" heading=${r.forbiddenTitle} hint=${r.forbiddenHint}></sw-state-panel>`,"forbidden");if(this.loadState==="error")return t(l`<sw-state-panel state="error" heading=${r.errorTitle} hint=${this.loadError} actionLabel=${r.retry} @action=${()=>void this.load()}></sw-state-panel>`,"error");const s=this.tab;return t(l`<nav class="tabs" aria-label=${r.title}>
          ${it.map(n=>l`<a href="${wt}/${n}" aria-current=${n===s?"page":"false"} data-ops-tab=${n}>${r.tabs[n]}</a>`)}
        </nav>
        <div data-ops-view=${s}>${this.body(s)}</div>`,"ready")}};v.styles=[vt,I`
      ${ft}
      section.part {
        background: var(--sw-surface);
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        padding: 16px;
        margin-block-end: 16px;
        min-inline-size: 0;
      }
      section.part > header {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px 16px;
        margin-block-end: 12px;
      }
      h2 {
        margin: 0;
        font-size: var(--sw-fs-lg);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      h3 {
        margin: 16px 0 8px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      .hint,
      .muted {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
        margin: 4px 0 0;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 12px;
        margin-block-end: 16px;
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
        align-items: flex-end;
        margin-block-end: 12px;
      }
      ${mt}
      /* CR-CMP2-SEGMENTED-B-2450 (owner N10): the filter selects and the search field sit in sw-field (the shared field look, native
         controls, one look for the whole toolbar) */
      label.f sw-field {
        min-inline-size: 0;
        max-inline-size: 100%;
      }
      .list {
        display: grid;
        gap: 0;
      }
      .item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 12px;
        padding: 10px 0;
        border-block-end: 1px solid var(--sw-border);
        min-inline-size: 0;
      }
      .item:last-child {
        border-block-end: 0;
      }
      .item .main {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        align-items: center;
        min-inline-size: 0;
      }
      .item .main b {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      .item .meta {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: 2px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .item .end {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-medium);
        background: var(--sw-surface-3, var(--sw-surface-2));
        color: var(--sw-text-2);
        white-space: nowrap;
      }
      .pill::before {
        content: '';
        inline-size: 6px;
        block-size: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      .pill[data-tone='ok'] {
        background: var(--sw-success-soft);
        color: var(--sw-success-text);
      }
      .pill[data-tone='warn'] {
        background: var(--sw-warning-soft);
        color: var(--sw-warning-text);
      }
      .pill[data-tone='err'] {
        background: var(--sw-danger-soft);
        color: var(--sw-danger-text);
      }
      code {
        font-family: var(--sw-font-mono, ui-monospace, monospace);
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-2);
        overflow-wrap: anywhere;
      }
      .meter {
        display: grid;
        gap: 4px;
        min-inline-size: 0;
      }
      .meter .bar {
        block-size: 8px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-accent-soft);
        overflow: hidden;
      }
      .meter .bar > i {
        display: block;
        block-size: 100%;
        border-radius: var(--sw-r-pill);
        background: var(--sw-accent);
      }
      .meter[data-tone='warn'] .bar {
        background: var(--sw-warning-soft);
      }
      .meter[data-tone='warn'] .bar > i {
        background: var(--sw-warning);
      }
      .meter[data-tone='err'] .bar {
        background: var(--sw-danger-soft);
      }
      .meter[data-tone='err'] .bar > i {
        background: var(--sw-danger);
      }
      .meter .lbl {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .meter .lbl b {
        font-variant-numeric: tabular-nums;
        font-weight: var(--sw-fw-medium);
        color: var(--sw-text);
      }
      .cap-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 12px;
      }
      .cap {
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        padding: 12px;
        display: grid;
        gap: 10px;
        min-inline-size: 0;
      }
      .cap header {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }
      .cap header b {
        font-weight: var(--sw-fw-semibold);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pager {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
        margin-block-start: 8px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .msg {
        padding: 10px 12px;
        border-radius: var(--sw-r-md);
        font-size: var(--sw-fs-sm);
        margin-block-end: 12px;
      }
      .msg.ok {
        background: var(--sw-success-soft);
        color: var(--sw-success-text);
      }
      .msg.warn {
        background: var(--sw-warning-soft);
        color: var(--sw-warning-text);
      }
      .msg.err {
        background: var(--sw-danger-soft);
        color: var(--sw-danger-text);
      }
      .errs {
        grid-column: 1 / -1;
        margin: 4px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 2px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .two {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
      }
      table.t {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: var(--sw-fs-sm);
      }
      table.t th,
      table.t td {
        text-align: start;
        padding: 6px 8px;
        border-block-end: 1px solid var(--sw-border);
      }
      table.t th {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-medium);
      }
      table.t td.n {
        font-variant-numeric: tabular-nums;
      }
      .exp {
        display: grid;
        gap: 8px;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        padding: 14px;
        align-content: start;
      }
      .exp b {
        font-weight: var(--sw-fw-semibold);
      }
      @media (max-width: 640px) {
        section.part {
          padding: 12px;
        }
        .kpis {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .item {
          grid-template-columns: minmax(0, 1fr);
        }
        .item .end {
          justify-content: flex-start;
        }
        label.f {
          flex: 1 1 140px;
        }
      }
    `];f([E()],v.prototype,"view",2);f([$()],v.prototype,"overview",2);f([$()],v.prototype,"loadState",2);f([$()],v.prototype,"loadError",2);f([$()],v.prototype,"ops",2);f([$()],v.prototype,"opsFilter",2);f([$()],v.prototype,"jobs",2);f([$()],v.prototype,"openJob",2);f([$()],v.prototype,"confirmJob",2);f([$()],v.prototype,"cancelBusy",2);f([$()],v.prototype,"cancelError",2);f([$()],v.prototype,"flash",2);f([$()],v.prototype,"timeline",2);f([$()],v.prototype,"tlFilter",2);f([$()],v.prototype,"capacity",2);f([$()],v.prototype,"trendStation",2);f([$()],v.prototype,"trendDays",2);f([$()],v.prototype,"report",2);f([$()],v.prototype,"evFilter",2);f([$()],v.prototype,"exportBusy",2);f([$()],v.prototype,"exportMsg",2);v=f([U("system-intercom-ops")],v);export{v as SystemIntercomOps};
