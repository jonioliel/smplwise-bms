const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{a as F,I as H,J as R,K as j,A as r,e as i,j as _,L as T,M as f,O as B,n as N,P as J,_ as q,Q as Z,R as K,E as V,G as h,H as X}from"./index-B6b85WR9.js";import{h as A,a as Y,g as G,b as Q,r as ee,w as ae,c as te,s as D,f as se,n as M,d as ie,e as ne,i as re,j as oe,k as le,l as ce,p as de,m as O,o as he,q as pe,t as we,u as ve,v as me}from"./wall-logic-Dd80eCj3.js";import{p as fe,v as ue,s as ge,h as be,d as xe,m as ke,c as E,b as ye}from"./screen-overlay-DuAxU5Gi.js";import"./sw-logo-art-Va6y_cIM.js";var $e=Object.defineProperty,ze=Object.getOwnPropertyDescriptor,d=(e,a,t,s)=>{for(var n=s>1?void 0:s?ze(a,t):a,p=e.length-1,c;p>=0;p--)(c=e[p])&&(n=(s?c(a,t,n):c(n))||n);return s&&n&&$e(a,t,n),n};const L=[2,4,8,15];let o=class extends F{constructor(){super(...arguments),this.phase="loading",this.data=null,this.states=[],this.healthOk=null,this.now=Date.now(),this.vw=window.innerWidth,this.vh=window.innerHeight,this.panel=!1,this.chipUpdated=!1,this.touchedAt=Date.now(),this.wakeUntil=0,this.tick=0,this.alerts=[],this.announcement=null,this.annClosed="",this.annTimer=0,this.annSeen={id:"",at:0},this.tap=0,this.resolved=[],this.holdStart=null,this.frameIdx=0,this.photos=[],this.order=[],this.frameSwitchAt=0,this.frameListFor="",this.activityAt=Date.now(),this.shownAt=new Map,this.seenUntil=new Map,this.holdTimer=0,this.settings=null,this.ws=null,this.downSince=null,this.timer=0,this.retry=0,this.longPress=0,this.panelTimer=0,this.updatedTimer=0,this.lastStates=0,this.lastHealth=0,this.ok=new Map,this.drop=new Map,this.epoch=new Map,this.tries=new Map,this.nextTry=new Map,this.planLoaded=!1,this.env=H(),this.movedAt=Date.now(),this.onMove=e=>{e.pointerType==="mouse"&&(this.movedAt=Date.now(),this.hasAttribute("data-cursor-idle")&&this.removeAttribute("data-cursor-idle"))},this.onResize=()=>{this.vw=window.innerWidth,this.vh=window.innerHeight},this.onTouch=()=>{this.touchedAt=Date.now(),this.activityAt=this.touchedAt,this.data?.config.schedule.wake_on_touch&&(this.wakeUntil=Date.now()+10*6e4)},this.holdBegin=e=>{this.holdStart=Date.now(),window.clearInterval(this.holdTimer),this.holdTimer=window.setInterval(()=>{this.holdStart!==null&&(this.now=Date.now(),A(this.holdStart,this.now)>=1&&(this.holdEnd(),Y(e.id).then(()=>this.alerts=this.alerts.filter(a=>a.id!==e.id)).catch(()=>{})))},80)},this.holdEnd=()=>{this.holdStart=null,window.clearInterval(this.holdTimer)},this.lastEmit="",this.pressStart=()=>{window.clearTimeout(this.longPress),this.longPress=window.setTimeout(()=>{this.panel=!0,window.clearTimeout(this.panelTimer),this.panelTimer=window.setTimeout(()=>this.panel=!1,1e4)},1200)},this.pressEnd=()=>window.clearTimeout(this.longPress)}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),window.addEventListener("orientationchange",this.onResize),this.addEventListener("pointerdown",this.onTouch),window.addEventListener("pointermove",this.onMove),this.stopDevice=R(e=>this.env=e),this.timer=window.setInterval(()=>this.onTick(),1e3),j().then(e=>this.settings=e).catch(()=>{}),this.load(),this.pollAnnouncement()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),window.removeEventListener("orientationchange",this.onResize),this.removeEventListener("pointerdown",this.onTouch),window.removeEventListener("pointermove",this.onMove),this.stopDevice?.(),window.clearInterval(this.timer),window.clearTimeout(this.retry),window.clearTimeout(this.longPress),window.clearTimeout(this.panelTimer),window.clearTimeout(this.updatedTimer),window.clearInterval(this.holdTimer),window.clearTimeout(this.annTimer),this.closeSocket()}async pollAnnouncement(){let e=6e4;try{const a=await G();this.announcement=a.announcement,this.annCloseS=a.critical_close_s,a.announcement&&a.announcement.id!==this.annSeen.id&&(this.annSeen={id:a.announcement.id,at:Date.now()}),e=fe(a.poll_s,6e4)}catch{}window.clearTimeout(this.annTimer),this.annTimer=window.setTimeout(()=>void this.pollAnnouncement(),e)}renderAnnouncement(e=!1){const a=this.announcement;return!a||!ue(a,this.now,this.annClosed)||e&&!a.critical?r:i`<div class="announce" data-wall-announcement=${a.id} data-critical=${a.critical?"1":"0"} role="alert">
      <div class="ann-in" data-size=${ge(a)}>
        <span class="ann-tag">${be(a,"he")}</span>
        <div class="ann-body">${a.texts.map(t=>i`<p class="ann-t" lang=${t.language} dir=${xe(t.language)} data-machine=${t.machine?"1":r}>${t.text}${t.machine?i`<span class="ann-mt">${ke(t.language)}</span>`:r}</p>`)}</div>
      </div>
      ${(()=>{const t=E(a,this.annSeen.id===a.id?this.annSeen.at:this.now,this.now,this.annCloseS);return i`<button class="ann-close" type="button" data-wall-announcement-close data-close-wait=${Math.ceil(t/1e3)} ?disabled=${t>0} aria-label=${ye("he")}
          @click=${()=>{E(a,this.annSeen.at,Date.now(),this.annCloseS)===0&&(this.annClosed=a.id)}}>${t>0?i`<span class="ann-wait" aria-hidden="true">${Math.ceil(t/1e3)}</span>`:i`<sw-icon name="close"></sw-icon>`}</button>`})()}
    </div>`}async load(){try{const e=await Q(),a=!this.data;this.data=e,this.setAlerts(e.alerts??[]),this.loadFrame(),this.phase="ready",this.downSince=null,a||this.flashUpdated(),this.openSocket(),this.refreshStates(!0)}catch(e){if(e instanceof _&&e.status===401){this.phase="removed";return}if(e instanceof _&&e.status===403){e.body.code==="wall_user_remote_not_allowed"?this.phase="remote-refused":T();return}this.downSince??=Date.now(),this.data||(this.phase="no-connection"),this.scheduleRetry()}}scheduleRetry(){window.clearTimeout(this.retry),this.retry=window.setTimeout(()=>void this.load(),ee(this.downSince?Date.now()-this.downSince:0))}openSocket(){if(!(this.ws&&this.ws.readyState<=1))try{const e=new WebSocket(ae());this.ws=e,e.onopen=()=>e.send(JSON.stringify({type:"hello",payload:{class:f(this.env),screen:`${this.env.screenWidth}x${this.env.screenHeight}`}})),e.onmessage=a=>{try{const t=JSON.parse(String(a.data));t.type==="config"&&t.payload?.version!==this.data?.version?this.load():t.type==="alerts"?this.setAlerts(t.payload?.alerts??[]):t.type==="disabled"?T():t.type==="revoked"?this.phase="removed":t.type==="hello"&&(this.downSince=null)}catch{}},e.onclose=a=>{if(this.ws=null,a.code===4401&&this.phase==="ready"){this.load();return}this.downSince??=Date.now(),this.scheduleRetry()}}catch{this.downSince??=Date.now()}}closeSocket(){const e=this.ws;this.ws=null,e&&(e.onclose=null,e.close())}flashUpdated(){this.chipUpdated=!0,window.clearTimeout(this.updatedTimer),this.updatedTimer=window.setTimeout(()=>this.chipUpdated=!1,3e3)}setAlerts(e){const a=Date.now(),t=new Set(e.map(s=>s.id));for(const s of this.alerts)!t.has(s.id)&&s.severity!=="info"&&(this.resolved=[...this.resolved.filter(n=>n.id!==s.id),{id:s.id,text:`נסגר · ${s.place||s.title}`,until:a+5e3}]);for(const s of e)this.shownAt.has(s.id)||this.shownAt.set(s.id,a);for(const s of[...this.shownAt.keys()])t.has(s)||(this.shownAt.delete(s),this.seenUntil.delete(s));this.alerts=e}alertsOn(){return this.data?.config.alerts.enabled?this.alerts:[]}markSeen(e){this.seenUntil.set(e.id,Date.now()+(this.data?.config.alerts.takeover_timeout_s??120)*1e3),this.requestUpdate()}async loadFrame(){const e=this.data?.config.frame,a=e&&e.enabled&&e.folder?`${e.folder}:${this.data?.version}`:"";if(a!==this.frameListFor){if(this.frameListFor=a,!a){this.photos=[];return}try{this.photos=(await te()).photos,this.order=D(this.photos.length),this.frameIdx=0,this.frameSwitchAt=Date.now()}catch{this.photos=[],this.frameListFor=""}}}frameOn(){const e=this.data;return e?se({enabled:e.config.frame.enabled,photos:this.photos.length,idleMin:e.config.frame.idle_min,lastActivityMs:this.activityAt,nowMs:this.now,asleep:!this.awake(),attention:M(this.alertsOn())}):!1}async refreshStates(e=!1){const a=this.data?.config.state_entities??[],t=Date.now();if(a.length&&(e||t-this.lastStates>3e4)){this.lastStates=t;try{this.states=(await ie(a)).states}catch{}}if(e||t-this.lastHealth>6e4){this.lastHealth=t;try{this.healthOk=(await B()).status==="ok"}catch{this.healthOk=null}}}onTick(){if(this.now=Date.now(),this.tick+=1,this.toggleAttribute("data-cursor-idle",ne(f(this.env),this.movedAt,this.now)),this.phase!=="ready"||!this.data)return;const e=this.data.config;for(const[t,s]of this.ok){if(s)continue;const n=this.nextTry.get(t)??0;if(this.now>=n){const p=this.tries.get(t)??0;this.epoch.set(t,(this.epoch.get(t)??0)+1),this.tries.set(t,p+1),this.nextTry.set(t,this.now+L[Math.min(p,L.length-1)]*1e3)}}this.refreshStates(),M(this.alertsOn())&&(this.activityAt=this.now),this.resolved.length&&(this.resolved=this.resolved.filter(t=>t.until>this.now)),this.photos.length&&this.frameOn()&&this.now-this.frameSwitchAt>=e.frame.interval_s*1e3&&(this.frameSwitchAt=this.now,this.frameIdx+1>=this.order.length?(this.order=D(this.photos.length,Math.random,this.order[this.order.length-1]),this.frameIdx=0):this.frameIdx+=1),e.schedule.windows.length&&this.emitSleepState(!this.awake())}emitSleepState(e){const a=e?"sleep":"wake";if(a!==this.lastEmit){this.lastEmit=a,document.title=e?"SmplWise Arx - sleep":"SmplWise Arx";try{window.parent.postMessage({type:"arx-wall",state:a},"*")}catch{}}}awake(){return!this.data||this.now<this.wakeUntil||re(this.alertsOn(),this.data.config.schedule.wake_on_alert_severity)?!0:oe(this.data.config.schedule.windows,this.data.zone,new Date(this.now))}onPlayer(e,a){const t=a.detail?.status;t==="playing"?(this.ok.set(e,!0),this.drop.delete(e),this.tries.set(e,0),this.nextTry.delete(e)):(t==="error"||t==="ended")&&(this.ok.get(e)!==!1&&this.drop.set(e,Date.now()),this.ok.set(e,!1)),this.requestUpdate()}clockParts(){const e=this.data?.zone||"Asia/Jerusalem",a=new Date(this.now);try{return{time:N(a,{timeZone:e}),date:new Intl.DateTimeFormat("he-IL",{timeZone:e,weekday:"long",day:"numeric",month:"long"}).format(a)}}catch{return{time:a.toTimeString().slice(0,5),date:""}}}hhmmss(e){return new Date(e).toTimeString().slice(0,8)}render(){const e=le(f(this.env),this.env.screenWidth,this.env.screenHeight,this.vw,this.vh),a=`--s:${e}`;if(this.phase==="loading")return i`<div class="center" data-wall-state="loading" style=${a}><span class="mark" data-tone="live"><sw-icon name="camera" size="28"></sw-icon></span><p>טוען…</p></div>`;if(this.phase==="no-connection")return i`<div class="center" data-wall-state="no-connection" style=${a}><span class="mark" data-tone="danger"><sw-icon name="warning" size="28"></sw-icon></span><h1>אין חיבור לשרת</h1><p>מנסה שוב אוטומטית</p></div>`;if(this.phase==="removed")return i`<div class="center" data-wall-state="access-removed" style=${a}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>הגישה למסך הזה הוסרה</h1><p>יש להתחבר מחדש עם משתמש מסך קיר</p></div>`;if(this.phase==="remote-refused")return i`<div class="center" data-wall-state="remote-refused" style=${a}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>המסך הזה אינו מורשה להתחבר מרחוק</h1><p>יש להתחבר מהרשת המקומית, או לאפשר גישה מרחוק בהגדרות מסכי קיר</p></div>`;const t=this.data;if(!t)return r;const s=t.config;this.setAttribute("data-wall-theme",s.theme==="light"?"light":"dark");const n=this.clockParts();if(!this.awake()){const[l,m]=[10+this.now/6e4%60*1.3,15+this.now/9e4%60*1.2];return i`<div class="wall sleep" data-wall-state="sleep" style=${`${a};display:block`}><div class="bigclock" style=${`inset-inline-start:${l}%;inset-block-start:${m}%`}>${n.time}${n.date?i`<small>${n.date}</small>`:r}</div>${this.renderAnnouncement(!0)}</div>`}const c=ce({layout:s.layout,grid:s.grid,cameras:t.cameras.length,viewportW:this.vw,viewportH:this.vh,showMap:s.show_map,rotateS:s.rotate_s}),v=c.rotateS>0?Math.floor(this.now/(c.rotateS*1e3))%c.pages:0,g=s.burn_in.shuffle_h>0&&t.cameras.length>1&&c.preset!=="single"?Math.floor(this.now/(s.burn_in.shuffle_h*36e5)):0,u=de(t.cameras,v,c.perPage,g),[P,C]=O(this.now,s.burn_in.shift),I=(this.now-this.touchedAt)/6e4,x=s.burn_in.dim_after_min>0&&I>=s.burn_in.dim_after_min,k=he(this.downSince,this.now);if(k==="clock"){const[l,m]=[20+this.now/6e4%60*.6,20+this.now/9e4%60*.7];return i`<div class="wall sleep" data-wall-state="server-offline-clock" style=${`${a};display:block`}><div class="bigclock" style=${`inset-inline-start:${l}%;inset-block-start:${m}%;opacity:.5`}>${n.time}${n.date?i`<small>${n.date}</small>`:r}</div><div class="banner" style="position:absolute;inset-block-end:var(--pad);inset-inline-start:var(--pad)">אין חיבור למערכת · מנסה שוב</div></div>`}const b=J(this.settings),w=pe(this.alertsOn(),this.shownAt,this.seenUntil,this.now,s.alerts.takeover_timeout_s,this.tap),y=w.chips.filter(l=>l.severity!=="info"),$=[...this.resolved.map(l=>i`<span class="chip" data-wall-resolved>${l.text}</span>`),...w.chips.filter(l=>l.severity==="info").map(l=>i`<span class="chip" data-wall-info-chip><i></i>${l.title}${l.place?` · ${l.place}`:""}</span>`),...y.length?[i`<span class="chip" data-tone="danger" data-wall-alert-chip><i></i>התראות · ${y.length}</span>`]:[]];if(this.frameOn()&&this.photos.length)return this.renderFrame(t,n,e,$);const U=$.concat(s.strip.includes("health")?[this.healthChip()]:[]).concat(this.states.map(l=>i`<span class="chip" data-chip=${l.id}>${l.name} <b>${l.state??""}${l.unit?` ${l.unit}`:""}</b></span>`)),z=me(c.preset),S=k==="banner"?i`<span class="banner" data-wall-banner>אין חיבור למערכת · מנסה שוב</span>`:U,W=i`<div class="strip" data-wall-strip>
      <span class="place" data-wall-title>${t.title}</span>
      ${s.strip.includes("clock")?i`<span class="clock" data-wall-clock @pointerdown=${this.pressStart} @pointerup=${this.pressEnd} @pointerleave=${this.pressEnd} @pointercancel=${this.pressEnd}>${n.time}${s.strip.includes("date")&&n.date?i`<span class="date">${n.date}</span>`:r}</span>`:i`<span style="margin-inline:auto"></span>`}
      ${z==="strip"?i`<span class="chips">${S}</span>`:r}
    </div>`;return i`<div class=${`wall ${x?"dim":""}`} data-wall-state="base" data-preset=${c.preset} ?data-map=${c.map} data-wall-class=${f(this.env)} style=${`${a};--cols:${c.cols};--rows:${c.rows};transform:translate(${P}px,${C}px);opacity:${x?s.burn_in.dim_to:1}`}>
      ${W}
      ${u.length||w.tile?i`<div class="grid" data-wall-grid>${w.tile?this.renderAlertTile(w.tile,w.more,s,b):r}${u.slice(w.tile?1:0).map(l=>this.renderTile(l,b,s.offline.show_last_frame_s))}${c.pages>1?i`<div class="dots" data-wall-dots>${Array.from({length:c.pages},(l,m)=>i`<i ?data-on=${m===v}></i>`)}</div>`:r}</div>`:i`<div class="empty" data-wall-state="no-cameras">לא הוגדרו מצלמות למסך הזה</div>`}
      ${c.map?this.renderMapPane():r}
      ${z==="band"?i`<div class="band" data-wall-band>${S}</div>`:r}
      ${w.takeover.length?this.renderTakeover(w.takeover,t,n,b):r}
      ${this.renderAnnouncement()}
      ${this.panel?this.renderPanel(t):r}
      ${this.chipUpdated?i`<span class="chip updated" data-wall-updated>ההגדרות עודכנו</span>`:r}
    </div>`}ago(e){const a=Math.max(0,Math.round((this.now-new Date(e.first_at).getTime())/6e4)),t=new Date(e.last_at);let s="";try{s=new Intl.DateTimeFormat("he-IL",{timeZone:this.data?.zone||"Asia/Jerusalem",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(t)}catch{s=t.toTimeString().slice(0,5)}return`${a<1?"עכשיו":`${a} דקות`} · ${s}`}alertCamera(e,a,t){const s=e.camera_id?this.data?.cameras.find(n=>n.id===e.camera_id):void 0;return s?i`<sw-camera-tile dark noDemo name=${t??s.name} state="live" live cameraId=${s.id} profile="sub" autoProfile transport=${a}></sw-camera-tile>`:r}alertButtons(e,a){const t=A(this.holdStart,this.now);return i`<button class="btn" data-wall-seen=${e.id} @click=${()=>this.markSeen(e)}><sw-icon name="eye"></sw-icon><span>ראיתי</span></button>
      ${a?i`<button class="btn" data-hold data-wall-ack=${e.id} style=${`--hold:${t}`} @pointerdown=${()=>this.holdBegin(e)} @pointerup=${this.holdEnd} @pointerleave=${this.holdEnd} @pointercancel=${this.holdEnd}><sw-icon name="check"></sw-icon><span>אישור · החזק</span></button>`:i`<span class="note" data-wall-ack-off><sw-icon name="lock" size="14"></sw-icon> אישור מהמסך הזה לא מופעל</span>`}`}renderAlertTile(e,a,t,s){return i`<div class="atile" data-wall-alert-tile=${e.id} data-severity=${e.severity}>
      <div class="head"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${e.title}${e.place?` · ${e.place}`:""}</b><span class="sub">${this.ago(e)}${e.count>1?` · ×${e.count}`:""}</span></div>
        ${a>0?i`<span class="more" data-wall-alert-more @click=${()=>this.tap++}>+${a}</span>`:r}</div>
      <div class="media">${this.alertCamera(e,s)}</div>
      <div class="foot">${this.alertButtons(e,t.alerts.ack_allowed)}</div>
    </div>`}renderTakeover(e,a,t,s){const n=e[0];return i`<div class="takeover" data-wall-state="takeover" data-wall-takeover=${n.id}>
      <div class="strip"><span class="place"><sw-icon name="warning"></sw-icon> התראה קריטית · ${a.title}</span><span class="clock">${t.time}</span>${e.length>1?i`<span class="chips"><span class="chip" data-tone="danger" data-wall-takeover-count>${e.length} התראות</span></span>`:r}</div>
      <div class="media">${this.alertCamera(n,s)}
        <div class="titles"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${n.title}</b><span class="sub">${n.place?`${n.place} · `:""}${this.ago(n)}</span></div></div>
      </div>
      ${e.length>1?i`<div class="foot" data-wall-takeover-stack>${e.slice(1,4).map(p=>i`<span class="chip" data-tone="danger">${p.title}${p.place?` · ${p.place}`:""}</span>`)}</div>`:r}
      <div class="foot">${this.alertButtons(n,a.config.alerts.ack_allowed)}</div>
    </div>`}renderFrame(e,a,t,s){const n=e.config.frame,[p,c]=O(this.now,e.config.burn_in.shift),v=this.photos[this.order[this.frameIdx]??0]?.id??this.photos[0].id,g=(this.now-this.touchedAt)/6e4,u=e.config.burn_in.dim_after_min>0&&g>=e.config.burn_in.dim_after_min;return i`<div class="frame" data-wall-state="frame" data-motion=${n.motion} style=${`--s:${t};opacity:${u?e.config.burn_in.dim_to:1};transform:translate(${p}px,${c}px)`}>
      <img data-wall-photo=${v} alt="" src=${we(v)} style=${`object-fit:${n.fit}`} />
      ${s.length?i`<span class="chips" data-wall-frame-chips>${s}</span>`:r}
      ${n.clock?i`<div class="fclock" data-wall-frame-clock><b>${a.time}</b><span>${a.date}${a.date?" · ":""}${e.title}</span></div>`:r}
      ${this.renderAnnouncement()}
    </div>`}renderMapPane(){const e=this.data;return e?.floor_id?(this.planLoaded||(this.planLoaded=!0,q(()=>import("./sw-wall-plan-C0qGanny.js"),__vite__mapDeps([0]),import.meta.url)),i`<div class="pane" data-wall-map-slot role="img" aria-label="תוכנית הקומה"><sw-wall-plan .floorId=${e.floor_id} .plan=${e.config.plan} .theme=${e.config.theme}></sw-wall-plan></div>`):i`<div class="pane" data-wall-map-slot aria-hidden="true"></div>`}healthChip(){return this.healthOk===null?i`<span class="chip" data-tone="stale" data-wall-health><i></i>מצב המערכת</span>`:this.healthOk?i`<span class="chip" data-tone="live" data-wall-health><i></i>המערכת תקינה</span>`:i`<span class="chip" data-tone="stale" data-wall-health><i></i>יש תקלות</span>`}renderTile(e,a,t){const s=this.ok.get(e.id),n=this.drop.get(e.id)??null,p=s===!1?ve(n,this.now,0,t):"live";return i`<div class="tile" data-wall-tile=${e.id} data-health=${p} @player-status=${c=>this.onPlayer(e.id,c)}>
      ${Z(`${e.id}:${this.epoch.get(e.id)??0}`,i`<sw-camera-tile dark noDemo name=${e.name} state=${p==="live"?"live":"stale"} ?live=${p!=="lost"} cameraId=${e.id} profile="sub" autoProfile transport=${a}></sw-camera-tile>`)}
      ${p==="stale"?i`<span class="badge" data-wall-badge>אין וידאו${n?` · ${this.hhmmss(n)}`:""}</span>`:r}
      ${p==="lost"?i`<div class="lost" data-wall-lost><b>${e.name}</b><span>אין וידאו</span></div>`:r}
    </div>`}renderPanel(e){const a=K.me,t=f(this.env);return i`<div class="panel" data-wall-panel role="status"><dl>
      <dt>משתמש</dt><dd>${a?.user.username??""}</dd>
      <dt>מסך</dt><dd>${e.title}</dd>
      <dt>סוג מכשיר</dt><dd>${t} · ${this.env.screenWidth}x${this.env.screenHeight}</dd>
      <dt>ערוץ</dt><dd>${a?.channel??"local"}</dd>
      <dt>חיבור</dt><dd>${this.downSince?"מנותק":"מחובר"}</dd>
      <dt>גרסת הגדרות</dt><dd>${e.version}</dd>
    </dl></div>`}};o.styles=V`
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
    .announce [data-size='xs'] .ann-t { font-size: calc(22px * var(--s, 1)); } /* ANNOUNCE-297: four full-length languages */
    .announce [data-size='xs'] .ann-body { gap: calc(14px * var(--s, 1)); }
    .announce [data-size='xs'] .ann-t + .ann-t { padding-block-start: calc(12px * var(--s, 1)); }
    .announce .ann-mt {
      display: block;
      margin-block-start: 0.35em;
      font-size: max(calc(14px * var(--s, 1)), 0.3em);
      font-weight: 500;
      opacity: 0.72;
    }
    .announce {
      animation: ann-in 0.24s cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    .announce .ann-wait {
      font-size: calc(18px * var(--s, 1));
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    @keyframes ann-in {
      from {
        opacity: 0;
      }
    }
    .announce .ann-close[disabled] {
      opacity: 0.35;
      cursor: default;
    }
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
    /* WALL-FOLLOWUPS-2390: a desktop wall (mouse, no touch) hides the parked pointer after 3 s without movement; any movement brings it back at once */
    :host([data-cursor-idle]),
    :host([data-cursor-idle]) * {
      cursor: none !important;
    }
  `;d([h()],o.prototype,"phase",2);d([h()],o.prototype,"data",2);d([h()],o.prototype,"states",2);d([h()],o.prototype,"healthOk",2);d([h()],o.prototype,"now",2);d([h()],o.prototype,"vw",2);d([h()],o.prototype,"vh",2);d([h()],o.prototype,"panel",2);d([h()],o.prototype,"chipUpdated",2);d([h()],o.prototype,"touchedAt",2);d([h()],o.prototype,"wakeUntil",2);d([h()],o.prototype,"tick",2);d([h()],o.prototype,"alerts",2);d([h()],o.prototype,"announcement",2);d([h()],o.prototype,"annClosed",2);d([h()],o.prototype,"tap",2);d([h()],o.prototype,"resolved",2);d([h()],o.prototype,"holdStart",2);d([h()],o.prototype,"frameIdx",2);d([h()],o.prototype,"env",2);o=d([X("sw-wall")],o);export{o as SwWall};
//# sourceMappingURL=sw-wall-CxHSf1zD.js.map
