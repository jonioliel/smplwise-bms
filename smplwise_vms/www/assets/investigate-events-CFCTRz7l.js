import{a as C,S as P,aj as v,pG as $,pF as u,A as o,e as a,pM as _,i as z,rY as F,pH as k,rZ as T,R as m,r_ as j,J as L,pB as q,r$ as A,pD as B,s0 as Z,s1 as U,s2 as G,s3 as g,n as K,z as H,s4 as X,bV as I,s5 as R,pJ as y,C as J,E as Y,F as x,G as h,H as Q}from"./index-TwIAG38v.js";import"./sw-table-D12mlaV-.js";import"./sw-chip-BTCmZI96.js";import{f as ee,b as te,g as D,d as f,p as se}from"./recordings-BdWY-QLr.js";import{s as N,r as ie,d as ae,p as re,t as ne}from"./event-codes-BV-nKNvx.js";import{I as oe}from"./investigate-r5-css-ZX8evhn3.js";import"./sw-logo-art-Va6y_cIM.js";const de={he:{notConfigured:"לא חובר NVR",rejected:"ה־NVR דחה את פרטי הכניסה",notFound:"ה־NVR לא מגיש את שירות ההתראות",serverError:"ה־NVR החזיר שגיאה",timeout:"ה־NVR לא ענה בזמן",unreachable:"אין חיבור ל־NVR",disconnected:"החיבור נותק",unknown:"סיבה לא ידועה"},en:{notConfigured:"No NVR is connected",rejected:"The NVR rejected the sign-in details",notFound:"The NVR does not serve the alert stream",serverError:"The NVR returned an error",timeout:"The NVR did not answer in time",unreachable:"The NVR cannot be reached",disconnected:"The connection was lost",unknown:"Unknown reason"},ar:{notConfigured:"لم يتم ربط جهاز NVR",rejected:"رفض جهاز NVR بيانات الدخول",notFound:"جهاز NVR لا يوفّر خدمة التنبيهات",serverError:"أعاد جهاز NVR خطأ",timeout:"لم يردّ جهاز NVR في الوقت المناسب",unreachable:"لا يمكن الوصول إلى جهاز NVR",disconnected:"انقطع الاتصال",unknown:"سبب غير معروف"},ru:{notConfigured:"NVR не подключён",rejected:"NVR отклонил данные для входа",notFound:"NVR не предоставляет поток тревог",serverError:"NVR вернул ошибку",timeout:"NVR не ответил вовремя",unreachable:"Нет связи с NVR",disconnected:"Соединение потеряно",unknown:"Причина неизвестна"}};function le(e){const t=String(e??"").trim();if(!t)return"unknown";if(t==="nvr_not_configured")return"notConfigured";if(t==="disconnected")return"disconnected";const i=/^http_(\d{3})$/.exec(t);if(i){const n=Number(i[1]);return n===401||n===403?"rejected":n===404?"notFound":n>=500?"serverError":"unknown"}return/timeout|timedout/i.test(t)?"timeout":/connect|network|resolve|refused|unreachable|ssl|eof|remoteprotocol|readerror/i.test(t)?"unreachable":"unknown"}function ce(){const e=(typeof document<"u"?document.documentElement.lang:"").toLowerCase().slice(0,2);return e==="en"||e==="ar"||e==="ru"?e:"he"}function E(e,t=ce()){return de[t][le(e)]}var he=Object.defineProperty,pe=Object.getOwnPropertyDescriptor,c=(e,t,i,n)=>{for(var p=n>1?void 0:n?pe(t,i):t,r=e.length-1,s;r>=0;r--)(s=e[r])&&(p=(n?s(t,i,p):s(p))||p);return n&&p&&he(t,i,p),p};const S="(max-width: 767px)",V="(min-width: 1280px)",we="font-weight:var(--sw-fw-semibold);font-size:var(--sw-fs-md);color:var(--sw-heading);display:inline-flex;align-items:center;gap:7px",b="color:var(--sw-text-3);font-size:var(--sw-fs-xs);line-height:1.4",ue="font-weight:var(--sw-fw-semibold);font-size:var(--sw-fs-md);font-variant-numeric:tabular-nums;color:var(--sw-heading)",me="inline-size:8px;block-size:8px;border-radius:50%;flex:none;background:",W={alertstream:"התראה מה־NVR",recording:"נגזר מקובץ הקלטה",ha:"חיישן התקן",system:"מערכת"},fe={person:"var(--sw-tl-person)",vehicle:"var(--sw-tl-vehicle)",motion:"var(--sw-tl-motion)",line:"var(--sw-tl-line)",offline:"var(--sw-tl-offline)",door:"var(--sw-tl-door)"},O={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking","מסדרון מזרחי":"corridor"},M={info:"מידע",alert:"התראה",critical:"קריטי"};let l=class extends C{constructor(){super(...arguments),this.bubbleSkin=new P(this),this.cameraId="",this.date="",this.initialMode="",this.selected=null,this.filter="all",this.cams=null,this.tz="Asia/Jerusalem",this.type="",this.events=null,this.ingest=null,this.live=!1,this.error="",this.busy=!1,this.thumbVersion=new Map,this.player=null,this.mode="raw",this.windows=null,this.windowGap=180,this.windowBy="camera",this.selectedWindow=null,this.windowsBusy=!1,this.spotlightOnly=!1,this.spotlightCount=0,this.showRaw=!1,this.ticked=new Set,this.facets=null,this.placeFloor="",this.placeZone="",this.source="",this.recorderId="",this.recorders=[],this.unsupported=[],this.q="",this.rangeDays=1,this.narrow=typeof window<"u"&&window.matchMedia(S).matches,this.dock=typeof window<"u"&&window.matchMedia(V).matches,this.now=Date.now(),this.techOpen=!1,this.clock=0,this.qTimer=0,this.thumbTimers=new Map,this.thumbInFlight=0,this.onMedia=()=>{this.narrow=!!this.mqNarrow?.matches,this.dock=!!this.mqDock?.matches},this.onKey=e=>{if(this.narrow||e.altKey||e.ctrlKey||e.metaKey||e.defaultPrevented)return;const t=this.mode==="windows",i=t?this.selectedWindow:this.selected;if(!i)return;const n=e.composedPath();if(!n.some(r=>r instanceof HTMLElement&&(r.tagName==="INPUT"||r.tagName==="SELECT"||r.tagName==="TEXTAREA"||r.isContentEditable))){if(e.key==="Escape"){e.preventDefault(),t?this.closeWindowDrawer():this.closeDrawer();return}if(e.key==="ArrowDown"||e.key==="ArrowUp"){const r=t?(this.windows??[]).map(w=>w.id):(this.events??[]).map(w=>w.id),s=r.indexOf(i),d=r[e.key==="ArrowDown"?s+1:s-1];if(s<0||!d)return;e.preventDefault(),t?(this.selectedWindow=d,this.showRaw=!1,this.ticked=new Set):this.select(d),this.revealRow(d);return}if(e.key==="Enter"){if(n.some(r=>r instanceof HTMLElement&&(r.tagName==="BUTTON"||r.tagName==="A"||r.tagName==="SW-BUTTON"||r.tagName==="SUMMARY")))return;if(e.preventDefault(),t){const r=this.windows?.find(s=>s.id===i);r&&v(`/investigate/events/${r.first_event_id}`)}else v(`/investigate/events/${i}`)}}},this.rowPreview=null,this.rowPreviewTimer=0,this.windowColumns=[{key:"thumb",label:"",width:"104px",render:e=>this.renderWindowThumb(e)},{key:"title",label:"חלון אירוע",render:e=>{const t=e;return a`<span class="ty" style="--tone:${$[t.dominant_type]??"var(--sw-tl-offline)"}"><i></i>${u[t.dominant_type]??t.dominant_type}${t.count>1?a` <span class="sub">×${String(t.count)}</span>`:o}</span><div class="sub">${Object.entries(t.types).map(([i,n])=>`${u[i]??i} ${n}`).join(" · ")} · ${t.confidence==="inferred"?"נגזר מהקלטה":"התראות מה־NVR"}</div>`}},{key:"spotlight",label:"זרקור",width:"150px",render:e=>{const t=e,i=t.spotlight;return i?.on?a`<span class="spot" data-window-spotlight title=${i.rules.map(n=>n.why).join(" · ")}><sw-icon name="target" size=${12}></sw-icon>${i.rules.map(n=>n.label).join(" · ")}</span>`:t.manual_group_id?a`<span class="sub" data-window-manual>קיבוץ ידני</span>`:o}},{key:"camera_name",label:"מצלמה / קבוצה",render:e=>{const t=e;return a`${t.camera_name??(t.channel?`ערוץ ${t.channel}`:"מערכת")}${t.group&&t.group!=="camera"&&t.group!=="manual"&&t.camera_names?.length?a`<div class="sub">${t.camera_names.join(" · ")}</div>`:o}`}},{key:"start",label:"זמן",render:e=>{const t=e;return a`${this.fmt(t.start)}${t.end!==t.start?a` – ${this.fmt(t.end)}`:o}<div class="sub">${this.fmtDate(t.start)}</div>`}},{key:"acked",label:"מצב",render:e=>{const t=e;return a`<sw-badge kind=${t.acked?"live":t.acked_count?"stale":"neutral"} label=${t.acked?"טופל":t.acked_count?`בטיפול ${t.acked_count}/${t.count}`:"חדש"}></sw-badge>`}}],this.apiColumns=[{key:"thumb",label:"",width:"80px",render:e=>this.renderThumb(e)},{key:"type",label:"אירוע",render:e=>{const t=e;return a`<span style=${we} title=${`קוד המכשיר: ${t.raw_type}`} data-raw-type=${t.raw_type}><i style=${`${me}${$[t.type]??"var(--sw-tl-offline)"}`}></i>${this.kindLabel(t)}${t.count>1?a`<span style=${b}>×${t.count}</span>`:o}</span><div style=${b}>${W[t.source]??t.source}${t.confidence==="inferred"&&t.source!=="recording"?" · נגזר":""}</div>`}},{key:"camera_name",label:"מצלמה",render:e=>{const t=e;return a`<span style="color:var(--sw-text)">${this.camLabel(t)}</span>${t.camera_name&&t.channel?a`<div style=${b}>ערוץ ${t.channel}</div>`:o}`}},{key:"occurred_at",label:"זמן",width:"190px",render:e=>{const t=e,i=N(t.occurred_at,t.ended_at);return a`<span style=${ue}>${this.fmt(t.occurred_at)}</span><div style=${b}>${this.ago(t.occurred_at)} · ${this.fmtDate(t.occurred_at)}${i?` · ${i}`:""}</div>`}},{key:"severity",label:"חומרה",width:"96px",render:e=>a`<sw-badge ?filled=${e.severity!=="info"} kind=${e.severity==="critical"?"error":e.severity==="alert"?"stale":"neutral"} label=${M[e.severity]??String(e.severity)}></sw-badge>`},{key:"acked_at",label:"טיפול",width:"140px",render:e=>{const t=e;return t.acked_at?a`<span style="color:var(--sw-text-2)">טופל</span><div style=${b}>${t.acked_by_username??""}${t.acked_by_username?" · ":""}${this.fmt(t.acked_at)}</div>`:a`<span style="color:var(--sw-warning-text);font-weight:var(--sw-fw-semibold)" data-pending>ממתין</span>`}}],this.columns=[{key:"thumb",label:"",width:"104px",render:e=>e.type==="offline"||e.type==="door"?a`<div class="thumb none" style="inline-size:88px;block-size:56px;border-radius:8px;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)"><sw-icon name=${e.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:a`<sw-scene class="thumb" style="display:block;inline-size:88px;block-size:56px;border-radius:8px;overflow:hidden;box-shadow:var(--sw-shadow-thumb)" kind=${O[String(e.camera)]??"lobby"}></sw-scene>`},{key:"title",label:"אירוע",render:e=>a`<span class="ty" style="--tone:${fe[e.type]}"><i></i>${_[e.type]}</span><div class="sub">${String(e.title)} · ${e.acked?"טופל":a`<span style="color:var(--sw-warning-text);font-weight:var(--sw-fw-semibold)">ממתין לטיפול</span>`}</div>`},{key:"camera",label:"מצלמה",render:e=>a`${String(e.camera)}<div class="sub">${String(e.floor)}</div>`},{key:"time",label:"זמן",render:e=>a`<span style="font-weight:700;font-size:var(--sw-fs-md);font-variant-numeric:tabular-nums;color:var(--sw-heading)">${String(e.time)}</span><div class="sub ltr">${String(e.source)}</div>`},{key:"severity",label:"חומרה",render:e=>a`<sw-badge filled kind=${e.severity==="critical"?"error":e.severity==="alert"?"stale":"neutral"} label=${{info:"מידע",alert:"התראה",critical:"קריטי"}[e.severity]}></sw-badge>`},{key:"more",label:"",width:"40px",render:()=>a`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback(),this.mqNarrow=window.matchMedia(S),this.mqDock=window.matchMedia(V),this.mqNarrow.addEventListener("change",this.onMedia),this.mqDock.addEventListener("change",this.onMedia),this.onMedia(),window.addEventListener("keydown",this.onKey),this.clock=window.setInterval(()=>{this.now=Date.now(),this.renderRoot.querySelector(".stage sw-table")?.requestUpdate?.()},3e4);try{this.techOpen=localStorage.getItem("sw.events.tech")==="1"}catch{}z()&&(this.init(),this.unsubscribe=F(e=>this.onPushed(e),(e,t)=>{this.live=t,e&&(this.ingest=e)}))}disconnectedCallback(){super.disconnectedCallback(),this.mqNarrow?.removeEventListener("change",this.onMedia),this.mqDock?.removeEventListener("change",this.onMedia),window.removeEventListener("keydown",this.onKey),window.clearInterval(this.clock),this.unsubscribe?.();for(const e of this.thumbTimers.values())window.clearTimeout(e);this.thumbTimers.clear(),this.stopPlayer()}async revealRow(e){await this.updateComplete;const t=this.renderRoot.querySelector(".stage sw-table");await t?.updateComplete;const i=t?.shadowRoot?.querySelector(`tr[data-row-id="${CSS.escape(e)}"]`);i&&(i.style.scrollMarginBlock="48px 12px",i.scrollIntoView({block:"nearest"}))}closeWindowDrawer(){this.selectedWindow=null,this.showRaw=!1,this.ticked=new Set}ago(e){const t=this.now-new Date(e).getTime();if(!Number.isFinite(t))return"";if(t<6e4)return"עכשיו";const i=Math.floor(t/6e4);if(i<60)return`לפני ${i} דק׳`;const n=Math.floor(i/60);if(n<24)return`לפני ${n} שע׳`;const p=Math.floor(n/24);return p===1?"אתמול":`לפני ${p} ימים`}kindLabel(e){return ie(e.raw_type)??u[e.type]??e.type}camLabel(e){return e.camera_name??(e.channel?`ערוץ ${e.channel}`:"מערכת")}hoverStart(e,t){if(!e.camera_id||t.pointerType==="touch")return;window.clearTimeout(this.rowPreviewTimer);const i=t.clientX,n=t.clientY;this.rowPreviewTimer=window.setTimeout(()=>{const p=new Date(e.occurred_at).getTime(),r=[-5,0,5].map(s=>{const d=new Date(p+s*1e3).toISOString().replace(/\.\d{3}Z$/,"Z");return{at:d,url:ee(e.camera_id,d),label:s===0?this.fmt(e.occurred_at):`${s>0?"+":""}${s} ש׳`,failed:!1}});this.rowPreview={id:e.id,x:i,y:n,frames:r,camera:e.camera_name??""}},250)}hoverEnd(){window.clearTimeout(this.rowPreviewTimer),this.rowPreview=null}renderRowPreview(){const e=this.rowPreview;if(!e)return o;const t=Math.max(16,Math.min(window.innerWidth-388,e.x-186)),i=e.y+18+230>window.innerHeight?e.y-18-230:e.y+18;return a`<div class="rowpreview" data-row-preview style="left:${t}px;top:${i}px">
      <div class="strip">
        ${e.frames.map((n,p)=>a`<div class="cell ${p===1?"main":""}">
          ${n.failed?a`<span>אין פריים</span>`:a`<img src=${n.url} alt="" @error=${()=>{n.failed=!0,this.rowPreview={...e}}} />`}
          <span class="t">${n.label}</span>
        </div>`)}
      </div>
      <div class="cap"><span>${e.camera}</span><span>פריימים מההקלטה · 5 שניות לפני ואחרי</span></div>
    </div>`}renderThumb(e){const t="inline-size:64px;block-size:40px;border-radius:6px;overflow:hidden;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)";return e.thumbnail==="ready"?a`<img class="thumb" src=${k(e.id,this.thumbVersion.get(e.id)??0)} alt="" loading="lazy" data-thumb=${e.id} style="inline-size:64px;block-size:40px;object-fit:cover;border-radius:6px;display:block;background:var(--sw-surface-3);cursor:zoom-in" />`:(e.thumbnail==="pending"||e.thumbnail==="none")&&e.camera_id?(this.schedulePoll(e.id,3e3,0),a`<div class="thumb pending" style=${t} title="מכין תמונה מההקלטה…"><sw-icon name="camera" size=${14} style="opacity:.45"></sw-icon></div>`):a`<div class="thumb none" style=${t}><sw-icon name=${e.type==="offline"||e.type==="coverage_gap"?"offline":e.type==="person"?"user":e.type==="vehicle"?"route":e.type==="door"||e.type==="io"?"door":"bell"} size=${14}></sw-icon></div>`}async ackAll(){const e=(this.events??[]).filter(t=>!t.acked_at).map(t=>t.id);if(!(!e.length||this.busy)){this.busy=!0;try{for(let t=0;t<e.length;t+=500)await T(e.slice(t,t+500));await this.load()}catch(t){this.error=m(t)}finally{this.busy=!1}}}schedulePoll(e,t,i){this.thumbTimers.has(e)||this.thumbTimers.set(e,window.setTimeout(()=>void this.poll(e,i),t))}cancelPoll(e){const t=this.thumbTimers.get(e);t!==void 0&&window.clearTimeout(t),this.thumbTimers.delete(e)}async poll(e,t){if(this.thumbTimers.delete(e),!this.isConnected||!this.events?.some(n=>n.id===e))return;if(this.thumbInFlight>=2){this.schedulePoll(e,1500,t);return}this.thumbInFlight++;let i;try{i=await j(e)}finally{this.thumbInFlight--}if(i==="pending"){t<14&&this.schedulePoll(e,Math.min(15e3,3e3*1.35**t),t+1);return}this.setThumb(e,i)}setThumb(e,t){t==="ready"&&(this.thumbVersion=new Map(this.thumbVersion).set(e,Date.now())),this.events=(this.events??[]).map(i=>i.id===e?{...i,thumbnail:t}:i)}select(e){e!==this.player?.eventId&&this.stopPlayer(),this.selected=e}closeDrawer(){this.select(null)}async play(e){if(this.player?.eventId===e.id){await this.stopPlayer();return}if(await this.stopPlayer(),!!e.camera_id){this.player={eventId:e.id,session:null,error:""};try{const t=new Date(new Date(e.occurred_at).getTime()-2e3).toISOString().replace(/\.\d{3}Z$/,"Z"),i=await te(e.camera_id,t);this.player?.eventId===e.id?this.player={eventId:e.id,session:i,error:""}:await D(i.id).catch(()=>{})}catch(t){this.player={eventId:e.id,session:null,error:m(t)}}}}async stopPlayer(){const e=this.player;this.player=null,e?.session&&await D(e.session.id).catch(()=>{})}async init(){try{try{localStorage.getItem("sw.events.mode")==="windows"&&(this.mode="windows")}catch{}(this.initialMode==="windows"||this.initialMode==="raw")&&(this.mode=this.initialMode);const[e,t]=await Promise.all([L(),q()]);this.tz=e["time.zone"]??"Asia/Jerusalem",this.cams=t.cameras,this.recorders=t.recorders??[],this.loadFacets(),this.date||(this.date=f(new Date,this.tz)),await this.load()}catch(e){this.error=m(e)}}async loadFacets(){try{this.facets=await A()}catch{this.facets=null}}get facetFloors(){const e=this.facets;return e?e.places.flatMap(t=>t.buildings.flatMap(i=>i.floors.map(n=>({...n,name:`${i.name} · ${n.name}`})))):[]}searchWindow(){if(this.rangeDays<=1)return{date:this.date||void 0};const e=new Date(`${this.date||f(new Date,this.tz)}T23:59:59.999Z`),t=new Date(e.getTime()-(this.rangeDays-1)*864e5);return t.setUTCHours(0,0,0,0),{from:t.toISOString(),to:e.toISOString()}}async load(){try{const e=await B({...this.searchWindow(),cameraId:this.cameraId||void 0,type:this.type||void 0,unacked:this.filter==="unacked",acked:this.filter==="acked",limit:500,floorId:this.placeFloor||void 0,zoneId:this.placeZone||void 0,source:this.source||void 0,query:this.q.trim()||void 0,recorderId:this.recorderId||void 0});this.events=e.events,this.unsupported=e.filters?.unsupported??[],this.ingest=e.ingest,this.error="",this.mode==="windows"&&await this.loadWindows()}catch(e){this.error=m(e)}}onSearchInput(e){this.q=e,window.clearTimeout(this.qTimer),this.qTimer=window.setTimeout(()=>void this.load(),350)}setRange(e){this.rangeDays=e,this.load()}async loadWindows(){this.windowsBusy=!0;try{const e=await Z({date:this.date||void 0,cameraId:this.cameraId||void 0,gap:this.windowGap,by:this.windowBy,limit:300,spotlight:this.spotlightOnly});this.windows=e.windows,this.spotlightCount=e.spotlights??e.windows.filter(t=>t.spotlight?.on).length,this.selectedWindow&&!e.windows.some(t=>t.id===this.selectedWindow)&&(this.selectedWindow=null)}catch(e){this.error=m(e),this.windows=[]}finally{this.windowsBusy=!1}}setMode(e){this.mode=e,this.select(null),this.selectedWindow=null;try{localStorage.setItem("sw.events.mode",e)}catch{}e==="windows"&&this.windows===null&&this.loadWindows()}async ackWindow(e){this.busy=!0;try{const t=await T(e.event_ids),i=new Set(t.acked);this.events=(this.events??[]).map(n=>i.has(n.id)&&!n.acked_at?{...n,acked_at:new Date().toISOString(),acked_by_username:"אני"}:n),await this.loadWindows()}catch(t){this.error=m(t)}finally{this.busy=!1}}windowTitle(e){const t=e.camera_name??(e.channel?`ערוץ ${e.channel}`:"מערכת");return`${u[e.dominant_type]??e.dominant_type} · ${t}`}neighbourWindow(e,t){const i=this.windows??[],n=i.findIndex(r=>r.id===e.id);if(n<0)return null;const p=r=>!r.manual_group_id&&!e.manual_group_id&&r.camera_id===e.camera_id&&r.group_label===e.group_label&&r.group===e.group;for(let r=t==="older"?n+1:n-1;r>=0&&r<i.length;r+=t==="older"?1:-1)if(p(i[r]))return i[r];return null}async regroup(e,t){this.busy=!0;try{await U(e,t),this.ticked=new Set,this.selectedWindow=null,this.showRaw=!1,await this.loadWindows()}catch(i){this.error=m(i)}finally{this.busy=!1}}async dissolve(e){if(e.manual_group_id){this.busy=!0;try{await G(e.manual_group_id),this.selectedWindow=null,this.showRaw=!1,await this.loadWindows()}catch(t){this.error=m(t)}finally{this.busy=!1}}}tick(e,t){const i=new Set(this.ticked);t?i.add(e):i.delete(e),this.ticked=i}renderWindowThumb(e){return e.thumbnail==="ready"?a`<img class="thumb" src=${k(e.thumbnail_event_id,this.thumbVersion.get(e.thumbnail_event_id)??0)} alt="" loading="lazy" style="inline-size:64px;block-size:40px;object-fit:cover;border-radius:6px;display:block;background:var(--sw-surface-3)" />`:a`<div style="inline-size:88px;block-size:56px;border-radius:8px;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)"><sw-icon name=${e.camera_id?"image":"info"} size=${14}></sw-icon></div>`}renderWindowDrawer(e){const t=(this.events??[]).filter(d=>e.event_ids.includes(d.id)),i=e.spotlight,n=[...this.ticked].filter(d=>e.event_ids.includes(d)),p=this.neighbourWindow(e,"older"),r=this.neighbourWindow(e,"newer"),s=e.camera_names?.length?e.camera_names.join(" · "):e.camera_name??"";return a`<sw-drawer open class="evdrawer" ?modal=${this.narrow} heading=${this.windowTitle(e)} subheading=${`${this.fmtDate(e.start)} · ${this.fmt(e.start)} – ${this.fmt(e.end)} · ${e.count} אירועים`} @close=${()=>this.closeWindowDrawer()}>
      <div class="wsum" data-window-summary>
        <sw-badge kind=${e.severity==="critical"?"offline":e.severity==="alert"?"stale":"neutral"} label=${e.severity==="critical"?"קריטי":e.severity==="alert"?"התראה":"מידע"}></sw-badge>
        <sw-badge kind=${e.confidence==="measured"?"recorded":"unknown"} label=${e.confidence==="measured"?"נמדד":"נגזר מהקלטה"}></sw-badge>
        ${i?.sources?.length?a`<span class="sub">${i.sources.map(d=>g[d]??d).join(" · ")}</span>`:o}
        ${s?a`<span class="sub">${s}</span>`:o}
        ${e.manual_group_id?a`<sw-badge kind="partial" label="קיבוץ ידני" data-window-manual-badge></sw-badge>`:o}
      </div>
      ${i?.on?a`<ul class="rules" data-spotlight-rules>${i.rules.map(d=>a`<li><span class="spot"><sw-icon name="target" size=${12}></sw-icon>${d.label}</span><span class="why">${d.why}</span></li>`)}</ul>`:a`<div class="sub" style="margin-block-end:8px" data-spotlight-none>ללא זרקור: ${Object.entries(e.types).map(([d,w])=>`${u[d]??d} ${w}`).join(" · ")}</div>`}
      <sw-button size="sm" variant="ghost" icon=${this.showRaw?"chevron":"list"} data-window-raw-toggle aria-expanded=${this.showRaw} @click=${()=>this.showRaw=!this.showRaw}>${this.showRaw?"הסתר את האירועים":`${e.count} אירועים מקוריים`}</sw-button>
      ${this.showRaw?a`<div class="wlist" data-window-events>
            ${t.map(d=>a`<a class="wrow ${e.count>1?"tick":""}" href=${`#/investigate/events/${d.id}`}>${e.count>1?a`<input type="checkbox" aria-label="בחר אירוע לפיצול" data-window-tick=${d.id} .checked=${this.ticked.has(d.id)} @click=${w=>w.stopPropagation()} @change=${w=>this.tick(d.id,w.target.checked)} />`:o}<span class="ty" style="--tone:${$[d.type]??"var(--sw-tl-offline)"}"><i></i>${u[d.type]??d.type}</span><span class="ltr">${this.fmt(d.occurred_at)}</span><span class="sub">${d.acked_at?"טופל":"ממתין"}</span></a>`)}
            ${t.length<e.count?a`<div class="sub">${e.count-t.length} אירועים נוספים אינם בסינון הנוכחי.</div>`:o}
          </div>
          <div class="wfix" data-window-fix>
            ${e.count>1?a`<sw-button size="sm" icon="move" ?disabled=${!n.length||n.length>=e.count||this.busy} data-window-split @click=${()=>this.regroup(n,"פוצל מחלון")}>הפרד לחלון נפרד${n.length?` (${n.length})`:""}</sw-button>`:o}
            ${p?a`<sw-button size="sm" icon="layers" ?disabled=${this.busy} data-window-join-older @click=${()=>this.regroup([...e.event_ids,...p.event_ids],"אוחד עם החלון הקודם")}>אחד עם הקודם (${this.fmt(p.start)})</sw-button>`:o}
            ${r?a`<sw-button size="sm" icon="layers" ?disabled=${this.busy} data-window-join-newer @click=${()=>this.regroup([...e.event_ids,...r.event_ids],"אוחד עם החלון הבא")}>אחד עם הבא (${this.fmt(r.start)})</sw-button>`:o}
            ${e.manual_group_id?a`<sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.busy} data-window-ungroup @click=${()=>this.dissolve(e)}>בטל קיבוץ ידני</sw-button>`:o}
          </div>`:o}
      <div slot="footer" class="acts">
        <sw-button variant="primary" size="sm" ?block=${this.narrow} icon="expand" data-review-window @click=${()=>v(`/investigate/events/${e.first_event_id}`)}>סקירה מלאה</sw-button>
        <sw-button size="sm" ?block=${this.narrow} icon="check" ?disabled=${e.acked||this.busy} @click=${()=>this.ackWindow(e)}>${e.acked?"טופל":"סמן הכל כטופל"}</sw-button>
        ${this.renderKeys()}
      </div>
    </sw-drawer>`}onPushed(e){if(!this.events)return;const t=f(new Date(e.occurred_at),this.tz);if(this.date&&t!==this.date||this.cameraId&&e.camera_id!==this.cameraId||this.recorderId&&e.recorder_id!==this.recorderId&&this.cams?.find(r=>r.id===e.camera_id)?.recorder_id!==this.recorderId||this.type&&e.type!==this.type)return;const i=this.cams?.find(r=>r.id===e.camera_id)?.name??null,n={...e,camera_name:e.camera_name??i};(e.thumbnail==="ready"||e.thumbnail==="unavailable")&&(this.cancelPoll(e.id),e.thumbnail==="ready"&&(this.thumbVersion=new Map(this.thumbVersion).set(e.id,Date.now())));const p=this.events.findIndex(r=>r.id===e.id);this.events=p>=0?this.events.map((r,s)=>s===p?{...r,...n}:r):[n,...this.events]}fmt(e){return K(new Date(e),{timeZone:this.tz,seconds:!0})}fmtDate(e){return H(new Date(e),{timeZone:this.tz})}async ack(e){this.busy=!0;try{const t=await X(e.id);this.events=(this.events??[]).map(i=>i.id===e.id?{...i,...t}:i)}catch(t){this.error=m(t)}finally{this.busy=!1}}renderApi(){if(this.error&&!this.events)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.init()}></sw-state-panel>`;if(!this.events)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.events.find(s=>s.id===this.selected)??null,t=this.ingest,i=this.events.filter(s=>!s.acked_at).length,n=!!(t?.connected&&this.facets&&!this.facets.sources.some(s=>s.source==="alertstream")),p=!!t&&!t.connected,r=this.activeFilters();return a`
      ${p?a`<div class="banner warn" data-ingest-down><span class="dot"></span><span>הקליטה מה־NVR מנותקת${t.last_error?` (${E(t.last_error)})`:""} · אירועים חדשים לא יגיעו עד שהחיבור יחזור</span></div>`:o}
      <div class="kpis" data-kpis>
        <div class="kpi ${i?"hot":""}"><div><div class="n">${i}</div><div class="l">לבדיקה</div></div><div class="ic"><sw-icon name="bell" size=${18}></sw-icon></div></div>
        <div class="kpi"><div><div class="n">${this.events.length-i}</div><div class="l">טופלו היום</div></div><div class="ic"><sw-icon name="check" size=${18}></sw-icon></div></div>
      </div>
      <div class="fbar" data-filter-bar>
      <div class="filters">
        <sw-field class="q"><input type="search" data-events-q placeholder="חיפוש: מצלמה, התקן, פרטי אירוע" aria-label="חיפוש חופשי" .value=${this.q} @input=${s=>this.onSearchInput(s.target.value)} /></sw-field>
        ${this.recorders.length>1?a`<sw-field><select aria-label="NVR" data-filter-recorder @change=${s=>{this.recorderId=s.target.value,this.cameraId="",this.load()}}><option value="" ?selected=${!this.recorderId}>כל ה־NVR</option>${this.recorders.map(s=>a`<option value=${s.id} ?selected=${s.id===this.recorderId}>${s.name}</option>`)}</select></sw-field>`:o}
        <sw-field><select aria-label="מצלמה" @change=${s=>{this.cameraId=s.target.value,this.load()}}><option value="" ?selected=${!this.cameraId}>כל המצלמות</option>${(this.cams??[]).filter(s=>!this.recorderId||s.recorder_id===this.recorderId).map(s=>a`<option value=${s.id} ?selected=${s.id===this.cameraId}>${s.name}</option>`)}</select></sw-field>
        <sw-field><select aria-label="סוג" @change=${s=>{this.type=s.target.value,this.load()}}><option value="" ?selected=${!this.type}>כל סוגי האירועים</option>${Object.keys(u).map(s=>a`<option value=${s} ?selected=${s===this.type}>${u[s]}</option>`)}</select></sw-field>
        <sw-field><input type="date" lang=${I()} .value=${this.date} max=${f(new Date,this.tz)} data-ltr aria-label="תאריך" @change=${s=>{this.date=s.target.value,this.load()}} /></sw-field>
        <span class="rangepick" role="group" aria-label="טווח ימים" data-events-range>
          ${[[1,"יום"],[7,"7 ימים"],[30,"30 יום"]].map(([s,d])=>a`<button class=${this.rangeDays===s?"on":""} data-events-range-set=${s} @click=${()=>this.setRange(s)}>${d}</button>`)}
        </span>
        <sw-field><select aria-label="מקום" data-filter-floor @change=${s=>{this.placeFloor=s.target.value,this.placeZone="",this.load()}}><option value="" ?selected=${!this.placeFloor}>כל המקומות</option>${this.facetFloors.map(s=>a`<option value=${s.id} ?selected=${s.id===this.placeFloor}>${s.name} · ${s.cameras} מצלמות${s.sensors?` · ${s.sensors} חיישנים`:""}</option>`)}</select></sw-field>
        ${this.placeFloor&&this.facetFloors.find(s=>s.id===this.placeFloor)?.zones.length?a`<sw-field><select aria-label="חדר / אזור" data-filter-zone @change=${s=>{this.placeZone=s.target.value,this.load()}}><option value="" ?selected=${!this.placeZone}>כל הקומה</option>${(this.facetFloors.find(s=>s.id===this.placeFloor)?.zones??[]).map(s=>a`<option value=${s.id} ?selected=${s.id===this.placeZone}>${s.name} · ${s.cameras} מצלמות${s.sensors?` · ${s.sensors} חיישנים`:""}</option>`)}</select></sw-field>`:o}
        <sw-field><select aria-label="מקור" data-filter-source @change=${s=>{this.source=s.target.value,this.load()}}><option value="" ?selected=${!this.source}>כל המקורות</option>${Object.entries(g).map(([s,d])=>a`<option value=${s} ?selected=${s===this.source}>${d}</option>`)}</select></sw-field>
      </div>
      <div class="tools">
        <span class="seg" role="group" aria-label="מצב טיפול">
          <sw-chip ?selected=${this.filter==="all"} @click=${()=>{this.filter="all",this.load()}} count=${this.filter==="all"?this.events.length:void 0}>הכל</sw-chip>
          <sw-chip ?selected=${this.filter==="unacked"} @click=${()=>{this.filter="unacked",this.load()}} count=${i}>לבדיקה</sw-chip>
          <sw-chip ?selected=${this.filter==="acked"} @click=${()=>{this.filter="acked",this.load()}}>טופלו</sw-chip>
        </span>
        <span class="seg" role="group" aria-label="תצוגה">
          <sw-chip icon="list" ?selected=${this.mode==="raw"} @click=${()=>this.setMode("raw")}>אירועים</sw-chip>
          <sw-chip icon="layers" ?selected=${this.mode==="windows"} data-mode-windows @click=${()=>this.setMode("windows")} count=${this.windows?.length}>חלונות</sw-chip>
        </span>
        ${r.length?a`<span class="active" data-active-filters>
              ${r.map(s=>a`<button type="button" class="fchip" data-active-filter=${s.key} aria-label=${`הסר מסנן: ${s.label}`} @click=${s.clear}><span>${s.label}</span><sw-icon name="close" size=${12}></sw-icon></button>`)}
              <button type="button" class="reset" data-filter-reset @click=${()=>this.resetFilters()}>איפוס</button>
            </span>`:o}
        <span class="grow"></span>
        <sw-button size="sm" icon="check" ?disabled=${!i||this.busy} data-ack-all title="מסמן כטופלו את כל האירועים ברשימה שעדיין לבדיקה (לפי הסינון הנוכחי)" @click=${()=>this.ackAll()}>סמן הכול כטופל (${i})</sw-button>
      </div>
      </div>
      ${this.renderTech(n)}
      ${this.unsupported.length?a`<div class="banner warn" data-unsupported>המסנן אינו נתמך כאן, לא "אין תוצאות": ${this.unsupported.map(s=>s.reason).join(" · ")}</div>`:o}
      ${this.error?a`<div class="banner warn" role="alert">${this.error}</div>`:o}
      <div class="stage ${(e||this.mode==="windows"&&this.selectedWindow)&&this.dock?"docked":""}">
        ${this.mode==="windows"?this.windows===null||this.windowsBusy&&!this.windows.length?a`<sw-state-panel state="loading"></sw-state-panel>`:this.windows.length?a`<div class="banner" style="margin-block-end:8px"><sw-icon name="info" size=${14}></sw-icon><span>${this.windowBy==="camera"?"התראות סמוכות באותה מצלמה":this.windowBy==="all"?"התראות סמוכות מכל המצלמות":this.windowBy==="zone"?"התראות סמוכות באותו חדר":"התראות סמוכות באותה קומה"} הופכות לחלון אירוע אחד (מרווח עד ${Math.round(this.windowGap/60)} דק׳). האירועים המקוריים נשמרים לצפייה.</span><span class="grow"></span>
                  <sw-chip icon="target" ?selected=${this.spotlightOnly} data-window-spotlight-only count=${this.spotlightCount} @click=${()=>{this.spotlightOnly=!this.spotlightOnly,this.loadWindows()}}>זרקורים</sw-chip>
                  <sw-field><select aria-label="קיבוץ" data-window-by @change=${s=>{this.windowBy=s.target.value,this.loadWindows()}}>${Object.keys(R).map(s=>a`<option value=${s} ?selected=${this.windowBy===s}>${R[s]}</option>`)}</select></sw-field>
                  <sw-field><select aria-label="מרווח קיבוץ" data-window-gap @change=${s=>{this.windowGap=Number(s.target.value),this.loadWindows()}}>${[60,180,300,600,900,1800,3600].map(s=>a`<option value=${s} ?selected=${this.windowGap===s}>${s/60} דק׳</option>`)}</select></sw-field></div>
                <sw-table .columns=${this.windowColumns} .rows=${this.windows} .selected=${this.selectedWindow} @row-select=${s=>this.selectedWindow=s.detail.id}></sw-table>`:this.spotlightOnly?a`<sw-state-panel icon="history" state="empty" heading="אין זרקורים ביום הזה"><div style="margin-block-start:10px"><sw-button size="sm" data-window-spotlight-off @click=${()=>{this.spotlightOnly=!1,this.loadWindows()}}>כל החלונות</sw-button></div></sw-state-panel>`:a`<sw-state-panel icon="history" state="empty" heading="אין חלונות אירוע ביום הזה" hint="חלון נוצר מאירועים סמוכים של אותה מצלמה."></sw-state-panel>`:this.events.length?a`<sw-table .columns=${this.apiColumns} .rows=${this.events} .selected=${this.selected} @row-hover=${s=>{const d=this.events?.find(w=>w.id===s.detail.id);d&&this.hoverStart(d,s.detail)}} @row-leave=${()=>this.hoverEnd()} @row-select=${s=>this.select(s.detail.id)}></sw-table>`:a`<sw-state-panel icon="history" state="empty" heading="אין אירועים ביום הזה" hint="התראות מגיעות מה־NVR רק כשהטריגר מוגדר עם 'Notify Surveillance Center'; אירועי תנועה נגזרים מקובצי ההקלטה בהפעלה ובכל 10 דקות."></sw-state-panel>`}
        ${this.renderRowPreview()}
        ${this.mode==="windows"&&this.selectedWindow&&this.windows?(()=>{const s=this.windows.find(d=>d.id===this.selectedWindow);return s?this.renderWindowDrawer(s):o})():o}
        ${e?this.renderEventDrawer(e):o}
      </div>
    `}renderEventDrawer(e){const t=typeof e.details.description=="string"?e.details.description.trim():"",i=ae(t),n=this.kindLabel(e),p=N(e.occurred_at,e.ended_at),r=typeof e.details.time_precision=="string"?e.details.time_precision:"",s=typeof e.details.device_time=="string"?e.details.device_time:"",d=typeof e.details.coalesced=="number"?e.details.coalesced:0;return a`<sw-drawer open class="evdrawer" ?modal=${this.narrow} heading=${n} subheading=${`${this.camLabel(e)} · ${this.fmt(e.occurred_at)} · ${this.ago(e.occurred_at)}`} @close=${()=>this.closeDrawer()}>
              <div class="chips" slot="sub" data-event-chips>
                <sw-badge ?filled=${e.severity!=="info"} kind=${e.severity==="critical"?"error":e.severity==="alert"?"stale":"neutral"} label=${M[e.severity]??e.severity}></sw-badge>
                <sw-badge kind=${e.acked_at?"live":"neutral"} label=${e.acked_at?"טופל":"ממתין לטיפול"}></sw-badge>
              </div>
              <div class="big">
                ${this.player?.eventId===e.id&&this.player.session?a`<sw-live-player .wsUrl=${se(this.player.session)} mode="mse" .retry=${!1}></sw-live-player>`:e.thumbnail==="ready"?a`<img src=${k(e.id,this.thumbVersion.get(e.id)??0)} alt="תמונת האירוע מההקלטה" />`:a`<div class="hint">${e.camera_id?e.thumbnail==="unavailable"?"אין פריים זמין בהקלטה בזמן האירוע":this.player?.eventId===e.id?"פותח את ההקלטה…":"מכין תמונה מההקלטה…":"אירוע ללא מצלמה"}</div>`}
                ${this.player?.eventId===e.id&&this.player.error?a`<div class="err">${this.player.error}</div>`:o}
              </div>
              <dl class="r5-facts">
                <div class="wide"><dt>זמן אירוע</dt><dd><span class="ltr">${this.fmtDate(e.occurred_at)} ${this.fmt(e.occurred_at)}</span>${e.ended_at?a` עד <span class="ltr">${this.fmt(e.ended_at)}</span>`:o}${p?a` <span class="r5-sub">· ${p}</span>`:o}</dd></div>
                <div><dt>מצלמה</dt><dd>${this.camLabel(e)}</dd></div>
                <div><dt>מקור</dt><dd>${W[e.source]??e.source}</dd></div>
                <div><dt>ודאות</dt><dd>${e.confidence==="measured"?"נמדד במכשיר":"נגזר מההקלטה"}</dd></div>
                <div><dt>חזרות</dt><dd>${e.count} · ${e.state==="active"?"פעיל":e.state==="inactive"?"הסתיים":"—"}</dd></div>
                <div class="wide"><dt>טיפול</dt><dd>${e.acked_at?a`טופל${e.acked_by_username?` בידי ${e.acked_by_username}`:""} · <span class="ltr">${this.fmt(e.acked_at)}</span>`:"ממתין לטיפול"}</dd></div>
                ${i&&i!==`התראת ${n}`?a`<div class="wide"><dt>תיאור</dt><dd>${i}</dd></div>`:o}
                ${typeof e.details.seconds=="number"?a`<div><dt>משך ההקלטה</dt><dd>${String(e.details.seconds)} שנ׳</dd></div>`:o}
              </dl>
              <details class="tech evtech" data-event-tech>
                <summary><sw-icon name="info" size=${14}></sw-icon><span>פרטים טכניים</span><sw-icon class="chev" name="chevron" size=${14}></sw-icon></summary>
                <dl class="kv">
                  <dt>קוד המכשיר</dt><dd class="ltr">${e.raw_type}</dd>
                  ${t?a`<dt>טקסט המכשיר</dt><dd class="ltr">${t}</dd>`:o}
                  ${r?a`<dt>דיוק הזמן</dt><dd>${re(r)??""} <span class="ltr mono">${r}</span></dd>`:o}
                  ${s?a`<dt>שעון המכשיר</dt><dd class="ltr mono">${s}</dd>`:o}
                  <dt>נקלט</dt><dd><span class="ltr">${this.fmtDate(e.received_at)} ${this.fmt(e.received_at)}</span></dd>
                  <dt>מקור (מפתח)</dt><dd class="ltr mono">${e.source} · ${e.confidence}</dd>
                  ${e.recorder_id?a`<dt>מקליט</dt><dd class="ltr mono">${e.recorder_id}${e.channel?` · ch ${e.channel}`:""}</dd>`:o}
                  ${d?a`<dt>אוחדו</dt><dd>${d} התראות קודמות</dd>`:o}
                  <dt>מזהה</dt><dd class="ltr mono">${e.id}</dd>
                </dl>
              </details>
              <div slot="footer" class="acts">
                <sw-button variant="primary" size="sm" ?block=${this.narrow} icon="expand" data-review @click=${()=>v(`/investigate/events/${e.id}`)}>סקירה מלאה</sw-button>
                ${e.camera_id?a`<sw-button size="sm" ?block=${this.narrow} icon="play" data-play @click=${()=>this.play(e)}>${this.player?.eventId===e.id?"עצור":"נגן כאן"}</sw-button>
                    <sw-button size="sm" ?block=${this.narrow} icon="history" data-to-recording @click=${()=>v("/investigate/playback",{camera:e.camera_id,t:e.occurred_at})}>להקלטה</sw-button>`:o}
                <sw-button variant="ghost" size="sm" ?block=${this.narrow} icon="check" data-ack ?disabled=${!!e.acked_at||this.busy} @click=${()=>this.ack(e)}>${e.acked_at?"טופל":"סמן טופל"}</sw-button>
                ${this.renderKeys()}
              </div>
            </sw-drawer>`}renderKeys(){return this.narrow?o:a`<span class="keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> מעבר · <kbd>Enter</kbd> סקירה · <kbd>Esc</kbd> סגירה</span>`}renderTech(e){const t=this.ingest,i=this.facets,n=i?i.unavailable_types.filter(r=>["person","vehicle","line","field","door"].includes(r.type)):[],p=t?t.connected?"קליטה מחוברת":"קליטה מנותקת":"בודק את הקליטה…";return a`<details class="tech" data-tech-details ?open=${this.techOpen} @toggle=${r=>this.onTechToggle(r.target.open)}>
      <summary>
        <span class="dot ${t?.connected?"on":""}" aria-hidden="true"></span>
        <span data-ingest-line title=${t?.last_error??""}>${p}</span>
        <span class="sub">· עדכונים חיים ${this.live?"פעילים":"מתחברים…"}</span>
        ${e?a`<span class="warnnote" data-no-alerts-flag><sw-icon name="warning" size=${13}></sw-icon>ה־NVR לא שולח התראות</span>`:o}
        <span class="grow"></span>
        <span class="sub">פרטים טכניים</span>
        <sw-icon class="chev" name="chevron" size=${14}></sw-icon>
      </summary>
      <div class="techbody">
        <div>קליטה מה־NVR: ${t?t.connected?"מחובר":`מנותק${t.last_error?` (${E(t.last_error)})`:""}`:"—"}${t?.last_heartbeat_at?` · פעימה אחרונה ${this.fmt(t.last_heartbeat_at)}`:""} · עדכונים חיים: ${this.live?"פעיל":"מתחבר…"} · אזור זמן <span class="ltr">${this.tz}</span></div>
        <div>אירועים "נגזר מהקלטה" הם עדות מקובץ ההקלטה, לא התראה שנמדדה במכשיר.</div>
        ${e?a`<div data-no-alerts class="warntext">ה־NVR לא שלח התראות ב־${i.days} הימים האחרונים. כדי לקבל אותן: ב־NVR, בהגדרות הקישור (linkage) של זיהוי התנועה, להפעיל "Notify Surveillance Center".</div>`:o}
        ${i?a`<div data-facets><strong>שדות עם נתונים (${i.days} ימים):</strong> ${i.types.map(r=>`${u[r.type]??r.type} (${r.count})`).join(" · ")||"אין אירועים"} · <strong>מקורות:</strong> ${i.sources.map(r=>`${g[r.source]??r.source} (${r.count})`).join(" · ")||"—"}
              ${n.length?a`<br /><strong>לא זמין:</strong> ${n.map((r,s)=>a`${s?" · ":""}<span title=${r.reason}>${u[r.type]??r.type}</span>`)} <span class="sub">(ריחוף מסביר למה)</span>`:o}
              ${i.notes.map(r=>a`<br />${r}`)}</div>`:o}
      </div>
    </details>`}onTechToggle(e){if(e!==this.techOpen){this.techOpen=e;try{localStorage.setItem("sw.events.tech",e?"1":"0")}catch{}}}activeFilters(){const e=[],t=()=>void this.load(),i=f(new Date,this.tz);return this.q.trim()&&e.push({key:"q",label:`"${this.q.trim()}"`,clear:()=>{this.q="",t()}}),this.recorderId&&e.push({key:"recorder",label:this.recorders.find(n=>n.id===this.recorderId)?.name??"NVR",clear:()=>{this.recorderId="",t()}}),this.cameraId&&e.push({key:"camera",label:this.cams?.find(n=>n.id===this.cameraId)?.name??"מצלמה",clear:()=>{this.cameraId="",t()}}),this.type&&e.push({key:"type",label:u[this.type]??this.type,clear:()=>{this.type="",t()}}),this.date&&this.date!==i&&e.push({key:"date",label:`עד ${this.date.split("-").reverse().join(".")}`,clear:()=>{this.date=i,t()}}),this.rangeDays>1&&e.push({key:"range",label:`${this.rangeDays} ימים`,clear:()=>this.setRange(1)}),this.placeFloor&&e.push({key:"floor",label:this.facetFloors.find(n=>n.id===this.placeFloor)?.name??"מקום",clear:()=>{this.placeFloor="",this.placeZone="",t()}}),this.placeZone&&e.push({key:"zone",label:this.facetFloors.flatMap(n=>n.zones).find(n=>n.id===this.placeZone)?.name??"אזור",clear:()=>{this.placeZone="",t()}}),this.source&&e.push({key:"source",label:g[this.source]??this.source,clear:()=>{this.source="",t()}}),e}resetFilters(){this.q="",this.recorderId="",this.cameraId="",this.type="",this.date=f(new Date,this.tz),this.rangeDays=1,this.placeFloor="",this.placeZone="",this.source="",this.filter="all",this.load()}renderDemo(){const e=y.filter(i=>this.filter==="all"||!i.acked),t=y.find(i=>i.id===this.selected);return a`
      <div class="filters">
        <sw-field><select aria-label="אתר"><option>כל האתרים</option><option>אתר הדגמה</option></select></sw-field>
        <sw-field><select aria-label="מצלמה"><option>כל המצלמות</option></select></sw-field>
        <sw-field><select aria-label="סוג"><option>כל סוגי האירועים</option><option>אדם</option><option>רכב</option><option>תנועה</option><option>ניתוק</option></select></sw-field>
        <sw-field><input type="date" lang=${I()} value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
        <span class="grow"></span>
        <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${y.length}>הכל</sw-chip>
        <sw-chip ?selected=${this.filter==="unacked"} @click=${()=>this.filter="unacked"} count=${y.filter(i=>!i.acked).length}>ללא טיפול</sw-chip>
      </div>
      <div class="stage">
        <sw-table .columns=${this.columns} .rows=${e} .selected=${this.selected} @row-select=${i=>this.selected=i.detail.id}></sw-table>
        ${t?a`<sw-drawer open class="evdrawer" ?modal=${this.narrow} heading=${_[t.type]} subheading=${`${t.camera} · ${t.time}`} @close=${()=>this.selected=null}>
              <div class="preview">${t.type==="offline"||t.type==="door"?"אין תמונה לאירוע זה":a`<sw-scene kind=${O[t.camera]??"lobby"}></sw-scene><span class="demo">דמו · תמונת אירוע מה־NVR (T044)</span>`}</div>
              <dl class="r5-facts">
                <div><dt>זמן אירוע</dt><dd>${t.time} <span class="r5-sub">· נקלט +1.2s</span></dd></div>
                <div><dt>טיפול</dt><dd>${t.acked?"טופל בידי יוני, 09:50":"ממתין"}</dd></div>
                <div><dt>קומה</dt><dd>${t.floor}</dd></div>
                <div><dt>כיסוי הקלטה</dt><dd>${t.type==="offline"?"אין":"קיים · 10 שנ׳ לפני/אחרי"}</dd></div>
                <div class="wide"><dt>מקור</dt><dd><span class="ltr">${t.source}</span> · raw: <span class="ltr">${t.type}</span></dd></div>
              </dl>
              <div slot="footer" class="acts">
                <a href="#/investigate/playback"><sw-button variant="primary" size="sm" icon="history">להקלטה</sw-button></a>
                <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה</sw-button></a>
                <sw-button variant="ghost" size="sm" icon="check" ?disabled=${t.acked}>סמן טופל</sw-button>
              </div>
            </sw-drawer>`:""}
      </div>
    `}render(){const e=z();return a`
      <sw-page heading="מרכז אירועים" subheading=${e?"חיפוש, סינון וסקירה של אירועי המצלמות והחיישנים":"חיפוש, סינון וסקירה של כל האירועים · מקור וזמן קליטה נשמרים · נתוני הדגמה"}>
        ${e?o:a`<sw-button slot="actions" icon="download">ייצוא</sw-button>`}
        ${e?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};l.styles=[ne,Y`
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
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
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
    .seg {
      display: inline-flex;
      gap: 4px;
      align-items: center;
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
    /* R5-INVESTIGATE-297: the picture is how an event is recognised - 88x56, rounded, a thumb shadow (was 64x40) */
    sw-scene.thumb,
    .thumb.none {
      inline-size: 88px;
      block-size: 56px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      box-shadow: var(--sw-shadow-thumb);
    }
    .thumb.none {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .thumb img {
      inline-size: 88px;
      block-size: 56px;
      object-fit: cover;
      border-radius: var(--sw-r-sm);
      display: block;
      background: var(--sw-surface-3);
    }
    .thumb.pending {
      background: linear-gradient(90deg, var(--sw-surface-3) 25%, var(--sw-surface-2) 50%, var(--sw-surface-3) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.6s linear infinite;
    }
    @keyframes shimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .thumb.pending {
        animation: none;
      }
    }
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
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
  `,J,oe];c([x()],l.prototype,"cameraId",2);c([x()],l.prototype,"date",2);c([x()],l.prototype,"initialMode",2);c([h()],l.prototype,"selected",2);c([h()],l.prototype,"filter",2);c([h()],l.prototype,"cams",2);c([h()],l.prototype,"tz",2);c([h()],l.prototype,"type",2);c([h()],l.prototype,"events",2);c([h()],l.prototype,"ingest",2);c([h()],l.prototype,"live",2);c([h()],l.prototype,"error",2);c([h()],l.prototype,"busy",2);c([h()],l.prototype,"thumbVersion",2);c([h()],l.prototype,"player",2);c([h()],l.prototype,"mode",2);c([h()],l.prototype,"windows",2);c([h()],l.prototype,"windowGap",2);c([h()],l.prototype,"windowBy",2);c([h()],l.prototype,"selectedWindow",2);c([h()],l.prototype,"windowsBusy",2);c([h()],l.prototype,"spotlightOnly",2);c([h()],l.prototype,"spotlightCount",2);c([h()],l.prototype,"showRaw",2);c([h()],l.prototype,"ticked",2);c([h()],l.prototype,"facets",2);c([h()],l.prototype,"placeFloor",2);c([h()],l.prototype,"placeZone",2);c([h()],l.prototype,"source",2);c([h()],l.prototype,"recorderId",2);c([h()],l.prototype,"recorders",2);c([h()],l.prototype,"unsupported",2);c([h()],l.prototype,"q",2);c([h()],l.prototype,"rangeDays",2);c([h()],l.prototype,"narrow",2);c([h()],l.prototype,"dock",2);c([h()],l.prototype,"now",2);c([h()],l.prototype,"techOpen",2);c([h()],l.prototype,"rowPreview",2);l=c([Q("investigate-events")],l);export{l as InvestigateEvents};
//# sourceMappingURL=investigate-events-CFCTRz7l.js.map
