import{bt as Y,bu as J,a as Q,aX as ee,eV as te,a8 as $,A as d,b as n,lH as E,af as _,bO as D,q as v,p as se,eG as ie,e as ae,cX as ne,o as z,ei as W,eU as g,b4 as re,j as oe,z as R,k as w,m as de}from"./index-HK12zoPD.js";import"./sw-table-CLRMzfVb.js";import"./sw-chip-ChHRJG6K.js";import"./sw-chip-choice-CFYtxDWz.js";import{p as le,f as T,E as m,s as ce,t as I,h as N,i as he,l as pe,j as we,k as ue,u as me,S as y,d as fe,W as M}from"./events-Bxj1MECA.js";import{i as C,f as ve,c as $e,a as O,d as b,p as be}from"./recordings-Blf6ggxo.js";import{b as ge}from"./bubble-chrome-5ObbvscE.js";import{s as L,r as ye,d as ke,p as xe,t as _e}from"./event-codes-zdlMZwp3.js";import{I as ze}from"./investigate-r5-css-DUOBX9QV.js";import{b as P}from"./day-key-CpLUamnv.js";import{t as s}from"./investigate-DXEJGN_1.js";import"./sw-logo-art-PLtEZJxU.js";import"./pad-CImDeuHV.js";const X={he:{notConfigured:"לא חובר NVR",rejected:"ה־NVR דחה את פרטי הכניסה",notFound:"ה־NVR לא מגיש את שירות ההתראות",serverError:"ה־NVR החזיר שגיאה",timeout:"ה־NVR לא ענה בזמן",unreachable:"אין חיבור ל־NVR",disconnected:"החיבור נותק",unknown:"סיבה לא ידועה"},en:{notConfigured:"No NVR is connected",rejected:"The NVR rejected the sign-in details",notFound:"The NVR does not serve the alert stream",serverError:"The NVR returned an error",timeout:"The NVR did not answer in time",unreachable:"The NVR cannot be reached",disconnected:"The connection was lost",unknown:"Unknown reason"},ar:{notConfigured:"لم يتم ربط جهاز NVR",rejected:"رفض جهاز NVR بيانات الدخول",notFound:"جهاز NVR لا يوفّر خدمة التنبيهات",serverError:"أعاد جهاز NVR خطأ",timeout:"لم يردّ جهاز NVR في الوقت المناسب",unreachable:"لا يمكن الوصول إلى جهاز NVR",disconnected:"انقطع الاتصال",unknown:"سبب غير معروف"},ru:{notConfigured:"NVR не подключён",rejected:"NVR отклонил данные для входа",notFound:"NVR не предоставляет поток тревог",serverError:"NVR вернул ошибку",timeout:"NVR не ответил вовремя",unreachable:"Нет связи с NVR",disconnected:"Соединение потеряно",unknown:"Причина неизвестна"}};function Te(e){const t=String(e??"").trim();if(!t)return"unknown";if(t==="nvr_not_configured")return"notConfigured";if(t==="disconnected")return"disconnected";const i=/^http_(\d{3})$/.exec(t);if(i){const r=Number(i[1]);return r===401||r===403?"rejected":r===404?"notFound":r>=500?"serverError":"unknown"}return/timeout|timedout/i.test(t)?"timeout":/connect|network|resolve|refused|unreachable|ssl|eof|remoteprotocol|readerror/i.test(t)?"unreachable":"unknown"}function Ie(){return Y(["en","ar","ru"])}function V(e,t=Ie()){return X[t][Te(e)]}J("i18n/ingest-reason",X);function Se(e,t,i){return t.date&&i.day!==t.date||t.cameraId&&e.camera_id!==t.cameraId||t.recorderId&&e.recorder_id!==t.recorderId&&i.cameraRecorder!==t.recorderId||t.type&&e.type!==t.type?"drop":i.known?"update":t.source&&e.source!==t.source||t.filter==="acked"&&!e.acked_at||t.filter==="unacked"&&e.acked_at?"drop":t.placeFloor||t.placeZone||t.q.trim()?"reload":"prepend"}const Re=14,Ee=3e3,De=1500,We=2;function F(e){return Math.min(15e3,3e3*1.35**e)}class Ne{constructor(t){this.o=t,this.timers=new Map,this.asked=new Map,this.flying=new Set,this.gaveUp=new Set,this.set=t.setTimeout??((i,r)=>setTimeout(i,r)),this.clear_=t.clearTimeout??(i=>clearTimeout(i))}want(t){if(this.gaveUp.has(t)||this.timers.has(t)||this.flying.has(t))return;const i=this.asked.get(t)??0;this.schedule(t,i===0?Ee:F(i-1))}cancel(t){const i=this.timers.get(t);i!==void 0&&this.clear_(i),this.timers.delete(t)}prune(t){for(const i of[...this.timers.keys()])t.has(i)||this.cancel(i);for(const i of[...this.asked.keys()])t.has(i)||this.asked.delete(i);for(const i of[...this.gaveUp])t.has(i)||this.gaveUp.delete(i)}stop(){for(const t of this.timers.values())this.clear_(t);this.timers.clear()}requests(t){return this.asked.get(t)??0}schedule(t,i){this.timers.has(t)||this.timers.set(t,this.set(()=>void this.run(t),i))}async run(t){if(this.timers.delete(t),!this.o.alive(t))return;if(this.flying.size>=We){this.schedule(t,De);return}const i=(this.asked.get(t)??0)+1;this.asked.set(t,i),this.flying.add(t);let r;try{r=await this.o.poll(t)}finally{this.flying.delete(t)}if(r==="pending"){i<Re?this.schedule(t,F(i-1)):this.gaveUp.add(t);return}this.o.done(t,r)}}function Me(e){return e==="critical"?"error":e==="alert"?"stale":"neutral"}const S=500;function Ce(e,t,i){const r=Math.max(1,Math.floor(t)),p=C(P(e,-(r-1)),0,i),o=new Date(C(P(e,1),0,i).getTime()-1);return{from:p.toISOString(),to:o.toISOString()}}var Oe=Object.defineProperty,Le=Object.getOwnPropertyDescriptor,h=(e,t,i,r)=>{for(var p=r>1?void 0:r?Le(t,i):t,o=e.length-1,a;o>=0;o--)(a=e[o])&&(p=(r?a(t,i,p):a(p))||p);return r&&p&&Oe(t,i,p),p};const q="(max-width: 767px)",A="(min-width: 1280px)",j="font-weight:var(--sw-fw-semibold);font-size:var(--sw-fs-md);color:var(--sw-heading);display:inline-flex;align-items:center;gap:7px",f="color:var(--sw-text-3);font-size:var(--sw-fs-xs);line-height:1.4",B="font-weight:var(--sw-fw-semibold);font-size:var(--sw-fs-md);font-variant-numeric:tabular-nums;color:var(--sw-heading)",U="inline-size:8px;block-size:8px;border-radius:50%;flex:none;background:",Pe="display:inline-flex;align-items:center;gap:4px;color:var(--sw-accent-text);font-size:var(--sw-fs-xs);font-weight:var(--sw-fw-semibold)",Z="inline-size:88px;block-size:56px;border-radius:8px;display:block;background:var(--sw-surface-3)",H={alertstream:s("התראה מהמקליט"),recording:s("נגזר מקובץ הקלטה"),ha:s("חיישן התקן"),system:s("מערכת")},K={HA:s("מערכת הבית"),NVR:s("מקליט")},Ve={person:"var(--sw-tl-person)",vehicle:"var(--sw-tl-vehicle)",motion:"var(--sw-tl-motion)",line:"var(--sw-tl-line)",offline:"var(--sw-tl-offline)",door:"var(--sw-tl-door)"},G={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking","מסדרון מזרחי":"corridor"},Fe={info:s("מידע"),alert:s("התראה"),critical:s("קריטי")};function k(e,t=!1){return n`<sw-badge ?filled=${t||e!=="info"} kind=${Me(e)} label=${Fe[e]??e}></sw-badge>`}let c=class extends Q{constructor(){super(...arguments),this.bubbleSkin=new ee(this),this.cameraId="",this.date="",this.initialMode="",this.selected=null,this.filter="all",this.cams=null,this.tz="Asia/Jerusalem",this.type="",this.events=null,this.ingest=null,this.live=!1,this.error="",this.busy=!1,this.thumbVersion=new Map,this.player=null,this.mode="raw",this.windows=null,this.windowGap=180,this.windowBy="camera",this.selectedWindow=null,this.windowsBusy=!1,this.spotlightOnly=!1,this.spotlightCount=0,this.showRaw=!1,this.ticked=new Set,this.facets=null,this.placeFloor="",this.placeZone="",this.source="",this.recorderId="",this.recorders=[],this.unsupported=[],this.q="",this.rangeDays=1,this.narrow=typeof window<"u"&&window.matchMedia(q).matches,this.dock=typeof window<"u"&&window.matchMedia(A).matches,this.now=Date.now(),this.techOpen=!1,this.clock=0,this.qTimer=0,this.reads=new te,this.loadedFor=null,this.pushReloadTimer=0,this.thumbs=new Ne({poll:e=>le(e),alive:e=>this.isConnected&&!!this.events?.some(t=>t.id===e),done:(e,t)=>this.setThumb(e,t),setTimeout:(e,t)=>window.setTimeout(e,t),clearTimeout:e=>window.clearTimeout(e)}),this.thumbWanted=new Set,this.onMedia=()=>{this.narrow=!!this.mqNarrow?.matches,this.dock=!!this.mqDock?.matches},this.onKey=e=>{const t=e.composedPath(),i=(e.key==="ArrowDown"||e.key==="ArrowUp")&&t.some(a=>a instanceof HTMLElement&&a.tagName==="SW-TABLE");if(this.narrow||e.altKey||e.ctrlKey||e.metaKey||e.defaultPrevented&&!i)return;const r=this.mode==="windows",p=r?this.selectedWindow:this.selected;if(!(!p||t.some(a=>a instanceof HTMLElement&&(a.tagName==="INPUT"||a.tagName==="SELECT"||a.tagName==="TEXTAREA"||a.isContentEditable)))){if(e.key==="Escape"){e.preventDefault(),r?this.closeWindowDrawer():this.closeDrawer();return}if(e.key==="ArrowDown"||e.key==="ArrowUp"){const a=r?(this.windows??[]).map(x=>x.id):(this.events??[]).map(x=>x.id),l=a.indexOf(p),u=a[e.key==="ArrowDown"?l+1:l-1];if(l<0||!u)return;e.preventDefault(),r?(this.selectedWindow=u,this.showRaw=!1,this.ticked=new Set):this.select(u),this.revealRow(u);return}if(e.key==="Enter"){if(t.some(a=>a instanceof HTMLElement&&(a.tagName==="BUTTON"||a.tagName==="A"||a.tagName==="SW-BUTTON"||a.tagName==="SUMMARY")))return;if(e.preventDefault(),r){const a=this.windows?.find(l=>l.id===p);a&&$(`/investigate/events/${a.first_event_id}`)}else $(`/investigate/events/${p}`)}}},this.rowPreview=null,this.rowPreviewTimer=0,this.windowColumns=[{key:"thumb",label:"",width:"104px",render:e=>this.renderWindowThumb(e)},{key:"title",label:s("חלון אירוע"),render:e=>{const t=e;return n`<span style=${j}><i style=${`${U}${T[t.dominant_type]??"var(--sw-tl-offline)"}`}></i>${m[t.dominant_type]??t.dominant_type}${t.count>1?n`<span style=${f}>×${String(t.count)}</span>`:d}</span><div style=${f}>${Object.entries(t.types).map(([i,r])=>`${m[i]??i} ${r}`).join(" · ")} · ${t.confidence==="inferred"?s("נגזר מהקלטה"):s("התראות מהמקליט")}</div>`}},{key:"spotlight",label:s("זרקור"),width:"150px",render:e=>{const t=e,i=t.spotlight;return i?.on?n`<span style=${Pe} data-window-spotlight title=${i.rules.map(r=>r.why).join(" · ")}><sw-icon name="target" size=${12}></sw-icon>${i.rules.map(r=>r.label).join(" · ")}</span>`:t.manual_group_id?n`<span style=${f} data-window-manual>${s("קיבוץ ידני")}</span>`:d}},{key:"camera_name",label:s("מצלמה / קבוצה"),render:e=>{const t=e;return n`${t.camera_name??(t.channel?s("ערוץ {n}",{n:t.channel}):s("מערכת"))}${t.group&&t.group!=="camera"&&t.group!=="manual"&&t.camera_names?.length?n`<div style=${f}>${t.camera_names.join(" · ")}</div>`:d}`}},{key:"start",label:s("זמן"),render:e=>{const t=e;return n`<span style=${B}>${this.fmt(t.start)}${t.end!==t.start?n` – ${this.fmt(t.end)}`:d}</span><div style=${f}>${this.fmtDate(t.start)}</div>`}},{key:"acked",label:s("מצב"),render:e=>{const t=e;return n`<sw-badge kind=${t.acked?"live":t.acked_count?"stale":"neutral"} label=${t.acked?s("טופל"):t.acked_count?s("בטיפול {n}/{total}",{n:t.acked_count,total:t.count}):s("חדש")}></sw-badge>`}}],this.apiColumns=[{key:"thumb",label:"",width:"80px",render:e=>this.renderThumb(e)},{key:"type",label:s("אירוע"),render:e=>{const t=e;return n`<span style=${j} title=${s("קוד המכשיר: {code}",{code:t.raw_type})} data-raw-type=${t.raw_type}><i style=${`${U}${T[t.type]??"var(--sw-tl-offline)"}`}></i>${this.kindLabel(t)}${t.count>1?n`<span style=${f}>×${t.count}</span>`:d}</span><div style=${f}>${H[t.source]??t.source}${t.confidence==="inferred"&&t.source!=="recording"?` · ${s("נגזר")}`:""}</div>`}},{key:"camera_name",label:s("מצלמה"),render:e=>{const t=e;return n`<span style="color:var(--sw-text)">${this.camLabel(t)}</span>${t.camera_name&&t.channel?n`<div style=${f}>${s("ערוץ {n}",{n:t.channel})}</div>`:d}`}},{key:"occurred_at",label:s("זמן"),width:"190px",render:e=>{const t=e,i=L(t.occurred_at,t.ended_at);return n`<span style=${B}>${this.fmt(t.occurred_at)}</span><div style=${f}>${this.ago(t.occurred_at)} · ${this.fmtDate(t.occurred_at)}${i?` · ${i}`:""}</div>`}},{key:"severity",label:s("חומרה"),width:"96px",render:e=>k(String(e.severity))},{key:"acked_at",label:s("טיפול"),width:"140px",render:e=>{const t=e;return t.acked_at?n`<span style="color:var(--sw-text-2)">${s("טופל")}</span><div style=${f}>${t.acked_by_username??""}${t.acked_by_username?" · ":""}${this.fmt(t.acked_at)}</div>`:n`<span style="color:var(--sw-warning-text);font-weight:var(--sw-fw-semibold)" data-pending>${s("ממתין")}</span>`}}],this.columns=[{key:"thumb",label:"",width:"104px",render:e=>e.type==="offline"||e.type==="door"?n`<div class="thumb none" style="inline-size:88px;block-size:56px;border-radius:8px;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)"><sw-icon name=${e.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:n`<sw-scene class="thumb" style="display:block;inline-size:88px;block-size:56px;border-radius:8px;overflow:hidden;box-shadow:var(--sw-shadow-thumb)" kind=${G[String(e.camera)]??"lobby"}></sw-scene>`},{key:"title",label:s("אירוע"),render:e=>n`<span class="ty" style="--tone:${Ve[e.type]}"><i></i>${E[e.type]}</span><div class="sub">${String(e.title)} · ${e.acked?s("טופל"):n`<span style="color:var(--sw-warning-text);font-weight:var(--sw-fw-semibold)">${s("ממתין לטיפול")}</span>`}</div>`},{key:"camera",label:s("מצלמה"),render:e=>n`${String(e.camera)}<div class="sub">${String(e.floor)}</div>`},{key:"time",label:s("זמן"),render:e=>n`<span style="font-weight:700;font-size:var(--sw-fs-md);font-variant-numeric:tabular-nums;color:var(--sw-heading)">${String(e.time)}</span><div class="sub">${K[String(e.source)]??String(e.source)}</div>`},{key:"severity",label:s("חומרה"),render:e=>k(String(e.severity),!0)},{key:"more",label:"",width:"40px",render:()=>n`<sw-button variant="ghost" size="sm" iconOnly icon="more" label=${s("עוד")}></sw-button>`}]}connectedCallback(){super.connectedCallback(),this.mqNarrow=window.matchMedia(q),this.mqDock=window.matchMedia(A),this.mqNarrow.addEventListener("change",this.onMedia),this.mqDock.addEventListener("change",this.onMedia),this.onMedia(),window.addEventListener("keydown",this.onKey),this.clock=window.setInterval(()=>{this.now=Date.now(),this.renderRoot.querySelector(".stage sw-table")?.requestUpdate?.()},3e4);try{this.techOpen=localStorage.getItem("sw.events.tech")==="1"}catch{}_()&&(this.init(),this.unsubscribe=ce(e=>this.onPushed(e),(e,t)=>{this.live=t,e&&(this.ingest=e)}))}disconnectedCallback(){super.disconnectedCallback(),this.mqNarrow?.removeEventListener("change",this.onMedia),this.mqDock?.removeEventListener("change",this.onMedia),window.removeEventListener("keydown",this.onKey),window.clearInterval(this.clock),this.unsubscribe?.(),this.thumbs.stop(),this.thumbWanted.clear(),window.clearTimeout(this.qTimer),window.clearTimeout(this.rowPreviewTimer),window.clearTimeout(this.pushReloadTimer),this.reads.cancel(),this.stopPlayer()}willUpdate(e){!(e.has("cameraId")||e.has("date"))||!this.loadedFor||!_()||(this.loadedFor.cameraId!==this.cameraId||this.loadedFor.date!==this.date)&&this.load()}onRowSelect(e){const t=this.mode==="windows";if(e.key==="Enter"&&!this.narrow&&e.id===(t?this.selectedWindow:this.selected)){const i=t?this.windows?.find(r=>r.id===e.id)?.first_event_id:e.id;i&&$(`/investigate/events/${i}`);return}t?this.selectedWindow=e.id:this.select(e.id)}async revealRow(e){await this.updateComplete;const t=this.renderRoot.querySelector(".stage sw-table");await t?.updateComplete;const i=t?.shadowRoot?.querySelector(`tr[data-row-id="${CSS.escape(e)}"]`);i&&(i.style.scrollMarginBlock="48px 12px",i.scrollIntoView({block:"nearest"}),t?.shadowRoot?.activeElement?.matches("tr[data-row-id]")&&i.focus({preventScroll:!0}))}closeWindowDrawer(){this.selectedWindow=null,this.showRaw=!1,this.ticked=new Set}ago(e){const t=this.now-new Date(e).getTime();if(!Number.isFinite(t))return"";if(t<6e4)return s("עכשיו");const i=Math.floor(t/6e4);if(i<60)return s("לפני {n} דק׳",{n:i});const r=Math.floor(i/60);if(r<24)return s("לפני {n} שע׳",{n:r});const p=Math.floor(r/24);return p===1?s("אתמול"):s("לפני {n} ימים",{n:p})}kindLabel(e){return ye(e.raw_type)??m[e.type]??e.type}camLabel(e){return e.camera_name??(e.channel?s("ערוץ {n}",{n:e.channel}):s("מערכת"))}hoverStart(e,t){if(!e.camera_id||t.pointerType==="touch")return;window.clearTimeout(this.rowPreviewTimer);const i=t.clientX,r=t.clientY;this.rowPreviewTimer=window.setTimeout(()=>{const p=new Date(e.occurred_at).getTime(),o=[-5,0,5].map(a=>{const l=D(p+a*1e3);return{at:l,url:ve(e.camera_id,l),label:a===0?this.fmt(e.occurred_at):s("{n} ש׳",{n:`${a>0?"+":""}${a}`}),failed:!1}});this.rowPreview={id:e.id,x:i,y:r,frames:o,camera:e.camera_name??""}},250)}hoverEnd(){window.clearTimeout(this.rowPreviewTimer),this.rowPreview=null}renderRowPreview(){const e=this.rowPreview;if(!e)return d;const t=Math.max(16,Math.min(window.innerWidth-388,e.x-186)),i=e.y+18+230>window.innerHeight?e.y-18-230:e.y+18;return n`<div class="rowpreview" data-row-preview style="left:${t}px;top:${i}px">
      <div class="strip">
        ${e.frames.map((r,p)=>n`<div class="cell ${p===1?"main":""}">
          ${r.failed?n`<span>${s("אין פריים")}</span>`:n`<img src=${r.url} alt="" @error=${()=>{r.failed=!0,this.rowPreview={...e}}} />`}
          <span class="t">${r.label}</span>
        </div>`)}
      </div>
      <div class="cap"><span>${e.camera}</span><span>${s("פריימים מההקלטה · 5 שניות לפני ואחרי")}</span></div>
    </div>`}renderThumb(e){const t="inline-size:64px;block-size:40px;border-radius:6px;overflow:hidden;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)";return e.thumbnail==="ready"?n`<img class="thumb" src=${I(e.id,this.thumbVersion.get(e.id)??0)} alt="" loading="lazy" data-thumb=${e.id} style="inline-size:64px;block-size:40px;object-fit:cover;border-radius:6px;display:block;background:var(--sw-surface-3);cursor:zoom-in" />`:(e.thumbnail==="pending"||e.thumbnail==="none")&&e.camera_id?(this.wantThumb(e.id),n`<div class="thumb pending" style=${t} title=${s("מכין תמונה מההקלטה…")}><sw-icon name="camera" size=${14} style="opacity:.45"></sw-icon></div>`):n`<div class="thumb none" style=${t}><sw-icon name=${e.type==="offline"||e.type==="coverage_gap"?"offline":e.type==="person"?"user":e.type==="vehicle"?"route":e.type==="door"||e.type==="io"?"door":"bell"} size=${14}></sw-icon></div>`}async ackAll(){const e=(this.events??[]).filter(t=>!t.acked_at).map(t=>t.id);if(!(!e.length||this.busy)){this.busy=!0;try{for(let t=0;t<e.length;t+=500)await N(e.slice(t,t+500));await this.load()}catch(t){this.error=v(t)}finally{this.busy=!1}}}wantThumb(e){this.thumbWanted.size||queueMicrotask(()=>{const t=[...this.thumbWanted];if(this.thumbWanted.clear(),this.isConnected)for(const i of t)this.thumbs.want(i)}),this.thumbWanted.add(e)}setThumb(e,t){t==="ready"&&(this.thumbVersion=new Map(this.thumbVersion).set(e,Date.now())),this.events=(this.events??[]).map(i=>i.id===e?{...i,thumbnail:t}:i)}select(e){e!==this.player?.eventId&&this.stopPlayer(),this.selected=e}closeDrawer(){this.select(null)}async play(e){if(this.player?.eventId===e.id){await this.stopPlayer();return}if(await this.stopPlayer(),!!e.camera_id){this.player={eventId:e.id,session:null,error:""};try{const t=D(new Date(e.occurred_at).getTime()-2e3),i=await $e(e.camera_id,t);this.player?.eventId===e.id?this.player={eventId:e.id,session:i,error:""}:await O(i.id).catch(()=>{})}catch(t){this.player={eventId:e.id,session:null,error:v(t)}}}}async stopPlayer(){const e=this.player;this.player=null,e?.session&&await O(e.session.id).catch(()=>{})}async init(){try{try{localStorage.getItem("sw.events.mode")==="windows"&&(this.mode="windows")}catch{}(this.initialMode==="windows"||this.initialMode==="raw")&&(this.mode=this.initialMode);const[e,t]=await Promise.all([se(),ie()]);this.tz=e["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras,this.recorders=t.recorders??[],this.loadFacets(),this.date||(this.date=b(new Date,this.tz)),await this.load()}catch(e){this.error=v(e)}}async loadFacets(){try{this.facets=await he()}catch{this.facets=null}}get facetFloors(){const e=this.facets;return e?e.places.flatMap(t=>t.buildings.flatMap(i=>i.floors.map(r=>({...r,name:`${i.name} · ${r.name}`})))):[]}searchWindow(){return this.rangeDays<=1?{date:this.date||void 0}:Ce(this.date||b(new Date,this.tz),this.rangeDays,this.tz)}async load(){const e=this.reads.begin();this.loadedFor={cameraId:this.cameraId,date:this.date},window.clearTimeout(this.pushReloadTimer);try{const t=await pe({...this.searchWindow(),cameraId:this.cameraId||void 0,type:this.type||void 0,unacked:this.filter==="unacked",acked:this.filter==="acked",limit:S,floorId:this.placeFloor||void 0,zoneId:this.placeZone||void 0,source:this.source||void 0,query:this.q.trim()||void 0,recorderId:this.recorderId||void 0});if(!e())return;this.events=t.events,this.thumbs.prune(new Set(t.events.map(i=>i.id))),this.unsupported=t.filters?.unsupported??[],this.ingest=t.ingest,this.error="",this.mode==="windows"&&await this.loadWindows()}catch(t){if(!e())return;this.error=v(t)}}onSearchInput(e){this.q=e,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>void this.load(),350)}setRange(e){this.rangeDays=e,this.load()}async loadWindows(){this.windowsBusy=!0;try{const e=await we({date:this.date||void 0,cameraId:this.cameraId||void 0,gap:this.windowGap,by:this.windowBy,limit:300,spotlight:this.spotlightOnly});this.windows=e.windows,this.spotlightCount=e.spotlights??e.windows.filter(t=>t.spotlight?.on).length,this.selectedWindow&&!e.windows.some(t=>t.id===this.selectedWindow)&&(this.selectedWindow=null)}catch(e){this.error=v(e),this.windows=[]}finally{this.windowsBusy=!1}}setMode(e){this.mode=e,this.select(null),this.selectedWindow=null;try{localStorage.setItem("sw.events.mode",e)}catch{}e==="windows"&&this.windows===null&&this.loadWindows()}async ackWindow(e){this.busy=!0;try{const t=await N(e.event_ids),i=new Set(t.acked);this.events=(this.events??[]).map(r=>i.has(r.id)&&!r.acked_at?{...r,acked_at:new Date().toISOString(),acked_by_username:s("אני")}:r),await this.loadWindows()}catch(t){this.error=v(t)}finally{this.busy=!1}}windowTitle(e){const t=e.camera_name??(e.channel?s("ערוץ {n}",{n:e.channel}):s("מערכת"));return`${m[e.dominant_type]??e.dominant_type} · ${t}`}neighbourWindow(e,t){const i=this.windows??[],r=i.findIndex(o=>o.id===e.id);if(r<0)return null;const p=o=>!o.manual_group_id&&!e.manual_group_id&&o.camera_id===e.camera_id&&o.group_label===e.group_label&&o.group===e.group;for(let o=t==="older"?r+1:r-1;o>=0&&o<i.length;o+=t==="older"?1:-1)if(p(i[o]))return i[o];return null}async regroup(e,t){this.busy=!0;try{await ue(e,t),this.ticked=new Set,this.selectedWindow=null,this.showRaw=!1,await this.loadWindows()}catch(i){this.error=v(i)}finally{this.busy=!1}}async dissolve(e){if(e.manual_group_id){this.busy=!0;try{await me(e.manual_group_id),this.selectedWindow=null,this.showRaw=!1,await this.loadWindows()}catch(t){this.error=v(t)}finally{this.busy=!1}}}tick(e,t){const i=new Set(this.ticked);t?i.add(e):i.delete(e),this.ticked=i}renderWindowThumb(e){return e.thumbnail==="ready"?n`<img class="thumb" src=${I(e.thumbnail_event_id,this.thumbVersion.get(e.thumbnail_event_id)??0)} alt="" loading="lazy" style=${`${Z};object-fit:cover`} />`:n`<div style=${`${Z};display:grid;place-items:center;color:var(--sw-text-3)`}><sw-icon name=${e.camera_id?"image":"info"} size=${14}></sw-icon></div>`}renderWindowDrawer(e){const t=(this.events??[]).filter(l=>e.event_ids.includes(l.id)),i=e.spotlight,r=[...this.ticked].filter(l=>e.event_ids.includes(l)),p=this.neighbourWindow(e,"older"),o=this.neighbourWindow(e,"newer"),a=e.camera_names?.length?e.camera_names.join(" · "):e.camera_name??"";return n`<sw-drawer open class="evdrawer" ?modal=${this.narrow} heading=${this.windowTitle(e)} subheading=${`${this.fmtDate(e.start)} · ${this.fmt(e.start)} – ${this.fmt(e.end)} · ${s("{n} אירועים",{n:e.count})}`} @close=${()=>this.closeWindowDrawer()}>
      <div class="wsum" data-window-summary>
        ${k(e.severity)}
        <sw-badge kind=${e.confidence==="measured"?"recorded":"unknown"} label=${e.confidence==="measured"?s("נמדד"):s("נגזר מהקלטה")}></sw-badge>
        ${i?.sources?.length?n`<span class="sub">${i.sources.map(l=>y[l]??l).join(" · ")}</span>`:d}
        ${a?n`<span class="sub">${a}</span>`:d}
        ${e.manual_group_id?n`<sw-badge kind="partial" label=${s("קיבוץ ידני")} data-window-manual-badge></sw-badge>`:d}
      </div>
      ${i?.on?n`<ul class="rules" data-spotlight-rules>${i.rules.map(l=>n`<li><span class="spot"><sw-icon name="target" size=${12}></sw-icon>${l.label}</span><span class="why">${l.why}</span></li>`)}</ul>`:n`<div class="sub" style="margin-block-end:8px" data-spotlight-none>${s("ללא זרקור:")} ${Object.entries(e.types).map(([l,u])=>`${m[l]??l} ${u}`).join(" · ")}</div>`}
      <sw-button size="sm" variant="ghost" icon=${this.showRaw?"chevron":"list"} data-window-raw-toggle aria-expanded=${this.showRaw} @click=${()=>this.showRaw=!this.showRaw}>${this.showRaw?s("הסתר את האירועים"):s("{n} אירועים מקוריים",{n:e.count})}</sw-button>
      ${this.showRaw?n`<div class="wlist" data-window-events>
            ${t.map(l=>n`<a class="wrow ${e.count>1?"tick":""}" href=${`#/investigate/events/${l.id}`}>${e.count>1?n`<input type="checkbox" aria-label=${s("בחר אירוע לפיצול")} data-window-tick=${l.id} .checked=${this.ticked.has(l.id)} @click=${u=>u.stopPropagation()} @change=${u=>this.tick(l.id,u.target.checked)} />`:d}<span class="ty" style="--tone:${T[l.type]??"var(--sw-tl-offline)"}"><i></i>${m[l.type]??l.type}</span><span class="ltr">${this.fmt(l.occurred_at)}</span><span class="sub">${l.acked_at?s("טופל"):s("ממתין")}</span></a>`)}
            ${t.length<e.count?n`<div class="sub">${s("{n} אירועים נוספים אינם בסינון הנוכחי.",{n:e.count-t.length})}</div>`:d}
          </div>
          <div class="wfix" data-window-fix>
            ${e.count>1?n`<sw-button size="sm" icon="move" ?disabled=${!r.length||r.length>=e.count||this.busy} data-window-split @click=${()=>this.regroup(r,s("פוצל מחלון"))}>${s("הפרד לחלון נפרד")}${r.length?` (${r.length})`:""}</sw-button>`:d}
            ${p?n`<sw-button size="sm" icon="layers" ?disabled=${this.busy} data-window-join-older @click=${()=>this.regroup([...e.event_ids,...p.event_ids],s("אוחד עם החלון הקודם"))}>${s("אחד עם הקודם ({time})",{time:this.fmt(p.start)})}</sw-button>`:d}
            ${o?n`<sw-button size="sm" icon="layers" ?disabled=${this.busy} data-window-join-newer @click=${()=>this.regroup([...e.event_ids,...o.event_ids],s("אוחד עם החלון הבא"))}>${s("אחד עם הבא ({time})",{time:this.fmt(o.start)})}</sw-button>`:d}
            ${e.manual_group_id?n`<sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.busy} data-window-ungroup @click=${()=>this.dissolve(e)}>${s("בטל קיבוץ ידני")}</sw-button>`:d}
          </div>`:d}
      <div slot="footer" class="acts">
        <sw-button variant="primary" size="sm" ?block=${this.narrow} icon="expand" data-review-window @click=${()=>$(`/investigate/events/${e.first_event_id}`)}>${s("סקירה מלאה")}</sw-button>
        <sw-button size="sm" ?block=${this.narrow} icon="check" ?disabled=${e.acked||this.busy} @click=${()=>this.ackWindow(e)}>${e.acked?s("טופל"):s("סמן הכל כטופל")}</sw-button>
        ${this.renderKeys()}
      </div>
    </sw-drawer>`}onPushed(e){if(!this.events)return;const t=this.cams?.find(o=>o.id===e.camera_id),i=this.events.findIndex(o=>o.id===e.id),r=Se(e,{date:this.date,cameraId:this.cameraId,recorderId:this.recorderId,type:this.type,source:this.source,filter:this.filter,placeFloor:this.placeFloor,placeZone:this.placeZone,q:this.q},{day:b(new Date(e.occurred_at),this.tz),cameraRecorder:t?.recorder_id??null,known:i>=0});if(r==="drop")return;if(r==="reload"){window.clearTimeout(this.pushReloadTimer),this.pushReloadTimer=window.setTimeout(()=>void this.load(),1e3);return}const p={...e,camera_name:e.camera_name??t?.name??null};(e.thumbnail==="ready"||e.thumbnail==="unavailable")&&(this.thumbs.cancel(e.id),e.thumbnail==="ready"&&(this.thumbVersion=new Map(this.thumbVersion).set(e.id,Date.now()))),this.events=i>=0?this.events.map((o,a)=>a===i?{...o,...p}:o):[p,...this.events]}fmt(e){return ae(new Date(e),{timeZone:this.tz,seconds:!0})}fmtDate(e){return ne(new Date(e),{timeZone:this.tz})}async ack(e){this.busy=!0;try{const t=await fe(e.id);this.events=(this.events??[]).map(i=>i.id===e.id?{...i,...t}:i)}catch(t){this.error=v(t)}finally{this.busy=!1}}renderApi(){if(this.error&&!this.events)return n`<sw-state-panel state="error" hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>this.init()}></sw-state-panel>`;if(!this.events)return n`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.events.find(a=>a.id===this.selected)??null,t=this.ingest,i=this.events.filter(a=>!a.acked_at).length,r=!!(t?.connected&&this.facets&&!this.facets.sources.some(a=>a.source==="alertstream")),p=!!t&&!t.connected,o=this.activeFilters();return n`
      ${p?n`<div class="banner warn" data-ingest-down><span class="dot"></span><span>${s("הקליטה מהמקליט מנותקת")}${t.last_error?` (${V(t.last_error)})`:""} · ${s("אירועים חדשים לא יגיעו עד שהחיבור יחזור")}</span></div>`:d}
      <div class="kpis" data-kpis>
        <div class="kpi ${i?"hot":""}"><div><div class="n">${i}</div><div class="l">${s("לבדיקה")}</div></div><div class="ic"><sw-icon name="bell" size=${18}></sw-icon></div></div>
        <div class="kpi"><div><div class="n">${this.events.length-i}</div><div class="l">${s("טופלו היום")}</div></div><div class="ic"><sw-icon name="check" size=${18}></sw-icon></div></div>
      </div>
      <div class="fbar" data-filter-bar>
      <div class="filters">
        <sw-field class="q"><input type="search" data-events-q placeholder=${s("חיפוש: מצלמה, התקן, פרטי אירוע")} aria-label=${s("חיפוש חופשי")} .value=${this.q} @input=${a=>this.onSearchInput(a.target.value)} /></sw-field>
        ${this.recorders.length>1?n`<sw-field><select aria-label=${z("videoCopy.recorder")} data-filter-recorder @change=${a=>{this.recorderId=a.target.value,this.cameraId="",this.load()}}><option value="" ?selected=${!this.recorderId}>${z("videoCopy.recorderAll")}</option>${this.recorders.map(a=>n`<option value=${a.id} ?selected=${a.id===this.recorderId}>${a.name}</option>`)}</select></sw-field>`:d}
        <sw-field><select aria-label=${s("מצלמה")} @change=${a=>{this.cameraId=a.target.value,this.load()}}><option value="" ?selected=${!this.cameraId}>${s("כל המצלמות")}</option>${(this.cams??[]).filter(a=>!this.recorderId||a.recorder_id===this.recorderId).map(a=>n`<option value=${a.id} ?selected=${a.id===this.cameraId}>${a.name}</option>`)}</select></sw-field>
        <sw-field><select aria-label=${s("סוג")} @change=${a=>{this.type=a.target.value,this.load()}}><option value="" ?selected=${!this.type}>${s("כל סוגי האירועים")}</option>${Object.keys(m).map(a=>n`<option value=${a} ?selected=${a===this.type}>${m[a]}</option>`)}</select></sw-field>
        <sw-field><input type="date" lang=${W()} .value=${this.date} max=${b(new Date,this.tz)} data-ltr aria-label=${s("תאריך")} @change=${a=>{this.date=a.target.value,this.load()}} /></sw-field>
        <span class="rangepick" role="group" aria-label=${s("טווח ימים")} data-events-range>
          ${[[1,s("יום")],[7,s("7 ימים")],[30,s("30 יום")]].map(([a,l])=>n`<button class=${this.rangeDays===a?"on":""} data-events-range-set=${a} @click=${()=>this.setRange(a)}>${l}</button>`)}
        </span>
        <sw-field><select aria-label=${s("מקום")} data-filter-floor @change=${a=>{this.placeFloor=a.target.value,this.placeZone="",this.load()}}><option value="" ?selected=${!this.placeFloor}>${s("כל המקומות")}</option>${this.facetFloors.map(a=>n`<option value=${a.id} ?selected=${a.id===this.placeFloor}>${a.name} · ${s("{n} מצלמות",{n:a.cameras})}${a.sensors?` · ${s("{n} חיישנים",{n:a.sensors})}`:""}</option>`)}</select></sw-field>
        ${this.placeFloor&&this.facetFloors.find(a=>a.id===this.placeFloor)?.zones.length?n`<sw-field><select aria-label=${s("חדר / אזור")} data-filter-zone @change=${a=>{this.placeZone=a.target.value,this.load()}}><option value="" ?selected=${!this.placeZone}>${s("כל הקומה")}</option>${(this.facetFloors.find(a=>a.id===this.placeFloor)?.zones??[]).map(a=>n`<option value=${a.id} ?selected=${a.id===this.placeZone}>${a.name} · ${s("{n} מצלמות",{n:a.cameras})}${a.sensors?` · ${s("{n} חיישנים",{n:a.sensors})}`:""}</option>`)}</select></sw-field>`:d}
        <sw-field><select aria-label=${s("מקור")} data-filter-source @change=${a=>{this.source=a.target.value,this.load()}}><option value="" ?selected=${!this.source}>${s("כל המקורות")}</option>${Object.entries(y).map(([a,l])=>n`<option value=${a} ?selected=${a===this.source}>${l}</option>`)}</select></sw-field>
      </div>
      <div class="tools">
        <sw-chip-choice class="evc" label=${s("מצב טיפול")} value=${this.filter} data-events-ack-filter
          .options=${[{value:"all",label:s("הכל"),count:this.filter==="all"?this.events.length:void 0,attrs:{"data-ack-filter":"all"}},{value:"unacked",label:s("לבדיקה"),count:i,attrs:{"data-ack-filter":"unacked"}},{value:"acked",label:s("טופלו"),attrs:{"data-ack-filter":"acked"}}]}
          @change=${a=>{a.stopPropagation(),this.filter=a.detail.value,this.load()}}></sw-chip-choice>
        <sw-chip-choice class="evc" label=${s("תצוגה")} value=${this.mode} data-events-view
          .options=${[{value:"raw",label:s("אירועים"),icon:n`<sw-icon name="list" size=${13}></sw-icon>`,attrs:{"data-mode-raw":""}},{value:"windows",label:s("חלונות"),icon:n`<sw-icon name="layers" size=${13}></sw-icon>`,count:this.windows?.length,attrs:{"data-mode-windows":""}}]}
          @change=${a=>{a.stopPropagation(),this.setMode(a.detail.value)}}></sw-chip-choice>
        ${o.length?n`<span class="active" data-active-filters>
              ${o.map(a=>n`<button type="button" class="fchip" data-active-filter=${a.key} aria-label=${s("הסר מסנן: {label}",{label:a.label})} @click=${a.clear}><span>${a.label}</span><sw-icon name="close" size=${12}></sw-icon></button>`)}
              <button type="button" class="reset" data-filter-reset @click=${()=>this.resetFilters()}>${s("איפוס")}</button>
            </span>`:d}
        <sw-button class="ackall" size="sm" icon="check" ?disabled=${!i||this.busy} data-ack-all title=${s("מסמן כטופלו את כל האירועים ברשימה שעדיין לבדיקה (לפי הסינון הנוכחי)")} @click=${()=>this.ackAll()}>${s("סמן הכול כטופל ({n})",{n:i})}</sw-button>
      </div>
      </div>
      ${this.renderTech(r)}
      ${this.unsupported.length?n`<div class="banner warn" data-unsupported>${s('המסנן אינו נתמך כאן, לא "אין תוצאות":')} ${this.unsupported.map(a=>a.reason).join(" · ")}</div>`:d}
      ${this.error?n`<div class="banner warn" role="alert">${this.error}</div>`:d}
      ${this.mode!=="windows"&&this.events.length>=S?n`<div class="banner" data-events-capped><sw-icon name="info" size=${14}></sw-icon><span>${s('מוצגים {n} האירועים האחרונים בלבד. צמצמו את הסינון או את טווח הימים כדי לראות אירועים מוקדמים יותר; "סמן הכול כטופל" חל רק על המוצגים.',{n:S})}</span></div>`:d}
      <div class="stage ${(e||this.mode==="windows"&&this.selectedWindow)&&this.dock?"docked":""}">
        ${this.mode==="windows"?this.windows===null||this.windowsBusy&&!this.windows.length?n`<sw-state-panel state="loading"></sw-state-panel>`:this.windows.length?n`<div class="banner" style="margin-block-end:8px"><sw-icon name="info" size=${14}></sw-icon><span>${s("{what} הופכות לחלון אירוע אחד (מרווח עד {n} דק׳). האירועים המקוריים נשמרים לצפייה.",{what:this.windowBy==="camera"?s("התראות סמוכות באותה מצלמה"):this.windowBy==="all"?s("התראות סמוכות מכל המצלמות"):this.windowBy==="zone"?s("התראות סמוכות באותו חדר"):s("התראות סמוכות באותה קומה"),n:Math.round(this.windowGap/60)})}</span><span class="grow"></span>
                  <sw-chip icon="target" ?selected=${this.spotlightOnly} data-window-spotlight-only count=${this.spotlightCount} @click=${()=>{this.spotlightOnly=!this.spotlightOnly,this.loadWindows()}}>${s("זרקורים")}</sw-chip>
                  <sw-field><select aria-label=${s("קיבוץ")} data-window-by @change=${a=>{this.windowBy=a.target.value,this.loadWindows()}}>${Object.keys(M).map(a=>n`<option value=${a} ?selected=${this.windowBy===a}>${M[a]}</option>`)}</select></sw-field>
                  <sw-field><select aria-label=${s("מרווח קיבוץ")} data-window-gap @change=${a=>{this.windowGap=Number(a.target.value),this.loadWindows()}}>${[60,180,300,600,900,1800,3600].map(a=>n`<option value=${a} ?selected=${this.windowGap===a}>${s("{n} דק׳",{n:a/60})}</option>`)}</select></sw-field></div>
                <sw-table .columns=${this.windowColumns} .rows=${this.windows} .selected=${this.selectedWindow} @row-select=${a=>this.onRowSelect(a.detail)}></sw-table>`:this.spotlightOnly?n`<sw-state-panel icon="history" state="empty" heading=${s("אין זרקורים ביום הזה")}><div style="margin-block-start:10px"><sw-button size="sm" data-window-spotlight-off @click=${()=>{this.spotlightOnly=!1,this.loadWindows()}}>${s("כל החלונות")}</sw-button></div></sw-state-panel>`:n`<sw-state-panel icon="history" state="empty" heading=${s("אין חלונות אירוע ביום הזה")} hint=${s("חלון נוצר מאירועים סמוכים של אותה מצלמה.")}></sw-state-panel>`:this.events.length?n`<sw-table .columns=${this.apiColumns} .rows=${this.events} .selected=${this.selected} @row-hover=${a=>{const l=this.events?.find(u=>u.id===a.detail.id);l&&this.hoverStart(l,a.detail)}} @row-leave=${()=>this.hoverEnd()} @row-select=${a=>this.onRowSelect(a.detail)}></sw-table>`:n`<sw-state-panel icon="history" state="empty" heading=${s("אין אירועים ביום הזה")} hint=${s("התראות מגיעות מהמקליט רק כשהטריגר מוגדר עם 'Notify Surveillance Center'; אירועי תנועה נגזרים מקובצי ההקלטה בהפעלה ובכל 10 דקות.")}></sw-state-panel>`}
        ${this.renderRowPreview()}
        ${this.mode==="windows"&&this.selectedWindow&&this.windows?(()=>{const a=this.windows.find(l=>l.id===this.selectedWindow);return a?this.renderWindowDrawer(a):d})():d}
        ${e?this.renderEventDrawer(e):d}
      </div>
    `}renderEventDrawer(e){const t=typeof e.details.description=="string"?e.details.description.trim():"",i=ke(t),r=this.kindLabel(e),p=L(e.occurred_at,e.ended_at),o=typeof e.details.time_precision=="string"?e.details.time_precision:"",a=typeof e.details.device_time=="string"?e.details.device_time:"",l=typeof e.details.coalesced=="number"?e.details.coalesced:0;return n`<sw-drawer open class="evdrawer" ?modal=${this.narrow} heading=${r} subheading=${`${this.camLabel(e)} · ${this.fmt(e.occurred_at)} · ${this.ago(e.occurred_at)}`} @close=${()=>this.closeDrawer()}>
              <div class="chips" slot="sub" data-event-chips>
                ${k(e.severity)}
                <sw-badge kind=${e.acked_at?"live":"neutral"} label=${e.acked_at?s("טופל"):s("ממתין לטיפול")}></sw-badge>
              </div>
              <div class="big">
                ${this.player?.eventId===e.id&&this.player.session?n`<sw-live-player .wsUrl=${be(this.player.session)} mode="mse" .retry=${!1}></sw-live-player>`:e.thumbnail==="ready"?n`<img src=${I(e.id,this.thumbVersion.get(e.id)??0)} alt=${s("תמונת האירוע מההקלטה")} />`:n`<div class="hint">${e.camera_id?e.thumbnail==="unavailable"?s("אין פריים זמין בהקלטה בזמן האירוע"):this.player?.eventId===e.id?s("פותח את ההקלטה…"):s("מכין תמונה מההקלטה…"):s("אירוע ללא מצלמה")}</div>`}
                ${this.player?.eventId===e.id&&this.player.error?n`<div class="err">${this.player.error}</div>`:d}
              </div>
              <dl class="r5-facts">
                <div class="wide"><dt>${s("זמן אירוע")}</dt><dd><span class="ltr">${this.fmtDate(e.occurred_at)} ${this.fmt(e.occurred_at)}</span>${e.ended_at?n` ${s("עד")} <span class="ltr">${this.fmt(e.ended_at)}</span>`:d}${p?n` <span class="r5-sub">· ${p}</span>`:d}</dd></div>
                <div><dt>${s("מצלמה")}</dt><dd>${this.camLabel(e)}</dd></div>
                <div><dt>${s("מקור")}</dt><dd>${H[e.source]??e.source}</dd></div>
                <div><dt>${s("ודאות")}</dt><dd>${e.confidence==="measured"?s("נמדד במכשיר"):s("נגזר מההקלטה")}</dd></div>
                <div><dt>${s("חזרות")}</dt><dd>${e.count} · ${e.state==="active"?s("פעיל"):e.state==="inactive"?s("הסתיים"):"—"}</dd></div>
                <div class="wide"><dt>${s("טיפול")}</dt><dd>${e.acked_at?n`${s("טופל")}${e.acked_by_username?` ${s("בידי {name}",{name:e.acked_by_username})}`:""} · <span class="ltr">${this.fmt(e.acked_at)}</span>`:s("ממתין לטיפול")}</dd></div>
                ${i&&i!==`התראת ${r}`?n`<div class="wide"><dt>${s("תיאור")}</dt><dd>${i}</dd></div>`:d}
                ${typeof e.details.seconds=="number"?n`<div><dt>${s("משך ההקלטה")}</dt><dd>${s("{n} שנ׳",{n:String(e.details.seconds)})}</dd></div>`:d}
              </dl>
              <details class="tech evtech" data-event-tech>
                <summary><sw-icon name="info" size=${14}></sw-icon><span>${s("פרטים טכניים")}</span><sw-icon class="chev" name="chevron" size=${14}></sw-icon></summary>
                <dl class="kv">
                  <dt>${s("קוד המכשיר")}</dt><dd class="ltr">${e.raw_type}</dd>
                  ${t?n`<dt>${s("טקסט המכשיר")}</dt><dd class="ltr">${t}</dd>`:d}
                  ${o?n`<dt>${s("דיוק הזמן")}</dt><dd>${xe(o)??""} <span class="ltr mono">${o}</span></dd>`:d}
                  ${a?n`<dt>${s("שעון המכשיר")}</dt><dd class="ltr mono">${a}</dd>`:d}
                  <dt>${s("נקלט")}</dt><dd><span class="ltr">${this.fmtDate(e.received_at)} ${this.fmt(e.received_at)}</span></dd>
                  <dt>${s("מקור (מפתח)")}</dt><dd class="ltr mono">${e.source} · ${e.confidence}</dd>
                  ${e.recorder_id?n`<dt>${s("מקליט")}</dt><dd class="ltr mono">${e.recorder_id}${e.channel?` · ch ${e.channel}`:""}</dd>`:d}
                  ${l?n`<dt>${s("אוחדו")}</dt><dd>${s("{n} התראות קודמות",{n:l})}</dd>`:d}
                  <dt>${s("מזהה")}</dt><dd class="ltr mono">${e.id}</dd>
                </dl>
              </details>
              <div slot="footer" class="acts">
                <sw-button variant="primary" size="sm" ?block=${this.narrow} icon="expand" data-review @click=${()=>$(`/investigate/events/${e.id}`)}>${s("סקירה מלאה")}</sw-button>
                ${e.camera_id?n`<sw-button size="sm" ?block=${this.narrow} icon="play" data-play @click=${()=>this.play(e)}>${this.player?.eventId===e.id?s("עצור"):s("נגן כאן")}</sw-button>
                    <sw-button size="sm" ?block=${this.narrow} icon="history" data-to-recording @click=${()=>$("/investigate/playback",{camera:e.camera_id,t:e.occurred_at})}>${s("להקלטה")}</sw-button>`:d}
                <sw-button variant="ghost" size="sm" ?block=${this.narrow} icon="check" data-ack ?disabled=${!!e.acked_at||this.busy} @click=${()=>this.ack(e)}>${e.acked_at?s("טופל"):s("סמן טופל")}</sw-button>
                ${this.renderKeys()}
              </div>
            </sw-drawer>`}renderKeys(){return this.narrow?d:n`<span class="keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> ${s("מעבר")} · <kbd>Enter</kbd> ${s("סקירה")} · <kbd>Esc</kbd> ${s("סגירה")}</span>`}renderTech(e){const t=this.ingest,i=this.facets,r=i?i.unavailable_types.filter(o=>["person","vehicle","line","field","door"].includes(o.type)):[],p=t?t.connected?s("קליטה מחוברת"):s("קליטה מנותקת"):s("בודק את הקליטה…");return n`<details class="tech" data-tech-details ?open=${this.techOpen} @toggle=${o=>this.onTechToggle(o.target.open)}>
      <summary>
        <span class="dot ${t?.connected?"on":""}" aria-hidden="true"></span>
        <span data-ingest-line title=${t?.last_error??""}>${p}</span>
        <span class="sub">· ${s("עדכונים חיים {state}",{state:this.live?s("פעילים"):s("מתחברים…")})}</span>
        ${e?n`<span class="warnnote" data-no-alerts-flag><sw-icon name="warning" size=${13}></sw-icon>${s("המקליט לא שולח התראות")}</span>`:d}
        <span class="grow"></span>
        <span class="sub">${s("פרטים טכניים")}</span>
        <sw-icon class="chev" name="chevron" size=${14}></sw-icon>
      </summary>
      <div class="techbody">
        <div>${s("קליטה מהמקליט:")} ${t?t.connected?s("מחובר"):`${s("מנותק")}${t.last_error?` (${V(t.last_error)})`:""}`:"—"}${t?.last_heartbeat_at?` · ${s("פעימה אחרונה {time}",{time:this.fmt(t.last_heartbeat_at)})}`:""} · ${s("עדכונים חיים:")} ${this.live?s("פעיל"):s("מתחבר…")} · ${s("אזור זמן")} <span class="ltr">${this.tz}</span></div>
        <div>${s('אירועים "נגזר מהקלטה" הם עדות מקובץ ההקלטה, לא התראה שנמדדה במכשיר.')}</div>
        ${e?n`<div data-no-alerts class="warntext">${s('המקליט לא שלח התראות ב־{n} הימים האחרונים. כדי לקבל אותן: במקליט, בהגדרות הקישור (linkage) של זיהוי התנועה, להפעיל "Notify Surveillance Center".',{n:i.days})}</div>`:d}
        ${i?n`<div data-facets><strong>${s("שדות עם נתונים ({n} ימים):",{n:i.days})}</strong> ${i.types.map(o=>`${m[o.type]??o.type} (${o.count})`).join(" · ")||s("אין אירועים")} · <strong>${s("מקורות:")}</strong> ${i.sources.map(o=>`${y[o.source]??o.source} (${o.count})`).join(" · ")||"—"}
              ${r.length?n`<br /><strong>${s("לא זמין:")}</strong> ${r.map((o,a)=>n`${a?" · ":""}<span title=${o.reason}>${m[o.type]??o.type}</span>`)} <span class="sub">${s("(ריחוף מסביר למה)")}</span>`:d}
              ${i.notes.map(o=>n`<br />${o}`)}</div>`:d}
      </div>
    </details>`}onTechToggle(e){if(e!==this.techOpen){this.techOpen=e;try{localStorage.setItem("sw.events.tech",e?"1":"0")}catch{}}}activeFilters(){const e=[],t=()=>void this.load(),i=b(new Date,this.tz);return this.q.trim()&&e.push({key:"q",label:`"${this.q.trim()}"`,clear:()=>{this.q="",t()}}),this.recorderId&&e.push({key:"recorder",label:this.recorders.find(r=>r.id===this.recorderId)?.name??z("videoCopy.recorder"),clear:()=>{this.recorderId="",t()}}),this.cameraId&&e.push({key:"camera",label:this.cams?.find(r=>r.id===this.cameraId)?.name??s("מצלמה"),clear:()=>{this.cameraId="",t()}}),this.type&&e.push({key:"type",label:m[this.type]??this.type,clear:()=>{this.type="",t()}}),this.date&&this.date!==i&&e.push({key:"date",label:s("עד {date}",{date:this.date.split("-").reverse().join(".")}),clear:()=>{this.date=i,t()}}),this.rangeDays>1&&e.push({key:"range",label:s("{n} ימים",{n:this.rangeDays}),clear:()=>this.setRange(1)}),this.placeFloor&&e.push({key:"floor",label:this.facetFloors.find(r=>r.id===this.placeFloor)?.name??s("מקום"),clear:()=>{this.placeFloor="",this.placeZone="",t()}}),this.placeZone&&e.push({key:"zone",label:this.facetFloors.flatMap(r=>r.zones).find(r=>r.id===this.placeZone)?.name??s("אזור"),clear:()=>{this.placeZone="",t()}}),this.source&&e.push({key:"source",label:y[this.source]??this.source,clear:()=>{this.source="",t()}}),e}resetFilters(){this.q="",this.recorderId="",this.cameraId="",this.type="",this.date=b(new Date,this.tz),this.rangeDays=1,this.placeFloor="",this.placeZone="",this.source="",this.filter="all",this.load()}renderDemo(){const e=g.filter(i=>this.filter==="all"||!i.acked),t=g.find(i=>i.id===this.selected);return n`
      <div class="filters">
        <sw-field><select aria-label=${s("אתר")}><option>${s("כל האתרים")}</option><option>${s("אתר הדגמה")}</option></select></sw-field>
        <sw-field><select aria-label=${s("מצלמה")}><option>${s("כל המצלמות")}</option></select></sw-field>
        <sw-field><select aria-label=${s("סוג")}><option>${s("כל סוגי האירועים")}</option><option>${s("אדם")}</option><option>${s("רכב")}</option><option>${s("תנועה")}</option><option>${s("ניתוק")}</option></select></sw-field>
        <sw-field><input type="date" lang=${W()} value="2026-09-14" data-ltr aria-label=${s("תאריך")} /></sw-field>
        <span class="grow"></span>
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${g.length}>${s("הכל")}</sw-chip>
        <sw-chip ?selected=${this.filter==="unacked"} @click=${()=>this.filter="unacked"} count=${g.filter(i=>!i.acked).length}>${s("ללא טיפול")}</sw-chip>
      </div>
      <div class="stage">
        <sw-table .columns=${this.columns} .rows=${e} .selected=${this.selected} @row-select=${i=>this.selected=i.detail.id}></sw-table>
        ${t?n`<sw-drawer open class="evdrawer" ?modal=${this.narrow} heading=${E[t.type]} subheading=${`${t.camera} · ${t.time}`} @close=${()=>this.selected=null}>
              <div class="preview">${t.type==="offline"||t.type==="door"?s("אין תמונה לאירוע זה"):n`<sw-scene kind=${G[t.camera]??"lobby"}></sw-scene><span class="demo">${s("דמו · תמונת אירוע מהמקליט (T044)")}</span>`}</div>
              <dl class="r5-facts">
                <div><dt>${s("זמן אירוע")}</dt><dd>${t.time} <span class="r5-sub">· ${s("נקלט +1.2s")}</span></dd></div>
                <div><dt>${s("טיפול")}</dt><dd>${t.acked?s("טופל בידי יוני, 09:50"):s("ממתין")}</dd></div>
                <div><dt>${s("קומה")}</dt><dd>${t.floor}</dd></div>
                <div><dt>${s("כיסוי הקלטה")}</dt><dd>${t.type==="offline"?s("אין"):s("קיים · 10 שנ׳ לפני/אחרי")}</dd></div>
                <div class="wide"><dt>${s("מקור")}</dt><dd>${K[t.source]??t.source} · raw: <span class="ltr">${t.type}</span></dd></div>
              </dl>
              <div slot="footer" class="acts">
                <a href="#/investigate/playback"><sw-button variant="primary" size="sm" icon="history">${s("להקלטה")}</sw-button></a>
                <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">${s("במפה")}</sw-button></a>
                <sw-button variant="ghost" size="sm" icon="check" ?disabled=${t.acked}>${s("סמן טופל")}</sw-button>
              </div>
            </sw-drawer>`:""}
      </div>
    `}render(){const e=_();return n`
      <sw-page heading=${s("מרכז אירועים")} subheading=${e?s("חיפוש, סינון וסקירה של אירועי המצלמות והחיישנים"):s("חיפוש, סינון וסקירה של כל האירועים · מקור וזמן קליטה נשמרים · נתוני הדגמה")}>
        ${e?d:n`<sw-button slot="actions" icon="download">${s("ייצוא")}</sw-button>`}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};c.styles=[_e,oe`
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .filters sw-field {
      inline-size: 150px;
    }
    .filters sw-field:has(input[type='search']) {
      inline-size: 210px;
    }
    .filters .grow {
      flex: 1;
    }
    .rangepick {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 2px;
    }
    .rangepick button {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      border-radius: var(--sw-r-xs);
      padding: 4px 8px;
      cursor: pointer;
    }
    .rangepick button.on {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    /* EVENTS-POLISH-2331 (owner: the panel's actions sat at the bottom of the PAGE): from a tablet up the screen takes exactly the height the
       shell leaves it and never scrolls; the list scrolls inside its own box (sticky header) and the drawer - absolute in that box - is as
       tall as the box, so its footer actions are always in view. A phone keeps the page scroll (the rows are cards there) and gets a
       full-screen modal sheet. Embedded in a page that does not bound the height (the reviews tab), the box just grows as before. */
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
      min-inline-size: 0;
    }
    sw-page {
      flex: 1;
      min-block-size: 0;
    }
    .stage {
      position: relative;
      min-block-size: 280px;
      display: flex;
      flex-direction: column;
    }
    .stage > sw-table {
      --sw-table-cell-pad: 9px 14px;
      flex: 0 1 auto;
      min-block-size: 0;
    }
    @media (min-width: 768px) {
      sw-page {
        block-size: 100%;
        padding-block-end: 16px;
      }
      .stage {
        flex: 1;
        min-block-size: 240px;
      }
    }
    /* a wide desktop: the drawer docks beside the list (the list narrows), so the selected row and its neighbours stay readable */
    .stage {
      --sw-drawer-w: clamp(360px, 28vw, 440px);
    }
    .stage.docked {
      padding-inline-start: calc(var(--sw-drawer-w) + 12px);
    }
    .stage.docked > sw-drawer {
      --sw-shadow-3: var(--sw-shadow-2);
    }
    sw-drawer.evdrawer {
      /* the phone's sheet covers the screen (TKUI1 hooks), the desktop panel is unchanged */
      --sw-drawer-sheet-h: 100dvh;
      --sw-drawer-sheet-max-h: 100dvh;
      --sw-drawer-modal-w: 100vw;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      inline-size: 100%;
    }
    .keys {
      margin-inline-start: auto;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-2xs);
      white-space: nowrap;
    }
    .keys kbd {
      font: inherit;
      font-family: var(--sw-font-mono);
      padding: 0 4px;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      margin-inline-end: 2px;
    }
    @media (max-width: 1100px), (pointer: coarse) {
      .keys {
        display: none;
      }
    }
    /* a phone: the sheet's bottom bar - the primary action across, the others two by two, each a full 44 px target */
    @media (max-width: 767px) {
      .acts {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .acts > sw-button[variant='primary'] {
        grid-column: 1 / -1;
      }
      .acts > sw-button:last-of-type:nth-of-type(even) {
        grid-column: 1 / -1;
      }
      /* the fields two by two (the search and the range across): the filters took a whole screen of single rows */
      .filters {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .filters sw-field.q,
      .filters .rangepick {
        grid-column: 1 / -1;
      }
      .filters .rangepick button {
        flex: 1;
      }
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 6px;
    }
    /* the filter bar: the fields on one wrapping row, then the status / view segments, the active filters with a reset, and the bulk action */
    .fbar {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: none;
    }
    .filters sw-field.q {
      inline-size: 240px;
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
    }
    /* CR-CMP2-TABS-2460: the handling-state and view rows are sw-chip-choice, at this toolbar's 28 px chip (the sw-chip size they had) */
    /* CMP2-POLISH-2480 (owner N48): on a phone too the chips stay 28 px tall (as before 2.46.0); a finger still gets a 44 px hit area */
    sw-chip-choice.evc {
      --sw-chipc-gap: 4px;
      --sw-chipc-h: 28px;
      --sw-chipc-touch-h: 28px;
      --sw-chipc-pad: 11px;
      --sw-chipc-fs: var(--sw-fs-sm);
    }
    /* the "mark all handled" key sits at the row's end. CMP2-POLISH-2480: pushed there by its own auto margin, not by a spacer item -
       a spacer is one more flex item and one more 12 px gap, which on a 390 px phone sent the key to a third line under the 28 px
       chip rows (the page grew); without it the key shares the view row as it did in 2.47.0 */
    .tools .ackall {
      margin-inline-start: auto;
    }
    .active {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      padding-inline-start: 12px;
      border-inline-start: 1px solid var(--sw-border);
    }
    .fchip,
    .reset {
      font: inherit;
      font-size: var(--sw-fs-xs);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-block-size: 28px;
      padding: 2px 8px 2px 10px;
      border-radius: var(--sw-r-pill);
      border: 1px solid transparent;
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease-out), background-color var(--sw-t-hover) var(--sw-ease);
    }
    .fchip {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .fchip span {
      max-inline-size: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .reset {
      background: transparent;
      color: var(--sw-text-2);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .fchip:active,
    .reset:active {
      transform: scale(var(--sw-press-scale));
    }
    .fchip:focus-visible,
    .reset:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (hover: hover) and (pointer: fine) {
      .fchip:hover {
        background: color-mix(in srgb, var(--sw-accent-soft) 70%, var(--sw-accent) 12%);
      }
      .reset:hover {
        color: var(--sw-text);
      }
    }
    /* the data sources / technical line: one quiet summary; the details on demand - the look is the shared techDetailsStyles
       (styles/tech-details.ts, SHARED-POLISH-2342); only its place in the column stays here */
    details.tech {
      flex: none;
    }
    .warnnote {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-semibold);
    }
    .warntext {
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-semibold);
    }
    /* inside the drawer: the raw values as a quiet key / value list */
    details.evtech {
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      padding: 2px 8px;
    }
    details.evtech summary .chev {
      margin-inline-start: auto;
    }
    dl.kv {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 4px 12px;
      margin: 4px 0 8px;
      font-size: var(--sw-fs-xs);
    }
    dl.kv dd.ltr {
      text-align: end;
    }
    dl.kv dt {
      color: var(--sw-text-3);
    }
    dl.kv dd {
      margin: 0;
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
    .mono {
      font-family: var(--sw-font-mono);
    }
    /* CR-EVENTS-TABLE-2443 (06:EVT-3): the .thumb rules (88x56 box, pending shimmer) were removed - every thumbnail renders inside
       sw-table's shadow root, where this stylesheet never reached them; the cells carry their size inline. */
    .big {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2);
      margin-block-end: 12px;
      overflow: hidden;
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      text-align: center;
    }
    .big img,
    .big sw-live-player {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .big .hint {
      padding: 10px;
    }
    .big .err {
      position: absolute;
      inset-inline: 8px;
      inset-block-end: 8px;
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-xs);
      padding: 4px 8px;
    }
    .ty {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
    }
    .ty i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--tone);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--tone) 22%, transparent);
      flex: none;
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .preview {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2);
      margin-block-end: 12px;
      overflow: hidden;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-xs);
      text-align: center;
      padding: 10px;
    }
    .preview sw-scene {
      position: absolute;
      inset: 0;
    }
    .preview .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: var(--sw-fs-2xs);
      background: var(--sw-video-scrim);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-2xs);
      padding: 1px 6px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    /* the ingest status strip: one quiet line - the dot says connected, the rest is secondary */
    .banner {
      font-size: var(--sw-fs-xs);
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      color: var(--sw-text-2);
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      line-height: 1.5;
    }
    .banner.warn {
      background: var(--sw-warning-soft);
      border-color: color-mix(in srgb, var(--sw-warning) 40%, transparent);
      color: var(--sw-warning-text);
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-offline);
      display: inline-block;
      box-shadow: 0 0 0 2px var(--sw-offline-soft);
      flex: none;
    }
    .dot.on {
      background: var(--sw-live);
      box-shadow: 0 0 0 2px var(--sw-live-soft);
    }
    .rangepick button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .rangepick button:hover:not(.on) {
      color: var(--sw-text);
      background: var(--sw-hover-wash);
    }
    .kpis {
      display: none;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-block-end: 10px;
    }
    .kpi {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .kpi .n {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
      line-height: 1;
    }
    .kpi .l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .kpi .ic {
      inline-size: 36px;
      block-size: 36px;
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .kpi.hot .ic {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .kpi.hot .n {
      color: var(--sw-warning-text);
    }
    /* UXFIX-A11Y-295: the range toggle was 30 x 25 / 46 x 25 on a phone */
    @media (max-width: 767px), (pointer: coarse) {
      .rangepick button {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
    @media (max-width: 767px) {
      .kpis {
        display: grid;
      }
      .filters sw-field {
        inline-size: 100%;
      }
    }
    .wlist {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .wrow {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 10px;
      align-items: center;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    /* R5-INVESTIGATE-297 loop 2: hover only under a fine pointer; the row sinks on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .wrow:hover {
        background: var(--sw-hover-wash);
      }
    }
    .wrow {
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .wrow:active {
      transform: scale(var(--sw-press-scale));
    }
    .wrow:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    /* M047: a ticked raw event (for a split) and the spotlight rules of the window */
    .wrow.tick {
      grid-template-columns: auto 1fr auto auto;
    }
    .wrow input[type='checkbox'] {
      margin: 0;
      accent-color: var(--sw-accent);
    }
    .spot {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .rules {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0 0 10px;
      padding: 0;
      list-style: none;
    }
    .rules li {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px;
      align-items: baseline;
      font-size: var(--sw-fs-sm);
    }
    .rules li .why {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .wsum {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-block-end: 8px;
    }
    .wfix {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 8px;
    }
    /* hover preview over an event row (T044): the event's frame and the frames 5 s before / after it */
    .rowpreview {
      position: fixed;
      z-index: var(--sw-z-popover, 40);
      inline-size: 372px;
      max-inline-size: calc(100vw - 32px);
      /* a floating preview over the list is a popover: opaque, never see-through (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3, var(--sw-shadow-2));
      padding: 8px;
      pointer-events: none;
    }
    .rowpreview .strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }
    .rowpreview .cell {
      aspect-ratio: 16 / 9;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-xs);
      overflow: hidden;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      position: relative;
    }
    .rowpreview .cell.main {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .rowpreview img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .rowpreview .t {
      position: absolute;
      inset-block-end: 3px;
      inset-inline-end: 5px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-2xs);
      color: var(--sw-on-video);
      background: var(--sw-video-scrim);
      padding: 0 4px;
      border-radius: 3px;
    }
    .rowpreview .cap {
      margin-block-start: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    ${re}
  `,ge,ze];h([R()],c.prototype,"cameraId",2);h([R()],c.prototype,"date",2);h([R()],c.prototype,"initialMode",2);h([w()],c.prototype,"selected",2);h([w()],c.prototype,"filter",2);h([w()],c.prototype,"cams",2);h([w()],c.prototype,"tz",2);h([w()],c.prototype,"type",2);h([w()],c.prototype,"events",2);h([w()],c.prototype,"ingest",2);h([w()],c.prototype,"live",2);h([w()],c.prototype,"error",2);h([w()],c.prototype,"busy",2);h([w()],c.prototype,"thumbVersion",2);h([w()],c.prototype,"player",2);h([w()],c.prototype,"mode",2);h([w()],c.prototype,"windows",2);h([w()],c.prototype,"windowGap",2);h([w()],c.prototype,"windowBy",2);h([w()],c.prototype,"selectedWindow",2);h([w()],c.prototype,"windowsBusy",2);h([w()],c.prototype,"spotlightOnly",2);h([w()],c.prototype,"spotlightCount",2);h([w()],c.prototype,"showRaw",2);h([w()],c.prototype,"ticked",2);h([w()],c.prototype,"facets",2);h([w()],c.prototype,"placeFloor",2);h([w()],c.prototype,"placeZone",2);h([w()],c.prototype,"source",2);h([w()],c.prototype,"recorderId",2);h([w()],c.prototype,"recorders",2);h([w()],c.prototype,"unsupported",2);h([w()],c.prototype,"q",2);h([w()],c.prototype,"rangeDays",2);h([w()],c.prototype,"narrow",2);h([w()],c.prototype,"dock",2);h([w()],c.prototype,"now",2);h([w()],c.prototype,"techOpen",2);h([w()],c.prototype,"rowPreview",2);c=h([de("investigate-events")],c);export{c as InvestigateEvents};
