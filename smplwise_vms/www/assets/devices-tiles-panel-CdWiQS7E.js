import{i as O,ch as e,ci as F,cj as N,a2 as z,aN as R,ck as P,a as H,n as q,ar as k,A as d,b as r,a3 as B,bd as E,a6 as $,cl as j,cm as W,cn as S,co as U,cp as K,cq as V,cr as Q,aI as Y,d as Z,cs as G,ct as J,cu as X,g as tt,ax as g,j as x,k as et}from"./index-rXjlW4bK.js";import{s as at,l as it,a as st}from"./door-path-logic-C2sxuunU.js";import"./sw-logo-art-PLtEZJxU.js";var nt=Object.defineProperty,ot=Object.getOwnPropertyDescriptor,b=(t,a,s,i)=>{for(var o=i>1?void 0:i?ot(a,s):a,n=t.length-1,c;n>=0;n--)(c=t[n])&&(o=(i?c(a,s,o):c(o))||o);return i&&o&&nt(a,s,o),o};const ft=["all","active","inactive","unavailable"],L={lights:{noun:e("גופי תאורה"),icon:"light",active:e("דולקים"),inactive:e("כבויים"),unavailable:e("לא זמינים"),order:["all","active","inactive","unavailable"],master:{on:"lights_on",off:"lights_off",onLabel:e("הדלק את כל התאורה"),offLabel:e("כבה את כל התאורה")},emptyHint:e("גופי תאורה המשויכים לאזורים יופיעו כאן.")},switches:{noun:e("מתגים"),icon:"bolt",active:e("פעילים"),inactive:e("כבויים"),unavailable:e("לא זמינים"),order:["all","active","inactive","unavailable"],master:{on:"switches_on",off:"switches_off",onLabel:e("הדלק את כל המתגים"),offLabel:e("כבה את כל המתגים")},emptyHint:e("מתגים ודגלים המשויכים לאזורים יופיעו כאן.")},covers:{noun:e("תריסים"),icon:"layers",active:e("פתוחים"),inactive:e("סגורים"),unavailable:e("לא זמינים"),order:["all","active","inactive","unavailable"],master:{open:"covers_open",close:"covers_close",openLabel:e("פתח את כל התריסים"),closeLabel:e("סגור את כל התריסים")},emptyHint:e("תריסים, וילונות ושערים המשויכים לאזורים יופיעו כאן.")},climate:{noun:e("התקני מיזוג"),icon:"activity",active:e("פעילים"),inactive:e("כבויים"),unavailable:e("לא זמינים"),order:["all","active","inactive","unavailable"],emptyHint:e("מזגנים, תרמוסטטים, מאווררים ומייבשים יופיעו כאן.")},heating:{noun:e("התקני חימום"),icon:"activity",active:e("פעילים"),inactive:e("כבויים"),unavailable:e("לא זמינים"),order:["all","active","inactive","unavailable"],emptyHint:e("תרמוסטטים, משאבות חום וחימום תת־רצפתי יופיעו כאן.")},media:{noun:e("מסכים ונגנים"),icon:"play",active:e("דולקים"),inactive:e("כבויים"),unavailable:e("לא זמינים"),order:["all","active","inactive","unavailable"],master:{on:"screens_on",off:"screens_off",onLabel:e("הדלק את כל המסכים"),offLabel:e("כבה את כל המסכים")},emptyHint:e("טלוויזיות, מקרנים ורמקולים יופיעו כאן.")},locks:{noun:e("מנעולים"),icon:"lock",active:e("נעולים"),inactive:e("לא נעולים"),unavailable:e("לא זמינים"),order:["all","inactive","active","unavailable"],emptyHint:e("מנעולים המשויכים לאזורים יופיעו כאן.")},alarm:{noun:e("לוחות אזעקה"),icon:"shield",active:e("דרוכים"),inactive:e("מנוטרלים"),unavailable:e("לא זמינים"),order:["all","active","inactive","unavailable"],emptyHint:e("לוח אזעקה המשויך לאזור יופיע כאן.")}},lt={building:e("במבנה"),floor:e("בקומה"),area:e("באזור")},I=(t,a)=>t==="floor"?e("בקומה {name}",{name:a}):t==="area"?e("באזור {name}",{name:a}):`${lt[t]} ${a}`;function _(t){return!t.available||t.state==="unavailable"||t.state===null?"unavailable":t.kind==="alarm"?t.armed?"active":"inactive":t.active?"active":"inactive"}function rt(t,a,s){return a==="alarm"?e("דריכה וניטרול נעשים במסך האזעקה"):t.alarm_managed?t.managed_label??e("נשלט ממסך האזעקה"):s?e("נתוני הדגמה - אין שליטה בהתקנים"):_(t)==="unavailable"?e("ההתקן לא זמין כרגע"):t.door_class?e("דלת / שער - תנועה של מעבר, לקריאה בלבד כאן"):t.can_control?t.domain==="humidifier"&&!(t.available_modes?.length||t.target_humidity!==null&&t.target_humidity!==void 0)?e("המייבש אינו מדווח על מצבים או יעד לחות"):"":a==="locks"?e("שליטה במנעולים דורשת הרשאת שליטה בישויות"):e("אין לך הרשאת שליטה בהתקן הזה")}function m(t,a,s,i,o={}){const n=t.split(".")[0],c=["on","open","cool","playing","locked"].includes(i);return{entity_id:t,name:a,domain:n,device_class:null,state:i,available:!0,fresh:!0,active:c,icon:null,last_changed:"2026-09-14T07:05:00Z",can_control:!1,area_id:s[0],area_name:s[1],floor_id:s[2],floor_name:s[3],...o}}const y=["lobby","לובי","ground","קרקע"],C=["kitchen","מטבח","ground","קרקע"],M=["office","משרד","first","קומה 1"],T={lights:[m("light.lobby_1","תאורת לובי",y,"on",{brightness_pct:80}),m("light.lobby_2","ספוט כניסה",y,"on",{brightness_pct:40}),m("light.lobby_3","תאורת קבלה",y,"on"),m("light.lobby_4","תאורת מסדרון לובי ארוך במיוחד",y,"off"),m("light.kitchen_1","תאורת מטבח",C,"off"),m("light.kitchen_2","פס לד מטבח",C,"off"),m("light.office_1","תאורת משרד",M,"off"),m("light.office_2","מנורת שולחן",M,"off"),m("light.office_3","תאורת חלון",M,"unavailable",{available:!1})],switches:[m("switch.lobby_sign","שלט מואר",y,"on"),m("switch.kitchen_boiler","דוד מים",C,"off"),m("switch.loose","מתג ללא אזור",["unassigned","ללא שיוך","unassigned","ללא שיוך"],"off")],covers:[m("cover.lobby","תריס לובי",y,"open",{position:70}),m("cover.kitchen","תריס מטבח",C,"closed",{position:0}),m("cover.office_1","תריס משרד",M,"open",{position:100}),m("cover.office_2","וילון משרד",M,"open",{position:40})],climate:[m("climate.lobby","מזגן לובי",y,"cool",{hvac_mode:"cool",current_temperature:24.5,target_temperature:22})],heating:[],media:[m("media_player.kitchen_tv","מסך מטבח",C,"off")],locks:[m("lock.lobby_door","דלת ראשית",y,"locked",{kind:"lock",locked:!0})],alarm:[m("alarm_control_panel.house","אזעקת הבניין",y,"armed_home",{kind:"alarm",armed:!0})]};function ct(t,a,s,i,o="typed"){const c=(t==="lights"&&o==="all"?[...T.lights,...T.switches.filter(u=>u.domain==="switch")]:T[t]).filter(u=>a==="building"||(a==="floor"?u.floor_id===s:u.area_id===s)),p=[];for(const u of c){let w=p.find(v=>v.floor_id===u.floor_id);w||p.push(w={floor_id:u.floor_id??"",name:u.floor_name??"",level:null,areas:[]});let l=w.areas.find(v=>v.area_id===u.area_id);l||w.areas.push(l={area_id:u.area_id,name:u.area_name,items:[]}),l.items.push(u)}const f=u=>c.filter(w=>_(w)===u).length;return{kind:t,scope:a,id:s,name:i,floor_name:null,counts:{total:c.length,active:f("active"),inactive:f("inactive"),unavailable:f("unavailable")},floors:p,truncated:!1,scoped:!1,can_bulk:!1}}function dt(t,a=new Date){const s=new Date(t);if(Number.isNaN(s.getTime()))return"";const i=Z(s);return s.toDateString()===a.toDateString()?e("השתנה ב־{time}",{time:i}):e("השתנה ב־{date} {time}",{date:G(s),time:i})}const ut=1e3;function A(t){const a=typeof t=="number"?t:typeof t=="string"&&t.trim()?Number(t):NaN;return Number.isFinite(a)?a:null}function ht(t,a){const s=a.state,i=a.attributes??{},o={...t,state:s,available:a.available,last_changed:a.last_changed??t.last_changed,active:J(t.domain,s)};if(t.domain==="light"){const n=A(i.brightness);o.brightness_pct=s==="on"&&n!==null?Math.max(0,Math.min(100,Math.round(n*100/255))):null}else if(t.domain==="cover")o.position=A(i.current_position),o.tilt=A(i.current_tilt_position),o.moving=s==="opening"||s==="closing";else if(t.domain==="climate")o.hvac_mode=s&&s!=="unavailable"&&s!=="unknown"?s:null,o.hvac_action=typeof i.hvac_action=="string"?i.hvac_action:null,o.current_temperature=A(i.current_temperature),o.target_temperature=A(i.temperature);else if(t.domain==="media_player"){const n=A(i.volume_level);o.volume_pct=n===null?null:Math.round(n*100),o.muted=typeof i.is_volume_muted=="boolean"?i.is_volume_muted:null}else t.domain==="lock"?o.locked=s==="locked":t.domain==="alarm_control_panel"&&(o.armed=!["disarmed","unavailable","unknown",null].includes(s));return o}let h=class extends O{constructor(){super(...arguments),this.open=!1,this.kind="lights",this.scope="building",this.scopeId="",this.scopeName=e("המבנה"),this.filter="all",this.areaFilter=null,this.switches="typed",this.pairedMaster=!1,this.headingText="",this.building="",this.bulkHold="",this.data=null,this.error="",this.notFound=!1,this.q="",this.why=null,this.unlocking=null,this.lockAll=null,this.ctl=new F(this,()=>this.changed()),this.press=new N(this),this.stop=null,this.timer=0,this.loading=!1,this.again=!1,this.ids=new Set,this.onDrawerClose=t=>{t.target===t.currentTarget&&this.close()}}willUpdate(t){t.has("building")&&(this.ctl.building=this.building),(t.has("open")||t.has("kind")||t.has("scope")||t.has("scopeId")||t.has("switches")||t.has("building"))&&this.open&&((t.has("kind")||t.has("scope")||t.has("scopeId")||t.has("switches")||t.has("building")||!this.data)&&(this.data=null,this.q="",this.why=null),this.error="",this.notFound=!1,this.load()),t.has("open")&&(this.open?this.listen():this.unlisten())}disconnectedCallback(){super.disconnectedCallback(),this.unlisten()}listen(){this.stop||!z()||(this.stop=R(t=>{if(t.type==="entity_state_changed"){const a=t.entity.entity_id;this.ids.has(a)?this.patch(t.entity):this.domains().includes(a.split(".")[0])&&this.schedule()}else(t.type==="structure_changed"||t.type==="ha_sync_state")&&this.schedule()},t=>{t&&this.schedule()}))}unlisten(){this.stop?.(),this.stop=null,window.clearTimeout(this.timer),this.timer=0}patch(t){const a=this.data;if(!a)return;const s=a.floors.map(n=>({...n,areas:n.areas.map(c=>({...c,items:c.items.map(p=>p.entity_id===t.entity_id?ht(p,t):p)}))})),i=s.flatMap(n=>n.areas.flatMap(c=>c.items)),o=n=>i.filter(c=>_(c)===n).length;this.data=a.truncated?{...a,floors:s}:{...a,floors:s,counts:{total:i.length,active:o("active"),inactive:o("inactive"),unavailable:o("unavailable")}}}changed(){this.schedule(),this.dispatchEvent(new CustomEvent("panel-changed",{bubbles:!0,composed:!0}))}domains(){return{lights:this.switches==="all"?["light","switch"]:["light"],switches:["switch","input_boolean"],covers:["cover"],climate:["climate","fan","humidifier"],heating:["climate"],media:["media_player"],locks:["lock"],alarm:["alarm_control_panel"]}[this.kind]}schedule(){this.timer||(this.timer=window.setTimeout(()=>{this.timer=0,this.load()},ut))}async load(){if(!z()){this.data=ct(this.kind,this.scope,this.scopeId,this.scopeName,this.switches);return}if(this.loading){this.again=!0;return}this.loading=!0;const t=`${this.kind}|${this.scope}|${this.scopeId}|${this.switches}|${this.building}`;try{const a=await P(this.kind,this.scope,this.scopeId,this.switches,this.building);if(t!==`${this.kind}|${this.scope}|${this.scopeId}|${this.switches}|${this.building}`)return;this.data=a,this.ids=new Set(a.floors.flatMap(s=>s.areas.flatMap(i=>i.items.map(o=>o.entity_id)))),this.error=""}catch(a){a instanceof H&&a.status===404?this.notFound=!0:this.error=a instanceof H&&a.status===403?e("אין לך הרשאת צפייה בחשמל והתקנים."):q(a)}finally{this.loading=!1,this.again&&(this.again=!1,this.load())}}close(){this.open=!1,this.unlocking=null,this.dispatchEvent(new CustomEvent("panel-close",{bubbles:!0,composed:!0}))}setFilter(t){this.filter=t,this.dispatchEvent(new CustomEvent("panel-filter",{detail:t,bubbles:!0,composed:!0}))}get bulkDialog(){return this.renderRoot.querySelector("devices-bulk-dialog")}view(){const t=this.data;if(!t||!this.areaFilter)return t;const a=new Set(this.areaFilter),s=t.floors.map(n=>({...n,areas:n.areas.filter(c=>a.has(c.area_id))})).filter(n=>n.areas.length),i=s.flatMap(n=>n.areas.flatMap(c=>c.items)),o=n=>i.filter(c=>_(c)===n).length;return{...t,floors:s,counts:{total:i.length,active:o("active"),inactive:o("inactive"),unavailable:o("unavailable")}}}buildingWord(){return this.building&&this.data?.name?e("ב{name}",{name:this.data.name}):e("במבנה")}heading(){if(this.headingText)return this.headingText;const t=L[this.kind],a=this.scope==="building"?this.buildingWord():I(this.scope,this.data?.name??this.scopeName);return`${t.noun} ${a}`}subheading(){const t=this.view();if(!t)return"";const a=L[this.kind],s=t.counts;return`${k(s.total)} ${a.noun} · ${k(s.active)} ${a.active}${s.unavailable?` · ${k(s.unavailable)} ${a.unavailable}`:""}`}render(){return r`<sw-drawer modal ?open=${this.open} heading=${this.heading()} subheading=${this.subheading()} data-tiles-panel=${this.kind} data-scope=${this.scope} @close=${this.onDrawerClose}>
      ${this.open?this.renderBody():d}
    </sw-drawer>`}renderBody(){const t=L[this.kind];if(this.notFound)return r`<sw-state-panel icon="grid" data-panel-state="not_found" state="empty" heading=${e("הקומה או האזור לא נמצאו")} hint=${e("ייתכן שהמבנה השתנה, או שאין בהם התקנים שבהרשאתך.")}></sw-state-panel>`;if(!this.data)return this.error?r`<sw-state-panel data-panel-state="error" state="error" heading=${e("לא ניתן לטעון את הרשימה")} hint=${this.error} actionLabel=${e("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel>`:r`<sw-state-panel state="loading"></sw-state-panel>`;const a=this.view(),s=a.counts,i={all:s.total,active:s.active,inactive:s.inactive,unavailable:s.unavailable},o={all:e("הכול"),active:t.active,inactive:t.inactive,unavailable:t.unavailable},n=this.q.trim().toLowerCase(),c=l=>(this.filter==="all"||_(l)===this.filter)&&(!n||`${l.name} ${l.area_name} ${l.floor_name??""} ${l.entity_id}`.toLowerCase().includes(n)),p=a.floors.map(l=>({...l,areas:l.areas.map(v=>({...v,items:v.items.filter(c)})).filter(v=>v.items.length)})).filter(l=>l.areas.length),f=z()&&!!t.master&&a.can_bulk===!0&&B("devices.control_bulk"),u=p.flatMap(l=>l.areas.flatMap(v=>v.items)),w=this.filter!=="all"||!!n||!!this.areaFilter;return r`<div class="top">
        ${this.kind==="alarm"?r`<a class="alarm-link" href="#/security/alarm" data-alarm-link @click=${l=>this.navigateAway(l,"/security/alarm")}><sw-icon name="shield" size=${15}></sw-icon>${e("פתח במסך האזעקה")} ‹</a>`:d}
        <div class="ctlbar">
          <div class="seg" role="group" aria-label=${e("סינון")}>
            ${t.order.map(l=>r`<button type="button" data-filter=${l} aria-pressed=${String(this.filter===l)} @click=${()=>this.setFilter(l)}>${o[l]} <span>(${k(i[l])})</span></button>`)}
          </div>
          ${f&&this.bulkHold?this.renderHeld():f?this.renderMaster(u,w,this.headingText?this.scopeName:a.name):this.pairedMaster&&t.master&&"on"in t.master?this.renderPairedOff():d}
          ${this.kind==="locks"?this.renderLockAllButton(u):d}
        </div>
        <label class="search"><sw-icon name="search" size=${14}></sw-icon><input type="search" data-panel-search placeholder=${e("חיפוש ב{noun}…",{noun:t.noun})} aria-label=${e("חיפוש ב{noun}",{noun:t.noun})} .value=${this.q} @input=${l=>this.q=l.target.value} /></label>
      </div>
      ${s.total?p.length?E(p,l=>l.floor_id,l=>r`<section class="floor" data-panel-floor=${l.floor_id}>
                ${a.scope!=="area"?r`<h4>${$(l.name)}</h4>`:d}
                ${E(l.areas,v=>v.area_id,v=>r`<div class="area" data-panel-area=${v.area_id}>
                    ${a.scope!=="area"?r`<h5><sw-icon name="home" size=${12}></sw-icon>${$(v.name)}</h5>`:d}
                    ${E(v.items,D=>D.entity_id,D=>this.renderRow(D))}
                  </div>`)}
              </section>`):r`<sw-state-panel icon="filter" data-panel-state="no_match" state="empty" heading=${e("אין פריטים שמתאימים לסינון")} hint=${n?e('נסו חיפוש אחר, או בחרו "הכול".'):e('בחרו "הכול" כדי לראות את כל הפריטים.')}></sw-state-panel>`:r`<sw-state-panel icon="grid" data-panel-state="empty" state="empty" heading=${e("אין {noun} {where}",{noun:t.noun,where:this.scope==="building"?this.buildingWord():I(this.scope,a.name)})} hint=${a.scoped?e("רק התקנים שהוצבו במפה של הקומות שבהרשאתך מופיעים כאן."):t.emptyHint}></sw-state-panel>`}
      ${a.truncated?r`<div class="note" data-panel-truncated>${e("מוצגים 500 פריטים מתוך {total}; צמצמו בעזרת הסינון, החיפוש או קומה אחת.",{total:k(s.total)})}</div>`:d}
      ${f?r`<devices-bulk-dialog .building=${this.building} @bulk-done=${()=>this.changed()}></devices-bulk-dialog>`:d}
      ${this.kind==="locks"?r`${this.renderUnlockDialog()}${this.renderLockAllDialog()}`:d}`}renderMaster(t,a,s){const i=L[this.kind].master,o=a?t.map(l=>l.entity_id):void 0,n=t.filter(l=>_(l)!=="unavailable"&&l.can_control&&!l.bulk_excluded),c=n.filter(l=>_(l)==="active").length,p=this.kind==="switches"?e("כל המתגים כאן מוגנים מפעולה קבוצתית - הגדרות ‹ חשמל והתקנים"):e("אין כאן התקנים שאושרו לפעולה קבוצתית - הגדרות ‹ חשמל"),f=l=>void this.bulkDialog?.show({scope:this.scope,id:this.scope==="building"?"*":this.scopeId,name:s,kind:l,only:o,...this.kind==="lights"&&this.switches==="all"?{switches:"all"}:{}});if("open"in i)return r`<div class="master-group" data-panel-master="covers">
        <button type="button" class="master" data-master=${i.open} aria-label=${n.length?i.openLabel:p} title=${n.length?i.openLabel:p} ?disabled=${!n.length} @click=${()=>f(i.open)}><sw-icon name="coverOpen" size=${20}></sw-icon></button>
        <button type="button" class="master" data-master=${i.close} aria-label=${n.length?i.closeLabel:p} title=${n.length?i.closeLabel:p} ?disabled=${!n.length} @click=${()=>f(i.close)}><sw-icon name="coverClose" size=${20}></sw-icon></button>
      </div>`;if(this.pairedMaster){const l=n.length-c;return r`<div class="master-group paired" data-panel-master=${this.kind} data-paired>
        <sw-button size="sm" icon="power" data-master=${i.on} ?disabled=${!n.length||!l} title=${n.length?i.onLabel:p} @click=${()=>f(i.on)}>${e("הדלק הכל")}</sw-button>
        <sw-button size="sm" icon="power" variant="ghost" data-master=${i.off} ?disabled=${!n.length||!c} title=${n.length?i.offLabel:p} @click=${()=>f(i.off)}>${e("כבה הכל")}</sw-button>
      </div>`}const u=c===0?"off":c===n.length?"on":"mixed",w=n.length?c?i.offLabel:i.onLabel:p;return r`<button type="button" class="master" data-panel-master=${this.kind} data-master=${c?i.off:i.on} data-state=${u} aria-pressed=${String(c>0)}
      aria-label=${u==="mixed"?`${w} (${e("{on} מתוך {total} פעילים",{on:c,total:n.length})})`:w} title=${w} ?disabled=${!n.length} @click=${()=>f(c?i.off:i.on)}>
      <sw-icon name="power" size=${20}></sw-icon>${u==="mixed"?r`<span class="badge" data-master-badge aria-hidden="true">${k(c)}</span>`:d}
    </button>`}renderHeld(){return r`<button type="button" class="master" data-panel-master=${this.kind} data-panel-held aria-label=${this.bulkHold} title=${this.bulkHold} disabled><sw-icon name="power" size=${20}></sw-icon></button>`}renderPairedOff(){const t=z()?e("אין לך הרשאה לפעולות מרוכזות בהיקף הזה"):e("נתוני הדגמה - אין שליטה בהתקנים");return r`<div class="master-group paired" data-panel-master=${this.kind} data-paired data-paired-off>
      <sw-button size="sm" icon="power" disabled title=${t} data-master="lights_on">${e("הדלק הכל")}</sw-button>
      <sw-button size="sm" icon="power" variant="ghost" disabled title=${t} data-master="lights_off">${e("כבה הכל")}</sw-button>
    </div>`}navigateAway(t,a,s){t.preventDefault(),this.open=!1,this.dispatchEvent(new CustomEvent("panel-navigate",{detail:{path:a,params:s},bubbles:!0,composed:!0}))}renderLockAllButton(t){const a=t.filter(n=>n.can_control&&_(n)!=="unavailable");if(!z()||!a.length)return d;const{sendable:s,skipped:i}=at(a),o=e("נעל את כל המנעולים");return r`<button type="button" class="master" data-panel-master="locks" data-master="lock_all" aria-label=${s.length?`${o} (${e("{n} לא נעולים",{n:s.length})})`:`${o} - ${e("כולם נעולים")}`} title=${o} ?disabled=${!s.length&&!i.length}
      @click=${()=>this.lockAll={rows:s,skipped:i,step:"confirm",out:{}}}>
      <sw-icon name="lock" size=${20}></sw-icon>${s.length?r`<span class="badge" aria-hidden="true">${k(s.length)}</span>`:d}
    </button>`}async runLockAll(){const t=this.lockAll;if(!(!t||t.step!=="confirm")){this.lockAll={...t,step:"running"};for(const a of t.rows){if(a.wiskey_door)continue;const s=`${a.entity_id}:lock`;await j(s,"lock",a.entity_id,"lock.lock",{},"locked",i=>{this.ctl.setCmd(s,i),this.lockAll&&(this.lockAll={...this.lockAll,out:{...this.lockAll.out,[a.entity_id]:i.phase}})},{label:e("נעילה"),building:this.building})}this.lockAll&&(this.lockAll={...this.lockAll,step:"done"}),this.changed()}}renderLockAllDialog(){const t=this.lockAll;if(!t)return r`<sw-dialog data-lock-all-dialog="closed"></sw-dialog>`;const a={pending:e("ממתין לאישור"),confirmed:e("ננעל"),sent:e("נשלח"),rolled_back:e("לא ננעל")},s=Object.values(t.out).filter(i=>i==="confirmed").length;return r`<sw-dialog open ?locked=${t.step==="running"} data-lock-all-dialog=${t.step} heading=${e("נעילת מנעולים")} subheading=${e("כל מנעול ננעל בפעולה נפרדת, אחד אחרי השני")} @close=${()=>t.step!=="running"&&(this.lockAll=null)}>
      <div class="unlock-what" data-lock-all-question>${t.step==="confirm"?it(t.rows.length,t.skipped.length):e("ננעלו {done} מתוך {total}",{done:s,total:t.rows.length})}</div>
      ${t.skipped.length?r`<div class="unlock-what" data-lock-all-skipped role="note">${st(t.skipped.length)}<ul class="la-list">${t.skipped.map(i=>r`<li data-lock-all-item=${i.entity_id} data-outcome="not_relevant">${$(i.name)} <span class="note">· ${$(i.area_name)} · ${e("לא רלוונטי")}</span></li>`)}</ul></div>`:d}
      <details ?open=${t.step!=="confirm"}><summary>${e("רשימת המנעולים")}</summary>
        <ul class="la-list">${t.rows.map(i=>r`<li data-lock-all-item=${i.entity_id} data-outcome=${t.out[i.entity_id]??""}>${$(i.name)} <span class="note">· ${$(i.area_name)}${t.out[i.entity_id]?` · ${a[t.out[i.entity_id]]}`:""}</span></li>`)}</ul>
      </details>
      <div class="unlock-actions">
        ${t.step==="confirm"?r`<sw-button data-lock-all-cancel autofocus @click=${()=>this.lockAll=null}>${e("ביטול")}</sw-button>
              ${t.rows.length?r`<sw-button data-lock-all-confirm variant="primary" icon="lock" @click=${()=>void this.runLockAll()}>${e("נעל ({n})",{n:k(t.rows.length)})}</sw-button>`:d}`:r`<sw-button data-lock-all-close ?disabled=${t.step==="running"} @click=${()=>this.lockAll=null}>${e("סגור")}</sw-button>`}
      </div>
    </sw-dialog>`}renderRow(t){const a=this.kind==="lights"||this.kind==="switches"?this.ctl.shownRow(t):t,s=_(a),i=rt(a,this.kind,!z()),o=!i,n=s==="active"&&this.kind!=="locks"&&this.kind!=="alarm",c=L[this.kind],p=this.kind==="locks"?a.locked?"lock":"unlock":c.icon,f=this.kind==="alarm"?s==="unavailable"?e("לא זמין"):W[a.state??""]??a.state??e("לא ידוע"):this.kind==="locks"?s==="unavailable"?e("לא זמין"):a.locked?e("נעול"):a.state==="unlocked"?e("לא נעול"):a.state??e("לא ידוע"):(this.kind==="climate"||this.kind==="heating")&&a.domain==="climate"&&s!=="unavailable"?`${S(a)}${a.current_temperature!==null&&a.current_temperature!==void 0?` · ${k(a.current_temperature)}°`:""}${a.target_temperature!==null&&a.target_temperature!==void 0?` · ${e("יעד {temp}°",{temp:k(a.target_temperature)})}`:""}`:S(a),u=this.kind==="lights"||this.kind==="switches",w=this.kind==="lights"&&U(a)&&(n||this.ctl.live(a.entity_id,"power")===!0);return r`<div class=${K({row:!0,on:n,unavailable:s==="unavailable",pending:o&&this.ctl.rowPendingVisible(a.entity_id)})}
      data-entity=${a.entity_id} data-activity=${V(Q(a,f))} data-state=${s} ?data-can-control=${o}>
      <sw-icon .name=${p} size=${16}></sw-icon>
      <div class="txt">
        <div class="nm" title=${a.name}>${$(a.name)}</div>
        <div class="st"><span data-row-state>${f}</span>${a.last_changed?r` · <span class="lc" data-last-changed title=${Y(new Date(a.last_changed),{seconds:!0})}>${dt(a.last_changed)}</span>`:d}</div>
      </div>
      <div class="end">
        ${o&&u?this.ctl.renderPowerToggle(a):d}
        ${o&&this.kind==="locks"?this.ctl.renderLockControls(a,l=>this.unlocking=l):d}
        ${o?d:r`<button type="button" class="ro" data-readonly title=${i} aria-expanded=${String(this.why===a.entity_id)} aria-label=${e("לקריאה בלבד: {reason}",{reason:i})} @click=${()=>this.why=this.why===a.entity_id?null:a.entity_id}><sw-icon name="info" size=${12}></sw-icon>${e("לקריאה בלבד")}</button>`}
      </div>
      ${!o&&this.why===a.entity_id?r`<div class="why" data-readonly-why role="note">${i}</div>`:d}
      ${o&&w?this.ctl.renderBrightnessSlider(a):d}
      ${o&&this.kind==="covers"?this.ctl.renderCoverControls(a):d}
      ${o&&(this.kind==="climate"||this.kind==="heating")?this.ctl.renderClimateControls(a):d}
      ${o&&this.kind==="media"?this.ctl.renderMediaControls(a):d}
      ${o?this.ctl.renderCmdStatus(a.entity_id):d}
    </div>`}renderUnlockDialog(){const t=this.unlocking;return t?r`<sw-dialog open data-unlock-dialog="open" heading=${e("פתיחת מנעול")} subheading=${`${t.name} · ${t.area_name}`} @close=${()=>this.unlocking=null}>
      <div class="unlock-what">${e("לפתוח את")} <b>${$(t.name)}</b> (${$(t.area_name)})? ${e("הדלת תישאר לא נעולה עד שתינעל שוב.")}</div>
      <div class="unlock-actions">
        <sw-button data-unlock-cancel autofocus @click=${()=>this.unlocking=null}>${e("ביטול")}</sw-button>
        <sw-button data-unlock-confirm variant="danger" icon="unlock" @click=${()=>{const a=this.unlocking;this.unlocking=null,a&&this.ctl.runUnlock(a)}}>${e("פתח את המנעול")}</sw-button>
      </div>
    </sw-dialog>`:r`<sw-dialog data-unlock-dialog="closed"></sw-dialog>`}};h.styles=[X,tt`
      :host {
        display: contents;
      }
      .top {
        display: flex;
        flex-direction: column;
        gap: 10px;
        position: sticky;
        inset-block-start: -14px;
        z-index: 2;
        margin-block: -14px 0;
        padding-block: 14px 8px;
        background: var(--dv-surface-solid, var(--sw-surface));
      }
      .seg {
        display: flex;
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-md);
        overflow: hidden;
      }
      /* R5-DEVICES-297: the filter segment reads at the base size, 40 px high; a press sinks the key */
      .seg button {
        flex: 1;
        min-inline-size: 0;
        min-block-size: 40px;
        border: 0;
        padding: 4px 6px;
        background: var(--sw-surface);
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-base);
        font-weight: var(--sw-fw-semibold);
        cursor: pointer;
        font-variant-numeric: tabular-nums;
        line-height: 1.2;
        transition: transform var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease);
      }
      .seg button:active {
        transform: scale(var(--sw-press-scale, 1));
      }
      .seg button + button {
        border-inline-start: 1px solid var(--sw-border-strong);
      }
      @media (hover: hover) and (pointer: fine) {
        .seg button:hover {
          background: var(--sw-hover-wash);
        }
      }
      .seg button[aria-pressed='true'] {
        background: var(--sw-accent);
        color: var(--sw-text-inverse);
        font-weight: var(--sw-fw-bold);
      }
      .seg button:focus-visible,
      .search input:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: -2px;
      }
      .search {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-inline: 10px;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        color: var(--sw-text-3);
      }
      .search input {
        flex: 1;
        min-inline-size: 0;
        min-block-size: 36px;
        border: 0;
        background: transparent;
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        outline: none;
      }
      .ctlbar {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ctlbar .seg {
        flex: 1;
        min-inline-size: 0;
      }
      .master-group {
        display: flex;
        gap: 6px;
      }
      /* the master control: an icon-only 44 px button; filled = something is on (a press turns all off) */
      button.master {
        position: relative;
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 44px;
        block-size: 44px;
        padding: 0;
        border: 2px solid var(--sw-accent);
        border-radius: 50%;
        background: transparent;
        color: var(--sw-accent);
        cursor: pointer;
        box-shadow: var(--sw-shadow-1);
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      button.master:active:not(:disabled) {
        transform: scale(var(--sw-press-scale, 1));
      }
      button.master[data-state='on'],
      button.master[data-state='mixed'] {
        background: var(--sw-accent);
        color: var(--sw-text-inverse);
        box-shadow: var(--sw-shadow-primary, var(--sw-shadow-1));
      }
      button.master:disabled {
        opacity: 0.4;
        cursor: default;
      }
      button.master:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: 2px;
      }
      button.master .badge {
        position: absolute;
        inset-block-start: -4px;
        inset-inline-end: -4px;
        min-inline-size: 18px;
        block-size: 18px;
        padding-inline: 4px;
        box-sizing: border-box;
        border-radius: 999px;
        background: var(--sw-warning);
        color: var(--sw-text);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-bold);
        line-height: 18px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .la-list {
        margin: 4px 0 0;
        padding-inline-start: 18px;
        max-block-size: 180px;
        overflow: auto;
        font-size: var(--sw-fs-sm);
      }
      .note {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      a.alarm-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 36px;
        color: var(--sw-accent-text, var(--sw-accent));
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-medium);
        text-decoration: none;
      }
      a.alarm-link:hover {
        text-decoration: underline;
      }
      .floor {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      /* R5-DEVICES-297: the floor is a heading, the area a sub-heading; rows are wells (no outline), a lit row a full lit field */
      .floor > h4 {
        margin: 10px 0 0;
        font-size: var(--sw-fs-lg);
        font-weight: var(--sw-fw-bold);
        color: var(--sw-heading, var(--sw-text));
        letter-spacing: -0.01em;
      }
      .area {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .area > h5 {
        margin: 4px 0 0;
        font-size: var(--sw-fs-base);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text-2);
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 4px 10px;
        min-block-size: 50px;
        padding: 8px 12px;
        border: 1px solid transparent;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
      }
      .row.on {
        background: var(--sw-lit-soft, var(--sw-warning-soft));
      }
      .row.on .nm {
        font-weight: var(--sw-fw-bold);
        color: var(--sw-heading, var(--sw-text));
      }
      /* HOME polish (2026-10-10): a row's state change fades in; still under reduced motion */
      @media (prefers-reduced-motion: no-preference) {
        .row,
        .row > sw-icon,
        button.master {
          transition: background-color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-state) var(--sw-ease), color var(--sw-t-state) var(--sw-ease), opacity var(--sw-t-state) var(--sw-ease);
        }
      }
      .row.unavailable {
        opacity: 0.65;
      }
      .row > sw-icon {
        color: var(--sw-text-3);
      }
      .row.on > sw-icon {
        color: var(--sw-warning);
      }
      .row .txt {
        min-inline-size: 0;
      }
      .row .nm {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
        overflow-wrap: anywhere;
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-md);
        line-height: 1.3;
      }
      .row .st {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
      }
      .row .lc {
        color: var(--sw-text-3);
      }
      .row .end {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      button.ro {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-block-size: 32px;
        padding: 2px 8px;
        border: 1px dashed var(--sw-border-strong);
        border-radius: 999px;
        background: transparent;
        color: var(--sw-text-3);
        font: inherit;
        font-size: var(--sw-fs-xs);
        cursor: help;
        white-space: nowrap;
      }
      .why {
        grid-column: 1 / -1;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-2);
        background: var(--sw-surface-2);
        border-radius: var(--sw-r-sm);
        padding: 4px 8px;
      }
      .unlock-what {
        font-size: var(--sw-fs-sm);
      }
      .unlock-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-block-start: 8px;
      }
      /* touch: every control a 44 px target */
      @media (max-width: 767px), (pointer: coarse) {
        .seg button,
        .search input {
          min-block-size: 44px;
        }
        .row sw-button {
          min-block-size: 44px;
        }
        .row sw-toggle {
          min-block-size: 44px;
          min-inline-size: 52px;
          justify-content: center;
        }
        .row input[type='range'].ctl-range {
          block-size: 44px;
        }
        .row .ctl-select {
          min-block-size: 44px;
        }
        button.ro,
        a.alarm-link {
          min-block-size: 44px;
        }
      }
    `];b([g({type:Boolean,reflect:!0})],h.prototype,"open",2);b([g()],h.prototype,"kind",2);b([g()],h.prototype,"scope",2);b([g()],h.prototype,"scopeId",2);b([g()],h.prototype,"scopeName",2);b([g()],h.prototype,"filter",2);b([g({attribute:!1})],h.prototype,"areaFilter",2);b([g()],h.prototype,"switches",2);b([g({type:Boolean})],h.prototype,"pairedMaster",2);b([g()],h.prototype,"headingText",2);b([g({attribute:!1})],h.prototype,"building",2);b([g({attribute:!1})],h.prototype,"bulkHold",2);b([x()],h.prototype,"data",2);b([x()],h.prototype,"error",2);b([x()],h.prototype,"notFound",2);b([x()],h.prototype,"q",2);b([x()],h.prototype,"why",2);b([x()],h.prototype,"unlocking",2);b([x()],h.prototype,"lockAll",2);h=b([et("devices-tiles-panel")],h);export{h as DevicesTilesPanel,ft as ITEMS_FILTERS,J as activeOf,dt as changedAt};
