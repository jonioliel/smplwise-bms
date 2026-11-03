import{a as M,S as I,se as E,sf as O,sg as F,j as _,R as v,at as D,sh as N,si as P,i as w,jd as L,iT as j,aj as f,pS as A,sj as U,e3 as t,sk as B,sl as z,sm as R,ae as q,dZ as W,z as H,n as k,av as V,e as i,A as p,sn as T,bf as G,bg as K,e1 as Y,so as Z,jc as J,l as Q,E as X,F as ee,G as h,H as te}from"./index-CHCc2mtA.js";import"./sw-case-picker-BvYrj1lf.js";import"./sw-plan-canvas-D0GfAbPG.js";import"./settings-form-DJX3k3J7.js";import{b3 as ae}from"./shared-space-B5h0Q3x6.js";import{a as se}from"./access-events-B62qmZuW.js";import{l as ie}from"./lead-reserve-B_ACKLs0.js";import"./sw-logo-art-Va6y_cIM.js";import"./cases-3Zcc8ssn.js";import"./candidates-CS7-ly_Q.js";import"./zones-DtyjAhMh.js";var ne=Object.defineProperty,oe=Object.getOwnPropertyDescriptor,d=(e,a,n,s)=>{for(var o=s>1?void 0:s?oe(a,n):a,m=e.length-1,c;m>=0;m--)(c=e[m])&&(o=(s?c(a,n,o):c(o))||o);return s&&o&&ne(a,n,o),o};const S="(max-width: 1199px)",re={fire_service:"stateFireService",fault:"stateFault",out_of_service:"stateOutOfService",active:"stateActive",moving_up:"stateMovingUp",moving_down:"stateMovingDown",door_open:"stateDoorOpen",waiting:"stateWaiting",travelling:"stateTravelling",unknown:"stateUnknown"},le={fire_service:"alarm",fault:"alarm",out_of_service:"off",unknown:"unk",moving_up:"acc",moving_down:"acc",travelling:"acc"},x=e=>e instanceof _&&e.status===403;let l=class extends M{constructor(){super(...arguments),this.bubbleSkin=new I(this),this.incidentId="",this.pane="cams",this.narrow=typeof window<"u"&&window.matchMedia(S).matches,this.now=Date.now(),this.pageError=null,this.detail=null,this.list=null,this.bundle=null,this.mapState="none",this.cams={state:"loading"},this.doors={state:"loading"},this.who={},this.elevators={state:"loading"},this.generators={state:"loading"},this.live=new Set,this.paused=!1,this.capped=new Map,this.capTimers=new Map,this.snapBust=Date.now(),this.sheet=null,this.casePick=null,this.toast="",this.busy=!1,this.closeNoteText="",this.noteText="",this.manualFloors=[],this.manualFloor="",this.manualTitle="",this.clockTimer=0,this.pollTimer=0,this.snapTimer=0,this.hiddenTimer=0,this.toastTimer=0,this.loadedFloor="",this.onMq=e=>{this.narrow=e.matches,this.resetLive()},this.onVisibility=()=>{window.clearTimeout(this.hiddenTimer),document.visibilityState==="hidden"?this.hiddenTimer=window.setTimeout(()=>this.paused=!0,this.setting("incident.hidden_stop_s")*1e3):(this.paused=!1,this.reload(!0))}}connectedCallback(){super.connectedCallback(),this.mq=window.matchMedia(S),this.mq.addEventListener("change",this.onMq),document.addEventListener("visibilitychange",this.onVisibility),this.clockTimer=window.setInterval(()=>this.now=Date.now(),1e3)}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),document.removeEventListener("visibilitychange",this.onVisibility);for(const e of[this.clockTimer,this.snapTimer])window.clearInterval(e);for(const e of[this.pollTimer,this.hiddenTimer,this.toastTimer,...this.capTimers.values()])window.clearTimeout(e);this.capTimers.clear()}willUpdate(e){e.has("incidentId")&&this.reload(!1)}setting(e){return this.detail?.settings?.[e]??E[e]}schedulePoll(){window.clearTimeout(this.pollTimer),this.pollTimer=window.setTimeout(()=>{document.visibilityState==="visible"?this.reload(!0):this.schedulePoll()},this.setting("incident.refresh_s")*1e3)}async reload(e){const a=this.incidentId;e||(this.pageError=null,this.detail=null,this.list=null,this.bundle=null,this.mapState="none",this.loadedFloor="",this.cams={state:"loading"},this.doors={state:"loading"},this.live=new Set,this.pane="cams");try{if(!a)this.list=await O("all"),this.pageError=null;else{const n=await F(a);if(this.incidentId!==a)return;this.detail=n,this.pageError=null,n.floor_id&&n.floor_id!==this.loadedFloor&&this.loadPlan(n.floor_id),n.floor_id||(this.mapState="none"),this.loadCameras(a),this.loadDoors(a),this.loadInfra(),window.clearInterval(this.snapTimer),this.snapTimer=window.setInterval(()=>this.snapBust=Date.now(),this.setting("incident.snapshot_refresh_s")*1e3)}}catch(n){if(e&&(this.detail||this.list))return this.schedulePoll();const s=n instanceof _?n.code:"";this.pageError=s==="feature_disabled"?{kind:"off",message:""}:x(n)?{kind:"forbidden",message:""}:n instanceof _&&n.status===404?{kind:"missing",message:""}:{kind:"error",message:v(n)};return}a&&this.detail?.status==="open"?this.schedulePoll():a||this.schedulePoll()}async loadPlan(e){this.loadedFloor=e,this.mapState="loading";try{const a=await D(e);if(this.loadedFloor!==e)return;this.bundle=a,this.mapState=a.planStatus==="none"?"missing":"ready"}catch(a){this.bundle=null,this.mapState=x(a)?"forbidden":"missing"}}async loadCameras(e){try{const a=await N(e),n=this.cams.state!=="ready";this.cams={state:"ready",data:a},(n||!this.live.size)&&this.resetLive()}catch(a){this.cams=x(a)?{state:"forbidden"}:{state:"error",message:v(a)}}}async loadDoors(e){try{const a=await P(e);this.doors={state:"ready",data:a},this.loadWho(a)}catch(a){this.doors=x(a)?{state:"forbidden"}:{state:"error",message:v(a)}}}async loadWho(e){if(!w()){this.who={"lock.demo_parking":"יוסי לוי · כרטיס","binary_sensor.demo_exit":"ללא זיהוי · נפתחה מבפנים"};return}const a={};await Promise.all(e.doors.filter(n=>n.station_id&&n.door).map(async n=>{try{const o=(await se({station_id:n.station_id,door:n.door,start:e.window.from,end:e.window.to},null,5)).events?.records.find(m=>m.result==="granted");o&&(a[n.entity_id]=[o.person_name||"—",o.authentication==="card"?"כרטיס":o.authentication==="pin"?"קוד":""].filter(Boolean).join(" · "))}catch{}})),this.who=a}async loadInfra(){if(!w()){this.elevators={state:"ready",data:[{id:"e1",name:"מעלית צפונית",area_id:null,area_name:"קומה -1",state:"door_open",reason:"",partial:!1,stale:!1,since:null,roles:[],extras:[]},{id:"e2",name:"מעלית דרומית",area_id:null,area_name:"קומה 3",state:"moving_down",reason:"",partial:!1,stale:!1,since:null,roles:[],extras:[]}]},this.generators={state:"ready",data:[{id:"g1",name:"גנרטור ראשי",area_id:null,area_name:"גג",status:"detected",source_kind:"demo",rated_kw:null,rated_kva:null,fuel_type:"diesel",detected_at:null,last_seen_at:null,revision:1,availability:"online",stale:!1}]};return}const[e,a]=await Promise.allSettled([L(),j()]);this.elevators=e.status==="fulfilled"?{state:"ready",data:e.value.elevators}:{state:"hidden"},this.generators=a.status==="fulfilled"?{state:"ready",data:a.value.devices}:{state:"hidden"}}get liveCap(){const e=this.cams.state==="ready"?this.cams.data:null;return Math.max(1,this.narrow?e?.max_live_phone??this.setting("incident.max_live_phone"):e?.max_live??this.setting("incident.max_live"))}get tileCams(){const e=this.cams.state==="ready"?this.cams.data.cameras:[],a=this.narrow?Math.min(e.length,Math.max(4,this.liveCap)):Math.min(e.length,Math.max(4,this.liveCap));return e.slice(0,a)}resetLive(){this.live=new Set(this.tileCams.slice(0,this.liveCap).map(e=>e.camera_id))}swapIn(e){if(this.live.has(e)){f(`/live/cameras/${e}`);return}const a=this.tileCams.map(s=>s.camera_id),n=new Set(this.live);if(n.size>=this.liveCap){const s=[...n].sort((o,m)=>a.indexOf(m)-a.indexOf(o))[0];s&&n.delete(s)}n.add(e),this.live=n}onPlayerStatus(e,a){const n=a.detail;if(n?.code!=="remote_live_cap"&&n?.code!==4429||this.capped.has(e))return;const s=new Map(this.capped);s.set(e,Number(n.max)||0),this.capped=s;const o=window.setTimeout(()=>{const m=new Map(this.capped);m.delete(e),this.capped=m,this.capTimers.delete(e)},A);this.capTimers.set(e,o)}flash(e){this.toast=e,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2200)}async doAck(){if(!(!this.detail||this.busy)){this.busy=!0;try{await U(this.detail.id),this.flash(t("ackDone")),await this.reload(!0)}catch(e){this.flash(v(e))}finally{this.busy=!1}}}async doClose(){if(!(!this.detail||this.busy)){this.busy=!0;try{await B(this.detail.id,this.closeNoteText.trim()||void 0),this.sheet=null,this.closeNoteText="",this.flash(t("closeDone")),z(),await this.reload(!0)}catch(e){this.flash(v(e))}finally{this.busy=!1}}}async doNote(){if(!(!this.detail||this.busy||!this.noteText.trim())){this.busy=!0;try{await R(this.detail.id,this.noteText.trim()),this.sheet=null,this.noteText="",this.flash(t("noteDone")),await this.reload(!0)}catch(e){this.flash(v(e))}finally{this.busy=!1}}}async openManualSheet(){this.sheet="manual";try{const e=await q();this.manualFloors=e.sites.flatMap(a=>(a.buildings??[]).flatMap(n=>(n.floors??[]).map(s=>({id:s.id,label:`${n.name} · ${s.name}`})))),this.manualFloor=this.manualFloor||this.manualFloors[0]?.id||""}catch{this.manualFloors=[]}}async doManual(){if(!(!this.manualFloor||this.busy)){this.busy=!0;try{const e=await W({floor_id:this.manualFloor,title:this.manualTitle.trim()||void 0});this.sheet=null,this.manualTitle="",z(),f(`/investigate/incidents/${e.incident.id}`)}catch(e){this.flash(v(e))}finally{this.busy=!1}}}caseItem(){const e=this.detail;return e.source==="event"&&e.source_ref?{kind:"event",event_id:e.source_ref,note:e.title}:{kind:"note",note:`${t("pageTitle")} · ${e.title} · ${this.when(e.opened_at)}`}}when(e,a=!1){return e?a?`${H(e)} · ${k(e)}`:k(e,{seconds:!0}):"-"}canConfigure(){return!w()||V("system.configure")}renderState(e,a=""){return e==="off"?i`<div class="screen"><sw-state-panel icon="offline" state="empty" heading=${t("offTitle")} hint=${t("offHint")} data-incidents-off
        actionLabel=${this.canConfigure()?t("toSettings"):""} @action=${()=>f("/system/security/incidents")}></sw-state-panel></div>`:e==="forbidden"?i`<div class="screen"><sw-state-panel state="forbidden" heading=${t("forbidden")} data-incidents-forbidden></sw-state-panel></div>`:e==="missing"?i`<div class="screen"><sw-state-panel icon="search" state="empty" heading=${t("notFound")} actionLabel=${t("listTitle")} @action=${()=>f("/investigate/incidents")}></sw-state-panel></div>`:i`<div class="screen"><sw-state-panel state="error" heading=${t("errorTitle")} hint=${a||t("errorHint")} actionLabel=${t("retry")} data-incidents-error @action=${()=>void this.reload(!1)}></sw-state-panel></div>`}render(){const e=this.pageError?this.renderState(this.pageError.kind,this.pageError.message):this.incidentId?this.renderDetail():this.renderList();return i`${e}${this.renderSheets()}${this.toast?i`<div class="toast" role="status" data-incident-toast>${this.toast}</div>`:p}`}renderClock(){return i`<span class="clock" title=${t("clock")} data-incident-clock><sw-icon name="clock" size=${16}></sw-icon><span class="num">${k(this.now,{seconds:!0})}</span></span>`}renderList(){const e=this.list;if(!e)return i`<div class="screen"><sw-state-panel state="loading" data-incidents-loading></sw-state-panel></div>`;const a=e.incidents.filter(r=>r.status==="open"),n=e.incidents.filter(r=>r.status==="closed"),s=e.settings["incident.header_clock"]!==!1,o=r=>r.closed_at?t("minutes",{n:Math.max(1,Math.round((new Date(r.closed_at).getTime()-new Date(r.opened_at).getTime())/6e4))}):T(r.opened_at,this.now),m=r=>({alarm:t("srcAlarm"),event:t("srcEvent"),notification:t("srcNotification"),manual:t("srcManual")})[r.source],c=[...a,...n];return i`<section class="screen" data-incidents-list>
      <div class="top lead-head">
        <div><h1>${t("listTitle")}</h1><p class="sub">${a.length?t("listSubOpen",{n:a.length}):t("listSub",{n:n.length})}</p></div>
        <span class="sp"></span>
        ${s?this.renderClock():p}
        <div class="meta">
          ${e.can_open?i`<sw-button variant="primary" icon="plus" data-incident-open-manual @click=${()=>void this.openManualSheet()}>${t("openManual")}</sw-button>`:p}
          ${e.can_configure||!w()?i`<sw-button iconOnly icon="system" label=${t("settings")} title=${t("settings")} data-incident-settings-open @click=${()=>this.sheet="settings"}></sw-button>`:p}
        </div>
      </div>
      ${a.length?p:i`<sw-state-panel icon="shield" state="empty" compact heading=${t("listNone")} hint=${t("listNoneHint")} data-incidents-none style="flex:none"></sw-state-panel>`}
      <div class="panel listwrap">
        <div class="hd"><h2>${t("recent")}</h2><span class="sp"></span><span class="mut">${t("retention",{n:e.retention_days})}</span></div>
        ${c.length?i`
          <table class="t" data-incidents-table><thead><tr><th>${t("colState")}</th><th>${t("colIncident")}</th><th>${t("colSource")}</th><th>${t("colOpened")}</th><th>${t("colClosed")}</th><th>${t("colDuration")}</th></tr></thead><tbody>
            ${c.slice(0,8).map(r=>i`<tr data-incident-row=${r.id} data-status=${r.status} @click=${()=>f(`/investigate/incidents/${r.id}`)}>
              <td><span class="badge" data-look=${r.status==="open"?"alarm":"off"}>${r.status==="open"?t("statusOpen"):t("statusClosed")}</span></td>
              <td><span class="t1">${r.title}</span><span class="t2">${[r.building_name,r.floor_name].filter(Boolean).join(" · ")}</span></td>
              <td>${m(r)}</td><td class="num">${this.when(r.opened_at,!0)}</td><td class="num">${r.closed_at?this.when(r.closed_at,!0):"-"}</td><td class="num">${o(r)}</td>
            </tr>`)}
          </tbody></table>
          <div class="cards">${c.slice(0,5).map(r=>i`<button type="button" class="c" data-incident-card=${r.id} @click=${()=>f(`/investigate/incidents/${r.id}`)}>
            <div class="r1"><span class="t1">${r.title}</span><span class="badge sm" data-look=${r.status==="open"?"alarm":"off"}>${r.status==="open"?t("statusOpen"):t("statusClosed")}</span></div>
            <div class="mut">${m(r)} · ${this.when(r.opened_at,!0)} · ${o(r)}</div></button>`)}</div>`:i`<sw-state-panel icon="list" state="empty" compact quiet heading=${t("listNone")}></sw-state-panel>`}
      </div>
    </section>`}renderDetail(){const e=this.detail;if(!e)return i`<div class="screen"><sw-state-panel state="loading" data-incidents-loading></sw-state-panel></div>`;const a=e.status==="open",s=[[e.building_name,e.floor_name,e.zone].filter(Boolean).join(" · "),e.source_label,t("openedBy",{t:this.when(e.opened_at),who:e.opened_by_name||t("system")})].filter(Boolean).join(" · "),o=this.doors.state==="ready"?this.doors.data.doors.filter(c=>c.open).length:0,m=e.steps.length+(e.pending.length?1:0);return i`<section class="screen" data-incident=${e.id} data-status=${e.status} data-part=${this.pane}>
      <div class="top lead-head">
        <div>
          <h1><span class="badge" data-look=${a?"alarm":"off"} style="font-size:var(--sw-fs-sm)" data-incident-status><sw-icon name=${a?"warning":"check"} size=${14}></sw-icon>${a?t("statusOpen"):t("statusClosed")} · <span class="num" data-incident-elapsed>${T(e.opened_at,e.closed_at?new Date(e.closed_at).getTime():this.now)}</span></span>${e.title}</h1>
          <p class="sub">${s}</p>
        </div>
        <span class="sp"></span>
        ${this.setting("incident.header_clock")?this.renderClock():p}
        <div class="meta">
          ${a&&e.can_ack?i`<sw-button variant="primary" icon="check" data-incident-ack ?disabled=${this.busy} @click=${()=>void this.doAck()}>${t("ack")}</sw-button>`:p}
          ${e.can_case?i`<sw-button icon="case" data-incident-case @click=${()=>this.casePick=this.caseItem()}><span class="only-desk">${t("addCase")}</span><span class="only-phone">${t("addCaseShort")}</span></sw-button>`:p}
          ${a&&e.can_ack?i`<sw-button variant="danger" data-incident-close @click=${()=>this.sheet="close"}><span class="only-desk">${t("close")}</span><span class="only-phone">${t("closeShort")}</span></sw-button>`:p}
          ${e.can_configure?i`<sw-button iconOnly icon="system" label=${t("settings")} title=${t("settings")} data-incident-settings-open @click=${()=>this.sheet="settings"}></sw-button>`:p}
          <sw-button class="only-desk" variant="ghost" icon="list" data-incident-to-events @click=${()=>f("/investigate/events")}>${t("toEvents")}</sw-button>
        </div>
      </div>
      <div class="ptabs" role="group" aria-label=${t("parts")} data-incident-parts>
        ${["cams","map","doors","chain"].map(c=>i`<button type="button" data-part-btn=${c} aria-pressed=${this.pane===c?"true":"false"} @click=${()=>this.pane=c}>
          ${c==="cams"?i`<sw-icon name="camera" size=${16}></sw-icon>${t("partCams")}`:c==="map"?i`<sw-icon name="map" size=${16}></sw-icon>${t("partMap")}`:c==="doors"?i`${t("partDoors")}${o?i`<span class="n" data-look="warn">${o}</span>`:p}`:i`${t("partChain")}<span class="n">${m}</span>`}
        </button>`)}
      </div>
      <div class="board">
        <div class="col">${this.renderMap(e)}${this.renderDoors()}</div>
        <div class="col">${this.renderCameras(e)}${this.renderInfra()}</div>
        <div class="col">${this.renderChain(e)}</div>
      </div>
    </section>`}hiddenPart(e){return this.narrow&&this.pane!==e}get markers(){const e=this.bundle,a=this.detail;if(!e||!a)return[];const n=e.anchors.map(s=>({id:s.id,kind:s.resource_type==="camera"?"camera":K(s.layer_id,s.entity?.domain),label:s.camera?.name??s.entity?.name??s.label??s.resource_id,x:s.position.x,y:s.position.y,rotation:s.rotation_degrees,fov:s.field_of_view_degrees??void 0,level:s.level_id??null,state:s.resource_type==="camera"?G(s):"neutral"}));return!a.anchor_id&&a.x!==null&&a.y!==null&&n.push({id:"incident-pin",kind:"binary_sensor",label:a.zone||a.title,x:a.x,y:a.y,state:"error"}),n}renderMap(e){const a=this.bundle,n=new Set(this.cams.state==="ready"?this.cams.data.cameras.map(c=>c.camera_id):[]),s=a?a.anchors.filter(c=>c.resource_type==="camera"&&n.has(c.resource_id)).map(c=>c.id):[],o=e.anchor_id||(e.x!==null&&e.y!==null?"incident-pin":null),m=e.floor_id?this.mapState==="forbidden"?t("mapForbidden"):this.mapState==="missing"?t("noMap"):"":t("noLocation");return i`<div class="panel fill" data-pane="map" ?hidden-part=${this.hiddenPart("map")}>
      <div class="hd"><h2>${t("mapTitle")}</h2>${e.zone?i`<span class="chip" data-look="alarm"><span class="d"></span>${e.zone}</span>`:p}<span class="sp"></span>
        ${e.floor_id?i`<a class="lnk" href=${`#/explore/floors/${e.floor_id}`} title=${t("liveMap")} data-incident-live-map><sw-icon name="map" size=${14}></sw-icon><span class="bt">${t("liveMap")}</span></a>
          <a class="lnk" href=${`#/investigate/floors/${e.floor_id}/history?t=${encodeURIComponent(e.opened_at)}`} title=${t("historyMap")}><sw-icon name="history" size=${14}></sw-icon><span class="bt">${t("historyMap")}</span></a>`:p}
      </div>
      <div class="map" data-incident-map>
        ${a&&this.mapState==="ready"?i`<sw-plan-canvas .planWidth=${a.width} .planHeight=${a.height} .imageUrl=${a.imageUrl} .plan=${a.planSvg} .markers=${this.markers} .selectedId=${o}
              .highlightIds=${s} .zones=${ae(a.zones)} alwaysLabel dimEntities></sw-plan-canvas>`:i`<div class="loc">${this.mapState==="loading"?i`<sw-state-panel state="loading" compact quiet></sw-state-panel>`:i`<div><b>${[e.building_name,e.floor_name,e.zone].filter(Boolean).join(" · ")||"-"}</b><br />${m}</div>`}</div>`}
      </div>
    </div>`}renderCameras(e){const a=this.cams,n=this.tileCams,s=n.filter(u=>this.live.has(u.camera_id)).length,o=n.length,m=this.narrow?Math.max(1,o-1):o<=4?Math.min(2,Math.max(1,o)):3,c=this.narrow?o>1?"minmax(0, 1fr) minmax(0, .42fr)":"minmax(0, 1fr)":`repeat(${Math.max(1,Math.ceil(o/m))}, minmax(0, 1fr))`,r=n[0]?.camera_id;return i`<div class="panel fill" data-pane="cams" ?hidden-part=${this.hiddenPart("cams")}>
      <div class="hd"><h2>${t("camsTitle")}</h2>
        ${a.state==="ready"&&o?i`<span class="chip" data-look="ok" data-incident-cams-chip><span class="d"></span><span class="num">${this.narrow?t("camsPhone",{n:s,s:o-s}):t("camsLive",{n:s})}</span></span>`:p}
        <span class="sp"></span>
        ${a.state==="ready"&&r?i`<a class="lnk" href=${`#/investigate/playback?camera=${encodeURIComponent(r)}&t=${encodeURIComponent(e.opened_at)}`} data-incident-full-player><sw-icon name="play" size=${14}></sw-icon>${t("fullPlayer")}</a>`:p}
      </div>
      ${a.state==="loading"?i`<sw-state-panel state="loading" compact quiet></sw-state-panel>`:a.state==="forbidden"?i`<sw-state-panel state="forbidden" compact heading=${t("camsForbidden")} hint=${t("camsForbiddenHint")} data-incident-cams-forbidden></sw-state-panel>`:a.state==="error"?i`<sw-state-panel state="error" compact heading=${t("camsTitle")} hint=${a.message}></sw-state-panel>`:a.state==="hidden"?p:o?i`<div class="tiles" data-incident-tiles style=${`grid-template-columns: repeat(${m}, minmax(0, 1fr)); grid-template-rows: ${c}`}>
            ${n.map((u,$)=>{const y=this.capped.get(u.camera_id),g=this.live.has(u.camera_id)&&!this.paused&&y===void 0,C=this.narrow&&$===0&&o>1?"grid-column: 1 / -1":"";return i`<div class="tile ${$===0&&u.relation!=="floor"?"hot":""}" style=${C} data-incident-tile=${u.camera_id} data-live=${g?"true":"false"}
                role="button" tabindex="0" aria-label=${g?u.name:`${u.name} · ${t("swapLive")}`}
                @click=${()=>this.swapIn(u.camera_id)} @keydown=${b=>{(b.key==="Enter"||b.key===" ")&&(b.preventDefault(),this.swapIn(u.camera_id))}}>
                <sw-camera-tile name=${u.name} meta=${u.relation_label} cameraId=${u.camera_id} state="live" profile="sub" transport="auto" fit="cover" ?compact=${this.narrow&&$>0}
                  ?live=${w()&&g} ?snapshotOnly=${w()&&!g} poster=${w()?Y(u.camera_id,g?void 0:this.snapBust):""}
                  @player-status=${b=>this.onPlayerStatus(u.camera_id,b)}></sw-camera-tile>
                ${y!==void 0?i`<span class="capchip" data-incident-cap=${u.camera_id} title=${Z(y)}><sw-icon name="warning" size=${12}></sw-icon>${t("capFull")}</span>`:p}
              </div>`})}
          </div>`:i`<sw-state-panel icon="camera" state="empty" compact quiet heading=${t("camsNone")}></sw-state-panel>`}
    </div>`}renderDoors(){const e=this.doors,a=e.state==="ready"?e.data:null,n=a?a.doors.filter(s=>s.open).length:0;return i`<div class="panel" data-pane="doors" ?hidden-part=${this.hiddenPart("doors")}>
      <div class="hd"><h2>${t("doorsTitle")}</h2>${n?i`<span class="chip" data-look="warn"><span class="d"></span>${t("doorsOpen",{n})}</span>`:p}<span class="sp"></span>
        ${a?i`<span class="mut">${t("doorsWindow",{n:Math.round(a.window_s/60)})}</span>`:p}</div>
      ${e.state==="loading"?i`<sw-state-panel state="loading" compact quiet></sw-state-panel>`:e.state!=="ready"?i`<sw-state-panel icon="door" state=${e.state==="forbidden"?"forbidden":"error"} compact quiet heading=${t("doorsTitle")}></sw-state-panel>`:e.data.doors.length?i`<ul class="drs" data-incident-doors>${e.data.doors.slice(0,this.narrow?6:3).map(s=>{const o=s.open===null?"unk":s.open?"warn":"ok",m=s.open===null?e.data.state_visible?t("doorUnknown"):t("doorHidden"):s.open?t("doorOpen"):t("doorLocked"),c=this.who[s.entity_id];return i`<li class="dr" data-look=${o} data-door=${s.entity_id}>
              <span class="badge sm">${m}</span>
              <div><span class="t1">${s.name}</span><span class="t2">${[s.area_name,c].filter(Boolean).join(" · ")}</span></div>
              <span class="when num ${s.open?"":"mut"}">${s.since?this.when(s.since):""}</span>
              <a class="lnk" href=${`#/devices?entity=${encodeURIComponent(s.entity_id)}`} data-incident-to-door>${t("toDoor")}</a>
            </li>`})}</ul>`:i`<sw-state-panel icon="door" state="empty" compact quiet heading=${t("doorsNone")}></sw-state-panel>`}
    </div>`}renderInfra(){const e=this.elevators.state==="ready"?this.elevators.data:null,a=this.generators.state==="ready"?this.generators.data:null;if(!e?.length&&!a?.length)return p;const n=[...(e??[]).slice(0,2).map(s=>({id:s.id,icon:"elevator",name:s.name,sub:s.area_name??t("elevator"),look:le[s.state]??"ok",badge:J(re[s.state]??"stateUnknown")})),...(a??[]).slice(0,1).map(s=>({id:s.id,icon:"power",name:s.name,sub:s.area_name??t("generator"),look:s.availability==="online"&&!s.stale?"ok":s.availability==="offline"?"off":"warn",badge:s.availability==="online"&&!s.stale?t("genOnline"):s.availability==="offline"?t("genOffline"):t("genStale")}))];return i`<div class="panel infra" data-pane="doors" data-incident-infra ?hidden-part=${this.hiddenPart("doors")}>
      <div class="hd"><h2>${t("infraTitle")}</h2><span class="sp"></span><a class="lnk" href="#/infra/elevators">${t("infraLink")}</a></div>
      <div class="rows">${n.map(s=>i`<div class="li" data-look=${s.look} data-infra=${s.id}><span class="ico"><sw-icon name=${s.icon} size=${16}></sw-icon></span>
        <div class="grow"><div class="t1">${s.name}</div><div class="t2">${s.sub}</div></div><span class="badge sm">${s.badge}</span></div>`)}</div>
    </div>`}stepText(e){const a=e.actor||t("system");switch(e.kind){case"opened":return{t1:e.text||t("stepOpened"),t2:t("stepOpenedBy",{src:this.detail?.source_label??"",who:a}),look:"alarm"};case"notified":return{t1:t("stepNotified",{n:e.recipients?.length??Number(e.text??0)}),t2:(e.recipients??[]).join(", "),look:"acc"};case"acked":return{t1:t("stepAcked",{who:a}),t2:e.text==="first"?t("stepAckedFirst"):"",look:"ok"};case"door_open":return{t1:e.actor?t("stepDoorOpenBy",{who:e.actor}):t("stepDoorOpen"),t2:[e.text,e.unconfirmed?t("stepDoorUnconfirmed"):""].filter(Boolean).join(" · "),look:"warn"};case"note":return{t1:t("stepNote",{who:a}),t2:e.text?`"${e.text}"`:"",look:"acc"};case"event_added":return{t1:t("stepAdded"),t2:e.text??"",look:"warn"};case"closed":return{t1:t("stepClosed",{who:a}),t2:e.text??"",look:"off"};default:return{t1:e.text??"",t2:"",look:"unk"}}}renderChain(e){const a=this.narrow?9:8,n=e.steps.slice(-a);return i`<div class="panel fill" data-pane="chain" ?hidden-part=${this.hiddenPart("chain")}>
      <div class="hd"><h2>${t("chainTitle")}</h2>${e.pending.length?i`<span class="chip" data-look="warn"><span class="d"></span>${t("chainWaiting",{n:e.pending.length})}</span>`:p}<span class="sp"></span>
        ${e.can_audit?i`<a class="lnk" href=${`#/system/audit?resource_id=${encodeURIComponent(e.id)}`} data-incident-audit>${t("audit")}</a>`:p}</div>
      <ol class="chain" data-incident-chain>
        ${n.map(s=>{const o=this.stepText(s);return i`<li class="step" data-look=${o.look} data-step=${s.kind}><span class="dot"></span><div><div class="t1">${o.t1}</div>${o.t2?i`<div class="t2">${o.t2}</div>`:p}</div><span class="w num">${this.when(s.at)}</span></li>`})}
        ${e.pending.length&&e.status==="open"?i`<li class="step wait" data-step="waiting"><span class="dot"></span><div><div class="t1">${t("stepWaiting")}</div><div class="t2">${e.pending.join(" · ")}</div></div><span class="w">-</span></li>`:p}
      </ol>
      ${e.status==="open"&&e.can_ack?i`<div class="chainfoot"><sw-button size="sm" variant="ghost" icon="edit" data-incident-note @click=${()=>this.sheet="note"}>${t("addNote")}</sw-button></div>`:p}
    </div>`}renderSheets(){const e=this.detail;return i`
      <sw-sheet ?open=${this.sheet==="settings"} heading=${t("sTitle")} data-incident-settings-sheet @close=${()=>this.sheet=null}>
        ${this.sheet==="settings"?i`<incident-settings-form sheet @close=${()=>this.sheet=null} @saved=${()=>{this.sheet=null,this.flash(t("saved")),this.reload(!0)}}></incident-settings-form>`:p}
      </sw-sheet>
      <sw-sheet ?open=${this.sheet==="close"} narrow heading=${t("close")} data-incident-close-sheet @close=${()=>this.sheet=null}>
        <div class="form"><p>${t("closeConfirm")}</p>
          <label>${t("closeNote")}<textarea maxlength="500" .value=${this.closeNoteText} @input=${a=>this.closeNoteText=a.target.value}></textarea></label>
          <div class="acts"><sw-button @click=${()=>this.sheet=null}>${t("cancel")}</sw-button><sw-button variant="danger" data-incident-close-confirm ?disabled=${this.busy} @click=${()=>void this.doClose()}>${t("closeDo")}</sw-button></div></div>
      </sw-sheet>
      <sw-sheet ?open=${this.sheet==="note"} narrow heading=${t("addNote")} @close=${()=>this.sheet=null}>
        <div class="form"><label>${t("addNote")}<textarea maxlength="500" placeholder=${t("notePlaceholder")} .value=${this.noteText} data-incident-note-text @input=${a=>this.noteText=a.target.value}></textarea></label>
          <div class="acts"><sw-button @click=${()=>this.sheet=null}>${t("cancel")}</sw-button><sw-button variant="primary" data-incident-note-save ?disabled=${this.busy||!this.noteText.trim()} @click=${()=>void this.doNote()}>${t("noteSave")}</sw-button></div></div>
      </sw-sheet>
      <sw-sheet ?open=${this.sheet==="manual"} narrow heading=${t("openManualTitle")} data-incident-manual-sheet @close=${()=>this.sheet=null}>
        <div class="form">
          <label>${t("manualFloor")}<select data-incident-manual-floor .value=${this.manualFloor} @change=${a=>this.manualFloor=a.target.value}>
            ${this.manualFloors.map(a=>i`<option value=${a.id} ?selected=${a.id===this.manualFloor}>${a.label}</option>`)}</select></label>
          <label>${t("manualTitle")}<input maxlength="120" placeholder=${t("manualDefault")} .value=${this.manualTitle} @input=${a=>this.manualTitle=a.target.value} /></label>
          <p>${t("physicalNote")}</p>
          <div class="acts"><sw-button @click=${()=>this.sheet=null}>${t("cancel")}</sw-button><sw-button variant="primary" data-incident-manual-open ?disabled=${this.busy||!this.manualFloor} @click=${()=>void this.doManual()}>${t("manualOpen")}</sw-button></div>
        </div>
      </sw-sheet>
      ${e?i`<sw-case-picker .item=${this.casePick} subheading=${`${t("pageTitle")} · ${e.title}`} @close=${()=>this.casePick=null}></sw-case-picker>`:p}`}};l.styles=[ie,X`
    :host { display: flex; flex-direction: column; min-block-size: 0; min-inline-size: 0; color: var(--sw-text); font-family: var(--sw-font); }
    [data-look='ok'] { --c: var(--sw-success); --c-text: var(--sw-success-text); --c-soft: var(--sw-success-soft); }
    [data-look='warn'] { --c: var(--sw-warning); --c-text: var(--sw-warning-text); --c-soft: var(--sw-warning-soft); }
    [data-look='alarm'] { --c: var(--sw-danger); --c-text: var(--sw-danger-text); --c-soft: var(--sw-danger-soft); }
    [data-look='off'] { --c: var(--sw-offline); --c-text: var(--sw-offline-text); --c-soft: var(--sw-offline-soft); }
    [data-look='unk'] { --c: var(--sw-unknown); --c-text: var(--sw-unknown-text); --c-soft: var(--sw-unknown-soft); }
    [data-look='acc'] { --c: var(--sw-accent); --c-text: var(--sw-accent-text); --c-soft: var(--sw-accent-soft); }
    .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .screen { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px var(--sw-page-pad) 14px; min-inline-size: 0; }
    .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: none; }
    .top h1 { margin: 0; font-size: var(--sw-fs-3xl); font-weight: var(--sw-h1-weight); letter-spacing: var(--sw-h1-tracking); line-height: 1.2; color: var(--sw-heading); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .top .sp { flex: 1; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .clock { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 4px 12px; background: var(--sw-surface-3); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-md); }
    .clock sw-icon { color: var(--sw-text-3); }
    .badge { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 3px 11px; white-space: nowrap; background: var(--c); color: var(--sw-text-inverse); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); line-height: 1.4; }
    .badge.sm { padding: 1px 9px; font-size: var(--sw-fs-xs); }
    .chip { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--sw-r-pill); padding: 2px 9px; line-height: 1.5; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium); background: var(--sw-surface-2); color: var(--sw-text-2); white-space: nowrap; }
    .chip[data-look] { background: var(--c-soft); color: var(--c-text); }
    .chip .d { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--c, var(--sw-text-3)); }
    .mut { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    a.lnk { color: var(--sw-accent-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); text-decoration: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
    @media (hover: hover) and (pointer: fine) { a.lnk:hover { text-decoration: underline; } }
    .panel { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); min-inline-size: 0; min-block-size: 0; display: flex; flex-direction: column; overflow: hidden; }
    .panel .hd { display: flex; align-items: center; gap: 8px; padding: 11px 16px 8px; flex-wrap: wrap; flex: none; }
    /* R5-INVESTIGATE-297: a panel title is a title (17 px / 800); the panels carry the hero shadow */
    .panel .hd h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: 800; letter-spacing: -0.02em; color: var(--sw-heading); }
    .panel .hd .sp { flex: 1; }
    .panel > sw-state-panel { flex: 1; min-block-size: 0; }
    .board { flex: 1; min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, .85fr); gap: 14px; }
    .col { display: flex; flex-direction: column; gap: 14px; min-block-size: 0; min-inline-size: 0; }
    .col > .fill { flex: 1; min-block-size: 0; }
    .map { position: relative; flex: 1; min-block-size: 0; margin: 0 16px 14px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface-2); overflow: hidden; direction: ltr; }
    .map sw-plan-canvas { position: absolute; inset: 0; }
    .map .loc { position: absolute; inset: 0; display: grid; place-items: center; direction: rtl; color: var(--sw-text-2); font-size: var(--sw-fs-sm); text-align: center; padding: 12px; }
    .tiles { flex: 1; min-block-size: 0; display: grid; gap: 10px; padding: 0 16px 14px; }
    .tile { position: relative; min-block-size: 0; min-inline-size: 0; border-radius: var(--sw-r-md); overflow: hidden; background: var(--sw-video-bg); cursor: pointer; }
    .tile.hot { box-shadow: 0 0 0 2px var(--sw-danger); }
    .tile sw-camera-tile { position: absolute; inset: 0; block-size: 100%; inline-size: 100%; }
    .tile .rel { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; padding: 2px 8px; border-radius: var(--sw-r-pill); background: var(--sw-video-scrim); color: var(--sw-on-video); font-size: var(--sw-fs-2xs); pointer-events: none; z-index: 1; }
    .capchip { position: absolute; inset-block-start: 8px; inset-inline-end: 8px; z-index: 1; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--sw-r-pill); background: var(--sw-warning); color: var(--sw-on-lit); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); pointer-events: none; }
    .drs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .drs { gap: 6px; padding: 0 12px 12px; }
    .dr { display: grid; grid-template-columns: 62px minmax(0, 1fr) auto auto; align-items: center; gap: 10px; min-block-size: 44px; padding: 6px 10px; border-radius: var(--sw-r-sm); background: var(--c-soft, var(--sw-surface-2)); }
    .dr .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); font-size: var(--sw-fs-md); line-height: 1.3; overflow-wrap: anywhere; }
    .dr .t2 { display: block; font-size: var(--sw-fs-xs); color: var(--sw-text-3); line-height: 1.3; }
    .dr .when { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .rows { display: flex; flex-direction: column; gap: 5px; padding: 0 16px 12px; }
    .li { display: flex; gap: 10px; align-items: center; min-block-size: 44px; padding: 5px 10px; border: 0; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); min-inline-size: 0; }
    .li .grow { flex: 1; min-inline-size: 0; }
    .li .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); font-size: var(--sw-fs-md); line-height: 1.3; }
    .li .t2 { font-size: var(--sw-fs-xs); color: var(--sw-text-3); line-height: 1.3; }
    .li .ico { display: grid; place-items: center; inline-size: 34px; block-size: 34px; border-radius: 50%; background: var(--c-soft, var(--sw-surface-3)); color: var(--c-text, var(--sw-text-2)); flex: none; }
    .chain { list-style: none; margin: 0; padding: 2px 16px 12px; display: flex; flex-direction: column; flex: 1; min-block-size: 0; }
    .step { position: relative; display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; column-gap: 10px; padding-block-end: 8px; }
    .step::before { content: ''; position: absolute; inset-inline-start: 6px; inset-block: 16px -2px; inline-size: 2px; background: var(--sw-border-strong); }
    .step:last-child { padding-block-end: 0; }
    .step:last-child::before { display: none; }
    .step .dot { position: relative; z-index: 1; inline-size: 14px; block-size: 14px; margin-block-start: 3px; border-radius: 50%; background: var(--c, var(--sw-accent)); box-shadow: 0 0 0 3px var(--sw-surface); }
    .step.wait .dot { background: var(--sw-surface); box-shadow: 0 0 0 2px var(--sw-border-strong), 0 0 0 5px var(--sw-surface); }
    .step .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); font-size: var(--sw-fs-md); line-height: 1.35; overflow-wrap: anywhere; }
    .step .t2 { font-size: var(--sw-fs-xs); color: var(--sw-text-2); line-height: 1.35; overflow-wrap: anywhere; }
    .step .w { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-variant-numeric: tabular-nums; padding-block-start: 2px; }
    .step.wait .t1 { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
    .chainfoot { flex: none; display: flex; gap: 8px; padding: 0 16px 12px; }
    .ptabs { display: none; }
    .only-phone { display: none; }
    table.t { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-md); }
    table.t th { text-align: start; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding: 8px 12px; border-block-end: 1px solid var(--sw-border-strong); white-space: nowrap; background: var(--sw-surface-2); }
    table.t td { padding: 12px 14px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; white-space: nowrap; }
    table.t tbody tr { cursor: pointer; }
    /* R5-INVESTIGATE-297 loop 2: hover only under a fine pointer; the row's title sinks on pointer-down (a tr cannot transform) */
    @media (hover: hover) and (pointer: fine) { table.t tbody tr:hover { background: var(--sw-hover-wash); } }
    table.t tbody tr:active { background: var(--sw-surface-2); }
    .cards .c, .dr, .li { transition: transform var(--sw-t-press) var(--sw-ease-out); }
    .cards .c:active { transform: scale(var(--sw-press-scale)); }
    table.t tbody tr:last-child td { border-block-end: 0; }
    td .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); font-size: var(--sw-fs-lg); }
    table.t td.num { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    td .t2 { display: block; font-size: var(--sw-fs-sm); color: var(--sw-text-3); white-space: normal; }
    .cards { display: none; gap: 8px; padding: 0 12px 12px; }
    .cards .c { border: 0; border-radius: var(--sw-r-sm); padding: 10px 12px; min-block-size: 56px; display: grid; gap: 2px; background: var(--sw-surface-2); cursor: pointer; text-align: start; font: inherit; color: inherit; }
    .cards .c .r1 { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .cards .c .t1 { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); min-inline-size: 0; }
    .listwrap { flex: 1; min-block-size: 0; }
    .toast { position: fixed; inset-block-end: 20px; inset-inline: 0; margin-inline: auto; inline-size: max-content; max-inline-size: 90vw; background: var(--sw-toast-bg); color: var(--sw-toast-text); border-radius: var(--sw-r-pill); padding: 8px 16px; z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-2); }
    .form { display: grid; gap: 10px; }
    .form label { display: grid; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .form input, .form select, .form textarea { font: inherit; font-size: var(--sw-fs-md); background: var(--sw-surface); color: var(--sw-text); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); padding: 6px 10px; min-block-size: 36px; }
    .form textarea { min-block-size: 72px; resize: none; }
    .form .acts { display: flex; gap: 8px; justify-content: flex-end; }
    .form p { margin: 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    /* a small laptop: the plan header keeps icons only (the legend is in the plan) */
    @media (min-width: 1200px) and (max-width: 1299px) { .panel .hd .bt { display: none; } }
    @media (min-height: 900px) and (min-width: 1200px) { .step { padding-block-end: 20px; } .step .t1 { font-size: var(--sw-fs-md); } .step .t2, .step .w { font-size: var(--sw-fs-sm); } }
    /* tablet and phone: ONE part of the board at a time (cameras first); the head and its actions stay */
    @media (max-width: 1199px) {
      .screen { padding: 10px 20px 12px; }
      .board { display: flex; flex-direction: column; gap: 10px; }
      .col { display: contents; }
      .board .panel { flex: 1; min-block-size: 0; }
      .board .panel.infra { flex: none; }
      .board .panel[hidden-part] { display: none; }
      .ptabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; padding: 3px; background: var(--sw-surface-3); border-radius: var(--sw-r-md); flex: none; }
      .ptabs button { font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); border: 0; background: transparent; color: var(--sw-text-2); border-radius: var(--sw-r-sm); min-block-size: 36px; padding: 0 4px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; }
      .ptabs button[aria-pressed='true'] { background: var(--sw-seg-key, var(--sw-surface)); color: var(--sw-seg-key-ink, var(--sw-accent-text)); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
      .ptabs .n { font-size: var(--sw-fs-2xs); border-radius: var(--sw-r-pill); padding: 0 6px; background: var(--sw-surface-3); color: var(--sw-text-2); }
      .ptabs .n[data-look] { background: var(--c); color: var(--sw-text-inverse); }
      .tiles { gap: 8px; padding: 0 12px 12px; }
      .only-desk { display: none !important; }
      .only-phone { display: inline; }
    }
    @media (max-width: 767px) {
      .screen { padding: 8px 12px 8px; gap: 8px; }
      .top { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: start; }
      .top .sp { display: none; }
      .top .meta { grid-column: 1 / -1; inline-size: 100%; flex-wrap: nowrap; gap: 6px; }
      .top .meta > sw-button { flex: 1; }
      .top .meta > sw-button[iconOnly] { flex: none; }
      .top h1 { font-size: var(--sw-fs-xl); gap: 8px; }
      .top .sub { font-size: var(--sw-fs-sm); }
      .clock { padding: 3px 8px; font-size: var(--sw-fs-sm); }
      .map { margin: 0 12px 12px; }
      .panel .hd { padding: 10px 12px 6px; }
      .dr { padding-inline: 10px; grid-template-columns: 56px minmax(0, 1fr) auto; }
      .dr .when { display: none; }
      .chain, .rows { padding-inline: 12px; }
      table.t { display: none; }
      .cards { display: grid; }
      .ptabs button { min-block-size: 44px; }
    }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `];d([ee()],l.prototype,"incidentId",2);d([h()],l.prototype,"pane",2);d([h()],l.prototype,"narrow",2);d([h()],l.prototype,"now",2);d([h()],l.prototype,"pageError",2);d([h()],l.prototype,"detail",2);d([h()],l.prototype,"list",2);d([h()],l.prototype,"bundle",2);d([h()],l.prototype,"mapState",2);d([h()],l.prototype,"cams",2);d([h()],l.prototype,"doors",2);d([h()],l.prototype,"who",2);d([h()],l.prototype,"elevators",2);d([h()],l.prototype,"generators",2);d([h()],l.prototype,"live",2);d([h()],l.prototype,"paused",2);d([h()],l.prototype,"capped",2);d([h()],l.prototype,"snapBust",2);d([h()],l.prototype,"sheet",2);d([h()],l.prototype,"casePick",2);d([h()],l.prototype,"toast",2);d([h()],l.prototype,"busy",2);d([h()],l.prototype,"closeNoteText",2);d([h()],l.prototype,"noteText",2);d([h()],l.prototype,"manualFloors",2);d([h()],l.prototype,"manualFloor",2);d([h()],l.prototype,"manualTitle",2);l=d([te("investigate-incidents")],l);function xe(e){return e&&(!w()||Q("events.ack"))}export{l as InvestigateIncidents,xe as mayOpenFromEvent};
//# sourceMappingURL=investigate-incidents-D7FmDXuG.js.map
