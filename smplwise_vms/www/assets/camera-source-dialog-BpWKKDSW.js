import{g as T,b8 as $,bc as _,bb as S,E as R,F as h,G as l,a as N,c4 as C,A as u,e as d,rm as f,qD as v,H as A}from"./index-CCDqf4A8.js";const k=e=>`cameras/${encodeURIComponent(e)}`,E=e=>T(`${k(e)}/source`),L=(e,t)=>_(`${k(e)}/source`,t),z=e=>$("cameras/source/test",e),P=e=>$("cameras/standalone",e),K=e=>S(`cameras/standalone/${encodeURIComponent(e)}`),x={section:"מקור וידאו",fromNvr:"מהמקליט",manual:"כתובת ידנית",fromNvrLead:"הווידאו והתמונות מגיעים מהמקליט, כמו היום.",manualLead:"הווידאו והתמונות מגיעים ישירות מהמצלמה, מהכתובות שלמטה.",current:"המקור כעת: {mode}",change:"שנה מקור…",dialogTitle:"מקור וידאו",dialogSub:"{name}",mainUrl:"כתובת RTSP — זרם ראשי",subUrl:"כתובת RTSP — זרם משני",urlHint:"אם ממלאים רק כתובת אחת, היא משמשת לשני הזרמים.",passwordKept:"הסיסמה שמורה ומוצגת כ־***. כדי להחליף אותה, הקלידו כתובת מלאה.",test:"בדיקת זרם",testing:"בודק…",testOk:"הזרם תקין · {res}{codec}",testEncourage:"מומלץ לבדוק את הזרם לפני השמירה.",save:"שמור",saving:"שומר…",cancel:"ביטול",saved:"מקור הווידאו נשמר.",urlBad:"הכתובת צריכה להתחיל ב־rtsp:// או ב־rtsps://",urlRequired:"יש להזין לפחות כתובת אחת.",healthOk:"המקור עובד",healthFailing:"המקור הידני אינו עובד כרגע. המצלמה נשארת על המקור הזה; בדקו את הכתובת או את המצלמה.",healthUnknown:"המקור עדיין לא נבדק",standaloneNote:"מצלמה ללא מקליט: וידאו חי ותמונות בלבד.",noRecording:"למצלמה ללא מקליט אין הקלטות, אירועי מקליט או הפעלה מחדש דרך מקליט.",noRecorder:"ללא מקליט",addTitle:"הוספת מצלמה ללא מקליט",addButton:"הוסף מצלמה ללא מקליט",addLead:"מצלמה שאינה מחוברת למקליט: וידאו חי ותמונות ישירות ממנה. אין הקלטות.",name:"שם המצלמה",area:"אזור",noArea:"ללא אזור",add:"הוסף",added:"המצלמה נוספה.",listTitle:"מצלמות ללא מקליט",listEmpty:"אין מצלמות ללא מקליט.",remove:"הסר",removeConfirm:'להסיר את "{name}"? המצלמה תוסר מכל המסכים. לא נשמרות ממנה הקלטות.',removed:"המצלמה הוסרה.",edit:"מקור",view:"צפייה",offline:"המקור הידני של המצלמה אינו עונה.",errStale:"ההגדרות השתנו בינתיים. סגרו ופתחו שוב.",errPasswordReenter:"הכתובת השתנתה: יש להקליד שוב את הסיסמה.",errNotAllowed:"הכתובת הזו אינה מותרת כמקור וידאו.",errNotSupported:"הכתובת אינה כתובת RTSP נתמכת (rtsp:// או rtsps://).",errMedia:"שירות הווידאו לא הוגדר, ולכן אי אפשר לבדוק את הזרם.",errRate:"יותר מדי בדיקות ברצף. נסו שוב בעוד דקה.",errForbidden:"אין לך הרשאה לשנות מקורות וידאו.",errLimit:"הגעתם למספר המרבי של מצלמות ללא מקליט.",errName:"יש להזין שם למצלמה.",errGeneric:"הפעולה נכשלה. נסו שוב."},O={section:"Video source",fromNvr:"From the recorder",manual:"Manual address",fromNvrLead:"Video and snapshots come from the recorder, as today.",manualLead:"Video and snapshots come straight from the camera, from the addresses below.",current:"Current source: {mode}",change:"Change source…",dialogTitle:"Video source",dialogSub:"{name}",mainUrl:"RTSP address — main stream",subUrl:"RTSP address — sub stream",urlHint:"If only one address is filled, it serves both streams.",passwordKept:"The password is stored and shown as ***. To replace it, type the full address.",test:"Test stream",testing:"Testing…",testOk:"Stream OK · {res}{codec}",testEncourage:"Testing the stream before saving is recommended.",save:"Save",saving:"Saving…",cancel:"Cancel",saved:"Video source saved.",urlBad:"The address must start with rtsp:// or rtsps://",urlRequired:"Enter at least one address.",healthOk:"The source works",healthFailing:"The manual source is not working right now. The camera stays on it; check the address or the camera.",healthUnknown:"The source has not been checked yet",standaloneNote:"Camera without a recorder: live video and snapshots only.",noRecording:"A camera without a recorder has no recordings, recorder events or restart through a recorder.",noRecorder:"No recorder",addTitle:"Add a camera without a recorder",addButton:"Add camera without a recorder",addLead:"A camera that is not connected to a recorder: live video and snapshots straight from it. No recordings.",name:"Camera name",area:"Area",noArea:"No area",add:"Add",added:"Camera added.",listTitle:"Cameras without a recorder",listEmpty:"No cameras without a recorder.",remove:"Remove",removeConfirm:'Remove "{name}"? The camera leaves every screen. Nothing of it is recorded.',removed:"Camera removed.",edit:"Source",view:"View",offline:"The manual source of the camera is not answering.",errStale:"The settings changed meanwhile. Close and open again.",errPasswordReenter:"The address changed: type the password again.",errNotAllowed:"This address is not allowed as a video source.",errNotSupported:"The address is not a supported RTSP address (rtsp:// or rtsps://).",errMedia:"The video service is not configured, so the stream cannot be tested.",errRate:"Too many tests in a row. Try again in a minute.",errForbidden:"You are not allowed to change video sources.",errLimit:"The maximum number of cameras without a recorder is reached.",errName:"Enter a name for the camera.",errGeneric:"The action failed. Try again."};function F(){return(typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"").startsWith("en")?"en":"he"}const U={he:x,en:O};function a(e,t,r=F()){const s=U[r][e]??x[e]??e;return t?s.replace(/\{(\w+)\}/g,(i,c)=>c in t?String(t[c]):i):s}const q="***";function m(e){const t=e.trim();return t?/^rtsps?:\/\/[^\s]+$/i.test(t)?"":a("urlBad"):""}function b(e,t){if(!e.trim()&&!t.trim())return{ok:!1,reason:a("urlRequired")};const r=m(e)||m(t);return r?{ok:!1,reason:r}:{ok:!0,reason:""}}const w=e=>e.includes(q),y={stale:"errStale",password_reenter:"errPasswordReenter",source_not_allowed:"errNotAllowed",source_not_supported:"errNotSupported",no_stream_source:"urlRequired",url_required:"urlRequired",media_not_configured:"errMedia",rate_limited:"errRate",standalone_limit:"errLimit",name_required:"errName"};function g(e){const t=typeof e=="object"&&e!==null&&"status"in e?Number(e.status):0,r=typeof e=="object"&&e!==null&&"code"in e?String(e.code??""):"";return y[r]?a(y[r]):a(t===403?"errForbidden":t===429?"errRate":"errGeneric")}function M(e){if(!e.ok)return e.message;const t=e.width&&e.height?`${e.width}×${e.height}`:"",r=e.codec_label?`${t?" · ":""}${e.codec_label}`:"";return a("testOk",{res:t,codec:r})}function V(e){return e?.standalone?{recording:!1,reason:a("noRecording")}:{recording:!0,reason:""}}function D(e,t){const r=e?.mode??t?.video_source??"nvr";return a("current",{mode:a(r==="manual"?"manual":"fromNvr")})}function G(e){if(!e||e.mode!=="manual")return null;const t=e.health?.state??"unknown";return t==="ok"?{text:a("healthOk"),tone:"ok"}:t==="failing"?{text:a("healthFailing"),tone:"bad"}:{text:a("healthUnknown"),tone:"muted"}}var I=Object.defineProperty,B=Object.getOwnPropertyDescriptor,n=(e,t,r,s)=>{for(var i=s>1?void 0:s?B(t,r):t,c=e.length-1,p;c>=0;c--)(p=e[c])&&(i=(s?p(t,r,i):p(i))||i);return s&&i&&I(t,r,i),i};let o=class extends N{constructor(){super(...arguments),this.open=!1,this.mode="edit",this.cameraId="",this.cameraName="",this.src=null,this.choice="nvr",this.main="",this.sub="",this.name="",this.area="",this.areas=[],this.loading=!1,this.busy=!1,this.testing=!1,this.test=null,this.error=""}updated(e){e.has("open")&&this.open&&this.reset()}async reset(){if(this.error="",this.test=null,this.busy=!1,this.testing=!1,this.src=null,this.mode==="add"){this.choice="manual",this.main=this.sub=this.name=this.area="",this.loadAreas();return}this.loading=!0;try{const e=await E(this.cameraId);this.src=e,this.choice=e.standalone?"manual":e.mode,this.main=e.main?.url??"",this.sub=e.sub?.url??""}catch(e){this.error=g(e)}finally{this.loading=!1}}async loadAreas(){try{const e=await C();this.areas=e.floors.flatMap(t=>t.areas.map(r=>({id:r.area_id,name:t.floor_id==="none"?r.name:`${r.name} · ${t.name}`})))}catch{this.areas=[]}}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}get standalone(){return this.mode==="add"||!!this.src?.standalone}async runTest(){const e=this.main.trim()||this.sub.trim(),t=this.main.trim()?"main":"sub";if(!(!e||m(e))){this.testing=!0,this.test=null,this.error="";try{this.test=await z({url:e,camera_id:this.mode==="edit"?this.cameraId:null,profile:t})}catch(r){this.test={ok:!1,code:"refused",message:g(r)}}finally{this.testing=!1}}}async save(){if(!this.busy){this.busy=!0,this.error="";try{if(this.mode==="add"){if(!this.name.trim()){this.error=a("errName");return}const e=await P({name:this.name.trim(),area_id:this.area||null,main_url:this.main.trim()||null,sub_url:this.sub.trim()||null});this.dispatchEvent(new CustomEvent("saved",{detail:{camera:e},bubbles:!0,composed:!0}))}else{const e=this.choice==="nvr"?{mode:"nvr",if_revision:this.src?.revision}:{mode:"manual",main_url:this.main.trim()||null,sub_url:this.sub.trim()||null,area_id:this.src?.area_id??null,if_revision:this.src?.revision},t=await L(this.cameraId,e);this.dispatchEvent(new CustomEvent("saved",{detail:{source:t},bubbles:!0,composed:!0}))}this.close()}catch(e){this.error=g(e)}finally{this.busy=!1}}}urlField(e,t,r,s){const i=m(t);return d`<sw-field label=${e}>
        <input dir="ltr" inputmode="url" autocomplete="off" spellcheck="false" maxlength="2048" placeholder="rtsp://user:password@camera:554/stream"
          data-source-url=${s} .value=${t} aria-invalid=${i?"true":"false"}
          @input=${c=>{r(c.target.value),this.test=null}} />
      </sw-field>
      ${i?d`<p class="bad" data-source-url-problem=${s}>${i}</p>`:u}`}renderManual(){const e=w(this.main)||w(this.sub),t=b(this.main,this.sub),r=this.test,s=f(v(),{ready:t.ok,testing:this.testing});return d`
      ${this.urlField(a("mainUrl"),this.main,i=>this.main=i,"main")}
      ${this.urlField(a("subUrl"),this.sub,i=>this.sub=i,"sub")}
      <p class="note">${a("urlHint")}${e?d` ${a("passwordKept")}`:u}</p>
      <div class="test">
        <sw-button size="sm" variant="ghost" icon="live" ?disabled=${!s.canTest} data-source-test @click=${()=>void this.runTest()}>${this.testing?a("testing"):a("test")}</sw-button>
        ${r?d`<div class="result" role="status" data-source-test-result=${r.ok?"ok":"fail"}>
              ${r.ok?d`<img src=${r.preview} alt="" />`:u}
              <span class=${r.ok?"ok":"fail"}>${M(r)}</span>
            </div>`:d`<span class="note" ?data-webrtc-required=${!!s.note}>${s.note||a("testEncourage")}</span>`}
      </div>`}render(){if(!this.open)return u;const e=this.mode==="add",t=this.choice==="nvr"?{ok:!0}:b(this.main,this.sub),r=!this.loading&&!this.busy&&t.ok&&(!e||!!this.name.trim()&&f(v(),{ready:!0,testing:!1}).canAdd);return d`<sw-dialog open heading=${a(e?"addTitle":"dialogTitle")} subheading=${e?a("addLead"):a("dialogSub",{name:this.cameraName})}
        data-camera-source-dialog=${this.mode} @close=${()=>this.close()}>
      <div class="body">
        ${e?d`<div class="row">
              <sw-field label=${a("name")}><input data-source-name maxlength="120" .value=${this.name} @input=${s=>this.name=s.target.value} /></sw-field>
              <sw-field label=${a("area")}><select data-source-area @change=${s=>this.area=s.target.value}>
                <option value="" ?selected=${!this.area}>${a("noArea")}</option>
                ${this.areas.map(s=>d`<option value=${s.id} ?selected=${s.id===this.area}>${s.name}</option>`)}
              </select></sw-field>
            </div>`:this.standalone?d`<p class="lead" data-source-standalone>${a("standaloneNote")}</p>`:d`<div class="seg" role="radiogroup" aria-label=${a("section")} data-source-choice=${this.choice}>
                ${["nvr","manual"].map(s=>d`<button type="button" role="radio" aria-checked=${String(this.choice===s)} ?disabled=${this.loading||this.busy}
                  data-source-mode=${s} @click=${()=>{this.choice=s,this.test=null}}>${a(s==="nvr"?"fromNvr":"manual")}</button>`)}
              </div>
              <p class="lead">${this.choice==="nvr"?a("fromNvrLead"):a("manualLead")}</p>`}
        ${this.choice==="manual"&&!this.loading?this.renderManual():u}
        ${this.error?d`<p class="bad" role="alert" data-source-error>${this.error}</p>`:u}
      </div>
      <div slot="footer">
        <sw-button variant="primary" icon="check" ?disabled=${!r} data-source-save @click=${()=>void this.save()}>${this.busy?a("saving"):a(e?"add":"save")}</sw-button>
        <sw-button variant="ghost" @click=${()=>this.close()}>${a("cancel")}</sw-button>
      </div>
    </sw-dialog>`}};o.styles=R`
    :host {
      display: contents;
    }
    .body {
      display: grid;
      gap: 12px;
      min-inline-size: min(560px, 86vw);
    }
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      justify-self: start;
    }
    .seg button {
      border: 0;
      background: transparent;
      border-radius: 999px;
      padding: 6px 16px;
      min-block-size: 32px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--sw-text-2);
      cursor: pointer;
      transition: background-color 160ms ease, color 160ms ease, transform 120ms ease-out;
    }
    .seg button:active {
      transform: scale(0.97);
    }
    .seg button[aria-checked='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent, var(--sw-text)));
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
    }
    .lead,
    .note {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    input[dir='ltr'] {
      text-align: left;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-sm);
    }
    .bad {
      color: var(--sw-danger-text, var(--sw-danger));
      font-size: var(--sw-fs-sm);
      margin: 0;
    }
    .test {
      display: flex;
      gap: 12px;
      align-items: center;
      min-block-size: 40px;
    }
    .result {
      display: flex;
      gap: 10px;
      align-items: center;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .result img {
      inline-size: 128px;
      block-size: 72px;
      object-fit: cover;
      border-radius: 8px;
      background: var(--sw-surface-2);
      animation: in 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    .result .ok {
      color: var(--sw-success-text, var(--sw-success));
    }
    .result .fail {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    @keyframes in {
      from {
        opacity: 0;
        transform: scale(0.97);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .result img {
        animation: none;
      }
      .seg button {
        transition: none;
      }
    }
    @media (max-width: 640px) {
      .row {
        grid-template-columns: 1fr;
      }
      .result img {
        inline-size: 96px;
        block-size: 54px;
      }
    }
  `;n([h({type:Boolean,reflect:!0})],o.prototype,"open",2);n([h()],o.prototype,"mode",2);n([h({attribute:"camera-id"})],o.prototype,"cameraId",2);n([h({attribute:"camera-name"})],o.prototype,"cameraName",2);n([l()],o.prototype,"src",2);n([l()],o.prototype,"choice",2);n([l()],o.prototype,"main",2);n([l()],o.prototype,"sub",2);n([l()],o.prototype,"name",2);n([l()],o.prototype,"area",2);n([l()],o.prototype,"areas",2);n([l()],o.prototype,"loading",2);n([l()],o.prototype,"busy",2);n([l()],o.prototype,"testing",2);n([l()],o.prototype,"test",2);n([l()],o.prototype,"error",2);o=n([A("camera-source-dialog")],o);export{K as a,g as b,a as c,E as g,G as h,V as r,D as s};
//# sourceMappingURL=camera-source-dialog-BpWKKDSW.js.map
