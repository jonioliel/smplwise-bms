import{g as T,j as d,i as C,a as E,b as i,ek as y,A as l,k as L,aL as N,iO as D,iP as P,a2 as x,dM as H,iQ as M,eE as s,iR as U,iS as _,iT as j,iU as B,hq as k,aU as J,bi as W,bj as F}from"./index-koYOOmpL.js";import{g as V,s as q,a as G,b as w}from"./scenario-recipients-j7eJuvaW.js";import{s as R}from"./settings-DQrUiMx4.js";import"./sw-list-display-settings-BDKDrrJI.js";import{a as S,b as K,c as O,t as Q,R as Y,d as X,w as z,C as Z,e as ss,m as A,f as es}from"./automations-logic-DSpINKgH.js";import"./sw-logo-art-PLtEZJxU.js";import"./automations-glass-B16GpjJO.js";import"./glass-DZk1SKcG.js";var ts=Object.defineProperty,as=Object.getOwnPropertyDescriptor,b=(e,a,t,r)=>{for(var n=r>1?void 0:r?as(a,t):a,o=e.length-1,c;o>=0;o--)(c=e[o])&&(n=(r?c(a,t,n):c(n))||n);return r&&n&&ts(a,t,n),n};const is=[["scenarios.enabled","setEnabled"],["scenarios.kill_switch","setKill"],["scenarios.actions.notify","setActNotify"],["scenarios.actions.create_ticket","setActTicket"],["scenarios.actions.set_flag","setActFlag"],["scenarios.degraded_notice","setDegraded"]],rs=[["scenarios.max_fires_per_day","setMaxFires",1,1e3],["scenarios.max_tickets_per_day","setMaxTickets",0,200],["scenarios.max_actions_per_hour","setMaxHour",10,5e3],["scenarios.max_rules","setMaxRules",1,500],["scenarios.tick_s","setTick",10,300],["scenarios.test_per_min","setTestPerMin",1,120],["scenarios.runs_keep_days","setKeep",7,365]];let m=class extends C{constructor(){super(...arguments),this.saved=null,this.draft={},this.unavailable=!1,this.msg="",this.err="",this.busy=!1,this.choices=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=await V();this.saved=e.settings,this.draft={...e.settings},q().then(a=>this.choices=a).catch(()=>{})}catch{this.unavailable=!0}}set(e,a){this.draft={...this.draft,[e]:a},this.msg="",this.err=""}changes(){const e={};for(const[a,t]of Object.entries(this.draft))JSON.stringify(t)!==JSON.stringify(this.saved?.[a])&&(e[a]=t);return e}async save(){const e=this.changes();if(Object.keys(e).length){this.busy=!0;try{const a=await G(e);this.saved=a.settings,this.draft={...a.settings},this.msg=w("setSaved")}catch(a){this.err=a instanceof E?`${w("setInvalid")}: ${String(a.body.details?.key??"")}`:String(a)}finally{this.busy=!1}}}windowRow(){const e=this.draft["scenarios.work_window"]??{days:[6,0,1,2,3],from:"08:00",to:"17:00"},a=w("dayNames").split(","),t=r=>{const n=e.days.includes(r)?e.days.filter(o=>o!==r):[...e.days,r].sort();n.length&&this.set("scenarios.work_window",{...e,days:n})};return i`<label>${w("setWindow")}<span class="row"><span class="days">${[6,0,1,2,3,4,5].map(r=>i`<button type="button" aria-pressed=${String(e.days.includes(r))} @click=${()=>t(r)}>${a[r]}</button>`)}</span>
      <input type="time" lang=${y()} .value=${e.from} @change=${r=>this.set("scenarios.work_window",{...e,from:r.target.value})} />
      <input type="time" lang=${y()} .value=${e.to} @change=${r=>this.set("scenarios.work_window",{...e,to:r.target.value})} /></span></label>`}render(){if(this.unavailable||!this.saved)return l;const e=this.draft["scenarios.default_recipients"]??{users:[],roles:[]},a=Object.keys(this.changes()).length>0;return i`<sw-card heading=${w("setTitle")} data-scenario-settings>
      <div class="grid">
        ${is.map(([t,r])=>i`<div class="row"><span>${w(r)}</span><sw-toggle data-key=${t} .checked=${this.draft[t]===!0} @change=${n=>this.set(t,n.detail.checked)}></sw-toggle></div>`)}
        ${rs.map(([t,r,n,o])=>i`<label>${w(r)}<input type="number" data-key=${t} min=${n} max=${o} .value=${String(this.draft[t]??"")} @change=${c=>this.set(t,Number(c.target.value))} /></label>`)}
        <label>${w("setAfterSource")}<select data-key="scenarios.after_hours_source" @change=${t=>this.set("scenarios.after_hours_source",t.target.value)}>
          <option value="window" ?selected=${this.draft["scenarios.after_hours_source"]!=="calendar"}>${w("setAfterWindow")}</option>
          <option value="calendar" ?selected=${this.draft["scenarios.after_hours_source"]==="calendar"}>${w("setAfterCalendar")}</option></select></label>
        ${this.windowRow()}
        <label>${w("setRecipients")}<scenario-recipients data-key="scenarios.default_recipients" .choices=${this.choices} .value=${e}
          @change=${t=>this.set("scenarios.default_recipients",t.detail.value)}></scenario-recipients></label>
      </div>
      <div class="bar">${this.err?i`<span class="err" role="alert">${this.err}</span>`:this.msg?i`<span class="ok" role="status">${this.msg}</span>`:l}
        <sw-button variant="primary" icon="check" data-scenario-settings-save ?disabled=${!a||this.busy} @click=${()=>void this.save()}>${w("setSave")}</sw-button></div>
    </sw-card>`}};m.styles=[R,T`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; }
    label { display: grid; gap: 4px; font-size: var(--sw-fs-sm, 13px); }
    input, select { font: inherit; padding: 4px 8px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: var(--sw-surface); color: inherit; }
    .row { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
    .days { display: inline-flex; gap: 2px; }
    .days button { min-inline-size: 28px; border-radius: var(--sw-r-xs); border: 1px solid var(--sw-border); background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .days button[aria-pressed='true'] { background: var(--sw-accent-soft); }
    .bar { display: flex; gap: 8px; align-items: center; justify-content: flex-end; margin-block-start: 10px; }
    .err { color: var(--sw-danger); } .ok { color: var(--sw-success); }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  `];b([d()],m.prototype,"saved",2);b([d()],m.prototype,"draft",2);b([d()],m.prototype,"unavailable",2);b([d()],m.prototype,"msg",2);b([d()],m.prototype,"err",2);b([d()],m.prototype,"busy",2);b([d()],m.prototype,"choices",2);m=b([L("scenario-settings")],m);var ns=Object.defineProperty,os=Object.getOwnPropertyDescriptor,h=(e,a,t,r)=>{for(var n=r>1?void 0:r?os(a,t):a,o=e.length-1,c;o>=0;o--)(c=e[o])&&(n=(r?c(a,t,n):c(n))||n);return r&&n&&ns(a,t,n),n};const f=e=>JSON.parse(JSON.stringify(e)),I="sw.automations.templates.v1";function ls(){try{const e=JSON.parse(window.localStorage.getItem(I)??"[]");return Array.isArray(e)?e.filter(a=>a&&typeof a.id=="string"):[]}catch{return[]}}function ds(e){try{window.localStorage.setItem(I,JSON.stringify(e))}catch{}}const cs=(e,a)=>JSON.stringify(e)===JSON.stringify(a);let p=class extends C{constructor(){super(...arguments),this.bubbleSkin=new N(this),this.phase="loading",this.status=null,this.saved=f(k),this.draft=f(k),this.templates=[],this.notify=[],this.review=[],this.compat=null,this.trash=[],this.error="",this.note="",this.busy=!1,this.trashOpen=!1,this.now=new Date,this.candidates=[],this.noteTimer=0,this.offClock=null}connectedCallback(){super.connectedCallback(),this.load(),this.offClock=D(()=>this.now=S())}disconnectedCallback(){super.disconnectedCallback(),this.offClock?.(),this.offClock=null,window.clearTimeout(this.noteTimer)}get dirty(){return!cs(this.draft,this.saved)}async load(){this.error="",await K(),this.now=S();try{const e=O(),a=await e.status();if(this.status=a,!a.can.configure){this.phase="forbidden";return}const[t,r,n,o,c,u]=await Promise.all([e.settings(),e.templates().catch(()=>({templates:[]})),e.review().catch(()=>[]),e.trash().catch(()=>[]),e.catalog().catch(()=>null),e.compat().catch(()=>null)]);this.compat=u,this.saved=t,this.draft=f(t);const $=r.templates.map(g=>({id:g.id,name:g.name,suggest_schedule:g.suggest_schedule})),v=ls();ds([...new Map([...v,...$].map(g=>[g.id,g])).values()]),this.templates=Q($,v,t.templates_hidden),this.review=n,this.trash=o,this.notify=c?.notify_targets??[],this.candidates=(c?.entities??[]).map(g=>g.entity_id),this.phase="ready"}catch(e){e instanceof E&&e.status===403?this.phase="forbidden":(this.error=P(e).message,this.phase="error")}}say(e){this.note=e,window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",3500)}set(e){this.draft={...this.draft,...e},this.note=""}setLimit(e,a){this.set({limits:{...this.draft.limits,[e]:a}})}async save(){if(!(this.busy||!this.dirty)){this.busy=!0,this.error="";try{const e=await O().saveSettings(this.draft,this.saved);this.saved=e,this.draft=f(e),x()&&H(),M({"automations.enabled":String(e.enabled)}),this.say(s("נשמר"))}catch(e){this.error=U(e)}finally{this.busy=!1}}}stepper(e,a,t,r,n,o,c,u=1){return i`<div class="stepper" role="group" aria-label=${c}>
      <button type="button" aria-label=${s("פחות")} data-step-minus=${e} ?disabled=${a<=r} @click=${()=>o(Math.max(r,a-u))}><sw-icon name="minus" size=${16}></sw-icon></button>
      <span class="v" data-setting=${e}><bdi>${a}</bdi>${t?i`<small>${t}</small>`:l}</span>
      <button type="button" aria-label=${s("יותר")} data-step-plus=${e} ?disabled=${a>=n} @click=${()=>o(Math.min(n,a+u))}><sw-icon name="plus" size=${16}></sw-icon></button>
    </div>`}tog(e,a,t,r){return i`<sw-toggle label=${e} labelHidden .checked=${a} data-toggle=${r} @change=${n=>t(n.detail.checked)}></sw-toggle>`}row(e,a,t){return i`<div class="row"><div class="lbl"><span>${e}</span>${a?i`<span class="muted">${a}</span>`:l}</div><div>${t}</div></div>`}who(){const e=t=>t?i`<sw-icon class="yes" name="check" size=${16} role="img" aria-label=${s("כן")}></sw-icon>`:i`<span class="no" aria-label=${s("לא")}>—</span>`,a=(t,r)=>r!==null?r:this.draft.code_view_roles.includes(t);return i`<sw-card heading=${s("מי רשאי")} data-card="who">
      <table class="mtx set-matrix" data-roles-matrix>
        <thead><tr><th scope="col">${s("תפקיד")}</th><th scope="col" class="c">${s("הפעלה")}</th><th scope="col" class="c">${s("יצירה ועריכה")}</th><th scope="col" class="c">${s("קוד")}</th>${this.draft.device_test_enabled?i`<th scope="col" class="c" data-col-device-test>${s("בדיקה על ההתקן")}</th>`:l}</tr></thead>
        <tbody>${Y.map(t=>i`<tr data-role=${t.id}><td>${t.label}${t.scope?i`<small>${t.scope}</small>`:l}</td><td class="c">${e(t.run)}</td><td class="c">${e(t.edit)}</td><td class="c">${e(a(t.id,t.codeFixed))}</td>${this.draft.device_test_enabled?i`<td class="c">${e(t.run&&t.edit)}</td>`:l}</tr>`)}</tbody>
      </table>
      ${this.row(s("הרשאות ותפקידים"),s('ההקצאה למשתמשים ולקומות במסך "משתמשים והרשאות".'),i`<a class="link" href="#/system/access" data-link-access>${s("למסך המשתמשים")}</a>`)}
    </sw-card>`}wallButtons(){const e=this.draft,a=_,t=(r,n,o,c)=>{const[u,$]=a[r];return this.stepper(r,e[r],n,u,$,v=>this.set({[r]:v}),o,c)};return i`<sw-card heading=${s("כפתורי קיר ומתגים")} data-card="wall-buttons">
      ${this.row(s("פתוח לעריכה בבונה"),s("כפתורי קיר ומתגים בלבד בגרסה הראשונה"),this.tog(s("פתוח לעריכה בבונה"),e.wall_buttons_editable,r=>this.set({wall_buttons_editable:r}),"wall_buttons_editable"))}
      ${e.wall_buttons_editable?i`
        ${this.row(s("חלון לחיצה כפולה"),s("הזמן המרבי בין שתי לחיצות"),t("wall_double_ms",s("מ״ש"),s("חלון לחיצה כפולה"),50))}
        ${this.row(s("לחיצה ארוכה מתחילה אחרי"),"",t("wall_long_ms",s("מ״ש"),s("לחיצה ארוכה"),50))}
        ${this.row(s("התעלמות מרעידות מגע"),"",t("wall_debounce_ms",s("מ״ש"),s("רעידות מגע"),10))}
        ${this.row(s("זמן האזנה בזיהוי לחיצה"),"",t("wall_listen_s",s("שנ׳"),s("זמן האזנה"),5))}
        ${this.row(s("טריגרים ייעודיים (מתג נדלק וכד׳)"),s("לא בגרסה הראשונה"),i`<span class="tag" data-wall-purpose>${s("כבוי")}</span>`)}
        ${this.row(s("תבניות מתקדמות"),s("נשארות נעולות, נשמרות כמו שהן"),i`<span class="tag" data-wall-templates><sw-icon name="lock" size=${12}></sw-icon>${s("נעול")}</span>`)}`:l}
    </sw-card>`}prechecks(){const e=this.draft,[a,t]=_.conflict_window_min,r=(n,o,c,u)=>i`<sw-segmented label=${n} value=${o} .options=${c.map(([$,v])=>({value:$,label:v,attrs:{"data-seg":`${n}:${$}`}}))}
        @change=${$=>u($.detail.value)}></sw-segmented>`;return i`<sw-card heading=${s("בדיקות לפני שמירה")} data-card="prechecks">
      ${this.row(s("בדיקות לפני שמירה"),s("התנגשויות, התקן לא זמין, כפתור שכבר בשימוש"),this.tog(s("בדיקות לפני שמירה"),e.precheck_enabled,n=>this.set({precheck_enabled:n}),"precheck_enabled"))}
      ${e.precheck_enabled?i`
        ${this.row(s("חלון זיהוי התנגשות"),s("פעולות הפוכות על אותו התקן, בין תזמונים ואוטומציות"),this.stepper("conflict_window_min",e.conflict_window_min,s("דק׳"),a,t,n=>this.set({conflict_window_min:n}),s("חלון זיהוי התנגשות")))}
        ${this.row(s('לאפשר "שמירה עם אזהרות"'),s("שגיאה חוסמת תמיד"),this.tog(s("שמירה עם אזהרות"),e.save_with_warnings,n=>this.set({save_with_warnings:n}),"save_with_warnings"))}
        ${this.row(s("כפתור שכבר משמש פריט אחר"),s("אותה לחיצה מפעילה שני פריטים"),r("button_reuse",e.button_reuse,[["warn",s("אזהרה")],["error",s("שגיאה")]],n=>this.set({button_reuse:n})))}`:l}
      ${this.row(s("בדיקה על ההתקן"),s("למי שמורשה לערוך וגם להפעיל ידנית"),this.tog(s("בדיקה על ההתקן"),e.device_test_enabled,n=>this.set({device_test_enabled:n}),"device_test_enabled"))}
      ${e.device_test_enabled?i`
        ${this.row(s("בדיקה על ההתקן: בסיום"),s("מה קורה להתקנים שהופעלו בבדיקה"),r("device_test_end",e.device_test_end,[["ask",s("לשאול")],["restore",s("להחזיר")],["keep",s("להשאיר")]],n=>this.set({device_test_end:n})))}
        ${this.row(s("בדיקה על ההתקן לפעולה רגישה"),s("כמו היום: לפי הרשאת הפעלה ידנית"),i`<span class="tag" data-device-test-sensitive><sw-icon name="lock" size=${12}></sw-icon>${s("לפי הרשאה")}</span>`)}`:l}
      ${this.row(s('"מי במבנה" באוטומציות'),s("החיישן שמדווח אם יש מישהו במבנה"),i`<select class="sel" aria-label=${s("מי במבנה")} data-presence-entity @change=${n=>this.set({presence_entity:n.target.value})}>
        <option value="" ?selected=${!e.presence_entity}>${s("כבוי")}</option>
        ${this.presenceCandidates().map(n=>i`<option value=${n} ?selected=${n===e.presence_entity}>${n}</option>`)}</select>`)}
    </sw-card>`}presenceCandidates(){const e=this.candidates.filter(a=>/^(binary_sensor|input_boolean)\./.test(a));return this.draft.presence_entity&&!e.includes(this.draft.presence_entity)?[this.draft.presence_entity,...e]:e}delegation(){const e=this.status;if(!e)return l;const a=X(e),t=e.admin?.delegation_changed_at?z(e.admin.delegation_changed_at,this.now):"",r=this.review.filter(n=>n.issue==="delegated_write").length;return i`<sw-card heading=${s("האצלה לבני בית שאינם מנהלי Home Assistant")} data-card="delegation">
      ${this.row(s("מתג ההאצלה ברכיב החיבור"),`${a.label}${t?` · ${s("שונה {time}",{time:t})}`:""} · ${s("מאפשר שמירה של תוכן העורך הפשוט בלבד")}`,i`<span class=${`tag ${a.state==="on"?"ok":""}`} data-delegation-state=${a.state}>${a.label}</span>`)}
      ${this.row(s("איפה משנים"),s("Home Assistant ‹ הגדרות ‹ התקנים ושירותים ‹ Arx Bridge ‹ אפשרויות. לא ניתן לשינוי מכאן."),i`<span class="tag" data-delegation-readonly><sw-icon name="lock" size=${12}></sw-icon>${s("לקריאה בלבד")}</span>`)}
      ${this.row(s("כתיבות מואצלות"),s("{n} ברשימת הסקירה",{n:r}),r?i`<a class="link" href="#review" data-link-review @click=${n=>{n.preventDefault(),this.renderRoot.querySelector('[data-card="review"]')?.scrollIntoView({block:"center"})}}>${s("לסקירה")}</a>`:l)}
    </sw-card>`}codeView(){return i`<sw-card heading=${s("תצוגת קוד")} data-card="code">
      ${this.row(s('מי רואה את המתג "בונה · קוד"'),s("הצד השני של אותו עורך. שמירת תוכן שאינו מהבונה דורשת מנהל Home Assistant בכל מקרה."),i`<div class="chipsrow" role="group" aria-label=${s("תפקידים")}>${Z.map(e=>{const a=this.draft.code_view_roles.includes(e.id)||e.locked;return i`<button type="button" class="rc" aria-pressed=${String(a)} ?disabled=${e.locked} data-code-role=${e.id} @click=${()=>this.set({code_view_roles:ss(this.draft.code_view_roles,e.id)})}><sw-icon name=${a?"check":"plus"} size=${14}></sw-icon>${e.label}</button>`})}</div>`)}
    </sw-card>`}retention(){const e=this.draft,[a,t]=_.trash_days,[r,n]=_.versions_keep;return i`<sw-card heading=${s("סל מחזור והיסטוריה")} data-card="retention">
      ${this.row(s("שמירה בסל המחזור"),s("פריט שנמחק ניתן לשחזור עם אותו מזהה"),this.stepper("trash_days",e.trash_days,s("ימים"),a,t,o=>this.set({trash_days:o}),s("ימי שמירה בסל המחזור")))}
      ${this.row(s("גרסאות לכל פריט"),s("כולל שינויים שנעשו מחוץ למערכת"),this.stepper("versions_keep",e.versions_keep,s("גרסאות"),r,n,o=>this.set({versions_keep:o}),s("גרסאות לכל פריט")))}
      ${this.row(s("סל המחזור"),s("{n} פריטים",{n:this.trash.length}),i`<sw-button size="sm" icon="trash" data-open-trash @click=${()=>this.trashOpen=!0}>${s("פתח")}</sw-button>`)}
    </sw-card>`}limits(){const e=this.draft.limits,a=(t,r,n,o,c)=>this.stepper(t,e[t],r,n,o,u=>this.setLimit(t,u),c);return i`<sw-card heading=${s("מגבלות")} data-card="limits">
      ${this.row(s("שמירות לדקה למשתמש"),"",a("writes_per_min","",5,120,s("שמירות לדקה")))}
      ${this.row(s("תצוגות מקדימות לדקה"),"",a("preview_per_min","",10,240,s("תצוגות מקדימות לדקה")))}
      ${this.row(s("הרצה חוזרת של אותו פריט"),s("מרווח מינימלי"),a("run_interval_s",s("שנ׳"),3,60,s("מרווח הרצה")))}
      ${this.row(s("הפעלת סצנה חוזרת"),"",a("scene_apply_interval_s",s("שנ׳"),1,30,s("מרווח הפעלת סצנה")))}
      ${this.row(s("סערת הרצות · פריט"),s("התראה מעל {item} ריצות לדקה לפריט או {total} בסך הכל",{item:e.storm_item_per_min,total:e.storm_total_per_min}),a("storm_item_per_min",s("/דק׳"),5,100,s("סף לפריט")))}
      ${this.row(s("סערת הרצות · סך הכל"),"",a("storm_total_per_min",s("/דק׳"),50,1e3,s("סף כולל")))}
      ${this.row(s("כיבוי אוטומטי בסערה"),s("ברירת המחדל: התראה למנהל עם כיבוי בלחיצה"),this.tog(s("כיבוי אוטומטי בסערה"),this.draft.storm_auto_disable,t=>this.set({storm_auto_disable:t}),"storm_auto_disable"))}
    </sw-card>`}sensitive(){const e=new Set(this.draft.notify_targets);return i`<sw-card heading=${s("פעולות רגישות")} data-card="sensitive">
      ${this.row(s("הכלל"),s("אזעקה, מנעולים, דלתות, שערים וצופרים מותרים באוטומציות כמו כל פעולה, ועוברים את אותן בדיקות הרשאה כמו שליטה ידנית. קודים לעולם לא נשמרים."),i`<span class="tag ok"><sw-icon name="check" size=${12}></sw-icon>${s("החלטת הבעלים")}</span>`)}
      ${this.row(s("צ׳יפ אזהרה על צעד רגיש"),s("מוצג בעורך וברשימה"),this.tog(s("צ׳יפ אזהרה על צעד רגיש"),this.draft.sensitive_warning,a=>this.set({sensitive_warning:a}),"sensitive_warning"))}
      ${this.row(s("צבע הצ׳יפ"),s("צהוב או אדום"),i`<sw-segmented label=${s("צבע הצ׳יפ")} value=${this.draft.sensitive_chip} @change=${a=>this.set({sensitive_chip:a.detail.value})}
        .options=${[{value:"amber",label:s("צהוב"),attrs:{"data-sensitive-chip":"amber"}},{value:"red",label:s("אדום"),attrs:{"data-sensitive-chip":"red"}}]}></sw-segmented>`)}
      ${this.notify.length?i`<div class="row"><div class="lbl"><span>${s("יעדי התראה מאושרים")}</span><span class="muted">${s("רק אליהם אפשר לשלוח התראה מאוטומציה")}</span></div><div class="chipsrow" role="group" aria-label=${s("יעדי התראה")}>${this.notify.map(a=>{const t=e.has(a.name);return i`<button type="button" class="rc" aria-pressed=${String(t)} data-notify=${a.action} @click=${()=>this.set({notify_targets:t?this.draft.notify_targets.filter(r=>r!==a.name):[...this.draft.notify_targets,a.name]})}>${t?i`<sw-icon name="check" size=${14}></sw-icon>`:l}${a.name}</button>`})}</div></div>`:l}
    </sw-card>`}gallery(){const e=new Set(this.draft.templates_hidden),a=this.orderedTemplates();return i`<sw-card heading=${s("גלריית תבניות")} data-card="templates">
      ${this.row(s("גלריה פעילה"),s('מוצגת בלחיצה על "חדש"'),this.tog(s("גלריה פעילה"),this.draft.templates_enabled,t=>this.set({templates_enabled:t}),"templates_enabled"))}
      ${a.map((t,r)=>i`<div class=${`tpl${e.has(t.id)?" off":""}`} data-template=${t.id}>
        <span class="nm">${t.name}${t.suggest_schedule?i` <span class="tag"><sw-icon name="calendar" size=${12}></sw-icon>${s("גם כתזמון")}</span>`:l}</span>
        <button type="button" class="ib" aria-label=${`${s("הקדם")} · ${t.name}`} data-template-up=${t.id} ?disabled=${r===0} @click=${()=>this.set({templates_order:A(a.map(n=>n.id),t.id,-1)})}><sw-icon name="arrowUp" size=${16}></sw-icon></button>
        <button type="button" class="ib" aria-label=${`${s("אחר")} · ${t.name}`} data-template-down=${t.id} ?disabled=${r===a.length-1} @click=${()=>this.set({templates_order:A(a.map(n=>n.id),t.id,1)})}><sw-icon name="arrowDown" size=${16}></sw-icon></button>
        ${this.tog(`${s("הצגה")} · ${t.name}`,!e.has(t.id),()=>this.set({templates_hidden:es(this.draft.templates_hidden,t.id)}),`tpl-${t.id}`)}
      </div>`)}
    </sw-card>`}orderedTemplates(){const e=new Map(this.draft.templates_order.map((a,t)=>[a,t]));return[...this.templates].sort((a,t)=>(e.get(a.id)??999)-(e.get(t.id)??999))}display(){return i`<sw-card heading=${s("הצגה")} data-card="display">
      ${this.row(s("מסנן בטלפון"),s('מקופל: "סינון" אחד · שורות: כל הבקרים מוצגים'),i`<sw-segmented label=${s("מסנן בטלפון")} value=${this.draft.phone_filter} @change=${e=>this.set({phone_filter:e.detail.value})}
        .options=${[{value:"fold",label:s("מקופל"),attrs:{"data-phone-filter":"fold"}},{value:"rows",label:s("שורות"),attrs:{"data-phone-filter":"rows"}}]}></sw-segmented>`)}
      ${this.row(s('"+ חדש" אחד ששואל "מתי?"'),s('"בשעות קבועות" פותח תזמון חדש; "כשמשהו קורה" פותח את הבונה. כבוי = לכל לשונית הכפתור שלה.'),this.tog(s("חדש ששואל מתי"),this.draft.ask_when_on_new,e=>this.set({ask_when_on_new:e}),"ask_when_on_new"))}
    </sw-card>`}platform(){const e=this.status?.admin;if(!e)return l;const a=!!e.bridge_version&&e.bridge_version>=e.bridge_required;return i`<sw-card heading=${s("מצב")} data-card="status">
      ${this.row("Home Assistant",`${e.ha_version} · ${s("ממשק התצורה {state}",{state:e.config_api==="ok"?s("זמין"):s("לא זמין")})}`,i`<span class=${`tag ${e.config_api==="ok"?"ok":"warn"}`}>${e.config_api==="ok"?s("תקין"):s("לא זמין")}</span>`)}
      ${this.row("Arx Bridge",e.bridge_version?`${e.bridge_version} (${s("נדרש {version}+",{version:e.bridge_required})})`:s("לא מותקן"),i`<span class=${`tag ${a?"ok":"warn"}`}>${a?s("תקין"):s("דורש עדכון")}</span>`)}
      ${this.status?.last_sync_at?this.row(s("סנכרון אחרון"),z(this.status.last_sync_at,this.now),l):l}
      ${this.row(s("האוטומציות במוצר"),s("כיבוי מסתיר את הלשונית לכולם"),this.tog(s("האוטומציות במוצר"),this.draft.enabled,t=>this.set({enabled:t}),"enabled"))}
    </sw-card>`}reviewCard(){return i`<sw-card heading=${s("סקירה")} data-card="review">
      ${this.review.length?this.review.map(e=>i`<div class="rev" data-review=${`${e.kind}:${e.id}:${e.issue}`}><span class="tag warn">${j[e.issue]}</span><a href=${`#/devices/automations/${e.kind==="automation"?"":`${e.kind==="script"?"scripts":"scenes"}/`}${encodeURIComponent(e.id)}`}>${e.name}</a><span class="muted">${e.detail}</span></div>`):i`<div class="muted" data-review-empty>${s("אין פריטים לסקירה")}</div>`}
    </sw-card>`}compatCard(){const e=this.compat;if(!e||!e.items.length)return l;const a=(t,r)=>`#/devices/automations/${t==="automation"?"":`${t==="script"?"scripts":"scenes"}/`}${encodeURIComponent(r)}`;return i`<sw-card heading=${s("תאימות לתשתית המערכת 2026.10")} data-card="compat">
      <div class="muted" data-compat-summary>${e.items.length===1?s("פריט אחד דורש תיקון לפני השדרוג."):s("{n} פריטים דורשים תיקון לפני השדרוג.",{n:e.items.length})} ${s("הבדיקה קוראת בלבד.")}</div>
      ${e.items.map(t=>i`<div class="rev cmp" data-compat=${`${t.kind}:${t.id}`}>
        ${[...new Set(t.issues.map(r=>r.code))].map(r=>i`<span class="tag warn" data-compat-code=${r}>${B[r]}</span>`)}
        <a href=${a(t.kind,t.id)}>${t.name}</a>
        <span class="muted">${t.issues.some(r=>r.code==="admin_only_service")?i`${s("הפעלה ידנית תיכשל למי שאינו מנהל")} (<bdi>${t.issues.find(r=>r.service)?.service??""}</bdi>)`:s("ייכשל בבדיקת התצורה ולא יפעל")}</span>
      </div>`)}
      ${e.truncated?i`<div class="muted">${s("מוצגים הפריטים הראשונים בלבד.")}</div>`:l}
    </sw-card>`}render(){return this.phase==="loading"?i`<sw-page crumbs=${s("הגדרות")} heading=${s("אוטומציות")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`:this.phase==="error"?i`<sw-page crumbs=${s("הגדרות")} heading=${s("אוטומציות")}><sw-state-panel state="error" hint=${this.error} actionLabel=${s("נסו שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`:this.phase==="forbidden"?i`<sw-page crumbs=${s("הגדרות")} heading=${s("אוטומציות")}><sw-state-panel state="forbidden" heading=${s("אין הרשאה")} data-automations-settings-forbidden></sw-state-panel></sw-page>`:i`<sw-page crumbs=${s("הגדרות")} heading=${s("אוטומציות")} subheading=${s("כל אפשרות של האוטומציות, הסצנות והסקריפטים נמצאת כאן בלבד.")} wide data-automations-settings>
      <div class="cols">
        <div class="col set-col">${this.platform()}${this.wallButtons()}${this.codeView()}${this.who()}${this.retention()}${this.display()}<sw-list-display-settings list="automations"></sw-list-display-settings></div>
        <div class="col set-col">${this.prechecks()}${this.compatCard()}${this.delegation()}${this.limits()}${this.sensitive()}${this.gallery()}${this.reviewCard()}${x()?i`<scenario-settings></scenario-settings>`:l}</div>
      </div>
      ${this.dirty||this.note||this.error?i`<div class="savebar" data-settings-bar>
            ${this.error?i`<span class="msg err" role="alert" data-settings-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:this.note?i`<span class="msg ok" role="status" data-settings-saved><sw-icon name="check" size=${13}></sw-icon>${this.note}</span>`:i`<span class="dirty">${s("יש שינויים שלא נשמרו.")}</span>`}
            <span class="grow"></span>
            ${this.dirty?i`<sw-button variant="ghost" data-settings-cancel @click=${()=>{this.draft=f(this.saved),this.error=""}}>${s("ביטול")}</sw-button><sw-button variant="primary" icon="check" data-settings-save ?disabled=${this.busy} @click=${()=>void this.save()}>${this.busy?s("שומר…"):s("שמירה")}</sw-button>`:l}
          </div>`:l}
      <automation-drawer .trash=${!0} .open=${this.trashOpen} .status=${this.status} .now=${this.now} @drawer-close=${()=>{this.trashOpen=!1,this.load()}}></automation-drawer>
    </sw-page>`}};p.styles=[R,T`
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--sw-s-3);
      align-items: start;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .row {
      flex-wrap: wrap;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-block-size: 24px;
      padding: 0 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .tag.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .tag.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-warning-text);
    }
    /* SCHED-POLISH-2331 -> SHARED-POLISH-2342: the role matrix is the shared table.set-matrix of styles/settings.ts (header in text-2 /
       600, the role name in the heading ink); only its foot margin and the link stay here */
    table.mtx {
      margin-block-end: var(--sw-s-3);
    }
    .mtx .c {
      text-align: center;
      inline-size: 72px;
    }
    .yes {
      color: var(--sw-success-text);
    }
    .no {
      color: var(--sw-text-3);
    }
    .chipsrow {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .rc {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: 12px 14px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    /* AUDIT30-I2 (#4, owner Q3 option a): the chosen chip is the Blue Wash pair */
    .rc[aria-pressed='true'] {
      ${W}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .rc[aria-pressed='true']::before {
      ${F}
    }
    .rc:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .rc:focus-visible,
    .ib:focus-visible,
    .stepper button:focus-visible,
    .link:focus-visible,
    .rev a:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset, 2px);
      border-radius: var(--sw-r-sm);
    }
    .stepper {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
    }
    .stepper button {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      cursor: pointer;
      color: var(--sw-text);
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .stepper button:active:not(:disabled),
    .ib:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .stepper button:hover:not(:disabled),
      .ib:hover:not(:disabled) {
        background: var(--sw-hover-wash);
      }
    }
    .stepper button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .stepper .v {
      min-inline-size: 70px;
      text-align: center;
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .stepper .v small {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
      margin-inline-start: 4px;
    }
    .tpl {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
    }
    .tpl:last-child {
      border-block-end: 0;
    }
    .tpl.off .nm {
      opacity: 0.55;
    }
    .tpl .nm {
      flex: 1;
      min-inline-size: 0;
    }
    .ib {
      display: inline-grid;
      place-items: center;
      flex: none;
      inline-size: 34px;
      block-size: 34px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
    }
    /* the presence picker: the settings' select look (it had a class and no rule, so it rendered as the browser's default) */
    select.sel {
      min-block-size: 36px;
      max-inline-size: 260px;
      padding: 0 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      direction: ltr;
    }
    select.sel:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    @media (pointer: coarse) {
      .ib,
      .stepper button {
        inline-size: 44px;
        block-size: 44px;
      }
      .rc,
      select.sel {
        min-block-size: 44px;
      }
    }
    .rev {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .rev:last-child {
      border-block-end: 0;
    }
    .rev.cmp {
      flex-wrap: wrap;
      row-gap: 4px;
    }
    .rev.cmp > .muted {
      flex: 1 1 100%;
    }
    .rev a {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: var(--sw-fw-semibold);
    }
    .rev a:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      text-decoration: none;
    }
    .savebar {
      margin-block-start: var(--sw-s-3);
      max-inline-size: none;
    }
    /* SCHED-POLISH-2331 -> SHARED-POLISH-2342: a column narrower than a label plus a 240 px control stacks its rows (the label above
       the control) - the shared .set-col of styles/settings.ts (the side column at 1440 / 1180) */
    @media (max-width: 1023px) {
      .cols {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      select.sel {
        max-inline-size: none;
        inline-size: 100%;
      }
      .mtx .c {
        inline-size: auto;
      }
    }
  `,J];h([d()],p.prototype,"phase",2);h([d()],p.prototype,"status",2);h([d()],p.prototype,"saved",2);h([d()],p.prototype,"draft",2);h([d()],p.prototype,"templates",2);h([d()],p.prototype,"notify",2);h([d()],p.prototype,"review",2);h([d()],p.prototype,"compat",2);h([d()],p.prototype,"trash",2);h([d()],p.prototype,"error",2);h([d()],p.prototype,"note",2);h([d()],p.prototype,"busy",2);h([d()],p.prototype,"trashOpen",2);h([d()],p.prototype,"now",2);h([d()],p.prototype,"candidates",2);p=h([L("system-automations")],p);export{p as SystemAutomations};
