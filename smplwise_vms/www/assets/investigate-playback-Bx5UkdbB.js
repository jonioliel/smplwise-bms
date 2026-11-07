import{a as H,S as J,du as K,i as x,sH as W,K as X,qr as Y,sI as D,T as y,sJ as Q,qv as tt,sK as st,j as _,sL as et,A as f,sM as it,e as n,n as at,bP as S,ak as A,sN as R,qy as k,sO as L,qz as rt,eN as nt,C as ot,E as lt,F as z,G as u,H as ht}from"./index-B6b85WR9.js";import{s as ct,c as O}from"./recorders-Q2AcXQn1.js";import"./sw-chip-DGCVAJHD.js";import{s as E,m as M}from"./sw-timeline-DlcAelkJ.js";import"./sw-case-picker-Cv3pBmz8.js";import{l as C,B as q,c as N}from"./cases-DBsEpuha.js";import{i as w,f as dt,d as I,m as g,r as pt,s as ut,c as mt,a as F,b as ft,e as gt,g as wt,h as bt,p as B}from"./recordings-B-DIZFXn.js";import{e as j,c as vt,f as P}from"./exports-mpOQjvYx.js";import{I as yt}from"./investigate-r5-css-DIPtQ0r_.js";import"./sw-logo-art-Va6y_cIM.js";const v={stallS:5,attempts:3,graceMs:2e3,backoffMs:[3e3,6e3],attemptTimeoutMs:2e4,stableMs:3e4,epsilon:.05};function U(s){const t=(e,i,o,r)=>{const a=Number(e);return Number.isFinite(a)?Math.min(r,Math.max(o,Math.round(a))):i};return{stallMs:t(s["playback.stall_s"],v.stallS,2,30)*1e3,maxAttempts:t(s["playback.auto_resume_attempts"],v.attempts,0,5)}}class Z{constructor(t){this.phase="ok",this.attempts=0,this.resumes=0,this.tracks=new Map,this.since=0,this.wait=0,this.pending=!1,this.sentAt=0,this.fault=!1,this.okSince=0,this.o={graceMs:v.graceMs,backoffMs:[...v.backoffMs],attemptTimeoutMs:v.attemptTimeoutMs,stableMs:v.stableMs,epsilon:v.epsilon,...t}}get options(){return this.o}reset(t){this.phase="ok",this.attempts=0,this.resumes=0,this.tracks.clear(),this.pending=!1,this.fault=!1,this.okSince=t}disarm(t,e){const i=this.tracks.get(t);i&&(i.armed=!1,i.at=e)}lost(){this.fault=!0}attemptSent(t){this.phase==="reconnecting"&&(this.pending=!1,this.sentAt=t,this.fault=!1,this.disarmAll(t))}attemptFailed(t){this.phase==="reconnecting"&&this.failAttempt(t)}retry(t){this.attempts=0,this.pending=!1,this.fault=!1,this.phase="stalled",this.since=t,this.wait=0}step(t,e,i){const o=this.o.epsilon;let r=!1,a=!1;const l=new Set;for(const c of e){l.add(c.key);const m=this.tracks.get(c.key);if(!m){this.tracks.set(c.key,{last:c.mediaTime,at:t,armed:!1});continue}if(!i.expect||!c.playing){m.armed=!1,m.last=c.mediaTime,m.at=t;continue}c.mediaTime>m.last+o?(m.armed=!0,m.last=c.mediaTime,m.at=t,r=!0):c.mediaTime<m.last-o?(m.armed=!1,m.last=c.mediaTime,m.at=t):m.armed&&t-m.at>=this.o.stallMs&&(a=!0)}for(const c of[...this.tracks.keys()])l.has(c)||this.tracks.delete(c);const p=this.fault;switch(this.fault=!1,this.phase){case"ok":return i.expect?a||p?(this.phase="stalled",this.since=t,this.wait=this.attempts===0?this.o.graceMs:this.backoff(this.attempts),this.dueAttempt(t,i)):(this.attempts>0&&r&&t-this.okSince>=this.o.stableMs&&(this.attempts=0),"none"):"none";case"stalled":return i.expect?r&&!a&&!p?(this.phase="ok",this.okSince=t,"none"):this.dueAttempt(t,i):(this.phase="ok",this.okSince=t,"none");case"reconnecting":return this.pending?"none":r&&!a?(this.phase="ok",this.resumes+=1,this.okSince=t,"none"):p||t-this.sentAt>=this.o.attemptTimeoutMs?(this.failAttempt(t),this.phase==="stalled"?this.dueAttempt(t,i):"none"):"none";case"gave_up":default:return"none"}}dueAttempt(t,e){return this.attempts>=this.o.maxAttempts?(this.phase="gave_up","none"):t-this.since<this.wait||!e.canAct?"none":(this.phase="reconnecting",this.attempts+=1,this.pending=!0,this.sentAt=t,"resume")}failAttempt(t){if(this.pending=!1,this.attempts>=this.o.maxAttempts){this.phase="gave_up";return}this.phase="stalled",this.since=t,this.wait=this.backoff(this.attempts)}backoff(t){const e=this.o.backoffMs;return e.length?e[Math.min(e.length-1,Math.max(0,t-1))]:0}disarmAll(t){for(const e of this.tracks.values())e.armed=!1,e.at=t}}const G=10;function kt(s,t){const e=Math.floor(t.getTime()/(G*1e3))*G*1e3,i=new Date(e).toISOString().replace(/\.\d{3}Z$/,"Z");return{key:`${s}|${i}`,atIso:i}}const $t=async(s,t)=>{const e=await fetch(s,{credentials:"same-origin",signal:t});return e.ok?{ok:!0,blob:await e.blob(),at:e.headers.get("X-Frame-At")}:{ok:!1,status:e.status}};class xt{constructor(t){this.opts=t,this.cache=new Map,this.noRecording=new Set,this.flights=new Map,this.waiting=null,this.seq=0,this.stats={requests:0,aborted:0,deduped:0},this.state={key:null,url:null,at:null,loading:!1,none:!1},this.maxConcurrent=Math.max(1,t.maxConcurrent??2),this.cacheSize=Math.max(4,t.cacheSize??40),this.makeUrl=t.makeUrl??(e=>URL.createObjectURL(e)),this.revokeUrl=t.revokeUrl??(e=>URL.revokeObjectURL(e))}want(t,e){const i=this.cache.get(t);if(i){this.cache.delete(t),this.cache.set(t,i),this.stats.deduped+=1,this.waiting=null,this.set({key:t,url:i.url,at:i.at,loading:!1,none:!1});return}if(this.noRecording.has(t)){this.stats.deduped+=1,this.waiting=null,this.set({key:t,url:this.state.url,at:this.state.at,loading:!1,none:!0});return}if(this.set({key:t,url:this.state.url,at:this.state.at,loading:!0,none:!1}),this.flights.has(t)){this.stats.deduped+=1,this.waiting=null;return}this.waiting={key:t,url:e},this.pump()}clear(){this.waiting=null;for(const t of this.flights.values())t.ctrl.abort(),this.stats.aborted+=1;this.flights.clear(),this.set({key:null,url:null,at:null,loading:!1,none:!1})}dispose(){this.clear();for(const t of this.cache.values())this.revokeUrl(t.url);this.cache.clear(),this.noRecording.clear()}get inFlight(){return this.flights.size}set(t){this.state=t,this.opts.onChange(t)}pump(){const t=this.waiting;if(!t)return;if(this.flights.size>=this.maxConcurrent){const o=[...this.flights.values()].filter(r=>r.key!==this.state.key).sort((r,a)=>r.started-a.started)[0];if(!o)return;o.ctrl.abort(),this.flights.delete(o.key),this.stats.aborted+=1}this.waiting=null;const e=new AbortController,i={key:t.key,ctrl:e,started:++this.seq};this.flights.set(t.key,i),this.stats.requests+=1,this.opts.fetchFrame(t.url,e.signal).then(o=>this.done(i,o)).catch(()=>this.done(i,null))}done(t,e){if(this.flights.get(t.key)===t&&this.flights.delete(t.key),t.ctrl.signal.aborted){this.pump();return}if(e&&e.ok){const o=this.makeUrl(e.blob);if(this.cache.set(t.key,{url:o,at:e.at}),this.cache.size>this.cacheSize)for(const[r,a]of[...this.cache]){if(this.cache.size<=this.cacheSize)break;a.url!==this.state.url&&(this.cache.delete(r),this.revokeUrl(a.url))}this.state.key===t.key?this.set({key:t.key,url:o,at:e.at,loading:!1,none:!1}):!this.state.url&&this.state.key!==null&&this.set({...this.state,url:o,at:e.at})}else e&&!e.ok&&e.status===404?(this.noRecording.size>500&&this.noRecording.clear(),this.noRecording.add(t.key),this.state.key===t.key&&this.set({...this.state,loading:!1,none:!0})):this.state.key===t.key&&this.set({...this.state,loading:!1});this.pump()}}const St=250,Mt={set:(s,t)=>setTimeout(s,t),clear:s=>clearTimeout(s)};class zt{constructor(t,e={}){this.run=t,this.hasLatest=!1,this.timer=null,this.inflight=!1,this.stats={requested:0,sent:0,coalesced:0},this.delayMs=e.delayMs??St,this.busyRetryMs=e.busyRetryMs??200,this.timers=e.timers??Mt}request(t){this.stats.requested+=1,this.hasLatest&&(this.stats.coalesced+=1),this.latest=t,this.hasLatest=!0,this.arm(this.delayMs)}flush(){this.timer!==null&&(this.timers.clear(this.timer),this.timer=null),this.fire()}cancel(){this.timer!==null&&this.timers.clear(this.timer),this.timer=null,this.hasLatest=!1,this.latest=void 0}get pending(){return this.hasLatest}get inFlight(){return this.inflight}arm(t){this.timer!==null&&this.timers.clear(this.timer),this.timer=this.timers.set(()=>{this.timer=null,this.fire()},t)}fire(){if(!this.hasLatest||this.inflight)return;const t=this.latest;this.hasLatest=!1,this.latest=void 0,this.inflight=!0,this.stats.sent+=1;const e=o=>{if(this.inflight=!1,o==="busy"&&!this.hasLatest){this.latest=t,this.hasLatest=!0,this.arm(this.busyRetryMs);return}this.hasLatest&&this.timer===null&&this.fire()};let i;try{i=this.run(t)}catch{i=Promise.resolve()}i.then(e,()=>e())}}var _t=Object.defineProperty,At=Object.getOwnPropertyDescriptor,d=(s,t,e,i)=>{for(var o=i>1?void 0:i?At(t,e):t,r=s.length-1,a;r>=0;r--)(a=s[r])&&(o=(i?a(t,e,o):a(o))||o);return i&&o&&_t(t,e,o),o};const b=["closed","expired","failed"],It=[4401,4403,4410,4429,"access_lost","remote_live_cap"],Pt=120;function $(s){return E(Math.max(0,Math.min(1439.983,s)))}function T(s){const[t=0,e=0,i=0]=s.split(":").map(Number);return t*60+e+i/60}function Tt(s){const t=s.map(e=>Math.abs(e)).sort((e,i)=>e-i);return t[Math.min(t.length-1,Math.max(0,Math.ceil(.95*t.length)-1))]}let h=class extends H{constructor(){super(...arguments),this.bubbleSkin=new J(this),this.tabsMode=new K(this,"security"),this.cameraId="",this.at="",this.extraParam="",this.fromMap=!1,this.demoCamera="cam-10",this.cursor=615,this.generation=3,this.playing=!0,this.speed=1,this.filter="all",this.cams=null,this.crossSync=!1,this.tz="Asia/Jerusalem",this.date="",this.rec=null,this.dayEvents=[],this.bookmarks=[],this.activeBookmark=null,this.loadingRec=!1,this.session=null,this.group=null,this.extra=[],this.casePick=null,this.preview=null,this.previewTimer=0,this.frames=new xt({fetchFrame:$t,onChange:s=>{this.preview&&(this.preview={...this.preview,frame:s})}}),this.seeker=new zt(async s=>await this.startAt(s)==="skipped"&&this.busy?"busy":"done"),this.busy=!1,this.error="",this.notice="",this.tileStatus={},this.drifts={},this.clock=null,this.barrier="none",this.syncStats=null,this.clockPausedAt=0,this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={},this.groupStartedAt=0,this.lastReport=0,this.seekSentAt={},this.firstPlayAt={},this.startLatency={},this.paused=!1,this.scrubbing=!1,this.position=null,this.exportOpen=!1,this.exportFrom="",this.exportTo="",this.estimate=null,this.exportJob=null,this.exportBusy=!1,this.exportError="",this.stall=new Z(U({})),this.stallPhase="ok",this.stoppedAt=null,this.onTlHover=s=>{if(!this.cameraId||!x())return;window.clearTimeout(this.previewTimer);const t=s.detail;this.preview&&(this.preview={...this.preview,minute:t.minute,x:t.x,width:t.width}),this.previewTimer=window.setTimeout(()=>{const{key:e,atIso:i}=kt(this.cameraId,w(this.date,t.minute,this.tz));this.preview||(this.preview={minute:t.minute,x:t.x,width:t.width,frame:this.frames.state}),this.frames.want(e,dt(this.cameraId,i))},Pt)},this.onTlHoverEnd=()=>{window.clearTimeout(this.previewTimer),this.frames.clear(),this.preview=null}}connectedCallback(){super.connectedCallback(),this.stopDisplay=W(()=>this.requestUpdate()),x()&&(this.init(),this.ticker=window.setInterval(()=>this.tick(),500))}disconnectedCallback(){super.disconnectedCallback(),this.stopDisplay?.(),window.clearInterval(this.ticker),window.clearTimeout(this.previewTimer),this.frames.dispose(),this.endSession()}updated(s){x()&&s.has("cameraId")&&s.get("cameraId")!==void 0&&this.cams&&this.selectCamera(this.cameraId,!0)}get members(){return[this.cameraId,...this.extra.filter(s=>s!==this.cameraId)]}get groupMode(){return this.extra.filter(s=>s!==this.cameraId).length>0}get masterSession(){return this.groupMode?this.group?.sessions.find(s=>s.camera_id===this.cameraId)??this.group?.sessions[0]??null:this.session}get live(){const s=this.masterSession;return!!s&&!b.includes(s.state)&&(this.groupMode?!!this.group:!0)}async init(){try{const[s,t]=await Promise.all([X(),Y()]);this.tz=s["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras.filter(r=>r.enabled&&r.recorder_enabled!==!1),this.crossSync=String(s["playback.cross_recorder_sync"]??"false")==="true",this.stall=new Z(U(s));const e=this.cams.find(r=>r.id===this.cameraId)??this.cams[0],i=this.at?new Date(this.at):null,o=!!i&&!Number.isNaN(i.getTime());if(this.date=I(o?i:new Date,this.tz),e)if(this.cameraId=e.id,this.extraParam&&(this.extra=D(this.extraParam,e.id,this.cams.map(r=>r.id))),await this.loadRecordings(),o)this.cursor=g(i,this.tz),await this.startAt(i);else{const r=this.rec?.segments.at(-1);this.cursor=r?this.insideLast(r):Math.max(0,g(new Date,this.tz)-5)}}catch(s){this.error=y(s)}}async selectCamera(s,t=!1){!s||!t&&s===this.cameraId||(this.clearStall(),await this.endSession(),this.frames.dispose(),this.cameraId=s,this.extra=this.extra.filter(e=>e!==s),this.error="",this.notice="",await this.loadRecordings())}async setDate(s){if(!s||s===this.date)return;this.clearStall(),await this.endSession(),this.date=s,await this.loadRecordings();const t=this.rec?.segments.at(-1);this.cursor=t?this.insideLast(t):540}insideLast(s){const t=g(new Date(s.start_at),this.tz),e=g(new Date(s.end_at),this.tz);return Math.max(0,t,e-5)}async loadRecordings(){if(!(!this.cameraId||!this.date)){this.loadingRec=!0,this.rec=null;try{const[s,t,e]=await Promise.all([pt(this.cameraId,this.date).then(i=>({ok:!0,r:i}),i=>({ok:!1,e:i})),Q(this.cameraId,this.date).catch(()=>({events:[]})),C(this.cameraId,this.date).catch(()=>({bookmarks:[]}))]);if(this.dayEvents=t.events,this.bookmarks=e.bookmarks,this.activeBookmark=null,!s.ok)throw s.e;this.rec=s.r,this.error=""}catch(s){this.error=y(s)}finally{this.loadingRec=!1}}}get markers(){return this.dayEvents.map(s=>({minute:g(new Date(s.occurred_at),this.tz),kind:st(s.type),label:`${tt[s.type]??s.type}${s.confidence==="inferred"?" (מהקלטה)":""}${s.count>1?` ×${s.count}`:""}`}))}get bookmarkMarkers(){return this.bookmarks.map(s=>({id:s.id,minute:g(new Date(s.from_at),this.tz),endMinute:g(new Date(s.to_at),this.tz),label:`תיק „${s.case_title}”${s.note?` · ${s.note}`:""} · ${q[s.preservation]}`,preservation:s.preservation}))}async loadBookmarks(){if(!(!this.cameraId||!this.date))try{this.bookmarks=(await C(this.cameraId,this.date)).bookmarks}catch{}}bookmarkAt(s){this.cameraId&&(this.casePick={kind:"clip",camera_id:this.cameraId,...N(w(this.date,s,this.tz),10,20),note:"סימנייה"})}get segmentsMin(){return this.rec?this.rec.segments.map(s=>{const t=g(new Date(s.start_at),this.tz);let e=g(new Date(s.end_at),this.tz);return e<t&&(e=1440),{startMin:t,endMin:e,kind:s.kind==="continuous"?"continuous":"motion"}}):[]}inRecording(s){return this.segmentsMin.some(t=>s>=t.startMin&&s<=t.endMin)}get limitMinute(){return this.date===I(new Date,this.tz)?g(new Date,this.tz):1440}cameraName(s){return this.cams?.find(t=>t.id===s)?.name??s}async startAt(s,t={}){if(!this.cameraId||this.busy)return"skipped";t.auto||this.clearStall(),this.busy=!0,this.error="",this.notice="",this.scrubbing=!1;try{const e=s.toISOString().replace(/\.\d{3}Z$/,"Z");if(this.groupMode){const i=performance.now(),o=this.group&&this.group.sessions.some(a=>!b.includes(a.state))?await ut(this.group.id,e):await mt(this.members,e);this.group=o;for(const a of o.sessions)this.seekSentAt[a.camera_id]=i,delete this.firstPlayAt[a.camera_id];this.session=null,this.position=new Date(o.requested_at);const r=Object.keys(o.missing);r.length&&(this.notice=`ללא הקלטה בזמן הזה: ${r.map(a=>this.cameraName(a)).join(", ")}`)}else{const i=this.session&&!b.includes(this.session.state)?await F(this.session.id,e):await ft(this.cameraId,e);this.session=i,this.group=null,this.position=new Date(i.requested_at),i.moved_to_next_segment&&(this.notice=`אין הקלטה בזמן שנבחר; הניגון התחיל בקטע הבא (${this.fmt(new Date(i.requested_at))}).`)}return this.cursor=g(this.position,this.tz),this.paused=!1,this.tileStatus={},this.drifts={},this.resetClock(),this.isConnected?"ok":(await this.endSession(),"skipped")}catch(e){if(e instanceof _&&e.body.code==="no_recording")return this.notice="אין הקלטה בזמן הזה ובשש השעות שאחריו: פער בכיסוי, לא מדלגים ל־Live.",this.position=s,"no_recording";if(e instanceof _&&(e.body.code==="seek_rate"||e.body.code==="seek_busy")){this.notice=e.body.user_message||"יותר מדי קפיצות בזמן; המתן מעט ונסה שוב.";const i=this.currentInstant();return i&&(this.cursor=g(i,this.tz)),"error"}else{if(e instanceof _&&(e.body.code==="session_over"||e.body.code==="not_found"))return this.session=null,this.group=null,this.busy=!1,this.startAt(s,t);t.auto||(this.error=y(e))}return"error"}finally{this.busy=!1}}clearStall(){this.stall.reset(performance.now()),this.stallPhase="ok",this.stoppedAt=null}watchStall(){if(this.stallPhase==="gave_up")return;const s=this.groupMode?this.group?.sessions??[]:this.session?[this.session]:[],t=new Set(s.filter(r=>!b.includes(r.state)).map(r=>r.camera_id)),e=this.players().filter(r=>t.has(r.dataset.camera??"")).map(r=>({key:r.dataset.camera??"",mediaTime:r.mediaTime,playing:r.status==="playing"})),i=t.size>0&&!this.paused&&!this.scrubbing,o=this.stall.step(performance.now(),e,{expect:i,canAct:!this.busy});if(this.stall.phase==="gave_up"){this.giveUp();return}this.stallPhase=this.stall.phase,o==="resume"&&this.autoResume()}async autoResume(){const s=this.currentInstant()??this.position;if(!s){this.stall.attemptFailed(performance.now());return}let t=s;const e=this.masterSession?new Date(this.masterSession.playback_end_at).getTime():NaN;Number.isFinite(e)&&e-s.getTime()<3e3&&(t=new Date(e+1e3));const i=await this.startAt(t,{auto:!0});this.stallPhase==="ok"&&this.stall.phase==="ok"||(i==="ok"?this.stall.attemptSent(performance.now()):i==="no_recording"?this.clearStall():this.stall.attemptFailed(performance.now()),this.stall.phase==="gave_up"?this.giveUp():this.stallPhase=this.stall.phase)}async giveUp(){this.stallPhase!=="gave_up"&&(this.stoppedAt=this.currentInstant()??this.position,this.stallPhase="gave_up",await this.endSession())}async retryStalled(){const s=this.stoppedAt??this.position??w(this.date,this.cursor,this.tz);await this.startAt(s)}onTileLost(s,t){if(!(t.status==="error"&&t.code!==void 0&&It.includes(t.code))){if(t.status==="ended"){const e=this.groupMode?this.group?.sessions.find(r=>r.camera_id===s):this.session,i=this.players().find(r=>r.dataset.camera===s);if(!e||!i)return;const o=new Date(e.requested_at).getTime()+i.mediaTime*1e3;if(new Date(e.playback_end_at).getTime()-o<5e3)return}this.stall.lost()}}async endSession(){this.seeker.cancel();const s=this.session,t=this.group;this.session=null,this.group=null,this.tileStatus={},this.drifts={},this.resetClock(),this.stall.reset(performance.now());try{t?await gt(t.id):s&&!b.includes(s.state)&&await wt(s.id)}catch{}}async applyExtra(s){const t=D(s.join(","),this.cameraId,this.cams?.map(i=>i.id)??[]);if(t.join(",")===this.extra.join(","))return;const e=this.currentInstant();this.extra=t,await this.endSession(),e&&await this.startAt(e)}compareItems(){const s=this.cameraId?[this.cameraId]:[];return(this.cams??[]).filter(t=>t.id!==this.cameraId).map(t=>{const e=!this.extra.includes(t.id)&&!ct(s,this.cams??[],t.id,this.crossSync);return{id:t.id,label:O(t),icon:"camera",disabled:e,note:e?"מקליט אחר":void 0}})}renderCompareChips(){const s=this.extra.length>=3;return n`<span>השוואה (עד 4):</span>${this.compareItems().map(t=>{const e=this.extra.includes(t.id),i=t.note??(!e&&s?et(3,1):"");return n`<sw-chip data-compare-chip=${t.id} ?selected=${e} ?disabled=${!e&&(t.disabled||s)} title=${i||f} @click=${()=>void this.applyExtra(it(this.extra,t.id,3).ids)}>${t.label}</sw-chip>`})}`}players(){return Array.from(this.renderRoot.querySelectorAll("sw-live-player"))}masterPlayer(){return this.players().find(s=>s.dataset.camera===this.cameraId)??this.players()[0]}currentInstant(){const s=this.masterSession;if(!s)return this.position;if(this.groupMode&&this.clock)return new Date(this.clockNow());const t=new Date(s.requested_at).getTime();return new Date(t+(this.masterPlayer()?.mediaTime??0)*1e3)}tick(){if(this.watchStall(),!this.masterSession||this.paused||this.scrubbing)return;if(this.groupMode&&this.group){this.tickGroup();return}const t=this.masterPlayer();if(!t||t.status!=="playing")return;const e=this.currentInstant();e&&(this.position=e,this.cursor=g(e,this.tz),t.stale&&t.bufferAhead<.4&&!this.busy&&this.startAt(e))}resetClock(){this.clock=null,this.clockPausedAt=0,this.barrier=this.groupMode?"waiting":"none",this.driftSamples={},this.lateSince={},this.resyncAt={},this.resyncs={},this.nudges={};for(const s of this.players())s.rate=1;this.groupMode&&(this.speed=1),this.syncStats=null,this.groupStartedAt=performance.now(),this.lastReport=0}clockNow(){const s=this.clock;return s.baseMs+((this.paused&&this.clockPausedAt?this.clockPausedAt:performance.now())-s.startedAt)}tickGroup(){const s=this.group,t=performance.now(),e=this.players().map(l=>{const p=l.dataset.camera??"",c=s.sessions.find(m=>m.camera_id===p);return{cid:p,p:l,sess:c,at:c?new Date(c.requested_at).getTime()+l.mediaTime*1e3:NaN}}).filter(l=>l.sess&&!b.includes(l.sess.state)),i=e.filter(l=>l.p.status==="playing");if(!this.clock){const l=e.length>0&&i.length===e.length,p=t-this.groupStartedAt>12e3&&i.length>0;if(!l&&!p){this.barrier="waiting";return}const c=i.find(m=>m.cid===this.cameraId)??i[0];this.clock={baseMs:c.at,startedAt:t},this.barrier="passed",this.driftSamples={},this.lateSince={}}let o=this.clockNow();if(i.length>=3){const l=i.map(p=>p.at).sort((p,c)=>p-c);o=l[Math.floor(l.length/2)]}else i.length&&(o=(i.find(l=>l.cid===this.cameraId)??i[0]).at);this.clock={baseMs:o,startedAt:t};const r=new Date(o);this.position=r,this.cursor=g(r,this.tz);const a={};for(const l of e){if(l.p.status!=="playing"){a[l.cid]=NaN,this.lateSince[l.cid]||(this.lateSince[l.cid]=t);continue}delete this.lateSince[l.cid];const p=(l.at-o)/1e3;a[l.cid]=p;const c=this.driftSamples[l.cid]??=[];if(c.push(p),c.length>40&&c.shift(),c.length>=2&&Math.abs(p)>.25&&Math.abs(p)<=3){const m=p<0?Math.abs(p)>1?1.15:1.05:Math.abs(p)>1?.85:.95;l.p.rate!==m&&(this.nudges[l.cid]=(this.nudges[l.cid]??0)+1),l.p.rate=m}else(Math.abs(p)<=.25||Math.abs(p)>3)&&(l.p.rate=1);l.cid!==this.cameraId&&c.length>=4&&c.slice(-4).every(m=>Math.abs(m)>3)&&(this.resyncs[l.cid]??0)<2&&t-(this.resyncAt[l.cid]??0)>2e4&&this.resyncMember(l.cid,o)}this.drifts=a,this.syncStats=this.computeSync(e.map(l=>l.cid),t),t-this.lastReport>5e3&&this.syncStats.samples>=4&&(this.lastReport=t,bt(s.id,this.syncStats).catch(()=>{}))}computeSync(s,t){const e={};let i=null,o=0;for(const p of s){const c=this.driftSamples[p]??[],m=c.length?Tt(c):null,V=this.lateSince[p]?t-this.lateSince[p]>8e3:!1;e[p]={p95:m,samples:c.length,last:c.length?c[c.length-1]:null,resyncs:this.resyncs[p]??0,state:V?"late":c.length?"measured":"waiting",latency_ms:this.startLatency[p]??null,nudges:this.nudges[p]??0},o+=c.length,m!==null&&(i=i===null?m:Math.max(i,m))}const r=Object.keys(this.group?.missing??{}),a=Object.values(e).some(p=>p.state==="late"),l=this.barrier!=="passed"||i===null?"waiting":i<=.5?"synced":i<=2?"slight":"out_of_sync";return{p95:i,quality:l,samples:o,partial:r.length>0||a,missing:r,members:e}}async resyncMember(s,t){const e=this.group,i=e?.sessions.find(r=>r.camera_id===s);if(!e||!i||b.includes(i.state))return;this.resyncAt[s]=performance.now(),this.resyncs[s]=(this.resyncs[s]??0)+1,this.stall.disarm(s,performance.now()),this.driftSamples[s]=[];const o=Math.min(this.startLatency[s]??4e3,15e3);try{const r=await F(i.id,new Date(t+o).toISOString().replace(/\.\d{3}Z$/,"Z"));this.group===e&&(this.group={...e,sessions:e.sessions.map(a=>a.id===r.id?r:a)}),this.seekSentAt[s]=performance.now(),delete this.firstPlayAt[s]}catch{}}syncLabel(){const s=this.syncStats;if(this.barrier==="waiting"||!s||s.quality==="waiting")return"סנכרון: ממתין לחסם הפתיחה";const t=s.p95===null?"—":`${s.p95.toFixed(2)} ש׳`;return`סנכרון: ${{synced:"מסונכרן",slight:"סטייה קלה",out_of_sync:"לא מסונכרן",waiting:""}[s.quality]} · p95 ${t}${s.partial?" · חלקי":""}`}async onSeek(s){const t=s.detail.minute,e=w(this.date,t,this.tz);if(e.getTime()>Date.now()){this.notice="לא ניתן לנגן זמן עתידי.",this.scrubbing=!1;return}this.cursor=t,s.detail.alt&&this.bookmarkAt(t),this.seeker.request(e)}onScrub(s){this.scrubbing=!0,this.cursor=s.detail.minute,this.position=w(this.date,s.detail.minute,this.tz)}async nudge(s){const t=this.currentInstant();t&&this.seeker.request(new Date(t.getTime()+s*1e3))}setSpeed(s){if(this.groupMode||s>1)return;this.speed=s;const t=this.masterPlayer();t&&(t.rate=s)}stepFrame(s){const t=this.masterPlayer(),e=this.cams?.find(r=>r.id===this.cameraId),i=e?.stream?.fps&&e.stream.fps>0?e.stream.fps:25;if(!t)return;if(!t.stepFrame(s,i)){this.notice="הפריים המבוקש מחוץ למאגר שכבר הגיע מה־NVR — השתמש בקפיצה של 10 שניות או בציר הזמן.";return}this.notice="";const o=this.currentInstant();o&&(this.position=o,this.cursor=g(o,this.tz))}togglePause(){const s=this.players();if(s.length){if(this.paused){const t=this.masterPlayer();if(!this.groupMode&&t?.stale&&this.position){this.startAt(this.position);return}s.forEach(e=>e.resume()),this.clock&&this.clockPausedAt&&(this.clock={...this.clock,startedAt:this.clock.startedAt+(performance.now()-this.clockPausedAt)}),this.clockPausedAt=0}else s.forEach(t=>t.pause()),this.clockPausedAt=performance.now();this.paused=!this.paused}}onTilePlayer(s,t){if(this.tileStatus={...this.tileStatus,[s]:t.detail.status},t.detail.status==="playing"&&this.seekSentAt[s]&&!this.firstPlayAt[s]&&(this.firstPlayAt[s]=performance.now(),this.startLatency[s]=this.firstPlayAt[s]-this.seekSentAt[s]),(t.detail.status==="error"||t.detail.status==="ended")&&this.onTileLost(s,t.detail),s===this.cameraId){if(this.masterSession&&t.detail.status==="playing"&&(this.session&&(this.session={...this.session,state:"playing"}),!this.groupMode&&this.speed!==1)){const e=this.masterPlayer();e&&e.rate!==this.speed&&(e.rate=this.speed)}if(t.detail.status==="ended"){const e=this.currentInstant(),i=this.masterSession;e&&i&&new Date(i.playback_end_at).getTime()-e.getTime()<5e3&&this.startAt(new Date(new Date(i.playback_end_at).getTime()+1e3))}}}fmt(s){return at(s,{timeZone:this.tz,seconds:!0})}openExport(){const s=Math.floor(this.cursor*60)/60;this.exportFrom=$(Math.max(0,s-1)),this.exportTo=$(Math.min(this.limitMinute,s+1)),this.estimate=null,this.exportJob=null,this.exportError="",this.exportOpen=!0}exportRange(){const s=w(this.date,T(this.exportFrom),this.tz),t=w(this.date,T(this.exportTo),this.tz);return t.getTime()<=s.getTime()?(this.exportError="זמן הסיום חייב להיות אחרי ההתחלה.",null):[s.toISOString().replace(/\.\d{3}Z$/,"Z"),t.toISOString().replace(/\.\d{3}Z$/,"Z")]}async runEstimate(){const s=this.exportRange();if(s){this.exportBusy=!0,this.exportError="";try{this.estimate=await j(this.cameraId,s[0],s[1])}catch(t){this.exportError=y(t)}finally{this.exportBusy=!1}}}async runExport(){const s=this.exportRange();if(s){this.exportBusy=!0,this.exportError="";try{const t=this.estimate??await j(this.cameraId,s[0],s[1]);if(this.estimate=t,!t.files){this.exportError="אין קבצים מוקלטים בטווח שנבחר.";return}this.exportJob=await vt(this.cameraId,s[0],s[1])}catch(t){this.exportError=y(t)}finally{this.exportBusy=!1}}}renderExportDialog(){const s=this.estimate,t=this.exportJob;return n`<sw-dialog ?open=${this.exportOpen} heading="ייצוא קטע" subheading=${`${this.cameraName(this.cameraId)} · ${this.date} · ${this.tz}`} @close=${()=>this.exportOpen=!1}>
      <div class="dlg">
        ${t?n`<div class="est"><strong>עבודת הייצוא נוצרה</strong><span>${t.files.length} קבצים · משוער ${P(t.estimate_bytes)} · מצב: ${t.state}</span><span>ה־NVR עדיין מכין את הקובץ; "מעקב והורדה" למטה עובר למסך שבו כפתור ההורדה יופיע ברגע שהוא מוכן.</span></div>`:n`
              <div class="row">
                <sw-field label="מ־"><input type="time" lang=${S()} step="1" data-ltr .value=${this.exportFrom} @change=${e=>{this.exportFrom=e.target.value,this.estimate=null}} /></sw-field>
                <sw-field label="עד"><input type="time" lang=${S()} step="1" data-ltr .value=${this.exportTo} @change=${e=>{this.exportTo=e.target.value,this.estimate=null}} /></sw-field>
              </div>
              ${s?n`<div class="est">
                    <span>${s.files} קבצי NVR בטווח · נפח משוער ${P(s.estimate_bytes)} (מקסימום ${P(s.max_bytes)}) · כיסוי ${s.coverage==="complete"?"מלא":"חלקי"}</span>
                    ${s.first_file_at?n`<span class="ltr">${this.fmt(new Date(s.first_file_at))} → ${this.fmt(new Date(s.last_file_end_at??s.first_file_at))}</span>`:f}
                    <span>${s.note}</span>
                    ${s.ffmpeg?f:n`<span class="warn">ffmpeg לא זמין בשרת: הקובץ יימסר במיכל המקורי (Hikvision PS) ללא חיתוך.</span>`}
                  </div>`:n`<div class="session">הייצוא מוריד את הקבצים המקוריים מה־NVR (לפי קובץ, כך המכשיר תומך) ואז חותך לטווח ב־keyframe. חשב נפח לפני היצירה.</div>`}
            `}
        ${this.exportError?n`<div class="err">${this.exportError}</div>`:f}
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        ${t?n`<sw-button variant="primary" icon="download" @click=${()=>A("/investigate/exports")}>מעקב והורדה</sw-button><sw-button @click=${()=>this.exportOpen=!1}>סגור</sw-button>`:n`<sw-button ?disabled=${this.exportBusy} @click=${()=>this.runEstimate()}>חשב נפח</sw-button>
              <sw-button variant="primary" icon="download" ?disabled=${this.exportBusy} @click=${()=>this.runExport()}>צור ייצוא</sw-button>
              <sw-button variant="ghost" @click=${()=>this.exportOpen=!1}>ביטול</sw-button>`}
      </div>
    </sw-dialog>`}renderStage(s){const t=this.live,e=!t&&!this.inRecording(this.cursor);if(this.groupMode){const o=this.members;return n`<div class="grid ${o.length===1?"one":""}">
        ${o.map(r=>{const a=this.group?.sessions.find(m=>m.camera_id===r),l=this.group?.missing[r],p=this.drifts[r],c=this.tileStatus[r];return n`<div class="tile ${r===this.cameraId?"master":""}">
            ${a&&!b.includes(a.state)?n`<sw-live-player data-camera=${r} .wsUrl=${B(a)} mode="mse" .retry=${!1} recorded compact @player-status=${m=>this.onTilePlayer(r,m)}></sw-live-player>`:this.stallPhase==="gave_up"?f:n`<div class="center"><div><sw-icon name="offline" size=${20}></sw-icon><span>${l==="gap"||l==="no_recording"?"אין הקלטה בזמן הזה":l==="playback_quota"?"מכסת הניגון מלאה":this.busy?"מכין…":this.group?"לא זמין":"לחץ על ציר הזמן"}</span></div></div>`}
            <span class="name" data-tile=${r} data-tile-state=${this.syncStats?.members[r]?.state??""}>${this.cameraName(r)}${r===this.cameraId?n` · מוביל`:f}${a&&c==="playing"&&Number.isFinite(p)?n`<span class="drift ${Math.abs(p)>2?"bad":""}" title="סטייה מהשעון־אב, נמדדת מהפריים המוצג">${p>=0?"+":""}${p.toFixed(1)}s</span>`:f}${this.syncStats?.members[r]?.state==="late"?n`<span class="drift bad">מאחרת</span>`:f}${(this.syncStats?.members[r]?.resyncs??0)>0?n`<span class="drift">סונכרן מחדש ×${this.syncStats.members[r].resyncs}</span>`:f}</span>
          </div>`})}
      </div>`}const i=this.session;return n`<div class="video ${e?"gap":""}">
      ${t&&i?n`<sw-live-player data-camera=${s.id} .wsUrl=${B(i)} mode="mse" .retry=${!1} recorded @player-status=${o=>this.onTilePlayer(s.id,o)}></sw-live-player>`:this.stallPhase==="gave_up"?f:e?n`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${this.notice||"אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live"}</span></div></div>`:n`<div class="center"><div><sw-icon name="play" size=${32}></sw-icon><span>${this.busy?"מכין ניגון…":"לחץ על ציר הזמן (או על נגן) כדי להתחיל מהזמן שנבחר"}</span>${this.busy?f:n`<sw-button variant="primary" size="sm" icon="play" @click=${()=>this.startAt(w(this.date,this.cursor,this.tz))}>נגן מ־${$(this.cursor)}</sw-button>`}</div></div>`}
      <div class="tag"><sw-badge kind=${t?"recorded":"unknown"} ?onImage=${!!t}></sw-badge><span class="nm">${s.name}</span></div>
    </div>`}renderStall(){return this.stallPhase==="ok"?f:this.stallPhase==="gave_up"?n`<div class="stall" data-stall="gave_up" role="status"><div class="box"><span>הניגון נעצר</span><sw-button variant="primary" size="sm" icon="refresh" data-stall-retry ?disabled=${this.busy} @click=${()=>this.retryStalled()}>נסה שוב</sw-button></div></div>`:n`<div class="stall" data-stall=${this.stallPhase} role="status"><div class="box"><span class="spin" aria-hidden="true"></span><span>מתחבר מחדש</span></div></div>`}renderApi(){if(this.error&&!this.cams)return n`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.init()}></sw-state-panel>`;if(!this.cams)return n`<sw-state-panel state="loading"></sw-state-panel>`;if(!this.cams.length)return n`<sw-state-panel icon="history" state="empty" heading="אין מצלמות" hint="סנכרן מצלמות מה־NVR או בקש הרשאת ניגון."></sw-state-panel>`;const s=this.cams.find(a=>a.id===this.cameraId)??this.cams[0],t=this.masterSession,e=this.live,i=t?.time_precision??"unknown",o=this.position??w(this.date,this.cursor,this.tz),r=this.tileStatus[this.cameraId]??"";return n`
      <div class="filters">
        ${this.rec?n`<sw-chip icon="history">${this.rec.segments.length} מקטעים · ${this.rec.matches} קבצים</sw-chip>`:f}
        ${this.dayEvents.length?n`<sw-chip icon="bell" @click=${()=>A("/investigate/events",{camera:this.cameraId,date:this.date})}>${this.dayEvents.length} אירועים${this.dayEvents.every(a=>a.confidence==="inferred")?" (מהקלטות)":""}</sw-chip>`:f}
        ${this.bookmarks.length?n`<sw-chip icon="case" data-bookmarks-count title="סימניות מתיקי חקירה על ציר הזמן · Alt+לחיצה על הציר מוסיפה סימנייה">${this.bookmarks.length} סימניות</sw-chip>`:n`<span class="session" data-bookmarks-hint>אין עדיין סימניות · "הוסף לתיק" מסמן את הרגע הנוכחי, או Alt+לחיצה על הציר מסמנת נקודה אחרת</span>`}
        ${this.activeBookmark?n`<sw-chip selected icon="case" data-bookmark-active @click=${()=>A(`/investigate/cases/${this.activeBookmark.case_id}`)}>תיק „${this.activeBookmark.case_title}”${this.activeBookmark.note?` · ${this.activeBookmark.note}`:""} · ${q[this.activeBookmark.preservation]} · פתח</sw-chip>`:f}
        ${this.rec?.coverage==="partial"?n`<span class="warn">כיסוי חלקי: ${this.rec.note}</span>`:f}
        ${this.loadingRec?n`<span class="session">מחפש הקלטות…</span>`:f}
        ${this.notice?n`<span class="warn">${this.notice}</span>`:f}
        ${this.error?n`<span class="err">${this.error}</span>`:f}
        <span class="grow"></span>
        <sw-button size="sm" icon="case" data-add-to-case title="סימנייה בנקודה הנוכחית · Alt+לחיצה על הציר מסמנת נקודה אחרת" ?disabled=${!this.cameraId} @click=${()=>this.casePick={kind:"clip",camera_id:this.cameraId,...N(w(this.date,this.cursor,this.tz))}}>הוסף לתיק</sw-button>
        <sw-button size="sm" icon="download" ?disabled=${!this.rec?.segments.length} @click=${()=>this.openExport()}>ייצוא</sw-button>
        <a href="#/explore/floors/f0"><sw-button size="sm" icon="map">במפה</sw-button></a>
      </div>
      <div class="compare" data-compare data-picker=${this.tabsMode.ddPicker}>
        ${this.tabsMode.ddPicker==="chips"?this.renderCompareChips():n`<sw-dropdown multiple camera-picker data-compare-pick label="השוואה" icon="grid" placeholder="השוואה (עד 4)" max="3" count-base="1" dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel}
              .items=${this.compareItems()} .values=${this.extra} @change=${a=>void this.applyExtra(a.detail.ids??[])}></sw-dropdown>`}
      </div>
      <div class="stage" data-stall-phase=${this.stallPhase} data-stall-attempts=${this.stall.attempts} data-stall-resumes=${this.stall.resumes}>
        ${this.renderStage(s)}
        ${this.renderStall()}
        <span class="stamp">${this.date} ${this.fmt(o)} · ${{verified:"מאומת",keyframe_limited:"דיוק לפי keyframe",estimated:"משוער",unknown:"—"}[i]}${!this.groupMode&&this.speed!==1?n` · <span data-speed-active=${this.speed}>${this.speed}× הילוך איטי</span>`:f}${this.paused&&!this.groupMode?n` · <span data-paused>מושהה · צעד־פריים</span>`:f}${this.groupMode?n` · <span data-sync-quality=${this.syncStats?.quality??"waiting"} data-sync-p95=${this.syncStats?.p95??""} data-sync-samples=${this.syncStats?.samples??0}>${this.syncLabel()}</span>`:""}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.paused?"play":"pause"} label=${this.paused?"המשך":"השהה"} data-pause ?disabled=${!e||r!=="playing"} @click=${()=>this.togglePause()}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה" ?disabled=${!e||this.busy} @click=${()=>this.nudge(-10)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה" ?disabled=${!e||this.busy} @click=${()=>this.nudge(10)}></sw-button>
          <span class="sep"></span>
          ${[.25,.5,1,2,4].map(a=>{const l=(t?.capabilities.supported_speeds??[1]).includes(a),p=this.masterPlayer()?.transport==="mse",c=a===1||!this.groupMode&&l&&(a>1||p),m=c?a<1?"הילוך איטי: המאגר מתמלא בזמן אמת ונצרך לאט יותר — זמן המקור נשאר מדויק":"":this.groupMode?"בסנכרון רב־מצלמות נתמך רק 1×":a>1?"לא נתמך במסלול הזה: הזרם מגיע מה־NVR בזמן אמת; מהירות מוגברת דורשת מקור ששולח מהר מזמן אמת":"הילוך איטי זמין רק בנתיב MSE";return n`<button class="q ${this.speed===a?"on":""}" data-speed=${a} ?disabled=${!c} title=${m} @click=${()=>this.setSpeed(a)}>${a}×</button>`})}
          <span class="sep"></span>
          <button class="q" data-frame-step="-1" ?disabled=${!e||this.groupMode||!this.paused} title=${this.groupMode?"צעד־פריים זמין במצלמה בודדת":this.paused?"פריים אחד אחורה (בתוך המאגר)":"צעד־פריים זמין בהשהיה"} @click=${()=>this.stepFrame(-1)}>‹ פריים</button>
          <button class="q" data-frame-step="1" ?disabled=${!e||this.groupMode||!this.paused} title=${this.groupMode?"צעד־פריים זמין במצלמה בודדת":this.paused?"פריים אחד קדימה (בתוך המאגר)":"צעד־פריים זמין בהשהיה"} @click=${()=>this.stepFrame(1)}>פריים ‹</button>
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא" ?disabled=${!e} @click=${()=>this.masterPlayer()?.fullscreen()}></sw-button>
        </div></div>
      </div>
      <div class="tlwrap">
        <sw-timeline .segments=${this.segmentsMin} .events=${this.markers} .bookmarks=${this.bookmarkMarkers} .cursor=${this.cursor} .limit=${this.limitMinute} precision=${i} @seek=${this.onSeek} @bookmark-click=${a=>this.activeBookmark=this.bookmarks.find(l=>l.id===a.detail.id)??null} @scrub=${this.onScrub} @hover=${this.onTlHover} @hover-end=${this.onTlHoverEnd}></sw-timeline>
        ${this.preview?n`<div class="tlpreview" data-tl-preview style="left:${Math.max(104,Math.min(this.preview.width-104,this.preview.x))}px">
              ${this.preview.frame.none?n`<div class="none">אין הקלטה בזמן זה</div>`:this.preview.frame.url?n`<img src=${this.preview.frame.url} alt="" class=${this.preview.frame.loading?"stale":""} />`:n`<div class="none">${this.preview.frame.loading?"טוען תמונה…":"אין פריים בזמן זה"}</div>`}
              <span>${E(this.preview.minute)}</span>
            </div>`:f}
      </div>
      <sw-case-picker .item=${this.casePick} subheading=${`${this.cams?.find(a=>a.id===this.cameraId)?.name??""} · ${this.date} ${E(this.cursor)}`} @added=${()=>void this.loadBookmarks()} @close=${()=>this.casePick=null}></sw-case-picker>
      ${R("diagnostics")?n`<div class="session" data-playback-diagnostics>
        <span>Session: ${t?`${t.id} · דור ${this.groupMode?this.group?.generation??t.generation:t.generation} · ${t.state}`:"אין"}</span>
        <span>נגן: ${r||"—"}${this.paused?" (מושהה)":""}</span>
        <span data-stall-diag>חיבור מחדש: ${this.stall.attempts}/${this.stall.options.maxAttempts} · הצליחו ${this.stall.resumes}</span>
        <span>אזור זמן: <span class="ltr">${this.tz}</span></span>
        <span>כיסוי: ${this.rec?this.rec.coverage==="complete"?"מלא":this.rec.coverage==="partial"?"חלקי":"לא ידוע":"—"}</span>
        ${t?n`<span>סוף הטווח: ${this.fmt(new Date(t.playback_end_at))}</span>`:f}
        ${this.groupMode?n`<span data-sync-method>סנכרון: שעון־אב אחד לכל האריחים (חסם פתיחה, ואז חציון זמני הפריימים המוצגים; מתחת לשלושה אריחים — המוביל); הסטייה של כל אריח נמדדת מול השעון, p95 על החלון האחרון; אריח מאחר מסונכרן לבד ואינו מזיז את האחרים (best effort, ללא עוגן זמן מאומת); מהירויות שונות מ־1× כבויות; מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה", לא כמסונכרן</span>`:f}
      </div>`:f}
      ${this.renderExportDialog()}
    `}seekDemo(s){this.cursor=s.detail.minute,this.generation+=1}renderDemo(){const s=k.find(i=>i.id===this.demoCamera)??k[0],t=!L.some(i=>this.cursor>=i.startMin&&this.cursor<=i.endMin),e=rt.filter(i=>i.minuteOfDay<1440).filter(i=>this.filter==="all"||i.type===this.filter).map(i=>({minute:i.minuteOfDay,kind:i.type,label:i.title}));return n`
      <div class="video ${t?"gap":""}">
        ${t?n`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live</span></div></div>`:n`<sw-scene kind=${nt[s.id]??"lobby"}></sw-scene><div class="shade"></div><span class="demo">דמו · אין שרת מחובר</span>`}
        <div class="tag"><sw-badge kind=${t?"unknown":"recorded"} ?onImage=${!t}></sw-badge><span class="nm">${s.name}</span></div>
        <span class="stamp">2026-09-14 ${M(this.cursor)}:00 · actual: ${t?"—":M(this.cursor)}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.playing?"pause":"play"} label=${this.playing?"השהה":"נגן"} @click=${()=>this.playing=!this.playing}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה"></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה"></sw-button>
          <span class="sep"></span>
          ${[1,2,4].map(i=>n`<button class="q ${this.speed===i?"on":""}" @click=${()=>this.speed=i}>${i}×</button>`)}
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="aperture" label="צילום מהקלטה"></sw-button>
          <button class="q on">1080p</button>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא"></sw-button>
        </div></div>
      </div>
      <sw-timeline .segments=${L} .events=${e} .cursor=${this.cursor} precision="estimated" @seek=${this.seekDemo}></sw-timeline>
      <div class="filters">
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"}>הכל</sw-chip>
        <sw-chip dot="var(--sw-tl-motion)" ?selected=${this.filter==="motion"} @click=${()=>this.filter="motion"}>תנועה</sw-chip>
        <sw-chip dot="var(--sw-tl-person)" ?selected=${this.filter==="person"} @click=${()=>this.filter="person"}>אדם</sw-chip>
        <sw-chip dot="var(--sw-tl-vehicle)" ?selected=${this.filter==="vehicle"} @click=${()=>this.filter="vehicle"}>רכב</sw-chip>
        <sw-chip dot="var(--sw-tl-door)" ?selected=${this.filter==="door"} @click=${()=>this.filter="door"}>דלת</sw-chip>
        <span class="grow"></span>
        <sw-button size="sm" icon="case">הוסף לתיק</sw-button>
        <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה בזמן הזה</sw-button></a>
      </div>
      ${R("diagnostics")?n`<div class="session" data-playback-diagnostics>
        <span>Session: ${this.playing?"playing":"paused"} · ${this.speed}×</span>
        <span>דור ${this.generation}</span>
        <span>דיוק זמן: משוער</span>
        <span>כיסוי: ${t?"פער":"מלא"} · 6 מקטעים ביום</span>
        <span>WebRTC → MSE</span>
        ${t?f:n`<span>מצלמה: ${s.name}</span>`}
      </div>`:f}
    `}render(){const s=x(),t=s?this.cams?.find(a=>a.id===this.cameraId):k.find(a=>a.id===this.demoCamera)??k[0],e=t?.name??"הקלטות",i=s?`${this.date} ${$(this.cursor)} · אזור זמן ${this.tz}`:`14.09.2026 ${M(this.cursor)} · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה`,o=s?"הקלטות":`הקלטות | ${t?.floor??""}`,r=s?I(new Date,this.tz):"2026-09-14";return n`
      <sw-page heading=${e} subheading=${i} crumbs=${o} wide>
        ${this.fromMap?n`<sw-button slot="actions" size="sm" variant="ghost" icon="map" data-back-to-map @click=${()=>history.back()}>חזרה למפה</sw-button>`:f}
        <div slot="actions" class="pick">
          ${s?n`<sw-field><select aria-label="מצלמה" @change=${a=>this.selectCamera(a.target.value)}>${(this.cams??[]).map(a=>n`<option value=${a.id} ?selected=${a.id===this.cameraId}>${O(a)}</option>`)}</select></sw-field>`:n`<sw-field><select aria-label="מצלמה" @change=${a=>this.demoCamera=a.target.value}>${k.map(a=>n`<option value=${a.id} ?selected=${a.id===this.demoCamera}>${a.name}</option>`)}</select></sw-field>`}
          <sw-field><input type="date" lang=${S()} .value=${s?this.date:"2026-09-14"} max=${r} data-ltr aria-label="תאריך" @change=${a=>s&&this.setDate(a.target.value)} /></sw-field>
          <sw-field style="inline-size:132px"><input type="time" lang=${S()} step="1" .value=${s?$(this.cursor):M(this.cursor)} data-ltr aria-label="שעה" @change=${a=>{const l=a.target.value;if(s)this.onSeek(new CustomEvent("seek",{detail:{minute:T(l)}}));else{const[p,c]=l.split(":").map(Number);this.cursor=p*60+c,this.generation+=1}}} /></sw-field>
        </div>
        ${s?f:n`<sw-button slot="actions" variant="ghost" iconOnly icon="download" label="ייצוא קטע"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="link" label="שיתוף"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>`}
        ${s?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};h.styles=[lt`
    .pick {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pick sw-field {
      inline-size: 150px;
    }
    /* R5-INVESTIGATE-297: the stage is the hero (shadow 3) */
    .video {
      box-shadow: var(--sw-shadow-3);
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      color: var(--sw-on-video);
      background: var(--sw-video-bg);
      box-shadow: var(--sw-shadow-2);
      /* 0.1.68: the whole page (controls + timeline) fits the window - no scrolling to reach the timeline (owner 3.5) */
      max-block-size: max(200px, calc(100dvh - 560px));
      margin-inline: auto;
      inline-size: 100%;
    }
    .video sw-scene,
    .video sw-live-player {
      position: absolute;
      inset: 0;
    }
    .video.gap {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
    }
    .grid {
      display: grid;
      gap: 6px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-2);
      padding: 6px;
    }
    .grid.one {
      grid-template-columns: 1fr;
    }
    .tile {
      position: relative;
      aspect-ratio: 16 / 9;
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-xs);
      overflow: hidden;
      color: var(--sw-on-video);
    }
    .tile sw-live-player {
      position: absolute;
      inset: 0;
    }
    .tile.master {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .tile .name {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 6px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 2px var(--sw-video-scrim);
      z-index: 2;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .tile .drift {
      font-family: var(--sw-font-mono);
      font-weight: 400;
      direction: ltr;
      background: var(--sw-video-scrim);
      border-radius: var(--sw-r-2xs);
      padding: 0 5px;
    }
    .tile .drift.bad {
      background: color-mix(in srgb, var(--sw-danger) 70%, transparent);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, color-mix(in srgb, var(--sw-video-scrim) 22%, transparent) 0%, transparent 25%, transparent 60%, color-mix(in srgb, var(--sw-video-scrim) 90%, transparent) 100%);
      pointer-events: none;
    }
    .tag {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 10px;
      display: flex;
      gap: 6px;
      align-items: center;
      z-index: 2;
    }
    .tag .nm {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      text-shadow: 0 1px 3px var(--sw-video-scrim);
    }
    .video.gap .tag .nm {
      text-shadow: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: var(--sw-fs-2xs);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-2xs);
      padding: 2px 7px;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 58px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      text-shadow: 0 1px 2px var(--sw-video-scrim);
      z-index: 2;
    }
    .video.gap .stamp {
      text-shadow: none;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
      z-index: 1;
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 6px;
      max-inline-size: 420px;
    }
    .tile .center {
      font-size: var(--sw-fs-xs);
      color: var(--sw-on-video-2);
    }
    .bar {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 10px;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: 3;
    }
    .bar .inner {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-scrim-strong);
      backdrop-filter: var(--sw-perf-blur, blur(8px));
      color: var(--sw-on-video);
      box-shadow: var(--sw-shadow-2);
    }
    .bar sw-button {
      --sw-text-2: var(--sw-on-video);
      --sw-text: var(--sw-on-video);
      --sw-surface-3: var(--sw-video-hover);
    }
    .bar .q {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      border: 1px solid color-mix(in srgb, var(--sw-on-video) 35%, transparent);
      border-radius: var(--sw-r-pill);
      padding: 3px 9px;
      margin-inline: 2px;
      background: transparent;
      color: var(--sw-on-video);
      font-family: inherit;
      cursor: pointer;
    }
    .bar .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .bar .sep {
      inline-size: 1px;
      block-size: 18px;
      background: color-mix(in srgb, var(--sw-on-video) 25%, transparent);
      margin-inline: 4px;
    }
    /* The transport controls are ONE bar under the picture, never over it (owner 2026-10-02: on a phone the floating pill covered
       more than half of the video). Row 1 is the picture (the single video or the comparison grid), the time stamp sits on its
       bottom corner, row 2 is the bar. */
    .stage {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }
    .stage > :not(.bar):not(.stamp) {
      grid-row: 1;
      grid-column: 1;
    }
    .stage .stamp {
      position: static;
      grid-row: 1;
      grid-column: 1;
      align-self: end;
      justify-self: start;
      margin: 0 12px 10px;
      pointer-events: none;
      z-index: 2;
    }
    .stage .bar {
      position: static;
      grid-row: 2;
      grid-column: 1;
      justify-content: stretch;
    }
    .stage .bar .inner {
      inline-size: 100%;
      box-sizing: border-box;
      justify-content: center;
      border-radius: var(--sw-r-md);
      background: var(--sw-video-bg);
      backdrop-filter: none;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .stage .bar sw-button {
      min-inline-size: 44px;
      min-block-size: 44px;
    }
    .stage .bar .q {
      min-block-size: 44px;
      min-inline-size: 44px;
    }
    /* 2.0.0 stall states over the picture (single video or the comparison grid): one short line, white on the video's own dark
       shade in every skin and scheme; never covers the controls bar under the picture. */
    .stage .stall {
      align-self: stretch;
      justify-self: stretch;
      display: grid;
      place-items: center;
      z-index: 4;
      border-radius: var(--sw-r-lg);
      background: color-mix(in srgb, var(--sw-video-bg) 55%, transparent);
      color: var(--sw-on-video);
      min-inline-size: 0;
    }
    .stall .box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px 10px;
      padding: 8px 14px;
      max-inline-size: calc(100% - 16px);
      box-sizing: border-box;
      border-radius: var(--sw-r-pill);
      background: var(--sw-video-scrim-strong);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      text-align: center;
    }
    .stall sw-button {
      min-block-size: 44px;
    }
    .stall .spin {
      inline-size: 16px;
      block-size: 16px;
      border: 2px solid color-mix(in srgb, var(--sw-on-video) 35%, transparent);
      border-block-start-color: var(--sw-on-video);
      border-radius: 50%;
      animation: sw-stall-spin 0.9s linear infinite;
      flex: none;
    }
    @keyframes sw-stall-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .stall .spin {
        animation: none;
      }
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters .grow {
      flex: 1;
    }
    .session {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .warn {
      font-size: var(--sw-fs-xs);
      color: var(--sw-warning-text);
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .tlwrap {
      position: relative;
    }
    /* R5-INVESTIGATE-297: the timeline is the second object of the page (radius lg, shadow 2, a light line); the stage keeps shadow 3 */
    sw-timeline {
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    }
    .filters sw-chip {
      --sw-fs-sm: var(--sw-fs-base);
    }
    .tlpreview {
      position: absolute;
      inset-block-end: calc(100% + 6px);
      transform: translateX(-50%);
      inline-size: 200px;
      /* the hover preview over the timeline is a popover: opaque, never see-through (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 4px;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      text-align: center;
      direction: ltr;
    }
    .tlpreview img {
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
    }
    .tlpreview img.stale {
      /* PLAYBACK-SCRUB-2341: the last good picture while the one under the pointer loads */
      opacity: 0.72;
    }
    .tlpreview .none {
      display: grid;
      place-items: center;
      aspect-ratio: 16 / 9;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      direction: rtl;
    }
    .compare {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    /* 2.0.1: the comparison picker is one dropdown (the chips of 2.0.0 took a row per camera on the phone); it never grows past the row */
    .compare sw-dropdown {
      max-inline-size: 100%;
    }
    .dlg {
      display: grid;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      min-inline-size: min(420px, 80vw);
    }
    .dlg .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .est {
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-md);
      padding: 8px 10px;
      font-size: var(--sw-fs-xs);
      display: grid;
      gap: 4px;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    /* full-system sweep: on a phone the floating control pill (frame step, speeds, skip) was wider than the
       screen and its end buttons were clipped; it wraps now, and speeds the relay refuses anyway (2×/4×) are
       dropped there instead of taking room as disabled buttons. */
    @media (max-width: 767px) {
      .bar .inner {
        flex-wrap: nowrap;
        justify-content: center;
        row-gap: 4px;
        max-inline-size: calc(100% - 16px);
      }
      /* one row: the frame-step buttons only exist while paused */
      .stage .bar .inner {
        flex-wrap: nowrap;
        max-inline-size: none;
        padding-inline: 4px;
      }
      .bar .q[disabled],
      .bar .q[data-frame-step][disabled] {
        display: none;
      }
      .bar .q {
        flex: none;
      }
    }
  `,ot,yt];d([z()],h.prototype,"cameraId",2);d([z()],h.prototype,"at",2);d([z()],h.prototype,"extraParam",2);d([z({type:Boolean})],h.prototype,"fromMap",2);d([u()],h.prototype,"demoCamera",2);d([u()],h.prototype,"cursor",2);d([u()],h.prototype,"generation",2);d([u()],h.prototype,"playing",2);d([u()],h.prototype,"speed",2);d([u()],h.prototype,"filter",2);d([u()],h.prototype,"cams",2);d([u()],h.prototype,"crossSync",2);d([u()],h.prototype,"tz",2);d([u()],h.prototype,"date",2);d([u()],h.prototype,"rec",2);d([u()],h.prototype,"dayEvents",2);d([u()],h.prototype,"bookmarks",2);d([u()],h.prototype,"activeBookmark",2);d([u()],h.prototype,"loadingRec",2);d([u()],h.prototype,"session",2);d([u()],h.prototype,"group",2);d([u()],h.prototype,"extra",2);d([u()],h.prototype,"casePick",2);d([u()],h.prototype,"preview",2);d([u()],h.prototype,"busy",2);d([u()],h.prototype,"error",2);d([u()],h.prototype,"notice",2);d([u()],h.prototype,"tileStatus",2);d([u()],h.prototype,"drifts",2);d([u()],h.prototype,"clock",2);d([u()],h.prototype,"barrier",2);d([u()],h.prototype,"syncStats",2);d([u()],h.prototype,"paused",2);d([u()],h.prototype,"scrubbing",2);d([u()],h.prototype,"position",2);d([u()],h.prototype,"exportOpen",2);d([u()],h.prototype,"exportFrom",2);d([u()],h.prototype,"exportTo",2);d([u()],h.prototype,"estimate",2);d([u()],h.prototype,"exportJob",2);d([u()],h.prototype,"exportBusy",2);d([u()],h.prototype,"exportError",2);d([u()],h.prototype,"stallPhase",2);h=d([ht("investigate-playback")],h);export{h as InvestigatePlayback};
//# sourceMappingURL=investigate-playback-Bx5UkdbB.js.map
