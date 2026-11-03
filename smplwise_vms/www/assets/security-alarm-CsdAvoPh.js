import{a as z,S as _,ar as E,bs as T,aA as C,i as v,pt as I,pu as R,R as h,aj as y,dZ as S,pv as b,pw as F,px as O,py as f,dW as D,j as m,pz as A,e as r,A as l,e2 as P,e3 as Z,pA as x,pB as L,b5 as M,e6 as H,C as U,E as V,F as Y,G as p,H as j}from"./index-ERz5hp4d.js";import"./sw-logo-art-Va6y_cIM.js";const k=new Date(Date.now()-12*6e4).toISOString();function w(e,a,s,n,o={}){return{entity_id:`binary_sensor.demo_zone_${e}`,name:a,platform:"demo",device_class:n==="motion"?"motion":"door",kind:n,state:o.open?"on":"off",available:!0,open:!1,fault:!1,tamper:!1,battery_low:!1,battery_level:null,alarmed:!1,bypassed:!1,last_changed:k,area_id:s,area_name:s,ha_floor_name:null,zone_number:e,aux:[],shared:!1,bypass:{entity_id:`switch.demo_zone_${e}_bypassed`,domain:"switch",name:`${a} עקיפה`,state:o.bypassed?"on":"off",available:!0,bypassed:!!o.bypassed,strategy:"device",on_option:null,off_option:null},...o}}const B={panels:[{entity_id:"alarm_control_panel.demo_house",name:"בית",platform:"demo",integration:"הדגמה",integration_note:"",config_entry_id:null,state:"disarmed",available:!0,fresh:!0,last_changed:k,changed_by:"דייר 1",arm_modes:["arm_home","arm_away","arm_night"],features_reported:!0,code_format:"number",code_arm_required:!1,needs_code_arm:!1,needs_code_disarm:!0,area_name:null,open_sensors:[],bypassed_sensors:[],zones:[w(1,"דלת כניסה","כניסה","opening"),w(2,"דלת אחורית","מטבח","opening",{open:!0,state:"on"}),w(3,"גלאי סלון","סלון","motion"),w(4,"חלון מטבח","מטבח","opening",{bypassed:!0}),w(5,"חלון חדר שינה","חדר שינה","opening",{battery_low:!0}),w(6,"גלאי עשן","מטבח","fault")],unpaired_controls:[],ready:{ready:!1,open:["binary_sensor.demo_zone_2"],faults:[]},can:{arm:!0,disarm:!0,bypass:!0,restore:!0},panel_code_set:!0,code:{arm:"none",disarm:"pin",bypass:"pin"}}],counts:{panels:1,zones:6,open:1,bypassed:1,faults:0},channel:"local",remote:{control:!0,disarm:!0,codeless:!0},code_mode:"personal_pin",me:{arm_policy:"no_code",disarm_policy:"code_required",pin_set:!0},can_configure:!0};var q=Object.defineProperty,N=Object.getOwnPropertyDescriptor,c=(e,a,s,n)=>{for(var o=n>1?void 0:n?N(a,s):a,t=e.length-1,i;t>=0;t--)(i=e[t])&&(o=(n?i(a,s,o):i(o))||o);return n&&o&&q(a,s,o),o};const $="sw.alarm.zones.view";function K(){try{return localStorage.getItem($)==="list"?"list":"cards"}catch{return"cards"}}const W=[{id:"all",label:"הכל"},{id:"open",label:"פתוחים בלבד"},{id:"bypassed",label:"עקופים"},{id:"faults",label:"תקלות"}];function g(e){if(!e)return"";const a=new Date(e);if(Number.isNaN(a.getTime()))return"";const s=Math.round((Date.now()-a.getTime())/1e3);return s<60?"עכשיו":s<3600?`לפני ${Math.round(s/60)} דק׳`:s<86400?`לפני ${Math.round(s/3600)} שע׳`:M(a)}let d=class extends z{constructor(){super(...arguments),this.bubbleSkin=new _(this),this.panelId="",this.data=null,this.error="",this.loading=!0,this.filter="all",this.zoneView=K(),this.stateFlash=!1,this.flashTimer=0,this.pending=null,this.code="",this.codeError="",this.busy=!1,this.sent=null,this.toast="",this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""},this.pinError="",this.refetchTimer=0,this.pollTimer=0,this.toastTimer=0,this.watched=new Set}connectedCallback(){super.connectedCallback(),this.stopSession=E(e=>{e.mode!=="loading"&&(this.load(),e.mode==="api"&&!this.stopHa&&(this.stopHa=T(a=>{a.type==="entity_state_changed"&&this.watched.has(a.entity.entity_id)&&this.scheduleRefetch(),a.type==="structure_changed"&&this.scheduleRefetch()}),this.pollTimer=window.setInterval(()=>void this.load(!0),15e3)))})}disconnectedCallback(){super.disconnectedCallback(),this.stopHa?.(),this.stopSession?.(),window.clearInterval(this.pollTimer),window.clearTimeout(this.refetchTimer),window.clearTimeout(this.toastTimer),window.clearTimeout(this.flashTimer),this.clearCode()}willUpdate(e){if(e.has("panelId")&&!this.panelId){const s=C().params.get("panel");s&&(this.panelId=s)}const a=this.panel?`${this.panel.entity_id}:${this.panel.state??""}:${this.panel.available}`:void 0;if(a!==this.lastHeroState){const s=this.lastHeroState===void 0;this.lastHeroState=a,!s&&a!==void 0&&(this.stateFlash=!0,window.clearTimeout(this.flashTimer),this.flashTimer=window.setTimeout(()=>this.stateFlash=!1,700))}}setZoneView(e){this.zoneView=e;try{localStorage.setItem($,e)}catch{}}scheduleRefetch(){window.clearTimeout(this.refetchTimer),this.refetchTimer=window.setTimeout(()=>void this.load(!0),250)}async load(e=!1){e||(this.loading=!this.data);try{this.data=v()?await I():B,v()&&R(this.data.panels.length),this.error="",this.watched=new Set(this.data.panels.flatMap(a=>[a.entity_id,...a.zones.flatMap(s=>[s.entity_id,...s.aux,...s.bypass?[s.bypass.entity_id]:[]]),...a.unpaired_controls.map(s=>s.entity_id)]))}catch(a){(!e||!this.data)&&(this.error=h(a))}finally{this.loading=!1}}get panel(){const e=this.data?.panels??[];return e.find(a=>a.entity_id===this.panelId)??e[0]??null}choosePanel(e){this.panelId=e,y("/system/security/alarm",{panel:e})}async openLiveIncident(e){this.busy=!0;try{const a=await S({alarm_panel:e});y(`/investigate/incidents/${encodeURIComponent(a.incident.id)}`)}catch(a){this.flash(h(a))}finally{this.busy=!1}}flash(e){this.toast=e,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",4e3)}start(e){if(e.prompt==="pin_missing"){this.data?.panels.some(a=>a.panel_code_set)?(this.pinOpen=!0,this.pinError="נדרש קוד אישי. הקלידו את קוד הלוח כדי להגדיר אותו, או פנו למנהל המערכת לקבלת קוד אישי."):this.flash("פנה למנהל המערכת לקבלת קוד אישי.");return}if(e.prompt==="unverifiable"){this.flash(b.code_unverifiable+" - פנו למנהל המערכת.");return}if(e.prompt==="none"&&!e.needsConfirm){this.send(e,"");return}this.clearCode(),this.pending=e}clearCode(){this.code="",this.codeError="";const e=this.renderRoot?.querySelector("input[data-code]");e&&(e.value="")}closeDialog(){this.pending=null,this.clearCode()}async send(e,a){if(!v()){this.closeDialog(),this.flash("נתוני הדגמה: לא נשלחה פקודה.");return}this.busy=!0,this.codeError="";try{const s=e.kind==="panel"?await F(e.panel.entity_id,e.action,{confirmed:e.action==="disarm",code:a||void 0}):await O(e.zone.entity_id,e.action==="bypass_on",{confirmed:!0,code:a||void 0});this.closeDialog();const n=e.kind==="panel"?f[e.action]:e.action==="bypass_on"?`עקיפת ${e.zone.name}`:`החזרת ${e.zone.name} להגנה`;this.sent={label:n,record:s,entity:s.entity_id};const o={stopped:!1};D(s.id,t=>{this.sent&&this.sent.record&&this.sent.record.id===t.id&&(this.sent={...this.sent,record:t})},o).then(()=>this.load(!0)),this.load(!0)}catch(s){const n=s instanceof m?s.body.code:"";s instanceof m&&n==="code_required"?(this.pending={...e,prompt:s.body.details?.prompt??"panel"},this.codeError=""):s instanceof m&&this.pending&&["wrong_code","code_locked","rate_limited","code_rejected"].includes(n)?(this.clearCode(),this.codeError=b[n]??h(s)):(this.closeDialog(),this.flash(b[n]??h(s)))}finally{this.busy=!1}}submitCode(){const e=this.pending;if(!e)return;if(e.prompt!=="none"&&!this.code){this.codeError="הקלידו קוד";return}const a=this.code;this.code="",this.send(e,e.prompt==="none"?"":a)}key(e){e==="back"?this.code=this.code.slice(0,-1):e==="clear"?this.code="":this.code.length<32&&(this.code+=e),this.codeError=""}async savePin(){const e=this.pinForm;if(!/^\d{4,8}$/.test(e.next)){this.pinError="קוד אישי: 4–8 ספרות.";return}if(e.next!==e.again){this.pinError="הקודים אינם זהים.";return}if(!v()){this.pinOpen=!1,this.flash("נתוני הדגמה: הקוד לא נשמר.");return}this.busy=!0;try{await A(e.next,e.current||void 0,e.panel||void 0),this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""},this.pinError="",this.flash("הקוד האישי נשמר"),await this.load(!0)}catch(a){this.pinError=a instanceof m&&a.body.code==="wrong_code"?this.data?.me.pin_set?"הקוד הנוכחי שגוי.":"קוד הלוח שגוי.":a instanceof m?b[a.body.code]??h(a):h(a)}finally{this.busy=!1}}render(){if(this.loading&&!this.data)return r`<sw-page heading="אזעקה"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.error&&!this.data)return r`<sw-page heading="אזעקה"><sw-state-panel state="error" heading="לא ניתן לטעון את האזעקה" hint=${this.error} actionLabel="נסו שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const e=this.data,a=this.panel;if(!a)return r`<sw-page heading="אזעקה"><sw-state-panel icon="shield" data-alarm-empty state="empty" heading="לא נמצא לוח אזעקה"
        hint="המערכת לא מצאה לוח אזעקה מחובר. מתקין או מנהל המערכת יכול לבדוק בהגדרות ‹ אבטחה ‹ ניהול אזעקה שמערכת האזעקה מחוברת לתשתית המערכת ושההרשאות מאפשרות לראות אותה."></sw-state-panel></sw-page>`;const s=`${e.counts.zones} חיישנים · ${e.counts.open} פתוחים · ${e.counts.bypassed} עקופים${e.counts.faults?` · ${e.counts.faults} תקלות`:""}${e.channel==="remote"?" · מחוץ לרשת המקומית":""}`;return r`<sw-page heading="אזעקה" subheading=${s}>
      <sw-button slot="actions" size="sm" variant="ghost" icon="lock" data-alarm-pin @click=${()=>{this.pinOpen=!0,this.pinError=""}}>הקוד האישי שלי</sw-button>
      ${P(H())?r`<sw-button slot="actions" size="sm" icon="warning" data-alarm-incident ?disabled=${this.busy} @click=${()=>void this.openLiveIncident(a.entity_id)}>${Z("alarmOpen")}</sw-button>`:l}
      ${e.panels.length>1?r`<div class="switcher" role="group" aria-label="בחירת לוח" data-alarm-switcher>${e.panels.map(n=>{const o=x(n.state,n.available);return r`<button type="button" aria-pressed=${n.entity_id===a.entity_id} data-panel=${n.entity_id} @click=${()=>this.choosePanel(n.entity_id)}><i class="dot ${o.tone}"></i>${n.name}<span class="hint">· ${o.label}</span></button>`})}</div>`:l}
      ${this.renderHero(a)}
      ${this.renderZones(a)}
      ${a.unpaired_controls.length?r`<details class="unpaired" data-alarm-unpaired><summary>ללא שיוך · ${a.unpaired_controls.length} מתגי עקיפה שלא שויכו לחיישן</summary><ul>${a.unpaired_controls.map(n=>r`<li>${n.name}${n.bypassed?" · עוקף":""}</li>`)}</ul><div class="hint">שיוך ידני: הגדרות ‹ אבטחה ‹ ניהול אזעקה.</div></details>`:l}
    </sw-page>
    ${this.renderKeypad()} ${this.renderPin()} ${this.toast?r`<div class="toast" role="status" aria-live="polite">${this.toast}</div>`:l}`}renderHero(e){const a=x(e.state,e.available),s=e.state==="disarmed",n=new Map(e.zones.map(i=>[i.entity_id,i])),o=i=>n.get(i)?.name??i,t=this.sent&&this.sent.entity===e.entity_id?this.sent:null;return r`<section class="hero ${this.stateFlash?"changed":""}" data-tone=${a.tone} data-alarm-state=${e.state??"unknown"} data-alarm-panel=${e.entity_id}>
      <div class="state-row">
        <span class="shield" aria-hidden="true"><sw-icon name=${a.tone==="triggered"?"warning":s?"unlock":"shield"} size=${30}></sw-icon></span>
        <div>
          <div class="state-label" role="status" aria-live="polite">${a.label}</div>
          <div class="meta">${e.name}${e.changed_by?` · שונה על ידי ${e.changed_by}`:""}${e.last_changed?` · ${g(e.last_changed)}`:""}</div>
        </div>
      </div>
      <div class="actions">
        ${e.can.arm?e.arm_modes.filter(i=>i!=="arm_custom_bypass"||e.can.bypass).map(i=>r`<sw-button variant=${i==="arm_away"?"primary":"secondary"} icon="shield" data-arm=${i} ?disabled=${this.busy||!e.available||e.state===i.replace("arm_","armed_")}
              @click=${()=>this.start({kind:"panel",action:i,panel:e,prompt:e.code.arm,needsConfirm:!1})}>${f[i]}</sw-button>`):l}
        ${e.can.disarm?r`<sw-button variant="danger" icon="unlock" data-disarm ?disabled=${this.busy||!e.available||s}
              @click=${()=>this.start({kind:"panel",action:"disarm",panel:e,prompt:e.code.disarm,needsConfirm:!0})}>${f.disarm}</sw-button>`:l}
      </div>
      ${s?r`<div class="ready ${e.ready.ready?"":"no"}" data-alarm-ready=${e.ready.ready?"yes":"no"}>
            <sw-icon name=${e.ready.ready?"check":"warning"} size=${16}></sw-icon>
            <div>${e.ready.ready?"מוכנה לדריכה: כל החיישנים סגורים.":r`<b>לא מוכנה לדריכה</b>
                  <ul>${e.ready.open.map(i=>r`<li>פתוח: ${o(i)}</li>`)}${e.ready.faults.map(i=>r`<li>תקלה: ${o(i)}</li>`)}</ul>
                  <span class="hint">אפשר לסגור, או לעקוף חיישן לפני הדריכה.</span>`}</div>
          </div>`:l}
      ${t?r`<div class="sent" data-alarm-sent=${t.record?.status??"pending"}>${t.label}: ${t.record?.status==="confirmed"?"הלוח אישר.":t.record?.status==="unknown"?"הלוח לא אישר את הפקודה בזמן (ייתכן שהקוד שגוי) - המצב המוצג הוא מה שהלוח מדווח.":t.record?.status==="failed"||t.record?.status==="denied"?`הפקודה לא בוצעה${t.record.error?` (${b[t.record.error]??t.record.error})`:""}.`:"נשלח · ממתין לאישור הלוח…"}</div>`:l}
    </section>`}visibleZones(e){switch(this.filter){case"open":return e.zones.filter(a=>a.open&&!a.bypassed);case"bypassed":return e.zones.filter(a=>a.bypassed);case"faults":return e.zones.filter(a=>a.fault||a.tamper);default:return e.zones}}renderZones(e){const a=this.visibleZones(e),s=new Map;for(const t of a){const i=t.area_name??"ללא אזור";s.has(i)||s.set(i,[]),s.get(i).push(t)}const n={all:e.zones.length,open:e.zones.filter(t=>t.open&&!t.bypassed).length,bypassed:e.zones.filter(t=>t.bypassed).length,faults:e.zones.filter(t=>t.fault||t.tamper).length},o=this.zoneView==="list";return r`<div class="toolbar">
        <div class="chips" role="group" aria-label="סינון חיישנים">${W.map(t=>r`<button type="button" aria-pressed=${this.filter===t.id} data-filter=${t.id} @click=${()=>this.filter=t.id}>${t.label}${t.id!=="all"&&n[t.id]?r`<span class="n">${n[t.id]}</span>`:l}</button>`)}</div>
        <div class="end">
          <span class="counts">${a.length} מתוך ${e.zones.length} חיישנים</span>
          <div class="vt" role="group" aria-label="תצוגת חיישנים" data-alarm-view>
            <button type="button" aria-pressed=${!o} aria-label="כרטיסים" title="כרטיסים" data-alarm-view-cards @click=${()=>this.setZoneView("cards")}><sw-icon name="grid" size=${15}></sw-icon></button>
            <button type="button" aria-pressed=${o} aria-label="רשימה" title="רשימה" data-alarm-view-list @click=${()=>this.setZoneView("list")}><sw-icon name="list" size=${15}></sw-icon></button>
          </div>
        </div>
      </div>
      ${e.zones.length?a.length?r`<div class="areas ${o?"list":""}">${[...s.entries()].map(([t,i])=>r`<section data-area=${t}><h3>${t}<span class="n">${i.length}</span></h3>${o?r`<div class="zlist" data-alarm-zones="list">${i.map(u=>this.renderZone(e,u,!0))}</div>`:r`<div class="grid" data-alarm-zones="cards">${i.map(u=>this.renderZone(e,u,!1))}</div>`}</section>`)}</div>`:r`<sw-state-panel icon="filter" compact state="empty" heading="אין חיישנים שמתאימים לסינון" data-alarm-filter-empty actionLabel="הצג הכל" @action=${()=>this.filter="all"}></sw-state-panel>`:r`<sw-state-panel icon="sensor" compact state="empty" heading="אין חיישנים ללוח הזה" hint="החיישנים מגיעים מאותה מערכת אזעקה. מנהל המערכת יכול לשייך חיישנים ידנית בהגדרות ‹ אבטחה ‹ ניהול אזעקה."></sw-state-panel>`}`}renderZone(e,a,s=!1){const n=L(a),o=a.kind==="motion"?"activity":a.kind==="fault"?"warning":a.kind==="opening"?"door":"sensor",t=a.bypass,i=!!t&&t.available&&(a.bypassed?e.can.restore:e.can.bypass),u=t?r`<div class="bypass"><button type="button" class="tgl" role="switch" aria-checked=${a.bypassed?"true":"false"} aria-label=${`עקיפת ${a.name}`} data-bypass=${a.entity_id}
            ?disabled=${!i||this.busy} title=${i?"":"אין הרשאה או שהמתג אינו זמין"}
            @click=${()=>this.start({kind:"bypass",action:a.bypassed?"bypass_off":"bypass_on",panel:e,zone:a,prompt:e.code.bypass,needsConfirm:!0})}></button>עקיפה</div>`:r`<span></span>`;return s?r`<article class="zrow" data-tone=${n.tone} data-zone=${a.entity_id}>
        <span class="zicon" aria-hidden="true"><sw-icon name=${o} size=${15}></sw-icon></span>
        <div class="zname" title=${a.name}>${a.zone_number!==null?r`<span class="hint">${a.zone_number} · </span>`:l}${a.name}</div>
        <span class="zstate" data-zone-state>${n.label}</span>
        ${u}
        <div class="zsub">
          ${a.last_changed?r`<span>${g(a.last_changed)}</span>`:l}
          ${a.tamper?r`<span class="flag">חבלה</span>`:l}
          ${a.battery_low?r`<span class="flag">סוללה חלשה</span>`:a.battery_level!==null?r`<span>סוללה ${a.battery_level}%</span>`:l}
          ${a.alarmed?r`<span class="flag">גרם לאזעקה</span>`:l}
          ${a.shared?r`<span title="החיישן משותף לכל המחיצות של המערכת">משותף</span>`:l}
        </div>
      </article>`:r`<article class="zone" data-tone=${n.tone} data-zone=${a.entity_id}>
      <span class="zicon" aria-hidden="true"><sw-icon name=${o} size=${18}></sw-icon></span>
      <div class="zname" title=${a.name}>${a.zone_number!==null?r`<span class="hint">${a.zone_number} · </span>`:l}${a.name}</div>
      ${u}
      <div class="zsub">
        <span class="zstate" data-zone-state>${n.label}</span>
        ${a.last_changed?r`<span>${g(a.last_changed)}</span>`:l}
        ${a.tamper?r`<span class="flag">חבלה</span>`:l}
        ${a.battery_low?r`<span class="flag">סוללה חלשה</span>`:a.battery_level!==null?r`<span>סוללה ${a.battery_level}%</span>`:l}
        ${a.alarmed?r`<span class="flag">גרם לאזעקה</span>`:l}
        ${a.shared?r`<span title="החיישן משותף לכל המחיצות של המערכת">משותף</span>`:l}
      </div>
    </article>`}renderKeypad(){const e=this.pending;if(!e)return l;const a=e.kind==="panel"?f[e.action]:e.action==="bypass_on"?`עקיפת ${e.zone.name}`:`החזרת ${e.zone.name} להגנה`,s=e.prompt==="none"?`${a}?`:a,n=e.prompt==="pin"?"הקלידו את הקוד האישי שלכם":e.prompt==="panel"?"הקלידו את קוד לוח האזעקה":e.kind==="bypass"&&e.action==="bypass_on"?"החיישן לא יתריע עד שיוחזר להגנה.":e.action==="disarm"?`${e.panel.name} תנוטרל.`:"",o=e.prompt==="pin"||e.prompt==="panel";return r`<sw-dialog open heading=${s} subheading=${n} data-alarm-dialog @close=${()=>this.closeDialog()}>
      ${o?r`<form class="keypad" data-keypad autocomplete="off" @submit=${t=>{t.preventDefault(),this.submitCode()}}>
            <input data-code type="password" inputmode="numeric" autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="false" name="sw-alarm-code-nofill" aria-label="קוד"
              maxlength="32" .value=${this.code} @input=${t=>{this.code=t.target.value,this.codeError=""}} />
            <div class="keys">${["1","2","3","4","5","6","7","8","9","clear","0","back"].map(t=>r`<button type="button" data-key=${t} aria-label=${t==="back"?"מחיקה":t==="clear"?"ניקוי":t} @click=${()=>this.key(t)}>${t==="back"?"⌫":t==="clear"?"C":t}</button>`)}</div>
            ${this.codeError?r`<div class="err" role="alert" data-code-error><sw-icon name="warning" size=${14}></sw-icon>${this.codeError}</div>`:l}
          </form>`:this.codeError?r`<div class="err" role="alert"><sw-icon name="warning" size=${14}></sw-icon>${this.codeError}</div>`:l}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.closeDialog()}>ביטול</sw-button>
      <sw-button slot="footer" variant=${e.action==="disarm"||e.action==="bypass_on"?"danger":"primary"} data-alarm-confirm ?disabled=${this.busy} @click=${()=>this.submitCode()}>${e.kind==="panel"?f[e.action]:e.action==="bypass_on"?"עקוף":"החזר להגנה"}</sw-button>
    </sw-dialog>`}renderPin(){if(!this.pinOpen)return l;const e=this.data?.me.pin_set,a=s=>n=>this.pinForm={...this.pinForm,[s]:n.target.value};return r`<sw-dialog open heading="הקוד האישי שלי" subheading="קוד של 4–8 ספרות להפעלה ולנטרול מהאפליקציה. זה אינו קוד הלוח." data-alarm-pin-dialog
      @close=${()=>{this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""}}}>
      <form class="pinform" autocomplete="off" @submit=${s=>{s.preventDefault(),this.savePin()}}>
        ${e?r`<label class="hint">הקוד הנוכחי<input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="8" data-pin-current .value=${this.pinForm.current} @input=${a("current")} /></label>`:r`<label class="hint">קוד הלוח (להגדרת הקוד האישי הראשון)<input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="32" data-pin-panel .value=${this.pinForm.panel} @input=${a("panel")} /></label>`}
        <label class="hint">קוד חדש<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" data-pin-new .value=${this.pinForm.next} @input=${a("next")} /></label>
        <label class="hint">שוב, לאימות<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" data-pin-again .value=${this.pinForm.again} @input=${a("again")} /></label>
        ${this.pinError?r`<div class="err" role="alert">${this.pinError}</div>`:l}
      </form>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""}}}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-pin-save ?disabled=${this.busy} @click=${()=>void this.savePin()}>שמירה</sw-button>
    </sw-dialog>`}};d.styles=[V`
    :host {
      display: block;
      --al-ok: var(--sw-success);
      --al-open: var(--sw-warning);
      --al-fault: var(--sw-danger);
      --al-bypass: var(--sw-purple);
      --al-motion: var(--sw-accent);
      --al-armed: var(--sw-accent);
    }
    /* ---- the panel switcher (two or more partitions) ---- */
    .switcher {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .switcher button {
      font: inherit;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      border-radius: var(--sw-r-pill);
      padding: 6px 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: var(--sw-ctl-h-lg);
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    .switcher button:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .switcher button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-offline);
      flex: none;
    }
    .dot.disarmed {
      background: var(--al-ok);
    }
    .dot.armed {
      background: var(--al-armed);
    }
    .dot.partial {
      background: var(--al-bypass);
    }
    .dot.pending {
      background: var(--al-open);
    }
    .dot.triggered {
      background: var(--al-fault);
    }
    /* ---- the state card: one tone (bar, shield ring, a faint wash) says what is armed; the label is the biggest text on the screen ---- */
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px 20px;
      align-items: center;
      padding: 22px 24px;
      border-radius: var(--sw-r-lg);
      /* R5-SECURITY: the hero step - the tone is a field (12%), not a wash (4%); its edge and its shadow carry the same tone */
      background: var(--sw-glass-sheen), color-mix(in srgb, var(--tone, var(--sw-offline)) 12%, var(--sw-surface));
      -webkit-backdrop-filter: var(--sw-glass-blur);
      backdrop-filter: var(--sw-glass-blur);
      border: 1px solid color-mix(in srgb, var(--tone, var(--sw-offline)) 38%, var(--sw-border));
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      position: relative;
      overflow: hidden;
      transition: background var(--sw-t-state) var(--sw-ease), box-shadow var(--sw-t-state) var(--sw-ease);
    }
    .hero::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: 6px;
      background: var(--tone, var(--sw-offline));
      transition: background var(--sw-t-state) var(--sw-ease);
    }
    .hero[data-tone='disarmed'] {
      --tone: var(--al-ok);
    }
    .hero[data-tone='armed'] {
      --tone: var(--al-armed);
    }
    .hero[data-tone='partial'] {
      --tone: var(--al-bypass);
    }
    .hero[data-tone='pending'] {
      --tone: var(--al-open);
    }
    .hero[data-tone='triggered'] {
      --tone: var(--al-fault);
      background: color-mix(in srgb, var(--al-fault) 16%, var(--sw-surface));
      border-color: color-mix(in srgb, var(--al-fault) 60%, var(--sw-border));
    }
    .hero[data-tone='offline'] {
      --tone: var(--sw-offline);
    }
    /* R5-SECURITY (animation-performance): the triggered pulse is a ring on the shield, on transform + opacity (composited), not a
       box-shadow of the whole card (paint every frame) */
    .hero[data-tone='triggered'] .shield::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      border: 2px solid var(--al-fault);
      animation: pulse 1.4s var(--sw-ease) infinite;
      pointer-events: none;
    }
    @keyframes pulse {
      from {
        transform: scale(1);
        opacity: 0.9;
      }
      to {
        transform: scale(1.45);
        opacity: 0;
      }
    }
    /* the arrival of a new state: the shield and the label settle in (once, never looping) */
    @keyframes state-in {
      from {
        opacity: 0.4;
        transform: translateY(4px) scale(0.96);
      }
    }
    .hero.changed .shield,
    .hero.changed .state-label {
      animation: state-in var(--sw-t-med) var(--sw-ease) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .hero[data-tone='triggered'] .shield::after,
      .hero.changed .shield,
      .hero.changed .state-label {
        animation: none;
      }
    }
    .state-row {
      display: flex;
      align-items: center;
      gap: 14px;
      min-inline-size: 0;
    }
    .shield {
      inline-size: 68px;
      block-size: 68px;
      border-radius: var(--sw-r-lg);
      display: grid;
      place-items: center;
      position: relative;
      background: color-mix(in srgb, var(--tone, var(--sw-offline)) 18%, var(--sw-surface));
      color: var(--tone, var(--sw-offline));
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px color-mix(in srgb, var(--tone, var(--sw-offline)) 40%, transparent);
      flex: none;
      transition: background var(--sw-t-state) var(--sw-ease), color var(--sw-t-state) var(--sw-ease);
    }
    .hero[data-tone='triggered'] .shield {
      background: var(--al-fault);
      color: var(--sw-text-inverse);
    }
    .state-label {
      /* R5-SECURITY: the display word of the screen - 34/800, tracking -0.03em (impeccable craft-floor: obvious scale steps) */
      font-size: clamp(26px, 5.5vw, 34px);
      font-weight: 800;
      color: var(--sw-heading, var(--sw-text));
      line-height: 1.1;
      letter-spacing: -0.03em;
    }
    .meta {
      font-weight: var(--sw-fw-medium);
    }
    .hero[data-tone='triggered'] .state-label {
      color: var(--sw-danger-text);
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      margin-block-start: 4px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .actions sw-button {
      min-inline-size: 110px;
    }
    .ready {
      grid-column: 1 / -1;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .ready.no {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .ready sw-icon {
      flex: none;
      margin-block-start: 1px;
    }
    .ready ul {
      margin: 4px 0 0;
      padding-inline-start: 18px;
    }
    .sent {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .sent::before {
      content: '';
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-stale);
      flex: none;
    }
    .sent[data-alarm-sent='confirmed']::before {
      background: var(--sw-success);
    }
    .sent[data-alarm-sent='failed']::before,
    .sent[data-alarm-sent='denied']::before,
    .sent[data-alarm-sent='unknown']::before {
      background: var(--sw-danger);
    }
    /* ---- the zones: filter chips, a card / list switch, the count ---- */
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .toolbar .end {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    /* R5-SECURITY: the filter chips are raised keys (a tone step + shadow 1), not outlined pills; they sink on pointer-down */
    .chips button {
      font: inherit;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      border: 1px solid transparent;
      background: var(--sw-surface);
      border-radius: var(--sw-r-pill);
      padding: 4px 14px;
      cursor: pointer;
      color: var(--sw-text);
      min-block-size: 36px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .chips button:hover {
        background: var(--sw-surface-2);
        box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      }
    }
    .chips button:active,
    .vt button:active {
      transform: scale(var(--sw-press-scale));
    }
    .chips button[aria-pressed='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-bold);
    }
    .chips button[aria-pressed='true'] .n {
      background: rgba(255, 255, 255, 0.22);
      color: inherit;
    }
    .chips button .n {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-bold);
      min-inline-size: 20px;
      block-size: 20px;
      padding-inline: 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      display: inline-grid;
      place-items: center;
      font-variant-numeric: tabular-nums;
    }
    .chips button[data-filter='open'] .n:not(:empty) {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chips button[data-filter='faults'] .n:not(:empty) {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .chips button[data-filter='bypassed'] .n:not(:empty) {
      background: color-mix(in srgb, var(--al-bypass) 14%, var(--sw-surface));
      color: var(--al-bypass);
    }
    .vt {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .vt button {
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      inline-size: 32px;
      block-size: 30px;
      border-radius: var(--sw-r-xs);
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .vt button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .counts {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    /* R5-SECURITY: the area is a heading (16/800 in the heading ink), its count a filled pill */
    h3 {
      margin: 8px 0 8px;
      font-size: var(--sw-fs-xl);
      color: var(--sw-heading, var(--sw-text));
      font-weight: 800;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h3 .n {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-bold);
      min-inline-size: 20px;
      block-size: 20px;
      padding-inline: 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      display: inline-grid;
      place-items: center;
      font-variant-numeric: tabular-nums;
    }
    /* the areas pack side by side on a wide screen (an area with one sensor no longer owns a whole row); each keeps its own cards grid */
    .areas {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
      gap: 4px 16px;
      align-items: start;
    }
    .areas.list {
      grid-template-columns: minmax(0, 1fr);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 10px;
    }
    /* a zone card: icon, name, state; the tone shows as the icon square, the state word and a faint wash - never a colour alone */
    .zone {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 4px 10px;
      align-items: center;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-glass-sheen), var(--sw-surface);
      -webkit-backdrop-filter: var(--sw-glass-blur);
      backdrop-filter: var(--sw-glass-blur);
      border: 1px solid transparent;
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      position: relative;
      transition: background var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-state) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    /* R5-SECURITY: a sensor that needs a look is a FILLED field (the whole card in the tone's soft colour), not a 6% wash + a 1px edge */
    .zone[data-tone='open'] {
      border-color: color-mix(in srgb, var(--al-open) 45%, transparent);
      background: var(--sw-glass-sheen), var(--sw-warning-soft);
    }
    .zone[data-tone='fault'] {
      border-color: color-mix(in srgb, var(--al-fault) 45%, transparent);
      background: var(--sw-glass-sheen), var(--sw-danger-soft);
    }
    .zone[data-tone='bypassed'] {
      background: var(--sw-glass-sheen), color-mix(in srgb, var(--al-bypass) 14%, var(--sw-surface));
    }
    .zone[data-tone='motion'] {
      background: var(--sw-glass-sheen), var(--sw-accent-soft);
    }
    .zicon {
      inline-size: 40px;
      block-size: 40px;
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      transition: background var(--sw-t-state) var(--sw-ease), color var(--sw-t-state) var(--sw-ease);
    }
    .zone[data-tone='ok'] .zicon {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .zone[data-tone='open'] .zicon {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .zone[data-tone='fault'] .zicon {
      background: var(--sw-danger-soft);
      color: var(--al-fault);
    }
    .zone[data-tone='bypassed'] .zicon {
      background: color-mix(in srgb, var(--al-bypass) 14%, var(--sw-surface));
      color: var(--al-bypass);
    }
    .zone[data-tone='motion'] .zicon {
      background: var(--sw-accent-soft);
      color: var(--al-motion);
    }
    .zname {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--sw-heading, var(--sw-text));
    }
    .zsub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      grid-column: 2 / 3;
      align-items: center;
    }
    .zstate {
      /* R5-SECURITY: the state word reads first - 15/800 */
      font-size: var(--sw-fs-lg);
      font-weight: 800;
      transition: color var(--sw-t-state) var(--sw-ease);
    }
    .zone[data-tone='open'] .zstate,
    .zrow[data-tone='open'] .zstate {
      color: var(--sw-warning-text);
    }
    .zone[data-tone='fault'] .zstate,
    .zrow[data-tone='fault'] .zstate {
      color: var(--sw-danger-text);
    }
    .zone[data-tone='bypassed'] .zstate,
    .zrow[data-tone='bypassed'] .zstate {
      color: var(--al-bypass);
    }
    .zone[data-tone='ok'] .zstate,
    .zrow[data-tone='ok'] .zstate {
      color: var(--sw-success-text);
    }
    .zone[data-tone='motion'] .zstate,
    .zrow[data-tone='motion'] .zstate {
      color: var(--sw-accent-text);
    }
    .flag {
      color: var(--sw-danger-text);
      font-weight: var(--sw-fw-medium);
    }
    .bypass {
      grid-row: 1 / span 2;
      grid-column: 3;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-3);
    }
    /* the list view: one dense row per zone, the same icon / name / state / bypass switch, hairlines between the rows */
    .zlist {
      display: flex;
      flex-direction: column;
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-glass-sheen), var(--sw-surface);
      -webkit-backdrop-filter: var(--sw-glass-blur);
      backdrop-filter: var(--sw-glass-blur);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      overflow: hidden;
    }
    .zrow {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      gap: 0 10px;
      align-items: center;
      padding: 7px 12px;
      min-block-size: 46px;
      border-block-end: 1px solid var(--sw-border);
      position: relative;
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    .zrow:last-child {
      border-block-end: 0;
    }
    @media (hover: hover) and (pointer: fine) {
      .zrow:hover {
        background: var(--sw-hover-wash);
      }
    }
    /* R5-SECURITY: the list row carries the same filled field as the card */
    .zrow[data-tone='open'] {
      background: var(--sw-warning-soft);
    }
    .zrow[data-tone='fault'] {
      background: var(--sw-danger-soft);
    }
    .zrow[data-tone='bypassed'] {
      background: color-mix(in srgb, var(--al-bypass) 14%, var(--sw-surface));
    }
    .zrow .zicon {
      inline-size: 32px;
      block-size: 32px;
      border-radius: var(--sw-r-sm);
    }
    .zrow .zname {
      font-size: var(--sw-fs-md);
    }
    .zrow .zsub {
      grid-column: 2;
    }
    .zrow .zstate {
      font-size: var(--sw-fs-sm);
      min-inline-size: 48px;
      text-align: end;
    }
    .zrow .bypass {
      grid-row: auto;
      grid-column: 4;
      flex-direction: row;
      gap: 6px;
    }
    .zrow::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: 3px;
      background: transparent;
    }
    .zrow[data-tone='open']::before {
      background: var(--al-open);
    }
    .zrow[data-tone='fault']::before {
      background: var(--al-fault);
    }
    .zrow[data-tone='bypassed']::before {
      background: var(--al-bypass);
    }
    button.tgl {
      inline-size: 46px;
      block-size: 28px;
      border-radius: var(--sw-r-pill);
      border: 0;
      background: var(--sw-border-strong);
      position: relative;
      cursor: pointer;
      padding: 0;
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    button.tgl::after {
      content: '';
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
      background: var(--sw-toggle-thumb);
      box-shadow: var(--sw-shadow-thumb);
      transition: transform var(--sw-t-fast) var(--sw-ease-thumb);
    }
    button.tgl[aria-checked='true'] {
      background: var(--al-bypass);
    }
    button.tgl[aria-checked='true']::after {
      transform: translateX(-18px);
    }
    button.tgl:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: not-allowed;
    }
    button.tgl:focus-visible,
    .keys button:focus-visible,
    .switcher button:focus-visible,
    .chips button:focus-visible,
    .vt button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    /* VISDIFF-246: the filter chips and the cards / list switch are 44 px touch targets on a phone and a tablet (the chips were
       32 px and the switch 30 x 28 px in every layout) */
    @media (max-width: 1100px) {
      .chips button {
        min-block-size: 44px;
      }
      .vt button {
        inline-size: 44px;
        block-size: 44px;
      }
    }
    details.unpaired {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      border: 1px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 8px 12px;
    }
    details.unpaired summary {
      cursor: pointer;
      min-block-size: 28px;
      display: flex;
      align-items: center;
    }
    details.unpaired li {
      margin-block: 2px;
    }
    /* ---- the keypad: its own material (big digits, a masked field, large keys), both schemes ---- */
    .keypad {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }
    .keypad input {
      font: inherit;
      font-size: var(--sw-fs-3xl);
      letter-spacing: 0.4em;
      text-align: center;
      padding: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      direction: ltr;
      background: var(--sw-surface-2);
      color: var(--sw-text);
      min-block-size: 52px;
    }
    .keypad input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .keys {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      direction: ltr;
    }
    .keys button {
      font: inherit;
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-semibold);
      min-block-size: 56px;
      border-radius: var(--sw-r-lg);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .keys button:hover {
      background: var(--sw-surface-2);
    }
    .keys button:active {
      background: var(--sw-accent-soft);
      transform: scale(0.97);
    }
    .keys button[data-key='clear'],
    .keys button[data-key='back'] {
      font-size: var(--sw-fs-xl);
      color: var(--sw-text-2);
      background: var(--sw-surface-2);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .pinform {
      display: grid;
      gap: 8px;
    }
    .pinform label {
      display: grid;
      gap: 4px;
    }
    .pinform input {
      font: inherit;
      padding: 8px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      direction: ltr;
      text-align: center;
      letter-spacing: 0.3em;
      background: var(--sw-surface-2);
      color: var(--sw-text);
      min-block-size: var(--sw-ctl-h-lg);
    }
    .pinform input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .toast {
      position: fixed;
      inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom, 0px));
      inset-inline-start: 50%;
      transform: translateX(50%);
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      padding: 10px 16px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      z-index: var(--sw-z-toast);
      max-inline-size: calc(100vw - 32px);
      box-shadow: var(--sw-shadow-3);
    }
    @media (max-width: 767px) {
      .hero {
        grid-template-columns: minmax(0, 1fr);
        padding: 16px;
      }
      .actions {
        justify-content: stretch;
      }
      .actions sw-button {
        flex: 1 1 40%;
        min-inline-size: 0;
      }
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .toolbar .end {
        inline-size: 100%;
        justify-content: space-between;
      }
      .zrow .zstate {
        min-inline-size: 0;
      }
    }
    /* the bubble skin: the list and its rows are flat layers, the view switch a pill track */
    :host([data-skin='bubble']) .zlist {
      border-color: transparent;
      background: var(--sw-surface);
      box-shadow: none;
    }
    :host([data-skin='bubble']) .vt {
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
    }
    :host([data-skin='bubble']) .vt button {
      border-radius: var(--sw-r-pill);
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
    }
  `,U];c([Y()],d.prototype,"panelId",2);c([p()],d.prototype,"data",2);c([p()],d.prototype,"error",2);c([p()],d.prototype,"loading",2);c([p()],d.prototype,"filter",2);c([p()],d.prototype,"zoneView",2);c([p()],d.prototype,"stateFlash",2);c([p()],d.prototype,"pending",2);c([p()],d.prototype,"code",2);c([p()],d.prototype,"codeError",2);c([p()],d.prototype,"busy",2);c([p()],d.prototype,"sent",2);c([p()],d.prototype,"toast",2);c([p()],d.prototype,"pinOpen",2);c([p()],d.prototype,"pinForm",2);c([p()],d.prototype,"pinError",2);d=c([j("security-alarm")],d);export{d as SecurityAlarm};
//# sourceMappingURL=security-alarm-CsdAvoPh.js.map
