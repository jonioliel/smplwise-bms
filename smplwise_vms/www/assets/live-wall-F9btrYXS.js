import{a as se,aX as ie,el as ae,a1 as oe,eK as re,lI as ne,lJ as le,lK as de,f7 as ce,lL as he,lM as L,jf as ue,af as M,b3 as pe,eG as H,p as we,q as A,jO as me,A as c,bo as W,ae as fe,b as l,o as E,a8 as $,kl as ge,lC as be,lE as ve,lN as $e,lD as ye,lO as xe,f as ke,eH as Se,eJ as ze,eI as O,j as Me,z as G,k as p,m as Ce}from"./index-bjkrEUAJ.js";import{C as Te,m as D,o as _e,r as Re,a as Ee,b as Oe,c as Be,d as Ie,e as q,w as U,f as Pe}from"./wall-refresh-DNHRJQgk.js";import{b as Ke}from"./bubble-chrome-wRf-BHoZ.js";import{K as Ne,a as Fe,b as Le,w as He,k as C,c as Ae,d as We}from"./wall-phone-bar-DI4czEOU.js";import{t as i}from"./live-Bmq3HC8D.js";import"./sw-logo-art-PLtEZJxU.js";import"./media-BZ0T2v6O.js";const J=[1,2,4,6,8,9,12,16,20,25,32,40,48,64,80,100],y=9999,m="all";function B(e){return J.filter(t=>t<e)}function T(e,t){return e>=t||e===y||!B(t).includes(e)?m:String(e)}function V(e,t){return Math.max(1,Math.min(e===y?t:e,Math.max(t,1)))}function De(e){return e===m?y:Number(e)||0}function Y(e){if(e===m)return y;const t=Number(e??0);return J.includes(t)?t:0}const qe=e=>e===y?m:String(e),Ue=[0,1,2,3,4,5,6];function Ve(e,t){const s=[];let o=0,a=0;for(const r of e){const d=Math.min(Math.max(1,r),t);a+d>t&&(o+=1,a=0),s.push({row:o,col:a}),a+=d}return s}function Ye(e,t){const s=Ve(e,t);return s.length?s[s.length-1].row+1:0}var Qe=Object.defineProperty,Xe=Object.getOwnPropertyDescriptor,u=(e,t,s,o)=>{for(var a=o>1?void 0:o?Xe(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(a=(o?d(t,s,a):d(a))||a);return o&&a&&Qe(t,s,a),a};const I="sw.wall.quality";function je(){try{const e=localStorage.getItem(I);return e==="main"||e==="sub"?e:"auto"}catch{return"auto"}}const Ge=14,Je=8,Q=()=>window.innerWidth<768?Je:Ge,X="sw.wall.count",j=[{id:"all",label:i("כל המצלמות")},{id:"outside",label:i("חוץ")},{id:"inside",label:i("פנים")},{id:"night",label:i("לילה")}];let h=class extends se{constructor(){super(...arguments),this.bubbleSkin=new ie(this),this.tabsMode=new ae(this,"security"),this.phone=new oe(this),this.cameras="",this.fromMap=!1,this.count=4,this.stream=je(),this.liveSet=new Set,this.snapBust=Date.now(),this.poller=new re(this),this.inView=new Set,this.refused=new Map,this.wanted=new Set,this.graceTimers=new Map,this.liveOrder=[],this.liveCap=16,this.capNote=null,this.ioMargin=-1,this.observed=new WeakSet,this.view="all",this.cams=null,this.recorders=[],this.recorderFilter=(()=>{try{return localStorage.getItem("sw.wall.recorder")??""}catch{return""}})(),this.settings=null,this.error="",this.posterBust=Date.now(),this.canManage=!1,this.editingRows=null,this.dialogError="",this.dialogBusy=!1,this.editingOriginal=new Map,this.allCams=[],this.colsOverride=(()=>{try{return Number(localStorage.getItem("sw.wall.cols")??0)||0}catch{return 0}})(),this.keyHintText="",this.hintTimer=0,this.hintHideTimer=0,this.hintKey=null,this.hintStart=null,this.onKeyPress=e=>{this.hintKey=null,window.clearTimeout(this.hintTimer);const t=this.keyOf(e);t&&(this.hintStart={x:e.clientX,y:e.clientY},this.hintTimer=window.setTimeout(()=>{this.hintKey=t,this.keyHintText=t.getAttribute("data-hint")??"",window.clearTimeout(this.hintHideTimer),this.hintHideTimer=window.setTimeout(()=>this.keyHintText="",Ne)},Fe))},this.onKeyMove=e=>{this.hintStart&&Math.hypot(e.clientX-this.hintStart.x,e.clientY-this.hintStart.y)>Le&&this.onKeyRelease()},this.onKeyRelease=()=>{window.clearTimeout(this.hintTimer),this.hintStart=null},this.onKeyClick={handleEvent:e=>{this.hintKey&&this.keyOf(e)===this.hintKey&&(e.preventDefault(),e.stopPropagation()),this.hintKey=null},capture:!0},this.onKeyMenu=e=>{this.keyOf(e)&&e.preventDefault()},this.box={w:0,h:0},this.measure=()=>{const e=this.renderRoot.querySelector(".grid");if(!e)return;const t=Math.round(e.clientWidth),s=e.getBoundingClientRect();let o=s.bottom;for(let w=e.nextElementSibling;w;w=w.nextElementSibling)o=Math.max(o,w.getBoundingClientRect().bottom);const a=o-s.bottom,d=Math.round(window.innerHeight-s.top-a-24);(t!==this.box.w||d!==this.box.h)&&(this.box={w:t,h:d})},this.offScreenEdit=null}setCols(e){this.colsOverride=e;try{localStorage.setItem("sw.wall.cols",String(e))}catch{}}get phoneBarMode(){return He(this.settings?.["ui.wall_phone_bar"])}keyOf(e){return e.target?.closest?.("[data-wall-key]")??null}bestFit(e){const{w:t,h:s}=this.box,o=e.reduce((r,d)=>r+d,0);if(!t||s<120||o<1)return null;let a={cols:1,tile:0};for(let r=1;r<=o;r++){const d=this.fitTile(e,r,t,s);d>a.tile&&(a={cols:r,tile:d})}return a.tile>80?{cols:a.cols,tile:Math.floor(a.tile)}:null}fitTile(e,t,s,o){const a=Q(),r=(s-a*(t-1))/t;if(o<=120)return r;const d=Ye(e.map(g=>Math.min(g,t)),t),w=(o-a*Math.max(0,d-1))/d*(16/9);return Math.min(r,w)}updated(){this.measure(),this.observeTiles(),this.reallocate()}scrollRoot(){let e=this;for(;e;){const t=e.parentElement??e.getRootNode().host??null;if(!t||!(t instanceof Element))return null;const s=getComputedStyle(t).overflowY;if(s==="auto"||s==="scroll"||s==="overlay")return t;e=t}return null}observeTiles(){if(!this.cams||typeof IntersectionObserver>"u")return;const e=Array.from(this.renderRoot.querySelectorAll("sw-camera-tile[data-cam]"));if(!e.length)return;const t=Math.round(e[0].getBoundingClientRect().height)||180;(!this.io||Math.abs(t-this.ioMargin)>40)&&(this.io?.disconnect(),this.observed=new WeakSet,this.ioMargin=t,this.io=new IntersectionObserver(s=>this.onIntersect(s),{root:this.scrollRoot(),rootMargin:`${t}px 0px ${t}px 0px`}));for(const s of e)this.observed.has(s)||(this.observed.add(s),this.io.observe(s))}onIntersect(e){for(const t of e){const s=t.target.dataset.cam;if(!s)continue;const o=this.graceTimers.get(s);t.isIntersecting?this.inView.add(s):this.inView.delete(s),t.isIntersecting?(o!==void 0&&window.clearTimeout(o),this.graceTimers.delete(s),this.wanted.add(s)):this.wanted.has(s)&&o===void 0&&this.graceTimers.set(s,window.setTimeout(()=>{this.graceTimers.delete(s),this.wanted.delete(s),this.reallocate()},ne))}this.reallocate()}reallocate(){if(!this.cams)return;const e=new Set(this.liveOrder);for(const a of[...this.wanted])e.has(a)||this.wanted.delete(a);const t=Math.min(this.liveCap,this.ceiling??this.liveCap),s=new Set([...this.wanted].filter(a=>!this.refused.has(a))),o=typeof IntersectionObserver>"u"?new Set(this.liveOrder.filter(a=>!this.refused.has(a)).slice(0,t)):le(this.liveOrder,s,this.liveSet,t);de(o,this.liveSet)||(this.liveSet=o)}onPlayerStatus(e){if(e.detail?.code!=="remote_live_cap")return;const o=e.composedPath().find(a=>a instanceof HTMLElement&&a.dataset?.cam)?.dataset.cam;!o||this.refused.has(o)||(this.ceiling=Math.min(this.ceiling??1/0,Math.max(1,this.liveSet.size-(this.liveSet.has(o)?1:0))),this.refused.set(o,window.setTimeout(()=>{this.refused.delete(o),this.refused.size||(this.ceiling=void 0),this.reallocate()},ce)),this.reallocate())}restartSnapTimer(){this.isConnected&&this.poller.every("snap",he(Number(this.settings?.["snapshots.max_age_s"]??60)),()=>{this.snapBust=Date.now()})}wallProfile(){return this.stream!=="auto"?this.stream:this.defaultProfile()}defaultProfile(){return L()?this.settings?.["remote.wall_profile"]==="main"?"main":"sub":this.settings?.["media.wall_profile"]??"sub"}setQuality(e){this.stream=e==="main"?"main":e==="sub"?"sub":"auto";try{this.stream==="auto"?localStorage.removeItem(I):localStorage.setItem(I,this.stream)}catch{}}connectedCallback(){super.connectedCallback(),this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this),window.addEventListener("resize",this.measure),this.offScreenEdit=ue({id:"wall-arrange",label:i("סידור הקיר"),icon:"grid",can:()=>M()&&this.canManage&&!!this.cams?.length&&!pe("wall_arrange"),run:()=>this.openSettings()}),this.load(),this.poller.every("poster",6e4,()=>{this.posterBust=Date.now()}),this.poller.every("cameras",Te,()=>this.refreshCameras(),{when:()=>this.cams!==null&&!this.editingRows}),this.restartSnapTimer()}disconnectedCallback(){super.disconnectedCallback(),this.offScreenEdit?.(),this.offScreenEdit=null,this.poller.cancel("poster"),this.poller.cancel("snap"),this.poller.cancel("cameras"),this.io?.disconnect(),this.io=void 0,this.ioMargin=-1,this.observed=new WeakSet;for(const e of this.graceTimers.values())window.clearTimeout(e);this.graceTimers.clear();for(const e of this.refused.values())window.clearTimeout(e);this.refused.clear(),this.ceiling=void 0,this.inView.clear(),this.wanted.clear(),this.ro?.disconnect(),this.ro=void 0,window.removeEventListener("resize",this.measure),window.clearTimeout(this.hintTimer),window.clearTimeout(this.hintHideTimer),this.keyHintText="",this.hintKey=null}setCount(e){this.count=e;try{localStorage.setItem(X,qe(e))}catch{}}async load(){if(M())try{const[e,t]=await Promise.all([H(),we()]);if(!this.isConnected)return;this.error="",this.allCams=e.cameras,this.cams=e.cameras.filter(a=>a.enabled&&a.recorder_enabled!==!1),this.recorders=e.recorders??[],this.recorderFilter&&!this.recorders.some(a=>a.id===this.recorderFilter)&&(this.recorderFilter=""),this.canManage=e.can_sync,this.settings=t,this.restartSnapTimer();let s=0;try{s=Y(localStorage.getItem(X))}catch{}const o=s||Y(String(t["ui.wall_count"]??""));o&&(this.count=o)}catch(e){this.error=A(e)}}async refreshCameras(){if(M())try{const e=await H();if(!this.isConnected||this.editingRows)return;this.allCams=e.cameras,this.cams=D(this.cams,e.cameras.filter(t=>t.enabled&&t.recorder_enabled!==!1)),this.recorders=D(this.recorders,e.recorders??[]),this.recorderFilter&&!this.recorders.some(t=>t.id===this.recorderFilter)&&(this.recorderFilter=""),this.canManage=e.can_sync}catch{}}openSettings(){const e=this.cams??[];this.editingOriginal=_e(e),this.editingRows=Re(e),this.dialogError=""}closeSettings(e){if(this.dialogBusy){const t=e?.currentTarget;t&&(t.open=!0);return}this.editingRows=null,this.dialogError=""}moveRow(e,t){this.editingRows&&(this.editingRows=Ee(this.editingRows,e,t))}setSpan(e,t){this.editingRows&&(this.editingRows=Oe(this.editingRows,e,t))}setHidden(e,t){this.editingRows&&(this.editingRows=Be(this.editingRows,e,t))}async saveSettings(){const e=this.editingRows;if(e){this.dialogBusy=!0,this.dialogError="";try{const t=Ie(e,this.editingOriginal,this.allCams);await Promise.all(t.map(s=>me(s.id,s.body))),this.editingRows=null,await this.load()}catch(t){this.dialogError=A(t),await this.load()}finally{this.dialogBusy=!1}}}renderSettingsDialog(){const e=this.editingRows;if(!e)return c;const t=[{v:1,label:i("1 עמודה")},{v:2,label:i("2 עמודות")},{v:3,label:i("3 עמודות")},{v:4,label:i("4 עמודות")}];return l`<sw-dialog open heading=${i("סידור הקיר")} subheading=${i("סדר הופעה של המצלמות ורוחב אריח בעמודות (למצלמות פנורמיות)")} data-wall-settings-dialog @close=${s=>this.closeSettings(s)}>
      <div class="settings-rows" data-wall-settings-rows>
        ${W(e,s=>s.id,(s,o)=>l`<div class="settings-row ${s.hidden?"is-hidden":""}" data-wall-settings-row=${s.id} ?data-wall-row-hidden=${s.hidden}>
            <label class="settings-show"><sw-toggle size="sm" labelHidden in-label label=${i("מוצגת")} data-wall-show=${s.id} .checked=${!s.hidden} @change=${a=>this.setHidden(o,!fe(a))}></sw-toggle>${i("מוצגת")}</label>
            <div class="settings-move">
              <button data-wall-move-up=${s.id} ?disabled=${!q(e,o,-1)} @click=${()=>this.moveRow(o,-1)} aria-label=${i("הזז למעלה")}>↑</button>
              <button data-wall-move-down=${s.id} ?disabled=${!q(e,o,1)} @click=${()=>this.moveRow(o,1)} aria-label=${i("הזז למטה")}>↓</button>
            </div>
            <div class="settings-name">${s.name}</div>
            <sw-field label=${i("רוחב")}><select data-wall-span=${s.id} .value=${String(s.span)} @change=${a=>this.setSpan(o,Number(a.target.value))}>${t.map(a=>l`<option value=${a.v} ?selected=${a.v===s.span}>${a.label}</option>`)}</select></sw-field>
          </div>`)}
      </div>
      ${this.dialogError?l`<div class="err" data-wall-settings-error>${this.dialogError}</div>`:c}
      <div slot="footer">
        <sw-button variant="primary" icon="check" data-wall-settings-save ?disabled=${this.dialogBusy} @click=${()=>this.saveSettings()}>${this.dialogBusy?i("שומר…"):i("שמור")}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.dialogBusy} @click=${()=>this.closeSettings()}>${i("ביטול")}</sw-button>
      </div>
    </sw-dialog>`}setRecorder(e){this.recorderFilter=e;try{localStorage.setItem("sw.wall.recorder",e)}catch{}}recorderSelect(e){return this.recorders.length<2?c:l`<sw-field slot=${e?"":"actions"} ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="layers">${this.recorderControl(e)}</sw-field>`}recorderControl(e,t=""){return l`<select aria-label=${E("videoCopy.recorder")} data-wall-recorder title=${t||c} @change=${s=>this.setRecorder(s.target.value)}>
      <option value="" ?selected=${!this.recorderFilter}>${e?i("כל המקליטים"):i("מקליט: הכול")}</option>
      ${this.recorders.map(s=>l`<option value=${s.id} ?selected=${s.id===this.recorderFilter}>${s.name}</option>`)}
    </select>`}renderApi(){const e=this.cams&&this.recorderFilter?this.cams.filter(n=>n.recorder_id===this.recorderFilter):this.cams,t=e&&U(e),s=e&&t?e.length-t.length:0;if(this.error)return l`<sw-state-panel state="error" hint=${this.error} actionLabel=${i("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`;if(!t||!e)return l`<sw-state-panel state="loading"></sw-state-panel>`;if(!t.length&&s)return l`<sw-state-panel icon="camera" state="empty" heading=${i("כל המצלמות מוסתרות בקיר")} data-wall-all-hidden></sw-state-panel>`;if(!t.length)return l`<sw-state-panel icon="camera" state="empty" heading=${i("אין מצלמות זמינות")} hint=${i("המצלמות מתגלות אוטומטית מהמקליט בהפעלה ובכל 10 דקות. אם הרשימה ריקה: בדקו את פרטי המקליט בהגדרות ‹ חיבורים, או הריצו סנכרון ידני; ייתכן גם שאין לך הרשאה למצלמות.")}><div style="margin-block-start:10px"><sw-button @click=${()=>$("/system/devices")}>${i("למצלמות")}</sw-button></div></sw-state-panel>`;if(!ge())return l`<sw-state-panel icon="camera" state="empty" heading=${be} hint=${ve} actionLabel=${$e} data-webrtc-required @action=${()=>window.location.hash=ye}></sw-state-panel>`;const o=this.cameras?this.cameras.split(",").filter(Boolean):[],a=o.length?e.filter(n=>o.includes(n.id)):t,r=o.length?Math.max(1,a.length):V(this.count,a.length),d=a.slice(0,r),w=n=>Math.max(1,Math.min(n.grid_col_span,4)),g=window.innerWidth>=768?this.bestFit(d.map(w)):null,b=this.colsOverride?Math.min(this.colsOverride,Math.max(1,d.length)):g?g.cols:r===1?1:r===2||r<=4?2:r<=9?3:r<=16?4:r<=25?5:6,P=!this.colsOverride&&window.innerWidth<768?Math.min(b,2):b;let f=g&&!this.colsOverride?g:null;if(this.box.w&&(this.colsOverride||!f)){const n=this.fitTile(d.map(S=>Math.min(w(S),P)),b,this.box.w,window.innerWidth<768?0:this.box.h);n>80&&Number.isFinite(n)&&(f={cols:b,tile:Math.floor(n)})}const _=f&&(this.colsOverride||window.innerWidth>=768)?f.tile:0,Z=Q(),R=L()?Number(this.settings?.["remote.max_live_streams"]??16):null,x=xe(this.settings?.["media.max_live_sessions"]??16,R),k=n=>n.status!=="offline"&&n.can_view_live!==!1,z=n=>n.live_kind==="still";this.liveOrder=d.filter(n=>k(n)&&!z(n)).map(n=>n.id),this.liveCap=x;const K=this.wallProfile(),N=ke(this.settings),ee=Number(this.settings?.["media.max_live_sessions"]??16);return this.capNote=this.liveOrder.length>x?{live:x,of:this.liveOrder.length,where:R!=null&&R<=ee?i("גישה מרחוק"):i("מדיה")}:null,l`
      <div class="grid ${f?"fit":""}" style="--cols:${b};--tile:${f?`${f.tile}px`:"auto"}" data-wall-cols=${b} ?data-wall-cols-manual=${!!this.colsOverride}>
        ${W(d,n=>n.id,n=>{const S=k(n)&&!z(n)&&this.liveSet.has(n.id),v=Math.min(w(n),P),F=v>1?_?`${v*_+(v-1)*Z} / ${_*9/16}`:`${16*v} / 9`:"";return l`<sw-camera-tile
            name=${n.name}
            state=${n.status==="online"?"live":n.status==="offline"?"offline":"unknown"}
            data-cam=${n.id}
            ?live=${S}
            ?snapshotOnly=${k(n)&&!S}
            .stillRefresh=${z(n)&&k(n)?n.still_refresh_s??10:0}
            cameraId=${n.id}
            profile=${K}
            ?autoProfile=${this.stream==="auto"}
            transport=${N}
            .encoding=${n.encoding??null}
            poster=${n.status==="offline"?"":Se(n.id,z(n)?void 0:k(n)&&!S&&this.inView.has(n.id)?this.snapBust:this.posterBust)}
            ?compact=${r>=9}
            @player-status=${te=>this.onPlayerStatus(te)}
            fit=${v>1?"fill":"contain"}
            style=${`grid-column: span ${v}${F?`; aspect-ratio: ${F}`:""}`}
            @click=${()=>$(`/live/cameras/${n.id}`)}></sw-camera-tile>`})}
      </div>
      ${o.length?l`<div class="note" data-wall-picked>${i("מפה: {n} מצלמות שנבחרו",{n:d.length})}${d.length<o.length?` ${i("({n} לא זמינות)",{n:o.length-d.length})}`:""} ·<a href="#/live/wall">${i("כל המצלמות")}</a>${this.fromMap?l` · <a href="#" data-back-to-map @click=${n=>{n.preventDefault(),history.back()}}>${i("חזרה למפה")}</a>`:c}</div>`:c}
      <div class="note">${Pe(d.length,t.length)} · ${i("פרופיל {profile}",{profile:K==="sub"?i("משני"):i("ראשי")})} · ${i("תעבורה {transport}",{transport:N})} · ${i("מכסת זרמים {n}",{n:x})}${d.length>x?` — ${i("מעבר למכסה מוצג צילום בלבד")}`:""} · ${i("צילומים מתרעננים כל דקה")}${this.phone.matches&&this.capNote?l`<br /><span data-wall-cap-note>${i("מוצגות {live} מצלמות חיות מתוך {of}",{live:this.capNote.live,of:this.capNote.of})} · ${i("המכסה: הגדרות ‹ {where}",{where:this.capNote.where})}</span>`:c}</div>
    `}renderDemo(){const e=V(this.count,O.length),t=O.slice(0,e),s=window.innerWidth>=768?this.bestFit(t.map(()=>1)):null,o=s?s.cols:e===1?1:e===2||e<=4?2:e<=9?3:4;return l`
      <div class="grid ${s?"fit":""}" style="--cols:${o};--tile:${s?`${s.tile}px`:"auto"}">
        ${t.map(a=>l`<sw-camera-tile name=${a.name} meta=${`${a.floor} · ${this.stream==="auto"?e>4?i("משני"):i("ראשי"):this.stream==="main"?i("ראשי"):i("משני")}`} state=${a.state} scene=${ze[a.id]??"lobby"} ?compact=${e>=9} @click=${()=>$(`/live/cameras/${a.id}`)}></sw-camera-tile>`)}
      </div>
      <div class="note">${i("נתוני הדגמה: קיר של {n} אריחים אינו פותח {n} זרמים ראשיים במקביל; במצב אוטומטי מוצג הזרם המשני במטריצה והראשי במיקוד.",{n:e})}</div>
    `}openKiosk(){const e=`${window.location.origin}${window.location.pathname}${window.location.search}#/kiosk/all`;window.open(e,"_blank","noopener")}columnsDropdown(e,t=!1){const s=Ue.map(a=>({id:String(a),label:a===0?i("עמודות אוטו"):a===1?i("עמודה אחת"):i("{n} עמודות",{n:a})})),o=t?C(i("עמודות בקיר"),s.find(a=>a.id===String(this.colsOverride))?.label):"";return l`<sw-dropdown slot=${e?"":"actions"} data-wall-cols-dd tall ?block=${e&&!t} ?icon-only=${t} badge=${t?Ae(this.colsOverride):""} ?data-wall-key=${t} data-hint=${o||c}
      label=${i("עמודות בקיר")} icon="grid" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
      .items=${s} .value=${String(this.colsOverride)} @change=${a=>this.setCols(Number(a.detail.id)||0)}></sw-dropdown>`}get capsuleField(){return this.tabsMode.ddStyle==="capsule"}qualityControl(e){return l`<select aria-label=${i("איכות")} data-wall-quality title=${e} @change=${t=>this.setQuality(t.target.value)}>
        <option value="auto" ?selected=${this.stream==="auto"}>${i("איכות: אוטו")}</option>
        ${["sub","main"].map(t=>l`<option value=${t} ?selected=${this.stream===t}>${i("איכות: {q}",{q:t==="sub"?i("רגילה"):i("גבוהה")})}</option>`)}
      </select>`}countControl(e,t=""){return l`<select aria-label=${i("מספר מצלמות")} data-wall-count-select title=${t||c} @change=${s=>{this.setCount(De(s.target.value)),this.cameras&&$("/live/wall")}}>
        ${this.cameras?l`<option value="" selected disabled>${i("נבחרו במפה")}</option>`:c}
        ${B(e).map(s=>l`<option value=${s} ?selected=${String(s)===T(this.count,e)&&!this.cameras}>${i("{n} מצלמות",{n:s})}</option>`)}
        <option value=${m} ?selected=${T(this.count,e)===m&&!this.cameras}>${i("כל המצלמות ({n})",{n:e})}</option>
      </select>`}kioskKey(e){return l`<button type="button" class="kiosk" data-open-kiosk aria-label=${i("קיוסק")} title=${i("פותח את הקיוסק בלשונית חדשה")} ?data-wall-key=${!!e} data-hint=${e||c} @click=${()=>this.openKiosk()}><sw-icon name="expand" size=${e?20:18}></sw-icon></button>`}renderPhoneBar(e,t){return this.phoneBarMode==="labels"?this.renderPhoneBarLabels(e,t):this.renderPhoneBarIcons(e,t)}renderPhoneBarLabels(e,t){return l`<div slot="actions" class="pbar" data-wall-phone-bar data-mode="labels">
      <sw-field ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="camera">${this.qualityControl(i("איכות הקיר במכשיר הזה (נשמרת בדפדפן)"))}</sw-field>
      <sw-field ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="grid">${this.countControl(t)}</sw-field>
      ${e?this.columnsDropdown(!0):c}
      ${e?this.recorderSelect(!0):c}
      ${this.kioskKey("")}
    </div>`}iconKey(e,t,s,o){return l`<sw-field class="ikey" ?data-capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} data-wall-key data-hint=${t} title=${t}><sw-icon name=${e} size=${20} aria-hidden="true"></sw-icon>${s?l`<span class="kbadge" aria-hidden="true">${s}</span>`:c}${o}</sw-field>`}renderPhoneBarIcons(e,t){const s=C(i("איכות"),this.stream==="auto"?i("אוטו"):this.stream==="sub"?i("רגילה"):i("גבוהה")),o=T(this.count,t),a=C(i("מספר מצלמות"),this.cameras?i("נבחרו במפה"):o===m?i("כל המצלמות ({n})",{n:t}):i("{n} מצלמות",{n:o})),r=C(E("videoCopy.recorder"),this.recorders.find(d=>d.id===this.recorderFilter)?.name??E("videoCopy.recorderAll"));return l`<div slot="actions" class="pbar" data-wall-phone-bar data-mode="icons"
      @pointerdown=${this.onKeyPress} @pointermove=${this.onKeyMove} @pointerup=${this.onKeyRelease} @pointercancel=${this.onKeyRelease} @click=${this.onKeyClick} @contextmenu=${this.onKeyMenu}>
      ${this.iconKey("aperture",s,"",this.qualityControl(s))}
      ${this.iconKey("camera",a,We(this.count,t,!!this.cameras),this.countControl(t,a))}
      ${e?this.columnsDropdown(!0,!0):c}
      ${e&&this.recorders.length>=2?this.iconKey("layers",r,"",this.recorderControl(!0,r)):c}
      ${this.kioskKey(i("קיוסק: פותח את הקיוסק בלשונית חדשה"))}
      ${this.keyHintText?l`<div class="khint" role="status" data-wall-key-hint>${this.keyHintText}</div>`:c}
    </div>`}render(){const e=M(),t=this.cams&&this.recorderFilter?this.cams.filter(r=>r.recorder_id===this.recorderFilter):this.cams,s=e?t?U(t).length:0:O.length,o=T(this.count,s),a=e?this.renderApi():this.renderDemo();return l`
      <sw-page heading=${i("כל המצלמות")} subheading=${`${i("{n} מצלמות",{n:s})}${e?"":` · ${i("תצוגה: {view}",{view:j.find(r=>r.id===this.view)?.label??""})} · ${i("נתוני הדגמה")}`}`} wide>
        ${this.phone.matches?this.renderPhoneBar(e,s):c}
        ${e||this.phone.matches?c:l`<sw-field slot="actions" ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="grid"><select aria-label=${i("תצוגה")} @change=${r=>this.view=r.target.value}>${j.map(r=>l`<option value=${r.id} ?selected=${r.id===this.view}>${r.label}</option>`)}</select></sw-field>`}
        ${this.phone.matches?c:l`<sw-field slot="actions" ?capsule=${this.capsuleField} dd-size=${this.tabsMode.ddSize} icon="camera"><select aria-label=${i("איכות")} data-wall-quality title=${i("איכות הקיר במכשיר הזה (נשמרת בדפדפן)")} @change=${r=>this.setQuality(r.target.value)}><option value="auto" ?selected=${this.stream==="auto"}>${i("איכות: ברירת מחדל ({q})",{q:this.stream==="auto"?this.wallProfile()==="sub"?i("רגילה"):i("גבוהה"):this.defaultProfile()==="sub"?i("רגילה"):i("גבוהה")})}</option>${["sub","main"].map(r=>l`<option value=${r} ?selected=${this.stream===r}>${i("איכות: {q}",{q:r==="sub"?i("רגילה"):i("גבוהה")})}</option>`)}</select></sw-field>`}
        ${e&&!this.phone.matches?this.recorderSelect(!1):c}
        ${e&&this.capNote&&!this.phone.matches?l`<span slot="actions" class="note" data-wall-cap-note>${i("מוצגות {live} מצלמות חיות מתוך {of}",{live:this.capNote.live,of:this.capNote.of})} · ${i("המכסה: הגדרות ‹ {where}",{where:this.capNote.where})}</span>`:c}
        ${this.phone.matches?c:l`<div slot="actions" class="layouts" role="group" aria-label=${i("פריסה")} data-wall-count>
          ${B(s).map(r=>l`<button class=${String(r)===o&&!this.cameras?"on":""} data-count=${r} @click=${()=>{this.setCount(r),this.cameras&&$("/live/wall")}} aria-pressed=${String(r)===o&&!this.cameras}>${r}</button>`)}
          <button class=${o===m&&!this.cameras?"on":""} data-count=${m} @click=${()=>{this.setCount(y),this.cameras&&$("/live/wall")}} aria-pressed=${o===m&&!this.cameras}>${i("הכול")}</button>
        </div>
        ${e?this.columnsDropdown(!1):c}
        <sw-button slot="actions" variant="ghost" icon="expand" data-open-kiosk title=${i("פותח את הקיוסק בלשונית חדשה")} @click=${()=>this.openKiosk()}>${i("קיוסק")}</sw-button>`}
        ${a}
        ${this.renderSettingsDialog()}
      </sw-page>
    `}};h.styles=[Me`
    .layouts {
      display: inline-flex;
    }
    .layouts button {
      border: 0;
      background: transparent;
      font: inherit;
      cursor: pointer;
      padding: 0 6px;
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
      border: 1px solid var(--sw-border);
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
    .layouts button {
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
  `,Ke];u([G()],h.prototype,"cameras",2);u([G({type:Boolean})],h.prototype,"fromMap",2);u([p()],h.prototype,"count",2);u([p()],h.prototype,"stream",2);u([p()],h.prototype,"liveSet",2);u([p()],h.prototype,"snapBust",2);u([p()],h.prototype,"view",2);u([p()],h.prototype,"cams",2);u([p()],h.prototype,"recorders",2);u([p()],h.prototype,"recorderFilter",2);u([p()],h.prototype,"settings",2);u([p()],h.prototype,"error",2);u([p()],h.prototype,"posterBust",2);u([p()],h.prototype,"canManage",2);u([p()],h.prototype,"editingRows",2);u([p()],h.prototype,"dialogError",2);u([p()],h.prototype,"dialogBusy",2);u([p()],h.prototype,"colsOverride",2);u([p()],h.prototype,"keyHintText",2);u([p()],h.prototype,"box",2);h=u([Ce("live-wall")],h);export{h as LiveWall,I as WALL_STREAM_KEY};
