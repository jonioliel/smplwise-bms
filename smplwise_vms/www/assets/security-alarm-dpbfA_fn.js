import{i as D,aW as A,eL as U,d0 as q,aY as H,am as Z,ae as z,ld as V,fA as Y,o as g,a7 as S,eU as j,le as v,lf as B,lg as N,lh as y,li as W,a as x,lj as K,b as i,A as d,lk as G,eZ as Q,ll as T,e1 as X,lm as J,fh as ee,aT as te,eY as ae,bx as se,g as re,y as ie,j as u,k as ne}from"./index-CqeTnh_F.js";import"./sw-pager-DInEBlKS.js";import{L as oe}from"./long-lists-Bixubyl4.js";import{F as le}from"./page-fit-FTpnqywZ.js";import{L as de}from"./latest-DjG5XH9h.js";import{b as ce}from"./bubble-chrome-DtLCPG9P.js";import{t as a}from"./media-KElttbNZ.js";import{l as pe}from"./live-BLNpflQx.js";import{T as he}from"./toast-controller-BPX0Tkjm.js";import"./sw-logo-art-PLtEZJxU.js";class ue{constructor(t,s,n=le){this.host=t,this.region=s,this.page=1,this.cols=0,this.rows=0,this.mode="probe",this.total=0,this.sig="",this.dirty=!0,this.raf=0,this.observed=null,this.size="",this.onMq=()=>{this.reset(),this.host.requestUpdate()},this.mq=window.matchMedia(n),this.lists=new oe(t,()=>this.reset()),t.addController(this)}get on(){return this.mq.matches&&this.lists.paged}get flat(){return this.on&&this.mode==="flat"}get per(){return this.cols*this.rows}get pages(){return this.flat&&this.per?Math.max(1,Math.ceil(this.total/this.per)):1}hostConnected(){this.mq.addEventListener("change",this.onMq)}hostDisconnected(){this.mq.removeEventListener("change",this.onMq),this.ro?.disconnect(),this.ro=void 0,this.observed=null,cancelAnimationFrame(this.raf)}reset(){this.mode="probe",this.cols=0,this.rows=0,this.page=1,this.dirty=!0}sync(t,s){(s!==this.sig||t!==this.total)&&(this.sig=s,this.total=t,this.reset()),this.page>this.pages&&(this.page=this.pages)}shows(t){return!this.flat||!this.per?!0:t>=(this.page-1)*this.per&&t<this.page*this.per}go(t){this.page=Math.min(Math.max(1,t),this.pages),this.host.requestUpdate()}hostUpdated(){const t=this.region();if(!this.on){t?.style.removeProperty("--fit-row-h");return}t&&t!==this.observed&&typeof ResizeObserver<"u"&&(this.ro?.disconnect(),this.observed=t,this.size="",this.dirty=!0,this.ro=new ResizeObserver(([s])=>{const n=`${Math.round(s.contentRect.width)}x${Math.round(s.contentRect.height)}`;if(n===this.size)return;const o=this.size==="";this.size=n,!o&&(this.reset(),this.host.requestUpdate())}),this.ro.observe(t)),this.dirty&&(cancelAnimationFrame(this.raf),this.raf=requestAnimationFrame(()=>this.measure()))}measure(){const t=this.region();if(!t||!this.on)return;if(this.mode==="probe"){this.mode=t.scrollHeight-t.clientHeight<=1?"grouped":"flat",this.dirty=this.mode==="flat",this.mode==="flat"&&this.host.requestUpdate();return}if(this.mode!=="flat")return;const s=t.style.getPropertyValue("--fit-row-h");t.style.removeProperty("--fit-row-h");const n=[...t.querySelectorAll("[data-fit-item]")].filter(m=>m.getClientRects().length>0);if(!n.length){s&&t.style.setProperty("--fit-row-h",s);return}const o=n.map(m=>m.getBoundingClientRect()),l=o[0].top,r=Math.max(1,o.filter(m=>Math.abs(m.top-l)<=2).length),c=Math.max(...o.map(m=>m.height)),w=n[0].parentElement,f=w?getComputedStyle(w):null,_=f&&parseFloat(f.rowGap)||0,$=getComputedStyle(t),C=t.getBoundingClientRect(),O=C.top+(parseFloat($.borderTopWidth)||0)+(parseFloat($.paddingTop)||0),I=C.top+(parseFloat($.borderTopWidth)||0)+t.clientHeight-(parseFloat($.paddingBottom)||0),L=w&&w!==t&&f?(parseFloat(f.paddingBottom)||0)+(parseFloat(f.borderBottomWidth)||0):0,R=I-Math.max(l,O)-L,k=Math.max(1,Math.floor((R+_)/(c+_)+.001)),P=Math.max(c,Math.floor((R-_*(k-1))/k*100)/100);t.style.setProperty("--fit-row-h",`${P}px`),this.dirty=!1,(r!==this.cols||k!==this.rows)&&(this.cols=r,this.rows=k,this.page>this.pages&&(this.page=this.pages),this.host.requestUpdate())}}const F=new Date(Date.now()-12*6e4).toISOString();function b(e,t,s,n,o={}){return{entity_id:`binary_sensor.demo_zone_${e}`,name:t,platform:"demo",device_class:n==="motion"?"motion":"door",kind:n,state:o.open?"on":"off",available:!0,open:!1,fault:!1,tamper:!1,battery_low:!1,battery_level:null,alarmed:!1,bypassed:!1,last_changed:F,area_id:s,area_name:s,ha_floor_name:null,zone_number:e,aux:[],shared:!1,bypass:{entity_id:`switch.demo_zone_${e}_bypassed`,domain:"switch",name:`${t} עקיפה`,state:o.bypassed?"on":"off",available:!0,bypassed:!!o.bypassed,strategy:"device",on_option:null,off_option:null},...o}}const we={panels:[{entity_id:"alarm_control_panel.demo_house",name:"בית",platform:"demo",integration:"הדגמה",integration_note:"",config_entry_id:null,state:"disarmed",available:!0,fresh:!0,last_changed:F,changed_by:"דייר 1",arm_modes:["arm_home","arm_away","arm_night"],features_reported:!0,code_format:"number",code_arm_required:!1,needs_code_arm:!1,needs_code_disarm:!0,area_name:null,open_sensors:[],bypassed_sensors:[],zones:[b(1,"דלת כניסה","כניסה","opening"),b(2,"דלת אחורית","מטבח","opening",{open:!0,state:"on"}),b(3,"גלאי סלון","סלון","motion"),b(4,"חלון מטבח","מטבח","opening",{bypassed:!0}),b(5,"חלון חדר שינה","חדר שינה","opening",{battery_low:!0}),b(6,"גלאי עשן","מטבח","fault")],unpaired_controls:[],ready:{ready:!1,open:["binary_sensor.demo_zone_2"],faults:[]},can:{arm:!0,disarm:!0,bypass:!0,restore:!0},panel_code_set:!0,code:{arm:"none",disarm:"pin",bypass:"pin"}}],counts:{panels:1,zones:6,open:1,bypassed:1,faults:0},channel:"local",remote:{control:!0,disarm:!0,codeless:!0},code_mode:"personal_pin",me:{arm_policy:"no_code",disarm_policy:"code_required",pin_set:!0},can_configure:!0};var fe=Object.defineProperty,me=Object.getOwnPropertyDescriptor,h=(e,t,s,n)=>{for(var o=n>1?void 0:n?me(t,s):t,l=e.length-1,r;l>=0;l--)(r=e[l])&&(o=(n?r(t,s,o):r(o))||o);return n&&o&&fe(t,s,o),o};const M="sw.alarm.zones.view";function ge(){try{return localStorage.getItem(M)==="list"?"list":"cards"}catch{return"cards"}}const be=[{id:"all",label:a("הכל")},{id:"open",label:a("פתוחים בלבד")},{id:"bypassed",label:a("עקופים")},{id:"faults",label:a("תקלות")}];function E(e){if(!e)return"";const t=new Date(e);if(Number.isNaN(t.getTime()))return"";const s=Math.round((Date.now()-t.getTime())/1e3);return s<60?a("עכשיו"):s<3600?a("לפני {n} דק׳",{n:Math.round(s/60)}):s<86400?a("לפני {n} שע׳",{n:Math.round(s/3600)}):te(t)}let p=class extends D{constructor(){super(...arguments),this.bubbleSkin=new A(this),this.fit=new ue(this,()=>this.renderRoot.querySelector(".areas")),this.panelId="",this.data=null,this.error="",this.loading=!0,this.filter="all",this.zoneView=ge(),this.stateFlash=!1,this.flashTimer=0,this.pending=null,this.code="",this.codeError="",this.busy=!1,this.sent=null,this.toaster=new he(this,{ms:4e3}),this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""},this.pinError="",this.refetchTimer=0,this.poller=new U(this),this.reads=new de,this.actionSignal=null,this.watched=new Set}get toast(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.stopSession=q(e=>{e.mode!=="loading"&&(this.load(),e.mode==="api"&&!this.stopHa&&(this.stopHa=H(t=>{t.type==="entity_state_changed"&&this.watched.has(t.entity.entity_id)&&this.scheduleRefetch(),t.type==="structure_changed"&&this.scheduleRefetch()}),this.poller.every("panels",15e3,()=>this.load(!0))))})}disconnectedCallback(){super.disconnectedCallback(),this.stopHa?.(),this.stopHa=void 0,this.stopSession?.(),this.poller.cancel("panels"),this.reads.cancel(),this.actionSignal&&(this.actionSignal.stopped=!0),this.actionSignal=null,window.clearTimeout(this.refetchTimer),window.clearTimeout(this.flashTimer),this.clearCode()}willUpdate(e){if(e.has("panelId")&&!this.panelId){const s=Z().params.get("panel");s&&(this.panelId=s)}const t=this.panel?`${this.panel.entity_id}:${this.panel.state??""}:${this.panel.available}`:void 0;if(t!==this.lastHeroState){const s=this.lastHeroState===void 0;this.lastHeroState=t,!s&&t!==void 0&&(this.stateFlash=!0,window.clearTimeout(this.flashTimer),this.flashTimer=window.setTimeout(()=>this.stateFlash=!1,700))}}setZoneView(e){this.zoneView=e;try{localStorage.setItem(M,e)}catch{}}scheduleRefetch(){window.clearTimeout(this.refetchTimer),this.refetchTimer=window.setTimeout(()=>void this.load(!0),250)}async load(e=!1){const t=this.reads.begin();e||(this.loading=!this.data);try{const s=z()?await V():we;if(!t())return;this.data=s,z()&&Y(this.data.panels.length),this.error="",this.watched=new Set(this.data.panels.flatMap(n=>[n.entity_id,...n.zones.flatMap(o=>[o.entity_id,...o.aux??[],...o.bypass?[o.bypass.entity_id]:[]]),...n.unpaired_controls.map(o=>o.entity_id)]))}catch(s){if(!t())return;(!e||!this.data)&&(this.error=g(s))}finally{t()&&(this.loading=!1)}}get panel(){const e=this.data?.panels??[];return e.find(t=>t.entity_id===this.panelId)??e[0]??null}choosePanel(e){this.panelId=e,S("/system/security/alarm",{panel:e})}async openLiveIncident(e){this.busy=!0;try{const t=await j({alarm_panel:e});S(`/investigate/incidents/${encodeURIComponent(t.incident.id)}`)}catch(t){this.flash(g(t))}finally{this.busy=!1}}flash(e){this.toaster.show(e)}start(e){if(e.prompt==="pin_missing"){this.data?.panels.some(t=>t.panel_code_set)?(this.pinOpen=!0,this.pinError=a("נדרש קוד אישי. הקלידו את קוד הלוח כדי להגדיר אותו, או פנו למנהל המערכת לקבלת קוד אישי.")):this.flash(a("פנה למנהל המערכת לקבלת קוד אישי."));return}if(e.prompt==="unverifiable"){this.flash(v.code_unverifiable+a(" - פנו למנהל המערכת."));return}if(e.prompt==="none"&&!e.needsConfirm){this.send(e,"");return}this.clearCode(),this.pending=e}clearCode(){this.code="",this.codeError="";const e=this.renderRoot?.querySelector("input[data-code]");e&&(e.value="")}closeDialog(){this.pending=null,this.clearCode()}async send(e,t){if(!z()){this.closeDialog(),this.flash(a("נתוני הדגמה: לא נשלחה פקודה."));return}this.busy=!0,this.codeError="";try{const s=e.kind==="panel"?await B(e.panel.entity_id,e.action,{confirmed:e.action==="disarm",code:t||void 0}):await N(e.zone.entity_id,e.action==="bypass_on",{confirmed:!0,code:t||void 0});this.closeDialog();const n=e.kind==="panel"?y[e.action]:e.action==="bypass_on"?a("עקיפת {name}",{name:e.zone.name}):a("החזרת {name} להגנה",{name:e.zone.name});this.sent={label:n,record:s,entity:s.entity_id},this.actionSignal&&(this.actionSignal.stopped=!0);const o={stopped:!1};this.actionSignal=o,W(s.id,l=>{this.sent&&this.sent.record&&this.sent.record.id===l.id&&(this.sent={...this.sent,record:l})},o).then(()=>o.stopped?void 0:this.load(!0)).catch(()=>{}),this.load(!0)}catch(s){const n=s instanceof x?s.body.code:"";s instanceof x&&n==="code_required"?(this.pending={...e,prompt:s.body.details?.prompt??"panel"},this.codeError=""):s instanceof x&&this.pending&&["wrong_code","code_locked","rate_limited","code_rejected"].includes(n)?(this.clearCode(),this.codeError=v[n]??g(s)):(this.closeDialog(),this.flash(v[n]??g(s)))}finally{this.busy=!1}}submitCode(){const e=this.pending;if(!e)return;if(e.prompt!=="none"&&!this.code){this.codeError=a("הקלידו קוד");return}const t=this.code;this.code="",this.send(e,e.prompt==="none"?"":t)}key(e){e==="back"?this.code=this.code.slice(0,-1):e==="clear"?this.code="":this.code.length<32&&(this.code+=e),this.codeError=""}async savePin(){const e=this.pinForm;if(!/^\d{4,8}$/.test(e.next)){this.pinError=a("קוד אישי: 4–8 ספרות.");return}if(e.next!==e.again){this.pinError=a("הקודים אינם זהים.");return}if(!z()){this.pinOpen=!1,this.flash(a("נתוני הדגמה: הקוד לא נשמר."));return}this.busy=!0;try{await K(e.next,e.current||void 0,e.panel||void 0),this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""},this.pinError="",this.flash(a("הקוד האישי נשמר")),await this.load(!0)}catch(t){this.pinError=t instanceof x&&t.body.code==="wrong_code"?this.data?.me.pin_set?a("הקוד הנוכחי שגוי."):a("קוד הלוח שגוי."):t instanceof x?v[t.body.code]??g(t):g(t)}finally{this.busy=!1}}render(){if(this.loading&&!this.data)return i`<sw-page heading=${a("אזעקה")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.error&&!this.data)return i`<sw-page heading=${a("אזעקה")}><sw-state-panel state="error" heading=${a("לא ניתן לטעון את האזעקה")} hint=${this.error} actionLabel=${a("נסו שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const e=this.data,t=this.panel;if(!t)return i`<sw-page heading=${a("אזעקה")}><sw-state-panel icon="shield" data-alarm-empty state="empty" heading=${a("לא נמצא לוח אזעקה")}
        hint=${a("המערכת לא מצאה לוח אזעקה מחובר. מתקין או מנהל המערכת יכול לבדוק בהגדרות ‹ אבטחה ‹ ניהול אזעקה שמערכת האזעקה מחוברת לתשתית המערכת ושההרשאות מאפשרות לראות אותה.")}></sw-state-panel></sw-page>`;const s=`${a("{zones} חיישנים · {open} פתוחים · {bypassed} עקופים",{zones:e.counts.zones,open:e.counts.open,bypassed:e.counts.bypassed})}${e.counts.faults?a(" · {n} תקלות",{n:e.counts.faults}):""}${e.channel==="remote"?a(" · מחוץ לרשת המקומית"):""}`;return i`<sw-page heading=${a("אזעקה")} subheading=${s}>
      <sw-button slot="actions" size="sm" variant="ghost" icon="lock" data-alarm-pin @click=${()=>{this.pinOpen=!0,this.pinError=""}}>${a("הקוד האישי שלי")}</sw-button>
      ${G(ae())?i`<sw-button slot="actions" size="sm" icon="warning" data-alarm-incident ?disabled=${this.busy} @click=${()=>void this.openLiveIncident(t.entity_id)}>${Q("alarmOpen")}</sw-button>`:d}
      ${e.panels.length>1?i`<div class="switcher" role="group" aria-label=${a("בחירת לוח")} data-alarm-switcher>${e.panels.map(n=>{const o=T(n.state,n.available);return i`<button type="button" aria-pressed=${n.entity_id===t.entity_id} data-panel=${n.entity_id} @click=${()=>this.choosePanel(n.entity_id)}><i class="dot ${o.tone}"></i>${n.name}<span class="hint">· ${o.label}</span></button>`})}</div>`:d}
      ${this.renderHero(t)}
      ${this.renderZones(t)}
      ${t.unpaired_controls.length?i`<details class="unpaired" data-alarm-unpaired><summary>${a("ללא שיוך · {length} מתגי עקיפה שלא שויכו לחיישן",{length:t.unpaired_controls.length})}</summary><ul>${t.unpaired_controls.map(n=>i`<li>${n.name}${n.bypassed?a(" · עוקף"):""}</li>`)}</ul><div class="hint">${a("שיוך ידני: הגדרות ‹ אבטחה ‹ ניהול אזעקה.")}</div></details>`:d}
    </sw-page>
    ${this.renderKeypad()} ${this.renderPin()} ${this.toast?i`<div class="toast" role="status" aria-live="polite" ${X()}>${this.toast}</div>`:d}`}renderHero(e){const t=T(e.state,e.available),s=e.state==="disarmed",n=new Map(e.zones.map(r=>[r.entity_id,r])),o=r=>n.get(r)?.name??r,l=this.sent&&this.sent.entity===e.entity_id?this.sent:null;return i`<section class="hero ${this.stateFlash?"changed":""}" data-tone=${t.tone} data-alarm-state=${e.state??"unknown"} data-alarm-panel=${e.entity_id}>
      <div class="state-row">
        <span class="shield" aria-hidden="true"><sw-icon name=${t.tone==="triggered"?"warning":s?"unlock":"shield"} size=${30}></sw-icon></span>
        <div>
          <div class="state-label" role="status" aria-live="polite">${t.label}</div>
          <div class="meta">${e.name}${e.changed_by?a(" · שונה על ידי {changed_by}",{changed_by:e.changed_by}):""}${e.last_changed?` · ${E(e.last_changed)}`:""}</div>
        </div>
      </div>
      <div class="actions">
        ${e.can.arm?e.arm_modes.filter(r=>r!=="arm_custom_bypass"||e.can.bypass).map(r=>i`<sw-button variant=${r==="arm_away"?"primary":"secondary"} icon="shield" data-arm=${r} ?disabled=${this.busy||!e.available||e.state===r.replace("arm_","armed_")}
              @click=${()=>this.start({kind:"panel",action:r,panel:e,prompt:e.code.arm,needsConfirm:!1})}>${y[r]}</sw-button>`):d}
        ${e.can.disarm?i`<sw-button variant="danger" icon="unlock" data-disarm ?disabled=${this.busy||!e.available||s}
              @click=${()=>this.start({kind:"panel",action:"disarm",panel:e,prompt:e.code.disarm,needsConfirm:!0})}>${y.disarm}</sw-button>`:d}
      </div>
      ${s?i`<div class="ready ${e.ready.ready?"":"no"}" data-alarm-ready=${e.ready.ready?"yes":"no"}>
            <sw-icon name=${e.ready.ready?"check":"warning"} size=${16}></sw-icon>
            <div>${e.ready.ready?a("מוכנה לדריכה: כל החיישנים סגורים."):i`<b>${a("לא מוכנה לדריכה")}</b>
                  <ul>${e.ready.open.map(r=>i`<li>${a("פתוח:")} ${o(r)}</li>`)}${e.ready.faults.map(r=>i`<li>${a("תקלה:")} ${o(r)}</li>`)}</ul>
                  <span class="hint">${a("אפשר לסגור, או לעקוף חיישן לפני הדריכה.")}</span>`}</div>
          </div>`:d}
      ${l?i`<div class="sent" data-alarm-sent=${l.record?.status??"pending"}>${l.label}: ${l.record?.status==="confirmed"?a("הלוח אישר."):l.record?.status==="unknown"?a("הלוח לא אישר את הפקודה בזמן (ייתכן שהקוד שגוי) - המצב המוצג הוא מה שהלוח מדווח."):l.record?.status==="failed"||l.record?.status==="denied"?a("הפקודה לא בוצעה{why}.",{why:l.record.error?` (${v[l.record.error]??l.record.error})`:""}):a("נשלח · ממתין לאישור הלוח…")}</div>`:d}
    </section>`}visibleZones(e){switch(this.filter){case"open":return e.zones.filter(t=>t.open&&!t.bypassed);case"bypassed":return e.zones.filter(t=>t.bypassed);case"faults":return e.zones.filter(t=>t.fault||t.tamper);default:return e.zones}}renderZones(e){const t=this.visibleZones(e),s=new Map;for(const r of t){const c=r.area_name??a("ללא אזור");s.has(c)||s.set(c,[]),s.get(c).push(r)}const n={all:e.zones.length,open:e.zones.filter(r=>r.open&&!r.bypassed).length,bypassed:e.zones.filter(r=>r.bypassed).length,faults:e.zones.filter(r=>r.fault||r.tamper).length},o=this.zoneView==="list";this.toggleAttribute("data-pages-on",this.fit.on),this.fit.sync(t.length,`${e.entity_id}|${this.filter}|${this.zoneView}|${t.map(r=>r.entity_id).join(",")}`);const l=this.fit.flat?[...s.entries()].flatMap(([r,c])=>c.map(w=>[r,w])).filter((r,c)=>this.fit.shows(c)):[];return i`<div class="toolbar">
        <div class="chips" role="group" aria-label=${a("סינון חיישנים")}>${be.map(r=>i`<button type="button" aria-pressed=${this.filter===r.id} data-filter=${r.id} @click=${()=>this.filter=r.id}>${r.label}${r.id!=="all"&&n[r.id]?i`<span class="n">${n[r.id]}</span>`:d}</button>`)}</div>
        <div class="end">
          <span class="counts">${a("{n} מתוך {total} חיישנים",{n:t.length,total:e.zones.length})}</span>
          <div class="vt" role="group" aria-label=${a("תצוגת חיישנים")} data-alarm-view>
            <button type="button" aria-pressed=${!o} aria-label=${a("כרטיסים")} title=${a("כרטיסים")} data-alarm-view-cards @click=${()=>this.setZoneView("cards")}><sw-icon name="grid" size=${15}></sw-icon></button>
            <button type="button" aria-pressed=${o} aria-label=${a("רשימה")} title=${a("רשימה")} data-alarm-view-list @click=${()=>this.setZoneView("list")}><sw-icon name="list" size=${15}></sw-icon></button>
          </div>
          ${this.fit.on&&this.fit.pages>1?i`<span class="pg"><sw-pager data-alarm-pager .page=${this.fit.page} .pages=${this.fit.pages} @page-change=${r=>this.fit.go(r.detail.page)}></sw-pager></span>`:d}
        </div>
      </div>
      ${e.zones.length?t.length?this.fit.flat?o?i`<div class="areas flat list"><div class="zlist" data-alarm-zones="list">${l.map(([r,c])=>this.renderZone(e,c,!0,r))}</div></div>`:i`<div class="areas flat" data-alarm-zones="cards">${l.map(([r,c])=>this.renderZone(e,c,!1,r))}</div>`:i`<div class="areas ${o?"list":""}">${[...s.entries()].map(([r,c])=>i`<section data-area=${r}><h3>${r}<span class="n">${c.length}</span></h3>${o?i`<div class="zlist" data-alarm-zones="list">${c.map(w=>this.renderZone(e,w,!0))}</div>`:i`<div class="grid" data-alarm-zones="cards">${c.map(w=>this.renderZone(e,w,!1))}</div>`}</section>`)}</div>`:i`<sw-state-panel icon="filter" compact state="empty" heading=${a("אין חיישנים שמתאימים לסינון")} data-alarm-filter-empty actionLabel=${a("הצג הכל")} @action=${()=>this.filter="all"}></sw-state-panel>`:i`<sw-state-panel icon="sensor" compact state="empty" heading=${a("אין חיישנים ללוח הזה")} hint=${a("החיישנים מגיעים מאותה מערכת אזעקה. מנהל המערכת יכול לשייך חיישנים ידנית בהגדרות ‹ אבטחה ‹ ניהול אזעקה.")}></sw-state-panel>`}`}renderZone(e,t,s=!1,n=""){const o=n?i`<span class="zarea" data-zone-area>${n}</span>`:d,l=J(t),r=t.kind==="motion"?"activity":t.kind==="fault"?"warning":t.kind==="opening"?"door":"sensor",c=t.bypass,w=!!c&&c.available&&(t.bypassed?e.can.restore:e.can.bypass),f=c?i`<div class="bypass"><sw-toggle .checked=${pe(t.bypassed)} label=${a("עקיפת {name}",{name:t.name})} labelHidden data-bypass=${t.entity_id}
            ?disabled=${!w||this.busy} title=${w?"":a("אין הרשאה או שהמתג אינו זמין")}
            @change=${ee(!!t.bypassed,()=>this.start({kind:"bypass",action:t.bypassed?"bypass_off":"bypass_on",panel:e,zone:t,prompt:e.code.bypass,needsConfirm:!0}))}></sw-toggle>${a("עקיפה")}</div>`:i`<span></span>`;return s?i`<article class="zrow" data-fit-item data-tone=${l.tone} data-zone=${t.entity_id}>
        <span class="zicon" aria-hidden="true"><sw-icon name=${r} size=${15}></sw-icon></span>
        <div class="zname" title=${t.name}>${t.zone_number!==null?i`<span class="hint">${t.zone_number} · </span>`:d}${t.name}</div>
        <span class="zstate" data-zone-state>${l.label}</span>
        ${f}
        <div class="zsub">
          ${o}
          ${t.last_changed?i`<span>${E(t.last_changed)}</span>`:d}
          ${t.tamper?i`<span class="flag">${a("חבלה")}</span>`:d}
          ${t.battery_low?i`<span class="flag">${a("סוללה חלשה")}</span>`:t.battery_level!==null?i`<span>${a("סוללה {battery_level}%",{battery_level:t.battery_level})}</span>`:d}
          ${t.alarmed?i`<span class="flag">${a("גרם לאזעקה")}</span>`:d}
          ${t.shared?i`<span title=${a("החיישן משותף לכל המחיצות של המערכת")}>${a("משותף")}</span>`:d}
        </div>
      </article>`:i`<article class="zone" data-fit-item data-tone=${l.tone} data-zone=${t.entity_id}>
      <span class="zicon" aria-hidden="true"><sw-icon name=${r} size=${18}></sw-icon></span>
      <div class="zname" title=${t.name}>${t.zone_number!==null?i`<span class="hint">${t.zone_number} · </span>`:d}${t.name}</div>
      ${f}
      <div class="zsub">
        <span class="zstate" data-zone-state>${l.label}</span>
        ${o}
        ${t.last_changed?i`<span>${E(t.last_changed)}</span>`:d}
        ${t.tamper?i`<span class="flag">${a("חבלה")}</span>`:d}
        ${t.battery_low?i`<span class="flag">${a("סוללה חלשה")}</span>`:t.battery_level!==null?i`<span>${a("סוללה {battery_level}%",{battery_level:t.battery_level})}</span>`:d}
        ${t.alarmed?i`<span class="flag">${a("גרם לאזעקה")}</span>`:d}
        ${t.shared?i`<span title=${a("החיישן משותף לכל המחיצות של המערכת")}>${a("משותף")}</span>`:d}
      </div>
    </article>`}renderKeypad(){const e=this.pending;if(!e)return d;const t=e.kind==="panel"?y[e.action]:e.action==="bypass_on"?a("עקיפת {name}",{name:e.zone.name}):a("החזרת {name} להגנה",{name:e.zone.name}),s=e.prompt==="none"?`${t}?`:t,n=e.prompt==="pin"?a("הקלידו את הקוד האישי שלכם"):e.prompt==="panel"?a("הקלידו את קוד לוח האזעקה"):e.kind==="bypass"&&e.action==="bypass_on"?a("החיישן לא יתריע עד שיוחזר להגנה."):e.action==="disarm"?a("{name} תנוטרל.",{name:e.panel.name}):"",o=e.prompt==="pin"||e.prompt==="panel";return i`<sw-dialog open heading=${s} subheading=${n} data-alarm-dialog @close=${()=>this.closeDialog()}>
      ${o?i`<form class="keypad" data-keypad autocomplete="off" @submit=${l=>{l.preventDefault(),this.submitCode()}}>
            <input data-code type="password" inputmode="numeric" autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="false" name="sw-alarm-code-nofill" aria-label=${a("קוד")}
              maxlength="32" .value=${this.code} @input=${l=>{this.code=l.target.value,this.codeError=""}} />
            <div class="keys">${["1","2","3","4","5","6","7","8","9","clear","0","back"].map(l=>i`<button type="button" data-key=${l} aria-label=${l==="back"?a("מחיקה"):l==="clear"?a("ניקוי"):l} @click=${()=>this.key(l)}>${l==="back"?"⌫":l==="clear"?"C":l}</button>`)}</div>
            ${this.codeError?i`<div class="err" role="alert" data-code-error><sw-icon name="warning" size=${14}></sw-icon>${this.codeError}</div>`:d}
          </form>`:this.codeError?i`<div class="err" role="alert"><sw-icon name="warning" size=${14}></sw-icon>${this.codeError}</div>`:d}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.closeDialog()}>${a("ביטול")}</sw-button>
      <sw-button slot="footer" variant=${e.action==="disarm"||e.action==="bypass_on"?"danger":"primary"} data-alarm-confirm ?disabled=${this.busy} @click=${()=>this.submitCode()}>${e.kind==="panel"?y[e.action]:e.action==="bypass_on"?a("עקוף"):a("החזר להגנה")}</sw-button>
    </sw-dialog>`}renderPin(){if(!this.pinOpen)return d;const e=this.data?.me.pin_set,t=s=>n=>this.pinForm={...this.pinForm,[s]:n.target.value};return i`<sw-dialog open heading=${a("הקוד האישי שלי")} subheading=${a("קוד של 4–8 ספרות להפעלה ולנטרול מהאפליקציה. זה אינו קוד הלוח.")} data-alarm-pin-dialog
      @close=${()=>{this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""}}}>
      <form class="pinform" autocomplete="off" @submit=${s=>{s.preventDefault(),this.savePin()}}>
        ${e?i`<label class="hint">${a("הקוד הנוכחי")}<input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="8" data-pin-current .value=${this.pinForm.current} @input=${t("current")} /></label>`:i`<label class="hint">${a("קוד הלוח (להגדרת הקוד האישי הראשון)")}<input type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="32" data-pin-panel .value=${this.pinForm.panel} @input=${t("panel")} /></label>`}
        <label class="hint">${a("קוד חדש")}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" data-pin-new .value=${this.pinForm.next} @input=${t("next")} /></label>
        <label class="hint">${a("שוב, לאימות")}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" data-pin-again .value=${this.pinForm.again} @input=${t("again")} /></label>
        ${this.pinError?i`<div class="err" role="alert">${this.pinError}</div>`:d}
      </form>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.pinOpen=!1,this.pinForm={current:"",next:"",again:"",panel:""}}}>${a("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" data-pin-save ?disabled=${this.busy} @click=${()=>void this.savePin()}>${a("שמירה")}</sw-button>
    </sw-dialog>`}};p.styles=[se,re`
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
        /* room for the cards' shadow and focus ring inside the region */
        padding: 2px 4px 6px;
        margin-inline: -4px;
      }
      /* SCROLL-AUDIT-2480: the measured pages are in force (long lists paged) - the region clips and shows the sensors that fit */
      :host([data-pages-on]) .areas {
        overflow: hidden;
      }
      /* SCROLL-AUDIT-2480: the one-grid pages (components/grid-fit.ts, the sensors did not fit by area) - the cards in the columns the
         region's width takes, the rows that fit its height, stretched (--fit-row-h) so a page fills the region to its bottom edge */
      .areas.flat {
        /* a card at least 19 em wide (about 266 px at the screen's text size): a usual sensor name is not cut, and the state line
           (state, area, time, a flag) stays one line */
        grid-template-columns: repeat(auto-fill, minmax(19em, 1fr));
        grid-auto-rows: var(--fit-row-h, auto);
        gap: var(--sw-s-3);
        align-items: stretch;
        align-content: start;
      }
      .areas.flat.list {
        display: block;
      }
      /* one line of state: every item keeps one height (the rows are counted from it). The state word and the flags (tamper, low
         battery, caused the alarm) come first; the area and the time follow and, when the card is too narrow for them, wrap to a
         second line that is clipped - they leave whole, never as a cut word */
      .areas.flat .zsub {
        line-height: 1.5;
        max-block-size: calc(var(--sw-fs-lg) * 1.5);
        overflow: hidden;
      }
      .areas.flat .zsub > * {
        white-space: nowrap;
        order: 2;
      }
      .areas.flat .zsub > .zstate {
        order: 0;
      }
      .areas.flat .zsub > .flag {
        order: 1;
      }
      .areas.flat .zrow {
        box-sizing: border-box;
        block-size: var(--fit-row-h, auto);
      }
    }
    .zarea {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
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
  `,ce];h([ie()],p.prototype,"panelId",2);h([u()],p.prototype,"data",2);h([u()],p.prototype,"error",2);h([u()],p.prototype,"loading",2);h([u()],p.prototype,"filter",2);h([u()],p.prototype,"zoneView",2);h([u()],p.prototype,"stateFlash",2);h([u()],p.prototype,"pending",2);h([u()],p.prototype,"code",2);h([u()],p.prototype,"codeError",2);h([u()],p.prototype,"busy",2);h([u()],p.prototype,"sent",2);h([u()],p.prototype,"pinOpen",2);h([u()],p.prototype,"pinForm",2);h([u()],p.prototype,"pinError",2);p=h([ne("security-alarm")],p);export{p as SecurityAlarm};
