import{g as P,j as $,aw as z,b as l,A as c,a4 as M,cx as it,i as rt,k as U,b3 as D,by as q,bn as $t,bt as vt,u as mt,a as A,dD as F}from"./index-BYRaM0w7.js";import{t as e}from"./wiskey-BLSt1BaT.js";import"./sw-table-VzVxYctQ.js";import{s as ft,c as gt,d as bt}from"./settings-kC3vgv__.js";import{U as wt,a as yt}from"./wiskey-format-Dd75d7Ti.js";import"./sw-logo-art-PLtEZJxU.js";const nt=["overview","operations","investigations","capacity","events","exports"],xt="#/system/intercom-operations";function kt(t){return nt.includes(t)?t:"overview"}const i={title:e("תפעול האינטרקום"),sub:e("מה קורה במערכת האינטרקום: פעולות סנכרון, משימות, ציר זמן לחקירה, קיבולת העמדות ודוח האירועים"),tabs:{overview:e("סיכום"),operations:e("פעולות ומשימות"),investigations:e("חקירות"),capacity:e("קיבולת ומגמות"),events:e("דוח אירועים"),exports:e("ייצוא")},loading:e("טוען את נתוני התפעול…"),forbiddenTitle:e("אין לכם הרשאה לתפעול האינטרקום"),forbiddenHint:e("נדרשת הרשאת צפייה בבקרת כניסה ברמת ההתקנה כולה."),errorTitle:e("לא ניתן לטעון את תפעול האינטרקום"),unavailable:e("מערכת האינטרקום המותקנת אינה מציעה את התצוגה הזו."),retry:e("נסו שוב"),refresh:e("רענון"),fetchedAt:e("עודכן"),empty:e("אין מה להציג"),kpi:{stations:e("עמדות"),online:e("מחוברות"),offline:e("לא מחוברות"),pending_users:e("ממתינים לסנכרון"),sync_problems:e("עמדות עם תקלת סנכרון"),near_capacity:e("קרובות למגבלה")},stationsTitle:e("העמדות"),table:{station:e("עמדה"),state:e("מצב"),sync:e("סנכרון"),pending:e("ממתינים"),users:e("משתמשים"),cards:e("כרטיסים"),use:e("ניצולת"),error:e("שגיאה אחרונה")},online:e("מחוברת"),offline:e("לא מחוברת"),opsTitle:e("פעולות"),opsHint:e("סנכרון של אדם לעמדה, עריכות מרוכזות וייבוא קבצים, עם ההתקדמות של כל אחת."),jobsTitle:e("משימות מרוכזות"),jobsHint:e("משימות עריכה מרוכזת וייבוא שנוצרו דרך Arx. שורות שנכשלו מופיעות עם קוד השגיאה."),jobsEmpty:e("אין משימות מרוכזות."),filterKind:e("סוג"),filterState:e("מצב"),filterStation:e("עמדה"),filterSearch:e("חיפוש"),all:e("הכול"),people:t=>t===1?e("אדם אחד"):e("{n} אנשים",{n:t}),stationsCount:t=>t===1?e("עמדה אחת"):e("{n} עמדות",{n:t}),progress:(t,s)=>e("{done} מתוך {total}",{done:t,total:s}),cancel:e("ביטול המשימה"),cancelTitle:e("לבטל את המשימה?"),cancelBody:e("שורות שעדיין לא נשמרו יבוטלו. שורות שכבר נשמרו ממשיכות להסתנכרן לעמדות. הפעולה נשלחת פעם אחת."),cancelConfirm:e("כן, לבטל"),cancelKeep:e("השארת המשימה"),cancelled:e("המשימה בוטלה."),errorsCsv:e("הורדת השורות שנכשלו"),rowsFailed:t=>t===1?e("שורה אחת נכשלה"):e("{n} שורות נכשלו",{n:t}),row:e("שורה"),more:e("הבא"),prev:e("הקודם"),stale:e("הנתונים השתנו מאז הטעינה - רעננו כדי לראות את המצב העדכני."),invTitle:e("ציר זמן לחקירה"),invHint:e("כניסות, שינויים וסנכרון זה לצד זה, 30 הימים האחרונים. סמיכות בזמן אינה מוכיחה קשר בין אירועים."),invSource:e("מקור"),invFrom:e("מתאריך"),invTo:e("עד תאריך"),hiddenFields:e("חלק מהפרטים מוסתרים לפי ההרשאות שלכם."),storageFailed:e("שמירת האירועים במערכת האינטרקום נכשלה - ייתכן שחסרים אירועים."),operator:e("מפעיל"),capTitle:e("קיבולת לפי עמדה"),capHint:e("משתמשים וכרטיסים מול המגבלה שהעמדה מדווחת. התחזית היא הערכה לפי הצמיחה שנמדדה."),trendTitle:e("מגמה"),trendHint:e("מספר המשתמשים בעמדה לאורך זמן, מתוך הדגימות ש־Arx שמר. הקו האופקי הוא המגבלה שהעמדה מדווחת."),trendNone:e("עדיין אין מספיק דגימות כדי לצייר מגמה לעמדה הזו. כל צפייה בדף שומרת דגימה חדשה כשיש."),days:t=>e("{n} ימים",{n:t}),usersOf:(t,s)=>t===null?"—":s===null?`${t}`:`${t} / ${s}`,daysToLimit:t=>e("כ־{n} ימים עד המגבלה",{n:Math.round(t)}),growth:t=>e("{g} ביום",{g:`${t>0?"+":""}${t}`}),sampledAt:e("נדגם"),evTitle:e("דוח אירועים"),evHint:e("סיכום יומן הכניסות: לפי יום (באזור הזמן של העמדה), לפי עמדה, אמצעי זיהוי וחריגות. מספרים בלבד, ללא פרטי אנשים."),granted:e("אושרו"),denied:e("נדחו"),other:e("אירועים אחרים"),total:e('סה"כ'),byDay:e("כניסות לפי יום"),byStation:e("לפי עמדה"),methods:e("אמצעי זיהוי"),anomalies:e("חריגות"),showTable:e("הצגה כטבלה"),hideTable:e("הסתרת הטבלה"),expTitle:e("ייצוא"),expHint:e("קבצי CSV שנוצרים ב־Arx. כל ייצוא נרשם ביומן הפעולות."),expInventory:e("מלאי העמדות"),expInventoryHint:e("דגם, קושחה, סנכרון וקיבולת של כל עמדה, מהנתונים השמורים (בלי פנייה לעמדות)."),expAudit:e("יומן השינויים של מערכת האינטרקום"),expAuditHint:e("מה שונה במערכת האינטרקום ב־30 הימים האחרונים ועל ידי מי."),download:e("הורדה"),downloaded:t=>t===null?e("הקובץ הורד."):e("הקובץ הורד ({n} שורות).",{n:t}),adminOnly:e("הייצוא זמין למנהלי בקרת הכניסה בלבד.")},E={pending:e("ממתין"),failed:e("נכשל"),verified:e("אומת בעמדה"),settled:e("הסתיים"),saved:e("נשמר"),unknown:e("לא ידוע"),paused:e("מושהה"),running:e("פועל"),completed:e("הושלם"),completed_with_errors:e("הושלם עם שגיאות"),cancelled:e("בוטל"),synced:e("מסונכרן"),syncing:e("מסתנכרן"),offline:e("לא מחובר"),conflict:e("התנגשות"),error:e("שגיאה"),delete_pending:e("מחיקה ממתינה"),granted:e("אושר"),denied:e("נדחה")},N={sync:e("סנכרון"),bulk:e("עריכה מרוכזת"),csv:e("ייבוא קובץ"),unknown:e("לא ידוע")},I={access:e("כניסה"),change:e("שינוי"),sync:e("סנכרון"),unknown:e("לא ידוע")},V={"sync/user_station":e("סנכרון אדם לעמדה"),"bulk/csv_import":e("ייבוא קובץ"),"bulk/enable":e("הפעלה מרוכזת"),"bulk/disable":e("השבתה מרוכזת"),"bulk/assign":e("שיוך מרוכז"),"bulk/unassign":e("הסרת שיוך מרוכזת"),"bulk/delete":e("מחיקה מרוכזת"),"bulk/renew":e("חידוש מרוכז"),"users/create":e("יצירת אדם"),"users/update":e("עדכון אדם"),"users/delete":e("מחיקת אדם"),"users/archive":e("העברה לארכיון"),access_granted:e("כניסה אושרה"),access_denied:e("כניסה נדחתה"),door_open:e("דלת נפתחה"),door_not_closed:e("דלת לא נסגרה"),ring:e("צלצול")},_t={access_denied:e("כניסות שנדחו"),attempt_limit:e("חריגה ממספר ניסיונות"),unlock_exception:e("פתיחה חריגה"),door_not_closed:e("דלת לא נסגרה")},St={card:e("כרטיס"),pin:e("קוד"),unknown:e("לא ידוע")},Tt={unknown:e("אין נתון"),stale:e("הנתון ישן"),at_limit:e("במגבלה"),near_limit:e("קרוב למגבלה"),growth_to_limit:e("יגיע למגבלה בקרוב"),observed:e("תקין")},_=(t,s)=>s?t[s]??s:"—";function Ct(t){return t==="at_limit"?"err":t==="near_limit"||t==="growth_to_limit"?"warn":t==="observed"?"ok":"neutral"}function R(t){return t==="failed"||t==="error"||t==="conflict"||t==="completed_with_errors"?"err":t==="pending"||t==="syncing"||t==="paused"||t==="running"||t==="offline"?"warn":t==="verified"||t==="synced"||t==="completed"||t==="settled"||t==="saved"?"ok":"neutral"}function Mt(t){return t===null?"neutral":t>=95?"err":t>=80?"warn":"ok"}function zt(t){return t.progress.verified+t.progress.settled}function Et(t,s){return s&&t.cancellable&&t.revision!==null}function ot(t){if(!Number.isFinite(t)||t<=1)return 1;const s=10**Math.floor(Math.log10(t));for(const n of[1,1.2,1.5,2,2.5,3,4,5,6,8,10])if(Math.round(n*s*1e3)/1e3>=t)return Math.round(n*s*1e3)/1e3;return 10*s}function lt(t){return[0,t/4,t/2,3*t/4,t].map(s=>Math.round(s*100)/100)}function dt(t){return Math.abs(t)>=1e3?`${Math.round(t/100)/10}K`:String(Math.round(t*10)/10)}const Ot=24,X=2;function Ht(t,s,n,r,a=!0){const o=t.length;if(!o||s<=0||n<=0)return[];const p=s/o,g=Math.max(2,Math.min(Ot,p*.6));return t.map((f,h)=>{const b=(a?o-1-h:h)*p+(p-g)/2,k=r>0?f.granted/r*n:0,H=r>0?f.denied/r*n:0,y=n-k,u=f.denied>0?Math.max(0,H-(f.granted>0?X:0)):0;return{key:f.day,x:b,w:g,granted:{y,h:k},denied:{y:y-(f.granted>0&&f.denied>0?X:0)-u,h:u},values:{granted:f.granted,denied:f.denied}}})}function G(t,s,n,r,a=4){if(r<=0)return"";const o=Math.min(a,n/2,r);return`M${t},${s+r}V${s+o}Q${t},${s} ${t+o},${s}H${t+n-o}Q${t+n},${s} ${t+n},${s+o}V${s+r}Z`}function Ft(t,s,n,r,a=!0){const o=t.filter(h=>h.users!==null&&Number.isFinite(Date.parse(h.at)));if(!o.length)return[];const p=Date.parse(o[0].at),g=Date.parse(o[o.length-1].at),f=Math.max(1,g-p);return o.map(h=>{const w=o.length===1?1:(Date.parse(h.at)-p)/f,b=a?s-w*s:w*s,k=r>0?n-h.users/r*n:n;return{x:Math.round(b*10)/10,y:Math.round(k*10)/10,at:h.at,v:h.users}})}function Q(t){return t.map((s,n)=>`${n?"L":"M"}${s.x},${s.y}`).join("")}function At(t,s){let n=-1,r=1/0;return t.forEach((a,o)=>{const p=Math.abs(a.x-s);p<r&&(r=p,n=o)}),n}function B(t){const s=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t);return s?`${Number(s[3])}.${Number(s[2])}`:t}var Dt=Object.defineProperty,Rt=Object.getOwnPropertyDescriptor,x=(t,s,n,r)=>{for(var a=r>1?void 0:r?Rt(s,n):s,o=t.length-1,p;o>=0;o--)(p=t[o])&&(a=(r?p(s,n,a):p(a))||a);return r&&a&&Dt(s,n,a),a};const ct=P`
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
  /* CR-CMP2-TABLES-REST-2470 (owner N10): the numbers twin of a chart is the shared table (bare, read only, never wider than the chart;
     the chart's 4 / 8 px compact rows) */
  sw-table[data-chart-table] {
    --sw-table-min: 0;
    --sw-table-cell-pad: 4px 8px;
    margin-block-start: 8px;
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
`;class K extends rt{constructor(){super(...arguments),this.w=640}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(s=>{const n=Math.round(s[0].contentRect.width);n>160&&Math.abs(n-this.w)>2&&(this.w=n)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}}x([$()],K.prototype,"w",2);const jt=()=>[{key:"day",label:it("יום"),render:t=>B(t.day)},{key:"granted",label:i.granted,kind:"num"},{key:"denied",label:i.denied,kind:"num"}];let O=class extends K{constructor(){super(...arguments),this.days=[],this.height=200,this.hot=null,this.table=!1}render(){const t=this.days;if(!t.length)return l`<div class="empty" data-chart-empty>${i.empty}</div>`;const s=this.w,n=this.height,r=34,a=16,o=22,p=s-r,g=n-a-o,f=ot(Math.max(...t.map(d=>d.granted+d.denied),1)),h=Ht(t,p,g,f,!0),w=h.length>1?p/h.length:p,b=w<34?Math.ceil(34/w):1,k=t.reduce((d,S,J)=>S.granted+S.denied>t[d].granted+t[d].denied?J:d,0),H=this.hot===null?-1:h.findIndex(d=>d.key===this.hot),y=H>=0?h[H]:null,u=`${i.byDay}: ${t.map(d=>`${B(d.day)} ${i.granted} ${d.granted}, ${i.denied} ${d.denied}`).join("; ")}`;return l`
      <svg viewBox="0 0 ${s} ${n}" role="img" aria-label=${u} data-day-chart @pointerleave=${()=>this.hot=null}>
        ${lt(f).map(d=>{const S=a+g-d/f*g;return M`<line class="grid" x1="0" x2=${p} y1=${S} y2=${S} opacity=${d===0?1:.6}></line>
            <text x=${s-4} y=${S+4} text-anchor="end">${dt(d)}</text>`})}
        ${h.map((d,S)=>{const J=()=>this.hot=d.key,pt=()=>{this.hot===d.key&&(this.hot=null)},Y=d.x+d.w/2,Z=d.values.granted+d.values.denied,ht=S%b===0||S===h.length-1?M`<text x=${Y} y=${n-6} text-anchor="middle">${B(d.key)}</text>`:c,ut=S===k&&Z>0?M`<text class="v" x=${Y} y=${a+Math.min(d.granted.y,d.denied.h?d.denied.y:d.granted.y)-5} text-anchor="middle">${Z}</text>`:c;return M`<g class=${this.hot===d.key?"band hot":"band"} tabindex="0" data-day=${d.key} aria-label=${`${B(d.key)}: ${i.granted} ${d.values.granted}, ${i.denied} ${d.values.denied}`}
              @pointerenter=${J} @focus=${J} @blur=${pt}>
            <rect class="hit" x=${d.x-(w-d.w)/2} y=${a-6} width=${w} height=${g+6}></rect>
            <g transform=${`translate(0 ${a})`}>
              ${d.granted.h>0?M`<path class="g" d=${G(d.x,d.granted.y,d.w,d.granted.h,d.denied.h>0?0:4)}></path>`:c}
              ${d.denied.h>0?M`<path class="d" d=${G(d.x,d.denied.y,d.w,d.denied.h)}></path>`:c}
            </g>
            ${ut}${ht}
          </g>`})}
      </svg>
      ${y?l`<div class="tip" role="tooltip" data-chart-tip style=${`left:${(y.x+y.w/2)/s*100}%; inset-block-start:${(a+Math.min(y.granted.y,y.denied.h?y.denied.y:y.granted.y))/n*100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${y.values.granted}</b> ${i.granted}</span>
            <span><span class="k" style="background:var(--c-s2)"></span><b>${y.values.denied}</b> ${i.denied}</span>
            <small>${B(y.key)}</small>
          </div>`:c}
      <div class="legend" data-chart-legend><span><i class="lg"></i>${i.granted}</span><span><i class="ld"></i>${i.denied}</span></div>
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${()=>this.table=!this.table}>${this.table?i.hideTable:i.showTable}</button>
      <div class=${this.table?"tw":"sr"}>
        <sw-table bare static-rows keep-columns data-chart-table rowKey="day" .columns=${jt()} .rows=${t}></sw-table>
      </div>
    `}};O.styles=[ct,P`
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
    `];x([z({attribute:!1})],O.prototype,"days",2);x([z({type:Number})],O.prototype,"height",2);x([$()],O.prototype,"hot",2);x([$()],O.prototype,"table",2);O=x([U("wk-ops-day-chart")],O);let T=class extends K{constructor(){super(...arguments),this.points=[],this.limit=null,this.label="",this.height=180,this.fmt=t=>t,this.hot=-1,this.table=!1}tableCols(){return[{key:"at",label:i.sampledAt,render:t=>this.fmt(t.at)},{key:"users",label:this.label,kind:"num"}]}move(t,s){const n=this.renderRoot.querySelector("svg");if(!n)return;const r=n.getBoundingClientRect();this.hot=At(s,(t.clientX-r.left)/r.width*this.w)}key(t,s){if(t.key!=="ArrowLeft"&&t.key!=="ArrowRight")return;t.preventDefault();const n=t.key==="ArrowLeft"?1:-1;this.hot=Math.max(0,Math.min(s-1,(this.hot<0?s-1:this.hot)+n))}render(){const t=this.points.filter(u=>u.users!==null);if(t.length<2)return l`<div class="empty" data-trend-empty>${i.trendNone}</div>`;const s=this.w,n=this.height,r=40,a=14,o=8,p=s-r,g=n-a-o,f=ot(Math.max(...t.map(u=>u.users),this.limit??0,1)*1.05),h=Ft(t,p-8,g,f,!0).map(u=>({...u,x:u.x+4})),w=h[h.length-1],b=this.hot>=0&&this.hot<h.length?h[this.hot]:null,k=this.limit!==null?a+g-this.limit/f*g:null,H=`${Q(h.map(u=>({x:u.x,y:u.y+a})))}L${w.x},${a+g}L${h[0].x},${a+g}Z`,y=`${this.label}: ${t.map(u=>`${this.fmt(u.at)} ${u.users}`).join("; ")}`;return l`
      <svg viewBox="0 0 ${s} ${n}" role="img" aria-label=${y} data-trend-chart>
        ${lt(f).map(u=>{const d=a+g-u/f*g;return M`<line class="grid" x1="0" x2=${p} y1=${d} y2=${d} opacity=${u===0?1:.6}></line><text x=${s-4} y=${d+4} text-anchor="end">${dt(u)}</text>`})}
        ${k!==null?M`<line class="limit" x1="0" x2=${p} y1=${k} y2=${k} data-trend-limit></line><text x=${p-4} y=${k-5} text-anchor="end" data-trend-limit-label>${it("מגבלה {n}",{n:String(this.limit)})}</text>`:c}
        <path class="area" d=${H}></path>
        <path class="line" d=${Q(h.map(u=>({x:u.x,y:u.y+a})))}></path>
        <circle class="dot" cx=${w.x} cy=${w.y+a} r="4"></circle>
        <text class="v" x=${w.x} y=${w.y+a-9} text-anchor="middle">${w.v}</text>
        ${b?M`<line class="cross" x1=${b.x} x2=${b.x} y1=${a} y2=${a+g}></line><circle class="dot" cx=${b.x} cy=${b.y+a} r="4"></circle>`:c}
        <rect class="plot" x="0" y=${a} width=${p} height=${g} fill="transparent" tabindex="0" aria-label=${this.label}
          @pointermove=${u=>this.move(u,h)} @pointerleave=${()=>this.hot=-1} @focus=${()=>this.hot=h.length-1} @blur=${()=>this.hot=-1}
          @keydown=${u=>this.key(u,h.length)}></rect>
      </svg>
      ${b?l`<div class="tip" role="tooltip" data-chart-tip style=${`left:${b.x/s*100}%; inset-block-start:${(b.y+a)/n*100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${b.v}</b> ${this.label}</span><small>${this.fmt(b.at)}</small>
          </div>`:c}
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${()=>this.table=!this.table}>${this.table?i.hideTable:i.showTable}</button>
      <div class=${this.table?"tw":"sr"}>
        <sw-table bare static-rows keep-columns data-chart-table rowKey="at" .columns=${this.tableCols()} .rows=${t}></sw-table>
      </div>
    `}};T.styles=[ct,P`
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
    `];x([z({attribute:!1})],T.prototype,"points",2);x([z({type:Number})],T.prototype,"limit",2);x([z()],T.prototype,"label",2);x([z({type:Number})],T.prototype,"height",2);x([z({attribute:!1})],T.prototype,"fmt",2);x([$()],T.prototype,"hot",2);x([$()],T.prototype,"table",2);T=x([U("wk-ops-trend-chart")],T);const L=t=>{const s=new URLSearchParams;for(const[r,a]of Object.entries(t))a!=null&&a!==""&&s.set(r,String(a));const n=s.toString();return n?`?${n}`:""},C="access-control/operations",Bt=()=>D(`${C}/overview`),Lt=(t={})=>D(`${C}/operations${L({...t})}`),Jt=(t={})=>D(`${C}/investigations${L({...t})}`),Nt=()=>D(`${C}/jobs`),Pt=t=>D(`${C}/capacity${L({days:t})}`),It=(t={})=>D(`${C}/events-report${L({...t})}`);function qt(t,s,n=Date.now()){const r=q(n+3e4);return $t(`${C}/jobs/${encodeURIComponent(t)}/cancel`,{client_request_id:crypto.randomUUID().replace(/-/g,""),expires_at:r,confirmed:!0,revision:s})}async function W(t,s){const{blob:n,headers:r}=await vt(t),a=r.get("X-Export-Rows"),o=/filename="?([^";]+)"?/.exec(r.get("Content-Disposition")??"")?.[1];return{blob:n,rows:a===null?null:Number(a),filename:o||s}}const Ut=()=>W(`${C}/exports/fleet-inventory.csv`,"intercom-fleet-inventory.csv"),Kt=(t={})=>W(`${C}/exports/audit.csv${L({...t})}`,"intercom-change-log.csv"),Wt=t=>W(`${C}/jobs/${encodeURIComponent(t)}/errors.csv`,"intercom-job-errors.csv");function Yt(t){const s=URL.createObjectURL(t.blob),n=document.createElement("a");n.href=s,n.download=t.filename,document.body.appendChild(n),n.click(),n.remove(),setTimeout(()=>URL.revokeObjectURL(s),1e3)}var Zt=Object.defineProperty,Vt=Object.getOwnPropertyDescriptor,m=(t,s,n,r)=>{for(var a=r>1?void 0:r?Vt(s,n):s,o=t.length-1,p;o>=0;o--)(p=t[o])&&(a=(r?p(s,n,a):p(a))||a);return r&&a&&Zt(s,n,a),a};const tt=864e5,et=[1,7,30];function j(t){return t instanceof A?{s:"error",code:t.body.code,message:t.body.user_message||t.body.code,status:t.status}:{s:"error",code:"error",message:String(t),status:0}}const st=t=>Object.entries(t).map(([s,n])=>({code:s,n})),at=(t,s)=>[{key:"code",label:t,render:n=>_(s,n.code)},{key:"n",label:i.total,kind:"num"}];let v=class extends rt{constructor(){super(...arguments),this.view="",this.overview=null,this.loadState="loading",this.loadError="",this.ops={s:"idle"},this.opsFilter={kind:"all",state:"all",station_id:"",query:"",offset:0},this.jobs={s:"idle"},this.openJob="",this.confirmJob=null,this.cancelBusy=!1,this.cancelError="",this.flash="",this.timeline={s:"idle"},this.tlFilter={source:"all",station_id:"",query:"",period:7,offset:0},this.capacity={s:"idle"},this.trendStation="",this.trendDays=30,this.report={s:"idle"},this.evFilter={station_id:"",period:7},this.exportBusy="",this.exportMsg=null}connectedCallback(){super.connectedCallback(),this.load()}get tab(){return kt(this.view)}get zone(){const t=this.overview?.summary;return t&&t.state==="ready"?t.data.zone:wt}get stations(){const t=this.overview?.summary;return t&&t.state==="ready"?t.data.stations:[]}stationCols(){return[{key:"station_id",label:i.table.station,render:t=>this.name(t.station_id)},{key:"granted",label:i.granted,kind:"num"},{key:"denied",label:i.denied,kind:"num"},{key:"other",label:i.other,kind:"num"}]}name(t){return this.stations.find(s=>s.id===t)?.name??t}time(t){return yt(t,mt(),this.zone)}async load(){this.loadState="loading";try{this.overview=await Bt(),this.loadState="ready",this.loadTab(this.tab)}catch(t){this.loadState=t instanceof A&&t.status===403?"forbidden":"error",this.loadError=t instanceof A?t.body.user_message:String(t)}}updated(t){t.has("view")&&t.get("view")!==void 0&&this.loadState==="ready"&&this.loadTab(this.tab);const s=this.renderRoot.querySelector("nav.tabs"),n=s?.querySelector('a[aria-current="page"]');if(s&&n){const r=s.getBoundingClientRect(),a=n.getBoundingClientRect();a.left<r.left?s.scrollLeft-=r.left-a.left+8:a.right>r.right&&(s.scrollLeft+=a.right-r.right+8)}}loadTab(t){t==="operations"?(this.ops.s==="idle"&&this.loadOps(),this.jobs.s==="idle"&&this.loadJobs()):t==="investigations"&&this.timeline.s==="idle"?this.loadTimeline():t==="capacity"&&this.capacity.s==="idle"?this.loadCapacity():t==="events"&&this.report.s==="idle"&&this.loadReport()}offered(t){return this.overview?.views?.[t]!==!1}async loadOps(){this.ops={s:"loading"};const t=this.opsFilter;try{const s=await Lt({kind:t.kind,state:t.state,station_id:t.station_id||void 0,query:t.query||void 0,offset:t.offset,limit:25});this.ops={s:"ready",v:s.data}}catch(s){this.ops=j(s)}}async loadJobs(){this.jobs={s:"loading"};try{this.jobs={s:"ready",v:await Nt()}}catch(t){this.jobs=j(t)}}async loadTimeline(){this.timeline={s:"loading"};const t=this.tlFilter,s=t.period?q(Date.now()-t.period*tt):void 0;try{const n=await Jt({source:t.source,station_id:t.station_id||void 0,query:t.query||void 0,start:s,offset:t.offset,limit:25});this.timeline={s:"ready",v:n.data}}catch(n){this.timeline=j(n)}}async loadCapacity(){this.capacity={s:"loading"};try{const t=await Pt(this.trendDays);if(this.capacity={s:"ready",v:t},!this.trendStation||!t.data.records.some(s=>s.station_id===this.trendStation)){const s=[...t.data.records].sort((n,r)=>(r.users.used_percent??-1)-(n.users.used_percent??-1))[0];this.trendStation=s?.station_id??""}}catch(t){this.capacity=j(t)}}async loadReport(){this.report={s:"loading"};const t=this.evFilter,s=q(Date.now()-t.period*tt);try{this.report={s:"ready",v:await It({station_id:t.station_id||void 0,start:s})}}catch(n){this.report=j(n)}}pill(t,s,n=""){return l`<span class="pill" data-tone=${t} data-pill=${n}>${s}</span>`}partState(t,s,n){return t.s==="idle"||t.s==="loading"?l`<sw-state-panel state="loading" compact heading=${i.loading} data-part-state="loading"></sw-state-panel>`:t.s==="error"?t.status===501||!this.offered(s)?l`<sw-state-panel icon="wrench" state="empty" compact heading=${i.unavailable} data-part-state="unavailable"></sw-state-panel>`:l`<sw-state-panel state="error" compact heading=${i.errorTitle} hint=${t.message} actionLabel=${i.retry} @action=${n} data-part-state="error"></sw-state-panel>`:null}stationSelect(t,s,n){return l`<label class="f">${i.filterStation}
      <sw-field><select data-filter=${n} .value=${t} @change=${r=>s(r.target.value)}>
        <option value="">${i.all}</option>
        ${this.stations.map(r=>l`<option value=${r.id} ?selected=${r.id===t}>${r.name}</option>`)}
      </select></sw-field></label>`}meter(t,s,n){const r=s.used_percent,a=Mt(r);return l`<div class="meter" data-tone=${a} data-meter=${n} role="meter" aria-valuemin="0" aria-valuemax=${s.limit??0} aria-valuenow=${s.count??0} aria-label=${t}>
      <div class="lbl"><span>${t}</span><b><bdi dir="ltr">${i.usersOf(s.count,s.limit)}</bdi>${r!==null?l` · <bdi dir="ltr">${Math.round(r)}%</bdi>`:c}</b></div>
      <div class="bar"><i style=${`inline-size:${Math.max(0,Math.min(100,r??0))}%`}></i></div>
    </div>`}renderOverview(){const t=this.overview.summary;if(t.state==="error")return l`<sw-state-panel state="error" heading=${i.errorTitle} hint=${t.message} actionLabel=${i.retry} @action=${()=>void this.load()} data-part-state="error"></sw-state-panel>`;const s=t.data.kpis,n=(r,a,o,p)=>l`<sw-kpi data-kpi=${p} label=${i.kpi[r]} value=${String(s[r])} icon=${a} tone=${o}></sw-kpi>`;return l`
      <div class="kpis" data-kpis>
        ${n("stations","door","neutral","stations")}
        ${n("online","wifi",s.online===s.stations?"live":"neutral","online")}
        ${n("offline","offline",s.offline?"error":"neutral","offline")}
        ${n("pending_users","clock",s.pending_users?"partial":"neutral","pending")}
        ${n("sync_problems","warning",s.sync_problems?"error":"neutral","sync")}
        ${n("near_capacity","storage",s.near_capacity?"partial":"neutral","capacity")}
      </div>
      <section class="part" data-stations>
        <header><div><h2>${i.stationsTitle}</h2><p class="hint">${i.fetchedAt} ${this.time(t.fetched_at)}</p></div>
          <sw-button size="sm" icon="refresh" @click=${()=>void this.load()} data-refresh>${i.refresh}</sw-button></header>
        ${t.data.stations.length?l`<div class="list">${t.data.stations.map(r=>l`<article class="item" data-station=${r.id}>
                <div class="main"><b>${r.name}</b>${this.pill(r.online?"ok":"err",r.online?i.online:i.offline,"online")}${this.pill(R(r.sync_state),_(E,r.sync_state),"sync")}</div>
                <div class="end">${r.max_users?this.meter(i.table.users,{count:r.users,limit:r.max_users,used_percent:r.users!==null?Math.round(1e3*r.users/r.max_users)/10:null,remaining:null,growth_per_day:null,days_to_limit:null,alert:"observed"},"users"):c}</div>
                <div class="meta">
                  ${r.pending_users?l`<span>${i.table.pending}: ${r.pending_users}</span>`:c}
                  ${r.cards!==null?l`<span>${i.table.cards}: <bdi dir="ltr">${r.cards}${r.max_cards?` / ${r.max_cards}`:""}</bdi></span>`:c}
                  ${r.last_error?l`<span>${i.table.error}: <code>${r.last_error}</code></span>`:c}
                </div>
              </article>`)}</div>`:l`<sw-state-panel icon="door" state="empty" compact heading=${i.empty}></sw-state-panel>`}
      </section>`}renderOperations(){const t=this.opsFilter,s=a=>{this.opsFilter={...t,offset:0,...a},this.loadOps()},n=this.partState(this.ops,"operations",()=>void this.loadOps()),r=this.ops.s==="ready"?this.ops.v:null;return l`
      ${this.flash?l`<div class="msg ok" role="status" data-flash>${this.flash}</div>`:c}
      <section class="part" data-ops>
        <header><div><h2>${i.opsTitle}</h2><p class="hint">${i.opsHint}</p></div></header>
        <div class="filters">
          <label class="f">${i.filterKind}<sw-field><select data-filter="kind" .value=${t.kind} @change=${a=>s({kind:a.target.value})}>
            ${["all","sync","bulk","csv"].map(a=>l`<option value=${a} ?selected=${a===t.kind}>${a==="all"?i.all:N[a]}</option>`)}</select></sw-field></label>
          <label class="f">${i.filterState}<sw-field><select data-filter="state" .value=${t.state} @change=${a=>s({state:a.target.value})}>
            ${["all","pending","failed","verified","settled","saved"].map(a=>l`<option value=${a} ?selected=${a===t.state}>${a==="all"?i.all:E[a]}</option>`)}</select></sw-field></label>
          ${this.stationSelect(t.station_id,a=>s({station_id:a}),"station")}
          <sw-button size="sm" icon="refresh" @click=${()=>void this.loadOps()} data-ops-refresh>${i.refresh}</sw-button>
        </div>
        ${n??l`${r.stale?l`<div class="msg warn" role="status">${i.stale}</div>`:c}
          <div class="filters" data-ops-summary>${["pending","failed","verified","settled","saved"].map(a=>this.pill(R(a),`${E[a]}: ${r.summary[a]}`,a))}</div>
          ${r.records.length?l`<div class="list">${r.records.map(a=>l`<article class="item" data-op=${a.id}>
                  <div class="main"><b>${_(V,a.action)}</b>${this.pill("neutral",_(N,a.kind),"kind")}${this.pill(R(a.state),_(E,a.state),"state")}</div>
                  <div class="end"><span class="muted">${i.progress(zt(a),a.progress.total)}</span></div>
                  <div class="meta">
                    <span>${i.people(a.user_ids.length)}</span>
                    <span>${a.station_ids.map(o=>this.name(o)).join(", ")}</span>
                    <span>${this.time(a.updated_at)}</span>
                    ${a.errors.map(o=>l`<code>${o}</code>`)}
                  </div>
                </article>`)}</div>
              ${this.pager(r,a=>{this.opsFilter={...t,offset:a},this.loadOps()})}`:l`<sw-state-panel icon="activity" state="empty" compact heading=${i.empty} data-part-state="empty"></sw-state-panel>`}`}
      </section>
      ${this.renderJobs()}
      ${this.renderCancelDialog()}`}pager(t,s){return t.next_offset===null&&t.previous_offset===null?c:l`<div class="pager" data-pager><bdi dir="ltr">${t.offset+1}–${Math.min(t.total,t.offset+(t.limit??25))} / ${t.total}</bdi>
      <sw-button size="sm" ?disabled=${t.previous_offset===null} @click=${()=>t.previous_offset!==null&&s(t.previous_offset)}>${i.prev}</sw-button>
      <sw-button size="sm" ?disabled=${t.next_offset===null} @click=${()=>t.next_offset!==null&&s(t.next_offset)}>${i.more}</sw-button></div>`}renderJobs(){const t=this.partState(this.jobs,"jobs",()=>void this.loadJobs()),s=this.jobs.s==="ready"?this.jobs.v:null,n=!!s?.can_cancel;return l`<section class="part" data-jobs>
      <header><div><h2>${i.jobsTitle}</h2><p class="hint">${i.jobsHint}</p></div></header>
      ${t??(s.data.records.length?l`<div class="list">${s.data.records.map(r=>{const a=this.openJob===r.id;return l`<article class="item" data-job=${r.id}>
              <div class="main"><b>${_(N,r.kind)}</b>${this.pill(R(r.state),_(E,r.state),"state")}
                <span class="muted">${i.progress(r.saved,r.total)}</span>${r.failed?this.pill("err",i.rowsFailed(r.failed),"failed"):c}</div>
              <div class="end">
                ${r.errors.length?l`<sw-button size="sm" variant="ghost" @click=${()=>this.openJob=a?"":r.id} aria-expanded=${a} data-job-errors-toggle>${i.rowsFailed(r.errors.length)}</sw-button>`:c}
                ${n&&r.errors.length?l`<sw-button size="sm" icon="download" @click=${()=>void this.download("job",()=>Wt(r.id))} data-job-errors-csv>${i.errorsCsv}</sw-button>`:c}
                ${Et(r,n)?l`<sw-button size="sm" variant="danger" @click=${()=>this.askCancel(r)} data-job-cancel>${i.cancel}</sw-button>`:c}
              </div>
              <div class="meta"><span>${this.time(r.created_at)}</span>${r.pending?l`<span>${E.pending}: ${r.pending}</span>`:c}</div>
              ${a?l`<ul class="errs" data-job-error-rows>${r.errors.map(o=>l`<li>${i.row} ${o.row??"—"}: <code>${o.code}</code></li>`)}</ul>`:c}
            </article>`})}</div>`:l`<sw-state-panel icon="list" state="empty" compact heading=${i.jobsEmpty} data-part-state="empty"></sw-state-panel>`)}
      ${this.exportMsg&&this.exportMsg.kind==="job"?l`<div class="msg ${this.exportMsg.ok?"ok":"err"}" role="status" data-export-msg>${this.exportMsg.text}</div>`:c}
    </section>`}askCancel(t){this.cancelError="",this.confirmJob=t}async doCancel(){const t=this.confirmJob;if(!(!t||t.revision===null||this.cancelBusy)){this.cancelBusy=!0,this.cancelError="";try{await qt(t.id,t.revision),this.confirmJob=null,this.flash=i.cancelled,await this.loadJobs()}catch(s){this.cancelError=s instanceof A?s.body.user_message||s.body.code:String(s),s instanceof A&&s.body.details?.outcome!=="not_sent"&&this.loadJobs()}finally{this.cancelBusy=!1}}}renderCancelDialog(){const t=this.confirmJob;return l`<sw-dialog ?open=${!!t} heading=${i.cancelTitle} ?locked=${this.cancelBusy} @close=${()=>this.confirmJob=null} data-cancel-dialog>
      <p>${i.cancelBody}</p>
      ${t?l`<p class="muted">${_(N,t.kind)} · ${i.progress(t.saved,t.total)} · ${this.time(t.created_at)}</p>`:c}
      ${this.cancelError?l`<div class="msg err" role="alert" data-cancel-error>${this.cancelError}</div>`:c}
      <sw-button slot="footer" @click=${()=>this.confirmJob=null} ?disabled=${this.cancelBusy} data-cancel-keep>${i.cancelKeep}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>void this.doCancel()} ?disabled=${this.cancelBusy||!!this.cancelError} data-cancel-confirm>${i.cancelConfirm}</sw-button>
    </sw-dialog>`}renderInvestigations(){const t=this.tlFilter,s=this.overview.can,n=o=>{this.tlFilter={...t,offset:0,...o},this.loadTimeline()},r=this.partState(this.timeline,"investigations",()=>void this.loadTimeline()),a=this.timeline.s==="ready"?this.timeline.v:null;return l`<section class="part" data-timeline>
      <header><div><h2>${i.invTitle}</h2><p class="hint">${i.invHint}</p></div></header>
      <div class="filters">
        <label class="f">${i.invSource}<sw-field><select data-filter="source" .value=${t.source} @change=${o=>n({source:o.target.value})}>
          ${["all","access","change","sync"].map(o=>l`<option value=${o} ?selected=${o===t.source}>${o==="all"?i.all:I[o]}</option>`)}</select></sw-field></label>
        ${this.stationSelect(t.station_id,o=>n({station_id:o}),"station")}
        <label class="f">${i.invFrom}<sw-field><select data-filter="period" .value=${String(t.period)} @change=${o=>n({period:Number(o.target.value)})}>
          ${et.map(o=>l`<option value=${o} ?selected=${o===t.period}>${o===1?F("24 שעות"):i.days(o)}</option>`)}</select></sw-field></label>
        ${s.names?l`<label class="f">${i.filterSearch}<sw-field><input type="search" data-filter="query" .value=${t.query} maxlength="128"
              @change=${o=>n({query:o.target.value.trim()})} /></sw-field></label>`:c}
      </div>
      ${r??l`${a.fields_hidden.length?l`<div class="msg warn" role="status" data-hidden-fields>${i.hiddenFields}</div>`:c}
        ${a.access_storage_failed?l`<div class="msg err" role="status">${i.storageFailed}</div>`:c}
        <div class="filters">${["access","change","sync"].map(o=>this.pill("neutral",`${I[o]}: ${a.summary[o]}`,o))}</div>
        ${a.records.length?l`<div class="list">${a.records.map(o=>l`<article class="item" data-tl=${o.id} data-source=${o.source}>
                <div class="main"><b>${_(V,o.action)}</b>${this.pill("neutral",_(I,o.source),"source")}${this.pill(R(o.status),_(E,o.status),"status")}</div>
                <div class="end"><span class="muted">${this.time(o.time)}</span></div>
                <div class="meta">
                  <span>${o.station_ids.map(p=>this.name(p)).join(", ")}${o.door?` · ${F("דלת {door}",{door:o.door})}`:""}</span>
                  ${o.person_name?l`<span data-person>${o.person_name}${o.employee_no?` (${o.employee_no})`:""}</span>`:c}
                  ${o.actor?l`<span data-actor>${i.operator}: ${a.actors[o.actor]??o.actor}</span>`:c}
                  ${o.fields.length?l`<span>${o.fields.join(", ")}</span>`:c}
                  <code>${o.evidence}</code>
                </div>
              </article>`)}</div>
            ${this.pager(a,o=>{this.tlFilter={...t,offset:o},this.loadTimeline()})}`:l`<sw-state-panel icon="history" state="empty" compact heading=${i.empty} data-part-state="empty"></sw-state-panel>`}`}
    </section>`}renderCapacity(){const t=this.partState(this.capacity,"capacity",()=>void this.loadCapacity()),s=this.capacity.s==="ready"?this.capacity.v:null,n=s?.data.records??[],r=n.find(o=>o.station_id===this.trendStation)??null,a=s?.trend.series[this.trendStation]??[];return l`<section class="part" data-capacity>
        <header><div><h2>${i.capTitle}</h2><p class="hint">${i.capHint}</p></div>
          <sw-button size="sm" icon="refresh" @click=${()=>void this.loadCapacity()} data-cap-refresh>${i.refresh}</sw-button></header>
        ${t??(n.length?l`<div class="cap-grid">${n.map(o=>l`<article class="cap" data-cap=${o.station_id}>
                <header><b>${o.name}</b>${this.pill(Ct(o.users.alert),Tt[o.users.alert],"alert")}</header>
                ${this.meter(i.table.users,o.users,"users")}${this.meter(i.table.cards,o.cards,"cards")}
                <div class="muted">
                  ${o.users.growth_per_day!==null?l`<span><bdi dir="ltr">${o.users.growth_per_day>0?"+":""}${o.users.growth_per_day}</bdi> ${F("ביום")}</span>`:c}
                  ${o.users.days_to_limit!==null?l` · <span data-days-to-limit>${i.daysToLimit(o.users.days_to_limit)}</span>`:c}
                  <div>${i.sampledAt}: ${this.time(o.sampled_at)}</div>
                </div>
              </article>`)}</div>`:l`<sw-state-panel icon="users" state="empty" compact heading=${i.empty} data-part-state="empty"></sw-state-panel>`)}
      </section>
      ${s&&n.length?l`<section class="part" data-trend>
            <header><div><h2>${i.trendTitle}${r?` · ${r.name}`:""}</h2><p class="hint">${i.trendHint}</p></div></header>
            <div class="filters">
              <label class="f">${i.filterStation}<sw-field><select data-filter="trend-station" .value=${this.trendStation} @change=${o=>this.trendStation=o.target.value}>
                ${n.map(o=>l`<option value=${o.station_id} ?selected=${o.station_id===this.trendStation}>${o.name}</option>`)}</select></sw-field></label>
              <label class="f">${F("טווח")}<sw-field><select data-filter="trend-days" .value=${String(this.trendDays)} @change=${o=>{this.trendDays=Number(o.target.value),this.loadCapacity()}}>${[7,30,90,365].map(o=>l`<option value=${o} ?selected=${o===this.trendDays}>${i.days(o)}</option>`)}</select></sw-field></label>
            </div>
            <wk-ops-trend-chart .points=${a} .limit=${r?.users.limit??null} label=${i.table.users} .fmt=${o=>this.time(o)}></wk-ops-trend-chart>
          </section>`:c}`}renderEvents(){const t=this.evFilter,s=a=>{this.evFilter={...t,...a},this.loadReport()},n=this.partState(this.report,"events_report",()=>void this.loadReport()),r=this.report.s==="ready"?this.report.v.data:null;return l`<section class="part" data-events>
      <header><div><h2>${i.evTitle}</h2><p class="hint">${i.evHint}</p></div></header>
      <div class="filters">
        ${this.stationSelect(t.station_id,a=>s({station_id:a}),"station")}
        <label class="f">${i.invFrom}<sw-field><select data-filter="period" .value=${String(t.period)} @change=${a=>s({period:Number(a.target.value)})}>
          ${et.map(a=>l`<option value=${a} ?selected=${a===t.period}>${a===1?F("24 שעות"):i.days(a)}</option>`)}</select></sw-field></label>
      </div>
      ${n??l`
        ${r.storage_failed?l`<div class="msg err" role="status">${i.storageFailed}</div>`:c}
        <div class="kpis" data-ev-kpis>
          <sw-kpi label=${i.total} value=${String(r.totals.records)} icon="activity" tone="neutral" data-kpi="records"></sw-kpi>
          <sw-kpi label=${i.granted} value=${String(r.totals.granted)} icon="check" tone="neutral" data-kpi="granted"></sw-kpi>
          <sw-kpi label=${i.denied} value=${String(r.totals.denied)} icon="lock" tone=${r.totals.denied?"partial":"neutral"} data-kpi="denied"></sw-kpi>
          <sw-kpi label=${i.other} value=${String(r.totals.other)} icon="info" tone="neutral" data-kpi="other"></sw-kpi>
        </div>
        <h3>${i.byDay}</h3>
        <wk-ops-day-chart .days=${r.by_day.map(a=>({day:a.day,granted:a.granted,denied:a.denied}))}></wk-ops-day-chart>
        <div class="two">
          <div>
            <h3>${i.byStation}</h3>
            <sw-table class="t" bare static-rows keep-columns data-ev-stations rowKey="station_id" .columns=${this.stationCols()} .rows=${r.by_station}
              .rowAttrs=${a=>({"data-ev-station":String(a.station_id)})}></sw-table>
          </div>
          <div>
            <h3>${i.anomalies}</h3>
            <sw-table class="t" bare static-rows keep-columns data-ev-anomalies rowKey="code" .columns=${at(i.anomalies,_t)} .rows=${st(r.anomalies)}
              .rowAttrs=${a=>({"data-ev-anomaly":String(a.code)})}></sw-table>
            <h3>${i.methods}</h3>
            <sw-table class="t" bare static-rows keep-columns data-ev-methods rowKey="code" .columns=${at(i.methods,St)} .rows=${st(r.methods)}
              .rowAttrs=${a=>({"data-ev-method":String(a.code)})}></sw-table>
          </div>
        </div>`}
    </section>`}async download(t,s){if(!this.exportBusy){this.exportBusy=t,this.exportMsg=null;try{const n=await s();Yt(n),this.exportMsg={kind:t,ok:!0,text:i.downloaded(n.rows)}}catch(n){this.exportMsg={kind:t,ok:!1,text:n instanceof A?n.body.user_message||n.body.code:String(n)}}finally{this.exportBusy=""}}}renderExports(){const t=this.overview.can,s=n=>this.exportMsg&&this.exportMsg.kind===n?l`<div class="msg ${this.exportMsg.ok?"ok":"err"}" role="status" data-export-msg=${n}>${this.exportMsg.text}</div>`:c;return l`<section class="part" data-exports>
      <header><div><h2>${i.expTitle}</h2><p class="hint">${i.expHint}</p></div></header>
      ${t.export?l`<div class="two">
            <div class="exp" data-export="inventory"><b>${i.expInventory}</b><span class="muted">${i.expInventoryHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy||!this.offered("inventory")} @click=${()=>void this.download("inventory",Ut)} data-export-btn="inventory">${i.download}</sw-button>${s("inventory")}</div>
            <div class="exp" data-export="audit"><b>${i.expAudit}</b><span class="muted">${i.expAuditHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy||!this.offered("audit_export")} @click=${()=>void this.download("audit",()=>Kt())} data-export-btn="audit">${i.download}</sw-button>${s("audit")}</div>
          </div>`:l`<sw-state-panel state="forbidden" compact heading=${i.adminOnly} data-part-state="forbidden"></sw-state-panel>`}
    </section>`}body(t){return t==="operations"?this.renderOperations():t==="investigations"?this.renderInvestigations():t==="capacity"?this.renderCapacity():t==="events"?this.renderEvents():t==="exports"?this.renderExports():this.renderOverview()}render(){const t=(n,r)=>l`<sw-page crumbs=${F("הגדרות")} heading=${i.title} subheading=${i.sub} data-intercom-ops data-state=${r}>${n}</sw-page>`;if(this.loadState==="loading")return t(l`<sw-state-panel state="loading" heading=${i.loading}></sw-state-panel>`,"loading");if(this.loadState==="forbidden")return t(l`<sw-state-panel state="forbidden" heading=${i.forbiddenTitle} hint=${i.forbiddenHint}></sw-state-panel>`,"forbidden");if(this.loadState==="error")return t(l`<sw-state-panel state="error" heading=${i.errorTitle} hint=${this.loadError} actionLabel=${i.retry} @action=${()=>void this.load()}></sw-state-panel>`,"error");const s=this.tab;return t(l`<nav class="tabs" aria-label=${i.title}>
          ${nt.map(n=>l`<a href="${xt}/${n}" aria-current=${n===s?"page":"false"} data-ops-tab=${n}>${i.tabs[n]}</a>`)}
        </nav>
        <div data-ops-view=${s}>${this.body(s)}</div>`,"ready")}};v.styles=[ft,P`
      ${gt}
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
      ${bt}
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
      /* CR-CMP2-TABLES-REST-2470 (owner N10): the report's three tables are the shared table, bare in the section (never wider than
         their column) */
      sw-table.t {
        --sw-table-min: 0;
        --sw-table-cell-pad: 7px 10px;
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
    `];m([z()],v.prototype,"view",2);m([$()],v.prototype,"overview",2);m([$()],v.prototype,"loadState",2);m([$()],v.prototype,"loadError",2);m([$()],v.prototype,"ops",2);m([$()],v.prototype,"opsFilter",2);m([$()],v.prototype,"jobs",2);m([$()],v.prototype,"openJob",2);m([$()],v.prototype,"confirmJob",2);m([$()],v.prototype,"cancelBusy",2);m([$()],v.prototype,"cancelError",2);m([$()],v.prototype,"flash",2);m([$()],v.prototype,"timeline",2);m([$()],v.prototype,"tlFilter",2);m([$()],v.prototype,"capacity",2);m([$()],v.prototype,"trendStation",2);m([$()],v.prototype,"trendDays",2);m([$()],v.prototype,"report",2);m([$()],v.prototype,"evFilter",2);m([$()],v.prototype,"exportBusy",2);m([$()],v.prototype,"exportMsg",2);v=m([U("system-intercom-ops")],v);export{v as SystemIntercomOps};
