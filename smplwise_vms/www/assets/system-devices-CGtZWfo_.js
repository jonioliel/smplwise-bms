import{E as k,F as _,G as c,a as z,S as C,R as w,A as d,e as i,H as S,e1 as E,aA as O,i as m,pD as N,g as P,ug as M,uh as R,pV as A,pK as F,e0 as V,w as b,C as D}from"./index-DWrXlHoD.js";import"./sw-table-Cabaunxj.js";import"./sw-chip-wZ-Bm0Nb.js";import{c as L,a as l,I as $,b as I,s as T}from"./camera-image-health-lePrSfvS.js";import"./sw-logo-art-Va6y_cIM.js";var q=Object.defineProperty,j=Object.getOwnPropertyDescriptor,u=(e,s,h,r)=>{for(var t=r>1?void 0:r?j(s,h):s,n=e.length-1,a;n>=0;n--)(a=e[n])&&(t=(r?a(s,h,t):a(t))||t);return r&&t&&q(s,h,t),t};const H={dark:"var(--sw-stale)",blurred:"var(--sw-stale)",frozen:"var(--sw-danger)",shifted:"var(--sw-danger)"},K=e=>e?new Date(e).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}):"";let f=class extends z{constructor(){super(...arguments),this.skin=new C(this),this.data=null,this.selected=null,this.busy=!1,this.error=""}async check(){this.busy=!0,this.error="";try{const e=await L();this.dispatchEvent(new CustomEvent("cih-updated",{detail:e,bubbles:!0,composed:!0}))}catch(e){this.error=w(e)}finally{this.busy=!1}}pick(e){this.dispatchEvent(new CustomEvent("cih-filter",{detail:e===this.selected?null:e,bubbles:!0,composed:!0}))}render(){const e=this.data;if(!e)return d;const s=e.counts;if(!e.enabled)return e.can_manage?i`<div class="strip" data-cih-card data-state="off"><span class="h">${l("title")}</span><span class="meta">${l("off")}</span><span class="grow"></span>
        <a href="#/system/diagnostics?tab=health" data-cih-settings>${l("openSettings")}</a></div>`:d;const h=$.some(r=>(s[r]??0)>0);return i`<div class="strip" data-cih-card data-state="on" ?data-warn=${h}>
      <span class="h">${l("title")}</span>
      <sw-chip dot="var(--sw-live)" count=${s.ok??0} data-cih-count="ok">${l("ok")}</sw-chip>
      ${$.filter(r=>(s[r]??0)>0).map(r=>i`<sw-chip dot=${H[r]} count=${s[r]} ?selected=${this.selected===r} data-cih-count=${r} @click=${()=>this.pick(r)}>${l(r)}</sw-chip>`)}
      ${(s.unknown??0)>0?i`<sw-chip dot="var(--sw-unknown)" count=${s.unknown} data-cih-count="unknown">${l("unknown")}</sw-chip>`:d}
      <span class="grow"></span>
      <span class="meta" data-cih-checked>${e.checked_at?l("lastCheck",{t:K(e.checked_at)}):l("never")} · ${l("every",{n:Math.round(e.interval_s/60)})}</span>
      ${this.error?i`<span class="err" role="alert">${this.error}</span>`:d}
      ${e.can_manage?i`<sw-button size="sm" icon="refresh" data-cih-check ?disabled=${this.busy} @click=${()=>this.check()}>${this.busy?l("checking"):l("checkNow")}</sw-button>`:d}
    </div>`}};f.styles=k`
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
  `;u([_({attribute:!1})],f.prototype,"data",2);u([_()],f.prototype,"selected",2);u([c()],f.prototype,"busy",2);u([c()],f.prototype,"error",2);f=u([S("camera-image-health-card")],f);var U=Object.defineProperty,Z=Object.getOwnPropertyDescriptor,p=(e,s,h,r)=>{for(var t=r>1?void 0:r?Z(s,h):s,n=e.length-1,a;n>=0;n--)(a=e[n])&&(t=(r?a(s,h,t):a(t))||t);return r&&t&&U(s,h,t),t};const y=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"],G="display:flex;align-items:center;gap:12px;min-inline-size:0",g="inline-size:72px;block-size:44px;flex:none;border-radius:var(--sw-r-sm);overflow:hidden;";function x(e,s,h,r="cam"){const t=`display:inline-flex;align-items:center;gap:7px;min-block-size:26px;padding:0 11px;border-radius:var(--sw-r-pill);background:color-mix(in srgb, ${s} 20%, var(--sw-surface));color:var(--sw-heading);font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-bold);white-space:nowrap`,n=i`<i style=${`--c:${s};inline-size:8px;block-size:8px;border-radius:50%;background:${s};flex:none`}></i>`;return r==="cam"?i`<span class="status" data-cam-state=${e} style=${t}>${n}${h}</span>`:i`<span class="status" data-cih-cell=${e} style=${t}>${n}${h}</span>`}let o=class extends z{constructor(){super(...arguments),this.bubbleSkin=new C(this),this.selected=null,this.filter="all",this.offlineFirst=!1,this.cameras=null,this.recorder=null,this.canSync=!1,this.discovery=null,this.busy=!1,this.message="",this.error="",this.dialog=!1,this.formChannel=1,this.formAlias="",this.alias="",this.image=null,this.imageFilter=null,this.phone=window.matchMedia("(max-width: 767px)").matches,this.narrow=window.matchMedia("(max-width: 1279px)").matches,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.narrowMq=window.matchMedia("(max-width: 1279px)"),this.onPhone=()=>{this.phone=this.phoneMq.matches,this.narrow=this.narrowMq.matches},this.columns=[{key:"name",label:"מצלמה",render:e=>i`<div class="cam" style=${G}>${e.api&&e.api.status==="online"?i`<img class="snap" src=${E(String(e.id))} alt="" loading="lazy" style=${g+"object-fit:cover;background:var(--sw-surface-3);display:block"} @error=${s=>s.target.style.visibility="hidden"} />`:e.scene?i`<sw-scene kind=${e.scene} style=${g}></sw-scene>`:i`<div class="none" style=${g+"display:grid;place-items:center;color:var(--sw-offline-text);background:color-mix(in srgb, var(--sw-offline) 22%, var(--sw-surface-3))"}><sw-icon name=${e.state==="forbidden"?"lock":"offline"} size=${16}></sw-icon></div>`}<div style="min-inline-size:0"><b style="display:block;font-size:var(--sw-fs-md);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${String(e.name)}</b><small style="display:block;color:var(--sw-text-2);font-size:var(--sw-fs-xs)">${String(e.sub)}</small></div></div>`},{key:"state",label:"מצב",render:e=>x(String(e.state),e.state==="live"?"var(--sw-live)":e.state==="offline"?"var(--sw-danger)":e.state==="unknown"?"var(--sw-unknown)":"var(--sw-stale)",e.state==="live"?"מחוברת":e.state==="offline"?"מנותקת":e.state==="stale"?"לא מעודכן":e.state==="forbidden"?"ללא הרשאה":"לא נבדק")},{key:"fps",label:"FPS",ltr:!0},{key:"bitrate",label:"קצב",ltr:!0},{key:"firmware",label:"זרם ראשי",ltr:!0},{key:"image",label:l("column"),render:e=>this.imageCell(this.imageOf(String(e.id)))},{key:"lastEvent",label:"נראתה לאחרונה"},{key:"net",label:"רשת",render:e=>this.net(e.state==="live"?4:e.state==="stale"?2:0)},{key:"more",label:"",width:"40px",render:()=>i`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback();const e=O().params,s=e.get("filter");(s==="all"||s==="online"||s==="offline"||s==="issues")&&(this.filter=s),this.offlineFirst=e.get("sort")==="offline",this.phoneMq.addEventListener("change",this.onPhone),this.narrowMq.addEventListener("change",this.onPhone),this.reload()}disconnectedCallback(){this.phoneMq.removeEventListener("change",this.onPhone),this.narrowMq.removeEventListener("change",this.onPhone),super.disconnectedCallback()}async reload(){if(!m()){this.cameras=null;return}this.error="";try{const e=await N();this.cameras=e.cameras,this.recorder=e.recorder,this.canSync=e.can_sync,I().then(s=>this.image=s).catch(()=>this.image=null),P("health").then(s=>this.discovery=s.discovery).catch(()=>{})}catch(e){this.error=w(e)}}async sync(){this.busy=!0,this.error="",this.message="";try{const e=await M();this.message=`סנכרון הושלם: ${e.channels} ערוצים (${e.created} חדשים, ${e.updated} עודכנו)${e.recorder.model?` · ${e.recorder.model}`:""}`,await this.reload()}catch(e){this.error=w(e)}finally{this.busy=!1}}async register(){this.busy=!0,this.error="";try{await R({channel:this.formChannel,alias:this.formAlias.trim()}),this.dialog=!1,await this.reload()}catch(e){this.error=w(e)}finally{this.busy=!1}}async saveAlias(e){this.busy=!0,this.error="";try{await A(e,{alias:this.alias.trim()||void 0}),await this.reload(),this.message="הכינוי נשמר (שם ה־NVR לא השתנה)"}catch(s){this.error=w(s)}finally{this.busy=!1}}get rows(){return this.cameras?this.cameras.map(e=>({id:e.id,name:e.name,sub:`ערוץ ${e.channel}${e.name_source&&e.alias?` · NVR: ${e.name_source}`:""}`,state:e.status==="online"?"live":e.status==="offline"?"offline":"unknown",fps:e.stream?.fps?String(e.stream.fps):"—",bitrate:e.stream?.bitrate_kbps?`${(e.stream.bitrate_kbps/1024).toFixed(1)} Mbps`:"—",firmware:e.stream?.resolution?`${e.stream.resolution} ${e.stream.codec??""}`.trim():"—",lastEvent:e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z",""):"לא נבדק",scene:e.status==="online"?y[(e.channel-1)%y.length]:null,channel:e.channel,api:e})):m()?[]:F.map(e=>({id:e.id,name:e.name,sub:`${e.floor} · ערוץ ${e.id.replace("cam-","")}`,state:e.state,fps:e.fps?String(e.fps):"—",bitrate:e.bitrateKbps?`${(e.bitrateKbps/1024).toFixed(1)} Mbps`:"—",firmware:e.firmware,lastEvent:e.lastEvent,scene:e.state==="offline"||e.state==="forbidden"?null:V[e.id]??"lobby",channel:Number(e.id.replace("cam-",""))}))}imageOf(e){return this.image?.enabled?this.image.cameras.find(s=>s.id===e):void 0}imageCell(e){if(!e||e.state==="off")return i`<span class="hint">—</span>`;const s=e.state==="warn"?e.issues.some(r=>r==="frozen"||r==="shifted")?"var(--sw-danger)":"var(--sw-stale)":e.state==="ok"?"var(--sw-live)":"var(--sw-unknown)",h=e.state==="warn"?e.issues.map(r=>l(r)).join(", "):e.state==="ok"?l("stateOk"):e.state==="excluded"?l("stateExcluded"):e.error_text??l("stateUnknown");return x(e.state,s,h,"cih")}imageRows(e){const s=e.metrics;return i`<dt>${l("column")}</dt><dd>${this.imageCell(e)}</dd>
      ${s.brightness!=null?i`<dt>${l("brightness")} · ${l("sharpness")}</dt><dd><span class="ltr">${Math.round(s.brightness)} · ${Math.round(s.sharpness??0)}</span></dd>`:d}
      <dt>${l("reference")}</dt><dd data-cih-ref>${e.reference?e.reference.auto?l("refAuto"):l("refManual"):l("refNone")}</dd>`}async reference(e,s){this.busy=!0,this.error="";try{this.image={...await T(e,s)}}catch(h){this.error=w(h)}finally{this.busy=!1}}net(e){return b`<svg class="net" viewBox="0 0 22 14" aria-label="רשת">${[0,1,2,3].map(s=>b`<rect x=${s*5.5} y=${11-s*3} width="4" height=${3+s*3} rx="1" fill=${s<e?e>=3?"var(--sw-live)":"var(--sw-stale)":"var(--sw-border-strong)"} />`)}</svg>`}get shownColumns(){return this.phone?this.columns.filter(e=>o.PHONE_KEYS.has(e.key)&&(e.key!=="image"||!!this.image?.enabled)):this.narrow?this.columns.filter(e=>e.key!=="net"&&e.key!=="more"):this.columns}render(){const e=this.rows,s=this.imageFilter,h=e.filter(a=>this.filter==="all"?!0:this.filter==="online"?a.state==="live":this.filter==="offline"?a.state==="offline":a.state==="stale"||a.state==="forbidden"||a.state==="unknown").filter(a=>!s||(this.imageOf(a.id)?.issues??[]).includes(s)),r=this.offlineFirst?[...h].sort((a,v)=>+(v.state==="offline")-+(a.state==="offline")):h,t=e.find(a=>a.id===this.selected),n=!!this.cameras;return i`
      <sw-page heading="בריאות מצלמות" subheading=${n?`${this.recorder?.name??"NVR"}${this.recorder?.model?` · ${this.recorder.model}`:""} · ${e.length} מצלמות רשומות · גילוי לקריאה בלבד`:m()?"קורא את רשימת המצלמות · גילוי לקריאה בלבד":"NVR ראשי · 10 ערוצים · Capability matrix לפי ראיות · נתוני הדגמה"}>
        ${n&&this.canSync?i`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>${this.busy?"מסנכרן…":"סנכרון מה־NVR (קריאה)"}</sw-button>`:i`<sw-button slot="actions" icon="refresh" ?disabled=${n||m()}>בדיקת יכולות (קריאה)</sw-button>`}
        ${n&&this.discovery?i`<div style="font-size:var(--sw-fs-xs);color:${this.discovery.cameras_last_error?"var(--sw-danger)":"var(--sw-text-3)"};margin-block-end:8px">גילוי אוטומטי מה־NVR כל ${Math.round(this.discovery.interval_s/60)} דק׳ · ${this.discovery.cameras_last_error?`נכשל: ${this.discovery.cameras_last_error}`:this.discovery.cameras_last_ok?`הצליח ${this.discovery.cameras_last_ok.replace("T"," ").replace("Z"," UTC")}`:"טרם רץ"}${this.discovery.streams_last_error?` · זרמי go2rtc: ${this.discovery.streams_last_error}`:""}</div>`:d}
        ${n&&this.canSync?i`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>{this.dialog=!0,this.formAlias="",this.formChannel=(e.length?Math.max(...e.map(a=>a.channel)):0)+1}}>רישום ידני</sw-button>`:d}
        ${this.message?i`<div class="ok">${this.message}</div>`:d}
        ${this.error&&!(m()&&!n)?i`<div class="err">${this.error}</div>`:d}
        ${n&&this.image?i`<camera-image-health-card .data=${this.image} .selected=${this.imageFilter}
          @cih-updated=${a=>this.image=a.detail} @cih-filter=${a=>this.imageFilter=a.detail}></camera-image-health-card>`:d}
        <div class="filters">
          <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${e.length}>הכל</sw-chip>
          <sw-chip dot="var(--sw-live)" ?selected=${this.filter==="online"} @click=${()=>this.filter="online"} count=${e.filter(a=>a.state==="live").length}>מחוברות</sw-chip>
          <sw-chip dot="var(--sw-danger)" ?selected=${this.filter==="offline"} @click=${()=>this.filter="offline"} count=${e.filter(a=>a.state==="offline").length}>מנותקות</sw-chip>
          <sw-chip dot="var(--sw-stale)" ?selected=${this.filter==="issues"} @click=${()=>this.filter="issues"} count=${e.filter(a=>a.state!=="live"&&a.state!=="offline").length}>בעיות / לא נבדק</sw-chip>
          <span class="grow"></span>
          <sw-field><input type="search" placeholder="חיפוש מצלמה…" aria-label="חיפוש" /></sw-field>
        </div>
        <div class="stage">
          ${m()&&!n?this.error?i`<sw-state-panel state="error" heading="רשימת המצלמות לא נטענה" hint=${this.error} actionLabel="נסה שוב" data-cam-error @action=${()=>void this.reload()}></sw-state-panel>`:i`<sw-state-panel state="loading" heading="טוען מצלמות…" data-cam-loading></sw-state-panel>`:n&&!e.length?i`<sw-state-panel icon="camera" state="empty" heading="אין מצלמות רשומות" hint="הגדירו את פרטי ה־NVR בהגדרות ‹ חיבורים ולחצו 'סנכרון מה־NVR', או רשמו ערוץ ידנית."></sw-state-panel>`:i`<sw-table focus-rows .columns=${this.shownColumns} .rows=${r} .selected=${this.selected} @row-select=${a=>{this.selected=a.detail.id,this.alias=e.find(v=>v.id===a.detail.id)?.api?.alias??""}}></sw-table>`}
          ${t?i`<sw-drawer open heading=${t.name} subheading=${t.sub} @close=${()=>this.selected=null}>
                <sw-field label="כינוי מקומי" hint="שינוי כינוי אינו משנה OSD; שם ה־NVR נשמר בנפרד"><input .value=${n?this.alias:t.name} ?disabled=${!n||!this.canSync} @input=${a=>this.alias=a.target.value} /></sw-field>
                <dl>
                  <dt>שם ב־NVR</dt><dd>${n?t.api?.name_source||"—":`Camera ${t.channel}`}</dd>
                  <dt>Tracks</dt><dd><span class="ltr">${n?`${t.api?.main_track??"?"} / ${t.api?.sub_track??"?"}`:`${t.channel}01 / ${t.channel}02`}</span></dd>
                  <dt>מצב</dt><dd><sw-badge kind=${t.state}></sw-badge></dd>
                  <dt>נראתה לאחרונה</dt><dd>${t.lastEvent}</dd>
                  ${this.phone?i`<dt>FPS · קצב</dt><dd><span class="ltr">${t.fps} · ${t.bitrate}</span></dd><dt>זרם ראשי</dt><dd><span class="ltr">${t.firmware}</span></dd>`:d}
                  ${this.imageOf(t.id)?this.imageRows(this.imageOf(t.id)):d}
                </dl>
                ${this.image?.can_manage&&this.imageOf(t.id)&&this.imageOf(t.id).state!=="excluded"?i`<div class="refs" data-cih-ref-actions>
                  <sw-button size="sm" variant="ghost" icon="camera" ?disabled=${this.busy||!this.imageOf(t.id).sampled_at||!!this.imageOf(t.id).error} @click=${()=>this.reference(t.id,"set")}>${l("refSet")}</sw-button>
                  ${this.imageOf(t.id).reference?i`<sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.reference(t.id,"clear")}>${l("refClear")}</sw-button>`:d}
                </div>`:d}
                <div class="hint">ניתוק מקור מוצג כניתוק, לא כאשמת הממשק. פעולות רגישות (אתחול, OSD) דורשות הרשאה ואישור ואינן בפיילוט.</div>
                <div slot="footer">
                  ${n&&this.canSync?i`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.saveAlias(t.id)}>שמור כינוי</sw-button>`:d}
                  <sw-button variant="danger" size="sm" disabled>אתחול מצלמה</sw-button>
                </div>
              </sw-drawer>`:d}
        </div>
        ${!n&&!m()?i`<sw-card heading="NVR ראשי">
              <div class="nvr">
                <div><span>דגם</span>DS-76xx (הדגמה)</div>
                <div><span>קושחה</span><span class="ltr">V4.84.x</span></div>
                <div><span>ערוצים</span>10/16</div>
                <div><span>דיסק</span>1 · תקין · 30% פנוי</div>
                <div><span>שעון</span>NTP · סטייה 2 שנ׳</div>
                <div><span>חיפוש במקביל</span>1 (מגבלת מכשיר)</div>
              </div>
            </sw-card>`:this.recorder?i`<sw-card heading=${this.recorder.name}>
                <div class="nvr">
                  <div><span>דגם</span>${this.recorder.model??"לא נבדק"}</div>
                  <div><span>קושחה</span><span class="ltr">${this.recorder.firmware??"—"}</span></div>
                  <div><span>סנכרון אחרון</span>${this.recorder.last_seen_at?this.recorder.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</div>
                  <div><span>גישה</span>קריאה בלבד (ISAPI)</div>
                </div>
              </sw-card>`:d}
        ${this.dialog?i`<sw-dialog open heading="רישום מצלמה ידני" subheading="כשה־NVR לא מוגדר עדיין; הסנכרון יעדכן שם ומצב" @close=${()=>this.dialog=!1}>
              <sw-field label="מספר ערוץ ב־NVR"><input type="number" min="1" max="256" data-ltr .value=${String(this.formChannel)} @input=${a=>this.formChannel=Number(a.target.value)} /></sw-field>
              <sw-field label="כינוי"><input .value=${this.formAlias} @input=${a=>this.formAlias=a.target.value} placeholder="למשל: כניסה ראשית" /></sw-field>
              ${this.error?i`<div class="err">${this.error}</div>`:d}
              <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" ?disabled=${!this.formAlias.trim()||this.busy} @click=${()=>this.register()}>רישום</sw-button>
            </sw-dialog>`:d}
      </sw-page>
    `}};o.styles=[k`
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
  `,D];o.PHONE_KEYS=new Set(["name","state","image","lastEvent"]);p([c()],o.prototype,"selected",2);p([c()],o.prototype,"filter",2);p([c()],o.prototype,"offlineFirst",2);p([c()],o.prototype,"cameras",2);p([c()],o.prototype,"recorder",2);p([c()],o.prototype,"canSync",2);p([c()],o.prototype,"discovery",2);p([c()],o.prototype,"busy",2);p([c()],o.prototype,"message",2);p([c()],o.prototype,"error",2);p([c()],o.prototype,"dialog",2);p([c()],o.prototype,"formChannel",2);p([c()],o.prototype,"formAlias",2);p([c()],o.prototype,"alias",2);p([c()],o.prototype,"image",2);p([c()],o.prototype,"imageFilter",2);p([c()],o.prototype,"phone",2);p([c()],o.prototype,"narrow",2);o=p([S("system-devices")],o);export{o as SystemDevices};
//# sourceMappingURL=system-devices-CGtZWfo_.js.map
