import{a as T,S as A,sN as y,e as a,i as u,av as w,j as m,sO as B,sP as L,ae as C,pD as P,R as v,b5 as F,sQ as V,sR as $,sS as _,sT as J,pH as b,sU as x,A as d,sV as G,bV as k,sW as U,sX as Z,aj as z,C as R,E as I,F as S,G as r,H as O}from"./index-Do3zNa2z.js";import"./sw-chip-ClHVjtJv.js";import{c as M}from"./announcements-BxEB-OrJ.js";import{l as H}from"./zones-CQ8Exnzi.js";import"./sw-steps-i-ajTRZo.js";import{I as N}from"./investigate-r5-css-BCUqtzsp.js";import"./sw-logo-art-Va6y_cIM.js";var Q=Object.defineProperty,W=Object.getOwnPropertyDescriptor,o=(e,t,l,s)=>{for(var i=s>1?void 0:s?W(t,l):t,c=e.length-1,p;c>=0;c--)(p=e[c])&&(i=(s?p(t,l,i):p(i))||i);return s&&i&&Q(t,l,i),i};const E={"r-1":{icon:"user",bg:"var(--sw-accent-soft)",fg:"var(--sw-accent-text)"},"r-2":{icon:"move",bg:"var(--sw-surface-3)",fg:"var(--sw-text-2)"},"r-3":{icon:"door",bg:"var(--sw-warning-soft)",fg:"var(--sw-warning-text)"},"r-4":{icon:"offline",bg:"var(--sw-danger-soft)",fg:"var(--sw-danger-text)"}},X=[{id:"person-night",label:"אדם בלילה",body:{name:"אדם בלילה",description:"זיהוי אדם בשעות הסגירה",trigger:{types:["person"],sources:[],severity_min:"info"},window:{days:[],from:"22:00",to:"06:00"},cooldown_s:300,actions:[{kind:"notify",message:"זוהה אדם בשעות הסגירה"}]}},{id:"camera-offline",label:"מצלמה מנותקת",body:{name:"מצלמה מנותקת",description:"התראה כשמצלמה יורדת מהרשת",trigger:{types:["offline"],sources:[],severity_min:"info"},window:{days:[],from:null,to:null},cooldown_s:1800,actions:[{kind:"notify",message:"מצלמה מנותקת"}]}},{id:"door-after-hours",label:"דלת נפתחה אחרי שעות",body:{name:"דלת נפתחה אחרי שעות",description:"פתיחת דלת מחוץ לשעות הפעילות",trigger:{types:["door"],sources:["ha"],severity_min:"info"},window:{days:[],from:"20:00",to:"07:00"},cooldown_s:600,actions:[{kind:"notify",message:"דלת נפתחה מחוץ לשעות הפעילות"}]}}];let n=class extends T{constructor(){super(...arguments),this.bubbleSkin=new A(this),this.initialTab="",this.tab="rules",this.rulesForbidden=!1,this.rules=[],this.alerts=[],this.unacked=0,this.meta={types:[],sources:[],days:[]},this.error="",this.busy=!1,this.loading=!1,this.editing=null,this.dry=null,this.dryBusy=!1,this.tree=null,this.cams=[],this.zones=[],this.confirmDelete=null,this.speakAreas=[],this.tz="Asia/Jerusalem"}connectedCallback(){super.connectedCallback(),this.rulesForbidden=u()&&!w("rules.manage"),(this.initialTab==="alerts"||this.rulesForbidden)&&(this.tab=u()?"alerts":"notif"),u()&&this.load()}async load(){this.loading=!0,this.error="";try{const e=Promise.reject(new m(403,{code:"forbidden",user_message:"",retryable:!1,correlation_id:"",details:{}}));e.catch(()=>{});const[t,l]=await Promise.allSettled([this.rulesForbidden?e:B(),L()]);if(l.status==="rejected")throw l.reason;const s=l.value;if(this.alerts=s.alerts,this.unacked=s.unacked,t.status==="rejected"){if(!(t.reason instanceof m&&t.reason.status===403))throw t.reason;this.rulesForbidden=!0,this.tab="alerts";return}const i=t.value;if(this.rules=i.rules,this.meta={types:i.types,sources:i.sources,days:i.days},!this.tree){const[c,p]=await Promise.all([C(),P()]);this.tree=c,this.cams=p.cameras.filter(f=>f.enabled)}}catch(e){this.error=v(e)}finally{this.loading=!1}}fmt(e){return e?F(new Date(e),{timeZone:this.tz}):"—"}get floors(){return(this.tree?.sites??[]).flatMap(e=>(e.buildings??[]).flatMap(t=>(t.floors??[]).map(l=>({id:l.id,name:`${t.name} · ${l.name}`}))))}async run(e){this.busy=!0,this.error="";try{await e(),await this.load()}catch(t){this.error=v(t),t instanceof m&&t.status===409&&await this.load()}finally{this.busy=!1}}openEditor(e){if(u()&&w("media.announce")&&M().then(t=>this.speakAreas=t.areas).catch(()=>{}),this.dry=null,this.zones=[],e){const{id:t,revision:l,alerts:s,created_by_username:i,updated_by_username:c,created_at:p,updated_at:f,last_fired_at:j,...h}=e;this.editing={id:t,revision:l,body:JSON.parse(JSON.stringify(h))},h.scope.floor_ids.length===1&&this.loadZones(h.scope.floor_ids[0])}else this.editing={id:null,revision:0,body:V()}}async loadZones(e){try{this.zones=(await H(e)).zones}catch{this.zones=[]}}edit(e){if(!this.editing)return;const t=JSON.parse(JSON.stringify(this.editing.body));e(t),this.editing={...this.editing,body:t}}toggleIn(e,t){const l=e.indexOf(t);l>=0?e.splice(l,1):e.push(t)}async dryRun(){if(this.editing){this.dryBusy=!0,this.error="";try{this.dry=this.editing.id?await $({...this.editing.body},24):await $(this.editing.body,24)}catch(e){this.error=v(e)}finally{this.dryBusy=!1}}}save(){const e=this.editing;!e||!e.body.name.trim()||this.run(async()=>{e.id?await _(e.id,{...e.body,revision:e.revision}):await J(e.body),this.editing=null,this.dry=null})}summary(e){const t=e.trigger.types.length?e.trigger.types.map(i=>b[i]??i).join(", "):"כל הסוגים",l=e.scope.floor_ids.length||e.scope.zone_ids.length||e.scope.camera_ids.length||e.scope.building_ids.length||e.scope.site_ids.length?[e.scope.floor_ids.length?`${e.scope.floor_ids.length} קומות`:"",e.scope.zone_ids.length?`${e.scope.zone_ids.length} אזורים`:"",e.scope.camera_ids.length?`${e.scope.camera_ids.length} מצלמות`:""].filter(Boolean).join(" · "):"כל המתקן",s=e.window.from||e.window.to||e.window.days.length?`${e.window.days.map(i=>x[i]??i).join("")||"כל יום"} ${e.window.from??"00:00"}–${e.window.to??"24:00"}`:"תמיד";return`${t} · ${l} · ${s} · השהיה ${e.cooldown_s} שנ׳ · ${e.owner==="ha"?`בבעלות תשתית המערכת (${e.ha_automation_id})`:"התראה במערכת"}`}renderEditor(){const e=this.editing;if(!e)return d;const t=e.body,l=this.dry;return a`<sw-dialog open heading=${e.id?"עריכת חוק":"חוק חדש"} subheading="Trigger → היקף → חלון זמן → השהיה → התראה במערכת · הרצה יבשה לפני שמירה" data-rule-dialog @close=${()=>this.editing=null}>
      ${this.error?a`<div class="err">${this.error}</div>`:d}
      ${e.id?d:a`<sw-field label="תבניות (ממלאות את הטופס; אפשר לשנות אחר כך)"><div class="chips">${X.map(s=>a`<sw-chip data-rule-template=${s.id} @click=${()=>this.edit(i=>Object.assign(i,JSON.parse(JSON.stringify(s.body))))}>${s.label}</sw-chip>`)}</div></sw-field>`}
      <sw-field label="שם"><input data-rule-name .value=${t.name} @input=${s=>this.edit(i=>i.name=s.target.value)} /></sw-field>
      <sw-field label="סוגי אירועים (ריק = הכל)"><div class="chips">${this.meta.types.map(s=>a`<sw-chip data-rule-type=${s} ?selected=${t.trigger.types.includes(s)} @click=${()=>this.edit(i=>this.toggleIn(i.trigger.types,s))}>${b[s]??s}</sw-chip>`)}</div></sw-field>
      <sw-field label="מקורות (ריק = הכל)"><div class="chips">${this.meta.sources.map(s=>a`<sw-chip ?selected=${t.trigger.sources.includes(s)} @click=${()=>this.edit(i=>this.toggleIn(i.trigger.sources,s))}>${G[s]??s}</sw-chip>`)}</div></sw-field>
      <div class="two">
        <sw-field label="חומרה מינימלית"><select @change=${s=>this.edit(i=>i.trigger.severity_min=s.target.value)}>${["info","alert","critical"].map(s=>a`<option value=${s} ?selected=${t.trigger.severity_min===s}>${s==="info"?"מידע":s==="alert"?"התראה":"קריטי"}</option>`)}</select></sw-field>
        <sw-field label="השהיה בין התראות (שניות)"><input type="number" min="0" max="86400" data-rule-cooldown .value=${String(t.cooldown_s)} @input=${s=>this.edit(i=>i.cooldown_s=Math.max(0,Number(s.target.value)||0))} /></sw-field>
      </div>
      <sw-field label="היקף: קומות (ריק = כל המתקן)"><div class="chips">${this.floors.map(s=>a`<sw-chip data-rule-floor=${s.id} ?selected=${t.scope.floor_ids.includes(s.id)} @click=${()=>{this.edit(c=>this.toggleIn(c.scope.floor_ids,s.id));const i=this.editing?.body.scope.floor_ids??[];i.length===1?this.loadZones(i[0]):this.zones=[]}}>${s.name}</sw-chip>`)}</div></sw-field>
      ${this.zones.length?a`<sw-field label="חדרים / אזורים בקומה שנבחרה"><div class="chips">${this.zones.map(s=>a`<sw-chip ?selected=${t.scope.zone_ids.includes(s.id)} @click=${()=>this.edit(i=>this.toggleIn(i.scope.zone_ids,s.id))}>${s.name}</sw-chip>`)}</div></sw-field>`:d}
      <sw-field label="מצלמות ספציפיות (לא חובה)"><div class="chips">${this.cams.map(s=>a`<sw-chip ?selected=${t.scope.camera_ids.includes(s.id)} @click=${()=>this.edit(i=>this.toggleIn(i.scope.camera_ids,s.id))}>${s.name}</sw-chip>`)}</div></sw-field>
      <sw-field label="ימים (ריק = כל יום)"><div class="chips">${this.meta.days.map(s=>a`<sw-chip ?selected=${t.window.days.includes(s)} @click=${()=>this.edit(i=>this.toggleIn(i.window.days,s))}>${x[s]??s}</sw-chip>`)}</div></sw-field>
      <div class="two">
        <sw-field label="משעה (זמן האתר)"><input type="time" lang=${k()} data-ltr .value=${t.window.from??""} @change=${s=>this.edit(i=>i.window.from=s.target.value||null)} /></sw-field>
        <sw-field label="עד שעה"><input type="time" lang=${k()} data-ltr .value=${t.window.to??""} @change=${s=>this.edit(i=>i.window.to=s.target.value||null)} /></sw-field>
      </div>
      <div class="two">
        <sw-field label="פעולה"><select data-rule-action-kind @change=${s=>this.edit(i=>i.actions=[{...i.actions[0]??{message:""},kind:s.target.value}])}>
          <option value="notify" ?selected=${(t.actions[0]?.kind??"notify")==="notify"}>התראה במערכת</option><option value="ha_notify" ?selected=${t.actions[0]?.kind==="ha_notify"}>התראה דרך תשתית המערכת (notify)</option>
          ${w("media.announce")||t.actions[0]?.kind==="announce"?a`<option value="announce" ?selected=${t.actions[0]?.kind==="announce"}>הכרזה קולית</option>`:d}
        </select></sw-field>
        ${t.actions[0]?.kind==="announce"?a`<sw-field label="חדר להכרזה"><select data-rule-announce-room @change=${s=>this.edit(i=>i.actions=[{...i.actions[0],scope:"area",ref:s.target.value}])}>
              <option value="" ?selected=${!t.actions[0]?.ref}>—</option>${this.speakAreas.map(s=>a`<option value=${s.area_id} ?selected=${t.actions[0]?.ref===s.area_id}>${[s.floor_name,s.name].filter(Boolean).join(" · ")}</option>`)}</select></sw-field>`:d}
        ${t.actions[0]?.kind==="ha_notify"?a`<sw-field label="שירות notify בתשתית המערכת (למשל mobile_app_phone)"><input data-ltr data-rule-service placeholder="mobile_app_phone" .value=${t.actions[0]?.service??""} @input=${s=>this.edit(i=>i.actions=[{...i.actions[0],service:s.target.value.trim()}])} /></sw-field>`:d}
      </div>
      <sw-field label="הודעת ההתראה"><input data-rule-message .value=${t.actions[0]?.message??""} @input=${s=>this.edit(i=>i.actions=[{...i.actions[0]??{kind:"notify"},message:s.target.value}])} /></sw-field>
      ${t.actions[0]?.kind==="ha_notify"?a`<div class="hint">התראה דרך תשתית המערכת דורשת את ההרשאה הרגישה "חוקים: התראה דרך תשתית המערכת" (תפקיד מותאם). ההודעה נשלחת ל־notify.&lt;שירות&gt; עם הכותרת Arx.</div>`:d}
      <div class="two">
        <sw-field label="בעלות"><select @change=${s=>this.edit(i=>i.owner=s.target.value)}><option value="local" ?selected=${t.owner==="local"}>מקומי (המערכת מפעילה)</option><option value="ha" ?selected=${t.owner==="ha"}>תשתית המערכת (הפניה בלבד)</option></select></sw-field>
        ${t.owner==="ha"?a`<sw-field label="מזהה אוטומציה בתשתית המערכת"><input .value=${t.ha_automation_id??""} @input=${s=>this.edit(i=>i.ha_automation_id=s.target.value||null)} /></sw-field>`:a`<label class="chk"><input type="checkbox" .checked=${t.enabled} @change=${s=>this.edit(i=>i.enabled=s.target.checked)} /> פעיל</label>`}
      </div>
      <div class="hint">הפעולה היחידה בפיילוט: התראה במערכת. אין פקודות למכשירים ואין webhooks; התראה אינה אירוע ולכן חוק לא יכול להזין את עצמו. חוק בבעלות תשתית המערכת אינו מופעל כאן (בעלים אחד לכל אוטומציה).</div>
      <div class="dryhead"><sw-button size="sm" icon="refresh" data-rule-dryrun ?disabled=${this.dryBusy} @click=${()=>this.dryRun()}>${this.dryBusy?"מריץ…":"הרצה יבשה על 24 שעות"}</sw-button>${l?a`<span class="hint" data-dryrun-result>${l.evaluated} אירועים נבדקו · <strong>${l.would_fire.length}</strong> התראות היו נוצרות · ${l.suppressed.length} נחסמו בהשהיה · ${l.not_matched} לא תאמו</span>`:d}</div>
      ${l?a`<div class="dry">${[...l.would_fire.map(s=>({...s,fire:!0})),...l.suppressed.map(s=>({...s,fire:!1}))].sort((s,i)=>s.occurred_at.localeCompare(i.occurred_at)).slice(0,40).map(s=>a`<div class="dryrow" data-dryrun-row data-fire=${s.fire?"true":"false"}><span class="ltr">${this.fmt(s.occurred_at)}</span><span>${b[s.type]??s.type} · ${s.camera_name??"—"}</span><span class="hint">${s.fire?s.reasons.join(" · "):`נחסם: ${s.suppressed}`}</span></div>`)}${l.would_fire.length+l.suppressed.length>40?a`<div class="hint">מוצגות 40 הראשונות</div>`:d}<div class="hint">${l.note}</div></div>`:d}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.editing=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-rule-save ?disabled=${this.busy||!t.name.trim()} @click=${()=>this.save()}>${e.id?"שמירה":"צור חוק"}</sw-button>
    </sw-dialog>`}renderApi(){return this.error&&!this.rules.length&&!this.editing?a`<sw-page heading="התראות וחוקי אוטומציה"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`:a`
      <sw-page heading="התראות וחוקי אוטומציה" subheading="Trigger → היקף → חלון זמן → השהיה → התראה במערכת · הרצה יבשה לפני הפעלה · אין פקודות למכשירים">
        ${this.rulesForbidden?d:a`<sw-button slot="actions" variant="primary" icon="plus" data-rule-new @click=${()=>this.openEditor()}>חוק חדש</sw-button>`}
        <sw-tabs .items=${this.rulesForbidden?[{id:"alerts",label:"התראות",count:this.unacked}]:[{id:"rules",label:"חוקים",count:this.rules.length},{id:"alerts",label:"התראות",count:this.unacked}]} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        ${this.error&&!this.editing?a`<div class="err">${this.error}</div>`:d}
        ${this.tab==="rules"?this.loading&&!this.rules.length?a`<sw-state-panel state="loading"></sw-state-panel>`:this.rules.length?a`<sw-card class="rulecard list"><div class="list">${this.rules.map(e=>a`<div class="rule" data-rule-row data-rule-id=${e.id} style="--bg:var(--sw-accent-soft);--fg:var(--sw-accent-text)">
                    <div class="ic"><sw-icon name=${e.owner==="ha"?"home":"bell"} size=${16}></sw-icon></div>
                    <div class="txt"><b>${e.name}</b><small>${this.summary(e)}</small><small>התראות: ${e.alerts.open} פתוחות מתוך ${e.alerts.total} · שונה על ידי ${e.updated_by_username??e.created_by_username??"—"} ${this.fmt(e.updated_at)}</small></div>
                    <span class="last">הופעל: ${e.last_fired_at?this.fmt(e.last_fired_at):"—"}</span>
                    <sw-toggle ?checked=${e.enabled} ?disabled=${this.busy||e.owner==="ha"} labelHidden label="פעיל" data-rule-toggle @change=${t=>void this.run(async()=>{const{id:l,revision:s,alerts:i,created_by_username:c,updated_by_username:p,created_at:f,updated_at:j,last_fired_at:h,...D}=e;await _(l,{...D,enabled:t.detail.checked,revision:s})})}></sw-toggle>
                    <sw-button size="sm" data-rule-edit @click=${()=>this.openEditor(e)}>עריכה</sw-button>
                    <sw-button variant="ghost" size="sm" iconOnly icon="trash" label="מחיקה" data-rule-delete @click=${()=>this.confirmDelete=e}></sw-button>
                  </div>`)}</div></sw-card>`:a`<sw-state-panel icon="rule" state="empty" heading="אין חוקים עדיין" hint="חוק בודק אירועים שכבר נשמרו ומייצר התראה במערכת; הרץ הרצה יבשה לפני שמירה."></sw-state-panel>`:this.alerts.length?a`<sw-card class="rulecard list"><div class="list">${this.alerts.map(e=>a`<div class="rule" data-alert-row data-acked=${e.acked_at?"true":"false"} style="--bg:${e.acked_at?"var(--sw-offline-soft)":"var(--sw-warning-soft)"};--fg:${e.acked_at?"var(--sw-offline-text)":"var(--sw-warning-text)"}">
                  <div class="ic"><sw-icon name="bell" size=${16}></sw-icon></div>
                  <div class="txt"><b>${e.message||e.rule_name}</b><small>${e.rule_name} · ${e.camera_id?`מצלמה ${e.camera_id}`:e.entity_id??""} · <span class="ltr">${this.fmt(e.fired_at)}</span></small><small>${e.reasons.join(" · ")}</small></div>
                  <a href=${`#/investigate/events/${e.event_id}`}><sw-button size="sm" variant="ghost" icon="bell">לאירוע</sw-button></a>
                  ${e.acked_at?a`<span class="last">טופל · ${e.acked_by_username??""}</span>`:w("events.ack")?a`<sw-button size="sm" icon="check" data-alert-ack ?disabled=${this.busy} @click=${()=>void this.run(async()=>{await U(e.id)})}>סמן כטופל</sw-button>`:d}
                </div>`)}</div></sw-card>`:a`<sw-state-panel icon="rule" state="empty" heading="אין התראות" hint="התראות נוצרות כשאירוע חדש תואם חוק פעיל."></sw-state-panel>`}
        ${this.renderEditor()}
        ${this.confirmDelete?a`<sw-dialog open heading="מחיקת חוק" subheading=${this.confirmDelete.name} @close=${()=>this.confirmDelete=null}>
              <div class="hint">ההתראות של החוק יימחקו יחד איתו; האירועים עצמם נשארים.</div>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmDelete=null}>ביטול</sw-button>
              <sw-button slot="footer" variant="danger" icon="trash" data-rule-delete-confirm @click=${()=>{const e=this.confirmDelete;this.confirmDelete=null,this.run(async()=>{await Z(e.id)})}}>מחק</sw-button>
            </sw-dialog>`:d}
      </sw-page>
    `}render(){return u()?this.renderApi():a`
      <sw-page heading="התראות וחוקי אוטומציה" subheading="Trigger → היקף → תנאים → פעולה · בדיקה יבשה לפני הפעלה · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus" @click=${()=>z("/investigate/rules/new")}>חוק חדש</sw-button>
        <sw-tabs .items=${[{id:"rules",label:"חוקים",count:y.length},{id:"notif",label:"התראות"},{id:"sched",label:"לוחות זמנים"},{id:"trig",label:"Triggers"}]} .active=${this.tab} @change=${e=>this.tab=e.detail.id}></sw-tabs>
        ${this.tab==="rules"?a`<sw-card class="rulecard list"><div class="list">
              ${y.map(e=>{const t=E[e.id]??E["r-1"];return a`<div class="rule" ?data-off=${!e.enabled} style="--bg:${t.bg};--fg:${t.fg}">
                  <div class="ic"><sw-icon .name=${t.icon} size=${18}></sw-icon></div>
                  <div class="txt"><b>${e.name}</b><small>${e.trigger} · ${e.scope} · ${e.action}</small></div>
                  <span class="last">הופעל: ${e.last}</span>
                  <sw-toggle ?checked=${e.enabled} label=""></sw-toggle>
                  <sw-button size="sm" @click=${()=>z(`/investigate/rules/${e.id}`)}>עריכה</sw-button>
                  <sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>
                </div>`})}
            </div></sw-card>`:a`<sw-card><div class="empty">${this.tab==="notif"?"ערוצי התראה: Push דרך תשתית המערכת, מייל (Beta). ההגדרה מגיעה עם T063.":this.tab==="sched"?"לוחות זמנים בזמן האתר (Asia/Jerusalem), שעון קיץ לפי התאריך.":"Triggers זמינים: אירועי NVR (אדם, רכב, תנועה, חציית קו, ניתוק) ושינויי מצב התקן (allowlist)."}</div></sw-card>`}
      </sw-page>
    `}};n.styles=[I`
    .list {
      display: flex;
      flex-direction: column;
      gap: 0;
      max-inline-size: 860px;
    }
    sw-card.rulecard {
      --sw-card-pad: 10px;
      max-inline-size: 860px;
    }
    /* R5-INVESTIGATE-297: a rule is one row - a well inside the hero list card (the sw-card of before put the slotted children in a
       block, so 60 % of a 130 px card was empty and the toggle fell under the text) */
    .rulecard {
      padding: 10px;
    }
    .rule {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 14px;
      min-block-size: 64px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      transition: transform var(--sw-t-press) var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
    }
    .rule + .rule {
      margin-block-start: 6px;
    }
    @media (hover: hover) and (pointer: fine) {
      .rule:hover {
        background: var(--sw-surface-3);
      }
    }
    .rule:active {
      transform: scale(var(--sw-press-scale));
    }
    @media (prefers-reduced-motion: reduce) {
      .rule {
        transition: none;
      }
      .rule:active {
        transform: none;
      }
    }
    .rule[data-off] {
      color: var(--sw-text-3);
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 42px;
      block-size: 42px;
      border-radius: 50%;
      background: var(--bg);
      color: var(--fg);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fg) 22%, transparent);
      flex-shrink: 0;
    }
    .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .txt b {
      display: block;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading);
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .txt small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .last {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    /* R5-INVESTIGATE-297 loop 2 (break-ui, 390 px): a rule name is what identifies it, so on the phone it wraps to two lines instead
       of "רכב באזור ..." after three words; the detail keeps one line */
    @media (max-width: 767px) {
      .txt b {
        white-space: normal;
        overflow-wrap: anywhere;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }
    }
    .empty {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      padding: 24px;
      text-align: center;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      align-self: end;
      padding-block-end: 8px;
    }
    .dryhead {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .dry {
      display: flex;
      flex-direction: column;
      max-block-size: 220px;
      overflow: auto;
    }
    .dryrow {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1.4fr);
      gap: 8px;
      padding: 4px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
    }
    .dryrow[data-fire='false'] {
      color: var(--sw-text-3);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    @media (max-width: 767px) {
      .last {
        display: none;
      }
      .two {
        grid-template-columns: 1fr;
      }
    }
  `,R,N];o([S()],n.prototype,"initialTab",2);o([r()],n.prototype,"tab",2);o([r()],n.prototype,"rulesForbidden",2);o([r()],n.prototype,"rules",2);o([r()],n.prototype,"alerts",2);o([r()],n.prototype,"unacked",2);o([r()],n.prototype,"meta",2);o([r()],n.prototype,"error",2);o([r()],n.prototype,"busy",2);o([r()],n.prototype,"loading",2);o([r()],n.prototype,"editing",2);o([r()],n.prototype,"dry",2);o([r()],n.prototype,"dryBusy",2);o([r()],n.prototype,"tree",2);o([r()],n.prototype,"cams",2);o([r()],n.prototype,"zones",2);o([r()],n.prototype,"confirmDelete",2);o([r()],n.prototype,"speakAreas",2);n=o([O("investigate-rules")],n);let g=class extends T{constructor(){super(...arguments),this.bubbleSkin=new A(this),this.ruleId="r-1"}render(){const e=y.find(t=>t.id===this.ruleId)??{name:"חוק חדש",trigger:"זיהוי אדם",scope:"חוץ",action:"התראה"};return a`
      <sw-page heading=${e.name} subheading="עורך חוק · גרסה 2 · נתוני הדגמה" crumbs="אירועים | חוקים והתראות">
        <sw-button slot="actions" icon="play">בדיקה יבשה</sw-button>
        <sw-button slot="actions" variant="primary" icon="check">שמירה</sw-button>
        <sw-steps .steps=${["Trigger","היקף","תנאים","פעולה"]} .current=${1}></sw-steps>
        <div class="layout">
          <div class="stack">
            <sw-card heading="Trigger">
              <div class="two">
                <sw-field label="מקור"><select><option>אירוע NVR</option><option>שינוי התקן</option></select></sw-field>
                <sw-field label="סוג"><select><option>${e.trigger}</option><option>זיהוי רכב</option><option>תנועה</option></select></sw-field>
              </div>
            </sw-card>
            <sw-card heading="היקף">
              <div class="two">
                <sw-field label="היקף"><select><option>${e.scope}</option><option>כל האתר</option></select></sw-field>
                <sw-field label="לוח זמנים (זמן האתר)"><input value="22:00–06:00" data-ltr /></sw-field>
              </div>
            </sw-card>
            <sw-card heading="תנאים">
              <sw-field label="חלון סמיכות"><input value="90 שניות" /></sw-field>
              <div class="hint">״אירועים סמוכים בזמן ובאזור״, לא הוכחה סיבתית. החלון מתחשב באיחור שעון ובזמן קליטה.</div>
            </sw-card>
            <sw-card heading="פעולה">
              <div class="two">
                <sw-field label="פעולה"><select><option>${e.action}</option><option>Push דרך תשתית המערכת</option><option>פתיחת תצוגת מצלמות</option></select></sw-field>
                <sw-field label="Cooldown"><input value="5 דקות" /></sw-field>
              </div>
              <div class="hint">unlock / disarm אינם מופעלים על סמך תוצאת AI. שליטה אוטומטית היא opt-in לפי allowlist.</div>
            </sw-card>
          </div>
          <div class="stack">
            <sw-card heading="בדיקה יבשה על 24 שעות">
              <div class="dry" data-fire><span>10:14 · כניסה ראשית</span><sw-badge filled kind="live" label="היה מפעיל"></sw-badge></div>
              <div class="dry"><span>09:42 · חצר</span><sw-badge filled kind="unknown" label="מחוץ ללוח הזמנים"></sw-badge></div>
              <div class="dry" data-fire><span>אתמול 23:10 · לובי</span><sw-badge filled kind="live" label="היה מפעיל"></sw-badge></div>
              <div class="hint" style="margin-block-start:8px">2 הפעלות · 0 כפילויות · correlation id לכל אירוע · מניעת לולאה: פעולה שיצרה אירוע לא מפעילה את אותו חוק.</div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `}};g.styles=[I`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* R5-INVESTIGATE-297: a dry-run hit is a well with a filled verdict */
    .dry {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
      padding: 9px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
    }
    .dry + .dry {
      margin-block-start: 6px;
    }
    .dry[data-fire] {
      background: var(--sw-success-soft);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,R,N];o([S()],g.prototype,"ruleId",2);g=o([O("investigate-rule-editor")],g);export{g as InvestigateRuleEditor,n as InvestigateRules};
//# sourceMappingURL=investigate-rules-DYERz2Ah.js.map
