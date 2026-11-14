import{E as C,F as S,G as c,a as O,S as P,Y as b,A as h,e as t,H as M,aB as E,bj as R,i as u,f8 as N,g as F,vV as A,vW as q,re as L,r3 as D,fm as V,w as x,C as H}from"./index-Cx0qJkOE.js";import"./sw-table-Cjr4SNtP.js";import"./sw-chip-DcV02GIb.js";import"./sw-pager-BafkMmYy.js";import{c as I,a as l,I as k,b as T,s as j}from"./camera-image-health-RjZCE9ke.js";import"./sw-logo-art-Va6y_cIM.js";var K=Object.defineProperty,U=Object.getOwnPropertyDescriptor,$=(e,s,d,i)=>{for(var r=i>1?void 0:i?U(s,d):s,m=e.length-1,w;m>=0;m--)(w=e[m])&&(r=(i?w(s,d,r):w(r))||r);return i&&r&&K(s,d,r),r};const W={dark:"var(--sw-stale)",blurred:"var(--sw-stale)",frozen:"var(--sw-danger)",shifted:"var(--sw-danger)"},Y=e=>e?new Date(e).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}):"";let g=class extends O{constructor(){super(...arguments),this.skin=new P(this),this.data=null,this.selected=null,this.busy=!1,this.error=""}async check(){this.busy=!0,this.error="";try{const e=await I();this.dispatchEvent(new CustomEvent("cih-updated",{detail:e,bubbles:!0,composed:!0}))}catch(e){this.error=b(e)}finally{this.busy=!1}}pick(e){this.dispatchEvent(new CustomEvent("cih-filter",{detail:e===this.selected?null:e,bubbles:!0,composed:!0}))}render(){const e=this.data;if(!e)return h;const s=e.counts;if(!e.enabled)return e.can_manage?t`<div class="strip" data-cih-card data-state="off"><span class="h">${l("title")}</span><span class="meta">${l("off")}</span><span class="grow"></span>
        <a href="#/system/diagnostics?tab=health" data-cih-settings>${l("openSettings")}</a></div>`:h;const d=k.some(i=>(s[i]??0)>0);return t`<div class="strip" data-cih-card data-state="on" ?data-warn=${d}>
      <span class="h">${l("title")}</span>
      <sw-chip dot="var(--sw-live)" count=${s.ok??0} data-cih-count="ok">${l("ok")}</sw-chip>
      ${k.filter(i=>(s[i]??0)>0).map(i=>t`<sw-chip dot=${W[i]} count=${s[i]} ?selected=${this.selected===i} data-cih-count=${i} @click=${()=>this.pick(i)}>${l(i)}</sw-chip>`)}
      ${(s.unknown??0)>0?t`<sw-chip dot="var(--sw-unknown)" count=${s.unknown} data-cih-count="unknown">${l("unknown")}</sw-chip>`:h}
      <span class="grow"></span>
      <span class="meta" data-cih-checked>${e.checked_at?l("lastCheck",{t:Y(e.checked_at)}):l("never")} · ${l("every",{n:Math.round(e.interval_s/60)})}</span>
      ${this.error?t`<span class="err" role="alert">${this.error}</span>`:h}
      ${e.can_manage?t`<sw-button size="sm" icon="refresh" data-cih-check ?disabled=${this.busy} @click=${()=>this.check()}>${this.busy?l("checking"):l("checkNow")}</sw-button>`:h}
    </div>`}};g.styles=C`
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
  `;$([S({attribute:!1})],g.prototype,"data",2);$([S()],g.prototype,"selected",2);$([c()],g.prototype,"busy",2);$([c()],g.prototype,"error",2);g=$([M("camera-image-health-card")],g);var Z=Object.defineProperty,B=Object.getOwnPropertyDescriptor,p=(e,s,d,i)=>{for(var r=i>1?void 0:i?B(s,d):s,m=e.length-1,w;m>=0;m--)(w=e[m])&&(r=(i?w(s,d,r):w(r))||r);return i&&r&&Z(s,d,r),r};const _=["entrance","lobby","corridor","hall","parking","warehouse","backyard","driveway","night"],G="display:flex;align-items:center;gap:12px;min-inline-size:0",y="inline-size:72px;block-size:44px;flex:none;border-radius:var(--sw-r-sm);overflow:hidden;";function z(e,s,d,i="cam"){const r=`display:inline-flex;align-items:center;gap:7px;min-block-size:26px;padding:0 11px;border-radius:var(--sw-r-pill);background:color-mix(in srgb, ${s} 20%, var(--sw-surface));color:var(--sw-heading);font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-bold);white-space:nowrap`,m=t`<i style=${`--c:${s};inline-size:8px;block-size:8px;border-radius:50%;background:${s};flex:none`}></i>`;return i==="cam"?t`<span class="status" data-cam-state=${e} style=${r}>${m}${d}</span>`:t`<span class="status" data-cih-cell=${e} style=${r}>${m}${d}</span>`}let o=class extends O{constructor(){super(...arguments),this.bubbleSkin=new P(this),this.selected=null,this.filter="all",this.offlineFirst=!1,this.cameras=null,this.recorder=null,this.canSync=!1,this.discovery=null,this.busy=!1,this.message="",this.error="",this.dialog=!1,this.formChannel=1,this.formAlias="",this.alias="",this.image=null,this.imageFilter=null,this.phone=window.matchMedia("(max-width: 767px)").matches,this.narrow=window.matchMedia("(max-width: 1279px)").matches,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.narrowMq=window.matchMedia("(max-width: 1279px)"),this.onPhone=()=>{this.phone=this.phoneMq.matches,this.narrow=this.narrowMq.matches},this.page=1,this.visibleCount=0,this.fitCount=-1,this.perPage=0,this.deskMq=window.matchMedia("(min-width: 1024px)"),this.fitObs=null,this.fitRaf=0,this.onDesk=()=>this.scheduleFit(),this.columns=[{key:"name",label:"מצלמה",render:e=>t`<div class="cam" style=${G}>${e.api&&e.api.status==="online"?t`<img class="snap" src=${E(String(e.id))} alt="" loading="lazy" style=${y+"object-fit:cover;background:var(--sw-surface-3);display:block"} @error=${s=>s.target.style.visibility="hidden"} />`:e.scene?t`<sw-scene kind=${e.scene} style=${y}></sw-scene>`:t`<div class="none" style=${y+"display:grid;place-items:center;color:var(--sw-offline-text);background:color-mix(in srgb, var(--sw-offline) 22%, var(--sw-surface-3))"}><sw-icon name=${e.state==="forbidden"?"lock":"offline"} size=${16}></sw-icon></div>`}<div style="min-inline-size:0"><b style="display:block;font-size:var(--sw-fs-md);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${String(e.name)}</b><small style="display:block;color:var(--sw-text-2);font-size:var(--sw-fs-xs)">${String(e.sub)}</small></div></div>`},{key:"state",label:"מצב",render:e=>z(String(e.state),e.state==="live"?"var(--sw-live)":e.state==="offline"?"var(--sw-danger)":e.state==="unknown"?"var(--sw-unknown)":"var(--sw-stale)",e.state==="live"?"מחוברת":e.state==="offline"?"מנותקת":e.state==="stale"?"לא מעודכן":e.state==="forbidden"?"ללא הרשאה":"לא נבדק")},{key:"fps",label:"FPS",ltr:!0},{key:"bitrate",label:"קצב",ltr:!0},{key:"firmware",label:"זרם ראשי",ltr:!0},{key:"image",label:l("column"),render:e=>this.imageCell(this.imageOf(String(e.id)))},{key:"lastEvent",label:"נראתה לאחרונה"},{key:"net",label:"רשת",render:e=>this.net(e.state==="live"?4:e.state==="stale"?2:0)},{key:"more",label:"",width:"40px",render:()=>t`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback();const e=R().params,s=e.get("filter");(s==="all"||s==="online"||s==="offline"||s==="issues")&&(this.filter=s),this.offlineFirst=e.get("sort")==="offline",this.phoneMq.addEventListener("change",this.onPhone),this.narrowMq.addEventListener("change",this.onPhone),this.deskMq.addEventListener("change",this.onDesk),this.reload()}disconnectedCallback(){this.phoneMq.removeEventListener("change",this.onPhone),this.narrowMq.removeEventListener("change",this.onPhone),this.deskMq.removeEventListener("change",this.onDesk),this.fitObs?.disconnect(),this.fitObs=null,cancelAnimationFrame(this.fitRaf),super.disconnectedCallback()}updated(){const e=this.renderRoot.querySelector(".stage");e&&!this.fitObs&&typeof ResizeObserver<"u"&&(this.fitObs=new ResizeObserver(()=>this.scheduleFit()),this.fitObs.observe(e)),this.visibleCount!==this.fitCount&&(this.fitCount=this.visibleCount,this.scheduleFit())}scheduleFit(){cancelAnimationFrame(this.fitRaf),this.fitRaf=requestAnimationFrame(()=>this.fit())}fit(){if(!this.deskMq.matches){this.perPage&&(this.perPage=0);return}const e=this.renderRoot.querySelector(".stage"),d=e?.querySelector("sw-table")?.shadowRoot,i=d?.querySelector("thead"),r=d?.querySelector("tbody tr");if(!e||!i||!r||!r.offsetHeight)return;const m=44,w=e.clientHeight-i.offsetHeight-2,n=Math.floor(w/r.offsetHeight),f=Math.max(3,Math.floor((w-m)/r.offsetHeight)),v=this.visibleCount<=n?0:f;v!==this.perPage&&(this.perPage=v)}async reload(){if(!u()){this.cameras=null;return}this.error="";try{const e=await N();this.cameras=e.cameras,this.recorder=e.recorder,this.canSync=e.can_sync,T().then(s=>this.image=s).catch(()=>this.image=null),F("health").then(s=>this.discovery=s.discovery).catch(()=>{})}catch(e){this.error=b(e)}}async sync(){this.busy=!0,this.error="",this.message="";try{const e=await A();this.message=`סנכרון הושלם: ${e.channels} ערוצים (${e.created} חדשים, ${e.updated} עודכנו)${e.recorder.model?` · ${e.recorder.model}`:""}`,await this.reload()}catch(e){this.error=b(e)}finally{this.busy=!1}}async register(){this.busy=!0,this.error="";try{await q({channel:this.formChannel,alias:this.formAlias.trim()}),this.dialog=!1,await this.reload()}catch(e){this.error=b(e)}finally{this.busy=!1}}async saveAlias(e){this.busy=!0,this.error="";try{await L(e,{alias:this.alias.trim()||void 0}),await this.reload(),this.message="הכינוי נשמר (שם ה־NVR לא השתנה)"}catch(s){this.error=b(s)}finally{this.busy=!1}}get rows(){return this.cameras?this.cameras.map(e=>({id:e.id,name:e.name,sub:`ערוץ ${e.channel}${e.name_source&&e.alias?` · NVR: ${e.name_source}`:""}`,state:e.status==="online"?"live":e.status==="offline"?"offline":"unknown",fps:e.stream?.fps?String(e.stream.fps):"—",bitrate:e.stream?.bitrate_kbps?`${(e.stream.bitrate_kbps/1024).toFixed(1)} Mbps`:"—",firmware:e.stream?.resolution?`${e.stream.resolution} ${e.stream.codec??""}`.trim():"—",lastEvent:e.last_seen_at?e.last_seen_at.replace("T"," ").replace("Z",""):"לא נבדק",scene:e.status==="online"?_[(e.channel-1)%_.length]:null,channel:e.channel,api:e})):u()?[]:D.map(e=>({id:e.id,name:e.name,sub:`${e.floor} · ערוץ ${e.id.replace("cam-","")}`,state:e.state,fps:e.fps?String(e.fps):"—",bitrate:e.bitrateKbps?`${(e.bitrateKbps/1024).toFixed(1)} Mbps`:"—",firmware:e.firmware,lastEvent:e.lastEvent,scene:e.state==="offline"||e.state==="forbidden"?null:V[e.id]??"lobby",channel:Number(e.id.replace("cam-",""))}))}imageOf(e){return this.image?.enabled?this.image.cameras.find(s=>s.id===e):void 0}imageCell(e){if(!e||e.state==="off")return t`<span class="hint">—</span>`;const s=e.state==="warn"?e.issues.some(i=>i==="frozen"||i==="shifted")?"var(--sw-danger)":"var(--sw-stale)":e.state==="ok"?"var(--sw-live)":"var(--sw-unknown)",d=e.state==="warn"?e.issues.map(i=>l(i)).join(", "):e.state==="ok"?l("stateOk"):e.state==="excluded"?l("stateExcluded"):e.error_text??l("stateUnknown");return z(e.state,s,d,"cih")}imageRows(e){const s=e.metrics;return t`<dt>${l("column")}</dt><dd>${this.imageCell(e)}</dd>
      ${s.brightness!=null?t`<dt>${l("brightness")} · ${l("sharpness")}</dt><dd><span class="ltr">${Math.round(s.brightness)} · ${Math.round(s.sharpness??0)}</span></dd>`:h}
      <dt>${l("reference")}</dt><dd data-cih-ref>${e.reference?e.reference.auto?l("refAuto"):l("refManual"):l("refNone")}</dd>`}async reference(e,s){this.busy=!0,this.error="";try{this.image={...await j(e,s)}}catch(d){this.error=b(d)}finally{this.busy=!1}}net(e){return x`<svg class="net" viewBox="0 0 22 14" aria-label="רשת">${[0,1,2,3].map(s=>x`<rect x=${s*5.5} y=${11-s*3} width="4" height=${3+s*3} rx="1" fill=${s<e?e>=3?"var(--sw-live)":"var(--sw-stale)":"var(--sw-border-strong)"} />`)}</svg>`}get shownColumns(){return this.phone?this.columns.filter(e=>o.PHONE_KEYS.has(e.key)&&(e.key!=="image"||!!this.image?.enabled)):this.narrow?this.columns.filter(e=>e.key!=="net"&&e.key!=="more"):this.columns}render(){const e=this.rows,s=this.imageFilter,d=e.filter(a=>this.filter==="all"?!0:this.filter==="online"?a.state==="live":this.filter==="offline"?a.state==="offline":a.state==="stale"||a.state==="forbidden"||a.state==="unknown").filter(a=>!s||(this.imageOf(a.id)?.issues??[]).includes(s)),i=this.offlineFirst?[...d].sort((a,v)=>+(v.state==="offline")-+(a.state==="offline")):d;this.visibleCount=i.length;const r=this.perPage?Math.max(1,Math.ceil(i.length/this.perPage)):1,m=Math.min(this.page,r),w=this.perPage?i.slice((m-1)*this.perPage,m*this.perPage):i,n=e.find(a=>a.id===this.selected),f=!!this.cameras;return t`
      <sw-page heading="בריאות מצלמות" subheading=${f?`${this.recorder?.name??"NVR"}${this.recorder?.model?` · ${this.recorder.model}`:""} · ${e.length} מצלמות רשומות · גילוי לקריאה בלבד`:u()?"קורא את רשימת המצלמות · גילוי לקריאה בלבד":"NVR ראשי · 10 ערוצים · Capability matrix לפי ראיות · נתוני הדגמה"}>
        ${f&&this.canSync?t`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>${this.busy?"מסנכרן…":"סנכרון מה־NVR (קריאה)"}</sw-button>`:t`<sw-button slot="actions" icon="refresh" ?disabled=${f||u()}>בדיקת יכולות (קריאה)</sw-button>`}
        ${f&&this.discovery?t`<div style="font-size:var(--sw-fs-xs);color:${this.discovery.cameras_last_error?"var(--sw-danger)":"var(--sw-text-3)"};margin-block-end:8px">גילוי אוטומטי מה־NVR כל ${Math.round(this.discovery.interval_s/60)} דק׳ · ${this.discovery.cameras_last_error?`נכשל: ${this.discovery.cameras_last_error}`:this.discovery.cameras_last_ok?`הצליח ${this.discovery.cameras_last_ok.replace("T"," ").replace("Z"," UTC")}`:"טרם רץ"}${this.discovery.streams_last_error?` · זרמי go2rtc: ${this.discovery.streams_last_error}`:""}</div>`:h}
        ${f&&this.canSync?t`<sw-button slot="actions" variant="primary" icon="plus" @click=${()=>{this.dialog=!0,this.formAlias="",this.formChannel=(e.length?Math.max(...e.map(a=>a.channel)):0)+1}}>רישום ידני</sw-button>`:h}
        ${this.message?t`<div class="ok">${this.message}</div>`:h}
        ${this.error&&!(u()&&!f)?t`<div class="err">${this.error}</div>`:h}
        ${f&&this.image?t`<camera-image-health-card .data=${this.image} .selected=${this.imageFilter}
          @cih-updated=${a=>this.image=a.detail} @cih-filter=${a=>this.imageFilter=a.detail}></camera-image-health-card>`:h}
        <div class="filters">
          <sw-chip ?selected=${this.filter==="all"} @click=${()=>this.filter="all"} count=${e.length}>הכל</sw-chip>
          <sw-chip dot="var(--sw-live)" ?selected=${this.filter==="online"} @click=${()=>this.filter="online"} count=${e.filter(a=>a.state==="live").length}>מחוברות</sw-chip>
          <sw-chip dot="var(--sw-danger)" ?selected=${this.filter==="offline"} @click=${()=>this.filter="offline"} count=${e.filter(a=>a.state==="offline").length}>מנותקות</sw-chip>
          <sw-chip dot="var(--sw-stale)" ?selected=${this.filter==="issues"} @click=${()=>this.filter="issues"} count=${e.filter(a=>a.state!=="live"&&a.state!=="offline").length}>בעיות / לא נבדק</sw-chip>
          <span class="grow"></span>
          <sw-field><input type="search" placeholder="חיפוש מצלמה…" aria-label="חיפוש" /></sw-field>
        </div>
        <div class="stage">
          ${u()&&!f?this.error?t`<sw-state-panel state="error" heading="רשימת המצלמות לא נטענה" hint=${this.error} actionLabel="נסה שוב" data-cam-error @action=${()=>void this.reload()}></sw-state-panel>`:t`<sw-state-panel state="loading" heading="טוען מצלמות…" data-cam-loading></sw-state-panel>`:f&&!e.length?t`<sw-state-panel icon="camera" state="empty" heading="אין מצלמות רשומות" hint="הגדירו את פרטי ה־NVR בהגדרות ‹ חיבורים ולחצו 'סנכרון מה־NVR', או רשמו ערוץ ידנית."></sw-state-panel>`:t`<sw-table focus-rows .columns=${this.shownColumns} .rows=${w} .selected=${this.selected} @row-select=${a=>{this.selected=a.detail.id,this.alias=e.find(v=>v.id===a.detail.id)?.api?.alias??""}}></sw-table>
              ${r>1?t`<div class="pagerow"><sw-pager data-health-pager .page=${m} .pages=${r} @page-change=${a=>this.page=a.detail.page}></sw-pager></div>`:h}`}
          ${n?t`<sw-drawer open heading=${n.name} subheading=${n.sub} @close=${()=>this.selected=null}>
                <sw-field label="כינוי מקומי" hint="שינוי כינוי אינו משנה OSD; שם ה־NVR נשמר בנפרד"><input .value=${f?this.alias:n.name} ?disabled=${!f||!this.canSync} @input=${a=>this.alias=a.target.value} /></sw-field>
                <dl>
                  <dt>שם ב־NVR</dt><dd>${f?n.api?.name_source||"—":`Camera ${n.channel}`}</dd>
                  <dt>Tracks</dt><dd><span class="ltr">${f?`${n.api?.main_track??"?"} / ${n.api?.sub_track??"?"}`:`${n.channel}01 / ${n.channel}02`}</span></dd>
                  <dt>מצב</dt><dd><sw-badge kind=${n.state}></sw-badge></dd>
                  <dt>נראתה לאחרונה</dt><dd>${n.lastEvent}</dd>
                  ${this.phone?t`<dt>FPS · קצב</dt><dd><span class="ltr">${n.fps} · ${n.bitrate}</span></dd><dt>זרם ראשי</dt><dd><span class="ltr">${n.firmware}</span></dd>`:h}
                  ${this.imageOf(n.id)?this.imageRows(this.imageOf(n.id)):h}
                </dl>
                ${this.image?.can_manage&&this.imageOf(n.id)&&this.imageOf(n.id).state!=="excluded"?t`<div class="refs" data-cih-ref-actions>
                  <sw-button size="sm" variant="ghost" icon="camera" ?disabled=${this.busy||!this.imageOf(n.id).sampled_at||!!this.imageOf(n.id).error} @click=${()=>this.reference(n.id,"set")}>${l("refSet")}</sw-button>
                  ${this.imageOf(n.id).reference?t`<sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.reference(n.id,"clear")}>${l("refClear")}</sw-button>`:h}
                </div>`:h}
                <div class="hint">ניתוק מקור מוצג כניתוק, לא כאשמת הממשק. פעולות רגישות (אתחול, OSD) דורשות הרשאה ואישור ואינן בפיילוט.</div>
                <div slot="footer">
                  ${f&&this.canSync?t`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.saveAlias(n.id)}>שמור כינוי</sw-button>`:h}
                  <sw-button variant="danger" size="sm" disabled>אתחול מצלמה</sw-button>
                </div>
              </sw-drawer>`:h}
        </div>
        ${!f&&!u()?t`<sw-card heading="NVR ראשי">
              <div class="nvr">
                <div><span>דגם</span>DS-76xx (הדגמה)</div>
                <div><span>קושחה</span><span class="ltr">V4.84.x</span></div>
                <div><span>ערוצים</span>10/16</div>
                <div><span>דיסק</span>1 · תקין · 30% פנוי</div>
                <div><span>שעון</span>NTP · סטייה 2 שנ׳</div>
                <div><span>חיפוש במקביל</span>1 (מגבלת מכשיר)</div>
              </div>
            </sw-card>`:this.recorder?t`<sw-card heading=${this.recorder.name}>
                <div class="nvr">
                  <div><span>דגם</span>${this.recorder.model??"לא נבדק"}</div>
                  <div><span>קושחה</span><span class="ltr">${this.recorder.firmware??"—"}</span></div>
                  <div><span>סנכרון אחרון</span>${this.recorder.last_seen_at?this.recorder.last_seen_at.replace("T"," ").replace("Z"," UTC"):"—"}</div>
                  <div><span>גישה</span>קריאה בלבד (ISAPI)</div>
                </div>
              </sw-card>`:h}
        ${this.dialog?t`<sw-dialog open heading="רישום מצלמה ידני" subheading="כשה־NVR לא מוגדר עדיין; הסנכרון יעדכן שם ומצב" @close=${()=>this.dialog=!1}>
              <sw-field label="מספר ערוץ ב־NVR"><input type="number" min="1" max="256" data-ltr .value=${String(this.formChannel)} @input=${a=>this.formChannel=Number(a.target.value)} /></sw-field>
              <sw-field label="כינוי"><input .value=${this.formAlias} @input=${a=>this.formAlias=a.target.value} placeholder="למשל: כניסה ראשית" /></sw-field>
              ${this.error?t`<div class="err">${this.error}</div>`:h}
              <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=!1}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" ?disabled=${!this.formAlias.trim()||this.busy} @click=${()=>this.register()}>רישום</sw-button>
            </sw-dialog>`:h}
      </sw-page>
    `}};o.styles=[C`
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
  `,H];o.PHONE_KEYS=new Set(["name","state","image","lastEvent"]);p([c()],o.prototype,"selected",2);p([c()],o.prototype,"filter",2);p([c()],o.prototype,"offlineFirst",2);p([c()],o.prototype,"cameras",2);p([c()],o.prototype,"recorder",2);p([c()],o.prototype,"canSync",2);p([c()],o.prototype,"discovery",2);p([c()],o.prototype,"busy",2);p([c()],o.prototype,"message",2);p([c()],o.prototype,"error",2);p([c()],o.prototype,"dialog",2);p([c()],o.prototype,"formChannel",2);p([c()],o.prototype,"formAlias",2);p([c()],o.prototype,"alias",2);p([c()],o.prototype,"image",2);p([c()],o.prototype,"imageFilter",2);p([c()],o.prototype,"phone",2);p([c()],o.prototype,"narrow",2);p([c()],o.prototype,"page",2);p([c()],o.prototype,"perPage",2);o=p([M("system-devices")],o);export{o as SystemDevices};
//# sourceMappingURL=system-devices-C9or8LuZ.js.map
