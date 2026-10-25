const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-BonxfBTz.css"])))=>i.map(i=>d[i]);
import{a as L,ar as C,as as _,at as F,au as H,av as R,A as S,aw as T,ax as W,ay as B,az as b,aA as j,aB as A,aC as J,aD as D,aE as q,aF as N,aG as Z,aH as G,M as K,aI as V,I as i,G as c,aJ as X,aK as Y,aL as E,aM as Q,aN as tt,aO as et,aP as at,aQ as st,aR as it,aS as nt,aT as rt,an as lt,ap as p,aq as ot}from"./index-B0wZ3jU8.js";import"./tv-logic-BPxLuJLJ.js";var dt=Object.defineProperty,ct=Object.getOwnPropertyDescriptor,h=(t,e,a,s)=>{for(var n=s>1?void 0:s?ct(e,a):e,d=t.length-1,l;d>=0;d--)(l=t[d])&&(n=(s?l(e,a,n):l(n))||n);return s&&n&&dt(e,a,n),n};const M=[2,4,8,15];let o=class extends L{constructor(){super(...arguments),this.phase="loading",this.data=null,this.states=[],this.healthOk=null,this.now=Date.now(),this.vw=window.innerWidth,this.vh=window.innerHeight,this.panel=!1,this.chipUpdated=!1,this.touchedAt=Date.now(),this.wakeUntil=0,this.tick=0,this.alerts=[],this.tap=0,this.resolved=[],this.holdStart=null,this.frameIdx=0,this.photos=[],this.order=[],this.frameSwitchAt=0,this.frameListFor="",this.activityAt=Date.now(),this.shownAt=new Map,this.seenUntil=new Map,this.holdTimer=0,this.settings=null,this.ws=null,this.downSince=null,this.timer=0,this.retry=0,this.longPress=0,this.panelTimer=0,this.updatedTimer=0,this.lastStates=0,this.lastHealth=0,this.ok=new Map,this.drop=new Map,this.epoch=new Map,this.tries=new Map,this.nextTry=new Map,this.planLoaded=!1,this.env=C(),this.onResize=()=>{this.vw=window.innerWidth,this.vh=window.innerHeight},this.onTouch=()=>{this.touchedAt=Date.now(),this.activityAt=this.touchedAt,this.data?.config.schedule.wake_on_touch&&(this.wakeUntil=Date.now()+10*6e4)},this.holdBegin=t=>{this.holdStart=Date.now(),window.clearInterval(this.holdTimer),this.holdTimer=window.setInterval(()=>{this.holdStart!==null&&(this.now=Date.now(),_(this.holdStart,this.now)>=1&&(this.holdEnd(),F(t.id).then(()=>this.alerts=this.alerts.filter(e=>e.id!==t.id)).catch(()=>{})))},80)},this.holdEnd=()=>{this.holdStart=null,window.clearInterval(this.holdTimer)},this.lastEmit="",this.pressStart=()=>{window.clearTimeout(this.longPress),this.longPress=window.setTimeout(()=>{this.panel=!0,window.clearTimeout(this.panelTimer),this.panelTimer=window.setTimeout(()=>this.panel=!1,1e4)},1200)},this.pressEnd=()=>window.clearTimeout(this.longPress)}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),window.addEventListener("orientationchange",this.onResize),this.addEventListener("pointerdown",this.onTouch),this.timer=window.setInterval(()=>this.onTick(),1e3),H().then(t=>this.settings=t).catch(()=>{}),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),window.removeEventListener("orientationchange",this.onResize),this.removeEventListener("pointerdown",this.onTouch),window.clearInterval(this.timer),window.clearTimeout(this.retry),window.clearTimeout(this.longPress),window.clearTimeout(this.panelTimer),window.clearTimeout(this.updatedTimer),window.clearInterval(this.holdTimer),this.closeSocket()}async load(){try{const t=await R(),e=!this.data;this.data=t,this.setAlerts(t.alerts??[]),this.loadFrame(),this.phase="ready",this.downSince=null,e||this.flashUpdated(),this.openSocket(),this.refreshStates(!0)}catch(t){if(t instanceof S&&t.status===401){this.phase="removed";return}if(t instanceof S&&t.status===403){t.body.code==="wall_user_remote_not_allowed"?this.phase="remote-refused":T();return}this.downSince??=Date.now(),this.data||(this.phase="no-connection"),this.scheduleRetry()}}scheduleRetry(){window.clearTimeout(this.retry),this.retry=window.setTimeout(()=>void this.load(),W(this.downSince?Date.now()-this.downSince:0))}openSocket(){if(!(this.ws&&this.ws.readyState<=1))try{const t=new WebSocket(B());this.ws=t,t.onopen=()=>t.send(JSON.stringify({type:"hello",payload:{class:b(this.env),screen:`${this.env.screenWidth}x${this.env.screenHeight}`}})),t.onmessage=e=>{try{const a=JSON.parse(String(e.data));a.type==="config"&&a.payload?.version!==this.data?.version?this.load():a.type==="alerts"?this.setAlerts(a.payload?.alerts??[]):a.type==="disabled"?T():a.type==="revoked"?this.phase="removed":a.type==="hello"&&(this.downSince=null)}catch{}},t.onclose=e=>{if(this.ws=null,e.code===4401&&this.phase==="ready"){this.load();return}this.downSince??=Date.now(),this.scheduleRetry()}}catch{this.downSince??=Date.now()}}closeSocket(){const t=this.ws;this.ws=null,t&&(t.onclose=null,t.close())}flashUpdated(){this.chipUpdated=!0,window.clearTimeout(this.updatedTimer),this.updatedTimer=window.setTimeout(()=>this.chipUpdated=!1,3e3)}setAlerts(t){const e=Date.now(),a=new Set(t.map(s=>s.id));for(const s of this.alerts)!a.has(s.id)&&s.severity!=="info"&&(this.resolved=[...this.resolved.filter(n=>n.id!==s.id),{id:s.id,text:`נסגר · ${s.place||s.title}`,until:e+5e3}]);for(const s of t)this.shownAt.has(s.id)||this.shownAt.set(s.id,e);for(const s of[...this.shownAt.keys()])a.has(s)||(this.shownAt.delete(s),this.seenUntil.delete(s));this.alerts=t}alertsOn(){return this.data?.config.alerts.enabled?this.alerts:[]}markSeen(t){this.seenUntil.set(t.id,Date.now()+(this.data?.config.alerts.takeover_timeout_s??120)*1e3),this.requestUpdate()}async loadFrame(){const t=this.data?.config.frame,e=t&&t.enabled&&t.folder?`${t.folder}:${this.data?.version}`:"";if(e!==this.frameListFor){if(this.frameListFor=e,!e){this.photos=[];return}try{this.photos=(await j()).photos,this.order=A(this.photos.length),this.frameIdx=0,this.frameSwitchAt=Date.now()}catch{this.photos=[],this.frameListFor=""}}}frameOn(){const t=this.data;return t?J({enabled:t.config.frame.enabled,photos:this.photos.length,idleMin:t.config.frame.idle_min,lastActivityMs:this.activityAt,nowMs:this.now,asleep:!this.awake(),attention:D(this.alertsOn())}):!1}async refreshStates(t=!1){const e=this.data?.config.state_entities??[],a=Date.now();if(e.length&&(t||a-this.lastStates>3e4)){this.lastStates=a;try{this.states=(await q(e)).states}catch{}}if(t||a-this.lastHealth>6e4){this.lastHealth=a;try{this.healthOk=(await N()).status==="ok"}catch{this.healthOk=null}}}onTick(){if(this.now=Date.now(),this.tick+=1,this.phase!=="ready"||!this.data)return;const t=this.data.config;for(const[a,s]of this.ok){if(s)continue;const n=this.nextTry.get(a)??0;if(this.now>=n){const d=this.tries.get(a)??0;this.epoch.set(a,(this.epoch.get(a)??0)+1),this.tries.set(a,d+1),this.nextTry.set(a,this.now+M[Math.min(d,M.length-1)]*1e3)}}this.refreshStates(),D(this.alertsOn())&&(this.activityAt=this.now),this.resolved.length&&(this.resolved=this.resolved.filter(a=>a.until>this.now)),this.photos.length&&this.frameOn()&&this.now-this.frameSwitchAt>=t.frame.interval_s*1e3&&(this.frameSwitchAt=this.now,this.frameIdx+1>=this.order.length?(this.order=A(this.photos.length,Math.random,this.order[this.order.length-1]),this.frameIdx=0):this.frameIdx+=1),t.schedule.windows.length&&this.emitSleepState(!this.awake())}emitSleepState(t){const e=t?"sleep":"wake";if(e!==this.lastEmit){this.lastEmit=e,document.title=t?"SmplWise Arx - sleep":"SmplWise Arx";try{window.parent.postMessage({type:"arx-wall",state:e},"*")}catch{}}}awake(){return!this.data||this.now<this.wakeUntil||Z(this.alertsOn(),this.data.config.schedule.wake_on_alert_severity)?!0:G(this.data.config.schedule.windows,this.data.zone,new Date(this.now))}onPlayer(t,e){const a=e.detail?.status;a==="playing"?(this.ok.set(t,!0),this.drop.delete(t),this.tries.set(t,0),this.nextTry.delete(t)):(a==="error"||a==="ended")&&(this.ok.get(t)!==!1&&this.drop.set(t,Date.now()),this.ok.set(t,!1)),this.requestUpdate()}clockParts(){const t=this.data?.zone||"Asia/Jerusalem",e=new Date(this.now);try{return{time:K(e,{timeZone:t}),date:new Intl.DateTimeFormat("he-IL",{timeZone:t,weekday:"long",day:"numeric",month:"long"}).format(e)}}catch{return{time:e.toTimeString().slice(0,5),date:""}}}hhmmss(t){return new Date(t).toTimeString().slice(0,8)}render(){const t=V(this.env.screenWidth,this.env.screenHeight),e=`--s:${t}`;if(this.phase==="loading")return i`<div class="center" data-wall-state="loading" style=${e}><span class="mark" data-tone="live"><sw-icon name="camera" size="28"></sw-icon></span><p>טוען…</p></div>`;if(this.phase==="no-connection")return i`<div class="center" data-wall-state="no-connection" style=${e}><span class="mark" data-tone="danger"><sw-icon name="warning" size="28"></sw-icon></span><h1>אין חיבור לשרת</h1><p>מנסה שוב אוטומטית</p></div>`;if(this.phase==="removed")return i`<div class="center" data-wall-state="access-removed" style=${e}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>הגישה למסך הזה הוסרה</h1><p>יש להתחבר מחדש עם משתמש מסך קיר</p></div>`;if(this.phase==="remote-refused")return i`<div class="center" data-wall-state="remote-refused" style=${e}><span class="mark"><sw-icon name="lock" size="28"></sw-icon></span><h1>המסך הזה אינו מורשה להתחבר מרחוק</h1><p>יש להתחבר מהרשת המקומית, או לאפשר גישה מרחוק בהגדרות מסכי קיר</p></div>`;const a=this.data;if(!a)return c;const s=a.config;this.setAttribute("data-wall-theme",s.theme==="light"?"light":"dark");const n=this.clockParts();if(!this.awake()){const[r,m]=[10+this.now/6e4%60*1.3,15+this.now/9e4%60*1.2];return i`<div class="wall sleep" data-wall-state="sleep" style=${`${e};display:block`}><div class="bigclock" style=${`inset-inline-start:${r}%;inset-block-start:${m}%`}>${n.time}${n.date?i`<small>${n.date}</small>`:c}</div></div>`}const l=X({layout:s.layout,grid:s.grid,cameras:a.cameras.length,viewportW:this.vw,viewportH:this.vh,showMap:s.show_map,rotateS:s.rotate_s}),v=l.rotateS>0?Math.floor(this.now/(l.rotateS*1e3))%l.pages:0,g=s.burn_in.shuffle_h>0&&a.cameras.length>1&&l.preset!=="single"?Math.floor(this.now/(s.burn_in.shuffle_h*36e5)):0,f=Y(a.cameras,v,l.perPage,g),[O,I]=E(this.now,s.burn_in.shift),P=(this.now-this.touchedAt)/6e4,x=s.burn_in.dim_after_min>0&&P>=s.burn_in.dim_after_min,k=Q(this.downSince,this.now);if(k==="clock"){const[r,m]=[20+this.now/6e4%60*.6,20+this.now/9e4%60*.7];return i`<div class="wall sleep" data-wall-state="server-offline-clock" style=${`${e};display:block`}><div class="bigclock" style=${`inset-inline-start:${r}%;inset-block-start:${m}%;opacity:.5`}>${n.time}${n.date?i`<small>${n.date}</small>`:c}</div><div class="banner" style="position:absolute;inset-block-end:var(--pad);inset-inline-start:var(--pad)">אין חיבור למערכת · מנסה שוב</div></div>`}const u=tt(this.settings),w=et(this.alertsOn(),this.shownAt,this.seenUntil,this.now,s.alerts.takeover_timeout_s,this.tap),y=w.chips.filter(r=>r.severity!=="info"),$=[...this.resolved.map(r=>i`<span class="chip" data-wall-resolved>${r.text}</span>`),...w.chips.filter(r=>r.severity==="info").map(r=>i`<span class="chip" data-wall-info-chip><i></i>${r.title}${r.place?` · ${r.place}`:""}</span>`),...y.length?[i`<span class="chip" data-tone="danger" data-wall-alert-chip><i></i>התראות · ${y.length}</span>`]:[]];if(this.frameOn()&&this.photos.length)return this.renderFrame(a,n,t,$);const z=$.concat(s.strip.includes("health")?[this.healthChip()]:[]).concat(this.states.map(r=>i`<span class="chip" data-chip=${r.id}>${r.name} <b>${r.state??""}${r.unit?` ${r.unit}`:""}</b></span>`)),U=i`<div class="strip" data-wall-strip>
      <span class="place" data-wall-title>${a.title}</span>
      ${s.strip.includes("clock")?i`<span class="clock" data-wall-clock @pointerdown=${this.pressStart} @pointerup=${this.pressEnd} @pointerleave=${this.pressEnd} @pointercancel=${this.pressEnd}>${n.time}${s.strip.includes("date")&&n.date?i`<span class="date">${n.date}</span>`:c}</span>`:i`<span style="margin-inline:auto"></span>`}
      <span class="chips">${k==="banner"?i`<span class="banner" data-wall-banner>אין חיבור למערכת · מנסה שוב</span>`:z}</span>
    </div>`;return i`<div class=${`wall ${x?"dim":""}`} data-wall-state="base" data-preset=${l.preset} ?data-map=${l.map} data-wall-class=${b(this.env)} style=${`${e};--cols:${l.cols};--rows:${l.rows};transform:translate(${O}px,${I}px);opacity:${x?s.burn_in.dim_to:1}`}>
      ${U}
      ${f.length||w.tile?i`<div class="grid" data-wall-grid>${w.tile?this.renderAlertTile(w.tile,w.more,s,u):c}${f.slice(w.tile?1:0).map(r=>this.renderTile(r,u,s.offline.show_last_frame_s))}${l.pages>1?i`<div class="dots" data-wall-dots>${Array.from({length:l.pages},(r,m)=>i`<i ?data-on=${m===v}></i>`)}</div>`:c}</div>`:i`<div class="empty" data-wall-state="no-cameras">לא הוגדרו מצלמות למסך הזה</div>`}
      ${l.map?this.renderMapPane():c}
      ${l.preset==="tablet-portrait"?i`<div class="band" data-wall-band>${z}</div>`:c}
      ${w.takeover.length?this.renderTakeover(w.takeover,a,n,u):c}
      ${this.panel?this.renderPanel(a):c}
      ${this.chipUpdated?i`<span class="chip updated" data-wall-updated>ההגדרות עודכנו</span>`:c}
    </div>`}ago(t){const e=Math.max(0,Math.round((this.now-new Date(t.first_at).getTime())/6e4)),a=new Date(t.last_at);let s="";try{s=new Intl.DateTimeFormat("he-IL",{timeZone:this.data?.zone||"Asia/Jerusalem",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(a)}catch{s=a.toTimeString().slice(0,5)}return`${e<1?"עכשיו":`${e} דקות`} · ${s}`}alertCamera(t,e,a){const s=t.camera_id?this.data?.cameras.find(n=>n.id===t.camera_id):void 0;return s?i`<sw-camera-tile dark noDemo name=${a??s.name} state="live" live cameraId=${s.id} profile="sub" transport=${e}></sw-camera-tile>`:c}alertButtons(t,e){const a=_(this.holdStart,this.now);return i`<button class="btn" data-wall-seen=${t.id} @click=${()=>this.markSeen(t)}><sw-icon name="eye"></sw-icon><span>ראיתי</span></button>
      ${e?i`<button class="btn" data-hold data-wall-ack=${t.id} style=${`--hold:${a}`} @pointerdown=${()=>this.holdBegin(t)} @pointerup=${this.holdEnd} @pointerleave=${this.holdEnd} @pointercancel=${this.holdEnd}><sw-icon name="check"></sw-icon><span>אישור · החזק</span></button>`:i`<span class="note" data-wall-ack-off><sw-icon name="lock" size="14"></sw-icon> אישור מהמסך הזה לא מופעל</span>`}`}renderAlertTile(t,e,a,s){return i`<div class="atile" data-wall-alert-tile=${t.id} data-severity=${t.severity}>
      <div class="head"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${t.title}${t.place?` · ${t.place}`:""}</b><span class="sub">${this.ago(t)}${t.count>1?` · ×${t.count}`:""}</span></div>
        ${e>0?i`<span class="more" data-wall-alert-more @click=${()=>this.tap++}>+${e}</span>`:c}</div>
      <div class="media">${this.alertCamera(t,s)}</div>
      <div class="foot">${this.alertButtons(t,a.alerts.ack_allowed)}</div>
    </div>`}renderTakeover(t,e,a,s){const n=t[0];return i`<div class="takeover" data-wall-state="takeover" data-wall-takeover=${n.id}>
      <div class="strip"><span class="place"><sw-icon name="warning"></sw-icon> התראה קריטית · ${e.title}</span><span class="clock">${a.time}</span>${t.length>1?i`<span class="chips"><span class="chip" data-tone="danger" data-wall-takeover-count>${t.length} התראות</span></span>`:c}</div>
      <div class="media">${this.alertCamera(n,s)}
        <div class="titles"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${n.title}</b><span class="sub">${n.place?`${n.place} · `:""}${this.ago(n)}</span></div></div>
      </div>
      ${t.length>1?i`<div class="foot" data-wall-takeover-stack>${t.slice(1,4).map(d=>i`<span class="chip" data-tone="danger">${d.title}${d.place?` · ${d.place}`:""}</span>`)}</div>`:c}
      <div class="foot">${this.alertButtons(n,e.config.alerts.ack_allowed)}</div>
    </div>`}renderFrame(t,e,a,s){const n=t.config.frame,[d,l]=E(this.now,t.config.burn_in.shift),v=this.photos[this.order[this.frameIdx]??0]?.id??this.photos[0].id,g=(this.now-this.touchedAt)/6e4,f=t.config.burn_in.dim_after_min>0&&g>=t.config.burn_in.dim_after_min;return i`<div class="frame" data-wall-state="frame" data-motion=${n.motion} style=${`--s:${a};opacity:${f?t.config.burn_in.dim_to:1};transform:translate(${d}px,${l}px)`}>
      <img data-wall-photo=${v} alt="" src=${at(v)} style=${`object-fit:${n.fit}`} />
      ${s.length?i`<span class="chips" data-wall-frame-chips>${s}</span>`:c}
      ${n.clock?i`<div class="fclock" data-wall-frame-clock><b>${e.time}</b><span>${e.date}${e.date?" · ":""}${t.title}</span></div>`:c}
    </div>`}renderMapPane(){const t=this.data;return t?.floor_id?(this.planLoaded||(this.planLoaded=!0,st(()=>import("./sw-wall-plan-B7jQocJ4.js"),__vite__mapDeps([0]),import.meta.url)),i`<div class="pane" data-wall-map-slot role="img" aria-label="תוכנית הקומה"><sw-wall-plan .floorId=${t.floor_id} .plan=${t.config.plan} .theme=${t.config.theme}></sw-wall-plan></div>`):i`<div class="pane" data-wall-map-slot aria-hidden="true"></div>`}healthChip(){return this.healthOk===null?i`<span class="chip" data-tone="stale" data-wall-health><i></i>מצב המערכת</span>`:this.healthOk?i`<span class="chip" data-tone="live" data-wall-health><i></i>המערכת תקינה</span>`:i`<span class="chip" data-tone="stale" data-wall-health><i></i>יש תקלות</span>`}renderTile(t,e,a){const s=this.ok.get(t.id),n=this.drop.get(t.id)??null,d=s===!1?it(n,this.now,0,a):"live";return i`<div class="tile" data-wall-tile=${t.id} data-health=${d} @player-status=${l=>this.onPlayer(t.id,l)}>
      ${nt(`${t.id}:${this.epoch.get(t.id)??0}`,i`<sw-camera-tile dark noDemo name=${t.name} state=${d==="live"?"live":"stale"} ?live=${d!=="lost"} cameraId=${t.id} profile="sub" transport=${e}></sw-camera-tile>`)}
      ${d==="stale"?i`<span class="badge" data-wall-badge>אין וידאו${n?` · ${this.hhmmss(n)}`:""}</span>`:c}
      ${d==="lost"?i`<div class="lost" data-wall-lost><b>${t.name}</b><span>אין וידאו</span></div>`:c}
    </div>`}renderPanel(t){const e=rt.me,a=b(this.env);return i`<div class="panel" data-wall-panel role="status"><dl>
      <dt>משתמש</dt><dd>${e?.user.username??""}</dd>
      <dt>מסך</dt><dd>${t.title}</dd>
      <dt>סוג מכשיר</dt><dd>${a} · ${this.env.screenWidth}x${this.env.screenHeight}</dd>
      <dt>ערוץ</dt><dd>${e?.channel??"local"}</dd>
      <dt>חיבור</dt><dd>${this.downSince?"מנותק":"מחובר"}</dd>
      <dt>גרסת הגדרות</dt><dd>${t.version}</dd>
    </dl></div>`}};o.styles=lt`
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
  `;h([p()],o.prototype,"phase",2);h([p()],o.prototype,"data",2);h([p()],o.prototype,"states",2);h([p()],o.prototype,"healthOk",2);h([p()],o.prototype,"now",2);h([p()],o.prototype,"vw",2);h([p()],o.prototype,"vh",2);h([p()],o.prototype,"panel",2);h([p()],o.prototype,"chipUpdated",2);h([p()],o.prototype,"touchedAt",2);h([p()],o.prototype,"wakeUntil",2);h([p()],o.prototype,"tick",2);h([p()],o.prototype,"alerts",2);h([p()],o.prototype,"tap",2);h([p()],o.prototype,"resolved",2);h([p()],o.prototype,"holdStart",2);h([p()],o.prototype,"frameIdx",2);o=h([ot("sw-wall")],o);export{o as SwWall};
//# sourceMappingURL=sw-wall-DjIjSNA1.js.map
