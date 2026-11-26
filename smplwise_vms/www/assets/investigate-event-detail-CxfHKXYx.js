const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as N}from"./sw-logo-art-PLtEZJxU.js";import{a as A,aX as M,eV as O,af as x,q as f,A as h,b as r,a8 as w,aN as z,p as V,bO as y,eW as B,e as j,C as U,eX as W,eY as Y,eZ as $,e_ as H,e$ as G,o as K,j as Z,z as q,k as c,m as F}from"./index-CVsAtsN7.js";import"./sw-case-picker-BV1Ce7WH.js";import{l as J}from"./cases-rjnBXskb.js";import"./sw-plan-canvas-Ddmn1nEp.js";import{g as X,a as Q,c as ee,b as te,l as se,p as ae,d as ie,C as re,t as oe,E as ne}from"./events-B9KJksXc.js";import{b as le}from"./bubble-chrome-CFvMZX-M.js";import{s as de,d as ce,p as E,r as he,t as pe}from"./event-codes-C917iCxm.js";import{I as ue}from"./investigate-r5-css-C654YOfV.js";import{c as me,a as I,p as ve}from"./recordings-B_Ghyp0l.js";import{b as fe}from"./geometry-B4NJVNbI.js";import{c as we,b as be,a as ge,l as ye}from"./plan-catalog-Dx2eRTDE.js";import{e as $e,b as _e}from"./scene-builder-BNWGkecI.js";import{r as S,a as ke,R as T}from"./replay-3d-CsZBzCUs.js";import{b as xe}from"./part-select-CylWA6VC.js";import{i as ze,z as Ee}from"./shared-space-Bk61kJ4D.js";import{w as b,W as C}from"./webgl-BIZLxi4y.js";import{s as D}from"./memo-CyxK7byc.js";import{mayOpenFromEvent as Ie}from"./investigate-incidents-CZNgv2g9.js";import{a as Se}from"./investigate-time-CZln5nVP.js";import{t}from"./investigate-DXAvnChU.js";import"./map-CBK9FVn4.js";import"./candidates-CoxtEVV0.js";import"./material-resolve-4MvgB_4a.js";import"./zones-DioH6FRK.js";import"./quality-ladder-DFUiq870.js";import"./sw-table-Cw74zxXo.js";import"./settings-form-CvAjqj_M.js";import"./live-BzyW7Ndf.js";import"./access-events-B11iXyaT.js";import"./toast-controller-BPX0Tkjm.js";var Te=Object.defineProperty,Ce=Object.getOwnPropertyDescriptor,d=(e,s,a,i)=>{for(var n=i>1?void 0:i?Ce(s,a):s,u=e.length-1,m;u>=0;u--)(m=e[u])&&(n=(i?m(s,a,n):m(n))||n);return i&&n&&Te(s,a,n),n};const De={measured:"recorded",inferred:"unknown",command:"partial",availability:"stale"},Pe={info:t("מידע"),alert:t("התראה"),critical:t("קריטי")},Le={info:"neutral",alert:"stale",critical:"error"},P=e=>he(e.raw_type)??ne[e.type]??e.type,L={alertstream:t("התראה מהמקליט"),recording:t("נגזר מקובץ הקלטה"),system:t("מערכת"),ha:t("חיישן התקן")},R=600*1e3;let l=class extends A{constructor(){super(...arguments),this.bubbleSkin=new M(this),this.eventId="",this.ev=null,this.error="",this.tz="Asia/Jerusalem",this.session=null,this.playerError="",this.bundle=null,this.nearby=[],this.corr=null,this.corrError="",this.route=null,this.busy=!1,this.thumbVersion=0,this.casePick=null,this.routeTicked=null,this.routeCase="",this.routeCases=null,this.routeBusy=!1,this.routeError="",this.routeDone=null,this.geometry=null,this.level=null,this.catalogLookup=null,this.planImage=!0,this.pollTimer=0,this.reads=new O,this.view3d=!1,this.default3d=!1,this.threeState="idle",this.catalog3d=null,this.selected3d=null,this.eventPreset="iso",this.real3d=!1,this.materials3d=null,this.replay=null,this.itemNames=new Map,this.sceneMemo=null}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer),this.reads.cancel(),this.stopPlayer()}updated(e){e.has("eventId")&&e.get("eventId")!==void 0&&this.load(),this.default3d&&!this.view3d&&this.hasScene&&b()&&(this.default3d=!1,this.toggle3d())}async load(){if(!x())return;const e=this.reads.begin(),s=this.eventId;if(this.error="",await this.stopPlayer(),!!e())try{const a=await X(s);if(!e())return;this.ev=a,this.view3d=!1,this.replay=null,this.tz=a.timezone||this.tz,a.location?.has_plan?this.loadMap(a.location.floor_id):this.bundle=null,this.loadNearby(a),this.loadCorrelation(a.id),this.loadRoute(a.id),a.camera_id&&this.play(a),a.thumbnail==="pending"&&this.pollThumb(a.id)}catch(a){if(!e())return;this.error=f(a),this.ev=null}}showing(e){return this.ev?.id===e}async loadRoute(e){this.route=null,this.routeTicked=null,this.routeDone=null,this.routeError="";try{const s=await Q(e);if(!this.showing(e))return;this.route=s,this.route.suggestions.length&&this.routeCases===null&&J({status:"open"}).then(a=>{this.routeCases=a.can_manage?a.cases:[],a.can_manage||(this.routeCases=null)}).catch(()=>this.routeCases=[])}catch{this.showing(e)&&(this.route=null)}}routePicks(){const e=(this.route?.suggestions??[]).map(s=>s.camera_id);return this.routeTicked?e.filter(s=>this.routeTicked.has(s)):e}tickRoute(e,s){const a=new Set(this.routeTicked??this.routePicks());s?a.add(e):a.delete(e),this.routeTicked=a}async confirmRoute(){const e=this.route,s=this.routePicks();if(!(!e||!s.length||this.routeBusy)){this.routeBusy=!0,this.routeError="";try{this.routeDone=await ee(e.event_id,{camera_ids:s,case_id:this.routeCase||void 0}),this.routeDone.created&&(this.routeCases=[...this.routeCases??[],{id:this.routeDone.case_id,title:this.routeDone.title}]),this.routeCase=this.routeDone.case_id}catch(a){this.routeError=f(a)}finally{this.routeBusy=!1}}}renderRoute(){const e=this.route;if(!e||!e.spatial)return h;const s=new Set(this.routePicks()),a=i=>i==="same_zone"?"recorded":i==="adjacent_zone"?"partial":i==="via_connector"?"stale":"neutral";return r`<sw-card heading=${t("המשך מסלול מוצע")} subheading=${`${t("השערה לפי טופולוגיית המפה")} · ${t("±{n} שניות",{n:Math.round((new Date(e.window.to).getTime()-new Date(e.window.from).getTime())/1e3)})}`} data-route>
      ${e.suggestions.length?r`<div class="corr" data-route-list>${e.suggestions.map(i=>r`<div class="link route" data-route-item data-relation=${i.relation} data-camera=${i.camera_id}>
              <span class="rel"><input type="checkbox" aria-label=${t("כלול את {name} במסלול",{name:i.name})} data-route-tick=${i.camera_id} .checked=${s.has(i.camera_id)} @change=${n=>this.tickRoute(i.camera_id,n.target.checked)} />${i.via?r`<sw-icon name=${i.via.kind==="elevator"?"elevator":"stairs"} size=${14}></sw-icon>`:h}<sw-badge kind=${a(i.relation)} label=${i.relation_label}></sw-badge></span>
              <span>${i.name}${i.zone?r` · ${i.zone}`:h}${i.via?r` · ${i.via.floor_name}`:h}<small>${i.activity_events?t("{n} אירועים בחלון",{n:i.activity_events}):t("ללא אירועים בחלון")} · ${t("מרחק {n} יח׳ תוכנית",{n:Math.round(i.distance*100)})}${i.via?.label?` · ${i.via.label}`:""}</small></span>
              <sw-button size="sm" icon="play" @click=${()=>w("/investigate/playback",{camera:i.camera_id,t:i.playback_at})}>${t("נגן")}</sw-button>
            </div>`)}</div>
          ${this.routeCases!==null?r`<div class="routeconfirm" data-route-confirm>
                <select aria-label=${t("תיק")} data-route-case .value=${this.routeCase} @change=${i=>this.routeCase=i.target.value}>
                  <option value="" ?selected=${!this.routeCase}>${t("תיק חדש")}</option>
                  ${(this.routeCases??[]).map(i=>r`<option value=${i.id} ?selected=${i.id===this.routeCase}>${i.title}</option>`)}
                </select>
                <sw-button variant="primary" size="sm" icon="case" ?disabled=${!s.size||this.routeBusy} data-route-confirm-button @click=${()=>this.confirmRoute()}>${this.routeBusy?t("מוסיף…"):t("אשר מסלול לתיק ({n})",{n:s.size})}</sw-button>
                ${this.routeDone?r`<span class="ok" data-route-done role="status">${t("נוסף לתיק „{title}”",{title:this.routeDone.title})}${this.routeDone.skipped.length?` · ${t("{n} דולגו",{n:this.routeDone.skipped.length})}`:""} · <a href=${`#/investigate/cases/${this.routeDone.case_id}`}>${t("פתח")}</a></span>`:h}
                ${this.routeError?r`<span class="err" role="alert" data-route-error>${this.routeError}</span>`:h}
              </div>`:h}`:r`<div class="note" style="margin:0">${t("אין מצלמות נוספות בסביבה על התוכנית.")}</div>`}
      ${e.notes.length?r`<ul class="corrnotes">${e.notes.map(i=>r`<li>${i}</li>`)}</ul>`:h}
      <div class="note">${e.policy}</div>
    </sw-card>`}async loadCorrelation(e){this.corr=null,this.corrError="";try{const s=await te(e);this.showing(e)&&(this.corr=s)}catch(s){this.showing(e)&&(this.corrError=f(s))}}async loadMap(e){const s=this.ev?.id;try{const a=await z(e);if(this.ev?.id!==s)return;this.bundle=a,this.restorePlanImage(e),V().then(n=>{this.bundle===a&&(this.level=ze(n["plan.levels"],a)),this.bundle===a&&(this.default3d=n["map.default_view"]==="3d"&&!this.view3d)}).catch(()=>{}),a.source==="api"&&we(a.catalogRevision).then(n=>{this.catalogLookup=be(n),this.catalog3d=ge(n),this.materials3d=ye(n),this.itemNames=new Map(n.items.map(u=>[u.id,u.names.he]))}).catch(()=>{}),this.geometry=null;const i=await fe(a);this.bundle===a&&(this.geometry=i)}catch{this.bundle=null,this.geometry=null}}setPlanImage(e){this.planImage=e;const s=this.bundle?.floorId;if(s)try{localStorage.setItem(`sw.event.background.${s}`,e?"1":"0")}catch{}}restorePlanImage(e){try{this.planImage=localStorage.getItem(`sw.event.background.${e}`)!=="0"}catch{this.planImage=!0}}async loadNearby(e){try{const s=new Date(e.occurred_at).getTime(),a=n=>y(n),i=await se({from:a(s-R),to:a(s+R),limit:30});this.showing(e.id)&&(this.nearby=i.events.filter(n=>n.id!==e.id).slice(0,6))}catch{this.showing(e.id)&&(this.nearby=[])}}pollThumb(e){window.clearTimeout(this.pollTimer),this.pollTimer=window.setTimeout(()=>{(async()=>{const s=await ae(e).catch(()=>"unavailable");this.ev?.id===e&&(s==="pending"?this.pollThumb(e):(this.ev={...this.ev,thumbnail:s},s==="ready"&&(this.thumbVersion=Date.now())))})().catch(()=>{this.ev?.id===e&&(this.ev={...this.ev,thumbnail:"unavailable"})})},1500)}async play(e){if(e.camera_id){this.playerError="";try{const s=y(new Date(e.occurred_at).getTime()-2e3),a=await me(e.camera_id,s);this.ev?.id===e.id?this.session=a:await I(a.id).catch(()=>{})}catch(s){this.showing(e.id)&&(this.playerError=f(s))}}}async stopPlayer(){const e=this.session;this.session=null,e&&await I(e.id).catch(()=>{})}async ack(){const e=this.ev;if(!(!e||e.acked_at)){this.busy=!0;try{const s=await ie(e.id);this.ev={...e,acked_at:s.acked_at,acked_by_username:s.acked_by_username}}catch(s){this.error=f(s)}finally{this.busy=!1}}}async openLive(e){this.busy=!0;try{const s=await B({event_id:e});w(`/investigate/incidents/${encodeURIComponent(s.incident.id)}`)}catch(s){this.error=f(s)}finally{this.busy=!1}}fmt(e,s=!1){const a=new Date(e),i=j(a,{timeZone:this.tz,seconds:!0});return s?`${U(a,{timeZone:this.tz})} · ${i}`:i}renderCorrelation(){const e=this.corr,s=e?`${t("±{n} שניות",{n:e.window_s})} · ${e.spatial?t("סביבת {place} ({floor})",{place:e.location?.zone??t("המיקום על התוכנית"),floor:e.location?.floor_name??""}):t("לפי זמן בלבד")}`:this.corrError?t("לא נטען"):t("טוען…");return r`<sw-card heading=${t("קורלציה דלת–מצלמה–חיישן")} subheading=${s} data-correlation>
      ${e?r`${e.entities.length?r`<div class="note" style="margin:0 0 6px" data-correlation-entities>${t("בסביבה:")} ${e.entities.map(a=>`${a.name}${a.state_missing?` ${t("(ללא מצב)")}`:a.state?` · ${a.state}`:""}`).join(" · ")}</div>`:r`<div class="note" style="margin:0 0 6px" data-correlation-entities>${t("אין חיישנים או מנעולים מוצבים בסביבה.")}</div>`}
            ${e.links.length?r`<div class="corr" data-correlation-links>${e.links.map(a=>r`<div class="link" data-correlation-link data-certainty=${a.certainty}>
                    <span class="ltr num">${t("{n} שנ׳",{n:`${a.delta_s>0?"+":""}${a.delta_s}`})}</span>
                    <span>${a.kind==="camera"&&a.event_id?r`<a href=${`#/investigate/events/${a.event_id}`}>${a.label}</a>`:a.kind==="sensor"&&a.event_id?r`<a href=${`#/investigate/events/${a.event_id}`}>${a.label}</a>`:a.label}<small>${a.note}</small></span>
                    <sw-badge kind=${De[a.certainty]} label=${re[a.certainty]}></sw-badge>
                  </div>`)}</div>`:r`<div class="note" style="margin:0">${t("לא נרשם דבר בחלון הזמן מהחיישנים, המנעולים והמצלמות שבסביבה.")}</div>`}
            ${e.notes.length?r`<ul class="corrnotes">${e.notes.map(a=>r`<li data-correlation-note=${a.code}>${a.text}</li>`)}</ul>`:h}
            <div class="note">${e.policy}</div>`:this.corrError?r`<div class="note">${this.corrError}</div>`:h}
    </sw-card>`}duration(e){return e.ended_at?de(e.occurred_at,e.ended_at)??t("פחות משנייה"):typeof e.details.seconds=="number"?t("{n} שנ׳ (הקלטה)",{n:String(e.details.seconds)}):"—"}renderTech(e){const s=e.details,a=typeof s.description=="string"?s.description:"",i=typeof s.time_precision=="string"?s.time_precision:"",n=typeof s.device_time=="string"?s.device_time:"";return r`<details class="tech" data-tech-details>
      <summary><sw-icon name="info" size=${14}></sw-icon><span>${t("פרטים טכניים")}</span><sw-icon class="chev" name="chevron" size=${14}></sw-icon></summary>
      <div class="kv">
        <span>${t("קוד המכשיר")}</span><b><span class="ltr">${e.raw_type||"—"}</span></b>
        ${a?r`<span>${t("טקסט המכשיר")}</span><b>${ce(a)??r`<span class="ltr">${a}</span>`}</b>`:h}
        ${i?r`<span>${t("דיוק הזמן")}</span><b>${E(i)??i} <span class="ltr" style="color:var(--sw-text-3)">${i}</span></b>`:h}
        ${n?r`<span>${t("שעון המכשיר")}</span><b><span class="ltr">${this.fmt(n,!0)}</span></b>`:h}
        <span>${t("נקלט")}</span><b><span class="ltr">${this.fmt(e.received_at,!0)}</span></b>
        <span>${t("מקור · ודאות")}</span><b><span class="ltr">${e.source} · ${e.confidence}</span></b>
        ${e.recorder_id||e.channel?r`<span>${t("מקליט · ערוץ")}</span><b><span class="ltr">${e.recorder_id??"—"} · ${e.channel??"—"}</span></b>`:h}
        <span>${t("מזהה האירוע")}</span><b><span class="ltr">${e.id}</span></b>
      </div>
    </details>`}get markers(){const e=this.bundle;return e?e.anchors.map(s=>({id:s.id,kind:s.resource_type==="camera"?"camera":Y(s.layer_id,s.entity?.domain),label:s.camera?.name??s.entity?.name??s.label??s.resource_id,x:s.position.x,y:s.position.y,rotation:s.rotation_degrees,fov:s.field_of_view_degrees??void 0,level:s.level_id??null,state:s.resource_type==="camera"?W(s):"neutral"})):[]}get hasScene(){return this.bundle?.source==="api"&&this.geometry!==null}get sceneDescription(){const e=this.bundle,s=this.geometry;if(!this.view3d||!e||e.source!=="api"||!s)return null;const a=this.replay&&this.replay.eventId===this.ev?.id?this.replay:null,i=[e,s,this.catalog3d,this.level,this.itemNames,a,this.real3d,this.materials3d];if(this.sceneMemo&&D(this.sceneMemo.refs,i))return this.sceneMemo.desc;const n=o=>o.resource_type==="ha_entity"?a?.entityStates[o.resource_id]??null:null,u=e.anchors.map(o=>({id:o.id,resource_type:o.resource_type,resource_id:o.resource_id,x:o.position.x,y:o.position.y,rotation:o.rotation_degrees,fov:o.field_of_view_degrees??null,radius:o.coverage_radius??null,polygon:o.coverage_polygon??null,level_id:o.level_id??null,layer_id:o.layer_id,label:$(o),state:n(o),online:o.resource_type==="camera"&&o.camera?o.camera.status==="online":null,mount_height_m:o.mount_height_m??null,tilt_deg:o.tilt_deg??null,...o.resource_type==="ha_entity"&&o.entity?{entity_meta:$e(o.entity,!1)}:{}})),m=Object.fromEntries([...new Set(e.anchors.filter(o=>o.resource_type==="ha_entity").map(o=>o.resource_id))].sort().map(o=>[o,a?.entityStates[o]??null])),p=a?.circuitStates??{},v=e.zones.map(o=>({id:o.id,name:o.name,polygon:o.polygon,level_id:o.level_id??null})),_=[JSON.stringify([e.floorId,e.width,e.height,u,m,p,v]),s,this.catalog3d,this.level,this.itemNames,this.real3d,this.materials3d];if(this.sceneMemo&&D(this.sceneMemo.keys,_))return this.sceneMemo={...this.sceneMemo,refs:i},this.sceneMemo.desc;const k=_e({doc:s,width:e.width,height:e.height,anchors:u,entityStates:m,circuitStates:p,catalog:this.catalog3d,zones:v,level:this.level,anchorsEveryLevel:!0,...this.real3d?{realistic:!0,materialsCatalog:this.materials3d}:{}}),g={};for(const o of e.anchors)g[o.id]=$(o);for(const o of s.objects)g[o.id]=o.label||this.itemNames.get(o.item_id)||o.item_id;for(const o of e.zones)g[o.id]=o.name;return this.sceneMemo={refs:i,keys:_,desc:k,labels:g},k}onPartSelect(e){const{id:s,kind:a}=e.detail;if(!s){this.selected3d=null;return}const i=a?xe({id:s,kind:a},this.geometry,this.bundle?.anchors??[]):null;i&&"anchor"in i&&(this.selected3d=i.anchor)}get shows3d(){return this.view3d&&this.threeState==="ready"&&this.sceneDescription!==null}async toggle3d(){if(this.view3d){this.view3d=!1;return}if(!b()||!this.hasScene||this.threeState==="loading")return;if(this.threeState!=="ready"){this.threeState="loading";try{await N(()=>import("./sw-plan-3d-igSau6sx.js").then(s=>s.s),__vite__mapDeps([0]),import.meta.url),this.threeState="ready"}catch{this.threeState="error";return}}const e=this.ev?.location?.anchor_id??null;this.selected3d=e,this.eventPreset=e?{camera:`cam:${e}`}:"iso",this.ev&&this.replay?.eventId!==this.ev.id&&this.loadReplay(this.ev),this.view3d=!0}async loadReplay(e){const s=e.location?.floor_id,a=S(e.occurred_at);if(!(!s||a===null))try{const i=await z(s,!1,y(a));this.ev?.id===e.id&&(this.replay={eventId:e.id,...ke(i.anchors,i.circuitStates)})}catch{}}render(){if(!x())return r`<sw-page heading=${t("אירוע")}><sw-state-panel icon="history" state="empty" heading=${t("דף האירוע זמין עם השרת")} hint=${t("במצב הדגמה אין אירועים אמיתיים.")}></sw-state-panel></sw-page>`;if(this.error&&!this.ev)return r`<sw-page heading=${t("אירוע")}><sw-state-panel state="error" hint=${this.error} actionLabel=${t("נסה שוב")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;const e=this.ev;if(!e)return r`<sw-page heading=${t("אירוע")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const s=P(e),a=Se(e.occurred_at),i=e.camera_name??(e.channel?t("ערוץ {n}",{n:e.channel}):t("מערכת")),n=e.location,u=n?`${n.building_name} · ${n.floor_name}${n.zone?` / ${n.zone}`:""}`:null,m=!!e.acked_at;return r`
      <sw-page heading=${`${s} · ${i}`} subheading=${`${this.fmt(e.occurred_at,!0)}${a?` · ${a}`:""} · ${L[e.source]??e.source}`} crumbs=${`${t("חקירה")} | ${t("אירועים")} | ${s}`} wide>
        <sw-button slot="actions" variant=${m?"ghost":"primary"} icon="check" data-ack ?disabled=${m||this.busy} @click=${()=>this.ack()}>${m?t("טופל"):t("סמן כטופל")}</sw-button>
        <sw-button slot="actions" icon="case" data-add-to-case @click=${()=>this.casePick={kind:"event",event_id:e.id}}>${t("הוסף לתיק")}</sw-button>
        ${Ie(H())?r`<sw-button slot="actions" icon="warning" data-open-incident ?disabled=${this.busy} @click=${()=>void this.openLive(e.id)}>${G("fromEvent")}</sw-button>`:h}
        <sw-button slot="actions" variant="ghost" icon="list" @click=${()=>w("/investigate/events")}>${t("למרכז האירועים")}</sw-button>
        ${this.error?r`<div class="err" role="alert">${this.error}</div>`:h}
        <div class="layout">
          <div>
            <div class="player" data-player>
              ${this.session?r`<sw-live-player .wsUrl=${ve(this.session)} mode="mse" .retry=${!1}></sw-live-player>`:e.thumbnail==="ready"?r`<img src=${oe(e.id,this.thumbVersion)} alt=${t("תמונת האירוע מההקלטה")} />`:r`<div class="hint">${e.camera_id?this.playerError?t("ההקלטה לא נפתחה: {error}",{error:this.playerError}):e.thumbnail==="unavailable"?t("אין הקלטה זמינה בזמן האירוע"):t("פותח את ההקלטה…"):t("אירוע ללא מצלמה — אין וידאו")}</div>`}
              <span class="chip"><sw-icon name="clock" size=${12}></sw-icon>${this.session?t("הקלטה"):e.thumbnail==="ready"&&!this.session?t("תמונה מההקלטה"):t("אירוע")}</span>
              <div class="caption">${i}<small>${t("זמן האירוע")} <span class="ltr">${this.fmt(e.occurred_at)}</span>${this.session?.actual_start_at?r` · ${t("הנגן מתחיל")} <span class="ltr">${this.fmt(this.session.actual_start_at)}</span>${this.session.time_precision!=="verified"?` (${this.session.time_precision==="keyframe_limited"?E("keyframe_limited"):t("משוער")})`:""}`:h}</small></div>
            </div>
            <div class="bar">
              <span>${this.session?t("הנגן פותח את ההקלטה שתי שניות לפני זמן האירוע; זמן האירוע וזמן הפריים המנוגן מוצגים בנפרד."):e.playerHint??""}</span>
              <span class="grow"></span>
              ${e.camera_id?r`<sw-button size="sm" icon="history" @click=${()=>w("/investigate/playback",{camera:e.camera_id,t:e.occurred_at})}>${t("הנגן המלא עם ציר הזמן")}</sw-button>`:h}
              ${e.camera_id?r`<sw-button size="sm" variant="ghost" icon="play" @click=${()=>this.session?this.stopPlayer():this.play(e)}>${this.session?t("עצור"):t("נגן שוב")}</sw-button>`:h}
            </div>
          </div>
          <div class="side">
            <sw-card heading=${t("הקשר האירוע")} data-context>
              <dl class="meta">
                <div><dt>${t("מצב")}</dt><dd data-status>${m?r`<sw-badge filled kind="live" label=${`${t("טופל")} · ${e.acked_by_username??""}`}></sw-badge> <span class="note" style="margin:0">${this.fmt(e.acked_at,!0)}</span>`:r`<sw-badge filled kind="stale" label=${t("טרם טופל")}></sw-badge>`}</dd></div>
                <div><dt>${t("חומרה")}</dt><dd data-severity><sw-badge ?filled=${e.severity!=="info"} kind=${Le[e.severity]??"neutral"} label=${Pe[e.severity]??e.severity}></sw-badge></dd></div>
                <div class="wide"><dt>${t("זמן")}</dt><dd><span class="ltr">${this.fmt(e.occurred_at,!0)}</span>${a?r` <span class="rel">· ${a}</span>`:h}</dd></div>
                <div><dt>${t("סוג")}</dt><dd>${s}${e.confidence==="inferred"?` · ${t("נגזר")}`:""}</dd></div>
                <div><dt>${t("משך")}</dt><dd>${this.duration(e)}${e.count>1?` · ${t("{n} חזרות",{n:e.count})}`:""}</dd></div>
                <div class="wide"><dt>${t("מיקום")}</dt><dd data-where>${u??(e.camera_id?t("המצלמה עדיין לא מוצבת על תוכנית"):"—")}</dd></div>
                <div class="wide"><dt>${t("מקור")}</dt><dd>${L[e.source]??e.source}${e.camera_id?r` · ${i}`:h}</dd></div>
              </dl>
              ${this.renderTech(e)}
              ${n&&n.has_plan&&this.bundle?r`<div class="map" style=${this.view3d?"block-size:320px":""}>
                    <div class="floorchip"><sw-icon name="building" size=${12}></sw-icon>${n.floor_name}</div>
                    <div class="tools3d">
                      ${this.bundle.imageUrl?r`<sw-button size="sm" icon="map" aria-pressed=${this.planImage} data-plan-background title=${this.planImage?t("הסתר את תמונת התוכנית"):t("הצג את תמונת התוכנית")} @click=${()=>this.setPlanImage(!this.planImage)}>${t("תמונת התוכנית")}</sw-button>`:h}
                      <sw-button size="sm" icon="cube" aria-pressed=${this.view3d} data-event-3d-toggle ?disabled=${!this.view3d&&(!b()||!this.hasScene||this.threeState==="loading")}
                        title=${b()?this.hasScene?t("מבט מהמצלמה בתלת-ממד"):t("אין מבנה מפורסם לקומה הזו"):C} @click=${()=>this.toggle3d()}>${this.view3d?"2D":"3D"}</sw-button>
                    </div>
                    ${this.shows3d&&this.sceneDescription?r`<sw-plan-3d data-event-3d .description=${this.sceneDescription} .selectedId=${this.selected3d} .preset=${this.eventPreset} .frameKey=${e.id} .labels=${this.sceneMemo?.labels??{}}
                          .cameras=${this.bundle.anchors.filter(p=>p.resource_type==="camera").map(p=>({id:p.id,label:$(p)}))} exportName=${`plan-3d-${n.floor_name}-${e.id}`}
                          .sunAt=${S(e.occurred_at)} .walkable=${T.walkable} .stillsAvailable=${T.stillsAvailable}
                          @realistic-change=${p=>{this.real3d!==p.detail.on&&(this.real3d=p.detail.on)}}
                          @part-select=${p=>this.onPartSelect(p)}></sw-plan-3d>`:h}
                    <sw-plan-canvas style=${this.shows3d?"display:none":""} .planWidth=${this.bundle.width} .planHeight=${this.bundle.height} .imageUrl=${this.bundle.imageUrl} .hideImage=${!this.planImage} .plan=${this.bundle.planSvg} .markers=${this.markers} .selectedId=${n.anchor_id} .zones=${Ee(this.bundle.zones)} .geometry=${this.geometry} .structureLevel=${this.level} .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(this.bundle.anchors.map(p=>[`${p.resource_type}:${p.resource_id}`,{x:p.position.x,y:p.position.y,rotation:p.rotation_degrees}]))} alwaysLabel dimEntities></sw-plan-canvas>
                    ${this.threeState==="loading"?r`<div class="load3d" data-3d-loading>${t("טוען תלת-ממד…")}</div>`:h}
                  </div>
                  ${b()?h:r`<div class="note" data-event-3d-unavailable>${C}</div>`}
                  ${this.threeState==="error"?r`<div class="note err" data-3d-load-error>${t("תלת-ממד לא נטען.")}</div>`:h}
                  ${this.view3d?r`<div class="note" data-event-3d-note>${K("replay3d.eventNote")}</div>`:h}
                  <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
                    <sw-button size="sm" icon="map" data-history-map @click=${()=>w(`/investigate/floors/${n.floor_id}`,{t:e.occurred_at,camera:e.camera_id??""})}>${t("המשך חקירה במפה")}</sw-button>
                    <sw-button size="sm" variant="ghost" icon="live" @click=${()=>w(`/explore/floors/${n.floor_id}`)}>${t("מפה חיה")}</sw-button>
                  </div>`:n?r`<div class="note">${t("לקומה {floor} אין תוכנית מפורסמת עדיין.",{floor:n.floor_name})}</div>`:h}
              <div class="note">${t('מיקום סמוך הוא הקשר, לא הוכחת קשר סיבתי; סימון "טופל" נרשם באודיט בשם המשתמש.')}</div>
            </sw-card>
            ${this.renderCorrelation()}
            ${this.renderRoute()}
            <sw-card heading=${t("אירועים קרובים")} subheading=${t("±10 דקות סביב האירוע")}>
              ${this.nearby.length?r`<div class="nearby" data-nearby>${this.nearby.map(p=>{const v=Math.round((new Date(p.occurred_at).getTime()-new Date(e.occurred_at).getTime())/6e4);return r`<a href=${`#/investigate/events/${p.id}`}><span>${P(p)} · ${p.camera_name??(p.channel?t("ערוץ {n}",{n:p.channel}):t("מערכת"))}</span><span class="ltr" title=${v===0?t("באותה דקה"):v>0?t("{n} דק׳ אחרי",{n:v}):t("{n} דק׳ לפני",{n:-v})}>${this.fmt(p.occurred_at)}</span></a>`})}</div>`:r`<div class="note" style="margin:0">${t("אין אירועים נוספים בחלון הזה.")}</div>`}
            </sw-card>
          </div>
        </div>
        <sw-case-picker .item=${this.casePick} subheading=${`${s} · ${i} · ${this.fmt(e.occurred_at,!0)}`} @close=${()=>this.casePick=null}></sw-case-picker>
      </sw-page>
    `}};l.styles=[pe,Z`
    /* INVREST-POLISH-2331: from 900 px up the page takes exactly the height the shell leaves it and never scrolls - the player stays
       in view at the start, the context column (facts, map, correlation, route, nearby events) scrolls in its own box at the end, the
       header actions are always on screen. Narrower (a phone): one column, the page scrolls as before. */
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
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) clamp(340px, 27vw, 440px);
      gap: 16px;
      align-items: start;
    }
    @media (min-width: 901px) {
      sw-page {
        block-size: 100%;
      }
      .layout {
        flex: 1;
        min-block-size: 0;
        grid-template-rows: minmax(0, 1fr);
        align-items: stretch;
      }
      .side {
        min-block-size: 0;
        overflow: auto;
        overscroll-behavior: contain;
        /* room for the cards' shadows inside the scroll box */
        padding: 2px 4px 8px;
        margin: -2px -4px 0;
      }
      /* the player keeps its 16:9 but never pushes the page past the screen: bounded by the room under the header */
      .player {
        max-block-size: calc(100dvh - 300px);
      }
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .rel {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    /* SHARED-POLISH-2342: the disclosure is the shared techDetailsStyles (styles/tech-details.ts, the events list's look); only its
       place under the facts and the semibold summary stay here */
    details.tech {
      margin-block-start: 10px;
    }
    details.tech > summary {
      font-weight: var(--sw-fw-semibold);
    }
    .kv {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 3px 12px;
      margin-block-start: 6px;
    }
    .kv > span {
      color: var(--sw-text-3);
    }
    .kv > b {
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
      overflow-wrap: anywhere;
    }
    .player {
      position: relative;
      aspect-ratio: 16 / 9;
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-3);
    }
    .player sw-live-player,
    .player img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
    }
    .player .hint {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-on-video-2);
      font-size: var(--sw-fs-sm);
      text-align: center;
      padding: 20px;
    }
    .chip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-sm);
      padding: 4px 10px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    /* R5-INVESTIGATE-297 loop 2 (break-ui): the caption is bounded by the stage and breaks an unbreakable camera name instead of
       running past the frame at 390 px; the name reads as a title */
    .caption {
      position: absolute;
      inset-inline-start: 12px;
      inset-inline-end: 12px;
      inset-block-end: 12px;
      color: var(--sw-on-video);
      text-shadow: 0 1px 2px color-mix(in srgb, var(--sw-video-shadow-ink) 60%, transparent);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .caption small {
      display: block;
      opacity: 0.85;
      font-size: var(--sw-fs-xs);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-start: 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .bar .grow {
      flex: 1;
    }
    /* R5-INVESTIGATE-297: the facts are wells (value first, label as caption), two per row */
    dl.meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: 0;
    }
    dl.meta > div {
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      padding: 8px 12px;
      min-inline-size: 0;
    }
    dl.meta > div.wide {
      grid-column: 1 / -1;
    }
    dl.meta dt {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-end: 2px;
    }
    dl.meta dd {
      margin: 0;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
      overflow-wrap: anywhere;
    }
    .map {
      position: relative;
      block-size: 230px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-map-bg);
      margin-block-start: 10px;
    }
    .map sw-plan-canvas {
      block-size: 100%;
      min-block-size: 0;
    }
    .map sw-plan-3d {
      min-block-size: 0;
    }
    .tools3d {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 6px;
      /* the picture and 2D / 3D buttons float over the map with no box of their own: the shared buttons read --sw-surface, so here it is the opaque
         menu surface and their hover fill that surface washed 8 % towards the ink (an opaque mix); Tesla's flat buttons take --hud-fill
         (skins/tesla.ts) - owner 2026-10-13, styles/menu-surface.ts */
      --sw-surface: var(--sw-menu-surface);
      --sw-surface-2: color-mix(in srgb, var(--sw-menu-surface) 92%, var(--sw-text));
      --hud-fill: var(--sw-menu-surface);
    }
    .load3d {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-menu-surface);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      z-index: var(--sw-z-map-ui);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .corr {
      display: flex;
      flex-direction: column;
    }
    .corr .link {
      display: grid;
      grid-template-columns: 68px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .corr .link:last-child {
      border-block-end: 0;
    }
    .corr small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .corr .num {
      font-variant-numeric: tabular-nums;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
    }
    .corrnotes {
      margin: 8px 0 0;
      padding-inline-start: 18px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    /* M064: a tick per suggested camera and the one-click confirmation row of the route card */
    .corr .link.route {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .corr .link.route .rel {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .corr .link.route input[type='checkbox'] {
      margin: 0;
      accent-color: var(--sw-accent);
    }
    .routeconfirm {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-block-start: 10px;
      padding-block-start: 10px;
      border-block-start: 1px solid var(--sw-border);
    }
    .routeconfirm select {
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 220px;
    }
    .routeconfirm .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-sm);
    }
    .nearby {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-block-start: 6px;
    }
    /* R5-INVESTIGATE-297: a nearby event is a well that sinks on pointer-down; hover only under a fine pointer */
    .nearby a {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      min-block-size: 42px;
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      background: var(--sw-surface-2);
      transition: transform var(--sw-t-press) var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .nearby a .ltr {
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    @media (hover: hover) and (pointer: fine) {
      .nearby a:hover {
        background: var(--sw-surface-3);
      }
    }
    .nearby a:active {
      transform: scale(var(--sw-press-scale));
    }
    .nearby a:focus-visible,
    .corr .link a:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .corr .link {
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 8px;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: var(--sw-font-mono);
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,le,ue];d([q()],l.prototype,"eventId",2);d([c()],l.prototype,"ev",2);d([c()],l.prototype,"error",2);d([c()],l.prototype,"tz",2);d([c()],l.prototype,"session",2);d([c()],l.prototype,"playerError",2);d([c()],l.prototype,"bundle",2);d([c()],l.prototype,"nearby",2);d([c()],l.prototype,"corr",2);d([c()],l.prototype,"corrError",2);d([c()],l.prototype,"route",2);d([c()],l.prototype,"busy",2);d([c()],l.prototype,"thumbVersion",2);d([c()],l.prototype,"casePick",2);d([c()],l.prototype,"routeTicked",2);d([c()],l.prototype,"routeCase",2);d([c()],l.prototype,"routeCases",2);d([c()],l.prototype,"routeBusy",2);d([c()],l.prototype,"routeError",2);d([c()],l.prototype,"routeDone",2);d([c()],l.prototype,"geometry",2);d([c()],l.prototype,"level",2);d([c()],l.prototype,"catalogLookup",2);d([c()],l.prototype,"planImage",2);d([c()],l.prototype,"view3d",2);d([c()],l.prototype,"threeState",2);d([c()],l.prototype,"catalog3d",2);d([c()],l.prototype,"selected3d",2);d([c()],l.prototype,"eventPreset",2);d([c()],l.prototype,"real3d",2);d([c()],l.prototype,"replay",2);l=d([F("investigate-event-detail")],l);export{l as InvestigateEventDetail};
