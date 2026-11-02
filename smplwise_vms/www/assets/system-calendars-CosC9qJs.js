import{a as R,oH as T,R as u,oG as E,e as o,A as h,eN as S,E as L,F as H,G as c,H as C}from"./index-DqJBc8eX.js";import{B as b,x as A,O as $,e as g,k as f,A as w,R as k,z as O,y as q,u as P,c as M}from"./model-CFIbI_9R.js";import{l as B}from"./lead-reserve-5y14kc2C.js";import"./sw-logo-art-Va6y_cIM.js";var I=Object.defineProperty,N=Object.getOwnPropertyDescriptor,p=(e,t,a,l)=>{for(var s=l>1?void 0:l?N(t,a):t,r=e.length-1,i;r>=0;r--)(i=e[r])&&(s=(l?i(t,a,s):i(s))||s);return l&&s&&I(t,a,s),s};const _=[["overlap","חפיפת תחזוקה","חפיפה"],["behavior","התנהגות","התנהגות"],["approval","אישור לכל יומן","אישור"],["perm","הרשאות","הרשאות"],["retention","פרטי אורחים","אורחים"]],x={maintenance_overlap:"first_holds",contested_requests:"queue",pending_holds_slot:!1,menu_position:"rail",holiday_eve_as_holiday:!1,guest_details_enabled:!0,guest_retention_days:30,editors_bypass_approval:!0,default_room_buffer_after_min:10,series_horizon_days:400,max_calendars:500,notify_confirmations:!1,contested_order:"first_come",allow_displace:!0,displace_approver:"calendar_manager",override_scope:"both",phone_time_picker:"grid",reauth_mode:"reauth_and_continue",sync_conflict_display:"side_by_side",tablet_panels:"collapse",resident_pending_display:"count",resident_cancel_until:"start",resident_rooms:"bookable",purge_confirm:"type_word",loading_style:"skeleton",default_approval_timeout_h:2,reopen_days:7,sync_external_delete:"cancel"},z=[["all","הכל"],["display","תצוגה"],["requests","בקשות ואישורים"],["booking","הזמנות"],["residents","דיירים"],["sync","סנכרון ופרטיות"]],y=[{group:"display",key:"menu_position",label:'מיקום "יומנים" בתפריט',kind:"seg",opts:[["rail","סרגל צד"],["home_tab","לשונית בראשי"],["both","שניהם"]],hint:"דייר עם יומנים בלבד מקבל תמיד כפתור משלו"},{group:"display",key:"phone_time_picker",label:"בחירת שעה בטלפון",kind:"seg",opts:[["grid","רשת שעות"],["timeline","פס זמן"]]},{group:"display",key:"tablet_panels",label:"טאבלט 1024: לוחות צד",kind:"seg",opts:[["collapse","נפתחים בלחיצה"],["shrink","מוקטנים"]]},{group:"display",key:"loading_style",label:"טעינה",kind:"seg",opts:[["skeleton","שלד"],["spinner","סמל מסתובב"]]},{group:"requests",key:"editors_bypass_approval",label:"מנהלים ועורכים לא צריכים אישור ביומן שלהם",kind:"tog"},{group:"requests",key:"notify_confirmations",label:"הודעת אישור למארגן כשאין צורך באישור",kind:"tog"},{group:"requests",key:"default_approval_timeout_h",label:"בקשה שלא הוחלטה פגה לפני ההתחלה",kind:"step",min:0,max:720,step:1,unit:"שע׳",hint:"ליומן חדש"},{group:"requests",key:"reopen_days",label:"פתיחה מחדש של בקשה שנדחתה",kind:"step",min:0,max:60,step:1,unit:"ימים"},{group:"requests",key:"contested_order",label:"עדיפות כשבקשות מתחרות",kind:"seg",opts:[["first_come","סדר הגעה"],["manual","מנהל מחליט"],["by_kind","לפי סוג"]]},{group:"requests",key:"allow_displace",label:"אישור בקשה מעל הזמנה מאושרת (דחיקה)",kind:"tog",hint:"כבוי: רק לדחות את הבקשות"},{group:"requests",key:"displace_approver",label:"מי רשאי לדחוק הזמנה מאושרת",kind:"seg",opts:[["calendar_manager","מנהל היומן"],["any_manager","כל מנהל"]]},{group:"requests",key:"displaced",label:"הזמנה שנדחקה",kind:"seg",opts:[["organizer","המארגן בוחר"],["auto","הזזה אוטומטית"]],static:!0,hint:"הזזה אוטומטית לא נבנתה"},{group:"booking",key:"holiday_eve_as_holiday",label:"ערב חג",kind:"seg",opts:[[!1,"יום רגיל"],[!0,"כמו חג"]]},{group:"booking",key:"default_room_buffer_after_min",label:"הפסקה אחרי הזמנת חדר",kind:"step",min:0,max:240,step:5,unit:"דק׳"},{group:"booking",key:"series_horizon_days",label:"טווח פריסת סדרות",kind:"step",min:30,max:800,step:10,unit:"יום"},{group:"booking",key:"max_calendars",label:"מספר יומנים מרבי",kind:"step",min:1,max:2e3,step:10},{group:"residents",key:"resident_cancel_until",label:"דייר יכול לבטל עד",kind:"seg",opts:[["start","תחילה"],["1h","שעה לפני"],["24h","24 שע׳"]]},{group:"residents",key:"resident_pending_display",label:"שעה עם בקשות ממתינות, אצל הדייר",kind:"seg",opts:[["count",'"2 מבקשים"'],["free",'רק "פנוי"'],["blocked","חסומה"]]},{group:"residents",key:"resident_rooms",label:"חדרים במסך ההזמנה של הדייר",kind:"seg",opts:[["bookable","רק שמותר לו"],["all_busy",'כולם, השאר "תפוס"']]},{group:"sync",key:"sync_conflict_display",label:"התנגשות מסנכרון בתצוגת השבוע",kind:"seg",opts:[["side_by_side","זו לצד זו"],["list_only","רק ברשימה"]]},{group:"sync",key:"reauth_mode",label:"חיבור שדורש הרשאה מחדש",kind:"seg",opts:[["reauth_and_continue",'הרשאה + "המשך"'],["reauth_only","הרשאה בלבד"]]},{group:"sync",key:"purge_confirm",label:'אישור "מחיקת כל פרטי האורחים"',kind:"seg",opts:[["type_word",'הקלדת "מחיקה"'],["one_click","לחיצה בחלון"]]}];function V(e){if(e.static)return"המארגן בוחר חלופה";const t=x[e.key];return e.kind==="tog"?t?"דולק":"כבוי":e.kind==="step"?`${t}${e.unit?` ${e.unit}`:""}`:e.opts?.find(a=>a[0]===t)?.[1]??String(t)}const D={first_holds:'חלון התחזוקה נשמר כממתין ומסומן "מתחרה". שום הזמנה לא זזה עד שהמנהל מחליט.',override_notify:'ההזמנה עוברת ל"נדחק" ולא נמחקת. המארגן בוחר אחת מ־3 חלופות.',block:"השמירה נחסמת ומוצעים חלונות פנויים באותו אורך.",ask:"מי שמציב את החלון בוחר בכל פעם, והבחירה נשמרת עם החלון."};let d=class extends R{constructor(){super(...arguments),this.route=null,this.s=null,this.canEdit=!1,this.cals=[],this.error="",this.saveError="",this.page=1,this.per=6,this.draftRetention=null,this.confirm=null,this.typed="",this.toastText="",this.phone=window.innerWidth<700,this.group="all",this.api=null,this.ro=null,this.stepTimer=0,this.fitRowH=0,this.toastTimer=0,this.onResize=()=>this.phone=window.innerWidth<700}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),this.ro?.disconnect(),clearTimeout(this.stepTimer),clearTimeout(this.toastTimer)}willUpdate(e){const t=e.get("route");e.has("route")&&t&&t.params.get("tab")!==this.route?.params.get("tab")&&(this.page=1,this.per=6,this.fitRowH=0),e.has("phone")&&(this.fitRowH=0)}updated(){const e=this.renderRoot.querySelector("[data-fit]");this.ro??=new ResizeObserver(()=>this.fit()),this.ro.disconnect(),e&&(this.ro.observe(e),requestAnimationFrame(()=>this.fit()))}fit(){const e=this.renderRoot.querySelector("[data-fit]");if(!e)return;const t=getComputedStyle(e).gridTemplateColumns.split(" ").filter(Boolean).length||1,a=!!e.querySelector("tbody"),l=a?[...e.querySelectorAll("tbody tr")]:[...e.children],s=Math.max(0,...l.map(v=>v.offsetHeight+(a?0:8))),r=Math.max(Number(e.dataset.fit)||66,s,this.fitRowH);this.fitRowH=r;const i=a?e.clientHeight-(e.querySelector("thead")?.offsetHeight??0):e.clientHeight+8,n=t*P(i,r);n!==this.per&&(this.page=Math.floor((this.page-1)*this.per/Math.max(1,n))+1,this.per=n)}get tab(){const e=this.route?.params.get("tab");return e&&_.some(t=>t[0]===e)?e:"overlap"}async load(){this.error="";try{this.api??=await T();const[e,t]=await Promise.all([this.api.settings(),this.api.calendars().catch(()=>({calendars:[]}))]);this.s=e.settings,this.canEdit=e.can_configure,this.cals=t.calendars.filter(a=>!a.archived)}catch(e){this.error=u(e)}}toast(e){this.toastText=e,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toastText="",3200)}async save(e){if(!this.s||!this.api||!this.canEdit)return 0;const t=this.s;this.s={...this.s,...e},this.saveError="";try{const a=await this.api.saveSettings(this.s);return this.s=a.settings,E(),a.erase_preview}catch(a){return this.s=t,this.saveError=u(a),0}}stepSave(e,t){this.s&&(this.s={...this.s,[e]:t},clearTimeout(this.stepTimer),this.stepTimer=window.setTimeout(()=>void this.save({[e]:t}),500))}render(){if(this.error)return o`<sw-state-panel state="error" data-calset-state="error" heading="לא הצלחנו לטעון את הגדרות היומנים" hint=${this.error} actionLabel="לנסות שוב" @action=${()=>void this.load()}></sw-state-panel>`;if(!this.s)return o`<div class="panel" data-calset-state="loading" role="status" aria-label="טוען">${[0,1,2,3].map(()=>o`<div class="skel" style="block-size:56px"></div>`)}</div>`;const e=this.tab;return o`
      <div class="head lead-head">
        <div class="ttl"><span class="crumb">הגדרות</span><h1>יומנים</h1></div><span class="sp"></span>
        <label class="modsw"><span>מודול היומנים</span><sw-toggle data-calset="enabled" label="מודול היומנים פעיל" labelHidden ?checked=${this.s.enabled} ?disabled=${!this.canEdit}
          @change=${t=>void this.save({enabled:t.detail.checked})}></sw-toggle><b>${this.s.enabled?"פעיל":"כבוי"}</b></label>
      </div>
      ${this.canEdit?h:o`<div class="ro" data-calset-ro>צפייה בלבד: שינוי ההגדרות דורש את ההרשאה "יומנים: הגדרות".</div>`}
      ${this.saveError?o`<div class="err" role="alert" data-calset-error>${this.saveError}</div>`:h}
      <section class="panel" data-calset-tab=${e}>
        <div class="seg tabs" role="tablist" aria-label="הגדרות היומנים" @keydown=${S}>${_.map(([t,a,l])=>o`<button type="button" role="tab" aria-pressed=${String(e===t)} aria-selected=${String(e===t)}
          data-calset-tabbtn=${t} @click=${()=>location.hash=`#/system/calendars?tab=${t}`}>${this.phone?l:a}</button>`)}</div>
        ${e==="overlap"?this.overlapTab():e==="behavior"?this.behaviorTab():e==="approval"?this.approvalTab():e==="perm"?this.permTab():this.retentionTab()}
      </section>
      ${this.dialogs()}
      ${this.toastText?o`<div class="toast" role="status" data-calset-toast>${this.toastText}</div>`:h}`}overlapTab(){const e=this.s,t=["first_holds","override_notify","block","ask"],a=this.cals.filter(s=>s.overlap_override).slice(0,2),l=b[e.maintenance_overlap];return o`<div class="twocol">
      <div class="col" role="radiogroup" aria-label="כשחלון תחזוקה נופל על הזמנה מאושרת"><h2>כשחלון תחזוקה נופל על הזמנה מאושרת</h2>
        ${t.map(s=>o`<button type="button" class="opt" role="radio" aria-checked=${String(e.maintenance_overlap===s)} ?disabled=${!this.canEdit} data-overlap=${s}
          @click=${()=>void this.save({maintenance_overlap:s})}><span class="rad"></span><div><b>${A[s]}${s==="first_holds"?o` <span class="chip def">ברירת מחדל</span>`:h}</b><small>${D[s]}</small></div></button>`)}
      </div>
      <div class="col"><h2>יומן שקובע אחרת</h2>
        <p class="lead">מנהל יומן יכול לבחור ערך אחר ליומן שלו${a.length?". דוגמה מהיומנים שלך:":". אף יומן לא בחר ערך משלו."}</p>
        ${a.map(s=>{const r=b[s.overlap_override]>=l;return o`<div class="row wide-only" data-override=${s.id}><span class="dot" style=${`--h:${g(s.color)}`}></span><div class="grow"><div class="name ell" title=${s.name}>${s.name}: "${$[s.overlap_override]}"</div>
            <div class="sub">${r?"מחמיר מההגדרה הכללית":"מקל מההגדרה הכללית"}</div></div><span class=${`chip ${r?"":"warn"}`}>${r?"מחמיר":"מקל"}</span></div>`})}
        ${this.settingRow({key:"override_scope",label:"מנהל יומן רשאי לשנות",kind:"seg",opts:[["both","שני הכיוונים"],["stricter","רק מחמיר"],["none","לא"]]})}
        ${this.settingRow({key:"pending_holds_slot",label:"בקשה ממתינה שומרת את המועד",kind:"tog",hint:"כבוי: הראשון שאושר זוכה"})}
        ${this.settingRow({key:"contested_requests",label:"בקשות חופפות",kind:"seg",opts:[["queue","לתור"],["reject","לדחות"]],hint:"לתור החלטה, עם מספר המבקשים"})}
      </div></div>`}behaviorTab(){const e=this.group==="all"?y:y.filter(s=>s.group===this.group),t=f(e,this.page,this.per),a=s=>y.filter(r=>(s==="all"||r.group===s)&&!r.static&&this.s?.[r.key]!==x[r.key]).length,l=s=>{s!==this.group&&(this.group=s,this.page=1,this.fitRowH=0)};return o`<div class="tabhead"><div class="grow"><h2>התנהגות המודול</h2><p class="lead">כל התנהגות היא הגדרה. ברירת המחדל כתובה מתחת לכל שורה; "איפוס" מחזיר אותה.</p></div>
        ${this.phone?o`<select class="inp groupsel" aria-label="נושא" data-calset-group .value=${this.group} @change=${s=>l(s.target.value)}>
            ${z.map(([s,r])=>o`<option value=${s} ?selected=${s===this.group}>${r}</option>`)}</select>`:o`<div class="seg groups" role="radiogroup" aria-label="נושא" data-calset-groups>${z.map(([s,r])=>{const i=s==="all"?0:a(s);return o`<button type="button" role="radio" aria-pressed=${String(s===this.group)} aria-checked=${String(s===this.group)} data-calset-group=${s} @click=${()=>l(s)}>${r}${i?o`<span class="mod num" title="שונו מברירת המחדל">${i}</span>`:h}</button>`})}</div>`}</div>
      <div class="fitbox"><div class="grid rows2" data-fit="66" data-calset-rows>${t.items.map(s=>this.settingRow(s))}</div></div>
      ${this.pager(t.page,t.pages)}`}pager(e,t){return t<=1?h:o`<div class="pager" data-calset-pager><button type="button" class="btn icon" aria-label="הקודם" ?disabled=${e<=1} data-calset-prev @click=${()=>this.page=e-1}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      <span class="num">${e} / ${t}</span><button type="button" class="btn icon" aria-label="הבא" ?disabled=${e>=t} data-calset-next @click=${()=>this.page=e+1}><sw-icon name="chevron" size="16"></sw-icon></button></div>`}settingRow(e){const t=this.s,a=e.static?"organizer":t[e.key],l=e.static?"organizer":x[e.key],s=!this.canEdit,r=!e.static&&a!==l;let i;if(e.kind==="tog")i=o`<sw-toggle label=${e.label} labelHidden ?checked=${!!a} ?disabled=${s} @change=${n=>void this.save({[e.key]:n.detail.checked})}></sw-toggle>`;else if(e.kind==="step"){const n=Number(a),v=m=>this.stepSave(e.key,Math.min(e.max??9999,Math.max(e.min??0,Math.round(m||0))));i=o`<span class="stepper"><button type="button" aria-label="פחות" ?disabled=${s||n<=(e.min??0)} @click=${()=>v(n-(e.step??1))}>−</button>
        <input type="number" inputmode="numeric" aria-label=${e.label} .value=${String(n)} ?disabled=${s} min=${e.min??0} max=${e.max??9999}
          @change=${m=>v(Number(m.target.value))}><button type="button" aria-label="יותר" ?disabled=${s||n>=(e.max??9999)} @click=${()=>v(n+(e.step??1))}>+</button></span>`}else i=o`<div class="seg" role="radiogroup" aria-label=${e.label}>${(e.opts??[]).map(([n,v])=>o`<button type="button" role="radio" aria-pressed=${String(a===n)} aria-checked=${String(a===n)}
        ?disabled=${s||e.static&&n!=="organizer"} title=${e.static&&n!=="organizer"?"לא נבנה":""} data-opt=${String(n)}
        @click=${()=>{!e.static&&a!==n&&this.save({[e.key]:n})}}>${v}</button>`)}</div>`;return o`<div class="row" data-setting=${e.key}><div class="grow"><div class="name ell" title=${e.label}>${e.label}</div>
      <div class="sub">ברירת מחדל: ${V(e)}${e.hint?o` · ${e.hint}`:h}${r&&!s?o` <button type="button" class="reset" data-reset=${e.key}
        @click=${()=>void this.save({[e.key]:l})}>איפוס</button>`:h}</div></div><div class="ctl">${i}</div></div>`}approvalTab(){const e=this.cals.filter(i=>i.type==="room"||i.type==="team"||i.type==="event"),t=f(e,this.page,this.per),a=this.s.override_scope,l=this.s.maintenance_overlap,s=["first_holds","override_notify","block","ask"].filter(i=>a==="both"||b[i]>=b[l]),r=i=>this.canEdit||i.my_role==="manage";return e.length?this.phone?o`<h2>אישור לכל יומן</h2>
        <div class="fitbox"><div class="grid" data-fit="66" data-calset-rows>${t.items.map(i=>o`<div class="row" data-approval=${i.id}><span class="dot" style=${`--h:${g(i.color)}`}></span>
          <div class="grow"><div class="name ell">${i.name}</div><div class="sub ell">${w[i.approval_mode]}</div></div>
          <sw-toggle label=${`אישור ב${i.name}`} labelHidden ?checked=${i.approval_mode!=="none"} ?disabled=${!r(i)} @change=${n=>void this.patchCal(i,{approval_mode:n.detail.checked?"always":"none"})}></sw-toggle></div>`)}</div></div>
        ${this.pager(t.page,t.pages)}`:o`<h2>אישור לכל יומן</h2><p class="lead">ברירת המחדל: ללא אישור. כשמדליקים, מנהל היומן מאשר או דוחה. כל שינוי נשמר מיד.</p>
      <div class="fitbox"><div class="grid" data-fit="51" data-calset-rows><table class="t"><thead><tr><th>יומן</th><th>מנהל</th><th>מתי צריך אישור</th><th>מבטל אם לא הוחלט</th><th>תחזוקה מעל הזמנה</th></tr></thead><tbody>
      ${t.items.map(i=>o`<tr data-approval=${i.id}><td><span class="cname"><span class="dot" style=${`--h:${g(i.color)}`}></span><span class="n ell" title=${i.name}>${i.name}</span></span></td>
        <td>${i.owner.name?o`<span class="ell">${i.owner.name}</span>`:o`<span class="chip warn">חסר</span>`}</td>
        <td><span class="selw"><select class="inp" aria-label=${`מתי צריך אישור ב${i.name}`} ?disabled=${!r(i)} data-approval-mode @change=${n=>void this.patchCal(i,{approval_mode:n.target.value})}>
          ${Object.keys(w).map(n=>o`<option value=${n} ?selected=${i.approval_mode===n}>${w[n]}</option>`)}</select><sw-icon name="chevronDown" size="14"></sw-icon></span></td>
        <td>${i.approval_mode==="none"?o`<span class="muted">—</span>`:o`<span class="selw"><select class="inp num" aria-label=${`זמן ההחלטה ב${i.name}`} ?disabled=${!r(i)}
          @change=${n=>void this.patchCal(i,{approval_timeout_h:Number(n.target.value)})}>
          ${[0,1,2,4,12,24,48].map(n=>o`<option value=${n} ?selected=${(i.approval_timeout_h??0)===n}>${n?`${n} שע׳ לפני`:"בתחילת המועד"}</option>`)}</select><sw-icon name="chevronDown" size="14"></sw-icon></span>`}</td>
        <td>${i.type!=="room"?o`<span class="muted">—</span>`:a==="none"?o`<span class="muted">לפי ההתקנה</span>`:o`<span class="selw"><select class="inp" aria-label=${`תחזוקה מעל הזמנה ב${i.name}`} ?disabled=${!r(i)}
          @change=${n=>{const v=n.target.value;this.patchCal(i,{overlap_override:v||null})}}>
          <option value="" ?selected=${!i.overlap_override}>לפי ההתקנה</option>${s.map(n=>o`<option value=${n} ?selected=${i.overlap_override===n}>${$[n]}</option>`)}</select><sw-icon name="chevronDown" size="14"></sw-icon></span>`}</td></tr>`)}
      </tbody></table></div></div>${this.pager(t.page,t.pages)}`:o`<h2>אישור לכל יומן</h2><sw-state-panel icon="calendar" state="empty" compact heading="אין עדיין יומנים" hint="יומן נוצר בלשונית ניהול יומנים."></sw-state-panel>`}async patchCal(e,t){if(this.api){this.saveError="";try{const a=await this.api.patchCalendar(e.id,{revision:e.revision,...t});this.cals=this.cals.map(l=>l.id===e.id?{...l,...a.calendar}:l)}catch(a){this.saveError=u(a),this.cals=[...this.cals]}}}permTab(){const e=[["יומנים: צפייה","צופה ומעלה",!1],["יומנים: יצירת הזמנות","מפעיל ומעלה",!1],["יומנים: הזמנה בשם צוות, חוג או לקוח","מנהל אתר, מנהל מערכת",!1],["יומנים: חלונות תחזוקה","מנהל אתר, מנהל מערכת",!0],["יומנים: פרטי אורחים (שם וטלפון)","מנהל מערכת, ומנהל היומן ביומן שלו",!0],["יומנים: חיבור יומנים חיצוניים","מנהל מערכת, ומי שהבעלים מעניק לו",!0],["יומנים: הגדרות","מנהל מערכת",!0]],t=f(this.cals,this.page,this.per);return o`<h2>הרשאות</h2><p class="lead">לכל יומן תפקידים משלו. התפקיד ביומן לא נותן יותר מההרשאות של המשתמש במערכת.</p>
      <div class="rolechips">${["view","book","edit","manage"].map(a=>o`<div class="row"><b class="name">${k[a]}</b><span class="sub">${O[a]}</span></div>`)}</div>
      <div class="twocol" style="flex:1;min-block-size:0">
        <div class="col"><h3>תפקידים לכל יומן</h3>
          <div class="fitbox"><div class="grid" data-fit="66" data-calset-rows>${t.items.map(a=>o`<a class="row linkrow" href=${`#/calendars/manage/${encodeURIComponent(a.id)}`} data-perm-cal=${a.id}>
            <span class="dot" style=${`--h:${g(a.color)}`}></span><div class="grow"><div class="name ell" title=${a.name}>${a.name}</div><div class="sub ell">${q[a.type]} · מנהל: ${a.owner.name||"חסר"}${a.my_role?` · שלך: ${k[a.my_role]}`:""}</div></div>
            <span class="chip acc">חברים ותפקידים</span></a>`)}</div></div>${this.pager(t.page,t.pages)}</div>
        <div class="col wide-only"><h3>הרשאות במערכת שהתפקיד ביומן נשען עליהן</h3>
          <table class="t"><thead><tr><th>הרשאה</th><th>מי מחזיק כברירת מחדל</th><th>רגישה</th></tr></thead><tbody>
          ${e.map(([a,l,s])=>o`<tr><td><span class="n">${a}</span></td><td>${l}</td><td>${s?o`<span class="chip warn">רגישה</span>`:o`<span class="muted">—</span>`}</td></tr>`)}
          </tbody></table><p class="lead">את ההרשאות עצמן נותנים בהגדרות ‹ משתמשים והרשאות.</p></div>
      </div>`}retentionTab(){const e=this.s,t=this.draftRetention??e.guest_retention_days,a=this.draftRetention!==null&&this.draftRetention!==e.guest_retention_days,l=r=>this.draftRetention=Math.min(3650,Math.max(0,Math.round(r||0))),s=!this.canEdit;return o`<h2>שם וטלפון של אורחים ולקוחות</h2><p class="lead">נשמרים מוצפנים, לא יוצאים להודעות, לפידים או ליומנים חיצוניים. התווית (למשל "חוג קרמיקה") נשארת.</p>
      <div class="row" data-setting="guest_retention_days"><div class="grow"><div class="name">ימים אחרי המועד האחרון</div><div class="sub">ברירת מחדל 30 · בין 0 ל־3650 · 0 = מחיקה בסיום המועד</div></div>
        <div class="ctl"><span class="stepper"><button type="button" aria-label="פחות" ?disabled=${s||t<=0} @click=${()=>l(t-1)}>−</button>
          <input type="number" inputmode="numeric" aria-label="ימי שמירה" data-retention .value=${String(t)} min="0" max="3650" ?disabled=${s} @change=${r=>l(Number(r.target.value))}>
          <button type="button" aria-label="יותר" ?disabled=${s||t>=3650} @click=${()=>l(t+1)}>+</button></span>
          ${a?o`<button type="button" class="btn pri sm" data-retention-save @click=${()=>this.saveRetention()}>שמירה</button>`:h}</div></div>
      ${this.settingRow({key:"guest_details_enabled",label:"לאפשר פרטי אורח בהזמנות",kind:"tog",hint:"בכל הזמנה בשם מישהו אחר"})}
      <div class="row wide-only"><div class="grow"><div class="name">המחיקה האוטומטית</div><div class="sub">רצה פעם בשעה לכל היותר ונרשמת ביומן הפעולות (מספרים בלבד)</div></div><span class="chip ok">פעיל</span></div>
      <div class="banner"><sw-icon name="warning" size="18"></sw-icon><div><b>הקטנת המספר מוחקת מוקדם יותר</b><span class="muted">לפני השמירה תתבקש לאשר; אחריה תוצג כמות הרשומות שיימחקו בהרצה הבאה.</span></div></div>
      <div class="row danger"><div class="grow"><div class="name">מחיקת כל פרטי האורחים עכשיו</div><div class="sub">בלתי הפיך. נרשם ביומן הפעולות (מספרים בלבד).</div></div>
        <button type="button" class="btn bad sm" data-purge ?disabled=${s} @click=${()=>{this.typed="",this.confirm="purge"}}><sw-icon name="trash" size="14"></sw-icon>מחיקה…</button></div>`}saveRetention(){const e=this.s;if(this.draftRetention!==null){if(this.draftRetention<e.guest_retention_days){this.confirm="retention";return}this.commitRetention()}}async commitRetention(){const e=this.draftRetention;if(this.confirm=null,e===null)return;const t=await this.save({guest_retention_days:e});this.draftRetention=null,this.saveError||this.toast(t?`${t.toLocaleString("he-IL")} רשומות יימחקו בהרצה הבאה`:"נשמר")}async purge(){if(this.api){this.confirm=null;try{const e=await this.api.purgeGuests();this.toast(`נמחקו פרטי אורחים מ־${e.erased.toLocaleString("he-IL")} רשומות`)}catch(e){this.saveError=u(e)}}}dialogs(){const e=this.s.purge_confirm!=="one_click";if(this.confirm==="retention")return o`<sw-dialog open heading="להקטין את זמן השמירה?" data-retention-confirm @close=${()=>this.confirm=null}><div class="dlg"><p>פרטי אורחים יימחקו מוקדם יותר: רשומות שהמועד שלהן הסתיים לפני יותר
        מ־<b class="num">${this.draftRetention}</b> ימים יימחקו בהרצה הבאה.</p></div>
        <button slot="footer" type="button" class="btn" @click=${()=>this.confirm=null}>ביטול</button>
        <button slot="footer" type="button" class="btn pri" data-confirm-ok @click=${()=>void this.commitRetention()}>שמירה</button></sw-dialog>`;if(this.confirm==="purge"){const t=!e||this.typed.trim()==="מחיקה";return o`<sw-dialog open heading="למחוק את כל פרטי האורחים?" data-purge-confirm @close=${()=>this.confirm=null}><div class="dlg"><p>השמות ומספרי הטלפון של כל האורחים יימחקו עכשיו. התוויות נשארות. אי אפשר לבטל.</p>
        ${e?o`<label class="typed"><span class="lbl">כדי לאשר, יש להקליד "מחיקה"</span><input class="inp" data-purge-word autocomplete="off" .value=${this.typed} @input=${a=>this.typed=a.target.value}></label>`:h}</div>
        <button slot="footer" type="button" class="btn" @click=${()=>this.confirm=null}>ביטול</button>
        <button slot="footer" type="button" class="btn bad fill" data-purge-ok ?disabled=${!t} @click=${()=>void this.purge()}>מחיקה</button></sw-dialog>`}return h}};d.styles=[M,B,L`
    :host { display: flex; flex-direction: column; min-block-size: 0; flex: 1; padding: 14px var(--sw-page-pad) 20px; gap: 12px; overflow: hidden; }
    /* CALMSG-POLISH-2331: the page title reads like every settings page (sw-page): the "הגדרות" crumb, the skin's h1 scale */
    h1 { margin: 0; font-family: var(--sw-font-heading, var(--sw-font)); font-size: var(--sw-h1, var(--sw-fs-2xl)); font-weight: var(--sw-h1-weight, var(--sw-fw-bold));
      letter-spacing: var(--sw-h1-tracking, -0.01em); line-height: 1.2; color: var(--sw-heading); }
    .ttl { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; }
    .crumb { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .head { display: flex; align-items: flex-end; gap: 10px 16px; flex-wrap: wrap; padding-inline-end: var(--sw-float-reserve, 0px); }
    .tabhead { display: flex; align-items: flex-end; gap: 8px 16px; flex-wrap: wrap; min-inline-size: 0; }
    .tabhead h2 + .lead { margin-block-start: 4px; }
    .groups { flex-wrap: wrap; }
    .groups .mod { display: inline-grid; place-items: center; min-inline-size: 18px; block-size: 18px; padding: 0 5px; margin-inline-start: 6px; border-radius: var(--sw-r-pill);
      background: var(--sw-accent-soft); color: var(--sw-accent-text); font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-bold); }
    .groupsel { inline-size: 100%; }
    /* focus and hover on every control the screen draws itself (the shared .btn / .seg have theirs in calCss) */
    .opt, .reset, .linkrow, .seg button, .selw select { transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color); }
    @media (prefers-reduced-motion: reduce) { .opt, .stepper button, .opt:active, .stepper button:active { transition: none; transform: none; } }
    .opt:focus-visible, .stepper button:focus-visible, .reset:focus-visible, .linkrow:focus-visible, .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    .stepper input:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; border-radius: var(--sw-r-sm); }
    .stepper button:not([disabled]):active, .opt:not([disabled]):active { transform: scale(0.97); }
    .stepper button { transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color); }
    @media (hover: hover) {
      .opt:not([disabled]):not([aria-checked='true']):hover { background: var(--sw-hover-wash); }
      .stepper button:not([disabled]):hover { background: var(--sw-hover-wash); }
      .linkrow:hover { background: var(--sw-hover-wash); }
      .linkrow:hover .chip.acc { background: var(--sw-accent); color: var(--sw-text-inverse); }
      .reset:hover { text-decoration: underline; text-underline-offset: 2px; }
    }
    /* a select reads as a select: the chevron at its end (appearance: none hid the native arrow) */
    .selw { position: relative; display: inline-flex; align-items: center; max-inline-size: 100%; }
    .selw select { padding-inline-end: 30px; }
    .selw sw-icon { position: absolute; inset-inline-end: 10px; pointer-events: none; color: var(--sw-text-3); }
    .selw select[disabled] + sw-icon { opacity: var(--sw-disabled-opacity); }
    table.t tbody tr { transition: background var(--sw-t-hover) var(--sw-ease-color); }
    @media (hover: hover) { table.t tbody tr:hover td { background: var(--sw-hover-wash); } }
    .modsw { display: inline-flex; align-items: center; gap: 10px; font-size: var(--sw-fs-md); color: var(--sw-text-2); }
    .panel { flex: 1; }
    .tabs { align-self: flex-start; flex: none; }
    h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    h3 { margin: 4px 0 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .lead { margin: -4px 0 0; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .twocol { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px 20px; min-block-size: 0; }
    .col { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; min-block-size: 0; }
    .opt { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent;
      cursor: pointer; text-align: start; font: inherit; color: inherit; inline-size: 100%; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .opt[disabled] { cursor: default; }
    .rad { flex: none; inline-size: 20px; block-size: 20px; border-radius: 50%; border: 2px solid var(--sw-border-strong); margin-block-start: 2px; display: grid; place-items: center; }
    .opt[aria-checked='true'] .rad { border-color: var(--sw-accent); }
    .opt[aria-checked='true'] .rad::after { content: ''; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-accent); }
    .opt b { display: block; font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .opt small { display: block; font-size: var(--sw-fs-sm); color: var(--sw-text-2); margin-block-start: 2px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-rows: max-content; gap: 8px; flex: 1; min-block-size: 0; align-content: start; overflow: hidden; }
    .fitbox { container-type: inline-size; flex: 1; min-block-size: 0; display: flex; flex-direction: column; }
    @container (min-width: 760px) { .rows2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
    .row { flex-wrap: wrap; min-block-size: 58px; padding-block: 8px; gap: 8px 12px; }
    .row .ctl { display: flex; align-items: center; gap: 8px; flex: none; max-inline-size: 100%; }
    .reset { font: inherit; font-size: var(--sw-fs-xs); color: var(--sw-accent-text); background: none; border: 0; cursor: pointer; padding: 2px 4px; }
    .stepper { display: inline-flex; align-items: center; gap: 4px; }
    .stepper button { inline-size: 32px; block-size: 32px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading);
      font: inherit; font-size: var(--sw-fs-lg); cursor: pointer; display: grid; place-items: center; padding: 0; }
    .stepper button[disabled] { opacity: var(--sw-disabled-opacity); cursor: default; }
    .stepper input { inline-size: 60px; text-align: center; font: inherit; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); border: 0;
      background: transparent; font-variant-numeric: tabular-nums; -moz-appearance: textfield; appearance: textfield; }
    .stepper input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .def { color: var(--sw-accent-text); background: var(--sw-accent-soft); }
    table.t { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    table.t th { text-align: start; font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); font-size: var(--sw-fs-xs); padding: 8px 10px; border-block-end: 1px solid var(--sw-border); white-space: nowrap; }
    table.t td { padding: 8px 10px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; color: var(--sw-text); }
    table.t tr:last-child td { border-block-end: 0; }
    table.t .n { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    table.t select.inp { min-block-size: 34px; font-size: var(--sw-fs-sm); inline-size: auto; max-inline-size: 220px; }
    .cname { display: flex; align-items: center; gap: 8px; min-inline-size: 0; max-inline-size: 260px; }
    .danger { background: var(--sw-danger-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-danger) 40%, transparent); }
    .banner { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-warning-soft); font-size: var(--sw-fs-sm); }
    .banner b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .banner sw-icon { color: var(--sw-warning-text); flex: none; }
    .err { background: var(--sw-danger-soft); color: var(--sw-danger-text); padding: 8px 12px; border-radius: var(--sw-r-md); font-size: var(--sw-fs-sm); }
    .ro { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .dlg p { margin: 0 0 10px; }
    .typed { display: grid; gap: 6px; margin-block-start: 10px; }
    .typed .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .toast { position: fixed; inset-block-end: 24px; inset-inline-start: 50%; transform: translateX(50%); background: var(--sw-toast-bg); color: var(--sw-toast-text); padding: 10px 16px;
      border-radius: var(--sw-r-pill); font-size: var(--sw-fs-md); z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-3); max-inline-size: calc(100vw - 32px); }
    .rolechips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; flex: none; }
    .rolechips .row { min-block-size: 0; flex-direction: column; align-items: flex-start; gap: 2px; }
    .linkrow { text-decoration: none; color: inherit; }
    @media (max-width: 1179px) { .rolechips { display: none; } }
    @media (max-width: 699px) {
      :host { padding: 10px var(--sw-page-pad-phone); gap: 10px; }
      .panel { padding: 12px; gap: 10px; }
      .twocol { grid-template-columns: minmax(0, 1fr); gap: 12px; align-content: start; }
      .col { gap: 5px; }
      .opt { padding: 9px 12px; align-items: center; }
      .opt small { display: none; }
      .opt .rad { margin-block-start: 0; }
      .wide-only { display: none; }
      .tabs { align-self: stretch; }
      .tabs button { flex: 1; padding: 6px 2px; }
      .row .ctl { inline-size: 100%; }
      .row .seg { flex-wrap: wrap; border-radius: var(--sw-r-lg); }
      .lead { display: none; }
      .crumb { display: none; }
      .tabhead { flex-direction: column; align-items: stretch; }
      .toast { inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom)); }
    }
  `];p([H({attribute:!1})],d.prototype,"route",2);p([c()],d.prototype,"s",2);p([c()],d.prototype,"canEdit",2);p([c()],d.prototype,"cals",2);p([c()],d.prototype,"error",2);p([c()],d.prototype,"saveError",2);p([c()],d.prototype,"page",2);p([c()],d.prototype,"per",2);p([c()],d.prototype,"draftRetention",2);p([c()],d.prototype,"confirm",2);p([c()],d.prototype,"typed",2);p([c()],d.prototype,"toastText",2);p([c()],d.prototype,"phone",2);p([c()],d.prototype,"group",2);d=p([C("system-calendars")],d);export{z as BEHAVIOR_GROUPS,y as BEHAVIOR_ROWS,x as CAL_DEFAULTS,d as SystemCalendars,V as defaultLabel};
//# sourceMappingURL=system-calendars-CosC9qJs.js.map
