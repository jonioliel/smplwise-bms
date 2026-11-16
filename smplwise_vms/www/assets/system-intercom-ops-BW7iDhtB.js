import{i as I,r as u,n as M,q as o,p as d,_ as T,a as G,x as N,L as H,au as lt,dD as dt,R as D,jk as ct}from"./index-Cif9Bwbo.js";import{U as pt,c as ht}from"./wiskey-format-BJBSoZNO.js";import"./sw-logo-art-Va6y_cIM.js";const tt=["overview","operations","investigations","capacity","events","exports"],ut="#/system/intercom-operations";function vt(t){return tt.includes(t)?t:"overview"}const i={title:"תפעול האינטרקום",sub:"מה קורה במערכת האינטרקום: פעולות סנכרון, משימות, ציר זמן לחקירה, קיבולת העמדות ודוח האירועים",tabs:{overview:"סיכום",operations:"פעולות ומשימות",investigations:"חקירות",capacity:"קיבולת ומגמות",events:"דוח אירועים",exports:"ייצוא"},loading:"טוען את נתוני התפעול…",forbiddenTitle:"אין לכם הרשאה לתפעול האינטרקום",forbiddenHint:"נדרשת הרשאת צפייה בבקרת כניסה ברמת ההתקנה כולה.",errorTitle:"לא ניתן לטעון את תפעול האינטרקום",unavailable:"מערכת האינטרקום המותקנת אינה מציעה את התצוגה הזו.",retry:"נסו שוב",refresh:"רענון",fetchedAt:"עודכן",empty:"אין מה להציג",kpi:{stations:"עמדות",online:"מחוברות",offline:"לא מחוברות",pending_users:"ממתינים לסנכרון",sync_problems:"עמדות עם תקלת סנכרון",near_capacity:"קרובות למגבלה"},stationsTitle:"העמדות",table:{station:"עמדה",state:"מצב",sync:"סנכרון",pending:"ממתינים",users:"משתמשים",cards:"כרטיסים",use:"ניצולת",error:"שגיאה אחרונה"},online:"מחוברת",offline:"לא מחוברת",opsTitle:"פעולות",opsHint:"סנכרון של אדם לעמדה, עריכות מרוכזות וייבוא קבצים, עם ההתקדמות של כל אחת.",jobsTitle:"משימות מרוכזות",jobsHint:"משימות עריכה מרוכזת וייבוא שנוצרו דרך Arx. שורות שנכשלו מופיעות עם קוד השגיאה.",jobsEmpty:"אין משימות מרוכזות.",filterKind:"סוג",filterState:"מצב",filterStation:"עמדה",filterSearch:"חיפוש",all:"הכול",people:t=>t===1?"אדם אחד":`${t} אנשים`,stationsCount:t=>t===1?"עמדה אחת":`${t} עמדות`,progress:(t,e)=>`${t} מתוך ${e}`,cancel:"ביטול המשימה",cancelTitle:"לבטל את המשימה?",cancelBody:"שורות שעדיין לא נשמרו יבוטלו. שורות שכבר נשמרו ממשיכות להסתנכרן לעמדות. הפעולה נשלחת פעם אחת.",cancelConfirm:"כן, לבטל",cancelKeep:"השארת המשימה",cancelled:"המשימה בוטלה.",errorsCsv:"הורדת השורות שנכשלו",rowsFailed:t=>t===1?"שורה אחת נכשלה":`${t} שורות נכשלו`,row:"שורה",more:"הבא",prev:"הקודם",stale:"הנתונים השתנו מאז הטעינה - רעננו כדי לראות את המצב העדכני.",invTitle:"ציר זמן לחקירה",invHint:"כניסות, שינויים וסנכרון זה לצד זה, 30 הימים האחרונים. סמיכות בזמן אינה מוכיחה קשר בין אירועים.",invSource:"מקור",invFrom:"מתאריך",invTo:"עד תאריך",hiddenFields:"חלק מהפרטים מוסתרים לפי ההרשאות שלכם.",storageFailed:"שמירת האירועים במערכת האינטרקום נכשלה - ייתכן שחסרים אירועים.",operator:"מפעיל",capTitle:"קיבולת לפי עמדה",capHint:"משתמשים וכרטיסים מול המגבלה שהעמדה מדווחת. התחזית היא הערכה לפי הצמיחה שנמדדה.",trendTitle:"מגמה",trendHint:"מספר המשתמשים בעמדה לאורך זמן, מתוך הדגימות ש־Arx שמר. הקו האופקי הוא המגבלה שהעמדה מדווחת.",trendNone:"עדיין אין מספיק דגימות כדי לצייר מגמה לעמדה הזו. כל צפייה בדף שומרת דגימה חדשה כשיש.",days:t=>`${t} ימים`,usersOf:(t,e)=>t===null?"—":e===null?`${t}`:`${t} / ${e}`,daysToLimit:t=>`כ־${Math.round(t)} ימים עד המגבלה`,growth:t=>`${t>0?"+":""}${t} ביום`,sampledAt:"נדגם",evTitle:"דוח אירועים",evHint:"סיכום יומן הכניסות: לפי יום (באזור הזמן של העמדה), לפי עמדה, אמצעי זיהוי וחריגות. מספרים בלבד, ללא פרטי אנשים.",granted:"אושרו",denied:"נדחו",other:"אירועים אחרים",total:'סה"כ',byDay:"כניסות לפי יום",byStation:"לפי עמדה",methods:"אמצעי זיהוי",anomalies:"חריגות",showTable:"הצגה כטבלה",hideTable:"הסתרת הטבלה",expTitle:"ייצוא",expHint:"קבצי CSV שנוצרים ב־Arx. כל ייצוא נרשם ביומן הפעולות.",expInventory:"מלאי העמדות",expInventoryHint:"דגם, קושחה, סנכרון וקיבולת של כל עמדה, מהנתונים השמורים (בלי פנייה לעמדות).",expAudit:"יומן השינויים של מערכת האינטרקום",expAuditHint:"מה שונה במערכת האינטרקום ב־30 הימים האחרונים ועל ידי מי.",download:"הורדה",downloaded:t=>t===null?"הקובץ הורד.":`הקובץ הורד (${t} שורות).`,adminOnly:"הייצוא זמין למנהלי בקרת הכניסה בלבד."},O={pending:"ממתין",failed:"נכשל",verified:"אומת בעמדה",settled:"הסתיים",saved:"נשמר",unknown:"לא ידוע",paused:"מושהה",running:"פועל",completed:"הושלם",completed_with_errors:"הושלם עם שגיאות",cancelled:"בוטל",synced:"מסונכרן",syncing:"מסתנכרן",offline:"לא מחובר",conflict:"התנגשות",error:"שגיאה",delete_pending:"מחיקה ממתינה",granted:"אושר",denied:"נדחה"},L={sync:"סנכרון",bulk:"עריכה מרוכזת",csv:"ייבוא קובץ",unknown:"לא ידוע"},J={access:"כניסה",change:"שינוי",sync:"סנכרון",unknown:"לא ידוע"},K={"sync/user_station":"סנכרון אדם לעמדה","bulk/csv_import":"ייבוא קובץ","bulk/enable":"הפעלה מרוכזת","bulk/disable":"השבתה מרוכזת","bulk/assign":"שיוך מרוכז","bulk/unassign":"הסרת שיוך מרוכזת","bulk/delete":"מחיקה מרוכזת","bulk/renew":"חידוש מרוכז","users/create":"יצירת אדם","users/update":"עדכון אדם","users/delete":"מחיקת אדם","users/archive":"העברה לארכיון",access_granted:"כניסה אושרה",access_denied:"כניסה נדחתה",door_open:"דלת נפתחה",door_not_closed:"דלת לא נסגרה",ring:"צלצול"},$t={access_denied:"כניסות שנדחו",attempt_limit:"חריגה ממספר ניסיונות",unlock_exception:"פתיחה חריגה",door_not_closed:"דלת לא נסגרה"},ft={card:"כרטיס",pin:"קוד",unknown:"לא ידוע"},mt={unknown:"אין נתון",stale:"הנתון ישן",at_limit:"במגבלה",near_limit:"קרוב למגבלה",growth_to_limit:"יגיע למגבלה בקרוב",observed:"תקין"},x=(t,e)=>e?t[e]??e:"—";function gt(t){return t==="at_limit"?"err":t==="near_limit"||t==="growth_to_limit"?"warn":t==="observed"?"ok":"neutral"}function j(t){return t==="failed"||t==="error"||t==="conflict"||t==="completed_with_errors"?"err":t==="pending"||t==="syncing"||t==="paused"||t==="running"||t==="offline"?"warn":t==="verified"||t==="synced"||t==="completed"||t==="settled"||t==="saved"?"ok":"neutral"}function bt(t){return t===null?"neutral":t>=95?"err":t>=80?"warn":"ok"}function wt(t){return t.progress.verified+t.progress.settled}function yt(t,e){return e&&t.cancellable&&t.revision!==null}function et(t){if(!Number.isFinite(t)||t<=1)return 1;const e=10**Math.floor(Math.log10(t));for(const r of[1,1.2,1.5,2,2.5,3,4,5,6,8,10])if(Math.round(r*e*1e3)/1e3>=t)return Math.round(r*e*1e3)/1e3;return 10*e}function st(t){return[0,t/4,t/2,3*t/4,t].map(e=>Math.round(e*100)/100)}function at(t){return Math.abs(t)>=1e3?`${Math.round(t/100)/10}K`:String(Math.round(t*10)/10)}const xt=24,W=2;function kt(t,e,r,a,s=!0){const n=t.length;if(!n||e<=0||r<=0)return[];const c=e/n,m=Math.max(2,Math.min(xt,c*.6));return t.map((f,h)=>{const g=(s?n-1-h:h)*c+(c-m)/2,k=a>0?f.granted/a*r:0,E=a>0?f.denied/a*r:0,w=r-k,p=f.denied>0?Math.max(0,E-(f.granted>0?W:0)):0;return{key:f.day,x:g,w:m,granted:{y:w,h:k},denied:{y:w-(f.granted>0&&f.denied>0?W:0)-p,h:p},values:{granted:f.granted,denied:f.denied}}})}function Y(t,e,r,a,s=4){if(a<=0)return"";const n=Math.min(s,r/2,a);return`M${t},${e+a}V${e+n}Q${t},${e} ${t+n},${e}H${t+r-n}Q${t+r},${e} ${t+r},${e+n}V${e+a}Z`}function _t(t,e,r,a,s=!0){const n=t.filter(h=>h.users!==null&&Number.isFinite(Date.parse(h.at)));if(!n.length)return[];const c=Date.parse(n[0].at),m=Date.parse(n[n.length-1].at),f=Math.max(1,m-c);return n.map(h=>{const b=n.length===1?1:(Date.parse(h.at)-c)/f,g=s?e-b*e:b*e,k=a>0?r-h.users/a*r:r;return{x:Math.round(g*10)/10,y:Math.round(k*10)/10,at:h.at,v:h.users}})}function V(t){return t.map((e,r)=>`${r?"L":"M"}${e.x},${e.y}`).join("")}function St(t,e){let r=-1,a=1/0;return t.forEach((s,n)=>{const c=Math.abs(s.x-e);c<a&&(a=c,r=n)}),r}function F(t){const e=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t);return e?`${Number(e[3])}.${Number(e[2])}`:t}var zt=Object.defineProperty,Tt=Object.getOwnPropertyDescriptor,y=(t,e,r,a)=>{for(var s=a>1?void 0:a?Tt(e,r):e,n=t.length-1,c;n>=0;n--)(c=t[n])&&(s=(a?c(e,r,s):c(s))||s);return a&&s&&zt(e,r,s),s};const it=I`
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
`;class P extends G{constructor(){super(...arguments),this.w=640}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(e=>{const r=Math.round(e[0].contentRect.width);r>160&&Math.abs(r-this.w)>2&&(this.w=r)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}}y([u()],P.prototype,"w",2);let C=class extends P{constructor(){super(...arguments),this.days=[],this.height=200,this.hot=null,this.table=!1}render(){const t=this.days;if(!t.length)return o`<div class="empty" data-chart-empty>${i.empty}</div>`;const e=this.w,r=this.height,a=34,s=16,n=22,c=e-a,m=r-s-n,f=et(Math.max(...t.map(l=>l.granted+l.denied),1)),h=kt(t,c,m,f,!0),b=h.length>1?c/h.length:c,g=b<34?Math.ceil(34/b):1,k=t.reduce((l,_,B)=>_.granted+_.denied>t[l].granted+t[l].denied?B:l,0),E=this.hot===null?-1:h.findIndex(l=>l.key===this.hot),w=E>=0?h[E]:null,p=`${i.byDay}: ${t.map(l=>`${F(l.day)} ${i.granted} ${l.granted}, ${i.denied} ${l.denied}`).join("; ")}`;return o`
      <svg viewBox="0 0 ${e} ${r}" role="img" aria-label=${p} data-day-chart @pointerleave=${()=>this.hot=null}>
        ${st(f).map(l=>{const _=s+m-l/f*m;return T`<line class="grid" x1="0" x2=${c} y1=${_} y2=${_} opacity=${l===0?1:.6}></line>
            <text x=${e-4} y=${_+4} text-anchor="end">${at(l)}</text>`})}
        ${h.map((l,_)=>{const B=()=>this.hot=l.key,rt=()=>{this.hot===l.key&&(this.hot=null)},U=l.x+l.w/2,Z=l.values.granted+l.values.denied,nt=_%g===0||_===h.length-1?T`<text x=${U} y=${r-6} text-anchor="middle">${F(l.key)}</text>`:d,ot=_===k&&Z>0?T`<text class="v" x=${U} y=${s+Math.min(l.granted.y,l.denied.h?l.denied.y:l.granted.y)-5} text-anchor="middle">${Z}</text>`:d;return T`<g class=${this.hot===l.key?"band hot":"band"} tabindex="0" data-day=${l.key} aria-label=${`${F(l.key)}: ${i.granted} ${l.values.granted}, ${i.denied} ${l.values.denied}`}
              @pointerenter=${B} @focus=${B} @blur=${rt}>
            <rect class="hit" x=${l.x-(b-l.w)/2} y=${s-6} width=${b} height=${m+6}></rect>
            <g transform=${`translate(0 ${s})`}>
              ${l.granted.h>0?T`<path class="g" d=${Y(l.x,l.granted.y,l.w,l.granted.h,l.denied.h>0?0:4)}></path>`:d}
              ${l.denied.h>0?T`<path class="d" d=${Y(l.x,l.denied.y,l.w,l.denied.h)}></path>`:d}
            </g>
            ${ot}${nt}
          </g>`})}
      </svg>
      ${w?o`<div class="tip" role="tooltip" data-chart-tip style=${`left:${(w.x+w.w/2)/e*100}%; inset-block-start:${(s+Math.min(w.granted.y,w.denied.h?w.denied.y:w.granted.y))/r*100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${w.values.granted}</b> ${i.granted}</span>
            <span><span class="k" style="background:var(--c-s2)"></span><b>${w.values.denied}</b> ${i.denied}</span>
            <small>${F(w.key)}</small>
          </div>`:d}
      <div class="legend" data-chart-legend><span><i class="lg"></i>${i.granted}</span><span><i class="ld"></i>${i.denied}</span></div>
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${()=>this.table=!this.table}>${this.table?i.hideTable:i.showTable}</button>
      <div class=${this.table?"tw":"sr"}>
        <table data-chart-table>
          <thead><tr><th scope="col">יום</th><th scope="col">${i.granted}</th><th scope="col">${i.denied}</th></tr></thead>
          <tbody>${t.map(l=>o`<tr><td>${F(l.day)}</td><td class="n">${l.granted}</td><td class="n">${l.denied}</td></tr>`)}</tbody>
        </table>
      </div>
    `}};C.styles=[it,I`
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
    `];y([M({attribute:!1})],C.prototype,"days",2);y([M({type:Number})],C.prototype,"height",2);y([u()],C.prototype,"hot",2);y([u()],C.prototype,"table",2);C=y([N("wk-ops-day-chart")],C);let S=class extends P{constructor(){super(...arguments),this.points=[],this.limit=null,this.label="",this.height=180,this.fmt=t=>t,this.hot=-1,this.table=!1}move(t,e){const r=this.renderRoot.querySelector("svg");if(!r)return;const a=r.getBoundingClientRect();this.hot=St(e,(t.clientX-a.left)/a.width*this.w)}key(t,e){if(t.key!=="ArrowLeft"&&t.key!=="ArrowRight")return;t.preventDefault();const r=t.key==="ArrowLeft"?1:-1;this.hot=Math.max(0,Math.min(e-1,(this.hot<0?e-1:this.hot)+r))}render(){const t=this.points.filter(p=>p.users!==null);if(t.length<2)return o`<div class="empty" data-trend-empty>${i.trendNone}</div>`;const e=this.w,r=this.height,a=40,s=14,n=8,c=e-a,m=r-s-n,f=et(Math.max(...t.map(p=>p.users),this.limit??0,1)*1.05),h=_t(t,c-8,m,f,!0).map(p=>({...p,x:p.x+4})),b=h[h.length-1],g=this.hot>=0&&this.hot<h.length?h[this.hot]:null,k=this.limit!==null?s+m-this.limit/f*m:null,E=`${V(h.map(p=>({x:p.x,y:p.y+s})))}L${b.x},${s+m}L${h[0].x},${s+m}Z`,w=`${this.label}: ${t.map(p=>`${this.fmt(p.at)} ${p.users}`).join("; ")}`;return o`
      <svg viewBox="0 0 ${e} ${r}" role="img" aria-label=${w} data-trend-chart>
        ${st(f).map(p=>{const l=s+m-p/f*m;return T`<line class="grid" x1="0" x2=${c} y1=${l} y2=${l} opacity=${p===0?1:.6}></line><text x=${e-4} y=${l+4} text-anchor="end">${at(p)}</text>`})}
        ${k!==null?T`<line class="limit" x1="0" x2=${c} y1=${k} y2=${k} data-trend-limit></line><text x=${c-4} y=${k-5} text-anchor="end" data-trend-limit-label>מגבלה ${this.limit}</text>`:d}
        <path class="area" d=${E}></path>
        <path class="line" d=${V(h.map(p=>({x:p.x,y:p.y+s})))}></path>
        <circle class="dot" cx=${b.x} cy=${b.y+s} r="4"></circle>
        <text class="v" x=${b.x} y=${b.y+s-9} text-anchor="middle">${b.v}</text>
        ${g?T`<line class="cross" x1=${g.x} x2=${g.x} y1=${s} y2=${s+m}></line><circle class="dot" cx=${g.x} cy=${g.y+s} r="4"></circle>`:d}
        <rect class="plot" x="0" y=${s} width=${c} height=${m} fill="transparent" tabindex="0" aria-label=${this.label}
          @pointermove=${p=>this.move(p,h)} @pointerleave=${()=>this.hot=-1} @focus=${()=>this.hot=h.length-1} @blur=${()=>this.hot=-1}
          @keydown=${p=>this.key(p,h.length)}></rect>
      </svg>
      ${g?o`<div class="tip" role="tooltip" data-chart-tip style=${`left:${g.x/e*100}%; inset-block-start:${(g.y+s)/r*100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${g.v}</b> ${this.label}</span><small>${this.fmt(g.at)}</small>
          </div>`:d}
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${()=>this.table=!this.table}>${this.table?i.hideTable:i.showTable}</button>
      <div class=${this.table?"tw":"sr"}>
        <table data-chart-table>
          <thead><tr><th scope="col">${i.sampledAt}</th><th scope="col">${this.label}</th></tr></thead>
          <tbody>${t.map(p=>o`<tr><td>${this.fmt(p.at)}</td><td class="n">${p.users}</td></tr>`)}</tbody>
        </table>
      </div>
    `}};S.styles=[it,I`
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
    `];y([M({attribute:!1})],S.prototype,"points",2);y([M({type:Number})],S.prototype,"limit",2);y([M()],S.prototype,"label",2);y([M({type:Number})],S.prototype,"height",2);y([M({attribute:!1})],S.prototype,"fmt",2);y([u()],S.prototype,"hot",2);y([u()],S.prototype,"table",2);S=y([N("wk-ops-trend-chart")],S);const R=t=>{const e=new URLSearchParams;for(const[a,s]of Object.entries(t))s!=null&&s!==""&&e.set(a,String(s));const r=e.toString();return r?`?${r}`:""},z="access-control/operations",Mt=()=>H(`${z}/overview`),Ot=(t={})=>H(`${z}/operations${R({...t})}`),Ct=(t={})=>H(`${z}/investigations${R({...t})}`),Et=()=>H(`${z}/jobs`),Dt=t=>H(`${z}/capacity${R({days:t})}`),Ht=(t={})=>H(`${z}/events-report${R({...t})}`);function jt(t,e,r=Date.now()){const a=new Date(r+3e4).toISOString().replace(/\.\d{3}Z$/,"Z");return lt(`${z}/jobs/${encodeURIComponent(t)}/cancel`,{client_request_id:crypto.randomUUID().replace(/-/g,""),expires_at:a,confirmed:!0,revision:e})}async function q(t,e){const{blob:r,headers:a}=await dt(t),s=a.get("X-Export-Rows"),n=/filename="?([^";]+)"?/.exec(a.get("Content-Disposition")??"")?.[1];return{blob:r,rows:s===null?null:Number(s),filename:n||e}}const Ft=()=>q(`${z}/exports/fleet-inventory.csv`,"intercom-fleet-inventory.csv"),At=(t={})=>q(`${z}/exports/audit.csv${R({...t})}`,"intercom-change-log.csv"),Rt=t=>q(`${z}/jobs/${encodeURIComponent(t)}/errors.csv`,"intercom-job-errors.csv");function Bt(t){const e=URL.createObjectURL(t.blob),r=document.createElement("a");r.href=e,r.download=t.filename,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}var Lt=Object.defineProperty,It=Object.getOwnPropertyDescriptor,$=(t,e,r,a)=>{for(var s=a>1?void 0:a?It(e,r):e,n=t.length-1,c;n>=0;n--)(c=t[n])&&(s=(a?c(e,r,s):c(s))||s);return a&&s&&Lt(e,r,s),s};const X=864e5,Q=[1,7,30];function A(t){return t instanceof D?{s:"error",code:t.body.code,message:t.body.user_message||t.body.code,status:t.status}:{s:"error",code:"error",message:String(t),status:0}}let v=class extends G{constructor(){super(...arguments),this.view="",this.overview=null,this.loadState="loading",this.loadError="",this.ops={s:"idle"},this.opsFilter={kind:"all",state:"all",station_id:"",query:"",offset:0},this.jobs={s:"idle"},this.openJob="",this.confirmJob=null,this.cancelBusy=!1,this.cancelError="",this.flash="",this.timeline={s:"idle"},this.tlFilter={source:"all",station_id:"",query:"",period:7,offset:0},this.capacity={s:"idle"},this.trendStation="",this.trendDays=30,this.report={s:"idle"},this.evFilter={station_id:"",period:7},this.exportBusy="",this.exportMsg=null}connectedCallback(){super.connectedCallback(),this.load()}get tab(){return vt(this.view)}get zone(){const t=this.overview?.summary;return t&&t.state==="ready"?t.data.zone:pt}get stations(){const t=this.overview?.summary;return t&&t.state==="ready"?t.data.stations:[]}name(t){return this.stations.find(e=>e.id===t)?.name??t}time(t){return ht(t,"he-IL",this.zone)}async load(){this.loadState="loading";try{this.overview=await Mt(),this.loadState="ready",this.loadTab(this.tab)}catch(t){this.loadState=t instanceof D&&t.status===403?"forbidden":"error",this.loadError=t instanceof D?t.body.user_message:String(t)}}updated(t){t.has("view")&&t.get("view")!==void 0&&this.loadState==="ready"&&this.loadTab(this.tab);const e=this.renderRoot.querySelector("nav.tabs"),r=e?.querySelector('a[aria-current="page"]');if(e&&r){const a=e.getBoundingClientRect(),s=r.getBoundingClientRect();s.left<a.left?e.scrollLeft-=a.left-s.left+8:s.right>a.right&&(e.scrollLeft+=s.right-a.right+8)}}loadTab(t){t==="operations"?(this.ops.s==="idle"&&this.loadOps(),this.jobs.s==="idle"&&this.loadJobs()):t==="investigations"&&this.timeline.s==="idle"?this.loadTimeline():t==="capacity"&&this.capacity.s==="idle"?this.loadCapacity():t==="events"&&this.report.s==="idle"&&this.loadReport()}offered(t){return this.overview?.views?.[t]!==!1}async loadOps(){this.ops={s:"loading"};const t=this.opsFilter;try{const e=await Ot({kind:t.kind,state:t.state,station_id:t.station_id||void 0,query:t.query||void 0,offset:t.offset,limit:25});this.ops={s:"ready",v:e.data}}catch(e){this.ops=A(e)}}async loadJobs(){this.jobs={s:"loading"};try{this.jobs={s:"ready",v:await Et()}}catch(t){this.jobs=A(t)}}async loadTimeline(){this.timeline={s:"loading"};const t=this.tlFilter,e=t.period?new Date(Date.now()-t.period*X).toISOString().replace(/\.\d{3}Z$/,"Z"):void 0;try{const r=await Ct({source:t.source,station_id:t.station_id||void 0,query:t.query||void 0,start:e,offset:t.offset,limit:25});this.timeline={s:"ready",v:r.data}}catch(r){this.timeline=A(r)}}async loadCapacity(){this.capacity={s:"loading"};try{const t=await Dt(this.trendDays);if(this.capacity={s:"ready",v:t},!this.trendStation||!t.data.records.some(e=>e.station_id===this.trendStation)){const e=[...t.data.records].sort((r,a)=>(a.users.used_percent??-1)-(r.users.used_percent??-1))[0];this.trendStation=e?.station_id??""}}catch(t){this.capacity=A(t)}}async loadReport(){this.report={s:"loading"};const t=this.evFilter,e=new Date(Date.now()-t.period*X).toISOString().replace(/\.\d{3}Z$/,"Z");try{this.report={s:"ready",v:await Ht({station_id:t.station_id||void 0,start:e})}}catch(r){this.report=A(r)}}pill(t,e,r=""){return o`<span class="pill" data-tone=${t} data-pill=${r}>${e}</span>`}partState(t,e,r){return t.s==="idle"||t.s==="loading"?o`<sw-state-panel state="loading" compact heading=${i.loading} data-part-state="loading"></sw-state-panel>`:t.s==="error"?t.status===501||!this.offered(e)?o`<sw-state-panel icon="wrench" state="empty" compact heading=${i.unavailable} data-part-state="unavailable"></sw-state-panel>`:o`<sw-state-panel state="error" compact heading=${i.errorTitle} hint=${t.message} actionLabel=${i.retry} @action=${r} data-part-state="error"></sw-state-panel>`:null}stationSelect(t,e,r){return o`<label class="f">${i.filterStation}
      <select data-filter=${r} .value=${t} @change=${a=>e(a.target.value)}>
        <option value="">${i.all}</option>
        ${this.stations.map(a=>o`<option value=${a.id} ?selected=${a.id===t}>${a.name}</option>`)}
      </select></label>`}meter(t,e,r){const a=e.used_percent,s=bt(a);return o`<div class="meter" data-tone=${s} data-meter=${r} role="meter" aria-valuemin="0" aria-valuemax=${e.limit??0} aria-valuenow=${e.count??0} aria-label=${t}>
      <div class="lbl"><span>${t}</span><b><bdi dir="ltr">${i.usersOf(e.count,e.limit)}</bdi>${a!==null?o` · <bdi dir="ltr">${Math.round(a)}%</bdi>`:d}</b></div>
      <div class="bar"><i style=${`inline-size:${Math.max(0,Math.min(100,a??0))}%`}></i></div>
    </div>`}renderOverview(){const t=this.overview.summary;if(t.state==="error")return o`<sw-state-panel state="error" heading=${i.errorTitle} hint=${t.message} actionLabel=${i.retry} @action=${()=>void this.load()} data-part-state="error"></sw-state-panel>`;const e=t.data.kpis,r=(a,s,n,c)=>o`<sw-kpi data-kpi=${c} label=${i.kpi[a]} value=${String(e[a])} icon=${s} tone=${n}></sw-kpi>`;return o`
      <div class="kpis" data-kpis>
        ${r("stations","door","neutral","stations")}
        ${r("online","wifi",e.online===e.stations?"live":"neutral","online")}
        ${r("offline","offline",e.offline?"error":"neutral","offline")}
        ${r("pending_users","clock",e.pending_users?"partial":"neutral","pending")}
        ${r("sync_problems","warning",e.sync_problems?"error":"neutral","sync")}
        ${r("near_capacity","storage",e.near_capacity?"partial":"neutral","capacity")}
      </div>
      <section class="part" data-stations>
        <header><div><h2>${i.stationsTitle}</h2><p class="hint">${i.fetchedAt} ${this.time(t.fetched_at)}</p></div>
          <sw-button size="sm" icon="refresh" @click=${()=>void this.load()} data-refresh>${i.refresh}</sw-button></header>
        ${t.data.stations.length?o`<div class="list">${t.data.stations.map(a=>o`<article class="item" data-station=${a.id}>
                <div class="main"><b>${a.name}</b>${this.pill(a.online?"ok":"err",a.online?i.online:i.offline,"online")}${this.pill(j(a.sync_state),x(O,a.sync_state),"sync")}</div>
                <div class="end">${a.max_users?this.meter(i.table.users,{count:a.users,limit:a.max_users,used_percent:a.users!==null?Math.round(1e3*a.users/a.max_users)/10:null,remaining:null,growth_per_day:null,days_to_limit:null,alert:"observed"},"users"):d}</div>
                <div class="meta">
                  ${a.pending_users?o`<span>${i.table.pending}: ${a.pending_users}</span>`:d}
                  ${a.cards!==null?o`<span>${i.table.cards}: <bdi dir="ltr">${a.cards}${a.max_cards?` / ${a.max_cards}`:""}</bdi></span>`:d}
                  ${a.last_error?o`<span>${i.table.error}: <code>${a.last_error}</code></span>`:d}
                </div>
              </article>`)}</div>`:o`<sw-state-panel icon="door" state="empty" compact heading=${i.empty}></sw-state-panel>`}
      </section>`}renderOperations(){const t=this.opsFilter,e=s=>{this.opsFilter={...t,offset:0,...s},this.loadOps()},r=this.partState(this.ops,"operations",()=>void this.loadOps()),a=this.ops.s==="ready"?this.ops.v:null;return o`
      ${this.flash?o`<div class="msg ok" role="status" data-flash>${this.flash}</div>`:d}
      <section class="part" data-ops>
        <header><div><h2>${i.opsTitle}</h2><p class="hint">${i.opsHint}</p></div></header>
        <div class="filters">
          <label class="f">${i.filterKind}<select data-filter="kind" .value=${t.kind} @change=${s=>e({kind:s.target.value})}>
            ${["all","sync","bulk","csv"].map(s=>o`<option value=${s} ?selected=${s===t.kind}>${s==="all"?i.all:L[s]}</option>`)}</select></label>
          <label class="f">${i.filterState}<select data-filter="state" .value=${t.state} @change=${s=>e({state:s.target.value})}>
            ${["all","pending","failed","verified","settled","saved"].map(s=>o`<option value=${s} ?selected=${s===t.state}>${s==="all"?i.all:O[s]}</option>`)}</select></label>
          ${this.stationSelect(t.station_id,s=>e({station_id:s}),"station")}
          <sw-button size="sm" icon="refresh" @click=${()=>void this.loadOps()} data-ops-refresh>${i.refresh}</sw-button>
        </div>
        ${r??o`${a.stale?o`<div class="msg warn" role="status">${i.stale}</div>`:d}
          <div class="filters" data-ops-summary>${["pending","failed","verified","settled","saved"].map(s=>this.pill(j(s),`${O[s]}: ${a.summary[s]}`,s))}</div>
          ${a.records.length?o`<div class="list">${a.records.map(s=>o`<article class="item" data-op=${s.id}>
                  <div class="main"><b>${x(K,s.action)}</b>${this.pill("neutral",x(L,s.kind),"kind")}${this.pill(j(s.state),x(O,s.state),"state")}</div>
                  <div class="end"><span class="muted">${i.progress(wt(s),s.progress.total)}</span></div>
                  <div class="meta">
                    <span>${i.people(s.user_ids.length)}</span>
                    <span>${s.station_ids.map(n=>this.name(n)).join(", ")}</span>
                    <span>${this.time(s.updated_at)}</span>
                    ${s.errors.map(n=>o`<code>${n}</code>`)}
                  </div>
                </article>`)}</div>
              ${this.pager(a,s=>{this.opsFilter={...t,offset:s},this.loadOps()})}`:o`<sw-state-panel icon="activity" state="empty" compact heading=${i.empty} data-part-state="empty"></sw-state-panel>`}`}
      </section>
      ${this.renderJobs()}
      ${this.renderCancelDialog()}`}pager(t,e){return t.next_offset===null&&t.previous_offset===null?d:o`<div class="pager" data-pager><bdi dir="ltr">${t.offset+1}–${Math.min(t.total,t.offset+(t.limit??25))} / ${t.total}</bdi>
      <sw-button size="sm" ?disabled=${t.previous_offset===null} @click=${()=>t.previous_offset!==null&&e(t.previous_offset)}>${i.prev}</sw-button>
      <sw-button size="sm" ?disabled=${t.next_offset===null} @click=${()=>t.next_offset!==null&&e(t.next_offset)}>${i.more}</sw-button></div>`}renderJobs(){const t=this.partState(this.jobs,"jobs",()=>void this.loadJobs()),e=this.jobs.s==="ready"?this.jobs.v:null,r=!!e?.can_cancel;return o`<section class="part" data-jobs>
      <header><div><h2>${i.jobsTitle}</h2><p class="hint">${i.jobsHint}</p></div></header>
      ${t??(e.data.records.length?o`<div class="list">${e.data.records.map(a=>{const s=this.openJob===a.id;return o`<article class="item" data-job=${a.id}>
              <div class="main"><b>${x(L,a.kind)}</b>${this.pill(j(a.state),x(O,a.state),"state")}
                <span class="muted">${i.progress(a.saved,a.total)}</span>${a.failed?this.pill("err",i.rowsFailed(a.failed),"failed"):d}</div>
              <div class="end">
                ${a.errors.length?o`<sw-button size="sm" variant="ghost" @click=${()=>this.openJob=s?"":a.id} aria-expanded=${s} data-job-errors-toggle>${i.rowsFailed(a.errors.length)}</sw-button>`:d}
                ${r&&a.errors.length?o`<sw-button size="sm" icon="download" @click=${()=>void this.download("job",()=>Rt(a.id))} data-job-errors-csv>${i.errorsCsv}</sw-button>`:d}
                ${yt(a,r)?o`<sw-button size="sm" variant="danger" @click=${()=>this.askCancel(a)} data-job-cancel>${i.cancel}</sw-button>`:d}
              </div>
              <div class="meta"><span>${this.time(a.created_at)}</span>${a.pending?o`<span>${O.pending}: ${a.pending}</span>`:d}</div>
              ${s?o`<ul class="errs" data-job-error-rows>${a.errors.map(n=>o`<li>${i.row} ${n.row??"—"}: <code>${n.code}</code></li>`)}</ul>`:d}
            </article>`})}</div>`:o`<sw-state-panel icon="list" state="empty" compact heading=${i.jobsEmpty} data-part-state="empty"></sw-state-panel>`)}
      ${this.exportMsg&&this.exportMsg.kind==="job"?o`<div class="msg ${this.exportMsg.ok?"ok":"err"}" role="status" data-export-msg>${this.exportMsg.text}</div>`:d}
    </section>`}askCancel(t){this.cancelError="",this.confirmJob=t}async doCancel(){const t=this.confirmJob;if(!(!t||t.revision===null||this.cancelBusy)){this.cancelBusy=!0,this.cancelError="";try{await jt(t.id,t.revision),this.confirmJob=null,this.flash=i.cancelled,await this.loadJobs()}catch(e){this.cancelError=e instanceof D?e.body.user_message||e.body.code:String(e),e instanceof D&&e.body.details?.outcome!=="not_sent"&&this.loadJobs()}finally{this.cancelBusy=!1}}}renderCancelDialog(){const t=this.confirmJob;return o`<sw-dialog ?open=${!!t} heading=${i.cancelTitle} ?locked=${this.cancelBusy} @close=${()=>this.confirmJob=null} data-cancel-dialog>
      <p>${i.cancelBody}</p>
      ${t?o`<p class="muted">${x(L,t.kind)} · ${i.progress(t.saved,t.total)} · ${this.time(t.created_at)}</p>`:d}
      ${this.cancelError?o`<div class="msg err" role="alert" data-cancel-error>${this.cancelError}</div>`:d}
      <sw-button slot="footer" @click=${()=>this.confirmJob=null} ?disabled=${this.cancelBusy} data-cancel-keep>${i.cancelKeep}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>void this.doCancel()} ?disabled=${this.cancelBusy||!!this.cancelError} data-cancel-confirm>${i.cancelConfirm}</sw-button>
    </sw-dialog>`}renderInvestigations(){const t=this.tlFilter,e=this.overview.can,r=n=>{this.tlFilter={...t,offset:0,...n},this.loadTimeline()},a=this.partState(this.timeline,"investigations",()=>void this.loadTimeline()),s=this.timeline.s==="ready"?this.timeline.v:null;return o`<section class="part" data-timeline>
      <header><div><h2>${i.invTitle}</h2><p class="hint">${i.invHint}</p></div></header>
      <div class="filters">
        <label class="f">${i.invSource}<select data-filter="source" .value=${t.source} @change=${n=>r({source:n.target.value})}>
          ${["all","access","change","sync"].map(n=>o`<option value=${n} ?selected=${n===t.source}>${n==="all"?i.all:J[n]}</option>`)}</select></label>
        ${this.stationSelect(t.station_id,n=>r({station_id:n}),"station")}
        <label class="f">${i.invFrom}<select data-filter="period" .value=${String(t.period)} @change=${n=>r({period:Number(n.target.value)})}>
          ${Q.map(n=>o`<option value=${n} ?selected=${n===t.period}>${n===1?"24 שעות":i.days(n)}</option>`)}</select></label>
        ${e.names?o`<label class="f">${i.filterSearch}<input type="search" data-filter="query" .value=${t.query} maxlength="128"
              @change=${n=>r({query:n.target.value.trim()})} /></label>`:d}
      </div>
      ${a??o`${s.fields_hidden.length?o`<div class="msg warn" role="status" data-hidden-fields>${i.hiddenFields}</div>`:d}
        ${s.access_storage_failed?o`<div class="msg err" role="status">${i.storageFailed}</div>`:d}
        <div class="filters">${["access","change","sync"].map(n=>this.pill("neutral",`${J[n]}: ${s.summary[n]}`,n))}</div>
        ${s.records.length?o`<div class="list">${s.records.map(n=>o`<article class="item" data-tl=${n.id} data-source=${n.source}>
                <div class="main"><b>${x(K,n.action)}</b>${this.pill("neutral",x(J,n.source),"source")}${this.pill(j(n.status),x(O,n.status),"status")}</div>
                <div class="end"><span class="muted">${this.time(n.time)}</span></div>
                <div class="meta">
                  <span>${n.station_ids.map(c=>this.name(c)).join(", ")}${n.door?` · דלת ${n.door}`:""}</span>
                  ${n.person_name?o`<span data-person>${n.person_name}${n.employee_no?` (${n.employee_no})`:""}</span>`:d}
                  ${n.actor?o`<span data-actor>${i.operator}: ${s.actors[n.actor]??n.actor}</span>`:d}
                  ${n.fields.length?o`<span>${n.fields.join(", ")}</span>`:d}
                  <code>${n.evidence}</code>
                </div>
              </article>`)}</div>
            ${this.pager(s,n=>{this.tlFilter={...t,offset:n},this.loadTimeline()})}`:o`<sw-state-panel icon="history" state="empty" compact heading=${i.empty} data-part-state="empty"></sw-state-panel>`}`}
    </section>`}renderCapacity(){const t=this.partState(this.capacity,"capacity",()=>void this.loadCapacity()),e=this.capacity.s==="ready"?this.capacity.v:null,r=e?.data.records??[],a=r.find(n=>n.station_id===this.trendStation)??null,s=e?.trend.series[this.trendStation]??[];return o`<section class="part" data-capacity>
        <header><div><h2>${i.capTitle}</h2><p class="hint">${i.capHint}</p></div>
          <sw-button size="sm" icon="refresh" @click=${()=>void this.loadCapacity()} data-cap-refresh>${i.refresh}</sw-button></header>
        ${t??(r.length?o`<div class="cap-grid">${r.map(n=>o`<article class="cap" data-cap=${n.station_id}>
                <header><b>${n.name}</b>${this.pill(gt(n.users.alert),mt[n.users.alert],"alert")}</header>
                ${this.meter(i.table.users,n.users,"users")}${this.meter(i.table.cards,n.cards,"cards")}
                <div class="muted">
                  ${n.users.growth_per_day!==null?o`<span><bdi dir="ltr">${n.users.growth_per_day>0?"+":""}${n.users.growth_per_day}</bdi> ביום</span>`:d}
                  ${n.users.days_to_limit!==null?o` · <span data-days-to-limit>${i.daysToLimit(n.users.days_to_limit)}</span>`:d}
                  <div>${i.sampledAt}: ${this.time(n.sampled_at)}</div>
                </div>
              </article>`)}</div>`:o`<sw-state-panel icon="users" state="empty" compact heading=${i.empty} data-part-state="empty"></sw-state-panel>`)}
      </section>
      ${e&&r.length?o`<section class="part" data-trend>
            <header><div><h2>${i.trendTitle}${a?` · ${a.name}`:""}</h2><p class="hint">${i.trendHint}</p></div></header>
            <div class="filters">
              <label class="f">${i.filterStation}<select data-filter="trend-station" .value=${this.trendStation} @change=${n=>this.trendStation=n.target.value}>
                ${r.map(n=>o`<option value=${n.station_id} ?selected=${n.station_id===this.trendStation}>${n.name}</option>`)}</select></label>
              <label class="f">טווח<select data-filter="trend-days" .value=${String(this.trendDays)} @change=${n=>{this.trendDays=Number(n.target.value),this.loadCapacity()}}>${[7,30,90,365].map(n=>o`<option value=${n} ?selected=${n===this.trendDays}>${i.days(n)}</option>`)}</select></label>
            </div>
            <wk-ops-trend-chart .points=${s} .limit=${a?.users.limit??null} label=${i.table.users} .fmt=${n=>this.time(n)}></wk-ops-trend-chart>
          </section>`:d}`}renderEvents(){const t=this.evFilter,e=s=>{this.evFilter={...t,...s},this.loadReport()},r=this.partState(this.report,"events_report",()=>void this.loadReport()),a=this.report.s==="ready"?this.report.v.data:null;return o`<section class="part" data-events>
      <header><div><h2>${i.evTitle}</h2><p class="hint">${i.evHint}</p></div></header>
      <div class="filters">
        ${this.stationSelect(t.station_id,s=>e({station_id:s}),"station")}
        <label class="f">${i.invFrom}<select data-filter="period" .value=${String(t.period)} @change=${s=>e({period:Number(s.target.value)})}>
          ${Q.map(s=>o`<option value=${s} ?selected=${s===t.period}>${s===1?"24 שעות":i.days(s)}</option>`)}</select></label>
      </div>
      ${r??o`
        ${a.storage_failed?o`<div class="msg err" role="status">${i.storageFailed}</div>`:d}
        <div class="kpis" data-ev-kpis>
          <sw-kpi label=${i.total} value=${String(a.totals.records)} icon="activity" tone="neutral" data-kpi="records"></sw-kpi>
          <sw-kpi label=${i.granted} value=${String(a.totals.granted)} icon="check" tone="neutral" data-kpi="granted"></sw-kpi>
          <sw-kpi label=${i.denied} value=${String(a.totals.denied)} icon="lock" tone=${a.totals.denied?"partial":"neutral"} data-kpi="denied"></sw-kpi>
          <sw-kpi label=${i.other} value=${String(a.totals.other)} icon="info" tone="neutral" data-kpi="other"></sw-kpi>
        </div>
        <h3>${i.byDay}</h3>
        <wk-ops-day-chart .days=${a.by_day.map(s=>({day:s.day,granted:s.granted,denied:s.denied}))}></wk-ops-day-chart>
        <div class="two">
          <div>
            <h3>${i.byStation}</h3>
            <table class="t" data-ev-stations>
              <thead><tr><th scope="col">${i.table.station}</th><th scope="col">${i.granted}</th><th scope="col">${i.denied}</th><th scope="col">${i.other}</th></tr></thead>
              <tbody>${a.by_station.map(s=>o`<tr><td>${this.name(s.station_id)}</td><td class="n">${s.granted}</td><td class="n">${s.denied}</td><td class="n">${s.other}</td></tr>`)}</tbody>
            </table>
          </div>
          <div>
            <h3>${i.anomalies}</h3>
            <table class="t" data-ev-anomalies>
              <tbody>${Object.entries(a.anomalies).map(([s,n])=>o`<tr><td>${x($t,s)}</td><td class="n">${n}</td></tr>`)}</tbody>
            </table>
            <h3>${i.methods}</h3>
            <table class="t" data-ev-methods>
              <tbody>${Object.entries(a.methods).map(([s,n])=>o`<tr><td>${x(ft,s)}</td><td class="n">${n}</td></tr>`)}</tbody>
            </table>
          </div>
        </div>`}
    </section>`}async download(t,e){if(!this.exportBusy){this.exportBusy=t,this.exportMsg=null;try{const r=await e();Bt(r),this.exportMsg={kind:t,ok:!0,text:i.downloaded(r.rows)}}catch(r){this.exportMsg={kind:t,ok:!1,text:r instanceof D?r.body.user_message||r.body.code:String(r)}}finally{this.exportBusy=""}}}renderExports(){const t=this.overview.can,e=r=>this.exportMsg&&this.exportMsg.kind===r?o`<div class="msg ${this.exportMsg.ok?"ok":"err"}" role="status" data-export-msg=${r}>${this.exportMsg.text}</div>`:d;return o`<section class="part" data-exports>
      <header><div><h2>${i.expTitle}</h2><p class="hint">${i.expHint}</p></div></header>
      ${t.export?o`<div class="two">
            <div class="exp" data-export="inventory"><b>${i.expInventory}</b><span class="muted">${i.expInventoryHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy||!this.offered("inventory")} @click=${()=>void this.download("inventory",Ft)} data-export-btn="inventory">${i.download}</sw-button>${e("inventory")}</div>
            <div class="exp" data-export="audit"><b>${i.expAudit}</b><span class="muted">${i.expAuditHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy||!this.offered("audit_export")} @click=${()=>void this.download("audit",()=>At())} data-export-btn="audit">${i.download}</sw-button>${e("audit")}</div>
          </div>`:o`<sw-state-panel state="forbidden" compact heading=${i.adminOnly} data-part-state="forbidden"></sw-state-panel>`}
    </section>`}body(t){return t==="operations"?this.renderOperations():t==="investigations"?this.renderInvestigations():t==="capacity"?this.renderCapacity():t==="events"?this.renderEvents():t==="exports"?this.renderExports():this.renderOverview()}render(){const t=(r,a)=>o`<sw-page crumbs="הגדרות" heading=${i.title} subheading=${i.sub} data-intercom-ops data-state=${a}>${r}</sw-page>`;if(this.loadState==="loading")return t(o`<sw-state-panel state="loading" heading=${i.loading}></sw-state-panel>`,"loading");if(this.loadState==="forbidden")return t(o`<sw-state-panel state="forbidden" heading=${i.forbiddenTitle} hint=${i.forbiddenHint}></sw-state-panel>`,"forbidden");if(this.loadState==="error")return t(o`<sw-state-panel state="error" heading=${i.errorTitle} hint=${this.loadError} actionLabel=${i.retry} @action=${()=>void this.load()}></sw-state-panel>`,"error");const e=this.tab;return t(o`<nav class="tabs" aria-label=${i.title}>
          ${tt.map(r=>o`<a href="${ut}/${r}" aria-current=${r===e?"page":"false"} data-ops-tab=${r}>${i.tabs[r]}</a>`)}
        </nav>
        <div data-ops-view=${e}>${this.body(e)}</div>`,"ready")}};v.styles=[ct,I`
      :host {
        display: block;
      }
      nav.tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
        margin-block-end: 16px;
        border-block-end: 1px solid var(--sw-border);
      }
      nav.tabs::-webkit-scrollbar {
        display: none;
      }
      nav.tabs a {
        flex: none;
        padding: 10px 14px;
        color: var(--sw-text-2);
        text-decoration: none;
        font-weight: var(--sw-fw-medium);
        border-block-end: 2px solid transparent;
        margin-block-end: -1px;
        white-space: nowrap;
      }
      nav.tabs a[aria-current='page'] {
        color: var(--sw-accent-text);
        border-block-end-color: var(--sw-accent);
      }
      nav.tabs a:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: -2px;
      }
      @media (hover: hover) and (pointer: fine) {
        nav.tabs a:hover {
          color: var(--sw-text);
        }
      }
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
      label.f {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
        min-inline-size: 0;
      }
      label.f select,
      label.f input {
        font: inherit;
        font-size: var(--sw-fs-md);
        min-block-size: 40px;
        padding: 0 10px;
        border: 1px solid var(--sw-border-strong, var(--sw-border));
        border-radius: var(--sw-r-md);
        background: var(--sw-surface);
        color: var(--sw-text);
        min-inline-size: 0;
        max-inline-size: 100%;
      }
      label.f select:focus-visible,
      label.f input:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: 1px;
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
    `];$([M()],v.prototype,"view",2);$([u()],v.prototype,"overview",2);$([u()],v.prototype,"loadState",2);$([u()],v.prototype,"loadError",2);$([u()],v.prototype,"ops",2);$([u()],v.prototype,"opsFilter",2);$([u()],v.prototype,"jobs",2);$([u()],v.prototype,"openJob",2);$([u()],v.prototype,"confirmJob",2);$([u()],v.prototype,"cancelBusy",2);$([u()],v.prototype,"cancelError",2);$([u()],v.prototype,"flash",2);$([u()],v.prototype,"timeline",2);$([u()],v.prototype,"tlFilter",2);$([u()],v.prototype,"capacity",2);$([u()],v.prototype,"trendStation",2);$([u()],v.prototype,"trendDays",2);$([u()],v.prototype,"report",2);$([u()],v.prototype,"evFilter",2);$([u()],v.prototype,"exportBusy",2);$([u()],v.prototype,"exportMsg",2);v=$([N("system-intercom-ops")],v);export{v as SystemIntercomOps};
//# sourceMappingURL=system-intercom-ops-BW7iDhtB.js.map
