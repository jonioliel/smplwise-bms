import{a as J,S as Z,dy as ee,ad as te,qQ as se,qR as ie,qS as ae,qT as oe,qU as re,qV as K,eC as ne,i as R,bA as le,eF as de,K as ce,T as F,qW as he,A as d,b_ as L,e as n,ak as v,qI as ue,qF as pe,qH as we,qX as me,qG as ge,qY as fe,P as be,eV as ve,eT as $e,qL as C,C as xe,E as ye,F as Y,G as u,H as ke}from"./index-RQSOD4tp.js";import{o as Se,r as ze,m as Te,s as Me,a as _e,b as Re,c as H,w as A,d as Ce}from"./wall-arrangement-KbnHMV58.js";import{K as Ee,a as Oe,b as Ie,w as Ne,k as z,c as Be,d as Pe}from"./wall-phone-bar-DkxilrET.js";import"./sw-logo-art-Va6y_cIM.js";const Q=[1,2,4,6,8,9,12,16,20,25,32,40,48,64,80,100],$=9999,w="all";function E(e){return Q.filter(t=>t<e)}function T(e,t){return e>=t||e===$||!E(t).includes(e)?w:String(e)}function q(e,t){return Math.max(1,Math.min(e===$?t:e,Math.max(t,1)))}function Ke(e){return e===w?$:Number(e)||0}function W(e){if(e===w)return $;const t=Number(e??0);return Q.includes(t)?t:0}const Fe=e=>e===$?w:String(e),Le=[0,1,2,3,4,5,6];function He(e,t){const s=[];let a=0,i=0;for(const o of e){const l=Math.min(Math.max(1,o),t);i+l>t&&(a+=1,i=0),s.push({row:a,col:i}),i+=l}return s}function Ae(e,t){const s=He(e,t);return s.length?s[s.length-1].row+1:0}var qe=Object.defineProperty,We=Object.getOwnPropertyDescriptor,h=(e,t,s,a)=>{for(var i=a>1?void 0:a?We(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&qe(t,s,i),i};const O="sw.wall.quality";function De(){try{const e=localStorage.getItem(O);return e==="main"||e==="sub"?e:"auto"}catch{return"auto"}}const Ve=14,Ue=8,D=()=>window.innerWidth<768?Ue:Ve,V="sw.wall.count",U=[{id:"all",label:"כל המצלמות"},{id:"outside",label:"חוץ"},{id:"inside",label:"פנים"},{id:"night",label:"לילה"}];let c=class extends J{constructor(){super(...arguments),this.bubbleSkin=new Z(this),this.tabsMode=new ee(this,"security"),this.phone=new te(this),this.cameras="",this.fromMap=!1,this.count=4,this.stream=De(),this.liveSet=new Set,this.snapBust=Date.now(),this.inView=new Set,this.refused=new Map,this.wanted=new Set,this.graceTimers=new Map,this.liveOrder=[],this.liveCap=16,this.capNote=null,this.ioMargin=-1,this.observed=new WeakSet,this.view="all",this.cams=null,this.recorders=[],this.recorderFilter=(()=>{try{return localStorage.getItem("sw.wall.recorder")??""}catch{return""}})(),this.settings=null,this.error="",this.posterBust=Date.now(),this.canManage=!1,this.editingRows=null,this.dialogError="",this.dialogBusy=!1,this.editingOriginal=new Map,this.allCams=[],this.colsOverride=(()=>{try{return Number(localStorage.getItem("sw.wall.cols")??0)||0}catch{return 0}})(),this.keyHintText="",this.hintTimer=0,this.hintHideTimer=0,this.hintKey=null,this.hintStart=null,this.onKeyPress=e=>{this.hintKey=null,window.clearTimeout(this.hintTimer);const t=this.keyOf(e);t&&(this.hintStart={x:e.clientX,y:e.clientY},this.hintTimer=window.setTimeout(()=>{this.hintKey=t,this.keyHintText=t.getAttribute("data-hint")??"",window.clearTimeout(this.hintHideTimer),this.hintHideTimer=window.setTimeout(()=>this.keyHintText="",Ee)},Oe))},this.onKeyMove=e=>{this.hintStart&&Math.hypot(e.clientX-this.hintStart.x,e.clientY-this.hintStart.y)>Ie&&this.onKeyRelease()},this.onKeyRelease=()=>{window.clearTimeout(this.hintTimer),this.hintStart=null},this.onKeyClick={handleEvent:e=>{this.hintKey&&this.keyOf(e)===this.hintKey&&(e.preventDefault(),e.stopPropagation()),this.hintKey=null},capture:!0},this.onKeyMenu=e=>{this.keyOf(e)&&e.preventDefault()},this.box={w:0,h:0},this.measure=()=>{const e=this.renderRoot.querySelector(".grid");if(!e)return;const t=Math.round(e.clientWidth),s=e.getBoundingClientRect();let a=s.bottom;for(let p=e.nextElementSibling;p;p=p.nextElementSibling)a=Math.max(a,p.getBoundingClientRect().bottom);const i=a-s.bottom,l=Math.round(window.innerHeight-s.top-i-24);(t!==this.box.w||l!==this.box.h)&&(this.box={w:t,h:l})},this.offScreenEdit=null}setCols(e){this.colsOverride=e;try{localStorage.setItem("sw.wall.cols",String(e))}catch{}}get phoneBarMode(){return Ne(this.settings?.["ui.wall_phone_bar"])}keyOf(e){return e.target?.closest?.("[data-wall-key]")??null}bestFit(e){const{w:t,h:s}=this.box,a=e.reduce((o,l)=>o+l,0);if(!t||s<120||a<1)return null;let i={cols:1,tile:0};for(let o=1;o<=a;o++){const l=this.fitTile(e,o,t,s);l>i.tile&&(i={cols:o,tile:l})}return i.tile>80?{cols:i.cols,tile:Math.floor(i.tile)}:null}fitTile(e,t,s,a){const i=D(),o=(s-i*(t-1))/t;if(a<=120)return o;const l=Ae(e.map(g=>Math.min(g,t)),t),p=(a-i*Math.max(0,l-1))/l*(16/9);return Math.min(o,p)}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),window.addEventListener("resize",this.measure)}updated(){this.measure(),this.observeTiles(),this.reallocate()}scrollRoot(){let e=this;for(;e;){const t=e.parentElement??e.getRootNode().host??null;if(!t||!(t instanceof Element))return null;const s=getComputedStyle(t).overflowY;if(s==="auto"||s==="scroll"||s==="overlay")return t;e=t}return null}observeTiles(){if(!this.cams||typeof IntersectionObserver>"u")return;const e=Array.from(this.renderRoot.querySelectorAll("sw-camera-tile[data-cam]"));if(!e.length)return;const t=Math.round(e[0].getBoundingClientRect().height)||180;(!this.io||Math.abs(t-this.ioMargin)>40)&&(this.io?.disconnect(),this.observed=new WeakSet,this.ioMargin=t,this.io=new IntersectionObserver(s=>this.onIntersect(s),{root:this.scrollRoot(),rootMargin:`${t}px 0px ${t}px 0px`}));for(const s of e)this.observed.has(s)||(this.observed.add(s),this.io.observe(s))}onIntersect(e){for(const t of e){const s=t.target.dataset.cam;if(!s)continue;const a=this.graceTimers.get(s);t.isIntersecting?this.inView.add(s):this.inView.delete(s),t.isIntersecting?(a!==void 0&&window.clearTimeout(a),this.graceTimers.delete(s),this.wanted.add(s)):this.wanted.has(s)&&a===void 0&&this.graceTimers.set(s,window.setTimeout(()=>{this.graceTimers.delete(s),this.wanted.delete(s),this.reallocate()},se))}this.reallocate()}reallocate(){if(!this.cams)return;const e=new Set(this.liveOrder);for(const i of[...this.wanted])e.has(i)||this.wanted.delete(i);const t=Math.min(this.liveCap,this.ceiling??this.liveCap),s=new Set([...this.wanted].filter(i=>!this.refused.has(i))),a=typeof IntersectionObserver>"u"?new Set(this.liveOrder.filter(i=>!this.refused.has(i)).slice(0,t)):ie(this.liveOrder,s,this.liveSet,t);ae(a,this.liveSet)||(this.liveSet=a)}onPlayerStatus(e){if(e.detail?.code!=="remote_live_cap")return;const a=e.composedPath().find(i=>i instanceof HTMLElement&&i.dataset?.cam)?.dataset.cam;!a||this.refused.has(a)||(this.ceiling=Math.min(this.ceiling??1/0,Math.max(1,this.liveSet.size-(this.liveSet.has(a)?1:0))),this.refused.set(a,window.setTimeout(()=>{this.refused.delete(a),this.refused.size||(this.ceiling=void 0),this.reallocate()},oe)),this.reallocate())}restartSnapTimer(){window.clearInterval(this.snapTimer),this.snapTimer=window.setInterval(()=>{document.hidden||(this.snapBust=Date.now())},re(Number(this.settings?.["snapshots.max_age_s"]??60)))}wallProfile(){return this.stream!=="auto"?this.stream:this.defaultProfile()}defaultProfile(){return K()?this.settings?.["remote.wall_profile"]==="main"?"main":"sub":this.settings?.["media.wall_profile"]??"sub"}setQuality(e){this.stream=e==="main"?"main":e==="sub"?"sub":"auto";try{this.stream==="auto"?localStorage.removeItem(O):localStorage.setItem(O,this.stream)}catch{}}connectedCallback(){super.connectedCallback(),this.offScreenEdit=ne({id:"wall-arrange",label:"סידור הקיר",icon:"grid",can:()=>R()&&this.canManage&&!!this.cams?.length&&!le("wall_arrange"),run:()=>this.openSettings()}),this.load(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.posterBust=Date.now())},6e4),this.restartSnapTimer()}disconnectedCallback(){super.disconnectedCallback(),this.offScreenEdit?.(),this.offScreenEdit=null,window.clearInterval(this.posterTimer),window.clearInterval(this.snapTimer),this.io?.disconnect(),this.io=void 0,this.ioMargin=-1,this.observed=new WeakSet;for(const e of this.graceTimers.values())window.clearTimeout(e);this.graceTimers.clear();for(const e of this.refused.values())window.clearTimeout(e);this.refused.clear(),this.ceiling=void 0,this.inView.clear(),this.wanted.clear(),this.ro?.disconnect(),window.removeEventListener("resize",this.measure),window.clearTimeout(this.hintTimer),window.clearTimeout(this.hintHideTimer),this.keyHintText="",this.hintKey=null}setCount(e){this.count=e;try{localStorage.setItem(V,Fe(e))}catch{}}async load(){if(R())try{const[e,t]=await Promise.all([de(),ce()]);this.error="",this.allCams=e.cameras,this.cams=e.cameras.filter(i=>i.enabled&&i.recorder_enabled!==!1),this.recorders=e.recorders??[],this.recorderFilter&&!this.recorders.some(i=>i.id===this.recorderFilter)&&(this.recorderFilter=""),this.canManage=e.can_sync,this.settings=t,this.restartSnapTimer();let s=0;try{s=W(localStorage.getItem(V))}catch{}const a=s||W(String(t["ui.wall_count"]??""));a&&(this.count=a)}catch(e){this.error=F(e)}}openSettings(){const e=this.cams??[];this.editingOriginal=Se(e),this.editingRows=ze(e),this.dialogError=""}closeSettings(e){if(this.dialogBusy){const t=e?.currentTarget;t&&(t.open=!0);return}this.editingRows=null,this.dialogError=""}moveRow(e,t){this.editingRows&&(this.editingRows=Te(this.editingRows,e,t))}setSpan(e,t){this.editingRows&&(this.editingRows=Me(this.editingRows,e,t))}setHidden(e,t){this.editingRows&&(this.editingRows=_e(this.editingRows,e,t))}async saveSettings(){const e=this.editingRows;if(e){this.dialogBusy=!0,this.dialogError="";try{const t=Re(e,this.editingOriginal,this.allCams);await Promise.all(t.map(s=>he(s.id,s.body))),this.editingRows=null,await this.load()}catch(t){this.dialogError=F(t),await this.load()}finally{this.dialogBusy=!1}}}renderSettingsDialog(){const e=this.editingRows;if(!e)return d;const t=[{v:1,label:"1 עמודה"},{v:2,label:"2 עמודות"},{v:3,label:"3 עמודות"},{v:4,label:"4 עמודות"}];return n`<sw-dialog open heading="סידור הקיר" subheading="סדר הופעה של המצלמות ורוחב אריח בעמודות (למצלמות פנורמיות)" data-wall-settings-dialog @close=${s=>this.closeSettings(s)}>
      <div class="settings-rows" data-wall-settings-rows>
        ${L(e,s=>s.id,(s,a)=>n`<div class="settings-row ${s.hidden?"is-hidden":""}" data-wall-settings-row=${s.id} ?data-wall-row-hidden=${s.hidden}>
            <label class="settings-show"><input type="checkbox" data-wall-show=${s.id} .checked=${!s.hidden} @change=${i=>this.setHidden(a,!i.target.checked)} />מוצגת</label>
            <div class="settings-move">
              <button data-wall-move-up=${s.id} ?disabled=${!H(e,a,-1)} @click=${()=>this.moveRow(a,-1)} aria-label="הזז למעלה">↑</button>
              <button data-wall-move-down=${s.id} ?disabled=${!H(e,a,1)} @click=${()=>this.moveRow(a,1)} aria-label="הזז למטה">↓</button>
            </div>
            <div class="settings-name">${s.name}</div>
            <sw-field label="רוחב"><select data-wall-span=${s.id} .value=${String(s.span)} @change=${i=>this.setSpan(a,Number(i.target.value))}>${t.map(i=>n`<option value=${i.v} ?selected=${i.v===s.span}>${i.label}</option>`)}</select></sw-field>
          </div>`)}
      </div>
      ${this.dialogError?n`<div class="err" data-wall-settings-error>${this.dialogError}</div>`:d}
      <div slot="footer">
        <sw-button variant="primary" icon="check" data-wall-settings-save ?disabled=${this.dialogBusy} @click=${()=>this.saveSettings()}>${this.dialogBusy?"שומר…":"שמור"}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.dialogBusy} @click=${()=>this.closeSettings()}>ביטול</sw-button>
      </div>
    </sw-dialog>`}setRecorder(e){this.recorderFilter=e;try{localStorage.setItem("sw.wall.recorder",e)}catch{}}recorderSelect(e){return this.recorders.length<2?d:n`<sw-field slot=${e?"":"actions"} ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="layers">${this.recorderControl(e)}</sw-field>`}recorderControl(e,t=""){return n`<select aria-label="NVR" data-wall-recorder title=${t||d} @change=${s=>this.setRecorder(s.target.value)}>
      <option value="" ?selected=${!this.recorderFilter}>${e?"כל ה־NVR":"NVR: הכול"}</option>
      ${this.recorders.map(s=>n`<option value=${s.id} ?selected=${s.id===this.recorderFilter}>${s.name}</option>`)}
    </select>`}renderApi(){const e=this.cams&&this.recorderFilter?this.cams.filter(r=>r.recorder_id===this.recorderFilter):this.cams,t=e&&A(e),s=e&&t?e.length-t.length:0;if(this.error)return n`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!t||!e)return n`<sw-state-panel state="loading"></sw-state-panel>`;if(!t.length&&s)return n`<sw-state-panel icon="camera" state="empty" heading="כל המצלמות מוסתרות בקיר" data-wall-all-hidden></sw-state-panel>`;if(!t.length)return n`<sw-state-panel icon="camera" state="empty" heading="אין מצלמות זמינות" hint="המצלמות מתגלות אוטומטית מה־NVR בהפעלה ובכל 10 דקות. אם הרשימה ריקה: בדקו את פרטי ה־NVR בהגדרות ‹ חיבורים, או הריצו סנכרון ידני; ייתכן גם שאין לך הרשאה למצלמות."><div style="margin-block-start:10px"><sw-button @click=${()=>v("/system/devices")}>למצלמות</sw-button></div></sw-state-panel>`;if(!ue())return n`<sw-state-panel icon="camera" state="empty" heading=${pe} hint=${we} actionLabel=${me} data-webrtc-required @action=${()=>window.location.hash=ge}></sw-state-panel>`;const a=this.cameras?this.cameras.split(",").filter(Boolean):[],i=a.length?e.filter(r=>a.includes(r.id)):t,o=a.length?Math.max(1,i.length):q(this.count,i.length),l=i.slice(0,o),p=r=>Math.max(1,Math.min(r.grid_col_span,4)),g=window.innerWidth>=768?this.bestFit(l.map(p)):null,f=this.colsOverride?Math.min(this.colsOverride,Math.max(1,l.length)):g?g.cols:o===1?1:o===2||o<=4?2:o<=9?3:o<=16?4:o<=25?5:6,I=!this.colsOverride&&window.innerWidth<768?Math.min(f,2):f;let m=g&&!this.colsOverride?g:null;if(this.box.w&&(this.colsOverride||!m)){const r=this.fitTile(l.map(k=>Math.min(p(k),I)),f,this.box.w,window.innerWidth<768?0:this.box.h);r>80&&Number.isFinite(r)&&(m={cols:f,tile:Math.floor(r)})}const M=m&&(this.colsOverride||window.innerWidth>=768)?m.tile:0,X=D(),_=K()?Number(this.settings?.["remote.max_live_streams"]??16):null,x=fe(this.settings?.["media.max_live_sessions"]??16,_),y=r=>r.status!=="offline"&&r.can_view_live!==!1,S=r=>r.live_kind==="still";this.liveOrder=l.filter(r=>y(r)&&!S(r)).map(r=>r.id),this.liveCap=x;const N=this.wallProfile(),B=be(this.settings),G=Number(this.settings?.["media.max_live_sessions"]??16);return this.capNote=this.liveOrder.length>x?{live:x,of:this.liveOrder.length,where:_!=null&&_<=G?"גישה מרחוק":"מדיה"}:null,n`
      <div class="grid ${m?"fit":""}" style="--cols:${f};--tile:${m?`${m.tile}px`:"auto"}" data-wall-cols=${f} ?data-wall-cols-manual=${!!this.colsOverride}>
        ${L(l,r=>r.id,r=>{const k=y(r)&&!S(r)&&this.liveSet.has(r.id),b=Math.min(p(r),I),P=b>1?M?`${b*M+(b-1)*X} / ${M*9/16}`:`${16*b} / 9`:"";return n`<sw-camera-tile
            name=${r.name}
            state=${r.status==="online"?"live":r.status==="offline"?"offline":"unknown"}
            data-cam=${r.id}
            ?live=${k}
            ?snapshotOnly=${y(r)&&!k}
            .stillRefresh=${S(r)&&y(r)?r.still_refresh_s??10:0}
            cameraId=${r.id}
            profile=${N}
            ?autoProfile=${this.stream==="auto"}
            transport=${B}
            .encoding=${r.encoding??null}
            poster=${r.status==="offline"?"":ve(r.id,S(r)?void 0:y(r)&&!k&&this.inView.has(r.id)?this.snapBust:this.posterBust)}
            ?compact=${o>=9}
            @player-status=${j=>this.onPlayerStatus(j)}
            fit=${b>1?"fill":"contain"}
            style=${`grid-column: span ${b}${P?`; aspect-ratio: ${P}`:""}`}
            @click=${()=>v(`/live/cameras/${r.id}`)}></sw-camera-tile>`})}
      </div>
      ${a.length?n`<div class="note" data-wall-picked>מפה: ${l.length} מצלמות שנבחרו${l.length<a.length?` (${a.length-l.length} לא זמינות)`:""} · <a href="#/live/wall">כל המצלמות</a>${this.fromMap?n` · <a href="#" data-back-to-map @click=${r=>{r.preventDefault(),history.back()}}>חזרה למפה</a>`:d}</div>`:d}
      <div class="note">${Ce(l.length,t.length)} · פרופיל ${N==="sub"?"משני":"ראשי"} · תעבורה ${B} · מכסת זרמים ${x}${l.length>x?" — מעבר למכסה מוצג צילום בלבד":""} · צילומים מתרעננים כל דקה${this.phone.matches&&this.capNote?n`<br /><span data-wall-cap-note>מוצגות ${this.capNote.live} מצלמות חיות מתוך ${this.capNote.of} · המכסה: הגדרות ‹ ${this.capNote.where}</span>`:d}</div>
    `}renderDemo(){const e=q(this.count,C.length),t=C.slice(0,e),s=window.innerWidth>=768?this.bestFit(t.map(()=>1)):null,a=s?s.cols:e===1?1:e===2||e<=4?2:e<=9?3:4;return n`
      <div class="grid ${s?"fit":""}" style="--cols:${a};--tile:${s?`${s.tile}px`:"auto"}">
        ${t.map(i=>n`<sw-camera-tile name=${i.name} meta=${`${i.floor} · ${this.stream==="auto"?e>4?"משני":"ראשי":this.stream==="main"?"ראשי":"משני"}`} state=${i.state} scene=${$e[i.id]??"lobby"} ?compact=${e>=9} @click=${()=>v(`/live/cameras/${i.id}`)}></sw-camera-tile>`)}
      </div>
      <div class="note">נתוני הדגמה: קיר של ${e} אריחים אינו פותח ${e} זרמים ראשיים במקביל; במצב אוטומטי מוצג הזרם המשני במטריצה והראשי במיקוד.</div>
    `}openKiosk(){const e=`${window.location.origin}${window.location.pathname}${window.location.search}#/kiosk/all`;window.open(e,"_blank","noopener")}columnsDropdown(e,t=!1){const s=Le.map(i=>({id:String(i),label:i===0?"עמודות אוטו":i===1?"עמודה אחת":`${i} עמודות`})),a=t?z("עמודות בקיר",s.find(i=>i.id===String(this.colsOverride))?.label):"";return n`<sw-dropdown slot=${e?"":"actions"} data-wall-cols-dd tall ?block=${e&&!t} ?icon-only=${t} badge=${t?Be(this.colsOverride):""} ?data-wall-key=${t} data-hint=${a||d}
      label="עמודות בקיר" icon="grid" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
      .items=${s} .value=${String(this.colsOverride)} @change=${i=>this.setCols(Number(i.detail.id)||0)}></sw-dropdown>`}get capsuleField(){return this.tabsMode.ddStyle==="capsule"}qualityControl(e){return n`<select aria-label="איכות" data-wall-quality title=${e} @change=${t=>this.setQuality(t.target.value)}>
        <option value="auto" ?selected=${this.stream==="auto"}>איכות: אוטו</option>
        ${["sub","main"].map(t=>n`<option value=${t} ?selected=${this.stream===t}>איכות: ${t==="sub"?"רגילה":"גבוהה"}</option>`)}
      </select>`}countControl(e,t=""){return n`<select aria-label="מספר מצלמות" data-wall-count-select title=${t||d} @change=${s=>{this.setCount(Ke(s.target.value)),this.cameras&&v("/live/wall")}}>
        ${this.cameras?n`<option value="" selected disabled>נבחרו במפה</option>`:d}
        ${E(e).map(s=>n`<option value=${s} ?selected=${String(s)===T(this.count,e)&&!this.cameras}>${s} מצלמות</option>`)}
        <option value=${w} ?selected=${T(this.count,e)===w&&!this.cameras}>כל המצלמות (${e})</option>
      </select>`}kioskKey(e){return n`<button type="button" class="kiosk" data-open-kiosk aria-label="קיוסק" title="פותח את הקיוסק בלשונית חדשה" ?data-wall-key=${!!e} data-hint=${e||d} @click=${()=>this.openKiosk()}><sw-icon name="expand" size=${e?20:18}></sw-icon></button>`}renderPhoneBar(e,t){return this.phoneBarMode==="labels"?this.renderPhoneBarLabels(e,t):this.renderPhoneBarIcons(e,t)}renderPhoneBarLabels(e,t){return n`<div slot="actions" class="pbar" data-wall-phone-bar data-mode="labels">
      <sw-field ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="camera">${this.qualityControl("איכות הקיר במכשיר הזה (נשמרת בדפדפן)")}</sw-field>
      <sw-field ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="grid">${this.countControl(t)}</sw-field>
      ${e?this.columnsDropdown(!0):d}
      ${e?this.recorderSelect(!0):d}
      ${this.kioskKey("")}
    </div>`}iconKey(e,t,s,a){return n`<sw-field class="ikey" ?data-capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} data-wall-key data-hint=${t} title=${t}><sw-icon name=${e} size=${20} aria-hidden="true"></sw-icon>${s?n`<span class="kbadge" aria-hidden="true">${s}</span>`:d}${a}</sw-field>`}renderPhoneBarIcons(e,t){const s=z("איכות",this.stream==="auto"?"אוטו":this.stream==="sub"?"רגילה":"גבוהה"),a=T(this.count,t),i=z("מספר מצלמות",this.cameras?"נבחרו במפה":a===w?`כל המצלמות (${t})`:`${a} מצלמות`),o=z("NVR",this.recorders.find(l=>l.id===this.recorderFilter)?.name??"כל ה־NVR");return n`<div slot="actions" class="pbar" data-wall-phone-bar data-mode="icons"
      @pointerdown=${this.onKeyPress} @pointermove=${this.onKeyMove} @pointerup=${this.onKeyRelease} @pointercancel=${this.onKeyRelease} @click=${this.onKeyClick} @contextmenu=${this.onKeyMenu}>
      ${this.iconKey("aperture",s,"",this.qualityControl(s))}
      ${this.iconKey("camera",i,Pe(this.count,t,!!this.cameras),this.countControl(t,i))}
      ${e?this.columnsDropdown(!0,!0):d}
      ${e&&this.recorders.length>=2?this.iconKey("layers",o,"",this.recorderControl(!0,o)):d}
      ${this.kioskKey("קיוסק: פותח את הקיוסק בלשונית חדשה")}
      ${this.keyHintText?n`<div class="khint" role="status" data-wall-key-hint>${this.keyHintText}</div>`:d}
    </div>`}render(){const e=R(),t=this.cams&&this.recorderFilter?this.cams.filter(o=>o.recorder_id===this.recorderFilter):this.cams,s=e?t?A(t).length:0:C.length,a=T(this.count,s),i=e?this.renderApi():this.renderDemo();return n`
      <sw-page heading="כל המצלמות" subheading="${s} מצלמות${e?"":` · תצוגה: ${U.find(o=>o.id===this.view)?.label} · נתוני הדגמה`}" wide>
        ${this.phone.matches?this.renderPhoneBar(e,s):d}
        ${e||this.phone.matches?d:n`<sw-field slot="actions" ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="grid"><select aria-label="תצוגה" @change=${o=>this.view=o.target.value}>${U.map(o=>n`<option value=${o.id} ?selected=${o.id===this.view}>${o.label}</option>`)}</select></sw-field>`}
        ${this.phone.matches?d:n`<sw-field slot="actions" ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="camera"><select aria-label="איכות" data-wall-quality title="איכות הקיר במכשיר הזה (נשמרת בדפדפן)" @change=${o=>this.setQuality(o.target.value)}><option value="auto" ?selected=${this.stream==="auto"}>איכות: ברירת מחדל (${this.stream==="auto"?this.wallProfile()==="sub"?"רגילה":"גבוהה":this.defaultProfile()==="sub"?"רגילה":"גבוהה"})</option>${["sub","main"].map(o=>n`<option value=${o} ?selected=${this.stream===o}>איכות: ${o==="sub"?"רגילה":"גבוהה"}</option>`)}</select></sw-field>`}
        ${e&&!this.phone.matches?this.recorderSelect(!1):d}
        ${e&&this.capNote&&!this.phone.matches?n`<span slot="actions" class="note" data-wall-cap-note>מוצגות ${this.capNote.live} מצלמות חיות מתוך ${this.capNote.of} · המכסה: הגדרות ‹ ${this.capNote.where}</span>`:d}
        ${this.phone.matches?d:n`<div slot="actions" class="layouts" role="group" aria-label="פריסה" data-wall-count>
          ${E(s).map(o=>n`<button class=${String(o)===a&&!this.cameras?"on":""} data-count=${o} @click=${()=>{this.setCount(o),this.cameras&&v("/live/wall")}} aria-pressed=${String(o)===a&&!this.cameras}>${o}</button>`)}
          <button class=${a===w&&!this.cameras?"on":""} data-count=${w} @click=${()=>{this.setCount($),this.cameras&&v("/live/wall")}} aria-pressed=${a===w&&!this.cameras}>הכול</button>
        </div>
        ${e?this.columnsDropdown(!1):d}
        <sw-button slot="actions" variant="ghost" icon="expand" data-open-kiosk title="פותח את הקיוסק בלשונית חדשה" @click=${()=>this.openKiosk()}>קיוסק</sw-button>`}
        ${i}
        ${this.renderSettingsDialog()}
      </sw-page>
    `}};c.styles=[ye`
    .layouts {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .layouts button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 28px;
      block-size: 26px;
      border-radius: var(--sw-r-xs);
      cursor: pointer;
      color: var(--sw-text-2);
      padding: 0 6px;
    }
    .layouts button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    @media (hover: hover) and (pointer: fine) {
      .layouts button:hover:not(.on) {
        color: var(--sw-text);
        background: var(--sw-hover-wash);
      }
    }
    .layouts button:focus-visible,
    .pbar .kiosk:focus-visible,
    .settings-move button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    /* a tile that just lost or gained its stream keeps its place; only the picture inside changes (sw-camera-tile) */
    .grid sw-camera-tile {
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease), opacity var(--sw-t-state) var(--sw-ease);
    }
    .grid sw-camera-tile[state='offline'],
    .grid sw-camera-tile[state='unknown'] {
      opacity: 0.92;
    }
    sw-field {
      inline-size: 140px;
    }
    sw-field[capsule] {
      inline-size: auto;
      min-inline-size: 180px;
      max-inline-size: 100%;
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
      /* Owner decision 2026-09-27: the cameras appear in EXACTLY their saved order, even when a spanned camera
         does not fit at the end of a row and that row ends in a gap. This is the default row auto-placement,
         spelled out on purpose: "dense" (used from the T091 review until this decision) filled such gaps by
         pulling a later, narrower camera up ahead of the wider one, so the wall did not show the saved order.
         The tile sizing (fitTile()) uses the exact row count of this placement - simulateStrictRows(). */
      grid-auto-flow: row;
    }
    /* best fit (0.1.68): the tiles fill the screen as a rectangle - as many columns as make the tiles biggest */
    .grid.fit {
      grid-template-columns: repeat(var(--cols), var(--tile));
      justify-content: center;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      line-height: 1.5;
    }
    .note a {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
    }
    .note a:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
      border-radius: var(--sw-r-2xs);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .settings-rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: 50vh;
      overflow-y: auto;
    }
    .settings-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
    }
    .settings-move {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .settings-move button {
      font: inherit;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      border-radius: var(--sw-r-2xs);
      inline-size: 24px;
      block-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
    .settings-move button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .settings-name {
      flex: 1;
      font-size: var(--sw-fs-sm);
    }
    .settings-show {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      cursor: pointer;
      white-space: nowrap;
    }
    /* "לא להציג": dimmed, but every control of the row stays usable (reorder, width, show again) */
    .settings-row.is-hidden {
      opacity: 0.55;
      background: var(--sw-surface-3);
    }
    .settings-row.is-hidden .settings-show {
      opacity: 1;
      color: var(--sw-text);
    }
    /* the phone's toolbar (mobile audit 2026-09-30): quality, count and columns as three compact selects and the kiosk button, one row */
    .pbar {
      display: flex;
      flex-wrap: wrap; /* 2.0.4: with a second recorder the filter makes five controls: they wrap to a second row instead of overflowing at 320 px */
      align-items: center;
      gap: 6px;
      inline-size: 100%;
    }
    /* DROPDOWNFIT-295: every control of the bar has room for its label (basis 150 px: two per row from 330 px, one per row below, the rest wrap); the capsule selects
       and the capsule dropdown share the height / font / ring of the dropdown component, so nothing here sets them. */
    .pbar sw-field {
      flex: 1 1 150px;
      inline-size: auto;
      min-inline-size: 0;
    }
    .pbar sw-field[capsule] {
      min-inline-size: 0;
    }
    .pbar sw-dropdown[block] {
      flex: 1 1 150px;
      min-inline-size: 0;
    }
    .pbar sw-field:not([capsule]) select {
      min-block-size: 44px; /* UXFIX-A11Y-295: 44 px touch target (was 40) */
      padding-inline: 8px;
      font-size: var(--sw-fs-xs);
    }
    .pbar .kiosk {
      flex: none;
      /* SKIN-QA-2403: 44 px in the two-row mode too (it was 40 px there; the icon row already had 44) - the phone's touch target */
      inline-size: 44px;
      block-size: 44px;
      display: grid;
      place-items: center;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      padding: 0;
    }
    /* WALL-PHONE-TOOLBAR-2401 (owner 04.11 evening): the phone's default toolbar is ONE row of icon keys (wall-phone-bar.ts). A key is a 44 px
       square (46 / 44 / 48 px circle in the capsule style, as the capsule dropdown), the icon in the middle, a short number in the corner where
       there is one; the native select lies over the whole key, invisible, so a tap opens the phone's own picker. No text on a key, so nothing is
       cut and nothing ends in an ellipsis; the full name is the accessible name, the tooltip and the long-press bubble (.khint). */
    .pbar[data-mode='icons'] {
      position: relative;
      flex-wrap: nowrap;
      gap: 8px;
    }
    .pbar[data-mode='icons'] .ikey {
      flex: none;
      position: relative;
      display: grid;
      place-items: center;
      gap: 0;
      box-sizing: border-box;
      inline-size: 44px;
      min-inline-size: 44px;
      block-size: 44px;
      border: 1px solid var(--sw-dd-border, var(--sw-border-strong));
      border-radius: var(--sw-dd-radius, 10px);
      background: var(--sw-dd-bg, var(--sw-surface));
      box-shadow: var(--sw-dd-shadow, var(--sw-shadow-1));
      color: var(--sw-accent-text, var(--sw-accent));
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    /* SKIN-QA-2403: a picker key sinks on press like the kiosk key and the columns key beside it (the skin's press scale; 1 in the flat
       skins, which draw no press) - it had no pressed state, so a tap on quality / count gave no feedback until the picker opened */
    .pbar[data-mode='icons'] .ikey:active {
      transform: scale(var(--sw-press-scale, 0.95));
    }
    .pbar[data-mode='icons'] .ikey[data-capsule] {
      inline-size: 46px;
      min-inline-size: 46px;
      block-size: 46px;
      border: 2px solid var(--sw-accent);
      border-radius: var(--sw-r-pill);
      background: linear-gradient(180deg, var(--sw-surface-solid) 0%, color-mix(in srgb, var(--sw-accent) 11%, var(--sw-surface-solid)) 100%);
      box-shadow: 0 3px 8px -3px color-mix(in srgb, var(--sw-accent) 42%, transparent), 0 1px 2px color-mix(in srgb, var(--sw-text) 10%, transparent);
    }
    .pbar[data-mode='icons'] .ikey[data-capsule][dd-size='sm'] {
      inline-size: 44px;
      min-inline-size: 44px;
      block-size: 44px;
    }
    .pbar[data-mode='icons'] .ikey[data-capsule][dd-size='lg'] {
      inline-size: 48px;
      min-inline-size: 48px;
      block-size: 48px;
    }
    /* the select covers the key's border too: the whole drawn key (44 px) is the select's box and its touch target */
    .pbar[data-mode='icons'] .ikey > select {
      --_kb: 1px;
      position: absolute;
      inset: calc(-1 * var(--_kb));
      inline-size: calc(100% + 2 * var(--_kb));
      block-size: calc(100% + 2 * var(--_kb));
      min-inline-size: 0;
      min-block-size: 0;
      margin: 0;
      padding: 0;
      border: 0;
      opacity: 0;
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
    }
    .pbar[data-mode='icons'] .ikey[data-capsule] > select {
      --_kb: 2px;
    }
    .pbar[data-mode='icons'] .ikey:focus-within {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .pbar[data-mode='icons'] .kbadge {
      position: absolute;
      inset-block-start: -3px;
      inset-inline-end: -3px;
      box-sizing: border-box;
      min-inline-size: 18px;
      block-size: 18px;
      padding-inline: 4px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-bold);
      line-height: 18px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 0 0 2px var(--sw-surface);
    }
    .pbar[data-mode='icons'] .kiosk {
      inline-size: 44px;
      block-size: 44px;
      -webkit-touch-callout: none;
      user-select: none;
      -webkit-user-select: none;
    }
    /* the long-press name: under the row, over the wall (it never pushes the tiles down), wraps instead of being cut */
    .pbar .khint {
      position: absolute;
      inset-block-start: calc(100% + 6px);
      inset-inline-start: 0;
      z-index: 5;
      box-sizing: border-box;
      max-inline-size: 100%;
      padding: 6px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-heading);
      /* SKIN-QA-2403: the solid surface - the glass skins' --sw-surface is translucent, which made the words see-through (crystal dark:
         3.3:1 on the bubble) */
      color: var(--sw-surface-solid);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.35;
      white-space: normal;
      overflow-wrap: anywhere;
      box-shadow: var(--sw-shadow-2);
      pointer-events: none;
    }
    @media (max-width: 767px) {
      .grid {
        gap: 8px;
      }
      /* a safe default cap on phones so auto layout never crams tiny tiles - but an explicit column
         choice (owner round 4, 1.7) is a deliberate override and wins even here. */
      .grid:not([data-wall-cols-manual]) {
        grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
      }
    }
    /* R5-LIVE-297 (the HOMEFABLE method on the wall, the grid and its sizing untouched): the tile count is a real segmented control -
       32 px keys, 13 px bold numerals, the chosen count a filled accent key that reads from across the room; hover tints only under a
       fine pointer and a key sinks on pointer-down; a camera that is down is a filled field at full strength (sw-camera-tile), not
       dimmed; the wall-settings rows are wells, not outlined boxes; the phone's kiosk button is a raised key */
    .layouts {
      gap: 3px;
      padding: 3px;
      border-radius: var(--sw-r-md);
    }
    .layouts button {
      min-inline-size: 32px;
      block-size: 32px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
      transition: background-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .layouts button.on {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: var(--sw-shadow-primary);
    }
    .layouts button:hover:not(.on) {
      color: var(--sw-text-2);
      background: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .layouts button:hover:not(.on) {
        color: var(--sw-heading);
        background: var(--sw-surface);
      }
    }
    .layouts button:active {
      transform: scale(var(--sw-press-scale, 0.94));
    }
    .grid sw-camera-tile[state='offline'],
    .grid sw-camera-tile[state='unknown'] {
      opacity: 1;
    }
    .settings-row {
      padding: 8px 10px;
      border-color: transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    .settings-name {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .pbar .kiosk {
      border-color: var(--sw-border);
      color: var(--sw-heading);
      box-shadow: var(--sw-shadow-1);
      transition: transform var(--sw-t-press) var(--sw-ease-out), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    .pbar .kiosk:active {
      transform: scale(var(--sw-press-scale, 0.95));
      box-shadow: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .layouts button:active,
      .pbar .kiosk:active,
      .pbar[data-mode='icons'] .ikey:active {
        transform: none;
      }
    }
    /* R5-LIVE-297 Fable pass: the tile-count tray is a RAISED control (surface, the first shadow, 36 px keys, 15 px / 800 numerals)
       instead of a flat surface-3 tray; the tile grid breathes 14 px; the settings rows are wells with a 15 px name */
    .layouts {
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      border-radius: var(--sw-r-lg);
      padding: 4px;
      gap: 2px;
    }
    .layouts button {
      min-inline-size: 36px;
      block-size: 36px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-md);
      font-weight: 800;
      letter-spacing: -0.01em;
      color: var(--sw-text);
    }
    @media (hover: hover) and (pointer: fine) {
      .layouts button:hover:not(.on) {
        background: var(--sw-surface-2);
      }
    }
    @media (min-width: 768px) {
      .grid {
        gap: 14px;
      }
    }
    .settings-row {
      padding: 10px 12px;
    }
  `,xe];h([Y()],c.prototype,"cameras",2);h([Y({type:Boolean})],c.prototype,"fromMap",2);h([u()],c.prototype,"count",2);h([u()],c.prototype,"stream",2);h([u()],c.prototype,"liveSet",2);h([u()],c.prototype,"snapBust",2);h([u()],c.prototype,"view",2);h([u()],c.prototype,"cams",2);h([u()],c.prototype,"recorders",2);h([u()],c.prototype,"recorderFilter",2);h([u()],c.prototype,"settings",2);h([u()],c.prototype,"error",2);h([u()],c.prototype,"posterBust",2);h([u()],c.prototype,"canManage",2);h([u()],c.prototype,"editingRows",2);h([u()],c.prototype,"dialogError",2);h([u()],c.prototype,"dialogBusy",2);h([u()],c.prototype,"colsOverride",2);h([u()],c.prototype,"keyHintText",2);h([u()],c.prototype,"box",2);c=h([ke("live-wall")],c);export{c as LiveWall,O as WALL_QUALITY_KEY};
//# sourceMappingURL=live-wall-B7iDwsbM.js.map
