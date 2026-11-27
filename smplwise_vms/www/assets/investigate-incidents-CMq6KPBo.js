import{a as E,aX as O,f0 as D,f1 as F,f2 as N,c as z,q as v,aN as P,f3 as L,f4 as A,af as f,f5 as U,f6 as j,a8 as g,f7 as B,f8 as q,e$ as t,f9 as R,fa as T,fb as W,a3 as V,eW as H,b as n,cX as K,e as _,aM as G,A as d,fc as S,eX as X,eY as Y,eH as J,fd as Q,fe as Z,ag as ee,j as te,z as ae,k as p,m as se}from"./index-DlIoBDHe.js";import"./sw-case-picker-B94b7rYm.js";import"./sw-table-DYkMWTOG.js";import"./sw-plan-canvas-D_OiTLiY.js";import"./settings-form-B9NyUCy1.js";import{z as ie}from"./shared-space-8up3y0jM.js";import{g as ne}from"./access-events-DwXv73Tf.js";import{t as w}from"./investigate-DBzXe9hR.js";import{T as oe}from"./toast-controller-BPX0Tkjm.js";import"./sw-logo-art-PLtEZJxU.js";import"./cases-Bk5-vHlT.js";import"./map-CukOfWWB.js";import"./candidates-M5QqbMG-.js";import"./live-CSFbdBCB.js";import"./zones-D-Mp2vZD.js";var re=Object.defineProperty,le=Object.getOwnPropertyDescriptor,c=(e,a,i,s)=>{for(var o=s>1?void 0:s?le(a,i):a,h=e.length-1,m;h>=0;h--)(m=e[h])&&(o=(s?m(a,i,o):m(o))||o);return s&&o&&re(a,i,o),o};const C="(max-width: 1199px)",de={fire_service:"stateFireService",fault:"stateFault",out_of_service:"stateOutOfService",active:"stateActive",moving_up:"stateMovingUp",moving_down:"stateMovingDown",door_open:"stateDoorOpen",waiting:"stateWaiting",travelling:"stateTravelling",unknown:"stateUnknown"},ce={fire_service:"alarm",fault:"alarm",out_of_service:"off",unknown:"unk",moving_up:"acc",moving_down:"acc",travelling:"acc"},$=e=>e instanceof z&&e.status===403,pe={ok:"live",warn:"stale",alarm:"error",off:"offline",unk:"unknown",acc:"recorded"},M=e=>e?pe[e]??"neutral":"neutral";let l=class extends E{constructor(){super(...arguments),this.bubbleSkin=new O(this),this.incidentId="",this.pane="cams",this.narrow=typeof window<"u"&&window.matchMedia(C).matches,this.now=Date.now(),this.pageError=null,this.detail=null,this.list=null,this.bundle=null,this.mapState="none",this.cams={state:"loading"},this.doors={state:"loading"},this.who={},this.elevators={state:"loading"},this.generators={state:"loading"},this.live=new Set,this.paused=!1,this.capped=new Map,this.capTimers=new Map,this.snapBust=Date.now(),this.sheet=null,this.casePick=null,this.toaster=new oe(this,{ms:2200}),this.busy=!1,this.closeNoteText="",this.noteText="",this.manualFloors=[],this.manualFloor="",this.manualTitle="",this.clockTimer=0,this.pollTimer=0,this.snapTimer=0,this.hiddenTimer=0,this.loadedFloor="",this.onMq=e=>{this.narrow=e.matches,this.resetLive()},this.onVisibility=()=>{window.clearTimeout(this.hiddenTimer),document.visibilityState==="hidden"?this.hiddenTimer=window.setTimeout(()=>this.paused=!0,this.setting("incident.hidden_stop_s")*1e3):(this.paused=!1,this.reload(!0))}}get toast(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.mq=window.matchMedia(C),this.mq.addEventListener("change",this.onMq),document.addEventListener("visibilitychange",this.onVisibility),this.clockTimer=window.setInterval(()=>this.now=Date.now(),1e3)}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),document.removeEventListener("visibilitychange",this.onVisibility);for(const e of[this.clockTimer,this.snapTimer])window.clearInterval(e);for(const e of[this.pollTimer,this.hiddenTimer,...this.capTimers.values()])window.clearTimeout(e);this.capTimers.clear()}willUpdate(e){e.has("incidentId")&&this.reload(!1)}setting(e){return this.detail?.settings?.[e]??D[e]}schedulePoll(){window.clearTimeout(this.pollTimer),this.pollTimer=window.setTimeout(()=>{document.visibilityState==="visible"?this.reload(!0):this.schedulePoll()},this.setting("incident.refresh_s")*1e3)}async reload(e){const a=this.incidentId;e||(this.pageError=null,this.detail=null,this.list=null,this.bundle=null,this.mapState="none",this.loadedFloor="",this.cams={state:"loading"},this.doors={state:"loading"},this.live=new Set,this.pane="cams");try{if(!a)this.list=await F("all"),this.pageError=null;else{const i=await N(a);if(this.incidentId!==a)return;this.detail=i,this.pageError=null,i.floor_id&&i.floor_id!==this.loadedFloor&&this.loadPlan(i.floor_id),i.floor_id||(this.mapState="none"),this.loadCameras(a),this.loadDoors(a),this.loadInfra(),window.clearInterval(this.snapTimer),this.snapTimer=window.setInterval(()=>this.snapBust=Date.now(),this.setting("incident.snapshot_refresh_s")*1e3)}}catch(i){if(e&&(this.detail||this.list))return this.schedulePoll();const s=i instanceof z?i.code:"";this.pageError=s==="feature_disabled"?{kind:"off",message:""}:$(i)?{kind:"forbidden",message:""}:i instanceof z&&i.status===404?{kind:"missing",message:""}:{kind:"error",message:v(i)};return}a&&this.detail?.status==="open"?this.schedulePoll():a||this.schedulePoll()}async loadPlan(e){this.loadedFloor=e,this.mapState="loading";try{const a=await P(e);if(this.loadedFloor!==e)return;this.bundle=a,this.mapState=a.planStatus==="none"?"missing":"ready"}catch(a){this.bundle=null,this.mapState=$(a)?"forbidden":"missing"}}async loadCameras(e){try{const a=await L(e),i=this.cams.state!=="ready";this.cams={state:"ready",data:a},(i||!this.live.size)&&this.resetLive()}catch(a){this.cams=$(a)?{state:"forbidden"}:{state:"error",message:v(a)}}}async loadDoors(e){try{const a=await A(e);this.doors={state:"ready",data:a},this.loadWho(a)}catch(a){this.doors=$(a)?{state:"forbidden"}:{state:"error",message:v(a)}}}async loadWho(e){if(!f()){this.who={"lock.demo_parking":"יוסי לוי · כרטיס","binary_sensor.demo_exit":"ללא זיהוי · נפתחה מבפנים"};return}const a={};await Promise.all(e.doors.filter(i=>i.station_id&&i.door).map(async i=>{try{const o=(await ne({station_id:i.station_id,door:i.door,start:e.window.from,end:e.window.to},null,5)).events?.records.find(h=>h.result==="granted");o&&(a[i.entity_id]=[o.person_name||"—",o.authentication==="card"?w("כרטיס"):o.authentication==="pin"?w("קוד"):""].filter(Boolean).join(" · "))}catch{}})),this.who=a}async loadInfra(){if(!f()){this.elevators={state:"ready",data:[{id:"e1",name:w("מעלית צפונית"),area_id:null,area_name:w("קומה -1"),state:"door_open",reason:"",partial:!1,stale:!1,since:null,roles:[],extras:[]},{id:"e2",name:w("מעלית דרומית"),area_id:null,area_name:w("קומה 3"),state:"moving_down",reason:"",partial:!1,stale:!1,since:null,roles:[],extras:[]}]},this.generators={state:"ready",data:[{id:"g1",name:w("גנרטור ראשי"),area_id:null,area_name:w("גג"),status:"detected",source_kind:"demo",rated_kw:null,rated_kva:null,fuel_type:"diesel",detected_at:null,last_seen_at:null,revision:1,availability:"online",stale:!1}]};return}const[e,a]=await Promise.allSettled([U(),j()]);this.elevators=e.status==="fulfilled"?{state:"ready",data:e.value.elevators}:{state:"hidden"},this.generators=a.status==="fulfilled"?{state:"ready",data:a.value.devices}:{state:"hidden"}}get liveCap(){const e=this.cams.state==="ready"?this.cams.data:null;return Math.max(1,this.narrow?e?.max_live_phone??this.setting("incident.max_live_phone"):e?.max_live??this.setting("incident.max_live"))}get tileCams(){const e=this.cams.state==="ready"?this.cams.data.cameras:[],a=this.narrow?Math.min(e.length,Math.max(4,this.liveCap)):Math.min(e.length,Math.max(4,this.liveCap));return e.slice(0,a)}resetLive(){this.live=new Set(this.tileCams.slice(0,this.liveCap).map(e=>e.camera_id))}swapIn(e){if(this.live.has(e)){g(`/live/cameras/${e}`);return}const a=this.tileCams.map(s=>s.camera_id),i=new Set(this.live);if(i.size>=this.liveCap){const s=[...i].sort((o,h)=>a.indexOf(h)-a.indexOf(o))[0];s&&i.delete(s)}i.add(e),this.live=i}onPlayerStatus(e,a){const i=a.detail;if(i?.code!=="remote_live_cap"&&i?.code!==4429||this.capped.has(e))return;const s=new Map(this.capped);s.set(e,Number(i.max)||0),this.capped=s;const o=window.setTimeout(()=>{const h=new Map(this.capped);h.delete(e),this.capped=h,this.capTimers.delete(e)},B);this.capTimers.set(e,o)}flash(e){this.toaster.show(e)}async doAck(){if(!(!this.detail||this.busy)){this.busy=!0;try{await q(this.detail.id),this.flash(t("ackDone")),await this.reload(!0)}catch(e){this.flash(v(e))}finally{this.busy=!1}}}async doClose(){if(!(!this.detail||this.busy)){this.busy=!0;try{await R(this.detail.id,this.closeNoteText.trim()||void 0),this.sheet=null,this.closeNoteText="",this.flash(t("closeDone")),T(),await this.reload(!0)}catch(e){this.flash(v(e))}finally{this.busy=!1}}}async doNote(){if(!(!this.detail||this.busy||!this.noteText.trim())){this.busy=!0;try{await W(this.detail.id,this.noteText.trim()),this.sheet=null,this.noteText="",this.flash(t("noteDone")),await this.reload(!0)}catch(e){this.flash(v(e))}finally{this.busy=!1}}}async openManualSheet(){this.sheet="manual";try{const e=await V();this.manualFloors=e.sites.flatMap(a=>(a.buildings??[]).flatMap(i=>(i.floors??[]).map(s=>({id:s.id,label:`${i.name} · ${s.name}`})))),this.manualFloor=this.manualFloor||this.manualFloors[0]?.id||""}catch{this.manualFloors=[]}}async doManual(){if(!(!this.manualFloor||this.busy)){this.busy=!0;try{const e=await H({floor_id:this.manualFloor,title:this.manualTitle.trim()||void 0});this.sheet=null,this.manualTitle="",T(),g(`/investigate/incidents/${e.incident.id}`)}catch(e){this.flash(v(e))}finally{this.busy=!1}}}caseItem(){const e=this.detail;return e.source==="event"&&e.source_ref?{kind:"event",event_id:e.source_ref,note:e.title}:{kind:"note",note:`${t("pageTitle")} · ${e.title} · ${this.when(e.opened_at)}`}}incidentColumns(e,a){return[{key:"status",label:t("colState"),kind:"status",render:i=>n`<sw-badge filled kind=${i.status==="open"?"error":"offline"} label=${i.status==="open"?t("statusOpen"):t("statusClosed")}></sw-badge>`},{key:"title",label:t("colIncident"),render:i=>n`<span class="t1">${i.title}</span><span class="t2">${[i.building_name,i.floor_name].filter(Boolean).join(" · ")}</span>`},{key:"source",label:t("colSource"),render:i=>e(i)},{key:"opened",label:t("colOpened"),render:i=>n`<span class="num">${this.when(i.opened_at,!0)}</span>`},{key:"closed",label:t("colClosed"),render:i=>n`<span class="num">${i.closed_at?this.when(i.closed_at,!0):"-"}</span>`},{key:"duration",label:t("colDuration"),render:i=>n`<span class="num">${a(i)}</span>`}]}when(e,a=!1){return e?a?`${K(e)} · ${_(e)}`:_(e,{seconds:!0}):"-"}canConfigure(){return!f()||G("system.configure")}renderState(e,a=""){return e==="off"?n`<div class="screen"><sw-state-panel icon="offline" state="empty" heading=${t("offTitle")} hint=${t("offHint")} data-incidents-off
        actionLabel=${this.canConfigure()?t("toSettings"):""} @action=${()=>g("/system/security/incidents")}></sw-state-panel></div>`:e==="forbidden"?n`<div class="screen"><sw-state-panel state="forbidden" heading=${t("forbidden")} data-incidents-forbidden></sw-state-panel></div>`:e==="missing"?n`<div class="screen"><sw-state-panel icon="search" state="empty" heading=${t("notFound")} actionLabel=${t("listTitle")} @action=${()=>g("/investigate/incidents")}></sw-state-panel></div>`:n`<div class="screen"><sw-state-panel state="error" heading=${t("errorTitle")} hint=${a||t("errorHint")} actionLabel=${t("retry")} data-incidents-error @action=${()=>void this.reload(!1)}></sw-state-panel></div>`}render(){const e=this.pageError?this.renderState(this.pageError.kind,this.pageError.message):this.incidentId?this.renderDetail():this.renderList();return n`${e}${this.renderSheets()}${this.toast?n`<div class="toast" role="status" data-incident-toast>${this.toast}</div>`:d}`}renderClock(){return n`<span class="clock" title=${t("clock")} data-incident-clock><sw-icon name="clock" size=${16}></sw-icon><span class="num">${_(this.now,{seconds:!0})}</span></span>`}renderList(){const e=this.list;if(!e)return n`<div class="screen"><sw-state-panel state="loading" data-incidents-loading></sw-state-panel></div>`;const a=e.incidents.filter(r=>r.status==="open"),i=e.incidents.filter(r=>r.status==="closed"),s=e.settings["incident.header_clock"]!==!1,o=r=>r.closed_at?t("minutes",{n:Math.max(1,Math.round((new Date(r.closed_at).getTime()-new Date(r.opened_at).getTime())/6e4))}):S(r.opened_at,this.now),h=r=>({alarm:t("srcAlarm"),event:t("srcEvent"),notification:t("srcNotification"),manual:t("srcManual")})[r.source],m=[...a,...i];return n`<sw-page class="screen" wide data-incidents-list heading=${t("listTitle")} subheading=${a.length?t("listSubOpen",{n:a.length}):t("listSub",{n:i.length})}>
      <div slot="actions" class="acts">
        ${s?this.renderClock():d}
        <div class="meta">
          ${e.can_open?n`<sw-button variant="primary" icon="plus" data-incident-open-manual @click=${()=>void this.openManualSheet()}>${t("openManual")}</sw-button>`:d}
          ${e.can_configure||!f()?n`<sw-button iconOnly icon="system" label=${t("settings")} title=${t("settings")} data-incident-settings-open @click=${()=>this.sheet="settings"}></sw-button>`:d}
        </div>
      </div>
      ${a.length?d:n`<sw-state-panel icon="shield" state="empty" compact heading=${t("listNone")} hint=${t("listNoneHint")} data-incidents-none style="flex:none"></sw-state-panel>`}
      <div class="panel listwrap">
        <div class="hd"><h2>${t("recent")}</h2><span class="sp"></span><span class="mut">${t("retention",{n:e.retention_days})}</span></div>
        ${m.length?n`
          <sw-table data-incidents-table bare .columns=${this.incidentColumns(h,o)} .rows=${m.slice(0,8)}
            .rowAttrs=${r=>({"data-incident-row":String(r.id),"data-status":String(r.status)})}
            @row-select=${r=>g(`/investigate/incidents/${r.detail.id}`)}></sw-table>
          <div class="cards">${m.slice(0,5).map(r=>n`<button type="button" class="c" data-incident-card=${r.id} @click=${()=>g(`/investigate/incidents/${r.id}`)}>
            <div class="r1"><span class="t1">${r.title}</span><sw-badge filled kind=${r.status==="open"?"error":"offline"} label=${r.status==="open"?t("statusOpen"):t("statusClosed")}></sw-badge></div>
            <div class="mut">${h(r)} · ${this.when(r.opened_at,!0)} · ${o(r)}</div></button>`)}</div>`:n`<sw-state-panel icon="list" state="empty" compact quiet heading=${t("listNone")}></sw-state-panel>`}
      </div>
    </sw-page>`}renderDetail(){const e=this.detail;if(!e)return n`<div class="screen"><sw-state-panel state="loading" data-incidents-loading></sw-state-panel></div>`;const a=e.status==="open",s=[[e.building_name,e.floor_name,e.zone].filter(Boolean).join(" · "),e.source_label,t("openedBy",{t:this.when(e.opened_at),who:e.opened_by_name||t("system")})].filter(Boolean).join(" · "),o=this.doors.state==="ready"?this.doors.data.doors.filter(r=>r.open).length:0,h=e.steps.length+(e.pending.length?1:0),m=S(e.opened_at,e.closed_at?new Date(e.closed_at).getTime():this.now);return n`<sw-page class="screen" wide data-incident=${e.id} data-status=${e.status} data-part=${this.pane} heading=${e.title} subheading=${s}>
      <div slot="crumbs" class="eyebrow">
        <sw-badge filled kind=${a?"error":"offline"} label=${`${a?t("statusOpen"):t("statusClosed")} · ${m}`} data-incident-status data-incident-elapsed=${m}></sw-badge>
        ${this.setting("incident.header_clock")?this.renderClock():d}
      </div>
      <div slot="actions" class="acts">
        ${this.setting("incident.header_clock")?this.renderClock():d}
        <div class="meta">
          ${a&&e.can_ack?n`<sw-button variant="primary" icon="check" data-incident-ack ?disabled=${this.busy} @click=${()=>void this.doAck()}>${t("ack")}</sw-button>`:d}
          ${e.can_case?n`<sw-button icon="case" data-incident-case @click=${()=>this.casePick=this.caseItem()}><span class="only-desk">${t("addCase")}</span><span class="only-phone">${t("addCaseShort")}</span></sw-button>`:d}
          ${a&&e.can_ack?n`<sw-button variant="danger" data-incident-close @click=${()=>this.sheet="close"}><span class="only-desk">${t("close")}</span><span class="only-phone">${t("closeShort")}</span></sw-button>`:d}
          ${e.can_configure?n`<sw-button iconOnly icon="system" label=${t("settings")} title=${t("settings")} data-incident-settings-open @click=${()=>this.sheet="settings"}></sw-button>`:d}
          <sw-button class="only-desk" variant="ghost" icon="list" data-incident-to-events @click=${()=>g("/investigate/events")}>${t("toEvents")}</sw-button>
        </div>
      </div>
      <div class="ptabs" role="group" aria-label=${t("parts")} data-incident-parts>
        ${["cams","map","doors","chain"].map(r=>n`<button type="button" data-part-btn=${r} aria-pressed=${this.pane===r?"true":"false"} @click=${()=>this.pane=r}>
          ${r==="cams"?n`<sw-icon name="camera" size=${16}></sw-icon>${t("partCams")}`:r==="map"?n`<sw-icon name="map" size=${16}></sw-icon>${t("partMap")}`:r==="doors"?n`${t("partDoors")}${o?n`<span class="n" data-look="warn">${o}</span>`:d}`:n`${t("partChain")}<span class="n">${h}</span>`}
        </button>`)}
      </div>
      <div class="board">
        <div class="col">${this.renderMap(e)}${this.renderDoors()}</div>
        <div class="col">${this.renderCameras(e)}${this.renderInfra()}</div>
        <div class="col">${this.renderChain(e)}</div>
      </div>
    </sw-page>`}hiddenPart(e){return this.narrow&&this.pane!==e}get markers(){const e=this.bundle,a=this.detail;if(!e||!a)return[];const i=e.anchors.map(s=>({id:s.id,kind:s.resource_type==="camera"?"camera":Y(s.layer_id,s.entity?.domain),label:s.camera?.name??s.entity?.name??s.label??s.resource_id,x:s.position.x,y:s.position.y,rotation:s.rotation_degrees,fov:s.field_of_view_degrees??void 0,level:s.level_id??null,state:s.resource_type==="camera"?X(s):"neutral"}));return!a.anchor_id&&a.x!==null&&a.y!==null&&i.push({id:"incident-pin",kind:"binary_sensor",label:a.zone||a.title,x:a.x,y:a.y,state:"error"}),i}renderMap(e){const a=this.bundle,i=new Set(this.cams.state==="ready"?this.cams.data.cameras.map(m=>m.camera_id):[]),s=a?a.anchors.filter(m=>m.resource_type==="camera"&&i.has(m.resource_id)).map(m=>m.id):[],o=e.anchor_id||(e.x!==null&&e.y!==null?"incident-pin":null),h=e.floor_id?this.mapState==="forbidden"?t("mapForbidden"):this.mapState==="missing"?t("noMap"):"":t("noLocation");return n`<div class="panel fill" data-pane="map" ?hidden-part=${this.hiddenPart("map")}>
      <div class="hd"><h2>${t("mapTitle")}</h2>${e.zone?n`<span class="chip" data-look="alarm"><span class="d"></span>${e.zone}</span>`:d}<span class="sp"></span>
        ${e.floor_id?n`<a class="lnk" href=${`#/explore/floors/${e.floor_id}`} title=${t("liveMap")} data-incident-live-map><sw-icon name="map" size=${14}></sw-icon><span class="bt">${t("liveMap")}</span></a>
          <a class="lnk" href=${`#/investigate/floors/${e.floor_id}/history?t=${encodeURIComponent(e.opened_at)}`} title=${t("historyMap")}><sw-icon name="history" size=${14}></sw-icon><span class="bt">${t("historyMap")}</span></a>`:d}
      </div>
      <div class="map" data-incident-map>
        ${a&&this.mapState==="ready"?n`<sw-plan-canvas .planWidth=${a.width} .planHeight=${a.height} .imageUrl=${a.imageUrl} .plan=${a.planSvg} .markers=${this.markers} .selectedId=${o}
              .highlightIds=${s} .zones=${ie(a.zones)} alwaysLabel dimEntities></sw-plan-canvas>`:n`<div class="loc">${this.mapState==="loading"?n`<sw-state-panel state="loading" compact quiet></sw-state-panel>`:n`<div><b>${[e.building_name,e.floor_name,e.zone].filter(Boolean).join(" · ")||"-"}</b><br />${h}</div>`}</div>`}
      </div>
    </div>`}renderCameras(e){const a=this.cams,i=this.tileCams,s=i.filter(u=>this.live.has(u.camera_id)).length,o=i.length,h=this.narrow?Math.max(1,o-1):o<=4?Math.min(2,Math.max(1,o)):3,m=this.narrow?o>1?"minmax(0, 1fr) minmax(0, .42fr)":"minmax(0, 1fr)":`repeat(${Math.max(1,Math.ceil(o/h))}, minmax(0, 1fr))`,r=i[0]?.camera_id;return n`<div class="panel fill" data-pane="cams" ?hidden-part=${this.hiddenPart("cams")}>
      <div class="hd"><h2>${t("camsTitle")}</h2>
        ${a.state==="ready"&&o?n`<span class="chip" data-look="ok" data-incident-cams-chip><span class="d"></span><span class="num">${this.narrow?t("camsPhone",{n:s,s:o-s}):t("camsLive",{n:s})}</span></span>`:d}
        <span class="sp"></span>
        ${a.state==="ready"&&r?n`<a class="lnk" href=${`#/investigate/playback?camera=${encodeURIComponent(r)}&t=${encodeURIComponent(e.opened_at)}`} data-incident-full-player><sw-icon name="play" size=${14}></sw-icon>${t("fullPlayer")}</a>`:d}
      </div>
      ${a.state==="loading"?n`<sw-state-panel state="loading" compact quiet></sw-state-panel>`:a.state==="forbidden"?n`<sw-state-panel state="forbidden" compact heading=${t("camsForbidden")} hint=${t("camsForbiddenHint")} data-incident-cams-forbidden></sw-state-panel>`:a.state==="error"?n`<sw-state-panel state="error" compact heading=${t("camsTitle")} hint=${a.message}></sw-state-panel>`:a.state==="hidden"?d:o?n`<div class="tiles" data-incident-tiles style=${`grid-template-columns: repeat(${h}, minmax(0, 1fr)); grid-template-rows: ${m}`}>
            ${i.map((u,y)=>{const k=this.capped.get(u.camera_id),b=this.live.has(u.camera_id)&&!this.paused&&k===void 0,I=this.narrow&&y===0&&o>1?"grid-column: 1 / -1":"";return n`<div class="tile ${y===0&&u.relation!=="floor"?"hot":""}" style=${I} data-incident-tile=${u.camera_id} data-live=${b?"true":"false"}
                role="button" tabindex="0" aria-label=${b?u.name:`${u.name} · ${t("swapLive")}`}
                @click=${()=>this.swapIn(u.camera_id)} @keydown=${x=>{(x.key==="Enter"||x.key===" ")&&(x.preventDefault(),this.swapIn(u.camera_id))}}>
                <sw-camera-tile name=${u.name} meta=${u.relation_label} cameraId=${u.camera_id} state="live" profile="sub" transport="auto" fit="cover" ?compact=${this.narrow&&y>0}
                  ?live=${f()&&b} ?snapshotOnly=${f()&&!b} poster=${f()?J(u.camera_id,b?void 0:this.snapBust):""}
                  @player-status=${x=>this.onPlayerStatus(u.camera_id,x)}></sw-camera-tile>
                ${k!==void 0?n`<span class="capchip" data-incident-cap=${u.camera_id} title=${Q(k)}><sw-icon name="warning" size=${12}></sw-icon>${t("capFull")}</span>`:d}
              </div>`})}
          </div>`:n`<sw-state-panel icon="camera" state="empty" compact quiet heading=${t("camsNone")}></sw-state-panel>`}
    </div>`}renderDoors(){const e=this.doors,a=e.state==="ready"?e.data:null,i=a?a.doors.filter(s=>s.open).length:0;return n`<div class="panel" data-pane="doors" ?hidden-part=${this.hiddenPart("doors")}>
      <div class="hd"><h2>${t("doorsTitle")}</h2>${i?n`<span class="chip" data-look="warn"><span class="d"></span>${t("doorsOpen",{n:i})}</span>`:d}<span class="sp"></span>
        ${a?n`<span class="mut">${t("doorsWindow",{n:Math.round(a.window_s/60)})}</span>`:d}</div>
      ${e.state==="loading"?n`<sw-state-panel state="loading" compact quiet></sw-state-panel>`:e.state!=="ready"?n`<sw-state-panel icon="door" state=${e.state==="forbidden"?"forbidden":"error"} compact quiet heading=${t("doorsTitle")}></sw-state-panel>`:e.data.doors.length?n`<ul class="drs" data-incident-doors>${e.data.doors.slice(0,this.narrow?6:3).map(s=>{const o=s.open===null?"unk":s.open?"warn":"ok",h=s.open===null?e.data.state_visible?t("doorUnknown"):t("doorHidden"):s.open?t("doorOpen"):t("doorLocked"),m=this.who[s.entity_id];return n`<li class="dr" data-look=${o} data-door=${s.entity_id}>
              <sw-badge filled kind=${M(o)} label=${h}></sw-badge>
              <div><span class="t1">${s.name}</span><span class="t2">${[s.area_name,m].filter(Boolean).join(" · ")}</span></div>
              <span class="when num ${s.open?"":"mut"}">${s.since?this.when(s.since):""}</span>
              <a class="lnk" href=${`#/devices?entity=${encodeURIComponent(s.entity_id)}`} data-incident-to-door>${t("toDoor")}</a>
            </li>`})}</ul>`:n`<sw-state-panel icon="door" state="empty" compact quiet heading=${t("doorsNone")}></sw-state-panel>`}
    </div>`}renderInfra(){const e=this.elevators.state==="ready"?this.elevators.data:null,a=this.generators.state==="ready"?this.generators.data:null;if(!e?.length&&!a?.length)return d;const i=[...(e??[]).slice(0,2).map(s=>({id:s.id,icon:"elevator",name:s.name,sub:s.area_name??t("elevator"),look:ce[s.state]??"ok",badge:Z(de[s.state]??"stateUnknown")})),...(a??[]).slice(0,1).map(s=>({id:s.id,icon:"power",name:s.name,sub:s.area_name??t("generator"),look:s.availability==="online"&&!s.stale?"ok":s.availability==="offline"?"off":"warn",badge:s.availability==="online"&&!s.stale?t("genOnline"):s.availability==="offline"?t("genOffline"):t("genStale")}))];return n`<div class="panel infra" data-pane="doors" data-incident-infra ?hidden-part=${this.hiddenPart("doors")}>
      <div class="hd"><h2>${t("infraTitle")}</h2><span class="sp"></span><a class="lnk" href="#/infra/elevators">${t("infraLink")}</a></div>
      <div class="rows">${i.map(s=>n`<div class="li" data-look=${s.look} data-infra=${s.id}><span class="ico"><sw-icon name=${s.icon} size=${16}></sw-icon></span>
        <div class="grow"><div class="t1">${s.name}</div><div class="t2">${s.sub}</div></div><sw-badge filled kind=${M(s.look)} label=${s.badge}></sw-badge></div>`)}</div>
    </div>`}stepText(e){const a=e.actor||t("system");switch(e.kind){case"opened":return{t1:e.text||t("stepOpened"),t2:t("stepOpenedBy",{src:this.detail?.source_label??"",who:a}),look:"alarm"};case"notified":return{t1:t("stepNotified",{n:e.recipients?.length??Number(e.text??0)}),t2:(e.recipients??[]).join(", "),look:"acc"};case"acked":return{t1:t("stepAcked",{who:a}),t2:e.text==="first"?t("stepAckedFirst"):"",look:"ok"};case"door_open":return{t1:e.actor?t("stepDoorOpenBy",{who:e.actor}):t("stepDoorOpen"),t2:[e.text,e.unconfirmed?t("stepDoorUnconfirmed"):""].filter(Boolean).join(" · "),look:"warn"};case"note":return{t1:t("stepNote",{who:a}),t2:e.text?`"${e.text}"`:"",look:"acc"};case"event_added":return{t1:t("stepAdded"),t2:e.text??"",look:"warn"};case"closed":return{t1:t("stepClosed",{who:a}),t2:e.text??"",look:"off"};default:return{t1:e.text??"",t2:"",look:"unk"}}}renderChain(e){const a=this.narrow?9:8,i=e.steps.slice(-a);return n`<div class="panel fill" data-pane="chain" ?hidden-part=${this.hiddenPart("chain")}>
      <div class="hd"><h2>${t("chainTitle")}</h2>${e.pending.length?n`<span class="chip" data-look="warn"><span class="d"></span>${t("chainWaiting",{n:e.pending.length})}</span>`:d}<span class="sp"></span>
        ${e.can_audit?n`<a class="lnk" href=${`#/system/audit?resource_id=${encodeURIComponent(e.id)}`} data-incident-audit>${t("audit")}</a>`:d}</div>
      <ol class="chain" data-incident-chain>
        ${i.map(s=>{const o=this.stepText(s);return n`<li class="step" data-look=${o.look} data-step=${s.kind}><span class="dot"></span><div><div class="t1">${o.t1}</div>${o.t2?n`<div class="t2">${o.t2}</div>`:d}</div><span class="w num">${this.when(s.at)}</span></li>`})}
        ${e.pending.length&&e.status==="open"?n`<li class="step wait" data-step="waiting"><span class="dot"></span><div><div class="t1">${t("stepWaiting")}</div><div class="t2">${e.pending.join(" · ")}</div></div><span class="w">-</span></li>`:d}
      </ol>
      ${e.status==="open"&&e.can_ack?n`<div class="chainfoot"><sw-button size="sm" variant="ghost" icon="edit" data-incident-note @click=${()=>this.sheet="note"}>${t("addNote")}</sw-button></div>`:d}
    </div>`}renderSheets(){const e=this.detail;return n`
      <sw-sheet ?open=${this.sheet==="settings"} heading=${t("sTitle")} data-incident-settings-sheet @close=${()=>this.sheet=null}>
        ${this.sheet==="settings"?n`<incident-settings-form sheet @close=${()=>this.sheet=null} @saved=${()=>{this.sheet=null,this.flash(t("saved")),this.reload(!0)}}></incident-settings-form>`:d}
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
            ${this.manualFloors.map(a=>n`<option value=${a.id} ?selected=${a.id===this.manualFloor}>${a.label}</option>`)}</select></label>
          <label>${t("manualTitle")}<input maxlength="120" placeholder=${t("manualDefault")} .value=${this.manualTitle} @input=${a=>this.manualTitle=a.target.value} /></label>
          <p>${t("physicalNote")}</p>
          <div class="acts"><sw-button @click=${()=>this.sheet=null}>${t("cancel")}</sw-button><sw-button variant="primary" data-incident-manual-open ?disabled=${this.busy||!this.manualFloor} @click=${()=>void this.doManual()}>${t("manualOpen")}</sw-button></div>
        </div>
      </sw-sheet>
      ${e?n`<sw-case-picker .item=${this.casePick} subheading=${`${t("pageTitle")} · ${e.title}`} @close=${()=>this.casePick=null}></sw-case-picker>`:d}`}};l.styles=[te`
    :host { display: flex; flex-direction: column; min-block-size: 0; min-inline-size: 0; color: var(--sw-text); font-family: var(--sw-font); }
    [data-look='ok'] { --c: var(--sw-success); --c-text: var(--sw-success-text); --c-soft: var(--sw-success-soft); }
    [data-look='warn'] { --c: var(--sw-warning); --c-text: var(--sw-warning-text); --c-soft: var(--sw-warning-soft); }
    [data-look='alarm'] { --c: var(--sw-danger); --c-text: var(--sw-danger-text); --c-soft: var(--sw-danger-soft); }
    [data-look='off'] { --c: var(--sw-offline); --c-text: var(--sw-offline-text); --c-soft: var(--sw-offline-soft); }
    [data-look='unk'] { --c: var(--sw-unknown); --c-text: var(--sw-unknown-text); --c-soft: var(--sw-unknown-soft); }
    [data-look='acc'] { --c: var(--sw-accent); --c-text: var(--sw-accent-text); --c-soft: var(--sw-accent-soft); }
    .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .screen { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 10px; min-inline-size: 0; }
    div.screen { padding: 12px var(--sw-page-pad) 14px; }
    .acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .clock { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); padding: 4px 12px; background: var(--sw-surface-3); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-md); }
    .clock sw-icon { color: var(--sw-text-3); }
    /* AUDIT30-G-VIDEO (FIXES G5): the frame is sw-page (title, subtitle, actions as on every operator screen); the board under it keeps
       the height the shell gives (no page scroll, owner rule 2026-10-24) */
    sw-page.screen { flex: 1; min-block-size: 0; block-size: 100%; }
    sw-badge { flex: none; }
    .eyebrow { display: flex; align-items: center; gap: 8px; margin-block-end: 6px; }
    .eyebrow .clock { display: none; }
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
    /* CR-CMP2-TABLES-2450 (owner N10): the recent incidents are the shared table (its rows answer the pointer and the keyboard);
       the list panel's header band, the investigation lists' taller rows and reading size (R5-INVESTIGATE-297 size hooks) */
    sw-table[data-incidents-table] { --sw-table-min: 0; --sw-table-head-bg: var(--sw-surface-2); --sw-table-cell-pad: 12px 14px; --sw-table-fs: var(--sw-fs-md); }
    .cards .c, .dr, .li { transition: transform var(--sw-t-press) var(--sw-ease-out); }
    .cards .c:active { transform: scale(var(--sw-press-scale)); }
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
      div.screen { padding: 10px 20px 12px; }
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
      div.screen { padding: 8px 12px 8px; gap: 8px; }
      .acts { gap: 6px; }
      /* the phone keeps the old header height: the clock rides beside the status (not a row of its own), sw-page's padding and
         gaps one step denser (the board below must not overflow, layout-incidents) */
      sw-page.screen { padding: 8px 12px 8px; gap: 8px; }
      .eyebrow { margin-block-end: 4px; }
      .eyebrow .clock { display: inline-flex; }
      /* the door rows one step denser on a phone (still 44 px targets): with the filled sw-badge a row is two lines plus its padding and
         three of them overflowed the doors part by 9 px at 390x844 (layout-incidents) */
      .drs { gap: 4px; }
      .dr { padding-block: 3px; }
      sw-page[data-incident] .acts > .clock { display: none; }
      .meta { flex-wrap: nowrap; gap: 6px; }
      .clock { padding: 3px 8px; font-size: var(--sw-fs-sm); }
      .map { margin: 0 12px 12px; }
      .panel .hd { padding: 10px 12px 6px; }
      .dr { padding-inline: 10px; grid-template-columns: 56px minmax(0, 1fr) auto; }
      .dr .when { display: none; }
      .chain, .rows { padding-inline: 12px; }
      sw-table[data-incidents-table] { display: none; }
      .cards { display: grid; }
      .ptabs button { min-block-size: 44px; }
    }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `];c([ae()],l.prototype,"incidentId",2);c([p()],l.prototype,"pane",2);c([p()],l.prototype,"narrow",2);c([p()],l.prototype,"now",2);c([p()],l.prototype,"pageError",2);c([p()],l.prototype,"detail",2);c([p()],l.prototype,"list",2);c([p()],l.prototype,"bundle",2);c([p()],l.prototype,"mapState",2);c([p()],l.prototype,"cams",2);c([p()],l.prototype,"doors",2);c([p()],l.prototype,"who",2);c([p()],l.prototype,"elevators",2);c([p()],l.prototype,"generators",2);c([p()],l.prototype,"live",2);c([p()],l.prototype,"paused",2);c([p()],l.prototype,"capped",2);c([p()],l.prototype,"snapBust",2);c([p()],l.prototype,"sheet",2);c([p()],l.prototype,"casePick",2);c([p()],l.prototype,"busy",2);c([p()],l.prototype,"closeNoteText",2);c([p()],l.prototype,"noteText",2);c([p()],l.prototype,"manualFloors",2);c([p()],l.prototype,"manualFloor",2);c([p()],l.prototype,"manualTitle",2);l=c([se("investigate-incidents")],l);function Se(e){return e&&(!f()||ee("events.ack"))}export{l as InvestigateIncidents,Se as mayOpenFromEvent};
