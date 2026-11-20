import{b5 as R,bm as x,br as S,bW as E,cE as N,bG as C,cC as T,bH as z,ed as A,g as L,ax as h,j as d,i as P,lZ as M,A as c,b as l,mG as v,m7 as b,k as I}from"./index-koYOOmpL.js";const k=e=>`cameras/${encodeURIComponent(e)}`,O=e=>R(`${k(e)}/source`),U=(e,t)=>S(`${k(e)}/source`,t),j=e=>x("cameras/source/test",e),q=e=>x("cameras/standalone",e),W=e=>E(`cameras/standalone/${encodeURIComponent(e)}`),g={section:"מקור וידאו",fromNvr:"מהמקליט",manual:"כתובת ידנית",fromNvrLead:"הווידאו והתמונות מגיעים מהמקליט, כמו היום.",manualLead:"הווידאו והתמונות מגיעים ישירות מהמצלמה, מהכתובות שלמטה.",current:"המקור כעת: {mode}",change:"שנה מקור…",dialogTitle:"מקור וידאו",dialogSub:"{name}",mainUrl:"כתובת RTSP — זרם ראשי",subUrl:"כתובת RTSP — זרם משני",urlHint:"אם ממלאים רק כתובת אחת, היא משמשת לשני הזרמים.",passwordKept:"הסיסמה שמורה ומוצגת כ־***. כדי להחליף אותה, הקלידו כתובת מלאה.",test:"בדיקת זרם",testing:"בודק…",testOk:"הזרם תקין · {res}{codec}",testEncourage:"מומלץ לבדוק את הזרם לפני השמירה.",save:"שמור",saving:"שומר…",cancel:"ביטול",saved:"מקור הווידאו נשמר.",urlBad:"הכתובת צריכה להתחיל ב־rtsp:// או ב־rtsps://",urlRequired:"יש להזין לפחות כתובת אחת.",healthOk:"המקור עובד",healthFailing:"המקור הידני אינו עובד כרגע. המצלמה נשארת על המקור הזה; בדקו את הכתובת או את המצלמה.",healthUnknown:"המקור עדיין לא נבדק",standaloneNote:"מצלמה ללא מקליט: וידאו חי ותמונות בלבד.",noRecording:"למצלמה ללא מקליט אין הקלטות, אירועי מקליט או הפעלה מחדש דרך מקליט.",noRecorder:"ללא מקליט",addTitle:"הוספת מצלמה ללא מקליט",addButton:"הוסף מצלמה ללא מקליט",addLead:"מצלמה שאינה מחוברת למקליט: וידאו חי ותמונות ישירות ממנה. אין הקלטות.",name:"שם המצלמה",area:"אזור",noArea:"ללא אזור",add:"הוסף",added:"המצלמה נוספה.",listTitle:"מצלמות ללא מקליט",listEmpty:"אין מצלמות ללא מקליט.",remove:"הסר",removeConfirm:'להסיר את "{name}"? המצלמה תוסר מכל המסכים. לא נשמרות ממנה הקלטות.',removed:"המצלמה הוסרה.",edit:"מקור",view:"צפייה",offline:"המקור הידני של המצלמה אינו עונה.",errStale:"ההגדרות השתנו בינתיים. סגרו ופתחו שוב.",errPasswordReenter:"הכתובת השתנתה: יש להקליד שוב את הסיסמה.",errNotAllowed:"הכתובת הזו אינה מותרת כמקור וידאו.",errNotSupported:"הכתובת אינה כתובת RTSP נתמכת (rtsp:// או rtsps://).",errMedia:"שירות הווידאו לא הוגדר, ולכן אי אפשר לבדוק את הזרם.",errRate:"יותר מדי בדיקות ברצף. נסו שוב בעוד דקה.",errForbidden:"אין לך הרשאה לשנות מקורות וידאו.",errLimit:"הגעתם למספר המרבי של מצלמות ללא מקליט.",errName:"יש להזין שם למצלמה.",errGeneric:"הפעולה נכשלה. נסו שוב."},_=C("en","i18n/camera-sources","en");function F(){return T(["en"])}const D={he:g,en:_};function s(e,t,a=F()){const r=D[a][e]??g[e]??e;return N(r,t)}z("i18n/camera-sources",{he:g,en:_});const B="***";function m(e){const t=e.trim();return t?/^rtsps?:\/\/[^\s]+$/i.test(t)?"":s("urlBad"):""}function w(e,t){if(!e.trim()&&!t.trim())return{ok:!1,reason:s("urlRequired")};const a=m(e)||m(t);return a?{ok:!1,reason:a}:{ok:!0,reason:""}}const $=e=>e.includes(B),y={stale:"errStale",password_reenter:"errPasswordReenter",source_not_allowed:"errNotAllowed",source_not_supported:"errNotSupported",no_stream_source:"urlRequired",url_required:"urlRequired",media_not_configured:"errMedia",rate_limited:"errRate",standalone_limit:"errLimit",name_required:"errName"};function f(e){const t=typeof e=="object"&&e!==null&&"status"in e?Number(e.status):0,a=typeof e=="object"&&e!==null&&"code"in e?String(e.code??""):"";return y[a]?s(y[a]):s(t===403?"errForbidden":t===429?"errRate":"errGeneric")}function G(e){if(!e.ok)return e.message;const t=e.width&&e.height?A(`${e.width}×${e.height}`):"",a=e.codec_label?`${t?" · ":""}${e.codec_label}`:"";return s("testOk",{res:t,codec:a})}function Y(e){return e?.standalone?{recording:!1,reason:s("noRecording")}:{recording:!0,reason:""}}function Z(e,t){const a=e?.mode??t?.video_source??"nvr";return s("current",{mode:s(a==="manual"?"manual":"fromNvr")})}function J(e){if(!e||e.mode!=="manual")return null;const t=e.health?.state??"unknown";return t==="ok"?{text:s("healthOk"),tone:"ok"}:t==="failing"?{text:s("healthFailing"),tone:"bad"}:{text:s("healthUnknown"),tone:"muted"}}var K=Object.defineProperty,H=Object.getOwnPropertyDescriptor,n=(e,t,a,r)=>{for(var o=r>1?void 0:r?H(t,a):t,u=e.length-1,p;u>=0;u--)(p=e[u])&&(o=(r?p(t,a,o):p(o))||o);return r&&o&&K(t,a,o),o};let i=class extends P{constructor(){super(...arguments),this.open=!1,this.mode="edit",this.cameraId="",this.cameraName="",this.src=null,this.choice="nvr",this.main="",this.sub="",this.name="",this.area="",this.areas=[],this.loading=!1,this.busy=!1,this.testing=!1,this.test=null,this.error=""}updated(e){e.has("open")&&this.open&&this.reset()}async reset(){if(this.error="",this.test=null,this.busy=!1,this.testing=!1,this.src=null,this.mode==="add"){this.choice="manual",this.main=this.sub=this.name=this.area="",this.loadAreas();return}this.loading=!0;try{const e=await O(this.cameraId);this.src=e,this.choice=e.standalone?"manual":e.mode,this.main=e.main?.url??"",this.sub=e.sub?.url??""}catch(e){this.error=f(e)}finally{this.loading=!1}}async loadAreas(){try{const e=await M();this.areas=e.floors.flatMap(t=>t.areas.map(a=>({id:a.area_id,name:t.floor_id==="none"?a.name:`${a.name} · ${t.name}`})))}catch{this.areas=[]}}close(){this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}get standalone(){return this.mode==="add"||!!this.src?.standalone}async runTest(){const e=this.main.trim()||this.sub.trim(),t=this.main.trim()?"main":"sub";if(!(!e||m(e))){this.testing=!0,this.test=null,this.error="";try{this.test=await j({url:e,camera_id:this.mode==="edit"?this.cameraId:null,profile:t})}catch(a){this.test={ok:!1,code:"refused",message:f(a)}}finally{this.testing=!1}}}async save(){if(!this.busy){this.busy=!0,this.error="";try{if(this.mode==="add"){if(!this.name.trim()){this.error=s("errName");return}const e=await q({name:this.name.trim(),area_id:this.area||null,main_url:this.main.trim()||null,sub_url:this.sub.trim()||null});this.dispatchEvent(new CustomEvent("saved",{detail:{camera:e},bubbles:!0,composed:!0}))}else{const e=this.choice==="nvr"?{mode:"nvr",if_revision:this.src?.revision}:{mode:"manual",main_url:this.main.trim()||null,sub_url:this.sub.trim()||null,area_id:this.src?.area_id??null,if_revision:this.src?.revision},t=await U(this.cameraId,e);this.dispatchEvent(new CustomEvent("saved",{detail:{source:t},bubbles:!0,composed:!0}))}this.close()}catch(e){this.error=f(e)}finally{this.busy=!1}}}urlField(e,t,a,r){const o=m(t);return l`<sw-field label=${e}>
        <input dir="ltr" inputmode="url" autocomplete="off" spellcheck="false" maxlength="2048" placeholder="rtsp://user:password@camera:554/stream"
          data-source-url=${r} .value=${t} aria-invalid=${o?"true":"false"}
          @input=${u=>{a(u.target.value),this.test=null}} />
      </sw-field>
      ${o?l`<p class="bad" data-source-url-problem=${r}>${o}</p>`:c}`}renderManual(){const e=$(this.main)||$(this.sub),t=w(this.main,this.sub),a=this.test,r=v(b(),{ready:t.ok,testing:this.testing});return l`
      ${this.urlField(s("mainUrl"),this.main,o=>this.main=o,"main")}
      ${this.urlField(s("subUrl"),this.sub,o=>this.sub=o,"sub")}
      <p class="note">${s("urlHint")}${e?l` ${s("passwordKept")}`:c}</p>
      <div class="test">
        <sw-button size="sm" variant="ghost" icon="live" ?disabled=${!r.canTest} data-source-test @click=${()=>void this.runTest()}>${this.testing?s("testing"):s("test")}</sw-button>
        ${a?l`<div class="result" role="status" data-source-test-result=${a.ok?"ok":"fail"}>
              ${a.ok?l`<img src=${a.preview} alt="" />`:c}
              <span class=${a.ok?"ok":"fail"}>${G(a)}</span>
            </div>`:l`<span class="note" ?data-webrtc-required=${!!r.note}>${r.note||s("testEncourage")}</span>`}
      </div>`}render(){if(!this.open)return c;const e=this.mode==="add",t=this.choice==="nvr"?{ok:!0}:w(this.main,this.sub),a=!this.loading&&!this.busy&&t.ok&&(!e||!!this.name.trim()&&v(b(),{ready:!0,testing:!1}).canAdd);return l`<sw-dialog open wide heading=${s(e?"addTitle":"dialogTitle")} subheading=${e?s("addLead"):s("dialogSub",{name:this.cameraName})}
        data-camera-source-dialog=${this.mode} @close=${()=>this.close()}>
      <div class="body">
        ${e?l`<div class="row">
              <sw-field label=${s("name")}><input data-source-name maxlength="120" .value=${this.name} @input=${r=>this.name=r.target.value} /></sw-field>
              <sw-field label=${s("area")}><select data-source-area @change=${r=>this.area=r.target.value}>
                <option value="" ?selected=${!this.area}>${s("noArea")}</option>
                ${this.areas.map(r=>l`<option value=${r.id} ?selected=${r.id===this.area}>${r.name}</option>`)}
              </select></sw-field>
            </div>`:this.standalone?l`<p class="lead" data-source-standalone>${s("standaloneNote")}</p>`:l`<sw-segmented radio label=${s("section")} data-source-choice=${this.choice} value=${this.choice} ?disabled=${this.loading||this.busy}
                @change=${r=>{this.choice=r.detail.value==="manual"?"manual":"nvr",this.test=null}}
                .options=${["nvr","manual"].map(r=>({value:r,label:s(r==="nvr"?"fromNvr":"manual"),attrs:{"data-source-mode":r}}))}></sw-segmented>
              <p class="lead">${this.choice==="nvr"?s("fromNvrLead"):s("manualLead")}</p>`}
        ${this.choice==="manual"&&!this.loading?this.renderManual():c}
        ${this.error?l`<p class="bad" role="alert" data-source-error>${this.error}</p>`:c}
      </div>
      <div slot="footer">
        <sw-button variant="primary" icon="check" ?disabled=${!a} data-source-save @click=${()=>void this.save()}>${this.busy?s("saving"):s(e?"add":"save")}</sw-button>
        <sw-button variant="ghost" @click=${()=>this.close()}>${s("cancel")}</sw-button>
      </div>
    </sw-dialog>`}};i.styles=L`
    :host {
      display: contents;
    }
    .body {
      display: grid;
      gap: 12px;
      min-inline-size: min(560px, 100%); /* EVIDENCE-CAMERAS-2412: never wider than its box (was 86vw) */
    }
    /* CR-CMP2-SEGMENTED-C-2450: the NVR / manual choice is sw-segmented (a radio group); the dialog keeps its pill track and the
       32 px pill key with the small semibold label, the chosen key in the accent with its own soft lift */
    sw-segmented {
      justify-self: start;
      --sw-seg-pad: 3px;
      --sw-seg-gap: 2px;
      --sw-seg-radius: 999px;
      --sw-seg-btn-radius: 999px;
      --sw-seg-h: 32px;
      --sw-seg-key-pad: 16px;
      --sw-seg-fs: var(--sw-fs-sm);
      --sw-seg-fw: 600;
      --sw-seg-on-fw: 600;
      --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-accent, var(--sw-text)));
      --sw-seg-on-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
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
  `;n([h({type:Boolean,reflect:!0})],i.prototype,"open",2);n([h()],i.prototype,"mode",2);n([h({attribute:"camera-id"})],i.prototype,"cameraId",2);n([h({attribute:"camera-name"})],i.prototype,"cameraName",2);n([d()],i.prototype,"src",2);n([d()],i.prototype,"choice",2);n([d()],i.prototype,"main",2);n([d()],i.prototype,"sub",2);n([d()],i.prototype,"name",2);n([d()],i.prototype,"area",2);n([d()],i.prototype,"areas",2);n([d()],i.prototype,"loading",2);n([d()],i.prototype,"busy",2);n([d()],i.prototype,"testing",2);n([d()],i.prototype,"test",2);n([d()],i.prototype,"error",2);i=n([I("camera-source-dialog")],i);export{W as a,f as b,s as c,O as g,J as h,Y as r,Z as s};
