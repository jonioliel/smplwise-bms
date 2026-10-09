import{i as C,r as P,h as z,a as F,p as L,g as H,A as _,l as T,b as W,w as R,c as b,d as B,s as A,f as j,n as D,e as J,j as q,k as Z,m as N,o as i,q as h,t as X,u as G,v as K,x as E,y as V,z as Y,B as Q,C as tt,D as et,E as at,F as st,G as it,H as c,I as nt}from"./index-BMylAT-E.js";var rt=Object.defineProperty,lt=Object.getOwnPropertyDescriptor,d=(t,e,a,s)=>{for(var n=s>1?void 0:s?lt(e,a):e,r=t.length-1,p;r>=0;r--)(p=t[r])&&(n=(s?p(e,a,n):p(n))||n);return s&&n&&rt(e,a,n),n};const I=[2,4,8,15];let o=class extends C{constructor(){super(...arguments),this.phase="loading",this.data=null,this.states=[],this.healthOk=null,this.now=Date.now(),this.vw=window.innerWidth,this.vh=window.innerHeight,this.panel=!1,this.chipUpdated=!1,this.touchedAt=Date.now(),this.wakeUntil=0,this.tick=0,this.alerts=[],this.tap=0,this.resolved=[],this.holdStart=null,this.frameIdx=0,this.photos=[],this.order=[],this.frameSwitchAt=0,this.frameListFor="",this.activityAt=Date.now(),this.shownAt=new Map,this.seenUntil=new Map,this.holdTimer=0,this.settings=null,this.ws=null,this.downSince=null,this.timer=0,this.retry=0,this.longPress=0,this.panelTimer=0,this.updatedTimer=0,this.lastStates=0,this.lastHealth=0,this.ok=new Map,this.drop=new Map,this.epoch=new Map,this.tries=new Map,this.nextTry=new Map,this.env=P(),this.onResize=()=>{this.vw=window.innerWidth,this.vh=window.innerHeight},this.onTouch=()=>{this.touchedAt=Date.now(),this.activityAt=this.touchedAt,this.data?.config.schedule.wake_on_touch&&(this.wakeUntil=Date.now()+10*6e4)},this.holdBegin=t=>{this.holdStart=Date.now(),window.clearInterval(this.holdTimer),this.holdTimer=window.setInterval(()=>{this.holdStart!==null&&(this.now=Date.now(),z(this.holdStart,this.now)>=1&&(this.holdEnd(),F(t.id).then(()=>this.alerts=this.alerts.filter(e=>e.id!==t.id)).catch(()=>{})))},80)},this.holdEnd=()=>{this.holdStart=null,window.clearInterval(this.holdTimer)},this.lastEmit="",this.pressStart=()=>{window.clearTimeout(this.longPress),this.longPress=window.setTimeout(()=>{this.panel=!0,window.clearTimeout(this.panelTimer),this.panelTimer=window.setTimeout(()=>this.panel=!1,1e4)},1200)},this.pressEnd=()=>window.clearTimeout(this.longPress)}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),window.addEventListener("orientationchange",this.onResize),this.addEventListener("pointerdown",this.onTouch),this.timer=window.setInterval(()=>this.onTick(),1e3),L().then(t=>this.settings=t).catch(()=>{}),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),window.removeEventListener("orientationchange",this.onResize),this.removeEventListener("pointerdown",this.onTouch),window.clearInterval(this.timer),window.clearTimeout(this.retry),window.clearTimeout(this.longPress),window.clearTimeout(this.panelTimer),window.clearTimeout(this.updatedTimer),window.clearInterval(this.holdTimer),this.closeSocket()}async load(){try{const t=await H(),e=!this.data;this.data=t,this.setAlerts(t.alerts??[]),this.loadFrame(),this.phase="ready",this.downSince=null,e||this.flashUpdated(),this.openSocket(),this.refreshStates(!0)}catch(t){if(t instanceof _&&t.status===401){this.phase="removed";return}if(t instanceof _&&t.status===403){t.body.code==="wall_user_remote_not_allowed"?this.phase="remote-refused":T();return}this.downSince??=Date.now(),this.data||(this.phase="no-connection"),this.scheduleRetry()}}scheduleRetry(){window.clearTimeout(this.retry),this.retry=window.setTimeout(()=>void this.load(),W(this.downSince?Date.now()-this.downSince:0))}openSocket(){if(!(this.ws&&this.ws.readyState<=1))try{const t=new WebSocket(R());this.ws=t,t.onopen=()=>t.send(JSON.stringify({type:"hello",payload:{class:b(this.env),screen:`${this.env.screenWidth}x${this.env.screenHeight}`}})),t.onmessage=e=>{try{const a=JSON.parse(String(e.data));a.type==="config"&&a.payload?.version!==this.data?.version?this.load():a.type==="alerts"?this.setAlerts(a.payload?.alerts??[]):a.type==="disabled"?T():a.type==="revoked"?this.phase="removed":a.type==="hello"&&(this.downSince=null)}catch{}},t.onclose=e=>{if(this.ws=null,e.code===4401&&this.phase==="ready"){this.load();return}this.downSince??=Date.now(),this.scheduleRetry()}}catch{this.downSince??=Date.now()}}closeSocket(){const t=this.ws;this.ws=null,t&&(t.onclose=null,t.close())}flashUpdated(){this.chipUpdated=!0,window.clearTimeout(this.updatedTimer),this.updatedTimer=window.setTimeout(()=>this.chipUpdated=!1,3e3)}setAlerts(t){const e=Date.now(),a=new Set(t.map(s=>s.id));for(const s of this.alerts)!a.has(s.id)&&s.severity!=="info"&&(this.resolved=[...this.resolved.filter(n=>n.id!==s.id),{id:s.id,text:`נסגר · ${s.place||s.title}`,until:e+5e3}]);for(const s of t)this.shownAt.has(s.id)||this.shownAt.set(s.id,e);for(const s of[...this.shownAt.keys()])a.has(s)||(this.shownAt.delete(s),this.seenUntil.delete(s));this.alerts=t}alertsOn(){return this.data?.config.alerts.enabled?this.alerts:[]}markSeen(t){this.seenUntil.set(t.id,Date.now()+(this.data?.config.alerts.takeover_timeout_s??120)*1e3),this.requestUpdate()}async loadFrame(){const t=this.data?.config.frame,e=t&&t.enabled&&t.folder?`${t.folder}:${this.data?.version}`:"";if(e!==this.frameListFor){if(this.frameListFor=e,!e){this.photos=[];return}try{this.photos=(await B()).photos,this.order=A(this.photos.length),this.frameIdx=0,this.frameSwitchAt=Date.now()}catch{this.photos=[],this.frameListFor=""}}}frameOn(){const t=this.data;return t?j({enabled:t.config.frame.enabled,photos:this.photos.length,idleMin:t.config.frame.idle_min,lastActivityMs:this.activityAt,nowMs:this.now,asleep:!this.awake(),attention:D(this.alertsOn())}):!1}async refreshStates(t=!1){const e=this.data?.config.state_entities??[],a=Date.now();if(e.length&&(t||a-this.lastStates>3e4)){this.lastStates=a;try{this.states=(await J(e)).states}catch{}}if(t||a-this.lastHealth>6e4){this.lastHealth=a;try{this.healthOk=(await q()).status==="ok"}catch{this.healthOk=null}}}onTick(){if(this.now=Date.now(),this.tick+=1,this.phase!=="ready"||!this.data)return;const t=this.data.config;for(const[a,s]of this.ok){if(s)continue;const n=this.nextTry.get(a)??0;if(this.now>=n){const r=this.tries.get(a)??0;this.epoch.set(a,(this.epoch.get(a)??0)+1),this.tries.set(a,r+1),this.nextTry.set(a,this.now+I[Math.min(r,I.length-1)]*1e3)}}this.refreshStates(),D(this.alertsOn())&&(this.activityAt=this.now),this.resolved.length&&(this.resolved=this.resolved.filter(a=>a.until>this.now)),this.photos.length&&this.frameOn()&&this.now-this.frameSwitchAt>=t.frame.interval_s*1e3&&(this.frameSwitchAt=this.now,this.frameIdx+1>=this.order.length?(this.order=A(this.photos.length,Math.random,this.order[this.order.length-1]),this.frameIdx=0):this.frameIdx+=1),t.schedule.windows.length&&this.emitSleepState(!this.awake())}emitSleepState(t){const e=t?"sleep":"wake";if(e!==this.lastEmit){this.lastEmit=e,document.title=t?"SmplWise Arx - sleep":"SmplWise Arx";try{window.parent.postMessage({type:"arx-wall",state:e},"*")}catch{}}}awake(){return!this.data||this.now<this.wakeUntil||Z(this.alertsOn(),this.data.config.schedule.wake_on_alert_severity)?!0:N(this.data.config.schedule.windows,this.data.zone,new Date(this.now))}onPlayer(t,e){const a=e.detail?.status;a==="playing"?(this.ok.set(t,!0),this.drop.delete(t),this.tries.set(t,0),this.nextTry.delete(t)):(a==="error"||a==="ended")&&(this.ok.get(t)!==!1&&this.drop.set(t,Date.now()),this.ok.set(t,!1)),this.requestUpdate()}clockParts(){const t=this.data?.zone||"Asia/Jerusalem",e=new Date(this.now);try{return{time:new Intl.DateTimeFormat("he-IL",{timeZone:t,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(e),date:new Intl.DateTimeFormat("he-IL",{timeZone:t,weekday:"long",day:"numeric",month:"long"}).format(e)}}catch{return{time:e.toTimeString().slice(0,5),date:""}}}hhmmss(t){return new Date(t).toTimeString().slice(0,8)}render(){if(this.phase==="loading")return i`<div class="center" data-wall-state="loading"><p>טוען…</p></div>`;if(this.phase==="no-connection")return i`<div class="center" data-wall-state="no-connection"><h1>אין חיבור לשרת</h1><p>מנסה שוב אוטומטית</p></div>`;if(this.phase==="removed")return i`<div class="center" data-wall-state="access-removed"><h1>הגישה למסך הזה הוסרה</h1><p>יש להתחבר מחדש עם משתמש מסך קיר</p></div>`;if(this.phase==="remote-refused")return i`<div class="center" data-wall-state="remote-refused"><h1>המסך הזה אינו מורשה להתחבר מרחוק</h1><p>יש להתחבר מהרשת המקומית, או לאפשר גישה מרחוק בהגדרות מסכי קיר</p></div>`;const t=this.data;if(!t)return h;const e=t.config,a=X(this.env.screenWidth,this.env.screenHeight);this.setAttribute("data-wall-theme",e.theme==="light"?"light":"dark");const s=this.clockParts();if(!this.awake()){const[l,g]=[10+this.now/6e4%60*1.3,15+this.now/9e4%60*1.2];return i`<div class="wall sleep" data-wall-state="sleep" style=${`--s:${a};display:block`}><div class="bigclock" style=${`inset-inline-start:${l}%;inset-block-start:${g}%`}>${s.time}</div></div>`}const r=G({layout:e.layout,grid:e.grid,cameras:t.cameras.length,viewportW:this.vw,viewportH:this.vh,showMap:e.show_map,rotateS:e.rotate_s}),p=r.rotateS>0?Math.floor(this.now/(r.rotateS*1e3))%r.pages:0,f=e.burn_in.shuffle_h>0&&t.cameras.length>1&&r.preset!=="single"?Math.floor(this.now/(e.burn_in.shuffle_h*36e5)):0,m=K(t.cameras,p,r.perPage,f),[v,O]=E(this.now,e.burn_in.shift),M=(this.now-this.touchedAt)/6e4,x=e.burn_in.dim_after_min>0&&M>=e.burn_in.dim_after_min,k=V(this.downSince,this.now);if(k==="clock")return i`<div class="wall sleep" data-wall-state="server-offline-clock" style=${`--s:${a};display:block`}><div class="bigclock" style="inset-inline-start:30%;inset-block-start:30%;opacity:.5">${s.time}</div><div class="banner" style="position:absolute;inset-block-end:24px;inset-inline-start:24px">אין חיבור למערכת · מנסה שוב</div></div>`;const u=Y(this.settings),w=Q(this.alertsOn(),this.shownAt,this.seenUntil,this.now,e.alerts.takeover_timeout_s,this.tap),y=w.chips.filter(l=>l.severity!=="info"),$=[...this.resolved.map(l=>i`<span class="chip" data-wall-resolved>${l.text}</span>`),...w.chips.filter(l=>l.severity==="info").map(l=>i`<span class="chip" data-wall-info-chip><i></i>${l.title}${l.place?` · ${l.place}`:""}</span>`),...y.length?[i`<span class="chip" data-tone="danger" data-wall-alert-chip><i></i>התראות · ${y.length}</span>`]:[]];if(this.frameOn()&&this.photos.length)return this.renderFrame(t,s,a,$);const S=$.concat(e.strip.includes("health")?[this.healthChip()]:[]).concat(this.states.map(l=>i`<span class="chip" data-chip=${l.id}>${l.name} <b>${l.state??""}${l.unit?` ${l.unit}`:""}</b></span>`)),U=i`<div class="strip" data-wall-strip>
      <span class="place" data-wall-title>${t.title}</span>
      ${e.strip.includes("clock")?i`<span class="clock" data-wall-clock @pointerdown=${this.pressStart} @pointerup=${this.pressEnd} @pointerleave=${this.pressEnd} @pointercancel=${this.pressEnd}>${s.time}${e.strip.includes("date")&&s.date?i`<span class="date">${s.date}</span>`:h}</span>`:i`<span style="margin-inline:auto"></span>`}
      <span class="chips">${k==="banner"?i`<span class="banner" data-wall-banner>אין חיבור למערכת · מנסה שוב</span>`:S}</span>
    </div>`;return i`<div class=${`wall ${x?"dim":""}`} data-wall-state="base" data-preset=${r.preset} data-wall-class=${b(this.env)} style=${`--s:${a};--cols:${r.cols};--rows:${r.rows};transform:translate(${v}px,${O}px);opacity:${x?e.burn_in.dim_to:1}`}>
      ${U}
      ${m.length||w.tile?i`<div class="grid" data-wall-grid>${w.tile?this.renderAlertTile(w.tile,w.more,e,u):h}${m.slice(w.tile?1:0).map(l=>this.renderTile(l,u,e.offline.show_last_frame_s))}${r.pages>1?i`<div class="dots" data-wall-dots>${Array.from({length:r.pages},(l,g)=>i`<i ?data-on=${g===p}></i>`)}</div>`:h}</div>`:i`<div class="empty" data-wall-state="no-cameras">לא הוגדרו מצלמות למסך הזה</div>`}
      ${r.preset==="tablet-portrait"?i`<div class="band" data-wall-band>${S}</div>`:h}
      ${w.takeover.length?this.renderTakeover(w.takeover,t,s,u):h}
      ${this.panel?this.renderPanel(t):h}
      ${this.chipUpdated?i`<span class="chip updated" data-wall-updated>ההגדרות עודכנו</span>`:h}
    </div>`}ago(t){const e=Math.max(0,Math.round((this.now-new Date(t.first_at).getTime())/6e4)),a=new Date(t.last_at);let s="";try{s=new Intl.DateTimeFormat("he-IL",{timeZone:this.data?.zone||"Asia/Jerusalem",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(a)}catch{s=a.toTimeString().slice(0,5)}return`${e<1?"עכשיו":`${e} דקות`} · ${s}`}alertCamera(t,e,a){const s=t.camera_id?this.data?.cameras.find(n=>n.id===t.camera_id):void 0;return s?i`<sw-camera-tile dark noDemo name=${a??s.name} state="live" live cameraId=${s.id} profile="sub" transport=${e}></sw-camera-tile>`:h}alertButtons(t,e){const a=z(this.holdStart,this.now);return i`<button class="btn" data-wall-seen=${t.id} @click=${()=>this.markSeen(t)}><sw-icon name="eye"></sw-icon><span>ראיתי</span></button>
      ${e?i`<button class="btn" data-hold data-wall-ack=${t.id} style=${`--hold:${a}`} @pointerdown=${()=>this.holdBegin(t)} @pointerup=${this.holdEnd} @pointerleave=${this.holdEnd} @pointercancel=${this.holdEnd}><sw-icon name="check"></sw-icon><span>אישור · החזק</span></button>`:i`<span class="note" data-wall-ack-off><sw-icon name="lock" size="14"></sw-icon> אישור מהמסך הזה לא מופעל</span>`}`}renderAlertTile(t,e,a,s){return i`<div class="atile" data-wall-alert-tile=${t.id} data-severity=${t.severity}>
      <div class="head"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${t.title}${t.place?` · ${t.place}`:""}</b><span class="sub">${this.ago(t)}${t.count>1?` · ×${t.count}`:""}</span></div>
        ${e>0?i`<span class="more" data-wall-alert-more @click=${()=>this.tap++}>+${e}</span>`:h}</div>
      <div class="media">${this.alertCamera(t,s)}</div>
      <div class="foot">${this.alertButtons(t,a.alerts.ack_allowed)}</div>
    </div>`}renderTakeover(t,e,a,s){const n=t[0];return i`<div class="takeover" data-wall-state="takeover" data-wall-takeover=${n.id}>
      <div class="strip"><span class="place"><sw-icon name="warning"></sw-icon> התראה קריטית · ${e.title}</span><span class="clock">${a.time}</span>${t.length>1?i`<span class="chips"><span class="chip" data-tone="danger" data-wall-takeover-count>${t.length} התראות</span></span>`:h}</div>
      <div class="media">${this.alertCamera(n,s)}
        <div class="titles"><span class="icon"><sw-icon name="warning"></sw-icon></span><div><b data-wall-alert-title>${n.title}</b><span class="sub">${n.place?`${n.place} · `:""}${this.ago(n)}</span></div></div>
      </div>
      ${t.length>1?i`<div class="foot" data-wall-takeover-stack>${t.slice(1,4).map(r=>i`<span class="chip" data-tone="danger">${r.title}${r.place?` · ${r.place}`:""}</span>`)}</div>`:h}
      <div class="foot">${this.alertButtons(n,e.config.alerts.ack_allowed)}</div>
    </div>`}renderFrame(t,e,a,s){const n=t.config.frame,[r,p]=E(this.now,t.config.burn_in.shift),f=this.photos[this.order[this.frameIdx]??0]?.id??this.photos[0].id,m=(this.now-this.touchedAt)/6e4,v=t.config.burn_in.dim_after_min>0&&m>=t.config.burn_in.dim_after_min;return i`<div class="frame" data-wall-state="frame" data-motion=${n.motion} style=${`--s:${a};opacity:${v?t.config.burn_in.dim_to:1};transform:translate(${r}px,${p}px)`}>
      <img data-wall-photo=${f} alt="" src=${tt(f)} style=${`object-fit:${n.fit}`} />
      ${s.length?i`<span class="chips" data-wall-frame-chips>${s}</span>`:h}
      ${n.clock?i`<div class="fclock" data-wall-frame-clock><b>${e.time}</b><span>${e.date}${e.date?" · ":""}${t.title}</span></div>`:h}
    </div>`}healthChip(){return this.healthOk===null?i`<span class="chip" data-tone="stale" data-wall-health><i></i>מצב המערכת</span>`:this.healthOk?i`<span class="chip" data-tone="live" data-wall-health><i></i>המערכת תקינה</span>`:i`<span class="chip" data-tone="stale" data-wall-health><i></i>יש תקלות</span>`}renderTile(t,e,a){const s=this.ok.get(t.id),n=this.drop.get(t.id)??null,r=s===!1?et(n,this.now,0,a):"live";return i`<div class="tile" data-wall-tile=${t.id} data-health=${r} @player-status=${p=>this.onPlayer(t.id,p)}>
      ${at(`${t.id}:${this.epoch.get(t.id)??0}`,i`<sw-camera-tile dark noDemo name=${t.name} state=${r==="live"?"live":"stale"} ?live=${r!=="lost"} cameraId=${t.id} profile="sub" transport=${e}></sw-camera-tile>`)}
      ${r==="stale"?i`<span class="badge" data-wall-badge>אין וידאו${n?` · ${this.hhmmss(n)}`:""}</span>`:h}
      ${r==="lost"?i`<div class="lost" data-wall-lost><b>${t.name}</b><span>אין וידאו</span></div>`:h}
    </div>`}renderPanel(t){const e=st.me,a=b(this.env);return i`<div class="panel" data-wall-panel role="status"><dl>
      <dt>משתמש</dt><dd>${e?.user.username??""}</dd>
      <dt>מסך</dt><dd>${t.title}</dd>
      <dt>סוג מכשיר</dt><dd>${a} · ${this.env.screenWidth}x${this.env.screenHeight}</dd>
      <dt>ערוץ</dt><dd>${e?.channel??"local"}</dd>
      <dt>חיבור</dt><dd>${this.downSince?"מנותק":"מחובר"}</dd>
      <dt>גרסת הגדרות</dt><dd>${t.version}</dd>
    </dl></div>`}};o.styles=it`
    :host {
      position: fixed;
      inset: 0;
      display: block;
      direction: rtl;
      background: var(--wall-bg, #05070c);
      color: var(--wall-text, #f3f6fc);
      font-family: var(--sw-font, 'Heebo', 'Segoe UI', sans-serif);
      overflow: hidden;
      --wall-tile: #060912;
      --wall-tile-border: rgba(255, 255, 255, 0.08);
      --wall-strip: rgba(255, 255, 255, 0.06);
      --wall-text-2: rgba(243, 246, 252, 0.72);
    }
    :host([data-wall-theme='light']) {
      --wall-bg: #dfe5f0;
      --wall-text: #1e2e47;
      --wall-text-2: #5b6a85;
      --wall-strip: rgba(255, 255, 255, 0.85);
    }
    :host(:not([data-wall-theme='light'])) {
      --wall-bg: #05070c;
    }
    .wall {
      position: absolute;
      inset: 0;
      display: grid;
      padding: var(--pad);
      gap: var(--gap);
      --pad: calc(14px * var(--s, 1));
      --gap: calc(10px * var(--s, 1));
      --strip-h: calc(56px * var(--s, 1));
      --chip-h: calc(40px * var(--s, 1));
      grid-template-rows: var(--strip-h) minmax(0, 1fr);
      transition: opacity 0.6s;
    }
    .wall[data-preset='tablet-portrait'] {
      grid-template-rows: var(--strip-h) minmax(0, 1fr) auto;
    }
    .wall[data-preset='single'] {
      grid-template-rows: minmax(0, 1fr);
    }
    .wall[data-preset='single'] .strip {
      position: absolute;
      inset: var(--pad) var(--pad) auto;
      z-index: 2;
      background: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
      color: #f3f6fc;
    }
    .strip {
      display: flex;
      align-items: center;
      gap: var(--gap);
      block-size: var(--strip-h);
      padding: 0 calc(var(--pad) * 0.5);
      background: var(--wall-strip);
      border-radius: var(--sw-r-md, 12px);
    }
    :host-context(html[data-skin='bubble']) .strip {
      border-radius: var(--sw-r-pill, 999px);
    }
    .place {
      font-size: calc(17px * var(--s, 1));
      font-weight: 600;
      white-space: nowrap;
    }
    .clock {
      margin-inline: auto;
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-size: calc(30px * var(--s, 1));
      font-weight: 700;
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      user-select: none;
      touch-action: manipulation;
    }
    .clock .date {
      font-size: calc(13px * var(--s, 1));
      font-weight: 400;
      color: var(--wall-text-2);
    }
    .dim .clock {
      -webkit-text-stroke: 1px currentColor;
      color: transparent;
    }
    .chips {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      block-size: var(--chip-h);
      padding: 0 12px;
      border-radius: var(--sw-r-pill, 999px);
      background: rgba(127, 140, 170, 0.18);
      font-size: calc(15px * var(--s, 1));
      white-space: nowrap;
    }
    .chip i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live, #3ddc84);
    }
    .chip[data-tone='stale'] i {
      background: var(--sw-stale, #f5b043);
    }
    .chip[data-tone='danger'] {
      background: rgba(255, 107, 98, 0.2);
      color: #ffb3ad;
    }
    .chip[data-tone='danger'] i {
      background: var(--sw-danger, #ff6b62);
    }
    .grid {
      display: grid;
      gap: var(--gap);
      min-block-size: 0;
      grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
      grid-template-rows: repeat(var(--rows, 2), minmax(0, 1fr));
    }
    .wall[data-preset='tablet-portrait'] .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .tile {
      position: relative;
      background: var(--wall-tile);
      border: 1px solid var(--wall-tile-border);
      border-radius: var(--sw-r-md, 12px);
      overflow: hidden;
      min-block-size: 0;
      direction: ltr;
    }
    .tile sw-camera-tile {
      position: absolute;
      inset: 0;
      display: block;
    }
    .tile[data-health='stale'] sw-camera-tile {
      filter: brightness(0.55) saturate(0.7);
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
    .badge,
    .lost {
      position: absolute;
      z-index: 1;
      font-size: calc(14px * var(--s, 1));
      direction: rtl;
    }
    .badge {
      inset-block-start: 8px;
      inset-inline-start: 8px;
      padding: 4px 10px;
      border-radius: var(--sw-r-pill, 999px);
      background: rgba(245, 176, 67, 0.25);
      color: #ffd08a;
    }
    .lost {
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: 6px;
      font-size: calc(18px * var(--s, 1));
      color: var(--wall-text-2);
    }
    .banner {
      background: rgba(255, 107, 98, 0.2);
      color: #ffb3ad;
      padding: 0 14px;
      border-radius: var(--sw-r-pill, 999px);
      block-size: var(--chip-h);
      display: inline-flex;
      align-items: center;
      font-size: calc(15px * var(--s, 1));
    }
    .band {
      display: flex;
      gap: var(--gap);
      flex-wrap: wrap;
      align-items: center;
      padding: calc(6px * var(--s, 1)) 0;
    }
    .dots {
      position: absolute;
      inset-block-end: calc(6px * var(--s, 1));
      inset-inline: 0;
      display: flex;
      justify-content: center;
      gap: 8px;
      pointer-events: none;
    }
    .dots i {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.35);
    }
    .dots i[data-on] {
      background: #fff;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: 10px;
      padding: 24px;
    }
    .center h1 {
      margin: 0;
      font-size: calc(26px * var(--s, 1));
    }
    .center p {
      margin: 0;
      color: var(--wall-text-2);
      font-size: calc(16px * var(--s, 1));
    }
    .empty {
      display: grid;
      place-content: center;
      text-align: center;
      color: var(--wall-text-2);
      font-size: calc(18px * var(--s, 1));
    }
    .sleep .bigclock {
      position: absolute;
      font-size: calc(64px * var(--s, 1));
      font-weight: 700;
      opacity: 0.2;
      font-variant-numeric: tabular-nums;
      transition: inset 1s;
    }
    .panel {
      position: absolute;
      inset-block-start: calc(var(--pad) + var(--strip-h) + 6px);
      inset-inline-start: 50%;
      transform: translateX(50%);
      z-index: 5;
      min-inline-size: 320px;
      padding: 14px 18px;
      border-radius: var(--sw-r-md, 12px);
      background: rgba(20, 24, 38, 0.96);
      color: #f3f6fc;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
      font-size: calc(15px * var(--s, 1));
    }
    .panel dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 16px;
      margin: 0;
    }
    .panel dt {
      color: rgba(243, 246, 252, 0.7);
    }
    .panel dd {
      margin: 0;
      direction: ltr;
      text-align: end;
    }
    .updated {
      position: absolute;
      inset-block-end: calc(var(--pad) + 4px);
      inset-inline-start: 50%;
      transform: translateX(50%);
      z-index: 4;
    }
    .atile {
      position: relative;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      background: var(--wall-tile);
      border: 2px solid var(--sw-stale, #f5b043);
      border-radius: var(--sw-r-md, 12px);
      overflow: hidden;
      min-block-size: 0;
    }
    .atile .head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: calc(10px * var(--s, 1)) calc(14px * var(--s, 1));
      background: rgba(245, 176, 67, 0.14);
    }
    .atile .head b {
      display: block;
      font-size: calc(22px * var(--s, 1));
    }
    .atile .head span.sub {
      font-size: calc(14px * var(--s, 1));
      color: var(--wall-text-2);
    }
    .atile .icon {
      inline-size: calc(40px * var(--s, 1));
      block-size: calc(40px * var(--s, 1));
      border-radius: 50%;
      display: grid;
      place-content: center;
      background: var(--sw-stale, #f5b043);
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
      gap: 12px;
      padding: calc(10px * var(--s, 1)) calc(14px * var(--s, 1));
    }
    .more {
      margin-inline-start: auto;
      padding: 2px 10px;
      border-radius: var(--sw-r-pill, 999px);
      background: rgba(255, 255, 255, 0.14);
      font-size: calc(14px * var(--s, 1));
      cursor: pointer;
    }
    .btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: calc(44px * var(--s, 1));
      padding: 0 calc(20px * var(--s, 1));
      border: 0;
      border-radius: var(--sw-r-pill, 999px);
      background: rgba(127, 140, 170, 0.28);
      color: inherit;
      font: inherit;
      font-weight: 600;
      font-size: calc(16px * var(--s, 1));
      overflow: hidden;
      touch-action: none;
      user-select: none;
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
      font-size: calc(14px * var(--s, 1));
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
      color: #f3f6fc;
      border: calc(8px * var(--s, 1)) solid var(--sw-danger, #ff6b62);
      animation: pulse 2s ease-in-out 30;
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
      border-radius: var(--sw-r-md, 12px);
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
      inset-block-start: calc(16px * var(--s, 1));
      inset-inline-start: calc(20px * var(--s, 1));
      inset-inline-end: calc(20px * var(--s, 1));
      display: flex;
      gap: 16px;
      align-items: center;
      direction: rtl;
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
    }
    .takeover .titles b {
      display: block;
      font-size: calc(44px * var(--s, 1));
      line-height: 1.1;
    }
    .takeover .titles span.sub {
      font-size: calc(20px * var(--s, 1));
      color: rgba(243, 246, 252, 0.8);
    }
    .takeover .icon {
      inline-size: calc(64px * var(--s, 1));
      block-size: calc(64px * var(--s, 1));
      border-radius: 50%;
      display: grid;
      place-content: center;
      background: var(--sw-danger, #ff6b62);
      color: #fff;
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
    }
    .frame img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      transition: opacity 0.6s;
    }
    .frame[data-motion='slow'] img {
      animation: kb 40s ease-in-out infinite alternate;
    }
    @keyframes kb {
      to {
        transform: scale(1.08);
      }
    }
    .frame .fclock {
      position: absolute;
      inset-block-end: calc(24px * var(--s, 1));
      inset-inline-end: calc(28px * var(--s, 1));
      text-align: end;
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
      color: #fff;
      direction: rtl;
    }
    .frame .fclock b {
      display: block;
      font-size: calc(54px * var(--s, 1));
      font-variant-numeric: tabular-nums;
    }
    .frame .fclock span {
      font-size: calc(16px * var(--s, 1));
      opacity: 0.85;
    }
    .frame .chips {
      position: absolute;
      inset-block-start: calc(16px * var(--s, 1));
      inset-inline-start: calc(16px * var(--s, 1));
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        transition: none !important;
        animation: none !important;
      }
    }
  `;d([c()],o.prototype,"phase",2);d([c()],o.prototype,"data",2);d([c()],o.prototype,"states",2);d([c()],o.prototype,"healthOk",2);d([c()],o.prototype,"now",2);d([c()],o.prototype,"vw",2);d([c()],o.prototype,"vh",2);d([c()],o.prototype,"panel",2);d([c()],o.prototype,"chipUpdated",2);d([c()],o.prototype,"touchedAt",2);d([c()],o.prototype,"wakeUntil",2);d([c()],o.prototype,"tick",2);d([c()],o.prototype,"alerts",2);d([c()],o.prototype,"tap",2);d([c()],o.prototype,"resolved",2);d([c()],o.prototype,"holdStart",2);d([c()],o.prototype,"frameIdx",2);o=d([nt("sw-wall")],o);export{o as SwWall};
//# sourceMappingURL=sw-wall-Cxqst94k.js.map
