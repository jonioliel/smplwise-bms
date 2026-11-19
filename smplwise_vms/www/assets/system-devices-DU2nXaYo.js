import{g as E,ax as F,j as c,i as L,aL as A,n as y,A as p,b as a,u as N,k as q,eM as R,eE as s,aa as j,a2 as v,eL as T,b5 as H,jY as I,jZ as U,j_ as K,eN as G,eO as Z,a5 as S,ez as g,aU as Y}from"./index-rXjlW4bK.js";import"./sw-table-BkAxAukF.js";import"./sw-chip-DbEqThVX.js";import"./sw-pager-CUuaqLbV.js";import{c as W,a as l,I as O,b as B,s as V}from"./camera-image-health-m0xrKJxG.js";import{L as J}from"./long-lists-BILjXS3H.js";import"./sw-logo-art-PLtEZJxU.js";var Q=Object.defineProperty,X=Object.getOwnPropertyDescriptor,x=(e,t,h,i)=>{for(var n=i>1?void 0:i?X(t,h):t,w=e.length-1,u;w>=0;w--)(u=e[w])&&(n=(i?u(t,h,n):u(n))||n);return i&&n&&Q(t,h,n),n};const ee={dark:"var(--sw-stale)",blurred:"var(--sw-stale)",frozen:"var(--sw-danger)",shifted:"var(--sw-danger)"},se=e=>e?new Date(e).toLocaleTimeString(N(),{hour:"2-digit",minute:"2-digit"}):"";let b=class extends L{constructor(){super(...arguments),this.skin=new A(this),this.data=null,this.selected=null,this.busy=!1,this.error=""}async check(){this.busy=!0,this.error="";try{const e=await W();this.dispatchEvent(new CustomEvent("cih-updated",{detail:e,bubbles:!0,composed:!0}))}catch(e){this.error=y(e)}finally{this.busy=!1}}pick(e){this.dispatchEvent(new CustomEvent("cih-filter",{detail:e===this.selected?null:e,bubbles:!0,composed:!0}))}render(){const e=this.data;if(!e)return p;const t=e.counts;if(!e.enabled)return e.can_manage?a`<div class="strip" data-cih-card data-state="off"><span class="h">${l("title")}</span><span class="meta">${l("off")}</span><span class="grow"></span>
        <a href="#/system/diagnostics?tab=health" data-cih-settings>${l("openSettings")}</a></div>`:p;const h=O.some(i=>(t[i]??0)>0);return a`<div class="strip" data-cih-card data-state="on" ?data-warn=${h}>
      <span class="h">${l("title")}</span>
      <sw-chip dot="var(--sw-live)" count=${t.ok??0} data-cih-count="ok">${l("ok")}</sw-chip>
      ${O.filter(i=>(t[i]??0)>0).map(i=>a`<sw-chip dot=${ee[i]} count=${t[i]} ?selected=${this.selected===i} data-cih-count=${i} @click=${()=>this.pick(i)}>${l(i)}</sw-chip>`)}
      ${(t.unknown??0)>0?a`<sw-chip dot="var(--sw-unknown)" count=${t.unknown} data-cih-count="unknown">${l("unknown")}</sw-chip>`:p}
      <span class="grow"></span>
      <span class="meta" data-cih-checked>${e.checked_at?l("lastCheck",{t:se(e.checked_at)}):l("never")} · ${l("every",{n:Math.round(e.interval_s/60)})}</span>
      ${this.error?a`<span class="err" role="alert">${this.error}</span>`:p}
      ${e.can_manage?a`<sw-button size="sm" icon="refresh" data-cih-check ?disabled=${this.busy} @click=${()=>this.check()}>${this.busy?l("checking"):l("checkNow")}</sw-button>`:p}
    </div>`}};b.styles=E`
    :host {
      display: block;
    }
    .strip {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
      padding: 6px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-glass-sheen), var(--sw-surface);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      min-inline-size: 0;
    }
    .strip[data-warn] {
      border-color: color-mix(in srgb, var(--sw-stale) 55%, var(--sw-border));
    }
    .h {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .grow {
      flex: 1;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    a {
      color: var(--sw-accent);
      font-size: var(--sw-fs-xs);
    }
    :host([data-skin='bubble']) .strip {
      border-color: transparent;
      background: var(--sw-surface-2, var(--sw-surface));
    }
  `;x([F({attribute:!1})],b.prototype,"data",2);x([F()],b.prototype,"selected",2);x([c()],b.prototype,"busy",2);x([c()],b.prototype,"error",2);b=x([q("camera-image-health-card")],b);var te=Object.defineProperty,ae=Object.getOwnPropertyDescriptor,f=(e,t,h,i)=>{for(var n=i>1?void 0:i?ae(t,h):t,w=e.length-1,u;w>=0;w--)(u=e[w])&&(n=(i?u(t,h,n):u(n))||n);return i&&n&&te(t,h,n),n};const M=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"],ie="display:flex;align-items:center;gap:12px;min-inline-size:0",_="inline-size:72px;block-size:44px;flex:none;border-radius:var(--sw-r-sm);overflow:hidden;",re="font-variant-numeric:tabular-nums;color:var(--sw-text-2)";function z(e){return a`<span class="ltr" data-health-num style=${re}>${String(e??"")}</span>`}function P(e,t,h,i="cam"){const n=`display:inline-flex;align-items:center;gap:7px;min-block-size:26px;padding:0 11px;border-radius:var(--sw-r-pill);background:color-mix(in srgb, ${t} 20%, var(--sw-surface));color:var(--sw-heading);font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-bold);white-space:nowrap`,w=a`<i style=${`--c:${t};inline-size:8px;block-size:8px;border-radius:50%;background:${t};flex:none`}></i>`;return i==="cam"?a`<span class="status" data-cam-state=${e} style=${n}>${w}${h}</span>`:a`<span class="status" data-cih-cell=${e} style=${n}>${w}${h}</span>`}let d=class extends L{constructor(){super(...arguments),this.bubbleSkin=new A(this),this.selected=null,this.filter="all",this.offlineFirst=!1,this.cameras=null,this.recorder=null,this.canSync=!1,this.discovery=null,this.busy=!1,this.message="",this.error="",this.dialog=!1,this.formChannel=1,this.formAlias="",this.alias="",this.recorderOpen=!1,this.image=null,this.imageFilter=null,this.phone=window.matchMedia("(max-width: 767px)").matches,this.narrow=window.matchMedia("(max-width: 1279px)").matches,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.narrowMq=window.matchMedia("(max-width: 1279px)"),this.onPhone=()=>{this.phone=this.phoneMq.matches,this.narrow=this.narrowMq.matches},this.page=1,this.visibleCount=0,this.fitCount=-1,this.perPage=0,this.deskMq=window.matchMedia("(min-width: 1024px)"),this.lists=new J(this,()=>{this.page=1,this.scheduleFit()}),this.fitObs=null,this.fitRaf=0,this.onDesk=()=>this.scheduleFit(),this.columns=[{key:"name",label:s("מצלמה"),render:e=>a`<div class="cam" style=${ie}>${e.api&&e.api.status==="online"?a`<img class="snap" src=${R(String(e.id))} alt="" loading="lazy" style=${_+"object-fit:cover;background:var(--sw-surface-3);display:block"} @error=${t=>t.target.style.visibility="hidden"} />`:e.scene?a`<sw-scene kind=${e.scene} style=${_}></sw-scene>`:a`<div class="none" style=${_+"display:grid;place-items:center;color:var(--sw-offline-text);background:color-mix(in srgb, var(--sw-offline) 22%, var(--sw-surface-3))"}><sw-icon name=${e.state==="forbidden"?"lock":"offline"} size=${16}></sw-icon></div>`}<div style="min-inline-size:0"><b style="display:block;font-size:var(--sw-fs-md);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${String(e.name)}</b><small style="display:block;color:var(--sw-text-2);font-size:var(--sw-fs-xs)">${String(e.sub)}</small></div></div>`},{key:"state",label:s("מצב"),render:e=>P(String(e.state),e.state==="live"?"var(--sw-live)":e.state==="offline"?"var(--sw-danger)":e.state==="unknown"?"var(--sw-unknown)":"var(--sw-stale)",e.state==="live"?s("מחוברת"):e.state==="offline"?s("מנותקת"):e.state==="stale"?s("לא מעודכן"):e.state==="forbidden"?s("ללא הרשאה"):s("לא נבדק"))},{key:"fps",label:"FPS",render:e=>z(e.fps)},{key:"bitrate",label:s("קצב"),render:e=>z(e.bitrate)},{key:"firmware",label:s("זרם ראשי"),render:e=>z(e.firmware)},{key:"image",label:l("column"),render:e=>this.imageCell(this.imageOf(String(e.id)))},{key:"lastEvent",label:s("נראתה לאחרונה")},{key:"net",label:s("רשת"),render:e=>this.net(e.state==="live"?4:e.state==="stale"?2:0)},{key:"more",label:"",width:"40px",render:()=>a`<sw-button variant="ghost" size="sm" iconOnly icon="more" label=${s("עוד")}></sw-button>`}]}connectedCallback(){super.connectedCallback();const e=j().params,t=e.get("filter");(t==="all"||t==="online"||t==="offline"||t==="issues")&&(this.filter=t),this.offlineFirst=e.get("sort")==="offline",this.phoneMq.addEventListener("change",this.onPhone),this.narrowMq.addEventListener("change",this.onPhone),this.deskMq.addEventListener("change",this.onDesk),this.reload()}disconnectedCallback(){this.phoneMq.removeEventListener("change",this.onPhone),this.narrowMq.removeEventListener("change",this.onPhone),this.deskMq.removeEventListener("change",this.onDesk),this.fitObs?.disconnect(),this.fitObs=null,cancelAnimationFrame(this.fitRaf),super.disconnectedCallback()}updated(){const e=this.renderRoot.querySelector(".stage");e&&!this.fitObs&&typeof ResizeObserver<"u"&&(this.fitObs=new ResizeObserver(()=>this.scheduleFit()),this.fitObs.observe(e)),this.visibleCount!==this.fitCount&&(this.fitCount=this.visibleCount,this.scheduleFit())}scheduleFit(){cancelAnimationFrame(this.fitRaf),this.fitRaf=requestAnimationFrame(()=>this.fit())}fit(){if(!this.deskMq.matches||!this.lists.paged){this.perPage&&(this.perPage=0);return}const e=this.renderRoot.querySelector(".stage"),h=e?.querySelector("sw-table")?.shadowRoot,i=h?.querySelector("thead"),n=h?.querySelector("tbody tr");if(!e||!i||!n||!n.offsetHeight)return;const w=44,u=e.clientHeight-i.offsetHeight-2,o=Math.floor(u/n.offsetHeight),m=Math.max(3,Math.floor((u-w)/n.offsetHeight)),$=this.visibleCount<=o?0:m;$!==this.perPage&&(this.perPage=$)}async reload(){if(!v()){this.cameras=null;return}this.error="";try{const e=await T();this.cameras=e.cameras,this.recorder=e.recorder,this.canSync=e.can_sync,B().then(t=>this.image=t).catch(()=>this.image=null),H("health").then(t=>this.discovery=t.discovery).catch(()=>{})}catch(e){this.error=y(e)}}async sync(){this.busy=!0,this.error="",this.message="";try{const e=await I();this.message=`${s("סנכרון הושלם: {channels} ערוצים ({created} חדשים, {updated} עודכנו)",{channels:e.channels,created:e.created,updated:e.updated})}${e.recorder.model?` · ${e.recorder.model}`:""}`,await this.reload()}catch(e){this.error=y(e)}finally{this.busy=!1}}async register(){this.busy=!0,this.error="";try{await U({channel:this.formChannel,alias:this.formAlias.trim()}),this.dialog=!1,await this.reload()}catch(e){this.error=y(e)}finally{this.busy=!1}}async saveAlias(e){this.busy=!0,this.error="";try{await K(e,{alias:this.alias.trim()||void 0}),await this.reload(),this.message=s("הכינוי נשמר (השם במקליט לא השתנה)")}catch(t){this.error=y(t)}finally{this.busy=!1}}get rows(){return this.cameras?this.cameras.map(e=>({id:e.id,name:e.name,sub:`${s("ערוץ {n}",{n:e.channel})}${e.name_source&&e.alias?` · ${s("במקליט: {name}",{name:e.name_source})}`:""}`,state:e.status==="online"?"live":e.status==="offline"?"offline":"unknown",fps:e.stream?.fps?String(e.stream.fps):"—",bitrate:e.stream?.bitrate_kbps?`${(e.stream.bitrate_kbps/1024).toFixed(1)} Mbps`:"—",firmware:e.stream?.resolution?`${e.stream.resolution} ${e.stream.codec??""}`.trim():"—",lastEvent:e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z",""):s("לא נבדק"),scene:e.status==="online"?M[(e.channel-1)%M.length]:null,channel:e.channel,api:e})):v()?[]:G.map(e=>({id:e.id,name:e.name,sub:`${e.floor} · ${s("ערוץ {n}",{n:e.id.replace("cam-","")})}`,state:e.state,fps:e.fps?String(e.fps):"—",bitrate:e.bitrateKbps?`${(e.bitrateKbps/1024).toFixed(1)} Mbps`:"—",firmware:e.firmware,lastEvent:e.lastEvent,scene:e.state==="offline"||e.state==="forbidden"?null:Z[e.id]??"lobby",channel:Number(e.id.replace("cam-",""))}))}imageOf(e){return this.image?.enabled?this.image.cameras.find(t=>t.id===e):void 0}imageCell(e){if(!e||e.state==="off")return a`<span class="hint">—</span>`;const t=e.state==="warn"?e.issues.some(i=>i==="frozen"||i==="shifted")?"var(--sw-danger)":"var(--sw-stale)":e.state==="ok"?"var(--sw-live)":"var(--sw-unknown)",h=e.state==="warn"?e.issues.map(i=>l(i)).join(", "):e.state==="ok"?l("stateOk"):e.state==="excluded"?l("stateExcluded"):e.error_text??l("stateUnknown");return P(e.state,t,h,"cih")}imageRows(e){const t=e.metrics;return a`<dt>${l("column")}</dt><dd>${this.imageCell(e)}</dd>
      ${t.brightness!=null?a`<dt>${l("brightness")} · ${l("sharpness")}</dt><dd><span class="ltr">${Math.round(t.brightness)} · ${Math.round(t.sharpness??0)}</span></dd>`:p}
      <dt>${l("reference")}</dt><dd data-cih-ref>${e.reference?e.reference.auto?l("refAuto"):l("refManual"):l("refNone")}</dd>`}async reference(e,t){this.busy=!0,this.error="";try{this.image={...await V(e,t)}}catch(h){this.error=y(h)}finally{this.busy=!1}}net(e){return S`<svg class="net" viewBox="0 0 22 14" aria-label=${s("רשת")}>${[0,1,2,3].map(t=>S`<rect x=${t*5.5} y=${11-t*3} width="4" height=${3+t*3} rx="1" fill=${t<e?e>=3?"var(--sw-live)":"var(--sw-stale)":"var(--sw-border-strong)"} />`)}</svg>`}get shownColumns(){return this.phone?this.columns.filter(e=>d.PHONE_KEYS.has(e.key)&&(e.key!=="image"||!!this.image?.enabled)):this.narrow?this.columns.filter(e=>e.key!=="net"&&e.key!=="more"):this.columns}render(){const e=this.rows,t=this.imageFilter,h=e.filter(r=>this.filter==="all"?!0:this.filter==="online"?r.state==="live":this.filter==="offline"?r.state==="offline":r.state==="stale"||r.state==="forbidden"||r.state==="unknown").filter(r=>!t||(this.imageOf(r.id)?.issues??[]).includes(t)),i=this.offlineFirst?[...h].sort((r,C)=>+(C.state==="offline")-+(r.state==="offline")):h;this.visibleCount=i.length;const n=this.perPage?Math.max(1,Math.ceil(i.length/this.perPage)):1,w=Math.min(this.page,n),u=this.perPage?i.slice((w-1)*this.perPage,w*this.perPage):i,o=e.find(r=>r.id===this.selected),m=!!this.cameras,k=!m&&!v(),$=k?a`<div class="nvr" data-health-recorder>
          <div><span>${s("דגם")}</span>${s("DS-76xx (הדגמה)")}</div>
          <div><span>${s("קושחה")}</span><span class="ltr">V4.84.x</span></div>
          <div><span>${s("ערוצים")}</span>10/16</div>
          <div><span>${s("דיסק")}</span>${s("1 · תקין · 30% פנוי")}</div>
          <div><span>${s("שעון")}</span>${s("NTP · סטייה 2 שנ׳")}</div>
          <div><span>${s("חיפוש במקביל")}</span>${s("1 (מגבלת מכשיר)")}</div>
        </div>`:this.recorder?a`<div class="nvr" data-health-recorder>
            <div><span>${s("דגם")}</span>${this.recorder.model??s("לא נבדק")}</div>
            <div><span>${s("קושחה")}</span><span class="ltr">${this.recorder.firmware??"—"}</span></div>
            <div><span>${s("סנכרון אחרון")}</span>${this.recorder.last_seen_at?this.recorder.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</div>
            <div><span>${s("גישה")}</span>${s("קריאה בלבד")}</div>
          </div>`:null,D=k?g("videoCopy.recorderMain"):this.recorder?.name??g("videoCopy.recorder");return a`
      <sw-page heading=${s("בריאות מצלמות")} subheading=${m?`${this.recorder?.name??g("videoCopy.recorder")}${this.recorder?.model?` · ${this.recorder.model}`:""} · ${s("{n} מצלמות רשומות",{n:e.length})} · ${s("גילוי לקריאה בלבד")}`:v()?s("קורא את רשימת המצלמות · גילוי לקריאה בלבד"):g("videoCopy.healthDemoSub")}>
        ${m&&this.canSync?a`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>${this.busy?s("מסנכרן…"):g("videoCopy.syncFromRecorder")}</sw-button>`:a`<sw-button slot="actions" icon="refresh" ?disabled=${m||v()}>${s("בדיקת יכולות (קריאה)")}</sw-button>`}
        ${$?a`<sw-button slot="actions" icon="info" data-health-recorder-open aria-haspopup="dialog" aria-expanded=${String(this.recorderOpen)} @click=${()=>this.recorderOpen=!0}>${g("videoCopy.recorderDetails")}</sw-button>`:p}
        ${m&&this.discovery?a`<div style="font-size:var(--sw-fs-xs);color:${this.discovery.cameras_last_error?"var(--sw-danger)":"var(--sw-text-3)"};margin-block-end:8px">${s("גילוי אוטומטי מהמקליט כל {n} דק׳",{n:Math.round(this.discovery.interval_s/60)})} · ${this.discovery.cameras_last_error?s("נכשל: {error}",{error:this.discovery.cameras_last_error}):this.discovery.cameras_last_ok?s("הצליח {time}",{time:this.discovery.cameras_last_ok.replace("T"," ").replace("Z"," UTC")}):s("טרם רץ")}${this.discovery.streams_last_error?` · ${s("זרמי go2rtc: {error}",{error:this.discovery.streams_last_error})}`:""}</div>`:p}
        ${m&&this.canSync?a`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>{this.dialog=!0,this.formAlias="",this.formChannel=(e.length?Math.max(...e.map(r=>r.channel)):0)+1}}>${s("רישום ידני")}</sw-button>`:p}
        ${this.message?a`<div class="ok">${this.message}</div>`:p}
        ${this.error&&!(v()&&!m)?a`<div class="err">${this.error}</div>`:p}
        ${m&&this.image?a`<camera-image-health-card .data=${this.image} .selected=${this.imageFilter}
          @cih-updated=${r=>this.image=r.detail} @cih-filter=${r=>this.imageFilter=r.detail}></camera-image-health-card>`:p}
        <div class="filters">
          <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${e.length}>${s("הכל")}</sw-chip>
          <sw-chip dot="var(--sw-live)" ?selected=${this.filter==="online"} @click=${()=>this.filter="online"} count=${e.filter(r=>r.state==="live").length}>${s("מחוברות")}</sw-chip>
          <sw-chip dot="var(--sw-danger)" ?selected=${this.filter==="offline"} @click=${()=>this.filter="offline"} count=${e.filter(r=>r.state==="offline").length}>${s("מנותקות")}</sw-chip>
          <sw-chip dot="var(--sw-stale)" ?selected=${this.filter==="issues"} @click=${()=>this.filter="issues"} count=${e.filter(r=>r.state!=="live"&&r.state!=="offline").length}>${s("בעיות / לא נבדק")}</sw-chip>
          <span class="grow"></span>
          <sw-field><input type="search" placeholder=${s("חיפוש מצלמה…")} aria-label=${s("חיפוש")} /></sw-field>
        </div>
        <div class="stage">
          ${v()&&!m?this.error?a`<sw-state-panel state="error" heading=${s("רשימת המצלמות לא נטענה")} hint=${this.error} actionLabel=${s("נסה שוב")} data-cam-error @action=${()=>void this.reload()}></sw-state-panel>`:a`<sw-state-panel state="loading" heading=${s("טוען מצלמות…")} data-cam-loading></sw-state-panel>`:m&&!e.length?a`<sw-state-panel icon="camera" state="empty" heading=${s("אין מצלמות רשומות")} hint=${s("הגדירו את פרטי המקליט בהגדרות ‹ חיבורים ולחצו 'סנכרון מהמקליט', או רשמו ערוץ ידנית.")}></sw-state-panel>`:a`<sw-table focus-rows .columns=${this.shownColumns} .rows=${u} .selected=${this.selected} @row-select=${r=>{this.selected=r.detail.id,this.alias=e.find(C=>C.id===r.detail.id)?.api?.alias??""}}></sw-table>
              ${n>1?a`<div class="pagerow"><sw-pager data-health-pager .page=${w} .pages=${n} @page-change=${r=>this.page=r.detail.page}></sw-pager></div>`:p}`}
          ${o?a`<sw-drawer open heading=${o.name} subheading=${o.sub} @close=${()=>this.selected=null}>
                <sw-field label=${s("כינוי מקומי")} hint=${s("שינוי כינוי אינו משנה את הכיתוב על התמונה; השם במקליט נשמר בנפרד")}><input .value=${m?this.alias:o.name} ?disabled=${!m||!this.canSync} @input=${r=>this.alias=r.target.value} /></sw-field>
                <dl>
                  <dt>${g("videoCopy.nameOnRecorder")}</dt><dd>${m?o.api?.name_source||"—":`Camera ${o.channel}`}</dd>
                  <dt>Tracks</dt><dd><span class="ltr">${m?`${o.api?.main_track??"?"} / ${o.api?.sub_track??"?"}`:`${o.channel}01 / ${o.channel}02`}</span></dd>
                  <dt>${s("מצב")}</dt><dd><sw-badge kind=${o.state}></sw-badge></dd>
                  <dt>${s("נראתה לאחרונה")}</dt><dd>${o.lastEvent}</dd>
                  ${this.phone?a`<dt>${s("FPS · קצב")}</dt><dd><span class="ltr">${o.fps} · ${o.bitrate}</span></dd><dt>${s("זרם ראשי")}</dt><dd><span class="ltr">${o.firmware}</span></dd>`:p}
                  ${this.imageOf(o.id)?this.imageRows(this.imageOf(o.id)):p}
                </dl>
                ${this.image?.can_manage&&this.imageOf(o.id)&&this.imageOf(o.id).state!=="excluded"?a`<div class="refs" data-cih-ref-actions>
                  <sw-button size="sm" variant="ghost" icon="camera" ?disabled=${this.busy||!this.imageOf(o.id).sampled_at||!!this.imageOf(o.id).error} @click=${()=>this.reference(o.id,"set")}>${l("refSet")}</sw-button>
                  ${this.imageOf(o.id).reference?a`<sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.reference(o.id,"clear")}>${l("refClear")}</sw-button>`:p}
                </div>`:p}
                <div class="hint">${s("ניתוק מקור מוצג כניתוק, לא כאשמת הממשק. פעולות רגישות (אתחול, OSD) דורשות הרשאה ואישור ואינן בפיילוט.")}</div>
                <div slot="footer">
                  ${m&&this.canSync?a`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.saveAlias(o.id)}>${s("שמור כינוי")}</sw-button>`:p}
                  <sw-button variant="danger" size="sm" disabled>${s("אתחול מצלמה")}</sw-button>
                </div>
              </sw-drawer>`:p}
        </div>
        ${this.recorderOpen&&$?a`<sw-drawer open heading=${D} subheading=${g("videoCopy.recorderDetails")} data-health-recorder-drawer @close=${()=>this.recorderOpen=!1}>${$}</sw-drawer>`:p}
        ${this.dialog?a`<sw-dialog open heading=${s("רישום מצלמה ידני")} subheading=${s("כשהמקליט לא מוגדר עדיין; הסנכרון יעדכן שם ומצב")} @close=${()=>this.dialog=!1}>
              <sw-field label=${s("מספר ערוץ במקליט")}><input type="number" min="1" max="256" data-ltr .value=${String(this.formChannel)} @input=${r=>this.formChannel=Number(r.target.value)} /></sw-field>
              <sw-field label=${s("כינוי")}><input .value=${this.formAlias} @input=${r=>this.formAlias=r.target.value} placeholder=${s("למשל: כניסה ראשית")} /></sw-field>
              ${this.error?a`<div class="err">${this.error}</div>`:p}
              <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=!1}>${s("ביטול")}</sw-button>
              <sw-button slot="footer" variant="primary" ?disabled=${!this.formAlias.trim()||this.busy} @click=${()=>this.register()}>${s("רישום")}</sw-button>
            </sw-dialog>`:p}
      </sw-page>
    `}};d.styles=[E`
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters .grow {
      flex: 1;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    .cam {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cam img.snap {
      inline-size: 48px;
      block-size: 32px;
      object-fit: cover;
      border-radius: var(--sw-r-2xs);
      flex-shrink: 0;
      background: var(--sw-surface-3);
    }
    .cam sw-scene,
    .cam .none {
      inline-size: 48px;
      block-size: 32px;
      border-radius: var(--sw-r-2xs);
      flex-shrink: 0;
      overflow: hidden;
    }
    .cam .none {
      background: var(--sw-surface-3);
    }
    .cam b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .cam small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
    }
    .status i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--c);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 22%, transparent);
      flex: none;
    }
    .cam .none {
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    }
    svg.net {
      inline-size: 22px;
      block-size: 14px;
      direction: ltr;
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
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .refs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block: 8px;
    }
    camera-image-health-card {
      margin-block-end: 8px;
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .ok {
      font-size: var(--sw-fs-xs);
      color: var(--sw-success-text);
    }
    .nvr {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }
    sw-drawer .nvr {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 12px;
    }
    .nvr div {
      font-size: var(--sw-fs-sm);
    }
    .nvr span {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .filters sw-field {
      inline-size: 200px;
    }
    .pagerow {
      display: flex;
      justify-content: center;
      padding-block-start: 8px;
    }
    /* NOSCROLL-1366-2437: from 1024 px the page takes the screen's height, the table stage takes what is left under the filters and
       pages its rows (fit() above); the recorder card stays one compact row under it */
    @media (min-width: 1024px) {
      sw-page {
        block-size: 100%;
      }
      .stage {
        flex: 1 1 0;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
      .stage > sw-table {
        flex: 0 1 auto;
        min-block-size: 0;
        overflow: hidden;
      }
      /* PAGING-SETTING-2439: the long lists scroll (הגדרות › כללי) - the table scrolls inside the stage, the page stays */
      :host([data-long-lists='scroll']) .stage > sw-table {
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
      .nvr {
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      }
    }
    /* POLISH4-WP2 (D11): the phone. A row is a card (sw-table stacks the cells); this screen keeps the camera, its state, the picture
       check and when it was last seen on the card - FPS, rate, stream and the network bars move to the drawer, so a camera reads in
       one glance instead of a nine-line column. The search takes the full row under the chips. */
    @media (max-width: 767px) {
      .filters sw-field {
        inline-size: auto;
        flex: 1 1 100%;
      }
      .filters .grow {
        display: none;
      }
      .stage {
        min-block-size: 0;
      }
      .nvr {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,Y];d.PHONE_KEYS=new Set(["name","state","image","lastEvent"]);f([c()],d.prototype,"selected",2);f([c()],d.prototype,"filter",2);f([c()],d.prototype,"offlineFirst",2);f([c()],d.prototype,"cameras",2);f([c()],d.prototype,"recorder",2);f([c()],d.prototype,"canSync",2);f([c()],d.prototype,"discovery",2);f([c()],d.prototype,"busy",2);f([c()],d.prototype,"message",2);f([c()],d.prototype,"error",2);f([c()],d.prototype,"dialog",2);f([c()],d.prototype,"formChannel",2);f([c()],d.prototype,"formAlias",2);f([c()],d.prototype,"alias",2);f([c()],d.prototype,"recorderOpen",2);f([c()],d.prototype,"image",2);f([c()],d.prototype,"imageFilter",2);f([c()],d.prototype,"phone",2);f([c()],d.prototype,"narrow",2);f([c()],d.prototype,"page",2);f([c()],d.prototype,"perPage",2);d=f([q("system-devices")],d);export{d as SystemDevices};
