import{a as R,aX as S,fp as _,b as l,af as h,aM as f,c as m,fq as L,fr as P,a3 as F,eG as J,q as v,aU as G,fs as M,ft as x,fu as k,fv as U,fw as z,A as c,fx as V,ei as E,ae as Z,fy as H,fz as q,a8 as A,o as b,b4 as X,j as T,z as O,k as d,m as j}from"./index-kIGDECLR.js";import"./sw-chip-C7H5jKYK.js";import{a as Y}from"./announcements-DdkGV35A.js";import{l as K}from"./zones-DIkolCuK.js";import{E as y}from"./events-DlxbvLCV.js";import"./sw-steps-CHl62IU8.js";import{b as C}from"./bubble-chrome-CAs08QP2.js";import{I as D}from"./investigate-r5-css-CdVmzV8L.js";import{t as e}from"./investigate-B1SelMhl.js";import"./sw-logo-art-PLtEZJxU.js";var Q=Object.defineProperty,W=Object.getOwnPropertyDescriptor,r=(s,i,n,t)=>{for(var a=t>1?void 0:t?W(i,n):i,p=s.length-1,u;p>=0;p--)(u=s[p])&&(a=(t?u(i,n,a):u(a))||a);return t&&a&&Q(i,n,a),a};const I={"r-1":{icon:"user",bg:"var(--sw-accent-soft)",fg:"var(--sw-accent-text)"},"r-2":{icon:"move",bg:"var(--sw-surface-3)",fg:"var(--sw-text-2)"},"r-3":{icon:"door",bg:"var(--sw-warning-soft)",fg:"var(--sw-warning-text)"},"r-4":{icon:"offline",bg:"var(--sw-danger-soft)",fg:"var(--sw-danger-text)"}},ee=[{id:"person-night",label:e("אדם בלילה"),body:{name:e("אדם בלילה"),description:e("זיהוי אדם בשעות הסגירה"),trigger:{types:["person"],sources:[],severity_min:"info"},window:{days:[],from:"22:00",to:"06:00"},cooldown_s:300,actions:[{kind:"notify",message:e("זוהה אדם בשעות הסגירה")}]}},{id:"camera-offline",label:e("מצלמה מנותקת"),body:{name:e("מצלמה מנותקת"),description:e("התראה כשמצלמה יורדת מהרשת"),trigger:{types:["offline"],sources:[],severity_min:"info"},window:{days:[],from:null,to:null},cooldown_s:1800,actions:[{kind:"notify",message:e("מצלמה מנותקת")}]}},{id:"door-after-hours",label:e("דלת נפתחה אחרי שעות"),body:{name:e("דלת נפתחה אחרי שעות"),description:e("פתיחת דלת מחוץ לשעות הפעילות"),trigger:{types:["door"],sources:["ha"],severity_min:"info"},window:{days:[],from:"20:00",to:"07:00"},cooldown_s:600,actions:[{kind:"notify",message:e("דלת נפתחה מחוץ לשעות הפעילות")}]}}];let o=class extends R{constructor(){super(...arguments),this.bubbleSkin=new S(this),this.initialTab="",this.tab="rules",this.rulesForbidden=!1,this.rules=[],this.alerts=[],this.unacked=0,this.meta={types:[],sources:[],days:[]},this.error="",this.busy=!1,this.loading=!1,this.editing=null,this.dry=null,this.dryBusy=!1,this.tree=null,this.cams=[],this.zones=[],this.confirmDelete=null,this.speakAreas=[],this.tz="Asia/Jerusalem"}connectedCallback(){super.connectedCallback(),this.rulesForbidden=h()&&!f("rules.manage"),(this.initialTab==="alerts"||this.rulesForbidden)&&(this.tab=h()?"alerts":"notif"),h()&&this.load()}async load(){this.loading=!0,this.error="";try{const s=Promise.reject(new m(403,{code:"forbidden",user_message:"",retryable:!1,correlation_id:"",details:{}}));s.catch(()=>{});const[i,n]=await Promise.allSettled([this.rulesForbidden?s:L(),P()]);if(n.status==="rejected")throw n.reason;const t=n.value;if(this.alerts=t.alerts,this.unacked=t.unacked,i.status==="rejected"){if(!(i.reason instanceof m&&i.reason.status===403))throw i.reason;this.rulesForbidden=!0,this.tab="alerts";return}const a=i.value;if(this.rules=a.rules,this.meta={types:a.types,sources:a.sources,days:a.days},!this.tree){const[p,u]=await Promise.all([F(),J()]);this.tree=p,this.cams=u.cameras.filter($=>$.enabled)}}catch(s){this.error=v(s)}finally{this.loading=!1}}fmt(s){return s?G(new Date(s),{timeZone:this.tz}):"—"}get floors(){return(this.tree?.sites??[]).flatMap(s=>(s.buildings??[]).flatMap(i=>(i.floors??[]).map(n=>({id:n.id,name:`${i.name} · ${n.name}`}))))}async run(s){this.busy=!0,this.error="";try{await s(),await this.load()}catch(i){this.error=v(i),i instanceof m&&i.status===409&&await this.load()}finally{this.busy=!1}}openEditor(s){if(h()&&f("media.announce")&&Y().then(i=>this.speakAreas=i.areas).catch(()=>{}),this.dry=null,this.zones=[],s){const{id:i,revision:n,alerts:t,created_by_username:a,updated_by_username:p,created_at:u,updated_at:$,last_fired_at:N,...w}=s;this.editing={id:i,revision:n,body:JSON.parse(JSON.stringify(w))},w.scope.floor_ids.length===1&&this.loadZones(w.scope.floor_ids[0])}else this.editing={id:null,revision:0,body:M()}}async loadZones(s){try{this.zones=(await K(s)).zones}catch{this.zones=[]}}edit(s){if(!this.editing)return;const i=JSON.parse(JSON.stringify(this.editing.body));s(i),this.editing={...this.editing,body:i}}toggleIn(s,i){const n=s.indexOf(i);n>=0?s.splice(n,1):s.push(i)}async dryRun(){if(this.editing){this.dryBusy=!0,this.error="";try{this.dry=this.editing.id?await x({...this.editing.body},24):await x(this.editing.body,24)}catch(s){this.error=v(s)}finally{this.dryBusy=!1}}}save(){const s=this.editing;!s||!s.body.name.trim()||this.run(async()=>{s.id?await k(s.id,{...s.body,revision:s.revision}):await U(s.body),this.editing=null,this.dry=null})}summary(s){const i=s.trigger.types.length?s.trigger.types.map(a=>y[a]??a).join(", "):e("כל הסוגים"),n=s.scope.floor_ids.length||s.scope.zone_ids.length||s.scope.camera_ids.length||s.scope.building_ids.length||s.scope.site_ids.length?[s.scope.floor_ids.length?e("{n} קומות",{n:s.scope.floor_ids.length}):"",s.scope.zone_ids.length?e("{n} אזורים",{n:s.scope.zone_ids.length}):"",s.scope.camera_ids.length?e("{n} מצלמות",{n:s.scope.camera_ids.length}):""].filter(Boolean).join(" · "):e("כל המתקן"),t=s.window.from||s.window.to||s.window.days.length?`${s.window.days.map(a=>z[a]??a).join("")||e("כל יום")} ${s.window.from??"00:00"}–${s.window.to??"24:00"}`:e("תמיד");return`${i} · ${n} · ${t} · ${e("השהיה {n} שנ׳",{n:s.cooldown_s})} · ${s.owner==="ha"?e("בבעלות תשתית המערכת ({id})",{id:s.ha_automation_id??""}):e("התראה במערכת")}`}renderEditor(){const s=this.editing;if(!s)return c;const i=s.body,n=this.dry;return l`<sw-dialog open heading=${s.id?e("עריכת חוק"):e("חוק חדש")} subheading=${e("מפעיל → היקף → חלון זמן → השהיה → התראה במערכת · הרצה יבשה לפני שמירה")} data-rule-dialog @close=${()=>this.editing=null}>
      ${this.error?l`<div class="err">${this.error}</div>`:c}
      ${s.id?c:l`<sw-field label=${e("תבניות (ממלאות את הטופס; אפשר לשנות אחר כך)")}><div class="chips">${ee.map(t=>l`<sw-chip data-rule-template=${t.id} @click=${()=>this.edit(a=>Object.assign(a,JSON.parse(JSON.stringify(t.body))))}>${t.label}</sw-chip>`)}</div></sw-field>`}
      <sw-field label=${e("שם")}><input data-rule-name .value=${i.name} @input=${t=>this.edit(a=>a.name=t.target.value)} /></sw-field>
      <sw-field label=${e("סוגי אירועים (ריק = הכל)")}><div class="chips">${this.meta.types.map(t=>l`<sw-chip data-rule-type=${t} ?selected=${i.trigger.types.includes(t)} @click=${()=>this.edit(a=>this.toggleIn(a.trigger.types,t))}>${y[t]??t}</sw-chip>`)}</div></sw-field>
      <sw-field label=${e("מקורות (ריק = הכל)")}><div class="chips">${this.meta.sources.map(t=>l`<sw-chip ?selected=${i.trigger.sources.includes(t)} @click=${()=>this.edit(a=>this.toggleIn(a.trigger.sources,t))}>${V[t]??t}</sw-chip>`)}</div></sw-field>
      <div class="two">
        <sw-field label=${e("חומרה מינימלית")}><select @change=${t=>this.edit(a=>a.trigger.severity_min=t.target.value)}>${["info","alert","critical"].map(t=>l`<option value=${t} ?selected=${i.trigger.severity_min===t}>${t==="info"?e("מידע"):t==="alert"?e("התראה"):e("קריטי")}</option>`)}</select></sw-field>
        <sw-field label=${e("השהיה בין התראות (שניות)")}><input type="number" min="0" max="86400" data-rule-cooldown .value=${String(i.cooldown_s)} @input=${t=>this.edit(a=>a.cooldown_s=Math.max(0,Number(t.target.value)||0))} /></sw-field>
      </div>
      <sw-field label=${e("היקף: קומות (ריק = כל המתקן)")}><div class="chips">${this.floors.map(t=>l`<sw-chip data-rule-floor=${t.id} ?selected=${i.scope.floor_ids.includes(t.id)} @click=${()=>{this.edit(p=>this.toggleIn(p.scope.floor_ids,t.id));const a=this.editing?.body.scope.floor_ids??[];a.length===1?this.loadZones(a[0]):this.zones=[]}}>${t.name}</sw-chip>`)}</div></sw-field>
      ${this.zones.length?l`<sw-field label=${e("חדרים / אזורים בקומה שנבחרה")}><div class="chips">${this.zones.map(t=>l`<sw-chip ?selected=${i.scope.zone_ids.includes(t.id)} @click=${()=>this.edit(a=>this.toggleIn(a.scope.zone_ids,t.id))}>${t.name}</sw-chip>`)}</div></sw-field>`:c}
      <sw-field label=${e("מצלמות ספציפיות (לא חובה)")}><div class="chips">${this.cams.map(t=>l`<sw-chip ?selected=${i.scope.camera_ids.includes(t.id)} @click=${()=>this.edit(a=>this.toggleIn(a.scope.camera_ids,t.id))}>${t.name}</sw-chip>`)}</div></sw-field>
      <sw-field label=${e("ימים (ריק = כל יום)")}><div class="chips">${this.meta.days.map(t=>l`<sw-chip ?selected=${i.window.days.includes(t)} @click=${()=>this.edit(a=>this.toggleIn(a.window.days,t))}>${z[t]??t}</sw-chip>`)}</div></sw-field>
      <div class="two">
        <sw-field label=${e("משעה (זמן האתר)")}><input type="time" lang=${E()} data-ltr .value=${i.window.from??""} @change=${t=>this.edit(a=>a.window.from=t.target.value||null)} /></sw-field>
        <sw-field label=${e("עד שעה")}><input type="time" lang=${E()} data-ltr .value=${i.window.to??""} @change=${t=>this.edit(a=>a.window.to=t.target.value||null)} /></sw-field>
      </div>
      <div class="two">
        <sw-field label=${e("פעולה")}><select data-rule-action-kind @change=${t=>this.edit(a=>a.actions=[{...a.actions[0]??{message:""},kind:t.target.value}])}>
          <option value="notify" ?selected=${(i.actions[0]?.kind??"notify")==="notify"}>${e("התראה במערכת")}</option><option value="ha_notify" ?selected=${i.actions[0]?.kind==="ha_notify"}>${e("התראה דרך תשתית המערכת (notify)")}</option>
          ${f("media.announce")||i.actions[0]?.kind==="announce"?l`<option value="announce" ?selected=${i.actions[0]?.kind==="announce"}>${e("הכרזה קולית")}</option>`:c}
        </select></sw-field>
        ${i.actions[0]?.kind==="announce"?l`<sw-field label=${e("חדר להכרזה")}><select data-rule-announce-room @change=${t=>this.edit(a=>a.actions=[{...a.actions[0],scope:"area",ref:t.target.value}])}>
              <option value="" ?selected=${!i.actions[0]?.ref}>—</option>${this.speakAreas.map(t=>l`<option value=${t.area_id} ?selected=${i.actions[0]?.ref===t.area_id}>${[t.floor_name,t.name].filter(Boolean).join(" · ")}</option>`)}</select></sw-field>`:c}
        ${i.actions[0]?.kind==="ha_notify"?l`<sw-field label=${e("שירות notify בתשתית המערכת (למשל mobile_app_phone)")}><input data-ltr data-rule-service placeholder="mobile_app_phone" .value=${i.actions[0]?.service??""} @input=${t=>this.edit(a=>a.actions=[{...a.actions[0],service:t.target.value.trim()}])} /></sw-field>`:c}
      </div>
      <sw-field label=${e("הודעת ההתראה")}><input data-rule-message .value=${i.actions[0]?.message??""} @input=${t=>this.edit(a=>a.actions=[{...a.actions[0]??{kind:"notify"},message:t.target.value}])} /></sw-field>
      ${i.actions[0]?.kind==="ha_notify"?l`<div class="hint">${e('התראה דרך תשתית המערכת דורשת את ההרשאה הרגישה "חוקים: התראה דרך תשתית המערכת" (תפקיד מותאם). ההודעה נשלחת ל־notify.<שירות> עם הכותרת Arx.')}</div>`:c}
      <div class="two">
        <sw-field label=${e("בעלות")}><select @change=${t=>this.edit(a=>a.owner=t.target.value)}><option value="local" ?selected=${i.owner==="local"}>${e("מקומי (המערכת מפעילה)")}</option><option value="ha" ?selected=${i.owner==="ha"}>${e("תשתית המערכת (הפניה בלבד)")}</option></select></sw-field>
        ${i.owner==="ha"?l`<sw-field label=${e("מזהה אוטומציה בתשתית המערכת")}><input .value=${i.ha_automation_id??""} @input=${t=>this.edit(a=>a.ha_automation_id=t.target.value||null)} /></sw-field>`:l`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${e("פעיל")} .checked=${i.enabled} @change=${t=>this.edit(a=>a.enabled=Z(t))}></sw-toggle> ${e("פעיל")}</label>`}
      </div>
      <div class="hint">${e("הפעולה היחידה בפיילוט: התראה במערכת. אין פקודות למכשירים ואין webhooks; התראה אינה אירוע ולכן חוק לא יכול להזין את עצמו. חוק בבעלות תשתית המערכת אינו מופעל כאן (בעלים אחד לכל אוטומציה).")}</div>
      <div class="dryhead"><sw-button size="sm" icon="refresh" data-rule-dryrun ?disabled=${this.dryBusy} @click=${()=>this.dryRun()}>${this.dryBusy?e("מריץ…"):e("הרצה יבשה על 24 שעות")}</sw-button>${n?l`<span class="hint" data-dryrun-result>${e("{n} אירועים נבדקו",{n:n.evaluated})} · <strong>${n.would_fire.length}</strong> ${e("התראות היו נוצרות")} · ${e("{n} נחסמו בהשהיה",{n:n.suppressed.length})} · ${e("{n} לא תאמו",{n:n.not_matched})}</span>`:c}</div>
      ${n?l`<div class="dry">${[...n.would_fire.map(t=>({...t,fire:!0})),...n.suppressed.map(t=>({...t,fire:!1}))].sort((t,a)=>t.occurred_at.localeCompare(a.occurred_at)).slice(0,40).map(t=>l`<div class="dryrow" data-dryrun-row data-fire=${t.fire?"true":"false"}><span class="ltr">${this.fmt(t.occurred_at)}</span><span>${y[t.type]??t.type} · ${t.camera_name??"—"}</span><span class="hint">${t.fire?t.reasons.join(" · "):e("נחסם: {reason}",{reason:t.suppressed??""})}</span></div>`)}${n.would_fire.length+n.suppressed.length>40?l`<div class="hint">${e("מוצגות 40 הראשונות")}</div>`:c}<div class="hint">${n.note}</div></div>`:c}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.editing=null}>${e("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-rule-save ?disabled=${this.busy||!i.name.trim()} @click=${()=>this.save()}>${s.id?e("שמירה"):e("צור חוק")}</sw-button>
    </sw-dialog>`}renderApi(){return this.error&&!this.rules.length&&!this.editing?l`<sw-page heading=${e("התראות וחוקי אוטומציה")}><sw-state-panel state="error" hint=${this.error} actionLabel=${e("נסה שוב")} @action=${()=>this.load()}></sw-state-panel></sw-page>`:l`
      <sw-page heading=${e("התראות וחוקי אוטומציה")} subheading=${e("מפעיל → היקף → חלון זמן → השהיה → התראה במערכת · הרצה יבשה לפני הפעלה · אין פקודות למכשירים")}>
        ${this.rulesForbidden?c:l`<sw-button slot="actions" variant="primary" icon="plus" data-rule-new @click=${()=>this.openEditor()}>${e("חוק חדש")}</sw-button>`}
        <sw-tabs .items=${this.rulesForbidden?[{id:"alerts",label:e("התראות"),count:this.unacked}]:[{id:"rules",label:e("חוקים"),count:this.rules.length},{id:"alerts",label:e("התראות"),count:this.unacked}]} .active=${this.tab} @change=${s=>this.tab=s.detail.id}></sw-tabs>
        ${this.error&&!this.editing?l`<div class="err">${this.error}</div>`:c}
        ${this.tab==="rules"?this.loading&&!this.rules.length?l`<sw-state-panel state="loading"></sw-state-panel>`:this.rules.length?l`<sw-card class="rulecard list"><div class="list">${this.rules.map(s=>l`<div class="rule" data-rule-row data-rule-id=${s.id} style="--bg:var(--sw-accent-soft);--fg:var(--sw-accent-text)">
                    <div class="ic"><sw-icon name=${s.owner==="ha"?"home":"bell"} size=${16}></sw-icon></div>
                    <div class="txt"><b>${s.name}</b><small>${this.summary(s)}</small><small>${e("התראות: {open} פתוחות מתוך {total}",{open:s.alerts.open,total:s.alerts.total})} · ${e("שונה על ידי {user}",{user:s.updated_by_username??s.created_by_username??"—"})} ${this.fmt(s.updated_at)}</small></div>
                    <span class="last">${e("הופעל:")} ${s.last_fired_at?this.fmt(s.last_fired_at):"—"}</span>
                    <sw-toggle ?checked=${s.enabled} ?disabled=${this.busy||s.owner==="ha"} labelHidden label=${e("פעיל")} data-rule-toggle @change=${i=>void this.run(async()=>{const{id:n,revision:t,alerts:a,created_by_username:p,updated_by_username:u,created_at:$,updated_at:N,last_fired_at:w,...B}=s;await k(n,{...B,enabled:i.detail.checked,revision:t})})}></sw-toggle>
                    <sw-button size="sm" data-rule-edit @click=${()=>this.openEditor(s)}>${e("עריכה")}</sw-button>
                    <sw-button variant="ghost" size="sm" iconOnly icon="trash" label=${e("מחיקה")} data-rule-delete @click=${()=>this.confirmDelete=s}></sw-button>
                  </div>`)}</div></sw-card>`:l`<sw-state-panel icon="rule" state="empty" heading=${e("אין חוקים עדיין")} hint=${e("חוק בודק אירועים שכבר נשמרו ומייצר התראה במערכת; הרץ הרצה יבשה לפני שמירה.")}></sw-state-panel>`:this.alerts.length?l`<sw-card class="rulecard list"><div class="list">${this.alerts.map(s=>l`<div class="rule" data-alert-row data-acked=${s.acked_at?"true":"false"} style="--bg:${s.acked_at?"var(--sw-offline-soft)":"var(--sw-warning-soft)"};--fg:${s.acked_at?"var(--sw-offline-text)":"var(--sw-warning-text)"}">
                  <div class="ic"><sw-icon name="bell" size=${16}></sw-icon></div>
                  <div class="txt"><b>${s.message||s.rule_name}</b><small>${s.rule_name} · ${s.camera_id?e("מצלמה {id}",{id:s.camera_id}):s.entity_id??""} · <span class="ltr">${this.fmt(s.fired_at)}</span></small><small>${s.reasons.join(" · ")}</small></div>
                  <a href=${`#/investigate/events/${s.event_id}`}><sw-button size="sm" variant="ghost" icon="bell">${e("לאירוע")}</sw-button></a>
                  ${s.acked_at?l`<span class="last">${e("טופל")} · ${s.acked_by_username??""}</span>`:f("events.ack")?l`<sw-button size="sm" icon="check" data-alert-ack ?disabled=${this.busy} @click=${()=>void this.run(async()=>{await H(s.id)})}>${e("סמן כטופל")}</sw-button>`:c}
                </div>`)}</div></sw-card>`:l`<sw-state-panel icon="rule" state="empty" heading=${e("אין התראות")} hint=${e("התראות נוצרות כשאירוע חדש תואם חוק פעיל.")}></sw-state-panel>`}
        ${this.renderEditor()}
        ${this.confirmDelete?l`<sw-dialog open heading=${e("מחיקת חוק")} subheading=${this.confirmDelete.name} @close=${()=>this.confirmDelete=null}>
              <div class="hint">${e("ההתראות של החוק יימחקו יחד איתו; האירועים עצמם נשארים.")}</div>
              <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmDelete=null}>${e("ביטול")}</sw-button>
              <sw-button slot="footer" variant="danger" icon="trash" data-rule-delete-confirm @click=${()=>{const s=this.confirmDelete;this.confirmDelete=null,this.run(async()=>{await q(s.id)})}}>${e("מחק")}</sw-button>
            </sw-dialog>`:c}
      </sw-page>
    `}render(){return h()?this.renderApi():l`
      <sw-page heading=${e("התראות וחוקי אוטומציה")} subheading=${e("מפעיל → היקף → תנאים → פעולה · בדיקה יבשה לפני הפעלה · נתוני הדגמה")}>
        <sw-button slot="actions" variant="primary" icon="plus" @click=${()=>A("/investigate/rules/new")}>${e("חוק חדש")}</sw-button>
        <sw-tabs .items=${[{id:"rules",label:e("חוקים"),count:_.length},{id:"notif",label:e("התראות")},{id:"sched",label:e("לוחות זמנים")},{id:"trig",label:b("videoCopy.triggers")}]} .active=${this.tab} @change=${s=>this.tab=s.detail.id}></sw-tabs>
        ${this.tab==="rules"?l`<sw-card class="rulecard list"><div class="list">
              ${_.map(s=>{const i=I[s.id]??I["r-1"];return l`<div class="rule" ?data-off=${!s.enabled} style="--bg:${i.bg};--fg:${i.fg}">
                  <div class="ic"><sw-icon .name=${i.icon} size=${18}></sw-icon></div>
                  <div class="txt"><b>${s.name}</b><small>${s.trigger} · ${s.scope} · ${s.action}</small></div>
                  <span class="last">${e("הופעל:")} ${s.last}</span>
                  <sw-toggle ?checked=${s.enabled} labelHidden label=${`${e("פעיל")} · ${s.name}`}></sw-toggle>
                  <sw-button size="sm" @click=${()=>A(`/investigate/rules/${s.id}`)}>${e("עריכה")}</sw-button>
                  <sw-button variant="ghost" size="sm" iconOnly icon="more" label=${e("עוד")}></sw-button>
                </div>`})}
            </div></sw-card>`:l`<sw-card><div class="empty">${this.tab==="notif"?e("ערוצי התראה: Push דרך תשתית המערכת, מייל (Beta). ההגדרה מגיעה עם T063."):this.tab==="sched"?b("videoCopy.schedEmpty"):b("videoCopy.triggersEmpty")}</div></sw-card>`}
      </sw-page>
    `}};o.styles=[T`
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
    ${X}
    @media (max-width: 767px) {
      .last {
        display: none;
      }
      .two {
        grid-template-columns: 1fr;
      }
    }
  `,C,D];r([O()],o.prototype,"initialTab",2);r([d()],o.prototype,"tab",2);r([d()],o.prototype,"rulesForbidden",2);r([d()],o.prototype,"rules",2);r([d()],o.prototype,"alerts",2);r([d()],o.prototype,"unacked",2);r([d()],o.prototype,"meta",2);r([d()],o.prototype,"error",2);r([d()],o.prototype,"busy",2);r([d()],o.prototype,"loading",2);r([d()],o.prototype,"editing",2);r([d()],o.prototype,"dry",2);r([d()],o.prototype,"dryBusy",2);r([d()],o.prototype,"tree",2);r([d()],o.prototype,"cams",2);r([d()],o.prototype,"zones",2);r([d()],o.prototype,"confirmDelete",2);r([d()],o.prototype,"speakAreas",2);o=r([j("investigate-rules")],o);let g=class extends R{constructor(){super(...arguments),this.bubbleSkin=new S(this),this.ruleId="r-1"}render(){const s=_.find(i=>i.id===this.ruleId)??{name:e("חוק חדש"),trigger:e("זיהוי אדם"),scope:e("חוץ"),action:e("התראה")};return l`
      <sw-page heading=${s.name} subheading=${e("עורך חוק · גרסה 2 · נתוני הדגמה")} crumbs=${`${e("אירועים")} | ${e("חוקים והתראות")}`}>
        <sw-button slot="actions" icon="play">${e("בדיקה יבשה")}</sw-button>
        <sw-button slot="actions" variant="primary" icon="check">${e("שמירה")}</sw-button>
        <sw-steps .steps=${[e("מפעיל"),e("היקף"),e("תנאים"),e("פעולה")]} .current=${1}></sw-steps>
        <div class="layout">
          <div class="stack">
            <sw-card heading=${e("מפעיל")}>
              <div class="two">
                <sw-field label=${e("מקור")}><select><option>${e("אירוע מקליט")}</option><option>${e("שינוי התקן")}</option></select></sw-field>
                <sw-field label=${e("סוג")}><select><option>${s.trigger}</option><option>${e("זיהוי רכב")}</option><option>${e("תנועה")}</option></select></sw-field>
              </div>
            </sw-card>
            <sw-card heading=${e("היקף")}>
              <div class="two">
                <sw-field label=${e("היקף")}><select><option>${s.scope}</option><option>${e("כל האתר")}</option></select></sw-field>
                <sw-field label=${e("לוח זמנים (זמן האתר)")}><input value="22:00–06:00" data-ltr /></sw-field>
              </div>
            </sw-card>
            <sw-card heading=${e("תנאים")}>
              <sw-field label=${e("חלון סמיכות")}><input value=${e("90 שניות")} /></sw-field>
              <div class="hint">${e("״אירועים סמוכים בזמן ובאזור״, לא הוכחה סיבתית. החלון מתחשב באיחור שעון ובזמן קליטה.")}</div>
            </sw-card>
            <sw-card heading=${e("פעולה")}>
              <div class="two">
                <sw-field label=${e("פעולה")}><select><option>${s.action}</option><option>${e("Push דרך תשתית המערכת")}</option><option>${e("פתיחת תצוגת מצלמות")}</option></select></sw-field>
                <sw-field label="Cooldown"><input value=${e("5 דקות")} /></sw-field>
              </div>
              <div class="hint">${e("פתיחת נעילה וניטרול אזעקה אינם מופעלים על סמך תוצאת זיהוי. שליטה אוטומטית מופעלת רק בבחירה מפורשת, לפי רשימת התקנים מאושרים.")}</div>
            </sw-card>
          </div>
          <div class="stack">
            <sw-card heading=${e("בדיקה יבשה על 24 שעות")}>
              <div class="dry" data-fire><span>${e("10:14 · כניסה ראשית")}</span><sw-badge filled kind="live" label=${e("היה מפעיל")}></sw-badge></div>
              <div class="dry"><span>${e("09:42 · חצר")}</span><sw-badge filled kind="unknown" label=${e("מחוץ ללוח הזמנים")}></sw-badge></div>
              <div class="dry" data-fire><span>${e("אתמול 23:10 · לובי")}</span><sw-badge filled kind="live" label=${e("היה מפעיל")}></sw-badge></div>
              <div class="hint" style="margin-block-start:8px">${e("2 הפעלות · 0 כפילויות · מזהה קישור לכל אירוע · מניעת לולאה: פעולה שיצרה אירוע לא מפעילה את אותו חוק.")}</div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `}};g.styles=[T`
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
  `,C,D];r([O()],g.prototype,"ruleId",2);g=r([j("investigate-rule-editor")],g);export{g as InvestigateRuleEditor,o as InvestigateRules};
