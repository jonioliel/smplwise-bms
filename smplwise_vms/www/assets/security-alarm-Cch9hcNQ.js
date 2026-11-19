import{i as _,aL as E,eD as S,eR as C,cy as R,aN as T,aa as I,a2 as g,jm as O,fH as F,n as w,Y as x,e_ as D,U as t,jn as f,jo as P,jp as L,jq as m,jr as j,a as v,js as M,b as r,A as d,jt as U,f4 as A,ju as $,e2 as H,jv as V,dI as Z,fo as Y,aI as N,f3 as q,bh as B,aU as K,g as W,ax as X,j as h,k as G}from"./index-rXjlW4bK.js";import{L as J}from"./latest-DjG5XH9h.js";import"./sw-logo-art-PLtEZJxU.js";const k=new Date(Date.now()-12*6e4).toISOString();function b(e,a,n,i,o={}){return{entity_id:`binary_sensor.demo_zone_${e}`,name:a,platform:"demo",device_class:i==="motion"?"motion":"door",kind:i,state:o.open?"on":"off",available:!0,open:!1,fault:!1,tamper:!1,battery_low:!1,battery_level:null,alarmed:!1,bypassed:!1,last_changed:k,area_id:n,area_name:n,ha_floor_name:null,zone_number:e,aux:[],shared:!1,bypass:{entity_id:`switch.demo_zone_${e}_bypassed`,domain:"switch",name:`${a} עקיפה`,state:o.bypassed?"on":"off",available:!0,bypassed:!!o.bypassed,strategy:"device",on_option:null,off_option:null},...o}}const Q={panels:[{entity_id:"alarm_control_panel.demo_house",name:"בית",platform:"demo",integration:"הדגמה",integration_note:"",config_entry_id:null,state:"disarmed",available:!0,fresh:!0,last_changed:k,changed_by:"דייר 1",arm_modes:["arm_home","arm_away","arm_night"],features_reported:!0,code_format:"number",code_arm_required:!1,needs_code_arm:!1,needs_code_disarm:!0,area_name:null,open_sensors:[],bypassed_sensors:[],zones:[b(1,"דלת כניסה","כניסה","opening"),b(2,"דלת אחורית","מטבח","opening",{open:!0,state:"on"}),b(3,"גלאי סלון","סלון","motion"),b(4,"חלון מטבח","מטבח","opening",{bypassed:!0}),b(5,"חלון חדר שינה","חדר שינה","opening",{battery_low:!0}),b(6,"גלאי עשן","מטבח","fault")],unpaired_controls:[],ready:{ready:!1,open:["binary_sensor.demo_zone_2"],faults:[]},can:{arm:!0,disarm:!0,bypass:!0,restore:!0},panel_code_set:!0,code:{arm:"none",disarm:"pin",bypass:"pin"}}],counts:{panels:1,zones:6,open:1,bypassed:1,faults:0},channel:"local",remote:{control:!0,disarm:!0,codeless:!0},code_mode:"personal_pin",me:{arm_policy:"no_code",disarm_policy:"code_required",pin_set:!0},can_configure:!0};var ee=Object.defineProperty,ae=Object.getOwnPropertyDescriptor,p=(e,a,n,i)=>{for(var o=i>1?void 0:i?ae(a,n):a,s=e.length-1,l;s>=0;s--)(l=e[s])&&(o=(i?l(a,n,o):l(o))||o);return i&&o&&ee(a,n,o),o};const z="sw.alarm.zones.view";function te(){try{return localStorage.getItem(z)==="list"?"list":"cards"}catch{return"cards"}}const se=[{id:"all",label:t("הכל")},{id:"open",label:t("פתוחים בלבד")},{id:"bypassed",label:t("עקופים")},{id:"faults",label:t("תקלות")}];function y(e){if(!e)return"";const a=new Date(e);if(Number.isNaN(a.getTime()))return"";const n=Math.round((Date.now()-a.getTime())/1e3);return n<60?t("עכשיו"):n<3600?t("לפני {n} דק׳",{n:Math.round(n/60)}):n<86400?t("לפני {n} שע׳",{n:Math.round(n/3600)}):N(a)}let c=class extends _{constructor(){super(...arguments),this.bubbleSkin=new E(this),this.panelId="",this.data=null,this.error="",this.loading=!0,this.filter="all",this.zoneView=te(),this.stateFlash=!1,this.flashTimer=0,this.pending=null,this.code="",this.codeError="",this.busy=!1,this.sent=null,this.toaster=new S(this,{ms:4e3}),this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""},this.pinError="",this.refetchTimer=0,this.poller=new C(this),this.reads=new J,this.actionSignal=null,this.watched=new Set}get toast(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.stopSession=R(e=>{e.mode!=="loading"&&(this.load(),e.mode==="api"&&!this.stopHa&&(this.stopHa=T(a=>{a.type==="entity_state_changed"&&this.watched.has(a.entity.entity_id)&&this.scheduleRefetch(),a.type==="structure_changed"&&this.scheduleRefetch()}),this.poller.every("panels",15e3,()=>this.load(!0))))})}disconnectedCallback(){super.disconnectedCallback(),this.stopHa?.(),this.stopHa=void 0,this.stopSession?.(),this.poller.cancel("panels"),this.reads.cancel(),this.actionSignal&&(this.actionSignal.stopped=!0),this.actionSignal=null,window.clearTimeout(this.refetchTimer),window.clearTimeout(this.flashTimer),this.clearCode()}willUpdate(e){if(e.has("panelId")&&!this.panelId){const n=I().params.get("panel");n&&(this.panelId=n)}const a=this.panel?`${this.panel.entity_id}:${this.panel.state??""}:${this.panel.available}`:void 0;if(a!==this.lastHeroState){const n=this.lastHeroState===void 0;this.lastHeroState=a,!n&&a!==void 0&&(this.stateFlash=!0,window.clearTimeout(this.flashTimer),this.flashTimer=window.setTimeout(()=>this.stateFlash=!1,700))}}setZoneView(e){this.zoneView=e;try{localStorage.setItem(z,e)}catch{}}scheduleRefetch(){window.clearTimeout(this.refetchTimer),this.refetchTimer=window.setTimeout(()=>void this.load(!0),250)}async load(e=!1){const a=this.reads.begin();e||(this.loading=!this.data);try{const n=g()?await O():Q;if(!a())return;this.data=n,g()&&F(this.data.panels.length),this.error="",this.watched=new Set(this.data.panels.flatMap(i=>[i.entity_id,...i.zones.flatMap(o=>[o.entity_id,...o.aux,...o.bypass?[o.bypass.entity_id]:[]]),...i.unpaired_controls.map(o=>o.entity_id)]))}catch(n){if(!a())return;(!e||!this.data)&&(this.error=w(n))}finally{a()&&(this.loading=!1)}}get panel(){const e=this.data?.panels??[];return e.find(a=>a.entity_id===this.panelId)??e[0]??null}choosePanel(e){this.panelId=e,x("/system/security/alarm",{panel:e})}async openLiveIncident(e){this.busy=!0;try{const a=await D({alarm_panel:e});x(`/investigate/incidents/${encodeURIComponent(a.incident.id)}`)}catch(a){this.flash(w(a))}finally{this.busy=!1}}flash(e){this.toaster.show(e)}start(e){if(e.prompt==="pin_missing"){this.data?.panels.some(a=>a.panel_code_set)?(this.pinOpen=!0,this.pinError=t("נדרש קוד אישי. הקלידו את קוד הלוח כדי להגדיר אותו, או פנו למנהל המערכת לקבלת קוד אישי.")):this.flash(t("פנה למנהל המערכת לקבלת קוד אישי."));return}if(e.prompt==="unverifiable"){this.flash(f.code_unverifiable+t(" - פנו למנהל המערכת."));return}if(e.prompt==="none"&&!e.needsConfirm){this.send(e,"");return}this.clearCode(),this.pending=e}clearCode(){this.code="",this.codeError="";const e=this.renderRoot?.querySelector("input[data-code]");e&&(e.value="")}closeDialog(){this.pending=null,this.clearCode()}async send(e,a){if(!g()){this.closeDialog(),this.flash(t("נתוני הדגמה: לא נשלחה פקודה."));return}this.busy=!0,this.codeError="";try{const n=e.kind==="panel"?await P(e.panel.entity_id,e.action,{confirmed:e.action==="disarm",code:a||void 0}):await L(e.zone.entity_id,e.action==="bypass_on",{confirmed:!0,code:a||void 0});this.closeDialog();const i=e.kind==="panel"?m[e.action]:e.action==="bypass_on"?t("עקיפת {name}",{name:e.zone.name}):t("החזרת {name} להגנה",{name:e.zone.name});this.sent={label:i,record:n,entity:n.entity_id},this.actionSignal&&(this.actionSignal.stopped=!0);const o={stopped:!1};this.actionSignal=o,j(n.id,s=>{this.sent&&this.sent.record&&this.sent.record.id===s.id&&(this.sent={...this.sent,record:s})},o).then(()=>o.stopped?void 0:this.load(!0)).catch(()=>{}),this.load(!0)}catch(n){const i=n instanceof v?n.body.code:"";n instanceof v&&i==="code_required"?(this.pending={...e,prompt:n.body.details?.prompt??"panel"},this.codeError=""):n instanceof v&&this.pending&&["wrong_code","code_locked","rate_limited","code_rejected"].includes(i)?(this.clearCode(),this.codeError=f[i]??w(n)):(this.closeDialog(),this.flash(f[i]??w(n)))}finally{this.busy=!1}}submitCode(){const e=this.pending;if(!e)return;if(e.prompt!=="none"&&!this.code){this.codeError=t("הקלידו קוד");return}const a=this.code;this.code="",this.send(e,e.prompt==="none"?"":a)}key(e){e==="back"?this.code=this.code.slice(0,-1):e==="clear"?this.code="":this.code.length<32&&(this.code+=e),this.codeError=""}async savePin(){const e=this.pinForm;if(!/^\d{4,8}$/.test(e.next)){this.pinError=t("קוד אישי: 4–8 ספרות.");return}if(e.next!==e.again){this.pinError=t("הקודים אינם זהים.");return}if(!g()){this.pinOpen=!1,this.flash(t("נתוני הדגמה: הקוד לא נשמר."));return}this.busy=!0;try{await M(e.next,e.current||void 0,e.panel||void 0),this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""},this.pinError="",this.flash(t("הקוד האישי נשמר")),await this.load(!0)}catch(a){this.pinError=a instanceof v&&a.body.code==="wrong_code"?this.data?.me.pin_set?t("הקוד הנוכחי שגוי."):t("קוד הלוח שגוי."):a instanceof v?f[a.body.code]??w(a):w(a)}finally{this.busy=!1}}render(){if(this.loading&&!this.data)return r`<sw-page heading=${t("אזעקה")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.error&&!this.data)return r`<sw-page heading=${t("אזעקה")}><sw-state-panel state="error" heading=${t("לא ניתן לטעון את האזעקה")} hint=${this.error} actionLabel=${t("נסו שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const e=this.data,a=this.panel;if(!a)return r`<sw-page heading=${t("אזעקה")}><sw-state-panel icon="shield" data-alarm-empty state="empty" heading=${t("לא נמצא לוח אזעקה")}
        hint=${t("המערכת לא מצאה לוח אזעקה מחובר. מתקין או מנהל המערכת יכול לבדוק בהגדרות ‹ אבטחה ‹ ניהול אזעקה שמערכת האזעקה מחוברת לתשתית המערכת ושההרשאות מאפשרות לראות אותה.")}></sw-state-panel></sw-page>`;const n=`${t("{zones} חיישנים · {open} פתוחים · {bypassed} עקופים",{zones:e.counts.zones,open:e.counts.open,bypassed:e.counts.bypassed})}${e.counts.faults?t(" · {n} תקלות",{n:e.counts.faults}):""}${e.channel==="remote"?t(" · מחוץ לרשת המקומית"):""}`;return r`<sw-page heading=${t("אזעקה")} subheading=${n}>
      <sw-button slot="actions" size="sm" variant="ghost" icon="lock" data-alarm-pin @click=${()=>{this.pinOpen=!0,this.pinError=""}}>${t("הקוד האישי שלי")}</sw-button>
      ${U(q())?r`<sw-button slot="actions" size="sm" icon="warning" data-alarm-incident ?disabled=${this.busy} @click=${()=>void this.openLiveIncident(a.entity_id)}>${A("alarmOpen")}</sw-button>`:d}
      ${e.panels.length>1?r`<div class="switcher" role="group" aria-label=${t("בחירת לוח")} data-alarm-switcher>${e.panels.map(i=>{const o=$(i.state,i.available);return r`<button type="button" aria-pressed=${i.entity_id===a.entity_id} data-panel=${i.entity_id} @click=${()=>this.choosePanel(i.entity_id)}><i class="dot ${o.tone}"></i>${i.name}<span class="hint">· ${o.label}</span></button>`})}</div>`:d}
      ${this.renderHero(a)}
      ${this.renderZones(a)}
      ${a.unpaired_controls.length?r`<details class="unpaired" data-alarm-unpaired><summary>${t("ללא שיוך · {length} מתגי עקיפה שלא שויכו לחיישן",{length:a.unpaired_controls.length})}</summary><ul>${a.unpaired_controls.map(i=>r`<li>${i.name}${i.bypassed?t(" · עוקף"):""}</li>`)}</ul><div class="hint">${t("שיוך ידני: הגדרות ‹ אבטחה ‹ ניהול אזעקה.")}</div></details>`:d}
    </sw-page>
    ${this.renderKeypad()} ${this.renderPin()} ${this.toast?r`<div class="toast" role="status" aria-live="polite" ${H()}>${this.toast}</div>`:d}`}renderHero(e){const a=$(e.state,e.available),n=e.state==="disarmed",i=new Map(e.zones.map(l=>[l.entity_id,l])),o=l=>i.get(l)?.name??l,s=this.sent&&this.sent.entity===e.entity_id?this.sent:null;return r`<section class="hero ${this.stateFlash?"changed":""}" data-tone=${a.tone} data-alarm-state=${e.state??"unknown"} data-alarm-panel=${e.entity_id}>
      <div class="state-row">
        <span class="shield" aria-hidden="true"><sw-icon name=${a.tone==="triggered"?"warning":n?"unlock":"shield"} size=${30}></sw-icon></span>
        <div>
          <div class="state-label" role="status" aria-live="polite">${a.label}</div>
          <div class="meta">${e.name}${e.changed_by?t(" · שונה על ידי {changed_by}",{changed_by:e.changed_by}):""}${e.last_changed?` · ${y(e.last_changed)}`:""}</div>
        </div>
      </div>
      <div class="actions">
        ${e.can.arm?e.arm_modes.filter(l=>l!=="arm_custom_bypass"||e.can.bypass).map(l=>r`<sw-button variant=${l==="arm_away"?"primary":"secondary"} icon="shield" data-arm=${l} ?disabled=${this.busy||!e.available||e.state===l.replace("arm_","armed_")}
              @click=${()=>this.start({kind:"panel",action:l,panel:e,prompt:e.code.arm,needsConfirm:!1})}>${m[l]}</sw-button>`):d}
        ${e.can.disarm?r`<sw-button variant="danger" icon="unlock" data-disarm ?disabled=${this.busy||!e.available||n}
              @click=${()=>this.start({kind:"panel",action:"disarm",panel:e,prompt:e.code.disarm,needsConfirm:!0})}>${m.disarm}</sw-button>`:d}
      </div>
      ${n?r`<div class="ready ${e.ready.ready?"":"no"}" data-alarm-ready=${e.ready.ready?"yes":"no"}>
            <sw-icon name=${e.ready.ready?"check":"warning"} size=${16}></sw-icon>
            <div>${e.ready.ready?t("מוכנה לדריכה: כל החיישנים סגורים."):r`<b>${t("לא מוכנה לדריכה")}</b>
                  <ul>${e.ready.open.map(l=>r`<li>${t("פתוח:")} ${o(l)}</li>`)}${e.ready.faults.map(l=>r`<li>${t("תקלה:")} ${o(l)}</li>`)}</ul>
                  <span class="hint">${t("אפשר לסגור, או לעקוף חיישן לפני הדריכה.")}</span>`}</div>
          </div>`:d}
      ${s?r`<div class="sent" data-alarm-sent=${s.record?.status??"pending"}>${s.label}: ${s.record?.status==="confirmed"?t("הלוח אישר."):s.record?.status==="unknown"?t("הלוח לא אישר את הפקודה בזמן (ייתכן שהקוד שגוי) - המצב המוצג הוא מה שהלוח מדווח."):s.record?.status==="failed"||s.record?.status==="denied"?t("הפקודה לא בוצעה{why}.",{why:s.record.error?` (${f[s.record.error]??s.record.error})`:""}):t("נשלח · ממתין לאישור הלוח…")}</div>`:d}
    </section>`}visibleZones(e){switch(this.filter){case"open":return e.zones.filter(a=>a.open&&!a.bypassed);case"bypassed":return e.zones.filter(a=>a.bypassed);case"faults":return e.zones.filter(a=>a.fault||a.tamper);default:return e.zones}}renderZones(e){const a=this.visibleZones(e),n=new Map;for(const s of a){const l=s.area_name??t("ללא אזור");n.has(l)||n.set(l,[]),n.get(l).push(s)}const i={all:e.zones.length,open:e.zones.filter(s=>s.open&&!s.bypassed).length,bypassed:e.zones.filter(s=>s.bypassed).length,faults:e.zones.filter(s=>s.fault||s.tamper).length},o=this.zoneView==="list";return r`<div class="toolbar">
        <div class="chips" role="group" aria-label=${t("סינון חיישנים")}>${se.map(s=>r`<button type="button" aria-pressed=${this.filter===s.id} data-filter=${s.id} @click=${()=>this.filter=s.id}>${s.label}${s.id!=="all"&&i[s.id]?r`<span class="n">${i[s.id]}</span>`:d}</button>`)}</div>
        <div class="end">
          <span class="counts">${t("{n} מתוך {total} חיישנים",{n:a.length,total:e.zones.length})}</span>
          <div class="vt" role="group" aria-label=${t("תצוגת חיישנים")} data-alarm-view>
            <button type="button" aria-pressed=${!o} aria-label=${t("כרטיסים")} title=${t("כרטיסים")} data-alarm-view-cards @click=${()=>this.setZoneView("cards")}><sw-icon name="grid" size=${15}></sw-icon></button>
            <button type="button" aria-pressed=${o} aria-label=${t("רשימה")} title=${t("רשימה")} data-alarm-view-list @click=${()=>this.setZoneView("list")}><sw-icon name="list" size=${15}></sw-icon></button>
          </div>
        </div>
      </div>
      ${e.zones.length?a.length?r`<div class="areas ${o?"list":""}">${[...n.entries()].map(([s,l])=>r`<section data-area=${s}><h3>${s}<span class="n">${l.length}</span></h3>${o?r`<div class="zlist" data-alarm-zones="list">${l.map(u=>this.renderZone(e,u,!0))}</div>`:r`<div class="grid" data-alarm-zones="cards">${l.map(u=>this.renderZone(e,u,!1))}</div>`}</section>`)}</div>`:r`<sw-state-panel icon="filter" compact state="empty" heading=${t("אין חיישנים שמתאימים לסינון")} data-alarm-filter-empty actionLabel=${t("הצג הכל")} @action=${()=>this.filter="all"}></sw-state-panel>`:r`<sw-state-panel icon="sensor" compact state="empty" heading=${t("אין חיישנים ללוח הזה")} hint=${t("החיישנים מגיעים מאותה מערכת אזעקה. מנהל המערכת יכול לשייך חיישנים ידנית בהגדרות ‹ אבטחה ‹ ניהול אזעקה.")}></sw-state-panel>`}`}renderZone(e,a,n=!1){const i=V(a),o=a.kind==="motion"?"activity":a.kind==="fault"?"warning":a.kind==="opening"?"door":"sensor",s=a.bypass,l=!!s&&s.available&&(a.bypassed?e.can.restore:e.can.bypass),u=s?r`<div class="bypass"><sw-toggle .checked=${Z(a.bypassed)} label=${t("עקיפת {name}",{name:a.name})} labelHidden data-bypass=${a.entity_id}
            ?disabled=${!l||this.busy} title=${l?"":t("אין הרשאה או שהמתג אינו זמין")}
            @change=${Y(a.bypassed,()=>this.start({kind:"bypass",action:a.bypassed?"bypass_off":"bypass_on",panel:e,zone:a,prompt:e.code.bypass,needsConfirm:!0}))}></sw-toggle>${t("עקיפה")}</div>`:r`<span></span>`;return n?r`<article class="zrow" data-tone=${i.tone} data-zone=${a.entity_id}>
        <span class="zicon" aria-hidden="true"><sw-icon name=${o} size=${15}></sw-icon></span>
        <div class="zname" title=${a.name}>${a.zone_number!==null?r`<span class="hint">${a.zone_number} · </span>`:d}${a.name}</div>
        <span class="zstate" data-zone-state>${i.label}</span>
        ${u}
        <div class="zsub">
          ${a.last_changed?r`<span>${y(a.last_changed)}</span>`:d}
          ${a.tamper?r`<span class="flag">${t("חבלה")}</span>`:d}
          ${a.battery_low?r`<span class="flag">${t("סוללה חלשה")}</span>`:a.battery_level!==null?r`<span>${t("סוללה {battery_level}%",{battery_level:a.battery_level})}</span>`:d}
          ${a.alarmed?r`<span class="flag">${t("גרם לאזעקה")}</span>`:d}
          ${a.shared?r`<span title=${t("החיישן משותף לכל המחיצות של המערכת")}>${t("משותף")}</span>`:d}
        </div>
      </article>`:r`<article class="zone" data-tone=${i.tone} data-zone=${a.entity_id}>
      <span class="zicon" aria-hidden="true"><sw-icon name=${o} size=${18}></sw-icon></span>
      <div class="zname" title=${a.name}>${a.zone_number!==null?r`<span class="hint">${a.zone_number} · </span>`:d}${a.name}</div>
      ${u}
      <div class="zsub">
        <span class="zstate" data-zone-state>${i.label}</span>
        ${a.last_changed?r`<span>${y(a.last_changed)}</span>`:d}
        ${a.tamper?r`<span class="flag">${t("חבלה")}</span>`:d}
        ${a.battery_low?r`<span class="flag">${t("סוללה חלשה")}</span>`:a.battery_level!==null?r`<span>${t("סוללה {battery_level}%",{battery_level:a.battery_level})}</span>`:d}
        ${a.alarmed?r`<span class="flag">${t("גרם לאזעקה")}</span>`:d}
        ${a.shared?r`<span title=${t("החיישן משותף לכל המחיצות של המערכת")}>${t("משותף")}</span>`:d}
      </div>
    </article>`}renderKeypad(){const e=this.pending;if(!e)return d;const a=e.kind==="panel"?m[e.action]:e.action==="bypass_on"?t("עקיפת {name}",{name:e.zone.name}):t("החזרת {name} להגנה",{name:e.zone.name}),n=e.prompt==="none"?`${a}?`:a,i=e.prompt==="pin"?t("הקלידו את הקוד האישי שלכם"):e.prompt==="panel"?t("הקלידו את קוד לוח האזעקה"):e.kind==="bypass"&&e.action==="bypass_on"?t("החיישן לא יתריע עד שיוחזר להגנה."):e.action==="disarm"?t("{name} תנוטרל.",{name:e.panel.name}):"",o=e.prompt==="pin"||e.prompt==="panel";return r`<sw-dialog open heading=${n} subheading=${i} data-alarm-dialog @close=${()=>this.closeDialog()}>
      ${o?r`<form class="keypad" data-keypad autocomplete="off" @submit=${s=>{s.preventDefault(),this.submitCode()}}>
            <input data-code type="password" inputmode="numeric" autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="false" name="sw-alarm-code-nofill" aria-label=${t("קוד")}
              maxlength="32" .value=${this.code} @input=${s=>{this.code=s.target.value,this.codeError=""}} />
            <div class="keys">${["1","2","3","4","5","6","7","8","9","clear","0","back"].map(s=>r`<button type="button" data-key=${s} aria-label=${s==="back"?t("מחיקה"):s==="clear"?t("ניקוי"):s} @click=${()=>this.key(s)}>${s==="back"?"⌫":s==="clear"?"C":s}</button>`)}</div>
            ${this.codeError?r`<div class="err" role="alert" data-code-error><sw-icon name="warning" size=${14}></sw-icon>${this.codeError}</div>`:d}
          </form>`:this.codeError?r`<div class="err" role="alert"><sw-icon name="warning" size=${14}></sw-icon>${this.codeError}</div>`:d}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.closeDialog()}>${t("ביטול")}</sw-button>
      <sw-button slot="footer" variant=${e.action==="disarm"||e.action==="bypass_on"?"danger":"primary"} data-alarm-confirm ?disabled=${this.busy} @click=${()=>this.submitCode()}>${e.kind==="panel"?m[e.action]:e.action==="bypass_on"?t("עקוף"):t("החזר להגנה")}</sw-button>
    </sw-dialog>`}renderPin(){if(!this.pinOpen)return d;const e=this.data?.me.pin_set,a=n=>i=>this.pinForm={...this.pinForm,[n]:i.target.value};return r`<sw-dialog open heading=${t("הקוד האישי שלי")} subheading=${t("קוד של 4–8 ספרות להפעלה ולנטרול מהאפליקציה. זה אינו קוד הלוח.")} data-alarm-pin-dialog
      @close=${()=>{this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""}}}>
      <form class="pinform" autocomplete="off" @submit=${n=>{n.preventDefault(),this.savePin()}}>
        ${e?r`<label class="hint">${t("הקוד הנוכחי")}<input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="8" data-pin-current .value=${this.pinForm.current} @input=${a("current")} /></label>`:r`<label class="hint">${t("קוד הלוח (להגדרת הקוד האישי הראשון)")}<input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="32" data-pin-panel .value=${this.pinForm.panel} @input=${a("panel")} /></label>`}
        <label class="hint">${t("קוד חדש")}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" data-pin-new .value=${this.pinForm.next} @input=${a("next")} /></label>
        <label class="hint">${t("שוב, לאימות")}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" data-pin-again .value=${this.pinForm.again} @input=${a("again")} /></label>
        ${this.pinError?r`<div class="err" role="alert">${this.pinError}</div>`:d}
      </form>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""}}}>${t("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" data-pin-save ?disabled=${this.busy} @click=${()=>void this.savePin()}>${t("שמירה")}</sw-button>
    </sw-dialog>`}};c.styles=[B,W`
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
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease),
        transform var(--sw-t-press) var(--sw-ease);
    }
    /* ROUND4-LEFTOVERS-2390 (WP9): the panel switcher's hover only under a fine hovering pointer (it stuck after a tap on a
       touch screen), and a press on pointer-down like the filter chips */
    @media (hover: hover) and (pointer: fine) {
      .switcher button:hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
    }
    .switcher button:active {
      transform: scale(var(--sw-press-scale));
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
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
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
      background: color-mix(in srgb, currentColor 22%, transparent);
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
      transition: background var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease);
    }
    .vt button[aria-pressed='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
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
    /* CR-CMP2-TOAST-2440 (06:CMP-2 step 2): the bypass switch is the shared sw-toggle; "bypassed" keeps the zone's bypass colour */
    .bypass sw-toggle {
      --sw-toggle-on: var(--al-bypass);
    }
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
      .switcher button {
        min-block-size: 44px;
      }
    }
    @media (pointer: coarse) {
      details.unpaired summary {
        min-block-size: 44px;
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
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease);
    }
    /* ROUND4-LEFTOVERS-2390 (WP9): a keypad is pressed with a finger - its hover only under a fine pointer (a tapped digit kept
       the hover wash), the press scale from the motion tokens (zeroed with reduced motion) */
    @media (hover: hover) and (pointer: fine) {
      .keys button:hover {
        background: var(--sw-surface-2);
      }
    }
    .keys button:active {
      background: var(--sw-accent-soft);
      transform: scale(var(--sw-press-scale));
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
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls): from 1024 px the page takes the screen's height, the state
       panel is a little denser, and the sensors (the one list that grows with the installation) take the room left and scroll inside
       their own region; the state, the arm keys and the filters never leave the screen */
    @media (min-width: 1024px) {
      sw-page {
        block-size: 100%;
      }
      .hero {
        padding: 14px 20px;
        gap: 10px 20px;
      }
      .ready {
        padding: 8px 12px;
        font-size: var(--sw-fs-sm);
      }
      .ready ul {
        margin-block-start: 2px;
      }
      .areas {
        flex: 1 1 0;
        min-block-size: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        /* room for the cards' shadow and focus ring inside the scroller */
        padding: 2px 4px 6px;
        margin-inline: -4px;
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
  `,K];p([X()],c.prototype,"panelId",2);p([h()],c.prototype,"data",2);p([h()],c.prototype,"error",2);p([h()],c.prototype,"loading",2);p([h()],c.prototype,"filter",2);p([h()],c.prototype,"zoneView",2);p([h()],c.prototype,"stateFlash",2);p([h()],c.prototype,"pending",2);p([h()],c.prototype,"code",2);p([h()],c.prototype,"codeError",2);p([h()],c.prototype,"busy",2);p([h()],c.prototype,"sent",2);p([h()],c.prototype,"pinOpen",2);p([h()],c.prototype,"pinForm",2);p([h()],c.prototype,"pinError",2);c=p([G("security-alarm")],c);export{c as SecurityAlarm};
