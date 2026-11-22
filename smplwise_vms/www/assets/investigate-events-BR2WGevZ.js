import{cC as K,bH as G,i as X,aL as Y,Y as $,A as l,b as r,m8 as R,a2 as _,bA as E,n as v,p as J,eK as Q,d as ee,cs as te,ey as z,ej as D,eY as g,aU as se,aV as ie,g as ae,ax as S,j as p,k as re}from"./index-Cwrvr-7C.js";import"./sw-table-YC-wBEqU.js";import"./sw-chip-BjSxaLbF.js";import{p as ne,f as T,E as m,s as oe,t as I,h as W,i as de,l as le,j as ce,k as he,u as pe,S as y,d as we,W as N}from"./events-BJPIvGWl.js";import{f as ue,c as me,a as M,d as b,p as fe}from"./recordings-1rNaiBNm.js";import{s as C,r as ve,d as $e,p as be,t as ge}from"./event-codes-CLhr5D-D.js";import{I as ye}from"./investigate-r5-css-ByFmjejp.js";import{L as ke}from"./latest-DjG5XH9h.js";import{t as s}from"./investigate-CacqOR3L.js";import"./sw-logo-art-PLtEZJxU.js";const H={he:{notConfigured:"לא חובר NVR",rejected:"ה־NVR דחה את פרטי הכניסה",notFound:"ה־NVR לא מגיש את שירות ההתראות",serverError:"ה־NVR החזיר שגיאה",timeout:"ה־NVR לא ענה בזמן",unreachable:"אין חיבור ל־NVR",disconnected:"החיבור נותק",unknown:"סיבה לא ידועה"},en:{notConfigured:"No NVR is connected",rejected:"The NVR rejected the sign-in details",notFound:"The NVR does not serve the alert stream",serverError:"The NVR returned an error",timeout:"The NVR did not answer in time",unreachable:"The NVR cannot be reached",disconnected:"The connection was lost",unknown:"Unknown reason"},ar:{notConfigured:"لم يتم ربط جهاز NVR",rejected:"رفض جهاز NVR بيانات الدخول",notFound:"جهاز NVR لا يوفّر خدمة التنبيهات",serverError:"أعاد جهاز NVR خطأ",timeout:"لم يردّ جهاز NVR في الوقت المناسب",unreachable:"لا يمكن الوصول إلى جهاز NVR",disconnected:"انقطع الاتصال",unknown:"سبب غير معروف"},ru:{notConfigured:"NVR не подключён",rejected:"NVR отклонил данные для входа",notFound:"NVR не предоставляет поток тревог",serverError:"NVR вернул ошибку",timeout:"NVR не ответил вовремя",unreachable:"Нет связи с NVR",disconnected:"Соединение потеряно",unknown:"Причина неизвестна"}};function xe(e){const t=String(e??"").trim();if(!t)return"unknown";if(t==="nvr_not_configured")return"notConfigured";if(t==="disconnected")return"disconnected";const a=/^http_(\d{3})$/.exec(t);if(a){const n=Number(a[1]);return n===401||n===403?"rejected":n===404?"notFound":n>=500?"serverError":"unknown"}return/timeout|timedout/i.test(t)?"timeout":/connect|network|resolve|refused|unreachable|ssl|eof|remoteprotocol|readerror/i.test(t)?"unreachable":"unknown"}function _e(){return K(["en","ar","ru"])}function O(e,t=_e()){return H[t][xe(e)]}G("i18n/ingest-reason",H);function ze(e,t,a){return t.date&&a.day!==t.date||t.cameraId&&e.camera_id!==t.cameraId||t.recorderId&&e.recorder_id!==t.recorderId&&a.cameraRecorder!==t.recorderId||t.type&&e.type!==t.type?"drop":a.known?"update":t.source&&e.source!==t.source||t.filter==="acked"&&!e.acked_at||t.filter==="unacked"&&e.acked_at?"drop":t.placeFloor||t.placeZone||t.q.trim()?"reload":"prepend"}const Te=14,Ie=3e3,Se=1500,Re=2;function L(e){return Math.min(15e3,3e3*1.35**e)}class Ee{constructor(t){this.o=t,this.timers=new Map,this.asked=new Map,this.flying=new Set,this.gaveUp=new Set,this.set=t.setTimeout??((a,n)=>setTimeout(a,n)),this.clear_=t.clearTimeout??(a=>clearTimeout(a))}want(t){if(this.gaveUp.has(t)||this.timers.has(t)||this.flying.has(t))return;const a=this.asked.get(t)??0;this.schedule(t,a===0?Ie:L(a-1))}cancel(t){const a=this.timers.get(t);a!==void 0&&this.clear_(a),this.timers.delete(t)}prune(t){for(const a of[...this.timers.keys()])t.has(a)||this.cancel(a);for(const a of[...this.asked.keys()])t.has(a)||this.asked.delete(a);for(const a of[...this.gaveUp])t.has(a)||this.gaveUp.delete(a)}stop(){for(const t of this.timers.values())this.clear_(t);this.timers.clear()}requests(t){return this.asked.get(t)??0}schedule(t,a){this.timers.has(t)||this.timers.set(t,this.set(()=>void this.run(t),a))}async run(t){if(this.timers.delete(t),!this.o.alive(t))return;if(this.flying.size>=Re){this.schedule(t,Se);return}const a=(this.asked.get(t)??0)+1;this.asked.set(t,a),this.flying.add(t);let n;try{n=await this.o.poll(t)}finally{this.flying.delete(t)}if(n==="pending"){a<Te?this.schedule(t,L(a-1)):this.gaveUp.add(t);return}this.o.done(t,n)}}function De(e){return e==="critical"?"error":e==="alert"?"stale":"neutral"}var We=Object.defineProperty,Ne=Object.getOwnPropertyDescriptor,h=(e,t,a,n)=>{for(var w=n>1?void 0:n?Ne(t,a):t,o=e.length-1,i;o>=0;o--)(i=e[o])&&(w=(n?i(t,a,w):i(w))||w);return n&&w&&We(t,a,w),w};const V="(max-width: 767px)",F="(min-width: 1280px)",P="font-weight:var(--sw-fw-semibold);font-size:var(--sw-fs-md);color:var(--sw-heading);display:inline-flex;align-items:center;gap:7px",f="color:var(--sw-text-3);font-size:var(--sw-fs-xs);line-height:1.4",q="font-weight:var(--sw-fw-semibold);font-size:var(--sw-fs-md);font-variant-numeric:tabular-nums;color:var(--sw-heading)",A="inline-size:8px;block-size:8px;border-radius:50%;flex:none;background:",Me="display:inline-flex;align-items:center;gap:4px;color:var(--sw-accent-text);font-size:var(--sw-fs-xs);font-weight:var(--sw-fw-semibold)",j="inline-size:88px;block-size:56px;border-radius:8px;display:block;background:var(--sw-surface-3)",U={alertstream:s("התראה מהמקליט"),recording:s("נגזר מקובץ הקלטה"),ha:s("חיישן התקן"),system:s("מערכת")},B={HA:s("מערכת הבית"),NVR:s("מקליט")},Ce={person:"var(--sw-tl-person)",vehicle:"var(--sw-tl-vehicle)",motion:"var(--sw-tl-motion)",line:"var(--sw-tl-line)",offline:"var(--sw-tl-offline)",door:"var(--sw-tl-door)"},Z={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking","מסדרון מזרחי":"corridor"},Oe={info:s("מידע"),alert:s("התראה"),critical:s("קריטי")};function k(e,t=!1){return r`<sw-badge ?filled=${t||e!=="info"} kind=${De(e)} label=${Oe[e]??e}></sw-badge>`}let c=class extends X{constructor(){super(...arguments),this.bubbleSkin=new Y(this),this.cameraId="",this.date="",this.initialMode="",this.selected=null,this.filter="all",this.cams=null,this.tz="Asia/Jerusalem",this.type="",this.events=null,this.ingest=null,this.live=!1,this.error="",this.busy=!1,this.thumbVersion=new Map,this.player=null,this.mode="raw",this.windows=null,this.windowGap=180,this.windowBy="camera",this.selectedWindow=null,this.windowsBusy=!1,this.spotlightOnly=!1,this.spotlightCount=0,this.showRaw=!1,this.ticked=new Set,this.facets=null,this.placeFloor="",this.placeZone="",this.source="",this.recorderId="",this.recorders=[],this.unsupported=[],this.q="",this.rangeDays=1,this.narrow=typeof window<"u"&&window.matchMedia(V).matches,this.dock=typeof window<"u"&&window.matchMedia(F).matches,this.now=Date.now(),this.techOpen=!1,this.clock=0,this.qTimer=0,this.reads=new ke,this.loadedFor=null,this.pushReloadTimer=0,this.thumbs=new Ee({poll:e=>ne(e),alive:e=>this.isConnected&&!!this.events?.some(t=>t.id===e),done:(e,t)=>this.setThumb(e,t),setTimeout:(e,t)=>window.setTimeout(e,t),clearTimeout:e=>window.clearTimeout(e)}),this.thumbWanted=new Set,this.onMedia=()=>{this.narrow=!!this.mqNarrow?.matches,this.dock=!!this.mqDock?.matches},this.onKey=e=>{const t=e.composedPath(),a=(e.key==="ArrowDown"||e.key==="ArrowUp")&&t.some(i=>i instanceof HTMLElement&&i.tagName==="SW-TABLE");if(this.narrow||e.altKey||e.ctrlKey||e.metaKey||e.defaultPrevented&&!a)return;const n=this.mode==="windows",w=n?this.selectedWindow:this.selected;if(!(!w||t.some(i=>i instanceof HTMLElement&&(i.tagName==="INPUT"||i.tagName==="SELECT"||i.tagName==="TEXTAREA"||i.isContentEditable)))){if(e.key==="Escape"){e.preventDefault(),n?this.closeWindowDrawer():this.closeDrawer();return}if(e.key==="ArrowDown"||e.key==="ArrowUp"){const i=n?(this.windows??[]).map(x=>x.id):(this.events??[]).map(x=>x.id),d=i.indexOf(w),u=i[e.key==="ArrowDown"?d+1:d-1];if(d<0||!u)return;e.preventDefault(),n?(this.selectedWindow=u,this.showRaw=!1,this.ticked=new Set):this.select(u),this.revealRow(u);return}if(e.key==="Enter"){if(t.some(i=>i instanceof HTMLElement&&(i.tagName==="BUTTON"||i.tagName==="A"||i.tagName==="SW-BUTTON"||i.tagName==="SUMMARY")))return;if(e.preventDefault(),n){const i=this.windows?.find(d=>d.id===w);i&&$(`/investigate/events/${i.first_event_id}`)}else $(`/investigate/events/${w}`)}}},this.rowPreview=null,this.rowPreviewTimer=0,this.windowColumns=[{key:"thumb",label:"",width:"104px",render:e=>this.renderWindowThumb(e)},{key:"title",label:s("חלון אירוע"),render:e=>{const t=e;return r`<span style=${P}><i style=${`${A}${T[t.dominant_type]??"var(--sw-tl-offline)"}`}></i>${m[t.dominant_type]??t.dominant_type}${t.count>1?r`<span style=${f}>×${String(t.count)}</span>`:l}</span><div style=${f}>${Object.entries(t.types).map(([a,n])=>`${m[a]??a} ${n}`).join(" · ")} · ${t.confidence==="inferred"?s("נגזר מהקלטה"):s("התראות מהמקליט")}</div>`}},{key:"spotlight",label:s("זרקור"),width:"150px",render:e=>{const t=e,a=t.spotlight;return a?.on?r`<span style=${Me} data-window-spotlight title=${a.rules.map(n=>n.why).join(" · ")}><sw-icon name="target" size=${12}></sw-icon>${a.rules.map(n=>n.label).join(" · ")}</span>`:t.manual_group_id?r`<span style=${f} data-window-manual>${s("קיבוץ ידני")}</span>`:l}},{key:"camera_name",label:s("מצלמה / קבוצה"),render:e=>{const t=e;return r`${t.camera_name??(t.channel?s("ערוץ {n}",{n:t.channel}):s("מערכת"))}${t.group&&t.group!=="camera"&&t.group!=="manual"&&t.camera_names?.length?r`<div style=${f}>${t.camera_names.join(" · ")}</div>`:l}`}},{key:"start",label:s("זמן"),render:e=>{const t=e;return r`<span style=${q}>${this.fmt(t.start)}${t.end!==t.start?r` – ${this.fmt(t.end)}`:l}</span><div style=${f}>${this.fmtDate(t.start)}</div>`}},{key:"acked",label:s("מצב"),render:e=>{const t=e;return r`<sw-badge kind=${t.acked?"live":t.acked_count?"stale":"neutral"} label=${t.acked?s("טופל"):t.acked_count?s("בטיפול {n}/{total}",{n:t.acked_count,total:t.count}):s("חדש")}></sw-badge>`}}],this.apiColumns=[{key:"thumb",label:"",width:"80px",render:e=>this.renderThumb(e)},{key:"type",label:s("אירוע"),render:e=>{const t=e;return r`<span style=${P} title=${s("קוד המכשיר: {code}",{code:t.raw_type})} data-raw-type=${t.raw_type}><i style=${`${A}${T[t.type]??"var(--sw-tl-offline)"}`}></i>${this.kindLabel(t)}${t.count>1?r`<span style=${f}>×${t.count}</span>`:l}</span><div style=${f}>${U[t.source]??t.source}${t.confidence==="inferred"&&t.source!=="recording"?` · ${s("נגזר")}`:""}</div>`}},{key:"camera_name",label:s("מצלמה"),render:e=>{const t=e;return r`<span style="color:var(--sw-text)">${this.camLabel(t)}</span>${t.camera_name&&t.channel?r`<div style=${f}>${s("ערוץ {n}",{n:t.channel})}</div>`:l}`}},{key:"occurred_at",label:s("זמן"),width:"190px",render:e=>{const t=e,a=C(t.occurred_at,t.ended_at);return r`<span style=${q}>${this.fmt(t.occurred_at)}</span><div style=${f}>${this.ago(t.occurred_at)} · ${this.fmtDate(t.occurred_at)}${a?` · ${a}`:""}</div>`}},{key:"severity",label:s("חומרה"),width:"96px",render:e=>k(String(e.severity))},{key:"acked_at",label:s("טיפול"),width:"140px",render:e=>{const t=e;return t.acked_at?r`<span style="color:var(--sw-text-2)">${s("טופל")}</span><div style=${f}>${t.acked_by_username??""}${t.acked_by_username?" · ":""}${this.fmt(t.acked_at)}</div>`:r`<span style="color:var(--sw-warning-text);font-weight:var(--sw-fw-semibold)" data-pending>${s("ממתין")}</span>`}}],this.columns=[{key:"thumb",label:"",width:"104px",render:e=>e.type==="offline"||e.type==="door"?r`<div class="thumb none" style="inline-size:88px;block-size:56px;border-radius:8px;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)"><sw-icon name=${e.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:r`<sw-scene class="thumb" style="display:block;inline-size:88px;block-size:56px;border-radius:8px;overflow:hidden;box-shadow:var(--sw-shadow-thumb)" kind=${Z[String(e.camera)]??"lobby"}></sw-scene>`},{key:"title",label:s("אירוע"),render:e=>r`<span class="ty" style="--tone:${Ce[e.type]}"><i></i>${R[e.type]}</span><div class="sub">${String(e.title)} · ${e.acked?s("טופל"):r`<span style="color:var(--sw-warning-text);font-weight:var(--sw-fw-semibold)">${s("ממתין לטיפול")}</span>`}</div>`},{key:"camera",label:s("מצלמה"),render:e=>r`${String(e.camera)}<div class="sub">${String(e.floor)}</div>`},{key:"time",label:s("זמן"),render:e=>r`<span style="font-weight:700;font-size:var(--sw-fs-md);font-variant-numeric:tabular-nums;color:var(--sw-heading)">${String(e.time)}</span><div class="sub">${B[String(e.source)]??String(e.source)}</div>`},{key:"severity",label:s("חומרה"),render:e=>k(String(e.severity),!0)},{key:"more",label:"",width:"40px",render:()=>r`<sw-button variant="ghost" size="sm" iconOnly icon="more" label=${s("עוד")}></sw-button>`}]}connectedCallback(){super.connectedCallback(),this.mqNarrow=window.matchMedia(V),this.mqDock=window.matchMedia(F),this.mqNarrow.addEventListener("change",this.onMedia),this.mqDock.addEventListener("change",this.onMedia),this.onMedia(),window.addEventListener("keydown",this.onKey),this.clock=window.setInterval(()=>{this.now=Date.now(),this.renderRoot.querySelector(".stage sw-table")?.requestUpdate?.()},3e4);try{this.techOpen=localStorage.getItem("sw.events.tech")==="1"}catch{}_()&&(this.init(),this.unsubscribe=oe(e=>this.onPushed(e),(e,t)=>{this.live=t,e&&(this.ingest=e)}))}disconnectedCallback(){super.disconnectedCallback(),this.mqNarrow?.removeEventListener("change",this.onMedia),this.mqDock?.removeEventListener("change",this.onMedia),window.removeEventListener("keydown",this.onKey),window.clearInterval(this.clock),this.unsubscribe?.(),this.thumbs.stop(),this.thumbWanted.clear(),window.clearTimeout(this.qTimer),window.clearTimeout(this.rowPreviewTimer),window.clearTimeout(this.pushReloadTimer),this.reads.cancel(),this.stopPlayer()}willUpdate(e){!(e.has("cameraId")||e.has("date"))||!this.loadedFor||!_()||(this.loadedFor.cameraId!==this.cameraId||this.loadedFor.date!==this.date)&&this.load()}onRowSelect(e){const t=this.mode==="windows";if(e.key==="Enter"&&!this.narrow&&e.id===(t?this.selectedWindow:this.selected)){const a=t?this.windows?.find(n=>n.id===e.id)?.first_event_id:e.id;a&&$(`/investigate/events/${a}`);return}t?this.selectedWindow=e.id:this.select(e.id)}async revealRow(e){await this.updateComplete;const t=this.renderRoot.querySelector(".stage sw-table");await t?.updateComplete;const a=t?.shadowRoot?.querySelector(`tr[data-row-id="${CSS.escape(e)}"]`);a&&(a.style.scrollMarginBlock="48px 12px",a.scrollIntoView({block:"nearest"}),t?.shadowRoot?.activeElement?.matches("tr[data-row-id]")&&a.focus({preventScroll:!0}))}closeWindowDrawer(){this.selectedWindow=null,this.showRaw=!1,this.ticked=new Set}ago(e){const t=this.now-new Date(e).getTime();if(!Number.isFinite(t))return"";if(t<6e4)return s("עכשיו");const a=Math.floor(t/6e4);if(a<60)return s("לפני {n} דק׳",{n:a});const n=Math.floor(a/60);if(n<24)return s("לפני {n} שע׳",{n});const w=Math.floor(n/24);return w===1?s("אתמול"):s("לפני {n} ימים",{n:w})}kindLabel(e){return ve(e.raw_type)??m[e.type]??e.type}camLabel(e){return e.camera_name??(e.channel?s("ערוץ {n}",{n:e.channel}):s("מערכת"))}hoverStart(e,t){if(!e.camera_id||t.pointerType==="touch")return;window.clearTimeout(this.rowPreviewTimer);const a=t.clientX,n=t.clientY;this.rowPreviewTimer=window.setTimeout(()=>{const w=new Date(e.occurred_at).getTime(),o=[-5,0,5].map(i=>{const d=E(w+i*1e3);return{at:d,url:ue(e.camera_id,d),label:i===0?this.fmt(e.occurred_at):s("{n} ש׳",{n:`${i>0?"+":""}${i}`}),failed:!1}});this.rowPreview={id:e.id,x:a,y:n,frames:o,camera:e.camera_name??""}},250)}hoverEnd(){window.clearTimeout(this.rowPreviewTimer),this.rowPreview=null}renderRowPreview(){const e=this.rowPreview;if(!e)return l;const t=Math.max(16,Math.min(window.innerWidth-388,e.x-186)),a=e.y+18+230>window.innerHeight?e.y-18-230:e.y+18;return r`<div class="rowpreview" data-row-preview style="left:${t}px;top:${a}px">
      <div class="strip">
        ${e.frames.map((n,w)=>r`<div class="cell ${w===1?"main":""}">
          ${n.failed?r`<span>${s("אין פריים")}</span>`:r`<img src=${n.url} alt="" @error=${()=>{n.failed=!0,this.rowPreview={...e}}} />`}
          <span class="t">${n.label}</span>
        </div>`)}
      </div>
      <div class="cap"><span>${e.camera}</span><span>${s("פריימים מההקלטה · 5 שניות לפני ואחרי")}</span></div>
    </div>`}renderThumb(e){const t="inline-size:64px;block-size:40px;border-radius:6px;overflow:hidden;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)";return e.thumbnail==="ready"?r`<img class="thumb" src=${I(e.id,this.thumbVersion.get(e.id)??0)} alt="" loading="lazy" data-thumb=${e.id} style="inline-size:64px;block-size:40px;object-fit:cover;border-radius:6px;display:block;background:var(--sw-surface-3);cursor:zoom-in" />`:(e.thumbnail==="pending"||e.thumbnail==="none")&&e.camera_id?(this.wantThumb(e.id),r`<div class="thumb pending" style=${t} title=${s("מכין תמונה מההקלטה…")}><sw-icon name="camera" size=${14} style="opacity:.45"></sw-icon></div>`):r`<div class="thumb none" style=${t}><sw-icon name=${e.type==="offline"||e.type==="coverage_gap"?"offline":e.type==="person"?"user":e.type==="vehicle"?"route":e.type==="door"||e.type==="io"?"door":"bell"} size=${14}></sw-icon></div>`}async ackAll(){const e=(this.events??[]).filter(t=>!t.acked_at).map(t=>t.id);if(!(!e.length||this.busy)){this.busy=!0;try{for(let t=0;t<e.length;t+=500)await W(e.slice(t,t+500));await this.load()}catch(t){this.error=v(t)}finally{this.busy=!1}}}wantThumb(e){this.thumbWanted.size||queueMicrotask(()=>{const t=[...this.thumbWanted];if(this.thumbWanted.clear(),this.isConnected)for(const a of t)this.thumbs.want(a)}),this.thumbWanted.add(e)}setThumb(e,t){t==="ready"&&(this.thumbVersion=new Map(this.thumbVersion).set(e,Date.now())),this.events=(this.events??[]).map(a=>a.id===e?{...a,thumbnail:t}:a)}select(e){e!==this.player?.eventId&&this.stopPlayer(),this.selected=e}closeDrawer(){this.select(null)}async play(e){if(this.player?.eventId===e.id){await this.stopPlayer();return}if(await this.stopPlayer(),!!e.camera_id){this.player={eventId:e.id,session:null,error:""};try{const t=E(new Date(e.occurred_at).getTime()-2e3),a=await me(e.camera_id,t);this.player?.eventId===e.id?this.player={eventId:e.id,session:a,error:""}:await M(a.id).catch(()=>{})}catch(t){this.player={eventId:e.id,session:null,error:v(t)}}}}async stopPlayer(){const e=this.player;this.player=null,e?.session&&await M(e.session.id).catch(()=>{})}async init(){try{try{localStorage.getItem("sw.events.mode")==="windows"&&(this.mode="windows")}catch{}(this.initialMode==="windows"||this.initialMode==="raw")&&(this.mode=this.initialMode);const[e,t]=await Promise.all([J(),Q()]);this.tz=e["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras,this.recorders=t.recorders??[],this.loadFacets(),this.date||(this.date=b(new Date,this.tz)),await this.load()}catch(e){this.error=v(e)}}async loadFacets(){try{this.facets=await de()}catch{this.facets=null}}get facetFloors(){const e=this.facets;return e?e.places.flatMap(t=>t.buildings.flatMap(a=>a.floors.map(n=>({...n,name:`${a.name} · ${n.name}`})))):[]}searchWindow(){if(this.rangeDays<=1)return{date:this.date||void 0};const e=new Date(`${this.date||b(new Date,this.tz)}T23:59:59.999Z`),t=new Date(e.getTime()-(this.rangeDays-1)*864e5);return t.setUTCHours(0,0,0,0),{from:t.toISOString(),to:e.toISOString()}}async load(){const e=this.reads.begin();this.loadedFor={cameraId:this.cameraId,date:this.date},window.clearTimeout(this.pushReloadTimer);try{const t=await le({...this.searchWindow(),cameraId:this.cameraId||void 0,type:this.type||void 0,unacked:this.filter==="unacked",acked:this.filter==="acked",limit:500,floorId:this.placeFloor||void 0,zoneId:this.placeZone||void 0,source:this.source||void 0,query:this.q.trim()||void 0,recorderId:this.recorderId||void 0});if(!e())return;this.events=t.events,this.thumbs.prune(new Set(t.events.map(a=>a.id))),this.unsupported=t.filters?.unsupported??[],this.ingest=t.ingest,this.error="",this.mode==="windows"&&await this.loadWindows()}catch(t){if(!e())return;this.error=v(t)}}onSearchInput(e){this.q=e,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>void this.load(),350)}setRange(e){this.rangeDays=e,this.load()}async loadWindows(){this.windowsBusy=!0;try{const e=await ce({date:this.date||void 0,cameraId:this.cameraId||void 0,gap:this.windowGap,by:this.windowBy,limit:300,spotlight:this.spotlightOnly});this.windows=e.windows,this.spotlightCount=e.spotlights??e.windows.filter(t=>t.spotlight?.on).length,this.selectedWindow&&!e.windows.some(t=>t.id===this.selectedWindow)&&(this.selectedWindow=null)}catch(e){this.error=v(e),this.windows=[]}finally{this.windowsBusy=!1}}setMode(e){this.mode=e,this.select(null),this.selectedWindow=null;try{localStorage.setItem("sw.events.mode",e)}catch{}e==="windows"&&this.windows===null&&this.loadWindows()}async ackWindow(e){this.busy=!0;try{const t=await W(e.event_ids),a=new Set(t.acked);this.events=(this.events??[]).map(n=>a.has(n.id)&&!n.acked_at?{...n,acked_at:new Date().toISOString(),acked_by_username:s("אני")}:n),await this.loadWindows()}catch(t){this.error=v(t)}finally{this.busy=!1}}windowTitle(e){const t=e.camera_name??(e.channel?s("ערוץ {n}",{n:e.channel}):s("מערכת"));return`${m[e.dominant_type]??e.dominant_type} · ${t}`}neighbourWindow(e,t){const a=this.windows??[],n=a.findIndex(o=>o.id===e.id);if(n<0)return null;const w=o=>!o.manual_group_id&&!e.manual_group_id&&o.camera_id===e.camera_id&&o.group_label===e.group_label&&o.group===e.group;for(let o=t==="older"?n+1:n-1;o>=0&&o<a.length;o+=t==="older"?1:-1)if(w(a[o]))return a[o];return null}async regroup(e,t){this.busy=!0;try{await he(e,t),this.ticked=new Set,this.selectedWindow=null,this.showRaw=!1,await this.loadWindows()}catch(a){this.error=v(a)}finally{this.busy=!1}}async dissolve(e){if(e.manual_group_id){this.busy=!0;try{await pe(e.manual_group_id),this.selectedWindow=null,this.showRaw=!1,await this.loadWindows()}catch(t){this.error=v(t)}finally{this.busy=!1}}}tick(e,t){const a=new Set(this.ticked);t?a.add(e):a.delete(e),this.ticked=a}renderWindowThumb(e){return e.thumbnail==="ready"?r`<img class="thumb" src=${I(e.thumbnail_event_id,this.thumbVersion.get(e.thumbnail_event_id)??0)} alt="" loading="lazy" style=${`${j};object-fit:cover`} />`:r`<div style=${`${j};display:grid;place-items:center;color:var(--sw-text-3)`}><sw-icon name=${e.camera_id?"image":"info"} size=${14}></sw-icon></div>`}renderWindowDrawer(e){const t=(this.events??[]).filter(d=>e.event_ids.includes(d.id)),a=e.spotlight,n=[...this.ticked].filter(d=>e.event_ids.includes(d)),w=this.neighbourWindow(e,"older"),o=this.neighbourWindow(e,"newer"),i=e.camera_names?.length?e.camera_names.join(" · "):e.camera_name??"";return r`<sw-drawer open class="evdrawer" ?modal=${this.narrow} heading=${this.windowTitle(e)} subheading=${`${this.fmtDate(e.start)} · ${this.fmt(e.start)} – ${this.fmt(e.end)} · ${s("{n} אירועים",{n:e.count})}`} @close=${()=>this.closeWindowDrawer()}>
      <div class="wsum" data-window-summary>
        ${k(e.severity)}
        <sw-badge kind=${e.confidence==="measured"?"recorded":"unknown"} label=${e.confidence==="measured"?s("נמדד"):s("נגזר מהקלטה")}></sw-badge>
        ${a?.sources?.length?r`<span class="sub">${a.sources.map(d=>y[d]??d).join(" · ")}</span>`:l}
        ${i?r`<span class="sub">${i}</span>`:l}
        ${e.manual_group_id?r`<sw-badge kind="partial" label=${s("קיבוץ ידני")} data-window-manual-badge></sw-badge>`:l}
      </div>
      ${a?.on?r`<ul class="rules" data-spotlight-rules>${a.rules.map(d=>r`<li><span class="spot"><sw-icon name="target" size=${12}></sw-icon>${d.label}</span><span class="why">${d.why}</span></li>`)}</ul>`:r`<div class="sub" style="margin-block-end:8px" data-spotlight-none>${s("ללא זרקור:")} ${Object.entries(e.types).map(([d,u])=>`${m[d]??d} ${u}`).join(" · ")}</div>`}
      <sw-button size="sm" variant="ghost" icon=${this.showRaw?"chevron":"list"} data-window-raw-toggle aria-expanded=${this.showRaw} @click=${()=>this.showRaw=!this.showRaw}>${this.showRaw?s("הסתר את האירועים"):s("{n} אירועים מקוריים",{n:e.count})}</sw-button>
      ${this.showRaw?r`<div class="wlist" data-window-events>
            ${t.map(d=>r`<a class="wrow ${e.count>1?"tick":""}" href=${`#/investigate/events/${d.id}`}>${e.count>1?r`<input type="checkbox" aria-label=${s("בחר אירוע לפיצול")} data-window-tick=${d.id} .checked=${this.ticked.has(d.id)} @click=${u=>u.stopPropagation()} @change=${u=>this.tick(d.id,u.target.checked)} />`:l}<span class="ty" style="--tone:${T[d.type]??"var(--sw-tl-offline)"}"><i></i>${m[d.type]??d.type}</span><span class="ltr">${this.fmt(d.occurred_at)}</span><span class="sub">${d.acked_at?s("טופל"):s("ממתין")}</span></a>`)}
            ${t.length<e.count?r`<div class="sub">${s("{n} אירועים נוספים אינם בסינון הנוכחי.",{n:e.count-t.length})}</div>`:l}
          </div>
          <div class="wfix" data-window-fix>
            ${e.count>1?r`<sw-button size="sm" icon="move" ?disabled=${!n.length||n.length>=e.count||this.busy} data-window-split @click=${()=>this.regroup(n,"פוצל מחלון")}>${s("הפרד לחלון נפרד")}${n.length?` (${n.length})`:""}</sw-button>`:l}
            ${w?r`<sw-button size="sm" icon="layers" ?disabled=${this.busy} data-window-join-older @click=${()=>this.regroup([...e.event_ids,...w.event_ids],"אוחד עם החלון הקודם")}>${s("אחד עם הקודם ({time})",{time:this.fmt(w.start)})}</sw-button>`:l}
            ${o?r`<sw-button size="sm" icon="layers" ?disabled=${this.busy} data-window-join-newer @click=${()=>this.regroup([...e.event_ids,...o.event_ids],"אוחד עם החלון הבא")}>${s("אחד עם הבא ({time})",{time:this.fmt(o.start)})}</sw-button>`:l}
            ${e.manual_group_id?r`<sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.busy} data-window-ungroup @click=${()=>this.dissolve(e)}>${s("בטל קיבוץ ידני")}</sw-button>`:l}
          </div>`:l}
      <div slot="footer" class="acts">
        <sw-button variant="primary" size="sm" ?block=${this.narrow} icon="expand" data-review-window @click=${()=>$(`/investigate/events/${e.first_event_id}`)}>${s("סקירה מלאה")}</sw-button>
        <sw-button size="sm" ?block=${this.narrow} icon="check" ?disabled=${e.acked||this.busy} @click=${()=>this.ackWindow(e)}>${e.acked?s("טופל"):s("סמן הכל כטופל")}</sw-button>
        ${this.renderKeys()}
      </div>
    </sw-drawer>`}onPushed(e){if(!this.events)return;const t=this.cams?.find(o=>o.id===e.camera_id),a=this.events.findIndex(o=>o.id===e.id),n=ze(e,{date:this.date,cameraId:this.cameraId,recorderId:this.recorderId,type:this.type,source:this.source,filter:this.filter,placeFloor:this.placeFloor,placeZone:this.placeZone,q:this.q},{day:b(new Date(e.occurred_at),this.tz),cameraRecorder:t?.recorder_id??null,known:a>=0});if(n==="drop")return;if(n==="reload"){window.clearTimeout(this.pushReloadTimer),this.pushReloadTimer=window.setTimeout(()=>void this.load(),1e3);return}const w={...e,camera_name:e.camera_name??t?.name??null};(e.thumbnail==="ready"||e.thumbnail==="unavailable")&&(this.thumbs.cancel(e.id),e.thumbnail==="ready"&&(this.thumbVersion=new Map(this.thumbVersion).set(e.id,Date.now()))),this.events=a>=0?this.events.map((o,i)=>i===a?{...o,...w}:o):[w,...this.events]}fmt(e){return ee(new Date(e),{timeZone:this.tz,seconds:!0})}fmtDate(e){return te(new Date(e),{timeZone:this.tz})}async ack(e){this.busy=!0;try{const t=await we(e.id);this.events=(this.events??[]).map(a=>a.id===e.id?{...a,...t}:a)}catch(t){this.error=v(t)}finally{this.busy=!1}}renderApi(){if(this.error&&!this.events)return r`<sw-state-panel state="error" hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>this.init()}></sw-state-panel>`;if(!this.events)return r`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.events.find(i=>i.id===this.selected)??null,t=this.ingest,a=this.events.filter(i=>!i.acked_at).length,n=!!(t?.connected&&this.facets&&!this.facets.sources.some(i=>i.source==="alertstream")),w=!!t&&!t.connected,o=this.activeFilters();return r`
      ${w?r`<div class="banner warn" data-ingest-down><span class="dot"></span><span>${s("הקליטה מהמקליט מנותקת")}${t.last_error?` (${O(t.last_error)})`:""} · ${s("אירועים חדשים לא יגיעו עד שהחיבור יחזור")}</span></div>`:l}
      <div class="kpis" data-kpis>
        <div class="kpi ${a?"hot":""}"><div><div class="n">${a}</div><div class="l">${s("לבדיקה")}</div></div><div class="ic"><sw-icon name="bell" size=${18}></sw-icon></div></div>
        <div class="kpi"><div><div class="n">${this.events.length-a}</div><div class="l">${s("טופלו היום")}</div></div><div class="ic"><sw-icon name="check" size=${18}></sw-icon></div></div>
      </div>
      <div class="fbar" data-filter-bar>
      <div class="filters">
        <sw-field class="q"><input type="search" data-events-q placeholder=${s("חיפוש: מצלמה, התקן, פרטי אירוע")} aria-label=${s("חיפוש חופשי")} .value=${this.q} @input=${i=>this.onSearchInput(i.target.value)} /></sw-field>
        ${this.recorders.length>1?r`<sw-field><select aria-label=${z("videoCopy.recorder")} data-filter-recorder @change=${i=>{this.recorderId=i.target.value,this.cameraId="",this.load()}}><option value="" ?selected=${!this.recorderId}>${z("videoCopy.recorderAll")}</option>${this.recorders.map(i=>r`<option value=${i.id} ?selected=${i.id===this.recorderId}>${i.name}</option>`)}</select></sw-field>`:l}
        <sw-field><select aria-label=${s("מצלמה")} @change=${i=>{this.cameraId=i.target.value,this.load()}}><option value="" ?selected=${!this.cameraId}>${s("כל המצלמות")}</option>${(this.cams??[]).filter(i=>!this.recorderId||i.recorder_id===this.recorderId).map(i=>r`<option value=${i.id} ?selected=${i.id===this.cameraId}>${i.name}</option>`)}</select></sw-field>
        <sw-field><select aria-label=${s("סוג")} @change=${i=>{this.type=i.target.value,this.load()}}><option value="" ?selected=${!this.type}>${s("כל סוגי האירועים")}</option>${Object.keys(m).map(i=>r`<option value=${i} ?selected=${i===this.type}>${m[i]}</option>`)}</select></sw-field>
        <sw-field><input type="date" lang=${D()} .value=${this.date} max=${b(new Date,this.tz)} data-ltr aria-label=${s("תאריך")} @change=${i=>{this.date=i.target.value,this.load()}} /></sw-field>
        <span class="rangepick" role="group" aria-label=${s("טווח ימים")} data-events-range>
          ${[[1,s("יום")],[7,s("7 ימים")],[30,s("30 יום")]].map(([i,d])=>r`<button class=${this.rangeDays===i?"on":""} data-events-range-set=${i} @click=${()=>this.setRange(i)}>${d}</button>`)}
        </span>
        <sw-field><select aria-label=${s("מקום")} data-filter-floor @change=${i=>{this.placeFloor=i.target.value,this.placeZone="",this.load()}}><option value="" ?selected=${!this.placeFloor}>${s("כל המקומות")}</option>${this.facetFloors.map(i=>r`<option value=${i.id} ?selected=${i.id===this.placeFloor}>${i.name} · ${s("{n} מצלמות",{n:i.cameras})}${i.sensors?` · ${s("{n} חיישנים",{n:i.sensors})}`:""}</option>`)}</select></sw-field>
        ${this.placeFloor&&this.facetFloors.find(i=>i.id===this.placeFloor)?.zones.length?r`<sw-field><select aria-label=${s("חדר / אזור")} data-filter-zone @change=${i=>{this.placeZone=i.target.value,this.load()}}><option value="" ?selected=${!this.placeZone}>${s("כל הקומה")}</option>${(this.facetFloors.find(i=>i.id===this.placeFloor)?.zones??[]).map(i=>r`<option value=${i.id} ?selected=${i.id===this.placeZone}>${i.name} · ${s("{n} מצלמות",{n:i.cameras})}${i.sensors?` · ${s("{n} חיישנים",{n:i.sensors})}`:""}</option>`)}</select></sw-field>`:l}
        <sw-field><select aria-label=${s("מקור")} data-filter-source @change=${i=>{this.source=i.target.value,this.load()}}><option value="" ?selected=${!this.source}>${s("כל המקורות")}</option>${Object.entries(y).map(([i,d])=>r`<option value=${i} ?selected=${i===this.source}>${d}</option>`)}</select></sw-field>
      </div>
      <div class="tools">
        <sw-chip-choice class="evc" label=${s("מצב טיפול")} value=${this.filter} data-events-ack-filter
          .options=${[{value:"all",label:s("הכל"),count:this.filter==="all"?this.events.length:void 0,attrs:{"data-ack-filter":"all"}},{value:"unacked",label:s("לבדיקה"),count:a,attrs:{"data-ack-filter":"unacked"}},{value:"acked",label:s("טופלו"),attrs:{"data-ack-filter":"acked"}}]}
          @change=${i=>{i.stopPropagation(),this.filter=i.detail.value,this.load()}}></sw-chip-choice>
        <sw-chip-choice class="evc" label=${s("תצוגה")} value=${this.mode} data-events-view
          .options=${[{value:"raw",label:s("אירועים"),icon:r`<sw-icon name="list" size=${13}></sw-icon>`,attrs:{"data-mode-raw":""}},{value:"windows",label:s("חלונות"),icon:r`<sw-icon name="layers" size=${13}></sw-icon>`,count:this.windows?.length,attrs:{"data-mode-windows":""}}]}
          @change=${i=>{i.stopPropagation(),this.setMode(i.detail.value)}}></sw-chip-choice>
        ${o.length?r`<span class="active" data-active-filters>
              ${o.map(i=>r`<button type="button" class="fchip" data-active-filter=${i.key} aria-label=${s("הסר מסנן: {label}",{label:i.label})} @click=${i.clear}><span>${i.label}</span><sw-icon name="close" size=${12}></sw-icon></button>`)}
              <button type="button" class="reset" data-filter-reset @click=${()=>this.resetFilters()}>${s("איפוס")}</button>
            </span>`:l}
        <span class="grow"></span>
        <sw-button size="sm" icon="check" ?disabled=${!a||this.busy} data-ack-all title=${s("מסמן כטופלו את כל האירועים ברשימה שעדיין לבדיקה (לפי הסינון הנוכחי)")} @click=${()=>this.ackAll()}>${s("סמן הכול כטופל ({n})",{n:a})}</sw-button>
      </div>
      </div>
      ${this.renderTech(n)}
      ${this.unsupported.length?r`<div class="banner warn" data-unsupported>${s('המסנן אינו נתמך כאן, לא "אין תוצאות":')} ${this.unsupported.map(i=>i.reason).join(" · ")}</div>`:l}
      ${this.error?r`<div class="banner warn" role="alert">${this.error}</div>`:l}
      <div class="stage ${(e||this.mode==="windows"&&this.selectedWindow)&&this.dock?"docked":""}">
        ${this.mode==="windows"?this.windows===null||this.windowsBusy&&!this.windows.length?r`<sw-state-panel state="loading"></sw-state-panel>`:this.windows.length?r`<div class="banner" style="margin-block-end:8px"><sw-icon name="info" size=${14}></sw-icon><span>${s("{what} הופכות לחלון אירוע אחד (מרווח עד {n} דק׳). האירועים המקוריים נשמרים לצפייה.",{what:this.windowBy==="camera"?s("התראות סמוכות באותה מצלמה"):this.windowBy==="all"?s("התראות סמוכות מכל המצלמות"):this.windowBy==="zone"?s("התראות סמוכות באותו חדר"):s("התראות סמוכות באותה קומה"),n:Math.round(this.windowGap/60)})}</span><span class="grow"></span>
                  <sw-chip icon="target" ?selected=${this.spotlightOnly} data-window-spotlight-only count=${this.spotlightCount} @click=${()=>{this.spotlightOnly=!this.spotlightOnly,this.loadWindows()}}>${s("זרקורים")}</sw-chip>
                  <sw-field><select aria-label=${s("קיבוץ")} data-window-by @change=${i=>{this.windowBy=i.target.value,this.loadWindows()}}>${Object.keys(N).map(i=>r`<option value=${i} ?selected=${this.windowBy===i}>${N[i]}</option>`)}</select></sw-field>
                  <sw-field><select aria-label=${s("מרווח קיבוץ")} data-window-gap @change=${i=>{this.windowGap=Number(i.target.value),this.loadWindows()}}>${[60,180,300,600,900,1800,3600].map(i=>r`<option value=${i} ?selected=${this.windowGap===i}>${s("{n} דק׳",{n:i/60})}</option>`)}</select></sw-field></div>
                <sw-table .columns=${this.windowColumns} .rows=${this.windows} .selected=${this.selectedWindow} @row-select=${i=>this.onRowSelect(i.detail)}></sw-table>`:this.spotlightOnly?r`<sw-state-panel icon="history" state="empty" heading=${s("אין זרקורים ביום הזה")}><div style="margin-block-start:10px"><sw-button size="sm" data-window-spotlight-off @click=${()=>{this.spotlightOnly=!1,this.loadWindows()}}>${s("כל החלונות")}</sw-button></div></sw-state-panel>`:r`<sw-state-panel icon="history" state="empty" heading=${s("אין חלונות אירוע ביום הזה")} hint=${s("חלון נוצר מאירועים סמוכים של אותה מצלמה.")}></sw-state-panel>`:this.events.length?r`<sw-table .columns=${this.apiColumns} .rows=${this.events} .selected=${this.selected} @row-hover=${i=>{const d=this.events?.find(u=>u.id===i.detail.id);d&&this.hoverStart(d,i.detail)}} @row-leave=${()=>this.hoverEnd()} @row-select=${i=>this.onRowSelect(i.detail)}></sw-table>`:r`<sw-state-panel icon="history" state="empty" heading=${s("אין אירועים ביום הזה")} hint=${s("התראות מגיעות מהמקליט רק כשהטריגר מוגדר עם 'Notify Surveillance Center'; אירועי תנועה נגזרים מקובצי ההקלטה בהפעלה ובכל 10 דקות.")}></sw-state-panel>`}
        ${this.renderRowPreview()}
        ${this.mode==="windows"&&this.selectedWindow&&this.windows?(()=>{const i=this.windows.find(d=>d.id===this.selectedWindow);return i?this.renderWindowDrawer(i):l})():l}
        ${e?this.renderEventDrawer(e):l}
      </div>
    `}renderEventDrawer(e){const t=typeof e.details.description=="string"?e.details.description.trim():"",a=$e(t),n=this.kindLabel(e),w=C(e.occurred_at,e.ended_at),o=typeof e.details.time_precision=="string"?e.details.time_precision:"",i=typeof e.details.device_time=="string"?e.details.device_time:"",d=typeof e.details.coalesced=="number"?e.details.coalesced:0;return r`<sw-drawer open class="evdrawer" ?modal=${this.narrow} heading=${n} subheading=${`${this.camLabel(e)} · ${this.fmt(e.occurred_at)} · ${this.ago(e.occurred_at)}`} @close=${()=>this.closeDrawer()}>
              <div class="chips" slot="sub" data-event-chips>
                ${k(e.severity)}
                <sw-badge kind=${e.acked_at?"live":"neutral"} label=${e.acked_at?s("טופל"):s("ממתין לטיפול")}></sw-badge>
              </div>
              <div class="big">
                ${this.player?.eventId===e.id&&this.player.session?r`<sw-live-player .wsUrl=${fe(this.player.session)} mode="mse" .retry=${!1}></sw-live-player>`:e.thumbnail==="ready"?r`<img src=${I(e.id,this.thumbVersion.get(e.id)??0)} alt=${s("תמונת האירוע מההקלטה")} />`:r`<div class="hint">${e.camera_id?e.thumbnail==="unavailable"?s("אין פריים זמין בהקלטה בזמן האירוע"):this.player?.eventId===e.id?s("פותח את ההקלטה…"):s("מכין תמונה מההקלטה…"):s("אירוע ללא מצלמה")}</div>`}
                ${this.player?.eventId===e.id&&this.player.error?r`<div class="err">${this.player.error}</div>`:l}
              </div>
              <dl class="r5-facts">
                <div class="wide"><dt>${s("זמן אירוע")}</dt><dd><span class="ltr">${this.fmtDate(e.occurred_at)} ${this.fmt(e.occurred_at)}</span>${e.ended_at?r` ${s("עד")} <span class="ltr">${this.fmt(e.ended_at)}</span>`:l}${w?r` <span class="r5-sub">· ${w}</span>`:l}</dd></div>
                <div><dt>${s("מצלמה")}</dt><dd>${this.camLabel(e)}</dd></div>
                <div><dt>${s("מקור")}</dt><dd>${U[e.source]??e.source}</dd></div>
                <div><dt>${s("ודאות")}</dt><dd>${e.confidence==="measured"?s("נמדד במכשיר"):s("נגזר מההקלטה")}</dd></div>
                <div><dt>${s("חזרות")}</dt><dd>${e.count} · ${e.state==="active"?s("פעיל"):e.state==="inactive"?s("הסתיים"):"—"}</dd></div>
                <div class="wide"><dt>${s("טיפול")}</dt><dd>${e.acked_at?r`${s("טופל")}${e.acked_by_username?` ${s("בידי {name}",{name:e.acked_by_username})}`:""} · <span class="ltr">${this.fmt(e.acked_at)}</span>`:s("ממתין לטיפול")}</dd></div>
                ${a&&a!==`התראת ${n}`?r`<div class="wide"><dt>${s("תיאור")}</dt><dd>${a}</dd></div>`:l}
                ${typeof e.details.seconds=="number"?r`<div><dt>${s("משך ההקלטה")}</dt><dd>${s("{n} שנ׳",{n:String(e.details.seconds)})}</dd></div>`:l}
              </dl>
              <details class="tech evtech" data-event-tech>
                <summary><sw-icon name="info" size=${14}></sw-icon><span>${s("פרטים טכניים")}</span><sw-icon class="chev" name="chevron" size=${14}></sw-icon></summary>
                <dl class="kv">
                  <dt>${s("קוד המכשיר")}</dt><dd class="ltr">${e.raw_type}</dd>
                  ${t?r`<dt>${s("טקסט המכשיר")}</dt><dd class="ltr">${t}</dd>`:l}
                  ${o?r`<dt>${s("דיוק הזמן")}</dt><dd>${be(o)??""} <span class="ltr mono">${o}</span></dd>`:l}
                  ${i?r`<dt>${s("שעון המכשיר")}</dt><dd class="ltr mono">${i}</dd>`:l}
                  <dt>${s("נקלט")}</dt><dd><span class="ltr">${this.fmtDate(e.received_at)} ${this.fmt(e.received_at)}</span></dd>
                  <dt>${s("מקור (מפתח)")}</dt><dd class="ltr mono">${e.source} · ${e.confidence}</dd>
                  ${e.recorder_id?r`<dt>${s("מקליט")}</dt><dd class="ltr mono">${e.recorder_id}${e.channel?` · ch ${e.channel}`:""}</dd>`:l}
                  ${d?r`<dt>${s("אוחדו")}</dt><dd>${s("{n} התראות קודמות",{n:d})}</dd>`:l}
                  <dt>${s("מזהה")}</dt><dd class="ltr mono">${e.id}</dd>
                </dl>
              </details>
              <div slot="footer" class="acts">
                <sw-button variant="primary" size="sm" ?block=${this.narrow} icon="expand" data-review @click=${()=>$(`/investigate/events/${e.id}`)}>${s("סקירה מלאה")}</sw-button>
                ${e.camera_id?r`<sw-button size="sm" ?block=${this.narrow} icon="play" data-play @click=${()=>this.play(e)}>${this.player?.eventId===e.id?s("עצור"):s("נגן כאן")}</sw-button>
                    <sw-button size="sm" ?block=${this.narrow} icon="history" data-to-recording @click=${()=>$("/investigate/playback",{camera:e.camera_id,t:e.occurred_at})}>${s("להקלטה")}</sw-button>`:l}
                <sw-button variant="ghost" size="sm" ?block=${this.narrow} icon="check" data-ack ?disabled=${!!e.acked_at||this.busy} @click=${()=>this.ack(e)}>${e.acked_at?s("טופל"):s("סמן טופל")}</sw-button>
                ${this.renderKeys()}
              </div>
            </sw-drawer>`}renderKeys(){return this.narrow?l:r`<span class="keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> ${s("מעבר")} · <kbd>Enter</kbd> ${s("סקירה")} · <kbd>Esc</kbd> ${s("סגירה")}</span>`}renderTech(e){const t=this.ingest,a=this.facets,n=a?a.unavailable_types.filter(o=>["person","vehicle","line","field","door"].includes(o.type)):[],w=t?t.connected?s("קליטה מחוברת"):s("קליטה מנותקת"):s("בודק את הקליטה…");return r`<details class="tech" data-tech-details ?open=${this.techOpen} @toggle=${o=>this.onTechToggle(o.target.open)}>
      <summary>
        <span class="dot ${t?.connected?"on":""}" aria-hidden="true"></span>
        <span data-ingest-line title=${t?.last_error??""}>${w}</span>
        <span class="sub">· ${s("עדכונים חיים {state}",{state:this.live?s("פעילים"):s("מתחברים…")})}</span>
        ${e?r`<span class="warnnote" data-no-alerts-flag><sw-icon name="warning" size=${13}></sw-icon>${s("המקליט לא שולח התראות")}</span>`:l}
        <span class="grow"></span>
        <span class="sub">${s("פרטים טכניים")}</span>
        <sw-icon class="chev" name="chevron" size=${14}></sw-icon>
      </summary>
      <div class="techbody">
        <div>${s("קליטה מהמקליט:")} ${t?t.connected?s("מחובר"):`${s("מנותק")}${t.last_error?` (${O(t.last_error)})`:""}`:"—"}${t?.last_heartbeat_at?` · ${s("פעימה אחרונה {time}",{time:this.fmt(t.last_heartbeat_at)})}`:""} · ${s("עדכונים חיים:")} ${this.live?s("פעיל"):s("מתחבר…")} · ${s("אזור זמן")} <span class="ltr">${this.tz}</span></div>
        <div>${s('אירועים "נגזר מהקלטה" הם עדות מקובץ ההקלטה, לא התראה שנמדדה במכשיר.')}</div>
        ${e?r`<div data-no-alerts class="warntext">${s('המקליט לא שלח התראות ב־{n} הימים האחרונים. כדי לקבל אותן: במקליט, בהגדרות הקישור (linkage) של זיהוי התנועה, להפעיל "Notify Surveillance Center".',{n:a.days})}</div>`:l}
        ${a?r`<div data-facets><strong>${s("שדות עם נתונים ({n} ימים):",{n:a.days})}</strong> ${a.types.map(o=>`${m[o.type]??o.type} (${o.count})`).join(" · ")||s("אין אירועים")} · <strong>${s("מקורות:")}</strong> ${a.sources.map(o=>`${y[o.source]??o.source} (${o.count})`).join(" · ")||"—"}
              ${n.length?r`<br /><strong>${s("לא זמין:")}</strong> ${n.map((o,i)=>r`${i?" · ":""}<span title=${o.reason}>${m[o.type]??o.type}</span>`)} <span class="sub">${s("(ריחוף מסביר למה)")}</span>`:l}
              ${a.notes.map(o=>r`<br />${o}`)}</div>`:l}
      </div>
    </details>`}onTechToggle(e){if(e!==this.techOpen){this.techOpen=e;try{localStorage.setItem("sw.events.tech",e?"1":"0")}catch{}}}activeFilters(){const e=[],t=()=>void this.load(),a=b(new Date,this.tz);return this.q.trim()&&e.push({key:"q",label:`"${this.q.trim()}"`,clear:()=>{this.q="",t()}}),this.recorderId&&e.push({key:"recorder",label:this.recorders.find(n=>n.id===this.recorderId)?.name??z("videoCopy.recorder"),clear:()=>{this.recorderId="",t()}}),this.cameraId&&e.push({key:"camera",label:this.cams?.find(n=>n.id===this.cameraId)?.name??s("מצלמה"),clear:()=>{this.cameraId="",t()}}),this.type&&e.push({key:"type",label:m[this.type]??this.type,clear:()=>{this.type="",t()}}),this.date&&this.date!==a&&e.push({key:"date",label:s("עד {date}",{date:this.date.split("-").reverse().join(".")}),clear:()=>{this.date=a,t()}}),this.rangeDays>1&&e.push({key:"range",label:s("{n} ימים",{n:this.rangeDays}),clear:()=>this.setRange(1)}),this.placeFloor&&e.push({key:"floor",label:this.facetFloors.find(n=>n.id===this.placeFloor)?.name??s("מקום"),clear:()=>{this.placeFloor="",this.placeZone="",t()}}),this.placeZone&&e.push({key:"zone",label:this.facetFloors.flatMap(n=>n.zones).find(n=>n.id===this.placeZone)?.name??s("אזור"),clear:()=>{this.placeZone="",t()}}),this.source&&e.push({key:"source",label:y[this.source]??this.source,clear:()=>{this.source="",t()}}),e}resetFilters(){this.q="",this.recorderId="",this.cameraId="",this.type="",this.date=b(new Date,this.tz),this.rangeDays=1,this.placeFloor="",this.placeZone="",this.source="",this.filter="all",this.load()}renderDemo(){const e=g.filter(a=>this.filter==="all"||!a.acked),t=g.find(a=>a.id===this.selected);return r`
      <div class="filters">
        <sw-field><select aria-label=${s("אתר")}><option>${s("כל האתרים")}</option><option>${s("אתר הדגמה")}</option></select></sw-field>
        <sw-field><select aria-label=${s("מצלמה")}><option>${s("כל המצלמות")}</option></select></sw-field>
        <sw-field><select aria-label=${s("סוג")}><option>${s("כל סוגי האירועים")}</option><option>${s("אדם")}</option><option>${s("רכב")}</option><option>${s("תנועה")}</option><option>${s("ניתוק")}</option></select></sw-field>
        <sw-field><input type="date" lang=${D()} value="2026-09-14" data-ltr aria-label=${s("תאריך")} /></sw-field>
        <span class="grow"></span>
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${g.length}>${s("הכל")}</sw-chip>
        <sw-chip ?selected=${this.filter==="unacked"} @click=${()=>this.filter="unacked"} count=${g.filter(a=>!a.acked).length}>${s("ללא טיפול")}</sw-chip>
      </div>
      <div class="stage">
        <sw-table .columns=${this.columns} .rows=${e} .selected=${this.selected} @row-select=${a=>this.selected=a.detail.id}></sw-table>
        ${t?r`<sw-drawer open class="evdrawer" ?modal=${this.narrow} heading=${R[t.type]} subheading=${`${t.camera} · ${t.time}`} @close=${()=>this.selected=null}>
              <div class="preview">${t.type==="offline"||t.type==="door"?s("אין תמונה לאירוע זה"):r`<sw-scene kind=${Z[t.camera]??"lobby"}></sw-scene><span class="demo">${s("דמו · תמונת אירוע מהמקליט (T044)")}</span>`}</div>
              <dl class="r5-facts">
                <div><dt>${s("זמן אירוע")}</dt><dd>${t.time} <span class="r5-sub">· ${s("נקלט +1.2s")}</span></dd></div>
                <div><dt>${s("טיפול")}</dt><dd>${t.acked?"טופל בידי יוני, 09:50":s("ממתין")}</dd></div>
                <div><dt>${s("קומה")}</dt><dd>${t.floor}</dd></div>
                <div><dt>${s("כיסוי הקלטה")}</dt><dd>${t.type==="offline"?s("אין"):s("קיים · 10 שנ׳ לפני/אחרי")}</dd></div>
                <div class="wide"><dt>${s("מקור")}</dt><dd>${B[t.source]??t.source} · raw: <span class="ltr">${t.type}</span></dd></div>
              </dl>
              <div slot="footer" class="acts">
                <a href="#/investigate/playback"><sw-button variant="primary" size="sm" icon="history">${s("להקלטה")}</sw-button></a>
                <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">${s("במפה")}</sw-button></a>
                <sw-button variant="ghost" size="sm" icon="check" ?disabled=${t.acked}>${s("סמן טופל")}</sw-button>
              </div>
            </sw-drawer>`:""}
      </div>
    `}render(){const e=_();return r`
      <sw-page heading=${s("מרכז אירועים")} subheading=${e?s("חיפוש, סינון וסקירה של אירועי המצלמות והחיישנים"):s("חיפוש, סינון וסקירה של כל האירועים · מקור וזמן קליטה נשמרים · נתוני הדגמה")}>
        ${e?l:r`<sw-button slot="actions" icon="download">${s("ייצוא")}</sw-button>`}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};c.styles=[ge,ae`
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
    sw-chip-choice.evc {
      --sw-chipc-gap: 4px;
      --sw-chipc-h: 28px;
      --sw-chipc-pad: 11px;
      --sw-chipc-fs: var(--sw-fs-sm);
    }
    .tools .grow {
      flex: 1;
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
    ${ie}
  `,se,ye];h([S()],c.prototype,"cameraId",2);h([S()],c.prototype,"date",2);h([S()],c.prototype,"initialMode",2);h([p()],c.prototype,"selected",2);h([p()],c.prototype,"filter",2);h([p()],c.prototype,"cams",2);h([p()],c.prototype,"tz",2);h([p()],c.prototype,"type",2);h([p()],c.prototype,"events",2);h([p()],c.prototype,"ingest",2);h([p()],c.prototype,"live",2);h([p()],c.prototype,"error",2);h([p()],c.prototype,"busy",2);h([p()],c.prototype,"thumbVersion",2);h([p()],c.prototype,"player",2);h([p()],c.prototype,"mode",2);h([p()],c.prototype,"windows",2);h([p()],c.prototype,"windowGap",2);h([p()],c.prototype,"windowBy",2);h([p()],c.prototype,"selectedWindow",2);h([p()],c.prototype,"windowsBusy",2);h([p()],c.prototype,"spotlightOnly",2);h([p()],c.prototype,"spotlightCount",2);h([p()],c.prototype,"showRaw",2);h([p()],c.prototype,"ticked",2);h([p()],c.prototype,"facets",2);h([p()],c.prototype,"placeFloor",2);h([p()],c.prototype,"placeZone",2);h([p()],c.prototype,"source",2);h([p()],c.prototype,"recorderId",2);h([p()],c.prototype,"recorders",2);h([p()],c.prototype,"unsupported",2);h([p()],c.prototype,"q",2);h([p()],c.prototype,"rangeDays",2);h([p()],c.prototype,"narrow",2);h([p()],c.prototype,"dock",2);h([p()],c.prototype,"now",2);h([p()],c.prototype,"techOpen",2);h([p()],c.prototype,"rowPreview",2);c=h([re("investigate-events")],c);export{c as InvestigateEvents};
