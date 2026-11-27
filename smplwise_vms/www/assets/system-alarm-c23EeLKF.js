import{j as x,z as y,k as h,a as k,aX as P,af as $,fB as E,fC as I,q as _,fD as C,b as r,A as p,aU as A,fE as T,fF as R,fG as O,fH as j,fI as f,c as q,s as N,fJ as U,fK as H,fL as L,fM as M,dl as W,m as z}from"./index-B3MtI4W-.js";import{b as S}from"./bubble-chrome-DDhlu7Od.js";import{c as B}from"./confirm-dialog-Dgn7HeVn.js";import{t as e}from"./system-a-Brw-G6hH.js";var G=Object.defineProperty,V=Object.getOwnPropertyDescriptor,l=(s,t,a,n)=>{for(var i=n>1?void 0:n?V(t,a):t,d=s.length-1,m;d>=0;d--)(m=s[d])&&(i=(n?m(t,a,i):m(i))||i);return n&&i&&G(t,a,i),i};const Y={device:e("אותו device"),zone_id:e("מזהה אזור (unique id)"),entity_id:e("שורש entity id"),unique_id:e("שורש unique id"),name:e("שם"),zone_number:e("מספר אזור"),override:e("שיוך ידני")},D=x`
  :host {
    display: block;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-block-end: 1px solid var(--sw-border);
  }
  .row:last-child {
    border-block-end: 0;
  }
  /* R5-SECURITY: the setting's name 14/700 in the heading ink, its note 12.5 */
  .lbl {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading, var(--sw-text));
    min-inline-size: 0;
    flex: 1 1 260px;
  }
  .muted {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-regular);
  }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-xs);
  }
  /* NATIVE-SELECT-A-2480: the selects sit in the shared field (sw-field); the field keeps the select's own place in the line (a table
     cell, a row), the look below stays the screen's */
  sw-field {
    display: inline-flex;
    max-inline-size: 100%;
  }
  select,
  input {
    font: inherit;
    font-size: var(--sw-fs-sm);
    padding: 6px 8px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    max-inline-size: 100%;
  }
  input[type='password'] {
    direction: ltr;
    letter-spacing: 0.2em;
    inline-size: 140px;
  }
  select:focus-visible,
  input:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  /* POLISH4-WP7: the saved / error line is the same pill as the rest of the settings (--sw-*-soft ground, -text ink); a bare
     --sw-danger text did not reach contrast on a light card */
  .ok,
  .err {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    min-block-size: 28px;
    padding: 2px 12px;
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  .ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .inline {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  /* POLISH4-WP7 (D16): the phone layout, shared by the alarm settings and the per-user alarm card. A row stacks its name over its
     control, a control takes the whole line (a select or the code field at its natural width left a ragged edge at 390) and the
     buttons beside the code field stay on that line. */
  @media (max-width: 767px) {
    .row {
      flex-direction: column;
      align-items: stretch;
      gap: var(--sw-s-2);
    }
    .lbl {
      flex-basis: auto;
    }
    .row select,
    .row input {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: var(--sw-ctl-h-lg);
    }
    .inline {
      flex-wrap: nowrap;
    }
    .inline input[type='password'] {
      inline-size: auto;
      flex: 1 1 0;
      min-inline-size: 0;
    }
    .inline sw-button {
      flex: none;
    }
  }
`;let v=class extends k{constructor(){super(...arguments),this.bubbleSkin=new P(this),this.canEdit=!1,this.cfg=null,this.error="",this.message="",this.busy=!1,this.codeDraft={}}connectedCallback(){super.connectedCallback(),this.load()}async load(){if($())try{this.cfg=await E(),I(this.cfg.panels.length),this.error=""}catch(s){this.error=_(s)}}async run(s,t){this.busy=!0,this.message="",this.error="";try{await s(),this.message=t,await this.load()}catch(a){this.error=_(a)}finally{this.busy=!1}}async setting(s,t){await this.run(async()=>{await C({[s]:t}),W()},e("נשמר"))}render(){if(!$())return r`<sw-card heading=${e("אזעקה")}><div class="muted">${e("נתוני הדגמה: הגדרות האזעקה זמינות רק מול השרת.")}</div></sw-card>`;if(this.error&&!this.cfg)return r`<sw-card heading=${e("אזעקה")}><sw-state-panel state="error" heading=${e("לא ניתן לטעון את הגדרות האזעקה")} hint=${this.error}></sw-state-panel></sw-card>`;if(!this.cfg)return r`<sw-card heading=${e("אזעקה")}><sw-state-panel state="loading"></sw-state-panel></sw-card>`;const s=this.cfg,t=!this.canEdit||this.busy,a=s.settings,n=(i,d,m,o,c)=>r`<sw-field><select data-alarm-setting=${c} ?disabled=${t} @change=${w=>void this.setting(i,w.target.value)}>
      <option value="true" ?selected=${d}>${m}</option><option value="false" ?selected=${!d}>${o}</option></select></sw-field>`;return r`<div class="panels" data-alarm-settings>
      <sw-card heading=${e("אזעקה · מדיניות")} subheading=${e("מה מותר מחוץ לרשת המקומית (SmplWise Arx), ואיזה קוד מקליד משתמש שחייב קוד. ההרשאות (צפייה, דריכה, נטרול ועקיפה) נקבעות בתפקידים; המדיניות לכל משתמש - במשתמשים והרשאות.")}>
        <div class="row"><span class="lbl">${e("שליטה מרחוק")}<span class="muted">${e("alarm.remote_control - כבוי: אין דריכה, נטרול או עקיפה מחוץ לרשת המקומית.")}</span></span>${n("alarm.remote_control",a.remote_control,e("מותרת"),e("חסומה"),"remote_control")}</div>
        <div class="row"><span class="lbl">${e("נטרול ועקיפה מרחוק")}<span class="muted">${e("alarm.remote_disarm - כבוי: מבחוץ אפשר רק לדרוך ולהחזיר חיישן להגנה.")}</span></span>${n("alarm.remote_disarm",a.remote_disarm,e("מותרים"),e("חסומים"),"remote_disarm")}</div>
        <div class="row"><span class="lbl">${e("ללא קוד גם מרחוק")}<span class="muted">${e('alarm.remote_codeless - פעיל (ברירת מחדל, החלטת בעלים): משתמש "ללא קוד" דורך ומנטרל ללא קוד גם מבחוץ. נעילה ביומטרית קיימת רק באפליקציית האנדרואיד ורק אם הופעלה; בדפדפן אין נעילה כזו. כבוי: מבחוץ כל אחד מקליד קוד.')}</span></span>${n("alarm.remote_codeless",a.remote_codeless,e("פעיל"),e("כבוי"),"remote_codeless")}</div>
        <div class="row"><span class="lbl">${e("הקוד שמקליד משתמש שחייב קוד")}<span class="muted">${e("alarm.code_mode - קוד אישי (ברירת מחדל): לכל משתמש קוד Arx משלו, שמור כ-hash בלבד, והמערכת שולחת ללוח את קוד הלוח השמור; קוד הלוח: המשתמש מקליד את קוד הלוח עצמו.")}</span></span>
          <sw-field><select data-alarm-setting="code_mode" ?disabled=${t} @change=${i=>void this.setting("alarm.code_mode",i.target.value)}>
            <option value="personal_pin" ?selected=${a.code_mode==="personal_pin"}>${e("קוד אישי לכל משתמש")}</option><option value="panel_code" ?selected=${a.code_mode==="panel_code"}>${e("קוד הלוח")}</option></select></sw-field></div>
        ${this.message?r`<div class="ok" role="status">${this.message}</div>`:p}${this.error?r`<div class="err" role="alert">${this.error}</div>`:p}
      </sw-card>
      ${s.fallback_controls?.length||s.not_alarm?.length?r`<sw-card heading=${e("מתגים דמויי עקיפה ללא שיוך למערכת")} subheading=${e("מתגים עם סימן עקיפה (bypass) מאותה אינטגרציה כמו לוח אזעקה, שלא ידוע לאיזו התקנה שלה הם שייכים. הם מוחזקים כחלק מהאזעקה עד שמסמנים אותם 'אינו רכיב אזעקה'.")} data-fallback-controls>
            ${(s.fallback_controls??[]).map(i=>this.renderNotAlarmRow(i,!1,t))}${(s.not_alarm??[]).map(i=>this.renderNotAlarmRow(i,!0,t))}
          </sw-card>`:p}
      ${s.panels.length?s.panels.map(i=>this.renderPanel(i,t)):r`<sw-card heading=${e("לא נמצא לוח אזעקה")}><div class="muted">${e("לא נמצאה ישות alarm_control_panel. חברו את האינטגרציה של מערכת האזעקה ב-Home Assistant (למשל Risco, Visonic, PIMA, Paradox), ואז רעננו.")}</div></sw-card>`}
    </div>`}renderPanel(s,t){const a=s.panel_code,n=this.codeDraft[s.entity_id]??"",i=new Map((this.cfg?.overrides??[]).map(o=>[o.zone_entity_id,o])),d=this.cfg?.candidates.controls??[],m=(this.cfg?.panels??[]).filter(o=>o.config_entry_id===s.config_entry_id&&o.platform===s.platform);return r`<sw-card heading=${`${s.name}`} subheading=${s.integration} data-alarm-settings-panel=${s.entity_id}>
      <div class="row"><span class="lbl">${e("שילוב")}<span class="muted">${e("{v} · ישות",{v:s.integration_note||"—"})} <span class="ltr">${s.entity_id}</span> · config entry <span class="ltr">${s.config_entry_id??"—"}</span> ${e("· מצבי דריכה: {join}{v} · קוד: {v2}{v3}",{join:s.arm_modes.join(", "),v:s.features_reported?"":e(" (לא דווחו)"),v2:s.code_format??e("לא נדרש"),v3:s.code_format?e(" · קוד לדריכה: {v}",{v:s.code_arm_required?e("כן"):e("לא")}):""})}</span></span></div>
      <div class="row"><span class="lbl">${e("קוד הלוח")}<span class="muted">${e("נשמר מוצפן (AES-GCM, מפתח בתיקיית הנתונים של התוסף), לא מוצג ולא יוצא מהמערכת. משמש לשליחה ללוח עבור משתמשים מורשים.{v}",{v:a?.set?e(" מוגדר · {dayTimeText} · {v}",{dayTimeText:A(new Date(a.set_at??""),{seconds:!0}),v:a.set_by??""}):e(" לא מוגדר.")})}</span></span>
        <span class="inline">
          <input type="password" inputmode=${s.code_format==="number"?"numeric":"text"} autocomplete="new-password" maxlength="32" placeholder=${e("קוד חדש")} aria-label=${e("קוד הלוח")} data-panel-code-input ?disabled=${t}
            .value=${n} @input=${o=>this.codeDraft={...this.codeDraft,[s.entity_id]:o.target.value}} />
          <sw-button size="sm" variant="primary" data-panel-code-save ?disabled=${t||!n} @click=${()=>{const o=n;this.codeDraft={...this.codeDraft,[s.entity_id]:""},this.run(()=>T(s.entity_id,o),e("קוד הלוח נשמר"))}}>${e("שמירה")}</sw-button>
          ${a?.set?r`<sw-button size="sm" variant="ghost" data-panel-code-clear ?disabled=${t} @click=${()=>void this.run(()=>R(s.entity_id),e("קוד הלוח נמחק"))}>${e("מחיקה")}</sw-button>`:p}
        </span></div>
      <div class="scroll"><table data-alarm-pairing>
        <thead><tr><th>${e("חיישן")}</th><th>${e("מתג עקיפה")}</th><th>${e("שיוך לפי")}</th><th>${e("לוח")}</th><th></th></tr></thead>
        <tbody>${s.zones.map(o=>this.renderZoneRow(s,o,i.get(o.entity_id),d,m,t))}</tbody>
      </table></div>
      ${s.unpaired_controls.length?r`<div class="row" data-unpaired-controls><span class="lbl">${e("ללא שיוך")}<span class="muted">${e('מתגי עקיפה של המערכת שלא שויכו לחיישן. מתג שאינו חלק מהאזעקה: "אינו רכיב אזעקה" מחזיר אותו להיות מתג רגיל.')}</span></span></div>
            ${s.unpaired_controls.map(o=>this.renderNotAlarmRow(o.entity_id,!1,t))}`:p}
    </sw-card>`}renderNotAlarmRow(s,t,a){return r`<div class="row" data-not-alarm-row=${s}><span class="lbl"><span class="ltr">${s}</span></span>
      <sw-button size="sm" variant="ghost" data-not-alarm=${s} ?disabled=${a}
        @click=${()=>void this.run(()=>O(s,!t),t?e("הסימון בוטל"):e("סומן כאינו רכיב אזעקה"))}>${t?e("החזר לאזעקה"):e("אינו רכיב אזעקה")}</sw-button></div>`}renderZoneRow(s,t,a,n,i,d){const m=t.bypass?.entity_id??"",o=a?.bypass_entity_id===""?"__none":a?.bypass_entity_id?a.bypass_entity_id:"__auto";return r`<tr data-pair-row=${t.entity_id}>
      <td>${t.name}<div class="ltr">${t.entity_id}</div></td>
      <td><sw-field><select data-pair-select ?disabled=${d} @change=${c=>{const w=c.target.value;this.run(async()=>{if(w==="__auto")return j(t.entity_id);const g={bypass_entity_id:w==="__none"?"":w,panel_entity_id:a?.panel_entity_id??null};try{return await f(t.entity_id,g)}catch(b){if(b instanceof q&&b.body.code==="not_bypass_like"&&await B({body:e("הישות {v} אינה נראית כמו מתג עקיפה. אחרי השיוך היא תופעל רק ממסך האזעקה ותיעלם מפעולות רגילות ומרוכזות. לשייך בכל זאת?",{v:w})}))return f(t.entity_id,{...g,confirm_not_bypass_like:!0});throw b}},e("השיוך נשמר"))}}>
        <option value="__auto" ?selected=${o==="__auto"}>${e("אוטומטי{v}",{v:m&&o==="__auto"?` (${m})`:""})}</option>
        <option value="__none" ?selected=${o==="__none"}>${e("ללא עקיפה")}</option>
        ${n.map(c=>r`<option value=${c.entity_id} ?selected=${o===c.entity_id}>${c.entity_id}</option>`)}
      </select></sw-field></td>
      <td>${t.bypass?Y[t.bypass.strategy]??t.bypass.strategy:"—"}</td>
      <td>${i.length>1?r`<sw-field><select data-zone-panel ?disabled=${d} @change=${c=>{const w=c.target.value;this.run(()=>f(t.entity_id,{panel_entity_id:w||null,bypass_entity_id:a?.bypass_entity_id??null}),e("השיוך נשמר"))}}><option value="" ?selected=${t.shared}>${e("משותף")}</option>${i.map(c=>r`<option value=${c.entity_id} ?selected=${!t.shared&&c.entity_id===s.entity_id}>${c.name}</option>`)}</select></sw-field>`:"—"}</td>
      <td><sw-button size="sm" variant="ghost" data-zone-exclude ?disabled=${d} @click=${()=>void this.run(()=>f(t.entity_id,{excluded:!0}),e("החיישן הוצא מהרשימה"))}>${e("הוצא")}</sw-button></td>
    </tr>`}};v.styles=[S,D,x`
      .panels {
        display: grid;
        gap: 14px;
      }
      table {
        inline-size: 100%;
        border-collapse: collapse;
        font-size: var(--sw-fs-sm);
      }
      th,
      td {
        text-align: start;
        padding: 6px 6px;
        border-block-end: 1px solid var(--sw-border);
        vertical-align: middle;
      }
      th {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-medium);
        font-size: var(--sw-fs-xs);
      }
      .scroll {
        overflow-x: auto;
      }
      /* POLISH4-WP7 (D16): the pairing table keeps a readable width and scrolls sideways inside its own wrapper (never the page) */
      @media (max-width: 767px) {
        .scroll table {
          min-inline-size: 520px;
        }
        .scroll select {
          min-inline-size: 150px;
        }
      }
    `];l([y({type:Boolean})],v.prototype,"canEdit",2);l([h()],v.prototype,"cfg",2);l([h()],v.prototype,"error",2);l([h()],v.prototype,"message",2);l([h()],v.prototype,"busy",2);l([h()],v.prototype,"codeDraft",2);v=l([z("system-alarm-settings")],v);let u=class extends k{constructor(){super(...arguments),this.bubbleSkin=new P(this),this.userId="",this.canEdit=!1,this.pol=null,this.error="",this.message="",this.busy=!1,this.pin="",this.current=""}get self(){return N.me?.user.id===this.userId}updated(s){s.has("userId")&&this.userId&&$()&&this.load()}async load(){try{this.pol=await U(this.userId),this.error=""}catch(s){this.pol=null,this.error=_(s)}}async run(s,t){this.busy=!0,this.message="",this.error="";try{await s(),this.message=t,await this.load()}catch(a){this.error=_(a)}finally{this.busy=!1}}render(){if(!$())return p;if(!this.pol)return this.error?r`<div class="err">${this.error}</div>`:p;const s=this.pol,t=!this.canEdit||this.busy,a=(n,i)=>r`<sw-field><select data-alarm-policy=${n} ?disabled=${t} @change=${d=>void this.run(()=>M(this.userId,{[n]:d.target.value,...this.self&&this.current?{current_pin:this.current}:{}}),e("נשמר"))}>
      <option value="code_required" ?selected=${i==="code_required"}>${e("חייב קוד")}</option><option value="no_code" ?selected=${i==="no_code"}>${e("ללא קוד")}</option></select></sw-field>`;return r`<div data-alarm-user=${this.userId}>
      ${this.self?r`<div class="row"><span class="lbl">${e("הקוד האישי הנוכחי שלך")}<span class="muted">${e("את המדיניות והקוד של עצמך משנים רק עם הקוד הנוכחי - או שמנהל מערכת אחר משנה אותם.")}</span></span>
            <input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label=${e("הקוד האישי הנוכחי")} data-user-pin-current .value=${this.current} @input=${n=>this.current=n.target.value} /></div>`:p}
      <div class="row"><span class="lbl">${e("דריכה")}<span class="muted">${e("ללא קוד: לחיצה אחת, והמערכת שולחת את קוד הלוח השמור")}</span></span>${a("arm_policy",s.arm_policy)}</div>
      <div class="row"><span class="lbl">${e("נטרול ועקיפה")}<span class="muted">${e("עקיפת חיישן הולכת לפי מדיניות הנטרול")}</span></span>${a("disarm_policy",s.disarm_policy)}</div>
      <div class="row"><span class="lbl">${e("קוד אישי")}<span class="muted">${e("{v} · 4–8 ספרות, נשמר כ-hash בלבד",{v:s.pin_set?e("מוגדר{v}{v2}",{v:s.pin_set_at?` · ${A(new Date(s.pin_set_at),{seconds:!0})}`:"",v2:s.pin_set_by?` · ${s.pin_set_by}`:""}):e("לא מוגדר")})}</span></span>
        <span class="inline"><input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder=${e("קוד חדש")} aria-label=${e("קוד אישי")} data-user-pin ?disabled=${t} .value=${this.pin} @input=${n=>this.pin=n.target.value} />
          <sw-button size="sm" variant="primary" data-user-pin-save ?disabled=${t||!/^\d{4,8}$/.test(this.pin)} @click=${()=>{const n=this.pin;this.pin="",this.run(()=>H(this.userId,n,this.self&&this.current||void 0),e("הקוד האישי נשמר"))}}>${e("שמירה")}</sw-button>
          ${s.pin_set?r`<sw-button size="sm" variant="ghost" data-user-pin-clear ?disabled=${t} @click=${()=>void this.run(()=>L(this.userId),e("הקוד האישי נמחק"))}>${e("מחיקה")}</sw-button>`:p}</span></div>
      ${this.message?r`<div class="ok" role="status">${this.message}</div>`:p}${this.error?r`<div class="err" role="alert">${this.error}</div>`:p}
    </div>`}};u.styles=[S,D];l([y()],u.prototype,"userId",2);l([y({type:Boolean})],u.prototype,"canEdit",2);l([h()],u.prototype,"pol",2);l([h()],u.prototype,"error",2);l([h()],u.prototype,"message",2);l([h()],u.prototype,"busy",2);l([h()],u.prototype,"pin",2);l([h()],u.prototype,"current",2);u=l([z("system-alarm-user")],u);
