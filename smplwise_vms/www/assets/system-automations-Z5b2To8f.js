import{g7 as A,E as C,G as c,a as T,j as E,e as a,bP as _,A as o,H as L,S as I,cI as N,hb as y,fn as P,fo as x,gK as H,i as k,g8 as D,hg as M,gc as j,hh as f,hi as J,hj as U,hk as S,C as B}from"./index-CNy_qMuw.js";import{x as K,a as V,y as W,b as h}from"./scenario-recipients-BlEw7QM3.js";import"./sw-list-display-settings-T5vsF9v5.js";import{K as F,R as G,L as q,M as z,P as Q,Q as Y,T as O,U as X}from"./automations-logic-CdnXKwxc.js";import"./sw-logo-art-Va6y_cIM.js";var Z=Object.defineProperty,ss=Object.getOwnPropertyDescriptor,b=(s,e,t,i)=>{for(var r=i>1?void 0:i?ss(e,t):e,n=s.length-1,d;n>=0;n--)(d=s[n])&&(r=(i?d(e,t,r):d(r))||r);return i&&r&&Z(e,t,r),r};const ts=[["scenarios.enabled","setEnabled"],["scenarios.kill_switch","setKill"],["scenarios.actions.notify","setActNotify"],["scenarios.actions.create_ticket","setActTicket"],["scenarios.actions.set_flag","setActFlag"],["scenarios.degraded_notice","setDegraded"]],es=[["scenarios.max_fires_per_day","setMaxFires",1,1e3],["scenarios.max_tickets_per_day","setMaxTickets",0,200],["scenarios.max_actions_per_hour","setMaxHour",10,5e3],["scenarios.max_rules","setMaxRules",1,500],["scenarios.tick_s","setTick",10,300],["scenarios.test_per_min","setTestPerMin",1,120],["scenarios.runs_keep_days","setKeep",7,365]];let u=class extends T{constructor(){super(...arguments),this.saved=null,this.draft={},this.unavailable=!1,this.msg="",this.err="",this.busy=!1,this.choices=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const s=await K();this.saved=s.settings,this.draft={...s.settings},V().then(e=>this.choices=e).catch(()=>{})}catch{this.unavailable=!0}}set(s,e){this.draft={...this.draft,[s]:e},this.msg="",this.err=""}changes(){const s={};for(const[e,t]of Object.entries(this.draft))JSON.stringify(t)!==JSON.stringify(this.saved?.[e])&&(s[e]=t);return s}async save(){const s=this.changes();if(Object.keys(s).length){this.busy=!0;try{const e=await W(s);this.saved=e.settings,this.draft={...e.settings},this.msg=h("setSaved")}catch(e){this.err=e instanceof E?`${h("setInvalid")}: ${String(e.body.details?.key??"")}`:String(e)}finally{this.busy=!1}}}windowRow(){const s=this.draft["scenarios.work_window"]??{days:[6,0,1,2,3],from:"08:00",to:"17:00"},e=h("dayNames").split(","),t=i=>{const r=s.days.includes(i)?s.days.filter(n=>n!==i):[...s.days,i].sort();r.length&&this.set("scenarios.work_window",{...s,days:r})};return a`<label>${h("setWindow")}<span class="row"><span class="days">${[6,0,1,2,3,4,5].map(i=>a`<button type="button" aria-pressed=${String(s.days.includes(i))} @click=${()=>t(i)}>${e[i]}</button>`)}</span>
      <input type="time" lang=${_()} .value=${s.from} @change=${i=>this.set("scenarios.work_window",{...s,from:i.target.value})} />
      <input type="time" lang=${_()} .value=${s.to} @change=${i=>this.set("scenarios.work_window",{...s,to:i.target.value})} /></span></label>`}render(){if(this.unavailable||!this.saved)return o;const s=this.draft["scenarios.default_recipients"]??{users:[],roles:[]},e=Object.keys(this.changes()).length>0;return a`<sw-card heading=${h("setTitle")} data-scenario-settings>
      <div class="grid">
        ${ts.map(([t,i])=>a`<div class="row"><span>${h(i)}</span><sw-toggle data-key=${t} .checked=${this.draft[t]===!0} @change=${r=>this.set(t,r.detail.checked)}></sw-toggle></div>`)}
        ${es.map(([t,i,r,n])=>a`<label>${h(i)}<input type="number" data-key=${t} min=${r} max=${n} .value=${String(this.draft[t]??"")} @change=${d=>this.set(t,Number(d.target.value))} /></label>`)}
        <label>${h("setAfterSource")}<select data-key="scenarios.after_hours_source" @change=${t=>this.set("scenarios.after_hours_source",t.target.value)}>
          <option value="window" ?selected=${this.draft["scenarios.after_hours_source"]!=="calendar"}>${h("setAfterWindow")}</option>
          <option value="calendar" ?selected=${this.draft["scenarios.after_hours_source"]==="calendar"}>${h("setAfterCalendar")}</option></select></label>
        ${this.windowRow()}
        <label>${h("setRecipients")}<scenario-recipients data-key="scenarios.default_recipients" .choices=${this.choices} .value=${s}
          @change=${t=>this.set("scenarios.default_recipients",t.detail.value)}></scenario-recipients></label>
      </div>
      <div class="bar">${this.err?a`<span class="err" role="alert">${this.err}</span>`:this.msg?a`<span class="ok" role="status">${this.msg}</span>`:o}
        <sw-button variant="primary" icon="check" data-scenario-settings-save ?disabled=${!e||this.busy} @click=${()=>void this.save()}>${h("setSave")}</sw-button></div>
    </sw-card>`}};u.styles=[A,C`
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
  `];b([c()],u.prototype,"saved",2);b([c()],u.prototype,"draft",2);b([c()],u.prototype,"unavailable",2);b([c()],u.prototype,"msg",2);b([c()],u.prototype,"err",2);b([c()],u.prototype,"busy",2);b([c()],u.prototype,"choices",2);u=b([L("scenario-settings")],u);var as=Object.defineProperty,is=Object.getOwnPropertyDescriptor,p=(s,e,t,i)=>{for(var r=i>1?void 0:i?is(e,t):e,n=s.length-1,d;n>=0;n--)(d=s[n])&&(r=(i?d(e,t,r):d(r))||r);return i&&r&&as(e,t,r),r};const $=s=>JSON.parse(JSON.stringify(s)),R="sw.automations.templates.v1";function rs(){try{const s=JSON.parse(window.localStorage.getItem(R)??"[]");return Array.isArray(s)?s.filter(e=>e&&typeof e.id=="string"):[]}catch{return[]}}function ns(s){try{window.localStorage.setItem(R,JSON.stringify(s))}catch{}}const os=(s,e)=>JSON.stringify(s)===JSON.stringify(e);let l=class extends T{constructor(){super(...arguments),this.bubbleSkin=new I(this),this.phase="loading",this.status=null,this.saved=$(S),this.draft=$(S),this.templates=[],this.notify=[],this.review=[],this.compat=null,this.trash=[],this.error="",this.note="",this.busy=!1,this.trashOpen=!1,this.now=new Date,this.candidates=[],this.noteTimer=0,this.offClock=null}connectedCallback(){super.connectedCallback(),this.load(),this.offClock=N(()=>this.now=y())}disconnectedCallback(){super.disconnectedCallback(),this.offClock?.(),this.offClock=null,window.clearTimeout(this.noteTimer)}get dirty(){return!os(this.draft,this.saved)}async load(){this.error="",await P(),this.now=y();try{const s=x(),e=await s.status();if(this.status=e,!e.can.configure){this.phase="forbidden";return}const[t,i,r,n,d,w]=await Promise.all([s.settings(),s.templates().catch(()=>({templates:[]})),s.review().catch(()=>[]),s.trash().catch(()=>[]),s.catalog().catch(()=>null),s.compat().catch(()=>null)]);this.compat=w,this.saved=t,this.draft=$(t);const m=i.templates.map(g=>({id:g.id,name:g.name,suggest_schedule:g.suggest_schedule})),v=rs();ns([...new Map([...v,...m].map(g=>[g.id,g])).values()]),this.templates=F(m,v,t.templates_hidden),this.review=r,this.trash=n,this.notify=d?.notify_targets??[],this.candidates=(d?.entities??[]).map(g=>g.entity_id),this.phase="ready"}catch(s){s instanceof E&&s.status===403?this.phase="forbidden":(this.error=H(s).message,this.phase="error")}}say(s){this.note=s,window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",3500)}set(s){this.draft={...this.draft,...s},this.note=""}setLimit(s,e){this.set({limits:{...this.draft.limits,[s]:e}})}async save(){if(!(this.busy||!this.dirty)){this.busy=!0,this.error="";try{const s=await x().saveSettings(this.draft,this.saved);this.saved=s,this.draft=$(s),k()&&D(),M({"automations.enabled":String(s.enabled)}),this.say("נשמר")}catch(s){this.error=j(s)}finally{this.busy=!1}}}stepper(s,e,t,i,r,n,d,w=1){return a`<div class="stepper" role="group" aria-label=${d}>
      <button type="button" aria-label="פחות" data-step-minus=${s} ?disabled=${e<=i} @click=${()=>n(Math.max(i,e-w))}><sw-icon name="minus" size=${16}></sw-icon></button>
      <span class="v" data-setting=${s}><bdi>${e}</bdi>${t?a`<small>${t}</small>`:o}</span>
      <button type="button" aria-label="יותר" data-step-plus=${s} ?disabled=${e>=r} @click=${()=>n(Math.min(r,e+w))}><sw-icon name="plus" size=${16}></sw-icon></button>
    </div>`}tog(s,e,t,i){return a`<sw-toggle label=${s} labelHidden .checked=${e} data-toggle=${i} @change=${r=>t(r.detail.checked)}></sw-toggle>`}row(s,e,t){return a`<div class="row"><div class="lbl"><span>${s}</span>${e?a`<span class="muted">${e}</span>`:o}</div><div>${t}</div></div>`}who(){const s=t=>t?a`<sw-icon class="yes" name="check" size=${16} role="img" aria-label="כן"></sw-icon>`:a`<span class="no" aria-label="לא">—</span>`,e=(t,i)=>i!==null?i:this.draft.code_view_roles.includes(t);return a`<sw-card heading="מי רשאי" data-card="who">
      <table class="mtx set-matrix" data-roles-matrix>
        <thead><tr><th scope="col">תפקיד</th><th scope="col" class="c">הפעלה</th><th scope="col" class="c">יצירה ועריכה</th><th scope="col" class="c">קוד</th>${this.draft.device_test_enabled?a`<th scope="col" class="c" data-col-device-test>בדיקה על ההתקן</th>`:o}</tr></thead>
        <tbody>${G.map(t=>a`<tr data-role=${t.id}><td>${t.label}${t.scope?a`<small>${t.scope}</small>`:o}</td><td class="c">${s(t.run)}</td><td class="c">${s(t.edit)}</td><td class="c">${s(e(t.id,t.codeFixed))}</td>${this.draft.device_test_enabled?a`<td class="c">${s(t.run&&t.edit)}</td>`:o}</tr>`)}</tbody>
      </table>
      ${this.row("הרשאות ותפקידים",'ההקצאה למשתמשים ולקומות במסך "משתמשים והרשאות".',a`<a class="link" href="#/system/access" data-link-access>למסך המשתמשים</a>`)}
    </sw-card>`}wallButtons(){const s=this.draft,e=f,t=(i,r,n,d)=>{const[w,m]=e[i];return this.stepper(i,s[i],r,w,m,v=>this.set({[i]:v}),n,d)};return a`<sw-card heading="כפתורי קיר ומתגים" data-card="wall-buttons">
      ${this.row("פתוח לעריכה בבונה","כפתורי קיר ומתגים בלבד בגרסה הראשונה",this.tog("פתוח לעריכה בבונה",s.wall_buttons_editable,i=>this.set({wall_buttons_editable:i}),"wall_buttons_editable"))}
      ${s.wall_buttons_editable?a`
        ${this.row("חלון לחיצה כפולה","הזמן המרבי בין שתי לחיצות",t("wall_double_ms","מ״ש","חלון לחיצה כפולה",50))}
        ${this.row("לחיצה ארוכה מתחילה אחרי","",t("wall_long_ms","מ״ש","לחיצה ארוכה",50))}
        ${this.row("התעלמות מרעידות מגע","",t("wall_debounce_ms","מ״ש","רעידות מגע",10))}
        ${this.row("זמן האזנה בזיהוי לחיצה","",t("wall_listen_s","שנ׳","זמן האזנה",5))}
        ${this.row("טריגרים ייעודיים (מתג נדלק וכד׳)","לא בגרסה הראשונה",a`<span class="tag" data-wall-purpose>כבוי</span>`)}
        ${this.row("תבניות מתקדמות","נשארות נעולות, נשמרות כמו שהן",a`<span class="tag" data-wall-templates><sw-icon name="lock" size=${12}></sw-icon>נעול</span>`)}`:o}
    </sw-card>`}prechecks(){const s=this.draft,[e,t]=f.conflict_window_min,i=(r,n,d,w)=>a`<div class="seg" role="group" aria-label=${r}>${d.map(([m,v])=>a`<button type="button" aria-pressed=${String(n===m)} data-seg=${`${r}:${m}`} @click=${()=>w(m)}>${v}</button>`)}</div>`;return a`<sw-card heading="בדיקות לפני שמירה" data-card="prechecks">
      ${this.row("בדיקות לפני שמירה","התנגשויות, התקן לא זמין, כפתור שכבר בשימוש",this.tog("בדיקות לפני שמירה",s.precheck_enabled,r=>this.set({precheck_enabled:r}),"precheck_enabled"))}
      ${s.precheck_enabled?a`
        ${this.row("חלון זיהוי התנגשות","פעולות הפוכות על אותו התקן, בין תזמונים ואוטומציות",this.stepper("conflict_window_min",s.conflict_window_min,"דק׳",e,t,r=>this.set({conflict_window_min:r}),"חלון זיהוי התנגשות"))}
        ${this.row('לאפשר "שמירה עם אזהרות"',"שגיאה חוסמת תמיד",this.tog("שמירה עם אזהרות",s.save_with_warnings,r=>this.set({save_with_warnings:r}),"save_with_warnings"))}
        ${this.row("כפתור שכבר משמש פריט אחר","אותה לחיצה מפעילה שני פריטים",i("button_reuse",s.button_reuse,[["warn","אזהרה"],["error","שגיאה"]],r=>this.set({button_reuse:r})))}`:o}
      ${this.row("בדיקה על ההתקן","למי שמורשה לערוך וגם להפעיל ידנית",this.tog("בדיקה על ההתקן",s.device_test_enabled,r=>this.set({device_test_enabled:r}),"device_test_enabled"))}
      ${s.device_test_enabled?a`
        ${this.row("בדיקה על ההתקן: בסיום","מה קורה להתקנים שהופעלו בבדיקה",i("device_test_end",s.device_test_end,[["ask","לשאול"],["restore","להחזיר"],["keep","להשאיר"]],r=>this.set({device_test_end:r})))}
        ${this.row("בדיקה על ההתקן לפעולה רגישה","כמו היום: לפי הרשאת הפעלה ידנית",a`<span class="tag" data-device-test-sensitive><sw-icon name="lock" size=${12}></sw-icon>לפי הרשאה</span>`)}`:o}
      ${this.row('"מי במבנה" באוטומציות',"החיישן שמדווח אם יש מישהו במבנה",a`<select class="sel" aria-label="מי במבנה" data-presence-entity @change=${r=>this.set({presence_entity:r.target.value})}>
        <option value="" ?selected=${!s.presence_entity}>כבוי</option>
        ${this.presenceCandidates().map(r=>a`<option value=${r} ?selected=${r===s.presence_entity}>${r}</option>`)}</select>`)}
    </sw-card>`}presenceCandidates(){const s=this.candidates.filter(e=>/^(binary_sensor|input_boolean)\./.test(e));return this.draft.presence_entity&&!s.includes(this.draft.presence_entity)?[this.draft.presence_entity,...s]:s}delegation(){const s=this.status;if(!s)return o;const e=q(s),t=s.admin?.delegation_changed_at?z(s.admin.delegation_changed_at,this.now):"",i=this.review.filter(r=>r.issue==="delegated_write").length;return a`<sw-card heading="האצלה לבני בית שאינם מנהלי Home Assistant" data-card="delegation">
      ${this.row("מתג ההאצלה ברכיב החיבור",`${e.label}${t?` · שונה ${t}`:""} · מאפשר שמירה של תוכן העורך הפשוט בלבד`,a`<span class=${`tag ${e.state==="on"?"ok":""}`} data-delegation-state=${e.state}>${e.label}</span>`)}
      ${this.row("איפה משנים","Home Assistant ‹ הגדרות ‹ התקנים ושירותים ‹ Arx Bridge ‹ אפשרויות. לא ניתן לשינוי מכאן.",a`<span class="tag" data-delegation-readonly><sw-icon name="lock" size=${12}></sw-icon>לקריאה בלבד</span>`)}
      ${this.row("כתיבות מואצלות",`${i} ברשימת הסקירה`,i?a`<a class="link" href="#review" data-link-review @click=${r=>{r.preventDefault(),this.renderRoot.querySelector('[data-card="review"]')?.scrollIntoView({block:"center"})}}>לסקירה</a>`:o)}
    </sw-card>`}codeView(){return a`<sw-card heading="תצוגת קוד" data-card="code">
      ${this.row('מי רואה את המתג "בונה · קוד"',"הצד השני של אותו עורך. שמירת תוכן שאינו מהבונה דורשת מנהל Home Assistant בכל מקרה.",a`<div class="chipsrow" role="group" aria-label="תפקידים">${Q.map(s=>{const e=this.draft.code_view_roles.includes(s.id)||s.locked;return a`<button type="button" class="rc" aria-pressed=${String(e)} ?disabled=${s.locked} data-code-role=${s.id} @click=${()=>this.set({code_view_roles:Y(this.draft.code_view_roles,s.id)})}><sw-icon name=${e?"check":"plus"} size=${14}></sw-icon>${s.label}</button>`})}</div>`)}
    </sw-card>`}retention(){const s=this.draft,[e,t]=f.trash_days,[i,r]=f.versions_keep;return a`<sw-card heading="סל מחזור והיסטוריה" data-card="retention">
      ${this.row("שמירה בסל המחזור","פריט שנמחק ניתן לשחזור עם אותו מזהה",this.stepper("trash_days",s.trash_days,"ימים",e,t,n=>this.set({trash_days:n}),"ימי שמירה בסל המחזור"))}
      ${this.row("גרסאות לכל פריט","כולל שינויים שנעשו מחוץ למערכת",this.stepper("versions_keep",s.versions_keep,"גרסאות",i,r,n=>this.set({versions_keep:n}),"גרסאות לכל פריט"))}
      ${this.row("סל המחזור",`${this.trash.length} פריטים`,a`<sw-button size="sm" icon="trash" data-open-trash @click=${()=>this.trashOpen=!0}>פתח</sw-button>`)}
    </sw-card>`}limits(){const s=this.draft.limits,e=(t,i,r,n,d)=>this.stepper(t,s[t],i,r,n,w=>this.setLimit(t,w),d);return a`<sw-card heading="מגבלות" data-card="limits">
      ${this.row("שמירות לדקה למשתמש","",e("writes_per_min","",5,120,"שמירות לדקה"))}
      ${this.row("תצוגות מקדימות לדקה","",e("preview_per_min","",10,240,"תצוגות מקדימות לדקה"))}
      ${this.row("הרצה חוזרת של אותו פריט","מרווח מינימלי",e("run_interval_s","שנ׳",3,60,"מרווח הרצה"))}
      ${this.row("הפעלת סצנה חוזרת","",e("scene_apply_interval_s","שנ׳",1,30,"מרווח הפעלת סצנה"))}
      ${this.row("סערת הרצות · פריט",`התראה מעל ${s.storm_item_per_min} ריצות לדקה לפריט או ${s.storm_total_per_min} בסך הכל`,e("storm_item_per_min","/דק׳",5,100,"סף לפריט"))}
      ${this.row("סערת הרצות · סך הכל","",e("storm_total_per_min","/דק׳",50,1e3,"סף כולל"))}
      ${this.row("כיבוי אוטומטי בסערה","ברירת המחדל: התראה למנהל עם כיבוי בלחיצה",this.tog("כיבוי אוטומטי בסערה",this.draft.storm_auto_disable,t=>this.set({storm_auto_disable:t}),"storm_auto_disable"))}
    </sw-card>`}sensitive(){const s=new Set(this.draft.notify_targets);return a`<sw-card heading="פעולות רגישות" data-card="sensitive">
      ${this.row("הכלל","אזעקה, מנעולים, דלתות, שערים וצופרים מותרים באוטומציות כמו כל פעולה, ועוברים את אותן בדיקות הרשאה כמו שליטה ידנית. קודים לעולם לא נשמרים.",a`<span class="tag ok"><sw-icon name="check" size=${12}></sw-icon>החלטת הבעלים</span>`)}
      ${this.row("צ׳יפ אזהרה על צעד רגיש","מוצג בעורך וברשימה",this.tog("צ׳יפ אזהרה על צעד רגיש",this.draft.sensitive_warning,e=>this.set({sensitive_warning:e}),"sensitive_warning"))}
      ${this.row("צבע הצ׳יפ","צהוב או אדום",a`<div class="seg" role="group" aria-label="צבע הצ׳יפ"><button type="button" aria-pressed=${String(this.draft.sensitive_chip==="amber")} data-sensitive-chip="amber" @click=${()=>this.set({sensitive_chip:"amber"})}>צהוב</button><button type="button" aria-pressed=${String(this.draft.sensitive_chip==="red")} data-sensitive-chip="red" @click=${()=>this.set({sensitive_chip:"red"})}>אדום</button></div>`)}
      ${this.notify.length?a`<div class="row"><div class="lbl"><span>יעדי התראה מאושרים</span><span class="muted">רק אליהם אפשר לשלוח התראה מאוטומציה</span></div><div class="chipsrow" role="group" aria-label="יעדי התראה">${this.notify.map(e=>{const t=s.has(e.name);return a`<button type="button" class="rc" aria-pressed=${String(t)} data-notify=${e.action} @click=${()=>this.set({notify_targets:t?this.draft.notify_targets.filter(i=>i!==e.name):[...this.draft.notify_targets,e.name]})}>${t?a`<sw-icon name="check" size=${14}></sw-icon>`:o}${e.name}</button>`})}</div></div>`:o}
    </sw-card>`}gallery(){const s=new Set(this.draft.templates_hidden),e=this.orderedTemplates();return a`<sw-card heading="גלריית תבניות" data-card="templates">
      ${this.row("גלריה פעילה",'מוצגת בלחיצה על "חדש"',this.tog("גלריה פעילה",this.draft.templates_enabled,t=>this.set({templates_enabled:t}),"templates_enabled"))}
      ${e.map((t,i)=>a`<div class=${`tpl${s.has(t.id)?" off":""}`} data-template=${t.id}>
        <span class="nm">${t.name}${t.suggest_schedule?a` <span class="tag"><sw-icon name="calendar" size=${12}></sw-icon>גם כתזמון</span>`:o}</span>
        <button type="button" class="ib" aria-label=${`הקדם · ${t.name}`} data-template-up=${t.id} ?disabled=${i===0} @click=${()=>this.set({templates_order:O(e.map(r=>r.id),t.id,-1)})}><sw-icon name="arrowUp" size=${16}></sw-icon></button>
        <button type="button" class="ib" aria-label=${`אחר · ${t.name}`} data-template-down=${t.id} ?disabled=${i===e.length-1} @click=${()=>this.set({templates_order:O(e.map(r=>r.id),t.id,1)})}><sw-icon name="arrowDown" size=${16}></sw-icon></button>
        ${this.tog(`הצגה · ${t.name}`,!s.has(t.id),()=>this.set({templates_hidden:X(this.draft.templates_hidden,t.id)}),`tpl-${t.id}`)}
      </div>`)}
    </sw-card>`}orderedTemplates(){const s=new Map(this.draft.templates_order.map((e,t)=>[e,t]));return[...this.templates].sort((e,t)=>(s.get(e.id)??999)-(s.get(t.id)??999))}display(){return a`<sw-card heading="הצגה" data-card="display">
      ${this.row("מסנן בטלפון",'מקופל: "סינון" אחד · שורות: כל הבקרים מוצגים',a`<div class="seg" role="group" aria-label="מסנן בטלפון"><button type="button" aria-pressed=${String(this.draft.phone_filter==="fold")} data-phone-filter="fold" @click=${()=>this.set({phone_filter:"fold"})}>מקופל</button><button type="button" aria-pressed=${String(this.draft.phone_filter==="rows")} data-phone-filter="rows" @click=${()=>this.set({phone_filter:"rows"})}>שורות</button></div>`)}
      ${this.row('"+ חדש" אחד ששואל "מתי?"','"בשעות קבועות" פותח תזמון חדש; "כשמשהו קורה" פותח את הבונה. כבוי = לכל לשונית הכפתור שלה.',this.tog("חדש ששואל מתי",this.draft.ask_when_on_new,s=>this.set({ask_when_on_new:s}),"ask_when_on_new"))}
    </sw-card>`}platform(){const s=this.status?.admin;if(!s)return o;const e=!!s.bridge_version&&s.bridge_version>=s.bridge_required;return a`<sw-card heading="מצב" data-card="status">
      ${this.row("Home Assistant",`${s.ha_version} · ממשק התצורה ${s.config_api==="ok"?"זמין":"לא זמין"}`,a`<span class=${`tag ${s.config_api==="ok"?"ok":"warn"}`}>${s.config_api==="ok"?"תקין":"לא זמין"}</span>`)}
      ${this.row("Arx Bridge",s.bridge_version?`${s.bridge_version} (נדרש ${s.bridge_required}+)`:"לא מותקן",a`<span class=${`tag ${e?"ok":"warn"}`}>${e?"תקין":"דורש עדכון"}</span>`)}
      ${this.status?.last_sync_at?this.row("סנכרון אחרון",z(this.status.last_sync_at,this.now),o):o}
      ${this.row("האוטומציות במוצר","כיבוי מסתיר את הלשונית לכולם",this.tog("האוטומציות במוצר",this.draft.enabled,t=>this.set({enabled:t}),"enabled"))}
    </sw-card>`}reviewCard(){return a`<sw-card heading="סקירה" data-card="review">
      ${this.review.length?this.review.map(s=>a`<div class="rev" data-review=${`${s.kind}:${s.id}:${s.issue}`}><span class="tag warn">${J[s.issue]}</span><a href=${`#/devices/automations/${s.kind==="automation"?"":`${s.kind==="script"?"scripts":"scenes"}/`}${encodeURIComponent(s.id)}`}>${s.name}</a><span class="muted">${s.detail}</span></div>`):a`<div class="muted" data-review-empty>אין פריטים לסקירה</div>`}
    </sw-card>`}compatCard(){const s=this.compat;if(!s||!s.items.length)return o;const e=(t,i)=>`#/devices/automations/${t==="automation"?"":`${t==="script"?"scripts":"scenes"}/`}${encodeURIComponent(i)}`;return a`<sw-card heading="תאימות לתשתית המערכת 2026.10" data-card="compat">
      <div class="muted" data-compat-summary>${s.items.length===1?"פריט אחד דורש תיקון לפני השדרוג.":`${s.items.length} פריטים דורשים תיקון לפני השדרוג.`} הבדיקה קוראת בלבד.</div>
      ${s.items.map(t=>a`<div class="rev cmp" data-compat=${`${t.kind}:${t.id}`}>
        ${[...new Set(t.issues.map(i=>i.code))].map(i=>a`<span class="tag warn" data-compat-code=${i}>${U[i]}</span>`)}
        <a href=${e(t.kind,t.id)}>${t.name}</a>
        <span class="muted">${t.issues.some(i=>i.code==="admin_only_service")?a`הפעלה ידנית תיכשל למי שאינו מנהל (<bdi>${t.issues.find(i=>i.service)?.service??""}</bdi>)`:"ייכשל בבדיקת התצורה ולא יפעל"}</span>
      </div>`)}
      ${s.truncated?a`<div class="muted">מוצגים הפריטים הראשונים בלבד.</div>`:o}
    </sw-card>`}render(){return this.phase==="loading"?a`<sw-page crumbs="הגדרות" heading="אוטומציות"><sw-state-panel state="loading"></sw-state-panel></sw-page>`:this.phase==="error"?a`<sw-page crumbs="הגדרות" heading="אוטומציות"><sw-state-panel state="error" hint=${this.error} actionLabel="נסו שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`:this.phase==="forbidden"?a`<sw-page crumbs="הגדרות" heading="אוטומציות"><sw-state-panel state="forbidden" heading="אין הרשאה" data-automations-settings-forbidden></sw-state-panel></sw-page>`:a`<sw-page crumbs="הגדרות" heading="אוטומציות" subheading="כל אפשרות של האוטומציות, הסצנות והסקריפטים נמצאת כאן בלבד." wide data-automations-settings>
      <div class="cols">
        <div class="col set-col">${this.platform()}${this.wallButtons()}${this.codeView()}${this.who()}${this.retention()}${this.display()}<sw-list-display-settings list="automations"></sw-list-display-settings></div>
        <div class="col set-col">${this.prechecks()}${this.compatCard()}${this.delegation()}${this.limits()}${this.sensitive()}${this.gallery()}${this.reviewCard()}${k()?a`<scenario-settings></scenario-settings>`:o}</div>
      </div>
      ${this.dirty||this.note||this.error?a`<div class="savebar" data-settings-bar>
            ${this.error?a`<span class="msg err" role="alert" data-settings-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:this.note?a`<span class="msg ok" role="status" data-settings-saved><sw-icon name="check" size=${13}></sw-icon>${this.note}</span>`:a`<span class="dirty">יש שינויים שלא נשמרו.</span>`}
            <span class="grow"></span>
            ${this.dirty?a`<sw-button variant="ghost" data-settings-cancel @click=${()=>{this.draft=$(this.saved),this.error=""}}>ביטול</sw-button><sw-button variant="primary" icon="check" data-settings-save ?disabled=${this.busy} @click=${()=>void this.save()}>${this.busy?"שומר…":"שמירה"}</sw-button>`:o}
          </div>`:o}
      <automation-drawer .trash=${!0} .open=${this.trashOpen} .status=${this.status} .now=${this.now} @drawer-close=${()=>{this.trashOpen=!1,this.load()}}></automation-drawer>
    </sw-page>`}};l.styles=[A,C`
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
    .rc[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
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
  `,B];p([c()],l.prototype,"phase",2);p([c()],l.prototype,"status",2);p([c()],l.prototype,"saved",2);p([c()],l.prototype,"draft",2);p([c()],l.prototype,"templates",2);p([c()],l.prototype,"notify",2);p([c()],l.prototype,"review",2);p([c()],l.prototype,"compat",2);p([c()],l.prototype,"trash",2);p([c()],l.prototype,"error",2);p([c()],l.prototype,"note",2);p([c()],l.prototype,"busy",2);p([c()],l.prototype,"trashOpen",2);p([c()],l.prototype,"now",2);p([c()],l.prototype,"candidates",2);l=p([L("system-automations")],l);export{l as SystemAutomations};
//# sourceMappingURL=system-automations-Z5b2To8f.js.map
