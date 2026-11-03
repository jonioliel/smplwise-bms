import{E as f,C as x,F as $,G as u,a as A,S as k,i as y,t6 as C,ps as D,R as b,t7 as R,e as i,A as c,b5 as P,t8 as z,t9 as I,ta as q,tb as N,tc as v,j as O,Q as j,td as T,te as U,tf as G,tg as M,fn as B,H as S}from"./index-TwIAG38v.js";var H=Object.defineProperty,V=Object.getOwnPropertyDescriptor,o=(e,s,t,r)=>{for(var a=r>1?void 0:r?V(s,t):s,l=e.length-1,h;l>=0;l--)(h=e[l])&&(a=(r?h(s,t,a):h(a))||a);return r&&a&&H(s,t,a),a};const Y={device:"אותו device",zone_id:"מזהה אזור (unique id)",entity_id:"שורש entity id",unique_id:"שורש unique id",name:"שם",zone_number:"מספר אזור",override:"שיוך ידני"},E=f`
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
  .ok {
    color: var(--sw-success-text);
    font-size: var(--sw-fs-sm);
  }
  .err {
    color: var(--sw-danger);
    font-size: var(--sw-fs-sm);
  }
  .inline {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
`;let m=class extends A{constructor(){super(...arguments),this.bubbleSkin=new k(this),this.canEdit=!1,this.cfg=null,this.error="",this.message="",this.busy=!1,this.codeDraft={}}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(y())try{this.cfg=await C(),D(this.cfg.panels.length),this.error=""}catch(e){this.error=b(e)}}async run(e,s){this.busy=!0,this.message="",this.error="";try{await e(),this.message=s,await this.load()}catch(t){this.error=b(t)}finally{this.busy=!1}}async setting(e,s){await this.run(async()=>{await R({[e]:s}),B()},"נשמר")}render(){if(!y())return i`<sw-card heading="אזעקה"><div class="muted">נתוני הדגמה: הגדרות האזעקה זמינות רק מול השרת.</div></sw-card>`;if(this.error&&!this.cfg)return i`<sw-card heading="אזעקה"><sw-state-panel state="error" heading="לא ניתן לטעון את הגדרות האזעקה" hint=${this.error}></sw-state-panel></sw-card>`;if(!this.cfg)return i`<sw-card heading="אזעקה"><sw-state-panel state="loading"></sw-state-panel></sw-card>`;const e=this.cfg,s=!this.canEdit||this.busy,t=e.settings,r=(a,l,h,n,d)=>i`<select data-alarm-setting=${d} ?disabled=${s} @change=${_=>void this.setting(a,_.target.value)}>
      <option value="true" ?selected=${l}>${h}</option><option value="false" ?selected=${!l}>${n}</option></select>`;return i`<div class="panels" data-alarm-settings>
      <sw-card heading="אזעקה · מדיניות" subheading="מה מותר מחוץ לרשת המקומית (SmplWise Arx), ואיזה קוד מקליד משתמש שחייב קוד. ההרשאות (alarm.view / arm / disarm / bypass) נקבעות בתפקידים; המדיניות לכל משתמש - במשתמשים והרשאות.">
        <div class="row"><span class="lbl">שליטה מרחוק<span class="muted">alarm.remote_control - כבוי: אין דריכה, נטרול או עקיפה מחוץ לרשת המקומית.</span></span>${r("alarm.remote_control",t.remote_control,"מותרת","חסומה","remote_control")}</div>
        <div class="row"><span class="lbl">נטרול ועקיפה מרחוק<span class="muted">alarm.remote_disarm - כבוי: מבחוץ אפשר רק לדרוך ולהחזיר חיישן להגנה.</span></span>${r("alarm.remote_disarm",t.remote_disarm,"מותרים","חסומים","remote_disarm")}</div>
        <div class="row"><span class="lbl">ללא קוד גם מרחוק<span class="muted">alarm.remote_codeless - פעיל (ברירת מחדל, החלטת בעלים): משתמש "ללא קוד" דורך ומנטרל ללא קוד גם מבחוץ. נעילה ביומטרית קיימת רק באפליקציית האנדרואיד ורק אם הופעלה; בדפדפן אין נעילה כזו. כבוי: מבחוץ כל אחד מקליד קוד.</span></span>${r("alarm.remote_codeless",t.remote_codeless,"פעיל","כבוי","remote_codeless")}</div>
        <div class="row"><span class="lbl">הקוד שמקליד משתמש שחייב קוד<span class="muted">alarm.code_mode - קוד אישי (ברירת מחדל): לכל משתמש קוד Arx משלו, שמור כ-hash בלבד, והמערכת שולחת ללוח את קוד הלוח השמור; קוד הלוח: המשתמש מקליד את קוד הלוח עצמו.</span></span>
          <select data-alarm-setting="code_mode" ?disabled=${s} @change=${a=>void this.setting("alarm.code_mode",a.target.value)}>
            <option value="personal_pin" ?selected=${t.code_mode==="personal_pin"}>קוד אישי לכל משתמש</option><option value="panel_code" ?selected=${t.code_mode==="panel_code"}>קוד הלוח</option></select></div>
        ${this.message?i`<div class="ok" role="status">${this.message}</div>`:c}${this.error?i`<div class="err" role="alert">${this.error}</div>`:c}
      </sw-card>
      ${e.fallback_controls?.length||e.not_alarm?.length?i`<sw-card heading="מתגים דמויי עקיפה ללא שיוך למערכת" subheading="מתגים עם סימן עקיפה (bypass) מאותה אינטגרציה כמו לוח אזעקה, שלא ידוע לאיזו התקנה שלה הם שייכים. הם מוחזקים כחלק מהאזעקה עד שמסמנים אותם 'אינו רכיב אזעקה'." data-fallback-controls>
            ${(e.fallback_controls??[]).map(a=>this.renderNotAlarmRow(a,!1,s))}${(e.not_alarm??[]).map(a=>this.renderNotAlarmRow(a,!0,s))}
          </sw-card>`:c}
      ${e.panels.length?e.panels.map(a=>this.renderPanel(a,s)):i`<sw-card heading="לא נמצא לוח אזעקה"><div class="muted">לא נמצאה ישות alarm_control_panel. חברו את האינטגרציה של מערכת האזעקה ב-Home Assistant (למשל Risco, Visonic, PIMA, Paradox), ואז רעננו.</div></sw-card>`}
    </div>`}renderPanel(e,s){const t=e.panel_code,r=this.codeDraft[e.entity_id]??"",a=new Map((this.cfg?.overrides??[]).map(n=>[n.zone_entity_id,n])),l=this.cfg?.candidates.controls??[],h=(this.cfg?.panels??[]).filter(n=>n.config_entry_id===e.config_entry_id&&n.platform===e.platform);return i`<sw-card heading=${`${e.name}`} subheading=${`${e.integration} · ${e.entity_id}`} data-alarm-settings-panel=${e.entity_id}>
      <div class="row"><span class="lbl">שילוב<span class="muted">${e.integration_note||"—"} · config entry <span class="ltr">${e.config_entry_id??"—"}</span> · מצבי דריכה: ${e.arm_modes.join(", ")}${e.features_reported?"":" (לא דווחו)"} · קוד: ${e.code_format??"לא נדרש"}${e.code_format?` · קוד לדריכה: ${e.code_arm_required?"כן":"לא"}`:""}</span></span></div>
      <div class="row"><span class="lbl">קוד הלוח<span class="muted">נשמר מוצפן (AES-GCM, מפתח בתיקיית הנתונים של התוסף), לא מוצג ולא יוצא מהמערכת. משמש לשליחה ללוח עבור משתמשים מורשים.${t?.set?` מוגדר · ${P(new Date(t.set_at??""),{seconds:!0})} · ${t.set_by??""}`:" לא מוגדר."}</span></span>
        <span class="inline">
          <input type="password" inputmode=${e.code_format==="number"?"numeric":"text"} autocomplete="new-password" maxlength="32" placeholder="קוד חדש" aria-label="קוד הלוח" data-panel-code-input ?disabled=${s}
            .value=${r} @input=${n=>this.codeDraft={...this.codeDraft,[e.entity_id]:n.target.value}} />
          <sw-button size="sm" variant="primary" data-panel-code-save ?disabled=${s||!r} @click=${()=>{const n=r;this.codeDraft={...this.codeDraft,[e.entity_id]:""},this.run(()=>z(e.entity_id,n),"קוד הלוח נשמר")}}>שמירה</sw-button>
          ${t?.set?i`<sw-button size="sm" variant="ghost" data-panel-code-clear ?disabled=${s} @click=${()=>void this.run(()=>I(e.entity_id),"קוד הלוח נמחק")}>מחיקה</sw-button>`:c}
        </span></div>
      <div class="scroll"><table data-alarm-pairing>
        <thead><tr><th>חיישן</th><th>מתג עקיפה</th><th>שיוך לפי</th><th>לוח</th><th></th></tr></thead>
        <tbody>${e.zones.map(n=>this.renderZoneRow(e,n,a.get(n.entity_id),l,h,s))}</tbody>
      </table></div>
      ${e.unpaired_controls.length?i`<div class="row" data-unpaired-controls><span class="lbl">ללא שיוך<span class="muted">מתגי עקיפה של המערכת שלא שויכו לחיישן. מתג שאינו חלק מהאזעקה: "אינו רכיב אזעקה" מחזיר אותו להיות מתג רגיל.</span></span></div>
            ${e.unpaired_controls.map(n=>this.renderNotAlarmRow(n.entity_id,!1,s))}`:c}
    </sw-card>`}renderNotAlarmRow(e,s,t){return i`<div class="row" data-not-alarm-row=${e}><span class="lbl"><span class="ltr">${e}</span></span>
      <sw-button size="sm" variant="ghost" data-not-alarm=${e} ?disabled=${t}
        @click=${()=>void this.run(()=>q(e,!s),s?"הסימון בוטל":"סומן כאינו רכיב אזעקה")}>${s?"החזר לאזעקה":"אינו רכיב אזעקה"}</sw-button></div>`}renderZoneRow(e,s,t,r,a,l){const h=s.bypass?.entity_id??"",n=t?.bypass_entity_id===""?"__none":t?.bypass_entity_id?t.bypass_entity_id:"__auto";return i`<tr data-pair-row=${s.entity_id}>
      <td>${s.name}<div class="ltr">${s.entity_id}</div></td>
      <td><select data-pair-select ?disabled=${l} @change=${d=>{const _=d.target.value;this.run(async()=>{if(_==="__auto")return N(s.entity_id);const g={bypass_entity_id:_==="__none"?"":_,panel_entity_id:t?.panel_entity_id??null};try{return await v(s.entity_id,g)}catch(w){if(w instanceof O&&w.body.code==="not_bypass_like"&&window.confirm(`הישות ${_} אינה נראית כמו מתג עקיפה. אחרי השיוך היא תופעל רק ממסך האזעקה ותיעלם מפעולות רגילות ומרוכזות. לשייך בכל זאת?`))return v(s.entity_id,{...g,confirm_not_bypass_like:!0});throw w}},"השיוך נשמר")}}>
        <option value="__auto" ?selected=${n==="__auto"}>אוטומטי${h&&n==="__auto"?` (${h})`:""}</option>
        <option value="__none" ?selected=${n==="__none"}>ללא עקיפה</option>
        ${r.map(d=>i`<option value=${d.entity_id} ?selected=${n===d.entity_id}>${d.entity_id}</option>`)}
      </select></td>
      <td>${s.bypass?Y[s.bypass.strategy]??s.bypass.strategy:"—"}</td>
      <td>${a.length>1?i`<select data-zone-panel ?disabled=${l} @change=${d=>{const _=d.target.value;this.run(()=>v(s.entity_id,{panel_entity_id:_||null,bypass_entity_id:t?.bypass_entity_id??null}),"השיוך נשמר")}}><option value="" ?selected=${s.shared}>משותף</option>${a.map(d=>i`<option value=${d.entity_id} ?selected=${!s.shared&&d.entity_id===e.entity_id}>${d.name}</option>`)}</select>`:"—"}</td>
      <td><sw-button size="sm" variant="ghost" data-zone-exclude ?disabled=${l} @click=${()=>void this.run(()=>v(s.entity_id,{excluded:!0}),"החיישן הוצא מהרשימה")}>הוצא</sw-button></td>
    </tr>`}};m.styles=[x,E,f`
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
    `];o([$({type:Boolean})],m.prototype,"canEdit",2);o([u()],m.prototype,"cfg",2);o([u()],m.prototype,"error",2);o([u()],m.prototype,"message",2);o([u()],m.prototype,"busy",2);o([u()],m.prototype,"codeDraft",2);m=o([S("system-alarm-settings")],m);let p=class extends A{constructor(){super(...arguments),this.bubbleSkin=new k(this),this.userId="",this.canEdit=!1,this.pol=null,this.error="",this.message="",this.busy=!1,this.pin="",this.current=""}get self(){return j.me?.user.id===this.userId}updated(e){e.has("userId")&&this.userId&&y()&&this.load()}async load(){try{this.pol=await T(this.userId),this.error=""}catch(e){this.pol=null,this.error=b(e)}}async run(e,s){this.busy=!0,this.message="",this.error="";try{await e(),this.message=s,await this.load()}catch(t){this.error=b(t)}finally{this.busy=!1}}render(){if(!y())return c;if(!this.pol)return this.error?i`<div class="err">${this.error}</div>`:c;const e=this.pol,s=!this.canEdit||this.busy,t=(r,a)=>i`<select data-alarm-policy=${r} ?disabled=${s} @change=${l=>void this.run(()=>M(this.userId,{[r]:l.target.value,...this.self&&this.current?{current_pin:this.current}:{}}),"נשמר")}>
      <option value="code_required" ?selected=${a==="code_required"}>חייב קוד</option><option value="no_code" ?selected=${a==="no_code"}>ללא קוד</option></select>`;return i`<div data-alarm-user=${this.userId}>
      ${this.self?i`<div class="row"><span class="lbl">הקוד האישי הנוכחי שלך<span class="muted">את המדיניות והקוד של עצמך משנים רק עם הקוד הנוכחי - או שמנהל מערכת אחר משנה אותם.</span></span>
            <input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label="הקוד האישי הנוכחי" data-user-pin-current .value=${this.current} @input=${r=>this.current=r.target.value} /></div>`:c}
      <div class="row"><span class="lbl">דריכה<span class="muted">ללא קוד: לחיצה אחת, והמערכת שולחת את קוד הלוח השמור</span></span>${t("arm_policy",e.arm_policy)}</div>
      <div class="row"><span class="lbl">נטרול ועקיפה<span class="muted">עקיפת חיישן הולכת לפי מדיניות הנטרול</span></span>${t("disarm_policy",e.disarm_policy)}</div>
      <div class="row"><span class="lbl">קוד אישי<span class="muted">${e.pin_set?`מוגדר${e.pin_set_at?` · ${P(new Date(e.pin_set_at),{seconds:!0})}`:""}${e.pin_set_by?` · ${e.pin_set_by}`:""}`:"לא מוגדר"} · 4–8 ספרות, נשמר כ-hash בלבד</span></span>
        <span class="inline"><input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="קוד חדש" aria-label="קוד אישי" data-user-pin ?disabled=${s} .value=${this.pin} @input=${r=>this.pin=r.target.value} />
          <sw-button size="sm" variant="primary" data-user-pin-save ?disabled=${s||!/^\d{4,8}$/.test(this.pin)} @click=${()=>{const r=this.pin;this.pin="",this.run(()=>U(this.userId,r,this.self&&this.current||void 0),"הקוד האישי נשמר")}}>שמירה</sw-button>
          ${e.pin_set?i`<sw-button size="sm" variant="ghost" data-user-pin-clear ?disabled=${s} @click=${()=>void this.run(()=>G(this.userId),"הקוד האישי נמחק")}>מחיקה</sw-button>`:c}</span></div>
      ${this.message?i`<div class="ok" role="status">${this.message}</div>`:c}${this.error?i`<div class="err" role="alert">${this.error}</div>`:c}
    </div>`}};p.styles=[x,E];o([$()],p.prototype,"userId",2);o([$({type:Boolean})],p.prototype,"canEdit",2);o([u()],p.prototype,"pol",2);o([u()],p.prototype,"error",2);o([u()],p.prototype,"message",2);o([u()],p.prototype,"busy",2);o([u()],p.prototype,"pin",2);o([u()],p.prototype,"current",2);p=o([S("system-alarm-user")],p);
//# sourceMappingURL=system-alarm-DQdLRDsh.js.map
