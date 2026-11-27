import{a as N,af as v,aM as E,bj as O,bk as P,c as $,q as b,ag as D,bl as W,e as C,bm as K,bn as I,p as j,bh as U,b as n,A as p,u as S,bo as q,bp as H,bq as J,bi as X,j as Y,k as h,m as G}from"./index-DMqYQw_5.js";import"./sw-chip-Dl_Tx0XO.js";import{h as V}from"./access-D6BqCT5u.js";import{t as c,f as z,U as A}from"./wiskey-format-DWUh8OUF.js";import{T as L,p as Z,r as Q,l as ee,t as te,f as F,a as M}from"./tts-default-BLD0Potr.js";import{t}from"./wiskey-2fGWzHXe.js";import"./sw-logo-art-PLtEZJxU.js";var se=Object.defineProperty,ae=Object.getOwnPropertyDescriptor,d=(e,s,a,i)=>{for(var u=i>1?void 0:i?ae(s,a):s,g=e.length-1,l;g>=0;g--)(l=e[g])&&(u=(i?l(s,a,u):l(u))||u);return i&&u&&se(s,a,u),u};const k=12,ie=3e4,ne=6e4,re={offline:t("העמדה אינה מחוברת - אין תמונה עדכנית"),unavailable:t("אין תמונה מהמצלמה כרגע"),no_credentials:t("לא הוגדרו פרטי גישה למצלמות העמדות (הגדרות ה־Add-on)"),no_host:t("WisKey לא מסר את כתובת העמדה, ולכן אין ממנה תמונה"),no_media:t("שרת המדיה לא הוגדר, ולכן אין תמונות מצלמה")},oe=4e3,le=500,de=7e4;function ce(e){const s=e instanceof $?Number(e.body?.details?.retry_after_s):NaN;return Number.isFinite(s)&&s>=0?Math.ceil(s*1e3):de}const y=500,T={answer:t("מענה"),reject:t("דחייה"),hangUp:t("סיום שיחה")};function _(e){return X(e)!=="unknown"?{tone:"err",text:b(e),unknown:!1}:{tone:"warn",text:e instanceof $&&e.body?.details?.outcome==="unknown"?t("לא ידוע אם הפקודה בוצעה: {message}",{message:e.message}):t("לא ידוע אם הפקודה בוצעה: לא התקבלה תשובה ברורה מהשרת ({error}). בדקו במצלמה או במקום לפני שמנסים שוב.",{error:b(e)}),unknown:!0}}function he(e){const s=e.acknowledged===!0?t("העמדה אישרה קבלה"):t("לא התקבל אישור קבלה מהעמדה"),a=e.observation==="unavailable"||!e.observed_state?t("מצב השיחה אחרי הפקודה לא נקרא"):`${t("מצב שנצפה אחרי הפקודה: {state}",{state:c(e.observed_state)})}${e.observation==="unchanged"?` (${t("לא השתנה")})`:""}`;return`${t("{command} נשלח",{command:T[e.command]??e.command})} · ${s} · ${a}`}const ge={connection_lost:t("החיבור לתשתית המערכת נותק"),tts_cancelled:t("בוטלה"),tts_generation_timeout:t("ההקראה לא הוכנה בזמן"),tts_generation_failed:t("מנוע ההקראה נכשל"),tts_audio_too_long:t("ההקראה ארוכה מדי"),tts_playback_failed:t("ההשמעה בעמדה נכשלה"),audio_busy:t("ערוץ השמע של העמדה תפוס")};function pe(e){switch(e.state){case"started":return t("הכרזה: נשלחה ל־WisKey");case"generating":return t("הכרזה: מכינה את ההקראה…");case"speaking":return t("הכרזה: מושמעת בעמדה…");case"completed":return t("הכרזה: WisKey סיים להשמיע אותה. אין אישור שנשמעה בפועל.");default:return t("הכרזה: נעצרה ({reason})",{reason:ge[e.reason??""]??e.reason??t("ללא סיבה")})}}function R(e,s){return e.locks.length>1?s.name||t("מנעול {n}",{n:s.physical_index}):""}const ue={version:"demo",api_version:1,default_zone:{kind:"iana",name:"Asia/Jerusalem"},stations:[{id:"d1",name:"שער ראשי",online:!0,call_state:"ringing",sync_state:"synced",lock_enabled:!0,lock_count:1,locks:[{physical_index:1,name:null}],has_camera:!0,camera_entity:null,last_error:null,last_seen:"2026-09-27T08:00:00+03:00",zone:{kind:"iana",name:"Asia/Jerusalem"}},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,lock_count:2,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!0,camera_entity:null,last_error:null,last_seen:"2026-09-27T08:00:00+03:00",zone:{kind:"iana",name:"Asia/Jerusalem"}},{id:"d3",name:"חניון",online:!0,call_state:"idle",sync_state:"pending",lock_enabled:!1,lock_count:0,locks:[],has_camera:!0,camera_entity:null,last_error:null,last_seen:"2026-09-27T08:00:00+03:00",zone:{kind:"iana",name:"Asia/Jerusalem"}},{id:"d4",name:"מחסן",online:!1,call_state:"unavailable",sync_state:"offline",lock_enabled:!0,lock_count:1,locks:[{physical_index:1,name:null}],has_camera:!1,camera_entity:null,last_error:null,last_seen:"2026-09-26T19:02:00+03:00",zone:null}]},B={ha_not_configured:{panel:"stale",heading:t("WisKey אינו מחובר בסביבה הזו"),hint:t("ל־Arx אין כאן גישה לתשתית המערכת, ולכן אין נתוני אינטרקום להצגה. במערכת המותקנת המסך מתחבר לאינטגרציית WisKey (hikvision_intercom) מעצמו.")},connecting:{panel:"loading",heading:t("מתחבר ל־WisKey…"),hint:t("הנתונים יופיעו ברגע שתשתית המערכת תענה.")},ha_unavailable:{panel:"stale",heading:t("תשתית המערכת אינה זמינה כרגע"),hint:t("אין חיבור לתשתית המערכת, ולכן אין נתוני אינטרקום עדכניים. החיבור מתחדש אוטומטית.")},not_installed:{panel:"empty",heading:t("אינטגרציית WisKey אינה מותקנת"),hint:t("תשתית המערכת לא מכירה את הפקודות של WisKey (hikvision_intercom). אחרי התקנה המסך יתחבר אליה מעצמו תוך כמה דקות.")},forbidden:{panel:"forbidden",heading:t("WisKey דחה את הגישה של Arx"),hint:t("המשתמש של המערכת אינו מורשה בהרשאות של WisKey, ולכן אין נתונים להצגה.")},error:{panel:"error",heading:t("WisKey החזיר שגיאה"),hint:t("הבקשה ל־WisKey לא הושלמה. הניסיון יחזור אוטומטית.")}};function we(e,s){const a=e==="ready"?"live":e==="connecting"?"unknown":e==="forbidden"?"forbidden":e==="error"?"error":"offline",i=e==="ready"?`${t("מחובר ל־WisKey")}${s?` ${s}`:""}`:e==="connecting"?t("מתחבר"):t("לא מחובר");return{kind:a,label:i}}let o=class extends N{constructor(){super(...arguments),this.feed=null,this.error="",this.forbidden=!1,this.query="",this.filter="all",this.page=0,this.confirmRelease=null,this.releasing=new Set,this.results={},this.held={},this.callBusy=new Set,this.armed=null,this.holdTimer=0,this.speakFor=null,this.engines=null,this.enginesNote="",this.ttsEngine="",this.ttsLanguage="",this.ttsMessage="",this.ttsBusy=!1,this.ttsError="",this.ttsStatus={},this.ttsFixed=L,this.ttsPreselected="",this.ttsMissingEngine=null,this.ttsMissingLanguage=null,this.enginesAt=0,this.armTimer=0,this.posterBust=Date.now(),this.stillFailed={},this.posterTimer=0,this.cameraAccess={},this.stop=null,this.poll=0,this.loading=!1,this.loadAgain=!1}connectedCallback(){if(super.connectedCallback(),!!v()){if(!E("access.read")){this.forbidden=!0;return}this.load(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.posterBust=Date.now())},ne),this.stop=O(e=>{e.type==="intercom_tts"?this.ttsStatus={...this.ttsStatus,[e.status.station_id]:e.status}:e.type!=="heartbeat"&&this.load()},e=>{this.setPolling(!e),e&&this.load()})}}disconnectedCallback(){super.disconnectedCallback(),this.stop?.(),this.stop=null,this.setPolling(!1),window.clearInterval(this.posterTimer),window.clearTimeout(this.armTimer),window.clearTimeout(this.holdTimer)}setPolling(e){window.clearInterval(this.poll),this.poll=e?window.setInterval(()=>void this.load(),ie):0}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{this.feed=await P(),this.error="",this.dropStaleArm()}catch(e){e instanceof $&&e.status===403?this.forbidden=!0:this.error=b(e)}}while(this.loadAgain)}finally{this.loading=!1}}canAct(){return v()&&D("access.call")}canOpen(e){const s=this.feed?.door_access;return v()&&(s?!!s[e.id]:V(a=>E(a)))}setResult(e,s,a){this.results={...this.results,[e]:{tone:s,text:a}}}isHeld(e){return(this.held[e]??0)>Date.now()}hold(e,s){const a=Date.now()+s;this.held={...this.held,[e]:Math.max(this.held[e]??0,a)},window.clearTimeout(this.holdTimer);const i=Math.min(...Object.values(this.held).filter(u=>u>Date.now()));Number.isFinite(i)&&(this.holdTimer=window.setTimeout(()=>this.held={...this.held},i-Date.now()+50))}askRelease(e,s){const a=`${e.id}/${s.physical_index}`;this.releasing.has(a)||this.isHeld(a)||(this.confirmRelease={station:e,lock:s})}async doRelease(){const e=this.confirmRelease;if(!e)return;const s=`${e.station.id}/${e.lock.physical_index}`;if(!(this.releasing.has(s)||this.isHeld(s))){this.releasing=new Set([...this.releasing,s]);try{await W(e.station.id,e.lock.physical_index);const a=C(new Date,{seconds:!0});this.setResult(e.station.id,"ok",t("הפקודה נשלחה ו־WisKey קיבל אותה ({at}). אין אישור שהדלת נפתחה בפועל - בדקו במצלמה או במקום.",{at:a}))}catch(a){const i=_(a);this.setResult(e.station.id,i.tone,i.text),(i.unknown||a instanceof $&&a.code==="intercom_release_in_progress")&&this.hold(s,ce(a))}finally{const a=new Set(this.releasing);a.delete(s),this.releasing=a,this.confirmRelease===e&&(this.confirmRelease=null)}}}onCall(e,s,a){if(this.callBusy.has(s.id)||this.feed?.state!=="ready"||e.detail>1)return;const i=this.armed;if(i&&i.id===s.id&&i.command===a&&i.callState===s.call_state){if(performance.now()-i.at<le)return;window.clearTimeout(this.armTimer),this.armed=null,this.sendCall(s,a);return}window.clearTimeout(this.armTimer),this.armed={id:s.id,command:a,at:performance.now(),callState:s.call_state},this.armTimer=window.setTimeout(()=>this.armed=null,oe)}dropStaleArm(){const e=this.armed;if(!e)return;const s=this.feed?.overview?.stations.find(a=>a.id===e.id);(this.feed?.state!=="ready"||!s||!s.online||s.call_state!==e.callState)&&(window.clearTimeout(this.armTimer),this.armed=null)}async sendCall(e,s){this.callBusy=new Set([...this.callBusy,e.id]);try{const a=await K(e.id,s);a.call&&this.setResult(e.id,a.call.acknowledged===!0?"ok":"warn",he(a.call))}catch(a){const i=_(a);this.setResult(e.id,i.tone,i.text)}finally{const a=new Set(this.callBusy);a.delete(e.id),this.callBusy=a,this.load()}}openSpeak(e){this.speakFor=e,this.ttsMessage="",this.ttsError="",!this.engines||Date.now()-this.enginesAt>6e4?this.loadEngines():this.applyFixed()}async loadEngines(){this.enginesNote="",this.enginesAt=Date.now();try{const e=await I();e.tts?(this.engines=e.tts,await this.applyFixed(),e.tts.engines.length||(this.enginesNote=t("אין בתשתית המערכת מנוע הקראה (TTS) ש־WisKey יכול להשתמש בו."))):this.enginesNote=e.state==="unsupported"?t("גרסת WisKey המותקנת אינה תומכת בהכרזות."):t("רשימת מנועי ההקראה אינה זמינה כרגע ({reason}).",{reason:e.last_error??e.state})}catch(e){this.enginesNote=b(e)}}async applyFixed(){try{this.ttsFixed=Z(await j())}catch{this.ttsFixed=L}const e=Q(this.engines,this.ttsFixed);this.ttsEngine=e.engine,this.ttsLanguage=e.language,this.ttsPreselected=e.engine,this.ttsMissingEngine=e.missingEngine,this.ttsMissingLanguage=e.missingLanguage}pickEngine(e){this.ttsEngine=e,this.ttsLanguage=ee(this.engines,e,this.ttsFixed),this.ttsMissingLanguage=null}async speak(){const e=this.speakFor,s=this.ttsMessage.split(/\s+/).filter(Boolean).join(" ");if(!(!e||this.ttsBusy||!this.ttsEngine||!s||s.length>y)){this.ttsBusy=!0,this.ttsError="";try{const a=await U(e.id,{engine_id:this.ttsEngine,language:this.ttsLanguage||null,message:s}),i=this.ttsStatus[e.id],u=g=>["started","generating","speaking","completed","closed"].indexOf(g.state);a.tts&&!(i&&i.at>=a.tts.at&&u(i)>u(a.tts))&&(this.ttsStatus={...this.ttsStatus,[e.id]:a.tts}),this.speakFor=null}catch(a){const i=_(a);i.unknown?(this.speakFor=null,this.setResult(e.id,i.tone,i.text)):this.ttsError=i.text}finally{this.ttsBusy=!1}}}render(){return v()?this.forbidden?n`<sw-page heading=${c("wk4_entry_center")}><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading=${t("אין לך הרשאת צפייה בבקרת הכניסה")} hint=${t("נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת.")}></sw-state-panel></sw-page>`:this.feed?this.renderPage(this.feed,!1):n`<sw-page heading=${c("wk4_entry_center")}>${this.error?n`<sw-state-panel data-wiskey-state="load_error" state="error" heading=${t("לא ניתן לטעון את מרכז הכניסה")} hint=${this.error}></sw-state-panel>`:n`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`:this.renderPage({state:"ready",configured:!0,fresh:!0,fetched_at:null,last_error:null,overview:ue},!0)}renderPage(e,s){const a=e.overview;this.cameraAccess=e.camera_access??{};const i=`${c("wk4_entry_intro")}${this.canAct()||Object.values(this.feed?.door_access??{}).some(Boolean)?"":` · ${t("צפייה בלבד")}`}${s?` · ${t("נתוני הדגמה")}`:""}`;return n`<sw-page heading=${c("wk4_entry_center")} subheading=${i} wide>
      ${this.renderFeedBadge(e,s)}
      ${a&&e.state!=="ready"?this.renderStaleNote(e):p}
      ${this.error?n`<div class="note err" role="status">${this.error}</div>`:p}
      ${a?this.renderOverview(a):this.renderFeedPanel(e)}
      ${this.confirmRelease?this.renderReleaseConfirm():p}
      ${this.speakFor?this.renderSpeak():p}
    </sw-page>`}renderReleaseConfirm(){const{station:e,lock:s}=this.confirmRelease,a=R(e,s),i=this.releasing.has(`${e.id}/${s.physical_index}`);return n`<sw-dialog open heading=${t("שחרור דלת")} subheading=${a?`${e.name} · ${a}`:e.name} data-wiskey-release-dialog @close=${()=>this.confirmRelease=null}>
      <p>${t("פקודת שחרור תישלח עכשיו לעמדה")} <b>${e.name}</b>${a?n` (${a})`:p}. ${t("המנעול ישתחרר לזמן שמוגדר בעמדה עצמה, וכל מי שנמצא ליד הדלת יוכל להיכנס.")}</p>
      <p class="muted">${t("הפעולה נרשמת ביומן הביקורת של Arx בשמך. תשובת WisKey מאשרת רק שהפקודה התקבלה - לא שהדלת נפתחה בפועל.")}</p>
      <div slot="footer">
        <sw-button variant="ghost" data-wiskey-release-cancel @click=${()=>this.confirmRelease=null}>${t("ביטול")}</sw-button>
        <sw-button variant="danger" icon="unlock" data-wiskey-release-confirm ?disabled=${i} @click=${()=>void this.doRelease()}>${i?t("שולח…"):t("שחרר את הדלת")}</sw-button>
      </div>
    </sw-dialog>`}renderSpeak(){const e=this.speakFor,s=this.engines?.engines.find(l=>l.engine_id===this.ttsEngine),a=s?.supported_languages??[],i=this.ttsMessage.split(/\s+/).filter(Boolean).join(" ").length,u=!!s&&i>0&&i<=y&&!this.ttsBusy,g=te().dialog;return n`<sw-dialog open heading=${t("הכרזה בעמדה")} subheading=${e.name} data-wiskey-tts-dialog @close=${()=>this.speakFor=null}>
      <div class="form">
        ${this.ttsMissingEngine?n`<div class="note warn" role="status" data-wiskey-tts-engine-missing>${F(g.missingEngine,{engine:this.ttsMissingEngine})}</div>`:p}
        ${this.ttsMissingLanguage&&this.ttsLanguage?n`<div class="note warn" role="status" data-wiskey-tts-language-missing>${F(g.missingLanguage,{language:M(this.ttsMissingLanguage),auto:M(this.ttsLanguage)})}</div>`:p}
        ${this.engines?.engines.length?n`<sw-field label=${t("מנוע הקראה (תשתית המערכת)")} hint=${this.ttsEngine&&this.ttsPreselected&&this.ttsEngine!==this.ttsPreselected?g.overridden:""}>
                <sw-dropdown block data-wiskey-tts-engine label=${t("מנוע הקראה")} placeholder=${g.pickEngine} .value=${this.ttsEngine}
                  .items=${this.engines.engines.map(l=>({id:l.engine_id,label:l.engine_id===this.ttsFixed.engine?`${l.name} · ${g.fixedTag}`:l.name}))}
                  @change=${l=>this.pickEngine(l.detail.id)}></sw-dropdown>
              </sw-field>
              ${a.length?n`<sw-field label=${t("שפה")}>
                    <sw-dropdown block data-wiskey-tts-language label=${t("שפה")} .value=${this.ttsLanguage}
                      .items=${a.map(l=>({id:l,label:l}))}
                      @change=${l=>this.ttsLanguage=l.detail.id}></sw-dropdown>
                  </sw-field>`:p}
              <sw-field label=${t("ההודעה")} hint=${`${i}/${y}`}>
                <textarea data-wiskey-tts-message rows="3" maxlength=${y} .value=${this.ttsMessage} @input=${l=>this.ttsMessage=l.target.value}></textarea>
              </sw-field>`:n`<div class="muted" data-wiskey-tts-engines-state>${this.enginesNote||t("טוען את מנועי ההקראה…")}</div>`}
        <div class="note info" data-wiskey-tts-external>${t("ההודעה תושמע ברמקול של העמדה {station}. הטקסט נשלח למנוע ההקראה שנבחר בתשתית המערכת - אם זהו שירות ענן, הטקסט יוצא מהמבנה. ההכרזה נרשמת ביומן הביקורת בשמך, בלי הטקסט.",{station:e.name})}</div>
        ${this.ttsError?n`<div class="note err" role="alert" data-wiskey-tts-error>${this.ttsError}</div>`:p}
      </div>
      <div slot="footer">
        <sw-button variant="ghost" @click=${()=>this.speakFor=null}>${t("ביטול")}</sw-button>
        <sw-button variant="primary" icon="volume" data-wiskey-tts-send ?disabled=${!u} @click=${()=>void this.speak()}>${this.ttsBusy?t("שולח…"):t("השמע בעמדה")}</sw-button>
      </div>
    </sw-dialog>`}renderFeedBadge(e,s){if(s)return n`<sw-badge slot="actions" kind="neutral" label=${t("נתוני הדגמה")}></sw-badge>`;const{kind:a,label:i}=we(e.state,e.overview?.version);return n`<sw-badge slot="actions" data-wiskey-feed=${e.state} kind=${a} label=${i}></sw-badge>`}renderFeedPanel(e){const s=B[e.state==="ready"?"error":e.state];return n`<sw-state-panel icon="door" data-wiskey-state=${e.state} state=${s.panel} heading=${s.heading} hint=${s.hint}></sw-state-panel>`}renderStaleNote(e){return n`<div class="note stale" role="status" data-wiskey-stale>
      <sw-icon name="offline" size=${16}></sw-icon>
      <span>${B[e.state==="ready"?"error":e.state].heading}. ${t("מוצג המידע האחרון שהתקבל")}${e.fetched_at?n` (<bdi>${z(e.fetched_at,S(),e.overview?.default_zone??A)}</bdi>)`:p} - ${t("ייתכן שאינו עדכני.")}</span>
    </div>`}renderOverview(e){const s=e.stations,a=s.filter(r=>r.call_state==="ringing"&&r.online),i=s.filter(r=>!r.online||!!r.last_error||r.sync_state==="pending"),u=this.query.trim().toLocaleLowerCase(),g=s.filter(r=>r.name.toLocaleLowerCase().includes(u)?this.filter==="all"||this.filter==="online"&&r.online||this.filter==="attention"&&i.includes(r):!1),l=Math.max(1,Math.ceil(g.length/k)),f=Math.min(this.page,l-1),w=g.slice(f*k,(f+1)*k),m=e.default_zone??A;return n`
      <!-- AUDIT30-H (finding 7): the two summary tiles are the shared compact <sw-kpi> (60 px, DESIGN.md "KPI tile"), not the tall cards tile -->
      <div class="stats" data-wiskey-stats aria-label=${t("סיכום")}>
        <sw-kpi layout="compact" icon="door" tone=${s.length&&s.every(r=>r.online)?"live":s.some(r=>!r.online)?"offline":"neutral"} label=${c("online_stations")} value=${`⁦${s.filter(r=>r.online).length} / ${s.length}⁩`}></sw-kpi>
        <sw-kpi layout="compact" icon="bell" tone=${a.length?"stale":"neutral"} label=${c("ringing_now")} value=${String(a.length)}></sw-kpi>
      </div>
      <div class=${i.length?"layout with-side":"layout"}>
        <div class="main">
          <div class="toolbar">
            <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wiskey-search aria-label=${c("wall_search")} placeholder=${c("wall_search")} .value=${this.query} @input=${r=>{this.query=r.target.value,this.page=0}} /></label>
            <div class="filters" role="group" aria-label=${c("wk4_door_filter")}>
              ${["all","online","attention"].map(r=>n`<sw-chip data-wiskey-filter=${r} ?selected=${this.filter===r} aria-pressed=${this.filter===r} @click=${()=>{this.filter=r,this.page=0}}>${c("wk4_filter_"+r)}</sw-chip>`)}
            </div>
            <span class="count" data-wiskey-count>${g.length} ${c("devices")}</span>
          </div>
          ${g.length?n`<div class="grid">${q(w,r=>r.id,r=>this.renderDoor(r,m))}</div>`:n`<sw-state-panel icon="door" compact state="empty" data-wiskey-empty heading=${s.length?t("לא נמצאו דלתות תואמות"):c("no_stations")}></sw-state-panel>`}
          ${l>1?n`<div class="pager">
                <sw-button size="sm" variant="ghost" ?disabled=${f===0} @click=${()=>this.page=f-1}>${c("wall_previous")}</sw-button>
                <span role="status"><bdi>${f+1} / ${l}</bdi></span>
                <sw-button size="sm" variant="ghost" ?disabled=${f+1>=l} @click=${()=>this.page=f+1}>${c("wall_next")}</sw-button>
              </div>`:p}
        </div>
        ${i.length?n`<aside class="side">
              <sw-card heading=${c("access_attention")} data-wiskey-attention>
                <!-- AUDIT30-H2 (owner/lead: like "מצלצל"): the count is a filled amber field, solid edge, not the dashed stale-data look (i18n-keep: an HTML comment of the template, never shown) -->
                <sw-badge slot="actions" kind="stale" filled data-wiskey-attention-count label=${String(i.length)}></sw-badge>
                ${i.slice(0,5).map(r=>n`<div class="attn"><strong>${r.name}</strong><small>${r.online?r.last_error||c("pending_sync"):c("offline")}</small></div>`)}
              </sw-card>
            </aside>`:p}
      </div>
    `}renderDoor(e,s){const a=e.online?e.call_state==="ringing"?"ringing":"online":"offline",i=a==="offline"?"offline":a==="ringing"?"stale":"live";return n`<article class="door ${a}" data-wiskey-door=${e.id} data-status=${a}>
      <div class="door-head">
        <span class="ic"><sw-icon name=${e.online?"door":"offline"} size=${18}></sw-icon></span>
        <div class="title">
          <b title=${e.name}>${e.name}</b>
          <small>${!e.online&&e.last_seen?n`${c("last_seen")}: <bdi>${z(e.last_seen,S(),s)}</bdi>`:c("access_by_permissions")}</small>
        </div>
        <sw-badge kind=${i} ?filled=${a==="ringing"} data-wiskey-door-badge=${a} label=${c(a)}></sw-badge>
      </div>
      ${a==="ringing"?n`<div class="ring" role="status"><sw-icon name="bell" size=${14}></sw-icon>${c("ringing")}</div>`:p}
      ${this.renderStill(e)}
      <div class="facts">
        <span>${e.lock_enabled?e.lock_count>1?`${c("lock_enabled")} · ${e.lock_count}`:c("lock_enabled"):c("camera_only")}</span>
        <span>${t("סנכרון: {state}",{state:c(e.sync_state)})}</span>
        ${e.online&&e.call_state!=="ringing"?n`<span>${t("שיחה: {state}",{state:c(e.call_state)})}</span>`:p}
      </div>
      ${this.canAct()||this.canOpen(e)?this.renderActions(e):p}
    </article>`}renderStill(e){if(!e.camera_entity)return p;const s=this.posterBust,a=H("go2rtc")?this.cameraAccess[e.id]??"ready":"no_media",i=e.online?a!=="ready"?a:this.stillFailed[e.id]===s?"unavailable":"image":"offline";return n`<div class="still" data-wiskey-camera=${e.id} data-camera-state=${i}>
      ${i==="image"?n`<img
              src=${J(e.id,s)}
              alt=${`${t("מצלמה")} · ${e.name}`}
              decoding="async"
              @error=${()=>this.stillFailed={...this.stillFailed,[e.id]:s}}
            /><span class="tag">${t("צילום")}</span>`:n`<div class="none" role="status">
            <sw-icon name=${i==="offline"?"offline":"camera"} size=${20}></sw-icon>
            <span>${re[i]}</span>
          </div>`}
    </div>`}renderActions(e){const s=this.feed?.state==="ready",a=e.lock_enabled?e.locks:[],i=e.online&&e.call_state==="ringing",u=e.online&&e.call_state==="in_call",g=this.results[e.id],l=this.ttsStatus[e.id],f=l?.state==="closed"?"warn":"ok";return n`<div class="actions" data-wiskey-actions=${e.id}>
      ${(i||u)&&this.canAct()?n`<div class="row call" role="group" aria-label=${t("שליטה בשיחה")} data-wiskey-call>
            ${(i?["answer","reject"]:["hangUp"]).map(w=>{const m=this.armed?.id===e.id&&this.armed.command===w&&this.armed.callState===e.call_state;return n`<sw-button
                size="sm"
                variant=${w==="answer"?"primary":"danger"}
                icon=${w==="answer"?"check":"close"}
                data-wiskey-call-command=${w}
                data-armed=${m?"true":"false"}
                ?disabled=${!s||this.callBusy.has(e.id)}
                @click=${r=>this.onCall(r,e,w)}
                >${m?t("לחצו שוב ל{action}",{action:T[w]}):T[w]}</sw-button
              >`})}
          </div>`:p}
      <div class="row">
        ${(this.canOpen(e)?a:[]).map(w=>{const m=R(e,w),r=`${e.id}/${w.physical_index}`,x=this.isHeld(r);return n`<sw-button
            size="sm"
            icon="unlock"
            data-wiskey-release=${w.physical_index}
            data-held=${x?"true":"false"}
            ?disabled=${!s||!e.online||this.releasing.has(r)||x}
            @click=${()=>this.askRelease(e,w)}
            >${x?t("ממתין לבירור…"):m?t("שחרור {name}",{name:m}):t("שחרור דלת")}</sw-button
          >`})}
        ${e.online&&this.canAct()?n`<sw-button size="sm" variant="ghost" icon="volume" data-wiskey-speak ?disabled=${!s} @click=${()=>this.openSpeak(e)}>${t("הכרזה")}</sw-button>`:p}
      </div>
      ${g?n`<div class="result ${g.tone}" role="status" data-wiskey-result>${g.text}</div>`:p}
      ${l?n`<div class="result ${f}" role="status" data-wiskey-tts-status=${l.state}>${pe(l)}</div>`:p}
    </div>`}};o.styles=Y`
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--sw-kpi-compact-col-min, 168px), 240px));
      gap: 12px;
    }
    @media (max-width: 600px) {
      .stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }
    @media (min-width: 1001px) {
      .layout.with-side {
        grid-template-columns: minmax(0, 1fr) 300px;
      }
    }
    .main,
    .side {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .search {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding-inline: 10px;
      min-block-size: 34px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text-3);
      flex: 1 1 220px;
      max-inline-size: 360px;
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    /* ROUND4-LEFTOVERS-2390 (WP9): the search field states as on the stations screen (WKWATER) - a hover edge only under a
       fine hovering pointer, a focus ring on the field (the input itself has no outline), 44 px on a touch screen */
    @media (hover: hover) and (pointer: fine) {
      .search:hover {
        border-color: var(--sw-text-3);
      }
    }
    .search:focus-within {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    @media (pointer: coarse) {
      .search {
        min-block-size: 44px;
      }
    }
    .search input {
      border: 0;
      outline: 0;
      background: transparent;
      font: inherit;
      color: var(--sw-text);
      inline-size: 100%;
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .count {
      margin-inline-start: auto;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      font-variant-numeric: tabular-nums;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
    }
    /* R5-SECURITY: a station card is the hero step of this screen (radius lg, shadow 2); a ringing one is a FILLED warning field,
       an offline one steps down a tone */
    .door {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 16px;
      background: var(--sw-surface);
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      min-inline-size: 0;
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), background var(--sw-t-state) var(--sw-ease);
    }
    .door.ringing {
      border-color: color-mix(in srgb, var(--sw-warning) 55%, transparent);
      background: var(--sw-warning-soft);
      box-shadow: var(--sw-shadow-2), 0 0 0 3px color-mix(in srgb, var(--sw-warning) 30%, transparent);
    }
    .door.offline {
      background: var(--sw-surface-2);
      box-shadow: var(--sw-shadow-1);
    }
    .door-head {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: var(--sw-r-md);
      background: var(--sw-live-soft);
      color: var(--sw-success);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 28%, transparent);
      flex: none;
    }
    .door.offline .ic {
      background: var(--sw-offline-soft);
      color: var(--sw-offline);
    }
    .door.ringing .ic {
      background: var(--sw-warning-soft);
      color: var(--sw-warning);
    }
    .title {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-inline-size: 0;
    }
    .title b {
      /* R5-SECURITY: the station's name is the card's display line - 17/800 in the heading ink */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--sw-text));
      line-height: 1.15;
    }
    .title small {
      font-size: var(--sw-fs-sm);
    }
    small,
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ring {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      padding: 4px 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-warning);
      /* ROUND4-LEFTOVERS-2390 (WP9): white on the amber fill read 2.2:1 (classic) - the ink for a warning fill */
      color: var(--sw-on-warning);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      box-shadow: var(--sw-shadow-1);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .facts b {
      color: var(--sw-heading, var(--sw-text));
    }
    /* R5-SECURITY: the badges of this screen read as fields - 12.5/700 on 22 px */
    sw-badge {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      line-height: 18px;
      padding-block: 2px;
    }
    .attn strong {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .attn small {
      font-size: var(--sw-fs-sm);
    }
    .still {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
    }
    .still img {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .still .tag {
      /* sw-camera-tile's own "צילום" (still) tag */
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: var(--sw-fs-2xs);
      letter-spacing: 0.04em;
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-2xs);
      padding: 1px 6px;
    }
    .still .none {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      block-size: 100%;
      padding: 8px;
      text-align: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-variant-numeric: tabular-nums;
    }
    .attn {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-block: 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    .attn:last-child {
      border-block-end: 0;
    }
    .note {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .note.stale {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .note.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .note.info {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      align-items: flex-start;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-block-start: 8px;
      border-block-start: 1px solid var(--sw-border);
    }
    .actions .row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .result {
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-xs);
      line-height: 1.4;
    }
    .result.ok {
      background: var(--sw-live-soft);
      color: var(--sw-text);
    }
    .result.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-text);
    }
    .result.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    textarea {
      resize: vertical;
      min-block-size: 72px;
    }
  `;d([h()],o.prototype,"feed",2);d([h()],o.prototype,"error",2);d([h()],o.prototype,"forbidden",2);d([h()],o.prototype,"query",2);d([h()],o.prototype,"filter",2);d([h()],o.prototype,"page",2);d([h()],o.prototype,"confirmRelease",2);d([h()],o.prototype,"releasing",2);d([h()],o.prototype,"results",2);d([h()],o.prototype,"held",2);d([h()],o.prototype,"callBusy",2);d([h()],o.prototype,"armed",2);d([h()],o.prototype,"speakFor",2);d([h()],o.prototype,"engines",2);d([h()],o.prototype,"enginesNote",2);d([h()],o.prototype,"ttsEngine",2);d([h()],o.prototype,"ttsLanguage",2);d([h()],o.prototype,"ttsMessage",2);d([h()],o.prototype,"ttsBusy",2);d([h()],o.prototype,"ttsError",2);d([h()],o.prototype,"ttsStatus",2);d([h()],o.prototype,"ttsFixed",2);d([h()],o.prototype,"ttsPreselected",2);d([h()],o.prototype,"ttsMissingEngine",2);d([h()],o.prototype,"ttsMissingLanguage",2);d([h()],o.prototype,"posterBust",2);d([h()],o.prototype,"stillFailed",2);o=d([G("wiskey-overview")],o);export{o as WiskeyOverview};
