const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as B}from"./sw-logo-art-PLtEZJxU.js";import{a as R,r as j,w as N,p as q,A as l,b as s,c as T,l as A,d as f,t as r,h as J,u as D,e as Z,f as V,g as X,s as Y,j as K,k as p,m as G}from"./index-CoJbESCx.js";import{h as M,a as Q,g as ee,b as te,r as ae,w as ie,c as se,s as O,f as ne,n as E,d as re,e as oe,i as le,j as ce,k as de,l as he,m as pe,p as we,o as C,q as ve,t as me,u as ue,v as fe,x as ge}from"./wall-logic-xSGqG7-i.js";import{p as be,v as xe,s as ke,h as $e,d as ye,m as ze,c as L,a as Se}from"./screen-overlay-0pGzIZOP.js";var _e=Object.defineProperty,Te=Object.getOwnPropertyDescriptor,d=(e,t,a,i)=>{for(var n=i>1?void 0:i?Te(t,a):t,w=e.length-1,h;w>=0;w--)(h=e[w])&&(n=(i?h(t,a,n):h(n))||n);return i&&n&&_e(t,a,n),n};const P=[2,4,8,15];let o=class extends R{constructor(){super(...arguments),this.phase="loading",this.data=null,this.states=[],this.healthOk=null,this.newBuild=!1,this.now=Date.now(),this.vw=window.innerWidth,this.vh=window.innerHeight,this.panel=!1,this.chipUpdated=!1,this.touchedAt=Date.now(),this.wakeUntil=0,this.tick=0,this.alerts=[],this.announcement=null,this.annClosed="",this.annTimer=0,this.annSeen={id:"",at:0},this.tap=0,this.resolved=[],this.holdStart=null,this.frameIdx=0,this.photos=[],this.order=[],this.frameSwitchAt=0,this.frameListFor="",this.activityAt=Date.now(),this.shownAt=new Map,this.seenUntil=new Map,this.holdTimer=0,this.settings=null,this.ws=null,this.downSince=null,this.timer=0,this.retry=0,this.longPress=0,this.panelTimer=0,this.updatedTimer=0,this.lastStates=0,this.lastHealth=0,this.ok=new Map,this.drop=new Map,this.epoch=new Map,this.tries=new Map,this.nextTry=new Map,this.planLoaded=!1,this.env=j(),this.movedAt=Date.now(),this.onMove=e=>{e.pointerType==="mouse"&&(this.movedAt=Date.now(),this.hasAttribute("data-cursor-idle")&&this.removeAttribute("data-cursor-idle"))},this.onResize=()=>{this.vw=window.innerWidth,this.vh=window.innerHeight},this.onTouch=()=>{this.touchedAt=Date.now(),this.activityAt=this.touchedAt,this.data?.config.schedule.wake_on_touch&&(this.wakeUntil=Date.now()+10*6e4)},this.holdBegin=e=>{this.holdStart=Date.now(),window.clearInterval(this.holdTimer),this.holdTimer=window.setInterval(()=>{this.holdStart!==null&&(this.now=Date.now(),M(this.holdStart,this.now)>=1&&(this.holdEnd(),Q(e.id).then(()=>this.alerts=this.alerts.filter(t=>t.id!==e.id)).catch(()=>{})))},80)},this.holdEnd=()=>{this.holdStart=null,window.clearInterval(this.holdTimer)},this.lastEmit="",this.pressStart=()=>{window.clearTimeout(this.longPress),this.longPress=window.setTimeout(()=>{this.panel=!0,window.clearTimeout(this.panelTimer),this.panelTimer=window.setTimeout(()=>this.panel=!1,1e4)},1200)},this.pressEnd=()=>window.clearTimeout(this.longPress)}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),window.addEventListener("orientationchange",this.onResize),this.addEventListener("pointerdown",this.onTouch),window.addEventListener("pointermove",this.onMove),this.stopDevice=N(e=>this.env=e),this.timer=window.setInterval(()=>this.onTick(),1e3),q().then(e=>this.settings=e).catch(()=>{}),this.load(),this.pollAnnouncement()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),window.removeEventListener("orientationchange",this.onResize),this.removeEventListener("pointerdown",this.onTouch),window.removeEventListener("pointermove",this.onMove),this.stopDevice?.(),window.clearInterval(this.timer),window.clearTimeout(this.retry),window.clearTimeout(this.longPress),window.clearTimeout(this.panelTimer),window.clearTimeout(this.updatedTimer),window.clearInterval(this.holdTimer),window.clearTimeout(this.annTimer),this.closeSocket()}async pollAnnouncement(){let e=6e4;try{const t=await ee();this.announcement=t.announcement,this.annCloseS=t.critical_close_s,t.announcement&&t.announcement.id!==this.annSeen.id&&(this.annSeen={id:t.announcement.id,at:Date.now()}),e=be(t.poll_s,6e4)}catch{}window.clearTimeout(this.annTimer),this.annTimer=window.setTimeout(()=>void this.pollAnnouncement(),e)}renderAnnouncement(e=!1){const t=this.announcement;return!t||!xe(t,this.now,this.annClosed)||e&&!t.critical?l:s`<div class="announce" data-wall-announcement=${t.id} data-critical=${t.critical?"1":"0"} role="alert">
      <div class="ann-in" data-size=${ke(t)}>
        <span class="ann-tag">${$e(t,"he")}</span>
        <div class="ann-body">${t.texts.map(a=>s`<p class="ann-t" lang=${a.language} dir=${ye(a.language)} data-machine=${a.machine?"1":l}>${a.text}${a.machine?s`<span class="ann-mt">${ze(a.language)}</span>`:l}</p>`)}</div>
      </div>
      ${(()=>{const a=L(t,this.annSeen.id===t.id?this.annSeen.at:this.now,this.now,this.annCloseS);return s`<button class="ann-close" type="button" data-wall-announcement-close data-close-wait=${Math.ceil(a/1e3)} ?disabled=${a>0} aria-label=${Se("he")}
          @click=${()=>{L(t,this.annSeen.at,Date.now(),this.annCloseS)===0&&(this.annClosed=t.id)}}>${a>0?s`<span class="ann-wait" aria-hidden="true">${Math.ceil(a/1e3)}</span>`:s`<sw-icon name="close"></sw-icon>`}</button>`})()}
    </div>`}async load(){try{const e=await te(),t=!this.data;this.data=e,this.setAlerts(e.alerts??[]),this.loadFrame(),this.phase="ready",this.downSince=null,t||this.flashUpdated(),this.openSocket(),this.refreshStates(!0)}catch(e){if(e instanceof T&&e.status===401){this.phase="removed";return}if(e instanceof T&&e.status===403){e.body.code==="wall_user_remote_not_allowed"?this.phase="remote-refused":A();return}this.downSince??=Date.now(),this.data||(this.phase="no-connection"),this.scheduleRetry()}}scheduleRetry(){window.clearTimeout(this.retry),this.retry=window.setTimeout(()=>void this.load(),ae(this.downSince?Date.now()-this.downSince:0))}openSocket(){if(!(this.ws&&this.ws.readyState<=1))try{const e=new WebSocket(ie());this.ws=e,e.onopen=()=>e.send(JSON.stringify({type:"hello",payload:{class:f(this.env),screen:`${this.env.screenWidth}x${this.env.screenHeight}`}})),e.onmessage=t=>{try{const a=JSON.parse(String(t.data));a.type==="config"&&a.payload?.version!==this.data?.version?this.load():a.type==="alerts"?this.setAlerts(a.payload?.alerts??[]):a.type==="disabled"?A():a.type==="revoked"?this.phase="removed":a.type==="hello"&&(this.downSince=null)}catch{}},e.onclose=t=>{if(this.ws=null,t.code===4401&&this.phase==="ready"){this.load();return}this.downSince??=Date.now(),this.scheduleRetry()}}catch{this.downSince??=Date.now()}}closeSocket(){const e=this.ws;this.ws=null,e&&(e.onclose=null,e.close())}flashUpdated(){this.chipUpdated=!0,window.clearTimeout(this.updatedTimer),this.updatedTimer=window.setTimeout(()=>this.chipUpdated=!1,3e3)}setAlerts(e){const t=Date.now(),a=new Set(e.map(i=>i.id));for(const i of this.alerts)!a.has(i.id)&&i.severity!=="info"&&(this.resolved=[...this.resolved.filter(n=>n.id!==i.id),{id:i.id,text:`${r("נסגר")} · ${i.place||i.title}`,until:t+5e3}]);for(const i of e)this.shownAt.has(i.id)||this.shownAt.set(i.id,t);for(const i of[...this.shownAt.keys()])a.has(i)||(this.shownAt.delete(i),this.seenUntil.delete(i));this.alerts=e}alertsOn(){return this.data?.config.alerts.enabled?this.alerts:[]}markSeen(e){this.seenUntil.set(e.id,Date.now()+(this.data?.config.alerts.takeover_timeout_s??120)*1e3),this.requestUpdate()}async loadFrame(){const e=this.data?.config.frame,t=e&&e.enabled&&e.folder?`${e.folder}:${this.data?.version}`:"";if(t!==this.frameListFor){if(this.frameListFor=t,!t){this.photos=[];return}try{this.photos=(await se()).photos,this.order=O(this.photos.length),this.frameIdx=0,this.frameSwitchAt=Date.now()}catch{this.photos=[],this.frameListFor=""}}}frameOn(){const e=this.data;return e?ne({enabled:e.config.frame.enabled,photos:this.photos.length,idleMin:e.config.frame.idle_min,lastActivityMs:this.activityAt,nowMs:this.now,asleep:!this.awake(),attention:E(this.alertsOn())}):!1}async refreshStates(e=!1){const t=this.data?.config.state_entities??[],a=Date.now();if(t.length&&(e||a-this.lastStates>3e4)){this.lastStates=a;try{this.states=(await re(t)).states}catch{}}if(e||a-this.lastHealth>6e4){this.lastHealth=a;try{const i=await J();this.healthOk=i.status==="ok",oe(i.version,"2.54.0")&&(this.newBuild=!0)}catch{this.healthOk=null}}}onTick(){if(this.now=Date.now(),this.tick+=1,this.toggleAttribute("data-cursor-idle",le(f(this.env),this.movedAt,this.now)),this.phase!=="ready"||!this.data)return;const e=this.data.config;for(const[a,i]of this.ok){if(i)continue;const n=this.nextTry.get(a)??0;if(this.now>=n){const w=this.tries.get(a)??0;this.epoch.set(a,(this.epoch.get(a)??0)+1),this.tries.set(a,w+1),this.nextTry.set(a,this.now+P[Math.min(w,P.length-1)]*1e3)}}this.refreshStates(),E(this.alertsOn())&&(this.activityAt=this.now),this.resolved.length&&(this.resolved=this.resolved.filter(a=>a.until>this.now)),this.photos.length&&this.frameOn()&&this.now-this.frameSwitchAt>=e.frame.interval_s*1e3&&(this.frameSwitchAt=this.now,this.frameIdx+1>=this.order.length?(this.order=O(this.photos.length,Math.random,this.order[this.order.length-1]),this.frameIdx=0):this.frameIdx+=1),e.schedule.windows.length&&this.emitSleepState(!this.awake())}emitSleepState(e){const t=e?"sleep":"wake";if(t!==this.lastEmit){this.lastEmit=t,document.title=e?"SmplWise Arx - sleep":"SmplWise Arx";try{window.parent.postMessage({type:"arx-wall",state:t},"*")}catch{}}}awake(){return!this.data||this.now<this.wakeUntil||ce(this.alertsOn(),this.data.config.schedule.wake_on_alert_severity)?!0:de(this.data.config.schedule.windows,this.data.zone,new Date(this.now))}onPlayer(e,t){const a=t.detail?.status;a==="playing"?(this.ok.set(e,!0),this.drop.delete(e),this.tries.set(e,0),this.nextTry.delete(e)):(a==="error"||a==="ended")&&(this.ok.get(e)!==!1&&this.drop.set(e,Date.now()),this.ok.set(e,!1)),this.requestUpdate()}clockParts(){const e=this.data?.zone||"Asia/Jerusalem",t=new Date(this.now);try{return{time:Z(t,{timeZone:e}),date:new Intl.DateTimeFormat(D(),{timeZone:e,weekday:"long",day:"numeric",month:"long"}).format(t)}}catch{return{time:t.toTimeString().slice(0,5),date:""}}}hhmmss(e){return new Date(e).toTimeString().slice(0,8)}render(){const e=he(f(this.env),this.env.screenWidth,this.env.screenHeight,this.vw,this.vh),t=`--s:${e}`;if(this.phase==="loading")return s`<div class="center" data-wall-state="loading" style=${t}><span class="mark" data-tone="live"><sw-icon name="camera" size="28"></sw-icon></span><p>${r("טוען…")}</p></div>`;if(this.phase==="no-connection")return s`<div class="center" data-wall-state="no-connection" style=${t}><span class="mark" data-tone="danger"><sw-icon name="warning" size="28"></sw-icon></span><h1>${r("אין חיבור לשרת")}</h1><p>${r("מנסה שוב אוטומטית")}</p></div>`;if(this.phase==="removed")return s`<div class="center" data-wall-state="access-removed" style=${t}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>${r("הגישה למסך הזה הוסרה")}</h1><p>${r("יש להתחבר מחדש עם משתמש מסך קיר")}</p></div>`;if(this.phase==="remote-refused")return s`<div class="center" data-wall-state="remote-refused" style=${t}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>${r("המסך הזה אינו מורשה להתחבר מרחוק")}</h1><p>${r("יש להתחבר מהרשת המקומית, או לאפשר גישה מרחוק בהגדרות מסכי קיר")}</p></div>`;const a=this.data;if(!a)return l;const i=a.config;this.setAttribute("data-wall-theme",i.theme==="light"?"light":"dark");const n=this.clockParts();if(!this.awake()){const[c,u]=[10+this.now/6e4%60*1.3,15+this.now/9e4%60*1.2];return s`<div class="wall sleep" data-wall-state="sleep" style=${`${t};display:block`}><div class="bigclock" style=${`inset-inline-start:${c}%;inset-block-start:${u}%`}>${n.time}${n.date?s`<small>${n.date}</small>`:l}</div>${this.renderAnnouncement(!0)}</div>`}const h=pe({layout:i.layout,grid:i.grid,cameras:a.cameras.length,viewportW:this.vw,viewportH:this.vh,showMap:i.show_map,rotateS:i.rotate_s}),m=h.rotateS>0?Math.floor(this.now/(h.rotateS*1e3))%h.pages:0,b=i.burn_in.shuffle_h>0&&a.cameras.length>1&&h.preset!=="single"?Math.floor(this.now/(i.burn_in.shuffle_h*36e5)):0,g=we(a.cameras,m,h.perPage,b),[U,I]=C(this.now,i.burn_in.shift),W=(this.now-this.touchedAt)/6e4,k=i.burn_in.dim_after_min>0&&W>=i.burn_in.dim_after_min,$=ve(this.downSince,this.now);if($==="clock"){const[c,u]=[20+this.now/6e4%60*.6,20+this.now/9e4%60*.7];return s`<div class="wall sleep" data-wall-state="server-offline-clock" style=${`${t};display:block`}><div class="bigclock" style=${`inset-inline-start:${c}%;inset-block-start:${u}%;opacity:.5`}>${n.time}${n.date?s`<small>${n.date}</small>`:l}</div><div class="banner" style="position:absolute;inset-block-end:var(--pad);inset-inline-start:var(--pad)">${r("אין חיבור למערכת · מנסה שוב")}</div></div>`}const x=V(this.settings),v=me(this.alertsOn(),this.shownAt,this.seenUntil,this.now,i.alerts.takeover_timeout_s,this.tap),y=v.chips.filter(c=>c.severity!=="info"),z=[...this.resolved.map(c=>s`<span class="chip" data-wall-resolved>${c.text}</span>`),...v.chips.filter(c=>c.severity==="info").map(c=>s`<span class="chip" data-wall-info-chip><i></i>${c.title}${c.place?` · ${c.place}`:""}</span>`),...y.length?[s`<span class="chip" data-tone="danger" data-wall-alert-chip><i></i>${r("התראות · {n}",{n:y.length})}</span>`]:[]];if(this.frameOn()&&this.photos.length)return this.renderFrame(a,n,e,z);const F=z.concat(i.strip.includes("health")?[this.healthChip()]:[]).concat(this.states.map(c=>s`<span class="chip" data-chip=${c.id}>${c.name} <b>${c.state??""}${c.unit?` ${c.unit}`:""}</b></span>`)),S=ge(h.preset),_=$==="banner"?s`<span class="banner" data-wall-banner>${r("אין חיבור למערכת · מנסה שוב")}</span>`:F,H=s`<div class="strip" data-wall-strip>
      <span class="place" data-wall-title>${a.title}</span>
      ${i.strip.includes("clock")?s`<span class="clock" data-wall-clock @pointerdown=${this.pressStart} @pointerup=${this.pressEnd} @pointerleave=${this.pressEnd} @pointercancel=${this.pressEnd}>${n.time}${i.strip.includes("date")&&n.date?s`<span class="date">${n.date}</span>`:l}</span>`:s`<span style="margin-inline:auto"></span>`}
      ${S==="strip"?s`<span class="chips">${_}</span>`:l}
    </div>`;return s`<div class=${`wall ${k?"dim":""}`} data-wall-state="base" data-preset=${h.preset} ?data-map=${h.map} data-wall-class=${f(this.env)} style=${`${t};--cols:${h.cols};--rows:${h.rows};transform:translate(${U}px,${I}px);opacity:${k?i.burn_in.dim_to:1}`}>
      ${H}
      ${g.length||v.tile?s`<div class="grid" data-wall-grid>${v.tile?this.renderAlertTile(v.tile,v.more,i,x):l}${g.slice(v.tile?1:0).map(c=>this.renderTile(c,x,i.offline.show_last_frame_s))}${h.pages>1?s`<div class="dots" data-wall-dots>${Array.from({length:h.pages},(c,u)=>s`<i ?data-on=${u===m}></i>`)}</div>`:l}</div>`:s`<div class="empty" data-wall-state="no-cameras">${r("לא הוגדרו מצלמות למסך הזה")}</div>`}
      ${h.map?this.renderMapPane():l}
      ${S==="band"?s`<div class="band" data-wall-band>${_}</div>`:l}
      ${v.takeover.length?this.renderTakeover(v.takeover,a,n,x):l}
      ${this.renderAnnouncement()}
      ${this.panel?this.renderPanel(a):l}
      ${this.chipUpdated?s`<span class="chip updated" data-wall-updated>${r("ההגדרות עודכנו")}</span>`:this.newBuild?s`<button type="button" class="chip updated newbuild" data-wall-new-build @click=${()=>location.reload()}>${r("גרסה חדשה של Arx זמינה")} · ${r("רענון")}</button>`:l}
    </div>`}ago(e){const t=Math.max(0,Math.round((this.now-new Date(e.first_at).getTime())/6e4)),a=new Date(e.last_at);let i="";try{i=new Intl.DateTimeFormat(D(),{timeZone:this.data?.zone||"Asia/Jerusalem",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(a)}catch{i=a.toTimeString().slice(0,5)}return`${t<1?r("עכשיו"):r("{n} דקות",{n:t})} · ${i}`}alertCamera(e,t,a){const i=e.camera_id?this.data?.cameras.find(n=>n.id===e.camera_id):void 0;return i?s`<sw-camera-tile dark noDemo name=${a??i.name} state="live" live cameraId=${i.id} profile="sub" autoProfile transport=${t}></sw-camera-tile>`:l}alertButtons(e,t){const a=M(this.holdStart,this.now);return s`<button class="btn" data-wall-seen=${e.id} @click=${()=>this.markSeen(e)}><sw-icon name="eye"></sw-icon><span>${r("ראיתי")}</span></button>
      ${t?s`<button class="btn" data-hold data-wall-ack=${e.id} style=${`--hold:${a}`} @pointerdown=${()=>this.holdBegin(e)} @pointerup=${this.holdEnd} @pointerleave=${this.holdEnd} @pointercancel=${this.holdEnd}><sw-icon name="check"></sw-icon><span>${r("אישור · החזק")}</span></button>`:s`<span class="note" data-wall-ack-off><sw-icon name="lock" size="14"></sw-icon> ${r("אישור מהמסך הזה לא מופעל")}</span>`}`}renderAlertTile(e,t,a,i){return s`<div class="atile" data-wall-alert-tile=${e.id} data-severity=${e.severity}>
      <div class="head"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${e.title}${e.place?` · ${e.place}`:""}</b><span class="sub">${this.ago(e)}${e.count>1?` · ×${e.count}`:""}</span></div>
        ${t>0?s`<span class="more" data-wall-alert-more @click=${()=>this.tap++}>+${t}</span>`:l}</div>
      <div class="media">${this.alertCamera(e,i)}</div>
      <div class="foot">${this.alertButtons(e,a.alerts.ack_allowed)}</div>
    </div>`}renderTakeover(e,t,a,i){const n=e[0];return s`<div class="takeover" data-wall-state="takeover" data-wall-takeover=${n.id}>
      <div class="strip"><span class="place"><sw-icon name="warning"></sw-icon> ${r("התראה קריטית")} · ${t.title}</span><span class="clock">${a.time}</span>${e.length>1?s`<span class="chips"><span class="chip" data-tone="danger" data-wall-takeover-count>${r("{n} התראות",{n:e.length})}</span></span>`:l}</div>
      <div class="media">${this.alertCamera(n,i)}
        <div class="titles"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${n.title}</b><span class="sub">${n.place?`${n.place} · `:""}${this.ago(n)}</span></div></div>
      </div>
      ${e.length>1?s`<div class="foot" data-wall-takeover-stack>${e.slice(1,4).map(w=>s`<span class="chip" data-tone="danger">${w.title}${w.place?` · ${w.place}`:""}</span>`)}</div>`:l}
      <div class="foot">${this.alertButtons(n,t.config.alerts.ack_allowed)}</div>
    </div>`}renderFrame(e,t,a,i){const n=e.config.frame,[w,h]=C(this.now,e.config.burn_in.shift),m=this.photos[this.order[this.frameIdx]??0]?.id??this.photos[0].id,b=(this.now-this.touchedAt)/6e4,g=e.config.burn_in.dim_after_min>0&&b>=e.config.burn_in.dim_after_min;return s`<div class="frame" data-wall-state="frame" data-motion=${n.motion} style=${`--s:${a};opacity:${g?e.config.burn_in.dim_to:1};transform:translate(${w}px,${h}px)`}>
      <img data-wall-photo=${m} alt="" src=${ue(m)} style=${`object-fit:${n.fit}`} />
      ${i.length?s`<span class="chips" data-wall-frame-chips>${i}</span>`:l}
      ${n.clock?s`<div class="fclock" data-wall-frame-clock><b>${t.time}</b><span>${t.date}${t.date?" · ":""}${e.title}</span></div>`:l}
      ${this.renderAnnouncement()}
    </div>`}renderMapPane(){const e=this.data;return e?.floor_id?(this.planLoaded||(this.planLoaded=!0,B(()=>import("./sw-wall-plan-D2Yq23le.js"),__vite__mapDeps([0]),import.meta.url)),s`<div class="pane" data-wall-map-slot role="img" aria-label=${r("תוכנית הקומה")}><sw-wall-plan .floorId=${e.floor_id} .plan=${e.config.plan} .theme=${e.config.theme}></sw-wall-plan></div>`):s`<div class="pane" data-wall-map-slot aria-hidden="true"></div>`}healthChip(){return this.healthOk===null?s`<span class="chip" data-tone="stale" data-wall-health><i></i>${r("מצב המערכת")}</span>`:this.healthOk?s`<span class="chip" data-tone="live" data-wall-health><i></i>${r("המערכת תקינה")}</span>`:s`<span class="chip" data-tone="stale" data-wall-health><i></i>${r("יש תקלות")}</span>`}renderTile(e,t,a){const i=this.ok.get(e.id),n=this.drop.get(e.id)??null,w=i===!1?fe(n,this.now,0,a):"live";return s`<div class="tile" data-wall-tile=${e.id} data-health=${w} @player-status=${h=>this.onPlayer(e.id,h)}>
      ${X(`${e.id}:${this.epoch.get(e.id)??0}`,s`<sw-camera-tile dark noDemo name=${e.name} state=${w==="live"?"live":"stale"} ?live=${w!=="lost"} cameraId=${e.id} profile="sub" autoProfile transport=${t}></sw-camera-tile>`)}
      ${w==="stale"?s`<span class="badge" data-wall-badge>${r("אין וידאו")}${n?` · ${this.hhmmss(n)}`:""}</span>`:l}
      ${w==="lost"?s`<div class="lost" data-wall-lost><b>${e.name}</b><span>${r("אין וידאו")}</span></div>`:l}
    </div>`}renderPanel(e){const t=Y.me,a=f(this.env);return s`<div class="panel" data-wall-panel role="status"><dl>
      <dt>${r("משתמש")}</dt><dd>${t?.user.username??""}</dd>
      <dt>${r("מסך")}</dt><dd>${e.title}</dd>
      <dt>${r("סוג מכשיר")}</dt><dd>${a} · ${this.env.screenWidth}x${this.env.screenHeight}</dd>
      <dt>${r("ערוץ")}</dt><dd>${t?.channel??"local"}</dd>
      <dt>${r("חיבור")}</dt><dd>${this.downSince?r("מנותק"):r("מחובר")}</dd>
      <dt>${r("גרסת הגדרות")}</dt><dd>${e.version}</dd>
    </dl></div>`}};o.styles=K`
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
    .newbuild {
      border: 0;
      color: inherit;
      font-family: inherit;
      cursor: pointer;
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
      text-shadow: 0 2px 14px color-mix(in srgb, var(--sw-video-shadow-ink) 75%, transparent);
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
      text-shadow: 0 2px 14px color-mix(in srgb, var(--sw-video-shadow-ink) 75%, transparent);
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
  `;d([p()],o.prototype,"phase",2);d([p()],o.prototype,"data",2);d([p()],o.prototype,"states",2);d([p()],o.prototype,"healthOk",2);d([p()],o.prototype,"newBuild",2);d([p()],o.prototype,"now",2);d([p()],o.prototype,"vw",2);d([p()],o.prototype,"vh",2);d([p()],o.prototype,"panel",2);d([p()],o.prototype,"chipUpdated",2);d([p()],o.prototype,"touchedAt",2);d([p()],o.prototype,"wakeUntil",2);d([p()],o.prototype,"tick",2);d([p()],o.prototype,"alerts",2);d([p()],o.prototype,"announcement",2);d([p()],o.prototype,"annClosed",2);d([p()],o.prototype,"tap",2);d([p()],o.prototype,"resolved",2);d([p()],o.prototype,"holdStart",2);d([p()],o.prototype,"frameIdx",2);d([p()],o.prototype,"env",2);o=d([G("sw-wall")],o);export{o as SwWall};
