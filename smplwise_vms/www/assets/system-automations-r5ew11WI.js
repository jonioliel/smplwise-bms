import{g as T,j as l,i as C,a as E,b as r,ej as y,A as d,k as L,aL as N,iN as D,iO as P,a2 as k,dL as H,iP as M,eD as e,iQ as j,iR as _,iS as U,iT as B,hp as x,aU as J,bi as W,bj as F}from"./index-CPuzFb4-.js";import"./sw-table-8Ffab9oO.js";import{g as V,s as q,a as G,b as w}from"./scenario-recipients-604J93J3.js";import{s as R}from"./settings-BBKucUsS.js";import"./sw-list-display-settings-A8PyxYR2.js";import{a as S,b as K,c as O,t as Q,R as Y,d as X,w as z,C as Z,e as ee,m as A,f as se}from"./automations-logic-BqBwkhgt.js";import"./sw-logo-art-PLtEZJxU.js";import"./automations-glass-5jGP2ZSj.js";import"./glass-CQ4pjMyr.js";var te=Object.defineProperty,ae=Object.getOwnPropertyDescriptor,b=(s,t,a,i)=>{for(var n=i>1?void 0:i?ae(t,a):t,o=s.length-1,c;o>=0;o--)(c=s[o])&&(n=(i?c(t,a,n):c(n))||n);return i&&n&&te(t,a,n),n};const ie=[["scenarios.enabled","setEnabled"],["scenarios.kill_switch","setKill"],["scenarios.actions.notify","setActNotify"],["scenarios.actions.create_ticket","setActTicket"],["scenarios.actions.set_flag","setActFlag"],["scenarios.degraded_notice","setDegraded"]],re=[["scenarios.max_fires_per_day","setMaxFires",1,1e3],["scenarios.max_tickets_per_day","setMaxTickets",0,200],["scenarios.max_actions_per_hour","setMaxHour",10,5e3],["scenarios.max_rules","setMaxRules",1,500],["scenarios.tick_s","setTick",10,300],["scenarios.test_per_min","setTestPerMin",1,120],["scenarios.runs_keep_days","setKeep",7,365]];let m=class extends C{constructor(){super(...arguments),this.saved=null,this.draft={},this.unavailable=!1,this.msg="",this.err="",this.busy=!1,this.choices=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const s=await V();this.saved=s.settings,this.draft={...s.settings},q().then(t=>this.choices=t).catch(()=>{})}catch{this.unavailable=!0}}set(s,t){this.draft={...this.draft,[s]:t},this.msg="",this.err=""}changes(){const s={};for(const[t,a]of Object.entries(this.draft))JSON.stringify(a)!==JSON.stringify(this.saved?.[t])&&(s[t]=a);return s}async save(){const s=this.changes();if(Object.keys(s).length){this.busy=!0;try{const t=await G(s);this.saved=t.settings,this.draft={...t.settings},this.msg=w("setSaved")}catch(t){this.err=t instanceof E?`${w("setInvalid")}: ${String(t.body.details?.key??"")}`:String(t)}finally{this.busy=!1}}}windowRow(){const s=this.draft["scenarios.work_window"]??{days:[6,0,1,2,3],from:"08:00",to:"17:00"},t=w("dayNames").split(","),a=i=>{const n=s.days.includes(i)?s.days.filter(o=>o!==i):[...s.days,i].sort();n.length&&this.set("scenarios.work_window",{...s,days:n})};return r`<label>${w("setWindow")}<span class="row"><span class="days">${[6,0,1,2,3,4,5].map(i=>r`<button type="button" aria-pressed=${String(s.days.includes(i))} @click=${()=>a(i)}>${t[i]}</button>`)}</span>
      <input type="time" lang=${y()} .value=${s.from} @change=${i=>this.set("scenarios.work_window",{...s,from:i.target.value})} />
      <input type="time" lang=${y()} .value=${s.to} @change=${i=>this.set("scenarios.work_window",{...s,to:i.target.value})} /></span></label>`}render(){if(this.unavailable||!this.saved)return d;const s=this.draft["scenarios.default_recipients"]??{users:[],roles:[]},t=Object.keys(this.changes()).length>0;return r`<sw-card heading=${w("setTitle")} data-scenario-settings>
      <div class="grid">
        ${ie.map(([a,i])=>r`<div class="row"><span>${w(i)}</span><sw-toggle data-key=${a} .checked=${this.draft[a]===!0} @change=${n=>this.set(a,n.detail.checked)}></sw-toggle></div>`)}
        ${re.map(([a,i,n,o])=>r`<label>${w(i)}<input type="number" data-key=${a} min=${n} max=${o} .value=${String(this.draft[a]??"")} @change=${c=>this.set(a,Number(c.target.value))} /></label>`)}
        <label>${w("setAfterSource")}<select data-key="scenarios.after_hours_source" @change=${a=>this.set("scenarios.after_hours_source",a.target.value)}>
          <option value="window" ?selected=${this.draft["scenarios.after_hours_source"]!=="calendar"}>${w("setAfterWindow")}</option>
          <option value="calendar" ?selected=${this.draft["scenarios.after_hours_source"]==="calendar"}>${w("setAfterCalendar")}</option></select></label>
        ${this.windowRow()}
        <label>${w("setRecipients")}<scenario-recipients data-key="scenarios.default_recipients" .choices=${this.choices} .value=${s}
          @change=${a=>this.set("scenarios.default_recipients",a.detail.value)}></scenario-recipients></label>
      </div>
      <div class="bar">${this.err?r`<span class="err" role="alert">${this.err}</span>`:this.msg?r`<span class="ok" role="status">${this.msg}</span>`:d}
        <sw-button variant="primary" icon="check" data-scenario-settings-save ?disabled=${!t||this.busy} @click=${()=>void this.save()}>${w("setSave")}</sw-button></div>
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
  `];b([l()],m.prototype,"saved",2);b([l()],m.prototype,"draft",2);b([l()],m.prototype,"unavailable",2);b([l()],m.prototype,"msg",2);b([l()],m.prototype,"err",2);b([l()],m.prototype,"busy",2);b([l()],m.prototype,"choices",2);m=b([L("scenario-settings")],m);var ne=Object.defineProperty,oe=Object.getOwnPropertyDescriptor,h=(s,t,a,i)=>{for(var n=i>1?void 0:i?oe(t,a):t,o=s.length-1,c;o>=0;o--)(c=s[o])&&(n=(i?c(t,a,n):c(n))||n);return i&&n&&ne(t,a,n),n};const f=s=>JSON.parse(JSON.stringify(s)),I="sw.automations.templates.v1";function le(){try{const s=JSON.parse(window.localStorage.getItem(I)??"[]");return Array.isArray(s)?s.filter(t=>t&&typeof t.id=="string"):[]}catch{return[]}}function de(s){try{window.localStorage.setItem(I,JSON.stringify(s))}catch{}}const ce=(s,t)=>JSON.stringify(s)===JSON.stringify(t);let p=class extends C{constructor(){super(...arguments),this.bubbleSkin=new N(this),this.phase="loading",this.status=null,this.saved=f(x),this.draft=f(x),this.templates=[],this.notify=[],this.review=[],this.compat=null,this.trash=[],this.error="",this.note="",this.busy=!1,this.trashOpen=!1,this.now=new Date,this.candidates=[],this.noteTimer=0,this.offClock=null}connectedCallback(){super.connectedCallback(),this.load(),this.offClock=D(()=>this.now=S())}disconnectedCallback(){super.disconnectedCallback(),this.offClock?.(),this.offClock=null,window.clearTimeout(this.noteTimer)}get dirty(){return!ce(this.draft,this.saved)}async load(){this.error="",await K(),this.now=S();try{const s=O(),t=await s.status();if(this.status=t,!t.can.configure){this.phase="forbidden";return}const[a,i,n,o,c,u]=await Promise.all([s.settings(),s.templates().catch(()=>({templates:[]})),s.review().catch(()=>[]),s.trash().catch(()=>[]),s.catalog().catch(()=>null),s.compat().catch(()=>null)]);this.compat=u,this.saved=a,this.draft=f(a);const g=i.templates.map($=>({id:$.id,name:$.name,suggest_schedule:$.suggest_schedule})),v=le();de([...new Map([...v,...g].map($=>[$.id,$])).values()]),this.templates=Q(g,v,a.templates_hidden),this.review=n,this.trash=o,this.notify=c?.notify_targets??[],this.candidates=(c?.entities??[]).map($=>$.entity_id),this.phase="ready"}catch(s){s instanceof E&&s.status===403?this.phase="forbidden":(this.error=P(s).message,this.phase="error")}}say(s){this.note=s,window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",3500)}set(s){this.draft={...this.draft,...s},this.note=""}setLimit(s,t){this.set({limits:{...this.draft.limits,[s]:t}})}async save(){if(!(this.busy||!this.dirty)){this.busy=!0,this.error="";try{const s=await O().saveSettings(this.draft,this.saved);this.saved=s,this.draft=f(s),k()&&H(),M({"automations.enabled":String(s.enabled)}),this.say(e("נשמר"))}catch(s){this.error=j(s)}finally{this.busy=!1}}}stepper(s,t,a,i,n,o,c,u=1){return r`<div class="stepper" role="group" aria-label=${c}>
      <button type="button" aria-label=${e("פחות")} data-step-minus=${s} ?disabled=${t<=i} @click=${()=>o(Math.max(i,t-u))}><sw-icon name="minus" size=${16}></sw-icon></button>
      <span class="v" data-setting=${s}><bdi>${t}</bdi>${a?r`<small>${a}</small>`:d}</span>
      <button type="button" aria-label=${e("יותר")} data-step-plus=${s} ?disabled=${t>=n} @click=${()=>o(Math.min(n,t+u))}><sw-icon name="plus" size=${16}></sw-icon></button>
    </div>`}tog(s,t,a,i){return r`<sw-toggle label=${s} labelHidden .checked=${t} data-toggle=${i} @change=${n=>a(n.detail.checked)}></sw-toggle>`}row(s,t,a){return r`<div class="row"><div class="lbl"><span>${s}</span>${t?r`<span class="muted">${t}</span>`:d}</div><div>${a}</div></div>`}who(){const s=i=>i?r`<sw-icon class="yes" part="yes" name="check" size=${16} role="img" aria-label=${e("כן")}></sw-icon>`:r`<span class="no" part="no" aria-label=${e("לא")}>—</span>`,t=(i,n)=>n!==null?n:this.draft.code_view_roles.includes(i),a=[{key:"label",label:e("תפקיד"),render:i=>r`<span class="t1">${i.label}</span>${i.scope?r`<span class="t2">${i.scope}</span>`:d}`},{key:"run",label:e("הפעלה"),align:"center",width:"min(72px, 16vw)",render:i=>s(i.run)},{key:"edit",label:e("יצירה ועריכה"),align:"center",width:"min(72px, 16vw)",render:i=>s(i.edit)},{key:"code",label:e("קוד"),align:"center",width:"min(72px, 16vw)",render:i=>s(t(i.id,i.codeFixed))},...this.draft.device_test_enabled?[{key:"test",label:e("בדיקה על ההתקן"),align:"center",width:"min(72px, 16vw)",cellAttrs:()=>({"data-col-device-test":!0}),render:i=>s(i.run&&i.edit)}]:[]];return r`<sw-card heading=${e("מי רשאי")} data-card="who">
      <sw-table class="mtx set-matrix" bare static-rows keep-columns data-roles-matrix .columns=${a} .rows=${Y}
        .rowAttrs=${i=>({"data-role":String(i.id)})}></sw-table>
      ${this.row(e("הרשאות ותפקידים"),e('ההקצאה למשתמשים ולקומות במסך "משתמשים והרשאות".'),r`<a class="link" href="#/system/access" data-link-access>${e("למסך המשתמשים")}</a>`)}
    </sw-card>`}wallButtons(){const s=this.draft,t=_,a=(i,n,o,c)=>{const[u,g]=t[i];return this.stepper(i,s[i],n,u,g,v=>this.set({[i]:v}),o,c)};return r`<sw-card heading=${e("כפתורי קיר ומתגים")} data-card="wall-buttons">
      ${this.row(e("פתוח לעריכה בבונה"),e("כפתורי קיר ומתגים בלבד בגרסה הראשונה"),this.tog(e("פתוח לעריכה בבונה"),s.wall_buttons_editable,i=>this.set({wall_buttons_editable:i}),"wall_buttons_editable"))}
      ${s.wall_buttons_editable?r`
        ${this.row(e("חלון לחיצה כפולה"),e("הזמן המרבי בין שתי לחיצות"),a("wall_double_ms",e("מ״ש"),e("חלון לחיצה כפולה"),50))}
        ${this.row(e("לחיצה ארוכה מתחילה אחרי"),"",a("wall_long_ms",e("מ״ש"),e("לחיצה ארוכה"),50))}
        ${this.row(e("התעלמות מרעידות מגע"),"",a("wall_debounce_ms",e("מ״ש"),e("רעידות מגע"),10))}
        ${this.row(e("זמן האזנה בזיהוי לחיצה"),"",a("wall_listen_s",e("שנ׳"),e("זמן האזנה"),5))}
        ${this.row(e("טריגרים ייעודיים (מתג נדלק וכד׳)"),e("לא בגרסה הראשונה"),r`<span class="tag" data-wall-purpose>${e("כבוי")}</span>`)}
        ${this.row(e("תבניות מתקדמות"),e("נשארות נעולות, נשמרות כמו שהן"),r`<span class="tag" data-wall-templates><sw-icon name="lock" size=${12}></sw-icon>${e("נעול")}</span>`)}`:d}
    </sw-card>`}prechecks(){const s=this.draft,[t,a]=_.conflict_window_min,i=(n,o,c,u)=>r`<sw-segmented label=${n} value=${o} .options=${c.map(([g,v])=>({value:g,label:v,attrs:{"data-seg":`${n}:${g}`}}))}
        @change=${g=>u(g.detail.value)}></sw-segmented>`;return r`<sw-card heading=${e("בדיקות לפני שמירה")} data-card="prechecks">
      ${this.row(e("בדיקות לפני שמירה"),e("התנגשויות, התקן לא זמין, כפתור שכבר בשימוש"),this.tog(e("בדיקות לפני שמירה"),s.precheck_enabled,n=>this.set({precheck_enabled:n}),"precheck_enabled"))}
      ${s.precheck_enabled?r`
        ${this.row(e("חלון זיהוי התנגשות"),e("פעולות הפוכות על אותו התקן, בין תזמונים ואוטומציות"),this.stepper("conflict_window_min",s.conflict_window_min,e("דק׳"),t,a,n=>this.set({conflict_window_min:n}),e("חלון זיהוי התנגשות")))}
        ${this.row(e('לאפשר "שמירה עם אזהרות"'),e("שגיאה חוסמת תמיד"),this.tog(e("שמירה עם אזהרות"),s.save_with_warnings,n=>this.set({save_with_warnings:n}),"save_with_warnings"))}
        ${this.row(e("כפתור שכבר משמש פריט אחר"),e("אותה לחיצה מפעילה שני פריטים"),i("button_reuse",s.button_reuse,[["warn",e("אזהרה")],["error",e("שגיאה")]],n=>this.set({button_reuse:n})))}`:d}
      ${this.row(e("בדיקה על ההתקן"),e("למי שמורשה לערוך וגם להפעיל ידנית"),this.tog(e("בדיקה על ההתקן"),s.device_test_enabled,n=>this.set({device_test_enabled:n}),"device_test_enabled"))}
      ${s.device_test_enabled?r`
        ${this.row(e("בדיקה על ההתקן: בסיום"),e("מה קורה להתקנים שהופעלו בבדיקה"),i("device_test_end",s.device_test_end,[["ask",e("לשאול")],["restore",e("להחזיר")],["keep",e("להשאיר")]],n=>this.set({device_test_end:n})))}
        ${this.row(e("בדיקה על ההתקן לפעולה רגישה"),e("כמו היום: לפי הרשאת הפעלה ידנית"),r`<span class="tag" data-device-test-sensitive><sw-icon name="lock" size=${12}></sw-icon>${e("לפי הרשאה")}</span>`)}`:d}
      ${this.row(e('"מי במבנה" באוטומציות'),e("החיישן שמדווח אם יש מישהו במבנה"),r`<select class="sel" aria-label=${e("מי במבנה")} data-presence-entity @change=${n=>this.set({presence_entity:n.target.value})}>
        <option value="" ?selected=${!s.presence_entity}>${e("כבוי")}</option>
        ${this.presenceCandidates().map(n=>r`<option value=${n} ?selected=${n===s.presence_entity}>${n}</option>`)}</select>`)}
    </sw-card>`}presenceCandidates(){const s=this.candidates.filter(t=>/^(binary_sensor|input_boolean)\./.test(t));return this.draft.presence_entity&&!s.includes(this.draft.presence_entity)?[this.draft.presence_entity,...s]:s}delegation(){const s=this.status;if(!s)return d;const t=X(s),a=s.admin?.delegation_changed_at?z(s.admin.delegation_changed_at,this.now):"",i=this.review.filter(n=>n.issue==="delegated_write").length;return r`<sw-card heading=${e("האצלה לבני בית שאינם מנהלי Home Assistant")} data-card="delegation">
      ${this.row(e("מתג ההאצלה ברכיב החיבור"),`${t.label}${a?` · ${e("שונה {time}",{time:a})}`:""} · ${e("מאפשר שמירה של תוכן העורך הפשוט בלבד")}`,r`<span class=${`tag ${t.state==="on"?"ok":""}`} data-delegation-state=${t.state}>${t.label}</span>`)}
      ${this.row(e("איפה משנים"),e("Home Assistant ‹ הגדרות ‹ התקנים ושירותים ‹ Arx Bridge ‹ אפשרויות. לא ניתן לשינוי מכאן."),r`<span class="tag" data-delegation-readonly><sw-icon name="lock" size=${12}></sw-icon>${e("לקריאה בלבד")}</span>`)}
      ${this.row(e("כתיבות מואצלות"),e("{n} ברשימת הסקירה",{n:i}),i?r`<a class="link" href="#review" data-link-review @click=${n=>{n.preventDefault(),this.renderRoot.querySelector('[data-card="review"]')?.scrollIntoView({block:"center"})}}>${e("לסקירה")}</a>`:d)}
    </sw-card>`}codeView(){return r`<sw-card heading=${e("תצוגת קוד")} data-card="code">
      ${this.row(e('מי רואה את המתג "בונה · קוד"'),e("הצד השני של אותו עורך. שמירת תוכן שאינו מהבונה דורשת מנהל Home Assistant בכל מקרה."),r`<div class="chipsrow" role="group" aria-label=${e("תפקידים")}>${Z.map(s=>{const t=this.draft.code_view_roles.includes(s.id)||s.locked;return r`<button type="button" class="rc" aria-pressed=${String(t)} ?disabled=${s.locked} data-code-role=${s.id} @click=${()=>this.set({code_view_roles:ee(this.draft.code_view_roles,s.id)})}><sw-icon name=${t?"check":"plus"} size=${14}></sw-icon>${s.label}</button>`})}</div>`)}
    </sw-card>`}retention(){const s=this.draft,[t,a]=_.trash_days,[i,n]=_.versions_keep;return r`<sw-card heading=${e("סל מחזור והיסטוריה")} data-card="retention">
      ${this.row(e("שמירה בסל המחזור"),e("פריט שנמחק ניתן לשחזור עם אותו מזהה"),this.stepper("trash_days",s.trash_days,e("ימים"),t,a,o=>this.set({trash_days:o}),e("ימי שמירה בסל המחזור")))}
      ${this.row(e("גרסאות לכל פריט"),e("כולל שינויים שנעשו מחוץ למערכת"),this.stepper("versions_keep",s.versions_keep,e("גרסאות"),i,n,o=>this.set({versions_keep:o}),e("גרסאות לכל פריט")))}
      ${this.row(e("סל המחזור"),e("{n} פריטים",{n:this.trash.length}),r`<sw-button size="sm" icon="trash" data-open-trash @click=${()=>this.trashOpen=!0}>${e("פתח")}</sw-button>`)}
    </sw-card>`}limits(){const s=this.draft.limits,t=(a,i,n,o,c)=>this.stepper(a,s[a],i,n,o,u=>this.setLimit(a,u),c);return r`<sw-card heading=${e("מגבלות")} data-card="limits">
      ${this.row(e("שמירות לדקה למשתמש"),"",t("writes_per_min","",5,120,e("שמירות לדקה")))}
      ${this.row(e("תצוגות מקדימות לדקה"),"",t("preview_per_min","",10,240,e("תצוגות מקדימות לדקה")))}
      ${this.row(e("הרצה חוזרת של אותו פריט"),e("מרווח מינימלי"),t("run_interval_s",e("שנ׳"),3,60,e("מרווח הרצה")))}
      ${this.row(e("הפעלת סצנה חוזרת"),"",t("scene_apply_interval_s",e("שנ׳"),1,30,e("מרווח הפעלת סצנה")))}
      ${this.row(e("סערת הרצות · פריט"),e("התראה מעל {item} ריצות לדקה לפריט או {total} בסך הכל",{item:s.storm_item_per_min,total:s.storm_total_per_min}),t("storm_item_per_min",e("/דק׳"),5,100,e("סף לפריט")))}
      ${this.row(e("סערת הרצות · סך הכל"),"",t("storm_total_per_min",e("/דק׳"),50,1e3,e("סף כולל")))}
      ${this.row(e("כיבוי אוטומטי בסערה"),e("ברירת המחדל: התראה למנהל עם כיבוי בלחיצה"),this.tog(e("כיבוי אוטומטי בסערה"),this.draft.storm_auto_disable,a=>this.set({storm_auto_disable:a}),"storm_auto_disable"))}
    </sw-card>`}sensitive(){const s=new Set(this.draft.notify_targets);return r`<sw-card heading=${e("פעולות רגישות")} data-card="sensitive">
      ${this.row(e("הכלל"),e("אזעקה, מנעולים, דלתות, שערים וצופרים מותרים באוטומציות כמו כל פעולה, ועוברים את אותן בדיקות הרשאה כמו שליטה ידנית. קודים לעולם לא נשמרים."),r`<span class="tag ok"><sw-icon name="check" size=${12}></sw-icon>${e("החלטת הבעלים")}</span>`)}
      ${this.row(e("צ׳יפ אזהרה על צעד רגיש"),e("מוצג בעורך וברשימה"),this.tog(e("צ׳יפ אזהרה על צעד רגיש"),this.draft.sensitive_warning,t=>this.set({sensitive_warning:t}),"sensitive_warning"))}
      ${this.row(e("צבע הצ׳יפ"),e("צהוב או אדום"),r`<sw-segmented label=${e("צבע הצ׳יפ")} value=${this.draft.sensitive_chip} @change=${t=>this.set({sensitive_chip:t.detail.value})}
        .options=${[{value:"amber",label:e("צהוב"),attrs:{"data-sensitive-chip":"amber"}},{value:"red",label:e("אדום"),attrs:{"data-sensitive-chip":"red"}}]}></sw-segmented>`)}
      ${this.notify.length?r`<div class="row"><div class="lbl"><span>${e("יעדי התראה מאושרים")}</span><span class="muted">${e("רק אליהם אפשר לשלוח התראה מאוטומציה")}</span></div><div class="chipsrow" role="group" aria-label=${e("יעדי התראה")}>${this.notify.map(t=>{const a=s.has(t.name);return r`<button type="button" class="rc" aria-pressed=${String(a)} data-notify=${t.action} @click=${()=>this.set({notify_targets:a?this.draft.notify_targets.filter(i=>i!==t.name):[...this.draft.notify_targets,t.name]})}>${a?r`<sw-icon name="check" size=${14}></sw-icon>`:d}${t.name}</button>`})}</div></div>`:d}
    </sw-card>`}gallery(){const s=new Set(this.draft.templates_hidden),t=this.orderedTemplates();return r`<sw-card heading=${e("גלריית תבניות")} data-card="templates">
      ${this.row(e("גלריה פעילה"),e('מוצגת בלחיצה על "חדש"'),this.tog(e("גלריה פעילה"),this.draft.templates_enabled,a=>this.set({templates_enabled:a}),"templates_enabled"))}
      ${t.map((a,i)=>r`<div class=${`tpl${s.has(a.id)?" off":""}`} data-template=${a.id}>
        <span class="nm">${a.name}${a.suggest_schedule?r` <span class="tag"><sw-icon name="calendar" size=${12}></sw-icon>${e("גם כתזמון")}</span>`:d}</span>
        <button type="button" class="ib" aria-label=${`${e("הקדם")} · ${a.name}`} data-template-up=${a.id} ?disabled=${i===0} @click=${()=>this.set({templates_order:A(t.map(n=>n.id),a.id,-1)})}><sw-icon name="arrowUp" size=${16}></sw-icon></button>
        <button type="button" class="ib" aria-label=${`${e("אחר")} · ${a.name}`} data-template-down=${a.id} ?disabled=${i===t.length-1} @click=${()=>this.set({templates_order:A(t.map(n=>n.id),a.id,1)})}><sw-icon name="arrowDown" size=${16}></sw-icon></button>
        ${this.tog(`${e("הצגה")} · ${a.name}`,!s.has(a.id),()=>this.set({templates_hidden:se(this.draft.templates_hidden,a.id)}),`tpl-${a.id}`)}
      </div>`)}
    </sw-card>`}orderedTemplates(){const s=new Map(this.draft.templates_order.map((t,a)=>[t,a]));return[...this.templates].sort((t,a)=>(s.get(t.id)??999)-(s.get(a.id)??999))}display(){return r`<sw-card heading=${e("הצגה")} data-card="display">
      ${this.row(e("מסנן בטלפון"),e('מקופל: "סינון" אחד · שורות: כל הבקרים מוצגים'),r`<sw-segmented label=${e("מסנן בטלפון")} value=${this.draft.phone_filter} @change=${s=>this.set({phone_filter:s.detail.value})}
        .options=${[{value:"fold",label:e("מקופל"),attrs:{"data-phone-filter":"fold"}},{value:"rows",label:e("שורות"),attrs:{"data-phone-filter":"rows"}}]}></sw-segmented>`)}
      ${this.row(e('"+ חדש" אחד ששואל "מתי?"'),e('"בשעות קבועות" פותח תזמון חדש; "כשמשהו קורה" פותח את הבונה. כבוי = לכל לשונית הכפתור שלה.'),this.tog(e("חדש ששואל מתי"),this.draft.ask_when_on_new,s=>this.set({ask_when_on_new:s}),"ask_when_on_new"))}
    </sw-card>`}platform(){const s=this.status?.admin;if(!s)return d;const t=!!s.bridge_version&&s.bridge_version>=s.bridge_required;return r`<sw-card heading=${e("מצב")} data-card="status">
      ${this.row("Home Assistant",`${s.ha_version} · ${e("ממשק התצורה {state}",{state:s.config_api==="ok"?e("זמין"):e("לא זמין")})}`,r`<span class=${`tag ${s.config_api==="ok"?"ok":"warn"}`}>${s.config_api==="ok"?e("תקין"):e("לא זמין")}</span>`)}
      ${this.row("Arx Bridge",s.bridge_version?`${s.bridge_version} (${e("נדרש {version}+",{version:s.bridge_required})})`:e("לא מותקן"),r`<span class=${`tag ${t?"ok":"warn"}`}>${t?e("תקין"):e("דורש עדכון")}</span>`)}
      ${this.status?.last_sync_at?this.row(e("סנכרון אחרון"),z(this.status.last_sync_at,this.now),d):d}
      ${this.row(e("האוטומציות במוצר"),e("כיבוי מסתיר את הלשונית לכולם"),this.tog(e("האוטומציות במוצר"),this.draft.enabled,a=>this.set({enabled:a}),"enabled"))}
    </sw-card>`}reviewCard(){return r`<sw-card heading=${e("סקירה")} data-card="review">
      ${this.review.length?this.review.map(s=>r`<div class="rev" data-review=${`${s.kind}:${s.id}:${s.issue}`}><span class="tag warn">${U[s.issue]}</span><a href=${`#/devices/automations/${s.kind==="automation"?"":`${s.kind==="script"?"scripts":"scenes"}/`}${encodeURIComponent(s.id)}`}>${s.name}</a><span class="muted">${s.detail}</span></div>`):r`<div class="muted" data-review-empty>${e("אין פריטים לסקירה")}</div>`}
    </sw-card>`}compatCard(){const s=this.compat;if(!s||!s.items.length)return d;const t=(a,i)=>`#/devices/automations/${a==="automation"?"":`${a==="script"?"scripts":"scenes"}/`}${encodeURIComponent(i)}`;return r`<sw-card heading=${e("תאימות לתשתית המערכת 2026.10")} data-card="compat">
      <div class="muted" data-compat-summary>${s.items.length===1?e("פריט אחד דורש תיקון לפני השדרוג."):e("{n} פריטים דורשים תיקון לפני השדרוג.",{n:s.items.length})} ${e("הבדיקה קוראת בלבד.")}</div>
      ${s.items.map(a=>r`<div class="rev cmp" data-compat=${`${a.kind}:${a.id}`}>
        ${[...new Set(a.issues.map(i=>i.code))].map(i=>r`<span class="tag warn" data-compat-code=${i}>${B[i]}</span>`)}
        <a href=${t(a.kind,a.id)}>${a.name}</a>
        <span class="muted">${a.issues.some(i=>i.code==="admin_only_service")?r`${e("הפעלה ידנית תיכשל למי שאינו מנהל")} (<bdi>${a.issues.find(i=>i.service)?.service??""}</bdi>)`:e("ייכשל בבדיקת התצורה ולא יפעל")}</span>
      </div>`)}
      ${s.truncated?r`<div class="muted">${e("מוצגים הפריטים הראשונים בלבד.")}</div>`:d}
    </sw-card>`}render(){return this.phase==="loading"?r`<sw-page crumbs=${e("הגדרות")} heading=${e("אוטומציות")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`:this.phase==="error"?r`<sw-page crumbs=${e("הגדרות")} heading=${e("אוטומציות")}><sw-state-panel state="error" hint=${this.error} actionLabel=${e("נסו שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`:this.phase==="forbidden"?r`<sw-page crumbs=${e("הגדרות")} heading=${e("אוטומציות")}><sw-state-panel state="forbidden" heading=${e("אין הרשאה")} data-automations-settings-forbidden></sw-state-panel></sw-page>`:r`<sw-page crumbs=${e("הגדרות")} heading=${e("אוטומציות")} subheading=${e("כל אפשרות של האוטומציות, הסצנות והסקריפטים נמצאת כאן בלבד.")} wide data-automations-settings>
      <div class="cols">
        <div class="col set-col">${this.platform()}${this.wallButtons()}${this.codeView()}${this.who()}${this.retention()}${this.display()}<sw-list-display-settings list="automations"></sw-list-display-settings></div>
        <div class="col set-col">${this.prechecks()}${this.compatCard()}${this.delegation()}${this.limits()}${this.sensitive()}${this.gallery()}${this.reviewCard()}${k()?r`<scenario-settings></scenario-settings>`:d}</div>
      </div>
      ${this.dirty||this.note||this.error?r`<div class="savebar" data-settings-bar>
            ${this.error?r`<span class="msg err" role="alert" data-settings-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:this.note?r`<span class="msg ok" role="status" data-settings-saved><sw-icon name="check" size=${13}></sw-icon>${this.note}</span>`:r`<span class="dirty">${e("יש שינויים שלא נשמרו.")}</span>`}
            <span class="grow"></span>
            ${this.dirty?r`<sw-button variant="ghost" data-settings-cancel @click=${()=>{this.draft=f(this.saved),this.error=""}}>${e("ביטול")}</sw-button><sw-button variant="primary" icon="check" data-settings-save ?disabled=${this.busy} @click=${()=>void this.save()}>${this.busy?e("שומר…"):e("שמירה")}</sw-button>`:d}
          </div>`:d}
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
    /* SCHED-POLISH-2331 -> SHARED-POLISH-2342 -> CR-CMP2-TABLES-REST-2470: the role matrix is the shared sw-table.set-matrix of
       styles/settings.ts; only its foot margin stays here */
    sw-table.mtx {
      margin-block-end: var(--sw-s-3);
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
    }
  `,J];h([l()],p.prototype,"phase",2);h([l()],p.prototype,"status",2);h([l()],p.prototype,"saved",2);h([l()],p.prototype,"draft",2);h([l()],p.prototype,"templates",2);h([l()],p.prototype,"notify",2);h([l()],p.prototype,"review",2);h([l()],p.prototype,"compat",2);h([l()],p.prototype,"trash",2);h([l()],p.prototype,"error",2);h([l()],p.prototype,"note",2);h([l()],p.prototype,"busy",2);h([l()],p.prototype,"trashOpen",2);h([l()],p.prototype,"now",2);h([l()],p.prototype,"candidates",2);p=h([L("system-automations")],p);export{p as SystemAutomations};
