import{a as M,i as m,be as E,cz as B,aw as O,j as y,Y as b,l as W,cx as N,n as K,cw as P,cf as C,K as D,cL as I,e as a,A as h,ct as j,bZ as U,a3 as q,cn as H,E as J,G as d,H as Y}from"./index-D7IzA1Sh.js";import"./sw-chip-T-1M_LtX.js";import{h as X}from"./access-DRUvKQCj.js";import{t as c,f as T,U as S}from"./wiskey-format-DJ4vUeXA.js";import{T as z,p as G,r as V,l as Z,t as Q,f as A,a as L}from"./tts-default-BdUzH1g6.js";import"./sw-logo-art-Va6y_cIM.js";var ee=Object.defineProperty,te=Object.getOwnPropertyDescriptor,o=(e,t,s,i)=>{for(var p=i>1?void 0:i?te(t,s):t,g=e.length-1,r;g>=0;g--)(r=e[g])&&(p=(i?r(t,s,p):r(p))||p);return i&&p&&ee(t,s,p),p};const x=12,se=3e4,ie=6e4,ae={offline:"העמדה אינה מחוברת - אין תמונה עדכנית",unavailable:"אין תמונה מהמצלמה כרגע",no_credentials:"לא הוגדרו פרטי גישה למצלמות העמדות (הגדרות ה־Add-on)",no_host:"WisKey לא מסר את כתובת העמדה, ולכן אין ממנה תמונה",no_media:"שרת המדיה לא הוגדר, ולכן אין תמונות מצלמה"},ne=4e3,re=500,le=7e4;function oe(e){const t=e instanceof y?Number(e.body?.details?.retry_after_s):NaN;return Number.isFinite(t)&&t>=0?Math.ceil(t*1e3):le}const v=500,_={answer:"מענה",reject:"דחייה",hangUp:"סיום שיחה"};function k(e){return H(e)!=="unknown"?{tone:"err",text:b(e),unknown:!1}:{tone:"warn",text:e instanceof y&&e.body?.details?.outcome==="unknown"?`לא ידוע אם הפקודה בוצעה: ${e.message}`:`לא ידוע אם הפקודה בוצעה: לא התקבלה תשובה ברורה מהשרת (${b(e)}). בדקו במצלמה או במקום לפני שמנסים שוב.`,unknown:!0}}function de(e){const t=e.acknowledged===!0?"העמדה אישרה קבלה":"לא התקבל אישור קבלה מהעמדה",s=e.observation==="unavailable"||!e.observed_state?"מצב השיחה אחרי הפקודה לא נקרא":`מצב שנצפה אחרי הפקודה: ${c(e.observed_state)}${e.observation==="unchanged"?" (לא השתנה)":""}`;return`${_[e.command]??e.command} נשלח · ${t} · ${s}`}const ce={connection_lost:"החיבור לתשתית המערכת נותק",tts_cancelled:"בוטלה",tts_generation_timeout:"ההקראה לא הוכנה בזמן",tts_generation_failed:"מנוע ההקראה נכשל",tts_audio_too_long:"ההקראה ארוכה מדי",tts_playback_failed:"ההשמעה בעמדה נכשלה",audio_busy:"ערוץ השמע של העמדה תפוס"};function he(e){switch(e.state){case"started":return"הכרזה: נשלחה ל־WisKey";case"generating":return"הכרזה: מכינה את ההקראה…";case"speaking":return"הכרזה: מושמעת בעמדה…";case"completed":return"הכרזה: WisKey סיים להשמיע אותה. אין אישור שנשמעה בפועל.";default:return`הכרזה: נעצרה (${ce[e.reason??""]??e.reason??"ללא סיבה"})`}}function F(e,t){return e.locks.length>1?t.name||`מנעול ${t.physical_index}`:""}const ge={version:"demo",api_version:1,default_zone:{kind:"iana",name:"Asia/Jerusalem"},stations:[{id:"d1",name:"שער ראשי",online:!0,call_state:"ringing",sync_state:"synced",lock_enabled:!0,lock_count:1,locks:[{physical_index:1,name:null}],has_camera:!0,camera_entity:null,last_error:null,last_seen:"2026-09-27T08:00:00+03:00",zone:{kind:"iana",name:"Asia/Jerusalem"}},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,lock_count:2,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!0,camera_entity:null,last_error:null,last_seen:"2026-09-27T08:00:00+03:00",zone:{kind:"iana",name:"Asia/Jerusalem"}},{id:"d3",name:"חניון",online:!0,call_state:"idle",sync_state:"pending",lock_enabled:!1,lock_count:0,locks:[],has_camera:!0,camera_entity:null,last_error:null,last_seen:"2026-09-27T08:00:00+03:00",zone:{kind:"iana",name:"Asia/Jerusalem"}},{id:"d4",name:"מחסן",online:!1,call_state:"unavailable",sync_state:"offline",lock_enabled:!0,lock_count:1,locks:[{physical_index:1,name:null}],has_camera:!1,camera_entity:null,last_error:null,last_seen:"2026-09-26T19:02:00+03:00",zone:null}]},R={ha_not_configured:{panel:"stale",heading:"WisKey אינו מחובר בסביבה הזו",hint:"ל־Arx אין כאן גישה לתשתית המערכת, ולכן אין נתוני אינטרקום להצגה. במערכת המותקנת המסך מתחבר לאינטגרציית WisKey (hikvision_intercom) מעצמו."},connecting:{panel:"loading",heading:"מתחבר ל־WisKey…",hint:"הנתונים יופיעו ברגע שתשתית המערכת תענה."},ha_unavailable:{panel:"stale",heading:"תשתית המערכת אינה זמינה כרגע",hint:"אין חיבור לתשתית המערכת, ולכן אין נתוני אינטרקום עדכניים. החיבור מתחדש אוטומטית."},not_installed:{panel:"empty",heading:"אינטגרציית WisKey אינה מותקנת",hint:"תשתית המערכת לא מכירה את הפקודות של WisKey (hikvision_intercom). אחרי התקנה המסך יתחבר אליה מעצמו תוך כמה דקות."},forbidden:{panel:"forbidden",heading:"WisKey דחה את הגישה של Arx",hint:"המשתמש של המערכת אינו מורשה בהרשאות של WisKey, ולכן אין נתונים להצגה."},error:{panel:"error",heading:"WisKey החזיר שגיאה",hint:"הבקשה ל־WisKey לא הושלמה. הניסיון יחזור אוטומטית."}};function pe(e,t){const s=e==="ready"?"live":e==="connecting"?"unknown":e==="forbidden"?"forbidden":e==="error"?"error":"offline",i=e==="ready"?`מחובר ל־WisKey${t?` ${t}`:""}`:e==="connecting"?"מתחבר":"לא מחובר";return{kind:s,label:i}}let l=class extends M{constructor(){super(...arguments),this.feed=null,this.error="",this.forbidden=!1,this.query="",this.filter="all",this.page=0,this.confirmRelease=null,this.releasing=new Set,this.results={},this.held={},this.callBusy=new Set,this.armed=null,this.holdTimer=0,this.speakFor=null,this.engines=null,this.enginesNote="",this.ttsEngine="",this.ttsLanguage="",this.ttsMessage="",this.ttsBusy=!1,this.ttsError="",this.ttsStatus={},this.ttsFixed=z,this.ttsPreselected="",this.ttsMissingEngine=null,this.ttsMissingLanguage=null,this.enginesAt=0,this.armTimer=0,this.posterBust=Date.now(),this.stillFailed={},this.posterTimer=0,this.cameraAccess={},this.stop=null,this.poll=0,this.loading=!1,this.loadAgain=!1}connectedCallback(){if(super.connectedCallback(),!!m()){if(!E("access.read")){this.forbidden=!0;return}this.load(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.posterBust=Date.now())},ie),this.stop=B(e=>{e.type==="intercom_tts"?this.ttsStatus={...this.ttsStatus,[e.status.station_id]:e.status}:e.type!=="heartbeat"&&this.load()},e=>{this.setPolling(!e),e&&this.load()})}}disconnectedCallback(){super.disconnectedCallback(),this.stop?.(),this.stop=null,this.setPolling(!1),window.clearInterval(this.posterTimer),window.clearTimeout(this.armTimer),window.clearTimeout(this.holdTimer)}setPolling(e){window.clearInterval(this.poll),this.poll=e?window.setInterval(()=>void this.load(),se):0}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{this.feed=await O(),this.error="",this.dropStaleArm()}catch(e){e instanceof y&&e.status===403?this.forbidden=!0:this.error=b(e)}}while(this.loadAgain)}finally{this.loading=!1}}canAct(){return m()&&W("access.call")}canOpen(e){const t=this.feed?.door_access;return m()&&(t?!!t[e.id]:X(s=>E(s)))}setResult(e,t,s){this.results={...this.results,[e]:{tone:t,text:s}}}isHeld(e){return(this.held[e]??0)>Date.now()}hold(e,t){const s=Date.now()+t;this.held={...this.held,[e]:Math.max(this.held[e]??0,s)},window.clearTimeout(this.holdTimer);const i=Math.min(...Object.values(this.held).filter(p=>p>Date.now()));Number.isFinite(i)&&(this.holdTimer=window.setTimeout(()=>this.held={...this.held},i-Date.now()+50))}askRelease(e,t){const s=`${e.id}/${t.physical_index}`;this.releasing.has(s)||this.isHeld(s)||(this.confirmRelease={station:e,lock:t})}async doRelease(){const e=this.confirmRelease;if(!e)return;const t=`${e.station.id}/${e.lock.physical_index}`;if(!(this.releasing.has(t)||this.isHeld(t))){this.releasing=new Set([...this.releasing,t]);try{await N(e.station.id,e.lock.physical_index);const s=K(new Date,{seconds:!0});this.setResult(e.station.id,"ok",`הפקודה נשלחה ו־WisKey קיבל אותה (${s}). אין אישור שהדלת נפתחה בפועל - בדקו במצלמה או במקום.`)}catch(s){const i=k(s);this.setResult(e.station.id,i.tone,i.text),(i.unknown||s instanceof y&&s.code==="intercom_release_in_progress")&&this.hold(t,oe(s))}finally{const s=new Set(this.releasing);s.delete(t),this.releasing=s,this.confirmRelease===e&&(this.confirmRelease=null)}}}onCall(e,t,s){if(this.callBusy.has(t.id)||this.feed?.state!=="ready"||e.detail>1)return;const i=this.armed;if(i&&i.id===t.id&&i.command===s&&i.callState===t.call_state){if(performance.now()-i.at<re)return;window.clearTimeout(this.armTimer),this.armed=null,this.sendCall(t,s);return}window.clearTimeout(this.armTimer),this.armed={id:t.id,command:s,at:performance.now(),callState:t.call_state},this.armTimer=window.setTimeout(()=>this.armed=null,ne)}dropStaleArm(){const e=this.armed;if(!e)return;const t=this.feed?.overview?.stations.find(s=>s.id===e.id);(this.feed?.state!=="ready"||!t||!t.online||t.call_state!==e.callState)&&(window.clearTimeout(this.armTimer),this.armed=null)}async sendCall(e,t){this.callBusy=new Set([...this.callBusy,e.id]);try{const s=await P(e.id,t);s.call&&this.setResult(e.id,s.call.acknowledged===!0?"ok":"warn",de(s.call))}catch(s){const i=k(s);this.setResult(e.id,i.tone,i.text)}finally{const s=new Set(this.callBusy);s.delete(e.id),this.callBusy=s,this.load()}}openSpeak(e){this.speakFor=e,this.ttsMessage="",this.ttsError="",!this.engines||Date.now()-this.enginesAt>6e4?this.loadEngines():this.applyFixed()}async loadEngines(){this.enginesNote="",this.enginesAt=Date.now();try{const e=await C();e.tts?(this.engines=e.tts,await this.applyFixed(),e.tts.engines.length||(this.enginesNote="אין בתשתית המערכת מנוע הקראה (TTS) ש־WisKey יכול להשתמש בו.")):this.enginesNote=e.state==="unsupported"?"גרסת WisKey המותקנת אינה תומכת בהכרזות.":`רשימת מנועי ההקראה אינה זמינה כרגע (${e.last_error??e.state}).`}catch(e){this.enginesNote=b(e)}}async applyFixed(){try{this.ttsFixed=G(await D())}catch{this.ttsFixed=z}const e=V(this.engines,this.ttsFixed);this.ttsEngine=e.engine,this.ttsLanguage=e.language,this.ttsPreselected=e.engine,this.ttsMissingEngine=e.missingEngine,this.ttsMissingLanguage=e.missingLanguage}pickEngine(e){this.ttsEngine=e,this.ttsLanguage=Z(this.engines,e,this.ttsFixed),this.ttsMissingLanguage=null}async speak(){const e=this.speakFor,t=this.ttsMessage.split(/\s+/).filter(Boolean).join(" ");if(!(!e||this.ttsBusy||!this.ttsEngine||!t||t.length>v)){this.ttsBusy=!0,this.ttsError="";try{const s=await I(e.id,{engine_id:this.ttsEngine,language:this.ttsLanguage||null,message:t}),i=this.ttsStatus[e.id],p=g=>["started","generating","speaking","completed","closed"].indexOf(g.state);s.tts&&!(i&&i.at>=s.tts.at&&p(i)>p(s.tts))&&(this.ttsStatus={...this.ttsStatus,[e.id]:s.tts}),this.speakFor=null}catch(s){const i=k(s);i.unknown?(this.speakFor=null,this.setResult(e.id,i.tone,i.text)):this.ttsError=i.text}finally{this.ttsBusy=!1}}}render(){return m()?this.forbidden?a`<sw-page heading="WisKey" subheading="מרכז הכניסה"><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בבקרת הכניסה" hint="נדרשת ההרשאה צפייה בבקרת כניסה (WisKey). פנה למנהל המערכת."></sw-state-panel></sw-page>`:this.feed?this.renderPage(this.feed,!1):a`<sw-page heading="WisKey" subheading="מרכז הכניסה">${this.error?a`<sw-state-panel data-wiskey-state="load_error" state="error" heading="לא ניתן לטעון את מרכז הכניסה" hint=${this.error}></sw-state-panel>`:a`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`:this.renderPage({state:"ready",configured:!0,fresh:!0,fetched_at:null,last_error:null,overview:ge},!0)}renderPage(e,t){const s=e.overview;this.cameraAccess=e.camera_access??{};const i=`${c("wk4_entry_intro")}${this.canAct()||Object.values(this.feed?.door_access??{}).some(Boolean)?"":" · צפייה בלבד"}${t?" · נתוני הדגמה":""}`;return a`<sw-page heading="WisKey · ${c("wk4_entry_center")}" subheading=${i} wide>
      ${this.renderFeedBadge(e,t)}
      ${s&&e.state!=="ready"?this.renderStaleNote(e):h}
      ${this.error?a`<div class="note err" role="status">${this.error}</div>`:h}
      ${s?this.renderOverview(s):this.renderFeedPanel(e)}
      ${this.confirmRelease?this.renderReleaseConfirm():h}
      ${this.speakFor?this.renderSpeak():h}
    </sw-page>`}renderReleaseConfirm(){const{station:e,lock:t}=this.confirmRelease,s=F(e,t),i=this.releasing.has(`${e.id}/${t.physical_index}`);return a`<sw-dialog open heading="שחרור דלת" subheading=${s?`${e.name} · ${s}`:e.name} data-wiskey-release-dialog @close=${()=>this.confirmRelease=null}>
      <p>פקודת שחרור תישלח עכשיו לעמדה <b>${e.name}</b>${s?a` (${s})`:h}. המנעול ישתחרר לזמן שמוגדר בעמדה עצמה, וכל מי שנמצא ליד הדלת יוכל להיכנס.</p>
      <p class="muted">הפעולה נרשמת ביומן הביקורת של Arx בשמך. תשובת WisKey מאשרת רק שהפקודה התקבלה - לא שהדלת נפתחה בפועל.</p>
      <div slot="footer">
        <sw-button variant="ghost" data-wiskey-release-cancel @click=${()=>this.confirmRelease=null}>ביטול</sw-button>
        <sw-button variant="danger" icon="unlock" data-wiskey-release-confirm ?disabled=${i} @click=${()=>void this.doRelease()}>${i?"שולח…":"שחרר את הדלת"}</sw-button>
      </div>
    </sw-dialog>`}renderSpeak(){const e=this.speakFor,t=this.engines?.engines.find(r=>r.engine_id===this.ttsEngine),s=t?.supported_languages??[],i=this.ttsMessage.split(/\s+/).filter(Boolean).join(" ").length,p=!!t&&i>0&&i<=v&&!this.ttsBusy,g=Q().dialog;return a`<sw-dialog open heading="הכרזה בעמדה" subheading=${e.name} data-wiskey-tts-dialog @close=${()=>this.speakFor=null}>
      <div class="form">
        ${this.ttsMissingEngine?a`<div class="note warn" role="status" data-wiskey-tts-engine-missing>${A(g.missingEngine,{engine:this.ttsMissingEngine})}</div>`:h}
        ${this.ttsMissingLanguage&&this.ttsLanguage?a`<div class="note warn" role="status" data-wiskey-tts-language-missing>${A(g.missingLanguage,{language:L(this.ttsMissingLanguage),auto:L(this.ttsLanguage)})}</div>`:h}
        ${this.engines?.engines.length?a`<sw-field label="מנוע הקראה (תשתית המערכת)" hint=${this.ttsEngine&&this.ttsPreselected&&this.ttsEngine!==this.ttsPreselected?g.overridden:""}>
                <select data-wiskey-tts-engine .value=${this.ttsEngine} @change=${r=>this.pickEngine(r.target.value)}>
                  ${this.ttsEngine?h:a`<option value="" selected disabled>${g.pickEngine}</option>`}
                  ${this.engines.engines.map(r=>a`<option value=${r.engine_id} ?selected=${r.engine_id===this.ttsEngine}>${r.engine_id===this.ttsFixed.engine?`${r.name} · ${g.fixedTag}`:r.name}</option>`)}
                </select>
              </sw-field>
              ${s.length?a`<sw-field label="שפה">
                    <select data-wiskey-tts-language .value=${this.ttsLanguage} @change=${r=>this.ttsLanguage=r.target.value}>
                      ${s.map(r=>a`<option value=${r} ?selected=${r===this.ttsLanguage}>${r}</option>`)}
                    </select>
                  </sw-field>`:h}
              <sw-field label="ההודעה" hint=${`${i}/${v}`}>
                <textarea data-wiskey-tts-message rows="3" maxlength=${v} .value=${this.ttsMessage} @input=${r=>this.ttsMessage=r.target.value}></textarea>
              </sw-field>`:a`<div class="muted" data-wiskey-tts-engines-state>${this.enginesNote||"טוען את מנועי ההקראה…"}</div>`}
        <div class="note info" data-wiskey-tts-external>ההודעה תושמע ברמקול של העמדה ${e.name}. הטקסט נשלח למנוע ההקראה שנבחר בתשתית המערכת - אם זהו שירות ענן, הטקסט יוצא מהמבנה. ההכרזה נרשמת ביומן הביקורת בשמך, בלי הטקסט.</div>
        ${this.ttsError?a`<div class="note err" role="alert" data-wiskey-tts-error>${this.ttsError}</div>`:h}
      </div>
      <div slot="footer">
        <sw-button variant="ghost" @click=${()=>this.speakFor=null}>ביטול</sw-button>
        <sw-button variant="primary" icon="volume" data-wiskey-tts-send ?disabled=${!p} @click=${()=>void this.speak()}>${this.ttsBusy?"שולח…":"השמע בעמדה"}</sw-button>
      </div>
    </sw-dialog>`}renderFeedBadge(e,t){if(t)return a`<sw-badge slot="actions" kind="neutral" label="נתוני הדגמה"></sw-badge>`;const{kind:s,label:i}=pe(e.state,e.overview?.version);return a`<sw-badge slot="actions" data-wiskey-feed=${e.state} kind=${s} label=${i}></sw-badge>`}renderFeedPanel(e){const t=R[e.state==="ready"?"error":e.state];return a`<sw-state-panel icon="door" data-wiskey-state=${e.state} state=${t.panel} heading=${t.heading} hint=${t.hint}></sw-state-panel>`}renderStaleNote(e){return a`<div class="note stale" role="status" data-wiskey-stale>
      <sw-icon name="offline" size=${16}></sw-icon>
      <span>${R[e.state==="ready"?"error":e.state].heading}. מוצג המידע האחרון שהתקבל${e.fetched_at?a` (<bdi>${T(e.fetched_at,"he-IL",e.overview?.default_zone??S)}</bdi>)`:h} - ייתכן שאינו עדכני.</span>
    </div>`}renderOverview(e){const t=e.stations,s=t.filter(n=>n.call_state==="ringing"&&n.online),i=t.filter(n=>!n.online||!!n.last_error||n.sync_state==="pending"),p=this.query.trim().toLocaleLowerCase(),g=t.filter(n=>n.name.toLocaleLowerCase().includes(p)?this.filter==="all"||this.filter==="online"&&n.online||this.filter==="attention"&&i.includes(n):!1),r=Math.max(1,Math.ceil(g.length/x)),w=Math.min(this.page,r-1),u=g.slice(w*x,(w+1)*x),f=e.default_zone??S;return a`
      <div class="stats" data-wiskey-stats aria-label="סיכום">
        <sw-kpi icon="door" tone=${t.length&&t.every(n=>n.online)?"live":t.some(n=>!n.online)?"offline":"neutral"} label=${c("online_stations")} value=${`⁦${t.filter(n=>n.online).length} / ${t.length}⁩`}></sw-kpi>
        <sw-kpi icon="bell" tone=${s.length?"stale":"neutral"} label=${c("ringing_now")} value=${String(s.length)}></sw-kpi>
      </div>
      <div class=${i.length?"layout with-side":"layout"}>
        <div class="main">
          <div class="toolbar">
            <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wiskey-search aria-label=${c("wall_search")} placeholder=${c("wall_search")} .value=${this.query} @input=${n=>{this.query=n.target.value,this.page=0}} /></label>
            <div class="filters" role="group" aria-label=${c("wk4_door_filter")}>
              ${["all","online","attention"].map(n=>a`<sw-chip data-wiskey-filter=${n} ?selected=${this.filter===n} aria-pressed=${this.filter===n} @click=${()=>{this.filter=n,this.page=0}}>${c("wk4_filter_"+n)}</sw-chip>`)}
            </div>
            <span class="count" data-wiskey-count>${g.length} ${c("devices")}</span>
          </div>
          ${g.length?a`<div class="grid">${j(u,n=>n.id,n=>this.renderDoor(n,f))}</div>`:a`<sw-state-panel icon="door" compact state="empty" data-wiskey-empty heading=${t.length?"לא נמצאו דלתות תואמות":c("no_stations")}></sw-state-panel>`}
          ${r>1?a`<div class="pager">
                <sw-button size="sm" variant="ghost" ?disabled=${w===0} @click=${()=>this.page=w-1}>${c("wall_previous")}</sw-button>
                <span role="status"><bdi>${w+1} / ${r}</bdi></span>
                <sw-button size="sm" variant="ghost" ?disabled=${w+1>=r} @click=${()=>this.page=w+1}>${c("wall_next")}</sw-button>
              </div>`:h}
        </div>
        ${i.length?a`<aside class="side">
              <sw-card heading=${c("access_attention")} data-wiskey-attention>
                <sw-badge slot="actions" kind="stale" label=${String(i.length)}></sw-badge>
                ${i.slice(0,5).map(n=>a`<div class="attn"><strong>${n.name}</strong><small>${n.online?n.last_error||c("pending_sync"):c("offline")}</small></div>`)}
              </sw-card>
            </aside>`:h}
      </div>
    `}renderDoor(e,t){const s=e.online?e.call_state==="ringing"?"ringing":"online":"offline",i=s==="offline"?"offline":s==="ringing"?"stale":"live";return a`<article class="door ${s}" data-wiskey-door=${e.id} data-status=${s}>
      <div class="door-head">
        <span class="ic"><sw-icon name=${e.online?"door":"offline"} size=${18}></sw-icon></span>
        <div class="title">
          <b title=${e.name}>${e.name}</b>
          <small>${!e.online&&e.last_seen?a`${c("last_seen")}: <bdi>${T(e.last_seen,"he-IL",t)}</bdi>`:c("access_by_permissions")}</small>
        </div>
        <sw-badge kind=${i} label=${c(s)}></sw-badge>
      </div>
      ${s==="ringing"?a`<div class="ring" role="status"><sw-icon name="bell" size=${14}></sw-icon>${c("ringing")}</div>`:h}
      ${this.renderStill(e)}
      <div class="facts">
        <span>${e.lock_enabled?e.lock_count>1?`${c("lock_enabled")} · ${e.lock_count}`:c("lock_enabled"):c("camera_only")}</span>
        <span>סנכרון: ${c(e.sync_state)}</span>
        ${e.online&&e.call_state!=="ringing"?a`<span>שיחה: ${c(e.call_state)}</span>`:h}
      </div>
      ${this.canAct()||this.canOpen(e)?this.renderActions(e):h}
    </article>`}renderStill(e){if(!e.camera_entity)return h;const t=this.posterBust,s=U("go2rtc")?this.cameraAccess[e.id]??"ready":"no_media",i=e.online?s!=="ready"?s:this.stillFailed[e.id]===t?"unavailable":"image":"offline";return a`<div class="still" data-wiskey-camera=${e.id} data-camera-state=${i}>
      ${i==="image"?a`<img
              src=${q(e.id,t)}
              alt=${`מצלמה · ${e.name}`}
              decoding="async"
              @error=${()=>this.stillFailed={...this.stillFailed,[e.id]:t}}
            /><span class="tag">צילום</span>`:a`<div class="none" role="status">
            <sw-icon name=${i==="offline"?"offline":"camera"} size=${20}></sw-icon>
            <span>${ae[i]}</span>
          </div>`}
    </div>`}renderActions(e){const t=this.feed?.state==="ready",s=e.lock_enabled?e.locks:[],i=e.online&&e.call_state==="ringing",p=e.online&&e.call_state==="in_call",g=this.results[e.id],r=this.ttsStatus[e.id],w=r?.state==="closed"?"warn":"ok";return a`<div class="actions" data-wiskey-actions=${e.id}>
      ${(i||p)&&this.canAct()?a`<div class="row call" role="group" aria-label="שליטה בשיחה" data-wiskey-call>
            ${(i?["answer","reject"]:["hangUp"]).map(u=>{const f=this.armed?.id===e.id&&this.armed.command===u&&this.armed.callState===e.call_state;return a`<sw-button
                size="sm"
                variant=${u==="answer"?"primary":"danger"}
                icon=${u==="answer"?"check":"close"}
                data-wiskey-call-command=${u}
                data-armed=${f?"true":"false"}
                ?disabled=${!t||this.callBusy.has(e.id)}
                @click=${n=>this.onCall(n,e,u)}
                >${f?`לחצו שוב ל${_[u]}`:_[u]}</sw-button
              >`})}
          </div>`:h}
      <div class="row">
        ${(this.canOpen(e)?s:[]).map(u=>{const f=F(e,u),n=`${e.id}/${u.physical_index}`,$=this.isHeld(n);return a`<sw-button
            size="sm"
            icon="unlock"
            data-wiskey-release=${u.physical_index}
            data-held=${$?"true":"false"}
            ?disabled=${!t||!e.online||this.releasing.has(n)||$}
            @click=${()=>this.askRelease(e,u)}
            >${$?"ממתין לבירור…":f?`שחרור ${f}`:"שחרור דלת"}</sw-button
          >`})}
        ${e.online&&this.canAct()?a`<sw-button size="sm" variant="ghost" icon="volume" data-wiskey-speak ?disabled=${!t} @click=${()=>this.openSpeak(e)}>הכרזה</sw-button>`:h}
      </div>
      ${g?a`<div class="result ${g.tone}" role="status" data-wiskey-result>${g.text}</div>`:h}
      ${r?a`<div class="result ${w}" role="status" data-wiskey-tts-status=${r.state}>${he(r)}</div>`:h}
    </div>`}};l.styles=J`
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 240px));
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
  `;o([d()],l.prototype,"feed",2);o([d()],l.prototype,"error",2);o([d()],l.prototype,"forbidden",2);o([d()],l.prototype,"query",2);o([d()],l.prototype,"filter",2);o([d()],l.prototype,"page",2);o([d()],l.prototype,"confirmRelease",2);o([d()],l.prototype,"releasing",2);o([d()],l.prototype,"results",2);o([d()],l.prototype,"held",2);o([d()],l.prototype,"callBusy",2);o([d()],l.prototype,"armed",2);o([d()],l.prototype,"speakFor",2);o([d()],l.prototype,"engines",2);o([d()],l.prototype,"enginesNote",2);o([d()],l.prototype,"ttsEngine",2);o([d()],l.prototype,"ttsLanguage",2);o([d()],l.prototype,"ttsMessage",2);o([d()],l.prototype,"ttsBusy",2);o([d()],l.prototype,"ttsError",2);o([d()],l.prototype,"ttsStatus",2);o([d()],l.prototype,"ttsFixed",2);o([d()],l.prototype,"ttsPreselected",2);o([d()],l.prototype,"ttsMissingEngine",2);o([d()],l.prototype,"ttsMissingLanguage",2);o([d()],l.prototype,"posterBust",2);o([d()],l.prototype,"stillFailed",2);l=o([Y("wiskey-overview")],l);export{R as FEED_PANELS,l as WiskeyOverview,pe as feedBadge};
//# sourceMappingURL=wiskey-overview-8oMSqnsR.js.map
