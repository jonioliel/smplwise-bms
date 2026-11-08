import{a as C,S as T,g1 as m,fx as b,i as f,g2 as v,K as z,g3 as $,g4 as O,j as y,f0 as p,g5 as S,b9 as E,g6 as L,g7 as u,g8 as R,g9 as H,fd as k,e as i,ga as M,A as c,ak as P,gb as _,gc as x,gd as g,ge as I,C as W,E as N,G as d,gf as q,H as j}from"./index-CCDqf4A8.js";import{l as A}from"./live-Bmo4JGtS.js";import"./sw-list-display-settings-1m9vNuBj.js";import"./sw-logo-art-Va6y_cIM.js";var U=Object.defineProperty,G=Object.getOwnPropertyDescriptor,o=(s,e,t,n)=>{for(var r=n>1?void 0:n?G(e,t):e,a=s.length-1,h;a>=0;a--)(h=s[a])&&(r=(n?h(e,t,r):h(r))||r);return n&&r&&U(e,t,r),r};const J={light:"light",switch:"switch",cover:"cover",climate:"climate",fan:"fan",alarm:"alarm_control_panel",lock:"lock",door:"cover · door layer",script:"script",scene:"scene",helper:"input_boolean · input_number · input_select",humidifier:"humidifier",vacuum:"vacuum",siren:"siren",media:"media_player",number:"number",select:"select"},D={switch:'רק מתגים שסומנו "בטוחים להפעלה מרוכזת"',cover:"לא שערים, דלתות ומה שמסומן בשכבת הדלתות",alarm:"דריכה ונטרול (מנהל מערכת יכול להגביל נטרול למטה); דורש הרשאה לתזמון פעולות רגישות",lock:"נעילה ופתיחה; דורש הרשאה לתזמון פעולות רגישות",door:"דלתות ושערים; דורש הרשאה לתזמון פעולות רגישות",script:"כל סקריפט, כולל סקריפט אזעקה; סקריפט שמנטרל או פותח מותר רק אחרי סימון של מנהל מערכת למטה",scene:"הפעלת סצנה",humidifier:"רק מה שההתקן מדווח שהוא תומך בו",vacuum:"התחלת ניקוי וחזרה לעמדה, לפי מה שהשואב תומך",siren:"הפעלה וכיבוי, צליל ומשך רק לפי מה שהצופר מדווח; דורש הרשאה לתזמון פעולות רגישות",media:"רק נגנים ומסכים מאושרים בהגדרות המולטימדיה, לפי הרשאות המולטימדיה ותקרת העוצמה",number:"רק בטווח ובקפיצות של ההתקן; לא ערכי הגדרה של התקנים",select:"רק האפשרויות שההתקן מציע; לא ערכי הגדרה של התקנים"},B=[{value:"repeat",label:"חוזר"},{value:"pause",label:"פעם אחת ואז מושהה (נשמר)"},{value:"single",label:"פעם אחת ואז נמחק"}],w=[30,90,180,365];function F(s,e){const t=s.split(".").map(r=>parseInt(r,10)||0),n=e.split(".").map(r=>parseInt(r,10)||0);for(let r=0;r<Math.max(t.length,n.length);r++){const a=(t[r]??0)-(n[r]??0);if(a)return a<0}return!1}const K=[{role:"צופה",view:!1,manage:!1,sensitive:!1},{role:"מפעיל",view:!1,manage:!1,sensitive:!1},{role:"עורך מפות ותצוגות",view:!1,manage:!1,sensitive:!1},{role:"מנהל אתר / מבנה / קומה",view:!0,manage:!0,sensitive:!1,scoped:!0},{role:"מנהל מערכת",view:!0,manage:!0,sensitive:!0}];let l=class extends C{constructor(){super(...arguments),this.bubbleSkin=new T(this),this.status=null,this.saved={...m},this.draft={...m},this.sensors=[],this.error="",this.note="",this.busy=!1,this.help=!1,this.confirmSensor=!1,this.loaded=!1,this.scripts=[],this.canMark=!1,this.noteTimer=0,this.disarmAsk=!1,this.disarmWord=""}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.noteTimer)}async load(){this.error="";try{if(this.status=await b(),!this.status.can.configure){this.loaded=!0;return}const s=f()?v(await z(!0)):{...$().settings,classes:[...$().settings.classes]};this.saved=s,this.draft={...s,classes:[...s.classes]};try{this.sensors=(await O({domain:"binary_sensor"})).entities}catch{this.sensors=[]}await this.loadScripts()}catch(s){s instanceof y&&s.status===403?this.status=null:this.error=p(s)}finally{this.loaded=!0}}get unsuggestedPick(){const s=this.draft.shabbatSensor;if(!s||s===this.saved.shabbatSensor)return null;const e=this.sensors.find(t=>t.entity_id===s);return!e||!e.suggested_shabbat?e??{entity_id:s,name:s,domain:"binary_sensor",device_class:null,state:null,unit:null,numeric:!1,suggested_shabbat:!1}:null}requestSave(){this.unsuggestedPick?this.confirmSensor=!0:this.save(!1)}async persist(s){if(!s||!f())return S(this.saved,this.draft);const e=await E("settings",{...L(this.saved,this.draft),"schedules.shabbat_sensor_force":!0});return q(),v(e.settings)}get dirty(){const s=this.saved,e=this.draft;return s.enabled!==e.enabled||s.snapMinutes!==e.snapMinutes||s.defaultRepeat!==e.defaultRepeat||s.runsRetentionDays!==e.runsRetentionDays||s.shabbatSensor!==e.shabbatSensor||JSON.stringify(s.classes)!==JSON.stringify(e.classes)}patch(s){this.draft={...this.draft,...s},this.note=""}setClass(s,e){const t=new Set(this.draft.classes);e?t.add(s):t.delete(s),this.patch({classes:u.filter(n=>t.has(n))})}async setAllowDisarm(s,e=""){this.busy=!0,this.error="";try{const t=await S(this.saved,{...this.saved,allowDisarm:s},e);this.saved={...this.saved,allowDisarm:t.allowDisarm},this.draft={...this.draft,allowDisarm:t.allowDisarm},this.disarmAsk=!1,this.disarmWord="",this.note=s?"נטרול אזעקה בתזמונים מותר.":"נטרול אזעקה בתזמונים הוגבל.",window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",4e3)}catch(t){this.error=p(t)}finally{this.busy=!1}}async loadScripts(){try{const s=await R();this.scripts=s.scripts.filter(e=>e.approval.required),this.canMark=s.can_mark}catch{this.scripts=[],this.canMark=!1}}async setMark(s,e){this.busy=!0,this.error="";try{const t=await H(s,!e);this.scripts=this.scripts.map(n=>n.entity_id===s?{...n,approval:t.approval}:n),this.note=e?"הסקריפט סומן כמותר בתזמונים.":"הסימון הוסר.",window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",4e3)}catch(t){this.error=p(t)}finally{this.busy=!1}}renderScripts(){return i`<sw-card heading="סקריפטים שמנטרלים או פותחים" data-sched-scripts>
      ${this.scripts.length?this.scripts.map(s=>{const e=s.approval,t=s.effects_known?"מנטרל אזעקה או פותח נעילה":"תוכן הסקריפט אינו ידוע למערכת",n=e.approved?`מותר בתזמונים · ${e.by?.display_name||e.by?.username||""}${e.at?` · ${k(e.at)}`:""}`:e.stale?"הסימון בוטל: הסקריפט השתנה":"לא מסומן: אי אפשר לתזמן אותו";return i`<div class="row" data-script-row=${s.entity_id}>
              <span class="lbl">${s.name}<span class="muted">${t} · ${n}</span></span>
              <span class="end"><sw-badge kind=${e.approved?"live":"stale"} label=${e.approved?"מותר":"חסום"}></sw-badge>
                <sw-toggle label=${`${s.name}: מותר בתזמונים`} labelHidden .checked=${A(e.approved)} ?disabled=${this.busy||!this.canMark} data-script-mark=${s.entity_id}
                  @change=${r=>void this.setMark(s.entity_id,r.detail.checked)}></sw-toggle></span>
            </div>`}):i`<p class="muted cardnote" data-scripts-empty>אין סקריפטים שמנטרלים או פותחים.</p>`}
    </sw-card>`}renderDisarm(){const s=this.saved.allowDisarm;return i`<sw-card heading="נטרול אזעקה בתזמונים" data-sched-disarm>
      <div class="row">
        <span class="lbl" data-disarm-state>${s?"נטרול אזעקה בתזמונים: מותר (ניתן להגביל)":"נטרול אזעקה בתזמונים: מוגבל"}<span class="muted">${s?"עם הרשאת נטרול, הרשאה לפעולות רגישות ואישור מפורש בעורך. נטרול שדורש קוד לעולם אינו ניתן לתזמון.":"מנהל מערכת הגביל. תזמון קיים נשמר כפי שהוא."}</span></span>
        <span class="end"><sw-badge kind="stale" label="רגיש"></sw-badge><sw-toggle label="נטרול אזעקה בתזמונים" labelHidden .checked=${A(s)} ?disabled=${this.busy} data-allow-disarm
          @change=${e=>{e.detail.checked?(this.disarmAsk=!0,this.requestUpdate()):this.setAllowDisarm(!1)}}></sw-toggle></span>
      </div>
    </sw-card>`}async save(s){this.busy=!0,this.error="",this.confirmSensor=!1;try{const e=await this.persist(s);this.saved=e,this.draft={...e,classes:[...e.classes]},M({"schedules.enabled":String(e.enabled)}),this.note="ההגדרות נשמרו.",window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",4e3),b().then(t=>this.status=t).catch(()=>{})}catch(e){this.error=p(e),e instanceof y&&e.code==="not_calendar_sensor"&&!s&&(this.confirmSensor=!0)}finally{this.busy=!1}}cancel(){this.draft={...this.saved,classes:[...this.saved.classes]},this.error=""}renderConnection(s){const e=s.admin,t=e?.component==="found",n=e?.component==="missing",r=!!e&&!!e.bridge_version&&F(e.bridge_version,e.bridge_required),a=!!e&&!e.bridge_version;return i`<sw-card heading="חיבור" data-sched-connection>
      <div class="row">
        <span class="who"><span class=${t?"ic":n?"ic warn":"ic mute"}><sw-icon name=${t?"check":"warning"} size=${16}></sw-icon></span>
          <span class="lbl">רכיב התזמונים (Scheduler)<span class="muted" data-component-line>${t?`נמצא · גרסה ${e?.component_version??"?"} · דורש Home Assistant 2024.11.0 ומעלה${e?.ha_version?` · מותקן ${e.ha_version}`:""}`:n?"לא נמצא":"לא נבדק"}</span></span></span>
        <sw-button size="sm" icon="refresh" data-recheck @click=${()=>void this.load()}>בדיקה מחדש</sw-button>
      </div>
      <div class="row">
        <span class="who"><span class=${r||a?"ic warn":"ic"}><sw-icon name=${r||a?"warning":"check"} size=${16}></sw-icon></span>
          <span class="lbl">גשר Arx<span class="muted">${a?`לא מותקן (נדרש ${e?.bridge_required??""} ומעלה לשמירת תזמונים)`:`גרסה ${e?.bridge_version??"?"} (נדרש ${e?.bridge_required??"?"} ומעלה)${r?" · נדרש עדכון של רכיב החיבור":""}`}</span></span></span>
      </div>
      <div class="row">
        <span class="who"><span class="ic mute"><sw-icon name="clock" size=${16}></sw-icon></span>
          <span class="lbl">סנכרון אחרון<span class="muted">${s.last_sync_at?k(s.last_sync_at):"עדיין לא"} · ${s.counts.visible} תזמונים${s.counts.hidden?` · ${s.counts.hidden} מוסתרים מהמשתמש הנוכחי`:""}${s.stale?" · אין חיבור נוכחי":""}</span></span></span>
      </div>
      <button type="button" class="link" aria-expanded=${this.help?"true":"false"} aria-controls="sched-help" data-help-toggle @click=${()=>this.help=!this.help}>הרכיב לא מותקן? הוראות התקנה<sw-icon name="chevronDown" size=${14}></sw-icon></button>
      ${this.help?i`<ol id="sched-help" data-help>
            <li>מתקינים את האינטגרציה המותאמת "Scheduler" (ב־HACS: "scheduler component"), או מעתיקים ידנית את התיקייה <code>custom_components/scheduler</code>.</li>
            <li>מפעילים מחדש את Home Assistant.</li>
            <li>בהגדרות ‹ מכשירים ושירותים ‹ הוספת אינטגרציה, בוחרים "Scheduler".</li>
            <li>דרושה גרסת Home Assistant 2024.11.0 ומעלה. אחרי ההתקנה לוחצים "בדיקה מחדש".</li>
          </ol>`:c}
    </sw-card>`}renderOperation(){const s=this.draft,e=this.sensors.find(a=>a.entity_id===s.shabbatSensor),t=!s.shabbatSensor||!!e,n=this.sensors.filter(a=>a.suggested_shabbat),r=this.sensors.filter(a=>!a.suggested_shabbat);return i`<sw-card heading="הפעלה" data-sched-operation>
      <div class="row"><span class="lbl">הצגת הטאב "תזמונים" במסך הראשי<span class="muted">כבוי = הטאב אינו מוצג לאף משתמש והתזמונים ממשיכים לפעול ברכיב</span></span><sw-toggle label="הצגת הטאב תזמונים" labelHidden .checked=${s.enabled} data-set-enabled @change=${a=>this.patch({enabled:a.detail.checked})}></sw-toggle></div>
      <div class="row">
        <span class="lbl">חיישן שבת וחג<span class="muted">${e?.state?`מצב נוכחי: ${e.state==="on"?"איסור מלאכה בתוקף":e.state==="off"?"איסור מלאכה אינו בתוקף":e.state}`:'משמש את התבניות "רק בשבת ובחג" ו"לא בשבת ובחג"'}</span></span>
        <sw-field class="ctl"><select aria-label="חיישן שבת וחג" data-shabbat-sensor @change=${a=>this.patch({shabbatSensor:a.target.value})}>
          <option value="" .selected=${!s.shabbatSensor}>ללא חיישן</option>
          ${t?c:i`<option value=${s.shabbatSensor} selected>${s.shabbatSensor} (לא נמצא)</option>`}
          ${n.length?i`<optgroup label="לוח שנה יהודי (מומלצים)">${n.map(a=>i`<option value=${a.entity_id} .selected=${a.entity_id===s.shabbatSensor}>${a.name}</option>`)}</optgroup>`:c}
          ${r.length?i`<optgroup label="חיישנים אחרים">${r.map(a=>i`<option value=${a.entity_id} .selected=${a.entity_id===s.shabbatSensor}>${a.name}</option>`)}</optgroup>`:c}
        </select></sw-field>
      </div>
    </sw-card>`}renderClasses(){const s=this.draft,e=a=>i`<div class="row"><span class="lbl">${x[a]}<span class="muted"><code>${J[a]}</code>${D[a]?` · ${D[a]}`:""}</span></span>
          <span class="end">${g.includes(a)?i`<sw-badge kind="stale" label="רגיש"></sw-badge>`:c}<sw-toggle label=${x[a]} labelHidden .checked=${s.classes.includes(a)} data-class=${a} @change=${h=>this.setClass(a,h.detail.checked)}></sw-toggle></span></div>`,t=u.filter(a=>!g.includes(a)),n=u.filter(a=>g.includes(a)),r=a=>a.filter(h=>s.classes.includes(h)).length;return i`<sw-card heading="סוגי התקנים מותרים בתזמון" data-sched-classes>
      <div class="grouplabel">רגילים · ${r(t)} מתוך ${t.length}</div>
      <div class="classgrid">${t.map(e)}</div>
      ${n.length?i`<div class="grouplabel">רגישים: דורשים הרשאה לתזמון פעולות רגישות · ${r(n)} מתוך ${n.length}</div>
            <div class="classgrid">${n.map(e)}</div>`:c}
    </sw-card>`}renderDefaults(){const s=this.draft,e=w.includes(s.runsRetentionDays)?w:[...w,s.runsRetentionDays].sort((t,n)=>t-n);return i`<sw-card heading="ברירות מחדל לעורך" data-sched-defaults>
      <div class="row"><span class="lbl">הצמדת זמן</span><span class="seg" role="group" aria-label="הצמדת זמן">${[5,15,30].map(t=>i`<button type="button" data-snap=${t} aria-pressed=${s.snapMinutes===t} @click=${()=>this.patch({snapMinutes:t})}>${t} דק׳</button>`)}</span></div>
      <div class="row"><span class="lbl">סוג חזרה</span><sw-field class="ctl"><select aria-label="סוג חזרה" data-default-repeat @change=${t=>this.patch({defaultRepeat:t.target.value})}>${B.map(t=>i`<option value=${t.value} .selected=${t.value===s.defaultRepeat}>${t.label}</option>`)}</select></sw-field></div>
      <div class="row"><span class="lbl">שמירת הרצות אחרונות</span><sw-field class="ctl"><select aria-label="שמירת הרצות אחרונות" data-retention @change=${t=>this.patch({runsRetentionDays:Number(t.target.value)})}>${e.map(t=>i`<option value=${t} .selected=${t===s.runsRetentionDays}>${t} ימים</option>`)}</select></sw-field></div>
    </sw-card>`}renderRoles(){const s=(e,t=!1)=>i`<td class=${e?"yes":"no"}>${e?i`<sw-icon name="check" size=${16} role="img" aria-label="כן"></sw-icon>${t?i`<span class="muted"> בהיקף</span>`:c}`:i`<span aria-label="לא">—</span>`}</td>`;return i`<sw-card heading="מי רשאי מה" data-sched-roles>
      <table><thead><tr><th scope="col">תפקיד</th><th scope="col">צפייה</th><th scope="col">ניהול</th><th scope="col">רגיש</th></tr></thead>
        <tbody>${K.map(e=>i`<tr><td>${e.role}</td>${s(e.view)}${s(e.manage,e.scoped)}${s(e.sensitive)}</tr>`)}</tbody></table>
      <p class="muted rolesnote">ברירות המחדל. ניהול תזמונים ותזמון פעולות רגישות (אזעקה, צופרים, מנעולים, דלתות ושערים) ניתנים במפורש לכל משתמש או תפקיד, בהיקף שבחרתם.</p>
      <sw-button size="sm" data-open-access @click=${()=>P("/system/access")}>משתמשים והרשאות</sw-button>
    </sw-card>`}render(){if(!this.loaded)return i`<sw-page crumbs="הגדרות" heading="תזמונים"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.error&&!this.status)return i`<sw-page crumbs="הגדרות" heading="תזמונים"><sw-state-panel state="error" hint=${this.error} actionLabel="נסו שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const s=this.status;if(!s||!s.can.configure)return i`<sw-page crumbs="הגדרות" heading="תזמונים"><sw-state-panel state="forbidden" data-schedules-settings-forbidden></sw-state-panel></sw-page>`;const e=this.unsuggestedPick;return i`<sw-page crumbs="הגדרות" heading="תזמונים" subheading="רק למנהל מערכת. מסך התזמונים של המשתמשים אינו מציג הגדרות אלה." wide data-schedules-settings>
      ${this.confirmSensor?i`<sw-dialog open heading="חיישן שבת וחג" data-sensor-confirm @close=${()=>this.confirmSensor=!1}>
            <p class="dlgtext">חיישן שאינו לוח שנה יהודי - להשתמש בו בכל זאת?${e?i`<br /><b>${e.name}</b> <code>${e.entity_id}</code>`:c}</p>
            <sw-button slot="footer" variant="ghost" data-sensor-cancel @click=${()=>this.confirmSensor=!1}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-sensor-force @click=${()=>void this.save(!0)}>כן, להשתמש בו</sw-button>
          </sw-dialog>`:c}
      ${this.disarmAsk?i`<sw-dialog open heading="להסיר את ההגבלה על נטרול אזעקה בתזמונים?" data-disarm-confirm @close=${()=>{this.disarmAsk=!1,this.disarmWord=""}}>
            <p class="dlgtext">תזמון יוכל לנטרל לוח אזעקה בלי שאיש נמצא במקום. רק מנהל מערכת, נרשם ביומן. להמשך הקלידו <b>${_}</b></p>
            <sw-field><input aria-label="אישור מוקלד" data-disarm-word .value=${this.disarmWord} @input=${t=>this.disarmWord=t.target.value} /></sw-field>
            <sw-button slot="footer" variant="ghost" data-disarm-cancel @click=${()=>{this.disarmAsk=!1,this.disarmWord=""}}>ביטול</sw-button>
            <sw-button slot="footer" variant="danger" data-disarm-ok ?disabled=${this.disarmWord.trim()!==_||this.busy} @click=${()=>void this.setAllowDisarm(!0,this.disarmWord)}>אפשר</sw-button>
          </sw-dialog>`:c}
      <div class="cols">
        <div class="col set-col">${this.renderConnection(s)}${this.renderOperation()}${this.renderClasses()}${this.renderDisarm()}${this.renderScripts()}</div>
        <div class="col set-col">${this.renderDefaults()}<sw-list-display-settings list="schedules"></sw-list-display-settings>${this.renderRoles()}</div>
      </div>
      ${this.dirty||this.note||this.error?i`<div class="savebar" data-settings-bar>
            ${this.error?i`<span class="msg err" role="alert" data-settings-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:this.note?i`<span class="msg ok" role="status" data-settings-saved><sw-icon name="check" size=${13}></sw-icon>${this.note}</span>`:i`<span class="dirty">יש שינויים שלא נשמרו.</span>`}
            <span class="grow"></span>
            ${this.dirty?i`<sw-button variant="ghost" data-settings-cancel @click=${()=>this.cancel()}>ביטול</sw-button><sw-button variant="primary" icon="check" data-settings-save ?disabled=${this.busy} @click=${()=>this.requestSave()}>${this.busy?"שומר…":"שמירה"}</sw-button>`:c}
          </div>`:c}
    </sw-page>`}};l.styles=[I,N`
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
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-base);
    }
    th {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
      text-align: center;
      padding: 6px 8px 8px;
      border-block-end: 1px solid var(--sw-border-strong);
    }
    th:first-child,
    td:first-child {
      text-align: start;
    }
    td {
      text-align: center;
      padding: 10px 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    td:first-child {
      color: var(--sw-heading, var(--sw-text));
      font-weight: var(--sw-fw-medium);
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    .rolesnote {
      margin: 12px 0 10px;
    }
    td.yes {
      color: var(--sw-success-text);
    }
    td.no {
      color: var(--sw-text-3);
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
  `,W];o([d()],l.prototype,"status",2);o([d()],l.prototype,"saved",2);o([d()],l.prototype,"draft",2);o([d()],l.prototype,"sensors",2);o([d()],l.prototype,"error",2);o([d()],l.prototype,"note",2);o([d()],l.prototype,"busy",2);o([d()],l.prototype,"help",2);o([d()],l.prototype,"confirmSensor",2);o([d()],l.prototype,"loaded",2);o([d()],l.prototype,"scripts",2);o([d()],l.prototype,"canMark",2);o([d()],l.prototype,"disarmAsk",2);o([d()],l.prototype,"disarmWord",2);l=o([j("system-schedules")],l);export{l as SystemSchedules};
//# sourceMappingURL=system-schedules-DXJkiyci.js.map
