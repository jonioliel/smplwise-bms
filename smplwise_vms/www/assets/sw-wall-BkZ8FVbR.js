const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-BonxfBTz.css"])))=>i.map(i=>d[i]);
import{a as C,ar as L,as as _,at as F,au as W,av as H,G as c,I as i,aw as R,A as S,ax as T,ay as j,az as B,aA as b,aB as J,aC as A,aD as q,aE as D,aF as N,aG as Z,aH as G,aI as K,M as V,aJ as X,aK as Y,aL as Q,aM as O,aN as aa,aO as ea,aP as ta,aQ as sa,aR as ia,aS as na,aT as ra,aU as la,an as oa,ap as h,aq as ca}from"./index-D5l5DMYH.js";import{p as da,v as pa,s as ha,h as wa,d as va,c as ma}from"./screen-overlay-D61mMeFN.js";import"./transit-logic-DKeOUjSD.js";var fa=Object.defineProperty,ua=Object.getOwnPropertyDescriptor,d=(a,e,t,s)=>{for(var n=s>1?void 0:s?ua(e,t):e,p=a.length-1,o;p>=0;p--)(o=a[p])&&(n=(s?o(e,t,n):o(n))||n);return s&&n&&fa(e,t,n),n};const M=[2,4,8,15];let l=class extends C{constructor(){super(...arguments),this.phase="loading",this.data=null,this.states=[],this.healthOk=null,this.now=Date.now(),this.vw=window.innerWidth,this.vh=window.innerHeight,this.panel=!1,this.chipUpdated=!1,this.touchedAt=Date.now(),this.wakeUntil=0,this.tick=0,this.alerts=[],this.announcement=null,this.annClosed="",this.annTimer=0,this.tap=0,this.resolved=[],this.holdStart=null,this.frameIdx=0,this.photos=[],this.order=[],this.frameSwitchAt=0,this.frameListFor="",this.activityAt=Date.now(),this.shownAt=new Map,this.seenUntil=new Map,this.holdTimer=0,this.settings=null,this.ws=null,this.downSince=null,this.timer=0,this.retry=0,this.longPress=0,this.panelTimer=0,this.updatedTimer=0,this.lastStates=0,this.lastHealth=0,this.ok=new Map,this.drop=new Map,this.epoch=new Map,this.tries=new Map,this.nextTry=new Map,this.planLoaded=!1,this.env=L(),this.onResize=()=>{this.vw=window.innerWidth,this.vh=window.innerHeight},this.onTouch=()=>{this.touchedAt=Date.now(),this.activityAt=this.touchedAt,this.data?.config.schedule.wake_on_touch&&(this.wakeUntil=Date.now()+10*6e4)},this.holdBegin=a=>{this.holdStart=Date.now(),window.clearInterval(this.holdTimer),this.holdTimer=window.setInterval(()=>{this.holdStart!==null&&(this.now=Date.now(),_(this.holdStart,this.now)>=1&&(this.holdEnd(),F(a.id).then(()=>this.alerts=this.alerts.filter(e=>e.id!==a.id)).catch(()=>{})))},80)},this.holdEnd=()=>{this.holdStart=null,window.clearInterval(this.holdTimer)},this.lastEmit="",this.pressStart=()=>{window.clearTimeout(this.longPress),this.longPress=window.setTimeout(()=>{this.panel=!0,window.clearTimeout(this.panelTimer),this.panelTimer=window.setTimeout(()=>this.panel=!1,1e4)},1200)},this.pressEnd=()=>window.clearTimeout(this.longPress)}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),window.addEventListener("orientationchange",this.onResize),this.addEventListener("pointerdown",this.onTouch),this.timer=window.setInterval(()=>this.onTick(),1e3),W().then(a=>this.settings=a).catch(()=>{}),this.load(),this.pollAnnouncement()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),window.removeEventListener("orientationchange",this.onResize),this.removeEventListener("pointerdown",this.onTouch),window.clearInterval(this.timer),window.clearTimeout(this.retry),window.clearTimeout(this.longPress),window.clearTimeout(this.panelTimer),window.clearTimeout(this.updatedTimer),window.clearInterval(this.holdTimer),window.clearTimeout(this.annTimer),this.closeSocket()}async pollAnnouncement(){let a=6e4;try{const e=await H();this.announcement=e.announcement,a=da(e.poll_s,6e4)}catch{}window.clearTimeout(this.annTimer),this.annTimer=window.setTimeout(()=>void this.pollAnnouncement(),a)}renderAnnouncement(a=!1){const e=this.announcement;return!e||!pa(e,this.now,this.annClosed)||a&&!e.critical?c:i`<div class="announce" data-wall-announcement=${e.id} data-critical=${e.critical?"1":"0"} role="alert">
      <div class="ann-in" data-size=${ha(e)}>
        <span class="ann-tag">${wa(e,"he")}</span>
        <div class="ann-body">${e.texts.map(t=>i`<p class="ann-t" lang=${t.language} dir=${va(t.language)}>${t.text}</p>`)}</div>
      </div>
      <button class="ann-close" type="button" data-wall-announcement-close aria-label=${ma("he")} @click=${()=>this.annClosed=e.id}><sw-icon name="close"></sw-icon></button>
    </div>`}async load(){try{const a=await R(),e=!this.data;this.data=a,this.setAlerts(a.alerts??[]),this.loadFrame(),this.phase="ready",this.downSince=null,e||this.flashUpdated(),this.openSocket(),this.refreshStates(!0)}catch(a){if(a instanceof S&&a.status===401){this.phase="removed";return}if(a instanceof S&&a.status===403){a.body.code==="wall_user_remote_not_allowed"?this.phase="remote-refused":T();return}this.downSince??=Date.now(),this.data||(this.phase="no-connection"),this.scheduleRetry()}}scheduleRetry(){window.clearTimeout(this.retry),this.retry=window.setTimeout(()=>void this.load(),j(this.downSince?Date.now()-this.downSince:0))}openSocket(){if(!(this.ws&&this.ws.readyState<=1))try{const a=new WebSocket(B());this.ws=a,a.onopen=()=>a.send(JSON.stringify({type:"hello",payload:{class:b(this.env),screen:`${this.env.screenWidth}x${this.env.screenHeight}`}})),a.onmessage=e=>{try{const t=JSON.parse(String(e.data));t.type==="config"&&t.payload?.version!==this.data?.version?this.load():t.type==="alerts"?this.setAlerts(t.payload?.alerts??[]):t.type==="disabled"?T():t.type==="revoked"?this.phase="removed":t.type==="hello"&&(this.downSince=null)}catch{}},a.onclose=e=>{if(this.ws=null,e.code===4401&&this.phase==="ready"){this.load();return}this.downSince??=Date.now(),this.scheduleRetry()}}catch{this.downSince??=Date.now()}}closeSocket(){const a=this.ws;this.ws=null,a&&(a.onclose=null,a.close())}flashUpdated(){this.chipUpdated=!0,window.clearTimeout(this.updatedTimer),this.updatedTimer=window.setTimeout(()=>this.chipUpdated=!1,3e3)}setAlerts(a){const e=Date.now(),t=new Set(a.map(s=>s.id));for(const s of this.alerts)!t.has(s.id)&&s.severity!=="info"&&(this.resolved=[...this.resolved.filter(n=>n.id!==s.id),{id:s.id,text:`נסגר · ${s.place||s.title}`,until:e+5e3}]);for(const s of a)this.shownAt.has(s.id)||this.shownAt.set(s.id,e);for(const s of[...this.shownAt.keys()])t.has(s)||(this.shownAt.delete(s),this.seenUntil.delete(s));this.alerts=a}alertsOn(){return this.data?.config.alerts.enabled?this.alerts:[]}markSeen(a){this.seenUntil.set(a.id,Date.now()+(this.data?.config.alerts.takeover_timeout_s??120)*1e3),this.requestUpdate()}async loadFrame(){const a=this.data?.config.frame,e=a&&a.enabled&&a.folder?`${a.folder}:${this.data?.version}`:"";if(e!==this.frameListFor){if(this.frameListFor=e,!e){this.photos=[];return}try{this.photos=(await J()).photos,this.order=A(this.photos.length),this.frameIdx=0,this.frameSwitchAt=Date.now()}catch{this.photos=[],this.frameListFor=""}}}frameOn(){const a=this.data;return a?q({enabled:a.config.frame.enabled,photos:this.photos.length,idleMin:a.config.frame.idle_min,lastActivityMs:this.activityAt,nowMs:this.now,asleep:!this.awake(),attention:D(this.alertsOn())}):!1}async refreshStates(a=!1){const e=this.data?.config.state_entities??[],t=Date.now();if(e.length&&(a||t-this.lastStates>3e4)){this.lastStates=t;try{this.states=(await N(e)).states}catch{}}if(a||t-this.lastHealth>6e4){this.lastHealth=t;try{this.healthOk=(await Z()).status==="ok"}catch{this.healthOk=null}}}onTick(){if(this.now=Date.now(),this.tick+=1,this.phase!=="ready"||!this.data)return;const a=this.data.config;for(const[t,s]of this.ok){if(s)continue;const n=this.nextTry.get(t)??0;if(this.now>=n){const p=this.tries.get(t)??0;this.epoch.set(t,(this.epoch.get(t)??0)+1),this.tries.set(t,p+1),this.nextTry.set(t,this.now+M[Math.min(p,M.length-1)]*1e3)}}this.refreshStates(),D(this.alertsOn())&&(this.activityAt=this.now),this.resolved.length&&(this.resolved=this.resolved.filter(t=>t.until>this.now)),this.photos.length&&this.frameOn()&&this.now-this.frameSwitchAt>=a.frame.interval_s*1e3&&(this.frameSwitchAt=this.now,this.frameIdx+1>=this.order.length?(this.order=A(this.photos.length,Math.random,this.order[this.order.length-1]),this.frameIdx=0):this.frameIdx+=1),a.schedule.windows.length&&this.emitSleepState(!this.awake())}emitSleepState(a){const e=a?"sleep":"wake";if(e!==this.lastEmit){this.lastEmit=e,document.title=a?"SmplWise Arx - sleep":"SmplWise Arx";try{window.parent.postMessage({type:"arx-wall",state:e},"*")}catch{}}}awake(){return!this.data||this.now<this.wakeUntil||G(this.alertsOn(),this.data.config.schedule.wake_on_alert_severity)?!0:K(this.data.config.schedule.windows,this.data.zone,new Date(this.now))}onPlayer(a,e){const t=e.detail?.status;t==="playing"?(this.ok.set(a,!0),this.drop.delete(a),this.tries.set(a,0),this.nextTry.delete(a)):(t==="error"||t==="ended")&&(this.ok.get(a)!==!1&&this.drop.set(a,Date.now()),this.ok.set(a,!1)),this.requestUpdate()}clockParts(){const a=this.data?.zone||"Asia/Jerusalem",e=new Date(this.now);try{return{time:V(e,{timeZone:a}),date:new Intl.DateTimeFormat("he-IL",{timeZone:a,weekday:"long",day:"numeric",month:"long"}).format(e)}}catch{return{time:e.toTimeString().slice(0,5),date:""}}}hhmmss(a){return new Date(a).toTimeString().slice(0,8)}render(){const a=X(this.env.screenWidth,this.env.screenHeight),e=`--s:${a}`;if(this.phase==="loading")return i`<div class="center" data-wall-state="loading" style=${e}><span class="mark" data-tone="live"><sw-icon name="camera" size="28"></sw-icon></span><p>טוען…</p></div>`;if(this.phase==="no-connection")return i`<div class="center" data-wall-state="no-connection" style=${e}><span class="mark" data-tone="danger"><sw-icon name="warning" size="28"></sw-icon></span><h1>אין חיבור לשרת</h1><p>מנסה שוב אוטומטית</p></div>`;if(this.phase==="removed")return i`<div class="center" data-wall-state="access-removed" style=${e}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>הגישה למסך הזה הוסרה</h1><p>יש להתחבר מחדש עם משתמש מסך קיר</p></div>`;if(this.phase==="remote-refused")return i`<div class="center" data-wall-state="remote-refused" style=${e}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>המסך הזה אינו מורשה להתחבר מרחוק</h1><p>יש להתחבר מהרשת המקומית, או לאפשר גישה מרחוק בהגדרות מסכי קיר</p></div>`;const t=this.data;if(!t)return c;const s=t.config;this.setAttribute("data-wall-theme",s.theme==="light"?"light":"dark");const n=this.clockParts();if(!this.awake()){const[r,m]=[10+this.now/6e4%60*1.3,15+this.now/9e4%60*1.2];return i`<div class="wall sleep" data-wall-state="sleep" style=${`${e};display:block`}><div class="bigclock" style=${`inset-inline-start:${r}%;inset-block-start:${m}%`}>${n.time}${n.date?i`<small>${n.date}</small>`:c}</div>${this.renderAnnouncement(!0)}</div>`}const o=Y({layout:s.layout,grid:s.grid,cameras:t.cameras.length,viewportW:this.vw,viewportH:this.vh,showMap:s.show_map,rotateS:s.rotate_s}),v=o.rotateS>0?Math.floor(this.now/(o.rotateS*1e3))%o.pages:0,u=s.burn_in.shuffle_h>0&&t.cameras.length>1&&o.preset!=="single"?Math.floor(this.now/(s.burn_in.shuffle_h*36e5)):0,f=Q(t.cameras,v,o.perPage,u),[E,I]=O(this.now,s.burn_in.shift),P=(this.now-this.touchedAt)/6e4,x=s.burn_in.dim_after_min>0&&P>=s.burn_in.dim_after_min,k=aa(this.downSince,this.now);if(k==="clock"){const[r,m]=[20+this.now/6e4%60*.6,20+this.now/9e4%60*.7];return i`<div class="wall sleep" data-wall-state="server-offline-clock" style=${`${e};display:block`}><div class="bigclock" style=${`inset-inline-start:${r}%;inset-block-start:${m}%;opacity:.5`}>${n.time}${n.date?i`<small>${n.date}</small>`:c}</div><div class="banner" style="position:absolute;inset-block-end:var(--pad);inset-inline-start:var(--pad)">אין חיבור למערכת · מנסה שוב</div></div>`}const g=ea(this.settings),w=ta(this.alertsOn(),this.shownAt,this.seenUntil,this.now,s.alerts.takeover_timeout_s,this.tap),y=w.chips.filter(r=>r.severity!=="info"),$=[...this.resolved.map(r=>i`<span class="chip" data-wall-resolved>${r.text}</span>`),...w.chips.filter(r=>r.severity==="info").map(r=>i`<span class="chip" data-wall-info-chip><i></i>${r.title}${r.place?` · ${r.place}`:""}</span>`),...y.length?[i`<span class="chip" data-tone="danger" data-wall-alert-chip><i></i>התראות · ${y.length}</span>`]:[]];if(this.frameOn()&&this.photos.length)return this.renderFrame(t,n,a,$);const z=$.concat(s.strip.includes("health")?[this.healthChip()]:[]).concat(this.states.map(r=>i`<span class="chip" data-chip=${r.id}>${r.name} <b>${r.state??""}${r.unit?` ${r.unit}`:""}</b></span>`)),U=i`<div class="strip" data-wall-strip>
      <span class="place" data-wall-title>${t.title}</span>
      ${s.strip.includes("clock")?i`<span class="clock" data-wall-clock @pointerdown=${this.pressStart} @pointerup=${this.pressEnd} @pointerleave=${this.pressEnd} @pointercancel=${this.pressEnd}>${n.time}${s.strip.includes("date")&&n.date?i`<span class="date">${n.date}</span>`:c}</span>`:i`<span style="margin-inline:auto"></span>`}
      <span class="chips">${k==="banner"?i`<span class="banner" data-wall-banner>אין חיבור למערכת · מנסה שוב</span>`:z}</span>
    </div>`;return i`<div class=${`wall ${x?"dim":""}`} data-wall-state="base" data-preset=${o.preset} ?data-map=${o.map} data-wall-class=${b(this.env)} style=${`${e};--cols:${o.cols};--rows:${o.rows};transform:translate(${E}px,${I}px);opacity:${x?s.burn_in.dim_to:1}`}>
      ${U}
      ${f.length||w.tile?i`<div class="grid" data-wall-grid>${w.tile?this.renderAlertTile(w.tile,w.more,s,g):c}${f.slice(w.tile?1:0).map(r=>this.renderTile(r,g,s.offline.show_last_frame_s))}${o.pages>1?i`<div class="dots" data-wall-dots>${Array.from({length:o.pages},(r,m)=>i`<i ?data-on=${m===v}></i>`)}</div>`:c}</div>`:i`<div class="empty" data-wall-state="no-cameras">לא הוגדרו מצלמות למסך הזה</div>`}
      ${o.map?this.renderMapPane():c}
      ${o.preset==="tablet-portrait"?i`<div class="band" data-wall-band>${z}</div>`:c}
      ${w.takeover.length?this.renderTakeover(w.takeover,t,n,g):c}
      ${this.renderAnnouncement()}
      ${this.panel?this.renderPanel(t):c}
      ${this.chipUpdated?i`<span class="chip updated" data-wall-updated>ההגדרות עודכנו</span>`:c}
    </div>`}ago(a){const e=Math.max(0,Math.round((this.now-new Date(a.first_at).getTime())/6e4)),t=new Date(a.last_at);let s="";try{s=new Intl.DateTimeFormat("he-IL",{timeZone:this.data?.zone||"Asia/Jerusalem",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(t)}catch{s=t.toTimeString().slice(0,5)}return`${e<1?"עכשיו":`${e} דקות`} · ${s}`}alertCamera(a,e,t){const s=a.camera_id?this.data?.cameras.find(n=>n.id===a.camera_id):void 0;return s?i`<sw-camera-tile dark noDemo name=${t??s.name} state="live" live cameraId=${s.id} profile="sub" transport=${e}></sw-camera-tile>`:c}alertButtons(a,e){const t=_(this.holdStart,this.now);return i`<button class="btn" data-wall-seen=${a.id} @click=${()=>this.markSeen(a)}><sw-icon name="eye"></sw-icon><span>ראיתי</span></button>
      ${e?i`<button class="btn" data-hold data-wall-ack=${a.id} style=${`--hold:${t}`} @pointerdown=${()=>this.holdBegin(a)} @pointerup=${this.holdEnd} @pointerleave=${this.holdEnd} @pointercancel=${this.holdEnd}><sw-icon name="check"></sw-icon><span>אישור · החזק</span></button>`:i`<span class="note" data-wall-ack-off><sw-icon name="lock" size="14"></sw-icon> אישור מהמסך הזה לא מופעל</span>`}`}renderAlertTile(a,e,t,s){return i`<div class="atile" data-wall-alert-tile=${a.id} data-severity=${a.severity}>
      <div class="head"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${a.title}${a.place?` · ${a.place}`:""}</b><span class="sub">${this.ago(a)}${a.count>1?` · ×${a.count}`:""}</span></div>
        ${e>0?i`<span class="more" data-wall-alert-more @click=${()=>this.tap++}>+${e}</span>`:c}</div>
      <div class="media">${this.alertCamera(a,s)}</div>
      <div class="foot">${this.alertButtons(a,t.alerts.ack_allowed)}</div>
    </div>`}renderTakeover(a,e,t,s){const n=a[0];return i`<div class="takeover" data-wall-state="takeover" data-wall-takeover=${n.id}>
      <div class="strip"><span class="place"><sw-icon name="warning"></sw-icon> התראה קריטית · ${e.title}</span><span class="clock">${t.time}</span>${a.length>1?i`<span class="chips"><span class="chip" data-tone="danger" data-wall-takeover-count>${a.length} התראות</span></span>`:c}</div>
      <div class="media">${this.alertCamera(n,s)}
        <div class="titles"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${n.title}</b><span class="sub">${n.place?`${n.place} · `:""}${this.ago(n)}</span></div></div>
      </div>
      ${a.length>1?i`<div class="foot" data-wall-takeover-stack>${a.slice(1,4).map(p=>i`<span class="chip" data-tone="danger">${p.title}${p.place?` · ${p.place}`:""}</span>`)}</div>`:c}
      <div class="foot">${this.alertButtons(n,e.config.alerts.ack_allowed)}</div>
    </div>`}renderFrame(a,e,t,s){const n=a.config.frame,[p,o]=O(this.now,a.config.burn_in.shift),v=this.photos[this.order[this.frameIdx]??0]?.id??this.photos[0].id,u=(this.now-this.touchedAt)/6e4,f=a.config.burn_in.dim_after_min>0&&u>=a.config.burn_in.dim_after_min;return i`<div class="frame" data-wall-state="frame" data-motion=${n.motion} style=${`--s:${t};opacity:${f?a.config.burn_in.dim_to:1};transform:translate(${p}px,${o}px)`}>
      <img data-wall-photo=${v} alt="" src=${sa(v)} style=${`object-fit:${n.fit}`} />
      ${s.length?i`<span class="chips" data-wall-frame-chips>${s}</span>`:c}
      ${n.clock?i`<div class="fclock" data-wall-frame-clock><b>${e.time}</b><span>${e.date}${e.date?" · ":""}${a.title}</span></div>`:c}
      ${this.renderAnnouncement()}
    </div>`}renderMapPane(){const a=this.data;return a?.floor_id?(this.planLoaded||(this.planLoaded=!0,ia(()=>import("./sw-wall-plan-DX9YPV64.js"),__vite__mapDeps([0]),import.meta.url)),i`<div class="pane" data-wall-map-slot role="img" aria-label="תוכנית הקומה"><sw-wall-plan .floorId=${a.floor_id} .plan=${a.config.plan} .theme=${a.config.theme}></sw-wall-plan></div>`):i`<div class="pane" data-wall-map-slot aria-hidden="true"></div>`}healthChip(){return this.healthOk===null?i`<span class="chip" data-tone="stale" data-wall-health><i></i>מצב המערכת</span>`:this.healthOk?i`<span class="chip" data-tone="live" data-wall-health><i></i>המערכת תקינה</span>`:i`<span class="chip" data-tone="stale" data-wall-health><i></i>יש תקלות</span>`}renderTile(a,e,t){const s=this.ok.get(a.id),n=this.drop.get(a.id)??null,p=s===!1?na(n,this.now,0,t):"live";return i`<div class="tile" data-wall-tile=${a.id} data-health=${p} @player-status=${o=>this.onPlayer(a.id,o)}>
      ${ra(`${a.id}:${this.epoch.get(a.id)??0}`,i`<sw-camera-tile dark noDemo name=${a.name} state=${p==="live"?"live":"stale"} ?live=${p!=="lost"} cameraId=${a.id} profile="sub" transport=${e}></sw-camera-tile>`)}
      ${p==="stale"?i`<span class="badge" data-wall-badge>אין וידאו${n?` · ${this.hhmmss(n)}`:""}</span>`:c}
      ${p==="lost"?i`<div class="lost" data-wall-lost><b>${a.name}</b><span>אין וידאו</span></div>`:c}
    </div>`}renderPanel(a){const e=la.me,t=b(this.env);return i`<div class="panel" data-wall-panel role="status"><dl>
      <dt>משתמש</dt><dd>${e?.user.username??""}</dd>
      <dt>מסך</dt><dd>${a.title}</dd>
      <dt>סוג מכשיר</dt><dd>${t} · ${this.env.screenWidth}x${this.env.screenHeight}</dd>
      <dt>ערוץ</dt><dd>${e?.channel??"local"}</dd>
      <dt>חיבור</dt><dd>${this.downSince?"מנותק":"מחובר"}</dd>
      <dt>גרסת הגדרות</dt><dd>${a.version}</dd>
    </dl></div>`}};l.styles=oa`
    :host {
      position: fixed;
      inset: 0;
      display: block;
      direction: rtl;
      background: var(--wall-bg);
      color: var(--wall-text);
      font-family: var(--sw-font);
      line-height: 1.3;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      /* the dark wall theme: the product's video canvas, white HUD text */
      --wall-bg: var(--sw-video-bg);
      --wall-text: var(--sw-on-video);
      --wall-text-2: var(--sw-on-video-2);
      --wall-tile: #060912;
      --wall-tile-border: var(--sw-video-line);
      --wall-strip: rgba(255, 255, 255, 0.06);
      --wall-chip: rgba(127, 140, 170, 0.18);
      --wall-chip-strong: rgba(127, 140, 170, 0.3);
      --wall-dot: rgba(255, 255, 255, 0.3);
      --wall-dot-on: rgba(255, 255, 255, 0.85);
      --wall-danger-soft: rgba(255, 107, 98, 0.22);
      --wall-danger-text: #ffb3ad;
      --wall-stale-soft: rgba(245, 176, 67, 0.22);
      --wall-stale-text: #ffd08a;
      --wall-panel: rgba(20, 24, 38, 0.96);
    }
    :host([data-wall-theme='light']) {
      --wall-bg: #dfe5f0;
      --wall-text: #1e2e47;
      --wall-text-2: #5b6a85;
      --wall-tile: #0f1729;
      --wall-tile-border: rgba(30, 46, 71, 0.12);
      --wall-strip: rgba(255, 255, 255, 0.85);
      --wall-chip: rgba(30, 46, 71, 0.08);
      --wall-chip-strong: rgba(30, 46, 71, 0.14);
      --wall-dot: rgba(30, 46, 71, 0.25);
      --wall-dot-on: rgba(30, 46, 71, 0.85);
      --wall-danger-soft: rgba(239, 68, 68, 0.14);
      --wall-danger-text: #b91c1c;
      --wall-stale-soft: rgba(245, 158, 11, 0.18);
      --wall-stale-text: #b45309;
      --wall-panel: rgba(255, 255, 255, 0.96);
    }
    .wall {
      position: absolute;
      inset: 0;
      display: grid;
      padding: var(--pad);
      gap: var(--gap);
      --pad: calc(16px * var(--s, 1));
      --gap: calc(12px * var(--s, 1));
      --strip-h: calc(64px * var(--s, 1));
      --chip-h: calc(44px * var(--s, 1));
      grid-template-rows: var(--strip-h) minmax(0, 1fr);
      /* the pixel shift glides and the dim fades: a burn-in move is never a visible jump */
      transition: opacity 3s ease, transform 2s ease-in-out;
    }
    .wall[data-preset='tablet-portrait'] {
      grid-template-rows: var(--strip-h) minmax(0, 1fr) auto;
    }
    .wall[data-preset='tablet-portrait'][data-map] {
      grid-template-rows: var(--strip-h) minmax(0, 1fr) minmax(0, 0.55fr) auto;
    }
    .wall[data-preset='single'] {
      grid-template-rows: minmax(0, 1fr);
    }
    .wall[data-preset='single'] .strip {
      position: absolute;
      inset: var(--pad) var(--pad) auto;
      z-index: 2;
      background: linear-gradient(var(--sw-video-scrim), transparent);
      color: var(--sw-on-video);
      --wall-text-2: var(--sw-on-video-2);
    }
    .strip {
      display: flex;
      align-items: center;
      gap: var(--gap);
      block-size: var(--strip-h);
      padding: 0 calc(var(--pad) * 0.75);
      background: var(--wall-strip);
      border-radius: var(--sw-r-lg);
      transition: background-color 3s ease;
    }
    :host-context(html[data-skin='bubble']) .strip,
    :host-context(html[data-skin='bubble']) .panel {
      border-radius: var(--sw-r-pill);
    }
    .place {
      font-size: calc(19px * var(--s, 1));
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-inline-size: 0;
    }
    .clock {
      margin-inline: auto;
      display: flex;
      align-items: baseline;
      gap: calc(12px * var(--s, 1));
      min-block-size: calc(44px * var(--s, 1));
      padding-inline: calc(8px * var(--s, 1));
      font-size: calc(34px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: color 3s ease;
    }
    .clock .date {
      font-size: calc(15px * var(--s, 1));
      font-weight: var(--sw-fw-regular);
      color: var(--wall-text-2);
    }
    /* dimmed (burn-in): the strip's fill goes, the clock becomes an outline, the chips recede - nothing stays bright */
    .dim .clock {
      -webkit-text-stroke: 1px var(--wall-text);
      color: transparent;
    }
    .dim .strip {
      background-color: transparent;
    }
    .dim .chip,
    .dim .place,
    .dim .dots {
      opacity: 0.7;
    }
    .chips {
      display: flex;
      gap: calc(8px * var(--s, 1));
      align-items: center;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: calc(8px * var(--s, 1));
      block-size: var(--chip-h);
      padding: 0 calc(14px * var(--s, 1));
      border-radius: var(--sw-r-pill);
      background: var(--wall-chip);
      font-size: calc(16px * var(--s, 1));
      white-space: nowrap;
      transition: opacity 3s ease;
      animation: rise 0.5s var(--sw-ease) both;
    }
    .chip b {
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .chip i {
      inline-size: calc(9px * var(--s, 1));
      block-size: calc(9px * var(--s, 1));
      border-radius: 50%;
      background: var(--sw-live);
      flex: none;
    }
    .chip[data-tone='stale'] i {
      background: var(--sw-stale);
    }
    .chip[data-tone='danger'] {
      background: var(--wall-danger-soft);
      color: var(--wall-danger-text);
      font-weight: var(--sw-fw-semibold);
    }
    .chip[data-tone='danger'] i {
      background: var(--sw-danger);
      animation: breathe 2.4s ease-in-out infinite;
    }
    .grid {
      display: grid;
      gap: var(--gap);
      min-block-size: 0;
      position: relative;
      grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
      grid-template-rows: repeat(var(--rows, 2), minmax(0, 1fr));
    }
    .wall[data-preset='tablet-portrait'] .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .tile {
      position: relative;
      display: grid;
      place-items: center;
      container-type: size;
      background: var(--wall-tile);
      border: 1px solid var(--wall-tile-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      min-block-size: 0;
      direction: ltr;
      animation: fade-in 0.6s var(--sw-ease) both;
    }
    /* the picture keeps its 16:9 and sits centred in the cell (a portrait cell is taller than wide: no dead band under the
       video, the letterbox is split above and below); where container units are missing the tile fills the width as before */
    .tile sw-camera-tile {
      display: block;
      inline-size: 100%;
      inline-size: min(100%, calc(100cqh * 16 / 9));
      max-block-size: 100%;
      border-radius: 0;
      box-shadow: none;
    }
    .tile[data-health='stale'] sw-camera-tile {
      filter: brightness(0.55) saturate(0.7);
      transition: filter 1s ease;
    }
    .tile[data-health='stale']::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(135deg, rgba(0, 0, 0, 0.28) 0 6px, transparent 6px 14px);
      pointer-events: none;
    }
    .tile[data-health='lost'] sw-camera-tile {
      visibility: hidden;
    }
    /* the map pane of a portrait wall (cfg.show_map): the tile material under the plan that sw-wall-plan draws (CR-029 S5-B); an
       empty surface until the floor loads, and for a profile with no floor */
    .pane {
      position: relative;
      min-block-size: 0;
      background: var(--wall-tile);
      border: 1px solid var(--wall-tile-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      animation: fade-in 0.6s var(--sw-ease) both;
    }
    .badge,
    .lost {
      position: absolute;
      z-index: 1;
      direction: rtl;
    }
    .badge {
      inset-block-start: calc(10px * var(--s, 1));
      inset-inline-start: calc(10px * var(--s, 1));
      display: inline-flex;
      align-items: center;
      gap: calc(8px * var(--s, 1));
      padding: 0 calc(12px * var(--s, 1));
      min-block-size: calc(32px * var(--s, 1));
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      font-size: calc(15px * var(--s, 1));
      font-weight: var(--sw-fw-medium);
      font-variant-numeric: tabular-nums;
      animation: rise 0.5s var(--sw-ease) both;
    }
    .badge::before {
      content: '';
      inline-size: calc(9px * var(--s, 1));
      block-size: calc(9px * var(--s, 1));
      border-radius: 50%;
      background: var(--sw-stale);
    }
    .lost {
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: calc(8px * var(--s, 1));
      font-size: calc(18px * var(--s, 1));
      color: var(--sw-on-video-2);
    }
    .lost b {
      font-size: calc(24px * var(--s, 1));
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-on-video);
    }
    .banner {
      background: var(--wall-danger-soft);
      color: var(--wall-danger-text);
      padding: 0 calc(16px * var(--s, 1));
      border-radius: var(--sw-r-pill);
      block-size: var(--chip-h);
      display: inline-flex;
      align-items: center;
      gap: calc(10px * var(--s, 1));
      font-size: calc(16px * var(--s, 1));
      font-weight: var(--sw-fw-semibold);
      animation: rise 0.5s var(--sw-ease) both;
    }
    .banner::before {
      content: '';
      inline-size: calc(9px * var(--s, 1));
      block-size: calc(9px * var(--s, 1));
      border-radius: 50%;
      background: var(--sw-danger);
      animation: breathe 2.4s ease-in-out infinite;
    }
    .band {
      display: flex;
      gap: var(--gap);
      flex-wrap: wrap;
      align-items: center;
      padding: calc(4px * var(--s, 1)) 0;
    }
    .dots {
      position: absolute;
      inset-block-end: calc(8px * var(--s, 1));
      inset-inline: 0;
      display: flex;
      justify-content: center;
      gap: calc(8px * var(--s, 1));
      pointer-events: none;
      transition: opacity 3s ease;
    }
    .dots i {
      inline-size: calc(8px * var(--s, 1));
      block-size: calc(8px * var(--s, 1));
      border-radius: 50%;
      background: var(--wall-dot);
      transition: background-color 0.4s ease, transform 0.4s var(--sw-ease);
    }
    .dots i[data-on] {
      background: var(--wall-dot-on);
      transform: scale(1.25);
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: calc(12px * var(--s, 1));
      padding: calc(32px * var(--s, 1));
      animation: fade-in 0.25s var(--sw-ease) both;
    }
    .center h1 {
      margin: 0;
      font-size: calc(30px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      line-height: 1.2;
    }
    .center p {
      margin: 0;
      color: var(--wall-text-2);
      font-size: calc(18px * var(--s, 1));
      max-inline-size: 36ch;
      justify-self: center;
    }
    .center .mark {
      inline-size: calc(56px * var(--s, 1));
      block-size: calc(56px * var(--s, 1));
      margin: 0 auto calc(8px * var(--s, 1));
      display: grid;
      place-content: center;
      border-radius: 50%;
      background: var(--wall-chip);
      color: var(--wall-text-2);
    }
    .center .mark[data-tone='danger'] {
      background: var(--wall-danger-soft);
      color: var(--wall-danger-text);
    }
    .center .mark[data-tone='live'] {
      color: var(--sw-live);
    }
    .center .mark[data-tone='live'] sw-icon {
      animation: breathe 2.4s ease-in-out infinite;
    }
    .empty {
      display: grid;
      place-content: center;
      text-align: center;
      color: var(--wall-text-2);
      font-size: calc(20px * var(--s, 1));
    }
    .sleep .bigclock {
      position: absolute;
      font-size: calc(72px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      opacity: 0.2;
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      transition: inset 2s ease-in-out;
    }
    .sleep .bigclock small {
      display: block;
      font-size: calc(18px * var(--s, 1));
      font-weight: var(--sw-fw-regular);
      letter-spacing: 0;
      text-align: center;
    }
    .panel {
      position: absolute;
      inset-block-start: calc(var(--pad) + var(--strip-h) + 8px);
      inset-inline-start: 50%;
      transform: translateX(50%);
      z-index: 5;
      min-inline-size: calc(340px * var(--s, 1));
      padding: calc(16px * var(--s, 1)) calc(20px * var(--s, 1));
      border-radius: var(--sw-r-lg);
      background: var(--wall-panel);
      color: var(--wall-text);
      box-shadow: var(--sw-shadow-3);
      font-size: calc(16px * var(--s, 1));
      animation: rise 0.3s var(--sw-ease) both;
    }
    .panel dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: calc(6px * var(--s, 1)) calc(20px * var(--s, 1));
      margin: 0;
    }
    .panel dt {
      color: var(--wall-text-2);
    }
    .panel dd {
      margin: 0;
      direction: ltr;
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .updated {
      position: absolute;
      inset-block-end: calc(var(--pad) + 6px);
      inset-inline-start: 50%;
      transform: translateX(50%);
      z-index: 4;
      background: var(--wall-chip-strong);
    }
    .atile {
      position: relative;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      background: var(--wall-tile);
      border: 2px solid var(--sw-stale);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      min-block-size: 0;
      color: var(--sw-on-video);
      --wall-text-2: var(--sw-on-video-2);
      animation: fade-in 0.6s var(--sw-ease) both;
    }
    .atile .head {
      display: flex;
      align-items: center;
      gap: calc(14px * var(--s, 1));
      padding: calc(12px * var(--s, 1)) calc(16px * var(--s, 1));
      background: rgba(245, 176, 67, 0.14);
    }
    .atile .head > div {
      min-inline-size: 0;
    }
    .atile .head b {
      display: block;
      font-size: calc(24px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      line-height: 1.15;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .atile .head span.sub {
      font-size: calc(15px * var(--s, 1));
      color: var(--wall-text-2);
    }
    .atile .icon {
      inline-size: calc(44px * var(--s, 1));
      block-size: calc(44px * var(--s, 1));
      border-radius: 50%;
      display: grid;
      place-content: center;
      background: var(--sw-stale);
      color: #1b1403;
      flex: none;
    }
    .atile .media {
      position: relative;
      min-block-size: 0;
      direction: ltr;
    }
    .atile .media sw-camera-tile {
      position: absolute;
      inset: 0;
      display: block;
    }
    .atile .foot,
    .takeover .foot {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: calc(12px * var(--s, 1));
      padding: calc(10px * var(--s, 1)) calc(16px * var(--s, 1));
    }
    .more {
      margin-inline-start: auto;
      display: inline-grid;
      place-content: center;
      min-inline-size: calc(44px * var(--s, 1));
      min-block-size: calc(44px * var(--s, 1));
      padding: 0 calc(12px * var(--s, 1));
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-hover);
      font-size: calc(16px * var(--s, 1));
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
    }
    .btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: calc(10px * var(--s, 1));
      min-block-size: calc(48px * var(--s, 1));
      min-inline-size: calc(120px * var(--s, 1));
      padding: 0 calc(22px * var(--s, 1));
      border: 0;
      border-radius: var(--sw-r-pill);
      background: var(--wall-chip-strong);
      color: inherit;
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      font-size: calc(17px * var(--s, 1));
      overflow: hidden;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      cursor: pointer;
      transition: transform var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) ease;
    }
    .btn:active {
      transform: scale(0.97);
    }
    .btn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-on-video);
      outline-offset: var(--sw-focus-offset);
    }
    .btn[data-hold]::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: calc(var(--hold, 0) * 100%);
      background: rgba(255, 107, 98, 0.55);
    }
    .btn > * {
      position: relative;
    }
    .note {
      display: inline-flex;
      align-items: center;
      gap: calc(6px * var(--s, 1));
      font-size: calc(15px * var(--s, 1));
      color: var(--wall-text-2);
    }
    .announce {
      position: absolute;
      inset: 0;
      z-index: 8;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: calc(48px * var(--s, 1)) calc(64px * var(--s, 1));
      box-sizing: border-box;
      overflow: hidden;
      background: radial-gradient(120% 90% at 85% 10%, #1d2a44 0%, #121a2c 55%, #0a101d 100%);
      color: var(--sw-on-video);
    }
    .announce[data-critical='1'] {
      background: radial-gradient(120% 90% at 85% 10%, #5a1515 0%, #3a0d0d 50%, #220808 100%);
    }
    .announce .ann-in {
      display: flex;
      flex-direction: column;
      gap: calc(28px * var(--s, 1));
      max-inline-size: 100%;
      max-block-size: 100%;
      min-inline-size: 0;
    }
    .announce .ann-tag {
      align-self: flex-start;
      padding: calc(6px * var(--s, 1)) calc(20px * var(--s, 1));
      border-radius: 999px;
      font-size: calc(20px * var(--s, 1));
      font-weight: 600;
      background: rgba(255, 255, 255, 0.14);
    }
    .announce .ann-body {
      display: flex;
      flex-direction: column;
      gap: calc(24px * var(--s, 1));
      min-block-size: 0;
    }
    .announce .ann-t {
      margin: 0;
      font-weight: 500;
      line-height: 1.22;
      overflow-wrap: anywhere;
      text-wrap: balance;
    }
    .announce .ann-t + .ann-t {
      padding-block-start: calc(22px * var(--s, 1));
      border-block-start: 1px solid rgba(255, 255, 255, 0.22);
    }
    .announce [data-size='xl'] .ann-t { font-size: calc(104px * var(--s, 1)); font-weight: 600; }
    .announce [data-size='l'] .ann-t { font-size: calc(64px * var(--s, 1)); }
    .announce [data-size='m'] .ann-t { font-size: calc(44px * var(--s, 1)); }
    .announce [data-size='s'] .ann-t { font-size: calc(30px * var(--s, 1)); }
    .announce .ann-close {
      position: absolute;
      inset-block-start: calc(16px * var(--s, 1));
      inset-inline-end: calc(16px * var(--s, 1));
      inline-size: calc(48px * var(--s, 1));
      block-size: calc(48px * var(--s, 1));
      border: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.16);
      color: inherit;
      cursor: pointer;
    }
    .takeover {
      position: absolute;
      inset: 0;
      z-index: 6;
      display: grid;
      grid-template-rows: var(--strip-h) minmax(0, 1fr) auto;
      gap: var(--gap);
      padding: var(--pad);
      background: #080506;
      color: var(--sw-on-video);
      --wall-text-2: var(--sw-on-video-2);
      --wall-chip: rgba(255, 255, 255, 0.1);
      --wall-chip-strong: rgba(255, 255, 255, 0.18);
      border: calc(8px * var(--s, 1)) solid var(--sw-danger);
      animation: pulse 2s ease-in-out 30, takeover-in 0.5s var(--sw-ease-dialog) both;
    }
    @keyframes pulse {
      50% {
        border-color: rgba(255, 107, 98, 0.35);
      }
    }
    .takeover .strip {
      background: rgba(255, 255, 255, 0.06);
    }
    .takeover .media {
      position: relative;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: #14100f;
      direction: ltr;
    }
    .takeover .media sw-camera-tile {
      position: absolute;
      inset: 0;
      display: block;
    }
    .takeover .titles {
      position: absolute;
      z-index: 1;
      inset-block-start: calc(18px * var(--s, 1));
      inset-inline-start: calc(22px * var(--s, 1));
      inset-inline-end: calc(22px * var(--s, 1));
      display: flex;
      gap: calc(18px * var(--s, 1));
      align-items: center;
      direction: rtl;
      text-shadow: 0 2px 14px rgba(0, 0, 0, 0.75);
    }
    .takeover .titles b {
      display: block;
      font-size: calc(46px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
    }
    .takeover .titles span.sub {
      font-size: calc(21px * var(--s, 1));
      color: var(--sw-on-video-2);
    }
    .takeover .icon {
      inline-size: calc(68px * var(--s, 1));
      block-size: calc(68px * var(--s, 1));
      border-radius: 50%;
      display: grid;
      place-content: center;
      background: var(--sw-danger);
      color: var(--sw-on-video);
      flex: none;
    }
    .takeover .foot {
      justify-content: center;
    }
    .frame {
      position: absolute;
      inset: 0;
      background: #000;
      overflow: hidden;
      transition: opacity 3s ease, transform 2s ease-in-out;
    }
    .frame img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      animation: fade-in 0.8s ease both;
    }
    .frame[data-motion='slow'] img {
      animation: fade-in 0.8s ease both, kb 40s ease-in-out infinite alternate;
    }
    @keyframes kb {
      to {
        transform: scale(1.08);
      }
    }
    .frame .fclock {
      position: absolute;
      inset-block-end: calc(28px * var(--s, 1));
      inset-inline-end: calc(32px * var(--s, 1));
      text-align: end;
      text-shadow: 0 2px 14px rgba(0, 0, 0, 0.75);
      color: var(--sw-on-video);
      direction: rtl;
    }
    .frame .fclock b {
      display: block;
      font-size: calc(58px * var(--s, 1));
      font-weight: var(--sw-fw-bold);
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    .frame .fclock span {
      font-size: calc(17px * var(--s, 1));
      color: var(--sw-on-video-2);
    }
    .frame .chips {
      position: absolute;
      inset-block-start: calc(18px * var(--s, 1));
      inset-inline-start: calc(18px * var(--s, 1));
      --wall-chip: var(--sw-video-scrim);
      --wall-danger-soft: rgba(255, 107, 98, 0.3);
      --wall-danger-text: #ffb3ad;
      color: var(--sw-on-video);
    }
    @keyframes fade-in {
      from {
        opacity: 0;
      }
    }
    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
    @keyframes takeover-in {
      from {
        opacity: 0;
        transform: scale(1.02);
      }
    }
    @keyframes breathe {
      50% {
        opacity: 0.45;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        transition: none !important;
        animation: none !important;
      }
    }
  `;d([h()],l.prototype,"phase",2);d([h()],l.prototype,"data",2);d([h()],l.prototype,"states",2);d([h()],l.prototype,"healthOk",2);d([h()],l.prototype,"now",2);d([h()],l.prototype,"vw",2);d([h()],l.prototype,"vh",2);d([h()],l.prototype,"panel",2);d([h()],l.prototype,"chipUpdated",2);d([h()],l.prototype,"touchedAt",2);d([h()],l.prototype,"wakeUntil",2);d([h()],l.prototype,"tick",2);d([h()],l.prototype,"alerts",2);d([h()],l.prototype,"announcement",2);d([h()],l.prototype,"annClosed",2);d([h()],l.prototype,"tap",2);d([h()],l.prototype,"resolved",2);d([h()],l.prototype,"holdStart",2);d([h()],l.prototype,"frameIdx",2);l=d([ca("sw-wall")],l);export{l as SwWall};
//# sourceMappingURL=sw-wall-BkZ8FVbR.js.map
