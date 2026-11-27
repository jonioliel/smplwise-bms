import{a as C,aX as T,af as b,p as E,c as $,bE as z,dL as s,b as n,dM as O,A as p,a8 as L,j as R,k as c,dl as H,m as M}from"./index-DMqYQw_5.js";import{l as f}from"./live-Be98Bxd5.js";import"./sw-list-display-settings-ZRaJIhqe.js";import"./sw-table-cT_azPqu.js";import{s as u}from"./schedules-logic-CwMA3INC.js";import{demoStore as v}from"./schedules-mock-DUFulD3y.js";import{k as y,l as S,m as k,n as P,o as _,q as W,A as m,t as I,u as N,w as x,C as A,S as w}from"./schedules-CcHVJMGM.js";import{b as q}from"./bubble-chrome-cp9KaWhG.js";import{s as j}from"./settings-DxF8bxXX.js";import{a as U,c as J}from"./confirm-words-BHo2wjzf.js";import"./sw-logo-art-PLtEZJxU.js";import"./automation-B3ruBAEi.js";var B=Object.defineProperty,F=Object.getOwnPropertyDescriptor,d=(e,t,a,r)=>{for(var l=r>1?void 0:r?F(t,a):t,i=e.length-1,h;i>=0;i--)(h=e[i])&&(l=(r?h(t,a,l):h(l))||l);return r&&l&&B(t,a,l),l};const G={light:"light",switch:"switch",cover:"cover",climate:"climate",fan:"fan",alarm:"alarm_control_panel",lock:"lock",door:"cover · door layer",script:"script",scene:"scene",helper:"input_boolean · input_number · input_select",humidifier:"humidifier",vacuum:"vacuum",siren:"siren",media:"media_player",number:"number",select:"select"},D={switch:s('רק מתגים שסומנו "בטוחים להפעלה מרוכזת"'),cover:s("לא שערים, דלתות ומה שמסומן בשכבת הדלתות"),alarm:s("דריכה ונטרול (מנהל מערכת יכול להגביל נטרול למטה); דורש הרשאה לתזמון פעולות רגישות"),lock:s("נעילה ופתיחה; דורש הרשאה לתזמון פעולות רגישות"),door:s("דלתות ושערים; דורש הרשאה לתזמון פעולות רגישות"),script:s("כל סקריפט, כולל סקריפט אזעקה; סקריפט שמנטרל או פותח מותר רק אחרי סימון של מנהל מערכת למטה"),scene:s("הפעלת סצנה"),humidifier:s("רק מה שההתקן מדווח שהוא תומך בו"),vacuum:s("התחלת ניקוי וחזרה לעמדה, לפי מה שהשואב תומך"),siren:s("הפעלה וכיבוי, צליל ומשך רק לפי מה שהצופר מדווח; דורש הרשאה לתזמון פעולות רגישות"),media:s("רק נגנים ומסכים מאושרים בהגדרות המולטימדיה, לפי הרשאות המולטימדיה ותקרת העוצמה"),number:s("רק בטווח ובקפיצות של ההתקן; לא ערכי הגדרה של התקנים"),select:s("רק האפשרויות שההתקן מציע; לא ערכי הגדרה של התקנים")},K=[{value:"repeat",label:s("חוזר")},{value:"pause",label:s("פעם אחת ואז מושהה (נשמר)")},{value:"single",label:s("פעם אחת ואז נמחק")}],g=[30,90,180,365];function V(e,t){const a=e.split(".").map(l=>parseInt(l,10)||0),r=t.split(".").map(l=>parseInt(l,10)||0);for(let l=0;l<Math.max(a.length,r.length);l++){const i=(a[l]??0)-(r[l]??0);if(i)return i<0}return!1}const X=[{role:s("צופה"),view:!1,manage:!1,sensitive:!1},{role:s("מפעיל"),view:!1,manage:!1,sensitive:!1},{role:s("עורך מפות ותצוגות"),view:!1,manage:!1,sensitive:!1},{role:s("מנהל אתר / מבנה / קומה"),view:!0,manage:!0,sensitive:!1,scoped:!0},{role:s("מנהל מערכת"),view:!0,manage:!0,sensitive:!0}];let o=class extends C{constructor(){super(...arguments),this.bubbleSkin=new T(this),this.status=null,this.saved={...y},this.draft={...y},this.sensors=[],this.error="",this.note="",this.busy=!1,this.help=!1,this.confirmSensor=!1,this.loaded=!1,this.scripts=[],this.canMark=!1,this.noteTimer=0,this.disarmAsk=!1,this.disarmWord=""}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.noteTimer)}async load(){this.error="";try{if(this.status=await S(),!this.status.can.configure){this.loaded=!0;return}const e=b()?k(await E(!0)):{...v().settings,classes:[...v().settings.classes]};this.saved=e,this.draft={...e,classes:[...e.classes]};try{this.sensors=(await P({domain:"binary_sensor"})).entities}catch{this.sensors=[]}await this.loadScripts()}catch(e){e instanceof $&&e.status===403?this.status=null:this.error=u(e)}finally{this.loaded=!0}}get unsuggestedPick(){const e=this.draft.shabbatSensor;if(!e||e===this.saved.shabbatSensor)return null;const t=this.sensors.find(a=>a.entity_id===e);return!t||!t.suggested_shabbat?t??{entity_id:e,name:e,domain:"binary_sensor",device_class:null,state:null,unit:null,numeric:!1,suggested_shabbat:!1}:null}requestSave(){this.unsuggestedPick?this.confirmSensor=!0:this.save(!1)}async persist(e){if(!e||!b())return _(this.saved,this.draft);const t=await z("settings",{...W(this.saved,this.draft),"schedules.shabbat_sensor_force":!0});return H(),k(t.settings)}get dirty(){const e=this.saved,t=this.draft;return e.enabled!==t.enabled||e.snapMinutes!==t.snapMinutes||e.defaultRepeat!==t.defaultRepeat||e.runsRetentionDays!==t.runsRetentionDays||e.shabbatSensor!==t.shabbatSensor||JSON.stringify(e.classes)!==JSON.stringify(t.classes)}patch(e){this.draft={...this.draft,...e},this.note=""}setClass(e,t){const a=new Set(this.draft.classes);t?a.add(e):a.delete(e),this.patch({classes:m.filter(r=>a.has(r))})}async setAllowDisarm(e,t=""){this.busy=!0,this.error="";try{const a=await _(this.saved,{...this.saved,allowDisarm:e},t);this.saved={...this.saved,allowDisarm:a.allowDisarm},this.draft={...this.draft,allowDisarm:a.allowDisarm},this.disarmAsk=!1,this.disarmWord="",this.note=e?s("נטרול אזעקה בתזמונים מותר."):s("נטרול אזעקה בתזמונים הוגבל."),window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",4e3)}catch(a){this.error=u(a)}finally{this.busy=!1}}async loadScripts(){try{const e=await I();this.scripts=e.scripts.filter(t=>t.approval.required),this.canMark=e.can_mark}catch{this.scripts=[],this.canMark=!1}}async setMark(e,t){this.busy=!0,this.error="";try{const a=await N(e,!t);this.scripts=this.scripts.map(r=>r.entity_id===e?{...r,approval:a.approval}:r),this.note=t?s("הסקריפט סומן כמותר בתזמונים."):s("הסימון הוסר."),window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",4e3)}catch(a){this.error=u(a)}finally{this.busy=!1}}renderScripts(){return n`<sw-card heading=${s("סקריפטים שמנטרלים או פותחים")} data-sched-scripts>
      ${this.scripts.length?this.scripts.map(e=>{const t=e.approval,a=e.effects_known?s("מנטרל אזעקה או פותח נעילה"):s("תוכן הסקריפט אינו ידוע למערכת"),r=t.approved?`${s("מותר בתזמונים")} · ${t.by?.display_name||t.by?.username||""}${t.at?` · ${x(t.at)}`:""}`:t.stale?s("הסימון בוטל: הסקריפט השתנה"):s("לא מסומן: אי אפשר לתזמן אותו");return n`<div class="row" data-script-row=${e.entity_id}>
              <span class="lbl">${e.name}<span class="muted">${a} · ${r}</span></span>
              <span class="end"><sw-badge kind=${t.approved?"live":"stale"} label=${t.approved?s("מותר"):s("חסום")}></sw-badge>
                <sw-toggle label=${`${e.name}: ${s("מותר בתזמונים")}`} labelHidden .checked=${f(t.approved)} ?disabled=${this.busy||!this.canMark} data-script-mark=${e.entity_id}
                  @change=${l=>void this.setMark(e.entity_id,l.detail.checked)}></sw-toggle></span>
            </div>`}):n`<p class="muted cardnote" data-scripts-empty>${s("אין סקריפטים שמנטרלים או פותחים.")}</p>`}
    </sw-card>`}renderDisarm(){const e=this.saved.allowDisarm;return n`<sw-card heading=${s("נטרול אזעקה בתזמונים")} data-sched-disarm>
      <div class="row">
        <span class="lbl" data-disarm-state>${e?s("נטרול אזעקה בתזמונים: מותר (ניתן להגביל)"):s("נטרול אזעקה בתזמונים: מוגבל")}<span class="muted">${e?s("עם הרשאת נטרול, הרשאה לפעולות רגישות ואישור מפורש בעורך. נטרול שדורש קוד לעולם אינו ניתן לתזמון."):s("מנהל מערכת הגביל. תזמון קיים נשמר כפי שהוא.")}</span></span>
        <span class="end"><sw-badge kind="stale" label=${s("רגיש")}></sw-badge><sw-toggle label=${s("נטרול אזעקה בתזמונים")} labelHidden .checked=${f(e)} ?disabled=${this.busy} data-allow-disarm
          @change=${t=>{t.detail.checked?(this.disarmAsk=!0,this.requestUpdate()):this.setAllowDisarm(!1)}}></sw-toggle></span>
      </div>
    </sw-card>`}async save(e){this.busy=!0,this.error="",this.confirmSensor=!1;try{const t=await this.persist(e);this.saved=t,this.draft={...t,classes:[...t.classes]},O({"schedules.enabled":String(t.enabled)}),this.note=s("ההגדרות נשמרו."),window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",4e3),S().then(a=>this.status=a).catch(()=>{})}catch(t){this.error=u(t),t instanceof $&&t.code==="not_calendar_sensor"&&!e&&(this.confirmSensor=!0)}finally{this.busy=!1}}cancel(){this.draft={...this.saved,classes:[...this.saved.classes]},this.error=""}renderConnection(e){const t=e.admin,a=t?.component==="found",r=t?.component==="missing",l=!!t&&!!t.bridge_version&&V(t.bridge_version,t.bridge_required),i=!!t&&!t.bridge_version;return n`<sw-card heading=${s("חיבור")} data-sched-connection>
      <div class="row">
        <span class="who"><span class=${a?"ic":r?"ic warn":"ic mute"}><sw-icon name=${a?"check":"warning"} size=${16}></sw-icon></span>
          <span class="lbl">${s("רכיב התזמונים (Scheduler)")}<span class="muted" data-component-line>${a?`${s("נמצא")} · ${s("גרסה {n}",{n:t?.component_version??"?"})} · ${s("דורש Home Assistant 2024.11.0 ומעלה")}${t?.ha_version?` · ${s("מותקן {version}",{version:t.ha_version})}`:""}`:r?s("לא נמצא"):s("לא נבדק")}</span></span></span>
        <sw-button size="sm" icon="refresh" data-recheck @click=${()=>void this.load()}>${s("בדיקה מחדש")}</sw-button>
      </div>
      <div class="row">
        <span class="who"><span class=${l||i?"ic warn":"ic"}><sw-icon name=${l||i?"warning":"check"} size=${16}></sw-icon></span>
          <span class="lbl">${s("גשר Arx")}<span class="muted">${i?s("לא מותקן (נדרש {version} ומעלה לשמירת תזמונים)",{version:t?.bridge_required??""}):`${s("גרסה {n} (נדרש {required} ומעלה)",{n:t?.bridge_version??"?",required:t?.bridge_required??"?"})}${l?` · ${s("נדרש עדכון של רכיב החיבור")}`:""}`}</span></span></span>
      </div>
      <div class="row">
        <span class="who"><span class="ic mute"><sw-icon name="clock" size=${16}></sw-icon></span>
          <span class="lbl">${s("סנכרון אחרון")}<span class="muted">${e.last_sync_at?x(e.last_sync_at):s("עדיין לא")} · ${s("{n} תזמונים",{n:e.counts.visible})}${e.counts.hidden?` · ${s("{n} מוסתרים מהמשתמש הנוכחי",{n:e.counts.hidden})}`:""}${e.stale?` · ${s("אין חיבור נוכחי")}`:""}</span></span></span>
      </div>
      <button type="button" class="link" aria-expanded=${this.help?"true":"false"} aria-controls="sched-help" data-help-toggle @click=${()=>this.help=!this.help}>${s("הרכיב לא מותקן? הוראות התקנה")}<sw-icon name="chevronDown" size=${14}></sw-icon></button>
      ${this.help?n`<ol id="sched-help" data-help>
            <li>${s('מתקינים את האינטגרציה המותאמת "Scheduler" (ב־HACS: "scheduler component"), או מעתיקים ידנית את התיקייה')} <code>custom_components/scheduler</code>.</li>
            <li>${s("מפעילים מחדש את Home Assistant.")}</li>
            <li>${s('בהגדרות ‹ מכשירים ושירותים ‹ הוספת אינטגרציה, בוחרים "Scheduler".')}</li>
            <li>${s('דרושה גרסת Home Assistant 2024.11.0 ומעלה. אחרי ההתקנה לוחצים "בדיקה מחדש".')}</li>
          </ol>`:p}
    </sw-card>`}renderOperation(){const e=this.draft,t=this.sensors.find(i=>i.entity_id===e.shabbatSensor),a=!e.shabbatSensor||!!t,r=this.sensors.filter(i=>i.suggested_shabbat),l=this.sensors.filter(i=>!i.suggested_shabbat);return n`<sw-card heading=${s("הפעלה")} data-sched-operation>
      <div class="row"><span class="lbl">${s('הצגת הטאב "תזמונים" במסך הראשי')}<span class="muted">${s("כבוי = הטאב אינו מוצג לאף משתמש והתזמונים ממשיכים לפעול ברכיב")}</span></span><sw-toggle label=${s("הצגת הטאב תזמונים")} labelHidden .checked=${e.enabled} data-set-enabled @change=${i=>this.patch({enabled:i.detail.checked})}></sw-toggle></div>
      <div class="row">
        <span class="lbl">${s("חיישן שבת וחג")}<span class="muted">${t?.state?s("מצב נוכחי: {state}",{state:t.state==="on"?s("איסור מלאכה בתוקף"):t.state==="off"?s("איסור מלאכה אינו בתוקף"):t.state}):s('משמש את התבניות "רק בשבת ובחג" ו"לא בשבת ובחג"')}</span></span>
        <sw-field class="ctl"><select aria-label=${s("חיישן שבת וחג")} data-shabbat-sensor @change=${i=>this.patch({shabbatSensor:i.target.value})}>
          <option value="" .selected=${!e.shabbatSensor}>${s("ללא חיישן")}</option>
          ${a?p:n`<option value=${e.shabbatSensor} selected>${e.shabbatSensor} ${s("(לא נמצא)")}</option>`}
          ${r.length?n`<optgroup label=${s("לוח שנה יהודי (מומלצים)")}>${r.map(i=>n`<option value=${i.entity_id} .selected=${i.entity_id===e.shabbatSensor}>${i.name}</option>`)}</optgroup>`:p}
          ${l.length?n`<optgroup label=${s("חיישנים אחרים")}>${l.map(i=>n`<option value=${i.entity_id} .selected=${i.entity_id===e.shabbatSensor}>${i.name}</option>`)}</optgroup>`:p}
        </select></sw-field>
      </div>
    </sw-card>`}renderClasses(){const e=this.draft,t=i=>n`<div class="row"><span class="lbl">${A[i]}<span class="muted"><code>${G[i]}</code>${D[i]?` · ${D[i]}`:""}</span></span>
          <span class="end">${w.includes(i)?n`<sw-badge kind="stale" label=${s("רגיש")}></sw-badge>`:p}<sw-toggle label=${A[i]} labelHidden .checked=${e.classes.includes(i)} data-class=${i} @change=${h=>this.setClass(i,h.detail.checked)}></sw-toggle></span></div>`,a=m.filter(i=>!w.includes(i)),r=m.filter(i=>w.includes(i)),l=i=>i.filter(h=>e.classes.includes(h)).length;return n`<sw-card heading=${s("סוגי התקנים מותרים בתזמון")} data-sched-classes>
      <div class="grouplabel">${s("רגילים")} · ${s("{n} מתוך {total}",{n:l(a),total:a.length})}</div>
      <div class="classgrid">${a.map(t)}</div>
      ${r.length?n`<div class="grouplabel">${s("רגישים: דורשים הרשאה לתזמון פעולות רגישות")} · ${s("{n} מתוך {total}",{n:l(r),total:r.length})}</div>
            <div class="classgrid">${r.map(t)}</div>`:p}
    </sw-card>`}renderDefaults(){const e=this.draft,t=g.includes(e.runsRetentionDays)?g:[...g,e.runsRetentionDays].sort((a,r)=>a-r);return n`<sw-card heading=${s("ברירות מחדל לעורך")} data-sched-defaults>
      <div class="row"><span class="lbl">${s("הצמדת זמן")}</span><sw-segmented label=${s("הצמדת זמן")} value=${String(e.snapMinutes)} @change=${a=>this.patch({snapMinutes:Number(a.detail.value)})}
      .options=${[5,15,30].map(a=>({value:String(a),label:s("{n} דק׳",{n:a}),attrs:{"data-snap":String(a)}}))}></sw-segmented></div>
      <div class="row"><span class="lbl">${s("סוג חזרה")}</span><sw-field class="ctl"><select aria-label=${s("סוג חזרה")} data-default-repeat @change=${a=>this.patch({defaultRepeat:a.target.value})}>${K.map(a=>n`<option value=${a.value} .selected=${a.value===e.defaultRepeat}>${a.label}</option>`)}</select></sw-field></div>
      <div class="row"><span class="lbl">${s("שמירת הרצות אחרונות")}</span><sw-field class="ctl"><select aria-label=${s("שמירת הרצות אחרונות")} data-retention @change=${a=>this.patch({runsRetentionDays:Number(a.target.value)})}>${t.map(a=>n`<option value=${a} .selected=${a===e.runsRetentionDays}>${s("{n} ימים",{n:a})}</option>`)}</select></sw-field></div>
    </sw-card>`}renderRoles(){const e=(a,r=!1)=>a?n`<sw-icon part="yes" name="check" size=${16} role="img" aria-label=${s("כן")}></sw-icon>${r?n`<span class="mut"> ${s("בהיקף")}</span>`:p}`:n`<span part="no" aria-label=${s("לא")}>—</span>`,t=[{key:"role",label:s("תפקיד"),render:a=>n`<span class="t1">${a.role}</span>`},{key:"view",label:s("צפייה"),align:"center",render:a=>e(a.view)},{key:"manage",label:s("ניהול"),align:"center",render:a=>e(a.manage,a.scoped)},{key:"sensitive",label:s("רגיש"),align:"center",render:a=>e(a.sensitive)}];return n`<sw-card heading=${s("מי רשאי מה")} data-sched-roles>
      <sw-table class="set-matrix" bare static-rows keep-columns data-sched-roles-table rowKey="role" .columns=${t} .rows=${X}
        .rowAttrs=${a=>({"data-sched-role":String(a.role)})}></sw-table>
      <p class="muted rolesnote">${s("ברירות המחדל. ניהול תזמונים ותזמון פעולות רגישות (אזעקה, צופרים, מנעולים, דלתות ושערים) ניתנים במפורש לכל משתמש או תפקיד, בהיקף שבחרתם.")}</p>
      <sw-button size="sm" data-open-access @click=${()=>L("/system/access")}>${s("משתמשים והרשאות")}</sw-button>
    </sw-card>`}render(){if(!this.loaded)return n`<sw-page crumbs=${s("הגדרות")} heading=${s("תזמונים")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.error&&!this.status)return n`<sw-page crumbs=${s("הגדרות")} heading=${s("תזמונים")}><sw-state-panel state="error" hint=${this.error} actionLabel=${s("נסו שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const e=this.status;if(!e||!e.can.configure)return n`<sw-page crumbs=${s("הגדרות")} heading=${s("תזמונים")}><sw-state-panel state="forbidden" data-schedules-settings-forbidden></sw-state-panel></sw-page>`;const t=this.unsuggestedPick;return n`<sw-page crumbs=${s("הגדרות")} heading=${s("תזמונים")} subheading=${s("רק למנהל מערכת. מסך התזמונים של המשתמשים אינו מציג הגדרות אלה.")} wide data-schedules-settings>
      ${this.confirmSensor?n`<sw-dialog open heading=${s("חיישן שבת וחג")} data-sensor-confirm @close=${()=>this.confirmSensor=!1}>
            <p class="dlgtext">${s("חיישן שאינו לוח שנה יהודי - להשתמש בו בכל זאת?")}${t?n`<br /><b>${t.name}</b> <code>${t.entity_id}</code>`:p}</p>
            <sw-button slot="footer" variant="ghost" data-sensor-cancel @click=${()=>this.confirmSensor=!1}>${s("ביטול")}</sw-button>
            <sw-button slot="footer" variant="primary" data-sensor-force @click=${()=>void this.save(!0)}>${s("כן, להשתמש בו")}</sw-button>
          </sw-dialog>`:p}
      ${this.disarmAsk?n`<sw-dialog open heading=${s("להסיר את ההגבלה על נטרול אזעקה בתזמונים?")} data-disarm-confirm @close=${()=>{this.disarmAsk=!1,this.disarmWord=""}}>
            <p class="dlgtext">${s("תזמון יוכל לנטרל לוח אזעקה בלי שאיש נמצא במקום. רק מנהל מערכת, נרשם ביומן. להמשך הקלידו")} <b data-disarm-word-shown>${U("schedules_allow_disarm")}</b></p>
            <sw-field><input aria-label=${s("אישור מוקלד")} data-disarm-word .value=${this.disarmWord} @input=${a=>this.disarmWord=a.target.value} /></sw-field>
            <sw-button slot="footer" variant="ghost" data-disarm-cancel @click=${()=>{this.disarmAsk=!1,this.disarmWord=""}}>${s("ביטול")}</sw-button>
            <sw-button slot="footer" variant="danger" data-disarm-ok ?disabled=${!J("schedules_allow_disarm",this.disarmWord)||this.busy} @click=${()=>void this.setAllowDisarm(!0,this.disarmWord)}>${s("אפשר")}</sw-button>
          </sw-dialog>`:p}
      <div class="cols">
        <div class="col set-col">${this.renderConnection(e)}${this.renderOperation()}${this.renderClasses()}${this.renderDisarm()}${this.renderScripts()}</div>
        <div class="col set-col">${this.renderDefaults()}<sw-list-display-settings list="schedules"></sw-list-display-settings>${this.renderRoles()}</div>
      </div>
      ${this.dirty||this.note||this.error?n`<div class="savebar" data-settings-bar>
            ${this.error?n`<span class="msg err" role="alert" data-settings-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:this.note?n`<span class="msg ok" role="status" data-settings-saved><sw-icon name="check" size=${13}></sw-icon>${this.note}</span>`:n`<span class="dirty">${s("יש שינויים שלא נשמרו.")}</span>`}
            <span class="grow"></span>
            ${this.dirty?n`<sw-button variant="ghost" data-settings-cancel @click=${()=>this.cancel()}>${s("ביטול")}</sw-button><sw-button variant="primary" icon="check" data-settings-save ?disabled=${this.busy} @click=${()=>this.requestSave()}>${this.busy?s("שומר…"):s("שמירה")}</sw-button>`:p}
          </div>`:p}
    </sw-page>`}};o.styles=[j,R`
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr);
      gap: var(--sw-s-3);
      align-items: start;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .who {
      display: flex;
      gap: var(--sw-s-3);
      align-items: center;
      min-inline-size: 0;
    }
    .mono {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 34px;
      block-size: 34px;
      border-radius: var(--sw-r-md);
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
      flex: none;
    }
    .ic.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-warning-text);
    }
    .ic.mute {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    ol {
      margin: 8px 0 0;
      padding: 12px 16px;
      padding-inline-start: 34px;
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    /* SCHED-POLISH-2331: the help disclosure is a real control (aria-expanded, a drawn chevron, a focus ring, a 32 px target), not a
       text link with a unicode arrow */
    .link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 32px;
      margin-block-start: var(--sw-s-2);
      padding: 0 4px;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      background: none;
      border: 0;
      border-radius: var(--sw-r-sm);
    }
    .link sw-icon {
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .link[aria-expanded='true'] sw-icon {
      transform: rotate(180deg);
    }
    .link:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .cardnote {
      margin: 6px 0 0;
    }
    .dlgtext {
      margin: 0;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .dlgtext + sw-field {
      margin-block-start: 10px;
    }
    /* the device classes: two columns of wells where the column is wide enough, the sensitive ones grouped under their own label */
    .classgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
      gap: 8px;
    }
    .classgrid .row + .row {
      margin-block-start: 0;
    }
    .classgrid + .grouplabel {
      margin-block-start: var(--sw-s-4);
    }
    .rolesnote {
      margin: 12px 0 10px;
    }
    .savebar {
      max-inline-size: none;
    }
    /* SCHED-POLISH-2331 -> SHARED-POLISH-2342: a column narrower than a label plus a 240 px control stacks its rows (the label above
       the control) - the shared .set-col of styles/settings.ts (the side column at 1440 / 1180) */
    @media (max-width: 1023px) {
      .cols {
        grid-template-columns: 1fr;
      }
    }
  `,q];d([c()],o.prototype,"status",2);d([c()],o.prototype,"saved",2);d([c()],o.prototype,"draft",2);d([c()],o.prototype,"sensors",2);d([c()],o.prototype,"error",2);d([c()],o.prototype,"note",2);d([c()],o.prototype,"busy",2);d([c()],o.prototype,"help",2);d([c()],o.prototype,"confirmSensor",2);d([c()],o.prototype,"loaded",2);d([c()],o.prototype,"scripts",2);d([c()],o.prototype,"canMark",2);d([c()],o.prototype,"disarmAsk",2);d([c()],o.prototype,"disarmWord",2);o=d([M("system-schedules")],o);export{o as SystemSchedules};
