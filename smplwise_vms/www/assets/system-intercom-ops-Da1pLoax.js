import{E as I,G as u,F as M,e as o,A as d,w as T,a as Q,H as N,g as j,b8 as lt,cG as dt,j as E,g9 as ct}from"./index-BKxQRAkH.js";import{U as pt,f as ht}from"./wiskey-format-DJ4vUeXA.js";import"./sw-logo-art-Va6y_cIM.js";const tt=["overview","operations","investigations","capacity","events","exports"],ut="#/system/intercom-operations";function vt(t){return tt.includes(t)?t:"overview"}const n={title:"תפעול האינטרקום",sub:"מה קורה במערכת האינטרקום: פעולות סנכרון, משימות, ציר זמן לחקירה, קיבולת העמדות ודוח האירועים",tabs:{overview:"סיכום",operations:"פעולות ומשימות",investigations:"חקירות",capacity:"קיבולת ומגמות",events:"דוח אירועים",exports:"ייצוא"},loading:"טוען את נתוני התפעול…",forbiddenTitle:"אין לכם הרשאה לתפעול האינטרקום",forbiddenHint:"נדרשת הרשאת צפייה בבקרת כניסה ברמת ההתקנה כולה.",errorTitle:"לא ניתן לטעון את תפעול האינטרקום",unavailable:"מערכת האינטרקום המותקנת אינה מציעה את התצוגה הזו.",retry:"נסו שוב",refresh:"רענון",fetchedAt:"עודכן",empty:"אין מה להציג",kpi:{stations:"עמדות",online:"מחוברות",offline:"לא מחוברות",pending_users:"ממתינים לסנכרון",sync_problems:"עמדות עם תקלת סנכרון",near_capacity:"קרובות למגבלה"},stationsTitle:"העמדות",table:{station:"עמדה",state:"מצב",sync:"סנכרון",pending:"ממתינים",users:"משתמשים",cards:"כרטיסים",use:"ניצולת",error:"שגיאה אחרונה"},online:"מחוברת",offline:"לא מחוברת",opsTitle:"פעולות",opsHint:"סנכרון של אדם לעמדה, עריכות מרוכזות וייבוא קבצים, עם ההתקדמות של כל אחת.",jobsTitle:"משימות מרוכזות",jobsHint:"משימות עריכה מרוכזת וייבוא שנוצרו דרך Arx. שורות שנכשלו מופיעות עם קוד השגיאה.",jobsEmpty:"אין משימות מרוכזות.",filterKind:"סוג",filterState:"מצב",filterStation:"עמדה",filterSearch:"חיפוש",all:"הכול",people:t=>t===1?"אדם אחד":`${t} אנשים`,stationsCount:t=>t===1?"עמדה אחת":`${t} עמדות`,progress:(t,e)=>`${t} מתוך ${e}`,cancel:"ביטול המשימה",cancelTitle:"לבטל את המשימה?",cancelBody:"שורות שעדיין לא נשמרו יבוטלו. שורות שכבר נשמרו ממשיכות להסתנכרן לעמדות. הפעולה נשלחת פעם אחת.",cancelConfirm:"כן, לבטל",cancelKeep:"השארת המשימה",cancelled:"המשימה בוטלה.",errorsCsv:"הורדת השורות שנכשלו",rowsFailed:t=>t===1?"שורה אחת נכשלה":`${t} שורות נכשלו`,row:"שורה",more:"הבא",prev:"הקודם",stale:"הנתונים השתנו מאז הטעינה - רעננו כדי לראות את המצב העדכני.",invTitle:"ציר זמן לחקירה",invHint:"כניסות, שינויים וסנכרון זה לצד זה, 30 הימים האחרונים. סמיכות בזמן אינה מוכיחה קשר בין אירועים.",invSource:"מקור",invFrom:"מתאריך",invTo:"עד תאריך",hiddenFields:"חלק מהפרטים מוסתרים לפי ההרשאות שלכם.",storageFailed:"שמירת האירועים במערכת האינטרקום נכשלה - ייתכן שחסרים אירועים.",operator:"מפעיל",capTitle:"קיבולת לפי עמדה",capHint:"משתמשים וכרטיסים מול המגבלה שהעמדה מדווחת. התחזית היא הערכה לפי הצמיחה שנמדדה.",trendTitle:"מגמה",trendHint:"מספר המשתמשים בעמדה לאורך זמן, מתוך הדגימות ש־Arx שמר. הקו האופקי הוא המגבלה שהעמדה מדווחת.",trendNone:"עדיין אין מספיק דגימות כדי לצייר מגמה לעמדה הזו. כל צפייה בדף שומרת דגימה חדשה כשיש.",days:t=>`${t} ימים`,usersOf:(t,e)=>t===null?"—":e===null?`${t}`:`${t} / ${e}`,daysToLimit:t=>`כ־${Math.round(t)} ימים עד המגבלה`,growth:t=>`${t>0?"+":""}${t} ביום`,sampledAt:"נדגם",evTitle:"דוח אירועים",evHint:"סיכום יומן הכניסות: לפי יום (באזור הזמן של העמדה), לפי עמדה, אמצעי זיהוי וחריגות. מספרים בלבד, ללא פרטי אנשים.",granted:"אושרו",denied:"נדחו",other:"אירועים אחרים",total:'סה"כ',byDay:"כניסות לפי יום",byStation:"לפי עמדה",methods:"אמצעי זיהוי",anomalies:"חריגות",showTable:"הצגה כטבלה",hideTable:"הסתרת הטבלה",expTitle:"ייצוא",expHint:"קבצי CSV שנוצרים ב־Arx. כל ייצוא נרשם ביומן הפעולות.",expInventory:"מלאי העמדות",expInventoryHint:"דגם, קושחה, סנכרון וקיבולת של כל עמדה, מהנתונים השמורים (בלי פנייה לעמדות).",expAudit:"יומן השינויים של מערכת האינטרקום",expAuditHint:"מה שונה במערכת האינטרקום ב־30 הימים האחרונים ועל ידי מי.",download:"הורדה",downloaded:t=>t===null?"הקובץ הורד.":`הקובץ הורד (${t} שורות).`,adminOnly:"הייצוא זמין למנהלי בקרת הכניסה בלבד."},O={pending:"ממתין",failed:"נכשל",verified:"אומת בעמדה",settled:"הסתיים",saved:"נשמר",unknown:"לא ידוע",paused:"מושהה",running:"פועל",completed:"הושלם",completed_with_errors:"הושלם עם שגיאות",cancelled:"בוטל",synced:"מסונכרן",syncing:"מסתנכרן",offline:"לא מחובר",conflict:"התנגשות",error:"שגיאה",delete_pending:"מחיקה ממתינה",granted:"אושר",denied:"נדחה"},L={sync:"סנכרון",bulk:"עריכה מרוכזת",csv:"ייבוא קובץ",unknown:"לא ידוע"},J={access:"כניסה",change:"שינוי",sync:"סנכרון",unknown:"לא ידוע"},K={"sync/user_station":"סנכרון אדם לעמדה","bulk/csv_import":"ייבוא קובץ","bulk/enable":"הפעלה מרוכזת","bulk/disable":"השבתה מרוכזת","bulk/assign":"שיוך מרוכז","bulk/unassign":"הסרת שיוך מרוכזת","bulk/delete":"מחיקה מרוכזת","bulk/renew":"חידוש מרוכז","users/create":"יצירת אדם","users/update":"עדכון אדם","users/delete":"מחיקת אדם","users/archive":"העברה לארכיון",access_granted:"כניסה אושרה",access_denied:"כניסה נדחתה",door_open:"דלת נפתחה",door_not_closed:"דלת לא נסגרה",ring:"צלצול"},$t={access_denied:"כניסות שנדחו",attempt_limit:"חריגה ממספר ניסיונות",unlock_exception:"פתיחה חריגה",door_not_closed:"דלת לא נסגרה"},ft={card:"כרטיס",pin:"קוד",unknown:"לא ידוע"},mt={unknown:"אין נתון",stale:"הנתון ישן",at_limit:"במגבלה",near_limit:"קרוב למגבלה",growth_to_limit:"יגיע למגבלה בקרוב",observed:"תקין"},x=(t,e)=>e?t[e]??e:"—";function gt(t){return t==="at_limit"?"err":t==="near_limit"||t==="growth_to_limit"?"warn":t==="observed"?"ok":"neutral"}function D(t){return t==="failed"||t==="error"||t==="conflict"||t==="completed_with_errors"?"err":t==="pending"||t==="syncing"||t==="paused"||t==="running"||t==="offline"?"warn":t==="verified"||t==="synced"||t==="completed"||t==="settled"||t==="saved"?"ok":"neutral"}function bt(t){return t===null?"neutral":t>=95?"err":t>=80?"warn":"ok"}function wt(t){return t.progress.verified+t.progress.settled}function yt(t,e){return e&&t.cancellable&&t.revision!==null}function et(t){if(!Number.isFinite(t)||t<=1)return 1;const e=10**Math.floor(Math.log10(t));for(const a of[1,1.2,1.5,2,2.5,3,4,5,6,8,10])if(Math.round(a*e*1e3)/1e3>=t)return Math.round(a*e*1e3)/1e3;return 10*e}function st(t){return[0,t/4,t/2,3*t/4,t].map(e=>Math.round(e*100)/100)}function at(t){return Math.abs(t)>=1e3?`${Math.round(t/100)/10}K`:String(Math.round(t*10)/10)}const xt=24,W=2;function kt(t,e,a,i,s=!0){const r=t.length;if(!r||e<=0||a<=0)return[];const c=e/r,m=Math.max(2,Math.min(xt,c*.6));return t.map((f,h)=>{const g=(s?r-1-h:h)*c+(c-m)/2,k=i>0?f.granted/i*a:0,H=i>0?f.denied/i*a:0,w=a-k,p=f.denied>0?Math.max(0,H-(f.granted>0?W:0)):0;return{key:f.day,x:g,w:m,granted:{y:w,h:k},denied:{y:w-(f.granted>0&&f.denied>0?W:0)-p,h:p},values:{granted:f.granted,denied:f.denied}}})}function Y(t,e,a,i,s=4){if(i<=0)return"";const r=Math.min(s,a/2,i);return`M${t},${e+i}V${e+r}Q${t},${e} ${t+r},${e}H${t+a-r}Q${t+a},${e} ${t+a},${e+r}V${e+i}Z`}function _t(t,e,a,i,s=!0){const r=t.filter(h=>h.users!==null&&Number.isFinite(Date.parse(h.at)));if(!r.length)return[];const c=Date.parse(r[0].at),m=Date.parse(r[r.length-1].at),f=Math.max(1,m-c);return r.map(h=>{const b=r.length===1?1:(Date.parse(h.at)-c)/f,g=s?e-b*e:b*e,k=i>0?a-h.users/i*a:a;return{x:Math.round(g*10)/10,y:Math.round(k*10)/10,at:h.at,v:h.users}})}function G(t){return t.map((e,a)=>`${a?"L":"M"}${e.x},${e.y}`).join("")}function St(t,e){let a=-1,i=1/0;return t.forEach((s,r)=>{const c=Math.abs(s.x-e);c<i&&(i=c,a=r)}),a}function F(t){const e=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t);return e?`${Number(e[3])}.${Number(e[2])}`:t}var zt=Object.defineProperty,Tt=Object.getOwnPropertyDescriptor,y=(t,e,a,i)=>{for(var s=i>1?void 0:i?Tt(e,a):e,r=t.length-1,c;r>=0;r--)(c=t[r])&&(s=(i?c(e,a,s):c(s))||s);return i&&s&&zt(e,a,s),s};const it=I`
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
`;class P extends Q{constructor(){super(...arguments),this.w=640}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(e=>{const a=Math.round(e[0].contentRect.width);a>160&&Math.abs(a-this.w)>2&&(this.w=a)}),this.ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}}y([u()],P.prototype,"w",2);let C=class extends P{constructor(){super(...arguments),this.days=[],this.height=200,this.hot=null,this.table=!1}render(){const t=this.days;if(!t.length)return o`<div class="empty" data-chart-empty>${n.empty}</div>`;const e=this.w,a=this.height,i=34,s=16,r=22,c=e-i,m=a-s-r,f=et(Math.max(...t.map(l=>l.granted+l.denied),1)),h=kt(t,c,m,f,!0),b=h.length>1?c/h.length:c,g=b<34?Math.ceil(34/b):1,k=t.reduce((l,_,B)=>_.granted+_.denied>t[l].granted+t[l].denied?B:l,0),H=this.hot===null?-1:h.findIndex(l=>l.key===this.hot),w=H>=0?h[H]:null,p=`${n.byDay}: ${t.map(l=>`${F(l.day)} ${n.granted} ${l.granted}, ${n.denied} ${l.denied}`).join("; ")}`;return o`
      <svg viewBox="0 0 ${e} ${a}" role="img" aria-label=${p} data-day-chart @pointerleave=${()=>this.hot=null}>
        ${st(f).map(l=>{const _=s+m-l/f*m;return T`<line class="grid" x1="0" x2=${c} y1=${_} y2=${_} opacity=${l===0?1:.6}></line>
            <text x=${e-4} y=${_+4} text-anchor="end">${at(l)}</text>`})}
        ${h.map((l,_)=>{const B=()=>this.hot=l.key,rt=()=>{this.hot===l.key&&(this.hot=null)},U=l.x+l.w/2,Z=l.values.granted+l.values.denied,nt=_%g===0||_===h.length-1?T`<text x=${U} y=${a-6} text-anchor="middle">${F(l.key)}</text>`:d,ot=_===k&&Z>0?T`<text class="v" x=${U} y=${s+Math.min(l.granted.y,l.denied.h?l.denied.y:l.granted.y)-5} text-anchor="middle">${Z}</text>`:d;return T`<g class=${this.hot===l.key?"band hot":"band"} tabindex="0" data-day=${l.key} aria-label=${`${F(l.key)}: ${n.granted} ${l.values.granted}, ${n.denied} ${l.values.denied}`}
              @pointerenter=${B} @focus=${B} @blur=${rt}>
            <rect class="hit" x=${l.x-(b-l.w)/2} y=${s-6} width=${b} height=${m+6}></rect>
            <g transform=${`translate(0 ${s})`}>
              ${l.granted.h>0?T`<path class="g" d=${Y(l.x,l.granted.y,l.w,l.granted.h,l.denied.h>0?0:4)}></path>`:d}
              ${l.denied.h>0?T`<path class="d" d=${Y(l.x,l.denied.y,l.w,l.denied.h)}></path>`:d}
            </g>
            ${ot}${nt}
          </g>`})}
      </svg>
      ${w?o`<div class="tip" role="tooltip" data-chart-tip style=${`left:${(w.x+w.w/2)/e*100}%; inset-block-start:${(s+Math.min(w.granted.y,w.denied.h?w.denied.y:w.granted.y))/a*100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${w.values.granted}</b> ${n.granted}</span>
            <span><span class="k" style="background:var(--c-s2)"></span><b>${w.values.denied}</b> ${n.denied}</span>
            <small>${F(w.key)}</small>
          </div>`:d}
      <div class="legend" data-chart-legend><span><i class="lg"></i>${n.granted}</span><span><i class="ld"></i>${n.denied}</span></div>
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${()=>this.table=!this.table}>${this.table?n.hideTable:n.showTable}</button>
      <div class=${this.table?"tw":"sr"}>
        <table data-chart-table>
          <thead><tr><th scope="col">יום</th><th scope="col">${n.granted}</th><th scope="col">${n.denied}</th></tr></thead>
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
    `];y([M({attribute:!1})],C.prototype,"days",2);y([M({type:Number})],C.prototype,"height",2);y([u()],C.prototype,"hot",2);y([u()],C.prototype,"table",2);C=y([N("wk-ops-day-chart")],C);let S=class extends P{constructor(){super(...arguments),this.points=[],this.limit=null,this.label="",this.height=180,this.fmt=t=>t,this.hot=-1,this.table=!1}move(t,e){const a=this.renderRoot.querySelector("svg");if(!a)return;const i=a.getBoundingClientRect();this.hot=St(e,(t.clientX-i.left)/i.width*this.w)}key(t,e){if(t.key!=="ArrowLeft"&&t.key!=="ArrowRight")return;t.preventDefault();const a=t.key==="ArrowLeft"?1:-1;this.hot=Math.max(0,Math.min(e-1,(this.hot<0?e-1:this.hot)+a))}render(){const t=this.points.filter(p=>p.users!==null);if(t.length<2)return o`<div class="empty" data-trend-empty>${n.trendNone}</div>`;const e=this.w,a=this.height,i=40,s=14,r=8,c=e-i,m=a-s-r,f=et(Math.max(...t.map(p=>p.users),this.limit??0,1)*1.05),h=_t(t,c-8,m,f,!0).map(p=>({...p,x:p.x+4})),b=h[h.length-1],g=this.hot>=0&&this.hot<h.length?h[this.hot]:null,k=this.limit!==null?s+m-this.limit/f*m:null,H=`${G(h.map(p=>({x:p.x,y:p.y+s})))}L${b.x},${s+m}L${h[0].x},${s+m}Z`,w=`${this.label}: ${t.map(p=>`${this.fmt(p.at)} ${p.users}`).join("; ")}`;return o`
      <svg viewBox="0 0 ${e} ${a}" role="img" aria-label=${w} data-trend-chart>
        ${st(f).map(p=>{const l=s+m-p/f*m;return T`<line class="grid" x1="0" x2=${c} y1=${l} y2=${l} opacity=${p===0?1:.6}></line><text x=${e-4} y=${l+4} text-anchor="end">${at(p)}</text>`})}
        ${k!==null?T`<line class="limit" x1="0" x2=${c} y1=${k} y2=${k} data-trend-limit></line><text x=${c-4} y=${k-5} text-anchor="end" data-trend-limit-label>מגבלה ${this.limit}</text>`:d}
        <path class="area" d=${H}></path>
        <path class="line" d=${G(h.map(p=>({x:p.x,y:p.y+s})))}></path>
        <circle class="dot" cx=${b.x} cy=${b.y+s} r="4"></circle>
        <text class="v" x=${b.x} y=${b.y+s-9} text-anchor="middle">${b.v}</text>
        ${g?T`<line class="cross" x1=${g.x} x2=${g.x} y1=${s} y2=${s+m}></line><circle class="dot" cx=${g.x} cy=${g.y+s} r="4"></circle>`:d}
        <rect class="plot" x="0" y=${s} width=${c} height=${m} fill="transparent" tabindex="0" aria-label=${this.label}
          @pointermove=${p=>this.move(p,h)} @pointerleave=${()=>this.hot=-1} @focus=${()=>this.hot=h.length-1} @blur=${()=>this.hot=-1}
          @keydown=${p=>this.key(p,h.length)}></rect>
      </svg>
      ${g?o`<div class="tip" role="tooltip" data-chart-tip style=${`left:${g.x/e*100}%; inset-block-start:${(g.y+s)/a*100}%`}>
            <span><span class="k" style="background:var(--c-s1)"></span><b>${g.v}</b> ${this.label}</span><small>${this.fmt(g.at)}</small>
          </div>`:d}
      <button type="button" class="tgl" data-chart-table-toggle aria-expanded=${this.table} @click=${()=>this.table=!this.table}>${this.table?n.hideTable:n.showTable}</button>
      <div class=${this.table?"tw":"sr"}>
        <table data-chart-table>
          <thead><tr><th scope="col">${n.sampledAt}</th><th scope="col">${this.label}</th></tr></thead>
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
    `];y([M({attribute:!1})],S.prototype,"points",2);y([M({type:Number})],S.prototype,"limit",2);y([M()],S.prototype,"label",2);y([M({type:Number})],S.prototype,"height",2);y([M({attribute:!1})],S.prototype,"fmt",2);y([u()],S.prototype,"hot",2);y([u()],S.prototype,"table",2);S=y([N("wk-ops-trend-chart")],S);const R=t=>{const e=new URLSearchParams;for(const[i,s]of Object.entries(t))s!=null&&s!==""&&e.set(i,String(s));const a=e.toString();return a?`?${a}`:""},z="access-control/operations",Mt=()=>j(`${z}/overview`),Ot=(t={})=>j(`${z}/operations${R({...t})}`),Et=(t={})=>j(`${z}/investigations${R({...t})}`),Ct=()=>j(`${z}/jobs`),Ht=t=>j(`${z}/capacity${R({days:t})}`),jt=(t={})=>j(`${z}/events-report${R({...t})}`);function Dt(t,e,a=Date.now()){const i=new Date(a+3e4).toISOString().replace(/\.\d{3}Z$/,"Z");return lt(`${z}/jobs/${encodeURIComponent(t)}/cancel`,{client_request_id:crypto.randomUUID().replace(/-/g,""),expires_at:i,confirmed:!0,revision:e})}async function q(t,e){const a=await fetch(dt(t),{credentials:"same-origin"});if(!a.ok){let r={};try{r=await a.json()}catch{r={}}throw new E(a.status,{code:r.code??`http_${a.status}`,user_message:r.user_message??"",retryable:r.retryable??!1,correlation_id:r.correlation_id??"",details:r.details??{}})}const i=a.headers.get("X-Export-Rows"),s=/filename="?([^";]+)"?/.exec(a.headers.get("Content-Disposition")??"")?.[1];return{blob:await a.blob(),rows:i===null?null:Number(i),filename:s||e}}const Ft=()=>q(`${z}/exports/fleet-inventory.csv`,"intercom-fleet-inventory.csv"),At=(t={})=>q(`${z}/exports/audit.csv${R({...t})}`,"intercom-change-log.csv"),Rt=t=>q(`${z}/jobs/${encodeURIComponent(t)}/errors.csv`,"intercom-job-errors.csv");function Bt(t){const e=URL.createObjectURL(t.blob),a=document.createElement("a");a.href=e,a.download=t.filename,document.body.appendChild(a),a.click(),a.remove(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}var Lt=Object.defineProperty,It=Object.getOwnPropertyDescriptor,$=(t,e,a,i)=>{for(var s=i>1?void 0:i?It(e,a):e,r=t.length-1,c;r>=0;r--)(c=t[r])&&(s=(i?c(e,a,s):c(s))||s);return i&&s&&Lt(e,a,s),s};const V=864e5,X=[1,7,30];function A(t){return t instanceof E?{s:"error",code:t.body.code,message:t.body.user_message||t.body.code,status:t.status}:{s:"error",code:"error",message:String(t),status:0}}let v=class extends Q{constructor(){super(...arguments),this.view="",this.overview=null,this.loadState="loading",this.loadError="",this.ops={s:"idle"},this.opsFilter={kind:"all",state:"all",station_id:"",query:"",offset:0},this.jobs={s:"idle"},this.openJob="",this.confirmJob=null,this.cancelBusy=!1,this.cancelError="",this.flash="",this.timeline={s:"idle"},this.tlFilter={source:"all",station_id:"",query:"",period:7,offset:0},this.capacity={s:"idle"},this.trendStation="",this.trendDays=30,this.report={s:"idle"},this.evFilter={station_id:"",period:7},this.exportBusy="",this.exportMsg=null}connectedCallback(){super.connectedCallback(),this.load()}get tab(){return vt(this.view)}get zone(){const t=this.overview?.summary;return t&&t.state==="ready"?t.data.zone:pt}get stations(){const t=this.overview?.summary;return t&&t.state==="ready"?t.data.stations:[]}name(t){return this.stations.find(e=>e.id===t)?.name??t}time(t){return ht(t,"he-IL",this.zone)}async load(){this.loadState="loading";try{this.overview=await Mt(),this.loadState="ready",this.loadTab(this.tab)}catch(t){this.loadState=t instanceof E&&t.status===403?"forbidden":"error",this.loadError=t instanceof E?t.body.user_message:String(t)}}updated(t){t.has("view")&&t.get("view")!==void 0&&this.loadState==="ready"&&this.loadTab(this.tab);const e=this.renderRoot.querySelector("nav.tabs"),a=e?.querySelector('a[aria-current="page"]');if(e&&a){const i=e.getBoundingClientRect(),s=a.getBoundingClientRect();s.left<i.left?e.scrollLeft-=i.left-s.left+8:s.right>i.right&&(e.scrollLeft+=s.right-i.right+8)}}loadTab(t){t==="operations"?(this.ops.s==="idle"&&this.loadOps(),this.jobs.s==="idle"&&this.loadJobs()):t==="investigations"&&this.timeline.s==="idle"?this.loadTimeline():t==="capacity"&&this.capacity.s==="idle"?this.loadCapacity():t==="events"&&this.report.s==="idle"&&this.loadReport()}offered(t){return this.overview?.views?.[t]!==!1}async loadOps(){this.ops={s:"loading"};const t=this.opsFilter;try{const e=await Ot({kind:t.kind,state:t.state,station_id:t.station_id||void 0,query:t.query||void 0,offset:t.offset,limit:25});this.ops={s:"ready",v:e.data}}catch(e){this.ops=A(e)}}async loadJobs(){this.jobs={s:"loading"};try{this.jobs={s:"ready",v:await Ct()}}catch(t){this.jobs=A(t)}}async loadTimeline(){this.timeline={s:"loading"};const t=this.tlFilter,e=t.period?new Date(Date.now()-t.period*V).toISOString().replace(/\.\d{3}Z$/,"Z"):void 0;try{const a=await Et({source:t.source,station_id:t.station_id||void 0,query:t.query||void 0,start:e,offset:t.offset,limit:25});this.timeline={s:"ready",v:a.data}}catch(a){this.timeline=A(a)}}async loadCapacity(){this.capacity={s:"loading"};try{const t=await Ht(this.trendDays);if(this.capacity={s:"ready",v:t},!this.trendStation||!t.data.records.some(e=>e.station_id===this.trendStation)){const e=[...t.data.records].sort((a,i)=>(i.users.used_percent??-1)-(a.users.used_percent??-1))[0];this.trendStation=e?.station_id??""}}catch(t){this.capacity=A(t)}}async loadReport(){this.report={s:"loading"};const t=this.evFilter,e=new Date(Date.now()-t.period*V).toISOString().replace(/\.\d{3}Z$/,"Z");try{this.report={s:"ready",v:await jt({station_id:t.station_id||void 0,start:e})}}catch(a){this.report=A(a)}}pill(t,e,a=""){return o`<span class="pill" data-tone=${t} data-pill=${a}>${e}</span>`}partState(t,e,a){return t.s==="idle"||t.s==="loading"?o`<sw-state-panel state="loading" compact heading=${n.loading} data-part-state="loading"></sw-state-panel>`:t.s==="error"?t.status===501||!this.offered(e)?o`<sw-state-panel icon="wrench" state="empty" compact heading=${n.unavailable} data-part-state="unavailable"></sw-state-panel>`:o`<sw-state-panel state="error" compact heading=${n.errorTitle} hint=${t.message} actionLabel=${n.retry} @action=${a} data-part-state="error"></sw-state-panel>`:null}stationSelect(t,e,a){return o`<label class="f">${n.filterStation}
      <select data-filter=${a} .value=${t} @change=${i=>e(i.target.value)}>
        <option value="">${n.all}</option>
        ${this.stations.map(i=>o`<option value=${i.id} ?selected=${i.id===t}>${i.name}</option>`)}
      </select></label>`}meter(t,e,a){const i=e.used_percent,s=bt(i);return o`<div class="meter" data-tone=${s} data-meter=${a} role="meter" aria-valuemin="0" aria-valuemax=${e.limit??0} aria-valuenow=${e.count??0} aria-label=${t}>
      <div class="lbl"><span>${t}</span><b><bdi dir="ltr">${n.usersOf(e.count,e.limit)}</bdi>${i!==null?o` · <bdi dir="ltr">${Math.round(i)}%</bdi>`:d}</b></div>
      <div class="bar"><i style=${`inline-size:${Math.max(0,Math.min(100,i??0))}%`}></i></div>
    </div>`}renderOverview(){const t=this.overview.summary;if(t.state==="error")return o`<sw-state-panel state="error" heading=${n.errorTitle} hint=${t.message} actionLabel=${n.retry} @action=${()=>void this.load()} data-part-state="error"></sw-state-panel>`;const e=t.data.kpis,a=(i,s,r,c)=>o`<sw-kpi data-kpi=${c} label=${n.kpi[i]} value=${String(e[i])} icon=${s} tone=${r}></sw-kpi>`;return o`
      <div class="kpis" data-kpis>
        ${a("stations","door","neutral","stations")}
        ${a("online","wifi",e.online===e.stations?"live":"neutral","online")}
        ${a("offline","offline",e.offline?"error":"neutral","offline")}
        ${a("pending_users","clock",e.pending_users?"partial":"neutral","pending")}
        ${a("sync_problems","warning",e.sync_problems?"error":"neutral","sync")}
        ${a("near_capacity","storage",e.near_capacity?"partial":"neutral","capacity")}
      </div>
      <section class="part" data-stations>
        <header><div><h2>${n.stationsTitle}</h2><p class="hint">${n.fetchedAt} ${this.time(t.fetched_at)}</p></div>
          <sw-button size="sm" icon="refresh" @click=${()=>void this.load()} data-refresh>${n.refresh}</sw-button></header>
        ${t.data.stations.length?o`<div class="list">${t.data.stations.map(i=>o`<article class="item" data-station=${i.id}>
                <div class="main"><b>${i.name}</b>${this.pill(i.online?"ok":"err",i.online?n.online:n.offline,"online")}${this.pill(D(i.sync_state),x(O,i.sync_state),"sync")}</div>
                <div class="end">${i.max_users?this.meter(n.table.users,{count:i.users,limit:i.max_users,used_percent:i.users!==null?Math.round(1e3*i.users/i.max_users)/10:null,remaining:null,growth_per_day:null,days_to_limit:null,alert:"observed"},"users"):d}</div>
                <div class="meta">
                  ${i.pending_users?o`<span>${n.table.pending}: ${i.pending_users}</span>`:d}
                  ${i.cards!==null?o`<span>${n.table.cards}: <bdi dir="ltr">${i.cards}${i.max_cards?` / ${i.max_cards}`:""}</bdi></span>`:d}
                  ${i.last_error?o`<span>${n.table.error}: <code>${i.last_error}</code></span>`:d}
                </div>
              </article>`)}</div>`:o`<sw-state-panel icon="door" state="empty" compact heading=${n.empty}></sw-state-panel>`}
      </section>`}renderOperations(){const t=this.opsFilter,e=s=>{this.opsFilter={...t,offset:0,...s},this.loadOps()},a=this.partState(this.ops,"operations",()=>void this.loadOps()),i=this.ops.s==="ready"?this.ops.v:null;return o`
      ${this.flash?o`<div class="msg ok" role="status" data-flash>${this.flash}</div>`:d}
      <section class="part" data-ops>
        <header><div><h2>${n.opsTitle}</h2><p class="hint">${n.opsHint}</p></div></header>
        <div class="filters">
          <label class="f">${n.filterKind}<select data-filter="kind" .value=${t.kind} @change=${s=>e({kind:s.target.value})}>
            ${["all","sync","bulk","csv"].map(s=>o`<option value=${s} ?selected=${s===t.kind}>${s==="all"?n.all:L[s]}</option>`)}</select></label>
          <label class="f">${n.filterState}<select data-filter="state" .value=${t.state} @change=${s=>e({state:s.target.value})}>
            ${["all","pending","failed","verified","settled","saved"].map(s=>o`<option value=${s} ?selected=${s===t.state}>${s==="all"?n.all:O[s]}</option>`)}</select></label>
          ${this.stationSelect(t.station_id,s=>e({station_id:s}),"station")}
          <sw-button size="sm" icon="refresh" @click=${()=>void this.loadOps()} data-ops-refresh>${n.refresh}</sw-button>
        </div>
        ${a??o`${i.stale?o`<div class="msg warn" role="status">${n.stale}</div>`:d}
          <div class="filters" data-ops-summary>${["pending","failed","verified","settled","saved"].map(s=>this.pill(D(s),`${O[s]}: ${i.summary[s]}`,s))}</div>
          ${i.records.length?o`<div class="list">${i.records.map(s=>o`<article class="item" data-op=${s.id}>
                  <div class="main"><b>${x(K,s.action)}</b>${this.pill("neutral",x(L,s.kind),"kind")}${this.pill(D(s.state),x(O,s.state),"state")}</div>
                  <div class="end"><span class="muted">${n.progress(wt(s),s.progress.total)}</span></div>
                  <div class="meta">
                    <span>${n.people(s.user_ids.length)}</span>
                    <span>${s.station_ids.map(r=>this.name(r)).join(", ")}</span>
                    <span>${this.time(s.updated_at)}</span>
                    ${s.errors.map(r=>o`<code>${r}</code>`)}
                  </div>
                </article>`)}</div>
              ${this.pager(i,s=>{this.opsFilter={...t,offset:s},this.loadOps()})}`:o`<sw-state-panel icon="activity" state="empty" compact heading=${n.empty} data-part-state="empty"></sw-state-panel>`}`}
      </section>
      ${this.renderJobs()}
      ${this.renderCancelDialog()}`}pager(t,e){return t.next_offset===null&&t.previous_offset===null?d:o`<div class="pager" data-pager><bdi dir="ltr">${t.offset+1}–${Math.min(t.total,t.offset+(t.limit??25))} / ${t.total}</bdi>
      <sw-button size="sm" ?disabled=${t.previous_offset===null} @click=${()=>t.previous_offset!==null&&e(t.previous_offset)}>${n.prev}</sw-button>
      <sw-button size="sm" ?disabled=${t.next_offset===null} @click=${()=>t.next_offset!==null&&e(t.next_offset)}>${n.more}</sw-button></div>`}renderJobs(){const t=this.partState(this.jobs,"jobs",()=>void this.loadJobs()),e=this.jobs.s==="ready"?this.jobs.v:null,a=!!e?.can_cancel;return o`<section class="part" data-jobs>
      <header><div><h2>${n.jobsTitle}</h2><p class="hint">${n.jobsHint}</p></div></header>
      ${t??(e.data.records.length?o`<div class="list">${e.data.records.map(i=>{const s=this.openJob===i.id;return o`<article class="item" data-job=${i.id}>
              <div class="main"><b>${x(L,i.kind)}</b>${this.pill(D(i.state),x(O,i.state),"state")}
                <span class="muted">${n.progress(i.saved,i.total)}</span>${i.failed?this.pill("err",n.rowsFailed(i.failed),"failed"):d}</div>
              <div class="end">
                ${i.errors.length?o`<sw-button size="sm" variant="ghost" @click=${()=>this.openJob=s?"":i.id} aria-expanded=${s} data-job-errors-toggle>${n.rowsFailed(i.errors.length)}</sw-button>`:d}
                ${a&&i.errors.length?o`<sw-button size="sm" icon="download" @click=${()=>void this.download("job",()=>Rt(i.id))} data-job-errors-csv>${n.errorsCsv}</sw-button>`:d}
                ${yt(i,a)?o`<sw-button size="sm" variant="danger" @click=${()=>this.askCancel(i)} data-job-cancel>${n.cancel}</sw-button>`:d}
              </div>
              <div class="meta"><span>${this.time(i.created_at)}</span>${i.pending?o`<span>${O.pending}: ${i.pending}</span>`:d}</div>
              ${s?o`<ul class="errs" data-job-error-rows>${i.errors.map(r=>o`<li>${n.row} ${r.row??"—"}: <code>${r.code}</code></li>`)}</ul>`:d}
            </article>`})}</div>`:o`<sw-state-panel icon="list" state="empty" compact heading=${n.jobsEmpty} data-part-state="empty"></sw-state-panel>`)}
      ${this.exportMsg&&this.exportMsg.kind==="job"?o`<div class="msg ${this.exportMsg.ok?"ok":"err"}" role="status" data-export-msg>${this.exportMsg.text}</div>`:d}
    </section>`}askCancel(t){this.cancelError="",this.confirmJob=t}async doCancel(){const t=this.confirmJob;if(!(!t||t.revision===null||this.cancelBusy)){this.cancelBusy=!0,this.cancelError="";try{await Dt(t.id,t.revision),this.confirmJob=null,this.flash=n.cancelled,await this.loadJobs()}catch(e){this.cancelError=e instanceof E?e.body.user_message||e.body.code:String(e),e instanceof E&&e.body.details?.outcome!=="not_sent"&&this.loadJobs()}finally{this.cancelBusy=!1}}}renderCancelDialog(){const t=this.confirmJob;return o`<sw-dialog ?open=${!!t} heading=${n.cancelTitle} ?locked=${this.cancelBusy} @close=${()=>this.confirmJob=null} data-cancel-dialog>
      <p>${n.cancelBody}</p>
      ${t?o`<p class="muted">${x(L,t.kind)} · ${n.progress(t.saved,t.total)} · ${this.time(t.created_at)}</p>`:d}
      ${this.cancelError?o`<div class="msg err" role="alert" data-cancel-error>${this.cancelError}</div>`:d}
      <sw-button slot="footer" @click=${()=>this.confirmJob=null} ?disabled=${this.cancelBusy} data-cancel-keep>${n.cancelKeep}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>void this.doCancel()} ?disabled=${this.cancelBusy||!!this.cancelError} data-cancel-confirm>${n.cancelConfirm}</sw-button>
    </sw-dialog>`}renderInvestigations(){const t=this.tlFilter,e=this.overview.can,a=r=>{this.tlFilter={...t,offset:0,...r},this.loadTimeline()},i=this.partState(this.timeline,"investigations",()=>void this.loadTimeline()),s=this.timeline.s==="ready"?this.timeline.v:null;return o`<section class="part" data-timeline>
      <header><div><h2>${n.invTitle}</h2><p class="hint">${n.invHint}</p></div></header>
      <div class="filters">
        <label class="f">${n.invSource}<select data-filter="source" .value=${t.source} @change=${r=>a({source:r.target.value})}>
          ${["all","access","change","sync"].map(r=>o`<option value=${r} ?selected=${r===t.source}>${r==="all"?n.all:J[r]}</option>`)}</select></label>
        ${this.stationSelect(t.station_id,r=>a({station_id:r}),"station")}
        <label class="f">${n.invFrom}<select data-filter="period" .value=${String(t.period)} @change=${r=>a({period:Number(r.target.value)})}>
          ${X.map(r=>o`<option value=${r} ?selected=${r===t.period}>${r===1?"24 שעות":n.days(r)}</option>`)}</select></label>
        ${e.names?o`<label class="f">${n.filterSearch}<input type="search" data-filter="query" .value=${t.query} maxlength="128"
              @change=${r=>a({query:r.target.value.trim()})} /></label>`:d}
      </div>
      ${i??o`${s.fields_hidden.length?o`<div class="msg warn" role="status" data-hidden-fields>${n.hiddenFields}</div>`:d}
        ${s.access_storage_failed?o`<div class="msg err" role="status">${n.storageFailed}</div>`:d}
        <div class="filters">${["access","change","sync"].map(r=>this.pill("neutral",`${J[r]}: ${s.summary[r]}`,r))}</div>
        ${s.records.length?o`<div class="list">${s.records.map(r=>o`<article class="item" data-tl=${r.id} data-source=${r.source}>
                <div class="main"><b>${x(K,r.action)}</b>${this.pill("neutral",x(J,r.source),"source")}${this.pill(D(r.status),x(O,r.status),"status")}</div>
                <div class="end"><span class="muted">${this.time(r.time)}</span></div>
                <div class="meta">
                  <span>${r.station_ids.map(c=>this.name(c)).join(", ")}${r.door?` · דלת ${r.door}`:""}</span>
                  ${r.person_name?o`<span data-person>${r.person_name}${r.employee_no?` (${r.employee_no})`:""}</span>`:d}
                  ${r.actor?o`<span data-actor>${n.operator}: ${s.actors[r.actor]??r.actor}</span>`:d}
                  ${r.fields.length?o`<span>${r.fields.join(", ")}</span>`:d}
                  <code>${r.evidence}</code>
                </div>
              </article>`)}</div>
            ${this.pager(s,r=>{this.tlFilter={...t,offset:r},this.loadTimeline()})}`:o`<sw-state-panel icon="history" state="empty" compact heading=${n.empty} data-part-state="empty"></sw-state-panel>`}`}
    </section>`}renderCapacity(){const t=this.partState(this.capacity,"capacity",()=>void this.loadCapacity()),e=this.capacity.s==="ready"?this.capacity.v:null,a=e?.data.records??[],i=a.find(r=>r.station_id===this.trendStation)??null,s=e?.trend.series[this.trendStation]??[];return o`<section class="part" data-capacity>
        <header><div><h2>${n.capTitle}</h2><p class="hint">${n.capHint}</p></div>
          <sw-button size="sm" icon="refresh" @click=${()=>void this.loadCapacity()} data-cap-refresh>${n.refresh}</sw-button></header>
        ${t??(a.length?o`<div class="cap-grid">${a.map(r=>o`<article class="cap" data-cap=${r.station_id}>
                <header><b>${r.name}</b>${this.pill(gt(r.users.alert),mt[r.users.alert],"alert")}</header>
                ${this.meter(n.table.users,r.users,"users")}${this.meter(n.table.cards,r.cards,"cards")}
                <div class="muted">
                  ${r.users.growth_per_day!==null?o`<span><bdi dir="ltr">${r.users.growth_per_day>0?"+":""}${r.users.growth_per_day}</bdi> ביום</span>`:d}
                  ${r.users.days_to_limit!==null?o` · <span data-days-to-limit>${n.daysToLimit(r.users.days_to_limit)}</span>`:d}
                  <div>${n.sampledAt}: ${this.time(r.sampled_at)}</div>
                </div>
              </article>`)}</div>`:o`<sw-state-panel icon="users" state="empty" compact heading=${n.empty} data-part-state="empty"></sw-state-panel>`)}
      </section>
      ${e&&a.length?o`<section class="part" data-trend>
            <header><div><h2>${n.trendTitle}${i?` · ${i.name}`:""}</h2><p class="hint">${n.trendHint}</p></div></header>
            <div class="filters">
              <label class="f">${n.filterStation}<select data-filter="trend-station" .value=${this.trendStation} @change=${r=>this.trendStation=r.target.value}>
                ${a.map(r=>o`<option value=${r.station_id} ?selected=${r.station_id===this.trendStation}>${r.name}</option>`)}</select></label>
              <label class="f">טווח<select data-filter="trend-days" .value=${String(this.trendDays)} @change=${r=>{this.trendDays=Number(r.target.value),this.loadCapacity()}}>${[7,30,90,365].map(r=>o`<option value=${r} ?selected=${r===this.trendDays}>${n.days(r)}</option>`)}</select></label>
            </div>
            <wk-ops-trend-chart .points=${s} .limit=${i?.users.limit??null} label=${n.table.users} .fmt=${r=>this.time(r)}></wk-ops-trend-chart>
          </section>`:d}`}renderEvents(){const t=this.evFilter,e=s=>{this.evFilter={...t,...s},this.loadReport()},a=this.partState(this.report,"events_report",()=>void this.loadReport()),i=this.report.s==="ready"?this.report.v.data:null;return o`<section class="part" data-events>
      <header><div><h2>${n.evTitle}</h2><p class="hint">${n.evHint}</p></div></header>
      <div class="filters">
        ${this.stationSelect(t.station_id,s=>e({station_id:s}),"station")}
        <label class="f">${n.invFrom}<select data-filter="period" .value=${String(t.period)} @change=${s=>e({period:Number(s.target.value)})}>
          ${X.map(s=>o`<option value=${s} ?selected=${s===t.period}>${s===1?"24 שעות":n.days(s)}</option>`)}</select></label>
      </div>
      ${a??o`
        ${i.storage_failed?o`<div class="msg err" role="status">${n.storageFailed}</div>`:d}
        <div class="kpis" data-ev-kpis>
          <sw-kpi label=${n.total} value=${String(i.totals.records)} icon="activity" tone="neutral" data-kpi="records"></sw-kpi>
          <sw-kpi label=${n.granted} value=${String(i.totals.granted)} icon="check" tone="neutral" data-kpi="granted"></sw-kpi>
          <sw-kpi label=${n.denied} value=${String(i.totals.denied)} icon="lock" tone=${i.totals.denied?"partial":"neutral"} data-kpi="denied"></sw-kpi>
          <sw-kpi label=${n.other} value=${String(i.totals.other)} icon="info" tone="neutral" data-kpi="other"></sw-kpi>
        </div>
        <h3>${n.byDay}</h3>
        <wk-ops-day-chart .days=${i.by_day.map(s=>({day:s.day,granted:s.granted,denied:s.denied}))}></wk-ops-day-chart>
        <div class="two">
          <div>
            <h3>${n.byStation}</h3>
            <table class="t" data-ev-stations>
              <thead><tr><th scope="col">${n.table.station}</th><th scope="col">${n.granted}</th><th scope="col">${n.denied}</th><th scope="col">${n.other}</th></tr></thead>
              <tbody>${i.by_station.map(s=>o`<tr><td>${this.name(s.station_id)}</td><td class="n">${s.granted}</td><td class="n">${s.denied}</td><td class="n">${s.other}</td></tr>`)}</tbody>
            </table>
          </div>
          <div>
            <h3>${n.anomalies}</h3>
            <table class="t" data-ev-anomalies>
              <tbody>${Object.entries(i.anomalies).map(([s,r])=>o`<tr><td>${x($t,s)}</td><td class="n">${r}</td></tr>`)}</tbody>
            </table>
            <h3>${n.methods}</h3>
            <table class="t" data-ev-methods>
              <tbody>${Object.entries(i.methods).map(([s,r])=>o`<tr><td>${x(ft,s)}</td><td class="n">${r}</td></tr>`)}</tbody>
            </table>
          </div>
        </div>`}
    </section>`}async download(t,e){if(!this.exportBusy){this.exportBusy=t,this.exportMsg=null;try{const a=await e();Bt(a),this.exportMsg={kind:t,ok:!0,text:n.downloaded(a.rows)}}catch(a){this.exportMsg={kind:t,ok:!1,text:a instanceof E?a.body.user_message||a.body.code:String(a)}}finally{this.exportBusy=""}}}renderExports(){const t=this.overview.can,e=a=>this.exportMsg&&this.exportMsg.kind===a?o`<div class="msg ${this.exportMsg.ok?"ok":"err"}" role="status" data-export-msg=${a}>${this.exportMsg.text}</div>`:d;return o`<section class="part" data-exports>
      <header><div><h2>${n.expTitle}</h2><p class="hint">${n.expHint}</p></div></header>
      ${t.export?o`<div class="two">
            <div class="exp" data-export="inventory"><b>${n.expInventory}</b><span class="muted">${n.expInventoryHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy||!this.offered("inventory")} @click=${()=>void this.download("inventory",Ft)} data-export-btn="inventory">${n.download}</sw-button>${e("inventory")}</div>
            <div class="exp" data-export="audit"><b>${n.expAudit}</b><span class="muted">${n.expAuditHint}</span>
              <sw-button icon="download" ?disabled=${!!this.exportBusy||!this.offered("audit_export")} @click=${()=>void this.download("audit",()=>At())} data-export-btn="audit">${n.download}</sw-button>${e("audit")}</div>
          </div>`:o`<sw-state-panel state="forbidden" compact heading=${n.adminOnly} data-part-state="forbidden"></sw-state-panel>`}
    </section>`}body(t){return t==="operations"?this.renderOperations():t==="investigations"?this.renderInvestigations():t==="capacity"?this.renderCapacity():t==="events"?this.renderEvents():t==="exports"?this.renderExports():this.renderOverview()}render(){const t=(a,i)=>o`<sw-page crumbs="הגדרות" heading=${n.title} subheading=${n.sub} data-intercom-ops data-state=${i}>${a}</sw-page>`;if(this.loadState==="loading")return t(o`<sw-state-panel state="loading" heading=${n.loading}></sw-state-panel>`,"loading");if(this.loadState==="forbidden")return t(o`<sw-state-panel state="forbidden" heading=${n.forbiddenTitle} hint=${n.forbiddenHint}></sw-state-panel>`,"forbidden");if(this.loadState==="error")return t(o`<sw-state-panel state="error" heading=${n.errorTitle} hint=${this.loadError} actionLabel=${n.retry} @action=${()=>void this.load()}></sw-state-panel>`,"error");const e=this.tab;return t(o`<nav class="tabs" aria-label=${n.title}>
          ${tt.map(a=>o`<a href="${ut}/${a}" aria-current=${a===e?"page":"false"} data-ops-tab=${a}>${n.tabs[a]}</a>`)}
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
//# sourceMappingURL=system-intercom-ops-Da1pLoax.js.map
