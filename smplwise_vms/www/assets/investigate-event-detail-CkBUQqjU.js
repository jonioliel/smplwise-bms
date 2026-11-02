const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{a as R,S as L,i as _,s6 as N,R as v,s7 as A,s8 as M,A as c,e as i,aj as w,s9 as O,at as k,J as V,pD as B,r_ as U,s4 as j,dZ as Z,n as H,hU as G,sa as W,bf as Y,bg as F,dT as g,_ as K,e4 as J,e1 as q,pH as Q,dU as X,pF as ee,C as te,E as se,F as ae,G as d,H as ie}from"./index-BJCfUqyq.js";import"./sw-case-picker-BSnpeKxe.js";import{a as re}from"./cases-DO94E2E_.js";import"./sw-plan-canvas-CtCnvcDV.js";import{s as oe,d as ne,p as x,r as le,t as de}from"./event-codes-_GCJduov.js";import{I as ce}from"./investigate-r5-css-uia8xhGH.js";import{b as pe,g as z,p as he}from"./recordings-ChfRjSpa.js";import{w as ue}from"./geometry-BmHj220M.js";import{l as me,a as ve,f as we,d as fe}from"./plan-catalog-NOZ7XgEy.js";import{b as be}from"./scene-builder-73j4T_LL.js";import{s as E,a as I,r as ge,R as S}from"./memo-ByNsa-at.js";import{b as ye}from"./part-select-CylWA6VC.js";import{k as $e,b3 as _e}from"./shared-space-BS50pXKS.js";import{w as f,W as T}from"./webgl-U1M5Oj-F.js";import{mayOpenFromEvent as ke}from"./investigate-incidents-Caf1SX45.js";import{a as xe}from"./investigate-time-CzLs0TRB.js";import"./sw-logo-art-Va6y_cIM.js";import"./candidates-CS7-ly_Q.js";import"./material-resolve-OmXMrGyK.js";import"./zones-C8qTgL59.js";import"./settings-form-BE_Ps8LL.js";import"./access-events-CUVQFATj.js";import"./lead-reserve-RFWcnNBy.js";var ze=Object.defineProperty,Ee=Object.getOwnPropertyDescriptor,l=(e,t,a,s)=>{for(var o=s>1?void 0:s?Ee(t,a):t,u=e.length-1,h;u>=0;u--)(h=e[u])&&(o=(s?h(t,a,o):h(o))||o);return s&&o&&ze(t,a,o),o};const Ie={measured:"recorded",inferred:"unknown",command:"partial",availability:"stale"},Se={info:"מידע",alert:"התראה",critical:"קריטי"},Te={info:"neutral",alert:"stale",critical:"error"},D=e=>le(e.raw_type)??ee[e.type]??e.type,C={alertstream:"התראה מה־NVR",recording:"נגזר מקובץ הקלטה",system:"מערכת",ha:"חיישן התקן"},P=600*1e3;let n=class extends R{constructor(){super(...arguments),this.bubbleSkin=new L(this),this.eventId="",this.ev=null,this.error="",this.tz="Asia/Jerusalem",this.session=null,this.playerError="",this.bundle=null,this.nearby=[],this.corr=null,this.corrError="",this.route=null,this.busy=!1,this.thumbVersion=0,this.casePick=null,this.routeTicked=null,this.routeCase="",this.routeCases=null,this.routeBusy=!1,this.routeError="",this.routeDone=null,this.geometry=null,this.level=null,this.catalogLookup=null,this.planImage=!0,this.pollTimer=0,this.view3d=!1,this.default3d=!1,this.threeState="idle",this.catalog3d=null,this.selected3d=null,this.eventPreset="iso",this.real3d=!1,this.materials3d=null,this.replay=null,this.itemNames=new Map,this.sceneMemo=null}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.pollTimer),this.stopPlayer()}updated(e){e.has("eventId")&&e.get("eventId")!==void 0&&this.load(),this.default3d&&!this.view3d&&this.hasScene&&f()&&(this.default3d=!1,this.toggle3d())}async load(){if(_()){this.error="",await this.stopPlayer();try{const e=await N(this.eventId);this.ev=e,this.view3d=!1,this.replay=null,this.tz=e.timezone||this.tz,e.location?.has_plan?this.loadMap(e.location.floor_id):this.bundle=null,this.loadNearby(e),this.loadCorrelation(e.id),this.loadRoute(e.id),e.camera_id&&this.play(e),e.thumbnail==="pending"&&this.pollThumb(e.id)}catch(e){this.error=v(e),this.ev=null}}}async loadRoute(e){this.route=null,this.routeTicked=null,this.routeDone=null,this.routeError="";try{this.route=await A(e),this.route.suggestions.length&&this.routeCases===null&&re({status:"open"}).then(t=>{this.routeCases=t.can_manage?t.cases:[],t.can_manage||(this.routeCases=null)}).catch(()=>this.routeCases=[])}catch{this.route=null}}routePicks(){const e=(this.route?.suggestions??[]).map(t=>t.camera_id);return this.routeTicked?e.filter(t=>this.routeTicked.has(t)):e}tickRoute(e,t){const a=new Set(this.routeTicked??this.routePicks());t?a.add(e):a.delete(e),this.routeTicked=a}async confirmRoute(){const e=this.route,t=this.routePicks();if(!(!e||!t.length||this.routeBusy)){this.routeBusy=!0,this.routeError="";try{this.routeDone=await M(e.event_id,{camera_ids:t,case_id:this.routeCase||void 0}),this.routeDone.created&&(this.routeCases=[...this.routeCases??[],{id:this.routeDone.case_id,title:this.routeDone.title}]),this.routeCase=this.routeDone.case_id}catch(a){this.routeError=v(a)}finally{this.routeBusy=!1}}}renderRoute(){const e=this.route;if(!e||!e.spatial)return c;const t=new Set(this.routePicks()),a=s=>s==="same_zone"?"recorded":s==="adjacent_zone"?"partial":s==="via_connector"?"stale":"neutral";return i`<sw-card heading="המשך מסלול מוצע" subheading="השערה לפי טופולוגיית המפה · ±${Math.round((new Date(e.window.to).getTime()-new Date(e.window.from).getTime())/1e3)} שניות" data-route>
      ${e.suggestions.length?i`<div class="corr" data-route-list>${e.suggestions.map(s=>i`<div class="link route" data-route-item data-relation=${s.relation} data-camera=${s.camera_id}>
              <span class="rel"><input type="checkbox" aria-label=${`כלול את ${s.name} במסלול`} data-route-tick=${s.camera_id} .checked=${t.has(s.camera_id)} @change=${o=>this.tickRoute(s.camera_id,o.target.checked)} />${s.via?i`<sw-icon name=${s.via.kind==="elevator"?"elevator":"stairs"} size=${14}></sw-icon>`:c}<sw-badge kind=${a(s.relation)} label=${s.relation_label}></sw-badge></span>
              <span>${s.name}${s.zone?i` · ${s.zone}`:c}${s.via?i` · ${s.via.floor_name}`:c}<small>${s.activity_events?`${s.activity_events} אירועים בחלון`:"ללא אירועים בחלון"} · מרחק ${Math.round(s.distance*100)} יח׳ תוכנית${s.via?.label?` · ${s.via.label}`:""}</small></span>
              <sw-button size="sm" icon="play" @click=${()=>w("/investigate/playback",{camera:s.camera_id,t:s.playback_at})}>נגן</sw-button>
            </div>`)}</div>
          ${this.routeCases!==null?i`<div class="routeconfirm" data-route-confirm>
                <select aria-label="תיק" data-route-case .value=${this.routeCase} @change=${s=>this.routeCase=s.target.value}>
                  <option value="" ?selected=${!this.routeCase}>תיק חדש</option>
                  ${(this.routeCases??[]).map(s=>i`<option value=${s.id} ?selected=${s.id===this.routeCase}>${s.title}</option>`)}
                </select>
                <sw-button variant="primary" size="sm" icon="case" ?disabled=${!t.size||this.routeBusy} data-route-confirm-button @click=${()=>this.confirmRoute()}>${this.routeBusy?"מוסיף…":`אשר מסלול לתיק (${t.size})`}</sw-button>
                ${this.routeDone?i`<span class="ok" data-route-done role="status">נוסף לתיק „${this.routeDone.title}”${this.routeDone.skipped.length?` · ${this.routeDone.skipped.length} דולגו`:""} · <a href=${`#/investigate/cases/${this.routeDone.case_id}`}>פתח</a></span>`:c}
                ${this.routeError?i`<span class="err" role="alert" data-route-error>${this.routeError}</span>`:c}
              </div>`:c}`:i`<div class="note" style="margin:0">אין מצלמות נוספות בסביבה על התוכנית.</div>`}
      ${e.notes.length?i`<ul class="corrnotes">${e.notes.map(s=>i`<li>${s}</li>`)}</ul>`:c}
      <div class="note">${e.policy}</div>
    </sw-card>`}async loadCorrelation(e){this.corr=null,this.corrError="";try{this.corr=await O(e)}catch(t){this.corrError=v(t)}}async loadMap(e){try{const t=await k(e);this.bundle=t,this.restorePlanImage(e),V().then(s=>{this.bundle===t&&(this.level=$e(s["plan.levels"],t)),this.bundle===t&&(this.default3d=s["map.default_view"]==="3d"&&!this.view3d)}).catch(()=>{}),t.source==="api"&&me(t.catalogRevision).then(s=>{this.catalogLookup=ve(s),this.catalog3d=we(s),this.materials3d=fe(s),this.itemNames=new Map(s.items.map(o=>[o.id,o.names.he]))}).catch(()=>{}),this.geometry=null;const a=await ue(t);this.bundle===t&&(this.geometry=a)}catch{this.bundle=null,this.geometry=null}}setPlanImage(e){this.planImage=e;const t=this.bundle?.floorId;if(t)try{localStorage.setItem(`sw.event.background.${t}`,e?"1":"0")}catch{}}restorePlanImage(e){try{this.planImage=localStorage.getItem(`sw.event.background.${e}`)!=="0"}catch{this.planImage=!0}}async loadNearby(e){try{const t=new Date(e.occurred_at).getTime(),a=o=>new Date(o).toISOString().replace(/\.\d{3}Z$/,"Z"),s=await B({from:a(t-P),to:a(t+P),limit:30});this.nearby=s.events.filter(o=>o.id!==e.id).slice(0,6)}catch{this.nearby=[]}}pollThumb(e){window.clearTimeout(this.pollTimer),this.pollTimer=window.setTimeout(async()=>{const t=await U(e).catch(()=>"unavailable");this.ev?.id===e&&(t==="pending"?this.pollThumb(e):(this.ev={...this.ev,thumbnail:t},t==="ready"&&(this.thumbVersion=Date.now())))},1500)}async play(e){if(e.camera_id){this.playerError="";try{const t=new Date(new Date(e.occurred_at).getTime()-2e3).toISOString().replace(/\.\d{3}Z$/,"Z"),a=await pe(e.camera_id,t);this.ev?.id===e.id?this.session=a:await z(a.id).catch(()=>{})}catch(t){this.playerError=v(t)}}}async stopPlayer(){const e=this.session;this.session=null,e&&await z(e.id).catch(()=>{})}async ack(){const e=this.ev;if(!(!e||e.acked_at)){this.busy=!0;try{const t=await j(e.id);this.ev={...e,acked_at:t.acked_at,acked_by_username:t.acked_by_username}}catch(t){this.error=v(t)}finally{this.busy=!1}}}async openLive(e){this.busy=!0;try{const t=await Z({event_id:e});w(`/investigate/incidents/${encodeURIComponent(t.incident.id)}`)}catch(t){this.error=v(t)}finally{this.busy=!1}}fmt(e,t=!1){const a=new Date(e),s=H(a,{timeZone:this.tz,seconds:!0});return t?`${G(a,{timeZone:this.tz})} · ${s}`:s}renderCorrelation(){const e=this.corr,t=e?`±${e.window_s} שניות · ${e.spatial?`סביבת ${e.location?.zone??"המיקום על התוכנית"} (${e.location?.floor_name??""})`:"לפי זמן בלבד"}`:this.corrError?"לא נטען":"טוען…";return i`<sw-card heading="קורלציה דלת–מצלמה–חיישן" subheading=${t} data-correlation>
      ${e?i`${e.entities.length?i`<div class="note" style="margin:0 0 6px" data-correlation-entities>בסביבה: ${e.entities.map(a=>`${a.name}${a.state_missing?" (ללא מצב)":a.state?` · ${a.state}`:""}`).join(" · ")}</div>`:i`<div class="note" style="margin:0 0 6px" data-correlation-entities>אין חיישנים או מנעולים מוצבים בסביבה.</div>`}
            ${e.links.length?i`<div class="corr" data-correlation-links>${e.links.map(a=>i`<div class="link" data-correlation-link data-certainty=${a.certainty}>
                    <span class="ltr num">${a.delta_s>0?"+":""}${a.delta_s} שנ׳</span>
                    <span>${a.kind==="camera"&&a.event_id?i`<a href=${`#/investigate/events/${a.event_id}`}>${a.label}</a>`:a.kind==="sensor"&&a.event_id?i`<a href=${`#/investigate/events/${a.event_id}`}>${a.label}</a>`:a.label}<small>${a.note}</small></span>
                    <sw-badge kind=${Ie[a.certainty]} label=${W[a.certainty]}></sw-badge>
                  </div>`)}</div>`:i`<div class="note" style="margin:0">לא נרשם דבר בחלון הזמן מהחיישנים, המנעולים והמצלמות שבסביבה.</div>`}
            ${e.notes.length?i`<ul class="corrnotes">${e.notes.map(a=>i`<li data-correlation-note=${a.code}>${a.text}</li>`)}</ul>`:c}
            <div class="note">${e.policy}</div>`:this.corrError?i`<div class="note">${this.corrError}</div>`:c}
    </sw-card>`}duration(e){return e.ended_at?oe(e.occurred_at,e.ended_at)??"פחות משנייה":typeof e.details.seconds=="number"?`${e.details.seconds} שנ׳ (הקלטה)`:"—"}renderTech(e){const t=e.details,a=typeof t.description=="string"?t.description:"",s=typeof t.time_precision=="string"?t.time_precision:"",o=typeof t.device_time=="string"?t.device_time:"";return i`<details class="tech" data-tech-details>
      <summary><sw-icon name="info" size=${14}></sw-icon><span>פרטים טכניים</span><sw-icon class="chev" name="chevron" size=${14}></sw-icon></summary>
      <div class="kv">
        <span>קוד המכשיר</span><b><span class="ltr">${e.raw_type||"—"}</span></b>
        ${a?i`<span>טקסט המכשיר</span><b>${ne(a)??i`<span class="ltr">${a}</span>`}</b>`:c}
        ${s?i`<span>דיוק הזמן</span><b>${x(s)??s} <span class="ltr" style="color:var(--sw-text-3)">${s}</span></b>`:c}
        ${o?i`<span>שעון המכשיר</span><b><span class="ltr">${this.fmt(o,!0)}</span></b>`:c}
        <span>נקלט</span><b><span class="ltr">${this.fmt(e.received_at,!0)}</span></b>
        <span>מקור · ודאות</span><b><span class="ltr">${e.source} · ${e.confidence}</span></b>
        ${e.recorder_id||e.channel?i`<span>מקליט · ערוץ</span><b><span class="ltr">${e.recorder_id??"—"} · ${e.channel??"—"}</span></b>`:c}
        <span>מזהה האירוע</span><b><span class="ltr">${e.id}</span></b>
      </div>
    </details>`}get markers(){const e=this.bundle;return e?e.anchors.map(t=>({id:t.id,kind:t.resource_type==="camera"?"camera":F(t.layer_id,t.entity?.domain),label:t.camera?.name??t.entity?.name??t.label??t.resource_id,x:t.position.x,y:t.position.y,rotation:t.rotation_degrees,fov:t.field_of_view_degrees??void 0,level:t.level_id??null,state:t.resource_type==="camera"?Y(t):"neutral"})):[]}get hasScene(){return this.bundle?.source==="api"&&this.geometry!==null}get sceneDescription(){const e=this.bundle,t=this.geometry;if(!this.view3d||!e||e.source!=="api"||!t)return null;const a=this.replay&&this.replay.eventId===this.ev?.id?this.replay:null,s=[e,t,this.catalog3d,this.level,this.itemNames,a,this.real3d,this.materials3d];if(this.sceneMemo&&E(this.sceneMemo.refs,s))return this.sceneMemo.desc;const o=r=>r.resource_type==="ha_entity"?a?.entityStates[r.resource_id]??null:null,u=e.anchors.map(r=>({id:r.id,resource_type:r.resource_type,resource_id:r.resource_id,x:r.position.x,y:r.position.y,rotation:r.rotation_degrees,fov:r.field_of_view_degrees??null,radius:r.coverage_radius??null,polygon:r.coverage_polygon??null,level_id:r.level_id??null,layer_id:r.layer_id,label:g(r),state:o(r),online:r.resource_type==="camera"&&r.camera?r.camera.status==="online":null,mount_height_m:r.mount_height_m??null,tilt_deg:r.tilt_deg??null})),h=Object.fromEntries([...new Set(e.anchors.filter(r=>r.resource_type==="ha_entity").map(r=>r.resource_id))].sort().map(r=>[r,a?.entityStates[r]??null])),p=a?.circuitStates??{},m=e.zones.map(r=>({id:r.id,name:r.name,polygon:r.polygon,level_id:r.level_id??null})),y=[JSON.stringify([e.floorId,e.width,e.height,u,h,p,m]),t,this.catalog3d,this.level,this.itemNames,this.real3d,this.materials3d];if(this.sceneMemo&&E(this.sceneMemo.keys,y))return this.sceneMemo={...this.sceneMemo,refs:s},this.sceneMemo.desc;const $=be({doc:t,width:e.width,height:e.height,anchors:u,entityStates:h,circuitStates:p,catalog:this.catalog3d,zones:m,level:this.level,anchorsEveryLevel:!0,...this.real3d?{realistic:!0,materialsCatalog:this.materials3d}:{}}),b={};for(const r of e.anchors)b[r.id]=g(r);for(const r of t.objects)b[r.id]=r.label||this.itemNames.get(r.item_id)||r.item_id;for(const r of e.zones)b[r.id]=r.name;return this.sceneMemo={refs:s,keys:y,desc:$,labels:b},$}onPartSelect(e){const{id:t,kind:a}=e.detail;if(!t){this.selected3d=null;return}const s=a?ye({id:t,kind:a},this.geometry,this.bundle?.anchors??[]):null;s&&"anchor"in s&&(this.selected3d=s.anchor)}get shows3d(){return this.view3d&&this.threeState==="ready"&&this.sceneDescription!==null}async toggle3d(){if(this.view3d){this.view3d=!1;return}if(!f()||!this.hasScene||this.threeState==="loading")return;if(this.threeState!=="ready"){this.threeState="loading";try{await K(()=>import("./sw-plan-3d-r7g4gFjS.js"),__vite__mapDeps([0]),import.meta.url),this.threeState="ready"}catch{this.threeState="error";return}}const e=this.ev?.location?.anchor_id??null;this.selected3d=e,this.eventPreset=e?{camera:`cam:${e}`}:"iso",this.ev&&this.replay?.eventId!==this.ev.id&&this.loadReplay(this.ev),this.view3d=!0}async loadReplay(e){const t=e.location?.floor_id,a=I(e.occurred_at);if(!(!t||a===null))try{const s=await k(t,!1,new Date(a).toISOString().replace(/\.\d{3}Z$/,"Z"));this.ev?.id===e.id&&(this.replay={eventId:e.id,...ge(s.anchors,s.circuitStates)})}catch{}}render(){if(!_())return i`<sw-page heading="אירוע"><sw-state-panel icon="history" state="empty" heading="דף האירוע זמין עם השרת" hint="במצב הדגמה אין אירועים אמיתיים."></sw-state-panel></sw-page>`;if(this.error&&!this.ev)return i`<sw-page heading="אירוע"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;const e=this.ev;if(!e)return i`<sw-page heading="אירוע"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=D(e),a=xe(e.occurred_at),s=e.camera_name??(e.channel?`ערוץ ${e.channel}`:"מערכת"),o=e.location,u=o?`${o.building_name} · ${o.floor_name}${o.zone?` / ${o.zone}`:""}`:null,h=!!e.acked_at;return i`
      <sw-page heading=${`${t} · ${s}`} subheading=${`${this.fmt(e.occurred_at,!0)}${a?` · ${a}`:""} · ${C[e.source]??e.source}`} crumbs=${`חקירה | אירועים | ${t}`} wide>
        <sw-button slot="actions" variant=${h?"ghost":"primary"} icon="check" data-ack ?disabled=${h||this.busy} @click=${()=>this.ack()}>${h?"טופל":"סמן כטופל"}</sw-button>
        <sw-button slot="actions" icon="case" data-add-to-case @click=${()=>this.casePick={kind:"event",event_id:e.id}}>הוסף לתיק</sw-button>
        ${ke(J())?i`<sw-button slot="actions" icon="warning" data-open-incident ?disabled=${this.busy} @click=${()=>void this.openLive(e.id)}>${q("fromEvent")}</sw-button>`:c}
        <sw-button slot="actions" variant="ghost" icon="list" @click=${()=>w("/investigate/events")}>למרכז האירועים</sw-button>
        ${this.error?i`<div class="err" role="alert">${this.error}</div>`:c}
        <div class="layout">
          <div>
            <div class="player" data-player>
              ${this.session?i`<sw-live-player .wsUrl=${he(this.session)} mode="mse" .retry=${!1}></sw-live-player>`:e.thumbnail==="ready"?i`<img src=${Q(e.id,this.thumbVersion)} alt="תמונת האירוע מההקלטה" />`:i`<div class="hint">${e.camera_id?this.playerError?`ההקלטה לא נפתחה: ${this.playerError}`:e.thumbnail==="unavailable"?"אין הקלטה זמינה בזמן האירוע":"פותח את ההקלטה…":"אירוע ללא מצלמה — אין וידאו"}</div>`}
              <span class="chip"><sw-icon name="clock" size=${12}></sw-icon>${this.session?"הקלטה":e.thumbnail==="ready"&&!this.session?"תמונה מההקלטה":"אירוע"}</span>
              <div class="caption">${s}<small>זמן האירוע <span class="ltr">${this.fmt(e.occurred_at)}</span>${this.session?.actual_start_at?i` · הנגן מתחיל <span class="ltr">${this.fmt(this.session.actual_start_at)}</span>${this.session.time_precision!=="verified"?` (${this.session.time_precision==="keyframe_limited"?x("keyframe_limited"):"משוער"})`:""}`:c}</small></div>
            </div>
            <div class="bar">
              <span>${this.session?"הנגן פותח את ההקלטה שתי שניות לפני זמן האירוע; זמן האירוע וזמן הפריים המנוגן מוצגים בנפרד.":e.playerHint??""}</span>
              <span class="grow"></span>
              ${e.camera_id?i`<sw-button size="sm" icon="history" @click=${()=>w("/investigate/playback",{camera:e.camera_id,t:e.occurred_at})}>הנגן המלא עם ציר הזמן</sw-button>`:c}
              ${e.camera_id?i`<sw-button size="sm" variant="ghost" icon="play" @click=${()=>this.session?this.stopPlayer():this.play(e)}>${this.session?"עצור":"נגן שוב"}</sw-button>`:c}
            </div>
          </div>
          <div class="side">
            <sw-card heading="הקשר האירוע" data-context>
              <dl class="meta">
                <div><dt>מצב</dt><dd data-status>${h?i`<sw-badge filled kind="live" label=${`טופל · ${e.acked_by_username??""}`}></sw-badge> <span class="note" style="margin:0">${this.fmt(e.acked_at,!0)}</span>`:i`<sw-badge filled kind="stale" label="טרם טופל"></sw-badge>`}</dd></div>
                <div><dt>חומרה</dt><dd data-severity><sw-badge ?filled=${e.severity!=="info"} kind=${Te[e.severity]??"neutral"} label=${Se[e.severity]??e.severity}></sw-badge></dd></div>
                <div class="wide"><dt>זמן</dt><dd><span class="ltr">${this.fmt(e.occurred_at,!0)}</span>${a?i` <span class="rel">· ${a}</span>`:c}</dd></div>
                <div><dt>סוג</dt><dd>${t}${e.confidence==="inferred"?" · נגזר":""}</dd></div>
                <div><dt>משך</dt><dd>${this.duration(e)}${e.count>1?` · ${e.count} חזרות`:""}</dd></div>
                <div class="wide"><dt>מיקום</dt><dd data-where>${u??(e.camera_id?"המצלמה עדיין לא מוצבת על תוכנית":"—")}</dd></div>
                <div class="wide"><dt>מקור</dt><dd>${C[e.source]??e.source}${e.camera_id?i` · ${s}`:c}</dd></div>
              </dl>
              ${this.renderTech(e)}
              ${o&&o.has_plan&&this.bundle?i`<div class="map" style=${this.view3d?"block-size:320px":""}>
                    <div class="floorchip"><sw-icon name="building" size=${12}></sw-icon>${o.floor_name}</div>
                    <div class="tools3d">
                      ${this.bundle.imageUrl?i`<sw-button size="sm" icon="map" aria-pressed=${this.planImage} data-plan-background title=${this.planImage?"הסתר את תמונת התוכנית":"הצג את תמונת התוכנית"} @click=${()=>this.setPlanImage(!this.planImage)}>תמונת התוכנית</sw-button>`:c}
                      <sw-button size="sm" icon="cube" aria-pressed=${this.view3d} data-event-3d-toggle ?disabled=${!this.view3d&&(!f()||!this.hasScene||this.threeState==="loading")}
                        title=${f()?this.hasScene?"מבט מהמצלמה בתלת-ממד":"אין מבנה מפורסם לקומה הזו":T} @click=${()=>this.toggle3d()}>${this.view3d?"2D":"3D"}</sw-button>
                    </div>
                    ${this.shows3d&&this.sceneDescription?i`<sw-plan-3d data-event-3d .description=${this.sceneDescription} .selectedId=${this.selected3d} .preset=${this.eventPreset} .frameKey=${e.id} .labels=${this.sceneMemo?.labels??{}}
                          .cameras=${this.bundle.anchors.filter(p=>p.resource_type==="camera").map(p=>({id:p.id,label:g(p)}))} exportName=${`plan-3d-${o.floor_name}-${e.id}`}
                          .sunAt=${I(e.occurred_at)} .walkable=${S.walkable} .stillsAvailable=${S.stillsAvailable}
                          @realistic-change=${p=>{this.real3d!==p.detail.on&&(this.real3d=p.detail.on)}}
                          @part-select=${p=>this.onPartSelect(p)}></sw-plan-3d>`:c}
                    <sw-plan-canvas style=${this.shows3d?"display:none":""} .planWidth=${this.bundle.width} .planHeight=${this.bundle.height} .imageUrl=${this.bundle.imageUrl} .hideImage=${!this.planImage} .plan=${this.bundle.planSvg} .markers=${this.markers} .selectedId=${o.anchor_id} .zones=${_e(this.bundle.zones)} .geometry=${this.geometry} .structureLevel=${this.level} .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(this.bundle.anchors.map(p=>[`${p.resource_type}:${p.resource_id}`,{x:p.position.x,y:p.position.y,rotation:p.rotation_degrees}]))} alwaysLabel dimEntities></sw-plan-canvas>
                    ${this.threeState==="loading"?i`<div class="load3d" data-3d-loading>טוען תלת-ממד…</div>`:c}
                  </div>
                  ${f()?c:i`<div class="note" data-event-3d-unavailable>${T}</div>`}
                  ${this.threeState==="error"?i`<div class="note err" data-3d-load-error>תלת-ממד לא נטען.</div>`:c}
                  ${this.view3d?i`<div class="note" data-event-3d-note>${X("replay3d.eventNote")}</div>`:c}
                  <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
                    <sw-button size="sm" icon="map" data-history-map @click=${()=>w(`/investigate/floors/${o.floor_id}`,{t:e.occurred_at,camera:e.camera_id??""})}>המשך חקירה במפה</sw-button>
                    <sw-button size="sm" variant="ghost" icon="live" @click=${()=>w(`/explore/floors/${o.floor_id}`)}>מפה חיה</sw-button>
                  </div>`:o?i`<div class="note">לקומה ${o.floor_name} אין תוכנית מפורסמת עדיין.</div>`:c}
              <div class="note">מיקום סמוך הוא הקשר, לא הוכחת קשר סיבתי; סימון "טופל" נרשם באודיט בשם המשתמש.</div>
            </sw-card>
            ${this.renderCorrelation()}
            ${this.renderRoute()}
            <sw-card heading="אירועים קרובים" subheading="±10 דקות סביב האירוע">
              ${this.nearby.length?i`<div class="nearby" data-nearby>${this.nearby.map(p=>{const m=Math.round((new Date(p.occurred_at).getTime()-new Date(e.occurred_at).getTime())/6e4);return i`<a href=${`#/investigate/events/${p.id}`}><span>${D(p)} · ${p.camera_name??(p.channel?`ערוץ ${p.channel}`:"מערכת")}</span><span class="ltr" title=${m===0?"באותה דקה":m>0?`${m} דק׳ אחרי`:`${-m} דק׳ לפני`}>${this.fmt(p.occurred_at)}</span></a>`})}</div>`:i`<div class="note" style="margin:0">אין אירועים נוספים בחלון הזה.</div>`}
            </sw-card>
          </div>
        </div>
        <sw-case-picker .item=${this.casePick} subheading=${`${t} · ${s} · ${this.fmt(e.occurred_at,!0)}`} @close=${()=>this.casePick=null}></sw-case-picker>
      </sw-page>
    `}};n.styles=[de,se`
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
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
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
  `,te,ce];l([ae()],n.prototype,"eventId",2);l([d()],n.prototype,"ev",2);l([d()],n.prototype,"error",2);l([d()],n.prototype,"tz",2);l([d()],n.prototype,"session",2);l([d()],n.prototype,"playerError",2);l([d()],n.prototype,"bundle",2);l([d()],n.prototype,"nearby",2);l([d()],n.prototype,"corr",2);l([d()],n.prototype,"corrError",2);l([d()],n.prototype,"route",2);l([d()],n.prototype,"busy",2);l([d()],n.prototype,"thumbVersion",2);l([d()],n.prototype,"casePick",2);l([d()],n.prototype,"routeTicked",2);l([d()],n.prototype,"routeCase",2);l([d()],n.prototype,"routeCases",2);l([d()],n.prototype,"routeBusy",2);l([d()],n.prototype,"routeError",2);l([d()],n.prototype,"routeDone",2);l([d()],n.prototype,"geometry",2);l([d()],n.prototype,"level",2);l([d()],n.prototype,"catalogLookup",2);l([d()],n.prototype,"planImage",2);l([d()],n.prototype,"view3d",2);l([d()],n.prototype,"threeState",2);l([d()],n.prototype,"catalog3d",2);l([d()],n.prototype,"selected3d",2);l([d()],n.prototype,"eventPreset",2);l([d()],n.prototype,"real3d",2);l([d()],n.prototype,"replay",2);n=l([ie("investigate-event-detail")],n);export{n as InvestigateEventDetail};
//# sourceMappingURL=investigate-event-detail-CkBUQqjU.js.map
