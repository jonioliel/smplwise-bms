import{a as J,S as X,cJ as Z,ac as ee,pJ as te,pK as se,pL as ie,pM as ae,pN as oe,pO as F,dJ as re,i as C,bu as ne,px as le,J as de,R as B,pP as ce,A as u,bv as L,e as n,aj as b,pQ as he,O as ue,dX as pe,dW as we,pE as R,C as me,E as ge,F as K,G as h,H as fe}from"./index-D0R90ECk.js";import{o as ve,r as be,m as $e,s as xe,a as ye,b as Se,c as W,w as A,d as ke}from"./wall-arrangement-KbnHMV58.js";import"./sw-logo-art-Va6y_cIM.js";const Q=[1,2,4,6,8,9,12,16,20,25,32,40,48,64,80,100],$=9999,w="all";function _(e){return Q.filter(t=>t<e)}function O(e,t){return e>=t||e===$||!_(t).includes(e)?w:String(e)}function D(e,t){return Math.max(1,Math.min(e===$?t:e,Math.max(t,1)))}function Me(e){return e===w?$:Number(e)||0}function V(e){if(e===w)return $;const t=Number(e??0);return Q.includes(t)?t:0}const ze=e=>e===$?w:String(e),Ce=[0,1,2,3,4,5,6];function Re(e,t){const s=[];let i=0,a=0;for(const o of e){const l=Math.min(Math.max(1,o),t);a+l>t&&(i+=1,a=0),s.push({row:i,col:a}),a+=l}return s}function Oe(e,t){const s=Re(e,t);return s.length?s[s.length-1].row+1:0}var _e=Object.defineProperty,Te=Object.getOwnPropertyDescriptor,c=(e,t,s,i)=>{for(var a=i>1?void 0:i?Te(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&_e(t,s,a),a};const T="sw.wall.quality";function Ee(){try{const e=localStorage.getItem(T);return e==="main"||e==="sub"?e:"auto"}catch{return"auto"}}const Ie=14,Ne=8,H=()=>window.innerWidth<768?Ne:Ie,U="sw.wall.count",q=[{id:"all",label:"כל המצלמות"},{id:"outside",label:"חוץ"},{id:"inside",label:"פנים"},{id:"night",label:"לילה"}];let d=class extends J{constructor(){super(...arguments),this.bubbleSkin=new X(this),this.tabsMode=new Z(this,"security"),this.phone=new ee(this),this.cameras="",this.fromMap=!1,this.count=4,this.stream=Ee(),this.liveSet=new Set,this.snapBust=Date.now(),this.inView=new Set,this.refused=new Map,this.wanted=new Set,this.graceTimers=new Map,this.liveOrder=[],this.liveCap=16,this.capNote=null,this.ioMargin=-1,this.observed=new WeakSet,this.view="all",this.cams=null,this.recorders=[],this.recorderFilter=(()=>{try{return localStorage.getItem("sw.wall.recorder")??""}catch{return""}})(),this.settings=null,this.error="",this.posterBust=Date.now(),this.canManage=!1,this.editingRows=null,this.dialogError="",this.dialogBusy=!1,this.editingOriginal=new Map,this.allCams=[],this.colsOverride=(()=>{try{return Number(localStorage.getItem("sw.wall.cols")??0)||0}catch{return 0}})(),this.box={w:0,h:0},this.measure=()=>{const e=this.renderRoot.querySelector(".grid");if(!e)return;const t=Math.round(e.clientWidth),s=e.getBoundingClientRect();let i=s.bottom;for(let p=e.nextElementSibling;p;p=p.nextElementSibling)i=Math.max(i,p.getBoundingClientRect().bottom);const a=i-s.bottom,l=Math.round(window.innerHeight-s.top-a-24);(t!==this.box.w||l!==this.box.h)&&(this.box={w:t,h:l})},this.offScreenEdit=null}setCols(e){this.colsOverride=e;try{localStorage.setItem("sw.wall.cols",String(e))}catch{}}bestFit(e){const{w:t,h:s}=this.box,i=e.reduce((o,l)=>o+l,0);if(!t||s<120||i<1)return null;let a={cols:1,tile:0};for(let o=1;o<=i;o++){const l=this.fitTile(e,o,t,s);l>a.tile&&(a={cols:o,tile:l})}return a.tile>80?{cols:a.cols,tile:Math.floor(a.tile)}:null}fitTile(e,t,s,i){const a=H(),o=(s-a*(t-1))/t;if(i<=120)return o;const l=Oe(e.map(g=>Math.min(g,t)),t),p=(i-a*Math.max(0,l-1))/l*(16/9);return Math.min(o,p)}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),window.addEventListener("resize",this.measure)}updated(){this.measure(),this.observeTiles(),this.reallocate()}scrollRoot(){let e=this;for(;e;){const t=e.parentElement??e.getRootNode().host??null;if(!t||!(t instanceof Element))return null;const s=getComputedStyle(t).overflowY;if(s==="auto"||s==="scroll"||s==="overlay")return t;e=t}return null}observeTiles(){if(!this.cams||typeof IntersectionObserver>"u")return;const e=Array.from(this.renderRoot.querySelectorAll("sw-camera-tile[data-cam]"));if(!e.length)return;const t=Math.round(e[0].getBoundingClientRect().height)||180;(!this.io||Math.abs(t-this.ioMargin)>40)&&(this.io?.disconnect(),this.observed=new WeakSet,this.ioMargin=t,this.io=new IntersectionObserver(s=>this.onIntersect(s),{root:this.scrollRoot(),rootMargin:`${t}px 0px ${t}px 0px`}));for(const s of e)this.observed.has(s)||(this.observed.add(s),this.io.observe(s))}onIntersect(e){for(const t of e){const s=t.target.dataset.cam;if(!s)continue;const i=this.graceTimers.get(s);t.isIntersecting?this.inView.add(s):this.inView.delete(s),t.isIntersecting?(i!==void 0&&window.clearTimeout(i),this.graceTimers.delete(s),this.wanted.add(s)):this.wanted.has(s)&&i===void 0&&this.graceTimers.set(s,window.setTimeout(()=>{this.graceTimers.delete(s),this.wanted.delete(s),this.reallocate()},te))}this.reallocate()}reallocate(){if(!this.cams)return;const e=new Set(this.liveOrder);for(const a of[...this.wanted])e.has(a)||this.wanted.delete(a);const t=Math.min(this.liveCap,this.ceiling??this.liveCap),s=new Set([...this.wanted].filter(a=>!this.refused.has(a))),i=typeof IntersectionObserver>"u"?new Set(this.liveOrder.filter(a=>!this.refused.has(a)).slice(0,t)):se(this.liveOrder,s,this.liveSet,t);ie(i,this.liveSet)||(this.liveSet=i)}onPlayerStatus(e){if(e.detail?.code!=="remote_live_cap")return;const i=e.composedPath().find(a=>a instanceof HTMLElement&&a.dataset?.cam)?.dataset.cam;!i||this.refused.has(i)||(this.ceiling=Math.min(this.ceiling??1/0,Math.max(1,this.liveSet.size-(this.liveSet.has(i)?1:0))),this.refused.set(i,window.setTimeout(()=>{this.refused.delete(i),this.refused.size||(this.ceiling=void 0),this.reallocate()},ae)),this.reallocate())}restartSnapTimer(){window.clearInterval(this.snapTimer),this.snapTimer=window.setInterval(()=>{document.hidden||(this.snapBust=Date.now())},oe(Number(this.settings?.["snapshots.max_age_s"]??60)))}wallProfile(){return this.stream!=="auto"?this.stream:this.defaultProfile()}defaultProfile(){return F()?this.settings?.["remote.wall_profile"]==="main"?"main":"sub":this.settings?.["media.wall_profile"]??"sub"}setQuality(e){this.stream=e==="main"?"main":e==="sub"?"sub":"auto";try{this.stream==="auto"?localStorage.removeItem(T):localStorage.setItem(T,this.stream)}catch{}}connectedCallback(){super.connectedCallback(),this.offScreenEdit=re({id:"wall-arrange",label:"סידור הקיר",icon:"grid",can:()=>C()&&this.canManage&&!!this.cams?.length&&!ne("wall_arrange"),run:()=>this.openSettings()}),this.load(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.posterBust=Date.now())},6e4),this.restartSnapTimer()}disconnectedCallback(){super.disconnectedCallback(),this.offScreenEdit?.(),this.offScreenEdit=null,window.clearInterval(this.posterTimer),window.clearInterval(this.snapTimer),this.io?.disconnect(),this.io=void 0,this.ioMargin=-1,this.observed=new WeakSet;for(const e of this.graceTimers.values())window.clearTimeout(e);this.graceTimers.clear();for(const e of this.refused.values())window.clearTimeout(e);this.refused.clear(),this.ceiling=void 0,this.inView.clear(),this.wanted.clear(),this.ro?.disconnect(),window.removeEventListener("resize",this.measure)}setCount(e){this.count=e;try{localStorage.setItem(U,ze(e))}catch{}}async load(){if(C())try{const[e,t]=await Promise.all([le(),de()]);this.error="",this.allCams=e.cameras,this.cams=e.cameras.filter(a=>a.enabled&&a.recorder_enabled!==!1),this.recorders=e.recorders??[],this.recorderFilter&&!this.recorders.some(a=>a.id===this.recorderFilter)&&(this.recorderFilter=""),this.canManage=e.can_sync,this.settings=t,this.restartSnapTimer();let s=0;try{s=V(localStorage.getItem(U))}catch{}const i=s||V(String(t["ui.wall_count"]??""));i&&(this.count=i)}catch(e){this.error=B(e)}}openSettings(){const e=this.cams??[];this.editingOriginal=ve(e),this.editingRows=be(e),this.dialogError=""}closeSettings(e){if(this.dialogBusy){const t=e?.currentTarget;t&&(t.open=!0);return}this.editingRows=null,this.dialogError=""}moveRow(e,t){this.editingRows&&(this.editingRows=$e(this.editingRows,e,t))}setSpan(e,t){this.editingRows&&(this.editingRows=xe(this.editingRows,e,t))}setHidden(e,t){this.editingRows&&(this.editingRows=ye(this.editingRows,e,t))}async saveSettings(){const e=this.editingRows;if(e){this.dialogBusy=!0,this.dialogError="";try{const t=Se(e,this.editingOriginal,this.allCams);await Promise.all(t.map(s=>ce(s.id,s.body))),this.editingRows=null,await this.load()}catch(t){this.dialogError=B(t),await this.load()}finally{this.dialogBusy=!1}}}renderSettingsDialog(){const e=this.editingRows;if(!e)return u;const t=[{v:1,label:"1 עמודה"},{v:2,label:"2 עמודות"},{v:3,label:"3 עמודות"},{v:4,label:"4 עמודות"}];return n`<sw-dialog open heading="סידור הקיר" subheading="סדר הופעה של המצלמות ורוחב אריח בעמודות (למצלמות פנורמיות)" data-wall-settings-dialog @close=${s=>this.closeSettings(s)}>
      <div class="settings-rows" data-wall-settings-rows>
        ${L(e,s=>s.id,(s,i)=>n`<div class="settings-row ${s.hidden?"is-hidden":""}" data-wall-settings-row=${s.id} ?data-wall-row-hidden=${s.hidden}>
            <label class="settings-show"><input type="checkbox" data-wall-show=${s.id} .checked=${!s.hidden} @change=${a=>this.setHidden(i,!a.target.checked)} />מוצגת</label>
            <div class="settings-move">
              <button data-wall-move-up=${s.id} ?disabled=${!W(e,i,-1)} @click=${()=>this.moveRow(i,-1)} aria-label="הזז למעלה">↑</button>
              <button data-wall-move-down=${s.id} ?disabled=${!W(e,i,1)} @click=${()=>this.moveRow(i,1)} aria-label="הזז למטה">↓</button>
            </div>
            <div class="settings-name">${s.name}</div>
            <sw-field label="רוחב"><select data-wall-span=${s.id} .value=${String(s.span)} @change=${a=>this.setSpan(i,Number(a.target.value))}>${t.map(a=>n`<option value=${a.v} ?selected=${a.v===s.span}>${a.label}</option>`)}</select></sw-field>
          </div>`)}
      </div>
      ${this.dialogError?n`<div class="err" data-wall-settings-error>${this.dialogError}</div>`:u}
      <div slot="footer">
        <sw-button variant="primary" icon="check" data-wall-settings-save ?disabled=${this.dialogBusy} @click=${()=>this.saveSettings()}>${this.dialogBusy?"שומר…":"שמור"}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.dialogBusy} @click=${()=>this.closeSettings()}>ביטול</sw-button>
      </div>
    </sw-dialog>`}setRecorder(e){this.recorderFilter=e;try{localStorage.setItem("sw.wall.recorder",e)}catch{}}recorderSelect(e){return this.recorders.length<2?u:n`<sw-field slot=${e?"":"actions"} ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="layers"><select aria-label="NVR" data-wall-recorder @change=${t=>this.setRecorder(t.target.value)}>
      <option value="" ?selected=${!this.recorderFilter}>${e?"כל ה־NVR":"NVR: הכול"}</option>
      ${this.recorders.map(t=>n`<option value=${t.id} ?selected=${t.id===this.recorderFilter}>${t.name}</option>`)}
    </select></sw-field>`}renderApi(){const e=this.cams&&this.recorderFilter?this.cams.filter(r=>r.recorder_id===this.recorderFilter):this.cams,t=e&&A(e),s=e&&t?e.length-t.length:0;if(this.error)return n`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!t||!e)return n`<sw-state-panel state="loading"></sw-state-panel>`;if(!t.length&&s)return n`<sw-state-panel icon="camera" state="empty" heading="כל המצלמות מוסתרות בקיר" data-wall-all-hidden></sw-state-panel>`;if(!t.length)return n`<sw-state-panel icon="camera" state="empty" heading="אין מצלמות זמינות" hint="המצלמות מתגלות אוטומטית מה־NVR בהפעלה ובכל 10 דקות. אם הרשימה ריקה: בדקו את פרטי ה־NVR בהגדרות ‹ חיבורים, או הריצו סנכרון ידני; ייתכן גם שאין לך הרשאה למצלמות."><div style="margin-block-start:10px"><sw-button @click=${()=>b("/system/devices")}>למצלמות</sw-button></div></sw-state-panel>`;const i=this.cameras?this.cameras.split(",").filter(Boolean):[],a=i.length?e.filter(r=>i.includes(r.id)):t,o=i.length?Math.max(1,a.length):D(this.count,a.length),l=a.slice(0,o),p=r=>Math.max(1,Math.min(r.grid_col_span,4)),g=window.innerWidth>=768?this.bestFit(l.map(p)):null,f=this.colsOverride?Math.min(this.colsOverride,Math.max(1,l.length)):g?g.cols:o===1?1:o===2||o<=4?2:o<=9?3:o<=16?4:o<=25?5:6,E=!this.colsOverride&&window.innerWidth<768?Math.min(f,2):f;let m=g&&!this.colsOverride?g:null;if(this.box.w&&(this.colsOverride||!m)){const r=this.fitTile(l.map(S=>Math.min(p(S),E)),f,this.box.w,window.innerWidth<768?0:this.box.h);r>80&&Number.isFinite(r)&&(m={cols:f,tile:Math.floor(r)})}const M=m&&(this.colsOverride||window.innerWidth>=768)?m.tile:0,Y=H(),z=F()?Number(this.settings?.["remote.max_live_streams"]??16):null,x=he(this.settings?.["media.max_live_sessions"]??16,z),y=r=>r.status!=="offline"&&r.can_view_live!==!1,k=r=>r.live_kind==="still";this.liveOrder=l.filter(r=>y(r)&&!k(r)).map(r=>r.id),this.liveCap=x;const I=this.wallProfile(),N=ue(this.settings),j=Number(this.settings?.["media.max_live_sessions"]??16);return this.capNote=this.liveOrder.length>x?{live:x,of:this.liveOrder.length,where:z!=null&&z<=j?"גישה מרחוק":"מדיה"}:null,n`
      <div class="grid ${m?"fit":""}" style="--cols:${f};--tile:${m?`${m.tile}px`:"auto"}" data-wall-cols=${f} ?data-wall-cols-manual=${!!this.colsOverride}>
        ${L(l,r=>r.id,r=>{const S=y(r)&&!k(r)&&this.liveSet.has(r.id),v=Math.min(p(r),E),P=v>1?M?`${v*M+(v-1)*Y} / ${M*9/16}`:`${16*v} / 9`:"";return n`<sw-camera-tile
            name=${r.name}
            state=${r.status==="online"?"live":r.status==="offline"?"offline":"unknown"}
            data-cam=${r.id}
            ?live=${S}
            ?snapshotOnly=${y(r)&&!S}
            .stillRefresh=${k(r)&&y(r)?r.still_refresh_s??10:0}
            cameraId=${r.id}
            profile=${I}
            ?autoProfile=${this.stream==="auto"}
            transport=${N}
            .encoding=${r.encoding??null}
            poster=${r.status==="offline"?"":pe(r.id,k(r)?void 0:y(r)&&!S&&this.inView.has(r.id)?this.snapBust:this.posterBust)}
            ?compact=${o>=9}
            @player-status=${G=>this.onPlayerStatus(G)}
            fit=${v>1?"fill":"contain"}
            style=${`grid-column: span ${v}${P?`; aspect-ratio: ${P}`:""}`}
            @click=${()=>b(`/live/cameras/${r.id}`)}></sw-camera-tile>`})}
      </div>
      ${i.length?n`<div class="note" data-wall-picked>מפה: ${l.length} מצלמות שנבחרו${l.length<i.length?` (${i.length-l.length} לא זמינות)`:""} · <a href="#/live/wall">כל המצלמות</a>${this.fromMap?n` · <a href="#" data-back-to-map @click=${r=>{r.preventDefault(),history.back()}}>חזרה למפה</a>`:u}</div>`:u}
      <div class="note">${ke(l.length,t.length)} · פרופיל ${I==="sub"?"משני":"ראשי"} · תעבורה ${N} · מכסת זרמים ${x}${l.length>x?" — מעבר למכסה מוצג צילום בלבד":""} · צילומים מתרעננים כל דקה${this.phone.matches&&this.capNote?n`<br /><span data-wall-cap-note>מוצגות ${this.capNote.live} מצלמות חיות מתוך ${this.capNote.of} · המכסה: הגדרות ‹ ${this.capNote.where}</span>`:u}</div>
    `}renderDemo(){const e=D(this.count,R.length),t=R.slice(0,e),s=window.innerWidth>=768?this.bestFit(t.map(()=>1)):null,i=s?s.cols:e===1?1:e===2||e<=4?2:e<=9?3:4;return n`
      <div class="grid ${s?"fit":""}" style="--cols:${i};--tile:${s?`${s.tile}px`:"auto"}">
        ${t.map(a=>n`<sw-camera-tile name=${a.name} meta=${`${a.floor} · ${this.stream==="auto"?e>4?"משני":"ראשי":this.stream==="main"?"ראשי":"משני"}`} state=${a.state} scene=${we[a.id]??"lobby"} ?compact=${e>=9} @click=${()=>b(`/live/cameras/${a.id}`)}></sw-camera-tile>`)}
      </div>
      <div class="note">נתוני הדגמה: קיר של ${e} אריחים אינו פותח ${e} זרמים ראשיים במקביל; במצב אוטומטי מוצג הזרם המשני במטריצה והראשי במיקוד.</div>
    `}openKiosk(){const e=`${window.location.origin}${window.location.pathname}${window.location.search}#/kiosk/all`;window.open(e,"_blank","noopener")}columnsDropdown(e){const t=Ce.map(s=>({id:String(s),label:s===0?"עמודות אוטו":s===1?"עמודה אחת":`${s} עמודות`}));return n`<sw-dropdown slot=${e?"":"actions"} data-wall-cols-dd tall ?block=${e} label="עמודות בקיר" icon="grid" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
      .items=${t} .value=${String(this.colsOverride)} @change=${s=>this.setCols(Number(s.detail.id)||0)}></sw-dropdown>`}get capsuleField(){return this.tabsMode.ddStyle==="capsule"}renderPhoneBar(e,t){const s=i=>i==="sub"?"רגילה":"גבוהה";return n`<div slot="actions" class="pbar" data-wall-phone-bar>
      <sw-field ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="camera"><select aria-label="איכות" data-wall-quality title="איכות הקיר במכשיר הזה (נשמרת בדפדפן)" @change=${i=>this.setQuality(i.target.value)}>
        <option value="auto" ?selected=${this.stream==="auto"}>איכות: אוטו</option>
        ${["sub","main"].map(i=>n`<option value=${i} ?selected=${this.stream===i}>איכות: ${s(i)}</option>`)}
      </select></sw-field>
      <sw-field ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="grid"><select aria-label="מספר מצלמות" data-wall-count-select @change=${i=>{this.setCount(Me(i.target.value)),this.cameras&&b("/live/wall")}}>
        ${this.cameras?n`<option value="" selected disabled>נבחרו במפה</option>`:u}
        ${_(t).map(i=>n`<option value=${i} ?selected=${String(i)===O(this.count,t)&&!this.cameras}>${i} מצלמות</option>`)}
        <option value=${w} ?selected=${O(this.count,t)===w&&!this.cameras}>כל המצלמות (${t})</option>
      </select></sw-field>
      ${e?this.columnsDropdown(!0):u}
      ${e?this.recorderSelect(!0):u}
      <button type="button" class="kiosk" data-open-kiosk aria-label="קיוסק" title="פותח את הקיוסק בלשונית חדשה" @click=${()=>this.openKiosk()}><sw-icon name="expand" size=${18}></sw-icon></button>
    </div>`}render(){const e=C(),t=this.cams&&this.recorderFilter?this.cams.filter(o=>o.recorder_id===this.recorderFilter):this.cams,s=e?t?A(t).length:0:R.length,i=O(this.count,s),a=e?this.renderApi():this.renderDemo();return n`
      <sw-page heading="כל המצלמות" subheading="${s} מצלמות${e?"":` · תצוגה: ${q.find(o=>o.id===this.view)?.label} · נתוני הדגמה`}" wide>
        ${this.phone.matches?this.renderPhoneBar(e,s):u}
        ${e||this.phone.matches?u:n`<sw-field slot="actions" ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="grid"><select aria-label="תצוגה" @change=${o=>this.view=o.target.value}>${q.map(o=>n`<option value=${o.id} ?selected=${o.id===this.view}>${o.label}</option>`)}</select></sw-field>`}
        ${this.phone.matches?u:n`<sw-field slot="actions" ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="camera"><select aria-label="איכות" data-wall-quality title="איכות הקיר במכשיר הזה (נשמרת בדפדפן)" @change=${o=>this.setQuality(o.target.value)}><option value="auto" ?selected=${this.stream==="auto"}>איכות: ברירת מחדל (${this.stream==="auto"?this.wallProfile()==="sub"?"רגילה":"גבוהה":this.defaultProfile()==="sub"?"רגילה":"גבוהה"})</option>${["sub","main"].map(o=>n`<option value=${o} ?selected=${this.stream===o}>איכות: ${o==="sub"?"רגילה":"גבוהה"}</option>`)}</select></sw-field>`}
        ${e&&!this.phone.matches?this.recorderSelect(!1):u}
        ${e&&this.capNote&&!this.phone.matches?n`<span slot="actions" class="note" data-wall-cap-note>מוצגות ${this.capNote.live} מצלמות חיות מתוך ${this.capNote.of} · המכסה: הגדרות ‹ ${this.capNote.where}</span>`:u}
        ${this.phone.matches?u:n`<div slot="actions" class="layouts" role="group" aria-label="פריסה" data-wall-count>
          ${_(s).map(o=>n`<button class=${String(o)===i&&!this.cameras?"on":""} data-count=${o} @click=${()=>{this.setCount(o),this.cameras&&b("/live/wall")}} aria-pressed=${String(o)===i&&!this.cameras}>${o}</button>`)}
          <button class=${i===w&&!this.cameras?"on":""} data-count=${w} @click=${()=>{this.setCount($),this.cameras&&b("/live/wall")}} aria-pressed=${i===w&&!this.cameras}>הכול</button>
        </div>
        ${e?this.columnsDropdown(!1):u}
        <sw-button slot="actions" variant="ghost" icon="expand" data-open-kiosk title="פותח את הקיוסק בלשונית חדשה" @click=${()=>this.openKiosk()}>קיוסק</sw-button>`}
        ${a}
        ${this.renderSettingsDialog()}
      </sw-page>
    `}};d.styles=[ge`
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
    .layouts button:hover:not(.on) {
      color: var(--sw-text);
      background: var(--sw-hover-wash);
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
      inline-size: 40px;
      block-size: 40px;
      display: grid;
      place-items: center;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      padding: 0;
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
      .pbar .kiosk:active {
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
  `,me];c([K()],d.prototype,"cameras",2);c([K({type:Boolean})],d.prototype,"fromMap",2);c([h()],d.prototype,"count",2);c([h()],d.prototype,"stream",2);c([h()],d.prototype,"liveSet",2);c([h()],d.prototype,"snapBust",2);c([h()],d.prototype,"view",2);c([h()],d.prototype,"cams",2);c([h()],d.prototype,"recorders",2);c([h()],d.prototype,"recorderFilter",2);c([h()],d.prototype,"settings",2);c([h()],d.prototype,"error",2);c([h()],d.prototype,"posterBust",2);c([h()],d.prototype,"canManage",2);c([h()],d.prototype,"editingRows",2);c([h()],d.prototype,"dialogError",2);c([h()],d.prototype,"dialogBusy",2);c([h()],d.prototype,"colsOverride",2);c([h()],d.prototype,"box",2);d=c([fe("live-wall")],d);export{d as LiveWall,T as WALL_QUALITY_KEY};
//# sourceMappingURL=live-wall-Dt4JXvtv.js.map
